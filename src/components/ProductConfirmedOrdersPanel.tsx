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
  X
} from 'lucide-react';
import { Order, ProductPage } from '../types';
import { formatGs } from '../config';
import {
  isOrderConfirmedByAgent,
  buildOrderComparisonSummary,
  filterAdminOrders
} from '../utils/orderConfirmation';

interface ProductConfirmedOrdersPanelProps {
  product: ProductPage;
  orders: Order[];
  onUpdateOrderLogistics: (
    orderId: string,
    updates: Partial<Order>,
    toastMessage?: string
  ) => Promise<void>;
  onRequestDeleteOrders?: (orderIds: string[]) => void;
  onClose: () => void;
}

export const ProductConfirmedOrdersPanel: React.FC<ProductConfirmedOrdersPanelProps> = ({
  product,
  orders,
  onUpdateOrderLogistics,
  onRequestDeleteOrders,
  onClose
}) => {
  // Filtrar estrictamente SOLO los pedidos confirmados por el Agente para este producto
  const allConfirmedOrders = useMemo(() => {
    return orders.filter(o => isOrderConfirmedByAgent(o));
  }, [orders]);

  // Filtros idénticos a la tabla principal (Nombre/Reserva, Teléfono y Estado Logístico)
  const [filterName, setFilterName] = useState<string>('');
  const [filterPhone, setFilterPhone] = useState<string>('');
  const [filterLogisticsState, setFilterLogisticsState] = useState<
    'todos' | 'no_enviado' | 'enviado' | 'concretado'
  >('todos');
  const [selectedConfirmedIds, setSelectedConfirmedIds] = useState<string[]>([]);

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

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#0d0d0f] border border-emerald-900/60 shadow-md space-y-4 animate-fadeIn text-zinc-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#16a34a] text-white flex items-center justify-center shadow-xs shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#16a34a] text-white">
                ✅ Pedidos Confirmados por IA ({confirmedOrders.length} de {allConfirmedOrders.length})
              </span>
              <h4 className="text-xs sm:text-sm font-black text-zinc-100">
                {product.nombre}
              </h4>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Filtrá, seleccioná uno o todos los pedidos confirmados de una vez para actualizar logística o eliminarlos.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="self-end sm:self-auto px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cerrar Confirmados</span>
        </button>
      </div>

      {/* BARRA DE FILTROS + SELECCIÓN MÚLTIPLE + ELIMINADO MASIVO EN CONFIRMADOS */}
      <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xs space-y-3">
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

      {/* FUNCIÓN UNIVERSAL SEPARADA DEL PRODUCTO: MARCAR ENVIADO / NO ENVIADO / CONCRETADO */}
      <div className="p-3.5 rounded-2xl bg-[#062319] text-white border border-[#25D366]/40 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-[#25D366] flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              <span>Función Universal de Logística y Cobro — {product.nombre}</span>
            </div>
            <p className="text-[11px] text-stone-300 mt-0.5">
              {selectedFilteredIds.length > 0
                ? `Aplicando acción sobre los ${selectedFilteredIds.length} pedido(s) marcados con casilla:`
                : 'Seleccioná el pedido confirmado (o todos los confirmados) para marcar si fue enviado o cobrado:'}
            </p>
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
          <PackageCheck className="w-8 h-8 text-emerald-500 mx-auto opacity-70" />
          <div className="text-sm font-black text-zinc-300">
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
            const isConcretado = Boolean(ord.concretadoCobrado || ord.estado === 'entregado_pagado');
            const isEnviado = Boolean(
              isConcretado || ord.estadoEnvioProducto === 'enviado' || ord.estado === 'en_camino'
            );

            return (
              <div key={ord.reservaid} className="w-full">
                {/* Tarjeta Horizontal Compacta en Vercel Dark con Checkbox */}
                <div
                  onClick={() => {
                    setExpandedOrderId(isCardOpen ? null : ord.reservaid);
                    setSelectedUniversalOrderId(ord.reservaid);
                  }}
                  className={`w-full h-11 min-h-[44px] max-h-[44px] px-3 rounded-xl border flex items-center justify-between gap-2 text-left cursor-pointer select-none transition-colors overflow-hidden ${
                    isChecked
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
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[9px] font-black uppercase tracking-tight shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>Confirmado</span>
                    </span>
                    <span className="font-extrabold text-xs text-zinc-100 truncate max-w-[140px] sm:max-w-[180px] shrink-0">
                      {ord.nombre}
                    </span>
                    <span className="hidden sm:inline-block font-mono text-[11px] font-bold text-zinc-400 tabular-nums whitespace-nowrap shrink-0">
                      {comparison.celularConfirmado}
                    </span>
                    <span className="hidden md:inline-block text-[11px] font-medium text-zinc-400 truncate max-w-[170px]">
                      📍 {ord.ciudad}
                    </span>
                    <span className="hidden lg:inline-block font-mono text-[11px] font-black text-emerald-400 tabular-nums whitespace-nowrap shrink-0">
                      {ord.cantidad}u · {formatGs(ord.monto)}
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

                    <span className="h-7 px-2.5 rounded-lg bg-[#15803d] text-white text-[10px] font-black inline-flex items-center gap-1">
                      <span>{isCardOpen ? 'Cerrar' : 'Abrir Pedido'}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${isCardOpen ? 'rotate-180' : ''}`}
                      />
                    </span>
                  </div>
                </div>

                {/* Detalle Desplegable: Ficha Completa del Cliente + Comparativa Web vs Chat IA */}
                {isCardOpen && (
                  <div className="mt-1 p-3.5 sm:p-4 rounded-xl border border-zinc-800 bg-[#09090b] space-y-3.5">
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
