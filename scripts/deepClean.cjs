const fs = require('fs');
let c = fs.readFileSync('src/views/AdminView.tsx', 'utf8');
let n = 0;

// =============================================
// 1. REMOVE "Editar IA" button from product header
// =============================================
const editIaBtn = `                          <button
                            type="button"
                            data-testid={\`edit-with-ai-btn-\${prod.id}\`}
                            onClick={e => {
                              e.stopPropagation();
                              setEditingProductInBuilder(prod);
                              setActiveMenu('creador');
                            }}
                            className="h-8 px-3 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 text-sm font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-700/40 transition-colors duration-150 whitespace-nowrap"
                            title="Editar esta p\u00e1gina con Agente IA (DeepSeek)"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="hidden sm:inline">Editar IA</span>
                          </button>

                          `;
if (c.includes(editIaBtn)) { c = c.replace(editIaBtn, '                          '); n++; console.log('1. Removed Editar IA button'); }
else console.log('1. NOT FOUND: Editar IA button');

// =============================================
// 2. REMOVE "Ver" button from product header
// =============================================
const verBtn = `                          <button
                            type="button"
                            data-testid={\`view-live-product-\${prod.id}\`}
                            onClick={e => {
                              e.stopPropagation();
                              setCurrentProductPage(prod);
                              window.history.pushState({}, '', \`/?p=\${prod.slug}\`);
                              setCurrentView('store');
                            }}
                            className="h-8 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer border border-zinc-800 transition-colors duration-150 whitespace-nowrap"
                            title="Abrir y ver esta p\u00e1gina de producto en vivo"
                          >
                            <Eye className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                            <span className="hidden md:inline">Ver</span>
                          </button>

                          `;
if (c.includes(verBtn)) { c = c.replace(verBtn, '                          '); n++; console.log('2. Removed Ver button'); }
else console.log('2. NOT FOUND: Ver button');

// =============================================
// 3. REMOVE tab "Todos" button
// =============================================
const todosTab = `                              <button
                                type="button"
                                onClick={() => setProductSubTab(prod.id, 'pedidos')}
                                className={\`h-7 px-2 rounded-md text-xs font-medium transition-colors duration-150 inline-flex items-center gap-1 cursor-pointer \${
                                  getProductSubTab(prod.id) === 'pedidos'
                                    ? 'bg-zinc-800 text-white'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }\`}
                              >
                                <span>Todos ({allProdOrders.length})</span>
                              </button>

                              `;
if (c.includes(todosTab)) { c = c.replace(todosTab, '                              '); n++; console.log('3. Removed Todos tab'); }
else console.log('3. NOT FOUND: Todos tab');

// =============================================
// 4. REMOVE tab "Confirmados" button
// =============================================
const confirmadosTab = `                              <button
                                type="button"
                                data-testid={\`tab-confirmed-orders-\${prod.id}\`}
                                onClick={() => setProductSubTab(prod.id, 'confirmados')}
                                className={\`h-7 px-2 rounded-md text-xs font-medium transition-colors duration-150 inline-flex items-center gap-1 cursor-pointer \${
                                  getProductSubTab(prod.id) === 'confirmados'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/40'
                                }\`}
                                title="Ver pedidos confirmados pendientes de cobro al recibir"
                              >
                                <span>Confirmados ({confirmedProdOrdersCount})</span>
                                {prepaidPendingVerifyCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-medium">
                                    {prepaidPendingVerifyCount}
                                  </span>
                                )}
                              </button>

                              `;
if (c.includes(confirmadosTab)) { c = c.replace(confirmadosTab, '                              '); n++; console.log('4. Removed Confirmados tab'); }
else console.log('4. NOT FOUND: Confirmados tab');

// =============================================
// 5. REMOVE tab "Pago Adel." button
// =============================================
const pagoAdelTab = `                              <button
                                type="button"
                                data-testid={\`tab-prepaid-orders-\${prod.id}\`}
                                onClick={() => setProductSubTab(prod.id, 'pagos_adelantados')}
                                className={\`h-7 px-2 rounded-md text-xs font-medium transition-colors duration-150 inline-flex items-center gap-1 cursor-pointer \${
                                  getProductSubTab(prod.id) === 'pagos_adelantados'
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-sky-950/40 text-sky-300 border border-sky-800/40 hover:bg-sky-900/40'
                                }\`}
                                title="Pedidos confirmados que YA PAGARON por adelantado"
                              >
                                <span>Pago Adel. ({prepaidVerifiedOrdersCount})</span>
                              </button>

                              `;
if (c.includes(pagoAdelTab)) { c = c.replace(pagoAdelTab, '                              '); n++; console.log('5. Removed Pago Adel tab'); }
else console.log('5. NOT FOUND: Pago Adel tab');

// =============================================
// 6. REMOVE "Plantillas" button
// =============================================
const plantillaBtn = `                              <button
                                type="button"
                                data-testid={\`edit-template-builder-\${prod.id}\`}
                                onClick={() => {
                                  setEditingProductInBuilder(prod);
                                  setShowNewProductModal(true);
                                }}
                                className="h-7 px-2 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-[12px] font-medium text-zinc-400 cursor-pointer transition-colors duration-150"
                              >
                                Plantillas
                              </button>`;
if (c.includes(plantillaBtn)) { c = c.replace(plantillaBtn, ''); n++; console.log('6. Removed Plantillas button'); }
else console.log('6. NOT FOUND: Plantillas button');

// =============================================
// 7. REMOVE "Entrenar" button
// =============================================
const entrenarBtn = `
                              <button
                                type="button"
                                data-testid={\`quick-autotrain-agent-\${prod.id}\`}
                                onClick={() => handleQuickAutoTrainProductAgent(prod)}
                                className="h-7 px-2 rounded-md border border-emerald-900/40 bg-emerald-950/30 hover:bg-emerald-900/30 text-[12px] font-medium text-emerald-400 cursor-pointer transition-colors duration-150"
                              >
                                Entrenar
                              </button>`;
if (c.includes(entrenarBtn)) { c = c.replace(entrenarBtn, ''); n++; console.log('7. Removed Entrenar button'); }
else console.log('7. NOT FOUND: Entrenar button');

// =============================================
// 8. REMOVE "Clonar" button (was "Clonar A/B")
// =============================================
const clonarBtn = `
                              <button
                                type="button"
                                data-testid={\`clone-ab-angle-\${prod.id}\`}
                                onClick={() => handleCloneProductWithNewAngle(prod)}
                                className="h-7 px-2 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-[12px] font-medium text-zinc-400 cursor-pointer transition-colors duration-150"
                              >
                                Clonar A/B
                              </button>`;
if (c.includes(clonarBtn)) { c = c.replace(clonarBtn, ''); n++; console.log('8. Removed Clonar button'); }
else console.log('8. NOT FOUND: Clonar button');

// =============================================
// 9. REMOVE ProductConfirmedOrdersPanel rendering
// =============================================
const confirmedPanel = `                          {/* INTERFAZ 1: Pesta\u00f1a Exclusiva de Pedidos Confirmados o Pesta\u00f1a Exclusiva de Pago Adelantado */}
                          {(getProductSubTab(prod.id) === 'confirmados' ||
                            getProductSubTab(prod.id) === 'pagos_adelantados' ||
                            showConfirmedOrdersPanel) && (
                            <ProductConfirmedOrdersPanel
                              product={prod}
                              orders={allProdOrders}
                              panelMode={
                                getProductSubTab(prod.id) === 'pagos_adelantados'
                                  ? 'pagos_adelantados'
                                  : 'confirmados'
                              }
                              onSwitchSubTab={tab => setProductSubTab(prod.id, tab)}
                              onUpdateOrderLogistics={async (orderId, updates, toastMsg) => {
                                await updateOrder(orderId, updates);
                                if (toastMsg) showToast(toastMsg);
                              }}
                              onRequestDeleteOrders={openRedDeleteConfirmModal}
                              onClose={() => {
                                setShowConfirmedOrdersPanel(false);
                                setProductSubTab(prod.id, 'pedidos');
                              }}
                            />
                          )}`;
if (c.includes(confirmedPanel)) { c = c.replace(confirmedPanel, ''); n++; console.log('9. Removed ProductConfirmedOrdersPanel rendering'); }
else console.log('9. NOT FOUND: ProductConfirmedOrdersPanel rendering');

// =============================================
// 10. Change pedidos tab condition: show orders when NOT on pixel/precios/voz
// =============================================
c = c.replace(
  `{getProductSubTab(prod.id) === 'pedidos' && (`,
  `{!['pixel', 'precios', 'voz'].includes(getProductSubTab(prod.id)) && (`
);
n++; console.log('10. Changed pedidos tab to default view');

// =============================================
// 11. Rename remaining tabs shorter & compact
// =============================================
c = c.replace(`<span>P\u00edxel & CAPI</span>`, `<span>P\u00edxel</span>`);
n++; console.log('11. Renamed Pixel & CAPI to Pixel');

// =============================================
// 12. Make remaining tabs even smaller: h-7 → h-6
// =============================================
// Only for pixel/precios/voz tabs (3 remaining)
c = c.replace(
  /h-7 px-2 rounded-md text-xs font-medium transition-colors duration-150 inline-flex items-center gap-1 cursor-pointer/g,
  'h-6 px-1.5 rounded text-[11px] font-medium transition-colors duration-150 inline-flex items-center cursor-pointer'
);
n++; console.log('12. Made remaining tabs h-6 compact');

console.log('\nTotal changes: ' + n);
fs.writeFileSync('src/views/AdminView.tsx', c, 'utf8');
