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
  buildOrderComparisonSummary,
  filterAdminOrders,
  formatFullOrderTextForCourier
} from '../utils/orderConfirmation';
import {
  formatFullCityDepartment,
  normalizeOrderGpsFields,
  buildGoogleMapsSearchUrl,
  inferParaguayDepartmentFromCity
} from '../utils/paraguayGeo';

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

    const gpsNorm = normalizeOrderGpsFields(ord, ord.comparativaDatos);
    const gpsLink = comp.gpsLink || gpsNorm.gpsLink || '';
    const fullCityDept = comp.ubicacionConfirmada || formatFullCityDepartment(ord.ciudad, ord.departamento);

    return [
      idx + 1,
      ord.reservaid || '',
      fechaStr,
      product.nombre || ord.producto || '',
      `${Number(ord.cantidad) || 1} un.`,
      Number(ord.monto) || 0,
      comp.nombreConfirmado || ord.nombre || '',
      comp.celularConfirmado || ord.celular || '',
      fullCityDept,
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


interface ProductConfirmedOrdersPanelProps {
  product: ProductPage;
  orders: Order[];
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
  onUpdateOrderLogistics,
  onRequestDeleteOrders,
  onClose
}) => {
  const allConfirmedOrders = useMemo(() => orders.filter(o => isOrderConfirmedByAgent(o)), [orders]);

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
      const gpsNorm = normalizeOrderGpsFields(ord, ord.comparativaDatos);
      const gps = comp.gpsLink || gpsNorm.gpsLink || buildGoogleMapsSearchUrl(ord) || 'Sin link GPS';
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
    <div className="p-3 sm:p-4 rounded-lg bg-[#0f0f11] border border-emerald-900/60 shadow-sm space-y-3 text-zinc-100">
      {/* Cabecera Compacta con Descarga 1-Clic en Excel + Copiar p/ Despacho + Botón Compacto de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-medium uppercase tracking-wider shrink-0">
            Confirmados ({confirmedOrders.length})
          </span>
          <h4 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">
            {product.nombre}
          </h4>
          <span className="hidden xl:inline text-[11px] text-zinc-400 truncate">
            — Listos para empaquetar y enviar con datos completos de entrega y GPS
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
          <PackageCheck className="w-8 h-8 mx-auto opacity-70 text-emerald-500" />
          <div className="text-sm font-semibold text-zinc-300">
            No se encontraron pedidos confirmados con el filtro actual
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {confirmedOrders.map((ord, index) => {
            const numOrder = index + 1;
            const isCardOpen = expandedOrderId === ord.reservaid;
            const isChecked = selectedConfirmedIds.includes(ord.reservaid);
            const comparison = buildOrderComparisonSummary(ord);
            const fullCityDept =
              comparison.ubicacionConfirmada || formatFullCityDepartment(ord.ciudad, ord.departamento);
            const gpsNorm = normalizeOrderGpsFields(ord, ord.comparativaDatos);
            const effectiveMapUrl = comparison.gpsLink || gpsNorm.gpsLink || buildGoogleMapsSearchUrl(ord);
            const hasExactGps = Boolean((comparison.gpsLink || gpsNorm.gpsLink) && gpsNorm.gpsConfirmado);
            const hasApproxPin = Boolean((comparison.gpsLink || gpsNorm.gpsLink) && !gpsNorm.gpsConfirmado);
            const isConcretado = Boolean(ord.concretadoCobrado || ord.estado === 'entregado_pagado');
            const isEnviado = Boolean(
              isConcretado || ord.estadoEnvioProducto === 'enviado' || ord.estado === 'en_camino'
            );
            const displayAmount = Number(ord.monto) || 189000;

            return (
              <div key={ord.reservaid} className="w-full">
                {/* Tarjeta Horizontal Compacta */}
                <div
                  onClick={() => {
                    setExpandedOrderId(isCardOpen ? null : ord.reservaid);
                    setSelectedUniversalOrderId(ord.reservaid);
                  }}
                  className={`w-full h-11 min-h-[44px] max-h-[44px] px-3 rounded-xl border flex items-center justify-between gap-2 text-left cursor-pointer select-none transition-all overflow-hidden ${
                    isChecked
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
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-semibold uppercase tracking-tight shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>Confirmado</span>
                    </span>
                    <span className="font-extrabold text-xs text-zinc-100 truncate max-w-[140px] sm:max-w-[180px] shrink-0">
                      {ord.nombre}
                    </span>
                    <span className="hidden sm:inline-block font-mono text-[11px] font-bold text-zinc-300 tabular-nums whitespace-nowrap shrink-0">
                      {comparison.celularConfirmado}
                    </span>
                    <span className="hidden md:inline-block text-[11px] font-medium text-zinc-300 truncate max-w-[200px]" title={fullCityDept}>
                      {fullCityDept}
                    </span>
                    <span className="hidden lg:inline-block font-mono text-[11px] font-medium tabular-nums whitespace-nowrap shrink-0 text-emerald-400">
                      {ord.cantidad}u · {formatGs(displayAmount)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
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

                    <span className="h-7 px-2.5 rounded-lg text-[10px] font-medium inline-flex items-center gap-1 bg-[#15803d] text-white">
                      <span>{isCardOpen ? 'Cerrar' : 'Abrir Pedido'}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${isCardOpen ? 'rotate-180' : ''}`}
                      />
                    </span>
                  </div>
                </div>

                {/* Detalle Desplegable: Ficha Completa del Cliente */}
                {isCardOpen && (
                  <div className="mt-1 p-2.5 sm:p-3 rounded-xl border border-zinc-800 bg-[#09090b] space-y-2.5">
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
                            {gpsNorm.gpsLink ? (
                              <div
                                className={`flex items-center justify-between gap-1.5 py-1.5 px-2 rounded-lg border ${
                                  hasExactGps
                                    ? 'bg-emerald-950 border-[#25D366]/50'
                                    : 'bg-sky-950/60 border-sky-500/40'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span
                                    className={`text-[10px] font-semibold uppercase shrink-0 ${
                                      hasExactGps ? 'text-[#25D366]' : 'text-sky-300'
                                    }`}
                                  >
                                    {hasExactGps ? '📍 GPS Exacto:' : '🧭 Pin Barrio/Dirección:'}
                                  </span>
                                  <span className="font-mono text-[10px] text-zinc-300 truncate" title={gpsNorm.gpsLink}>
                                    {gpsNorm.gpsLink}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <CopyFieldBtn text={gpsNorm.gpsLink} label="Copiar" tooltip="Copiar Link de Google Maps" />
                                  <a
                                    href={gpsNorm.gpsLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`px-2 py-0.5 rounded font-bold text-[10px] inline-flex items-center gap-1 shrink-0 shadow-sm ${
                                      hasExactGps
                                        ? 'bg-[#25D366] hover:bg-[#20bd5a] text-black'
                                        : 'bg-sky-500 hover:bg-sky-400 text-black'
                                    }`}
                                    title="Abrir ubicación en Google Maps"
                                  >
                                    <span>{hasApproxPin ? 'Ver Zona' : 'Abrir'}</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              </div>
                            ) : effectiveMapUrl ? (
                              <div className="flex items-center justify-between gap-1.5 py-1.5 px-2 rounded-lg bg-zinc-900/90 border border-zinc-700/80">
                                <span className="text-[11px] text-zinc-300 truncate">
                                  Sin pin exacto — buscar zona en Google Maps
                                </span>
                                <a
                                  href={effectiveMapUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white font-semibold text-[10px] inline-flex items-center gap-1 shrink-0"
                                >
                                  <span>🔍 Buscar en Maps</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            ) : (
                              <div className="text-[11px] text-zinc-500 italic py-0.5">
                                Sin coordenadas GPS ni dirección suficiente para mapa.
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
                                        departamento: inferParaguayDepartmentFromCity(
                                          editCiudad.trim() || ord.ciudad,
                                          ord.departamento
                                        ),
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
