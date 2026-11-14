import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { OrderForm } from './OrderForm';

const CTA_PEDIR_AHORA_BUTTON_IMAGE = '/assets/pedir-ahora-cta.png';

/**
 * Página Visual E-Commerce 100% Pura:
 * - Cero botones HTML estilizados ni bloques HTML de texto alrededor de los botones.
 * - Todas las descripciones, tarjetas de precio lujosas, ruptura "¡ESPERÁ!" y guía paso a paso
 *   apuntando al botón "¡PEDIR AHORA!" + botón de GPS forman parte del diseño de las láminas.
 * - Tanto el botón del Gancho (Entrada) como el del Producto Principal usan directamente la imagen
 *   oficial "¡PEDIR AHORA!" con vibración periódica tipo terremoto para máxima atención visual.
 */
export const VisualProductLanding: React.FC<{ entryFocusedMode?: boolean }> = () => {
  const {
    currentProductPage,
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

      if (maxScrollable <= 40 && loadedSheetsCount >= Math.max(1, totalSheetsCount)) {
        setBottomCtaVisible(true);
        return;
      }

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

  const entryName = trip?.entryProductName || 'Artículo Seleccionado';
  const firstSheet = vis.sheets[0];
  const secondPartSheets = vis.sheets.length > 1 ? vis.sheets.slice(1) : [];

  const renderImageButton = (testId: string, onClick: () => void) => (
    <div className="px-1 sm:px-2 py-3.5 sm:py-4 bg-[#ffffff]">
      <button
        type="button"
        data-testid={testId}
        onClick={onClick}
        aria-label="¡PEDIR AHORA! Completa tus datos y recibe tu pedido en casa"
        className="block w-full max-w-full mx-auto bg-transparent border-0 p-0 cursor-pointer focus:outline-none animate-cta-earthquake active:scale-[0.97] active:translate-y-1 transition-transform duration-150"
      >
        <img
          src={CTA_PEDIR_AHORA_BUTTON_IMAGE}
          alt="¡PEDIR AHORA! Completa tus datos y recibe tu pedido en casa · 7 días de garantía · Envío a todo Paraguay · Pago contra entrega"
          draggable={false}
          className="w-full h-auto block select-none pointer-events-none drop-shadow-[0_10px_18px_rgba(0,0,0,0.22)]"
        />
      </button>
    </div>
  );

  return (
    <div
      data-testid="visual-product-landing"
      className="w-full min-h-screen bg-white text-slate-900"
    >
      <div className="w-full max-w-[560px] mx-auto bg-white">
        {hasEntryHook ? (
          <>
            {/* BLOQUE 1: LÁMINA 1 (DISEÑO COMPLETO + TARJETA LUJOSA + GUÍA GPS) + BOTÓN IMAGEN ¡PEDIR AHORA! */}
            <section data-testid="landing-hook-section" className="w-full">
              <img
                src={firstSheet.imageUrl}
                alt={firstSheet.title || entryName}
                referrerPolicy="no-referrer"
                loading="eager"
                onLoad={() => setLoadedSheetsCount((c) => c + 1)}
                onError={() => setLoadedSheetsCount((c) => c + 1)}
                className="w-full h-auto block object-cover"
              />

              {renderImageButton('landing-btn-entry-only', () =>
                openPurchaseOrderForm('entry_only', 1)
              )}
            </section>

            {/* BLOQUE 2: LÁMINAS 2..N (RUPTURA ¡ESPERÁ! ROJO/AMARILLO + CARTA DE VENTA COMPLETA + GUÍA GPS) + BOTÓN IMAGEN ¡PEDIR AHORA! */}
            <section data-testid="landing-principal-section" className="w-full">
              {secondPartSheets.map((sheet, idx) => (
                <img
                  key={sheet.id || idx}
                  src={sheet.imageUrl}
                  alt={sheet.title || `${currentProductPage.nombre} sección ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  loading="eager"
                  onLoad={() => setLoadedSheetsCount((c) => c + 1)}
                  onError={() => setLoadedSheetsCount((c) => c + 1)}
                  className="w-full h-auto block object-cover"
                />
              ))}

              <div
                ref={bottomSentinelRef}
                data-testid="landing-bottom-cta-reveal"
                className={`transition-all duration-300 ${
                  bottomCtaVisible
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4 pointer-events-none'
                }`}
              >
                {renderImageButton('landing-btn-principal-bundle', () =>
                  openPurchaseOrderForm('principal_bundle', 1)
                )}
              </div>
            </section>
          </>
        ) : (
          /* MODO ESTÁNDAR: LÁMINAS COMPLETAS + BOTÓN IMAGEN ¡PEDIR AHORA! AL FINAL */
          <section className="w-full">
            {vis.sheets.map((sheet, idx) => (
              <img
                key={sheet.id || idx}
                src={sheet.imageUrl}
                alt={sheet.title || `${currentProductPage.nombre} sección ${idx + 1}`}
                referrerPolicy="no-referrer"
                loading="eager"
                onLoad={() => setLoadedSheetsCount((c) => c + 1)}
                onError={() => setLoadedSheetsCount((c) => c + 1)}
                className="w-full h-auto block object-cover"
              />
            ))}

            <div ref={bottomSentinelRef}>
              {renderImageButton('landing-btn-principal-bundle', () =>
                openPurchaseOrderForm('principal_bundle', 1)
              )}
            </div>
          </section>
        )}
      </div>

      {/* FORMULARIO: SOLO EN MODAL AL TOCAR EL BOTÓN ¡PEDIR AHORA! (CON BOTÓN DE GPS) */}
      <OrderForm
        expressDirectMode
        modalOnly
        hidePrincipalUpgradeHint={hasEntryHook && purchasePath === 'entry_only'}
      />
    </div>
  );
};
