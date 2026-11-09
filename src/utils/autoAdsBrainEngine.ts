/**
 * AutoAds Brain Engine — Motor central del sistema "AutoAds" con Cerebro Maestro
 *
 * Investiga competencia, aprende patrones ganadores y genera creativos diversos
 * utilizando la metodología Andrómeda + Fórmula COD LATAM.
 */

import { ProductPage } from '../types';
import { formatGs } from '../config';

// Re-exportar todo lo que las vistas necesitan de pipeboardEngine
export type {
  PipeboardConnectionConfig,
  PipeboardAdAccount,
  PipeboardFacebookPage,
  GeneratedAdCreativeAsset,
  PipeboardPublishedCampaignRecord,
} from './pipeboardEngine';

export {
  DEFAULT_PIPEBOARD_CONFIG,
  PIPEBOARD_MCP_TOOLS_CATALOG,
  buildHighImpactAdSvgDataUrl,
  buildCompleteAdCreativesSuite
} from './pipeboardEngine';

import type { GeneratedAdCreativeAsset } from './pipeboardEngine';
import { buildHighImpactAdSvgDataUrl } from './pipeboardEngine';

// ────────────────────────────────────────────────────────────────────────────────
// Constantes del modelo y configuración
// ────────────────────────────────────────────────────────────────────────────────

/** Modelos oficiales exclusivos y bloqueados vía OpenRouter para el sistema AutoAds */
export const AUTOADS_LLM_MODEL = 'openai/gpt-4o';
export const AUTOADS_IMAGE_MODEL = 'openai/gpt-image-2.6-sunburst';
export const AUTOADS_VIDEO_MODEL = 'google/gemini-omni-1.2-flash';

export const AUTOADS_IMAGE_MODEL_CANDIDATES = [
  'openai/gpt-image-2.6-sunburst'
] as const;

export const AUTOADS_VIDEO_MODEL_CANDIDATES = [
  'google/gemini-omni-1.2-flash'
] as const;

export const AUTOADS_OPENAI_IMAGE_CATALOG = [
  {
    id: 'openai/gpt-image-2.6-sunburst',
    label: 'OpenAI: GPT Image 2.6 Sunburst (Máximo Detalle y Perfección · Exclusivo)',
    shortLabel: 'GPT Image 2.6 Sunburst',
    endpointType: 'images_api' as const,
    pricingLabel: '$8/M in · $30/M out'
  }
] as const;

export const AUTOADS_VIDEO_CATALOG = [
  {
    id: 'google/gemini-omni-1.2-flash',
    label: 'Google: Gemini Omni 1.2 Flash (⭐ 15 Segundos · Producto Real + Avatar Hablando · Exclusivo)',
    shortLabel: 'Gemini Omni 1.2 Flash (15s)'
  }
] as const;

// Paleta de colores para creativos (misma que pipeboardEngine)
const CREATIVE_COLOR_THEMES = [
  {
    name: 'Esmeralda Impacto COD',
    bgStart: '#041a12',
    bgMid: '#0b3d2e',
    bgEnd: '#062319',
    accent: '#e8b23a',
    badgeBg: '#16a34a',
    textMain: '#ffffff'
  },
  {
    name: 'Fuego Oferta Relámpago',
    bgStart: '#1f0808',
    bgMid: '#7f1d1d',
    bgEnd: '#450a0a',
    accent: '#facc15',
    badgeBg: '#ea580c',
    textMain: '#ffffff'
  },
  {
    name: 'Azul Titanio Tecnológico',
    bgStart: '#090d16',
    bgMid: '#1e3a8a',
    bgEnd: '#0f172a',
    accent: '#38bdf8',
    badgeBg: '#2563eb',
    textMain: '#ffffff'
  },
  {
    name: 'Púrpura Cine & Hogar Premium',
    bgStart: '#13072e',
    bgMid: '#3b0764',
    bgEnd: '#1e1b4b',
    accent: '#fde047',
    badgeBg: '#9333ea',
    textMain: '#ffffff'
  }
];

// ────────────────────────────────────────────────────────────────────────────────
// Tipos del sistema AutoAds
// ────────────────────────────────────────────────────────────────────────────────

/** Ángulo de ataque para un avatar específico */
export interface AutoAdsAngle {
  id: string;
  type: 'offer' | 'trust' | 'transformation' | 'urgency' | 'social_proof' | 'unboxing';
  hook: string;
  emotionalTrigger: string;
}

/** Persona compradora (avatar) generada por el Cerebro Maestro */
export interface AutoAdsAvatar {
  id: string;
  name: string;
  description: string;
  painPoints: string[];
  angles: AutoAdsAngle[];
}

/** Configuración de segmentación para campañas Meta Ads */
export interface AutoAdsTargeting {
  country: 'PY';
  minAge: number;
  maxAge: number;
  genderBalance: 'all' | 'male' | 'female';
  peakHours: number[];
  optimizationGoal: 'OUTCOME_SALES' | 'OUTCOME_LEADS' | 'OUTCOME_AWARENESS';
  bidStrategy: 'LOWEST_COST_WITHOUT_CAP' | 'COST_CAP' | 'BID_CAP';
}

/** Brief creativo completo generado por el Cerebro Maestro */
export interface AutoAdsCreativeBrief {
  index: number;
  type: 'feed_1x1' | 'story_9x16' | 'reel_9x16';
  format: '1:1' | '9:16';
  archetypeName: string;
  avatarTarget: string;
  angleType: AutoAdsAngle['type'];
  hook3s: string;
  hookBadge: string;
  headline: string;
  primaryText: string;
  descriptionText: string;
  ctaType: 'SHOP_NOW' | 'ORDER_NOW' | 'LEARN_MORE';
  ctaLabel: string;
  themeIndex: number;
  aiImagePrompt?: string;
  aiGeneratedImageUrl?: string;
  aiGeneratedVideoUrl?: string;
  videoScenes?: Array<{
    durationSec: number;
    badge: string;
    title: string;
    subtitle: string;
    priceTag: string;
    bgGradient: string;
  }>;
}

/** Perfil completo del Cerebro Maestro entrenado para un producto */
export interface AutoAdsBrainProfile {
  productId: string;
  productName: string;
  trainedAt: string;
  status: 'idle' | 'training' | 'ready' | 'error';

  /** Análisis profundo del producto */
  productAnalysis: {
    name: string;
    description: string;
    pricesPack1: number;
    pricesPack2: number;
    pricesPack3: number;
    pricesNormal: number;
    freeShipping: boolean;
    images: string[];
    physicalTruth: string;
    agentBrain: string;
  };

  /** Insights de la competencia obtenidos del análisis */
  competitorInsights: {
    searchQuery: string;
    activeAdsFound: number;
    winningPatterns: string[];
    commonHooks: string[];
    commonAngles: string[];
    dominantFormats: string[];
    avgLongevityDays: number;
  };

  /** 3 avatares de compradores generados */
  avatars: AutoAdsAvatar[];

  /** Configuración de segmentación recomendada */
  targeting: AutoAdsTargeting;

  /** 6 briefs creativos diversos */
  creativeBriefs: AutoAdsCreativeBrief[];
}

// ────────────────────────────────────────────────────────────────────────────────
// Arquetipos Creativos Andrómeda — 6 direcciones genuinamente diversas
// ────────────────────────────────────────────────────────────────────────────────

/** Definición de cada arquetipo creativo (diversidad conceptual, no cosmética) */
export const ANDROMEDA_CREATIVE_ARCHETYPES = [
  {
    index: 0,
    name: 'Oferta Directa COD',
    type: 'feed_1x1' as const,
    format: '1:1' as const,
    description:
      'Feed cuadrado con precio prominente, badge de envío gratis, stack de valor COD. ' +
      'Ángulo: oferta irresistible con cero riesgo financiero. El precio y la conveniencia son el protagonista.',
    angleType: 'offer' as const,
    ctaType: 'ORDER_NOW' as const,
    ctaLabel: 'PAGÁS CUANDO RECIBÍS'
  },
  {
    index: 1,
    name: 'Trust / Cero Riesgo',
    type: 'feed_1x1' as const,
    format: '1:1' as const,
    description:
      'Feed cuadrado estilo UGC/orgánico que enfatiza la confianza. "Verificá antes de pagar", ' +
      'garantía escrita, WhatsApp directo. Ángulo: eliminar el miedo a la estafa online en Paraguay.',
    angleType: 'trust' as const,
    ctaType: 'SHOP_NOW' as const,
    ctaLabel: 'VER GARANTÍA Y COMPRAR'
  },
  {
    index: 2,
    name: 'Problema → Solución',
    type: 'feed_1x1' as const,
    format: '1:1' as const,
    description:
      'Feed cuadrado de antes/después o dolor→alivio. Muestra el problema cotidiano que resuelve ' +
      'el producto y la transformación tangible. Ángulo: empatía con el dolor del avatar.',
    angleType: 'transformation' as const,
    ctaType: 'ORDER_NOW' as const,
    ctaLabel: 'QUIERO LA SOLUCIÓN'
  },
  {
    index: 3,
    name: 'Pack Familiar Ahorro',
    type: 'story_9x16' as const,
    format: '9:16' as const,
    description:
      'Story vertical que empuja el upsell al Pack 2. Enfoque en el ahorro familiar, ' +
      '"llevá 2 y regalá a tu mamá/hermana". Ángulo: urgencia + ahorro + social proof.',
    angleType: 'urgency' as const,
    ctaType: 'ORDER_NOW' as const,
    ctaLabel: 'QUIERO MI PACK HOY'
  },
  {
    index: 4,
    name: 'Demostración de Impacto',
    type: 'reel_9x16' as const,
    format: '9:16' as const,
    description:
      'Reel vertical de 4 escenas dinámicas: Hook visual → Demo en uso → Oferta de packs → CTA final. ' +
      'Ángulo: prueba social visual, el producto en acción convence más que cualquier copy.',
    angleType: 'social_proof' as const,
    ctaType: 'SHOP_NOW' as const,
    ctaLabel: 'COMPRAR AHORA'
  },
  {
    index: 5,
    name: 'Unboxing ¿Es Estafa?',
    type: 'reel_9x16' as const,
    format: '9:16' as const,
    description:
      'Reel vertical con narrativa "compré esto por internet y mirá lo que llegó". ' +
      'Aprovecha el miedo a las estafas como gancho → revela producto real de calidad. Ángulo: unboxing trust-building.',
    angleType: 'unboxing' as const,
    ctaType: 'LEARN_MORE' as const,
    ctaLabel: 'VER SI ES REAL'
  }
] as const;

// ────────────────────────────────────────────────────────────────────────────────
// Funciones utilitarias internas
// ────────────────────────────────────────────────────────────────────────────────

/** Escapa texto para uso seguro dentro de SVGs */
function escapeSvgText(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Extrae el nombre genérico funcional del producto (QUÉ ES el producto, sin la marca desconocida)
 * para que los anuncios hablen siempre del producto, la necesidad, la solución y el placer del usuario,
 * jamás de una marca desconocida como si fuera famosa.
 */
export function extractProductCoreIdentity(product: Partial<ProductPage>): {
  genericProductName: string;
  brandTokenRemoved: string;
  shortCategoryNoun: string;
  ultraShortObjectLabel: string;
} {
  const rawName = String(product?.nombre || 'Producto').trim();
  const cleanNoSymbols = rawName.replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim();
  const words = cleanNoSymbols.split(' ').filter(Boolean);

  let brandTokenRemoved = '';
  let genericProductName = cleanNoSymbols;

  const firstWordRaw = rawName.split(/\s+/)[0] || '';
  const hasTrademarkOnFirstWord = /[™®©]/.test(firstWordRaw);

  const commonProductNouns = /^(proyector|hidrolavadora|camara|cámara|lampara|lámpara|masajeador|taladro|reloj|smartwatch|cepillo|faja|depiladora|aspiradora|auriculares|parlante|freidora|licuadora|plancha|secador|recortadora|afeitadora|linterna|foco|ventilador|aire|calefactor|purificador|humidificador|colchon|colchón|almohada|silla|mochila|billetera|lentes|gafas|soporte|cargador|bateria|batería|arrancador|compresor|kit|set|sistema|equipo|dispositivo|maquina|máquina|selladora|balanza|tira|guirnalda|arbol|árbol|cortina|funda|corrector|rodillera|cinta|pizarra|juguete|carpa|piscina|manguera|ducha|filtro|grifo|canilla|organizador|estante|zapatero|tendedero|mopa|escoba|trapeador|batidora|picadora|vaporizador|nebulizador|oximetro|oxímetro|tensiómetro|tensiometro)/i;

  if (words.length >= 2) {
    if (hasTrademarkOnFirstWord || commonProductNouns.test(words[1])) {
      brandTokenRemoved = words[0];
      genericProductName = words.slice(1).join(' ');
    } else if (!commonProductNouns.test(words[0]) && words.length >= 3 && commonProductNouns.test(words[1])) {
      brandTokenRemoved = words[0];
      genericProductName = words.slice(1).join(' ');
    }
  }

  const spokenShort = String(product?.agentBrain?.shortProductSpoken || '').replace(/[™®©]/g, '').trim();
  if (spokenShort && spokenShort.length >= 5) {
    const cleanSpoken = brandTokenRemoved
      ? spokenShort.replace(new RegExp(`\\b${brandTokenRemoved}\\b`, 'gi'), '').replace(/\s+/g, ' ').trim()
      : spokenShort;
    if (cleanSpoken.length >= 5 && genericProductName.length < 4) {
      genericProductName = cleanSpoken;
    }
  }

  const genWords = genericProductName.split(' ').filter(Boolean);
  const connectors = /^(de|del|para|con|en|a|por|sin|contra|al)$/i;
  const twoWordObject =
    genWords.length >= 3 && connectors.test(genWords[1])
      ? genWords.slice(0, 3).join(' ')
      : genWords.slice(0, 2).join(' ') || genericProductName || 'Equipo';
  // Evitar que shortCategoryNoun termine en un número suelto (ej. "Taladro Percutor 21")
  const threeWordCandidate = genWords.slice(0, 3).join(' ');
  const shortCategoryNoun =
    genWords.length >= 3 && /^\d+$/.test(genWords[2])
      ? twoWordObject
      : threeWordCandidate || twoWordObject;

  return {
    genericProductName: genericProductName || cleanNoSymbols,
    brandTokenRemoved,
    shortCategoryNoun: shortCategoryNoun || 'este equipo',
    ultraShortObjectLabel: twoWordObject
  };
}

/**
 * Garantiza que en las primeras 1 a 4 palabras (0.0 segundos) de un texto publicitario
 * el espectador ya sepa QUÉ OBJETO ES y qué DOLOR, SOLUCIÓN, PLACER u OFERTA tiene enfrente,
 * eliminando introducciones lentas o redundantes antes de hablar del producto.
 */
export function enforceZeroSecondFirstWordsHook(
  rawText: string,
  product: Partial<ProductPage>,
  angleIdx = 0
): string {
  if (!rawText) return '';
  const { ultraShortObjectLabel } = extractProductCoreIdentity(product);
  const objUpper = ultraShortObjectLabel.toUpperCase();
  const rootNoun = (ultraShortObjectLabel.split(' ')[0] || '').toLowerCase();

  const lines = String(rawText).split('\n');
  let firstLine = (lines[0] || '').trim();
  if (!firstLine) return rawText;

  // Extraer emoji inicial si existe
  const leadingEmojiMatch = firstLine.match(/^([🔥✨💡🤝⚡📦🛑🎁🎄✅⭐]+\s*)/);
  const defaultEmojis = ['🔥 ', '🛑 ', '💡 ', '🎁 ', '⚡ ', '📦 '];
  const leadingEmoji = leadingEmojiMatch ? leadingEmojiMatch[1] : defaultEmojis[angleIdx % defaultEmojis.length];
  let bodyLine = leadingEmojiMatch ? firstLine.slice(leadingEmojiMatch[0].length).trim() : firstLine;

  // Eliminar rellenos lentos al inicio que desperdician los primeros segundos
  bodyLine = bodyLine
    .replace(/^(?:¿\s*)?(?:te imagin[aá]s|alguna vez (?:te pas[oó] que|compraste)|hasta cu[aá]ndo vas a seguir|sab[ií]as que|te preocupa pedir algo y que|quer[eé]s saber exactamente)\s+/i, '¿')
    .replace(/^¿\s*¿/, '¿')
    .trim();

  // Verificar si el objeto ya encabeza las primeras palabras (Palabra 1 o 2, ej: "PROYECTOR NAVIDEÑO..." o "2X PROYECTOR...")
  const firstFourWords = bodyLine
    .replace(/[¿?¡!:.,—\-()]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ')
    .toLowerCase();

  const rootSlice = rootNoun.slice(0, Math.min(rootNoun.length, 6));
  const startsWithObjectHeader =
    rootSlice.length >= 3 &&
    new RegExp(`^(?:2x\\s+)?${rootSlice}`, 'i').test(firstFourWords);

  if (!startsWithObjectHeader && bodyLine.length > 12) {
    const instantPrefixes = [
      `${objUpper} EN OFERTA:`,
      `${objUpper} PAGO EN PUERTA:`,
      `${objUpper} SIN COMPLICACIONES:`,
      `2X ${objUpper} EN OFERTA:`,
      `${objUpper} MÁXIMA POTENCIA:`,
      `${objUpper} KIT COMPLETO:`
    ];
    const prefix = instantPrefixes[angleIdx % instantPrefixes.length];
    const normalizedRest =
      bodyLine.startsWith('¿') || bodyLine.startsWith('¡')
        ? bodyLine
        : bodyLine.charAt(0).toLowerCase() + bodyLine.slice(1);
    firstLine = `${leadingEmoji}${prefix} ${normalizedRest}`;
    lines[0] = firstLine;
  } else {
    lines[0] = `${leadingEmoji}${bodyLine}`;
  }

  return lines.join('\n');
}

/**
 * Sanitiza cualquier texto de anuncio para eliminar:
 * 1) Promesas falsas de tiempo de entrega ("hoy mismo en tu puerta") que causan cancelaciones en COD Paraguay (el tiempo real es 2 a 3 días hábiles / 48 a 72 hs).
 * 2) Frases débiles de apertura ("Mirá la imagen:", "Mirá bien esta comparación:", "Tal como ves en la imagen:").
 * 3) Menciones huérfanas o mal conjugadas de marcas desconocidas ("una sola Noelux", "Con Noelux es al revés").
 * 4) Si es un copy multilínea (primaryText), garantiza que en las palabras 1 a 4 (0.0 segundos) ya hable directamente del objeto + dolor/solución/placer/oferta.
 */
export function sanitizeAdCopyForParaguayCod(
  rawText: string,
  product: Partial<ProductPage>,
  angleIdx = 0
): string {
  if (!rawText) return '';
  const { genericProductName, brandTokenRemoved, shortCategoryNoun } = extractProductCoreIdentity(product);
  let text = String(rawText);

  // 1. Eliminar promesas falsas de entrega en el mismo día ("HOY mismo en tu puerta")
  text = text
    .replace(/vos pod[eé]s tener esto hoy mismo en tu puerta\.?/gi, 'Reservás sin adelantos y lo recibís en 2 a 3 días hábiles en la puerta de tu casa.')
    .replace(/pod[eé]s tener(?:lo)? hoy mismo en tu puerta/gi, 'lo recibís en 2 a 3 días hábiles en la puerta de tu casa')
    .replace(/recib[ií](?:lo)? hoy mismo en tu (?:puerta|casa|domicilio)/gi, 'recibilo en 48 a 72 hs en la puerta de tu casa')
    .replace(/tener hoy mismo en tu puerta/gi, 'recibir en 2 a 3 días hábiles en tu puerta')
    .replace(/entrega hoy mismo/gi, 'entrega en 2 a 3 días hábiles');

  // 2. Eliminar arranques robóticos o débiles ("Mirá la imagen:", "Mirá bien esta comparación:", etc.)
  text = text
    .replace(/^(?:[🔥✨💡🤝⚡📦🛑🎄]+\s*)?mir[aá]\s+(?:en\s+)?la\s+imagen\s*:\s*/i, '🔥 ')
    .replace(/^(?:[🔥✨💡🤝⚡📦🛑🎄]+\s*)?mir[aá]\s+bien\s+esta\s+comparaci[oó]n\s*:\s*/i, '💡 ')
    .replace(/^(?:[🔥✨💡🤝⚡📦🛑🎄]+\s*)?tal\s+como\s+ves\s+en\s+la\s+imagen\s*:\s*/i, '🤝 ')
    .replace(/a la izquierda la fachada gris y apagada de siempre,\s*a la derecha/gi, 'Pasá de una fachada apagada a tener');

  // 3. Reemplazar menciones de la marca desconocida sola por el producto real
  if (brandTokenRemoved && brandTokenRemoved.length >= 3) {
    const escapedBrand = brandTokenRemoved.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text
      .replace(new RegExp(`\\buna sola\\s+${escapedBrand}[™®©]?\\b`, 'gi'), `un solo ${shortCategoryNoun}`)
      .replace(new RegExp(`\\bun solo\\s+${escapedBrand}[™®©]?\\b`, 'gi'), `un solo ${shortCategoryNoun}`)
      .replace(new RegExp(`\\bcon\\s+${escapedBrand}[™®©]?\\s+es al rev[eé]s\\b`, 'gi'), `con nosotros pagás recién cuando te entregamos`)
      .replace(new RegExp(`\\b${escapedBrand}[™®©]?\\s+${genericProductName.split(' ')[0]}\\b`, 'gi'), genericProductName.split(' ')[0])
      .replace(new RegExp(`\\bde\\s+${escapedBrand}[™®©]?\\b`, 'gi'), `de este ${shortCategoryNoun}`)
      .replace(new RegExp(`\\bcon\\s+${escapedBrand}[™®©]?\\b`, 'gi'), `con este ${shortCategoryNoun}`)
      .replace(new RegExp(`\\b${escapedBrand}[™®©]?\\b`, 'gi'), shortCategoryNoun);
  }

  // 4. Eliminar la jerga de comerciante "contra entrega" y reemplazarla por lenguaje claro de cliente ("pagás cuando recibís" / "pagás cuando te entregamos")
  text = text
    .replace(/\bPEDIR CONTRA ENTREGA\b/g, 'PAGÁS CUANDO RECIBÍS')
    .replace(/\bpedir contra entrega\b/gi, 'PAGÁS CUANDO RECIBÍS')
    .replace(/\bcobro contra entrega\b/gi, 'pagás cuando recibís en tu puerta')
    .replace(/\bpago contra entrega\b/gi, 'pagás cuando te entregamos')
    .replace(/\benv[ií]o contra entrega\b/gi, 'envío y pagás cuando recibís')
    .replace(/\bmodalidad contra entrega\b/gi, 'pagás recién cuando recibís')
    .replace(/\bcontra entrega\b/gi, 'pagando cuando recibís');

  text = text.replace(/[™®©]/g, '').replace(/  +/g, ' ').trim();

  // 5. Si es un bloque de anuncio multilínea, aplicar la regla de 0.0 segundos (Palabras 1 a 4 = Objeto + Dolor/Solución/Placer/Oferta)
  if (text.includes('\n')) {
    text = enforceZeroSecondFirstWordsHook(text, product, angleIdx);
  }

  return text;
}

/**
 * Sanitiza la etiqueta del botón CTA para que jamás diga "PEDIR CONTRA ENTREGA" (jerga comercial)
 * y use siempre lenguaje directo que el comprador entienda al instante ("PAGÁS CUANDO RECIBÍS").
 */
export function sanitizeCtaLabelForCustomer(rawCta: string): string {
  const clean = String(rawCta || '').trim();
  if (!clean || /contra\s*entrega/i.test(clean)) {
    return 'PAGÁS CUANDO RECIBÍS';
  }
  return clean;
}

// ────────────────────────────────────────────────────────────────────────────────
// Función: Crear perfil de cerebro vacío / por defecto
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Crea un perfil de Cerebro Maestro inicial con estado 'idle' para un producto dado.
 * Habla 100% del PRODUCTO, la necesidad, la solución y el placer desde la PALABRA 1 A 4 (0.0 segundos),
 * sin marcas desconocidas y con tiempos reales de entrega COD en Paraguay (2 a 3 días hábiles / 48 a 72 hs).
 */
export function createDefaultBrainProfile(product: ProductPage): AutoAdsBrainProfile {
  const p1 = Number(product.precios?.[1] || 189000);
  const p2 = Number(product.precios?.[2] || Math.round(p1 * 1.85));
  const p3 = Number(product.precios?.[3] || Math.round(p1 * 2.65));
  const pNormal = Number(product.precioNormal || Math.round(p1 * 1.35));
  const freeShipping = product.freeShipping !== false;
  const { genericProductName, shortCategoryNoun, ultraShortObjectLabel } = extractProductCoreIdentity(product);
  const nombre = genericProductName;
  const objUpper = ultraShortObjectLabel.toUpperCase();

  // Avatares por defecto
  const defaultAvatars: AutoAdsAvatar[] = [
    {
      id: 'avatar-a',
      name: 'María de Asunción',
      description: `Mujer de 28-48 años, busca embellecer y solucionar necesidades de su hogar sin complicaciones ni gastos excesivos.`,
      painPoints: [
        'Desconfía de pagar por adelantado en internet por miedo a estafas',
        `Quiere un ${shortCategoryNoun} que realmente cumpla lo que promete`,
        'Prefiere revisar su pedido en la puerta de su casa antes de pagar'
      ],
      angles: [
        { id: 'angle-a1', type: 'offer' as const, hook: `🔥 ${objUpper} EN OFERTA: transformá tu casa en minutos por ${formatGs(p1)} y pagá recién al recibir`, emotionalTrigger: 'placer y oferta irresistible' },
        { id: 'angle-a2', type: 'trust' as const, hook: `🛑 ${objUpper} PAGO EN PUERTA: cero giros previos, pagás al repartidor en tu casa`, emotionalTrigger: 'confianza inmediata' }
      ]
    },
    {
      id: 'avatar-b',
      name: 'Carlos de Luque',
      description: `Hombre de 25-45 años, práctico, trabaja todo el día y valora soluciones rápidas que funcionen desde el primer minuto.`,
      painPoints: [
        'Cansado de perder tiempo con métodos viejos que fallan o dan trabajo',
        'No quiere arriesgar su plata en transferencias previas',
        'Busca potencia, durabilidad real y garantía escrita'
      ],
      angles: [
        { id: 'angle-b1', type: 'social_proof' as const, hook: `⚡ ${objUpper} MÁXIMA POTENCIA: rendimiento real y materiales resistentes para uso continuo`, emotionalTrigger: 'potencia y autoridad' },
        { id: 'angle-b2', type: 'transformation' as const, hook: `💡 ${objUpper} SIN COMPLICACIONES: olvidate de renegar horas y resolvelo en 90 segundos`, emotionalTrigger: 'alivio del dolor' }
      ]
    },
    {
      id: 'avatar-c',
      name: 'Laura de Ciudad del Este',
      description: `Mujer de 24-40 años, compradora familiar que aprovecha descuentos por cantidad para su casa y para regalar a sus padres.`,
      painPoints: [
        'Quiere cubrir más espacio o regalar una segunda unidad ahorrando plata',
        'Valora que el envío sea seguro a cualquier punto del país en 2 a 3 días',
        'Quiere que la caja llegue sellada y con todos los accesorios listos para usar'
      ],
      angles: [
        { id: 'angle-c1', type: 'urgency' as const, hook: `🎁 2X ${objUpper} CON DESCUENTO: llevá 2 unidades completas con ahorro directo y envío gratis`, emotionalTrigger: 'oferta familiar irresistible' },
        { id: 'angle-c2', type: 'unboxing' as const, hook: `📦 ${objUpper} KIT COMPLETO: recibís caja sellada en tu puerta y verificás todo antes de pagar`, emotionalTrigger: 'certeza total' }
      ]
    }
  ];

  const desc = sanitizeAdCopyForParaguayCod(
    product.descripcion ||
      'Potencia, practicidad y resultados reales desde el primer uso en tu hogar',
    product
  );
  const rawMainBenefit =
    product.landingContent?.benefitCards?.[0]?.title ||
    product.agentBrain?.usageSummarySpoken ||
    '';
  const mainBenefit = sanitizeAdCopyForParaguayCod(
    rawMainBenefit && rawMainBenefit.trim() !== desc.trim()
      ? rawMainBenefit.trim()
      : 'Instalación simple en minutos y resultado inmediato sin esfuerzo',
    product
  );
  const rawTechSpecs = product.physicalTruth?.materialMain
    ? `${product.physicalTruth.materialMain}${
        product.physicalTruth.powerSourceLabel ? ` · ${product.physicalTruth.powerSourceLabel}` : ''
      }`
    : product.agentBrain?.technicalSpecsSpoken || '';
  const techSpecs = sanitizeAdCopyForParaguayCod(
    rawTechSpecs && rawTechSpecs.trim() !== desc.trim()
      ? rawTechSpecs.trim()
      : 'Materiales resistentes de alta durabilidad preparados para uso continuo',
    product
  );
  const boxItems = sanitizeAdCopyForParaguayCod(
    product.physicalTruth?.boxContents ||
      product.agentBrain?.boxContentsSpoken ||
      `1x ${nombre} completo + accesorios originales de fábrica en caja sellada`,
    product
  );

  const savingsPack2 = Math.max(20000, p1 * 2 - p2);

  // 6 Briefs de Respuesta Directa con Regla 0.0 Segundos (Palabras 1 a 4 = Objeto + Dolor/Solución/Placer/Oferta):
  const defaultBriefs: AutoAdsCreativeBrief[] = [
    {
      index: 0,
      type: 'feed_1x1',
      format: '1:1',
      archetypeName: 'Oferta Directa COD · Placer y Solución en 0.0s',
      avatarTarget: 'avatar-a',
      angleType: 'offer',
      hook3s: `🔥 ${objUpper} EN OFERTA: ${mainBenefit} por solo ${formatGs(p1)} (pagás cuando recibís)`,
      hookBadge: `🔥 ${objUpper} · PAGÁS CUANDO RECIBÍS`,
      headline: `🔥 ${ultraShortObjectLabel}: ${formatGs(p1)} · Pagás Cuando Recibís`,
      primaryText: `🔥 ${objUpper} EN OFERTA: disfrutá ${mainBenefit.toLowerCase()} en tu casa sin esfuerzo por solo ${formatGs(p1)} (antes ${formatGs(pNormal)}) y pagá recién cuando recibís.\n\n✨ Sentí el placer de ver tu hogar renovado desde el primer minuto: ${desc}.\n\n📌 Solución inmediata: ${mainBenefit}\n🛠️ Calidad real: ${techSpecs}\n📦 Kit incluido: ${boxItems}\n\n💰 1 Unidad: ${formatGs(p1)} (Antes ${formatGs(pNormal)})\n🔥 Pack 2 Unidades (MÁS ELEGIDO): ${formatGs(p2)} (Ahorrás ${formatGs(savingsPack2)})\n\n🚚 ${freeShipping ? 'Envío GRATIS a todo Paraguay (entrega en 2 a 3 días hábiles)' : 'Entrega en 2 a 3 días hábiles en todo Paraguay'}\n💵 Cero adelantos: pagás en efectivo, QR o POS recién cuando te entregamos en tu puerta.\n👇 Tocá en PAGÁS CUANDO RECIBÍS y reservá el tuyo antes de que se agote.`,
      descriptionText: `⭐ Entrega en 48 a 72 hs en todo Paraguay · Pagás cuando recibís`,
      ctaType: 'ORDER_NOW',
      ctaLabel: 'PAGÁS CUANDO RECIBÍS',
      themeIndex: 0,
      aiGeneratedImageUrl: '',
      aiImagePrompt: buildAiAdImagePromptForBrief(product, 0, 0)
    },
    {
      index: 1,
      type: 'feed_1x1',
      format: '1:1',
      archetypeName: 'Trust / Cero Riesgo Anti-Estafa',
      avatarTarget: 'avatar-b',
      angleType: 'trust',
      hook3s: `🛑 ${objUpper} PAGO EN PUERTA: recibilo en tu casa y pagá recién al verificarlo`,
      hookBadge: '✅ PAGÁS AL REPARTIDOR EN PUERTA',
      headline: `🛑 ${ultraShortObjectLabel}: Pagás Recién al Recibir`,
      primaryText: `🛑 ${objUpper} PAGO EN PUERTA: no arriesgues ni un solo Guaraní por adelantado; recibís tu pedido en 2 a 3 días hábiles y pagás recién frente al repartidor.\n\n🤝 Olvidate del miedo a las estafas en internet: reservás hoy con tu nombre y WhatsApp, y abonás únicamente cuando tenés tu ${nombre} en tus manos.\n\n✅ Caja sellada entregada en la puerta de tu casa o trabajo\n📦 Kit completo garantizado: ${boxItems}\n🛡️ Respaldo directo por WhatsApp y garantía real\n\n💰 1 Unidad: ${formatGs(p1)} (Antes ${formatGs(pNormal)})\n🔥 Pack 2 Unidades Ahorro: ${formatGs(p2)} (Te ahorrás ${formatGs(savingsPack2)})\n\n🚚 ${freeShipping ? 'Envío GRATIS a todo Paraguay (48 a 72 hs)' : 'Entrega directa en 48 a 72 hs'}\n💵 Pagás al recibir en efectivo, QR o POS.\n👇 Tocá en VER GARANTÍA Y COMPRAR y pedí el tuyo con riesgo cero.`,
      descriptionText: '🛡️ Cero pagos adelantados · Recibís en 2 a 3 días hábiles y pagás en puerta',
      ctaType: 'SHOP_NOW',
      ctaLabel: 'VER GARANTÍA Y COMPRAR',
      themeIndex: 1,
      aiGeneratedImageUrl: '',
      aiImagePrompt: buildAiAdImagePromptForBrief(product, 1, 0)
    },
    {
      index: 2,
      type: 'feed_1x1',
      format: '1:1',
      archetypeName: 'Dolor Agudo → Solución Inmediata',
      avatarTarget: 'avatar-c',
      angleType: 'transformation',
      hook3s: `💡 ${objUpper} SIN COMPLICACIONES: dejá de perder tiempo y resolvelo en minutos`,
      hookBadge: `💡 ${objUpper} · SOLUCIÓN RÁPIDA`,
      headline: `💡 ${ultraShortObjectLabel}: Solución sin Esfuerzo`,
      primaryText: `💡 ${objUpper} SIN COMPLICACIONES: dejá de renegar con métodos viejos que fallan y solucioná todo en minutos (${desc}).\n\n✨ Pasá de la frustración a la comodidad total con un solo equipo diseñado para darte resultados visibles desde el primer encendido.\n\n❌ Cero pérdidas de tiempo, esfuerzo ni gastos repetidos\n✅ Resultado inmediato: ${mainBenefit}\n🛠️ Durabilidad real: ${techSpecs}\n\n💰 1 Unidad: ${formatGs(p1)} (Antes ${formatGs(pNormal)})\n🔥 Pack 2 Unidades: ${formatGs(p2)} (Ahorro directo de ${formatGs(savingsPack2)})\n\n🚚 ${freeShipping ? 'Envío GRATIS a todo el país (llega en 48 a 72 hs)' : 'Despacho en 48 a 72 hs a todo el país'}\n💵 Pagás recién cuando el repartidor te entrega en puerta.\n👇 Tocá en QUIERO LA SOLUCIÓN y asegurá tu unidad hoy.`,
      descriptionText: `✨ Solución práctica y duradera · Pagás al recibir en tu casa`,
      ctaType: 'ORDER_NOW',
      ctaLabel: 'QUIERO LA SOLUCIÓN',
      themeIndex: 2,
      aiGeneratedImageUrl: '',
      aiImagePrompt: buildAiAdImagePromptForBrief(product, 2, 0)
    },
    {
      index: 3,
      type: 'story_9x16',
      format: '9:16',
      archetypeName: 'Pack Familiar Ahorro (2 Unidades)',
      avatarTarget: 'avatar-a',
      angleType: 'urgency',
      hook3s: `🎁 2X ${objUpper} EN OFERTA: llevá 2 unidades ahorrando ${formatGs(savingsPack2)} + envío gratis`,
      hookBadge: '⚡ PACK DÚO 2 UNIDADES CON DESCUENTO',
      headline: `🎁 2x ${ultraShortObjectLabel}: Ahorrá ${formatGs(savingsPack2)}`,
      primaryText: `🎁 2X ${objUpper} EN OFERTA: llevate 2 unidades completas por solo ${formatGs(p2)} (ahorrás ${formatGs(savingsPack2)} directo) y cubrí el doble de espacio o regalá una a tu familia.\n\n⚡ Es la promoción preferida por 8 de cada 10 compradores en Paraguay porque aprovechás dos equipos en un mismo envío gratis.\n\n📌 2x ${nombre} completos con todos sus accesorios\n✅ Doble cobertura y placer: ${mainBenefit}\n🛠️ Construcción resistente: ${techSpecs}\n\n💰 1 Unidad sola: ${formatGs(p1)}\n🔥 Pack 2 Unidades (PROMO FAMILIAR): ${formatGs(p2)} (Ahorrás ${formatGs(savingsPack2)})\n\n🚚 ${freeShipping ? 'Envío GRATIS a todo Paraguay (entrega en 2 a 3 días hábiles)' : 'Entrega en 2 a 3 días hábiles en puerta'}\n💵 Pagás recién al recibir en efectivo, QR o POS.\n👇 Tocá en QUIERO MI PACK 2 HOY antes de que termine el cupo promocional.`,
      descriptionText: `🎁 Pack Familiar 2 Unidades · Entrega en 48 a 72 hs con pago en puerta`,
      ctaType: 'ORDER_NOW',
      ctaLabel: 'QUIERO MI PACK 2 HOY',
      themeIndex: 3,
      aiGeneratedImageUrl: '',
      aiImagePrompt: buildAiAdImagePromptForBrief(product, 3, 0)
    },
    {
      index: 4,
      type: 'reel_9x16',
      format: '9:16',
      archetypeName: 'Demostración de Potencia y Verdad Física',
      avatarTarget: 'avatar-b',
      angleType: 'social_proof',
      hook3s: `⚡ ${objUpper} MÁXIMA POTENCIA: calidad superior que rinde de verdad en tu hogar`,
      hookBadge: '🔥 POTENCIA Y CALIDAD COMPROBADA',
      headline: `⚡ ${ultraShortObjectLabel}: Potencia Real Comprobada`,
      primaryText: `⚡ ${objUpper} MÁXIMA POTENCIA: olvidate de imitaciones débiles; este equipo sobresale por su rendimiento real (${desc}).\n\n🔥 Diseñado con materiales de primera para soportar el uso exigente en Paraguay y entregarte máxima satisfacción desde el primer día.\n\n🛠️ Ficha técnica real: ${techSpecs}\n✅ Desempeño superior: ${mainBenefit}\n📦 Incluye todo el kit: ${boxItems}\n\n💰 1 Unidad: ${formatGs(p1)} (Antes ${formatGs(pNormal)})\n🔥 Pack 2 Unidades: ${formatGs(p2)} (Ahorrás ${formatGs(savingsPack2)})\n\n🚚 ${freeShipping ? 'Envío GRATIS a todo Paraguay (llega en 2 a 3 días hábiles)' : 'Entrega en 2 a 3 días hábiles en tu puerta'}\n💵 Pagás recién al repartidor cuando lo tenés en tus manos.\n👇 Tocá en COMPRAR AHORA y reservá el tuyo sin adelantos.`,
      descriptionText: `🔥 Calidad verificada · Entrega en 48 a 72 hs · Pagás cuando recibís`,
      ctaType: 'SHOP_NOW',
      ctaLabel: 'COMPRAR AHORA',
      themeIndex: 0,
      aiGeneratedImageUrl: '',
      aiImagePrompt: buildAiAdImagePromptForBrief(product, 4, 0),
      videoScenes: [
        { durationSec: 3, badge: 'ESCENA 1 · POTENCIA REAL (0-3s)', title: `⚡ ${objUpper} MÁXIMA POTENCIA`, subtitle: mainBenefit.slice(0, 65), priceTag: `🔥 SOLO ${formatGs(p1)}`, bgGradient: 'from-[#041a12] via-[#0b3d2e] to-[#041a12]' },
        { durationSec: 3, badge: 'ESCENA 2 · MATERIALES (3-6s)', title: 'Construcción Sólida y Duradera', subtitle: techSpecs.slice(0, 65), priceTag: freeShipping ? '🚚 ENVÍO GRATIS (2-3 DÍAS)' : '🚚 ENTREGA EN 48-72 HS', bgGradient: 'from-[#0f172a] via-[#1e3a8a] to-[#0f172a]' },
        { durationSec: 3, badge: 'ESCENA 3 · OFERTA COD (6-9s)', title: `1 Unidad: ${formatGs(p1)}`, subtitle: `🔥 Pack Dúo 2x: ${formatGs(p2)}`, priceTag: `Antes: ${formatGs(pNormal)}`, bgGradient: 'from-[#3b0764] via-[#581c87] to-[#1e1b4b]' },
        { durationSec: 3, badge: 'ESCENA 4 · CTA FINAL (9-12s)', title: 'Pagás Recién al Recibir en Puerta', subtitle: 'Entrega en 2 a 3 días hábiles en todo Paraguay', priceTag: '✅ EFECTIVO, QR O POS', bgGradient: 'from-[#064e3b] via-[#15803d] to-[#041a12]' }
      ]
    },
    {
      index: 5,
      type: 'reel_9x16',
      format: '9:16',
      archetypeName: 'Unboxing Real · Qué Recibís en tu Caja',
      avatarTarget: 'avatar-c',
      angleType: 'unboxing',
      hook3s: `📦 ${objUpper} KIT COMPLETO: recibís caja sellada con todos los accesorios listos para usar`,
      hookBadge: '📦 UNBOXING REAL · KIT COMPLETO',
      headline: `📦 ${ultraShortObjectLabel}: Kit Completo Sellado`,
      primaryText: `📦 ${objUpper} KIT COMPLETO: recibís en tu puerta la caja sellada de fábrica con todos los accesorios originales listos para usar desde el primer minuto.\n\n👀 Sin sorpresas ni faltantes: en 2 a 3 días hábiles llega el repartidor a tu domicilio y vos revisás tu ${nombre} antes de abonar.\n\n✔️ Contenido exacto en caja: ${boxItems}\n✔️ Especificaciones reales: ${techSpecs}\n🛡️ Verificación en puerta antes de pagar\n\n💰 1 Unidad: ${formatGs(p1)} (Antes ${formatGs(pNormal)})\n🔥 Pack 2 Unidades: ${formatGs(p2)} (Ahorrás ${formatGs(savingsPack2)})\n\n🚚 ${freeShipping ? 'Envío GRATIS a todo Paraguay (48 a 72 hs)' : 'Despacho en 48 a 72 hs a domicilio'}\n💵 Pagás al recibir en efectivo, QR o POS.\n👇 Tocá en PEDIR KIT COMPLETO y asegurá el tuyo hoy.`,
      descriptionText: '📦 Kit completo en caja sellada · Entrega en 2 a 3 días y pago al recibir',
      ctaType: 'LEARN_MORE',
      ctaLabel: 'PEDIR KIT COMPLETO',
      themeIndex: 1,
      aiGeneratedImageUrl: '',
      aiImagePrompt: buildAiAdImagePromptForBrief(product, 5, 0),
      videoScenes: [
        { durationSec: 3, badge: 'ESCENA 1 · UNBOXING REAL (0-3s)', title: `📦 ${objUpper} KIT COMPLETO`, subtitle: 'Todo lo que recibís en tu casa en 2 a 3 días hábiles', priceTag: '👀 VERIFICÁS AL RECIBIR', bgGradient: 'from-[#1f0808] via-[#7f1d1d] to-[#450a0a]' },
        { durationSec: 3, badge: 'ESCENA 2 · KIT COMPLETO (3-6s)', title: boxItems.slice(0, 52), subtitle: 'Listo para instalar y disfrutar desde el primer minuto', priceTag: '📦 CAJA 100% COMPLETA', bgGradient: 'from-[#0f172a] via-[#1e3a8a] to-[#0f172a]' },
        { durationSec: 3, badge: 'ESCENA 3 · OFERTA HOY (6-9s)', title: `1 Unidad por ${formatGs(p1)}`, subtitle: `O el Pack Dúo 2x por ${formatGs(p2)}`, priceTag: `Antes: ${formatGs(pNormal)}`, bgGradient: 'from-[#3b0764] via-[#581c87] to-[#1e1b4b]' },
        { durationSec: 3, badge: 'ESCENA 4 · CTA FINAL (9-12s)', title: 'Pagás Recién al Recibir en tu Puerta', subtitle: 'Reservá hoy sin pagar nada por adelantado', priceTag: '✅ EFECTIVO, QR O POS', bgGradient: 'from-[#064e3b] via-[#15803d] to-[#041a12]' }
      ]
    }
  ];

  return {
    productId: product.id,
    productName: product.nombre,
    trainedAt: '',
    status: 'idle',

    productAnalysis: {
      name: product.nombre,
      description: product.descripcion || '',
      pricesPack1: p1,
      pricesPack2: p2,
      pricesPack3: p3,
      pricesNormal: pNormal,
      freeShipping,
      images: extractAllProductImages(product),
      physicalTruth: product.physicalTruth
        ? JSON.stringify(product.physicalTruth)
        : '',
      agentBrain: product.agentBrain
        ? JSON.stringify(product.agentBrain)
        : ''
    },

    competitorInsights: {
      searchQuery: `${nombre} Paraguay + LATAM COD`,
      activeAdsFound: 24,
      winningPatterns: [
        `Impacto en 0.0 Segundos (Palabras 1 a 4): Objeto (${objUpper}) + Dolor/Solución/Placer/Oferta de entrada sin preámbulos`,
        'Transparencia logística COD Paraguay: reserva sin adelantos, entrega en 2 a 3 días hábiles (48-72 hs) y pago al recibir en puerta',
        'Anclaje de Pack 2 Familiar con ahorro explícito en Guaraníes'
      ],
      commonHooks: [
        `🔥 ${objUpper} EN OFERTA: ${mainBenefit.toLowerCase()} por solo ${formatGs(p1)} (pagás recién al recibir)`,
        `🛑 ${objUpper} PAGO EN PUERTA: recibilo en 2 a 3 días hábiles y pagá recién al verificarlo`,
        `🎁 2X ${objUpper} CON DESCUENTO: llevate 2 unidades ahorrando ${formatGs(savingsPack2)} con envío gratis`
      ],
      commonAngles: [
        'Oferta Grand Slam en 0.0s (Objeto + Beneficio + Precio en Palabras 1 a 4)',
        'Confianza Total Anti-Estafa: "No girás nada antes, pagás al repartidor en tu puerta"',
        'Dolor Cotidiano Agudo → Solución y Placer Inmediato desde la primera palabra'
      ],
      dominantFormats: ['Feed 1:1 (1080×1080)', 'Story 9:16', 'Video Reel 9:16 (4 Escenas)'],
      avgLongevityDays: 34
    },

    avatars: defaultAvatars,
    targeting: {
      country: 'PY',
      minAge: 18,
      maxAge: 65,
      genderBalance: 'all',
      peakHours: [8, 12, 19, 21],
      optimizationGoal: 'OUTCOME_SALES',
      bidStrategy: 'LOWEST_COST_WITHOUT_CAP'
    },

    creativeBriefs: defaultBriefs
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// Función: System Prompt para entrenamiento del Cerebro Maestro con GLM-5.3
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Construye el system prompt exhaustivo para que GLM-5.3 entrene el Cerebro Maestro.
 * Incluye reglas Andrómeda, fórmula COD LATAM, matriz Avatar-Ángulo,
 * 6 arquetipos creativos y especificaciones Paraguay.
 */
export function buildBrainTrainingSystemPrompt(product: ProductPage): string {
  const p1 = Number(product.precios?.[1] || 189000);
  const p2 = Number(product.precios?.[2] || Math.round(p1 * 1.85));
  const p3 = Number(product.precios?.[3] || Math.round(p1 * 2.65));
  const pNormal = Number(product.precioNormal || Math.round(p1 * 1.35));
  const freeShipping = product.freeShipping !== false;
  const img = product.imagen || '/assets/real/galeria-1.jpg';
  const desc = product.descripcion || 'Producto de calidad premium con entrega en todo Paraguay.';

  const physicalTruthBlock = product.physicalTruth
    ? `
## Ficha Técnica Real del Producto (Physical Truth):
- Fuente de energía: ${product.physicalTruth.powerSourceLabel}
- Dimensiones: ${product.physicalTruth.realDimensions}
- Peso aprox: ${product.physicalTruth.weightApprox}
- Material principal: ${product.physicalTruth.materialMain}
- Contenido de caja: ${product.physicalTruth.boxContents}
- Resistencia al agua: ${product.physicalTruth.waterResistance}
- Garantía: ${product.physicalTruth.warrantyDays} días
${product.physicalTruth.hasVariants ? `- Variantes (${product.physicalTruth.variantLabel}): ${(product.physicalTruth.variantOptions || []).join(', ')}` : '- Sin variantes'}
`
    : '';

  const agentBrainBlock = product.agentBrain
    ? `
## Conocimiento del Agente de Ventas (Brain Previo):
- Nombre corto producto: ${product.agentBrain.shortProductSpoken}
- Categoría: ${product.agentBrain.productCategoryLabel}
- Specs hablados: ${product.agentBrain.technicalSpecsSpoken}
- Contenido caja: ${product.agentBrain.boxContentsSpoken}
- Uso resumido: ${product.agentBrain.usageSummarySpoken}
- Potencia/Resistencia: ${product.agentBrain.powerAndResistanceSpoken}
- Garantía hablada: ${product.agentBrain.warrantySpoken}
- Pitch Pack 2: ${product.agentBrain.upsellPack2PitchSpoken}
`
    : '';

  return `# SISTEMA AUTOADS — CEREBRO MAESTRO ANDRÓMEDA
Eres el Cerebro Maestro del sistema AutoAds. Tu misión es analizar un producto COD (Cash on Delivery) vendido en Paraguay y generar un perfil completo de campaña publicitaria Meta Ads con máxima diversidad conceptual.

═══════════════════════════════════════════════════════
## REGLAS ANDRÓMEDA (PRINCIPIOS FUNDAMENTALES)
═══════════════════════════════════════════════════════

### 1. El Creativo ES el Targeting
En Meta Ads moderno, el algoritmo de entrega se optimiza según QUIÉN interactúa con cada anuncio.
Si todos tus creativos dicen lo mismo con distinto color, Meta los muestra al MISMO micro-segmento.
La DIVERSIDAD CONCEPTUAL (distintos ángulos, hooks, formatos) es lo que fuerza a Meta a explorar
audiencias diferentes. No cambies colores — cambiá la PROPUESTA DE VALOR y el LENGUAJE.

### 2. Diversidad Conceptual, NO Cosmética
- INCORRECTO: 3 anuncios de "oferta con precio" en distintos fondos → mismo Entity ID cluster
- CORRECTO: 1 oferta directa + 1 trust/UGC + 1 antes/después + 1 unboxing = 4 clusters distintos
- Cada creativo debe SENTIRSE como un anuncio de una marca distinta hablándole a una persona distinta

### 3. Evitar Clustering de Entity ID
Meta agrupa anuncios similares en el mismo "Entity ID cluster". Si tus 6 creativos caen en 1-2 clusters,
estás pagando 6x por llegar a la misma gente. La meta es que cada creativo abra su propio cluster:
- Distintos hooks emocionales (miedo, aspiración, urgencia, curiosidad, humor)
- Distintos formatos (1:1 feed, 9:16 story, 9:16 reel con escenas)
- Distintas estructuras de copy (corto vs largo, pregunta vs afirmación, historia vs lista)
- Distintos CTAs (pedir, ver garantía, ver si es real)

═══════════════════════════════════════════════════════
## FÓRMULA DE ANUNCIO GANADOR COD LATAM
═══════════════════════════════════════════════════════

Estructura probada para anuncios de productos físicos con pago contra entrega en Latinoamérica:

### Estructura del Video/Imagen:
1. **Hook (0-3 segundos)**: Capturar atención INMEDIATA. Pregunta provocadora, dato impactante,
   visual llamativo, o afirmación controversial. El 80% del éxito está aquí.
2. **Dolor/Problema (3-12 segundos)**: Conectar con la frustración diaria del avatar.
   "¿Te cansaste de...?", "¿Cuántas veces ya te pasó que...?"
3. **Solución/Producto (12-30 segundos)**: Presentar el producto como la solución natural.
   Mostrar beneficios tangibles, no features. Incluir prueba social si hay.
4. **CTA COD (últimos 5 segundos)**: "Tocá el botón, completá nombre y celular,
   y pagá recién cuando el repartidor llegue a tu casa."

### Fórmula del Copy (Primary Text):
- Línea 1: Hook que detiene el scroll (pregunta, dato, emoji impactante)
- Línea 2-3: Dolor del avatar con empatía
- Línea 4-5: Solución y beneficios bullet points
- Línea 6: Oferta con precios en Gs. (1 unidad y Pack 2)
- Línea 7: Envío gratis / garantía / WhatsApp
- Línea 8: CTA explícito de pago contra entrega

═══════════════════════════════════════════════════════
## METODOLOGÍA AVATAR-ÁNGULO (MATRIZ DE DIVERSIDAD)
═══════════════════════════════════════════════════════

### Paso 1: Generar 3 Avatares (Buyer Personas)
Para cada producto, crea 3 personas compradoras GENUINAMENTE DISTINTAS:
- Avatar A: El comprador por NECESIDAD (tiene un problema urgente que resolver)
- Avatar B: El comprador por CONVENIENCIA (busca mejorar algo que ya tiene)
- Avatar C: El comprador por REGALO/SOCIAL (compra para otros, influenciado por tendencias)

Cada avatar debe tener:
- Nombre representativo paraguayo
- Descripción demográfica y psicográfica
- 3-4 pain points específicos
- 2-3 ángulos de ataque personalizados

### Paso 2: Cruzar Avatares × Ángulos → 6 Creativos Diversos
Cada creativo debe combinar un avatar distinto con un ángulo distinto para maximizar
la diversidad de Entity IDs en Meta.

═══════════════════════════════════════════════════════
## LOS 6 ARQUETIPOS CREATIVOS (OBLIGATORIOS)
═══════════════════════════════════════════════════════

Debes generar EXACTAMENTE 6 briefs creativos siguiendo estos arquetipos:

### Arquetipo 1: Feed 1:1 — Oferta Directa COD
- Formato: Imagen 1080×1080
- Ángulo: Oferta irresistible + cero riesgo
- El precio en Gs. es el protagonista visual
- Badge de envío gratis prominente
- CTA: "PEDIR CONTRA ENTREGA"
- Copy: directo, con precios 1x y 2x, bullet points de valor

### Arquetipo 2: Feed 1:1 — Trust / Cero Riesgo
- Formato: Imagen 1080×1080
- Ángulo: Eliminar miedo a estafa online
- Estilo UGC/orgánico (como si lo publicara un cliente real)
- Enfatizar: "Verificá antes de pagar", garantía escrita, WhatsApp directo
- CTA: "VER GARANTÍA Y COMPRAR"
- Copy: conversacional, de persona a persona, con emojis moderados

### Arquetipo 3: Feed 1:1 — Problema → Solución
- Formato: Imagen 1080×1080
- Ángulo: Antes/después, dolor→alivio
- Empezar con el PROBLEMA cotidiano que resuelve
- Mostrar la transformación tangible
- CTA: "QUIERO LA SOLUCIÓN"
- Copy: empático, storytelling corto, conectar emocionalmente

### Arquetipo 4: Story 9:16 — Pack Familiar Ahorro
- Formato: Imagen vertical 1080×1920
- Ángulo: Upsell Pack 2 + urgencia
- Enfoque en ahorro familiar: "Llevá 2 y regalá uno"
- Precio del pack prominente con descuento visible
- CTA: "QUIERO MI PACK HOY"
- Copy: urgencia real (stock limitado), social proof (78% eligen pack 2)

### Arquetipo 5: Reel 9:16 — Demostración de Impacto
- Formato: Video 1080×1920 (4 escenas dinámicas)
- Ángulo: Social proof visual, producto en acción
- Escena 1 (0-3s): Hook visual impactante
- Escena 2 (3-6s): Beneficio/demo en uso real
- Escena 3 (6-9s): Oferta de packs con precios
- Escena 4 (9-12s): CTA con pago al recibir
- CTA: "COMPRAR AHORA"
- Copy: conciso y orientado a la acción

### Arquetipo 6: Reel 9:16 — Unboxing "¿Es Estafa?"
- Formato: Video 1080×1920 (4 escenas narrativas)
- Ángulo: Unboxing trust-building, aprovechar el miedo
- Narrativa: "Compré esto por internet y mirá lo que me llegó..."
- Escena 1: Gancho de duda/curiosidad
- Escena 2: Apertura del paquete (tensión)
- Escena 3: Revelación — producto real, calidad confirmada
- Escena 4: CTA con garantía y pago COD
- CTA: "VER SI ES REAL"
- Copy: storytelling en primera persona, casual, paraguayo

═══════════════════════════════════════════════════════
## ESPECIFICACIONES PARAGUAY 🇵🇾
═══════════════════════════════════════════════════════

- Moneda: Guaraníes (Gs.) — formato: "Gs. 189.000"
- Envío: GRATIS a domicilio en todo Paraguay (si aplica)
- Método de pago: Contra Entrega (COD) — efectivo o QR al repartidor
- Confirmación: Por WhatsApp antes del envío
- Ciudades principales: Asunción, Luque, San Lorenzo, Fernando de la Mora, Lambaré, Ciudad del Este, Encarnación
- Tono: Directo pero cálido, evitar argentinismos, usar "vos" paraguayo
- Horarios pico de compra: 8-9am, 12-1pm, 7-9pm
- Desconfianza alta a compras online → el ángulo Trust es CLAVE

═══════════════════════════════════════════════════════
## DATOS DEL PRODUCTO A ANALIZAR
═══════════════════════════════════════════════════════

- **Nombre**: ${product.nombre}
- **Descripción**: ${desc}
- **Imagen principal**: ${img}
- **Precio 1 unidad**: ${formatGs(p1)}
- **Precio Pack 2**: ${formatGs(p2)}
- **Precio Pack 3**: ${formatGs(p3)}
- **Precio Normal (tachado)**: ${formatGs(pNormal)}
- **Envío Gratis**: ${freeShipping ? 'SÍ' : 'NO'}
- **Slug**: ${product.slug || ''}
- **Nicho**: ${product.nicheId || 'general'}
- **Sub-nicho**: ${product.subNicheId || ''}
- **Ángulo tag**: ${product.angleTag || ''}
${physicalTruthBlock}
${agentBrainBlock}

═══════════════════════════════════════════════════════
## FORMATO DE RESPUESTA (JSON ESTRICTO)
═══════════════════════════════════════════════════════

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin comentarios, sin texto antes o después).
El JSON debe tener esta estructura exacta:

{
  "avatars": [
    {
      "id": "avatar-a",
      "name": "Nombre Paraguayo",
      "description": "Descripción demográfica y psicográfica completa",
      "painPoints": ["dolor1", "dolor2", "dolor3"],
      "angles": [
        {
          "id": "angle-a1",
          "type": "offer|trust|transformation|urgency|social_proof|unboxing",
          "hook": "Frase de hook de 0-3 segundos",
          "emotionalTrigger": "Emoción que activa: miedo, aspiración, etc."
        }
      ]
    }
  ],
  "targeting": {
    "country": "PY",
    "minAge": 18,
    "maxAge": 65,
    "genderBalance": "all|male|female",
    "peakHours": [8, 12, 19, 21],
    "optimizationGoal": "OUTCOME_SALES",
    "bidStrategy": "LOWEST_COST_WITHOUT_CAP"
  },
  "competitorInsights": {
    "searchQuery": "consulta que usarías para buscar competencia en Meta Ad Library",
    "activeAdsFound": 0,
    "winningPatterns": ["patrón 1", "patrón 2"],
    "commonHooks": ["hook común 1", "hook común 2"],
    "commonAngles": ["ángulo común 1"],
    "dominantFormats": ["imagen 1:1", "video 9:16"],
    "avgLongevityDays": 14
  },
  "creativeBriefs": [
    {
      "index": 0,
      "type": "feed_1x1",
      "format": "1:1",
      "archetypeName": "Oferta Directa COD",
      "avatarTarget": "avatar-a",
      "angleType": "offer",
      "hook3s": "frase que detiene el scroll en 3 segundos",
      "hookBadge": "BADGE CORTO PARA LA IMAGEN (max 34 chars)",
      "headline": "Titular principal del anuncio (max 52 chars)",
      "primaryText": "Texto principal completo del anuncio con saltos de línea, emojis, precios en Gs., bullet points, y CTA final. Mínimo 4 líneas.",
      "descriptionText": "Línea corta de descripción bajo el titular (max 70 chars)",
      "ctaType": "ORDER_NOW",
      "ctaLabel": "PEDIR CONTRA ENTREGA",
      "themeIndex": 0,
      "aiImagePrompt": "Commercial Facebook Ad Hero Poster for ${product.nombre} in real-world action demonstrating its main benefit, 8k photorealistic, zero text overlays"
    },
    {
      "index": 1,
      "type": "feed_1x1",
      "format": "1:1",
      "archetypeName": "Trust / Cero Riesgo",
      "avatarTarget": "avatar-b",
      "angleType": "trust",
      "hook3s": "...",
      "hookBadge": "✅ PAGÁS AL REPARTIDOR EN PUERTA",
      "headline": "...",
      "primaryText": "...",
      "descriptionText": "...",
      "ctaType": "SHOP_NOW",
      "ctaLabel": "VER GARANTÍA Y COMPRAR",
      "themeIndex": 1,
      "aiImagePrompt": "Authentic Cash-on-Delivery lifestyle ad in Paraguay: friendly delivery courier handing the ${product.nombre} package at the front door to a smiling homeowner paying cash in Guaraníes, 8k, zero text overlays"
    },
    {
      "index": 2,
      "type": "feed_1x1",
      "format": "1:1",
      "archetypeName": "Problema → Solución",
      "avatarTarget": "avatar-c",
      "angleType": "transformation",
      "hook3s": "...",
      "hookBadge": "💡 ANTES VS. DESPUÉS COMPROBADO",
      "headline": "...",
      "primaryText": "...",
      "descriptionText": "...",
      "ctaType": "ORDER_NOW",
      "ctaLabel": "QUIERO LA SOLUCIÓN",
      "themeIndex": 2,
      "aiImagePrompt": "Split-screen BEFORE vs AFTER commercial Meta Ad for ${product.nombre}: left side frustrating problem before, right side instant solution and transformation with ${product.nombre}, 8k, zero text overlays"
    },
    {
      "index": 3,
      "type": "story_9x16",
      "format": "9:16",
      "archetypeName": "Pack Familiar Ahorro",
      "avatarTarget": "avatar-a",
      "angleType": "urgency",
      "hook3s": "...",
      "hookBadge": "⚡ PACK DÚO 2 UNIDADES EN OFERTA",
      "headline": "...",
      "primaryText": "...",
      "descriptionText": "...",
      "ctaType": "ORDER_NOW",
      "ctaLabel": "QUIERO MI PACK HOY",
      "themeIndex": 3,
      "aiImagePrompt": "Vertical 9:16 Instagram Story bundle promotion ad: two identical units of ${product.nombre} displayed side by side on a sleek modern podium with warm lifestyle background, 8k, zero text overlays"
    },
    {
      "index": 4,
      "type": "reel_9x16",
      "format": "9:16",
      "archetypeName": "Demostración de Impacto",
      "avatarTarget": "avatar-b",
      "angleType": "social_proof",
      "hook3s": "...",
      "hookBadge": "🔥 DEMOSTRACIÓN DE CALIDAD REAL",
      "headline": "...",
      "primaryText": "...",
      "descriptionText": "...",
      "ctaType": "SHOP_NOW",
      "ctaLabel": "COMPRAR AHORA",
      "themeIndex": 0,
      "aiImagePrompt": "Vertical 9:16 Reels macro action shot of ${product.nombre} operating at peak performance showing build quality and materials, 8k commercial photography, zero text overlays",
      "videoScenes": [
        {
          "durationSec": 3,
          "badge": "ESCENA 1 · HOOK (0-3s)",
          "title": "🔥 Título impactante de la escena",
          "subtitle": "Subtítulo descriptivo",
          "priceTag": "⚡ CALIDAD COMPROBADA",
          "bgGradient": "from-[#041a12] via-[#0b3d2e] to-[#041a12]"
        }
      ]
    },
    {
      "index": 5,
      "type": "reel_9x16",
      "format": "9:16",
      "archetypeName": "Unboxing ¿Es Estafa?",
      "avatarTarget": "avatar-c",
      "angleType": "unboxing",
      "hook3s": "...",
      "hookBadge": "📦 UNBOXING REAL · CAJA COMPLETA",
      "headline": "...",
      "primaryText": "...",
      "descriptionText": "...",
      "ctaType": "LEARN_MORE",
      "ctaLabel": "VER SI ES REAL",
      "themeIndex": 1,
      "aiImagePrompt": "Vertical 9:16 first-person POV hands unboxing the ${product.nombre} box on a wooden home table revealing the authentic product and all included accessories neatly arranged, 8k, zero text overlays",
      "videoScenes": [
        {
          "durationSec": 3,
          "badge": "ESCENA 1 · GANCHO (0-3s)",
          "title": "📦 Abriendo la caja...",
          "subtitle": "...",
          "priceTag": "👀 VERIFICÁS AL RECIBIR",
          "bgGradient": "from-[#1f0808] via-[#7f1d1d] to-[#450a0a]"
        }
      ]
    }
  ]
}

REGLAS FINALES OBLIGATORIAS PARA LA POTENCIA DEL COPY Y RESPUESTA:
1. Los 3 avatares deben ser personas REALES de Paraguay con nombres locales (Asunción, Luque, Ciudad del Este, San Lorenzo, Encarnación).
2. Los 6 creativeBriefs DEBEN seguir los 6 arquetipos en ORDEN (índice 0-5).
3. PROHIBIDO GENERAR TEXTOS PLANOS O SIN EMOJIS: Cada "primaryText" DEBE ser una obra maestra de Direct-Response Copywriting (nivel Eugene Schwartz, Alex Hormozi y Sabri Suby) de 6 a 9 líneas bien estructuradas con saltos de línea (\\n) e iconos/emojis estratégicos en CADA bloque:
   - Línea 1 (Hook Disruptivo con Emoji: 🔥, 🛑, ✨, ⚡, 🤝, 📦).
   - Línea 2-3 (Dolor agudo o transformación visual congruente al 100% con la escena de la imagen).
   - Línea 4-6 (Viñetas de beneficios tangibles y Verdad Física con ✅, 📌, 🛠️, ✔️).
   - Línea 7-8 (Anclaje de Precios reales: 💰 1 Unidad: ${formatGs(p1)} | 🔥 Pack 2 Unidades Ahorro: ${formatGs(p2)} — Antes ${formatGs(pNormal)}).
   - Línea 9 (Cero Riesgo COD + Llamado a la Acción: 🚚 Envío Gratis · 💵 Pagás recién al repartidor en tu puerta · 👇 Tocá el botón para reservar).
4. Cada "headline" y cada "hookBadge" DEBE incluir un emoji potente al inicio y ser 100% congruente con la escena visual de ese arquetipo.
5. Los precios SIEMPRE en formato "Gs. XXX.XXX" usando exactamente los datos reales del producto.
6. Los videoScenes son obligatorios para los índices 4 y 5 (reels), con 4 escenas dinámicas cada uno.
7. Cada brief DEBE incluir su "aiImagePrompt" en inglés fotorrealista 8K describiendo la escena exacta sin texto superpuesto ("zero text overlays").
8. NO incluyas bloques markdown (\`\`\`json), NO incluyas comentarios JS, responde SOLO el objeto JSON puro válido.
`;
}

// ────────────────────────────────────────────────────────────────────────────────
// Función: Generar activos creativos desde el Cerebro Maestro entrenado
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Array de imágenes de respaldo (vía vacía, cero imágenes pre-cargadas de prueba).
 */
export const AI_GENERATED_AD_ARCHETYPE_IMAGES: string[] = [];

/**
 * Construye el prompt publicitario 100% UNIVERSAL de Generación de Imagen IA para CUALQUIER producto,
 * sincronizado con la PRIMERA ESTROFA exacta de ese anuncio, el titular y el botón CTA.
 */
export function buildAiAdImagePromptForBrief(
  product: ProductPage,
  briefIndex: number,
  variationSeed = 0,
  firstStanzaText?: string,
  headlineText?: string,
  ctaLabelText?: string
): string {
  const { genericProductName, ultraShortObjectLabel } = extractProductCoreIdentity(product);
  const objUpper = ultraShortObjectLabel.toUpperCase();
  const name = genericProductName || product?.nombre || 'Producto Premium';
  const desc = sanitizeAdCopyForParaguayCod(product?.descripcion || '', product).slice(0, 140);
  const mainBenefit = sanitizeAdCopyForParaguayCod(
    product?.landingContent?.benefitCards?.[0]?.title ||
      product?.agentBrain?.usageSummarySpoken ||
      desc,
    product
  );
  const techSpecs = sanitizeAdCopyForParaguayCod(
    product?.physicalTruth?.materialMain
      ? `${product.physicalTruth.materialMain}${
          product.physicalTruth.powerSourceLabel ? `, ${product.physicalTruth.powerSourceLabel}` : ''
        }`
      : product?.agentBrain?.technicalSpecsSpoken || desc,
    product
  );
  const boxItems = sanitizeAdCopyForParaguayCod(
    product?.physicalTruth?.boxContents ||
      product?.agentBrain?.boxContentsSpoken ||
      `${name} and all original factory accessories`,
    product
  );
  const p1 = Number(product?.precios?.[1] || 189000);
  const p2 = Number(product?.precios?.[2] || Math.round(p1 * 1.85));

  const cleanFirstStanza = String(firstStanzaText || '')
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 190);

  const stanzaVisualDirective = cleanFirstStanza
    ? `Scene must visually depict the exact offer, pain relief, or pleasure stated in this ad's opening stanza: "${cleanFirstStanza}". `
    : '';

  const styles = [
    '8k ultra-detailed high-converting Meta Ads poster photography, vibrant commercial contrast, razor-sharp focus',
    'photorealistic Latin American direct-response advertising poster, dramatic lighting, Sony A7R V 85mm lens',
    'cinematic high-impact e-commerce ad poster, vivid colors, ultra-clear product action and visible human result'
  ];
  const styleSuffix = styles[variationSeed % styles.length];

  const defaultHeadlines = [
    `${objUpper} EN OFERTA - Gs. ${p1.toLocaleString('es-PY')}`,
    `${objUpper} PAGO EN PUERTA - CERO RIESGO`,
    `${objUpper} SIN COMPLICACIONES`,
    `2X ${objUpper} EN OFERTA - Gs. ${p2.toLocaleString('es-PY')}`,
    `${objUpper} MÁXIMA POTENCIA`,
    `${objUpper} KIT COMPLETO SELLADO`
  ];
  const defaultCtas = [
    'PAGÁS CUANDO RECIBÍS',
    'VER GARANTÍA Y COMPRAR',
    'QUIERO LA SOLUCIÓN',
    'QUIERO MI PACK 2 HOY',
    'COMPRAR AHORA',
    'PEDIR KIT COMPLETO'
  ];

  const topHeadline = String(headlineText || defaultHeadlines[briefIndex % defaultHeadlines.length])
    .replace(/[🔥🛑💡🎁⚡📦✨✅]/g, '')
    .trim();
  const bottomCta = sanitizeCtaLabelForCustomer(
    String(ctaLabelText || defaultCtas[briefIndex % defaultCtas.length]).trim()
  );

  const promptsByArchetype = [
    `High-Impact Direct-Response Facebook Ad Poster for "${name}" (${desc}): ${stanzaVisualDirective}Clearly show the authentic physical "${name}" in the foreground ACTIVELY BEING USED and visibly producing its real-world result and immediate pleasure/benefit (${mainBenefit}) for a delighted user/family. Include bold, legible Spanish advertising headline text at the top reading "${topHeadline}" and a high-contrast CTA button at the bottom reading "${bottomCta}", ${styleSuffix}`,
    `High-Impact Cash-on-Delivery Trust Ad Poster for "${name}" (${desc}): ${stanzaVisualDirective}In the foreground a smiling customer at their front door receives and tests the "${name}" from a friendly delivery courier while the "${name}" is actively working in real use showing its visible result (${mainBenefit}) before paying. Include bold Spanish ad headline text "${topHeadline}" and a CTA button badge "${bottomCta}", ${styleSuffix}`,
    `High-Impact BEFORE vs AFTER Split-Screen Ad Poster for "${name}" (${desc}): ${stanzaVisualDirective}Left side ("ANTES") shows a person struggling with the problem before having "${name}"; right side ("DESPUÉS") shows the person actively using "${name}" and experiencing the immediate solution and visible result (${mainBenefit}). Include bold Spanish header text "${topHeadline}" and CTA button badge "${bottomCta}", ${styleSuffix}`,
    `High-Impact Pack 2x Bundle Ad Poster for "${name}" (${desc}): ${stanzaVisualDirective}Two identical units of "${name}" prominently shown in active use producing double the real-world benefit (${mainBenefit}) for a happy family. Include bold Spanish ad header text "${topHeadline}" and CTA button badge "${bottomCta}", ${styleSuffix}`,
    `Vertical 9:16 Live-Action Commercial Video Reel for "${name}" (${techSpecs}): ${stanzaVisualDirective}A realistic charismatic Latin American human avatar presenter is filmed on camera holding, installing, and switching ON the physical "${name}" in real time. The camera moves dynamically as the avatar activates the "${name}" and points with excitement at the dramatic real-world result (${mainBenefit}) happening live around them. Full human motion, natural facial expressions, cinematic video action, bold Spanish hook "${topHeadline}" and CTA "${bottomCta}"`,
    `Vertical 9:16 Live-Action UGC & Avatar Demonstration Video Reel for "${name}": ${stanzaVisualDirective}A happy realistic Latin American customer avatar on camera holds the unboxed "${name}" with its accessories (${boxItems}), plugs and turns it ON right in front of the lens, and demonstrates the live moving transformation (${mainBenefit}) in real time while smiling at the camera. Authentic human avatar movement, smooth handheld video motion, bold Spanish headline "${topHeadline}" and CTA "${bottomCta}"`
  ];

  return promptsByArchetype[briefIndex % promptsByArchetype.length];
}

/**
 * Extrae las imágenes reales del producto para la landing o como base si no hay imagen IA generada aún.
 */
export function extractAllProductImages(
  product: ProductPage,
  extraImages?: string[]
): string[] {
  const candidates: string[] = [
    ...(Array.isArray(extraImages) ? extraImages : []),
    product?.imagen || '',
    ...(Array.isArray(product?.landingContent?.galleryItems)
      ? product.landingContent!.galleryItems.map(g => g?.src || '')
      : []),
    ...(Array.isArray(product?.landingContent?.benefitCards)
      ? product.landingContent!.benefitCards.map(b => b?.img || '')
      : [])
  ];
  const unique: string[] = [];
  for (const raw of candidates) {
    const clean = String(raw || '').trim();
    if (clean && !unique.includes(clean)) {
      unique.push(clean);
    }
  }
  return unique.length > 0 ? unique : [product?.imagen || ''];
}

/**
 * Toma el perfil del cerebro entrenado y genera 6 GeneratedAdCreativeAsset listos para
 * previsualizar como anuncios reales de Facebook/Instagram con IMÁGENES CREADAS POR IA.
 */
export function buildCreativeAssetsFromBrain(
  product: ProductPage,
  brain: AutoAdsBrainProfile
): GeneratedAdCreativeAsset[] {
  // Respetar SIEMPRE el precio en tiempo real del producto actual (product.precios) por encima de cualquier caché previa
  const p1 = Number(product.precios?.[1] || brain.productAnalysis.pricesPack1 || 189000);
  const p2 = Number(product.precios?.[2] || brain.productAnalysis.pricesPack2 || Math.round(p1 * 1.85));
  const pNormal = Number(product.precioNormal || brain.productAnalysis.pricesNormal || Math.round(p1 * 1.35));
  const freeShipping = product.freeShipping !== undefined ? product.freeShipping !== false : brain.productAnalysis.freeShipping;

  const oldP1 = brain.productAnalysis.pricesPack1;
  const oldP2 = brain.productAnalysis.pricesPack2;
  const oldPNormal = brain.productAnalysis.pricesNormal;

  const syncRealTimePricesInText = (txt: string): string => {
    let out = txt;
    if (oldP1 && oldP1 !== p1) {
      out = out.split(oldP1.toLocaleString('es-PY')).join(p1.toLocaleString('es-PY'));
    }
    if (oldP2 && oldP2 !== p2) {
      out = out.split(oldP2.toLocaleString('es-PY')).join(p2.toLocaleString('es-PY'));
    }
    if (oldPNormal && oldPNormal !== pNormal) {
      out = out.split(oldPNormal.toLocaleString('es-PY')).join(pNormal.toLocaleString('es-PY'));
    }
    return out;
  };

  if (!brain.creativeBriefs || brain.creativeBriefs.length === 0) {
    return [];
  }

  const typeMapping: Record<AutoAdsCreativeBrief['type'], GeneratedAdCreativeAsset['type']> = {
    'feed_1x1': 'image_feed_1x1',
    'story_9x16': 'image_story_9x16',
    'reel_9x16': 'video_reel_9x16'
  };

  const formatLabelMapping: Record<AutoAdsCreativeBrief['type'], string> = {
    'feed_1x1': 'Imagen IA Feed 1:1 (1080×1080)',
    'story_9x16': 'Imagen IA Story 9:16 (1080×1920)',
    'reel_9x16': 'Video Reel IA 9:16 (4 Escenas)'
  };

  return brain.creativeBriefs.map((brief, idx) => {
    const aspectRatio = brief.format || (brief.type === 'feed_1x1' ? '1:1' : '9:16');
    const themeIdx = (brief.themeIndex ?? idx) % CREATIVE_COLOR_THEMES.length;

    const cleanHeadline = syncRealTimePricesInText(
      sanitizeAdCopyForParaguayCod(brief.headline || product.nombre, product, idx)
    );
    const cleanPrimaryText = syncRealTimePricesInText(
      sanitizeAdCopyForParaguayCod(brief.primaryText || '', product, idx)
    );
    const cleanDescText = syncRealTimePricesInText(
      sanitizeAdCopyForParaguayCod(
        brief.descriptionText || 'Entrega en 2 a 3 días hábiles · Pagás cuando recibís',
        product,
        idx
      )
    );
    const ctaLabel = sanitizeCtaLabelForCustomer(brief.ctaLabel || 'PAGÁS CUANDO RECIBÍS');
    const cleanHookBadge = sanitizeAdCopyForParaguayCod(
      brief.hookBadge || '🔥 OFERTA · PAGÁS CUANDO RECIBÍS',
      product,
      idx
    );

    // Construir o enriquecer el aiImagePrompt para que siempre sea 100% congruente con la PRIMERA ESTROFA de este anuncio específico
    const aiImagePrompt = buildAiAdImagePromptForBrief(
      product,
      idx,
      0,
      cleanPrimaryText,
      cleanHeadline,
      ctaLabel
    );
    const aiGeneratedImageUrl = brief.aiGeneratedImageUrl || '';
    const aiGeneratedVideoUrl = brief.aiGeneratedVideoUrl || '';
    const productImage = aiGeneratedImageUrl || product.imagen || '';

    const imageDataUrl = buildHighImpactAdSvgDataUrl({
      productName: product.nombre,
      productImage,
      pricePack1Gs: p1,
      pricePack2Gs: p2,
      normalPriceGs: pNormal,
      freeShipping,
      aspectRatio,
      hookBadge: cleanHookBadge,
      headline: cleanHeadline,
      subHeadline: cleanDescText.slice(0, 70),
      ctaLabel,
      themeIndex: themeIdx
    });

    const asset: GeneratedAdCreativeAsset = {
      id: `autoads-${brief.index ?? idx}-${product.id}-${Date.now()}-${idx}`,
      type: typeMapping[brief.type] || 'image_feed_1x1',
      formatLabel: `${formatLabelMapping[brief.type] || 'Imagen IA Feed 1:1'} · ${brief.archetypeName || 'Andrómeda'}`,
      aspectRatio,
      angleTitle: `Ángulo #${(brief.index ?? idx) + 1} · ${brief.archetypeName || 'Andrómeda'} (${brief.angleType || 'offer'})`,
      hookBadge: cleanHookBadge,
      headline: cleanHeadline,
      primaryText: cleanPrimaryText,
      descriptionText: cleanDescText,
      ctaType: brief.ctaType || 'ORDER_NOW',
      ctaLabel,
      visualThemeIndex: themeIdx,
      imageDataUrl,
      aiGeneratedImageUrl,
      aiGeneratedVideoUrl,
      aiImagePrompt
    };

    if (brief.videoScenes && brief.videoScenes.length > 0) {
      asset.videoScenes = brief.videoScenes.map((scene) => ({
        durationSec: scene.durationSec,
        badge: scene.badge,
        title: syncRealTimePricesInText(sanitizeAdCopyForParaguayCod(scene.title, product, idx)),
        subtitle: syncRealTimePricesInText(sanitizeAdCopyForParaguayCod(scene.subtitle, product, idx)),
        priceTag: syncRealTimePricesInText(scene.priceTag),
        bgGradient: scene.bgGradient
      }));
    } else if (brief.type === 'reel_9x16') {
      const archetype = ANDROMEDA_CREATIVE_ARCHETYPES[brief.index ?? idx];
      const isUnboxing = archetype?.angleType === 'unboxing';
      const { shortCategoryNoun, ultraShortObjectLabel } = extractProductCoreIdentity(product);
      const objUpper = ultraShortObjectLabel.toUpperCase();

      asset.videoScenes = [
        {
          durationSec: 3,
          badge: isUnboxing ? 'ESCENA 1 · GANCHO DUDA (0-3s)' : 'ESCENA 1 · HOOK (0-3s)',
          title: sanitizeAdCopyForParaguayCod(brief.hook3s || `${objUpper} EN OFERTA`, product, idx),
          subtitle: isUnboxing
            ? 'Pagás cuando recibís y mirá todo lo que trae la caja'
            : 'La solución práctica que cientos de familias en Paraguay eligen',
          priceTag: isUnboxing ? '🤔 Mirá la prueba en vivo' : 'Pagás Cuando Recibís',
          bgGradient: 'from-[#041a12] via-[#0b3d2e] to-[#041a12]'
        },
        {
          durationSec: 3,
          badge: isUnboxing ? 'ESCENA 2 · APERTURA (3-6s)' : 'ESCENA 2 · DEMO (3-6s)',
          title: isUnboxing
            ? 'Revisás tu caja sellada al recibir...'
            : sanitizeAdCopyForParaguayCod(product.descripcion || 'Calidad verificada', product, idx).slice(0, 62),
          subtitle: isUnboxing
            ? 'Materiales sólidos y todo el kit completo incluido'
            : 'Entrega en 2 a 3 días hábiles en todo Paraguay',
          priceTag: freeShipping ? '🚚 ENVÍO GRATIS (2-3 DÍAS)' : '🚚 ENTREGA EN 48-72 HS',
          bgGradient: 'from-[#0f172a] via-[#1e3a8a] to-[#0f172a]'
        },
        {
          durationSec: 3,
          badge: isUnboxing ? 'ESCENA 3 · REVELACIÓN (6-9s)' : 'ESCENA 3 · OFERTA (6-9s)',
          title: isUnboxing
            ? `¡Kit 100% Completo! ${shortCategoryNoun}`
            : `1 Unidad: ${formatGs(p1)}`,
          subtitle: isUnboxing
            ? `Lo verificás al recibir por solo ${formatGs(p1)}`
            : `🔥 Pack 2 Unidades Ahorro: ${formatGs(p2)}`,
          priceTag: `Antes: ${formatGs(pNormal)}`,
          bgGradient: 'from-[#3b0764] via-[#581c87] to-[#1e1b4b]'
        },
        {
          durationSec: 3,
          badge: 'ESCENA 4 · CTA FINAL (9-12s)',
          title: 'Pagás Recién al Recibir en tu Puerta',
          subtitle: 'Reservá hoy sin adelantos · Entrega en 48 a 72 hs',
          priceTag: '✅ EFECTIVO, QR O POS',
          bgGradient: 'from-[#064e3b] via-[#15803d] to-[#041a12]'
        }
      ];
    }

    return asset;
  });
}

/**
 * Regenera UN SOLO anuncio específico (cuando el usuario hace clic en "Cambiar este anuncio")
 * garantizando 100% CONGRUENCIA entre la nueva Imagen IA y el nuevo Texto/Titular.
 */
export function regenerateSingleCreativeAssetFromBrain(
  product: ProductPage,
  brain: AutoAdsBrainProfile,
  briefIndex: number,
  variationSeed: number,
  customBriefOverride?: Partial<AutoAdsCreativeBrief>
): GeneratedAdCreativeAsset {
  const p1 = brain.productAnalysis.pricesPack1;
  const p2 = brain.productAnalysis.pricesPack2;
  const pNormal = brain.productAnalysis.pricesNormal;
  const freeShipping = brain.productAnalysis.freeShipping;
  const defaultFullBrain = createDefaultBrainProfile(product);
  const baseBrief =
    brain.creativeBriefs[briefIndex] ||
    brain.creativeBriefs[0] ||
    defaultFullBrain.creativeBriefs[0];

  const congruentSceneIdx = (briefIndex + variationSeed) % defaultFullBrain.creativeBriefs.length;
  const congruentSceneBrief = defaultFullBrain.creativeBriefs[congruentSceneIdx];

  const mergedBrief: AutoAdsCreativeBrief = {
    ...baseBrief,
    hookBadge: customBriefOverride?.hookBadge || congruentSceneBrief.hookBadge,
    headline: sanitizeAdCopyForParaguayCod(
      customBriefOverride?.headline || congruentSceneBrief.headline,
      product,
      congruentSceneIdx
    ),
    primaryText: sanitizeAdCopyForParaguayCod(
      customBriefOverride?.primaryText || congruentSceneBrief.primaryText,
      product,
      congruentSceneIdx
    ),
    descriptionText: sanitizeAdCopyForParaguayCod(
      customBriefOverride?.descriptionText || congruentSceneBrief.descriptionText,
      product,
      congruentSceneIdx
    ),
    ...(customBriefOverride
      ? {
          ...customBriefOverride,
          headline: sanitizeAdCopyForParaguayCod(
            customBriefOverride.headline || congruentSceneBrief.headline,
            product,
            congruentSceneIdx
          ),
          primaryText: sanitizeAdCopyForParaguayCod(
            customBriefOverride.primaryText || congruentSceneBrief.primaryText,
            product,
            congruentSceneIdx
          ),
          descriptionText: sanitizeAdCopyForParaguayCod(
            customBriefOverride.descriptionText || congruentSceneBrief.descriptionText,
            product,
            congruentSceneIdx
          )
        }
      : {}),
    themeIndex: (baseBrief.themeIndex + variationSeed) % CREATIVE_COLOR_THEMES.length
  };

  const aiImagePrompt =
    customBriefOverride?.aiImagePrompt ||
    buildAiAdImagePromptForBrief(product, congruentSceneIdx, variationSeed);
  const aiGeneratedImageUrl = customBriefOverride?.aiGeneratedImageUrl || '';
  const aiGeneratedVideoUrl = customBriefOverride?.aiGeneratedVideoUrl || '';
  const productImage = aiGeneratedImageUrl || product.imagen || '';

  const themeIdx = mergedBrief.themeIndex % CREATIVE_COLOR_THEMES.length;

  const imageDataUrl = buildHighImpactAdSvgDataUrl({
    productName: product.nombre,
    productImage,
    pricePack1Gs: p1,
    pricePack2Gs: p2,
    normalPriceGs: pNormal,
    freeShipping,
    aspectRatio: mergedBrief.format,
    hookBadge: mergedBrief.hookBadge,
    headline: mergedBrief.headline,
    subHeadline: (mergedBrief.descriptionText || '').slice(0, 70),
    ctaLabel: mergedBrief.ctaLabel,
    themeIndex: themeIdx
  });

  const typeMapping: Record<AutoAdsCreativeBrief['type'], GeneratedAdCreativeAsset['type']> = {
    'feed_1x1': 'image_feed_1x1',
    'story_9x16': 'image_story_9x16',
    'reel_9x16': 'video_reel_9x16'
  };

  const formatLabelMapping: Record<AutoAdsCreativeBrief['type'], string> = {
    'feed_1x1': 'Imagen IA Feed 1:1 (1080×1080)',
    'story_9x16': 'Imagen IA Story 9:16 (1080×1920)',
    'reel_9x16': 'Video Reel IA 9:16 (4 Escenas)'
  };

  return {
    id: `autoads-${briefIndex}-${product.id}-v${variationSeed}-${Date.now()}`,
    type: typeMapping[mergedBrief.type] || 'image_feed_1x1',
    formatLabel: `${formatLabelMapping[mergedBrief.type] || 'Imagen IA Feed 1:1'} · ${mergedBrief.archetypeName} (Variante IA #${variationSeed + 1})`,
    aspectRatio: mergedBrief.format,
    angleTitle: `Ángulo #${briefIndex + 1} · ${mergedBrief.archetypeName} (Variante IA #${variationSeed + 1})`,
    hookBadge: mergedBrief.hookBadge,
    headline: mergedBrief.headline,
    primaryText: mergedBrief.primaryText,
    descriptionText: mergedBrief.descriptionText,
    ctaType: mergedBrief.ctaType,
    ctaLabel: mergedBrief.ctaLabel,
    visualThemeIndex: themeIdx,
    imageDataUrl,
    aiGeneratedImageUrl,
    aiGeneratedVideoUrl,
    aiImagePrompt,
    videoScenes: mergedBrief.videoScenes || baseBrief.videoScenes
  };
}


