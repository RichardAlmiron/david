const fs = require('fs');
const path = require('path');

const adminViewPath = path.resolve(__dirname, '../src/views/AdminView.tsx');
let code = fs.readFileSync(adminViewPath, 'utf8');

// A. Update Filter Bar in AdminView
const oldFilterBar = `<div
                data-testid="product-pages-filter-bar"
                className="p-3.5 sm:p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3"
              >`;

const newFilterBar = `<div
                data-testid="product-pages-filter-bar"
                className="p-3.5 sm:p-4 rounded-2xl bg-[#0d0d0f] border border-zinc-800/80 shadow-xs space-y-3"
              >`;

code = code.replace(oldFilterBar, newFilterBar);

// Update labels and inputs in filter bar
code = code.replace(
  `text-stone-600 mb-1">
                      🔍 Filtrar Página por Nombre o Link (Slug)`,
  `text-zinc-400 mb-1">
                      🔍 Filtrar Página por Nombre o Link (Slug)`
);

code = code.replace(
  `className="w-full pl-3 pr-8 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 bg-stone-50/70 focus:bg-white focus:border-[#0b3d2e] outline-none"`,
  `className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-zinc-800 text-xs font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"`
);

code = code.replace(
  `text-stone-600 mb-1">
                      🎯 Filtrar por ID de Píxel o WhatsApp`,
  `text-zinc-400 mb-1">
                      🎯 Filtrar por ID de Píxel o WhatsApp`
);

code = code.replace(
  `className="w-full pl-3 pr-8 py-2 rounded-xl border border-stone-300 text-xs font-bold font-mono text-stone-900 bg-stone-50/70 focus:bg-white focus:border-[#0b3d2e] outline-none"`,
  `className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-zinc-800 text-xs font-mono font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"`
);

code = code.replace(
  `text-stone-600 mb-1">
                      📋 Filtro Rápido de Páginas`,
  `text-zinc-400 mb-1">
                      📋 Filtro Rápido de Páginas`
);

code = code.replace(
  `className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200"`,
  `className="grid grid-cols-3 gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800"`
);

code = code.replace(
  `filterProductTab === 'todas'
                            ? 'bg-[#0b3d2e] text-white shadow-2xs'
                            : 'text-stone-600 hover:text-stone-900'`,
  `filterProductTab === 'todas'
                            ? 'bg-zinc-800 text-white shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'`
);

code = code.replace(
  `filterProductTab === 'con_pixel'
                            ? 'bg-emerald-700 text-white shadow-2xs'
                            : 'text-stone-600 hover:text-stone-900'`,
  `filterProductTab === 'con_pixel'
                            ? 'bg-zinc-800 text-emerald-400 shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'`
);

code = code.replace(
  `filterProductTab === 'envio_gratis'
                            ? 'bg-stone-800 text-white shadow-2xs'
                            : 'text-stone-600 hover:text-stone-900'`,
  `filterProductTab === 'envio_gratis'
                            ? 'bg-zinc-800 text-white shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'`
);

code = code.replace(
  `className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2"`,
  `className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2"`
);

code = code.replace(
  `isAllProductsSelected
                              ? 'bg-[#0b3d2e] text-white border-[#0b3d2e]'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300'`,
  `isAllProductsSelected
                              ? 'bg-zinc-800 text-white border-zinc-700'
                              : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'`
);

code = code.replace(
  `className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 cursor-pointer"`,
  `className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800 cursor-pointer"`
);

code = code.replace(
  `className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-40 text-white border border-red-800 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-all"`,
  `className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-950/40 hover:bg-red-900/60 disabled:opacity-40 text-red-300 border border-red-900/50 shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-all"`
);

// B. Recently Created Product Banner
code = code.replace(
  `className="bg-[#0b3d2e] text-white rounded-2xl p-4 border-2 border-[#e8b23a] shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"`,
  `className="bg-[#0d0d0f] text-white rounded-2xl p-4 border border-emerald-500/50 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"`
);

// C. Product Card Root Container
code = code.replace(
  `className={\`w-full bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs \${
                        isProductChecked
                          ? 'border-red-400 ring-2 ring-red-200'
                          : isJustCreated
                            ? 'border-[#1ea856] ring-2 ring-[#1ea856]/30 shadow-md'
                            : isExpanded
                              ? 'border-[#0b3d2e] ring-2 ring-[#0b3d2e]/10 shadow-md'
                              : 'border-stone-200 hover:border-stone-300 hover:shadow-xs'
                      }\`}`,
  `className={\`w-full bg-[#0d0d0f] rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs \${
                        isProductChecked
                          ? 'border-red-500/60 ring-1 ring-red-500/30'
                          : isJustCreated
                            ? 'border-emerald-500/60 ring-1 ring-emerald-500/30 shadow-md'
                            : isExpanded
                              ? 'border-zinc-700 ring-1 ring-zinc-700/50'
                              : 'border-zinc-800/80 hover:border-zinc-700'
                      }\`}`
);

// D. Product Row Header Container
code = code.replace(
  `className="w-full px-4 py-3 flex items-center justify-between gap-3 cursor-pointer select-none"`,
  `className="w-full p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"`
);

code = code.replace(
  `className="w-11 h-11 rounded-xl object-cover border border-stone-200 shrink-0"`,
  `className="w-12 h-12 rounded-xl object-cover border border-zinc-800 shrink-0"`
);

code = code.replace(
  `className="text-sm font-black text-[#0b3d2e] truncate"`,
  `className="text-sm font-bold text-zinc-100 truncate"`
);

code = code.replace(
  `className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0"`,
  `className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/80 shrink-0"`
);

code = code.replace(
  `className={\`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 \${
                                  hasPixelConfigured
                                    ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                    : 'bg-stone-100 text-stone-600 border border-stone-200'
                                }\`}`,
  `className={\`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full shrink-0 \${
                                  hasPixelConfigured
                                    ? 'bg-blue-950 text-blue-300 border border-blue-800/80'
                                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                                }\`}`
);

code = code.replace(
  `className="hidden sm:flex items-center gap-2 text-[11px] text-stone-500 mt-0.5 truncate"`,
  `className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1 truncate"`
);

code = code.replace(
  `<b className="text-stone-700">{formatGs(prod.precios?.[1] || 189000)}</b>`,
  `<b className="text-zinc-200">{formatGs(prod.precios?.[1] || 189000)}</b>`
);

code = code.replace(
  `className="font-bold text-stone-600"`,
  `className="font-medium text-zinc-400"`
);

// Actions in product row
code = code.replace(
  `className="flex items-center gap-2 sm:gap-2.5 shrink-0"`,
  `className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t border-zinc-800/60 sm:border-t-0"`
);

code = code.replace(
  `className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-800 via-teal-900 to-emerald-950 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-xs border border-emerald-500/50 transition-all hover:scale-[1.02]"`,
  `className="flex-1 sm:flex-initial h-10 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs border border-emerald-500/40 transition-all hover:border-emerald-500"`
);

code = code.replace(
  `className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"`,
  `className="h-10 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer border border-zinc-800 transition-colors"`
);

code = code.replace(
  `className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 text-xs font-black inline-flex items-center gap-1 cursor-pointer transition-colors"`,
  `className="h-10 w-10 rounded-xl bg-zinc-900 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-900/50 flex items-center justify-center cursor-pointer transition-colors"`
);

code = code.replace(
  `className={\`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer \${isExpanded
                                ? 'bg-[#0b3d2e] text-white shadow-xs'
                                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                              }\`}`,
  `className={\`h-10 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer border \${isExpanded
                                ? 'bg-zinc-800 text-white border-zinc-700'
                                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                              }\`}`
);

// E. Expanded product body container
code = code.replace(
  `className="border-t border-stone-200/80 bg-stone-50/50 p-3.5 sm:p-5 space-y-3.5 animate-fadeIn"`,
  `className="border-t border-zinc-800/90 bg-[#09090b] p-3 sm:p-5 space-y-4 animate-fadeIn"`
);

// F. Replace the messy toolbar with an Android Segmented Tab Bar inside expanded product
const oldToolbarFragment = `<div className="p-2 sm:p-2.5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">`;

const newSegmentedTabsFragment = `<div className="space-y-3">
                            {/* Android Native Segmented Tabs (Vercel Calm) */}
                            <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-900/90 rounded-xl border border-zinc-800">
                              <button
                                type="button"
                                onClick={() => setProductSubTab(prod.id, 'pedidos')}
                                className={\`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer \${
                                  getProductSubTab(prod.id) === 'pedidos'
                                    ? 'bg-zinc-800 text-white shadow-xs font-semibold'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }\`}
                              >
                                <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Pedidos ({allProdOrders.length})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setProductSubTab(prod.id, 'precios')}
                                className={\`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer \${
                                  getProductSubTab(prod.id) === 'precios'
                                    ? 'bg-zinc-800 text-white shadow-xs font-semibold'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }\`}
                              >
                                <Settings className="w-3.5 h-3.5 text-amber-400" />
                                <span>Precios & WA</span>
                              </button>

                              <button
                                type="button"
                                data-testid={\`toggle-pixel-config-\${prod.id}\`}
                                onClick={() => setProductSubTab(prod.id, 'pixel')}
                                className={\`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer \${
                                  getProductSubTab(prod.id) === 'pixel'
                                    ? 'bg-zinc-800 text-white shadow-xs font-semibold'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }\`}
                              >
                                <span className="text-blue-400 text-xs">🎯</span>
                                <span>Píxel & CAPI</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setProductSubTab(prod.id, 'voz')}
                                className={\`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer \${
                                  getProductSubTab(prod.id) === 'voz'
                                    ? 'bg-zinc-800 text-white shadow-xs font-semibold'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }\`}
                              >
                                <Bot className="w-3.5 h-3.5 text-purple-400" />
                                <span>Voz & IA</span>
                              </button>
                            </div>

                            {/* Quick Auto/Manual WhatsApp bar */}
                            <div className="p-2.5 rounded-xl bg-[#0d0d0f] border border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-zinc-300">Modo de Atención:</span>
                                <div className="inline-flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleToggleAutomationSetting('autoCallOnOrder', true);
                                      handleToggleAutomationSetting('autoChatOnOrder', true);
                                    }}
                                    className={\`py-1 px-2.5 rounded-md text-xs font-medium cursor-pointer transition-all \${
                                      autoCallOnOrder || autoChatOnOrder
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 shadow-xs'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                    }\`}
                                  >
                                    ⚡ Auto (\${preferredChannel === 'audio' ? 'Audio' : 'Texto'})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleToggleAutomationSetting('autoCallOnOrder', false);
                                      handleToggleAutomationSetting('autoChatOnOrder', false);
                                    }}
                                    className={\`py-1 px-2.5 rounded-md text-xs font-medium cursor-pointer transition-all \${
                                      !autoCallOnOrder && !autoChatOnOrder
                                        ? 'bg-zinc-800 text-white shadow-xs'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                    }\`}
                                  >
                                    👆 Manual
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  data-testid={\`edit-template-builder-\${prod.id}\`}
                                  onClick={() => {
                                    setEditingProductInBuilder(prod);
                                    setShowNewProductModal(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 cursor-pointer"
                                >
                                  Plantillas
                                </button>
                                <button
                                  type="button"
                                  data-testid={\`quick-autotrain-agent-\${prod.id}\`}
                                  onClick={() => handleQuickAutoTrainProductAgent(prod)}
                                  className="px-2.5 py-1 rounded-lg border border-emerald-900/60 bg-emerald-950/40 hover:bg-emerald-900/40 text-xs text-emerald-300 cursor-pointer"
                                >
                                  Entrenar 1000x
                                </button>
                                <button
                                  type="button"
                                  data-testid={\`clone-ab-angle-\${prod.id}\`}
                                  onClick={() => handleCloneProductWithNewAngle(prod)}
                                  className="px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 cursor-pointer"
                                >
                                  Clonar A/B
                                </button>
                              </div>
                            </div>
                          </div>`;

// Check if old toolbar exists and replace it
if (code.includes(oldToolbarFragment)) {
  // We locate the entire old toolbar up to line 2804
  const startIdx = code.indexOf(oldToolbarFragment);
  const endMarker = `{/* APARTADO DIRECTO EN CADA PRODUCTO ABIERTO: PEGAR PÍXEL DE FACEBOOK Y TOKEN DE API (CAPI) */}`;
  const endIdx = code.indexOf(endMarker, startIdx);
  if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + newSegmentedTabsFragment + '\n\n                          ' + code.substring(endIdx);
    console.log('✅ Replaced toolbar with segmented tabs');
  }
}

fs.writeFileSync(adminViewPath, code, 'utf8');
console.log('Saved AdminView updates.');
