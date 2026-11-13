import fs from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { Mutex } from 'async-mutex';
import {
  proto,
  BufferJSON,
  initAuthCreds,
  extractE2ESessionFromRetryReceipt,
  parseAndInjectE2ESessions,
  buildAckStanza,
  encodeWAMessage,
  encodeSignedDeviceIdentity,
  normalizeMessageContent,
  generateMessageIDV2,
  areJidsSameUser,
  isLidUser,
  isHostedLidUser,
  isPnUser,
  isHostedPnUser,
  isJidGroup,
  isJidStatusBroadcast,
  jidDecode,
  jidEncode,
  jidNormalizedUser,
  getBinaryNodeChild,
  getBinaryNodeChildren,
  S_WHATSAPP_NET,
  type JidServer
} from '@whiskeysockets/baileys';

// ============================================================================
// ATOMIC FILE-SYSTEM AUTH STATE (Eliminates partial/corrupt Signal state on crash)
// ============================================================================

const atomicFileLocks = new Map<string, Mutex>();
let atomicTmpSeq = 0;

function getAtomicFileLock(filePath: string): Mutex {
  let mutex = atomicFileLocks.get(filePath);
  if (!mutex) {
    mutex = new Mutex();
    atomicFileLocks.set(filePath, mutex);
  }
  return mutex;
}

export async function atomicWriteJsonFile(filePath: string, data: unknown, replacer?: (this: any, key: string, value: any) => any): Promise<void> {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp.${process.pid}.${++atomicTmpSeq}`;
  const serialized = JSON.stringify(data, replacer);
  try {
    await fs.promises.writeFile(tmpPath, serialized, 'utf-8');
    await fs.promises.rename(tmpPath, filePath);
  } catch (err) {
    try {
      await fs.promises.unlink(tmpPath);
    } catch {}
    throw err;
  }
}

export function atomicWriteFileSync(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp.${process.pid}.${++atomicTmpSeq}`;
  try {
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {}
    throw err;
  }
}

export async function createAtomicMultiFileAuthState(folder: string) {
  const fixFileName = (file: string) => file?.replace(/\//g, '__')?.replace(/:/g, '-');

  const folderInfo = await fs.promises.stat(folder).catch(() => null);
  if (folderInfo) {
    if (!folderInfo.isDirectory()) {
      throw new Error(`found something that is not a directory at ${folder}, either delete it or specify a different location`);
    }
    // Clean orphaned stale temp files from hard container kills
    try {
      const entries = await fs.promises.readdir(folder);
      const now = Date.now();
      for (const entry of entries) {
        if (entry.includes('.tmp.')) {
          const full = path.join(folder, entry);
          const st = await fs.promises.stat(full).catch(() => null);
          if (st && now - st.mtimeMs > 30_000) {
            await fs.promises.unlink(full).catch(() => {});
          }
        }
      }
    } catch {}
  } else {
    await fs.promises.mkdir(folder, { recursive: true });
  }

  const writeData = async (data: any, file: string) => {
    const filePath = path.join(folder, fixFileName(file));
    const mutex = getAtomicFileLock(filePath);
    return mutex.runExclusive(async () => {
      await atomicWriteJsonFile(filePath, data, BufferJSON.replacer);
    });
  };

  const readData = async (file: string) => {
    try {
      const filePath = path.join(folder, fixFileName(file));
      const mutex = getAtomicFileLock(filePath);
      return await mutex.runExclusive(async () => {
        const raw = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
        return JSON.parse(raw, BufferJSON.reviver);
      });
    } catch {
      return null;
    }
  };

  const removeData = async (file: string) => {
    try {
      const filePath = path.join(folder, fixFileName(file));
      const mutex = getAtomicFileLock(filePath);
      return await mutex.runExclusive(async () => {
        await fs.promises.unlink(filePath).catch(() => {});
      });
    } catch {}
  };

  const creds = (await readData('creds.json')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: Record<string, any> = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}.json`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data: Record<string, Record<string, any>>) => {
          const tasks: Promise<any>[] = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const file = `${category}-${id}.json`;
              tasks.push(value ? writeData(value, file) : removeData(file));
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: async () => {
      return writeData(creds, 'creds.json');
    }
  };
}

// ============================================================================
// RE-ENTRANT PER-PHONE OUTBOUND SERIALIZATION LOCK
// Ensures two outbound messages to the same recipient NEVER race Signal ratchets.
// Nested calls inside an already-locked turn execute immediately (zero deadlock).
// ============================================================================

const outboundLockStorage = new AsyncLocalStorage<Set<string>>();
const phoneLockTails = new Map<string, Promise<void>>();

export async function withPhoneOutboundLock<T>(
  rawKey: string,
  task: () => Promise<T>
): Promise<T> {
  const key = String(rawKey || '').trim();
  if (!key) {
    return task();
  }

  const held = outboundLockStorage.getStore();
  if (held && held.has(key)) {
    return task();
  }

  const prevTail = phoneLockTails.get(key) || Promise.resolve();
  let releaseTail!: () => void;
  const currentTail = new Promise<void>((resolve) => {
    releaseTail = resolve;
  });
  const chainedTail = prevTail.catch(() => {}).then(() => currentTail);
  phoneLockTails.set(key, chainedTail);

  try {
    await prevTail.catch(() => {});
    const nextHeld = new Set<string>(held ? Array.from(held) : []);
    nextHeld.add(key);
    return await outboundLockStorage.run(nextHeld, task);
  } finally {
    releaseTail();
    if (phoneLockTails.get(key) === chainedTail) {
      phoneLockTails.delete(key);
    }
  }
}

// ============================================================================
// MESSAGE TYPE & MEDIA TYPE HELPERS (Matches WA Web & Baileys wire schema)
// ============================================================================

export function resolveWireMediaType(message: any): string {
  const m = normalizeMessageContent(message) || message || {};
  if (m.imageMessage) return 'image';
  if (m.videoMessage) return m.videoMessage.gifPlayback ? 'gif' : 'video';
  if (m.audioMessage) return m.audioMessage.ptt ? 'ptt' : 'audio';
  if (m.contactMessage) return 'vcard';
  if (m.documentMessage) return 'document';
  if (m.contactsArrayMessage) return 'contact_array';
  if (m.liveLocationMessage) return 'livelocation';
  if (m.stickerMessage) return 'sticker';
  if (m.listMessage) return 'list';
  if (m.listResponseMessage) return 'list_response';
  if (m.buttonsResponseMessage) return 'buttons_response';
  if (m.orderMessage) return 'order';
  if (m.productMessage) return 'product';
  if (m.interactiveResponseMessage) return 'native_flow_response';
  if (m.groupInviteMessage) return 'url';
  return '';
}

export function resolveWireMessageType(message: any): string {
  const m = normalizeMessageContent(message);
  if (!m) return 'text';
  if (m.reactionMessage || m.encReactionMessage) return 'reaction';
  if (
    m.pollCreationMessage ||
    m.pollCreationMessageV2 ||
    m.pollCreationMessageV3 ||
    m.pollUpdateMessage
  ) {
    return 'poll';
  }
  if (m.eventMessage) return 'event';
  if (resolveWireMediaType(m) !== '') return 'media';
  return 'text';
}

// ============================================================================
// BIDIRECTIONAL SIGNAL SESSION RESOLUTION & CLEANUP (PN + LID)
// ============================================================================

export interface AltJidResolver {
  getLidForPhoneDigits?: (phoneDigits: string) => string | undefined;
  getPhoneDigitsForLid?: (lidDigits: string) => string | undefined;
}

export async function collectEquivalentDeviceJids(
  jid: string,
  signalRepository: any,
  altResolver?: AltJidResolver
): Promise<string[]> {
  const candidates = new Set<string>();
  if (!jid) return [];
  candidates.add(jid);

  const decoded = jidDecode(jid);
  const device = decoded?.device;
  const user = decoded?.user || '';
  const lidMapping = signalRepository?.lidMapping;

  const isLid = Boolean(isLidUser(jid) || isHostedLidUser(jid));
  const isPn = Boolean(isPnUser(jid) || isHostedPnUser(jid));

  const applyDevice = (targetBaseJid: string, serverOverride?: JidServer) => {
    const td = jidDecode(targetBaseJid);
    if (!td?.user) return;
    const srv: JidServer = serverOverride || (td.server as JidServer);
    const encoded = jidEncode(td.user, srv, typeof device === 'number' ? device : undefined);
    candidates.add(encoded);
  };

  if (isPn) {
    const barePn = `${user}@${decoded?.server === 'hosted' ? 'hosted' : 's.whatsapp.net'}`;
    try {
      const mappedLid = await Promise.resolve(lidMapping?.getLIDForPN?.(barePn)).catch(() => null);
      if (mappedLid && typeof mappedLid === 'string') {
        applyDevice(mappedLid);
      }
    } catch {}
    const cachedLidDigits = altResolver?.getLidForPhoneDigits?.(user);
    if (cachedLidDigits) {
      applyDevice(`${cachedLidDigits}@lid`, decoded?.server === 'hosted' ? 'hosted.lid' : 'lid');
    }
  } else if (isLid) {
    const bareLid = `${user}@${decoded?.server === 'hosted.lid' ? 'hosted.lid' : 'lid'}`;
    try {
      const mappedPn = await Promise.resolve(lidMapping?.getPNForLID?.(bareLid)).catch(() => null);
      if (mappedPn && typeof mappedPn === 'string') {
        applyDevice(mappedPn);
      }
    } catch {}
    const cachedPhoneDigits = altResolver?.getPhoneDigitsForLid?.(user);
    if (cachedPhoneDigits) {
      applyDevice(`${cachedPhoneDigits}@s.whatsapp.net`, decoded?.server === 'hosted.lid' ? 'hosted' : 's.whatsapp.net');
    }
  }

  return Array.from(candidates);
}

export async function clearSignalSessionsForParticipant(
  jid: string,
  signalRepository: any,
  keysStore: any,
  altResolver?: AltJidResolver
): Promise<string[]> {
  if (!jid || !signalRepository) return [];
  const allJids = await collectEquivalentDeviceJids(jid, signalRepository, altResolver);
  const sessionDeletes: Record<string, null> = {};
  const clearedAddrs: string[] = [];

  for (const cand of allJids) {
    try {
      const addrStr = String(signalRepository.jidToSignalProtocolAddress(cand));
      if (addrStr && !(addrStr in sessionDeletes)) {
        sessionDeletes[addrStr] = null;
        clearedAddrs.push(addrStr);
      }
    } catch {}
  }

  try {
    if (typeof signalRepository.deleteSession === 'function' && allJids.length > 0) {
      await signalRepository.deleteSession(allJids);
    }
  } catch {}

  try {
    if (keysStore && typeof keysStore.set === 'function' && Object.keys(sessionDeletes).length > 0) {
      await keysStore.set({ session: sessionDeletes });
    }
  } catch {}

  return clearedAddrs;
}

// ============================================================================
// DETERMINISTIC 1:1 RETRY STANZA SENDER
// Fixes BOTH Baileys bugs:
//   1. `sendMessagesAgain` (`sendToAll` on primary phone device 0 -> wipes <keys> bundle & omits `count`)
//   2. `relayMessage` (`isGroupOrStatus=false` -> encrypts TWICE & emits <participants> + <enc count>)
// ============================================================================

export interface DeterministicRetryStanzaParams {
  sock: any;
  authState: { creds: any; keys: any };
  signalRepository: any;
  msgId: string;
  destinationJid: string;
  participantJid: string;
  retryCount: number;
  protoMsg: any;
}

export async function sendDeterministic1on1RetryStanza(
  params: DeterministicRetryStanzaParams
): Promise<{ encType: string; toJid: string; msgId: string; retryCount: number }> {
  const {
    sock,
    authState,
    signalRepository,
    msgId,
    destinationJid,
    participantJid,
    retryCount,
    protoMsg
  } = params;

  const meId = authState.creds?.me?.id;
  const meLid = authState.creds?.me?.lid;
  if (!meId) {
    throw new Error('Cannot send retry stanza: socket not authenticated');
  }

  const isParticipantLid = Boolean(isLidUser(participantJid) || isHostedLidUser(participantJid));
  const selfIdentity = isParticipantLid ? (meLid || meId) : meId;
  const isMe =
    areJidsSameUser(participantJid, selfIdentity) ||
    areJidsSameUser(participantJid, meId) ||
    (meLid ? areJidsSameUser(participantJid, meLid) : false);

  const payloadObj = isMe
    ? {
        deviceSentMessage: {
          destinationJid,
          message: protoMsg
        },
        messageContextInfo: protoMsg?.messageContextInfo
      }
    : protoMsg;

  const encodedBytes = encodeWAMessage(payloadObj);
  const mediaType = resolveWireMediaType(protoMsg);
  const msgType = resolveWireMessageType(protoMsg);

  let encType = 'msg';
  let ciphertext: Uint8Array | Buffer;

  await authState.keys.transaction(async () => {
    const encrypted = await signalRepository.encryptMessage({
      data: encodedBytes,
      jid: participantJid
    });
    encType = encrypted.type;
    ciphertext = encrypted.ciphertext;

    const encAttrs: Record<string, string> = {
      v: '2',
      type: encType,
      count: String(Math.max(1, retryCount || 1))
    };
    if (mediaType) {
      encAttrs.mediatype = mediaType;
    }

    const content: any[] = [
      {
        tag: 'enc',
        attrs: encAttrs,
        content: ciphertext
      }
    ];

    if (authState.creds?.account) {
      content.push({
        tag: 'device-identity',
        attrs: {},
        content: encodeSignedDeviceIdentity(authState.creds.account, true)
      });
    }

    const stanzaAttrs: Record<string, string> = {
      id: msgId,
      to: participantJid,
      type: msgType,
      device_fanout: 'false'
    };
    if (isMe) {
      stanzaAttrs.recipient = destinationJid;
    }

    await sock.sendNode({
      tag: 'message',
      attrs: stanzaAttrs,
      content
    });
  }, meId);

  return {
    encType,
    toJid: participantJid,
    msgId,
    retryCount
  };
}

// ============================================================================
// UNIFIED BAILEYS E2EE RELIABILITY CONTROLLER
// Combines:
//   1. Pre-transmit proto persistence inside relayMessage (0ms race window)
//   2. PN-fallback assertSessions (fixes Baileys silent drop of unmapped PNs)
//   3. Self-healing encryptMessage (retries once on session error instead of dropping)
//   4. Verified-session outbound pre-flight (guarantees clean X3DH pkmsg on unverified phones)
//   5. Deterministic CB:receipt retry router & CB:ack 479 recovery
// ============================================================================

export interface InstallE2eeLayerOptions {
  sock: any;
  authState: { creds: any; keys: any };
  sessionId: string;
  userDevicesCache?: any;
  maxMsgRetryCount?: number;
  recordProto: (msgId: string, protoMsg: any) => void;
  lookupProto: (msgId: string) => any;
  resolveCleanPhone: (jid: string) => string | null;
  prepareRecipientAddressing?: (cleanPhone: string) => Promise<void>;
  altResolver?: AltJidResolver;
  onDiagnostic?: (entry: {
    remoteJid: string;
    resolvedPhone?: string | null;
    hasMessage: boolean;
    status: string;
  }) => void;
}

export interface WaE2eeController {
  ensureOutboundSessionReady: (targetJid: string, cleanPhone: string) => Promise<void>;
  markPhoneHealthy: (cleanPhone: string) => void;
  invalidatePhone: (cleanPhone: string) => void;
  isPhoneHealthy: (cleanPhone: string) => boolean;
}

export function installWhatsAppE2eeReliabilityLayer(
  opts: InstallE2eeLayerOptions
): WaE2eeController {
  const {
    sock,
    authState,
    userDevicesCache,
    maxMsgRetryCount = 8,
    recordProto,
    lookupProto,
    resolveCleanPhone,
    prepareRecipientAddressing,
    altResolver,
    onDiagnostic
  } = opts;

  const verifiedHealthyPhones = new Set<string>();
  const retryCounts = new Map<string, number>();
  const retryMutex = new Mutex();
  const autoHealed479MsgIds = new Set<string>();
  const inFlightEncryptHeals = new Map<string, Promise<boolean>>();

  const emitDiag = (
    remoteJid: string,
    hasMessage: boolean,
    status: string,
    resolvedPhone?: string | null
  ) => {
    try {
      onDiagnostic?.({
        remoteJid,
        resolvedPhone: resolvedPhone !== undefined ? resolvedPhone : resolveCleanPhone(remoteJid),
        hasMessage,
        status: status.slice(0, 160)
      });
    } catch {}
  };

  const invalidateUserDevicesCacheFor = async (jidOrPhone: string) => {
    if (!userDevicesCache) return;
    const rawUser = String(jidOrPhone || '').split('@')[0].split(':')[0].trim();
    const keysToDel = new Set<string>();
    if (rawUser) keysToDel.add(rawUser);
    const mappedLid = altResolver?.getLidForPhoneDigits?.(rawUser);
    if (mappedLid) keysToDel.add(mappedLid);
    const mappedPn = altResolver?.getPhoneDigitsForLid?.(rawUser);
    if (mappedPn) keysToDel.add(mappedPn);

    for (const k of keysToDel) {
      try {
        if (typeof userDevicesCache.del === 'function') {
          await Promise.resolve(userDevicesCache.del(k));
        }
      } catch {}
    }
  };

  // --------------------------------------------------------------------------
  // 1. Pre-transmit relayMessage persistence hook (0ms race window)
  // --------------------------------------------------------------------------
  const origRelayMessage = sock.relayMessage?.bind(sock);
  if (typeof origRelayMessage === 'function') {
    sock.relayMessage = async (jid: string, message: any, relayOpts: any = {}) => {
      const meId = authState.creds?.me?.id;
      const resolvedId = relayOpts?.messageId || (meId ? generateMessageIDV2(meId) : undefined);
      if (resolvedId && message) {
        try {
          recordProto(resolvedId, message);
        } catch {}
      }
      const nextOpts = resolvedId && !relayOpts?.messageId
        ? { ...relayOpts, messageId: resolvedId }
        : relayOpts;
      return origRelayMessage(jid, message, nextOpts);
    };
  }

  // --------------------------------------------------------------------------
  // 2. Hardened assertSessions (fixes Baileys' wireJids drop of unmapped PNs)
  // --------------------------------------------------------------------------
  const origAssertSessions = sock.assertSessions?.bind(sock);
  const signalRepository = sock.signalRepository;

  const hardenedAssertSessions = async (jids: string[], force = false): Promise<boolean> => {
    const uniqueJids = Array.from(new Set((jids || []).filter(Boolean)));
    if (uniqueJids.length === 0) return false;

    let didFetch = false;
    if (typeof origAssertSessions === 'function') {
      try {
        didFetch = Boolean(await origAssertSessions(uniqueJids, force));
      } catch {}
    }

    if (!signalRepository || typeof sock.query !== 'function') {
      return didFetch;
    }

    const remainingWireJids: string[] = [];
    for (const jid of uniqueJids) {
      const isPn = Boolean(isPnUser(jid) || isHostedPnUser(jid));
      if (isPn) {
        let mappedLid: string | null = null;
        try {
          mappedLid = await Promise.resolve(signalRepository.lidMapping?.getLIDForPN?.(jid)).catch(() => null);
        } catch {}
        if (!mappedLid) {
          // origAssertSessions dropped this PN from wireJids! Fetch directly by PN JID.
          remainingWireJids.push(jid);
          continue;
        }
      }
      try {
        const val = await signalRepository.validateSession(jid);
        if (!val?.exists) {
          remainingWireJids.push(jid);
        }
      } catch {
        remainingWireJids.push(jid);
      }
    }

    if (remainingWireJids.length > 0) {
      try {
        const result = await sock.query({
          tag: 'iq',
          attrs: {
            xmlns: 'encrypt',
            type: 'get',
            to: S_WHATSAPP_NET
          },
          content: [
            {
              tag: 'key',
              attrs: {},
              content: remainingWireJids.map((jid) => {
                const attrs: Record<string, string> = { jid };
                if (force) attrs.reason = 'identity';
                return { tag: 'user', attrs };
              })
            }
          ]
        });
        await parseAndInjectE2ESessions(result, signalRepository);
        didFetch = true;
        emitDiag(remainingWireJids[0], true, `e2ee_assert_pn_fallback_ok:${remainingWireJids.length}`);
      } catch (err: any) {
        emitDiag(
          remainingWireJids[0],
          false,
          `e2ee_assert_fallback_err:${String(err?.message || err).slice(0, 80)}`
        );
      }
    }

    return didFetch;
  };

  if (typeof sock.assertSessions === 'function') {
    sock.assertSessions = hardenedAssertSessions;
  }

  // --------------------------------------------------------------------------
  // 3. Self-healing signalRepository.encryptMessage wrapper
  // Fixes Baileys' `createParticipantNodes` silently dropping recipients on encrypt throw
  // --------------------------------------------------------------------------
  if (signalRepository && typeof signalRepository.encryptMessage === 'function') {
    const origEncryptMessage = signalRepository.encryptMessage.bind(signalRepository);
    signalRepository.encryptMessage = async (encOpts: { jid: string; data: Uint8Array | Buffer }) => {
      try {
        return await origEncryptMessage(encOpts);
      } catch (firstErr: any) {
        const targetJid = String(encOpts?.jid || '');
        const errMsg = String(firstErr?.message || firstErr || '');
        emitDiag(targetJid, false, `e2ee_encrypt_heal_trigger:${errMsg.slice(0, 70)}`);

        let healPromise = inFlightEncryptHeals.get(targetJid);
        if (!healPromise) {
          healPromise = (async () => {
            try {
              await clearSignalSessionsForParticipant(
                targetJid,
                signalRepository,
                authState.keys,
                altResolver
              );
              await hardenedAssertSessions([targetJid], true);
              return true;
            } catch {
              return false;
            } finally {
              inFlightEncryptHeals.delete(targetJid);
            }
          })();
          inFlightEncryptHeals.set(targetJid, healPromise);
        }

        await healPromise;
        return await origEncryptMessage(encOpts);
      }
    };
  }

  // --------------------------------------------------------------------------
  // 4. Verified-Healthy-Session Pre-Flight Gate (Prevention before Audio #1!)
  // --------------------------------------------------------------------------
  const ensureOutboundSessionReady = async (targetJid: string, cleanPhone: string) => {
    if (!cleanPhone || !targetJid) return;
    if (verifiedHealthyPhones.has(cleanPhone)) {
      return;
    }

    try {
      if (prepareRecipientAddressing) {
        await Promise.race([
          prepareRecipientAddressing(cleanPhone),
          new Promise<void>((r) => setTimeout(r, 3000))
        ]).catch(() => {});
      }

      const mappedLidDigits = altResolver?.getLidForPhoneDigits?.(cleanPhone);
      const lookupJid = mappedLidDigits ? `${mappedLidDigits}@lid` : targetJid;

      await invalidateUserDevicesCacheFor(cleanPhone);
      if (mappedLidDigits) {
        await invalidateUserDevicesCacheFor(mappedLidDigits);
      }

      let recipientDeviceJids: string[] = [];
      if (typeof sock.getUSyncDevices === 'function') {
        try {
          const devices = await Promise.race([
            sock.getUSyncDevices([lookupJid], false, false),
            new Promise<any[]>((r) => setTimeout(() => r([]), 4500))
          ]);
          const meId = authState.creds?.me?.id || '';
          const meLid = authState.creds?.me?.lid || '';
          const mePnUser = meId ? jidDecode(meId)?.user : '';
          const meLidUser = meLid ? jidDecode(meLid)?.user : '';
          const targetLidUser = mappedLidDigits || '';

          if (Array.isArray(devices) && devices.length > 0) {
            const picked: string[] = [];
            for (const d of devices) {
              const dJid = String(d?.jid || '').trim();
              if (!dJid) continue;
              if (dJid === meId || (meLid && dJid === meLid)) continue;
              const dUser = String(d?.user || jidDecode(dJid)?.user || '');
              const isSelfLine = Boolean(
                (mePnUser && dUser === mePnUser) || (meLidUser && dUser === meLidUser)
              );
              const isSelfChatTarget = Boolean(
                (mePnUser && cleanPhone === mePnUser) || (meLidUser && cleanPhone === meLidUser)
              );
              // Include all target recipient devices (PN or newly-discovered LID) or own companion devices for Self-Chat
              if (isSelfChatTarget ? isSelfLine : !isSelfLine) {
                picked.push(dJid);
              }
            }
            recipientDeviceJids = Array.from(new Set(picked));
          }
        } catch {}
      }

      if (recipientDeviceJids.length === 0) {
        recipientDeviceJids = [lookupJid];
      }

      // Fresh X3DH PreKey initialization for every unverified recipient device:
      // Clears any potentially lagging restored ratchet and asserts fresh server keys
      // so the very first Audio #1 is encrypted as a synchronized pkmsg + device-identity.
      for (const devJid of recipientDeviceJids) {
        await clearSignalSessionsForParticipant(
          devJid,
          signalRepository,
          authState.keys,
          altResolver
        );
      }

      await hardenedAssertSessions(recipientDeviceJids, true);
      emitDiag(lookupJid, true, `e2ee_preflight_verified:${recipientDeviceJids.length}`, cleanPhone);
    } catch (err: any) {
      emitDiag(
        targetJid,
        false,
        `e2ee_preflight_warn:${String(err?.message || err).slice(0, 80)}`,
        cleanPhone
      );
    }
  };

  // --------------------------------------------------------------------------
  // 5. Deterministic Retry Receipt Handler (Replaces Baileys' broken flow on ws)
  // --------------------------------------------------------------------------
  const ws = sock.ws;
  if (ws && typeof ws.listeners === 'function' && typeof ws.on === 'function') {
    const origReceiptListeners = (ws.listeners('CB:receipt') as Array<(...args: any[]) => any>).slice();
    if (typeof ws.removeAllListeners === 'function') {
      ws.removeAllListeners('CB:receipt');
    }

    const sendRetryAckSafely = async (node: any) => {
      try {
        const meId = authState.creds?.me?.id;
        if (typeof sock.sendNode === 'function') {
          await sock.sendNode(buildAckStanza(node, undefined, meId));
        }
      } catch {}
    };

    const handleDeterministicRetryReceipt = async (node: any) => {
      const attrs = node?.attrs || {};
      const from = String(attrs.from || '');
      const participant = String(attrs.participant || from);
      const isLid = from.includes('lid');
      const isNodeFromMe = areJidsSameUser(
        attrs.participant || from,
        isLid ? authState.creds?.me?.lid : authState.creds?.me?.id
      );
      const rawRemoteJid = !isNodeFromMe || isJidGroup(from) ? from : String(attrs.recipient || from);
      const remoteJid =
        isJidGroup(rawRemoteJid) || isJidStatusBroadcast(rawRemoteJid)
          ? rawRemoteJid
          : jidNormalizedUser(rawRemoteJid) || rawRemoteJid;
      const fromMeAttr = !attrs.recipient || ((attrs.type === 'retry' || attrs.type === 'sender') && isNodeFromMe);

      const ids: string[] = [String(attrs.id || '')].filter(Boolean);
      if (Array.isArray(node?.content)) {
        for (const item of getBinaryNodeChildren(node.content[0], 'item')) {
          if (item?.attrs?.id) ids.push(String(item.attrs.id));
        }
      }

      const retryNode = getBinaryNodeChild(node, 'retry');
      const retryCount = Math.max(1, Number(retryNode?.attrs?.count || 1) || 1);
      const cleanPhone = resolveCleanPhone(participant) || resolveCleanPhone(remoteJid);
      if (cleanPhone) {
        verifiedHealthyPhones.delete(cleanPhone);
      }

      const executeRetry = async () => {
        if (!ids[0] || !participant) return;

        // Resolve cached messages BEFORE deciding whether this belongs to our outbound queue
        const resolvedMsgs: Array<{ id: string; msg: any }> = [];
        for (const id of ids) {
          let found = lookupProto(id);
          if (!found && sock.messageRetryManager) {
            const cached = sock.messageRetryManager.getRecentMessage?.(remoteJid, id);
            if (cached?.message) found = cached.message;
          }
          if (found) {
            resolvedMsgs.push({ id, msg: found });
          }
        }

        if (!fromMeAttr && resolvedMsgs.length === 0) {
          emitDiag(participant, false, `e2ee_retry_ignored_not_from_me:${ids[0]}`, cleanPhone);
          return;
        }

        if (resolvedMsgs.length === 0) {
          emitDiag(participant, false, `e2ee_retry_missing_proto:${ids[0]}`, cleanPhone);
          return;
        }

        // Single increment per receipt (Baileys had double-increment bug!)
        const attemptKey = `${ids[0]}:${participant}`;
        const prevAttempts = retryCounts.get(attemptKey) || 0;
        if (prevAttempts >= maxMsgRetryCount) {
          emitDiag(participant, false, `e2ee_retry_max_reached:${ids[0]}:${prevAttempts}`, cleanPhone);
          return;
        }
        retryCounts.set(attemptKey, prevAttempts + 1);

        // Extract recipient <keys> bundle BEFORE clearing stale sessions
        const bundle = extractE2ESessionFromRetryReceipt(node);

        // Clear BOTH PN and mapped LID Signal sessions so no orphaned ratchet blocks re-encryption
        await clearSignalSessionsForParticipant(
          participant,
          signalRepository,
          authState.keys,
          altResolver
        );
        await invalidateUserDevicesCacheFor(participant);

        let sessionSource: 'bundle' | 'assert' = 'assert';
        if (bundle) {
          try {
            await signalRepository.injectE2ESession({
              jid: participant,
              session: bundle
            });
            sessionSource = 'bundle';
          } catch {
            // If bundle injection failed, fall back cleanly to fresh key assertion
            await hardenedAssertSessions([participant], true);
            sessionSource = 'assert';
          }
        } else {
          // CRITICAL: Do NOT wait for retry #2 — immediately assert fresh server PreKeys on retry #1!
          await hardenedAssertSessions([participant], true);
          sessionSource = 'assert';
        }

        const isGroupOrStatus = Boolean(isJidGroup(remoteJid) || isJidStatusBroadcast(remoteJid));

        for (const { id, msg } of resolvedMsgs) {
          if (!isGroupOrStatus) {
            const sentInfo = await sendDeterministic1on1RetryStanza({
              sock,
              authState,
              signalRepository,
              msgId: id,
              destinationJid: remoteJid,
              participantJid: participant,
              retryCount,
              protoMsg: msg
            });
            emitDiag(
              participant,
              true,
              `e2ee_retry_resent_1on1:${sentInfo.encType}:src=${sessionSource}:c=${retryCount}:${id}`,
              cleanPhone
            );
          } else if (typeof origRelayMessage === 'function') {
            await origRelayMessage(remoteJid, msg, {
              messageId: id,
              participant: { jid: participant, count: retryCount }
            });
            emitDiag(
              participant,
              true,
              `e2ee_retry_resent_group:src=${sessionSource}:c=${retryCount}:${id}`,
              cleanPhone
            );
          }

          if (sock.messageRetryManager) {
            try {
              sock.messageRetryManager.markRetrySuccess?.(id);
            } catch {}
          }
        }
      };

      try {
        await retryMutex.runExclusive(async () => {
          if (cleanPhone) {
            await withPhoneOutboundLock(cleanPhone, executeRetry);
          } else {
            await executeRetry();
          }
        });
      } catch (retryErr: any) {
        emitDiag(
          participant,
          false,
          `e2ee_retry_error:${String(retryErr?.message || retryErr).slice(0, 90)}`,
          cleanPhone
        );
      } finally {
        await sendRetryAckSafely(node);
      }
    };

    ws.on('CB:receipt', async (node: any) => {
      const rType = node?.attrs?.type;
      if (rType === 'retry') {
        await handleDeterministicRetryReceipt(node);
        return;
      }

      // Delivery / Read receipts confirm this recipient decrypted/received our message
      if (!rType || rType === 'read' || rType === 'read-self') {
        const from = String(node?.attrs?.participant || node?.attrs?.from || '');
        const ph = resolveCleanPhone(from);
        if (ph) {
          verifiedHealthyPhones.add(ph);
        }
      }

      for (const listener of origReceiptListeners) {
        try {
          await listener(node);
        } catch {}
      }
    });

    // ------------------------------------------------------------------------
    // 6. Enhanced CB:ack,class:message Error Recovery (e.g., 479 SMAX_INVALID)
    // ------------------------------------------------------------------------
    ws.on('CB:ack,class:message', (node: any) => {
      const attrs = node?.attrs || {};
      const errCode = String(attrs.error || '').trim();
      if (!errCode) return;

      const ackFrom = String(attrs.from || '');
      const msgId = String(attrs.id || '');
      const cleanPhone = resolveCleanPhone(ackFrom);
      if (cleanPhone) {
        verifiedHealthyPhones.delete(cleanPhone);
      }

      if ((errCode === '479' || errCode === '421' || errCode === '406') && msgId && !autoHealed479MsgIds.has(msgId)) {
        autoHealed479MsgIds.add(msgId);
        const protoMsg = lookupProto(msgId);
        if (protoMsg && ackFrom) {
          const targetBareJid = jidNormalizedUser(ackFrom);
          void withPhoneOutboundLock(cleanPhone || targetBareJid, async () => {
            try {
              await invalidateUserDevicesCacheFor(targetBareJid);
              await clearSignalSessionsForParticipant(
                targetBareJid,
                signalRepository,
                authState.keys,
                altResolver
              );
              await hardenedAssertSessions([targetBareJid], true);
              await sendDeterministic1on1RetryStanza({
                sock,
                authState,
                signalRepository,
                msgId,
                destinationJid: targetBareJid,
                participantJid: targetBareJid,
                retryCount: 1,
                protoMsg
              });
              emitDiag(targetBareJid, true, `e2ee_ack_${errCode}_auto_healed:${msgId}`, cleanPhone);
            } catch (healErr: any) {
              emitDiag(
                targetBareJid,
                false,
                `e2ee_ack_${errCode}_heal_err:${String(healErr?.message || healErr).slice(0, 80)}`,
                cleanPhone
              );
            }
          });
        }
      }
    });
  }

  return {
    ensureOutboundSessionReady,
    markPhoneHealthy: (cleanPhone: string) => {
      if (cleanPhone) verifiedHealthyPhones.add(cleanPhone);
    },
    invalidatePhone: (cleanPhone: string) => {
      if (cleanPhone) verifiedHealthyPhones.delete(cleanPhone);
    },
    isPhoneHealthy: (cleanPhone: string) => Boolean(cleanPhone && verifiedHealthyPhones.has(cleanPhone))
  };
}
