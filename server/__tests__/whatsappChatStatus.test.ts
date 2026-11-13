import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRST_FOLLOW_UP_DELAY_MS,
  HOURLY_FOLLOW_UP_DELAY_MS,
  buildWhatsAppChatStageAndTimerSnapshot,
  formatElapsedEs,
  formatRemainingEs,
  isMessageFollowUpReminder
} from '../../src/utils/whatsappChatStatus';
import {
  scheduleCustomerInactivityFollowUp,
  cancelCustomerInactivityFollowUp,
  getCustomerFollowUpStatus,
  getChatHistory
} from '../whatsappEngine';

test('formatElapsedEs and formatRemainingEs render natural Spanish singular/plural intervals', () => {
  assert.equal(formatElapsedEs(3_000), 'unos segundos');
  assert.equal(formatElapsedEs(61_000), '1 minuto');
  assert.equal(formatElapsedEs(125_000), '2 minutos');
  assert.equal(formatElapsedEs(3_900_000), '1 hora y 5 minutos');
  assert.equal(formatElapsedEs(7_200_000), '2 horas');

  const remUnderMin = formatRemainingEs(42_000);
  assert.equal(remUnderMin.verb, 'Faltan');
  assert.equal(remUnderMin.phrase, '42 segundos');

  const remOneHour = formatRemainingEs(3_600_000);
  assert.equal(remOneHour.verb, 'Falta');
  assert.equal(remOneHour.phrase, '1 hora');

  const remMixed = formatRemainingEs(3 * 60_000 + 25_000);
  assert.equal(remMixed.verb, 'Faltan');
  assert.equal(remMixed.phrase, '3 minutos y 25 segundos');
});

test('Stage 0 unstarted state when no messages or AI timestamp exist', () => {
  const snap = buildWhatsAppChatStageAndTimerSnapshot({
    order: { datosConfirmados: false, convStep: 1 },
    messages: [],
    mode: 'automatico',
    channel: 'audio',
    nowMs: 1_700_000_000_000
  });

  assert.equal(snap.stage, 'stage_0_unstarted');
  assert.equal(snap.stageStepLabel, 'Etapa 1/2');
  assert.equal(snap.lastOutgoingMsg, null);
  assert.equal(snap.timerBanner.status, 'unstarted');
  assert.match(snap.timerBanner.descriptiveText, /5 minutos/);
});

test('Stage 1 waiting CORRECTO after audio+image with active 5-min backend timer', () => {
  const nowMs = 1_700_000_300_000;
  const twoMinsAgoIso = new Date(nowMs - 2 * 60_000).toISOString();
  const nextFireAtMs = nowMs + 3 * 60_000;

  const snap = buildWhatsAppChatStageAndTimerSnapshot({
    order: { datosConfirmados: false, convStep: 2 },
    messages: [
      {
        id: 'm1',
        sender: 'ai',
        senderName: '🎤 Estrella · Nota de Voz (Etapa 1/2)',
        text: 'Hola Elizabeth! Acá te voy a pasar la imagen abajo para que confirmes con CORRECTO.',
        timestamp: twoMinsAgoIso,
        isAudioNote: true,
        agentChannel: 'audio',
        convStep: 2
      },
      {
        id: 'm2',
        sender: 'ai',
        senderName: '🖼️ Imagen Comercial',
        text: 'Confirmá tu envío con la palabra CORRECTO.',
        timestamp: twoMinsAgoIso,
        imageUrl: 'data:image/png;base64,AAA',
        commercialStage: 'stage1_welcome',
        convStep: 2
      }
    ],
    mode: 'automatico',
    channel: 'audio',
    convStep: 2,
    followUpStatus: {
      hasActiveTimer: true,
      attemptNumber: 1,
      scheduledAtMs: nowMs - 2 * 60_000,
      nextFireAtMs,
      delayMs: FIRST_FOLLOW_UP_DELAY_MS
    },
    nowMs
  });

  assert.equal(snap.stage, 'stage_1_waiting_correcto');
  assert.equal(snap.lastOutgoingMsg?.kindBadge, 'Saludo + Imagen 1/2');
  assert.equal(snap.lastOutgoingMsg?.channelBadge, '🎤 Audio + 🖼️ Imagen');
  assert.equal(snap.lastOutgoingMsg?.elapsedLabel, '2 minutos');
  assert.equal(snap.timerBanner.status, 'counting');
  assert.equal(snap.timerBanner.countdownBadge, 'Faltan 3m 00s');
  assert.match(snap.timerBanner.descriptiveText, /Hace 2 minutos se ha enviado/);
  assert.match(snap.timerBanner.descriptiveText, /Faltan 3 minutos para volver a enviarle un audio más/);
});

test('Stage 1 after inactivity follow-up reminder shows busy summary & hourly countdown', () => {
  const nowMs = 1_700_005_000_000;
  const sent18MinsAgoIso = new Date(nowMs - 18 * 60_000).toISOString();
  const nextFireAtMs = nowMs + 42 * 60_000;

  const snap = buildWhatsAppChatStageAndTimerSnapshot({
    order: { datosConfirmados: false, convStep: 2 },
    messages: [
      {
        id: 'm1',
        sender: 'ai',
        senderName: '🎤 Estrella · Nota de Voz (Etapa 1/2)',
        text: 'Hola! Saludo inicial.',
        timestamp: new Date(nowMs - 70 * 60_000).toISOString(),
        isAudioNote: true,
        convStep: 2
      },
      {
        id: 'm2',
        sender: 'ai',
        senderName: '🎤 Estrella · Nota de Voz (Etapa 1/2)',
        text: 'Hola Fabiola, si estás ocupada ahora no hay problema, apenas tengas un tiempo escribinos CORRECTO para despachar tu paquete.',
        timestamp: sent18MinsAgoIso,
        isAudioNote: true,
        isFollowUpReminder: true,
        followUpAttemptNumber: 1,
        convStep: 2
      }
    ],
    mode: 'automatico',
    channel: 'audio',
    convStep: 2,
    followUpStatus: {
      hasActiveTimer: true,
      attemptNumber: 2,
      scheduledAtMs: nowMs - 18 * 60_000,
      nextFireAtMs,
      delayMs: HOURLY_FOLLOW_UP_DELAY_MS
    },
    nowMs
  });

  assert.equal(snap.followUpCountSinceClient, 1);
  assert.equal(snap.lastOutgoingMsg?.isReminder, true);
  assert.equal(snap.lastOutgoingMsg?.kindBadge, 'Recordatorio #1');
  assert.equal(snap.timerBanner.status, 'counting');
  assert.match(snap.timerBanner.descriptiveText, /Hace 18 minutos se ha enviado un mensaje más recordándole que si está ocupado\/a puede responder CORRECTO/);
  assert.match(snap.timerBanner.descriptiveText, /Faltan 42 minutos para volver a enviarle un audio más/);
});

test('Heuristic recognizes legacy persisted busy reminders even without explicit flag', () => {
  assert.equal(
    isMessageFollowUpReminder({
      sender: 'ai',
      text: 'Te recuerdo que si estás ocupado ahora, podés responder cuando puedas.',
      convStep: 2
    }),
    true
  );
  assert.equal(
    isMessageFollowUpReminder({
      sender: 'ai',
      text: '¡Pedido confirmado con éxito! Muchas gracias.',
      convStep: 5
    }),
    false
  );
});

test('Manual mode pauses automatic countdown honestly and Stage 2 marks cycle completed', () => {
  const nowMs = 1_700_000_600_000;
  const tenMinsAgo = new Date(nowMs - 10 * 60_000).toISOString();

  const manualSnap = buildWhatsAppChatStageAndTimerSnapshot({
    order: { datosConfirmados: false, convStep: 2 },
    messages: [
      {
        id: 'm1',
        sender: 'ai',
        text: 'Hola Luis! Confirmame con CORRECTO.',
        timestamp: tenMinsAgo,
        isAudioNote: true,
        convStep: 2
      }
    ],
    mode: 'manual',
    channel: 'texto',
    convStep: 2,
    followUpStatus: {
      hasActiveTimer: false,
      attemptNumber: null,
      scheduledAtMs: null,
      nextFireAtMs: null,
      delayMs: null
    },
    nowMs
  });

  assert.equal(manualSnap.timerBanner.status, 'paused_manual');
  assert.match(manualSnap.timerBanner.descriptiveText, /pausado/);

  const stage2Snap = buildWhatsAppChatStageAndTimerSnapshot({
    order: { datosConfirmados: true, convStep: 5 },
    messages: [
      {
        id: 'm3',
        sender: 'ai',
        text: '¡Muchísimas gracias por tu compra! Tu pedido quedó confirmado.',
        timestamp: tenMinsAgo,
        convStep: 5
      }
    ],
    mode: 'automatico',
    channel: 'audio',
    convStep: 5,
    nowMs
  });

  assert.equal(stage2Snap.stage, 'stage_2_confirmed');
  assert.equal(stage2Snap.stageStepLabel, 'Etapa 2/2');
  assert.equal(stage2Snap.timerBanner.status, 'confirmed');
});

test('Explicit server hasActiveTimer=false renders honest inactive_server state instead of fake countdown', () => {
  const nowMs = 1_700_001_000_000;
  const snap = buildWhatsAppChatStageAndTimerSnapshot({
    order: { datosConfirmados: false, convStep: 2 },
    messages: [
      {
        id: 'm1',
        sender: 'ai',
        text: 'Hola! Confirmá con CORRECTO.',
        timestamp: new Date(nowMs - 15 * 60_000).toISOString(),
        isAudioNote: true,
        convStep: 2
      }
    ],
    mode: 'automatico',
    channel: 'audio',
    convStep: 2,
    followUpStatus: {
      hasActiveTimer: false,
      attemptNumber: null,
      scheduledAtMs: null,
      nextFireAtMs: null,
      delayMs: null
    },
    nowMs
  });

  assert.equal(snap.timerBanner.status, 'inactive_server');
  assert.match(snap.timerBanner.descriptiveText, /No hay un temporizador activo/);
});

test('whatsappEngine scheduleCustomerInactivityFollowUp exposes real followUpStatus in getChatHistory & clears on cancel', () => {
  const testPhone = '595999000123';
  try {
    scheduleCustomerInactivityFollowUp(testPhone, 'NX-TIMER-TEST', undefined, 1);
    const status1 = getCustomerFollowUpStatus(testPhone);
    assert.equal(status1.hasActiveTimer, true);
    assert.equal(status1.attemptNumber, 1);
    assert.equal(status1.delayMs, FIRST_FOLLOW_UP_DELAY_MS);
    assert.ok((status1.nextFireAtMs || 0) > Date.now() + 250_000);

    const hist = getChatHistory(testPhone);
    assert.equal(hist.followUpStatus.hasActiveTimer, true);
    assert.equal(hist.followUpStatus.attemptNumber, 1);

    scheduleCustomerInactivityFollowUp(testPhone, 'NX-TIMER-TEST', undefined, 2);
    const status2 = getCustomerFollowUpStatus(testPhone);
    assert.equal(status2.attemptNumber, 2);
    assert.equal(status2.delayMs, HOURLY_FOLLOW_UP_DELAY_MS);
  } finally {
    cancelCustomerInactivityFollowUp(testPhone);
  }

  const cleared = getCustomerFollowUpStatus(testPhone);
  assert.equal(cleared.hasActiveTimer, false);
  assert.equal(cleared.nextFireAtMs, null);
});
