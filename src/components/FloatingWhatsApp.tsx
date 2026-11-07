import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, ShoppingBag, Truck, ArrowRight, Flame } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';
import { trackMetaFullFunnelEvent } from '../utils/metaPixelEngine';

export const FloatingWhatsApp: React.FC = () => {
  const {
    config,
    selectedPack,
    setSelectedPack,
    currentProductPage,
    orderFormFullscreen,
    openOrderFormFullscreen
  } = useStore();
  const [spectacularPulse, setSpectacularPulse] = useState(false);
  const [scrollDeltaY, setScrollDeltaY] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isFormInView, setIsFormInView] = useState(false);
  const lastScrollY = useRef(0);
  const scrollTimeoutRef = useRef<number | null>(null);

  const effectivePack = selectedPack > 0 ? selectedPack : 1;
  const currentPrice =
    currentProductPage?.precios?.[effectivePack] ||
    config.lote[effectivePack] ||
    189000;
  const normalUnit = currentProductPage?.precioNormal || config.normal;
  const savings = normalUnit * effectivePack - currentPrice;

  // Hide the floating button automatically if the user scrolled into the #pedido section on the page
  useEffect(() => {
    const el = document.getElementById('pedido');
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsFormInView(Boolean(entry && entry.isIntersecting));
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [orderFormFullscreen]);

  // Periodic spectacular vibration & attention sequence every 4.2 seconds
  useEffect(() => {
    if (orderFormFullscreen || isFormInView) return;
    const interval = window.setInterval(() => {
      setSpectacularPulse(true);
      window.setTimeout(() => setSpectacularPulse(false), 1000);
    }, 4200);
    return () => window.clearInterval(interval);
  }, [orderFormFullscreen, isFormInView]);

  // Scroll-chasing physics ("que le persiga al cliente al hacer scroll")
  useEffect(() => {
    if (orderFormFullscreen) return;
    const handleScroll = () => {
      const currentY = window.scrollY;
      const diff = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      // Clamp elastic vertical lag between -7px and +7px so it feels like it's chasing the user
      const clampedDelta = Math.max(-7, Math.min(7, diff * 0.35));
      setScrollDeltaY(clampedDelta);
      setIsScrolling(true);

      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        setScrollDeltaY(0);
        setIsScrolling(false);
        // Trigger a subtle spectacular settle movement right after scroll finishes
        setSpectacularPulse(true);
        window.setTimeout(() => setSpectacularPulse(false), 950);
      }, 260);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
    };
  }, [orderFormFullscreen]);

  const handleOrderNowClick = () => {
    if (selectedPack === 0) {
      setSelectedPack(1);
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([18, 30, 25]);
      }
    } catch {}

    trackMetaFullFunnelEvent({
      eventName: 'AddToCart',
      product: currentProductPage,
      globalPixelId: config.pixelId,
      packQuantity: effectivePack,
      valueGs: currentPrice
    });

    // Open the Order Form as the Fullscreen Nucleus of Truth and hide this floating button
    openOrderFormFullscreen();
  };

  // Never render the floating button when the user is in the Order Form (fullscreen or scrolled into view)
  if (orderFormFullscreen || isFormInView) {
    return null;
  }

  return (
    <aside
      aria-label="Barra flotante de pedido rápido"
      className="fixed bottom-2.5 sm:bottom-4 left-0 right-0 z-40 px-2.5 sm:px-5 pointer-events-none flex justify-center"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <div
        style={{
          transform: `translate3d(0, ${scrollDeltaY}px, 0) scale(${isScrolling ? 1.018 : 1})`,
          transition: isScrolling
            ? 'transform 110ms cubic-bezier(0.22, 1, 0.36, 1)'
            : 'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
        className="pointer-events-auto w-full max-w-[540px] sm:max-w-[680px]"
      >
        <div
          className={`relative rounded-2xl sm:rounded-full bg-[#062319]/95 backdrop-blur-xl border-2 border-[#e8b23a] p-1.5 sm:p-2 shadow-[0_14px_38px_rgba(6,35,25,0.55),0_0_24px_rgba(30,168,86,0.32)] flex items-center justify-between gap-2 sm:gap-3 ${
            spectacularPulse ? 'animate-cta-spectacular' : 'animate-cta-float'
          }`}
        >
          {/* Outer glowing pulse aura */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-0.5 rounded-2xl sm:rounded-full border-2 border-[#25D366]/60 animate-cta-ring"
          />

          {/* Left Product Mini-Summary */}
          <div
            onClick={handleOrderNowClick}
            className="flex items-center gap-2.5 sm:gap-3.5 pl-1.5 sm:pl-3 min-w-0 cursor-pointer flex-1"
          >
            <div className="relative w-12 h-12 sm:w-13 sm:h-13 rounded-2xl overflow-hidden border-2 border-[#ffd778] bg-[#0b3d2e] shrink-0 shadow-md">
              <img
                src={currentProductPage?.imagen || '/assets/real/galeria-1.jpg'}
                alt={currentProductPage?.nombre || 'Producto'}
                className="w-full h-full object-cover"
              />
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#25D366] border-2 border-[#062319]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[#ffd778] font-black text-base sm:text-xl tracking-tight leading-none">
                  {formatGs(currentPrice)}
                </span>
                <span className="bg-white/15 border border-[#ffd778]/50 text-white text-[11px] sm:text-xs font-black px-2 py-0.5 rounded-lg uppercase leading-none">
                  {effectivePack === 1 ? '1 Unid.' : `Pack ${effectivePack}X`}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs sm:text-sm text-white font-extrabold mt-1 truncate">
                <Truck className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                <span className="truncate">Envío Gratis · Pagás al recibir</span>
              </div>
            </div>
          </div>

          {/* Interactive Vibrating & Shimmering "PEDIR AHORA" CTA Button */}
          <button
            type="button"
            onClick={handleOrderNowClick}
            aria-label="Pedir ahora contra entrega"
            className="relative overflow-hidden bg-gradient-to-r from-[#1ea856] via-[#22c55e] to-[#158a44] hover:from-[#22c55e] hover:to-[#16a34a] text-white font-black text-sm sm:text-lg px-4.5 sm:px-7 py-3.5 sm:py-4 rounded-2xl sm:rounded-full shadow-[0_4px_0_#0d5c2b,0_10px_24px_rgba(34,197,94,0.5)] active:translate-y-0.5 active:scale-95 transition-all cursor-pointer shrink-0 flex items-center gap-1.5 sm:gap-2 border-2 border-white/30 group"
          >
            {/* Golden-White Shimmer Sweep Effect */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-cta-shimmer"
            />

            <Flame className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#ffd778] fill-[#ffd778] shrink-0 animate-bounce" />
            <span className="tracking-wide uppercase whitespace-nowrap drop-shadow-xs">
              ¡Pedir Ahora!
            </span>
            <ArrowRight className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white shrink-0 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </aside>
  );
};


