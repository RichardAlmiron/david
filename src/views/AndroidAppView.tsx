import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Rocket,
  Smartphone,
  LayoutGrid,
  Sparkles,
  Zap,
  Bot,
  Download,
  LogOut,
  Eye,
  EyeOff,
  RefreshCw,
  X
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { AdminView, AdminMenuKey } from './AdminView';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { MobileWhatsAppSyncPanel } from '../components/MobileWhatsAppSyncPanel';

export const AndroidAppView: React.FC = () => {
  const { isAdminAuthenticated, loginAdmin, logoutAdmin } = useStore();
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Android full Admin active menu (mirrors all AdminView menus)
  const [activeMenu, setActiveMenu] = useState<AdminMenuKey>('productos');
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showQuickPairingSheet, setShowQuickPairingSheet] = useState(false);
  const [installSheetOpen, setInstallSheetOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.location.search.includes('instalar=1')
  );
  const [waitingInstallPrompt, setWaitingInstallPrompt] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.location.search.includes('instalar=1')
  );

  // Clean ?instalar=1 once installed or dismissed, and try automatic native prompt when ready
  useEffect(() => {
    if (!installSheetOpen) return;
    if (isInstalled) {
      setInstallSheetOpen(false);
      setWaitingInstallPrompt(false);
      if (typeof window !== 'undefined' && window.location.search.includes('instalar=1')) {
        window.history.replaceState({}, '', '/app-android');
      }
      return;
    }

    const timer = window.setTimeout(() => {
      setWaitingInstallPrompt(false);
    }, 1800);

    if (isInstallable) {
      setWaitingInstallPrompt(false);
      void install().then(accepted => {
        if (accepted) {
          setInstallSheetOpen(false);
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/app-android');
          }
        }
      });
    }

    return () => window.clearTimeout(timer);
  }, [installSheetOpen, isInstallable, isInstalled]);

  const dismissInstallSheet = () => {
    setInstallSheetOpen(false);
    setWaitingInstallPrompt(false);
    if (typeof window !== 'undefined' && window.location.search.includes('instalar=1')) {
      window.history.replaceState({}, '', '/app-android');
    }
  };

  // Android Login state (Mismo usuario y contraseña, SIN código PIN)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Ingresá tu usuario y contraseña de administrador.');
      return;
    }
    setLoading(true);
    const res = await loginAdmin(email.trim(), password.trim());
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Usuario o contraseña incorrectos.');
    }
  };

  // =========================================================
  // PANTALLA DE LOGIN ANDROID MATERIAL 3 (SIN PIN)
  // =========================================================
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-[#111318] text-zinc-100 flex flex-col justify-center px-4 py-8">
        <div className="w-full max-w-md mx-auto space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <img
              src="/assets/app-android-192.png"
              alt="Noelux Admin Android"
              className="w-16 h-16 rounded-2xl border border-emerald-500/30 shadow-lg"
            />
            <div>
              <div className="text-xs font-medium text-emerald-400">
                Aplicación Oficial Android
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
                Noelux Admin
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Iniciá sesión con tu usuario y contraseña web (sin PIN)
              </p>
            </div>
          </div>

          <form
            onSubmit={handleLogin}
            className="bg-[#1b1e25] border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl"
          >
            {error && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/70 text-xs font-medium text-red-200">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-[#111318] border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:border-emerald-400 outline-none"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full min-h-[48px] pl-4 pr-12 py-3 rounded-2xl bg-[#111318] border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:border-emerald-400 outline-none"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-400 cursor-pointer"
                  aria-label="Mostrar contraseña"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-full bg-emerald-400 hover:bg-emerald-300 text-[#042317] text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Ingresando...</span>
                </>
              ) : (
                <span>Ingresar al Panel Completo</span>
              )}
            </button>
          </form>

          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={install}
              className="w-full min-h-[44px] rounded-full bg-[#1b1e25] border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Instalar App en este Android
            </button>
          )}
        </div>

        {installSheetOpen && !isInstalled && (
          <div className="fixed inset-x-0 bottom-0 z-50 p-4 bg-[#17191f] border-t border-zinc-800 rounded-t-3xl shadow-2xl space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img src="/assets/app-android-192.png" alt="Noelux Admin" className="w-11 h-11 rounded-2xl" />
                <div>
                  <div className="text-sm font-bold text-white">Instalar App Android</div>
                  <div className="text-xs text-zinc-400">Se guarda directo en tu pantalla de inicio</div>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissInstallSheet}
                className="min-h-[36px] min-w-[36px] rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {isInstallable ? (
              <button
                type="button"
                onClick={async () => {
                  const ok = await install();
                  if (ok) dismissInstallSheet();
                }}
                className="w-full min-h-[48px] rounded-full bg-emerald-400 text-[#042317] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Confirmar e Instalar en tu Android
              </button>
            ) : waitingInstallPrompt ? (
              <div className="min-h-[44px] rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" /> Preparando descarga en tu celular...
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
                Tocá los <strong>3 puntitos (⋮)</strong> arriba en Chrome y elegí <strong>Instalar aplicación</strong>.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // PANTALLA PRINCIPAL ANDROID MATERIAL 3 (100% ADMIN COMPLETO)
  // =========================================================
  const menuTitleMap: Record<AdminMenuKey, string> = {
    productos: 'Productos y Ventas',
    creador: 'Creador IA',
    pipeboard: 'AutoAds',
    comentarios: 'Comentarios Ads',
    whatsapp: 'WhatsApp',
    deepgram: 'Deepgram Voz',
    openrouter: 'Cerebro LLM'
  };

  return (
    <div className="min-h-screen bg-[#111318] text-zinc-100 flex flex-col">
      {/* Material 3 Top App Bar */}
      <header className="sticky top-0 z-30 h-14 bg-[#17191f]/95 backdrop-blur-md border-b border-zinc-800/90 px-3 sm:px-5 flex items-center justify-between gap-2 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/assets/app-android-192.png"
            alt="Android Admin"
            className="w-8 h-8 rounded-xl border border-emerald-500/30 shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-white truncate">
              {menuTitleMap[activeMenu]}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={install}
              className="min-h-[38px] px-3 rounded-full bg-emerald-400 text-[#042317] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowQuickPairingSheet(true)}
            className="min-h-[38px] px-3 rounded-full bg-[#222630] hover:bg-[#2a2f3b] border border-zinc-700 text-emerald-300 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Sincronizar WhatsApp sin escanear QR"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">WhatsApp sin QR</span>
          </button>

          <button
            type="button"
            onClick={() => logoutAdmin()}
            className="min-h-[38px] min-w-[38px] rounded-full bg-[#222630] text-red-400 flex items-center justify-center cursor-pointer"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {!isOnline && (
        <div className="bg-amber-950/70 border-b border-amber-700/40 px-4 py-2 text-xs text-amber-200 text-center">
          Sin conexión a internet · Mostrando última información en caché
        </div>
      )}

      {/* Embed 100% of AdminView inside Android Shell */}
      <div className="flex-1 pb-20">
        <AdminView
          androidShell={{
            activeMenu,
            onSelectMenu: setActiveMenu
          }}
        />
      </div>

      {/* Quick Same-Phone WhatsApp Pairing Bottom Sheet (Android Material) */}
      {showQuickPairingSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowQuickPairingSheet(false)}
        >
          <div
            className="w-full max-w-lg bg-[#111318] border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                Sincronizar WhatsApp en Android
              </h2>
              <button
                type="button"
                onClick={() => setShowQuickPairingSheet(false)}
                className="min-h-[40px] min-w-[40px] rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <MobileWhatsAppSyncPanel platform="android" defaultLabel="WhatsApp Android" />
          </div>
        </div>
      )}

      {/* Direct Install Sheet when launched from Descargar App while already logged in */}
      {installSheetOpen && !isInstalled && (
        <div className="fixed inset-x-0 bottom-16 z-50 p-4 bg-[#17191f] border-t border-emerald-500/40 rounded-t-3xl shadow-2xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src="/assets/app-android-192.png" alt="Noelux Admin" className="w-11 h-11 rounded-2xl" />
              <div>
                <div className="text-sm font-bold text-white">Instalar App Android</div>
                <div className="text-xs text-zinc-400">Confirmá para descargarla en tu pantalla de inicio</div>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissInstallSheet}
              className="min-h-[36px] min-w-[36px] rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {isInstallable ? (
            <button
              type="button"
              onClick={async () => {
                const ok = await install();
                if (ok) dismissInstallSheet();
              }}
              className="w-full min-h-[48px] rounded-full bg-emerald-400 text-[#042317] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Confirmar e Instalar en tu Android
            </button>
          ) : waitingInstallPrompt ? (
            <div className="min-h-[44px] rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" /> Preparando descarga en tu celular...
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
              Si ya la instalaste o tu navegador no mostró el botón directo, tocá los <strong>3 puntitos (⋮)</strong> arriba y elegí <strong>Instalar aplicación</strong>.
            </div>
          )}
        </div>
      )}

      {/* Material 3 "Más" Bottom Sheet for All Admin Sections */}
      {showMoreSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowMoreSheet(false)}
        >
          <div
            className="w-full max-w-md bg-[#17191f] border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-zinc-600 mx-auto mb-2 sm:hidden" />
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Todos los Módulos Admin</h2>
              <button
                type="button"
                onClick={() => setShowMoreSheet(false)}
                className="text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  { id: 'productos', label: 'Productos y Ventas', icon: ShoppingBag },
                  { id: 'creador', label: 'Creador IA', icon: Sparkles },
                  { id: 'pipeboard', label: 'AutoAds', icon: Rocket },
                  { id: 'whatsapp', label: 'WhatsApp Multi-Línea', icon: Smartphone },
                  { id: 'deepgram', label: 'Deepgram Voz', icon: Zap },
                  { id: 'openrouter', label: 'Cerebro LLM', icon: Bot }
                ] as const
              ).map(item => {
                const Icon = item.icon;
                const active = activeMenu === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveMenu(item.id);
                      setShowMoreSheet(false);
                    }}
                    className={`min-h-[56px] p-3 rounded-2xl border text-left flex items-center gap-2.5 cursor-pointer transition-colors ${
                      active
                        ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
                        : 'bg-[#1f222b] border-zinc-800 text-zinc-200 hover:bg-[#262a35]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-medium leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Material 3 Bottom Navigation Bar */}
      <nav
        aria-label="Navegación Android"
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#17191f]/95 backdrop-blur-md border-t border-zinc-800 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-3xl mx-auto grid grid-cols-4 h-16 items-center px-1">
          {(
            [
              { id: 'productos', label: 'Productos', icon: ShoppingBag },
              { id: 'pipeboard', label: 'AutoAds', icon: Rocket },
              { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone }
            ] as const
          ).map(tab => {
            const Icon = tab.icon;
            const active = activeMenu === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveMenu(tab.id)}
                className="min-h-[52px] flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <div
                  className={`px-4 py-1 rounded-full transition-colors ${
                    active ? 'bg-emerald-400/20 text-emerald-300' : 'text-zinc-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-[11px] font-medium ${
                    active ? 'text-emerald-300' : 'text-zinc-400'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowMoreSheet(true)}
            className="min-h-[52px] flex flex-col items-center justify-center gap-1 cursor-pointer"
          >
            <div
              className={`px-4 py-1 rounded-full transition-colors ${
                ['creador', 'deepgram', 'openrouter'].includes(activeMenu)
                  ? 'bg-emerald-400/20 text-emerald-300'
                  : 'text-zinc-400'
              }`}
            >
              <LayoutGrid className="w-5 h-5" />
            </div>
            <span
              className={`text-[11px] font-medium ${
                ['creador', 'deepgram', 'openrouter'].includes(activeMenu)
                  ? 'text-emerald-300'
                  : 'text-zinc-400'
              }`}
            >
              Menú
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
};
