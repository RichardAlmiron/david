import React from 'react';
import { X, Truck, ShieldCheck, FileText, Lock } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { PolicyType } from '../types';

export const PoliciesModal: React.FC = () => {
  const { policyModal, setPolicyModal, config } = useStore();

  if (!policyModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={() => setPolicyModal(null)}
        className="fixed inset-0 bg-stone-900/70 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header with Policy Tabs */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setPolicyModal('envio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                policyModal === 'envio'
                  ? 'bg-[#0b3d2e] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
              }`}
            >
              <Truck className="w-3.5 h-3.5" /> Envíos
            </button>
            <button
              onClick={() => setPolicyModal('reembolsos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                policyModal === 'reembolsos'
                  ? 'bg-[#0b3d2e] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Garantía
            </button>
            <button
              onClick={() => setPolicyModal('terminos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                policyModal === 'terminos'
                  ? 'bg-[#0b3d2e] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Términos
            </button>
            <button
              onClick={() => setPolicyModal('privacidad')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                policyModal === 'privacidad'
                  ? 'bg-[#0b3d2e] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
              }`}
            >
              <Lock className="w-3.5 h-3.5" /> Privacidad
            </button>
          </div>

          <button
            onClick={() => setPolicyModal(null)}
            className="w-8 h-8 rounded-full bg-stone-200/60 hover:bg-stone-300 flex items-center justify-center text-stone-600 cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-stone-700 leading-relaxed">
          {policyModal === 'envio' && (
            <div>
              <h3 className="text-lg font-black text-[#0b3d2e] mb-3">
                Política de Envíos y Tiempos de Entrega — {config.marca}™ Paraguay
              </h3>
              <h4 className="font-bold text-stone-900 mt-3 mb-1">1. Cobertura Nacional</h4>
              <p>
                Entregamos en Asunción, todas las ciudades del Departamento Central (Luque, San Lorenzo, Lambaré, Fernando de la Mora, Capiatá, Nemby, Mariano Roque Alonso, etc.) y las principales ciudades del interior del país (Ciudad del Este, Encarnación, Coronel Oviedo, Villarrica, Caaguazú, Concepción, Pedro Juan Caballero, entre otras).
              </p>

              <h4 className="font-bold text-stone-900 mt-3 mb-1">2. Costo del Envío</h4>
              <p>
                El envío es 100% gratuito para cualquier cantidad solicitada. No se cobra ningún recargo por combustible, flete o peaje. El monto liquidado en la reserva es el único a abonar en la puerta.
              </p>

              <h4 className="font-bold text-stone-900 mt-3 mb-1">3. Coordinación previa</h4>
              <p>
                No despachamos pedidos a ciegas. Nuestro equipo de coordinación se comunica contigo por WhatsApp al número celular registrado para coordinar el día de visita y franja horaria.
              </p>

              <h4 className="font-bold text-stone-900 mt-3 mb-1">4. Verificación en la puerta</h4>
              <p>
                Al llegar el repartidor, podés abrir el paquete y comprobar el estado del equipo antes de entregar el pago.
              </p>
            </div>
          )}

          {policyModal === 'reembolsos' && (
            <div>
              <h3 className="text-lg font-black text-[#0b3d2e] mb-3">
                Política de Garantía y Reembolsos — {config.marca}™
              </h3>
              <h4 className="font-bold text-stone-900 mt-3 mb-1">1. Garantía Escrita de 7 Días</h4>
              <p>
                Todos nuestros proyectores cuentan con una garantía oficial de 7 días corridos a partir de la fecha de entrega contra cualquier falla de fabricación, problema en el motor óptico o defecto en el transformador con cambio directo.
              </p>

              <h4 className="font-bold text-stone-900 mt-3 mb-1">2. Procedimiento de Cambio Inmediato</h4>
              <p>
                Si el producto presenta alguna falla técnica, escribinos a nuestro WhatsApp de soporte con una foto o breve video de la situación. Te programaremos una visita de reemplazo sin costo adicional.
              </p>

              <h4 className="font-bold text-stone-900 mt-3 mb-1">3. Condiciones</h4>
              <p>
                La garantía no cubre daños derivados de golpes violentos, apertura indebida del cuerpo sellado o sumersión intencional en agua profunda (el producto es impermeable IP65 a la intemperie y lluvia, pero no sumergible).
              </p>
            </div>
          )}

          {policyModal === 'terminos' && (
            <div>
              <h3 className="text-lg font-black text-[#0b3d2e] mb-3">
                Términos y Condiciones del Servicio
              </h3>
              <p>
                Al confirmar una reserva a través del sitio web de {config.marca}™, el cliente manifiesta su interés en adquirir el o los proyectores seleccionados bajo la modalidad de Pago Contra Entrega (Cash On Delivery).
              </p>
              <h4 className="font-bold text-stone-900 mt-3 mb-1">Obligaciones del comprador</h4>
              <p>
                El cliente se compromete a proveer información veraz de domicilio y teléfono de contacto para que el chofer pueda concretar la entrega en la fecha convenida.
              </p>
              <h4 className="font-bold text-stone-900 mt-3 mb-1">Programa de Promotores</h4>
              <p>
                La acreditación de recompensas a promotores se efectúa exclusivamente cuando los pedidos referidos son efectivamente entregados y cobrados por el repartidor. No se acreditan puntos por pedidos cancelados o rechazados.
              </p>
            </div>
          )}

          {policyModal === 'privacidad' && (
            <div>
              <h3 className="text-lg font-black text-[#0b3d2e] mb-3">
                Política de Privacidad y Protección de Datos
              </h3>
              <p>
                En {config.marca}™ nos tomamos muy en serio la seguridad de tus datos personales. Los datos recabados en el formulario (nombre, número de celular y dirección de entrega) son utilizados única y exclusivamente para procesar la entrega de tu pedido y contactarte por WhatsApp.
              </p>
              <h4 className="font-bold text-stone-900 mt-3 mb-1">Cero Spam y Cero Venta de Datos</h4>
              <p>
                Nunca venderemos ni cederemos tus datos a bases de terceros ni empresas de publicidad. La actividad pública de pedidos en el feed se muestra siempre anonimizada (solo ciudad y cantidad, sin nombres ni teléfonos).
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button
            onClick={() => setPolicyModal(null)}
            className="bg-[#0b3d2e] text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
