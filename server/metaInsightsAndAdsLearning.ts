import type { CircuitAMetricRow } from '../src/types.ts';
import {
  getCircuitAReadView,
  postgrestUpsert,
  readIntelligenceState,
  writeIntelligenceState,
  type StoredLearningMemoryRow,
  type StoredMetaDailyInsight
} from './autoadsStore.ts';

export interface MaturityThresholds {
  minImpressions: number;
  minClicks: number;
  minSpendUsd: number;
  targetMaxCpfUsd: number;
}

export const DEFAULT_CIRCUIT_A_THRESHOLDS: MaturityThresholds = {
  minImpressions: 800,
  minClicks: 25,
  minSpendUsd: 5,
  targetMaxCpfUsd: 3.5
};

function normalizeActId(adAccountId: string): string {
  const clean = String(adAccountId || '').trim();
  return clean.startsWith('act_') ? clean : `act_${clean}`;
}

export function extractMetaLeadActionCount(actions?: any[]): number {
  if (!Array.isArray(actions)) return 0;
  let total = 0;
  for (const act of actions) {
    const type = String(act?.action_type || '').toLowerCase();
    // ÚNICAMENTE señal canónica Lead (jamás sumar OrderReservedCOD ni Purchase)
    if (
      type === 'lead' ||
      type === 'offsite_conversion.fb_pixel_lead' ||
      type === 'onsite_conversion.lead_grouped'
    ) {
      total += Number(act?.value || 0);
    }
  }
  return Math.round(total);
}

export function normalizeAccountSpend(params: {
  rawSpend: number;
  accountCurrency: string;
  usdToPygRate?: number;
}): { spendUsd: number; spendPyg: number } {
  const rate = Number(params.usdToPygRate) > 0 ? Number(params.usdToPygRate) : 7800;
  const currency = String(params.accountCurrency || 'USD').toUpperCase();
  const raw = Math.max(0, Number(params.rawSpend || 0));
  if (currency === 'PYG') {
    return {
      spendUsd: Number((raw / rate).toFixed(4)),
      spendPyg: Math.round(raw)
    };
  }
  return {
    spendUsd: Number(raw.toFixed(4)),
    spendPyg: Math.round(raw * rate)
  };
}

export async function syncMetaInsightsForAccount(params: {
  adAccountId: string;
  accessToken: string;
  accountCurrency?: string;
  usdToPygRate?: number;
  datePreset?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ syncedRows: number; accountCurrency: string; warnings: string[] }> {
  const actId = normalizeActId(params.adAccountId);
  const fetchFn = params.fetchImpl || fetch;
  const warnings: string[] = [];

  let accountCurrency = String(params.accountCurrency || '').toUpperCase();
  if (!accountCurrency) {
    try {
      const metaAcct = await fetchFn(
        `https://graph.facebook.com/v21.0/${actId}?fields=currency&access_token=${encodeURIComponent(params.accessToken)}`
      );
      const acctJson: any = await metaAcct.json().catch(() => ({}));
      if (metaAcct.ok && acctJson?.currency) {
        accountCurrency = String(acctJson.currency).toUpperCase();
      }
    } catch {
      // fallback abajo
    }
  }
  if (!accountCurrency) {
    accountCurrency = 'USD';
    warnings.push('No se pudo detectar moneda de la cuenta en Meta; usando USD por defecto.');
  }

  const qs = new URLSearchParams({
    access_token: params.accessToken,
    level: 'ad',
    time_increment: '1',
    date_preset: params.datePreset || 'last_30d',
    fields: 'date_start,campaign_id,adset_id,ad_id,impressions,clicks,inline_link_clicks,spend,actions',
    limit: '500'
  });

  const resp = await fetchFn(`https://graph.facebook.com/v21.0/${actId}/insights?${qs.toString()}`);
  const json: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(json?.error?.message || `Error HTTP ${resp.status} sincronizando insights de Meta`);
  }

  const rows: any[] = Array.isArray(json?.data) ? json.data : [];
  const nowIso = new Date().toISOString();
  const state = readIntelligenceState();

  const normalizedRows: StoredMetaDailyInsight[] = rows.map((r) => {
    const rawSpend = Number(r.spend || 0);
    const { spendUsd, spendPyg } = normalizeAccountSpend({
      rawSpend,
      accountCurrency,
      usdToPygRate: params.usdToPygRate
    });
    const impressions = Math.max(0, Math.round(Number(r.impressions || 0)));
    const clicks = Math.max(0, Math.round(Number(r.clicks || 0)));
    const inlineLinkClicks = Math.max(0, Math.round(Number(r.inline_link_clicks || clicks)));
    return {
      id: `${r.date_start}_${actId}_${r.ad_id}`,
      insightDate: String(r.date_start),
      adAccountId: actId,
      accountCurrency,
      campaignId: r.campaign_id ? String(r.campaign_id) : undefined,
      adsetId: r.adset_id ? String(r.adset_id) : undefined,
      adId: String(r.ad_id),
      impressions,
      clicks,
      inlineLinkClicks,
      spendRaw: rawSpend,
      spendUsd,
      spendPyg,
      metaLeadsReported: extractMetaLeadActionCount(r.actions),
      cpmUsd: impressions > 0 ? Number(((spendUsd / impressions) * 1000).toFixed(4)) : 0,
      cpcUsd: clicks > 0 ? Number((spendUsd / clicks).toFixed(4)) : 0,
      ctrPct: impressions > 0 ? Number(((inlineLinkClicks / impressions) * 100).toFixed(4)) : 0,
      rawActionsJson: Array.isArray(r.actions) ? r.actions : [],
      syncedAt: nowIso
    };
  });

  const byKey = new Map<string, StoredMetaDailyInsight>();
  for (const existing of state.metaDailyInsights) byKey.set(existing.id, existing);
  for (const fresh of normalizedRows) byKey.set(fresh.id, fresh);
  state.metaDailyInsights = Array.from(byKey.values()).sort((a, b) =>
    b.insightDate.localeCompare(a.insightDate)
  );
  writeIntelligenceState(state);

  if (normalizedRows.length > 0) {
    void postgrestUpsert(
      'meta_ads_daily_insights',
      normalizedRows.map((n) => ({
        insight_date: n.insightDate,
        ad_account_id: n.adAccountId,
        account_currency: n.accountCurrency,
        campaign_id: n.campaignId || null,
        adset_id: n.adsetId || null,
        ad_id: n.adId,
        impressions: n.impressions,
        clicks: n.clicks,
        inline_link_clicks: n.inlineLinkClicks,
        spend_raw: n.spendRaw,
        spend_usd: n.spendUsd,
        spend_pyg: n.spendPyg,
        meta_leads_reported: n.metaLeadsReported,
        cpm_usd: n.cpmUsd,
        cpc_usd: n.cpcUsd,
        ctr_pct: n.ctrPct,
        raw_actions_json: n.rawActionsJson || [],
        synced_at: n.syncedAt
      })),
      'insight_date,ad_account_id,ad_id'
    );
  }

  return {
    syncedRows: normalizedRows.length,
    accountCurrency,
    warnings
  };
}

export function classifyAdStatisticalVerdict(params: {
  impressions: number;
  inlineLinkClicks: number;
  spendUsd: number;
  formsCount: number;
  thresholds?: MaturityThresholds;
}): {
  verdict: 'winner' | 'promising' | 'loser' | 'insufficient_data';
  maturityProgressPct: number;
  confidenceScore: number;
  recommendedAction: string;
} {
  const th = params.thresholds || DEFAULT_CIRCUIT_A_THRESHOLDS;
  const impRatio = params.impressions / Math.max(1, th.minImpressions);
  const clickRatio = params.inlineLinkClicks / Math.max(1, th.minClicks);
  const spendRatio = params.spendUsd / Math.max(0.1, th.minSpendUsd);
  const maturityProgressPct = Math.min(100, Math.round(Math.max(impRatio, clickRatio, spendRatio) * 100));

  const statisticallyMature =
    params.impressions >= th.minImpressions ||
    params.inlineLinkClicks >= th.minClicks ||
    params.spendUsd >= th.minSpendUsd;

  const formCvrPct =
    params.inlineLinkClicks > 0 ? (params.formsCount / params.inlineLinkClicks) * 100 : 0;
  const cpfUsd = params.formsCount > 0 ? params.spendUsd / params.formsCount : null;

  if (!statisticallyMature && params.formsCount < 3) {
    return {
      verdict: 'insufficient_data',
      maturityProgressPct,
      confidenceScore: Math.min(0.49, Number((maturityProgressPct / 200).toFixed(2))),
      recommendedAction:
        'Seguir recolectando impresiones y clics hacia umbral estadístico de formulario (no espera entregas).'
    };
  }

  if (
    params.formsCount >= 2 &&
    ((cpfUsd !== null && cpfUsd <= th.targetMaxCpfUsd) || formCvrPct >= 3.0)
  ) {
    return {
      verdict: 'winner',
      maturityProgressPct: 100,
      confidenceScore: Math.min(0.98, 0.72 + Math.min(0.26, params.formsCount * 0.04)),
      recommendedAction:
        'Ganador de formulario: escalar presupuesto e iterar variaciones de hook manteniendo mecanismo.'
    };
  }

  if (
    params.formsCount >= 1 &&
    (cpfUsd === null || cpfUsd <= th.targetMaxCpfUsd * 1.45)
  ) {
    return {
      verdict: 'promising',
      maturityProgressPct: Math.max(60, maturityProgressPct),
      confidenceScore: 0.64,
      recommendedAction:
        'Prometedor: mantener activo para confirmar CPF y testear variación de primer impacto.'
    };
  }

  return {
    verdict: 'loser',
    maturityProgressPct: 100,
    confidenceScore: 0.82,
    recommendedAction:
      'Bajo rendimiento de formularios tras madurez estadística: pausar y rotar a hipótesis psicológica alternativa.'
  };
}

export function recomputeCircuitALearning(params: {
  productSlug: string;
  thresholds?: MaturityThresholds;
}): {
  summary: {
    totalConfirmedForms: number;
    attributedForms: number;
    directOrUnattributedForms: number;
    totalImpressions: number;
    totalInlineLinkClicks: number;
    totalSpendUsd: number;
    totalSpendPyg: number;
    overallFormCvrPct: number;
    overallCpfUsd: number | null;
    overallCpfPyg: number | null;
  };
  byCampaign: CircuitAMetricRow[];
  byAdSet: CircuitAMetricRow[];
  byAd: CircuitAMetricRow[];
  byCreative: CircuitAMetricRow[];
  byHypothesis: CircuitAMetricRow[];
  byAngle: CircuitAMetricRow[];
  learningMemory: StoredLearningMemoryRow[];
} {
  // AISLAMIENTO ESTRICTO: Solo consume el repositorio sanitario del Circuito A.
  const view = getCircuitAReadView(params.productSlug);
  const th = params.thresholds || DEFAULT_CIRCUIT_A_THRESHOLDS;

  const entityByAdId = new Map<string, (typeof view.adEntities)[number]>();
  for (const ent of view.adEntities) {
    if (ent.adId) entityByAdId.set(ent.adId, ent);
  }

  interface Bucket {
    entityType: CircuitAMetricRow['entityType'];
    entityId: string;
    label: string;
    angleId?: string;
    hypothesisId?: string;
    impressions: number;
    clicks: number;
    inlineLinkClicks: number;
    spendUsd: number;
    spendPyg: number;
    formsSeen: Set<string>;
  }

  const maps: Record<
    'campaign' | 'adset' | 'ad' | 'creative' | 'hypothesis' | 'angle',
    Map<string, Bucket>
  > = {
    campaign: new Map(),
    adset: new Map(),
    ad: new Map(),
    creative: new Map(),
    hypothesis: new Map(),
    angle: new Map()
  };

  const ensureBucket = (
    kind: keyof typeof maps,
    id: string | undefined,
    meta?: { label?: string; angleId?: string; hypothesisId?: string }
  ): Bucket | null => {
    const cleanId = String(id || '').trim();
    if (!cleanId) return null;
    const map = maps[kind];
    let b = map.get(cleanId);
    if (!b) {
      b = {
        entityType: kind,
        entityId: cleanId,
        label: meta?.label || cleanId,
        angleId: meta?.angleId,
        hypothesisId: meta?.hypothesisId,
        impressions: 0,
        clicks: 0,
        inlineLinkClicks: 0,
        spendUsd: 0,
        spendPyg: 0,
        formsSeen: new Set()
      };
      map.set(cleanId, b);
    } else {
      if (meta?.angleId && !b.angleId) b.angleId = meta.angleId;
      if (meta?.hypothesisId && !b.hypothesisId) b.hypothesisId = meta.hypothesisId;
      if (meta?.label && b.label === cleanId) b.label = meta.label;
    }
    return b;
  };

  // 1) Acumular impresiones, clics y gasto desde metaDailyInsights
  let totalImpressions = 0;
  let totalInlineLinkClicks = 0;
  let totalSpendUsd = 0;
  let totalSpendPyg = 0;

  for (const ins of view.metaDailyInsights) {
    const ent = entityByAdId.get(ins.adId);
    // Si filtramos por productSlug y tenemos adEntities registradas de otros productos, respetar pertenencia si la entidad existe en otra línea
    const belongsToProduct =
      !params.productSlug ||
      Boolean(ent) ||
      view.confirmedOrders.some((o) => o.attributedAdId === ins.adId || o.attributedCampaignId === ins.campaignId);
    if (!belongsToProduct && view.adEntities.length > 0) continue;

    const clicksEff = ins.inlineLinkClicks > 0 ? ins.inlineLinkClicks : ins.clicks;
    totalImpressions += ins.impressions;
    totalInlineLinkClicks += clicksEff;
    totalSpendUsd += ins.spendUsd;
    totalSpendPyg += ins.spendPyg;

    const buckets = [
      ensureBucket('ad', ins.adId, {
        label: ent?.headline || `Ad ${ins.adId}`,
        angleId: ent?.angleId,
        hypothesisId: ent?.hypothesisId
      }),
      ensureBucket('campaign', ins.campaignId || ent?.campaignId),
      ensureBucket('adset', ins.adsetId || ent?.adsetId),
      ensureBucket('creative', ent?.creativeId, {
        label: ent?.headline || ent?.creativeId,
        angleId: ent?.angleId,
        hypothesisId: ent?.hypothesisId
      }),
      ensureBucket('hypothesis', ent?.hypothesisId, {
        angleId: ent?.angleId,
        hypothesisId: ent?.hypothesisId
      }),
      ensureBucket('angle', ent?.angleId, {
        angleId: ent?.angleId,
        hypothesisId: ent?.hypothesisId
      })
    ];

    for (const b of buckets) {
      if (!b) continue;
      b.impressions += ins.impressions;
      b.clicks += ins.clicks;
      b.inlineLinkClicks += clicksEff;
      b.spendUsd += ins.spendUsd;
      b.spendPyg += ins.spendPyg;
    }
  }

  // 2) Acumular CADA formulario confirmado exactamente UNA vez (reservaId único)
  let totalConfirmedForms = 0;
  let attributedForms = 0;
  const seenGlobalOrders = new Set<string>();

  for (const ord of view.confirmedOrders) {
    if (seenGlobalOrders.has(ord.reservaId)) continue;
    seenGlobalOrders.add(ord.reservaId);
    totalConfirmedForms++;

    const ent = ord.attributedAdId ? entityByAdId.get(ord.attributedAdId) : undefined;
    const adId = ord.attributedAdId || ent?.adId;
    const campaignId = ord.attributedCampaignId || ent?.campaignId;
    const adsetId = ord.attributedAdsetId || ent?.adsetId;
    const creativeId = ord.attributedCreativeId || ent?.creativeId;
    const hypothesisId = ord.attributedHypothesisId || ent?.hypothesisId;
    const angleId = ord.attributedAngleId || ent?.angleId;

    if (adId || campaignId || adsetId || hypothesisId || angleId) {
      attributedForms++;
    }

    const targets = [
      ensureBucket('ad', adId, { label: ent?.headline || adId, angleId, hypothesisId }),
      ensureBucket('campaign', campaignId),
      ensureBucket('adset', adsetId),
      ensureBucket('creative', creativeId, { angleId, hypothesisId }),
      ensureBucket('hypothesis', hypothesisId, { angleId, hypothesisId }),
      ensureBucket('angle', angleId, { angleId, hypothesisId })
    ];
    for (const b of targets) {
      if (b) b.formsSeen.add(ord.reservaId);
    }
  }

  const finalizeBuckets = (map: Map<string, Bucket>): CircuitAMetricRow[] =>
    Array.from(map.values())
      .map((b) => {
        const formsCount = b.formsSeen.size;
        const formCvrPct =
          b.inlineLinkClicks > 0 ? Number(((formsCount / b.inlineLinkClicks) * 100).toFixed(2)) : 0;
        const cpfUsd = formsCount > 0 ? Number((b.spendUsd / formsCount).toFixed(3)) : null;
        const cpfPyg = formsCount > 0 ? Math.round(b.spendPyg / formsCount) : null;
        const verdictObj = classifyAdStatisticalVerdict({
          impressions: b.impressions,
          inlineLinkClicks: b.inlineLinkClicks,
          spendUsd: b.spendUsd,
          formsCount,
          thresholds: th
        });

        return {
          entityType: b.entityType,
          entityId: b.entityId,
          label: b.label,
          angleId: b.angleId,
          hypothesisId: b.hypothesisId,
          impressions: b.impressions,
          clicks: b.clicks,
          inlineLinkClicks: b.inlineLinkClicks,
          spendUsd: Number(b.spendUsd.toFixed(4)),
          spendPyg: Math.round(b.spendPyg),
          formsCount,
          formCvrPct,
          cpfUsd,
          cpfPyg,
          verdict: verdictObj.verdict,
          maturityProgressPct: verdictObj.maturityProgressPct,
          confidenceScore: verdictObj.confidenceScore,
          recommendedAction: verdictObj.recommendedAction
        };
      })
      .sort((a, b) => b.formsCount - a.formsCount || a.spendUsd - b.spendUsd);

  const byCampaign = finalizeBuckets(maps.campaign);
  const byAdSet = finalizeBuckets(maps.adset);
  const byAd = finalizeBuckets(maps.ad);
  const byCreative = finalizeBuckets(maps.creative);
  const byHypothesis = finalizeBuckets(maps.hypothesis);
  const byAngle = finalizeBuckets(maps.angle);

  // 3) Actualizar memoria persistente de aprendizaje (Circuito A)
  const nowIso = new Date().toISOString();
  const rowsToSave: CircuitAMetricRow[] = [...byAd, ...byHypothesis, ...byAngle];
  const memoryEntries: StoredLearningMemoryRow[] = rowsToSave.map((r) => ({
    id: `${params.productSlug}_${r.entityType}_${r.entityId}`,
    productSlug: params.productSlug,
    entityType: r.entityType,
    entityId: r.entityId,
    angleId: r.angleId,
    hypothesisId: r.hypothesisId,
    verdict: r.verdict,
    formsCount: r.formsCount,
    inlineLinkClicks: r.inlineLinkClicks,
    impressions: r.impressions,
    spendUsd: r.spendUsd,
    spendPyg: r.spendPyg,
    formCvrPct: r.formCvrPct,
    cpfUsd: r.cpfUsd,
    cpfPyg: r.cpfPyg,
    confidenceScore: r.confidenceScore,
    recommendedAction: r.recommendedAction,
    learnedPatternSummary: `${r.label}: ${r.formsCount} formularios, CVR ${r.formCvrPct}%, CPF $${r.cpfUsd ?? 'N/A'}`,
    updatedAt: nowIso
  }));

  const state = readIntelligenceState();
  const byMemId = new Map<string, StoredLearningMemoryRow>();
  for (const m of state.learningMemory) byMemId.set(m.id, m);
  for (const m of memoryEntries) byMemId.set(m.id, m);
  state.learningMemory = Array.from(byMemId.values());

  // Reflejar veredictos en las hipótesis guardadas
  const hypVerdictMap = new Map(byHypothesis.map((h) => [h.entityId, h.verdict]));
  state.hypotheses = state.hypotheses.map((h) => {
    const v = hypVerdictMap.get(h.id);
    return v ? { ...h, verdict: v } : h;
  });
  writeIntelligenceState(state);

  if (memoryEntries.length > 0) {
    void postgrestUpsert(
      'autoads_learning_memory',
      memoryEntries.map((m) => ({
        id: m.id,
        product_slug: m.productSlug,
        entity_type: m.entityType,
        entity_id: m.entityId,
        angle_id: m.angleId || null,
        hypothesis_id: m.hypothesisId || null,
        verdict: m.verdict,
        forms_count: m.formsCount,
        inline_link_clicks: m.inlineLinkClicks,
        impressions: m.impressions,
        spend_usd: m.spendUsd,
        spend_pyg: m.spendPyg,
        form_cvr_pct: m.formCvrPct,
        cpf_usd: m.cpfUsd,
        cpf_pyg: m.cpfPyg,
        confidence_score: m.confidenceScore,
        recommended_action: m.recommendedAction,
        learned_pattern_summary: m.learnedPatternSummary,
        updated_at: m.updatedAt
      })),
      'id'
    );
  }

  return {
    summary: {
      totalConfirmedForms,
      attributedForms,
      directOrUnattributedForms: Math.max(0, totalConfirmedForms - attributedForms),
      totalImpressions,
      totalInlineLinkClicks,
      totalSpendUsd: Number(totalSpendUsd.toFixed(4)),
      totalSpendPyg: Math.round(totalSpendPyg),
      overallFormCvrPct:
        totalInlineLinkClicks > 0
          ? Number(((totalConfirmedForms / totalInlineLinkClicks) * 100).toFixed(2))
          : 0,
      overallCpfUsd:
        totalConfirmedForms > 0 ? Number((totalSpendUsd / totalConfirmedForms).toFixed(3)) : null,
      overallCpfPyg:
        totalConfirmedForms > 0 ? Math.round(totalSpendPyg / totalConfirmedForms) : null
    },
    byCampaign,
    byAdSet,
    byAd,
    byCreative,
    byHypothesis,
    byAngle,
    learningMemory: memoryEntries
  };
}
