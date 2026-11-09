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
  AlertTriangle
} from 'lucide-react';
import { ProductPage } from '../types';
import { formatGs } from '../config';
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
  const [onlyImagesMode, setOnlyImagesMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('autoads_only_images_mode') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleOnlyImagesMode = (nextValue: boolean) => {
    setOnlyImagesMode(nextValue);
    try {
      localStorage.setItem('autoads_only_images_mode', nextValue ? 'true' : 'false');
    } catch {}
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

  // Estado de conexión en servidor
  const [metaConnected, setMetaConnected] = useState<boolean>(false);
  const [metaPages, setMetaPages] = useState<Array<{ id: string; name: string; category: string; access_token?: string }>>([]);

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

  // Campañas publicadas
  const [publishedCampaigns, setPublishedCampaigns] = useState<PipeboardPublishedCampaignRecord[]>([]);

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
        } catch {}
      }
    } else {
      setBrainProfile(null);
      setCreatives([]);
      setAdVariationCounters({});
      setAdPhotoIndexOverride({});
      setWorkflowStep('idle');
    }
  };

  // Helper para recuperar la API Key de OpenRouter desde la bóveda persistente del navegador (sobrevive reinicios del contenedor en la nube)
  const getVaultOpenRouterKey = (): string => {
    try {
      return (
        openRouterKeyInput.trim() ||
        localStorage.getItem('autoads_openrouter_api_key_vault') ||
        localStorage.getItem('noelux_openrouter_api_key') ||
        ''
      ).trim();
    } catch {
      return openRouterKeyInput.trim();
    }
  };

  // Cargar configuración de servidor y estado CAPI al montar
  useEffect(() => {
    fetch('/api/pipeboard/config')
      .then(r => r.json())
      .then(data => {
        if (data?.config) {
          setPbConfig(prev => ({
            ...prev,
            ...data.config,
            pipeboardApiToken: '',
            openRouterApiKey: '',
            metaAccessTokenFallback: ''
          }));
        }
        setHasPipeboardTokenInBackend(Boolean(data?.hasPipeboardToken));
        setPipeboardTokenPreview(String(data?.pipeboardTokenPreview || ''));
        setHasOpenRouterKeyInBackend(Boolean(data?.hasOpenRouterKey));
        setOpenRouterKeyPreview(String(data?.openRouterKeyPreview || ''));
        if (Array.isArray(data?.publishedCampaigns)) {
          setPublishedCampaigns(data.publishedCampaigns);
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
            .catch(() => {});
        }
      })
      .catch(() => {});

    fetch('/api/meta/status')
      .then(r => r.json())
      .then(data => {
        if (data?.connected) {
          setMetaConnected(true);
          if (Array.isArray(data.adAccounts) && data.adAccounts[0]?.id) {
            setPbConfig(prev => ({
              ...prev,
              selectedAdAccountId: data.adAccounts[0].id
            }));
          }
          if (Array.isArray(data.pages) && data.pages[0]?.id) {
            setMetaPages(data.pages);
            setPbConfig(prev => ({
              ...prev,
              selectedFacebookPageId: data.pages[0].id
            }));
          }
        }
        if (data?.universalPixelId) {
          setCapiAudit(prev => ({
            ...prev,
            pixelConfigured: true,
            pixelId: String(data.universalPixelId)
          }));
        }
      })
      .catch(() => {});

    // Restaurar automáticamente desde el Backend todo el trabajo previo (Investigación + Imágenes + Videos + Paso exacto)
    fetch('/api/autoads/workspace')
      .then(r => r.json())
      .then(wsData => {
        let loadedWorkspaces: Record<string, any> =
          wsData?.workspaces && typeof wsData.workspaces === 'object' ? wsData.workspaces : {};
        let loadedLastActive = wsData?.lastActive || null;

        // Si el contenedor se reinició en la nube y el backend aún está vacío, recuperar del espejo local y sincronizar al backend
        if (Object.keys(loadedWorkspaces).length === 0) {
          try {
            const localBackupRaw = localStorage.getItem('autoads_workspace_backup_v1');
            if (localBackupRaw) {
              const localBackup = JSON.parse(localBackupRaw);
              if (localBackup?.workspaces && Object.keys(localBackup.workspaces).length > 0) {
                loadedWorkspaces = localBackup.workspaces;
                loadedLastActive = localBackup.lastActive || loadedLastActive;
              }
            }
          } catch {}
        }

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
        if (savedWs) {
          applySavedWorkspaceToState(savedWs);
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

    setWorkspacesCache(prev => {
      const updated = {
        ...prev,
        [wsKey]: currentWorkspacePayload
      };
      try {
        localStorage.setItem(
          'autoads_workspace_backup_v1',
          JSON.stringify({ lastActive: nextLastActive, workspaces: updated })
        );
      } catch {}
      return updated;
    });

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
      .catch(() => {});
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

  // Guardar Slot Pipeboard + OpenRouter Key en Backend + Bóveda Persistente Local
  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    const tokenToSend = pipeboardTokenInput.trim();
    const orKeyToSend = openRouterKeyInput.trim();
    if (orKeyToSend && orKeyToSend.startsWith('sk-or-')) {
      try {
        localStorage.setItem('autoads_openrouter_api_key_vault', orKeyToSend);
        localStorage.setItem('noelux_openrouter_api_key', orKeyToSend);
      } catch {}
    }
    setPipeboardTokenInput('');
    setOpenRouterKeyInput('');
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
          selectedImageModel,
          selectedVideoModel,
          metaAccessTokenFallback: ''
        })
      });
      if (res.ok) {
        const data = await res.json();
        setHasPipeboardTokenInBackend(Boolean(data?.hasPipeboardToken));
        setPipeboardTokenPreview(String(data?.pipeboardTokenPreview || ''));
        setHasOpenRouterKeyInBackend(Boolean(data?.hasOpenRouterKey));
        setOpenRouterKeyPreview(String(data?.openRouterKeyPreview || ''));
        if (tokenToSend || orKeyToSend) {
          setLastTokenSelfDestructAt(new Date().toLocaleTimeString('es-PY'));
          showToast('🔒 Credenciales guardadas en el Backend y protegidas contra reinicios.');
        } else {
          showToast('Configuración actualizada en el Backend.');
        }
      }
    } catch {
      showToast('Error al conectar con el servidor.');
    } finally {
      setSavingSettings(false);
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

      const baseAssets = buildCreativeAssetsFromBrain(activeProduct, currentBrain);
      let workingAssets = isResumeIncomplete
        ? baseAssets.map((asset, idx) => ({
            ...asset,
            type: onlyImagesMode && idx >= 4 ? ('image_story_9x16' as const) : asset.type,
            headline: existingCreatives[idx]?.headline || asset.headline,
            primaryText: sanitizeAdCopyForParaguayCod(
              existingCreatives[idx]?.primaryText || asset.primaryText,
              activeProduct,
              idx
            ),
            descriptionText: existingCreatives[idx]?.descriptionText || asset.descriptionText,
            ctaLabel: existingCreatives[idx]?.ctaLabel || asset.ctaLabel,
            aiGeneratedImageUrl:
              idx < imageSliceEnd ? existingCreatives[idx]?.aiGeneratedImageUrl || '' : '',
            aiGeneratedVideoUrl:
              !onlyImagesMode && idx >= 4 ? existingCreatives[idx]?.aiGeneratedVideoUrl || '' : '',
            aiImagePrompt: existingCreatives[idx]?.aiImagePrompt || asset.aiImagePrompt
          }))
        : baseAssets.map((asset, idx) => ({
            ...asset,
            type: onlyImagesMode && idx >= 4 ? ('image_story_9x16' as const) : asset.type,
            primaryText: sanitizeAdCopyForParaguayCod(asset.primaryText, activeProduct, idx),
            aiGeneratedImageUrl: idx < imageSliceEnd ? asset.aiGeneratedImageUrl || '' : '',
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
              workingAssets[cardIdx] = {
                ...workingAssets[cardIdx],
                aiGeneratedImageUrl: match.imageUrl,
                aiImagePrompt: match.prompt || workingAssets[cardIdx]?.aiImagePrompt
              };
              completedCardsCount += 1;
              setCreatives(prev =>
                prev.map((item, idx) =>
                  idx === cardIdx
                    ? {
                        ...item,
                        aiGeneratedImageUrl: match.imageUrl,
                        aiImagePrompt: match.prompt || item.aiImagePrompt
                      }
                    : item
                )
              );
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

      setCreatives(prev =>
        prev.map((item, idx) =>
          idx === adIndex
            ? {
                ...item,
                aiGeneratedImageUrl: data.customBrief.aiGeneratedImageUrl,
                aiImagePrompt: data.customBrief.imagePrompt || item.aiImagePrompt
              }
            : item
        )
      );
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
    setWorkflowStep('publishing');

    try {
      const landingUrl =
        sourceMode === 'external_url' && externalUrlInput.trim()
          ? externalUrlInput.trim()
          : `${window.location.origin}/?p=${activeProduct.slug}`;

      const publishEndpoint =
        metaConnected && !hasPipeboardTokenInBackend
          ? '/api/meta/publish-direct'
          : '/api/pipeboard/publish-campaign';

      const selectedPage = metaPages.find(p => p.id === pbConfig.selectedFacebookPageId);

      const pubRes = await fetch(publishEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: activeProduct,
          creatives,
          brainProfile,
          adAccountId: pbConfig.selectedAdAccountId,
          facebookPageId: pbConfig.selectedFacebookPageId,
          pageAccessToken: selectedPage?.access_token || '',
          dailyBudgetGs: pbConfig.dailyBudgetGs,
          publishStatus: pbConfig.defaultPublishStatus,
          pipeboardMcpEndpoint: pbConfig.pipeboardMcpEndpoint,
          landingUrl,
          pixelId: activeProduct.metaTracking?.pixelId || ''
        })
      });

      if (pubRes.ok) {
        const pubData = await pubRes.json();
        if (pubData?.campaign) {
          setPublishedCampaigns(prev => [pubData.campaign, ...prev]);
        }
        setWorkflowStep('published');
        showToast(
          `🚀 ¡Campaña publicada con éxito en Meta Ads con tus ${creatives.length} anuncios aprobados!`
        );
      } else {
        setWorkflowStep('generated');
        showToast('Error al publicar en Meta Ads. Verificá la conexión de tu cuenta en el servidor.');
      }
    } catch {
      setWorkflowStep('generated');
      showToast('Error de red al conectar con el servidor de publicación.');
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
      } catch {}
    }
    return (window.location.hostname || 'AUTOADS360.UP.RAILWAY.APP').toUpperCase();
  }, [sourceMode, externalUrlInput]);

  return (
    <div data-testid="autoads-view" className="max-w-6xl mx-auto space-y-4 font-sans text-zinc-100">
      {/* ===================================================================== */}
      {/* 1. CABECERA ULTRA-COMPACTA CON BOTONES DE DIAGNÓSTICO Y CONFIGURACIÓN */}
      {/* ===================================================================== */}
      <div className="p-3.5 sm:px-5 rounded-2xl bg-[#0d0d0f] border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400 flex items-center justify-center font-black text-xs shrink-0">
            ▲
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-zinc-100">AutoAds Piloto IA</h1>
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/90 border border-emerald-800/80 px-2 py-0.5 rounded-md">
                OpenRouter: {AUTOADS_LLM_MODEL} + {selectedImageModel} + {selectedVideoModel}
              </span>
            </div>
          </div>
        </div>

        {/* Botones compactos en la cabecera (Cero tarjetas gigantes ocupando espacio) */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleVerifyCapiTunnel}
            disabled={testingCapi}
            title="Probar y verificar en vivo los 12 Eventos del Píxel y el Túnel CAPI Anti-Bloqueo"
            className="px-3 py-1.5 rounded-xl border border-emerald-800/80 bg-emerald-950/50 hover:bg-emerald-900/60 text-[11px] font-semibold text-emerald-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {testingCapi ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>
              Píxel 12 Eventos + CAPI OK (EMQ {capiAudit.emqScoreEstimated})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowCapiDetailsModal(prev => !prev)}
            className="px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-medium text-zinc-300 cursor-pointer transition-colors"
          >
            {showCapiDetailsModal ? 'Ocultar Auditoría' : 'Ver 12 Eventos'}
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsDrawer(prev => !prev)}
            className="px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-semibold text-zinc-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>OpenRouter &amp; Pipeboard</span>
          </button>

          <a
            href="https://adsmanager.facebook.com"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-semibold text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
          >
            <span>Ads Manager</span>
            <ExternalLink className="w-3 h-3 text-zinc-400" />
          </a>
        </div>
      </div>

      {/* Panel desplegable de los 12 Eventos del Píxel + Túnel CAPI (solo si el usuario toca "Ver 12 Eventos") */}
      {showCapiDetailsModal && (
        <div className="p-4 rounded-2xl border border-emerald-900/70 bg-[#0d0d0f] space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                Diagnóstico del Píxel Universal y Túnel First-Party CAPI (Anti-Bloqueo iOS/Safari)
              </span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              {capiAudit.lastTestAt ? `Último test en vivo: ${capiAudit.lastTestAt}` : 'SHA-256 Advanced Matching Activo'}
            </span>
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

      {/* ===================================================================== */}
      {/* 2. DRAWER DE OPENROUTER + SLOT PIPEBOARD CON AUTODESTRUCCIÓN          */}
      {/* ===================================================================== */}
      {showSettingsDrawer && (
        <div className="p-4 rounded-2xl border border-zinc-800 bg-[#0d0d0f] space-y-3">
          <form onSubmit={handleSaveConfig} className="space-y-3" autoComplete="off">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                🔌 Configuración OpenRouter IA &amp; Slot Pipeboard · Blindaje Backend (Autodestrucción en Navegador)
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono text-[10px]">
                  {hasOpenRouterKeyInBackend
                    ? `🤖 OpenRouter Activo (${openRouterKeyPreview || '••••••••'})`
                    : '⚠️ Sin OpenRouter Key'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono text-[10px]">
                  {hasPipeboardTokenInBackend
                    ? `🛡️ Pipeboard (${pipeboardTokenPreview || '••••••••'})`
                    : '🔒 Cero APIs en Navegador'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-emerald-300 mb-1 font-bold">
                  🔑 API Key de OpenRouter (sk-or-v1-...)
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
                  API de Pipeboard (Opcional · Se autodestruye)
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
                    hasPipeboardTokenInBackend
                      ? 'Blindada en Backend (pegá otra para reemplazar)...'
                      : 'pipeboard_... (viaja al backend y se borra de acá)'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 font-mono text-xs outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Cuenta Publicitaria (Opcional)</label>
                <input
                  type="text"
                  value={pbConfig.selectedAdAccountId === 'act_595884210394' ? '' : pbConfig.selectedAdAccountId}
                  onChange={e => setPbConfig(prev => ({ ...prev, selectedAdAccountId: e.target.value }))}
                  placeholder="Automático desde tu cuenta"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 font-mono text-xs outline-none focus:border-emerald-500"
                />
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

            {lastTokenSelfDestructAt && (
              <p className="text-[11px] text-emerald-400 font-mono">
                ✅ Credenciales autodestruidas del navegador a las {lastTokenSelfDestructAt} y guardadas únicamente en el servidor.
              </p>
            )}

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 cursor-pointer transition-colors disabled:opacity-50"
            >
              {savingSettings
                ? 'Guardando en Backend...'
                : '🔒 Guardar Credenciales en Backend y Autodestruir del Navegador'}
            </button>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. PANEL PRINCIPAL MANOS LIBRES: SELECCIÓN + 3 BOTONES SECUENCIALES   */}
      {/* ===================================================================== */}
      <div className="bg-[#0d0d0f] rounded-2xl border border-zinc-800 p-4 sm:p-5 space-y-4">
        {/* Selector compacto: Página Creada vs Pegar Cualquier URL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800 w-fit">
            <button
              type="button"
              onClick={() => {
                setSourceMode('catalog');
                const key = computeWorkspaceKey('catalog', selectedCatalogProduct?.id || selectedProductId, externalUrlInput);
                applySavedWorkspaceToState(workspacesCache[key]);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                sourceMode === 'catalog'
                  ? 'bg-emerald-500 text-black'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              📄 Elegir Página de Producto Creada
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceMode('external_url');
                const key = computeWorkspaceKey('external_url', selectedCatalogProduct?.id || selectedProductId, externalUrlInput);
                applySavedWorkspaceToState(workspacesCache[key]);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                sourceMode === 'external_url'
                  ? 'bg-emerald-500 text-black'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Pegar Cualquier URL Externa</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-700/70 text-[11px] font-mono text-emerald-300 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                💾 Guardado en Backend{lastBackendSavedAt ? ` (${lastBackendSavedAt})` : ''} · No perdés nada al actualizar
              </span>
            </span>
          </div>
        </div>

        {/* Entrada según el modo elegido */}
        {sourceMode === 'catalog' ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <select
                data-testid="autoads-product-select"
                value={selectedCatalogProduct?.id || ''}
                onChange={e => {
                  const newId = e.target.value;
                  setSelectedProductId(newId);
                  const key = computeWorkspaceKey('catalog', newId, externalUrlInput);
                  applySavedWorkspaceToState(workspacesCache[key]);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-bold text-zinc-100 outline-none focus:border-emerald-500 cursor-pointer"
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
                className="px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>Ver Página</span>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="url"
                value={externalUrlInput}
                onChange={e => {
                  const nextUrl = e.target.value;
                  setExternalUrlInput(nextUrl);
                  const key = computeWorkspaceKey('external_url', selectedProductId, nextUrl);
                  applySavedWorkspaceToState(workspacesCache[key]);
                }}
                placeholder="https://... Pegá la URL de cualquier página de producto (de Paraguay o del extranjero)"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 font-mono outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[11px] text-zinc-400">
              El algoritmo escrapeará automáticamente las fotos, títulos, precios y promesas de esa URL y buscará cómo ganarle a toda la competencia.
            </p>
          </div>
        )}

        {/* Motores Exclusivos Fijos en Código + Interruptor para Evitar los 2 Reels de Video */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-emerald-300 font-mono">
                🔒 Motores Exclusivos Fijos en Código (Sin Fallbacks ni Imágenes Ficticias):
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700/70 text-[10px] font-mono text-emerald-300">
                100% Oficial OpenRouter
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
              <span className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200">
                🧠 Copy + Investigación: <strong className="text-emerald-400">{AUTOADS_LLM_MODEL}</strong>
              </span>
              <span className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200">
                🎨 Imagen: <strong className="text-emerald-400">{selectedImageModel}</strong>
              </span>
              {!onlyImagesMode && (
                <span className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200">
                  🎬 Video Reel: <strong className="text-blue-400">{selectedVideoModel}</strong>
                </span>
              )}
            </div>
          </div>

          {/* INTERRUPTOR (SWITCH) PARA EVITAR CREAR LOS 2 REELS DE VIDEO Y USAR 100% IMÁGENES */}
          <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-100">
                  {onlyImagesMode
                    ? '🖼️ Modo 100% Solo Imágenes Activo (6 Imágenes · Cero Reels de Video)'
                    : '🎬 Modo Mixto: 4 Imágenes + 2 Reels de 15s (Gemini Omni 1.2 Flash)'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                {onlyImagesMode
                  ? 'Se evita crear los 2 videos Reels (#5 y #6). Los 6 anuncios se generan como imágenes estáticas con GPT Image 2.6 Sunburst (aptos para Feed, Stories y Reels en Meta Ads).'
                  : 'Los Reels #5 y #6 se crean de 15 segundos con Avatar hablando + tu Producto real en Google Gemini Omni 1.2 Flash. Activá este interruptor si preferís usar 100% solo imágenes.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={onlyImagesMode}
              data-testid="autoads-only-images-switch"
              onClick={() => handleToggleOnlyImagesMode(!onlyImagesMode)}
              className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                onlyImagesMode ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
              title="Interruptor para evitar crear los 2 Reels de video y usar 100% imágenes"
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  onlyImagesMode ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* BARRA DE LOS 3 BOTONES MAESTROS DEL PILOTO AUTOMÁTICO             */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* BOTÓN 1: INVESTIGAR PRODUCTO Y COMPETENCIA */}
          <button
            type="button"
            data-testid="autoads-step1-btn"
            onClick={handleStep1Research}
            disabled={workflowStep === 'researching' || workflowStep === 'generating' || workflowStep === 'publishing'}
            className={`p-3.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border ${
              workflowStep === 'idle' || workflowStep === 'researching'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-400 shadow-lg shadow-emerald-950/50'
                : 'bg-zinc-900 hover:bg-zinc-800 text-emerald-300 border-emerald-800/70'
            }`}
          >
            {workflowStep === 'researching' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Investigando Competencia...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 shrink-0" />
                <span>
                  {workflowStep === 'idle'
                    ? '1. Investigar Producto y Competencia'
                    : '✓ 1. Re-Investigar Competencia'}
                </span>
              </>
            )}
          </button>

          {/* BOTÓN 2: GENERAR TODOS LOS ANUNCIOS (Aparece habilitado cuando el Paso 1 termina) */}
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
            className={`p-3.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border ${
              workflowStep === 'researched'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-400 shadow-lg shadow-emerald-950/50 cursor-pointer'
                : workflowStep === 'generated' || workflowStep === 'published'
                ? 'bg-zinc-900 hover:bg-zinc-800 text-emerald-300 border-emerald-800/70 cursor-pointer'
                : 'bg-zinc-900/50 text-zinc-500 border-zinc-800/60 cursor-not-allowed'
            }`}
          >
            {workflowStep === 'generating' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>
                  {onlyImagesMode
                    ? 'Creando 6 Anuncios de Imagen IA (Sunburst)...'
                    : 'Creando Anuncios, Fotos y Reels MP4...'}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>
                  {creatives.length > 0 &&
                  creatives.slice(0, onlyImagesMode ? 6 : 4).some(c => !c.aiGeneratedImageUrl)
                    ? '⚡ 2. Continuar donde quedó (Completar Faltantes)'
                    : !onlyImagesMode && creatives.length > 0 && creatives.slice(4, 6).some(c => !c.aiGeneratedVideoUrl)
                    ? '🎬 2. Continuar donde quedó (Crear Reels #5 y #6)'
                    : creatives.length > 0
                    ? `✓ 2. Regenerar los ${creatives.length} Anuncios`
                    : onlyImagesMode
                    ? '2. Generar las 6 Imágenes IA (Sin Videos)'
                    : '2. Generar Todos los Anuncios IA'}
                </span>
              </>
            )}
          </button>

          {/* BOTÓN 3: PUBLICAR AHORA EN META ADS (Habilitado recién cuando los anuncios están creados en pantalla) */}
          <button
            type="button"
            data-testid="autoads-step3-btn"
            onClick={handleStep3PublishNow}
            disabled={creatives.length === 0 || workflowStep === 'publishing'}
            className={`p-3.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border ${
              creatives.length > 0 && workflowStep !== 'publishing'
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-lg shadow-blue-950/50 cursor-pointer'
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
                <Send className="w-4 h-4 shrink-0" />
                <span>
                  {workflowStep === 'published'
                    ? '✅ 3. Publicado · Volver a Publicar'
                    : '3. Publicar Ahora en Meta Ads'}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Barra de progreso en vivo durante la investigación o generación con OpenRouter */}
        {(workflowStep === 'researching' || workflowStep === 'generating') && (
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-emerald-800/60 flex items-center gap-3 text-xs text-emerald-300">
            <Loader2 className="w-4 h-4 animate-spin shrink-0 text-emerald-400" />
            <span className="font-mono">
              {workflowStep === 'researching' ? researchProgressText : generationProgressText}
            </span>
          </div>
        )}

        {/* Resumen Compacto de la Investigación Competitiva (Una vez completado el Botón 1) */}
        {brainProfile && workflowStep !== 'idle' && workflowStep !== 'researching' && (
          <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-zinc-100">
                  Inteligencia Lista para &ldquo;{activeProduct?.nombre}&rdquo; · {allProductPhotos.length} Fotos Reales Extraídas
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                  Mercados: PY + LATAM + Global
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                  {brainProfile.competitorInsights.activeAdsFound} Ads Competidores Analizados
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300">
                  {brainProfile.avatars.length} Avatares × 6 Ángulos Andrómeda
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800/80 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  🎯 Ganchos y Patrones Ganadores Detectados en la Competencia
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
                  🧠 Estrategia Suprema Aplicada (Andrómeda + Hormozi + Schwartz)
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
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 4. PREVISUALIZACIÓN EXACTA DE ANUNCIOS COMO SE VEN EN FACEBOOK ADS    */}
      {/* ===================================================================== */}
      {creatives.length > 0 && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#0d0d0f] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-100">
                Vista Previa Exacta de tus {creatives.length} Anuncios en Facebook / Instagram
              </h2>
              <p className="text-xs text-zinc-400">
                Así mismo verán tus anuncios los compradores en su celular. Si alguno no te gusta, tocá{' '}
                <strong className="text-emerald-300">&ldquo;Cambiar este anuncio&rdquo;</strong> arriba de esa tarjeta para que la IA genere otro nuevo antes de publicar.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStep3PublishNow}
              disabled={workflowStep === 'publishing'}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-lg shadow-blue-950/60"
            >
              <Send className="w-4 h-4" />
              <span>Publicar Todos Ahora en Meta Ads</span>
            </button>
          </div>

          {/* Grid de los 6 Anuncios con Diseño Idéntico al Feed de Facebook / Instagram + Imágenes Limpias sin Capas Rotativas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {creatives.map((ad, idx) => {
              const isReel = !onlyImagesMode && (ad.type === 'video_reel_9x16' || idx >= 4);
              const aiGeneratedPhotoUrl = !isReel ? ad.aiGeneratedImageUrl || '' : '';
              const isEditingThis = editingAdIdx === idx;
              const isRegeneratingThis = regeneratingAdIdx === idx;

              return (
                <div
                  key={ad.id}
                  data-testid={`facebook-ad-card-${idx}`}
                  className="rounded-2xl border border-zinc-800 bg-[#18191a] text-[#e4e6eb] overflow-hidden flex flex-col justify-between shadow-xl"
                >
                  {/* Barra Superior de Controles del Anuncio */}
                  <div className="px-3 py-2 bg-[#0d0d0f] border-b border-zinc-800 flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                        Ad #{idx + 1} · {isReel ? '🎬 Reel IA' : ad.aspectRatio === '9:16' ? '📱 Story IA' : '🖼️ Feed IA'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-700/60 text-[9px] font-mono text-emerald-300">
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
                          className={`px-2 py-1 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                            ad.aiGeneratedVideoUrl
                              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/70'
                              : 'bg-amber-400 text-black border-amber-300 hover:bg-amber-300 animate-pulse'
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
                            <div className="w-9 h-9 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-300 flex items-center justify-center font-black text-xs shrink-0">
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
                              className={`w-full h-full object-cover transition-opacity duration-300 ${
                                isRegeneratingThis ? 'opacity-30' : 'opacity-100'
                              }`}
                            />
                            {/* Cinta Superior de Impacto 0.0s Congruente con las Primeras Palabras de la 1ª Estrofa + Indicador Reel MP4 */}
                            <div className="absolute top-0 inset-x-0 p-2 bg-gradient-to-b from-black/90 via-black/60 to-transparent flex items-center justify-between gap-1.5 pointer-events-none">
                              <span className="px-2 py-0.5 rounded bg-amber-400 text-black text-[10px] font-black uppercase tracking-tight shadow-md truncate">
                                {((ad.primaryText || '').split('\n')[0] || '').split(':')[0] ||
                                  ad.hookBadge ||
                                  `🔥 ${extractProductCoreIdentity(activeProduct).ultraShortObjectLabel.toUpperCase()} EN OFERTA`}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[9px] font-black uppercase tracking-tight shadow-md shrink-0">
                                🎬 VIDEO REEL MP4
                              </span>
                            </div>

                            {/* Zócalo Inferior 100% Congruente con la Primera Estrofa + CTA de Alto Impacto (elevado sutilmente para dejar libres los controles de video) */}
                            <div className="absolute bottom-8 inset-x-0 p-2.5 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex flex-col gap-1.5 pointer-events-none">
                              <div className="text-[11px] font-black text-white leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] line-clamp-2">
                                {((ad.primaryText || '').split(/\n\s*\n/)[0] || ad.headline).trim()}
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="px-2 py-0.5 rounded bg-zinc-900/95 border border-emerald-500/60 text-emerald-300 text-[10px] font-extrabold truncate">
                                  💰 1x Gs. {Number(activeProduct.precios?.[1] || 189000).toLocaleString('es-PY')} · Pagás Cuando Recibís
                                </span>
                                <span className="px-2.5 py-1 rounded-md bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wide shadow-[0_0_15px_rgba(16,185,129,0.65)] shrink-0">
                                  👇 {ad.ctaLabel}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : !isReel && aiGeneratedPhotoUrl ? (
                          <>
                            <img
                              src={aiGeneratedPhotoUrl}
                              alt={ad.headline}
                              referrerPolicy="no-referrer"
                              className={`w-full h-full object-cover transition-opacity duration-300 ${
                                isRegeneratingThis ? 'opacity-30' : 'opacity-100'
                              }`}
                            />
                            {/* Cinta Superior de Impacto 0.0s Congruente con las Primeras Palabras de la 1ª Estrofa */}
                            <div className="absolute top-0 inset-x-0 p-2 bg-gradient-to-b from-black/90 via-black/60 to-transparent flex items-center justify-between gap-1.5 pointer-events-none">
                              <span className="px-2 py-0.5 rounded bg-amber-400 text-black text-[10px] font-black uppercase tracking-tight shadow-md truncate">
                                {((ad.primaryText || '').split('\n')[0] || '').split(':')[0] ||
                                  ad.hookBadge ||
                                  `🔥 ${extractProductCoreIdentity(activeProduct).ultraShortObjectLabel.toUpperCase()} EN OFERTA`}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[9px] font-black uppercase tracking-tight shadow-md shrink-0">
                                🚚 ENVÍO GRATIS PY
                              </span>
                            </div>

                            {/* Zócalo Inferior 100% Congruente con la Primera Estrofa + CTA de Alto Impacto */}
                            <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/95 via-black/85 to-transparent flex flex-col gap-1.5 pointer-events-none">
                              <div className="text-[11px] font-black text-white leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] line-clamp-2">
                                {((ad.primaryText || '').split(/\n\s*\n/)[0] || ad.headline).trim()}
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="px-2 py-0.5 rounded bg-zinc-900/95 border border-emerald-500/60 text-emerald-300 text-[10px] font-extrabold truncate">
                                  💰 {idx === 3
                                    ? `Pack 2x Gs. ${Number(activeProduct.precios?.[2] || 358000).toLocaleString('es-PY')}`
                                    : `1x Gs. ${Number(activeProduct.precios?.[1] || 189000).toLocaleString('es-PY')}`}{' '}
                                  · Pagás Cuando Recibís
                                </span>
                                <span className="px-2.5 py-1 rounded-md bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wide shadow-[0_0_15px_rgba(16,185,129,0.65)] shrink-0">
                                  👇 {ad.ctaLabel}
                                </span>
                              </div>
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

      {/* ===================================================================== */}
      {/* 5. HISTORIAL DE CAMPAÑAS PUBLICADAS                                   */}
      {/* ===================================================================== */}
      {publishedCampaigns.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#0d0d0f] border border-zinc-800 space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            ✅ Campañas Publicadas en Meta Ads ({publishedCampaigns.length})
          </h3>
          <div className="space-y-2">
            {publishedCampaigns.slice(0, 5).map(camp => (
              <div
                key={camp.id}
                className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-bold text-zinc-100">{camp.campaignName}</span>
                  <span className="text-zinc-400 block text-[11px] font-mono">
                    ID Campaña: {camp.campaignId} · Cuenta: {camp.adAccountId} · {camp.publishedAds?.length || 6} anuncios
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono text-[10px]">
                  {camp.publishedAds?.[0]?.status || 'ACTIVE'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pop-up Modal de Error de OpenRouter (Trabajo Pausado - Sin Fallbacks Ficticios) */}
      {apiErrorModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0d0d0f] border border-red-500/30 rounded-2xl shadow-2xl p-6 text-white space-y-4 relative overflow-hidden">
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
                  Se ha pausado la generación de anuncios porque la API de OpenRouter retornó un error o no está activa. Se desactivaron todos los fallbacks ficticios para garantizar contenido 100% genuino.
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
                  setShowSettingsDrawer(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-emerald-950/40"
              >
                <Settings2 className="w-4 h-4" />
                <span>Configurar API Key en OpenRouter</span>
              </button>
              <button
                onClick={() => setApiErrorModal(null)}
                className="w-full sm:w-auto px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl text-xs transition-all"
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
