import crypto from 'node:crypto';
import fs from 'node:fs';
import type { MetaPreflightCheckItem, MetaPreflightReport } from '../src/types.ts';
import {
  getFeatureFlags,
  postgrestUpsert,
  readIntelligenceState,
  writeIntelligenceState,
  type StoredAdEntity
} from './autoadsStore.ts';

const ZERO_DECIMAL_CURRENCIES = new Set([
  'PYG', 'CLP', 'JPY', 'KRW', 'VND', 'ISK', 'UGX', 'RWF', 'HUF', 'TWD'
]);

function normalizeActId(adAccountId: string): string {
  const clean = String(adAccountId || '').trim();
  return clean.startsWith('act_') ? clean : `act_${clean}`;
}

export function generateAaCid(): string {
  return `aacid_${crypto.randomBytes(6).toString('hex')}`;
}

export function buildMetaAttributionUrlTags(params: {
  aaCid: string;
  hypothesisId?: string;
  angleId?: string;
  creativeId?: string;
}): string {
  const parts = [
    'utm_source=meta',
    'utm_medium=paid_social',
    'utm_campaign={{campaign.name}}',
    'utm_content={{ad.name}}',
    'campaign_id={{campaign.id}}',
    'adset_id={{adset.id}}',
    'ad_id={{ad.id}}',
    `aa_cid=${encodeURIComponent(params.aaCid)}`
  ];
  if (params.creativeId) parts.push(`creative_id=${encodeURIComponent(params.creativeId)}`);
  if (params.hypothesisId) parts.push(`hypothesis_id=${encodeURIComponent(params.hypothesisId)}`);
  if (params.angleId) parts.push(`angle_id=${encodeURIComponent(params.angleId)}`);
  return parts.join('&');
}

export function appendTrackingParamsToUrl(
  baseUrl: string,
  params: {
    aaCid: string;
    hypothesisId?: string;
    angleId?: string;
    creativeId?: string;
    campaignName?: string;
    adName?: string;
  }
): string {
  try {
    const u = new URL(baseUrl);
    u.searchParams.set('utm_source', 'meta');
    u.searchParams.set('utm_medium', 'paid_social');
    if (params.campaignName) u.searchParams.set('utm_campaign', params.campaignName);
    if (params.adName) u.searchParams.set('utm_content', params.adName);
    u.searchParams.set('aa_cid', params.aaCid);
    if (params.creativeId) u.searchParams.set('creative_id', params.creativeId);
    if (params.hypothesisId) u.searchParams.set('hypothesis_id', params.hypothesisId);
    if (params.angleId) u.searchParams.set('angle_id', params.angleId);
    return u.toString();
  } catch {
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}utm_source=meta&utm_medium=paid_social&aa_cid=${encodeURIComponent(params.aaCid)}`;
  }
}

export function normalizeDailyBudgetForMetaAccount(params: {
  inputBudget: number;
  inputCurrency?: 'USD' | 'PYG' | 'ACCOUNT';
  accountCurrency: string;
  usdToPygRate?: number;
}): {
  minorUnits: number;
  displayText: string;
  accountCurrency: string;
  isZeroDecimal: boolean;
} {
  const acctCur = String(params.accountCurrency || 'USD').toUpperCase();
  const inCur = String(params.inputCurrency || 'USD').toUpperCase();
  const rate = Number(params.usdToPygRate) > 0 ? Number(params.usdToPygRate) : 7800;
  const rawVal = Math.max(0, Number(params.inputBudget || 0));

  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(acctCur);
  let accountMajorAmount = rawVal;

  if (acctCur === 'PYG') {
    if (inCur === 'USD') {
      accountMajorAmount = rawVal * rate;
    } else {
      accountMajorAmount = rawVal;
    }
    const minorUnits = Math.max(1000, Math.round(accountMajorAmount));
    return {
      minorUnits,
      displayText: `Gs. ${minorUnits.toLocaleString('es-PY')}/día (${acctCur})`,
      accountCurrency: acctCur,
      isZeroDecimal: true
    };
  }

  // Cuentas en USD o monedas de 2 decimales
  if (inCur === 'PYG') {
    accountMajorAmount = rawVal / rate;
  }
  const minorUnits = Math.max(100, Math.round(accountMajorAmount * (isZeroDecimal ? 1 : 100)));
  return {
    minorUnits,
    displayText: `${acctCur} ${(isZeroDecimal ? minorUnits : minorUnits / 100).toFixed(isZeroDecimal ? 0 : 2)}/día`,
    accountCurrency: acctCur,
    isZeroDecimal
  };
}

export async function checkPixelLeadHistoryNonBlocking(params: {
  pixelId?: string;
  accessToken?: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  pixelLeadEvents7d: number | null;
  hasSufficientHistory: boolean;
  warningMessage?: string;
}> {
  const pixelId = String(params.pixelId || '').trim();
  const token = String(params.accessToken || '').trim();
  if (!pixelId || !token) {
    return {
      pixelLeadEvents7d: null,
      hasSufficientHistory: false,
      warningMessage:
        'Píxel o token CAPI no verificados aún para historial de Lead. No bloquea publicación, pero asegurate de tener eventos Lead reales entrando.'
    };
  }

  const fetchFn = params.fetchImpl || fetch;
  const startUnix = Math.floor((Date.now() - 7 * 86_400_000) / 1000);
  try {
    const resp = await fetchFn(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/stats?aggregation=event&start_time=${startUnix}&access_token=${encodeURIComponent(token)}`
    );
    const json: any = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        pixelLeadEvents7d: null,
        hasSufficientHistory: false,
        warningMessage: `No se pudo consultar historial Lead del píxel ${pixelId} (${json?.error?.message || resp.status}). No bloquea publicación.`
      };
    }

    let leadCount = 0;
    const rows: any[] = Array.isArray(json?.data) ? json.data : [];
    for (const bucket of rows) {
      const inner = Array.isArray(bucket?.data) ? bucket.data : [bucket];
      for (const item of inner) {
        if (String(item?.value || item?.event || '').toLowerCase() === 'lead') {
          leadCount += Number(item?.count || item?.value_count || 0);
        }
      }
    }

    const hasSufficientHistory = leadCount >= 5;
    return {
      pixelLeadEvents7d: leadCount,
      hasSufficientHistory,
      warningMessage: hasSufficientHistory
        ? undefined
        : `Advertencia no bloqueante: el píxel ${pixelId} registra ${leadCount} evento(s) Lead en los últimos 7 días. Podés publicar igual; en los primeros pedidos el aprendizaje de entrega arrancará desde cero.`
    };
  } catch (err: any) {
    return {
      pixelLeadEvents7d: null,
      hasSufficientHistory: false,
      warningMessage: `No se pudo leer stats de Lead del píxel (${String(err?.message || err)}). No bloquea publicación.`
    };
  }
}

export async function runMetaPublishPreflight(params: {
  publisher: 'meta_direct' | 'pipeboard';
  adAccountId: string;
  accessToken?: string;
  pipeboardMcpToken?: string;
  pipeboardUrl?: string;
  pixelId: string;
  dailyBudget: number;
  dailyBudgetInputCurrency?: 'USD' | 'PYG' | 'ACCOUNT';
  usdToPygRate?: number;
  desiredObjective?: 'OUTCOME_LEADS' | 'OUTCOME_SALES';
  hasVideosSelected?: boolean;
  knownAccountCurrency?: string;
  pipeboardToolsOverride?: Array<{ name: string; inputSchema?: any }>;
  fetchImpl?: typeof fetch;
}): Promise<MetaPreflightReport> {
  const flags = getFeatureFlags();
  const fetchFn = params.fetchImpl || fetch;
  const actId = normalizeActId(params.adAccountId);
  const checks: MetaPreflightCheckItem[] = [];
  const campaignObjective = params.desiredObjective || 'OUTCOME_LEADS';
  const optimizationEvent = campaignObjective === 'OUTCOME_LEADS' ? 'LEAD' : 'PURCHASE';

  // 1) Consultar moneda real de la cuenta publicitaria
  let accountCurrency = String(params.knownAccountCurrency || '').toUpperCase();
  if (!accountCurrency && params.publisher === 'meta_direct' && params.accessToken) {
    try {
      const r = await fetchFn(
        `https://graph.facebook.com/v21.0/${actId}?fields=currency,name,account_status&access_token=${encodeURIComponent(params.accessToken)}`
      );
      const j: any = await r.json().catch(() => ({}));
      if (r.ok && j?.currency) {
        accountCurrency = String(j.currency).toUpperCase();
        checks.push({
          code: 'ACCOUNT_CURRENCY_VERIFIED',
          level: 'ok',
          message: `Moneda real verificada en Meta: ${accountCurrency}`
        });
      }
    } catch {
      // handled below
    }
  }

  if (!accountCurrency) {
    accountCurrency = 'USD';
    checks.push({
      code: 'ACCOUNT_CURRENCY_FALLBACK',
      level: flags.AUTOADS_PREFLIGHT_STRICT_CURRENCY ? 'warning' : 'warning',
      message: 'Moneda de cuenta no reportada por Meta en preflight; asumiendo USD salvo override.'
    });
  }

  // 2) Normalización real de presupuesto según moneda
  const budgetNorm = normalizeDailyBudgetForMetaAccount({
    inputBudget: params.dailyBudget,
    inputCurrency: params.dailyBudgetInputCurrency || 'USD',
    accountCurrency,
    usdToPygRate: params.usdToPygRate
  });
  checks.push({
    code: 'BUDGET_CURRENCY_NORMALIZED',
    level: 'ok',
    message: `Presupuesto diario normalizado a ${budgetNorm.displayText} (minor_units=${budgetNorm.minorUnits})`
  });

  // 3) Historial de evento Lead en el píxel (SIEMPRE advertencia no bloqueante si es nuevo)
  const pixelStats = await checkPixelLeadHistoryNonBlocking({
    pixelId: params.pixelId,
    accessToken: params.accessToken,
    fetchImpl: fetchFn
  });
  if (pixelStats.warningMessage) {
    checks.push({
      code: 'PIXEL_LEAD_HISTORY_LOW',
      level: 'warning',
      message: pixelStats.warningMessage
    });
  } else {
    checks.push({
      code: 'PIXEL_LEAD_HISTORY_OK',
      level: 'ok',
      message: `Píxel ${params.pixelId} tiene ${pixelStats.pixelLeadEvents7d} eventos Lead recientes (7d).`
    });
  }

  // 4) Capacidades reales del publicador (Meta Direct vs Pipeboard MCP)
  let urlTagsSupported = params.publisher === 'meta_direct';
  let videoUploadSupported = params.publisher === 'meta_direct';

  if (params.publisher === 'meta_direct' && params.accessToken) {
    try {
      const validateBody = new URLSearchParams({
        name: `[PREFLIGHT VALIDATE_ONLY] ${campaignObjective}`,
        objective: campaignObjective,
        status: 'PAUSED',
        special_ad_categories: '[]',
        execution_options: JSON.stringify(['validate_only']),
        access_token: params.accessToken
      });
      const valResp = await fetchFn(`https://graph.facebook.com/v21.0/${actId}/campaigns`, {
        method: 'POST',
        body: validateBody
      });
      const valJson: any = await valResp.json().catch(() => ({}));
      if (valResp.ok && !valJson?.error) {
        checks.push({
          code: 'META_GRAPH_VALIDATE_ONLY_OK',
          level: 'ok',
          message: `Meta Graph v21.0 validó estructura de campaña ${campaignObjective} (${optimizationEvent}).`
        });
      } else {
        checks.push({
          code: 'META_GRAPH_VALIDATE_ONLY_WARN',
          level: 'warning',
          message: `Graph validate_only devolvió observación: ${valJson?.error?.message || `HTTP ${valResp.status}`}`
        });
      }
    } catch (err: any) {
      checks.push({
        code: 'META_GRAPH_VALIDATE_ONLY_ERROR',
        level: 'warning',
        message: `No se pudo contactar /validate_only de Meta (${String(err?.message || err)}).`
      });
    }
  } else if (params.publisher === 'pipeboard') {
    let tools = params.pipeboardToolsOverride || null;
    if (!tools && params.pipeboardMcpToken) {
      try {
        const mcpUrl = params.pipeboardUrl || 'https://pipeboard.co/api/meta/mcp';
        const r = await fetchFn(mcpUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${params.pipeboardMcpToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
        });
        const j: any = await r.json().catch(() => ({}));
        if (r.ok && Array.isArray(j?.result?.tools)) {
          tools = j.result.tools;
        }
      } catch {
        tools = null;
      }
    }

    const toolNames = (tools || []).map((t) => t.name);
    const creativeTool = (tools || []).find((t) => t.name === 'create_ad_creative');
    const creativeProps = Object.keys(creativeTool?.inputSchema?.properties || {});
    urlTagsSupported = creativeProps.includes('url_tags');
    videoUploadSupported = toolNames.some((n) => /video/i.test(n));

    if (!urlTagsSupported) {
      checks.push({
        code: 'PIPEBOARD_NO_URL_TAGS_FALLBACK',
        level: 'warning',
        message:
          'Pipeboard MCP no expone `url_tags` en `create_ad_creative`; se inyectará `aa_cid` y UTMs directamente en `link` (trackingLinkMode=link_query_params).'
      });
    }
    if (!videoUploadSupported && params.hasVideosSelected) {
      checks.push({
        code: 'PIPEBOARD_NO_VIDEO_TOOL_FALLBACK',
        level: 'warning',
        message:
          'Pipeboard MCP no soporta carga de vídeos Reels; en este publicador se usará fallback automático de imagen (`upload_ad_image`). Para vídeo nativo usá Publicador Directo Meta.'
      });
    }
  }

  const hasErrors = checks.some((c) => c.level === 'error');
  return {
    readyToPublish: !hasErrors,
    publisher: params.publisher,
    adAccountId: actId,
    accountCurrency,
    campaignObjective,
    optimizationEvent,
    pixelId: params.pixelId,
    pixelLeadEvents7d: pixelStats.pixelLeadEvents7d,
    pixelHasSufficientLeadHistory: pixelStats.hasSufficientHistory,
    dailyBudgetRaw: params.dailyBudget,
    dailyBudgetAccountMinorUnits: budgetNorm.minorUnits,
    dailyBudgetDisplay: budgetNorm.displayText,
    urlTagsSupported,
    videoUploadSupported,
    trackingLinkMode: urlTagsSupported ? 'url_tags' : 'link_query_params',
    checks
  };
}

export async function uploadMetaDirectAdVideo(params: {
  adAccountId: string;
  accessToken: string;
  videoFilePath?: string;
  videoUrl?: string;
  title?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; videoId?: string; error?: string }> {
  const fetchFn = params.fetchImpl || fetch;
  const actId = normalizeActId(params.adAccountId);
  try {
    let buffer: Buffer | null = null;
    let filename = 'reel.mp4';
    if (params.videoFilePath && fs.existsSync(params.videoFilePath)) {
      buffer = fs.readFileSync(params.videoFilePath);
      filename = params.videoFilePath.split(/[\\/]/).pop() || 'reel.mp4';
    } else if (params.videoUrl && /^https?:\/\//i.test(params.videoUrl)) {
      const r = await fetchFn(params.videoUrl);
      if (r.ok) {
        const arr = await r.arrayBuffer();
        buffer = Buffer.from(arr);
      }
    }

    if (!buffer || buffer.length === 0) {
      return { ok: false, error: 'Archivo o URL de vídeo no accesible en servidor para /advideos.' };
    }

    const form = new FormData();
    form.append('access_token', params.accessToken);
    if (params.title) form.append('title', params.title);
    form.append('source', new Blob([new Uint8Array(buffer)], { type: 'video/mp4' }), filename);

    const resp = await fetchFn(`https://graph.facebook.com/v21.0/${actId}/advideos`, {
      method: 'POST',
      body: form
    });
    const json: any = await resp.json().catch(() => ({}));
    if (!resp.ok || !json?.id) {
      return { ok: false, error: json?.error?.message || `HTTP ${resp.status} subiendo vídeo /advideos` };
    }
    return { ok: true, videoId: String(json.id) };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export function registerAdEntitySnapshot(input: Omit<StoredAdEntity, 'id' | 'publishedAt'>): StoredAdEntity {
  const entity: StoredAdEntity = {
    ...input,
    id: `ent_${input.aaCid || input.adId || crypto.randomBytes(5).toString('hex')}`,
    publishedAt: new Date().toISOString()
  };

  const state = readIntelligenceState();
  state.adEntities.unshift(entity);
  if (state.adEntities.length > 1000) state.adEntities = state.adEntities.slice(0, 1000);
  writeIntelligenceState(state);

  void postgrestUpsert(
    'ad_entities',
    {
      id: entity.id,
      product_slug: entity.productSlug,
      publisher: entity.publisher,
      ad_account_id: entity.adAccountId,
      account_currency: entity.accountCurrency,
      campaign_id: entity.campaignId || null,
      adset_id: entity.adsetId || null,
      ad_id: entity.adId || null,
      creative_id: entity.creativeId || null,
      meta_creative_id: entity.metaCreativeId || null,
      aa_cid: entity.aaCid || null,
      hypothesis_id: entity.hypothesisId || null,
      angle_id: entity.angleId || null,
      media_type: entity.mediaType,
      headline: entity.headline || null,
      primary_text: entity.primaryText || null,
      cta_label: entity.ctaLabel || null,
      destination_url: entity.destinationUrl || null,
      url_tags: entity.urlTags || null,
      preflight_status: entity.preflightStatus || null,
      payload_snapshot: entity.payloadSnapshot || null,
      published_at: entity.publishedAt
    },
    'id'
  );

  return entity;
}
