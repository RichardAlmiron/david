import sharp, { type Sharp, type OverlayOptions } from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  Order,
  WaCommercialStageId,
  WaStageCommercialAsset,
  ProductWaStageCommercialMap
} from '../src/types';
import {
  resolveOrderCommercialPackAndPrice,
  buildStageCommercialCopyAndPrompt,
  VIP_PREPAYMENT_DISCOUNT_GS,
  WA_COMMERCIAL_STAGES,
  WA_COMMERCIAL_PACKS,
  type MinimalProductPricingInput
} from '../src/utils/waStageCommercials';

const STUDIO_ASSETS = {
  noeluxPack1: '/src/assets/images/noelux_fachada_jardin_1793968638764.jpg',
  noeluxPack2: '/src/assets/images/noelux_pack2_double_bundle_1794353241231.jpg',
  noeluxPack3: '/src/assets/images/noelux_pack3_triple_bundle_1794353242126.jpg',
  advisorFemale: '/src/assets/images/wa_advisor_warning_female_1794350101678.jpg',
  advisorMale: '/src/assets/images/wa_advisor_warning_male_1794350102657.jpg',
  dispatchConfirmedBg: '/src/assets/images/wa_dispatch_confirmed_bg_1794350103800.jpg',
  vipGoldPodiumBg: '/src/assets/images/wa_vip_gold_podium_bg_1794350104559.jpg',
  defaultProductFallback: '/assets/real/galeria-1.jpg'
};

const WA_COMMERCIALS_PUBLIC_DIR = path.resolve(
  process.cwd(),
  'public',
  'assets',
  'wa-commercials'
);

const memoryBufferCache = new Map<string, { buffer: Buffer; publicUrl: string }>();

function ensureCommercialsDir(): void {
  try {
    if (!fs.existsSync(WA_COMMERCIALS_PUBLIC_DIR)) {
      fs.mkdirSync(WA_COMMERCIALS_PUBLIC_DIR, { recursive: true });
    }
  } catch {}
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncateText(text: string, maxChars: number): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  return clean.slice(0, Math.max(4, maxChars - 1)).trim() + '…';
}

function wrapTwoLines(text: string, maxPerLine: number): [string, string] {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxPerLine) return [clean, ''];
  const words = clean.split(' ');
  let line1 = '';
  let idx = 0;
  while (idx < words.length) {
    const candidate = line1 ? `${line1} ${words[idx]}` : words[idx];
    if (candidate.length <= maxPerLine || !line1) {
      line1 = candidate;
      idx++;
    } else {
      break;
    }
  }
  const remainder = words.slice(idx).join(' ');
  return [truncateText(line1, maxPerLine + 2), remainder ? truncateText(remainder, maxPerLine + 2) : ''];
}

async function loadImageBufferSafe(rawSource?: string | null): Promise<Buffer | null> {
  const src = String(rawSource || '').trim();
  if (!src) return null;

  try {
    if (src.startsWith('data:image/')) {
      const commaIdx = src.indexOf(',');
      if (commaIdx > 0) {
        return Buffer.from(src.slice(commaIdx + 1), 'base64');
      }
    }

    if (/^https?:\/\//i.test(src)) {
      const res = await fetch(src, { signal: AbortSignal.timeout(6500) });
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
      return null;
    }

    const cleanRel = src.split('?')[0].replace(/^\/+/, '');
    const candidates = [
      path.resolve(process.cwd(), 'public', cleanRel),
      path.resolve(process.cwd(), cleanRel)
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return fs.readFileSync(candidate);
      }
    }
  } catch {}
  return null;
}

async function createRoundedImageCard(
  imgBuf: Buffer,
  width: number,
  height: number,
  radius: number,
  borderHex: string,
  borderWidth = 5
): Promise<Buffer> {
  const resized = await sharp(imgBuf)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  const maskSvg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#ffffff"/>
    </svg>`
  );

  const borderSvg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${borderWidth / 2}" y="${borderWidth / 2}" width="${width - borderWidth}" height="${height - borderWidth}" rx="${radius}" ry="${radius}" fill="none" stroke="${borderHex}" stroke-width="${borderWidth}"/>
    </svg>`
  );

  return sharp(resized)
    .composite([
      { input: maskSvg, blend: 'dest-in' },
      { input: borderSvg, blend: 'over' }
    ])
    .png()
    .toBuffer();
}

interface StageVisualTheme {
  bgDark1: string;
  bgDark2: string;
  frameStroke: string;
  ribbonBg: string;
  ribbonText: string;
  plaqueBorder: string;
  priceBoxBg: string;
  priceBoxText: string;
  ctaBg1: string;
  ctaBg2: string;
  ctaText: string;
  badgeFill: string;
  badgeText: string;
}

function getStageTheme(stageId: WaCommercialStageId): StageVisualTheme {
  if (stageId === 'stage2_warning') {
    return {
      bgDark1: '#191207',
      bgDark2: '#0b0906',
      frameStroke: '#f59e0b',
      ribbonBg: '#f59e0b',
      ribbonText: '#111827',
      plaqueBorder: '#fbbf24',
      priceBoxBg: '#f59e0b',
      priceBoxText: '#09090b',
      ctaBg1: '#d97706',
      ctaBg2: '#b45309',
      ctaText: '#ffffff',
      badgeFill: '#fbbf24',
      badgeText: '#09090b'
    };
  }

  if (stageId === 'stage3_confirmed') {
    return {
      bgDark1: '#052217',
      bgDark2: '#04120c',
      frameStroke: '#22c55e',
      ribbonBg: '#16a34a',
      ribbonText: '#ffffff',
      plaqueBorder: '#4ade80',
      priceBoxBg: '#16a34a',
      priceBoxText: '#ffffff',
      ctaBg1: '#15803d',
      ctaBg2: '#166534',
      ctaText: '#ffffff',
      badgeFill: '#22c55e',
      badgeText: '#052e16'
    };
  }

  if (stageId === 'stage4_vip_upsell') {
    return {
      bgDark1: '#181305',
      bgDark2: '#071711',
      frameStroke: '#eab308',
      ribbonBg: '#eab308',
      ribbonText: '#09090b',
      plaqueBorder: '#fde047',
      priceBoxBg: '#eab308',
      priceBoxText: '#09090b',
      ctaBg1: '#16a34a',
      ctaBg2: '#15803d',
      ctaText: '#ffffff',
      badgeFill: '#fde047',
      badgeText: '#09090b'
    };
  }

  // stage1_welcome
  return {
    bgDark1: '#072a1e',
    bgDark2: '#04130e',
    frameStroke: '#e8b23a',
    ribbonBg: '#e8b23a',
    ribbonText: '#062319',
    plaqueBorder: '#e8b23a',
    priceBoxBg: '#10b981',
    priceBoxText: '#04130e',
    ctaBg1: '#16a34a',
    ctaBg2: '#15803d',
    ctaText: '#ffffff',
    badgeFill: '#e8b23a',
    badgeText: '#062319'
  };
}

export interface RenderWaStageCommercialOptions {
  product?: (MinimalProductPricingInput & { descripcion?: string; vozAgente?: string }) | null;
  stageId: WaCommercialStageId;
  orderOrPackQty: Partial<Order> | number;
  aiSceneUrl?: string;
  voiceGender?: 'Femenina' | 'Masculina';
  overridePriceGs?: number;
  overrideVipPriceGs?: number;
}

export async function renderWaStageCommercialImage(
  options: RenderWaStageCommercialOptions
): Promise<{
  buffer: Buffer;
  publicUrl: string;
  resolved: ReturnType<typeof resolveOrderCommercialPackAndPrice>;
  whatsappCaption: string;
  headline: string;
  ctaText: string;
  sourceType: 'studio_framed' | 'ai_framed';
}> {
  ensureCommercialsDir();

  const baseResolved = resolveOrderCommercialPackAndPrice(
    options.orderOrPackQty,
    options.product
  );

  // Permitir override explícito de precio desde query params dinámicos si se especificó
  const finalOfficialPriceGs =
    typeof options.overridePriceGs === 'number' && options.overridePriceGs > 0
      ? Math.round(options.overridePriceGs)
      : baseResolved.officialPriceGs;
  const finalVipPriceGs =
    typeof options.overrideVipPriceGs === 'number' && options.overrideVipPriceGs > 0
      ? Math.round(options.overrideVipPriceGs)
      : Math.max(50000, finalOfficialPriceGs - VIP_PREPAYMENT_DISCOUNT_GS);

  const resolved = {
    ...baseResolved,
    officialPriceGs: finalOfficialPriceGs,
    officialPriceFormatted: `Gs. ${finalOfficialPriceGs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`,
    vipPriceGs: finalVipPriceGs,
    vipPriceFormatted: `Gs. ${finalVipPriceGs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
  };

  const copy = buildStageCommercialCopyAndPrompt(
    options.stageId,
    resolved,
    options.product?.descripcion || ''
  );

  const voiceRaw = String(options.product?.vozAgente || '').toLowerCase();
  const effectiveGender: 'Femenina' | 'Masculina' =
    options.voiceGender ||
    (voiceRaw.includes('sirio') || voiceRaw.includes('nestor') ? 'Masculina' : 'Femenina');

  const productImgRef = String(options.product?.imagen || STUDIO_ASSETS.defaultProductFallback);
  const effectiveAiSceneUrl = String(options.aiSceneUrl || '').trim();

  const sigInput = JSON.stringify({
    v: 'v5_single_spectacular_pack_1080',
    prodId: options.product?.id || 'default',
    prodName: resolved.productDisplayName,
    imgSig: productImgRef.slice(0, 140),
    aiSig: effectiveAiSceneUrl.slice(0, 140),
    stage: options.stageId,
    qty: resolved.unitCount,
    price: resolved.officialPriceGs,
    vip: resolved.vipPriceGs,
    gender: effectiveGender
  });
  const hash = crypto.createHash('sha1').update(sigInput).digest('hex').slice(0, 14);
  const safeProdSlug = String(options.product?.id || 'prod')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 24);
  const fileName = `wacom_${safeProdSlug}_${options.stageId}_p${resolved.unitCount}_${resolved.officialPriceGs}_${hash}.jpg`;
  const diskPath = path.join(WA_COMMERCIALS_PUBLIC_DIR, fileName);
  const publicUrl = `/assets/wa-commercials/${fileName}`;
  const sourceType: 'studio_framed' | 'ai_framed' = effectiveAiSceneUrl ? 'ai_framed' : 'studio_framed';

  const cached = memoryBufferCache.get(hash);
  if (cached) {
    if (!fs.existsSync(diskPath)) {
      try {
        fs.writeFileSync(diskPath, cached.buffer);
      } catch {}
    }
    return {
      buffer: cached.buffer,
      publicUrl: cached.publicUrl,
      resolved,
      whatsappCaption: copy.whatsappCaption,
      headline: copy.headline,
      ctaText: copy.ctaBannerText,
      sourceType
    };
  }

  if (fs.existsSync(diskPath)) {
    try {
      const existingBuf = fs.readFileSync(diskPath);
      if (existingBuf.length > 4000) {
        memoryBufferCache.set(hash, { buffer: existingBuf, publicUrl });
        return {
          buffer: existingBuf,
          publicUrl,
          resolved,
          whatsappCaption: copy.whatsappCaption,
          headline: copy.headline,
          ctaText: copy.ctaBannerText,
          sourceType
        };
      }
    } catch {}
  }

  const theme = getStageTheme(options.stageId);
  const W = 1080;
  const H = 1080;

  // 1. Base Canvas (1080x1080)
  const aiSceneBuf = effectiveAiSceneUrl ? await loadImageBufferSafe(effectiveAiSceneUrl) : null;
  let productBuf = await loadImageBufferSafe(productImgRef);
  if (!productBuf) {
    productBuf = await loadImageBufferSafe(STUDIO_ASSETS.defaultProductFallback);
  }

  let baseCanvas: Sharp;
  const compositeLayers: OverlayOptions[] = [];

  if (aiSceneBuf) {
    // AI Framed Mode: Full 1080x1080 AI commercial photography + top/bottom dark studio scrims + framed Pack & Price plaques
    const resizedAi = await sharp(aiSceneBuf)
      .resize(W, H, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 92 })
      .toBuffer();
    baseCanvas = sharp(resizedAi);
  } else {
    // Studio Framed Mode: Stage-authentic backdrop + 1x / 2x / 3x physical product showcase cards
    let backdropBuf: Buffer | null = null;
    if (options.stageId === 'stage3_confirmed') {
      backdropBuf = await loadImageBufferSafe(STUDIO_ASSETS.dispatchConfirmedBg);
    } else if (options.stageId === 'stage4_vip_upsell') {
      backdropBuf = await loadImageBufferSafe(STUDIO_ASSETS.vipGoldPodiumBg);
    }

    if (backdropBuf) {
      const darkenedBg = await sharp(backdropBuf)
        .resize(W, H, { fit: 'cover', position: 'centre' })
        .modulate({ brightness: 0.62, saturation: 1.05 })
        .jpeg({ quality: 90 })
        .toBuffer();
      baseCanvas = sharp(darkenedBg);
    } else {
      const bgSvg = Buffer.from(
        `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="studioGlow" cx="50%" cy="44%" r="62%">
              <stop offset="0%" stop-color="${theme.bgDark1}" />
              <stop offset="65%" stop-color="${theme.bgDark2}" />
              <stop offset="100%" stop-color="#040706" />
            </radialGradient>
            <radialGradient id="spotLight" cx="50%" cy="43%" r="34%">
              <stop offset="0%" stop-color="${theme.frameStroke}" stop-opacity="0.24" />
              <stop offset="100%" stop-color="${theme.frameStroke}" stop-opacity="0" />
            </radialGradient>
          </defs>
          <rect width="${W}" height="${H}" fill="url(#studioGlow)" />
          <rect width="${W}" height="${H}" fill="url(#spotLight)" />
        </svg>`
      );
      baseCanvas = sharp(bgSvg);
    }

    const isNoeluxProjectorProduct =
      /noelux|proyector/i.test(String(options.product?.id || '')) ||
      /noelux|proyector/i.test(String(resolved.productDisplayName || '')) ||
      /galeria-1\.jpg|noelux_/i.test(productImgRef);

    const bespokePackBundleBuf = isNoeluxProjectorProduct
      ? await loadImageBufferSafe(
          resolved.packVisualUnitsCount === 1
            ? STUDIO_ASSETS.noeluxPack1
            : resolved.packVisualUnitsCount === 2
            ? STUDIO_ASSETS.noeluxPack2
            : STUDIO_ASSETS.noeluxPack3
        )
      : null;

    // Stage 2 Warning Special Layout: Human Logistics Advisor on the left + Exact Pack (1x, 2x, or 3x) on the right
    if (options.stageId === 'stage2_warning') {
      const advisorPath =
        effectiveGender === 'Masculina'
          ? STUDIO_ASSETS.advisorMale
          : STUDIO_ASSETS.advisorFemale;
      const advisorBuf = await loadImageBufferSafe(advisorPath);
      if (advisorBuf) {
        const advisorCard = await createRoundedImageCard(
          advisorBuf,
          440,
          456,
          28,
          theme.frameStroke,
          5
        );
        compositeLayers.push({ input: advisorCard, left: 56, top: 224 });
      }

      if (bespokePackBundleBuf) {
        const bundleRightCard = await createRoundedImageCard(
          bespokePackBundleBuf,
          496,
          412,
          28,
          theme.frameStroke,
          5
        );
        compositeLayers.push({ input: bundleRightCard, left: 528, top: 228 });
      } else if (productBuf) {
        if (resolved.packVisualUnitsCount === 1) {
          const c1 = await createRoundedImageCard(productBuf, 430, 430, 28, '#ffffff', 5);
          compositeLayers.push({ input: c1, left: 576, top: 236 });
        } else if (resolved.packVisualUnitsCount === 2) {
          const cLeft = await createRoundedImageCard(productBuf, 275, 295, 24, '#cbd5e1', 4);
          const cRight = await createRoundedImageCard(productBuf, 295, 315, 24, theme.frameStroke, 5);
          compositeLayers.push({ input: cLeft, left: 528, top: 295 });
          compositeLayers.push({ input: cRight, left: 724, top: 245 });
        } else {
          const cLeft = await createRoundedImageCard(productBuf, 215, 235, 20, '#cbd5e1', 4);
          const cRight = await createRoundedImageCard(productBuf, 215, 235, 20, '#cbd5e1', 4);
          const cCenter = await createRoundedImageCard(productBuf, 265, 285, 24, theme.frameStroke, 5);
          compositeLayers.push({ input: cLeft, left: 520, top: 345 });
          compositeLayers.push({ input: cRight, left: 805, top: 345 });
          compositeLayers.push({ input: cCenter, left: 644, top: 238 });
        }
      }
    } else if (bespokePackBundleBuf) {
      // Stage 1, Stage 3, Stage 4: Wide Studio Bundle Photograph showing exact 1x, 2x, or 3x units
      const heroBundleCard = await createRoundedImageCard(
        bespokePackBundleBuf,
        740,
        416,
        32,
        theme.frameStroke,
        6
      );
      compositeLayers.push({ input: heroBundleCard, left: 170, top: 228 });
    } else if (productBuf) {
      // Dynamic fallback for future custom products: 1-unit, 2-unit Duo, or 3-unit Trio Showcase
      if (resolved.packVisualUnitsCount === 1) {
        const singleCard = await createRoundedImageCard(
          productBuf,
          446,
          446,
          32,
          theme.frameStroke,
          6
        );
        compositeLayers.push({ input: singleCard, left: 317, top: 226 });
      } else if (resolved.packVisualUnitsCount === 2) {
        const cardA = await createRoundedImageCard(productBuf, 372, 372, 28, '#e2e8f0', 5);
        const cardB = await createRoundedImageCard(productBuf, 392, 392, 30, theme.frameStroke, 6);
        compositeLayers.push({ input: cardA, left: 162, top: 268 });
        compositeLayers.push({ input: cardB, left: 516, top: 242 });
      } else {
        const cardLeft = await createRoundedImageCard(productBuf, 304, 304, 24, '#cbd5e1', 4);
        const cardRight = await createRoundedImageCard(productBuf, 304, 304, 24, '#cbd5e1', 4);
        const cardHero = await createRoundedImageCard(
          productBuf,
          376,
          376,
          30,
          theme.frameStroke,
          6
        );
        compositeLayers.push({ input: cardLeft, left: 96, top: 316 });
        compositeLayers.push({ input: cardRight, left: 680, top: 316 });
        compositeLayers.push({ input: cardHero, left: 352, top: 236 });
      }
    }
  }

  // 2. Build Crisp Commercial Frame + Pack Seal + Framed Price Plaque + CTA Bar SVG Overlay
  const [headLine1, headLine2] = wrapTwoLines(copy.headline, 34);
  const cleanSub = truncateText(copy.subheadline, 84);
  const subFontSize = cleanSub.length > 64 ? 20 : 22;
  const displayProdTitle = truncateText(resolved.productDisplayName, 40);
  const prodTitleFontSize = displayProdTitle.length > 32 ? 24 : displayProdTitle.length > 25 ? 26 : 30;
  const cleanSecondaryPrice = truncateText(copy.framedSecondaryPriceText, 54);

  const badgeCenterX =
    !aiSceneBuf && options.stageId === 'stage2_warning'
      ? 776
      : 540;
  const badgeCenterY = !aiSceneBuf && options.stageId === 'stage2_warning' ? 644 : 646;

  const advisorTagMarkup =
    !aiSceneBuf && options.stageId === 'stage2_warning'
      ? `
      <g>
        <rect x="74" y="618" width="404" height="50" rx="14" fill="#09090b" fill-opacity="0.90" stroke="${theme.frameStroke}" stroke-width="2"/>
        <circle cx="104" cy="643" r="8" fill="#22c55e"/>
        <text x="124" y="650" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="20" font-weight="700" fill="#ffffff">
          ÁREA DE DESPACHO · EN ESPERA
        </text>
      </g>`
      : '';

  const stageStatusIconPath =
    options.stageId === 'stage2_warning'
      ? `<circle cx="90" cy="70" r="16" fill="none" stroke="${theme.ribbonText}" stroke-width="3.5"/><path d="M90 60 V71 L97 75" stroke="${theme.ribbonText}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`
      : options.stageId === 'stage3_confirmed'
      ? `<circle cx="90" cy="70" r="16" fill="none" stroke="${theme.ribbonText}" stroke-width="3.5"/><path d="M82 70 L88 76 L99 64" stroke="${theme.ribbonText}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
      : `<rect x="75" y="56" width="30" height="28" rx="5" fill="none" stroke="${theme.ribbonText}" stroke-width="3.5"/><path d="M75 65 H105 M90 56 V84" stroke="${theme.ribbonText}" stroke-width="3" fill="none"/>`;

  const topBottomScrimMarkup = aiSceneBuf
    ? `
      <defs>
        <linearGradient id="topScrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#040806" stop-opacity="0.92"/>
          <stop offset="75%" stop-color="#040806" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#040806" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="botScrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#040806" stop-opacity="0"/>
          <stop offset="28%" stop-color="#040806" stop-opacity="0.78"/>
          <stop offset="100%" stop-color="#040806" stop-opacity="0.96"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${W}" height="250" fill="url(#topScrim)"/>
      <rect x="0" y="640" width="${W}" height="440" fill="url(#botScrim)"/>
    `
    : '';

  const priceChars = copy.framedPrimaryPriceText.length;
  const primaryPriceFontSize = priceChars >= 13 ? 48 : priceChars >= 11 ? 54 : 58;

  const overlaySvg = Buffer.from(
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ctaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${theme.ctaBg1}"/>
          <stop offset="100%" stop-color="${theme.ctaBg2}"/>
        </linearGradient>
      </defs>

      ${topBottomScrimMarkup}

      <!-- Marco Comercial Exterior Doble -->
      <rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="34" fill="none" stroke="${theme.frameStroke}" stroke-width="5" stroke-opacity="0.92"/>
      <rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="26" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.18"/>

      <!-- Cinta Superior de Etapa + Paquete -->
      <rect x="54" y="42" width="972" height="56" rx="16" fill="${theme.ribbonBg}"/>
      ${stageStatusIconPath}
      <text x="122" y="79" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="25" font-weight="800" letter-spacing="0.8" fill="${theme.ribbonText}">
        ${escapeXml(truncateText(copy.topRibbon, 48))}
      </text>

      <!-- Titular Comercial Congruente -->
      <text x="540" y="${headLine2 ? '142' : '154'}" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="${headLine2 ? '38' : '44'}" font-weight="800" fill="#ffffff">
        ${escapeXml(headLine1)}
      </text>
      ${
        headLine2
          ? `<text x="540" y="184" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="36" font-weight="800" fill="#ffffff">${escapeXml(headLine2)}</text>`
          : ''
      }
      <text x="540" y="${headLine2 ? '214' : '196'}" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="${subFontSize}" font-weight="600" fill="#d1fae5">
        ${escapeXml(cleanSub)}
      </text>

      ${advisorTagMarkup}

      <!-- Sello Inequívoco de Cantidad del Paquete (1X / 2X / 3X) -->
      <g>
        <rect x="${badgeCenterX - 210}" y="${badgeCenterY - 31}" width="420" height="62" rx="31" fill="${theme.badgeFill}" stroke="#09090b" stroke-width="4"/>
        <text x="${badgeCenterX}" y="${badgeCenterY + 8}" text-anchor="middle" font-family="JetBrains Mono, DejaVu Sans Mono, monospace" font-size="23" font-weight="800" letter-spacing="0.8" fill="${theme.badgeText}">
          ${escapeXml(`${resolved.packBadgeCode} · ${resolved.packTitleUpper}`)}
        </text>
      </g>

      <!-- PLACA CENTRAL CON PRECIO Y PAQUETE ENMARCADO ("Precio y todo enmarcado") -->
      <g>
        <rect x="48" y="704" width="984" height="212" rx="26" fill="#070b09" fill-opacity="0.95" stroke="${theme.plaqueBorder}" stroke-width="4"/>
        <rect x="58" y="714" width="964" height="192" rx="20" fill="none" stroke="${theme.plaqueBorder}" stroke-width="1.5" stroke-opacity="0.38"/>

        <!-- Columna Izquierda: Detalle del Paquete Seleccionado -->
        <text x="82" y="758" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="20" font-weight="800" letter-spacing="0.6" fill="${theme.plaqueBorder}">
          ${escapeXml(truncateText(copy.priceFrameLabel, 38))}
        </text>
        <text x="82" y="803" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="${prodTitleFontSize}" font-weight="800" fill="#ffffff">
          ${escapeXml(displayProdTitle)}
        </text>
        <text x="82" y="843" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="21" font-weight="700" fill="#a7f3d0">
          ${escapeXml(
            resolved.unitCount === 1
              ? 'Cantidad exacta: 1 unidad nueva en caja'
              : `Cantidad exacta: ${resolved.unitCount} unidades nuevas en caja`
          )}
        </text>
        <text x="82" y="881" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="19.5" font-weight="600" fill="#d4d4d8">
          ${escapeXml(cleanSecondaryPrice)}
        </text>

        <!-- Columna Derecha: Caja Enmarcada del Precio Oficial en Guaraníes -->
        <rect x="606" y="726" width="404" height="168" rx="20" fill="${theme.priceBoxBg}" stroke="#ffffff" stroke-width="3"/>
        <text x="808" y="766" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="20" font-weight="800" letter-spacing="1" fill="${theme.priceBoxText}">
          ${options.stageId === 'stage4_vip_upsell' ? 'PRECIO VIP CON DESCUENTO' : 'PRECIO TOTAL ENMARCADO'}
        </text>
        <text x="808" y="832" text-anchor="middle" font-family="JetBrains Mono, DejaVu Sans Mono, monospace" font-size="${primaryPriceFontSize}" font-weight="800" fill="${theme.priceBoxText}">
          ${escapeXml(copy.framedPrimaryPriceText)}
        </text>
        <text x="808" y="874" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="20" font-weight="800" fill="${theme.priceBoxText}">
          ${escapeXml(
            options.stageId === 'stage4_vip_upsell'
              ? `AHORRÁS Gs. 30.000 HOY`
              : `${resolved.packTitleUpper} · ENVÍO GRATIS`
          )}
        </text>
      </g>

      <!-- Barra Inferior de Llamada a la Acción (CTA) -->
      <rect x="48" y="934" width="984" height="92" rx="22" fill="url(#ctaGrad)" stroke="#ffffff" stroke-width="2" stroke-opacity="0.35"/>
      <text x="540" y="990" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="27" font-weight="800" letter-spacing="0.5" fill="${theme.ctaText}">
        ${escapeXml(truncateText(copy.ctaBannerText, 48))}
      </text>
    </svg>`
  );

  compositeLayers.push({ input: overlaySvg, left: 0, top: 0 });

  const finalJpegBuffer = await baseCanvas
    .composite(compositeLayers)
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toBuffer();

  try {
    fs.writeFileSync(diskPath, finalJpegBuffer);
  } catch {}
  memoryBufferCache.set(hash, { buffer: finalJpegBuffer, publicUrl });

  return {
    buffer: finalJpegBuffer,
    publicUrl,
    resolved,
    whatsappCaption: copy.whatsappCaption,
    headline: copy.headline,
    ctaText: copy.ctaBannerText,
    sourceType
  };
}

/**
 * Genera y guarda de inmediato la matriz completa de 12 comerciales (4 etapas × Pack 1, Pack 2 y Pack 3)
 * para un producto, conservando cualquier escena IA previa (`aiSceneUrl`) y actualizando los marcos de precio.
 */
export async function renderFullProductCommercialMatrixOnServer(
  product: MinimalProductPricingInput & { descripcion?: string; vozAgente?: string }
): Promise<ProductWaStageCommercialMap> {
  const existingMap = product.waStageCommercials || {};
  const nextMap: ProductWaStageCommercialMap = {};

  for (const stage of WA_COMMERCIAL_STAGES) {
    nextMap[stage.id] = {};
    for (const pack of WA_COMMERCIAL_PACKS) {
      const prevAsset = existingMap?.[stage.id]?.[pack.packKey];
      const rendered = await renderWaStageCommercialImage({
        product,
        stageId: stage.id,
        orderOrPackQty: pack.packQty,
        aiSceneUrl: prevAsset?.aiSceneUrl
      });

      const asset: WaStageCommercialAsset = {
        stageId: stage.id,
        packKey: pack.packKey,
        packQty: pack.packQty,
        imageUrl: rendered.publicUrl,
        aiSceneUrl: prevAsset?.aiSceneUrl,
        framedPriceGs: rendered.resolved.officialPriceGs,
        vipPriceGs: rendered.resolved.vipPriceGs,
        normalStrikePriceGs: rendered.resolved.normalStrikePriceGs,
        headline: rendered.headline,
        ctaText: rendered.ctaText,
        whatsappCaption: rendered.whatsappCaption,
        sourceType: rendered.sourceType,
        generatedAt: new Date().toISOString()
      };

      nextMap[stage.id]![pack.packKey] = asset;
    }
  }

  return nextMap;
}

export interface RenderPersonalizedOrderWelcomeOptions {
  order: Partial<Order> & Record<string, any>;
  product?: (MinimalProductPricingInput & { descripcion?: string; categoria?: string }) | null;
  openRouterApiKey?: string;
  openRouterImageModel?: string;
  appReferer?: string;
  forceRegenerate?: boolean;
}

export interface RenderPersonalizedOrderWelcomeResult {
  buffer: Buffer;
  diskPath: string;
  publicUrl: string;
  generatedBy: 'openrouter:cached' | `openrouter:${string}`;
  orderHash: string;
}

function sanitizePersonalizedDeliveryText(raw: string): string {
  return String(raw || '')
    .replace(/\s*[·•-]?\s*\[(?:GPS|Ubicaci[oó]n|Mapa)[^\]]*\]?/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCustomerShippingSummaryForVisual(
  orderInput: Partial<Order> & Record<string, any>,
  productInput?: (MinimalProductPricingInput & { descripcion?: string; categoria?: string }) | null
) {
  const order = orderInput || {};
  const resolved = resolveOrderCommercialPackAndPrice(order, productInput || undefined);
  const reservaid = String(order.reservaid || 'NX-PEDIDO').trim().toUpperCase();
  const fullName = sanitizePersonalizedDeliveryText(String(order.nombre || '')) || 'Cliente VIP Noelux';
  const phone = sanitizePersonalizedDeliveryText(String(order.celular || '')) || 'Registrado en sistema';

  // REGLA ESTRICTA: En las imágenes (Imagen #1 e Imagen #2) va ÚNICAMENTE la Ciudad, el Barrio y la Calle
  // que escribió el cliente en el formulario (JAMÁS datos obtenidos del mapa GPS como gpsDireccionDetectada).
  const rawCity = sanitizePersonalizedDeliveryText(String(order.ciudad || '')) || 'A confirmar';
  const cityDept = rawCity;

  const rawBarrio = sanitizePersonalizedDeliveryText(String(order.barrio || ''));
  const rawCalle = sanitizePersonalizedDeliveryText(String(order.calle || ''));
  const rawDireccion = sanitizePersonalizedDeliveryText(String(order.direccion || ''));

  const addressBarrio =
    (rawBarrio || rawCalle
      ? [rawBarrio, rawCalle].filter(Boolean).join(' · ')
      : rawDireccion) || 'Dirección registrada en formulario';
  const isBuilding =
    order.tipoVivienda === 'edificio' ||
    Boolean(order.nombreEdificio || order.pisoEdificio || order.departamentoNumero);

  const buildingName = sanitizePersonalizedDeliveryText(String(order.nombreEdificio || ''));
  const floorVal = sanitizePersonalizedDeliveryText(String(order.pisoEdificio || ''));
  const aptVal = sanitizePersonalizedDeliveryText(String(order.departamentoNumero || ''));
  const receptionVal =
    order.tieneRecepcion === 'si_recepcionista'
      ? 'Portería / Recepción'
      : order.tieneRecepcion === 'no_personalmente'
        ? 'Recibe personalmente'
        : sanitizePersonalizedDeliveryText(String(order.detalleRecepcion || ''));

  const buildingParts: string[] = [];
  if (buildingName) buildingParts.push(`Edif. ${buildingName}`);
  if (floorVal) buildingParts.push(`Piso ${floorVal}`);
  if (aptVal) buildingParts.push(`Dpto ${aptVal}`);
  if (receptionVal) buildingParts.push(receptionVal);
  const buildingSummary = isBuilding ? buildingParts.join(' · ') : '';

  const houseRef = sanitizePersonalizedDeliveryText(String(order.referenciaCasa || ''));
  const productName =
    sanitizePersonalizedDeliveryText(String(order.producto || productInput?.nombre || '')) ||
    'Noelux™ Proyector Navideño 12 Diseños';
  const packQty = resolved.unitCount;
  const totalGsNum = resolved.officialPriceGs;
  const totalGsFormatted = `Gs. ${totalGsNum.toLocaleString('es-PY')}`;
  const productImgRef = String(
    productInput?.imagen ||
      (packQty === 2
        ? STUDIO_ASSETS.noeluxPack2
        : packQty >= 3
          ? STUDIO_ASSETS.noeluxPack3
          : STUDIO_ASSETS.noeluxPack1)
  );

  return {
    resolved,
    reservaid,
    fullName,
    phone,
    cityDept,
    barrioOnly: rawBarrio,
    calleOnly: rawCalle,
    addressBarrio,
    isBuilding,
    buildingSummary,
    houseRef,
    productName,
    packQty,
    totalGsNum,
    totalGsFormatted,
    productImgRef
  };
}

async function fetchOpenRouterUnifiedImageBuffer(options: {
  apiKey: string;
  model: string;
  prompt: string;
  referer: string;
  productRefBuf?: Buffer | null;
}): Promise<{ buffer: Buffer; modelUsed: string }> {
  const { apiKey, model, prompt, referer, productRefBuf } = options;
  // Ejecución estricta únicamente con el modelo configurado (sin fallback a otros modelos ni SVG).
  const primaryModel = String(model || '').trim() || 'openai/gpt-image-2.6-sunburst';
  const totalDeadlineMs = Date.now() + 95000;

  let referenceDataUrl = '';
  if (productRefBuf && productRefBuf.length > 500) {
    try {
      const refJpeg = await sharp(productRefBuf)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 86 })
        .toBuffer();
      referenceDataUrl = `data:image/jpeg;base64,${refJpeg.toString('base64')}`;
    } catch {
      referenceDataUrl = '';
    }
  }

  const basePayload: any = {
    model: primaryModel,
    prompt,
    aspect_ratio: '1:1',
    quality: 'medium',
    output_format: 'jpeg',
    output_compression: 92,
    n: 1
  };

  const attemptPayloads: any[] = [];
  if (referenceDataUrl) {
    attemptPayloads.push({
      ...basePayload,
      image: referenceDataUrl,
      input_image: referenceDataUrl
    });
  }
  attemptPayloads.push(basePayload);

  let lastErrorMsg = `OpenRouter (${primaryModel}) no devolvió una imagen válida.`;

  for (const payload of attemptPayloads) {
    for (let transientAttempt = 0; transientAttempt < 4; transientAttempt++) {
      const remainingMs = totalDeadlineMs - Date.now();
      if (remainingMs < 15000) {
        throw new Error(`${lastErrorMsg} (tiempo agotado sin fallback)`);
      }
      const attemptTimeoutMs = Math.min(75000, remainingMs);
      try {
        const res = await fetch('https://openrouter.ai/api/v1/images', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': referer || 'https://noelux.app',
            'X-Title': 'Noelux Personalized VIP Order Poster'
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(attemptTimeoutMs)
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          lastErrorMsg = `OpenRouter HTTP ${res.status} (${primaryModel}): ${errText.slice(0, 220)}`;
          console.warn(`[OpenRouter Image 2.6] ${lastErrorMsg}`);
          if (res.status === 401 || res.status === 403) {
            throw new Error(lastErrorMsg);
          }
          // Si falló por imagen de referencia incompatible, reintentamos en OpenRouter solo con prompt
          if ((payload.image || payload.input_image) && (res.status === 400 || res.status === 422)) {
            break;
          }
          const isTransient =
            (res.status === 402 &&
              (errText.includes('in_flight_budget_exhausted') || errText.includes('in-flight'))) ||
            res.status === 429 ||
            res.status >= 500;
          if (isTransient && totalDeadlineMs - Date.now() >= 20000 && transientAttempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 4500));
            continue;
          }
          break;
        }

        const json: any = await res.json();
        const first = Array.isArray(json?.data) ? json.data[0] : null;
        let rawBuf: Buffer | null = null;

        if (first?.b64_json) {
          rawBuf = Buffer.from(String(first.b64_json), 'base64');
        } else if (first?.url) {
          const imgUrl = String(first.url);
          if (imgUrl.startsWith('data:image/')) {
            rawBuf = Buffer.from(imgUrl.split(',')[1] || '', 'base64');
          } else if (imgUrl.startsWith('http')) {
            const dl = await fetch(imgUrl, { signal: AbortSignal.timeout(15000) });
            if (dl.ok) {
              rawBuf = Buffer.from(await dl.arrayBuffer());
            }
          }
        }

        if (rawBuf && rawBuf.length > 5000) {
          const normalizedJpeg = await sharp(rawBuf)
            .resize(1080, 1080, { fit: 'cover', position: 'center' })
            .jpeg({ quality: 92, progressive: true })
            .toBuffer();
          return { buffer: normalizedJpeg, modelUsed: primaryModel };
        }

        lastErrorMsg = `OpenRouter (${primaryModel}) respondió sin bytes de imagen válidos.`;
        break;
      } catch (err: any) {
        lastErrorMsg = err?.message || `Error de red con ${primaryModel}`;
        console.warn(`[OpenRouter Image 2.6] ${lastErrorMsg}`);
        if (/HTTP (401|403)/.test(lastErrorMsg)) {
          throw err;
        }
        if (totalDeadlineMs - Date.now() >= 20000 && transientAttempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 3500));
          continue;
        }
        break;
      }
    }
  }

  throw new Error(`${lastErrorMsg} (fallback desactivado)`);
}

export async function renderPersonalizedOrderWelcomeImage(
  options: RenderPersonalizedOrderWelcomeOptions
): Promise<RenderPersonalizedOrderWelcomeResult> {
  ensureCommercialsDir();
  const cleanOrKey = String(options.openRouterApiKey || '').trim();
  const hasValidOpenRouterKey =
    cleanOrKey.startsWith('sk-or-') && cleanOrKey.length > 45;
  if (!hasValidOpenRouterKey) {
    throw new Error(
      'OPENROUTER_API_KEY no configurada o inválida: la generación de imágenes jamás usa fallback.'
    );
  }

  const summary = extractCustomerShippingSummaryForVisual(options.order, options.product);
  const safeOrderId =
    summary.reservaid.replace(/[^a-zA-Z0-9_-]/g, '') || 'NXORDER';

  const hashInput = JSON.stringify({
    layoutVersion: 'square-1x1-hero-v3',
    reservaid: summary.reservaid,
    fullName: summary.fullName,
    phone: summary.phone,
    cityDept: summary.cityDept,
    addressBarrio: summary.addressBarrio,
    buildingSummary: summary.buildingSummary,
    houseRef: summary.houseRef,
    productName: summary.productName,
    packQty: summary.packQty,
    totalGsNum: summary.totalGsNum,
    productImgRef: summary.productImgRef
  });
  const orderHash = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 14);

  const aiFileName = `order_welcome_${safeOrderId}_${orderHash}_ai.jpg`;
  const aiDiskPath = path.join(WA_COMMERCIALS_PUBLIC_DIR, aiFileName);

  if (!options.forceRegenerate && fs.existsSync(aiDiskPath)) {
    const buf = fs.readFileSync(aiDiskPath);
    if (buf.length > 5000) {
      return {
        buffer: buf,
        diskPath: aiDiskPath,
        publicUrl: `/assets/wa-commercials/${aiFileName}`,
        generatedBy: 'openrouter:cached',
        orderHash
      };
    }
  }

  let productBuf = await loadImageBufferSafe(summary.productImgRef);
  if (!productBuf) {
    productBuf = await loadImageBufferSafe(STUDIO_ASSETS.defaultProductFallback);
  }

  const extraLineForPrompt = summary.buildingSummary
    ? `- EDIFICIO / RECEPCIÓN: ${summary.buildingSummary}\n`
    : summary.houseRef
      ? `- REFERENCIA: ${summary.houseRef}\n`
      : '';

  const addressLinesForWelcome =
    summary.barrioOnly && summary.calleOnly
      ? `- BARRIO: ${summary.barrioOnly}\n   - CALLE: ${summary.calleOnly}`
      : `- BARRIO Y CALLE: ${summary.addressBarrio}`;

  const personalizedPrompt = `Create a SPECTACULAR, luxury flagship 1:1 SQUARE (1080x1080) HERO Advertising Poster in Spanish for "NOELUX" titled "¡CONFIRMACIÓN DE PEDIDO!", crafted so it looks jaw-dropping and prestigious AND every single word is GIANT, ULTRA-CRISP, and 100% READABLE in a small mobile WhatsApp chat bubble BEFORE tapping.
COMPOSITION & VISUAL DRAMA (3D luxury dark emerald-obsidian velvet studio, champagne gold spotlights, subtle festive shimmer bokeh):
1. SPECTACULAR HERO HEADER (top 31% height):
   - Left side: Dramatic studio-lit HERO showcase cutout/podium of the product from the attached reference photo (${summary.packQty}x ${summary.productName}) with golden rim lighting, overlapping a gleaming 3D emerald-and-24K-gold Verified Checkmark Seal.
   - Right/Top area: A gleaming 3D metallic gold ribbon pill reading "#${summary.reservaid} · ENVÍO GRATIS", ABOVE an eye-catching massive glossy 3D metallic white-and-gold Hero Headline: "CONFIRMACIÓN DE PEDIDO", followed by a radiant 24K sculpted gold price plaque reading "${summary.totalGsFormatted} · PAGO AL RECIBIR".
2. SLEEK FROSTED GLASS VIP CONSOLE (middle 54% height, 94% width):
   - Ultra-premium dark frosted emerald-glass panel with glowing chamfered 24k gold bevel borders, subtle specular corner highlights, and clean modern luxury typography (NO cramped boxy table cells or heavy yellow horizontal gridlines — clean dark luxury glass breathing space with delicate faint hairline dividers).
   - Print ALL of these exact customer shipping details in LARGE EXTRA-BOLD crisp white and warm gold text with exact spelling:
   - CLIENTE: ${summary.fullName}
   - CELULAR: ${summary.phone}
   - CIUDAD: ${summary.cityDept}
   ${addressLinesForWelcome}
   ${extraLineForPrompt}- PRODUCTO: ${summary.packQty}x ${summary.productName} · ${summary.totalGsFormatted}
3. LUMINOUS 3D HERO CTA BUTTON (bottom 12% height):
   - Glossy emerald-to-gold 3D metallic banner with highlight shine reading: "RESPONDÉ: CORRECTO PARA CONFIRMAR" in ultra-bold giant uppercase letters ("CORRECTO" glowing bright 24k gold).
STRICT RULES: 100% pure Spanish, zero typos, zero English words, zero GPS coordinates, zero map pins, zero Google Maps links, zero QR codes, and zero tiny unreadable fine print.`;

  const aiRes = await fetchOpenRouterUnifiedImageBuffer({
    apiKey: cleanOrKey,
    model: options.openRouterImageModel || 'openai/gpt-image-2.6-sunburst',
    prompt: personalizedPrompt,
    referer: options.appReferer || 'https://noelux.app',
    productRefBuf: productBuf
  });

  if (!aiRes || aiRes.buffer.length <= 5000) {
    throw new Error('OpenRouter no devolvió una Imagen #1 válida (fallback desactivado).');
  }

  try {
    fs.writeFileSync(aiDiskPath, aiRes.buffer);
  } catch {}

  return {
    buffer: aiRes.buffer,
    diskPath: aiDiskPath,
    publicUrl: `/assets/wa-commercials/${aiFileName}`,
    generatedBy: `openrouter:${aiRes.modelUsed}`,
    orderHash
  };
}

export async function renderPersonalizedOrderConfirmedImage(
  options: RenderPersonalizedOrderWelcomeOptions
): Promise<RenderPersonalizedOrderWelcomeResult> {
  ensureCommercialsDir();
  const cleanOrKey = String(options.openRouterApiKey || '').trim();
  const hasValidOpenRouterKey =
    cleanOrKey.startsWith('sk-or-') && cleanOrKey.length > 45;
  if (!hasValidOpenRouterKey) {
    throw new Error(
      'OPENROUTER_API_KEY no configurada o inválida: la generación de imágenes jamás usa fallback.'
    );
  }

  const summary = extractCustomerShippingSummaryForVisual(options.order, options.product);
  const safeOrderId =
    summary.reservaid.replace(/[^a-zA-Z0-9_-]/g, '') || 'NXORDER';

  const hashInput = JSON.stringify({
    layoutVersion: 'square-1x1-confirmed-courier-v2',
    reservaid: summary.reservaid,
    fullName: summary.fullName,
    phone: summary.phone,
    cityDept: summary.cityDept,
    barrioOnly: summary.barrioOnly,
    calleOnly: summary.calleOnly,
    addressBarrio: summary.addressBarrio,
    buildingSummary: summary.buildingSummary,
    houseRef: summary.houseRef,
    productName: summary.productName,
    packQty: summary.packQty,
    totalGsNum: summary.totalGsNum,
    productImgRef: summary.productImgRef
  });
  const orderHash = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 14);

  const aiFileName = `order_confirmed_${safeOrderId}_${orderHash}_ai.jpg`;
  const aiDiskPath = path.join(WA_COMMERCIALS_PUBLIC_DIR, aiFileName);

  if (!options.forceRegenerate && fs.existsSync(aiDiskPath)) {
    const buf = fs.readFileSync(aiDiskPath);
    if (buf.length > 5000) {
      return {
        buffer: buf,
        diskPath: aiDiskPath,
        publicUrl: `/assets/wa-commercials/${aiFileName}`,
        generatedBy: 'openrouter:cached',
        orderHash
      };
    }
  }

  let productBuf = await loadImageBufferSafe(summary.productImgRef);
  if (!productBuf) {
    productBuf = await loadImageBufferSafe(STUDIO_ASSETS.defaultProductFallback);
  }

  const addressLinesForConfirmed =
    summary.barrioOnly && summary.calleOnly
      ? `- CIUDAD: ${summary.cityDept}\n   - BARRIO: ${summary.barrioOnly}\n   - CALLE: ${summary.calleOnly}`
      : `- CIUDAD: ${summary.cityDept}\n   - BARRIO Y CALLE: ${summary.addressBarrio}`;

  const confirmedPrompt = `Create a SPECTACULAR, celebratory luxury flagship 1:1 SQUARE (1080x1080) HERO Advertising Poster in Spanish for "NOELUX" titled "¡PEDIDO CONFIRMADO!", crafted so the customer immediately sees their order is 100% CONFIRMED in their name, receives warm congratulations, and clearly reads the 48 to 72 hours courier delivery notice inside a mobile WhatsApp chat bubble BEFORE tapping.
COMPOSITION & VISUAL DRAMA (3D luxury emerald-obsidian & radiant 24K gold celebration studio, golden confetti shimmer bokeh, prestige parcel dispatch aesthetic):
1. CELEBRATORY HERO HEADER (top 32% height):
   - Left side: Dramatic studio-lit HERO showcase of the product from the attached reference photo (${summary.packQty}x ${summary.productName}) next to a gleaming 3D emerald-and-24K-gold Verified Checkmark Seal.
   - Right/Top area: A gleaming 3D metallic gold ribbon pill reading "#${summary.reservaid} · ¡MUCHAS FELICIDADES!", ABOVE a massive glossy 3D metallic emerald-and-gold Hero Headline: "¡PEDIDO CONFIRMADO!", followed by a glowing gold subheadline: "A NOMBRE DE: ${summary.fullName.toUpperCase()}".
2. SLEEK FROSTED GLASS VIP CONFIRMATION & COURIER CONSOLE (middle 54% height, 94% width):
   - Ultra-premium dark frosted emerald-glass panel with glowing chamfered 24k gold bevel borders and LARGE EXTRA-BOLD crisp white and warm gold typography:
   - ¡FELICIDADES, ${summary.fullName}! TU PEDIDO YA ESTÁ CONFIRMADO
   - PRODUCTO RESERVADO: ${summary.packQty}x ${summary.productName} · ${summary.totalGsFormatted}
   ${addressLinesForConfirmed}
   - AVISO DE TRANSPORTE (48 A 72 HORAS): En unos días (48 a 72 hs) la transportadora y los agentes del courier entrarán en contacto con vos y te estarán llamando al ${summary.phone} en cuanto ya estén listos para entregarte tu producto.
3. LUMINOUS 3D HERO FOOTER BANNER (bottom 12% height):
   - Glossy emerald-to-gold 3D metallic banner reading: "ENTREGA EN 48 A 72 HS · EL COURIER TE LLAMARÁ AL ENTREGAR" in ultra-bold giant uppercase letters.
STRICT RULES: 100% pure Spanish, zero typos, zero English words, zero GPS coordinates, zero map pins, zero Google Maps links, zero QR codes, and zero tiny unreadable fine print.`;

  const aiRes = await fetchOpenRouterUnifiedImageBuffer({
    apiKey: cleanOrKey,
    model: options.openRouterImageModel || 'openai/gpt-image-2.6-sunburst',
    prompt: confirmedPrompt,
    referer: options.appReferer || 'https://noelux.app',
    productRefBuf: productBuf
  });

  if (!aiRes || aiRes.buffer.length <= 5000) {
    throw new Error('OpenRouter no devolvió una Imagen de Pedido Confirmado válida (fallback desactivado).');
  }

  try {
    fs.writeFileSync(aiDiskPath, aiRes.buffer);
  } catch {}

  return {
    buffer: aiRes.buffer,
    diskPath: aiDiskPath,
    publicUrl: `/assets/wa-commercials/${aiFileName}`,
    generatedBy: `openrouter:${aiRes.modelUsed}`,
    orderHash
  };
}

