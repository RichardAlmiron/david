import crypto from 'node:crypto';
import type {
  CourierSettlementStatus,
  CustomerPaymentStatus,
  DeliveryStatus,
  Order,
  OrderAttributionPayload,
  OrderStatus,
  PaidTouchSnapshot
} from '../src/types.ts';
import {
  getSupabaseCreds,
  hydrateAutoadsFromSupabase,
  postgrestUpsert,
  readIntelligenceState,
  readOrdersAttributionState,
  writeOrdersAttributionState,
  type CloudSyncQueueItem,
  type StoredOrderAttribution,
  type StoredWaToken
} from './autoadsStore.ts';

const LAST_PAID_TOUCH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function buildCanonicalEventId(reservaId: string, eventName: string): string {
  const cleanId = String(reservaId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanEv = String(eventName || 'Lead')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
  return `ord_${cleanId || 'anon'}_${cleanEv}`;
}

export function normalizeParaguayPhone(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('5959') && digits.length >= 11) return digits;
  if (digits.startsWith('09') && digits.length >= 10) return `595${digits.slice(1)}`;
  if (digits.startsWith('9') && digits.length === 9) return `595${digits}`;
  return digits;
}

function isWithin30Days(isoDate?: string | null, referenceNowMs = Date.now()): boolean {
  if (!isoDate) return false;
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return false;
  return referenceNowMs - parsed <= LAST_PAID_TOUCH_TTL_MS && parsed <= referenceNowMs + 60_000;
}

function isPaidTouch(touch?: PaidTouchSnapshot | null): boolean {
  if (!touch) return false;
  return Boolean(
    touch.ad_id ||
      touch.adset_id ||
      touch.campaign_id ||
      touch.aa_cid ||
      touch.fbclid ||
      touch.fbc ||
      touch.utm_campaign ||
      (touch.utm_source && !/^(direct|none|\(direct\))$/i.test(touch.utm_source))
  );
}

function extractWaTokenFromString(text?: string | null): string {
  const raw = String(text || '');
  const match = raw.match(/\b(AA-[A-Z0-9]{4,10})\b/i);
  return match ? match[1].toUpperCase() : '';
}

export function issueWaAttributionToken(input: {
  productSlug: string;
  visitorId?: string;
  phone?: string;
  touch?: PaidTouchSnapshot | null;
}): { token: string; stored: StoredWaToken; waHintText: string } {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  const token = `AA-${rand}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LAST_PAID_TOUCH_TTL_MS);
  const t: Record<string, any> = input.touch || {};
  const stored: StoredWaToken = {
    token,
    productSlug: input.productSlug || 'default',
    visitorId: input.visitorId,
    adId: t.ad_id || t.adId,
    adsetId: t.adset_id || t.adsetId,
    campaignId: t.campaign_id || t.campaignId,
    creativeId: t.creative_id || t.creativeId,
    hypothesisId: t.hypothesis_id || t.hypothesisId,
    angleId: t.angle_id || t.angleId,
    aaCid: t.aa_cid || t.aaCid,
    fbclid: t.fbclid,
    fbc: t.fbc,
    fbp: t.fbp,
    utmSource: t.utm_source || t.utmSource,
    utmCampaign: t.utm_campaign || t.utmCampaign,
    utmContent: t.utm_content || t.utmContent,
    phoneNormalized: normalizeParaguayPhone(input.phone),
    touchPayload: t,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  const state = readOrdersAttributionState();
  state.waTokens.unshift(stored);
  if (state.waTokens.length > 5000) state.waTokens = state.waTokens.slice(0, 5000);
  writeOrdersAttributionState(state);

  void postgrestUpsert(
    'wa_attribution_tokens',
    {
      token: stored.token,
      product_slug: stored.productSlug,
      visitor_id: stored.visitorId || null,
      ad_id: stored.adId || null,
      adset_id: stored.adsetId || null,
      campaign_id: stored.campaignId || null,
      creative_id: stored.creativeId || null,
      hypothesis_id: stored.hypothesisId || null,
      angle_id: stored.angleId || null,
      aa_cid: stored.aaCid || null,
      fbclid: stored.fbclid || null,
      fbc: stored.fbc || null,
      fbp: stored.fbp || null,
      utm_source: stored.utmSource || null,
      utm_campaign: stored.utmCampaign || null,
      utm_content: stored.utmContent || null,
      phone_normalized: stored.phoneNormalized || null,
      touch_payload: stored.touchPayload || null,
      created_at: stored.createdAt,
      expires_at: stored.expiresAt
    },
    'token'
  );

  return {
    token,
    stored,
    waHintText: `Ref: ${token}`
  };
}

export function resolveOrderAttribution(params: {
  order: Partial<Order> & { attributionSnapshot?: OrderAttributionPayload | null };
  cookieFbp?: string;
  cookieFbc?: string;
  cookieAttrTouch?: PaidTouchSnapshot | null;
  clientIp?: string;
  clientUserAgent?: string;
  nowMs?: number;
}): Omit<StoredOrderAttribution, 'id' | 'pedidoId' | 'createdAt'> {
  const nowMs = params.nowMs ?? Date.now();
  const order = params.order;
  const snap = order.attributionSnapshot || {};
  const state = readOrdersAttributionState();
  const intel = readIntelligenceState();

  const phoneNorm = normalizeParaguayPhone(order.celular);
  const explicitWaToken =
    (snap.waToken || '').toUpperCase() ||
    extractWaTokenFromString(order.referenciaCasa || order.direccion || order.detalle) ||
    extractWaTokenFromString(snap.lastPaidTouch?.wa_token);

  const fbp = snap.fbp || snap.lastPaidTouch?.fbp || params.cookieFbp || undefined;
  const fbc = snap.fbc || snap.lastPaidTouch?.fbc || params.cookieFbc || undefined;

  let channel = 'direct';
  let method = 'none';
  let confidence = 0;

  let adId: string | undefined;
  let adsetId: string | undefined;
  let campaignId: string | undefined;
  let creativeId: string | undefined;
  let hypothesisId: string | undefined;
  let angleId: string | undefined;
  let aaCid: string | undefined;
  let waToken: string | undefined = explicitWaToken || undefined;
  let utmSource: string | undefined;
  let utmMedium: string | undefined;
  let utmCampaign: string | undefined;
  let utmContent: string | undefined;
  let utmTerm: string | undefined;
  let fbclid: string | undefined = snap.fbclid || snap.lastPaidTouch?.fbclid;
  let referrer: string | undefined = snap.referrer || snap.lastPaidTouch?.referrer;
  let landingPath: string | undefined = snap.landingPath || snap.lastPaidTouch?.landingPath;

  const candidateLastPaid = snap.lastPaidTouch || params.cookieAttrTouch || null;

  // 1) Last paid touch dentro de ventana de 30 días
  if (candidateLastPaid && isPaidTouch(candidateLastPaid) && isWithin30Days(candidateLastPaid.capturedAt, nowMs)) {
    channel = 'paid_meta';
    method = 'last_paid_touch_30d';
    confidence = candidateLastPaid.ad_id || candidateLastPaid.aa_cid ? 1.0 : 0.78;
    adId = candidateLastPaid.ad_id;
    adsetId = candidateLastPaid.adset_id;
    campaignId = candidateLastPaid.campaign_id;
    creativeId = candidateLastPaid.creative_id;
    hypothesisId = candidateLastPaid.hypothesis_id;
    angleId = candidateLastPaid.angle_id;
    aaCid = candidateLastPaid.aa_cid;
    utmSource = candidateLastPaid.utm_source;
    utmMedium = candidateLastPaid.utm_medium;
    utmCampaign = candidateLastPaid.utm_campaign;
    utmContent = candidateLastPaid.utm_content;
    utmTerm = candidateLastPaid.utm_term;
    fbclid = fbclid || candidateLastPaid.fbclid;
  } else if (explicitWaToken) {
    // 2) Token AA-XXXXX capturado desde WhatsApp
    const matchedToken = state.waTokens.find(
      (t) => t.token.toUpperCase() === explicitWaToken && isWithin30Days(t.createdAt, nowMs)
    );
    if (matchedToken) {
      channel = 'paid_meta_via_wa';
      method = 'wa_token_match';
      confidence = matchedToken.adId || matchedToken.aaCid ? 0.96 : 0.75;
      waToken = matchedToken.token;
      adId = matchedToken.adId;
      adsetId = matchedToken.adsetId;
      campaignId = matchedToken.campaignId;
      creativeId = matchedToken.creativeId;
      hypothesisId = matchedToken.hypothesisId;
      angleId = matchedToken.angleId;
      aaCid = matchedToken.aaCid;
      utmSource = matchedToken.utmSource;
      utmCampaign = matchedToken.utmCampaign;
      utmContent = matchedToken.utmContent;
      fbclid = fbclid || matchedToken.fbclid;
    }
  } else if (phoneNorm) {
    // 3) Stitching por teléfono normalizado dentro de 30 días (tokens WA o atribuciones previas)
    const phoneToken = state.waTokens.find(
      (t) => t.phoneNormalized === phoneNorm && isWithin30Days(t.createdAt, nowMs)
    );
    const phoneAttr = !phoneToken
      ? state.attributions.find(
          (a) =>
            a.phoneNormalized === phoneNorm &&
            a.attributionChannel !== 'direct' &&
            isWithin30Days(a.confirmedFormAt, nowMs)
        )
      : undefined;

    if (phoneToken) {
      channel = 'paid_meta_phone_stitch';
      method = 'phone_stitch_30d';
      confidence = 0.85;
      waToken = phoneToken.token;
      adId = phoneToken.adId;
      adsetId = phoneToken.adsetId;
      campaignId = phoneToken.campaignId;
      creativeId = phoneToken.creativeId;
      hypothesisId = phoneToken.hypothesisId;
      angleId = phoneToken.angleId;
      aaCid = phoneToken.aaCid;
      utmSource = phoneToken.utmSource;
      utmCampaign = phoneToken.utmCampaign;
      utmContent = phoneToken.utmContent;
      fbclid = fbclid || phoneToken.fbclid;
    } else if (phoneAttr) {
      channel = 'paid_meta_phone_stitch';
      method = 'phone_stitch_30d';
      confidence = 0.82;
      adId = phoneAttr.adId;
      adsetId = phoneAttr.adsetId;
      campaignId = phoneAttr.campaignId;
      creativeId = phoneAttr.creativeId;
      hypothesisId = phoneAttr.hypothesisId;
      angleId = phoneAttr.angleId;
      aaCid = phoneAttr.aaCid;
      utmSource = phoneAttr.utmSource;
      utmCampaign = phoneAttr.utmCampaign;
      utmContent = phoneAttr.utmContent;
    }
  }

  // 4) Fallback a firstTouch pagado si aún está dentro de 30 días
  if (channel === 'direct' && snap.firstTouch && isPaidTouch(snap.firstTouch) && isWithin30Days(snap.firstTouch.capturedAt, nowMs)) {
    channel = 'paid_meta';
    method = 'first_paid_touch_30d';
    confidence = 0.72;
    adId = snap.firstTouch.ad_id;
    adsetId = snap.firstTouch.adset_id;
    campaignId = snap.firstTouch.campaign_id;
    creativeId = snap.firstTouch.creative_id;
    hypothesisId = snap.firstTouch.hypothesis_id;
    angleId = snap.firstTouch.angle_id;
    aaCid = snap.firstTouch.aa_cid;
    utmSource = snap.firstTouch.utm_source;
    utmMedium = snap.firstTouch.utm_medium;
    utmCampaign = snap.firstTouch.utm_campaign;
    utmContent = snap.firstTouch.utm_content;
    fbclid = fbclid || snap.firstTouch.fbclid;
  }

  // 5) Enriquecimiento determinístico desde `ad_entities` usando `aa_cid` o `ad_id`
  if (aaCid || adId) {
    const matchedEntity = intel.adEntities.find(
      (e) => (aaCid && e.aaCid === aaCid) || (adId && e.adId === adId)
    );
    if (matchedEntity) {
      adId = adId || matchedEntity.adId;
      adsetId = adsetId || matchedEntity.adsetId;
      campaignId = campaignId || matchedEntity.campaignId;
      creativeId = creativeId || matchedEntity.creativeId;
      hypothesisId = hypothesisId || matchedEntity.hypothesisId;
      angleId = angleId || matchedEntity.angleId;
      aaCid = aaCid || matchedEntity.aaCid;
      if (channel === 'direct') {
        channel = 'paid_meta';
        method = 'aa_cid_registry';
        confidence = 0.92;
      }
    }
  }

  return {
    reservaId: String(order.reservaid || ''),
    clientRequestKey: order.clientRequestKey,
    visitorId: order.visitorId || snap.visitorId,
    productSlug: String(order.productoId || order.producto || 'default'),
    attributionChannel: channel,
    attributionMethod: method,
    attributionConfidence: confidence,
    adId,
    adsetId,
    campaignId,
    creativeId,
    hypothesisId,
    angleId,
    aaCid,
    waToken,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    fbclid,
    fbc,
    fbp,
    referrer,
    landingPath,
    deviceType: order.dispositivo,
    phoneNormalized: phoneNorm || undefined,
    clientIp: params.clientIp,
    clientUserAgent: params.clientUserAgent,
    firstTouchJson: (snap.firstTouch as any) || null,
    lastPaidTouchJson: (candidateLastPaid as any) || null,
    rawSnapshotJson: (snap as any) || null,
    confirmedFormAt: order.confirmedFormAt || order.fecha || new Date(nowMs).toISOString()
  };
}

export function deriveLegacyEstadoFromAxes(
  deliveryStatus: DeliveryStatus,
  customerPaymentStatus: CustomerPaymentStatus
): OrderStatus {
  if (deliveryStatus === 'cancelado' || deliveryStatus === 'devuelto') return 'cancelado';
  if (deliveryStatus === 'entregado_fisicamente' && customerPaymentStatus === 'cobrado_verificado') {
    return 'entregado_pagado';
  }
  if (deliveryStatus === 'en_transito' || deliveryStatus === 'reprogramado' || deliveryStatus === 'entregado_fisicamente') {
    return 'en_camino';
  }
  return 'reservado';
}

export function deriveDefaultAxesFromLegacyEstado(estado?: OrderStatus): {
  deliveryStatus: DeliveryStatus;
  customerPaymentStatus: CustomerPaymentStatus;
  courierSettlementStatus: CourierSettlementStatus;
} {
  if (estado === 'entregado_pagado') {
    return {
      deliveryStatus: 'entregado_fisicamente',
      customerPaymentStatus: 'cobrado_verificado',
      courierSettlementStatus: 'pendiente_liquidacion'
    };
  }
  if (estado === 'en_camino') {
    return {
      deliveryStatus: 'en_transito',
      customerPaymentStatus: 'pendiente_cobro',
      courierSettlementStatus: 'no_aplica'
    };
  }
  if (estado === 'cancelado') {
    return {
      deliveryStatus: 'cancelado',
      customerPaymentStatus: 'fallido_o_rechazado',
      courierSettlementStatus: 'no_aplica'
    };
  }
  return {
    deliveryStatus: 'pendiente_envio',
    customerPaymentStatus: 'pendiente_cobro',
    courierSettlementStatus: 'no_aplica'
  };
}

export interface JointPersistResult {
  order: Order;
  attribution: StoredOrderAttribution;
  created: boolean;
  idempotentReplay: boolean;
  cloudSynced: boolean;
  queuedForRetry: boolean;
}

export async function createOrIdempotentPedidoWithAttribution(params: {
  orderInput: Order;
  cookieFbp?: string;
  cookieFbc?: string;
  cookieAttrTouch?: PaidTouchSnapshot | null;
  clientIp?: string;
  clientUserAgent?: string;
  cloudSyncFn?: (order: Order, attribution: StoredOrderAttribution) => Promise<boolean>;
}): Promise<JointPersistResult> {
  const reqKey = params.orderInput.clientRequestKey?.trim();
  const reservaId = String(params.orderInput.reservaid || '').trim();

  if (!reservaId) {
    throw new Error('reservaid requerido para persistir pedido y atribución.');
  }

  let state = readOrdersAttributionState();

  const findExistingOrder = (oaState: ReturnType<typeof readOrdersAttributionState>) =>
    oaState.orders.find(
      (o) =>
        (reqKey && o.clientRequestKey && o.clientRequestKey === reqKey) ||
        o.reservaid === reservaId
    );

  // Idempotencia estricta: verificar clientRequestKey OR reservaid (hidratando desde Supabase si hay miss local)
  let existingOrder = findExistingOrder(state);
  if (!existingOrder && getSupabaseCreds()) {
    await hydrateAutoadsFromSupabase({ forceRefresh: true }).catch(() => {});
    state = readOrdersAttributionState();
    existingOrder = findExistingOrder(state);
  }

  if (existingOrder) {
    const existingAttr =
      state.attributions.find((a) => a.reservaId === existingOrder.reservaid) ||
      (() => {
        const fallbackAttr = resolveOrderAttribution({
          order: existingOrder,
          cookieFbp: params.cookieFbp,
          cookieFbc: params.cookieFbc,
          cookieAttrTouch: params.cookieAttrTouch,
          clientIp: params.clientIp,
          clientUserAgent: params.clientUserAgent
        });
        const built: StoredOrderAttribution = {
          id: `attr_${existingOrder.reservaid}`,
          pedidoId: existingOrder.id ?? null,
          createdAt: existingOrder.confirmedFormAt || existingOrder.fecha || new Date().toISOString(),
          ...fallbackAttr
        };
        state.attributions.unshift(built);
        writeOrdersAttributionState(state);
        return built;
      })();

    return {
      order: existingOrder,
      attribution: existingAttr,
      created: false,
      idempotentReplay: true,
      cloudSynced: true,
      queuedForRetry: false
    };
  }

  const nowIso = new Date().toISOString();
  const initialAxes = deriveDefaultAxesFromLegacyEstado(params.orderInput.estado || 'reservado');
  const resolvedAttrFields = resolveOrderAttribution({
    order: params.orderInput,
    cookieFbp: params.cookieFbp,
    cookieFbc: params.cookieFbc,
    cookieAttrTouch: params.cookieAttrTouch,
    clientIp: params.clientIp,
    clientUserAgent: params.clientUserAgent
  });

  const canonicalLeadEventId = buildCanonicalEventId(reservaId, 'Lead');

  const persistedOrder: Order = {
    ...params.orderInput,
    reservaid: reservaId,
    clientRequestKey: reqKey || `req_${reservaId}`,
    visitorId: resolvedAttrFields.visitorId || params.orderInput.visitorId,
    confirmedFormAt: resolvedAttrFields.confirmedFormAt || nowIso,
    canonicalConversionEvent: 'Lead',
    canonicalLeadEventId,
    attributedAdId: resolvedAttrFields.adId,
    attributedCampaignId: resolvedAttrFields.campaignId,
    attributedAdsetId: resolvedAttrFields.adsetId,
    attributedCreativeId: resolvedAttrFields.creativeId,
    attributedHypothesisId: resolvedAttrFields.hypothesisId,
    attributedAngleId: resolvedAttrFields.angleId,
    attributionSourceKind: resolvedAttrFields.attributionMethod,
    deliveryStatus: params.orderInput.deliveryStatus || initialAxes.deliveryStatus,
    customerPaymentStatus: params.orderInput.customerPaymentStatus || initialAxes.customerPaymentStatus,
    courierSettlementStatus: params.orderInput.courierSettlementStatus || initialAxes.courierSettlementStatus,
    purchaseCapiStatus: params.orderInput.purchaseCapiStatus || 'no_elegible'
  };

  const persistedAttr: StoredOrderAttribution = {
    id: `attr_${reservaId}`,
    pedidoId: persistedOrder.id ?? null,
    createdAt: nowIso,
    ...resolvedAttrFields,
    reservaId
  };

  // Escritura conjunta en almacenamiento duradero en disco antes de responder
  state.orders.unshift(persistedOrder);
  state.attributions.unshift(persistedAttr);
  writeOrdersAttributionState(state);

  // Sincronización conjunta en la nube con cola idempotente de respaldo
  let cloudSynced = false;
  let cloudError = '';
  try {
    const hasSupabase = Boolean(getSupabaseCreds());
    if (hasSupabase) {
      const pedRes = await postgrestUpsert('pedidos', buildPedidoSupabaseRow(persistedOrder), 'reservaid', {
        returning: true
      });
      if (pedRes.ok && Array.isArray(pedRes.rows) && pedRes.rows[0]?.id != null) {
        persistedOrder.id = pedRes.rows[0].id;
        persistedAttr.pedidoId = pedRes.rows[0].id;
        state.orders[0] = persistedOrder;
        state.attributions[0] = persistedAttr;
        writeOrdersAttributionState(state);
      }
      const attrRes = await postgrestUpsert(
        'order_attribution',
        buildAttributionSupabaseRow(persistedAttr),
        'reservaid'
      );
      const extraOk = params.cloudSyncFn
        ? await params.cloudSyncFn(persistedOrder, persistedAttr).catch(() => false)
        : true;
      cloudSynced = pedRes.ok && attrRes.ok && extraOk;
      if (!cloudSynced) {
        cloudError = pedRes.error || attrRes.error || 'cloud_sync_failed';
      }
    } else if (params.cloudSyncFn) {
      cloudSynced = await params.cloudSyncFn(persistedOrder, persistedAttr);
    } else {
      cloudSynced = false;
      cloudError = 'supabase_not_configured';
    }
  } catch (err: any) {
    cloudSynced = false;
    cloudError = String(err?.message || err);
  }

  let queuedForRetry = false;
  if (!cloudSynced) {
    const latestState = readOrdersAttributionState();
    const dedupKey = `joint_${reservaId}`;
    const alreadyQueued = latestState.cloudSyncQueue.some((q) => q.dedupKey === dedupKey && q.status === 'pending');
    if (!alreadyQueued) {
      const queueItem: CloudSyncQueueItem = {
        id: `sync_${crypto.randomBytes(6).toString('hex')}`,
        kind: 'pedido_and_attribution',
        dedupKey,
        payload: {
          order: persistedOrder,
          attribution: persistedAttr
        },
        attempts: 1,
        maxAttempts: 6,
        status: 'pending',
        lastError: cloudError || 'transient_cloud_failure',
        nextRetryAt: new Date(Date.now() + 15_000).toISOString(),
        createdAt: nowIso,
        updatedAt: nowIso
      };
      latestState.cloudSyncQueue.push(queueItem);
      writeOrdersAttributionState(latestState);
    }
    queuedForRetry = true;
  }

  return {
    order: persistedOrder,
    attribution: persistedAttr,
    created: true,
    idempotentReplay: false,
    cloudSynced,
    queuedForRetry
  };
}

export async function retryPendingCloudSyncQueue(
  cloudSyncFn?: (order: Order, attribution: StoredOrderAttribution) => Promise<boolean>
): Promise<{ processed: number; succeeded: number; remainingPending: number }> {
  const state = readOrdersAttributionState();
  let processed = 0;
  let succeeded = 0;
  const now = Date.now();

  for (const item of state.cloudSyncQueue) {
    if (item.status !== 'pending') continue;
    processed++;
    let ok = false;
    try {
      if (item.kind === 'pedido_and_attribution') {
        const order = item.payload.order as Order;
        const attribution = item.payload.attribution as StoredOrderAttribution;
        if (getSupabaseCreds()) {
          const [pedRes, attrRes] = await Promise.all([
            postgrestUpsert('pedidos', buildPedidoSupabaseRow(order), 'reservaid'),
            postgrestUpsert('order_attribution', buildAttributionSupabaseRow(attribution), 'reservaid')
          ]);
          const extraOk = cloudSyncFn ? await cloudSyncFn(order, attribution).catch(() => false) : true;
          ok = pedRes.ok && attrRes.ok && extraOk;
        } else if (cloudSyncFn) {
          ok = await cloudSyncFn(order, attribution);
        }
      } else if (item.kind === 'order_axis_update') {
        const order = item.payload.order as Order;
        const pedRes = await postgrestUpsert('pedidos', buildPedidoSupabaseRow(order), 'reservaid');
        ok = pedRes.ok;
      }
    } catch (err: any) {
      item.lastError = String(err?.message || err);
    }

    item.attempts += 1;
    item.updatedAt = new Date(now).toISOString();
    if (ok) {
      item.status = 'synced';
      succeeded++;
    } else if (item.attempts >= item.maxAttempts) {
      item.status = 'dead_letter';
    } else {
      item.nextRetryAt = new Date(now + Math.min(300_000, item.attempts * 20_000)).toISOString();
    }
  }

  writeOrdersAttributionState(state);
  const remainingPending = state.cloudSyncQueue.filter((q) => q.status === 'pending').length;
  return { processed, succeeded, remainingPending };
}

export function applyOrderAxisUpdate(params: {
  reservaIdOrOrderId: string;
  estado?: OrderStatus;
  deliveryStatus?: DeliveryStatus;
  customerPaymentStatus?: CustomerPaymentStatus;
  courierSettlementStatus?: CourierSettlementStatus;
  netCashCollectedPyg?: number;
  courierFeePyg?: number;
  courierSettlementId?: string;
  productUnitCostPyg?: number;
  packagingCostPyg?: number;
  returnCostPyg?: number;
}): {
  found: boolean;
  order?: Order;
  isRealSale: boolean;
} {
  const state = readOrdersAttributionState();
  const key = String(params.reservaIdOrOrderId || '').trim();
  const idx = state.orders.findIndex((o) => o.reservaid === key || String(o.id || '') === key);
  if (idx < 0) return { found: false, isRealSale: false };

  const current = state.orders[idx];
  const currentAxes = deriveDefaultAxesFromLegacyEstado(current.estado);
  let nextDelivery: DeliveryStatus = params.deliveryStatus || current.deliveryStatus || currentAxes.deliveryStatus;
  let nextPayment: CustomerPaymentStatus =
    params.customerPaymentStatus || current.customerPaymentStatus || currentAxes.customerPaymentStatus;
  let nextSettlement: CourierSettlementStatus =
    params.courierSettlementStatus || current.courierSettlementStatus || currentAxes.courierSettlementStatus;

  // Si se recibió transición legacy de RepartoView/AdminView sin ejes explícitos, reflejarla en los 3 ejes
  if (params.estado && !params.deliveryStatus && !params.customerPaymentStatus) {
    const mapped = deriveDefaultAxesFromLegacyEstado(params.estado);
    nextDelivery = mapped.deliveryStatus;
    nextPayment = mapped.customerPaymentStatus;
    if (nextDelivery === 'entregado_fisicamente' && nextPayment === 'cobrado_verificado' && nextSettlement === 'no_aplica') {
      nextSettlement = 'pendiente_liquidacion';
    }
  }

  const nextLegacyEstado = deriveLegacyEstadoFromAxes(nextDelivery, nextPayment);
  const nowIso = new Date().toISOString();

  // PROHIBIDO tocar attributionSnapshot o campos attributed* en actualizaciones del Circuito B
  const updated: Order = {
    ...current,
    estado: nextLegacyEstado,
    deliveryStatus: nextDelivery,
    customerPaymentStatus: nextPayment,
    courierSettlementStatus: nextSettlement,
    deliveredAt:
      nextDelivery === 'entregado_fisicamente'
        ? current.deliveredAt || nowIso
        : current.deliveredAt,
    collectedAt:
      nextPayment === 'cobrado_verificado'
        ? current.collectedAt || nowIso
        : current.collectedAt,
    settledAt:
      nextSettlement === 'liquidado_en_lote'
        ? current.settledAt || nowIso
        : current.settledAt,
    netCashCollectedPyg:
      params.netCashCollectedPyg !== undefined ? params.netCashCollectedPyg : current.netCashCollectedPyg,
    courierFeePyg:
      params.courierFeePyg !== undefined ? params.courierFeePyg : current.courierFeePyg,
    courierSettlementId:
      params.courierSettlementId !== undefined ? params.courierSettlementId : current.courierSettlementId,
    productUnitCostPyg:
      params.productUnitCostPyg !== undefined ? params.productUnitCostPyg : current.productUnitCostPyg,
    packagingCostPyg:
      params.packagingCostPyg !== undefined ? params.packagingCostPyg : current.packagingCostPyg,
    returnCostPyg:
      params.returnCostPyg !== undefined ? params.returnCostPyg : current.returnCostPyg,
    actualizado_en: nowIso
  };

  state.orders[idx] = updated;
  writeOrdersAttributionState(state);

  void postgrestUpsert('pedidos', buildPedidoSupabaseRow(updated), 'reservaid');

  const isRealSale =
    updated.deliveryStatus === 'entregado_fisicamente' &&
    updated.customerPaymentStatus === 'cobrado_verificado';

  return {
    found: true,
    order: updated,
    isRealSale
  };
}

export function buildPedidoSupabaseRow(order: Order): Record<string, any> {
  return {
    reservaid: order.reservaid,
    producto_id: order.productoId || 'prod-noelux-01',
    producto: order.producto || order.productoId || 'producto',
    wa_vendedor: order.waVendedor || null,
    nombre: order.nombre || 'Cliente',
    celular: order.celular || '',
    departamento: order.departamento || '',
    ciudad: order.ciudad || '',
    direccion: order.direccion || '',
    detalle: order.detalle || 'Efectivo al recibir',
    cantidad: Number(order.cantidad) || 1,
    monto: Number(order.monto) || 0,
    ref_code: order.ref_code || null,
    estado: order.estado || 'reservado',
    tipo_vivienda: order.tipoVivienda || 'casa',
    gps_lat: typeof order.gpsLat === 'number' ? order.gpsLat : null,
    gps_lng: typeof order.gpsLng === 'number' ? order.gpsLng : null,
    gps_link: order.gpsLink || null,
    gps_confirmado: Boolean(order.gpsConfirmado),
    referencia_casa: order.referenciaCasa || null,
    modo_ia: order.modoIA || 'automatico',
    conv_step: Number(order.convStep) || 1,
    atendido_por_ia: order.atendidoPorIA !== false,
    datos_confirmados: Boolean(order.datosConfirmados),
    agente_completado: Boolean(order.agenteCompletado),
    empaquetado: Boolean(order.empaquetado),
    archivado: Boolean(order.archivado),
    fecha_archivado: order.fechaArchivado || null,
    dispositivo: order,
    fecha: order.fecha || order.confirmedFormAt || new Date().toISOString(),
    actualizado_en: order.actualizado_en || new Date().toISOString(),
    visitor_id: order.visitorId || null,
    client_request_key: order.clientRequestKey || null,
    confirmed_form_at: order.confirmedFormAt || order.fecha || null,
    canonical_conversion_event: order.canonicalConversionEvent || 'Lead',
    canonical_lead_event_id: order.canonicalLeadEventId || buildCanonicalEventId(order.reservaid, 'Lead'),
    attributed_ad_id: order.attributedAdId || null,
    attributed_campaign_id: order.attributedCampaignId || null,
    attributed_adset_id: order.attributedAdsetId || null,
    attributed_creative_id: order.attributedCreativeId || null,
    attributed_hypothesis_id: order.attributedHypothesisId || null,
    attributed_angle_id: order.attributedAngleId || null,
    attribution_source_kind: order.attributionSourceKind || null,
    delivery_status: order.deliveryStatus || 'pendiente_envio',
    customer_payment_status: order.customerPaymentStatus || 'pendiente_cobro',
    courier_settlement_status: order.courierSettlementStatus || 'no_aplica',
    delivered_at: order.deliveredAt || null,
    collected_at: order.collectedAt || null,
    settled_at: order.settledAt || null,
    net_cash_collected_pyg: order.netCashCollectedPyg ?? null,
    courier_fee_pyg: order.courierFeePyg ?? null,
    courier_settlement_id: order.courierSettlementId || null,
    product_unit_cost_pyg: order.productUnitCostPyg ?? null,
    packaging_cost_pyg: order.packagingCostPyg ?? null,
    return_cost_pyg: order.returnCostPyg ?? null,
    purchase_capi_status: order.purchaseCapiStatus || 'no_elegible'
  };
}

export function buildAttributionSupabaseRow(attr: StoredOrderAttribution): Record<string, any> {
  return {
    pedido_id: attr.pedidoId ?? null,
    reservaid: attr.reservaId,
    client_request_key: attr.clientRequestKey || null,
    visitor_id: attr.visitorId || null,
    product_slug: attr.productSlug,
    attribution_channel: attr.attributionChannel,
    attribution_method: attr.attributionMethod,
    attribution_confidence: attr.attributionConfidence,
    ad_id: attr.adId || null,
    adset_id: attr.adsetId || null,
    campaign_id: attr.campaignId || null,
    creative_id: attr.creativeId || null,
    hypothesis_id: attr.hypothesisId || null,
    angle_id: attr.angleId || null,
    aa_cid: attr.aaCid || null,
    wa_token: attr.waToken || null,
    utm_source: attr.utmSource || null,
    utm_medium: attr.utmMedium || null,
    utm_campaign: attr.utmCampaign || null,
    utm_content: attr.utmContent || null,
    utm_term: attr.utmTerm || null,
    fbclid: attr.fbclid || null,
    fbc: attr.fbc || null,
    fbp: attr.fbp || null,
    referrer: attr.referrer || null,
    landing_path: attr.landingPath || null,
    device_type: attr.deviceType || null,
    phone_normalized: attr.phoneNormalized || null,
    client_ip: attr.clientIp || null,
    client_user_agent: attr.clientUserAgent || null,
    first_touch_json: attr.firstTouchJson || null,
    last_paid_touch_json: attr.lastPaidTouchJson || null,
    raw_snapshot_json: attr.rawSnapshotJson || null,
    confirmed_form_at: attr.confirmedFormAt
  };
}
