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

  const [activeTab, setActiveTab] = useState<'inbox' | 'analytics'>('inbox');
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
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

  // Compositores dentro del hilo
  const [publicDraft, setPublicDraft] = useState('');
  const [dmDraft, setDmDraft] = useState('');
  const [includeExpressBtn, setIncludeExpressBtn] = useState(true);
  const [customerSimDmText, setCustomerSimDmText] = useState('');

  // Cierre rápido directo al producto
  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderCity, setOrderCity] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [orderPack, setOrderPack] = useState<1 | 2 | 3>(1);

  // Simulador IA Real
  const [simProductId, setSimProductId] = useState<string>(productPages[0]?.id || '');
  const [simAuthor, setSimAuthor] = useState('Carlos Benítez');
  const [simAdName, setSimAdName] = useState('Anuncio #1 · Dolor / Oferta COD');
  const [simCampaignName, setSimCampaignName] = useState('');
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
    setOrderPhone(selectedThread.detectedPhones?.[0] ? `0${selectedThread.detectedPhones[0].replace(/^595/, '')}` : '');
    setOrderCity('Asunción');
    setOrderAddress('');
    setOrderPack(1);
    setPublicDraft('');
    setDmDraft('');
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
        showToast('Configuración de Comentarios IA guardada.');
      } else {
        showToast(data?.error || 'No se pudo guardar configuración.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error guardando configuración.');
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
        body: JSON.stringify({
          ...opts,
          productSlug: prod.slug
        })
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
        showToast(data?.error || 'No se pudieron sincronizar comentarios de Meta.');
        return;
      }
      setThreads(data.threads || []);
      setAdStats(data.adStats || []);
      if (data.config) setConfig(data.config);
      showToast(
        `Sincronizado: ${data.postsScanned || 0} posts, ${data.commentsFound || 0} comentarios, ${data.newCommentsProcessed || 0} atendidos con IA.`
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
      const selectedCamp = campaigns.find((c) => c.name === simCampaignName || c.campaignName === simCampaignName);
      const res = await fetch('/api/meta/comments/simulate', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          mode: 'comment',
          productId: simProductId || config?.defaultProductId || productPages[0]?.id,
          authorName: simAuthor,
          commentText: simCommentText,
          adId: `sim_ad_${(simAdName.match(/#(\d+)/)?.[1] || '1')}`,
          adName: simAdName,
          adIndex: Number(simAdName.match(/#(\d+)/)?.[1] || 1),
          campaignId: selectedCamp?.campaignId,
          campaignName: simCampaignName || selectedCamp?.campaignName || 'Campaña Meta COD'
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        showToast(data?.error || 'Error ejecutando simulación IA OpenRouter.');
        return;
      }
      setThreads(data.threads || []);
      setAdStats(data.adStats || []);
      if (data.thread?.id) setSelectedThreadId(data.thread.id);
      setShowSimModal(false);
      showToast('IA OpenRouter respondió comentario + Messenger privado + enlace Express.');
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
        showToast(data?.error || 'Error procesando respuesta DM.');
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
        showToast('¡La IA detectó datos completos de entrega en el chat y rellenó la ficha de cierre!');
      } else {
        showToast('La IA respondió al cliente en el chat Messenger.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error en DM simulado.');
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
        showToast('Borrador público generado con OpenRouter IA.');
      } else {
        setThreads(data.threads || []);
        setPublicDraft('');
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
        showToast(data?.error || 'Error enviando mensaje a Messenger.');
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
        showToast('Mensaje Messenger redactado por OpenRouter IA.');
      } else {
        setThreads(data.threads || []);
        setDmDraft('');
        showToast(data.warning || 'Mensaje enviado al Messenger privado del cliente.');
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
            ? 'Comentario ocultado de la vista pública (Anti-competencia).'
            : 'Comentario visible públicamente.'
        );
      } else {
        showToast(data?.error || 'No se pudo cambiar visibilidad.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error ocultando comentario.');
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
      showToast('Seleccioná primero un producto válido.');
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
        showToast(data?.error || 'No se pudo registrar el pedido.');
        return;
      }
      setThreads(data.threads || []);
      setAdStats(data.adStats || []);
      await refreshOrders().catch(() => {});
      showToast(`Pedido ${data.order?.reservaid} creado dentro de ${prod.nombre}!`);
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
        showToast('Se abrió Facebook OAuth para otorgar permisos de Comentarios y Messenger.');
      } else {
        showToast(data?.error || 'Configurá primero Meta App ID/Secret en AutoAds.');
      }
    } catch {
      showToast('Error iniciando OAuth de Meta.');
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

  const kpiTotals = useMemo(() => {
    const comments = threads.length;
    const phones = threads.filter((t) => t.detectedPhones.length > 0).length;
    const closed = adStats.reduce((acc, s) => acc + s.closedOrdersCount, 0);
    const revenue = adStats.reduce((acc, s) => acc + s.revenuePyg, 0);
    return { comments, phones, closed, revenue };
  }, [threads, adStats]);

  if (loading) {
    return (
      <div className="p-10 text-center text-zinc-400 text-sm">
        Cargando Comentarios Ads & Agente Messenger IA...
      </div>
    );
  }

  const threadProduct =
    selectedThread &&
    (productPages.find((p) => p.id === selectedThread.productId) ||
      productPages.find((p) => p.slug === selectedThread.productSlug));

  return (
    <div data-testid="meta-comments-view" className="space-y-4">
      {/* HEADER PRINCIPAL DEDICADO */}
      <div className="rounded-2xl bg-[#0c0d12] border border-zinc-800/90 p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Comentarios Ads & Cierre Messenger IA
              </h2>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                  hasOpenRouterKey
                    ? 'bg-emerald-950/70 border-emerald-700/70 text-emerald-300'
                    : 'bg-red-950/70 border-red-700/70 text-red-300'
                }`}
              >
                {hasOpenRouterKey ? 'OpenRouter GPT-4o Activo' : 'Falta OPENROUTER_API_KEY'}
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                  hasMetaToken && commentsPermissionsReady
                    ? 'bg-cyan-950/70 border-cyan-700/70 text-cyan-300'
                    : 'bg-amber-950/70 border-amber-700/70 text-amber-300'
                }`}
              >
                {hasMetaToken && commentsPermissionsReady
                  ? 'Meta Page & Messenger Listo'
                  : 'Permisos Meta Pendientes'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Vendedor universal multi-producto: responde con prueba social, oculta teléfonos de competidores y cierra directo por Messenger + Formulario Express GPS.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!commentsPermissionsReady && (
            <button
              type="button"
              onClick={handleAuthorizeMetaCommentsOAuth}
              className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/50 text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              title={
                missingCommentPermissions.length > 0
                  ? `Faltan: ${missingCommentPermissions.join(', ')}`
                  : 'Conectar permisos de comentarios y Messenger'
              }
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Autorizar Messenger & Comentarios</span>
            </button>
          )}

          <button
            type="button"
            data-testid="meta-comments-sim-btn"
            onClick={() => setShowSimModal(true)}
            className="px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/50 text-indigo-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Probar IA con Comentario</span>
          </button>

          <button
            type="button"
            data-testid="meta-comments-sync-btn"
            onClick={handleSyncMetaComments}
            disabled={syncing}
            className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar Comentarios Reales'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsDrawer((v) => !v)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
              showSettingsDrawer
                ? 'bg-zinc-800 border-zinc-600 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configuración</span>
          </button>
        </div>
      </div>

      {/* PANEL COLAPSABLE DE CONFIGURACIÓN & WEBHOOK */}
      {showSettingsDrawer && config && (
        <div className="rounded-2xl bg-[#0c0d12] border border-cyan-800/50 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Reglas Automáticas & Mapeo Universal</h3>
              <p className="text-xs text-zinc-400">
                Configurá qué producto atiende la IA por defecto y los automatismos 24/7.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSettingsDrawer(false)}
              className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2.5">
            {[
              { key: 'enabled', label: 'Agente IA Activo 24/7' },
              { key: 'autoPublicReply', label: 'Responder Público (Prueba Social)' },
              { key: 'autoPrivateDm', label: 'Enviar Messenger + Botón Express' },
              { key: 'autoHidePhoneComments', label: 'Ocultar Teléfonos (Anti-Robo)' },
              { key: 'autoWhatsappOnPhone', label: 'Auto-WhatsApp si deja Celular' }
            ].map((item) => {
              const checked = Boolean((config as any)[item.key]);
              return (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 cursor-pointer"
                >
                  <span className="text-xs font-medium text-zinc-200">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => handleSaveConfig({ [item.key]: e.target.checked } as any)}
                    className="accent-cyan-400 w-4 h-4 cursor-pointer"
                  />
                </label>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase text-zinc-400 block mb-1">
                Producto por Defecto (Universal)
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
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
              >
                {productPages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({formatGs(p.precios?.[1] || p.precioNormal)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase text-zinc-400 block mb-1">
                URL Webhook Meta (feed + messages)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  readOnly
                  value={webhookUrl}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-cyan-300"
                />
                <button
                  type="button"
                  onClick={() => copyText(webhookUrl, 'URL Webhook')}
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase text-zinc-400 block mb-1">
                Verify Token Webhook Meta
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  readOnly
                  value={config.webhookVerifyToken}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-emerald-300"
                />
                <button
                  type="button"
                  onClick={() => copyText(config.webhookVerifyToken, 'Verify Token')}
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {campaigns.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold uppercase text-zinc-400 block mb-1.5">
                Asignar Producto Exacto a Cada Campaña Meta
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {campaigns.map((camp: any) => {
                  const cid = String(camp.campaignId || camp.id);
                  const mappedProdId = config.campaignProductMap?.[cid]?.productId || camp.productId || '';
                  return (
                    <div
                      key={cid}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800"
                    >
                      <span className="text-xs text-zinc-300 truncate">{camp.campaignName || camp.name}</span>
                      <select
                        value={mappedProdId}
                        onChange={(e) =>
                          handleMapProduct({ campaignId: cid, productId: e.target.value })
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white max-w-[200px]"
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
            </div>
          )}
        </div>
      )}

      {/* PESTAÑAS DE INTERFAZ INDEPENDIENTE + MÉTRICAS RESUMEN */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-[#0c0d12] border border-zinc-800 w-fit">
          <button
            type="button"
            data-testid="meta-comments-tab-inbox"
            onClick={() => setActiveTab('inbox')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'inbox'
                ? 'bg-cyan-500 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Bandeja & Chat Messenger ({threads.length})</span>
          </button>
          <button
            type="button"
            data-testid="meta-comments-tab-analytics"
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'analytics'
                ? 'bg-amber-400 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Ranking de Anuncios & Ventas ({adStats.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-[#0c0d12] border border-zinc-800 text-zinc-300">
            Comentarios: <strong className="text-white">{kpiTotals.comments}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#0c0d12] border border-zinc-800 text-zinc-300">
            Teléfonos Ocultados: <strong className="text-cyan-400">{kpiTotals.phones}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#0c0d12] border border-zinc-800 text-zinc-300">
            Pedidos Cerrados: <strong className="text-emerald-400">{kpiTotals.closed}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#0c0d12] border border-zinc-800 text-zinc-300">
            Facturado Chat/Ads: <strong className="text-amber-300">{formatGs(kpiTotals.revenue)}</strong>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: BANDEJA UNIFICADA COMENTARIOS + MESSENGER + CIERRE */}
      {/* ======================================================== */}
      {activeTab === 'inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* COLUMNA IZQUIERDA: LISTA DE COMENTARIOS / HILOS */}
          <div className="lg:col-span-4 rounded-2xl bg-[#0c0d12] border border-zinc-800 overflow-hidden">
            <div className="p-3 border-b border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Buscar cliente, teléfono, producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500"
                />
                {adStats.length > 0 && (
                  <select
                    value={selectedAdFilter}
                    onChange={(e) => setSelectedAdFilter(e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 max-w-[130px]"
                  >
                    <option value="all">Todos los Ads</option>
                    {adStats.map((st) => (
                      <option key={st.adKey} value={st.adKey}>
                        {st.adIndex ? `#${st.adIndex} ` : ''}{st.adName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'phones', label: '📱 Con Teléfono' },
                  { id: 'form_sent', label: '⚡ Form / DM' },
                  { id: 'closed', label: '✅ Cerrados' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id as any)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                      statusFilter === f.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[650px] overflow-y-auto divide-y divide-zinc-800/80">
              {filteredThreads.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-300">
                    Todavía no hay comentarios en la bandeja
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Tocá <b>Sincronizar Comentarios Reales</b> para traer comentarios de tus anuncios o <b>Probar IA con Comentario</b> para ver a OpenRouter respondiendo y cerrando en tiempo real.
                  </p>
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
                      className={`w-full text-left p-3 transition-colors cursor-pointer space-y-1.5 ${
                        isSel
                          ? 'bg-cyan-950/30 border-l-2 border-cyan-400'
                          : 'hover:bg-zinc-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">
                          {th.authorName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                            th.orderId
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                              : th.status === 'form_sent'
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {th.orderId ? `Cerrado ${th.orderId}` : th.status === 'form_sent' ? 'DM + Form' : 'Activo'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300 line-clamp-2">{th.commentText}</p>

                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-800/60 truncate max-w-[160px]">
                          {th.adIndex ? `Ad #${th.adIndex}` : th.adName || 'Meta Ad'}
                        </span>
                        {th.productName && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 truncate max-w-[140px]">
                            {th.productName}
                          </span>
                        )}
                        {th.detectedPhones.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/70 font-mono">
                            📱 {th.hiddenFromPublic ? 'Oculto' : 'Tel.'}
                          </span>
                        )}
                        {th.isSimulation && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                            Simulación
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMNA CENTRAL: COMENTARIO PÚBLICO + CHAT MESSENGER EN VIVO */}
          <div className="lg:col-span-5 space-y-4">
            {!selectedThread ? (
              <div className="rounded-2xl bg-[#0c0d12] border border-zinc-800 p-8 text-center text-xs text-zinc-500">
                Seleccioná un comentario a la izquierda para ver la conversación pública y el chat Messenger privado.
              </div>
            ) : (
              <>
                {/* COMENTARIO PÚBLICO EN EL ANUNCIO */}
                <div className="rounded-2xl bg-[#0c0d12] border border-zinc-800 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                        {selectedThread.adIndex ? `Anuncio #${selectedThread.adIndex}` : selectedThread.adName || 'Anuncio Meta'}
                      </span>
                      <span className="text-xs font-bold text-white">{selectedThread.authorName}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleHideComment}
                      disabled={sendingAction}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border cursor-pointer ${
                        selectedThread.hiddenFromPublic
                          ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white'
                      }`}
                    >
                      {selectedThread.hiddenFromPublic ? (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>Ocultado de Competidores</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Ocultar Comentario</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 leading-relaxed">
                    “{selectedThread.commentText}”
                    {selectedThread.detectedPhones.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center gap-2 text-[11px] text-amber-300 font-mono">
                        <Phone className="w-3.5 h-3.5" />
                        <span>Teléfono capturado: +{selectedThread.detectedPhones.join(', +')}</span>
                      </div>
                    )}
                  </div>

                  {selectedThread.publicReplyText && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/25 border border-emerald-800/50 text-xs text-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">
                        ✓ Respuesta Pública (Social Proof):
                      </span>
                      {selectedThread.publicReplyText}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Editar o escribir respuesta pública en el post..."
                      value={publicDraft}
                      onChange={(e) => setPublicDraft(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handlePublicReply({ generateOnly: true, sendNow: false })}
                      disabled={sendingAction}
                      className="px-2.5 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold cursor-pointer"
                      title="Generar respuesta pública con OpenRouter"
                    >
                      IA
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePublicReply({ sendNow: true })}
                      disabled={sendingAction || !publicDraft.trim()}
                      className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      Responder Post
                    </button>
                  </div>
                </div>

                {/* CHAT PRIVADO MESSENGER + CIERRE DIRECTO EXPRESS */}
                <div className="rounded-2xl bg-[#0c0d12] border border-cyan-800/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wide text-cyan-300">
                        Chat Privado Messenger & Cierre Express
                      </h3>
                    </div>
                    {selectedThread.whatsappNotifiedAt && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                        ✓ WhatsApp Enviado
                      </span>
                    )}
                  </div>

                  <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
                    {selectedThread.messages.map((msg) => {
                      const isOut = msg.direction === 'outbound';
                      return (
                        <div
                          key={msg.id}
                          className={`p-2.5 rounded-xl text-xs space-y-1 ${
                            isOut
                              ? 'bg-cyan-950/35 border border-cyan-800/50 text-cyan-50 ml-4'
                              : 'bg-zinc-900 border border-zinc-800 text-zinc-200 mr-4'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-zinc-400">
                            <span className="font-bold uppercase">
                              {msg.by === 'customer'
                                ? selectedThread.authorName
                                : msg.by === 'ai_public'
                                ? 'IA · Comentario Público'
                                : msg.by === 'whatsapp'
                                ? 'IA · WhatsApp Directo'
                                : msg.by === 'ai_dm'
                                ? 'IA OpenRouter · Messenger'
                                : 'Admin'}
                            </span>
                            <span>
                              {msg.sentToMeta ? 'Enviado Meta ✓' : 'Generado'}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                          {msg.expressUrl && (
                            <div className="pt-1.5 flex items-center gap-2 flex-wrap">
                              <a
                                href={msg.expressUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 text-black font-bold text-[11px]"
                              >
                                <Zap className="w-3 h-3" />
                                <span>🚀 Botón WebView: Pedido Express</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Simulador rápido de respuesta del cliente en DM */}
                  {selectedThread.isSimulation && (
                    <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-800/40 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Simular que el cliente te responde por Messenger DM..."
                        value={customerSimDmText}
                        onChange={(e) => setCustomerSimDmText(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-purple-800/50 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={handleSimulateCustomerDm}
                        disabled={sendingAction || !customerSimDmText.trim()}
                        className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                      >
                        Simular DM Cliente
                      </button>
                    </div>
                  )}

                  <div className="space-y-2 pt-1 border-t border-zinc-800">
                    <textarea
                      rows={2}
                      placeholder="Escribir mensaje al Messenger privado del cliente..."
                      value={dmDraft}
                      onChange={(e) => setDmDraft(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white resize-none"
                    />
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <label className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeExpressBtn}
                          onChange={(e) => setIncludeExpressBtn(e.target.checked)}
                          className="accent-emerald-500"
                        />
                        <span>Adjuntar Botón Formulario Express GPS</span>
                      </label>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSendDm({ generateOnly: true })}
                          disabled={sendingAction}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Redactar con IA</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendDm({ generateOnly: false })}
                          disabled={sendingAction || !dmDraft.trim()}
                          className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar Messenger</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* COLUMNA DERECHA: PRODUCTO SELECCIONADO + LINK EXPRESS + CIERRE A TARJETA DEL PRODUCTO */}
          <div className="lg:col-span-3 space-y-4">
            {selectedThread && (
              <>
                {/* SELECTOR UNIVERSAL DE PRODUCTO PARA ESTE HILO / ANUNCIO */}
                <div className="rounded-2xl bg-[#0c0d12] border border-zinc-800 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <ShoppingBag className="w-4 h-4 text-emerald-400" />
                    <span>Producto que vende este hilo</span>
                  </div>
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
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white font-semibold"
                  >
                    {productPages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>

                  {threadProduct && (
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 text-[11px] text-zinc-300">
                      <div className="flex justify-between">
                        <span>Pack 1x:</span>
                        <strong className="text-white">{formatGs(threadProduct.precios?.[1] || threadProduct.precioNormal)}</strong>
                      </div>
                      {Number(threadProduct.precios?.[2]) > 0 && (
                        <div className="flex justify-between">
                          <span>Pack 2x:</span>
                          <strong className="text-emerald-400">{formatGs(threadProduct.precios[2])}</strong>
                        </div>
                      )}
                      {Number(threadProduct.precios?.[3]) > 0 && (
                        <div className="flex justify-between">
                          <span>Pack 3x:</span>
                          <strong className="text-amber-300">{formatGs(threadProduct.precios[3])}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedThread.expressFormUrl && (
                    <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                      <span className="text-[10px] font-bold uppercase text-zinc-400 block">
                        Link Directo Formulario Express (Sin Landing):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyText(selectedThread.expressFormUrl || '', 'Link Express')}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-semibold text-zinc-200 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copiar Link</span>
                        </button>
                        <a
                          href={selectedThread.expressFormUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="py-1.5 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1"
                        >
                          <span>Probar</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* CERRAR PEDIDO DIRECTAMENTE HACIA LA TARJETA DEL PRODUCTO */}
                <div className="rounded-2xl bg-[#0c0d12] border border-emerald-800/60 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                    <PackageCheck className="w-4 h-4" />
                    <span>Registrar Pedido en Producto</span>
                  </div>

                  {selectedThread.orderId ? (
                    <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-300">
                          ✅ Pedido Cerrado #{selectedThread.orderId}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300">
                        Llegó dentro de la tarjeta de <b>{selectedThread.productName}</b> identificado como origen de comentario de {selectedThread.adName || 'Anuncio Meta'}.
                      </p>
                      {onJumpToProductOrder && selectedThread.productId && (
                        <button
                          type="button"
                          onClick={() =>
                            onJumpToProductOrder(selectedThread.productId!, selectedThread.orderId)
                          }
                          className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs cursor-pointer"
                        >
                          Ver Pedido en Tarjeta del Producto
                        </button>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleCreateOrderFromThread} className="space-y-2.5">
                      <input
                        required
                        type="text"
                        placeholder="Nombre completo"
                        value={orderName}
                        onChange={(e) => setOrderName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                      />
                      <input
                        required
                        type="text"
                        placeholder="WhatsApp (ej. 0981...)"
                        value={orderPhone}
                        onChange={(e) => setOrderPhone(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                      />
                      <input
                        required
                        type="text"
                        placeholder="Ciudad (ej. San Lorenzo)"
                        value={orderCity}
                        onChange={(e) => setOrderCity(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="Dirección / Referencia"
                        value={orderAddress}
                        onChange={(e) => setOrderAddress(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                      />
                      <div className="grid grid-cols-3 gap-1.5">
                        {([1, 2, 3] as const).map((pk) => (
                          <button
                            key={pk}
                            type="button"
                            onClick={() => setOrderPack(pk)}
                            className={`py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                              orderPack === pk
                                ? 'bg-emerald-500 text-black border-emerald-400'
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
                        className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Guardar Pedido en Producto</span>
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: RANKING DE ANUNCIOS GANADORES & POTENCIAR ANUNCIO */}
      {/* ======================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          {adStats[0]?.isWinner && (
            <div className="rounded-2xl bg-gradient-to-r from-amber-950/40 via-[#0c0d12] to-emerald-950/30 border border-amber-500/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-zinc-950 text-[10px] font-black uppercase">
                  <Flame className="w-3 h-3" />
                  <span>Anuncio Ganador · Darle Más Potencia</span>
                </span>
                <h3 className="text-base font-bold text-white">
                  {adStats[0].adIndex ? `Anuncio #${adStats[0].adIndex} — ` : ''}
                  {adStats[0].adName}
                </h3>
                <p className="text-xs text-zinc-300">
                  {adStats[0].campaignName || 'Campaña Meta'} · {adStats[0].commentsCount} comentarios ·{' '}
                  {adStats[0].phonesCapturedCount} teléfonos ·{' '}
                  <strong className="text-emerald-400">
                    {adStats[0].closedOrdersCount} pedidos cerrados ({formatGs(adStats[0].revenuePyg)})
                  </strong>
                </p>
              </div>
              <a
                href="https://adsmanager.facebook.com/adsmanager/manage/ads?act=1048211497774834"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs inline-flex items-center gap-1.5 shrink-0"
              >
                <Zap className="w-4 h-4" />
                <span>Potenciar en Ads Manager</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          <div className="rounded-2xl bg-[#0c0d12] border border-zinc-800 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase text-zinc-400">
                  <th className="p-3">Anuncio / Campaña</th>
                  <th className="p-3">Producto Asignado</th>
                  <th className="p-3 text-center">Comentarios</th>
                  <th className="p-3 text-center">Teléfonos</th>
                  <th className="p-3 text-center">Chats Messenger</th>
                  <th className="p-3 text-center">Pedidos Cerrados</th>
                  <th className="p-3 text-right">Ventas Gs.</th>
                  <th className="p-3 text-right">Cierre %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70 text-xs">
                {adStats.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-zinc-500">
                      Todavía no hay anuncios con comentarios o cierres atribuidos.
                    </td>
                  </tr>
                ) : (
                  adStats.map((row) => (
                    <tr key={row.adKey} className="hover:bg-zinc-900/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {row.isWinner && <Trophy className="w-4 h-4 text-amber-400 shrink-0" />}
                          <div>
                            <div className="font-bold text-white">
                              {row.adIndex ? `#${row.adIndex} · ` : ''}
                              {row.adName}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {row.campaignName || row.adId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
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
                          className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-200 max-w-[180px]"
                        >
                          <option value="">Automático / Defecto</option>
                          {productPages.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-center font-mono text-white">{row.commentsCount}</td>
                      <td className="p-3 text-center font-mono text-cyan-300">{row.phonesCapturedCount}</td>
                      <td className="p-3 text-center font-mono text-indigo-300">{row.dmSentCount}</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-400">
                        {row.closedOrdersCount}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-amber-300">
                        {formatGs(row.revenuePyg)}
                      </td>
                      <td className="p-3 text-right font-mono text-zinc-200">
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

      {/* MODAL SIMULADOR IA REAL CON OPENROUTER */}
      {showSimModal && (
        <div
          className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowSimModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#0c0d12] border border-indigo-500/60 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  Probar Agente IA Real (OpenRouter GPT-4o)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSimulateComment} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase text-zinc-400 block mb-1">
                  Producto Universal a Vender
                </label>
                <select
                  value={simProductId}
                  onChange={(e) => setSimProductId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                >
                  {productPages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — {formatGs(p.precios?.[1] || p.precioNormal)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold uppercase text-zinc-400 block mb-1">
                    Cliente Simulado
                  </label>
                  <input
                    required
                    type="text"
                    value={simAuthor}
                    onChange={(e) => setSimAuthor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase text-zinc-400 block mb-1">
                    Anuncio Origen
                  </label>
                  <input
                    type="text"
                    value={simAdName}
                    onChange={(e) => setSimAdName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase text-zinc-400 block mb-1">
                  Comentario en el Anuncio (Probá incluir un 0981...)
                </label>
                <textarea
                  rows={3}
                  required
                  value={simCommentText}
                  onChange={(e) => setSimCommentText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSimModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={simulating}
                  className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Bot className="w-4 h-4" />
                  <span>{simulating ? 'Generando con OpenRouter...' : 'Ejecutar IA Real'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
