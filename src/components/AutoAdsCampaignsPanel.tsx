import React, { useEffect, useState } from 'react';
import {
  Megaphone,
  Layers,
  ExternalLink,
  ArrowLeft,
  RefreshCw,
  Loader2,
  RotateCw,
  Send,
  CheckCircle2,
  Sparkles,
  Cloud,
  Target,
  FolderOpen,
  Image as ImageIcon,
  X,
  Plus
} from 'lucide-react';
import {
  GeneratedAdCreativeAsset,
  PipeboardPublishedCampaignRecord
} from '../utils/autoAdsBrainEngine';
import type { ProductPage } from '../types';
import { formatGs } from '../config';
import type { CloudinaryMediaClient } from './AutoAdsCloudinaryPanel';
import { filterGenuineTripwirePages } from '../utils/autoAdsSlotPlanner';

export interface CampaignAdReplaceResultInfo {
  oldAdId?: string;
  deletedFromMeta: boolean;
  newAdId: string;
  newCreativeId: string;
  replacedAt: string;
}

export interface CampaignHookOverrideInput {
  entryProductName?: string;
  entryProductDescription?: string;
  entryPriceGs?: number;
  entryImageUrl?: string;
  targetProductId?: string;
  targetProductSlug?: string;
  targetProductName?: string;
  targetLandingUrl?: string;
}

interface AutoAdsCampaignsPanelProps {
  campaigns: PipeboardPublishedCampaignRecord[];
  productPages: ProductPage[];
  selectedCampaign: PipeboardPublishedCampaignRecord | null;
  onSelectCampaign: (camp: PipeboardPublishedCampaignRecord | null) => void;
  onBackToInicio?: () => void;
  onGoToCreateCampaign: () => void;
  onOpenTripwirePageCreator?: () => void;
  onSyncLiveCampaigns: () => void;
  syncingCampaigns: boolean;
  cloudinaryResources: CloudinaryMediaClient[];
  workspacesCache: Record<string, any>;
  pendingDraftsByKey: Record<string, GeneratedAdCreativeAsset>;
  regeneratingAdKey: string | null;
  replacingAdKey: string | null;
  replacedInfoByKey: Record<string, CampaignAdReplaceResultInfo>;
  defaultHookInfo?: CampaignHookOverrideInput;
  onRegenerateCampaignAd: (
    camp: PipeboardPublishedCampaignRecord,
    adIdx: number,
    existingAd: any,
    injectMode?: 'standard' | 'entry_hook',
    hookOverride?: CampaignHookOverrideInput
  ) => void;
  onDiscardDraft: (adKey: string) => void;
  onLaunchReplaceAd: (
    camp: PipeboardPublishedCampaignRecord,
    adIdx: number,
    existingAd: any,
    draftCreative: GeneratedAdCreativeAsset,
    options?: { appendNew?: boolean }
  ) => void;
  onLoadCampaignInCreator: (camp: PipeboardPublishedCampaignRecord) => void;
}

export function buildCampaignAdKey(campaignId: string, adIdx: number, adId?: string): string {
  return `${campaignId || 'camp'}::${adIdx}::${adId || 'slot'}`;
}

export function resolveCampaignAdImageCandidates(
  camp: PipeboardPublishedCampaignRecord,
  ad: any,
  adIdx: number,
  workspacesCache: Record<string, any>,
  cloudinaryResources: CloudinaryMediaClient[],
  draft?: GeneratedAdCreativeAsset
): string[] {
  const candidates: string[] = [];
  const push = (val: unknown) => {
    const clean = String(val || '').trim();
    if (clean && !clean.startsWith('data:image/svg') && !candidates.includes(clean)) {
      candidates.push(clean);
    }
  };

  push(draft?.aiGeneratedImageUrl);
  push(draft?.aiGeneratedImageDataUrl);
  push(ad?.imageUrl);

  // Fallback 1: imagen guardada en workspace de ese producto / landing
  const ws =
    workspacesCache[camp.productId] ||
    workspacesCache[`ext_${camp.landingUrl}`] ||
    Object.values(workspacesCache || {}).find(
      (w: any) =>
        (camp.productId && w?.productId === camp.productId) ||
        (camp.productSlug && w?.scrapedExternalProduct?.slug === camp.productSlug)
    );
  const wsAd = Array.isArray(ws?.creatives) ? ws.creatives[adIdx] : null;
  push(wsAd?.aiGeneratedImageUrl);
  push(wsAd?.aiGeneratedImageDataUrl);

  // Fallback 2: recurso en Cloudinary por tag (ad_1..ad_6 + slug)
  const slugTag = String(camp.productSlug || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_');
  const adTag = `ad_${adIdx + 1}`;
  for (const r of cloudinaryResources) {
    if (
      r.tags.includes(adTag) &&
      (!slugTag || r.tags.some(t => t.includes(slugTag)) || r.publicId.includes(slugTag))
    ) {
      push(r.secureUrl);
    }
  }

  return candidates;
}

export const AutoAdsCampaignsPanel: React.FC<AutoAdsCampaignsPanelProps> = ({
  campaigns,
  productPages,
  selectedCampaign,
  onSelectCampaign,
  onBackToInicio,
  onGoToCreateCampaign,
  onOpenTripwirePageCreator,
  onSyncLiveCampaigns,
  syncingCampaigns,
  cloudinaryResources,
  workspacesCache,
  pendingDraftsByKey,
  regeneratingAdKey,
  replacingAdKey,
  replacedInfoByKey,
  defaultHookInfo: _defaultHookInfo,
  onRegenerateCampaignAd,
  onDiscardDraft,
  onLaunchReplaceAd,
  onLoadCampaignInCreator
}) => {
  const [campaignSubTab, setCampaignSubTab] = useState<'anuncios' | 'grupo' | 'campana'>('anuncios');
  const [listFilterTab, setListFilterTab] = useState<'todas' | 'activas'>('todas');
  const [failedUrls, setFailedUrls] = useState<Record<string, true>>({});
  const [slotInjectModes, setSlotInjectModes] = useState<Record<string, 'standard' | 'entry_hook'>>({});
  const [slotTripwirePageIds, setSlotTripwirePageIds] = useState<Record<string, string>>({});
  const [showPlusMenuInPanel, setShowPlusMenuInPanel] = useState<boolean>(false);
  const [newAdInjectMode, setNewAdInjectMode] = useState<'standard' | 'entry_hook'>('entry_hook');

  const tripwirePages = filterGenuineTripwirePages(productPages);
  const [selectedTripwirePageId, setSelectedTripwirePageId] = useState<string>(
    tripwirePages[0]?.id || ''
  );
  const selectedTripwirePage =
    tripwirePages.find(p => p.id === selectedTripwirePageId) || tripwirePages[0] || null;

  const buildTripwireDestinationUrl = (page: ProductPage | null): string => {
    if (!page?.slug) return '';
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/?p=${page.slug}&modo=entrada`;
    }
    return `https://autoads360.up.railway.app/?p=${page.slug}&modo=entrada`;
  };

  const applyTripwirePageSelection = (pageId: string) => {
    setSelectedTripwirePageId(pageId);
  };

  useEffect(() => {
    setCampaignSubTab('anuncios');
  }, [selectedCampaign?.campaignId, selectedCampaign?.id]);

  const pickWorkingUrl = (candidates: string[]): string =>
    candidates.find(u => !failedUrls[u]) || '';

  const markUrlFailed = (url: string) => {
    if (!url) return;
    setFailedUrls(prev => (prev[url] ? prev : { ...prev, [url]: true }));
  };

  // ============================================================================
  // INTERFAZ PRIVADA DEDICADA DE UNA CAMPAÑA (SIN BARRA EXTERNA NI BARULLO)
  // ============================================================================
  if (selectedCampaign) {
    const actNum = String(selectedCampaign.adAccountId || '1048211497774834').replace(/^act_/, '');
    const adsList =
      Array.isArray(selectedCampaign.publishedAds) && selectedCampaign.publishedAds.length > 0
        ? selectedCampaign.publishedAds
        : [];
    const campStatus =
      (selectedCampaign as any).campaignStatus || adsList[0]?.status || 'ACTIVE';
    const isCampActive = campStatus === 'ACTIVE';
    const createdLabel = selectedCampaign.createdAt
      ? new Date(selectedCampaign.createdAt).toLocaleDateString('es-PY', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
      : 'En vivo';

    return (
      <div
        data-testid="autoads-single-campaign-view"
        className="rounded-2xl bg-[#090a0c] border border-emerald-500/30 shadow-2xl overflow-hidden"
      >
        {/* Cabecera Única Compacta de la Campaña + Pestañas Internas */}
        <div className="px-4 py-3 bg-[#0f1115] border-b border-zinc-800/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <button
              type="button"
              data-testid="autoads-back-to-campaigns"
              onClick={() => onSelectCampaign(null)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/90 text-xs font-semibold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Campañas</span>
            </button>

            <span className="h-4 w-px bg-zinc-800 hidden sm:inline-block" />

            <div className="flex items-center gap-2 min-w-0">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-mono text-[9px] font-bold uppercase tracking-wider shrink-0">
                Privado
              </span>
              <h2
                className="text-xs sm:text-sm font-bold text-white truncate max-w-[260px] sm:max-w-[380px]"
                title={selectedCampaign.campaignName}
              >
                {selectedCampaign.campaignName}
              </h2>
              <span
                className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border shrink-0 ${
                  isCampActive
                    ? 'bg-emerald-950/80 border-emerald-700/70 text-emerald-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                }`}
              >
                {isCampActive ? '● ACTIVA' : campStatus}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Pestañas Internas Dentro de la Campaña */}
            <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-800 inline-flex items-center gap-1">
              <button
                type="button"
                data-testid="campaign-subtab-anuncios"
                onClick={() => setCampaignSubTab('anuncios')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                  campaignSubTab === 'anuncios'
                    ? 'bg-emerald-500 text-black shadow-sm font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Anuncios ({adsList.length})</span>
              </button>

              <button
                type="button"
                data-testid="campaign-subtab-grupo"
                onClick={() => setCampaignSubTab('grupo')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                  campaignSubTab === 'grupo'
                    ? 'bg-sky-500 text-black shadow-sm font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Target className="w-3 h-3" />
                <span>Grupo de Anuncios</span>
              </button>

              <button
                type="button"
                data-testid="campaign-subtab-campana"
                onClick={() => setCampaignSubTab('campana')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                  campaignSubTab === 'campana'
                    ? 'bg-zinc-200 text-black shadow-sm font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Megaphone className="w-3 h-3" />
                <span>Campaña</span>
              </button>
            </div>

            <a
              href={
                selectedCampaign.adsManagerUrl ||
                `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actNum}`
              }
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-semibold text-emerald-300 inline-flex items-center gap-1 shrink-0"
            >
              <span>Ads Manager</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Contenido Exclusivo según la Pestaña Interna Activa */}
        <div className="p-4 sm:p-5">
          {/* PESTAÑA 1: ANUNCIOS (VISTA DIRECTA + INYECCIÓN EN EL CONJUNTO) */}
          {campaignSubTab === 'anuncios' && (() => {
            const nextInjectSlot = adsList.length;
            const appendAdKey = buildCampaignAdKey(selectedCampaign.campaignId, nextInjectSlot, 'new_inject');
            const appendDraft = pendingDraftsByKey[appendAdKey];
            const isRegeneratingAppend = regeneratingAdKey === appendAdKey;
            const isReplacingAppend = replacingAdKey === appendAdKey;
            const resolvedAppendTargetUrl = buildTripwireDestinationUrl(selectedTripwirePage);
            const currentHookOverride: CampaignHookOverrideInput | undefined = selectedTripwirePage
              ? {
                  entryProductName: selectedTripwirePage.tripwireConfig?.entryProductName || '',
                  entryProductDescription:
                    selectedTripwirePage.tripwireConfig?.entryProductDescription || '',
                  entryPriceGs: Number(selectedTripwirePage.tripwireConfig?.entryPriceGs || 0),
                  entryImageUrl:
                    selectedTripwirePage.tripwireConfig?.entryImageUrl ||
                    selectedTripwirePage.tripwireConfig?.entryProductImage ||
                    '',
                  targetProductId: selectedTripwirePage.id,
                  targetProductSlug: selectedTripwirePage.slug,
                  targetProductName: selectedTripwirePage.nombre,
                  targetLandingUrl: resolvedAppendTargetUrl
                }
              : undefined;

            return (
            <div className="space-y-4">
              {/* Botón "+" Ilimitado para Inyectar Nuevo Anuncio (Crear Anuncio o Crear Anuncio Tripwire) sin borrar los existentes */}
              <div className="p-3.5 rounded-xl bg-[#11141a] border border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-white">
                      Grupo de Anuncios Activo ({adsList.length} anuncios) · Agregá sin límite
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Tocá <strong className="text-emerald-300">+</strong> para sumar la cantidad que quieras (Crear Anuncio normal o Crear Anuncio Tripwire) sin reemplazar los actuales.
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="campaign-plus-add-ad-btn"
                    onClick={() => setShowPlusMenuInPanel(v => !v)}
                    className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Sumar Anuncio #{nextInjectSlot + 1}</span>
                  </button>
                </div>

                {showPlusMenuInPanel && (
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                    {/* Selector Explícito de Página Tripwire Destino ANTES de generar o lanzar */}
                    <div className="p-3 rounded-xl bg-[#0d1016] border border-amber-500/40 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide">
                          1. Elegí la Página Tripwire de Destino (para Anuncio Tripwire)
                        </span>
                        {onOpenTripwirePageCreator && (
                          <button
                            type="button"
                            onClick={onOpenTripwirePageCreator}
                            className="px-2.5 py-1 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/50 text-[11px] font-bold text-amber-300 cursor-pointer"
                          >
                            + Crear Página Tripwire
                          </button>
                        )}
                      </div>

                      {tripwirePages.length > 0 ? (
                        <div className="space-y-2">
                          <select
                            data-testid="campaign-tripwire-page-select"
                            value={selectedTripwirePage?.id || ''}
                            onChange={e => applyTripwirePageSelection(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-amber-500/50 text-xs font-semibold text-white outline-none focus:border-amber-400 cursor-pointer"
                          >
                            {tripwirePages.map(tp => (
                              <option key={tp.id} value={tp.id} className="bg-zinc-900 text-white">
                                {tp.nombre} — Gancho: {tp.tripwireConfig?.entryProductName} ({formatGs(tp.tripwireConfig?.entryPriceGs || 20000)}) → /?p={tp.slug}&modo=entrada
                              </option>
                            ))}
                          </select>

                          <div className="px-3 py-2 rounded-lg bg-emerald-950/50 border border-emerald-600/50 text-[11px] space-y-0.5">
                            <div className="text-emerald-200 font-semibold">
                              ✅ Página Tripwire seleccionada: <span className="text-white">{selectedTripwirePage?.nombre}</span>
                            </div>
                            <div className="font-mono text-amber-300 break-all">
                              🔗 URL Meta Ads al dar clic: {resolvedAppendTargetUrl}
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              Los anuncios estándar de esta campaña siguen yendo a: <span className="font-mono text-zinc-300">{selectedCampaign.landingUrl}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-200 space-y-1">
                          <div>
                            Todavía no creaste ninguna Página Tripwire en el Creador Rápido. Creala primero para seleccionarla acá y redirigir el anuncio Tripwire a su propia página.
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        data-testid="campaign-create-standard-ad-btn"
                        disabled={isRegeneratingAppend || isReplacingAppend}
                        onClick={() => {
                          setNewAdInjectMode('standard');
                          onRegenerateCampaignAd(
                            selectedCampaign,
                            nextInjectSlot,
                            { adId: 'new_inject' },
                            'standard'
                          );
                        }}
                        className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isRegeneratingAppend && newAdInjectMode === 'standard' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>Crear Anuncio (Estándar Principal)</span>
                      </button>

                      <button
                        type="button"
                        data-testid="campaign-inject-new-ad-btn"
                        disabled={isRegeneratingAppend || isReplacingAppend || !selectedTripwirePage}
                        onClick={() => {
                          if (!selectedTripwirePage || !currentHookOverride) return;
                          setNewAdInjectMode('entry_hook');
                          onRegenerateCampaignAd(
                            selectedCampaign,
                            nextInjectSlot,
                            { adId: 'new_inject' },
                            'entry_hook',
                            currentHookOverride
                          );
                        }}
                        className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isRegeneratingAppend && newAdInjectMode === 'entry_hook' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>Crear Anuncio Tripwire</span>
                      </button>
                    </div>
                  </div>
                )}

                {appendDraft && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 flex flex-col sm:flex-row items-center gap-3">
                    {appendDraft.aiGeneratedImageUrl && (
                      <img
                        src={appendDraft.aiGeneratedImageUrl}
                        alt={appendDraft.headline}
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 rounded-lg object-cover border border-zinc-800 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="text-xs font-bold text-amber-200 truncate">
                        Borrador Nuevo Anuncio #{nextInjectSlot + 1} listo · {appendDraft.headline}
                      </div>
                      <p className="text-[11px] text-zinc-300 line-clamp-2">{appendDraft.primaryText}</p>
                      <div className="text-[10px] font-mono text-emerald-300 break-all">
                        Destino al lanzar en Meta Ads:{' '}
                        <strong>
                          {appendDraft.targetLandingUrl ||
                            (appendDraft.isEntryHookAd ? resolvedAppendTargetUrl : selectedCampaign.landingUrl)}
                        </strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onDiscardDraft(appendAdKey)}
                        disabled={isReplacingAppend}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        data-testid="campaign-launch-inject-new-ad-btn"
                        onClick={() =>
                          onLaunchReplaceAd(
                            selectedCampaign,
                            nextInjectSlot,
                            { adId: 'new_inject' },
                            appendDraft,
                            { appendNew: true }
                          )
                        }
                        disabled={isReplacingAppend}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        {isReplacingAppend ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isReplacingAppend ? 'Publicando en Meta...' : 'Lanzar Nuevo Ad en este Grupo'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {adsList.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-zinc-800 text-center text-xs text-zinc-400">
                  No se registraron anuncios individuales en esta campaña.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {adsList.map((ad: any, idx: number) => {
                    const slotIdx = typeof ad.adIndex === 'number' ? ad.adIndex : idx;
                    const adKey = buildCampaignAdKey(selectedCampaign.campaignId, slotIdx, ad.adId);
                    const draft = pendingDraftsByKey[adKey];
                    const isRegenerating = regeneratingAdKey === adKey;
                    const isReplacing = replacingAdKey === adKey;
                    const replaceResult = replacedInfoByKey[adKey];
                    const selectedSlotMode: 'standard' | 'entry_hook' =
                      slotInjectModes[adKey] || (ad.isEntryHookAd ? 'entry_hook' : 'standard');
                    const slotChosenTripwirePage =
                      tripwirePages.find(
                        p => p.id === (slotTripwirePageIds[adKey] || selectedTripwirePage?.id || '')
                      ) || selectedTripwirePage;
                    const slotTargetUrlPreview =
                      selectedSlotMode === 'entry_hook'
                        ? buildTripwireDestinationUrl(slotChosenTripwirePage)
                        : selectedCampaign.landingUrl;
                    const slotHookOverride: CampaignHookOverrideInput | undefined =
                      selectedSlotMode === 'entry_hook' && slotChosenTripwirePage
                        ? {
                            entryProductName:
                              slotChosenTripwirePage.tripwireConfig?.entryProductName || '',
                            entryProductDescription:
                              slotChosenTripwirePage.tripwireConfig?.entryProductDescription || '',
                            entryPriceGs: Number(
                              slotChosenTripwirePage.tripwireConfig?.entryPriceGs || 0
                            ),
                            entryImageUrl:
                              slotChosenTripwirePage.tripwireConfig?.entryImageUrl ||
                              slotChosenTripwirePage.tripwireConfig?.entryProductImage ||
                              '',
                            targetProductId: slotChosenTripwirePage.id,
                            targetProductSlug: slotChosenTripwirePage.slug,
                            targetProductName: slotChosenTripwirePage.nombre,
                            targetLandingUrl: slotTargetUrlPreview
                          }
                        : undefined;

                    const imgCandidates = resolveCampaignAdImageCandidates(
                      selectedCampaign,
                      ad,
                      slotIdx,
                      workspacesCache,
                      cloudinaryResources,
                      draft
                    );
                    const displayImgUrl = pickWorkingUrl(imgCandidates);
                    const isCloudinary = displayImgUrl.includes('res.cloudinary.com');
                    const displayHeadline = draft?.headline || ad.headline || selectedCampaign.productName;
                    const displayPrimaryText = draft?.primaryText || ad.primaryText || '';
                    const displayCta = draft?.ctaLabel || ad.ctaLabel || 'Pedir ahora';

                    return (
                      <div
                        key={adKey}
                        data-testid={`campaign-ad-card-${slotIdx}`}
                        className={`rounded-xl border overflow-hidden flex flex-col justify-between bg-[#131519] transition-all ${
                          draft
                            ? 'border-amber-400/80 ring-1 ring-amber-400/30'
                            : replaceResult
                              ? 'border-emerald-500/70'
                              : 'border-zinc-800/90'
                        }`}
                      >
                        {/* Header compacto del anuncio */}
                        <div className="px-3 py-2.5 bg-[#0f1115] border-b border-zinc-800 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold text-emerald-400 font-mono">
                                Anuncio #{slotIdx + 1}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  ad.status === 'ACTIVE'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                                    : 'bg-zinc-800 text-zinc-300'
                                }`}
                              >
                                {ad.status || 'ACTIVE'}
                              </span>
                              {isCloudinary && (
                                <span className="px-1.5 py-0.5 rounded bg-sky-950/70 border border-sky-700/60 text-sky-300 text-[9px] font-semibold inline-flex items-center gap-0.5">
                                  <Cloud className="w-2.5 h-2.5" />
                                  <span>Cloudinary</span>
                                </span>
                              )}
                              {ad.adId && (
                                <span
                                  className="text-[10px] font-mono text-zinc-500"
                                  title={`Ad ID: ${ad.adId}`}
                                >
                                  ••{String(ad.adId).slice(-5)}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              data-testid={`campaign-regenerate-ad-btn-${slotIdx}`}
                              onClick={() =>
                                onRegenerateCampaignAd(
                                  selectedCampaign,
                                  slotIdx,
                                  ad,
                                  selectedSlotMode,
                                  slotHookOverride
                                )
                              }
                              disabled={isRegenerating || isReplacing}
                              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                            >
                              <RotateCw className={`w-3 h-3 text-emerald-400 ${isRegenerating ? 'animate-spin' : ''}`} />
                              <span>{isRegenerating ? 'Regenerando...' : 'Regenerar'}</span>
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <span className="text-zinc-400">Modo:</span>
                            <div className="inline-flex rounded-md bg-zinc-950 border border-zinc-800 p-0.5">
                              <button
                                type="button"
                                onClick={() => setSlotInjectModes(prev => ({ ...prev, [adKey]: 'standard' }))}
                                className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                                  selectedSlotMode === 'standard'
                                    ? 'bg-zinc-200 text-black'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                              >
                                Estándar
                              </button>
                              <button
                                type="button"
                                onClick={() => setSlotInjectModes(prev => ({ ...prev, [adKey]: 'entry_hook' }))}
                                className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                                  selectedSlotMode === 'entry_hook'
                                    ? 'bg-amber-400 text-black'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                              >
                                Tripwire
                              </button>
                            </div>
                          </div>

                          {selectedSlotMode === 'entry_hook' && (
                            <div className="space-y-1">
                              {tripwirePages.length > 0 ? (
                                <select
                                  value={slotChosenTripwirePage?.id || ''}
                                  onChange={e =>
                                    setSlotTripwirePageIds(prev => ({
                                      ...prev,
                                      [adKey]: e.target.value
                                    }))
                                  }
                                  className="w-full px-2 py-1 rounded bg-zinc-950 border border-amber-500/40 text-[10px] text-amber-200 font-medium outline-none cursor-pointer"
                                >
                                  {tripwirePages.map(tp => (
                                    <option key={tp.id} value={tp.id} className="bg-zinc-900 text-white">
                                      Destino Tripwire: {tp.nombre} (/?p={tp.slug}&modo=entrada)
                                    </option>
                                  ))}
                                </select>
                              ) : onOpenTripwirePageCreator ? (
                                <button
                                  type="button"
                                  onClick={onOpenTripwirePageCreator}
                                  className="w-full py-1 rounded bg-amber-400/15 border border-amber-400/40 text-[10px] font-bold text-amber-300 cursor-pointer"
                                >
                                  + Crear Página Tripwire primero
                                </button>
                              ) : null}
                            </div>
                          )}

                          <div className="text-[10px] font-mono text-zinc-400 truncate" title={draft?.targetLandingUrl || ad.destinationUrl || slotTargetUrlPreview}>
                            Destino:{' '}
                            <span className={selectedSlotMode === 'entry_hook' ? 'text-amber-300' : 'text-emerald-300'}>
                              {draft?.targetLandingUrl || ad.destinationUrl || slotTargetUrlPreview}
                            </span>
                          </div>
                        </div>

                        {/* Imagen del anuncio con fallback automático si falla la URL */}
                        <div className="relative aspect-square bg-zinc-950 border-b border-zinc-800 flex items-center justify-center overflow-hidden">
                          {displayImgUrl ? (
                            <img
                              src={displayImgUrl}
                              alt={displayHeadline}
                              referrerPolicy="no-referrer"
                              onError={() => markUrlFailed(displayImgUrl)}
                              className={`w-full h-full object-cover transition-opacity ${
                                isRegenerating || isReplacing ? 'opacity-35' : 'opacity-100'
                              }`}
                            />
                          ) : (
                            <div className="p-5 text-center text-xs text-zinc-400 space-y-2.5">
                              <Megaphone className="w-7 h-7 mx-auto text-zinc-600" />
                              <p className="text-[11px] leading-relaxed text-zinc-400">
                                Sin imagen disponible en CDN. Presioná para generar nueva versión en Cloudinary.
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  onRegenerateCampaignAd(
                                    selectedCampaign,
                                    slotIdx,
                                    ad,
                                    selectedSlotMode,
                                    slotHookOverride
                                  )
                                }
                                disabled={isRegenerating || isReplacing}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>Generar en Cloudinary</span>
                              </button>
                            </div>
                          )}

                          {(isRegenerating || isReplacing) && (
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px] flex flex-col items-center justify-center p-4 text-center gap-2">
                              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                              <span className="text-xs font-bold text-white">
                                {isReplacing
                                  ? `Reemplazando Anuncio #${slotIdx + 1} en Meta Ads...`
                                  : `Generando nueva imagen IA para Anuncio #${slotIdx + 1}...`}
                              </span>
                            </div>
                          )}

                          {draft && !isRegenerating && !isReplacing && (
                            <div className="absolute top-2 inset-x-2 px-2.5 py-1 rounded-lg bg-amber-400 text-black text-[10px] font-extrabold uppercase tracking-wide text-center shadow-lg">
                              ✨ Nuevo borrador listo · Reemplazar en Meta
                            </div>
                          )}
                        </div>

                        {/* Pie del anuncio */}
                        <div className="p-3 space-y-2.5 flex-1 flex flex-col justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <strong className="text-xs text-white line-clamp-1">{displayHeadline}</strong>
                              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-semibold shrink-0">
                                {displayCta}
                              </span>
                            </div>
                            {displayPrimaryText && (
                              <p className="text-[11px] text-zinc-400 line-clamp-2 leading-snug">
                                {displayPrimaryText}
                              </p>
                            )}
                          </div>

                          {replaceResult && !draft && (
                            <div className="px-2.5 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-600/50 text-[10px] text-emerald-200 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>
                                {replaceResult.deletedFromMeta
                                  ? `Anterior eliminado · Nuevo activo (${replaceResult.newAdId})`
                                  : `Nuevo anuncio activo en Meta (${replaceResult.newAdId})`}
                              </span>
                            </div>
                          )}

                          {draft && (
                            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-2">
                              <p className="text-[10px] text-amber-200 leading-snug">
                                Al lanzar se elimina el Ad anterior en Meta y este Ad #{slotIdx + 1} apuntará a:{' '}
                                <span className="font-mono text-white break-all">
                                  {draft.targetLandingUrl || slotTargetUrlPreview}
                                </span>
                              </p>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onDiscardDraft(adKey)}
                                  disabled={isReplacing}
                                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-semibold text-zinc-300 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Cancelar</span>
                                </button>
                                <button
                                  type="button"
                                  data-testid={`campaign-launch-replace-ad-btn-${slotIdx}`}
                                  onClick={() => onLaunchReplaceAd(selectedCampaign, slotIdx, ad, draft)}
                                  disabled={isReplacing}
                                  className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                                >
                                  {isReplacing ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Send className="w-3.5 h-3.5" />
                                  )}
                                  <span>
                                    {isReplacing
                                      ? 'Reemplazando...'
                                      : `Lanzar Ad #${slotIdx + 1} en Meta`}
                                  </span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            );
          })()}

          {/* PESTAÑA 2: GRUPO DE ANUNCIOS (AD SET) */}
          {campaignSubTab === 'grupo' && (
            <div
              data-testid="campaign-tab-panel-grupo"
              className="p-5 rounded-xl bg-[#0f1115] border border-sky-800/40 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-sky-500 text-black text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    Grupo de Anuncios
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    {selectedCampaign.adSetName || '[PARAGUAY 18-65+] Grupo Principal'}
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  Ad Set ID: <strong className="text-zinc-200">{selectedCampaign.adSetId || '—'}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Segmentación</span>
                  <strong className="text-zinc-100">Paraguay (PY) · 18–65+ años</strong>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Píxel Meta</span>
                  <strong className="text-emerald-300 font-mono">{selectedCampaign.pixelId || '1276031534651377'}</strong>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Evento Optimización</span>
                  <strong className="text-sky-300 font-mono">{(selectedCampaign as any).optimizationEvent || 'LEAD'}</strong>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Anuncios Activos</span>
                  <strong className="text-zinc-100 font-mono">{adsList.length} anuncios</strong>
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 3: FICHA TÉCNICA Y ACCIONES DE LA CAMPAÑA */}
          {campaignSubTab === 'campana' && (
            <div
              data-testid="campaign-tab-panel-campana"
              className="p-5 rounded-xl bg-[#0f1115] border border-zinc-800 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                    Detalles de Campaña
                  </span>
                  <h3 className="text-sm font-bold text-white mt-0.5">{selectedCampaign.campaignName}</h3>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  Campaign ID: <strong className="text-zinc-200">{selectedCampaign.campaignId}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Producto</span>
                  <strong className="text-zinc-100 truncate block">{selectedCampaign.productName}</strong>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Objetivo Meta</span>
                  <strong className="text-emerald-300 font-mono">{(selectedCampaign as any).objective || 'OUTCOME_LEADS'}</strong>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Cuenta Publicitaria</span>
                  <strong className="text-zinc-200 font-mono">act_{actNum}</strong>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Creada</span>
                  <strong className="text-zinc-200">{createdLabel}</strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
                <span className="text-[11px] font-mono text-zinc-500 truncate max-w-md">
                  {selectedCampaign.landingUrl}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onLoadCampaignInCreator(selectedCampaign)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Editar en Creador</span>
                  </button>
                  <a
                    href={
                      selectedCampaign.adsManagerUrl ||
                      `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actNum}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <span>Ver en Ads Manager</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // INTERFAZ DEDICADA: LISTA DE TODAS LAS CAMPAÑAS (SEPARADA DEL INICIO)
  // ============================================================================
  const activeCount = campaigns.filter(c => {
    const st = (c as any).campaignStatus || c.publishedAds?.[0]?.status || 'ACTIVE';
    return st === 'ACTIVE';
  }).length;
  const visibleCampaigns =
    listFilterTab === 'activas'
      ? campaigns.filter(c => ((c as any).campaignStatus || c.publishedAds?.[0]?.status || 'ACTIVE') === 'ACTIVE')
      : campaigns;

  return (
    <div
      data-testid="autoads-all-campaigns-view"
      className="rounded-2xl bg-[#090a0c] border border-zinc-800/90 shadow-xl overflow-hidden"
    >
      {/* Cabecera Propia de la Interfaz Campañas */}
      <div className="px-4 py-3 bg-[#0f1115] border-b border-zinc-800/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {onBackToInicio && (
            <>
              <button
                type="button"
                data-testid="autoads-campaigns-back-inicio"
                onClick={onBackToInicio}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/90 text-xs font-semibold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>Inicio</span>
              </button>
              <span className="h-4 w-px bg-zinc-800 hidden sm:inline-block" />
            </>
          )}

          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-zinc-100">
              Campañas ({campaigns.length})
            </h2>
          </div>

          {campaigns.length > 0 && (
            <div className="bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 inline-flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setListFilterTab('todas')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                  listFilterTab === 'todas' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Todas ({campaigns.length})
              </button>
              <button
                type="button"
                onClick={() => setListFilterTab('activas')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                  listFilterTab === 'activas' ? 'bg-zinc-800 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Activas ({activeCount})
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onSyncLiveCampaigns}
            disabled={syncingCampaigns}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {syncingCampaigns ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Sincronizar Meta</span>
          </button>

          <button
            type="button"
            onClick={onGoToCreateCampaign}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Nueva Campaña</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {visibleCampaigns.length === 0 ? (
          <div className="p-10 rounded-xl border border-dashed border-zinc-800 text-center space-y-3">
            <Megaphone className="w-8 h-8 text-zinc-500 mx-auto" />
            <div className="text-sm font-semibold text-zinc-200">
              {campaigns.length === 0
                ? 'Todavía no hay campañas cargadas'
                : 'No hay campañas activas en este filtro'}
            </div>
            {campaigns.length === 0 && (
              <button
                type="button"
                onClick={onGoToCreateCampaign}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Crear Primera Campaña</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {visibleCampaigns.map(camp => {
              const ads = Array.isArray(camp.publishedAds) ? camp.publishedAds : [];
              const campStatus = (camp as any).campaignStatus || ads[0]?.status || 'ACTIVE';
              const isActive = campStatus === 'ACTIVE';
              const actNum = String(camp.adAccountId || '1048211497774834').replace(/^act_/, '');
              const dateLabel = camp.createdAt
                ? new Date(camp.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })
                : 'En vivo';

              const probeAds = ads.length > 0 ? ads : [{ adIndex: 0 }];
              let coverImg = '';
              for (let i = 0; i < probeAds.length; i++) {
                const candidateUrl = pickWorkingUrl(
                  resolveCampaignAdImageCandidates(
                    camp,
                    probeAds[i],
                    i,
                    workspacesCache,
                    cloudinaryResources
                  )
                );
                if (candidateUrl) {
                  coverImg = candidateUrl;
                  break;
                }
              }

              return (
                <div
                  key={camp.id}
                  data-testid={`campaign-list-card-${camp.campaignId}`}
                  onClick={() => onSelectCampaign(camp)}
                  className="relative aspect-square rounded-xl border border-zinc-800 hover:border-emerald-500/80 bg-[#0d0f13] overflow-hidden cursor-pointer transition-all group shadow-md"
                >
                  {coverImg ? (
                    <img
                      src={coverImg}
                      alt={camp.campaignName}
                      referrerPolicy="no-referrer"
                      onError={() => markUrlFailed(coverImg)}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-zinc-950 text-zinc-500 p-3 text-center">
                      <ImageIcon className="w-6 h-6 text-zinc-600" />
                      <span className="text-[10px] font-medium">Sin imagen</span>
                    </div>
                  )}

                  <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-1 z-10">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold border backdrop-blur-sm ${
                        isActive
                          ? 'bg-emerald-950/85 border-emerald-600/70 text-emerald-300'
                          : 'bg-zinc-900/90 border-zinc-700 text-zinc-300'
                      }`}
                    >
                      {isActive ? '● ACTIVA' : campStatus}
                    </span>

                    <a
                      href={
                        camp.adsManagerUrl ||
                        `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actNum}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      title="Abrir en Meta Ads Manager"
                      className="p-1 rounded bg-black/75 hover:bg-black border border-zinc-700/80 text-zinc-300 hover:text-white backdrop-blur-sm transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-2.5 pt-10 bg-gradient-to-t from-black via-black/85 to-transparent z-10 flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2 leading-tight">
                      {camp.campaignName}
                    </span>
                    <div className="flex items-center justify-between gap-1 text-[10px] text-zinc-400">
                      <span className="font-mono truncate">
                        {ads.length || 6} ads · {dateLabel}
                      </span>
                      <span className="text-emerald-400 font-bold shrink-0">Abrir →</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
