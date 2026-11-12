import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveOrderCommercialPackAndPrice,
  isSavedCommercialAssetExactMatch,
  buildStageCommercialCopyAndPrompt,
  buildFullProductCommercialMatrixSpecs,
  resolvePostTurnCommercialStage,
  VIP_PREPAYMENT_DISCOUNT_GS,
  WA_COMMERCIAL_STAGES
} from './waStageCommercials';
import type { WaStageCommercialAsset } from '../types';

const sampleProduct = {
  id: 'prod-noelux',
  nombre: 'Noelux™ Proyector Navideño',
  precioNormal: 250000,
  precios: {
    1: 189000,
    2: 358000,
    3: 507000
  }
};

test('resolves Pack 1, Pack 2, and Pack 3 strictly without cross-pack confusion and applies -Gs. 30.000 VIP discount', () => {
  assert.equal(VIP_PREPAYMENT_DISCOUNT_GS, 30000);

  const p1 = resolveOrderCommercialPackAndPrice({ cantidad: 1, monto: 189000 }, sampleProduct);
  const p2 = resolveOrderCommercialPackAndPrice({ cantidad: 2, monto: 358000 }, sampleProduct);
  const p3 = resolveOrderCommercialPackAndPrice({ cantidad: 3, monto: 507000 }, sampleProduct);

  assert.equal(p1.unitCount, 1);
  assert.equal(p1.packKey, 'pack1');
  assert.equal(p1.packTitleUpper, 'PACK 1 UNIDAD');
  assert.equal(p1.officialPriceGs, 189000);
  assert.equal(p1.officialPriceFormatted, 'Gs. 189.000');
  assert.equal(p1.vipPriceGs, 159000);

  assert.equal(p2.unitCount, 2);
  assert.equal(p2.packKey, 'pack2');
  assert.equal(p2.packTitleUpper, 'PACK 2 UNIDADES');
  assert.equal(p2.officialPriceGs, 358000);
  assert.equal(p2.officialPriceFormatted, 'Gs. 358.000');
  assert.equal(p2.vipPriceGs, 328000);

  assert.equal(p3.unitCount, 3);
  assert.equal(p3.packKey, 'pack3');
  assert.equal(p3.packTitleUpper, 'PACK 3 UNIDADES');
  assert.equal(p3.officialPriceGs, 507000);
  assert.equal(p3.officialPriceFormatted, 'Gs. 507.000');
  assert.equal(p3.vipPriceGs, 477000);
});

test('never allows a Pack 1 commercial asset to pass validation for a Pack 3 customer order', () => {
  const pack3Resolved = resolveOrderCommercialPackAndPrice(
    { cantidad: 3, monto: 507000 },
    sampleProduct
  );

  const wrongPack1Asset: WaStageCommercialAsset = {
    stageId: 'stage1_welcome',
    packKey: 'pack1',
    packQty: 1,
    imageUrl: '/assets/wa-commercials/pack1.jpg',
    framedPriceGs: 189000,
    headline: 'Noelux',
    ctaText: 'DECÍ O ESCRIBÍ "CORRECTO" PARA CONFIRMAR',
    whatsappCaption: '',
    sourceType: 'studio_framed',
    generatedAt: new Date().toISOString()
  };

  const stalePricePack3Asset: WaStageCommercialAsset = {
    ...wrongPack1Asset,
    packKey: 'pack3',
    packQty: 3,
    framedPriceGs: 419000 // outdated price!
  };

  const exactPack3Asset: WaStageCommercialAsset = {
    ...wrongPack1Asset,
    packKey: 'pack3',
    packQty: 3,
    framedPriceGs: 507000
  };

  assert.equal(
    isSavedCommercialAssetExactMatch(wrongPack1Asset, 'stage1_welcome', pack3Resolved),
    false
  );
  assert.equal(
    isSavedCommercialAssetExactMatch(stalePricePack3Asset, 'stage1_welcome', pack3Resolved),
    false
  );
  assert.equal(
    isSavedCommercialAssetExactMatch(exactPack3Asset, 'stage1_welcome', pack3Resolved),
    true
  );
});

test('recovers pack quantity from exact catalog price if lead order had missing quantity', () => {
  const inferredPack3 = resolveOrderCommercialPackAndPrice(
    { cantidad: 0, monto: 507000 },
    sampleProduct
  );
  assert.equal(inferredPack3.unitCount, 3);
  assert.equal(inferredPack3.packKey, 'pack3');
  assert.equal(inferredPack3.officialPriceGs, 507000);
});

test('enforces ONLY ONE commercial image stage per order (stage1_welcome x 3 packs) with zero caption clutter', () => {
  assert.equal(WA_COMMERCIAL_STAGES.length, 1);
  assert.equal(WA_COMMERCIAL_STAGES[0].id, 'stage1_welcome');

  const matrix = buildFullProductCommercialMatrixSpecs(sampleProduct);
  assert.equal(matrix.length, 3);

  const stage1Pack3Copy = buildStageCommercialCopyAndPrompt(
    'stage1_welcome',
    resolveOrderCommercialPackAndPrice(3, sampleProduct)
  );
  assert.match(stage1Pack3Copy.openRouterPrompt, /THREE \(3\) identical units/);
  assert.equal(stage1Pack3Copy.whatsappCaption, '');
  assert.match(stage1Pack3Copy.ctaBannerText, /CORRECTO/);

  // Post-turn commercial stage must ALWAYS be null (no Stage 2, 3, or 4 images)
  assert.equal(resolvePostTurnCommercialStage({ convStep: 2, datosConfirmados: false }, 2), null);
  assert.equal(
    resolvePostTurnCommercialStage(
      { datosConfirmados: true, waCommercialSentStages: { stage1_welcome: true } },
      5
    ),
    null
  );
  assert.equal(
    resolvePostTurnCommercialStage(
      { datosConfirmados: true, promoPagoAdelantadoStage: 'alias_sent_awaiting_receipt' },
      5
    ),
    null
  );
});

test('renders crisp 1080x1080 JPEG single-stage commercial buffers for Pack 1, Pack 2, and Pack 3 on disk', async () => {
  const { renderFullProductCommercialMatrixOnServer } = await import('../../server/waStageCommercialRenderer');
  const sharpMod = (await import('sharp')).default;
  const fsMod = (await import('node:fs')).default;
  const pathMod = (await import('node:path')).default;

  const productionProduct = {
    id: 'prod-noelux-01',
    nombre: 'Noelux™ Proyector Navideño 12 Diseños',
    descripcion: 'Proyector láser LED con 12 diapositivas navideñas de alta definición, cobertura 70m² e impermeabilidad IP65 para exteriores.',
    imagen: '/assets/real/galeria-1.jpg',
    precioNormal: 249000,
    precios: {
      1: 189000,
      2: 358000,
      3: 507000
    }
  };

  const matrixMap = await renderFullProductCommercialMatrixOnServer(productionProduct);

  assert.deepEqual(Object.keys(matrixMap), ['stage1_welcome']);
  const stage1Map = matrixMap.stage1_welcome!;

  for (const packQty of [1, 2, 3] as const) {
    const key = `pack${packQty}` as const;
    const asset = stage1Map[key]!;
    assert.ok(asset, `Expected asset for ${key}`);
    assert.equal(asset.packQty, packQty);
    assert.equal(asset.framedPriceGs, productionProduct.precios[packQty]);
    assert.equal(asset.vipPriceGs, productionProduct.precios[packQty] - 30000);
    assert.equal(asset.whatsappCaption, '');

    const diskPath = pathMod.resolve(process.cwd(), 'public', asset.imageUrl.replace(/^\/+/, ''));
    assert.equal(fsMod.existsSync(diskPath), true, `Expected pre-generated file at ${diskPath}`);

    const buf = fsMod.readFileSync(diskPath);
    assert.ok(buf.length > 25000);
    assert.equal(buf[0], 0xff);
    assert.equal(buf[1], 0xd8);

    const meta = await sharpMod(buf).metadata();
    assert.equal(meta.width, 1080);
    assert.equal(meta.height, 1080);
  }
});

test('never falls back to SVG, Sharp, or secondary models when generating personalized Imagen #1', async () => {
  const { renderPersonalizedOrderWelcomeImage } = await import('../../server/waStageCommercialRenderer');

  await assert.rejects(
    () =>
      renderPersonalizedOrderWelcomeImage({
        order: {
          reservaid: 'NX-NOFALLBACK-1',
          nombre: 'Laura Kariane Benítez',
          celular: '0973532550',
          ciudad: 'Ciudad del Este',
          departamento: 'Alto Paraná',
          direccion: 'Av. Camilo Recalde',
          producto: 'Noelux™ Proyector Navideño 12 Diseños',
          cantidad: 1,
          monto: 189000
        },
        openRouterApiKey: ''
      }),
    /OPENROUTER_API_KEY/
  );

  const originalFetch = globalThis.fetch;
  const calledUrls: string[] = [];
  const calledModels: string[] = [];
  globalThis.fetch = (async (input: any, init?: any) => {
    calledUrls.push(String(input));
    try {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body?.model) calledModels.push(String(body.model));
    } catch {}
    return new Response(JSON.stringify({ error: { message: 'Unauthorized key' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        renderPersonalizedOrderWelcomeImage({
          order: {
            reservaid: 'NX-NOFALLBACK-2',
            nombre: 'Laura Kariane Benítez',
            celular: '0973532550',
            ciudad: 'Ciudad del Este',
            departamento: 'Alto Paraná',
            direccion: 'Av. Camilo Recalde',
            producto: 'Noelux™ Proyector Navideño 12 Diseños',
            cantidad: 1,
            monto: 189000
          },
          openRouterApiKey: 'sk-or-v1-' + 'a'.repeat(56),
          openRouterImageModel: 'openai/gpt-image-2.6-sunburst',
          forceRegenerate: true
        }),
      /HTTP 401/
    );
    assert.ok(calledUrls.every(u => u === 'https://openrouter.ai/api/v1/images'));
    assert.ok(calledModels.every(m => m === 'openai/gpt-image-2.6-sunburst'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('renderPersonalizedOrderConfirmedImage builds final confirmation poster with customer name, congratulations, and 48-72h courier call notice', async () => {
  const { renderPersonalizedOrderConfirmedImage } = await import('../../server/waStageCommercialRenderer');

  const originalFetch = globalThis.fetch;
  let capturedPrompt = '';
  globalThis.fetch = (async (_input: any, init?: any) => {
    try {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body?.prompt) capturedPrompt = String(body.prompt);
    } catch {}
    return new Response(JSON.stringify({ error: { message: 'Unauthorized key' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        renderPersonalizedOrderConfirmedImage({
          order: {
            reservaid: 'NX-CONFIRMED-77',
            nombre: 'Carlos Alberto Giménez',
            celular: '0981445566',
            ciudad: 'Asunción',
            departamento: 'Central',
            direccion: 'Barrio Villa Morra',
            producto: 'Noelux™ Proyector Navideño 12 Diseños',
            cantidad: 2,
            monto: 358000
          },
          openRouterApiKey: 'sk-or-v1-' + 'b'.repeat(56),
          openRouterImageModel: 'openai/gpt-image-2.6-sunburst',
          forceRegenerate: true
        }),
      /HTTP 401/
    );
    assert.match(capturedPrompt, /PEDIDO CONFIRMADO/);
    assert.match(capturedPrompt, /FELICIDADES/i);
    assert.match(capturedPrompt, /Carlos Alberto Giménez/);
    assert.match(capturedPrompt, /48 a 72/i);
    assert.match(capturedPrompt, /courier|transportadora/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

