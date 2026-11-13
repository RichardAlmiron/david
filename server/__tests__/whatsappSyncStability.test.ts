import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DISABLE_WA_AUTOCONNECT = 'true';

test('evaluateProductionRuntime blocks preview, local Windows, and unconfigured containers while allowing Railway production', async () => {
  const { evaluateProductionRuntime, getDeploymentServiceScope, isSameDeploymentServiceLock } = await import(
    '../whatsappEngine'
  );

  // Railway production container -> allowed
  const prodEnv: NodeJS.ProcessEnv = {
    RAILWAY_ENVIRONMENT_NAME: 'production',
    RAILWAY_SERVICE_ID: 'svc-prod-1',
    RAILWAY_PUBLIC_DOMAIN: 'autoads360.up.railway.app'
  };
  assert.equal(evaluateProductionRuntime(prodEnv, 'linux', true), true);

  // PR preview / staging / local dev / unconfigured Linux without OpenRouter -> blocked from hijacking WALOCK-leader
  assert.equal(
    evaluateProductionRuntime({ RAILWAY_ENVIRONMENT_NAME: 'pr-1', RAILWAY_SERVICE_ID: 'svc-pr-1' }, 'linux', false),
    false
  );
  assert.equal(
    evaluateProductionRuntime({ RAILWAY_ENVIRONMENT_NAME: 'staging', RAILWAY_SERVICE_ID: 'svc-stg' }, 'linux', true),
    false
  );
  assert.equal(evaluateProductionRuntime({}, 'win32', true), false);
  assert.equal(evaluateProductionRuntime({ PORT: '8080', NODE_ENV: 'production' }, 'linux', false), false);
  assert.equal(evaluateProductionRuntime({ ...prodEnv, DISABLE_WA_AUTOCONNECT: 'true' }, 'linux', true), false);

  // Explicit service-scope lock check stops stray or unscoped instances from yielding production
  const prodScope = getDeploymentServiceScope(prodEnv);
  assert.equal(isSameDeploymentServiceLock({ leaderId: 'inst-2', bootEpoch: 2, serviceScope: prodScope }, prodScope), true);
  assert.equal(isSameDeploymentServiceLock({ leaderId: 'inst-rogue', bootEpoch: 999 }, prodScope), false);
  assert.equal(
    isSameDeploymentServiceLock({ leaderId: 'inst-other', bootEpoch: 999, serviceScope: 'svc-other|other.app|staging' }, prodScope),
    false
  );
});

test('collapseStackedOfflineAiMessages prevents replaying multiple queued hourly follow-up audios on reconnect', async () => {
  const { collapseStackedOfflineAiMessages } = await import('../whatsappEngine');

  // Case A: Client already got greeting ('sent'), then 5 hourly followups failed offline -> only latest followup remains
  const resWithPriorSent = collapseStackedOfflineAiMessages([
    { id: 'w1', phone: '595982931098', sender: 'ai', text: 'Saludo', timestamp: '2026-11-13T02:52:24Z', status: 'sent', isAudioNote: true },
    { id: 'f1', phone: '595982931098', sender: 'ai', text: '3 horas', timestamp: '2026-11-13T05:57:58Z', status: 'pending_connection', isAudioNote: true },
    { id: 'f2', phone: '595982931098', sender: 'ai', text: '4 horas', timestamp: '2026-11-13T06:58:08Z', status: 'pending_connection', isAudioNote: true },
    { id: 'f3', phone: '595982931098', sender: 'ai', text: '7 horas', timestamp: '2026-11-13T09:58:29Z', status: 'pending_connection', isAudioNote: true }
  ]);
  assert.equal(resWithPriorSent.changed, true);
  assert.deepEqual(resWithPriorSent.nextMessages.map(m => m.id), ['w1', 'f3']);

  // Case B: Client never got greeting yet, 1 welcome + 1 reminder queued offline -> only initial welcome remains
  const resNoPriorSent = collapseStackedOfflineAiMessages([
    { id: 'w0', phone: '595982013967', sender: 'ai', text: 'Bienvenida', timestamp: '2026-11-13T10:39:01Z', status: 'pending_connection', isAudioNote: true },
    { id: 'r1', phone: '595982013967', sender: 'ai', text: 'Recordatorio', timestamp: '2026-11-13T10:44:12Z', status: 'pending_connection', isAudioNote: true },
    { id: 't1', phone: '595982013967', sender: 'ai', text: 'Tarjeta GPS', timestamp: '2026-11-13T10:39:02Z', status: 'pending_connection', isAudioNote: false }
  ]);
  assert.equal(resNoPriorSent.changed, true);
  assert.deepEqual(resNoPriorSent.nextMessages.map(m => m.id), ['w0', 't1']);
});

test('hasConversationAlreadyStarted and getLatestUnansweredClientMessage block restarting from step 1 on progressed chats', async () => {
  const { hasConversationAlreadyStarted, getLatestUnansweredClientMessage } = await import('../whatsappEngine');

  const progressedOrder = {
    reservaid: 'NX-955908',
    convStep: 3,
    datosConfirmados: false,
    ultimoMensajeIA: 'Hola Fabiola',
    fecha: '2026-11-13T02:52:00Z'
  };
  assert.equal(hasConversationAlreadyStarted('595982931098', progressedOrder, []), true);

  // Admin message last -> no unanswered client message, must NOT trigger unsolicited AI message
  const adminLastHistory = [
    { id: 'm1', phone: '595982931098', sender: 'ai' as const, text: 'Paso 3', timestamp: '2026-11-13T02:52:24Z', status: 'sent' as const },
    { id: 'm2', phone: '595982931098', sender: 'client' as const, text: 'Sí, correcto', timestamp: '2026-11-13T03:00:00Z', status: 'delivered' as const },
    { id: 'm3', phone: '595982931098', sender: 'admin' as const, text: 'Te confirmo!', timestamp: '2026-11-13T03:01:00Z', status: 'sent' as const }
  ];
  assert.equal(getLatestUnansweredClientMessage(adminLastHistory), null);

  // Client message last -> returns that exact client message for contextual reply
  const clientLastHistory = adminLastHistory.slice(0, 2);
  assert.equal(getLatestUnansweredClientMessage(clientLastHistory)?.id, 'm2');

  // Brand-new order on same phone after an older completed order should allow starting once
  const brandNewOrder = {
    reservaid: 'NX-NEW-1',
    convStep: 1,
    datosConfirmados: false,
    ultimoMensajeIA: '',
    fecha: '2026-11-13T12:00:00Z'
  };
  assert.equal(
    hasConversationAlreadyStarted('595982931098', brandNewOrder, [
      { id: 'old1', phone: '595982931098', orderId: 'NX-955908', sender: 'ai', text: 'Anterior', timestamp: '2026-11-13T02:52:24Z', status: 'sent' }
    ]),
    false
  );
});

test('reconcileLocalAndCloudChatMessages drops stale collapsed cloud pending_connection ghosts while preserving client messages', async () => {
  const { reconcileLocalAndCloudChatMessages } = await import('../whatsappEngine');

  const localCollapsed = [
    { id: 'm1', phone: '595982931098', sender: 'ai' as const, text: 'Saludo', timestamp: '2026-11-13T02:52:24Z', status: 'sent' as const, isAudioNote: true, audioDataUrl: 'data:audio/ogg;base64,AAA' },
    { id: 'kq5i4', phone: '595982931098', sender: 'ai' as const, text: '8 horas', timestamp: '2026-11-13T10:58:39Z', status: 'sent' as const, isAudioNote: true }
  ];
  const staleCloud = [
    { id: 'm1', phone: '595982931098', sender: 'ai' as const, text: 'Saludo', timestamp: '2026-11-13T02:52:24Z', status: 'sent' as const, isAudioNote: true },
    { id: 'odh18', phone: '595982931098', sender: 'ai' as const, text: '3 horas', timestamp: '2026-11-13T05:57:58Z', status: 'pending_connection' as const, isAudioNote: true },
    { id: 'pftxh', phone: '595982931098', sender: 'ai' as const, text: '7 horas', timestamp: '2026-11-13T09:58:29Z', status: 'pending_connection' as const, isAudioNote: true },
    { id: 'kq5i4', phone: '595982931098', sender: 'ai' as const, text: '8 horas', timestamp: '2026-11-13T10:58:39Z', status: 'pending_connection' as const, isAudioNote: true },
    { id: 'cli1', phone: '595982931098', sender: 'client' as const, text: 'Ya vi, es casa azul', timestamp: '2026-11-13T11:05:00Z', status: 'delivered' as const }
  ];

  const reconciled = reconcileLocalAndCloudChatMessages(localCollapsed, staleCloud);
  assert.deepEqual(reconciled.map(m => m.id), ['m1', 'kq5i4', 'cli1']);
  assert.equal(reconciled[0].audioDataUrl, 'data:audio/ogg;base64,AAA');
  assert.equal(reconciled[1].status, 'sent');
  assert.equal(reconciled.some(m => m.status === 'pending_connection'), false);
});
