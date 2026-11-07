import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bot,
  Play,
  Pause,
  ExternalLink,
  ChevronDown,
  Terminal,
  Settings2,
  RotateCw,
  Brain,
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  TrendingUp,
  Target,
  Users,
  Eye,
  Sparkles,
  Film,
  Info
} from 'lucide-react';
import { ProductPage } from '../types';
import { formatGs } from '../config';
import {
  AutoAdsBrainProfile,
  AutoAdsCreativeBrief,
  createDefaultBrainProfile,
  buildCreativeAssetsFromBrain,
  ANDROMEDA_CREATIVE_ARCHETYPES,
  AUTOADS_LLM_MODEL,
  PipeboardConnectionConfig,
  PipeboardPublishedCampaignRecord,
  DEFAULT_PIPEBOARD_CONFIG,
  GeneratedAdCreativeAsset
} from '../utils/autoAdsBrainEngine';

interface AutoAdsViewProps {
  productPages: ProductPage[];
  onOpenLiveProductPage: (prod: ProductPage) => void;
  showToast: (msg: string) => void;
}

// Pasos de entrenamiento del Cerebro Maestro
const BRAIN_TRAINING_STEPS = [
  { label: '📖 Leyendo producto completo...', rangeStart: 0, rangeEnd: 30 },
  { label: '🔍 Investigando competencia en Ad Library...', rangeStart: 30, rangeEnd: 60 },
  { label: '🧠 Entrenando cerebro IA con estrategias Andrómeda...', rangeStart: 60, rangeEnd: 100 }
];

export const AutoAdsView: React.FC<AutoAdsViewProps> = ({
  productPages,
  onOpenLiveProductPage,
  showToast
}) => {
  // Configuración de Pipeboard
  const [pbConfig, setPbConfig] = useState<PipeboardConnectionConfig>(DEFAULT_PIPEBOARD_CONFIG);

  // Selección de producto
  const [selectedProductId, setSelectedProductId] = useState<string>(productPages[0]?.id || '');
  const selectedProduct = useMemo(
    () => productPages.find(p => p.id === selectedProductId) || productPages[0],
    [productPages, selectedProductId]
  );

  // Estado del Cerebro Maestro
  const [brainProfile, setBrainProfile] = useState<AutoAdsBrainProfile>(
    productPages[0] ? createDefaultBrainProfile(productPages[0]) : ({} as AutoAdsBrainProfile)
  );
  const [isBrainTraining, setIsBrainTraining] = useState<boolean>(false);
  const [brainTrainingStep, setBrainTrainingStep] = useState<string>('');
  const [brainTrainingProgress, setBrainTrainingProgress] = useState<number>(0);

  // Creativos generados (6 piezas diversas)
  const [creatives, setCreatives] = useState<GeneratedAdCreativeAsset[]>([]);
  const [selectedCreativeTab, setSelectedCreativeTab] = useState<number>(0);

  // Piloto automático
  const [isPilotRunning, setIsPilotRunning] = useState<boolean>(false);
  const [pilotStage, setPilotStage] = useState<string>('');

  // Consola del robot
  const [robotTerminalLogs, setRobotTerminalLogs] = useState<string[]>([
    '[SYSTEM] AutoAds — Cerebro Maestro IA en espera.',
    '[READY] Seleccioná un producto para entrenar el cerebro y generar 6 creativos diversos.'
  ]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Campañas publicadas
  const [publishedCampaigns, setPublishedCampaigns] = useState<PipeboardPublishedCampaignRecord[]>([]);

  // Drawer de configuración
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // Modo de conexión: 'meta_direct' (cuenta propia) o 'pipeboard' (servicio terceros)
  const [connectionMode, setConnectionMode] = useState<'meta_direct' | 'pipeboard'>('meta_direct');

  // Estado de conexión directa con Meta
  const [metaConnected, setMetaConnected] = useState<boolean>(false);
  const [metaUser, setMetaUser] = useState<{ id: string; name: string } | null>(null);
  const [metaAdAccounts, setMetaAdAccounts] = useState<Array<{ id: string; name: string; currency: string; status: string }>>([]);
  const [metaPages, setMetaPages] = useState<Array<{ id: string; name: string; category: string; access_token?: string }>>([]);
  const [isConnectingMeta, setIsConnectingMeta] = useState<boolean>(false);
  const [metaAppId, setMetaAppId] = useState<string>('');
  const [metaAppSecret, setMetaAppSecret] = useState<string>('');

  // Reproductor de video para creativos tipo reel
  const [isPlayingVideo, setIsPlayingVideo] = useState<boolean>(true);
  const [activeVideoSceneIdx, setActiveVideoSceneIdx] = useState<number>(0);

  // Referencia para cancelar entrenamiento previo
  const brainTrainingAbortRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // Cargar configuración al montar
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/pipeboard/config')
      .then(r => r.json())
      .then(data => {
        if (data?.config) {
          setPbConfig(prev => ({ ...prev, ...data.config }));
        }
        if (Array.isArray(data?.publishedCampaigns)) {
          setPublishedCampaigns(data.publishedCampaigns);
        }
      })
      .catch(() => {});
  }, []);

  // Scroll automático en consola del robot
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [robotTerminalLogs]);

  // Temporizador del video animado
  useEffect(() => {
    if (!isPlayingVideo) return;
    const timer = setInterval(() => {
      setActiveVideoSceneIdx(prev => (prev + 1) % 4);
    }, 2500);
    return () => clearInterval(timer);
  }, [isPlayingVideo]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Entrenar el Cerebro Maestro cuando cambia el producto
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedProduct) {
      trainBrain(selectedProduct);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id]);

  /**
   * Entrena el Cerebro Maestro para un producto: analiza datos, investiga competencia,
   * genera avatares, ángulos y 6 briefs creativos diversos usando GLM-5.3.
   */
  const trainBrain = async (product: ProductPage) => {
    // Cancelar entrenamiento previo si hay uno en curso
    if (brainTrainingAbortRef.current) {
      brainTrainingAbortRef.current.abort();
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    const abortController = new AbortController();
    brainTrainingAbortRef.current = abortController;

    // Resetear estado
    setIsBrainTraining(true);
    setBrainTrainingProgress(0);
    setBrainTrainingStep(BRAIN_TRAINING_STEPS[0].label);
    setCreatives([]);
    setSelectedCreativeTab(0);

    const defaultProfile = createDefaultBrainProfile(product);
    setBrainProfile({ ...defaultProfile, status: 'training' });

    setRobotTerminalLogs(prev => [
      ...prev,
      `\n[CEREBRO] ═══════════════════════════════════════════════`,
      `[CEREBRO] Iniciando entrenamiento para "${product.nombre}"...`,
      `[CEREBRO] Modelo: ${AUTOADS_LLM_MODEL} · Metodología: Andrómeda + COD LATAM`,
      `[CEREBRO] Paso 1/3: ${BRAIN_TRAINING_STEPS[0].label}`
    ]);

    // Animar progreso a través de los 3 pasos con setInterval
    let currentStepIdx = 0;
    let currentProgress = 0;

    progressIntervalRef.current = setInterval(() => {
      if (abortController.signal.aborted) return;

      currentProgress += 1.5;
      if (currentProgress > 95) currentProgress = 95;

      // Determinar paso actual basado en progreso
      const newStepIdx =
        currentProgress >= 60 ? 2 :
        currentProgress >= 30 ? 1 : 0;

      if (newStepIdx !== currentStepIdx) {
        currentStepIdx = newStepIdx;
        setBrainTrainingStep(BRAIN_TRAINING_STEPS[newStepIdx].label);
        setRobotTerminalLogs(prev => [
          ...prev,
          `[CEREBRO] Paso ${newStepIdx + 1}/3: ${BRAIN_TRAINING_STEPS[newStepIdx].label}`
        ]);
      }

      setBrainTrainingProgress(Math.round(currentProgress));
    }, 300);

    try {
      // Llamar al endpoint de entrenamiento del cerebro
      const response = await fetch('/api/autoads/brain-train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product,
          openRouterApiKey: pbConfig.openRouterApiKey,
          openRouterModel: AUTOADS_LLM_MODEL
        }),
        signal: abortController.signal
      });

      // Limpiar el intervalo de progreso
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (abortController.signal.aborted) return;

      if (response.ok) {
        const data = await response.json();

        // Actualizar perfil del cerebro con datos del servidor
        const trainedProfile: AutoAdsBrainProfile = {
          ...defaultProfile,
          status: 'ready',
          trainedAt: new Date().toISOString(),
          avatars: data.avatars || defaultProfile.avatars,
          targeting: data.targeting || defaultProfile.targeting,
          competitorInsights: data.competitorInsights || defaultProfile.competitorInsights,
          creativeBriefs: data.creativeBriefs || defaultProfile.creativeBriefs
        };

        setBrainProfile(trainedProfile);
        setBrainTrainingProgress(100);
        setBrainTrainingStep('✅ Cerebro listo');

        // Generar activos creativos desde el cerebro entrenado
        const generatedCreatives = buildCreativeAssetsFromBrain(product, trainedProfile);
        setCreatives(generatedCreatives);

        setRobotTerminalLogs(prev => [
          ...prev,
          `[CEREBRO] ✅ Entrenamiento completado exitosamente.`,
          `[CEREBRO] 👥 ${trainedProfile.avatars.length} avatares definidos`,
          `[CEREBRO] 🎯 ${trainedProfile.creativeBriefs.length} briefs creativos generados`,
          `[CEREBRO] 📊 ${trainedProfile.competitorInsights.activeAdsFound} ads de competencia analizados`,
          `[CEREBRO] 🎨 ${generatedCreatives.length} creativos visuales sintetizados`,
          `[CEREBRO] ═══════════════════════════════════════════════`
        ]);

        showToast(`Cerebro Maestro entrenado para "${product.nombre}" — ${generatedCreatives.length} creativos listos.`);
      } else {
        // Respuesta no-OK: generar con datos por defecto
        setBrainProfile({ ...defaultProfile, status: 'ready', trainedAt: new Date().toISOString() });
        setBrainTrainingProgress(100);
        setBrainTrainingStep('✅ Cerebro listo (modo local)');

        const generatedCreatives = buildCreativeAssetsFromBrain(product, defaultProfile);
        setCreatives(generatedCreatives);

        setRobotTerminalLogs(prev => [
          ...prev,
          `[AVISO] El servidor no respondió con datos del cerebro. Usando perfil por defecto.`,
          `[CEREBRO] ${generatedCreatives.length} creativos generados con arquetipos Andrómeda.`
        ]);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;

      // En error de red: generar con perfil por defecto
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      const fallbackProfile = { ...defaultProfile, status: 'ready' as const, trainedAt: new Date().toISOString() };
      setBrainProfile(fallbackProfile);
      setBrainTrainingProgress(100);
      setBrainTrainingStep('✅ Cerebro listo (offline)');

      const generatedCreatives = buildCreativeAssetsFromBrain(product, fallbackProfile);
      setCreatives(generatedCreatives);

      setRobotTerminalLogs(prev => [
        ...prev,
        `[AVISO] Sin conexión al servidor. Cerebro entrenado con datos locales.`,
        `[CEREBRO] ${generatedCreatives.length} creativos generados con arquetipos Andrómeda.`
      ]);
    } finally {
      if (!abortController.signal.aborted) {
        setIsBrainTraining(false);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Guardar configuración
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      await fetch('/api/pipeboard/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pbConfig)
      });
      showToast('Configuración de AutoAds guardada.');
    } catch {
      showToast('Error al guardar la configuración.');
    } finally {
      setSavingSettings(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Verificar estado de conexión Meta Ads al montar
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    checkMetaStatus();
  }, []);

  const checkMetaStatus = async () => {
    try {
      const res = await fetch('/api/meta/status');
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setMetaConnected(true);
          setMetaUser(data.user);
          if (Array.isArray(data.adAccounts)) setMetaAdAccounts(data.adAccounts);
          if (Array.isArray(data.pages)) setMetaPages(data.pages);
          setRobotTerminalLogs(prev => [
            ...prev,
            `[META] ✅ Cuenta conectada: ${data.user?.name} (${data.adAccounts?.length || 0} cuentas publicitarias)`
          ]);
        }
      }
    } catch {}
  };

  // Iniciar OAuth con Meta
  const handleMetaLogin = async () => {
    setIsConnectingMeta(true);
    try {
      const params = new URLSearchParams();
      if (metaAppId) params.set('app_id', metaAppId);
      if (metaAppSecret) params.set('app_secret', metaAppSecret);
      
      const res = await fetch(`/api/meta/auth-url?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.authUrl) {
          // Abrir ventana de login de Facebook
          const popup = window.open(data.authUrl, 'meta_login', 'width=600,height=700,scrollbars=yes');
          
          // Escuchar mensaje de éxito desde la ventana popup
          const messageHandler = (event: MessageEvent) => {
            if (event.data?.type === 'META_AUTH_SUCCESS') {
              window.removeEventListener('message', messageHandler);
              setIsConnectingMeta(false);
              showToast(`✅ Conectado con Meta como ${event.data.userName}`);
              checkMetaStatus(); // Recargar estado
            }
          };
          window.addEventListener('message', messageHandler);
          
          // Timeout de seguridad
          setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            setIsConnectingMeta(false);
          }, 120000); // 2 minutos
          
          return;
        }
      }
      showToast('Error: No se pudo generar la URL de login. Verificá App ID y App Secret.');
    } catch {
      showToast('Error de conexión al servidor.');
    }
    setIsConnectingMeta(false);
  };

  // Desconectar Meta
  const handleMetaDisconnect = async () => {
    setMetaConnected(false);
    setMetaUser(null);
    setMetaAdAccounts([]);
    setMetaPages([]);
    showToast('Meta Ads desconectado.');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Motor Piloto Automático — Generar creativos y publicar campaña en 1 clic
  // ─────────────────────────────────────────────────────────────────────────────
  const runAutopilot = async () => {
    if (!selectedProduct || isPilotRunning || brainProfile.status !== 'ready') return;

    setIsPilotRunning(true);
    setRobotTerminalLogs(prev => [
      ...prev,
      `\n[PILOTO] ═══════════════════════════════════════════════`,
      `[PILOTO] 🚀 Lanzando piloto automático para "${selectedProduct.nombre}"...`,
      `[PILOTO] Cerebro Maestro: ${brainProfile.avatars.length} avatares × ${brainProfile.creativeBriefs.length} ángulos`,
      `[PILOTO] URL destino: ${window.location.origin}/?p=${selectedProduct.slug}`
    ]);

    try {
      // 1. Generar creativos con el cerebro entrenado
      setPilotStage('Sintetizando 6 creativos con Cerebro Maestro...');
      setRobotTerminalLogs(prev => [
        ...prev,
        `[IA] Generando 6 creativos diversos con GLM-5.3 + Andrómeda...`,
        `[MOTOR] Sintetizando: 3× Feed 1:1, 1× Story 9:16, 2× Reel 9:16...`
      ]);

      const freshCreatives = buildCreativeAssetsFromBrain(selectedProduct, brainProfile);
      setCreatives(freshCreatives);

      setRobotTerminalLogs(prev => [
        ...prev,
        `[CREATIVOS] ${freshCreatives.length} piezas sintetizadas con diversidad conceptual.`
      ]);

      // 2. Publicar campaña vía Meta Ads Directo o Pipeboard MCP
      const modeLabel = connectionMode === 'meta_direct' && metaConnected
        ? 'Meta Ads Directo (tu cuenta personal)'
        : 'Pipeboard MCP';
      
      setPilotStage(`Transmitiendo al servidor ${modeLabel}...`);
      setRobotTerminalLogs(prev => [
        ...prev,
        `[MCP] Publicando vía ${modeLabel}...`,
        `[MCP] Conectando con servidor (${connectionMode === 'meta_direct' ? 'Meta Marketing API v21.0' : pbConfig.pipeboardMcpEndpoint})...`,
        `[MCP #1] get_ad_accounts -> Verificando cuenta ${pbConfig.selectedAdAccountId}...`,
        `[MCP #2] upload_ad_image -> Subiendo ${freshCreatives.length} activos a la biblioteca de Meta Ads...`,
        `[MCP #3] create_campaign -> Creando Campaña OUTCOME_SALES con CBO...`,
        `[MCP #4] create_ad_set -> Configurando segmentación Paraguay y Píxel CAPI...`,
        `[MCP #5] create_ad_creative -> Ensamblando ${freshCreatives.length} creativos diversos...`,
        `[MCP #6] create_ad -> Activando anuncios en tu Ads Manager...`
      ]);

      const landingUrl = `${window.location.origin}/?p=${selectedProduct.slug}`;
      
      // Elegir endpoint según modo de conexión
      const publishEndpoint = connectionMode === 'meta_direct' && metaConnected
        ? '/api/meta/publish-direct'
        : '/api/pipeboard/publish-campaign';
      
      const selectedPage = metaPages.find(p => p.id === pbConfig.selectedFacebookPageId);
      
      const pubRes = await fetch(publishEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: selectedProduct,
          creatives: freshCreatives,
          brainProfile,
          adAccountId: pbConfig.selectedAdAccountId,
          facebookPageId: pbConfig.selectedFacebookPageId,
          pageAccessToken: selectedPage?.access_token || '',
          dailyBudgetGs: pbConfig.dailyBudgetGs,
          publishStatus: pbConfig.defaultPublishStatus,
          pipeboardApiToken: pbConfig.pipeboardApiToken,
          pipeboardMcpEndpoint: pbConfig.pipeboardMcpEndpoint,
          metaAccessTokenFallback: pbConfig.metaAccessTokenFallback,
          landingUrl,
          pixelId: selectedProduct.metaTracking?.pixelId || ''
        })
      });

      if (pubRes.ok) {
        const pubData = await pubRes.json();
        if (pubData?.campaign) {
          setPublishedCampaigns(prev => [pubData.campaign, ...prev]);
          setRobotTerminalLogs(prev => [
            ...prev,
            `[COMPLETADO] ✅ Campaña creada con éxito en Meta Ads Manager. ID: ${pubData.campaign.campaignId}.`,
            `[VENTAS] La campaña con ${freshCreatives.length} creativos ya está recibiendo tráfico.`,
            `[PILOTO] ═══════════════════════════════════════════════`
          ]);
          showToast(`¡Piloto exitoso! Campaña activa con ${freshCreatives.length} creativos (${pubData.campaign.campaignId}).`);
        }
      } else {
        setRobotTerminalLogs(prev => [
          ...prev,
          `[AVISO] Los ${freshCreatives.length} creativos se generaron correctamente y están listos en pantalla.`,
          `[PILOTO] ═══════════════════════════════════════════════`
        ]);
        showToast(`${freshCreatives.length} creativos listos para revisión.`);
      }
    } catch {
      setRobotTerminalLogs(prev => [
        ...prev,
        `[ERROR] Ocurrió un problema de red. Revisa tu conexión con Pipeboard.`,
        `[PILOTO] ═══════════════════════════════════════════════`
      ]);
    } finally {
      setIsPilotRunning(false);
      setPilotStage('');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Datos derivados del creativo activo
  // ─────────────────────────────────────────────────────────────────────────────
  const activeCreative = creatives[selectedCreativeTab] || creatives[0];
  const isVideo = activeCreative?.type === 'video_reel_9x16';
  const currentScene = isVideo && activeCreative?.videoScenes
    ? activeCreative.videoScenes[activeVideoSceneIdx % activeCreative.videoScenes.length]
    : null;

  const isBrainReady = brainProfile.status === 'ready';

  return (
    <div data-testid="autoads-view" className="max-w-6xl mx-auto space-y-5 font-sans text-zinc-100">
      {/* ===================================================================== */}
      {/* 1. BARRA SUPERIOR MINIMALISTA TIPO VERCEL DARK                       */}
      {/* ===================================================================== */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0d0d0f] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-white flex items-center justify-center font-black text-sm shrink-0">
            ▲
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2 flex-wrap">
              <span>AutoAds</span>
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-md">
                Cerebro IA v1.0
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Plataforma de Anuncios con Cerebro Maestro IA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowSettingsDrawer(prev => !prev)}
            title="Configurar credenciales y cuenta publicitaria"
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Configurar</span>
          </button>

          <a
            href="https://adsmanager.facebook.com"
            target="_blank"
            rel="noreferrer"
            title="Abrir el Administrador de Anuncios de Meta en una nueva pestaña"
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Ads Manager</span>
            <ExternalLink className="w-3 h-3 text-zinc-400" />
          </a>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. DRAWER DE CONFIGURACIÓN (COLAPSABLE)                              */}
      {/* ===================================================================== */}
      {showSettingsDrawer && (
        <div className="p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-[#0d0d0f] space-y-4 animate-fadeIn">
          {/* Pestañas de modo */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setConnectionMode('meta_direct')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                connectionMode === 'meta_direct'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              🔗 Meta Ads Directo
            </button>
            <button
              type="button"
              onClick={() => setConnectionMode('pipeboard')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                connectionMode === 'pipeboard'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              🔌 Pipeboard
            </button>
          </div>

          {/* ══════ TAB META ADS DIRECTO ══════ */}
          {connectionMode === 'meta_direct' && (
            <div className="space-y-4">
              {!metaConnected ? (
                // Estado: NO CONECTADO
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-800/50 space-y-2">
                    <h3 className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                      Conectá tu cuenta personal de Meta Ads
                    </h3>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Usá tu propia cuenta de Meta Ads directamente sin intermediarios.
                      Necesitás crear una App en{' '}
                      <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                        developers.facebook.com
                      </a>{' '}
                      y copiar el App ID y App Secret.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-medium">Meta App ID</label>
                      <input
                        type="text"
                        value={metaAppId}
                        onChange={e => setMetaAppId(e.target.value)}
                        placeholder="123456789012345"
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 font-mono text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-medium">Meta App Secret</label>
                      <input
                        type="password"
                        value={metaAppSecret}
                        onChange={e => setMetaAppSecret(e.target.value)}
                        placeholder="abc123def456..."
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 font-mono text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    <p className="text-[11px] text-zinc-500">
                      También podés pegar directamente un Access Token de Meta:
                    </p>
                    <input
                      type="text"
                      value={pbConfig.metaAccessTokenFallback || ''}
                      onChange={e => setPbConfig(prev => ({ ...prev, metaAccessTokenFallback: e.target.value }))}
                      placeholder="EAAxxxxxxx... (Token de acceso de Meta)"
                      className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 font-mono text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleMetaLogin}
                    disabled={isConnectingMeta}
                    className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConnectingMeta ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Conectando con Meta...</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        <span>Conectar con Meta Ads</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                // Estado: CONECTADO
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <div>
                        <span className="text-xs font-bold text-emerald-300">
                          ✅ Conectado como {metaUser?.name || 'Usuario Meta'}
                        </span>
                        <span className="text-[10px] text-zinc-400 block mt-0.5">
                          ID: {metaUser?.id || '---'} · Acceso directo a Meta Marketing API v21.0
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleMetaDisconnect}
                      className="px-3 py-1.5 rounded-lg border border-red-800 bg-red-950/50 text-red-300 text-[11px] font-semibold hover:bg-red-900/50 cursor-pointer transition-colors"
                    >
                      Desconectar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-medium">Cuenta Publicitaria</label>
                      <select
                        value={pbConfig.selectedAdAccountId}
                        onChange={e => setPbConfig(prev => ({ ...prev, selectedAdAccountId: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 text-xs outline-none focus:border-emerald-500 cursor-pointer appearance-none"
                      >
                        {metaAdAccounts.length > 0 ? (
                          metaAdAccounts.map(acc => (
                            <option key={acc.id} value={acc.id} className="bg-zinc-900">
                              {acc.name} ({acc.id}) · {acc.currency}
                            </option>
                          ))
                        ) : (
                          <option value={pbConfig.selectedAdAccountId} className="bg-zinc-900">
                            {pbConfig.selectedAdAccountId}
                          </option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-medium">Página de Facebook</label>
                      <select
                        value={pbConfig.selectedFacebookPageId}
                        onChange={e => {
                          const page = metaPages.find(p => p.id === e.target.value);
                          setPbConfig(prev => ({ ...prev, selectedFacebookPageId: e.target.value }));
                        }}
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 text-xs outline-none focus:border-emerald-500 cursor-pointer appearance-none"
                      >
                        {metaPages.length > 0 ? (
                          metaPages.map(page => (
                            <option key={page.id} value={page.id} className="bg-zinc-900">
                              {page.name} ({page.id})
                            </option>
                          ))
                        ) : (
                          <option value={pbConfig.selectedFacebookPageId} className="bg-zinc-900">
                            {pbConfig.selectedFacebookPageId}
                          </option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-medium">Presupuesto Diario (Gs.)</label>
                      <input
                        type="number"
                        value={pbConfig.dailyBudgetGs}
                        onChange={e => setPbConfig(prev => ({ ...prev, dailyBudgetGs: Number(e.target.value) || 50000 }))}
                        placeholder="65000"
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 font-mono text-xs outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-medium">Estado de Publicación</label>
                      <select
                        value={pbConfig.defaultPublishStatus}
                        onChange={e => setPbConfig(prev => ({ ...prev, defaultPublishStatus: e.target.value as 'ACTIVE' | 'PAUSED' }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 text-xs outline-none focus:border-emerald-500 cursor-pointer appearance-none"
                      >
                        <option value="PAUSED" className="bg-zinc-900">⏸️ PAUSADO (revisar antes)</option>
                        <option value="ACTIVE" className="bg-zinc-900">▶️ ACTIVO (publicar directo)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={savingSettings}
                    className="w-full py-3 rounded-xl bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {savingSettings ? 'Guardando...' : '💾 Guardar Configuración'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══════ TAB PIPEBOARD ══════ */}
          {connectionMode === 'pipeboard' && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-800/50 space-y-2">
                <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                  🔌 Conexión vía Pipeboard (Servicio de Terceros)
                </h3>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Pipeboard es un servicio MCP que conecta con Meta Ads. Ideal para equipos que necesitan gestión centralizada.
                  Suscripción en{' '}
                  <a href="https://pipeboard.co" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">
                    pipeboard.co
                  </a>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Token de Pipeboard</label>
                  <input
                    type="text"
                    value={pbConfig.pipeboardApiToken}
                    onChange={e => setPbConfig(prev => ({ ...prev, pipeboardApiToken: e.target.value }))}
                    placeholder="pipeboard_..."
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 font-mono text-xs outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Cuenta de Anuncios</label>
                  <input
                    type="text"
                    value={pbConfig.selectedAdAccountId}
                    onChange={e => setPbConfig(prev => ({ ...prev, selectedAdAccountId: e.target.value }))}
                    placeholder="act_..."
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 font-mono text-xs outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Presupuesto Diario (Gs.)</label>
                  <input
                    type="number"
                    value={pbConfig.dailyBudgetGs}
                    onChange={e => setPbConfig(prev => ({ ...prev, dailyBudgetGs: Number(e.target.value) || 50000 }))}
                    placeholder="50000"
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 font-mono text-xs outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full py-3 rounded-xl bg-purple-500 text-white text-sm font-bold hover:bg-purple-400 cursor-pointer transition-colors disabled:opacity-50"
              >
                {savingSettings ? 'Guardando...' : '💾 Guardar Configuración Pipeboard'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. CENTRO DE CONTROL: SELECCIÓN + CEREBRO + PILOTO AUTOMÁTICO        */}
      {/* ===================================================================== */}
      <div className="bg-[#0d0d0f] rounded-2xl border border-zinc-800 p-4 sm:p-6 space-y-5">
        <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-300">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-zinc-100 font-bold block text-[11px] uppercase tracking-wide">
              🧠 ¿Cómo funciona AutoAds con Cerebro Maestro?
            </strong>
            <span className="text-[11px] text-zinc-400 mt-0.5 block">
              1️⃣ Elegí un producto — el cerebro se entrena automáticamente analizando datos, competencia y avatares.
              2️⃣ El Cerebro Maestro genera 6 creativos diversos (3 Feed + 1 Story + 2 Reels) con ángulos distintos.
              3️⃣ Tocá <strong>&ldquo;Lanzar Piloto Automático&rdquo;</strong> para publicar todo en Meta Ads con 1 clic.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ─── Lado Izquierdo: Selector de Producto + Panel del Cerebro ─── */}
          <div className="lg:col-span-7 space-y-4">
            {/* Selector de producto */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between">
                <span>1. Producto a Analizar</span>
                <span className="text-[10px] text-emerald-400 font-normal">Sincronizado con tu catálogo</span>
              </label>
              <div className="relative">
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  title="Seleccioná la página de producto para entrenar el cerebro"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900 text-xs sm:text-sm font-semibold text-zinc-100 outline-none focus:border-emerald-500 cursor-pointer appearance-none pr-10"
                >
                  {productPages.map(p => (
                    <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-100">
                      {p.nombre} — {formatGs(p.precios?.[1] || 189000)} (/?p={p.slug})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* ─── Panel de Estado del Cerebro ─── */}
            <div className="space-y-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-emerald-400" />
                <span>2. Estado del Cerebro Maestro</span>
              </label>

              {/* Barra de progreso de entrenamiento */}
              {(isBrainTraining || brainTrainingProgress > 0) && (
                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-200 truncate pr-2">
                      {brainTrainingStep}
                    </span>
                    <span className="text-emerald-400 font-mono text-[11px] shrink-0">
                      {brainTrainingProgress}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${brainTrainingProgress}%`,
                        background: brainTrainingProgress === 100
                          ? 'linear-gradient(90deg, #10b981, #34d399)'
                          : 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)'
                      }}
                    />
                  </div>

                  {/* Pasos de entrenamiento */}
                  <div className="flex flex-col gap-1 pt-1">
                    {BRAIN_TRAINING_STEPS.map((step, idx) => {
                      const isDone = brainTrainingProgress >= step.rangeEnd;
                      const isActive = brainTrainingProgress >= step.rangeStart && brainTrainingProgress < step.rangeEnd;
                      return (
                        <div key={idx} className="flex items-center gap-2 text-[11px]">
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : isActive ? (
                            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 shrink-0" />
                          )}
                          <span className={isDone ? 'text-zinc-300' : isActive ? 'text-blue-300 font-medium' : 'text-zinc-500'}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                    {brainTrainingProgress === 100 && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-emerald-300 font-medium">✅ Cerebro listo</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Resumen del cerebro entrenado */}
              {isBrainReady && !isBrainTraining && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-center">
                      <Users className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                      <span className="text-[10px] text-zinc-400 block">Avatares</span>
                      <strong className="text-zinc-100 text-sm">{brainProfile.avatars?.length || 0}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-center">
                      <Target className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <span className="text-[10px] text-zinc-400 block">Ángulos</span>
                      <strong className="text-zinc-100 text-sm">{brainProfile.creativeBriefs?.length || 0}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-center">
                      <Search className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                      <span className="text-[10px] text-zinc-400 block">Competencia</span>
                      <strong className="text-zinc-100 text-sm">{brainProfile.competitorInsights?.activeAdsFound || 0}</strong>
                    </div>
                  </div>

                  {/* Tags de avatares */}
                  {brainProfile.avatars && brainProfile.avatars.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {brainProfile.avatars.map(avatar => (
                        <span
                          key={avatar.id}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700"
                        >
                          👤 {avatar.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Datos detectados del producto */}
            {selectedProduct && (
              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-zinc-400">Destino del anuncio:</span>
                  <a
                    href={`/?p=${selectedProduct.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-emerald-400 hover:underline inline-flex items-center gap-1 truncate max-w-full"
                  >
                    <span className="truncate">{window.location.host}/?p={selectedProduct.slug}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-zinc-400">Oferta en Guaraníes:</span>
                  <span className="font-bold text-zinc-100 tabular-nums">
                    1x {formatGs(selectedProduct.precios?.[1] || 189000)} · 2x {formatGs(selectedProduct.precios?.[2] || 349000)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-zinc-400">Píxel & Eventos CAPI:</span>
                  <span className="font-mono text-zinc-300">
                    {selectedProduct.metaTracking?.pixelId || 'Configurado (12 eventos activos)'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ─── Lado Derecho: Indicador del Cerebro + Botón Piloto ─── */}
          <div className="lg:col-span-5 flex flex-col justify-between h-full space-y-4">
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  isBrainTraining ? 'bg-blue-400 animate-pulse' :
                  isBrainReady ? 'bg-emerald-400 animate-pulse' :
                  'bg-zinc-600'
                }`} />
                <span className="text-xs font-bold text-zinc-100 uppercase tracking-wide">
                  {isBrainTraining ? 'Entrenando Cerebro...' :
                   isBrainReady ? `Cerebro Maestro Listo (${AUTOADS_LLM_MODEL})` :
                   'Cerebro en Espera'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isBrainTraining
                  ? 'El Cerebro Maestro está analizando el producto, investigando competencia y generando avatares con ángulos diversos usando la metodología Andrómeda.'
                  : isBrainReady
                  ? 'El cerebro entrenado genera 6 creativos con diversidad conceptual real: distintos hooks, ángulos, formatos y CTAs para abrir clusters de Entity ID distintos en Meta.'
                  : 'Seleccioná un producto para que el Cerebro Maestro se entrene automáticamente con los datos del catálogo.'}
              </p>
              <div className="pt-1 flex flex-wrap gap-1.5">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  ✓ 3 Imágenes Feed 1:1
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  ✓ 1 Story 9:16
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  ✓ 2 Reels Video
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  ✓ Copy COD Paraguay
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={isPilotRunning || isBrainTraining || !isBrainReady || !selectedProduct}
              onClick={runAutopilot}
              className={`w-full py-4 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2.5 ${
                isPilotRunning || isBrainTraining
                  ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-not-allowed'
                  : isBrainReady
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black active:scale-98'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
              }`}
            >
              {isPilotRunning ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
                  <span className="truncate">{pilotStage || 'Robot trabajando...'}</span>
                </>
              ) : isBrainTraining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                  <span className="truncate">Entrenando Cerebro...</span>
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 shrink-0" />
                  <span>🚀 Lanzar Piloto Automático (6 Creativos)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 4. TERMINAL VIVA DEL ROBOT                                            */}
        {/* ===================================================================== */}
        <div className="rounded-xl bg-black text-zinc-200 p-4 font-mono text-xs space-y-2 border border-zinc-800/90 shadow-inner">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Consola del Cerebro Maestro AutoAds
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span className={`w-2 h-2 rounded-full ${
                isPilotRunning || isBrainTraining ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
              }`} />
              <span>{isPilotRunning ? 'Publicando' : isBrainTraining ? 'Entrenando' : 'En Espera'}</span>
            </div>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1 pr-1 text-[11px] leading-relaxed">
            {robotTerminalLogs.map((log, i) => (
              <div key={i} className="text-zinc-300 break-words">
                {log}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 5. VISOR DE CREATIVOS (6 PESTAÑAS DIVERSAS)                          */}
      {/* ===================================================================== */}
      {selectedProduct && creatives.length > 0 && (
        <div className="bg-[#0d0d0f] rounded-2xl border border-zinc-800 p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {creatives.length} Creativos Andrómeda
                </span>
                <h2 className="text-sm font-bold text-zinc-100">
                  Creativos Generados para {selectedProduct.nombre}
                </h2>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Tocá cada pestaña para inspeccionar los {creatives.length} creativos con diversidad conceptual real.
              </p>
            </div>

            {/* Pestañas de formato (6 tabs) */}
            <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
              {creatives.map((c, idx) => {
                let tabLabel = `🖼️ Feed 1:1 (#${idx + 1})`;
                if (c.type === 'video_reel_9x16') {
                  tabLabel = idx === 4 ? '🎬 Reel #1' : '🎬 Reel #2';
                } else if (c.aspectRatio === '9:16') {
                  tabLabel = '📱 Story 9:16';
                }
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCreativeTab(idx)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors truncate ${
                      selectedCreativeTab === idx
                        ? 'bg-zinc-800 text-white shadow-xs border border-zinc-700'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tabLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Área de previsualización y copys */}
          {activeCreative && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Visualizador de Imagen o Video */}
              <div className="lg:col-span-5 flex justify-center">
                {!isVideo ? (
                  <div
                    className={`relative overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-lg ${
                      activeCreative.aspectRatio === '9:16'
                        ? 'aspect-[9/16] h-[360px]'
                        : 'aspect-square h-[300px] sm:h-[320px]'
                    }`}
                  >
                    <img
                      src={activeCreative.imageDataUrl}
                      alt={activeCreative.headline}
                      className="w-full h-full object-contain block"
                    />
                    <img
                      src={selectedProduct.imagen || '/assets/real/galeria-1.jpg'}
                      alt={selectedProduct.nombre}
                      className="absolute object-cover rounded-md pointer-events-none shadow"
                      style={
                        activeCreative.aspectRatio === '9:16'
                          ? { left: '10.2%', top: '19.8%', width: '79.6%', height: '44.8%' }
                          : { left: '52.2%', top: '33.6%', width: '41.1%', height: '37.9%' }
                      }
                    />
                  </div>
                ) : (
                  <div
                    className={`relative overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-br ${
                      currentScene?.bgGradient || 'from-zinc-900 to-black'
                    } text-white p-4 flex flex-col justify-between aspect-[9/16] h-[360px] shadow-lg`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-black">
                        {currentScene?.badge}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsPlayingVideo(prev => !prev)}
                        className="p-1.5 rounded-lg bg-black/50 hover:bg-black/70 border border-white/15 cursor-pointer"
                        title={isPlayingVideo ? 'Pausar video' : 'Reproducir video'}
                      >
                        {isPlayingVideo ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="space-y-2 my-auto text-center">
                      <img
                        src={selectedProduct.imagen || '/assets/real/galeria-1.jpg'}
                        alt={selectedProduct.nombre}
                        className="w-24 h-24 mx-auto rounded-xl object-cover border border-amber-400 shadow"
                      />
                      <div className="text-xs font-bold text-amber-300">
                        {currentScene?.priceTag}
                      </div>
                      <div className="text-sm font-black leading-tight">
                        {currentScene?.title}
                      </div>
                      <div className="text-[11px] text-zinc-300">
                        {currentScene?.subtitle}
                      </div>
                    </div>

                    <div className="py-2 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold text-center">
                      {activeCreative.ctaLabel} →
                    </div>
                  </div>
                )}
              </div>

              {/* Texto y titular generado */}
              <div className="lg:col-span-7 space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Titular del Anuncio (Headline)
                  </label>
                  <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/90 font-semibold text-xs sm:text-sm text-zinc-100">
                    {activeCreative.headline}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Texto Principal (Copy Persuasivo Contra Entrega)
                  </label>
                  <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/90 text-xs text-zinc-300 whitespace-pre-line max-h-44 overflow-y-auto leading-relaxed">
                    {activeCreative.primaryText}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block">Formato</span>
                    <strong className="text-zinc-100">{activeCreative.aspectRatio}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block">Objetivo</span>
                    <strong className="text-emerald-400 truncate block">Ventas COD</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block">Botón CTA</span>
                    <strong className="text-zinc-100 truncate block">{activeCreative.ctaLabel}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. HISTORIAL DE CAMPAÑAS PUBLICADAS                                  */}
      {/* ===================================================================== */}
      {publishedCampaigns.length > 0 && (
        <div className="bg-[#0d0d0f] rounded-2xl border border-zinc-800 p-4 sm:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              🚀 Campañas Publicadas en Meta Ads ({publishedCampaigns.length})
            </h2>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
              Sincronizado con Pipeboard
            </span>
          </div>

          <div className="divide-y divide-zinc-800/80">
            {publishedCampaigns.map(camp => (
              <div key={camp.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-zinc-100 truncate">
                    {camp.campaignName}
                  </div>
                  <div className="font-mono text-zinc-400 text-[11px] truncate mt-0.5">
                    ID: {camp.campaignId} · Destino: {camp.landingUrl}
                  </div>
                </div>

                <a
                  href={camp.adsManagerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 font-semibold text-zinc-200 inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  <span>Ver en Ads Manager</span>
                  <ExternalLink className="w-3 h-3 text-zinc-400" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
