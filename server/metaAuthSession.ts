import fs from 'node:fs';
import {
  deleteSupabaseCodigos,
  insertOrUpdateSupabaseCodigo,
  querySupabaseCodigos
} from './whatsappEngine.ts';

export const OFFICIAL_META_AD_ACCOUNT_ID = 'act_1048211497774834';
export const OFFICIAL_META_PAGE_ID = '1050835598123904';
export const OFFICIAL_META_PIXEL_ID = '1276031534651377';
export const REQUIRED_META_ADS_SCOPES = [
  'ads_management',
  'ads_read',
  'pages_show_list',
  'pages_read_engagement',
  'business_management'
] as const;

export const META_AUTH_VAULT_CODE = 'METAAUTH-v1';

export interface MetaVaultPayload {
  metaDirectConfig: {
    appId?: string;
    appSecret?: string;
    accessToken?: string;
    userId?: string;
    userName?: string;
    connectedAt?: string;
    expiresAt?: string;
    adAccountId?: string;
    adAccountName?: string;
    pixelId?: string;
    pixelName?: string;
    tokenStatus?: 'valid' | 'invalid' | 'missing';
    lastTokenError?: string;
  };
  pipeboardConfig: {
    pipeboardApiToken?: string;
    pipeboardMcpEndpoint?: string;
    selectedAdAccountId?: string;
    selectedAdAccountName?: string;
    selectedFacebookPageId?: string;
    dailyBudgetGs?: number;
    defaultPublishStatus?: string;
  };
  updatedAt: string;
}

export interface ClassifiedMetaError {
  isTokenInvalid: boolean;
  isPermissionError: boolean;
  requiresReauth: boolean;
  code?: number;
  subcode?: number;
  type?: string;
  rawMessage: string;
  userMessage: string;
}

export interface MetaPermissionAuditResult {
  tokenValid: boolean;
  user: { id: string; name: string } | null;
  grantedPermissions: string[];
  declinedPermissions: string[];
  missingPermissions: string[];
  hasAdsManagement: boolean;
  adAccountAccessible: boolean;
  adAccountError?: string;
  adAccount?: any;
  pages: any[];
  hasTargetPage: boolean;
  tokenError?: ClassifiedMetaError;
}

export function isValidNumericMetaAppId(value: unknown): boolean {
  const clean = String(value ?? '').trim();
  if (!clean) return false;
  return /^\d{8,24}$/.test(clean);
}

export function isValidMetaAppSecret(value: unknown): boolean {
  const clean = String(value ?? '').trim();
  if (!clean) return false;
  if (clean.includes('@') || /\s/.test(clean)) return false;
  if (clean === 'qqwwee112233') return false;
  return clean.length >= 16 && /^[A-Za-z0-9_-]+$/.test(clean);
}

export function isValidMetaAccessToken(value: unknown): boolean {
  const clean = String(value ?? '').trim();
  if (!clean) return false;
  if (clean.includes('@') || /\s/.test(clean)) return false;
  return /^EAA[A-Za-z0-9_|.-]{30,}$/.test(clean);
}

export function classifyMetaGraphError(errInput: any): ClassifiedMetaError {
  const errObj = errInput?.error && typeof errInput.error === 'object' ? errInput.error : errInput;
  const code = typeof errObj?.code === 'number' ? errObj.code : Number(errObj?.code) || undefined;
  const subcode =
    typeof errObj?.error_subcode === 'number'
      ? errObj.error_subcode
      : Number(errObj?.error_subcode) || undefined;
  const type = errObj?.type ? String(errObj.type) : undefined;
  const rawMessage = String(errObj?.message || errInput?.message || errInput || 'Error desconocido de Meta Graph API').trim();

  const isPerm =
    code === 200 ||
    code === 10 ||
    code === 294 ||
    /ads_management|business_management|permissions error|not authorized to access ad account|does not have permission/i.test(rawMessage);

  const isOAuth190 =
    code === 190 ||
    (!isPerm &&
      ((type === 'OAuthException' && (!code || code === 102)) ||
        /error validating access token|session has expired|invalid oauth access token|malformed access token/i.test(rawMessage)));

  if (isOAuth190) {
    let detail = rawMessage;
    if (subcode === 463) {
      detail = 'El token de acceso de Meta Ads venció (subcode 463).';
    } else if (subcode === 460 || subcode === 458 || subcode === 459 || subcode === 467) {
      detail = 'Meta invalidó la sesión anterior (cambio de contraseña, cierre de sesión o autorización revocada).';
    }
    return {
      isTokenInvalid: true,
      isPermissionError: false,
      requiresReauth: true,
      code,
      subcode,
      type,
      rawMessage,
      userMessage: `${detail} (${rawMessage}). Volvé a iniciar sesión en Facebook OAuth o cargá un Token vigente (EAA...).`
    };
  }

  if (isPerm) {
    return {
      isTokenInvalid: false,
      isPermissionError: true,
      requiresReauth: true,
      code,
      subcode,
      type,
      rawMessage,
      userMessage: `Faltan permisos de Marketing API en Meta (${rawMessage}). Asegurate de aprobar ads_management, ads_read, business_management y pages_read_engagement para la cuenta ${OFFICIAL_META_AD_ACCOUNT_ID}.`
    };
  }

  return {
    isTokenInvalid: false,
    isPermissionError: false,
    requiresReauth: false,
    code,
    subcode,
    type,
    rawMessage,
    userMessage: rawMessage
  };
}

export interface MetaAppVerificationResult {
  valid: boolean;
  invalidAppId: boolean;
  invalidAppSecret: boolean;
  networkSkipped?: boolean;
  code?: number;
  message?: string;
}

export async function verifyMetaAppCredentialsLive(params: {
  appId: string;
  appSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<MetaAppVerificationResult> {
  const appId = String(params.appId || '').trim();
  const appSecret = String(params.appSecret || '').trim();
  const fetchFn = params.fetchImpl || fetch;

  if (!isValidNumericMetaAppId(appId)) {
    return {
      valid: false,
      invalidAppId: true,
      invalidAppSecret: false,
      message: 'El Meta App ID debe contener únicamente dígitos numéricos.'
    };
  }
  if (!isValidMetaAppSecret(appSecret)) {
    return {
      valid: false,
      invalidAppId: false,
      invalidAppSecret: true,
      message: 'El Meta App Secret no tiene un formato válido.'
    };
  }

  try {
    const url =
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&grant_type=client_credentials`;
    const resp = await fetchFn(url, { signal: AbortSignal.timeout(6000) });
    const json: any = await resp.json().catch(() => ({}));
    if (resp.ok && json?.access_token && !json?.error) {
      return { valid: true, invalidAppId: false, invalidAppSecret: false };
    }

    const errMsg = String(json?.error?.message || `HTTP ${resp.status}`);
    const errCode = Number(json?.error?.code) || undefined;
    const isInvalidAppId =
      errCode === 101 ||
      /invalid client id|invalid application id|error validating application/i.test(errMsg);
    const isInvalidSecret =
      !isInvalidAppId &&
      (/error validating client secret|invalid client secret/i.test(errMsg) || errCode === 1);

    if (isInvalidAppId) {
      return {
        valid: false,
        invalidAppId: true,
        invalidAppSecret: false,
        code: errCode,
        message: `Meta rechazó el App ID (${appId.slice(0, 6)}••••): "${errMsg}" (PLATFORM__INVALID_APP_ID). La app fue eliminada, deshabilitada o el App ID es incorrecto.`
      };
    }

    if (isInvalidSecret) {
      return {
        valid: false,
        invalidAppId: false,
        invalidAppSecret: true,
        code: errCode,
        message: `Meta rechazó el App Secret para la App ${appId.slice(0, 6)}••••: "${errMsg}". Verificá la clave secreta en developers.facebook.com.`
      };
    }

    return {
      valid: false,
      invalidAppId: true,
      invalidAppSecret: true,
      code: errCode,
      message: `Meta rechazó las credenciales OAuth: ${errMsg}`
    };
  } catch (err: any) {
    return {
      valid: true,
      invalidAppId: false,
      invalidAppSecret: false,
      networkSkipped: true,
      message: err?.message
    };
  }
}

export async function auditMetaTokenAndPermissions(params: {
  accessToken: string;
  adAccountId?: string;
  pageId?: string;
  fetchImpl?: typeof fetch;
}): Promise<MetaPermissionAuditResult> {
  const token = String(params.accessToken || '').trim();
  const adAccountId = String(params.adAccountId || OFFICIAL_META_AD_ACCOUNT_ID).trim();
  const pageId = String(params.pageId || OFFICIAL_META_PAGE_ID).trim();
  const fetchFn = params.fetchImpl || fetch;

  if (!isValidMetaAccessToken(token)) {
    const err = classifyMetaGraphError({
      code: 190,
      type: 'OAuthException',
      message: 'El token guardado no tiene el formato válido de Meta (EAA...).'
    });
    return {
      tokenValid: false,
      user: null,
      grantedPermissions: [],
      declinedPermissions: [],
      missingPermissions: [...REQUIRED_META_ADS_SCOPES],
      hasAdsManagement: false,
      adAccountAccessible: false,
      pages: [],
      hasTargetPage: false,
      tokenError: err
    };
  }

  const meRes = await fetchFn(
    `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`
  );
  const meJson: any = await meRes.json().catch(() => ({}));

  if (!meRes.ok || meJson?.error) {
    return {
      tokenValid: false,
      user: null,
      grantedPermissions: [],
      declinedPermissions: [],
      missingPermissions: [...REQUIRED_META_ADS_SCOPES],
      hasAdsManagement: false,
      adAccountAccessible: false,
      pages: [],
      hasTargetPage: false,
      tokenError: classifyMetaGraphError(meJson?.error || { message: `HTTP ${meRes.status}` })
    };
  }

  const [permRes, accRes, pagesRes] = await Promise.all([
    fetchFn(
      `https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(token)}`
    ).catch(() => null),
    fetchFn(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(
        adAccountId
      )}?fields=id,account_id,name,currency,account_status,business_name&access_token=${encodeURIComponent(token)}`
    ).catch(() => null),
    fetchFn(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,category,access_token&access_token=${encodeURIComponent(token)}`
    ).catch(() => null)
  ]);

  const grantedPermissions: string[] = [];
  const declinedPermissions: string[] = [];
  if (permRes) {
    const permJson: any = await permRes.json().catch(() => ({}));
    const rows: any[] = Array.isArray(permJson?.data) ? permJson.data : [];
    for (const row of rows) {
      const pName = String(row?.permission || '').trim();
      const status = String(row?.status || '').trim().toLowerCase();
      if (!pName) continue;
      if (status === 'granted') grantedPermissions.push(pName);
      else if (status === 'declined') declinedPermissions.push(pName);
    }
  }

  // Si /me/permissions devolvió datos, verificar los scopes críticos
  const missingPermissions =
    grantedPermissions.length > 0 || declinedPermissions.length > 0
      ? REQUIRED_META_ADS_SCOPES.filter((s) => !grantedPermissions.includes(s))
      : [];
  const hasAdsManagement =
    grantedPermissions.length === 0 ? true : grantedPermissions.includes('ads_management');

  let adAccountAccessible = false;
  let adAccountError: string | undefined;
  let adAccount: any = undefined;
  if (accRes) {
    const accJson: any = await accRes.json().catch(() => ({}));
    if (accRes.ok && accJson?.id && !accJson?.error) {
      adAccountAccessible = true;
      adAccount = accJson;
    } else if (accJson?.error) {
      adAccountError = classifyMetaGraphError(accJson.error).userMessage;
    }
  }

  let pages: any[] = [];
  if (pagesRes) {
    const pagesJson: any = await pagesRes.json().catch(() => ({}));
    if (Array.isArray(pagesJson?.data)) {
      pages = pagesJson.data;
    }
  }
  const hasTargetPage = pages.some((p: any) => String(p?.id) === pageId);

  return {
    tokenValid: true,
    user: { id: String(meJson.id || ''), name: String(meJson.name || 'Usuario Meta') },
    grantedPermissions,
    declinedPermissions,
    missingPermissions,
    hasAdsManagement,
    adAccountAccessible,
    adAccountError,
    adAccount,
    pages,
    hasTargetPage
  };
}

export function sanitizeStoredMetaDirectConfig(
  cfg: Record<string, any>,
  envReader: (key: string) => string,
  envWriter?: (key: string, val: string) => void
): {
  appId: string;
  appSecret: string;
  corruptedAppIdCleared: boolean;
  corruptedAppSecretCleared: boolean;
  corruptedReason?: string;
} {
  if (!cfg.metaDirectConfig || typeof cfg.metaDirectConfig !== 'object') {
    cfg.metaDirectConfig = {};
  }

  let corruptedAppIdCleared = false;
  let corruptedAppSecretCleared = false;
  const reasons: string[] = [];

  const cfgAppId = String(cfg.metaDirectConfig.appId || '').trim();
  const envAppId = String(envReader('META_APP_ID') || '').trim();
  const cfgAppSecret = String(cfg.metaDirectConfig.appSecret || '').trim();
  const envAppSecret = String(envReader('META_APP_SECRET') || '').trim();

  if (cfgAppId && !isValidNumericMetaAppId(cfgAppId)) {
    corruptedAppIdCleared = true;
    reasons.push(`Meta App ID inválido guardado ("${cfgAppId.slice(0, 10)}...")`);
    delete cfg.metaDirectConfig.appId;
  }
  if (envAppId && !isValidNumericMetaAppId(envAppId)) {
    corruptedAppIdCleared = true;
    reasons.push(`META_APP_ID inválido en entorno`);
    if (envWriter) envWriter('META_APP_ID', '');
  }

  if (cfgAppSecret && !isValidMetaAppSecret(cfgAppSecret)) {
    corruptedAppSecretCleared = true;
    reasons.push('Meta App Secret inválido o corrompido por autocompletado');
    delete cfg.metaDirectConfig.appSecret;
  }
  if (envAppSecret && !isValidMetaAppSecret(envAppSecret)) {
    corruptedAppSecretCleared = true;
    reasons.push('META_APP_SECRET inválido en entorno');
    if (envWriter) envWriter('META_APP_SECRET', '');
  }

  const validEnvAppId = isValidNumericMetaAppId(envReader('META_APP_ID'))
    ? String(envReader('META_APP_ID')).trim()
    : '';
  const validCfgAppId = isValidNumericMetaAppId(cfg.metaDirectConfig.appId)
    ? String(cfg.metaDirectConfig.appId).trim()
    : '';
  if (validEnvAppId && validCfgAppId && validEnvAppId !== validCfgAppId) {
    cfg.metaDirectConfig.appId = validEnvAppId;
    corruptedAppIdCleared = true;
    reasons.push(`store_config desactualizado sincronizado con META_APP_ID de entorno`);
  }

  const validEnvAppSecret = isValidMetaAppSecret(envReader('META_APP_SECRET'))
    ? String(envReader('META_APP_SECRET')).trim()
    : '';
  const validCfgAppSecret = isValidMetaAppSecret(cfg.metaDirectConfig.appSecret)
    ? String(cfg.metaDirectConfig.appSecret).trim()
    : '';
  if (validEnvAppSecret && validCfgAppSecret && validEnvAppSecret !== validCfgAppSecret) {
    cfg.metaDirectConfig.appSecret = validEnvAppSecret;
    corruptedAppSecretCleared = true;
  }

  const resolvedAppId = validEnvAppId || validCfgAppId || '';
  const resolvedAppSecret = validEnvAppSecret || validCfgAppSecret || '';

  return {
    appId: resolvedAppId,
    appSecret: resolvedAppSecret,
    corruptedAppIdCleared,
    corruptedAppSecretCleared,
    corruptedReason: reasons.length > 0 ? reasons.join(' · ') : undefined
  };
}

let lastCloudMetaHydrateAttemptMs = 0;

export async function saveMetaVaultToSupabase(
  cfg: Record<string, any>,
  deps?: {
    deleteFn?: typeof deleteSupabaseCodigos;
    upsertFn?: typeof insertOrUpdateSupabaseCodigo;
  }
): Promise<boolean> {
  try {
    const deleteFn = deps?.deleteFn || deleteSupabaseCodigos;
    const upsertFn = deps?.upsertFn || insertOrUpdateSupabaseCodigo;
    const md = cfg?.metaDirectConfig || {};
    const pb = cfg?.pipeboardConfig || {};

    const payload: MetaVaultPayload = {
      metaDirectConfig: {
        ...(isValidNumericMetaAppId(md.appId) ? { appId: String(md.appId).trim() } : {}),
        ...(isValidMetaAppSecret(md.appSecret) ? { appSecret: String(md.appSecret).trim() } : {}),
        ...(isValidMetaAccessToken(md.accessToken) ? { accessToken: String(md.accessToken).trim() } : {}),
        ...(md.userId ? { userId: String(md.userId) } : {}),
        ...(md.userName ? { userName: String(md.userName) } : {}),
        ...(md.connectedAt ? { connectedAt: String(md.connectedAt) } : {}),
        ...(md.expiresAt ? { expiresAt: String(md.expiresAt) } : {}),
        adAccountId: String(md.adAccountId || OFFICIAL_META_AD_ACCOUNT_ID),
        ...(md.adAccountName ? { adAccountName: String(md.adAccountName) } : {}),
        pixelId: String(md.pixelId || OFFICIAL_META_PIXEL_ID),
        ...(md.pixelName ? { pixelName: String(md.pixelName) } : {}),
        ...(md.tokenStatus ? { tokenStatus: md.tokenStatus } : {}),
        ...(md.lastTokenError ? { lastTokenError: String(md.lastTokenError) } : {})
      },
      pipeboardConfig: {
        ...(pb.pipeboardApiToken ? { pipeboardApiToken: String(pb.pipeboardApiToken).trim() } : {}),
        ...(pb.pipeboardMcpEndpoint ? { pipeboardMcpEndpoint: String(pb.pipeboardMcpEndpoint).trim() } : {}),
        selectedAdAccountId: String(pb.selectedAdAccountId || OFFICIAL_META_AD_ACCOUNT_ID),
        ...(pb.selectedAdAccountName ? { selectedAdAccountName: String(pb.selectedAdAccountName) } : {}),
        selectedFacebookPageId: String(pb.selectedFacebookPageId || OFFICIAL_META_PAGE_ID),
        ...(pb.dailyBudgetGs ? { dailyBudgetGs: Number(pb.dailyBudgetGs) } : {}),
        ...(pb.defaultPublishStatus ? { defaultPublishStatus: String(pb.defaultPublishStatus) } : {})
      },
      updatedAt: new Date().toISOString()
    };

    await deleteFn(`eq.${META_AUTH_VAULT_CODE}`).catch(() => {});
    return await upsertFn(META_AUTH_VAULT_CODE, JSON.stringify(payload));
  } catch {
    return false;
  }
}

export async function hydrateMetaVaultIntoStoreConfig(params: {
  cfgFile: string;
  envReader: (key: string) => string;
  envWriter?: (key: string, val: string) => void;
  forceRefresh?: boolean;
  queryFn?: typeof querySupabaseCodigos;
}): Promise<{ hydrated: boolean; cfg: Record<string, any> }> {
  let cfg: Record<string, any> = {};
  if (fs.existsSync(params.cfgFile)) {
    try {
      cfg = JSON.parse(fs.readFileSync(params.cfgFile, 'utf-8') || '{}') || {};
    } catch {
      cfg = {};
    }
  }

  const sanitized = sanitizeStoredMetaDirectConfig(cfg, params.envReader, params.envWriter);
  let cfgModified = sanitized.corruptedAppIdCleared || sanitized.corruptedAppSecretCleared;

  const hasLocalToken = isValidMetaAccessToken(cfg?.metaDirectConfig?.accessToken);
  const hasLocalAppCreds = Boolean(sanitized.appId && sanitized.appSecret);
  const now = Date.now();
  const shouldQueryCloud =
    params.forceRefresh || (!hasLocalToken && (!hasLocalAppCreds || now - lastCloudMetaHydrateAttemptMs > 15000));

  let hydrated = false;
  if (shouldQueryCloud) {
    lastCloudMetaHydrateAttemptMs = now;
    try {
      const queryFn = params.queryFn || querySupabaseCodigos;
      const rows = await queryFn({
        codeFilter: `eq.${META_AUTH_VAULT_CODE}`,
        orderDesc: true,
        limit: 1,
        timeoutMs: 6000
      });
      const rawJson = rows?.[0]?.dispositivo;
      if (rawJson) {
        const cloudVault: MetaVaultPayload = JSON.parse(String(rawJson));
        const localUpdatedMs = cfg?.metaDirectConfig?.updatedAt
          ? new Date(cfg.metaDirectConfig.updatedAt).getTime()
          : 0;
        const cloudUpdatedMs = cloudVault?.updatedAt ? new Date(cloudVault.updatedAt).getTime() : 0;

        if (!cfg.metaDirectConfig) cfg.metaDirectConfig = {};
        if (!cfg.pipeboardConfig) cfg.pipeboardConfig = {};

        const cm = cloudVault?.metaDirectConfig || {};
        const envHasValidAppId = isValidNumericMetaAppId(params.envReader('META_APP_ID'));
        const envHasValidAppSecret = isValidMetaAppSecret(params.envReader('META_APP_SECRET'));
        if (!envHasValidAppId && isValidNumericMetaAppId(cm.appId) && !isValidNumericMetaAppId(cfg.metaDirectConfig.appId)) {
          cfg.metaDirectConfig.appId = cm.appId;
          if (params.envWriter && cm.appId) params.envWriter('META_APP_ID', cm.appId);
          cfgModified = true;
        }
        if (!envHasValidAppSecret && isValidMetaAppSecret(cm.appSecret) && !isValidMetaAppSecret(cfg.metaDirectConfig.appSecret)) {
          cfg.metaDirectConfig.appSecret = cm.appSecret;
          if (params.envWriter && cm.appSecret) params.envWriter('META_APP_SECRET', cm.appSecret);
          cfgModified = true;
        }
        if (
          isValidMetaAccessToken(cm.accessToken) &&
          (!hasLocalToken || cloudUpdatedMs > localUpdatedMs)
        ) {
          const preservedAppId = envHasValidAppId
            ? String(params.envReader('META_APP_ID')).trim()
            : cfg.metaDirectConfig.appId;
          const preservedAppSecret = envHasValidAppSecret
            ? String(params.envReader('META_APP_SECRET')).trim()
            : cfg.metaDirectConfig.appSecret;
          cfg.metaDirectConfig = {
            ...cfg.metaDirectConfig,
            ...cm,
            ...(preservedAppId ? { appId: preservedAppId } : {}),
            ...(preservedAppSecret ? { appSecret: preservedAppSecret } : {}),
            updatedAt: cloudVault.updatedAt
          };
          if (params.envWriter && cm.accessToken) {
            params.envWriter('META_ACCESS_TOKEN', cm.accessToken);
            params.envWriter('META_CAPI_TOKEN', cm.accessToken);
          }
          cfgModified = true;
          hydrated = true;
        }
        if (cloudVault?.pipeboardConfig) {
          const cp = cloudVault.pipeboardConfig;
          if (cp.pipeboardApiToken && !cfg.pipeboardConfig.pipeboardApiToken) {
            cfg.pipeboardConfig.pipeboardApiToken = cp.pipeboardApiToken;
            if (params.envWriter) params.envWriter('PIPEBOARD_API_TOKEN', cp.pipeboardApiToken);
            cfgModified = true;
            hydrated = true;
          }
          if (cp.selectedAdAccountName && !cfg.pipeboardConfig.selectedAdAccountName) {
            cfg.pipeboardConfig.selectedAdAccountName = cp.selectedAdAccountName;
            cfgModified = true;
          }
        }
      }
    } catch {
      // ignore cloud fetch failure and fall back to local cfg
    }
  }

  if (cfgModified) {
    try {
      fs.writeFileSync(params.cfgFile, JSON.stringify(cfg, null, 2), 'utf-8');
    } catch {
      // ignore disk write failure
    }
  }

  return { hydrated, cfg };
}
