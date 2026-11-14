import React, { useState } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ExternalLink,
  Copy,
  Image as ImageIcon,
  ChevronDown
} from 'lucide-react';

export interface CloudinaryStatusClient {
  configured: boolean;
  cloudName: string;
  folder: string;
  apiKeyPreview: string;
  missingVars: string[];
  requiredEnvVars: string[];
  mode: 'signed_api' | 'not_configured';
}

export interface CloudinaryMediaClient {
  publicId: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  tags: string[];
}

interface AutoAdsCloudinaryPanelProps {
  status: CloudinaryStatusClient | null;
  resources: CloudinaryMediaClient[];
  loadingResources: boolean;
  onRefreshResources: () => void;
  onCopyText: (key: string, label: string, val: string) => void;
  copiedKey: string | null;
}

export const AutoAdsCloudinaryPanel: React.FC<AutoAdsCloudinaryPanelProps> = ({
  status,
  resources,
  loadingResources,
  onRefreshResources,
  onCopyText,
  copiedKey
}) => {
  const configured = Boolean(status?.configured);
  const [showEnvVars, setShowEnvVars] = useState(false);
  const shouldShowEnvVars = !configured || showEnvVars;

  const envTemplate = [
    'CLOUDINARY_CLOUD_NAME=tu_cloud_name',
    'CLOUDINARY_API_KEY=tu_api_key',
    'CLOUDINARY_API_SECRET=tu_api_secret',
    'CLOUDINARY_UPLOAD_FOLDER=noelux/autoads'
  ].join('\n');

  return (
    <div
      data-testid="autoads-cloudinary-panel"
      className="p-5 rounded-2xl bg-[#0b0e16]/80 backdrop-blur-md border border-white/10 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-8 h-8 rounded-lg bg-[#e5c88b]/10 border border-[#e5c88b]/25 flex items-center justify-center text-[#e5c88b]">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-semibold text-white">
                Cloudinary CDN
              </h3>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border inline-flex items-center gap-1 ${
                  configured
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                    : 'bg-[#e5c88b]/10 border-[#e5c88b]/30 text-[#e5c88b]'
                }`}
              >
                {configured ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>CONECTADO · {status?.cloudName}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    <span>PENDIENTE ENV EN RAILWAY</span>
                  </>
                )}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] font-mono text-zinc-300">
                {status?.folder || 'noelux/autoads'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {configured && (
            <button
              type="button"
              onClick={() => setShowEnvVars(prev => !prev)}
              className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-300 font-medium text-[11px] inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Variables ENV</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showEnvVars ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={onRefreshResources}
            disabled={loadingResources}
            className="px-3.5 py-1.5 rounded-lg bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {loadingResources ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span className="font-mono tabular-nums">Actualizar Galería ({resources.length})</span>
          </button>
        </div>
      </div>

      {/* Variables de Entorno listas para pegar en Railway */}
      {shouldShowEnvVars && (
        <div className="p-3.5 rounded-xl bg-[#07090f]/80 border border-white/10 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-zinc-200 uppercase tracking-wider">
              Variables de Entorno para Railway → Service → Variables
            </span>
            <button
              type="button"
              onClick={() => onCopyText('cloudinary_env', 'Variables Cloudinary para Railway', envTemplate)}
              className="px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-[10px] font-semibold text-zinc-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3 h-3 text-[#e5c88b]" />
              <span>{copiedKey === 'cloudinary_env' ? 'Plantilla Copiada' : 'Copiar Nombres ENV'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] font-mono">
            {(status?.requiredEnvVars || [
              'CLOUDINARY_CLOUD_NAME',
              'CLOUDINARY_API_KEY',
              'CLOUDINARY_API_SECRET',
              'CLOUDINARY_UPLOAD_FOLDER'
            ]).map(varName => {
              const isMissing = status?.missingVars?.includes(varName);
              return (
                <div
                  key={varName}
                  className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-1.5 ${
                    varName === 'CLOUDINARY_UPLOAD_FOLDER'
                      ? 'bg-white/[0.03] border-white/10 text-zinc-300'
                      : configured || !isMissing
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                        : 'bg-[#e5c88b]/10 border-[#e5c88b]/25 text-[#e5c88b]'
                  }`}
                >
                  <span className="truncate">{varName}</span>
                  <span className="text-[9px] font-sans font-semibold uppercase shrink-0">
                    {varName === 'CLOUDINARY_UPLOAD_FOLDER'
                      ? 'opcional'
                      : isMissing
                        ? 'falta'
                        : 'ok'}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-zinc-400">
            También podés pegar únicamente <code className="text-zinc-200">CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME</code> en Railway si preferís usar la URL unificada.
          </p>
        </div>
      )}

      {/* Galería en Vivo traída desde Cloudinary API */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
          <span className="inline-flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-[#e5c88b]" />
            <span className="font-mono tabular-nums">Galería en Vivo desde Cloudinary API ({resources.length} imágenes)</span>
          </span>
        </div>

        {resources.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-white/10 text-center text-xs text-zinc-400">
            {configured
              ? 'Todavía no hay imágenes guardadas en tu carpeta AutoAds de Cloudinary. Al generar o regenerar un anuncio aparecerán aquí automáticamente.'
              : 'Cargá las variables CLOUDINARY_* en Railway (y redesplegá o reiniciá) para activar la nube de imágenes de anuncios.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {resources.map(res => (
              <div
                key={res.publicId}
                className="rounded-xl border border-white/10 bg-[#07090f]/80 overflow-hidden flex flex-col justify-between"
              >
                <div className="aspect-square bg-black overflow-hidden">
                  <img
                    src={res.secureUrl}
                    alt={res.publicId}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-2 space-y-1">
                  <div className="text-[10px] font-mono text-zinc-300 truncate" title={res.publicId}>
                    {res.publicId.split('/').pop()}
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-mono tabular-nums text-zinc-400">
                    <span>
                      {res.width}x{res.height}
                    </span>
                    <a
                      href={res.secureUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#e5c88b] hover:text-[#edd49e] inline-flex items-center gap-0.5"
                    >
                      <span>CDN</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
