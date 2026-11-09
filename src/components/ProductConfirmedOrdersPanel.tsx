import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Truck,
  Clock,
  DollarSign,
  ChevronDown,
  User,
  Phone,
  MapPin,
  Home,
  PackageCheck,
  ShieldCheck,
  FileCheck2,
  Edit3,
  Plus,
  Minus,
  Save,
  Ban,
  Trash2,
  X,
  Download,
  Filter,
  Copy
} from 'lucide-react';
import { Order, ProductPage } from '../types';
import { formatGs } from '../config';
import {
  isOrderConfirmedByAgent,
  isOrderPrepaymentSentPendingVerification,
  isOrderPrepaymentVerifiedAndPaid,
  buildOrderComparisonSummary,
  filterAdminOrders
} from '../utils/orderConfirmation';

export function downloadConfirmedOrdersExcelCsv(product: ProductPage, rawOrders: Order[]): number {
  const confirmed = rawOrders.filter(o => !o.archivado && isOrderConfirmedByAgent(o));
  const targetList = confirmed.length > 0 ? confirmed : rawOrders.filter(o => !o.archivado);
  if (targetList.length === 0) return 0;

  const escapeCsv = (val: unknown): string => {
    const str = String(val ?? '')
      .replace(/\r?\n|\r/g, ' ')
      .trim();
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headers = [
    'Nro',
    'ID Reserva',
    'Fecha y Hora',
    'Producto',
    'Unidades (Pack)',
    'Total a Cobrar (Gs.)',
    'Cliente Confirmado',
    'WhatsApp Validado',
    'Ciudad / Departamento',
    'Barrio',
    'Calle / Direccion Exacta',
    'Tipo Domicilio',
    'Color Casa / Fachada',
    'Referencia Exacta Confirmada IA',
    'Link Mapa GPS',
    'Estado Logistico'
  ];

  const rows = targetList.map((ord, idx) => {
    const comp = buildOrderComparisonSummary(ord);
    const isConcretado = Boolean(ord.concretadoCobrado || ord.estado === 'entregado_pagado');
    const isEnviado = Boolean(
      isConcretado || ord.estadoEnvioProducto === 'enviado' || ord.estado === 'en_camino'
    );
    const estadoLog = isConcretado
      ? 'CONCRETADO (Entregado y Cobrado)'
      : isEnviado
        ? 'ENVIADO CON COURIER'
        : 'LISTO PARA PREPARAR Y ENVIAR';

    const fechaStr = ord.fecha
      ? new Date(ord.fecha).toLocaleString('es-PY', { hour12: false })
      : new Date().toLocaleString('es-PY', { hour12: false });

    const gpsLink =
      comp.gpsLink ||
      ord.gpsLink ||
      (typeof ord.gpsLat === 'number' && typeof ord.gpsLng === 'number'
        ? `https://www.google.com/maps?q=${ord.gpsLat.toFixed(6)},${ord.gpsLng.toFixed(6)}`
        : '');

    return [
      idx + 1,
      ord.reservaid || '',
      fechaStr,
      product.nombre || ord.producto || '',
      `${Number(ord.cantidad) || 1} un.`,
      Number(ord.monto) || 0,
      comp.nombreConfirmado || ord.nombre || '',
      comp.celularConfirmado || ord.celular || '',
      comp.ubicacionConfirmada || ord.ciudad || '',
      (ord as any).barrio || '',
      comp.direccionConfirmada || ord.direccion || '',
      (ord as any).tipoDomicilio || 'Casa',
      (ord as any).colorCasa || '',
      comp.referenciaConfirmada || ord.referenciaCasa || '',
      gpsLink,
      estadoLog
    ]
      .map(escapeCsv)
      .join(';');
  });

  // Usamos BOM UTF-8 (\uFEFF) y punto y coma (;) para que Microsoft Excel en español abra las columnas automáticamente sin desconfigurar acentos
  const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanSlug = (product.slug || product.nombre || 'producto')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
  const dateTag = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `pedidos-confirmados-${cleanSlug}-${dateTag}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return targetList.length;
}

export interface PrepaymentVerificationSectionProps {
  order: Order;
  onUpdateOrder: (
    orderId: string,
    updates: Partial<Order>,
    toastMessage?: string
  ) => Promise<void>;
  onMovedToPrepaidTab?: () => void;
}

export const PrepaymentVerificationSection: React.FC<PrepaymentVerificationSectionProps> = ({
  order,
  onUpdateOrder,
  onMovedToPrepaidTab
}) => {
  const [togglingSwitch, setTogglingSwitch] = useState(false);
  const [showFullReceiptModal, setShowFullReceiptModal] = useState(false);

  const isSentPending = isOrderPrepaymentSentPendingVerification(order);
  const isVerifiedPaid = isOrderPrepaymentVerifiedAndPaid(order);

  const rawMontoNum =
    Number(String(order.montoOriginalSinDescuento || order.monto || 189000).replace(/\D/g, '')) || 189000;
  const discountedMontoNum =
    Number(order.montoConDescuentoAdelantado) || Math.max(50000, rawMontoNum - 50000);
  const bancoNombre = order.pagoAdelantadoBanco || 'Banco Familiar';
  const aliasCuenta = order.pagoAdelantadoAlias || '3856033 (3.856.033)';
  const titularCuenta = order.pagoAdelantadoTitular || 'Richard Almirón';

  const handleToggleVerifiedSwitch = async () => {
    setTogglingSwitch(true);
    try {
      const nextVerified = !isVerifiedPaid;
      const nowIso = new Date().toISOString();
      await onUpdateOrder(
        order.reservaid,
        {
          datosConfirmados: true,
          empaquetado: true,
          pagoAdelantadoComprobanteRecibido: true,
          pagoAdelantadoVerificadoAdmin: nextVerified,
          pagoAdelantadoEstado: nextVerified
            ? 'pagado_adelantado_confirmado'
            : 'pago_enviado_por_verificar',
          pagoAdelantadoFecha: order.pagoAdelantadoFecha || nowIso,
          pagoAdelantadoFechaVerificado: nextVerified ? nowIso : undefined,
          pagoAdelantadoBanco: bancoNombre,
          pagoAdelantadoAlias: aliasCuenta,
          pagoAdelantadoTitular: titularCuenta,
          montoOriginalSinDescuento: rawMontoNum,
          montoConDescuentoAdelantado: discountedMontoNum
        },
        nextVerified
          ? `💎 ¡Pago Adelantado de ${order.nombre} CONFIRMADO! El pedido se movió automáticamente a la pestaña "💎 Pago Adelantado".`
          : `⏳ Pedido #${order.reservaid} devuelto a estado "Pago Enviado (Por Verificar)" en Confirmados.`
      );
      if (nextVerified && onMovedToPrepaidTab) {
        onMovedToPrepaidTab();
      }
    } finally {
      setTogglingSwitch(false);
    }
  };

  const handleMarkPaymentSentPending = async () => {
    setTogglingSwitch(true);
    try {
      const nowIso = new Date().toISOString();
      await onUpdateOrder(
        order.reservaid,
        {
          pagoAdelantadoComprobanteRecibido: true,
          pagoAdelantadoVerificadoAdmin: false,
          pagoAdelantadoEstado: 'pago_enviado_por_verificar',
          pagoAdelantadoFecha: order.pagoAdelantadoFecha || nowIso,
          pagoAdelantadoBanco: bancoNombre,
          pagoAdelantadoAlias: aliasCuenta,
          pagoAdelantadoTitular: titularCuenta,
          montoOriginalSinDescuento: rawMontoNum,
          montoConDescuentoAdelantado: discountedMontoNum
        },
        `⚡ Pedido #${order.reservaid} marcado con brillo "Pago Enviado (Por Verificar)".`
      );
    } finally {
      setTogglingSwitch(false);
    }
  };

  const handleUploadReceiptFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) return;
      const nowIso = new Date().toISOString();
      await onUpdateOrder(
        order.reservaid,
        {
          comprobantePagoDataUrl: dataUrl,
          comprobantePagoMimeType: file.type || 'image/jpeg',
          comprobantePagoNombreArchivo: file.name || 'comprobante.jpg',
          pagoAdelantadoComprobanteRecibido: true,
          pagoAdelantadoEstado: isVerifiedPaid
            ? 'pagado_adelantado_confirmado'
            : 'pago_enviado_por_verificar',
          pagoAdelantadoFecha: order.pagoAdelantadoFecha || nowIso,
          pagoAdelantadoBanco: bancoNombre,
          pagoAdelantadoAlias: aliasCuenta,
          pagoAdelantadoTitular: titularCuenta,
          montoOriginalSinDescuento: rawMontoNum,
          montoConDescuentoAdelantado: discountedMontoNum
        },
        `🧾 Comprobante de pago adjuntado al pedido de ${order.nombre}.`
      );
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      data-testid={`prepayment-verification-box-${order.reservaid}`}
      className={`p-3.5 sm:p-4 rounded-2xl border transition-all space-y-3 ${
        isVerifiedPaid
          ? 'bg-gradient-to-r from-cyan-950/70 via-indigo-950/60 to-amber-950/60 border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.28)]'
          : isSentPending
            ? 'bg-gradient-to-r from-amber-950/80 via-fuchsia-950/50 to-amber-950/80 border-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.38)]'
            : 'bg-zinc-900/90 border-amber-500/40'
      }`}
    >
      {/* CABECERA DEL PANEL DE VERIFICACIÓN DE PAGO ADELANTADO */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2 flex-wrap">
          {isVerifiedPaid ? (
            <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-400 via-sky-300 to-amber-300 text-slate-950 text-[11px] font-black uppercase tracking-wider shadow-[0_0_14px_rgba(34,211,238,0.6)]">
              💎 PAGO ADELANTADO CONFIRMADO
            </span>
          ) : isSentPending ? (
            <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 text-black text-[11px] font-black uppercase tracking-wider shadow-[0_0_14px_rgba(251,191,36,0.7)] animate-pulse">
              ⚡ PAGO ENVIADO · FALTA TU VERIFICACIÓN
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-amber-950 text-amber-300 border border-amber-700 text-[10px] font-black uppercase tracking-wider">
              🏦 Verificación de Transferencia / Pago Adelantado (-Gs. 50.000)
            </span>
          )}
          <span className="text-xs font-black text-white">
            {isVerifiedPaid
              ? 'Transferencia comprobada por el vendedor · Movido a pestaña Pago Adelantado'
              : isSentPending
                ? '¡Este cliente envió comprobante de transferencia! Revisá tu cuenta de Banco Familiar por el nombre y activá el interruptor:'
                : 'Si el cliente transfirió con la promo de -50.000 Gs., verificá sus datos y activá el interruptor:'}
          </span>
        </div>

        {/* INTERRUPTOR OFICIAL (SWITCH) PARA CONFIRMAR PAGO ADELANTADO */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {!isSentPending && !isVerifiedPaid && (
            <button
              type="button"
              disabled={togglingSwitch}
              onClick={handleMarkPaymentSentPending}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 text-[11px] font-black cursor-pointer transition-all"
              title="Marcar que el cliente avisó o envió pago adelantado pendiente de revisar en el banco"
            >
              ⚡ Marcar &quot;Pago Enviado&quot;
            </button>
          )}

          <button
            type="button"
            role="switch"
            aria-checked={isVerifiedPaid}
            data-testid={`switch-verify-prepayment-${order.reservaid}`}
            disabled={togglingSwitch}
            onClick={handleToggleVerifiedSwitch}
            className={`px-3.5 py-2 rounded-xl font-black text-xs inline-flex items-center gap-2.5 cursor-pointer transition-all border ${
              isVerifiedPaid
                ? 'bg-gradient-to-r from-cyan-400 via-sky-300 to-amber-300 text-slate-950 border-white shadow-[0_0_18px_rgba(34,211,238,0.65)]'
                : 'bg-zinc-950 hover:bg-zinc-900 text-amber-200 border-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
            }`}
          >
            {/* Switch Track & Thumb */}
            <span
              className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors ${
                isVerifiedPaid ? 'bg-slate-950 justify-end' : 'bg-zinc-700 justify-start'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full transition-transform ${
                  isVerifiedPaid ? 'bg-cyan-400' : 'bg-amber-400'
                }`}
              />
            </span>
            <span>
              {isVerifiedPaid
                ? '💎 Pago Adelantado Confirmado (Activo)'
                : 'Confirmar Pago Adelantado (Pasar a Pestaña Pago Adelantado)'}
            </span>
          </button>
        </div>
      </div>

      {/* GRILLA DE DATOS DE LA TRANSFERENCIA + VISTA DEL COMPROBANTE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Datos del Cliente y Cuenta Bancaria a Verificar */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-black/50 border border-white/15 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
              👤 1. Nombre Completo del Cliente (Buscar en tu Banco)
            </span>
            <div className="text-sm font-black text-white">{order.nombre}</div>
            <div className="text-[11px] font-mono text-zinc-300">
              📱 WhatsApp: {order.celular}
            </div>
            {order.pagoAdelantadoFecha && (
              <div className="text-[10px] text-zinc-400">
                🕒 Enviado: {new Date(order.pagoAdelantadoFecha).toLocaleString('es-PY', { hour12: false })}
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-black/50 border border-white/15 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 block">
              🏛️ 2. Cuenta y Banco Destino Transferido
            </span>
            <div className="text-xs font-black text-white">
              Banco: <span className="text-cyan-300">{bancoNombre}</span>
            </div>
            <div className="text-xs font-mono font-black text-amber-300">
              🔑 Alias: {aliasCuenta}
            </div>
            <div className="text-[11px] text-zinc-200">
              🎯 Titular: <strong>{titularCuenta}</strong>
            </div>
          </div>

          <div className="sm:col-span-2 p-2.5 rounded-xl bg-black/60 border border-white/15 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-black uppercase text-zinc-400 block">
                💰 Monto con Promo Exclusiva (-Gs. 50.000)
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs line-through text-zinc-500 font-mono">
                  Normal: {formatGs(rawMontoNum)}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-amber-300 font-mono text-xs font-black">
                  Transferido: {formatGs(discountedMontoNum)}
                </span>
              </div>
            </div>

            <label className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors">
              <span>📷 {order.comprobantePagoDataUrl ? 'Cambiar Comprobante' : 'Subir Captura Comprobante'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadReceiptFile}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Vista Previa del Comprobante Enviado por WhatsApp */}
        <div className="lg:col-span-5 p-3 rounded-xl bg-black/60 border border-white/15 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
              🧾 3. Comprobante del Pago Recibido
            </span>
            {order.comprobantePagoDataUrl && (
              <button
                type="button"
                onClick={() => setShowFullReceiptModal(true)}
                className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-[10px] font-black cursor-pointer"
              >
                🔍 Ampliar Comprobante
              </button>
            )}
          </div>

          {order.comprobantePagoDataUrl ? (
            <div className="flex items-center gap-3">
              {order.comprobantePagoDataUrl.startsWith('data:image/') ? (
                <img
                  src={order.comprobantePagoDataUrl}
                  alt={`Comprobante de ${order.nombre}`}
                  onClick={() => setShowFullReceiptModal(true)}
                  className="w-20 h-20 rounded-xl object-cover border-2 border-amber-400 cursor-pointer hover:opacity-90 shrink-0 shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-zinc-900 border border-amber-400 flex items-center justify-center text-center p-1 text-[10px] font-black text-amber-300 shrink-0">
                  📄 PDF / Doc Adjunto
                </div>
              )}
              <div className="space-y-1 text-[11px] text-zinc-200 min-w-0">
                <div className="font-black text-emerald-300">
                  ✓ Captura recibida y guardada en la ficha
                </div>
                <p className="text-zinc-400 text-[10px] leading-snug">
                  Hacé clic en la imagen para ver el comprobante en grande y corroborar el pago de{' '}
                  <strong className="text-white">{order.nombre}</strong> en {bancoNombre}.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-3 px-2 rounded-lg border border-dashed border-zinc-700 text-center text-[11px] text-zinc-400">
              {isSentPending
                ? '⚡ El cliente avisó que ya realizó la transferencia por chat. Verificá en tu app de Banco Familiar por el nombre del cliente o adjuntá la captura acá.'
                : 'Aún no se recibió captura de comprobante por WhatsApp en este pedido.'}
            </div>
          )}
        </div>
      </div>

      {/* MODAL PARA VER EL COMPROBANTE EN PANTALLA COMPLETA */}
      {showFullReceiptModal && order.comprobantePagoDataUrl && (
        <div
          onClick={() => setShowFullReceiptModal(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="max-w-lg w-full bg-zinc-950 border border-amber-400/80 rounded-2xl p-4 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div>
                <h4 className="text-sm font-black text-white">
                  🧾 Comprobante de Pago — {order.nombre}
                </h4>
                <p className="text-[11px] text-amber-300 font-mono">
                  {bancoNombre} · Alias {aliasCuenta} · Titular: {titularCuenta} · {formatGs(discountedMontoNum)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullReceiptModal(false)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black cursor-pointer"
              >
                ✕ Cerrar
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex justify-center bg-black rounded-xl p-2">
              <img
                src={order.comprobantePagoDataUrl}
                alt={`Comprobante completo ${order.nombre}`}
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ProductConfirmedOrdersPanelProps {
  product: ProductPage;
  orders: Order[];
  panelMode?: 'confirmados' | 'pagos_adelantados';
  onSwitchSubTab?: (tab: 'confirmados' | 'pagos_adelantados') => void;
  onUpdateOrderLogistics: (
    orderId: string,
    updates: Partial<Order>,
    toastMessage?: string
  ) => Promise<void>;
  onRequestDeleteOrders?: (orderIds: string[]) => void;
  onClose?: () => void;
}

export const ProductConfirmedOrdersPanel: React.FC<ProductConfirmedOrdersPanelProps> = ({
  product,
  orders,
  panelMode = 'confirmados',
  onSwitchSubTab,
  onUpdateOrderLogistics,
  onRequestDeleteOrders,
  onClose
}) => {
  const isPrepaidTab = panelMode === 'pagos_adelantados';

  // REGLA ESTRICTA DEL USUARIO:
  // - En la pestaña "✅ Confirmados": están los pedidos confirmados que TODAVÍA NO pasaron a "💎 Pago Adelantado".
  //   (Si un pedido recibió pago enviado pero aún no fue verificado con el interruptor, brilla acá con color característico ámbar/dorado para que el vendedor lo vea y lo verifique).
  // - Una vez que el vendedor activa el interruptor de "Confirmado Pago Adelantado", ese pedido YA NO FIGURA en "✅ Confirmados" y pasa exclusivamente a la nueva pestaña "💎 Pago Adelantado".
  const allConfirmedOrders = useMemo(() => {
    if (isPrepaidTab) {
      return orders.filter(o => isOrderPrepaymentVerifiedAndPaid(o));
    }
    return orders.filter(o => isOrderConfirmedByAgent(o) && !isOrderPrepaymentVerifiedAndPaid(o));
  }, [orders, isPrepaidTab]);

  // Filtros compactos desplegables con un simple botón
  const [showFiltersBar, setShowFiltersBar] = useState<boolean>(false);
  const [filterName, setFilterName] = useState<string>('');
  const [filterPhone, setFilterPhone] = useState<string>('');
  const [filterLogisticsState, setFilterLogisticsState] = useState<
    'todos' | 'no_enviado' | 'enviado' | 'concretado'
  >('todos');
  const [selectedConfirmedIds, setSelectedConfirmedIds] = useState<string[]>([]);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  const confirmedOrders = useMemo(() => {
    const byTextAndPhone = filterAdminOrders(allConfirmedOrders, {
      nameQuery: filterName,
      phoneQuery: filterPhone,
      archiveMode: 'todos'
    });
    if (filterLogisticsState === 'todos') return byTextAndPhone;
    return byTextAndPhone.filter(o => {
      const isConcretado = Boolean(o.concretadoCobrado || o.estado === 'entregado_pagado');
      const isEnviado = Boolean(
        isConcretado || o.estadoEnvioProducto === 'enviado' || o.estado === 'en_camino'
      );
      if (filterLogisticsState === 'concretado') return isConcretado;
      if (filterLogisticsState === 'enviado') return isEnviado && !isConcretado;
      return !isEnviado;
    });
  }, [allConfirmedOrders, filterName, filterPhone, filterLogisticsState]);

  const allFilteredIds = useMemo(
    () => confirmedOrders.map(o => o.reservaid),
    [confirmedOrders]
  );
  const selectedFilteredIds = useMemo(
    () => allFilteredIds.filter(id => selectedConfirmedIds.includes(id)),
    [allFilteredIds, selectedConfirmedIds]
  );
  const isAllConfirmedSelected =
    allFilteredIds.length > 0 && allFilteredIds.every(id => selectedConfirmedIds.includes(id));

  const toggleSelectConfirmedOrder = (reservaid: string) => {
    const clean = String(reservaid || '').trim();
    if (!clean) return;
    setSelectedConfirmedIds(prev =>
      prev.includes(clean) ? prev.filter(id => id !== clean) : [...prev, clean]
    );
  };

  const toggleSelectAllConfirmed = () => {
    if (allFilteredIds.length === 0) return;
    if (isAllConfirmedSelected) {
      const removeSet = new Set(allFilteredIds);
      setSelectedConfirmedIds(prev => prev.filter(id => !removeSet.has(id)));
    } else {
      setSelectedConfirmedIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [selectedUniversalOrderId, setSelectedUniversalOrderId] = useState<string>(
    allConfirmedOrders[0]?.reservaid || 'TODOS'
  );
  const [updatingLogistics, setUpdatingLogistics] = useState<boolean>(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editCantidad, setEditCantidad] = useState<number>(1);
  const [editMonto, setEditMonto] = useState<number>(189000);
  const [editDireccion, setEditDireccion] = useState<string>('');
  const [editCiudad, setEditCiudad] = useState<string>('');
  const [editReferencia, setEditReferencia] = useState<string>('');

  const calculatePriceForUnits = (units: number): number => {
    const p1 = Number(product.precios?.[1]) || 189000;
    const p2 = Number(product.precios?.[2]) || 358000;
    const p3 = Number(product.precios?.[3]) || 507000;
    if (units === 1) return p1;
    if (units === 2) return p2;
    if (units === 3) return p3;
    return p3 + (units - 3) * (p1 - 20000);
  };

  const openManualEditor = (ord: Order) => {
    setEditingOrderId(ord.reservaid);
    setEditCantidad(Number(ord.cantidad) || 1);
    setEditMonto(Number(ord.monto) || calculatePriceForUnits(Number(ord.cantidad) || 1));
    setEditDireccion(ord.direccion || '');
    setEditCiudad(ord.ciudad || '');
    setEditReferencia(ord.referenciaCasa || '');
  };

  const stats = useMemo(() => {
    const total = allConfirmedOrders.length;
    const enviados = allConfirmedOrders.filter(
      o => o.estadoEnvioProducto === 'enviado' || o.estado === 'en_camino' || o.estado === 'entregado_pagado'
    ).length;
    const noEnviados = total - enviados;
    const concretados = allConfirmedOrders.filter(
      o => o.concretadoCobrado || o.estado === 'entregado_pagado'
    ).length;
    return { total, enviados, noEnviados, concretados };
  }, [allConfirmedOrders]);

  const handleCopyDispatchList = () => {
    if (confirmedOrders.length === 0) return;
    const textLines = confirmedOrders.map((ord, idx) => {
      const comp = buildOrderComparisonSummary(ord);
      const gps =
        comp.gpsLink ||
        ord.gpsLink ||
        (typeof ord.gpsLat === 'number' && typeof ord.gpsLng === 'number'
          ? `https://www.google.com/maps?q=${ord.gpsLat.toFixed(6)},${ord.gpsLng.toFixed(6)}`
          : 'Sin link GPS');
      return (
        `📦 PEDIDO CONFIRMADO #${idx + 1} (${ord.reservaid})\n` +
        `• Producto: ${product.nombre} (${ord.cantidad} un. - ${formatGs(ord.monto)})\n` +
        `• Cliente: ${comp.nombreConfirmado}\n` +
        `• WhatsApp: ${comp.celularConfirmado}\n` +
        `• Ciudad/Dirección: ${comp.ubicacionConfirmada} — ${comp.direccionConfirmada}\n` +
        `• Referencia Casa: ${comp.referenciaConfirmada}\n` +
        `• Mapa GPS: ${gps}`
      );
    });
    try {
      navigator.clipboard.writeText(textLines.join('\n\n────────────────────────\n\n'));
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {}
  };

  // Función Universal del Producto para marcar los pasos manualmente (No Enviado / Enviado / Concretado)
  const handleUniversalStepMark = async (
    stepAction: 'no_enviado' | 'enviado' | 'concretado'
  ) => {
    if (confirmedOrders.length === 0) return;
    setUpdatingLogistics(true);

    try {
      const targetList =
        selectedFilteredIds.length > 0
          ? confirmedOrders.filter(o => selectedFilteredIds.includes(o.reservaid))
          : selectedUniversalOrderId === 'TODOS'
            ? confirmedOrders
            : confirmedOrders.filter(o => o.reservaid === selectedUniversalOrderId);

      for (const ord of targetList) {
        if (stepAction === 'no_enviado') {
          await onUpdateOrderLogistics(
            ord.reservaid,
            {
              estadoEnvioProducto: 'no_enviado',
              concretadoCobrado: false,
              estado: 'reservado'
            },
            `⏳ Pedido #${ord.reservaid} marcado como NO ENVIADO.`
          );
        } else if (stepAction === 'enviado') {
          await onUpdateOrderLogistics(
            ord.reservaid,
            {
              estadoEnvioProducto: 'enviado',
              concretadoCobrado: false,
              estado: 'en_camino'
            },
            `📦 Pedido #${ord.reservaid} marcado como ENVIADO con el courier.`
          );
        } else if (stepAction === 'concretado') {
          await onUpdateOrderLogistics(
            ord.reservaid,
            {
              estadoEnvioProducto: 'enviado',
              concretadoCobrado: true,
              estado: 'entregado_pagado'
            },
            `💰 Pedido #${ord.reservaid} marcado como CONCRETADO (Entregado y Cobrado).`
          );
        }
      }
    } finally {
      setUpdatingLogistics(false);
    }
  };

  const hasActiveFilter = Boolean(filterName || filterPhone || filterLogisticsState !== 'todos' || selectedFilteredIds.length > 0);

  return (
    <div
      className={`p-3 sm:p-4 rounded-2xl bg-[#0d0d0f] border shadow-md space-y-3 animate-fadeIn text-zinc-100 ${
        isPrepaidTab
          ? 'border-cyan-400/70 shadow-[0_0_25px_rgba(34,211,238,0.18)]'
          : 'border-emerald-900/60'
      }`}
    >
      {/* Cabecera Compacta con Descarga 1-Clic en Excel + Copiar p/ Despacho + Botón Compacto de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          {isPrepaidTab ? (
            <span className="px-2.5 py-0.5 rounded-md bg-gradient-to-r from-cyan-400 via-sky-300 to-amber-300 text-slate-950 text-[10px] font-black uppercase tracking-wider shrink-0 shadow-[0_0_12px_rgba(34,211,238,0.5)]">
              💎 Pago Adelantado ({confirmedOrders.length})
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-[#16a34a] text-white text-[10px] font-black uppercase tracking-wider shrink-0">
              ✅ Confirmados ({confirmedOrders.length})
            </span>
          )}
          <h4 className="text-xs sm:text-sm font-black text-zinc-100 truncate">
            {product.nombre}
          </h4>
          <span className="hidden xl:inline text-[11px] text-zinc-400 truncate">
            {isPrepaidTab
              ? '— Pedidos confirmados que YA PAGARON por adelantado en Banco Familiar (Alias 3856033)'
              : '— Listos para empaquetar y enviar (los que ya pagaron por adelantado pasan a su propia pestaña)'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <button
            type="button"
            data-testid="download-confirmed-excel-btn"
            disabled={confirmedOrders.length === 0}
            onClick={() => downloadConfirmedOrdersExcelCsv(product, confirmedOrders)}
            className="h-8 px-3 rounded-xl bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-40 text-white text-[11px] font-black inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
            title="Descargar planilla Excel (.csv) con todos los pedidos confirmados y datos completos para despacho"
          >
            <Download className="w-3.5 h-3.5" />
            <span>📥 Descargar Excel ({confirmedOrders.length})</span>
          </button>

          <button
            type="button"
            disabled={confirmedOrders.length === 0}
            onClick={handleCopyDispatchList}
            className="h-8 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-700 text-zinc-200 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all"
            title="Copiar fichas completas en texto para enviar por WhatsApp al empaquetador o courier"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-400" />
            <span>{copiedSummary ? '✓ Copiado' : 'Copiar p/ Courier'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFiltersBar(prev => !prev)}
            className={`h-8 px-2.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
              showFiltersBar || hasActiveFilter
                ? 'bg-emerald-950/90 border-emerald-600 text-emerald-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
            }`}
            title="Mostrar u ocultar filtros y selección múltiple"
          >
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>🔍 Filtrar</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-2.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-medium text-zinc-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* BARRA DE FILTROS + SELECCIÓN MÚLTIPLE (Se abre solo al tocar el botón Filtrar) */}
      {(showFiltersBar || hasActiveFilter) && (
      <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xs space-y-2.5 animate-fadeIn">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
          <div className="lg:col-span-4">
            <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
              🔍 Filtrar Confirmados por Nombre o Reserva
            </label>
            <div className="relative">
              <input
                type="text"
                data-testid="confirmed-filter-name"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                placeholder="Ej: Nombre del cliente o NX-..."
                className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-zinc-800 text-xs font-medium text-zinc-100 bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
              />
              {filterName && (
                <button
                  type="button"
                  onClick={() => setFilterName('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs font-black cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
              📱 Filtrar por Teléfono
            </label>
            <div className="relative">
              <input
                type="text"
                data-testid="confirmed-filter-phone"
                value={filterPhone}
                onChange={e => setFilterPhone(e.target.value)}
                placeholder="Ej: 0973... o 595..."
                className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-zinc-800 text-xs font-mono font-medium text-zinc-100 bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
              />
              {filterPhone && (
                <button
                  type="button"
                  onClick={() => setFilterPhone('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs font-black cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
              🚚 Filtrar por Estado de Entrega
            </label>
            <div className="grid grid-cols-4 gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
              {[
                { id: 'todos' as const, label: `Todos (${stats.total})` },
                { id: 'no_enviado' as const, label: `Pend. (${stats.noEnviados})` },
                { id: 'enviado' as const, label: `Env. (${stats.enviados})` },
                { id: 'concretado' as const, label: `Cobrado (${stats.concretados})` }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterLogisticsState(tab.id)}
                  className={`py-1.5 px-1.5 rounded-lg text-[10px] font-black cursor-pointer transition-all truncate ${
                    filterLogisticsState === tab.id
                      ? 'bg-[#16a34a] text-white shadow-2xs'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selección de Uno, Varios o Todos + Botón de Eliminar Seleccionados */}
        <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              data-testid="confirmed-select-all-btn"
              onClick={toggleSelectAllConfirmed}
              disabled={allFilteredIds.length === 0}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border inline-flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 ${
                isAllConfirmedSelected
                  ? 'bg-emerald-950 text-white border-emerald-700'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-750'
              }`}
            >
              <input
                type="checkbox"
                readOnly
                checked={isAllConfirmedSelected}
                className="w-3.5 h-3.5 accent-[#16a34a] pointer-events-none"
              />
              <span>
                {isAllConfirmedSelected
                  ? `Deseleccionar todos (${allFilteredIds.length})`
                  : `Seleccionar todos (${allFilteredIds.length})`}
              </span>
            </button>

            {selectedFilteredIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedConfirmedIds([])}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800 cursor-pointer"
              >
                Limpiar selección ({selectedFilteredIds.length})
              </button>
            )}
          </div>

          {onRequestDeleteOrders && (
            <button
              type="button"
              data-testid="confirmed-bulk-delete-btn"
              disabled={selectedFilteredIds.length === 0}
              onClick={() => onRequestDeleteOrders(selectedFilteredIds)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-40 text-white border border-red-800 shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-all"
              title="Eliminar los pedidos confirmados seleccionados"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar seleccionados ({selectedFilteredIds.length})</span>
            </button>
          )}
        </div>
      </div>
      )}

      {/* FUNCIÓN UNIVERSAL SEPARADA DEL PRODUCTO: MARCAR ENVIADO / NO ENVIADO / CONCRETADO (En 1 fila compacta) */}
      <div className="p-2.5 sm:p-3 rounded-xl bg-[#062319] text-white border border-[#25D366]/40 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-[#25D366] flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" />
            <span>Logística y Despacho ({selectedFilteredIds.length > 0 ? `${selectedFilteredIds.length} seleccionados` : 'Selector Rápido'})</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-black shrink-0 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-white/10 text-amber-300">
              ⏳ No Enviados: {stats.noEnviados}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-200 border border-blue-400/30">
              📦 Enviados: {stats.enviados}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40">
              💰 Concretados: {stats.concretados}
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 pt-1">
          <select
            aria-label="Seleccionar pedido confirmado para marcar estado logístico"
            value={selectedUniversalOrderId}
            onChange={e => setSelectedUniversalOrderId(e.target.value)}
            className="w-full lg:flex-1 lg:max-w-md px-3 py-2 rounded-xl bg-black/40 border border-white/20 text-xs font-bold text-white outline-none focus:border-[#25D366] truncate"
          >
            {confirmedOrders.map((ord, idx) => (
              <option key={ord.reservaid} value={ord.reservaid} className="bg-[#062319] text-white">
                #{idx + 1} · Reserva {ord.reservaid} — {ord.nombre} ({ord.ciudad.split(',')[0]})
              </option>
            ))}
            {confirmedOrders.length > 1 && (
              <option value="TODOS" className="bg-[#062319] text-[#e8b23a] font-black">
                ⚡ Aplicar a TODOS los pedidos confirmados ({confirmedOrders.length})
              </option>
            )}
          </select>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              disabled={updatingLogistics || confirmedOrders.length === 0}
              onClick={() => handleUniversalStepMark('no_enviado')}
              className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-200 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Marcar No Enviado</span>
            </button>

            <button
              type="button"
              disabled={updatingLogistics || confirmedOrders.length === 0}
              onClick={() => handleUniversalStepMark('enviado')}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Marcar Enviado</span>
            </button>

            <button
              type="button"
              disabled={updatingLogistics || confirmedOrders.length === 0}
              onClick={() => handleUniversalStepMark('concretado')}
              className="px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#041911] text-xs font-black inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Marcar Concretado (Entregado y Cobrado)</span>
            </button>
          </div>
        </div>
      </div>

      {/* LISTA DE TARJETAS HORIZONTALES ENUMERADAS (#1, #2, #3...) CON CASILLA DE SELECCIÓN Y ELIMINADO */}
      {confirmedOrders.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#09090b] border border-dashed border-zinc-800 text-center space-y-2">
          <PackageCheck className={`w-8 h-8 mx-auto opacity-70 ${isPrepaidTab ? 'text-cyan-400' : 'text-emerald-500'}`} />
          <div className="text-sm font-black text-zinc-300">
            {isPrepaidTab
              ? 'Aún no hay pedidos verificados en la pestaña de Pago Adelantado'
              : 'No se encontraron pedidos confirmados pendientes de pago contra entrega con el filtro actual'}
          </div>
          {isPrepaidTab && (
            <p className="text-xs text-zinc-400 max-w-lg mx-auto">
              Cuando un cliente envíe su comprobante de transferencia a Banco Familiar (Alias 3856033) y actives el interruptor de confirmación dentro del pedido, aparecerá automáticamente en esta lista exclusiva.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {confirmedOrders.map((ord, index) => {
            const numOrder = index + 1;
            const isCardOpen = expandedOrderId === ord.reservaid;
            const isChecked = selectedConfirmedIds.includes(ord.reservaid);
            const comparison = buildOrderComparisonSummary(ord);
            const isConcretado = Boolean(ord.concretadoCobrado || ord.estado === 'entregado_pagado');
            const isEnviado = Boolean(
              isConcretado || ord.estadoEnvioProducto === 'enviado' || ord.estado === 'en_camino'
            );
            const isPrepaySentPending = isOrderPrepaymentSentPendingVerification(ord);
            const isPrepayVerified = isOrderPrepaymentVerifiedAndPaid(ord);
            const displayAmount =
              isPrepaySentPending || isPrepayVerified
                ? Number(ord.montoConDescuentoAdelantado) || Math.max(50000, (Number(ord.monto) || 189000) - 50000)
                : Number(ord.monto) || 189000;

            return (
              <div key={ord.reservaid} className="w-full">
                {/* Tarjeta Horizontal Compacta con Brillo Característico (NO verde) cuando tiene Pago Enviado o Pago Adelantado */}
                <div
                  onClick={() => {
                    setExpandedOrderId(isCardOpen ? null : ord.reservaid);
                    setSelectedUniversalOrderId(ord.reservaid);
                  }}
                  className={`w-full h-11 min-h-[44px] max-h-[44px] px-3 rounded-xl border flex items-center justify-between gap-2 text-left cursor-pointer select-none transition-all overflow-hidden ${
                    isPrepayVerified
                      ? 'border-cyan-400 bg-gradient-to-r from-cyan-950/75 via-indigo-950/60 to-amber-950/60 shadow-[0_0_20px_rgba(34,211,238,0.32)] ring-1 ring-cyan-400/50 text-white'
                      : isPrepaySentPending
                        ? 'border-amber-400 bg-gradient-to-r from-amber-950/80 via-fuchsia-950/55 to-amber-950/80 shadow-[0_0_22px_rgba(245,158,11,0.42)] ring-1 ring-amber-400/60 text-amber-50'
                        : isChecked
                          ? 'border-emerald-600 bg-emerald-950/70 ring-1 ring-emerald-500/30 text-emerald-100'
                          : 'border-zinc-800 bg-[#0d0d0f] hover:bg-zinc-900/90 text-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onClick={e => e.stopPropagation()}
                      onChange={() => toggleSelectConfirmedOrder(ord.reservaid)}
                      className="w-4 h-4 accent-[#16a34a] cursor-pointer shrink-0"
                    />
                    <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 shrink-0 tabular-nums">
                      #{numOrder}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-zinc-300 shrink-0 tabular-nums">
                      {ord.reservaid}
                    </span>
                    {isPrepayVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gradient-to-r from-cyan-400 via-sky-300 to-amber-300 text-slate-950 text-[9px] font-black uppercase tracking-tight shrink-0 shadow-[0_0_10px_rgba(34,211,238,0.6)]">
                        <span>💎 PAGO ADELANTADO</span>
                      </span>
                    ) : isPrepaySentPending ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 text-black text-[9px] font-black uppercase tracking-tight shrink-0 shadow-[0_0_12px_rgba(251,191,36,0.75)] animate-pulse">
                        <span>⚡ PAGO ENVIADO (VERIFICAR)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[9px] font-black uppercase tracking-tight shrink-0">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>Confirmado</span>
                      </span>
                    )}
                    <span className="font-extrabold text-xs text-zinc-100 truncate max-w-[140px] sm:max-w-[180px] shrink-0">
                      {ord.nombre}
                    </span>
                    <span className="hidden sm:inline-block font-mono text-[11px] font-bold text-zinc-300 tabular-nums whitespace-nowrap shrink-0">
                      {comparison.celularConfirmado}
                    </span>
                    <span className="hidden md:inline-block text-[11px] font-medium text-zinc-300 truncate max-w-[170px]">
                      📍 {ord.ciudad}
                    </span>
                    <span
                      className={`hidden lg:inline-block font-mono text-[11px] font-black tabular-nums whitespace-nowrap shrink-0 ${
                        isPrepayVerified
                          ? 'text-cyan-300'
                          : isPrepaySentPending
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                      }`}
                    >
                      {ord.cantidad}u · {formatGs(displayAmount)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isConcretado ? (
                      <span className="hidden sm:inline-block bg-[#e8b23a] text-[#041911] px-2 py-0.5 rounded text-[10px] font-black uppercase">
                        💰 Concretado
                      </span>
                    ) : isEnviado ? (
                      <span className="hidden sm:inline-block bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase">
                        📦 Enviado
                      </span>
                    ) : (
                      <span className="hidden sm:inline-block bg-amber-200 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                        ⏳ Listo p/ Envío
                      </span>
                    )}

                    {onRequestDeleteOrders && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onRequestDeleteOrders([ord.reservaid]);
                        }}
                        title="Eliminar este pedido"
                        className="h-7 px-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-black inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}

                    <span
                      className={`h-7 px-2.5 rounded-lg text-[10px] font-black inline-flex items-center gap-1 ${
                        isPrepayVerified
                          ? 'bg-cyan-400 text-slate-950'
                          : isPrepaySentPending
                            ? 'bg-amber-400 text-black'
                            : 'bg-[#15803d] text-white'
                      }`}
                    >
                      <span>{isCardOpen ? 'Cerrar' : isPrepaySentPending ? 'Ver Comprobante' : 'Abrir Pedido'}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${isCardOpen ? 'rotate-180' : ''}`}
                      />
                    </span>
                  </div>
                </div>

                {/* Detalle Desplegable: Panel de Verificación de Pago Adelantado + Ficha Completa del Cliente */}
                {isCardOpen && (
                  <div className="mt-1 p-3.5 sm:p-4 rounded-xl border border-zinc-800 bg-[#09090b] space-y-3.5">
                    {/* PANEL DE VERIFICACIÓN DE PAGO ADELANTADO Y COMPROBANTE CON INTERRUPTOR */}
                    <PrepaymentVerificationSection
                      order={ord}
                      onUpdateOrder={onUpdateOrderLogistics}
                      onMovedToPrepaidTab={() => {
                        if (!isPrepaidTab && onSwitchSubTab) {
                          onSwitchSubTab('pagos_adelantados');
                        }
                      }}
                    />

                    <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <FileCheck2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="text-xs font-black uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                            <span>Resumen de Confirmación del Agente IA</span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-900 border border-emerald-700 text-emerald-200 text-[10px]">
                              ✓ Datos Iguales Confirmados
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                            {comparison.resumenTexto}
                          </p>
                        </div>
                      </div>

                      {onRequestDeleteOrders && (
                        <button
                          type="button"
                          onClick={() => onRequestDeleteOrders([ord.reservaid])}
                          className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar Pedido</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2.5">
                        <div className="text-[11px] font-black uppercase tracking-wider text-zinc-300 border-b border-zinc-800 pb-1.5 flex items-center justify-between">
                          <span>1. Datos Cargados por el Cliente (Web)</span>
                          <span className="text-[10px] text-zinc-500 font-mono">Reserva {ord.reservaid}</span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-zinc-400">Nombre y Apellido:</span>
                            <strong className="text-zinc-100">{comparison.nombreWeb}</strong>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-zinc-400">Teléfono Cliente:</span>
                            <strong className="text-zinc-100 font-mono">{comparison.celularWeb}</strong>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-zinc-400">Ciudad y Depto:</span>
                            <strong className="text-zinc-100">{comparison.ubicacionWeb}</strong>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="text-zinc-400 shrink-0">Dirección:</span>
                            <strong className="text-zinc-100">{comparison.direccionWeb}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-900/60 space-y-2.5">
                        <div className="text-[11px] font-black uppercase tracking-wider text-zinc-200 border-b border-emerald-900/60 pb-1.5 flex items-center justify-between">
                          <span>2. Datos Confirmados por el Agente en Chat</span>
                          <span className="text-[10px] bg-emerald-900 text-emerald-200 border border-emerald-700 px-2 py-0.5 rounded font-black">
                            ✓ COINCIDEN
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-zinc-400">Titular Confirmado:</span>
                            <strong className="text-emerald-200">{comparison.nombreConfirmado}</strong>
                          </div>
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-zinc-400">WhatsApp Validado:</span>
                            <strong className="text-emerald-200 font-mono">{comparison.celularConfirmado}</strong>
                          </div>
                          <div className="flex items-start gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="text-zinc-400 shrink-0">Dirección Confirmada:</span>
                            <strong className="text-emerald-200">
                              {comparison.ubicacionConfirmada} — {comparison.direccionConfirmada}
                            </strong>
                          </div>
                          <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-start gap-2 mt-1">
                            <Home className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] font-black uppercase text-amber-400 block">
                                Referencia Exacta de la Casa / Fachada:
                              </span>
                              <strong className="text-xs text-amber-200">
                                {comparison.referenciaConfirmada}
                              </strong>
                            </div>
                          </div>
                          {comparison.gpsLink && (
                            <div className="p-2.5 rounded-xl bg-[#062319] text-white border border-[#25D366] flex items-center justify-between gap-2 mt-1">
                              <div className="min-w-0">
                                <span className="text-[10px] font-black uppercase text-[#25D366] block">
                                  📍 Ubicación GPS Exacta p/ Courier:
                                </span>
                                <span className="text-[11px] text-stone-200 truncate block">
                                  {comparison.gpsLink}
                                </span>
                              </div>
                              <a
                                href={comparison.gpsLink}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 rounded-lg bg-[#25D366] text-[#041911] font-black text-[11px] shrink-0"
                              >
                                Abrir Mapa GPS
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* PANEL DE EDICIÓN MANUAL POST-LLAMADA */}
                    <div className="p-3.5 rounded-2xl bg-stone-900 text-white border border-stone-700 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-wider text-[#e8b23a] flex items-center gap-1.5">
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edición Manual del Vendedor (Post-Llamada con el Cliente)</span>
                          </div>
                        </div>

                        {editingOrderId !== ord.reservaid && (
                          <button
                            type="button"
                            onClick={() => openManualEditor(ord)}
                            className="px-3.5 py-2 rounded-xl bg-[#e8b23a] hover:bg-[#ffd778] text-[#041911] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>✏️ Modificar Unidades / Datos / Cancelar</span>
                          </button>
                        )}
                      </div>

                      {editingOrderId === ord.reservaid && (
                        <div className="pt-2 border-t border-white/15 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-2.5 rounded-xl bg-black/40 border border-white/15 space-y-1.5">
                              <label className="text-[10px] font-black uppercase text-stone-300 block">
                                Cantidad de Piezas / Unidades
                              </label>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = Math.max(1, editCantidad - 1);
                                    setEditCantidad(next);
                                    setEditMonto(calculatePriceForUnits(next));
                                  }}
                                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-sm font-black text-[#25D366] px-2">
                                  {editCantidad} {editCantidad === 1 ? 'unidad' : 'unidades'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = editCantidad + 1;
                                    setEditCantidad(next);
                                    setEditMonto(calculatePriceForUnits(next));
                                  }}
                                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="p-2.5 rounded-xl bg-black/40 border border-white/15 space-y-1.5">
                              <label className="text-[10px] font-black uppercase text-stone-300 block">
                                Monto Total a Cobrar (Gs.)
                              </label>
                              <input
                                type="number"
                                value={editMonto}
                                onChange={e => setEditMonto(Number(e.target.value) || 0)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-white/20 text-xs font-black text-[#e8b23a] outline-none focus:border-[#25D366]"
                              />
                            </div>

                            <div className="p-2.5 rounded-xl bg-black/40 border border-white/15 space-y-1.5">
                              <label className="text-[10px] font-black uppercase text-stone-300 block">
                                Ciudad de Entrega
                              </label>
                              <input
                                type="text"
                                value={editCiudad}
                                onChange={e => setEditCiudad(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-white/20 text-xs font-bold text-white outline-none focus:border-[#25D366]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-black uppercase text-stone-300 block mb-1">
                                Dirección de Entrega
                              </label>
                              <input
                                type="text"
                                value={editDireccion}
                                onChange={e => setEditDireccion(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-white/20 text-xs font-bold text-white outline-none focus:border-[#25D366]"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase text-stone-300 block mb-1">
                                Referencia de la Casa / Fachada
                              </label>
                              <input
                                type="text"
                                value={editReferencia}
                                onChange={e => setEditReferencia(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-white/20 text-xs font-bold text-white outline-none focus:border-[#25D366]"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              disabled={updatingLogistics}
                              onClick={async () => {
                                setUpdatingLogistics(true);
                                try {
                                  await onUpdateOrderLogistics(
                                    ord.reservaid,
                                    {
                                      estado: 'cancelado',
                                      datosConfirmados: false,
                                      empaquetado: false
                                    },
                                    `🚫 Pedido #${ord.reservaid} de ${ord.nombre} fue CANCELADO manualmente.`
                                  );
                                  setEditingOrderId(null);
                                } finally {
                                  setUpdatingLogistics(false);
                                }
                              }}
                              className="px-3 py-2 rounded-xl bg-red-600/90 hover:bg-red-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Cancelar / Anular este Pedido</span>
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingOrderId(null)}
                                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-stone-200 text-xs font-bold cursor-pointer"
                              >
                                Cerrar sin guardar
                              </button>
                              <button
                                type="button"
                                disabled={updatingLogistics}
                                onClick={async () => {
                                  setUpdatingLogistics(true);
                                  try {
                                    await onUpdateOrderLogistics(
                                      ord.reservaid,
                                      {
                                        cantidad: editCantidad as 1 | 2 | 3,
                                        monto: editMonto,
                                        ciudad: editCiudad.trim() || ord.ciudad,
                                        direccion: editDireccion.trim() || ord.direccion,
                                        referenciaCasa: editReferencia.trim() || ord.referenciaCasa
                                      },
                                      `✅ Pedido #${ord.reservaid} actualizado manualmente (${editCantidad} un. · ${formatGs(editMonto)}).`
                                    );
                                    setEditingOrderId(null);
                                  } finally {
                                    setUpdatingLogistics(false);
                                  }
                                }}
                                className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebd5a] text-[#041911] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Guardar Modificación del Pedido</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
