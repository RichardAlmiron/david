import crypto from 'node:crypto';
import type { Order } from '../src/types.ts';
import {
  getFeatureFlags,
  postgrestUpsert,
  readCapiDispatchState,
  readOrdersAttributionState,
  writeCapiDispatchState,
  writeOrdersAttributionState,
  type MetaCapiDispatchEntry,
  type StoredOrderAttribution
} from './autoadsStore.ts';
import { buildCanonicalEventId, buildPedidoSupabaseRow, normalizeParaguayPhone } from './attributionAndOrders.ts';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function sha256Normalized(value?: string | null): string | undefined {
  const clean = String(value || '')
    .trim()
    .toLowerCase();
  if (!clean) return undefined;
  return crypto.createHash('sha256').update(clean).digest('hex');
}

function splitNameParts(fullName?: string): { fn?: string; ln?: string } {
  const parts = String(fullName || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return {};
  return {
    fn: sha256Normalized(parts[0]),
    ln: parts.length > 1 ? sha256Normalized(parts.slice(1).join(' ')) : undefined
  };
}

function buildMetaUserData(
  order: Partial<Order>,
  attr?: Partial<StoredOrderAttribution> | null
): Record<string, any> {
  const { fn, ln } = splitNameParts(order.nombre);
  const phoneNorm = normalizeParaguayPhone(order.celular);
  const userData: Record<string, any> = {
    country: [sha256Normalized('py')]
  };
  if (phoneNorm) userData.ph = [sha256Normalized(phoneNorm)];
  if (fn) userData.fn = [fn];
  if (ln) userData.ln = [ln];
  if (order.ciudad) userData.ct = [sha256Normalized(order.ciudad)];
  if (order.departamento) userData.st = [sha256Normalized(order.departamento)];
  const extId = attr?.visitorId || order.visitorId;
  if (extId) userData.external_id = [sha256Normalized(extId)];
  if (attr?.fbp || order.attributionSnapshot?.fbp) userData.fbp = attr?.fbp || order.attributionSnapshot?.fbp;
  if (attr?.fbc || order.attributionSnapshot?.fbc) userData.fbc = attr?.fbc || order.attributionSnapshot?.fbc;
  if (attr?.clientIp) userData.client_ip_address = attr.clientIp;
  if (attr?.clientUserAgent) userData.client_user_agent = attr.clientUserAgent;
  return userData;
}

async function sendToMetaGraphCapi(params: {
  pixelId: string;
  accessToken: string;
  payload: Record<string, any>;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; responseJson: any; error?: string }> {
  const fetchFn = params.fetchImpl || fetch;
  try {
    const resp = await fetchFn(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(params.pixelId)}/events?access_token=${encodeURIComponent(params.accessToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params.payload)
      }
    );
    const json: any = await resp.json().catch(() => ({}));
    if (!resp.ok || json?.error) {
      return {
        ok: false,
        responseJson: json,
        error: json?.error?.message || `HTTP ${resp.status} en Meta CAPI`
      };
    }
    return { ok: true, responseJson: json };
  } catch (err: any) {
    return { ok: false, responseJson: null, error: String(err?.message || err) };
  }
}

function persistCapiLogEntry(entry: MetaCapiDispatchEntry): void {
  const state = readCapiDispatchState();
  const idx = state.entries.findIndex(
    (e) => e.eventId === entry.eventId && e.eventName === entry.eventName
  );
  if (idx >= 0) {
    state.entries[idx] = entry;
  } else {
    state.entries.unshift(entry);
  }
  if (state.entries.length > 2000) state.entries = state.entries.slice(0, 2000);
  writeCapiDispatchState(state);

  void postgrestUpsert(
    'meta_capi_dispatch_log',
    {
      event_id: entry.eventId,
      event_name: entry.eventName,
      pedido_id: entry.pedidoId ?? null,
      reservaid: entry.reservaId || null,
      pixel_id: entry.pixelId,
      circuit: entry.circuit,
      status: entry.status,
      attempts: entry.attempts,
      max_attempts: entry.maxAttempts,
      event_time_unix: entry.eventTimeUnix,
      payload_json: entry.payloadJson,
      response_json: entry.responseJson || null,
      last_error: entry.lastError || null,
      next_retry_at: entry.nextRetryAt || null,
      sent_at: entry.sentAt || null,
      created_at: entry.createdAt
    },
    'event_id,event_name'
  );
}

export async function dispatchCanonicalConversionCapi(params: {
  order: Order;
  attribution?: StoredOrderAttribution | null;
  pixelId?: string;
  capiAccessToken?: string;
  testEventCode?: string;
  emitOrderReservedCod?: boolean;
  sourceUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ leadEntry: MetaCapiDispatchEntry | null; codEntry: MetaCapiDispatchEntry | null }> {
  const pixelId = String(params.pixelId || '').trim();
  const token = String(params.capiAccessToken || '').trim();
  if (!pixelId || !token) {
    return { leadEntry: null, codEntry: null };
  }

  const flags = getFeatureFlags();
  const state = readCapiDispatchState();
  const nowIso = new Date().toISOString();
  const eventTimeUnix = Math.floor(
    (params.order.confirmedFormAt ? Date.parse(params.order.confirmedFormAt) : Date.now()) / 1000
  );

  const buildAndSend = async (
    eventName: 'Lead' | 'OrderReservedCOD'
  ): Promise<MetaCapiDispatchEntry> => {
    const eventId =
      eventName === 'Lead'
        ? params.order.canonicalLeadEventId || buildCanonicalEventId(params.order.reservaid, 'Lead')
        : buildCanonicalEventId(params.order.reservaid, 'OrderReservedCOD');

    const already = state.entries.find(
      (e) => e.eventId === eventId && e.eventName === eventName && e.status === 'sent'
    );
    if (already) return already;

    const prodSlug = params.order.productoId || params.order.producto || 'producto';
    const payload: Record<string, any> = {
      data: [
        {
          event_name: eventName,
          event_time: eventTimeUnix,
          event_id: eventId,
          action_source: 'website',
          event_source_url: params.sourceUrl || 'https://tienda.local/pedido',
          user_data: buildMetaUserData(params.order, params.attribution),
          custom_data: {
            content_ids: [prodSlug],
            content_name: params.order.producto || prodSlug,
            content_type: 'product',
            num_items: Number(params.order.cantidad || 1),
            value: Number(params.order.monto || 0),
            currency: 'PYG',
            order_id: params.order.reservaid,
            lead_type: eventName === 'Lead' ? 'confirmed_order_form' : 'cod_telemetry_secondary'
          }
        }
      ],
      ...(params.testEventCode ? { test_event_code: params.testEventCode } : {})
    };

    const res = await sendToMetaGraphCapi({
      pixelId,
      accessToken: token,
      payload,
      fetchImpl: params.fetchImpl
    });

    const entry: MetaCapiDispatchEntry = {
      id: `capi_${eventId}`,
      eventId,
      eventName,
      pedidoId: params.order.id ?? null,
      reservaId: params.order.reservaid,
      pixelId,
      circuit: 'circuit_a_conversion',
      status: res.ok ? 'sent' : 'failed_retrying',
      attempts: 1,
      maxAttempts: 5,
      eventTimeUnix,
      payloadJson: payload,
      responseJson: res.responseJson,
      lastError: res.error,
      nextRetryAt: res.ok ? null : new Date(Date.now() + 20_000).toISOString(),
      sentAt: res.ok ? nowIso : null,
      createdAt: nowIso
    };
    persistCapiLogEntry(entry);
    return entry;
  };

  // Evento canónico obligatorio: Lead (siempre tras persistencia confirmada)
  const leadEntry = await buildAndSend('Lead');

  // Evento secundario opcional COD (NUNCA Purchase en checkout COD sin entrega ni cobro)
  const shouldEmitCod = Boolean(params.emitOrderReservedCod && flags.AUTOADS_EMIT_COD_CUSTOM_EVENT);
  const codEntry = shouldEmitCod ? await buildAndSend('OrderReservedCOD') : null;

  return { leadEntry, codEntry };
}

export async function dispatchIndependentPurchaseCapiIfEligible(params: {
  order: Order;
  attribution?: StoredOrderAttribution | null;
  pixelId?: string;
  capiAccessToken?: string;
  testEventCode?: string;
  sourceUrl?: string;
  nowMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<{
  eligible: boolean;
  status:
    | 'not_eligible_not_delivered_or_paid'
    | 'disabled_by_flag'
    | 'skipped_window_expired_erp_only'
    | 'missing_credentials'
    | 'already_sent'
    | 'sent'
    | 'failed_retrying';
  entry?: MetaCapiDispatchEntry;
}> {
  const flags = getFeatureFlags();
  if (!flags.AUTOADS_PURCHASE_CAPI_INDEPENDENT_ENABLED) {
    return { eligible: false, status: 'disabled_by_flag' };
  }

  const { order } = params;
  const isRealSale =
    order.deliveryStatus === 'entregado_fisicamente' &&
    order.customerPaymentStatus === 'cobrado_verificado';

  if (!isRealSale) {
    return { eligible: false, status: 'not_eligible_not_delivered_or_paid' };
  }

  const eventId = buildCanonicalEventId(order.reservaid, 'Purchase');
  const existingState = readCapiDispatchState();
  const already = existingState.entries.find(
    (e) => e.eventId === eventId && e.eventName === 'Purchase' && e.status === 'sent'
  );
  if (already) {
    return { eligible: true, status: 'already_sent', entry: already };
  }

  const nowMs = params.nowMs ?? Date.now();
  const originStr = order.confirmedFormAt || order.fecha || params.attribution?.confirmedFormAt;
  const originMs = originStr ? Date.parse(originStr) : nowMs;
  const elapsedMs = nowMs - originMs;

  // Regla estricta: JAMÁS usar physical_store ni falsear fechas si superó ventana de 7 días de Meta
  if (Number.isFinite(elapsedMs) && elapsedMs > SEVEN_DAYS_MS) {
    const nowIso = new Date(nowMs).toISOString();
    const expiredEntry: MetaCapiDispatchEntry = {
      id: `capi_${eventId}`,
      eventId,
      eventName: 'Purchase',
      pedidoId: order.id ?? null,
      reservaId: order.reservaid,
      pixelId: params.pixelId || 'erp_only',
      circuit: 'circuit_b_purchase',
      status: 'skipped_window_expired_erp_only',
      attempts: 0,
      maxAttempts: 0,
      eventTimeUnix: Math.floor(nowMs / 1000),
      payloadJson: {
        reason: 'Meta web Purchase 7-day conversion window exceeded; kept strictly in ERP without spoofing physical_store or backdating.'
      },
      lastError: `Ventana real de 7 días excedida (${Math.round(elapsedMs / 86_400_000)}d). Conservado solo en ERP.`,
      createdAt: nowIso
    };
    persistCapiLogEntry(expiredEntry);

    const oa = readOrdersAttributionState();
    const idx = oa.orders.findIndex((o) => o.reservaid === order.reservaid);
    if (idx >= 0) {
      oa.orders[idx] = { ...oa.orders[idx], purchaseCapiStatus: 'skipped_window_expired_erp_only' };
      writeOrdersAttributionState(oa);
      void postgrestUpsert('pedidos', buildPedidoSupabaseRow(oa.orders[idx]), 'reservaid');
    }

    return {
      eligible: false,
      status: 'skipped_window_expired_erp_only',
      entry: expiredEntry
    };
  }

  const pixelId = String(params.pixelId || '').trim();
  const token = String(params.capiAccessToken || '').trim();
  if (!pixelId || !token) {
    return { eligible: true, status: 'missing_credentials' };
  }

  const realEventTimeMs = order.collectedAt
    ? Date.parse(order.collectedAt)
    : order.deliveredAt
      ? Date.parse(order.deliveredAt)
      : nowMs;
  const eventTimeUnix = Math.floor((Number.isFinite(realEventTimeMs) ? realEventTimeMs : nowMs) / 1000);
  const nowIso = new Date(nowMs).toISOString();

  // action_source genuino ('website'), fecha real de cobro verificado y evento independiente Purchase
  const prodSlug = order.productoId || order.producto || 'producto';
  const payload: Record<string, any> = {
    data: [
      {
        event_name: 'Purchase',
        event_time: eventTimeUnix,
        event_id: eventId,
        action_source: 'website',
        event_source_url: params.sourceUrl || 'https://tienda.local/pedido',
        user_data: buildMetaUserData(order, params.attribution),
        custom_data: {
          content_ids: [prodSlug],
          content_name: order.producto || prodSlug,
          content_type: 'product',
          num_items: Number(order.cantidad || 1),
          value: Number(order.monto || 0),
          currency: 'PYG',
          order_id: order.reservaid,
          delivery_verified: true,
          payment_verified: true
        }
      }
    ],
    ...(params.testEventCode ? { test_event_code: params.testEventCode } : {})
  };

  const res = await sendToMetaGraphCapi({
    pixelId,
    accessToken: token,
    payload,
    fetchImpl: params.fetchImpl
  });

  const finalStatus: MetaCapiDispatchEntry['status'] = res.ok ? 'sent' : 'failed_retrying';
  const entry: MetaCapiDispatchEntry = {
    id: `capi_${eventId}`,
    eventId,
    eventName: 'Purchase',
    pedidoId: order.id ?? null,
    reservaId: order.reservaid,
    pixelId,
    circuit: 'circuit_b_purchase',
    status: finalStatus,
    attempts: 1,
    maxAttempts: 5,
    eventTimeUnix,
    payloadJson: payload,
    responseJson: res.responseJson,
    lastError: res.error,
    nextRetryAt: res.ok ? null : new Date(nowMs + 30_000).toISOString(),
    sentAt: res.ok ? nowIso : null,
    createdAt: nowIso
  };

  persistCapiLogEntry(entry);

  const oa = readOrdersAttributionState();
  const idx = oa.orders.findIndex((o) => o.reservaid === order.reservaid);
  if (idx >= 0) {
    oa.orders[idx] = { ...oa.orders[idx], purchaseCapiStatus: finalStatus };
    writeOrdersAttributionState(oa);
    void postgrestUpsert('pedidos', buildPedidoSupabaseRow(oa.orders[idx]), 'reservaid');
  }

  return {
    eligible: true,
    status: finalStatus,
    entry
  };
}

export async function retryPendingCapiDispatches(params: {
  accessTokenResolver: (pixelId: string) => string;
  fetchImpl?: typeof fetch;
}): Promise<{ processed: number; sent: number; deadLettered: number }> {
  const state = readCapiDispatchState();
  let processed = 0;
  let sent = 0;
  let deadLettered = 0;

  for (const entry of state.entries) {
    if (entry.status !== 'failed_retrying' && entry.status !== 'queued') continue;
    const token = params.accessTokenResolver(entry.pixelId);
    if (!token) continue;
    processed++;
    const res = await sendToMetaGraphCapi({
      pixelId: entry.pixelId,
      accessToken: token,
      payload: entry.payloadJson,
      fetchImpl: params.fetchImpl
    });
    entry.attempts += 1;
    if (res.ok) {
      entry.status = 'sent';
      entry.sentAt = new Date().toISOString();
      entry.responseJson = res.responseJson;
      entry.lastError = undefined;
      entry.nextRetryAt = null;
      sent++;
    } else if (entry.attempts >= entry.maxAttempts) {
      entry.status = 'dead_letter';
      entry.lastError = res.error;
      entry.nextRetryAt = null;
      deadLettered++;
    } else {
      entry.lastError = res.error;
      entry.nextRetryAt = new Date(Date.now() + entry.attempts * 30_000).toISOString();
    }
    persistCapiLogEntry(entry);
    if (entry.circuit === 'circuit_b_purchase' && entry.reservaId && (entry.status === 'sent' || entry.status === 'dead_letter')) {
      const oa = readOrdersAttributionState();
      const idx = oa.orders.findIndex((o) => o.reservaid === entry.reservaId);
      if (idx >= 0) {
        oa.orders[idx] = { ...oa.orders[idx], purchaseCapiStatus: entry.status };
        writeOrdersAttributionState(oa);
        void postgrestUpsert('pedidos', buildPedidoSupabaseRow(oa.orders[idx]), 'reservaid');
      }
    }
  }

  return { processed, sent, deadLettered };
}
