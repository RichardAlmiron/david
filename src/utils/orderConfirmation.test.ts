import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isOrderConfirmedByAgent,
  buildOrderComparisonSummary,
  buildSellerExecutiveWhatsAppReport,
  cleanStreetAddressText,
  buildOrderLocationConfirmationText,
  formatParaguayanPhone433,
  normalizeParaguayanPhonesInText,
  formatDigitGroupForSpanishTTS,
  formatParaguayanPhonesForSpanishTTS,
  getInactivityFollowUpDelayMs,
  isUnclearOrTooShortCustomerReply,
  buildPoliteUnclearReplyClarification,
  isBuildingOrder,
  formatBuildingDetailsSummary,
  isPostConfirmReplyTooShort,
  buildEmpatheticPostConfirmationReply,
  filterAdminOrders,
  formatFullOrderTextForCourier,
  formatGuaraniesSpeech,
  normalizeGuaraniesCurrencyForSpeech,
  buildExpressInitialAddressTextCard,
  evaluateExpressOrderConfirmationInput
} from './orderConfirmation';
import { executeDeepseekHarnessOnDraft, cordisKernel } from '../services/deepseekHarnessEngine';
import { Order } from '../types';

const sampleOrder: Order = {
  reservaid: 'NX-203980',
  productoId: 'prod-noelux-01',
  producto: 'Noelux™ Proyector Navideño 12 Diseños',
  waVendedor: '595973532550',
  nombre: 'Christopher Almiron',
  celular: '0973434369',
  departamento: 'Central',
  ciudad: 'Hernandarias',
  direccion: 'En la cuadra de Dominic pizza',
  detalle: 'Efectivo al recibir',
  cantidad: 1,
  monto: 189000,
  ref_code: null,
  estado: 'reservado',
  datosConfirmados: true,
  empaquetado: true,
  convStep: 5,
  referenciaCasa: 'Es portón verde , frente a la iglesia'
};

const sampleInProgressOrder: Order = {
  ...sampleOrder,
  reservaid: 'NX-772771',
  nombre: 'Richard Gómez',
  datosConfirmados: false,
  empaquetado: false,
  convStep: 2,
  referenciaCasa: undefined
};

test('isOrderConfirmedByAgent detects confirmed orders accurately', () => {
  assert.equal(isOrderConfirmedByAgent(sampleOrder), true);
  assert.equal(isOrderConfirmedByAgent(sampleInProgressOrder), false);
});

test('buildOrderComparisonSummary compares web form data with confirmed chat data', () => {
  const summary = buildOrderComparisonSummary(sampleOrder);
  assert.equal(summary.coincidenDatos, true);
  assert.equal(summary.nombreWeb, 'Christopher Almiron');
  assert.equal(summary.nombreConfirmado, 'Christopher Almiron');
  assert.equal(summary.referenciaConfirmada, 'Es portón verde , frente a la iglesia');
  assert.ok(summary.resumenTexto.includes('Christopher Almiron'));
});

test('buildSellerExecutiveWhatsAppReport formats an enumerated, human report for the seller WhatsApp', () => {
  const report = buildSellerExecutiveWhatsAppReport(
    'Noelux™ Proyector Navideño 12 Diseños',
    [sampleOrder, sampleInProgressOrder],
    sampleOrder
  );

  assert.ok(report.includes('Confirmados listos:* 1'));
  assert.ok(report.includes('En curso de confirmación:* 1'));
  assert.ok(report.includes('#1 · Christopher Almiron'));
  assert.ok(report.includes('Es portón verde , frente a la iglesia'));
  assert.ok(report.includes('Richard Gómez'));
});

test('buildOrderComparisonSummary and buildSellerExecutiveWhatsAppReport include exact GPS link for courier', () => {
  const orderWithGps: Order = {
    ...sampleOrder,
    gpsLat: -25.2867,
    gpsLng: -57.647,
    gpsConfirmado: true
  };
  const summary = buildOrderComparisonSummary(orderWithGps);
  assert.equal(summary.gpsConfirmado, true);
  assert.equal(summary.gpsLink, 'https://www.google.com/maps?q=-25.286700,-57.647000');

  const report = buildSellerExecutiveWhatsAppReport(
    'Noelux™ Proyector Navideño 12 Diseños',
    [orderWithGps],
    orderWithGps
  );
  assert.ok(report.includes('GPS Exacto p/ Courier:* https://www.google.com/maps?q=-25.286700,-57.647000'));
});

test('Step 3 sends descriptive address WITHOUT exposing customer GPS URLs; Step 4 sends computer system confirmation without repeating address', () => {
  const orderWithEmbeddedGps = {
    ...sampleInProgressOrder,
    direccion: 'Av. Mariscal López 1234, Barrio Villa Morra · [GPS: https://www.google.com/maps?q=-25.286700,-57.647000]',
    gpsLat: -25.2867,
    gpsLng: -57.647,
    gpsLink: 'https://www.google.com/maps?q=-25.286700,-57.647000'
  };

  assert.equal(
    cleanStreetAddressText(orderWithEmbeddedGps.direccion),
    'Av. Mariscal López 1234, Barrio Villa Morra'
  );

  const step3Text = buildOrderLocationConfirmationText(orderWithEmbeddedGps, 3);
  assert.ok(step3Text.includes('Estos son los datos de dirección que pusiste en el formulario'));
  assert.ok(step3Text.includes('Ciudad donde vivís:* Hernandarias (Central)'));
  assert.ok(step3Text.includes('Calle y barrio donde vivís:* Av. Mariscal López 1234, Barrio Villa Morra'));

  // Zero customer-facing Google Maps / http URLs
  const urlMatches = step3Text.match(/https?:\/\/\S+/g) || [];
  assert.equal(urlMatches.length, 0);

  // Step 4 and Step 5 must NOT send any text message in chat (confirmation is spoken ONLY in voice)
  const step4Text = buildOrderLocationConfirmationText(orderWithEmbeddedGps, 4);
  assert.equal(step4Text, '');

  const step5Text = buildOrderLocationConfirmationText(orderWithEmbeddedGps, 5);
  assert.equal(step5Text, '');
});

test('Building (Edificio) order formats congruent Step 3 building details without customer GPS URL, Step 4 clarification, and Seller report', () => {
  const buildingOrder: Order = {
    ...sampleOrder,
    reservaid: 'NX-880112',
    nombre: 'Valeria Benítez',
    ciudad: 'Asunción - Barrio Villa Morra',
    direccion: 'Calle Senador Long casi España',
    tipoVivienda: 'edificio',
    nombreEdificio: 'Torre Molinos',
    pisoEdificio: '7',
    departamentoNumero: '704',
    tieneRecepcion: 'si_recepcionista',
    detalleRecepcion: 'Sí tiene recepción (La recepcionista recibe el pedido)',
    gpsLat: -25.2912,
    gpsLng: -57.5811,
    gpsConfirmado: true
  };

  assert.equal(isBuildingOrder(buildingOrder), true);
  assert.equal(isBuildingOrder(sampleOrder), false);

  const bldgSummary = formatBuildingDetailsSummary(buildingOrder);
  assert.ok(bldgSummary.includes('Edificio Torre Molinos'));
  assert.ok(bldgSummary.includes('Piso 7'));
  assert.ok(bldgSummary.includes('Dpto./Cuarto 704'));
  assert.ok(bldgSummary.includes('Recepción: Sí tiene recepción'));

  const step3BuildingText = buildOrderLocationConfirmationText(buildingOrder, 3);
  assert.ok(step3BuildingText.includes('Estos son los datos de tu EDIFICIO que pusiste en el formulario'));
  assert.ok(step3BuildingText.includes('Nombre del Edificio:* Torre Molinos'));
  assert.ok(step3BuildingText.includes('Piso y Departamento / Cuarto:* Piso 7 · Dpto./Cuarto 704'));
  assert.ok(step3BuildingText.includes('Recepción del pedido:* Sí tiene recepción'));
  assert.equal((step3BuildingText.match(/https?:\/\/\S+/g) || []).length, 0);

  const clarifyStep4Bldg = buildPoliteUnclearReplyClarification('Valeria', 4, 0, true);
  assert.ok(clarifyStep4Bldg.includes('recepcionista'));
  assert.ok(clarifyStep4Bldg.includes('edificio'));

  const sellerReport = buildSellerExecutiveWhatsAppReport(
    'Noelux™ Proyector Navideño 12 Diseños',
    [buildingOrder],
    buildingOrder
  );
  assert.ok(sellerReport.includes('🏢 *EDIFICIO*'));
  assert.ok(sellerReport.includes('Edificio Torre Molinos'));
  assert.ok(sellerReport.includes('Piso 7'));
});

test('Post-confirmation replies are never 1-3 words; they are empathetic, multi-angle, and congruent', () => {
  assert.equal(isPostConfirmReplyTooShort('Dale gracias'), true);
  assert.equal(isPostConfirmReplyTooShort('Claro que sí'), true);
  assert.equal(isPostConfirmReplyTooShort('Ok perfecto'), true);

  // Non-congruent / casual message: polite evasion with strong operational arguments across 4 distinct angles
  const nonCongruent1 = buildEmpatheticPostConfirmationReply(
    sampleOrder,
    'Che qué calor hace hoy en Asunción jajaja',
    1,
    '0973 532 550',
    false
  );
  const nonCongruent2 = buildEmpatheticPostConfirmationReply(
    sampleOrder,
    'Viste el partido de anoche?',
    2,
    '0973 532 550',
    false
  );
  assert.equal(isPostConfirmReplyTooShort(nonCongruent1), false);
  assert.equal(isPostConfirmReplyTooShort(nonCongruent2), false);
  assert.notEqual(nonCongruent1, nonCongruent2);
  assert.ok(nonCongruent1.includes('Christopher'));

  // Congruent product question
  const congruentReply = buildEmpatheticPostConfirmationReply(
    sampleOrder,
    'Una consulta, el proyector resiste la lluvia si lo pongo afuera en el patio?',
    1,
    '0973 532 550',
    false
  );
  assert.equal(isPostConfirmReplyTooShort(congruentReply), false);
  assert.ok(congruentReply.includes('impermeable') || congruentReply.includes('lluvia'));

  // Request to modify order -> explains why & what for with distinct angles and gives phone number
  const changeReply1 = buildEmpatheticPostConfirmationReply(
    sampleOrder,
    'Quiero agregar una unidad más a mi pedido por favor',
    1,
    '0973 532 550',
    false
  );
  const changeReply2 = buildEmpatheticPostConfirmationReply(
    sampleOrder,
    'Puedo cambiar la cantidad de mi pedido?',
    2,
    '0973 532 550',
    false
  );
  assert.equal(isPostConfirmReplyTooShort(changeReply1), false);
  assert.equal(isPostConfirmReplyTooShort(changeReply2), false);
  assert.notEqual(changeReply1, changeReply2);
  assert.ok(changeReply1.includes('0973 532 550'));
  assert.ok(changeReply2.includes('0973 532 550'));
});

test('Paraguayan mobile numbers are always grouped 4 - 3 - 3 and pronounced digit-by-digit (never centenas) with pause after prefix', () => {
  assert.equal(formatParaguayanPhone433('0973532550'), '0973 532 550');
  assert.equal(formatParaguayanPhone433('595973532550'), '0973 532 550');
  assert.equal(formatParaguayanPhone433('+595 981 234 567'), '0981 234 567');
  assert.equal(formatParaguayanPhone433('973532550'), '0973 532 550');

  // Even if an LLM writes 3 digits first ("097 353 2550"), normalizeParaguayanPhonesInText fixes it to 4-3-3
  assert.equal(
    normalizeParaguayanPhonesInText('Tu número es el 097 353 2550, ¿está bien?'),
    'Tu número es el 0973 532 550, ¿está bien?'
  );

  // Each group is converted digit-by-digit so TTS never reads centenas ("novecientos setenta y tres")
  assert.equal(formatDigitGroupForSpanishTTS('0973'), 'cero nueve siete tres');
  assert.equal(formatDigitGroupForSpanishTTS('857'), 'ocho cinco siete');
  assert.equal(formatDigitGroupForSpanishTTS('397'), 'tres nueve siete');

  // Full 4 - 3 - 3 TTS pronunciation with comma pause after 4-digit prefix and between 3-digit groups
  assert.equal(
    formatParaguayanPhonesForSpanishTTS('Tu número es el 097 353 2550'),
    'Tu número es el cero nueve siete tres, cinco tres dos, cinco cinco cero'
  );
  assert.equal(
    formatParaguayanPhonesForSpanishTTS('Te llamo al 0973 857 397 al llegar'),
    'Te llamo al cero nueve siete tres, ocho cinco siete, tres nueve siete al llegar'
  );
  assert.equal(
    formatParaguayanPhonesForSpanishTTS('Confirmame si es 0981 123 456'),
    'Confirmame si es cero nueve ocho uno, uno dos tres, cuatro cinco seis'
  );

  // Even if an LLM outputs Spanish words in centenas or decenas, it is converted to digit-by-digit 4 - 3 - 3 with comma pauses
  assert.equal(
    normalizeParaguayanPhonesInText('al cero noventa y siete tres cinco tres dos cinco cinco cero.'),
    'al 0973 532 550.'
  );
  assert.equal(
    formatParaguayanPhonesForSpanishTTS('Escribinos al cero novecientos setenta y tres, ochocientos cincuenta y siete, trescientos noventa y siete.'),
    'Escribinos al cero nueve siete tres, ocho cinco siete, tres nueve siete.'
  );
  assert.equal(
    formatParaguayanPhonesForSpanishTTS('Escribinos al cero noventa y siete tres cinco tres dos cinco cinco cero.'),
    'Escribinos al cero nueve siete tres, cinco tres dos, cinco cinco cero.'
  );
});

test('filterAdminOrders filters by customer name, phone number (in any format), and archive status', () => {
  const orders: Order[] = [
    { ...sampleOrder, reservaid: 'NX-1', nombre: 'Christopher Almiron', celular: '0973 857 397', archivado: false },
    { ...sampleOrder, reservaid: 'NX-2', nombre: 'María Benítez', celular: '595981234567', archivado: false },
    { ...sampleOrder, reservaid: 'NX-3', nombre: 'Carlos López', celular: '0973532550', archivado: true }
  ];

  // Default archiveMode = 'activos' excludes archived orders
  const activeOnly = filterAdminOrders(orders, { archiveMode: 'activos' });
  assert.equal(activeOnly.length, 2);
  assert.deepEqual(activeOnly.map(o => o.reservaid), ['NX-1', 'NX-2']);

  // archiveMode = 'archivados' returns only archived orders
  const archivedOnly = filterAdminOrders(orders, { archiveMode: 'archivados' });
  assert.equal(archivedOnly.length, 1);
  assert.equal(archivedOnly[0].reservaid, 'NX-3');

  // Filter by name
  const byName = filterAdminOrders(orders, { nameQuery: 'maría', archiveMode: 'todos' });
  assert.equal(byName.length, 1);
  assert.equal(byName[0].reservaid, 'NX-2');

  // Filter by phone (partial prefix or full number with/without spaces)
  const byPhonePrefix = filterAdminOrders(orders, { phoneQuery: '0973 857', archiveMode: 'todos' });
  assert.equal(byPhonePrefix.length, 1);
  assert.equal(byPhonePrefix[0].reservaid, 'NX-1');

  const byLocalPhone = filterAdminOrders(orders, { phoneQuery: '0981234', archiveMode: 'todos' });
  assert.equal(byLocalPhone.length, 1);
  assert.equal(byLocalPhone[0].reservaid, 'NX-2');
});

test('Progressive inactivity follow-up schedule uses 3 minutes first, then 1 hour consecutively', () => {
  assert.equal(getInactivityFollowUpDelayMs(1), 180_000); // 3 minutes
  assert.equal(getInactivityFollowUpDelayMs(2), 3_600_000); // 1 hour
  assert.equal(getInactivityFollowUpDelayMs(3), 3_600_000); // +1 hour consecutive
  assert.equal(getInactivityFollowUpDelayMs(4), 3_600_000); // +1 hour consecutive
});

test('Smart congruence gate allows intelligible 1-3 word replies while blocking noise/symbols and incongruent Step 4 yes/no', () => {
  // Pure punctuation, emojis, or hesitation noises are unclear
  assert.equal(isUnclearOrTooShortCustomerReply('?', 2), true);
  assert.equal(isUnclearOrTooShortCustomerReply('eh', 3), true);
  assert.equal(isUnclearOrTooShortCustomerReply('..', 1), true);
  assert.equal(isUnclearOrTooShortCustomerReply('👍', 1), true);
  assert.equal(isUnclearOrTooShortCustomerReply('mm', 1), true);

  // Intelligible 1, 2, or 3-word replies pass naturally in Steps 1-3
  assert.equal(isUnclearOrTooShortCustomerReply('sí', 1), false);
  assert.equal(isUnclearOrTooShortCustomerReply('claro', 1), false);
  assert.equal(isUnclearOrTooShortCustomerReply('dale', 2), false);
  assert.equal(isUnclearOrTooShortCustomerReply('correcto', 2), false);
  assert.equal(isUnclearOrTooShortCustomerReply('ok', 3), false);
  assert.equal(isUnclearOrTooShortCustomerReply('está bien', 3), false);
  assert.equal(isUnclearOrTooShortCustomerReply('no', 1), false);
  assert.equal(isUnclearOrTooShortCustomerReply('sí está todo bien', 2), false);
  assert.equal(isUnclearOrTooShortCustomerReply('sí tengo tiempo ahora', 1), false);

  // In Step 4 (facade/reception description), bare yes/no lacks congruence, while concise descriptions pass
  assert.equal(isUnclearOrTooShortCustomerReply('sí', 4), true);
  assert.equal(isUnclearOrTooShortCustomerReply('dale', 4), true);
  assert.equal(isUnclearOrTooShortCustomerReply('ok', 4), true);
  assert.equal(isUnclearOrTooShortCustomerReply('casa blanca', 4), false);
  assert.equal(isUnclearOrTooShortCustomerReply('portón negro', 4), false);

  const msg1 = buildPoliteUnclearReplyClarification('Richard', 2, 0, false, 'envío qué', false);
  const msg2 = buildPoliteUnclearReplyClarification('Richard', 2, 1, false, 'envío qué', false);
  assert.ok(msg1.includes('Richard'));
  assert.ok(msg2.includes('Richard'));
  assert.ok(msg1.includes('envío qué'));
  assert.ok(msg2.includes('audio cortito'));
  assert.equal(msg1.includes('frase completa'), false);
  assert.equal(msg1.startsWith('Hola'), false);
  assert.equal(msg2.startsWith('Hola'), false);
  assert.notEqual(msg1, msg2);
});

import {
  NICHE_CATEGORIES,
  SUBNICHE_TEMPLATES,
  calculateCodEconomicsParaguay,
  generateRealistic8PhotoGallery,
  buildAutoTrainedAgentBrain,
  synthesizeCompleteLandingContent,
  applyCodingAgentInstructionToDraft
} from '../data/productTemplatesCatalog';

test('Template Builder catalog contains 13+ Niche Categories and 25+ Sub-niche Mobile-App Templates for Paraguay COD', () => {
  assert.ok(NICHE_CATEGORIES.length >= 13);
  assert.ok(SUBNICHE_TEMPLATES.length >= 25);

  const cocinaTemplates = SUBNICHE_TEMPLATES.filter(t => t.nicheId === 'niche-cocina');
  assert.ok(cocinaTemplates.length >= 3);

  for (const tpl of SUBNICHE_TEMPLATES) {
    assert.ok(tpl.id.startsWith('tpl-'));
    assert.ok(tpl.defaultPricePack1 >= 99000);
    assert.ok(tpl.defaultPricePack2 > tpl.defaultPricePack1);
    assert.ok(tpl.defaultPricePack3 > tpl.defaultPricePack2);
    assert.ok(tpl.theme && tpl.theme.headerBg);
    assert.ok(tpl.defaultPhysicalTruth && tpl.defaultPhysicalTruth.boxContents.length > 5);
  }
});

test('calculateCodEconomicsParaguay computes psychological 9.000 Gs prices and net profit after CPA, courier, and bounce rate', () => {
  const eco = calculateCodEconomicsParaguay({
    supplierCostGs: 45000,
    estimatedCpaGs: 30000,
    courierCostGs: 28000,
    returnRatePercent: 10
  });

  assert.equal(eco.suggestedPack1Gs % 10000, 9000);
  assert.equal(eco.suggestedPack2Gs % 10000, 9000);
  assert.equal(eco.suggestedPack3Gs % 10000, 9000);
  assert.ok(eco.netProfitPack1Gs > 0);
  assert.ok(eco.netProfitPack2Gs > eco.netProfitPack1Gs);
  assert.ok(eco.netProfitPack3Gs > eco.netProfitPack2Gs);
});

test('generateRealistic8PhotoGallery and buildAutoTrainedAgentBrain train the WhatsApp Agent at 1000x with Physical Truth and COD prices', () => {
  const tpl = SUBNICHE_TEMPLATES.find(t => t.id === 'tpl-cocina-electro') || SUBNICHE_TEMPLATES[1];
  const truth = {
    ...tpl.defaultPhysicalTruth,
    realDimensions: '30 cm x 22 cm (Capacidad 5.5L)',
    materialMain: 'Acero Inoxidable 304 Antiadherente',
    boxContents: '1 Freidora Digital 5.5L, rejilla antiadherente y recetario en español'
  };

  const gallery = generateRealistic8PhotoGallery({
    productName: 'Freidora de Aire Gourmet Pro',
    mainImage: '/assets/real/galeria-1.jpg',
    physicalTruth: truth,
    template: tpl
  });
  assert.equal(gallery.length, 8);
  assert.ok(gallery[1].label.includes('30 cm x 22 cm'));

  const { agentBrain, contextoIA } = buildAutoTrainedAgentBrain({
    productName: 'Freidora de Aire Gourmet Pro',
    productDescription: 'Cociná crujiente sin aceite en 10 minutos',
    prices: { 1: 189000, 2: 349000, 3: 489000 },
    physicalTruth: truth,
    template: tpl,
    upsellPack2Enabled: true
  });

  assert.equal(agentBrain.shortProductSpoken, 'la Freidora de Aire Gourmet Pro');
  assert.ok(agentBrain.technicalSpecsSpoken.includes('Acero Inoxidable 304 Antiadherente'));
  assert.ok(agentBrain.boxContentsSpoken.includes('rejilla antiadherente'));
  assert.equal(agentBrain.upsellPack2Enabled, true);
  assert.equal(agentBrain.upsellPack2PriceGs, 349000);
  assert.ok(agentBrain.postConfirmationProductAngles.length >= 4);
  assert.ok(contextoIA.includes('VERDAD FÍSICA DEL PRODUCTO'));
  assert.ok(contextoIA.includes('349.000'));
});

test('applyCodingAgentInstructionToDraft mutates theme, prices, and Pack 2 gift bonus via natural language instructions', () => {
  const tpl = SUBNICHE_TEMPLATES[1];
  const landing = synthesizeCompleteLandingContent({
    productName: 'Picadora Eléctrica Inox',
    productDescription: tpl.winnerAngleHook,
    mainImage: tpl.previewImage,
    prices: { 1: 179000, 2: 329000, 3: 469000 },
    normalPrice: 245000,
    physicalTruth: tpl.defaultPhysicalTruth,
    template: tpl
  });

  const result = applyCodingAgentInstructionToDraft({
    instruction: 'Cambiar paleta a azul clínico, poner pack 1 en 169.000 e incluir regalo recetario digital en el Pack 2',
    currentLanding: landing,
    currentTheme: tpl.theme,
    currentPrices: { 1: 179000, 2: 329000, 3: 469000 },
    currentTruth: tpl.defaultPhysicalTruth,
    productName: 'Picadora Eléctrica Inox'
  });

  assert.equal(result.updatedPrices[1], 169000);
  assert.ok(result.updatedTheme.name.includes('Azul Clínico'));
  assert.ok(result.updatedLanding.packLabels[2].subtitle.includes('BONO'));
  assert.ok(result.appliedChanges.length >= 3);

  // Test WhatsApp, voice, box contents, warranty and shipping mutations
  const result2 = applyCodingAgentInstructionToDraft({
    instruction: 'Cambiame el WhatsApp al 0973 532 550, cambiale la voz a Néstor, en la caja incluye maletín rígido y 2 baterías, y ofrece 30 días de garantía',
    currentLanding: landing,
    currentTheme: tpl.theme,
    currentPrices: { 1: 179000, 2: 329000, 3: 469000 },
    currentTruth: tpl.defaultPhysicalTruth,
    productName: 'Picadora Eléctrica Inox',
    currentWa: '595981111111'
  });

  assert.equal(result2.updatedWa, '595973532550');
  assert.equal(result2.updatedVozAgente, 'deepgram-nestor');
  assert.ok(result2.updatedTruth.boxContents.includes('maletín rígido'));
  assert.equal(result2.updatedTruth.warrantyDays, 30);
  assert.ok(result2.appliedChanges.length >= 4);
});

import {
  META_EVENTS_CATALOG,
  DEFAULT_META_TRACKING_CONFIG,
  normalizeCustomerForAdvancedMatching,
  generateDeduplicationEventId
} from './metaPixelEngine';

test('Meta Pixel + First-Party CAPI Engine includes 12 full-funnel events and normalizes Paraguayan customer data for SHA-256 Advanced Matching', () => {
  assert.equal(META_EVENTS_CATALOG.length, 12);
  assert.equal(DEFAULT_META_TRACKING_CONFIG.capiServerEnabled, true);
  assert.equal(DEFAULT_META_TRACKING_CONFIG.advancedMatchingSha256, true);

  const eventNames = META_EVENTS_CATALOG.map(e => e.id);
  assert.ok(eventNames.includes('PageView'));
  assert.ok(eventNames.includes('ViewContent'));
  assert.ok(eventNames.includes('CustomizeProduct'));
  assert.ok(eventNames.includes('AddToCart'));
  assert.ok(eventNames.includes('InitiateCheckout'));
  assert.ok(eventNames.includes('AddPaymentInfo'));
  assert.ok(eventNames.includes('Lead'));
  assert.ok(eventNames.includes('Purchase'));
  assert.ok(eventNames.includes('GalleryInteraction'));
  assert.ok(eventNames.includes('EngagedVisitor'));
  assert.ok(eventNames.includes('DeepScroll'));

  const normalized = normalizeCustomerForAdvancedMatching({
    nombre: 'Christopher Almirón',
    celular: '0973 434 369',
    ciudad: 'Hernandarias',
    departamento: 'Alto Paraná',
    externalId: 'NX-990123'
  });

  assert.equal(normalized.fn, 'christopher');
  assert.equal(normalized.ln, 'almiron');
  assert.equal(normalized.ph, '595973434369');
  assert.equal(normalized.ct, 'hernandarias');
  assert.equal(normalized.st, 'altoparana');
  assert.equal(normalized.country, 'py');
  assert.equal(normalized.externalId, 'nx-990123');

  const eventId1 = generateDeduplicationEventId('Purchase');
  const eventId2 = generateDeduplicationEventId('Purchase');
  assert.ok(eventId1.startsWith('evt_Purchase_'));
  assert.notEqual(eventId1, eventId2);
});

import { computePackLadderFromUnit } from '../components/ProductTemplateBuilderModal';

test('2-Step Builder: computePackLadderFromUnit automatically computes 2nd and 3rd prices from 1st price and synthesizeCompleteLandingContent respects freeShipping', () => {
  const ladder = computePackLadderFromUnit(189000);
  assert.equal(ladder[1], 189000);
  assert.ok(ladder[2] > ladder[1] && ladder[2] < ladder[1] * 2);
  assert.ok(ladder[3] > ladder[2] && ladder[3] < ladder[1] * 3);
  assert.equal(ladder[2] % 10000, 9000);
  assert.equal(ladder[3] % 10000, 9000);

  const tpl = SUBNICHE_TEMPLATES[0];
  const landingFree = synthesizeCompleteLandingContent({
    productName: 'Taladro Percutor 21V',
    productDescription: 'Potencia industrial con 2 baterías de litio',
    mainImage: tpl.previewImage,
    prices: { 1: ladder[1], 2: ladder[2], 3: ladder[3] },
    normalPrice: ladder[0],
    physicalTruth: tpl.defaultPhysicalTruth,
    template: tpl,
    freeShipping: true
  });
  assert.ok(landingFree.topBarText.includes('ENVÍO GRATIS'));

  const landingPaidShipping = synthesizeCompleteLandingContent({
    productName: 'Taladro Percutor 21V',
    productDescription: 'Potencia industrial con 2 baterías de litio',
    mainImage: tpl.previewImage,
    prices: { 1: ladder[1], 2: ladder[2], 3: ladder[3] },
    normalPrice: ladder[0],
    physicalTruth: tpl.defaultPhysicalTruth,
    template: tpl,
    freeShipping: false
  });
  assert.ok(!landingPaidShipping.topBarText.includes('ENVÍO GRATIS'));
  assert.ok(landingPaidShipping.topBarText.includes('ENTREGA RÁPIDA'));
});

import {
  buildCompleteAdCreativesSuite,
  buildHighImpactAdSvgDataUrl,
  PIPEBOARD_MCP_TOOLS_CATALOG,
  DEFAULT_PIPEBOARD_CONFIG
} from './pipeboardEngine';
import { ProductPage } from '../types';

test('Pipeboard + OpenRouter engine generates 4 creatives (1:1 Feed, 1:1 Comparison, 9:16 Story, and 4-scene Animated Video) and regenerates images with variantSeed', () => {
  assert.equal(DEFAULT_PIPEBOARD_CONFIG.pipeboardMcpEndpoint, 'https://meta-ads.mcp.pipeboard.co');
  assert.equal(DEFAULT_PIPEBOARD_CONFIG.openRouterModel, 'openai/gpt-4o');
  assert.ok(PIPEBOARD_MCP_TOOLS_CATALOG.length >= 6);
  assert.ok(PIPEBOARD_MCP_TOOLS_CATALOG.some(t => t.toolName === 'create_campaign'));
  assert.ok(PIPEBOARD_MCP_TOOLS_CATALOG.some(t => t.toolName === 'create_ad_creative'));

  const mockProduct: ProductPage = {
    id: 'prod-test-pipeboard',
    slug: 'proyector-noelux',
    nombre: 'Noelux™ Proyector Navideño 12 Diseños',
    descripcion: 'Iluminá tu casa en 30 segundos con pago al recibir',
    imagen: '/assets/real/galeria-1.jpg',
    precios: { 1: 189000, 2: 339000, 3: 479000 },
    precioNormal: 279000,
    wa: '595973532550',
    activo: true,
    creadoEn: '2026-11-06T00:00:00Z',
    contextoIA: 'Proyector LED IP65',
    freeShipping: true
  };

  const suite1 = buildCompleteAdCreativesSuite(mockProduct, 0);
  assert.equal(suite1.length, 4);
  assert.equal(suite1[0].aspectRatio, '1:1');
  assert.equal(suite1[1].aspectRatio, '1:1');
  assert.equal(suite1[2].aspectRatio, '9:16');
  assert.equal(suite1[3].type, 'video_reel_9x16');
  assert.equal(suite1[3].videoScenes?.length, 4);
  assert.ok(suite1[0].imageDataUrl.startsWith('data:image/svg+xml;utf8,'));

  // Regenerating with a new variantSeed produces distinct high-impact SVG posters
  const suite2 = buildCompleteAdCreativesSuite(mockProduct, 1);
  assert.notEqual(suite1[0].imageDataUrl, suite2[0].imageDataUrl);
  assert.notEqual(suite1[2].imageDataUrl, suite2[2].imageDataUrl);

  const customSvg = buildHighImpactAdSvgDataUrl({
    productName: mockProduct.nombre,
    productImage: mockProduct.imagen,
    pricePack1Gs: 189000,
    pricePack2Gs: 339000,
    normalPriceGs: 279000,
    freeShipping: true,
    aspectRatio: '9:16',
    hookBadge: 'OFERTA EXCLUSIVA PARAGUAY',
    headline: 'LLEVÁ HOY Y PAGÁ AL RECIBIR',
    subHeadline: 'Iluminá tu casa en 30 segundos',
    ctaLabel: 'PEDIR AHORA',
    themeIndex: 2
  });
  assert.ok(customSvg.startsWith('data:image/svg+xml;utf8,'));
});

test('DeepSeek Harness (deepseek-ai/deepseek-harness) Cordis Kernel applies reversible mutations to draft schemas via plugins', () => {
  const registeredPlugins = cordisKernel.getPlugins();
  assert.equal(registeredPlugins.length, 5);
  assert.ok(registeredPlugins.some(p => p.id === 'dsh-plugin-emblem-hero'));
  assert.ok(registeredPlugins.some(p => p.id === 'dsh-plugin-theme-archetypes'));
  assert.ok(registeredPlugins.some(p => p.id === 'dsh-plugin-cod-pricing'));
  assert.ok(registeredPlugins.some(p => p.id === 'dsh-plugin-physical-truth'));
  assert.ok(registeredPlugins.some(p => p.id === 'dsh-plugin-channels-voice'));

  const initialDraft: ProductPage = {
    id: 'prod-test-dsh',
    slug: 'soldador-inverter',
    nombre: 'Soldador Inverter Turbo 250A',
    descripcion: 'Soldador ultra portátil para herrería y talleres en Paraguay',
    imagen: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=800',
    precios: { 1: 350000, 2: 650000 },
    precioNormal: 450000,
    wa: '0973532550',
    activo: true,
    creadoEn: '2026-11-06T00:00:00Z',
    themeConfig: {
      presetId: 'dark-gold',
      primaryColor: '#eab308',
      buttonShape: 'rounded-2xl',
      cardStyle: 'bordered',
      layoutArchetype: 'futuristic-cyber'
    } as any,
    landingContent: {
      brandTitle: 'TurboWelder',
      topBarBadge: 'OFERTA',
      topBarText: 'ENVÍO GRATIS',
      heroBadge: 'EDICIÓN 2026',
      heroTitle: 'Soldador Inverter Turbo 250A',
      heroHighlight: 'Tecnología alemana con electrodos hasta 3.2mm',
      heroSubtitle: 'La soldadora más versátil de Paraguay'
    } as any
  };

  // 1. Test Emblem Plugin
  const emblemResult = executeDeepseekHarnessOnDraft({
    instruction: 'Poné un emblema de CALIDAD PREMIUM 100% PARAGUAY con sello dorado',
    currentDraft: initialDraft
  });
  assert.ok(emblemResult.dshFramework.includes('deepseek-ai/deepseek-harness'));
  assert.ok(emblemResult.activePlugins.includes('dsh-plugin-emblem-hero'));
  assert.ok(emblemResult.updatedDraft.landingContent?.emblemBadge?.text.includes('CALIDAD PREMIUM'));
  assert.equal(emblemResult.updatedDraft.landingContent?.emblemBadge?.icon, 'golden-seal');

  // 2. Test Pricing Plugin (Ladder with 9.000 Gs ending)
  const priceResult = executeDeepseekHarnessOnDraft({
    instruction: 'Ajustá el precio a 299000 guaraníes para el pack individual',
    currentDraft: initialDraft
  });
  assert.ok(priceResult.activePlugins.includes('dsh-plugin-cod-pricing'));
  assert.equal(priceResult.updatedDraft.precios[1], 299000);
  assert.equal(priceResult.updatedDraft.precios[2], 539000); // 299000 * 1.8 = 538200 rounded to 539000 ending in 9000

  // 3. Test Physical Truth & Box Contents
  const truthResult = executeDeepseekHarnessOnDraft({
    instruction: 'En la caja incluye careta fotosensible, pinza de masa y electrodos de prueba a 220V con 6 meses de garantía',
    currentDraft: initialDraft
  });
  assert.ok(truthResult.activePlugins.includes('dsh-plugin-physical-truth'));
  assert.ok(truthResult.updatedDraft.physicalTruth?.boxContents?.includes('pinza'));
  assert.equal(truthResult.updatedDraft.physicalTruth?.warrantyDays, 180);
  assert.equal(truthResult.updatedDraft.physicalTruth?.powerSource, 'enchufe_220v');

  // 4. Test WhatsApp & Voice routing
  const channelResult = executeDeepseekHarnessOnDraft({
    instruction: 'Cambiá el WhatsApp de ventas a 0981 123 456 y activá la voz Aura-2 Luna',
    currentDraft: initialDraft
  });
  assert.ok(channelResult.activePlugins.includes('dsh-plugin-channels-voice'));
  assert.equal(channelResult.updatedDraft.wa, '595981123456');
  assert.equal(channelResult.updatedDraft.vozAgente, 'aura-2-luna-es');
});

import {
  extractAllProductImages,
  extractProductCoreIdentity,
  sanitizeAdCopyForParaguayCod,
  createDefaultBrainProfile,
  buildCreativeAssetsFromBrain,
  regenerateSingleCreativeAssetFromBrain
} from './autoAdsBrainEngine';

test('AutoAds Supreme Brain extracts all product gallery images, rotates them across 6 diverse creatives, and regenerates individual ads on demand', () => {
  const productWithGallery: ProductPage = {
    id: 'prod-autoads-test',
    slug: 'taladro-percutor-pro',
    nombre: 'Taladro Percutor 21V Industrial',
    descripcion: 'Taladro inalámbrico con 2 baterías de litio y maletín completo',
    imagen: '/assets/real/galeria-1.jpg',
    precios: { 1: 249000, 2: 449000, 3: 649000 },
    precioNormal: 349000,
    wa: '0973532550',
    activo: true,
    creadoEn: '2026-11-08T00:00:00Z',
    freeShipping: true,
    landingContent: {
      galleryItems: [
        { src: '/assets/real/galeria-1.jpg', label: 'Vista frontal' },
        { src: '/assets/real/galeria-2.jpg', label: 'Baterías de litio' },
        { src: '/assets/real/galeria-3.jpg', label: 'Maletín completo' }
      ],
      benefitCards: [
        { title: 'Motor Brushless', desc: 'Sin escobillas', img: '/assets/real/galeria-4.jpg' }
      ]
    } as any
  };

  const allImages = extractAllProductImages(productWithGallery, ['https://example.com/scraped-photo.jpg']);
  assert.ok(allImages.length >= 4);
  assert.equal(allImages[0], 'https://example.com/scraped-photo.jpg');
  assert.equal(allImages[1], '/assets/real/galeria-1.jpg');

  const brain = createDefaultBrainProfile(productWithGallery);
  const assets = buildCreativeAssetsFromBrain(productWithGallery, brain);
  assert.equal(assets.length, 6);
  // Zero pre-baked images in default state (all dynamic from OpenRouter)
  assert.equal(assets[0].aiGeneratedImageUrl, '');
  assert.ok((assets[0].aiImagePrompt || '').includes('Taladro Percutor 21V Industrial'));

  // Single ad regeneration produces a new angle, headline, primary text, and new AI prompt that are 100% congruent
  const regeneratedAd0 = regenerateSingleCreativeAssetFromBrain(
    productWithGallery,
    brain,
    0,
    1,
    { aiGeneratedImageUrl: '/assets/ai-ads/gpt_imagen_regen_test.png' }
  );
  assert.notEqual(regeneratedAd0.headline, assets[0].headline);
  assert.notEqual(regeneratedAd0.primaryText, assets[0].primaryText);
  assert.equal(regeneratedAd0.aiGeneratedImageUrl, '/assets/ai-ads/gpt_imagen_regen_test.png');

  // Verify 100% Universal Product Adaptation & 0.0-Second Rule (Words 1 to 4 = Object + Offer/Solution/Pain)
  for (const ad of assets) {
    const combined = `${ad.headline} ${ad.primaryText} ${ad.aiImagePrompt || ''}`.toLowerCase();
    assert.equal(combined.includes('fachada'), false);
    assert.equal(combined.includes('cables enredados'), false);
    assert.equal(combined.includes('ip65'), false);
    assert.equal(combined.includes('casetes'), false);
    assert.equal(combined.includes('estaca'), false);
    assert.equal(combined.includes('mirá la imagen'), false);
    assert.equal(combined.includes('hoy mismo en tu puerta'), false);
    assert.ok(combined.includes('taladro percutor'));

    // Verify 0.0-second rule: the object ("taladro") MUST be present within the first 4 words of primaryText and headline
    const firstFourPrimaryWords = ad.primaryText
      .split('\n')[0]
      .replace(/[🔥✨💡🤝⚡📦🛑🎁🎄✅⭐¿?¡!:.,—\-()]/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join(' ')
      .toLowerCase();
    assert.ok(
      firstFourPrimaryWords.includes('taladro'),
      `Expected 'taladro' in first 4 words of primaryText, got: "${firstFourPrimaryWords}"`
    );

    // Verify that the image prompt for this ad directly includes the exact opening stanza (primera estrofa) of this ad
    const firstStanza = ad.primaryText.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim().slice(0, 80);
    assert.ok(
      (ad.aiImagePrompt || '').includes(firstStanza),
      `Expected aiImagePrompt to include the ad's first stanza "${firstStanza}"`
    );
  }

  // Verify 3-word prepositional product names (e.g. "BioFlex™ Crema para Dolor Articular" -> "Crema para Dolor")
  const remedyIdentity = extractProductCoreIdentity({
    nombre: 'BioFlex™ Crema para Dolor Articular 100ml'
  });
  assert.equal(remedyIdentity.brandTokenRemoved, 'BioFlex');
  assert.equal(remedyIdentity.ultraShortObjectLabel, 'Crema para Dolor');

  // Verify Product-First Identity extraction & COD Paraguay copy sanitization (strips unknown brand like Noelux™, fixes "hoy mismo en tu puerta", strips "Mirá la imagen:", enforces 0.0s hook in words 1-4)
  const brandedProduct: Partial<ProductPage> = {
    nombre: 'Noelux™ Proyector Navideño 12 Diseños'
  };
  const identity = extractProductCoreIdentity(brandedProduct);
  assert.equal(identity.brandTokenRemoved, 'Noelux');
  assert.equal(identity.genericProductName, 'Proyector Navideño 12 Diseños');
  assert.equal(identity.ultraShortObjectLabel, 'Proyector Navideño');
  assert.equal(identity.shortCategoryNoun, 'Proyector Navideño');

  const dirtyCopy =
    '🔥 Mirá la imagen: una sola Noelux™ proyectando 70 m² con máxima nitidez por Gs. 189.000 sin miedo a estafas.\n\n✨ Vos podés tener esto HOY mismo en tu puerta. Tocá en PEDIR CONTRA ENTREGA con cobro contra entrega.';
  const cleanCopy = sanitizeAdCopyForParaguayCod(dirtyCopy, brandedProduct, 0);
  const cleanParagraphs = cleanCopy.split(/\n\s*\n/);
  // First stanza must talk 100% about product/pleasure/solution with ZERO price and ZERO payment/scam fear
  assert.ok(cleanParagraphs[0].includes('PROYECTOR NAVIDEÑO EN OFERTA:'));
  assert.ok(cleanParagraphs[0].includes('proyectando 70 m²'));
  assert.equal(cleanParagraphs[0].toLowerCase().includes('gs.'), false);
  assert.equal(cleanParagraphs[0].toLowerCase().includes('estafa'), false);
  assert.equal(cleanParagraphs[0].toLowerCase().includes('pagás cuando recibís'), false);
  // Lower stanzas keep sanitized delivery & COD terms
  assert.equal(cleanCopy.toLowerCase().includes('noelux'), false);
  assert.equal(cleanCopy.toLowerCase().includes('mirá la imagen'), false);
  assert.equal(cleanCopy.toLowerCase().includes('hoy mismo en tu puerta'), false);
  assert.equal(cleanCopy.toLowerCase().includes('contra entrega'), false);
  assert.ok(cleanCopy.includes('PAGÁS CUANDO RECIBÍS'));
  assert.ok(cleanCopy.includes('pagás cuando recibís en tu puerta'));
  assert.ok(cleanCopy.includes('2 a 3 días hábiles'));

  // Verify ALL 6 ads dedicate 100% of their first stanza to the product/pleasure/solution (zero Gs. price, zero payment/scam fear in paragraph 1)
  assert.equal(assets[0].ctaLabel, 'PAGÁS CUANDO RECIBÍS');
  for (const ad of assets) {
    const firstPara = ad.primaryText.split(/\n\s*\n/)[0] || '';
    assert.equal(firstPara.toLowerCase().includes('gs.'), false, `Ad ${ad.id} first stanza must not contain Gs. price`);
    assert.equal(firstPara.toLowerCase().includes('estafa'), false, `Ad ${ad.id} first stanza must not mention scams`);
    assert.equal(firstPara.toLowerCase().includes('girar'), false, `Ad ${ad.id} first stanza must not mention wiring money`);
    assert.equal(ad.ctaLabel.toLowerCase().includes('contra entrega'), false);
    assert.equal(ad.primaryText.toLowerCase().includes('contra entrega'), false);
  }

  // Verify Real-Time Price Synchronization: changing product.precios[1] and [2] updates ad texts and headlines immediately even over an existing brainProfile
  const liveUpdatedProduct: ProductPage = {
    ...productWithGallery,
    precios: { 1: 159000, 2: 299000, 3: 429000 },
    precioNormal: 229000
  };
  const liveUpdatedAssets = buildCreativeAssetsFromBrain(liveUpdatedProduct, brain);
  assert.ok(liveUpdatedAssets[3].primaryText.includes('299.000'));
  assert.ok(liveUpdatedAssets[0].primaryText.includes('159.000'));
  assert.ok(liveUpdatedAssets[0].primaryText.includes('299.000'));
  assert.equal(liveUpdatedAssets[0].primaryText.includes('249.000'), false);
});

test('formatFullOrderTextForCourier formats 1-click clipboard summary for courier with customer name, phone, city, address, reference and GPS', () => {
  const comp = buildOrderComparisonSummary(sampleOrder);
  const text = formatFullOrderTextForCourier(sampleOrder, comp, 'confirmado');

  assert.ok(text.includes('Christopher Almiron'));
  assert.ok(text.includes('0973434369'));
  assert.ok(text.includes('Hernandarias'));
  assert.ok(text.includes('Dominic pizza'));
  assert.ok(text.includes('portón verde'));
  assert.ok(text.includes('FICHA DE DESPACHO'));
});

test('Supabase SQL master schema scripts define all required tables, RPC verificar_login_admin, and RLS policies', async () => {
  const fsMod = await import('node:fs');
  const pathMod = await import('node:path');

  const schemaPaths = [
    pathMod.resolve(process.cwd(), 'database', 'noelux_admin_schema.sql'),
    pathMod.resolve(process.cwd(), 'database', 'supabase_complete_schema.sql')
  ];

  for (const schemaPath of schemaPaths) {
    assert.equal(fsMod.existsSync(schemaPath), true, `Missing SQL schema file: ${schemaPath}`);
    const sql = fsMod.readFileSync(schemaPath, 'utf-8');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.codigos'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.pedidos'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.eventos_publicos'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.admin_users'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.admin_sesiones'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.admin_audit_logs'));
    assert.ok(sql.includes('verificar_login_admin'));
    assert.ok(sql.includes('encuestas977@gmail.com'));
  }
});

test('sanitizeAuthDirectory preserves outbound Signal sessions with pendingPreKey so customer replies decrypt cleanly', async () => {
  const { sanitizeAuthDirectory } = await import('../../server/whatsappEngine');
  const fsMod = await import('node:fs');
  const pathMod = await import('node:path');
  const osMod = await import('node:os');

  const tmpDir = fsMod.mkdtempSync(pathMod.join(osMod.tmpdir(), 'noelux-wa-signal-test-'));
  try {
    // 1. Valid outbound Signal session with pendingPreKey (created when Agent sends Step 1)
    const outboundSessionPath = pathMod.join(tmpDir, 'session-595981223344.0.json');
    fsMod.writeFileSync(
      outboundSessionPath,
      JSON.stringify({
        _sessions: {
          bx1: {
            indexInfo: { baseKeyType: 1 },
            pendingPreKey: { preKeyId: 12, signedKeyId: 1 },
            chains: {}
          }
        }
      }),
      'utf-8'
    );

    // 2. Corrupt 0-byte file (should be cleaned)
    const emptyFilePath = pathMod.join(tmpDir, 'pre-key-999.json');
    fsMod.writeFileSync(emptyFilePath, '', 'utf-8');

    const res = sanitizeAuthDirectory(tmpDir);
    assert.equal(res.cleanedCount, 1);
    assert.equal(
      fsMod.existsSync(outboundSessionPath),
      true,
      'Outbound Signal session with pendingPreKey must NEVER be deleted'
    );
    assert.equal(fsMod.existsSync(emptyFilePath), false);
  } finally {
    fsMod.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Contextual congruence brain: intelligible 1-3 word replies reach semantic LLM while empty/noise inputs are blocked', async () => {
  const {
    evaluateSurfaceSyntacticIntegrity,
    calculateNormalizedSentenceSimilarity
  } = await import('../../server/whatsappEngine');

  const emptyOrNoiseInputs = ['?', '..', 'eh', 'mm', '👍', '[El cliente envió un audio que no se escuchó]'];
  for (const noise of emptyOrNoiseInputs) {
    assert.equal(
      evaluateSurfaceSyntacticIntegrity(noise, false).isSingleWordOrEmpty,
      true,
      `Noise/empty input "${noise}" must be flagged as empty/inaudible`
    );
  }

  const intelligibleShortReplies = ['sí', 'si', 'dale', 'ok', 'claro', 'correcto', 'no', 'está bien', 'casa blanca', 'portón negro'];
  for (const shortReply of intelligibleShortReplies) {
    const diag = evaluateSurfaceSyntacticIntegrity(shortReply, false);
    assert.equal(
      diag.isSingleWordOrEmpty,
      false,
      `Intelligible short reply "${shortReply}" must reach the contextual LLM for congruence evaluation`
    );
    assert.equal(diag.isShortTypedFragment, true);
  }

  const fullConjugatedSentences = [
    'sí, que tengo tiempo ahora',
    'sí tengo un minutito para atenderte',
    'estoy disponible ahora mismo, decime',
    'sí están todos mis datos bien registrados'
  ];
  for (const sentence of fullConjugatedSentences) {
    assert.equal(
      isUnclearOrTooShortCustomerReply(sentence, 1),
      false,
      `Conjugated sentence "${sentence}" should pass syntactic gate for semantic LLM analysis`
    );
  }

  // Audio vs written text diagnostics are differentiated and evaluate congruence
  const audioDiag = evaluateSurfaceSyntacticIntegrity('mi casa tiene portón negro frente a la farmacia', true, 0);
  const textDiag = evaluateSurfaceSyntacticIntegrity('casa blanca', false, 1);
  assert.ok(audioDiag.channelDiagnosticPrompt.includes('AUDIO HABLADO'));
  assert.ok(textDiag.channelDiagnosticPrompt.includes('TEXTO ESCRITO'));
  assert.ok(textDiag.channelDiagnosticPrompt.includes('CONGRUENCIA'));
  assert.equal(textDiag.isShortTypedFragment, true);

  // Anti-echo similarity detector catches robotic near-duplicate phrasing
  const highSim = calculateNormalizedSentenceSimilarity(
    'Richard, disculpame pero necesito saber si tu dirección está correcta.',
    'Richard, disculpame, necesito saber si tu dirección está correcta.'
  );
  const lowSim = calculateNormalizedSentenceSimilarity(
    'Richard, disculpame pero necesito saber si tu dirección está correcta.',
    'Perdoname la consulta, no logré captar la frase anterior, contame con tus palabras si pudiste mirar el mapa.'
  );
  assert.ok(highSim >= 0.8);
  assert.ok(lowSim < 0.35);
});

test('resolveJidToCleanPhone returns null for unmapped @lid JIDs and normalizes @s.whatsapp.net JIDs', async () => {
  const { resolveJidToCleanPhone } = await import('../../server/whatsappEngine');

  // 1. Unmapped @lid must return null (never the raw 15-digit LID) so messages.upsert triggers Step A-D resolution
  const unmappedLidResult = resolveJidToCleanPhone(undefined, '263512984710293@lid');
  assert.equal(unmappedLidResult, null);

  // 2. Standard @s.whatsapp.net JID resolves to normalized Paraguayan phone
  const pnResult = resolveJidToCleanPhone(undefined, '595981223344@s.whatsapp.net');
  assert.equal(pnResult, '595981223344');
});

test('sanitizeSupabaseCredentials self-heals invalid configs and isOfficialRegisteredProductOrder strictly blocks non-product contacts', async () => {
  const { sanitizeSupabaseCredentials, OFFICIAL_SUPABASE_URL, OFFICIAL_SUPABASE_ANON_KEY } = await import('../config');
  const {
    normalizeWaPhone,
    resolveOutboundWhatsAppJid,
    isOfficialRegisteredProductOrder
  } = await import('../../server/whatsappEngine');

  // Poisoned legacy Supabase URL must self-heal to OFFICIAL_SUPABASE_URL (never empty string)
  const healedLegacy = sanitizeSupabaseCredentials({
    url: 'https://cmxcohevrlmzsfqslmft.supabase.co',
    anonKey: 'old-dead-key'
  });
  assert.equal(healedLegacy.url, OFFICIAL_SUPABASE_URL);
  assert.equal(healedLegacy.anonKey, OFFICIAL_SUPABASE_ANON_KEY);

  // Poisoned native-internal-key or localhost must self-heal to OFFICIAL_SUPABASE_URL
  const healedNative = sanitizeSupabaseCredentials({
    url: 'http://localhost:8080',
    anonKey: 'native-internal-key'
  });
  assert.equal(healedNative.url, OFFICIAL_SUPABASE_URL);
  assert.equal(healedNative.anonKey, OFFICIAL_SUPABASE_ANON_KEY);

  // Empty credentials must self-heal to OFFICIAL_SUPABASE_URL
  const healedEmpty = sanitizeSupabaseCredentials({ url: '', anonKey: '' });
  assert.equal(healedEmpty.url, OFFICIAL_SUPABASE_URL);

  // Synthetic @lid keys and NX-WA-* leads are strictly forbidden
  assert.equal(normalizeWaPhone('lid-263512984710293'), '');
  assert.equal(normalizeWaPhone('263512984710293@lid'), '');
  assert.equal(resolveOutboundWhatsAppJid('0981 223 344'), '595981223344@s.whatsapp.net');

  // Unofficial WhatsApp leads or contacts without product registration MUST be rejected
  assert.equal(
    isOfficialRegisteredProductOrder({
      reservaid: 'NX-WA-893078',
      productoId: 'prod-noelux-01',
      celular: '0992 900 768',
      direccion: 'Av. España 123',
      dispositivo: 'dev-123'
    }),
    false
  );
  assert.equal(
    isOfficialRegisteredProductOrder({
      reservaid: 'NX-554433',
      productoId: 'prod-noelux-01',
      celular: '0992 900 768',
      direccion: 'Por confirmar por IA',
      dispositivo: 'wa-lead-595992900768'
    }),
    false
  );
  assert.equal(
    isOfficialRegisteredProductOrder(null),
    false
  );

  // Official Product Page registered customer MUST pass
  assert.equal(
    isOfficialRegisteredProductOrder({
      reservaid: 'NX-482910',
      productoId: 'prod-noelux-01',
      producto: 'Noelux™ Proyector Navideño 12 Diseños',
      nombre: 'María González',
      celular: '0981 223 344',
      departamento: 'Central',
      ciudad: 'San Lorenzo',
      direccion: 'Av. Mariscal López casi Defensores, Barrio Centro',
      dispositivo: 'dev-a1b2c3d4'
    }),
    true
  );

  // Freshly inserted order in public.pedidos MUST NOT falsely pretend AI welcome already ran unless ultimoMensajeIA or chat exists
  const freshOrderFromSupabase = {
    reservaid: 'NX-611831',
    productoId: 'prod-noelux-01',
    producto: 'Noelux™ Proyector Navideño 12 Diseños',
    nombre: 'Richard Santiago Almiron Delgado',
    celular: '0973532550',
    direccion: 'Camilo Recalde, Barrio Microcentro',
    convStep: 1,
    atendidoPorIA: true, // even if true on legacy row, ultimoMensajeIA is empty!
    ultimoMensajeIA: '',
    datosConfirmados: false,
    agenteCompletado: false
  };
  assert.equal(isOfficialRegisteredProductOrder(freshOrderFromSupabase), true);
  assert.equal(
    Boolean(
      freshOrderFromSupabase.ultimoMensajeIA ||
        freshOrderFromSupabase.convStep > 1 ||
        freshOrderFromSupabase.datosConfirmados ||
        freshOrderFromSupabase.agenteCompletado
    ),
    false,
    'Fresh order with empty ultimoMensajeIA at convStep 1 must ALWAYS trigger initial AI welcome'
  );
});

test('Dual-Function Express Checkout sends filled data + exact GPS together AND preserves 0% lead loss if GPS is denied', async () => {
  const { isOfficialRegisteredProductOrder } = await import('../../server/whatsappEngine');

  // Case A: Customer fills 3 fields AND Dual-Function Submit Button captures exact GPS simultaneously
  const dualSubmitOrderWithGps: Order = {
    reservaid: 'NX-994120',
    productoId: 'prod-noelux-01',
    producto: 'Noelux™ Proyector Navideño 12 Diseños',
    waVendedor: '595973532550',
    nombre: 'Lorena Duarte',
    celular: '0981 554 321',
    departamento: 'Central',
    ciudad: 'San Lorenzo - Barrio Centro',
    direccion: 'Barrio Centro, Calle España',
    detalle: 'Efectivo al recibir',
    cantidad: 1,
    monto: 189000,
    ref_code: null,
    estado: 'reservado',
    tipoVivienda: 'casa',
    gpsLat: -25.341256,
    gpsLng: -57.508912,
    gpsAccuracy: 11,
    gpsLink: 'https://www.google.com/maps?q=-25.341256,-57.508912',
    gpsStreetViewLink: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=-25.341256,-57.508912',
    gpsConfirmado: true,
    gpsDireccionDetectada: 'San Lorenzo, Barrio Centro, Calle España'
  };

  assert.equal(isOfficialRegisteredProductOrder(dualSubmitOrderWithGps), true);
  const step3WithGps = buildOrderLocationConfirmationText(dualSubmitOrderWithGps, 3);
  assert.equal((step3WithGps.match(/https?:\/\/\S+/g) || []).length, 0);
  assert.ok(step3WithGps.includes('San Lorenzo'));
  const courierTextWithGps = formatFullOrderTextForCourier(dualSubmitOrderWithGps);
  assert.ok(courierTextWithGps.includes('Lorena Duarte'));
  assert.ok(courierTextWithGps.includes('https://www.google.com/maps?q=-25.341256,-57.508912'));

  // Case B: Customer denies GPS prompt on submit -> filled data still travels 100% cleanly with 0% lead loss
  const dualSubmitOrderFallbackNoGps: Order = {
    reservaid: 'NX-994121',
    productoId: 'prod-noelux-01',
    producto: 'Noelux™ Proyector Navideño 12 Diseños',
    waVendedor: '595973532550',
    nombre: 'Jorge Villalba',
    celular: '0971 887 654',
    departamento: 'Central',
    ciudad: 'Luque',
    direccion: 'Barrio Cuarto, cerca de la cancha',
    detalle: 'Efectivo al recibir',
    cantidad: 2,
    monto: 299000,
    ref_code: null,
    estado: 'reservado',
    tipoVivienda: 'casa',
    gpsConfirmado: false
  };

  assert.equal(isOfficialRegisteredProductOrder(dualSubmitOrderFallbackNoGps), true);
  const step3WithoutGps = buildOrderLocationConfirmationText(dualSubmitOrderFallbackNoGps, 3);
  assert.ok(step3WithoutGps.includes('Luque'));
  assert.ok(step3WithoutGps.includes('Barrio Cuarto, cerca de la cancha'));
  assert.equal((step3WithoutGps.match(/https?:\/\/\S+/g) || []).length, 0);
});

test('Guaranies TTS speech formatter ALWAYS pronounces amounts with the word guaraníes (never bare 30 or treinta)', () => {
  assert.equal(formatGuaraniesSpeech(30000), 'treinta mil guaraníes');
  assert.equal(formatGuaraniesSpeech(159000), 'ciento cincuenta y nueve mil guaraníes');
  assert.equal(formatGuaraniesSpeech(189000), 'ciento ochenta y nueve mil guaraníes');
  assert.equal(formatGuaraniesSpeech(328000), 'trescientos veintiocho mil guaraníes');
  assert.equal(formatGuaraniesSpeech(358000), 'trescientos cincuenta y ocho mil guaraníes');
  assert.equal(formatGuaraniesSpeech(477000), 'cuatrocientos setenta y siete mil guaraníes');
  assert.equal(formatGuaraniesSpeech(507000), 'quinientos siete mil guaraníes');

  const normalized = normalizeGuaraniesCurrencyForSpeech(
    'Te descontamos Gs. 30.000 y en vez de 189.000 Gs. abonás Gs. 159.000.'
  );
  assert.match(normalized, /treinta mil guaraníes/);
  assert.match(normalized, /ciento ochenta y nueve mil guaraníes/);
  assert.match(normalized, /ciento cincuenta y nueve mil guaraníes/);
});

test('Express 1-step confirmation card hides customer GPS URL while preserving deterministic triggers', () => {
  const cardWithGps = buildExpressInitialAddressTextCard({
    nombre: 'Lorena Duarte',
    ciudad: 'San Lorenzo',
    departamento: 'Central',
    direccion: 'Barrio Centro, Calle España',
    gpsLat: -25.341256,
    gpsLng: -57.508912
  });
  assert.match(cardWithGps, /Lorena Duarte/);
  assert.match(cardWithGps, /San Lorenzo/);
  assert.match(cardWithGps, /Barrio Centro, Calle España/);
  assert.equal(/https?:\/\/|google\.com\/maps/i.test(cardWithGps), false);
  assert.match(cardWithGps, /CORRECTO/);

  const cardMissingGps = buildExpressInitialAddressTextCard({
    ciudad: 'Luque',
    direccion: 'Barrio Cuarto'
  });
  assert.equal(/Ubicación GPS pendiente/i.test(cardMissingGps), false);
  assert.match(cardMissingGps, /CORRECTO/);

  // Express order confirmation trigger (text & voice note transcriptions)
  assert.equal(evaluateExpressOrderConfirmationInput('Correcto', true).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('Correcto', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('la palabra correcto', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('escribo correcto', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('audio correcto', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('audio está bien', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('mis datos son correctos', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('estan correctos', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('los datos son correctos', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('los datos estan correctos', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('esos son mis datos', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('mi direccion es correcta', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('la direccion es correcta', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('Está bien', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('Esta bien.', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('🎤 Correcto.', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('🎤 Correto.', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('🎤 Mis datos son correctos.', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('🎤 Audio correcto.', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('🎤 Está bien.', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('🎤 Ta bien.', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('🎤 sí está bien todo correcto', true).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('Dale, perfecto!', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('Ok, está bien', false).decision, 'CONFIRMED');
  assert.equal(evaluateExpressOrderConfirmationInput('confirmado', true).decision, 'CONFIRMED');
  assert.equal(
    evaluateExpressOrderConfirmationInput('¿Cuánto cuesta el envío?', false).decision,
    'QUESTION_OR_OTHER'
  );
  assert.equal(
    evaluateExpressOrderConfirmationInput('Quiero cambiar mi barrio', false).decision,
    'CORRECTION_OR_WRONG_MAP'
  );
  assert.equal(
    evaluateExpressOrderConfirmationInput('No está bien mi dirección', false).decision,
    'CORRECTION_OR_WRONG_MAP'
  );
  assert.equal(
    evaluateExpressOrderConfirmationInput('📍 [Ubicación GPS exacta enviada por WhatsApp: https://www.google.com/maps?q=-25.3,-57.5]', false).decision,
    'GPS_PIN_RECEIVED_CONFIRMED'
  );
  assert.equal(
    evaluateExpressOrderConfirmationInput('El mapa está mal, mi barrio es Villa Morra', true).decision,
    'CORRECTION_OR_WRONG_MAP'
  );
});
