import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ShoppingBag } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';
import { OrderForm } from './OrderForm';

/**
 * Página Visual Pura E-Commerce:
 * - Cero bloques HTML intermedios ni descripciones en los botones.
 * - Modo Tripwire + Principal:
 *   1. Imagen 1 (Paleta clara cobalto/blanco) + Botón #1 VIP anclado al pie de Imagen 1 (sin sticky invasivo).
 *   2. Imagen 2+ (Paleta opuesta oscura obsidiana/esmeralda/oro con ruptura brusca generada dentro)
 *      + Botón #2 VIP que permanece oculto y aparece recién cuando el usuario baja hasta el final de la página.
 * - Modo Estándar: Láminas generadas + Botón VIP al final.
 */
export const VisualProductLanding: React.FC<{ entryFocusedMode?: boolean }> = () => {
  const {
    currentProductPage,
    selectedPack,
    purchasePath,
    openPurchaseOrderForm
  } = useStore();

  const [bottomCtaVisible, setBottomCtaVisible] = useState(false);
  const [loadedSheetsCount, setLoadedSheetsCount] = useState(0);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  const vis = currentProductPage?.visualLanding;
  const trip = currentProductPage?.tripwireConfig;
  const hasEntryHook = Boolean(trip?.enabled && trip?.entryProductName);
  const totalSheetsCount = Array.isArray(vis?.sheets) ? vis.sheets.length : 0;

  useEffect(() => {
    setBottomCtaVisible(false);
    setLoadedSheetsCount(0);
  }, [currentProductPage?.id, hasEntryHook]);

  useEffect(() => {
    const el = bottomSentinelRef.current;
    if (!el) return;

    const evaluateBottomReveal = () => {
      const docHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const maxScrollable = Math.max(0, docHeight - viewportHeight);
      const scrolledBottom = window.scrollY + viewportHeight;
      const rect = el.getBoundingClientRect();

      // Si no existe scroll posible en pantalla ultra alta (una vez cargadas las láminas), mostrar al pie
      if (maxScrollable <= 40 && loadedSheetsCount >= Math.max(1, totalSheetsCount)) {
        setBottomCtaVisible(true);
        return;
      }

      // Exigir que el usuario haya bajado de verdad hasta la parte inferior de la página
      const minScrollThreshold = Math.max(180, maxScrollable * 0.65);
      const hasScrolledDeep = window.scrollY >= minScrollThreshold;
      const reachedBottom = rect.top <= viewportHeight - 10 || scrolledBottom >= docHeight - 120;

      if (hasScrolledDeep && reachedBottom) {
        setBottomCtaVisible(true);
      } else if (window.scrollY < Math.max(80, minScrollThreshold * 0.5)) {
        setBottomCtaVisible(false);
      }
    };

    evaluateBottomReveal();

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(() => evaluateBottomReveal(), { threshold: [0, 0.1, 0.5] })
        : null;
    observer?.observe(el);

    window.addEventListener('scroll', evaluateBottomReveal, { passive: true });
    window.addEventListener('resize', evaluateBottomReveal, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', evaluateBottomReveal);
      window.removeEventListener('resize', evaluateBottomReveal);
    };
  }, [currentProductPage?.id, hasEntryHook, loadedSheetsCount, totalSheetsCount]);

  if (!currentProductPage || !vis?.enabled || !Array.isArray(vis.sheets) || vis.sheets.length === 0) {
    return null;
  }

  const effectivePack = selectedPack > 0 ? selectedPack : 1;
  const price1 = Number(currentProductPage.precios?.[1] || currentProductPage.precioNormal || 189000);
  const price2 = Number(currentProductPage.precios?.[2] || Math.round(price1 * 1.85));
  const price3 = Number(currentProductPage.precios?.[3] || Math.round(price1 * 2.65));
  const activeBundlePrice = effectivePack === 3 ? price3 : effectivePack === 2 ? price2 : price1;

  const entryName = trip?.entryProductName || 'Artículo de Entrada';
  const entryPrice = Number(trip?.entryPriceGs ?? trip?.entryProductPriceGs ?? 20000);

  const firstSheet = vis.sheets[0];
  const secondPartSheets = vis.sheets.length > 1 ? vis.sheets.slice(1) : [];

  return (
    <div
      data-testid="visual-product-landing"
      className="w-full min-h-screen bg-[#06080d] text-white"
    >
      <div className="w-full max-w-[560px] mx-auto bg-[#06080d] shadow-[0_0_80px_rgba(0,0,0,0.9)]">
        {hasEntryHook ? (
          <>
            {/* BLOQUE 1: IMAGEN 1 + BOTÓN #1 ANCLADO JUSTO DEBAJO DE LA FLECHA */}
            <section data-testid="landing-hook-section" className="w-full">
              <img
                src={firstSheet.imageUrl}
                alt={firstSheet.title || entryName}
                referrerPolicy="no-referrer"
                loading="eager"
                onLoad={() => setLoadedSheetsCount((c) => c + 1)}
                className="w-full h-auto block object-cover"
              />

              <div className="px-4 py-4 bg-[#070a12]">
                <button
                  type="button"
                  data-testid="landing-btn-entry-only"
                  onClick={() => openPurchaseOrderForm('entry_only', 1)}
                  className="group w-full py-4 px-5 rounded-2xl bg-gradient-to-b from-[#ffd35c] via-[#f5a623] to-[#d97706] hover:from-[#ffe082] hover:to-[#e08209] text-[#1a0e00] border border-[#fef08a] shadow-[inset_0_2px_0_rgba(255,255,255,0.75),0_7px_0_#92400e,0_16px_36px_rgba(245,158,11,0.38)] active:translate-y-1 active:shadow-[0_2px_0_#92400e] cursor-pointer transition-all duration-150 flex items-center justify-between gap-3"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2 className="w-5 h-5 shrink-0 stroke-[2.5]" />
                    <span className="text-base sm:text-lg font-extrabold tracking-tight truncate">
                      Separar ahora
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0 bg-[#1a0e00] text-[#fde047] px-3 py-1 rounded-xl text-sm sm:text-base font-extrabold tabular-nums">
                    {formatGs(entryPrice)}
                    <ArrowRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </button>
              </div>
            </section>

            {/* BLOQUE 2: IMAGEN 2+ + BOTÓN #2 QUE APARECE RECIÉN AL LLEGAR BIEN ABAJO */}
            <section data-testid="landing-principal-section" className="w-full">
              {secondPartSheets.map((sheet, idx) => (
                <img
                  key={sheet.id || idx}
                  src={sheet.imageUrl}
                  alt={sheet.title || `${currentProductPage.nombre} presentación ${idx + 2}`}
                  referrerPolicy="no-referrer"
                  loading="eager"
                  onLoad={() => setLoadedSheetsCount((c) => c + 1)}
                  className="w-full h-auto block object-cover"
                />
              ))}

              <div
                ref={bottomSentinelRef}
                data-testid="landing-bottom-cta-reveal"
                className={`px-4 py-5 bg-[#06090f] transition-all duration-300 ${
                  bottomCtaVisible
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4 pointer-events-none'
                }`}
              >
                <button
                  type="button"
                  data-testid="landing-btn-principal-bundle"
                  onClick={() => openPurchaseOrderForm('principal_bundle', 1)}
                  className="group w-full py-4 px-5 rounded-2xl bg-gradient-to-b from-[#2be077] via-[#12b857] to-[#0b843c] hover:from-[#3be884] hover:to-[#109846] text-white border border-[#86efac]/80 shadow-[inset_0_2px_0_rgba(255,255,255,0.45),0_7px_0_#064e27,0_18px_38px_rgba(16,185,84,0.42)] active:translate-y-1 active:shadow-[0_2px_0_#064e27] cursor-pointer transition-all duration-150 flex items-center justify-between gap-3"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <ShoppingBag className="w-5 h-5 shrink-0 stroke-[2.5]" />
                    <span className="text-base sm:text-lg font-extrabold tracking-tight truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
                      Solicitar oferta completa
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0 bg-[#052e16] text-[#fef08a] px-3 py-1 rounded-xl text-sm sm:text-base font-extrabold tabular-nums border border-[#86efac]/35">
                    {formatGs(activeBundlePrice)}
                    <ArrowRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </button>
              </div>
            </section>
          </>
        ) : (
          /* MODO ESTÁNDAR: LÁMINAS E-COMMERCE + BOTÓN VIP AL FINAL */
          <section className="w-full">
            {vis.sheets.map((sheet, idx) => (
              <img
                key={sheet.id || idx}
                src={sheet.imageUrl}
                alt={sheet.title || `${currentProductPage.nombre} vista ${idx + 1}`}
                referrerPolicy="no-referrer"
                loading="eager"
                onLoad={() => setLoadedSheetsCount((c) => c + 1)}
                className="w-full h-auto block object-cover"
              />
            ))}

            <div ref={bottomSentinelRef} className="px-4 py-5 bg-[#070a12]">
              <button
                type="button"
                data-testid="landing-btn-principal-bundle"
                onClick={() => openPurchaseOrderForm('principal_bundle', 1)}
                className="group w-full py-4 px-5 rounded-2xl bg-gradient-to-b from-[#ffd35c] via-[#f5a623] to-[#d97706] hover:from-[#ffe082] hover:to-[#e08209] text-[#1a0e00] border border-[#fef08a] shadow-[inset_0_2px_0_rgba(255,255,255,0.75),0_7px_0_#92400e,0_16px_36px_rgba(245,158,11,0.38)] active:translate-y-1 active:shadow-[0_2px_0_#92400e] cursor-pointer transition-all duration-150 flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <ShoppingBag className="w-5 h-5 shrink-0 stroke-[2.5]" />
                  <span className="text-base sm:text-lg font-extrabold tracking-tight truncate">
                    Solicitar ahora
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0 bg-[#1a0e00] text-[#fde047] px-3 py-1 rounded-xl text-sm sm:text-base font-extrabold tabular-nums">
                  {formatGs(activeBundlePrice)}
                  <ArrowRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
                </span>
              </button>
            </div>
          </section>
        )}
      </div>

      {/* FORMULARIO: SOLO EN MODAL AL TOCAR UN BOTÓN */}
      <OrderForm
        expressDirectMode
        modalOnly
        hidePrincipalUpgradeHint={hasEntryHook && purchasePath === 'entry_only'}
      />
    </div>
  );
};
