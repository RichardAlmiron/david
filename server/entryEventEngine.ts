import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { decryptPollVote } from '@whiskeysockets/baileys';

const execFileAsync = promisify(execFile);

export type BackgroundMusicPreset = 'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none';

export type EntryEventStage =
  | 'pending_choice'
  | 'instant_upgraded'
  | 'waitlist_enrolled'
  | 'silenced_until_end'
  | 'final_dispatched';

export interface EntryEventState {
  stage: EntryEventStage;
  attemptsSent: number;
  enrolledAt?: string;
  lastAttemptAt?: string;
  nextFollowUpAt?: string;
  lastNoticeAt?: string;
  silenceStartedAt?: string;
  eventEndsAt: string;
  slotsTotal: number;
  slotsTaken: number;
  entryProductName: string;
  entryPriceGs: number;
  deliveryFeeGs: number;
  instantUpgradePriceGs: number;
  waitlistPriceGs: number;
  backgroundMusicPreset?: BackgroundMusicPreset;
  pollMsgId?: string;
  pollEncKeyBase64?: string;
  pollCreatorJid?: string;
  pollVoterJid?: string;
  pollOptionHashes?: string[];
  selectedOption?: 'option_1_instant' | 'option_2_waitlist';
}

export function formatGsPlain(n: number): string {
  return `Gs. ${Math.round(Number(n) || 0).toLocaleString('es-PY')}`;
}

export function resolveEntryConfig(matchedProduct: any) {
  const tc = matchedProduct?.tripwireConfig;
  if (!tc || !tc.enabled || !String(tc.entryProductName || '').trim()) {
    return null;
  }
  const entryProductName = String(tc.entryProductName).trim();
  const entryPriceGs = Math.max(5000, Number(tc.entryPriceGs ?? tc.entryProductPriceGs ?? 20000));
  const deliveryFeeGs = Math.max(15000, Number(tc.deliveryFeeGs ?? tc.entryDeliveryFeeGs ?? 40000));
  const instantDiscountPercent = Math.max(5, Math.min(40, Number(tc.instantDiscountPercent || 12)));
  const eventDurationHours = Math.max(2, Math.min(12, Number(tc.eventDurationHours || 6)));
  const slotsTotal = Math.max(5, Math.min(20, Number(tc.slotsTotal ?? tc.eventSlotsCount ?? 10)));
  const backgroundMusicPreset: BackgroundMusicPreset =
    tc.backgroundMusicPreset === 'soft_lounge' ||
    tc.backgroundMusicPreset === 'commercial_pulse' ||
    tc.backgroundMusicPreset === 'none'
      ? tc.backgroundMusicPreset
      : 'warm_ambient';

  const principalPrice1 = Number(
    matchedProduct?.precios?.[1] || matchedProduct?.precioNormal || 189000
  );
  const instantUpgradePriceGs =
    Math.round((principalPrice1 * (100 - instantDiscountPercent)) / 100 / 1000) * 1000;
  const waitlistPriceGs = Math.max(
    35000,
    Math.round((instantUpgradePriceGs * 0.94) / 1000) * 1000
  );

  return {
    entryProductName,
    entryProductDescription: String(tc.entryProductDescription || entryProductName).trim(),
    entryProductImage: String(tc.entryProductImage || matchedProduct?.imagen || '').trim(),
    entryPriceGs,
    deliveryFeeGs,
    instantDiscountPercent,
    eventDurationHours,
    slotsTotal,
    backgroundMusicPreset,
    principalName: String(matchedProduct?.nombre || 'Producto Principal').trim(),
    principalPrice1,
    instantUpgradePriceGs,
    waitlistPriceGs
  };
}

export function isEntryOnlyOrderWithConfig(ord: any, matchedProduct: any): boolean {
  if (!ord) return false;
  if (ord.tripwireEventState && ord.purchasePath === 'entry_only') return true;
  if (ord.purchasePath !== 'entry_only') return false;
  return Boolean(resolveEntryConfig(matchedProduct));
}

export function buildInitialEntryEventState(
  ord: any,
  matchedProduct: any,
  nowMs = Date.now()
): EntryEventState {
  const cfg = resolveEntryConfig(matchedProduct);
  const entryProductName = cfg?.entryProductName || String(ord?.purchaseOfferTitle || ord?.producto || 'Artículo de Entrada');
  const entryPriceGs = cfg?.entryPriceGs || Number(ord?.monto || 20000);
  const deliveryFeeGs = cfg?.deliveryFeeGs || 40000;
  const slotsTotal = cfg?.slotsTotal || 10;
  const durationHours = cfg?.eventDurationHours || 6;
  const principalPrice1 = cfg?.principalPrice1 || 189000;
  const instantUpgradePriceGs =
    cfg?.instantUpgradePriceGs || Math.round((principalPrice1 * 0.88) / 1000) * 1000;
  const waitlistPriceGs =
    cfg?.waitlistPriceGs || Math.round((instantUpgradePriceGs * 0.94) / 1000) * 1000;

  // Deterministic realistic initial slot count (3..5 of 10)
  const seed = String(ord?.reservaid || ord?.celular || nowMs)
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const initialTaken = Math.min(slotsTotal - 2, 3 + (seed % 3));

  return {
    stage: 'pending_choice',
    attemptsSent: 1,
    lastAttemptAt: new Date(nowMs).toISOString(),
    eventEndsAt: new Date(nowMs + durationHours * 3600 * 1000).toISOString(),
    slotsTotal,
    slotsTaken: initialTaken,
    entryProductName,
    entryPriceGs,
    deliveryFeeGs,
    instantUpgradePriceGs,
    waitlistPriceGs,
    backgroundMusicPreset: cfg?.backgroundMusicPreset || 'warm_ambient'
  };
}

export function buildEntryPollDefinition(
  matchedProduct: any,
  state: EntryEventState
): {
  question: string;
  options: [string, string];
  optionHashes: [string, string];
} {
  const cfg = resolveEntryConfig(matchedProduct);
  const principalName = cfg?.principalName || String(matchedProduct?.nombre || 'Paquete Principal');
  const durationHours = cfg?.eventDurationHours || 6;

  const opt1 = `1️⃣ Llevar ${principalName} (${formatGsPlain(state.instantUpgradePriceGs)}) + ${state.entryProductName} GRATIS y Envío Gratis`;
  const opt2 = `2️⃣ Anotarme en la lista de ${state.slotsTotal} cupos (${durationHours}hs) para promo especial`;
  const h1 = crypto.createHash('sha256').update(opt1).digest('hex');
  const h2 = crypto.createHash('sha256').update(opt2).digest('hex');

  return {
    question: `🎁 Opciones especiales para tu pedido de ${state.entryProductName} (tocá 1 opción):`,
    options: [opt1, opt2],
    optionHashes: [h1, h2]
  };
}

export function buildEntryAttemptSpeech(params: {
  customerFirstName: string;
  matchedProduct: any;
  state: EntryEventState;
  attemptNumber: 1 | 2;
}): string {
  const cfg = resolveEntryConfig(params.matchedProduct);
  const principalName = cfg?.principalName || String(params.matchedProduct?.nombre || 'nuestro equipo completo');
  const durationHours = cfg?.eventDurationHours || 6;
  const firstName = params.customerFirstName || '¿qué tal?';

  if (params.attemptNumber === 1) {
    return (
      `Hola ${firstName}, ¿cómo estás? Recibimos tu solicitud de ${params.state.entryProductName}. ` +
      `Antes de procesar tu envío individual, te cuento algo súper transparente que te conviene aprovechar: ` +
      `la oferta individual de ${params.state.entryProductName} a ${params.state.entryPriceGs.toLocaleString('es-PY')} guaraníes no incluye envío gratis. ` +
      `En cambio, si decidís llevar hoy el ${principalName} con descuento preferencial a ${params.state.instantUpgradePriceGs.toLocaleString('es-PY')} guaraníes, ` +
      `el ${params.state.entryProductName} te va totalmente DE REGALO y activás el ENVÍO GRATIS directo hasta tu puerta. ` +
      `Y si hoy preferís pensarlo tranquilo, también podés anotarte en el evento privado de ${params.state.slotsTotal} cupos que dura ${durationHours} horas. ` +
      `Abajo te dejo una encuesta de un toque para que elijas lo que te quede más cómodo.`
    );
  }

  return (
    `Hola de nuevo ${firstName}, un saludo cortito para no molestarte en tu horario. ` +
    `Todavía tenés activa la opción de aprovechar el ${principalName} completo con envío gratis y el ${params.state.entryProductName} de regalo, ` +
    `o reservar tu lugar en los ${params.state.slotsTotal} cupos del evento antes de cerrar la lista. ` +
    `Podés tocar directamente la opción en la encuesta acá abajo cuando tengas un minutito.`
  );
}

export function buildWaitlistUpdateSpeech(params: {
  customerFirstName: string;
  matchedProduct: any;
  state: EntryEventState;
  remainingHours: number;
}): string {
  const cfg = resolveEntryConfig(params.matchedProduct);
  const principalName = cfg?.principalName || String(params.matchedProduct?.nombre || 'el paquete completo');
  const hrsText =
    params.remainingHours >= 1
      ? `${Math.max(1, Math.round(params.remainingHours))} horas`
      : 'menos de 1 hora';

  return (
    `Hola ${params.customerFirstName}, actualización breve de tu cupo en la lista especial. ` +
    `Ya van ${params.state.slotsTaken} de ${params.state.slotsTotal} cupos tomados y quedan aproximadamente ${hrsText} antes del cierre. ` +
    `Si querés asegurar hoy el ${principalName} completo a ${params.state.waitlistPriceGs.toLocaleString('es-PY')} guaraníes con ${params.state.entryProductName} gratis y envío sin costo, ` +
    `podés confirmar tocando la primera opción de la encuesta. Si no, seguís tranquilo en la lista hasta que cierre el evento.`
  );
}

export function buildFinalDispatchSpeech(params: {
  customerFirstName: string;
  matchedProduct: any;
  state: EntryEventState;
}): string {
  const cfg = resolveEntryConfig(params.matchedProduct);
  const principalName = cfg?.principalName || String(params.matchedProduct?.nombre || 'el equipo completo');
  const totalWithDelivery = params.state.entryPriceGs + params.state.deliveryFeeGs;

  return (
    `Hola ${params.customerFirstName}, cerró el evento de hoy y cumplimos con vos como prometimos. ` +
    `Dejamos listo para despacho tu pedido individual de ${params.state.entryProductName}: ` +
    `el producto cuesta ${params.state.entryPriceGs.toLocaleString('es-PY')} guaraníes más el delivery de ${params.state.deliveryFeeGs.toLocaleString('es-PY')} guaraníes, ` +
    `dando un total de ${totalWithDelivery.toLocaleString('es-PY')} guaraníes al recibir en mano. ` +
    `De paso, si justo antes de que salga el móvil preferís cambiarlo por ${principalName} completo con envío gratis y el ${params.state.entryProductName} de regalo, avisame nomás por acá.`
  );
}

export function classifyEntryTextIntent(rawText: string): 'option_1_instant' | 'option_2_waitlist' | null {
  const norm = String(rawText || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!norm) return null;

  if (/^(1|1️⃣|opcion\s*1|opci[oó]n\s*1|el\s*1|la\s*1)\b/.test(norm)) {
    return 'option_1_instant';
  }
  if (/^(2|2️⃣|opcion\s*2|opci[oó]n\s*2|el\s*2|la\s*2)\b/.test(norm)) {
    return 'option_2_waitlist';
  }

  const wantsInstant =
    /\b(llevar|quiero)\s+(el\s+)?(principal|completo|combo|paquete|grande)\b/.test(norm) ||
    /\b(aprovecho|aprovechar|adelantado|upgrade|con\s+envio\s+gratis|cambiar\s+al\s+completo|si\s+quiero\s+el\s+completo)\b/.test(
      norm
    );
  if (wantsInstant) return 'option_1_instant';

  const wantsWaitlist =
    /\b(lista|cupo|cupos|evento|esperar|espera|participar|anotame|anotar)\b/.test(norm);
  if (wantsWaitlist) return 'option_2_waitlist';

  return null;
}

export function decodeEntryPollVoteSelection(params: {
  pollUpdateMsg: any;
  pollMsgId: string;
  pollEncKeyBase64: string;
  pollCreatorJid: string;
  voterJids: string[];
  optionHashes: string[];
}): 'option_1_instant' | 'option_2_waitlist' | null {
  const voteEnc = params.pollUpdateMsg?.vote;
  if (!voteEnc?.encPayload || !voteEnc?.encIv || !params.pollEncKeyBase64) {
    return null;
  }
  const pollEncKey = Buffer.from(params.pollEncKeyBase64, 'base64');
  if (pollEncKey.length < 16) return null;

  const uniqueVoters = Array.from(new Set(params.voterJids.filter(Boolean)));
  for (const voterJid of uniqueVoters) {
    try {
      const decrypted = decryptPollVote(voteEnc, {
        pollCreatorJid: params.pollCreatorJid,
        pollMsgId: params.pollMsgId,
        pollEncKey,
        voterJid
      });
      const selected = Array.isArray(decrypted?.selectedOptions) ? decrypted.selectedOptions : [];
      for (const optBuf of selected) {
        const hex = Buffer.from(optBuf).toString('hex');
        if (params.optionHashes[0] && hex === params.optionHashes[0]) {
          return 'option_1_instant';
        }
        if (params.optionHashes[1] && hex === params.optionHashes[1]) {
          return 'option_2_waitlist';
        }
      }
    } catch {
      // Retry next candidate voter JID (@lid vs @s.whatsapp.net)
    }
  }
  return null;
}

export type EntrySchedulerDecision =
  | { action: 'noop' }
  | { action: 'send_attempt_2'; nextState: EntryEventState }
  | { action: 'silence_until_end'; nextState: EntryEventState }
  | { action: 'send_waitlist_2h_update'; nextState: EntryEventState; remainingHours: number }
  | { action: 'send_final_dispatch'; nextState: EntryEventState };

export function evaluateEntryEventTick(
  state: EntryEventState,
  nowMs = Date.now()
): EntrySchedulerDecision {
  if (!state || state.stage === 'instant_upgraded' || state.stage === 'final_dispatched') {
    return { action: 'noop' };
  }

  const endsAtMs = new Date(state.eventEndsAt).getTime();
  const lastAttemptMs = new Date(state.lastAttemptAt || 0).getTime();

  // 1. Event ended -> send final standalone dispatch summary (never claiming free shipping)
  if (Number.isFinite(endsAtMs) && nowMs >= endsAtMs) {
    return {
      action: 'send_final_dispatch',
      nextState: {
        ...state,
        stage: 'final_dispatched',
        lastNoticeAt: new Date(nowMs).toISOString()
      }
    };
  }

  // 2. Pending choice outreach (max 2 attempts before silencing until event end)
  if (state.stage === 'pending_choice') {
    const elapsedSinceAttempt = nowMs - (Number.isFinite(lastAttemptMs) ? lastAttemptMs : nowMs);
    if (state.attemptsSent < 2 && elapsedSinceAttempt >= 90 * 60 * 1000) {
      return {
        action: 'send_attempt_2',
        nextState: {
          ...state,
          attemptsSent: 2,
          lastAttemptAt: new Date(nowMs).toISOString()
        }
      };
    }
    if (state.attemptsSent >= 2 && elapsedSinceAttempt >= 90 * 60 * 1000) {
      return {
        action: 'silence_until_end',
        nextState: {
          ...state,
          stage: 'silenced_until_end',
          silenceStartedAt: new Date(nowMs).toISOString()
        }
      };
    }
  }

  // 3. Enrolled in 10-slot waitlist -> send update every 2 hours while event active
  if (state.stage === 'waitlist_enrolled') {
    const nextFollowMs = new Date(state.nextFollowUpAt || 0).getTime();
    const lastNoticeMs = new Date(state.lastNoticeAt || state.enrolledAt || 0).getTime();
    const dueByFollowUp = Number.isFinite(nextFollowMs) && nextFollowMs > 0 && nowMs >= nextFollowMs;
    const dueByElapsed = Number.isFinite(lastNoticeMs) && nowMs - lastNoticeMs >= 2 * 3600 * 1000;
    if (dueByFollowUp || dueByElapsed) {
      const remainingHours = Math.max(0.5, (endsAtMs - nowMs) / (3600 * 1000));
      return {
        action: 'send_waitlist_2h_update',
        remainingHours,
        nextState: {
          ...state,
          slotsTaken: Math.min(state.slotsTotal, state.slotsTaken + 1),
          lastNoticeAt: new Date(nowMs).toISOString(),
          nextFollowUpAt: new Date(nowMs + 2 * 3600 * 1000).toISOString()
        }
      };
    }
  }

  return { action: 'noop' };
}

export function applyEntryChoiceToOrder(
  ord: any,
  matchedProduct: any,
  choice: 'option_1_instant' | 'option_2_waitlist',
  nowMs = Date.now()
): { state: EntryEventState; upgradedToPrincipal: boolean } {
  const cfg = resolveEntryConfig(matchedProduct);
  const currentState: EntryEventState =
    ord?.tripwireEventState || buildInitialEntryEventState(ord, matchedProduct, nowMs);

  if (choice === 'option_1_instant') {
    const principalName = cfg?.principalName || String(matchedProduct?.nombre || ord?.producto || 'Paquete Principal');
    const nextState: EntryEventState = {
      ...currentState,
      stage: 'instant_upgraded',
      selectedOption: 'option_1_instant',
      lastNoticeAt: new Date(nowMs).toISOString()
    };
    ord.tripwireEventState = nextState;
    ord.purchasePath = 'principal_bundle';
    ord.producto = principalName;
    ord.cantidad = 1;
    ord.monto = currentState.instantUpgradePriceGs;
    ord.purchaseOfferTitle = `${principalName} + ${currentState.entryProductName} DE REGALO`;
    ord.convStep = Math.max(3, Number(ord.convStep || 3));
    return { state: nextState, upgradedToPrincipal: true };
  }

  const nextState: EntryEventState = {
    ...currentState,
    stage: 'waitlist_enrolled',
    selectedOption: 'option_2_waitlist',
    enrolledAt: currentState.enrolledAt || new Date(nowMs).toISOString(),
    lastNoticeAt: new Date(nowMs).toISOString(),
    nextFollowUpAt: new Date(nowMs + 2 * 3600 * 1000).toISOString(),
    slotsTaken: Math.min(currentState.slotsTotal, Math.max(currentState.slotsTaken + 1, 4))
  };
  ord.tripwireEventState = nextState;
  return { state: nextState, upgradedToPrincipal: false };
}

// ============================================================================
// FFmpeg Background Music Generator & Mixer (OGG/Opus 48kHz Mono for WA PTT)
// ============================================================================

const BGM_DIR = path.resolve(process.cwd(), 'public', 'assets', 'bgm');
let cachedFfmpegPath: string | null | undefined;

function resolveFfmpegBinary(): string | null {
  if (cachedFfmpegPath !== undefined) return cachedFfmpegPath;
  for (const candidate of ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', 'ffmpeg']) {
    if (candidate === 'ffmpeg' || fs.existsSync(candidate)) {
      cachedFfmpegPath = candidate;
      return candidate;
    }
  }
  cachedFfmpegPath = null;
  return null;
}

async function ensurePresetBgmFile(preset: Exclude<BackgroundMusicPreset, 'none'>): Promise<string | null> {
  const bin = resolveFfmpegBinary();
  if (!bin) return null;

  fs.mkdirSync(BGM_DIR, { recursive: true });
  const customMp3 = path.join(BGM_DIR, `${preset}.mp3`);
  const cachedOgg = path.join(BGM_DIR, `${preset}.ogg`);
  if (fs.existsSync(customMp3)) return customMp3;
  if (fs.existsSync(cachedOgg) && fs.statSync(cachedOgg).size > 2048) return cachedOgg;

  // Synthesize gentle warm harmonic pad mathematically via lavfi aevalsrc
  const expr =
    preset === 'soft_lounge'
      ? '0.18*sin(2*PI*220*t)+0.14*sin(2*PI*277.18*t)+0.12*sin(2*PI*329.63*t)+0.10*sin(2*PI*415.30*t)'
      : preset === 'commercial_pulse'
        ? '(0.16*sin(2*PI*261.63*t)+0.14*sin(2*PI*329.63*t)+0.12*sin(2*PI*392*t))*(0.75+0.25*sin(2*PI*1.5*t))'
        : '0.18*sin(2*PI*261.63*t)+0.14*sin(2*PI*329.63*t)+0.12*sin(2*PI*392*t)+0.10*sin(2*PI*493.88*t)';

  try {
    await execFileAsync(
      bin,
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        `aevalsrc=${expr}:s=48000:d=18`,
        '-af',
        'lowpass=f=680,afade=t=in:st=0:d=1.2,afade=t=out:st=16.5:d=1.5',
        '-c:a',
        'libopus',
        '-b:a',
        '32k',
        '-ac',
        '1',
        cachedOgg
      ],
      { timeout: 12_000 }
    );
    if (fs.existsSync(cachedOgg) && fs.statSync(cachedOgg).size > 1024) {
      return cachedOgg;
    }
  } catch (err) {
    console.warn('[EntryEvent BGM] No se pudo sintetizar pista BGM:', (err as any)?.message || err);
  }
  return null;
}

export async function mixVoiceWithBackgroundMusic(
  voiceOggBuffer: Buffer | null,
  preset: BackgroundMusicPreset = 'warm_ambient'
): Promise<{
  audioBuffer: Buffer | null;
  audioDataUrl: string | null;
  mixedWithBgm: boolean;
}> {
  if (!voiceOggBuffer || voiceOggBuffer.length < 128) {
    return { audioBuffer: voiceOggBuffer, audioDataUrl: null, mixedWithBgm: false };
  }
  const rawDataUrl = `data:audio/ogg;base64,${voiceOggBuffer.toString('base64')}`;
  if (preset === 'none') {
    return { audioBuffer: voiceOggBuffer, audioDataUrl: rawDataUrl, mixedWithBgm: false };
  }

  const bin = resolveFfmpegBinary();
  const bgmFile = await ensurePresetBgmFile(preset);
  if (!bin || !bgmFile) {
    return { audioBuffer: voiceOggBuffer, audioDataUrl: rawDataUrl, mixedWithBgm: false };
  }

  const tmpDir = os.tmpdir();
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const inVoice = path.join(tmpDir, `entry_vox_${stamp}.ogg`);
  const outMixed = path.join(tmpDir, `entry_mix_${stamp}.ogg`);

  try {
    fs.writeFileSync(inVoice, voiceOggBuffer);
    await execFileAsync(
      bin,
      [
        '-y',
        '-i',
        inVoice,
        '-stream_loop',
        '-1',
        '-i',
        bgmFile,
        '-filter_complex',
        '[1:a]volume=0.085[bgm];[0:a]volume=1.08[vox];[vox][bgm]amix=inputs=2:duration=first:dropout_transition=1.2[out]',
        '-map',
        '[out]',
        '-c:a',
        'libopus',
        '-b:a',
        '32k',
        '-ar',
        '48000',
        '-ac',
        '1',
        outMixed
      ],
      { timeout: 15_000 }
    );

    if (fs.existsSync(outMixed) && fs.statSync(outMixed).size > 256) {
      const mixedBuf = fs.readFileSync(outMixed);
      return {
        audioBuffer: mixedBuf,
        audioDataUrl: `data:audio/ogg;base64,${mixedBuf.toString('base64')}`,
        mixedWithBgm: true
      };
    }
  } catch (err: any) {
    console.warn('[EntryEvent BGM Mix Fallback]:', err?.message || err);
  } finally {
    try {
      if (fs.existsSync(inVoice)) fs.unlinkSync(inVoice);
      if (fs.existsSync(outMixed)) fs.unlinkSync(outMixed);
    } catch {}
  }

  return { audioBuffer: voiceOggBuffer, audioDataUrl: rawDataUrl, mixedWithBgm: false };
}
