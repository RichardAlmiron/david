import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Order } from '../../src/types.ts';
import {
  clearCircuitAAccessLogForTesting,
  getCircuitAAccessLogForTesting,
  getCircuitAReadView,
  getFeatureFlags,
  mapSupabaseAdEntityRow,
  mapSupabaseCapiLogRow,
  mapSupabaseCostProfileRow,
  mapSupabaseDossierRow,
  mapSupabaseFxPeriodRow,
  mapSupabaseHypothesisRow,
  mapSupabaseInsightRow,
  mapSupabaseLearningMemoryRow,
  mapSupabaseOrderAttributionRow,
  mapSupabasePedidoRowToOrder,
  mapSupabaseSettlementRow,
  mapSupabaseWaTokenRow,
  readOrdersAttributionState,
  setAutoadsDataRootForTesting,
  setFeatureFlags,
  writeIntelligenceState
} from '../autoadsStore.ts';
import {
  applyOrderAxisUpdate,
  buildCanonicalEventId,
  buildPedidoSupabaseRow,
  createOrIdempotentPedidoWithAttribution,
  issueWaAttributionToken,
  normalizeParaguayPhone,
  resolveOrderAttribution,
  retryPendingCloudSyncQueue
} from '../attributionAndOrders.ts';
import {
  mineCompetitorsHonestly,
  runPsychologicalAndHypothesisIntelligence
} from '../autoAdsIntelligence.ts';
import {
  classifyAdStatisticalVerdict,
  extractMetaLeadActionCount,
  normalizeAccountSpend,
  recomputeCircuitALearning,
  syncMetaInsightsForAccount
} from '../metaInsightsAndAdsLearning.ts';
import {
  computeAuditedErpProfitability,
  importCourierSettlementCsv,
  saveFxRatePeriod,
  saveProductCostProfile
} from '../erpFinanceAndCourier.ts';
import {
  dispatchCanonicalConversionCapi,
  dispatchIndependentPurchaseCapiIfEligible,
  retryPendingCapiDispatches
} from '../metaCapiWorker.ts';
import {
  appendTrackingParamsToUrl,
  buildMetaAttributionUrlTags,
  normalizeDailyBudgetForMetaAccount,
  registerAdEntitySnapshot,
  runMetaPublishPreflight
} from '../metaPublishPreflight.ts';

function withIsolatedTempDataDir(t: test.TestContext): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoads-v2-test-'));
  setAutoadsDataRootForTesting(tmpDir);
  t.after(() => {
    setAutoadsDataRootForTesting(null);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  return tmpDir;
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  const reservaid = overrides.reservaid || `RES-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  return {
    reservaid,
    fecha: new Date().toISOString(),
    confirmedFormAt: new Date().toISOString(),
    productoId: 'corrector-postura-pro',
    producto: 'corrector-postura-pro',
    nombre: 'Carlos Benítez',
    celular: '0981 555 222',
    departamento: 'Central',
    ciudad: 'San Lorenzo',
    direccion: 'Avda. Mariscal Estigarribia 123',
    referenciaCasa: 'Portón verde',
    detalle: 'Pack 1 Corrector Postura Pro',
    cantidad: 1,
    monto: 165000,
    ref_code: null,
    estado: 'reservado',
    ...overrides
  };
}

test('ISO-01 & ISO-02: Conversión canónica única Lead en formulario confirmado y aislamiento de OrderReservedCOD', async (t) => {
  withIsolatedTempDataDir(t);

  const orderInput = makeOrder({
    reservaid: 'RES-ISO01-A',
    clientRequestKey: 'req-iso01-a',
    visitorId: 'vis_unique_001',
    attributionSnapshot: {
      visitorId: 'vis_unique_001',
      capturedAt: new Date().toISOString(),
      lastPaidTouch: {
        source: 'meta',
        ad_id: 'ad_001',
        adset_id: 'adset_001',
        campaign_id: 'camp_001',
        creative_id: 'cre_001',
        hypothesis_id: 'hyp_001',
        angle_id: 'ang_mecanismo_raiz',
        capturedAt: new Date().toISOString()
      }
    }
  });

  const persisted = await createOrIdempotentPedidoWithAttribution({
    orderInput,
    cloudSyncFn: async () => true
  });

  assert.equal(persisted.created, true);
  assert.equal(persisted.idempotentReplay, false);
  assert.equal(persisted.order.canonicalLeadEventId, buildCanonicalEventId('RES-ISO01-A', 'Lead'));

  const sentPayloads: any[] = [];
  const mockFetch = (async (_url: string, init?: RequestInit) => {
    if (init?.body) sentPayloads.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
  }) as typeof fetch;

  const capiRes = await dispatchCanonicalConversionCapi({
    order: persisted.order,
    attribution: persisted.attribution,
    pixelId: '1234567890',
    capiAccessToken: 'test_token_capi',
    emitOrderReservedCod: true,
    sourceUrl: 'https://mitienda.py/p/corrector-postura-pro',
    fetchImpl: mockFetch
  });

  assert.equal(sentPayloads.length, 2);
  assert.equal(capiRes.leadEntry?.status, 'sent');
  assert.equal(capiRes.leadEntry?.eventId, 'ord_RES-ISO01-A_Lead');
  assert.equal(capiRes.codEntry?.status, 'sent');
  assert.equal(capiRes.codEntry?.eventId, 'ord_RES-ISO01-A_OrderReservedCOD');
  assert.equal(sentPayloads[0].data[0].event_name, 'Lead');
  assert.equal(sentPayloads[0].data[0].action_source, 'website');
  assert.equal(sentPayloads[0].data[0].custom_data.lead_type, 'confirmed_order_form');
  assert.equal(sentPayloads[1].data[0].event_name, 'OrderReservedCOD');
  // Nunca debe disparar Purchase en el envío del formulario COD
  assert.equal(
    sentPayloads.some((p) => p.data?.[0]?.event_name === 'Purchase'),
    false
  );

  // Al desactivar bandera secundaria COD solo sale Lead
  setFeatureFlags({ AUTOADS_EMIT_COD_CUSTOM_EVENT: false });
  const order2 = await createOrIdempotentPedidoWithAttribution({
    orderInput: makeOrder({ reservaid: 'RES-ISO01-B', clientRequestKey: 'req-iso01-b' }),
    cloudSyncFn: async () => true
  });
  const payloadsAfterFlag: any[] = [];
  const capi2 = await dispatchCanonicalConversionCapi({
    order: order2.order,
    attribution: order2.attribution,
    pixelId: '1234567890',
    capiAccessToken: 'test_token_capi',
    emitOrderReservedCod: true,
    fetchImpl: (async (_u: string, init?: RequestInit) => {
      if (init?.body) payloadsAfterFlag.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
    }) as typeof fetch
  });
  assert.equal(payloadsAfterFlag.length, 1);
  assert.equal(capi2.leadEntry?.eventName, 'Lead');
  assert.equal(capi2.codEntry, null);

  // Meta Insights action_type extractor ignora OrderReservedCOD y Purchase
  const extractedLeads = extractMetaLeadActionCount([
    { action_type: 'lead', value: '4' },
    { action_type: 'offsite_conversion.custom.OrderReservedCOD', value: '4' },
    { action_type: 'purchase', value: '3' },
    { action_type: 'offsite_conversion.fb_pixel_purchase', value: '3' },
    { action_type: 'link_click', value: '95' }
  ]);
  assert.equal(extractedLeads, 4);

  // Aprendizaje interno cuenta exactamente 1 formulario por pedido aunque existan ambos eventos CAPI
  const learning = recomputeCircuitALearning({ productSlug: 'corrector-postura-pro' });
  assert.equal(learning.summary.totalConfirmedForms, 2);

  // Invariante estático: OrderForm.tsx dispara InitiateCheckout al tipear y Lead ÚNICAMENTE tras await addOrder(...) sin Purchase en checkout
  const orderFormSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/OrderForm.tsx'),
    'utf8'
  );
  assert.equal(orderFormSource.includes("trackMetaEvent('Purchase'"), false);
  assert.equal(orderFormSource.includes("eventName: 'Purchase'"), false);
  assert.match(orderFormSource, /eventName:\s*'InitiateCheckout'/);
  assert.match(orderFormSource, /await addOrder\(\{[\s\S]*eventName:\s*'Lead'/);
});

test('ISO-03: Idempotencia en pedido+atribución y cola de reintento ante fallo temporal de nube y CAPI', async (t) => {
  withIsolatedTempDataDir(t);

  const reqOrder = makeOrder({
    reservaid: 'RES-IDEMP-01',
    clientRequestKey: 'client-req-unique-999'
  });

  // 1) Fallo de nube en primera escritura -> persiste local y encola en cloudSyncQueue
  const failRes = await createOrIdempotentPedidoWithAttribution({
    orderInput: reqOrder,
    cloudSyncFn: async () => false
  });
  assert.equal(failRes.created, true);
  assert.equal(failRes.cloudSynced, false);
  assert.equal(failRes.queuedForRetry, true);

  // 2) Reenvío idéntico con mismo clientRequestKey o mismo reservaid -> NO duplica
  const replayByKey = await createOrIdempotentPedidoWithAttribution({
    orderInput: makeOrder({ reservaid: 'RES-OTRO-IGNORADO', clientRequestKey: 'client-req-unique-999' }),
    cloudSyncFn: async () => true
  });
  assert.equal(replayByKey.created, false);
  assert.equal(replayByKey.idempotentReplay, true);
  assert.equal(replayByKey.order.reservaid, 'RES-IDEMP-01');

  const stateAfterReplay = readOrdersAttributionState();
  assert.equal(stateAfterReplay.orders.length, 1);
  assert.equal(stateAfterReplay.attributions.length, 1);
  assert.equal(stateAfterReplay.cloudSyncQueue.filter((q) => q.status === 'pending').length, 1);

  // 3) Recuperación de cola cuando Supabase responde OK
  const retryCloud = await retryPendingCloudSyncQueue(async () => true);
  assert.equal(retryCloud.processed, 1);
  assert.equal(retryCloud.succeeded, 1);
  assert.equal(retryCloud.remainingPending, 0);

  // 4) Reintento de Meta CAPI cuando Graph falla inicialmente y luego se recupera
  let capiAttempts = 0;
  await dispatchCanonicalConversionCapi({
    order: failRes.order,
    attribution: failRes.attribution,
    pixelId: '999888777',
    capiAccessToken: 'tok_retry',
    fetchImpl: (async () => {
      capiAttempts++;
      return new Response(JSON.stringify({ error: { message: 'Temporary 503' } }), { status: 503 });
    }) as typeof fetch
  });
  assert.equal(capiAttempts, 1);

  const capiRetry = await retryPendingCapiDispatches({
    accessTokenResolver: () => 'tok_retry',
    fetchImpl: (async () => {
      capiAttempts++;
      return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
    }) as typeof fetch
  });
  assert.equal(capiRetry.processed, 1);
  assert.equal(capiRetry.sent, 1);
  assert.equal(capiAttempts, 2);
});

test('ISO-04: Atribución multicanal (last_paid_touch 30d, token WA AA-XXXXX, phone stitch 30d, aa_cid, direct) y teléfonos PY', (t) => {
  withIsolatedTempDataDir(t);

  assert.equal(normalizeParaguayPhone('0981 123-456'), '595981123456');
  assert.equal(normalizeParaguayPhone('+595 981 123456'), '595981123456');
  assert.equal(normalizeParaguayPhone('981123456'), '595981123456');

  const now = Date.now();
  const daysAgoIso = (d: number) => new Date(now - d * 86_400_000).toISOString();

  // 1) last_paid_touch dentro de 30 días prevalece aunque visita actual sea directa
  const lastTouchAttr = resolveOrderAttribution({
    order: makeOrder({
      reservaid: 'RES-ATTR-1',
      attributionSnapshot: {
        visitorId: 'vis_1',
        capturedAt: daysAgoIso(5),
        lastPaidTouch: {
          source: 'meta',
          ad_id: 'ad_win_1',
          adset_id: 'as_1',
          campaign_id: 'cmp_1',
          hypothesis_id: 'hyp_a',
          angle_id: 'ang_a',
          capturedAt: daysAgoIso(12)
        }
      }
    }),
    nowMs: now
  });
  assert.equal(lastTouchAttr.attributionChannel, 'paid_meta');
  assert.equal(lastTouchAttr.attributionMethod, 'last_paid_touch_30d');
  assert.equal(lastTouchAttr.adId, 'ad_win_1');

  // 2) Token de WhatsApp emitido cuando cliente abrió chat WA desde anuncio
  const issued = issueWaAttributionToken({
    productSlug: 'corrector-postura-pro',
    visitorId: 'vis_wa',
    phone: '0982 777 888',
    touch: {
      source: 'meta',
      ad_id: 'ad_wa_55',
      campaign_id: 'cmp_wa_55',
      hypothesis_id: 'hyp_wa',
      angle_id: 'ang_confianza',
      capturedAt: daysAgoIso(1)
    }
  });
  assert.match(issued.token, /^AA-[A-Z0-9]{4,10}$/);

  const waAttr = resolveOrderAttribution({
    order: makeOrder({
      reservaid: 'RES-ATTR-WA',
      celular: '0991 000 111',
      referenciaCasa: `Cliente escribió con código ${issued.token}`
    }),
    nowMs: now
  });
  assert.equal(waAttr.attributionChannel, 'paid_meta_via_wa');
  assert.equal(waAttr.attributionMethod, 'wa_token_match');
  assert.equal(waAttr.adId, 'ad_wa_55');
  assert.equal(waAttr.waToken, issued.token);

  // 3) Phone stitch cuando cliente regresa en otro dispositivo con mismo celular sin cookie ni token en texto
  const phoneAttr = resolveOrderAttribution({
    order: makeOrder({
      reservaid: 'RES-ATTR-PHONE',
      celular: '+595 982 777888',
      referenciaCasa: 'Sin referencia especial'
    }),
    nowMs: now
  });
  assert.equal(phoneAttr.attributionChannel, 'paid_meta_phone_stitch');
  assert.equal(phoneAttr.attributionMethod, 'phone_stitch_30d');
  assert.equal(phoneAttr.adId, 'ad_wa_55');

  // 4) Enriquecimiento determinístico via aa_cid -> ad_entities
  const entity = registerAdEntitySnapshot({
    productSlug: 'corrector-postura-pro',
    publisher: 'meta_direct',
    adAccountId: 'act_111',
    accountCurrency: 'PYG',
    campaignId: 'cmp_ent_9',
    adsetId: 'as_ent_9',
    adId: 'ad_ent_9',
    creativeId: 'cre_ent_9',
    aaCid: 'aacid_unit_09',
    hypothesisId: 'hyp_ent_9',
    angleId: 'ang_mecanismo_raiz',
    mediaType: 'image_1x1',
    headline: 'Titular Enriquecido'
  });
  assert.equal(entity.aaCid, 'aacid_unit_09');

  const aaCidAttr = resolveOrderAttribution({
    order: makeOrder({
      reservaid: 'RES-ATTR-AACID',
      celular: '0971 333 444',
      attributionSnapshot: {
        visitorId: 'vis_aacid',
        capturedAt: new Date(now).toISOString(),
        lastPaidTouch: {
          source: 'meta',
          aa_cid: 'aacid_unit_09',
          capturedAt: new Date(now).toISOString()
        }
      }
    }),
    nowMs: now
  });
  assert.equal(aaCidAttr.adId, 'ad_ent_9');
  assert.equal(aaCidAttr.campaignId, 'cmp_ent_9');
  assert.equal(aaCidAttr.hypothesisId, 'hyp_ent_9');
  assert.equal(aaCidAttr.angleId, 'ang_mecanismo_raiz');

  // 5) Fallback honesto a direct cuando no hay señal ni token ni stitch vigente (>30d expirado)
  const expiredDirect = resolveOrderAttribution({
    order: makeOrder({
      reservaid: 'RES-ATTR-DIRECT',
      celular: '0961 999 000',
      attributionSnapshot: {
        visitorId: 'vis_old',
        capturedAt: daysAgoIso(35),
        lastPaidTouch: {
          source: 'meta',
          ad_id: 'ad_expired',
          capturedAt: daysAgoIso(35)
        }
      }
    }),
    nowMs: now
  });
  assert.equal(expiredDirect.attributionChannel, 'direct');
  assert.equal(expiredDirect.attributionMethod, 'none');
});

test('ISO-05: Aislamiento absoluto de Circuito A respecto a estados de courier, costos, liquidaciones y Purchase', async (t) => {
  withIsolatedTempDataDir(t);

  registerAdEntitySnapshot({
    productSlug: 'parche-rodilla',
    publisher: 'meta_direct',
    adAccountId: 'act_222',
    accountCurrency: 'USD',
    campaignId: 'cmp_iso5',
    adsetId: 'as_iso5',
    adId: 'ad_iso5',
    creativeId: 'cre_iso5',
    aaCid: 'aacid_iso5',
    hypothesisId: 'hyp_iso5',
    angleId: 'ang_mecanismo_raiz',
    mediaType: 'image_1x1',
    headline: 'Parche Mecanismo'
  });

  // Inyectar métricas publicitarias maduras (día 0, cero entregas realizadas todavía)
  await syncMetaInsightsForAccount({
    adAccountId: 'act_222',
    accessToken: 'tok_meta',
    accountCurrency: 'USD',
    usdToPygRate: 7800,
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              date_start: '2026-11-12',
              campaign_id: 'cmp_iso5',
              adset_id: 'as_iso5',
              ad_id: 'ad_iso5',
              impressions: '1500',
              clicks: '48',
              inline_link_clicks: '40',
              spend: '6.0',
              actions: [{ action_type: 'lead', value: '3' }]
            }
          ]
        }),
        { status: 200 }
      )) as typeof fetch
  });

  const ordersToCreate = ['RES-ISO5-1', 'RES-ISO5-2', 'RES-ISO5-3'];
  for (const resId of ordersToCreate) {
    await createOrIdempotentPedidoWithAttribution({
      orderInput: makeOrder({
        reservaid: resId,
        productoId: 'parche-rodilla',
        producto: 'parche-rodilla',
        attributionSnapshot: {
          visitorId: `vis_${resId}`,
          capturedAt: new Date().toISOString(),
          lastPaidTouch: {
            source: 'meta',
            ad_id: 'ad_iso5',
            adset_id: 'as_iso5',
            campaign_id: 'cmp_iso5',
            creative_id: 'cre_iso5',
            hypothesis_id: 'hyp_iso5',
            angle_id: 'ang_mecanismo_raiz',
            capturedAt: new Date().toISOString()
          }
        }
      }),
      cloudSyncFn: async () => true
    });
  }

  clearCircuitAAccessLogForTesting();
  const readViewBefore = getCircuitAReadView('parche-rodilla');
  // Probar que la proyección sanitaria NO expone ningún campo logístico/financiero/Purchase
  for (const row of readViewBefore.confirmedOrders) {
    assert.equal('estado' in row, false);
    assert.equal('deliveryStatus' in row, false);
    assert.equal('customerPaymentStatus' in row, false);
    assert.equal('courierSettlementStatus' in row, false);
    assert.equal('netCashCollectedPyg' in row, false);
    assert.equal('productUnitCostPyg' in row, false);
    assert.equal('purchaseCapiStatus' in row, false);
  }

  const baselineLearning = recomputeCircuitALearning({ productSlug: 'parche-rodilla' });
  assert.equal(baselineLearning.byAd[0].formsCount, 3);
  assert.equal(baselineLearning.byAd[0].verdict, 'winner'); // Madura sin esperar entregas al courier!
  assert.equal(baselineLearning.byAd[0].formCvrPct, 7.5);
  assert.equal(baselineLearning.byAd[0].cpfUsd, 2);

  // Mutar pesadamente Circuito B: cancelado, devuelto, entregado+cobrado+liquidado, costos y Purchase CAPI
  applyOrderAxisUpdate({ reservaIdOrOrderId: 'RES-ISO5-1', deliveryStatus: 'devuelto', returnCostPyg: 18000 });
  const upd2 = applyOrderAxisUpdate({
    reservaIdOrOrderId: 'RES-ISO5-2',
    deliveryStatus: 'entregado_fisicamente',
    customerPaymentStatus: 'cobrado_verificado',
    courierSettlementStatus: 'liquidado_en_lote',
    courierFeePyg: 25000,
    netCashCollectedPyg: 140000
  });
  applyOrderAxisUpdate({ reservaIdOrOrderId: 'RES-ISO5-3', estado: 'cancelado' });
  saveProductCostProfile({ productSlug: 'parche-rodilla', unitProductCostPyg: 45000 });

  await dispatchIndependentPurchaseCapiIfEligible({
    order: upd2.order!,
    pixelId: '999111',
    capiAccessToken: 'tok_capi',
    fetchImpl: (async () => new Response(JSON.stringify({ events_received: 1 }), { status: 200 })) as typeof fetch
  });

  // Recalcular aprendizaje de Circuito A: debe ser IDÉNTICO al baseline
  const afterCircuitBLearning = recomputeCircuitALearning({ productSlug: 'parche-rodilla' });
  assert.deepEqual(afterCircuitBLearning.summary, baselineLearning.summary);
  assert.deepEqual(afterCircuitBLearning.byAd, baselineLearning.byAd);
  assert.deepEqual(afterCircuitBLearning.byHypothesis, baselineLearning.byHypothesis);
  assert.deepEqual(afterCircuitBLearning.byAngle, baselineLearning.byAngle);

  // Verificar que el acceso pasó por el puente sanitario
  const log = getCircuitAAccessLogForTesting();
  assert.equal(log.every((ev) => ev.accessor === 'circuit_a_intelligence_read'), true);

  // Además probar clasificador para ad perdedor estadísticamente maduro sin esperar entregas
  const loser = classifyAdStatisticalVerdict({
    impressions: 1200,
    inlineLinkClicks: 35,
    spendUsd: 8,
    formsCount: 0
  });
  assert.equal(loser.verdict, 'loser');
});

test('ISO-06: Competencia honesta de 3 niveles sin datos falsos e inteligencia de 6 hipótesis diversas', async (t) => {
  withIsolatedTempDataDir(t);

  // 1) Sin token Meta Ad Library ni carga manual: solo inferencia explícita no verificada
  const offlineComp = await mineCompetitorsHonestly({
    productName: 'Rodillera Térmica',
    productDescription: 'Soporte térmico recargable para rodilla en Paraguay'
  });
  assert.equal(offlineComp.summary.verifiedCount, 0);
  assert.equal(offlineComp.summary.manualCount, 0);
  assert.ok(offlineComp.summary.inferredCount >= 1);
  assert.equal(
    offlineComp.findings.every(
      (f) => f.sourceTier === 'llm_strategic_inference' && f.sourceVerified === false
    ),
    true
  );

  // 2) Fallo de Ad Library API se reporta con transparencia en adArchiveError sin inventar verificados
  const failedComp = await mineCompetitorsHonestly({
    productName: 'Rodillera Térmica',
    productDescription: 'Soporte térmico',
    metaAccessToken: 'expired_tok',
    fetchImpl: (async () =>
      new Response(JSON.stringify({ error: { message: 'Invalid OAuth access token' } }), {
        status: 400
      })) as typeof fetch
  });
  assert.equal(failedComp.summary.verifiedCount, 0);
  assert.match(String(failedComp.summary.adArchiveError), /Invalid OAuth/);

  // 3) Evidencia mixta real: Meta Ad Library + Manual + Inferencia
  const mixedIntel = await runPsychologicalAndHypothesisIntelligence({
    product: {
      slug: 'rodillera-termica',
      nombre: 'Rodillera Térmica Pro',
      descripcion: 'Alivio de rodilla con calor infrarrojo y compresión firme',
      precioNormal: 240000,
      precios: { 1: 185000, 2: 295000, 3: 390000 }
    },
    manualCompetitors: [
      {
        pageName: 'Importadora Central PY',
        headline: 'Alivio inmediato en puerta',
        bodyCopy: 'Pagás al recibir en Asunción',
        detectedAngle: 'Pago contra entrega'
      }
    ],
    offlineDeterministicOnly: true
  });

  assert.equal(mixedIntel.hypotheses.length, 6);
  const distinctCodes = new Set(mixedIntel.hypotheses.map((h) => h.hypothesisCode));
  const distinctAngles = new Set(mixedIntel.hypotheses.map((h) => h.angleId));
  const distinctVars = new Set(mixedIntel.hypotheses.map((h) => h.testVariable));
  assert.equal(distinctCodes.size, 6);
  assert.equal(distinctAngles.size, 6);
  assert.equal(distinctVars.size, 6);
  assert.equal(
    mixedIntel.hypotheses.every(
      (h) => h.aiImagePrompt.length > 30 && h.videoScriptPrompt.length > 30
    ),
    true
  );
  assert.equal(mixedIntel.brainProfileCompatible.strategyMode, 'hypothesis_v2');
  assert.equal(mixedIntel.brainProfileCompatible.recommendedObjective, 'OUTCOME_LEADS');
});

test('ISO-07: Compatibilidad Meta Direct & Pipeboard MCP, moneda PYG/USD real y advertencia no bloqueante de píxel Lead', async (t) => {
  withIsolatedTempDataDir(t);

  // Bug histórico corregido: cuentas PYG son zero-decimal (no multiplicar * 100)
  const usdBudget = normalizeDailyBudgetForMetaAccount({
    inputBudget: 5,
    inputCurrency: 'USD',
    accountCurrency: 'USD',
    usdToPygRate: 7800
  });
  assert.equal(usdBudget.isZeroDecimal, false);
  assert.equal(usdBudget.minorUnits, 500);

  const pygFromUsdBudget = normalizeDailyBudgetForMetaAccount({
    inputBudget: 10,
    inputCurrency: 'USD',
    accountCurrency: 'PYG',
    usdToPygRate: 7800
  });
  assert.equal(pygFromUsdBudget.isZeroDecimal, true);
  assert.equal(pygFromUsdBudget.minorUnits, 78000); // JAMÁS 7800000

  const pygDirectBudget = normalizeDailyBudgetForMetaAccount({
    inputBudget: 50000,
    inputCurrency: 'PYG',
    accountCurrency: 'PYG'
  });
  assert.equal(pygDirectBudget.minorUnits, 50000);

  // Spend normalization USD vs PYG
  const spendNormPyg = normalizeAccountSpend({
    rawSpend: 78000,
    accountCurrency: 'PYG',
    usdToPygRate: 7800
  });
  assert.equal(spendNormPyg.spendPyg, 78000);
  assert.equal(spendNormPyg.spendUsd, 10);

  // Píxel sin historial Lead (0 eventos): emite WARNING no bloqueante y readyToPublish === true
  const preflightDirect = await runMetaPublishPreflight({
    publisher: 'meta_direct',
    adAccountId: '12345',
    accessToken: 'tok_dir',
    pixelId: 'px_nuevo_001',
    dailyBudget: 10,
    dailyBudgetInputCurrency: 'USD',
    usdToPygRate: 7800,
    desiredObjective: 'OUTCOME_LEADS',
    hasVideosSelected: true,
    fetchImpl: (async (url: string) => {
      if (url.includes('?fields=currency')) {
        return new Response(JSON.stringify({ currency: 'PYG', account_status: 1 }), { status: 200 });
      }
      if (url.includes('/stats')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      if (url.includes('/campaigns')) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch
  });

  assert.equal(preflightDirect.readyToPublish, true);
  assert.equal(preflightDirect.accountCurrency, 'PYG');
  assert.equal(preflightDirect.dailyBudgetAccountMinorUnits, 78000);
  assert.equal(preflightDirect.optimizationEvent, 'LEAD');
  assert.equal(preflightDirect.trackingLinkMode, 'url_tags');
  assert.equal(preflightDirect.pixelLeadEvents7d, 0);
  assert.equal(
    preflightDirect.checks.some((c) => c.code === 'PIXEL_LEAD_HISTORY_LOW' && c.level === 'warning'),
    true
  );

  // Preflight Pipeboard cuando create_ad_creative no expone url_tags ni video tool -> fallback seguro sin bloquear
  const preflightPipeboard = await runMetaPublishPreflight({
    publisher: 'pipeboard',
    adAccountId: 'act_987',
    pixelId: 'px_002',
    dailyBudget: 5,
    dailyBudgetInputCurrency: 'USD',
    knownAccountCurrency: 'USD',
    hasVideosSelected: true,
    pipeboardToolsOverride: [
      {
        name: 'create_ad_creative',
        inputSchema: { properties: { name: {}, link_url: {}, image_hash: {} } }
      },
      { name: 'upload_ad_image', inputSchema: { properties: {} } }
    ],
    fetchImpl: (async () => new Response(JSON.stringify({ data: [] }), { status: 200 })) as typeof fetch
  });

  assert.equal(preflightPipeboard.readyToPublish, true);
  assert.equal(preflightPipeboard.urlTagsSupported, false);
  assert.equal(preflightPipeboard.videoUploadSupported, false);
  assert.equal(preflightPipeboard.trackingLinkMode, 'link_query_params');

  const taggedUrl = appendTrackingParamsToUrl('https://mitienda.py/p/producto', {
    aaCid: 'aacid_pb_01',
    hypothesisId: 'hyp_1',
    angleId: 'ang_1',
    campaignName: 'Camp_Test'
  });
  assert.match(taggedUrl, /aa_cid=aacid_pb_01/);
  assert.match(taggedUrl, /hypothesis_id=hyp_1/);

  const urlTags = buildMetaAttributionUrlTags({
    aaCid: 'aacid_dir_01',
    hypothesisId: 'hyp_1',
    angleId: 'ang_1',
    creativeId: 'cre_1'
  });
  assert.match(urlTags, /campaign_id=\{\{campaign\.id\}\}/);
  assert.match(urlTags, /aa_cid=aacid_dir_01/);
});

test('ISO-08: Circuito B ERP 3 ejes, estado legacy bidireccional, importación CSV y bloqueo honesto faltan_costos_reales', async (t) => {
  withIsolatedTempDataDir(t);

  const ordRes = await createOrIdempotentPedidoWithAttribution({
    orderInput: makeOrder({
      reservaid: 'RES-ERP-01',
      productoId: 'faja-reductora',
      producto: 'faja-reductora',
      cantidad: 1,
      monto: 200000,
      attributionSnapshot: {
        visitorId: 'vis_erp',
        capturedAt: new Date().toISOString(),
        lastPaidTouch: {
          source: 'meta',
          ad_id: 'ad_erp_1',
          campaign_id: 'cmp_erp_1',
          capturedAt: new Date().toISOString()
        }
      }
    }),
    cloudSyncFn: async () => true
  });

  // Transición intermedia vía estado legacy -> refleja en 3 ejes
  const transit = applyOrderAxisUpdate({ reservaIdOrOrderId: 'RES-ERP-01', estado: 'en_camino' });
  assert.equal(transit.order?.deliveryStatus, 'en_transito');
  assert.equal(transit.order?.customerPaymentStatus, 'pendiente_cobro');
  assert.equal(transit.isRealSale, false);

  // Importar CSV de liquidación courier para confirmar entrega + cobro + liquidación
  const settlement = importCourierSettlementCsv({
    courierName: 'Courier Express PY',
    referenceCode: 'LOTE-2026-11-12',
    csvText: [
      'reservaid,telefono,monto,comision,estado',
      'RES-ERP-01,0981555222,200000,25000,entregado'
    ].join('\n')
  });
  assert.equal(settlement.ordersCount, 1);
  assert.equal(settlement.totalGrossCollectedPyg, 200000);
  assert.equal(settlement.totalCourierFeesPyg, 25000);
  assert.equal(settlement.totalNetTransferredPyg, 175000);

  // Atribución de order NO fue modificada por actualización de Circuito B
  const oaAfterSettlement = readOrdersAttributionState();
  const attrRow = oaAfterSettlement.attributions.find((a) => a.reservaId === 'RES-ERP-01');
  assert.equal(attrRow?.adId, 'ad_erp_1');

  // Sin cost profile cargado -> BLOQUEA utilidad falsa (`faltan_costos_reales`)
  const missingCosts = computeAuditedErpProfitability({ productSlug: 'faja-reductora' });
  assert.equal(missingCosts.auditStatus, 'faltan_costos_reales');
  assert.equal(missingCosts.auditedNetProfitPyg, null);
  assert.equal(missingCosts.productCogsPyg, null);

  // Cargar FX real + costo real + gasto publicitario USD 5 -> auditado_completo exacto
  saveFxRatePeriod({ usdToPygRate: 7800, source: 'manual_admin' });
  saveProductCostProfile({
    productSlug: 'faja-reductora',
    unitProductCostPyg: 60000,
    packagingCostPyg: 5000
  });
  writeIntelligenceState({
    dossiers: [],
    hypotheses: [],
    adEntities: [],
    learningMemory: [],
    metaDailyInsights: [
      {
        id: 'ins_erp_1',
        insightDate: '2026-11-12',
        adAccountId: 'act_erp',
        accountCurrency: 'USD',
        campaignId: 'cmp_erp_1',
        adId: 'ad_erp_1',
        impressions: 1000,
        clicks: 25,
        inlineLinkClicks: 20,
        spendRaw: 5,
        spendUsd: 5,
        spendPyg: 39000,
        metaLeadsReported: 1,
        cpmUsd: 5,
        cpcUsd: 0.2,
        ctrPct: 2,
        syncedAt: new Date().toISOString()
      }
    ]
  });

  const audited = computeAuditedErpProfitability({ productSlug: 'faja-reductora' });
  assert.equal(audited.auditStatus, 'auditado_completo');
  assert.equal(audited.grossCollectedPyg, 200000);
  assert.equal(audited.productCogsPyg, 60000);
  assert.equal(audited.packagingTotalPyg, 5000);
  assert.equal(audited.courierFeesTotalPyg, 25000);
  assert.equal(audited.adSpendPyg, 39000);
  // 200.000 - 60.000 - 5.000 - 25.000 - 39.000 = 71.000
  assert.equal(audited.auditedNetProfitPyg, 71000);
  assert.equal(ordRes.order.reservaid, 'RES-ERP-01');
});

test('ISO-09: Purchase CAPI independiente solo en entregado+cobrado y nunca falsifica physical_store fuera de ventana 7d', async (t) => {
  withIsolatedTempDataDir(t);

  const nowMs = Date.UTC(2026, 10, 12, 15, 0, 0);
  const twoDaysAgoIso = new Date(nowMs - 2 * 86_400_000).toISOString();
  const tenDaysAgoIso = new Date(nowMs - 10 * 86_400_000).toISOString();

  // Caso A: Pedido reciente (2 días) aún pendiente -> NO elegible
  const recentOrder = await createOrIdempotentPedidoWithAttribution({
    orderInput: makeOrder({
      reservaid: 'RES-PUR-RECENT',
      fecha: twoDaysAgoIso,
      confirmedFormAt: twoDaysAgoIso,
      monto: 190000
    }),
    cloudSyncFn: async () => true
  });

  const pendingAttempt = await dispatchIndependentPurchaseCapiIfEligible({
    order: recentOrder.order,
    pixelId: 'px_pur',
    capiAccessToken: 'tok_pur',
    nowMs
  });
  assert.equal(pendingAttempt.eligible, false);
  assert.equal(pendingAttempt.status, 'not_eligible_not_delivered_or_paid');

  // Entregado + cobrado dentro de ventana real (2 días <= 7 días) -> envía Purchase genuino action_source='website'
  const deliveredRecent = applyOrderAxisUpdate({
    reservaIdOrOrderId: 'RES-PUR-RECENT',
    deliveryStatus: 'entregado_fisicamente',
    customerPaymentStatus: 'cobrado_verificado'
  });

  const sentBodies: any[] = [];
  const purchaseSent = await dispatchIndependentPurchaseCapiIfEligible({
    order: deliveredRecent.order!,
    attribution: recentOrder.attribution,
    pixelId: 'px_pur',
    capiAccessToken: 'tok_pur',
    nowMs,
    fetchImpl: (async (_u: string, init?: RequestInit) => {
      if (init?.body) sentBodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
    }) as typeof fetch
  });

  assert.equal(purchaseSent.eligible, true);
  assert.equal(purchaseSent.status, 'sent');
  assert.equal(sentBodies.length, 1);
  assert.equal(sentBodies[0].data[0].event_name, 'Purchase');
  assert.equal(sentBodies[0].data[0].action_source, 'website'); // JAMÁS physical_store
  assert.equal(sentBodies[0].data[0].custom_data.delivery_verified, true);
  assert.equal(sentBodies[0].data[0].custom_data.payment_verified, true);

  // Reintento sobre el mismo pedido ya enviado -> already_sent sin duplicar
  const duplicatePurchase = await dispatchIndependentPurchaseCapiIfEligible({
    order: deliveredRecent.order!,
    pixelId: 'px_pur',
    capiAccessToken: 'tok_pur',
    nowMs
  });
  assert.equal(duplicatePurchase.status, 'already_sent');

  // Caso B: Pedido con 10 días desde envío de formulario (> 7d) -> NO dispara a Meta ni usa physical_store
  const oldOrder = await createOrIdempotentPedidoWithAttribution({
    orderInput: makeOrder({
      reservaid: 'RES-PUR-OLD',
      fecha: tenDaysAgoIso,
      confirmedFormAt: tenDaysAgoIso,
      monto: 180000
    }),
    cloudSyncFn: async () => true
  });
  const deliveredOld = applyOrderAxisUpdate({
    reservaIdOrOrderId: 'RES-PUR-OLD',
    deliveryStatus: 'entregado_fisicamente',
    customerPaymentStatus: 'cobrado_verificado'
  });

  let expiredFetchCalls = 0;
  const expiredRes = await dispatchIndependentPurchaseCapiIfEligible({
    order: deliveredOld.order!,
    pixelId: 'px_pur',
    capiAccessToken: 'tok_pur',
    nowMs,
    fetchImpl: (async () => {
      expiredFetchCalls++;
      return new Response('{}', { status: 200 });
    }) as typeof fetch
  });

  assert.equal(expiredFetchCalls, 0);
  assert.equal(expiredRes.status, 'skipped_window_expired_erp_only');

  // Feature flags rollback persistence check
  const flagsBefore = getFeatureFlags();
  assert.equal(flagsBefore.AUTOADS_STRATEGY_V2_ENABLED, true);
  setFeatureFlags({ AUTOADS_STRATEGY_V2_ENABLED: false });
  assert.equal(getFeatureFlags().AUTOADS_STRATEGY_V2_ENABLED, false);
});

test('10) Mappers Supabase y buildPedidoSupabaseRow coinciden exactamente con columnas reales en PostgreSQL', () => {
  const sampleOrder = makeOrder({
    reservaid: 'RES-MAP-1',
    productoId: 'prod-map',
    producto: 'Producto Map',
    cantidad: 2,
    monto: 320000,
    attributedAdId: 'ad_map_1',
    deliveryStatus: 'en_reparto',
    customerPaymentStatus: 'pendiente_cobro',
    courierSettlementStatus: 'pendiente_liquidacion'
  });

  const dbRow = buildPedidoSupabaseRow(sampleOrder);
  assert.equal(dbRow.cantidad, 2);
  assert.equal(dbRow.monto, 320000);
  assert.equal(dbRow.producto_id, 'prod-map');
  assert.equal('pack' in dbRow, false);
  assert.equal('precio' in dbRow, false);
  assert.equal(dbRow.attributed_ad_id, 'ad_map_1');
  assert.equal(dbRow.delivery_status, 'en_reparto');

  const roundTripOrder = mapSupabasePedidoRowToOrder({ ...dbRow, id: 99 });
  assert.equal(roundTripOrder.id, 99);
  assert.equal(roundTripOrder.reservaid, 'RES-MAP-1');
  assert.equal(roundTripOrder.cantidad, 2);
  assert.equal(roundTripOrder.monto, 320000);
  assert.equal(roundTripOrder.attributedAdId, 'ad_map_1');
  assert.equal(roundTripOrder.canonicalConversionEvent, 'Lead');

  const attr = mapSupabaseOrderAttributionRow({
    id: 7,
    pedido_id: 99,
    reservaid: 'RES-MAP-1',
    product_slug: 'prod-map',
    attribution_channel: 'meta_paid',
    attribution_method: 'aa_cid',
    attribution_confidence: '0.95',
    ad_id: 'ad_map_1',
    confirmed_form_at: '2026-11-12T10:00:00Z',
    created_at: '2026-11-12T10:00:00Z'
  });
  assert.equal(attr.id, '7');
  assert.equal(attr.pedidoId, 99);
  assert.equal(attr.attributionConfidence, 0.95);
  assert.equal(attr.adId, 'ad_map_1');

  const wa = mapSupabaseWaTokenRow({
    token: 'AA-ABC123',
    product_slug: 'prod-map',
    ad_id: 'ad_map_1',
    created_at: '2026-11-12T10:00:00Z',
    expires_at: '2026-12-12T10:00:00Z'
  });
  assert.equal(wa.token, 'AA-ABC123');
  assert.equal(wa.adId, 'ad_map_1');

  const ent = mapSupabaseAdEntityRow({
    id: 'ent_1',
    product_slug: 'prod-map',
    publisher: 'pipeboard',
    ad_account_id: 'act_1',
    account_currency: 'USD',
    ad_id: 'ad_map_1',
    media_type: 'video',
    published_at: '2026-11-12T10:00:00Z'
  });
  assert.equal(ent.publisher, 'pipeboard');
  assert.equal(ent.mediaType, 'video');

  const dos = mapSupabaseDossierRow({
    id: 'dos_1',
    product_slug: 'prod-map',
    market: 'PY',
    awareness_level: 'problem_aware',
    market_sophistication: 3,
    created_at: '2026-11-12T10:00:00Z'
  });
  assert.equal(dos.id, 'dos_1');
  assert.equal(dos.marketSophistication, 3);

  const hyp = mapSupabaseHypothesisRow({
    id: 'hyp_1',
    dossier_id: 'dos_1',
    product_slug: 'prod-map',
    hypothesis_code: 'H1',
    angle_id: 'ang_1',
    big_idea: 'Idea Test',
    verdict: 'winner',
    created_at: '2026-11-12T10:00:00Z'
  });
  assert.equal(hyp.hypothesisCode, 'H1');
  assert.equal(hyp.angleName, 'Idea Test');
  assert.equal(hyp.verdict, 'winner');

  const ins = mapSupabaseInsightRow({
    insight_date: '2026-11-12',
    ad_account_id: 'act_1',
    ad_id: 'ad_map_1',
    impressions: 1200,
    spend_usd: '12.50',
    spend_pyg: '97500'
  });
  assert.equal(ins.id, '2026-11-12_act_1_ad_map_1');
  assert.equal(ins.spendUsd, 12.5);

  const mem = mapSupabaseLearningMemoryRow({
    id: 'mem_1',
    product_slug: 'prod-map',
    entity_type: 'ad',
    entity_id: 'ad_map_1',
    verdict: 'winner',
    forms_count: 5,
    cpf_usd: '2.5',
    updated_at: '2026-11-12T10:00:00Z'
  });
  assert.equal(mem.formsCount, 5);
  assert.equal(mem.cpfUsd, 2.5);

  const cost = mapSupabaseCostProfileRow({
    id: 'cost_1',
    product_slug: 'prod-map',
    unit_product_cost_pyg: 50000,
    packaging_cost_pyg: 5000,
    created_at: '2026-11-12T10:00:00Z'
  });
  assert.equal(cost.unitProductCostPyg, 50000);

  const fx = mapSupabaseFxPeriodRow({
    id: 'fx_1',
    effective_from: '2026-11-01T00:00:00Z',
    usd_to_pyg_rate: 7850,
    source: 'meta_invoice_reconciliation',
    created_at: '2026-11-12T10:00:00Z'
  });
  assert.equal(fx.usdToPygRate, 7850);
  assert.equal(fx.source, 'meta_invoice_reconciliation');

  const stl = mapSupabaseSettlementRow({
    id: 'stl_1',
    courier_name: 'AEX',
    settlement_date: '2026-11-12',
    total_gross_collected_pyg: 320000,
    total_courier_fees_pyg: 30000,
    total_net_transferred_pyg: 290000,
    orders_count: 1,
    matched_order_ids_json: ['RES-MAP-1'],
    created_at: '2026-11-12T10:00:00Z'
  });
  assert.equal(stl.totalNetTransferredPyg, 290000);
  assert.deepEqual(stl.matchedOrderIds, ['RES-MAP-1']);

  const capi = mapSupabaseCapiLogRow({
    id: 42,
    event_id: 'ord_RESMAP1_Lead',
    event_name: 'Lead',
    pixel_id: 'px_1',
    circuit: 'circuit_a_conversion',
    status: 'sent',
    attempts: 1,
    max_attempts: 5,
    event_time_unix: 1794500000,
    created_at: '2026-11-12T10:00:00Z'
  });
  assert.equal(capi.eventId, 'ord_RESMAP1_Lead');
  assert.equal(capi.status, 'sent');
});
