const fs = require('fs');
let c = fs.readFileSync('src/views/AdminView.tsx', 'utf8');
let n = 0;

// =============================================
// 1. REPLACE ENTIRE RIGHT SIDE OF PRODUCT HEADER
//    Move all buttons into one compact row
// =============================================
const oldRightSide = `                        {/* DERECHA: Botones Compactos Horizontales (Sin aplastar el t\u00edtulo en 11 pulgadas) */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              toggleProductExpand(prod);
                            }}
                            className={\`h-8 px-3 rounded-lg text-sm font-medium transition-colors duration-150 inline-flex items-center justify-center gap-1.5 cursor-pointer border whitespace-nowrap \${
                              isExpanded
                                ? 'bg-zinc-800 text-white border-zinc-600'
                                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                            }\`}
                          >
                            <span>
                              {isExpanded ? 'Cerrar' : \`Pedidos (\${activeProdOrdersCount})\`}
                            </span>
                            <ChevronDown
                              className={\`w-3.5 h-3.5 shrink-0 transition-transform duration-200 \${
                                isExpanded ? 'rotate-180 text-emerald-400' : 'text-zinc-500'
                              }\`}
                            />
                          </button>

                          <button
                            type="button"
                            data-testid={\`delete-product-btn-\${prod.id}\`}
                            onClick={e => {
                              e.stopPropagation();
                              openRedDeleteProductsModal([prod.id]);
                            }}
                            className="h-8 w-8 rounded-lg bg-zinc-900 hover:bg-red-950/50 text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-900/50 flex items-center justify-center cursor-pointer transition-colors duration-150 shrink-0"
                            title="Eliminar esta p\u00e1gina de producto"
                            aria-label="Eliminar p\u00e1gina"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>`;

const newRightSide = `                        {/* DERECHA: Toolbar compacto */}
                        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                          {isExpanded && (
                            <>
                              <button type="button" onClick={e => { e.stopPropagation(); setProductSubTab(prod.id, 'pedidos'); }} className={\`h-6 px-2 rounded text-[11px] font-medium cursor-pointer transition-colors border \${!['pixel','precios','voz'].includes(getProductSubTab(prod.id)) ? 'bg-zinc-700 text-white border-zinc-600' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'}\`}>
                                Pedidos <span className="text-[10px] text-zinc-400 ml-0.5">{activeProdOrdersCount}</span>
                              </button>
                              <button type="button" data-testid={\`toggle-pixel-config-\${prod.id}\`} onClick={e => { e.stopPropagation(); setProductSubTab(prod.id, 'pixel'); }} className={\`h-6 px-2 rounded text-[11px] font-medium cursor-pointer transition-colors border \${getProductSubTab(prod.id)==='pixel' ? 'bg-zinc-700 text-white border-zinc-600' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'}\`}>
                                P\u00edxel
                              </button>
                              <button type="button" onClick={e => { e.stopPropagation(); setProductSubTab(prod.id, 'precios'); }} className={\`h-6 px-2 rounded text-[11px] font-medium cursor-pointer transition-colors border \${getProductSubTab(prod.id)==='precios' ? 'bg-zinc-700 text-white border-zinc-600' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'}\`}>
                                Precios
                              </button>
                              <button type="button" onClick={e => { e.stopPropagation(); setProductSubTab(prod.id, 'voz'); }} className={\`h-6 px-2 rounded text-[11px] font-medium cursor-pointer transition-colors border \${getProductSubTab(prod.id)==='voz' ? 'bg-zinc-700 text-white border-zinc-600' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'}\`}>
                                Voz
                              </button>
                              <button type="button" data-testid={\`quick-excel-confirmed-\${prod.id}\`} onClick={e => { e.stopPropagation(); const count = downloadConfirmedOrdersExcelCsv(prod, allProdOrders); showToast(count > 0 ? \`Excel descargada (\${count} pedidos).\` : 'Sin pedidos para exportar.'); }} className="h-6 px-2 rounded text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors inline-flex items-center gap-1" title="Descargar Excel">
                                <Download className="w-3 h-3" /> Excel
                              </button>
                              <div className="relative" onClick={e => e.stopPropagation()}>
                                <button type="button" onClick={() => setShowAudioPopover(prev => prev === prod.id ? null : prod.id)} className={\`h-6 px-2 rounded text-[11px] font-medium cursor-pointer transition-colors border inline-flex items-center gap-1 \${(autoCallOnOrder || autoChatOnOrder) ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'}\`}>
                                  Audio <ChevronDown className="w-3 h-3" />
                                </button>
                                {showAudioPopover === prod.id && (
                                  <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-2 min-w-[140px] space-y-1">
                                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider px-2 pb-1">Recepci\u00f3n de pedidos</div>
                                    <button type="button" onClick={() => { handleToggleAutomationSetting('autoCallOnOrder', true); handleToggleAutomationSetting('autoChatOnOrder', true); setShowAudioPopover(null); }} className={\`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors \${(autoCallOnOrder || autoChatOnOrder) ? 'bg-emerald-950 text-emerald-300' : 'text-zinc-300 hover:bg-zinc-800'}\`}>
                                      Autom\u00e1tico
                                    </button>
                                    <button type="button" onClick={() => { handleToggleAutomationSetting('autoCallOnOrder', false); handleToggleAutomationSetting('autoChatOnOrder', false); setShowAudioPopover(null); }} className={\`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors \${(!autoCallOnOrder && !autoChatOnOrder) ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-800'}\`}>
                                      Manual
                                    </button>
                                  </div>
                                )}
                              </div>
                              <button type="button" data-testid={\`btn-manual-order-\${prod.id}\`} onClick={e => { e.stopPropagation(); openManualOrderModal(prod); }} className="h-6 px-2 rounded text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors inline-flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Nuevo
                              </button>
                              <button type="button" data-testid={\`toggle-order-filters-\${prod.id}\`} onClick={e => { e.stopPropagation(); setShowOrderFiltersBar(prev => !prev); }} className={\`h-6 px-2 rounded text-[11px] font-medium cursor-pointer transition-colors border inline-flex items-center gap-1 \${(showOrderFiltersBar || filterOrderName || filterOrderPhone) ? 'bg-emerald-950 text-emerald-200 border-emerald-600' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'}\`}>
                                <Filter className="w-3 h-3" /> Filtrar
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); toggleProductExpand(prod); }}
                            className={\`h-6 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer border inline-flex items-center gap-1 \${isExpanded ? 'bg-zinc-700 text-white border-zinc-600' : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'}\`}
                          >
                            {isExpanded ? 'Cerrar' : 'Abrir'}
                            <ChevronDown className={\`w-3 h-3 transition-transform \${isExpanded ? 'rotate-180' : ''}\`} />
                          </button>
                          <button
                            type="button"
                            data-testid={\`delete-product-btn-\${prod.id}\`}
                            onClick={e => { e.stopPropagation(); openRedDeleteProductsModal([prod.id]); }}
                            className="h-6 w-6 rounded bg-zinc-900 hover:bg-red-950/50 text-zinc-500 hover:text-red-400 border border-zinc-800 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>`;

if (c.includes(oldRightSide)) {
  c = c.replace(oldRightSide, newRightSide);
  n++; console.log('1. Replaced product header right side with compact toolbar');
} else {
  console.log('1. NOT FOUND: product header right side');
}

// =============================================
// 2. REMOVE the old tab bar + actions from expanded content
// =============================================
const oldTabBar = `                          {/* BARRA DE PESTA\u00d1AS + ACCIONES */}
                          <div className="flex flex-wrap items-center justify-between gap-1 p-0.5 rounded-md bg-[#0f0f11] border border-zinc-800">
                            {/* Sub-Pesta\u00f1as */}
                            <div className="flex items-center gap-1 flex-wrap">
                              <button
                                type="button"
                                data-testid={\`toggle-pixel-config-\${prod.id}\`}
                                onClick={() => setProductSubTab(prod.id, 'pixel')}
                                className={\`h-6 px-1.5 rounded text-[11px] font-medium transition-colors duration-150 inline-flex items-center cursor-pointer \${
                                  getProductSubTab(prod.id) === 'pixel'
                                    ? 'bg-zinc-800 text-white'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }\`}
                              >
                                <span>P\u00edxel</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setProductSubTab(prod.id, 'precios')}
                                className={\`h-6 px-1.5 rounded text-[11px] font-medium transition-colors duration-150 inline-flex items-center cursor-pointer \${
                                  getProductSubTab(prod.id) === 'precios'
                                    ? 'bg-zinc-800 text-white'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }\`}
                              >
                                <span>Precios</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setProductSubTab(prod.id, 'voz')}
                                className={\`h-6 px-1.5 rounded text-[11px] font-medium transition-colors duration-150 inline-flex items-center cursor-pointer \${
                                  getProductSubTab(prod.id) === 'voz'
                                    ? 'bg-zinc-800 text-white'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }\`}
                              >
                                <span>Voz</span>
                              </button>
                            </div>

                            {/* ACCIONES R\u00c1PIDAS */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                data-testid={\`quick-excel-confirmed-\${prod.id}\`}
                                onClick={() => {
                                  const count = downloadConfirmedOrdersExcelCsv(prod, allProdOrders);
                                  if (count > 0) {
                                    showToast(\`Planilla Excel descargada (\${count} pedido(s) para despacho).\`);
                                  } else {
                                    showToast('A\u00fan no hay pedidos activos para exportar en este producto.');
                                  }
                                }}
                                className="h-6 px-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors duration-150"
                                title="Descargar planilla Excel con todos los pedidos confirmados"
                              >
                                <Download className="w-3 h-3" />
                                <span>Excel ({confirmedProdOrdersCount})</span>
                              </button>

                              <div className="inline-flex items-center bg-zinc-900 p-0.5 rounded-md border border-zinc-800 gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleToggleAutomationSetting('autoCallOnOrder', true);
                                    handleToggleAutomationSetting('autoChatOnOrder', true);
                                  }}
                                  className={\`py-1 px-2 rounded text-[12px] font-medium cursor-pointer transition-colors duration-150 \${
                                    autoCallOnOrder || autoChatOnOrder
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                      : 'text-zinc-400 hover:text-zinc-200'
                                  }\`}
                                >
                                  Auto ({preferredChannel === 'audio' ? 'Audio' : 'Texto'})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleToggleAutomationSetting('autoCallOnOrder', false);
                                    handleToggleAutomationSetting('autoChatOnOrder', false);
                                  }}
                                  className={\`py-1 px-2 rounded text-[12px] font-medium cursor-pointer transition-colors duration-150 \${
                                    !autoCallOnOrder && !autoChatOnOrder
                                      ? 'bg-zinc-800 text-white'
                                      : 'text-zinc-400 hover:text-zinc-200'
                                  }\`}
                                >
                                  Manual
                                </button>
                              </div>


                            </div>
                          </div>`;

if (c.includes(oldTabBar)) {
  c = c.replace(oldTabBar, '');
  n++; console.log('2. Removed old tab bar + actions from expanded content');
} else {
  console.log('2. NOT FOUND: old tab bar');
}

// =============================================
// 3. REMOVE CLIENTES header section (everything before filter bar)
// =============================================
const clientesHeader = `                          {/* TAB PEDIDOS (Compacto y Sin Barullo) */}
                          {!['pixel', 'precios', 'voz'].includes(getProductSubTab(prod.id)) && (
                          <div className="space-y-2.5 pt-0.5">
                            {/* Barra Superior Compacta de Pedidos: Total Ventas + Bot\u00f3n R\u00e1pido a Confirmados + Bot\u00f3n Compacto de Filtros */}
                            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="text-[11px] font-medium uppercase tracking-wider text-zinc-300">
                                  Clientes ({prodOrders.length} de {allProdOrders.length})
                                </h5>
                                <span className="text-[11px] font-mono text-zinc-400">
                                  Ventas Activas:{' '}
                                  <strong className="text-emerald-400 font-bold">
                                    {formatGs(totalVentasProd)}
                                  </strong>
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  data-testid={\`btn-manual-order-\${prod.id}\`}
                                  onClick={() => openManualOrderModal(prod)}
                                  className="h-6 px-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-black text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer transition-all"
                                  title="Cargar r\u00e1pidamente un cliente que te contact\u00f3 por WhatsApp"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Nuevo pedido</span>
                                </button>

                                <button
                                  type="button"
                                  data-testid={\`toggle-order-filters-\${prod.id}\`}
                                  onClick={() => setShowOrderFiltersBar(prev => !prev)}
                                  className={\`h-6 px-2 rounded-md border text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer transition-all \${
                                    showOrderFiltersBar ||
                                    filterOrderName ||
                                    filterOrderPhone ||
                                    filterArchiveMode !== 'activos' ||
                                    selectedIdsForProd.length > 0
                                      ? 'bg-emerald-950 border-emerald-600 text-emerald-200'
                                      : 'bg-[#0f0f11] hover:bg-zinc-900 border-zinc-800 text-zinc-300'
                                  }\`}
                                >
                                  <Filter className="w-3 h-3 text-emerald-400" />
                                  <span>Filtrar / Seleccionar
                                    {selectedIdsForProd.length > 0 ? \` (\${selectedIdsForProd.length})\` : ''}
                                  </span>
                                </button>
                              </div>
                            </div>`;

const newPedidosStart = `                          {/* PEDIDOS */}
                          {!['pixel', 'precios', 'voz'].includes(getProductSubTab(prod.id)) && (
                          <div className="space-y-2 pt-0.5">`;

if (c.includes(clientesHeader)) {
  c = c.replace(clientesHeader, newPedidosStart);
  n++; console.log('3. Removed CLIENTES header (buttons moved to toolbar)');
} else {
  console.log('3. NOT FOUND: CLIENTES header');
}

// =============================================
// 4. SIMPLIFY filter bar: only Name + Phone (remove archive mode tabs)
// =============================================
// Remove the archive mode condition from filter bar visibility
c = c.replace(
  `(showOrderFiltersBar ||
                              Boolean(filterOrderName) ||
                              Boolean(filterOrderPhone) ||
                              filterArchiveMode !== 'activos' ||
                              selectedIdsForProd.length > 0)`,
  `(showOrderFiltersBar ||
                              Boolean(filterOrderName) ||
                              Boolean(filterOrderPhone) ||
                              selectedIdsForProd.length > 0)`
);
n++; console.log('4. Simplified filter bar condition');

// Replace the filter grid: remove Vista de Pedidos, keep only Name + Phone
const oldFilterGrid = `                              {/* Fila 1: Buscador por Nombre, Buscador por Tel\u00e9fono y Pesta\u00f1as */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">`;
const newFilterGrid = `                              {/* Filtros: Nombre y Tel\u00e9fono */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">`;
if (c.includes(oldFilterGrid)) {
  c = c.replace(oldFilterGrid, newFilterGrid);
  n++; console.log('5. Changed filter grid layout');
} else {
  console.log('5. NOT FOUND: filter grid');
}

// Remove lg:col-span from name field
c = c.replace(`<div className="lg:col-span-3">
                                  <label className="block text-[12px] font-medium uppercase tracking-wider text-zinc-500 mb-1">
                                    Filtrar por Nombre`, 
  `<div>
                                  <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1">
                                    Nombre`);
n++; console.log('6. Simplified name filter label');

// Remove lg:col-span from phone field
c = c.replace(`<div className="lg:col-span-4">
                                  <label className="block text-[12px] font-medium uppercase tracking-wider text-zinc-500 mb-1">
                                    Filtrar por Tel\u00e9fono`, 
  `<div>
                                  <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1">
                                    Tel\u00e9fono`);
n++; console.log('7. Simplified phone filter label');

// Remove the entire Vista de Pedidos section (archive mode tabs)
const archiveSection = `
                                <div className="lg:col-span-5">
                                  <label className="block text-[12px] font-medium uppercase tracking-wider text-zinc-500 mb-1">
                                    Vista de Pedidos
                                  </label>
                                  <div className="grid grid-cols-3 gap-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800">
                                    <button
                                      type="button"
                                      data-testid="admin-tab-activos"
                                      onClick={() => {
                                        setFilterArchiveMode('activos');
                                        setProductCurrentPage(prod.id, 1);
                                      }}
                                      className={\`py-1 px-2 rounded-md text-xs font-medium cursor-pointer transition-colors duration-150 whitespace-nowrap \${
                                        filterArchiveMode === 'activos'
                                          ? 'bg-zinc-800 text-emerald-400'
                                          : 'text-zinc-400 hover:text-zinc-200'
                                      }\`}
                                    >
                                      Activos ({activeProdOrdersCount})
                                    </button>
                                    <button
                                      type="button"
                                      data-testid="admin-tab-archivados"
                                      onClick={() => {
                                        setFilterArchiveMode('archivados');
                                        setProductCurrentPage(prod.id, 1);
                                      }}
                                      className={\`py-1 px-2 rounded-md text-xs font-medium cursor-pointer transition-colors duration-150 whitespace-nowrap \${
                                        filterArchiveMode === 'archivados'
                                          ? 'bg-zinc-800 text-amber-400'
                                          : 'text-zinc-400 hover:text-zinc-200'
                                      }\`}
                                    >
                                      Archivados ({archivedProdOrdersCount})
                                    </button>
                                    <button
                                      type="button"
                                      data-testid="admin-tab-todos"
                                      onClick={() => {
                                        setFilterArchiveMode('todos');
                                        setProductCurrentPage(prod.id, 1);
                                      }}
                                      className={\`py-1.5 px-2 rounded-lg text-[11px] font-medium cursor-pointer transition-all whitespace-nowrap \${
                                        filterArchiveMode === 'todos'
                                          ? 'bg-zinc-800 text-white shadow-sm'
                                          : 'text-zinc-400 hover:text-zinc-200'
                                      }\`}
                                    >
                                      Todos ({allProdOrders.length})
                                    </button>
                                  </div>
                                </div>`;
if (c.includes(archiveSection)) {
  c = c.replace(archiveSection, '');
  n++; console.log('8. Removed Vista de Pedidos (archive mode tabs)');
} else {
  console.log('8. NOT FOUND: archive mode tabs');
}

// =============================================
// 5. REMOVE color legend from orders header
// =============================================
const legendBlock = `                              <div className="hidden lg:flex items-center gap-2 text-[9px] font-medium text-zinc-500 shrink-0">
                                  <span className="inline-flex items-center gap-1 text-amber-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block " />
                                    Pago enviado
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-cyan-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block " />
                                    Pago adelantado
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-emerald-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                    Confirmado
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-zinc-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 inline-block" />
                                    Pendiente
                                  </span>
                                </div>`;
if (c.includes(legendBlock)) {
  c = c.replace(legendBlock, '');
  n++; console.log('9. Removed color legend');
} else {
  console.log('9. NOT FOUND: color legend');
}

// =============================================
// 6. ADD showAudioPopover state near other states
// =============================================
const stateHook = `const [showOrderFiltersBar, setShowOrderFiltersBar] = useState<boolean>(false);`;
if (c.includes(stateHook)) {
  c = c.replace(stateHook, stateHook + `\n  const [showAudioPopover, setShowAudioPopover] = useState<string | null>(null);`);
  n++; console.log('10. Added showAudioPopover state');
} else {
  console.log('10. NOT FOUND: state hook insertion point');
}

console.log('\nTotal changes: ' + n);
fs.writeFileSync('src/views/AdminView.tsx', c, 'utf8');
