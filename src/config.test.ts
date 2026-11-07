import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  formatWaPhone,
  resolveProductSellerWa,
  buildOrderWhatsAppUrl
} from './config';

test('DEFAULT_CONFIG has no default WhatsApp phone number', () => {
  assert.equal(DEFAULT_CONFIG.wa, '');
});

test('formatWaPhone normalizes Paraguayan numbers and returns empty string when blank', () => {
  assert.equal(formatWaPhone('0973 532 550'), '595973532550');
  assert.equal(formatWaPhone('595973532550'), '595973532550');
  assert.equal(formatWaPhone(''), '');
  assert.equal(formatWaPhone(null), '');
  assert.equal(formatWaPhone(undefined), '');
});

test('resolveProductSellerWa resolves each product specific seller WhatsApp number', () => {
  const products = [
    { id: 'prod-noelux-01', nombre: 'Noelux™ Proyector Navideño 12 Diseños', wa: '595973532550' },
    { id: 'prod-2', nombre: 'Otro Producto', wa: '0985112233' }
  ];

  assert.equal(
    resolveProductSellerWa({ id: 'prod-noelux-01' }, products),
    '595973532550'
  );
  assert.equal(
    resolveProductSellerWa({ id: 'prod-2' }, products),
    '595985112233'
  );
  assert.equal(resolveProductSellerWa({ id: 'unknown' }, []), '');
});

test('buildOrderWhatsAppUrl directs order to the exact product seller WhatsApp number', () => {
  const url = buildOrderWhatsAppUrl('595973532550', 'Reserva #NX-123456');
  assert.equal(url, 'https://wa.me/595973532550?text=Reserva%20%23NX-123456');
});

test('synthesizeCompleteLandingContent and buildAutoTrainedAgentBrain adapt copy to freeShipping true vs false', async () => {
  const { SUBNICHE_TEMPLATES, synthesizeCompleteLandingContent, buildAutoTrainedAgentBrain } = await import('./data/productTemplatesCatalog');
  const tpl = SUBNICHE_TEMPLATES[0];

  const freeLanding = synthesizeCompleteLandingContent({
    productName: 'Smartwatch Series 9',
    productDescription: 'Reloj inteligente con llamadas',
    mainImage: tpl.previewImage,
    prices: { 1: 189000, 2: 349000, 3: 489000 },
    normalPrice: 250000,
    physicalTruth: tpl.defaultPhysicalTruth,
    template: tpl,
    freeShipping: true
  });
  assert.ok(freeLanding.topBarText.includes('ENVÍO GRATIS'));

  const paidShippingLanding = synthesizeCompleteLandingContent({
    productName: 'Smartwatch Series 9',
    productDescription: 'Reloj inteligente con llamadas',
    mainImage: tpl.previewImage,
    prices: { 1: 189000, 2: 349000, 3: 489000 },
    normalPrice: 250000,
    physicalTruth: tpl.defaultPhysicalTruth,
    template: tpl,
    freeShipping: false,
    shippingCostGs: 25000
  });
  assert.ok(paidShippingLanding.topBarText.includes('ENTREGA RÁPIDA'));

  const brainPaid = buildAutoTrainedAgentBrain({
    productName: 'Smartwatch Series 9',
    productDescription: 'Reloj inteligente con llamadas',
    prices: { 1: 189000, 2: 349000, 3: 489000 },
    physicalTruth: tpl.defaultPhysicalTruth,
    template: tpl,
    freeShipping: false,
    shippingCostGs: 25000
  });
  assert.ok(brainPaid.contextoIA.includes('ENVÍO CON COSTO DE DELIVERY'));
});

