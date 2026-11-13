import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { proto } from '@whiskeysockets/baileys';
import {
  createAtomicMultiFileAuthState,
  withPhoneOutboundLock,
  clearSignalSessionsForParticipant,
  sendDeterministic1on1RetryStanza,
  installWhatsAppE2eeReliabilityLayer
} from '../waE2eeReliability';

function createMockSocket() {
  const ws = new EventEmitter();
  const sentNodes: any[] = [];
  const iqQueries: any[] = [];
  const deletedSessions: string[] = [];
  const injectedSessions: any[] = [];
  const keySets: any[] = [];
  const origReceiptCalls: any[] = [];

  const creds: any = {
    me: { id: '595981000001:1@s.whatsapp.net', lid: '111111111:1@lid' },
    account: {
      details: Buffer.from([1, 2, 3]),
      accountSignatureKey: Buffer.alloc(32, 7),
      accountSignature: Buffer.alloc(64, 8),
      deviceSignature: Buffer.alloc(64, 9)
    }
  };

  const keys = {
    async get() {
      return {};
    },
    async set(data: any) {
      keySets.push(data);
    },
    async transaction(fn: () => Promise<any>) {
      return await fn();
    }
  };

  const signalRepository: any = {
    lidMapping: {
      async getLIDForPN(pn: string) {
        if (pn.startsWith('595981222333')) return '999888777@lid';
        return null;
      },
      async getPNForLID(lid: string) {
        if (lid.startsWith('999888777')) return '595981222333@s.whatsapp.net';
        return null;
      },
      async getLIDsForPNs() {
        // Simulate Baileys returning null / empty when PN is unmapped in cache
        return null;
      }
    },
    jidToSignalProtocolAddress(jid: string) {
      const userPart = jid.split('@')[0];
      const user = userPart.split(':')[0];
      const dev = userPart.includes(':') ? userPart.split(':')[1] : '0';
      return jid.endsWith('lid') ? `${user}_1.${dev}` : `${user}.${dev}`;
    },
    async validateSession() {
      return { exists: false };
    },
    async deleteSession(jids: string[]) {
      deletedSessions.push(...jids);
    },
    async injectE2ESession(arg: any) {
      injectedSessions.push(arg);
    },
    async encryptMessage({ jid }: { jid: string; data: Uint8Array }) {
      return {
        type: injectedSessions.some(s => s.jid === jid) ? 'pkmsg' : 'msg',
        ciphertext: Buffer.from(`enc:${jid}`)
      };
    }
  };

  ws.on('CB:receipt', (node: any) => {
    origReceiptCalls.push(node);
  });

  const userDevicesCacheStore = new Map<string, any>();
  const userDevicesCache = {
    get: (k: string) => userDevicesCacheStore.get(k),
    set: (k: string, v: any) => userDevicesCacheStore.set(k, v),
    del: (k: string) => userDevicesCacheStore.delete(k)
  };

  const sock: any = {
    ws,
    user: { id: creds.me.id, lid: creds.me.lid },
    signalRepository,
    assertSessionsCalls: [] as Array<{ jids: string[]; force: boolean }>,
    getUSyncDevicesCalls: [] as Array<{ jids: string[]; useCache: boolean }>,
    async assertSessions(jids: string[], force = false) {
      sock.assertSessionsCalls.push({ jids, force });
      return false;
    },
    async getUSyncDevices(jids: string[], useCache: boolean) {
      sock.getUSyncDevicesCalls.push({ jids, useCache });
      return [{ user: '999888777', device: 0, jid: '999888777@lid' }];
    },
    async query(iq: any) {
      iqQueries.push(iq);
      // Minimal valid <iq type="result"><list/></iq>
      return { tag: 'iq', attrs: { type: 'result' }, content: [{ tag: 'list', attrs: {}, content: [] }] };
    },
    async sendNode(stanza: any) {
      sentNodes.push(stanza);
    },
    async relayMessage(jid: string, message: any, opts: any = {}) {
      sentNodes.push({ relayed: true, jid, message, opts });
      return opts.messageId || 'GEN-ID';
    }
  };

  return {
    sock,
    ws,
    creds,
    keys,
    signalRepository,
    userDevicesCache,
    sentNodes,
    iqQueries,
    deletedSessions,
    injectedSessions,
    keySets,
    origReceiptCalls
  };
}

test('createAtomicMultiFileAuthState atomically writes, cleans stale temps, and persists BufferJSON cleanly', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-atomic-auth-'));
  try {
    const staleTmp = path.join(dir, 'session-123.json.tmp.999.1');
    fs.writeFileSync(staleTmp, 'partial', 'utf-8');
    const pastTime = new Date(Date.now() - 120_000);
    fs.utimesSync(staleTmp, pastTime, pastTime);

    const { state, saveCreds } = await createAtomicMultiFileAuthState(dir);
    assert.equal(fs.existsSync(staleTmp), false, 'Stale temp file should be cleaned on open');
    assert.ok(state.creds?.registrationId);

    const bufVal = Buffer.from([10, 20, 30, 40]);
    await state.keys.set({
      session: { '595981222333.0': { keyData: bufVal } }
    });
    await saveCreds();

    const loaded = await state.keys.get('session', ['595981222333.0']);
    assert.ok(loaded['595981222333.0']);
    assert.deepEqual(Buffer.from(loaded['595981222333.0'].keyData), bufVal);

    const remainingFiles = fs.readdirSync(dir);
    assert.equal(
      remainingFiles.some(f => f.includes('.tmp.')),
      false,
      'No temp files should remain after atomic writes'
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('withPhoneOutboundLock serializes concurrent calls on the same phone and supports re-entrant nesting without deadlock', async () => {
  const events: string[] = [];

  const first = withPhoneOutboundLock('595981222333', async () => {
    events.push('first:start');
    await new Promise(r => setTimeout(r, 30));
    await withPhoneOutboundLock('595981222333', async () => {
      events.push('first:nested');
    });
    events.push('first:end');
  });

  const second = withPhoneOutboundLock('595981222333', async () => {
    events.push('second:start');
    events.push('second:end');
  });

  await Promise.all([first, second]);
  assert.deepEqual(events, [
    'first:start',
    'first:nested',
    'first:end',
    'second:start',
    'second:end'
  ]);
});

test('relayMessage hook persists proto BEFORE transmission and assertSessions falls back when getLIDsForPNs drops PN', async () => {
  const m = createMockSocket();
  const protoCache = new Map<string, any>();
  let cachePresentDuringRelay = false;

  const origRelay = m.sock.relayMessage.bind(m.sock);
  m.sock.relayMessage = async (jid: string, message: any, opts: any = {}) => {
    cachePresentDuringRelay = protoCache.has(opts.messageId);
    return origRelay(jid, message, opts);
  };

  installWhatsAppE2eeReliabilityLayer({
    sock: m.sock,
    authState: { creds: m.creds, keys: m.keys },
    sessionId: 'wa-test',
    userDevicesCache: m.userDevicesCache,
    recordProto: (id, msg) => protoCache.set(id, msg),
    lookupProto: (id) => protoCache.get(id),
    resolveCleanPhone: (jid) => jid.replace(/\D/g, '')
  });

  const audioProto = proto.Message.fromObject({
    audioMessage: { ptt: true, mimetype: 'audio/ogg; codecs=opus', seconds: 12 }
  });
  await m.sock.relayMessage('595981999888@s.whatsapp.net', audioProto, { messageId: 'AUDIO-PRE-1' });
  assert.equal(cachePresentDuringRelay, true, 'Proto MUST be cached before origRelayMessage executes');

  // Unmapped PN '595981999888@s.whatsapp.net' should trigger explicit IQ query in hardened assertSessions
  await m.sock.assertSessions(['595981999888@s.whatsapp.net'], true);
  assert.equal(m.iqQueries.length, 1);
  assert.equal(m.iqQueries[0].attrs.xmlns, 'encrypt');
  assert.equal(m.iqQueries[0].content[0].content[0].attrs.jid, '595981999888@s.whatsapp.net');
  assert.equal(m.iqQueries[0].content[0].content[0].attrs.reason, 'identity');
});

test('signalRepository.encryptMessage self-heals on missing session instead of silently dropping participant', async () => {
  const m = createMockSocket();
  let failOnce = true;
  m.signalRepository.encryptMessage = async ({ jid }: { jid: string }) => {
    if (failOnce) {
      failOnce = false;
      throw new Error('No open session');
    }
    return { type: 'pkmsg', ciphertext: Buffer.from(`healed:${jid}`) };
  };

  installWhatsAppE2eeReliabilityLayer({
    sock: m.sock,
    authState: { creds: m.creds, keys: m.keys },
    sessionId: 'wa-test',
    userDevicesCache: m.userDevicesCache,
    recordProto: () => {},
    lookupProto: () => undefined,
    resolveCleanPhone: () => '595981222333'
  });

  const res = await m.signalRepository.encryptMessage({
    jid: '595981222333@s.whatsapp.net',
    data: Buffer.from('hello')
  });
  assert.equal(res.type, 'pkmsg');
  assert.ok(
    m.deletedSessions.includes('595981222333@s.whatsapp.net') &&
    m.deletedSessions.includes('999888777@lid'),
    'Both PN and mapped LID sessions must be cleared on encrypt heal'
  );
  assert.equal(m.sock.assertSessionsCalls.length, 1);
  assert.equal(m.sock.assertSessionsCalls[0].force, true);
});

test('deterministic CB:receipt retry handler preserves <keys> bundle on device 0, sends single encrypted stanza WITH count & device-identity, and never double-encrypts', async () => {
  const m = createMockSocket();
  const protoCache = new Map<string, any>();
  const audioProto = proto.Message.fromObject({
    audioMessage: { ptt: true, mimetype: 'audio/ogg; codecs=opus', seconds: 9 }
  });
  protoCache.set('MSG-AUDIO-1', audioProto);

  let encryptCount = 0;
  const origEncrypt = m.signalRepository.encryptMessage.bind(m.signalRepository);
  m.signalRepository.encryptMessage = async (arg: any) => {
    encryptCount++;
    return origEncrypt(arg);
  };

  const controller = installWhatsAppE2eeReliabilityLayer({
    sock: m.sock,
    authState: { creds: m.creds, keys: m.keys },
    sessionId: 'wa-test',
    userDevicesCache: m.userDevicesCache,
    recordProto: (id, msg) => protoCache.set(id, msg),
    lookupProto: (id) => protoCache.get(id),
    resolveCleanPhone: (jid) => (jid.includes('999888777') || jid.includes('595981222333') ? '595981222333' : null)
  });

  controller.markPhoneHealthy('595981222333');
  assert.equal(controller.isPhoneHealthy('595981222333'), true);

  // Simulate Retry Receipt with <keys> bundle from customer's primary phone (no device / device 0)
  const retryReceiptStanza = {
    tag: 'receipt',
    attrs: {
      id: 'MSG-AUDIO-1',
      from: '999888777@lid',
      type: 'retry'
    },
    content: [
      { tag: 'retry', attrs: { count: '1', id: 'MSG-AUDIO-1', t: '1700000000' } },
      { tag: 'registration', attrs: {}, content: Buffer.from([0, 0, 1, 2]) },
      {
        tag: 'keys',
        attrs: {},
        content: [
          { tag: 'type', attrs: {}, content: Buffer.from([5]) },
          { tag: 'identity', attrs: {}, content: Buffer.alloc(32, 3) },
          {
            tag: 'skey',
            attrs: {},
            content: [
              { tag: 'id', attrs: {}, content: Buffer.from([0, 0, 1]) },
              { tag: 'value', attrs: {}, content: Buffer.alloc(32, 4) },
              { tag: 'signature', attrs: {}, content: Buffer.alloc(64, 5) }
            ]
          },
          {
            tag: 'key',
            attrs: {},
            content: [
              { tag: 'id', attrs: {}, content: Buffer.from([0, 0, 9]) },
              { tag: 'value', attrs: {}, content: Buffer.alloc(32, 6) }
            ]
          }
        ]
      }
    ]
  };

  for (const fn of m.ws.listeners('CB:receipt') as Array<(n: any) => Promise<void>>) {
    await fn(retryReceiptStanza);
  }

  assert.equal(m.origReceiptCalls.length, 0, 'Retry receipts must NOT invoke broken Baileys sendMessagesAgain listener');
  assert.equal(controller.isPhoneHealthy('595981222333'), false, 'Retry receipt must invalidate phone health');
  assert.equal(m.injectedSessions.length, 1, 'Retry <keys> bundle must be injected cleanly');
  assert.equal(m.sock.assertSessionsCalls.length, 0, 'assertSessions MUST NOT overwrite an injected retry <keys> bundle');
  assert.equal(m.sock.getUSyncDevicesCalls.length, 0, 'getUSyncDevices MUST NOT overwrite an injected retry <keys> bundle');
  assert.equal(encryptCount, 1, 'Retry stanza MUST encrypt exactly ONCE (no Baileys double-encryption)');

  const msgStanza = m.sentNodes.find(s => s.tag === 'message');
  const ackStanza = m.sentNodes.find(s => s.tag === 'ack');
  assert.ok(msgStanza, 'Clean retry <message> stanza must be transmitted');
  assert.ok(ackStanza, 'Retry <ack> stanza must be transmitted');
  assert.equal(msgStanza.attrs.id, 'MSG-AUDIO-1');
  assert.equal(msgStanza.attrs.to, '999888777@lid');
  assert.equal(msgStanza.attrs.device_fanout, 'false');
  assert.equal(msgStanza.attrs.type, 'media');

  const encChild = msgStanza.content.find((c: any) => c.tag === 'enc');
  const devIdChild = msgStanza.content.find((c: any) => c.tag === 'device-identity');
  const participantsChild = msgStanza.content.find((c: any) => c.tag === 'participants');
  assert.ok(encChild, 'Retry stanza must contain <enc>');
  assert.equal(encChild.attrs.count, '1');
  assert.equal(encChild.attrs.type, 'pkmsg');
  assert.equal(encChild.attrs.mediatype, 'ptt');
  assert.ok(devIdChild, 'Retry stanza must attach <device-identity>');
  assert.equal(participantsChild, undefined, '1:1 retry stanza must NOT emit colliding <participants>');
});

test('deterministic CB:receipt retry WITHOUT <keys> on Retry #1 immediately clears PN+LID sessions and fetches fresh PreKeys', async () => {
  const m = createMockSocket();
  const protoCache = new Map<string, any>();
  protoCache.set('MSG-NOKEYS-1', proto.Message.fromObject({ conversation: 'Hola' }));

  installWhatsAppE2eeReliabilityLayer({
    sock: m.sock,
    authState: { creds: m.creds, keys: m.keys },
    sessionId: 'wa-test',
    userDevicesCache: m.userDevicesCache,
    recordProto: (id, msg) => protoCache.set(id, msg),
    lookupProto: (id) => protoCache.get(id),
    resolveCleanPhone: () => '595981222333'
  });

  const retryWithoutKeys = {
    tag: 'receipt',
    attrs: {
      id: 'MSG-NOKEYS-1',
      from: '595981222333@s.whatsapp.net',
      type: 'retry'
    },
    content: [
      { tag: 'retry', attrs: { count: '1', id: 'MSG-NOKEYS-1', t: '1700000000' } }
    ]
  };

  for (const fn of m.ws.listeners('CB:receipt') as Array<(n: any) => Promise<void>>) {
    await fn(retryWithoutKeys);
  }

  assert.ok(
    m.deletedSessions.includes('595981222333@s.whatsapp.net') &&
    m.deletedSessions.includes('999888777@lid'),
    'Both PN and LID sessions must be cleared even on retry count=1 without bundle'
  );
  assert.equal(m.sock.assertSessionsCalls.length, 1);
  assert.equal(m.sock.assertSessionsCalls[0].force, true);

  const msgStanza = m.sentNodes.find(s => s.tag === 'message');
  assert.ok(msgStanza);
  assert.equal(msgStanza.content.find((c: any) => c.tag === 'enc')?.attrs?.count, '1');

  // Non-retry delivery receipt must pass through to Baileys original handler AND mark phone healthy
  const deliveryReceipt = {
    tag: 'receipt',
    attrs: { id: 'MSG-NOKEYS-1', from: '595981222333@s.whatsapp.net' }
  };
  for (const fn of m.ws.listeners('CB:receipt') as Array<(n: any) => Promise<void>>) {
    await fn(deliveryReceipt);
  }
  assert.equal(m.origReceiptCalls.length, 1);
});

test('sendDeterministic1on1RetryStanza handles Self-Chat companion retries properly with recipient attr and deviceSentMessage', async () => {
  const m = createMockSocket();
  let capturedPlaintextLen = 0;
  m.signalRepository.encryptMessage = async ({ data }: { data: Uint8Array }) => {
    capturedPlaintextLen = data.length;
    return { type: 'pkmsg', ciphertext: Buffer.from('self-retry-cipher') };
  };

  const audioProto = proto.Message.fromObject({
    audioMessage: { ptt: true, mimetype: 'audio/ogg; codecs=opus', seconds: 8 }
  });

  await sendDeterministic1on1RetryStanza({
    sock: m.sock,
    authState: { creds: m.creds, keys: m.keys },
    signalRepository: m.signalRepository,
    msgId: 'SELF-MSG-1',
    destinationJid: '111111111@lid',
    participantJid: '111111111:0@lid',
    retryCount: 2,
    protoMsg: audioProto
  });

  assert.ok(capturedPlaintextLen > 0);
  const stanza = m.sentNodes[0];
  assert.equal(stanza.attrs.to, '111111111:0@lid');
  assert.equal(stanza.attrs.recipient, '111111111@lid');
  assert.equal(stanza.content.find((c: any) => c.tag === 'enc')?.attrs?.count, '2');
});
