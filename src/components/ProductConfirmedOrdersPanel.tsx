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
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import { Order, ProductPage } from '../types';
import { formatGs } from '../config';
import {
  isOrderConfirmedByAgent,
  isOrderPrepaymentSentPendingVerification,
  isOrderPrepaymentVerifiedAndPaid,
  buildOrderComparisonSummary,
  filterAdminOrders,
  formatFullOrderTextForCourier
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

/**
 * Botón individual ultra-compacto para copiar cualquier campo con feedback visual instantáneo (✓ Copiado)
 */
export const CopyFieldBtn: React.FC<{
  text: string;
  label?: string;
  tooltip?: string;
  className?: string;
  onCopied?: () => void;
}> = ({ text, label, tooltip, className, onCopied }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const clean = String(text || '').trim();
    if (!clean) return;
    try {
      navigator.clipboard.writeText(clean);
      setCopied(true);
      if (onCopied) onCopied();
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={tooltip || `Copiar: ${text}`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all select-none shrink-0 ${
        copied
          ? 'bg-emerald-500 text-black shadow-sm font-semibold'
          : 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/80'
      } ${className || ''}`}
    >
      {copied ? <Check className="w-3 h-3 text-black" /> : <Copy className="w-3 h-3 text-zinc-400" />}
      <span>{copied ? '✓ Copiado' : label || 'Copiar'}</span>
    </button>
  );
};

export async function approveOrderPrepaymentClientSide(
  order: Order
): Promise<{ ok: boolean; reply?: string }> {
  try {
    const res = await fetch('/api/whatsapp/approve-prepayment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.reservaid,
        phone: order.celular,
        orderSnapshot: order
      })
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const json = await res.json();
      return { ok: Boolean(json?.success), reply: json?.reply };
    }
  } catch {}
  return { ok: false };
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
    Number(order.montoConDescuentoAdelantado) || Math.max(50000, rawMontoNum - 30000);
  const bancoNombre = order.pagoAdelantadoBanco || 'Banco Familiar';
  const aliasCuenta = order.pagoAdelantadoAlias || '3856033 (3.856.033)';
  const titularCuenta = order.pagoAdelantadoTitular || 'Richard Almirón';

  const handleToggleVerifiedSwitch = async () => {
    setTogglingSwitch(true);
    try {
      const nextVerified = !isVerifiedPaid;
      const nowIso = new Date().toISOString();
      if (nextVerified) {
        await approveOrderPrepaymentClientSide(order);
      }
      await onUpdateOrder(
        order.reservaid,
        {
          datosConfirmados: true,
          agenteCompletado: true,
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
          ? `💎 ¡Pago Adelantado de ${order.nombre} APROBADO (-Gs. 30.000)! Se envió el audio de confirmación a su WhatsApp.`
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
      className={`p-2.5 sm:p-3 rounded-xl border transition-all space-y-2.5 ${
        isVerifiedPaid
          ? 'bg-cyan-950/70 border-cyan-400 '
          : isSentPending
            ? 'bg-amber-950/70 border-amber-400 '
            : 'bg-zinc-900/90 border-amber-500/40'
      }`}
    >
      {/* CABECERA COMPACTA: BADGE DE ESTADO + INTERRUPTOR SWITCH */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2 flex-wrap">
          {isVerifiedPaid ? (
            <span className="px-2 py-0.5 rounded-md bg-sky-950 text-sky-300 border border-sky-800/60 text-[10px] font-medium uppercase tracking-wider ">
              PAGO ADELANTADO CONFIRMADO
            </span>
          ) : isSentPending ? (
            <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-400 border border-amber-800/60 text-[10px] font-medium uppercase tracking-wider ">
              PAGO ENVIADO · FALTA TU VERIFICACIÓN
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-400 border border-amber-700 text-[10px] font-semibold uppercase tracking-wider">
              🏦 Verificación Transferencia (-Gs. 30.000)
            </span>
          )}
          <span className="text-[11px] font-bold text-zinc-200">
            {isVerifiedPaid
              ? 'Transferencia comprobada · Audio de aprobación enviado al cliente'
              : isSentPending
                ? '¡Cliente envió comprobante! Revisá tu Banco Familiar y aprobá con 1 clic:'
                : 'Si el cliente transfirió con la promo (-30.000 Gs.), aprobá el pago aquí:'}
          </span>
        </div>

        {/* SWITCH COMPACTO */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {!isSentPending && !isVerifiedPaid && (
            <button
              type="button"
              disabled={togglingSwitch}
              onClick={handleMarkPaymentSentPending}
              className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 text-[10px] font-medium cursor-pointer transition-all"
              title="Marcar que el cliente avisó que envió pago adelantado"
            >
              Marcar &quot;Pago Enviado&quot;
            </button>
          )}

          <button
            type="button"
            role="switch"
            aria-checked={isVerifiedPaid}
            data-testid={`switch-verify-prepayment-${order.reservaid}`}
            disabled={togglingSwitch}
            onClick={handleToggleVerifiedSwitch}
            className={`px-3 py-1.5 rounded-xl font-semibold text-xs inline-flex items-center gap-2 cursor-pointer transition-all border ${
              isVerifiedPaid
                ? 'bg-sky-950 text-sky-300 border border-sky-800/60 border-white '
                : 'bg-zinc-950 hover:bg-zinc-900 text-amber-200 border-amber-400/80 '
            }`}
          >
            {/* Switch Track & Thumb */}
            <span
              className={`w-8 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                isVerifiedPaid ? 'bg-slate-950 justify-end' : 'bg-zinc-700 justify-start'
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full transition-transform ${
                  isVerifiedPaid ? 'bg-cyan-400' : 'bg-amber-400'
                }`}
              />
            </span>
            <span className="text-[11px]">
              {isVerifiedPaid
                ? '💎 Pago Adelantado Confirmado (Activo)'
                : 'Confirmar Pago Adelantado (Pasar a Pestaña)'}
            </span>
          </button>
        </div>
      </div>

      {/* 3 MICRO-TARJETAS COMPACTAS (ADAPTABLES A PANTALLA DE 11 PULGADAS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        {/* Micro-Tarjeta 1: Cliente a verificar en tu banco */}
        <div className="p-2.5 rounded-xl bg-black/50 border border-white/15 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-medium uppercase text-amber-400">
            <span>👤 1. Cliente en tu Banco</span>
            <CopyFieldBtn text={order.nombre} label="Copiar" tooltip="Copiar nombre para buscar en tu app bancaria" />
          </div>
          <div className="text-xs font-semibold text-white truncate" title={order.nombre}>
            {order.nombre}
          </div>
          <div className="flex items-center justify-between gap-1 text-[11px] font-mono text-zinc-300">
            <span>{order.celular}</span>
            <CopyFieldBtn text={order.celular} label="Copiar" tooltip="Copiar WhatsApp" />
          </div>
          {order.pagoAdelantadoFecha && (
            <div className="text-[10px] text-zinc-400">
              🕒 {new Date(order.pagoAdelantadoFecha).toLocaleDateString('es-PY')} {new Date(order.pagoAdelantadoFecha).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false })}hs
            </div>
          )}
        </div>

        {/* Micro-Tarjeta 2: Cuenta y Monto Transferido */}
        <div className="p-2.5 rounded-xl bg-black/50 border border-white/15 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-medium uppercase text-cyan-300">
            <span>🏛️ 2. Cuenta Destino</span>
            <CopyFieldBtn text={aliasCuenta} label="Copiar Alias" tooltip="Copiar Alias bancario" />
          </div>
          <div className="text-xs font-bold text-white truncate">
            {bancoNombre} <span className="text-cyan-300 font-mono">({aliasCuenta})</span>
          </div>
          <div className="text-[11px] text-zinc-300 truncate">
            Titular: <strong className="text-white">{titularCuenta}</strong>
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-[10px] line-through text-zinc-500 font-mono">
              {formatGs(rawMontoNum)}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-amber-400/20 border border-amber-400/50 text-amber-400 font-mono text-[11px] font-medium">
              Transferido: {formatGs(discountedMontoNum)}
            </span>
          </div>
        </div>

        {/* Micro-Tarjeta 3: Comprobante Recibido */}
        <div className="p-2.5 rounded-xl bg-black/50 border border-white/15 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between text-[10px] font-medium uppercase text-amber-400">
            <span>🧾 3. Comprobante</span>
            {order.comprobantePagoDataUrl && (
              <button
                type="button"
                onClick={() => setShowFullReceiptModal(true)}
                className="px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-[10px] font-semibold cursor-pointer"
              >Ampliar
              </button>
            )}
          </div>

          {order.comprobantePagoDataUrl ? (
            <div className="flex items-center gap-2">
              <img
                src={order.comprobantePagoDataUrl}
                alt={`Comprobante de ${order.nombre}`}
                onClick={() => setShowFullReceiptModal(true)}
                className="w-11 h-11 rounded-lg object-cover border-2 border-amber-400 cursor-pointer hover:opacity-90 shrink-0 shadow-sm"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-emerald-300 block truncate">
                  ✓ Captura adjuntada
                </span>
                <label className="text-[10px] text-zinc-400 hover:text-white underline cursor-pointer mt-0.5 block">
                  Cambiar foto
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadReceiptFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] text-zinc-400 leading-tight">
                {isSentPending ? 'Cliente avisó por chat' : 'Sin captura'}
              </span>
              <label className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1 shrink-0">
                <span>📷 Subir</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadReceiptFile}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* MODAL PARA VER EL COMPROBANTE EN PANTALLA COMPLETA */}
      {showFullReceiptModal && order.comprobantePagoDataUrl && (
        <div
          onClick={() => setShowFullReceiptModal(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="max-w-lg w-full bg-zinc-950 border border-amber-400/80 rounded-lg p-4 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div>
                <h4 className="text-sm font-semibold text-white">
                  🧾 Comprobante de Pago — {order.nombre}
                </h4>
                <p className="text-[11px] text-amber-400 font-mono">
                  {bancoNombre} · Alias {aliasCuenta} · Titular: {titularCuenta} · {formatGs(discountedMontoNum)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullReceiptModal(false)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold cursor-pointer"
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
  const [approvingCardOrderId, setApprovingCardOrderId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const handleQuickApprovePrepaymentCard = async (ord: Order) => {
    if (approvingCardOrderId) return;
    setApprovingCardOrderId(ord.reservaid);
    try {
      const rawMontoNum =
        Number(String(ord.montoOriginalSinDescuento || ord.monto || 189000).replace(/\D/g, '')) || 189000;
      const discountedMontoNum =
        Number(ord.montoConDescuentoAdelantado) || Math.max(50000, rawMontoNum - 30000);
      const nowIso = new Date().toISOString();
      await approveOrderPrepaymentClientSide(ord);
      await onUpdateOrderLogistics(
        ord.reservaid,
        {
          datosConfirmados: true,
          agenteCompletado: true,
          empaquetado: true,
          pagoAdelantadoComprobanteRecibido: true,
          pagoAdelantadoVerificadoAdmin: true,
          pagoAdelantadoEstado: 'pagado_adelantado_confirmado',
          pagoAdelantadoFecha: ord.pagoAdelantadoFecha || nowIso,
          pagoAdelantadoFechaVerificado: nowIso,
          pagoAdelantadoBanco: ord.pagoAdelantadoBanco || 'Banco Familiar',
          pagoAdelantadoAlias: ord.pagoAdelantadoAlias || '3856033 (3.856.033)',
          pagoAdelantadoTitular: ord.pagoAdelantadoTitular || 'Richard Almirón',
          montoOriginalSinDescuento: rawMontoNum,
          montoConDescuentoAdelantado: discountedMontoNum
        },
        `💎 ¡Pago adelantado de ${ord.nombre} aprobado (-Gs. 30.000)! Se envió el audio de confirmación a su WhatsApp.`
      );
      if (!isPrepaidTab && onSwitchSubTab) {
        onSwitchSubTab('pagos_adelantados');
      }
    } finally {
      setApprovingCardOrderId(null);
    }
  };
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
      className={`p-3 sm:p-4 rounded-lg bg-[#0f0f11] border shadow-sm space-y-3 text-zinc-100 ${
        isPrepaidTab
          ? 'border-cyan-400/70 '
          : 'border-emerald-900/60'
      }`}
    >
      {/* Cabecera Compacta con Descarga 1-Clic en Excel + Copiar p/ Despacho + Botón Compacto de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          {isPrepaidTab ? (
            <span className="px-2.5 py-0.5 rounded-md bg-sky-950 text-sky-300 border border-sky-800/60 text-[10px] font-medium uppercase tracking-wider shrink-0 ">
              Pago Adelantado ({confirmedOrders.length})
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-medium uppercase tracking-wider shrink-0">
              Confirmados ({confirmedOrders.length})
            </span>
          )}
          <h4 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">
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
            className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-medium inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
            title="Descargar planilla Excel (.csv) con todos los pedidos confirmados y datos completos para despacho"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Excel ({confirmedOrders.length})</span>
          </button>

          <button
            type="button"
            disabled={confirmedOrders.length === 0}
            onClick={handleCopyDispatchList}
            className="h-8 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-700 text-zinc-200 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all"
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
            <span>Filtrar</span>
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
      <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 shadow-sm space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
          <div className="lg:col-span-4">
            <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1">Filtrar Confirmados por Nombre o Reserva
            </label>
            <div className="relative">
              <input
                type="text"
                data-testid="confirmed-filter-name"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                placeholder="Ej: Nombre del cliente o NX-..."
                className="w-full pl-3 pr-8 py-2.5 rounded-lg border border-zinc-800 text-xs font-medium text-zinc-100 bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
              />
              {filterName && (
                <button
                  type="button"
                  onClick={() => setFilterName('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1">
              Filtrar por Teléfono
            </label>
            <div className="relative">
              <input
                type="text"
                data-testid="confirmed-filter-phone"
                value={filterPhone}
                onChange={e => setFilterPhone(e.target.value)}
                placeholder="Ej: 0973... o 595..."
                className="w-full pl-3 pr-8 py-2.5 rounded-lg border border-zinc-800 text-xs font-mono font-medium text-zinc-100 bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
              />
              {filterPhone && (
                <button
                  type="button"
                  onClick={() => setFilterPhone('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1">
              Filtrar por Estado de Entrega
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
                  className={`py-1.5 px-1.5 rounded-lg text-[10px] font-medium cursor-pointer transition-all truncate ${
                    filterLogisticsState === tab.id
                      ? 'bg-emerald-600 text-white shadow-sm'
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border inline-flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 ${
                isAllConfirmedSelected
                  ? 'bg-emerald-950 text-white border-emerald-700'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-750'
              }`}
            >
              <input
                type="checkbox"
                readOnly
                checked={isAllConfirmedSelected}
                className="w-3.5 h-3.5 accent-emerald-500 pointer-events-none"
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
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800 cursor-pointer"
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
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-40 text-white border border-red-800 shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition-all"
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
      <div className="p-2.5 sm:p-3 rounded-lg bg-emerald-950 text-white border border-[#25D366]/40 shadow-sm space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#25D366] flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" />
            <span>Logística y Despacho ({selectedFilteredIds.length > 0 ? `${selectedFilteredIds.length} seleccionados` : 'Selector Rápido'})</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-medium shrink-0 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-white/10 text-amber-400">
              ⏳ No Enviados: {stats.noEnviados}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-200 border border-blue-400/30">
              Enviados: {stats.enviados}
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
              <option key={ord.reservaid} value={ord.reservaid} className="bg-emerald-950 text-white">
                #{idx + 1} · Reserva {ord.reservaid} — {ord.nombre} ({ord.ciudad.split(',')[0]})
              </option>
            ))}
            {confirmedOrders.length > 1 && (
              <option value="TODOS" className="bg-emerald-950 text-emerald-400 font-semibold">
                Aplicar a TODOS los pedidos confirmados ({confirmedOrders.length})
              </option>
            )}
          </select>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              disabled={updatingLogistics || confirmedOrders.length === 0}
              onClick={() => handleUniversalStepMark('no_enviado')}
              className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Marcar No Enviado</span>
            </button>

            <button
              type="button"
              disabled={updatingLogistics || confirmedOrders.length === 0}
              onClick={() => handleUniversalStepMark('enviado')}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Marcar Enviado</span>
            </button>

            <button
              type="button"
              disabled={updatingLogistics || confirmedOrders.length === 0}
              onClick={() => handleUniversalStepMark('concretado')}
              className="px-3.5 py-2 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-black text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Marcar Concretado (Entregado y Cobrado)</span>
            </button>
          </div>
        </div>
      </div>

      {/* LISTA DE TARJETAS HORIZONTALES ENUMERADAS (#1, #2, #3...) CON CASILLA DE SELECCIÓN Y ELIMINADO */}
      {confirmedOrders.length === 0 ? (
        <div className="p-8 rounded-lg bg-[#09090b] border border-dashed border-zinc-800 text-center space-y-2">
          <PackageCheck className={`w-8 h-8 mx-auto opacity-70 ${isPrepaidTab ? 'text-cyan-400' : 'text-emerald-500'}`} />
          <div className="text-sm font-semibold text-zinc-300">
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
                ? Number(ord.montoConDescuentoAdelantado) || Math.max(50000, (Number(ord.monto) || 189000) - 30000)
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
                      ? 'border-cyan-400 bg-cyan-950/70 ring-1 ring-cyan-400/50 text-white'
                      : isPrepaySentPending
                        ? 'border-amber-400 bg-amber-950/70 ring-1 ring-amber-400/60 text-amber-50'
                        : isChecked
                          ? 'border-emerald-600 bg-emerald-950/70 ring-1 ring-emerald-500/30 text-emerald-100'
                          : 'border-zinc-800 bg-[#0f0f11] hover:bg-zinc-900/90 text-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onClick={e => e.stopPropagation()}
                      onChange={() => toggleSelectConfirmedOrder(ord.reservaid)}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer shrink-0"
                    />
                    <span className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 shrink-0 tabular-nums">
                      #{numOrder}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-zinc-300 shrink-0 tabular-nums">
                      {ord.reservaid}
                    </span>
                    {isPrepayVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/60 text-[10px] font-semibold uppercase tracking-tight shrink-0 ">
                        <span>PAGO ADELANTADO</span>
                      </span>
                    ) : isPrepaySentPending ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/60 text-[10px] font-semibold uppercase tracking-tight shrink-0 ">
                        <span>PAGO ENVIADO (VERIFICAR)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-semibold uppercase tracking-tight shrink-0">
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
                      {ord.ciudad}
                    </span>
                    <span
                      className={`hidden lg:inline-block font-mono text-[11px] font-medium tabular-nums whitespace-nowrap shrink-0 ${
                        isPrepayVerified
                          ? 'text-cyan-300'
                          : isPrepaySentPending
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                      }`}
                    >
                      {ord.cantidad}u · {formatGs(displayAmount)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isPrepayVerified ? (
                      <button
                        type="button"
                        disabled={approvingCardOrderId === ord.reservaid}
                        aria-label={`Aprobar pago adelantado de ${ord.nombre}`}
                        data-testid={`confirmed-card-approve-prepayment-${ord.reservaid}`}
                        onClick={e => {
                          e.stopPropagation();
                          handleQuickApprovePrepaymentCard(ord);
                        }}
                        title="Comprobar pago en banco, aprobar descuento de Gs. 30.000 y enviar audio de aprobación al WhatsApp del cliente"
                        className={`h-7 px-2.5 rounded-lg text-[10px] font-medium inline-flex items-center gap-1 cursor-pointer transition-all border ${
                          isPrepaySentPending
                            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200 '
                            : 'bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 border-cyan-500/70'
                        }`}
                      >
                        <span>
                          {approvingCardOrderId === ord.reservaid
                            ? 'Aprobando...'
                            : isPrepaySentPending
                              ? '✅ Aprobar Pago (-30k)'
                              : '✅ Aprobar Pago Adelantado'}
                        </span>
                      </button>
                    ) : (
                      <span className="h-7 px-2 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500/70 text-[10px] font-medium inline-flex items-center gap-1">
                        Aprobado (-30k)
                      </span>
                    )}

                    {isConcretado ? (
                      <span className="hidden xl:inline-block bg-emerald-500 text-black px-2 py-0.5 rounded text-[10px] font-medium uppercase">
                        💰 Concretado
                      </span>
                    ) : isEnviado ? (
                      <span className="hidden xl:inline-block bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-medium uppercase">
                        Enviado
                      </span>
                    ) : (
                      <span className="hidden xl:inline-block bg-amber-200 text-amber-950 px-2 py-0.5 rounded text-[10px] font-medium uppercase">
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
                        className="h-7 px-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}

                    <span
                      className={`h-7 px-2.5 rounded-lg text-[10px] font-medium inline-flex items-center gap-1 ${
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
                  <div className="mt-1 p-2.5 sm:p-3 rounded-xl border border-zinc-800 bg-[#09090b] space-y-2.5">
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

                    {/* BANNER COMPACTO: RESUMEN DE CONFIRMACIÓN DEL AGENTE IA */}
                    <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-950/35 border border-emerald-800/60 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-300 shrink-0">
                          Resumen IA:
                        </span>
                        <p className="text-[11px] text-zinc-200 truncate leading-tight font-medium" title={comparison.resumenTexto}>
                          {comparison.resumenTexto}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <CopyFieldBtn
                          text={comparison.resumenTexto}
                          label="Copiar Resumen"
                          tooltip="Copiar resumen del Agente IA al portapapeles"
                        />
                        {onRequestDeleteOrders && (
                          <button
                            type="button"
                            onClick={() => onRequestDeleteOrders([ord.reservaid])}
                            className="px-2 py-1 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-[10px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                            title="Eliminar este pedido"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 2 COLUMNAS COMPACTAS Y EQUILIBRADAS: DATOS WEB VS DATOS CONFIRMADOS EN CHAT */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 items-stretch">
                      {/* COLUMNA 1: DATOS CARGADOS POR EL CLIENTE (WEB) */}
                      <div className="p-2.5 sm:p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-300 border-b border-zinc-800 pb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-zinc-400" />
                              <span>1. Datos Cargados por el Cliente (Web)</span>
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800 px-1.5 py-0.5 rounded">
                              Reserva #{ord.reservaid}
                            </span>
                          </div>

                          <div className="space-y-1.5 pt-1.5 text-xs">
                            {/* Nombre */}
                            <div className="flex items-center justify-between gap-1.5 py-0.5 border-b border-zinc-800/40">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-zinc-400 text-[11px] shrink-0">Nombre:</span>
                                <strong className="text-zinc-100 truncate text-xs font-bold" title={comparison.nombreWeb}>
                                  {comparison.nombreWeb}
                                </strong>
                              </div>
                              <CopyFieldBtn text={comparison.nombreWeb} tooltip="Copiar Nombre del Cliente" />
                            </div>

                            {/* Teléfono */}
                            <div className="flex items-center justify-between gap-1.5 py-0.5 border-b border-zinc-800/40">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="text-zinc-400 text-[11px] shrink-0">Teléfono:</span>
                                <strong className="text-zinc-100 font-mono text-xs tabular-nums">
                                  {comparison.celularWeb}
                                </strong>
                              </div>
                              <CopyFieldBtn text={comparison.celularWeb} tooltip="Copiar Teléfono del Cliente" />
                            </div>

                            {/* Ciudad / Depto */}
                            <div className="flex items-center justify-between gap-1.5 py-0.5 border-b border-zinc-800/40">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="text-zinc-400 text-[11px] shrink-0">Ciudad:</span>
                                <strong className="text-zinc-100 truncate text-xs" title={comparison.ubicacionWeb}>
                                  {comparison.ubicacionWeb}
                                </strong>
                              </div>
                              <CopyFieldBtn text={comparison.ubicacionWeb} tooltip="Copiar Ciudad y Departamento" />
                            </div>

                            {/* Dirección */}
                            <div className="flex items-start justify-between gap-1.5 py-0.5 border-b border-zinc-800/40">
                              <div className="flex items-start gap-1.5 min-w-0 flex-1">
                                <Home className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-zinc-400 text-[11px] block">Dirección:</span>
                                  <span className="text-zinc-200 text-xs font-medium leading-snug break-words">
                                    {comparison.direccionWeb}
                                  </span>
                                </div>
                              </div>
                              <CopyFieldBtn text={comparison.direccionWeb} tooltip="Copiar Dirección" />
                            </div>

                            {/* Pack / Monto Web */}
                            <div className="flex items-center justify-between gap-1.5 py-0.5">
                              <span className="text-zinc-400 text-[11px]">Pack / Total Web:</span>
                              <div className="flex items-center gap-1.5">
                                <strong className="text-emerald-400 font-mono text-xs font-semibold">
                                  {ord.cantidad || 1} un. · {formatGs(ord.monto || 189000)}
                                </strong>
                                <CopyFieldBtn text={`${ord.cantidad || 1} un. · ${formatGs(ord.monto || 189000)}`} tooltip="Copiar Pack y Total" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Botón General de Copiar Todo (Web) */}
                        <button
                          type="button"
                          onClick={() => {
                            const fullWebText = formatFullOrderTextForCourier(ord, comparison, 'web');
                            try {
                              navigator.clipboard.writeText(fullWebText);
                            } catch {}
                          }}
                          className="w-full mt-2 py-1.5 px-2.5 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5 border border-zinc-700 transition-colors cursor-pointer select-none"
                          title="Copiar todos los datos cargados por el cliente (Nombre, Teléfono, Ciudad, Dirección) de una vez"
                        >
                          <Copy className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copiar Todos los Datos Web (1 Clic)</span>
                        </button>
                      </div>

                      {/* COLUMNA 2: DATOS CONFIRMADOS POR EL AGENTE EN CHAT */}
                      <div className="p-2.5 sm:p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/60 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-300 border-b border-emerald-900/60 pb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>2. Datos Confirmados en Chat IA</span>
                            </span>
                            <span className="text-[10px] bg-emerald-900/90 text-emerald-200 border border-emerald-700/80 px-1.5 py-0.5 rounded font-semibold">
                              ✓ COINCIDEN
                            </span>
                          </div>

                          <div className="space-y-1.5 pt-1.5 text-xs">
                            {/* Titular Confirmado */}
                            <div className="flex items-center justify-between gap-1.5 py-0.5 border-b border-emerald-900/30">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-zinc-400 text-[11px] shrink-0">Titular:</span>
                                <strong className="text-emerald-200 truncate text-xs font-bold" title={comparison.nombreConfirmado}>
                                  {comparison.nombreConfirmado}
                                </strong>
                              </div>
                              <CopyFieldBtn text={comparison.nombreConfirmado} tooltip="Copiar Titular Confirmado" />
                            </div>

                            {/* WhatsApp Validado */}
                            <div className="flex items-center justify-between gap-1.5 py-0.5 border-b border-emerald-900/30">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="text-zinc-400 text-[11px] shrink-0">WhatsApp:</span>
                                <strong className="text-emerald-200 font-mono text-xs tabular-nums">
                                  {comparison.celularConfirmado}
                                </strong>
                              </div>
                              <CopyFieldBtn text={comparison.celularConfirmado} tooltip="Copiar WhatsApp Validado" />
                            </div>

                            {/* Dirección Confirmada */}
                            <div className="flex items-start justify-between gap-1.5 py-0.5 border-b border-emerald-900/30">
                              <div className="flex items-start gap-1.5 min-w-0 flex-1">
                                <MapPin className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-zinc-400 text-[11px] block">Dirección Confirmada:</span>
                                  <span className="text-emerald-100 text-xs font-semibold leading-snug break-words">
                                    {comparison.ubicacionConfirmada} — {comparison.direccionConfirmada}
                                  </span>
                                </div>
                              </div>
                              <CopyFieldBtn
                                text={`${comparison.ubicacionConfirmada} — ${comparison.direccionConfirmada}`}
                                tooltip="Copiar Dirección Confirmada"
                              />
                            </div>

                            {/* Referencia Casa / Fachada */}
                            <div className="flex items-start justify-between gap-1.5 py-1 px-2 rounded-lg bg-amber-950/30 border border-amber-800/40">
                              <div className="flex items-start gap-1.5 min-w-0 flex-1">
                                <Home className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-[10px] font-medium uppercase text-amber-400 block">
                                    Fachada / Referencia Casa:
                                  </span>
                                  <span className="text-amber-100 text-xs font-medium leading-snug break-words">
                                    {comparison.referenciaConfirmada || 'Sin referencia adicional'}
                                  </span>
                                </div>
                              </div>
                              {comparison.referenciaConfirmada && (
                                <CopyFieldBtn text={comparison.referenciaConfirmada} tooltip="Copiar Referencia de Casa" />
                              )}
                            </div>

                            {/* Mapa GPS */}
                            {comparison.gpsLink ? (
                              <div className="flex items-center justify-between gap-1.5 py-1 px-2 rounded-lg bg-emerald-950 border border-[#25D366]/50">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className="text-[10px] font-medium uppercase text-[#25D366] shrink-0">
                                    GPS:
                                  </span>
                                  <span className="font-mono text-[10px] text-zinc-300 truncate" title={comparison.gpsLink}>
                                    {comparison.gpsLink}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <CopyFieldBtn text={comparison.gpsLink} label="Copiar" tooltip="Copiar Link de Google Maps GPS" />
                                  <a
                                    href={comparison.gpsLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-0.5 rounded bg-[#25D366] hover:bg-[#20bd5a] text-black font-bold text-[10px] inline-flex items-center gap-1 shrink-0 shadow-sm"
                                    title="Abrir mapa en Google Maps"
                                  >
                                    <span>Abrir</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-zinc-500 italic py-0.5">
                                Pendiente de confirmación de link GPS por el cliente.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Botón General de Copiar Ficha Completa Confirmada (Courier) */}
                        <button
                          type="button"
                          onClick={() => {
                            const fullCourierText = formatFullOrderTextForCourier(ord, comparison, 'confirmado');
                            try {
                              navigator.clipboard.writeText(fullCourierText);
                            } catch {}
                          }}
                          className="w-full mt-2 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer select-none"
                          title="Copiar la ficha completa confirmada para enviar por WhatsApp al courier o empaquetador"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Ficha Completa p/ Courier (1 Clic)</span>
                        </button>
                      </div>
                    </div>

                    {/* PANEL DE EDICIÓN MANUAL POST-LLAMADA (COMPACTO) */}
                    <div className="p-2.5 sm:p-3 rounded-lg bg-zinc-900/90 text-white border border-zinc-800 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edición Manual del Vendedor (Post-Llamada)</span>
                        </div>

                        {editingOrderId !== ord.reservaid && (
                          <button
                            type="button"
                            onClick={() => openManualEditor(ord)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Modificar Unidades / Datos / Cancelar</span>
                          </button>
                        )}
                      </div>

                      {editingOrderId === ord.reservaid && (
                        <div className="pt-2 border-t border-white/15 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-2.5 rounded-xl bg-black/40 border border-white/15 space-y-1.5">
                              <label className="text-[10px] font-medium uppercase text-stone-300 block">
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
                                <span className="text-sm font-semibold text-[#25D366] px-2">
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
                              <label className="text-[10px] font-medium uppercase text-stone-300 block">
                                Monto Total a Cobrar (Gs.)
                              </label>
                              <input
                                type="number"
                                value={editMonto}
                                onChange={e => setEditMonto(Number(e.target.value) || 0)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-white/20 text-xs font-semibold text-emerald-400 outline-none focus:border-[#25D366]"
                              />
                            </div>

                            <div className="p-2.5 rounded-xl bg-black/40 border border-white/15 space-y-1.5">
                              <label className="text-[10px] font-medium uppercase text-stone-300 block">
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
                              <label className="text-[10px] font-medium uppercase text-stone-300 block mb-1">
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
                              <label className="text-[10px] font-medium uppercase text-stone-300 block mb-1">
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
                              className="px-3 py-2 rounded-lg bg-red-600/90 hover:bg-red-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
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
                                className="px-4 py-2 rounded-lg bg-[#25D366] hover:bg-[#1ebd5a] text-black text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
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
