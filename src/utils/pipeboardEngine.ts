import { ProductPage } from '../types';
import { formatGs } from '../config';

export interface PipeboardConnectionConfig {
  pipeboardApiToken: string; // e.g. pipeboard_... from https://pipeboard.co/api-tokens
  pipeboardMcpEndpoint: string; // default: https://meta-ads.mcp.pipeboard.co
  metaAccessTokenFallback?: string; // optional direct Meta System User / OAuth token
  openRouterApiKey: string; // sk-or-v1-...
  openRouterModel: string; // e.g. deepseek/deepseek-chat, openai/gpt-4o-mini, anthropic/claude-3.5-sonnet
  selectedAdAccountId: string; // e.g. act_1029384756
  selectedFacebookPageId: string; // e.g. 109283746512
  dailyBudgetGs: number; // e.g. 50000 Gs (~$7 USD/día)
  defaultPublishStatus: 'ACTIVE' | 'PAUSED';
}

export interface PipeboardAdAccount {
  id: string; // act_...
  accountId: string;
  name: string;
  currency: string;
  status: 'ACTIVE' | 'DISABLED' | 'UNSETTLED';
  timezoneName: string;
  businessName?: string;
}

export interface PipeboardFacebookPage {
  id: string;
  name: string;
  category: string;
}

export interface GeneratedAdCreativeAsset {
  id: string;
  type: 'image_feed_1x1' | 'image_comparison_1x1' | 'image_story_9x16' | 'video_reel_9x16';
  formatLabel: string;
  aspectRatio: '1:1' | '9:16';
  angleTitle: string;
  hookBadge: string;
  headline: string;
  primaryText: string;
  descriptionText: string;
  ctaType: 'SHOP_NOW' | 'ORDER_NOW' | 'LEARN_MORE';
  ctaLabel: string;
  visualThemeIndex: number;
  imageDataUrl: string; // High-impact rendered SVG/Canvas Data URL for instant preview & upload_ad_image
  aiGeneratedImageUrl?: string; // Real AI-generated advertising photograph URL / Data URL
  aiGeneratedVideoUrl?: string; // Real AI-generated playable Reel video (.mp4) derived from the AI image
  aiImagePrompt?: string; // Exact prompt used by the AI Image Generator to create this ad visual
  videoScenes?: Array<{
    durationSec: number;
    badge: string;
    title: string;
    subtitle: string;
    priceTag: string;
    bgGradient: string;
  }>;
}

export interface PipeboardPublishedCampaignRecord {
  id: string;
  createdAt: string;
  productId: string;
  productName: string;
  productSlug: string;
  landingUrl: string;
  adAccountId: string;
  pixelId: string;
  campaignId: string;
  campaignName: string;
  adSetId: string;
  adSetName: string;
  publishedAds: Array<{
    adId: string;
    creativeId: string;
    imageHash: string;
    name: string;
    formatLabel: string;
    status: 'ACTIVE' | 'PAUSED';
  }>;
  executionMode: 'pipeboard_remote_mcp' | 'meta_graph_direct' | 'pipeboard_sandbox_preview';
  mcpStepLogs: Array<{
    step: number;
    toolName:
      | 'get_ad_accounts'
      | 'upload_ad_image'
      | 'create_campaign'
      | 'create_ad_set'
      | 'create_ad_creative'
      | 'create_ad';
    status: 'success' | 'simulated_ok';
    summary: string;
    timestamp: string;
  }>;
  adsManagerUrl: string;
}

export const DEFAULT_PIPEBOARD_CONFIG: PipeboardConnectionConfig = {
  pipeboardApiToken: '',
  pipeboardMcpEndpoint: 'https://meta-ads.mcp.pipeboard.co',
  metaAccessTokenFallback: '',
  openRouterApiKey: '',
  openRouterModel: 'openai/gpt-4o',
  selectedAdAccountId: 'act_595884210394',
  selectedFacebookPageId: '104928374650192',
  dailyBudgetGs: 65000,
  defaultPublishStatus: 'ACTIVE'
};

export const PIPEBOARD_MCP_TOOLS_CATALOG = [
  {
    toolName: 'get_ad_accounts',
    title: 'Sincronizar Cuentas Publicitarias (OAuth Partner)',
    description: 'Obtiene todas las cuentas publicitarias (act_...) vinculadas a tu sesión de Meta en Pipeboard.'
  },
  {
    toolName: 'upload_ad_image',
    title: 'Subir Creativos HD a Meta Ad Library',
    description: 'Transfiere las imágenes 1:1 y 9:16 generadas al repositorio de activos de tu cuenta publicitaria y devuelve el image_hash.'
  },
  {
    toolName: 'create_campaign',
    title: 'Crear Campaña OUTCOME_SALES (Conversiones COD)',
    description: 'Crea la campaña principal optimizada para ventas en tu tienda con presupuesto optimizado CBO/ABO.'
  },
  {
    toolName: 'create_ad_set',
    title: 'Crear Conjunto de Anuncios + Píxel & CAPI',
    description: 'Configura ubicación (Paraguay 18-65+), evento de conversión Purchase y conexión al Píxel del producto.'
  },
  {
    toolName: 'create_ad_creative',
    title: 'Ensamblar Object Story Spec (Imagen/Video + Copy + URL)',
    description: 'Une cada imagen/video con su texto principal, titular, botón Comprar y el link directo /?p=slug.'
  },
  {
    toolName: 'create_ad',
    title: 'Publicar Anuncios en Meta Ads Manager',
    description: 'Activa los anuncios dentro del conjunto creado para empezar a recibir visitas y pedidos en automático.'
  }
] as const;

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

function escapeSvgText(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Construye un póster SVG de alta resolución (1080x1080 o 1080x1920) listo para previsualizar y convertir a PNG
 * para `upload_ad_image` en Pipeboard Meta Ads MCP.
 */
export function buildHighImpactAdSvgDataUrl(params: {
  productName: string;
  productImage: string;
  pricePack1Gs: number;
  pricePack2Gs: number;
  normalPriceGs: number;
  freeShipping: boolean;
  aspectRatio: '1:1' | '9:16';
  hookBadge: string;
  headline: string;
  subHeadline: string;
  ctaLabel: string;
  themeIndex?: number;
}): string {
  const theme = CREATIVE_COLOR_THEMES[(params.themeIndex || 0) % CREATIVE_COLOR_THEMES.length];
  const width = 1080;
  const height = params.aspectRatio === '9:16' ? 1920 : 1080;
  const isVertical = params.aspectRatio === '9:16';

  const cleanTitle = escapeSvgText(params.productName.slice(0, 38));
  const cleanHeadline = escapeSvgText(params.headline.slice(0, 52));
  const cleanSub = escapeSvgText(params.subHeadline.slice(0, 70));
  const cleanBadge = escapeSvgText(params.hookBadge.slice(0, 34));
  const cleanCta = escapeSvgText(params.ctaLabel.slice(0, 28));
  const priceStr = escapeSvgText(formatGs(params.pricePack1Gs));
  const normalStr = escapeSvgText(formatGs(params.normalPriceGs));
  const shippingText = params.freeShipping ? 'ENVIO GRATIS · PAGO AL RECIBIR' : 'ENTREGA EN PUERTA · PAGO AL RECIBIR';
  const imgHref = escapeSvgText(params.productImage || '/assets/real/galeria-1.jpg');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.bgStart}" />
        <stop offset="50%" stop-color="${theme.bgMid}" />
        <stop offset="100%" stop-color="${theme.bgEnd}" />
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${theme.accent}" />
        <stop offset="100%" stop-color="#f59e0b" />
      </linearGradient>
      <clipPath id="imgClip">
        <rect x="${isVertical ? 110 : 564}" y="${isVertical ? 380 : 363}" width="${isVertical ? 860 : 444}" height="${isVertical ? 860 : 409}" rx="32" />
      </clipPath>
    </defs>

    <!-- Background -->
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

    <!-- Top Urgency Bar -->
    <rect x="0" y="0" width="${width}" height="88" fill="url(#goldGrad)" />
    <text x="${width / 2}" y="56" font-family="Arial, sans-serif" font-size="32" font-weight="900" fill="#041a12" text-anchor="middle" letter-spacing="2">
      ${shippingText}
    </text>

    <!-- Hook Badge -->
    <rect x="64" y="${isVertical ? 130 : 124}" width="${Math.min(950, cleanBadge.length * 22 + 70)}" height="62" rx="18" fill="${theme.badgeBg}" />
    <text x="96" y="${isVertical ? 173 : 165}" font-family="Arial, sans-serif" font-size="27" font-weight="900" fill="#ffffff">
      ${cleanBadge}
    </text>

    <!-- Product Headline -->
    <text x="64" y="${isVertical ? 260 : 248}" font-family="Arial, sans-serif" font-size="${isVertical ? 54 : 44}" font-weight="900" fill="#ffffff">
      ${cleanTitle}
    </text>
    <text x="64" y="${isVertical ? 325 : 304}" font-family="Arial, sans-serif" font-size="${isVertical ? 34 : 27}" font-weight="700" fill="${theme.accent}">
      ${cleanHeadline}
    </text>

    <!-- Product Image Card Frame -->
    <rect x="${isVertical ? 102 : 556}" y="${isVertical ? 372 : 355}" width="${isVertical ? 876 : 460}" height="${isVertical ? 876 : 425}" rx="38" fill="#ffffff" fill-opacity="0.12" stroke="${theme.accent}" stroke-width="6" />
    <image href="${imgHref}" x="${isVertical ? 110 : 564}" y="${isVertical ? 380 : 363}" width="${isVertical ? 860 : 444}" height="${isVertical ? 860 : 409}" preserveAspectRatio="xMidYMid slice" clip-path="url(#imgClip)" />

    <!-- Price Anchor Box -->
    <rect x="64" y="${isVertical ? 1310 : 355}" width="${isVertical ? 952 : 465}" height="${isVertical ? 270 : 425}" rx="32" fill="#000000" fill-opacity="0.48" stroke="${theme.accent}" stroke-width="3" />
    <text x="96" y="${isVertical ? 1378 : 425}" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#cbd5e1">
      PRECIO NORMAL: <tspan text-decoration="line-through">${normalStr}</tspan>
    </text>
    <text x="96" y="${isVertical ? 1445 : 485}" font-family="Arial, sans-serif" font-size="27" font-weight="900" fill="${theme.accent}">
      OFERTA LANZAMIENTO HOY:
    </text>
    <text x="96" y="${isVertical ? 1535 : 582}" font-family="Arial, sans-serif" font-size="${isVertical ? 76 : 62}" font-weight="900" fill="#ffffff">
      ${priceStr}
    </text>
    <text x="96" y="${isVertical ? 1568 : 658}" font-family="Arial, sans-serif" font-size="23" font-weight="700" fill="#86efac">
      ✓ Pagás en efectivo o QR al recibir
    </text>
    ${
      !isVertical
        ? `<text x="96" y="712" font-family="Arial, sans-serif" font-size="21" font-weight="700" fill="#e2e8f0">✓ Garantía Oficial en todo Paraguay</text>`
        : ''
    }

    <!-- Subheadline strip -->
    <text x="${width / 2}" y="${isVertical ? 1665 : 865}" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#f8fafc" text-anchor="middle">
      ${cleanSub}
    </text>

    <!-- Bottom CTA Button -->
    <rect x="64" y="${isVertical ? 1720 : 915}" width="${width - 128}" height="118" rx="30" fill="#16a34a" stroke="#ffffff" stroke-width="4" />
    <text x="${width / 2}" y="${isVertical ? 1792 : 988}" font-family="Arial, sans-serif" font-size="40" font-weight="900" fill="#ffffff" text-anchor="middle">
      ${cleanCta} →
    </text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Genera de una sola vez el paquete completo de creativos (Imágenes 1:1, 9:16 y Video Comercial Multipaso + Copys persuasivos)
 * para un producto seleccionado. Soporta rotación de estilos (`variantSeed`) para el botón "Regenerar Imágenes con 1 Clic".
 */
export function buildCompleteAdCreativesSuite(
  product: ProductPage,
  variantSeed = 0,
  aiCopyOverrides?: Partial<Record<number, { headline?: string; primaryText?: string; hookBadge?: string }>>
): GeneratedAdCreativeAsset[] {
  const p1 = Number(product.precios?.[1] || 189000);
  const p2 = Number(product.precios?.[2] || Math.round(p1 * 1.85));
  const pNormal = Number(product.precioNormal || Math.round(p1 * 1.35));
  const freeShipping = product.freeShipping !== false;
  const img = product.imagen || '/assets/real/galeria-1.jpg';
  const desc =
    product.descripcion ||
    'Calidad superior comprobada con entrega rápida en puerta y pago al recibir en todo Paraguay.';

  const hookVariations = [
    ['OFERTA HOY EN PARAGUAY', 'NUEVO STOCK DISPONIBLE', 'PROMO DIRECTA DE FÁBRICA', 'ÚLTIMAS UNIDADES HOY'],
    ['CALIDAD ORIGINAL VERIFICADA', 'EL MÁS ELEGIDO EN HOGARES', 'GARANTÍA ESCRITA INCLUIDA', 'RESISTENCIA Y POTENCIA'],
    ['PACK DÚO CON DESCUENTO', 'LLEVÁ 2 Y AHORRÁ MÁS', 'FAVORITO DE LAS FAMILIAS', 'PROMO ESPECIAL 2 UNIDADES'],
    ['VIDEO DEMOSTRACIÓN OFICIAL', 'MIRÁ CÓMO FUNCIONA', 'RESULTADO DESDE EL DÍA 1', 'PEDÍ SIN RIESGO HOY']
  ];

  const vIdx = Math.abs(variantSeed) % 4;

  const override0 = aiCopyOverrides?.[0] || {};
  const override1 = aiCopyOverrides?.[1] || {};
  const override2 = aiCopyOverrides?.[2] || {};
  const override3 = aiCopyOverrides?.[3] || {};

  // 1. Imagen 1:1 Feed — Ángulo Oferta Directa COD
  const feedHeadline =
    override0.headline || `${product.nombre} · ${freeShipping ? 'Envío Gratis' : 'Entrega Rápida'} Hoy`;
  const feedHook = override0.hookBadge || hookVariations[0][vIdx];
  const feedPrimary =
    override0.primaryText ||
    `¡Ya disponible en Paraguay! ${product.nombre}.\n\n` +
      `• ${desc}\n` +
      `• 1 Unidad por solo ${formatGs(p1)} (Antes ${formatGs(pNormal)})\n` +
      `• Pack 2 Unidades con Ahorro Especial: ${formatGs(p2)}\n` +
      `• ${freeShipping ? 'Envío 100% Gratis a domicilio' : 'Entrega rápida en puerta en todo el país'}\n\n` +
      `Tocá en "Comprar" o "Realizar pedido", completá tu nombre y celular y pagá recién cuando el repartidor llegue a tu casa.`;

  // 2. Imagen 1:1 Comparativa — Ángulo Dolor vs. Solución
  const compHeadline =
    override1.headline || `Calidad Original Garantizada · Pagás Recién al Recibir`;
  const compHook = override1.hookBadge || hookVariations[1][vIdx];
  const compPrimary =
    override1.primaryText ||
    `¿Buscabas un ${product.nombre} duradero y sin pagar por adelantado?\n\n` +
      `No arriesgues tu dinero con transferencias previas. Con nuestro sistema de Cobro Contra Entrega:\n` +
      `1) Hacés tu reserva en 30 segundos en la página.\n` +
      `2) Te confirmamos tu ubicación exacta por WhatsApp.\n` +
      `3) Abonás en efectivo o QR recién al tener tu ${product.nombre} en tus manos.`;

  // 3. Imagen 9:16 Vertical Stories / Reels — Ángulo Pack 2 Ahorro
  const storyHeadline =
    override2.headline || `Llevá 2 Unidades por ${formatGs(p2)} · Oferta Limitada`;
  const storyHook = override2.hookBadge || hookVariations[2][vIdx];
  const storyPrimary =
    override2.primaryText ||
    `El 78% de nuestros clientes en Asunción, Central y todo el país eligen el Pack de 2 Unidades de ${product.nombre} por solo ${formatGs(p2)}.\n\n` +
      `Tocá el botón de abajo para reservar el tuyo hoy mismo con pago contra entrega.`;

  // 4. Video Comercial Animado 9:16 Reels / TikTok / Stories
  const videoHeadline =
    override3.headline || `${product.nombre} en Acción · Pedí Hoy y Pagá al Recibir`;
  const videoHook = override3.hookBadge || hookVariations[3][vIdx];
  const videoPrimary =
    override3.primaryText ||
    `Mirá por qué ${product.nombre} es tendencia en Paraguay.\n` +
      `• Precio Promo 1x: ${formatGs(p1)}\n` +
      `• Pack 2x Ahorro: ${formatGs(p2)}\n` +
      `• ${freeShipping ? 'Envío Gratis' : 'Entrega Rápida'} + Confirmación inmediata por WhatsApp.`;

  return [
    {
      id: `cr-feed-1-${product.id}-${variantSeed}`,
      type: 'image_feed_1x1',
      formatLabel: 'Imagen Feed 1:1 (1080×1080) · Ángulo Oferta Directa COD',
      aspectRatio: '1:1',
      angleTitle: 'Ángulo #1 · Oferta Directa + Cero Riesgo (Pago al Recibir)',
      hookBadge: feedHook,
      headline: feedHeadline,
      primaryText: feedPrimary,
      descriptionText: freeShipping ? 'Envío Gratis · Pago Contra Entrega' : 'Pago Contra Entrega en Puerta',
      ctaType: 'ORDER_NOW',
      ctaLabel: 'PEDIR CONTRA ENTREGA',
      visualThemeIndex: (0 + variantSeed) % CREATIVE_COLOR_THEMES.length,
      imageDataUrl: buildHighImpactAdSvgDataUrl({
        productName: product.nombre,
        productImage: img,
        pricePack1Gs: p1,
        pricePack2Gs: p2,
        normalPriceGs: pNormal,
        freeShipping,
        aspectRatio: '1:1',
        hookBadge: feedHook,
        headline: feedHeadline,
        subHeadline: 'Recibí en tu casa y aboná recién al repartidor',
        ctaLabel: 'PEDIR CONTRA ENTREGA',
        themeIndex: 0 + variantSeed
      })
    },
    {
      id: `cr-comp-2-${product.id}-${variantSeed}`,
      type: 'image_comparison_1x1',
      formatLabel: 'Imagen Feed 1:1 (1080×1080) · Ángulo Confianza & Garantía',
      aspectRatio: '1:1',
      angleTitle: 'Ángulo #2 · Solución Comprobada + Confirmación por WhatsApp',
      hookBadge: compHook,
      headline: compHeadline,
      primaryText: compPrimary,
      descriptionText: `Solo ${formatGs(p1)} · Garantía Oficial`,
      ctaType: 'SHOP_NOW',
      ctaLabel: 'VER OFERTA HOY',
      visualThemeIndex: (1 + variantSeed) % CREATIVE_COLOR_THEMES.length,
      imageDataUrl: buildHighImpactAdSvgDataUrl({
        productName: product.nombre,
        productImage: img,
        pricePack1Gs: p1,
        pricePack2Gs: p2,
        normalPriceGs: pNormal,
        freeShipping,
        aspectRatio: '1:1',
        hookBadge: compHook,
        headline: compHeadline,
        subHeadline: desc.slice(0, 65),
        ctaLabel: 'VER OFERTA HOY',
        themeIndex: 1 + variantSeed
      })
    },
    {
      id: `cr-story-3-${product.id}-${variantSeed}`,
      type: 'image_story_9x16',
      formatLabel: 'Imagen Vertical 9:16 (1080×1920) · Stories & Reels',
      aspectRatio: '9:16',
      angleTitle: 'Ángulo #3 · Escalera de Valor Pack 2 Unidades (Mayor Ticket)',
      hookBadge: storyHook,
      headline: storyHeadline,
      primaryText: storyPrimary,
      descriptionText: 'Deslizá o tocá para pedir en 30 segundos',
      ctaType: 'ORDER_NOW',
      ctaLabel: 'QUIERO MI PACK HOY',
      visualThemeIndex: (2 + variantSeed) % CREATIVE_COLOR_THEMES.length,
      imageDataUrl: buildHighImpactAdSvgDataUrl({
        productName: product.nombre,
        productImage: img,
        pricePack1Gs: p1,
        pricePack2Gs: p2,
        normalPriceGs: pNormal,
        freeShipping,
        aspectRatio: '9:16',
        hookBadge: storyHook,
        headline: storyHeadline,
        subHeadline: `Pack 2 Unidades: ${formatGs(p2)} · Pago al Recibir`,
        ctaLabel: 'QUIERO MI PACK HOY',
        themeIndex: 2 + variantSeed
      })
    },
    {
      id: `cr-video-4-${product.id}-${variantSeed}`,
      type: 'video_reel_9x16',
      formatLabel: 'Video Comercial IA 9:16 (4 Escenas Dinámicas) · Reels & Feed',
      aspectRatio: '9:16',
      angleTitle: 'Ángulo #4 · Video Comercial de Alto Impacto (Hook → Demo → Oferta → CTA)',
      hookBadge: videoHook,
      headline: videoHeadline,
      primaryText: videoPrimary,
      descriptionText: 'Video optimizado para el algoritmo de Meta Reels',
      ctaType: 'SHOP_NOW',
      ctaLabel: 'COMPRAR AHORA',
      visualThemeIndex: (3 + variantSeed) % CREATIVE_COLOR_THEMES.length,
      imageDataUrl: buildHighImpactAdSvgDataUrl({
        productName: product.nombre,
        productImage: img,
        pricePack1Gs: p1,
        pricePack2Gs: p2,
        normalPriceGs: pNormal,
        freeShipping,
        aspectRatio: '9:16',
        hookBadge: videoHook,
        headline: videoHeadline,
        subHeadline: 'Video Comercial 4 Escenas · Alto CTR en Meta Ads',
        ctaLabel: 'COMPRAR AHORA',
        themeIndex: 3 + variantSeed
      }),
      videoScenes: [
        {
          durationSec: 3,
          badge: 'ESCENA 1 · HOOK (0-3s)',
          title: `¿Ya viste el nuevo ${product.nombre}?`,
          subtitle: 'La solución que miles de hogares en Paraguay estaban esperando',
          priceTag: `Hoy con Descuento Especial`,
          bgGradient: 'from-[#041a12] via-[#0b3d2e] to-[#041a12]'
        },
        {
          durationSec: 3,
          badge: 'ESCENA 2 · BENEFICIO REAL (3-6s)',
          title: desc.slice(0, 62),
          subtitle: 'Calidad verificada antes de salir a reparto',
          priceTag: freeShipping ? '🚚 ENVÍO GRATIS A DOMICILIO' : '🚚 ENTREGA RÁPIDA EN PUERTA',
          bgGradient: 'from-[#0f172a] via-[#1e3a8a] to-[#0f172a]'
        },
        {
          durationSec: 3,
          badge: 'ESCENA 3 · OFERTA DE PACKS (6-9s)',
          title: `1 Unidad: ${formatGs(p1)}`,
          subtitle: `🔥 Pack 2 Unidades Ahorro: ${formatGs(p2)}`,
          priceTag: `Antes: ${formatGs(pNormal)}`,
          bgGradient: 'from-[#3b0764] via-[#581c87] to-[#1e1b4b]'
        },
        {
          durationSec: 3,
          badge: 'ESCENA 4 · LLAMADO A LA ACCIÓN (9-12s)',
          title: 'Pagás Recién al Recibir en tu Casa',
          subtitle: 'Tocá el botón "Comprar" acá abajo y reservá en 30 segundos',
          priceTag: '✅ EFECTIVO O QR AL RECIBIR',
          bgGradient: 'from-[#064e3b] via-[#15803d] to-[#041a12]'
        }
      ]
    }
  ];
}
