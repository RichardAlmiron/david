import React, { useEffect, Suspense, lazy } from 'react';
import { useStore } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { VisualProductLanding } from './components/VisualProductLanding';
import { EntryHookLandingHero } from './components/EntryHookLandingHero';
import { InteractiveShowcase } from './components/InteractiveShowcase';
import { TestimonialsSection } from './components/TestimonialsSection';
import { FaqSection } from './components/FaqSection';
import { OrderForm } from './components/OrderForm';
import { CartDrawer } from './components/CartDrawer';
import { ViralModal } from './components/ViralModal';
import { PoliciesModal } from './components/PoliciesModal';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { MapCorrectionModal } from './components/MapCorrectionModal';
import { Footer } from './components/Footer';
import { formatGs } from './config';
import { trackMetaFullFunnelEvent } from './utils/metaPixelEngine';

const AdminView = lazy(() => import('./views/AdminView').then(m => ({ default: m.AdminView })));
const AdminLoginView = lazy(() => import('./views/AdminLoginView').then(m => ({ default: m.AdminLoginView })));
const RepartoView = lazy(() => import('./views/RepartoView').then(m => ({ default: m.RepartoView })));
const PromoterView = lazy(() => import('./views/PromoterView').then(m => ({ default: m.PromoterView })));
const AndroidAppView = lazy(() => import('./views/AndroidAppView').then(m => ({ default: m.AndroidAppView })));
const IphoneAppView = lazy(() => import('./views/IphoneAppView').then(m => ({ default: m.IphoneAppView })));

export const AppContent: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    isAdminAuthenticated,
    currentProductPage,
    setCurrentProductPage,
    productPages,
    config
  } = useStore();
  const pageBgClass = currentProductPage?.themeConfig?.pageBg || 'bg-stone-50';

  // Disparo automático de Eventos Meta Pixel + Servidor CAPI (PageView, ViewContent, Tiempo en Página y Scroll Profundo)
  useEffect(() => {
    if (currentView !== 'store' || !currentProductPage) return;

    trackMetaFullFunnelEvent({
      eventName: 'PageView',
      product: currentProductPage,
      globalPixelId: config.pixelId,
      packQuantity: 1,
      valueGs: currentProductPage.precios?.[1] || 189000
    });

    trackMetaFullFunnelEvent({
      eventName: 'ViewContent',
      product: currentProductPage,
      globalPixelId: config.pixelId,
      packQuantity: 1,
      valueGs: currentProductPage.precios?.[1] || 189000
    });

    const timer15 = window.setTimeout(() => {
      trackMetaFullFunnelEvent({
        eventName: 'EngagedVisitor',
        product: currentProductPage,
        globalPixelId: config.pixelId,
        extraCustomData: { dwell_seconds: 15, engagement_tier: '15s_active_reader' }
      });
    }, 15000);

    const timer45 = window.setTimeout(() => {
      trackMetaFullFunnelEvent({
        eventName: 'EngagedVisitor',
        product: currentProductPage,
        globalPixelId: config.pixelId,
        extraCustomData: { dwell_seconds: 45, engagement_tier: '45s_high_intent_buyer' }
      });
    }, 45000);

    let fired50 = false;
    let fired80 = false;
    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const pct = Math.round((window.scrollY / docHeight) * 100);
      if (pct >= 50 && !fired50) {
        fired50 = true;
        trackMetaFullFunnelEvent({
          eventName: 'DeepScroll',
          product: currentProductPage,
          globalPixelId: config.pixelId,
          extraCustomData: { scroll_percent: 50 }
        });
      }
      if (pct >= 80 && !fired80) {
        fired80 = true;
        trackMetaFullFunnelEvent({
          eventName: 'DeepScroll',
          product: currentProductPage,
          globalPixelId: config.pixelId,
          extraCustomData: { scroll_percent: 80 }
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.clearTimeout(timer15);
      window.clearTimeout(timer45);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [currentView, currentProductPage?.id, config.pixelId]);

  // Admin access is strictly separated and protected behind login
  if (currentView === 'admin') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white text-sm">Cargando panel...</div>}>
        {!isAdminAuthenticated ? <AdminLoginView /> : <AdminView />}
      </Suspense>
    );
  }

  if (currentView === 'reparto') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white text-sm">Cargando reparto...</div>}>
        <RepartoView />
      </Suspense>
    );
  }

  if (currentView === 'promoter') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white text-sm">Cargando promotor...</div>}>
        <PromoterView />
      </Suspense>
    );
  }

  if (currentView === 'app-android') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#111318] flex items-center justify-center text-white text-sm">Cargando App Android...</div>}>
        <AndroidAppView />
      </Suspense>
    );
  }

  if (currentView === 'app-iphone') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#f2f2f7] flex items-center justify-center text-[#1c1c1e] text-sm">Cargando App iPhone...</div>}>
        <IphoneAppView />
      </Suspense>
    );
  }

  const showAdminPreviewBar = isAdminAuthenticated;
  const searchParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isExpressCheckout = Boolean(searchParams?.get('express'));
  const isEntryLandingMode = searchParams?.get('modo') === 'entrada';

  if (isExpressCheckout) {
    const unitGs = Number(currentProductPage?.precios?.[1] || currentProductPage?.precioNormal || 0);
    return (
      <div
        data-testid="express-checkout-shell"
        className="min-h-screen bg-gradient-to-b from-[#041a12] via-[#062319] to-stone-100 flex flex-col font-sans"
      >
        <header className="bg-[#041a12] border-b border-emerald-500/30 px-4 py-3 text-white">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {currentProductPage?.imagen && (
                <img
                  src={currentProductPage.imagen}
                  alt={currentProductPage.nombre}
                  className="w-12 h-12 rounded-xl object-cover border border-emerald-400/50 shrink-0"
                />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500 text-black text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                    ⚡ Express Chat
                  </span>
                  <span className="text-[11px] font-bold text-emerald-300 truncate">
                    Envío Gratis · Pago Contra Entrega
                  </span>
                </div>
                <h1 className="text-sm sm:text-base font-black text-white truncate mt-0.5">
                  {currentProductPage?.nombre || config.marca}
                </h1>
                {unitGs > 0 && (
                  <p className="text-xs font-extrabold text-[#ffd778]">
                    Desde {formatGs(unitGs)} · Confirmación inmediata con GPS
                  </p>
                )}
              </div>
            </div>
            {showAdminPreviewBar && (
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, '', '/#admin');
                  setCurrentView('admin');
                }}
                className="bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg shrink-0 cursor-pointer"
              >
                Admin
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 w-full">
          <OrderForm expressDirectMode />
        </main>

        <MapCorrectionModal />
      </div>
    );
  }

  // Public product page: 100% open for customers with zero barrier/authentication
  return (
    <div className={`min-h-screen ${pageBgClass} flex flex-col font-sans`}>
      {showAdminPreviewBar && currentProductPage && (
        <div
          data-testid="live-store-admin-bar"
          className="bg-[#0B0F17] text-white border-b border-slate-800 px-4 py-2 text-xs flex items-center justify-between gap-3 z-50"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="bg-emerald-600 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0">
              Página en Vivo
            </span>
            <span className="font-bold text-white truncate max-w-[220px]">{currentProductPage.nombre}</span>
            <span className="font-mono text-blue-400 hidden md:inline shrink-0">/?p={currentProductPage.slug}</span>
            {productPages.length > 1 && (
              <select
                data-testid="live-store-page-switcher"
                value={currentProductPage.id}
                onChange={e => {
                  const found = productPages.find(p => p.id === e.target.value);
                  if (found) {
                    setCurrentProductPage(found);
                    window.history.pushState({}, '', `/?p=${found.slug}`);
                  }
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-semibold cursor-pointer max-w-[260px] truncate"
              >
                {productPages.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (/?p={p.slug})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden lg:inline-block text-[11px] font-mono text-emerald-400">
              Píxel & Servidor CAPI Activos
            </span>
            <button
              type="button"
              data-testid="back-to-admin-btn"
              onClick={() => {
                window.history.pushState({}, '', '/#admin');
                setCurrentView('admin');
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
            >
              Volver al Panel Admin
            </button>
          </div>
        </div>
      )}
      {!currentProductPage?.visualLanding?.enabled && <Navbar />}
      <main className="flex-1">
        {currentProductPage?.visualLanding?.enabled ? (
          <VisualProductLanding entryFocusedMode={isEntryLandingMode} />
        ) : isEntryLandingMode && currentProductPage?.tripwireConfig?.enabled ? (
          <>
            <EntryHookLandingHero />
            <OrderForm />
            <InteractiveShowcase />
            <TestimonialsSection />
            <FaqSection />
          </>
        ) : (
          <>
            <HeroSection />
            <InteractiveShowcase />
            <TestimonialsSection />
            <OrderForm />
            <FaqSection />
          </>
        )}
      </main>
      {!currentProductPage?.visualLanding?.enabled && <Footer />}
      <CartDrawer />
      <ViralModal />
      <PoliciesModal />
      {!currentProductPage?.visualLanding?.enabled && <FloatingWhatsApp />}
      <MapCorrectionModal />
    </div>
  );
};



