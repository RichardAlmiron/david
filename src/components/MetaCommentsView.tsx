import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  Lock,
  MessageSquare,
  Phone,
  Power,
  RefreshCw,
  ShoppingBag,
  Trophy,
  X
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';
import type {
  MetaActiveAdSnapshot,
  MetaCommentAdStats,
  MetaCommentAutomationConfig,
  MetaCommentThreadRecord,
  ProductPage
} from '../types';

interface MetaCommentsViewProps {
  productPages: ProductPage[];
  showToast: (msg: string) => void;
  onJumpToProductOrder?: (productId: string, orderId?: string) => void;
}

interface UnifiedAdCard {
  key: string;
  adId: string;
  postId: string;
  adName: string;
  adIndex?: number;
  adSetName: string;
  campaignId: string;
  campaignName: string;
  adHeadline: string;
  adCopy: string;
  adThumbnailUrl: string;
  effectiveStatus: string;
  productId: string;
  productName: string;
  commentsCount: number;
  publicRepliesCount: number;
  phonesCapturedCount: number;
  closedOrdersCount: number;
  revenuePyg: number;
  conversionRatePct: number;
  isWinner: boolean;
  threads: MetaCommentThreadRecord[];
}

const ANGLE_LABELS: Record<string, string> = {
  precio_y_valor: 'Ángulo: Precio y Valor',
  cero_riesgo_contra_entrega: 'Ángulo: Cero Riesgo (Pagás al recibir)',
  prueba_social_vecinos: 'Ángulo: Prueba Social Real',
  facilidad_inmediata: 'Ángulo: Facilidad Inmediata',
  escasez_real_hoy: 'Ángulo: Cupos / Despacho Hoy',
  gancho_y_completo: 'Ángulo: Oferta de Entrada y Pack'
};

export const MetaCommentsView: React.FC<MetaCommentsViewProps> = ({
  productPages,
  showToast,
  onJumpToProductOrder
}) => {
  const { adminToken } = useStore();

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    return headers;
  }, [adminToken]);

  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [config, setConfig] = useState<MetaCommentAutomationConfig | null>(null);
  const [threads, setThreads] = useState<MetaCommentThreadRecord[]>([]);
  const [adStats, setAdStats] = useState<MetaCommentAdStats[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [autoPilotRunning, setAutoPilotRunning] = useState(false);

  const [hasOpenRouterKey, setHasOpenRouterKey] = useState(false);
  const [hasMetaToken, setHasMetaToken] = useState(false);
  const [commentsPermissionsReady, setCommentsPermissionsReady] = useState(false);
  const [missingCommentPermissions, setMissingCommentPermissions] = useState<string[]>([]);

  // Selección simple arriba: Producto + Campaña (opcional)
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [openAdKey, setOpenAdKey] = useState<string | null>(null);

  const fetchState = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/meta/comments/state', {
        method: 'GET',
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : undefined,
        credentials: 'include'
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        if (!silent) showToast(data?.error || 'Error cargando Comentarios Ads.');
        return;
      }
      setConfig(data.config);
      setThreads(Array.isArray(data.threads) ? data.threads : []);
      setAdStats(Array.isArray(data.adStats) ? data.adStats : []);
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
      setAutoPilotRunning(Boolean(data.autoPilotStatus?.running));
      setHasOpenRouterKey(Boolean(data.hasOpenRouterKey));
      setHasMetaToken(Boolean(data.hasMetaToken));
      setCommentsPermissionsReady(Boolean(data.commentsPermissionsReady));
      setMissingCommentPermissions(
        Array.isArray(data.missingCommentPermissions) ? data.missingCommentPermissions : []
      );

      if (!selectedProductId) {
        const defProd = data.config?.defaultProductId || productPages[0]?.id || '';
        if (defProd) setSelectedProductId(defProd);
      }
    } catch (err: any) {
      if (!silent) showToast(err?.message || 'Error de conexión.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchState(false);
    const iv = setInterval(() => {
      fetchState(true);
    }, 20000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!selectedProductId && productPages.length > 0) {
      setSelectedProductId(config?.defaultProductId || productPages[0].id);
    }
  }, [productPages, config?.defaultProductId]);

  const handleToggleAutoPilot = async () => {
    const nextEnabled = !config?.enabled;
    setActivating(true);
    try {
      const res = await fetch('/api/meta/comments/activate', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          enabled: nextEnabled,
          productId: selectedProductId || productPages[0]?.id,
          campaignId: selectedCampaignId !== 'all' ? selectedCampaignId : undefined,
          autoPollingSeconds: 25
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        showToast(data?.error || 'No se pudo cambiar el estado del piloto.');
        return;
      }
      setConfig(data.config);
      setThreads(Array.isArray(data.threads) ? data.threads : []);
      setAdStats(Array.isArray(data.adStats) ? data.adStats : []);
      setAutoPilotRunning(Boolean(data.autoPilotStatus?.running));
      showToast(
        nextEnabled
          ? 'Piloto 24/7 activado. Respondiendo comentarios públicos multi-ángulo cada 25s.'
          : 'Piloto automático pausado.'
      );
    } catch (err: any) {
      showToast(err?.message || 'Error activando piloto.');
    } finally {
      setActivating(false);
    }
  };

  const handleManualSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/meta/comments/sync', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ processWithAi: true })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        showToast(data?.error || 'No se pudieron sincronizar los anuncios.');
        return;
      }
      setThreads(Array.isArray(data.threads) ? data.threads : []);
      setAdStats(Array.isArray(data.adStats) ? data.adStats : []);
      if (data.config) setConfig(data.config);
      showToast(
        `${data.postsScanned || 0} anuncios revisados · ${data.newCommentsProcessed || 0} comentarios atendidos`
      );
    } catch (err: any) {
      showToast(err?.message || 'Error sincronizando anuncios.');
    } finally {
      setSyncing(false);
    }
  };

  const handleAssignProductToAd = async (card: UnifiedAdCard, newProductId: string) => {
    const prod = productPages.find((p) => p.id === newProductId);
    if (!prod) return;
    try {
      const res = await fetch('/api/meta/comments/map-product', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          adId: card.adId || undefined,
          postId: card.postId || undefined,
          campaignId: card.campaignId || undefined,
          productId: prod.id,
          productSlug: prod.slug
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setConfig(data.config);
        setThreads(data.threads || []);
        setAdStats(data.adStats || []);
        showToast(`Anuncio vinculado a ${prod.nombre}`);
      } else {
        showToast(data?.error || 'Error asignando producto.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error de conexión.');
    }
  };

  const handleToggleHideComment = async (thread: MetaCommentThreadRecord) => {
    try {
      const res = await fetch('/api/meta/comments/hide', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          threadId: thread.id,
          isHidden: !thread.hiddenFromPublic
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setThreads(data.threads || []);
        showToast(
          data.thread?.hiddenFromPublic
            ? 'Comentario con teléfono ocultado del público.'
            : 'Comentario visible públicamente.'
        );
      } else {
        showToast(data?.error || 'No se pudo cambiar la visibilidad.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error de red.');
    }
  };

  const handleAuthorizeMeta = async () => {
    try {
      const res = await fetch('/api/meta/auth-url', { credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (data?.authUrl) {
        window.open(data.authUrl, 'metaOAuthComments', 'width=620,height=720');
        showToast('Se abrió Facebook para autorizar permisos.');
      } else {
        showToast(data?.error || 'Configurá Meta App ID en AutoAds primero.');
      }
    } catch {
      showToast('Error abriendo autenticación de Facebook.');
    }
  };

  // Unificar Anuncios Activos (activeAdsSnapshot) + Estadísticas + Hilos recibidos
  const adCards = useMemo<UnifiedAdCard[]>(() => {
    const map = new Map<string, UnifiedAdCard>();
    const snapshots: MetaActiveAdSnapshot[] = Array.isArray(config?.activeAdsSnapshot)
      ? config!.activeAdsSnapshot!
      : [];

    for (const snap of snapshots) {
      const key = snap.adId || snap.postId;
      if (!key) continue;
      const matchedStat = adStats.find((s) => s.adId === snap.adId || s.postId === snap.postId);
      const prod =
        productPages.find((p) => p.id === snap.productId) ||
        productPages.find((p) => p.nombre === matchedStat?.productName) ||
        productPages.find((p) => p.id === config?.defaultProductId) ||
        productPages[0];
      map.set(key, {
        key,
        adId: snap.adId,
        postId: snap.postId || '',
        adName: snap.adName || 'Anuncio Meta',
        adIndex: snap.adIndex,
        adSetName: snap.adSetName || 'Conjunto de anuncios',
        campaignId: snap.campaignId || '',
        campaignName: snap.campaignName || 'Campaña Meta',
        adHeadline: snap.adHeadline || '',
        adCopy: snap.adCopy || '',
        adThumbnailUrl: snap.adThumbnailUrl || prod?.imagen || '',
        effectiveStatus: snap.effectiveStatus || 'ACTIVE',
        productId: snap.productId || prod?.id || '',
        productName: snap.productName || prod?.nombre || 'Producto Tienda',
        commentsCount: matchedStat?.commentsCount || 0,
        publicRepliesCount: 0,
        phonesCapturedCount: matchedStat?.phonesCapturedCount || 0,
        closedOrdersCount: matchedStat?.closedOrdersCount || 0,
        revenuePyg: matchedStat?.revenuePyg || 0,
        conversionRatePct: matchedStat?.conversionRatePct || 0,
        isWinner: Boolean(matchedStat?.isWinner),
        threads: []
      });
    }

    for (const stat of adStats) {
      const key = stat.adId || stat.postId || stat.adName;
      if (!map.has(key)) {
        const prod = productPages.find((p) => p.nombre === stat.productName) || productPages[0];
        map.set(key, {
          key,
          adId: stat.adId || '',
          postId: stat.postId || '',
          adName: stat.adName || 'Anuncio Meta',
          adIndex: stat.adIndex,
          adSetName: 'Conjunto activo',
          campaignId: stat.campaignId || '',
          campaignName: stat.campaignName || 'Campaña Meta',
          adHeadline: '',
          adCopy: '',
          adThumbnailUrl: prod?.imagen || '',
          effectiveStatus: 'ACTIVE',
          productId: prod?.id || '',
          productName: stat.productName || prod?.nombre || 'Producto Tienda',
          commentsCount: stat.commentsCount,
          publicRepliesCount: 0,
          phonesCapturedCount: stat.phonesCapturedCount,
          closedOrdersCount: stat.closedOrdersCount,
          revenuePyg: stat.revenuePyg,
          conversionRatePct: stat.conversionRatePct,
          isWinner: Boolean(stat.isWinner),
          threads: []
        });
      }
    }

    for (const th of threads) {
      const key = th.adId || th.postId || th.adName || 'sin_ad';
      let card = map.get(key);
      if (!card) {
        const prod =
          productPages.find((p) => p.id === th.productId) ||
          productPages.find((p) => p.slug === th.productSlug) ||
          productPages[0];
        card = {
          key,
          adId: th.adId || '',
          postId: th.postId || '',
          adName: th.adName || 'Anuncio Meta',
          adIndex: th.adIndex,
          adSetName: th.adSetName || 'Conjunto de anuncios',
          campaignId: th.campaignId || '',
          campaignName: th.campaignName || 'Campaña Meta',
          adHeadline: th.adHeadline || '',
          adCopy: th.adCopy || '',
          adThumbnailUrl: th.adThumbnailUrl || prod?.imagen || '',
          effectiveStatus: 'ACTIVE',
          productId: th.productId || prod?.id || '',
          productName: th.productName || prod?.nombre || 'Producto',
          commentsCount: 0,
          publicRepliesCount: 0,
          phonesCapturedCount: 0,
          closedOrdersCount: 0,
          revenuePyg: 0,
          conversionRatePct: 0,
          isWinner: false,
          threads: []
        };
        map.set(key, card);
      }
      card.threads.push(th);
      card.commentsCount = Math.max(card.commentsCount, card.threads.length);
      if (th.publicReplyText) card.publicRepliesCount += 1;
      if (!card.adCopy && th.adCopy) card.adCopy = th.adCopy;
      if (!card.adThumbnailUrl && th.adThumbnailUrl) card.adThumbnailUrl = th.adThumbnailUrl;
      if (th.adSetName && card.adSetName === 'Conjunto de anuncios') card.adSetName = th.adSetName;
    }

    let list = Array.from(map.values());
    if (selectedCampaignId !== 'all') {
      list = list.filter((c) => !c.campaignId || c.campaignId === selectedCampaignId);
    }

    return list.sort((a, b) => {
      if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
      if (b.closedOrdersCount !== a.closedOrdersCount) return b.closedOrdersCount - a.closedOrdersCount;
      return b.threads.length - a.threads.length;
    });
  }, [config, adStats, threads, productPages, selectedCampaignId]);

  const campaignOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of campaigns) {
      if (c?.metaCampaignId || c?.id) {
        map.set(String(c.metaCampaignId || c.id), String(c.campaignName || c.name || 'Campaña Meta'));
      }
    }
    for (const snap of config?.activeAdsSnapshot || []) {
      if (snap.campaignId) map.set(snap.campaignId, snap.campaignName || snap.campaignId);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [campaigns, config]);

  const selectedAdCard = useMemo(
    () => adCards.find((c) => c.key === openAdKey) || null,
    [adCards, openAdKey]
  );

  const totals = useMemo(() => {
    const totalComments = threads.length;
    const replied = threads.filter((t) => Boolean(t.publicReplyText)).length;
    const phones = threads.filter((t) => t.detectedPhones.length > 0).length;
    const orders = adCards.reduce((sum, c) => sum + c.closedOrdersCount, 0);
    return { totalComments, replied, phones, orders };
  }, [threads, adCards]);

  if (loading) {
    return (
      <div className="p-12 text-center text-zinc-400 text-sm">
        Cargando piloto de comentarios Meta Ads...
      </div>
    );
  }

  return (
    <div data-testid="meta-comments-view" className="max-w-7xl mx-auto space-y-6">
      {/* CABECERA HANDS-FREE: SELECTORES + ACTIVAR PILOTO 24/7 */}
      <section className="rounded-xl bg-[#0c0d12] border border-zinc-800 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white tracking-tight text-balance">
              Piloto Automático de Comentarios Meta Ads
            </h2>
            <p className="text-sm text-zinc-400">
              100% respuestas públicas multi-ángulo para generar avalancha social · Sin Messenger DM · Oculta teléfonos y dispara WhatsApp al instante.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {(!hasMetaToken || !commentsPermissionsReady) && (
              <button
                type="button"
                onClick={handleAuthorizeMeta}
                title={
                  missingCommentPermissions.length > 0
                    ? `Permisos faltantes: ${missingCommentPermissions.join(', ')}`
                    : 'Autorizar Meta Graph API'
                }
                className="px-3.5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Conectar Facebook</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleManualSyncNow}
              disabled={syncing}
              className="px-3.5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Leyendo Ads...' : 'Actualizar ahora'}</span>
            </button>

            <button
              type="button"
              data-testid="meta-comments-activate-btn"
              onClick={handleToggleAutoPilot}
              disabled={activating}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-60 ${
                config?.enabled
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-zinc-950'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>
                {activating
                  ? 'Aplicando...'
                  : config?.enabled
                  ? 'Piloto 24/7 Activo · Pausar'
                  : 'Activar Piloto 24/7'}
              </span>
            </button>
          </div>
        </div>

        {/* CONTROLES DE CONTEXTO Y ESTADO OPERATIVO */}
        <div className="pt-4 border-t border-zinc-800/80 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 block">
              Producto principal a cerrar en estos anuncios
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white"
            >
              {productPages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.tripwireConfig?.enabled ? `· Gancho: ${p.tripwireConfig.entryProductName}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 block">
              Filtrar por campaña Meta Ads
            </label>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white"
            >
              <option value="all">Todas las campañas activas</option>
              {campaignOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 text-xs text-zinc-400 md:text-right space-y-0.5 pb-1">
            <div className="font-semibold text-zinc-200">
              {config?.enabled && autoPilotRunning
                ? `Escucha activa cada ${config.autoPollingSeconds || 25}s`
                : 'Piloto en espera'}
            </div>
            <div>
              {hasOpenRouterKey ? 'OpenRouter IA listo' : 'Falta OPENROUTER_API_KEY'}
              {' · '}
              {config?.lastAutoPollAt
                ? `Último chequeo ${new Date(config.lastAutoPollAt).toLocaleTimeString('es-PY', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}`
                : 'Sin chequeo aún'}
            </div>
          </div>
        </div>

        {config?.lastAutoPollError && (
          <div className="text-xs text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded-lg px-3.5 py-2">
            Aviso Meta Sync: {config.lastAutoPollError}
          </div>
        )}
      </section>

      {/* MÉTRICAS TABULARES LIMPIAS */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-[#0c0d12] border border-zinc-800 px-4 py-3.5">
          <div className="text-xs text-zinc-400">Anuncios monitoreados</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums mt-1">
            {adCards.length}
          </div>
        </div>
        <div className="rounded-xl bg-[#0c0d12] border border-zinc-800 px-4 py-3.5">
          <div className="text-xs text-zinc-400">Respuestas públicas IA</div>
          <div className="text-2xl font-bold text-cyan-400 font-mono tabular-nums mt-1">
            {totals.replied}
            <span className="text-xs text-zinc-500 font-normal"> / {totals.totalComments}</span>
          </div>
        </div>
        <div className="rounded-xl bg-[#0c0d12] border border-zinc-800 px-4 py-3.5">
          <div className="text-xs text-zinc-400">Teléfonos protegidos → WA</div>
          <div className="text-2xl font-bold text-amber-300 font-mono tabular-nums mt-1">
            {totals.phones}
          </div>
        </div>
        <div className="rounded-xl bg-[#0c0d12] border border-zinc-800 px-4 py-3.5">
          <div className="text-xs text-zinc-400">Pedidos atribuidos</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums mt-1">
            {totals.orders}
          </div>
        </div>
      </section>

      {/* TARJETAS HORIZONTALES DE ANUNCIOS ACTIVOS */}
      {adCards.length === 0 ? (
        <div className="rounded-xl bg-[#0c0d12] border border-zinc-800 p-10 text-center space-y-3">
          <MessageSquare className="w-8 h-8 text-cyan-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Todavía no hay anuncios activos mapeados</h3>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto">
            Elegí el producto arriba y presioná <strong className="text-white">Activar Piloto 24/7</strong> para traer tus anuncios de Facebook Ads y empezar a responder automáticamente en los comentarios.
          </p>
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Anuncios activos en horizontal · Tocá cualquiera para ver comentarios y ángulos IA</span>
            <span>{adCards.length} anuncios</span>
          </div>

          <div className="flex flex-col gap-3">
            {adCards.map((card) => (
              <div
                key={card.key}
                data-testid={`meta-ad-card-${card.adId || card.key}`}
                onClick={() => setOpenAdKey(card.key)}
                className="rounded-xl bg-[#0c0d12] hover:bg-[#11131b] border border-zinc-800 hover:border-zinc-700 p-4 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center gap-4"
              >
                {/* Miniatura + Jerarquía */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="w-16 h-16 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0">
                    {card.adThumbnailUrl ? (
                      <img
                        src={card.adThumbnailUrl}
                        alt={card.adName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                        Ad
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {card.isWinner && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300">
                          <Trophy className="w-3.5 h-3.5" />
                          ANUNCIO GANADOR
                          <span className="text-zinc-600">·</span>
                        </span>
                      )}
                      <h3 className="text-sm font-bold text-white truncate">
                        {card.adIndex ? `Anuncio #${card.adIndex} · ` : ''}
                        {card.adName}
                      </h3>
                    </div>

                    <div className="text-xs text-zinc-400 truncate">
                      {card.campaignName} · {card.adSetName} ·{' '}
                      <span className="text-cyan-300 font-medium">{card.productName}</span>
                    </div>

                    {card.adCopy && (
                      <p className="text-xs text-zinc-500 line-clamp-1">
                        “{card.adCopy}”
                      </p>
                    )}
                  </div>
                </div>

                {/* Métricas Horizontales Tabulares */}
                <div className="flex items-center gap-6 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-800/80">
                  <div className="text-left md:text-right">
                    <div className="text-[11px] text-zinc-500">Entrantes</div>
                    <div className="text-base font-bold text-white font-mono tabular-nums">
                      {card.commentsCount}
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="text-[11px] text-zinc-500">Respuestas</div>
                    <div className="text-base font-bold text-cyan-400 font-mono tabular-nums">
                      {card.publicRepliesCount}
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="text-[11px] text-zinc-500">Teléfonos</div>
                    <div className="text-base font-bold text-amber-300 font-mono tabular-nums">
                      {card.phonesCapturedCount}
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="text-[11px] text-zinc-500">Pedidos</div>
                    <div className="text-base font-bold text-emerald-400 font-mono tabular-nums">
                      {card.closedOrdersCount}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-cyan-400 pl-2">
                    Ver detalle →
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* DRAWER / MODAL DE RESUMEN EN VIVO DEL ANUNCIO SELECCIONADO */}
      {selectedAdCard && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-end"
          onClick={() => setOpenAdKey(null)}
        >
          <div
            className="w-full max-w-2xl h-full bg-[#090a0f] border-l border-zinc-800 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera Modal */}
            <div className="p-5 border-b border-zinc-800 flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="text-xs text-zinc-400">
                  {selectedAdCard.campaignName} · {selectedAdCard.adSetName}
                </div>
                <h3 className="text-lg font-bold text-white truncate">
                  {selectedAdCard.adName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenAdKey(null)}
                className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Contexto del Anuncio + Asignación de Producto */}
              <div className="rounded-xl bg-[#0c0d12] border border-zinc-800 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  {selectedAdCard.adThumbnailUrl && (
                    <img
                      src={selectedAdCard.adThumbnailUrl}
                      alt={selectedAdCard.adName}
                      className="w-14 h-14 rounded-lg object-cover border border-zinc-800 shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    {selectedAdCard.adHeadline && (
                      <div className="text-xs font-bold text-zinc-200">
                        {selectedAdCard.adHeadline}
                      </div>
                    )}
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {selectedAdCard.adCopy || 'Anuncio activo leyendo contexto directo de la campaña.'}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs text-zinc-400">Producto vinculado a este anuncio:</span>
                  <select
                    value={selectedAdCard.productId}
                    onChange={(e) => handleAssignProductToAd(selectedAdCard, e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs font-semibold text-white max-w-xs"
                  >
                    {productPages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-4 text-xs text-zinc-400 font-mono tabular-nums">
                  <span>Entrantes: {selectedAdCard.commentsCount}</span>
                  <span>·</span>
                  <span>Respondidos: {selectedAdCard.publicRepliesCount}</span>
                  <span>·</span>
                  <span>Pedidos: {selectedAdCard.closedOrdersCount}</span>
                  {selectedAdCard.revenuePyg > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-emerald-400">{formatGs(selectedAdCard.revenuePyg)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Cronología de Comentarios Públicos y Respuestas Multi-Ángulo */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Comentarios recibidos y respuestas automáticas ({selectedAdCard.threads.length})
                </h4>

                {selectedAdCard.threads.length === 0 ? (
                  <div className="rounded-xl bg-[#0c0d12] border border-zinc-800 p-6 text-center text-sm text-zinc-500">
                    Este anuncio aún no tiene comentarios nuevos. El piloto lo revisa automáticamente cada 25 segundos.
                  </div>
                ) : (
                  selectedAdCard.threads.map((th) => (
                    <div
                      key={th.id}
                      className="rounded-xl bg-[#0c0d12] border border-zinc-800 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-bold text-white truncate">
                            {th.authorName}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            {new Date(th.createdAt).toLocaleString('es-PY', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {th.orderId && (
                            <button
                              type="button"
                              onClick={() => onJumpToProductOrder?.(th.productId || '', th.orderId)}
                              className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>Pedido {th.orderId}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleHideComment(th)}
                            title={th.hiddenFromPublic ? 'Mostrar comentario' : 'Ocultar comentario en Facebook'}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 cursor-pointer"
                          >
                            {th.hiddenFromPublic ? (
                              <EyeOff className="w-3.5 h-3.5 text-amber-300" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Comentario del cliente */}
                      <div className="text-sm text-zinc-200 bg-zinc-950 border border-zinc-800/80 rounded-lg px-3.5 py-2.5">
                        “{th.commentText}”
                        {th.detectedPhones.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-2 text-xs text-amber-300 font-mono">
                            <Phone className="w-3.5 h-3.5" />
                            <span>
                              +{th.detectedPhones.join(', +')} ·{' '}
                              {th.hiddenFromPublic ? 'Oculto al público' : 'Visible'} · WhatsApp enviado
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Respuesta pública multi-ángulo */}
                      {th.publicReplyText ? (
                        <div className="text-sm text-emerald-100 bg-emerald-950/25 border border-emerald-800/40 rounded-lg px-3.5 py-2.5 space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold">
                            <span>
                              {th.angleUsed ? ANGLE_LABELS[th.angleUsed] || th.angleUsed : 'Respuesta pública IA'}
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Publicada en Meta
                            </span>
                          </div>
                          <p className="leading-relaxed">{th.publicReplyText}</p>
                          {th.expressFormUrl && (
                            <a
                              href={th.expressFormUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline pt-1"
                            >
                              <span>Link directo usado</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-500">
                          En cola para respuesta pública automática...
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
