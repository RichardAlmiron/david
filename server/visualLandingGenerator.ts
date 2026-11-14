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
import { preRenderOrderFormBannersForProduct } from './orderFormBannerRenderer';

export const VISUAL_CREATOR_TEXT_MODEL = 'openai/gpt-4o';
export const VISUAL_CREATOR_IMAGE_MODEL = 'openai/gpt-image-2.6-sunburst';
export const ENTRY_BUTTON_COLOR_NAME = 'VERDE Y DORADO';
export const BUNDLE_BUTTON_COLOR_NAME = 'VERDE Y DORADO';
export const STANDARD_BUTTON_COLOR_NAME = 'VERDE Y DORADO';
export const CTA_IMAGE_BUTTON_LABEL = '¡PEDIR AHORA!';

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

export async function scrapeEntryProductUrlInfo(
  rawUrl: string,
  fetchImpl?: typeof fetch
): Promise<{
  ok: boolean;
  title?: string;
  description?: string;
  imageUrl?: string;
  specsText?: string;
  imageCandidates?: string[];
  jsonLdInfo?: string;
  error?: string;
}> {
  const cleanUrl = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    return { ok: false, error: 'Ingresá una URL válida que empiece con https:// o http://.' };
  }
  const f = fetchImpl || fetch;
  try {
    const res = await f(cleanUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) {
      return { ok: false, error: `No se pudo leer la página (${res.status}).` };
    }
    const html = await res.text();
    const decodeBasicEntities = (s: string) =>
      s
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const pickMeta = (prop: string) => {
      const m =
        html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
      return m ? decodeBasicEntities(m[1]) : '';
    };

    const resolveAbsUrl = (candidate: string) => {
      const raw = String(candidate || '').trim();
      if (!raw || raw.startsWith('data:')) return '';
      if (/^https?:\/\//i.test(raw)) return raw;
      try {
        return new URL(raw, cleanUrl).toString();
      } catch {
        return '';
      }
    };

    const titleTag = decodeBasicEntities(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '');
    const h1Text = decodeBasicEntities(
      (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '').replace(/<[^>]+>/g, ' ')
    );
    const title = pickMeta('og:title') || pickMeta('twitter:title') || h1Text || titleTag;
    const description =
      pickMeta('og:description') || pickMeta('description') || pickMeta('twitter:description');

    // JSON-LD structured product extraction
    const jsonLdChunks: string[] = [];
    const candidateImagesSet = new Set<string>();
    const addImgCandidate = (u: string) => {
      const abs = resolveAbsUrl(u);
      if (abs && !/sprite|icon|logo|favicon|pixel|1x1|blank/i.test(abs)) {
        candidateImagesSet.add(abs);
      }
    };

    const ogImg = pickMeta('og:image');
    const twImg = pickMeta('twitter:image');
    if (ogImg) addImgCandidate(ogImg);
    if (twImg) addImgCandidate(twImg);

    const ldMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const m of ldMatches) {
      try {
        const parsed = JSON.parse(String(m[1] || '').trim());
        const nodes = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.['@graph'])
            ? parsed['@graph']
            : [parsed];
        for (const node of nodes) {
          if (!node || typeof node !== 'object') continue;
          const t = String(node['@type'] || '').toLowerCase();
          if (t.includes('product') || node.name || node.description) {
            const parts: string[] = [];
            if (node.name) parts.push(`Nombre LD: ${String(node.name).trim()}`);
            if (node.brand?.name) parts.push(`Marca: ${String(node.brand.name).trim()}`);
            if (node.description) parts.push(`Desc LD: ${String(node.description).trim().slice(0, 600)}`);
            if (parts.length > 0) jsonLdChunks.push(parts.join(' | '));
            const imgs = Array.isArray(node.image) ? node.image : node.image ? [node.image] : [];
            for (const im of imgs) {
              if (typeof im === 'string') addImgCandidate(im);
              else if (im?.url) addImgCandidate(String(im.url));
            }
          }
        }
      } catch {}
    }

    const imgTagMatches = html.matchAll(/<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi);
    let imgCount = 0;
    for (const m of imgTagMatches) {
      if (imgCount >= 8) break;
      addImgCandidate(m[1]);
      imgCount++;
    }

    // Clean body text for specs & features (never raw HTML tags)
    const strippedBody = decodeBasicEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
        .replace(/<header[\s\S]*?<\/header>/gi, ' ')
        .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<(?:br|p|li|h1|h2|h3|h4|tr|div)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
    )
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 18)
      .slice(0, 45)
      .join(' | ')
      .slice(0, 3200);

    const imageCandidates = Array.from(candidateImagesSet);
    const imageUrl = imageCandidates[0] || resolveAbsUrl(ogImg || twImg);

    return {
      ok: true,
      title,
      description,
      imageUrl,
      specsText: strippedBody || undefined,
      imageCandidates,
      jsonLdInfo: jsonLdChunks.join('\n').slice(0, 1200) || undefined
    };
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

export interface DeepProductResearchInput {
  openRouterApiKey: string;
  url?: string;
  productName?: string;
  rawDescription?: string;
  referenceImageInput?: string;
  role?: 'entry_hook' | 'principal';
  referer?: string;
  fetchImpl?: typeof fetch;
}

export interface DeepProductResearchResult {
  ok: boolean;
  researchedName: string;
  researchedDescription: string;
  verifiedSpecs: string[];
  usageSummary: string;
  exactVisualBlueprint: string;
  discoveredReferenceImageUrl?: string;
  scrapedTitle?: string;
  scrapedDescription?: string;
  scrapedImageUrl?: string;
  usedWebSearch: boolean;
  error?: string;
}

function resolveVisionSafeImageUrl(raw: string): string {
  const src = String(raw || '').trim();
  if (!src) return '';
  if (src.startsWith('data:image/')) return src;
  if (/^https?:\/\//i.test(src) && !src.includes('localhost') && !src.includes('127.0.0.1')) {
    return src;
  }
  if (src.startsWith('/assets/')) {
    try {
      const abs = path.resolve(process.cwd(), 'public', src.replace(/^\//, ''));
      if (fs.existsSync(abs)) {
        const ext = abs.toLowerCase().endsWith('.png')
          ? 'image/png'
          : abs.toLowerCase().endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg';
        const b64 = fs.readFileSync(abs).toString('base64');
        return `data:${ext};base64,${b64}`;
      }
    } catch {}
  }
  return '';
}

export async function researchProductDeeplyWithAI(
  input: DeepProductResearchInput
): Promise<DeepProductResearchResult> {
  const cleanUrl = String(input.url || '').trim();
  const rawName = String(input.productName || '').trim();
  const rawDesc = String(input.rawDescription || '').trim();
  const hasUrl = /^https?:\/\//i.test(cleanUrl);

  if (!hasUrl && !rawName && !rawDesc) {
    return {
      ok: false,
      researchedName: '',
      researchedDescription: '',
      verifiedSpecs: [],
      usageSummary: '',
      exactVisualBlueprint: '',
      usedWebSearch: false,
      error: 'Ingresá al menos el link del producto, el nombre o una nota inicial para investigar.'
    };
  }

  const f = input.fetchImpl || fetch;
  const scraped = hasUrl ? await scrapeEntryProductUrlInfo(cleanUrl, f) : null;

  const fallbackName = rawName || scraped?.title || 'Producto';
  const fallbackDesc = scraped?.description || rawDesc || fallbackName;
  const scrapedImg = scraped?.imageUrl || '';

  if (!String(input.openRouterApiKey || '').trim()) {
    return {
      ok: Boolean(scraped?.ok || rawName || rawDesc),
      researchedName: fallbackName,
      researchedDescription: fallbackDesc,
      verifiedSpecs: [],
      usageSummary: fallbackDesc,
      exactVisualBlueprint: `Clean studio product photograph of ${fallbackName}, 3/4 commercial angle`,
      discoveredReferenceImageUrl: scrapedImg || undefined,
      scrapedTitle: scraped?.title,
      scrapedDescription: scraped?.description,
      scrapedImageUrl: scrapedImg || undefined,
      usedWebSearch: false
    };
  }

  const refImageCandidate = String(input.referenceImageInput || '').trim() || scrapedImg;
  const visionImageUrl = resolveVisionSafeImageUrl(refImageCandidate);

  const researchSystemPrompt = `Eres el Cerebro de Investigación Real de Productos E-commerce y Director Visual Senior.
TU MISIÓN CRÍTICA:
1. REGLA ANTI COPIA-PEGA: JAMÁS copies y pegues textualmente el texto en crudo que escribió o pegó el usuario o el proveedor chino/mayorista. Úsalo únicamente como pista inicial.
2. INVESTIGACIÓN REAL: Investigá online (usando búsqueda web si está disponible, el link si fue provisto, y tu conocimiento técnico verificado por nombre exacto del producto) para descubrir qué producto físico es exactamente, cómo funciona, sus materiales reales, dimensiones/capacidades típicas, beneficios verdaderos y ventajas competitivas reales.
3. REDACCIÓN COMERCIAL PROPIA: Redactá un nombre comercial limpio en español paraguayo sobrio ("researchedName", sin códigos SKU ni relleno spam) y una ficha comercial sintetizada y persuasiva desde cero ("researchedDescription", 25-48 palabras claras con lo que incluye y resuelve sin rogar compra ni usar estrellitas).
4. INGENIERÍA VISUAL EXACTA ("exactVisualBlueprint" en INGLÉS): Analizá la foto de referencia (si fue adjuntada) y/o el diseño físico real del producto investigado en la web, y describí con precisión quirúrgica ESA MISMA PIEZA FÍSICA (silueta exacta, número de piezas/cabezales/cables, materiales reales, acabado, colores exactos, botones/pantallas, proporciones), indicando un ángulo comercial 3/4 superior limpio en estudio. Prohibido incluir collages chinos, textos superpuestos, marcas de agua, precios o fondos feos de proveedor.`;

  const researchTextPayload = `INVESTIGÁ ESTE PRODUCTO (${input.role === 'principal' ? 'PRODUCTO PRINCIPAL' : 'ARTÍCULO GANCHO DE ENTRADA'}):
- URL del proveedor (si existe): ${hasUrl ? cleanUrl : 'No ingresada — investigar por nombre/referencia'}
- Nombre borrador ingresado: ${rawName || 'No ingresado todavía'}
- Notas / texto en crudo del proveedor (SOLO COMO PISTA — PROHIBIDO COPIAR Y PEGAR LITERAL): ${rawDesc || 'Sin notas'}
${
  scraped?.ok
    ? `- Título extraído de URL: ${scraped.title || 'N/A'}
- Meta descripción URL: ${scraped.description || 'N/A'}
- Datos estructurados / JSON-LD URL: ${scraped.jsonLdInfo || 'N/A'}
- Extracto técnico del cuerpo de la página: ${scraped.specsText || 'N/A'}`
    : ''
}

Devolvé EXCLUSIVAMENTE este JSON válido:
{
  "researchedName": "Nombre comercial limpio en español (sin SKU ni ruido de proveedor)",
  "researchedDescription": "Síntesis comercial propia escrita desde cero tras investigar qué incluye, cómo funciona y qué problema resuelve (25-48 palabras, CERO copia-pega del borrador en crudo).",
  "verifiedSpecs": [
    "Dato técnico o material real verificado 1",
    "Capacidad, medida o modo de uso real 2",
    "Qué incluye exactamente en el paquete 3"
  ],
  "usageSummary": "Explicación corta y natural de cómo se usa en la vida diaria en Paraguay.",
  "exactVisualBlueprint": "Hyper-specific English physical description of THIS EXACT product (shape, dimensions feel, parts, surface materials, exact color palette, controls/connectors, accessories in frame) staged cleanly from an elevated 3/4 studio hero camera angle with zero text, zero watermarks, zero collage.",
  "discoveredReferenceImageUrl": "Si encontraste una URL HTTPS limpia de foto real del producto en tu búsqueda web, inclúyela aquí; si no, cadena vacía."
}`;

  const callResearchLlm = async (modelId: string, withWebPlugin: boolean, includeVision: boolean) => {
    const userContent: any =
      includeVision && visionImageUrl
        ? [
            { type: 'text', text: researchTextPayload },
            { type: 'image_url', image_url: { url: visionImageUrl } }
          ]
        : researchTextPayload;

    const payload: Record<string, any> = {
      model: modelId,
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: researchSystemPrompt },
        { role: 'user', content: userContent }
      ]
    };
    if (withWebPlugin) {
      payload.plugins = [{ id: 'web', max_results: 5 }];
    }

    return f('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': input.referer || 'https://noelux.shop',
        'X-Title': 'Noelux Deep Product Research AI'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000)
    });
  };

  let usedWebSearch = false;
  let llmRes = await callResearchLlm('openai/gpt-4o:online', true, Boolean(visionImageUrl));
  if (llmRes.ok) {
    usedWebSearch = true;
  } else {
    // Fallback limpio a gpt-4o estándar (y sin imagen si una URL externa falló)
    llmRes = await callResearchLlm(VISUAL_CREATOR_TEXT_MODEL, false, Boolean(visionImageUrl));
    if (!llmRes.ok && visionImageUrl) {
      llmRes = await callResearchLlm(VISUAL_CREATOR_TEXT_MODEL, false, false);
    }
  }

  if (!llmRes.ok) {
    const errTxt = await llmRes.text().catch(() => '');
    return {
      ok: Boolean(scraped?.ok || rawName),
      researchedName: fallbackName,
      researchedDescription: fallbackDesc,
      verifiedSpecs: [],
      usageSummary: fallbackDesc,
      exactVisualBlueprint: `Clean 3/4 commercial studio product photograph of ${fallbackName}`,
      discoveredReferenceImageUrl: scrapedImg || undefined,
      scrapedTitle: scraped?.title,
      scrapedDescription: scraped?.description,
      scrapedImageUrl: scrapedImg || undefined,
      usedWebSearch: false,
      error: `Investigación IA no disponible (${llmRes.status}): ${errTxt.slice(0, 140)}`
    };
  }

  try {
    const llmJson: any = await llmRes.json();
    const content = String(llmJson?.choices?.[0]?.message?.content || '').trim();
    const parsed = JSON.parse(content);

    const hasResearchPayload = Boolean(
      String(parsed?.researchedDescription || '').trim() ||
        String(parsed?.exactVisualBlueprint || '').trim()
    );

    if (!hasResearchPayload) {
      return {
        ok: true,
        researchedName: fallbackName,
        researchedDescription: fallbackDesc,
        verifiedSpecs: [],
        usageSummary: fallbackDesc,
        exactVisualBlueprint: '',
        discoveredReferenceImageUrl: scrapedImg || undefined,
        scrapedTitle: scraped?.title,
        scrapedDescription: scraped?.description,
        scrapedImageUrl: scrapedImg || undefined,
        usedWebSearch
      };
    }

    const cleanResName = String(parsed?.researchedName || fallbackName)
      .replace(/\btripwire\b/gi, fallbackName)
      .trim();
    const cleanResDesc = String(parsed?.researchedDescription || fallbackDesc)
      .replace(/\btripwire\b/gi, cleanResName)
      .trim();
    const specs: string[] = Array.isArray(parsed?.verifiedSpecs)
      ? parsed.verifiedSpecs.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 6)
      : [];
    const blueprint = String(
      parsed?.exactVisualBlueprint ||
        `Clean 3/4 studio hero commercial photography of the exact physical ${cleanResName}`
    ).trim();
    const discovered = /^https?:\/\//i.test(String(parsed?.discoveredReferenceImageUrl || '').trim())
      ? String(parsed.discoveredReferenceImageUrl).trim()
      : scrapedImg || undefined;

    return {
      ok: true,
      researchedName: cleanResName,
      researchedDescription: cleanResDesc,
      verifiedSpecs: specs,
      usageSummary: String(parsed?.usageSummary || cleanResDesc).trim(),
      exactVisualBlueprint: blueprint,
      discoveredReferenceImageUrl: discovered,
      scrapedTitle: scraped?.title,
      scrapedDescription: scraped?.description,
      scrapedImageUrl: scrapedImg || undefined,
      usedWebSearch
    };
  } catch (err: any) {
    return {
      ok: Boolean(scraped?.ok || rawName),
      researchedName: fallbackName,
      researchedDescription: fallbackDesc,
      verifiedSpecs: [],
      usageSummary: fallbackDesc,
      exactVisualBlueprint: '',
      discoveredReferenceImageUrl: scrapedImg || undefined,
      scrapedTitle: scraped?.title,
      scrapedDescription: scraped?.description,
      scrapedImageUrl: scrapedImg || undefined,
      usedWebSearch: false,
      error: err?.message
    };
  }
}

export async function recreateExactProductStudioImage(params: {
  openRouterApiKey: string;
  productName: string;
  exactVisualBlueprint: string;
  verifiedSpecs?: string[];
  filePrefix: string;
  referer?: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const f = params.fetchImpl || fetch;
  const specsClause =
    Array.isArray(params.verifiedSpecs) && params.verifiedSpecs.length > 0
      ? ` Key real details: ${params.verifiedSpecs.slice(0, 3).join('; ')}.`
      : '';

  const studioPrompt = `Authentic high-end commercial tabletop DSLR photograph (recreating the EXACT physical product faithfully from a natural 3/4 eye-level commercial angle): ${params.productName}. Faithful physical specification of the exact product: ${params.exactVisualBlueprint}.${specsClause} Physically resting on a real natural matte stone or warm light oak surface with genuine contact shadows, soft diffused studio softbox daylight, 85mm prime lens crisp focus, ultra-real physical textures, ZERO cartoon/CGI look, ZERO neon glow, ZERO floating in air, ZERO text, ZERO watermarks, ZERO Chinese badges, ZERO collage frames.`;

  return generateSingleVisualSheetImage({
    openRouterApiKey: params.openRouterApiKey,
    prompt: studioPrompt,
    aspectRatio: '1:1',
    filePrefix: params.filePrefix,
    referer: params.referer,
    fetchImpl: f
  });
}

async function generateSingleVisualSheetImage(params: {
  openRouterApiKey: string;
  prompt: string;
  aspectRatio?: '3:4' | '2:3' | '1:1';
  filePrefix: string;
  referer?: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const f = params.fetchImpl || fetch;
  const maxAttempts = 6;
  let lastError = '';
  let activeAspectRatio: '3:4' | '2:3' | '1:1' = params.aspectRatio || '3:4';

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
          aspect_ratio: activeAspectRatio,
          quality: 'high',
          output_format: 'jpeg',
          n: 1
        }),
        signal: AbortSignal.timeout(95000)
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        if (res.status === 400 && activeAspectRatio === '2:3' && attempt < maxAttempts) {
          activeAspectRatio = '3:4';
          lastError = `OpenRouter Images HTTP 400 with 2:3; falling back to 3:4`;
          continue;
        }
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

export interface QuickCreatorAngleOption {
  id: string;
  title: string;
  archetype: string;
  winnerAngle: string;
  visualDirection: string;
  recommendedSheetCount: 2 | 3 | 4 | 5 | 6 | 7;
  recommendedAudioPreset: 'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none';
  whyItConverts: string;
  tripwireBridgeNote?: string;
}

export interface QuickCreatorAiStrategyInput {
  openRouterApiKey: string;
  pageCreationMode: 'dual_tripwire_winner' | 'principal_only';
  productName: string;
  productDescription: string;
  winnerAngle?: string;
  price1Gs?: number;
  normalPriceGs?: number;
  entryProductName?: string;
  entryProductDescription?: string;
  entryPriceGs?: number;
  entryDeliveryFeeGs?: number;
  clonedFromContext?: QuickCreateVisualProductInput['clonedFromContext'];
  userQuestion?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  referer?: string;
  fetchImpl?: typeof fetch;
}

export interface QuickCreatorAiStrategyResult {
  currentPageDiagnosis: string;
  assistantReply: string;
  recommendedSheetCount: 2 | 3 | 4 | 5 | 6 | 7;
  recommendedAudioPreset: 'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none';
  options: QuickCreatorAngleOption[];
  recommendedOptionId: string;
}

export interface QuickCreateVisualProductInput {
  openRouterApiKey: string;
  pageCreationMode?: 'dual_tripwire_winner' | 'principal_only';
  productName: string;
  productDescription: string;
  winnerAngle?: string;
  visualDirection?: string;
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
  entryResearched?: boolean;
  entryVisualBlueprint?: string;
  entryVerifiedSpecs?: string[];
  instantDiscountPercent?: number;
  eventDurationHours?: number;
  slotsTotal?: number;
  backgroundMusicPreset?: 'auto' | 'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none';
  sheetCount?: 'auto' | 2 | 3 | 4 | 5 | 6 | 7;
  waNumber?: string;
  referer?: string;
  clonedFromContext?: {
    sourceProductId: string;
    sourceProductName: string;
    sourceSlug?: string;
    sourceMode?: 'dual_tripwire_winner' | 'principal_only';
    sourceDescription?: string;
    sourceWinnerAngle?: string;
    sourceHeadline?: string;
    sourceVisualMode?: string;
    sourceVisualSheetsSummary?: string[];
    sourceEntryProductName?: string;
    sourceContextoIA?: string;
    differentiationNote?: string;
  };
  fetchImpl?: typeof fetch;
}

export function sanitizeAndEnforceSalesLetterImagePrompt(
  rawPrompt: string,
  sheetIndex: number,
  isPrincipalOnly: boolean,
  totalSheets?: number
): string {
  const cleaned = String(rawPrompt || '')
    .replace(/Gs\.\s*Gs\./gi, 'Gs.')
    .replace(/\btripwire\b/gi, '')
    .replace(/SOLO ART[ÍI]CULO SUELTO\s*:?\s*(?:DELIVERY\s*)?(?:Gs\.?\s*[\d.]+|[^'"\n.,]*)/gi, '')
    .replace(/\b(?:360-degree wrap-around|wrap-around|floating 3D|3D glassmorphic|glassmorphic|volumetric light beams|glowing cyan rim light|electric sapphire-cobalt|crimson neon|molten gold|radiant emerald neon|glowing pointer lines)\b/gi, 'clean editorial photography')
    .replace(/\s+/g, ' ')
    .trim();

  const isClosingSheet = Boolean(totalSheets && sheetIndex === totalSheets - 1);

  const sectionPhotographyDirection = !isPrincipalOnly && sheetIndex === 0
    ? `AUTHENTIC HIGH-LEVEL COD E-COMMERCE PHOTOGRAPHY (BRIGHT REAL-HOME DAYLIGHT EDITORIAL): Real 50mm DSLR lifestyle photograph featuring a relatable realistic Latin American human avatar holding or naturally using the exact physical product in a genuine bright sunlit home environment (authentic skin texture, real room furniture, natural daylight shadows), framed inside a structured light editorial layout. PRICE CONTAINER DESIGN: Deep midnight sapphire navy (#0B132B) and champagne brushed-gold metallic framed architectural price showcase plaque (STRICTLY FORBIDDEN red, crimson, or maroon backgrounds on any price box!). Clean integrated step-by-step graphic footer band with icons guiding the user directly toward the green-and-gold "¡PEDIR AHORA!" button image directly below ("TOCÁ EL BOTÓN '¡PEDIR AHORA!' ABAJO -> COMPLETÁ TUS DATOS Y ENVIÁ TU UBICACIÓN CON EL BOTÓN DE GPS ↓").`
    : `AUTHENTIC HIGH-LEVEL COD E-COMMERCE PHOTOGRAPHY SECTION #${isPrincipalOnly ? sheetIndex + 1 : sheetIndex} (REALISTIC HUMAN AVATAR, REAL MOMENTS, FULL VIBRANT PRODUCT PERFORMANCE & REAL ENVIRONMENTS): Real 50mm/85mm DSLR lifestyle and editorial photograph with realistic Paraguayan/Latin American people in genuine everyday home or outdoor settings living real moments with the product showing its FULL vibrant authentic real-world colors and effects (never washed-out monochrome), paired with polished charcoal-slate, warm-ivory and deep emerald-gold e-commerce layout bands, luxury brushed-gold price framing (STRICTLY FORBIDDEN flat red backgrounds on price boxes), clean feature modules, and authentic material detail — substantial and persuasive with zero clutter.${
        isClosingSheet
          ? ` CLOSING HAND-HOLDING DESIGN: Include a luxury emerald-obsidian & brushed-gold price showcase plaque ("NO PAGÁS ENVÍO · NO PAGÁS REGALO · UN SOLO PRECIO FIJO") plus a crystal-clear 3-step visual guide box with icons pointing directly down to the green-and-gold "¡PEDIR AHORA!" button image below (which displays "Completa tus datos y recibe tu pedido en casa", "7 DÍAS DE GARANTÍA", "ENVÍO A TODO PARAGUAY" y "PAGO CONTRA ENTREGA"): "1. TOCÁ EL BOTÓN '¡PEDIR AHORA!' ABAJO · 2. COMPLETÁ TUS DATOS PARA RECIBIR EN CASA · 3. TOCÁ EL BOTÓN DE GPS ↓".`
          : ''
      }`;

  const antiCartoonAndOrthographyRule =
    'STRICT REALISM & ZERO-CARTOON RULE: Strictly genuine live-action commercial photography ONLY — NEVER cartoon, NEVER illustration, NEVER 3D CGI render, NEVER gamer neon, NEVER floating products in mid-air, NEVER glowing laser beams, NEVER noisy explosion of graphics. STRICT DESIGN & SPANISH ORTHOGRAPHY RULE: Render crisp, well-spaced ALL-CAPS Spanish headlines, price plaques, and concise icon-guided step callouts inside structured editorial graphic panels with generous breathing room and high contrast. NEVER write long dense prose paragraphs or cruel "SOLO ARTÍCULO SUELTO" text, and NEVER draw a digital ticking countdown timer clock. Verify letter-by-letter that every Spanish word is spelled 100% accurately with zero garbled or misspelled characters.';

  return `${cleaned} ${sectionPhotographyDirection} ${antiCartoonAndOrthographyRule}`;
}

export async function analyzeQuickCreatorStrategy(
  input: QuickCreatorAiStrategyInput
): Promise<QuickCreatorAiStrategyResult> {
  if (!String(input.openRouterApiKey || '').trim()) {
    throw new Error('Falta OPENROUTER_API_KEY configurada para consultar al Estratega IA.');
  }

  const f = input.fetchImpl || fetch;
  const isPrincipalOnly = input.pageCreationMode === 'principal_only';
  const cloneCtx = input.clonedFromContext;
  const safeEntryName = String(input.entryProductName || '').trim() || 'Artículo de Entrada';

  const defaultRecommendedSheets: 6 | 7 = isPrincipalOnly ? 6 : 7;
  const systemPrompt = isPrincipalOnly
    ? `Eres el Estratega Jefe de Conversión Directa (COD Paraguay), Redactor Maestro de Cartas de Venta y Director de Fotografía E-Commerce Realista GPT-2.6 para páginas de PRODUCTO GANADOR ÚNICO (Estándar).
TU MISIÓN: Que el operador trabaje 100% MANOS LIBRES con una CARTA DE VENTA VISUAL E-COMMERCE PROFESIONAL DE ALTO NIVEL dividida en **6 IMÁGENES FOTOGRÁFICAS REALES** (todas las descripciones, tarjetas de precio lujosas y la guía paso a paso hacia el formulario + GPS van diseñadas DENTRO de las imágenes mismas; cero muros HTML afuera).
REGLAS ESTRICTAS:
1. Modo ESTÁNDAR (Producto Ganador Único): JAMÁS sugieras artículos secundarios ni menciones "tripwire". Las 6 secciones combinan fotografía comercial realista DSLR + avatares reales + diseño editorial profesional:
   - Imagen 1: Avatar realista + Gran Promesa en entorno real + Tarjeta de Precio Lujosa Dorada y Azul Marino (NUNCA roja).
   - Imagen 2: Momento real de uso cotidiano a TODO COLOR real resolviendo el problema en el hogar/fachada.
   - Imagen 3: Transformación familiar real antes/después en hogar paraguayo.
   - Imagen 4: Manos reales operando el producto + detalle macro 85mm de materiales y calidad constructiva.
   - Imagen 5: Prueba social real ("MILES DE PEDIDOS EN ASUNCIÓN, CDE Y PARAGUAY") + confianza COD ("REVISÁS ANTES DE PAGAR").
    - Imagen 6: Cierre de Vendedor Profesional en hogar real + Oferta vigente hasta mañana si no cerrás esta página (sin reloj digital) + Tarjeta de Precio Lujosa + guía visual 3 pasos hacia el botón verde y dorado "¡PEDIR AHORA!" de abajo ("1. TOCÁ EL BOTÓN '¡PEDIR AHORA!' ABAJO · 2. COMPLETÁ TUS DATOS PARA RECIBIR EN CASA · 3. TOCÁ EL BOTÓN DE GPS ↓"), en sintonía con los emblemas del botón (7 días de garantía, envío a todo Paraguay, pago contra entrega).
2. CERO ESTÉTICA DE DIBUJO ANIMADO O CGI NEÓN: Todo debe sentirse como marca COD real seria.
3. PROHIBIDO EL COPIA Y PEGA: Jamás repitas literalmente frases crudas del usuario.
4. Recomendá "recommendedSheetCount": 6 (o 7 si amerita demostración extra) y "recommendedAudioPreset" ('warm_ambient', 'soft_lounge' o 'commercial_pulse').`
    : `Eres el Estratega Jefe de Embudos Duales, Redactor Maestro de Cartas de Venta (Direct-Response Copywriter) y Director de Fotografía E-Commerce COD de Alto Nivel (Paraguay) para páginas de ARTÍCULO DE ENTRADA + PRODUCTO GANADOR EN LA MISMA PÁGINA.
TU MISIÓN: Que el operador trabaje 100% MANOS LIBRES creando una página **100% VISUAL DE 7 IMÁGENES FOTOGRÁFICAS REALES** (toda la persuasión, comparación de valor, urgencia sin cronómetro, tarjetas de precio lujosas, ruptura "¡ESPERÁ!" y la guía paso a paso hacia el botón gráfico verde y dorado **"¡PEDIR AHORA!"** van DISEÑADAS DENTRO DE LAS IMÁGENES; debajo de Imagen 1 e Imagen 7 va exactamente la imagen oficial del botón "¡PEDIR AHORA!").
REGLA VISUAL Y DE CARTA DE VENTA (OBLIGATORIO — 7 LÁMINAS FOTOGRÁFICAS REALISTAS):
1. PROHIBIDO EL DIBUJO ANIMADO, CGI FLOTANTE, BARULLO NEÓN Y CAJAS DE PRECIO ROJAS PLANAS.
2. PROHIBIDO EL COPIA Y PEGA Y PROHIBIDO DECIR FRASES CRUELES COMO "SOLO ARTÍCULO SUELTO: DELIVERY...".
3. ARQUITECTURA DE 7 IMÁGENES:
   - IMAGEN 1 (ENTRADA LUMINOSA CON AVATAR REALISTA + TARJETA LUJOSA + GUÍA AL BOTÓN "¡PEDIR AHORA!" Y GPS): Dedicada 100% a "${safeEntryName}" (${formatParaguayGs(Number(input.entryPriceGs || 20000))}). Avatar humano realista en hogar luminoso + **Tarjeta de Precio Lujosa Azul Marino y Dorado Cepillado (NUNCA roja)** + guía gráfica paso a paso apuntando al botón verde y dorado **"¡PEDIR AHORA!"** que está justo abajo ("TOCÁ EL BOTÓN '¡PEDIR AHORA!' DE ABAJO · COMPLETÁ TUS DATOS PARA RECIBIR EN CASA Y ENVIÁ TU GPS ↓"). SIN nombrar a "${input.productName}".
   - IMAGEN 2 (SEC. 1 PRINCIPAL — RUPTURA ¡ESPERÁ! ROJO CON SUBRAYADO AMARILLO + DEMO A TODO COLOR): Abre arriba dentro del diseño con **¡ESPERÁ!** en rojo intenso con **subrayado amarillo** + **"¿ME REGALÁS UN SEGUNDO?"** + avatar realista disfrutando el efecto a TODO COLOR real de "${input.productName}".
   - IMAGEN 3 (SEC. 2 PRINCIPAL — TRANSFORMACIÓN FAMILIAR EN LUGAR REAL): Familia/pareja real viviendo el cambio real en casa a todo color.
   - IMAGEN 4 (SEC. 3 PRINCIPAL — MANOS REALES + MACRO 85mm): Manos operando "${input.productName}" + detalle macro real de construcción.
   - IMAGEN 5 (SEC. 4 PRINCIPAL — PRUEBA SOCIAL PARAGUAY Y CONFIANZA COD): "MILES DE ENVÍOS EN ASUNCIÓN, CIUDAD DEL ESTE Y TODO PARAGUAY" + "REVISÁS ANTES DE PAGAR".
   - IMAGEN 6 (SEC. 5 PRINCIPAL — COMPARACIÓN PREMIUM DE VALOR + URGENCIA REAL): Comparación elegante (por separado "${safeEntryName}" + envío suma ~${formatParaguayGs(Number(input.entryPriceGs || 20000) + Number(input.entryDeliveryFeeGs || 40000))} vs. llevando el **PAQUETE COMPLETO CON NUESTRO PRODUCTO GANADOR "${input.productName}"**: **${safeEntryName.toUpperCase()} SALE GRATIS DE REGALO + ENVÍO GRATIS**). Aviso elegante (sin reloj digital): "VIGENTE HASTA MAÑANA SI NO CERRÁS ESTA PÁGINA".
   - IMAGEN 7 (SEC. 6 PRINCIPAL — CIERRE VENDEDOR PROFESIONAL + TARJETA LUJOSA + GUÍA HACIA "¡PEDIR AHORA!" Y GPS): Avatar sonriente con el paquete completo + **Tarjeta Esmeralda-Dorada Lujosa** ("NO PAGÁS ENVÍO · NO PAGÁS REGALO · UN SOLO PRECIO FIJO") + guía visual paso a paso hacia el botón verde y dorado **"¡PEDIR AHORA!"** de abajo ("1. TOCÁ EL BOTÓN '¡PEDIR AHORA!' ABAJO · 2. COMPLETÁ TUS DATOS PARA RECIBIR EN CASA · 3. TOCÁ EL BOTÓN DE GPS ↓"), congruente con sus emblemas de **7 DÍAS DE GARANTÍA**, **ENVÍO A TODO PARAGUAY** y **PAGO CONTRA ENTREGA**.
4. MONEDA EXACTA: "Gs. 189.000". JAMÁS uses "tripwire" ni "Solo artículo suelto".
REGLAS ESTRICTAS:
- Recomendá "recommendedSheetCount": ${defaultRecommendedSheets} por defecto.
- Si existe PÁGINA CLONADA, diagnosticá el enfoque previo y proponé 3 opciones nuevas.`;

  const cloneContextBlock = cloneCtx?.sourceProductName
    ? `\nPÁGINA CLONADA COMO REFERENCIA BASE:
- Nombre original: ${cloneCtx.sourceProductName} (slug: ${cloneCtx.sourceSlug || 'N/A'}, modo previo: ${cloneCtx.sourceMode || 'N/A'})
- Titular previo detectado: ${cloneCtx.sourceHeadline || 'No registrado'}
- Ángulo previo detectado: ${cloneCtx.sourceWinnerAngle || 'No especificado explícitamente'}
- Descripción previa: ${cloneCtx.sourceDescription || input.productDescription}
${cloneCtx.sourceEntryProductName ? `- Artículo de entrada previo: ${cloneCtx.sourceEntryProductName}` : ''}
${Array.isArray(cloneCtx.sourceVisualSheetsSummary) && cloneCtx.sourceVisualSheetsSummary.length > 0 ? `- Láminas visuales actuales:\n  * ${cloneCtx.sourceVisualSheetsSummary.join('\n  * ')}` : ''}
${cloneCtx.sourceContextoIA ? `- Contexto comercial heredado:\n${cloneCtx.sourceContextoIA}` : ''}`
    : '\nPÁGINA NUEVA DESDE CERO (sin página clonada previa).';

  const historyText = Array.isArray(input.conversationHistory) && input.conversationHistory.length > 0
    ? `\nHISTORIAL RECIENTE CON EL OPERADOR:\n${input.conversationHistory
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'Operador' : 'Estratega IA'}: ${m.content}`)
        .join('\n')}`
    : '';

  const userPrompt = `ANALIZÁ ESTE PRODUCTO Y GENERÁ LA ESTRATEGIA DE CARTA DE VENTA VISUAL COD DE ALTO NIVEL (${defaultRecommendedSheets} IMÁGENES REALISTAS CON GUÍA PASO A PASO Y GPS INTEGRADOS EN EL DISEÑO):
- Modo seleccionado: ${isPrincipalOnly ? 'Producto Ganador Único (Estándar — 6 Secciones Realistas de Carta de Venta)' : 'Entrada + Producto Ganador (1 Imagen Entrada con Guía GPS + 6 Secciones Completas del Producto Ganador)'}
- Producto Ganador Principal: ${input.productName}
- Descripción base (NO copiar literal): ${input.productDescription}
- Ángulo borrador ingresado: ${input.winnerAngle || 'Proponé los 3 mejores ángulos persuasivos'}
- Precio Principal 1x: ${formatParaguayGs(Number(input.price1Gs || 189000))} (Normal: ${formatParaguayGs(Number(input.normalPriceGs || 249000))})
${
  !isPrincipalOnly
    ? `- Artículo de Entrada (Imagen 1): ${safeEntryName}
- Descripción entrada: ${input.entryProductDescription || safeEntryName}
- Precio Entrada: ${formatParaguayGs(Number(input.entryPriceGs || 20000))} (delivery referencia ${formatParaguayGs(Number(input.entryDeliveryFeeGs || 40000))} contrastado profesionalmente recién en el cierre de valor como paquete completo donde sale GRATIS)`
    : ''
}${cloneContextBlock}${historyText}
${input.userQuestion ? `\nPREGUNTA O INSTRUCCIÓN ACTUAL DEL OPERADOR: "${input.userQuestion}"` : '\nGENERÁ EL DIAGNÓSTICO INICIAL Y LAS 3 MEJORES OPCIONES LISTAS PARA 1 CLIC.'}

Devolvé EXCLUSIVAMENTE este JSON válido:
{
  "currentPageDiagnosis": "${cloneCtx?.sourceProductName ? 'Explicación clara de qué ángulo y estética visual usa la página clonada, para superarlo con una Carta de Venta nueva realista.' : `Diagnóstico breve de cómo estructuraremos esta Carta de Venta fotográfica realista de ${defaultRecommendedSheets} imágenes con guía GPS integrada en el diseño.`}",
  "assistantReply": "Respuesta directa y clara al operador (2-3 oraciones) explicando por qué la Opción 1 es la recomendación principal.",
  "recommendedSheetCount": ${defaultRecommendedSheets},
  "recommendedAudioPreset": "warm_ambient",
  "recommendedOptionId": "opt_1",
  "options": [
    {
      "id": "opt_1",
      "title": "Nombre corto del ángulo persuasivo (máx 6 palabras)",
      "archetype": "Recomendada por IA",
      "winnerAngle": "Promesa persuasiva de Carta de Venta lista para convertir (máx 12 palabras)",
      "visualDirection": "Fotografía DSLR real con avatar humano, resultado a todo color, tarjeta lujosa azul marino/dorado y guía 3 pasos con GPS integrada en las ${defaultRecommendedSheets} láminas GPT-2.6",
      "recommendedSheetCount": ${defaultRecommendedSheets},
      "recommendedAudioPreset": "warm_ambient",
      "whyItConverts": "Por qué esta Carta de Venta visual pura de ${defaultRecommendedSheets} láminas con guía GPS integrada convierte al instante.",
      "tripwireBridgeNote": "${isPrincipalOnly ? '' : 'Cómo la Imagen 1 guía al botón ¡PEDIR AHORA! con GPS, Imagen 2 frena con ¡ESPERÁ! y las Imágenes 3-7 cierran hacia el botón ¡PEDIR AHORA! final con garantía y pago contra entrega en Paraguay.'}"
    },
    {
      "id": "opt_2",
      "title": "Segundo enfoque de Carta de Venta",
      "archetype": "Deseo y Transformación",
      "winnerAngle": "...",
      "visualDirection": "...",
      "recommendedSheetCount": ${defaultRecommendedSheets},
      "recommendedAudioPreset": "soft_lounge",
      "whyItConverts": "...",
      "tripwireBridgeNote": "${isPrincipalOnly ? '' : '...'}"
    },
    {
      "id": "opt_3",
      "title": "Tercer enfoque de Carta de Venta",
      "archetype": "Superioridad y Ahorro Total",
      "winnerAngle": "...",
      "visualDirection": "...",
      "recommendedSheetCount": ${defaultRecommendedSheets},
      "recommendedAudioPreset": "commercial_pulse",
      "whyItConverts": "...",
      "tripwireBridgeNote": "${isPrincipalOnly ? '' : '...'}"
    }
  ]
}`;

  const llmRes = await f('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.openRouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': input.referer || 'https://noelux.shop',
      'X-Title': 'Noelux Quick Creator AI Strategist'
    },
    body: JSON.stringify({
      model: VISUAL_CREATOR_TEXT_MODEL,
      temperature: 0.55,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }),
    signal: AbortSignal.timeout(40000)
  });

  if (!llmRes.ok) {
    const errTxt = await llmRes.text().catch(() => '');
    throw new Error(`Estratega IA falló (${llmRes.status}): ${errTxt.slice(0, 220)}`);
  }

  const llmJson: any = await llmRes.json();
  const rawContent = String(llmJson?.choices?.[0]?.message?.content || '').trim();
  const parsed = JSON.parse(rawContent);

  const normalizeAudio = (val: any): 'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none' =>
    val === 'soft_lounge' || val === 'commercial_pulse' || val === 'none' ? val : 'warm_ambient';

  const normalizeSheetCount = (
    val: any,
    fallback: 2 | 3 | 4 | 5 | 6 | 7 = defaultRecommendedSheets
  ): 2 | 3 | 4 | 5 | 6 | 7 => {
    const n = Number(val);
    return n === 2 || n === 3 || n === 4 || n === 5 || n === 6 || n === 7 ? n : fallback;
  };

  const rawOptions: any[] = Array.isArray(parsed?.options) ? parsed.options : [];
  const options: QuickCreatorAngleOption[] = rawOptions.slice(0, 4).map((o, idx) => ({
    id: String(o?.id || `opt_${idx + 1}`),
    title: String(o?.title || `Estrategia ${idx + 1}`).trim(),
    archetype: String(o?.archetype || (idx === 0 ? 'Recomendada por IA' : `Enfoque ${idx + 1}`)).trim(),
    winnerAngle: String(o?.winnerAngle || input.winnerAngle || input.productName).trim(),
    visualDirection: String(o?.visualDirection || '').trim(),
    recommendedSheetCount: normalizeSheetCount(o?.recommendedSheetCount, defaultRecommendedSheets),
    recommendedAudioPreset: normalizeAudio(o?.recommendedAudioPreset),
    whyItConverts: String(o?.whyItConverts || '').trim(),
    tripwireBridgeNote: !isPrincipalOnly && o?.tripwireBridgeNote ? String(o.tripwireBridgeNote).trim() : undefined
  }));

  if (options.length === 0) {
    throw new Error('El Estratega IA no devolvió opciones de ángulo válidas.');
  }

  const recommendedOptionId = String(parsed?.recommendedOptionId || options[0].id);
  const matchedRec = options.find((o) => o.id === recommendedOptionId) || options[0];

  return {
    currentPageDiagnosis: String(parsed?.currentPageDiagnosis || '').trim(),
    assistantReply: String(parsed?.assistantReply || '').trim(),
    recommendedSheetCount: normalizeSheetCount(
      matchedRec.recommendedSheetCount ?? parsed?.recommendedSheetCount,
      defaultRecommendedSheets
    ),
    recommendedAudioPreset: normalizeAudio(parsed?.recommendedAudioPreset || matchedRec.recommendedAudioPreset),
    options,
    recommendedOptionId: matchedRec.id
  };
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
  const rawSheetNum = Number(input.sheetCount);
  const sheetCountMode: 'auto' | 2 | 3 | 4 | 5 | 6 | 7 =
    rawSheetNum === 2 ||
    rawSheetNum === 3 ||
    rawSheetNum === 4 ||
    rawSheetNum === 5 ||
    rawSheetNum === 6 ||
    rawSheetNum === 7
      ? (rawSheetNum as 2 | 3 | 4 | 5 | 6 | 7)
      : 'auto';
  const defaultAutoSheetCount: 6 | 7 = isPrincipalOnly ? 6 : 7;
  const requestedSheetCount: 2 | 3 | 4 | 5 | 6 | 7 =
    sheetCountMode === 'auto' ? defaultAutoSheetCount : sheetCountMode;
  const price1 = Math.max(35000, Number(input.price1Gs) || 189000);
  const price2 = Number(input.price2Gs) || Math.round(price1 * 1.85);
  const price3 = Number(input.price3Gs) || Math.round(price1 * 2.65);
  const normalPrice = Number(input.normalPriceGs) || Math.round(price1 * 1.32);

  let safeEntryName = String(input.entryProductName || '').trim() || 'Artículo Complementario';
  const entryPrice = Math.max(5000, Number(input.entryPriceGs) || 20000);
  const entryNormal =
    input.entryNormalPriceGs && Number(input.entryNormalPriceGs) > entryPrice
      ? Number(input.entryNormalPriceGs)
      : undefined;
  const deliveryFee = Math.max(15000, Number(input.entryDeliveryFeeGs) || 40000);
  const separateTotalGs = entryPrice + deliveryFee;
  const instantDiscountPct = Math.max(5, Math.min(40, Number(input.instantDiscountPercent) || 12));
  const eventDurationHours = Math.max(2, Math.min(12, Number(input.eventDurationHours) || 6));
  const slotsTotal = Math.max(5, Math.min(20, Number(input.slotsTotal) || 10));

  let resolvedEntryDesc = String(input.entryProductDescription || '').trim();
  let resolvedEntryImgInput = String(input.entryProductImageInput || '').trim();
  let resolvedEntryVisualBlueprint = String(input.entryVisualBlueprint || '').trim();
  let resolvedEntrySpecs = Array.isArray(input.entryVerifiedSpecs) ? input.entryVerifiedSpecs : [];

  // Investigación profunda automática del Gancho Tripwire (anti copia-pega + recreación de imagen de estudio exacta)
  if (!isPrincipalOnly && !input.entryResearched) {
    const deepHook = await researchProductDeeplyWithAI({
      openRouterApiKey: input.openRouterApiKey,
      url: input.entrySourceUrl,
      productName: safeEntryName,
      rawDescription: resolvedEntryDesc,
      referenceImageInput: resolvedEntryImgInput,
      role: 'entry_hook',
      referer: input.referer,
      fetchImpl: f
    });
    if (deepHook.ok) {
      if (deepHook.researchedName && !input.entryProductName?.trim()) {
        safeEntryName = deepHook.researchedName;
      }
      if (deepHook.researchedDescription) {
        resolvedEntryDesc = deepHook.researchedDescription;
      }
      if (deepHook.exactVisualBlueprint) {
        resolvedEntryVisualBlueprint = deepHook.exactVisualBlueprint;
      }
      if (deepHook.verifiedSpecs?.length) {
        resolvedEntrySpecs = deepHook.verifiedSpecs;
      }
      if (!resolvedEntryImgInput && (deepHook.scrapedImageUrl || deepHook.discoveredReferenceImageUrl)) {
        resolvedEntryImgInput = deepHook.scrapedImageUrl || deepHook.discoveredReferenceImageUrl || '';
      }
    }
  }

  const isAlreadyStudioRecreated =
    resolvedEntryImgInput.includes('/assets/visual-pages/entry_studio_') ||
    resolvedEntryImgInput.includes('entry_studio_');

  let recreatedEntryStudioImg = '';
  if (!isPrincipalOnly && !isAlreadyStudioRecreated && resolvedEntryVisualBlueprint) {
    try {
      recreatedEntryStudioImg = await recreateExactProductStudioImage({
        openRouterApiKey: input.openRouterApiKey,
        productName: safeEntryName,
        exactVisualBlueprint: resolvedEntryVisualBlueprint,
        verifiedSpecs: resolvedEntrySpecs,
        filePrefix: `entry_studio_${slugifyProductName(safeEntryName).slice(0, 16)}`,
        referer: input.referer,
        fetchImpl: f
      });
    } catch {}
  }

  const savedPrincipalImg = await saveImageInputLocally(input.productImageInput || '', 'prod_main');
  const savedEntryImg = isPrincipalOnly
    ? ''
    : recreatedEntryStudioImg || (await saveImageInputLocally(resolvedEntryImgInput, 'prod_entry'));

  const cleanAngleInput = String(input.winnerAngle || '').trim();
  const visualDirectionInput = String(input.visualDirection || '').trim();
  const cloneCtx = input.clonedFromContext;
  const cloneDirectiveBlock = cloneCtx?.sourceProductName
    ? `\n\nCONOCIMIENTO COMPLETO DE PÁGINA CLONADA (REFERENCIA BASE "${cloneCtx.sourceProductName}"):
- El operador seleccionó clonar la información técnica de la página existente "${cloneCtx.sourceProductName}" (ID: ${cloneCtx.sourceProductId}).
- Descripción original conocida: ${cloneCtx.sourceDescription || input.productDescription}
${cloneCtx.sourceWinnerAngle ? `- Ángulo de la página anterior (NO REPETIR IGUAL): ${cloneCtx.sourceWinnerAngle}` : ''}
${cloneCtx.sourceHeadline ? `- Titular de la página anterior (SUPERAR CON ENFOQUE INÉDITO): ${cloneCtx.sourceHeadline}` : ''}
${cloneCtx.sourceEntryProductName ? `- Artículo de entrada anterior: ${cloneCtx.sourceEntryProductName}` : ''}
${cloneCtx.sourceContextoIA ? `- Conocimiento comercial heredado:\n${cloneCtx.sourceContextoIA}` : ''}
${cloneCtx.differentiationNote ? `- NUEVA DIRECCIÓN VISUAL / ÁNGULO SOLICITADO POR EL OPERADOR: ${cloneCtx.differentiationNote}` : '- OBJETIVO DEL CLON: Conservá la veracidad técnica y precios reales, pero diseñá un ÁNGULO NUEVO, titulares inéditos y composiciones visuales 100% frescas y distintas a la página anterior.'}`
    : '';
  const visualDirectionBlock = visualDirectionInput
    ? `\n- DIRECCIÓN ARTÍSTICA APROBADA POR EL ESTRATEGA IA (RESPETAR AL PIE DE LA LETRA EN LOS PROMPTS GPT-2.6): ${visualDirectionInput}`
    : '';

  const promptSystemContent = isPrincipalOnly
    ? `Eres el Vendedor Profesional Número 1 de Respuesta Directa (COD Paraguay) y Director de Fotografía E-Commerce de Alto Nivel.
Diseñas páginas gráficas 100% VISUALES de ${requestedSheetCount} SECCIONES para UN ÚNICO PRODUCTO GANADOR (toda la descripción, prueba social, tarjeta de precio lujosa y guía paso a paso hacia el formulario + botón GPS van DISEÑADOS DENTRO de las imágenes).

REGLAS CLAVE DE CONVERSIÓN Y DISEÑO VISUAL:
1. FOTOGRAFÍA COMERCIAL REALISTA + AVATARES HUMANOS REALES + RESULTADO REAL A TODO COLOR: Mostrá personas reales, momentos reales y entornos reales mostrando el PRODUCTO EN ACCIÓN CON TODO SU COLOR Y RESULTADO REAL.
2. TARJETA DE PRECIO LUJOSA (PROHIBIDO FONDO ROJO PLANO): Siempre usá tarjetas arquitectónicas azul marino/esmeralda profundo con bisel metálico dorado cepillado.
3. PRUEBA SOCIAL EN PARAGUAY Y URGENCIA SIN CRONÓMETRO: Incluí prueba social real ("MILES DE ENVÍOS EN ASUNCIÓN, CIUDAD DEL ESTE Y TODO PARAGUAY") y aviso estático elegante ("VIGENTE HASTA MAÑANA SI NO CERRÁS ESTA PÁGINA — AL CERRARLA TERMINA"; nunca reloj digital corriendo).
4. GUÍA DE LA MANO + GPS DENTRO DE LA ÚLTIMA IMAGEN: El botón gráfico debajo de la página es de color verde y dorado y dice **"¡PEDIR AHORA!"** ("Completa tus datos y recibe tu pedido en casa", junto a los emblemas "7 DÍAS DE GARANTÍA", "ENVÍO A TODO PARAGUAY" y "PAGO CONTRA ENTREGA"). Dentro de la última imagen diseñá una guía clara de 3 pasos con íconos: "1. TOCÁ EL BOTÓN '¡PEDIR AHORA!' ABAJO · 2. COMPLETÁ TUS DATOS PARA RECIBIR EN CASA · 3. TOCÁ EL BOTÓN DE GPS ↓".
5. PROHIBIDO DIBUJO ANIMADO / CGI NEÓN / COPIAR Y PEGAR / "tripwire" / "Gs. Gs.".${visualDirectionBlock}${cloneDirectiveBlock}`
    : `Eres el Vendedor Profesional Número 1 de Respuesta Directa (COD Paraguay) y Director de Fotografía E-Commerce de Alto Nivel.
REGLA MAESTRA PARA openai/gpt-image-2.6-sunburst (VERTICAL 2:3 — ${requestedSheetCount} IMÁGENES 100% VISUALES):
- CERO MUROS HTML DEBAJO DE LAS IMÁGENES: TODA la presentación, tarjeta de precio lujosa, ruptura "¡ESPERÁ!", comparación de valor y guía paso a paso hacia el botón gráfico oficial verde y dorado **"¡PEDIR AHORA!"** ("Completa tus datos y recibe tu pedido en casa · 7 Días de Garantía · Envío a todo Paraguay · Pago Contra Entrega") van DISEÑADAS DENTRO DE LAS IMÁGENES MISMAS.
- PROHIBIDO DIBUJO ANIMADO, CGI NEÓN, FONDOS ROJOS DE PRECIO Y FRASES CRUELES COMO "SOLO ARTÍCULO SUELTO: DELIVERY...".
- ARQUITECTURA DE ${requestedSheetCount} IMÁGENES:
  1. IMAGEN 1 (ENTRADA LUMINOSA CON AVATAR + TARJETA LUJOSA + GUÍA HACIA "¡PEDIR AHORA!" Y GPS):
     - Centrada 100% en "${safeEntryName}": fotografía DSLR 50mm real con avatar humano sosteniendo/usando "${safeEntryName}" en hogar luminoso real.
     - Abajo dentro del diseño: **TARJETA DE PRECIO LUJOSA AZUL MARINO Y DORADO CEPILLADO (PROHIBIDO ROJO)** exhibiendo ${formatParaguayGs(entryPrice)} + guía gráfica paso a paso apuntando al botón verde y dorado **"¡PEDIR AHORA!"** justo debajo: "ESTE ES TU ${safeEntryName.toUpperCase()} · HOY SOLO ${formatParaguayGs(entryPrice)}", "TOCÁ EL BOTÓN '¡PEDIR AHORA!' ABAJO → COMPLETÁ TUS DATOS Y ENVIÁ TU GPS ↓". PROHIBIDO nombrar "${input.productName}".
  2. IMÁGENES DEL PRODUCTO GANADOR "${input.productName}" (LAS ${Math.max(1, requestedSheetCount - 1)} SECCIONES COMPLETAS):
     - IMAGEN 2 (SEC. 1 — RUPTURA ¡ESPERÁ! + DEMO REAL A TODO COLOR): Banda superior con **¡ESPERÁ!** en rojo intenso y **subrayado amarillo brillante** + **"¿ME REGALÁS UN SEGUNDO?"** + "MIRÁ ESTO ANTES DE PEDIR". Abajo: avatar realista y lugar real mostrando el resultado ESPECTACULAR A TODO COLOR real de "${input.productName}".
     - IMAGEN 3 (SEC. 2 — TRANSFORMACIÓN FAMILIAR EN LUGAR REAL): Familia/pareja real disfrutando el cambio real antes/después en su hogar a todo color.
     - IMAGEN 4 (SEC. 3 — MANOS REALES + DETALLE MACRO 85mm): Manos reales operando "${input.productName}" + toma macro 85mm de materiales reales.
     - IMAGEN 5 (SEC. 4 — PRUEBA SOCIAL PARAGUAY Y CONFIANZA COD): Comprador feliz en puerta ("MILES DE PEDIDOS EN ASUNCIÓN, CIUDAD DEL ESTE Y TODO PARAGUAY", "REVISÁS ANTES DE PAGAR").
     - IMAGEN 6 (SEC. 5 — COMPARACIÓN DE VALOR PREMIUM + URGENCIA REAL): Comparación elegante: llevar "${safeEntryName}" aparte + envío saldría ~${formatParaguayGs(separateTotalGs)} vs. elegir el **PAQUETE COMPLETO CON NUESTRO PRODUCTO GANADOR "${input.productName}"**: **"${safeEntryName.toUpperCase()} GRATIS DE REGALO"**, **"ENVÍO GRATUITO TODO PARAGUAY"**, y aviso estático elegante (SIN cronómetro digital): **"VIGENTE HASTA MAÑANA SI NO CERRÁS ESTA PÁGINA — AL CERRARLA TERMINA"**.
     - IMAGEN ${requestedSheetCount} (SEC. FINAL — CIERRE VENDEDOR PROFESIONAL + TARJETA LUJOSA + GUÍA HACIA "¡PEDIR AHORA!" Y GPS): Avatar sonriente en su mesa con "${input.productName}" + "${safeEntryName}" + **Tarjeta Esmeralda-Dorada Lujosa (NUNCA roja)** con **"NO PAGÁS ENVÍO · NO PAGÁS REGALO · UN SOLO PRECIO FIJO"** y precio gigante ${formatParaguayGs(price1)} + guía visual clara 3 pasos con íconos apuntando exactamente al botón verde y dorado **"¡PEDIR AHORA!"** que está justo abajo (con emblemas 7 Días de Garantía, Envío a Todo Paraguay y Pago Contra Entrega): **"1. TOCÁ EL BOTÓN '¡PEDIR AHORA!' ABAJO · 2. COMPLETÁ TUS DATOS PARA RECIBIR EN CASA · 3. TOCÁ EL BOTÓN DE GPS ↓"**.

REGLA INQUEBRANTABLE CONTRA FALLAS DE ESCRITURA Y COPY:
- PROHIBIDO EL COPIA Y PEGAR y PROHIBIDO "tripwire" / "Gs. Gs." / "Solo artículo suelto".
- Frases en español 100% exacto dentro de bloques gráficos aireados y ordenados.${visualDirectionBlock}${cloneDirectiveBlock}`;

  const promptUserContent = isPrincipalOnly
    ? `PRODUCTO GANADOR ÚNICO (CARTA DE VENTA VISUAL COD EN ${requestedSheetCount} SECCIONES FOTOGRÁFICAS REALES + GUÍA GPS INTEGRADA):
- Nombre: ${input.productName}
- Enfoque / ángulo principal: ${cleanAngleInput || input.productDescription}
- Qué hace / descripción base (NO copiar literal): ${input.productDescription}
- Precio Normal: ${formatParaguayGs(normalPrice)} | Precio 1x: ${formatParaguayGs(price1)} (Pack 2x: ${formatParaguayGs(price2)}, Pack 3x: ${formatParaguayGs(price3)})
- Botón gráfico inferior oficial: Verde y Dorado con emblemas ("¡PEDIR AHORA! — Completa tus datos y recibe tu pedido en casa" · 7 Días de Garantía · Envío a Todo Paraguay · Pago Contra Entrega)
- Envío Producto Principal: ENVÍO GRATIS en todo Paraguay + Pago al recibir.
${visualDirectionInput ? `- Dirección visual asignada: ${visualDirectionInput}` : ''}

Devuelve EXCLUSIVAMENTE este JSON válido:
{
  "strategySummary": "Explicación breve del arco persuasivo en ${requestedSheetCount} secciones hacia el botón oficial ¡PEDIR AHORA! con guía GPS integrada.",
  "recommendedAudioPreset": "warm_ambient",
  "researchedProductDescription": "Ficha comercial persuasiva redactada desde cero en español (NUNCA copia-pega literal).",
  "sobrietyHeadline": "Titular persuasivo de Carta de Venta (máx 9 palabras).",
  "subheadline": "Bajada persuasiva en Paraguay (máx 20 palabras).",
  "winnerAngleHeadline": "Gran promesa central del producto ganador (máx 10 palabras).",
  "winnerAngleDescription": "Argumento persuasivo real (máx 30 palabras).",
  "bundleButtonLabel": "¡PEDIR AHORA!",
  "bundleDisclaimer": "Incluye ${input.productName} original + Envío GRATIS en Paraguay + Pago contra entrega.",
  "sheetPrompts": [
    {
      "role": "hero_presentation",
      "title": "Sección 1 · Avatar Real y Tarjeta Lujosa de Precio",
      "caption": "Apertura con avatar realista y tarjeta azul marino y dorado",
      "imagePrompt": "High-converting 2:3 vertical real-life COD e-commerce editorial photograph for openai/gpt-image-2.6-sunburst: shot on 50mm DSLR, realistic Latin American human avatar naturally holding or demonstrating ${input.productName} in full vibrant authentic real-world colors (${cleanAngleInput || 'resultado real en casa'}) inside a real sunlit home setting (${visualDirectionInput || 'natural daylight, clean matte editorial framing'}), crisp bold ALL-CAPS Spanish headline (3-4 persuasive words), 3 clean spec modules, deep midnight navy & brushed champagne-gold architectural price plaque '${formatParaguayGs(price1)}' (STRICTLY FORBIDDEN red backgrounds on any price box), zero cartoon/CGI/neon, full-bleed edge-to-edge 2:3."
    },
    {
      "role": "comparison_need",
      "title": "Sección 2 · Momento Real de Uso a Todo Color",
      "caption": "Demostración viva en hogar real",
      "imagePrompt": "High-level 2:3 vertical real-world lifestyle COD e-commerce visual sales letter section 2 for openai/gpt-image-2.6-sunburst: candid 50mm DSLR photograph of a realistic person or family experiencing a genuine everyday moment using ${input.productName} showing its full vivid real-world multi-color results and impact in a real Paraguayan home room/facade/patio, crisp ALL-CAPS Spanish headline, 2 clean transformation callout strips, zero CGI/neon clutter, full-bleed 2:3."
    }${
      requestedSheetCount >= 3
        ? `,
    {
      "role": "authority_transformation",
      "title": "Sección 3 · Manos Reales y Calidad Macro",
      "caption": "Uso tangible y materiales constructivos",
      "imagePrompt": "Editorial 2:3 vertical e-commerce proof section 3 for openai/gpt-image-2.6-sunburst: real human hands operating ${input.productName} in an authentic real place paired with an 85mm macro DSLR close-up of its genuine build quality on a wooden table, crisp ALL-CAPS Spanish authority headline, 3 structured clean matte-slate feature modules, zero 3D render/neon, full-bleed 2:3."
    }`
        : ''
    }${
      requestedSheetCount >= 4
        ? `,
    {
      "role": "comparison_need",
      "title": "Sección 4 · Transformación en Familia",
      "caption": "Contraste real en entorno cotidiano",
      "imagePrompt": "Authentic 2:3 vertical COD e-commerce lifestyle section 4 for openai/gpt-image-2.6-sunburst: smiling Paraguayan family or couple enjoying '${input.productName}' transforming their real home environment vs ordinary dull ambiance, crisp ALL-CAPS headline 'CAMBIO REAL INMEDIATO', clean visual comparison strips, zero cartoon/neon, full-bleed 2:3."
    }`
        : ''
    }${
      requestedSheetCount >= 5
        ? `,
    {
      "role": "social_trust_specs",
      "title": "Sección 5 · Prueba Social en Asunción, CDE y Paraguay",
      "caption": "Confianza total contra entrega en puerta",
      "imagePrompt": "High-trust 2:3 vertical COD proof section 5 for openai/gpt-image-2.6-sunburst: realistic Paraguayan homeowner at home doorway verifying '${input.productName}' before paying, clean editorial badge 'MILES DE ENVÍOS EN ASUNCIÓN, CDE Y PARAGUAY', 'REVISÁS ANTES DE PAGAR', 'EFECTIVO O QR AL RECIBIR', zero cartoon/neon, full-bleed 2:3."
    }`
        : ''
    }${
      requestedSheetCount >= 6
        ? `,
    {
      "role": "social_trust_specs",
      "title": "Sección ${requestedSheetCount} · Cierre Vendedor Profesional y Guía GPS",
      "caption": "Tarjeta lujosa de precio y 3 pasos al botón ¡PEDIR AHORA!",
      "imagePrompt": "Closing 2:3 vertical COD e-commerce sales banner for openai/gpt-image-2.6-sunburst: smiling buyer unboxing complete '${input.productName}' kit at wooden table with full vivid product results glowing cleanly in home behind, static urgency ribbon 'VIGENTE HASTA MAÑANA SI NO CERRÁS ESTA PÁGINA' (NO digital timer clock), luxury midnight navy & brushed-gold layered price container plaque 'ENVÍO GRATIS · UN SOLO PRECIO FIJO' '${formatParaguayGs(price1)}' (STRICTLY FORBIDDEN red background), and crisp bottom 3-step icon guide box '1. TOCÁ EL BOTÓN ¡PEDIR AHORA! ABAJO · 2. COMPLETÁ TUS DATOS PARA RECIBIR EN CASA · 3. TOCÁ EL BOTÓN DE GPS ↓', zero cartoon/CGI/neon, full-bleed 2:3."
    }`
        : ''
    }${
      requestedSheetCount >= 7
        ? `,
    {
      "role": "social_trust_specs",
      "title": "Sección 7 · Garantía y Despacho Hoy Mismo",
      "caption": "Confirmación rápida hacia el botón ¡PEDIR AHORA!",
      "imagePrompt": "Final reassurance 2:3 vertical COD banner for '${input.productName}': real friendly courier handing sealed box at sunny Paraguayan home porch, clean banner '7 DÍAS DE GARANTÍA' + 'PAGO CONTRA ENTREGA', luxury brushed-gold price card '${formatParaguayGs(price1)}' and crisp downward cue 'TOCÁ EL BOTÓN VERDE Y DORADO ¡PEDIR AHORA! ABAJO ↓', full-bleed 2:3."
    }`
        : ''
    }
  ],
  "faq": [
    { "q": "Pregunta clave 1 sobre uso o ventajas de ${input.productName}", "a": "Respuesta persuasiva y transparente" },
    { "q": "Pregunta clave 2 sobre Envío Gratis y pago al recibir", "a": "Respuesta clara Paraguay" },
    { "q": "Pregunta clave 3 sobre garantía y packs", "a": "Respuesta honesta en guaraníes" }
  ],
  "agentContext": "Resumen completo para el agente WhatsApp y de Comentarios con precios exactos en Gs. de ${input.productName} (1x, 2x, 3x), Envío Gratis en todo Paraguay y pago al recibir."
}`
    : `CARTA DE VENTA VISUAL EN ${requestedSheetCount} IMÁGENES 100% VISUALES CON GUÍA DE VENDEDOR PROFESIONAL HACIA EL BOTÓN OFICIAL "¡PEDIR AHORA!" Y GPS:

PRODUCTO GANADOR PRINCIPAL (IMÁGENES 2 A ${requestedSheetCount}):
- Nombre Producto Ganador: ${input.productName}
- Ángulo persuasivo central: ${cleanAngleInput || `Nuestro producto ganador definitivo superior (${input.productDescription})`}
- Base técnica (NO copiar literal): ${input.productDescription}
- Precio Normal: ${formatParaguayGs(normalPrice)} | Precio 1x: ${formatParaguayGs(price1)} (Pack 2x: ${formatParaguayGs(price2)}, Pack 3x: ${formatParaguayGs(price3)})
- Botón gráfico #2 debajo de Imagen Final: Verde y Dorado con emblemas (**"¡PEDIR AHORA! — Completa tus datos y recibe tu pedido en casa"** + **7 DÍAS DE GARANTÍA** + **ENVÍO A TODO PARAGUAY** + **PAGO CONTRA ENTREGA**).
${visualDirectionInput ? `- Dirección visual asignada: ${visualDirectionInput}` : ''}

ARTÍCULO DE ENTRADA (IMAGEN 1 — GUÍA GPS INTEGRADA + TARJETA AZUL MARINO Y DORADO):
- Nombre real investigado: ${safeEntryName}
- Síntesis investigada: ${resolvedEntryDesc || safeEntryName}
${resolvedEntrySpecs.length > 0 ? `- Especificaciones reales clave: ${resolvedEntrySpecs.join(' | ')}` : ''}
${resolvedEntryVisualBlueprint ? `- Blueprint visual exacto: ${resolvedEntryVisualBlueprint}` : ''}
- Botón gráfico #1 debajo de Imagen 1: Verde y Dorado con emblemas (**"¡PEDIR AHORA! — Completa tus datos y recibe tu pedido en casa"**).
- Precio ÚNICO cerrado: ${formatParaguayGs(entryPrice)} (En Imagen 1 PROHIBIDO nombrar "${input.productName}". Precio dentro de TARJETA ARQUITECTÓNICA AZUL MARINO Y DORADO — JAMÁS roja).

Devuelve EXCLUSIVAMENTE este JSON válido:
{
  "strategySummary": "Carta de venta 100% visual de ${requestedSheetCount} imágenes con tarjetas de precio lujosas y guía paso a paso hacia el botón oficial ¡PEDIR AHORA! y GPS.",
  "recommendedAudioPreset": "warm_ambient",
  "researchedProductDescription": "Carta de venta redactada desde cero en español para ${input.productName}.",
  "researchedEntryDescription": "Ficha comercial redactada desde cero para ${safeEntryName}.",
  "sobrietyHeadline": "Titular magnético para ${safeEntryName} (máx 6 palabras).",
  "subheadline": "Beneficio directo en la vida diaria de ${safeEntryName} (máx 14 palabras).",
  "winnerAngleHeadline": "Gran titular persuasivo para ${input.productName} (máx 10 palabras).",
  "winnerAngleDescription": "Argumento persuasivo contundente para ${input.productName} (máx 28 palabras).",
  "reversePsychologyHook": "¡Esperá! ¿Me regalás un segundo antes de pedir? Llevando ${input.productName} recibís ${safeEntryName} GRATIS y activás Envío Gratuito en todo Paraguay.",
  "entryButtonLabel": "¡PEDIR AHORA!",
  "entryButtonColorName": "${ENTRY_BUTTON_COLOR_NAME}",
  "bundleButtonLabel": "¡PEDIR AHORA!",
  "bundleButtonColorName": "${BUNDLE_BUTTON_COLOR_NAME}",
  "bundleDisclaimer": "Incluye ${input.productName} completo + ${safeEntryName} DE REGALO + ENVÍO GRATUITO en todo Paraguay.",
  "sheetPrompts": [
    {
      "role": "hero_presentation",
      "title": "Lámina 1 · ${safeEntryName} (Avatar, Tarjeta Lujosa y Guía ¡PEDIR AHORA!)",
      "caption": "Entrada realista con tarjeta azul marino/dorado y guía al botón ¡PEDIR AHORA!",
      "imagePrompt": "High-level 2:3 vertical realistic COD e-commerce lifestyle photograph for openai/gpt-image-2.6-sunburst in crisp Paraguayan Spanish (bright sunlit real home aesthetic — warm ivory & deep midnight navy #0B132B + champagne brushed-gold #D4AF37): TOP ZONE crisp ALL-CAPS Spanish headline 'TU ${safeEntryName.toUpperCase()} HOY'; CENTER HERO candid 50mm DSLR photo of a relatable realistic Latin American human avatar holding/using ONLY '${safeEntryName}'${resolvedEntryVisualBlueprint ? ` (${resolvedEntryVisualBlueprint})` : ''} inside a real sunlit home room + 3 neat minimal spec tags (${resolvedEntrySpecs.slice(0, 3).join(' / ') || 'CALIDAD REAL / FÁCIL USO / LISTO HOY'}); LOWER DESIGN LUXURY DEEP SAPPHIRE-NAVY & BRUSHED CHAMPAGNE-GOLD ARCHITECTURAL PRICE CONTAINER CARD (STRICTLY FORBIDDEN red, crimson or maroon background!) displaying '${formatParaguayGs(entryPrice)}' paired with clean integrated 3-step icon footer bar: 'TOCÁ EL BOTÓN ¡PEDIR AHORA! ABAJO · COMPLETÁ TUS DATOS Y ENVIÁ TU GPS ↓'. NEVER write 'Gs. Gs.', DO NOT mention '${input.productName}', DO NOT mention free shipping. Full-bleed edge-to-edge 2:3."
    }${
      requestedSheetCount >= 4
        ? `,
    {
      "role": "comparison_need",
      "title": "Lámina 2 · Sección 1 Producto Ganador: ¡ESPERÁ! Demostración Real",
      "caption": "Ruptura rojo subrayado amarillo + Resultado real a todo color",
      "imagePrompt": "High-converting 2:3 vertical realistic COD e-commerce Visual Sales Letter Section 1 exclusively for '${input.productName}' for openai/gpt-image-2.6-sunburst — rich matte charcoal-slate & warm ivory palette: TOP 20% pattern-interrupt header inside layout with bold crimson-red word '¡ESPERÁ!' having a thick bright-yellow underline + crisp subheadline '¿ME REGALÁS UN SEGUNDO?' + 'ANTES DE PEDIR MIRÁ ESTO'; LOWER 80% candid 50mm DSLR lifestyle photo of a realistic Paraguayan person/couple at home experiencing '${input.productName}' showing its FULL VIBRANT MULTI-COLOR REAL-WORLD PERFORMANCE AND RESULTS (never monochrome), paired with bold 3-word ALL-CAPS headline and 2 clean dark-slate benefit pills. Zero cartoon/CGI, full-bleed 2:3."
    },
    {
      "role": "comparison_need",
      "title": "Lámina 3 · Sección 2 Producto Ganador: Transformación en Familia",
      "caption": "Contraste real en hogar cotidiano a todo color",
      "imagePrompt": "Authentic 2:3 vertical realistic COD Visual Sales Letter Section 2 exclusively for '${input.productName}' for openai/gpt-image-2.6-sunburst: candid 50mm DSLR photo of a happy Paraguayan family enjoying '${input.productName}' at full vivid color capacity transforming their real home environment vs ordinary dull ambiance, bold ALL-CAPS headline 'CAMBIO REAL INMEDIATO' and 2 structured contrast strips, zero cartoon/neon, full-bleed 2:3."
    }${
      requestedSheetCount >= 5
        ? `,
    {
      "role": "authority_transformation",
      "title": "Lámina 4 · Sección 3 Producto Ganador: Manos Reales y Macro 85mm",
      "caption": "Detalle constructivo real al tacto",
      "imagePrompt": "Polished 2:3 vertical realistic COD Visual Sales Letter Section 3 exclusively for '${input.productName}': real human hands operating '${input.productName}' in an authentic home location alongside an 85mm macro DSLR close-up of its genuine build materials resting on real wood, bold ALL-CAPS headline 'CALIDAD SUPERIOR REAL' and 3 crisp matte feature modules, zero CGI, full-bleed 2:3."
    }`
        : ''
    }${
      requestedSheetCount >= 6
        ? `,
    {
      "role": "social_trust_specs",
      "title": "Lámina 5 · Sección 4 Producto Ganador: Miles de Envíos en Paraguay",
      "caption": "Prueba social Asunción, Ciudad del Este y todo el país",
      "imagePrompt": "High-credibility 2:3 vertical COD trust section 4 exclusively for '${input.productName}': realistic smiling Paraguayan homeowner at their doorway inspecting '${input.productName}' before paying, crisp editorial trust seals 'MILES DE ENVÍOS EN ASUNCIÓN, CDE Y PARAGUAY', 'REVISÁS ANTES DE PAGAR', 'EFECTIVO O QR AL RECIBIR', zero cartoon/neon, full-bleed 2:3."
    }`
        : ''
    }${
      requestedSheetCount >= 7
        ? `,
    {
      "role": "authority_transformation",
      "title": "Lámina 6 · Sección 5: Comparación Premium de Valor y Regalo Gratis",
      "caption": "Por separado vs. Paquete Completo con Producto Ganador",
      "imagePrompt": "High-persuasion 2:3 vertical editorial value comparison sheet exclusively crafted like a top salesperson for openai/gpt-image-2.6-sunburst (matte obsidian, emerald & champagne gold, STRICTLY NO cruel 'SOLO ARTÍCULO SUELTO' text, NO digital ticking timer clock): clean side-by-side graphic layout showing '${safeEntryName}' + envío por separado (${formatParaguayGs(separateTotalGs)}) versus elegir hoy el 'PAQUETE COMPLETO PRODUCTO GANADOR ${input.productName.toUpperCase()}' que incluye '${safeEntryName.toUpperCase()} GRATIS DE REGALO' + 'ENVÍO GRATUITO TODO PARAGUAY' + badge 'ÉXITO EN ASUNCIÓN Y CDE', plus clean static urgency banner at bottom 'VIGENTE HASTA MAÑANA SI NO CERRÁS ESTA PÁGINA', full-bleed 2:3."
    }`
        : ''
    },
    {
      "role": "social_trust_specs",
      "title": "Lámina ${requestedSheetCount} · Cierre Vendedor Profesional y Guía ¡PEDIR AHORA!",
      "caption": "Un solo precio fijo + 3 pasos hacia el botón ¡PEDIR AHORA! y GPS",
      "imagePrompt": "Ultimate high-trust 2:3 vertical COD closing sales sheet exclusively for '${input.productName}' for openai/gpt-image-2.6-sunburst — deep emerald-obsidian, warm wood table & brushed champagne-gold (STRICTLY FORBIDDEN red price boxes, NO 'SOLO ARTÍCULO SUELTO', NO digital timer): TOP 42% candid 50mm DSLR photo of a smiling Paraguayan buyer unboxing '${input.productName}' + '${safeEntryName}' together on a real wooden home table with vivid colorful product effect shining cleanly behind; MIDDLE 32% LUXURY LAYERED EMERALD-NAVY & BRUSHED CHAMPAGNE-GOLD PRICE CONTAINER PLAQUE showing 'NO PAGÁS ENVÍO · NO PAGÁS REGALO · UN SOLO PRECIO FIJO' and giant metallic gold numerals '${formatParaguayGs(price1)}' (write ONCE) + gold ribbon '${safeEntryName.toUpperCase()} GRATIS'; BOTTOM 26% CLEAR 3-STEP ICON HAND-HOLDING FOOTER CARD '1. TOCÁ EL BOTÓN ¡PEDIR AHORA! ABAJO · 2. COMPLETÁ TUS DATOS PARA RECIBIR EN CASA · 3. TOCÁ EL BOTÓN DE GPS ↓'. Ultra-crisp flawless Spanish spelling, zero cartoon/CGI/neon, full-bleed 2:3."
    }`
        : requestedSheetCount === 3
          ? `,
    {
      "role": "comparison_need",
      "title": "Lámina 2 · ¡ESPERÁ! Demostración Real a Todo Color",
      "caption": "Ruptura rojo subrayado amarillo + Resultado real",
      "imagePrompt": "High-converting 2:3 vertical realistic COD Visual Sales Letter Section 1 for '${input.productName}': TOP crimson alert bar '¡ESPERÁ!' with bright-yellow underline + '¿ME REGALÁS UN SEGUNDO?', candid 50mm DSLR photo of realistic person enjoying '${input.productName}' at full vivid color in a real home setting, bold ALL-CAPS Spanish headline, 3 clean feature callouts, zero cartoon/CGI, edge-to-edge 2:3."
    },
    {
      "role": "social_trust_specs",
      "title": "Lámina 3 · Cierre Vendedor Profesional y Guía ¡PEDIR AHORA!",
      "caption": "Paquete Completo + Regalo Gratis + Guía Botón ¡PEDIR AHORA! y GPS",
      "imagePrompt": "High-trust 2:3 vertical COD closing sales photograph for '${input.productName}' + '${safeEntryName}' (NO red price box, NO 'SOLO ARTÍCULO SUELTO'): smiling buyer unboxing '${input.productName}' + '${safeEntryName} GRATIS' on real home table, badge 'MILES DE ENVÍOS ASUNCIÓN, CDE Y PARAGUAY', luxury emerald-gold price card 'NO PAGÁS ENVÍO · UN SOLO PRECIO FIJO' '${formatParaguayGs(price1)}', static ribbon 'VIGENTE HASTA MAÑANA SI NO CERRÁS', and 3-step icon guide '1. TOCÁ EL BOTÓN ¡PEDIR AHORA! ABAJO · 2. COMPLETÁ TUS DATOS PARA RECIBIR EN CASA · 3. TOCÁ EL BOTÓN DE GPS ↓', full-bleed 2:3."
    }`
          : `,
    {
      "role": "social_trust_specs",
      "title": "¡ESPERÁ! ${input.productName} + ${safeEntryName} GRATIS + GUÍA ¡PEDIR AHORA!",
      "caption": "Ruptura rojo/amarillo + Cierre Vendedor Profesional",
      "imagePrompt": "High-trust 2:3 vertical COD closing photograph for '${input.productName}' + '${safeEntryName}' (NO red price box, NO 'SOLO ARTÍCULO SUELTO'): TOP crimson '¡ESPERÁ!' with bright-yellow underline + '¿ME REGALÁS UN SEGUNDO?'; MIDDLE candid 50mm DSLR photo of realistic buyer using '${input.productName}' in full vivid color + '${safeEntryName} GRATIS' + 'MILES DE ENVÍOS ASUNCIÓN, CDE Y PARAGUAY'; LOWER luxury emerald-gold price plaque 'NO PAGÁS ENVÍO · UN SOLO PRECIO FIJO' '${formatParaguayGs(price1)}' + 3-step icon guide '1. TOCÁ EL BOTÓN ¡PEDIR AHORA! ABAJO · 2. COMPLETÁ TUS DATOS PARA RECIBIR EN CASA · 3. TOCÁ EL BOTÓN DE GPS ↓', full-bleed 2:3."
    }`
    }
  ],
  "faq": [
    { "q": "Pregunta clave 1 sobre qué incluye cada opción", "a": "Respuesta transparente en guaraníes sin jerga" },
    { "q": "Pregunta clave 2 sobre el pago al recibir y GPS", "a": "Respuesta clara Paraguay" },
    { "q": "Pregunta clave 3 sobre garantía y uso real", "a": "Respuesta honesta" }
  ],
  "agentContext": "Resumen completo para el agente WhatsApp y de Comentarios con precios exactos en Gs., qué incluye la caja y envío gratis en el paquete completo (sin decir nunca tripwire)."
}`;

  // 1. Cerebro OpenRouter GPT-4o: Arquitectura de Carta de Venta Visual + prompts de láminas gráficas
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
  const rawSheets: any[] = Array.isArray(parsed?.sheetPrompts) ? [...parsed.sheetPrompts] : [];
  if (rawSheets.length < 2) {
    throw new Error('OpenRouter GPT-4o no devolvió las láminas gráficas completas.');
  }

  const targetMinSheets = sheetCountMode !== 'auto' ? sheetCountMode : 0;
  if (targetMinSheets >= 4 && rawSheets.length < targetMinSheets) {
    const fallbackPrincipalSections = isPrincipalOnly
      ? [
          {
            role: 'comparison_need',
            title: `Sección 2 · Momento Real de Uso de ${input.productName}`,
            caption: 'Uso cotidiano en entorno real a todo color',
            imagePrompt: `Realistic 2:3 vertical COD e-commerce lifestyle photograph section 2 for '${input.productName}': candid 50mm DSLR scene of a realistic person using '${input.productName}' showing full vibrant authentic real-world colors and performance in an authentic home room, bold 3-word ALL-CAPS Spanish headline 'RESULTADO REAL HOY', 3 clean minimal benefit strips with 2-word uppercase labels, full-bleed 2:3.`
          },
          {
            role: 'authority_transformation',
            title: `Sección 3 · Manos Reales y Calidad de ${input.productName}`,
            caption: 'Detalles materiales reales al tacto',
            imagePrompt: `Realistic 2:3 vertical COD e-commerce editorial photograph section 3 for '${input.productName}': real human hands holding/operating '${input.productName}' plus 85mm macro close-up of real build materials on a wooden table, bold 3-word ALL-CAPS Spanish headline 'CALIDAD SUPERIOR REAL', 3 clean matte spec strips, full-bleed 2:3.`
          },
          {
            role: 'social_trust_specs',
            title: `Sección 4 · Confianza Real y Prueba en Paraguay`,
            caption: 'Verificación en puerta antes de pagar',
            imagePrompt: `High-credibility 2:3 vertical COD e-commerce proof photograph for '${input.productName}': realistic smiling customer at home entrance verifying physical package before paying, bold 3-word ALL-CAPS Spanish headline 'REVISÁS ANTES DE PAGAR', clean emerald trust badges, full-bleed 2:3.`
          },
          {
            role: 'social_trust_specs',
            title: `Sección 5 · Entrega Real COD con Envío Gratis`,
            caption: 'Cierre de Carta de Venta en hogar real',
            imagePrompt: `Trust-building 2:3 vertical COD e-commerce proof photograph for '${input.productName}': realistic smiling customer at home entrance verifying physical package before paying, banner 'MILES DE ENVÍOS EN ASUNCIÓN, CDE Y PARAGUAY', clean emerald trust badges, full-bleed 2:3.`
          },
          {
            role: 'social_trust_specs',
            title: `Sección 6 · Cierre Vendedor Profesional y Guía ¡PEDIR AHORA!`,
            caption: 'Tarjeta lujosa de precio y guía hacia el botón ¡PEDIR AHORA!',
            imagePrompt: `Closing 2:3 vertical COD e-commerce photograph for '${input.productName}': happy homeowner unboxing '${input.productName}' at real wooden table with vivid product results behind, static urgency ribbon 'VIGENTE HASTA MAÑANA SI NO CERRÁS ESTA PÁGINA', luxury navy & brushed-gold price card 'UN SOLO PRECIO FIJO' '${formatParaguayGs(price1)}' (NO red price box), and 3-step icon guide '1. TOCÁ EL BOTÓN ¡PEDIR AHORA! ABAJO · 2. COMPLETÁ TUS DATOS PARA RECIBIR EN CASA · 3. TOCÁ EL BOTÓN DE GPS ↓', full-bleed 2:3.`
          },
          {
            role: 'social_trust_specs',
            title: `Sección 7 · Garantía y Despacho Hoy Mismo`,
            caption: 'Confirmación rápida en puerta',
            imagePrompt: `Final reassurance 2:3 vertical COD photograph for '${input.productName}': courier handing package at sunny home porch, luxury brushed-gold price card '${formatParaguayGs(price1)}', bottom cue 'TOCÁ EL BOTÓN VERDE Y DORADO ¡PEDIR AHORA! ABAJO ↓', full-bleed 2:3.`
          }
        ]
      : [
          {
            role: 'comparison_need',
            title: `Lámina 2 · Sección 1 Producto Ganador: ¡ESPERÁ! Demostración Real`,
            caption: 'Ruptura rojo subrayado amarillo + Resultado real a todo color',
            imagePrompt: `Realistic 2:3 vertical COD e-commerce Visual Sales Letter Section 1 for '${input.productName}' in matte charcoal & ivory: crimson alert badge '¡ESPERÁ!' with bright-yellow underline + '¿ME REGALÁS UN SEGUNDO?', authentic 50mm DSLR lifestyle photo of a realistic Paraguayan person experiencing '${input.productName}' showing full vibrant multi-color real-world performance in a real home setting, full-bleed 2:3.`
          },
          {
            role: 'comparison_need',
            title: `Lámina 3 · Sección 2 Producto Ganador: Transformación Familiar Real`,
            caption: 'Contraste antes/después en hogar real',
            imagePrompt: `Authentic 2:3 vertical COD e-commerce Visual Sales Letter Section 2 exclusively for '${input.productName}': realistic Paraguayan family in real home living the full colorful transformation of '${input.productName}', bold ALL-CAPS Spanish headline 'CAMBIO REAL INMEDIATO', full-bleed 2:3.`
          },
          {
            role: 'authority_transformation',
            title: `Lámina 4 · Sección 3 Producto Ganador: Manos Reales y Macro`,
            caption: 'Demostración tangible con manos reales y macro 85mm',
            imagePrompt: `Polished 2:3 vertical COD e-commerce Visual Sales Letter Section 3 exclusively for '${input.productName}': real human hands operating '${input.productName}' in a real room + 85mm macro detail of physical quality on real wood, bold ALL-CAPS headline 'CALIDAD SUPERIOR REAL', full-bleed 2:3.`
          },
          {
            role: 'social_trust_specs',
            title: `Lámina 5 · Sección 4 Producto Ganador: Miles de Envíos en Paraguay`,
            caption: 'Asunción, Ciudad del Este y todo Paraguay',
            imagePrompt: `High-credibility 2:3 vertical COD trust proof section for '${input.productName}': realistic smiling customer at home porch verifying package before paying, crisp ALL-CAPS seals 'MILES DE ENVÍOS EN ASUNCIÓN, CDE Y PARAGUAY', 'REVISÁS ANTES DE PAGAR', full-bleed 2:3.`
          },
          {
            role: 'authority_transformation',
            title: `Lámina 6 · Sección 5: Comparación Premium de Valor y Regalo Gratis`,
            caption: 'Por separado vs. Paquete Completo con Producto Ganador',
            imagePrompt: `High-persuasion 2:3 vertical value comparison card for '${input.productName}' (STRICTLY NO red price box, NO 'SOLO ARTÍCULO SUELTO', NO digital timer): side-by-side layout contrasting '${safeEntryName}' + envío por separado (${formatParaguayGs(separateTotalGs)}) versus 'PAQUETE COMPLETO PRODUCTO GANADOR ${input.productName.toUpperCase()}' including '${safeEntryName.toUpperCase()} GRATIS' + 'ENVÍO GRATUITO TODO PARAGUAY' + static banner 'VIGENTE HASTA MAÑANA SI NO CERRÁS ESTA PÁGINA', full-bleed 2:3.`
          },
          {
            role: 'social_trust_specs',
            title: `Lámina ${targetMinSheets} · Cierre Vendedor Profesional y Guía ¡PEDIR AHORA!`,
            caption: 'Tarjeta lujosa de precio + 3 pasos hacia botón ¡PEDIR AHORA! y GPS',
            imagePrompt: `Ultimate high-trust 2:3 vertical COD closing section exclusively for '${input.productName}' in emerald-obsidian & brushed champagne-gold (STRICTLY FORBIDDEN red price boxes, NO 'SOLO ARTÍCULO SUELTO'): realistic smiling buyer at home table unboxing '${input.productName}' + '${safeEntryName} GRATIS', luxury emerald-navy brushed-gold price plaque 'NO PAGÁS ENVÍO · NO PAGÁS REGALO · UN SOLO PRECIO FIJO' '${formatParaguayGs(price1)}', and clean 3-step icon footer card '1. TOCÁ EL BOTÓN ¡PEDIR AHORA! ABAJO · 2. COMPLETÁ TUS DATOS PARA RECIBIR EN CASA · 3. TOCÁ EL BOTÓN DE GPS ↓', full-bleed 2:3.`
          }
        ];

    while (rawSheets.length < targetMinSheets) {
      const nextIdx = rawSheets.length - 1;
      rawSheets.push(fallbackPrincipalSections[Math.min(nextIdx, fallbackPrincipalSections.length - 1)]);
    }
  }

  const finalSheetCount: 2 | 3 | 4 | 5 | 6 | 7 =
    sheetCountMode === 'auto'
      ? rawSheets.length >= 7
        ? 7
        : rawSheets.length === 6
          ? 6
          : rawSheets.length === 5
            ? 5
            : rawSheets.length === 4
              ? 4
              : rawSheets.length === 3
                ? 3
                : 2
      : sheetCountMode;

  const resolvedAudioPreset: 'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none' =
    input.backgroundMusicPreset && input.backgroundMusicPreset !== 'auto'
      ? input.backgroundMusicPreset
      : parsed?.recommendedAudioPreset === 'soft_lounge' ||
          parsed?.recommendedAudioPreset === 'commercial_pulse' ||
          parsed?.recommendedAudioPreset === 'none'
        ? parsed.recommendedAudioPreset
        : 'warm_ambient';

  // 2. Generar las láminas verticales reales (por defecto 7 en Dual y 6 en Estándar)
  const effectiveRenderCount = Math.min(finalSheetCount, rawSheets.length);
  const generatedSheets: ProductVisualLandingSheet[] = [];
  for (let i = 0; i < effectiveRenderCount; i++) {
    const s = rawSheets[i];
    const sanitizedPrompt = sanitizeAndEnforceSalesLetterImagePrompt(
      String(s.imagePrompt || ''),
      i,
      isPrincipalOnly,
      effectiveRenderCount
    );
    const extraVisualContext = [
      sanitizedPrompt,
      !isPrincipalOnly && i === 0 && resolvedEntryVisualBlueprint
        ? `Exact physical entry product geometry held/used naturally by the realistic avatar in real home light: ${resolvedEntryVisualBlueprint}.`
        : '',
      (isPrincipalOnly || i >= 1) && savedPrincipalImg && !savedPrincipalImg.startsWith('/')
        ? `Reference principal product physical appearance: ${input.productName}.`
        : ''
    ]
      .filter(Boolean)
      .join(' ');

    const imgUrl = await generateSingleVisualSheetImage({
      openRouterApiKey: input.openRouterApiKey,
      prompt: extraVisualContext,
      aspectRatio: '2:3',
      filePrefix: `vis_${slugifyProductName(input.productName).slice(0, 18)}_s${i + 1}`,
      referer: input.referer,
      fetchImpl: f
    });

    const defaultRole =
      i === 0
        ? 'hero_presentation'
        : i === 1
          ? 'comparison_need'
          : i === effectiveRenderCount - 1
            ? 'social_trust_specs'
            : i % 2 === 0
              ? 'authority_transformation'
              : 'comparison_need';

    generatedSheets.push({
      id: `sheet_${i + 1}`,
      role: (s.role as any) || defaultRole,
      imageUrl: imgUrl,
      title: String(s.title || `Lámina ${i + 1}`).trim(),
      caption: String(s.caption || '').trim(),
      promptUsed: sanitizedPrompt
    });
  }

  const prodId = `prod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const prodSlug = `${slugifyProductName(input.productName)}-${Math.random().toString(36).slice(2, 5)}`;

  const cleanPublicText = (raw: string) =>
    String(raw || '')
      .replace(/Gs\.\s*Gs\./gi, 'Gs.')
      .replace(/\btripwire\b/gi, isPrincipalOnly ? input.productName.trim() : safeEntryName)
      .trim();

  const resolvedEntryImage = isPrincipalOnly
    ? ''
    : savedEntryImg || generatedSheets[0]?.imageUrl || '';

  const finalSynthesizedEntryDesc = cleanPublicText(
    String(parsed?.researchedEntryDescription || resolvedEntryDesc || safeEntryName)
  );
  const finalSynthesizedProductDesc = cleanPublicText(
    String(parsed?.researchedProductDescription || input.productDescription)
  );

  const tripwireConfig: ProductTripwireOfferConfig | undefined = isPrincipalOnly
    ? undefined
    : {
        enabled: true,
        entryProductName: cleanPublicText(safeEntryName),
        entryProductDescription: finalSynthesizedEntryDesc,
        entryProductImage: resolvedEntryImage,
        entryImageUrl: resolvedEntryImage,
        entryPriceGs: entryPrice,
        ...(entryNormal ? { entryNormalPriceGs: entryNormal } : {}),
        deliveryFeeGs: deliveryFee,
        instantDiscountPercent: instantDiscountPct,
        eventDurationHours,
        slotsTotal,
        backgroundMusicPreset: resolvedAudioPreset,
        sourceUrl: input.entrySourceUrl?.trim() || undefined,
        entryOnlyClarification: `Incluye únicamente 1x ${cleanPublicText(safeEntryName)}. No incluye ${input.productName.trim()} ni envío gratis por separado.`,
        principalBundleClarification: `Incluye ${input.productName.trim()} + ${cleanPublicText(safeEntryName)} DE REGALO + Envío Gratis sin esperar evento.`
      };

  const resolvedWinnerAngle = cleanPublicText(
    cleanAngleInput ||
      String(parsed?.winnerAngleHeadline || '').trim() ||
      `Solución completa superior para ${input.productName.trim()}`
  );

  const parsedIncludedItems = Array.isArray(parsed?.bundleIncludedItems)
    ? parsed.bundleIncludedItems.map((item: any) => cleanPublicText(String(item || ''))).filter(Boolean).slice(0, 5)
    : [];

  const visualLanding: ProductVisualLandingConfig = {
    enabled: true,
    mode:
      finalSheetCount === 7
        ? 'sober_graphic_7sheet'
        : finalSheetCount === 6
          ? 'sober_graphic_6sheet'
          : finalSheetCount === 5
            ? 'sober_graphic_5sheet'
            : finalSheetCount === 4
              ? 'sober_graphic_4sheet'
              : finalSheetCount === 3
                ? 'sober_graphic_3sheet'
                : 'sober_graphic_2sheet',
    generatorModel: VISUAL_CREATOR_IMAGE_MODEL,
    sheets: generatedSheets,
    sobrietyHeadline: cleanPublicText(parsed?.sobrietyHeadline || input.productName),
    subheadline: cleanPublicText(parsed?.subheadline || finalSynthesizedProductDesc),
    winnerAngleHeadline: cleanPublicText(parsed?.winnerAngleHeadline || resolvedWinnerAngle),
    winnerAngleDescription: cleanPublicText(parsed?.winnerAngleDescription || finalSynthesizedProductDesc),
    reversePsychologyHook: isPrincipalOnly ? '' : cleanPublicText(parsed?.reversePsychologyHook || ''),
    entryButtonLabel: isPrincipalOnly
      ? undefined
      : cleanPublicText(parsed?.entryButtonLabel || CTA_IMAGE_BUTTON_LABEL),
    entryButtonColorName: isPrincipalOnly ? undefined : ENTRY_BUTTON_COLOR_NAME,
    entryGuideHeadline: isPrincipalOnly
      ? undefined
      : cleanPublicText(
          parsed?.entryGuideHeadline || `ESTE ES TU ${safeEntryName.toUpperCase()} · PRECIO DE HOY`
        ),
    entryGuideCopy: isPrincipalOnly
      ? undefined
      : cleanPublicText(
          parsed?.entryGuideCopy ||
            `Este es tu ${safeEntryName}. Hoy lo estás llevando por solamente ${formatParaguayGs(entryPrice)}. Para adquirirlo ahora mismo, tocá el botón ${ENTRY_BUTTON_COLOR_NAME} de abajo que dice "¡PEDIR AHORA!": completá tus datos y enviá tu ubicación para recibir tu pedido en casa.`
        ),
    entryDisclaimer: isPrincipalOnly
      ? undefined
      : cleanPublicText(
          parsed?.entryDisclaimer ||
            `Atención: esta solicitud envía únicamente 1x ${safeEntryName}. No incluye ${input.productName} ni envío gratuito.`
        ),
    interruptHeadline: isPrincipalOnly
      ? undefined
      : cleanPublicText(
          parsed?.interruptHeadline || '¿ME REGALÁS UN SEGUNDO ANTES DE LLENAR TUS DATOS?'
        ),
    interruptCopy: isPrincipalOnly
      ? undefined
      : cleanPublicText(
          parsed?.interruptCopy ||
            `Antes de darle clic al botón para cargar tus datos y que empaquetemos tu envío: mirá esto porque va directo con lo que estás por llevar y te puede cambiar por completo la compra.`
        ),
    bundleButtonLabel: cleanPublicText(parsed?.bundleButtonLabel || CTA_IMAGE_BUTTON_LABEL),
    bundleButtonColorName: isPrincipalOnly ? STANDARD_BUTTON_COLOR_NAME : BUNDLE_BUTTON_COLOR_NAME,
    bundleGuideHeadline: cleanPublicText(
      parsed?.bundleGuideHeadline ||
        (isPrincipalOnly
          ? `LLEVATE TU ${input.productName.toUpperCase()} HOY CON ENVÍO GRATIS`
          : `TODO LO QUE TE LLEVÁS HOY ANTES QUE SE AGOTE PARA SIEMPRE`)
    ),
    bundleIncludedItems:
      parsedIncludedItems.length > 0
        ? parsedIncludedItems
        : isPrincipalOnly
          ? [
              `1x ${input.productName.trim()} original completo listo para usar`,
              `ENVÍO GRATUITO directo a tu puerta en todo Paraguay`,
              `Pagás en efectivo o QR recién cuando lo tenés en tus manos`
            ]
          : [
              `1x ${input.productName.trim()} original completo`,
              `1x ${safeEntryName} totalmente GRATIS DE REGALO incluido en tu paquete`,
              `ENVÍO GRATUITO puerta a puerta en todo Paraguay`,
              `Pagás recién al recibir en tus manos (Efectivo o QR) con 7 días de garantía`
            ],
    bundleGuideCopy: cleanPublicText(
      parsed?.bundleGuideCopy ||
        (isPrincipalOnly
          ? `No dejes pasar esta oportunidad hoy: llevás ${input.productName} completo con Envío Gratis hasta tu puerta y pagás recién al recibir. Tocá el botón ${STANDARD_BUTTON_COLOR_NAME} de abajo que dice "¡PEDIR AHORA!" para completar tus datos, enviar tu ubicación por GPS y asegurar el tuyo.`
          : `Pensalo bien antes de irte: si dejás pasar esto hoy, perdés para siempre llevar el ${safeEntryName} totalmente GRATIS y el Envío Gratuito hasta la puerta de tu casa. Tocá ahora mismo el botón ${BUNDLE_BUTTON_COLOR_NAME} de abajo que dice "¡PEDIR AHORA!": completá tus datos, tocá el botón de GPS y recibí tu paquete completo en casa.`)
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
    descripcion: finalSynthesizedProductDesc,
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

  await preRenderOrderFormBannersForProduct(product).catch(() => {});

  return {
    product,
    strategySummary: cleanPublicText(String(parsed?.strategySummary || ''))
  };
}

