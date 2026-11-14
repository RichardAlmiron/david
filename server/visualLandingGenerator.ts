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
    .replace(/\s+/g, ' ')
    .trim();

  const sectionAura = !isPrincipalOnly && sheetIndex === 0
    ? 'SPECTACULAR 360-DEGREE WRAP-AROUND E-COMMERCE DESIGN (DISEÑO ENVOLVENTE DE ALTÍSIMO IMPACTO): vibrant electric sapphire-cobalt, glowing cyan rim light and warm amber-gold volumetric reflections wrapping around the hero product with deep 3D studio presence.'
    : `HIGH-IMPACT VISUAL SALES LETTER SECTION #${isPrincipalOnly ? sheetIndex + 1 : sheetIndex} (CARTA DE VENTA VISUAL E-COMMERCE DE ALTÍSIMO IMPACTO): deep luxury obsidian, dramatic volumetric lighting, rich 3D depth and persuasive commercial art direction.`;

  const strictOrthographyRule =
    'STRICT SPANISH ORTHOGRAPHY & ZERO-TYPO RULE: Render ONLY 2 to 3 short, punchy ALL-CAPS Spanish headlines (strictly 2 to 4 words per text block) in bold geometric sans-serif typography. NEVER render long sentences, paragraphs, or small body text inside the image. Verify letter-by-letter that every Spanish word is spelled 100% accurately with zero garbled, merged, or misspelled characters.';

  return `${cleaned} ${sectionAura} ${strictOrthographyRule}`;
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
    ? `Eres el Estratega Jefe de Conversión Directa (COD Paraguay), Redactor Maestro de Cartas de Venta y Director Creativo GPT-2.6 para páginas de PRODUCTO GANADOR ÚNICO (Estándar).
TU MISIÓN: Que el operador trabaje 100% MANOS LIBRES con una CARTA DE VENTA VISUAL E-COMMERCE DE ALTÍSIMO IMPACTO dividida en 4 IMÁGENES GENERADAS.
REGLAS ESTRICTAS:
1. Modo ESTÁNDAR (Producto Ganador Único): JAMÁS sugieras artículos secundarios ni menciones "tripwire" en textos públicos. Toda la fuerza visual y persuasiva recae sobre un único producto a lo largo de 4 secciones diferentes de e-commerce de alto impacto (1. Gancho Envolvente y Gran Promesa; 2. Transformación Real y Demostración en Escena; 3. Anatomía Visual y Poder Técnico; 4. Cierre Irresistible de Carta de Venta con Packs + Envío Gratis).
2. PROHIBIDO EL COPIA Y PEGA: Jamás repitas literalmente las frases crudas del usuario o del proveedor. Redactá ángulos persuasivos de Carta de Venta con psicología real de deseo y transformación.
3. Si existe PÁGINA CLONADA, primero diagnosticá con precisión qué ángulo, promesa y estética visual está usando la página anterior ("currentPageDiagnosis"), y luego proponé 3 opciones CLARAMENTE DISTINTAS.
4. Para cada opción recomendá "recommendedSheetCount": 4 (las 4 secciones de la Carta de Venta Visual E-Commerce) y "recommendedAudioPreset" ('warm_ambient', 'soft_lounge' o 'commercial_pulse'), más "visualDirection" detallando iluminación envolvente, paleta y composición editorial para GPT-2.6.
5. Precios siempre en Guaraníes ("Gs."). Español paraguayo/rioplatense persuasivo de alto impacto.
6. Si el usuario hace una pregunta o pide un giro específico ("userQuestion"), respondé de forma directa y útil en "assistantReply" y regenerá 3 opciones ajustadas exactamente a lo que pidió.`
    : `Eres el Estratega Jefe de Embudos Duales, Redactor Maestro de Cartas de Venta (Direct-Response Copywriter) y Director Creativo de E-Commerce de Altísimo Impacto (COD Paraguay) para páginas TRIPWIRE + PRODUCTO GANADOR EN LA MISMA PÁGINA.
TU MISIÓN: Que el operador trabaje 100% MANOS LIBRES creando una página de 4 IMÁGENES DE ALTÍSIMO IMPACTO (1 imagen envolvente espectacular para el Tripwire + 3 imágenes de secciones diferentes de Carta de Venta E-Commerce exclusivas para el Producto Principal).
REGLA VISUAL Y DE CARTA DE VENTA (OBLIGATORIO — 4 LÁMINAS GENERADAS):
1. PROHIBIDO EL COPIA Y PEGA: Jamás copies y pegues en crudo el título o la descripción pegada por el usuario. Creá promesas persuasivas de Carta de Venta real que despierten deseo inmediato y tengan sentido comercial impecable.
2. ARQUITECTURA DE 4 IMÁGENES DE ALTÍSIMO IMPACTO CON DIFERENCIACIÓN CROMÁTICA:
   - IMAGEN 1 (EL TRIPWIRE — DISEÑO ENVOLVENTE 360° ESPECTACULAR DE ALTO IMPACTO EN PALETA ZAFIRO ELÉCTRICO / CIAN / ÁMBAR DORADO): Dedicada 100% a "${safeEntryName}" (${formatParaguayGs(Number(input.entryPriceGs || 20000))}). Diseño envolvente de altísimo impacto visual, iluminación volumétrica 3D espectacular, producto flotante en primer plano, titular corto magnético y 3 insignias envolventes + indicación hacia el botón de abajo ("Tocá el botón de abajo"). SIN nombrar a "${input.productName}" y SIN hablar de envío.
   - IMÁGENES 2, 3 Y 4 (3 SECCIONES DIFERENTES DE CARTA DE VENTA E-COMMERCE DE ALTÍSIMO IMPACTO EXCLUSIVAS DEL PRODUCTO PRINCIPAL "${input.productName}" EN PALETA OPUESTA OBSIDIANA / CARMESÍ / ESMERALDA / ORO):
     * IMAGEN 2 (Sección 1 Principal — Ruptura Brusca + Apertura de Carta de Venta y Revelación Heroica): Arranca arriba con "¡ESPERÁ UN SEGUNDO!" y presenta "${input.productName}" en una escena envolvente brutal con la gran promesa persuasiva de la carta de venta.
     * IMAGEN 3 (Sección 2 Principal — Demostración de Poder, Transformación y Anatomía E-Commerce): Segunda sección exclusiva de "${input.productName}" mostrando cómo transforma la experiencia real, detalles macro de calidad superior y 3 módulos persuasivos de alto impacto.
     * IMAGEN 4 (Sección 3 Principal — Cierre Explosivo de Carta de Venta + Bono Gratis + ENVÍO GRATUITO en Grande): Cierre irresistible exhibiendo "${input.productName}" + **${safeEntryName} TOTALMENTE DE REGALO** + sello gigante **ENVÍO GRATUITO EN TODO PARAGUAY** + **PAGO AL RECIBIR** + contraste honesto de delivery e indicación hacia el botón final.
3. REGLA CRÍTICA DE MONEDA Y ORTOGRAFÍA: Nunca dupliques "Gs. Gs." (escribí exactamente "Gs. 189.000"). En las imágenes solo van frases cortas de 2 a 4 palabras en mayúsculas perfectas para garantizar CERO fallas en la escritura.
4. NUNCA uses la palabra "tripwire" ni "gancho trampa" en titulares ni textos orientados al cliente final.
REGLAS ESTRICTAS:
- Si existe PÁGINA CLONADA, primero diagnosticá qué ángulo y estética visual usaba la página original ("currentPageDiagnosis") y proponé 3 opciones frescas distintas.
- Recomendá "recommendedSheetCount": 4 por defecto (1 lámina envolvente Tripwire + 3 secciones diferentes de Carta de Venta del Producto Principal).
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

  const userPrompt = `ANALIZÁ ESTE PRODUCTO Y GENERÁ LA ESTRATEGIA DE CARTA DE VENTA VISUAL (4 IMÁGENES DE ALTO IMPACTO) 100% MANOS LIBRES:
- Modo seleccionado: ${isPrincipalOnly ? 'Producto Ganador Único (Estándar — 4 Secciones de Carta de Venta)' : 'Tripwire + Producto Ganador (1 Imagen Envolvente Tripwire + 3 Secciones de Carta de Venta del Producto Principal)'}
- Producto Principal: ${input.productName}
- Descripción base (NO copiar y pegar literal; transformar en Carta de Venta persuasiva): ${input.productDescription}
- Ángulo borrador ingresado (si existe): ${input.winnerAngle || 'Ninguno aún — proponé los mejores ángulos persuasivos'}
- Precio Principal 1x: ${formatParaguayGs(Number(input.price1Gs || 189000))} (Normal: ${formatParaguayGs(Number(input.normalPriceGs || 249000))})
${
  !isPrincipalOnly
    ? `- Artículo de Entrada (Imagen 1 Envolvente): ${safeEntryName}
- Descripción entrada: ${input.entryProductDescription || safeEntryName}
- Precio Entrada: ${formatParaguayGs(Number(input.entryPriceGs || 20000))} (sin mencionar envío en Imagen 1; delivery ${formatParaguayGs(Number(input.entryDeliveryFeeGs || 40000))} contrastado en el cierre de la Carta de Venta Principal)`
    : ''
}${cloneContextBlock}${historyText}
${input.userQuestion ? `\nPREGUNTA O INSTRUCCIÓN ACTUAL DEL OPERADOR: "${input.userQuestion}"` : '\nGENERÁ EL DIAGNÓSTICO INICIAL Y LAS 3 MEJORES OPCIONES DE CARTA DE VENTA LISTAS PARA 1 CLIC.'}

Devolvé EXCLUSIVAMENTE este JSON válido:
{
  "currentPageDiagnosis": "${cloneCtx?.sourceProductName ? 'Explicación clara de qué ángulo, promesa y estilo visual usa actualmente la página clonada, para superarlo con una Carta de Venta nueva.' : 'Diagnóstico breve de cómo estructuraremos esta Carta de Venta de 4 imágenes de alto impacto en Paraguay.'}",
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
      "visualDirection": "Dirección artística envolvente 3D de altísimo impacto para las 4 imágenes en GPT-2.6",
      "recommendedSheetCount": 4,
      "recommendedAudioPreset": "warm_ambient",
      "whyItConverts": "Por qué esta Carta de Venta de 4 secciones convierte en frío.",
      "tripwireBridgeNote": "${isPrincipalOnly ? '' : 'Cómo la Imagen 1 envolvente captura la atención y las Imágenes 2, 3 y 4 construyen una Carta de Venta irresistible para el Producto Principal.'}"
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
    ? `Eres el Redactor Maestro de Cartas de Venta de Respuesta Directa y Director Creativo Senior de E-Commerce de Altísimo Impacto en Paraguay.
Diseñas páginas gráficas verticales 100% visuales estructuradas como una CARTA DE VENTA VISUAL DE 4 SECCIONES DE E-COMMERCE DE ALTÍSIMO IMPACTO para UN ÚNICO PRODUCTO GANADOR.

REGLA INQUEBRANTABLE ANTI COPIA-PEGA Y DE ORTOGRAFÍA PERFECTA EN GPT-2.6:
- PROHIBIDO COPIAR Y PEGAR: Jamás copies y pegues en crudo el nombre largo o la descripción del usuario dentro de la imagen. Creá titulares persuasivos de Carta de Venta que despierten deseo inmediato.
- CERO FALLAS EN LA ESCRITURA: Dentro de cada "imagePrompt", exigí que el texto impreso en la imagen consista ÚNICAMENTE en 2 a 3 frases ultra cortas en MAYÚSCULAS SÓLIDAS (de 2 a 4 palabras máximo por línea, ej. "POTENCIA TOTAL EN CASA", "ENVÍO GRATIS PARAGUAY", "PAGÁS AL RECIBIR"). Prohibido incluir párrafos o frases largas que deformen las letras.
- DISEÑO ENVOLVENTE 360° DE ALTÍSIMO IMPACTO: Cada lámina debe tener profundidad 3D envolvente, iluminación volumétrica cinematográfica, producto fotorealista imponente y módulos gráficos dignos de marca líder mundial.
- Precios obligatorios en Guaraníes de Paraguay ("Gs."), jamás duplicar "Gs. Gs." y jamás mencionar la palabra "tripwire".${visualDirectionBlock}${cloneDirectiveBlock}`
    : `Eres el Redactor Maestro de Cartas de Venta (Direct-Response Sales Letter Copywriter) y Director Creativo Senior de Piezas Gráficas E-Commerce de Altísimo Impacto en Paraguay.
REGLA MAESTRA DE COMPOSICIÓN Y CARTA DE VENTA PARA openai/gpt-image-2.6-sunburst (VERTICAL 2:3 — 4 IMÁGENES GENERADAS):
- PROHIBIDO EL COPIA Y PEGA Y PROHIBIDO EL DISEÑO BÁSICO: Jamás copies textualmente el borrador crudo del usuario ni hagas láminas planas o aburridas. Toda la página funciona como una CARTA DE VENTA VISUAL DE ALTÍSIMO IMPACTO dividida en 4 IMÁGENES GENERADAS:
  1. IMAGEN 1 (EL TRIPWIRE — DISEÑO ENVOLVENTE 360° ESPECTACULAR DE ALTO IMPACTO — PALETA ZAFIRO ELÉCTRICO, CIAN NEÓN Y ÁMBAR DORADO):
     - Prohibido hacer un diseño básico o pálido. Tiene que ser un DISEÑO ENVOLVENTE, ESPECTACULAR Y DE ALTÍSIMO IMPACTO VISUAL centrado 100% en "${safeEntryName}": iluminación volumétrica envolvente 360°, pedestal 3D dinámico con haces de luz cian/ámbar abrazando el producto en primer plano heroico, titular corto magnético en mayúsculas perfectas (máx 4 palabras), 3 cápsulas envolventes con íconos 3D y beneficios de 2-3 palabras, sello de precio único (${formatParaguayGs(entryPrice)}) e indicación al pie: "Tocá el botón de abajo ↓". PROHIBIDO mencionar a "${input.productName}" y PROHIBIDO hablar de envío.
  2. IMÁGENES 2, 3 Y 4 (LAS 3 SECCIONES DIFERENTES DE E-COMMERCE DE ALTÍSIMO IMPACTO EXCLUSIVAS DEL PRODUCTO PRINCIPAL "${input.productName}" — CARTA DE VENTA EN PALETA OPUESTA OBSIDIANA, CARMESÍ, ESMERALDA Y ORO):
     - IMAGEN 2 (SECCIÓN 1 DEL PRODUCTO PRINCIPAL — RUPTURA DE PATRÓN + GRAN PROMESA DE CARTA DE VENTA Y REVELACIÓN HEROICA): Cambio cromático radical a negro obsidiana, alerta carmesí y oro metálico. Arriba en la propia imagen abre con el freno persuasivo corto "¡ESPERÁ UN SEGUNDO!" / "MIRÁ ESTO ANTES DE PEDIR", y en el centro despliega una revelación envolvente 3D espectacular de "${input.productName}" con un titular persuasivo de Carta de Venta (2 a 4 palabras en mayúsculas impecables, cero copia-pega) mostrando por qué es la solución definitiva.
     - IMAGEN 3 (SECCIÓN 2 DEL PRODUCTO PRINCIPAL — DEMOSTRACIÓN DE PODER, TRANSFORMACIÓN EN ESCENA Y ANATOMÍA E-COMMERCE DE ALTO IMPACTO): Segunda sección exclusiva de "${input.productName}" (estética obsidiana, bronce cálido y destellos esmeralda/oro). Muestra el producto principal en plena acción transformadora + acercamientos macro de ingeniería y 3 bloques visuales persuasivos de Carta de Venta (frases de 2 a 3 palabras en mayúsculas perfectas) que destruyen cualquier duda.
     - IMAGEN 4 (SECCIÓN 3 DEL PRODUCTO PRINCIPAL — CIERRE EXPLOSIVO DE CARTA DE VENTA + REGALO GRATIS + ENVÍO GRATUITO EN GRANDE): Tercera sección exclusiva y clímax de conversión para "${input.productName}" (estética obsidiana, verde esmeralda luminoso y oro imperial). Exhibe el paquete completo de "${input.productName}" + sello destacado mostrando que llevás "${safeEntryName}" GRATIS DE REGALO + cartel gigante inconfundible **"ENVÍO GRATUITO EN TODO PARAGUAY"** + **"PAGO AL RECIBIR"** + precio claro (${formatParaguayGs(price1)}), nota transparente corta de delivery suelto (${formatParaguayGs(deliveryFee)}) e indicación inferior: "Dale clic al botón de abajo ↓".

REGLA INQUEBRANTABLE CONTRA FALLAS DE ESCRITURA EN GPT-2.6:
- TEXTOS ULTRA CORTOS Y EN MAYÚSCULAS EXACTAS: Para evitar cualquier falla en la escritura, cada frase a renderizar dentro de "imagePrompt" debe tener MÁXIMO 2 A 4 PALABRAS en MAYÚSCULAS SÓLIDAS entre comillas. Prohibido meter oraciones largas o párrafos dentro del arte.
- MONEDA EXACTA PARAGUAY: Escribí los precios exactamente como se te entregan (ej. "Gs. 189.000"). PROHIBIDO repetir "Gs. Gs." ni usar "$"/USD.
- JAMÁS escribas la palabra "tripwire" ni "gancho trampa".${visualDirectionBlock}${cloneDirectiveBlock}`;

  const promptUserContent = isPrincipalOnly
    ? `PRODUCTO GANADOR ÚNICO (CARTA DE VENTA VISUAL EN ${requestedSheetCount} SECCIONES DE E-COMMERCE DE ALTÍSIMO IMPACTO):
- Nombre: ${input.productName}
- Enfoque / ángulo principal: ${cleanAngleInput || input.productDescription}
- Qué hace / descripción base (transformar en copy persuasivo, NO copiar literal): ${input.productDescription}
- Precio Normal tachado: ${formatParaguayGs(normalPrice)}
- Precio 1x: ${formatParaguayGs(price1)} (Pack 2x: ${formatParaguayGs(price2)}, Pack 3x: ${formatParaguayGs(price3)})
- Envío Producto Principal: ENVÍO GRATIS en todo Paraguay + Pago en mano al recibir.
${visualDirectionInput ? `- Dirección visual asignada: ${visualDirectionInput}` : ''}

CANTIDAD DE LÁMINAS A DISEÑAR: ${requestedSheetCount} secciones diferentes de Carta de Venta E-Commerce de altísimo impacto.

Devuelve EXCLUSIVAMENTE este JSON válido:
{
  "strategySummary": "Explicación breve interna del arco persuasivo de Carta de Venta en ${requestedSheetCount} secciones.",
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
      "title": "Sección 1 · Impacto Heroico Envolvente",
      "caption": "Apertura de Carta de Venta y Gran Promesa",
      "imagePrompt": "Spectacular 360-degree wrap-around 2:3 vertical high-impact e-commerce hero poster for openai/gpt-image-2.6-sunburst: dramatic volumetric studio showcase of ${input.productName} (${cleanAngleInput || 'transformación inmediata'}) in ${visualDirectionInput || 'obsidian and burnished gold lighting'}, giant ultra-clean ALL-CAPS Spanish headline (3-4 persuasive words, zero typos), 3 floating 3D benefit badges (2-3 words each), bold price '${formatParaguayGs(price1)}' (never duplicate 'Gs.'), full-bleed edge-to-edge 2:3."
    },
    {
      "role": "comparison_need",
      "title": "Sección 2 · Demostración y Transformación Real",
      "caption": "El poder del producto en acción",
      "imagePrompt": "High-impact 2:3 vertical e-commerce visual sales letter section 2 for openai/gpt-image-2.6-sunburst: dynamic split and wrap-around demonstration of ${input.productName} solving the problem effortlessly in a real Paraguayan home, bold ALL-CAPS Spanish persuasive headline (max 4 words, 100% exact spelling), 3 high-contrast visual proof callouts (2-3 words each), full-bleed 2:3."
    }${
      requestedSheetCount >= 3
        ? `,
    {
      "role": "authority_transformation",
      "title": "Sección 3 · Anatomía Premium y Superioridad",
      "caption": "Ingeniería y beneficios exclusivos",
      "imagePrompt": "High-impact 2:3 vertical e-commerce anatomical breakdown poster (Section 3) for openai/gpt-image-2.6-sunburst: macro 3D cutaway and detail callouts of ${input.productName} with glowing pointer lines, bold ALL-CAPS Spanish authority headline (max 4 words, zero spelling errors), 3 structured glassmorphic spec cards with 2-to-3-word uppercase labels, full-bleed 2:3."
    }`
        : ''
    }${
      requestedSheetCount >= 4
        ? `,
    {
      "role": "social_trust_specs",
      "title": "Sección 4 · Oferta Irresistible y Envío Gratis",
      "caption": "Cierre de Carta de Venta y Garantía Total",
      "imagePrompt": "Explosive high-converting 2:3 vertical e-commerce offer-closing poster (Section 4) for openai/gpt-image-2.6-sunburst: complete package showcase of ${input.productName}, giant emerald-and-gold badge 'ENVÍO GRATIS EN PARAGUAY' + 'PAGO AL RECIBIR', clear pack comparison 1x '${formatParaguayGs(price1)}' vs 2x '${formatParaguayGs(price2)}' (never write 'Gs. Gs.'), 'GARANTÍA 7 DÍAS', and bottom arrow cue 'Dale clic al botón de abajo'. Crisp ALL-CAPS Spanish lettering, full-bleed 2:3."
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
    : `CARTA DE VENTA VISUAL EN ${requestedSheetCount} IMÁGENES DE ALTÍSIMO IMPACTO (IMAGEN 1 = TRIPWIRE ENVOLVENTE ESPECTACULAR; IMÁGENES 2, 3 Y 4 = 3 SECCIONES DIFERENTES EXCLUSIVAS DEL PRODUCTO PRINCIPAL):

PRODUCTO PRINCIPAL EXCLUSIVO (IMÁGENES 2, 3 Y 4 — 3 SECCIONES DIFERENTES DE CARTA DE VENTA E-COMMERCE DE ALTÍSIMO IMPACTO):
- Nombre: ${input.productName}
- Ángulo persuasivo central: ${cleanAngleInput || `Solución definitiva completa muy superior al artículo inicial (${input.productDescription})`}
- Información base (PROHIBIDO COPIAR Y PEGAR LITERAL; redactar como Carta de Venta persuasiva): ${input.productDescription}
- Precio Normal tachado: ${formatParaguayGs(normalPrice)}
- Precio 1x: ${formatParaguayGs(price1)} (Pack 2x: ${formatParaguayGs(price2)}, Pack 3x: ${formatParaguayGs(price3)})
- Beneficio estrella en Cierre: ENVÍO GRATUITO EN TODO PARAGUAY + ${safeEntryName} GRATIS DE REGALO + Pago al recibir.
${visualDirectionInput ? `- Dirección visual asignada para el Producto Principal: ${visualDirectionInput}` : ''}

ARTÍCULO DE ENTRADA / TRIPWIRE (IMAGEN 1 — DISEÑO ENVOLVENTE 360° ESPECTACULAR DE ALTO IMPACTO):
- Nombre real investigado: ${safeEntryName}
- Síntesis investigada (NO copiar textos en crudo): ${resolvedEntryDesc || safeEntryName}
${resolvedEntrySpecs.length > 0 ? `- Especificaciones reales clave: ${resolvedEntrySpecs.join(' | ')}` : ''}
${resolvedEntryVisualBlueprint ? `- Blueprint visual exacto del producto físico a lucir espectacular en Imagen 1: ${resolvedEntryVisualBlueprint}` : ''}
- Precio ÚNICO cerrado (1 unidad): ${formatParaguayGs(entryPrice)} (En Imagen 1 está PROHIBIDO mencionar a "${input.productName}" y PROHIBIDO hablar de envío. El diseño de Imagen 1 debe ser ENVOLVENTE, ESPECTACULAR y de ALTÍSIMO IMPACTO VISUAL en atmósfera Azul Zafiro Eléctrico / Cian Neón / Ámbar Dorado).

CANTIDAD DE IMÁGENES A GENERAR: ${requestedSheetCount} (${
        requestedSheetCount === 4
          ? 'Imagen 1 = Tripwire Diseño Envolvente Espectacular; Imagen 2 = Sección 1 Producto Principal: Ruptura ¡ESPERÁ! + Gran Promesa Heroica de Carta de Venta; Imagen 3 = Sección 2 Producto Principal: Demostración de Poder, Transformación y Anatomía E-Commerce; Imagen 4 = Sección 3 Producto Principal: Cierre de Carta de Venta + Regalo Gratis + ENVÍO GRATUITO en Grande'
          : requestedSheetCount === 3
            ? 'Imagen 1 = Tripwire Envolvente; Imagen 2 = Sección 1 Principal Ruptura + Promesa; Imagen 3 = Sección 2 Principal Oferta Completa + Envío Gratuito'
            : 'Imagen 1 = Tripwire Envolvente; Imagen 2 = Carta de Venta Principal con Ruptura + Envío Gratuito'
      })

Devuelve EXCLUSIVAMENTE este JSON válido:
{
  "strategySummary": "Explicación breve interna de la Carta de Venta de ${requestedSheetCount} imágenes (Imagen 1 envolvente + ${Math.max(1, requestedSheetCount - 1)} secciones exclusivas del Producto Principal).",
  "recommendedAudioPreset": "warm_ambient",
  "researchedProductDescription": "Carta de venta sintetizada, persuasiva y redactada desde cero en español para ${input.productName} (cero copia-pega crudo).",
  "researchedEntryDescription": "Ficha comercial atractiva de ${safeEntryName} redactada desde cero (cero copia-pega crudo).",
  "sobrietyHeadline": "Titular magnético de alto impacto para ${safeEntryName} (máx 6 palabras).",
  "subheadline": "Beneficio envolvente y directo de ${safeEntryName} (máx 14 palabras).",
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
      "title": "Lámina 1 · ${safeEntryName} (Diseño Envolvente Alto Impacto)",
      "caption": "Presentación E-Commerce Envolvente 360°",
      "imagePrompt": "Spectacular 360-degree wrap-around high-impact 2:3 vertical e-commerce poster for openai/gpt-image-2.6-sunburst in flawless ALL-CAPS Paraguayan Spanish (immersive electric sapphire-cobalt, glowing cyan rim light & warm amber-gold volumetric studio atmosphere —diseño envolvente espectacular, COMPLETELY DIFFERENT palette from the dark obsidian sheets below): TOP ZONE bold ultra-crisp 3-to-4-word uppercase Spanish hook headline for '${safeEntryName}' (persuasive and magnetic, ZERO copy-paste clutter); CENTER HERO breathtaking floating 3D studio showcase of ONLY '${safeEntryName}'${resolvedEntryVisualBlueprint ? ` (${resolvedEntryVisualBlueprint})` : ''} wrapped in dynamic volumetric light beams and hyper-real surface detail; LOWER-MID ZONE 3 sleek wrap-around 3D glassmorphic icon badges with 2-to-3-word uppercase Spanish benefit labels (${resolvedEntrySpecs.slice(0, 3).join(' / ') || 'ALTA POTENCIA / USO INMEDIATO / CALIDAD PREMIUM'}); BOTTOM ZONE bold glowing price badge '${formatParaguayGs(entryPrice)}' and crisp directional cue 'Tocá el botón de abajo'. NEVER write 'Gs. Gs.', DO NOT mention '${input.productName}', DO NOT mention shipping. Full-bleed edge-to-edge 2:3."
    }${
      requestedSheetCount === 4
        ? `,
    {
      "role": "comparison_need",
      "title": "Lámina 2 · Sección 1 Producto Principal: ¡Esperá! Gran Promesa",
      "caption": "Ruptura persuasiva + Revelación Heroica del Producto Principal",
      "imagePrompt": "Explosive ultra high-impact 2:3 vertical e-commerce Visual Sales Letter Section 1 exclusively for '${input.productName}' for openai/gpt-image-2.6-sunburst — COMPLETELY DIFFERENT deep obsidian black, crimson neon alert & molten gold luxury palette: TOP 20% dramatic crimson-gold pattern-interrupt banner integrated inside the artwork with giant flawless ALL-CAPS Spanish text '¡ESPERÁ UN SEGUNDO!' + short 3-word persuasive sub-hook 'MIRÁ ESTO ANTES'; CENTER-BOTTOM 80% monumental 360-degree wrap-around hero reveal of '${input.productName}' in dramatic real-world action with a punchy 3-to-4-word ALL-CAPS persuasive sales-letter headline (no raw copy-paste, 100% exact Spanish spelling) and 2 high-impact gold-bordered callout badges showing why '${input.productName}' is on another level. Zero long paragraphs, zero typos, full-bleed edge-to-edge 2:3."
    },
    {
      "role": "authority_transformation",
      "title": "Lámina 3 · Sección 2 Producto Principal: Poder y Transformación",
      "caption": "Demostración E-Commerce y Anatomía de Alto Impacto",
      "imagePrompt": "Mind-blowing 2:3 vertical e-commerce Visual Sales Letter Section 2 exclusively for '${input.productName}' for openai/gpt-image-2.6-sunburst — deep obsidian, warm bronze & glowing emerald-gold luxury studio aesthetic: TOP bold 3-to-4-word ALL-CAPS persuasive Spanish headline highlighting the transformation and power of '${input.productName}'; CENTER dynamic wrap-around e-commerce composition showing '${input.productName}' transforming a real environment + macro engineering close-up detail; LOWER 3 structured high-impact 3D icon modules with 2-to-3-word ALL-CAPS persuasive Spanish benefit headlines (flawless orthography, zero copy-paste, zero small text). Full-bleed edge-to-edge 2:3."
    },
    {
      "role": "social_trust_specs",
      "title": "Lámina 4 · Sección 3 Producto Principal: Oferta Irresistible + Envío Gratis",
      "caption": "Cierre de Carta de Venta con Regalo Incluido y Envío Gratuito",
      "imagePrompt": "Grand-finale ultra high-impact 2:3 vertical e-commerce Visual Sales Letter Section 3 exclusively for '${input.productName}' for openai/gpt-image-2.6-sunburst — deep obsidian, radiant emerald neon & burnished imperial gold aesthetic: TOP bold ALL-CAPS Spanish closing headline 'OFERTA COMPLETA EXCLUSIVA'; CENTER monumental bundle showcase of '${input.productName}' + glowing gold bonus badge 'LLEVÁS ${safeEntryName.toUpperCase()} GRATIS'; LOWER unmissable giant emerald-gold banner 'ENVÍO GRATUITO EN TODO PARAGUAY' + 'PAGO AL RECIBIR' + bold price '${formatParaguayGs(price1)}' (write ONCE, never 'Gs. Gs.') + clean contrast note 'Solo artículo suelto: delivery ${formatParaguayGs(deliveryFee)}'; BOTTOM directional arrow cue 'Dale clic al botón de abajo'. 100% flawless uppercase Spanish spelling, zero garbled text, full-bleed edge-to-edge 2:3."
    }`
        : requestedSheetCount === 3
          ? `,
    {
      "role": "comparison_need",
      "title": "Lámina 2 · ¡ESPERÁ UN SEGUNDO! Apertura Carta de Venta Principal",
      "caption": "Ruptura visual brusca + Revelación del Producto Principal",
      "imagePrompt": "High-impact 2:3 vertical direct-response e-commerce Visual Sales Letter Section 1 for '${input.productName}' for openai/gpt-image-2.6-sunburst — COMPLETELY DIFFERENT dark obsidian & sharp crimson-gold palette from Sheet 1: TOP crimson alert bar '¡ESPERÁ UN SEGUNDO!', bold wrap-around hero reveal of '${input.productName}' with a short 3-to-4-word ALL-CAPS persuasive Spanish headline and 3 structured icon boxes, razor-sharp flawless Spanish typography, edge-to-edge 2:3."
    },
    {
      "role": "social_trust_specs",
      "title": "Lámina 3 · Cierre Carta de Venta: ${input.productName} + ${safeEntryName} GRATIS",
      "caption": "E-Commerce Altísimo Nivel con Envío Gratuito",
      "imagePrompt": "Mind-blowing ultra high-impact flagship 2:3 vertical e-commerce conversion poster for openai/gpt-image-2.6-sunburst in razor-sharp ALL-CAPS Paraguayan Spanish — COMPLETELY DIFFERENT deep obsidian dark, glowing emerald & burnished gold aesthetic from Sheet 1: giant bold 3-to-4-word Spanish headline for '${input.productName}', huge photorealistic center-stage hero showcase of '${input.productName}', 3 crisp dark-glass icon feature badges, unmissable emerald-gold banner 'ENVÍO GRATUITO EN TODO PARAGUAY' + '${safeEntryName} DE REGALO', clear price '${formatParaguayGs(price1)}' (write ONCE, never 'Gs. Gs.'), transparent note 'Solo ${safeEntryName} paga delivery ${formatParaguayGs(deliveryFee)}', and bottom downward arrow cue 'Dale clic al botón de abajo'. Edge-to-edge 2:3."
    }`
          : `,
    {
      "role": "social_trust_specs",
      "title": "¡ESPERÁ! ${input.productName} + ${safeEntryName} GRATIS + ENVÍO GRATUITO",
      "caption": "Entrada brusca integrada + Oferta Estrella de Locura",
      "imagePrompt": "Mind-blowing ultra high-impact flagship 2:3 vertical e-commerce conversion poster for openai/gpt-image-2.6-sunburst in razor-sharp Paraguayan Spanish — COMPLETELY DIFFERENT deep obsidian dark, crimson-alert, glowing emerald & metallic gold aesthetic from Sheet 1: TOP 18% sharp crimson-amber interrupt header integrated directly inside the artwork '¡ESPERÁ UN RATITO!' + 'MIRÁ LA OFERTA COMPLETA'; MIDDLE 58% spectacular photorealistic wrap-around hero showcase of '${input.productName}' in dramatic real-world action with giant bold 3-to-4-word ALL-CAPS Spanish headline and 3 crisp structured dark-glass icon feature cards; LOWER 16% high-impact emerald-gold offer bar 'ENVÍO GRATUITO EN TODO PARAGUAY' + 'LLEVÁS ${safeEntryName.toUpperCase()} DE REGALO' + clean price '${formatParaguayGs(price1)}' (never write 'Gs. Gs.') + transparent delivery note 'Solo ${safeEntryName}: delivery ${formatParaguayGs(deliveryFee)}'; BOTTOM 8% clean downward arrow cue 'Dale clic al botón de abajo'. Ultra-crisp legible Spanish typography, zero garbled text, full-bleed edge-to-edge 2:3."
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
            title: `Sección 2 · Demostración Real de ${input.productName}`,
            caption: 'Transformación inmediata en acción',
            imagePrompt: `High-impact 2:3 vertical e-commerce visual sales letter section 2 for '${input.productName}': dramatic wrap-around demonstration in action, bold 3-word ALL-CAPS Spanish headline 'POTENCIA SIN LÍMITES', 3 visual benefit cards with 2-word uppercase labels, full-bleed 2:3.`
          },
          {
            role: 'authority_transformation',
            title: `Sección 3 · Anatomía y Calidad de ${input.productName}`,
            caption: 'Ingeniería superior al detalle',
            imagePrompt: `High-impact 2:3 vertical e-commerce visual sales letter section 3 for '${input.productName}': macro 3D detail showcase, bold 3-word ALL-CAPS Spanish headline 'CALIDAD SUPERIOR REAL', 3 glassmorphic spec badges, full-bleed 2:3.`
          },
          {
            role: 'social_trust_specs',
            title: `Sección 4 · Oferta Completa con Envío Gratis`,
            caption: 'Cierre de Carta de Venta con Garantía',
            imagePrompt: `Explosive 2:3 vertical e-commerce offer-closing poster for '${input.productName}': giant emerald-gold banner 'ENVÍO GRATUITO EN TODO PARAGUAY' + 'PAGO AL RECIBIR', price '${formatParaguayGs(price1)}', bottom arrow 'Dale clic al botón de abajo', full-bleed 2:3.`
          }
        ]
      : [
          {
            role: 'comparison_need',
            title: `Lámina 2 · Sección 1 Principal: ¡Esperá un Segundo!`,
            caption: 'Ruptura de patrón + Gran Promesa del Producto Principal',
            imagePrompt: `Explosive 2:3 vertical e-commerce Visual Sales Letter Section 1 for '${input.productName}' in deep obsidian, crimson & gold: top banner '¡ESPERÁ UN SEGUNDO!', monumental 360-degree wrap-around hero reveal of '${input.productName}' with bold 3-word ALL-CAPS Spanish headline 'SOLUCIÓN DEFINITIVA TOTAL', full-bleed 2:3.`
          },
          {
            role: 'authority_transformation',
            title: `Lámina 3 · Sección 2 Principal: Poder y Transformación`,
            caption: 'Demostración E-Commerce y Anatomía de Alto Impacto',
            imagePrompt: `Mind-blowing 2:3 vertical e-commerce Visual Sales Letter Section 2 exclusively for '${input.productName}' in obsidian, bronze & emerald-gold: dynamic action scene + macro detail of '${input.productName}', bold 3-word ALL-CAPS Spanish headline 'RESULTADO PROFESIONAL HOY' and 3 3D icon badges, full-bleed 2:3.`
          },
          {
            role: 'social_trust_specs',
            title: `Lámina 4 · Sección 3 Principal: Oferta Completa + Envío Gratis`,
            caption: 'Cierre de Carta de Venta con Regalo y Envío Gratuito',
            imagePrompt: `Grand-finale 2:3 vertical e-commerce Visual Sales Letter Section 3 exclusively for '${input.productName}' in obsidian, emerald & gold: bundle showcase of '${input.productName}' + '${safeEntryName.toUpperCase()} DE REGALO' + giant banner 'ENVÍO GRATUITO EN TODO PARAGUAY' + 'PAGO AL RECIBIR' + price '${formatParaguayGs(price1)}' + bottom cue 'Dale clic al botón de abajo', full-bleed 2:3.`
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
        ? `Exact physical entry product geometry & clean wrap-around 3D studio appearance: ${resolvedEntryVisualBlueprint}.`
        : '',
      (isPrincipalOnly || i >= 1) && savedPrincipalImg && !savedPrincipalImg.startsWith('/')
        ? `Reference principal product style: ${input.productName}.`
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

