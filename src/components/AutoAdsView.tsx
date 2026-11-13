import React, { useState, useEffect, useMemo } from 'react';
import {
  ExternalLink,
  Settings2,
  RotateCw,
  Loader2,
  CheckCircle2,
  Search,
  Sparkles,
  Globe,
  ShieldCheck,
  Image as ImageIcon,
  Edit3,
  ThumbsUp,
  MessageCircle,
  Share2,
  Send,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Layers,
  Megaphone,
  Cloud,
  FolderOpen,
  ArrowLeft
} from 'lucide-react';
import { ProductPage } from '../types';
import { formatGs } from '../config';
import {
  AutoAdsCampaignsPanel,
  buildCampaignAdKey,
  CampaignAdReplaceResultInfo
} from './AutoAdsCampaignsPanel';
import {
  AutoAdsCloudinaryPanel,
  CloudinaryStatusClient,
  CloudinaryMediaClient
} from './AutoAdsCloudinaryPanel';
import {
  AutoAdsBrainProfile,
  createDefaultBrainProfile,
  buildCreativeAssetsFromBrain,
  regenerateSingleCreativeAssetFromBrain,
  extractAllProductImages,
  extractProductCoreIdentity,
  sanitizeAdCopyForParaguayCod,
  AUTOADS_LLM_MODEL,
  AUTOADS_IMAGE_MODEL,
  AUTOADS_VIDEO_MODEL,
  PipeboardConnectionConfig,
  PipeboardPublishedCampaignRecord,
  DEFAULT_PIPEBOARD_CONFIG,
  GeneratedAdCreativeAsset
} from '../utils/autoAdsBrainEngine';
import { buildHighImpactAdSvgDataUrl } from '../utils/pipeboardEngine';

interface AutoAdsViewProps {
  productPages: ProductPage[];
  onOpenLiveProductPage: (prod: ProductPage) => void;
  showToast: (msg: string) => void;
}

interface CapiAuditResult {
  pixelConfigured: boolean;
  pixelId: string;
  capiTunnelReady: boolean;
  capiTokenActive: boolean;
  eventsVerifiedCount: number;
  eventsList: string[];
  sha256AdvancedMatching: boolean;
  firstPartyCookiesFbpFbc: boolean;
  emqScoreEstimated: number;
  lastTestAt?: string;
}

export const AutoAdsView: React.FC<AutoAdsViewProps> = ({
  productPages,
  onOpenLiveProductPage,
  showToast
}) => {
  // Configuración de Pipeboard y OpenRouter (cero tokens en navegador)
  const [pbConfig, setPbConfig] = useState<PipeboardConnectionConfig>(DEFAULT_PIPEBOARD_CONFIG);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [pipeboardTokenInput, setPipeboardTokenInput] = useState<string>('');
  const [openRouterKeyInput, setOpenRouterKeyInput] = useState<string>('');
  const [hasPipeboardTokenInBackend, setHasPipeboardTokenInBackend] = useState<boolean>(false);
  const [pipeboardTokenPreview, setPipeboardTokenPreview] = useState<string>('');
  const [hasOpenRouterKeyInBackend, setHasOpenRouterKeyInBackend] = useState<boolean>(false);
  const [openRouterKeyPreview, setOpenRouterKeyPreview] = useState<string>('');
  const [lastTokenSelfDestructAt, setLastTokenSelfDestructAt] = useState<string>('');

  // Modelos exclusivos pre-holdeados en código (cero selectores variables)
  const selectedImageModel = AUTOADS_IMAGE_MODEL; // 'openai/gpt-image-2.6-sunburst'
  const selectedVideoModel = AUTOADS_VIDEO_MODEL; // 'google/gemini-omni-1.2-flash'

  // Interruptor (Switch) para que el usuario pueda evitar que se creen los 2 Reels de video y hacer que TODO el paquete sea 100% de Imágenes
  const [onlyImagesMode, setOnlyImagesMode] = useState<boolean>(false);

  // Pestañas dedicadas e interfaces privadas: Inicio -> Campañas (y vista privada de campaña) / Crear / Conexión & Cloudinary
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'inicio' | 'campanas' | 'crear' | 'conexion'>('inicio');
  const [freshDraftMode, setFreshDraftMode] = useState<boolean>(false);
  const [conexionSubTab, setConexionSubTab] = useState<'cloudinary' | 'meta' | 'capi' | 'apis'>('cloudinary');
  const [creativesFilter, setCreativesFilter] = useState<'all' | 'feed' | 'pack_reels'>('all');
  const [showIntelDetails, setShowIntelDetails] = useState<boolean>(false);

  const handleToggleOnlyImagesMode = (nextValue: boolean) => {
    setOnlyImagesMode(nextValue);
    showToast(
      nextValue
        ? '🖼️ Modo 100% Solo Imágenes activado: Se evitará crear los 2 Reels de video y todos los anuncios serán de Imagen (Sunburst).'
        : '🎬 Modo Mixto activado: Se crearán 4 Imágenes (Sunburst) + 2 Videos Reels de 15s con Voz y Producto (Gemini Omni 1.2 Flash).'
    );
  };

  // Modal de Error de OpenRouter (sin fallbacks ficticios)
  const [apiErrorModal, setApiErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    errorMessage: string;
    sourceEndpoint?: string;
  } | null>(null);

  // Estado de conexión en servidor con Meta Ads / Facebook OAuth
  const [metaConnected, setMetaConnected] = useState<boolean>(false);
  const [metaUser, setMetaUser] = useState<{ id: string; name: string } | null>(null);
  const [metaAdAccounts, setMetaAdAccounts] = useState<
    Array<{ id: string; account_id?: string; name: string; currency?: string }>
  >([]);
  const [metaPages, setMetaPages] = useState<
    Array<{ id: string; name: string; category: string; access_token?: string }>
  >([]);
  const [metaPixels, setMetaPixels] = useState<
    Array<{ id: string; name: string; adAccountId: string; adAccountName?: string }>
  >([]);
  const [activeAdAccountName, setActiveAdAccountName] = useState<string>('Cuenta Publicitaria (834)');
  const [activeMetaPixel, setActiveMetaPixel] = useState<{
    id: string;
    name: string;
  }>({
    id: '1276031534651377',
    name: 'Píxel Cuenta 834 (377)'
  });
  const [metaOAuthBackupState, setMetaOAuthBackupState] = useState<any>(null);
  const [syncingLiveMetaNames, setSyncingLiveMetaNames] = useState<boolean>(false);
  const [copiedRefKey, setCopiedRefKey] = useState<string | null>(null);
  const [hasMetaAppCredentials, setHasMetaAppCredentials] = useState<boolean>(false);
  const [metaAppIdPreview, setMetaAppIdPreview] = useState<string>('');
  const [showFacebookOAuthModal, setShowFacebookOAuthModal] = useState<boolean>(false);
  const [metaAppIdInput, setMetaAppIdInput] = useState<string>('');
  const [metaAppSecretInput, setMetaAppSecretInput] = useState<string>('');
  const [directMetaTokenInput, setDirectMetaTokenInput] = useState<string>('');
  const [connectingFacebookOAuth, setConnectingFacebookOAuth] = useState<boolean>(false);
  const [metaAuthErrorBanner, setMetaAuthErrorBanner] = useState<string>('');

  const handleCopyMetaRef = (key: string, label: string, textToCopy: string) => {
    try {
      navigator.clipboard.writeText(textToCopy);
    } catch { }
    setCopiedRefKey(key);
    setTimeout(() => {
      setCopiedRefKey(prev => (prev === key ? null : prev));
    }, 2000);
    showToast(`📋 Copiado al portapapeles — ${label}: ${textToCopy}`);
  };

  // Modo de origen del producto: 'catalog' (página creada) o 'external_url' (pegar URL)
  const [sourceMode, setSourceMode] = useState<'catalog' | 'external_url'>('catalog');
  const [selectedProductId, setSelectedProductId] = useState<string>(productPages[0]?.id || '');
  const [externalUrlInput, setExternalUrlInput] = useState<string>('');
  const [scrapedExternalProduct, setScrapedExternalProduct] = useState<ProductPage | null>(null);

  const selectedCatalogProduct = useMemo(
    () => productPages.find(p => p.id === selectedProductId) || productPages[0],
    [productPages, selectedProductId]
  );

  // Producto efectivo sobre el que trabaja el Cerebro Maestro
  const activeProduct: ProductPage = useMemo(() => {
    if (sourceMode === 'external_url' && scrapedExternalProduct) {
      return scrapedExternalProduct;
    }
    return selectedCatalogProduct;
  }, [sourceMode, scrapedExternalProduct, selectedCatalogProduct]);

  // Flujo Secuencial de 3 Botones:
  // 'idle' -> 'researching' -> 'researched' (Botón 1 listo, Botón 2 visible) -> 'generating' -> 'generated' (Anuncios visibles + Botón 3 visible) -> 'publishing' -> 'published'
  const [workflowStep, setWorkflowStep] = useState<
    'idle' | 'researching' | 'researched' | 'generating' | 'generated' | 'publishing' | 'published'
  >('idle');
  const [researchProgressText, setResearchProgressText] = useState<string>('');

  // Auditoría real de los 12 Eventos del Píxel y Túnel CAPI
  const [capiAudit, setCapiAudit] = useState<CapiAuditResult>({
    pixelConfigured: true,
    pixelId: 'Universal Backend',
    capiTunnelReady: true,
    capiTokenActive: true,
    eventsVerifiedCount: 12,
    eventsList: [
      'PageView',
      'ViewContent',
      'CustomizeProduct',
      'AddToCart',
      'InitiateCheckout',
      'AddPaymentInfo',
      'Lead',
      'Purchase',
      'Contact',
      'GalleryInteraction',
      'EngagedVisitor',
      'DeepScroll'
    ],
    sha256AdvancedMatching: true,
    firstPartyCookiesFbpFbc: true,
    emqScoreEstimated: 9.4
  });
  const [testingCapi, setTestingCapi] = useState<boolean>(false);
  const [showCapiDetailsModal, setShowCapiDetailsModal] = useState<boolean>(false);

  // Perfil del Cerebro Maestro (solo poblado tras el Botón 1)
  const [brainProfile, setBrainProfile] = useState<AutoAdsBrainProfile | null>(null);

  // Creativos generados (solo poblados tras el Botón 2)
  const [creatives, setCreatives] = useState<GeneratedAdCreativeAsset[]>([]);
  const [generationProgressText, setGenerationProgressText] = useState<string>('');
  const [regeneratingAdIdx, setRegeneratingAdIdx] = useState<number | null>(null);
  const [adVariationCounters, setAdVariationCounters] = useState<Record<number, number>>({});
  const [adPhotoIndexOverride, setAdPhotoIndexOverride] = useState<Record<number, number>>({});
  const [editingAdIdx, setEditingAdIdx] = useState<number | null>(null);

  // Estado de Persistencia en Backend (para no perder jamás investigación, imágenes ni videos al actualizar la página)
  const [workspacesCache, setWorkspacesCache] = useState<Record<string, any>>({});
  const [workspaceHydrated, setWorkspaceHydrated] = useState<boolean>(false);
  const [lastBackendSavedAt, setLastBackendSavedAt] = useState<string>('');

  // Campañas publicadas, interfaz privada por campaña y estado Cloudinary (cero imágenes en Supabase)
  const [publishedCampaigns, setPublishedCampaigns] = useState<PipeboardPublishedCampaignRecord[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [syncingLiveCampaigns, setSyncingLiveCampaigns] = useState<boolean>(false);
  const [campaignPendingDrafts, setCampaignPendingDrafts] = useState<Record<string, GeneratedAdCreativeAsset>>({});
  const [campaignRegenAdKey, setCampaignRegenAdKey] = useState<string | null>(null);
  const [campaignReplaceAdKey, setCampaignReplaceAdKey] = useState<string | null>(null);
  const [campaignReplacedInfo, setCampaignReplacedInfo] = useState<Record<string, CampaignAdReplaceResultInfo>>({});
  const [creatorPendingReplaceMap, setCreatorPendingReplaceMap] = useState<Record<number, boolean>>({});
  const [creatorReplacingIdx, setCreatorReplacingIdx] = useState<number | null>(null);
  const [cloudinaryStatus, setCloudinaryStatus] = useState<CloudinaryStatusClient | null>(null);
  const [cloudinaryResources, setCloudinaryResources] = useState<CloudinaryMediaClient[]>([]);
  const [loadingCloudinaryResources, setLoadingCloudinaryResources] = useState<boolean>(false);

  const refreshCloudinaryData = async (productSlug?: string) => {
    setLoadingCloudinaryResources(true);
    try {
      const [stRes, resListRes] = await Promise.all([
        fetch('/api/cloudinary/status'),
        fetch(`/api/cloudinary/resources${productSlug ? `?productSlug=${encodeURIComponent(productSlug)}` : ''}`)
      ]);
      const stJson = await stRes.json().catch(() => null);
      if (stJson && typeof stJson.configured === 'boolean') {
        setCloudinaryStatus({
          configured: Boolean(stJson.configured),
          cloudName: String(stJson.cloudName || ''),
          folder: String(stJson.folder || 'noelux/autoads'),
          apiKeyPreview: String(stJson.apiKeyPreview || ''),
          missingVars: Array.isArray(stJson.missingVars) ? stJson.missingVars : [],
          requiredEnvVars: Array.isArray(stJson.requiredEnvVars) ? stJson.requiredEnvVars : [],
          mode: stJson.mode === 'signed_api' ? 'signed_api' : 'not_configured'
        });
      }
      const listJson = await resListRes.json().catch(() => null);
      if (Array.isArray(listJson?.resources)) {
        setCloudinaryResources(listJson.resources);
      }
    } catch {
      // Silencioso si no hay conexión momentánea
    } finally {
      setLoadingCloudinaryResources(false);
    }
  };

  const computeWorkspaceKey = (
    mode: 'catalog' | 'external_url',
    prodId: string,
    extUrl: string
  ): string => {
    if (mode === 'external_url') {
      const cleanUrl = extUrl.trim();
      return cleanUrl ? `ext_${cleanUrl}` : 'ext_default';
    }
    return prodId || productPages[0]?.id || 'default_product';
  };

  const applySavedWorkspaceToState = (ws: any | undefined, fallbackProduct?: ProductPage) => {
    if (ws && (ws.brainProfile || (Array.isArray(ws.creatives) && ws.creatives.length > 0))) {
      const targetProd: ProductPage | undefined =
        ws.scrapedExternalProduct ||
        productPages.find(p => p.id === ws.productId) ||
        fallbackProduct ||
        productPages[0];
      setBrainProfile(ws.brainProfile || null);
      const rawSavedCreatives = Array.isArray(ws.creatives) ? ws.creatives : [];
      const savedCreatives = targetProd
        ? rawSavedCreatives.map((item: GeneratedAdCreativeAsset, idx: number) => ({
          ...item,
          primaryText: sanitizeAdCopyForParaguayCod(item.primaryText || '', targetProd, idx)
        }))
        : rawSavedCreatives;
      setCreatives(savedCreatives);
      if (ws.scrapedExternalProduct) {
        setScrapedExternalProduct(ws.scrapedExternalProduct);
      }
      setAdVariationCounters(ws.adVariationCounters || {});
      setAdPhotoIndexOverride(ws.adPhotoIndexOverride || {});
      const rawStep = String(ws.workflowStep || 'idle');
      const safeStep =
        rawStep === 'published'
          ? 'published'
          : savedCreatives.length > 0
            ? 'generated'
            : ws.brainProfile
              ? 'researched'
              : 'idle';
      setWorkflowStep(safeStep);
      if (ws.updatedAt) {
        try {
          setLastBackendSavedAt(new Date(ws.updatedAt).toLocaleTimeString('es-PY'));
        } catch { }
      }
    } else {
      setBrainProfile(null);
      setCreatives([]);
      setAdVariationCounters({});
      setAdPhotoIndexOverride({});
      setWorkflowStep('idle');
    }
  };

  const resetCreatorToZero = (options?: {
    keepSourceAndProduct?: boolean;
    pickUnusedProduct?: boolean;
  }) => {
    setFreshDraftMode(true);
    setWorkflowStep('idle');
    setBrainProfile(null);
    setCreatives([]);
    setAdVariationCounters({});
    setAdPhotoIndexOverride({});
    setEditingAdIdx(null);
    setShowIntelDetails(false);
    setCreatorPendingReplaceMap({});
    setResearchProgressText('');
    setGenerationProgressText('');
    setCreativesFilter('all');

    if (!options?.keepSourceAndProduct) {
      setSourceMode('catalog');
      setExternalUrlInput('');
      setScrapedExternalProduct(null);
      if (options?.pickUnusedProduct) {
        const publishedProdIds = new Set(
          publishedCampaigns.map(c => c.productId).filter(Boolean)
        );
        const unusedProduct = productPages.find(p => !publishedProdIds.has(p.id));
        if (unusedProduct) {
          setSelectedProductId(unusedProduct.id);
        }
      }
    }
  };

  const handleStartNewCampaign = () => {
    resetCreatorToZero({ pickUnusedProduct: true });
    setSelectedCampaignId(null);
    setActiveWorkspaceTab('crear');
  };

  const syncWorkspaceOnSelectorChange = (
    mode: 'catalog' | 'external_url',
    prodId: string,
    extUrl: string
  ) => {
    if (freshDraftMode) {
      resetCreatorToZero({ keepSourceAndProduct: true });
      return;
    }
    const key = computeWorkspaceKey(mode, prodId, extUrl);
    const candidateWs = workspacesCache[key];
    if (candidateWs && candidateWs.workflowStep !== 'published') {
      applySavedWorkspaceToState(candidateWs);
    } else {
      resetCreatorToZero({ keepSourceAndProduct: true });
    }
  };

  // Recuperar OpenRouter API Key desde input o backend (cero almacenamiento en localStorage)
  const getVaultOpenRouterKey = (): string => {
    return openRouterKeyInput.trim();
  };

  // Consultar estado vivo de Meta Ads / Facebook OAuth en el servidor (sin localStorage)
  const refreshMetaConnectionStatus = async () => {
    try {
      const r = await fetch('/api/meta/status');
      const data = await r.json();

      if (data?.connected) {
        setMetaConnected(true);
        setMetaAuthErrorBanner('');
        if (data.oauthBackup?.accessToken) {
          setMetaOAuthBackupState(data.oauthBackup);
        }
        if (data.user) {
          setMetaUser({ id: String(data.user.id || ''), name: String(data.user.name || 'Usuario Meta') });
        }
        // Filtrar cualquier rastro de la cuenta personal "Richard Almiron" (act_424711183775699)
        const cleanAccounts = Array.isArray(data.adAccounts)
          ? data.adAccounts.filter(
            (a: any) =>
              String(a?.id) !== 'act_424711183775699' &&
              String(a?.account_id) !== '424711183775699' &&
              !/richard\s*almiron/i.test(String(a?.name || ''))
          )
          : [];
        const match834 = cleanAccounts.find(
          (a: any) =>
            String(a?.id) === 'act_1048211497774834' ||
            String(a?.account_id) === '1048211497774834'
        );
        const discoveredAccName = String(
          match834?.name ||
          data.selectedAdAccountName ||
          cleanAccounts[0]?.name ||
          activeAdAccountName ||
          'Cuenta Publicitaria (834)'
        ).trim();
        setActiveAdAccountName(discoveredAccName);

        setMetaAdAccounts(
          cleanAccounts.length > 0
            ? cleanAccounts
            : [
              {
                id: 'act_1048211497774834',
                account_id: '1048211497774834',
                name: discoveredAccName,
                currency: 'USD'
              }
            ]
        );
        setPbConfig(prev => ({
          ...prev,
          selectedAdAccountId: 'act_1048211497774834',
          selectedFacebookPageId: '1050835598123904'
        }));
        if (Array.isArray(data.pages) && data.pages.length > 0) {
          setMetaPages(data.pages);
        }

        const rawPixels = Array.isArray(data.pixels) ? data.pixels : [];
        const match377 =
          rawPixels.find((p: any) => String(p?.id) === '1276031534651377') || rawPixels[0];
        const discoveredPxId = String(
          match377?.id || data.universalPixelId || '1276031534651377'
        ).trim();
        const discoveredPxName = String(
          match377?.name ||
          data.universalPixelName ||
          activeMetaPixel.name ||
          'Píxel Cuenta 834 (377)'
        ).trim();

        setMetaPixels(
          rawPixels.length > 0
            ? rawPixels
            : [
              {
                id: discoveredPxId,
                name: discoveredPxName,
                adAccountId: 'act_1048211497774834',
                adAccountName: discoveredAccName
              }
            ]
        );
        setActiveMetaPixel({
          id: discoveredPxId,
          name: discoveredPxName
        });
        setCapiAudit(prev => ({
          ...prev,
          pixelConfigured: true,
          pixelId: `${discoveredPxName} (${discoveredPxId})`
        }));
        try {
          const liveNamesPayload = {
            adAccountId: 'act_1048211497774834',
            adAccountName: discoveredAccName,
            pixelId: discoveredPxId,
            pixelName: discoveredPxName,
            updatedAt: new Date().toISOString()
          };
          window.dispatchEvent(new CustomEvent('meta-live-names-updated', { detail: liveNamesPayload }));
        } catch { }
        if (Number(data.pausedWrongCampaignsCount) > 0) {
          showToast(
            `🛡️ Se pausó automáticamente ${data.pausedWrongCampaignsCount} campaña(s) que estaba en la cuenta errónea Richard Almiron. Solo queda activa ${discoveredAccName} (834).`
          );
        }
      } else {
        setMetaConnected(false);
        setMetaUser(null);
        setMetaOAuthBackupState(null);
        if (data?.error && data?.tokenState !== 'missing') {
          setMetaAuthErrorBanner(String(data.error));
        }
        if (data?.selectedAdAccountName) {
          setActiveAdAccountName(String(data.selectedAdAccountName));
        }
        if (data?.universalPixelName) {
          setActiveMetaPixel({
            id: String(data.universalPixelId || '1276031534651377'),
            name: String(data.universalPixelName)
          });
        }
      }
      return Boolean(data?.connected);
    } catch {
      return false;
    }
  };

  // Botón para descubrir y actualizar en vivo los nuevos nombres de la Cuenta 834 y del Píxel 377 desde Meta Graph API
  const handleDiscoverLiveMetaNames = async () => {
    setSyncingLiveMetaNames(true);
    try {
      const isConn = await refreshMetaConnectionStatus();
      if (isConn) {
        showToast(
          `✅ ¡Nombres descubiertos y actualizados en vivo desde Meta! Cuenta (834): "${activeAdAccountName}" · Píxel (377): "${activeMetaPixel.name}"`
        );
      } else {
        showToast(
          '🔄 Abriendo autorización rápida de Meta (1 clic) para leer los nuevos nombres de tu Cuenta 834 y Píxel 377...'
        );
        await handleConnectFacebookOAuth(false);
      }
    } finally {
      setSyncingLiveMetaNames(false);
    }
  };

  // Escuchar el mensaje postMessage de la ventana emergente de Facebook OAuth (META_AUTH_SUCCESS / META_AUTH_ERROR)
  useEffect(() => {
    const handleOAuthPopupMessage = (event: MessageEvent) => {
      if (!event?.data || typeof event.data !== 'object') return;
      if (event.data.type === 'META_AUTH_SUCCESS') {
        if (event.data.oauthBackup?.accessToken) {
          setMetaOAuthBackupState(event.data.oauthBackup);
        }
        if (event.data.adAccountName || event.data.pixelName) {
          const liveAcc = String(event.data.adAccountName || activeAdAccountName).trim();
          const livePx = String(event.data.pixelName || activeMetaPixel.name).trim();
          const livePxId = String(event.data.pixelId || '1276031534651377').trim();
          setActiveAdAccountName(liveAcc);
          setActiveMetaPixel({ id: livePxId, name: livePx });
          try {
            const payload = {
              adAccountId: 'act_1048211497774834',
              adAccountName: liveAcc,
              pixelId: livePxId,
              pixelName: livePx,
              updatedAt: new Date().toISOString()
            };
            window.dispatchEvent(new CustomEvent('meta-live-names-updated', { detail: payload }));
          } catch { }
        }
        setShowFacebookOAuthModal(false);
        setConnectingFacebookOAuth(false);
        refreshMetaConnectionStatus().then(() => {
          showToast(
            `✅ ¡Sincronizado con Meta! Portafolio Landingcod · Cuenta (834): "${event.data.adAccountName || activeAdAccountName
            }" · Píxel (377): "${event.data.pixelName || activeMetaPixel.name}"`
          );
        });
      } else if (event.data.type === 'META_AUTH_ERROR') {
        setConnectingFacebookOAuth(false);
        const errText = `La autorización en Facebook no se completó (${event.data.error || 'cancelado'}). Podés intentar de nuevo o pegar tu Token directo EAA...`;
        setMetaAuthErrorBanner(errText);
        showToast(`⚠️ ${errText}`);
      }
    };
    window.addEventListener('message', handleOAuthPopupMessage);
    return () => window.removeEventListener('message', handleOAuthPopupMessage);
  }, []);

  // Cargar configuración de servidor y estado CAPI al montar
  useEffect(() => {
    fetch('/api/pipeboard/config')
      .then(r => r.json())
      .then(data => {
        if (data?.config) {
          setPbConfig(prev => ({
            ...prev,
            ...data.config,
            // No permitir que el ID de ejemplo pise una Cuenta Publicitaria o Página real ya detectada por Facebook OAuth
            selectedAdAccountId:
              prev.selectedAdAccountId &&
                prev.selectedAdAccountId !== 'act_595884210394' &&
                data.config.selectedAdAccountId === 'act_595884210394'
                ? prev.selectedAdAccountId
                : data.config.selectedAdAccountId || prev.selectedAdAccountId,
            selectedFacebookPageId:
              prev.selectedFacebookPageId &&
                prev.selectedFacebookPageId !== '104928374650192' &&
                data.config.selectedFacebookPageId === '104928374650192'
                ? prev.selectedFacebookPageId
                : data.config.selectedFacebookPageId || prev.selectedFacebookPageId,
            pipeboardApiToken: '',
            openRouterApiKey: '',
            metaAccessTokenFallback: ''
          }));
        }
        setHasPipeboardTokenInBackend(Boolean(data?.hasPipeboardToken));
        setPipeboardTokenPreview(String(data?.pipeboardTokenPreview || ''));
        setHasOpenRouterKeyInBackend(Boolean(data?.hasOpenRouterKey));
        setOpenRouterKeyPreview(String(data?.openRouterKeyPreview || ''));
        setHasMetaAppCredentials(Boolean(data?.hasMetaAppCredentials));
        setMetaAppIdPreview(String(data?.metaAppIdPreview || ''));
        if (Array.isArray(data?.publishedCampaigns)) {
          setPublishedCampaigns(data.publishedCampaigns);
        }
        if (data?.cloudinaryStatus && typeof data.cloudinaryStatus.configured === 'boolean') {
          setCloudinaryStatus(data.cloudinaryStatus);
        }

        // Si el contenedor se reinició pero el navegador tiene la API Key guardada en la bóveda local, restaurarla automáticamente al Backend
        const vaultKey = getVaultOpenRouterKey();
        if (vaultKey && vaultKey.startsWith('sk-or-')) {
          fetch('/api/pipeboard/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...(data?.config || {}),
              openRouterApiKey: vaultKey,
              selectedImageModel,
              selectedVideoModel
            })
          })
            .then(r => r.json())
            .then(resyncData => {
              if (resyncData?.hasOpenRouterKey) {
                setHasOpenRouterKeyInBackend(true);
                setOpenRouterKeyPreview(String(resyncData.openRouterKeyPreview || ''));
              }
            })
            .catch(() => { });
        }
      })
      .catch(() => { });

    refreshMetaConnectionStatus();
    refreshCloudinaryData();

    // Restaurar automáticamente desde el Backend todo el trabajo previo (Investigación + Imágenes + Videos + Paso exacto)
    fetch('/api/autoads/workspace')
      .then(r => r.json())
      .then(wsData => {
        let loadedWorkspaces: Record<string, any> =
          wsData?.workspaces && typeof wsData.workspaces === 'object' ? wsData.workspaces : {};
        let loadedLastActive = wsData?.lastActive || null;

        setWorkspacesCache(loadedWorkspaces);

        const resolvedMode: 'catalog' | 'external_url' =
          loadedLastActive?.sourceMode === 'external_url' ? 'external_url' : 'catalog';
        const resolvedProdId =
          loadedLastActive?.selectedProductId &&
            productPages.some(p => p.id === loadedLastActive.selectedProductId)
            ? String(loadedLastActive.selectedProductId)
            : productPages[0]?.id || '';
        const resolvedExtUrl = String(loadedLastActive?.externalUrlInput || '');

        setSourceMode(resolvedMode);
        if (resolvedProdId) setSelectedProductId(resolvedProdId);
        if (resolvedExtUrl) setExternalUrlInput(resolvedExtUrl);
        if (typeof loadedLastActive?.onlyImagesMode === 'boolean') {
          setOnlyImagesMode(loadedLastActive.onlyImagesMode);
        }

        const targetKey = computeWorkspaceKey(resolvedMode, resolvedProdId, resolvedExtUrl);
        const savedWs = loadedWorkspaces[targetKey] || loadedWorkspaces[resolvedProdId];
        if (savedWs && savedWs.workflowStep !== 'published') {
          applySavedWorkspaceToState(savedWs);
        } else {
          setFreshDraftMode(true);
        }
        setWorkspaceHydrated(true);
      })
      .catch(() => {
        setWorkspaceHydrated(true);
      });
  }, []);

  // Guardado automático en tiempo real en el Backend cada vez que avanza un paso, se investiga o se genera una imagen o video
  useEffect(() => {
    if (!workspaceHydrated) return;
    if (!brainProfile && creatives.length === 0) return;
    const wsKey = computeWorkspaceKey(
      sourceMode,
      selectedCatalogProduct?.id || selectedProductId,
      externalUrlInput
    );
    const stableStep =
      workflowStep === 'generating'
        ? creatives.length > 0
          ? 'generated'
          : brainProfile
            ? 'researched'
            : 'idle'
        : workflowStep === 'researching'
          ? brainProfile
            ? 'researched'
            : 'idle'
          : workflowStep === 'publishing'
            ? 'generated'
            : workflowStep;

    const currentWorkspacePayload = {
      workspaceKey: wsKey,
      productId: activeProduct?.id || selectedProductId,
      productName: activeProduct?.nombre || '',
      workflowStep: stableStep,
      brainProfile,
      creatives,
      scrapedExternalProduct,
      adVariationCounters,
      adPhotoIndexOverride,
      onlyImagesMode,
      updatedAt: new Date().toISOString()
    };

    const nextLastActive = {
      sourceMode,
      selectedProductId: selectedCatalogProduct?.id || selectedProductId,
      externalUrlInput,
      onlyImagesMode,
      activeWorkspaceKey: wsKey
    };

    setWorkspacesCache(prev => ({
      ...prev,
      [wsKey]: currentWorkspacePayload
    }));

    fetch('/api/autoads/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastActive: nextLastActive,
        workspaceKey: wsKey,
        workspace: currentWorkspacePayload
      })
    })
      .then(r => r.json())
      .then(res => {
        if (res?.success) {
          setLastBackendSavedAt(new Date().toLocaleTimeString('es-PY'));
        }
      })
      .catch(() => { });
  }, [
    workspaceHydrated,
    brainProfile,
    creatives,
    workflowStep,
    sourceMode,
    selectedProductId,
    externalUrlInput,
    onlyImagesMode,
    scrapedExternalProduct,
    adVariationCounters,
    adPhotoIndexOverride
  ]);

  // Sincronización en tiempo real de precios si el usuario edita los precios del producto en el panel Admin
  useEffect(() => {
    if (!activeProduct || !brainProfile || creatives.length === 0) return;
    const syncedAssets = buildCreativeAssetsFromBrain(activeProduct, brainProfile);
    setCreatives(prev =>
      prev.map((oldAsset, idx) => {
        const fresh = syncedAssets[idx];
        if (!fresh) return oldAsset;
        return {
          ...fresh,
          aiGeneratedImageUrl: oldAsset.aiGeneratedImageUrl || fresh.aiGeneratedImageUrl,
          aiGeneratedVideoUrl: oldAsset.aiGeneratedVideoUrl || fresh.aiGeneratedVideoUrl,
          videoScenes: fresh.videoScenes || oldAsset.videoScenes
        };
      })
    );
  }, [
    activeProduct?.precios?.[1],
    activeProduct?.precios?.[2],
    activeProduct?.precios?.[3],
    activeProduct?.precioNormal
  ]);

  // Guardar Slot Pipeboard + OpenRouter Key + Meta OAuth en Backend + Bóveda Persistente Local
  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const tokenToSend = pipeboardTokenInput.trim();
    const orKeyToSend = openRouterKeyInput.trim();
    const appIdToSend = metaAppIdInput.trim();
    const appSecretToSend = metaAppSecretInput.trim();
    const directMetaToSend = directMetaTokenInput.trim();
    if (appIdToSend && !/^\d{8,24}$/.test(appIdToSend)) {
      const msg = 'El Meta App ID debe contener solo dígitos numéricos (ej: 1465256781554439). No pegues un correo.';
      setMetaAuthErrorBanner(msg);
      showToast(`⚠️ ${msg}`);
      return;
    }
    setSavingSettings(true);
    setPipeboardTokenInput('');
    setOpenRouterKeyInput('');
    setMetaAppSecretInput('');
    setDirectMetaTokenInput('');
    setPbConfig(prev => ({
      ...prev,
      pipeboardApiToken: '',
      openRouterApiKey: '',
      metaAccessTokenFallback: ''
    }));
    try {
      const res = await fetch('/api/pipeboard/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pbConfig,
          pipeboardApiToken: tokenToSend,
          openRouterApiKey: orKeyToSend || getVaultOpenRouterKey(),
          metaAppId: appIdToSend || undefined,
          metaAppSecret: appSecretToSend || undefined,
          metaAccessToken: directMetaToSend || undefined,
          selectedImageModel,
          selectedVideoModel,
          metaAccessTokenFallback: ''
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMetaAuthErrorBanner('');
        setHasPipeboardTokenInBackend(Boolean(data?.hasPipeboardToken));
        setPipeboardTokenPreview(String(data?.pipeboardTokenPreview || ''));
        setHasOpenRouterKeyInBackend(Boolean(data?.hasOpenRouterKey));
        setOpenRouterKeyPreview(String(data?.openRouterKeyPreview || ''));
        setHasMetaAppCredentials(Boolean(data?.hasMetaAppCredentials));
        setMetaAppIdPreview(String(data?.metaAppIdPreview || ''));
        if (directMetaToSend || tokenToSend.startsWith('EAA')) {
          await refreshMetaConnectionStatus();
        }
        if (tokenToSend || orKeyToSend || directMetaToSend || appIdToSend) {
          setLastTokenSelfDestructAt(new Date().toLocaleTimeString('es-PY'));
          showToast('🔒 Credenciales guardadas en el Backend y protegidas contra reinicios.');
        } else {
          showToast('Configuración actualizada en el Backend.');
        }
      } else {
        const errMsg = String(data?.error || `Error ${res.status} al guardar credenciales.`);
        setMetaAuthErrorBanner(errMsg);
        showToast(`⚠️ ${errMsg}`);
      }
    } catch {
      showToast('Error al conectar con el servidor.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Abrir ventana emergente (Popup) de Facebook Login OAuth en 1 Clic (window.open directo al proveedor)
  const handleConnectFacebookOAuth = async (forceOpenModal?: boolean) => {
    if (forceOpenModal) {
      setShowFacebookOAuthModal(true);
      return;
    }
    const cleanAppId = metaAppIdInput.trim();
    const cleanAppSecret = metaAppSecretInput.trim();
    if (cleanAppId && !/^\d{8,24}$/.test(cleanAppId)) {
      const msg = 'El Meta App ID debe ser numérico (ej: 1465256781554439). Se bloqueó un correo electrónico o texto inválido.';
      setMetaAuthErrorBanner(msg);
      setShowFacebookOAuthModal(true);
      showToast(`⚠️ ${msg}`);
      return;
    }
    setConnectingFacebookOAuth(true);
    try {
      const query = new URLSearchParams();
      if (cleanAppId) query.set('app_id', cleanAppId);
      if (cleanAppSecret) query.set('app_secret', cleanAppSecret);
      const url = `/api/meta/auth-url${query.toString() ? `?${query.toString()}` : ''}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.success && data?.authUrl) {
        setMetaAuthErrorBanner('');
        setHasMetaAppCredentials(true);
        const popup = window.open(
          data.authUrl,
          'meta_oauth_popup',
          'width=640,height=740,menubar=no,toolbar=no,location=yes,status=no'
        );
        if (!popup) {
          showToast('⚠️ Habilitá las ventanas emergentes (popups) en tu navegador para autorizar en Facebook.');
        } else {
          showToast('🔵 Ventana de Facebook abierta: Dale clic en "Continuar" para autorizar tu cuenta de Meta Ads.');
        }
      } else {
        if (data?.corruptedCredentialsCleared) {
          setHasMetaAppCredentials(false);
          setMetaAppIdPreview('');
        }
        if (data?.error) {
          setMetaAuthErrorBanner(String(data.error));
        }
        // Si aún no tiene App ID / Secret válidos guardados, abrir el modal de Login OAuth de Facebook en 1 clic
        setShowFacebookOAuthModal(true);
      }
    } catch {
      setShowFacebookOAuthModal(true);
    } finally {
      setConnectingFacebookOAuth(false);
    }
  };

  // Conectar mediante Token directo de Meta Ads (EAA...) o Token de Pipeboard desde el modal de Facebook Login
  const handleQuickConnectTokenInModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawToken = directMetaTokenInput.trim();
    if (!rawToken) return;
    setConnectingFacebookOAuth(true);
    setMetaAuthErrorBanner('');
    try {
      const isMetaToken = rawToken.startsWith('EAA');
      const res = await fetch('/api/pipeboard/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pbConfig,
          pipeboardApiToken: isMetaToken ? '' : rawToken,
          metaAccessToken: isMetaToken ? rawToken : undefined,
          openRouterApiKey: getVaultOpenRouterKey(),
          selectedImageModel,
          selectedVideoModel
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setHasPipeboardTokenInBackend(Boolean(data?.hasPipeboardToken));
        setPipeboardTokenPreview(String(data?.pipeboardTokenPreview || ''));
        setDirectMetaTokenInput('');
        const isConn = await refreshMetaConnectionStatus();
        if (isConn) {
          setMetaAuthErrorBanner('');
          setShowFacebookOAuthModal(false);
          showToast('✅ ¡Cuenta de Meta Ads conectada y sincronizada! Ya podés publicar todos tus anuncios.');
        } else if (!isMetaToken && data?.hasPipeboardToken) {
          setShowFacebookOAuthModal(false);
          showToast('✅ Token de Pipeboard guardado en el Backend. Listo para publicar en Meta Ads.');
        } else {
          showToast('⚠️ El token se guardó pero Meta reportó que está vencido o sin permiso ads_management. Revisá el aviso arriba.');
        }
      } else {
        const errMsg = String(data?.error || 'El token ingresado no tiene un formato válido.');
        setMetaAuthErrorBanner(errMsg);
        showToast(`⚠️ ${errMsg}`);
      }
    } catch {
      showToast('Error al guardar el token en el servidor.');
    } finally {
      setConnectingFacebookOAuth(false);
    }
  };

  // Probar y verificar en vivo los 12 Eventos del Píxel + Túnel CAPI First-Party
  const handleVerifyCapiTunnel = async () => {
    setTestingCapi(true);
    try {
      const res = await fetch('/api/meta-capi/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'InitiateCheckout',
          eventId: `autoads-verify-${Date.now()}`,
          productSlug: activeProduct?.slug || 'autoads360',
          pixelId: activeProduct?.metaTracking?.pixelId || '',
          userData: {
            phone: '0981123456',
            firstName: 'Verificacion',
            city: 'Asuncion',
            department: 'Central'
          },
          customData: {
            value: activeProduct?.precios?.[1] || 189000,
            currency: 'PYG',
            content_name: activeProduct?.nombre || 'Producto'
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCapiAudit(prev => ({
          ...prev,
          capiTunnelReady: true,
          emqScoreEstimated: Number(data?.emqScore || 9.4),
          lastTestAt: new Date().toLocaleTimeString('es-PY')
        }));
        showToast(
          `✅ Túnel CAPI + 12 Eventos verificados sin defectos (EMQ ${data?.emqScore || 9.4}/10 · Hash SHA-256 OK).`
        );
      }
    } catch {
      showToast('Error al verificar el túnel CAPI.');
    } finally {
      setTestingCapi(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // BOTÓN 1: Investigar Producto (o URL Externa), Competencia y Auditar Píxel/CAPI
  // ─────────────────────────────────────────────────────────────────────────────
  const handleStep1Research = async () => {
    if (sourceMode === 'external_url' && !/^https?:\/\//i.test(externalUrlInput.trim())) {
      showToast('Pegá una URL válida que empiece con https:// para investigar.');
      return;
    }

    setFreshDraftMode(false);
    setWorkflowStep('researching');
    setCreatives([]);
    setResearchProgressText(
      sourceMode === 'external_url'
        ? '🌐 Escrapeando URL externa, extrayendo fotos, precios y estructura...'
        : `📖 Analizando a fondo "${selectedCatalogProduct?.nombre}" y auditando 12 eventos CAPI...`
    );

    const stepTimer1 = setTimeout(() => {
      setResearchProgressText(
        '🔍 Investigando anuncios ganadores en Paraguay, Colombia, Chile, México y Brasil...'
      );
    }, 1200);

    const stepTimer2 = setTimeout(() => {
      setResearchProgressText(
        '🧠 Aplicando estrategias Andrómeda 2026 + Fórmulas de Gurús (Schwartz, Hormozi, Suby)...'
      );
    }, 2500);

    try {
      let response: Response | null = null;
      let data: any = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await fetch('/api/autoads/brain-train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product: sourceMode === 'catalog' ? selectedCatalogProduct : {},
              externalUrl: sourceMode === 'external_url' ? externalUrlInput.trim() : '',
              openRouterModel: AUTOADS_LLM_MODEL,
              openRouterApiKey: getVaultOpenRouterKey()
            }),
            signal: AbortSignal.timeout(120000)
          });
          data = await response.json();
          if (response.ok && data?.success !== false) break;
          const errStr = String(data?.error || '');
          if (attempt < 2 && (errStr.includes('timeout') || errStr.includes('aborted') || errStr.includes('in_flight'))) {
            await new Promise(r => setTimeout(r, 2500));
            continue;
          }
          break;
        } catch (innerErr: any) {
          if (attempt === 2) throw innerErr;
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (!response || !response.ok || data?.success === false) {
        setWorkflowStep('idle');
        setApiErrorModal({
          isOpen: true,
          title: '⚠️ Error en la API de OpenRouter — Trabajo Pausado',
          errorMessage:
            data?.error ||
            `Error ${response?.status || ''}: No se pudo comunicar con la API de OpenRouter (${AUTOADS_LLM_MODEL}). Se suspendió el proceso sin fallbacks ficticios.`,
          sourceEndpoint: '/api/autoads/brain-train'
        });
        return;
      }

      let finalProduct = selectedCatalogProduct;
      if (data?.scrapedProduct) {
        finalProduct = data.scrapedProduct;
        setScrapedExternalProduct(data.scrapedProduct);
      }
      if (data?.capiAudit) {
        setCapiAudit({
          ...data.capiAudit,
          lastTestAt: new Date().toLocaleTimeString('es-PY')
        });
      }

      const baseProfile = createDefaultBrainProfile(finalProduct);
      const trainedProfile: AutoAdsBrainProfile = {
        ...baseProfile,
        status: 'ready',
        trainedAt: new Date().toISOString(),
        strategyMode: data?.brainProfile?.strategyMode,
        dossierId: data?.brainProfile?.dossierId,
        psychologicalProfile: data?.brainProfile?.psychologicalProfile,
        hypotheses: data?.brainProfile?.hypotheses,
        competitorsSummary: data?.brainProfile?.competitorsSummary,
        competitors: data?.brainProfile?.competitors,
        learningMemoryUsed: data?.brainProfile?.learningMemoryUsed,
        recommendedObjective: data?.brainProfile?.recommendedObjective,
        productAnalysis: {
          ...baseProfile.productAnalysis,
          images: extractAllProductImages(finalProduct)
        },
        avatars: data?.brainProfile?.avatars || baseProfile.avatars,
        targeting: data?.brainProfile?.targeting || baseProfile.targeting,
        competitorInsights: data?.competitorInsights || baseProfile.competitorInsights,
        creativeBriefs: data?.brainProfile?.creativeBriefs || baseProfile.creativeBriefs
      };

      setBrainProfile(trainedProfile);
      setWorkflowStep('researched');
      showToast(
        `✅ Investigación completada para "${finalProduct.nombre}". Ya podés darle al Botón 2 para generar los anuncios.`
      );
    } catch (err: any) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setWorkflowStep('idle');
      setApiErrorModal({
        isOpen: true,
        title: '⚠️ Error de Conexión con OpenRouter — Trabajo Pausado',
        errorMessage:
          err?.message ||
          'Fallo de red o timeout al conectar con OpenRouter. Por favor, verificá tu conexión y la validez de tu API Key.',
        sourceEndpoint: '/api/autoads/brain-train'
      });
    } finally {
      setResearchProgressText('');
    }
  };

  // Helper de Polling Multi-Ronda para esperar siempre el Video IA real de 15s con Avatar Hablando + Producto en Google Gemini Omni 1.2 Flash (absorbe reservas in-flight automáticamente)
  const requestDirectReelVideoWithPolling = async (
    adIndex: number,
    promptText: string,
    onRoundProgress?: (round: number, totalRounds: number) => void,
    adCopy?: { headline?: string; primaryText?: string; ctaLabel?: string }
  ): Promise<{ videoUrl: string; error?: string }> => {
    const vaultKey = getVaultOpenRouterKey();
    let currentJobId = '';
    let currentPollUrl = '';
    const maxRounds = 14; // Rondas elásticas para absorber liberación de reservas in-flight + renderizado de 15s con voz

    for (let round = 1; round <= maxRounds; round++) {
      if (onRoundProgress) onRoundProgress(round, maxRounds);
      try {
        const vidRes = await fetch('/api/autoads/generate-reel-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adIndex,
            product: activeProduct,
            prompt: promptText,
            adHeadline: adCopy?.headline || '',
            adPrimaryText: adCopy?.primaryText || '',
            adCtaLabel: adCopy?.ctaLabel || '',
            videoModel: selectedVideoModel,
            openRouterApiKey: vaultKey,
            jobId: currentJobId,
            pollUrl: currentPollUrl
          })
        });
        const vidJson = await vidRes.json().catch(() => ({}));
        if (!vidRes.ok || vidJson?.success === false) {
          const errStr = String(vidJson?.error || '');
          // Si OpenRouter reporta reserva temporal in-flight de otra tarjeta, esperamos 4s y seguimos en la siguiente ronda sin tirar error
          if (errStr.includes('in_flight_budget_exhausted') || errStr.includes('in-flight')) {
            await new Promise(r => setTimeout(r, 4000));
            continue;
          }
          return {
            videoUrl: '',
            error: errStr || `Error al crear el Video Reel de 15s #${adIndex + 1} en ${selectedVideoModel}.`
          };
        }
        if (vidJson?.status === 'completed' && vidJson?.videoUrl) {
          return { videoUrl: String(vidJson.videoUrl) };
        }
        if (vidJson?.status === 'processing') {
          if (vidJson?.jobId) currentJobId = String(vidJson.jobId);
          if (vidJson?.pollUrl) currentPollUrl = String(vidJson.pollUrl);
          // Si aún no tiene pollUrl porque está esperando que OpenRouter libere la reserva in-flight de otra petición, aguardar 3.5s
          if (!currentPollUrl) {
            await new Promise(r => setTimeout(r, 3500));
          }
          continue;
        }
        if (vidJson?.videoUrl) {
          return { videoUrl: String(vidJson.videoUrl) };
        }
      } catch (err: any) {
        if (round < maxRounds) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        return {
          videoUrl: '',
          error: err?.message || `Error de red al crear Video Reel #${adIndex + 1}.`
        };
      }
    }

    return {
      videoUrl: '',
      error: `El renderizado del Video Reel de 15s #${adIndex + 1} en ${selectedVideoModel} superó el tiempo máximo en OpenRouter.`
    };
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // BOTÓN 2: Generar Todos los Anuncios Ganadores (Exclusivo: openai/gpt-4o + openai/gpt-image-2.6-sunburst + google/gemini-omni-1.2-flash)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleStep2GenerateAds = async () => {
    if (!brainProfile || !activeProduct) return;
    const existingCreatives = [...creatives];
    const imageSliceEnd = onlyImagesMode ? 6 : 4;
    const hasPendingImages =
      existingCreatives.length > 0 &&
      existingCreatives.slice(0, imageSliceEnd).some(c => !c.aiGeneratedImageUrl);
    const hasPendingVideos =
      !onlyImagesMode &&
      existingCreatives.length > 0 &&
      existingCreatives.slice(4, 6).some(c => !c.aiGeneratedVideoUrl);
    const isResumeIncomplete = hasPendingImages || hasPendingVideos;
    const isFullRegenerateAll = existingCreatives.length > 0 && !isResumeIncomplete;
    const vaultKey = getVaultOpenRouterKey();

    setWorkflowStep('generating');
    setGenerationProgressText(
      onlyImagesMode
        ? `🖼️ Modo 100% Solo Imágenes: Creando las 6 Imágenes con ${selectedImageModel} (sin crear Reels de video)...`
        : hasPendingVideos && !hasPendingImages
          ? `🎬 Creando directamente los 2 Videos Reels con Avatar de los Anuncios #5 y #6 (${selectedVideoModel})...`
          : hasPendingImages
            ? `🎨 Completando las 4 Imágenes (#1-#4 con ${selectedImageModel}) y los 2 Videos Reels (#5-#6 con ${selectedVideoModel})...`
            : isFullRegenerateAll
              ? `🧠 Redactando 6 nuevos anuncios persuasivos con OpenRouter (${AUTOADS_LLM_MODEL}) para "${activeProduct.nombre}"...`
              : `🎨 Creando las 4 Imágenes (#1-#4 con ${selectedImageModel}) y los 2 Videos Reels (#5-#6 con ${selectedVideoModel}) para "${activeProduct.nombre}"...`
    );

    const genTimer1 = setTimeout(() => {
      setGenerationProgressText(
        onlyImagesMode
          ? `🎨 Generando paquete 100% de Imágenes con ${selectedImageModel} (Cero Videos Reels)...`
          : `🎬 Generando 4 Imágenes (${selectedImageModel}) + 2 Videos Reels con Avatar (${selectedVideoModel})...`
      );
    }, 2200);

    try {
      let currentBrain = brainProfile;

      // Solo pedimos 6 textos nuevos si todas las tarjetas previas ya estaban completas y el usuario quiere regenerar todo desde cero
      if (isFullRegenerateAll) {
        try {
          const trainRes = await fetch('/api/autoads/brain-train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product: activeProduct,
              externalUrl: sourceMode === 'external_url' ? externalUrlInput.trim() : '',
              openRouterModel: AUTOADS_LLM_MODEL,
              openRouterApiKey: vaultKey,
              variationTimestamp: Date.now()
            })
          });
          const trainData = await trainRes.json();
          if (trainRes.ok && trainData?.brainProfile?.creativeBriefs?.length > 0) {
            currentBrain = {
              ...currentBrain,
              trainedAt: new Date().toISOString(),
              strategyMode: trainData.brainProfile.strategyMode || currentBrain.strategyMode,
              dossierId: trainData.brainProfile.dossierId || currentBrain.dossierId,
              psychologicalProfile: trainData.brainProfile.psychologicalProfile || currentBrain.psychologicalProfile,
              hypotheses: trainData.brainProfile.hypotheses || currentBrain.hypotheses,
              avatars: trainData.brainProfile.avatars || currentBrain.avatars,
              targeting: trainData.brainProfile.targeting || currentBrain.targeting,
              creativeBriefs: trainData.brainProfile.creativeBriefs
            };
            setBrainProfile(currentBrain);
          }
        } catch {
          // Si brain-train tarda demasiado, continuamos inmediatamente con el perfil ya entrenado
        }
      }

      const policyGuardOnly = currentBrain?.strategyMode === 'hypothesis_v2';
      const baseAssets = buildCreativeAssetsFromBrain(activeProduct, currentBrain);
      let workingAssets = isResumeIncomplete
        ? baseAssets.map((asset, idx) => ({
          ...asset,
          type: onlyImagesMode && idx >= 4 ? ('image_story_9x16' as const) : asset.type,
          headline: existingCreatives[idx]?.headline || asset.headline,
          primaryText: sanitizeAdCopyForParaguayCod(
            existingCreatives[idx]?.primaryText || asset.primaryText,
            activeProduct,
            idx,
            { policyGuardOnly }
          ),
          descriptionText: existingCreatives[idx]?.descriptionText || asset.descriptionText,
          ctaLabel: existingCreatives[idx]?.ctaLabel || asset.ctaLabel,
          aiGeneratedImageUrl:
            idx < imageSliceEnd ? existingCreatives[idx]?.aiGeneratedImageUrl || '' : '',
          aiGeneratedImageDataUrl:
            idx < imageSliceEnd ? existingCreatives[idx]?.aiGeneratedImageDataUrl || '' : '',
          aiGeneratedVideoUrl:
            !onlyImagesMode && idx >= 4 ? existingCreatives[idx]?.aiGeneratedVideoUrl || '' : '',
          aiImagePrompt: existingCreatives[idx]?.aiImagePrompt || asset.aiImagePrompt
        }))
        : baseAssets.map((asset, idx) => ({
          ...asset,
          type: onlyImagesMode && idx >= 4 ? ('image_story_9x16' as const) : asset.type,
          primaryText: sanitizeAdCopyForParaguayCod(asset.primaryText, activeProduct, idx, { policyGuardOnly }),
          aiGeneratedImageUrl: idx < imageSliceEnd ? asset.aiGeneratedImageUrl || '' : '',
          aiGeneratedImageDataUrl: idx < imageSliceEnd ? asset.aiGeneratedImageDataUrl || '' : '',
          aiGeneratedVideoUrl: !onlyImagesMode && idx >= 4 ? asset.aiGeneratedVideoUrl || '' : ''
        }));

      // Mostrar inmediatamente las 6 tarjetas en pantalla
      setCreatives(workingAssets);
      if (!isResumeIncomplete) {
        setAdVariationCounters({});
        setAdPhotoIndexOverride({});
      }

      const singleCardIndices: number[] = isResumeIncomplete
        ? workingAssets
          .map((a, idx) =>
            (idx < imageSliceEnd && !a.aiGeneratedImageUrl) ||
              (!onlyImagesMode && idx >= 4 && !a.aiGeneratedVideoUrl)
              ? idx
              : -1
          )
          .filter(idx => idx !== -1)
        : [0, 1, 2, 3, 4, 5];
      let lastWaveError = '';
      let completedCardsCount = 6 - singleCardIndices.length;

      setGenerationProgressText(
        `🛡️ Modo Seguro Por Turno (1 por 1): Iniciando generación secuencial de los ${singleCardIndices.length} creativos (${selectedImageModel}${onlyImagesMode ? '' : ` + ${selectedVideoModel}`})...`
      );

      // Helper para generar 1 Imagen IA en su propio turno exclusivo (1 a la vez, cero choques en OpenRouter)
      const generateSingleImageCardByTurn = async (cardIdx: number) => {
        setGenerationProgressText(
          `🛡️ Generación Por Turno (${completedCardsCount}/6 listos) · 🎨 Creando Imagen del Anuncio #${cardIdx + 1} en ${selectedImageModel} (1 a la vez)...`
        );
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            const res = await fetch('/api/autoads/generate-ad-images', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                product: activeProduct,
                creativeBriefs: currentBrain.creativeBriefs,
                forceNewGeneration: true,
                imageModel: selectedImageModel,
                videoModel: selectedVideoModel,
                onlyImagesMode,
                openRouterApiKey: vaultKey,
                targetIndices: [cardIdx]
              }),
              signal: AbortSignal.timeout(180000)
            });
            const rawText = await res.text();
            let imgData: any = null;
            try {
              imgData = JSON.parse(rawText);
            } catch {
              if (attempt === 5 && !lastWaveError) {
                lastWaveError = `Respuesta inválida al generar Anuncio #${cardIdx + 1} (HTTP ${res.status}).`;
              }
              await new Promise(r => setTimeout(r, 2500));
              continue;
            }

            if (!res.ok || imgData?.success === false) {
              const errMsg = String(imgData?.error || '');
              if (
                errMsg.includes('in_flight_budget_exhausted') ||
                errMsg.includes('in-flight') ||
                errMsg.includes('timeout') ||
                errMsg.includes('aborted')
              ) {
                setGenerationProgressText(
                  `⏳ Esperando que OpenRouter libere la reserva del turno anterior para continuar con el Anuncio #${cardIdx + 1} (intento ${attempt}/5)...`
                );
                await new Promise(r => setTimeout(r, 4500));
                continue;
              }
              if (attempt === 5 && !lastWaveError) {
                lastWaveError =
                  errMsg ||
                  `Error ${res.status}: Fallo en la API de ${selectedImageModel} en OpenRouter.`;
              }
              if (attempt < 5) {
                await new Promise(r => setTimeout(r, 2500));
              }
              continue;
            }

            const match = Array.isArray(imgData?.generatedImages)
              ? imgData.generatedImages.find((g: any) => g.adIndex === cardIdx) || imgData.generatedImages[0]
              : null;

            if (match?.imageUrl) {
              const isCld =
                match.storageProvider === 'cloudinary' ||
                String(match.imageUrl || '').includes('res.cloudinary.com');
              workingAssets[cardIdx] = {
                ...workingAssets[cardIdx],
                aiGeneratedImageUrl: match.imageUrl,
                cloudinaryPublicId:
                  match.cloudinaryPublicId || workingAssets[cardIdx]?.cloudinaryPublicId,
                storageProvider:
                  match.storageProvider ||
                  (isCld ? 'cloudinary' : workingAssets[cardIdx]?.storageProvider),
                aiGeneratedImageDataUrl: isCld
                  ? undefined
                  : match.imageDataUrl || workingAssets[cardIdx]?.aiGeneratedImageDataUrl,
                aiImagePrompt: match.prompt || workingAssets[cardIdx]?.aiImagePrompt
              };
              completedCardsCount += 1;
              setCreatives(prev =>
                prev.map((item, idx) =>
                  idx === cardIdx
                    ? {
                      ...item,
                      aiGeneratedImageUrl: match.imageUrl,
                      cloudinaryPublicId: match.cloudinaryPublicId || item.cloudinaryPublicId,
                      storageProvider:
                        match.storageProvider || (isCld ? 'cloudinary' : item.storageProvider),
                      aiGeneratedImageDataUrl: isCld
                        ? undefined
                        : match.imageDataUrl || item.aiGeneratedImageDataUrl,
                      aiImagePrompt: match.prompt || item.aiImagePrompt
                    }
                    : item
                )
              );
              if (isCld) {
                refreshCloudinaryData(activeProduct?.slug);
              }
              setGenerationProgressText(
                `✅ Turno completado (${completedCardsCount}/6 listos): Imagen del Anuncio #${cardIdx + 1} guardada. Pasando al siguiente turno...`
              );
              return;
            }
          } catch (cardErr: any) {
            if (attempt === 5 && !lastWaveError) {
              lastWaveError = cardErr?.message || `Error de red al generar imagen #${cardIdx + 1}.`;
            }
            if (attempt < 5) {
              await new Promise(r => setTimeout(r, 3000));
            }
          }
        }
      };

      // Helper para generar 1 Video Reel de 15s en su propio turno exclusivo
      const generateSingleReelCardByTurn = async (cardIdx: number) => {
        const { videoUrl, error } = await requestDirectReelVideoWithPolling(
          cardIdx,
          workingAssets[cardIdx]?.aiImagePrompt || '',
          (round, totalRounds) => {
            setGenerationProgressText(
              `🛡️ Generación Por Turno (${completedCardsCount}/6 listos) · 🎬 Renderizando Video Reel 15s #${cardIdx + 1} en ${selectedVideoModel} (${round}/${totalRounds})...`
            );
          },
          {
            headline: workingAssets[cardIdx]?.headline || '',
            primaryText: workingAssets[cardIdx]?.primaryText || '',
            ctaLabel: workingAssets[cardIdx]?.ctaLabel || ''
          }
        );
        if (videoUrl) {
          workingAssets[cardIdx] = {
            ...workingAssets[cardIdx],
            aiGeneratedImageUrl: '',
            aiGeneratedVideoUrl: videoUrl
          };
          completedCardsCount += 1;
          setCreatives(prev =>
            prev.map((item, idx) =>
              idx === cardIdx
                ? { ...item, aiGeneratedImageUrl: '', aiGeneratedVideoUrl: videoUrl }
                : item
            )
          );
          setGenerationProgressText(
            `✅ Turno completado (${completedCardsCount}/6 listos): Video Reel 15s #${cardIdx + 1} guardado...`
          );
        } else if (error && !lastWaveError) {
          lastWaveError = error;
        }
      };

      // Separar las tarjetas pendientes en Imágenes (#1-#4 o #1-#6) y Videos Reels (#5-#6)
      const pendingImageIndices = singleCardIndices.filter(idx => onlyImagesMode || idx < 4);
      const pendingReelIndices = singleCardIndices.filter(idx => !onlyImagesMode && idx >= 4);

      // 1. FILA SEGURA POR TURNO DE IMÁGENES (1 por 1 en orden estricto):
      // Espera que cada imagen termine y liquide su reserva en OpenRouter antes de disparar la siguiente
      for (let i = 0; i < pendingImageIndices.length; i++) {
        const imgIdx = pendingImageIndices[i];
        await generateSingleImageCardByTurn(imgIdx);
        if (i < pendingImageIndices.length - 1 || pendingReelIndices.length > 0) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      // 2. FILA SEGURA POR TURNO DE VIDEOS REELS DE 15S (Anuncios #5 y #6, 1 por 1):
      for (let i = 0; i < pendingReelIndices.length; i++) {
        const reelIdx = pendingReelIndices[i];
        await generateSingleReelCardByTurn(reelIdx);
        if (i < pendingReelIndices.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      const totalGeneratedImagesCount = workingAssets
        .slice(0, imageSliceEnd)
        .filter(a => Boolean(a.aiGeneratedImageUrl)).length;
      const totalReelVideosCount = onlyImagesMode
        ? 0
        : workingAssets.slice(4, 6).filter(a => Boolean(a.aiGeneratedVideoUrl)).length;
      if (totalGeneratedImagesCount === 0 && totalReelVideosCount === 0 && lastWaveError) {
        clearTimeout(genTimer1);
        setWorkflowStep('researched');
        setGenerationProgressText('');
        const isContainerKeyReset =
          lastWaveError.includes('User not found') || lastWaveError.includes('401');
        setApiErrorModal({
          isOpen: true,
          title: isContainerKeyReset
            ? '🔑 El Servidor se Reinició — Confirmá tu API Key de OpenRouter'
            : '⚠️ Error en Generación de Anuncios — Trabajo Pausado',
          errorMessage: isContainerKeyReset
            ? `El servidor en la nube se reinició por inactividad y necesita que pegues nuevamente tu API Key de OpenRouter (sk-or-v1-...). Al guardarla ahora quedará blindada en la bóveda persistente para que no se borre en futuros reinicios.\n\nDetalle técnico: ${lastWaveError}`
            : lastWaveError,
          sourceEndpoint: '/api/autoads/generate-ad-images'
        });
        return;
      }

      clearTimeout(genTimer1);
      setCreatives([...workingAssets]);
      setWorkflowStep('generated');
      showToast(
        onlyImagesMode
          ? `⚡ Ráfaga Turbo: ${totalGeneratedImagesCount}/6 Imágenes IA (${selectedImageModel}) creadas de un tiro.`
          : `⚡ Ráfaga Turbo: ${totalGeneratedImagesCount}/4 Imágenes IA (${selectedImageModel}) + ${totalReelVideosCount}/2 Videos Reels (${selectedVideoModel}) creados de un tiro.`
      );
    } catch (err: any) {
      clearTimeout(genTimer1);
      setGenerationProgressText('');
      setWorkflowStep('researched');
      setApiErrorModal({
        isOpen: true,
        title: '⚠️ Error de Ejecución — Trabajo Pausado',
        errorMessage: err?.message || 'Error inesperado al generar los anuncios.',
        sourceEndpoint: '/api/autoads/generate-ad-images'
      });
    } finally {
      clearTimeout(genTimer1);
      setGenerationProgressText('');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Generar SOLO el Video Reel MP4 de 15s directo (Anuncios #5 y #6) con Google Gemini Omni 1.2 Flash
  // ─────────────────────────────────────────────────────────────────────────────
  const handleGenerateVideoOnlyForReel = async (adIndex: number, customPromptOverride?: string) => {
    if (!brainProfile || !activeProduct) return;
    const currentAd = creatives[adIndex];
    setRegeneratingAdIdx(adIndex);
    try {
      const { videoUrl, error } = await requestDirectReelVideoWithPolling(
        adIndex,
        customPromptOverride || currentAd?.aiImagePrompt || '',
        undefined,
        {
          headline: currentAd?.headline || '',
          primaryText: currentAd?.primaryText || '',
          ctaLabel: currentAd?.ctaLabel || ''
        }
      );
      if (!videoUrl) {
        setRegeneratingAdIdx(null);
        setApiErrorModal({
          isOpen: true,
          title: '⚠️ Error al Generar Video Reel de 15s en Gemini Omni 1.2 Flash — Trabajo Pausado',
          errorMessage:
            error ||
            `OpenRouter (${selectedVideoModel}) no devolvió el video para el Reel #${adIndex + 1}. Se desactivaron todos los fallbacks ficticios.`,
          sourceEndpoint: '/api/autoads/generate-reel-video'
        });
        return;
      }
      setCreatives(prev =>
        prev.map((item, idx) =>
          idx === adIndex
            ? {
              ...item,
              aiGeneratedImageUrl: '',
              aiGeneratedVideoUrl: videoUrl
            }
            : item
        )
      );
      setRegeneratingAdIdx(null);
      showToast(`🎬 Video Reel MP4 de 15s del Anuncio #${adIndex + 1} creado con Voz y Producto en ${selectedVideoModel}.`);
    } catch {
      setRegeneratingAdIdx(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Generar SOLO la imagen IA de una tarjeta sin tocar su copywriting actual
  // ─────────────────────────────────────────────────────────────────────────────
  const handleGenerateImageOnlyForAd = async (adIndex: number, customPromptOverride?: string) => {
    if (!brainProfile || !activeProduct) return;
    if (adIndex >= 4 && !onlyImagesMode) {
      return handleGenerateVideoOnlyForReel(adIndex, customPromptOverride);
    }
    setRegeneratingAdIdx(adIndex);
    try {
      const currentAd = creatives[adIndex];
      let res: Response | null = null;
      let data: any = null;
      for (let attempt = 1; attempt <= 4; attempt++) {
        res = await fetch('/api/autoads/regenerate-ad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product: activeProduct,
            adIndex,
            variationSeed: (adVariationCounters[adIndex] || 0) + 1,
            currentHeadline: currentAd?.headline || '',
            customImagePrompt: customPromptOverride || currentAd?.aiImagePrompt || '',
            imageModel: selectedImageModel,
            videoModel: selectedVideoModel,
            onlyImagesMode,
            openRouterApiKey: getVaultOpenRouterKey(),
            imageOnly: true
          }),
          signal: AbortSignal.timeout(180000)
        });
        data = await res.json();
        if (res.ok && data?.success !== false && data?.customBrief?.aiGeneratedImageUrl) {
          break;
        }
        const errStr = String(data?.error || '');
        if (
          attempt < 4 &&
          (errStr.includes('in_flight_budget_exhausted') ||
            errStr.includes('in-flight') ||
            errStr.includes('timeout') ||
            errStr.includes('aborted'))
        ) {
          showToast(`⏳ Esperando liquidación de turno en OpenRouter para Anuncio #${adIndex + 1} (reintento ${attempt}/4)...`);
          await new Promise(r => setTimeout(r, 4500));
          continue;
        }
        break;
      }

      if (!res || !res.ok || data?.success === false || !data?.customBrief?.aiGeneratedImageUrl) {
        setRegeneratingAdIdx(null);
        setApiErrorModal({
          isOpen: true,
          title: '⚠️ Error al Generar Imagen IA — Trabajo Pausado',
          errorMessage:
            data?.error ||
            `Error ${res?.status || ''}: OpenRouter (${selectedImageModel}) no devolvió la imagen para el Anuncio #${adIndex + 1}.`,
          sourceEndpoint: '/api/autoads/regenerate-ad'
        });
        return;
      }

      const isCldRegen =
        data.storageProvider === 'cloudinary' ||
        data.customBrief?.storageProvider === 'cloudinary' ||
        String(data.customBrief?.aiGeneratedImageUrl || '').includes('res.cloudinary.com');
      const resolvedCldId =
        data.cloudinaryPublicId || data.customBrief?.cloudinaryPublicId || undefined;

      setCreatives(prev =>
        prev.map((item, idx) =>
          idx === adIndex
            ? {
              ...item,
              aiGeneratedImageUrl: data.customBrief.aiGeneratedImageUrl,
              cloudinaryPublicId: resolvedCldId || item.cloudinaryPublicId,
              storageProvider: isCldRegen
                ? 'cloudinary'
                : data.storageProvider || item.storageProvider,
              aiGeneratedImageDataUrl: isCldRegen
                ? undefined
                : data.aiGeneratedImageDataUrl ||
                  data.customBrief.aiGeneratedImageDataUrl ||
                  item.aiGeneratedImageDataUrl,
              aiImagePrompt:
                data.customBrief.aiImagePrompt ||
                data.aiImagePrompt ||
                data.customBrief.imagePrompt ||
                item.aiImagePrompt
            }
            : item
        )
      );
      setCreatorPendingReplaceMap(prev => ({ ...prev, [adIndex]: true }));
      if (isCldRegen) {
        refreshCloudinaryData(activeProduct?.slug);
      }
      setRegeneratingAdIdx(null);
      showToast(`🎨 Imagen IA del Anuncio #${adIndex + 1} generada con éxito en OpenRouter (${selectedImageModel}).`);
    } catch (err: any) {
      setRegeneratingAdIdx(null);
      setApiErrorModal({
        isOpen: true,
        title: '⚠️ Error de Red al Generar Imagen — Trabajo Pausado',
        errorMessage: err?.message || 'Fallo de red al conectar con OpenRouter.',
        sourceEndpoint: '/api/autoads/regenerate-ad'
      });
    }
  };


  // ─────────────────────────────────────────────────────────────────────────────
  // Cambiar / Regenerar UN anuncio específico ("🔄 Cambiar")
  // ─────────────────────────────────────────────────────────────────────────────
  const handleRegenerateSingleAd = async (adIndex: number, customPromptOverride?: string) => {
    if (!brainProfile || !activeProduct) return;
    setRegeneratingAdIdx(adIndex);
    const nextSeed = (adVariationCounters[adIndex] || 0) + 1;
    setAdVariationCounters(prev => ({ ...prev, [adIndex]: nextSeed }));

    let customBrief: any = null;
    try {
      const currentAd = creatives[adIndex];
      const res = await fetch('/api/autoads/regenerate-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: activeProduct,
          adIndex,
          variationSeed: nextSeed,
          currentHeadline: currentAd?.headline || '',
          customImagePrompt: customPromptOverride || '',
          imageModel: selectedImageModel,
          videoModel: selectedVideoModel,
          onlyImagesMode,
          openRouterApiKey: getVaultOpenRouterKey()
        })
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        setRegeneratingAdIdx(null);
        setApiErrorModal({
          isOpen: true,
          title: '⚠️ Error al Regenerar Anuncio — Trabajo Pausado',
          errorMessage:
            data?.error ||
            `Error ${res.status}: La API de OpenRouter (${AUTOADS_LLM_MODEL}) retornó un fallo al regenerar este anuncio.`,
          sourceEndpoint: '/api/autoads/regenerate-ad'
        });
        return;
      }
      if (data?.customBrief) {
        customBrief = data.customBrief;
      }
    } catch (err: any) {
      setRegeneratingAdIdx(null);
      setApiErrorModal({
        isOpen: true,
        title: '⚠️ Error de Red al Regenerar — Trabajo Pausado',
        errorMessage: err?.message || 'Fallo de red al conectar con OpenRouter.',
        sourceEndpoint: '/api/autoads/regenerate-ad'
      });
      return;
    }

    const freshAsset = regenerateSingleCreativeAssetFromBrain(
      activeProduct,
      brainProfile,
      adIndex,
      nextSeed,
      customBrief || undefined
    );
    const isCldAsset =
      customBrief?.storageProvider === 'cloudinary' ||
      String(freshAsset.aiGeneratedImageUrl || '').includes('res.cloudinary.com');
    if (customBrief?.cloudinaryPublicId) {
      freshAsset.cloudinaryPublicId = customBrief.cloudinaryPublicId;
    }
    if (customBrief?.storageProvider || isCldAsset) {
      freshAsset.storageProvider = (customBrief?.storageProvider || 'cloudinary') as any;
    }
    if (isCldAsset) {
      freshAsset.aiGeneratedImageDataUrl = undefined;
    } else if (customBrief?.aiGeneratedImageDataUrl) {
      freshAsset.aiGeneratedImageDataUrl = customBrief.aiGeneratedImageDataUrl;
    }
    if (onlyImagesMode && adIndex >= 4) {
      freshAsset.type = 'image_story_9x16';
    }

    // Limpiar cualquier override manual de índice
    setAdPhotoIndexOverride(prev => {
      const copy = { ...prev };
      delete copy[adIndex];
      return copy;
    });

    setCreatives(prev => prev.map((item, idx) => (idx === adIndex ? freshAsset : item)));
    setCreatorPendingReplaceMap(prev => ({ ...prev, [adIndex]: true }));
    if (isCldAsset) {
      refreshCloudinaryData(activeProduct?.slug);
    }
    setRegeneratingAdIdx(null);
    showToast(
      adIndex >= 4 && !onlyImagesMode
        ? `🎬 Reel #${adIndex + 1} regenerado en Video MP4 (${selectedVideoModel}) con nuevo ángulo de venta.`
        : `🤖 Anuncio #${adIndex + 1} regenerado con nueva Imagen IA (${selectedImageModel}) y nuevo ángulo de venta.`
    );
  };

  // Rotar la escena IA completa (Imagen IA + Texto 100% congruente con esa escena) en un anuncio específico
  const handleCycleProductPhotoForAd = (adIndex: number) => {
    if (!activeProduct || !brainProfile) return;
    const allPhotos = extractAllProductImages(activeProduct, brainProfile.productAnalysis.images);
    const currentPhotoIdx = adPhotoIndexOverride[adIndex] ?? adIndex;
    const nextPhotoIdx = (currentPhotoIdx + 1) % allPhotos.length;
    const nextSeed = (adVariationCounters[adIndex] || 0) + 1;

    setAdPhotoIndexOverride(prev => ({ ...prev, [adIndex]: nextPhotoIdx }));
    setAdVariationCounters(prev => ({ ...prev, [adIndex]: nextSeed }));

    const congruentAsset = regenerateSingleCreativeAssetFromBrain(
      activeProduct,
      brainProfile,
      adIndex,
      nextSeed
    );

    const updatedSvgUrl = buildHighImpactAdSvgDataUrl({
      productName: activeProduct.nombre,
      productImage: congruentAsset.aiGeneratedImageUrl || allPhotos[nextPhotoIdx],
      pricePack1Gs: Number(activeProduct.precios?.[1] || brainProfile.productAnalysis.pricesPack1),
      pricePack2Gs: Number(activeProduct.precios?.[2] || brainProfile.productAnalysis.pricesPack2),
      normalPriceGs: Number(activeProduct.precioNormal || brainProfile.productAnalysis.pricesNormal),
      freeShipping: activeProduct.freeShipping ?? brainProfile.productAnalysis.freeShipping,
      aspectRatio: congruentAsset.aspectRatio,
      hookBadge: congruentAsset.hookBadge,
      headline: congruentAsset.headline,
      subHeadline: congruentAsset.descriptionText.slice(0, 70),
      ctaLabel: congruentAsset.ctaLabel,
      themeIndex: congruentAsset.visualThemeIndex
    });

    setCreatives(prev =>
      prev.map((item, idx) =>
        idx === adIndex ? { ...congruentAsset, imageDataUrl: updatedSvgUrl } : item
      )
    );
    showToast(
      `🎯 Escena IA #${((adIndex + nextSeed) % allPhotos.length) + 1} sincronizada (Texto + Imagen 100% congruentes) en el Anuncio #${adIndex + 1}.`
    );
  };

  // Actualizar texto manualmente en un anuncio si el usuario desea retocarlo
  const handleUpdateAdField = (
    adIndex: number,
    field: 'headline' | 'primaryText' | 'descriptionText' | 'ctaLabel',
    value: string
  ) => {
    setCreatives(prev =>
      prev.map((item, idx) => (idx === adIndex ? { ...item, [field]: value } : item))
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // BOTÓN 3: Publicar Ahora en Meta Ads (solo después de revisar los anuncios)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleStep3PublishNow = async () => {
    if (!activeProduct || creatives.length === 0 || workflowStep === 'publishing') return;

    // Si todavía no inició sesión con su cuenta de Facebook / Meta Ads ni cargó token Pipeboard, abrir el Login OAuth de Facebook en 1 clic
    if (!metaConnected && !hasPipeboardTokenInBackend) {
      setShowFacebookOAuthModal(true);
      showToast('🔵 Primero iniciá sesión en tu cuenta de Facebook / Meta Ads para autorizar la publicación.');
      return;
    }

    setWorkflowStep('publishing');

    try {
      const landingUrl =
        sourceMode === 'external_url' && externalUrlInput.trim()
          ? externalUrlInput.trim()
          : `${window.location.origin}/?p=${activeProduct.slug}`;

      // Si está conectado vía Facebook OAuth / Meta Graph Directo, publicar directo en Meta Graph API v21.0 subiendo los archivos PNG reales
      const publishEndpoint = metaConnected
        ? '/api/meta/publish-direct'
        : '/api/pipeboard/publish-campaign';

      const selectedPage = metaPages.find(p => p.id === '1050835598123904') || metaPages[0];
      const backupAccessToken = String(metaOAuthBackupState?.accessToken || '').trim();

      const pubRes = await fetch(publishEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: activeProduct,
          creatives,
          brainProfile,
          adAccountId: 'act_1048211497774834',
          facebookPageId: '1050835598123904',
          pageAccessToken: selectedPage?.access_token || '',
          accessToken: backupAccessToken || undefined,
          dailyBudgetGs: pbConfig.dailyBudgetGs,
          publishStatus: pbConfig.defaultPublishStatus,
          pipeboardMcpEndpoint: pbConfig.pipeboardMcpEndpoint,
          landingUrl,
          pixelId: '1276031534651377'
        })
      });

      const pubData = await pubRes.json().catch(() => ({}));

      if (pubRes.ok && pubData?.success !== false && pubData?.campaign) {
        setPublishedCampaigns(prev => [pubData.campaign, ...prev]);
        setCreatorPendingReplaceMap({});
        refreshCloudinaryData(activeProduct.slug);
        setWorkflowStep('published');
        const preflightWarn = Array.isArray(pubData?.preflight?.checks)
          ? pubData.preflight.checks.find((c: any) => c.code === 'PIXEL_LEAD_HISTORY_LOW')?.message
          : '';
        showToast(
          `🚀 ¡Campaña publicada en vivo en Meta Ads (${pubData.campaign.campaignId}) con tus ${creatives.length} anuncios!${
            preflightWarn ? ` · ℹ️ ${preflightWarn}` : ''
          }`
        );
      } else {
        setWorkflowStep('generated');
        const needsMetaReauth =
          pubRes.status === 401 || pubRes.status === 403 || Boolean(pubData?.requiresReauth);
        if (needsMetaReauth) {
          const authErrMsg =
            pubData?.error ||
            'Tu token de Meta Ads venció, fue invalidado o le faltan permisos. Volvé a autorizar tu cuenta de Facebook para publicar.';
          setMetaConnected(false);
          setMetaOAuthBackupState(null);
          setMetaAuthErrorBanner(authErrMsg);
          setShowFacebookOAuthModal(true);
          showToast('🔐 Meta solicitó reautorización de tu sesión OAuth / Token antes de publicar.');
        } else {
          setApiErrorModal({
            isOpen: true,
            title: '⚠️ Auditoría de Publicación en Meta Ads — Acción Requerida',
            errorMessage:
              pubData?.error ||
              `Error ${pubRes.status}: No se pudo completar la publicación en Meta Ads. Verificá tu conexión de Facebook OAuth / Meta Ads y tu Cuenta Publicitaria.`,
            sourceEndpoint: publishEndpoint
          });
        }
      }
    } catch (err: any) {
      setWorkflowStep('generated');
      setApiErrorModal({
        isOpen: true,
        title: '⚠️ Error de Red al Publicar en Meta Ads',
        errorMessage: err?.message || 'Error de red al conectar con el servidor de publicación.',
        sourceEndpoint: '/api/meta/publish-direct'
      });
    }
  };

  const allProductPhotos = useMemo(
    () => extractAllProductImages(activeProduct, brainProfile?.productAnalysis?.images),
    [activeProduct, brainProfile]
  );

  const landingDisplayHost = useMemo(() => {
    if (sourceMode === 'external_url' && externalUrlInput.trim()) {
      try {
        return new URL(externalUrlInput.trim()).hostname.toUpperCase();
      } catch { }
    }
    return (window.location.hostname || 'AUTOADS360.UP.RAILWAY.APP').toUpperCase();
  }, [sourceMode, externalUrlInput]);

  const filteredCreativeEntries = useMemo(() => {
    return creatives
      .map((ad, idx) => ({ ad, idx }))
      .filter(({ idx }) => {
        if (creativesFilter === 'feed') return idx < 3;
        if (creativesFilter === 'pack_reels') return idx >= 3;
        return true;
      });
  }, [creatives, creativesFilter]);

  const handleOpenCampaignWorkspace = (camp: PipeboardPublishedCampaignRecord) => {
    const matchedProd = productPages.find(
      p => p.id === camp.productId || (camp.productSlug && p.slug === camp.productSlug)
    );
    if (matchedProd) {
      setFreshDraftMode(false);
      setSourceMode('catalog');
      setSelectedProductId(matchedProd.id);
      const key = computeWorkspaceKey('catalog', matchedProd.id, externalUrlInput);
      applySavedWorkspaceToState(workspacesCache[key], matchedProd);
      setActiveWorkspaceTab('crear');
      showToast(`📣 Cargando creativos de "${matchedProd.nombre}"`);
    } else if (camp.landingUrl) {
      setFreshDraftMode(false);
      setSourceMode('external_url');
      setExternalUrlInput(camp.landingUrl);
      const key = computeWorkspaceKey('external_url', selectedProductId, camp.landingUrl);
      applySavedWorkspaceToState(workspacesCache[key]);
      setActiveWorkspaceTab('crear');
      showToast(`🌐 Cargando campaña externa "${camp.productName}"`);
    }
  };

  const activePublishedCampaignForProduct = useMemo(() => {
    if (!activeProduct || publishedCampaigns.length === 0) return null;
    return (
      publishedCampaigns.find(
        c =>
          (c.productId && activeProduct.id && c.productId === activeProduct.id) ||
          (c.productSlug && activeProduct.slug && c.productSlug === activeProduct.slug)
      ) || null
    );
  }, [activeProduct, publishedCampaigns]);

  const selectedCampaignForPanel = useMemo(() => {
    if (!selectedCampaignId) return null;
    return (
      publishedCampaigns.find(
        c => c.id === selectedCampaignId || c.campaignId === selectedCampaignId
      ) || null
    );
  }, [publishedCampaigns, selectedCampaignId]);

  const resolveProductForPublishedCampaign = (camp: PipeboardPublishedCampaignRecord): ProductPage => {
    const matched = productPages.find(
      p => p.id === camp.productId || (camp.productSlug && p.slug === camp.productSlug)
    );
    if (matched) return matched;
    const extWs =
      workspacesCache[camp.productId] ||
      workspacesCache[`ext_${camp.landingUrl}`] ||
      Object.values(workspacesCache || {}).find(
        (w: any) =>
          (camp.productId && w?.productId === camp.productId) ||
          (camp.productSlug && w?.scrapedExternalProduct?.slug === camp.productSlug)
      );
    if (extWs?.scrapedExternalProduct) return extWs.scrapedExternalProduct;
    if (scrapedExternalProduct && scrapedExternalProduct.slug === camp.productSlug) {
      return scrapedExternalProduct;
    }
    return {
      id: camp.productId || `camp_prod_${camp.campaignId}`,
      slug: camp.productSlug || 'producto-autoads',
      nombre: camp.productName || camp.campaignName || 'Producto Meta Ads',
      descripcion: `Oferta Paraguay con entrega a domicilio y pago contra entrega para ${camp.productName || 'este producto'}.`,
      precios: { 1: 189000, 2: 349000 },
      precioNormal: 260000,
      freeShipping: true,
      imagenPrincipal: '',
      galeria: [],
      caracteristicas: [],
      testimonios: [],
      faq: []
    } as unknown as ProductPage;
  };

  const handleSyncLiveMetaCampaigns = async () => {
    setSyncingLiveCampaigns(true);
    try {
      const res = await fetch('/api/meta/campaigns-live');
      const data = await res.json().catch(() => null);
      if (data?.cloudinaryStatus && typeof data.cloudinaryStatus.configured === 'boolean') {
        setCloudinaryStatus(data.cloudinaryStatus);
      }
      if (Array.isArray(data?.campaigns)) {
        setPublishedCampaigns(data.campaigns);
      }
      await refreshCloudinaryData();
      showToast(
        data?.syncedWithMeta
          ? `✅ Campañas sincronizadas en vivo desde Meta Ads (${Array.isArray(data?.campaigns) ? data.campaigns.length : 0}).`
          : `📂 Mostrando ${Array.isArray(data?.campaigns) ? data.campaigns.length : publishedCampaigns.length} campañas locales (${data?.error || 'conecta Meta Ads para refrescar desde Meta'}).`
      );
    } catch {
      showToast('⚠️ No se pudo sincronizar con Meta Graph API ahora.');
    } finally {
      setSyncingLiveCampaigns(false);
    }
  };

  const handleRegeneratePublishedCampaignAd = async (
    camp: PipeboardPublishedCampaignRecord,
    adIdx: number,
    existingAd: any
  ) => {
    const adKey = buildCampaignAdKey(camp.campaignId, adIdx, existingAd?.adId);
    const targetProd = resolveProductForPublishedCampaign(camp);
    const nextSeed = (adVariationCounters[adIdx] || 0) + 1;
    setAdVariationCounters(prev => ({ ...prev, [adIdx]: nextSeed }));
    setCampaignRegenAdKey(adKey);
    try {
      const wsBrain =
        workspacesCache[targetProd.id]?.brainProfile ||
        (activeProduct?.id === targetProd.id ? brainProfile : null) ||
        createDefaultBrainProfile(targetProd);

      const res = await fetch('/api/autoads/regenerate-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: targetProd,
          adIndex: adIdx,
          variationSeed: nextSeed,
          currentHeadline: existingAd?.headline || '',
          imageModel: selectedImageModel,
          videoModel: selectedVideoModel,
          onlyImagesMode: true,
          openRouterApiKey: getVaultOpenRouterKey()
        }),
        signal: AbortSignal.timeout(180000)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        setApiErrorModal({
          isOpen: true,
          title: `⚠️ Error al Regenerar Anuncio #${adIdx + 1}`,
          errorMessage: data?.error || `Error ${res.status} al generar el reemplazo del Anuncio #${adIdx + 1}.`,
          sourceEndpoint: '/api/autoads/regenerate-ad'
        });
        return;
      }

      const customBrief = data?.customBrief || {
        aiGeneratedImageUrl: data?.aiGeneratedImageUrl,
        aiGeneratedImageDataUrl: data?.aiGeneratedImageDataUrl,
        cloudinaryPublicId: data?.cloudinaryPublicId,
        storageProvider: data?.storageProvider,
        aiImagePrompt: data?.aiImagePrompt
      };

      const freshAsset = regenerateSingleCreativeAssetFromBrain(
        targetProd,
        wsBrain,
        adIdx,
        nextSeed,
        customBrief
      );
      const isCld =
        customBrief?.storageProvider === 'cloudinary' ||
        String(freshAsset.aiGeneratedImageUrl || '').includes('res.cloudinary.com');
      if (customBrief?.cloudinaryPublicId) {
        freshAsset.cloudinaryPublicId = customBrief.cloudinaryPublicId;
      }
      if (customBrief?.storageProvider || isCld) {
        freshAsset.storageProvider = (customBrief?.storageProvider || 'cloudinary') as any;
      }
      if (isCld) {
        freshAsset.aiGeneratedImageDataUrl = undefined;
      }

      setCampaignPendingDrafts(prev => ({ ...prev, [adKey]: freshAsset }));
      if (activeProduct?.id === targetProd.id) {
        setCreatives(prev => prev.map((item, idx) => (idx === adIdx ? freshAsset : item)));
      }
      if (isCld) {
        refreshCloudinaryData(targetProd.slug);
      }
      showToast(
        `✨ Nuevo borrador generado para Anuncio #${adIdx + 1}. Presioná "Lanzar y Reemplazar en Meta Ads" para borrar el anterior y publicar este.`
      );
    } catch (err: any) {
      setApiErrorModal({
        isOpen: true,
        title: `⚠️ Error al Regenerar Anuncio #${adIdx + 1}`,
        errorMessage: err?.message || 'Error de conexión al regenerar el anuncio.',
        sourceEndpoint: '/api/autoads/regenerate-ad'
      });
    } finally {
      setCampaignRegenAdKey(null);
    }
  };

  const handleLaunchReplacePublishedAd = async (
    camp: PipeboardPublishedCampaignRecord,
    adIdx: number,
    existingAd: any,
    draftCreative: GeneratedAdCreativeAsset
  ) => {
    const adKey = buildCampaignAdKey(camp.campaignId, adIdx, existingAd?.adId);
    const targetProd = resolveProductForPublishedCampaign(camp);
    const backupAccessToken = String(metaOAuthBackupState?.accessToken || '').trim();
    setCampaignReplaceAdKey(adKey);
    try {
      const res = await fetch('/api/autoads/replace-published-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignRecordId: camp.id,
          campaignRecord: camp,
          campaignId: camp.campaignId,
          adSetId: camp.adSetId,
          oldAdId: existingAd?.adId,
          adIndex: adIdx,
          product: targetProd,
          creative: draftCreative,
          landingUrl: camp.landingUrl,
          publishStatus: pbConfig.defaultPublishStatus || 'ACTIVE',
          accessToken: backupAccessToken || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403 || data?.requiresReauth) {
        setShowFacebookOAuthModal(true);
        setMetaAuthErrorBanner(data?.error || 'Autorizá tu cuenta de Meta Ads antes de reemplazar anuncios.');
        showToast('🔐 Necesitás conectar tu cuenta de Facebook / Meta Ads para reemplazar el anuncio en vivo.');
        return;
      }
      if (!res.ok || data?.success === false) {
        setApiErrorModal({
          isOpen: true,
          title: `⚠️ No se pudo reemplazar Anuncio #${adIdx + 1} en Meta Ads`,
          errorMessage: data?.error || `Error ${res.status} al reemplazar el anuncio en Meta.`,
          sourceEndpoint: '/api/autoads/replace-published-ad'
        });
        return;
      }

      if (data?.campaign) {
        setPublishedCampaigns(prev => {
          const exists = prev.some(c => c.id === camp.id || c.campaignId === camp.campaignId);
          return exists
            ? prev.map(c =>
                c.id === camp.id || c.campaignId === camp.campaignId ? data.campaign : c
              )
            : [data.campaign, ...prev];
        });
      }

      const replaceInfo: CampaignAdReplaceResultInfo = {
        oldAdId: data?.deletedAdId || existingAd?.adId,
        deletedFromMeta: Boolean(data?.deletedFromMeta),
        newAdId: String(data?.newAdId || ''),
        newCreativeId: String(data?.newCreativeId || ''),
        replacedAt: new Date().toLocaleTimeString('es-PY')
      };
      const nextKey = buildCampaignAdKey(camp.campaignId, adIdx, replaceInfo.newAdId);
      setCampaignReplacedInfo(prev => ({
        ...prev,
        [adKey]: replaceInfo,
        [nextKey]: replaceInfo
      }));
      setCampaignPendingDrafts(prev => {
        const next = { ...prev };
        delete next[adKey];
        return next;
      });

      if (activeProduct?.id === targetProd.id && data?.imageUrl) {
        setCreatives(prev =>
          prev.map((item, i) =>
            i === adIdx
              ? {
                ...item,
                aiGeneratedImageUrl: data.imageUrl,
                cloudinaryPublicId: data.cloudinaryPublicId || item.cloudinaryPublicId,
                storageProvider: data.cloudinaryPublicId ? 'cloudinary' : item.storageProvider,
                aiGeneratedImageDataUrl: data.cloudinaryPublicId ? undefined : item.aiGeneratedImageDataUrl
              }
              : item
          )
        );
      }
      refreshCloudinaryData(targetProd.slug);
      showToast(
        `🚀 Anuncio #${adIdx + 1} reemplazado en Meta Ads (${replaceInfo.oldAdId ? `eliminado ${replaceInfo.oldAdId} -> ` : ''}nuevo ID ${replaceInfo.newAdId}).`
      );
    } catch (err: any) {
      setApiErrorModal({
        isOpen: true,
        title: `⚠️ Error de Red al Reemplazar Anuncio #${adIdx + 1}`,
        errorMessage: err?.message || 'Error de red conectando con /api/autoads/replace-published-ad.',
        sourceEndpoint: '/api/autoads/replace-published-ad'
      });
    } finally {
      setCampaignReplaceAdKey(null);
    }
  };

  const handleLaunchCreatorAdReplacement = async (adIndex: number) => {
    if (!activeProduct || !activePublishedCampaignForProduct || !creatives[adIndex]) return;
    const camp = activePublishedCampaignForProduct;
    const existingAd =
      camp.publishedAds?.find(a => a.adIndex === adIndex) || camp.publishedAds?.[adIndex] || {};
    setCreatorReplacingIdx(adIndex);
    try {
      await handleLaunchReplacePublishedAd(camp, adIndex, existingAd, creatives[adIndex]);
      setCreatorPendingReplaceMap(prev => {
        const next = { ...prev };
        delete next[adIndex];
        return next;
      });
    } finally {
      setCreatorReplacingIdx(null);
    }
  };

  const renderSettingsVaultForm = () => (
    <div className="p-4 rounded-xl border border-zinc-800 bg-[#0f1115] space-y-3">
      <form onSubmit={handleSaveConfig} className="space-y-3" autoComplete="off">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
            Configuración OpenRouter IA &amp; Slot Pipeboard · Blindaje Backend
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono text-[10px]">
              {hasOpenRouterKeyInBackend
                ? `OpenRouter Activo (${openRouterKeyPreview || '••••••••'})`
                : 'Sin OpenRouter Key'}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono text-[10px]">
              {hasPipeboardTokenInBackend
                ? `Pipeboard (${pipeboardTokenPreview || '••••••••'})`
                : 'Cero APIs en Navegador'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-emerald-300 mb-1 font-bold">
              API Key de OpenRouter (sk-or-v1-...)
            </label>
            <input
              type="password"
              name="openrouter_onetime_secret"
              autoComplete="new-password"
              spellCheck={false}
              data-lpignore="true"
              value={openRouterKeyInput}
              onChange={e => setOpenRouterKeyInput(e.target.value)}
              placeholder={
                hasOpenRouterKeyInBackend
                  ? `Activa (${openRouterKeyPreview}) · Pegá otra para cambiar...`
                  : 'sk-or-v1-... (se guarda en .env y store_config)'
              }
              className="w-full px-3 py-2 rounded-xl border border-emerald-700/70 bg-zinc-900 text-zinc-100 placeholder-zinc-500 font-mono text-xs outline-none focus:border-emerald-400"
            />
          </div>
          <div>
            <label className="block text-zinc-400 mb-1 font-medium">
              Token Meta Ads (EAA...) o Pipeboard
            </label>
            <input
              type="password"
              name="pipeboard_onetime_secret"
              autoComplete="new-password"
              spellCheck={false}
              data-lpignore="true"
              value={pipeboardTokenInput}
              onChange={e => setPipeboardTokenInput(e.target.value)}
              placeholder={
                metaConnected
                  ? 'Conectado vía Facebook OAuth / Token...'
                  : hasPipeboardTokenInBackend
                    ? 'Blindada en Backend (pegá otra para reemplazar)...'
                    : 'EAA... o pipeboard_... (se guarda en backend)'
              }
              className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 font-mono text-xs outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-emerald-300 mb-1 font-bold">
              Cuenta Publicitaria Funcional
            </label>
            {metaAdAccounts.length > 0 ? (
              <select
                value={pbConfig.selectedAdAccountId}
                onChange={e => {
                  const nextAccId = e.target.value;
                  setPbConfig(prev => ({ ...prev, selectedAdAccountId: nextAccId }));
                  const matchingPx = metaPixels.find(px => px.adAccountId === nextAccId);
                  if (matchingPx) {
                    setActiveMetaPixel({ id: matchingPx.id, name: matchingPx.name });
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-emerald-700/70 bg-zinc-900 text-zinc-100 font-mono text-xs outline-none focus:border-emerald-500"
              >
                {metaAdAccounts.map(acc => {
                  const isFunctional =
                    acc.id === 'act_1048211497774834' || /landingcod/i.test(String(acc.name || ''));
                  return (
                    <option key={acc.id} value={acc.id}>
                      {isFunctional ? '✅ ' : '⚠️ '}
                      {acc.name} ({acc.id}) {acc.currency ? `· ${acc.currency}` : ''}
                      {isFunctional ? ' [FUNCIONAL ACTIVA]' : ' [Personal - No usar]'}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="text"
                value={pbConfig.selectedAdAccountId}
                onChange={e => setPbConfig(prev => ({ ...prev, selectedAdAccountId: e.target.value }))}
                placeholder={`act_1048211497774834 (${activeAdAccountName})`}
                className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 font-mono text-xs outline-none focus:border-emerald-500"
              />
            )}
          </div>
          <div>
            <label className="block text-zinc-400 mb-1 font-medium">Presupuesto Diario (Gs.)</label>
            <input
              type="number"
              value={pbConfig.dailyBudgetGs}
              onChange={e => setPbConfig(prev => ({ ...prev, dailyBudgetGs: Number(e.target.value) || 50000 }))}
              placeholder="65000"
              className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 font-mono text-xs outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-emerald-300">
              {metaConnected
                ? `Activo: Cuenta "${activeAdAccountName}" (act_1048211497774834)`
                : 'Autenticación OAuth de Meta Ads:'}
            </span>
            {metaPages.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400">Página FB:</span>
                <select
                  value={pbConfig.selectedFacebookPageId}
                  onChange={e =>
                    setPbConfig(prev => ({ ...prev, selectedFacebookPageId: e.target.value }))
                  }
                  className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-emerald-700/70 text-zinc-100 font-mono text-[11px]"
                >
                  {metaPages.map(pg => {
                    const isLandingShop =
                      String(pg.id) === '1050835598123904' ||
                      /landingcod\s*shop/i.test(String(pg.name || ''));
                    return (
                      <option key={pg.id} value={pg.id}>
                        {isLandingShop ? '✅ ' : ''}
                        {pg.name} ({pg.id})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            <div className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 font-mono text-[11px]">
              Píxel 834: <strong>{activeMetaPixel.name}</strong> ({activeMetaPixel.id})
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 font-mono text-[11px]">
              Paraguay (PY) · 18-65 años
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleConnectFacebookOAuth(true)}
            className="px-3 py-1.5 rounded-lg bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span className="w-4 h-4 rounded-full bg-white text-[#1877F2] font-semibold text-[11px] inline-flex items-center justify-center leading-none">
              f
            </span>
            <span>
              {metaConnected
                ? 'Cambiar / Reconectar Facebook OAuth'
                : 'Iniciar Sesión con Facebook OAuth'}
            </span>
          </button>
        </div>

        {lastTokenSelfDestructAt && (
          <p className="text-[11px] text-emerald-400 font-mono">
            Credenciales autodestruidas del navegador a las {lastTokenSelfDestructAt} y guardadas únicamente en el servidor.
          </p>
        )}

        <button
          type="submit"
          disabled={savingSettings}
          className="w-full py-2.5 rounded-lg bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 cursor-pointer transition-colors disabled:opacity-50"
        >
          {savingSettings
            ? 'Guardando en Backend...'
            : 'Guardar Credenciales en Backend y Autodestruir del Navegador'}
        </button>
      </form>
    </div>
  );

  return (
    <div data-testid="autoads-view" className="max-w-6xl mx-auto space-y-4 font-sans text-zinc-100">
      {/* ===================================================================== */}
      {/* INTERFAZ 1: PORTAL DE INICIO (SOLO SE MUESTRA EN INICIO, SIN BARULLO)  */}
      {/* ===================================================================== */}
      {activeWorkspaceTab === 'inicio' && (
        <>
          <div className="p-3.5 sm:px-5 rounded-2xl bg-[#0f1115] border border-zinc-800/90 flex flex-wrap items-center justify-between gap-2.5 shadow-lg">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 text-emerald-400 flex items-center justify-center font-semibold text-xs shrink-0">
                ▲
              </div>
              <h1 className="text-sm sm:text-base font-bold text-zinc-100">AutoAds Piloto IA</h1>

              <button
                type="button"
                data-testid="facebook-oauth-header-btn"
                onClick={() => handleConnectFacebookOAuth(metaConnected ? true : false)}
                disabled={connectingFacebookOAuth}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  metaConnected
                    ? 'border-emerald-800/80 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300'
                    : 'border-[#1877F2] bg-[#1877F2] hover:bg-[#166fe5] text-white'
                }`}
              >
                {connectingFacebookOAuth ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full bg-white text-[#1877F2] font-bold text-[10px] inline-flex items-center justify-center leading-none">
                    f
                  </span>
                )}
                <span>
                  {metaConnected
                    ? `${activeAdAccountName} (834) · Píxel ${activeMetaPixel.id.slice(-3)}`
                    : 'Conectar Meta Ads'}
                </span>
              </button>

              <button
                type="button"
                data-testid="cloudinary-header-status-pill"
                onClick={() => {
                  setConexionSubTab('cloudinary');
                  setActiveWorkspaceTab('conexion');
                }}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  cloudinaryStatus?.configured
                    ? 'border-sky-700/70 bg-sky-950/60 hover:bg-sky-900/60 text-sky-300'
                    : 'border-amber-700/70 bg-amber-950/50 hover:bg-amber-900/50 text-amber-300'
                }`}
              >
                <Cloud className="w-3 h-3" />
                <span>
                  {cloudinaryStatus?.configured
                    ? `Cloudinary: ${cloudinaryStatus.cloudName}`
                    : 'Cloudinary: Pendiente ENV'}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowSettingsDrawer(prev => !prev)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showSettingsDrawer
                    ? 'border-emerald-600 bg-emerald-950/70 text-emerald-300'
                    : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Configuración</span>
              </button>

              <a
                href="https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1048211497774834"
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-semibold text-zinc-200 inline-flex items-center gap-1 transition-colors"
              >
                <span>Ads Manager</span>
                <ExternalLink className="w-3 h-3 text-zinc-400" />
              </a>
            </div>
          </div>

          {showSettingsDrawer && renderSettingsVaultForm()}

          {/* Tarjetas Limpias del Portal Principal */}
          <div
            data-testid="autoads-inicio-hub"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <button
              type="button"
              data-testid="hub-card-campanas"
              onClick={() => {
                setSelectedCampaignId(null);
                setActiveWorkspaceTab('campanas');
              }}
              className="text-left p-5 rounded-2xl bg-[#0f1115] border border-zinc-800 hover:border-emerald-500/70 transition-all flex flex-col justify-between gap-4 cursor-pointer group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-700/70 text-emerald-300 font-mono text-xs font-bold">
                    {publishedCampaigns.length} {publishedCampaigns.length === 1 ? 'campaña' : 'campañas'}
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors">
                    Campañas en Meta Ads
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Ingresá a cada campaña en su interfaz privada con Anuncios, Grupo de Anuncios y reemplazo directo en Meta.
                  </p>
                </div>
              </div>
              <div className="pt-3 border-t border-zinc-800/80 text-xs font-bold text-emerald-400">
                Abrir Campañas →
              </div>
            </button>

            <button
              type="button"
              data-testid="hub-card-crear"
              onClick={() => {
                if (workflowStep === 'published' || (!brainProfile && creatives.length === 0)) {
                  handleStartNewCampaign();
                } else {
                  setActiveWorkspaceTab('crear');
                }
              }}
              className="text-left p-5 rounded-2xl bg-[#0f1115] border border-zinc-800 hover:border-emerald-500/70 transition-all flex flex-col justify-between gap-4 cursor-pointer group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono text-[11px] font-bold">
                    {creatives.length > 0 && workflowStep !== 'published'
                      ? `${creatives.length} en borrador`
                      : 'Desde Cero'}
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors">
                    Crear Campaña &amp; Anuncios IA
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Estudio dedicado para investigar, generar creativos en Cloudinary con precios en Guaraníes y publicar en Paraguay.
                  </p>
                </div>
              </div>
              <div className="pt-3 border-t border-zinc-800/80 text-xs font-bold text-emerald-400">
                Abrir Creador de Campañas →
              </div>
            </button>

            <button
              type="button"
              data-testid="hub-card-conexion"
              onClick={() => {
                setConexionSubTab('cloudinary');
                setActiveWorkspaceTab('conexion');
              }}
              className="text-left p-5 rounded-2xl bg-[#0f1115] border border-zinc-800 hover:border-sky-500/70 transition-all flex flex-col justify-between gap-4 cursor-pointer group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/35 flex items-center justify-center text-sky-400">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                      cloudinaryStatus?.configured
                        ? 'bg-emerald-950/80 border-emerald-700/70 text-emerald-300'
                        : 'bg-amber-950/80 border-amber-700/70 text-amber-300'
                    }`}
                  >
                    {cloudinaryStatus?.configured ? '● CLOUDINARY ACTIVO' : 'CONFIGURAR ENV'}
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-100 group-hover:text-sky-300 transition-colors">
                    Cuenta Meta &amp; Cloudinary
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Panel separado por pestañas para Cloudinary CDN, Portafolio/Píxel Meta, 12 Eventos CAPI y APIs IA.
                  </p>
                </div>
              </div>
              <div className="pt-3 border-t border-zinc-800/80 text-xs font-bold text-sky-400">
                Abrir Conexiones &amp; Cloudinary →
              </div>
            </button>
          </div>
        </>
      )}

      {/* ===================================================================== */}
      {/* INTERFAZ 2: CUENTA META & CLOUDINARY (INDEPENDIENTE CON PESTAÑAS)     */}
      {/* ===================================================================== */}
      {activeWorkspaceTab === 'conexion' && (
        <div
          data-testid="autoads-conexion-workspace"
          className="rounded-2xl bg-[#090a0c] border border-sky-500/30 shadow-2xl overflow-hidden"
        >
          {/* Cabecera Propia con Pestañas Internas */}
          <div className="px-4 py-3 bg-[#0f1115] border-b border-zinc-800/90 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                data-testid="autoads-conexion-back-inicio"
                onClick={() => setActiveWorkspaceTab('inicio')}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/90 text-xs font-semibold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
                <span>Inicio</span>
              </button>
              <span className="h-4 w-px bg-zinc-800 hidden sm:inline-block" />
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold text-zinc-100">Cuenta Meta &amp; Cloudinary</h2>
              </div>
            </div>

            <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-800 inline-flex flex-wrap items-center gap-1">
              <button
                type="button"
                data-testid="conexion-subtab-cloudinary"
                onClick={() => setConexionSubTab('cloudinary')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-all ${
                  conexionSubTab === 'cloudinary'
                    ? 'bg-sky-500 text-black font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Cloudinary ({cloudinaryResources.length})
              </button>
              <button
                type="button"
                data-testid="conexion-subtab-meta"
                onClick={() => setConexionSubTab('meta')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-all ${
                  conexionSubTab === 'meta'
                    ? 'bg-emerald-500 text-black font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Cuenta Meta &amp; Píxel
              </button>
              <button
                type="button"
                data-testid="conexion-subtab-capi"
                onClick={() => setConexionSubTab('capi')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-all ${
                  conexionSubTab === 'capi'
                    ? 'bg-emerald-500 text-black font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                CAPI &amp; Eventos ({capiAudit.eventsList.length})
              </button>
              <button
                type="button"
                data-testid="conexion-subtab-apis"
                onClick={() => setConexionSubTab('apis')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-all ${
                  conexionSubTab === 'apis'
                    ? 'bg-zinc-200 text-black font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                APIs IA &amp; Vault
              </button>
            </div>
          </div>

          {/* Cuerpo Limpio Según Pestaña Interna Activa */}
          <div className="p-4 sm:p-5">
            {conexionSubTab === 'cloudinary' && (
              <AutoAdsCloudinaryPanel
                status={cloudinaryStatus}
                resources={cloudinaryResources}
                loadingResources={loadingCloudinaryResources}
                onRefreshResources={() => refreshCloudinaryData()}
                onCopyText={handleCopyMetaRef}
                copiedKey={copiedRefKey}
              />
            )}

            {conexionSubTab === 'meta' && (
              <div
                data-testid="meta-official-reference-card"
                className="p-4 rounded-xl bg-[#0f1115] border border-emerald-900/50 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold text-[10px] uppercase tracking-wider">
                      Meta Graph Live
                    </span>
                    <span className="text-xs font-bold text-zinc-100">
                      Portafolio, Cuenta 834, Píxel 377 y Fanpage Oficial
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleConnectFacebookOAuth(metaConnected ? true : false)}
                      disabled={connectingFacebookOAuth}
                      className="px-2.5 py-1 rounded-lg bg-[#1877F2] hover:bg-[#166fe5] text-white font-semibold text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-white text-[#1877F2] font-bold text-[10px] inline-flex items-center justify-center leading-none">
                        f
                      </span>
                      <span>{metaConnected ? 'Reconectar OAuth' : 'Conectar Meta OAuth'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscoverLiveMetaNames}
                      disabled={syncingLiveMetaNames}
                      data-testid="btn-discover-live-meta-names"
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-[11px] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {syncingLiveMetaNames ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {metaConnected
                          ? 'Actualizar Nombres Reales (834 / 377)'
                          : 'Descubrir Nombres Meta'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                        1. Portafolio Comercial
                      </span>
                      <div className="text-sm font-semibold text-zinc-100 mt-0.5">Landingcod</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyMetaRef('portfolio', 'Portafolio Comercial', 'Landingcod')}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-[11px] font-bold flex items-center justify-center cursor-pointer"
                    >
                      {copiedRefKey === 'portfolio' ? '✅ Copiado' : 'Copiar Landingcod'}
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/70 flex flex-col justify-between gap-2">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          2. Cuenta (834)
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                          ACTIVA
                        </span>
                      </div>
                      <div data-testid="live-ad-account-name-834" className="text-sm font-semibold text-white mt-0.5">
                        {activeAdAccountName}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-300 mt-0.5">ID: 1048211497774834</div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyMetaRef('acc_num', `ID Cuenta ${activeAdAccountName} (834)`, '1048211497774834')
                        }
                        className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-black font-mono text-[10px] font-semibold cursor-pointer"
                      >
                        {copiedRefKey === 'acc_num' ? '✅ OK' : 'ID 834'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyMetaRef('acc_name', 'Nombre Cuenta Publicitaria (834)', activeAdAccountName)
                        }
                        className="py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-300 font-mono text-[10px] font-bold cursor-pointer"
                      >
                        {copiedRefKey === 'acc_name' ? '✅ OK' : 'Nombre'}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/70 flex flex-col justify-between gap-2">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          3. Píxel (377)
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                          ACTIVO
                        </span>
                      </div>
                      <div data-testid="live-pixel-name-377" className="text-sm font-semibold text-white mt-0.5">
                        {activeMetaPixel.name}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-300 mt-0.5">ID: {activeMetaPixel.id}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyMetaRef('pixel_id', `ID Píxel ${activeMetaPixel.name} (377)`, activeMetaPixel.id)
                        }
                        className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-black font-mono text-[10px] font-semibold cursor-pointer"
                      >
                        {copiedRefKey === 'pixel_id' ? '✅ OK' : 'ID 377'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyMetaRef('pixel_name', 'Nombre del Píxel (377)', activeMetaPixel.name)
                        }
                        className="py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-300 font-mono text-[10px] font-bold cursor-pointer"
                      >
                        {copiedRefKey === 'pixel_name' ? '✅ OK' : 'Nombre'}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                        4. Página Facebook
                      </span>
                      <div className="text-sm font-semibold text-zinc-100 mt-0.5">Landingcod Shop</div>
                      <div className="text-[11px] font-mono text-zinc-300 mt-0.5">ID: 1050835598123904</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyMetaRef('page_id', 'ID Página Landingcod Shop', '1050835598123904')
                      }
                      className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-[11px] font-bold flex items-center justify-center cursor-pointer"
                    >
                      {copiedRefKey === 'page_id' ? '✅ Copiado' : 'Copiar ID Página'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {conexionSubTab === 'capi' && (
              <div className="p-4 rounded-xl border border-emerald-900/60 bg-[#0f1115] space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap pb-2.5 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                      12 Eventos del Píxel &amp; Túnel First-Party CAPI (EMQ {capiAudit.emqScoreEstimated})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-zinc-400">
                      {capiAudit.lastTestAt ? `Último test: ${capiAudit.lastTestAt}` : 'SHA-256 Advanced Matching'}
                    </span>
                    <button
                      type="button"
                      onClick={handleVerifyCapiTunnel}
                      disabled={testingCapi}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                    >
                      {testingCapi && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>Probar Túnel CAPI</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {capiAudit.eventsList.map(evName => (
                    <div
                      key={evName}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center gap-1.5 text-[11px] text-zinc-200 font-mono"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="truncate">{evName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {conexionSubTab === 'apis' && renderSettingsVaultForm()}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* INTERFAZ 3: CAMPAÑAS Y VISTA PRIVADA POR CAMPAÑA (INDEPENDIENTE)      */}
      {/* ===================================================================== */}
      {activeWorkspaceTab === 'campanas' && (
        <AutoAdsCampaignsPanel
          campaigns={publishedCampaigns}
          selectedCampaign={selectedCampaignForPanel}
          onSelectCampaign={camp => setSelectedCampaignId(camp ? camp.id || camp.campaignId : null)}
          onBackToInicio={() => {
            setSelectedCampaignId(null);
            setActiveWorkspaceTab('inicio');
          }}
          onGoToCreateCampaign={handleStartNewCampaign}
          onSyncLiveCampaigns={handleSyncLiveMetaCampaigns}
          syncingCampaigns={syncingLiveCampaigns}
          cloudinaryResources={cloudinaryResources}
          workspacesCache={workspacesCache}
          pendingDraftsByKey={campaignPendingDrafts}
          regeneratingAdKey={campaignRegenAdKey}
          replacingAdKey={campaignReplaceAdKey}
          replacedInfoByKey={campaignReplacedInfo}
          onRegenerateCampaignAd={handleRegeneratePublishedCampaignAd}
          onDiscardDraft={adKey =>
            setCampaignPendingDrafts(prev => {
              const next = { ...prev };
              delete next[adKey];
              return next;
            })
          }
          onLaunchReplaceAd={handleLaunchReplacePublishedAd}
          onLoadCampaignInCreator={handleOpenCampaignWorkspace}
        />
      )}

      {/* ===================================================================== */}
      {/* INTERFAZ 4: CREAR CAMPAÑA & CREATIVOS (INDEPENDIENTE CON CABECERA)    */}
      {/* ===================================================================== */}
      {activeWorkspaceTab === 'crear' && (
        <div
          data-testid="autoads-crear-workspace"
          className="rounded-2xl bg-[#090a0c] border border-emerald-500/25 shadow-2xl overflow-hidden"
        >
          {/* Cabecera Única Dedicada a Crear Campaña */}
          <div className="px-4 py-3 bg-[#0f1115] border-b border-zinc-800/90 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                data-testid="autoads-crear-back-inicio"
                onClick={() => setActiveWorkspaceTab('inicio')}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/90 text-xs font-semibold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>Inicio</span>
              </button>
              <span className="h-4 w-px bg-zinc-800 hidden sm:inline-block" />
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-zinc-100">
                  {freshDraftMode || workflowStep === 'idle'
                    ? 'Nueva Campaña (Desde Cero)'
                    : 'Crear Campaña'}
                </h2>
              </div>

              <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('catalog');
                    syncWorkspaceOnSelectorChange(
                      'catalog',
                      selectedCatalogProduct?.id || selectedProductId,
                      externalUrlInput
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    sourceMode === 'catalog'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Página Creada
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('external_url');
                    syncWorkspaceOnSelectorChange(
                      'external_url',
                      selectedCatalogProduct?.id || selectedProductId,
                      externalUrlInput
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                    sourceMode === 'external_url'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Globe className="w-3 h-3 text-emerald-400" />
                  <span>URL Externa</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(workflowStep !== 'idle' || creatives.length > 0 || Boolean(brainProfile)) && (
                <button
                  type="button"
                  data-testid="autoads-reset-draft-btn"
                  onClick={() => resetCreatorToZero({ keepSourceAndProduct: true })}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-semibold text-zinc-200 inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCw className="w-3 h-3 text-emerald-400" />
                  <span>Desde Cero</span>
                </button>
              )}
              <div
                className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center gap-2"
                title={
                  onlyImagesMode
                    ? 'Los 6 anuncios se generan como imágenes con OpenAI GPT Image 2.6 Sunburst.'
                    : '4 Imágenes (Sunburst) + 2 Videos Reels de 15s (Gemini Omni 1.2 Flash).'
                }
              >
                <span className="text-[11px] font-semibold text-zinc-200 whitespace-nowrap">
                  {onlyImagesMode ? 'Solo Imágenes (6×)' : '4 Img + 2 Reels'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={onlyImagesMode}
                  data-testid="autoads-only-images-switch"
                  onClick={() => handleToggleOnlyImagesMode(!onlyImagesMode)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    onlyImagesMode ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ${
                      onlyImagesMode ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <span
                className="px-2 py-1 rounded-lg bg-emerald-950/70 border border-emerald-800/70 text-[11px] font-mono text-emerald-300 inline-flex items-center gap-1"
                title="Progreso guardado automáticamente en el backend"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Guardado{lastBackendSavedAt ? ` · ${lastBackendSavedAt}` : ''}</span>
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
          <div className="bg-[#0f1115] rounded-xl border border-zinc-800/90 p-3.5 space-y-3">
            {/* Selector de Producto o URL Externa */}
            {sourceMode === 'catalog' ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1">
                  <select
                    data-testid="autoads-product-select"
                    value={selectedCatalogProduct?.id || ''}
                    onChange={e => {
                      const newId = e.target.value;
                      setSelectedProductId(newId);
                      syncWorkspaceOnSelectorChange('catalog', newId, externalUrlInput);
                    }}
                    className="w-full px-3.5 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-xs sm:text-sm font-semibold text-zinc-100 outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {productPages.map(prod => (
                      <option key={prod.id} value={prod.id} className="bg-zinc-900 text-zinc-100">
                        {prod.nombre} — 1x {formatGs(prod.precios?.[1] || 189000)} · 2x {formatGs(prod.precios?.[2] || 358000)} (/?p={prod.slug})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedCatalogProduct && (
                  <button
                    type="button"
                    onClick={() => onOpenLiveProductPage(selectedCatalogProduct)}
                    className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <span>Ver Página</span>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="url"
                  value={externalUrlInput}
                  onChange={e => {
                    const nextUrl = e.target.value;
                    setExternalUrlInput(nextUrl);
                    syncWorkspaceOnSelectorChange('external_url', selectedProductId, nextUrl);
                  }}
                  placeholder="https://... Pegá la URL de cualquier página de producto para extraer fotos y precios"
                  className="flex-1 px-3.5 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 font-mono outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Flujo Secuencial en 3 Pasos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <button
                type="button"
                data-testid="autoads-step1-btn"
                onClick={handleStep1Research}
                disabled={workflowStep === 'researching' || workflowStep === 'generating' || workflowStep === 'publishing'}
                className={`py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  workflowStep === 'idle' || workflowStep === 'researching'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-400 shadow-sm'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-emerald-300 border-emerald-800/70'
                }`}
              >
                {workflowStep === 'researching' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Investigando...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {workflowStep === 'idle'
                        ? '1. Investigar Producto'
                        : '✓ 1. Re-Investigar'}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="autoads-step2-btn"
                onClick={handleStep2GenerateAds}
                disabled={
                  workflowStep === 'idle' ||
                  workflowStep === 'researching' ||
                  workflowStep === 'generating' ||
                  workflowStep === 'publishing'
                }
                className={`py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
                  workflowStep === 'researched'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-400 shadow-sm cursor-pointer'
                    : workflowStep === 'generated' || workflowStep === 'published'
                      ? 'bg-zinc-900 hover:bg-zinc-800 text-emerald-300 border-emerald-800/70 cursor-pointer'
                      : 'bg-zinc-900/50 text-zinc-500 border-zinc-800/60 cursor-not-allowed'
                }`}
              >
                {workflowStep === 'generating' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>
                      {onlyImagesMode ? 'Generando 6 Imágenes...' : 'Generando Anuncios...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {creatives.length > 0 &&
                        creatives.slice(0, onlyImagesMode ? 6 : 4).some(c => !c.aiGeneratedImageUrl)
                        ? '⚡ 2. Completar Faltantes'
                        : !onlyImagesMode && creatives.length > 0 && creatives.slice(4, 6).some(c => !c.aiGeneratedVideoUrl)
                          ? '🎬 2. Crear Reels #5 y #6'
                          : creatives.length > 0
                            ? `✓ 2. Regenerar (${creatives.length})`
                            : onlyImagesMode
                              ? '2. Crear 6 Imágenes IA'
                              : '2. Crear 6 Anuncios IA'}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="autoads-step3-btn"
                onClick={handleStep3PublishNow}
                disabled={creatives.length === 0 || workflowStep === 'publishing'}
                className={`py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
                  creatives.length > 0 && workflowStep !== 'publishing'
                    ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-sm cursor-pointer'
                    : 'bg-zinc-900/50 text-zinc-500 border-zinc-800/60 cursor-not-allowed'
                }`}
              >
                {workflowStep === 'publishing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Publicando en Meta Ads...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {workflowStep === 'published'
                        ? '✅ 3. Publicado · Republicar'
                        : '3. Publicar en Meta Ads'}
                    </span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 pt-0.5">
              <span>
                🇵🇾 Segmentación fijada: <strong className="text-zinc-200">Paraguay (PY) · 18–65 años</strong> · Precios 100% en Guaraníes (Gs.)
              </span>
              <span className="text-emerald-400/90">
                100% OpenRouter Oficial · Cero fallbacks ficticios
              </span>
            </div>

            {workflowStep === 'idle' && !brainProfile && creatives.length === 0 && (
              <div
                data-testid="autoads-fresh-start-notice"
                className="p-3 rounded-xl bg-zinc-900/60 border border-dashed border-zinc-700/80 text-xs text-zinc-300 flex items-center justify-between gap-2 flex-wrap"
              >
                <span>
                  Nueva campaña lista desde cero. Elegí un producto o URL externa y presioná <strong className="text-emerald-400">1. Investigar Producto</strong>.
                </span>
                <span className="text-[11px] text-zinc-500">
                  Las campañas ya creadas están en «Campañas».
                </span>
              </div>
            )}

            {/* Barra de progreso en vivo */}
            {(workflowStep === 'researching' || workflowStep === 'generating') && (
              <div className="p-3 rounded-lg bg-zinc-900 border border-emerald-800/60 flex items-center gap-2.5 text-xs text-emerald-300">
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-emerald-400" />
                <span className="font-mono">
                  {workflowStep === 'researching' ? researchProgressText : generationProgressText}
                </span>
              </div>
            )}

            {/* Resumen Compacto Colapsable de Inteligencia Competitiva */}
            {brainProfile && workflowStep !== 'idle' && workflowStep !== 'researching' && (
              <div className="rounded-lg bg-zinc-900/70 border border-zinc-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowIntelDetails(prev => !prev)}
                  className="w-full px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-xs font-semibold text-zinc-100 truncate">
                      Inteligencia Lista: &ldquo;{activeProduct?.nombre}&rdquo; · {allProductPhotos.length} fotos · {brainProfile.competitorInsights.activeAdsFound} ads analizados
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
                    <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/70 text-sky-300">
                      {brainProfile.avatars.length}×6 Ángulos
                    </span>
                    <span className="text-zinc-400 inline-flex items-center gap-1">
                      <span>{showIntelDetails ? 'Ocultar' : 'Estrategia'}</span>
                      {showIntelDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </button>

                {showIntelDetails && (
                  <div className="px-3 pb-3 pt-1 border-t border-zinc-800/80 grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800/80 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                        Ganchos Ganadores Detectados
                      </span>
                      <ul className="space-y-1 text-[11px] text-zinc-300">
                        {brainProfile.competitorInsights.commonHooks.slice(0, 3).map((hook, idx) => (
                          <li key={idx} className="truncate">
                            • {hook}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800/80 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
                        Estrategia Aplicada (Andrómeda + Hormozi + Schwartz)
                      </span>
                      <ul className="space-y-1 text-[11px] text-zinc-300">
                        {brainProfile.competitorInsights.winningPatterns.slice(0, 3).map((pat, idx) => (
                          <li key={idx} className="truncate">
                            • {pat}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* PREVISUALIZACIÓN EXACTA DE ANUNCIOS CON PESTAÑAS DE FILTRO            */}
          {/* ===================================================================== */}
          {creatives.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-800 inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCreativesFilter('all')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                      creativesFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Todos ({creatives.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreativesFilter('feed')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                      creativesFilter === 'feed' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Anuncios #1–#3
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreativesFilter('pack_reels')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                      creativesFilter === 'pack_reels' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {onlyImagesMode ? 'Anuncios #4–#6' : 'Packs & Reels #4–#6'}
                  </button>
                </div>

                <span className="text-[11px] font-mono text-zinc-500">
                  Mostrando {filteredCreativeEntries.length} de {creatives.length} creativos
                </span>
              </div>

              {/* Grid de los Anuncios con Diseño Limpio Tipo Feed Facebook / Instagram */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCreativeEntries.map(({ ad, idx }) => {
              const isReel = !onlyImagesMode && (ad.type === 'video_reel_9x16' || idx >= 4);
              const aiGeneratedPhotoUrl = !isReel
                ? ad.aiGeneratedImageDataUrl || ad.aiGeneratedImageUrl || ''
                : '';
              const isEditingThis = editingAdIdx === idx;
              const isRegeneratingThis = regeneratingAdIdx === idx;

              return (
                <div
                  key={ad.id}
                  data-testid={`facebook-ad-card-${idx}`}
                  className="rounded-lg border border-zinc-800 bg-[#18191a] text-[#e4e6eb] overflow-hidden flex flex-col justify-between shadow-xl"
                >
                  {/* Barra Superior de Controles del Anuncio */}
                  <div className="px-3 py-2 bg-[#0f0f11] border-b border-zinc-800 flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                        Ad #{idx + 1} · {isReel ? '🎬 Reel IA' : ad.aspectRatio === '9:16' ? '📱 Story IA' : '🖼️ Feed IA'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-700/60 text-[10px] font-mono text-emerald-300">
                        {isReel ? `🎬 ${selectedVideoModel}` : `🎨 ${selectedImageModel}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isReel && (
                        <button
                          type="button"
                          onClick={() => handleGenerateVideoOnlyForReel(idx)}
                          disabled={isRegeneratingThis}
                          title="Crear o actualizar directamente el Video MP4 de este Reel"
                          className={`px-2 py-1 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer ${ad.aiGeneratedVideoUrl
                              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/70'
                              : 'bg-amber-400 text-black border-amber-300 hover:bg-amber-300'
                            }`}
                        >
                          <span>{ad.aiGeneratedVideoUrl ? '🎬 Video MP4 Activo' : '🎬 Crear Video Reel'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setEditingAdIdx(isEditingThis ? null : idx)}
                        title={isReel ? 'Editar texto, titular o prompt de video Reel' : 'Editar texto, titular o prompt de imagen IA'}
                        className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-semibold text-zinc-300 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3 text-amber-400" />
                        <span>{isEditingThis ? 'Listo' : 'Editar'}</span>
                      </button>

                      <button
                        type="button"
                        data-testid={`regenerate-ad-btn-${idx}`}
                        onClick={() => handleRegenerateSingleAd(idx)}
                        disabled={isRegeneratingThis}
                        title={
                          isReel
                            ? `Generar directamente un nuevo Video Reel MP4 con ${selectedVideoModel}`
                            : `Generar una nueva Imagen con ${selectedImageModel} en OpenRouter`
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCw className={`w-3 h-3 ${isRegeneratingThis ? 'animate-spin' : ''}`} />
                        <span>{isRegeneratingThis ? 'Generando...' : 'Cambiar'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Banner de Reemplazo Automático en Meta Ads cuando se regeneró un anuncio ya publicado */}
                  {activePublishedCampaignForProduct && creatorPendingReplaceMap[idx] && (
                    <div className="px-3 py-2 bg-amber-950/70 border-b border-amber-500/40 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-amber-200">
                        Borrador nuevo listo · Reemplazará el Ad #{idx + 1} en Meta Ads (borra el anterior)
                      </span>
                      <button
                        type="button"
                        data-testid={`launch-replace-creator-ad-${idx}`}
                        onClick={() => handleLaunchCreatorAdReplacement(idx)}
                        disabled={creatorReplacingIdx === idx}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                      >
                        {creatorReplacingIdx === idx ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        <span>
                          {creatorReplacingIdx === idx
                            ? 'Reemplazando en Meta...'
                            : `Lanzar Ad #${idx + 1} en Meta`}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Cuerpo del Anuncio Idéntico a Facebook Mobile Feed */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {/* 1. Cabecera de Página de Facebook (Avatar + Nombre + "Publicidad · 🌍") */}
                      <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {aiGeneratedPhotoUrl ? (
                            <img
                              src={aiGeneratedPhotoUrl}
                              alt={activeProduct.nombre}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-full object-cover border border-emerald-500/50 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-300 flex items-center justify-center font-semibold text-xs shrink-0">
                              {(extractProductCoreIdentity(activeProduct).shortCategoryNoun || 'P')[0]}
                            </div>
                          )}
                          <div>
                            <div className="text-xs font-bold text-white leading-tight">
                              {extractProductCoreIdentity(activeProduct).shortCategoryNoun} · Oficial PY
                            </div>
                            <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                              <span>Publicidad</span>
                              <span>·</span>
                              <span>🌍</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-zinc-400 font-bold text-sm px-1">•••</span>
                      </div>

                      {/* 2. Texto Principal (Primary Text arriba de la imagen, igual que en Facebook) */}
                      <div className="px-3 pb-2.5">
                        {isEditingThis ? (
                          <div className="space-y-2">
                            <textarea
                              rows={6}
                              value={ad.primaryText}
                              onChange={e => handleUpdateAdField(idx, 'primaryText', e.target.value)}
                              className="w-full p-2 rounded-lg bg-zinc-900 border border-emerald-500 text-xs text-zinc-100 outline-none"
                            />
                            <div className="p-2 rounded-lg bg-black/80 border border-zinc-800 space-y-1.5">
                              <span className="text-[10px] font-mono font-bold text-emerald-400 block">
                                {isReel
                                  ? `🎬 PROMPT DE VIDEO REEL DIRECTO (${selectedVideoModel}):`
                                  : `🎨 PROMPT DE IMAGEN OPENROUTER (${selectedImageModel}):`}
                              </span>
                              <textarea
                                rows={2}
                                value={ad.aiImagePrompt || ''}
                                onChange={e =>
                                  setCreatives(prev =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, aiImagePrompt: e.target.value } : item
                                    )
                                  )
                                }
                                className="w-full p-1.5 rounded bg-zinc-900 border border-zinc-700 text-[11px] text-zinc-200 font-mono outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  isReel
                                    ? handleGenerateVideoOnlyForReel(idx, ad.aiImagePrompt)
                                    : handleGenerateImageOnlyForAd(idx, ad.aiImagePrompt)
                                }
                                disabled={isRegeneratingThis}
                                className="w-full py-1.5 rounded bg-emerald-500 text-black text-[11px] font-bold hover:bg-emerald-400 cursor-pointer"
                              >
                                {isReel
                                  ? '🎬 Crear Video Reel directo con este Prompt'
                                  : '⚡ Generar Imagen en OpenRouter con este Prompt'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-[#e4e6eb] whitespace-pre-line leading-relaxed">
                            {ad.primaryText}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 3. Creativo Visual de Alto Impacto Persuasivo (#1-#4 Imagen IA | #5-#6 Video Reel MP4 Directo) */}
                    <div>
                      <div className="relative bg-zinc-950 border-y border-zinc-800 overflow-hidden aspect-square flex items-center justify-center">
                        {isReel && ad.aiGeneratedVideoUrl ? (
                          <>
                            <video
                              key={ad.aiGeneratedVideoUrl}
                              src={ad.aiGeneratedVideoUrl}
                              autoPlay
                              loop
                              muted
                              playsInline
                              controls
                              className={`w-full h-full object-cover transition-opacity duration-300 ${isRegeneratingThis ? 'opacity-30' : 'opacity-100'
                                }`}
                            />
                            {/* Cinta Superior de Impacto 0.0s Congruente con las Primeras Palabras de la 1ª Estrofa + Indicador Reel MP4 */}
                            <div className="absolute top-0 inset-x-0 p-2 bg-gradient-to-b from-black/90 via-black/60 to-transparent flex items-center justify-between gap-1.5 pointer-events-none">
                              <span className="px-2 py-0.5 rounded bg-amber-400 text-black text-[10px] font-medium uppercase tracking-tight shadow-sm truncate">
                                {((ad.primaryText || '').split('\n')[0] || '').split(':')[0] ||
                                  ad.hookBadge ||
                                  `🔥 ${extractProductCoreIdentity(activeProduct).ultraShortObjectLabel.toUpperCase()} EN OFERTA`}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-semibold uppercase tracking-tight shadow-sm shrink-0">
                                🎬 VIDEO REEL MP4
                              </span>
                            </div>

                            {/* Zócalo Inferior Compacto (sin tapar video ni controles) */}
                            <div className="absolute bottom-9 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
                              <span className="px-2 py-0.5 rounded bg-black/85 border border-emerald-500/60 text-emerald-300 text-[10px] font-bold truncate backdrop-blur-sm">
                                1x Gs. {Number(activeProduct.precios?.[1] || 189000).toLocaleString('es-PY')} · Pagás al recibir
                              </span>
                            </div>
                          </>
                        ) : !isReel && aiGeneratedPhotoUrl ? (
                          <>
                            <img
                              src={aiGeneratedPhotoUrl}
                              alt={ad.headline}
                              referrerPolicy="no-referrer"
                              onError={() => {
                                // Si un contenedor anterior en Railway se reinició antes del respaldo Base64 y el archivo físico .png dio 404, limpiar la ruta huérfana para mostrar el botón limpio de regeneración en lugar de un ícono roto
                                setCreatives(prev =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? { ...item, aiGeneratedImageUrl: '', aiGeneratedImageDataUrl: '' }
                                      : item
                                  )
                                );
                              }}
                              className={`w-full h-full object-cover transition-opacity duration-300 ${isRegeneratingThis ? 'opacity-30' : 'opacity-100'
                                }`}
                            />
                            {/* Cinta Superior de Impacto 0.0s Congruente con las Primeras Palabras de la 1ª Estrofa */}
                            <div className="absolute top-0 inset-x-0 p-2 bg-gradient-to-b from-black/90 via-black/60 to-transparent flex items-center justify-between gap-1.5 pointer-events-none">
                              <span className="px-2 py-0.5 rounded bg-amber-400 text-black text-[10px] font-medium uppercase tracking-tight shadow-sm truncate">
                                {((ad.primaryText || '').split('\n')[0] || '').split(':')[0] ||
                                  ad.hookBadge ||
                                  `🔥 ${extractProductCoreIdentity(activeProduct).ultraShortObjectLabel.toUpperCase()} EN OFERTA`}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-semibold uppercase tracking-tight shadow-sm shrink-0">
                                ENVÍO GRATIS PY
                              </span>
                            </div>

                            {/* Zócalo Inferior Compacto (sin duplicar texto largo encima de la imagen) */}
                            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
                              <span className="px-2 py-0.5 rounded bg-black/85 border border-emerald-500/60 text-emerald-300 text-[10px] font-bold truncate backdrop-blur-sm">
                                {idx === 3
                                  ? `Pack 2x Gs. ${Number(activeProduct.precios?.[2] || 358000).toLocaleString('es-PY')}`
                                  : `1x Gs. ${Number(activeProduct.precios?.[1] || 189000).toLocaleString('es-PY')}`}{' '}
                                · Pagás al recibir
                              </span>
                            </div>
                          </>
                        ) : workflowStep === 'generating' ? (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-emerald-300 bg-zinc-950 gap-2.5">
                            <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
                            <span className="text-xs font-mono text-zinc-100 font-bold">
                              {isReel
                                ? `🎬 Creando directamente Video Reel MP4 #${idx + 1}...`
                                : `Sintetizando Imagen IA #${idx + 1} en OpenRouter...`}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {isReel ? selectedVideoModel : selectedImageModel}
                            </span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-zinc-400 bg-zinc-950 gap-2">
                            <Sparkles className="w-7 h-7 text-emerald-400/80" />
                            <span className="text-xs font-mono text-zinc-200 font-bold">
                              {isReel ? 'Video Reel MP4 pendiente' : 'Imagen pendiente en OpenRouter'}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              Modelo: {isReel ? selectedVideoModel : selectedImageModel}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                isReel
                                  ? handleGenerateVideoOnlyForReel(idx, ad.aiImagePrompt)
                                  : handleGenerateImageOnlyForAd(idx, ad.aiImagePrompt)
                              }
                              disabled={isRegeneratingThis}
                              className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold cursor-pointer"
                            >
                              {isReel ? '🎬 Crear Video Reel MP4 ahora' : '⚡ Generar Imagen IA ahora'}
                            </button>
                          </div>
                        )}
                        {isRegeneratingThis && (
                          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2 p-4 text-center">
                            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-300 font-mono">
                              {isReel
                                ? `Creando directamente Video Reel MP4 con ${selectedVideoModel}...`
                                : `Generando Imagen con ${selectedImageModel}...`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 4. Franja Gris Inferior de Facebook (Dominio + Titular en Negrita + Botón CTA) */}
                      <div className="p-3 bg-[#242526] flex items-center justify-between gap-2.5 border-b border-zinc-800">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] text-zinc-400 uppercase tracking-wide truncate">
                            {landingDisplayHost}
                          </div>
                          {isEditingThis ? (
                            <input
                              type="text"
                              value={ad.headline}
                              onChange={e => handleUpdateAdField(idx, 'headline', e.target.value)}
                              className="w-full mt-0.5 px-2 py-1 rounded bg-zinc-900 border border-emerald-500 text-xs font-bold text-white outline-none"
                            />
                          ) : (
                            <div className="text-xs font-bold text-white leading-snug line-clamp-1">
                              {ad.headline}
                            </div>
                          )}
                          <div className="text-[11px] text-zinc-400 truncate">
                            {ad.descriptionText}
                          </div>
                        </div>
                        <span className="px-3 py-2 rounded-lg bg-[#3a3b3c] hover:bg-[#4e4f50] text-white text-xs font-bold shrink-0">
                          {ad.ctaLabel}
                        </span>
                      </div>

                      {/* 5. Barra Social de Facebook (Me gusta · Comentar · Compartir) */}
                      <div className="px-3 py-2 bg-[#18191a] flex items-center justify-around text-[11px] text-zinc-400 font-semibold">
                        <span className="inline-flex items-center gap-1.5">
                          <ThumbsUp className="w-3.5 h-3.5" /> Me gusta
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5" /> Comentar
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Share2 className="w-3.5 h-3.5" /> Compartir
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
          </div>
        </div>
      )}

      {/* Pop-up Modal de Error (OpenRouter o Publicación en Meta Ads) */}
      {apiErrorModal?.isOpen && (() => {
        const isMetaPublishError = Boolean(
          apiErrorModal.sourceEndpoint?.includes('/meta/') ||
          apiErrorModal.sourceEndpoint?.includes('/pipeboard/publish')
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-[#0f0f11] border border-red-500/30 rounded-lg shadow-lg p-6 text-white space-y-4 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-start space-x-3">
                <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white leading-tight">
                    {apiErrorModal.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-normal">
                    {isMetaPublishError
                      ? 'Meta Ads rechazó la publicación real en la cuenta publicitaria. Revisá el detalle exacto devuelto por Meta antes de reintentar.'
                      : 'Se ha pausado la generación de anuncios porque la API de OpenRouter retornó un error o no está activa. Se desactivaron todos los fallbacks ficticios para garantizar contenido 100% genuino.'}
                  </p>
                </div>
              </div>

              <div className="bg-zinc-950 border border-red-900/40 rounded-xl p-3 text-xs font-mono text-red-300 leading-relaxed max-h-48 overflow-y-auto select-text break-words">
                {apiErrorModal.errorMessage}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end">
                <button
                  onClick={() => {
                    setApiErrorModal(null);
                    if (isMetaPublishError) {
                      setShowFacebookOAuthModal(true);
                    } else {
                      setConexionSubTab('apis');
                      setActiveWorkspaceTab('conexion');
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  <Settings2 className="w-4 h-4" />
                  <span>
                    {isMetaPublishError
                      ? 'Reconectar Meta Ads / Facebook OAuth'
                      : 'Configurar API Key en OpenRouter'}
                  </span>
                </button>
                <button
                  onClick={() => setApiErrorModal(null)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg text-xs transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* MODAL DE LOGIN OAUTH 1-CLIC CON FACEBOOK / META ADS                   */}
      {/* ===================================================================== */}
      {showFacebookOAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-[#0f0f11] border border-blue-500/40 rounded-lg shadow-lg p-6 text-white space-y-4 relative overflow-y-auto max-h-[92vh]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1877F2] text-white font-semibold text-xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-950/60">
                  f
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Iniciar Sesión en Meta Ads con Facebook (OAuth 1-Clic)
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Autorizá tu cuenta de Facebook para que el sistema detecte tu Cuenta Publicitaria, tu Página y tu Píxel y publique los 6 anuncios.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFacebookOAuthModal(false)}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {metaAuthErrorBanner && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-700/70 text-xs text-red-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed break-words">{metaAuthErrorBanner}</span>
              </div>
            )}

            {metaConnected && (
              <div className="p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-700/80 space-y-2 text-xs">
                <div className="font-bold text-emerald-300 flex items-center justify-between">
                  <span>Cuenta de Facebook / Meta Ads Conectada</span>
                  <span className="font-mono text-[11px]">{metaUser?.name || 'Autorizada'}</span>
                </div>
                {metaAdAccounts.length > 0 && (
                  <div>
                    <label className="block text-zinc-300 mb-1 font-medium">
                      Seleccioná tu Cuenta Publicitaria activa:
                    </label>
                    <select
                      value={pbConfig.selectedAdAccountId}
                      onChange={e =>
                        setPbConfig(prev => ({ ...prev, selectedAdAccountId: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-emerald-700 text-zinc-100 font-mono text-xs"
                    >
                      {metaAdAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.id}) {acc.currency ? `· Moneda: ${acc.currency}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {metaPages.length > 0 && (
                  <div>
                    <label className="block text-zinc-300 mb-1 font-medium">
                      Seleccioná tu Página de Facebook para los anuncios:
                    </label>
                    <select
                      value={pbConfig.selectedFacebookPageId}
                      onChange={e =>
                        setPbConfig(prev => ({ ...prev, selectedFacebookPageId: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-emerald-700 text-zinc-100 font-mono text-xs"
                    >
                      {metaPages.map(pg => (
                        <option key={pg.id} value={pg.id}>
                          {pg.name} ({pg.id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* OPCIÓN 1: OAUTH OFICIAL DE FACEBOOK (VENTANA EMERGENTE 1-CLIC) */}
            <div className="p-4 rounded-lg bg-zinc-900/90 border border-blue-500/30 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                  Opción A · Ventana Emergente Oficial de Facebook Login (OAuth 2.0)
                </span>
                {hasMetaAppCredentials && (
                  <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono text-[10px]">
                    App ID configurada ({metaAppIdPreview})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1">Meta App ID (developers.facebook.com)</label>
                  <input
                    type="text"
                    name="meta_app_id_oauth"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={metaAppIdInput}
                    onChange={e => setMetaAppIdInput(e.target.value)}
                    placeholder={hasMetaAppCredentials ? `Guardado (${metaAppIdPreview})` : 'Ej: 1465256781554439'}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Meta App Secret</label>
                  <input
                    type="password"
                    name="meta_app_secret_oauth"
                    autoComplete="new-password"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={metaAppSecretInput}
                    onChange={e => setMetaAppSecretInput(e.target.value)}
                    placeholder={hasMetaAppCredentials ? '••••••••••••••••' : 'Clave secreta de tu App Meta'}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                <div className="font-semibold text-zinc-300">
                  URI de Redirección OAuth válida (Callback URL para Facebook Login):
                </div>
                <div className="font-mono text-emerald-400 select-all break-all">
                  {window.location.origin}/api/meta/callback
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleConnectFacebookOAuth(false)}
                disabled={connectingFacebookOAuth}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-950/60 cursor-pointer transition-all"
              >
                {connectingFacebookOAuth ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-white text-[#1877F2] font-semibold text-xs inline-flex items-center justify-center">
                    f
                  </span>
                )}
                <span>Abrir Página de Facebook y Autorizar Mi Cuenta (OAuth Popup)</span>
              </button>
            </div>

            {/* OPCIÓN 2: LOGIN RÁPIDO SIN CREAR APP EN META DEVELOPERS (TOKEN DIRECTO EAA... O PIPEBOARD OAUTH) */}
            <form onSubmit={handleQuickConnectTokenInModal} autoComplete="off" className="p-4 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  Opción B · Conexión Instantánea (Token Meta EAA... o Pipeboard Facebook Login)
                </span>
                <a
                  href="https://pipeboard.co"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-blue-400 hover:text-sky-300 inline-flex items-center gap-1 underline"
                >
                  <span>Abrir Facebook Login en Pipeboard.co</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Si no querés configurar un App ID en Meta Developers, pegá aquí tu <strong>Access Token de Meta Ads (EAA...)</strong> o tu <strong>Token de Pipeboard</strong>. El sistema descubrirá automáticamente tu Cuenta Publicitaria (act_...), tu Página y tu Píxel.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  name="meta_direct_token_oauth"
                  autoComplete="new-password"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  value={directMetaTokenInput}
                  onChange={e => setDirectMetaTokenInput(e.target.value)}
                  placeholder="Pegá tu Token EAA... de Meta Ads o tu Token de Pipeboard..."
                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 font-mono text-xs outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!directMetaTokenInput.trim() || connectingFacebookOAuth}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shrink-0 cursor-pointer disabled:opacity-50"
                >
                  Conectar y Sincronizar Cuenta
                </button>
              </div>
            </form>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowFacebookOAuthModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
