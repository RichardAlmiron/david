import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  auditMetaTokenAndPermissions,
  classifyMetaGraphError,
  hydrateMetaVaultIntoStoreConfig,
  isValidMetaAccessToken,
  isValidMetaAppSecret,
  isValidNumericMetaAppId,
  META_AUTH_VAULT_CODE,
  OFFICIAL_META_AD_ACCOUNT_ID,
  sanitizeStoredMetaDirectConfig,
  saveMetaVaultToSupabase
} from '../metaAuthSession.ts';

test('validadores Meta App ID, App Secret y Access Token rechazan autocompletado y aceptan formato oficial', () => {
  // Rechaza correos o contraseñas del admin autocompletadas por navegador
  assert.equal(isValidNumericMetaAppId('encuestas977@gmail.com'), false);
  assert.equal(isValidNumericMetaAppId(''), false);
  assert.equal(isValidNumericMetaAppId('1234'), false);
  assert.equal(isValidNumericMetaAppId('1465256781554439'), true);

  assert.equal(isValidMetaAppSecret('qqwwee112233'), false);
  assert.equal(isValidMetaAppSecret('encuestas977@gmail.com'), false);
  assert.equal(isValidMetaAppSecret('short'), false);
  assert.equal(isValidMetaAppSecret('a1b2c3d4e5f67890a1b2c3d4e5f67890'), true);

  assert.equal(isValidMetaAccessToken(''), false);
  assert.equal(isValidMetaAccessToken('pb_1234567890abcdef1234567890abcdef'), false);
  assert.equal(isValidMetaAccessToken('EAAJZC1234567890abcdefghijklmnopqrstuvwxyzABCD'), true);
});

test('sanitizeStoredMetaDirectConfig purga credenciales corruptas en store_config y env preservando las válidas', () => {
  const envMap: Record<string, string> = {
    META_APP_ID: 'encuestas977@gmail.com',
    META_APP_SECRET: 'qqwwee112233'
  };
  const cfg: Record<string, any> = {
    metaDirectConfig: {
      appId: 'encuestas977@gmail.com',
      appSecret: 'qqwwee112233'
    }
  };

  const cleared = sanitizeStoredMetaDirectConfig(
    cfg,
    (k) => envMap[k] || '',
    (k, v) => {
      envMap[k] = v;
    }
  );

  assert.equal(cleared.corruptedAppIdCleared, true);
  assert.equal(cleared.corruptedAppSecretCleared, true);
  assert.equal(cleared.appId, '');
  assert.equal(cleared.appSecret, '');
  assert.equal(cfg.metaDirectConfig.appId, undefined);
  assert.equal(cfg.metaDirectConfig.appSecret, undefined);
  assert.equal(envMap.META_APP_ID, '');
  assert.equal(envMap.META_APP_SECRET, '');

  // Credenciales válidas en env se recuperan sin error
  envMap.META_APP_ID = '1465256781554439';
  envMap.META_APP_SECRET = '0123456789abcdef0123456789abcdef';
  const valid = sanitizeStoredMetaDirectConfig(cfg, (k) => envMap[k] || '');
  assert.equal(valid.appId, '1465256781554439');
  assert.equal(valid.appSecret, '0123456789abcdef0123456789abcdef');
  assert.equal(valid.corruptedAppIdCleared, false);
});

test('classifyMetaGraphError identifica error 190 (vencido/invalidado) y errores 200/10 de permisos con requiresReauth', () => {
  const expired = classifyMetaGraphError({
    code: 190,
    error_subcode: 463,
    type: 'OAuthException',
    message: 'Error validating access token: Session has expired on Thursday.'
  });
  assert.equal(expired.isTokenInvalid, true);
  assert.equal(expired.isPermissionError, false);
  assert.equal(expired.requiresReauth, true);
  assert.match(expired.userMessage, /venció/i);

  const revoked = classifyMetaGraphError({
    code: 190,
    error_subcode: 460,
    type: 'OAuthException',
    message: 'Error validating access token: The session has been invalidated.'
  });
  assert.equal(revoked.isTokenInvalid, true);
  assert.equal(revoked.requiresReauth, true);
  assert.match(revoked.userMessage, /invalidó/i);

  const permErr = classifyMetaGraphError({
    code: 200,
    type: 'OAuthException',
    message: '(#200) Permissions error: ads_management is required'
  });
  assert.equal(permErr.isPermissionError, true);
  assert.equal(permErr.requiresReauth, true);
  assert.match(permErr.userMessage, /ads_management/i);
});

test('[SIMULADO] auditMetaTokenAndPermissions valida token, permisos Marketing API y acceso a act_1048211497774834', async () => {
  const validToken = 'EAAValidSimulatedToken1234567890ABCDEFGHIJKLMNOP';

  const mockFullAccessFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/me/permissions')) {
      return new Response(
        JSON.stringify({
          data: [
            { permission: 'ads_management', status: 'granted' },
            { permission: 'ads_read', status: 'granted' },
            { permission: 'pages_show_list', status: 'granted' },
            { permission: 'pages_read_engagement', status: 'granted' },
            { permission: 'business_management', status: 'granted' }
          ]
        }),
        { status: 200 }
      );
    }
    if (url.includes('/me/accounts')) {
      return new Response(
        JSON.stringify({ data: [{ id: '1050835598123904', name: 'Landingcod Shop' }] }),
        { status: 200 }
      );
    }
    if (url.includes(`/${OFFICIAL_META_AD_ACCOUNT_ID}`)) {
      return new Response(
        JSON.stringify({ id: OFFICIAL_META_AD_ACCOUNT_ID, name: 'Landingcod PY', currency: 'USD' }),
        { status: 200 }
      );
    }
    if (url.includes('/me?')) {
      return new Response(JSON.stringify({ id: '999', name: 'Admin Demo' }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };

  const okAudit = await auditMetaTokenAndPermissions({
    accessToken: validToken,
    fetchImpl: mockFullAccessFetch
  });
  assert.equal(okAudit.tokenValid, true);
  assert.equal(okAudit.hasAdsManagement, true);
  assert.equal(okAudit.adAccountAccessible, true);
  assert.equal(okAudit.hasTargetPage, true);
  assert.deepEqual(okAudit.missingPermissions, []);

  // Caso sin ads_management
  const mockMissingPermFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/me/permissions')) {
      return new Response(
        JSON.stringify({
          data: [
            { permission: 'ads_read', status: 'granted' },
            { permission: 'ads_management', status: 'declined' }
          ]
        }),
        { status: 200 }
      );
    }
    if (url.includes('/me?')) {
      return new Response(JSON.stringify({ id: '999', name: 'Admin Demo' }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  };

  const permAudit = await auditMetaTokenAndPermissions({
    accessToken: validToken,
    fetchImpl: mockMissingPermFetch
  });
  assert.equal(permAudit.tokenValid, true);
  assert.equal(permAudit.hasAdsManagement, false);
  assert.ok(permAudit.missingPermissions.includes('ads_management'));
  assert.ok(permAudit.declinedPermissions.includes('ads_management'));
});

test('[SIMULADO] saveMetaVaultToSupabase y hydrateMetaVaultIntoStoreConfig sobreviven reinicios sin pisar sesiones más nuevas', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-vault-test-'));
  try {
    const cfgFile = path.join(tmpDir, 'store_config.json');
    let cloudStore: Record<string, string> = {};
    const envStore: Record<string, string> = {};

    const initialCfg = {
      metaDirectConfig: {
        appId: '1465256781554439',
        appSecret: '0123456789abcdef0123456789abcdef',
        accessToken: 'EAAVaultPersistedToken1234567890ABCDEFGHIJKLMNOP',
        userId: '111',
        userName: 'Cuenta Oficial',
        tokenStatus: 'valid',
        adAccountName: 'Landingcod PY',
        pixelName: 'Auto Ads 360'
      },
      pipeboardConfig: {
        selectedAdAccountId: 'act_1048211497774834',
        selectedFacebookPageId: '1050835598123904'
      }
    };

    const saved = await saveMetaVaultToSupabase(initialCfg, {
      deleteFn: async () => {
        delete cloudStore[META_AUTH_VAULT_CODE];
      },
      upsertFn: async (codigo, payload) => {
        cloudStore[codigo] = payload;
        return true;
      }
    });
    assert.equal(saved, true);
    assert.ok(cloudStore[META_AUTH_VAULT_CODE]);

    // Simular contenedor nuevo en Railway sin store_config.json y con META_APP_ID corrupto en env
    envStore.META_APP_ID = 'encuestas977@gmail.com';
    const hydrated = await hydrateMetaVaultIntoStoreConfig({
      cfgFile,
      envReader: (k) => envStore[k] || '',
      envWriter: (k, v) => {
        envStore[k] = v;
      },
      forceRefresh: true,
      queryFn: async () =>
        cloudStore[META_AUTH_VAULT_CODE]
          ? [{ codigo: META_AUTH_VAULT_CODE, dispositivo: cloudStore[META_AUTH_VAULT_CODE] }]
          : []
    });

    assert.equal(hydrated.hydrated, true);
    assert.equal(hydrated.cfg.metaDirectConfig.appId, '1465256781554439');
    assert.equal(
      hydrated.cfg.metaDirectConfig.accessToken,
      'EAAVaultPersistedToken1234567890ABCDEFGHIJKLMNOP'
    );
    assert.equal(envStore.META_APP_ID, '1465256781554439');
    assert.equal(
      envStore.META_ACCESS_TOKEN,
      'EAAVaultPersistedToken1234567890ABCDEFGHIJKLMNOP'
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
