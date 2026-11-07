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

/** Modelo LLM exclusivo para el sistema AutoAds */
export const AUTOADS_LLM_MODEL = 'z-ai/glm-5.3';

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
    ctaLabel: 'PEDIR CONTRA ENTREGA'
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

// ────────────────────────────────────────────────────────────────────────────────
// Función: Crear perfil de cerebro vacío / por defecto
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Crea un perfil de Cerebro Maestro inicial con estado 'idle' para un producto dado.
 * Todas las secciones están vacías hasta que se ejecute el entrenamiento con GLM-5.3.
 */
export function createDefaultBrainProfile(product: ProductPage): AutoAdsBrainProfile {
  const p1 = Number(product.precios?.[1] || 189000);
  const p2 = Number(product.precios?.[2] || Math.round(p1 * 1.85));
  const p3 = Number(product.precios?.[3] || Math.round(p1 * 2.65));
  const pNormal = Number(product.precioNormal || Math.round(p1 * 1.35));
  const freeShipping = product.freeShipping !== false;
  const nombre = product.nombre || 'Producto';

  // Avatares por defecto para fallback offline
  const defaultAvatars: AutoAdsAvatar[] = [
    {
      id: 'avatar-a',
      name: 'María de Asunción',
      description: `Mujer de 28-45 años, ama de casa o empleada, busca soluciones prácticas para el hogar. Compra online pero con desconfianza.`,
      painPoints: [
        'Desconfía de las compras online por miedo a estafas',
        `Necesita ${nombre} pero no encuentra de calidad en su zona`,
        'Le preocupa pagar antes de ver el producto'
      ],
      angles: [
        { id: 'angle-a1', type: 'offer' as const, hook: `🔥 ${nombre} a solo ${formatGs(p1)} con envío GRATIS`, emotionalTrigger: 'oportunidad' },
        { id: 'angle-a2', type: 'trust' as const, hook: '¿Compraste algo por internet y nunca te llegó?', emotionalTrigger: 'miedo/seguridad' }
      ]
    },
    {
      id: 'avatar-b',
      name: 'Carlos de Luque',
      description: `Hombre de 25-40 años, trabaja todo el día, busca conveniencia. Quiere comprar rápido sin complicaciones.`,
      painPoints: [
        'No tiene tiempo para ir a buscar productos a tiendas físicas',
        'Ya le falló un producto barato que compró antes',
        'Quiere algo de calidad pero a precio accesible'
      ],
      angles: [
        { id: 'angle-b1', type: 'social_proof' as const, hook: `Más de 500 personas en Paraguay ya lo tienen`, emotionalTrigger: 'pertenencia' },
        { id: 'angle-b2', type: 'transformation' as const, hook: '¿Seguís usando eso viejo que ya no funciona?', emotionalTrigger: 'frustración' }
      ]
    },
    {
      id: 'avatar-c',
      name: 'Laura de Ciudad del Este',
      description: `Mujer de 20-35 años, activa en redes sociales, compra por impulso y tendencias. Le gusta regalar.`,
      painPoints: [
        'Vio algo en TikTok/Instagram pero no sabe dónde comprarlo en Paraguay',
        'Quiere regalar algo útil pero original',
        'Le da pereza llenar formularios largos'
      ],
      angles: [
        { id: 'angle-c1', type: 'urgency' as const, hook: `⚡ ÚLTIMAS ${Math.floor(Math.random() * 20) + 15} unidades en stock`, emotionalTrigger: 'escasez' },
        { id: 'angle-c2', type: 'unboxing' as const, hook: 'Compré esto por internet y mirá lo que me llegó...', emotionalTrigger: 'curiosidad' }
      ]
    }
  ];

  // Briefs creativos por defecto basados en los 6 arquetipos Andrómeda
  const defaultBriefs: AutoAdsCreativeBrief[] = [
    {
      index: 0,
      type: 'feed_1x1',
      format: '1:1',
      archetypeName: 'Oferta Directa COD',
      avatarTarget: 'avatar-a',
      angleType: 'offer',
      hook3s: `🔥 ${nombre} Original a ${formatGs(p1)}`,
      hookBadge: '🔥 OFERTA ENVÍO GRATIS',
      headline: `${nombre} — Pagás al Recibir`,
      primaryText: `🔥 ¡${nombre} ORIGINAL a precio de locura!\n\n✅ 1 Unidad: ${formatGs(p1)}\n✅ Pack 2 (MÁS VENDIDO): ${formatGs(p2)}\n❌ Precio normal: ${formatGs(pNormal)}\n\n🚚 Envío GRATIS a todo Paraguay\n💰 Pagás recién cuando el repartidor llega a tu casa\n📱 Confirmamos por WhatsApp antes de enviar\n\n👇 Tocá "Pedir" y completá tu nombre y celular`,
      descriptionText: `${nombre} original con envío gratis y pago contra entrega`,
      ctaType: 'ORDER_NOW',
      ctaLabel: 'PEDIR CONTRA ENTREGA',
      themeIndex: 0
    },
    {
      index: 1,
      type: 'feed_1x1',
      format: '1:1',
      archetypeName: 'Trust / Cero Riesgo',
      avatarTarget: 'avatar-b',
      angleType: 'trust',
      hook3s: '¿Miedo a que te estafen por internet?',
      hookBadge: '✅ VERIFICÁ ANTES DE PAGAR',
      headline: `Cero Riesgo — Verificá tu ${nombre} al Recibirlo`,
      primaryText: `¿Ya te estafaron comprando online? 😤\n\nCon nosotros es DIFERENTE:\n\n✅ Verificás el producto ANTES de pagar\n✅ Si no te gusta, lo devolvés al repartidor\n✅ Garantía escrita de 30 días\n✅ Atención por WhatsApp REAL (no bot)\n\n${nombre} por solo ${formatGs(p1)}\nPack 2: ${formatGs(p2)} (ahorrás más)\n\n📱 Escribinos al WhatsApp si tenés dudas`,
      descriptionText: 'Verificá antes de pagar — Garantía de 30 días',
      ctaType: 'SHOP_NOW',
      ctaLabel: 'VER GARANTÍA Y COMPRAR',
      themeIndex: 1
    },
    {
      index: 2,
      type: 'feed_1x1',
      format: '1:1',
      archetypeName: 'Problema → Solución',
      avatarTarget: 'avatar-c',
      angleType: 'transformation',
      hook3s: '¿Seguís usando eso viejo que ya no sirve?',
      hookBadge: '💡 LA SOLUCIÓN QUE ESPERABAS',
      headline: `Cambiá tu Vida con ${nombre}`,
      primaryText: `¿Cuántas veces ya te pasó que usás algo viejo y no funciona como debería? 😩\n\nEl ${nombre} es la solución que miles de paraguayos ya descubrieron:\n\n✨ Calidad premium que se nota desde el primer uso\n✨ Diseño moderno y duradero\n✨ Resultado visible desde el día 1\n\n💰 Solo ${formatGs(p1)} (1 unidad)\n🔥 Pack 2: ${formatGs(p2)} — ¡Llevá para vos y regalá!\n\n🚚 Envío GRATIS · 💵 Pagás al recibir`,
      descriptionText: `La solución definitiva — ${nombre} con envío gratis`,
      ctaType: 'ORDER_NOW',
      ctaLabel: 'QUIERO LA SOLUCIÓN',
      themeIndex: 2
    },
    {
      index: 3,
      type: 'story_9x16',
      format: '9:16',
      archetypeName: 'Pack Familiar Ahorro',
      avatarTarget: 'avatar-a',
      angleType: 'urgency',
      hook3s: '⚡ ÚLTIMAS UNIDADES en stock — Pack 2 con mega descuento',
      hookBadge: '⚡ PACK 2 MEGA AHORRO',
      headline: `Pack 2 ${nombre} — Llevá y Regalá`,
      primaryText: `⚡ ¡OFERTA RELÁMPAGO!\n\n78% de nuestros clientes eligen el Pack 2:\n\n📦 Pack 2 Unidades: ${formatGs(p2)}\n(Te ahorrás ${formatGs(p1 * 2 - p2)} vs comprar por separado)\n\nIdeal para:\n🎁 Regalar a tu mamá/hermana/amiga\n🏠 Tener uno en el trabajo y otro en casa\n\n⏰ Stock limitado — Cuando se acabe, se acaba\n🚚 Envío GRATIS\n💵 Pagás al recibir\n\n👇 No pierdas esta oportunidad`,
      descriptionText: `Pack 2 ${nombre} con mega descuento — Llevá y regalá`,
      ctaType: 'ORDER_NOW',
      ctaLabel: 'QUIERO MI PACK HOY',
      themeIndex: 3
    },
    {
      index: 4,
      type: 'reel_9x16',
      format: '9:16',
      archetypeName: 'Demostración de Impacto',
      avatarTarget: 'avatar-b',
      angleType: 'social_proof',
      hook3s: `¿Ya viste lo que todos están comprando en Paraguay?`,
      hookBadge: '🎬 MIRÁ ESTO',
      headline: `${nombre} — Lo Más Vendido del Momento`,
      primaryText: `👀 ¿Todavía no tenés el tuyo?\n\nEl ${nombre} es lo más vendido este mes en Paraguay.\n\n✅ ${formatGs(p1)} — 1 unidad\n✅ ${formatGs(p2)} — Pack 2 (MÁS VENDIDO)\n🚚 Envío GRATIS\n💵 Pagás al recibir\n\n👇 Tocá el botón antes de que se agote`,
      descriptionText: `Lo más vendido — ${nombre} con envío gratis`,
      ctaType: 'SHOP_NOW',
      ctaLabel: 'COMPRAR AHORA',
      themeIndex: 0,
      videoScenes: [
        { durationSec: 3, badge: 'ESCENA 1 · HOOK (0-3s)', title: `¿Ya viste el nuevo ${nombre}?`, subtitle: 'Lo que todos están comprando en Paraguay', priceTag: 'Hoy con Descuento Especial', bgGradient: 'from-[#041a12] via-[#0b3d2e] to-[#041a12]' },
        { durationSec: 3, badge: 'ESCENA 2 · DEMO (3-6s)', title: 'Calidad Premium Verificada', subtitle: 'Calidad verificada antes de salir a reparto', priceTag: freeShipping ? '🚚 ENVÍO GRATIS A DOMICILIO' : '🚚 ENTREGA RÁPIDA', bgGradient: 'from-[#0f172a] via-[#1e3a8a] to-[#0f172a]' },
        { durationSec: 3, badge: 'ESCENA 3 · OFERTA (6-9s)', title: `1 Unidad: ${formatGs(p1)}`, subtitle: `🔥 Pack 2: ${formatGs(p2)}`, priceTag: `Antes: ${formatGs(pNormal)}`, bgGradient: 'from-[#3b0764] via-[#581c87] to-[#1e1b4b]' },
        { durationSec: 3, badge: 'ESCENA 4 · CTA FINAL (9-12s)', title: 'Pagás Recién al Recibir en tu Casa', subtitle: 'Tocá el botón y reservá en 30 segundos', priceTag: '✅ EFECTIVO O QR AL RECIBIR', bgGradient: 'from-[#064e3b] via-[#15803d] to-[#041a12]' }
      ]
    },
    {
      index: 5,
      type: 'reel_9x16',
      format: '9:16',
      archetypeName: 'Unboxing ¿Es Estafa?',
      avatarTarget: 'avatar-c',
      angleType: 'unboxing',
      hook3s: 'Compré esto por internet y mirá lo que me llegó...',
      hookBadge: '😱 ¿ES ESTAFA?',
      headline: `¿${nombre} por Internet? Mirá mi Experiencia`,
      primaryText: `😱 Compré esto por internet... ¿será estafa?\n\nLes cuento mi experiencia:\n📦 Llegó en 3 días a mi casa\n👀 Lo revisé ANTES de pagar (sí, pagás al recibir)\n✅ ¡Es REAL! Calidad excelente\n\n${nombre} por solo ${formatGs(p1)}\nPack 2: ${formatGs(p2)}\n\n🚚 Envío gratis\n💵 Pagás contra entrega\n🔒 Garantía de 30 días\n\nSi tenés dudas, escribinos al WhatsApp 👇`,
      descriptionText: '¿Es estafa? Mi experiencia real comprando por internet',
      ctaType: 'LEARN_MORE',
      ctaLabel: 'VER SI ES REAL',
      themeIndex: 1,
      videoScenes: [
        { durationSec: 3, badge: 'ESCENA 1 · GANCHO DUDA (0-3s)', title: 'Compré esto por internet...', subtitle: '¿Será que me estafaron? 🤔', priceTag: '🤔 ¿Vale la pena?', bgGradient: 'from-[#1f0808] via-[#7f1d1d] to-[#450a0a]' },
        { durationSec: 3, badge: 'ESCENA 2 · APERTURA (3-6s)', title: 'Abriendo el paquete en vivo...', subtitle: 'Llegó bien empaquetado, veamos qué trae', priceTag: '📦 LLEGÓ EN 3 DÍAS', bgGradient: 'from-[#0f172a] via-[#1e3a8a] to-[#0f172a]' },
        { durationSec: 3, badge: 'ESCENA 3 · REVELACIÓN (6-9s)', title: `¡Es REAL! ${nombre} original`, subtitle: `Calidad excelente por solo ${formatGs(p1)}`, priceTag: `Antes: ${formatGs(pNormal)}`, bgGradient: 'from-[#3b0764] via-[#581c87] to-[#1e1b4b]' },
        { durationSec: 3, badge: 'ESCENA 4 · CTA FINAL (9-12s)', title: 'Pagás Recién al Recibir en tu Casa', subtitle: 'Tocá el botón y reservá en 30 segundos', priceTag: '✅ EFECTIVO O QR AL RECIBIR', bgGradient: 'from-[#064e3b] via-[#15803d] to-[#041a12]' }
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
      images: product.imagen ? [product.imagen] : [],
      physicalTruth: product.physicalTruth
        ? JSON.stringify(product.physicalTruth)
        : '',
      agentBrain: product.agentBrain
        ? JSON.stringify(product.agentBrain)
        : ''
    },

    competitorInsights: {
      searchQuery: `${product.nombre} Paraguay COD`,
      activeAdsFound: 0,
      winningPatterns: ['Precio prominente con fondo oscuro', 'Badge de envío gratis', 'CTA contra entrega'],
      commonHooks: ['¿Ya viste esto?', 'ÚLTIMAS unidades', '¿Miedo a estafas online?'],
      commonAngles: ['oferta directa', 'trust/verificación', 'transformación'],
      dominantFormats: ['imagen 1:1', 'video 9:16'],
      avgLongevityDays: 14
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
      "themeIndex": 0
    },
    {
      "index": 1,
      "type": "feed_1x1",
      "format": "1:1",
      "archetypeName": "Trust / Cero Riesgo",
      "avatarTarget": "avatar-b",
      "angleType": "trust",
      "hook3s": "...",
      "hookBadge": "...",
      "headline": "...",
      "primaryText": "...",
      "descriptionText": "...",
      "ctaType": "SHOP_NOW",
      "ctaLabel": "VER GARANTÍA Y COMPRAR",
      "themeIndex": 1
    },
    {
      "index": 2,
      "type": "feed_1x1",
      "format": "1:1",
      "archetypeName": "Problema → Solución",
      "avatarTarget": "avatar-c",
      "angleType": "transformation",
      "hook3s": "...",
      "hookBadge": "...",
      "headline": "...",
      "primaryText": "...",
      "descriptionText": "...",
      "ctaType": "ORDER_NOW",
      "ctaLabel": "QUIERO LA SOLUCIÓN",
      "themeIndex": 2
    },
    {
      "index": 3,
      "type": "story_9x16",
      "format": "9:16",
      "archetypeName": "Pack Familiar Ahorro",
      "avatarTarget": "avatar-a",
      "angleType": "urgency",
      "hook3s": "...",
      "hookBadge": "...",
      "headline": "...",
      "primaryText": "...",
      "descriptionText": "...",
      "ctaType": "ORDER_NOW",
      "ctaLabel": "QUIERO MI PACK HOY",
      "themeIndex": 3
    },
    {
      "index": 4,
      "type": "reel_9x16",
      "format": "9:16",
      "archetypeName": "Demostración de Impacto",
      "avatarTarget": "avatar-b",
      "angleType": "social_proof",
      "hook3s": "...",
      "hookBadge": "...",
      "headline": "...",
      "primaryText": "...",
      "descriptionText": "...",
      "ctaType": "SHOP_NOW",
      "ctaLabel": "COMPRAR AHORA",
      "themeIndex": 0,
      "videoScenes": [
        {
          "durationSec": 3,
          "badge": "ESCENA 1 · HOOK (0-3s)",
          "title": "Título de la escena",
          "subtitle": "Subtítulo descriptivo",
          "priceTag": "Etiqueta de precio o beneficio",
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
      "hookBadge": "...",
      "headline": "...",
      "primaryText": "...",
      "descriptionText": "...",
      "ctaType": "LEARN_MORE",
      "ctaLabel": "VER SI ES REAL",
      "themeIndex": 1,
      "videoScenes": [
        {
          "durationSec": 3,
          "badge": "ESCENA 1 · GANCHO (0-3s)",
          "title": "...",
          "subtitle": "...",
          "priceTag": "...",
          "bgGradient": "from-[#1f0808] via-[#7f1d1d] to-[#450a0a]"
        }
      ]
    }
  ]
}

REGLAS FINALES PARA LA RESPUESTA:
1. Los 3 avatares deben ser personas REALES de Paraguay con nombres locales.
2. Los 6 creativeBriefs DEBEN seguir los 6 arquetipos en ORDEN (índice 0-5).
3. Cada primaryText debe ser COMPLETO y LISTO PARA PUBLICAR (no abreviado).
4. Los precios SIEMPRE en formato "Gs. XXX.XXX" usando los datos del producto.
5. Los videoScenes son obligatorios SOLO para los índices 4 y 5 (reels), con 4 escenas cada uno.
6. Cada hook3s debe ser DISTINTO y dirigido a un avatar diferente cuando sea posible.
7. El hookBadge es para la imagen del anuncio — max 34 caracteres, en MAYÚSCULAS.
8. Los bgGradient de videoScenes deben usar los colores de la paleta proporcionada.
9. NO incluyas markdown, NO incluyas comentarios JS, solo JSON puro válido.
`;
}

// ────────────────────────────────────────────────────────────────────────────────
// Función: Generar activos creativos desde el Cerebro Maestro entrenado
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Toma el perfil del cerebro entrenado y genera 6 GeneratedAdCreativeAsset listos para
 * previsualizar y publicar en Meta Ads via Pipeboard MCP.
 * Cada creativo mapea directamente a un brief del cerebro.
 */
export function buildCreativeAssetsFromBrain(
  product: ProductPage,
  brain: AutoAdsBrainProfile
): GeneratedAdCreativeAsset[] {
  const p1 = brain.productAnalysis.pricesPack1;
  const p2 = brain.productAnalysis.pricesPack2;
  const pNormal = brain.productAnalysis.pricesNormal;
  const freeShipping = brain.productAnalysis.freeShipping;
  const img = brain.productAnalysis.images[0] || product.imagen || '/assets/real/galeria-1.jpg';

  // Si no hay briefs, devolver array vacío
  if (!brain.creativeBriefs || brain.creativeBriefs.length === 0) {
    return [];
  }

  const typeMapping: Record<AutoAdsCreativeBrief['type'], GeneratedAdCreativeAsset['type']> = {
    'feed_1x1': 'image_feed_1x1',
    'story_9x16': 'image_story_9x16',
    'reel_9x16': 'video_reel_9x16'
  };

  const formatLabelMapping: Record<AutoAdsCreativeBrief['type'], string> = {
    'feed_1x1': 'Imagen Feed 1:1 (1080×1080)',
    'story_9x16': 'Imagen Vertical 9:16 (1080×1920) · Stories',
    'reel_9x16': 'Video Reel 9:16 (4 Escenas Dinámicas) · Reels'
  };

  return brain.creativeBriefs.map((brief, idx) => {
    const aspectRatio = brief.format;
    const themeIdx = brief.themeIndex % CREATIVE_COLOR_THEMES.length;

    // Generar el SVG de alta resolución usando el builder existente
    const imageDataUrl = buildHighImpactAdSvgDataUrl({
      productName: product.nombre,
      productImage: img,
      pricePack1Gs: p1,
      pricePack2Gs: p2,
      normalPriceGs: pNormal,
      freeShipping,
      aspectRatio,
      hookBadge: brief.hookBadge,
      headline: brief.headline,
      subHeadline: brief.descriptionText.slice(0, 70),
      ctaLabel: brief.ctaLabel,
      themeIndex: themeIdx
    });

    // Construir el asset creativo completo
    const asset: GeneratedAdCreativeAsset = {
      id: `autoads-${brief.index}-${product.id}-${Date.now()}`,
      type: typeMapping[brief.type] || 'image_feed_1x1',
      formatLabel: `${formatLabelMapping[brief.type] || 'Imagen Feed 1:1'} · ${brief.archetypeName}`,
      aspectRatio,
      angleTitle: `Ángulo #${brief.index + 1} · ${brief.archetypeName} (${brief.angleType})`,
      hookBadge: brief.hookBadge,
      headline: brief.headline,
      primaryText: brief.primaryText,
      descriptionText: brief.descriptionText,
      ctaType: brief.ctaType,
      ctaLabel: brief.ctaLabel,
      visualThemeIndex: themeIdx,
      imageDataUrl
    };

    // Agregar escenas de video si el brief las tiene (arquetipos 4 y 5)
    if (brief.videoScenes && brief.videoScenes.length > 0) {
      asset.videoScenes = brief.videoScenes.map((scene) => ({
        durationSec: scene.durationSec,
        badge: scene.badge,
        title: scene.title,
        subtitle: scene.subtitle,
        priceTag: scene.priceTag,
        bgGradient: scene.bgGradient
      }));
    } else if (brief.type === 'reel_9x16') {
      // Escenas por defecto para reels sin escenas definidas
      const archetype = ANDROMEDA_CREATIVE_ARCHETYPES[brief.index];
      const isUnboxing = archetype?.angleType === 'unboxing';

      asset.videoScenes = [
        {
          durationSec: 3,
          badge: isUnboxing ? 'ESCENA 1 · GANCHO DUDA (0-3s)' : 'ESCENA 1 · HOOK (0-3s)',
          title: brief.hook3s || `¿Ya viste el nuevo ${product.nombre}?`,
          subtitle: isUnboxing
            ? 'Compré esto por internet... ¿será estafa?'
            : 'La solución que miles de hogares en Paraguay esperaban',
          priceTag: isUnboxing ? '🤔 ¿Vale la pena?' : 'Hoy con Descuento Especial',
          bgGradient: 'from-[#041a12] via-[#0b3d2e] to-[#041a12]'
        },
        {
          durationSec: 3,
          badge: isUnboxing ? 'ESCENA 2 · APERTURA (3-6s)' : 'ESCENA 2 · DEMO (3-6s)',
          title: isUnboxing
            ? 'Abriendo el paquete en vivo...'
            : (product.descripcion || 'Calidad verificada').slice(0, 62),
          subtitle: isUnboxing
            ? 'Llegó bien empaquetado, veamos qué trae'
            : 'Calidad verificada antes de salir a reparto',
          priceTag: freeShipping ? '🚚 ENVÍO GRATIS A DOMICILIO' : '🚚 ENTREGA RÁPIDA EN PUERTA',
          bgGradient: 'from-[#0f172a] via-[#1e3a8a] to-[#0f172a]'
        },
        {
          durationSec: 3,
          badge: isUnboxing ? 'ESCENA 3 · REVELACIÓN (6-9s)' : 'ESCENA 3 · OFERTA (6-9s)',
          title: isUnboxing
            ? `¡Es REAL! ${product.nombre} original`
            : `1 Unidad: ${formatGs(p1)}`,
          subtitle: isUnboxing
            ? `Calidad excelente por solo ${formatGs(p1)}`
            : `🔥 Pack 2 Unidades Ahorro: ${formatGs(p2)}`,
          priceTag: `Antes: ${formatGs(pNormal)}`,
          bgGradient: 'from-[#3b0764] via-[#581c87] to-[#1e1b4b]'
        },
        {
          durationSec: 3,
          badge: 'ESCENA 4 · CTA FINAL (9-12s)',
          title: 'Pagás Recién al Recibir en tu Casa',
          subtitle: 'Tocá el botón acá abajo y reservá en 30 segundos',
          priceTag: '✅ EFECTIVO O QR AL RECIBIR',
          bgGradient: 'from-[#064e3b] via-[#15803d] to-[#041a12]'
        }
      ];
    }

    return asset;
  });
}
