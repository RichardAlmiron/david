import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildCloudinarySignature,
  getCloudinaryConfigStatus,
  listCloudinaryAutoAdsImages,
  resolveCloudinaryConfig,
  sanitizeConfigPayloadForSupabase,
  stripBase64FromAutoAdsWorkspaces,
  uploadImageToCloudinary
} from '../cloudinaryStore.ts';
import {
  fetchLiveMetaCampaignHierarchy,
  replacePublishedAdInMeta
} from '../metaCampaignOps.ts';
import { setAutoadsDataRootForTesting } from '../autoadsStore.ts';
import { resolveCampaignAdImageCandidates } from '../../src/components/AutoAdsCampaignsPanel.tsx';

function makeEnvReader(values: Record<string, string>) {
  return (key: string) => String(values[key] || '');
}

test('resolveCloudinaryConfig soporta variables discretas y CLOUDINARY_URL en Railway', () => {
  const fromVars = resolveCloudinaryConfig(
    makeEnvReader({
      CLOUDINARY_CLOUD_NAME: 'noelux-cloud',
      CLOUDINARY_API_KEY: '123456789012345',
      CLOUDINARY_API_SECRET: 'super_secret_abc',
      CLOUDINARY_UPLOAD_FOLDER: '/noelux/autoads/'
    })
  );
  assert.equal(fromVars.source, 'env_vars');
  assert.equal(fromVars.cloudName, 'noelux-cloud');
  assert.equal(fromVars.apiKey, '123456789012345');
  assert.equal(fromVars.apiSecret, 'super_secret_abc');
  assert.equal(fromVars.folder, 'noelux/autoads');

  const fromUrl = resolveCloudinaryConfig(
    makeEnvReader({
      CLOUDINARY_URL: 'cloudinary://key_9988:sec_7766@mi-cloud-py'
    })
  );
  assert.equal(fromUrl.source, 'cloudinary_url');
  assert.equal(fromUrl.cloudName, 'mi-cloud-py');
  assert.equal(fromUrl.apiKey, 'key_9988');
  assert.equal(fromUrl.apiSecret, 'sec_7766');
  assert.equal(fromUrl.folder, 'noelux/autoads');
});

test('getCloudinaryConfigStatus detecta credenciales faltantes y genera vista previa segura', () => {
  const missingStatus = getCloudinaryConfigStatus(makeEnvReader({}));
  assert.equal(missingStatus.configured, false);
  assert.equal(missingStatus.mode, 'not_configured');
  assert.deepEqual(missingStatus.missingVars, [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ]);

  const activeStatus = getCloudinaryConfigStatus(
    makeEnvReader({
      CLOUDINARY_CLOUD_NAME: 'landingcod-media',
      CLOUDINARY_API_KEY: '998877665544',
      CLOUDINARY_API_SECRET: 'secret_xyz'
    })
  );
  assert.equal(activeStatus.configured, true);
  assert.equal(activeStatus.mode, 'signed_api');
  assert.equal(activeStatus.cloudName, 'landingcod-media');
  assert.equal(activeStatus.apiKeyPreview, '9988••••44');
  assert.deepEqual(activeStatus.missingVars, []);
});

test('buildCloudinarySignature calcula SHA-1 ordenado alfabéticamente igual al estándar Cloudinary', () => {
  const params = {
    timestamp: 1730000000,
    folder: 'noelux/autoads/proyector',
    public_id: 'proyector_ad_5',
    tags: 'autoads,ad_5',
    emptyField: ''
  };
  const secret = 'my_api_secret_123';
  const expectedPayload =
    'folder=noelux/autoads/proyector&public_id=proyector_ad_5&tags=autoads,ad_5&timestamp=1730000000' +
    secret;
  const expectedSha1 = crypto.createHash('sha1').update(expectedPayload).digest('hex');

  assert.equal(buildCloudinarySignature(params, secret), expectedSha1);
});

test('sanitizeConfigPayloadForSupabase bloquea el guardado de imágenes y workspaces AutoAds en Supabase', () => {
  const dirtyConfig = {
    selectedVoice: 'es-AR-ElenaNeural',
    deliveryCost: 0,
    autoAdsWorkspaces: {
      workspaces: {
        proyector: {
          creatives: [{ aiGeneratedImageDataUrl: 'data:image/png;base64,AAAABBBBCCCC' }]
        }
      }
    },
    pipeboardPublishedCampaigns: [{ id: 'camp-1', publishedAds: [{ imageUrl: 'x' }] }],
    metaDirectConfig: { accessToken: 'EAA_SECRET' },
    pipeboardConfig: { openRouterApiKey: 'sk-or-secret' },
    openRouterApiKey: 'sk-or-secret',
    deepgramApiKey: 'dg-secret',
    capiAccessToken: 'capi-secret'
  };

  const sanitized = sanitizeConfigPayloadForSupabase(dirtyConfig);
  assert.equal(sanitized.selectedVoice, 'es-AR-ElenaNeural');
  assert.equal(sanitized.deliveryCost, 0);
  assert.equal('autoAdsWorkspaces' in sanitized, false);
  assert.equal('pipeboardPublishedCampaigns' in sanitized, false);
  assert.equal('metaDirectConfig' in sanitized, false);
  assert.equal('pipeboardConfig' in sanitized, false);
  assert.equal('openRouterApiKey' in sanitized, false);
  assert.equal('deepgramApiKey' in sanitized, false);
  assert.equal('capiAccessToken' in sanitized, false);
});

test('stripBase64FromAutoAdsWorkspaces elimina blobs base64 cuando existe URL de Cloudinary o disco', () => {
  const rawState = {
    workspaces: {
      'proyector-12': {
        productId: 'proyector-12',
        creatives: [
          {
            id: 'ad-1',
            aiGeneratedImageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/ad1.png',
            cloudinaryPublicId: 'noelux/autoads/proyector/ad1',
            aiGeneratedImageDataUrl: 'data:image/png;base64,HEAVY_BASE64_PAYLOAD'
          },
          {
            id: 'ad-2',
            aiGeneratedImageUrl: '',
            aiGeneratedImageDataUrl: 'data:image/svg+xml;utf8,<svg></svg>'
          },
          {
            id: 'ad-3',
            aiGeneratedImageUrl: '',
            aiGeneratedImageDataUrl: 'data:image/png;base64,ORPHAN_PNG_BASE64'
          }
        ]
      }
    }
  };

  const stripped = stripBase64FromAutoAdsWorkspaces(rawState);
  const creatives = stripped.workspaces['proyector-12'].creatives;
  assert.equal(creatives[0].aiGeneratedImageUrl, 'https://res.cloudinary.com/demo/image/upload/v1/ad1.png');
  assert.equal(creatives[0].cloudinaryPublicId, 'noelux/autoads/proyector/ad1');
  assert.equal('aiGeneratedImageDataUrl' in creatives[0], false);
  // Mantiene preview SVG ligero cuando no existe URL todavía
  assert.equal(creatives[1].aiGeneratedImageDataUrl, 'data:image/svg+xml;utf8,<svg></svg>');
  // Nunca retiene PNG base64 pesado
  assert.equal('aiGeneratedImageDataUrl' in creatives[2], false);
});

test('[SIMULADO] uploadImageToCloudinary y listCloudinaryAutoAdsImages interactúan con API Cloudinary sin tocar Supabase', async () => {
  const originalFetch = globalThis.fetch;
  const calledUrls: string[] = [];
  const reader = makeEnvReader({
    CLOUDINARY_CLOUD_NAME: 'demo-noelux',
    CLOUDINARY_API_KEY: '11223344',
    CLOUDINARY_API_SECRET: 'secret_cld_99',
    CLOUDINARY_UPLOAD_FOLDER: 'noelux/autoads'
  });

  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calledUrls.push(`${init?.method || 'GET'} ${url}`);
      if (url.includes('/image/upload') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            secure_url: 'https://res.cloudinary.com/demo-noelux/image/upload/v123/proyector_ad_5.png',
            public_id: 'noelux/autoads/proyector/proyector_ad_5',
            asset_id: 'asset_555',
            width: 1080,
            height: 1080,
            format: 'png',
            bytes: 120400
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/resources/image/upload')) {
        return new Response(
          JSON.stringify({
            resources: [
              {
                public_id: 'noelux/autoads/proyector/proyector_ad_5',
                secure_url:
                  'https://res.cloudinary.com/demo-noelux/image/upload/v123/proyector_ad_5.png',
                format: 'png',
                width: 1080,
                height: 1080,
                bytes: 120400,
                created_at: '2026-11-13T10:00:00Z',
                tags: ['autoads', 'proyector', 'ad_5']
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;

    const upRes = await uploadImageToCloudinary({
      source: Buffer.alloc(600, 0x50),
      mimeType: 'image/png',
      productSlug: 'proyector',
      campaignId: '1202100001',
      adIndex: 4,
      envReader: reader
    });
    assert.equal(upRes.ok, true);
    assert.equal(
      upRes.secureUrl,
      'https://res.cloudinary.com/demo-noelux/image/upload/v123/proyector_ad_5.png'
    );
    assert.equal(upRes.publicId, 'noelux/autoads/proyector/proyector_ad_5');

    const listRes = await listCloudinaryAutoAdsImages(reader, 'proyector');
    assert.equal(listRes.ok, true);
    assert.equal(listRes.resources.length, 1);
    assert.equal(listRes.resources[0].tags.includes('ad_5'), true);
    assert.equal(
      calledUrls.every(c => c.includes('api.cloudinary.com')),
      true
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('[SIMULADO] replacePublishedAdInMeta crea AdCreative nuevo, ejecuta DELETE al Ad ID viejo y publica el reemplazo en el AdSet', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noelux-meta-ops-'));
  setAutoadsDataRootForTesting(tmpDir);

  const sequence: string[] = [];
  const fakePngBytes = Buffer.alloc(750, 0x89);

  const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();

    if (url.startsWith('https://res.cloudinary.com/')) {
      sequence.push('DOWNLOAD_CLOUDINARY');
      return new Response(new Uint8Array(fakePngBytes), {
        status: 200,
        headers: { 'Content-Type': 'image/png' }
      });
    }
    if (url.includes('/act_1048211497774834/adimages') && method === 'POST') {
      sequence.push('META_UPLOAD_IMAGE');
      return new Response(
        JSON.stringify({ images: { ad5: { hash: 'meta_hash_new_5' } } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (url.includes('/act_1048211497774834/adcreatives') && method === 'POST') {
      sequence.push('META_CREATE_CREATIVE');
      return new Response(
        JSON.stringify({ id: 'creative_new_555' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (url.includes('/v21.0/120210000000005') && method === 'DELETE') {
      sequence.push('META_DELETE_OLD_AD');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url.includes('/act_1048211497774834/ads') && method === 'POST') {
      const payload = JSON.parse(String(init?.body || '{}'));
      assert.equal(payload.adset_id, '120210000000777');
      assert.equal(JSON.parse(payload.creative).creative_id, 'creative_new_555');
      sequence.push('META_CREATE_NEW_AD');
      return new Response(
        JSON.stringify({ id: '120210000009999' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ error: { message: `Unexpected ${method} ${url}` } }), {
      status: 400
    });
  }) as typeof fetch;

  try {
    const campaignRecord = {
      id: 'rec-camp-1',
      campaignId: '120210000000100',
      campaignName: '[AUTOADS PY] Proyector Navideño',
      productId: 'proyector-12',
      productSlug: 'proyector-navideno',
      productName: 'Proyector Navideño',
      adSetId: '120210000000777',
      landingUrl: 'https://autoads360.up.railway.app/?p=proyector-navideno',
      publishedAds: Array.from({ length: 6 }, (_, i) => ({
        adIndex: i,
        adId: `12021000000000${i + 1}`,
        creativeId: `cr_old_${i + 1}`,
        status: 'ACTIVE',
        headline: `Anuncio ${i + 1}`
      }))
    };

    const result = await replacePublishedAdInMeta({
      campaignRecord,
      adSetId: '120210000000777',
      oldAdId: '120210000000005',
      adIndex: 4,
      product: {
        id: 'proyector-12',
        slug: 'proyector-navideno',
        nombre: 'Proyector Navideño'
      },
      creative: {
        id: 'cr-slot-5',
        aiGeneratedImageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/ad5_gs.png',
        cloudinaryPublicId: 'noelux/autoads/proyector-navideno/ad_5_gs',
        headline: '1x Gs. 189.000 · Pago al Recibir',
        primaryText: 'Pagás recién al recibir en puerta en todo Paraguay. 2x Gs. 358.000.',
        descriptionText: 'Envío Gratis hoy',
        ctaLabel: 'Pedir ahora',
        ctaType: 'ORDER_NOW',
        formatLabel: 'Feed IA #5'
      },
      landingUrl: 'https://autoads360.up.railway.app/?p=proyector-navideno',
      accessToken: 'EAA_MOCK_TOKEN_VALID_123456',
      envReader: makeEnvReader({}),
      fetchFn: mockFetch
    });

    assert.equal(result.ok, true);
    assert.equal(result.deletedFromMeta, true);
    assert.equal(result.deletedAdId, '120210000000005');
    assert.equal(result.newAdId, '120210000009999');
    assert.equal(result.newCreativeId, 'creative_new_555');
    assert.deepEqual(sequence, [
      'DOWNLOAD_CLOUDINARY',
      'META_UPLOAD_IMAGE',
      'META_CREATE_CREATIVE',
      'META_DELETE_OLD_AD',
      'META_CREATE_NEW_AD'
    ]);

    const updatedAd5 = result.updatedCampaignRecord?.publishedAds?.[4];
    assert.equal(updatedAd5?.adId, '120210000009999');
    assert.equal(updatedAd5?.replacedFromAdId, '120210000000005');
    assert.equal(
      updatedAd5?.imageUrl,
      'https://res.cloudinary.com/demo/image/upload/v1/ad5_gs.png'
    );
  } finally {
    setAutoadsDataRootForTesting(null);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('[SIMULADO] fetchLiveMetaCampaignHierarchy combina Campaña -> Grupo de Anuncios -> Anuncios preservando URLs de Cloudinary', async () => {
  const mockFetch = (async () => {
    return new Response(
      JSON.stringify({
        data: [
          {
            id: '120210000000100',
            name: '[AUTOADS] Proyector PY',
            status: 'ACTIVE',
            objective: 'OUTCOME_LEADS',
            adsets: {
              data: [{ id: '120210000000777', name: '[PARAGUAY 18-65+]', status: 'ACTIVE' }]
            },
            ads: {
              data: [
                {
                  id: '120210000000001',
                  name: 'Anuncio #1',
                  status: 'ACTIVE',
                  adset_id: '120210000000777',
                  creative: { id: 'cr_1', title: 'Meta Title', thumbnail_url: 'https://fb.com/thumb.jpg' }
                }
              ]
            }
          }
        ]
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  const liveRes = await fetchLiveMetaCampaignHierarchy({
    accessToken: 'EAA_MOCK_TOKEN',
    adAccountId: 'act_1048211497774834',
    localCampaigns: [
      {
        id: 'local-1',
        campaignId: '120210000000100',
        productSlug: 'proyector',
        publishedAds: [
          {
            adId: '120210000000001',
            imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/ad1.png',
            headline: '1x Gs. 189.000'
          }
        ]
      }
    ],
    fetchFn: mockFetch
  });

  assert.equal(liveRes.ok, true);
  assert.equal(liveRes.campaigns.length, 1);
  assert.equal(liveRes.campaigns[0].adSetId, '120210000000777');
  assert.equal(
    liveRes.campaigns[0].publishedAds[0].imageUrl,
    'https://res.cloudinary.com/demo/image/upload/v1/ad1.png'
  );
  assert.equal(liveRes.campaigns[0].publishedAds[0].headline, '1x Gs. 189.000');
});

test('resolveCampaignAdImageCandidates prioriza Cloudinary/workspace y omite placeholders SVG ante fallos', () => {
  const camp = {
    id: 'camp-local-1',
    campaignId: '120251318982700167',
    campaignName: '[META IA] Noelux Proyector',
    productId: 'prod-noelux-01',
    productSlug: 'noelux-proyector-12-disenos',
    productName: 'Noelux Proyector',
    adSetId: 'adset-1',
    landingUrl: 'https://autoads360.up.railway.app/?p=noelux-proyector-12-disenos',
    publishedAds: []
  } as any;

  const candidates = resolveCampaignAdImageCandidates(
    camp,
    { adIndex: 5, imageUrl: 'https://fbcdn.net/expired-thumb.jpg' },
    5,
    {
      'prod-noelux-01': {
        productId: 'prod-noelux-01',
        creatives: Array.from({ length: 6 }, (_, i) =>
          i === 5
            ? {
              aiGeneratedImageUrl: 'https://res.cloudinary.com/dsd6cqgx0/image/upload/v1/ad6_ws.png',
              aiGeneratedImageDataUrl: 'data:image/svg+xml;base64,PHN2Zz4='
            }
            : {}
        )
      }
    },
    [
      {
        publicId: 'noelux/autoads/noelux-proyector-12-disenos/ad_6_cdn',
        secureUrl: 'https://res.cloudinary.com/dsd6cqgx0/image/upload/v2/ad6_cdn.png',
        format: 'png',
        width: 1024,
        height: 1024,
        bytes: 120000,
        createdAt: '2026-11-13T12:00:00Z',
        tags: ['autoads', 'noelux_proyector_12_disenos', 'ad_6']
      }
    ]
  );

  assert.deepEqual(candidates, [
    'https://fbcdn.net/expired-thumb.jpg',
    'https://res.cloudinary.com/dsd6cqgx0/image/upload/v1/ad6_ws.png',
    'https://res.cloudinary.com/dsd6cqgx0/image/upload/v2/ad6_cdn.png'
  ]);
  assert.equal(candidates.some(c => c.startsWith('data:image/svg')), false);
});

test('AutoAds separa cada interfaz con su propia cabecera privada y pestañas internas sin amontonamiento', () => {
  const viewSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/AutoAdsView.tsx'),
    'utf8'
  );
  const campPanelSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/AutoAdsCampaignsPanel.tsx'),
    'utf8'
  );
  const cldPanelSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/AutoAdsCloudinaryPanel.tsx'),
    'utf8'
  );

  // La cabecera principal de AutoAds solo vive dentro de Inicio (no invade Campañas/Crear/Conexión/Campaña abierta)
  assert.equal(viewSrc.includes("{activeWorkspaceTab === 'inicio' && ("), true);
  assert.equal(viewSrc.includes('data-testid="autoads-tab-inicio"'), false);
  assert.equal(viewSrc.includes('data-testid="autoads-conexion-workspace"'), true);
  assert.equal(viewSrc.includes('data-testid="autoads-crear-workspace"'), true);

  // Cuenta Meta & Cloudinary usa pestañas internas en vez de apilar 3 bloques gigantes
  assert.equal(viewSrc.includes('data-testid="conexion-subtab-cloudinary"'), true);
  assert.equal(viewSrc.includes('data-testid="conexion-subtab-meta"'), true);
  assert.equal(viewSrc.includes('data-testid="conexion-subtab-capi"'), true);
  assert.equal(viewSrc.includes('data-testid="conexion-subtab-apis"'), true);

  // Una campaña abierta muestra pestañas internas (Anuncios / Grupo / Campaña) sin cajas apiladas arriba de los anuncios
  assert.equal(campPanelSrc.includes('data-testid="autoads-single-campaign-view"'), true);
  assert.equal(campPanelSrc.includes('data-testid="campaign-subtab-anuncios"'), true);
  assert.equal(campPanelSrc.includes('data-testid="campaign-subtab-grupo"'), true);
  assert.equal(campPanelSrc.includes('data-testid="campaign-subtab-campana"'), true);
  assert.equal(campPanelSrc.includes('onError={() => markUrlFailed('), true);

  // Tarjetas de campañas: formato cuadrado compacto con 1 sola imagen (Anuncio #1) y sin collage de 4 miniaturas
  assert.equal(campPanelSrc.includes('grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'), true);
  assert.equal(campPanelSrc.includes('relative aspect-square rounded-xl'), true);
  assert.equal(campPanelSrc.includes('grid-cols-4 gap-1.5'), false);

  // Nueva Campaña comienza siempre desde cero sin arrastrar campañas ya publicadas
  assert.equal(viewSrc.includes('onGoToCreateCampaign={handleStartNewCampaign}'), true);
  assert.equal(viewSrc.includes('data-testid="autoads-fresh-start-notice"'), true);
  assert.equal(viewSrc.includes("savedWs.workflowStep !== 'published'"), true);

  // Cloudinary colapsa las ENV cuando ya está conectado en Railway
  assert.equal(cldPanelSrc.includes('const shouldShowEnvVars = !configured || showEnvVars;'), true);
});
