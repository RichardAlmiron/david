import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DISABLE_WA_AUTOCONNECT = 'true';

test('extractWireMessageTelemetry captures 1:1 & Self-Chat stanza metadata and skips groups/status', async () => {
  const { extractWireMessageTelemetry } = await import('../../server/whatsappEngine');

  const selfChatNode = {
    tag: 'message',
    attrs: {
      id: '3EB0PHONE123',
      from: '160602198675534:0@lid',
      recipient: '160602198675534@lid',
      type: 'text',
      category: '',
      offline: '0',
      addressing_mode: 'lid',
      sender_pn: '595973532550@s.whatsapp.net'
    },
    content: [{ tag: 'enc', attrs: { v: '2', type: 'msg' } }]
  };

  const telemetry = extractWireMessageTelemetry(selfChatNode);
  assert.ok(telemetry);
  assert.equal(telemetry.id, '3EB0PHONE123');
  assert.equal(telemetry.from, '160602198675534:0@lid');
  assert.equal(telemetry.recipient, '160602198675534@lid');
  assert.equal(telemetry.senderPn, '595973532550@s.whatsapp.net');
  assert.deepEqual(telemetry.encTypes, ['msg']);

  assert.equal(
    extractWireMessageTelemetry({ tag: 'message', attrs: { from: '120363000@g.us' } }),
    null
  );
  assert.equal(
    extractWireMessageTelemetry({ tag: 'message', attrs: { from: 'status@broadcast' } }),
    null
  );
  assert.equal(extractWireMessageTelemetry(null), null);
});

test('dedupePatchMessageBeforeSending preserves native proto shape unless duplicate JIDs exist', async () => {
  const { dedupePatchMessageBeforeSending } = await import('../../server/whatsappEngine');
  const protoMsg = { conversation: 'Hola' };

  // No duplicates -> preserves exact msg object (important for Baileys reportingMessage)
  assert.equal(dedupePatchMessageBeforeSending(protoMsg, ['595973532550@s.whatsapp.net']), protoMsg);
  assert.equal(dedupePatchMessageBeforeSending(protoMsg, []), protoMsg);

  // Duplicate JIDs in Self-Chat fanout -> deduplicates and wraps cleanly
  const patched = dedupePatchMessageBeforeSending(protoMsg, [
    '160602198675534:0@lid',
    '160602198675534:0@lid'
  ]);
  assert.deepEqual(patched, [{ recipientJid: '160602198675534:0@lid', message: protoMsg }]);
});

test('createBaileysDiagnosticLogger propagates child bindings and captures Signal/decrypt errors safely', async () => {
  const { createBaileysDiagnosticLogger } = await import('../../server/whatsappEngine');
  const captured: Array<{ level: string; msg: string; metaText: string; bindings: Record<string, any> }> = [];

  const rootLogger = createBaileysDiagnosticLogger((level, msg, metaText, bindings) => {
    captured.push({ level, msg, metaText, bindings });
  });

  // Noise debug/trace must be suppressed; unrelated info suppressed; important info forwarded
  rootLogger.trace({ jid: 'x' }, 'noisy trace');
  rootLogger.debug('noisy debug');
  rootLogger.info('unrelated info');
  rootLogger.info('opened connection to WA');
  assert.equal(captured.length, 1);
  assert.equal(captured[0].level, 'info');

  const child = rootLogger.child({ class: 'recv' });
  const circular: any = { jid: '160602198675534:0@lid', err: new Error('Key used already or never filled') };
  circular.self = circular;
  child.error(circular, 'failed to decrypt message');

  assert.equal(captured.length, 2);
  assert.equal(captured[1].level, 'error');
  assert.equal(captured[1].bindings.class, 'recv');
  assert.match(captured[1].msg, /failed to decrypt message/);
  assert.match(captured[1].metaText, /Key used already or never filled/);
  assert.match(captured[1].metaText, /160602198675534:0@lid/);
});

