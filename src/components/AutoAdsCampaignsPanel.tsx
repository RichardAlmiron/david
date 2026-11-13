import React from 'react';
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
  X
} from 'lucide-react';
import {
  GeneratedAdCreativeAsset,
  PipeboardPublishedCampaignRecord
} from '../utils/autoAdsBrainEngine';
import type { CloudinaryMediaClient } from './AutoAdsCloudinaryPanel';

export interface CampaignAdReplaceResultInfo {
  oldAdId?: string;
  deletedFromMeta: boolean;
  newAdId: string;
  newCreativeId: string;
  replacedAt: string;
}

interface AutoAdsCampaignsPanelProps {
  campaigns: PipeboardPublishedCampaignRecord[];
  selectedCampaign: PipeboardPublishedCampaignRecord | null;
  onSelectCampaign: (camp: PipeboardPublishedCampaignRecord | null) => void;
  onGoToCreateCampaign: () => void;
  onSyncLiveCampaigns: () => void;
  syncingCampaigns: boolean;
  cloudinaryResources: CloudinaryMediaClient[];
  workspacesCache: Record<string, any>;
  pendingDraftsByKey: Record<string, GeneratedAdCreativeAsset>;
  regeneratingAdKey: string | null;
  replacingAdKey: string | null;
  replacedInfoByKey: Record<string, CampaignAdReplaceResultInfo>;
  onRegenerateCampaignAd: (
    camp: PipeboardPublishedCampaignRecord,
    adIdx: number,
    existingAd: any
  ) => void;
  onDiscardDraft: (adKey: string) => void;
  onLaunchReplaceAd: (
    camp: PipeboardPublishedCampaignRecord,
    adIdx: number,
    existingAd: any,
    draftCreative: GeneratedAdCreativeAsset
  ) => void;
  onLoadCampaignInCreator: (camp: PipeboardPublishedCampaignRecord) => void;
}

export function buildCampaignAdKey(campaignId: string, adIdx: number, adId?: string): string {
  return `${campaignId || 'camp'}::${adIdx}::${adId || 'slot'}`;
}

function resolveCampaignAdImageUrl(
  camp: PipeboardPublishedCampaignRecord,
  ad: any,
  adIdx: number,
  workspacesCache: Record<string, any>,
  cloudinaryResources: CloudinaryMediaClient[],
  draft?: GeneratedAdCreativeAsset
): string {
  if (draft?.aiGeneratedImageUrl) return draft.aiGeneratedImageUrl;
  if (draft?.aiGeneratedImageDataUrl) return draft.aiGeneratedImageDataUrl;
  if (ad?.imageUrl) return String(ad.imageUrl);

  // Fallback 1: check saved workspace creative image
  const ws =
    workspacesCache[camp.productId] ||
    workspacesCache[`ext_${camp.landingUrl}`] ||
    Object.values(workspacesCache || {}).find(
      (w: any) =>
        (camp.productId && w?.productId === camp.productId) ||
        (camp.productSlug && w?.scrapedExternalProduct?.slug === camp.productSlug)
    );
  const wsAd = Array.isArray(ws?.creatives) ? ws.creatives[adIdx] : null;
  if (wsAd?.aiGeneratedImageUrl) return String(wsAd.aiGeneratedImageUrl);

  // Fallback 2: check Cloudinary resources by tag (ad_1..ad_6 & slug)
  const slugTag = String(camp.productSlug || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_');
  const adTag = `ad_${adIdx + 1}`;
  const cldMatch = cloudinaryResources.find(
    r =>
      r.tags.includes(adTag) &&
      (!slugTag || r.tags.some(t => t.includes(slugTag)) || r.publicId.includes(slugTag))
  );
  if (cldMatch?.secureUrl) return cldMatch.secureUrl;

  return '';
}

export const AutoAdsCampaignsPanel: React.FC<AutoAdsCampaignsPanelProps> = ({
  campaigns,
  selectedCampaign,
  onSelectCampaign,
  onGoToCreateCampaign,
  onSyncLiveCampaigns,
  syncingCampaigns,
  cloudinaryResources,
  workspacesCache,
  pendingDraftsByKey,
  regeneratingAdKey,
  replacingAdKey,
  replacedInfoByKey,
  onRegenerateCampaignAd,
  onDiscardDraft,
  onLaunchReplaceAd,
  onLoadCampaignInCreator
}) => {
  // ============================================================================
  // VISTA PRIVADA DE UNA CAMPAÑA ESPECÍFICA (CAMPAÑA -> GRUPO DE ANUNCIOS -> ANUNCIOS)
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

    return (
      <div
        data-testid="autoads-single-campaign-view"
        className="space-y-4"
      >
        {/* Cabecera de Navegación Privada de la Campaña */}
        <div className="p-4 rounded-xl bg-[#0f0f11] border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              data-testid="autoads-back-to-campaigns"
              onClick={() => onSelectCampaign(null)}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-100 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Volver a Campañas</span>
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-zinc-100">
                  {selectedCampaign.campaignName}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                    isCampActive
                      ? 'bg-emerald-950/80 border-emerald-700/70 text-emerald-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                  }`}
                >
                  {isCampActive ? '● ACTIVA' : campStatus}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Vista dedicada exclusiva de esta campaña: 1. Campaña → 2. Grupo de Anuncios → 3. Anuncios ({adsList.length})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onLoadCampaignInCreator(selectedCampaign)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-semibold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Abrir en Creador</span>
            </button>
            <a
              href={
                selectedCampaign.adsManagerUrl ||
                `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actNum}`
              }
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-semibold text-emerald-300 inline-flex items-center gap-1"
            >
              <span>Ver en Ads Manager</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* NIVEL 1: CAMPAÑA */}
        <div className="p-4 rounded-xl bg-[#0f0f11] border border-emerald-800/60 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-extrabold uppercase tracking-wider">
                1. Campaña
              </span>
              <span className="text-xs sm:text-sm font-bold text-white">
                {selectedCampaign.campaignName}
              </span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              Campaign ID: <strong className="text-zinc-200">{selectedCampaign.campaignId}</strong>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px] pt-1">
            <div className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">Producto</span>
              <strong className="text-zinc-200 truncate block">{selectedCampaign.productName}</strong>
            </div>
            <div className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">Objetivo Meta</span>
              <strong className="text-emerald-300 font-mono">
                {(selectedCampaign as any).objective || 'OUTCOME_LEADS'}
              </strong>
            </div>
            <div className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">Cuenta Publicitaria</span>
              <strong className="text-zinc-200 font-mono">act_{actNum}</strong>
            </div>
            <div className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">Creada</span>
              <strong className="text-zinc-200">
                {selectedCampaign.createdAt
                  ? new Date(selectedCampaign.createdAt).toLocaleDateString('es-PY', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })
                  : 'En vivo'}
              </strong>
            </div>
          </div>
        </div>

        {/* NIVEL 2: GRUPO DE ANUNCIOS (AD SET) */}
        <div className="sm:ml-5 pl-3 border-l-2 border-emerald-700/60">
          <div className="p-4 rounded-xl bg-[#0f0f11] border border-zinc-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-sky-500 text-black text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  2. Grupo de Anuncios
                </span>
                <span className="text-xs sm:text-sm font-bold text-zinc-100">
                  {selectedCampaign.adSetName || '[PARAGUAY 18-65+] Grupo Principal'}
                </span>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                Ad Set ID: <strong className="text-zinc-200">{selectedCampaign.adSetId || '—'}</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
              <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800">
                🇵🇾 Segmentación: <strong>Paraguay (18–65+ años)</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800">
                🎯 Píxel: <strong className="font-mono">{selectedCampaign.pixelId || '1276031534651377'}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800">
                📣 Evento: <strong>{(selectedCampaign as any).optimizationEvent || 'LEAD'}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* NIVEL 3: ANUNCIOS DE LA CAMPAÑA */}
        <div className="sm:ml-10 pl-3 border-l-2 border-zinc-700/70 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-400 text-black text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1">
                <Layers className="w-3 h-3" />
                3. Anuncios ({adsList.length})
              </span>
              <span className="text-xs text-zinc-400">
                Podés regenerar cualquier anuncio individual y hacer clic en <strong className="text-zinc-200">Lanzar y Reemplazar en Meta Ads</strong> para eliminar el anterior en Meta y publicar el nuevo en su lugar.
              </span>
            </div>
          </div>

          {adsList.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-zinc-800 text-center text-xs text-zinc-400">
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
                const displayImgUrl = resolveCampaignAdImageUrl(
                  selectedCampaign,
                  ad,
                  slotIdx,
                  workspacesCache,
                  cloudinaryResources,
                  draft
                );
                const isCloudinary = displayImgUrl.includes('res.cloudinary.com');
                const displayHeadline = draft?.headline || ad.headline || selectedCampaign.productName;
                const displayPrimaryText = draft?.primaryText || ad.primaryText || '';
                const displayCta = draft?.ctaLabel || ad.ctaLabel || 'Pedir ahora';

                return (
                  <div
                    key={adKey}
                    data-testid={`campaign-ad-card-${slotIdx}`}
                    className={`rounded-xl border overflow-hidden flex flex-col justify-between bg-[#141517] transition-all ${
                      draft
                        ? 'border-amber-400/80 ring-1 ring-amber-400/30'
                        : replaceResult
                          ? 'border-emerald-500/70'
                          : 'border-zinc-800'
                    }`}
                  >
                    {/* Header Anuncio + Botón Regenerar */}
                    <div className="px-3 py-2.5 bg-[#0f0f11] border-b border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
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
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500 truncate mt-0.5">
                          Ad ID: {ad.adId || '—'}
                        </div>
                      </div>

                      <button
                        type="button"
                        data-testid={`campaign-regenerate-ad-btn-${slotIdx}`}
                        onClick={() => onRegenerateCampaignAd(selectedCampaign, slotIdx, ad)}
                        disabled={isRegenerating || isReplacing}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCw className={`w-3 h-3 text-emerald-400 ${isRegenerating ? 'animate-spin' : ''}`} />
                        <span>{isRegenerating ? 'Regenerando...' : 'Regenerar'}</span>
                      </button>
                    </div>

                    {/* Imagen del Anuncio (Cloudinary / Preview) */}
                    <div className="relative aspect-square bg-zinc-950 border-b border-zinc-800 flex items-center justify-center overflow-hidden">
                      {displayImgUrl ? (
                        <img
                          src={displayImgUrl}
                          alt={displayHeadline}
                          referrerPolicy="no-referrer"
                          className={`w-full h-full object-cover transition-opacity ${
                            isRegenerating || isReplacing ? 'opacity-35' : 'opacity-100'
                          }`}
                        />
                      ) : (
                        <div className="p-4 text-center text-xs text-zinc-500 space-y-2">
                          <Megaphone className="w-6 h-6 mx-auto text-zinc-600" />
                          <p className="text-[11px]">
                            Sin vista previa local. Presioná <strong>Regenerar</strong> para crear nueva imagen en Cloudinary.
                          </p>
                        </div>
                      )}

                      {(isRegenerating || isReplacing) && (
                        <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px] flex flex-col items-center justify-center p-4 text-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                          <span className="text-xs font-bold text-white">
                            {isReplacing
                              ? `Eliminando anuncio anterior en Meta Ads y lanzando nuevo Anuncio #${slotIdx + 1}...`
                              : `Generando nueva imagen IA para Anuncio #${slotIdx + 1}...`}
                          </span>
                        </div>
                      )}

                      {draft && !isRegenerating && !isReplacing && (
                        <div className="absolute top-2 inset-x-2 px-2.5 py-1 rounded-lg bg-amber-400 text-black text-[10px] font-extrabold uppercase tracking-wide text-center shadow-lg">
                          ✨ Nueva imagen regenerada · Lista para lanzar
                        </div>
                      )}
                    </div>

                    {/* Copy y Acción Directa de Reemplazo en Meta Ads */}
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
                              ? `Anterior (${replaceResult.oldAdId}) eliminado en Meta · Nuevo activo (${replaceResult.newAdId})`
                              : `Nuevo anuncio activo en Meta (${replaceResult.newAdId})`}
                          </span>
                        </div>
                      )}

                      {draft && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-2">
                          <p className="text-[10px] text-amber-200 leading-snug">
                            Al presionar <strong>Lanzar</strong>, se borrará el Anuncio #{slotIdx + 1} actual en Meta Ads (<code>DELETE {ad.adId}</code>) y se publicará esta nueva versión en su lugar.
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
                                  ? 'Reemplazando en Meta...'
                                  : `🚀 Lanzar Anuncio #${slotIdx + 1} en Meta`}
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
      </div>
    );
  }

  // ============================================================================
  // INTERFAZ DEDICADA: LISTA DE TODAS LAS CAMPAÑAS
  // ============================================================================
  return (
    <div
      data-testid="autoads-all-campaigns-view"
      className="p-4 sm:p-5 rounded-xl bg-[#0f0f11] border border-zinc-800 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            <span>Todas las Campañas en Meta Ads ({campaigns.length})</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Hacé clic en cualquier campaña para abrir su interfaz privada con Campaña → Grupo de Anuncios → Anuncios.
          </p>
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
            <span>Sincronizar con Meta Ads</span>
          </button>

          <button
            type="button"
            onClick={onGoToCreateCampaign}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Crear Nueva Campaña</span>
          </button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="p-10 rounded-xl border border-dashed border-zinc-800 text-center space-y-3">
          <Megaphone className="w-8 h-8 text-zinc-500 mx-auto" />
          <div className="text-sm font-semibold text-zinc-200">
            Todavía no hay campañas cargadas en este panel
          </div>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Podés crear y publicar tu primera campaña con 6 anuncios IA o presionar <strong>Sincronizar con Meta Ads</strong> para traer tus campañas activas.
          </p>
          <button
            type="button"
            onClick={onGoToCreateCampaign}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ir a Crear Campaña</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {campaigns.map(camp => {
            const ads = Array.isArray(camp.publishedAds) ? camp.publishedAds : [];
            const campStatus = (camp as any).campaignStatus || ads[0]?.status || 'ACTIVE';
            const isActive = campStatus === 'ACTIVE';
            const actNum = String(camp.adAccountId || '1048211497774834').replace(/^act_/, '');
            const dateLabel = camp.createdAt
              ? new Date(camp.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })
              : 'En vivo';

            const thumbs = ads
              .slice(0, 4)
              .map((a, i) =>
                resolveCampaignAdImageUrl(camp, a, i, workspacesCache, cloudinaryResources)
              )
              .filter(Boolean);

            return (
              <div
                key={camp.id}
                data-testid={`campaign-list-card-${camp.campaignId}`}
                onClick={() => onSelectCampaign(camp)}
                className="rounded-xl border border-zinc-800 hover:border-emerald-500/70 bg-zinc-950 p-3.5 flex flex-col justify-between gap-3 cursor-pointer transition-all group"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors line-clamp-2">
                      {camp.campaignName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold shrink-0 border ${
                        isActive
                          ? 'bg-emerald-950/80 border-emerald-700/70 text-emerald-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                      }`}
                    >
                      {isActive ? '● ACTIVA' : campStatus}
                    </span>
                  </div>

                  {/* Mini tira visual de creativos guardados */}
                  {thumbs.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5">
                      {thumbs.map((src, tIdx) => (
                        <div
                          key={`${camp.id}-th-${tIdx}`}
                          className="aspect-square rounded-md overflow-hidden border border-zinc-800 bg-black"
                        >
                          <img
                            src={src}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1 text-[11px] text-zinc-400">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-zinc-300">{camp.productName}</span>
                      <span className="font-mono text-zinc-500 shrink-0">{dateLabel}</span>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 truncate">
                      Campaña {camp.campaignId} · AdSet {camp.adSetId || '—'} · {ads.length || 6} anuncios
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-zinc-800/80">
                  <span className="text-[11px] font-bold text-emerald-400 group-hover:text-emerald-300 inline-flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Abrir Campaña y Anuncios →</span>
                  </span>
                  <a
                    href={
                      camp.adsManagerUrl ||
                      `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actNum}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1"
                  >
                    <span>Ads Manager</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
