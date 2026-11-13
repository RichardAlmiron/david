import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Order, ProductPage } from '../../src/types.ts';
import {
  buildExpressCheckoutUrl,
  buildUniversalProductKnowledgePrompt,
  computeMetaAdCommentStats,
  createDefaultMetaCommentsState,
  detectParaguayPhonesInText,
  generateCommentAndDmAiResponses,
  linkOrderToMetaCommentThread,
  loadMetaCommentsState,
  processInboundMessengerDm,
  processInboundMetaComment,
  resolveProductForCommentContext,
  sendMetaMessengerMessage,
  setMetaCommentsStateFileOverrideForTest,
  syncMetaAdPostsAndComments
} from '../metaCommentsEngine.ts';
import { auditMetaTokenAndPermissions, COMMENT_MESSAGING_META_SCOPES } from '../metaAuthSession.ts';

const SAMPLE_PRODUCTS: ProductPage[] = [
  {
    id: 'prod-proyector-01',
    nombre: 'Noelux™ Proyector Navideño 12 Diseños',
    descripcion: 'Proyector LED láser exterior resistente a lluvia con 12 placas intercambiables.',
    imagen: 'https://cdn.example.com/proyector.jpg',
    slug: 'noelux-proyector-navideno-12-disenos',
    precioNormal: 249000,
    precios: { 1: 189000, 2: 358000, 3: 507000 },
    wa: '595981111222',
    activo: true,
    freeShipping: true,
    creadoEn: '2026-11-01T00:00:00Z',
    agentBrain: {
      trainedAt: '2026-11-01T00:00:00Z',
      version: 1,
      shortProductSpoken: 'Proyector láser exterior IP65 con 12 placas',
      productCategoryLabel: 'Iluminación Navideña',
      technicalSpecsSpoken: 'Resistente a lluvia IP65, enchufe directo, alcance 50m2',
      boxContentsSpoken: 'Proyector, estaca de jardín, 12 tarjetas y control',
      usageSummarySpoken: 'Enchufar y apuntar a la fachada en 15 segundos',
      powerAndResistanceSpoken: 'Cable sellado exterior',
      warrantySpoken: '7 días de garantía contra defectos',
      upsellPack2Enabled: true,
      upsellPack2PriceGs: 358000,
      upsellPack2PitchSpoken: 'Pack 2x ahorra Gs. 20.000',
      postConfirmationProductAngles: [],
      faqQuickAnswers: [
        { topic: 'Lluvia', keywords: ['lluvia', 'agua'], answerSpoken: 'Es impermeable IP65 para patio' }
      ]
    }
  },
  {
    id: 'prod-lumbar-02',
    nombre: 'Soporte Lumbar Ortopédico Pro',
    descripcion: 'Faja ergonómica magnética para alivio lumbar inmediato.',
    imagen: 'https://cdn.example.com/lumbar.jpg',
    slug: 'soporte-lumbar-ortopedico-pro',
    precioNormal: 190000,
    precios: { 1: 149000, 2: 269000, 3: 375000 },
    wa: '595981333444',
    activo: true,
    freeShipping: true,
    creadoEn: '2026-11-02T00:00:00Z'
  }
];

function setupIsolatedCommentsFile(): string {
  const tmpFile = path.join(
    os.tmpdir(),
    `meta_comments_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.json`
  );
  setMetaCommentsStateFileOverrideForTest(tmpFile);
  return tmpFile;
}

function teardownIsolatedCommentsFile(tmpFile: string) {
  setMetaCommentsStateFileOverrideForTest(null);
  try {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  } catch {}
}

test('detectParaguayPhonesInText detecta móviles locales e ignora precios Gs.', () => {
  const text = 'Hola! Sale 189.000 o pack 2x 358.000? Pasame info al 0981 456 789 o +595 971-222-333 porfa';
  const phones = detectParaguayPhonesInText(text);
  assert.deepEqual(phones, ['595981456789', '595971222333']);

  const priceOnly = detectParaguayPhonesInText('Cuesta 189.000 guaraníes o 507.000 en 3 cuotas');
  assert.deepEqual(priceOnly, []);
});

test('resolveProductForCommentContext y buildUniversalProductKnowledgePrompt funcionan para cualquier producto', () => {
  const defaultState = createDefaultMetaCommentsState(SAMPLE_PRODUCTS);
  defaultState.config.campaignProductMap['camp_99'] = {
    productId: 'prod-lumbar-02',
    productSlug: 'soporte-lumbar-ortopedico-pro',
    productName: 'Soporte Lumbar Ortopédico Pro'
  };

  // 1. Por mapeo explícito de campaña
  const resolvedByCamp = resolveProductForCommentContext({
    products: SAMPLE_PRODUCTS,
    config: defaultState.config,
    campaignId: 'camp_99',
    commentText: 'Quiero comprar uno'
  });
  assert.equal(resolvedByCamp?.id, 'prod-lumbar-02');

  // 2. Por detección semántica en comentario
  const resolvedByComment = resolveProductForCommentContext({
    products: SAMPLE_PRODUCTS,
    config: defaultState.config,
    commentText: 'Me interesa el soporte lumbar para espalda'
  });
  assert.equal(resolvedByComment?.id, 'prod-lumbar-02');

  // 3. Prompt universal incluye precios exactos en Gs. y verdad del producto
  const promptText = buildUniversalProductKnowledgePrompt(SAMPLE_PRODUCTS[1]);
  assert.ok(promptText.includes('Soporte Lumbar Ortopédico Pro'));
  assert.ok(promptText.includes('149.000'));
  assert.ok(promptText.includes('269.000'));
  assert.ok(promptText.includes('ENVÍO GRATIS'));
});

test('generateCommentAndDmAiResponses exige OPENROUTER_API_KEY real sin fallback falso', async () => {
  await assert.rejects(
    async () =>
      await generateCommentAndDmAiResponses({
        openRouterApiKey: '',
        product: SAMPLE_PRODUCTS[0],
        authorName: 'Juan Pérez',
        commentText: 'Precio?',
        detectedPhones: [],
        expressFormUrl: 'https://noelux.shop/?express=noelux-proyector-navideno-12-disenos'
      }),
    /OPENROUTER_API_KEY/
  );
});

test('Flujo completo: Comentario con teléfono -> OpenRouter IA -> Ocultar Meta -> Respuesta Pública -> Messenger Button Express', async () => {
  const tmpFile = setupIsolatedCommentsFile();
  try {
    const graphCalls: Array<{ url: string; body: any }> = [];

    const mockFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : null;

      if (url.includes('openrouter.ai/api/v1/chat/completions')) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent: 'phone_drop',
                    publicReply:
                      '¡Hola Juan! Por seguridad ocultamos tu número, ya te escribimos al Messenger con la promo Envío Gratis.',
                    privateDm:
                      '¡Hola Juan! El Proyector Navideño 12 Diseños está Gs. 189.000 (1x) o Pack 2x Gs. 358.000 con Envío GRATIS y pago al recibir.',
                    whatsappMessage: 'Hola Juan! Te escribimos por tu comentario.',
                    shouldHideComment: true
                  })
                }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      graphCalls.push({ url, body: parsedBody });
      if (url.includes('/messages')) {
        return new Response(
          JSON.stringify({ recipient_id: 'psid_juan_77', message_id: 'mid_999' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/comments')) {
        return new Response(JSON.stringify({ id: 'reply_pub_88' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as any;

    const res = await processInboundMetaComment({
      commentId: 'c_meta_1001',
      postId: '1050835598123904_555',
      pageId: '1050835598123904',
      authorId: 'user_55',
      authorName: 'Juan Carlos',
      commentText: 'Quiero pedir! Pasame info al 0981 999 888',
      adId: 'ad_777',
      adName: 'Anuncio #3 · Video Casa Iluminada',
      campaignId: 'camp_100',
      campaignName: '[META IA] Proyector COD',
      products: SAMPLE_PRODUCTS,
      openRouterApiKey: 'sk-or-test-1234',
      pageAccessToken: 'EAA_PAGE_TEST_TOKEN',
      publicBaseUrl: 'https://mi-tienda.up.railway.app',
      executeMetaActions: true,
      isSimulation: false,
      fetchImpl: mockFetch
    });

    assert.equal(res.createdNew, true);
    assert.equal(res.thread.hiddenFromPublic, true);
    assert.equal(res.thread.psid, 'psid_juan_77');
    assert.deepEqual(res.thread.detectedPhones, ['595981999888']);
    assert.ok(res.thread.expressFormUrl?.includes('?express=noelux-proyector-navideno-12-disenos'));
    assert.ok(res.thread.expressFormUrl?.includes('ad_id=ad_777'));
    assert.ok(res.actionsTaken.includes('comment_hidden_live'));
    assert.ok(res.actionsTaken.includes('public_reply_sent_live'));
    assert.ok(res.actionsTaken.includes('messenger_dm_sent_live_button_template_webview'));

    // Verificar llamadas exactas a Meta Graph API
    const hideCall = graphCalls.find((c) => c.url.includes('/c_meta_1001?'));
    assert.equal(hideCall?.body?.is_hidden, true);

    const dmCall = graphCalls.find((c) => c.url.includes('/messages'));
    assert.equal(dmCall?.body?.recipient?.comment_id, 'c_meta_1001');
    assert.equal(dmCall?.body?.message?.attachment?.payload?.template_type, 'button');
    assert.equal(dmCall?.body?.message?.attachment?.payload?.buttons?.[0]?.type, 'web_url');
    assert.equal(
      dmCall?.body?.message?.attachment?.payload?.buttons?.[0]?.webview_height_ratio,
      'tall'
    );
  } finally {
    teardownIsolatedCommentsFile(tmpFile);
  }
});

test('sendMetaMessengerMessage hace fallback automático a texto con link si Meta rechaza Template en Private Reply', async () => {
  let attempt = 0;
  const mockFetch: typeof fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    attempt += 1;
    const body = JSON.parse(String(init?.body || '{}'));
    if (attempt === 1) {
      assert.equal(body?.message?.attachment?.type, 'template');
      return new Response(
        JSON.stringify({ error: { message: 'Unsupported template type for private reply' } }),
        { status: 400 }
      );
    }
    assert.ok(String(body?.message?.text || '').includes('?express=soporte-lumbar'));
    return new Response(JSON.stringify({ message_id: 'mid_fallback_1', recipient_id: 'psid_2' }), {
      status: 200
    });
  }) as any;

  const out = await sendMetaMessengerMessage({
    pageId: '1050835598123904',
    pageAccessToken: 'EAA_PAGE_OK',
    text: '¡Hola! Acá podés pedir rápido:',
    expressUrl: 'https://mi-tienda.up.railway.app/?express=soporte-lumbar',
    commentId: 'c_123',
    fetchImpl: mockFetch
  });

  assert.equal(out.ok, true);
  assert.equal(out.modeUsed, 'text_with_express_link');
  assert.equal(attempt, 2);
});

test('Ranking de Anuncios & Cierre en Tarjeta del Producto: atribuye pedido e identifica Anuncio Ganador', async () => {
  const tmpFile = setupIsolatedCommentsFile();
  try {
    const mockOpenRouter: typeof fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  intent: 'buy_now',
                  publicReply: '¡Te escribí por privado!',
                  privateDm: 'Te dejo el link Express',
                  shouldHideComment: false
                })
              }
            }
          ]
        }),
        { status: 200 }
      )) as any;

    const t1 = await processInboundMetaComment({
      commentId: 'c_ad1',
      postId: 'post_ad1',
      pageId: '1050835598123904',
      authorName: 'Lucía',
      commentText: 'Precio?',
      adId: 'ad_001',
      adName: 'Anuncio #1',
      campaignId: 'camp_1',
      products: SAMPLE_PRODUCTS,
      openRouterApiKey: 'sk-test',
      isSimulation: true,
      fetchImpl: mockOpenRouter
    });

    const t2 = await processInboundMetaComment({
      commentId: 'c_ad2',
      postId: 'post_ad2',
      pageId: '1050835598123904',
      authorName: 'Marcos',
      commentText: 'Quiero 2 unidades en Luque 0981222333',
      adId: 'ad_002',
      adName: 'Anuncio #2 · Ganador',
      campaignId: 'camp_1',
      products: SAMPLE_PRODUCTS,
      openRouterApiKey: 'sk-test',
      isSimulation: true,
      fetchImpl: mockOpenRouter
    });

    const closedOrder: Order = {
      reservaid: 'MC-WINNER1',
      producto: SAMPLE_PRODUCTS[0].nombre,
      productoId: SAMPLE_PRODUCTS[0].id,
      nombre: 'Marcos',
      celular: '595981222333',
      departamento: 'Central',
      ciudad: 'Luque',
      direccion: 'Centro',
      detalle: 'Efectivo al recibir',
      cantidad: 2,
      monto: 358000,
      ref_code: null,
      estado: 'reservado',
      metaCommentOrigin: {
        source: 'meta_comment_ai',
        channel: 'express_form',
        adId: 'ad_002',
        adName: 'Anuncio #2 · Ganador',
        adIndex: 2,
        campaignId: 'camp_1',
        postId: 'post_ad2',
        commentId: t2.thread.commentId,
        threadId: t2.thread.id,
        commentText: t2.thread.commentText,
        authorName: 'Marcos'
      }
    };

    const linked = linkOrderToMetaCommentThread({ order: closedOrder, products: SAMPLE_PRODUCTS });
    assert.equal(linked.linked, true);
    assert.equal(linked.threadId, t2.thread.id);

    const state = loadMetaCommentsState(SAMPLE_PRODUCTS);
    assert.equal(state.threads.find((t) => t.id === t1.thread.id)?.status, 'form_sent');
    assert.equal(state.threads.find((t) => t.id === t2.thread.id)?.status, 'order_closed');

    const stats = computeMetaAdCommentStats(state, [closedOrder]);
    assert.equal(stats[0].adId, 'ad_002');
    assert.equal(stats[0].isWinner, true);
    assert.equal(stats[0].closedOrdersCount, 1);
    assert.equal(stats[0].revenuePyg, 358000);
    assert.equal(stats[0].conversionRatePct, 100);
  } finally {
    teardownIsolatedCommentsFile(tmpFile);
  }
});

test('processInboundMessengerDm continúa conversación y extrae pedido completo del chat', async () => {
  const tmpFile = setupIsolatedCommentsFile();
  try {
    const mockFetch: typeof fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  replyText: '¡Perfecto Marcos! Ya registré tus datos para enviarte el Pack 2x a San Lorenzo.',
                  shouldSendExpressButton: false,
                  extractedOrder: {
                    ready: true,
                    nombre: 'Marcos Vera',
                    whatsapp: '0981444555',
                    ciudad: 'San Lorenzo',
                    direccion: 'Ruta 2 Km 14',
                    pack: 2
                  }
                })
              }
            }
          ]
        }),
        { status: 200 }
      )) as any;

    const dmOut = await processInboundMessengerDm({
      senderPsid: 'psid_marcos_88',
      recipientPageId: '1050835598123904',
      messageText: 'Quiero 2 unidades, soy Marcos Vera 0981444555, San Lorenzo Ruta 2 Km 14',
      referralAdId: 'ad_002',
      products: SAMPLE_PRODUCTS,
      openRouterApiKey: 'sk-test',
      isSimulation: true,
      fetchImpl: mockFetch
    });

    assert.equal(dmOut.extractedOrder?.ready, true);
    assert.equal(dmOut.extractedOrder?.pack, 2);
    assert.ok(dmOut.thread.messages.length >= 2);
  } finally {
    teardownIsolatedCommentsFile(tmpFile);
  }
});

test('syncMetaAdPostsAndComments sincroniza posts de Ads y audita permisos Messenger/Comentarios', async () => {
  const tmpFile = setupIsolatedCommentsFile();
  try {
    const mockSyncFetch: typeof fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/me/accounts')) {
        return new Response(
          JSON.stringify({
            data: [{ id: '1050835598123904', name: 'Landingcod Shop', access_token: 'EAA_PAGE_LIVE' }]
          }),
          { status: 200 }
        );
      }
      if (url.includes('/ads?')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'ad_live_5',
                name: 'Anuncio #5',
                campaign: { id: 'camp_live_1', name: 'Campaña Live' },
                creative: { effective_object_story_id: '1050835598123904_9001' }
              }
            ]
          }),
          { status: 200 }
        );
      }
      if (url.includes('/promotable_posts')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      if (url.includes('/comments?')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'c_live_1',
                message: 'Precio por favor?',
                from: { id: 'cust_1', name: 'Sofía' }
              },
              {
                id: 'c_own_page',
                message: '¡Ya te escribimos!',
                from: { id: '1050835598123904', name: 'Landingcod Shop' }
              }
            ]
          }),
          { status: 200 }
        );
      }
      if (url.includes('openrouter.ai')) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent: 'price_inquiry',
                    publicReply: '¡Hola Sofía! Ya te pasé la promo al Messenger.',
                    privateDm: 'El precio es Gs. 189.000 con envío gratis.',
                    shouldHideComment: false
                  })
                }
              }
            ]
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ id: 'ok_1', message_id: 'mid_1' }), { status: 200 });
    }) as any;

    const syncRes = await syncMetaAdPostsAndComments({
      userAccessToken: 'EAA_USER_LIVE_123456',
      products: SAMPLE_PRODUCTS,
      openRouterApiKey: 'sk-test',
      fetchImpl: mockSyncFetch
    });

    assert.equal(syncRes.ok, true);
    assert.equal(syncRes.adsMapped, 1);
    // Solo el comentario de Sofía (ignora el propio comentario de la página para cero bucles)
    assert.equal(syncRes.commentsFound, 1);
    assert.equal(syncRes.newCommentsProcessed, 1);
  } finally {
    teardownIsolatedCommentsFile(tmpFile);
  }
});

test('auditMetaTokenAndPermissions detecta scopes de comentarios y Messenger sin romper Meta Ads', async () => {
  const mockAuthFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/me?')) {
      return new Response(JSON.stringify({ id: 'u1', name: 'Richard' }), { status: 200 });
    }
    if (url.includes('/me/permissions')) {
      return new Response(
        JSON.stringify({
          data: [
            { permission: 'ads_management', status: 'granted' },
            { permission: 'ads_read', status: 'granted' },
            { permission: 'pages_show_list', status: 'granted' },
            { permission: 'pages_read_engagement', status: 'granted' },
            { permission: 'business_management', status: 'granted' },
            { permission: 'pages_manage_engagement', status: 'granted' },
            { permission: 'pages_messaging', status: 'declined' }
          ]
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  }) as any;

  assert.deepEqual(COMMENT_MESSAGING_META_SCOPES, ['pages_manage_engagement', 'pages_messaging']);
  const audit = await auditMetaTokenAndPermissions({
    accessToken: 'EAA_VALID_TOKEN_MIN_30_CHARS_123456',
    fetchImpl: mockAuthFetch
  });

  assert.equal(audit.tokenValid, true);
  assert.equal(audit.hasAdsManagement, true);
  assert.deepEqual(audit.missingPermissions, []);
  assert.equal(audit.commentsPermissionsReady, false);
  assert.deepEqual(audit.missingCommentPermissions, ['pages_messaging']);
});

test('Integración UI AdminView y App Express Checkout', () => {
  const adminSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/views/AdminView.tsx'), 'utf-8');
  const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');

  assert.ok(adminSrc.includes('sidebar-menu-comentarios'), 'Debe existir menú Comentarios Ads en Sidebar');
  assert.ok(adminSrc.includes('<MetaCommentsView'), 'AdminView debe renderizar MetaCommentsView');
  assert.ok(adminSrc.includes('isFromMetaComment'), 'Pedidos del producto deben distinguir origen Meta Comment');
  assert.ok(adminSrc.includes('meta-comment-order-badge-'), 'Tarjeta distinta debe tener badge de Anuncio/Chat');
  assert.ok(appSrc.includes('express-checkout-shell'), 'App.tsx debe renderizar vista directa Express (?express=)');
  assert.ok(appSrc.includes('<OrderForm expressDirectMode />'), 'Express debe montar OrderForm directo sin landing completa');

  const url = buildExpressCheckoutUrl({
    baseUrl: 'https://test.shop',
    productSlug: 'mi-prod',
    adId: 'ad123',
    commentId: 'c456'
  });
  assert.ok(url.startsWith('https://test.shop/?express=mi-prod'));
  assert.ok(url.includes('ad_id=ad123'));
});
