import React from 'react';
import { MousePointerClick, ShoppingBag } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';
import { OrderForm } from './OrderForm';

/**
 * Página Visual Pura E-Commerce:
 * - Cero bloques HTML intermedios ni descripciones debajo o dentro de los botones.
 * - Modo Tripwire + Principal:
 *   1. Imagen 1 (E-Commerce Alto Impacto directo en paleta clara/azul-ámbar)
 *      + Botón #1 táctil 3D limpio (fluctúa mientras ves Imagen 1 y se detiene al final).
 *   2. Imagen 2+ (E-Commerce Alta Gama paleta oscura opuesta con ruptura brusca generada en la imagen)
 *      + Botón #2 táctil 3D limpio al final.
 * - Modo Estándar: Imágenes generadas + 1 Botón táctil 3D limpio.
 */
export const VisualProductLanding: React.FC<{ entryFocusedMode?: boolean }> = () => {
  const {
    currentProductPage,
    selectedPack,
    purchasePath,
    openPurchaseOrderForm
  } = useStore();

  const vis = currentProductPage?.visualLanding;
  const trip = currentProductPage?.tripwireConfig;
  const hasEntryHook = Boolean(trip?.enabled && trip?.entryProductName);

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

  const button1Text = `Separar ahora · ${formatGs(entryPrice)}`;
  const button2Text = `Solicitar oferta completa · ${formatGs(activeBundlePrice)}`;
  const standardButtonText = `Solicitar ahora · ${formatGs(activeBundlePrice)}`;

  return (
    <div
      data-testid="visual-product-landing"
      className="w-full min-h-screen bg-[#06080d] text-white"
    >
      <div className="w-full max-w-[560px] mx-auto bg-[#06080d] shadow-[0_0_80px_rgba(0,0,0,0.9)]">
        {hasEntryHook ? (
          <>
            {/* BLOQUE 1: IMAGEN 1 E-COMMERCE ALTO IMPACTO + BOTÓN #1 TÁCTIL LIMPIO */}
            <section data-testid="landing-hook-section" className="relative w-full">
              <img
                src={firstSheet.imageUrl}
                alt={firstSheet.title || entryName}
                referrerPolicy="no-referrer"
                loading="eager"
                className="w-full h-auto block object-cover"
              />

              <div className="sticky bottom-3 z-30 px-4 py-3 flex justify-center pointer-events-none">
                <button
                  type="button"
                  data-testid="landing-btn-entry-only"
                  onClick={() => openPurchaseOrderForm('entry_only', 1)}
                  className="pointer-events-auto w-full py-4 px-4 sm:px-6 rounded-2xl bg-gradient-to-b from-[#ffbe2e] via-[#f59e0b] to-[#d97706] hover:from-[#ffc94d] hover:to-[#e08106] text-[#1c1000] border border-[#fde68a] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_6px_0_#92400e,0_16px_32px_rgba(245,158,11,0.42)] active:translate-y-1 active:shadow-[0_2px_0_#92400e] cursor-pointer transition-all duration-150 flex items-center justify-center gap-2.5"
                >
                  <MousePointerClick className="w-5 h-5 shrink-0 stroke-[2.5]" />
                  <span className="text-[15px] sm:text-[17px] font-black tracking-tight whitespace-nowrap font-mono tabular-nums">
                    {button1Text}
                  </span>
                </button>
              </div>
            </section>

            {/* BLOQUE 2: IMAGEN 2+ E-COMMERCE ALTÍSIMO NIVEL (CON RUPTURA GENERADA) + BOTÓN #2 TÁCTIL LIMPIO */}
            <section data-testid="landing-principal-section" className="relative w-full">
              {secondPartSheets.map((sheet, idx) => (
                <img
                  key={sheet.id || idx}
                  src={sheet.imageUrl}
                  alt={sheet.title || `${currentProductPage.nombre} presentación ${idx + 2}`}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="w-full h-auto block object-cover"
                />
              ))}

              <div className="sticky bottom-3 z-30 px-4 py-3 flex justify-center pointer-events-none">
                <button
                  type="button"
                  data-testid="landing-btn-principal-bundle"
                  onClick={() => openPurchaseOrderForm('principal_bundle', 1)}
                  className="pointer-events-auto w-full py-4 px-4 sm:px-6 rounded-2xl bg-gradient-to-b from-[#22c55e] via-[#16a34a] to-[#15803d] hover:from-[#34d399] hover:to-[#16a34a] text-white border border-[#86efac]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_6px_0_#064e3b,0_18px_36px_rgba(22,163,74,0.48)] active:translate-y-1 active:shadow-[0_2px_0_#064e3b] cursor-pointer transition-all duration-150 flex items-center justify-center gap-2.5"
                >
                  <ShoppingBag className="w-5 h-5 shrink-0 stroke-[2.5]" />
                  <span className="text-[15px] sm:text-[17px] font-black tracking-tight whitespace-nowrap font-mono tabular-nums drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
                    {button2Text}
                  </span>
                </button>
              </div>
            </section>
          </>
        ) : (
          /* MODO ESTÁNDAR: LÁMINAS E-COMMERCE + 1 BOTÓN TÁCTIL LIMPIO */
          <section className="relative w-full">
            {vis.sheets.map((sheet, idx) => (
              <img
                key={sheet.id || idx}
                src={sheet.imageUrl}
                alt={sheet.title || `${currentProductPage.nombre} vista ${idx + 1}`}
                referrerPolicy="no-referrer"
                loading={idx === 0 ? 'eager' : 'lazy'}
                className="w-full h-auto block object-cover"
              />
            ))}

            <div className="sticky bottom-3 z-30 px-4 py-3 flex justify-center pointer-events-none">
              <button
                type="button"
                data-testid="landing-btn-principal-bundle"
                onClick={() => openPurchaseOrderForm('principal_bundle', 1)}
                className="pointer-events-auto w-full py-4 px-4 sm:px-6 rounded-2xl bg-gradient-to-b from-[#ffbe2e] via-[#f59e0b] to-[#d97706] hover:from-[#ffc94d] hover:to-[#e08106] text-[#1c1000] border border-[#fde68a] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_6px_0_#92400e,0_16px_32px_rgba(245,158,11,0.42)] active:translate-y-1 active:shadow-[0_2px_0_#92400e] cursor-pointer transition-all duration-150 flex items-center justify-center gap-2.5"
              >
                <ShoppingBag className="w-5 h-5 shrink-0 stroke-[2.5]" />
                <span className="text-[15px] sm:text-[17px] font-black tracking-tight whitespace-nowrap font-mono tabular-nums">
                  {standardButtonText}
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
