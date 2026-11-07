const fs = require('fs');
const path = require('path');

const adminViewPath = path.resolve(__dirname, '../src/views/AdminView.tsx');
let code = fs.readFileSync(adminViewPath, 'utf8');

// 1. Pixel form styling
code = code.replace(
  `data-testid={\`product-pixel-token-box-\${prod.id}\`}
                            className="p-3 sm:p-4 rounded-2xl bg-white border border-blue-200/90 shadow-2xs space-y-2.5"`,
  `data-testid={\`product-pixel-token-box-\${prod.id}\`}
                            className="p-3 sm:p-4 rounded-2xl bg-[#0d0d0f] border border-zinc-800 shadow-xs space-y-3"`
);

code = code.replace(
  `className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-100"`,
  `className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800"`
);

code = code.replace(
  `className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#0b3d2e] text-white"`,
  `className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800"`
);

code = code.replace(
  `className="text-[11px] text-stone-600 font-bold"`,
  `className="text-[11px] text-zinc-400 font-medium"`
);

code = code.replace(
  `className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-black text-xs cursor-pointer transition-colors"`,
  `className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-medium text-xs cursor-pointer transition-colors"`
);

code = code.replace(
  `className="px-3.5 py-1.5 rounded-xl bg-[#0b3d2e] hover:bg-[#135944] disabled:opacity-60 text-white font-black text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"`,
  `className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"`
);

code = code.replace(
  `className="block text-[10px] font-black uppercase tracking-wider text-stone-700 mb-1">
                                  ID del Píxel de Facebook (Meta Pixel ID)`,
  `className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                  ID del Píxel de Facebook (Meta Pixel ID)`
);

code = code.replace(
  `className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-mono font-bold text-stone-900 bg-stone-50/70 focus:bg-white focus:border-[#0b3d2e] outline-none"`,
  `className="w-full px-3 py-2.5 border border-zinc-800 rounded-xl text-xs font-mono font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"`
);

code = code.replace(
  `className="block text-[10px] font-black uppercase tracking-wider text-stone-700 mb-1">
                                  Token de API de Conversiones (CAPI Access Token)`,
  `className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                  Token de API de Conversiones (CAPI Access Token)`
);

code = code.replace(
  `className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-mono font-bold text-stone-900 bg-stone-50/70 focus:bg-white focus:border-[#0b3d2e] outline-none"`,
  `className="w-full px-3 py-2.5 border border-zinc-800 rounded-xl text-xs font-mono font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"`
);

// 2. Price config form styling
code = code.replace(
  `className="p-3 sm:p-3.5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2.5 animate-fadeIn"`,
  `className="p-3 sm:p-4 rounded-2xl bg-[#0d0d0f] border border-zinc-800 shadow-xs space-y-3 animate-fadeIn"`
);

code = code.replace(
  `className="px-2.5 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-xs font-bold text-stone-600 cursor-pointer transition-colors"`,
  `className="px-2.5 py-1.5 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-xs font-medium text-zinc-400 cursor-pointer transition-colors"`
);

code = code.replace(
  `className="px-3.5 py-1.5 rounded-xl bg-[#0b3d2e] hover:bg-[#135944] disabled:opacity-60 text-white font-black text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all shrink-0"`,
  `className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all shrink-0"`
);

// Price inputs
code = code.replaceAll(
  `className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-bold outline-none bg-stone-50/60 focus:bg-white focus:ring-1 focus:ring-[#0b3d2e]"`,
  `className="w-full px-2.5 py-2 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-100 outline-none bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500"`
);

code = code.replaceAll(
  `className="block text-[10px] font-black uppercase tracking-wider text-stone-600 mb-0.5"`,
  `className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-0.5"`
);

code = code.replace(
  `className="bg-emerald-50/60 p-1.5 rounded-lg border border-emerald-200"`,
  `className="bg-zinc-900/60 p-1.5 rounded-xl border border-emerald-900/60"`
);

code = code.replace(
  `className="w-full px-2 py-1 border border-emerald-400 rounded text-xs font-black outline-none bg-white text-emerald-950 focus:ring-1 focus:ring-[#1ea856]"`,
  `className="w-full px-2.5 py-2 border border-emerald-800 rounded-xl text-xs font-bold outline-none bg-zinc-900 text-emerald-400 focus:border-emerald-500"`
);

// 3. Orders client table styling
code = code.replace(
  `className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#0b3d2e]">
                                  Clientes de este Producto`,
  `className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-100">
                                  Clientes de este Producto`
);

code = code.replace(
  `className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900"`,
  `className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/80"`
);

code = code.replace(
  `className="text-xs font-mono text-stone-600">
                                Total Ventas Activas:`,
  `className="text-xs font-mono text-zinc-400">
                                Total Ventas Activas:`
);

code = code.replace(
  `<strong className="text-[#0a7a4a] font-black">
                                  {formatGs(totalVentasProd)}
                                </strong>`,
  `<strong className="text-emerald-400 font-bold">
                                  {formatGs(totalVentasProd)}
                                </strong>`
);

// Client table filters box
code = code.replace(
  `className="p-3 sm:p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
                              {/* Fila 1: Buscador por Nombre, Buscador por Teléfono y Pestañas Activos / Archivados / Todos */}`,
  `className="p-3 sm:p-4 rounded-2xl bg-[#0d0d0f] border border-zinc-800 shadow-xs space-y-3">
                              {/* Fila 1: Buscador por Nombre, Buscador por Teléfono y Pestañas Activos / Archivados / Todos */}`
);

// Orders filters inputs
code = code.replace(
  `className="w-full pl-3 pr-8 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 bg-stone-50/70 focus:bg-white focus:border-[#0b3d2e] outline-none"`,
  `className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-zinc-800 text-xs font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"`
);

code = code.replace(
  `className="w-full pl-3 pr-8 py-2 rounded-xl border border-stone-300 text-xs font-bold font-mono text-stone-900 bg-stone-50/70 focus:bg-white focus:border-[#0b3d2e] outline-none"`,
  `className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-zinc-800 text-xs font-mono font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"`
);

code = code.replace(
  `className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200"`,
  `className="grid grid-cols-3 gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800"`
);

code = code.replace(
  `filterArchiveMode === 'activos'
                                          ? 'bg-[#0b3d2e] text-white shadow-2xs'
                                          : 'text-stone-600 hover:text-stone-900'`,
  `filterArchiveMode === 'activos'
                                          ? 'bg-zinc-800 text-emerald-400 shadow-xs'
                                          : 'text-zinc-400 hover:text-zinc-200'`
);

code = code.replace(
  `filterArchiveMode === 'archivados'
                                          ? 'bg-amber-600 text-white shadow-2xs'
                                          : 'text-stone-600 hover:text-stone-900'`,
  `filterArchiveMode === 'archivados'
                                          ? 'bg-zinc-800 text-amber-300 shadow-xs'
                                          : 'text-zinc-400 hover:text-zinc-200'`
);

code = code.replace(
  `filterArchiveMode === 'todos'
                                          ? 'bg-stone-800 text-white shadow-2xs'
                                          : 'text-stone-600 hover:text-stone-900'`,
  `filterArchiveMode === 'todos'
                                          ? 'bg-zinc-800 text-white shadow-xs'
                                          : 'text-zinc-400 hover:text-zinc-200'`
);

code = code.replace(
  `className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2"`,
  `className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2"`
);

code = code.replace(
  `isAllFilteredSelected
                                        ? 'bg-[#0b3d2e] text-white border-[#0b3d2e]'
                                        : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300'`,
  `isAllFilteredSelected
                                        ? 'bg-zinc-800 text-white border-zinc-700'
                                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'`
);

code = code.replace(
  `className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 cursor-pointer"`,
  `className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800 cursor-pointer"`
);

code = code.replace(
  `className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-stone-950 border border-amber-700/30 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-all"`,
  `className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-amber-300 border border-zinc-800 shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-all"`
);

code = code.replace(
  `className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white border border-blue-800 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-all"`,
  `className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-blue-300 border border-zinc-800 shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-all"`
);

code = code.replace(
  `className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-40 text-white border border-red-800 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-all"`,
  `className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-950/40 hover:bg-red-900/60 disabled:opacity-40 text-red-300 border border-red-900/50 shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-all"`
);

code = code.replace(
  `className="py-2.5 px-3 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-between text-xs text-stone-700"`,
  `className="py-2 px-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs text-zinc-300"`
);

code = code.replace(
  `className="py-7 px-4 rounded-xl border border-stone-200 bg-white text-center text-stone-400 text-xs"`,
  `className="py-8 px-4 rounded-xl border border-zinc-800 bg-[#0d0d0f] text-center text-zinc-500 text-xs"`
);

// 4. Order rows styling
code = code.replace(
  `isConfirmedByAgent
                                            ? 'bg-[#dcfce7] hover:bg-[#bbf7d0] border-[#16a34a] text-[#052e16]'
                                            : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800'
                                        } \${isRowSelected ? 'ring-2 ring-[#0b3d2e]' : ''}\`}`,
  `isConfirmedByAgent
                                            ? 'bg-[#0d0d0f] hover:bg-zinc-900/90 border-emerald-900/80 text-zinc-100'
                                            : 'bg-[#0d0d0f] hover:bg-zinc-900/90 border-zinc-800 text-zinc-200'
                                        } \${isRowSelected ? 'ring-1 ring-emerald-500/50' : ''}\`}`
);

code = code.replace(
  `isConfirmedByAgent
                                                ? 'bg-[#16a34a] text-white'
                                                : 'bg-stone-100 text-stone-600'`,
  `isConfirmedByAgent
                                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                                : 'bg-zinc-800 text-zinc-400'`
);

code = code.replace(
  `isConfirmedByAgent ? 'text-[#052e16]' : 'text-stone-900'`,
  `text-zinc-100`
);

code = code.replace(
  `isConfirmedByAgent ? 'text-[#064e3b]' : 'text-stone-600'`,
  `isConfirmedByAgent ? 'text-emerald-400' : 'text-zinc-400'`
);

code = code.replace(
  `className="h-7 px-2.5 text-[11px] font-black rounded-lg inline-flex items-center gap-1 cursor-pointer transition-all bg-[#25D366] hover:bg-[#1ebd5a] text-[#041911] border border-[#0b3d2e]/40"`,
  `className="h-8 px-3 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-all bg-[#25D366] hover:bg-[#1ebd5a] text-[#041911] shadow-xs"`
);

code = code.replace(
  `className="h-7 px-2 text-[11px] font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300"`,
  `className="h-8 px-2.5 text-xs font-medium rounded-lg inline-flex items-center gap-1 cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"`
);

code = code.replace(
  `className="h-7 w-7 text-[11px] font-bold rounded-lg inline-flex items-center justify-center cursor-pointer bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-300"`,
  `className="h-8 w-8 text-xs font-medium rounded-lg inline-flex items-center justify-center cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800"`
);

code = code.replace(
  `className="h-7 w-7 text-[11px] font-bold rounded-lg inline-flex items-center justify-center cursor-pointer bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 transition-colors"`,
  `className="h-8 w-8 text-xs font-medium rounded-lg inline-flex items-center justify-center cursor-pointer bg-zinc-900 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-900/50 transition-colors"`
);

// Order detail expanded panel
code = code.replace(
  `className="mt-1 p-3.5 sm:p-4 rounded-xl border border-[#0b3d2e]/30 bg-white space-y-3 shadow-xs animate-fadeIn"`,
  `className="mt-1.5 p-3.5 sm:p-4 rounded-xl border border-zinc-800 bg-[#0d0d0f] space-y-3 shadow-xs animate-fadeIn text-zinc-200"`
);

// 5. Connect tabs: conditionally show sections according to getProductSubTab(prod.id)
// We show pixel when tab is pixel
code = code.replace(
  `{/* APARTADO DIRECTO EN CADA PRODUCTO ABIERTO: PEGAR PÍXEL DE FACEBOOK Y TOKEN DE API (CAPI) */}
                          <form
                            onSubmit={e => handleSaveProductPixelConfig(e, prod)}
                            data-testid={\`product-pixel-token-box-\${prod.id}\`}`,
  `{/* TAB PIXEL */}
                          {getProductSubTab(prod.id) === 'pixel' && (
                          <form
                            onSubmit={e => handleSaveProductPixelConfig(e, prod)}
                            data-testid={\`product-pixel-token-box-\${prod.id}\`}`
);

// Close pixel tab condition after </form>
const oldPixelFormClose = `</form>

                          {/* Collapsible: Price Config (hidden by default) */}
                          {showPriceConfig && (`;

const newPixelFormClose = `</form>
                          )}

                          {/* TAB PRECIOS */}
                          {(getProductSubTab(prod.id) === 'precios' || showPriceConfig) && (`;

code = code.replace(oldPixelFormClose, newPixelFormClose);

// Replace voice catalog condition to also trigger on getProductSubTab(prod.id) === 'voz'
code = code.replace(
  `{/* Collapsible: Voice Catalog (hidden by default) */}
                          {showVoiceCatalog && (`,
  `{/* TAB VOZ & OPCIONES */}
                          {(getProductSubTab(prod.id) === 'voz' || showVoiceCatalog) && (`
);

// Show client table when tab is pedidos
const oldClientTableMarker = `{/* CLIENT TABLE (always visible) */}
                          <div className="space-y-3 pt-1">`;

const newClientTableMarker = `{/* TAB PEDIDOS */}
                          {getProductSubTab(prod.id) === 'pedidos' && (
                          <div className="space-y-3 pt-1">`;

code = code.replace(oldClientTableMarker, newClientTableMarker);

// Close tab pedidos before {showConfirmedOrdersPanel && ( or at the end of client table
const oldClientTableEndMarker = `                              {/* PAGINACIÓN DE PEDIDOS (10 EN 10) */}`;
// Let's find where client table ends: right after pagination:
const oldPaginationEnd = `                              {/* PAGINACIÓN DE PEDIDOS (10 EN 10) */}
                              {totalPages > 1 && (
                                <div className="pt-2 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <span className="text-stone-500 font-bold">
                                    Página <strong className="text-stone-800">{currentPage}</strong> de{' '}
                                    <strong className="text-stone-800">{totalPages}</strong> ({prodOrders.length} pedidos)
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={currentPage === 1}
                                      onClick={() => setProductCurrentPage(prod.id, currentPage - 1)}
                                      className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-40 text-xs font-black text-stone-700 flex items-center gap-1 cursor-pointer"
                                    >
                                      <ChevronLeft className="w-3.5 h-3.5" />
                                      <span>Anterior</span>
                                    </button>
                                    <span className="font-mono text-xs px-2 py-1 rounded bg-stone-100 text-stone-700">
                                      {currentPage} / {totalPages}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={currentPage >= totalPages}
                                      onClick={() => setProductCurrentPage(prod.id, currentPage + 1)}
                                      className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-40 text-xs font-black text-stone-700 flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>Siguiente</span>
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>`;

const newPaginationEnd = `                              {/* PAGINACIÓN DE PEDIDOS (10 EN 10) */}
                              {totalPages > 1 && (
                                <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <span className="text-zinc-400 font-medium">
                                    Página <strong className="text-zinc-100">{currentPage}</strong> de{' '}
                                    <strong className="text-zinc-100">{totalPages}</strong> ({prodOrders.length} pedidos)
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={currentPage === 1}
                                      onClick={() => setProductCurrentPage(prod.id, currentPage - 1)}
                                      className="px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-xs font-medium text-zinc-300 flex items-center gap-1 cursor-pointer"
                                    >
                                      <ChevronLeft className="w-3.5 h-3.5" />
                                      <span>Anterior</span>
                                    </button>
                                    <span className="font-mono text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300">
                                      {currentPage} / {totalPages}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={currentPage >= totalPages}
                                      onClick={() => setProductCurrentPage(prod.id, currentPage + 1)}
                                      className="px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-xs font-medium text-zinc-300 flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>Siguiente</span>
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}`;

code = code.replace(oldPaginationEnd, newPaginationEnd);

fs.writeFileSync(adminViewPath, code, 'utf8');
console.log('Saved orders and subtabs dark transformations.');
