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
  deliveryBannerLine2?: string;
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
      headlineLines: wrapLines(entryName, 25, 2),
      ownershipLines: wrapLines(`Estás a punto de adquirir 1 unidad de tu ${entryName}.`, 38, 3),
      descriptionLines: wrapLines(entryDesc, 42, 2),
      priceLabel: 'PRECIO DEL PRODUCTO',
      priceText: formatGsText(entryPrice),
      deliveryBannerText: `COSTO DE DELIVERY: ${formatGsText(deliveryFee)}`,
      deliveryBannerLine2: `TOTAL AL RECIBIR EN PUERTA: ${formatGsText(totalDoor)}`,
      subFooterText: 'Pagás recién al recibir en mano · Garantía 7 días',
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
    headlineLines: wrapLines(headlineFull, 25, 2),
    ownershipLines: wrapLines(ownershipStr, 38, 3),
    descriptionLines: wrapLines(descRaw, 42, 2),
    priceLabel: pack === 1 ? 'PRECIO TOTAL DEL PAQUETE' : `PRECIO ESPECIAL (${pack} UNIDADES)`,
    priceText: formatGsText(unitPrice),
    deliveryBannerText: 'ENVÍO 100% GRATUITO A TU PUERTA',
    deliveryBannerLine2: hasEntry
      ? 'INCLUYE ARTÍCULO DE REGALO · SIN COSTO DE DELIVERY'
      : 'SIN COSTO ADICIONAL EN TODO PARAGUAY',
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

async function buildCleanRoundedPhoto(imgBuf: Buffer, size: number, radius: number): Promise<Buffer> {
  const resized = await sharp(imgBuf)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  const maskSvg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#ffffff"/>
    </svg>`
  );

  return sharp(resized)
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

export function getOrderFormBannerCacheKey(spec: OrderFormPackageCopySpec, productId: string): string {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify({ v: 'v3_neutral_large', productId, spec }))
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

  // Tall mobile-first borderless neutral-white canvas so fonts scale large & crystal-clear for glasses readers
  const W = 900;
  const H = 1040;
  const photoSize = 330;
  const photoLeft = Math.round((W - photoSize) / 2);
  const photoTop = 94;

  const primaryRaw = await loadImageBufferForBanner(spec.primaryImageSrc);
  const giftRaw = spec.giftImageSrc ? await loadImageBufferForBanner(spec.giftImageSrc) : null;

  const primaryRounded = primaryRaw
    ? await buildCleanRoundedPhoto(primaryRaw, photoSize, 28)
    : null;
  const giftRounded = giftRaw
    ? await buildCleanRoundedPhoto(giftRaw, 124, 22)
    : null;

  let cursorY = 478;
  const headlineSvg = spec.headlineLines
    .map((line) => {
      const el = `<text x="${W / 2}" y="${cursorY}" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="46" font-weight="900" fill="#0F172A">${escapeXml(line)}</text>`;
      cursorY += 54;
      return el;
    })
    .join('\n');

  cursorY += 8;
  const ownershipSvg = spec.ownershipLines
    .map((line) => {
      const el = `<text x="${W / 2}" y="${cursorY}" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="33" font-weight="800" fill="#1E293B">${escapeXml(line)}</text>`;
      cursorY += 42;
      return el;
    })
    .join('\n');

  cursorY += 6;
  const descSvg = spec.descriptionLines
    .map((line) => {
      const el = `<text x="${W / 2}" y="${cursorY}" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="28" font-weight="600" fill="#475569">${escapeXml(line)}</text>`;
      cursorY += 36;
      return el;
    })
    .join('\n');

  const priceBoxY = Math.max(722, cursorY + 14);
  const deliveryBoxY = priceBoxY + 132;
  const finalH = Math.max(H, deliveryBoxY + 122);

  const svgOverlay = `
    <svg width="${W}" height="${finalH}" xmlns="http://www.w3.org/2000/svg">
      <!-- Seamless pure neutral white canvas (zero borders anywhere) -->
      <rect x="0" y="0" width="${W}" height="${finalH}" fill="#FFFFFF"/>

      <!-- Subtle soft neutral eyebrow pill -->
      <rect x="70" y="22" width="${W - 140}" height="50" rx="25" fill="#F1F5F9"/>
      <text x="${W / 2}" y="55" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="25" font-weight="900" letter-spacing="0.8" fill="#0F172A">${escapeXml(spec.eyebrow)}</text>

      <!-- Borderless clean soft backing for product photo -->
      <rect x="${photoLeft}" y="${photoTop}" width="${photoSize}" height="${photoSize}" rx="28" fill="#F8FAFC"/>

      <!-- Large crystal-clear centered typography -->
      ${headlineSvg}
      ${ownershipSvg}
      ${descSvg}

      <!-- Clean neutral price strip (zero borders) -->
      <rect x="40" y="${priceBoxY}" width="${W - 80}" height="114" rx="24" fill="#F8FAFC"/>
      <text x="${W / 2}" y="${priceBoxY + 38}" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="24" font-weight="800" letter-spacing="0.8" fill="#475569">${escapeXml(spec.priceLabel)}</text>
      <text x="${W / 2}" y="${priceBoxY + 96}" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="60" font-weight="900" fill="#0F172A">${escapeXml(spec.priceText)}</text>

      <!-- Clean high-contrast dark slate delivery bar (zero borders) -->
      <rect x="40" y="${deliveryBoxY}" width="${W - 80}" height="104" rx="24" fill="#0F172A"/>
      <text x="${W / 2}" y="${deliveryBoxY + 45}" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="30" font-weight="900" fill="#FFFFFF">${escapeXml(spec.deliveryBannerText)}</text>
      <text x="${W / 2}" y="${deliveryBoxY + 84}" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="25" font-weight="700" fill="#E2E8F0">${escapeXml(spec.deliveryBannerLine2 || spec.subFooterText)}</text>
    </svg>
  `;

  const composites: sharp.OverlayOptions[] = [];
  if (primaryRounded) {
    composites.push({ input: primaryRounded, left: photoLeft, top: photoTop });
  }
  if (giftRounded) {
    const giftLeft = photoLeft + photoSize - 68;
    const giftTop = photoTop + photoSize - 118;
    const whiteHalo = Buffer.from(
      `<svg width="136" height="136" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="136" height="136" rx="26" fill="#FFFFFF"/>
      </svg>`
    );
    composites.push({ input: whiteHalo, left: giftLeft - 6, top: giftTop - 6 });
    composites.push({ input: giftRounded, left: giftLeft, top: giftTop });
    const giftTagSvg = Buffer.from(
      `<svg width="144" height="36" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="144" height="36" rx="18" fill="#0F172A"/>
        <text x="72" y="24" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="16" font-weight="900" fill="#FFFFFF">+ DE REGALO</text>
      </svg>`
    );
    composites.push({ input: giftTagSvg, left: giftLeft - 10, top: giftTop + 104 });
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

export async function renderOrderFormStepGuidePng(params: {
  stepNumber: 1 | 2 | 3;
  eyebrow: string;
  headline: string;
  subline: string;
  outputAbsPath: string;
}): Promise<Buffer> {
  const W = 900;
  const H = 205;
  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <!-- Pure seamless white canvas with ZERO rectangle border -->
      <rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>

      <!-- Left soft slate circle number badge -->
      <circle cx="56" cy="74" r="36" fill="#0F172A"/>
      <text x="56" y="88" text-anchor="middle" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="40" font-weight="900" fill="#FFFFFF">${params.stepNumber}</text>

      <!-- Eyebrow + Big Readable Headline & Description -->
      <text x="114" y="42" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="22" font-weight="900" letter-spacing="0.8" fill="#475569">${escapeXml(params.eyebrow)}</text>
      <text x="114" y="90" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="42" font-weight="900" fill="#0F172A">${escapeXml(params.headline)}</text>
      <text x="114" y="130" font-family="Noto Sans, Liberation Sans, DejaVu Sans, sans-serif" font-size="27" font-weight="700" fill="#334155">${escapeXml(params.subline)}</text>

      <!-- Crisp downward pointer arrow directing cleanly to input below -->
      <line x1="${W / 2}" y1="146" x2="${W / 2}" y2="184" stroke="#0F172A" stroke-width="6" stroke-linecap="round"/>
      <polygon points="${W / 2 - 14},174 ${W / 2 + 14},174 ${W / 2},198" fill="#0F172A"/>
    </svg>
  `;

  const buf = await sharp(Buffer.from(svg)).png({ compressionLevel: 7 }).toBuffer();
  fs.mkdirSync(path.dirname(params.outputAbsPath), { recursive: true });
  fs.writeFileSync(params.outputAbsPath, buf);
  return buf;
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
