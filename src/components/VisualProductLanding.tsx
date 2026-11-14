import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, Check } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';
import { OrderForm } from './OrderForm';

/**
 * Full-bleed Visual Landing Page for GPT-2.6 Generated Products.
 * Zero intermediary HTML clutter: displays edge-to-edge graphic sheets covering the viewport.
 * On Tripwire pages, visitors land 100% on the entry offer at the top; as they scroll down through
 * the gradual warming sheet toward the climax sheet, the Principal Product Offer reveals cleanly.
 */
export const VisualProductLanding: React.FC<{ entryFocusedMode?: boolean }> = ({
  entryFocusedMode = false
}) => {
  const {
    currentProductPage,
    selectedPack,
    setSelectedPack,
    purchasePath,
    setPurchasePath
  } = useStore();

  const vis = currentProductPage?.visualLanding;
  const trip = currentProductPage?.tripwireConfig;
  const hasEntryHook = Boolean(trip?.enabled && trip?.entryProductName);

  const revealSheetRef = useRef<HTMLDivElement | null>(null);
  const [principalRevealed, setPrincipalRevealed] = useState<boolean>(() => !hasEntryHook);

  // Al aterrizar en cualquier Página Tripwire, iniciar siempre en el Gancho de Entrada (sin spoilear el Principal arriba)
  useEffect(() => {
    if (!hasEntryHook) {
      setPrincipalRevealed(true);
      return;
    }
    setPrincipalRevealed(false);
    setPurchasePath('entry_only');
    setSelectedPack(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProductPage?.id, hasEntryHook]);

  // Revelar la Oferta Principal recién cuando el usuario baja hacia la zona de calentamiento / explosión final
  useEffect(() => {
    if (!hasEntryHook || principalRevealed) return;

    const checkReveal = () => {
      const targetEl = revealSheetRef.current;
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.78 && window.scrollY > 120) {
          setPrincipalRevealed(true);
          return;
        }
      }
      if (window.scrollY > 420) {
        setPrincipalRevealed(true);
      }
    };

    window.addEventListener('scroll', checkReveal, { passive: true });
    const observer =
      typeof IntersectionObserver !== 'undefined' && revealSheetRef.current
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((e) => e.isIntersecting) && window.scrollY > 80) {
                setPrincipalRevealed(true);
              }
            },
            { threshold: 0.15 }
          )
        : null;
    if (observer && revealSheetRef.current) {
      observer.observe(revealSheetRef.current);
    }

    return () => {
      window.removeEventListener('scroll', checkReveal);
      observer?.disconnect();
    };
  }, [hasEntryHook, principalRevealed, currentProductPage?.id]);

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

  const isEntrySelected = hasEntryHook && purchasePath === 'entry_only';
  const revealIndex = vis.sheets.length >= 3 ? vis.sheets.length - 1 : Math.max(0, vis.sheets.length - 1);

  const scrollToForm = () => {
    const formEl = document.getElementById('pedido');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToWarming = () => {
    if (revealSheetRef.current) {
      revealSheetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollBy({ top: Math.round(window.innerHeight * 0.75), behavior: 'smooth' });
    }
  };

  const selectEntryOffer = () => {
    setPurchasePath('entry_only');
    setSelectedPack(1);
    scrollToForm();
  };

  const selectWinnerBundle = () => {
    setPrincipalRevealed(true);
    setPurchasePath('principal_bundle');
    if (effectivePack < 1) setSelectedPack(1);
    scrollToForm();
  };

  const showPrincipalCard = hasEntryHook && (principalRevealed || purchasePath === 'principal_bundle');

  return (
    <div
      data-testid="visual-product-landing"
      className="w-full min-h-screen bg-[#06080d] lg:grid lg:grid-cols-12 items-start"
    >
      {/* LADO IZQUIERDO (O COMPLETO EN MÓVIL): LÁMINAS GPT-2.6 BORDE A BORDE SIN CÓDIGO HTML INTERMEDIO */}
      <div className="lg:col-span-7 w-full bg-black">
        <div className="w-full flex flex-col">
          {vis.sheets.map((sheet, idx) => (
            <div
              key={sheet.id || idx}
              ref={idx === revealIndex ? revealSheetRef : undefined}
              className="w-full"
            >
              <img
                src={sheet.imageUrl}
                alt={sheet.title || `${currentProductPage.nombre} vista ${idx + 1}`}
                referrerPolicy="no-referrer"
                loading={idx === 0 ? 'eager' : 'lazy'}
                className="w-full h-auto block object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      {/* LADO DERECHO (STICKY EN DESKTOP / ABAJO EN MÓVIL): SELECTOR PROGRESIVO + FORMULARIO ABIERTO */}
      <aside className="lg:col-span-5 w-full bg-[#06080d] lg:sticky lg:top-0 lg:min-h-screen lg:max-h-screen lg:overflow-y-auto lg:border-l lg:border-white/10 px-3 py-5 sm:px-6 sm:py-7 space-y-5">
        <div className="max-w-xl mx-auto space-y-3">
          {hasEntryHook ? (
            <div
              className={`flex flex-col gap-2.5 ${
                showPrincipalCard && !entryFocusedMode ? 'flex-col-reverse' : ''
              }`}
            >
              <button
                type="button"
                data-testid="landing-btn-entry-only"
                onClick={selectEntryOffer}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isEntrySelected
                    ? 'bg-[#e5c88b] text-[#090b10] border-[#f4dfb0] shadow-lg'
                    : 'bg-[#0e121c] hover:bg-[#141926] text-white border-white/15'
                }`}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm sm:text-base font-extrabold leading-snug">
                    {vis.entryButtonLabel || `Solicitar ${entryName}`}
                  </div>
                  <div
                    className={`text-xs ${
                      isEntrySelected ? 'text-[#090b10]/80 font-semibold' : 'text-zinc-400'
                    }`}
                  >
                    Oferta promocional de entrada · Solicitud directa
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="font-mono tabular-nums font-black text-base sm:text-lg">
                    {formatGs(entryPrice)}
                  </span>
                  {isEntrySelected && <Check className="w-5 h-5 shrink-0" />}
                </div>
              </button>

              {showPrincipalCard ? (
                <button
                  type="button"
                  data-testid="landing-btn-principal-bundle"
                  onClick={selectWinnerBundle}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    !isEntrySelected
                      ? 'bg-emerald-500 text-[#041a12] border-emerald-300 shadow-lg'
                      : 'bg-[#0b1f17] hover:bg-[#0f291e] text-white border-emerald-700/50'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm sm:text-base font-extrabold leading-snug">
                      {vis.bundleButtonLabel ||
                        `Solicitar ${currentProductPage.nombre} + ${entryName} DE REGALO`}
                    </div>
                    <div
                      className={`text-xs ${
                        !isEntrySelected ? 'text-[#041a12]/85 font-semibold' : 'text-emerald-200/80'
                      }`}
                    >
                      Incluye {entryName} GRATIS · Envío Gratis en todo Paraguay
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="font-mono tabular-nums font-black text-base sm:text-lg">
                      {formatGs(activeBundlePrice)}
                    </span>
                    {!isEntrySelected && <Check className="w-5 h-5 shrink-0" />}
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={scrollToWarming}
                  className="w-full py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>Deslizá hacia abajo para ver la presentación completa</span>
                  <ArrowDown className="w-3.5 h-3.5 shrink-0" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              data-testid="landing-btn-principal-bundle"
              onClick={selectWinnerBundle}
              className="w-full text-left p-4 rounded-2xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] border border-[#f4dfb0] transition-all cursor-pointer flex items-center justify-between gap-3"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="text-sm sm:text-base font-extrabold leading-snug">
                  {vis.bundleButtonLabel || `Solicitar ${currentProductPage.nombre}`}
                </div>
                <div className="text-xs font-semibold text-[#090b10]/80 flex items-center gap-1.5">
                  <span>Envío Gratis a todo Paraguay · Pagás recién al recibir</span>
                  <ArrowDown className="w-3.5 h-3.5 shrink-0" />
                </div>
              </div>
              <span className="font-mono tabular-nums font-black text-lg shrink-0">
                {formatGs(activeBundlePrice)}
              </span>
            </button>
          )}
        </div>

        {/* FORMULARIO COMPLETAMENTE ABIERTO EN SU PROPIO ESPACIO */}
        <OrderForm
          expressDirectMode
          hidePrincipalUpgradeHint={hasEntryHook && !showPrincipalCard}
        />
      </aside>
    </div>
  );
};
