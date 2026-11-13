import React, { useEffect, useState } from 'react';
import {
  X,
  Smartphone,
  Download,
  Copy,
  Check,
  Share,
  PlusSquare,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface DownloadAppsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchAndroidApp: () => void;
  onLaunchIphoneApp: () => void;
}

export const DownloadAppsModal: React.FC<DownloadAppsModalProps> = ({
  isOpen,
  onClose,
  onLaunchAndroidApp,
  onLaunchIphoneApp
}) => {
  const { isInstallable, isAndroid, install } = usePWAInstall();
  const [copiedTarget, setCopiedTarget] = useState<'android' | 'iphone' | null>(null);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [showIphoneGuide, setShowIphoneGuide] = useState(false);
  const [qrAndroid, setQrAndroid] = useState<string>('');
  const [qrIphone, setQrIphone] = useState<string>('');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://autoads360.up.railway.app';
  const androidUrl = `${origin}/app-android`;
  const iphoneUrl = `${origin}/app-iphone`;

  useEffect(() => {
    if (!isOpen) return;
    QRCode.toDataURL(androidUrl, {
      width: 180,
      margin: 1,
      color: { dark: '#09090b', light: '#ffffff' }
    })
      .then(setQrAndroid)
      .catch(() => {});
    QRCode.toDataURL(iphoneUrl, {
      width: 180,
      margin: 1,
      color: { dark: '#09090b', light: '#ffffff' }
    })
      .then(setQrIphone)
      .catch(() => {});
  }, [isOpen, androidUrl, iphoneUrl]);

  if (!isOpen) return null;

  const handleCopy = async (target: 'android' | 'iphone', url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedTarget(target);
      window.setTimeout(() => setCopiedTarget(null), 2000);
    } catch {}
  };

  const handleAndroidInstallAction = async () => {
    if (isInstallable && isAndroid) {
      const accepted = await install();
      if (accepted) return;
    }
    setShowAndroidGuide(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-apps-title"
    >
      <div className="w-full max-w-3xl bg-[#0f0f12] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-auto text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/90 bg-[#0a0a0c]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="download-apps-title" className="text-base sm:text-lg font-semibold text-white truncate">
                Descargar App
              </h2>
              <p className="text-xs text-zinc-400 truncate">
                Instalación directa sin Play Store ni App Store · Sincronizada con tu base de datos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Exclusively 2 Options (Android & iPhone) */}
        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Option 1: Android App */}
          <div className="flex flex-col justify-between bg-[#141418] border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/app-android-192.png"
                  alt="Icono App Android"
                  className="w-12 h-12 rounded-2xl border border-emerald-500/30 shrink-0 object-cover"
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-emerald-400">
                    Aplicación para Android
                  </div>
                  <h3 className="text-lg font-semibold text-white leading-tight">
                    Noelux Admin Android
                  </h3>
                </div>
              </div>

              <div className="text-xs text-zinc-400 space-y-1.5 leading-relaxed">
                <p className="text-zinc-300 font-medium">
                  Control administrativo total con estética Material nativa de Android.
                </p>
                <p>Acceso: Mismo usuario y contraseña de la web (sin PIN).</p>
                <p>Incluye: Todos los menús, pedidos, AutoAds y sincronización WhatsApp sin escanear QR.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-zinc-800/80">
              {qrAndroid && (
                <div className="flex items-center gap-3 bg-zinc-900/70 border border-zinc-800 rounded-xl p-2.5">
                  <img
                    src={qrAndroid}
                    alt="QR App Android"
                    className="w-16 h-16 rounded-lg bg-white p-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-[11px] font-medium text-zinc-300">
                      Abrí en tu celular Android
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500 truncate">
                      {androidUrl}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('android', androidUrl)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 cursor-pointer"
                    >
                      {copiedTarget === 'android' ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Enlace copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copiar enlace Android
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {showAndroidGuide && (
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-xs text-zinc-300 space-y-1">
                  <div className="font-semibold text-emerald-300">Cómo instalar en tu Android (1 paso):</div>
                  <p>1. Abrí el enlace en Google Chrome en tu Android.</p>
                  <p>2. Tocá el menú <strong>⋮</strong> (arriba a la derecha) y elegí <strong>Instalar aplicación</strong> o <strong>Agregar a la pantalla principal</strong>.</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleAndroidInstallAction}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Instalar en Android</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLaunchAndroidApp();
                  }}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span>Abrir App</span>
                </button>
              </div>
            </div>
          </div>

          {/* Option 2: iPhone App */}
          <div className="flex flex-col justify-between bg-[#141418] border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/app-iphone-192.png"
                  alt="Icono App iPhone"
                  className="w-12 h-12 rounded-2xl border border-sky-500/30 shrink-0 object-cover"
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-sky-400">
                    Aplicación para iPhone
                  </div>
                  <h3 className="text-lg font-semibold text-white leading-tight">
                    Noelux Pedidos iOS
                  </h3>
                </div>
              </div>

              <div className="text-xs text-zinc-400 space-y-1.5 leading-relaxed">
                <p className="text-zinc-300 font-medium">
                  Diseño nativo iPhone (iOS) exclusivo para productos, pedidos y WhatsApp.
                </p>
                <p className="inline-flex items-center gap-1 text-amber-300 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  Requiere usuario + contraseña + código PIN obligatorio de 4 dígitos.
                </p>
                <p>Incluye: Lista de productos, pedidos de cada producto y vinculación WhatsApp por código sin QR.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-zinc-800/80">
              {qrIphone && (
                <div className="flex items-center gap-3 bg-zinc-900/70 border border-zinc-800 rounded-xl p-2.5">
                  <img
                    src={qrIphone}
                    alt="QR App iPhone"
                    className="w-16 h-16 rounded-lg bg-white p-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-[11px] font-medium text-zinc-300">
                      Abrí en Safari del iPhone
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500 truncate">
                      {iphoneUrl}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('iphone', iphoneUrl)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 cursor-pointer"
                    >
                      {copiedTarget === 'iphone' ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Enlace copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copiar enlace iPhone
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {showIphoneGuide && (
                <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-800/50 text-xs text-zinc-300 space-y-1.5">
                  <div className="font-semibold text-sky-300">Cómo instalar en iPhone (2 toques):</div>
                  <p className="flex items-center gap-1.5">
                    <Share className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>1. Abrí el enlace en <strong>Safari</strong> en el iPhone y tocá <strong>Compartir</strong>.</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <PlusSquare className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>2. Deslizá y tocá <strong>Agregar a pantalla de inicio</strong>.</span>
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setShowIphoneGuide(prev => !prev)}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>Instalar en iPhone</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLaunchIphoneApp();
                  }}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span>Abrir App</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
