import React, { useState } from 'react';
import { Award, Share2, Copy, Check, Users, Sparkles, ArrowLeft, ArrowUpRight, Flame, QrCode } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';

export const PromoterView: React.FC = () => {
  const { promoterCode, orders, events, config, setCurrentView } = useStore();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'estado' | 'grupos' | 'redes'>('estado');

  // Calculate stats for this promoter
  const myOrders = orders.filter(o => o.ref_code === promoterCode);
  const myPaidOrders = myOrders.filter(o => o.estado === 'entregado_pagado');
  const myInRouteOrders = myOrders.filter(o => o.estado === 'reservado' || o.estado === 'en_camino');

  const cycleLength = config.viral.ciclo || 5;
  const currentPoints = myPaidOrders.length % cycleLength;
  const cyclesCompleted = Math.floor(myPaidOrders.length / cycleLength);

  const rewardPerCycle = config.viral.premio || 100000;
  const totalEarned = cyclesCompleted * rewardPerCycle;

  const shareUrl = `${window.location.origin}${window.location.pathname}?ref=${promoterCode}`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyTemplates = {
    estado: `Miren qué lindo lo que compré para la casa: Proyector de luces para el frente con 12 dibujos navideños que se mueven (chau cables y escaleras). No se paga nada por adelantado, le pagás al delivery recién cuando te trae a tu casa. Les paso la página por si quieren aprovechar la oferta antes que termine: ${shareUrl}`,
    grupos: `Familia y amigos, les paso este dato por si quieren decorar la casa para Navidad sin gastar en luces caras. Ya encargué este proyector que cubre toda la fachada en 2 minutos. El envío es gratis a todo el país y se paga recién al recibir en la puerta. Acá pueden pedir el suyo: ${shareUrl}`,
    redes: `¡Dato navideño imperdible! Ya pedí el proyector para la fachada de la casa: viene con 12 figuras con movimiento y se enchufa en 1 minuto. Lo mejor es que no pagás nada antes, revisás cuando llega a tu casa y pagás al repartidor. Acá les dejo la página con descuento: ${shareUrl}`
  };

  return (
    <div className="min-h-screen bg-[#f7f5f0] pb-24">
      
      {/* Top Header */}
      <div className="bg-[#0b3d2e] text-white p-4 sticky top-0 z-40 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('store')}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <b className="text-base sm:text-lg font-black block leading-tight">
                Noelux <span className="text-[#e8b23a]">Promotores</span>
              </b>
              <small className="text-[11px] text-[#9fbfae] font-bold uppercase tracking-wider">
                Tus pedidos y comisiones en vivo
              </small>
            </div>
          </div>

          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded bg-[#062319] border border-[#e8b23a]/40 text-[#ffd778]">
            En línea
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        
        {/* Main Status & Points Card */}
        <div className="bg-white border border-[#dfdad0] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500 block">
                Tu Código de Promotor
              </span>
              <b className="text-xl font-black text-[#0b3d2e] tracking-wider">{promoterCode}</b>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500 block">
                Premio por ciclo
              </span>
              <b className="text-base font-black text-[#0a7a4a]">{formatGs(rewardPerCycle)}</b>
            </div>
          </div>

          {/* Points Big Number */}
          <div className="flex items-baseline gap-2 pt-2 border-t border-stone-100">
            <span className="text-5xl font-black text-[#0b3d2e]">{currentPoints}</span>
            <span className="text-stone-500 text-sm font-bold">
              de {cycleLength} pedidos pagados para el próximo premio
            </span>
          </div>

          {/* Dots Progress (5 circles) */}
          <div className="flex items-center gap-3">
            {[...Array(cycleLength)].map((_, i) => {
              const isFilled = i < currentPoints;
              return (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center font-black text-xs transition-all ${
                    isFilled
                      ? 'bg-[#c9a227] border-[#c9a227] text-white shadow-xs'
                      : 'border-[#dfdad0] bg-white text-stone-300'
                  }`}
                >
                  {isFilled ? '✓' : i + 1}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-stone-500 italic">
            <b>Regla fija:</b> El punto se acredita cuando el repartidor marca el pedido como cobrado en puerta. Nadie gana por registrar reservas falsas.
          </p>

          {/* Metrics Rows */}
          <div className="space-y-2 pt-3 border-t border-stone-100 text-xs sm:text-sm">
            <div className="flex justify-between py-1 border-b border-stone-100 text-stone-600">
              <span>Reservas con tu código en camino:</span>
              <b className="text-stone-900">{myInRouteOrders.length}</b>
            </div>
            <div className="flex justify-between py-1 border-b border-stone-100 text-stone-600">
              <span>Ciclos completados (5 de 5):</span>
              <b className="text-[#0b3d2e]">{cyclesCompleted}</b>
            </div>
            <div className="flex justify-between py-1 text-stone-600">
              <span>Premios transferidos por QR:</span>
              <b className="text-[#0a7a4a] text-base">{formatGs(totalEarned)}</b>
            </div>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="bg-white border border-[#dfdad0] rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-stone-600">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1ea856] animate-pulse" />
            <span>En vivo — Actividad en tiempo real</span>
          </div>

          <ul className="space-y-2.5 divide-y divide-stone-100 text-xs">
            {events.slice(0, 5).map(ev => (
              <li key={ev.id} className="pt-2.5 flex items-start gap-3">
                <span className="text-[10px] text-stone-400 font-bold shrink-0 pt-0.5">
                  {ev.fecha}
                </span>
                <div className="flex-1">
                  <span className="font-extrabold text-stone-900 block">{ev.descripcion}</span>
                  <span className="text-stone-500 text-[11px]">{ev.ciudad}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Share and Earn Section */}
        <div className="bg-white border border-[#dfdad0] rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <b className="text-base font-black text-stone-900 block">
              Compartí tu página y acumulá puntos
            </b>
            <p className="text-xs text-stone-500 mt-0.5">
              No tenés que redactar nada: elegí dónde mandar y tocá compartir.
            </p>
          </div>

          {/* Copy Link Input */}
          <div>
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-300 rounded-xl p-1.5 pl-3">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full text-xs font-mono text-stone-700 bg-transparent outline-none truncate"
              />
              <button
                onClick={() => copyToClipboard(shareUrl, 'link')}
                className="bg-[#0b3d2e] hover:bg-[#0f4f3a] text-white text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'link' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* Share Message Tabs */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('estado')}
                className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg border transition-all cursor-pointer ${
                  activeTab === 'estado'
                    ? 'bg-[#0b3d2e] text-white border-[#0b3d2e]'
                    : 'bg-stone-50 text-stone-600 border-stone-200'
                }`}
              >
                Estado WhatsApp
              </button>
              <button
                onClick={() => setActiveTab('grupos')}
                className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg border transition-all cursor-pointer ${
                  activeTab === 'grupos'
                    ? 'bg-[#0b3d2e] text-white border-[#0b3d2e]'
                    : 'bg-stone-50 text-stone-600 border-stone-200'
                }`}
              >
                Grupos
              </button>
              <button
                onClick={() => setActiveTab('redes')}
                className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg border transition-all cursor-pointer ${
                  activeTab === 'redes'
                    ? 'bg-[#0b3d2e] text-white border-[#0b3d2e]'
                    : 'bg-stone-50 text-stone-600 border-stone-200'
                }`}
              >
                Redes
              </button>
            </div>

            <textarea
              readOnly
              rows={4}
              value={copyTemplates[activeTab]}
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700 outline-none resize-none italic leading-relaxed"
            />

            <div className="flex justify-between items-center gap-2 pt-1">
              <button
                onClick={() => copyToClipboard(copyTemplates[activeTab], activeTab)}
                className="text-xs font-bold text-[#0a7a4a] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === activeTab ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === activeTab ? '¡Texto copiado!' : 'Copiar este texto'}
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(copyTemplates[activeTab])}`}
                target="_blank"
                rel="noreferrer"
                className="bg-[#25D366] hover:bg-[#1ebd5a] text-white text-xs font-extrabold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" /> Compartir en WhatsApp
              </a>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
