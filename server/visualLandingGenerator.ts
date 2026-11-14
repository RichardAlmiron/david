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
  recommendedSheetCount: 2 | 3 | 4;
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
  recommendedSheetCount: 2 | 3 | 4;
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
  sheetCount?: 'auto' | 2 | 3 | 4;
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
  isPrincipalOnly: boolean
): string {
  const cleaned = String(rawPrompt || '')
    .replace(/Gs\.\s*Gs\./gi, 'Gs.')
    .replace(/\btripwire\b/gi, '')
    .replace(/\b(?:360-degree wrap-around|wrap-around|floating 3D|3D glassmorphic|glassmorphic|volumetric light beams|glowing cyan rim light|electric sapphire-cobalt|crimson neon|molten gold|radiant emerald neon|glowing pointer lines)\b/gi, 'clean editorial photography')
    .replace(/\s+/g, ' ')
    .trim();

  const sectionPhotographyDirection = !isPrincipalOnly && sheetIndex === 0
    ? 'AUTHENTIC HIGH-LEVEL COD E-COMMERCE PHOTOGRAPHY (BRIGHT REAL-HOME DAYLIGHT EDITORIAL): Real 50mm DSLR lifestyle photograph featuring a relatable realistic Latin American human avatar holding or naturally using the exact physical product in a genuine bright sunlit home environment (authentic skin texture, real room furniture, natural daylight shadows), framed inside a structured, high-converting light editorial e-commerce layout with crisp typography and clean minimal spec badges.'
    : `AUTHENTIC HIGH-LEVEL COD E-COMMERCE PHOTOGRAPHY SECTION #${isPrincipalOnly ? sheetIndex + 1 : sheetIndex} (REALISTIC HUMAN AVATAR, REAL MOMENTS & REAL ENVIRONMENTS): Real 50mm/85mm DSLR lifestyle and editorial photograph with realistic people in genuine everyday home or outdoor settings living real moments with the product, paired with polished, well-spaced charcoal-slate and warm-ivory e-commerce layout bands, clean feature modules, and authentic material detail — substantial and persuasive with zero clutter.`;

  const antiCartoonAndOrthographyRule =
    'STRICT REALISM & ZERO-CARTOON RULE: Strictly genuine live-action commercial photography ONLY — NEVER cartoon, NEVER illustration, NEVER 3D CGI render, NEVER gamer neon, NEVER floating products in mid-air, NEVER glowing laser beams, NEVER noisy explosion of graphics. STRICT SPANISH ORTHOGRAPHY & ZERO-TYPO RULE: Render ONLY 2 to 3 short, punchy ALL-CAPS Spanish headlines/callouts (strictly 2 to 4 words per text block) in crisp bold geometric sans-serif typography with generous breathing room. NEVER render long sentences, paragraphs, or small body text inside the image. Verify letter-by-letter that every Spanish word is spelled 100% accurately with zero garbled, merged, or misspelled characters.';

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

  const systemPrompt = isPrincipalOnly
    ? `Eres el Estratega Jefe de Conversión Directa (COD Paraguay), Redactor Maestro de Cartas de Venta y Director de Fotografía E-Commerce Realista GPT-2.6 para páginas de PRODUCTO GANADOR ÚNICO (Estándar).
TU MISIÓN: Que el operador trabaje 100% MANOS LIBRES con una CARTA DE VENTA VISUAL E-COMMERCE PROFESIONAL DE ALTO NIVEL dividida en 4 IMÁGENES FOTOGRÁFICAS REALES (con avatares humanos realistas, momentos reales y entornos/lugares reales).
REGLAS ESTRICTAS:
1. Modo ESTÁNDAR (Producto Ganador Único): JAMÁS sugieras artículos secundarios ni menciones "tripwire" en textos públicos. Las 4 secciones combinan fotografía comercial realista DSLR + avatares reales en hogares/lugares cotidianos + diseño editorial e-commerce limpio y sustancioso (ni dibujo animado/neón recargado, ni plano/aburrido): (1. Avatar realista + Gran Promesa en entorno real; 2. Momento real de uso cotidiano resolviendo el problema; 3. Manos reales + detalle macro constructivo con 3 módulos limpios; 4. Cierre COD de entrega real en puerta/mesa + Packs + Envío Gratis + Pago al recibir).
2. CERO ESTÉTICA DE DIBUJO ANIMADO O CGI NEÓN: Prohibido proponer "renders 3D flotantes", "rayos neón", "explosiones gráficas" o "barullo". Todo debe sentirse como una marca COD real seria donde el cliente ve personas reales, lugares reales y el producto físico auténtico.
3. PROHIBIDO EL COPIA Y PEGA: Jamás repitas literalmente las frases crudas del usuario o del proveedor. Redactá ángulos persuasivos de Carta de Venta con psicología real de deseo y transformación.
4. Si existe PÁGINA CLONADA, primero diagnosticá con precisión qué ángulo, promesa y estética visual está usando la página anterior ("currentPageDiagnosis"), y luego proponé 3 opciones CLARAMENTE DISTINTAS.
5. Para cada opción recomendá "recommendedSheetCount": 4 y "recommendedAudioPreset" ('warm_ambient', 'soft_lounge' o 'commercial_pulse'), más "visualDirection" detallando qué tipo de avatar realista, momento real, lugar real y paleta editorial limpia usará GPT-2.6.
6. Precios siempre en Guaraníes ("Gs."). Español paraguayo/rioplatense persuasivo de alto impacto.
7. Si el usuario hace una pregunta o pide un giro específico ("userQuestion"), respondé de forma directa y útil en "assistantReply" y regenerá 3 opciones ajustadas exactamente a lo que pidió.`
    : `Eres el Estratega Jefe de Embudos Duales, Redactor Maestro de Cartas de Venta (Direct-Response Copywriter) y Director de Fotografía E-Commerce COD de Alto Nivel (Paraguay) para páginas TRIPWIRE + PRODUCTO GANADOR EN LA MISMA PÁGINA.
TU MISIÓN: Que el operador trabaje 100% MANOS LIBRES creando una página de 4 IMÁGENES E-COMMERCE DE ALTO NIVEL BASADAS EN FOTOGRAFÍA REALISTA, AVATARES HUMANOS REALES, MOMENTOS REALES Y LUGARES REALES (1 imagen editorial clara para el Artículo de Entrada + 3 imágenes de Carta de Venta en atmósfera sobria contrastante para el Producto Principal).
REGLA VISUAL Y DE CARTA DE VENTA (OBLIGATORIO — 4 LÁMINAS FOTOGRÁFICAS REALISTAS, CERO BARULLO ANIMADO):
1. PROHIBIDO EL DIBUJO ANIMADO, CGI FLOTANTE Y BARULLO NEÓN: El comprador COD desconfía de los pósters cargados de luces neón y renders 3D falsos. Todas las imágenes deben verse como fotografía DSLR real (50mm/85mm) con avatares humanos realistas, entornos reales (sala, cocina, patio, galería, entrada de casa), momentos reales de uso/entrega y diseño editorial limpio y estructurado (ni sobrecargado ni demasiado simple).
2. PROHIBIDO EL COPIA Y PEGA: Jamás copies y pegues en crudo el título o la descripción pegada por el usuario. Creá promesas persuasivas de Carta de Venta real.
3. ARQUITECTURA DE 4 IMÁGENES CON CONTRASTE EDITORIAL LIMPIO Y CREDIBILIDAD COD:
   - IMAGEN 1 (EL ARTÍCULO DE ENTRADA — FOTOGRAFÍA EDITORIAL LUMINOSA EN ENTORNO REAL + AVATAR REALISTA — PALETA CLARA MARFIL / PIEDRA / AZUL MARINO SOBRIO): Dedicada 100% a "${safeEntryName}" (${formatParaguayGs(Number(input.entryPriceGs || 20000))}). Avatar humano realista sosteniendo o usando el producto físico en un ambiente hogareño luminoso real + estructura e-commerce limpia: titular corto, 2-3 módulos minimalistas ordenados, precio único claro e indicación inferior ("Tocá el botón de abajo ↓"). SIN nombrar a "${input.productName}" y SIN hablar de envío.
   - IMÁGENES 2, 3 Y 4 (LAS 3 SECCIONES DE CARTA DE VENTA DEL PRODUCTO PRINCIPAL "${input.productName}" — PALETA EDITORIAL CONTRASTANTE GRAFITO / CARBÓN CÁLIDO / ESMERALDA SOBRIO / MARFIL):
     * IMAGEN 2 (Sección 1 Principal — Ruptura Limpia + Avatar en Momento Real de Transformación): Arriba en banda editorial limpia abre con "¡ESPERÁ UN SEGUNDO!" / "MIRÁ ESTO ANTES", y debajo muestra a un avatar realista en su casa o lugar real viviendo el momento exacto de uso y resultado de "${input.productName}", con titular persuasivo de 3-4 palabras y 2 beneficios limpios bien espaciados.
     * IMAGEN 3 (Sección 2 Principal — Demostración Manos Reales + Entorno Cotidiano + Detalle Macro Real): Muestra manos/persona real operando "${input.productName}" en un espacio real + toma macro fotográfica de sus materiales reales + 3 bloques editoriales limpios (2-3 palabras c/u) con aire visual.
     * IMAGEN 4 (Sección 3 Principal — Cierre COD Confiable en Puerta/Mesa Real + Bono Gratis + ENVÍO GRATUITO): Muestra a un avatar sonriente recibiendo o abriendo en una mesa/entrada real de casa el paquete completo de "${input.productName}" junto a "${safeEntryName}" + insignia clara **${safeEntryName} GRATIS DE REGALO** + banner limpio **ENVÍO GRATUITO EN TODO PARAGUAY** + **PAGO AL RECIBIR** + contraste honesto de delivery e indicación hacia el botón final.
4. REGLA CRÍTICA DE MONEDA Y ORTOGRAFÍA: Nunca dupliques "Gs. Gs." (escribí exactamente "Gs. 189.000"). En las imágenes solo van frases cortas de 2 a 4 palabras en mayúsculas perfectas para garantizar CERO fallas en la escritura.
5. NUNCA uses la palabra "tripwire" ni "gancho trampa" en titulares ni textos orientados al cliente final.
REGLAS ESTRICTAS:
- Si existe PÁGINA CLONADA, primero diagnosticá qué ángulo y estética visual usaba la página original ("currentPageDiagnosis") y proponé 3 opciones frescas distintas.
- Recomendá "recommendedSheetCount": 4 por defecto.
- Si el usuario conversa o pide otro enfoque ("userQuestion"), respondé con claridad ejecutiva en "assistantReply" y entregá 3 opciones nuevas alineadas a su pedido.`;

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

  const userPrompt = `ANALIZÁ ESTE PRODUCTO Y GENERÁ LA ESTRATEGIA DE CARTA DE VENTA VISUAL COD DE ALTO NIVEL (4 IMÁGENES REALISTAS CON AVATARES Y ENTORNOS REALES) 100% MANOS LIBRES:
- Modo seleccionado: ${isPrincipalOnly ? 'Producto Ganador Único (Estándar — 4 Secciones Realistas de Carta de Venta)' : 'Tripwire + Producto Ganador (1 Imagen Realista Luminosa de Entrada + 3 Secciones Realistas Sobrias del Producto Principal)'}
- Producto Principal: ${input.productName}
- Descripción base (NO copiar y pegar literal; transformar en Carta de Venta persuasiva): ${input.productDescription}
- Ángulo borrador ingresado (si existe): ${input.winnerAngle || 'Ninguno aún — proponé los mejores ángulos persuasivos'}
- Precio Principal 1x: ${formatParaguayGs(Number(input.price1Gs || 189000))} (Normal: ${formatParaguayGs(Number(input.normalPriceGs || 249000))})
${
  !isPrincipalOnly
    ? `- Artículo de Entrada (Imagen 1 Realista en Entorno Luminoso): ${safeEntryName}
- Descripción entrada: ${input.entryProductDescription || safeEntryName}
- Precio Entrada: ${formatParaguayGs(Number(input.entryPriceGs || 20000))} (sin mencionar envío en Imagen 1; delivery ${formatParaguayGs(Number(input.entryDeliveryFeeGs || 40000))} contrastado en el cierre de la Carta de Venta Principal)`
    : ''
}${cloneContextBlock}${historyText}
${input.userQuestion ? `\nPREGUNTA O INSTRUCCIÓN ACTUAL DEL OPERADOR: "${input.userQuestion}"` : '\nGENERÁ EL DIAGNÓSTICO INICIAL Y LAS 3 MEJORES OPCIONES DE CARTA DE VENTA REALISTA LISTAS PARA 1 CLIC.'}

Devolvé EXCLUSIVAMENTE este JSON válido:
{
  "currentPageDiagnosis": "${cloneCtx?.sourceProductName ? 'Explicación clara de qué ángulo, promesa y estilo visual usa actualmente la página clonada, para superarlo con una Carta de Venta nueva realista.' : 'Diagnóstico breve de cómo estructuraremos esta Carta de Venta fotográfica realista de 4 imágenes con avatares, momentos y lugares reales en Paraguay.'}",
  "assistantReply": "Respuesta directa y clara al operador (2-3 oraciones) explicando por qué la Opción 1 es la recomendación principal o respondiendo a su pregunta.",
  "recommendedSheetCount": 4,
  "recommendedAudioPreset": "warm_ambient",
  "recommendedOptionId": "opt_1",
  "options": [
    {
      "id": "opt_1",
      "title": "Nombre corto del ángulo persuasivo (máx 6 palabras)",
      "archetype": "Recomendada por IA",
      "winnerAngle": "Promesa persuasiva de Carta de Venta lista para convertir (máx 12 palabras, cero copia-pega)",
      "visualDirection": "Fotografía DSLR real con avatar humano latinoamericano, momento real de uso y entorno hogareño/cotidiano auténtico + diseño editorial limpio sin barullo para las 4 láminas en GPT-2.6",
      "recommendedSheetCount": 4,
      "recommendedAudioPreset": "warm_ambient",
      "whyItConverts": "Por qué esta Carta de Venta realista de 4 secciones genera confianza COD inmediata.",
      "tripwireBridgeNote": "${isPrincipalOnly ? '' : 'Cómo la Imagen 1 luminosa con avatar real captura la atención y las Imágenes 2, 3 y 4 muestran personas y momentos reales con el Producto Principal.'}"
    },
    {
      "id": "opt_2",
      "title": "Segundo enfoque de Carta de Venta",
      "archetype": "Deseo y Transformación",
      "winnerAngle": "...",
      "visualDirection": "...",
      "recommendedSheetCount": 4,
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
      "recommendedSheetCount": 4,
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

  const normalizeSheetCount = (val: any, fallback: 2 | 3 | 4 = 4): 2 | 3 | 4 => {
    const n = Number(val);
    return n === 2 || n === 3 || n === 4 ? n : fallback;
  };

  const rawOptions: any[] = Array.isArray(parsed?.options) ? parsed.options : [];
  const options: QuickCreatorAngleOption[] = rawOptions.slice(0, 4).map((o, idx) => ({
    id: String(o?.id || `opt_${idx + 1}`),
    title: String(o?.title || `Estrategia ${idx + 1}`).trim(),
    archetype: String(o?.archetype || (idx === 0 ? 'Recomendada por IA' : `Enfoque ${idx + 1}`)).trim(),
    winnerAngle: String(o?.winnerAngle || input.winnerAngle || input.productName).trim(),
    visualDirection: String(o?.visualDirection || '').trim(),
    recommendedSheetCount: normalizeSheetCount(o?.recommendedSheetCount, 4),
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
      4
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
  const sheetCountMode: 'auto' | 2 | 3 | 4 =
    input.sheetCount === 2 ? 2 : input.sheetCount === 3 ? 3 : input.sheetCount === 4 ? 4 : 'auto';
  const requestedSheetCount: 2 | 3 | 4 =
    sheetCountMode === 'auto' ? 4 : sheetCountMode;
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
    ? `Eres el Redactor Maestro de Cartas de Venta de Respuesta Directa (COD Paraguay) y Director de Fotografía E-Commerce de Alto Nivel.
Diseñas páginas gráficas verticales 100% visuales estructuradas como una CARTA DE VENTA VISUAL DE 4 SECCIONES E-COMMERCE PROFESIONAL para UN ÚNICO PRODUCTO GANADOR.

REGLA DE ORO VISUAL (REALISMO COD CON AVATARES, MOMENTOS Y LUGARES REALES — CERO DIBUJO ANIMADO, CERO BARULLO):
- FOTOGRAFÍA COMERCIAL REALISTA + AVATARES HUMANOS REALES: El comprador contra entrega confía cuando ve personas reales (avatares realistas latinoamericanos/paraguayos), momentos reales de uso/entrega y entornos reales (sala, patio, cocina, escritorio, entrada de casa).
- EQUILIBRIO EDITORIAL DE ALTO NIVEL (NI BARULLO NI DEMASIADO SIMPLE): Cada lámina debe combinar una fotografía DSLR (50mm/85mm) nítida y auténtica con un diseño e-commerce bien estructurado y profesional: bandas tipográficas limpias con contraste legítimo, 2 a 3 módulos ordenados de beneficios o especificaciones con aire visual, y jerarquía comercial seria digna de marca top mundial.
- PROHIBIDO EL ESTILO ANIMADO / CGI NEÓN: Prohibido pedir "render 3D flotante", "rayos de luz neón", "cápsulas 3D brillantes", "explosiones visuales" o "dibujos animados". Todo producto debe respetar gravedad física, contacto real sobre superficies o en manos reales, piel natural y luz creíble.

REGLA INQUEBRANTABLE ANTI COPIA-PEGA Y DE ORTOGRAFÍA PERFECTA EN GPT-2.6:
- PROHIBIDO COPIAR Y PEGAR: Jamás copies y pegues en crudo el nombre largo o la descripción del usuario dentro de la imagen. Creá titulares persuasivos de Carta de Venta que despierten deseo inmediato.
- CERO FALLAS EN LA ESCRITURA: Dentro de cada "imagePrompt", exigí que el texto impreso en la imagen consista ÚNICAMENTE en 2 a 3 frases ultra cortas en MAYÚSCULAS SÓLIDAS (de 2 a 4 palabras máximo por línea, ej. "POTENCIA REAL EN CASA", "ENVÍO GRATIS PARAGUAY", "PAGÁS AL RECIBIR"). Prohibido incluir párrafos o frases largas que deformen las letras.
- Precios obligatorios en Guaraníes de Paraguay ("Gs."), jamás duplicar "Gs. Gs." y jamás mencionar la palabra "tripwire".${visualDirectionBlock}${cloneDirectiveBlock}`
    : `Eres el Redactor Maestro de Cartas de Venta (Direct-Response Sales Letter Copywriter) y Director de Fotografía E-Commerce COD de Alto Nivel en Paraguay.
REGLA MAESTRA DE COMPOSICIÓN Y CARTA DE VENTA REALISTA PARA openai/gpt-image-2.6-sunburst (VERTICAL 2:3 — 4 IMÁGENES GENERADAS):
- PROHIBIDO EL DIBUJO ANIMADO, CGI FLOTANTE Y BARULLO DESESPERANTE: El cliente COD quiere ver un producto verdadero en manos de personas reales (avatares realistas), momentos reales y entornos/lugares reales — con diseño e-commerce editorial estructurado y sustancioso (no demasiado simple ni vacío, pero 100% libre de explosiones neón, renders 3D falsos o saturación caótica).
- PROHIBIDO EL COPIA Y PEGA: Jamás copies textualmente el borrador crudo del usuario. Toda la página funciona como una CARTA DE VENTA VISUAL DE ALTO NIVEL dividida en 4 IMÁGENES FOTOGRÁFICAS REALES:
  1. IMAGEN 1 (ARTÍCULO DE ENTRADA — FOTOGRAFÍA EDITORIAL LUMINOSA EN ENTORNO REAL CON AVATAR REALISTA — PALETA CLARA MARFIL / PIEDRA / AZUL MARINO SOBRIO):
     - Centrada 100% en "${safeEntryName}": fotografía DSLR 50mm real con un avatar humano latinoamericano realista (sonrisa natural, vestimenta casual cotidiana) sosteniendo o usando "${safeEntryName}" en un espacio real luminoso de hogar/oficina (luz natural de ventana, sombras físicas reales, cero neón).
     - Diseño e-commerce rico y limpio (no simple): banda superior limpia con titular magnético corto en mayúsculas (3-4 palabras), 2-3 módulos minimalistas ordenados con beneficios reales de 2-3 palabras, sello limpio de precio único (${formatParaguayGs(entryPrice)}) e indicación discreta al pie: "Tocá el botón de abajo ↓". PROHIBIDO mencionar a "${input.productName}" y PROHIBIDO hablar de envío.
  2. IMÁGENES 2, 3 Y 4 (LAS 3 SECCIONES DE CARTA DE VENTA EXCLUSIVAS DEL PRODUCTO PRINCIPAL "${input.productName}" — CONTRASTE EDITORIAL SOBRIO EN GRAFITO MATE / CARBÓN CÁLIDO / MARFIL / ESMERALDA SERIO):
     - IMAGEN 2 (SECCIÓN 1 DEL PRODUCTO PRINCIPAL — RUPTURA LIMPIA + AVATAR EN MOMENTO REAL DE TRANSFORMACIÓN): Cambio claro de atmósfera luminosa a tonos editoriales grafito mate, acento borgoña/ámbar sobrio y marfil (sin neón ni ruido visual). Arriba en banda editorial nítida abre con "¡ESPERÁ UN SEGUNDO!" / "MIRÁ ESTO ANTES", y debajo muestra a un avatar realista (persona o pareja paraguaya/latinoamericana real) viviendo el momento real de uso y resultado de "${input.productName}" en un entorno real auténtico (living, patio, cocina o habitación real), con titular persuasivo de 3-4 palabras y 2 módulos de beneficios limpios.
     - IMAGEN 3 (SECCIÓN 2 DEL PRODUCTO PRINCIPAL — DEMOSTRACIÓN EN USO REAL + MANOS REALES + CALIDAD CONSTRUCTIVA): Composición editorial estructurada de alto nivel: escena real de persona/manos operando "${input.productName}" en su lugar cotidiano + fotografía macro real de sus materiales y terminaciones físicas apoyadas en superficie real + 3 módulos sobrios de prueba técnica (2-3 palabras cada uno) con aire visual.
     - IMAGEN 4 (SECCIÓN 3 DEL PRODUCTO PRINCIPAL — CIERRE COD DE CONFIANZA EN CASA/PUERTA REAL + REGALO GRATIS + ENVÍO GRATUITO): Clímax realista de confianza COD: muestra a un avatar realista sonriente en la entrada o mesa real de su hogar recibiendo/abriendo el conjunto completo de "${input.productName}" junto a "${safeEntryName}" apoyados físicamente en una mesa real + insignia limpia **"${safeEntryName.toUpperCase()} DE REGALO"** + banner esmeralda/marfil serio **"ENVÍO GRATUITO EN TODO PARAGUAY"** + **"PAGO AL RECIBIR"** + precio claro (${formatParaguayGs(price1)}), nota transparente corta de delivery suelto (${formatParaguayGs(deliveryFee)}) e indicación inferior: "Dale clic al botón de abajo ↓".

REGLA INQUEBRANTABLE CONTRA FALLAS DE ESCRITURA EN GPT-2.6:
- TEXTOS ULTRA CORTOS Y EN MAYÚSCULAS EXACTAS: Para evitar cualquier falla en la escritura, cada frase a renderizar dentro de "imagePrompt" debe tener MÁXIMO 2 A 4 PALABRAS en MAYÚSCULAS SÓLIDAS entre comillas. Prohibido meter oraciones largas o párrafos dentro del arte.
- MONEDA EXACTA PARAGUAY: Escribí los precios exactamente como se te entregan (ej. "Gs. 189.000"). PROHIBIDO repetir "Gs. Gs." ni usar "$"/USD.
- JAMÁS escribas la palabra "tripwire" ni "gancho trampa".${visualDirectionBlock}${cloneDirectiveBlock}`;

  const promptUserContent = isPrincipalOnly
    ? `PRODUCTO GANADOR ÚNICO (CARTA DE VENTA VISUAL COD DE ALTO NIVEL EN ${requestedSheetCount} SECCIONES FOTOGRÁFICAS REALES CON AVATARES Y ENTORNOS REALES):
- Nombre: ${input.productName}
- Enfoque / ángulo principal: ${cleanAngleInput || input.productDescription}
- Qué hace / descripción base (transformar en copy persuasivo, NO copiar literal): ${input.productDescription}
- Precio Normal tachado: ${formatParaguayGs(normalPrice)}
- Precio 1x: ${formatParaguayGs(price1)} (Pack 2x: ${formatParaguayGs(price2)}, Pack 3x: ${formatParaguayGs(price3)})
- Envío Producto Principal: ENVÍO GRATIS en todo Paraguay + Pago en mano al recibir.
${visualDirectionInput ? `- Dirección visual asignada: ${visualDirectionInput}` : ''}

CANTIDAD DE LÁMINAS A DISEÑAR: ${requestedSheetCount} secciones diferentes de Carta de Venta E-Commerce realista de alto nivel (cero dibujo animado, cero neón).

Devuelve EXCLUSIVAMENTE este JSON válido:
{
  "strategySummary": "Explicación breve interna del arco persuasivo de Carta de Venta realista en ${requestedSheetCount} secciones.",
  "recommendedAudioPreset": "warm_ambient",
  "researchedProductDescription": "Ficha comercial persuasiva redactada desde cero en español (NUNCA copia-pega literal del borrador del usuario).",
  "sobrietyHeadline": "Titular persuasivo de Carta de Venta de alto impacto (máx 9 palabras).",
  "subheadline": "Bajada persuasiva explicando la transformación real en la vida del cliente en Paraguay (máx 20 palabras).",
  "winnerAngleHeadline": "Gran promesa central del producto principal (máx 10 palabras).",
  "winnerAngleDescription": "Argumento persuasivo de beneficios reales del producto principal (máx 30 palabras).",
  "bundleButtonLabel": "Solicitar ahora · ${formatParaguayGs(price1)}",
  "bundleDisclaimer": "Incluye ${input.productName} original + Envío GRATIS en Paraguay + Pago contra entrega en efectivo o QR.",
  "sheetPrompts": [
    {
      "role": "hero_presentation",
      "title": "Sección 1 · Avatar Real y Gran Promesa",
      "caption": "Apertura de Carta de Venta en entorno real",
      "imagePrompt": "High-converting 2:3 vertical real-life COD e-commerce editorial photograph for openai/gpt-image-2.6-sunburst: shot on 50mm DSLR, realistic Latin American human avatar naturally holding or demonstrating ${input.productName} (${cleanAngleInput || 'resultado real en casa'}) inside an authentic modern home setting (${visualDirectionInput || 'natural warm daylight, real interior textures, clean matte editorial framing'}), crisp bold ALL-CAPS Spanish headline (3-4 persuasive words, zero typos), 2-3 sleek minimal benefit pills (2-3 words each), clear price '${formatParaguayGs(price1)}' (never duplicate 'Gs.'), zero cartoon/CGI/neon, full-bleed edge-to-edge 2:3."
    },
    {
      "role": "comparison_need",
      "title": "Sección 2 · Momento Real de Uso y Transformación",
      "caption": "Personas y momentos cotidianos reales",
      "imagePrompt": "High-level 2:3 vertical real-world lifestyle COD e-commerce visual sales letter section 2 for openai/gpt-image-2.6-sunburst: candid 50mm DSLR photograph of a realistic person or family experiencing a genuine everyday moment using ${input.productName} in a real Paraguayan home room/patio with authentic natural lighting and physical realism, clean editorial top ALL-CAPS Spanish headline (max 4 words, 100% exact spelling), 2 structured clean callout strips (2-3 words each) showing real transformation, zero CGI/neon clutter, full-bleed 2:3."
    }${
      requestedSheetCount >= 3
        ? `,
    {
      "role": "authority_transformation",
      "title": "Sección 3 · Manos Reales y Calidad Constructiva",
      "caption": "Uso tangible y detalle fotográfico real",
      "imagePrompt": "Editorial 2:3 vertical e-commerce proof section 3 for openai/gpt-image-2.6-sunburst: clean split real photography layout showing real human hands operating ${input.productName} in an authentic real place paired with a sharp 85mm macro DSLR close-up of its genuine physical build quality resting on a real table surface, crisp ALL-CAPS Spanish authority headline (max 4 words, zero typos), 3 structured clean matte-slate feature modules with 2-to-3-word uppercase labels, zero 3D render/neon, full-bleed 2:3."
    }`
        : ''
    }${
      requestedSheetCount >= 4
        ? `,
    {
      "role": "social_trust_specs",
      "title": "Sección 4 · Entrega Real COD y Envío Gratis",
      "caption": "Cierre de Carta de Venta en hogar real",
      "imagePrompt": "Trust-building 2:3 vertical COD e-commerce closing photograph (Section 4) for openai/gpt-image-2.6-sunburst: realistic smiling buyer at home doorway or dining table unboxing the complete physical ${input.productName} package in real warm natural light, crisp emerald-and-ivory editorial trust banner 'ENVÍO GRATIS EN PARAGUAY' + 'PAGO AL RECIBIR', clear pack pricing 1x '${formatParaguayGs(price1)}' vs 2x '${formatParaguayGs(price2)}' (never write 'Gs. Gs.'), 'GARANTÍA 7 DÍAS', and clean bottom cue 'Dale clic al botón de abajo'. Crisp ALL-CAPS Spanish lettering, zero cartoon/neon clutter, full-bleed 2:3."
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
    : `CARTA DE VENTA VISUAL EN ${requestedSheetCount} IMÁGENES FOTOGRÁFICAS REALES DE ALTO NIVEL COD (IMAGEN 1 = ENTRADA EN ENTORNO REAL LUMINOSO CON AVATAR REALISTA; IMÁGENES 2, 3 Y 4 = 3 SECCIONES REALISTAS CONTRASTANTES DEL PRODUCTO PRINCIPAL CON AVATARES, MOMENTOS Y LUGARES REALES):

PRODUCTO PRINCIPAL EXCLUSIVO (IMÁGENES 2, 3 Y 4 — 3 SECCIONES DE CARTA DE VENTA E-COMMERCE REALISTA SIN BARULLO):
- Nombre: ${input.productName}
- Ángulo persuasivo central: ${cleanAngleInput || `Solución definitiva completa muy superior al artículo inicial (${input.productDescription})`}
- Información base (PROHIBIDO COPIAR Y PEGAR LITERAL; redactar como Carta de Venta persuasiva): ${input.productDescription}
- Precio Normal tachado: ${formatParaguayGs(normalPrice)}
- Precio 1x: ${formatParaguayGs(price1)} (Pack 2x: ${formatParaguayGs(price2)}, Pack 3x: ${formatParaguayGs(price3)})
- Beneficio estrella en Cierre: ENVÍO GRATUITO EN TODO PARAGUAY + ${safeEntryName} GRATIS DE REGALO + Pago al recibir.
${visualDirectionInput ? `- Dirección visual asignada para el Producto Principal: ${visualDirectionInput}` : ''}

ARTÍCULO DE ENTRADA (IMAGEN 1 — FOTOGRAFÍA REAL EN HOGAR LUMINOSO CON AVATAR REALISTA):
- Nombre real investigado: ${safeEntryName}
- Síntesis investigada (NO copiar textos en crudo): ${resolvedEntryDesc || safeEntryName}
${resolvedEntrySpecs.length > 0 ? `- Especificaciones reales clave: ${resolvedEntrySpecs.join(' | ')}` : ''}
${resolvedEntryVisualBlueprint ? `- Blueprint visual exacto del producto físico real en Imagen 1: ${resolvedEntryVisualBlueprint}` : ''}
- Precio ÚNICO cerrado (1 unidad): ${formatParaguayGs(entryPrice)} (En Imagen 1 está PROHIBIDO mencionar a "${input.productName}" y PROHIBIDO hablar de envío. Imagen 1 debe mostrar fotografía DSLR realista con un avatar humano real sosteniendo o usando "${safeEntryName}" en un ambiente claro y luminoso real — paleta marfil/piedra/azul marino sobrio, diseño editorial limpio pero estructurado, CERO neón y CERO dibujo animado).

CANTIDAD DE IMÁGENES A GENERAR: ${requestedSheetCount} (${
        requestedSheetCount === 4
          ? 'Imagen 1 = Entrada Fotografía Real Luminosa con Avatar; Imagen 2 = Sección 1 Producto Principal: Ruptura limpia ¡ESPERÁ! + Avatar en Momento Real; Imagen 3 = Sección 2 Producto Principal: Demostración con Manos/Entorno Real + Detalle Macro Real; Imagen 4 = Sección 3 Producto Principal: Cierre COD en Hogar/Puerta Real + Regalo Gratis + ENVÍO GRATUITO'
          : requestedSheetCount === 3
            ? 'Imagen 1 = Entrada Realista Luminosa con Avatar; Imagen 2 = Sección 1 Principal Ruptura Limpia + Momento Real; Imagen 3 = Sección 2 Principal Cierre COD + Regalo + Envío Gratuito'
            : 'Imagen 1 = Entrada Realista Luminosa con Avatar; Imagen 2 = Carta de Venta Principal Realista con Ruptura + Envío Gratuito'
      })

Devuelve EXCLUSIVAMENTE este JSON válido:
{
  "strategySummary": "Explicación breve interna de la Carta de Venta realista de ${requestedSheetCount} imágenes (Imagen 1 clara con avatar real + ${Math.max(1, requestedSheetCount - 1)} secciones sobrias con avatares y entornos reales del Producto Principal).",
  "recommendedAudioPreset": "warm_ambient",
  "researchedProductDescription": "Carta de venta sintetizada, persuasiva y redactada desde cero en español para ${input.productName} (cero copia-pega crudo).",
  "researchedEntryDescription": "Ficha comercial atractiva de ${safeEntryName} redactada desde cero (cero copia-pega crudo).",
  "sobrietyHeadline": "Titular magnético de alto impacto para ${safeEntryName} (máx 6 palabras).",
  "subheadline": "Beneficio directo en la vida diaria de ${safeEntryName} (máx 14 palabras).",
  "winnerAngleHeadline": "Gran titular persuasivo de Carta de Venta para ${input.productName} (máx 10 palabras, cero copia-pega).",
  "winnerAngleDescription": "Argumento persuasivo contundente que demuestra por qué ${input.productName} es la solución definitiva (máx 28 palabras).",
  "reversePsychologyHook": "¡Esperá un segundo! Llevando ${input.productName} recibís ${safeEntryName} GRATIS y activás Envío Gratuito en todo Paraguay.",
  "entryButtonLabel": "Separar ahora · ${formatParaguayGs(entryPrice)}",
  "entryDisclaimer": "Solo incluye 1x ${safeEntryName}. NO incluye ${input.productName} ni envío gratuito.",
  "bundleButtonLabel": "Solicitar oferta completa · ${formatParaguayGs(price1)}",
  "bundleDisclaimer": "Incluye ${input.productName} completo + ${safeEntryName} DE REGALO + ENVÍO GRATUITO en todo Paraguay.",
  "sheetPrompts": [
    {
      "role": "hero_presentation",
      "title": "Lámina 1 · ${safeEntryName} (Avatar y Entorno Real)",
      "caption": "Presentación Realista Editorial COD",
      "imagePrompt": "High-level 2:3 vertical realistic COD e-commerce lifestyle photograph for openai/gpt-image-2.6-sunburst in crisp Paraguayan Spanish (bright sunlit real home aesthetic — warm ivory, soft limestone & deep navy accents, COMPLETELY DIFFERENT bright clean daylight palette from the darker editorial sheets below): TOP ZONE clean subtle editorial header with bold 3-to-4-word ALL-CAPS Spanish hook headline for '${safeEntryName}' (zero copy-paste clutter); CENTER HERO candid 50mm DSLR photograph of a relatable realistic Latin American human avatar naturally holding or using ONLY the real physical '${safeEntryName}'${resolvedEntryVisualBlueprint ? ` (${resolvedEntryVisualBlueprint})` : ''} inside a genuine sunlit home room/table setting (real natural skin, real physical gravity, authentic daylight shadows, ZERO CGI/cartoon/neon); LOWER-MID ZONE 3 neat, minimal flat editorial spec pills with 2-to-3-word uppercase Spanish benefit labels (${resolvedEntrySpecs.slice(0, 3).join(' / ') || 'USO PRÁCTICO / CALIDAD REAL / LISTO PARA USAR'}); BOTTOM ZONE crisp clean price badge '${formatParaguayGs(entryPrice)}' and subtle directional cue 'Tocá el botón de abajo'. NEVER write 'Gs. Gs.', DO NOT mention '${input.productName}', DO NOT mention shipping. Full-bleed edge-to-edge 2:3."
    }${
      requestedSheetCount === 4
        ? `,
    {
      "role": "comparison_need",
      "title": "Lámina 2 · Sección 1 Producto Principal: ¡Esperá! Momento Real",
      "caption": "Ruptura editorial limpia + Avatar en momento real",
      "imagePrompt": "High-converting 2:3 vertical realistic COD e-commerce Visual Sales Letter Section 1 exclusively for '${input.productName}' for openai/gpt-image-2.6-sunburst — COMPLETELY DIFFERENT rich matte charcoal-slate, warm espresso & refined ivory-amber editorial palette (zero neon chaos): TOP 16% clean sharp pattern-interrupt editorial bar integrated inside the layout with flawless ALL-CAPS Spanish text '¡ESPERÁ UN SEGUNDO!' + short 3-word sub-hook 'MIRÁ ESTO ANTES'; CENTER-BOTTOM 84% authentic 50mm DSLR lifestyle photograph of a realistic Paraguayan/Latin American person or couple in a genuine real home/outdoor environment experiencing a real everyday moment of relief and satisfaction using '${input.productName}', paired with a bold clean 3-to-4-word ALL-CAPS persuasive Spanish headline (zero typos) and 2 structured dark-matte benefit callouts with ample breathing room. Zero cartoon, zero floating CGI, full-bleed edge-to-edge 2:3."
    },
    {
      "role": "authority_transformation",
      "title": "Lámina 3 · Sección 2 Producto Principal: Uso y Lugar Real",
      "caption": "Demostración real con manos y detalle macro",
      "imagePrompt": "Polished 2:3 vertical realistic COD e-commerce Visual Sales Letter Section 2 exclusively for '${input.productName}' for openai/gpt-image-2.6-sunburst — warm dark charcoal, brushed bronze & clean ivory editorial aesthetic: TOP bold 3-to-4-word ALL-CAPS persuasive Spanish headline on how '${input.productName}' works in real life; CENTER split real-world photography showing real human hands operating '${input.productName}' in an authentic everyday location alongside an 85mm macro DSLR close-up of its genuine physical build and materials resting on a real surface; LOWER 3 crisp, well-spaced matte editorial proof strips with 2-to-3-word ALL-CAPS Spanish benefit labels (flawless orthography, zero 3D cartoon badges, zero small clutter). Full-bleed edge-to-edge 2:3."
    },
    {
      "role": "social_trust_specs",
      "title": "Lámina 4 · Sección 3 Producto Principal: Cierre COD en Casa Real",
      "caption": "Entrega real, regalo incluido y envío gratuito",
      "imagePrompt": "High-trust 2:3 vertical COD e-commerce Visual Sales Letter Section 3 exclusively for '${input.productName}' for openai/gpt-image-2.6-sunburst — deep warm slate, natural emerald-green trust seal & crisp ivory aesthetic: TOP clean ALL-CAPS Spanish closing headline 'OFERTA COMPLETA EXCLUSIVA'; CENTER authentic 50mm DSLR photograph of a realistic smiling buyer in a genuine home living room or doorway holding/unboxing the real physical '${input.productName}' alongside '${safeEntryName}' together on a real wooden/stone table + clean gold-ivory badge 'LLEVÁS ${safeEntryName.toUpperCase()} GRATIS'; LOWER unmissable clean emerald-and-ivory trust banner 'ENVÍO GRATUITO EN TODO PARAGUAY' + 'PAGO AL RECIBIR' + bold price '${formatParaguayGs(price1)}' (write ONCE, never 'Gs. Gs.') + transparent note 'Solo artículo suelto: delivery ${formatParaguayGs(deliveryFee)}'; BOTTOM clean cue 'Dale clic al botón de abajo'. 100% flawless uppercase Spanish spelling, zero cartoon/CGI/neon clutter, full-bleed edge-to-edge 2:3."
    }`
        : requestedSheetCount === 3
          ? `,
    {
      "role": "comparison_need",
      "title": "Lámina 2 · ¡ESPERÁ UN SEGUNDO! Momento Real Principal",
      "caption": "Ruptura limpia + Avatar en entorno real",
      "imagePrompt": "High-converting 2:3 vertical realistic COD e-commerce Visual Sales Letter Section 1 for '${input.productName}' for openai/gpt-image-2.6-sunburst — COMPLETELY DIFFERENT rich matte charcoal & warm ivory palette from Sheet 1: TOP clean editorial alert bar '¡ESPERÁ UN SEGUNDO!', authentic 50mm DSLR photograph of a realistic person using '${input.productName}' in a real home environment with a short 3-to-4-word ALL-CAPS persuasive Spanish headline and 3 clean flat spec callouts, razor-sharp flawless Spanish typography, zero cartoon/CGI, edge-to-edge 2:3."
    },
    {
      "role": "social_trust_specs",
      "title": "Lámina 3 · Cierre COD Real: ${input.productName} + ${safeEntryName} GRATIS",
      "caption": "Entrega real en hogar con Envío Gratuito",
      "imagePrompt": "High-trust 2:3 vertical COD e-commerce conversion photograph for openai/gpt-image-2.6-sunburst in razor-sharp ALL-CAPS Paraguayan Spanish — COMPLETELY DIFFERENT matte charcoal, natural emerald & warm ivory aesthetic from Sheet 1: crisp 3-to-4-word Spanish headline for '${input.productName}', authentic 50mm DSLR photo of a realistic smiling homeowner unboxing '${input.productName}' with '${safeEntryName}' on a real home table, 3 clean minimal feature pills, clear emerald-ivory banner 'ENVÍO GRATUITO EN TODO PARAGUAY' + '${safeEntryName} DE REGALO', clear price '${formatParaguayGs(price1)}' (write ONCE, never 'Gs. Gs.'), transparent note 'Solo ${safeEntryName} paga delivery ${formatParaguayGs(deliveryFee)}', and bottom cue 'Dale clic al botón de abajo'. Zero cartoon/neon, edge-to-edge 2:3."
    }`
          : `,
    {
      "role": "social_trust_specs",
      "title": "¡ESPERÁ! ${input.productName} + ${safeEntryName} GRATIS + ENVÍO GRATUITO",
      "caption": "Ruptura limpia + Avatar y entrega real COD",
      "imagePrompt": "High-trust 2:3 vertical COD e-commerce conversion photograph for openai/gpt-image-2.6-sunburst in razor-sharp Paraguayan Spanish — COMPLETELY DIFFERENT matte charcoal, warm ivory & natural emerald aesthetic from Sheet 1: TOP 16% crisp pattern-interrupt editorial bar '¡ESPERÁ UN RATITO!' + 'MIRÁ LA OFERTA COMPLETA'; MIDDLE 58% authentic 50mm DSLR photograph of a realistic person naturally using '${input.productName}' in a real home setting with clean bold 3-to-4-word ALL-CAPS Spanish headline and 3 clean flat feature strips; LOWER 18% clean emerald-ivory offer bar 'ENVÍO GRATUITO EN TODO PARAGUAY' + 'LLEVÁS ${safeEntryName.toUpperCase()} DE REGALO' + clean price '${formatParaguayGs(price1)}' (never write 'Gs. Gs.') + transparent delivery note 'Solo ${safeEntryName}: delivery ${formatParaguayGs(deliveryFee)}'; BOTTOM 8% clean cue 'Dale clic al botón de abajo'. Ultra-crisp legible Spanish typography, zero cartoon/CGI/neon, full-bleed edge-to-edge 2:3."
    }`
    }
  ],
  "faq": [
    { "q": "Pregunta clave 1 sobre qué incluye cada opción", "a": "Respuesta transparente en guaraníes sin jerga" },
    { "q": "Pregunta clave 2 sobre el pago al recibir y entrega", "a": "Respuesta clara Paraguay" },
    { "q": "Pregunta clave 3 sobre garantía y uso real", "a": "Respuesta honesta" }
  ],
  "agentContext": "Resumen completo para el agente WhatsApp y de Comentarios con precios exactos en Gs., qué incluye la caja y la regla de las dos opciones (sin decir nunca tripwire)."
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

  // Si se pidieron explícitamente 4 láminas (o GPT-4o devolvió menos de 4 cuando sheetCount === 4), completar las 3 secciones del Producto Principal
  if (sheetCountMode === 4 && rawSheets.length < 4) {
    const fallbackPrincipalSections = isPrincipalOnly
      ? [
          {
            role: 'comparison_need',
            title: `Sección 2 · Momento Real de Uso de ${input.productName}`,
            caption: 'Uso cotidiano en entorno real',
            imagePrompt: `Realistic 2:3 vertical COD e-commerce lifestyle photograph section 2 for '${input.productName}': candid 50mm DSLR scene of a realistic person using '${input.productName}' in an authentic home room, bold 3-word ALL-CAPS Spanish headline 'RESULTADO REAL HOY', 3 clean minimal benefit strips with 2-word uppercase labels, full-bleed 2:3.`
          },
          {
            role: 'authority_transformation',
            title: `Sección 3 · Manos Reales y Calidad de ${input.productName}`,
            caption: 'Detalles materiales reales al tacto',
            imagePrompt: `Realistic 2:3 vertical COD e-commerce editorial photograph section 3 for '${input.productName}': real human hands holding/operating '${input.productName}' plus 85mm macro close-up of real build materials on a wooden table, bold 3-word ALL-CAPS Spanish headline 'CALIDAD SUPERIOR REAL', 3 clean matte spec strips, full-bleed 2:3.`
          },
          {
            role: 'social_trust_specs',
            title: `Sección 4 · Entrega Real COD con Envío Gratis`,
            caption: 'Cierre de Carta de Venta en hogar real',
            imagePrompt: `Trust-building 2:3 vertical COD e-commerce closing photograph for '${input.productName}': realistic smiling buyer unboxing '${input.productName}' on a real home table, clean emerald-ivory banner 'ENVÍO GRATUITO EN TODO PARAGUAY' + 'PAGO AL RECIBIR', price '${formatParaguayGs(price1)}', bottom cue 'Dale clic al botón de abajo', full-bleed 2:3.`
          }
        ]
      : [
          {
            role: 'comparison_need',
            title: `Lámina 2 · Sección 1 Principal: ¡Esperá un Segundo!`,
            caption: 'Ruptura editorial limpia + Avatar en momento real',
            imagePrompt: `Realistic 2:3 vertical COD e-commerce Visual Sales Letter Section 1 for '${input.productName}' in matte charcoal, warm espresso & ivory: clean top bar '¡ESPERÁ UN SEGUNDO!', authentic 50mm DSLR lifestyle photo of a realistic Latin American person experiencing '${input.productName}' in a real home setting with bold 3-word ALL-CAPS Spanish headline 'SOLUCIÓN DEFINITIVA REAL', full-bleed 2:3.`
          },
          {
            role: 'authority_transformation',
            title: `Lámina 3 · Sección 2 Principal: Uso en Lugar Real`,
            caption: 'Demostración tangible con manos reales y macro',
            imagePrompt: `Polished 2:3 vertical COD e-commerce Visual Sales Letter Section 2 exclusively for '${input.productName}' in matte slate & warm ivory: real human hands operating '${input.productName}' in a real room + 85mm macro detail of physical quality, bold 3-word ALL-CAPS Spanish headline 'USO FÁCIL DIARIO' and 3 clean flat spec strips, full-bleed 2:3.`
          },
          {
            role: 'social_trust_specs',
            title: `Lámina 4 · Sección 3 Principal: Entrega Real + Envío Gratis`,
            caption: 'Cierre COD en hogar real con Regalo y Envío Gratuito',
            imagePrompt: `High-trust 2:3 vertical COD e-commerce Visual Sales Letter Section 3 exclusively for '${input.productName}' in matte slate, natural emerald & ivory: realistic smiling buyer at home table with complete '${input.productName}' + '${safeEntryName.toUpperCase()} DE REGALO' + clean banner 'ENVÍO GRATUITO EN TODO PARAGUAY' + 'PAGO AL RECIBIR' + price '${formatParaguayGs(price1)}' + bottom cue 'Dale clic al botón de abajo', full-bleed 2:3.`
          }
        ];

    while (rawSheets.length < 4) {
      const nextIdx = rawSheets.length - 1;
      rawSheets.push(fallbackPrincipalSections[Math.min(nextIdx, fallbackPrincipalSections.length - 1)]);
    }
  }

  const finalSheetCount: 2 | 3 | 4 =
    sheetCountMode === 'auto'
      ? rawSheets.length >= 4
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

  // 2. Generar las láminas verticales reales (por defecto 4: 1 Tripwire Envolvente + 3 Secciones Producto Principal)
  const generatedSheets: ProductVisualLandingSheet[] = [];
  for (let i = 0; i < Math.min(finalSheetCount, rawSheets.length); i++) {
    const s = rawSheets[i];
    const sanitizedPrompt = sanitizeAndEnforceSalesLetterImagePrompt(
      String(s.imagePrompt || ''),
      i,
      isPrincipalOnly
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
          : i === 2 && finalSheetCount === 4
            ? 'authority_transformation'
            : 'social_trust_specs';

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

  const visualLanding: ProductVisualLandingConfig = {
    enabled: true,
    mode:
      finalSheetCount === 4
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
      : cleanPublicText(parsed?.entryButtonLabel || `Separar ahora · ${formatParaguayGs(entryPrice)}`),
    entryDisclaimer: isPrincipalOnly
      ? undefined
      : cleanPublicText(
          parsed?.entryDisclaimer ||
            `Atención: esta solicitud envía únicamente 1x ${safeEntryName}. No incluye ${input.productName} ni envío gratuito.`
        ),
    bundleButtonLabel: cleanPublicText(
      parsed?.bundleButtonLabel ||
        (isPrincipalOnly
          ? `Solicitar ahora · ${formatParaguayGs(price1)}`
          : `Solicitar oferta completa · ${formatParaguayGs(price1)}`)
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

  return {
    product,
    strategySummary: cleanPublicText(String(parsed?.strategySummary || ''))
  };
}

