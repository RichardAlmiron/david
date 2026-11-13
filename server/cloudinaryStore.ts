import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type EnvKeyReader = (key: string) => string;

export interface ResolvedCloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
  source: 'cloudinary_url' | 'env_vars' | 'missing';
}

export interface CloudinaryStatusSummary {
  configured: boolean;
  cloudName: string;
  folder: string;
  apiKeyPreview: string;
  missingVars: string[];
  uploadEndpoint: string;
  requiredEnvVars: string[];
  mode: 'signed_api' | 'not_configured';
}

export interface CloudinaryUploadResult {
  ok: boolean;
  secureUrl: string;
  publicId: string;
  assetId?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  error?: string;
}

export interface CloudinaryMediaResource {
  publicId: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  tags: string[];
  context?: Record<string, string>;
}

const DEFAULT_CLOUDINARY_FOLDER = 'noelux/autoads';

function defaultEnvReader(key: string): string {
  return String(process.env[key] || '').trim();
}

function cleanCred(val: unknown): string {
  return String(val || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

/**
 * Resolves Cloudinary credentials from either `CLOUDINARY_URL`
 * (`cloudinary://<api_key>:<api_secret>@<cloud_name>`) or individual
 * `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` env vars.
 */
export function resolveCloudinaryConfig(
  envReader: EnvKeyReader = defaultEnvReader
): ResolvedCloudinaryConfig {
  const folder = cleanCred(envReader('CLOUDINARY_UPLOAD_FOLDER')) || DEFAULT_CLOUDINARY_FOLDER;
  const rawUrl = cleanCred(envReader('CLOUDINARY_URL'));

  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'cloudinary:') {
        const apiKey = decodeURIComponent(parsed.username || '');
        const apiSecret = decodeURIComponent(parsed.password || '');
        const cloudName = decodeURIComponent(parsed.hostname || '');
        if (cloudName && apiKey && apiSecret) {
          return {
            cloudName,
            apiKey,
            apiSecret,
            folder: folder.replace(/^\/+|\/+$/g, '') || DEFAULT_CLOUDINARY_FOLDER,
            source: 'cloudinary_url'
          };
        }
      }
    } catch {
      // Fall back to discrete variables below if CLOUDINARY_URL is malformed
    }
  }

  const cloudName = cleanCred(envReader('CLOUDINARY_CLOUD_NAME'));
  const apiKey = cleanCred(envReader('CLOUDINARY_API_KEY'));
  const apiSecret = cleanCred(envReader('CLOUDINARY_API_SECRET'));

  return {
    cloudName,
    apiKey,
    apiSecret,
    folder: folder.replace(/^\/+|\/+$/g, '') || DEFAULT_CLOUDINARY_FOLDER,
    source: cloudName && apiKey && apiSecret ? 'env_vars' : 'missing'
  };
}

export function getCloudinaryConfigStatus(
  envReader: EnvKeyReader = defaultEnvReader
): CloudinaryStatusSummary {
  const cfg = resolveCloudinaryConfig(envReader);
  const missingVars: string[] = [];
  if (!cfg.cloudName) missingVars.push('CLOUDINARY_CLOUD_NAME');
  if (!cfg.apiKey) missingVars.push('CLOUDINARY_API_KEY');
  if (!cfg.apiSecret) missingVars.push('CLOUDINARY_API_SECRET');

  const configured = missingVars.length === 0;
  const apiKeyPreview =
    cfg.apiKey.length > 6
      ? `${cfg.apiKey.slice(0, 4)}••••${cfg.apiKey.slice(-2)}`
      : cfg.apiKey
        ? '••••'
        : '';

  return {
    configured,
    cloudName: cfg.cloudName,
    folder: cfg.folder,
    apiKeyPreview,
    missingVars,
    uploadEndpoint: cfg.cloudName
      ? `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/upload`
      : 'https://api.cloudinary.com/v1_1/<cloud_name>/image/upload',
    requiredEnvVars: [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'CLOUDINARY_UPLOAD_FOLDER'
    ],
    mode: configured ? 'signed_api' : 'not_configured'
  };
}

/**
 * Generates standard Cloudinary SHA-1 signature over alphabetically sorted non-empty parameters.
 */
export function buildCloudinarySignature(
  params: Record<string, string | number | undefined>,
  apiSecret: string
): string {
  const pairs = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && String(params[k]) !== '')
    .sort()
    .map(k => `${k}=${String(params[k])}`);
  const payload = `${pairs.join('&')}${apiSecret}`;
  return crypto.createHash('sha1').update(payload).digest('hex');
}

function sanitizeSegment(raw: string, fallback = 'asset'): string {
  const clean = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || fallback;
}

/**
 * Uploads an image buffer, data URL, local file path, or remote HTTP URL directly to Cloudinary
 * using signed server authentication (never touches Supabase storage or database).
 */
export async function uploadImageToCloudinary(options: {
  source: Buffer | string;
  mimeType?: string;
  productSlug?: string;
  campaignId?: string;
  adIndex?: number;
  tagList?: string[];
  publicIdOverride?: string;
  envReader?: EnvKeyReader;
}): Promise<CloudinaryUploadResult> {
  const cfg = resolveCloudinaryConfig(options.envReader);
  if (!cfg.cloudName || !cfg.apiKey || !cfg.apiSecret) {
    return {
      ok: false,
      secureUrl: '',
      publicId: '',
      error:
        'Cloudinary no está configurado aún en el servidor. Cargá CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET (o CLOUDINARY_URL) en Railway.'
    };
  }

  const slugSeg = sanitizeSegment(options.productSlug || 'producto', 'producto');
  const adSeg = typeof options.adIndex === 'number' ? `ad_${options.adIndex + 1}` : 'ad';
  const folder = `${cfg.folder}/${slugSeg}`;
  const publicId =
    cleanCred(options.publicIdOverride) ||
    `${slugSeg}_${adSeg}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const tags = Array.from(
    new Set([
      'autoads',
      slugSeg,
      adSeg,
      ...(options.campaignId ? [`camp_${sanitizeSegment(options.campaignId, 'camp')}`] : []),
      ...(Array.isArray(options.tagList) ? options.tagList.filter(Boolean) : [])
    ])
  ).join(',');

  const contextPairs = [
    `product_slug=${slugSeg}`,
    typeof options.adIndex === 'number' ? `ad_number=${options.adIndex + 1}` : '',
    options.campaignId ? `campaign_id=${cleanCred(options.campaignId)}` : ''
  ].filter(Boolean);
  const context = contextPairs.join('|');

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = buildCloudinarySignature(
    {
      context,
      folder,
      public_id: publicId,
      tags,
      timestamp
    },
    cfg.apiSecret
  );

  const form = new FormData();
  form.append('api_key', cfg.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder', folder);
  form.append('public_id', publicId);
  if (tags) form.append('tags', tags);
  if (context) form.append('context', context);

  if (Buffer.isBuffer(options.source)) {
    const mime = options.mimeType || 'image/png';
    const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
    const blob = new Blob([new Uint8Array(options.source)], { type: mime });
    form.append('file', blob, `${publicId}.${ext}`);
  } else {
    const srcStr = String(options.source || '').trim();
    if (srcStr.startsWith('data:image/')) {
      form.append('file', srcStr);
    } else if (srcStr.startsWith('http://') || srcStr.startsWith('https://')) {
      form.append('file', srcStr);
    } else if (srcStr && fs.existsSync(srcStr)) {
      const fileBuf = fs.readFileSync(srcStr);
      const ext = path.extname(srcStr).toLowerCase().replace('.', '') || 'png';
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      const blob = new Blob([new Uint8Array(fileBuf)], { type: mime });
      form.append('file', blob, `${publicId}.${ext}`);
    } else {
      return {
        ok: false,
        secureUrl: '',
        publicId: '',
        error: 'No se encontró imagen válida para subir a Cloudinary.'
      };
    }
  }

  try {
    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/upload`;
    const res = await fetch(endpoint, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(45_000)
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json?.secure_url) {
      return {
        ok: false,
        secureUrl: '',
        publicId: '',
        error: json?.error?.message || `Error HTTP ${res.status} al subir a Cloudinary.`
      };
    }

    return {
      ok: true,
      secureUrl: String(json.secure_url),
      publicId: String(json.public_id || `${folder}/${publicId}`),
      assetId: json.asset_id ? String(json.asset_id) : undefined,
      width: Number(json.width || 0) || undefined,
      height: Number(json.height || 0) || undefined,
      format: json.format ? String(json.format) : undefined,
      bytes: Number(json.bytes || 0) || undefined
    };
  } catch (err: any) {
    return {
      ok: false,
      secureUrl: '',
      publicId: '',
      error: err?.message || 'Error de red conectando con Cloudinary.'
    };
  }
}

/**
 * Lists images currently stored in Cloudinary under the configured AutoAds folder
 * so the AutoAds UI can display and verify media directly from Cloudinary's API.
 */
export async function listCloudinaryAutoAdsImages(
  envReader: EnvKeyReader = defaultEnvReader,
  productSlugFilter?: string,
  maxResults = 60
): Promise<{
  ok: boolean;
  configured: boolean;
  cloudName: string;
  folder: string;
  resources: CloudinaryMediaResource[];
  error?: string;
}> {
  const cfg = resolveCloudinaryConfig(envReader);
  if (!cfg.cloudName || !cfg.apiKey || !cfg.apiSecret) {
    return {
      ok: false,
      configured: false,
      cloudName: cfg.cloudName,
      folder: cfg.folder,
      resources: [],
      error: 'Cloudinary no configurado en variables de entorno.'
    };
  }

  const slugClean = productSlugFilter ? sanitizeSegment(productSlugFilter, '') : '';
  const prefix = slugClean ? `${cfg.folder}/${slugClean}` : cfg.folder;
  const authHeader = `Basic ${Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString('base64')}`;

  try {
    const qs = new URLSearchParams({
      prefix,
      max_results: String(Math.min(100, Math.max(1, maxResults))),
      tags: 'true',
      context: 'true',
      direction: 'desc'
    });
    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(
      cfg.cloudName
    )}/resources/image/upload?${qs.toString()}`;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(20_000)
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        cloudName: cfg.cloudName,
        folder: cfg.folder,
        resources: [],
        error: json?.error?.message || `HTTP ${res.status} al consultar Cloudinary API.`
      };
    }

    const rawList: any[] = Array.isArray(json?.resources) ? json.resources : [];
    const resources: CloudinaryMediaResource[] = rawList.map((r: any) => ({
      publicId: String(r.public_id || ''),
      secureUrl: String(r.secure_url || r.url || ''),
      format: String(r.format || 'png'),
      width: Number(r.width || 0),
      height: Number(r.height || 0),
      bytes: Number(r.bytes || 0),
      createdAt: String(r.created_at || ''),
      tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
      context: r.context?.custom && typeof r.context.custom === 'object' ? r.context.custom : undefined
    }));

    return {
      ok: true,
      configured: true,
      cloudName: cfg.cloudName,
      folder: cfg.folder,
      resources
    };
  } catch (err: any) {
    return {
      ok: false,
      configured: true,
      cloudName: cfg.cloudName,
      folder: cfg.folder,
      resources: [],
      error: err?.message || 'Error de red consultando Cloudinary API.'
    };
  }
}

export async function deleteCloudinaryImage(
  publicId: string,
  envReader: EnvKeyReader = defaultEnvReader
): Promise<{ ok: boolean; result?: string; error?: string }> {
  const cleanId = cleanCred(publicId);
  const cfg = resolveCloudinaryConfig(envReader);
  if (!cleanId || !cfg.cloudName || !cfg.apiKey || !cfg.apiSecret) {
    return { ok: false, error: 'Missing Cloudinary config or publicId' };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = buildCloudinarySignature({ public_id: cleanId, timestamp }, cfg.apiSecret);
  const form = new FormData();
  form.append('public_id', cleanId);
  form.append('api_key', cfg.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/destroy`,
      { method: 'POST', body: form, signal: AbortSignal.timeout(15_000) }
    );
    const json: any = await res.json().catch(() => ({}));
    return {
      ok: res.ok && (json?.result === 'ok' || json?.result === 'not found'),
      result: json?.result,
      error: json?.error?.message
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error deleting Cloudinary asset' };
  }
}

/**
 * Ensures NO AutoAds campaign images, Base64 data URLs, or workspace media blobs
 * are ever included in payloads written to Supabase (e.g. CFG-* snapshots).
 */
export function sanitizeConfigPayloadForSupabase<T extends Record<string, any>>(rawCfg: T): T {
  const clean: Record<string, any> = { ...rawCfg };
  delete clean.autoAdsWorkspaces;
  delete clean.pipeboardPublishedCampaigns;
  delete clean.metaDirectConfig;
  delete clean.pipeboardConfig;
  delete clean.openRouterApiKey;
  delete clean.deepgramApiKey;
  delete clean.capiAccessToken;
  return clean as T;
}

/**
 * Strips heavy Base64 data:image/* backups from AutoAds workspace creatives when writing locally
 * so workspace metadata relies strictly on Cloudinary HTTPS URLs or local Railway paths.
 */
export function stripBase64FromAutoAdsWorkspaces(rawState: any): any {
  if (!rawState || typeof rawState !== 'object') return rawState;
  const workspaces = rawState.workspaces;
  if (!workspaces || typeof workspaces !== 'object') return rawState;

  const cleanedWorkspaces: Record<string, any> = {};
  for (const key of Object.keys(workspaces)) {
    const ws = workspaces[key];
    if (!ws || typeof ws !== 'object') {
      cleanedWorkspaces[key] = ws;
      continue;
    }
    const creatives = Array.isArray(ws.creatives)
      ? ws.creatives.map((cr: any) => {
          if (!cr || typeof cr !== 'object') return cr;
          const imgUrl = String(cr.aiGeneratedImageUrl || '');
          const dataUrl = String(cr.aiGeneratedImageDataUrl || '');
          // Never store raw base64 blobs once a Cloudinary URL or local file path exists
          const keepDataUrl =
            !imgUrl && dataUrl.startsWith('data:image/svg')
              ? dataUrl
              : undefined;
          const next = { ...cr };
          if (keepDataUrl) {
            next.aiGeneratedImageDataUrl = keepDataUrl;
          } else {
            delete next.aiGeneratedImageDataUrl;
          }
          return next;
        })
      : ws.creatives;
    cleanedWorkspaces[key] = { ...ws, creatives };
  }
  return {
    ...rawState,
    workspaces: cleanedWorkspaces
  };
}
