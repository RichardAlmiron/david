import React, { useEffect, useState } from 'react';
import {
  X,
  Smartphone,
  Download,
  Copy,
  Check,
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
  const { isInstallable, install } = usePWAInstall();
  const [copiedTarget, setCopiedTarget] = useState<'android' | 'iphone' | null>(null);
  const [qrAndroid, setQrAndroid] = useState<string>('');
  const [qrIphone, setQrIphone] = useState<string>('');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://autoads360.up.railway.app';
  const androidUrl = `${origin}/app-android?instalar=1`;
  const iphoneUrl = `${origin}/app-iphone?instalar=1`;

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

  const handleDirectAndroidDownload = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        onClose();
        return;
      }
    }
    onClose();
    if (typeof window !== 'undefined') {
      window.location.assign('/app-android?instalar=1');
      return;
    }
    onLaunchAndroidApp();
  };

  const handleDirectIphoneDownload = () => {
    onClose();
    if (typeof window !== 'undefined') {
      window.location.assign('/app-iphone?instalar=1');
      return;
    }
    onLaunchIphoneApp();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-apps-title"
    >
      <div className="w-full max-w-3xl bg-[#0b0e16]/95 border border-white/10 rounded-2xl overflow-hidden my-auto text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-[#e5c88b] shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="download-apps-title" className="text-base sm:text-lg font-bold text-white truncate">
                Descargar App
              </h2>
              <p className="text-xs text-zinc-400 truncate">
                Elegí tu celular para descargar e instalar directo (sin Play Store ni App Store)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Option 1: Android App */}
          <div className="flex flex-col justify-between bg-[#07090f]/80 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/app-android-192.png"
                  alt="Icono App Android"
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-2xl border border-white/15 shrink-0 object-cover"
                />
                <div className="min-w-0">
                  <div className="text-xs font-mono text-[#e5c88b]">
                    Android
                  </div>
                  <h3 className="text-lg font-bold text-white leading-tight">
                    Noelux Admin Android
                  </h3>
                </div>
              </div>

              <div className="text-xs text-zinc-400 space-y-1.5 leading-relaxed">
                <p className="text-zinc-200 font-medium">
                  Control administrativo completo con interfaz optimizada.
                </p>
                <p>Acceso: Mismo usuario y contraseña web (sin PIN).</p>
                <p>Incluye: Todos los menús, pedidos, AutoAds y WhatsApp sin QR.</p>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-white/10">
              {qrAndroid && (
                <div className="flex items-center gap-3 bg-[#0b0e16]/80 border border-white/10 rounded-xl p-2.5">
                  <img
                    src={qrAndroid}
                    alt="QR App Android"
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-lg bg-white p-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-[11px] font-medium text-zinc-300">
                      ¿Estás desde la PC? Escaneá con tu Android
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500 truncate">
                      {androidUrl}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('android', androidUrl)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#e5c88b] hover:text-[#edd49e] cursor-pointer"
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

              <button
                type="button"
                onClick={handleDirectAndroidDownload}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Descargar App Android</span>
              </button>
            </div>
          </div>

          {/* Option 2: iPhone App */}
          <div className="flex flex-col justify-between bg-[#07090f]/80 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/app-iphone-192.png"
                  alt="Icono App iPhone"
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-2xl border border-white/15 shrink-0 object-cover"
                />
                <div className="min-w-0">
                  <div className="text-xs font-mono text-zinc-400">
                    iPhone / iOS
                  </div>
                  <h3 className="text-lg font-bold text-white leading-tight">
                    Noelux Pedidos iOS
                  </h3>
                </div>
              </div>

              <div className="text-xs text-zinc-400 space-y-1.5 leading-relaxed">
                <p className="text-zinc-200 font-medium">
                  Diseño nativo iPhone para productos, pedidos y WhatsApp.
                </p>
                <p className="inline-flex items-center gap-1.5 text-[#e5c88b] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Requiere usuario + contraseña + código PIN de 4 dígitos.</span>
                </p>
                <p>Incluye: Lista de productos, pedidos de cada producto y WhatsApp sin QR.</p>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-white/10">
              {qrIphone && (
                <div className="flex items-center gap-3 bg-[#0b0e16]/80 border border-white/10 rounded-xl p-2.5">
                  <img
                    src={qrIphone}
                    alt="QR App iPhone"
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-lg bg-white p-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-[11px] font-medium text-zinc-300">
                      ¿Estás desde la PC? Escaneá con tu iPhone
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500 truncate">
                      {iphoneUrl}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('iphone', iphoneUrl)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#e5c88b] hover:text-[#edd49e] cursor-pointer"
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

              <button
                type="button"
                onClick={handleDirectIphoneDownload}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Smartphone className="w-4 h-4 shrink-0 text-[#e5c88b]" />
                <span>Descargar App iPhone</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
