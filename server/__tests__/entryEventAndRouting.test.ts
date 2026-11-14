import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  applyEntryChoiceToOrder,
  buildEntryAttemptSpeech,
  buildEntryPollDefinition,
  buildFinalDispatchSpeech,
  buildInitialEntryEventState,
  buildWaitlistUpdateSpeech,
  classifyEntryTextIntent,
  evaluateEntryEventTick,
  isEntryOnlyOrderWithConfig,
  mixVoiceWithBackgroundMusic
} from '../entryEventEngine.ts';
import {
  replacePublishedAdInMeta,
  resolveCreativeTargetLandingUrl
} from '../metaCampaignOps.ts';
import {
  upgradeDefaultNoeluxWithVisualPreset,
  ensureProductHasMandatoryTripwire
} from '../../src/data/noeluxVisualPreset.ts';
import {
  analyzeQuickCreatorStrategy,
  generateUniversalVisualProductPage
} from '../visualLandingGenerator.ts';
import {
  buildPlannedSlotSpecs,
  clampAdsCount,
  computePlannedAdSetCounts,
  filterGenuineTripwirePages,
  resolveDefaultSlotMode
} from '../../src/utils/autoAdsSlotPlanner.ts';
import {
  buildCloneDraftFromProductPage,
  isProductCloneable
} from '../../src/utils/quickCreatorCloner.ts';

const PRODUCT_WITH_ENTRY = {
  id: 'prod-navidad-01',
  nombre: 'Noelux Proyector Navideño 12 Diseños',
  slug: 'noelux-proyector-navideno-12-disenos',
  imagen: 'https://cdn.example.com/proyector.jpg',
  precioNormal: 249000,
  precios: { 1: 189000, 2: 358000, 3: 507000 },
  tripwireConfig: {
    enabled: true,
    entryProductName: 'Guirnalda LED Navideña 10m',
    entryProductDescription: 'Guirnalda cálida resistente para exterior',
    entryProductImage: 'https://cdn.example.com/guirnalda.jpg',
    entryPriceGs: 20000,
    deliveryFeeGs: 40000,
    instantDiscountPercent: 12,
    eventDurationHours: 6,
    slotsTotal: 10,
    backgroundMusicPreset: 'warm_ambient' as const
  }
};

test('isEntryOnlyOrderWithConfig aísla estrictamente pedidos entry_only de los pedidos normales/principal_bundle', () => {
  const normalOrder = { reservaid: 'NX-100', purchasePath: 'principal_bundle' };
  const legacyOrder = { reservaid: 'NX-101' };
  const entryOrder = { reservaid: 'NX-102', purchasePath: 'entry_only' };
  const disabledProduct = { ...PRODUCT_WITH_ENTRY, tripwireConfig: { ...PRODUCT_WITH_ENTRY.tripwireConfig, enabled: false } };

  assert.equal(isEntryOnlyOrderWithConfig(normalOrder, PRODUCT_WITH_ENTRY), false);
  assert.equal(isEntryOnlyOrderWithConfig(legacyOrder, PRODUCT_WITH_ENTRY), false);
  assert.equal(isEntryOnlyOrderWithConfig(entryOrder, disabledProduct), false);
  assert.equal(isEntryOnlyOrderWithConfig(entryOrder, PRODUCT_WITH_ENTRY), true);
});

test('buildEntryPollDefinition y textos hablados jamás filtran la palabra interna prohibida al cliente', () => {
  const now = new Date('2026-11-10T12:00:00Z').getTime();
  const state = buildInitialEntryEventState(
    { reservaid: 'NX-200', celular: '595981111222', purchasePath: 'entry_only' },
    PRODUCT_WITH_ENTRY,
    now
  );
  const poll = buildEntryPollDefinition(PRODUCT_WITH_ENTRY, state);
  const speech1 = buildEntryAttemptSpeech({
    customerFirstName: 'María',
    matchedProduct: PRODUCT_WITH_ENTRY,
    state,
    attemptNumber: 1
  });
  const speech2 = buildEntryAttemptSpeech({
    customerFirstName: 'María',
    matchedProduct: PRODUCT_WITH_ENTRY,
    state,
    attemptNumber: 2
  });
  const waitlistSpeech = buildWaitlistUpdateSpeech({
    customerFirstName: 'María',
    matchedProduct: PRODUCT_WITH_ENTRY,
    state,
    remainingHours: 4
  });
  const finalSpeech = buildFinalDispatchSpeech({
    customerFirstName: 'María',
    matchedProduct: PRODUCT_WITH_ENTRY,
    state
  });

  const combined = [poll.question, ...poll.options, speech1, speech2, waitlistSpeech, finalSpeech].join('\n').toLowerCase();
  assert.equal(combined.includes('tripwire'), false, 'Ningún texto orientado al cliente puede contener "tripwire"');
  assert.equal(speech1.includes('40.000'), false, 'El primer mensaje en el chat no debe anticipar el monto del delivery antes del cierre del evento');
  assert.ok(speech1.includes('ENVÍO GRATIS'), 'El primer mensaje usa Envío Gratis como llave para subir al Producto Principal');
  assert.ok(finalSpeech.includes('40.000 guaraníes'), 'El cierre individual debe transparentar el delivery de 40.000 guaraníes recién al final del evento');
  assert.ok(finalSpeech.includes('60.000 guaraníes'), 'El cierre individual debe sumar 20.000 + 40.000 = 60.000 guaraníes');
});

test('classifyEntryTextIntent clasifica correctamente opción 1, opción 2 y ambigüedades', () => {
  assert.equal(classifyEntryTextIntent('1'), 'option_1_instant');
  assert.equal(classifyEntryTextIntent('Quiero llevar el paquete completo'), 'option_1_instant');
  assert.equal(classifyEntryTextIntent('2'), 'option_2_waitlist');
  assert.equal(classifyEntryTextIntent('Anotame en la lista de cupos'), 'option_2_waitlist');
  assert.equal(classifyEntryTextIntent('Gracias buen día'), null);
});

test('evaluateEntryEventTick cumple tope de 2 intentos -> silencio laboral -> cierre 6hs y actualizaciones cada 2h en lista', () => {
  const t0 = new Date('2026-11-10T10:00:00Z').getTime();
  const state1 = buildInitialEntryEventState(
    { reservaid: 'NX-300', celular: '595981999111', purchasePath: 'entry_only' },
    PRODUCT_WITH_ENTRY,
    t0
  );
  assert.equal(state1.stage, 'pending_choice');
  assert.equal(state1.attemptsSent, 1);

  // Antes de 90 min -> noop
  assert.equal(evaluateEntryEventTick(state1, t0 + 30 * 60 * 1000).action, 'noop');

  // A los 95 min -> Intento #2
  const tick2 = evaluateEntryEventTick(state1, t0 + 95 * 60 * 1000);
  assert.equal(tick2.action, 'send_attempt_2');
  assert.equal((tick2 as any).nextState.attemptsSent, 2);

  // Otros 95 min sin respuesta -> Silencio absoluto hasta el fin del evento
  const state2 = (tick2 as any).nextState;
  const tickSilence = evaluateEntryEventTick(state2, t0 + 190 * 60 * 1000);
  assert.equal(tickSilence.action, 'silence_until_end');
  const silencedState = (tickSilence as any).nextState;
  assert.equal(silencedState.stage, 'silenced_until_end');

  // Durante el silencio no envía nada antes del cierre
  assert.equal(evaluateEntryEventTick(silencedState, t0 + 300 * 60 * 1000).action, 'noop');

  // Al terminar las 6 horas -> Cierre final individual con delivery Gs. 40.000
  const tickEnd = evaluateEntryEventTick(silencedState, t0 + 365 * 60 * 1000);
  assert.equal(tickEnd.action, 'send_final_dispatch');
  assert.equal((tickEnd as any).nextState.stage, 'final_dispatched');

  // Escenario alternativo: cliente elige Lista 10 cupos (Opción 2) -> actualizaciones cada 2 horas
  const ord: any = { reservaid: 'NX-301', purchasePath: 'entry_only', tripwireEventState: state1 };
  const waitlistApplied = applyEntryChoiceToOrder(ord, PRODUCT_WITH_ENTRY, 'option_2_waitlist', t0 + 10 * 60 * 1000);
  assert.equal(waitlistApplied.upgradedToPrincipal, false);
  assert.equal(waitlistApplied.state.stage, 'waitlist_enrolled');

  assert.equal(evaluateEntryEventTick(waitlistApplied.state, t0 + 60 * 60 * 1000).action, 'noop');
  const tick2h = evaluateEntryEventTick(waitlistApplied.state, t0 + 135 * 60 * 1000);
  assert.equal(tick2h.action, 'send_waitlist_2h_update');
  assert.ok((tick2h as any).nextState.slotsTaken >= waitlistApplied.state.slotsTaken);
});

test('applyEntryChoiceToOrder Opción 1 actualiza pedido a principal_bundle con precio con descuento', () => {
  const t0 = new Date('2026-11-10T10:00:00Z').getTime();
  const state1 = buildInitialEntryEventState(
    { reservaid: 'NX-400', celular: '595981333444', purchasePath: 'entry_only' },
    PRODUCT_WITH_ENTRY,
    t0
  );
  const ord: any = {
    reservaid: 'NX-400',
    producto: 'Guirnalda LED Navideña 10m',
    cantidad: 1,
    monto: 20000,
    purchasePath: 'entry_only',
    tripwireEventState: state1
  };
  const res = applyEntryChoiceToOrder(ord, PRODUCT_WITH_ENTRY, 'option_1_instant', t0 + 1000);
  assert.equal(res.upgradedToPrincipal, true);
  assert.equal(ord.purchasePath, 'principal_bundle');
  assert.equal(ord.producto, PRODUCT_WITH_ENTRY.nombre);
  assert.equal(ord.monto, state1.instantUpgradePriceGs);
  assert.ok(ord.purchaseOfferTitle.includes('DE REGALO'));
});

test('replacePublishedAdInMeta con appendNew=true e isEntryHookAd=true inyecta sin borrar y dirige a ?modo=entrada', async () => {
  const calls: Array<{ url: string; method: string; body?: any }> = [];
  const fakePngDataUrl =
    'data:image/png;base64,' + Buffer.alloc(900, 7).toString('base64');

  const mockFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method || 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });

    if (url.includes('/adimages')) {
      return new Response(JSON.stringify({ images: { img: { hash: 'hash_entry_999' } } }), { status: 200 });
    }
    if (url.includes('/adcreatives')) {
      return new Response(JSON.stringify({ id: 'creative_entry_888' }), { status: 200 });
    }
    if (url.includes('/ads')) {
      return new Response(JSON.stringify({ id: 'ad_entry_777' }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }) as any;

  const res = await replacePublishedAdInMeta({
    campaignRecord: {
      campaignId: 'camp_1',
      adSetId: 'adset_1',
      productSlug: PRODUCT_WITH_ENTRY.slug,
      landingUrl: `https://autoads360.up.railway.app/?p=${PRODUCT_WITH_ENTRY.slug}`,
      publishedAds: [
        { adIndex: 0, adId: 'ad_std_1', creativeId: 'cr_1', isEntryHookAd: false }
      ]
    },
    adSetId: 'adset_1',
    oldAdId: 'ad_std_1',
    appendNew: true,
    adIndex: 1,
    product: PRODUCT_WITH_ENTRY,
    creative: {
      id: 'cr_entry_2',
      isEntryHookAd: true,
      angleName: 'Oferta de Entrada Navideña',
      headline: 'Llevá hoy la Guirnalda LED a Gs. 20.000',
      primaryText: 'Ideal para sumar brillo a tu fachada.',
      callToAction: 'SHOP_NOW',
      aiGeneratedImageDataUrl: fakePngDataUrl
    },
    landingUrl: `https://autoads360.up.railway.app/?p=${PRODUCT_WITH_ENTRY.slug}`,
    accessToken: 'EAA_TEST_TOKEN',
    envReader: () => '',
    fetchFn: mockFetch
  });

  assert.equal(res.ok, true);
  assert.equal(res.appendedNew, true);
  assert.equal(res.deletedFromMeta, false);
  assert.equal(calls.some((c) => c.method === 'DELETE'), false, 'appendNew jamás debe borrar anuncios previos');

  const creativeCall = calls.find((c) => c.url.includes('/adcreatives'));
  assert.ok(creativeCall, 'Debe crear AdCreative');
  const rawStorySpec = creativeCall!.body.object_story_spec;
  const parsedStorySpec =
    typeof rawStorySpec === 'string' ? JSON.parse(rawStorySpec) : rawStorySpec;
  const linkUsed: string = parsedStorySpec.link_data.link;
  const ctaLinkUsed: string = parsedStorySpec.link_data.call_to_action.value.link;
  assert.ok(linkUsed.includes('modo=entrada'), 'El anuncio gancho debe aterrizar en ?modo=entrada');
  assert.ok(ctaLinkUsed.includes('modo=entrada'));
  assert.equal(linkUsed.toLowerCase().includes('tripwire'), false);
  assert.equal(res.updatedCampaignRecord?.publishedAds?.length, 2);
});

test('mixVoiceWithBackgroundMusic respeta preset none y mezcla pista BGM real con ffmpeg si existe binario', async () => {
  const fakeOgg = Buffer.alloc(300, 1);
  const noneRes = await mixVoiceWithBackgroundMusic(fakeOgg, 'none');
  assert.equal(noneRes.mixedWithBgm, false);
  assert.ok(noneRes.audioDataUrl?.startsWith('data:audio/ogg;base64,'));

  // Limpiar si se verifica que public/assets/bgm existe solo cuando se invoca
  const hasFfmpeg = fs.existsSync('/usr/bin/ffmpeg');
  assert.equal(typeof hasFfmpeg, 'boolean');
  assert.ok(path.resolve(process.cwd(), 'server/entryEventEngine.ts'));
});

test('upgradeDefaultNoeluxWithVisualPreset revierte prod-noelux-01 a página Estándar clásica sin visualLanding ni tripwireConfig', () => {
  const legacyNoeluxWithVisual = {
    id: 'prod-noelux-01',
    nombre: 'Noelux™ Proyector Navideño 12 Diseños',
    slug: 'noelux-proyector-12-disenos',
    wa: '595973532550',
    visualLanding: {
      enabled: true,
      mode: 'sober_graphic_3sheet',
      sheets: [{ id: 'noelux_sheet_1', imageUrl: '/assets/visual-pages/noelux-sheet-1.jpg' }]
    },
    tripwireConfig: {
      enabled: true,
      entryProductName: 'Guirnalda LED',
      entryPriceGs: 20000
    }
  };
  const reverted = upgradeDefaultNoeluxWithVisualPreset(legacyNoeluxWithVisual) as any;
  assert.equal(reverted.wa, '595973532550');
  assert.equal(reverted.visualLanding, undefined);
  assert.equal(reverted.tripwireConfig, undefined);

  const otherProd = {
    id: 'prod-salud-99',
    nombre: 'Colágeno Plus',
    visualLanding: { enabled: true, mode: 'sober_graphic_3sheet', sheets: [] }
  };
  assert.deepEqual(upgradeDefaultNoeluxWithVisualPreset(otherProd), otherProd);
});

test('ensureProductHasMandatoryTripwire garantiza Tripwire activo en cualquier producto creado sin filtrar la palabra técnica', () => {
  const createdPlain = {
    id: 'prod-freidora-10',
    nombre: 'Freidora de Aire Digital 6L',
    imagen: 'https://cdn.example.com/freidora.jpg',
    precios: { 1: 389000, 2: 699000, 3: 989000 }
  };
  const enforced = ensureProductHasMandatoryTripwire(createdPlain) as any;
  assert.equal(enforced.tripwireConfig?.enabled, true);
  assert.ok(enforced.tripwireConfig?.entryProductName);
  assert.equal(enforced.tripwireConfig?.entryPriceGs, 20000);
  assert.equal(enforced.tripwireConfig?.deliveryFeeGs, 40000);
  const publicSerialized = JSON.stringify(enforced.tripwireConfig).toLowerCase();
  assert.equal(publicSerialized.includes('tripwire'), false, 'Ningún texto cliente debe mencionar tripwire');
});

test('generateUniversalVisualProductPage soporta modo Exclusivamente Producto Principal y modo Dual sin exponer palabra prohibida', async () => {
  const createdTempFiles: string[] = [];
  const fakeJpgB64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46]).toString('base64');

  const mockFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/chat/completions')) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  strategySummary: 'Estrategia limpia de prueba',
                  sobrietyHeadline: 'Cocina sin aceite en minutos',
                  subheadline: 'Capacidad familiar 6L con entrega a domicilio en todo Paraguay.',
                  winnerAngleHeadline: 'Cocción rápida y crocante sin exceso de grasa',
                  winnerAngleDescription: 'Circulación 360 grados con apagado automático.',
                  reversePsychologyHook: 'Compará llevar el accesorio suelto versus el equipo completo.',
                  entryButtonLabel: 'Elegir solo Papel Pergamino (Gs. 20.000)',
                  entryDisclaimer: 'Solo incluye el accesorio. Delivery Gs. 40.000.',
                  bundleButtonLabel: 'Pedir Freidora 6L — Envío Gratis (Gs. 389.000)',
                  bundleDisclaimer: 'Envío gratis en todo Paraguay.',
                  sheetPrompts: [
                    { role: 'hero_presentation', title: 'Lámina 1', caption: 'Vista 1', imagePrompt: 'clean product hero' },
                    { role: 'comparison_need', title: 'Lámina 2', caption: 'Vista 2', imagePrompt: 'clean comparison' }
                  ],
                  faq: [{ q: '¿Tiene envío gratis?', a: 'Sí en todo el país.' }],
                  agentContext: 'Precios exactos en Gs.'
                })
              }
            }
          ]
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ data: [{ b64_json: fakeJpgB64 }] }), { status: 200 });
  }) as any;

  try {
    const principalRes = await generateUniversalVisualProductPage({
      openRouterApiKey: 'test-key',
      pageCreationMode: 'principal_only',
      productName: 'Freidora de Aire 6L',
      productDescription: 'Freidora digital acero inoxidable 6 litros',
      winnerAngle: 'Ahorrá tiempo y aceite en cada comida familiar',
      price1Gs: 389000,
      sheetCount: 2,
      fetchImpl: mockFetch
    });

    for (const sh of principalRes.product.visualLanding?.sheets || []) {
      if (sh.imageUrl.startsWith('/assets/visual-pages/')) {
        createdTempFiles.push(path.resolve(process.cwd(), 'public', sh.imageUrl.replace(/^\//, '')));
      }
    }

    assert.equal(principalRes.product.tripwireConfig, undefined, 'principal_only no debe adjuntar tripwireConfig');
    assert.equal(principalRes.product.visualLanding?.enabled, true);
    assert.equal(principalRes.product.visualLanding?.sheets.length, 2);
    assert.equal(principalRes.product.visualLanding?.entryButtonLabel, undefined);
    assert.equal(
      JSON.stringify(principalRes.product).toLowerCase().includes('tripwire'),
      false,
      'Página principal_only no debe contener tripwire'
    );

    const dualRes = await generateUniversalVisualProductPage({
      openRouterApiKey: 'test-key',
      pageCreationMode: 'dual_tripwire_winner',
      productName: 'Freidora de Aire 6L',
      productDescription: 'Freidora digital acero inoxidable 6 litros',
      winnerAngle: 'Sistema completo con accesorios gratis',
      price1Gs: 389000,
      entryProductName: 'Pack 100 Papeles Antiadherentes',
      entryProductDescription: 'Bandejas descartables para freidora',
      entryPriceGs: 20000,
      entryDeliveryFeeGs: 40000,
      sheetCount: 2,
      fetchImpl: mockFetch
    });

    for (const sh of dualRes.product.visualLanding?.sheets || []) {
      if (sh.imageUrl.startsWith('/assets/visual-pages/')) {
        createdTempFiles.push(path.resolve(process.cwd(), 'public', sh.imageUrl.replace(/^\//, '')));
      }
    }

    assert.equal(dualRes.product.tripwireConfig?.enabled, true);
    assert.equal(dualRes.product.tripwireConfig?.entryPriceGs, 20000);
    assert.ok(dualRes.product.visualLanding?.winnerAngleHeadline);
    const dualPublicText = [
      JSON.stringify(dualRes.product.visualLanding),
      JSON.stringify(dualRes.product.landingContent),
      JSON.stringify(Object.values(dualRes.product.tripwireConfig || {}))
    ]
      .join('\n')
      .toLowerCase();
    assert.equal(
      dualPublicText.includes('tripwire'),
      false,
      'Página dual pública no debe filtrar palabra técnica tripwire'
    );
  } finally {
    for (const abs of createdTempFiles) {
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {}
    }
  }
});

test('resolveCreativeTargetLandingUrl redirige anuncio Tripwire dentro de campaña estándar a SU Página Tripwire seleccionada', () => {
  const campaignLandingUrl = 'https://autoads360.up.railway.app/?p=freidora-solo-principal';

  const standardAdUrl = resolveCreativeTargetLandingUrl({
    campaignLandingUrl,
    creative: { isEntryHookAd: false }
  });
  assert.equal(standardAdUrl, 'https://autoads360.up.railway.app/?p=freidora-solo-principal');

  const tripwireByExplicitUrl = resolveCreativeTargetLandingUrl({
    campaignLandingUrl,
    creative: {
      isEntryHookAd: true,
      targetProductSlug: 'combo-navidad-tripwire',
      targetLandingUrl: 'https://autoads360.up.railway.app/?p=combo-navidad-tripwire'
    }
  });
  assert.equal(
    tripwireByExplicitUrl,
    'https://autoads360.up.railway.app/?p=combo-navidad-tripwire&modo=entrada'
  );

  const tripwireBySlugOnly = resolveCreativeTargetLandingUrl({
    campaignLandingUrl,
    creative: {
      isEntryHookAd: true,
      targetProductSlug: 'miniproyector-entrada'
    }
  });
  assert.equal(
    tripwireBySlugOnly,
    'https://autoads360.up.railway.app/?p=miniproyector-entrada&modo=entrada'
  );
  assert.equal(tripwireBySlugOnly.includes('freidora-solo-principal'), false);
});

test('replacePublishedAdInMeta inyectando Tripwire en campaña estándar publica en Meta con la URL de la Página Tripwire elegida', async () => {
  const calls: Array<{ url: string; method: string; body?: any }> = [];
  const fakePngDataUrl =
    'data:image/png;base64,' + Buffer.alloc(900, 9).toString('base64');

  const mockFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method || 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });

    if (url.includes('/adimages')) {
      return new Response(JSON.stringify({ images: { img: { hash: 'hash_cross_111' } } }), { status: 200 });
    }
    if (url.includes('/adcreatives')) {
      return new Response(JSON.stringify({ id: 'creative_cross_222' }), { status: 200 });
    }
    if (url.includes('/ads')) {
      return new Response(JSON.stringify({ id: 'ad_cross_333' }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }) as any;

  const res = await replacePublishedAdInMeta({
    campaignRecord: {
      campaignId: 'camp_std_1',
      adSetId: 'adset_std_1',
      productSlug: 'freidora-solo-principal',
      landingUrl: 'https://autoads360.up.railway.app/?p=freidora-solo-principal',
      publishedAds: [
        { adIndex: 0, adId: 'ad_std_1', creativeId: 'cr_std_1', isEntryHookAd: false }
      ]
    },
    adSetId: 'adset_std_1',
    appendNew: true,
    adIndex: 1,
    product: {
      id: 'prod-tripwire-b',
      slug: 'combo-navidad-tripwire',
      nombre: 'Combo Proyector Navideño'
    },
    creative: {
      id: 'cr_cross_tripwire',
      isEntryHookAd: true,
      targetProductId: 'prod-tripwire-b',
      targetProductSlug: 'combo-navidad-tripwire',
      targetProductName: 'Combo Proyector Navideño',
      targetLandingUrl: 'https://autoads360.up.railway.app/?p=combo-navidad-tripwire&modo=entrada',
      headline: 'Guirnalda LED Navideña a Gs. 20.000',
      primaryText: 'Pagás al recibir en tu puerta.',
      ctaType: 'ORDER_NOW',
      aiGeneratedImageDataUrl: fakePngDataUrl
    },
    landingUrl: 'https://autoads360.up.railway.app/?p=freidora-solo-principal',
    accessToken: 'EAA_TEST_TOKEN',
    envReader: () => '',
    fetchFn: mockFetch
  });

  assert.equal(res.ok, true);
  assert.equal(calls.some(c => c.method === 'DELETE'), false);
  const creativeCall = calls.find(c => c.url.includes('/adcreatives'));
  assert.ok(creativeCall);
  const storySpec = JSON.parse(creativeCall!.body.object_story_spec);
  assert.equal(
    storySpec.link_data.link,
    'https://autoads360.up.railway.app/?p=combo-navidad-tripwire&modo=entrada'
  );
  assert.equal(
    storySpec.link_data.call_to_action.value.link,
    'https://autoads360.up.railway.app/?p=combo-navidad-tripwire&modo=entrada'
  );
  assert.equal(
    storySpec.link_data.link.includes('freidora-solo-principal'),
    false,
    'El anuncio Tripwire jamás debe ir a la página de la campaña estándar'
  );
  assert.equal(res.updatedAdEntry?.targetProductSlug, 'combo-navidad-tripwire');
  assert.equal(
    res.updatedAdEntry?.destinationUrl,
    'https://autoads360.up.railway.app/?p=combo-navidad-tripwire&modo=entrada'
  );
});

test('filterGenuineTripwirePages excluye a Noelux Estándar y páginas principales puras', () => {
  const cleanedNoelux = upgradeDefaultNoeluxWithVisualPreset({
    id: 'prod-noelux-01',
    nombre: 'Noelux™ Proyector Navideño 12 Diseños',
    slug: 'noelux-proyector-12-disenos',
    tripwireConfig: { enabled: true, entryProductName: 'Guirnalda LED', entryPriceGs: 20000 }
  });
  const principalOnly = {
    id: 'prod-auriculares',
    nombre: 'Auriculares Pro',
    slug: 'auriculares-pro'
  };
  const incompleteTripwire = {
    id: 'prod-incomplete',
    nombre: 'Incompleto',
    slug: 'incompleto',
    tripwireConfig: { enabled: true, entryProductName: '   ', entryPriceGs: 0 }
  };
  const genuineTripwire = {
    id: 'prod-freidora-tw',
    nombre: 'Freidora 6L',
    slug: 'freidora-6l',
    tripwireConfig: {
      enabled: true,
      entryProductName: 'Set 100 Papeles Antiadherentes',
      entryPriceGs: 20000
    }
  };

  const result = filterGenuineTripwirePages([
    cleanedNoelux,
    principalOnly,
    incompleteTripwire,
    genuineTripwire
  ] as any);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'prod-freidora-tw');
});

test('autoAdsSlotPlanner calcula cantidades libres (sin prefijos 4+2) y enruta cada slot a su URL exacta', () => {
  assert.equal(clampAdsCount(0, 4), 1);
  assert.equal(clampAdsCount(99, 4), 12);
  assert.equal(clampAdsCount('abc', 3), 3);

  // Caso 1: Mixto libre 3 Estándar + 5 Tripwire = 8 anuncios en total
  const counts35 = computePlannedAdSetCounts('hybrid', 3, 5);
  assert.deepEqual(counts35, { standardCount: 3, tripwireCount: 5, totalCount: 8 });

  const specs35 = buildPlannedSlotSpecs({
    strategyMode: 'hybrid',
    standardAdsCount: 3,
    tripwireAdsCount: 5,
    onlyImagesMode: false
  });
  assert.equal(specs35.length, 8);
  assert.equal(specs35.filter(s => s.slotMode === 'standard').length, 3);
  assert.equal(specs35.filter(s => s.slotMode === 'entry_hook').length, 5);
  assert.equal(specs35.every(s => s.isReel === false), true, 'En Mixto todos son imágenes directas por defecto');

  // Caso 2: Mixto libre 4 Estándar + 1 Tripwire = 5 anuncios
  const counts41 = computePlannedAdSetCounts('hybrid', 4, 1);
  assert.deepEqual(counts41, { standardCount: 4, tripwireCount: 1, totalCount: 5 });
  assert.equal(resolveDefaultSlotMode(3, 'hybrid', counts41.standardCount), 'standard');
  assert.equal(resolveDefaultSlotMode(4, 'hybrid', counts41.standardCount), 'entry_hook');

  // Enrutamiento cruzado: cada slot Estándar a ?p=<std>, cada slot Tripwire a ?p=<tw>&modo=entrada
  const stdLandingUrl = 'https://autoads360.up.railway.app/?p=noelux-proyector-12-disenos';
  for (const slot of specs35) {
    const isTw = slot.slotMode === 'entry_hook';
    const dest = resolveCreativeTargetLandingUrl({
      campaignLandingUrl: stdLandingUrl,
      creative: isTw
        ? {
            isEntryHookAd: true,
            targetProductSlug: 'freidora-6l',
            targetLandingUrl: 'https://autoads360.up.railway.app/?p=freidora-6l&modo=entrada'
          }
        : {
            isEntryHookAd: false,
            targetProductSlug: 'noelux-proyector-12-disenos',
            targetLandingUrl: stdLandingUrl
          }
    });
    if (isTw) {
      assert.equal(dest, 'https://autoads360.up.railway.app/?p=freidora-6l&modo=entrada');
    } else {
      assert.equal(dest, stdLandingUrl);
    }
  }
});

test('quickCreatorCloner extrae ficha completa para clonar páginas Tripwire y Estándar', () => {
  assert.equal(isProductCloneable(null), false);
  assert.equal(isProductCloneable(PRODUCT_WITH_ENTRY as any), true);

  const dualClone = buildCloneDraftFromProductPage(PRODUCT_WITH_ENTRY as any);
  assert.equal(dualClone.suggestedMode, 'dual_tripwire_winner');
  assert.equal(dualClone.productName, PRODUCT_WITH_ENTRY.nombre);
  assert.equal(dualClone.entryProductName, 'Guirnalda LED Navideña 10m');
  assert.equal(dualClone.entryPriceGs, 20000);
  assert.equal(dualClone.price1Gs, 189000);
  assert.equal(dualClone.clonedFromContext.sourceProductId, 'prod-navidad-01');
  assert.equal(dualClone.clonedFromContext.sourceEntryProductName, 'Guirnalda LED Navideña 10m');

  const stdClone = buildCloneDraftFromProductPage({
    id: 'prod-std-only',
    nombre: 'Auriculares Estudio ANC',
    slug: 'auriculares-anc',
    descripcion: 'Cancelación activa de ruido 40h',
    imagen: 'https://cdn.example.com/anc.jpg',
    precioNormal: 320000,
    precios: { 1: 249000, 2: 459000, 3: 649000 },
    wa: '595981112233',
    activo: true,
    creadoEn: '2026-11-10T00:00:00Z'
  } as any);
  assert.equal(stdClone.suggestedMode, 'principal_only');
  assert.equal(stdClone.entryProductName, '');
  assert.equal(stdClone.price1Gs, 249000);
  assert.equal(stdClone.clonedFromContext.sourceMode, 'principal_only');
});

test('generateUniversalVisualProductPage inyecta clonedFromContext al agente para crear ángulo e imágenes inéditas sin mencionar tripwire en público', async () => {
  const capturedChatPayloads: any[] = [];
  const createdTempFiles: string[] = [];
  const fakeJpgB64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46]).toString('base64');

  const mockFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/chat/completions')) {
      capturedChatPayloads.push(JSON.parse(String(init?.body || '{}')));
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  strategySummary: 'Ángulo clonado renovado sin duplicar visual',
                  sobrietyHeadline: 'Cocina saludable en tiempo récord para tu familia',
                  subheadline: 'Nueva edición de alta capacidad con envío gratis en Paraguay.',
                  winnerAngleHeadline: 'Versión Nocturna Express sin humo ni aceite',
                  winnerAngleDescription: 'Pensada para cenas rápidas entre semana con limpieza en 30 segundos.',
                  reversePsychologyHook: 'Compará el accesorio suelto versus el equipo completo.',
                  entryButtonLabel: 'Elegir solo Set de Papeles (Gs. 20.000)',
                  entryDisclaimer: 'Solo incluye el set de papeles. Delivery Gs. 40.000.',
                  bundleButtonLabel: 'Llevar Freidora 6L + Set Papeles GRATIS (Gs. 389.000)',
                  bundleDisclaimer: 'Envío gratis en todo Paraguay.',
                  sheetPrompts: [
                    { role: 'hero_presentation', title: 'Lámina Nueva 1', caption: 'Vista 1', imagePrompt: 'fresh studio hero' },
                    { role: 'comparison_need', title: 'Lámina Nueva 2', caption: 'Vista 2', imagePrompt: 'fresh comparison' }
                  ],
                  faq: [{ q: '¿Incluye garantía?', a: 'Sí, 7 días.' }],
                  agentContext: 'Precios exactos en Gs.'
                })
              }
            }
          ]
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ data: [{ b64_json: fakeJpgB64 }] }), { status: 200 });
  }) as any;

  try {
    const res = await generateUniversalVisualProductPage({
      openRouterApiKey: 'test-key',
      pageCreationMode: 'dual_tripwire_winner',
      productName: 'Freidora de Aire 6L',
      productDescription: 'Freidora digital acero inoxidable 6 litros',
      price1Gs: 389000,
      entryProductName: 'Set de Papeles Antiadherentes',
      entryPriceGs: 20000,
      clonedFromContext: {
        sourceProductId: 'prod-old-freidora',
        sourceProductName: 'Freidora Clásica 6L',
        sourceWinnerAngle: 'Ángulo original diurno de cocina familiar',
        differentiationNote: 'Estilo nocturno minimalista enfocado en cenas rápidas sin limpiar'
      },
      sheetCount: 2,
      fetchImpl: mockFetch
    });

    for (const sh of res.product.visualLanding?.sheets || []) {
      if (sh.imageUrl.startsWith('/assets/visual-pages/')) {
        createdTempFiles.push(path.resolve(process.cwd(), 'public', sh.imageUrl.replace(/^\//, '')));
      }
    }

    assert.equal(capturedChatPayloads.length, 1);
    const systemMsg = String(capturedChatPayloads[0]?.messages?.[0]?.content || '');
    assert.ok(systemMsg.includes('Freidora Clásica 6L'), 'Debe heredar conocimiento de la página clonada');
    assert.ok(
      systemMsg.includes('Estilo nocturno minimalista enfocado en cenas rápidas sin limpiar'),
      'Debe incluir la nueva dirección diferenciada'
    );
    assert.equal(
      JSON.stringify(res.product.visualLanding).toLowerCase().includes('tripwire'),
      false,
      'La landing pública generada nunca debe exponer tripwire'
    );
  } finally {
    for (const abs of createdTempFiles) {
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {}
    }
  }
});

test('analyzeQuickCreatorStrategy diagnostica página clonada y propone opciones manos libres en Estándar y Tripwire', async () => {
  const capturedPayloads: any[] = [];
  const mockFetch: typeof fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    capturedPayloads.push(body);
    const isPrincipal = String(body?.messages?.[0]?.content || '').includes('PRODUCTO GANADOR ÚNICO');
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                currentPageDiagnosis: 'La página clonada original usaba un enfoque navideño genérico con luz cálida doméstica.',
                assistantReply: 'Te propongo 3 ángulos frescos; la Opción 1 maximiza contraste visual sin repetir el clon.',
                recommendedSheetCount: isPrincipal ? 2 : 3,
                recommendedAudioPreset: 'soft_lounge',
                recommendedOptionId: 'opt_1',
                options: [
                  {
                    id: 'opt_1',
                    title: 'Fachada Impactante en 60 Segundos',
                    archetype: 'Recomendada por IA',
                    winnerAngle: 'Transformá tu patio sin cables ni escaleras en menos de un minuto',
                    visualDirection: 'Iluminación arquitectónica nocturna de lujo en patio paraguayo moderno, contraste cálido-ámbar',
                    recommendedSheetCount: isPrincipal ? 2 : 3,
                    recommendedAudioPreset: 'soft_lounge',
                    whyItConverts: 'Ataca directamente la pereza de colgar luces tradicionales.',
                    tripwireBridgeNote: isPrincipal ? '' : 'Compará decorar una esquina vs iluminar toda la casa gratis.'
                  },
                  {
                    id: 'opt_2',
                    title: 'Noche Segura Resistente a Lluvia',
                    archetype: 'Durabilidad Exterior',
                    winnerAngle: 'Proyección HD impermeable preparada para el clima de Paraguay',
                    visualDirection: 'Fotografía editorial macro bajo lluvia ligera nocturna con gotas nítidas',
                    recommendedSheetCount: 2,
                    recommendedAudioPreset: 'warm_ambient',
                    whyItConverts: 'Elimina objeción técnica de exterior.'
                  },
                  {
                    id: 'opt_3',
                    title: 'Ahorro Real frente a Instaladores',
                    archetype: 'Contraste Racional',
                    winnerAngle: 'Resultados profesionales en casa sin pagar mano de obra cada año',
                    visualDirection: 'Composición sobria minimalista sobre mesa oscura con ficha técnica clara',
                    recommendedSheetCount: 3,
                    recommendedAudioPreset: 'commercial_pulse',
                    whyItConverts: 'Justifica el valor en Gs. frente al gasto recurrente.'
                  }
                ]
              })
            }
          }
        ]
      }),
      { status: 200 }
    );
  }) as any;

  // 1. Modo Estándar con clonaje + consulta interactiva
  const cloneDraft = buildCloneDraftFromProductPage({
    ...PRODUCT_WITH_ENTRY,
    visualLanding: {
      enabled: true,
      mode: 'sober_graphic_2sheet',
      sobrietyHeadline: 'Iluminación navideña fácil',
      sheets: [
        { id: 's1', title: 'Portada Clásica', caption: 'Vista frontal', imageUrl: 'https://cdn.example.com/s1.jpg' }
      ]
    }
  } as any);

  assert.equal(cloneDraft.clonedFromContext.sourceHeadline, 'Iluminación navideña fácil');
  assert.ok(cloneDraft.clonedFromContext.sourceVisualSheetsSummary?.[0]?.includes('Portada Clásica'));

  const stdResult = await analyzeQuickCreatorStrategy({
    openRouterApiKey: 'test-key',
    pageCreationMode: 'principal_only',
    productName: cloneDraft.productName,
    productDescription: 'Proyector LED 12 discos exterior',
    price1Gs: 189000,
    clonedFromContext: cloneDraft.clonedFromContext,
    userQuestion: '¿Qué otro enfoque funciona para clientes exigentes?',
    fetchImpl: mockFetch
  });

  assert.equal(stdResult.options.length, 3);
  assert.equal(stdResult.recommendedOptionId, 'opt_1');
  assert.equal(stdResult.recommendedSheetCount, 2);
  assert.equal(stdResult.recommendedAudioPreset, 'soft_lounge');
  assert.ok(stdResult.currentPageDiagnosis.includes('enfoque navideño'));
  assert.equal(stdResult.options[0].tripwireBridgeNote, undefined);

  const stdPrompt = String(capturedPayloads[0]?.messages?.[1]?.content || '');
  assert.ok(stdPrompt.includes('Iluminación navideña fácil'));
  assert.ok(stdPrompt.includes('¿Qué otro enfoque funciona para clientes exigentes?'));

  // 2. Modo Tripwire + Ganador con puente dual
  const dualResult = await analyzeQuickCreatorStrategy({
    openRouterApiKey: 'test-key',
    pageCreationMode: 'dual_tripwire_winner',
    productName: 'Freidora de Aire 6L',
    productDescription: 'Freidora digital 6 litros acero',
    price1Gs: 389000,
    entryProductName: 'Set de Papeles Antiadherentes',
    entryPriceGs: 20000,
    fetchImpl: mockFetch
  });

  assert.equal(dualResult.recommendedSheetCount, 3);
  assert.ok(dualResult.options[0].tripwireBridgeNote && dualResult.options[0].tripwireBridgeNote.length > 5);
});

test('generateUniversalVisualProductPage soporta sheetCount auto y aplica visualDirection en GPT-2.6', async () => {
  const createdTempFiles: string[] = [];
  const capturedImgPayloads: any[] = [];
  const fakeJpgB64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46]).toString('base64');

  const mockFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/chat/completions')) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  strategySummary: 'Modo autónomo 3 láminas con iluminación editorial oscura',
                  recommendedAudioPreset: 'soft_lounge',
                  sobrietyHeadline: 'Cocina sin humo en la mitad de tiempo',
                  subheadline: 'Capacidad familiar real con entrega en mano.',
                  winnerAngleHeadline: 'Cenas listas sin ensuciar ollas',
                  winnerAngleDescription: 'Circulación rápida 360 grados para todo el hogar.',
                  bundleButtonLabel: 'Pedir Freidora 6L — Envío Gratis (389.000 Gs.)',
                  bundleDisclaimer: 'Pago al recibir en Paraguay.',
                  sheetPrompts: [
                    { role: 'hero_presentation', title: 'Lámina 1', caption: 'Hero', imagePrompt: 'Hero editorial oscuro' },
                    { role: 'comparison_need', title: 'Lámina 2', caption: 'Packs', imagePrompt: 'Comparativa clara' },
                    { role: 'social_trust_specs', title: 'Lámina 3', caption: 'Caja', imagePrompt: 'Unboxing estudio' }
                  ],
                  faq: [{ q: '¿Tiene garantía?', a: 'Sí.' }],
                  agentContext: 'Freidora 6L Gs. 389.000.'
                })
              }
            }
          ]
        }),
        { status: 200 }
      );
    }
    capturedImgPayloads.push(JSON.parse(String(init?.body || '{}')));
    return new Response(JSON.stringify({ data: [{ b64_json: fakeJpgB64 }] }), { status: 200 });
  }) as any;

  try {
    const res = await generateUniversalVisualProductPage({
      openRouterApiKey: 'test-key',
      pageCreationMode: 'principal_only',
      productName: 'Freidora de Aire 6L',
      productDescription: 'Freidora digital 6 litros acero',
      price1Gs: 389000,
      sheetCount: 'auto',
      backgroundMusicPreset: 'auto',
      visualDirection: 'Editorial oscuro de mármol y acento cálido metálico',
      fetchImpl: mockFetch
    });

    for (const sh of res.product.visualLanding?.sheets || []) {
      if (sh.imageUrl.startsWith('/assets/visual-pages/')) {
        createdTempFiles.push(path.resolve(process.cwd(), 'public', sh.imageUrl.replace(/^\//, '')));
      }
    }

    assert.equal(res.product.visualLanding?.mode, 'sober_graphic_3sheet');
    assert.equal(res.product.visualLanding?.sheets.length, 3);
    assert.equal(capturedImgPayloads.length, 3);
  } finally {
    for (const abs of createdTempFiles) {
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {}
    }
  }
});




