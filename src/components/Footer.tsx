import React from 'react';
import { ShieldCheck, Truck, Sparkles, Lock } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const Footer: React.FC = () => {
  const { setPolicyModal, config, setCurrentView, openOrderFormFullscreen } = useStore();

  const handleOrderScroll = () => {
    setCurrentView('store');
    openOrderFormFullscreen();
  };

  return (
    <footer className="bg-gradient-to-b from-[#062319] to-[#041911] text-stone-300 pt-12 sm:pt-14 pb-28 sm:pb-32 border-t border-[#e8b23a]/20">
      <div className="app-container">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-10 sm:mb-12">

          {/* Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#0b3d2e] border border-[#e8b23a] flex items-center justify-center text-[#e8b23a] font-black text-lg">
                N
              </div>
              <span className="text-xl font-black text-white tracking-tight">
                {config.marca}™
              </span>
            </div>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              La solución definitiva de iluminación navideña en Paraguay. Fachada decorada en 90 segundos con cero esfuerzo.
            </p>
            <div className="flex items-center gap-2 text-xs text-[#e8b23a] font-bold">
              <Truck className="w-4 h-4 shrink-0" /> Envío gratis a todo el país
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="space-y-2 text-xs sm:text-sm">
            <h4 className="font-black text-white uppercase tracking-wider text-xs mb-3">
              Navegación
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="#galeria"
                  onClick={() => setCurrentView('store')}
                  className="hover:text-white transition-colors"
                >
                  Galería y Video Real
                </a>
              </li>
              <li>
                <a
                  href="#video-demostracion"
                  onClick={() => setCurrentView('store')}
                  className="hover:text-white transition-colors"
                >
                  Demostración en Vivo
                </a>
              </li>
              <li>
                <a
                  href="#como-funciona"
                  onClick={() => setCurrentView('store')}
                  className="hover:text-white transition-colors"
                >
                  Instalación en 90s
                </a>
              </li>
              <li>
                <a
                  href="#pedido"
                  onClick={() => setCurrentView('store')}
                  className="hover:text-white transition-colors font-bold text-[#e8b23a]"
                >
                  Hacer Reserva Contra Entrega
                </a>
              </li>
            </ul>
          </div>

          {/* Legal and Support */}
          <div className="space-y-2 text-xs sm:text-sm">
            <h4 className="font-black text-white uppercase tracking-wider text-xs mb-3">
              Políticas y Garantía
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => setPolicyModal('envio')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Política de Envío y Entregas
                </button>
              </li>
              <li>
                <button
                  onClick={() => setPolicyModal('reembolsos')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Garantía Escrita de 7 Días
                </button>
              </li>
              <li>
                <button
                  onClick={() => setPolicyModal('terminos')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Términos y Condiciones
                </button>
              </li>
              <li>
                <button
                  onClick={() => setPolicyModal('privacidad')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Política de Privacidad
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <p>© {new Date().getFullYear()} {config.marca}™ Paraguay. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <span className="flex items-center gap-1 text-stone-400">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1ea856]" /> Pago 100% Contra Entrega
            </span>
            <span>·</span>
            <button
              type="button"
              onClick={handleOrderScroll}
              className="hover:text-white flex items-center gap-1 font-bold text-[#e8b23a] cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#e8b23a]" /> Pedir Ahora con Envío Gratis
            </button>
            <span>·</span>
            <button
              onClick={() => {
                window.location.hash = 'admin';
                setCurrentView('admin');
              }}
              className="text-stone-600 hover:text-stone-400 flex items-center gap-1 cursor-pointer transition-colors"
              title="Acceso Exclusivo para Administrador"
            >
              <Lock className="w-3 h-3 text-stone-500" />
              <span>Portal Admin</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

