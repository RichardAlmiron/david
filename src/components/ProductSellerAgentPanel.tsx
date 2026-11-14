import React, { useState, useEffect } from 'react';
import {
  BellRing,
  Save,
  Smartphone,
  CheckCircle2,
  X,
  Bot,
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
      showToast('Ingresá un número de WhatsApp válido donde el vendedor recibirá los reportes.');
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
        `Número de reportes del vendedor guardado (+${clean}) para "${product.nombre}".`
      );
    } finally {
      setSavingPhone(false);
    }
  };

  const activeCleanPhone = formatWaPhone(sellerPhoneInput);

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-[#0b0e16]/85 text-zinc-100 border border-white/10 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 text-[#e5c88b] flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono text-[#e5c88b]">
                Reportes al WhatsApp del Vendedor
              </span>
              <span className="text-zinc-600" aria-hidden="true">·</span>
              <h4 className="text-xs sm:text-sm font-semibold text-white">
                {product.nombre}
              </h4>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Configurá el número de WhatsApp del vendedor al que el Agente enviará los reportes ejecutivos.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="self-end sm:self-auto px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-zinc-300 hover:text-white inline-flex items-center gap-1 cursor-pointer transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cerrar</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <form
          onSubmit={handleSavePhone}
          className="lg:col-span-5 p-4 rounded-xl bg-[#07090f]/80 border border-white/10 flex flex-col justify-between gap-3"
        >
          <div className="space-y-2">
            <label
              htmlFor={`seller-report-phone-${product.id}`}
              className="block text-xs font-semibold text-zinc-200 flex items-center gap-1.5"
            >
              <Smartphone className="w-4 h-4 text-[#e5c88b]" />
              <span>WhatsApp para Reportes del Vendedor</span>
            </label>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Número del dueño/vendedor de <strong className="text-zinc-200">{product.nombre}</strong>.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                id={`seller-report-phone-${product.id}`}
                type="text"
                value={sellerPhoneInput}
                onChange={e => setSellerPhoneInput(e.target.value)}
                placeholder="Ej: 595973532550"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0b0e16] border border-white/10 focus:border-[#e5c88b]/70 text-white font-mono tabular-nums text-sm outline-none"
              />
              <button
                type="submit"
                disabled={savingPhone}
                className="px-4 py-2.5 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingPhone ? 'Guardando...' : 'Guardar'}</span>
              </button>
            </div>
          </div>

          <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] flex-wrap gap-2">
            <span className="text-zinc-400">
              Destino:{' '}
              <strong className="text-white font-mono tabular-nums">
                {activeCleanPhone ? `+${activeCleanPhone}` : 'Sin configurar'}
              </strong>
            </span>
            {activeCleanPhone && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Vinculado
              </span>
            )}
          </div>
        </form>

        <div className="lg:col-span-7 p-4 rounded-xl bg-[#07090f]/60 border border-white/10 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Bot className="w-4 h-4 text-[#e5c88b]" />
            <span>Cómo trabaja el Agente con el Vendedor</span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Toda la comunicación y los reportes suceden directamente en el WhatsApp del vendedor de <strong className="text-zinc-200">{product.nombre}</strong>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="text-xs font-semibold text-[#e5c88b] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>1. Reportes Ejecutivos</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Cada confirmación envía un resumen ordenado y enumerado al WhatsApp del vendedor.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="text-xs font-semibold text-[#e5c88b] flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>2. Consultas Directas</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                El vendedor puede consultar pedidos en curso o confirmados directamente por WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
