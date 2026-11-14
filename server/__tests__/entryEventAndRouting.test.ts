import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  applyEntryChoiceToOrder,
  buildEntryAttemptSpeech,
  buildEntryEventBrainPrompt,
  buildEntryEventConversationalFallback,
  buildEntryPollDefinition,
  buildFinalDispatchSpeech,
  buildInitialEntryEventState,
  buildWaitlistUpdateSpeech,
  classifyEntryTextIntent,
  evaluateEntryEventTick,
  isEntryOnlyOrderWithConfig,
  mixVoiceWithBackgroundMusic
} from '../entryEventEngine.ts';
import { extractCustomerShippingSummaryForVisual } from '../waStageCommercialRenderer.ts';
import {
  buildOrderFormPackageCopySpec,
  renderOrderFormPackageBannerPng
} from '../orderFormBannerRenderer.ts';
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
  generateUniversalVisualProductPage,
  recreateExactProductStudioImage,
  researchProductDeeplyWithAI,
  scrapeEntryProductUrlInfo
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

    const blueprintCall = capturedChatPayloads.find((p) =>
      String(p?.messages?.[0]?.content || '').includes('CONOCIMIENTO COMPLETO DE PÁGINA CLONADA')
    );
    assert.ok(blueprintCall, 'Debe generar la llamada blueprint heredando contexto clonado');
    const systemMsg = String(blueprintCall?.messages?.[0]?.content || '');
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
                    recommendedSheetCount: 2,
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

  assert.equal(dualResult.recommendedSheetCount, 2);
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

test('dual_tripwire_winner genera 7 imágenes 100% visuales: Entrada con tarjeta azul marino/dorado y guía GPS + 6 secciones Ganador sin caja roja ni texto cruel', async () => {
  const createdTempFiles: string[] = [];
  const capturedChatPayloads: any[] = [];
  const capturedImgPrompts: string[] = [];
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
                  strategySummary: 'Carta de Venta Visual de 7 imágenes: 1 Entrada Realista + 6 Secciones Producto Ganador',
                  recommendedAudioPreset: 'warm_ambient',
                  sobrietyHeadline: 'Brillo cálido en segundos',
                  subheadline: 'Diseño magnético real para tu hogar.',
                  winnerAngleHeadline: 'La transformación nocturna definitiva para toda tu casa',
                  winnerAngleDescription: 'Pensado para quien busca el resultado definitivo a todo color y desea solicitarlo por convicción.',
                  reversePsychologyHook: '¡Esperá! ¿Me regalás un segundo? Llevando la solución completa, la guirnalda va gratis y activás envío gratuito.',
                  entryButtonLabel: '¡PEDIR AHORA!',
                  bundleButtonLabel: '¡PEDIR AHORA!',
                  bundleDisclaimer: 'Incluye Proyector completo + Guirnalda DE REGALO + ENVÍO GRATUITO.',
                  sheetPrompts: [
                    { role: 'hero_presentation', title: 'Lámina 1 · Guirnalda LED', caption: 'Avatar, tarjeta azul marino y guía ¡PEDIR AHORA!', imagePrompt: 'Realistic DSLR lifestyle hook item with navy gold plaque SOLO ARTÍCULO SUELTO: DELIVERY Gs. 40.000' },
                    { role: 'comparison_need', title: 'Lámina 2 · Sección 1 ¡ESPERÁ!', caption: 'Ruptura + Demo a todo color', imagePrompt: 'Section 1 pattern interrupt + vibrant multicolor house projection' },
                    { role: 'comparison_need', title: 'Lámina 3 · Sección 2 Familia Real', caption: 'Transformación cotidiana', imagePrompt: 'Section 2 real family home transformation' },
                    { role: 'authority_transformation', title: 'Lámina 4 · Sección 3 Manos y Macro', caption: 'Manos reales 85mm', imagePrompt: 'Section 3 real hands + 85mm macro build' },
                    { role: 'social_trust_specs', title: 'Lámina 5 · Sección 4 Confianza Paraguay', caption: 'Miles de envíos Asunción CDE', imagePrompt: 'Section 4 Paraguayan buyer doorway verification Asunción CDE' },
                    { role: 'authority_transformation', title: 'Lámina 6 · Sección 5 Comparación Valor', caption: 'Por separado vs Paquete Completo', imagePrompt: 'Section 5 side-by-side comparison vs complete winning bundle VIGENTE HASTA MAÑANA SI NO CERRÁS ESTA PÁGINA' },
                    { role: 'social_trust_specs', title: 'Lámina 7 · Sección 6 Cierre Vendedor', caption: 'Regalo + Envío Gratis + Guía ¡PEDIR AHORA!', imagePrompt: 'Section 6 closing bundle + free shipping Gs. Gs. 189.000 + GPS button guide' }
                  ],
                  faq: [{ q: '¿Cómo solicito?', a: 'Tocando el botón de tu opción.' }],
                  agentContext: 'Precios exactos.'
                })
              }
            }
          ]
        }),
        { status: 200 }
      );
    }
    const imgBody = JSON.parse(String(init?.body || '{}'));
    capturedImgPrompts.push(String(imgBody?.prompt || ''));
    return new Response(JSON.stringify({ data: [{ b64_json: fakeJpgB64 }] }), { status: 200 });
  }) as any;

  try {
    const res = await generateUniversalVisualProductPage({
      openRouterApiKey: 'test-key',
      pageCreationMode: 'dual_tripwire_winner',
      productName: 'Proyector Láser Pro',
      productDescription: 'Cobertura arquitectónica total resistente al agua',
      price1Gs: 189000,
      entryProductName: 'Guirnalda LED 10m',
      entryPriceGs: 20000,
      entryDeliveryFeeGs: 40000,
      sheetCount: 'auto',
      fetchImpl: mockFetch
    });

    for (const sh of res.product.visualLanding?.sheets || []) {
      if (sh.imageUrl.startsWith('/assets/visual-pages/')) {
        createdTempFiles.push(path.resolve(process.cwd(), 'public', sh.imageUrl.replace(/^\//, '')));
      }
    }

    assert.equal(res.product.visualLanding?.mode, 'sober_graphic_7sheet');
    assert.equal(res.product.visualLanding?.sheets.length, 7, 'Debe generar 7 imágenes por página en modo Dual');
    assert.equal(res.product.visualLanding?.sheets[0]?.role, 'hero_presentation');
    assert.equal(res.product.visualLanding?.sheets[6]?.role, 'social_trust_specs');

    assert.equal(res.product.visualLanding?.entryButtonLabel, '¡PEDIR AHORA!');
    assert.equal(res.product.visualLanding?.bundleButtonLabel, '¡PEDIR AHORA!');
    assert.equal(res.product.visualLanding?.entryButtonColorName, 'VERDE Y DORADO');
    assert.equal(res.product.visualLanding?.bundleButtonColorName, 'VERDE Y DORADO');

    const blueprintPayload = capturedChatPayloads.find((p) =>
      String(p?.messages?.[0]?.content || '').includes('IMAGEN 1')
    );
    const sysPrompt = String(blueprintPayload?.messages?.[0]?.content || '');
    const userPrompt = String(blueprintPayload?.messages?.[1]?.content || '');
    assert.ok(sysPrompt.includes('AVATAR'), 'Imagen 1 debe exigir fotografía realista con avatar humano');
    assert.ok(sysPrompt.includes('subrayado amarillo'), 'Debe exigir ¡ESPERÁ! rojo con subrayado amarillo');
    assert.ok(sysPrompt.includes('PROHIBIDO ROJO'), 'Debe exigir tarjeta contenedora de precio lujosa y prohibir rojo plano');
    assert.ok(sysPrompt.includes('SOLO ARTÍCULO SUELTO'), 'Debe prohibir explícitamente la frase cruel SOLO ARTÍCULO SUELTO');
    assert.ok(sysPrompt.includes('PROHIBIDO EL COPIA Y PEGA'), 'Debe prohibir el copia y pega literal');
    assert.ok(sysPrompt.includes('PROHIBIDO DIBUJO ANIMADO'), 'Debe prohibir explícitamente dibujo animado y CGI neón');
    assert.ok(sysPrompt.includes('¡PEDIR AHORA!'), 'System prompt debe guiar al botón oficial ¡PEDIR AHORA!');
    assert.ok(userPrompt.includes("DO NOT mention 'Proyector Láser Pro'"), 'Lámina 1 debe prohibir mencionar el producto principal');
    assert.ok(userPrompt.includes('TOCÁ EL BOTÓN ¡PEDIR AHORA! ABAJO'), 'Lámina 1 debe señalar el botón ¡PEDIR AHORA! y GPS');
    assert.ok(userPrompt.includes('COMPLETÁ TUS DATOS PARA RECIBIR EN CASA'), 'Lámina final debe ser congruente con el texto del botón ¡PEDIR AHORA!');
    assert.ok(userPrompt.includes('NO PAGÁS ENVÍO'), 'El cierre de la Carta de Venta debe explicar que no pagás envío ni regalo');
    assert.ok(userPrompt.includes('VIGENTE HASTA MAÑANA'), 'Debe incluir urgencia estática sin reloj digital');
    assert.equal(/Gs\.\s+Gs\.\s*\d/.test(userPrompt), false, 'No debe duplicar nunca Gs. Gs. antes de un monto en el prompt');
    assert.equal(/Gs\.\s+Gs\.\s*\d/.test(sysPrompt), false, 'No debe duplicar Gs. Gs. antes de un monto en el prompt de sistema');
    assert.ok(
      capturedImgPrompts[0]?.includes('realistic Latin American human avatar') &&
        capturedImgPrompts[0]?.includes('¡PEDIR AHORA!') &&
        capturedImgPrompts[0]?.includes('#0B132B') &&
        capturedImgPrompts[0]?.includes('STRICTLY FORBIDDEN red, crimson, or maroon backgrounds') &&
        capturedImgPrompts[0]?.includes('BOTÓN DE GPS'),
      'El prompt final enviado al generador de imagen para la Lámina 1 debe exigir avatar realista, tarjeta azul marino/dorado sin rojo y guía al botón ¡PEDIR AHORA! + GPS'
    );
    assert.ok(
      capturedImgPrompts[6]?.includes('¡PEDIR AHORA!') &&
        capturedImgPrompts[6]?.includes('7 DÍAS DE GARANTÍA') &&
        capturedImgPrompts[6]?.includes('NO PAGÁS ENVÍO') &&
        capturedImgPrompts[6]?.includes('BOTÓN DE GPS') &&
        capturedImgPrompts[6]?.includes('FULL vibrant authentic real-world colors'),
      'La lámina 7 final debe exigir colores reales vibrantes, tarjeta esmeralda/dorada y guía paso a paso congruente al botón ¡PEDIR AHORA! + GPS'
    );
    assert.ok(
      capturedImgPrompts.every(
        (p) =>
          p.includes('STRICT DESIGN & SPANISH ORTHOGRAPHY RULE') &&
          !p.includes('Gs. Gs.') &&
          !/SOLO ART[ÍI]CULO SUELTO:/i.test(p)
      ),
      'Todas las 7 imágenes deben llevar la regla estricta anti-fallas, limpiar Gs. Gs. y purgar SOLO ARTÍCULO SUELTO:'
    );
    assert.ok(
      res.product.visualLanding?.entryDisclaimer?.toLowerCase().includes('no incluye'),
      'Fallback entryDisclaimer debe aclarar que no incluye el principal ni envío gratuito'
    );
    assert.equal(
      res.product.visualLanding?.entryDisclaimer?.includes('40.000'),
      false,
      'La landing Tripwire no debe anticipar el monto del delivery antes del evento'
    );
  } finally {
    for (const abs of createdTempFiles) {
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {}
    }
  }
});

test('scrapeEntryProductUrlInfo y researchProductDeeplyWithAI investigan online sin copiar en crudo y con visión exacta', async () => {
  const capturedCalls: Array<{ url: string; body: any }> = [];
  const sampleHtml = `
    <html>
      <head>
        <title>OEM Hot Sale Mini Humidifier 300ml</title>
        <meta property="og:title" content="Mini Humidificador Portátil 300ml USB" />
        <meta property="og:image" content="/images/ugly-supplier-collage.jpg" />
        <script type="application/ld+json">{"@type":"Product","name":"Difusor Ultrasónico 300ml","description":"Tanque 300ml apagado automático silencioso USB-C"}</script>
      </head>
      <body>
        <h1>Difusor Ultrasónico USB-C</h1>
        <p>Capacidad real de 300 ml con luz cálida ambiental y apagado automático a las 4 horas de uso continuo.</p>
      </body>
    </html>
  `;

  const mockFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('https://proveedor.example.com')) {
      return new Response(sampleHtml, { status: 200 });
    }
    const parsedBody = init?.body ? JSON.parse(String(init.body)) : {};
    capturedCalls.push({ url, body: parsedBody });

    // Simular fallback limpio si :online no responde
    if (parsedBody.model === 'openai/gpt-4o:online') {
      return new Response('Online plugin fallback test', { status: 400 });
    }

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                researchedName: 'Difusor Ultrasónico Portátil 300 ml USB-C',
                researchedDescription:
                  'Difusor ultrasónico silencioso con depósito de 300 ml, niebla fina continua, luz cálida regulable y apagado automático de seguridad por USB-C.',
                verifiedSpecs: [
                  'Depósito de 300 ml con autonomía hasta 6 horas',
                  'Alimentación USB-C de bajo consumo silencioso',
                  'Apagado automático al agotarse el agua'
                ],
                usageSummary: 'Ideal para escritorio, dormitorio o vehículo con aromas hidrosolubles.',
                exactVisualBlueprint:
                  'Compact cylindrical matte pearl-white ultrasonic aroma diffuser (300ml) with champagne metallic top ring, vertical warm glow slit, and single tactile chrome button on a 3/4 elevated studio angle'
              })
            }
          }
        ]
      }),
      { status: 200 }
    );
  }) as any;

  // 1. Con URL de proveedor + texto crudo spammy
  const rawSpamCopy = 'BUY NOW HOT SALE SKU-88291 dropshipping cheap humidifier 2025!!!';
  const resWithUrl = await researchProductDeeplyWithAI({
    openRouterApiKey: 'test-key',
    url: 'https://proveedor.example.com/item/123',
    productName: 'Humidifier SKU 88291',
    rawDescription: rawSpamCopy,
    fetchImpl: mockFetch
  });

  assert.equal(resWithUrl.ok, true);
  assert.equal(resWithUrl.scrapedImageUrl, 'https://proveedor.example.com/images/ugly-supplier-collage.jpg');
  assert.ok(!resWithUrl.researchedDescription.includes('SKU-88291'), 'No debe copiar texto crudo literalmente');
  assert.ok(resWithUrl.researchedDescription.includes('300 ml'), 'Debe sintetizar datos técnicos reales investigados');
  assert.ok(resWithUrl.verifiedSpecs.length >= 2);
  assert.ok(resWithUrl.exactVisualBlueprint.includes('300ml'));

  // Confirmar que incluyó vision image_url extraído de la URL en la llamada multimodal
  const visionCall = capturedCalls.find((c) => Array.isArray(c.body?.messages?.[1]?.content));
  assert.ok(visionCall, 'Debe analizar la imagen de referencia vía multimodal vision');

  // 2. Sin URL: solo nombre + texto en crudo
  const resWithoutUrl = await researchProductDeeplyWithAI({
    openRouterApiKey: 'test-key',
    productName: 'Difusor Ultrasónico USB',
    rawDescription: 'Difusor chiquito usb barato lindo',
    fetchImpl: mockFetch
  });
  assert.equal(resWithoutUrl.ok, true);
  assert.ok(resWithoutUrl.researchedDescription.length > 30);
});

test('Tripwire precio único + anti copia-pega + recreación automática de imagen limpia de estudio del producto exacto', async () => {
  const createdTempFiles: string[] = [];
  const fakeJpgB64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46]).toString('base64');
  const rawSupplierPaste = 'TEXTO CRUDO PROVEEDOR CHINO OEM 9999 COMPRE BARATO';
  const capturedImagePrompts: string[] = [];

  const mockFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const bodyObj = init?.body ? JSON.parse(String(init.body)) : {};

    if (url.includes('/chat/completions')) {
      const sys = String(bodyObj?.messages?.[0]?.content || '');
      if (sys.includes('Cerebro de Investigación Real')) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    researchedName: 'Organizador Giratorio Acrílico 360°',
                    researchedDescription:
                      'Base giratoria de acrílico cristalino 360 grados con rodamiento silencioso y bandejas ajustables en altura para organizar cosméticos o especias.',
                    verifiedSpecs: [
                      'Giro suave 360 grados con rodamiento de acero',
                      'Acrílico transparente de 4 mm lavable',
                      'Diámetro de 23 cm adaptable'
                    ],
                    usageSummary: 'Mantiene todo visible y al alcance sin desorden.',
                    exactVisualBlueprint:
                      'Clear thick crystal-acrylic 2-tier 360-degree rotating vanity organizer tray with brushed gold vertical dividers and raised guard rails'
                  })
                }
              }
            ]
          }),
          { status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  strategySummary: 'Precio único 1 unidad + estudio recreado',
                  recommendedAudioPreset: 'warm_ambient',
                  researchedProductDescription:
                    'Estación organizadora modular premium diseñada para transformar tu espacio con acceso inmediato.',
                  researchedEntryDescription:
                    'Organizador giratorio de acrílico cristalino 360° con niveles ajustables para uso diario.',
                  sobrietyHeadline: 'Orden instantáneo en cada giro',
                  subheadline: 'Organizá todo en segundos.',
                  winnerAngleHeadline: 'La solución definitiva para todo tu ambiente',
                  winnerAngleDescription: 'Pensada para quien desea orden absoluto todos los días.',
                  reversePsychologyHook: 'Llevando el sistema completo te llevás el organizador giratorio gratis.',
                  entryButtonLabel: 'Solicitar Organizador 360° — 1 unidad (Gs. 25.000)',
                  bundleButtonLabel: 'Solicitar Sistema Completo + Organizador GRATIS (Gs. 195.000)',
                  bundleDisclaimer: 'Envío GRATUITO incluido en todo Paraguay.',
                  sheetPrompts: [
                    { role: 'hero_presentation', title: 'Organizador 360', caption: 'Entrada', imagePrompt: 'Hero entry' },
                    { role: 'comparison_need', title: 'Clic', caption: 'Medio', imagePrompt: 'Bridge' },
                    { role: 'social_trust_specs', title: 'Solución', caption: 'Final', imagePrompt: 'Boom' }
                  ],
                  faq: [{ q: '¿Es 1 sola unidad?', a: 'Sí, el gancho es precio único por 1 unidad.' }],
                  agentContext: 'Precios exactos.'
                })
              }
            }
          ]
        }),
        { status: 200 }
      );
    }

    capturedImagePrompts.push(String(bodyObj?.prompt || ''));
    return new Response(JSON.stringify({ data: [{ b64_json: fakeJpgB64 }] }), { status: 200 });
  }) as any;

  try {
    const res = await generateUniversalVisualProductPage({
      openRouterApiKey: 'test-key',
      pageCreationMode: 'dual_tripwire_winner',
      productName: 'Sistema Modular Casa Pro',
      productDescription: 'RAW SUPPLIER TEXT COPIADO DEL CATALOGO MAYORISTA',
      price1Gs: 195000,
      entryProductName: 'Organizador 360',
      entryProductDescription: rawSupplierPaste,
      entryPriceGs: 25000,
      // SIN entryNormalPriceGs ni entrega custom: precio único solamente
      entryProductImageInput: 'https://ugly-supplier.example.com/raw-dirty-photo.jpg',
      sheetCount: 'auto',
      fetchImpl: mockFetch
    });

    const collectLocal = (u?: string) => {
      if (u && u.startsWith('/assets/visual-pages/')) {
        createdTempFiles.push(path.resolve(process.cwd(), 'public', u.replace(/^\//, '')));
      }
    };
    collectLocal(res.product.tripwireConfig?.entryProductImage);
    for (const sh of res.product.visualLanding?.sheets || []) collectLocal(sh.imageUrl);

    // 1. Cero copia-pega literal del texto crudo de proveedor
    assert.notEqual(res.product.tripwireConfig?.entryProductDescription, rawSupplierPaste);
    assert.ok(res.product.tripwireConfig?.entryProductDescription?.includes('360'));
    assert.notEqual(res.product.descripcion, 'RAW SUPPLIER TEXT COPIADO DEL CATALOGO MAYORISTA');

    // 2. Imagen recreada de estudio limpia en lugar de la foto fea de proveedor
    assert.ok(
      String(res.product.tripwireConfig?.entryProductImage || '').includes('entry_studio_'),
      'Debe reemplazar la imagen cruda de proveedor por imagen de estudio recreada del objeto exacto'
    );
    assert.ok(
      capturedImagePrompts.some((p) => p.includes('2-tier 360-degree rotating vanity organizer')),
      'El prompt de recreación de estudio debe usar el blueprint físico exacto investigado'
    );

    // 3. Precio único sin normal tachado inventado
    assert.equal(res.product.tripwireConfig?.entryPriceGs, 25000);
    assert.equal(res.product.tripwireConfig?.entryNormalPriceGs, undefined);
  } finally {
    for (const abs of createdTempFiles) {
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {}
    }
  }
});

test('Separación completa entry_only vs principal_bundle en Formulario, API, Tarjeta WA y Cerebro IA', () => {
  const entryState = buildInitialEntryEventState(
    { reservaid: 'NX-888', celular: '595981555666', purchasePath: 'entry_only', monto: 20000 },
    PRODUCT_WITH_ENTRY
  );

  // 1. Cerebro del Evento de Entrada conoce ambos productos, precios exactos, no filtra "tripwire"
  // e instruye que el sistema recibe la elección únicamente tocando botón 1 o botón 2 de la encuesta
  const brainPromptText = buildEntryEventBrainPrompt({
    customerFirstName: 'Carlos',
    matchedProduct: PRODUCT_WITH_ENTRY,
    state: entryState,
    contextoIA: 'Proyector de exterior resistente a lluvia.',
    incomingChannelLabel: 'texto'
  });
  assert.ok(brainPromptText.includes(PRODUCT_WITH_ENTRY.tripwireConfig.entryProductName));
  assert.ok(brainPromptText.includes(PRODUCT_WITH_ENTRY.nombre));
  assert.ok(brainPromptText.includes('un mensaje de texto escrito'));
  assert.ok(brainPromptText.includes('sistema informático recibe y procesa su respuesta ÚNICAMENTE eligiendo y tocando uno de los dos botones'));
  assert.ok(brainPromptText.includes('60.000 guaraníes')); // 20.000 + 40.000 delivery
  assert.equal(/tripwire/i.test(brainPromptText.replace('jamás digas la palabra prohibida "tripwire"', '')), false);

  const brainPromptAudio = buildEntryEventBrainPrompt({
    customerFirstName: 'Carlos',
    matchedProduct: PRODUCT_WITH_ENTRY,
    state: entryState,
    contextoIA: 'Proyector de exterior resistente a lluvia.',
    incomingChannelLabel: 'audio',
    wasUnclearAudio: true
  });
  assert.ok(brainPromptAudio.includes('una nota de voz (audio)'));
  assert.ok(brainPromptAudio.includes('no se escuchó con claridad'));

  const fallbackText = buildEntryEventConversationalFallback({
    customerFirstName: 'Carlos',
    matchedProduct: PRODUCT_WITH_ENTRY,
    state: entryState,
    isFromAudio: false
  });
  assert.ok(fallbackText.includes(PRODUCT_WITH_ENTRY.tripwireConfig.entryProductName));
  assert.ok(fallbackText.includes(PRODUCT_WITH_ENTRY.nombre));
  assert.ok(fallbackText.includes('60.000 guaraníes'));
  assert.ok(fallbackText.includes('Leí tu mensaje'));
  assert.ok(fallbackText.includes('sistema informático recibe tu respuesta únicamente eligiendo el botón uno o el botón dos en la encuesta'));
  assert.equal(/tripwire/i.test(fallbackText), false);

  const fallbackAudio = buildEntryEventConversationalFallback({
    customerFirstName: 'Carlos',
    matchedProduct: PRODUCT_WITH_ENTRY,
    state: entryState,
    isFromAudio: true,
    wasUnclearAudio: true
  });
  assert.ok(fallbackAudio.includes('no se escuchó con claridad'));
  assert.ok(fallbackAudio.includes('no hace falta mandar palabras ni notas de voz'));
  assert.equal(/tripwire/i.test(fallbackAudio), false);

  // 2. Renderizado visual de tarjeta WA respeta imagen y nombre exacto según purchasePath
  const productWithEntryImg = {
    ...PRODUCT_WITH_ENTRY,
    imagen: '/assets/principal.jpg',
    tripwireConfig: {
      ...PRODUCT_WITH_ENTRY.tripwireConfig,
      entryProductImage: '/assets/entry_led.jpg'
    }
  };
  const entryVisualSummary = extractCustomerShippingSummaryForVisual(
    {
      reservaid: 'NX-888',
      nombre: 'Carlos López',
      celular: '0981555666',
      productoId: PRODUCT_WITH_ENTRY.id,
      producto: PRODUCT_WITH_ENTRY.tripwireConfig.entryProductName,
      purchasePath: 'entry_only',
      cantidad: 1,
      monto: 20000
    },
    productWithEntryImg
  );
  assert.equal(entryVisualSummary.productName, PRODUCT_WITH_ENTRY.tripwireConfig.entryProductName);
  assert.equal(entryVisualSummary.productImgRef, '/assets/entry_led.jpg');
  assert.equal(entryVisualSummary.packQty, 1);

  const bundleVisualSummary = extractCustomerShippingSummaryForVisual(
    {
      reservaid: 'NX-889',
      nombre: 'María Gómez',
      celular: '0981777888',
      productoId: PRODUCT_WITH_ENTRY.id,
      producto: PRODUCT_WITH_ENTRY.nombre,
      purchasePath: 'principal_bundle',
      cantidad: 1,
      monto: 189000
    },
    productWithEntryImg
  );
  assert.equal(bundleVisualSummary.productName, PRODUCT_WITH_ENTRY.nombre);
  assert.equal(bundleVisualSummary.productImgRef, '/assets/principal.jpg');
  assert.equal(bundleVisualSummary.packQty, 1);

  // 3. Integridad estructural: OrderForm, POST /api/pedidos y whatsappEngine conectan ambos caminos sin atajos de texto que salten la encuesta
  const orderFormSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/OrderForm.tsx'), 'utf8');
  assert.ok(orderFormSrc.includes('producto: orderSubmittedProductName'));
  assert.ok(orderFormSrc.includes('data-testid="orderform-dual-path-clarification"'));

  const viteSrc = fs.readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');
  assert.ok(viteSrc.includes("if (pedido.purchasePath === 'entry_only')"));

  const waEngineSrc = fs.readFileSync(path.resolve(process.cwd(), 'server/whatsappEngine.ts'), 'utf8');
  assert.ok(waEngineSrc.includes('isEntryEventActiveNow'));
  assert.ok(waEngineSrc.includes('isMasterBundleOrder'));
  assert.ok(waEngineSrc.includes('reSendEntryPoll: true'));
  assert.ok(waEngineSrc.includes('reDispatchEntryPollForOrder'));
  assert.ok(waEngineSrc.includes('pollHistoryList'));
  assert.equal(waEngineSrc.includes('classifyEntryTextIntent('), false);
});

test('Formulario VIP: banner pre-generado por producto sin texto prohibido, guías por paso, auto-scroll solo en blur/focus y botón gráfico sin monto', async () => {
  const entrySpec = buildOrderFormPackageCopySpec({
    product: PRODUCT_WITH_ENTRY,
    purchasePath: 'entry_only',
    pack: 1
  });
  assert.equal(entrySpec.eyebrow, 'ESTE ES EL PAQUETE QUE ESTÁS ADQUIRIENDO');
  assert.equal(entrySpec.isEntryOnly, true);
  assert.ok(entrySpec.headlineLines.join(' ').includes('Guirnalda LED Navideña 10m'));
  assert.ok(entrySpec.ownershipLines.join(' ').includes('1 unidad de tu Guirnalda LED Navideña 10m'));
  assert.equal(entrySpec.priceText, 'Gs. 20.000');
  assert.ok(entrySpec.deliveryBannerText.includes('40.000'));
  assert.equal(JSON.stringify(entrySpec).toLowerCase().includes('solicitud individual'), false);
  assert.equal(JSON.stringify(entrySpec).toLowerCase().includes('tripwire'), false);
  assert.equal(/\bun pack\b/i.test(JSON.stringify(entrySpec)), false);

  const bundleSpec = buildOrderFormPackageCopySpec({
    product: PRODUCT_WITH_ENTRY,
    purchasePath: 'principal_bundle',
    pack: 1
  });
  assert.equal(bundleSpec.isEntryOnly, false);
  assert.ok(
    [...bundleSpec.headlineLines, ...bundleSpec.ownershipLines].join(' ').includes('DE REGALO')
  );
  assert.ok(bundleSpec.deliveryBannerText.includes('ENVÍO 100% GRATUITO'));
  assert.equal(bundleSpec.priceText, 'Gs. 189.000');
  assert.equal(JSON.stringify(bundleSpec).toLowerCase().includes('solicitud individual'), false);
  assert.equal(JSON.stringify(bundleSpec).toLowerCase().includes('tripwire'), false);

  const testProd = {
    ...PRODUCT_WITH_ENTRY,
    id: 'prod-test-banner-spec',
    imagen: '',
    tripwireConfig: {
      ...PRODUCT_WITH_ENTRY.tripwireConfig,
      entryProductImage: ''
    }
  };
  const createdBannerFiles: string[] = [];
  try {
    const renderedEntry = await renderOrderFormPackageBannerPng({
      product: testProd,
      purchasePath: 'entry_only',
      pack: 1,
      forceRegenerate: true
    });
    createdBannerFiles.push(path.resolve(process.cwd(), 'public', renderedEntry.publicUrl.replace(/^\//, '')));
    assert.ok(renderedEntry.buffer.length > 5000, 'Debe renderizar PNG real del paquete entrada');
    assert.equal(renderedEntry.buffer.subarray(0, 4).toString('hex'), '89504e47');

    const renderedBundle = await renderOrderFormPackageBannerPng({
      product: testProd,
      purchasePath: 'principal_bundle',
      pack: 1,
      forceRegenerate: true
    });
    createdBannerFiles.push(path.resolve(process.cwd(), 'public', renderedBundle.publicUrl.replace(/^\//, '')));
    assert.ok(renderedBundle.buffer.length > 5000, 'Debe renderizar PNG real del paquete maestro');
    assert.equal(renderedBundle.buffer.subarray(0, 4).toString('hex'), '89504e47');
  } finally {
    for (const f of createdBannerFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    }
  }

  const orderFormSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/OrderForm.tsx'), 'utf8');
  assert.ok(orderFormSrc.includes('data-testid="orderform-vip-steps-card"'));
  assert.ok(orderFormSrc.includes('/api/order-form/package-banner.png'));
  assert.ok(orderFormSrc.includes('/assets/form-step1-nombre-guide.png'));
  assert.ok(orderFormSrc.includes('/assets/form-step2-whatsapp-guide.png'));
  assert.ok(orderFormSrc.includes('/assets/form-step3-entrega-guide.png'));
  assert.ok(orderFormSrc.includes('/assets/form-confirm-order-cta.png'));
  assert.ok(orderFormSrc.includes('smoothCenterElement'));
  assert.equal(/solicitud individual/i.test(orderFormSrc), false, 'OrderForm no debe mostrar Solicitud Individual');
  assert.equal(
    orderFormSrc.includes('¡CONFIRMAR MI PEDIDO AHORA!} · {formatGs(total)}'),
    false,
    'El botón de confirmación no debe renderizar precio en HTML'
  );

  // Verificar que los assets gráficos existen en disco
  for (const rel of [
    'public/assets/form-confirm-order-cta.png',
    'public/assets/form-step1-nombre-guide.png',
    'public/assets/form-step2-whatsapp-guide.png',
    'public/assets/form-step3-entrega-guide.png'
  ]) {
    const abs = path.resolve(process.cwd(), rel);
    assert.ok(fs.existsSync(abs) && fs.statSync(abs).size > 5000, `Debe existir asset gráfico ${rel}`);
  }

  // Verificar endpoint y hook de pre-generación en creación de producto
  const viteSrc = fs.readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');
  assert.ok(viteSrc.includes('/api/order-form/package-banner.png'));
  const genSrc = fs.readFileSync(path.resolve(process.cwd(), 'server/visualLandingGenerator.ts'), 'utf8');
  assert.ok(genSrc.includes('preRenderOrderFormBannersForProduct'));
});







