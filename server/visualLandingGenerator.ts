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
    : `Eres el Estratega Jefe de Embudos Duales de Psicología Inversa (COD Paraguay) y Director Creativo GPT-2.6 para páginas TRIPWIRE + PRODUCTO GANADOR EN LA MISMA PÁGINA.
TU MISIÓN: Que el operador trabaje 100% MANOS LIBRES sin tener que diseñar nada ni elegir estructura manual.
PSICOLOGÍA DEL EMBUDO DUAL QUE DOMINÁS:
- En la parte inicial se presenta el artículo accesible de entrada ("${safeEntryName}" a Gs. ${formatParaguayGs(Number(input.entryPriceGs || 20000))} + delivery) que captura el interés sin fricción.
- En la misma página se presenta el Producto Ganador ("${input.productName}") bajo un ÁNGULO SUPERIOR donde llevar el Producto Ganador incluye "${safeEntryName}" DE REGALO + ENVÍO GRATIS (psicología inversa racional).
- NUNCA uses la palabra "tripwire" ni "gancho trampa" en titulares ni textos orientados al cliente final.
REGLAS ESTRICTAS:
1. Si existe PÁGINA CLONADA, primero diagnosticá con exactitud qué ángulo de entrada y qué estética visual usaba la página original ("currentPageDiagnosis"), y proponé 3 opciones frescas con distinto enfoque psicológico y visual.
2. TÚ decides automáticamente "recommendedSheetCount" (2 o 3 según si la comparativa dual y contenido de caja justifican 3 láminas) y "recommendedAudioPreset" ('warm_ambient', 'soft_lounge' o 'commercial_pulse') más "visualDirection" cinematográfica para GPT-2.6.
3. Si el usuario conversa o pide otro enfoque ("userQuestion"), respondé con claridad ejecutiva en "assistantReply" y entregá 3 opciones nuevas alineadas a su pedido.`;

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
- Precio Principal 1x: Gs. ${formatParaguayGs(Number(input.price1Gs || 189000))} (Normal: Gs. ${formatParaguayGs(Number(input.normalPriceGs || 249000))})
${
  !isPrincipalOnly
    ? `- Artículo de Entrada (Tripwire): ${safeEntryName}
- Descripción entrada: ${input.entryProductDescription || safeEntryName}
- Precio Entrada: Gs. ${formatParaguayGs(Number(input.entryPriceGs || 20000))} + Delivery Gs. ${formatParaguayGs(Number(input.entryDeliveryFeeGs || 40000))}`
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
      "recommendedSheetCount": 3,
      "recommendedAudioPreset": "warm_ambient",
      "whyItConverts": "Por qué este ángulo y visual convierten mejor (y cómo se diferencia del clon si aplica).",
      "tripwireBridgeNote": "${isPrincipalOnly ? '' : 'Cómo conecta el artículo de entrada con este Producto Ganador en la misma página.'}"
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
    recommendedSheetCount: Number(o?.recommendedSheetCount) === 3 ? 3 : 2,
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
    recommendedSheetCount:
      Number(parsed?.recommendedSheetCount) === 3 || matchedRec.recommendedSheetCount === 3 ? 3 : 2,
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
    sheetCountMode === 'auto' ? (isPrincipalOnly ? 2 : 3) : sheetCountMode;
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
- Dirección de arte obligatoria para openai/gpt-image-2.6-sunburst: diseño editorial comercial de lujo (nivel campaña Apple / Dyson / Bang & Olufsen adaptada a hogar/consumo real en Paraguay), iluminación cinematográfica de estudio con profundidad 3D, materiales táctiles ultra nítidos, tipografía editorial española impecable sin errores ni letras cortadas, ocupación total borde a borde (edge-to-edge 3:4 sin marcos blancos), CERO estrellas chillonas, CERO stickers baratos de infoproducto.${visualDirectionBlock}${cloneDirectiveBlock}`
    : `Eres el Director Creativo Senior de Marcas Flagship y Psicología de Conversión en Paraguay.
Diseñas páginas gráficas verticales 100% visuales (cero bloques HTML intermedios: las láminas SON toda la presentación visual) mediante psicología inversa elegante entre un artículo accesible de entrada y el producto ganador completo.

REGLA INQUEBRANTABLE DE LENGUAJE Y CALIDAD GPT-2.6:
- JAMÁS escribas la palabra "tripwire", "gancho trampa" ni jerga técnica. Refiérete siempre al artículo de entrada por su nombre real: "${safeEntryName}".
- Precios obligatorios en Guaraníes de Paraguay ("Gs.") jamás en dólares.
- Dirección de arte obligatoria para openai/gpt-image-2.6-sunburst: diseño editorial comercial de lujo (nivel campaña flagship internacional adaptada a Paraguay), iluminación de estudio dramática y limpia, fotografía comercial realista de alto impacto visual y tipografía española nítida integrando la oferta sin parecer folleto barato, ocupación total borde a borde (edge-to-edge 3:4 sin marcos ni bordes blancos), CERO estrellas ni stickers baratos de infoproducto.${visualDirectionBlock}${cloneDirectiveBlock}`;

  const promptUserContent = isPrincipalOnly
    ? `PRODUCTO GANADOR ÚNICO (PÁGINA DIRECTA SIN ARTÍCULO SECUNDARIO):
- Nombre: ${input.productName}
- Enfoque / ángulo principal: ${cleanAngleInput || input.productDescription}
- Qué hace / descripción: ${input.productDescription}
- Precio Normal tachado: Gs. ${formatParaguayGs(normalPrice)}
- Precio 1x: Gs. ${formatParaguayGs(price1)} (Pack 2x: Gs. ${formatParaguayGs(price2)}, Pack 3x: Gs. ${formatParaguayGs(price3)})
- Envío Producto Principal: ENVÍO GRATIS en todo Paraguay + Pago en mano al recibir.
${visualDirectionInput ? `- Dirección visual asignada: ${visualDirectionInput}` : ''}

CANTIDAD DE LÁMINAS A DISEÑAR: ${sheetCountMode === 'auto' ? `Decidí automáticamente entre 2 o 3 láminas según el producto (sugerido: ${requestedSheetCount})` : requestedSheetCount}

Devuelve EXCLUSIVAMENTE este JSON válido:
{
  "strategySummary": "Explicación breve interna del enfoque principal de venta directa.",
  "recommendedAudioPreset": "warm_ambient",
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
      "imagePrompt": "Flagship full-bleed 3:4 commercial design poster for openai/gpt-image-2.6-sunburst in crisp Paraguayan Spanish: studio-lit hero showcase of ${input.productName} (${cleanAngleInput || 'superior result'}) in ${visualDirectionInput || 'dramatic modern architectural lighting'}, razor-sharp bold editorial Spanish headline integrated harmoniously, clean pricing callout 'Gs. ${formatParaguayGs(price1)} · Envío Gratis · Pagás al Recibir', luxury tactile realism, edge-to-edge artwork with zero outer frame."
    },
    {
      "role": "comparison_need",
      "title": "Beneficios y packs disponibles",
      "caption": "Comparativa clara de packs",
      "imagePrompt": "Flagship full-bleed 3:4 commercial infographic poster for openai/gpt-image-2.6-sunburst in crisp Spanish: macro visual breakdown of ${input.productName} key benefits and real materials, clean side-by-side comparison of 1 Unidad (Gs. ${formatParaguayGs(price1)}) and Pack 2x Ahorro (Gs. ${formatParaguayGs(price2)}) with 'Envío Gratis Paraguay', high-contrast studio typography, zero cheap stickers, edge-to-edge composition."
    }${
      requestedSheetCount === 3 || sheetCountMode === 'auto'
        ? `,
    {
      "role": "social_trust_specs",
      "title": "Garantía y contenido real en caja",
      "caption": "Lo que recibís en tu puerta",
      "imagePrompt": "Flagship full-bleed 3:4 commercial studio poster for openai/gpt-image-2.6-sunburst in crisp Spanish: clean overhead unboxing composition showing exact box contents of ${input.productName}, subtle refined emblem 'Garantía Escrita 7 Días · Pago Efectivo o QR al Recibir en Paraguay', architectural dark/warm studio aesthetic, edge-to-edge."
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
${visualDirectionInput ? `- Dirección visual asignada: ${visualDirectionInput}` : ''}

ARTÍCULO COMPLEMENTARIO DE ENTRADA (BLOQUE 1 DE LA MISMA PÁGINA):
- Nombre real: ${safeEntryName}
- Qué hace: ${resolvedEntryDesc || safeEntryName}
- Precio Normal comparativo: Gs. ${formatParaguayGs(entryNormal)}
- Precio Promo Entrada: Gs. ${formatParaguayGs(entryPrice)} + Delivery según zona (Gs. ${formatParaguayGs(deliveryFee)} aprox.)
- REGLA TRANSPARENTE: Si lleva el Producto Principal (${input.productName}), este complemento "${safeEntryName}" le va TOTALMENTE DE REGALO + ENVÍO GRATIS directo a su puerta.

CANTIDAD DE LÁMINAS A DISEÑAR: ${sheetCountMode === 'auto' ? `Decidí automáticamente entre 2 o 3 láminas según la complejidad de la oferta dual (sugerido: ${requestedSheetCount})` : requestedSheetCount}

Devuelve EXCLUSIVAMENTE este JSON válido:
{
  "strategySummary": "Explicación breve interna de la congruencia psicológica usada.",
  "recommendedAudioPreset": "warm_ambient",
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
      "title": "Presentación de oferta y producto ganador",
      "caption": "Pie corto sobrio",
      "imagePrompt": "Flagship full-bleed 3:4 commercial design poster for openai/gpt-image-2.6-sunburst in crisp Paraguayan Spanish: studio-lit hero composition showcasing both '${safeEntryName}' (entry option at Gs. ${formatParaguayGs(entryPrice)}) and flagship '${input.productName}' (${cleanAngleInput || 'solución completa'}) in ${visualDirectionInput || 'a modern upscale setting with dramatic commercial lighting'}, sharp editorial typography reading clearly in Spanish, refined badge 'Pago al Recibir · Paraguay', edge-to-edge zero white border."
    },
    {
      "role": "comparison_need",
      "title": "Comparativa clara de ambas opciones",
      "caption": "Comparación racional y visual",
      "imagePrompt": "Flagship full-bleed 3:4 editorial comparison sheet for openai/gpt-image-2.6-sunburst in crisp Spanish: clean visual split contrasting Option 1 Solo '${safeEntryName}' (Gs. ${formatParaguayGs(entryPrice)} + Delivery) vs Option 2 Paquete Completo '${input.productName}' (Gs. ${formatParaguayGs(price1)} con '${safeEntryName}' DE REGALO + Envío Gratis), ultra sharp Spanish labels, luxury commercial studio photography, zero cartoon icons, edge-to-edge."
    }${
      requestedSheetCount === 3 || sheetCountMode === 'auto'
        ? `,
    {
      "role": "social_trust_specs",
      "title": "Garantía y contenido real en caja",
      "caption": "Lo que recibís en tu puerta",
      "imagePrompt": "Flagship full-bleed 3:4 commercial studio poster for openai/gpt-image-2.6-sunburst in crisp Spanish: crisp tabletop presentation showing exact contents of '${input.productName}' alongside '${safeEntryName}', clean verified seal 'Garantía Escrita 7 Días · Pagás en Efectivo o QR al Recibir', luxury lighting, edge-to-edge."
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

