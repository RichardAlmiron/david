import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialOrderAiMessage, IMAGE_AFTER_AUDIO_DELAY_MS } from '../whatsappEngine';

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
});
