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

  const studioPrompt = `High-end flagship commercial studio product photography (recreating the EXACT physical product cleanly from a flattering elevated 3/4 hero angle): ${params.productName}. Faithful physical specification of the exact product: ${params.exactVisualBlueprint}.${specsClause} Placed cleanly centered on a sleek dark obsidian and brushed warm mineral pedestal with crisp architectural rim lighting, ultra-sharp surface realism, ZERO text, ZERO watermarks, ZERO Chinese badges, ZERO collage frames, ZERO supplier clutter, pure studio product photograph.`;

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
  recommendedSheetCount: 2 | 3;
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
  recommendedSheetCount: 2 | 3;
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
  sheetCount?: 'auto' | 2 | 3;
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
    ? `Eres el Estratega Jefe de Conversión Directa (COD Paraguay) y Director Creativo GPT-2.6 para páginas de PRODUCTO GANADOR ÚNICO (Estándar).
TU MISIÓN: Que el operador trabaje 100% MANOS LIBRES sin tener que inventar diseños, cantidades de láminas ni prompts visuales.
REGLAS ESTRICTAS:
1. Modo ESTÁNDAR (Producto Ganador Único): JAMÁS sugieras artículos secundarios ni menciones "tripwire" en textos públicos. Toda la fuerza visual y psicológica recae sobre un único producto.
2. Si existe PÁGINA CLONADA, primero diagnosticá con precisión qué ángulo, promesa y estética visual está usando la página anterior ("currentPageDiagnosis"), y luego proponé 3 opciones CLARAMENTE DISTINTAS (prohibido repetir el mismo ángulo o atmósfera visual).
3. Para cada opción, TÚ decides automáticamente "recommendedSheetCount" (2 para ofertas claras y directas de impulso rápido; 3 cuando el producto requiere más prueba técnica/contenido de caja/confianza) y "recommendedAudioPreset" ('warm_ambient', 'soft_lounge' o 'commercial_pulse'), más "visualDirection" detallando iluminación, paleta y composición editorial para GPT-2.6.
4. Precios siempre en Guaraníes ("Gs."). Español natural paraguayo/rioplatense comercial sobrio, cero estrellitas ni humo de infoproducto.
5. Si el usuario hace una pregunta o pide un giro específico ("userQuestion"), respondé de forma directa y útil en "assistantReply" y regenerá 3 opciones ajustadas exactamente a lo que pidió.`
    : `Eres el Estratega Jefe de Embudos Duales y Director Creativo de E-Commerce de Altísimo Impacto (COD Paraguay) para páginas TRIPWIRE + PRODUCTO GANADOR EN LA MISMA PÁGINA.
TU MISIÓN: Que el operador trabaje 100% MANOS LIBRES y ambas partes luzcan como piezas gráficas de e-commerce de altísimo nivel.
REGLA VISUAL Y DE CONVERSIÓN (OBLIGATORIO):
1. AMBAS PARTES SON E-COMMERCE DE ALTO IMPACTO, CON PALETAS DE COLOR TOTALMENTE DISTINTAS:
   - LÁMINA 1 (Arriba — E-COMMERCE DIRECTO ALTO IMPACTO EN PALETA CLARA / AZUL COBALTO-BLANCO): 100% "${safeEntryName}" ÚNICAMENTE (${formatParaguayGs(Number(input.entryPriceGs || 20000))}). Visual publicitario e-commerce de primer nivel con fotografía limpia del producto, título gigante legible, 3 tarjetas de características reales con íconos, precio claro e indicación hacia el botón de abajo ("Dale clic al botón de abajo"). SIN tono persuasivo agresivo, SIN nombrar a "${input.productName}" y SIN hablar de envío.
   - LÁMINA 2 (Abajo — E-COMMERCE DE LOCURA ALTÍSIMO NIVEL EN PALETA OSCURA OPUESTA / OBSIDIANA-ESMERALDA-ORO): Diseño visual completamente distinto en color e intensidad al de arriba. Arranca en la parte superior DENTRO DE LA PROPIA IMAGEN con la entrada brusca ("¡ESPERÁ UN RATITO! Estás a punto de pedir solo ${safeEntryName}..."), y despliega una pieza gráfica descomunal presentando "${input.productName}" como la solución definitiva, exhibiendo EN GRANDE **ENVÍO GRATUITO EN TODO PARAGUAY** + **${safeEntryName} TOTALMENTE DE REGALO** + indicación hacia el botón de abajo.
2. REGLA CRÍTICA DE MONEDA Y BOTONES: Nunca dupliques "Gs. Gs." (escribí exactamente "Gs. 189.000"). Los botones en página son limpios de una sola línea sin descripciones HTML extra.
3. NUNCA uses la palabra "tripwire" ni "gancho trampa" en titulares ni textos orientados al cliente final.
REGLAS ESTRICTAS:
- Si existe PÁGINA CLONADA, primero diagnosticá qué ángulo y estética visual usaba la página original ("currentPageDiagnosis") y proponé 3 opciones frescas distintas.
- En modo Tripwire recomendá "recommendedSheetCount": 2 por defecto (Lámina 1 E-Commerce Directo Gancho → Botón 1 → Lámina 2 E-Commerce de Locura con Ruptura Brusca + Principal → Botón 2), y decidí "recommendedAudioPreset" + "visualDirection" contrastada para la Parte 2.
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

  const userPrompt = `ANALIZÁ ESTE PRODUCTO Y GENERÁ LA ESTRATEGIA 100% MANOS LIBRES:
- Modo seleccionado: ${isPrincipalOnly ? 'Producto Ganador Único (Estándar)' : 'Tripwire + Producto Ganador en la misma página'}
- Producto Principal: ${input.productName}
- Descripción: ${input.productDescription}
- Ángulo borrador ingresado (si existe): ${input.winnerAngle || 'Ninguno aún — proponé los mejores'}
- Precio Principal 1x: ${formatParaguayGs(Number(input.price1Gs || 189000))} (Normal: ${formatParaguayGs(Number(input.normalPriceGs || 249000))})
${
  !isPrincipalOnly
    ? `- Artículo de Entrada (Tripwire): ${safeEntryName}
- Descripción entrada: ${input.entryProductDescription || safeEntryName}
- Precio Entrada: ${formatParaguayGs(Number(input.entryPriceGs || 20000))} (sin prometer envío gratis en la cabecera; delivery ${formatParaguayGs(Number(input.entryDeliveryFeeGs || 40000))} contrastado recién en Parte 2 o al cierre del chat si rechaza el Producto Principal)`
    : ''
}${cloneContextBlock}${historyText}
${input.userQuestion ? `\nPREGUNTA O INSTRUCCIÓN ACTUAL DEL OPERADOR: "${input.userQuestion}"` : '\nGENERÁ EL DIAGNÓSTICO INICIAL Y LAS 3 MEJORES OPCIONES LISTAS PARA 1 CLIC.'}

Devolvé EXCLUSIVAMENTE este JSON válido:
{
  "currentPageDiagnosis": "${cloneCtx?.sourceProductName ? 'Explicación clara de qué ángulo, promesa y estilo visual usa actualmente la página clonada, para no repetirlo.' : 'Diagnóstico breve de cómo posicionaremos este producto desde cero en el mercado paraguayo.'}",
  "assistantReply": "Respuesta directa y clara al operador (2-3 oraciones) explicando por qué la Opción 1 es la recomendación principal o respondiendo a su pregunta.",
  "recommendedSheetCount": 2,
  "recommendedAudioPreset": "warm_ambient",
  "recommendedOptionId": "opt_1",
  "options": [
    {
      "id": "opt_1",
      "title": "Nombre corto del ángulo (máx 6 palabras)",
      "archetype": "Recomendada por IA",
      "winnerAngle": "Titular de ángulo listo para vender (máx 13 palabras)",
      "visualDirection": "Dirección artística completa para GPT-2.6 (iluminación, escenario, paleta, encuadre editorial sin humo)",
      "recommendedSheetCount": 2,
      "recommendedAudioPreset": "warm_ambient",
      "whyItConverts": "Por qué este ángulo y visual convierten mejor (y cómo se diferencia del clon si aplica).",
      "tripwireBridgeNote": "${isPrincipalOnly ? '' : 'Cómo frena el patrón después del gancho directo y contrasta brutalmente con este Producto Ganador.'}"
    },
    {
      "id": "opt_2",
      "title": "Segundo enfoque distinto",
      "archetype": "Ángulo Emocional / Hogar",
      "winnerAngle": "...",
      "visualDirection": "...",
      "recommendedSheetCount": 2,
      "recommendedAudioPreset": "soft_lounge",
      "whyItConverts": "...",
      "tripwireBridgeNote": "${isPrincipalOnly ? '' : '...'}"
    },
    {
      "id": "opt_3",
      "title": "Tercer enfoque disruptivo",
      "archetype": "Contraste Racional",
      "winnerAngle": "...",
      "visualDirection": "...",
      "recommendedSheetCount": 2,
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

  const rawOptions: any[] = Array.isArray(parsed?.options) ? parsed.options : [];
  const options: QuickCreatorAngleOption[] = rawOptions.slice(0, 4).map((o, idx) => ({
    id: String(o?.id || `opt_${idx + 1}`),
    title: String(o?.title || `Estrategia ${idx + 1}`).trim(),
    archetype: String(o?.archetype || (idx === 0 ? 'Recomendada por IA' : `Enfoque ${idx + 1}`)).trim(),
    winnerAngle: String(o?.winnerAngle || input.winnerAngle || input.productName).trim(),
    visualDirection: String(o?.visualDirection || '').trim(),
    recommendedSheetCount: isPrincipalOnly
      ? Number(o?.recommendedSheetCount) === 3
        ? 3
        : 2
      : Number(o?.recommendedSheetCount) === 3
        ? 3
        : 2,
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
    recommendedSheetCount: isPrincipalOnly
      ? Number(parsed?.recommendedSheetCount) === 3 || matchedRec.recommendedSheetCount === 3
        ? 3
        : 2
      : 2,
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
  const sheetCountMode: 'auto' | 2 | 3 =
    input.sheetCount === 2 ? 2 : input.sheetCount === 3 ? 3 : 'auto';
  const requestedSheetCount: 2 | 3 =
    sheetCountMode === 'auto' ? 2 : sheetCountMode;
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
    ? `Eres el Director Creativo Senior de Marcas Flagship y Psicología de Conversión en Paraguay.
Diseñas páginas gráficas verticales 100% visuales (cero bloques HTML intermedios: las láminas SON toda la presentación visual del producto) enfocadas en UN ÚNICO PRODUCTO GANADOR.

REGLA INQUEBRANTABLE DE LENGUAJE Y CALIDAD GPT-2.6:
- JAMÁS escribas la palabra "tripwire", "gancho trampa" ni menciones artículos secundarios inexistentes.
- Precios obligatorios en Guaraníes de Paraguay ("Gs.") jamás en dólares.
- Dirección de arte obligatoria para openai/gpt-image-2.6-sunburst: diseño editorial comercial de lujo (nivel campaña Apple / Dyson / Bang & Olufsen adaptada a hogar/consumo real en Paraguay), iluminación cinematográfica de estudio con profundidad 3D, materiales táctiles ultra nítidos, tipografía editorial española impecable sin errores ni letras cortadas, ocupación total borde a borde (edge-to-edge 2:3 sin marcos blancos), CERO estrellas chillonas, CERO stickers baratos de infoproducto.${visualDirectionBlock}${cloneDirectiveBlock}`
    : `Eres el Director Creativo Senior de Piezas Gráficas E-Commerce de Altísimo Impacto en Paraguay (estilo gráficas verticales de conversión MercadoLibre Platinum / Shopify Flagship / Direct Response).
REGLA MAESTRA DE COMPOSICIÓN PARA openai/gpt-image-2.6-sunburst (VERTICAL 2:3):
- PROHIBIDO diseñar afiches abstractos de piedra/mármol vacíos o letras minúsculas ilegibles. Usá diseño gráfico E-COMMERCE DE ALTÍSIMO IMPACTO con: titular gigante perfectamente legible, render heroico fotorealista del producto en primer plano ocupando gran parte de la lámina, tarjetas ordenadas con íconos vectoriales limpios y especificaciones cortas de 2-4 palabras, y bloque claro de precio/CTA.
- AMBAS LÁMINAS SON E-COMMERCE DE ALTÍSIMO NIVEL, CON DIFERENCIACIÓN CROMÁTICA INMEDIATA:
  1. LÁMINA 1 (GANCHO DIRECTO NO PERSUASIVO — PALETA CLARA/AZUL COBALTO & ÁMBAR): Diseño gráfico e-commerce vibrante y nítido (fondo estudio luminoso en blanco perla + degradado azul eléctrico/cobalto profesional) mostrando EXCLUSIVAMENTE "${safeEntryName}". Estilo informativo directo de alto impacto SIN textos persuasivos ni drama: titular claro del producto, foto real impactante, 3 tarjetas limpias con íconos y datos concretos, precio único destacado (${formatParaguayGs(entryPrice)}) y al pie indicación clara hacia abajo: "Tocá el botón de abajo ↓". PROHIBIDO mencionar a "${input.productName}" y PROHIBIDO hablar de envío.
  2. LÁMINA 2 (PRODUCTO ESTRELLA DE LOCURA — PALETA OSCURA OPUESTA OBSIDIANA-CRIMSON-ORO + ENTRADA BRUSCA EN LA IMAGEN): Cambio visual radical e imposible de confundir respecto a Lámina 1 (fondo oscuro obsidiana profundo con iluminación neón esmeralda/oro y alerta carmesí superior). En el 20% superior DE LA PROPIA IMAGEN va la entrada brusca ("¡ESPERÁ UN RATITO! Estás a punto de pedir solo ${safeEntryName}..."), seguida por una presentación e-commerce de altísimo nivel de "${input.productName}" en escena real espectacular, 3-4 tarjetas de beneficios contundentes con íconos, sello gigante **ENVÍO GRATUITO EN TODO PARAGUAY** + **${safeEntryName} DE REGALO**, contraste honesto de delivery al pie y flecha inferior: "Dale clic al botón de abajo ↓".

REGLA INQUEBRANTABLE DE TONO, TEXTOS Y MONEDA PARA GPT-2.6:
- TEXTOS CORTOS Y EXACTOS EN ESPAÑOL: Dentro de "imagePrompt" escribí textos en español MUY CORTOS y entre comillas exactas (máx 4-5 palabras por titular y 2-3 palabras por tarjeta) para que GPT-2.6 los renderice 100% nítidos sin faltas ortográficas.
- MONEDA EXACTA PARAGUAY: Escribí los precios exactamente como se te entregan (ej. "Gs. 189.000"). PROHIBIDO repetir "Gs. Gs." ni usar "$"/USD.
- JAMÁS escribas la palabra "tripwire", "gancho trampa" ni jerga técnica. Refiérete siempre al artículo de entrada por su nombre real: "${safeEntryName}".
- Ocupación total borde a borde (edge-to-edge 2:3 vertical sin marcos blancos), CERO estrellas chillonas baratas ni textos amontonados.${visualDirectionBlock}${cloneDirectiveBlock}`;

  const promptUserContent = isPrincipalOnly
    ? `PRODUCTO GANADOR ÚNICO (PÁGINA DIRECTA SIN ARTÍCULO SECUNDARIO):
- Nombre: ${input.productName}
- Enfoque / ángulo principal: ${cleanAngleInput || input.productDescription}
- Qué hace / descripción: ${input.productDescription}
- Precio Normal tachado: ${formatParaguayGs(normalPrice)}
- Precio 1x: ${formatParaguayGs(price1)} (Pack 2x: ${formatParaguayGs(price2)}, Pack 3x: ${formatParaguayGs(price3)})
- Envío Producto Principal: ENVÍO GRATIS en todo Paraguay + Pago en mano al recibir.
${visualDirectionInput ? `- Dirección visual asignada: ${visualDirectionInput}` : ''}

CANTIDAD DE LÁMINAS A DISEÑAR: ${sheetCountMode === 'auto' ? `Decidí automáticamente entre 2 o 3 láminas según el producto (sugerido: ${requestedSheetCount})` : requestedSheetCount}

Devuelve EXCLUSIVAMENTE este JSON válido:
{
  "strategySummary": "Explicación breve interna del enfoque principal de venta directa.",
  "recommendedAudioPreset": "warm_ambient",
  "researchedProductDescription": "Ficha comercial limpia, verificada y redactada desde cero en español (NUNCA copia-pega literal del borrador del usuario).",
  "sobrietyHeadline": "Titular sobrio y elegante de alto impacto racional (máx 10 palabras).",
  "subheadline": "Bajada clara explicando qué resuelve en el hogar/vida del cliente en Paraguay (máx 22 palabras).",
  "winnerAngleHeadline": "Ángulo de valor clave del producto principal (máx 12 palabras).",
  "winnerAngleDescription": "Explicación clara y honesta de beneficios reales del producto principal (máx 32 palabras).",
  "bundleButtonLabel": "SOLICITAR ${input.productName} · ${formatParaguayGs(price1)}",
  "bundleDisclaimer": "Incluye ${input.productName} original + Envío GRATIS en Paraguay + Pago contra entrega en efectivo o QR.",
  "sheetPrompts": [
    {
      "role": "hero_presentation",
      "title": "Presentación del producto principal",
      "caption": "Pie corto sobrio",
      "imagePrompt": "Flagship full-bleed 2:3 vertical high-impact e-commerce design poster for openai/gpt-image-2.6-sunburst in crisp Paraguayan Spanish: studio-lit hero showcase of ${input.productName} (${cleanAngleInput || 'superior result'}) in ${visualDirectionInput || 'dramatic modern high-contrast lighting'}, razor-sharp giant bold Spanish headline integrated cleanly, clean pricing callout '${formatParaguayGs(price1)} · Envío Gratis · Pagás al Recibir' (never duplicate 'Gs.'), edge-to-edge artwork with zero outer frame."
    },
    {
      "role": "comparison_need",
      "title": "Beneficios y packs disponibles",
      "caption": "Comparativa clara de packs",
      "imagePrompt": "Flagship full-bleed 2:3 vertical high-impact e-commerce infographic poster for openai/gpt-image-2.6-sunburst in crisp Spanish: macro visual breakdown of ${input.productName} key benefits with structured icon cards, clean side-by-side comparison of 1 Unidad (${formatParaguayGs(price1)}) and Pack 2x Ahorro (${formatParaguayGs(price2)}) with 'Envío Gratis Paraguay', plus clean bottom directional arrow cue 'Dale clic al botón de abajo', high-contrast studio typography, edge-to-edge composition."
    }${
      requestedSheetCount === 3 || sheetCountMode === 'auto'
        ? `,
    {
      "role": "social_trust_specs",
      "title": "Garantía y contenido real en caja",
      "caption": "Lo que recibís en tu puerta",
      "imagePrompt": "Flagship full-bleed 2:3 vertical commercial studio poster for openai/gpt-image-2.6-sunburst in crisp Spanish: clean overhead unboxing composition showing exact box contents of ${input.productName}, subtle refined emblem 'Garantía Escrita 7 Días · Pago Efectivo o QR al Recibir en Paraguay', plus bottom cue 'Dale clic al botón de abajo', edge-to-edge."
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
    : `PRODUCTO GANADOR (PARTE 2 — CHOQUE DE PATRÓN + OFERTA PRINCIPAL BRUTAL EN LA MISMA PÁGINA):
- Nombre: ${input.productName}
- Ángulo contundente del Producto Ganador: ${cleanAngleInput || `Solución definitiva completa muy superior al artículo de entrada (${input.productDescription})`}
- Qué hace / descripción: ${input.productDescription}
- Precio Normal tachado: ${formatParaguayGs(normalPrice)}
- Precio 1x: ${formatParaguayGs(price1)} (Pack 2x: ${formatParaguayGs(price2)}, Pack 3x: ${formatParaguayGs(price3)})
- Envío Producto Principal: ENVÍO GRATUITO en todo Paraguay + Pago al recibir.
${visualDirectionInput ? `- Dirección visual asignada para Parte 2: ${visualDirectionInput}` : ''}

ARTÍCULO DE ENTRADA (PARTE 1 — GANCHO DIRECTO RÁPIDO SIN ESPECTACULARIDAD EXAGERADA):
- Nombre real investigado: ${safeEntryName}
- Síntesis investigada (NO copiar textos de proveedor literalmente): ${resolvedEntryDesc || safeEntryName}
${resolvedEntrySpecs.length > 0 ? `- Especificaciones reales clave: ${resolvedEntrySpecs.join(' | ')}` : ''}
${resolvedEntryVisualBlueprint ? `- Blueprint visual exacto del producto físico a mostrar limpio en Parte 1: ${resolvedEntryVisualBlueprint}` : ''}
- Precio ÚNICO cerrado (1 unidad solamente): ${formatParaguayGs(entryPrice)} (ARRIBA en Lámina 1 está PROHIBIDO mencionar a "${input.productName}" y PROHIBIDO hablar de envío. Recién en LÁMINA 2 explota el contraste exhibiendo EN GRANDE **ENVÍO GRATUITO** para ${input.productName} + ${safeEntryName} TOTALMENTE DE REGALO, contrastando que llevar solo ${safeEntryName} abona delivery ${formatParaguayGs(deliveryFee)}).

CANTIDAD DE LÁMINAS: ${requestedSheetCount} (${requestedSheetCount === 2 ? 'Lámina 1 = Gancho directo rápido; Lámina 2 = Choque de freno + Explosión brutal y diferente del Producto Principal' : 'Lámina 1 = Gancho directo; Lámina 2 = Choque brusco ¡ESPERÁ! antes de confirmar; Lámina 3 = Explosión brutal Producto Principal'})

Devuelve EXCLUSIVAMENTE este JSON válido:
{
  "strategySummary": "Explicación breve interna del contraste chocante directo usado entre Gancho y Producto Principal.",
  "recommendedAudioPreset": "warm_ambient",
  "researchedProductDescription": "Ficha comercial limpia, verificada y redactada desde cero en español para ${input.productName} (cero copia-pega crudo).",
  "researchedEntryDescription": "Ficha comercial propia de ${safeEntryName} redactada limpiamente desde investigación (NUNCA copia-pega crudo del proveedor).",
  "sobrietyHeadline": "Titular rápido y directo para ${safeEntryName} (máx 8 palabras).",
  "subheadline": "Beneficio práctico directo de ${safeEntryName} en una línea clara (máx 16 palabras).",
  "winnerAngleHeadline": "Titular chocante y brutal para ${input.productName} debajo de la ruptura de patrón (máx 12 palabras).",
  "winnerAngleDescription": "Contraste directo y persuasivo que explica por qué dar el salto a ${input.productName} resuelve el problema definitivo hoy (máx 32 palabras).",
  "reversePsychologyHook": "¡Esperá un ratito antes de confirmar! Llevando ${input.productName} te llevás ${safeEntryName} GRATIS y activás Envío Gratuito.",
  "entryButtonLabel": "Separar ahora · ${formatParaguayGs(entryPrice)}",
  "entryDisclaimer": "Solo incluye 1x ${safeEntryName}. NO incluye ${input.productName} ni envío gratuito.",
  "bundleButtonLabel": "Solicitar oferta completa · ${formatParaguayGs(price1)}",
  "bundleDisclaimer": "Incluye ${input.productName} completo + ${safeEntryName} DE REGALO + ENVÍO GRATUITO en todo Paraguay.",
  "sheetPrompts": [
    {
      "role": "hero_presentation",
      "title": "Presentación E-Commerce ${safeEntryName}",
      "caption": "Lámina 1 E-Commerce Alto Impacto (Paleta Clara/Azul)",
      "imagePrompt": "High-impact flagship 2:3 vertical e-commerce product graphic for openai/gpt-image-2.6-sunburst in razor-sharp Paraguayan Spanish (bright clean studio aesthetic — crisp pearl-white & vibrant royal cobalt-blue backdrop with warm amber highlights, COMPLETELY DIFFERENT color palette from Sheet 2): TOP ZONE big bold ultra-legible commercial headline for '${safeEntryName}' (short crisp Spanish title, max 5 words); CENTER HERO huge ultra-detailed studio photograph of ONLY '${safeEntryName}'${resolvedEntryVisualBlueprint ? ` (${resolvedEntryVisualBlueprint})` : ''} with crisp studio lighting and vivid real depth; LOWER-SIDE ZONE 3 clean structured rounded icon-cards with concise 2-to-3-word real factual specs (${resolvedEntrySpecs.slice(0, 3).join(' / ') || 'Uso práctico / Alta calidad / Listo para usar'}); BOTTOM ZONE bold clean single price badge '${formatParaguayGs(entryPrice)}' and clean downward arrow cue 'Tocá el botón de abajo'. Direct informative e-commerce style (NO persuasive sales drama). NEVER write 'Gs. Gs.', DO NOT mention '${input.productName}', DO NOT mention shipping. Full-bleed edge-to-edge 2:3."
    }${
      requestedSheetCount === 3
        ? `,
    {
      "role": "comparison_need",
      "title": "¡ESPERÁ UN RATITO! Entrada brusca en imagen",
      "caption": "Ruptura visual brusca dentro de la imagen",
      "imagePrompt": "High-impact 2:3 vertical direct-response e-commerce graphic for openai/gpt-image-2.6-sunburst in razor-sharp Spanish — COMPLETELY DIFFERENT dark obsidian & sharp crimson-gold palette from Sheet 1: TOP crimson alert bar '¡ESPERÁ UN RATITO!', bold contrast statement showing only '${safeEntryName}' vs the complete upgrade to '${input.productName}', structured icon comparison boxes, razor-sharp readable Spanish typography, edge-to-edge 2:3."
    },
    {
      "role": "social_trust_specs",
      "title": "Oferta Estrella de Locura: ${input.productName} + ${safeEntryName} GRATIS",
      "caption": "E-Commerce Altísimo Nivel con Envío Gratuito",
      "imagePrompt": "Mind-blowing ultra high-impact flagship 2:3 vertical e-commerce conversion poster for openai/gpt-image-2.6-sunburst in razor-sharp Paraguayan Spanish — COMPLETELY DIFFERENT deep obsidian dark, glowing emerald & burnished gold aesthetic from Sheet 1: giant bold dramatic Spanish headline for '${input.productName}' (${cleanAngleInput || 'solución definitiva'}), huge photorealistic center-stage hero showcase of '${input.productName}' transforming a real modern home environment, 4 crisp structured dark-glass icon feature badges, unmissable emerald-gold banner 'ENVÍO GRATUITO EN TODO PARAGUAY' + '${safeEntryName} DE REGALO', clear price '${formatParaguayGs(price1)}' (write ONCE, never 'Gs. Gs.'), transparent note 'Solo ${safeEntryName} paga delivery ${formatParaguayGs(deliveryFee)}', and bottom downward arrow cue 'Dale clic al botón de abajo'. Edge-to-edge 2:3."
    }`
        : `,
    {
      "role": "social_trust_specs",
      "title": "¡ESPERÁ! ${input.productName} + ${safeEntryName} GRATIS + ENVÍO GRATUITO",
      "caption": "Entrada brusca integrada + Oferta Estrella de Locura",
      "imagePrompt": "Mind-blowing ultra high-impact flagship 2:3 vertical e-commerce conversion poster for openai/gpt-image-2.6-sunburst in razor-sharp Paraguayan Spanish — COMPLETELY DIFFERENT deep obsidian dark, crimson-alert, glowing emerald & metallic gold aesthetic from Sheet 1: TOP 18% sharp crimson-amber interrupt header integrated directly inside the artwork '¡ESPERÁ UN RATITO!' + 'Estás por pedir solo ${safeEntryName}... Mirá esto antes:'; MIDDLE 58% spectacular photorealistic hero showcase of '${input.productName}' (${cleanAngleInput || 'solución definitiva'}) in dramatic real-world action with giant bold Spanish headline and 3 crisp structured dark-glass icon feature cards; LOWER 16% high-impact emerald-gold offer bar 'ENVÍO GRATUITO EN TODO PARAGUAY' + 'Llevás ${safeEntryName} DE REGALO' + clean price '${formatParaguayGs(price1)}' (never write 'Gs. Gs.') + transparent delivery note 'Solo ${safeEntryName}: delivery ${formatParaguayGs(deliveryFee)}'; BOTTOM 8% clean downward arrow cue 'Dale clic al botón de abajo'. Ultra-crisp legible Spanish typography, zero garbled text, full-bleed edge-to-edge 2:3."
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

  const finalSheetCount: 2 | 3 =
    sheetCountMode === 'auto'
      ? (rawSheets.length >= 3 ? 3 : 2)
      : sheetCountMode;

  const resolvedAudioPreset: 'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none' =
    input.backgroundMusicPreset && input.backgroundMusicPreset !== 'auto'
      ? input.backgroundMusicPreset
      : parsed?.recommendedAudioPreset === 'soft_lounge' ||
          parsed?.recommendedAudioPreset === 'commercial_pulse' ||
          parsed?.recommendedAudioPreset === 'none'
        ? parsed.recommendedAudioPreset
        : 'warm_ambient';

  // 2. Generar las 2 o 3 imágenes verticales reales en paralelo/turno con openai/gpt-image-2.6-sunburst
  const generatedSheets: ProductVisualLandingSheet[] = [];
  for (let i = 0; i < Math.min(finalSheetCount, rawSheets.length); i++) {
    const s = rawSheets[i];
    const extraVisualContext = [
      String(s.imagePrompt || ''),
      !isPrincipalOnly && i === 0 && resolvedEntryVisualBlueprint
        ? `Exact physical entry product geometry & clean studio appearance: ${resolvedEntryVisualBlueprint}.`
        : '',
      (isPrincipalOnly || i >= 1) && savedPrincipalImg && !savedPrincipalImg.startsWith('/')
        ? `Reference product style: ${input.productName}.`
        : '',
      'Ultra sharp high-contrast legible Spanish e-commerce typography, crisp vector feature icons, NO garbled words, full-bleed edge-to-edge 2:3 vertical layout with zero white margins.'
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
    mode: finalSheetCount === 3 ? 'sober_graphic_3sheet' : 'sober_graphic_2sheet',
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

