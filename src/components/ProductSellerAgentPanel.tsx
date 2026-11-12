import React, { useState, useEffect } from 'react';
import {
  BellRing,
  Save,
  Smartphone,
  CheckCircle2,
  X,
  Sparkles,
  FileText,
  MessageCircle
} from 'lucide-react';
import { Order, ProductPage } from '../types';
import { formatWaPhone } from '../config';

interface ProductSellerAgentPanelProps {
  product: ProductPage;
  orders: Order[];
  onSaveSellerNotificationPhone: (phone: string) => Promise<void>;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export const ProductSellerAgentPanel: React.FC<ProductSellerAgentPanelProps> = ({
  product,
  onSaveSellerNotificationPhone,
  onClose,
  showToast
}) => {
  const [sellerPhoneInput, setSellerPhoneInput] = useState<string>(
    product.waNotificacionesVendedor || ''
  );
  const [savingPhone, setSavingPhone] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const loadSavedPhone = async () => {
      try {
        const res = await fetch(
          `/api/whatsapp/seller-agent?productId=${encodeURIComponent(product.id)}`
        );
        if (res.ok && active) {
          const data = await res.json();
          if (data.sellerPhone) {
            setSellerPhoneInput(data.sellerPhone);
          } else if (product.waNotificacionesVendedor) {
            setSellerPhoneInput(product.waNotificacionesVendedor);
          }
        }
      } catch (e) {}
    };
    loadSavedPhone();
    return () => {
      active = false;
    };
  }, [product.id, product.waNotificacionesVendedor]);

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = formatWaPhone(sellerPhoneInput);
    if (!clean) {
      showToast('⚠️ Ingresá un número de WhatsApp válido donde el vendedor recibirá los reportes.');
      return;
    }
    setSavingPhone(true);
    try {
      await fetch('/api/whatsapp/seller-agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          sellerPhone: clean
        })
      });
      await onSaveSellerNotificationPhone(clean);
      setSellerPhoneInput(clean);
      showToast(
        `✅ Número de reportes del vendedor guardado (+${clean}) para "${product.nombre}".`
      );
    } finally {
      setSavingPhone(false);
    }
  };

  const activeCleanPhone = formatWaPhone(sellerPhoneInput);

  return (
    <div className="p-4 sm:p-5 rounded-lg bg-[#0f0f11] text-zinc-100 border border-zinc-800 shadow-lg space-y-4">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-zinc-800 text-zinc-100 flex items-center justify-center shadow-sm shrink-0">
            <BellRing className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-700 text-emerald-300">
                📲 Reportes Automáticos en el WhatsApp del Vendedor
              </span>
              <h4 className="text-xs sm:text-sm font-semibold text-white">
                {product.nombre}
              </h4>
            </div>
            <p className="text-[11px] text-stone-300 mt-0.5">
              Configurá únicamente el número de WhatsApp del vendedor al que el Agente de este producto le enviará los reportes ejecutivos.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="self-end sm:self-auto px-3 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-xs font-semibold text-white inline-flex items-center gap-1 cursor-pointer transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cerrar</span>
        </button>
      </div>

      {/* Bloque Principal: Introducción del Número + Descripción de la Funcionalidad */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Columna Izquierda: Formulario exclusivo para introducir el número */}
        <form
          onSubmit={handleSavePhone}
          className="lg:col-span-5 p-4 rounded-lg bg-black/40 border border-white/15 flex flex-col justify-between gap-3"
        >
          <div className="space-y-2">
            <label
              htmlFor={`seller-report-phone-${product.id}`}
              className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5"
            >
              <Smartphone className="w-4 h-4 text-[#25D366]" />
              <span>Número de WhatsApp donde el Vendedor recibe los Avisos y Reportes:</span>
            </label>

            <p className="text-[11px] text-stone-300 leading-relaxed">
              Ingresá el número personal o corporativo del dueño/vendedor de <strong>{product.nombre}</strong>. Todos los reportes y consultas se realizarán directamente en ese WhatsApp.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                id={`seller-report-phone-${product.id}`}
                type="text"
                value={sellerPhoneInput}
                onChange={e => setSellerPhoneInput(e.target.value)}
                placeholder="Ej: 595973532550"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/25 text-white font-mono text-sm font-bold outline-none focus:border-[#25D366]"
              />
              <button
                type="submit"
                disabled={savingPhone}
                className="px-4 py-2.5 rounded-lg bg-[#25D366] hover:bg-[#1ebd5a] text-black font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0 shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>{savingPhone ? 'Guardando...' : 'Guardar Número'}</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] flex-wrap gap-2">
            <span className="text-stone-300">
              Destino activo de reportes:{' '}
              <strong className="text-[#25D366] font-mono">
                {activeCleanPhone ? `+${activeCleanPhone}` : 'Pendiente de configurar'}
              </strong>
            </span>
            {activeCleanPhone && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-[#25D366]" />
                Vinculado al WhatsApp del Vendedor
              </span>
            )}
          </div>
        </form>

        {/* Columna Derecha: Descripción clara y detallada de para qué sirve esta funcionalidad */}
        <div className="lg:col-span-7 p-4 rounded-lg bg-white/5 border border-white/15 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Sparkles className="w-4 h-4 text-[#25D366]" />
            <span>¿Para qué sirve esta funcionalidad y cómo trabaja el Agente?</span>
          </div>

          <p className="text-xs text-stone-200 leading-relaxed">
            Esta sección sirve <strong>exclusivamente para registrar el número de WhatsApp del vendedor</strong> de este producto. Pensada para cuando el vendedor no tiene tiempo de entrar al panel administrativo: toda la comunicación y los reportes suceden <strong>directamente en su propio WhatsApp</strong>, sin necesidad de interactuar ni chatear desde esta pantalla.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-black/35 border border-white/10 space-y-1">
              <div className="text-[11px] font-medium text-[#25D366] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>1. Reportes Ejecutivos Bien Diseñados</span>
              </div>
              <p className="text-[11px] text-stone-300 leading-snug">
                Cuando el Agente confirma un pedido de <strong>{product.nombre}</strong>, le envía al WhatsApp del vendedor un reporte limpio, ordenado y enumerado (<code>#1, #2...</code>) indicando cuántos pedidos ya están confirmados, cuántos siguen en curso de confirmación y cuáles ya fueron enviados.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-black/35 border border-white/10 space-y-1">
              <div className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>2. Interacción Humana desde WhatsApp</span>
              </div>
              <p className="text-[11px] text-stone-300 leading-snug">
                El vendedor puede preguntarle o darle instrucciones al Agente <strong>directamente desde su WhatsApp</strong> (por ejemplo: <em>&ldquo;¿Cuántos pedidos tenemos en curso que falta confirmar?&rdquo;</em> o <em>&ldquo;¿Cuántos tenemos confirmados?&rdquo;</em>) y el Agente le responderá en su WhatsApp de forma natural, profesional y sin mensajes molestos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
