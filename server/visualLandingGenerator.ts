import fs from 'fs';
import path from 'path';
import type {
  ProductPage,
  ProductTripwireOfferConfig,
  ProductVisualLandingConfig,
  ProductVisualLandingSheet
} from '../src/types';
import { formatParaguayGs } from './metaCommentsEngine';
import { uploadImageToCloudinary } from './cloudinaryStore';

export const VISUAL_CREATOR_TEXT_MODEL = 'openai/gpt-4o';
export const VISUAL_CREATOR_IMAGE_MODEL = 'openai/gpt-image-2.6-sunburst';

const VISUAL_PAGES_DIR = path.resolve(process.cwd(), 'public', 'assets', 'visual-pages');

function ensureVisualPagesDir() {
  if (!fs.existsSync(VISUAL_PAGES_DIR)) {
    fs.mkdirSync(VISUAL_PAGES_DIR, { recursive: true });
  }
}

export function slugifyProductName(raw: string): string {
  return (
    String(raw || 'producto')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || `prod-${Date.now()}`
  );
}

export async function scrapeEntryProductUrlInfo(rawUrl: string): Promise<{
  ok: boolean;
  title?: string;
  description?: string;
  imageUrl?: string;
  error?: string;
}> {
  const cleanUrl = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    return { ok: false, error: 'Ingresá una URL válida que empiece con https:// o http://.' };
  }
  try {
    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) {
      return { ok: false, error: `No se pudo leer la página (${res.status}).` };
    }
    const html = await res.text();
    const pickMeta = (prop: string) => {
      const m =
        html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
      return m ? m[1].trim() : '';
    };
    const titleTag = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim();
    const title = pickMeta('og:title') || pickMeta('twitter:title') || titleTag;
    const description = pickMeta('og:description') || pickMeta('description') || pickMeta('twitter:description');
    let imageUrl = pickMeta('og:image') || pickMeta('twitter:image');
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      try {
        imageUrl = new URL(imageUrl, cleanUrl).toString();
      } catch {}
    }
    return { ok: true, title, description, imageUrl };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error leyendo URL del producto.' };
  }
}

export async function saveImageInputLocally(rawInput: string, prefix: string): Promise<string> {
  const src = String(rawInput || '').trim();
  if (!src) return '';
  ensureVisualPagesDir();

  if (src.startsWith('data:image/')) {
    const parts = src.split(',');
    if (parts.length === 2) {
      const ext = src.includes('image/png') ? 'png' : src.includes('image/webp') ? 'webp' : 'jpg';
      const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const abs = path.join(VISUAL_PAGES_DIR, fileName);
      fs.writeFileSync(abs, Buffer.from(parts[1], 'base64'));
      const localRel = `/assets/visual-pages/${fileName}`;
      try {
        const cloud = await uploadImageToCloudinary({
          source: abs,
          productSlug: prefix,
          tagList: ['visual-pages']
        });
        if (cloud.ok && cloud.secureUrl) return cloud.secureUrl;
      } catch {}
      return localRel;
    }
  }
  return src;
}

async function generateSingleVisualSheetImage(params: {
  openRouterApiKey: string;
  prompt: string;
  aspectRatio?: '3:4' | '2:3';
  filePrefix: string;
  referer?: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const f = params.fetchImpl || fetch;
  const maxAttempts = 6;
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await f('https://openrouter.ai/api/v1/images', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': params.referer || 'https://noelux.shop',
          'X-Title': 'Noelux Universal Visual Page Creator'
        },
        body: JSON.stringify({
          model: VISUAL_CREATOR_IMAGE_MODEL,
          prompt: params.prompt,
          aspect_ratio: params.aspectRatio || '3:4',
          quality: 'high',
          output_format: 'jpeg',
          n: 1
        }),
        signal: AbortSignal.timeout(95000)
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        const retryable = res.status === 429 || res.status === 402 || res.status >= 500;
        lastError = `OpenRouter Images HTTP ${res.status}: ${txt.slice(0, 220)}`;
        if (retryable && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        throw new Error(lastError);
      }

      const json: any = await res.json();
      let rawImgUrl = '';
      if (Array.isArray(json?.data) && json.data[0]) {
        if (json.data[0].b64_json) {
          rawImgUrl = `data:image/jpeg;base64,${json.data[0].b64_json}`;
        } else if (json.data[0].url) {
          rawImgUrl = String(json.data[0].url);
        }
      } else if (Array.isArray(json?.choices?.[0]?.message?.images)) {
        const first = json.choices[0].message.images[0];
        rawImgUrl = String(first?.image_url?.url || first?.url || '');
      }

      if (!rawImgUrl) {
        lastError = 'OpenRouter no devolvió imagen en la lámina.';
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        throw new Error(lastError);
      }

      ensureVisualPagesDir();
      if (rawImgUrl.startsWith('data:image/')) {
        const base64Part = rawImgUrl.split(',')[1] || '';
        const buf = Buffer.from(base64Part, 'base64');
        const ext = rawImgUrl.includes('png') ? 'png' : 'jpg';
        const fileName = `${params.filePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const absPath = path.join(VISUAL_PAGES_DIR, fileName);
        fs.writeFileSync(absPath, buf);
        try {
          const cloud = await uploadImageToCloudinary({
            source: absPath,
            productSlug: 'visual-pages',
            tagList: ['visual-pages']
          });
          if (cloud.ok && cloud.secureUrl) return cloud.secureUrl;
        } catch {}
        return `/assets/visual-pages/${fileName}`;
      }

      if (rawImgUrl.startsWith('http')) {
        try {
          const dl = await f(rawImgUrl, { signal: AbortSignal.timeout(12000) });
          if (dl.ok) {
            const buf = Buffer.from(await dl.arrayBuffer());
            const fileName = `${params.filePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
            const absPath = path.join(VISUAL_PAGES_DIR, fileName);
            fs.writeFileSync(absPath, buf);
            try {
              const cloud = await uploadImageToCloudinary({
                source: absPath,
                productSlug: 'visual-pages',
                tagList: ['visual-pages']
              });
              if (cloud.ok && cloud.secureUrl) return cloud.secureUrl;
            } catch {}
            return `/assets/visual-pages/${fileName}`;
          }
        } catch {}
        return rawImgUrl;
      }
    } catch (err: any) {
      lastError = err?.message || 'Error generando lámina gráfica.';
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw err;
    }
  }
  throw new Error(lastError || 'No se pudo generar la imagen de la página.');
}

export interface QuickCreateVisualProductInput {
  openRouterApiKey: string;
  pageCreationMode?: 'dual_tripwire_winner' | 'principal_only';
  productName: string;
  productDescription: string;
  winnerAngle?: string;
  price1Gs: number;
  price2Gs?: number;
  price3Gs?: number;
  normalPriceGs?: number;
  productImageInput?: string;
  entryProductName?: string;
  entryProductDescription?: string;
  entryPriceGs?: number;
  entryNormalPriceGs?: number;
  entryDeliveryFeeGs?: number;
  entryProductImageInput?: string;
  entrySourceUrl?: string;
  instantDiscountPercent?: number;
  eventDurationHours?: number;
  slotsTotal?: number;
  backgroundMusicPreset?: 'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none';
  sheetCount?: 2 | 3;
  waNumber?: string;
  referer?: string;
  fetchImpl?: typeof fetch;
}

export async function generateUniversalVisualProductPage(
  input: QuickCreateVisualProductInput
): Promise<{
  product: ProductPage;
  strategySummary: string;
}> {
  if (!String(input.openRouterApiKey || '').trim()) {
    throw new Error('Falta OPENROUTER_API_KEY real para generar la página gráfica y estrategia con IA.');
  }

  const f = input.fetchImpl || fetch;
  const pageCreationMode: 'dual_tripwire_winner' | 'principal_only' =
    input.pageCreationMode === 'principal_only' ? 'principal_only' : 'dual_tripwire_winner';
  const isPrincipalOnly = pageCreationMode === 'principal_only';
  const sheetCount: 2 | 3 = input.sheetCount === 3 ? 3 : 2;
  const price1 = Math.max(35000, Number(input.price1Gs) || 189000);
  const price2 = Number(input.price2Gs) || Math.round(price1 * 1.85);
  const price3 = Number(input.price3Gs) || Math.round(price1 * 2.65);
  const normalPrice = Number(input.normalPriceGs) || Math.round(price1 * 1.32);

  const safeEntryName = String(input.entryProductName || '').trim() || 'Artículo Complementario';
  const entryPrice = Math.max(5000, Number(input.entryPriceGs) || 20000);
  const entryNormal = Number(input.entryNormalPriceGs) || Math.round(entryPrice * 2.2);
  const deliveryFee = Math.max(15000, Number(input.entryDeliveryFeeGs) || 40000);
  const instantDiscountPct = Math.max(5, Math.min(40, Number(input.instantDiscountPercent) || 12));
  const eventDurationHours = Math.max(2, Math.min(12, Number(input.eventDurationHours) || 6));
  const slotsTotal = Math.max(5, Math.min(20, Number(input.slotsTotal) || 10));

  let resolvedEntryDesc = String(input.entryProductDescription || '').trim();
  let resolvedEntryImgInput = String(input.entryProductImageInput || '').trim();
  if (!isPrincipalOnly && input.entrySourceUrl && (!resolvedEntryDesc || !resolvedEntryImgInput)) {
    const scraped = await scrapeEntryProductUrlInfo(input.entrySourceUrl);
    if (scraped.ok) {
      if (!resolvedEntryDesc && scraped.description) resolvedEntryDesc = scraped.description;
      if (!resolvedEntryImgInput && scraped.imageUrl) resolvedEntryImgInput = scraped.imageUrl;
    }
  }

  const savedPrincipalImg = await saveImageInputLocally(input.productImageInput || '', 'prod_main');
  const savedEntryImg = isPrincipalOnly
    ? ''
    : await saveImageInputLocally(resolvedEntryImgInput, 'prod_entry');

  const cleanAngleInput = String(input.winnerAngle || '').trim();
  const promptSystemContent = isPrincipalOnly
    ? `Eres el Director de Producto y Psicología de Conversión Sobria en Paraguay.
Diseñas páginas gráficas verticales ultra-claras enfocadas 100% EN UN ÚNICO PRODUCTO PRINCIPAL (sin artículos secundarios ni ofertas de entrada paralelas).

REGLA INQUEBRANTABLE DE LENGUAJE:
- JAMÁS escribas la palabra "tripwire", "gancho trampa" ni menciones artículos secundarios inexistentes.
- Precios obligatorios en Guaraníes de Paraguay ("Gs.") jamás en dólares.
- Tono visual de los prompts para gpt-image-2.6-sunburst: diseño editorial comercial limpio de alto contraste en español paraguayo, composición tipo lámina de catálogo/app móvil vertical (3:4), fondo equilibrado, tipografía nítida en español sin texto cortado, cero stickers chillones.`
    : `Eres el Director de Producto y Psicología de Conversión Sobria en Paraguay.
Diseñas páginas gráficas verticales ultra-claras que NO gritan "¡cómprame!", sino que despiertan deseo inteligente mediante psicología inversa y congruencia real entre un producto de entrada accesible y el producto principal definitivo.

REGLA INQUEBRANTABLE DE LENGUAJE:
- JAMÁS escribas la palabra "tripwire", "gancho trampa" ni jerga de marketing en ningún texto ni prompt visual. Refiérete siempre al artículo de entrada por su nombre real: "${safeEntryName}".
- Precios obligatorios en Guaraníes de Paraguay ("Gs.") jamás en dólares.
- Tono visual de los prompts para gpt-image-2.6-sunburst: diseño editorial comercial limpio de alto contraste en español paraguayo, composición tipo lámina de catálogo/app móvil vertical (3:4), fondo equilibrado, tipografía nítida en español sin texto cortado, cero stickers chillones ni explosiones de ofertas falsas.`;

  const promptUserContent = isPrincipalOnly
    ? `PRODUCTO PRINCIPAL EXCLUSIVO (PÁGINA DIRECTA SIN ARTÍCULO SECUNDARIO):
- Nombre: ${input.productName}
- Enfoque / ángulo principal: ${cleanAngleInput || input.productDescription}
- Qué hace / descripción: ${input.productDescription}
- Precio Normal tachado: Gs. ${formatParaguayGs(normalPrice)}
- Precio 1x: Gs. ${formatParaguayGs(price1)} (Pack 2x: Gs. ${formatParaguayGs(price2)}, Pack 3x: Gs. ${formatParaguayGs(price3)})
- Envío Producto Principal: ENVÍO GRATIS en todo Paraguay + Pago en mano al recibir.

CANTIDAD DE LÁMINAS A DISEÑAR: ${sheetCount}

Devuelve EXCLUSIVAMENTE este JSON válido:
{
  "strategySummary": "Explicación breve interna del enfoque principal de venta directa.",
  "sobrietyHeadline": "Titular sobrio y elegante de alto impacto racional (máx 10 palabras).",
  "subheadline": "Bajada clara explicando qué resuelve en el hogar/vida del cliente en Paraguay (máx 22 palabras).",
  "winnerAngleHeadline": "Ángulo de valor clave del producto principal (máx 12 palabras).",
  "winnerAngleDescription": "Explicación clara y honesta de beneficios reales del producto principal (máx 32 palabras).",
  "bundleButtonLabel": "Pedir ${input.productName} — Envío Gratis (${formatParaguayGs(price1)})",
  "bundleDisclaimer": "Incluye ${input.productName} original + Envío GRATIS en Paraguay + Pago contra entrega en efectivo o QR.",
  "sheetPrompts": [
    {
      "role": "hero_presentation",
      "title": "Presentación del producto principal",
      "caption": "Pie corto sobrio",
      "imagePrompt": "Prompt detallado en inglés+español visible para openai/gpt-image-2.6-sunburst creando una lámina vertical editorial 3:4 limpia en español paraguayo mostrando el producto principal ${input.productName} (${cleanAngleInput || 'resultado superior en el hogar'}) en uso real, encabezado sobrio y badge discreto 'Envío Gratis · Pago al Recibir · Gs. ${formatParaguayGs(price1)}'."
    },
    {
      "role": "comparison_need",
      "title": "Beneficios y packs disponibles",
      "caption": "Comparativa clara de packs",
      "imagePrompt": "Prompt detallado en inglés+español visible para openai/gpt-image-2.6-sunburst creando la lámina 2 vertical editorial 3:4 limpia en español detallando beneficios clave de ${input.productName}, opciones 1 Unidad (Gs. ${formatParaguayGs(price1)}) y Pack 2x Ahorro (Gs. ${formatParaguayGs(price2)}) con Envío Gratis en Paraguay, diseño minimalista moderno."
    }${
      sheetCount === 3
        ? `,
    {
      "role": "social_trust_specs",
      "title": "Garantía y contenido real en caja",
      "caption": "Lo que recibís en tu puerta",
      "imagePrompt": "Prompt detallado en inglés+español visible para openai/gpt-image-2.6-sunburst creando la lámina 3 vertical editorial 3:4 limpia en español mostrando el contenido real de la caja de ${input.productName}, garantía escrita de 7 días y pago en efectivo o QR al repartidor en Paraguay."
    }`
        : ''
    }
  ],
  "faq": [
    { "q": "Pregunta clave 1 sobre uso o medidas de ${input.productName}", "a": "Respuesta transparente sin jerga" },
    { "q": "Pregunta clave 2 sobre Envío Gratis y pago al recibir", "a": "Respuesta clara Paraguay" },
    { "q": "Pregunta clave 3 sobre garantía y packs", "a": "Respuesta honesta en guaraníes" }
  ],
  "agentContext": "Resumen completo para el agente WhatsApp y de Comentarios con precios exactos en Gs. de ${input.productName} (1x, 2x, 3x), Envío Gratis en todo Paraguay y pago al recibir."
}`
    : `PRODUCTO GANADOR (OFERTA PRINCIPAL EN LA MISMA PÁGINA CON ÁNGULO DIFERENTE):
- Nombre: ${input.productName}
- Ángulo diferente del Producto Ganador en esta página: ${cleanAngleInput || `Solución definitiva completa superior al artículo de entrada (${input.productDescription})`}
- Qué hace / descripción: ${input.productDescription}
- Precio Normal tachado: Gs. ${formatParaguayGs(normalPrice)}
- Precio 1x: Gs. ${formatParaguayGs(price1)} (Pack 2x: Gs. ${formatParaguayGs(price2)}, Pack 3x: Gs. ${formatParaguayGs(price3)})
- Envío Producto Principal: ENVÍO GRATIS en todo Paraguay + Pago al recibir.

ARTÍCULO COMPLEMENTARIO DE ENTRADA (BLOQUE 1 DE LA MISMA PÁGINA):
- Nombre real: ${safeEntryName}
- Qué hace: ${resolvedEntryDesc || safeEntryName}
- Precio Normal comparativo: Gs. ${formatParaguayGs(entryNormal)}
- Precio Promo Entrada: Gs. ${formatParaguayGs(entryPrice)} + Delivery según zona (Gs. ${formatParaguayGs(deliveryFee)} aprox.)
- REGLA TRANSPARENTE: Si lleva el Producto Principal (${input.productName}), este complemento "${safeEntryName}" le va TOTALMENTE DE REGALO + ENVÍO GRATIS directo a su puerta.

CANTIDAD DE LÁMINAS A DISEÑAR: ${sheetCount}

Devuelve EXCLUSIVAMENTE este JSON válido:
{
  "strategySummary": "Explicación breve interna de la congruencia psicológica usada.",
  "sobrietyHeadline": "Titular sobrio y elegante que NO ruega compra (máx 10 palabras).",
  "subheadline": "Bajada clara explicando qué cambia en la casa/vida del cliente en Paraguay (máx 22 palabras).",
  "winnerAngleHeadline": "Titular del ángulo diferente con el que se presenta el Producto Ganador en esta misma página (máx 12 palabras).",
  "winnerAngleDescription": "Explicación persuasiva y sobria del ángulo diferente por el cual el Producto Ganador resuelve el problema completo mejor que el artículo individual (máx 32 palabras).",
  "reversePsychologyHook": "Frase de psicología inversa elegante donde el cliente nota que comprar el complemento suelto con envío le sale casi igual que asegurar el sistema completo con todo gratis.",
  "entryButtonLabel": "Elegir solo ${safeEntryName} (Gs. ${formatParaguayGs(entryPrice)})",
  "entryDisclaimer": "Solo incluye 1x ${safeEntryName}. NO incluye ${input.productName}. Se suma delivery de zona (Gs. ${formatParaguayGs(deliveryFee)}).",
  "bundleButtonLabel": "Llevar ${input.productName} + ${safeEntryName} GRATIS (Gs. ${formatParaguayGs(price1)})",
  "bundleDisclaimer": "Incluye ${input.productName} completo + ${safeEntryName} DE REGALO + Envío GRATIS sin lista de espera.",
  "sheetPrompts": [
    {
      "role": "hero_presentation",
      "title": "Presentación del sistema completo",
      "caption": "Pie corto sobrio",
      "imagePrompt": "Prompt detallado en inglés+español visible para openai/gpt-image-2.6-sunburst creando una lámina vertical editorial 3:4 limpia en español paraguayo mostrando el producto principal ${input.productName} (${cleanAngleInput || 'ángulo de solución definitiva'}) en uso real en un hogar moderno paraguayo, encabezado limpio con el titular y badge discreto 'Pago al Recibir · Paraguay · Gs. ${formatParaguayGs(price1)}'."
    },
    {
      "role": "comparison_need",
      "title": "Por qué se complementan",
      "caption": "Comparación racional y visual",
      "imagePrompt": "Prompt detallado en inglés+español visible para openai/gpt-image-2.6-sunburst creando la lámina 2 vertical editorial 3:4 limpia en español comparando lado a lado: Opción A solo '${safeEntryName}' (Gs. ${formatParaguayGs(entryPrice)} + Delivery) vs Opción B completa '${input.productName}' (ángulo: ${cleanAngleInput || 'resultado completo en segundos'}) con '${safeEntryName}' INCLUIDO GRATIS + Envío Gratis, diseño sobrio sin stickers ruidosos."
    }${
      sheetCount === 3
        ? `,
    {
      "role": "social_trust_specs",
      "title": "Garantía y contenido real en caja",
      "caption": "Lo que recibís en tu puerta",
      "imagePrompt": "Prompt detallado en inglés+español visible para openai/gpt-image-2.6-sunburst creando la lámina 3 vertical editorial 3:4 limpia en español mostrando el contenido real de la caja, garantía escrita de 7 días y pago en efectivo o QR al repartidor en Paraguay."
    }`
        : ''
    }
  ],
  "faq": [
    { "q": "Pregunta clave 1 sobre qué incluye cada opción", "a": "Respuesta transparente en guaraníes sin jerga" },
    { "q": "Pregunta clave 2 sobre el pago al recibir y entrega", "a": "Respuesta clara Paraguay" },
    { "q": "Pregunta clave 3 sobre garantía y uso real", "a": "Respuesta honesta" }
  ],
  "agentContext": "Resumen completo para el agente WhatsApp y de Comentarios con precios exactos en Gs., qué incluye la caja y la regla de las dos opciones (sin decir nunca tripwire)."
}`;

  // 1. Cerebro OpenRouter GPT-4o: Arquitectura psicológica sobria + prompts de láminas gráficas
  const llmRes = await f('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.openRouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': input.referer || 'https://noelux.shop',
      'X-Title': 'Noelux Universal Page Blueprint AI'
    },
    body: JSON.stringify({
      model: VISUAL_CREATOR_TEXT_MODEL,
      temperature: 0.45,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: promptSystemContent },
        { role: 'user', content: promptUserContent }
      ]
    }),
    signal: AbortSignal.timeout(45000)
  });

  if (!llmRes.ok) {
    const errText = await llmRes.text().catch(() => '');
    throw new Error(`OpenRouter GPT-4o falló (${llmRes.status}): ${errText.slice(0, 220)}`);
  }

  const llmJson: any = await llmRes.json();
  const rawContent = String(llmJson?.choices?.[0]?.message?.content || '').trim();
  const parsed = JSON.parse(rawContent);
  const rawSheets: any[] = Array.isArray(parsed?.sheetPrompts) ? parsed.sheetPrompts : [];
  if (rawSheets.length < 2) {
    throw new Error('OpenRouter GPT-4o no devolvió las láminas gráficas completas.');
  }

  // 2. Generar las 2 o 3 imágenes verticales reales en paralelo/turno con openai/gpt-image-2.6-sunburst
  const generatedSheets: ProductVisualLandingSheet[] = [];
  for (let i = 0; i < Math.min(sheetCount, rawSheets.length); i++) {
    const s = rawSheets[i];
    const extraVisualContext = [
      String(s.imagePrompt || ''),
      savedPrincipalImg && !savedPrincipalImg.startsWith('/') ? `Reference product style: ${input.productName}.` : '',
      'Ultra sharp typography in Spanish, NO English typos, clean modern e-commerce graphic sheet layout filling the entire 3:4 canvas edge-to-edge.'
    ]
      .filter(Boolean)
      .join(' ');

    const imgUrl = await generateSingleVisualSheetImage({
      openRouterApiKey: input.openRouterApiKey,
      prompt: extraVisualContext,
      aspectRatio: '3:4',
      filePrefix: `vis_${slugifyProductName(input.productName).slice(0, 18)}_s${i + 1}`,
      referer: input.referer,
      fetchImpl: f
    });

    generatedSheets.push({
      id: `sheet_${i + 1}`,
      role: (s.role as any) || (i === 0 ? 'hero_presentation' : i === 1 ? 'comparison_need' : 'social_trust_specs'),
      imageUrl: imgUrl,
      title: String(s.title || `Lámina ${i + 1}`).trim(),
      caption: String(s.caption || '').trim(),
      promptUsed: String(s.imagePrompt || '').trim()
    });
  }

  const prodId = `prod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const prodSlug = `${slugifyProductName(input.productName)}-${Math.random().toString(36).slice(2, 5)}`;

  const cleanPublicText = (raw: string) =>
    String(raw || '')
      .replace(/\btripwire\b/gi, isPrincipalOnly ? input.productName.trim() : safeEntryName)
      .trim();

  const resolvedEntryImage = isPrincipalOnly
    ? ''
    : savedEntryImg || generatedSheets[1]?.imageUrl || generatedSheets[0]?.imageUrl || '';

  const tripwireConfig: ProductTripwireOfferConfig | undefined = isPrincipalOnly
    ? undefined
    : {
        enabled: true,
        entryProductName: cleanPublicText(safeEntryName),
        entryProductDescription: cleanPublicText(resolvedEntryDesc || safeEntryName),
        entryProductImage: resolvedEntryImage,
        entryImageUrl: resolvedEntryImage,
        entryPriceGs: entryPrice,
        entryNormalPriceGs: entryNormal,
        deliveryFeeGs: deliveryFee,
        instantDiscountPercent: instantDiscountPct,
        eventDurationHours,
        slotsTotal,
        backgroundMusicPreset: input.backgroundMusicPreset || 'warm_ambient',
        sourceUrl: input.entrySourceUrl?.trim() || undefined,
        entryOnlyClarification: `Incluye únicamente 1x ${cleanPublicText(safeEntryName)}. No incluye ${input.productName.trim()} ni envío gratis por separado.`,
        principalBundleClarification: `Incluye ${input.productName.trim()} + ${cleanPublicText(safeEntryName)} DE REGALO + Envío Gratis sin esperar evento.`
      };

  const resolvedWinnerAngle = cleanPublicText(
    cleanAngleInput ||
      String(parsed?.winnerAngleHeadline || '').trim() ||
      `Solución completa superior para ${input.productName.trim()}`
  );

  const visualLanding: ProductVisualLandingConfig = {
    enabled: true,
    mode: sheetCount === 3 ? 'sober_graphic_3sheet' : 'sober_graphic_2sheet',
    generatorModel: VISUAL_CREATOR_IMAGE_MODEL,
    sheets: generatedSheets,
    sobrietyHeadline: cleanPublicText(parsed?.sobrietyHeadline || input.productName),
    subheadline: cleanPublicText(parsed?.subheadline || input.productDescription),
    winnerAngleHeadline: cleanPublicText(parsed?.winnerAngleHeadline || resolvedWinnerAngle),
    winnerAngleDescription: cleanPublicText(parsed?.winnerAngleDescription || input.productDescription),
    reversePsychologyHook: isPrincipalOnly ? '' : cleanPublicText(parsed?.reversePsychologyHook || ''),
    entryButtonLabel: isPrincipalOnly
      ? undefined
      : cleanPublicText(parsed?.entryButtonLabel || `Pedir solo ${safeEntryName} (${formatParaguayGs(entryPrice)})`),
    entryDisclaimer: isPrincipalOnly
      ? undefined
      : cleanPublicText(
          parsed?.entryDisclaimer ||
            `Atención: esta opción envía únicamente 1x ${safeEntryName}. No incluye ${input.productName}. Delivery de zona: Gs. ${formatParaguayGs(deliveryFee)}.`
        ),
    bundleButtonLabel: cleanPublicText(
      parsed?.bundleButtonLabel ||
        (isPrincipalOnly
          ? `Pedir ${input.productName} — Envío Gratis (${formatParaguayGs(price1)})`
          : `Pedir ${input.productName} + ${safeEntryName} DE REGALO (${formatParaguayGs(price1)})`)
    ),
    bundleDisclaimer: cleanPublicText(
      parsed?.bundleDisclaimer ||
        (isPrincipalOnly
          ? `Pedido directo garantizado: incluye ${input.productName} completo + Envío GRATIS + Pago al recibir.`
          : `Pedido directo asegurado: incluye ${input.productName} completo + ${safeEntryName} GRATIS + Envío GRATIS sin lista de espera.`)
    ),
    generatedAt: new Date().toISOString()
  };

  const faqs = Array.isArray(parsed?.faq) ? parsed.faq.slice(0, 4) : [];

  const product: ProductPage = {
    id: prodId,
    nombre: input.productName.trim(),
    descripcion: input.productDescription.trim(),
    imagen: savedPrincipalImg || generatedSheets[0]?.imageUrl || '',
    slug: prodSlug,
    precioNormal: normalPrice,
    precios: { 1: price1, 2: price2, 3: price3 },
    wa: String(input.waNumber || '595973532550').trim(),
    activo: true,
    freeShipping: true,
    creadoEn: new Date().toISOString(),
    winnerAngle: resolvedWinnerAngle,
    ...(tripwireConfig ? { tripwireConfig } : {}),
    visualLanding,
    contextoIA: cleanPublicText(String(parsed?.agentContext || '')) || undefined,
    landingContent: {
      brandTitle: input.productName.trim().split(/\s+/).slice(0, 2).join(' '),
      topBarBadge: 'PAGO AL RECIBIR',
      topBarText: `ENVÍO GRATIS EN ${input.productName.toUpperCase()}`,
      heroBadge: 'Calidad Garantizada · Paraguay',
      heroHeadline: visualLanding.sobrietyHeadline,
      heroSubheadline: visualLanding.subheadline,
      heroBullets: isPrincipalOnly
        ? [
            `${input.productName} garantizado con entrega puerta a puerta`,
            'Envío Gratis en todo Paraguay con seguimiento real',
            'Pagás en efectivo o QR recién al recibir en tus manos'
          ]
        : [
            `${input.productName} garantizado con entrega puerta a puerta`,
            `Incluye ${safeEntryName} de regalo llevando el equipo completo`,
            'Pagás en efectivo o QR recién al recibir en tus manos'
          ],
      galleryItems: [
        {
          src: savedPrincipalImg || generatedSheets[0].imageUrl,
          alt: input.productName,
          label: input.productName,
          tag: 'Principal'
        },
        ...generatedSheets.map((sh, i) => ({
          src: sh.imageUrl,
          alt: sh.title,
          label: sh.title,
          tag: `Lámina ${i + 1}`
        }))
      ],
      benefitSectionBadge: isPrincipalOnly ? 'Beneficios Clave' : 'Comparación Clara',
      benefitSectionTitle: visualLanding.sobrietyHeadline,
      benefitSectionSubtitle: isPrincipalOnly ? visualLanding.subheadline : visualLanding.reversePsychologyHook,
      benefitCards: [],
      testimonialsBadge: 'Clientes Verificados',
      testimonialsTitle: `Experiencias reales con ${input.productName}`,
      testimonialsSubtitle: 'Entregas en Asunción, Central y todo el interior',
      testimonials: [],
      faqs: faqs.map((x: any) => ({ q: String(x.q || ''), a: String(x.a || '') })),
      packLabels: {
        1: isPrincipalOnly
          ? { title: `${input.productName}`, subtitle: 'Envío Gratis incluido', tag: 'Opción Directa' }
          : { title: `${input.productName} + ${safeEntryName} GRATIS`, subtitle: 'Envío Gratis incluido', tag: 'Opción Completa' },
        2: { title: `Pack 2x ${input.productName}`, subtitle: 'Ideal hogar + regalo', tag: 'Ahorro 2x' },
        3: { title: `Pack 3x ${input.productName}`, subtitle: 'Máximo descuento familiar', tag: 'Pack 3x' }
      }
    }
  };

  return {
    product,
    strategySummary: cleanPublicText(String(parsed?.strategySummary || ''))
  };
}

