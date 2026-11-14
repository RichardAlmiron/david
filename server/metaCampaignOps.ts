import fs from 'node:fs';
import path from 'node:path';
import {
  getCloudinaryConfigStatus,
  uploadImageToCloudinary,
  type EnvKeyReader
} from './cloudinaryStore.ts';
import {
  buildMetaAttributionUrlTags,
  generateAaCid,
  registerAdEntitySnapshot
} from './metaPublishPreflight.ts';

export type FetchLike = typeof fetch;

const LOCKED_AD_ACCOUNT_ID = 'act_1048211497774834';
const LOCKED_PAGE_ID = '1050835598123904';
const LOCKED_PIXEL_ID = '1276031534651377';

/**
 * Resolves the exact destination URL for an individual Meta Ad creative.
 * Priority:
 * 1. Explicit `creative.targetLandingUrl` (e.g. chosen Tripwire page URL)
 * 2. Explicit `creative.targetProductSlug` applied to `campaignLandingUrl` (`?p=<slug>`)
 * 3. Campaign's default `campaignLandingUrl`
 * Whenever `creative.isEntryHookAd` is true, enforces `?modo=entrada`.
 */
export function resolveCreativeTargetLandingUrl(params: {
  campaignLandingUrl: string;
  creative?: any;
}): string {
  const fallbackUrl = String(params.campaignLandingUrl || '').trim();
  const cr = params.creative || {};
  const explicitTargetUrl = String(cr.targetLandingUrl || '').trim();
  const explicitTargetSlug = String(cr.targetProductSlug || '').trim();

  let resolved = fallbackUrl;
  if (explicitTargetUrl) {
    resolved = explicitTargetUrl;
  } else if (explicitTargetSlug) {
    try {
      const base = new URL(fallbackUrl || 'https://autoads360.up.railway.app/');
      base.searchParams.set('p', explicitTargetSlug);
      resolved = base.toString();
    } catch {
      const basePath = (fallbackUrl || 'https://autoads360.up.railway.app/').split('?')[0];
      resolved = `${basePath}?p=${encodeURIComponent(explicitTargetSlug)}`;
    }
  }

  if (cr?.isEntryHookAd) {
    try {
      const u = new URL(resolved);
      u.searchParams.set('modo', 'entrada');
      return u.toString();
    } catch {
      if (resolved.includes('modo=')) return resolved;
      const sep = resolved.includes('?') ? '&' : '?';
      return `${resolved}${sep}modo=entrada`;
    }
  }
  return resolved;
}

async function resolveImagePayloadForMeta(
  creative: any,
  aiAdsPublicDir: string,
  fetchFn: FetchLike
): Promise<{ bytes: string; url: string; sourceUrl: string }> {
  const rawImgUrl = String(creative?.aiGeneratedImageUrl || creative?.imageUrl || '').trim();
  const rawDataUrl = String(creative?.aiGeneratedImageDataUrl || '').trim();

  if (rawImgUrl.startsWith('https://') || rawImgUrl.startsWith('http://')) {
    try {
      const dl = await fetchFn(rawImgUrl, { signal: AbortSignal.timeout(20_000) });
      if (dl.ok) {
        const buf = Buffer.from(await dl.arrayBuffer());
        if (buf.length > 500) {
          return { bytes: buf.toString('base64'), url: rawImgUrl, sourceUrl: rawImgUrl };
        }
      }
    } catch {}
    return { bytes: '', url: rawImgUrl, sourceUrl: rawImgUrl };
  }

  if (rawImgUrl.startsWith('/')) {
    const cleanRel = rawImgUrl.replace(/^\/+/, '');
    const candidates = [
      path.resolve(aiAdsPublicDir, path.basename(cleanRel)),
      path.resolve(process.cwd(), 'public', cleanRel)
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const buf = fs.readFileSync(candidate);
        if (buf.length > 500) {
          return { bytes: buf.toString('base64'), url: '', sourceUrl: candidate };
        }
      }
    }
  }

  const fallbackData =
    rawImgUrl.startsWith('data:image/') && !rawImgUrl.startsWith('data:image/svg')
      ? rawImgUrl
      : rawDataUrl.startsWith('data:image/') && !rawDataUrl.startsWith('data:image/svg')
        ? rawDataUrl
        : '';
  if (fallbackData) {
    const b64 = fallbackData.split(',')[1] || '';
    if (b64.length > 500) {
      return { bytes: b64, url: '', sourceUrl: fallbackData };
    }
  }

  return { bytes: '', url: '', sourceUrl: '' };
}

/**
 * Replaces one specific published Meta Ad (e.g., Anuncio #5) inside an existing Campaign + Ad Set:
 * 1. Uploads new creative image to Cloudinary (when configured) and to Meta `/adimages`.
 * 2. Creates the replacement AdCreative (`aa_cid` tagged).
 * 3. Deletes the old Ad on Meta Graph API (`DELETE /v21.0/<oldAdId>`).
 * 4. Creates the new Ad in the exact same Ad Set (`POST /v21.0/<adAccountId>/ads`).
 */
export async function replacePublishedAdInMeta(params: {
  campaignRecord?: any;
  campaignId?: string;
  adSetId: string;
  oldAdId?: string;
  appendNew?: boolean;
  adIndex: number;
  product: any;
  creative: any;
  landingUrl: string;
  publishStatus?: 'ACTIVE' | 'PAUSED';
  accessToken: string;
  envReader?: EnvKeyReader;
  aiAdsPublicDir?: string;
  fetchFn?: FetchLike;
}): Promise<{
  ok: boolean;
  statusCode: number;
  error?: string;
  deletedAdId?: string;
  deletedFromMeta: boolean;
  appendedNew?: boolean;
  newAdId?: string;
  newCreativeId?: string;
  imageHash?: string;
  imageUrl?: string;
  cloudinaryPublicId?: string;
  updatedAdEntry?: any;
  updatedCampaignRecord?: any;
}> {
  const fetchFn: FetchLike = params.fetchFn || fetch;
  const adAccountId = LOCKED_AD_ACCOUNT_ID;
  const facebookPageId = LOCKED_PAGE_ID;
  const accessToken = String(params.accessToken || '').trim();
  const adSetId = String(params.adSetId || params.campaignRecord?.adSetId || '').trim();
  const campaignId = String(params.campaignId || params.campaignRecord?.campaignId || '').trim();
  const appendNew = Boolean(params.appendNew);
  const oldAdId = appendNew ? '' : String(params.oldAdId || '').trim();
  const adIndex = Number(params.adIndex || 0);
  const publishStatus: 'ACTIVE' | 'PAUSED' = params.publishStatus === 'PAUSED' ? 'PAUSED' : 'ACTIVE';
  const product = params.product || {};
  const cr = params.creative || {};
  const prodName = String(product.nombre || params.campaignRecord?.productName || 'Producto').trim();
  const landingUrl = String(
    params.landingUrl ||
      params.campaignRecord?.landingUrl ||
      `https://autoads360.up.railway.app/?p=${product.slug || 'producto'}`
  ).trim();
  const aiAdsPublicDir =
    params.aiAdsPublicDir || path.resolve(process.cwd(), 'public', 'assets', 'ai-ads');

  if (!accessToken) {
    return {
      ok: false,
      statusCode: 401,
      deletedFromMeta: false,
      error: 'Falta token de acceso válido de Meta Ads para reemplazar el anuncio.'
    };
  }
  if (!adSetId) {
    return {
      ok: false,
      statusCode: 400,
      deletedFromMeta: false,
      error: 'Falta adSetId del Grupo de Anuncios donde reemplazar el anuncio.'
    };
  }

  // Resolve image payload & ensure Cloudinary URL if configured
  const imgPayload = await resolveImagePayloadForMeta(cr, aiAdsPublicDir, fetchFn);
  let finalImageUrl = String(cr?.aiGeneratedImageUrl || cr?.imageUrl || '').trim();
  let cloudinaryPublicId = String(cr?.cloudinaryPublicId || '').trim();

  const cldStatus = getCloudinaryConfigStatus(params.envReader);
  if (
    cldStatus.configured &&
    !finalImageUrl.includes('res.cloudinary.com') &&
    (imgPayload.bytes || imgPayload.sourceUrl)
  ) {
    const upSource = imgPayload.bytes
      ? Buffer.from(imgPayload.bytes, 'base64')
      : imgPayload.sourceUrl;
    const cldUp = await uploadImageToCloudinary({
      source: upSource,
      productSlug: String(cr?.targetProductSlug || product.slug || params.campaignRecord?.productSlug || 'producto'),
      campaignId,
      adIndex,
      envReader: params.envReader
    });
    if (cldUp.ok && cldUp.secureUrl) {
      finalImageUrl = cldUp.secureUrl;
      cloudinaryPublicId = cldUp.publicId;
    }
  }

  if (!imgPayload.bytes && !imgPayload.url) {
    return {
      ok: false,
      statusCode: 400,
      deletedFromMeta: false,
      error: `No se encontró imagen válida para el Anuncio #${adIndex + 1} antes de publicar el reemplazo.`
    };
  }

  const callMeta = async (
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE',
    bodyData?: Record<string, any>
  ) => {
    const cleanEp = endpoint.replace(/^\/+/, '');
    const url = `https://graph.facebook.com/v21.0/${cleanEp}`;
    if (method === 'POST') {
      const resp = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(bodyData || {}), access_token: accessToken }),
        signal: AbortSignal.timeout(25_000)
      });
      return resp.json();
    }
    const resp = await fetchFn(
      `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(accessToken)}`,
      { method, signal: AbortSignal.timeout(20_000) }
    );
    return resp.json();
  };

  // Step 1: Upload replacement image to Meta Ad Account library
  const imgBody: Record<string, any> = {
    name: `${product.slug || 'prod'}-${appendNew ? 'inject' : 'replace'}-ad${adIndex + 1}-${Date.now()}.png`
  };
  if (imgPayload.bytes) imgBody.bytes = imgPayload.bytes;
  else if (imgPayload.url) imgBody.url = imgPayload.url;

  const imgRes: any = await callMeta(`${adAccountId}/adimages`, 'POST', imgBody);
  const imagesObj = imgRes?.images || {};
  const firstImg: any = Object.values(imagesObj)[0];
  const imageHash = String(firstImg?.hash || '');
  if (!imageHash) {
    return {
      ok: false,
      statusCode: 400,
      deletedFromMeta: false,
      error: `Meta rechazó la subida de imagen al publicar Anuncio #${adIndex + 1}: ${imgRes?.error?.message || 'sin image_hash'}`
    };
  }

  // Step 2: Create new AdCreative BEFORE touching the old live ad
  const adLandingUrl = resolveCreativeTargetLandingUrl({
    campaignLandingUrl: landingUrl,
    creative: cr
  });

  const aaCid = generateAaCid();
  const urlTags = buildMetaAttributionUrlTags({
    aaCid,
    hypothesisId: cr.hypothesisId,
    angleId: cr.angleId,
    creativeId: cr.id
  });
  const storySpec = {
    page_id: facebookPageId,
    link_data: {
      image_hash: imageHash,
      link: adLandingUrl,
      message: cr.primaryText || '',
      name: cr.headline || prodName,
      description: cr.descriptionText || '',
      call_to_action: {
        type: cr.ctaType || 'ORDER_NOW',
        value: { link: adLandingUrl }
      }
    }
  };
  const crRes: any = await callMeta(`${adAccountId}/adcreatives`, 'POST', {
    name: `Creative #${adIndex + 1} (${appendNew ? 'Inyección' : 'Reemplazo'}) · ${cr.angleTitle || cr.formatLabel || 'Anuncio'}`,
    object_story_spec: JSON.stringify(storySpec),
    url_tags: urlTags
  });
  const newCreativeId = String(crRes?.id || '');
  if (!newCreativeId) {
    return {
      ok: false,
      statusCode: 400,
      deletedFromMeta: false,
      error: `Meta rechazó el nuevo Creative para Anuncio #${adIndex + 1}: ${crRes?.error?.message || 'desconocido'}`
    };
  }

  // Step 3: Delete old Ad from Meta Ads (`DELETE /v21.0/<oldAdId>`) ONLY if replacing (never when appendNew=true)
  let deletedFromMeta = false;
  const isRealOldMetaAdId = Boolean(!appendNew && oldAdId && /^\d+$/.test(oldAdId));
  if (isRealOldMetaAdId) {
    try {
      const delRes: any = await callMeta(oldAdId, 'DELETE');
      deletedFromMeta = Boolean(delRes?.success === true);
    } catch {
      deletedFromMeta = false;
    }
  }

  // Step 4: Create the new Ad inside the exact same Ad Set
  const adName = `Anuncio #${adIndex + 1} · ${cr.formatLabel || 'Feed IA'}`;
  const adRes: any = await callMeta(`${adAccountId}/ads`, 'POST', {
    adset_id: adSetId,
    creative: JSON.stringify({ creative_id: newCreativeId }),
    name: adName,
    status: publishStatus
  });
  const newAdId = String(adRes?.id || '');
  if (!newAdId) {
    return {
      ok: false,
      statusCode: 400,
      deletedAdId: isRealOldMetaAdId ? oldAdId : undefined,
      deletedFromMeta,
      newCreativeId,
      imageHash,
      imageUrl: finalImageUrl,
      error: `El creativo se creó pero Meta rechazó publicar el nuevo Anuncio #${adIndex + 1}: ${adRes?.error?.message || 'desconocido'}`
    };
  }

  registerAdEntitySnapshot({
    productSlug: String(cr?.targetProductSlug || product.slug || params.campaignRecord?.productSlug || 'producto'),
    publisher: 'meta_direct',
    adAccountId,
    accountCurrency: String(params.campaignRecord?.accountCurrency || 'USD'),
    campaignId: campaignId || undefined,
    adsetId: adSetId,
    adId: newAdId,
    creativeId: cr.id || undefined,
    metaCreativeId: newCreativeId,
    aaCid,
    hypothesisId: cr.hypothesisId,
    angleId: cr.angleId,
    mediaType: 'image',
    headline: cr.headline,
    primaryText: cr.primaryText,
    ctaLabel: cr.ctaLabel,
    destinationUrl: adLandingUrl,
    urlTags,
    preflightStatus: 'ok',
    payloadSnapshot: {
      replacedFromAdId: oldAdId || null,
      appendedNew: appendNew,
      isEntryHookAd: Boolean(cr?.isEntryHookAd),
      targetProductId: cr?.targetProductId || null,
      targetProductSlug: cr?.targetProductSlug || null,
      targetProductName: cr?.targetProductName || null,
      cloudinaryImageUrl: finalImageUrl || null,
      cloudinaryPublicId: cloudinaryPublicId || null
    }
  });

  const nowIso = new Date().toISOString();
  const updatedAdEntry = {
    adId: newAdId,
    creativeId: newCreativeId,
    imageHash,
    adIndex,
    imageUrl: finalImageUrl,
    cloudinaryPublicId: cloudinaryPublicId || undefined,
    headline: cr.headline || '',
    primaryText: cr.primaryText || '',
    descriptionText: cr.descriptionText || '',
    ctaType: cr.ctaType || 'ORDER_NOW',
    ctaLabel: cr.ctaLabel || 'Pedir ahora',
    aspectRatio: cr.aspectRatio || (adIndex >= 4 ? '9:16' : '1:1'),
    aaCid,
    hypothesisId: cr.hypothesisId,
    angleId: cr.angleId,
    replacedFromAdId: oldAdId || undefined,
    isEntryHookAd: Boolean(cr?.isEntryHookAd),
    destinationUrl: adLandingUrl,
    targetProductId: cr?.targetProductId || undefined,
    targetProductSlug: cr?.targetProductSlug || undefined,
    targetProductName: cr?.targetProductName || undefined,
    updatedAt: nowIso,
    name: adName,
    formatLabel: cr.formatLabel || '',
    status: publishStatus
  };

  let updatedCampaignRecord = params.campaignRecord ? { ...params.campaignRecord } : undefined;
  if (updatedCampaignRecord) {
    const prevAds: any[] = Array.isArray(updatedCampaignRecord.publishedAds)
      ? [...updatedCampaignRecord.publishedAds]
      : [];
    if (appendNew) {
      prevAds.push(updatedAdEntry);
    } else {
      const matchIdx = prevAds.findIndex(
        (a, idx) =>
          (oldAdId && a?.adId === oldAdId) ||
          a?.adIndex === adIndex ||
          idx === adIndex
      );
      if (matchIdx >= 0) {
        prevAds[matchIdx] = { ...prevAds[matchIdx], ...updatedAdEntry };
      } else {
        prevAds.push(updatedAdEntry);
      }
    }
    updatedCampaignRecord.publishedAds = prevAds;
    const prevLogs = Array.isArray(updatedCampaignRecord.mcpStepLogs)
      ? updatedCampaignRecord.mcpStepLogs
      : [];
    updatedCampaignRecord.mcpStepLogs = [
      ...prevLogs,
      {
        step: prevLogs.length + 1,
        action: appendNew ? 'inject_ad_into_adset' : 'replace_published_ad',
        status: 'success',
        summary: appendNew
          ? `Anuncio #${adIndex + 1} inyectado al Grupo de Anuncios Meta (${newAdId})`
          : `Anuncio #${adIndex + 1} reemplazado en Meta (${oldAdId || 'anterior'} -> ${newAdId})`,
        timestamp: nowIso
      }
    ];
  }

  return {
    ok: true,
    statusCode: 200,
    deletedAdId: isRealOldMetaAdId ? oldAdId : undefined,
    deletedFromMeta,
    appendedNew: appendNew,
    newAdId,
    newCreativeId,
    imageHash,
    imageUrl: finalImageUrl,
    cloudinaryPublicId: cloudinaryPublicId || undefined,
    updatedAdEntry,
    updatedCampaignRecord
  };
}

/**
 * Fetches live Campaign -> Ad Set -> Ads hierarchy directly from Meta Graph API v21.0
 * and merges with local campaign metadata (preserving Cloudinary image URLs).
 */
export async function fetchLiveMetaCampaignHierarchy(params: {
  accessToken: string;
  adAccountId?: string;
  localCampaigns?: any[];
  fetchFn?: FetchLike;
}): Promise<{ ok: boolean; campaigns: any[]; error?: string }> {
  const fetchFn: FetchLike = params.fetchFn || fetch;
  const adAccountId = String(params.adAccountId || LOCKED_AD_ACCOUNT_ID).trim();
  const accessToken = String(params.accessToken || '').trim();
  const localCampaigns = Array.isArray(params.localCampaigns) ? params.localCampaigns : [];

  if (!accessToken) {
    return { ok: false, campaigns: localCampaigns, error: 'Missing Meta access token' };
  }

  const fields = encodeURIComponent(
    'id,name,status,objective,created_time,adsets{id,name,status,daily_budget,optimization_goal,targeting},ads{id,name,status,adset_id,creative{id,name,title,body,image_url,thumbnail_url,effective_object_story_id,effective_instagram_media_id,object_story_spec}}'
  );
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(
    adAccountId
  )}/campaigns?fields=${fields}&limit=25&access_token=${encodeURIComponent(accessToken)}`;

  try {
    const resp = await fetchFn(url, { signal: AbortSignal.timeout(25_000) });
    const json: any = await resp.json().catch(() => ({}));
    if (!resp.ok || json?.error) {
      return {
        ok: false,
        campaigns: localCampaigns,
        error: json?.error?.message || `HTTP ${resp.status} cargando campañas de Meta Ads`
      };
    }

    const metaList: any[] = Array.isArray(json?.data) ? json.data : [];
    const localByCampId = new Map<string, any>();
    for (const lc of localCampaigns) {
      if (lc?.campaignId) localByCampId.set(String(lc.campaignId), lc);
    }

    const cleanActDigits = adAccountId.replace(/^act_/, '');
    const mergedCampaigns: any[] = [];
    const seenCampIds = new Set<string>();

    for (const mc of metaList) {
      const cId = String(mc.id || '');
      if (!cId) continue;
      seenCampIds.add(cId);
      const localMatch = localByCampId.get(cId);
      const primaryAdSet = Array.isArray(mc.adsets?.data) ? mc.adsets.data[0] : null;
      const metaAdsList: any[] = Array.isArray(mc.ads?.data) ? mc.ads.data : [];
      const localAds: any[] = Array.isArray(localMatch?.publishedAds) ? localMatch.publishedAds : [];

      const mergedAds = metaAdsList.map((ma: any, idx: number) => {
        const localAdMatch =
          localAds.find(la => la?.adId && String(la.adId) === String(ma.id)) || localAds[idx];
        const linkData = ma?.creative?.object_story_spec?.link_data || {};
        const cldImg = localAdMatch?.imageUrl || '';
        const metaThumb = ma?.creative?.image_url || ma?.creative?.thumbnail_url || '';
        return {
          ...(localAdMatch || {}),
          adId: String(ma.id),
          creativeId: String(ma?.creative?.id || localAdMatch?.creativeId || ''),
          postId: String(ma?.creative?.effective_object_story_id || localAdMatch?.postId || ''),
          instagramMediaId: String(
            ma?.creative?.effective_instagram_media_id || localAdMatch?.instagramMediaId || ''
          ),
          adSetId: String(ma.adset_id || primaryAdSet?.id || localMatch?.adSetId || ''),
          adIndex: localAdMatch?.adIndex ?? idx,
          imageHash: localAdMatch?.imageHash || '',
          imageUrl: cldImg || metaThumb,
          headline: localAdMatch?.headline || ma?.creative?.title || linkData.name || '',
          primaryText: localAdMatch?.primaryText || ma?.creative?.body || linkData.message || '',
          descriptionText: localAdMatch?.descriptionText || linkData.description || '',
          ctaLabel: localAdMatch?.ctaLabel || 'Pedir ahora',
          name: String(ma.name || localAdMatch?.name || `Anuncio #${idx + 1}`),
          formatLabel: localAdMatch?.formatLabel || 'Anuncio Meta',
          status: ma.status || localAdMatch?.status || mc.status || 'ACTIVE'
        };
      });

      mergedCampaigns.push({
        ...(localMatch || {}),
        id: localMatch?.id || `meta-live-${cId}`,
        createdAt: localMatch?.createdAt || mc.created_time || new Date().toISOString(),
        productId: localMatch?.productId || '',
        productName: localMatch?.productName || String(mc.name || '').replace(/^\[.*?\]\s*/, ''),
        productSlug: localMatch?.productSlug || '',
        landingUrl: localMatch?.landingUrl || '',
        adAccountId,
        pixelId: localMatch?.pixelId || LOCKED_PIXEL_ID,
        objective: mc.objective || localMatch?.objective || 'OUTCOME_LEADS',
        campaignId: cId,
        campaignName: String(mc.name || localMatch?.campaignName || 'Campaña Meta'),
        campaignStatus: mc.status || 'ACTIVE',
        adSetId: String(primaryAdSet?.id || localMatch?.adSetId || ''),
        adSetName: String(primaryAdSet?.name || localMatch?.adSetName || 'Grupo de Anuncios PY'),
        adSetDailyBudgetMinor: primaryAdSet?.daily_budget || undefined,
        publishedAds: mergedAds.length > 0 ? mergedAds : localAds,
        executionMode: localMatch?.executionMode || 'meta_graph_api_direct',
        adsManagerUrl:
          localMatch?.adsManagerUrl ||
          `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(cleanActDigits)}`
      });
    }

    // Include local campaigns not returned in live API slice (e.g. older than limit or offline)
    for (const lc of localCampaigns) {
      if (lc?.campaignId && !seenCampIds.has(String(lc.campaignId))) {
        mergedCampaigns.push(lc);
      }
    }

    return { ok: true, campaigns: mergedCampaigns };
  } catch (err: any) {
    return { ok: false, campaigns: localCampaigns, error: err?.message || 'Error cargando campañas' };
  }
}
