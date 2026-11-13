export const FIRST_FOLLOW_UP_DELAY_MS = 5 * 60 * 1000;
export const HOURLY_FOLLOW_UP_DELAY_MS = 60 * 60 * 1000;
export const MAX_CONSECUTIVE_FOLLOW_UPS = 25;

export interface ChatStatusMessageLike {
  id?: string;
  sender: 'client' | 'admin' | 'ai' | 'agent' | string;
  senderName?: string;
  text?: string;
  timestamp?: string;
  status?: 'sent' | 'delivered' | 'pending_connection' | 'error' | string;
  isAudioNote?: boolean;
  isVoiceCall?: boolean;
  isFollowUpReminder?: boolean;
  followUpAttemptNumber?: number;
  agentChannel?: 'audio' | 'texto' | string;
  convStep?: number;
  imageUrl?: string;
  commercialStage?: string;
}

export interface ChatFollowUpStatusLike {
  hasActiveTimer: boolean;
  attemptNumber: number | null;
  scheduledAtMs: number | null;
  nextFireAtMs: number | null;
  delayMs: number | null;
}

export interface ChatOrderLike {
  datosConfirmados?: boolean;
  agenteCompletado?: boolean;
  convStep?: number;
  ultimoMensajeIA?: string;
  modoIA?: 'automatico' | 'manual' | string;
  canalIA?: 'audio' | 'texto' | string;
}

export type OrderChatStageId =
  | 'stage_0_unstarted'
  | 'stage_1_waiting_correcto'
  | 'stage_2_confirmed';

export interface OutgoingMessageSnapshot {
  id?: string;
  sender: string;
  senderLabel: string;
  channelBadge: string;
  kindBadge: string;
  isReminder: boolean;
  isPendingConnection: boolean;
  attemptNumber: number | null;
  timestampIso: string | null;
  clockText: string;
  elapsedMs: number | null;
  elapsedLabel: string;
  summaryClause: string;
  previewText: string;
}

export interface TimerBannerSnapshot {
  status:
    | 'counting'
    | 'due_now'
    | 'paused_manual'
    | 'pending_connection'
    | 'inactive_server'
    | 'cap_reached'
    | 'confirmed'
    | 'unstarted';
  badgeText: string;
  countdownBadge: string | null;
  remainingMs: number | null;
  nextAttemptNumber: number | null;
  nextCadenceLabel: string | null;
  descriptiveText: string;
}

export interface WhatsAppChatStageAndTimerSnapshot {
  stage: OrderChatStageId;
  stageStepLabel: string;
  stageTitle: string;
  stageSubtitle: string;
  lastOutgoingMsg: OutgoingMessageSnapshot | null;
  lastClientReplyElapsedLabel: string | null;
  followUpCountSinceClient: number;
  timerBanner: TimerBannerSnapshot;
}

export function formatElapsedEs(elapsedMsRaw: number): string {
  const elapsedMs = Math.max(0, Number.isFinite(elapsedMsRaw) ? elapsedMsRaw : 0);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  if (totalSeconds < 5) return 'unos segundos';
  if (totalSeconds < 60) {
    return `${totalSeconds} ${totalSeconds === 1 ? 'segundo' : 'segundos'}`;
  }
  const totalMinutes = Math.floor(elapsedMs / 60_000);
  if (totalMinutes < 60) {
    return `${totalMinutes} ${totalMinutes === 1 ? 'minuto' : 'minutos'}`;
  }
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    const remMins = totalMinutes % 60;
    const hLabel = `${totalHours} ${totalHours === 1 ? 'hora' : 'horas'}`;
    return remMins > 0
      ? `${hLabel} y ${remMins} ${remMins === 1 ? 'minuto' : 'minutos'}`
      : hLabel;
  }
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  const dLabel = `${days} ${days === 1 ? 'día' : 'días'}`;
  return remHours > 0
    ? `${dLabel} y ${remHours} ${remHours === 1 ? 'hora' : 'horas'}`
    : dLabel;
}

export function formatRemainingEs(remainingMsRaw: number): {
  phrase: string;
  verb: 'Falta' | 'Faltan';
  compact: string;
} {
  const remainingMs = Math.max(0, Number.isFinite(remainingMsRaw) ? remainingMsRaw : 0);
  if (remainingMs <= 1000) {
    return { phrase: 'menos de 1 segundo', verb: 'Falta', compact: '< 1s' };
  }
  if (remainingMs < 60_000) {
    const secs = Math.max(1, Math.ceil(remainingMs / 1000));
    return {
      phrase: `${secs} ${secs === 1 ? 'segundo' : 'segundos'}`,
      verb: secs === 1 ? 'Falta' : 'Faltan',
      compact: `${secs}s`
    };
  }
  if (remainingMs < 3_600_000) {
    const mins = Math.floor(remainingMs / 60_000);
    const remSecs = Math.floor((remainingMs % 60_000) / 1000);
    const minsLabel = `${mins} ${mins === 1 ? 'minuto' : 'minutos'}`;
    const compact = `${mins}m ${String(remSecs).padStart(2, '0')}s`;
    if (mins < 10 && remSecs > 0) {
      return {
        phrase: `${minsLabel} y ${remSecs} ${remSecs === 1 ? 'segundo' : 'segundos'}`,
        verb: mins === 1 ? 'Falta' : 'Faltan',
        compact
      };
    }
    return {
      phrase: minsLabel,
      verb: mins === 1 ? 'Falta' : 'Faltan',
      compact
    };
  }
  const hours = Math.floor(remainingMs / 3_600_000);
  const remMins = Math.floor((remainingMs % 3_600_000) / 60_000);
  const hLabel = `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const compact = `${hours}h ${String(remMins).padStart(2, '0')}m`;
  return {
    phrase:
      remMins > 0
        ? `${hLabel} y ${remMins} ${remMins === 1 ? 'minuto' : 'minutos'}`
        : hLabel,
    verb: hours === 1 ? 'Falta' : 'Faltan',
    compact
  };
}

function formatClockHm(isoTimestamp: string | null): string {
  if (!isoTimestamp) return '';
  const ts = Date.parse(isoTimestamp);
  if (!Number.isFinite(ts)) return '';
  try {
    return new Date(ts).toLocaleTimeString('es-PY', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function isOutboundSender(sender?: string): boolean {
  return sender === 'ai' || sender === 'agent' || sender === 'admin';
}

export function isMessageFollowUpReminder(msg: ChatStatusMessageLike): boolean {
  if (msg.isFollowUpReminder) return true;
  if (!isOutboundSender(msg.sender) || msg.sender === 'admin') return false;
  const senderLower = String(msg.senderName || '').toLowerCase();
  if (senderLower.includes('recordatorio')) return true;
  if ((msg.convStep || 1) >= 5) return false;
  const textLower = String(msg.text || '').toLowerCase();
  if (!textLower) return false;
  return (
    textLower.includes('ocupad') ||
    textLower.includes('sin tiempo') ||
    textLower.includes('un ratito') ||
    textLower.includes('un tiempito') ||
    textLower.includes('en cuanto puedas') ||
    textLower.includes('apenas puedas') ||
    textLower.includes('apenas tenga') ||
    textLower.includes('sin apuro') ||
    textLower.includes('te recuerdo') ||
    textLower.includes('pasaba a recordarte') ||
    textLower.includes('seguimiento')
  );
}

function truncatePreview(raw: string, maxLen = 115): string {
  const clean = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}

function summarizeOutgoingMessage(
  msg: ChatStatusMessageLike,
  nearbyAudioMsg: ChatStatusMessageLike | null,
  nowMs: number,
  inferredFollowUpNum: number
): OutgoingMessageSnapshot {
  const tsMs = msg.timestamp ? Date.parse(msg.timestamp) : NaN;
  const elapsedMs = Number.isFinite(tsMs) ? Math.max(0, nowMs - tsMs) : null;
  const elapsedLabel = elapsedMs !== null ? formatElapsedEs(elapsedMs) : 'hace un momento';
  const clockText = formatClockHm(msg.timestamp || null);

  const isAudio = Boolean(msg.isAudioNote || msg.agentChannel === 'audio');
  const hasImage = Boolean(msg.imageUrl);
  const isReminder = isMessageFollowUpReminder(msg);
  const attemptNumber = isReminder
    ? msg.followUpAttemptNumber || Math.max(1, inferredFollowUpNum)
    : null;
  const isConfirmedTurn =
    (msg.convStep || 1) >= 5 ||
    msg.commercialStage === 'stage3_confirmed' ||
    msg.commercialStage === 'stage4_vip_upsell';

  let channelBadge = isAudio ? '🎤 Audio' : '💬 Texto';
  if (hasImage && nearbyAudioMsg) {
    channelBadge = '🎤 Audio + 🖼️ Imagen';
  } else if (hasImage) {
    channelBadge = '🖼️ Imagen';
  }

  let kindBadge = 'Seguimiento IA';
  let summaryClause = 'un mensaje recordándole confirmar el pedido con CORRECTO';
  const rawPreviewText = truncatePreview(msg.text || '') || truncatePreview(nearbyAudioMsg?.text || '');

  if (msg.sender === 'admin') {
    kindBadge = 'Mensaje manual';
    channelBadge = isAudio ? '🎤 Audio manual' : '👤 Texto manual';
    summaryClause = 'un mensaje manual directo haciendo seguimiento de su pedido';
  } else if (isConfirmedTurn) {
    kindBadge = 'Confirmación 2/2';
    summaryClause = 'la confirmación final del pedido y el mensaje de agradecimiento';
  } else if (isReminder) {
    kindBadge = `Recordatorio #${attemptNumber || 1}`;
    summaryClause =
      'un mensaje más recordándole que si está ocupado/a puede responder CORRECTO apenas tenga un tiempito libre';
  } else if (hasImage || msg.commercialStage === 'stage1_welcome' || (msg.convStep || 1) <= 2) {
    kindBadge = hasImage || nearbyAudioMsg ? 'Saludo + Imagen 1/2' : 'Saludo Etapa 1/2';
    summaryClause =
      'el audio de saludo y la imagen de confirmación recordándole responder con la palabra CORRECTO';
  }

  const defaultPreview = hasImage
    ? 'Imagen comercial con instrucciones para responder CORRECTO y confirmar el envío.'
    : isReminder
      ? 'Aviso amable: si está ocupado/a ahora, puede responder CORRECTO apenas tenga un momento.'
      : 'Audio de saludo solicitando responder CORRECTO para confirmar los datos del pedido.';

  return {
    id: msg.id,
    sender: msg.sender,
    senderLabel:
      msg.sender === 'admin'
        ? 'Tú (Manual)'
        : msg.senderName || 'Agente IA',
    channelBadge,
    kindBadge,
    isReminder,
    isPendingConnection: msg.status === 'pending_connection',
    attemptNumber,
    timestampIso: msg.timestamp || null,
    clockText,
    elapsedMs,
    elapsedLabel,
    summaryClause,
    previewText: rawPreviewText || defaultPreview
  };
}

export function buildWhatsAppChatStageAndTimerSnapshot(params: {
  order: ChatOrderLike;
  messages: ChatStatusMessageLike[];
  mode: 'automatico' | 'manual';
  channel: 'audio' | 'texto';
  convStep?: number;
  followUpStatus?: ChatFollowUpStatusLike | null;
  nowMs?: number;
}): WhatsAppChatStageAndTimerSnapshot {
  const {
    order,
    messages = [],
    mode,
    followUpStatus = null,
    nowMs = Date.now()
  } = params;

  const effectiveConvStep = Math.max(params.convStep || 0, order.convStep || 0, 1);
  const isStage2 = Boolean(
    order.datosConfirmados || order.agenteCompletado || effectiveConvStep >= 5
  );

  // Locate latest outbound message & latest inbound client reply
  let lastOutboundIdx = -1;
  let lastClientIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (lastOutboundIdx === -1 && isOutboundSender(m.sender)) {
      lastOutboundIdx = i;
    }
    if (lastClientIdx === -1 && m.sender === 'client') {
      lastClientIdx = i;
    }
    if (lastOutboundIdx !== -1 && lastClientIdx !== -1) break;
  }

  // Count reminders sent after the latest client message (reset per reply)
  let followUpCountSinceClient = 0;
  for (let i = lastClientIdx + 1; i < messages.length; i++) {
    if (isMessageFollowUpReminder(messages[i])) {
      followUpCountSinceClient++;
    }
  }

  // If the last outbound message is a companion image sent right after an audio greeting, keep audio text nearby for preview
  let nearbyAudioMsg: ChatStatusMessageLike | null = null;
  if (lastOutboundIdx >= 0 && messages[lastOutboundIdx]?.imageUrl) {
    const imgTs = messages[lastOutboundIdx].timestamp
      ? Date.parse(messages[lastOutboundIdx].timestamp || '')
      : NaN;
    for (let j = lastOutboundIdx - 1; j >= Math.max(0, lastOutboundIdx - 3); j--) {
      const candidate = messages[j];
      if (!isOutboundSender(candidate.sender)) break;
      if (candidate.isAudioNote || candidate.agentChannel === 'audio') {
        const candTs = candidate.timestamp ? Date.parse(candidate.timestamp) : NaN;
        if (!Number.isFinite(imgTs) || !Number.isFinite(candTs) || imgTs - candTs <= 60_000) {
          nearbyAudioMsg = candidate;
          break;
        }
      }
    }
  }

  const lastOutgoingMsg =
    lastOutboundIdx >= 0
      ? summarizeOutgoingMessage(
          messages[lastOutboundIdx],
          nearbyAudioMsg,
          nowMs,
          followUpCountSinceClient
        )
      : null;

  let lastClientReplyElapsedLabel: string | null = null;
  if (lastClientIdx >= 0 && messages[lastClientIdx]?.timestamp) {
    const clientTs = Date.parse(messages[lastClientIdx].timestamp || '');
    if (Number.isFinite(clientTs)) {
      lastClientReplyElapsedLabel = formatElapsedEs(Math.max(0, nowMs - clientTs));
    }
  }

  const hasStarted = Boolean(
    isStage2 ||
      effectiveConvStep >= 2 ||
      order.ultimoMensajeIA ||
      lastOutboundIdx !== -1 ||
      messages.length > 0
  );

  const stage: OrderChatStageId = isStage2
    ? 'stage_2_confirmed'
    : hasStarted
      ? 'stage_1_waiting_correcto'
      : 'stage_0_unstarted';

  const stageStepLabel = isStage2
    ? 'Etapa 2/2'
    : 'Etapa 1/2';

  const stageTitle = isStage2
    ? 'Pedido Confirmado (Etapa 2 de 2)'
    : hasStarted
      ? 'Audio de saludo e imagen enviados · Esperando CORRECTO'
      : 'Etapa 1 de 2 pendiente · Sin mensaje enviado aún';

  const stageSubtitle = isStage2
    ? 'El cliente respondió CORRECTO y ya recibió su confirmación y agradecimiento final.'
    : hasStarted
      ? 'Falta que el cliente responda con la palabra CORRECTO para pasar automáticamente a la Etapa 2/2.'
      : 'Aún no se ha enviado el audio de saludo ni la imagen de confirmación a este pedido.';

  // Build honest, dynamic descriptive Timer Banner
  let timerBanner: TimerBannerSnapshot;

  if (stage === 'stage_2_confirmed') {
    const sentPart = lastOutgoingMsg
      ? `Hace ${lastOutgoingMsg.elapsedLabel} se envió ${lastOutgoingMsg.summaryClause}. `
      : '';
    timerBanner = {
      status: 'confirmed',
      badgeText: '✅ Ciclo completado',
      countdownBadge: null,
      remainingMs: null,
      nextAttemptNumber: null,
      nextCadenceLabel: null,
      descriptiveText: `${sentPart}El pedido ya fue confirmado en Etapa 2/2, por lo que no se enviarán más audios de recordatorio.`
    };
  } else if (stage === 'stage_0_unstarted' && !followUpStatus?.hasActiveTimer) {
    timerBanner = {
      status: 'unstarted',
      badgeText: '🆕 En espera de inicio',
      countdownBadge: null,
      remainingMs: null,
      nextAttemptNumber: 1,
      nextCadenceLabel: '5 minutos tras el primer envío',
      descriptiveText:
        'Todavía no se ha enviado ningún mensaje al cliente. Apenas salga el saludo e imagen de la Etapa 1/2 comenzará el temporizador automático (primer recordatorio a los 5 minutos y luego cada 1 hora si no responde).'
    };
  } else if (mode === 'manual') {
    const sentSentence = lastOutgoingMsg
      ? `Hace ${lastOutgoingMsg.elapsedLabel} se ha enviado ${lastOutgoingMsg.summaryClause}. `
      : '';
    timerBanner = {
      status: 'paused_manual',
      badgeText: '⏸️ En pausa (Modo Manual)',
      countdownBadge: 'Pausado',
      remainingMs: null,
      nextAttemptNumber: null,
      nextCadenceLabel: null,
      descriptiveText: `${sentSentence}El envío automático de audios de recordatorio está pausado porque activaste «👤 Yo Escribo».`
    };
  } else if (lastOutgoingMsg?.isPendingConnection && !followUpStatus?.hasActiveTimer) {
    const nextCadenceLabel =
      followUpCountSinceClient === 0 ? '5 minutos' : '1 hora';
    timerBanner = {
      status: 'pending_connection',
      badgeText: '📡 Pendiente de entrega WhatsApp',
      countdownBadge: 'En cola',
      remainingMs: null,
      nextAttemptNumber: followUpCountSinceClient + 1,
      nextCadenceLabel,
      descriptiveText: `Hace ${lastOutgoingMsg.elapsedLabel} se preparó ${lastOutgoingMsg.summaryClause} y aguarda reconexión para entregarse. Una vez enviado, volverá a recordarle por audio en ${nextCadenceLabel} si sigue sin responder.`
    };
  } else if (followUpStatus && followUpStatus.hasActiveTimer && followUpStatus.nextFireAtMs) {
    const remainingMs = Math.max(0, followUpStatus.nextFireAtMs - nowMs);
    const rem = formatRemainingEs(remainingMs);
    const attemptNumber = followUpStatus.attemptNumber || followUpCountSinceClient + 1;
    const cadenceMs = followUpStatus.delayMs || (attemptNumber <= 1 ? FIRST_FOLLOW_UP_DELAY_MS : HOURLY_FOLLOW_UP_DELAY_MS);
    const nextCadenceLabel = cadenceMs <= FIRST_FOLLOW_UP_DELAY_MS ? '5 minutos' : '1 hora';

    const sentSentence = lastOutgoingMsg
      ? `Hace ${lastOutgoingMsg.elapsedLabel} se ha enviado ${lastOutgoingMsg.summaryClause}.`
      : order.ultimoMensajeIA
        ? 'Se envió el mensaje inicial de Etapa 1/2 esperando respuesta del cliente.'
        : 'El mensaje de Etapa 1/2 fue enviado al cliente.';

    if (remainingMs <= 1500) {
      timerBanner = {
        status: 'due_now',
        badgeText: `🔔 Audio #${attemptNumber} enviándose ahora`,
        countdownBadge: 'Enviando ahora',
        remainingMs: 0,
        nextAttemptNumber: attemptNumber,
        nextCadenceLabel,
        descriptiveText: `${sentSentence} En este instante se está disparando el próximo audio recordatorio (#${attemptNumber}) por falta de respuesta.`
      };
    } else {
      timerBanner = {
        status: 'counting',
        badgeText: `⏱️ Próximo audio #${attemptNumber}`,
        countdownBadge: `${rem.verb} ${rem.compact}`,
        remainingMs,
        nextAttemptNumber: attemptNumber,
        nextCadenceLabel,
        descriptiveText: `${sentSentence} ${rem.verb} ${rem.phrase} para volver a enviarle un audio más recordándole confirmar.`
      };
    }
  } else if (followUpCountSinceClient >= MAX_CONSECUTIVE_FOLLOW_UPS) {
    const sentSentence = lastOutgoingMsg
      ? `Hace ${lastOutgoingMsg.elapsedLabel} se ha enviado ${lastOutgoingMsg.summaryClause}. `
      : '';
    timerBanner = {
      status: 'cap_reached',
      badgeText: '🛑 Límite de recordatorios',
      countdownBadge: 'Completado',
      remainingMs: null,
      nextAttemptNumber: null,
      nextCadenceLabel: null,
      descriptiveText: `${sentSentence}Se alcanzó el límite máximo de 25 recordatorios automáticos consecutivos sin respuesta del cliente.`
    };
  } else if (followUpStatus && !followUpStatus.hasActiveTimer) {
    // Live backend explicitly reported no in-memory timer scheduled right now (e.g., server restarted after message)
    const nextAttemptNumber = followUpCountSinceClient + 1;
    const nextCadenceLabel = nextAttemptNumber <= 1 ? '5 minutos' : '1 hora';
    const sentSentence = lastOutgoingMsg
      ? `Hace ${lastOutgoingMsg.elapsedLabel} se ha enviado ${lastOutgoingMsg.summaryClause}. `
      : 'La Etapa 1/2 ya fue iniciada para este pedido. ';
    timerBanner = {
      status: 'inactive_server',
      badgeText: '⚠️ Sin temporizador activo',
      countdownBadge: 'Sin timer activo',
      remainingMs: null,
      nextAttemptNumber,
      nextCadenceLabel,
      descriptiveText: `${sentSentence}No hay un temporizador activo en memoria del servidor en este momento (cadencia habitual: ${nextCadenceLabel}). Podés usar «🔄 Re-disparar etapa» si querés enviarle un recordatorio ahora.`
    };
  } else {
    // Fallback before followUpStatus telemetry arrives: compute exact cadence window from last outbound timestamp
    const nextAttemptNumber = followUpCountSinceClient + 1;
    const delayMs =
      nextAttemptNumber <= 1 ? FIRST_FOLLOW_UP_DELAY_MS : HOURLY_FOLLOW_UP_DELAY_MS;
    const nextCadenceLabel = delayMs <= FIRST_FOLLOW_UP_DELAY_MS ? '5 minutos' : '1 hora';
    const anchorMs = lastOutgoingMsg?.timestampIso ? Date.parse(lastOutgoingMsg.timestampIso) : NaN;
    const remainingMs = Number.isFinite(anchorMs)
      ? Math.max(0, anchorMs + delayMs - nowMs)
      : delayMs;
    const rem = formatRemainingEs(remainingMs);
    const sentSentence = lastOutgoingMsg
      ? `Hace ${lastOutgoingMsg.elapsedLabel} se ha enviado ${lastOutgoingMsg.summaryClause}.`
      : 'Se inició la Etapa 1/2 esperando respuesta del cliente.';

    timerBanner = {
      status: remainingMs > 0 ? 'counting' : 'due_now',
      badgeText: `⏱️ Cadencia c/ ${nextCadenceLabel}`,
      countdownBadge: remainingMs > 0 ? `${rem.verb} ${rem.compact}` : 'Sincronizando…',
      remainingMs,
      nextAttemptNumber,
      nextCadenceLabel,
      descriptiveText:
        remainingMs > 0
          ? `${sentSentence} ${rem.verb} ${rem.phrase} para volver a enviarle un audio más.`
          : `${sentSentence} El tiempo habitual (${nextCadenceLabel}) ya se cumplió; verificando estado del servidor.`
    };
  }

  return {
    stage,
    stageStepLabel,
    stageTitle,
    stageSubtitle,
    lastOutgoingMsg,
    lastClientReplyElapsedLabel,
    followUpCountSinceClient,
    timerBanner
  };
}
