import fs from 'node:fs';
import path from 'node:path';
import type {
  MetaCommentAdStats,
  MetaCommentAutomationConfig,
  MetaCommentChannel,
  MetaCommentChatMessage,
  MetaCommentOrderOrigin,
  MetaCommentThreadRecord,
  Order,
  ProductPage
} from '../src/types.ts';
import { OFFICIAL_META_AD_ACCOUNT_ID, OFFICIAL_META_PAGE_ID } from './metaAuthSession.ts';
import {
  deleteSupabaseCodigos,
  insertOrUpdateSupabaseCodigo,
  normalizeWaPhone,
  querySupabaseCodigos,
  sendWhatsAppMessage
} from './whatsappEngine.ts';

export const META_COMMENTS_VAULT_CODE = 'METACOMMENTS-v1';
const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const META_COMMENTS_LLM_MODEL = 'openai/gpt-4o';

export interface MetaCommentsStoreState {
  version: 1;
  config: MetaCommentAutomationConfig;
  threads: MetaCommentThreadRecord[];
  adAttributionStats: Record<
    string,
    {
      adId: string;
      adName: string;
      adIndex?: number;
      campaignId?: string;
      campaignName?: string;
      postId?: string;
      productId?: string;
      productSlug?: string;
      productName?: string;
      closedOrdersCount: number;
      revenuePyg: number;
      orderIds: string[];
      lastOrderAt?: string;
    }
  >;
  updatedAt: string;
}

let stateFilePathOverrideForTest: string | null = null;

export function setMetaCommentsStateFileOverrideForTest(filePath: string | null): void {
  stateFilePathOverrideForTest = filePath;
  resetMetaCommentsInMemoryForTest();
}

export function getMetaCommentsStateFilePath(): string {
  return stateFilePathOverrideForTest || path.resolve(process.cwd(), 'data', 'meta_comments_state.json');
}

export function createDefaultMetaCommentsState(products: ProductPage[] = []): MetaCommentsStoreState {
  const firstProduct = products[0];
  return {
    version: 1,
    config: {
      enabled: true,
      autoPublicReply: true,
      autoPrivateDm: false,
      publicOnlyMode: true,
      autoPollingSeconds: 25,
      autoHidePhoneComments: true,
      autoWhatsappOnPhone: true,
      defaultProductId: String(firstProduct?.id || ''),
      defaultProductSlug: String(firstProduct?.slug || ''),
      publicBaseUrl: String(process.env.PUBLIC_APP_URL || '').trim(),
      campaignProductMap: {},
      adProductMap: {},
      postAdMap: {},
      activeAdsSnapshot: [],
      webhookVerifyToken: String(process.env.META_WEBHOOK_VERIFY_TOKEN || 'noelux_meta_comments_2026').trim(),
      lastSyncAt: undefined,
      lastAutoPollAt: undefined,
      lastAutoPollError: undefined
    },
    threads: [],
    adAttributionStats: {},
    updatedAt: new Date().toISOString()
  };
}

let inMemoryCommentsState: MetaCommentsStoreState | null = null;
let cloudHydratedOnce = false;
let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;

function ensureDataDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function normalizeCommentsStateShape(
  raw: any,
  products: ProductPage[] = []
): MetaCommentsStoreState {
  const base = createDefaultMetaCommentsState(products);
  const srcConfig = raw?.config || {};
  const mergedConfig: MetaCommentAutomationConfig = {
    enabled: typeof srcConfig.enabled === 'boolean' ? srcConfig.enabled : base.config.enabled,
    autoPublicReply:
      typeof srcConfig.autoPublicReply === 'boolean' ? srcConfig.autoPublicReply : base.config.autoPublicReply,
    autoPrivateDm: false,
    publicOnlyMode: true,
    autoPollingSeconds: Math.max(15, Number(srcConfig.autoPollingSeconds || base.config.autoPollingSeconds || 25)),
    autoHidePhoneComments:
      typeof srcConfig.autoHidePhoneComments === 'boolean'
        ? srcConfig.autoHidePhoneComments
        : base.config.autoHidePhoneComments,
    autoWhatsappOnPhone:
      typeof srcConfig.autoWhatsappOnPhone === 'boolean'
        ? srcConfig.autoWhatsappOnPhone
        : base.config.autoWhatsappOnPhone,
    defaultProductId: String(srcConfig.defaultProductId || base.config.defaultProductId || ''),
    defaultProductSlug: String(srcConfig.defaultProductSlug || base.config.defaultProductSlug || ''),
    publicBaseUrl: String(srcConfig.publicBaseUrl || base.config.publicBaseUrl || ''),
    campaignProductMap:
      srcConfig.campaignProductMap && typeof srcConfig.campaignProductMap === 'object'
        ? srcConfig.campaignProductMap
        : {},
    adProductMap:
      srcConfig.adProductMap && typeof srcConfig.adProductMap === 'object' ? srcConfig.adProductMap : {},
    postAdMap: srcConfig.postAdMap && typeof srcConfig.postAdMap === 'object' ? srcConfig.postAdMap : {},
    activeAdsSnapshot: Array.isArray(srcConfig.activeAdsSnapshot) ? srcConfig.activeAdsSnapshot : [],
    webhookVerifyToken: String(srcConfig.webhookVerifyToken || base.config.webhookVerifyToken),
    lastSyncAt: srcConfig.lastSyncAt ? String(srcConfig.lastSyncAt) : undefined,
    lastAutoPollAt: srcConfig.lastAutoPollAt ? String(srcConfig.lastAutoPollAt) : undefined,
    lastAutoPollError: srcConfig.lastAutoPollError ? String(srcConfig.lastAutoPollError) : undefined
  };

  const threads: MetaCommentThreadRecord[] = Array.isArray(raw?.threads)
    ? raw.threads.map((t: any) => ({
        ...t,
        detectedPhones: Array.isArray(t?.detectedPhones) ? t.detectedPhones : [],
        messages: Array.isArray(t?.messages) ? t.messages : []
      }))
    : [];

  return {
    version: 1,
    config: mergedConfig,
    threads,
    adAttributionStats:
      raw?.adAttributionStats && typeof raw.adAttributionStats === 'object' ? raw.adAttributionStats : {},
    updatedAt: String(raw?.updatedAt || new Date().toISOString())
  };
}

export function loadMetaCommentsState(products: ProductPage[] = []): MetaCommentsStoreState {
  if (inMemoryCommentsState) {
    if (!inMemoryCommentsState.config.defaultProductId && products[0]) {
      inMemoryCommentsState.config.defaultProductId = products[0].id;
      inMemoryCommentsState.config.defaultProductSlug = products[0].slug;
    }
    return inMemoryCommentsState;
  }

  const filePath = getMetaCommentsStateFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8') || '{}');
      inMemoryCommentsState = normalizeCommentsStateShape(parsed, products);
      return inMemoryCommentsState;
    } catch {
      // Fall back to fresh default if corrupted
    }
  }

  inMemoryCommentsState = createDefaultMetaCommentsState(products);
  return inMemoryCommentsState;
}

export function saveMetaCommentsState(
  state: MetaCommentsStoreState,
  options?: { skipCloudSync?: boolean; filePathOverride?: string }
): MetaCommentsStoreState {
  const filePath = options?.filePathOverride || getMetaCommentsStateFilePath();
  state.updatedAt = new Date().toISOString();
  // Mantener un máximo razonable de hilos recientes (800) sin explotar JSONB/Supabase
  if (state.threads.length > 800) {
    state.threads = [...state.threads]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 800);
  }
  inMemoryCommentsState = state;
  try {
    ensureDataDir(filePath);
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error('[metaCommentsEngine] save disk error:', err);
  }

  if (!options?.skipCloudSync) {
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => {
      void pushMetaCommentsStateToSupabase(state).catch(() => {});
    }, 600);
  }

  return state;
}

export function resetMetaCommentsInMemoryForTest(): void {
  inMemoryCommentsState = null;
  cloudHydratedOnce = false;
  if (cloudSyncTimer) {
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = null;
  }
}

export async function pushMetaCommentsStateToSupabase(
  state: MetaCommentsStoreState
): Promise<boolean> {
  try {
    await deleteSupabaseCodigos(`eq.${META_COMMENTS_VAULT_CODE}`).catch(() => {});
    const serialized = JSON.stringify(state);
    return await insertOrUpdateSupabaseCodigo(META_COMMENTS_VAULT_CODE, serialized);
  } catch {
    return false;
  }
}

export async function hydrateMetaCommentsStateFromSupabase(
  products: ProductPage[] = [],
  forceRefresh = false
): Promise<MetaCommentsStoreState> {
  const localState = loadMetaCommentsState(products);
  if (cloudHydratedOnce && !forceRefresh) {
    return localState;
  }
  cloudHydratedOnce = true;

  try {
    const rows = await querySupabaseCodigos({
      codeFilter: `eq.${META_COMMENTS_VAULT_CODE}`,
      orderDesc: true,
      limit: 1,
      timeoutMs: 5000
    });
    const rawJson = rows?.[0]?.dispositivo;
    if (rawJson) {
      const cloudState = normalizeCommentsStateShape(JSON.parse(String(rawJson)), products);
      const localMs = new Date(localState.updatedAt || 0).getTime();
      const cloudMs = new Date(cloudState.updatedAt || 0).getTime();
      const localHasMore = localState.threads.length > cloudState.threads.length;
      if (cloudMs > localMs && !localHasMore) {
        saveMetaCommentsState(cloudState, { skipCloudSync: true });
        return cloudState;
      }
    }
  } catch {
    // Graceful fallback to local disk state
  }
  return localState;
}

/**
 * Detecta teléfonos móviles paraguayos sin confundir precios en Guaraníes (ej. 189.000, 358.000).
 * Soporta formatos como:
 * - 0981 123 456 / 0981-123-456 / 0981123456
 * - +595 981 123 456 / 595981123456
 */
export function detectParaguayPhonesInText(text: string): string[] {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const found = new Set<string>();
  const pattern = /(?:\+?595[\s.\-()]*)?0?9[6-9]\d(?:[\s.\-()]*\d){6}/g;
  const matches = raw.match(pattern) || [];

  for (const m of matches) {
    // Evitar falsos positivos tipo precios "189.000" o fechas
    const digits = m.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 13) continue;
    let normalized = '';
    if (digits.startsWith('5959') && digits.length >= 12) {
      normalized = digits.slice(0, 12);
    } else if (digits.startsWith('09') && digits.length === 10) {
      normalized = `595${digits.slice(1)}`;
    } else if (digits.startsWith('9') && digits.length === 9) {
      normalized = `595${digits}`;
    } else {
      normalized = normalizeWaPhone(digits);
    }
    if (/^5959[6-9]\d{7}$/.test(normalized)) {
      found.add(normalized);
    }
  }

  return Array.from(found);
}

export function formatParaguayGs(amount: number): string {
  const num = Number(amount) || 0;
  return `Gs. ${Math.round(num).toLocaleString('es-PY')}`;
}

export function buildExpressCheckoutUrl(params: {
  baseUrl?: string;
  productSlug?: string;
  productId?: string;
  adId?: string;
  adName?: string;
  adIndex?: number;
  campaignId?: string;
  campaignName?: string;
  postId?: string;
  commentId?: string;
  threadId?: string;
  authorName?: string;
  channel?: MetaCommentChannel;
}): string {
  const cleanBase = String(params.baseUrl || process.env.PUBLIC_APP_URL || 'https://noelux.shop')
    .trim()
    .replace(/\/+$/, '');
  const slug = String(params.productSlug || 'producto').trim();
  const qs = new URLSearchParams();
  qs.set('express', slug);
  qs.set('src', params.channel === 'messenger_dm' ? 'messenger' : 'comment_ai');
  qs.set('utm_source', 'facebook_comments');
  qs.set('utm_medium', 'ai_closer');
  if (params.adId) qs.set('ad_id', params.adId);
  if (params.adName) qs.set('ad_name', params.adName);
  if (params.adIndex) qs.set('ad_index', String(params.adIndex));
  if (params.campaignId) qs.set('campaign_id', params.campaignId);
  if (params.campaignName) qs.set('campaign_name', params.campaignName);
  if (params.postId) qs.set('post_id', params.postId);
  if (params.commentId) qs.set('comment_id', params.commentId);
  if (params.threadId) qs.set('thread_id', params.threadId);
  if (params.authorName) qs.set('author_name', params.authorName);
  return `${cleanBase}/?${qs.toString()}`;
}

export function extractAdIndexFromName(adName?: string): number | undefined {
  const raw = String(adName || '');
  const m =
    raw.match(/#\s*(\d+)/) ||
    raw.match(/\b(?:ad|anuncio)\s*[-#:]?\s*(\d+)\b/i) ||
    raw.match(/\bV(\d+)\b/i);
  if (m && Number(m[1]) > 0) return Number(m[1]);
  return undefined;
}

export function resolveProductForCommentContext(params: {
  products: ProductPage[];
  config: MetaCommentAutomationConfig;
  explicitProductId?: string;
  explicitProductSlug?: string;
  adId?: string;
  campaignId?: string;
  postId?: string;
  adName?: string;
  campaignName?: string;
  commentText?: string;
}): ProductPage | null {
  const { products, config } = params;
  if (!Array.isArray(products) || products.length === 0) return null;

  const findByIdOrSlug = (id?: string, slug?: string): ProductPage | undefined => {
    if (id) {
      const hit = products.find((p) => p.id === id);
      if (hit) return hit;
    }
    if (slug) {
      const cleanSlug = slug.toLowerCase();
      const hit = products.find((p) => String(p.slug || '').toLowerCase() === cleanSlug);
      if (hit) return hit;
    }
    return undefined;
  };

  if (params.explicitProductId || params.explicitProductSlug) {
    const direct = findByIdOrSlug(params.explicitProductId, params.explicitProductSlug);
    if (direct) return direct;
  }

  if (params.adId && config.adProductMap[params.adId]) {
    const m = config.adProductMap[params.adId];
    const hit = findByIdOrSlug(m.productId, m.productSlug);
    if (hit) return hit;
  }

  if (params.postId && config.postAdMap[params.postId]) {
    const pm = config.postAdMap[params.postId];
    const hit = findByIdOrSlug(pm.productId, pm.productSlug);
    if (hit) return hit;
    if (pm.adId && config.adProductMap[pm.adId]) {
      const am = config.adProductMap[pm.adId];
      const hit2 = findByIdOrSlug(am.productId, am.productSlug);
      if (hit2) return hit2;
    }
    if (pm.campaignId && config.campaignProductMap[pm.campaignId]) {
      const cm = config.campaignProductMap[pm.campaignId];
      const hit3 = findByIdOrSlug(cm.productId, cm.productSlug);
      if (hit3) return hit3;
    }
  }

  if (params.campaignId && config.campaignProductMap[params.campaignId]) {
    const cm = config.campaignProductMap[params.campaignId];
    const hit = findByIdOrSlug(cm.productId, cm.productSlug);
    if (hit) return hit;
  }

  // Coincidencia semántica por texto en nombre de campaña / anuncio / comentario
  const haystack = `${params.campaignName || ''} ${params.adName || ''} ${params.commentText || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (haystack.trim()) {
    let bestProd: ProductPage | null = null;
    let bestScore = 0;
    for (const p of products) {
      const tokens = `${p.nombre} ${p.slug}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[\s\-_™®]+/)
        .filter((t) => t.length >= 4 && !/^(noelux|para|con|pack|envio|gratis)$/.test(t));
      let score = 0;
      for (const tk of tokens) {
        if (haystack.includes(tk)) score += tk.length;
      }
      if (score > bestScore) {
        bestScore = score;
        bestProd = p;
      }
    }
    if (bestProd && bestScore >= 4) return bestProd;
  }

  return (
    findByIdOrSlug(config.defaultProductId, config.defaultProductSlug) ||
    products.find((p) => p.activo) ||
    products[0]
  );
}

export function buildUniversalProductKnowledgePrompt(product: ProductPage): string {
  const p1 = Number(product.precios?.[1] || product.precioNormal || 0);
  const p2 = Number(product.precios?.[2] || 0);
  const p3 = Number(product.precios?.[3] || 0);

  const lines: string[] = [
    `PRODUCTO OFICIAL SELECCIONADO:`,
    `- Nombre: ${product.nombre}`,
    `- Slug: ${product.slug}`,
    `- Descripción: ${product.descripcion || ''}`,
    `- Precio 1 unidad (Pack 1x): ${formatParaguayGs(p1)}`,
    ...(p2 > 0
      ? [
          `- Promo 2 unidades (Pack 2x): ${formatParaguayGs(p2)}${
            p1 * 2 > p2 ? ` (Ahorrás ${formatParaguayGs(p1 * 2 - p2)})` : ''
          }`
        ]
      : []),
    ...(p3 > 0 ? [`- Promo 3 unidades (Pack 3x): ${formatParaguayGs(p3)}`] : []),
    `- Modalidad de envío y cobro: ${
      product.freeShipping !== false
        ? 'ENVÍO GRATIS a todo Paraguay · Pagás en efectivo o transferencia RECIÉN AL RECIBIR en tu puerta (Contra Entrega COD, cero riesgo).'
        : `Envío a todo Paraguay (${formatParaguayGs(product.shippingCostGs || 0)}) · Pago Contra Entrega en puerta.`
    }`
  ];

  if (product.physicalTruth) {
    const pt = product.physicalTruth;
    lines.push(
      `VERDAD FÍSICA DEL PRODUCTO:`,
      `- Qué trae la caja: ${pt.boxContents || 'Unidad principal sellada'}`,
      ...(pt.powerSourceLabel || pt.powerSource
        ? [`- Alimentación/Energía: ${pt.powerSourceLabel || pt.powerSource}`]
        : []),
      ...(pt.realDimensions ? [`- Medidas reales: ${pt.realDimensions}`] : []),
      ...(pt.waterResistance ? [`- Resistencia: ${pt.waterResistance}`] : []),
      ...(pt.warrantyDays ? [`- Garantía escrita: ${pt.warrantyDays} días`] : [])
    );
  }

  if (product.tripwireConfig?.enabled && product.tripwireConfig.entryProductName) {
    const tc = product.tripwireConfig;
    const entryGs = Number(tc.entryPriceGs ?? tc.entryProductPriceGs ?? 20000);
    const delivGs = Number(tc.deliveryFeeGs ?? tc.entryDeliveryFeeGs ?? 40000);
    lines.push(
      `OFERTA DE ENTRADA CONGRUENTE (JAMÁS usar tecnicismos como "tripwire" con el cliente):`,
      `- Producto de entrada anunciado: ${tc.entryProductName}`,
      `- Descripción corta: ${tc.entryProductDescription || ''}`,
      `- Precio entrada solo: ${formatParaguayGs(entryGs)} (+ delivery de zona ${formatParaguayGs(delivGs)} si pide solo ese producto)`,
      `- Si lleva el Paquete Principal (${product.nombre}): este producto de entrada va incluido DE REGALO + ENVÍO GRATIS.`
    );
  }

  if (product.agentBrain) {
    const ab = product.agentBrain;
    lines.push(
      `CEREBRO COMERCIAL DEL PRODUCTO:`,
      ...(ab.shortProductSpoken ? [`- Resumen: ${ab.shortProductSpoken}`] : []),
      ...(ab.technicalSpecsSpoken ? [`- Ficha técnica: ${ab.technicalSpecsSpoken}`] : []),
      ...(ab.boxContentsSpoken ? [`- Contenido de caja: ${ab.boxContentsSpoken}`] : []),
      ...(ab.usageSummarySpoken ? [`- Cómo se usa: ${ab.usageSummarySpoken}`] : []),
      ...(ab.warrantySpoken ? [`- Garantía: ${ab.warrantySpoken}`] : []),
      ...(ab.upsellPack2PitchSpoken ? [`- Pitch Pack 2x: ${ab.upsellPack2PitchSpoken}`] : [])
    );
    if (Array.isArray(ab.faqQuickAnswers) && ab.faqQuickAnswers.length > 0) {
      lines.push(
        `- Respuestas rápidas FAQ:`,
        ...ab.faqQuickAnswers.slice(0, 6).map((f) => `  * ${f.topic}: ${f.answerSpoken}`)
      );
    }
  }

  if (product.landingContent) {
    const lc = product.landingContent;
    if (Array.isArray(lc.benefitCards) && lc.benefitCards.length > 0) {
      lines.push(
        `- Beneficios destacados: ${lc.benefitCards
          .slice(0, 4)
          .map((b) => `${b.title}: ${b.desc}`)
          .join(' | ')}`
      );
    }
    if (Array.isArray(lc.faqs) && lc.faqs.length > 0) {
      lines.push(
        `- FAQs clientes: ${lc.faqs
          .slice(0, 5)
          .map((f) => `P: ${f.q} -> R: ${f.a}`)
          .join(' | ')}`
      );
    }
  }

  if (product.contextoIA) {
    lines.push(`NOTAS EXTRA DEL VENDEDOR:\n${product.contextoIA.slice(0, 900)}`);
  }

  return lines.join('\n');
}

function parseStrictJsonObject(raw: string): any {
  const trimmed = String(raw || '').trim();
  if (!trimmed) throw new Error('OpenRouter devolvió respuesta vacía.');
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('La respuesta de OpenRouter no contiene JSON válido.');
  }
}

export async function callOpenRouterJson(params: {
  openRouterApiKey: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<any> {
  const apiKey = String(params.openRouterApiKey || '').trim();
  if (!apiKey) {
    throw new Error(
      'Falta OPENROUTER_API_KEY configurada. El agente de Comentarios Ads opera 100% con IA real de OpenRouter sin respuestas enlatadas.'
    );
  }

  const fetchFn = params.fetchImpl || fetch;
  const response = await fetchFn(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://noelux.app',
      'X-Title': 'Noelux Comentarios Ads IA Closer'
    },
    body: JSON.stringify({
      model: params.model || META_COMMENTS_LLM_MODEL,
      temperature: 0.55,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt }
      ]
    })
  });

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const errMsg = data?.error?.message || data?.message || `HTTP ${response.status}`;
    throw new Error(`Error OpenRouter (${response.status}): ${errMsg}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter no devolvió contenido en choices[0].message.content.');
  }
  return parseStrictJsonObject(String(content));
}

export async function generateCommentAndDmAiResponses(params: {
  openRouterApiKey: string;
  product: ProductPage;
  authorName: string;
  commentText: string;
  detectedPhones: string[];
  adName?: string;
  adSetName?: string;
  adCopy?: string;
  campaignName?: string;
  recentAnglesOnPost?: string[];
  expressFormUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  intent: MetaCommentThreadRecord['intent'];
  angleUsed: string;
  publicReply: string;
  privateDm: string;
  whatsappMessage?: string;
  shouldHideComment: boolean;
}> {
  const productContext = buildUniversalProductKnowledgePrompt(params.product);
  const firstName = String(params.authorName || 'amigo/a').trim().split(/\s+/)[0] || 'amigo/a';
  const hasPhone = params.detectedPhones.length > 0;
  const recentAngles = (params.recentAnglesOnPost || []).slice(0, 4).join(', ') || 'ninguno todavía';

  const systemPrompt = `Sos el Vendedor Closer #1 de Paraguay atendiendo comentarios PÚBLICOS en anuncios de Facebook/Instagram.
NO enviamos mensajes privados por Messenger DM ni decimos "te escribí al inbox/privado". TODA la venta y prueba social ocurre A LA VISTA DE TODOS en los comentarios públicos para crear efecto avalancha cuando otros lectores lean el hilo.

Reglas estrictas de conversión pública:
1. ESPAÑOL PARAGUAYO NATURAL Y HUMANO: Usá "¡Hola ${firstName}!" y trato cercano ("vos", "te"), cero frases robóticas ni corporativas.
2. VERDAD FÍSICA Y PRECIOS REALES: Respondé ÚNICAMENTE con los precios en Guaraníes (Gs.) y datos reales del producto. Jamás digas palabras técnicas como "tripwire".
3. MULTI-ÁNGULO PARA EFECTO AVALANCHA (MUY IMPORTANTE):
   - No repitas siempre la misma respuesta aburrida. Elegí un ángulo distinto a los recientes (${recentAngles}) que responda al usuario Y convenza a cualquiera que lea los comentarios después:
     * "precio_y_valor": Precio claro + por qué conviene frente a opciones baratas/descartables.
     * "cero_riesgo_contra_entrega": Destacá que revisa el paquete en mano antes de pagar en efectivo, QR o transferencia.
     * "prueba_social_vecinos": Contá con naturalidad cómo está saliendo todos los días para familias en Asunción, Central e interior.
     * "facilidad_inmediata": Explicá en 1 frase cómo queda funcionando en segundos sin complicaciones.
     * "escasez_real_hoy": Quedan pocas unidades de la tanda del día para entrega rápida en 24hs.
     * "gancho_y_completo": Si el producto tiene oferta de entrada + paquete principal completo, explicá con claridad ambos para que el lector entienda la oportunidad sin confusión.
4. ESTRUCTURA DEL COMENTARIO PÚBLICO ("publicReply", máximo 340 caracteres):
   - Saludá a ${firstName}, respondé directo su pregunta con un ángulo persuasivo distinto, e invitalo a confirmar en 30 segundos tocando el link directo: ${params.expressFormUrl}
   - Si el cliente dejó su celular en público (${hasPhone ? 'SÍ dejó teléfono' : 'NO dejó teléfono'}): agradecé rápido diciendo "Por tu seguridad ocultamos tu número de la vista pública, ¡ya te escribimos directo a tu WhatsApp para coordinar tu envío!"
5. Devolvé ÚNICAMENTE JSON válido:
   {
     "intent": "price_inquiry" | "buy_now" | "phone_drop" | "shipping_question" | "objection" | "other",
     "angleUsed": "precio_y_valor" | "cero_riesgo_contra_entrega" | "prueba_social_vecinos" | "facilidad_inmediata" | "escasez_real_hoy" | "gancho_y_completo",
     "publicReply": string,
     "whatsappMessage": string,
     "shouldHideComment": boolean
   }`;

  const userPrompt = `${productContext}

CONTEXTO EXACTO DEL ANUNCIO QUE VIO EL CLIENTE:
- Campaña: ${params.campaignName || 'Campaña Meta Ads'}
- Conjunto de Anuncios: ${params.adSetName || 'Público general'}
- Anuncio: ${params.adName || 'Anuncio principal'}
- Texto/Promesa del Anuncio: ${params.adCopy || '(Basado en el creativo visual del producto)'}
- Link directo de pedido (sin landing pesada): ${params.expressFormUrl}
- Ángulos ya usados recientemente en este anuncio (intentá variar): ${recentAngles}

COMENTARIO REAL DEL CLIENTE:
- Nombre: ${params.authorName || 'Cliente Facebook'}
- Comentario: "${params.commentText}"
- Teléfonos detectados: ${hasPhone ? params.detectedPhones.join(', ') : 'Ninguno'}

Generá una respuesta PÚBLICA magnética multi-ángulo que cierre al cliente y convenza a todos los demás lectores del anuncio${
    hasPhone ? ' + mensaje inicial cálido para su WhatsApp' : ''
  }.`;

  const parsed = await callOpenRouterJson({
    openRouterApiKey: params.openRouterApiKey,
    systemPrompt,
    userPrompt,
    fetchImpl: params.fetchImpl
  });

  const validIntents = new Set([
    'price_inquiry',
    'buy_now',
    'phone_drop',
    'shipping_question',
    'objection',
    'other'
  ]);
  const intent = validIntents.has(parsed?.intent)
    ? parsed.intent
    : hasPhone
    ? 'phone_drop'
    : 'price_inquiry';

  return {
    intent,
    angleUsed: String(parsed?.angleUsed || 'cero_riesgo_contra_entrega').trim(),
    publicReply: String(parsed?.publicReply || '').trim(),
    privateDm: '',
    whatsappMessage: parsed?.whatsappMessage ? String(parsed.whatsappMessage).trim() : undefined,
    shouldHideComment: typeof parsed?.shouldHideComment === 'boolean' ? parsed.shouldHideComment : hasPhone
  };
}

export async function generateMessengerChatReply(params: {
  openRouterApiKey: string;
  product: ProductPage;
  thread: MetaCommentThreadRecord;
  incomingText: string;
  expressFormUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  replyText: string;
  shouldSendExpressButton: boolean;
  extractedOrder?: {
    ready: boolean;
    nombre?: string;
    whatsapp?: string;
    ciudad?: string;
    direccion?: string;
    referencia?: string;
    pack?: 1 | 2 | 3;
  };
}> {
  const productContext = buildUniversalProductKnowledgePrompt(params.product);
  const history = params.thread.messages
    .slice(-10)
    .map((m) => `[${m.direction === 'inbound' ? 'CLIENTE' : 'VENDEDOR IA'} (${m.channel})]: ${m.text}`)
    .join('\n');

  const systemPrompt = `Sos un vendedor paraguayo experto cerrando ventas en chat privado de Facebook Messenger para el producto abajo indicado.
Objetivos:
- Respondé con empatía, tono cercano paraguayo ("vos", claro, cero presión agresiva) todas las preguntas del cliente (uso, garantía, precios 1x/2x/3x en Gs., pago al recibir, envío gratis a Asunción/Gran Asunción e interior).
- Llevá al cliente de la mano hacia el cierre:
  a) Si pregunta cómo pedir o muestra interés de compra, recomendale completar en 30 segundos su ubicación GPS en el Formulario Express directo (botón debajo del mensaje).
  b) Si el cliente prefiere pasarte sus datos ahí mismo en el chat (Nombre, Celular 09xx, Ciudad y Dirección/Referencia), agradecé y extraelos en JSON para registrar el pedido directo.
- Devolvé ÚNICAMENTE JSON válido:
  {
    "replyText": string,
    "shouldSendExpressButton": boolean,
    "extractedOrder": {
      "ready": boolean,
      "nombre": string,
      "whatsapp": string,
      "ciudad": string,
      "direccion": string,
      "referencia": string,
      "pack": 1 | 2 | 3
    }
  }`;

  const userPrompt = `${productContext}

URL FORMULARIO EXPRESS DIRECTO: ${params.expressFormUrl}
CLIENTE: ${params.thread.authorName}
COMENTARIO ORIGINAL EN ANUNCIO (${params.thread.adName || 'Ad'}): "${params.thread.commentText}"

HISTORIAL RECIENTE DEL CHAT:
${history || '(Primer mensaje)'}

NUEVO MENSAJE DEL CLIENTE EN MESSENGER:
"${params.incomingText}"`;

  const parsed = await callOpenRouterJson({
    openRouterApiKey: params.openRouterApiKey,
    systemPrompt,
    userPrompt,
    fetchImpl: params.fetchImpl
  });

  const ext = parsed?.extractedOrder;
  return {
    replyText: String(parsed?.replyText || '').trim(),
    shouldSendExpressButton:
      typeof parsed?.shouldSendExpressButton === 'boolean' ? parsed.shouldSendExpressButton : true,
    extractedOrder: ext && typeof ext === 'object' ? ext : undefined
  };
}

// Cache corto de tokens de página por session
const pageTokenCache = new Map<string, { pageToken: string; fetchedAt: number }>();

export async function resolveMetaPageAccessToken(params: {
  userAccessToken: string;
  pageId: string;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const token = String(params.userAccessToken || '').trim();
  const targetPageId = String(params.pageId || OFFICIAL_META_PAGE_ID).trim();
  if (!token) return null;

  const cached = pageTokenCache.get(`${targetPageId}:${token.slice(-12)}`);
  if (cached && Date.now() - cached.fetchedAt < 10 * 60 * 1000) {
    return cached.pageToken;
  }

  const fetchFn = params.fetchImpl || fetch;
  try {
    const res = await fetchFn(
      `${META_GRAPH_BASE}/me/accounts?fields=id,name,access_token&limit=25&access_token=${encodeURIComponent(token)}`
    );
    const json: any = await res.json().catch(() => ({}));
    const pages: any[] = Array.isArray(json?.data) ? json.data : [];
    const match = pages.find((p) => String(p?.id) === targetPageId) || pages[0];
    if (match?.access_token) {
      const pageToken = String(match.access_token).trim();
      pageTokenCache.set(`${targetPageId}:${token.slice(-12)}`, {
        pageToken,
        fetchedAt: Date.now()
      });
      return pageToken;
    }
  } catch {
    // Fallback below
  }
  return null;
}

export async function postMetaCommentReply(params: {
  commentId: string;
  message: string;
  pageAccessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; replyId?: string; error?: string }> {
  const fetchFn = params.fetchImpl || fetch;
  try {
    const url = `${META_GRAPH_BASE}/${encodeURIComponent(params.commentId)}/comments?access_token=${encodeURIComponent(
      params.pageAccessToken
    )}`;
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: params.message })
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.error) {
      return { ok: false, error: json?.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, replyId: json?.id ? String(json.id) : undefined };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de red enviando respuesta pública' };
  }
}

export async function setMetaCommentHidden(params: {
  commentId: string;
  isHidden: boolean;
  pageAccessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; error?: string }> {
  const fetchFn = params.fetchImpl || fetch;
  try {
    const url = `${META_GRAPH_BASE}/${encodeURIComponent(params.commentId)}?access_token=${encodeURIComponent(
      params.pageAccessToken
    )}`;
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_hidden: params.isHidden })
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.error || json?.success === false) {
      return { ok: false, error: json?.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error ocultando comentario' };
  }
}

export async function sendMetaMessengerMessage(params: {
  pageId: string;
  pageAccessToken: string;
  text: string;
  expressUrl?: string;
  commentId?: string;
  psid?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; messageId?: string; recipientId?: string; error?: string; modeUsed?: string }> {
  const fetchFn = params.fetchImpl || fetch;
  const pageId = String(params.pageId || OFFICIAL_META_PAGE_ID).trim();
  const recipient = params.psid
    ? { id: params.psid }
    : params.commentId
    ? { comment_id: params.commentId }
    : null;

  if (!recipient) {
    return { ok: false, error: 'Falta comment_id o PSID del cliente para enviar Messenger.' };
  }

  const endpoint = `${META_GRAPH_BASE}/${encodeURIComponent(pageId)}/messages?access_token=${encodeURIComponent(
    params.pageAccessToken
  )}`;

  // 1. Intentar con Messenger Button Template -> abre Formulario Express directo en WebView
  if (params.expressUrl) {
    try {
      const templatePayload = {
        recipient,
        ...(params.psid ? { messaging_type: 'RESPONSE' } : {}),
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: params.text.slice(0, 620),
              buttons: [
                {
                  type: 'web_url',
                  url: params.expressUrl,
                  title: '🚀 Completar Pedido Rápido',
                  webview_height_ratio: 'tall'
                }
              ]
            }
          }
        }
      };
      const res = await fetchFn(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templatePayload)
      });
      const json: any = await res.json().catch(() => ({}));
      if (res.ok && !json?.error && json?.message_id) {
        return {
          ok: true,
          messageId: String(json.message_id),
          recipientId: json?.recipient_id ? String(json.recipient_id) : undefined,
          modeUsed: 'button_template_webview'
        };
      }
    } catch {
      // Fallback to text message below
    }
  }

  // 2. Fallback automático: Mensaje de texto con enlace directo al Formulario Express
  const textWithUrl = params.expressUrl
    ? `${params.text}\n\n📦 Completá tu pedido rápido (30 seg) con Envío Gratis acá:\n${params.expressUrl}`
    : params.text;

  try {
    const res2 = await fetchFn(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient,
        ...(params.psid ? { messaging_type: 'RESPONSE' } : {}),
        message: { text: textWithUrl.slice(0, 1900) }
      })
    });
    const json2: any = await res2.json().catch(() => ({}));
    if (!res2.ok || json2?.error) {
      return { ok: false, error: json2?.error?.message || `HTTP ${res2.status}` };
    }
    return {
      ok: true,
      messageId: json2?.message_id ? String(json2.message_id) : undefined,
      recipientId: json2?.recipient_id ? String(json2.recipient_id) : undefined,
      modeUsed: 'text_with_express_link'
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de red enviando Messenger DM' };
  }
}

export function computeMetaAdCommentStats(
  state: MetaCommentsStoreState,
  orders: Order[] = []
): MetaCommentAdStats[] {
  const byAd = new Map<string, MetaCommentAdStats>();

  const ensureEntry = (seed: {
    adId?: string;
    adName?: string;
    adIndex?: number;
    adSetId?: string;
    adSetName?: string;
    campaignId?: string;
    campaignName?: string;
    postId?: string;
    adCopy?: string;
    adThumbnailUrl?: string;
    adStatus?: string;
    productId?: string;
    productSlug?: string;
    productName?: string;
    timestamp?: string;
  }): MetaCommentAdStats => {
    const adId = String(seed.adId || seed.postId || 'unattributed').trim();
    const key = adId || 'unattributed';
    let cur = byAd.get(key);
    if (!cur) {
      cur = {
        adKey: key,
        adId,
        adName: String(seed.adName || (seed.postId ? `Post ${seed.postId}` : 'Anuncio sin ID')),
        adIndex: seed.adIndex || extractAdIndexFromName(seed.adName),
        adSetId: seed.adSetId,
        adSetName: seed.adSetName,
        campaignId: seed.campaignId,
        campaignName: seed.campaignName,
        postId: seed.postId,
        adCopy: seed.adCopy,
        adThumbnailUrl: seed.adThumbnailUrl,
        adStatus: seed.adStatus || 'ACTIVE',
        productId: seed.productId,
        productSlug: seed.productSlug,
        productName: seed.productName,
        commentsCount: 0,
        publicRepliesCount: 0,
        dmSentCount: 0,
        activeChatsCount: 0,
        phonesCapturedCount: 0,
        closedOrdersCount: 0,
        revenuePyg: 0,
        conversionRatePct: 0,
        lastActivityAt: String(seed.timestamp || new Date().toISOString()),
        isWinner: false
      };
      byAd.set(key, cur);
    } else {
      if (!cur.campaignName && seed.campaignName) cur.campaignName = seed.campaignName;
      if (!cur.adSetName && seed.adSetName) cur.adSetName = seed.adSetName;
      if (!cur.adName && seed.adName) cur.adName = seed.adName;
      if (!cur.adCopy && seed.adCopy) cur.adCopy = seed.adCopy;
      if (!cur.adThumbnailUrl && seed.adThumbnailUrl) cur.adThumbnailUrl = seed.adThumbnailUrl;
      if (!cur.adStatus && seed.adStatus) cur.adStatus = seed.adStatus;
      if (!cur.adIndex && seed.adIndex) cur.adIndex = seed.adIndex;
      if (!cur.productName && seed.productName) cur.productName = seed.productName;
      if (seed.timestamp && new Date(seed.timestamp).getTime() > new Date(cur.lastActivityAt).getTime()) {
        cur.lastActivityAt = seed.timestamp;
      }
    }
    return cur;
  };

  for (const snap of state.config.activeAdsSnapshot || []) {
    ensureEntry({
      adId: snap.adId,
      adName: snap.adName,
      adIndex: snap.adIndex,
      adSetId: snap.adSetId,
      adSetName: snap.adSetName,
      campaignId: snap.campaignId,
      campaignName: snap.campaignName,
      postId: snap.postId,
      adCopy: snap.adCopy || snap.adHeadline,
      adThumbnailUrl: snap.adThumbnailUrl,
      adStatus: snap.adStatus,
      productId: snap.productId,
      productSlug: snap.productSlug,
      productName: snap.productName,
      timestamp: snap.updatedAt
    });
  }

  for (const postEntry of Object.values(state.config.postAdMap || {})) {
    ensureEntry({
      adId: postEntry.adId,
      adName: postEntry.adName,
      adIndex: postEntry.adIndex,
      adSetId: postEntry.adSetId,
      adSetName: postEntry.adSetName,
      campaignId: postEntry.campaignId,
      campaignName: postEntry.campaignName,
      postId: postEntry.postId,
      adCopy: postEntry.adCopy || postEntry.adHeadline,
      adThumbnailUrl: postEntry.adThumbnailUrl,
      adStatus: postEntry.adStatus,
      productId: postEntry.productId,
      productSlug: postEntry.productSlug,
      productName: postEntry.productName
    });
  }

  for (const thread of state.threads) {
    const entry = ensureEntry({
      adId: thread.adId,
      adName: thread.adName,
      adIndex: thread.adIndex,
      adSetId: thread.adSetId,
      adSetName: thread.adSetName,
      campaignId: thread.campaignId,
      campaignName: thread.campaignName,
      postId: thread.postId,
      adCopy: thread.adCopy,
      adThumbnailUrl: thread.adThumbnailUrl,
      productId: thread.productId,
      productSlug: thread.productSlug,
      productName: thread.productName,
      timestamp: thread.updatedAt || thread.createdAt
    });
    entry.commentsCount += 1;
    if (thread.publicRepliedAt || thread.publicReplyText) entry.publicRepliesCount += 1;
    if (thread.dmSentAt) entry.dmSentCount += 1;
    if (thread.messages.some((m) => m.direction === 'inbound' && m.channel.includes('dm'))) {
      entry.activeChatsCount += 1;
    }
    if (thread.detectedPhones.length > 0) entry.phonesCapturedCount += 1;
    if (thread.orderId) {
      entry.closedOrdersCount += 1;
      entry.revenuePyg += Number(thread.orderTotalPyg || 0);
    }
  }

  // Reconciliar pedidos reales guardados en pedidos.json con metaCommentOrigin
  const countedOrderIds = new Set(
    state.threads.filter((t) => Boolean(t.orderId)).map((t) => String(t.orderId))
  );
  for (const ord of orders) {
    if (!ord?.metaCommentOrigin || ord.metaCommentOrigin.source !== 'meta_comment_ai') continue;
    const ordId = String(ord.reservaid || '');
    if (ordId && countedOrderIds.has(ordId)) continue;
    countedOrderIds.add(ordId);
    const origin = ord.metaCommentOrigin;
    const entry = ensureEntry({
      adId: origin.adId || ord.attributedAdId,
      adName: origin.adName,
      adIndex: origin.adIndex,
      campaignId: origin.campaignId || ord.attributedCampaignId,
      campaignName: origin.campaignName,
      postId: origin.postId,
      productId: ord.productoId,
      productName: ord.producto,
      timestamp: ord.fecha
    });
    entry.closedOrdersCount += 1;
    entry.revenuePyg += Number((ord as any).monto ?? (ord as any).precioTotal ?? 0);
  }

  const list = Array.from(byAd.values()).map((row) => ({
    ...row,
    conversionRatePct:
      row.commentsCount > 0 ? Math.round((row.closedOrdersCount / row.commentsCount) * 1000) / 10 : 0
  }));

  list.sort((a, b) => {
    if (b.closedOrdersCount !== a.closedOrdersCount) return b.closedOrdersCount - a.closedOrdersCount;
    if (b.revenuePyg !== a.revenuePyg) return b.revenuePyg - a.revenuePyg;
    if (b.phonesCapturedCount !== a.phonesCapturedCount) return b.phonesCapturedCount - a.phonesCapturedCount;
    return b.commentsCount - a.commentsCount;
  });

  if (list.length > 0 && (list[0].closedOrdersCount > 0 || list[0].commentsCount > 0)) {
    list[0].isWinner = true;
  }

  return list;
}

export async function processInboundMetaComment(params: {
  commentId: string;
  parentCommentId?: string;
  postId: string;
  pageId: string;
  authorId?: string;
  authorName: string;
  commentText: string;
  platform?: 'facebook' | 'instagram';
  adId?: string;
  adName?: string;
  adIndex?: number;
  adSetId?: string;
  adSetName?: string;
  adCopy?: string;
  adThumbnailUrl?: string;
  campaignId?: string;
  campaignName?: string;
  explicitProductId?: string;
  explicitProductSlug?: string;
  products: ProductPage[];
  openRouterApiKey: string;
  pageAccessToken?: string | null;
  publicBaseUrl?: string;
  isSimulation?: boolean;
  executeMetaActions?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{
  thread: MetaCommentThreadRecord;
  createdNew: boolean;
  actionsTaken: string[];
  errors: string[];
}> {
  const state = loadMetaCommentsState(params.products);
  const actionsTaken: string[] = [];
  const errors: string[] = [];

  const existing = state.threads.find((t) => t.commentId === params.commentId);
  if (existing) {
    return { thread: existing, createdNew: false, actionsTaken: ['already_exists'], errors };
  }

  const mappedPost = state.config.postAdMap[params.postId];
  const resolvedAdId = params.adId || mappedPost?.adId || '';
  const resolvedAdName = params.adName || mappedPost?.adName || (resolvedAdId ? `Anuncio ${resolvedAdId.slice(-6)}` : 'Anuncio Meta');
  const resolvedAdIndex =
    params.adIndex || mappedPost?.adIndex || extractAdIndexFromName(resolvedAdName);
  const resolvedAdSetId = params.adSetId || mappedPost?.adSetId || '';
  const resolvedAdSetName = params.adSetName || mappedPost?.adSetName || '';
  const resolvedAdCopy = params.adCopy || mappedPost?.adCopy || mappedPost?.adHeadline || '';
  const resolvedAdThumb = params.adThumbnailUrl || mappedPost?.adThumbnailUrl || '';
  const resolvedCampaignId = params.campaignId || mappedPost?.campaignId || '';
  const resolvedCampaignName = params.campaignName || mappedPost?.campaignName || '';

  const product = resolveProductForCommentContext({
    products: params.products,
    config: state.config,
    explicitProductId: params.explicitProductId,
    explicitProductSlug: params.explicitProductSlug,
    adId: resolvedAdId,
    campaignId: resolvedCampaignId,
    postId: params.postId,
    adName: resolvedAdName,
    campaignName: resolvedCampaignName,
    commentText: params.commentText
  });

  if (!product) {
    throw new Error('No hay ningún producto configurado en la tienda para atender el comentario.');
  }

  const threadId = `mc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const detectedPhones = detectParaguayPhonesInText(params.commentText);
  const effectiveBaseUrl =
    params.publicBaseUrl || state.config.publicBaseUrl || process.env.PUBLIC_APP_URL || 'https://noelux.shop';

  const expressFormUrl = buildExpressCheckoutUrl({
    baseUrl: effectiveBaseUrl,
    productSlug: product.slug,
    productId: product.id,
    adId: resolvedAdId,
    adName: resolvedAdName,
    adIndex: resolvedAdIndex,
    campaignId: resolvedCampaignId,
    campaignName: resolvedCampaignName,
    postId: params.postId,
    commentId: params.commentId,
    threadId,
    authorName: params.authorName,
    channel: 'facebook_comment'
  });

  const recentAnglesOnPost = state.threads
    .filter((t) => (resolvedAdId ? t.adId === resolvedAdId : t.postId === params.postId) && t.angleUsed)
    .slice(0, 4)
    .map((t) => String(t.angleUsed));

  const now = new Date().toISOString();
  const thread: MetaCommentThreadRecord = {
    id: threadId,
    postId: params.postId,
    commentId: params.commentId,
    parentCommentId: params.parentCommentId,
    platform: params.platform || 'facebook',
    pageId: params.pageId || OFFICIAL_META_PAGE_ID,
    adId: resolvedAdId || undefined,
    adName: resolvedAdName,
    adIndex: resolvedAdIndex,
    adSetId: resolvedAdSetId || undefined,
    adSetName: resolvedAdSetName || undefined,
    adCopy: resolvedAdCopy || undefined,
    adThumbnailUrl: resolvedAdThumb || undefined,
    campaignId: resolvedCampaignId || undefined,
    campaignName: resolvedCampaignName || undefined,
    productId: product.id,
    productSlug: product.slug,
    productName: product.nombre,
    authorId: params.authorId,
    authorName: params.authorName || 'Cliente Meta',
    commentText: params.commentText,
    detectedPhones,
    hiddenFromPublic: false,
    expressFormUrl,
    status: 'new',
    messages: [
      {
        id: `msg_${Date.now()}_in`,
        direction: 'inbound',
        channel: params.platform === 'instagram' ? 'instagram_comment' : 'facebook_comment',
        text: params.commentText,
        createdAt: now,
        by: 'customer'
      }
    ],
    isSimulation: Boolean(params.isSimulation),
    createdAt: now,
    updatedAt: now
  };

  // Llamada 100% IA pura OpenRouter para respuesta PÚBLICA multi-ángulo (sin Messenger DM)
  const aiResult = await generateCommentAndDmAiResponses({
    openRouterApiKey: params.openRouterApiKey,
    product,
    authorName: thread.authorName,
    commentText: thread.commentText,
    detectedPhones,
    adName: resolvedAdName,
    adSetName: resolvedAdSetName,
    adCopy: resolvedAdCopy,
    campaignName: resolvedCampaignName,
    recentAnglesOnPost,
    expressFormUrl,
    fetchImpl: params.fetchImpl
  });

  thread.intent = aiResult.intent;
  thread.angleUsed = aiResult.angleUsed;
  const shouldExecuteReal = Boolean(params.executeMetaActions && !params.isSimulation && params.pageAccessToken);

  // 1. Ocultar comentario si dejó su teléfono (protección anti-competencia)
  if (detectedPhones.length > 0 && state.config.autoHidePhoneComments && aiResult.shouldHideComment) {
    if (shouldExecuteReal && params.pageAccessToken) {
      const hideRes = await setMetaCommentHidden({
        commentId: params.commentId,
        isHidden: true,
        pageAccessToken: params.pageAccessToken,
        fetchImpl: params.fetchImpl
      });
      if (hideRes.ok) {
        thread.hiddenFromPublic = true;
        actionsTaken.push('comment_hidden_live');
      } else if (hideRes.error) {
        errors.push(`No se pudo ocultar en Meta: ${hideRes.error}`);
      }
    } else if (params.isSimulation) {
      thread.hiddenFromPublic = true;
      actionsTaken.push('comment_hidden_simulated');
    }
  }

  // 2. Respuesta pública multi-ángulo (Efecto avalancha debajo del anuncio — ÚNICO canal en Meta)
  if (state.config.autoPublicReply && aiResult.publicReply) {
    thread.publicReplyText = aiResult.publicReply;
    let sentLive = false;
    let replyId: string | undefined;
    if (shouldExecuteReal && params.pageAccessToken) {
      const pubRes = await postMetaCommentReply({
        commentId: params.commentId,
        message: aiResult.publicReply,
        pageAccessToken: params.pageAccessToken,
        fetchImpl: params.fetchImpl
      });
      if (pubRes.ok) {
        sentLive = true;
        replyId = pubRes.replyId;
        actionsTaken.push('public_reply_sent_live');
      } else if (pubRes.error) {
        errors.push(`Error respuesta pública Meta: ${pubRes.error}`);
      }
    } else if (params.isSimulation) {
      actionsTaken.push('public_reply_generated_ai');
    }
    thread.publicReplyId = replyId;
    thread.publicRepliedAt = new Date().toISOString();
    thread.status = 'public_replied';
    thread.messages.push({
      id: `msg_${Date.now()}_pub`,
      direction: 'outbound',
      channel: params.platform === 'instagram' ? 'instagram_comment' : 'facebook_comment',
      text: aiResult.publicReply,
      createdAt: thread.publicRepliedAt,
      by: 'ai_public',
      sentToMeta: sentLive,
      metaMessageId: replyId,
      expressUrl: expressFormUrl
    });
  }

  // 3. Messenger DM descartado por diseño (modo 100% comentarios públicos + WhatsApp directo)

  // 4. WhatsApp directo si dejó su número de teléfono real en el comentario
  if (detectedPhones.length > 0 && state.config.autoWhatsappOnPhone && !params.isSimulation) {
    const waText =
      aiResult.whatsappMessage ||
      `¡Hola ${thread.authorName.split(' ')[0]}! Vi tu comentario sobre ${product.nombre}. Te atiendo por aquí directo: ${expressFormUrl}`;
    try {
      const waRes = await sendWhatsAppMessage(detectedPhones[0], waText, 'admin');
      if (waRes.sentViaSocket) {
        thread.whatsappNotifiedAt = new Date().toISOString();
        thread.messages.push({
          id: `msg_${Date.now()}_wa`,
          direction: 'outbound',
          channel: 'messenger_dm',
          text: `[WhatsApp enviado a +${detectedPhones[0]}] ${waText}`,
          createdAt: thread.whatsappNotifiedAt,
          by: 'whatsapp',
          sentToMeta: true
        });
        actionsTaken.push('whatsapp_sent_live');
      }
    } catch (waErr: any) {
      errors.push(`WhatsApp no conectado: ${waErr?.message || 'sin sesión activa'}`);
    }
  } else if (detectedPhones.length > 0 && params.isSimulation) {
    const waText = aiResult.whatsappMessage || aiResult.privateDm;
    thread.whatsappNotifiedAt = new Date().toISOString();
    thread.messages.push({
      id: `msg_${Date.now()}_wasim`,
      direction: 'outbound',
      channel: 'messenger_dm',
      text: `[Simulación WhatsApp -> +${detectedPhones[0]}] ${waText}`,
      createdAt: thread.whatsappNotifiedAt,
      by: 'whatsapp',
      sentToMeta: false
    });
    actionsTaken.push('whatsapp_simulated');
  }

  state.threads.unshift(thread);
  saveMetaCommentsState(state);

  return { thread, createdNew: true, actionsTaken, errors };
}

export async function processInboundMessengerDm(params: {
  senderPsid: string;
  recipientPageId: string;
  messageText: string;
  referralAdId?: string;
  products: ProductPage[];
  openRouterApiKey: string;
  pageAccessToken?: string | null;
  publicBaseUrl?: string;
  executeMetaActions?: boolean;
  isSimulation?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{
  thread: MetaCommentThreadRecord;
  replyText: string;
  sentToMeta: boolean;
  extractedOrder?: any;
  error?: string;
}> {
  const state = loadMetaCommentsState(params.products);
  const fetchFn = params.fetchImpl || fetch;

  let thread =
    state.threads.find((t) => t.psid && t.psid === params.senderPsid) ||
    state.threads.find((t) => t.authorId && t.authorId === params.senderPsid);

  let authorName = thread?.authorName || 'Cliente Messenger';
  if (!thread && params.pageAccessToken && !params.isSimulation) {
    try {
      const profRes = await fetchFn(
        `${META_GRAPH_BASE}/${encodeURIComponent(params.senderPsid)}?fields=name,first_name,last_name&access_token=${encodeURIComponent(
          params.pageAccessToken
        )}`
      );
      const profJson: any = await profRes.json().catch(() => ({}));
      if (profJson?.name) authorName = String(profJson.name);
    } catch {}
  }

  if (!thread) {
    const prod = resolveProductForCommentContext({
      products: params.products,
      config: state.config,
      adId: params.referralAdId
    });
    if (!prod) {
      throw new Error('No hay producto disponible para atender DM en Messenger.');
    }
    const threadId = `mc_dm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const expressUrl = buildExpressCheckoutUrl({
      baseUrl: params.publicBaseUrl || state.config.publicBaseUrl || process.env.PUBLIC_APP_URL,
      productSlug: prod.slug,
      productId: prod.id,
      adId: params.referralAdId,
      threadId,
      authorName,
      channel: 'messenger_dm'
    });
    const now = new Date().toISOString();
    thread = {
      id: threadId,
      postId: params.referralAdId ? `ad_${params.referralAdId}` : 'messenger_direct',
      commentId: threadId,
      platform: 'facebook',
      pageId: params.recipientPageId || OFFICIAL_META_PAGE_ID,
      adId: params.referralAdId,
      adName: params.referralAdId ? `Anuncio ${params.referralAdId.slice(-6)}` : 'Messenger Directo Ads',
      productId: prod.id,
      productSlug: prod.slug,
      productName: prod.nombre,
      authorId: params.senderPsid,
      authorName,
      psid: params.senderPsid,
      commentText: params.messageText,
      detectedPhones: detectParaguayPhonesInText(params.messageText),
      hiddenFromPublic: false,
      expressFormUrl: expressUrl,
      status: 'dm_active',
      messages: [],
      isSimulation: Boolean(params.isSimulation),
      createdAt: now,
      updatedAt: now
    };
    state.threads.unshift(thread);
  }

  const detectedPhones = detectParaguayPhonesInText(params.messageText);
  if (detectedPhones.length > 0) {
    thread.detectedPhones = Array.from(new Set([...thread.detectedPhones, ...detectedPhones]));
  }

  const nowIn = new Date().toISOString();
  thread.messages.push({
    id: `msg_${Date.now()}_in_dm`,
    direction: 'inbound',
    channel: 'messenger_dm',
    text: params.messageText,
    createdAt: nowIn,
    by: 'customer'
  });
  thread.status = 'dm_active';
  thread.updatedAt = nowIn;

  const prod =
    resolveProductForCommentContext({
      products: params.products,
      config: state.config,
      explicitProductId: thread.productId,
      explicitProductSlug: thread.productSlug,
      adId: thread.adId,
      campaignId: thread.campaignId,
      postId: thread.postId
    }) || params.products[0];

  const expressUrl =
    thread.expressFormUrl ||
    buildExpressCheckoutUrl({
      baseUrl: params.publicBaseUrl || state.config.publicBaseUrl || process.env.PUBLIC_APP_URL,
      productSlug: prod.slug,
      productId: prod.id,
      adId: thread.adId,
      adName: thread.adName,
      adIndex: thread.adIndex,
      campaignId: thread.campaignId,
      campaignName: thread.campaignName,
      postId: thread.postId,
      commentId: thread.commentId,
      threadId: thread.id,
      authorName: thread.authorName,
      channel: 'messenger_dm'
    });
  thread.expressFormUrl = expressUrl;

  const aiReply = await generateMessengerChatReply({
    openRouterApiKey: params.openRouterApiKey,
    product: prod,
    thread,
    incomingText: params.messageText,
    expressFormUrl: expressUrl,
    fetchImpl: params.fetchImpl
  });

  let sentToMeta = false;
  let error: string | undefined;
  let metaMsgId: string | undefined;

  if (state.config.autoPrivateDm && aiReply.replyText) {
    if (params.executeMetaActions && !params.isSimulation && params.pageAccessToken) {
      const sendRes = await sendMetaMessengerMessage({
        pageId: thread.pageId,
        pageAccessToken: params.pageAccessToken,
        text: aiReply.replyText,
        expressUrl: aiReply.shouldSendExpressButton ? expressUrl : undefined,
        psid: params.senderPsid,
        fetchImpl: params.fetchImpl
      });
      sentToMeta = sendRes.ok;
      metaMsgId = sendRes.messageId;
      error = sendRes.error;
    }

    const nowOut = new Date().toISOString();
    thread.dmSentAt = nowOut;
    thread.updatedAt = nowOut;
    if (aiReply.shouldSendExpressButton && thread.status !== 'order_closed') {
      thread.status = 'form_sent';
    }
    thread.messages.push({
      id: `msg_${Date.now()}_out_dm`,
      direction: 'outbound',
      channel: 'messenger_dm',
      text: aiReply.replyText,
      createdAt: nowOut,
      by: 'ai_dm',
      sentToMeta,
      metaMessageId: metaMsgId,
      expressUrl: aiReply.shouldSendExpressButton ? expressUrl : undefined
    });
  }

  saveMetaCommentsState(state);
  return {
    thread,
    replyText: aiReply.replyText,
    sentToMeta,
    extractedOrder: aiReply.extractedOrder,
    error
  };
}

export function linkOrderToMetaCommentThread(params: {
  order: Order;
  products: ProductPage[];
}): { linked: boolean; threadId?: string; adKey?: string } {
  const origin = params.order?.metaCommentOrigin;
  if (!origin || origin.source !== 'meta_comment_ai') {
    return { linked: false };
  }

  const state = loadMetaCommentsState(params.products);
  const now = new Date().toISOString();
  const thread =
    (origin.threadId && state.threads.find((t) => t.id === origin.threadId)) ||
    (origin.commentId && state.threads.find((t) => t.commentId === origin.commentId)) ||
    null;

  if (thread) {
    thread.status = 'order_closed';
    thread.orderId = params.order.reservaid;
    thread.orderTotalPyg = Number((params.order as any).monto ?? (params.order as any).precioTotal ?? 0);
    thread.updatedAt = now;
    if (!thread.productId && params.order.productoId) {
      thread.productId = params.order.productoId;
      thread.productName = params.order.producto;
    }
  }

  const adKey = String(origin.adId || origin.postId || 'unattributed').trim();
  if (adKey) {
    const prev = state.adAttributionStats[adKey] || {
      adId: String(origin.adId || adKey),
      adName: String(origin.adName || thread?.adName || `Anuncio ${adKey.slice(-6)}`),
      adIndex: origin.adIndex || thread?.adIndex,
      campaignId: origin.campaignId || thread?.campaignId,
      campaignName: origin.campaignName || thread?.campaignName,
      postId: origin.postId || thread?.postId,
      productId: params.order.productoId || thread?.productId,
      productSlug: thread?.productSlug,
      productName: params.order.producto || thread?.productName,
      closedOrdersCount: 0,
      revenuePyg: 0,
      orderIds: []
    };
    const ordId = String(params.order.reservaid || '');
    if (ordId && !prev.orderIds.includes(ordId)) {
      prev.orderIds.push(ordId);
      prev.closedOrdersCount += 1;
      prev.revenuePyg += Number((params.order as any).monto ?? (params.order as any).precioTotal ?? 0);
      prev.lastOrderAt = now;
    }
    state.adAttributionStats[adKey] = prev;
  }

  saveMetaCommentsState(state);
  return { linked: true, threadId: thread?.id, adKey };
}

export async function syncMetaAdPostsAndComments(params: {
  userAccessToken: string;
  adAccountId?: string;
  pageId?: string;
  products: ProductPage[];
  openRouterApiKey: string;
  publicBaseUrl?: string;
  processWithAi?: boolean;
  maxCommentsPerPost?: number;
  fetchImpl?: typeof fetch;
}): Promise<{
  ok: boolean;
  pageName?: string;
  adsMapped: number;
  activeAdsCount: number;
  postsScanned: number;
  newCommentsProcessed: number;
  commentsFound: number;
  errors: string[];
}> {
  const fetchFn = params.fetchImpl || fetch;
  const pageId = String(params.pageId || OFFICIAL_META_PAGE_ID).trim();
  const adAccountId = String(params.adAccountId || OFFICIAL_META_AD_ACCOUNT_ID).trim();
  const state = loadMetaCommentsState(params.products);
  const errors: string[] = [];

  const pageToken = await resolveMetaPageAccessToken({
    userAccessToken: params.userAccessToken,
    pageId,
    fetchImpl: fetchFn
  });

  if (!pageToken) {
    return {
      ok: false,
      adsMapped: Object.keys(state.config.postAdMap).length,
      activeAdsCount: 0,
      postsScanned: 0,
      newCommentsProcessed: 0,
      commentsFound: 0,
      errors: [
        `No se pudo obtener Page Access Token para la página ${pageId}. Reconectá Facebook con permiso pages_manage_engagement.`
      ]
    };
  }

  // 1. Traer Anuncios reales (priorizando ACTIVE) con Campaña, Conjunto y Copy/Miniatura del Creativo
  const postToAdTemp = new Map<
    string,
    {
      postId: string;
      adId: string;
      adName: string;
      adIndex?: number;
      adStatus?: string;
      adSetId?: string;
      adSetName?: string;
      campaignId?: string;
      campaignName?: string;
      adCopy?: string;
      adHeadline?: string;
      adThumbnailUrl?: string;
    }
  >();
  const activeAdsSnapshots: NonNullable<MetaCommentAutomationConfig['activeAdsSnapshot']> = [];

  try {
    const normAcc = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const filtering = encodeURIComponent(JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PENDING_REVIEW', 'PREAPPROVED', 'PAUSED'] }]));
    const adsUrl = `${META_GRAPH_BASE}/${encodeURIComponent(
      normAcc
    )}/ads?fields=id,name,effective_status,status,adset{id,name},campaign{id,name},creative{id,name,title,body,thumbnail_url,image_url,effective_object_story_id,object_story_id,object_story_spec}&filtering=${filtering}&limit=60&access_token=${encodeURIComponent(
      params.userAccessToken
    )}`;
    const adsRes = await fetchFn(adsUrl);
    const adsJson: any = await adsRes.json().catch(() => ({}));
    if (Array.isArray(adsJson?.data)) {
      let idx = 1;
      for (const ad of adsJson.data) {
        const storyId = String(
          ad?.creative?.effective_object_story_id || ad?.creative?.object_story_id || ''
        ).trim();
        const effStatus = String(ad?.effective_status || ad?.status || 'ACTIVE').toUpperCase();
        const adName = String(ad?.name || ad?.creative?.name || `Anuncio #${idx}`);
        const adCopy = String(
          ad?.creative?.body ||
            ad?.creative?.object_story_spec?.link_data?.message ||
            ad?.creative?.object_story_spec?.video_data?.message ||
            ''
        ).trim();
        const adHeadline = String(
          ad?.creative?.title ||
            ad?.creative?.object_story_spec?.link_data?.name ||
            ad?.creative?.object_story_spec?.video_data?.title ||
            ''
        ).trim();
        const adThumbnailUrl = String(
          ad?.creative?.image_url ||
            ad?.creative?.thumbnail_url ||
            ad?.creative?.object_story_spec?.link_data?.picture ||
            ''
        ).trim();

        const resolvedProd = resolveProductForCommentContext({
          products: params.products,
          config: state.config,
          adId: String(ad.id),
          campaignId: ad?.campaign?.id ? String(ad.campaign.id) : undefined,
          postId: storyId || undefined,
          adName,
          campaignName: ad?.campaign?.name ? String(ad.campaign.name) : undefined,
          commentText: `${adCopy} ${adHeadline}`
        });

        const snap = {
          adId: String(ad.id),
          adName,
          adIndex: extractAdIndexFromName(adName) || idx,
          adStatus: effStatus,
          adSetId: ad?.adset?.id ? String(ad.adset.id) : undefined,
          adSetName: ad?.adset?.name ? String(ad.adset.name) : undefined,
          campaignId: ad?.campaign?.id ? String(ad.campaign.id) : undefined,
          campaignName: ad?.campaign?.name ? String(ad.campaign.name) : undefined,
          postId: storyId || undefined,
          adCopy: adCopy || undefined,
          adHeadline: adHeadline || undefined,
          adThumbnailUrl: adThumbnailUrl || undefined,
          productId: resolvedProd?.id,
          productSlug: resolvedProd?.slug,
          productName: resolvedProd?.nombre,
          updatedAt: new Date().toISOString()
        };
        if (effStatus === 'ACTIVE' || effStatus === 'PENDING_REVIEW' || effStatus === 'PREAPPROVED') {
          activeAdsSnapshots.push(snap);
        }

        if (storyId) {
          const mapped = {
            postId: storyId,
            adId: String(ad.id),
            adName,
            adIndex: snap.adIndex,
            adStatus: effStatus,
            adSetId: snap.adSetId,
            adSetName: snap.adSetName,
            campaignId: snap.campaignId,
            campaignName: snap.campaignName,
            adCopy: snap.adCopy,
            adHeadline: snap.adHeadline,
            adThumbnailUrl: snap.adThumbnailUrl
          };
          postToAdTemp.set(storyId, mapped);
          const existingMap = state.config.postAdMap[storyId] || {};
          state.config.postAdMap[storyId] = {
            ...existingMap,
            ...mapped,
            productId: existingMap.productId || resolvedProd?.id,
            productSlug: existingMap.productSlug || resolvedProd?.slug,
            productName: existingMap.productName || resolvedProd?.nombre
          };
        }
        idx++;
      }
    } else if (adsJson?.error) {
      errors.push(`Ads lookup: ${adsJson.error.message}`);
    }
  } catch (err: any) {
    errors.push(`Error consultando Ads: ${err?.message || 'unknown'}`);
  }

  if (activeAdsSnapshots.length > 0) {
    state.config.activeAdsSnapshot = activeAdsSnapshots;
  }

  // 2. Complementar con promotable_posts de la Página (dark posts recientes + orgánicos)
  const postsToInspect = new Set<string>(Array.from(postToAdTemp.keys()));
  try {
    const promoUrl = `${META_GRAPH_BASE}/${encodeURIComponent(
      pageId
    )}/promotable_posts?fields=id,message,created_time,is_published&limit=20&access_token=${encodeURIComponent(
      pageToken
    )}`;
    const promoRes = await fetchFn(promoUrl);
    const promoJson: any = await promoRes.json().catch(() => ({}));
    if (Array.isArray(promoJson?.data)) {
      for (const p of promoJson.data) {
        if (p?.id) postsToInspect.add(String(p.id));
      }
    }
  } catch {}

  let postsScanned = 0;
  let commentsFound = 0;
  let newCommentsProcessed = 0;
  const maxPerPost = params.maxCommentsPerPost || 20;

  for (const postId of Array.from(postsToInspect).slice(0, 30)) {
    postsScanned += 1;
    try {
      const cUrl = `${META_GRAPH_BASE}/${encodeURIComponent(
        postId
      )}/comments?fields=id,message,created_time,from,is_hidden,parent,comments.limit(5){id,message,created_time,from,is_hidden}&filter=stream&order=reverse_chronological&limit=${maxPerPost}&access_token=${encodeURIComponent(
        pageToken
      )}`;
      const cRes = await fetchFn(cUrl);
      const cJson: any = await cRes.json().catch(() => ({}));
      if (cJson?.error) {
        errors.push(`Post ${postId}: ${cJson.error.message}`);
        continue;
      }

      const rawComments: any[] = Array.isArray(cJson?.data) ? cJson.data : [];
      // Aplanar comentarios raíz + sub-respuestas de clientes (ignorando respuestas de la propia página)
      const flattenedComments: Array<{ item: any; parentCommentId?: string }> = [];
      for (const c of rawComments) {
        flattenedComments.push({ item: c });
        const subRows: any[] = Array.isArray(c?.comments?.data) ? c.comments.data : [];
        for (const sub of subRows) {
          flattenedComments.push({ item: sub, parentCommentId: String(c?.id || '') });
        }
      }

      for (const { item: c, parentCommentId } of flattenedComments) {
        const cid = String(c?.id || '').trim();
        const msg = String(c?.message || '').trim();
        const fromId = String(c?.from?.id || '').trim();
        const fromName = String(c?.from?.name || 'Cliente Facebook').trim();
        if (!cid || !msg) continue;
        // Nunca responder a comentarios propios de nuestra FanPage ni a comentarios de nuestra propia respuesta
        if (fromId && fromId === pageId) continue;
        const alreadyKnownPageReply = state.threads.some((t) => t.publicReplyId === cid);
        if (alreadyKnownPageReply) continue;

        commentsFound += 1;
        const already = state.threads.find((t) => t.commentId === cid);
        if (already) continue;

        const adMeta = state.config.postAdMap[postId];
        if (params.processWithAi !== false && state.config.enabled && params.openRouterApiKey) {
          const procRes = await processInboundMetaComment({
            commentId: cid,
            parentCommentId,
            postId,
            pageId,
            authorId: fromId || undefined,
            authorName: fromName,
            commentText: msg,
            platform: 'facebook',
            adId: adMeta?.adId,
            adName: adMeta?.adName,
            adIndex: adMeta?.adIndex,
            adSetId: adMeta?.adSetId,
            adSetName: adMeta?.adSetName,
            adCopy: adMeta?.adCopy || adMeta?.adHeadline,
            adThumbnailUrl: adMeta?.adThumbnailUrl,
            campaignId: adMeta?.campaignId,
            campaignName: adMeta?.campaignName,
            products: params.products,
            openRouterApiKey: params.openRouterApiKey,
            pageAccessToken: pageToken,
            publicBaseUrl: params.publicBaseUrl,
            executeMetaActions: true,
            isSimulation: false,
            fetchImpl: fetchFn
          });
          if (procRes.createdNew) newCommentsProcessed += 1;
          if (procRes.errors.length > 0) errors.push(...procRes.errors);
        } else {
          const prod = resolveProductForCommentContext({
            products: params.products,
            config: state.config,
            adId: adMeta?.adId,
            campaignId: adMeta?.campaignId,
            postId,
            adName: adMeta?.adName,
            campaignName: adMeta?.campaignName,
            commentText: msg
          });
          const tid = `mc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const now = new Date().toISOString();
          state.threads.unshift({
            id: tid,
            postId,
            commentId: cid,
            parentCommentId,
            platform: 'facebook',
            pageId,
            adId: adMeta?.adId,
            adName: adMeta?.adName || `Post ${postId}`,
            adIndex: adMeta?.adIndex,
            adSetId: adMeta?.adSetId,
            adSetName: adMeta?.adSetName,
            adCopy: adMeta?.adCopy || adMeta?.adHeadline,
            adThumbnailUrl: adMeta?.adThumbnailUrl,
            campaignId: adMeta?.campaignId,
            campaignName: adMeta?.campaignName,
            productId: prod?.id,
            productSlug: prod?.slug,
            productName: prod?.nombre,
            authorId: fromId || undefined,
            authorName: fromName,
            commentText: msg,
            detectedPhones: detectParaguayPhonesInText(msg),
            hiddenFromPublic: Boolean(c?.is_hidden),
            expressFormUrl: prod
              ? buildExpressCheckoutUrl({
                  baseUrl: params.publicBaseUrl || state.config.publicBaseUrl,
                  productSlug: prod.slug,
                  adId: adMeta?.adId,
                  adName: adMeta?.adName,
                  adIndex: adMeta?.adIndex,
                  campaignId: adMeta?.campaignId,
                  campaignName: adMeta?.campaignName,
                  postId,
                  commentId: cid,
                  threadId: tid,
                  authorName: fromName
                })
              : undefined,
            status: 'new',
            messages: [
              {
                id: `msg_${Date.now()}_in`,
                direction: 'inbound',
                channel: 'facebook_comment',
                text: msg,
                createdAt: String(c?.created_time || now),
                by: 'customer'
              }
            ],
            createdAt: String(c?.created_time || now),
            updatedAt: now
          });
          newCommentsProcessed += 1;
        }
      }
    } catch (err: any) {
      errors.push(`Post ${postId}: ${err?.message || 'fetch error'}`);
    }
  }

  state.config.lastSyncAt = new Date().toISOString();
  state.config.lastAutoPollAt = state.config.lastSyncAt;
  state.config.lastAutoPollError = errors.length > 0 ? errors[0] : undefined;
  saveMetaCommentsState(state);

  return {
    ok: true,
    adsMapped: Object.keys(state.config.postAdMap).length,
    activeAdsCount: activeAdsSnapshots.length,
    postsScanned,
    newCommentsProcessed,
    commentsFound,
    errors
  };
}

// ============================================================================
// PILOTO AUTOMÁTICO 24/7 EN SEGUNDO PLANO (SIN INTERVENCIÓN MANUAL)
// ============================================================================
let autoPilotTimer: ReturnType<typeof setInterval> | null = null;
let autoPilotInFlight = false;
let autoPilotLastRunAt: string | null = null;
let autoPilotLastError: string | null = null;

export function getMetaCommentsAutoPilotStatus() {
  return {
    running: Boolean(autoPilotTimer),
    inFlight: autoPilotInFlight,
    lastRunAt: autoPilotLastRunAt,
    lastError: autoPilotLastError
  };
}

export function stopMetaCommentsAutoPilot(): void {
  if (autoPilotTimer) {
    clearInterval(autoPilotTimer);
    autoPilotTimer = null;
  }
}

export function startMetaCommentsAutoPilot(resolveContext: () => Promise<{
  userAccessToken: string;
  adAccountId: string;
  pageId: string;
  products: ProductPage[];
  openRouterApiKey: string;
  publicBaseUrl: string;
} | null>): void {
  if (autoPilotTimer) return;

  const runTick = async () => {
    if (autoPilotInFlight) return;
    autoPilotInFlight = true;
    try {
      const ctx = await resolveContext();
      if (!ctx || !ctx.userAccessToken) return;
      const state = loadMetaCommentsState(ctx.products);
      if (!state.config.enabled) return;

      const res = await syncMetaAdPostsAndComments({
        userAccessToken: ctx.userAccessToken,
        adAccountId: ctx.adAccountId,
        pageId: ctx.pageId,
        products: ctx.products,
        openRouterApiKey: ctx.openRouterApiKey,
        publicBaseUrl: ctx.publicBaseUrl,
        processWithAi: true,
        maxCommentsPerPost: 20
      });
      autoPilotLastRunAt = new Date().toISOString();
      autoPilotLastError = res.errors.length > 0 ? res.errors[0] : null;
    } catch (err: any) {
      autoPilotLastError = String(err?.message || 'Error en ciclo automático 24/7');
    } finally {
      autoPilotInFlight = false;
    }
  };

  // Primera pasada ligera tras arrancar y luego cada 25 segundos 24/7
  setTimeout(() => {
    void runTick();
  }, 5000);
  autoPilotTimer = setInterval(() => {
    void runTick();
  }, 25000);
}
