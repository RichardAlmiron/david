import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const FORM_BANNERS_DIR = path.resolve(process.cwd(), 'public', 'assets', 'form-banners');

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripForbiddenAndEmojis(raw: string): string {
  return String(raw || '')
    .replace(/tripwire/gi, 'artículo de entrada')
    .replace(/solicitud\s+individual/gi, 'tu selección')
    .replace(/\bun\s+pack\b/gi, 'tu paquete')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const clean = stripForbiddenAndEmojis(text);
  if (!clean) return [];
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (lines.length >= maxLines) {
        const last = lines[lines.length - 1];
        if (!last.endsWith('...')) {
          lines[lines.length - 1] = `${last.slice(0, Math.max(4, maxCharsPerLine - 3)).trimEnd()}...`;
        }
        return lines.slice(0, maxLines);
      }
      current = w.length > maxCharsPerLine ? `${w.slice(0, maxCharsPerLine - 3)}...` : w;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
}

function formatGsText(n: number): string {
  return `Gs. ${Math.round(Number(n) || 0).toLocaleString('es-PY')}`;
}

export interface OrderFormPackageCopySpec {
  eyebrow: string;
  headlineLines: string[];
  ownershipLines: string[];
  descriptionLines: string[];
  priceLabel: string;
  priceText: string;
  deliveryBannerText: string;
  subFooterText: string;
  primaryImageSrc: string;
  giftImageSrc?: string;
  isEntryOnly: boolean;
}

export function buildOrderFormPackageCopySpec(params: {
  product: any;
  purchasePath: 'entry_only' | 'principal_bundle';
  pack?: number;
  overridePriceGs?: number;
}): OrderFormPackageCopySpec {
  const { product } = params;
  const pack = Math.max(1, Math.min(3, Math.round(Number(params.pack || 1) || 1)));
  const tc = product?.tripwireConfig;
  const hasEntry = Boolean(tc?.enabled && String(tc?.entryProductName || '').trim());
  const isEntryOnly = Boolean(hasEntry && params.purchasePath === 'entry_only');

  const principalName = stripForbiddenAndEmojis(String(product?.nombre || 'Producto Exclusivo'));
  const principalImg = String(product?.imagen || product?.visualLanding?.sheets?.[0]?.imageUrl || '').trim();

  if (isEntryOnly) {
    const entryName = stripForbiddenAndEmojis(String(tc.entryProductName || principalName));
    const entryDesc = stripForbiddenAndEmojis(String(tc.entryProductDescription || entryName));
    const entryPrice = Math.max(5000, Number(params.overridePriceGs || tc.entryPriceGs || tc.entryProductPriceGs || 20000));
    const deliveryFee = Math.max(15000, Number(tc.deliveryFeeGs || tc.entryDeliveryFeeGs || 40000));
    const totalDoor = entryPrice + deliveryFee;
    const entryImg = String(tc.entryProductImage || tc.entryImageUrl || principalImg).trim();

    return {
      eyebrow: 'ESTE ES EL PAQUETE QUE ESTÁS ADQUIRIENDO',
      headlineLines: wrapLines(entryName, 26, 2),
      ownershipLines: wrapLines(`Estás a punto de adquirir 1 unidad de tu ${entryName}.`, 42, 2),
      descriptionLines: wrapLines(entryDesc, 44, 2),
      priceLabel: 'PRECIO QUE VAS A PAGAR POR EL PRODUCTO',
      priceText: formatGsText(entryPrice),
      deliveryBannerText: `DELIVERY AL RECIBIR: ${formatGsText(deliveryFee)}  ·  TOTAL EN PUERTA: ${formatGsText(totalDoor)}`,
      subFooterText: 'Pagás recién al recibir en mano · Garantía 7 días en todo Paraguay',
      primaryImageSrc: entryImg,
      isEntryOnly: true
    };
  }

  const unitPrice = Math.max(
    10000,
    Number(
      params.overridePriceGs ||
        product?.precios?.[pack] ||
        product?.precios?.[1] ||
        product?.precioNormal ||
        189000
    )
  );
  const entryGiftName = hasEntry ? stripForbiddenAndEmojis(String(tc.entryProductName || '')) : '';
  const entryGiftImg = hasEntry ? String(tc.entryProductImage || tc.entryImageUrl || '').trim() : '';

  const headlineFull = principalName;
  const qtyText = pack === 1 ? '1 unidad' : `${pack} unidades`;
  const ownershipStr = hasEntry
    ? `Estás adquiriendo ${qtyText} completo + ${entryGiftName} DE REGALO.`
    : `Estás adquiriendo ${qtyText} de tu ${principalName} completo listo para disfrutar.`;
  const descRaw = stripForbiddenAndEmojis(
    String(
      product?.landingContent?.heroSubheadline ||
        product?.descripcion ||
        'Calidad superior con entrega rápida puerta a puerta en todo Paraguay.'
    )
  );

  return {
    eyebrow: 'ESTE ES EL PAQUETE QUE ESTÁS ADQUIRIENDO',
    headlineLines: wrapLines(headlineFull, 29, 2),
    ownershipLines: wrapLines(ownershipStr, 44, 2),
    descriptionLines: wrapLines(descRaw, 44, 2),
    priceLabel: pack === 1 ? 'PRECIO TOTAL DEL PAQUETE' : `PRECIO ESPECIAL (${pack} UNIDADES)`,
    priceText: formatGsText(unitPrice),
    deliveryBannerText: hasEntry
      ? 'ENVÍO 100% GRATUITO A TU PUERTA  ·  REGALO INCLUIDO'
      : 'ENVÍO 100% GRATUITO A TODO PARAGUAY  ·  SIN COSTO ADICIONAL',
    subFooterText: 'Revisás tu paquete en mano antes de pagar · Garantía 7 días',
    primaryImageSrc: principalImg,
    ...(entryGiftImg && entryGiftImg !== principalImg ? { giftImageSrc: entryGiftImg } : {}),
    isEntryOnly: false
  };
}

async function loadImageBufferForBanner(rawSource?: string | null): Promise<Buffer | null> {
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
      const res = await fetch(src, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      return null;
    }
    const cleanRel = src.split('?')[0].replace(/^\/+/, '');
    const candidates = [
      path.resolve(process.cwd(), 'public', cleanRel),
      path.resolve(process.cwd(), cleanRel)
    ];
    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return fs.readFileSync(c);
      }
    }
  } catch {}
  return null;
}

async function buildRoundedSquarePhoto(imgBuf: Buffer, size: number, radius: number, borderHex: string): Promise<Buffer> {
  const resized = await sharp(imgBuf)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  const maskSvg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#ffffff"/>
    </svg>`
  );
  const borderSvg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="${size - 6}" height="${size - 6}" rx="${radius}" ry="${radius}" fill="none" stroke="${borderHex}" stroke-width="5"/>
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

export function getOrderFormBannerCacheKey(spec: OrderFormPackageCopySpec, productId: string): string {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify({ productId, spec }))
    .digest('hex')
    .slice(0, 16);
}

export async function renderOrderFormPackageBannerPng(params: {
  product: any;
  purchasePath: 'entry_only' | 'principal_bundle';
  pack?: number;
  overridePriceGs?: number;
  forceRegenerate?: boolean;
}): Promise<{ buffer: Buffer; publicUrl: string; spec: OrderFormPackageCopySpec }> {
  const spec = buildOrderFormPackageCopySpec(params);
  const prodId = String(params.product?.id || params.product?.slug || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
  const hash = getOrderFormBannerCacheKey(spec, prodId);
  const fileName = `pkg_${prodId}_${params.purchasePath}_x${params.pack || 1}_${hash}.png`;
  const publicUrl = `/assets/form-banners/${fileName}`;

  fs.mkdirSync(FORM_BANNERS_DIR, { recursive: true });
  const absPath = path.join(FORM_BANNERS_DIR, fileName);

  if (!params.forceRegenerate && fs.existsSync(absPath) && fs.statSync(absPath).size > 2048) {
    return { buffer: fs.readFileSync(absPath), publicUrl, spec };
  }

  const W = 1080;
  const H = 560;
  const accentHex = spec.isEntryOnly ? '#F5C451' : '#34D399';
  const bgStart = spec.isEntryOnly ? '#071426' : '#041C14';
  const bgEnd = spec.isEntryOnly ? '#0E2442' : '#0A3526';
  const deliveryBg = spec.isEntryOnly ? '#7C2D12' : '#065F46';
  const deliveryStroke = spec.isEntryOnly ? '#F59E0B' : '#34D399';

  const primaryRaw = await loadImageBufferForBanner(spec.primaryImageSrc);
  const giftRaw = spec.giftImageSrc ? await loadImageBufferForBanner(spec.giftImageSrc) : null;

  const photoSize = 336;
  const primaryRounded = primaryRaw
    ? await buildRoundedSquarePhoto(primaryRaw, photoSize, 28, '#D4AF37')
    : null;
  const giftRounded = giftRaw
    ? await buildRoundedSquarePhoto(giftRaw, 128, 22, '#34D399')
    : null;

  const headlineStartY = 122;
  const headlineSvg = spec.headlineLines
    .map((line, i) => {
      const y = headlineStartY + i * 42;
      return `<text x="424" y="${y}" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="34" font-weight="900" fill="#FFFFFF">${escapeXml(line)}</text>`;
    })
    .join('\n');

  const ownershipBaseY = headlineStartY + spec.headlineLines.length * 42 + 12;
  const ownershipSvg = spec.ownershipLines
    .map((line, i) => {
      const y = ownershipBaseY + i * 28;
      return `<text x="424" y="${y}" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="21" font-weight="700" fill="#FDE68A">${escapeXml(line)}</text>`;
    })
    .join('\n');

  const descBaseY = ownershipBaseY + spec.ownershipLines.length * 28 + 10;
  const descSvg = spec.descriptionLines
    .map((line, i) => {
      const y = descBaseY + i * 25;
      return `<text x="424" y="${y}" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="18.5" font-weight="600" fill="#D1FAE5" opacity="0.92">${escapeXml(line)}</text>`;
    })
    .join('\n');

  const svgOverlay = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bgStart}"/>
          <stop offset="100%" stop-color="${bgEnd}"/>
        </linearGradient>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#D4AF37"/>
          <stop offset="50%" stop-color="#FFE08A"/>
          <stop offset="100%" stop-color="#C89624"/>
        </linearGradient>
        <radialGradient id="photoGlow" cx="22%" cy="52%" r="36%">
          <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#D4AF37" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <!-- Card Base -->
      <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="34" fill="url(#cardBg)" stroke="url(#goldGrad)" stroke-width="6"/>
      <rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="26" fill="none" stroke="rgba(255,215,120,0.22)" stroke-width="1.5"/>
      <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="34" fill="url(#photoGlow)"/>

      <!-- Top VIP Eyebrow Ribbon -->
      <rect x="44" y="34" width="600" height="42" rx="14" fill="url(#goldGrad)"/>
      <text x="344" y="61" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="18.5" font-weight="900" letter-spacing="0.8" fill="#062319">${escapeXml(spec.eyebrow)}</text>

      <!-- VIP Guarantee Mini Tag Top-Right -->
      <rect x="668" y="34" width="368" height="42" rx="14" fill="rgba(255,255,255,0.08)" stroke="${accentHex}" stroke-width="2"/>
      <text x="852" y="61" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="17" font-weight="800" fill="${accentHex}">VERIFICADO · PAGO CONTRA ENTREGA</text>

      <!-- Fallback placeholder frame behind photo -->
      <rect x="48" y="112" width="${photoSize}" height="${photoSize}" rx="28" fill="#03130D" stroke="#D4AF37" stroke-width="3"/>

      <!-- Main Typography Right Column -->
      ${headlineSvg}
      ${ownershipSvg}
      ${descSvg}

      <!-- Price Plaque -->
      <rect x="424" y="348" width="612" height="94" rx="20" fill="rgba(0,0,0,0.38)" stroke="url(#goldGrad)" stroke-width="2.5"/>
      <text x="448" y="378" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="16" font-weight="800" letter-spacing="0.8" fill="#FDE68A">${escapeXml(spec.priceLabel)}</text>
      <text x="448" y="424" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="42" font-weight="900" fill="#FFD778">${escapeXml(spec.priceText)}</text>

      <!-- Delivery Highlight Pill Bar -->
      <rect x="48" y="472" width="988" height="48" rx="16" fill="${deliveryBg}" stroke="${deliveryStroke}" stroke-width="2.5"/>
      <text x="542" y="503" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="20.5" font-weight="900" letter-spacing="0.4" fill="#FFFFFF">${escapeXml(spec.deliveryBannerText)}</text>
    </svg>
  `;

  const composites: sharp.OverlayOptions[] = [];
  if (primaryRounded) {
    composites.push({ input: primaryRounded, left: 48, top: 112 });
  }
  if (giftRounded) {
    composites.push({ input: giftRounded, left: 268, top: 326 });
    const giftTagSvg = Buffer.from(
      `<svg width="136" height="32" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="136" height="32" rx="12" fill="#D4AF37" stroke="#062319" stroke-width="2.5"/>
        <text x="68" y="21" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="14" font-weight="900" fill="#062319">+ DE REGALO</text>
      </svg>`
    );
    composites.push({ input: giftTagSvg, left: 264, top: 432 });
  }

  const buffer = await sharp(Buffer.from(svgOverlay))
    .composite(composites)
    .png({ compressionLevel: 7 })
    .toBuffer();

  try {
    fs.writeFileSync(absPath, buffer);
  } catch {}

  return { buffer, publicUrl, spec };
}

export async function preRenderOrderFormBannersForProduct(product: any): Promise<void> {
  if (!product) return;
  try {
    const tasks: Array<Promise<any>> = [
      renderOrderFormPackageBannerPng({ product, purchasePath: 'principal_bundle', pack: 1 }),
      renderOrderFormPackageBannerPng({ product, purchasePath: 'principal_bundle', pack: 2 }),
      renderOrderFormPackageBannerPng({ product, purchasePath: 'principal_bundle', pack: 3 })
    ];
    if (product?.tripwireConfig?.enabled && product?.tripwireConfig?.entryProductName) {
      tasks.push(renderOrderFormPackageBannerPng({ product, purchasePath: 'entry_only', pack: 1 }));
    }
    await Promise.allSettled(tasks);
  } catch {}
}
