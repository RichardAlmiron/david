import crypto from 'node:crypto';
import type {
  AutoAdsHypothesisV2,
  CompetitorFindingV2,
  ProductPage,
  PsychologicalProfileV2
} from '../src/types.ts';
import {
  getCircuitAReadView,
  getEnvValue,
  postgrestUpsert,
  readIntelligenceState,
  writeIntelligenceState,
  type StoredHypothesisRecord,
  type StoredResearchDossier
} from './autoadsStore.ts';

export interface CompetitorMiningResult {
  findings: CompetitorFindingV2[];
  summary: {
    verifiedCount: number;
    manualCount: number;
    inferredCount: number;
    adArchiveError?: string;
  };
}

export interface RunIntelligenceInput {
  product: Partial<ProductPage> & { slug: string; nombre: string; descripcion: string };
  market?: string;
  metaAccessToken?: string;
  manualCompetitors?: Array<{
    pageName: string;
    headline?: string;
    bodyCopy: string;
    ctaLabel?: string;
    landingUrl?: string;
    detectedAngle?: string;
    detectedOffer?: string;
  }>;
  openRouterApiKey?: string;
  offlineDeterministicOnly?: boolean;
  adMode?: 'standard' | 'entry_hook' | 'hybrid';
}

export interface RunIntelligenceOutput {
  dossier: StoredResearchDossier;
  hypotheses: StoredHypothesisRecord[];
  brainProfileCompatible: Record<string, any>;
}

export async function mineCompetitorsHonestly(params: {
  productName: string;
  productDescription: string;
  market?: string;
  metaAccessToken?: string;
  manualCompetitors?: RunIntelligenceInput['manualCompetitors'];
  fetchImpl?: typeof fetch;
}): Promise<CompetitorMiningResult> {
  const findings: CompetitorFindingV2[] = [];
  const fetchFn = params.fetchImpl || fetch;
  let adArchiveError: string | undefined;

  // 1) Evidencia manual del operador (si cargó anuncios/URLs reales observados)
  const manualList = Array.isArray(params.manualCompetitors) ? params.manualCompetitors : [];
  manualList.forEach((m, idx) => {
    if (!m.bodyCopy?.trim() && !m.headline?.trim()) return;
    findings.push({
      id: `comp_manual_${idx + 1}_${Date.now()}`,
      pageName: (m.pageName || `Competidor Observado ${idx + 1}`).trim(),
      headline: (m.headline || 'Oferta observada en mercado').trim(),
      bodyCopy: (m.bodyCopy || '').trim(),
      ctaLabel: (m.ctaLabel || 'Pedir ahora').trim(),
      landingUrl: m.landingUrl,
      detectedAngle: (m.detectedAngle || 'Evidencia manual del operador').trim(),
      detectedOffer: (m.detectedOffer || 'Contra entrega Paraguay').trim(),
      sourceTier: 'manual_operator_evidence',
      sourceVerified: true,
      evidenceNote: 'Evidencia directa cargada manualmente por el operador.'
    });
  });

  // 2) Consulta real a Meta Ad Library (`ads_archive` Graph v21.0)
  const token = (params.metaAccessToken || getEnvValue('META_AD_LIBRARY_TOKEN') || getEnvValue('META_ACCESS_TOKEN')).trim();
  if (token) {
    const searchTerm = `${params.productName}`.trim().split(/\s+/).slice(0, 4).join(' ');
    const country = params.market === 'PY' || !params.market ? 'PY' : params.market;
    const qs = new URLSearchParams({
      access_token: token,
      ad_reached_countries: JSON.stringify([country]),
      ad_active_status: 'ACTIVE',
      search_terms: searchTerm,
      fields: 'id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_delivery_start_time,ad_snapshot_url',
      limit: '8'
    });
    try {
      const resp = await fetchFn(`https://graph.facebook.com/v21.0/ads_archive?${qs.toString()}`);
      const json: any = await resp.json().catch(() => ({}));
      if (resp.ok && Array.isArray(json?.data)) {
        json.data.slice(0, 6).forEach((row: any, idx: number) => {
          const bodies = Array.isArray(row.ad_creative_bodies) ? row.ad_creative_bodies : [];
          const titles = Array.isArray(row.ad_creative_link_titles) ? row.ad_creative_link_titles : [];
          const bodyCopy = String(bodies[0] || '').trim();
          const headline = String(titles[0] || row.page_name || `Anuncio Activo #${idx + 1}`).trim();
          const startedAt = row.ad_delivery_start_time ? Date.parse(row.ad_delivery_start_time) : NaN;
          const activeDays = Number.isFinite(startedAt)
            ? Math.max(1, Math.floor((Date.now() - startedAt) / 86_400_000))
            : undefined;
          if (bodyCopy || headline) {
            findings.push({
              id: `comp_meta_${row.id || idx + 1}`,
              pageName: String(row.page_name || 'Página Meta PY'),
              headline,
              bodyCopy: bodyCopy || '(Sin texto extraído del snapshot)',
              ctaLabel: 'Ver anuncio',
              landingUrl: row.ad_snapshot_url,
              detectedAngle: activeDays && activeDays >= 14 ? 'Creativo longevo activo (+14d)' : 'Anuncio activo en Meta Ad Library',
              detectedOffer: 'Verificar snapshot Meta Ad Library',
              sourceTier: 'verified_meta_ad_library',
              sourceVerified: true,
              activeDays,
              score: activeDays ? Math.min(99, 55 + activeDays) : 70,
              isWinner: Boolean(activeDays && activeDays >= 14),
              evidenceNote: `Extraído de Meta Graph /v21.0/ads_archive (country=${country}, id=${row.id || 'N/A'}).`
            });
          }
        });
      } else {
        adArchiveError = json?.error?.message || `HTTP ${resp.status} en /ads_archive`;
      }
    } catch (err: any) {
      adArchiveError = String(err?.message || err);
    }
  } else {
    adArchiveError = 'META_AD_LIBRARY_TOKEN no configurado; no se simularon anuncios verificados.';
  }

  // 3) Si hay menos de 2 competidores reales/manuales, agregar inferencias estratégicas explícitamente marcadas
  const realCount = findings.length;
  if (realCount < 2) {
    const prod = params.productName || 'Producto';
    const baseInferences: CompetitorFindingV2[] = [
      {
        id: 'comp_infer_1',
        pageName: `Arquetipo Competidor Mercado PY (${prod})`,
        headline: `Promo 2x1 / Envío gratis ${prod}`,
        bodyCopy: `Inferencia de patrón típico en e-commerce COD Paraguay: enfoque directo en precio promocional y pago contra entrega sin atacar la causa raíz ni diferenciar calidad real.`,
        ctaLabel: 'Pedir',
        detectedAngle: 'Guerra de precio genérica (patrón saturado)',
        detectedOffer: 'Descuento genérico + contra entrega',
        sourceTier: 'llm_strategic_inference',
        sourceVerified: false,
        evidenceNote: 'Inferencia estratégica (NO verificada en Meta Ad Library). Úsala solo como referencia de saturación.'
      },
      {
        id: 'comp_infer_2',
        pageName: `Arquetipo Marketplace Informal PY`,
        headline: `${prod} en oferta hoy`,
        bodyCopy: `Inferencia de patrón típico informal: anuncios con texto mínimo, sin prueba visual demostrativa ni manejo de objeción de desconfianza por compras online.`,
        ctaLabel: 'Consultar',
        detectedAngle: 'Catálogo sin diferenciación ni mecanismo único',
        detectedOffer: 'Sin garantía explícita ni prueba física',
        sourceTier: 'llm_strategic_inference',
        sourceVerified: false,
        evidenceNote: 'Inferencia estratégica (NO verificada en Meta Ad Library).'
      }
    ];
    findings.push(...baseInferences.slice(0, 2 - realCount));
  }

  const verifiedCount = findings.filter((f) => f.sourceTier === 'verified_meta_ad_library').length;
  const manualCount = findings.filter((f) => f.sourceTier === 'manual_operator_evidence').length;
  const inferredCount = findings.filter((f) => f.sourceTier === 'llm_strategic_inference').length;

  return {
    findings,
    summary: {
      verifiedCount,
      manualCount,
      inferredCount,
      adArchiveError
    }
  };
}

function summarizeCircuitAMemoryForPrompt(productSlug: string): {
  winningSummary: string[];
  losingSummary: string[];
  hasData: boolean;
} {
  // AISLAMIENTO ESTRICTO: Solo consulta getCircuitAReadView(productSlug) (Circuito A puro).
  const view = getCircuitAReadView(productSlug);
  const winners = view.learningMemory.filter((m) => m.verdict === 'winner' || m.verdict === 'promising');
  const losers = view.learningMemory.filter((m) => m.verdict === 'loser');

  const winningSummary = winners
    .slice(0, 5)
    .map(
      (w) =>
        `${w.entityType}:${w.entityId} (angle=${w.angleId || 'n/a'}, forms=${w.formsCount}, CVR=${w.formCvrPct.toFixed(1)}%, CPF=$${(w.cpfUsd ?? 0).toFixed(2)})`
    );
  const losingSummary = losers
    .slice(0, 5)
    .map(
      (l) =>
        `${l.entityType}:${l.entityId} (angle=${l.angleId || 'n/a'}, forms=${l.formsCount}, spend=$${l.spendUsd.toFixed(2)}, accion=${l.recommendedAction})`
    );

  return {
    winningSummary,
    losingSummary,
    hasData: view.learningMemory.length > 0 || view.confirmedOrders.length > 0
  };
}

export function formatGuaranies(amount: number): string {
  const rounded = Math.max(0, Math.round(Number(amount) || 0));
  return `Gs. ${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export interface ProductGuaraniPricing {
  p1: number;
  p2: number;
  p3: number;
  pNormal: number;
  p1Gs: string;
  p2Gs: string;
  p3Gs: string;
  pNormalGs: string;
}

export function resolveProductGuaraniPricing(product: {
  precios?: Record<number, number>;
  precioNormal?: number;
} = {}): ProductGuaraniPricing {
  const rawP1 = Number(product?.precios?.[1] || 0);
  const rawNormal = Number(product?.precioNormal || 0);
  const p1 =
    Number.isFinite(rawP1) && rawP1 > 0
      ? Math.round(rawP1)
      : Number.isFinite(rawNormal) && rawNormal > 0
      ? Math.round(rawNormal)
      : 189000;
  const rawP2 = Number(product?.precios?.[2] || 0);
  const p2 =
    Number.isFinite(rawP2) && rawP2 > 0
      ? Math.round(rawP2)
      : Math.round((p1 * 1.88) / 1000) * 1000;
  const rawP3 = Number(product?.precios?.[3] || 0);
  const p3 =
    Number.isFinite(rawP3) && rawP3 > 0
      ? Math.round(rawP3)
      : Math.round((p1 * 2.68) / 1000) * 1000;
  const pNormal =
    Number.isFinite(rawNormal) && rawNormal > p1
      ? Math.round(rawNormal)
      : Math.round((p1 * 1.45) / 1000) * 1000;

  return {
    p1,
    p2,
    p3,
    pNormal,
    p1Gs: formatGuaranies(p1),
    p2Gs: formatGuaranies(p2),
    p3Gs: formatGuaranies(p3),
    pNormalGs: formatGuaranies(pNormal)
  };
}

export function buildImagePromptCurrencyAndMarginGuard(pricing: ProductGuaraniPricing): string {
  return (
    `CURRENCY & LAYOUT RULE: 100% Paraguayan Guaraníes ONLY (Real 1x price: ${pricing.p1Gs}; Pack 2x: ${pricing.p2Gs}; Higher market reference: ${pricing.pNormalGs}). ` +
    `Use strictly Paraguay Guaraníes ("Gs.") currency format with zero foreign currency symbols anywhere in the artwork. ` +
    `If ANY cost, savings, or price comparison badge appears visually, write ONLY "${pricing.p1Gs}" for this product's real price and at most "${pricing.pNormalGs}" for the higher alternative cost in Guaraníes. ` +
    `Leave the bottom 15% band visually clean and dark with zero text or badges so feed preview overlays never collide.`
  );
}

/**
 * Elimina alucinaciones en dólares ("$10", "$80", "USD", "dollars") en copy o aiImagePrompt
 * y las sustituye coherentemente por los precios reales del producto en Guaraníes (Gs.).
 */
export function sanitizePromptUsdToGuaranies(
  raw: string,
  pricingInput: { precios?: Record<number, number>; precioNormal?: number; p1?: number; p2?: number; p3?: number; pNormal?: number } = {},
  options: { isImagePrompt?: boolean } = {}
): string {
  const pricing = resolveProductGuaraniPricing({
    precios: pricingInput.precios || (pricingInput.p1 || pricingInput.p2 || pricingInput.p3
      ? {
          1: Number(pricingInput.p1 || 0),
          2: Number(pricingInput.p2 || 0),
          3: Number(pricingInput.p3 || 0)
        }
      : undefined),
    precioNormal: pricingInput.precioNormal ?? pricingInput.pNormal
  });

  let text = String(raw || '').trim();

  if (options.isImagePrompt) {
    text = text
      .replace(/,?\s*zero text overlays/gi, '')
      .replace(/,?\s*no text overlays/gi, '')
      .replace(/\bbanknotes?\b/gi, 'delivery receipt')
      .replace(/\bcash bills?\b/gi, 'delivery package')
      .replace(/\bpaying cash\b/gi, 'receiving the package at the door');
  }

  const usdTokenRegex =
    /(?:\bUS\s*\$\s*|\bUSD\s*:?\s*|\$\s*)(\d+(?:[.,]\d+)?)\b|\b(\d+(?:[.,]\d+)?)\s*(?:USD|US\s*\$|US\s+dollars?|dollars?|d[oó]lares?)\b/gi;

  const foundValues: number[] = [];
  for (const m of text.matchAll(usdTokenRegex)) {
    const rawNum = String(m[1] || m[2] || '').replace(/,/g, '.');
    const parsed = parseFloat(rawNum);
    if (Number.isFinite(parsed)) {
      foundValues.push(parsed);
    }
  }

  const hasMultipleDistinctUsd = foundValues.length >= 2 && Math.max(...foundValues) > Math.min(...foundValues);
  const maxUsdVal = foundValues.length > 0 ? Math.max(...foundValues) : 0;

  text = text.replace(usdTokenRegex, (fullMatch, g1, g2, offset: number) => {
    const rawNum = String(g1 || g2 || '').replace(/,/g, '.');
    const parsed = parseFloat(rawNum);
    if (hasMultipleDistinctUsd && Number.isFinite(parsed)) {
      return parsed >= maxUsdVal ? pricing.pNormalGs : pricing.p1Gs;
    }
    const startIdx = Math.max(0, offset - 42);
    const contextBefore = text.slice(startIdx, offset + fullMatch.length);
    if (/(?:alto|high|higher|before|antes|normal|retail|bruto|tradicional|compet|caro|expensive|costoso)/i.test(contextBefore)) {
      return pricing.pNormalGs;
    }
    return pricing.p1Gs;
  });

  text = text
    .replace(/\bdollar\s*signs?\b/gi, 'Guaraníes price badge')
    .replace(/\b(?:US\s+dollars?|dollars?|d[oó]lares?|USD)\b/gi, 'Guaraníes (Gs.)')
    .replace(/\$/g, 'Gs. ')
    .replace(/Gs\.\s+Gs\./gi, 'Gs.')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (options.isImagePrompt && !text.includes('CURRENCY & LAYOUT RULE:')) {
    const guard = buildImagePromptCurrencyAndMarginGuard(pricing);
    text = text ? `${text}. ${guard}` : guard;
  }

  return text;
}

export function buildFullOpenAiAdImagePrompt(
  rawPrompt: string,
  pricingInput: { precios?: Record<number, number>; precioNormal?: number; p1?: number; p2?: number; p3?: number; pNormal?: number } = {}
): string {
  const cleanPrompt = sanitizePromptUsdToGuaranies(rawPrompt, pricingInput, { isImagePrompt: true });
  return `Generate a high-converting, hyper-impactful commercial Meta Ad poster photograph showing the product in active use producing its real visible result, with bold, legible Spanish advertising typography (strictly in Paraguayan Guaraníes Gs. with zero foreign currencies): ${cleanPrompt}`;
}

function buildDiverseDynamicHypothesesFallback(params: {
  product: RunIntelligenceInput['product'];
  psychologicalProfile: PsychologicalProfileV2;
  winningSummary: string[];
  losingSummary: string[];
  adMode?: 'standard' | 'entry_hook' | 'hybrid';
}): AutoAdsHypothesisV2[] {
  const hookCfg = params.product.tripwireConfig;
  const canUseHook = Boolean(
    hookCfg?.enabled && hookCfg?.entryProductName && Number(hookCfg?.entryPriceGs) > 0
  );
  const mode = params.adMode || (canUseHook ? 'hybrid' : 'standard');
  const forceAllHook = mode === 'entry_hook' && canUseHook;
  const hookPricing = canUseHook
    ? resolveProductGuaraniPricing({
        precios: { 1: Number(hookCfg!.entryPriceGs) },
        precioNormal: Number(
          hookCfg!.entryNormalPriceGs || Math.round(Number(hookCfg!.entryPriceGs) * 2.1)
        )
      })
    : null;
  const stdPricing = resolveProductGuaraniPricing(params.product);
  const name = forceAllHook ? String(hookCfg!.entryProductName).trim() : params.product.nombre;
  const pricing = forceAllHook && hookPricing ? hookPricing : stdPricing;
  const priceFormatted = pricing.p1Gs;
  const truth = params.product.physicalTruth;
  const visualDetail = truth?.realMaterialOrFinish
    ? `real physical texture (${truth.realMaterialOrFinish})`
    : `authentic handheld product photography with natural studio lighting`;
  const usageDetail =
    forceAllHook && hookCfg?.entryProductDescription
      ? hookCfg.entryProductDescription.slice(0, 120)
      : truth?.usageMechanism || params.product.descripcion.slice(0, 120);
  const memoryHint =
    params.winningSummary.length > 0
      ? ` Refuerza señal previa ganadora (${params.winningSummary[0]}).`
      : '';

  const seedSpecs: Array<Omit<AutoAdsHypothesisV2, 'id'>> = [
    {
      hypothesisCode: 'H1-MECANISMO',
      angleId: 'ang_mecanismo_raiz',
      angleName: 'Mecanismo Único de Causa Raíz',
      awarenessLevel: 'problem_aware',
      marketSophistication: 3,
      targetAvatar: 'Comprador escéptico en Paraguay que ya probó alternativas genéricas que fallaron',
      corePain: params.psychologicalProfile.visceralPains[0] || `Frustración por soluciones baratas que no resuelven el problema real`,
      deepDesire: params.psychologicalProfile.deepDesires[0] || `Resolver el problema de raíz desde el primer uso sin gastar dos veces`,
      objectionTargeted: 'Ya compré cosas parecidas por redes y no sirvieron',
      uniqueMechanismProblem: params.psychologicalProfile.uniqueMechanismProblem,
      uniqueMechanismSolution: params.psychologicalProfile.uniqueMechanismSolution,
      bigIdea: `Por qué lo genérico falla frente al mecanismo real de ${name}`,
      promise: `Desempeño comprobable desde el primer día con ${usageDetail}`,
      proofType: 'Comparación técnica lado a lado + detalle físico real',
      hookFormula: '¿Cansado de soluciones comunes que duran dos días? Mirá por qué este diseño cambia todo',
      testVariable: 'hook_mecanismo_vs_beneficio',
      copyFramework: 'PAS_Mecanismo',
      visualArchetype: 'split_mechanism_macro',
      primaryTextDraft: `¿Ya te pasó comprar algo parecido y sentir que tiraste tu plata?\n\nLa diferencia con ${name} está en su funcionamiento interno: ${usageDetail}. No es un parche momentáneo, está pensado para rendir todos los días.\n\nPedilo ahora por ${priceFormatted} y pagás recién en efectivo o transferencia cuando llega a tus manos.`,
      headlineDraft: `Descubrí por qué ${name} sí funciona`,
      ctaDraft: 'Ver cómo funciona',
      aiImagePrompt: `High-contrast commercial advertising photograph showing ${name}, macro focus on ${visualDetail}, split clean visual explaining before vs after clarity, studio warm directional lighting, authentic Paraguay home context, zero fake badges, crisp 4K product realism.`,
      videoScriptPrompt: `0-3s Hook visual cercano mostrando el problema común y preguntando por qué fallan las copias; 3-12s Demo táctil del mecanismo físico de ${name}; 12-18s Cierre claro mencionando ${priceFormatted} y pago al recibir en Paraguay.`,
      strategicRationale: `Ataca nivel problem_aware con mecanismo único evitando guerra de precios.${memoryHint}`
    },
    {
      hypothesisCode: 'H2-CERO-RIESGO-COD',
      angleId: 'ang_confianza_cod_py',
      angleName: 'Confianza Anti-Estafa & Pago Contra Entrega',
      awarenessLevel: 'solution_aware',
      marketSophistication: 3,
      targetAvatar: 'Comprador cauteloso de Central/Interior que teme transferencias previas o paquetes falsos',
      corePain: params.psychologicalProfile.visceralPains[1] || 'Miedo a pagar por adelantado y que no llegue lo prometido',
      deepDesire: 'Comprar tranquilo verificando el producto en puerta antes de pagar',
      objectionTargeted: '¿Y si transfiero y desaparecen o llega otra cosa?',
      uniqueMechanismProblem: 'La venta online informal exige pago adelantado sin garantía',
      uniqueMechanismSolution: 'Reserva sin tarjeta ni transferencia previa + pago al recibir en mano',
      bigIdea: 'Cero riesgo financiero: primero ves tu pedido en la puerta, después pagás',
      promise: 'Enviamos a todo Paraguay con pago al recibir y atención por WhatsApp',
      proofType: 'Demostración de empaque real + proceso paso a paso',
      hookFormula: 'No pagues un solo guaraní por adelantado hasta tener tu pedido en mano',
      testVariable: 'reframe_riesgo_cod',
      copyFramework: '4Ps_Trust_COD',
      visualArchetype: 'handheld_real_unboxing',
      primaryTextDraft: `Si dudás en comprar por internet porque pedís algo y no sabés si llega igual, te entendemos.\n\nCon ${name} reservás en 30 segundos sin tarjeta ni transferencia adelantada. Cuando el repartidor llega a tu puerta, abonás ${priceFormatted} en el momento.\n\nCompletá tus datos en el formulario y confirmamos tu envío.`,
      headlineDraft: `Pagás recién al recibir tu ${name}`,
      ctaDraft: 'Reservar sin pagar antes',
      aiImagePrompt: `Authentic lifestyle product shot of a real person in Paraguay receiving and holding ${name} neatly boxed in natural daylight by a home doorway, ${visualDetail}, trustworthy warm tones, candid commercial photography.`,
      videoScriptPrompt: `0-3s Hook directo a cámara: '¿Miedo a comprar online? Acá no transferís antes'; 3-11s Unboxing real mostrando ${name} tal cual llega en caja; 11-18s Cómo completar el formulario en 30s para Asunción, Central e Interior.`,
      strategicRationale: 'Neutraliza la principal fricción cultural de conversión en Paraguay (miedo al pago adelantado).'
    },
    {
      hypothesisCode: 'H3-PRUEBA-SOCIAL-LOCAL',
      angleId: 'ang_prueba_local_py',
      angleName: 'Validación Real & Adopción Cotidiana en Paraguay',
      awarenessLevel: 'product_aware',
      marketSophistication: 4,
      targetAvatar: 'Persona pragmática que confía más en resultados cotidianos reales que en promesas publicitarias',
      corePain: 'Desconfianza ante anuncios exagerados con fotos de catálogo irreal',
      deepDesire: 'Elegir un producto probado que realmente facilite su rutina diaria',
      objectionTargeted: 'En la foto se ve lindo, pero en la vida real capaz es chico o frágil',
      uniqueMechanismProblem: 'Anuncios con renders engañosos desconectados del uso real',
      uniqueMechanismSolution: 'Escala real en mano, materiales verificables y uso cotidiano inmediato',
      bigIdea: 'Lo que ves en la foto es exactamente lo que recibís en tu casa',
      promise: 'Calidad tangible, uso simple y entrega coordinada en tu ciudad',
      proofType: 'Escala física en mano + escena de uso cotidiano real',
      hookFormula: 'Mirá el tamaño real y cómo rinde en uso diario sin filtros ni trucos',
      testVariable: 'prueba_ugc_realista_vs_estudio',
      copyFramework: 'Star_Story_Solution',
      visualArchetype: 'real_scale_lifestyle_ugc',
      primaryTextDraft: `Sin filtros ni fotos infladas: así se ve y así rinde ${name} en el uso de todos los días.\n\nQuienes lo eligen destacan lo práctico que resulta desde el minuto uno y lo firme que se siente en la mano.\n\nReservá tu unidad a ${priceFormatted} con envío coordinado y pago contra entrega.`,
      headlineDraft: `Tamaño real, calidad real: ${name}`,
      ctaDraft: 'Quiero el mío',
      aiImagePrompt: `UGC-style realistic photograph of ${name} being actively used in an authentic lived-in environment, human hand clearly showing real proportions and ${visualDetail}, soft window lighting, documentary product credibility.`,
      videoScriptPrompt: `0-3s Plano real UGC en mano mostrando textura y peso real de ${name}; 3-13s Uso paso a paso en rutina diaria sin cortes engañosos; 13-18s Resumen transparente de precio ${priceFormatted} y entrega contra entrega.`,
      strategicRationale: 'Ataca compradores product_aware que exigen ver autenticidad física real antes de llenar formulario.'
    },
    {
      hypothesisCode: 'H4-URGENCIA-COSTO-INACCION',
      angleId: 'ang_costo_inaccion',
      angleName: 'Costo Oculto de Seguir Sin Resolverlo',
      awarenessLevel: 'unaware',
      marketSophistication: 2,
      targetAvatar: 'Usuario que normalizó una molestia cotidiana y pospone resolverla',
      corePain: params.psychologicalProfile.visceralPains[2] || 'Seguir perdiendo tiempo, comodidad o dinero cada semana por no resolverlo',
      deepDesire: 'Recuperar tiempo, tranquilidad y comodidad en la rutina diaria sin esfuerzo extra',
      objectionTargeted: 'Capaz puedo esperar o arreglarme como vengo haciendo',
      uniqueMechanismProblem: 'El desgaste silencioso acumulado de soluciones improvisadas',
      uniqueMechanismSolution: 'Simplificación inmediata con una herramienta dedicada y lista para usar',
      bigIdea: 'Lo caro no es invertir una vez: lo caro es seguir improvisando todos los días',
      promise: 'Ahorrá tiempo y evitá dolores de cabeza diarios con una sola decisión práctica',
      proofType: 'Contraste antes/después de rutina y eficiencia diaria',
      hookFormula: '¿Cuánto tiempo y plata seguís perdiendo cada semana por resolver esto a medias?',
      testVariable: 'dolor_cotidiano_vs_ahorro_tiempo',
      copyFramework: 'Before_After_Bridge',
      visualArchetype: 'editorial_before_after_contrast',
      primaryTextDraft: `A veces uno se acostumbra a renegar todos los días con soluciones a medias pensando que no hace falta cambiar nada.\n\nCon ${name} resolvás en segundos lo que antes te quitaba tiempo y paciencia. Una inversión única de ${priceFormatted} que amortizás en la primera semana de uso.\n\nPedilo con entrega a domicilio y pagá al recibir.`,
      headlineDraft: `Dejá de complicarte: ${name}`,
      ctaDraft: 'Solucionarlo ahora',
      aiImagePrompt: `Clean editorial advertising composition contrasting messy frustrating old routine with serene effortless resolution using ${name}, ${visualDetail}, dramatic lighting separation, modern visual storytelling.`,
      videoScriptPrompt: `0-3s Escena reconocible de la frustración cotidiana; 3-11s Transición directa al alivio de usar ${name}; 11-18s CTA simple para reservar con pago al recibir.`,
      strategicRationale: 'Expande audiencia top-of-funnel captando compradores unaware/problem_aware por costo emocional de inacción.'
    },
    {
      hypothesisCode: 'H5-OFERTA-PACK-VALOR',
      angleId: 'ang_economia_pack',
      angleName: 'Economía Inteligente & Valor de Pack',
      awarenessLevel: 'most_aware',
      marketSophistication: 4,
      targetAvatar: 'Comprador decidido buscando máximo rendimiento por cada guaraní invertido o compra familiar',
      corePain: 'Pagar precio completo más envío por una sola unidad o quedar corto en casa/trabajo',
      deepDesire: 'Maximizar ahorro por unidad con una compra inteligente para uso propio y familia',
      objectionTargeted: '¿Realmente me conviene pedir ahora o esperar alguna promo?',
      uniqueMechanismProblem: 'Comprar suelto sale mucho más caro por envío y reposición',
      uniqueMechanismSolution: 'Configuración lista con opciones de pack con mejor costo unitario',
      bigIdea: 'La diferencia entre comprar una unidad cara o aprovechar la opción inteligente',
      promise: 'Más valor útil desde el primer pedido sin recargos ocultos al recibir',
      proofType: 'Desglose transparente de precio y beneficio por unidad',
      hookFormula: 'Si ya estabas buscando este producto, mirá cómo conviene llevarlo con mejor costo final',
      testVariable: 'anclaje_valor_pack_vs_unitario',
      copyFramework: 'Direct_Offer_Anchor',
      visualArchetype: 'clean_duo_value_showcase',
      primaryTextDraft: `Quienes ya conocen ${name} suelen pedir de a más de uno para la casa o para no quedarse cortos — y la diferencia por unidad se nota al instante.\n\nDesde ${priceFormatted} elegís tu opción en el formulario y confirmás en menos de un minuto.\n\nPagás recién cuando el delivery entrega en tu puerta.`,
      headlineDraft: `${name} — Mejor precio directo por formulario`,
      ctaDraft: 'Elegir mi opción',
      aiImagePrompt: `Crisp studio commercial photograph featuring ${name} showcased prominently with a complementary second set subtly angled beside it on a clean architectural surface, ${visualDetail}, premium high-margin aesthetic.`,
      videoScriptPrompt: `0-3s Hook directo para compradores decididos: 'Si ya venías buscando ${name}, mirá estas opciones'; 3-12s Mostrar detalle del producto y versatilidad de tener respaldo; 12-18s Cómo elegir pack 1, 2 o 3 en segundos.`,
      strategicRationale: 'Convierte tráfico caliente/most_aware elevando tasa de formulario y ticket promedio.'
    },
    {
      hypothesisCode: 'H6-DEMO-RAPIDA-OBJECION',
      angleId: 'ang_respuesta_objeciones',
      angleName: 'Demostración Directa & Cierre de Objeciones',
      awarenessLevel: 'solution_aware',
      marketSophistication: 5,
      targetAvatar: 'Comprador analítico de alto escrutinio que lee todo y evalúa practicidad antes de pedir',
      corePain: 'Falta de información clara sobre uso, medidas, compatibilidad y entrega real',
      deepDesire: 'Tener respuestas directas y concretas en segundos para decidir sin vueltas',
      objectionTargeted: '¿Es difícil de usar o requiere accesorios caros aparte?',
      uniqueMechanismProblem: 'Productos complicados que requieren instalación costosa o manuales imposibles',
      uniqueMechanismSolution: 'Listo para usar apenas abrís la caja, sin complicaciones técnicas',
      bigIdea: 'Sin vueltas ni instalaciones raras: sacás de la caja y lo usás',
      promise: 'Práctico desde el primer minuto con soporte directo en Paraguay',
      proofType: 'Demostración en 3 pasos simples sin cortes',
      hookFormula: '3 cosas que tenés que saber antes de pedir antes de gastar de más',
      testVariable: 'educativo_checklist_vs_emocional',
      copyFramework: 'Checklist_Claridad',
      visualArchetype: 'clean_annotated_detail_shot',
      primaryTextDraft: `Antes de pedir cualquier opción por internet, verificá estas 3 cosas:\n1. Que sirva para tu uso diario real.\n2. Que no te cobre sorpresas escondidas.\n3. Que puedas pagar recién al recibir.\n\n${name} cumple las tres por ${priceFormatted}. Dejá tus datos en el formulario y coordinamos tu entrega.`,
      headlineDraft: `3 datos clave sobre ${name} antes de pedir`,
      ctaDraft: 'Completar pedido',
      aiImagePrompt: `Sharp minimalist studio photograph highlighting the ergonomic key mechanism of ${name}, ${visualDetail}, bright neutral cyclorama background, tactile precision, clear visual storytelling.`,
      videoScriptPrompt: `0-3s Hook checklist: '3 cosas que nadie te cuenta antes de comprar'; 3-12s Responder punto por punto mostrando ${name} funcionando de cerca; 12-18s Cierre claro con formulario contra entrega.`,
      strategicRationale: 'Diseñada para mercados de sofisticación alta (4-5) con buyers analíticos que responden a claridad factual.'
    }
  ];

  return seedSpecs.map((spec, idx) => ({
    ...spec,
    id: `hyp_${Date.now()}_${idx + 1}`,
    aiImagePrompt: sanitizePromptUsdToGuaranies(spec.aiImagePrompt, pricing, { isImagePrompt: true })
  }));
}

async function synthesizeWithOpenRouter(params: {
  apiKey: string;
  product: RunIntelligenceInput['product'];
  competitors: CompetitorFindingV2[];
  winningSummary: string[];
  losingSummary: string[];
  adMode?: 'standard' | 'entry_hook' | 'hybrid';
}): Promise<{ psychologicalProfile: PsychologicalProfileV2; hypotheses: AutoAdsHypothesisV2[] } | null> {
  const hookCfg = params.product.tripwireConfig;
  const canUseHook = Boolean(
    hookCfg?.enabled && hookCfg?.entryProductName && Number(hookCfg?.entryPriceGs) > 0
  );
  const resolvedMode = params.adMode || (canUseHook ? 'hybrid' : 'standard');
  const hasAllHook = resolvedMode === 'entry_hook' && canUseHook;
  const isHybridMix = resolvedMode === 'hybrid' && canUseHook;

  const hookPricingInput = hasAllHook || isHybridMix
    ? {
        precios: { 1: Number(hookCfg!.entryPriceGs) },
        precioNormal: Number(
          hookCfg!.entryNormalPriceGs || Math.round(Number(hookCfg!.entryPriceGs) * 2.1)
        )
      }
    : params.product;
  const pricing = resolveProductGuaraniPricing(hasAllHook ? hookPricingInput : params.product);
  const hookPricing = resolveProductGuaraniPricing(hookPricingInput);

  const hookSectionPrompt = hasAllHook
    ? `
ESTRATEGIA OBLIGATORIA DE ANUNCIO GANCHO DE ALTO CLIC (100% OFERTA DE ENTRADA):
- PRODUCTO PRINCIPAL DE LA TIENDA (congruente): ${params.product.nombre} (${params.product.descripcion})
- ARTÍCULO PROTAGONISTA DE LOS 6 ANUNCIOS (100% ENFOQUE AQUÍ): "${hookCfg!.entryProductName}"
- Qué hace este artículo de entrada: ${hookCfg!.entryProductDescription || hookCfg!.entryProductName}
- PRECIO GANCHO OBLIGATORIO VISIBLE EN COPY Y EN EL PROMPT VISUAL: ${hookPricing.p1Gs} (Precio normal referencia: ${hookPricing.pNormalGs})
- REGLA INQUEBRANTABLE: Los 6 anuncios deben vender DIRECTAMENTE "${hookCfg!.entryProductName}" a solo ${hookPricing.p1Gs} con Pago Contra Entrega en Paraguay para maximizar CTR. Jamás escribas "tripwire" en ningún campo; usa únicamente "${hookCfg!.entryProductName}".
`
    : isHybridMix
      ? `
ESTRATEGIA HÍBRIDA ADSET (4 ESTÁNDAR + 2 INYECCIÓN DE ALTO CLIC):
- HIPÓTESIS H1, H2, H3, H4 (ESTÁNDAR): Venden el PRODUCTO PRINCIPAL "${params.product.nombre}" (${params.product.descripcion}) al precio real ${pricing.p1Gs} (Pack 2: ${pricing.p2Gs}).
- HIPÓTESIS H5 y H6 (INYECCIÓN GANCHO DE ALTO CLIC): Venden EXCLUSIVAMENTE el ARTÍCULO DE ENTRADA CONGRUENTE "${hookCfg!.entryProductName}" (${hookCfg!.entryProductDescription || hookCfg!.entryProductName}) al precio gancho irresistible ${hookPricing.p1Gs} (Referencia: ${hookPricing.pNormalGs}) para disparar el CTR del AdSet y captar leads calientes hacia "${params.product.nombre}".
- REGLA INQUEBRANTABLE: Jamás escribas la palabra "tripwire" en ningún campo; llamalo únicamente "${hookCfg!.entryProductName}".
`
      : '';
  const prompt = `Sos un director senior de respuesta directa, psicología del consumidor (Eugene Schwartz - Niveles de Conciencia y Sofisticación del Mercado) y pauta Meta Ads COD en Paraguay.

PRODUCTO:
- Nombre: ${hasAllHook ? hookCfg!.entryProductName : params.product.nombre}
- Slug: ${params.product.slug}
- Descripción: ${hasAllHook ? (hookCfg!.entryProductDescription || params.product.descripcion) : params.product.descripcion}
- Precio Gancho / Pack 1 (REAL): ${pricing.p1Gs}
- Precio Pack 2 (REAL): ${pricing.p2Gs}
- Precio Pack 3 (REAL): ${pricing.p3Gs}
- Precio Normal / Referencia Alta (para contraste o precio tachado): ${pricing.pNormalGs}
- Contexto IA adicional: ${params.product.contextoIA || 'N/A'}
- Physical truth: ${JSON.stringify(params.product.physicalTruth || {})}
${hookSectionPrompt}
COMPETIDORES OBSERVADOS (CON SU NIVEL DE FUENTE REAL):
${JSON.stringify(params.competitors.map((c) => ({ pageName: c.pageName, headline: c.headline, angle: c.detectedAngle, tier: c.sourceTier, verified: c.sourceVerified })), null, 2)}

MEMORIA PREVIA DEL CIRCUITO A (ÚNICAMENTE CONVERSIONES DE FORMULARIO Y COSTO POR FORMULARIO — SIN DATOS DE COURIER):
- Ganadores previos: ${params.winningSummary.join('; ') || 'Sin historial previo aún'}
- Perdedores a evitar: ${params.losingSummary.join('; ') || 'Sin perdedores registrados aún'}

REGLAS OBLIGATORIAS:
1. Diagnosticá nivel de conciencia y sofisticación de mercado (1..5), dolores viscerales, deseos profundos, objeciones COD Paraguay, mecanismo único del problema y mecanismo único de solución.
2. Creá EXACTAMENTE 6 hipótesis publicitarias GENUINAMENTE DISTINTAS (NO uses ángulos genéricos repetidos ni textos idénticos; cada hipótesis debe variar targetAvatar, awarenessLevel, objectionTargeted, hookFormula, testVariable, copyFramework, visualArchetype, primaryTextDraft en español rioplatense/paraguayo natural, headlineDraft, ctaDraft, aiImagePrompt específico en inglés fotográfico y videoScriptPrompt).
3. MONEDA OBLIGATORIA PARAGUAY (100% GUARANÍES — CERO DÓLARES): Está TERMINANTEMENTE PROHIBIDO escribir dólares ("$", "USD", "US$", "dollars", "dólares", "$10", "$80", etc.) en CUALQUIERA de los 6 anuncios (ni en el copy ni en "aiImagePrompt"). Si un "aiImagePrompt" muestra precios, ahorros, costo estimado o comparativas económicas, DEBE imprimir exclusivamente Guaraníes usando el precio real de entrada ("${pricing.p1Gs}") y, si muestra un costo alto/bruto para contrastar marketing, usar "${pricing.pNormalGs}" en Guaraníes. Además, dejá el 15% inferior de la imagen limpio y oscuro sin textos ni etiquetas para que no choque con el zócalo inferior.
4. NO menciones datos de courier/entregas/devoluciones ni supongas garantías inventadas fuera del producto real.
5. Respondé ÚNICAMENTE JSON válido con esta estructura exacta:
{
  "psychologicalProfile": {
    "productSlug": "${params.product.slug}",
    "awarenessLevel": "unaware|problem_aware|solution_aware|product_aware|most_aware",
    "marketSophistication": 3,
    "visceralPains": ["...", "...", "..."],
    "deepDesires": ["...", "...", "..."],
    "cognitiveBiasesAndTriggers": ["...", "..."],
    "paraguayCodObjections": [{"objection": "...", "reframe": "..."}],
    "uniqueMechanismProblem": "...",
    "uniqueMechanismSolution": "...",
    "winningAnglesSummary": ["..."],
    "saturatedPatternsToAvoid": ["..."]
  },
  "hypotheses": [
    {
      "hypothesisCode": "H1-...",
      "angleId": "ang_...",
      "angleName": "...",
      "awarenessLevel": "...",
      "marketSophistication": 3,
      "targetAvatar": "...",
      "corePain": "...",
      "deepDesire": "...",
      "objectionTargeted": "...",
      "uniqueMechanismProblem": "...",
      "uniqueMechanismSolution": "...",
      "bigIdea": "...",
      "promise": "...",
      "proofType": "...",
      "hookFormula": "...",
      "testVariable": "...",
      "copyFramework": "...",
      "visualArchetype": "...",
      "primaryTextDraft": "...",
      "headlineDraft": "...",
      "ctaDraft": "...",
      "aiImagePrompt": "...",
      "videoScriptPrompt": "...",
      "strategicRationale": "..."
    }
  ]
}`;

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        temperature: 0.72,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!resp.ok) return null;
    const data: any = await resp.json().catch(() => ({}));
    const rawContent = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!rawContent) return null;
    const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed?.psychologicalProfile || !Array.isArray(parsed?.hypotheses) || parsed.hypotheses.length < 6) {
      return null;
    }
    const sanitizedHypotheses: AutoAdsHypothesisV2[] = parsed.hypotheses.slice(0, 6).map((h: any, i: number) => ({
      id: `hyp_${Date.now()}_${i + 1}`,
      hypothesisCode: String(h.hypothesisCode || `H${i + 1}`),
      angleId: String(h.angleId || `ang_dyn_${i + 1}`),
      angleName: String(h.angleName || `Ángulo ${i + 1}`),
      awarenessLevel: String(h.awarenessLevel || 'problem_aware'),
      marketSophistication: Number(h.marketSophistication) || 3,
      targetAvatar: String(h.targetAvatar || 'Comprador COD Paraguay'),
      corePain: String(h.corePain || ''),
      deepDesire: String(h.deepDesire || ''),
      objectionTargeted: String(h.objectionTargeted || ''),
      uniqueMechanismProblem: String(h.uniqueMechanismProblem || parsed.psychologicalProfile.uniqueMechanismProblem || ''),
      uniqueMechanismSolution: String(h.uniqueMechanismSolution || parsed.psychologicalProfile.uniqueMechanismSolution || ''),
      bigIdea: String(h.bigIdea || ''),
      promise: String(h.promise || ''),
      proofType: String(h.proofType || ''),
      hookFormula: String(h.hookFormula || ''),
      testVariable: String(h.testVariable || `var_${i + 1}`),
      copyFramework: String(h.copyFramework || 'PAS'),
      visualArchetype: String(h.visualArchetype || `archetype_${i + 1}`),
      primaryTextDraft: sanitizePromptUsdToGuaranies(String(h.primaryTextDraft || ''), pricing),
      headlineDraft: sanitizePromptUsdToGuaranies(String(h.headlineDraft || ''), pricing),
      ctaDraft: String(h.ctaDraft || 'Pedir ahora'),
      aiImagePrompt: sanitizePromptUsdToGuaranies(String(h.aiImagePrompt || ''), pricing, { isImagePrompt: true }),
      videoScriptPrompt: sanitizePromptUsdToGuaranies(String(h.videoScriptPrompt || ''), pricing),
      strategicRationale: String(h.strategicRationale || '')
    }));

    return {
      psychologicalProfile: {
        ...parsed.psychologicalProfile,
        productSlug: params.product.slug
      },
      hypotheses: sanitizedHypotheses
    };
  } catch {
    return null;
  }
}

export async function runPsychologicalAndHypothesisIntelligence(
  input: RunIntelligenceInput
): Promise<RunIntelligenceOutput> {
  const market = input.market || 'PY';
  const competitorRes = await mineCompetitorsHonestly({
    productName: input.product.nombre,
    productDescription: input.product.descripcion,
    market,
    metaAccessToken: input.metaAccessToken,
    manualCompetitors: input.manualCompetitors
  });

  // Circuito A estrictamente aislado: solo métricas de formularios / anuncios
  const memory = summarizeCircuitAMemoryForPrompt(input.product.slug);

  const openRouterKey = (input.openRouterApiKey || getEnvValue('OPENROUTER_API_KEY')).trim();

  const defaultPsych: PsychologicalProfileV2 = {
    productSlug: input.product.slug,
    awarenessLevel: 'problem_aware',
    marketSophistication: 3,
    visceralPains: [
      `Soluciones baratas previas que fallan rápido al usar ${input.product.nombre}`,
      'Desconfianza a pagar por adelantado online en Paraguay',
      'Pérdida de tiempo comparando opciones sin garantía física real'
    ],
    deepDesires: [
      'Resolver el problema diario sin complicaciones ni compras repetidas',
      'Sentir seguridad pagando recién cuando el pedido llega a la puerta',
      'Obtener calidad real tangible acorde al precio pagado'
    ],
    cognitiveBiasesAndTriggers: [
      'Aversión a la pérdida (cero riesgo COD)',
      'Contraste mecanismo único vs alternativa genérica',
      'Prueba visual concreta antes del clic'
    ],
    paraguayCodObjections: [
      {
        objection: '¿Y si pago antes y no llega igual?',
        reframe: 'No transferís antes: pagás en efectivo o transferencia recién al recibir.'
      },
      {
        objection: '¿Sirve realmente o es frágil como copias baratas?',
        reframe: 'Mecanismo físico concreto diseñado para uso cotidiano real.'
      }
    ],
    uniqueMechanismProblem: 'Las opciones genéricas fallan por priorizar apariencia sobre ingeniería práctica de uso diario.',
    uniqueMechanismSolution: `${input.product.nombre} combina simplicidad inmediata con materiales pensados para el uso real en el hogar/trabajo.`,
    winningAnglesSummary: memory.winningSummary,
    saturatedPatternsToAvoid: memory.losingSummary
  };

  let llmOut: { psychologicalProfile: PsychologicalProfileV2; hypotheses: AutoAdsHypothesisV2[] } | null = null;
  if (!input.offlineDeterministicOnly && openRouterKey) {
    llmOut = await synthesizeWithOpenRouter({
      apiKey: openRouterKey,
      product: input.product,
      competitors: competitorRes.findings,
      winningSummary: memory.winningSummary,
      losingSummary: memory.losingSummary,
      adMode: input.adMode
    });
  }

  const psychologicalProfile = llmOut?.psychologicalProfile || defaultPsych;
  const hypothesesRaw =
    llmOut?.hypotheses ||
    buildDiverseDynamicHypothesesFallback({
      product: input.product,
      psychologicalProfile,
      winningSummary: memory.winningSummary,
      losingSummary: memory.losingSummary,
      adMode: input.adMode
    });

  const nowIso = new Date().toISOString();
  const dossierId = `dossier_${crypto.randomBytes(5).toString('hex')}`;
  const dossier: StoredResearchDossier = {
    id: dossierId,
    productSlug: input.product.slug,
    market,
    productTruthJson: (input.product.physicalTruth as any) || {},
    competitorFindingsJson: competitorRes.findings,
    competitorSourceSummary: competitorRes.summary,
    psychologicalProfileJson: psychologicalProfile,
    awarenessLevel: psychologicalProfile.awarenessLevel,
    marketSophistication: psychologicalProfile.marketSophistication,
    createdAt: nowIso
  };

  const storedHypotheses: StoredHypothesisRecord[] = hypothesesRaw.map((h) => ({
    ...h,
    dossierId,
    productSlug: input.product.slug,
    verdict: 'pending',
    createdAt: nowIso
  }));

  const intelState = readIntelligenceState();
  intelState.dossiers.unshift(dossier);
  if (intelState.dossiers.length > 200) intelState.dossiers = intelState.dossiers.slice(0, 200);
  intelState.hypotheses.unshift(...storedHypotheses);
  if (intelState.hypotheses.length > 600) intelState.hypotheses = intelState.hypotheses.slice(0, 600);
  writeIntelligenceState(intelState);

  // Sync opcional no-bloqueante a Supabase
  void postgrestUpsert(
    'autoads_research_dossiers',
    {
      id: dossier.id,
      product_slug: dossier.productSlug,
      market: dossier.market,
      product_truth_json: dossier.productTruthJson || {},
      competitor_findings_json: dossier.competitorFindingsJson,
      competitor_source_summary: dossier.competitorSourceSummary,
      psychological_profile_json: dossier.psychologicalProfileJson,
      awareness_level: dossier.awarenessLevel,
      market_sophistication: dossier.marketSophistication,
      created_at: dossier.createdAt
    },
    'id'
  );
  void postgrestUpsert(
    'autoads_hypotheses',
    storedHypotheses.map((h) => ({
      id: h.id,
      dossier_id: h.dossierId,
      product_slug: h.productSlug,
      hypothesis_code: h.hypothesisCode,
      angle_id: h.angleId,
      awareness_level: h.awarenessLevel,
      market_sophistication: h.marketSophistication,
      target_avatar: h.targetAvatar,
      core_pain: h.corePain,
      deep_desire: h.deepDesire,
      objection_targeted: h.objectionTargeted,
      unique_mechanism_problem: h.uniqueMechanismProblem,
      unique_mechanism_solution: h.uniqueMechanismSolution,
      big_idea: h.bigIdea,
      promise: h.promise,
      proof_type: h.proofType,
      hook_formula: h.hookFormula,
      test_variable: h.testVariable,
      copy_framework: h.copyFramework,
      visual_archetype: h.visualArchetype,
      primary_text_draft: h.primaryTextDraft,
      headline_draft: h.headlineDraft,
      cta_draft: h.ctaDraft,
      ai_image_prompt: h.aiImagePrompt,
      video_script_prompt: h.videoScriptPrompt,
      verdict: h.verdict,
      created_at: h.createdAt
    })),
    'id'
  );

  // Adaptador 100% compatible con AutoAdsBrainProfile + AutoAdsView + sanitizador no destructivo
  const gradients = [
    'from-emerald-950 via-teal-900 to-slate-900',
    'from-blue-950 via-indigo-900 to-slate-900',
    'from-purple-950 via-fuchsia-900 to-slate-900',
    'from-amber-950 via-orange-900 to-slate-900',
    'from-cyan-950 via-sky-900 to-slate-900',
    'from-rose-950 via-pink-900 to-slate-900'
  ];

  const brainProfileCompatible = {
    trainedAt: nowIso,
    version: 2,
    strategyMode: 'hypothesis_v2',
    dossierId,
    productSlug: input.product.slug,
    productName: input.product.nombre,
    targetNicheSummary: `${psychologicalProfile.uniqueMechanismSolution} (Sofisticación ${psychologicalProfile.marketSophistication}/5 · Conciencia: ${psychologicalProfile.awarenessLevel})`,
    winningAngles: storedHypotheses.map((h) => `${h.hypothesisCode}: ${h.angleName}`),
    topHooks: storedHypotheses.map((h) => h.hookFormula),
    objectionHandlers: psychologicalProfile.paraguayCodObjections.map((o) => `${o.objection} -> ${o.reframe}`),
    recommendedObjective: 'OUTCOME_LEADS',
    recommendedCta: storedHypotheses[0]?.ctaDraft || 'Completar pedido',
    audienceTargetingSuggestions: [
      'Paraguay 22-55+ (Asunción, Central y ciudades principales)',
      'Compradores interesados en practicidad hogar/bienestar (optimizado a Lead confirmado)'
    ],
    budgetGuidance: 'Fase testeo 6 hipótesis dinámicas: USD 3-5/día por AdSet o equivalente PYG',
    researchDossier: dossier,
    psychologicalProfile,
    hypotheses: storedHypotheses,
    competitorsSummary: competitorRes.summary,
    competitors: competitorRes.findings,
    learningMemoryUsed: memory,
    creativeBriefs: storedHypotheses.map((h, idx) => ({
      angleIndex: idx,
      angleName: `${h.hypothesisCode} · ${h.angleName}`,
      hypothesisId: h.id,
      angleId: h.angleId,
      hypothesisCode: h.hypothesisCode,
      awarenessLevel: h.awarenessLevel,
      targetAvatar: h.targetAvatar,
      objectionTargeted: h.objectionTargeted,
      testVariable: h.testVariable,
      copyFramework: h.copyFramework,
      visualConcept: h.bigIdea,
      hook: h.hookFormula,
      primaryText: h.primaryTextDraft,
      headline: h.headlineDraft,
      ctaLabel: h.ctaDraft,
      aiImagePrompt: h.aiImagePrompt,
      videoScriptPrompt: h.videoScriptPrompt,
      badge: `${h.hypothesisCode} · ${h.awarenessLevel}`,
      bgGradient: gradients[idx % gradients.length]
    }))
  };

  return {
    dossier,
    hypotheses: storedHypotheses,
    brainProfileCompatible
  };
}
