import React from 'react';
import { X, Minus, Plus, ShoppingBag, Truck, ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';

export const CartDrawer: React.FC = () => {
  const {
    cartDrawerOpen,
    setCartDrawerOpen,
    selectedPack,
    setSelectedPack,
    openOrderFormFullscreen,
    config,
    currentProductPage
  } = useStore();

  if (!cartDrawerOpen) return null;

  const total = selectedPack > 0 
    ? (currentProductPage?.precios?.[selectedPack] || config.lote[selectedPack] || 189000)
    : 0;
  const normalUnit = currentProductPage?.precioNormal || config.normal;
  const fullPrice = normalUnit * selectedPack;
  const savings = selectedPack > 0 ? fullPrice - total : 0;
  const unitPrice = currentProductPage?.precios?.[1] || config.lote[1] || 189000;

  const handleCheckout = () => {
    openOrderFormFullscreen();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={() => setCartDrawerOpen(false)}
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#0b3d2e]" />
            <h3 className="font-black text-base sm:text-lg text-[#0b3d2e]">
              Tu Carrito de Compra
            </h3>
          </div>
          <button
            onClick={() => setCartDrawerOpen(false)}
            className="w-8 h-8 rounded-full bg-stone-200/70 hover:bg-stone-300 flex items-center justify-center text-stone-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {selectedPack === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <p className="font-extrabold text-stone-700 text-sm">Tu carrito todavía no tiene productos</p>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Seleccioná cualquiera de nuestros packs para adquirirlo con Envío Gratis a todo el país.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedPack(1);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0b3d2e] text-white text-xs font-black shadow-md hover:bg-[#124e3c] cursor-pointer"
              >
                + Adquirir 1 Unidad ({formatGs(unitPrice)})
              </button>
            </div>
          ) : (
            <div className="flex gap-3 bg-stone-50 border border-stone-200 rounded-2xl p-3.5">
              <img
                src="/assets/p-fachada.png"
                alt="Noelux Proyector"
                className="w-20 h-20 rounded-xl object-cover border border-stone-200 shrink-0"
              />
              <div className="flex-1">
                <h4 className="font-extrabold text-sm text-stone-900 leading-snug">
                  {currentProductPage?.nombre || 'Proyector Navideño Noelux™ (12 Diseños)'}
                </h4>
                <p className="text-xs text-stone-500 mt-0.5">
                  Kit completo con estaca + base de apoyo
                </p>

                <div className="flex items-center justify-between mt-3">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg p-1">
                    <button
                      onClick={() => setSelectedPack(Math.max(0, selectedPack - 1))}
                      className="w-6 h-6 rounded flex items-center justify-center text-stone-600 hover:bg-stone-100 cursor-pointer"
                      title="Disminuir"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-black text-sm text-[#0b3d2e] min-w-5 text-center">
                      {selectedPack}
                    </span>
                    <button
                      disabled={selectedPack >= config.maxCant}
                      onClick={() => setSelectedPack(Math.min(config.maxCant, selectedPack + 1))}
                      className="w-6 h-6 rounded flex items-center justify-center text-stone-600 hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
                      title="Aumentar"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-sm text-[#0b3d2e] block">
                      {formatGs(total)}
                    </span>
                    {selectedPack > 1 && (
                      <span className="line-through text-[11px] text-stone-400 block">
                        {formatGs(fullPrice)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Value Props in Drawer */}
          <div className="bg-[#f0f9f3] border border-[#cce5d6] rounded-xl p-3 space-y-2.5 text-xs text-[#1e4b37]">
            <div className="flex items-center justify-between font-bold">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#1ea856] shrink-0" />
                <span>Envío 100% GRATIS a todo el país</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-red-500 line-through font-bold text-[11px] decoration-red-600 decoration-2">
                  Gs. 30.000
                </span>
                <span className="bg-[#1ea856] text-white text-[10px] font-black px-1.5 py-0.5 rounded uppercase">
                  GRATIS
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="w-4 h-4 text-[#1ea856] shrink-0" />
              <span>Garantía Oficial de 7 Días (Cambio directo ante fallas)</span>
            </div>
            <div className="flex items-center gap-2 text-stone-600 font-semibold text-[11px]">
              <span>🛡️ Pagás al repartidor en puerta al recibir (Efectivo o QR)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        {selectedPack > 0 ? (
          <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 space-y-3">
            <div className="space-y-1.5 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Subtotal ({selectedPack} {selectedPack > 1 ? 'unidades' : 'unidad'}):</span>
                <span className="font-bold">{formatGs(fullPrice)}</span>
              </div>
              <div className="flex justify-between text-[#0a7a4a] font-bold">
                <span>Descuento de Lanzamiento:</span>
                <span>− {formatGs(savings)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Envío a domicilio (todo el país):</span>
                <div className="flex items-center gap-1.5 font-black">
                  <span className="text-red-500 line-through decoration-red-600 decoration-2 text-[11px]">
                    Gs. 30.000
                  </span>
                  <span className="text-[#0a7a4a] uppercase">GRATIS</span>
                </div>
              </div>
              <div className="flex justify-between text-base font-black text-[#0b3d2e] pt-2 border-t border-stone-200">
                <span>Total a pagar al recibir:</span>
                <span>{formatGs(total)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-gradient-to-b from-[#1ea856] to-[#138340] hover:from-[#22b85e] hover:to-[#159348] text-white font-black text-sm sm:text-base py-3.5 rounded-xl shadow-md active:translate-y-0.5 transition-all cursor-pointer uppercase tracking-wider"
            >
              Completar Reserva con Envío Gratis
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 text-center">
            <button
              onClick={() => {
                setSelectedPack(1);
                handleCheckout();
              }}
              className="w-full bg-gradient-to-b from-[#1ea856] to-[#138340] hover:from-[#22b85e] hover:to-[#159348] text-white font-black text-sm sm:text-base py-3.5 rounded-xl shadow-md active:translate-y-0.5 transition-all cursor-pointer uppercase tracking-wider"
            >
              Adquirir 1 Unidad ({formatGs(unitPrice)})
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
