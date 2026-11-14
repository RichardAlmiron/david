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
  processInboundMetaComment,
  resolveProductForCommentContext,
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

test('Flujo completo 100% Comentario Público: Teléfono -> OpenRouter IA Multi-Ángulo -> Ocultar Meta -> Respuesta Pública (Cero DM)', async () => {
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
                    angleUsed: 'cero_riesgo_contra_entrega',
                    publicReply:
                      '¡Hola Juan! Por seguridad ocultamos tu número y te escribimos al WhatsApp. Lo mejor es que pagás recién al recibir en tu casa con Envío Gratis: https://mi-tienda.up.railway.app/?express=noelux-proyector-navideno-12-disenos',
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
      adSetId: 'adset_10',
      adSetName: 'Conjunto Público Abierto',
      adCopy: 'Transformá tu fachada en Navidad sin riesgo.',
      adThumbnailUrl: 'https://cdn.example.com/ad3.jpg',
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
    assert.equal(res.thread.angleUsed, 'cero_riesgo_contra_entrega');
    assert.equal(res.thread.adSetName, 'Conjunto Público Abierto');
    assert.equal(res.thread.adThumbnailUrl, 'https://cdn.example.com/ad3.jpg');
    assert.deepEqual(res.thread.detectedPhones, ['595981999888']);
    assert.ok(res.thread.expressFormUrl?.includes('?express=noelux-proyector-navideno-12-disenos'));
    assert.ok(res.thread.expressFormUrl?.includes('ad_id=ad_777'));
    assert.ok(res.actionsTaken.includes('comment_hidden_live'));
    assert.ok(res.actionsTaken.includes('public_reply_sent_live'));
    assert.equal(
      res.actionsTaken.some((a) => a.includes('messenger_dm')),
      false,
      'Messenger DM debe estar completamente descartado'
    );

    const hideCall = graphCalls.find((c) => c.url.includes('/c_meta_1001?'));
    assert.equal(hideCall?.body?.is_hidden, true);

    const dmCall = graphCalls.find((c) => c.url.includes('/messages'));
    assert.equal(dmCall, undefined, 'Nunca debe llamar a Messenger /messages');
  } finally {
    teardownIsolatedCommentsFile(tmpFile);
  }
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
    assert.equal(state.threads.find((t) => t.id === t1.thread.id)?.status, 'public_replied');
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

test('syncMetaAdPostsAndComments mapea activeAdsSnapshot, jerarquía completa y sub-comentarios', async () => {
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
                effective_status: 'ACTIVE',
                campaign: { id: 'camp_live_1', name: 'Campaña Live' },
                adset: { id: 'adset_live_1', name: 'Conjunto Central' },
                creative: {
                  effective_object_story_id: '1050835598123904_9001',
                  title: 'Solo hoy envío gratis',
                  body: 'Pagás al recibir en tu casa.',
                  thumbnail_url: 'https://cdn.example.com/ad5.jpg'
                }
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
                from: { id: 'cust_1', name: 'Sofía' },
                comments: {
                  data: [
                    {
                      id: 'c_sub_1',
                      message: 'Y cuánto tarda a Luque?',
                      from: { id: 'cust_2', name: 'Carlos' }
                    }
                  ]
                }
              },
              {
                id: 'c_own_page',
                message: '¡Hola! Te paso el detalle.',
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
                    angleUsed: 'precio_y_valor',
                    publicReply: '¡Hola! Sale Gs. 189.000 con envío gratis y pago al recibir.',
                    shouldHideComment: false
                  })
                }
              }
            ]
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ id: 'ok_1' }), { status: 200 });
    }) as any;

    const syncRes = await syncMetaAdPostsAndComments({
      userAccessToken: 'EAA_USER_LIVE_123456',
      products: SAMPLE_PRODUCTS,
      openRouterApiKey: 'sk-test',
      fetchImpl: mockSyncFetch
    });

    assert.equal(syncRes.ok, true);
    assert.equal(syncRes.adsMapped, 1);
    assert.equal(syncRes.commentsFound, 2);
    assert.equal(syncRes.newCommentsProcessed, 2);
    const savedState = loadMetaCommentsState(SAMPLE_PRODUCTS);
    assert.equal(savedState.config.activeAdsSnapshot?.length, 1);
    assert.equal(savedState.config.activeAdsSnapshot?.[0]?.adSetName, 'Conjunto Central');
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
