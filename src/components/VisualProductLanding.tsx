import React from 'react';
import { ArrowDown, ArrowRight, ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';
import { OrderForm } from './OrderForm';

/**
 * Página Visual Limpia (Cero HTML innecesario, cero formulario infinito abierto):
 * - Modo Tripwire + Principal:
 *   1. Lámina 1 (Gancho rápido directo) + Botón #1 que fluctúa con la primera imagen hasta su final.
 *   2. Freno chocante de ruptura de patrón ("¡ESPERÁ UN RATITO! Estás a punto de llevar...").
 *   3. Lámina 2+ (Oferta Principal brutalmente persuasiva y diferente) + Botón #2 al final.
 * - Modo Estándar: Láminas centradas + 1 Botón principal que abre el formulario en modal al hacer clic.
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

  return (
    <div
      data-testid="visual-product-landing"
      className="w-full min-h-screen bg-[#06080d] text-white"
    >
      <div className="w-full max-w-[560px] mx-auto bg-[#06080d] shadow-[0_0_80px_rgba(0,0,0,0.9)]">
        {hasEntryHook ? (
          <>
            {/* ═════════════════════════════════════════════════════════════ */}
            {/* BLOQUE 1: IMAGEN 1 DIRECTA + BOTÓN #1 (FLUCTÚA HASTA EL FINAL) */}
            {/* ═════════════════════════════════════════════════════════════ */}
            <section data-testid="landing-hook-section" className="relative w-full">
              <img
                src={firstSheet.imageUrl}
                alt={firstSheet.title || entryName}
                referrerPolicy="no-referrer"
                loading="eager"
                className="w-full h-auto block object-cover"
              />

              {/* ÚNICO BOTÓN #1 (Tripwire): sticky dentro del bloque para fluctuar solo durante la Imagen 1 */}
              <div className="sticky bottom-3 z-30 px-3 py-3 bg-gradient-to-t from-[#06080d] via-[#06080d]/95 to-transparent">
                <button
                  type="button"
                  data-testid="landing-btn-entry-only"
                  onClick={() => openPurchaseOrderForm('entry_only', 1)}
                  className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-[#f2cf7e] via-[#e5c88b] to-[#f4dfb0] hover:brightness-105 active:scale-[0.99] text-[#090b10] border-2 border-[#fff3d1] shadow-[0_10px_35px_rgba(229,200,139,0.45)] cursor-pointer transition-all flex items-center justify-between gap-3 animate-pulse"
                  style={{ animationDuration: '2.4s' }}
                >
                  <div className="min-w-0 text-left">
                    <div className="text-sm sm:text-base font-black leading-tight uppercase tracking-tight">
                      {vis.entryButtonLabel || `SEPARAR ${entryName} AHORA`}
                    </div>
                    <div className="text-xs font-bold text-[#090b10]/80 mt-0.5 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>1 unidad · Pagás recién al recibir en mano</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 bg-[#090b10] text-[#f4dfb0] px-3 py-2 rounded-xl font-mono tabular-nums font-black text-sm sm:text-base">
                    <span>{formatGs(entryPrice)}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </div>
                </button>
              </div>
            </section>

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* RUPTURA CHOCANTE DE PATRÓN (DETIENE ANTES DE LA PARTE 2)      */}
            {/* ═════════════════════════════════════════════════════════════ */}
            <div
              data-testid="landing-pattern-interrupt"
              className="w-full bg-[#120608] border-y-2 border-red-500/80 px-5 py-7 text-center space-y-2.5"
            >
              <div className="text-[11px] sm:text-xs font-mono font-black uppercase tracking-[0.2em] text-red-400">
                ¡ESPERÁ UN SEGUNDO! · NO CONFIRMES TODAVÍA
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-white leading-tight text-balance">
                Estás a punto de pedir únicamente «{entryName}»…
              </h2>
              <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed max-w-md mx-auto">
                Aguardame un ratito antes de dar clic y separarlo. Leé esto que viene ahora: va a cambiar por completo tu decisión.
              </p>
              <div className="pt-1 flex justify-center text-red-400">
                <ArrowDown className="w-5 h-5 animate-bounce" />
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* BLOQUE 2: IMAGEN PRINCIPAL PERSUASIVA + BOTÓN #2 AL FINAL      */}
            {/* ═════════════════════════════════════════════════════════════ */}
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

              {/* ÚNICO BOTÓN #2 (Oferta Principal + Regalo + Envío Gratuito): al final de la segunda imagen */}
              <div className="sticky bottom-3 z-30 px-3 py-4 bg-gradient-to-t from-[#06080d] via-[#06080d]/95 to-transparent">
                <button
                  type="button"
                  data-testid="landing-btn-principal-bundle"
                  onClick={() => openPurchaseOrderForm('principal_bundle', 1)}
                  className="w-full py-4 sm:py-5 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 hover:brightness-105 active:scale-[0.99] text-[#031910] border-2 border-emerald-200 shadow-[0_12px_40px_rgba(16,185,129,0.45)] cursor-pointer transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 text-left space-y-0.5">
                    <div className="text-[11px] sm:text-xs font-black uppercase tracking-wide text-[#022416]">
                      ENVÍO GRATUITO + {entryName.toUpperCase()} DE REGALO
                    </div>
                    <div className="text-sm sm:text-base font-black leading-tight">
                      {vis.bundleButtonLabel || `SOLICITAR ${currentProductPage.nombre}`}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 bg-[#031910] text-emerald-300 px-3.5 py-2.5 rounded-xl font-mono tabular-nums font-black text-sm sm:text-base">
                    <span>{formatGs(activeBundlePrice)}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </div>
                </button>
              </div>
            </section>
          </>
        ) : (
          /* ═════════════════════════════════════════════════════════════ */
          /* MODO ESTÁNDAR (UN SOLO PRODUCTO): LÁMINAS + 1 BOTÓN MODAL     */
          /* ═════════════════════════════════════════════════════════════ */
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

            <div className="sticky bottom-3 z-30 px-3 py-4 bg-gradient-to-t from-[#06080d] via-[#06080d]/95 to-transparent">
              <button
                type="button"
                data-testid="landing-btn-principal-bundle"
                onClick={() => openPurchaseOrderForm('principal_bundle', 1)}
                className="w-full py-4 sm:py-5 px-5 rounded-2xl bg-gradient-to-r from-[#f2cf7e] via-[#e5c88b] to-[#f4dfb0] hover:brightness-105 active:scale-[0.99] text-[#090b10] border-2 border-[#fff3d1] shadow-[0_10px_35px_rgba(229,200,139,0.45)] cursor-pointer transition-all flex items-center justify-between gap-3"
              >
                <div className="min-w-0 text-left space-y-0.5">
                  <div className="text-sm sm:text-base font-black leading-tight">
                    {vis.bundleButtonLabel || `SOLICITAR ${currentProductPage.nombre}`}
                  </div>
                  <div className="text-xs font-bold text-[#090b10]/80">
                    Envío Gratis a todo Paraguay · Pagás recién al recibir
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 bg-[#090b10] text-[#f4dfb0] px-3.5 py-2.5 rounded-xl font-mono tabular-nums font-black text-sm sm:text-base">
                  <span>{formatGs(activeBundlePrice)}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </div>
              </button>
            </div>
          </section>
        )}
      </div>

      {/* FORMULARIO: CERO HTML ABIERTO EN PANTALLA — SOLO SE ABRE EN MODAL AL TOCAR UN BOTÓN */}
      <OrderForm
        expressDirectMode
        modalOnly
        hidePrincipalUpgradeHint={hasEntryHook && purchasePath === 'entry_only'}
      />
    </div>
  );
};
