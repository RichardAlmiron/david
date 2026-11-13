import test from 'node:test';
import assert from 'node:assert/strict';
import { proto } from '@whiskeysockets/baileys';
import {
  buildInitialOrderAiMessage,
  buildConfirmationSuccessAudioText,
  IMAGE_AFTER_AUDIO_DELAY_MS,
  recordSentProtoMessage,
  lookupSentProtoMessage
} from '../whatsappEngine';
import {
  extractCustomerShippingSummaryForVisual,
  buildPackVisualDirective
} from '../waStageCommercialRenderer';

test('buildInitialOrderAiMessage announces the image BELOW and enforces 5s delay after audio', async () => {
  assert.equal(IMAGE_AFTER_AUDIO_DELAY_MS, 5000);

  const res = await buildInitialOrderAiMessage({
    reservaid: 'NX-TEST-001',
    nombre: 'María González',
    celular: '0981123456',
    producto: 'Noelux™ Proyector Navideño 12 Diseños',
    cantidad: 1,
    monto: 189000,
    ciudad: 'Asunción',
    direccion: 'Barrio Villa Morra'
  });

  assert.match(res.text, /Acá te voy a pasar la imagen abajo/i);
  assert.match(res.text, /Quiero que mires y me confirmes/i);
  assert.equal(/arriba/i.test(res.text), false, 'Initial audio greeting must NOT refer to the image as arriba');
  assert.match(res.text, /CORRECTO/);
  assert.match(res.text, /paquete de una unidad/i);
  assert.match(res.text, /ciento ochenta y nueve mil guaraníes/i);
});

test('Pack 2 and Pack 3 initial audio, confirmation audio, and visual summaries stay 100% congruent', async () => {
  const noeluxProduct = {
    id: 'prod-noelux-default',
    nombre: 'Noelux™ Proyector Navideño 12 Diseños',
    imagen: '/assets/real/galeria-1.jpg',
    precios: { 1: 189000, 2: 358000, 3: 507000 }
  };

  // Pack 2
  const order2 = {
    reservaid: 'NX-PACK2',
    nombre: 'Carlos Benítez',
    celular: '0982555111',
    producto: noeluxProduct.nombre,
    productoId: noeluxProduct.id,
    cantidad: 2,
    monto: 358000,
    ciudad: 'Luque',
    direccion: 'Centro'
  };
  const init2 = await buildInitialOrderAiMessage(order2);
  const conf2 = buildConfirmationSuccessAudioText(order2);
  const vis2 = extractCustomerShippingSummaryForVisual(order2, noeluxProduct);
  const dir2 = buildPackVisualDirective(vis2.packQty);

  assert.match(init2.text, /pack de dos unidades/i);
  assert.match(init2.text, /trescientos cincuenta y ocho mil guaraníes/i);
  assert.match(conf2, /pack de dos unidades/i);
  assert.match(conf2, /trescientos cincuenta y ocho mil guaraníes/i);
  assert.equal(vis2.packQty, 2);
  assert.equal(vis2.totalGsNum, 358000);
  assert.match(vis2.productImgRef, /noelux_pack2_double_bundle/i);
  assert.match(dir2.badgeText, /PACK 2 UNIDADES · 2X/);
  assert.match(dir2.visualCountPrompt, /EXACTLY TWO \(2\)/);

  // Pack 3
  const order3 = {
    reservaid: 'NX-PACK3',
    nombre: 'Lucía Ramírez',
    celular: '0991444222',
    producto: noeluxProduct.nombre,
    productoId: noeluxProduct.id,
    cantidad: 3,
    monto: 507000,
    ciudad: 'San Lorenzo',
    direccion: 'Barrio Barcequillo'
  };
  const init3 = await buildInitialOrderAiMessage(order3);
  const conf3 = buildConfirmationSuccessAudioText(order3);
  const vis3 = extractCustomerShippingSummaryForVisual(order3, noeluxProduct);
  const dir3 = buildPackVisualDirective(vis3.packQty);

  assert.match(init3.text, /pack de tres unidades/i);
  assert.match(init3.text, /quinientos siete mil guaraníes/i);
  assert.match(conf3, /pack de tres unidades/i);
  assert.match(conf3, /quinientos siete mil guaraníes/i);
  assert.equal(vis3.packQty, 3);
  assert.equal(vis3.totalGsNum, 507000);
  assert.match(vis3.productImgRef, /noelux_pack3_triple_bundle/i);
  assert.match(dir3.badgeText, /PACK 3 UNIDADES · 3X/);
  assert.match(dir3.visualCountPrompt, /EXACTLY THREE \(3\)/);
});

test('Custom Product Card prices (Pack 1/2/3) are respected even when order.monto is omitted', async () => {
  const customProduct = {
    id: 'prod-custom-prices',
    nombre: 'Noelux™ Proyector Navideño 12 Diseños',
    imagen: '/assets/real/galeria-1.jpg',
    precios: { 1: 215000, 2: 399000, 3: 549000 }
  };

  for (const [qty, expectedGs, expectedSpeech] of [
    [1, 215000, /doscientos quince mil guaraníes/i],
    [2, 399000, /trescientos noventa y nueve mil guaraníes/i],
    [3, 549000, /quinientos cuarenta y nueve mil guaraníes/i]
  ] as const) {
    const orderNoMonto = {
      reservaid: `NX-CUSTOM-${qty}`,
      nombre: 'Pedro Giménez',
      celular: '0983111222',
      producto: customProduct.nombre,
      productoId: customProduct.id,
      cantidad: qty,
      ciudad: 'Fernando de la Mora',
      direccion: 'Zona Norte'
    };
    const initAudio = await buildInitialOrderAiMessage(orderNoMonto, customProduct);
    const confirmAudio = buildConfirmationSuccessAudioText(orderNoMonto, customProduct);
    const visual = extractCustomerShippingSummaryForVisual(orderNoMonto, customProduct);

    assert.equal(visual.totalGsNum, expectedGs);
    assert.match(initAudio.text, expectedSpeech);
    assert.match(confirmAudio, expectedSpeech);
  }
});

test('recordSentProtoMessage and lookupSentProtoMessage round-trip audioMessage and conversation for retry getMessage', () => {
  const audioId = `TEST_AUDIO_${Date.now()}`;
  const audioProto = proto.Message.create({
    audioMessage: {
      ptt: true,
      mimetype: 'audio/ogg; codecs=opus',
      seconds: 12
    }
  });
  recordSentProtoMessage(audioId, audioProto);
  const lookedUpAudio = lookupSentProtoMessage(audioId);
  assert.ok(lookedUpAudio?.audioMessage, 'Expected cached audioMessage proto for retry lookup');
  assert.equal(lookedUpAudio.audioMessage.ptt, true);
  assert.equal(lookedUpAudio.audioMessage.seconds, 12);

  const textId = `TEST_TEXT_${Date.now()}`;
  const textProto = proto.Message.create({ conversation: 'Mensaje de prueba' });
  recordSentProtoMessage(textId, textProto);
  const lookedUpText = lookupSentProtoMessage(textId);
  assert.equal(lookedUpText?.conversation, 'Mensaje de prueba');
});
