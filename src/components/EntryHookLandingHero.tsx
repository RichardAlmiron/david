import React from 'react';
import { Check, Info, Package, ShieldCheck, Truck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';

/**
 * Dedicated focused Entry Offer Hero rendered when a visitor arrives from an
 * Entry Hook Ad (`/?p=<slug>&modo=entrada`) on a classic/standard product page
 * that does not use the 2-3 sheet GPT-2.6 Visual Landing layout.
 */
export const EntryHookLandingHero: React.FC = () => {
  const { currentProductPage, openPurchaseOrderForm } = useStore();
  const trip = currentProductPage?.tripwireConfig;

  if (!currentProductPage || !trip?.enabled || !trip.entryProductName) {
    return null;
  }

  const entryName = trip.entryProductName;
  const entryDesc =
    trip.entryProductDescription ||
    `Artículo de entrada disponible con entrega puerta a puerta en Paraguay.`;
  const entryPrice = Number(trip.entryPriceGs ?? trip.entryProductPriceGs ?? 20000);
  const entryNormal = Number(trip.entryNormalPriceGs || Math.round(entryPrice * 2.1));
  const deliveryFee = Number(trip.deliveryFeeGs ?? trip.entryDeliveryFeeGs ?? 40000);
  const heroImg = trip.entryProductImage || currentProductPage.imagen;
  const principalPrice = Number(
    currentProductPage.precios?.[1] || currentProductPage.precioNormal || 189000
  );

  return (
    <section
      data-testid="entry-hook-landing-hero"
      className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-8 space-y-6"
    >
      {/* Ficha principal enfocada al artículo de entrada que tocó el cliente en el anuncio */}
      <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden grid grid-cols-1 md:grid-cols-12 items-stretch">
        <div className="md:col-span-5 bg-stone-100 min-h-[260px]">
          {heroImg ? (
            <img
              src={heroImg}
              alt={entryName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover block"
            />
          ) : (
            <div className="w-full h-full min-h-[260px] flex items-center justify-center bg-stone-100 text-stone-400">
              <Package className="w-10 h-10" />
            </div>
          )}
        </div>

        <div className="md:col-span-7 p-5 sm:p-7 flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <div className="text-xs font-medium text-stone-500">
              Oferta de Entrada · Pago Contra Entrega en Paraguay
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight text-balance">
              {entryName}
            </h1>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">{entryDesc}</p>

            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-2xl sm:text-3xl font-bold text-stone-900 font-mono tabular-nums">
                {formatGs(entryPrice)}
              </span>
              {entryNormal > entryPrice && (
                <span className="text-sm text-stone-400 line-through font-mono tabular-nums">
                  {formatGs(entryNormal)}
                </span>
              )}
              <span className="text-xs text-stone-600 font-mono tabular-nums">
                · Delivery de zona {formatGs(deliveryFee)}
              </span>
            </div>

            <div className="rounded-lg bg-stone-50 border border-stone-200 px-3.5 py-2.5 text-xs text-stone-700 flex items-start gap-2">
              <Info className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
              <span>
                Esta opción envía únicamente 1x {entryName}. No incluye {currentProductPage.nombre}.
              </span>
            </div>
          </div>

          <button
            type="button"
            data-testid="entry-hero-order-btn"
            onClick={() => openPurchaseOrderForm('entry_only', 1)}
            className="w-full py-3.5 px-5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-base transition-colors cursor-pointer"
          >
            Pedir solo {entryName} — {formatGs(entryPrice)}
          </button>
        </div>
      </div>

      {/* Puente sobrio y transparente al producto principal congruente */}
      <div className="rounded-2xl bg-[#07261c] text-white p-5 sm:p-6 border border-emerald-800 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4 min-w-0 max-w-xl">
          {currentProductPage.imagen && (
            <img
              src={currentProductPage.imagen}
              alt={currentProductPage.nombre}
              referrerPolicy="no-referrer"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-emerald-400/40 shrink-0"
            />
          )}
          <div className="space-y-2 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Alternativa Completa Directa (Sin lista de espera)
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white text-balance">
              {currentProductPage.nombre} + {entryName} DE REGALO
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              {currentProductPage.visualLanding?.winnerAngleDescription ||
                currentProductPage.descripcion ||
                `Si también querés resolver el equipo principal completo en un solo paquete, lo llevás con ${entryName} totalmente gratis y Envío Gratis a domicilio.`}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-200 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                {entryName} incluido gratis
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-400" />
                Envío Gratis en todo Paraguay
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Despacho inmediato
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-stretch md:items-end gap-2">
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {formatGs(principalPrice)}
          </div>
          <button
            type="button"
            data-testid="entry-hero-principal-btn"
            onClick={() => openPurchaseOrderForm('principal_bundle', 1)}
            className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            Llevar Completo + Regalo
          </button>
        </div>
      </div>
    </section>
  );
};
