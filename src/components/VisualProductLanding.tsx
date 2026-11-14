import React from 'react';
import { Check, Info, Package, ShieldCheck, Truck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';

export const VisualProductLanding: React.FC<{ entryFocusedMode?: boolean }> = ({
  entryFocusedMode = false
}) => {
  const {
    currentProductPage,
    selectedPack,
    setSelectedPack,
    openPurchaseOrderForm
  } = useStore();

  const vis = currentProductPage?.visualLanding;
  const trip = currentProductPage?.tripwireConfig;
  if (!currentProductPage || !vis?.enabled || !Array.isArray(vis.sheets) || vis.sheets.length === 0) {
    return null;
  }

  const effectivePack = selectedPack > 0 ? selectedPack : 1;
  const price1 = Number(currentProductPage.precios?.[1] || currentProductPage.precioNormal || 189000);
  const price2 = Number(currentProductPage.precios?.[2] || Math.round(price1 * 1.85));
  const price3 = Number(currentProductPage.precios?.[3] || Math.round(price1 * 2.65));
  const activeBundlePrice = effectivePack === 3 ? price3 : effectivePack === 2 ? price2 : price1;

  const entryName = trip?.entryProductName || 'Complemento de Entrada';
  const entryPrice = Number(trip?.entryPriceGs ?? trip?.entryProductPriceGs ?? 20000);
  const entryDelivery = Number(trip?.deliveryFeeGs ?? trip?.entryDeliveryFeeGs ?? 40000);

  const sheet1 = vis.sheets[0];
  const sheet2 = vis.sheets[1];
  const sheet3 = vis.sheets[2];

  const entryOfferBlock = trip?.enabled ? (
    <div className="px-4 sm:px-7 py-6 bg-stone-50 border-y border-stone-200 space-y-4">
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-stone-500">
          {entryFocusedMode
            ? `Oferta seleccionada · ${entryName} · Entrega en puerta`
            : `${currentProductPage.nombre} · Compra directa en Paraguay`}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight text-balance">
          {entryFocusedMode ? entryName : vis.sobrietyHeadline || currentProductPage.nombre}
        </h1>
        {(entryFocusedMode ? trip.entryProductDescription : vis.subheadline) && (
          <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
            {entryFocusedMode ? trip.entryProductDescription : vis.subheadline}
          </p>
        )}
      </div>

      <div className="rounded-xl bg-white border border-stone-300 p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {trip.entryProductImage && (
              <img
                src={trip.entryProductImage}
                alt={entryName}
                referrerPolicy="no-referrer"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-stone-200 shrink-0"
              />
            )}
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Opción 1 · Solo Artículo de Entrada
              </div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                {entryName}
              </h2>
              {trip.entryProductDescription && (
                <p className="text-xs text-stone-600 leading-snug line-clamp-3">
                  {trip.entryProductDescription}
                </p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg sm:text-xl font-bold text-stone-900 font-mono tabular-nums">
              {formatGs(entryPrice)}
            </div>
            {Number(trip.entryNormalPriceGs || 0) > entryPrice && (
              <div className="text-[11px] text-stone-400 line-through font-mono tabular-nums">
                {formatGs(Number(trip.entryNormalPriceGs))}
              </div>
            )}
            <div className="text-[11px] text-stone-500 font-mono tabular-nums">
              + Delivery {formatGs(entryDelivery)}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-stone-800 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>
            {vis.entryDisclaimer ||
              `Esta opción envía únicamente 1x ${entryName}. No incluye ${currentProductPage.nombre}.`}
          </span>
        </div>

        <button
          type="button"
          data-testid="landing-btn-entry-only"
          onClick={() => openPurchaseOrderForm('entry_only', 1)}
          className="w-full py-3.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm sm:text-base transition-colors cursor-pointer"
        >
          {vis.entryButtonLabel || `Pedir solo ${entryName} — ${formatGs(entryPrice)}`}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <section
      data-testid="visual-product-landing"
      className="w-full max-w-2xl mx-auto bg-white sm:my-6 sm:rounded-2xl sm:border sm:border-stone-200 sm:shadow-lg overflow-hidden"
    >
      {/* En modo ?modo=entrada, el cliente aterrizó por la oferta de entrada: mostrar su ficha clara arriba primero */}
      {entryFocusedMode && entryOfferBlock}

      {/* LÁMINA 1 (HERO EDITORIAL COMPLETO SIN BARULLO) */}
      {sheet1 && (
        <div className="w-full bg-stone-950">
          <img
            src={sheet1.imageUrl}
            alt={sheet1.title || currentProductPage.nombre}
            referrerPolicy="no-referrer"
            className="w-full h-auto block object-cover"
          />
        </div>
      )}

      {/* En modo estándar, el bloque de entrada aparece tras la Lámina 1 */}
      {!entryFocusedMode && entryOfferBlock}

      {/* LÁMINA 2 (COMPARACIÓN VISUAL DE CONGRUENCIA Y PSICOLOGÍA INVERSA) */}
      {sheet2 && (
        <div className="w-full bg-stone-950">
          <img
            src={sheet2.imageUrl}
            alt={sheet2.title || `Comparación ${currentProductPage.nombre}`}
            referrerPolicy="no-referrer"
            className="w-full h-auto block object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* BLOQUE INTERMEDIO 2: OPCIÓN PRINCIPAL COMPLETA */}
      <div className="px-4 sm:px-7 py-6 bg-white border-t border-stone-200 space-y-4">
        {trip?.enabled && vis.reversePsychologyHook && (
          <div className="rounded-xl bg-stone-50 border border-stone-200 px-4 py-3 text-sm sm:text-base text-stone-700 leading-relaxed">
            {vis.reversePsychologyHook}
          </div>
        )}

        <div className="rounded-xl bg-[#07261c] text-white p-4 sm:p-5 space-y-4 border border-emerald-700/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3.5 min-w-0">
              {currentProductPage.imagen && (
                <img
                  src={currentProductPage.imagen}
                  alt={currentProductPage.nombre}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-emerald-400/40 shrink-0"
                />
              )}
              <div className="space-y-1 min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  {trip?.enabled
                    ? 'Opción 2 · Pedido Completo Directo (Sin espera)'
                    : 'Pedido Directo · Envío Gratis en Paraguay'}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  {currentProductPage.nombre}
                  {trip?.enabled ? ` + ${entryName} GRATIS` : ''}
                </h2>
                {vis.winnerAngleHeadline && (
                  <div className="text-xs font-semibold text-emerald-200">
                    {vis.winnerAngleHeadline}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums">
                {formatGs(activeBundlePrice)}
              </div>
              {effectivePack === 1 && Number(currentProductPage.precioNormal || 0) > price1 && (
                <div className="text-xs text-emerald-200/60 line-through font-mono tabular-nums">
                  {formatGs(Number(currentProductPage.precioNormal))}
                </div>
              )}
              <div className="text-xs text-emerald-300 font-semibold">Envío Gratis</div>
            </div>
          </div>

          {(vis.winnerAngleDescription || currentProductPage.descripcion) && (
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              {vis.winnerAngleDescription || currentProductPage.descripcion}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[
              { q: 1, label: '1 Unidad', price: price1 },
              { q: 2, label: 'Pack 2x', price: price2 },
              { q: 3, label: 'Pack 3x', price: price3 }
            ].map((p) => (
              <button
                key={p.q}
                type="button"
                onClick={() => setSelectedPack(p.q)}
                className={`p-2.5 rounded-lg border text-center cursor-pointer transition-colors ${
                  effectivePack === p.q
                    ? 'bg-emerald-500 text-stone-950 border-emerald-300 font-bold'
                    : 'bg-white/5 text-white border-white/15 hover:bg-white/10'
                }`}
              >
                <div className="text-xs font-bold">{p.label}</div>
                <div className="text-xs font-mono tabular-nums mt-0.5">{formatGs(p.price)}</div>
              </button>
            ))}
          </div>

          <ul className="space-y-1.5 text-xs sm:text-sm text-emerald-100">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Incluye {currentProductPage.nombre} original garantizado</span>
            </li>
            {trip?.enabled && (
              <li className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Incluye 1x {entryName} TOTALMENTE DE REGALO en el mismo paquete</span>
              </li>
            )}
            <li className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Envío Gratis en Paraguay · Pagás en mano al recibir (Efectivo / QR)</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Despacho directo asegurado (no participa en lista de espera ni cupos)</span>
            </li>
          </ul>

          <button
            type="button"
            data-testid="landing-btn-principal-bundle"
            onClick={() => openPurchaseOrderForm('principal_bundle', effectivePack)}
            className="w-full py-4 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-base sm:text-lg transition-colors cursor-pointer"
          >
            {effectivePack > 1
              ? `Pedir Pack ${effectivePack}x Completo — ${formatGs(activeBundlePrice)}`
              : vis.bundleButtonLabel ||
                `Pedir ${currentProductPage.nombre}${trip?.enabled ? ` + ${entryName} GRATIS` : ''} — ${formatGs(
                  price1
                )}`}
          </button>
        </div>
      </div>

      {/* LÁMINA 3 OPCIONAL (GARANTÍA / DETALLES EN CAJA) */}
      {sheet3 && (
        <div className="w-full bg-stone-950">
          <img
            src={sheet3.imageUrl}
            alt={sheet3.title || 'Garantía y entrega'}
            referrerPolicy="no-referrer"
            className="w-full h-auto block object-cover"
            loading="lazy"
          />
        </div>
      )}
    </section>
  );
};
