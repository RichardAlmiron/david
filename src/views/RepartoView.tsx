import React, { useState } from 'react';
import { Truck, CheckCircle2, Phone, MessageSquare, MapPin, DollarSign, ArrowLeft, RefreshCw, XCircle, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useStore } from '../context/StoreContext';
import { formatGs, formatWaPhone } from '../config';
import { OrderStatus } from '../types';

export const RepartoView: React.FC = () => {
  const { orders, updateOrderStatus, setCurrentView, refreshOrders, config } = useStore();
  const [filter, setFilter] = useState<'pendientes' | 'todos' | 'entregados'>('pendientes');

  const pendingOrders = orders.filter(o => o.estado === 'reservado' || o.estado === 'en_camino');
  const deliveredOrders = orders.filter(o => o.estado === 'entregado_pagado');

  const displayedOrders = filter === 'pendientes'
    ? pendingOrders
    : filter === 'entregados'
    ? deliveredOrders
    : orders;

  const handleMarkDelivered = async (reservaid: string) => {
    await updateOrderStatus(reservaid, 'entregado_pagado');
    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (e) {}
  };

  return (
    <div className="min-h-screen bg-[#f7f5f0] pb-24">
      
      {/* Top Bar */}
      <div className="bg-[#0b3d2e] text-white p-4 sticky top-0 z-40 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('store')}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <b className="text-base sm:text-lg font-black block leading-tight">
                Noelux <span className="text-[#f3ca52]">Modo Reparto</span>
              </b>
              <small className="text-[11px] text-[#9fbfae] font-bold uppercase tracking-wider">
                Entregas y Cobros en Puerta
              </small>
            </div>
          </div>

          <button
            onClick={() => refreshOrders()}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            title="Actualizar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        
        {/* Filter Pills */}
        <div className="flex gap-2 bg-stone-200/60 p-1.5 rounded-2xl">
          <button
            onClick={() => setFilter('pendientes')}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
              filter === 'pendientes'
                ? 'bg-white text-[#0b3d2e] shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Pendientes ({pendingOrders.length})
          </button>
          <button
            onClick={() => setFilter('entregados')}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
              filter === 'entregados'
                ? 'bg-white text-[#0b3d2e] shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Cobrados ({deliveredOrders.length})
          </button>
          <button
            onClick={() => setFilter('todos')}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
              filter === 'todos'
                ? 'bg-white text-[#0b3d2e] shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Todos ({orders.length})
          </button>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {displayedOrders.length === 0 ? (
            <div className="bg-white border border-[#dfdad0] rounded-2xl p-8 text-center text-stone-500 space-y-2">
              <Truck className="w-8 h-8 mx-auto text-stone-300" />
              <b className="block text-stone-800">No hay pedidos en esta sección</b>
              <p className="text-xs">Los nuevos pedidos realizados en la tienda aparecerán acá al instante.</p>
            </div>
          ) : (
            displayedOrders.map(ord => {
              const exactGpsUrl =
                ord.gpsLink ||
                (typeof ord.gpsLat === 'number' && typeof ord.gpsLng === 'number'
                  ? `https://www.google.com/maps?q=${ord.gpsLat.toFixed(6)},${ord.gpsLng.toFixed(6)}`
                  : '');
              const exactStreetViewUrl =
                ord.gpsStreetViewLink ||
                (typeof ord.gpsLat === 'number' && typeof ord.gpsLng === 'number'
                  ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ord.gpsLat.toFixed(6)},${ord.gpsLng.toFixed(6)}`
                  : '');
              const navMapsUrl =
                exactGpsUrl ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${ord.direccion}, ${ord.ciudad}, ${ord.departamento}, Paraguay`
                )}`;

              const waLink = `https://wa.me/${formatWaPhone(ord.celular)}?text=${encodeURIComponent(
                `🚚 *NOELUX™ — AVISO DE ENTREGA EN CAMINO*\n\n` +
                `¡Hola *${ord.nombre}*! Te saluda el repartidor de Noelux.\n\n` +
                `Estoy en camino a tu domicilio (*${ord.direccion}, ${ord.ciudad}*) para entregarte tu reserva *#${ord.reservaid}* (${ord.cantidad} un. - Total: ${formatGs(ord.monto)}).\n` +
                (exactGpsUrl ? `📍 Ya tengo tu ubicación GPS exacta: ${exactGpsUrl}\n\n` : `\n`) +
                `¿Te encontrás disponible en tu dirección para recibir el paquete? ¡Muchas gracias!`
              )}`;

              const isDelivered = ord.estado === 'entregado_pagado';

              return (
                <div
                  key={ord.reservaid}
                  className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 transition-all ${
                    isDelivered ? 'border-[#b7eb8f] bg-[#f9fdfa]' : 'border-[#dfdad0]'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-base font-black text-[#0b3d2e] tracking-wide block">
                        {ord.reservaid}
                      </b>
                      <span className="text-xs text-stone-500">
                        {ord.departamento} · {ord.ciudad}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md ${
                        ord.estado === 'reservado'
                          ? 'bg-[#fff3cd] text-[#856404]'
                          : ord.estado === 'en_camino'
                          ? 'bg-[#cce5ff] text-[#004085]'
                          : ord.estado === 'entregado_pagado'
                          ? 'bg-[#d4edda] text-[#155724]'
                          : 'bg-[#f8d7da] text-[#721c24]'
                      }`}
                    >
                      {ord.estado === 'entregado_pagado'
                        ? 'Entregado y cobrado'
                        : ord.estado === 'en_camino'
                        ? 'En camino'
                        : ord.estado === 'cancelado'
                        ? 'Cancelado'
                        : 'Reservado'}
                    </span>
                  </div>

                  {/* Customer and Address Details */}
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-stone-900 text-sm">
                        {ord.nombre}
                      </span>
                      <span className="font-extrabold text-[#0b3d2e] bg-[#f0f7f3] px-2 py-0.5 rounded">
                        {ord.cantidad} {ord.cantidad > 1 ? 'proyectores' : 'proyector'}
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5 text-stone-700 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                      <MapPin className="w-4 h-4 text-[#0b3d2e] shrink-0 mt-0.5" />
                      <div className="space-y-1 flex-1">
                        <span className="block font-semibold">{ord.direccion}</span>
                        {ord.referenciaCasa && (
                          <span className="block text-xs text-amber-900 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg font-bold">
                            🏠 Referencia: {ord.referenciaCasa}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer House Facade Photo if attached */}
                    {ord.fachadaFotoUrl && (
                      <div className="rounded-xl overflow-hidden border-2 border-[#16a34a] bg-stone-900">
                        <img
                          src={ord.fachadaFotoUrl}
                          alt={`Fachada de ${ord.nombre}`}
                          className="w-full h-36 object-cover"
                        />
                        <div className="bg-[#062319] text-[#ffd778] text-[11px] font-black px-3 py-1">
                          📸 Foto real de la fachada enviada por {ord.nombre}
                        </div>
                      </div>
                    )}

                    {/* Courier Direct GPS & Street View Navigation Box */}
                    <div className="p-2.5 rounded-xl bg-[#062319] text-white border border-[#25D366]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[11px] font-black uppercase text-[#25D366] block">
                          {exactGpsUrl
                            ? '✅ UBICACIÓN GPS SATELITAL DEL HOGAR'
                            : '🗺️ RUTA DE ENTREGA EN MAPA'}
                        </span>
                        <span className="text-xs text-stone-300 truncate block">
                          {exactGpsUrl
                            ? `Pin exacto marcado por ${ord.nombre}`
                            : `${ord.ciudad}, ${ord.departamento}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {exactStreetViewUrl && (
                          <a
                            href={exactStreetViewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-2 rounded-xl bg-[#e8b23a] hover:bg-[#ffd778] text-[#062319] font-black text-xs inline-flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <span>🏠 Street View</span>
                          </a>
                        )}
                        <a
                          href={navMapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebd5a] text-[#041911] font-black text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <MapPin className="w-4 h-4" />
                          <span>Abrir GPS</span>
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-stone-500">Forma de pago: <b>{ord.detalle}</b></span>
                      <span className="text-base font-black text-[#0b3d2e]">
                        Cobrar: {formatGs(ord.monto)}
                      </span>
                    </div>

                    {ord.ref_code && (
                      <div className="text-[11px] font-bold text-[#785808] bg-[#fff9ec] border border-[#f0dcab] px-2.5 py-1 rounded-lg">
                        Promotor asignado: <b>{ord.ref_code}</b> (Suma punto automático al cobrar)
                      </div>
                    )}
                  </div>

                  {/* Quick Action Contacts */}
                  <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                    <a
                      href={`tel:${ord.celular}`}
                      className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5 text-stone-600" />
                      Llamar ({ord.celular})
                    </a>
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 bg-[#25D366] hover:bg-[#1ebd5a] text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-white" />
                      WhatsApp
                    </a>
                  </div>

                  {/* Delivery Status Action Buttons */}
                  {!isDelivered && (
                    <div className="flex items-center gap-2 pt-1">
                      {ord.estado === 'reservado' && (
                        <button
                          onClick={() => updateOrderStatus(ord.reservaid, 'en_camino')}
                          className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs py-3 rounded-xl cursor-pointer"
                        >
                          Salir en camino
                        </button>
                      )}

                      <button
                        onClick={() => handleMarkDelivered(ord.reservaid)}
                        className="flex-2 bg-gradient-to-b from-[#1ea856] to-[#158a44] hover:from-[#22b85e] hover:to-[#17964b] text-white font-black text-xs sm:text-sm py-3 rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Entregado y cobrado
                      </button>

                      <button
                        onClick={() => updateOrderStatus(ord.reservaid, 'cancelado')}
                        className="p-3 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl cursor-pointer"
                        title="Cancelar pedido"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
