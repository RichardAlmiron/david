import React, { useState, useEffect, useMemo } from 'react';
import {
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  Lock,
  MessageCircle,
  MessageSquare,
  PackageCheck,
  Phone,
  RefreshCw,
  Send,
  Settings,
  ShoppingBag,
  Sparkles,
  Trophy,
  X,
  Zap
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';
import type {
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

export const MetaCommentsView: React.FC<MetaCommentsViewProps> = ({
  productPages,
  showToast,
  onJumpToProductOrder
}) => {
  const { adminToken, refreshOrders } = useStore();

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    return headers;
  }, [adminToken]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [sendingAction, setSendingAction] = useState(false);

  // Tres interfaces separadas y limpias: sin mezclar configuración encima de los chats
  const [activeTab, setActiveTab] = useState<'inbox' | 'analytics' | 'settings'>('inbox');
  const [showSimModal, setShowSimModal] = useState(false);

  const [config, setConfig] = useState<MetaCommentAutomationConfig | null>(null);
  const [threads, setThreads] = useState<MetaCommentThreadRecord[]>([]);
  const [adStats, setAdStats] = useState<MetaCommentAdStats[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const [hasOpenRouterKey, setHasOpenRouterKey] = useState(false);
  const [hasMetaToken, setHasMetaToken] = useState(false);
  const [commentsPermissionsReady, setCommentsPermissionsReady] = useState(false);
  const [missingCommentPermissions, setMissingCommentPermissions] = useState<string[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');

  // Filtros e hilo seleccionado
  const [statusFilter, setStatusFilter] = useState<'all' | 'phones' | 'form_sent' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAdFilter, setSelectedAdFilter] = useState<string>('all');
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');

  // Compositores dentro del chat seleccionado
  const [dmDraft, setDmDraft] = useState('');
  const [publicDraft, setPublicDraft] = useState('');
  const [showPublicEditor, setShowPublicEditor] = useState(false);
  const [includeExpressBtn, setIncludeExpressBtn] = useState(true);
  const [customerSimDmText, setCustomerSimDmText] = useState('');

  // Formulario simple para cerrar pedido directo al producto
  const [showOrderBox, setShowOrderBox] = useState(false);
  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderCity, setOrderCity] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [orderPack, setOrderPack] = useState<1 | 2 | 3>(1);

  // Simulador IA Real
  const [simProductId, setSimProductId] = useState<string>(productPages[0]?.id || '');
  const [simAuthor, setSimAuthor] = useState('Carlos Benítez');
  const [simAdName, setSimAdName] = useState('Anuncio #1 · Oferta Contra Entrega');
  const [simCommentText, setSimCommentText] = useState(
    'Hola! Cuánto cuesta y hacen envíos a San Lorenzo? Mi número 0981 456 789'
  );

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
      setHasOpenRouterKey(Boolean(data.hasOpenRouterKey));
      setHasMetaToken(Boolean(data.hasMetaToken));
      setCommentsPermissionsReady(Boolean(data.commentsPermissionsReady));
      setMissingCommentPermissions(
        Array.isArray(data.missingCommentPermissions) ? data.missingCommentPermissions : []
      );
      setWebhookUrl(String(data.webhookUrl || ''));
      if (!selectedThreadId && Array.isArray(data.threads) && data.threads.length > 0) {
        setSelectedThreadId(data.threads[0].id);
      }
    } catch (err: any) {
      if (!silent) showToast(err?.message || 'Error de conexión.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  useEffect(() => {
    if (productPages.length > 0 && !simProductId) {
      setSimProductId(productPages[0].id);
    }
  }, [productPages]);

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (statusFilter === 'phones' && t.detectedPhones.length === 0) return false;
      if (statusFilter === 'form_sent' && t.status !== 'form_sent' && t.status !== 'dm_active') return false;
      if (statusFilter === 'closed' && !t.orderId && t.status !== 'order_closed') return false;
      if (selectedAdFilter !== 'all' && (t.adId || t.postId || '') !== selectedAdFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hit =
          t.authorName.toLowerCase().includes(q) ||
          t.commentText.toLowerCase().includes(q) ||
          String(t.adName || '').toLowerCase().includes(q) ||
          String(t.productName || '').toLowerCase().includes(q) ||
          t.detectedPhones.some((p) => p.includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [threads, statusFilter, selectedAdFilter, searchQuery]);

  const selectedThread = useMemo(
    () =>
      threads.find((t) => t.id === selectedThreadId) ||
      filteredThreads[0] ||
      threads[0] ||
      null,
    [threads, filteredThreads, selectedThreadId]
  );

  useEffect(() => {
    if (!selectedThread) return;
    setOrderName(selectedThread.authorName || '');
    setOrderPhone(
      selectedThread.detectedPhones?.[0] ? `0${selectedThread.detectedPhones[0].replace(/^595/, '')}` : ''
    );
    setOrderCity('Asunción');
    setOrderAddress('');
    setOrderPack(1);
    setPublicDraft('');
    setDmDraft('');
    setShowPublicEditor(false);
    setShowOrderBox(false);
  }, [selectedThread?.id]);

  const handleSaveConfig = async (patch: Partial<MetaCommentAutomationConfig>) => {
    try {
      const res = await fetch('/api/meta/comments/config', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify(patch)
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setConfig(data.config);
        showToast('Configuración guardada.');
      } else {
        showToast(data?.error || 'No se pudo guardar.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error guardando.');
    }
  };

  const handleMapProduct = async (opts: {
    threadId?: string;
    adId?: string;
    campaignId?: string;
    postId?: string;
    productId: string;
  }) => {
    const prod = productPages.find((p) => p.id === opts.productId);
    if (!prod) return;
    try {
      const res = await fetch('/api/meta/comments/map-product', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ ...opts, productSlug: prod.slug })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setConfig(data.config);
        setThreads(data.threads || []);
        setAdStats(data.adStats || []);
        showToast(`Producto asignado: ${prod.nombre}`);
      } else {
        showToast(data?.error || 'Error asignando producto.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error de red.');
    }
  };

  const handleSyncMetaComments = async () => {
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
        showToast(data?.error || 'No se pudieron traer comentarios de Meta.');
        return;
      }
      setThreads(data.threads || []);
      setAdStats(data.adStats || []);
      if (data.config) setConfig(data.config);
      if (Array.isArray(data.threads) && data.threads[0]) {
        setSelectedThreadId(data.threads[0].id);
      }
      setActiveTab('inbox');
      showToast(
        `Sincronizado: ${data.postsScanned || 0} anuncios revisados, ${data.commentsFound || 0} comentarios, ${data.newCommentsProcessed || 0} nuevos atendidos con IA.`
      );
    } catch (err: any) {
      showToast(err?.message || 'Error sincronizando.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSimulateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simCommentText.trim()) return;
    setSimulating(true);
    try {
      const res = await fetch('/api/meta/comments/simulate', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          mode: 'comment',
          productId: simProductId || config?.defaultProductId || productPages[0]?.id,
          authorName: simAuthor,
          commentText: simCommentText,
          adId: `sim_ad_${simAdName.match(/#(\d+)/)?.[1] || '1'}`,
          adName: simAdName,
          adIndex: Number(simAdName.match(/#(\d+)/)?.[1] || 1),
          campaignName: 'Campaña Prueba IA'
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        showToast(data?.error || 'Error ejecutando IA OpenRouter.');
        return;
      }
      setThreads(data.threads || []);
      setAdStats(data.adStats || []);
      if (data.thread?.id) setSelectedThreadId(data.thread.id);
      setShowSimModal(false);
      setActiveTab('inbox');
      showToast('Listo: la IA respondió el comentario y armó el chat Messenger.');
    } catch (err: any) {
      showToast(err?.message || 'Error en simulación.');
    } finally {
      setSimulating(false);
    }
  };

  const handleSimulateCustomerDm = async () => {
    if (!selectedThread || !customerSimDmText.trim()) return;
    setSendingAction(true);
    try {
      const res = await fetch('/api/meta/comments/simulate', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          mode: 'customer_dm',
          threadId: selectedThread.id,
          messageText: customerSimDmText.trim()
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        showToast(data?.error || 'Error simulando respuesta DM.');
        return;
      }
      setThreads(data.threads || []);
      setAdStats(data.adStats || []);
      setCustomerSimDmText('');
      if (data.extractedOrder?.ready) {
        if (data.extractedOrder.nombre) setOrderName(data.extractedOrder.nombre);
        if (data.extractedOrder.whatsapp) setOrderPhone(data.extractedOrder.whatsapp);
        if (data.extractedOrder.ciudad) setOrderCity(data.extractedOrder.ciudad);
        if (data.extractedOrder.direccion) setOrderAddress(data.extractedOrder.direccion);
        if (data.extractedOrder.pack) setOrderPack(Number(data.extractedOrder.pack) as 1 | 2 | 3);
        setShowOrderBox(true);
        showToast('La IA detectó datos de entrega en el chat y preparó el pedido.');
      } else {
        showToast('La IA respondió en Messenger.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error en DM.');
    } finally {
      setSendingAction(false);
    }
  };

  const handlePublicReply = async (opts: { generateOnly?: boolean; sendNow?: boolean }) => {
    if (!selectedThread) return;
    setSendingAction(true);
    try {
      const res = await fetch('/api/meta/comments/reply', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          threadId: selectedThread.id,
          message: publicDraft,
          generateWithAi: Boolean(opts.generateOnly),
          sendNow: Boolean(opts.sendNow)
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        showToast(data?.error || 'Error enviando respuesta pública.');
        return;
      }
      if (data.draft) {
        setPublicDraft(data.draft);
        showToast('Borrador generado con IA.');
      } else {
        setThreads(data.threads || []);
        setPublicDraft('');
        setShowPublicEditor(false);
        showToast(data.warning || 'Respuesta pública enviada.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error de red.');
    } finally {
      setSendingAction(false);
    }
  };

  const handleSendDm = async (opts: { generateOnly?: boolean }) => {
    if (!selectedThread) return;
    setSendingAction(true);
    try {
      const res = await fetch('/api/meta/comments/dm', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          threadId: selectedThread.id,
          message: dmDraft,
          generateWithAi: Boolean(opts.generateOnly),
          sendNow: !opts.generateOnly,
          includeExpressForm: includeExpressBtn
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        showToast(data?.error || 'Error enviando Messenger.');
        return;
      }
      if (data.draft) {
        setDmDraft(data.draft);
        if (data.extractedOrder?.ready) {
          if (data.extractedOrder.nombre) setOrderName(data.extractedOrder.nombre);
          if (data.extractedOrder.whatsapp) setOrderPhone(data.extractedOrder.whatsapp);
          if (data.extractedOrder.ciudad) setOrderCity(data.extractedOrder.ciudad);
          if (data.extractedOrder.direccion) setOrderAddress(data.extractedOrder.direccion);
        }
        showToast('Mensaje redactado con OpenRouter IA.');
      } else {
        setThreads(data.threads || []);
        setDmDraft('');
        showToast(data.warning || 'Mensaje enviado al Messenger del cliente.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error de red.');
    } finally {
      setSendingAction(false);
    }
  };

  const handleToggleHideComment = async () => {
    if (!selectedThread) return;
    setSendingAction(true);
    try {
      const res = await fetch('/api/meta/comments/hide', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          threadId: selectedThread.id,
          isHidden: !selectedThread.hiddenFromPublic
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setThreads(data.threads || []);
        showToast(
          data.thread?.hiddenFromPublic
            ? 'Comentario ocultado del público (Anti-Robo).'
            : 'Comentario visible otra vez.'
        );
      } else {
        showToast(data?.error || 'No se pudo cambiar visibilidad.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error ocultando.');
    } finally {
      setSendingAction(false);
    }
  };

  const handleCreateOrderFromThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThread) return;
    const prod =
      productPages.find((p) => p.id === selectedThread.productId) ||
      productPages.find((p) => p.slug === selectedThread.productSlug) ||
      productPages[0];
    if (!prod) {
      showToast('Elegí un producto válido primero.');
      return;
    }
    setSendingAction(true);
    try {
      const res = await fetch('/api/meta/comments/create-order', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          threadId: selectedThread.id,
          productId: prod.id,
          nombre: orderName || selectedThread.authorName,
          whatsapp: orderPhone,
          ciudad: orderCity || 'Asunción',
          direccion: orderAddress || 'Confirmado en Messenger',
          cantidad: orderPack
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        showToast(data?.error || 'No se pudo guardar el pedido.');
        return;
      }
      setThreads(data.threads || []);
      setAdStats(data.adStats || []);
      setShowOrderBox(false);
      await refreshOrders().catch(() => {});
      showToast(`Pedido ${data.order?.reservaid} guardado en ${prod.nombre}!`);
    } catch (err: any) {
      showToast(err?.message || 'Error creando pedido.');
    } finally {
      setSendingAction(false);
    }
  };

  const handleAuthorizeMetaCommentsOAuth = async () => {
    try {
      const res = await fetch('/api/meta/auth-url', { credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (data?.authUrl) {
        window.open(data.authUrl, 'metaOAuthComments', 'width=620,height=720');
        showToast('Se abrió Facebook para aprobar los permisos.');
      } else {
        showToast(data?.error || 'Configurá Meta App ID en AutoAds primero.');
      }
    } catch {
      showToast('Error iniciando Facebook OAuth.');
    }
  };

  const copyText = (txt: string, label: string) => {
    try {
      navigator.clipboard.writeText(txt);
      showToast(`${label} copiado.`);
    } catch {
      showToast('No se pudo copiar.');
    }
  };

  const isFullyConnected = hasOpenRouterKey && hasMetaToken && commentsPermissionsReady;

  if (loading) {
    return (
      <div className="p-12 text-center text-zinc-400 text-sm">
        Cargando Comentarios & Messenger IA...
      </div>
    );
  }

  const threadProduct =
    selectedThread &&
    (productPages.find((p) => p.id === selectedThread.productId) ||
      productPages.find((p) => p.slug === selectedThread.productSlug));

  return (
    <div data-testid="meta-comments-view" className="max-w-6xl mx-auto space-y-5">
      {/* CABECERA ÚNICA Y LIMPIA */}
      <div className="rounded-2xl bg-[#0c0d12] border border-zinc-800 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Comentarios & Messenger IA
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                isFullyConnected
                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60'
                  : 'bg-amber-950/70 text-amber-300 border border-amber-700/60'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isFullyConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {isFullyConnected ? 'Conectado (IA + Meta)' : 'Falta completar conexión'}
            </span>
          </div>
          <p className="text-sm text-zinc-400">
            Atendé comentarios de tus anuncios, ocultá teléfonos de clientes y cerrá pedidos al Express.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {!commentsPermissionsReady && (
            <button
              type="button"
              onClick={handleAuthorizeMetaCommentsOAuth}
              title={
                missingCommentPermissions.length > 0
                  ? `Faltan: ${missingCommentPermissions.join(', ')}`
                  : 'Autorizar Meta'
              }
              className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Conectar Facebook</span>
            </button>
          )}

          <button
            type="button"
            data-testid="meta-comments-sim-btn"
            onClick={() => setShowSimModal(true)}
            className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Probar IA</span>
          </button>

          <button
            type="button"
            data-testid="meta-comments-sync-btn"
            onClick={handleSyncMetaComments}
            disabled={syncing}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Trayendo...' : 'Sincronizar Comentarios'}</span>
          </button>
        </div>
      </div>

      {/* BARRA DE PESTAÑAS INDEPENDIENTES (NADA MEZCLADO) */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-zinc-800 pb-3">
        <div className="inline-flex p-1 rounded-xl bg-[#0c0d12] border border-zinc-800">
          <button
            type="button"
            data-testid="meta-comments-tab-inbox"
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'inbox'
                ? 'bg-cyan-500 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>Comentarios y Chats ({threads.length})</span>
          </button>

          <button
            type="button"
            data-testid="meta-comments-tab-analytics"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'analytics'
                ? 'bg-amber-400 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Anuncio Ganador ({adStats.length})</span>
          </button>

          <button
            type="button"
            data-testid="meta-comments-tab-settings"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'settings'
                ? 'bg-zinc-200 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Ajustes y Producto</span>
          </button>
        </div>

        {/* Un resumen limpio de 2 números clave */}
        <div className="flex items-center gap-4 text-xs sm:text-sm text-zinc-400">
          <span>
            Teléfonos capturados:{' '}
            <strong className="text-cyan-400 font-bold">
              {threads.filter((t) => t.detectedPhones.length > 0).length}
            </strong>
          </span>
          <span>
            Pedidos cerrados:{' '}
            <strong className="text-emerald-400 font-bold">
              {adStats.reduce((a, b) => a + b.closedOrdersCount, 0)}
            </strong>
          </span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* PESTAÑA 1: COMENTARIOS Y CHATS (SI NO HAY DATOS, PANTALLA DE INICIO)  */}
      {/* ===================================================================== */}
      {activeTab === 'inbox' && (
        <>
          {threads.length === 0 ? (
            <div className="rounded-2xl bg-[#0c0d12] border border-zinc-800 p-10 sm:p-14 text-center max-w-2xl mx-auto space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto">
                <MessageSquare className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">
                  Tu bandeja está lista para atender clientes
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Cuando alguien comente tus anuncios, aparecerá acá junto con la respuesta pública, el chat de Messenger y el link al Formulario Express.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSyncMetaComments}
                  disabled={syncing}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Buscando en Facebook...' : 'Traer comentarios de mis anuncios'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSimModal(true)}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Hacer una prueba rápida con la IA</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* IZQUIERDA: LISTA SIMPLE DE CLIENTES */}
              <div className="lg:col-span-4 rounded-2xl bg-[#0c0d12] border border-zinc-800 overflow-hidden">
                <div className="p-3.5 border-b border-zinc-800 space-y-3">
                  <input
                    type="text"
                    placeholder="Buscar por nombre o teléfono..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white placeholder-zinc-500"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: 'all', label: 'Todos' },
                      { id: 'phones', label: '📱 Teléfono' },
                      { id: 'form_sent', label: '💬 En Chat' },
                      { id: 'closed', label: '✅ Cerrados' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setStatusFilter(f.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                          statusFilter === f.id
                            ? 'bg-cyan-500 text-zinc-950'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[680px] overflow-y-auto divide-y divide-zinc-800/80">
                  {filteredThreads.length === 0 ? (
                    <div className="p-8 text-center text-sm text-zinc-500">
                      No hay clientes con ese filtro.
                    </div>
                  ) : (
                    filteredThreads.map((th) => {
                      const isSel = selectedThread?.id === th.id;
                      return (
                        <button
                          key={th.id}
                          type="button"
                          data-testid={`comment-thread-${th.id}`}
                          onClick={() => setSelectedThreadId(th.id)}
                          className={`w-full text-left p-4 transition-colors cursor-pointer space-y-1.5 ${
                            isSel
                              ? 'bg-cyan-950/35 border-l-4 border-cyan-400'
                              : 'hover:bg-zinc-900/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-white truncate">
                              {th.authorName}
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                th.orderId
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                  : 'bg-zinc-800 text-zinc-300'
                              }`}
                            >
                              {th.orderId ? 'Pedido OK' : th.adIndex ? `Ad #${th.adIndex}` : 'Ad'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                            {th.commentText}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                            {th.detectedPhones.length > 0 && (
                              <span className="text-amber-300 font-semibold">
                                📱 {th.hiddenFromPublic ? 'Número oculto' : 'Con número'}
                              </span>
                            )}
                            {th.productName && <span className="truncate">{th.productName}</span>}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* DERECHA: PANEL ÚNICO ORDENADO DE ARRIBA A ABAJO (1 -> 2 -> 3) */}
              <div className="lg:col-span-8 space-y-4">
                {selectedThread && (
                  <>
                    {/* BLOQUE 1: COMENTARIO ORIGINAL EN EL ANUNCIO + PRODUCTO */}
                    <div className="rounded-2xl bg-[#0c0d12] border border-zinc-800 p-4 sm:p-5 space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-bold text-white">
                              {selectedThread.authorName}
                            </span>
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                              {selectedThread.adIndex
                                ? `Anuncio #${selectedThread.adIndex}`
                                : selectedThread.adName || 'Anuncio Meta'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {selectedThread.campaignName || 'Campaña Meta Ads'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            data-testid="thread-product-selector"
                            value={threadProduct?.id || selectedThread.productId || ''}
                            onChange={(e) =>
                              handleMapProduct({
                                threadId: selectedThread.id,
                                adId: selectedThread.adId,
                                postId: selectedThread.postId,
                                productId: e.target.value
                              })
                            }
                            className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs font-semibold text-white max-w-[240px]"
                          >
                            {productPages.map((p) => (
                              <option key={p.id} value={p.id}>
                                Producto: {p.nombre}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={handleToggleHideComment}
                            disabled={sendingAction}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border cursor-pointer ${
                              selectedThread.hiddenFromPublic
                                ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
                                : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white'
                            }`}
                          >
                            {selectedThread.hiddenFromPublic ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Comentario Oculto</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Ocultar Público</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                        <div className="text-xs font-bold uppercase text-zinc-500">
                          1. Comentó en el anuncio:
                        </div>
                        <p className="text-sm text-zinc-100 leading-relaxed">
                          “{selectedThread.commentText}”
                        </p>
                        {selectedThread.detectedPhones.length > 0 && (
                          <div className="pt-1 flex items-center gap-2 text-xs text-amber-300 font-mono">
                            <Phone className="w-3.5 h-3.5" />
                            <span>Número detectado: +{selectedThread.detectedPhones.join(', +')}</span>
                          </div>
                        )}
                      </div>

                      {selectedThread.publicReplyText && (
                        <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-800/50 text-sm text-emerald-200 flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[11px] font-bold uppercase text-emerald-400 block mb-0.5">
                              Respuesta pública en el anuncio:
                            </span>
                            {selectedThread.publicReplyText}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowPublicEditor((v) => !v)}
                            className="text-xs text-zinc-400 hover:text-white underline shrink-0 cursor-pointer"
                          >
                            Responder otro
                          </button>
                        </div>
                      )}

                      {(!selectedThread.publicReplyText || showPublicEditor) && (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Escribir respuesta pública debajo del comentario..."
                            value={publicDraft}
                            onChange={(e) => setPublicDraft(e.target.value)}
                            className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handlePublicReply({ generateOnly: true, sendNow: false })}
                            disabled={sendingAction}
                            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-indigo-300 text-xs font-semibold cursor-pointer"
                          >
                            Sugerir IA
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePublicReply({ sendNow: true })}
                            disabled={sendingAction || !publicDraft.trim()}
                            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            Publicar
                          </button>
                        </div>
                      )}
                    </div>

                    {/* BLOQUE 2: CHAT PRIVADO MESSENGER + LINK DIRECTO EXPRESS */}
                    <div className="rounded-2xl bg-[#0c0d12] border border-cyan-800/50 p-4 sm:p-5 space-y-3.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-cyan-400" />
                          <h3 className="text-sm font-bold text-white">
                            2. Chat Privado en Messenger & Enlace Express
                          </h3>
                        </div>
                        {selectedThread.expressFormUrl && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => copyText(selectedThread.expressFormUrl || '', 'Link Express')}
                              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copiar Link Express</span>
                            </button>
                            <a
                              href={selectedThread.expressFormUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1"
                            >
                              <span>Abrir Formulario</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="max-h-[280px] overflow-y-auto space-y-2.5 pr-1">
                        {selectedThread.messages
                          .filter((m) => m.by !== 'ai_public')
                          .map((msg) => {
                            const isOut = msg.direction === 'outbound';
                            return (
                              <div
                                key={msg.id}
                                className={`p-3.5 rounded-xl text-sm space-y-1.5 ${
                                  isOut
                                    ? 'bg-cyan-950/35 border border-cyan-800/50 text-cyan-50 ml-8'
                                    : 'bg-zinc-900 border border-zinc-800 text-zinc-100 mr-8'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                  <span className="font-bold">
                                    {msg.by === 'customer'
                                      ? selectedThread.authorName
                                      : msg.by === 'whatsapp'
                                      ? 'WhatsApp Directo IA'
                                      : 'Vendedor IA · Messenger'}
                                  </span>
                                  <span>{msg.sentToMeta ? 'Enviado ✓' : 'Listo'}</span>
                                </div>
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                {msg.expressUrl && (
                                  <a
                                    href={msg.expressUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs"
                                  >
                                    <Zap className="w-3.5 h-3.5" />
                                    <span>Botón WebView: Completar Pedido Rápido</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                      </div>

                      {selectedThread.isSimulation && (
                        <div className="p-2.5 rounded-xl bg-purple-950/25 border border-purple-800/40 flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Escribí acá como si fueras el cliente respondiendo por Messenger..."
                            value={customerSimDmText}
                            onChange={(e) => setCustomerSimDmText(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-950 border border-purple-800/50 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={handleSimulateCustomerDm}
                            disabled={sendingAction || !customerSimDmText.trim()}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            Simular Cliente
                          </button>
                        </div>
                      )}

                      <div className="space-y-2.5 pt-2 border-t border-zinc-800">
                        <textarea
                          rows={2}
                          placeholder="Responder por Messenger privado al cliente..."
                          value={dmDraft}
                          onChange={(e) => setDmDraft(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white resize-none"
                        />
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={includeExpressBtn}
                              onChange={(e) => setIncludeExpressBtn(e.target.checked)}
                              className="accent-emerald-500 w-4 h-4"
                            />
                            <span>Incluir botón al Formulario Express GPS</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSendDm({ generateOnly: true })}
                              disabled={sendingAction}
                              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Escribir con IA</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSendDm({ generateOnly: false })}
                              disabled={sendingAction || !dmDraft.trim()}
                              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Enviar Messenger</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BLOQUE 3: PEDIDO CERRADO O BOTÓN PARA REGISTRARLO EN EL PRODUCTO */}
                    <div className="rounded-2xl bg-[#0c0d12] border border-emerald-800/50 p-4 sm:p-5">
                      {selectedThread.orderId ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>3. Pedido guardado #{selectedThread.orderId}</span>
                            </div>
                            <p className="text-xs text-zinc-400">
                              Ya figura dentro de la tarjeta de <b className="text-zinc-200">{selectedThread.productName}</b> con la marca de este anuncio.
                            </p>
                          </div>
                          {onJumpToProductOrder && selectedThread.productId && (
                            <button
                              type="button"
                              onClick={() =>
                                onJumpToProductOrder(selectedThread.productId!, selectedThread.orderId)
                              }
                              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs cursor-pointer shrink-0"
                            >
                              Ver Pedido en Producto
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <PackageCheck className="w-4 h-4 text-emerald-400" />
                                <span>3. ¿Te pasó sus datos directo en el chat?</span>
                              </h3>
                              <p className="text-xs text-zinc-400">
                                Si completó el Formulario Express entra solo. Si te escribió su dirección acá, guardalo directo:
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowOrderBox((v) => !v)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 text-xs font-bold cursor-pointer shrink-0"
                            >
                              {showOrderBox ? 'Cerrar' : '+ Cargar Pedido Manual'}
                            </button>
                          </div>

                          {showOrderBox && (
                            <form
                              onSubmit={handleCreateOrderFromThread}
                              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-800"
                            >
                              <input
                                required
                                type="text"
                                placeholder="Nombre completo"
                                value={orderName}
                                onChange={(e) => setOrderName(e.target.value)}
                                className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                              />
                              <input
                                required
                                type="text"
                                placeholder="WhatsApp (0981...)"
                                value={orderPhone}
                                onChange={(e) => setOrderPhone(e.target.value)}
                                className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                              />
                              <input
                                required
                                type="text"
                                placeholder="Ciudad"
                                value={orderCity}
                                onChange={(e) => setOrderCity(e.target.value)}
                                className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                              />
                              <input
                                type="text"
                                placeholder="Dirección / Referencia"
                                value={orderAddress}
                                onChange={(e) => setOrderAddress(e.target.value)}
                                className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                              />
                              <div className="flex items-center gap-2">
                                {([1, 2, 3] as const).map((pk) => (
                                  <button
                                    key={pk}
                                    type="button"
                                    onClick={() => setOrderPack(pk)}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                                      orderPack === pk
                                        ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                                        : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                                    }`}
                                  >
                                    {pk}x
                                  </button>
                                ))}
                              </div>
                              <button
                                type="submit"
                                disabled={sendingAction}
                                data-testid="create-order-from-comment-btn"
                                className="py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs cursor-pointer disabled:opacity-60"
                              >
                                Guardar en Tarjeta del Producto
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* PESTAÑA 2: RANKING DE ANUNCIOS GANADORES                              */}
      {/* ===================================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          {adStats[0]?.isWinner && (
            <div className="rounded-2xl bg-gradient-to-r from-amber-950/35 via-[#0c0d12] to-emerald-950/30 border border-amber-500/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-zinc-950 text-xs font-black uppercase">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Anuncio Ganador · Darle Potencia</span>
                </span>
                <h3 className="text-base font-bold text-white">
                  {adStats[0].adIndex ? `Anuncio #${adStats[0].adIndex} — ` : ''}
                  {adStats[0].adName}
                </h3>
                <p className="text-sm text-zinc-300">
                  {adStats[0].commentsCount} comentarios · {adStats[0].phonesCapturedCount} teléfonos ·{' '}
                  <strong className="text-emerald-400">
                    {adStats[0].closedOrdersCount} pedidos cerrados ({formatGs(adStats[0].revenuePyg)})
                  </strong>
                </p>
              </div>
              <a
                href="https://adsmanager.facebook.com/adsmanager/manage/ads?act=1048211497774834"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs sm:text-sm inline-flex items-center gap-2 shrink-0"
              >
                <Zap className="w-4 h-4" />
                <span>Potenciar en Ads Manager</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          <div className="rounded-2xl bg-[#0c0d12] border border-zinc-800 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-xs font-bold uppercase text-zinc-400">
                  <th className="p-4">Anuncio / Campaña</th>
                  <th className="p-4">Producto</th>
                  <th className="p-4 text-center">Comentarios</th>
                  <th className="p-4 text-center">Teléfonos</th>
                  <th className="p-4 text-center">Chats DM</th>
                  <th className="p-4 text-center">Pedidos</th>
                  <th className="p-4 text-right">Ventas Gs.</th>
                  <th className="p-4 text-right">Cierre %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70 text-sm">
                {adStats.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-zinc-500">
                      Aún no hay anuncios sincronizados o ventas cerradas desde comentarios. Tocá <b>Sincronizar Comentarios</b> arriba.
                    </td>
                  </tr>
                ) : (
                  adStats.map((row) => (
                    <tr key={row.adKey} className="hover:bg-zinc-900/50">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {row.isWinner && <Trophy className="w-4 h-4 text-amber-400 shrink-0" />}
                          <div>
                            <div className="font-bold text-white">
                              {row.adIndex ? `#${row.adIndex} · ` : ''}
                              {row.adName}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {row.campaignName || row.adId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <select
                          value={row.productId || ''}
                          onChange={(e) =>
                            handleMapProduct({
                              adId: row.adId,
                              campaignId: row.campaignId,
                              postId: row.postId,
                              productId: e.target.value
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 max-w-[200px]"
                        >
                          <option value="">Automático</option>
                          {productPages.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-center font-mono text-white">{row.commentsCount}</td>
                      <td className="p-4 text-center font-mono text-cyan-300">{row.phonesCapturedCount}</td>
                      <td className="p-4 text-center font-mono text-indigo-300">{row.dmSentCount}</td>
                      <td className="p-4 text-center font-mono font-bold text-emerald-400">
                        {row.closedOrdersCount}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-amber-300">
                        {formatGs(row.revenuePyg)}
                      </td>
                      <td className="p-4 text-right font-mono text-zinc-200">
                        {row.conversionRatePct}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PESTAÑA 3: AJUSTES Y PRODUCTO (INTERFAZ PROPIA, SIN ESTORBAR CHATS)   */}
      {/* ===================================================================== */}
      {activeTab === 'settings' && config && (
        <div className="space-y-5">
          {/* Bloque A: Qué hace la IA automáticamente */}
          <div className="rounded-2xl bg-[#0c0d12] border border-zinc-800 p-5 space-y-4">
            <h3 className="text-base font-bold text-white">1. Comportamiento Automático de la IA</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  key: 'enabled',
                  label: 'Agente IA Encendido 24/7',
                  desc: 'Atiende automáticamente cada comentario nuevo.'
                },
                {
                  key: 'autoPublicReply',
                  label: 'Responder en Público (Prueba Social)',
                  desc: 'Deja respuesta visible para que todos vean atención rápida.'
                },
                {
                  key: 'autoPrivateDm',
                  label: 'Escribir por Messenger + Botón Express',
                  desc: 'Abre chat privado con precios y enlace al formulario directo.'
                },
                {
                  key: 'autoHidePhoneComments',
                  label: 'Ocultar Teléfonos (Anti-Competencia)',
                  desc: 'Esconde comentarios con 09xx para que nadie te robe el cliente.'
                },
                {
                  key: 'autoWhatsappOnPhone',
                  label: 'Auto-WhatsApp si dejó su número',
                  desc: 'Le escribe al instante desde tu línea conectada.'
                }
              ].map((item) => {
                const checked = Boolean((config as any)[item.key]);
                return (
                  <label
                    key={item.key}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer hover:border-zinc-700"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">{item.label}</div>
                      <div className="text-xs text-zinc-400">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => handleSaveConfig({ [item.key]: e.target.checked } as any)}
                      className="accent-cyan-400 w-5 h-5 cursor-pointer shrink-0"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* Bloque B: Productos asignados */}
          <div className="rounded-2xl bg-[#0c0d12] border border-zinc-800 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              <h3 className="text-base font-bold text-white">2. Qué Producto Vende en Cada Campaña</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
                  Producto por defecto (cuando un post no tiene campaña específica)
                </label>
                <select
                  value={config.defaultProductId || ''}
                  onChange={(e) => {
                    const p = productPages.find((pr) => pr.id === e.target.value);
                    handleSaveConfig({
                      defaultProductId: e.target.value,
                      defaultProductSlug: p?.slug || ''
                    });
                  }}
                  className="w-full max-w-md px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white"
                >
                  {productPages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({formatGs(p.precios?.[1] || p.precioNormal)})
                    </option>
                  ))}
                </select>
              </div>

              {campaigns.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <span className="text-xs font-semibold text-zinc-400 block">
                    Campañas Meta detectadas:
                  </span>
                  {campaigns.map((camp: any) => {
                    const cid = String(camp.campaignId || camp.id);
                    const mappedProdId = config.campaignProductMap?.[cid]?.productId || camp.productId || '';
                    return (
                      <div
                        key={cid}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-zinc-950 border border-zinc-800"
                      >
                        <span className="text-sm text-zinc-200 font-medium truncate">
                          {camp.campaignName || camp.name}
                        </span>
                        <select
                          value={mappedProdId}
                          onChange={(e) =>
                            handleMapProduct({ campaignId: cid, productId: e.target.value })
                          }
                          className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white sm:w-64"
                        >
                          <option value="">Usar detección automática</option>
                          {productPages.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bloque C: Datos Técnicos Webhook */}
          <div className="rounded-2xl bg-[#0c0d12] border border-zinc-800 p-5 space-y-3">
            <h3 className="text-base font-bold text-white">3. Conexión Técnica (Webhook Meta)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">URL Webhook</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={webhookUrl}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-cyan-300"
                  />
                  <button
                    type="button"
                    onClick={() => copyText(webhookUrl, 'URL Webhook')}
                    className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Token de Verificación</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={config.webhookVerifyToken}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-emerald-300"
                  />
                  <button
                    type="button"
                    onClick={() => copyText(config.webhookVerifyToken, 'Verify Token')}
                    className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SIMULADOR IA REAL CON OPENROUTER */}
      {showSimModal && (
        <div
          className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowSimModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#0c0d12] border border-zinc-700 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Probar Respuesta IA (OpenRouter)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSimulateComment} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  Producto a vender
                </label>
                <select
                  value={simProductId}
                  onChange={(e) => setSimProductId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white"
                >
                  {productPages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — {formatGs(p.precios?.[1] || p.precioNormal)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Cliente</label>
                  <input
                    required
                    type="text"
                    value={simAuthor}
                    onChange={(e) => setSimAuthor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Anuncio</label>
                  <input
                    type="text"
                    value={simAdName}
                    onChange={(e) => setSimAdName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  Comentario de prueba (probá dejar un 0981...)
                </label>
                <textarea
                  rows={3}
                  required
                  value={simCommentText}
                  onChange={(e) => setSimCommentText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSimModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-300 text-sm font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={simulating}
                  className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Bot className="w-4 h-4" />
                  <span>{simulating ? 'Generando...' : 'Probar Ahora'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
