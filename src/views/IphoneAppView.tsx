import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  LogOut,
  Package,
  RefreshCw,
  Search,
  MessageCircle,
  Phone,
  MapPin,
  Share,
  PlusSquare,
  X,
  Delete,
  Eye,
  EyeOff
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Order, ProductPage } from '../types';
import {
  formatGuaraniesCompact,
  getOrderStatusLabel,
  getOrdersForProductPage
} from '../utils/mobileOrderHelpers';
import { MobileWhatsAppSyncPanel } from '../components/MobileWhatsAppSyncPanel';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

const IOS_UNLOCK_SESSION_KEY = 'noelux_ios_pin_unlocked_v1';

export const IphoneAppView: React.FC = () => {
  const { productPages, orders, refreshOrders, loginAdmin, logoutAdmin } = useStore();
  const isOnline = useOnlineStatus();
  const { isInstalled } = usePWAInstall();

  const [authStep, setAuthStep] = useState<'credentials' | 'pin' | 'unlocked'>(() => {
    try {
      return window.sessionStorage.getItem(IOS_UNLOCK_SESSION_KEY) === 'true'
        ? 'unlocked'
        : 'credentials';
    } catch {
      return 'credentials';
    }
  });

  // Step 1: Credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credLoading, setCredLoading] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);

  // Step 2: 4-digit PIN state
  const [pinDigits, setPinDigits] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinChecking, setPinChecking] = useState(false);

  // Unlocked iPhone navigation
  const [activeTab, setActiveTab] = useState<'productos' | 'whatsapp'>('productos');
  const [selectedProduct, setSelectedProduct] = useState<ProductPage | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<'todos' | 'confirmados' | 'pendientes'>('todos');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    if (authStep === 'unlocked') {
      refreshOrders().catch(() => {});
    }
  }, [authStep]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredError(null);
    if (!email.trim() || !password.trim()) {
      setCredError('Ingresá tu usuario y contraseña para continuar.');
      return;
    }
    setCredLoading(true);
    const res = await loginAdmin(email.trim(), password.trim());
    setCredLoading(false);

    if (!res.success) {
      setCredError(res.error || 'Usuario o contraseña incorrectos.');
      return;
    }

    // Siempre exige el código PIN de 4 dígitos después de validar usuario y contraseña
    setPinDigits('');
    setPinError(null);
    setAuthStep('pin');
  };

  const verifyPinCode = async (code: string) => {
    if (code.length !== 4 || pinChecking) return;
    setPinChecking(true);
    setPinError(null);

    let verified = false;
    try {
      const res = await fetch('/api/admin/verify-iphone-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin: code })
      });
      if (res.ok) {
        const data = await res.json();
        verified = Boolean(data.valid);
      } else if (res.status === 404) {
        verified = code === '1982';
      }
    } catch {
      verified = code === '1982';
    }

    setPinChecking(false);

    if (!verified) {
      setPinError('Código PIN incorrecto. Intentá nuevamente.');
      setPinDigits('');
      return;
    }

    try {
      window.sessionStorage.setItem(IOS_UNLOCK_SESSION_KEY, 'true');
    } catch {}
    setAuthStep('unlocked');
    refreshOrders().catch(() => {});
  };

  const handleTapDigit = (digit: string) => {
    if (pinChecking || pinDigits.length >= 4) return;
    setPinError(null);
    const next = `${pinDigits}${digit}`;
    setPinDigits(next);
    if (next.length === 4) {
      verifyPinCode(next);
    }
  };

  const handleBackspace = () => {
    if (pinChecking || pinDigits.length === 0) return;
    setPinError(null);
    setPinDigits(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    if (authStep !== 'pin') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleTapDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [authStep, pinDigits, pinChecking]);

  const handleLockOrLogout = async () => {
    try {
      window.sessionStorage.removeItem(IOS_UNLOCK_SESSION_KEY);
    } catch {}
    setPinDigits('');
    setPinError(null);
    setSelectedProduct(null);
    setSelectedOrder(null);
    setAuthStep('credentials');
    await logoutAdmin();
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await refreshOrders().catch(() => {});
    setRefreshing(false);
  };

  const currentProductOrders = useMemo(() => {
    if (!selectedProduct) return [];
    const base = getOrdersForProductPage(orders, selectedProduct, productPages);
    const q = orderSearch.trim().toLowerCase();
    return base.filter(o => {
      const st = getOrderStatusLabel(o);
      if (orderFilter === 'confirmados' && st.tone !== 'confirmed' && st.tone !== 'delivered') {
        return false;
      }
      if (orderFilter === 'pendientes' && st.tone !== 'in_progress') {
        return false;
      }
      if (!q) return true;
      return (
        String(o.nombre || '').toLowerCase().includes(q) ||
        String(o.celular || '').toLowerCase().includes(q) ||
        String(o.ciudad || '').toLowerCase().includes(q) ||
        String(o.reservaid || '').toLowerCase().includes(q)
      );
    });
  }, [selectedProduct, orders, productPages, orderSearch, orderFilter]);

  // =========================================================
  // PANTALLA 1: LOGIN iOS (Usuario y Contraseña de la Web/DB)
  // =========================================================
  if (authStep === 'credentials') {
    return (
      <div className="min-h-screen bg-[#f2f2f7] text-[#1c1c1e] flex flex-col justify-between px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md mx-auto my-auto space-y-6">
          <div className="text-center space-y-2">
            <img
              src="/assets/app-iphone-192.png"
              alt="Noelux iPhone"
              className="w-18 h-18 rounded-[20px] mx-auto shadow-md border border-black/5"
            />
            <h1 className="text-2xl font-bold tracking-tight text-[#1c1c1e]">
              Noelux Pedidos
            </h1>
            <p className="text-sm text-[#636366]">
              Acceso iPhone · Iniciá sesión con tu cuenta
            </p>
          </div>

          <form
            onSubmit={handleCredentialsSubmit}
            className="bg-white rounded-2xl border border-black/5 shadow-xs overflow-hidden divide-y divide-black/10"
          >
            <div className="px-4 py-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93] mb-1">
                Correo / Usuario
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full text-base text-[#1c1c1e] bg-transparent outline-none placeholder-[#aeaeb2]"
                disabled={credLoading}
              />
            </div>

            <div className="px-4 py-3 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93] mb-1">
                  Contraseña
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full text-base text-[#1c1c1e] bg-transparent outline-none placeholder-[#aeaeb2]"
                  disabled={credLoading}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#8e8e93] cursor-pointer"
                aria-label="Mostrar contraseña"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="p-4 bg-[#f9f9fb]">
              {credError && (
                <p className="text-xs font-medium text-[#ff3b30] mb-3 text-center">
                  {credError}
                </p>
              )}
              <button
                type="submit"
                disabled={credLoading}
                className="w-full min-h-[48px] rounded-xl bg-[#007aff] active:bg-[#0062cc] text-white text-base font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
              >
                {credLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <span>Enviar</span>
                )}
              </button>
            </div>
          </form>

          {!isInstalled && (
            <div className="bg-white/80 rounded-2xl border border-black/5 p-3.5 text-xs text-[#636366] text-center space-y-1">
              <div className="font-semibold text-[#1c1c1e]">Instalá esta app en tu iPhone</div>
              <p className="inline-flex items-center justify-center gap-1 flex-wrap">
                En Safari tocá <Share className="w-3.5 h-3.5 text-[#007aff] inline" />{' '}
                <strong>Compartir</strong> y elegí <PlusSquare className="w-3.5 h-3.5 text-[#007aff] inline" />{' '}
                <strong>Agregar a pantalla de inicio</strong>.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================
  // PANTALLA 2: CÓDIGO PIN OBLIGATORIO DE 4 DÍGITOS (1982)
  // =========================================================
  if (authStep === 'pin') {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    return (
      <div className="min-h-screen bg-[#f2f2f7] text-[#1c1c1e] flex flex-col justify-between px-6 py-8 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-sm mx-auto my-auto flex flex-col items-center space-y-7">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#007aff]/12 text-[#007aff] flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1c1c1e]">
              Poné tu código PIN
            </h1>
            <p className="text-sm text-[#636366]">
              Ingresá el PIN de 4 números para abrir la app de iPhone
            </p>
          </div>

          {/* 4 iOS PIN Dots */}
          <div className="flex items-center justify-center gap-5 py-2" aria-label="Código PIN de 4 dígitos">
            {[0, 1, 2, 3].map(idx => {
              const filled = idx < pinDigits.length;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                    filled
                      ? 'bg-[#1c1c1e] border-[#1c1c1e] scale-110'
                      : 'bg-transparent border-[#8e8e93]'
                  }`}
                />
              );
            })}
          </div>

          {pinError ? (
            <div className="text-xs font-semibold text-[#ff3b30] text-center min-h-[20px]">
              {pinError}
            </div>
          ) : (
            <div className="text-xs text-[#8e8e93] min-h-[20px]">
              {pinChecking ? 'Verificando código...' : ' '}
            </div>
          )}

          {/* Native iOS Numeric Keypad */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-[270px]">
            {keys.map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleTapDigit(num)}
                disabled={pinChecking}
                className="w-[74px] h-[74px] mx-auto rounded-full bg-white active:bg-[#d1d1d6] border border-black/5 shadow-xs text-2xl font-semibold text-[#1c1c1e] flex items-center justify-center cursor-pointer transition-colors select-none tabular-nums"
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setAuthStep('credentials')}
              className="w-[74px] h-[74px] mx-auto rounded-full text-xs font-medium text-[#007aff] flex items-center justify-center cursor-pointer select-none"
            >
              Volver
            </button>

            <button
              type="button"
              onClick={() => handleTapDigit('0')}
              disabled={pinChecking}
              className="w-[74px] h-[74px] mx-auto rounded-full bg-white active:bg-[#d1d1d6] border border-black/5 shadow-xs text-2xl font-semibold text-[#1c1c1e] flex items-center justify-center cursor-pointer transition-colors select-none tabular-nums"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              disabled={pinChecking || pinDigits.length === 0}
              aria-label="Borrar dígito"
              className="w-[74px] h-[74px] mx-auto rounded-full text-[#1c1c1e] disabled:opacity-30 flex items-center justify-center cursor-pointer select-none"
            >
              <Delete className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // PANTALLA 3: INTERFAZ NATIVA iPHONE DESBLOQUEADA
  // (Exclusiva: Lista de Productos -> Pedidos, + WhatsApp sin QR)
  // =========================================================
  return (
    <div className="min-h-screen bg-[#f2f2f7] text-[#1c1c1e] flex flex-col">
      {/* Translucent iOS Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#f2f2f7]/85 backdrop-blur-xl border-b border-black/10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-4xl mx-auto h-13 px-3 sm:px-5 flex items-center justify-between gap-2">
          <div className="flex items-center min-w-[84px]">
            {activeTab === 'productos' && selectedProduct ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedProduct(null);
                  setOrderSearch('');
                  setOrderFilter('todos');
                }}
                className="min-h-[44px] inline-flex items-center gap-0.5 text-[#007aff] text-base font-medium cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5 -ml-1" />
                <span>Productos</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleManualRefresh}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-start text-[#007aff] cursor-pointer"
                aria-label="Actualizar"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          <div className="text-center min-w-0 flex-1">
            <span className="text-base font-semibold text-[#1c1c1e] truncate block">
              {activeTab === 'whatsapp'
                ? 'Sincronizar WhatsApp'
                : selectedProduct
                  ? selectedProduct.nombre
                  : 'Productos'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-1 min-w-[84px]">
            {!isInstalled && (
              <button
                type="button"
                onClick={() => setShowInstallBanner(prev => !prev)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#007aff] cursor-pointer"
                title="Instalar en iPhone"
              >
                <Share className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleLockOrLogout}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#ff3b30] cursor-pointer"
              title="Bloquear / Salir"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 pb-28 space-y-4">
        {!isOnline && (
          <div className="bg-[#ff9500]/15 border border-[#ff9500]/30 text-[#8a5100] rounded-xl px-4 py-2.5 text-xs font-medium">
            Sin conexión a internet. Mostrando datos guardados en caché.
          </div>
        )}

        {showInstallBanner && (
          <div className="bg-white rounded-2xl border border-black/5 p-4 text-xs text-[#636366] space-y-1.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#1c1c1e]">Instalar en Pantalla de Inicio</span>
              <button
                type="button"
                onClick={() => setShowInstallBanner(false)}
                className="text-[#007aff] font-medium cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <p>
              1. Tocá el botón <strong>Compartir</strong> en Safari. 2. Elegí{' '}
              <strong>Agregar a pantalla de inicio</strong>.
            </p>
          </div>
        )}

        {/* TAB 1: PRODUCTOS -> PEDIDOS DEL PRODUCTO */}
        {activeTab === 'productos' && !selectedProduct && (
          <div className="space-y-4">
            <div className="px-1">
              <h2 className="text-[30px] font-bold tracking-tight text-[#1c1c1e] leading-tight">
                Productos
              </h2>
              <p className="text-sm text-[#636366]">
                Tocá un producto para ver todos sus pedidos
              </p>
            </div>

            {productPages.length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/5 p-8 text-center text-sm text-[#8e8e93]">
                Todavía no hay productos registrados.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-black/5 shadow-xs overflow-hidden divide-y divide-black/8">
                {productPages.map(prod => {
                  const prodOrders = getOrdersForProductPage(orders, prod, productPages);
                  const totalGs = prodOrders.reduce((sum, o) => sum + (Number(o.monto) || 0), 0);
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => setSelectedProduct(prod)}
                      className="w-full min-h-[72px] px-4 py-3.5 flex items-center justify-between gap-3 text-left active:bg-[#e5e5ea] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {prod.imagen ? (
                          <img
                            src={prod.imagen}
                            alt={prod.nombre}
                            referrerPolicy="no-referrer"
                            className="w-13 h-13 rounded-xl object-cover bg-[#f2f2f7] border border-black/5 shrink-0"
                          />
                        ) : (
                          <div className="w-13 h-13 rounded-xl bg-[#007aff]/10 text-[#007aff] flex items-center justify-center shrink-0">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-semibold text-[#1c1c1e] truncate">
                            {prod.nombre}
                          </div>
                          <div className="text-xs text-[#636366] mt-0.5 flex items-center gap-1.5 tabular-nums">
                            <span>{prodOrders.length} pedidos</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatGuaraniesCompact(totalGs)}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#c7c7cc] shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VISTA DETALLE: TODOS LOS PEDIDOS DEL PRODUCTO SELECCIONADO */}
        {activeTab === 'productos' && selectedProduct && (
          <div className="space-y-4">
            <div className="px-1">
              <h2 className="text-2xl font-bold tracking-tight text-[#1c1c1e] leading-tight">
                Pedidos · {selectedProduct.nombre}
              </h2>
              <p className="text-xs text-[#636366] mt-0.5 tabular-nums">
                {currentProductOrders.length} pedidos mostrados
              </p>
            </div>

            {/* Search & Segmented iOS Filter */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  placeholder="Buscar por nombre, celular o ciudad"
                  className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl bg-[#e5e5ea]/80 text-sm text-[#1c1c1e] placeholder-[#8e8e93] outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#e5e5ea]">
                {(
                  [
                    { id: 'todos', label: 'Todos' },
                    { id: 'confirmados', label: 'Confirmados' },
                    { id: 'pendientes', label: 'En curso' }
                  ] as const
                ).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setOrderFilter(tab.id)}
                    className={`min-h-[34px] rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      orderFilter === tab.id
                        ? 'bg-white text-[#1c1c1e] shadow-xs'
                        : 'text-[#636366]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {currentProductOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/5 p-8 text-center text-sm text-[#8e8e93]">
                No hay pedidos para mostrar con este filtro.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-black/5 shadow-xs overflow-hidden divide-y divide-black/8">
                {currentProductOrders.map(order => {
                  const st = getOrderStatusLabel(order);
                  const toneText =
                    st.tone === 'confirmed' || st.tone === 'delivered'
                      ? 'text-[#34c759]'
                      : st.tone === 'cancelled'
                        ? 'text-[#ff3b30]'
                        : 'text-[#ff9500]';
                  return (
                    <button
                      key={order.reservaid}
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left active:bg-[#e5e5ea] transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-base font-semibold text-[#1c1c1e] truncate">
                            {order.nombre || 'Cliente'}
                          </span>
                          <span className="text-sm font-semibold text-[#1c1c1e] tabular-nums shrink-0">
                            {formatGuaraniesCompact(order.monto)}
                          </span>
                        </div>
                        <div className="text-xs text-[#636366] truncate">
                          {order.ciudad || 'Paraguay'} · {order.celular || ''}
                        </div>
                        <div className={`text-xs font-medium ${toneText}`}>
                          {st.label} · {order.cantidad || 1} un.
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#c7c7cc] shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SINCRONIZAR WHATSAPP (SIN ESCANEAR QR) */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-4">
            <div className="px-1">
              <h2 className="text-[28px] font-bold tracking-tight text-[#1c1c1e] leading-tight">
                WhatsApp
              </h2>
              <p className="text-sm text-[#636366]">
                Vinculá tu WhatsApp desde este iPhone sin escanear QR
              </p>
            </div>
            <MobileWhatsAppSyncPanel platform="ios" defaultLabel="WhatsApp iPhone" />
          </div>
        )}
      </main>

      {/* Bottom iOS Sheet for Selected Order Details */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="w-full max-w-lg bg-[#f2f2f7] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="pt-2.5 pb-1 flex justify-center sm:hidden">
              <div className="w-10 h-1.5 rounded-full bg-[#c7c7cc]" />
            </div>
            <div className="px-5 py-3 flex items-center justify-between border-b border-black/10 bg-white">
              <div className="min-w-0">
                <div className="text-xs text-[#8e8e93] font-mono">{selectedOrder.reservaid}</div>
                <h3 className="text-lg font-bold text-[#1c1c1e] truncate">
                  {selectedOrder.nombre}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="min-h-[40px] min-w-[40px] rounded-full bg-[#e5e5ea] text-[#636366] flex items-center justify-center cursor-pointer"
                aria-label="Cerrar detalle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="bg-white rounded-2xl border border-black/5 divide-y divide-black/8 text-sm">
                <div className="px-4 py-3 flex justify-between gap-3">
                  <span className="text-[#636366]">Estado</span>
                  <span className="font-semibold text-[#1c1c1e]">
                    {getOrderStatusLabel(selectedOrder).label}
                  </span>
                </div>
                <div className="px-4 py-3 flex justify-between gap-3">
                  <span className="text-[#636366]">Pack y Total</span>
                  <span className="font-semibold text-[#1c1c1e] tabular-nums">
                    {selectedOrder.cantidad || 1} un. · {formatGuaraniesCompact(selectedOrder.monto)}
                  </span>
                </div>
                <div className="px-4 py-3 flex justify-between gap-3">
                  <span className="text-[#636366]">Celular</span>
                  <span className="font-mono font-medium text-[#1c1c1e]">
                    {selectedOrder.celular}
                  </span>
                </div>
                <div className="px-4 py-3 space-y-1">
                  <div className="text-[#636366] text-xs">Dirección de entrega</div>
                  <div className="font-medium text-[#1c1c1e]">
                    {selectedOrder.ciudad}
                    {selectedOrder.departamento ? ` (${selectedOrder.departamento})` : ''}
                  </div>
                  <div className="text-xs text-[#636366]">{selectedOrder.direccion}</div>
                  {selectedOrder.referenciaCasa && (
                    <div className="text-xs text-[#007aff] pt-1">
                      Referencia: {selectedOrder.referenciaCasa}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {selectedOrder.celular && (
                  <a
                    href={`tel:${String(selectedOrder.celular).replace(/\s+/g, '')}`}
                    className="min-h-[46px] rounded-xl bg-white border border-black/10 text-[#007aff] text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <Phone className="w-4 h-4" /> Llamar
                  </a>
                )}
                {selectedOrder.gpsLink && (
                  <a
                    href={selectedOrder.gpsLink}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[46px] rounded-xl bg-[#007aff] text-white text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <MapPin className="w-4 h-4" /> Ver Mapa
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* iOS Bottom Tab Bar */}
      <nav
        aria-label="Navegación iPhone"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-black/10 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-4xl mx-auto grid grid-cols-2 h-15 items-center">
          <button
            type="button"
            onClick={() => setActiveTab('productos')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activeTab === 'productos' ? 'text-[#007aff]' : 'text-[#8e8e93]'
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[11px] font-medium">Productos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activeTab === 'whatsapp' ? 'text-[#007aff]' : 'text-[#8e8e93]'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-[11px] font-medium">WhatsApp</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
