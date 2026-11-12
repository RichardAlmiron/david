import React from 'react';
import { ShoppingBag, Flame, Sparkles, ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';

const APP_STORIES = [
  {
    id: 'galeria',
    label: '8 Fotos HD',
    badge: 'REAL',
    img: '/src/assets/images/noelux_fachada_jardin_1793968638764.jpg',
    ring: 'from-[#1ea856] via-[#ffd778] to-[#1ea856]'
  },
  {
    id: 'video-demostracion',
    label: 'Video Vivo',
    badge: '▶ PLAY',
    img: '/src/assets/images/noelux_panoramica_70m2_1793968658255.jpg',
    ring: 'from-[#ef4444] via-[#f59e0b] to-[#ef4444]'
  },
  {
    id: 'como-funciona',
    label: 'En 90 Seg',
    badge: 'FÁCIL',
    img: '/src/assets/images/noelux_mano_estaca_cesped_1793968644514.jpg',
    ring: 'from-[#ffd778] via-[#1ea856] to-[#ffd778]'
  },
  {
    id: 'testimonios',
    label: 'Opiniones',
    badge: '4.9 ★',
    img: '/src/assets/images/noelux_familia_fachada_1793968640573.jpg',
    ring: 'from-[#f59e0b] via-[#fde047] to-[#f59e0b]'
  },
  {
    id: 'pedido',
    label: 'Pedir Hoy',
    badge: 'GRATIS',
    img: '/src/assets/images/noelux_porche_balcon_base_1793968643055.jpg',
    ring: 'from-[#22c55e] via-[#bbf7d0] to-[#16a34a]'
  },
  {
    id: 'faq',
    label: 'Garantía',
    badge: '7 DÍAS',
    img: '/src/assets/images/noelux_lluvia_ip65_jardin_1793968651758.jpg',
    ring: 'from-[#0b3d2e] via-[#1ea856] to-[#e8b23a]'
  }
];

export const Navbar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    selectedPack,
    setCartDrawerOpen,
    openOrderFormFullscreen,
    config,
    currentProductPage
  } = useStore();

  const customLanding = currentProductPage?.landingContent;
  const customTheme = currentProductPage?.themeConfig;
  const brandDisplay = customLanding?.brandTitle || config.marca;
  const brandInitial = (brandDisplay || 'N').charAt(0).toUpperCase();
  const headerGradient = customTheme?.headerBg || 'from-[#041a12] via-[#083022] to-[#041a12]';
  const topStripClasses = customTheme?.topStripBg || 'bg-[#e8b23a] text-[#062319]';
  const ctaGradient = customTheme?.ctaGradient || 'from-[#1ea856] to-[#16a34a]';

  const dynamicStories = customLanding?.galleryItems?.length
    ? APP_STORIES.map((st, idx) => ({
        ...st,
        img: customLanding.galleryItems[idx % customLanding.galleryItems.length]?.src || st.img
      }))
    : APP_STORIES;

  const handleNavClick = (anchor: string) => {
    if (anchor === 'pedido') {
      if (currentView !== 'store') {
        setCurrentView('store');
      }
      openOrderFormFullscreen();
      return;
    }
    if (currentView !== 'store') {
      setCurrentView('store');
      setTimeout(() => {
        const el = document.getElementById(anchor);
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(anchor);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Native Mobile-App Sticky App Bar */}
      <header className={`sticky top-0 z-40 bg-gradient-to-r ${headerGradient} text-white shadow-[0_8px_28px_rgba(4,26,18,0.35)] border-b border-[#e8b23a]/35`}>
        {/* Top Live Status Strip */}
        <div className={`${topStripClasses} py-1.5 px-2 text-center font-black text-[11px] sm:text-sm tracking-tight`}>
          <div className="app-container flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap">
            <span className="inline-flex items-center gap-1 bg-black/85 text-[#ffd778] px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-black uppercase shrink-0">
              <Flame className="w-3.5 h-3.5 fill-[#ffd778]" /> {customLanding?.topBarBadge || '25% OFF HOY'}
            </span>
            <span className="font-black truncate">
              {customLanding?.topBarText || 'ENVÍO GRATIS · PAGÁS AL RECIBIR'}
            </span>
          </div>
        </div>

        {/* Main App Navigation Bar */}
        <div className="app-container h-16 sm:h-18 flex items-center justify-between gap-1.5 sm:gap-4">
          {/* App Icon & Brand */}
          <button
            onClick={() => {
              setCurrentView('store');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2 text-left group cursor-pointer focus:outline-none min-w-0"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#e8b23a] to-[#c48b16] text-[#062319] flex items-center justify-center font-black text-lg sm:text-2xl shadow-[0_3px_12px_rgba(232,178,58,0.4)] shrink-0">
              {brandInitial}
            </div>
            <div className="min-w-0">
              <div className="font-black text-white text-base sm:text-xl tracking-tight leading-none flex items-center gap-1">
                <span className="truncate">{brandDisplay}™</span>
                <span className="inline-flex items-center gap-0.5 bg-[#1ea856]/30 border border-[#25D366]/60 text-[#6ee7b7] text-[10px] sm:text-[11px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                  <ShieldCheck className="w-3 h-3 text-[#25D366]" /> OFICIAL
                </span>
              </div>
              <span className="block text-[11px] sm:text-sm font-bold text-[#ffd778] mt-0.5 truncate">
                {currentProductPage?.freeShipping === false
                  ? 'Pago en Puerta · Entrega Rápida'
                  : 'Pago en Puerta · Envío Gratis'}
              </span>
            </div>
          </button>

          {/* Right App Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Cart Button */}
            <button
              onClick={() => setCartDrawerOpen(true)}
              aria-label="Abrir carrito"
              className="relative bg-white/12 hover:bg-white/20 border border-white/25 rounded-2xl px-2.5 sm:px-3.5 py-2 sm:py-2.5 cursor-pointer font-black text-sm sm:text-base text-white inline-flex items-center gap-1.5 active:scale-95 transition-all shrink-0"
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-[#ffd778] shrink-0" />
              <span className="hidden sm:inline">Carrito</span>
              <span className="bg-[#ffd778] text-[#062319] text-xs font-black px-1.5 py-0.5 rounded-full leading-none">
                {selectedPack > 0 ? selectedPack : 1}
              </span>
            </button>

            {/* Primary Header Pedir Button */}
            {currentView === 'store' && (
              <button
                onClick={() => handleNavClick('pedido')}
                className={`inline-flex items-center gap-1 bg-gradient-to-r ${ctaGradient} text-white font-black text-xs sm:text-base px-3 sm:px-5 py-2 sm:py-2.5 rounded-2xl shadow-[0_4px_14px_rgba(34,197,94,0.45)] border border-white/25 active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap`}
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ffd778] shrink-0" />
                <span>Pedir</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Native Mobile-App "Stories / Visual Quick Launcher" Bar */}
      {currentView === 'store' && (
        <div className="bg-white border-b border-[#e2ddd2] shadow-xs">
          <div className="app-container py-3">
            <div className="flex items-center justify-between sm:justify-center gap-3 sm:gap-6 overflow-x-auto no-scrollbar px-1">
              {dynamicStories.map(story => (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => handleNavClick(story.id)}
                  className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer active:scale-95 transition-transform"
                >
                  <div className={`relative p-[3px] rounded-full bg-gradient-to-tr ${story.ring} shadow-md`}>
                    <div className="w-15 h-15 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-white bg-[#062319]">
                      <img
                        src={story.img}
                        alt={story.label}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-[#062319] text-[#ffd778] border border-[#e8b23a]/60 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                      {story.badge}
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm font-black text-stone-900 mt-1 whitespace-nowrap">
                    {story.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};



