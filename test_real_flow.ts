import {
  buildInitialOrderAiMessage,
  generateSmartAiReply,
  synthesizeSpeechSelfHosted,
  appendChatMessage,
  detectCustomerGender,
  isCustomerPostConfirmBlocked
} from './server/whatsappEngine.ts';
import fs from 'fs';

async function testFullFlow() {
  console.log('==================================================');
  console.log('INICIANDO PRUEBA REAL EN TIEMPO REAL DEL FLUJO COMPLETO');
  console.log('==================================================\n');

  // 0. Probar Detección de Género (Femenino / Masculino) por el nombre
  console.log('--- PROBANDO DETECCIÓN DE GÉNERO POR NOMBRE ---');
  const gMaria = detectCustomerGender('María González');
  const gCarmen = detectCustomerGender('Carmen Villalba');
  const gCarlos = detectCustomerGender('Carlos Benítez');
  const gMatias = detectCustomerGender('Matías López');
  console.log('María González ->', gMaria.gender, '| trato:', gMaria.cortesia, '/', gMaria.estimado);
  console.log('Carmen Villalba ->', gCarmen.gender, '| trato:', gCarmen.cortesia, '/', gCarmen.estimado);
  console.log('Carlos Benítez ->', gCarlos.gender, '| trato:', gCarlos.cortesia, '/', gCarlos.estimado);
  console.log('Matías López ->', gMatias.gender, '| trato:', gMatias.cortesia, '/', gMatias.estimado);
  if (
    gMaria.gender !== 'femenino' ||
    gCarmen.gender !== 'femenino' ||
    gCarlos.gender !== 'masculino' ||
    gMatias.gender !== 'masculino'
  ) {
    throw new Error('Fallo en detección de género por nombre');
  }

  // 1. Simular Pedido Web (Probamos con una clienta mujer: María González para verificar trato femenino)
  const testPhone = '595986260211';
  const order = {
    reservaid: 'TEST-' + Date.now(),
    nombre: 'María González',
    celular: testPhone,
    ciudad: 'Asunción',
    departamento: 'Central',
    direccion: 'Avda. Mariscal López 1234',
    producto: 'Noelux™ Proyector Navideño 12 Diseños',
    cantidad: 1,
    monto: 189000,
    convStep: 1,
    modoIA: 'automatico'
  };

  // Limpiar historial de chat previo para iniciar la prueba desde cero exactamente como en producción
  if (fs.existsSync('wa_chats.json')) {
    const waChats = JSON.parse(fs.readFileSync('wa_chats.json', 'utf8') || '{}');
    if (waChats.chats) waChats.chats[testPhone] = [];
    if (waChats.convSteps) waChats.convSteps[testPhone] = 1;
    if (waChats.postConfirmStrikes) delete waChats.postConfirmStrikes[testPhone];
    if (waChats.postConfirmBlocked) delete waChats.postConfirmBlocked[testPhone];
    fs.writeFileSync('wa_chats.json', JSON.stringify(waChats, null, 2));
  }

  // Guardar en pedidos.json temporalmente para la prueba
  const pedidos = JSON.parse(fs.readFileSync('pedidos.json', 'utf8') || '[]');
  pedidos.unshift(order);
  fs.writeFileSync('pedidos.json', JSON.stringify(pedidos, null, 2));

  try {
    // PASO 1: Saludo Inicial
    console.log('\n--- PROBANDO PASO 1 (SALUDO INICIAL) ---');
    const initRes = await buildInitialOrderAiMessage(order);
    console.log('Texto generado Paso 1:', initRes.text);
    if (!initRes.text) throw new Error('Paso 1 no generó texto');

    appendChatMessage(testPhone, {
      sender: 'ai',
      senderName: '🎤 Agente IA',
      text: initRes.text,
      status: 'sent',
      orderId: order.reservaid,
      convStep: 1
    });

    console.log('Sintetizando audio Paso 1 con Deepgram Aura-2...');
    const tts1 = await synthesizeSpeechSelfHosted(initRes.text, 'deepgram-celeste');
    console.log('Audio Paso 1 generado exitosamente. Bytes:', tts1.audioBuffer?.length);
    if (!tts1.audioBuffer || tts1.audioBuffer.length < 1000) throw new Error('Fallo síntesis TTS Paso 1');

    // PASO 2: Cliente responde 'Sí, tengo tiempo'
    console.log('\n--- PROBANDO PASO 2 (CLIENTA: "Sí, tengo tiempo") ---');
    appendChatMessage(testPhone, {
      sender: 'client',
      senderName: order.nombre,
      text: 'Sí, tengo tiempo',
      status: 'delivered',
      orderId: order.reservaid
    });

    const step2Res = await generateSmartAiReply(testPhone, 'Sí, tengo tiempo');
    console.log('IA Respuesta Paso 2:', step2Res.reply);
    console.log('Paso actual:', step2Res.convStep);
    if (!step2Res.reply || step2Res.convStep !== 2) throw new Error('Paso 2 no avanzó correctamente');

    appendChatMessage(testPhone, {
      sender: 'ai',
      senderName: '🎤 Agente IA',
      text: step2Res.reply,
      status: 'sent',
      orderId: order.reservaid,
      convStep: 2
    });

    // PASO 3: Clienta responde 'Sí, mi nombre y teléfono están bien'
    console.log('\n--- PROBANDO PASO 3 (CLIENTA: "Sí, mis datos están bien") ---');
    appendChatMessage(testPhone, {
      sender: 'client',
      senderName: order.nombre,
      text: 'Sí, mi nombre y teléfono están perfectos',
      status: 'delivered',
      orderId: order.reservaid
    });

    const step3Res = await generateSmartAiReply(testPhone, 'Sí, mi nombre y teléfono están perfectos');
    console.log('IA Respuesta Paso 3 (Audio):', step3Res.reply);
    console.log('IA Texto de Ubicación Paso 3:', step3Res.locationTextConfirmation);
    console.log('Paso actual:', step3Res.convStep);
    if (!step3Res.reply || step3Res.convStep !== 3) throw new Error('Paso 3 no avanzó correctamente');

    appendChatMessage(testPhone, {
      sender: 'ai',
      senderName: '🎤 Agente IA',
      text: step3Res.reply,
      status: 'sent',
      orderId: order.reservaid,
      convStep: 3
    });

    // PASO 4: Clienta confirma ubicación
    console.log('\n--- PROBANDO PASO 4 (CLIENTA: "Sí, esa es mi dirección") ---');
    appendChatMessage(testPhone, {
      sender: 'client',
      senderName: order.nombre,
      text: 'Sí, esa es mi dirección en Asunción, está todo bien anotado',
      status: 'delivered',
      orderId: order.reservaid
    });

    const step4Res = await generateSmartAiReply(testPhone, 'Sí, esa es mi dirección en Asunción, está todo bien anotado');
    console.log('IA Respuesta Paso 4 (Audio):', step4Res.reply);
    console.log('Paso actual:', step4Res.convStep);
    if (!step4Res.reply || step4Res.convStep !== 4) throw new Error('Paso 4 no avanzó correctamente');

    appendChatMessage(testPhone, {
      sender: 'ai',
      senderName: '🎤 Agente IA',
      text: step4Res.reply,
      status: 'sent',
      orderId: order.reservaid,
      convStep: 4
    });

    // PASO 5: Clienta da referencia de la casa
    console.log('\n--- PROBANDO PASO 5 (CLIENTA: "Es una casa blanca con portón negro al lado de la farmacia") ---');
    appendChatMessage(testPhone, {
      sender: 'client',
      senderName: order.nombre,
      text: 'Es una casa blanca con portón negro al lado de la farmacia San Roque',
      status: 'delivered',
      orderId: order.reservaid
    });

    const step5Res = await generateSmartAiReply(testPhone, 'Es una casa blanca con portón negro al lado de la farmacia San Roque');
    console.log('IA Respuesta Paso 5 (Cierre):', step5Res.reply);
    console.log('Texto Confirmación Final:\n' + step5Res.locationTextConfirmation);
    console.log('Paso actual:', step5Res.convStep);
    console.log('Pedido Confirmado?:', step5Res.matchedOrder?.datosConfirmados);
    console.log('Empaquetado?:', step5Res.matchedOrder?.empaquetado);

    if (step5Res.convStep !== 5 || !step5Res.matchedOrder?.datosConfirmados) {
      throw new Error('Paso 5 no completó la confirmación del pedido');
    }

    appendChatMessage(testPhone, {
      sender: 'ai',
      senderName: '🎤 Agente IA',
      text: step5Res.reply,
      status: 'sent',
      orderId: order.reservaid,
      convStep: 5
    });

    // =========================================================================
    // PRUEBA DEL FLUJO POST-CONFIRMACIÓN AMABLE Y DULCE + PAUSA SILENCIOSA DE CRÉDITOS
    // =========================================================================

    // TURNO 1 POST-CONFIRMACIÓN: Clienta quiere agregar otro proyector o pide soporte -> Respuesta dulce + Tarjeta con teléfono en el 1er mensaje
    console.log('\n--- PROBANDO POST-CONFIRMACIÓN TURNO 1 (CLIENTA PIDE AGREGAR UNIDAD / SOPORTE) ---');
    const msgPost1 = 'Hola, ¿será que puedo agregar un proyector más a mi pedido o a qué número llamo?';
    appendChatMessage(testPhone, {
      sender: 'client',
      senderName: order.nombre,
      text: msgPost1,
      status: 'delivered',
      orderId: order.reservaid
    });
    const postRes1 = await generateSmartAiReply(testPhone, msgPost1);
    console.log('IA Respuesta Post-Confirmación (Turno 1 - Dulce y con número):', postRes1.reply);
    console.log('Tarjeta de Contacto enviada inmediatamente en el Turno 1:\n' + postRes1.locationTextConfirmation);
    if (!postRes1.reply || !postRes1.locationTextConfirmation || postRes1.matchedOrder?.cantidad !== 1) {
      throw new Error('Fallo en Turno 1 post-confirmación o no adjuntó la tarjeta con el teléfono de soporte');
    }
    appendChatMessage(testPhone, {
      sender: 'ai',
      senderName: '🎤 Agente IA',
      text: postRes1.reply,
      status: 'sent',
      orderId: order.reservaid,
      convStep: 5
    });

    // TURNO 2 POST-CONFIRMACIÓN: Clienta comenta algo fuera de tema -> Esquiva con simpatía y amabilidad (CERO regaños ni advertencias)
    console.log('\n--- PROBANDO POST-CONFIRMACIÓN TURNO 2 (ESQUIVA AMABLE SIN ADVERTENCIAS) ---');
    const msgPost2 = 'Jaja qué calor hace hoy en Asunción, ¿qué tal está el clima por ahí?';
    appendChatMessage(testPhone, {
      sender: 'client',
      senderName: order.nombre,
      text: msgPost2,
      status: 'delivered',
      orderId: order.reservaid
    });
    const postRes2 = await generateSmartAiReply(testPhone, msgPost2);
    console.log('IA Respuesta Post-Confirmación (Turno 2 - Simpática, sin advertencias):', postRes2.reply);
    if (!postRes2.reply || /segunda vez|cerrar nuestro chat|no te voy a responder/i.test(postRes2.reply)) {
      throw new Error('El agente dio una advertencia brusca en lugar de responder con dulzura');
    }
    appendChatMessage(testPhone, {
      sender: 'ai',
      senderName: '🎤 Agente IA',
      text: postRes2.reply,
      status: 'sent',
      orderId: order.reservaid,
      convStep: 5
    });

    // TURNO 3 POST-CONFIRMACIÓN: Clienta dice "Dale muchas gracias" -> Despedida cariñosa + Pausa silenciosa automática
    console.log('\n--- PROBANDO POST-CONFIRMACIÓN TURNO 3 (DESPEDIDA CARIÑOSA + PAUSA SILENCIOSA) ---');
    const msgPost3 = 'Dale muchas gracias';
    appendChatMessage(testPhone, {
      sender: 'client',
      senderName: order.nombre,
      text: msgPost3,
      status: 'delivered',
      orderId: order.reservaid
    });
    const postRes3 = await generateSmartAiReply(testPhone, msgPost3);
    console.log('IA Respuesta Post-Confirmación (Turno 3 - Despedida cariñosa):', postRes3.reply);
    console.log('Pausa silenciosa activada tras despedida?:', postRes3.matchedOrder?.postConfirmBlocked);
    if (!postRes3.reply || !postRes3.matchedOrder?.postConfirmBlocked) {
      throw new Error('Fallo en despedida natural o pausa silenciosa post-confirmación');
    }

    // TURNO 4 POST-CONFIRMACIÓN: Si alguien sigue enviando mensajes después de despedirse -> Silencio protector de créditos
    console.log('\n--- PROBANDO PROTECCIÓN SILENCIOSA DE CRÉDITOS (0 CRÉDITOS GASTADOS) ---');
    const postRes4 = await generateSmartAiReply(testPhone, 'Mensaje extra');
    console.log('IA Respuesta tras pausa silenciosa (debe ser vacía ""):', JSON.stringify(postRes4.reply));
    console.log('isCustomerPostConfirmBlocked?:', isCustomerPostConfirmBlocked(testPhone));
    if (postRes4.reply !== '' || !isCustomerPostConfirmBlocked(testPhone)) {
      throw new Error('El sistema no activó la pausa silenciosa para proteger créditos');
    }

    console.log('\n==================================================');
    console.log('✅ PRUEBA CONTUNDENTEMENTE CONFIRMADA Y EXITOSA: TRATO DULCE + TARJETA INMEDIATA + PROTECCIÓN SILENCIOSA DE CRÉDITOS');
    console.log('==================================================');
    process.exit(0);
  } finally {
    // Limpiar pedido de prueba y estado de wa_chats.json
    const updated = JSON.parse(fs.readFileSync('pedidos.json', 'utf8') || '[]').filter((p: any) => p.reservaid !== order.reservaid);
    fs.writeFileSync('pedidos.json', JSON.stringify(updated, null, 2));
    if (fs.existsSync('wa_chats.json')) {
      const waChats = JSON.parse(fs.readFileSync('wa_chats.json', 'utf8') || '{}');
      if (waChats.chats) delete waChats.chats[testPhone];
      if (waChats.convSteps) delete waChats.convSteps[testPhone];
      if (waChats.postConfirmStrikes) delete waChats.postConfirmStrikes[testPhone];
      if (waChats.postConfirmBlocked) delete waChats.postConfirmBlocked[testPhone];
      fs.writeFileSync('wa_chats.json', JSON.stringify(waChats, null, 2));
    }
  }
}

testFullFlow().catch(e => {
  console.error('\n❌ ERROR EN LA PRUEBA:', e);
  process.exit(1);
});
