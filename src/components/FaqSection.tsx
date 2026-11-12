import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useStore } from '../context/StoreContext';

const FAQS = [
  {
    q: '¿Cómo funciona el pago contra entrega?',
    a: 'Completás el formulario con tu dirección y celular. Te escribimos por WhatsApp para avisarte qué día y hora pasa el repartidor. Cuando llega a tu casa, revisás que el paquete esté en orden y le pagás en mano (efectivo, QR de banco/ueno o tarjeta).'
  },
  {
    q: '¿El envío es verdaderamente gratis?',
    a: 'Sí, 100% gratuito sin costos ocultos para Asunción, Gran Asunción y todas las ciudades del interior del país por donde pasa la transportadora. El monto que ves al confirmar es el único que abonás al recibir.'
  },
  {
    q: '¿Cuánto tarda en llegar mi pedido?',
    a: 'Para Asunción y Gran Asunción (Luque, San Lorenzo, Lambaré, Capiatá, Fernando, etc.) entregamos en 24 horas. Para ciudades del interior (Ciudad del Este, Encarnación, Coronel Oviedo, etc.) el plazo es de 24 a 48 horas hábiles.'
  },
  {
    q: '¿Qué pasa si llueve fuerte o hace calor extremo?',
    a: 'Noelux™ cuenta con certificación de estanqueidad IP65 con sellado de silicona. Soporta tormentas eléctricas de verano, lluvia torrencial, viento y polvo sin dañarse.'
  },
  {
    q: '¿Qué incluye la caja?',
    a: 'Cada proyector incluye: Lámpara proyector HD con 12 motivos integrados, estaca de 20cm para jardín o césped, base redonda para apoyar en piso o balcón, transformador 220V sellado de bajo consumo y cable hermético de 5 metros.'
  },
  {
    q: '¿Qué garantía tengo si no funciona?',
    a: 'Tenés 7 días de garantía escrita oficial. Si el equipo presenta cualquier inconveniente técnico o defecto de fábrica, te enviamos un reemplazo nuevo sin ningún costo.'
  }
];

export const FaqSection: React.FC = () => {
  const { currentProductPage } = useStore();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const customLanding = currentProductPage?.landingContent;
  const customTheme = currentProductPage?.themeConfig;
  const faqsToRender = customLanding?.faqs?.length ? customLanding.faqs : FAQS;
  const primaryBg = customTheme?.primaryBg || 'bg-[#0b3d2e]';
  const badgeClasses = customTheme?.badgeBg || 'bg-[#e5f6ec] border-[#86efac] text-[#064e3b]';

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-8 sm:py-12 max-w-4xl mx-auto app-container">
      <div className="text-center mb-6 sm:mb-8">
        <span className={`${badgeClasses} border text-xs sm:text-sm font-black px-4 py-1.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5`}>
          <HelpCircle className="w-4 h-4" /> {customLanding?.faqsBadge || 'Dudas Frecuentes'}
        </span>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#062319] tracking-tight mt-3 leading-tight">
          {customLanding?.faqsTitle || 'Todo lo que necesitás saber'}
        </h2>
      </div>

      <div className="space-y-3.5">
        {faqsToRender.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="bg-white border-2 border-[#dfdad0] rounded-3xl overflow-hidden transition-all shadow-sm"
            >
              <button
                onClick={() => toggle(idx)}
                className="w-full py-4.5 px-5 sm:px-6 text-left font-black text-base sm:text-lg text-stone-900 flex items-center justify-between gap-4 cursor-pointer hover:bg-stone-50 transition-colors"
              >
                <span>{faq.q}</span>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    isOpen ? `${primaryBg} text-[#ffd778] rotate-180` : 'bg-[#f6f4ee] text-stone-700'
                  }`}
                >
                  <ChevronDown className="w-5 h-5" />
                </div>
              </button>
              {isOpen && (
                <div className="px-5 sm:px-6 pb-5 text-base font-medium text-stone-700 leading-relaxed border-t border-stone-200/80 pt-3.5 bg-[#faf9f5]">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};


