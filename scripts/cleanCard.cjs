const fs=require('fs');
let c=fs.readFileSync('src/views/AdminView.tsx','utf8');
let n=0;

// All tab buttons in expanded card
c=c.replace(/h-8 px-3 rounded-md text-sm font-medium transition-colors duration-150 inline-flex items-center gap-1\.5 cursor-pointer/g, () => {n++; return 'h-7 px-2 rounded-md text-xs font-medium transition-colors duration-150 inline-flex items-center gap-1 cursor-pointer';});

// Remove tab icons
c=c.replace(/<PackageCheck className="w-3\.5 h-3\.5 text-zinc-400" \/>\n\s*<span>Todos/g, () => {n++; return '<span>Todos';});
c=c.replace(/<CheckCircle2 className="w-3\.5 h-3\.5" \/>\n\s*<span>Confirmados/g, () => {n++; return '<span>Confirmados';});
c=c.replace(/<Settings className="w-3\.5 h-3\.5 text-zinc-400" \/>\n\s*<span>Precios & WA<\/span>/g, () => {n++; return '<span>Precios</span>';});
c=c.replace(/<Bot className="w-3\.5 h-3\.5 text-zinc-400" \/>\n\s*<span>Voz & IA<\/span>/g, () => {n++; return '<span>Voz</span>';});

// Excel button smaller
c=c.replace(/h-7 px-2\.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium inline-flex items-center gap-1\.5/g, () => {n++; return 'h-6 px-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium inline-flex items-center gap-1';});

// Plantillas smaller
c=c.replace(/h-7 px-2 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-\[12px\] font-medium text-zinc-400 cursor-pointer transition-colors duration-150">\n\s*Plantillas/g, () => {n++; return 'h-6 px-1.5 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-medium text-zinc-400 cursor-pointer transition-colors duration-150">\n                                Plantilla';});

// Entrenar smaller
c=c.replace(/h-7 px-2 rounded-md border border-emerald-900\/40 bg-emerald-950\/30 hover:bg-emerald-900\/30 text-\[12px\] font-medium text-emerald-400 cursor-pointer transition-colors duration-150">\n\s*Entrenar/g, () => {n++; return 'h-6 px-1.5 rounded-md border border-emerald-900/40 bg-emerald-950/30 hover:bg-emerald-900/30 text-[11px] font-medium text-emerald-400 cursor-pointer transition-colors duration-150">\n                                Entrenar';});

// Clonar shorter
c=c.replace(/h-7 px-2 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-\[12px\] font-medium text-zinc-400 cursor-pointer transition-colors duration-150">\n\s*Clonar A\/B/g, () => {n++; return 'h-6 px-1.5 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-medium text-zinc-400 cursor-pointer transition-colors duration-150">\n                                Clonar';});

// Remove emoji from Cargar Cliente
c=c.replace(/<span>\u27a5 Cargar Cliente WhatsApp<\/span>/g, () => {n++; return '<span>Nuevo pedido</span>';});

// Legend: only lg, shorter labels
c=c.replace(/hidden sm:flex items-center gap-3 text-\[10px\] font-bold text-zinc-400 shrink-0/g, () => {n++; return 'hidden lg:flex items-center gap-2 text-[9px] font-medium text-zinc-500 shrink-0';});
c=c.replace(/Brillo \u00c1mbar = Pago Enviado \(Verificar\)/g, () => {n++; return 'Pago enviado';});
c=c.replace(/Brillo Celeste = Pago Adelantado/g, () => {n++; return 'Pago adelantado';});
c=c.replace(/Verde = Confirmado/g, () => {n++; return 'Confirmado';});
c=c.replace(/Gris = Pendiente/g, () => {n++; return 'Pendiente';});

// Legend dots smaller
c=c.replace(/w-2\.5 h-2\.5 rounded-xs bg-amber-400 border border-yellow-200 inline-block /g, () => {n++; return 'w-1.5 h-1.5 rounded-full bg-amber-400 inline-block ';});
c=c.replace(/w-2\.5 h-2\.5 rounded-xs bg-cyan-400 border border-sky-200 inline-block /g, () => {n++; return 'w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block ';});
c=c.replace(/w-2\.5 h-2\.5 rounded-xs bg-emerald-950 border border-emerald-500 inline-block/g, () => {n++; return 'w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block';});
c=c.replace(/w-2\.5 h-2\.5 rounded-xs bg-zinc-900 border border-zinc-700 inline-block/g, () => {n++; return 'w-1.5 h-1.5 rounded-full bg-zinc-600 inline-block';});

// Orders list header less prominent
c=c.replace(/px-3 py-2 rounded-lg bg-zinc-900\/90 border border-zinc-800 flex items-center justify-between gap-2 text-\[10px\] font-bold uppercase tracking-wider text-zinc-400/g, () => {n++; return 'px-2 py-1.5 rounded-md bg-zinc-900/40 border border-zinc-800/50 flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500';});

// Shorten header text
c=c.replace(/<span className="truncate">Pedidos \(Toc\u00e1 cualquier tarjeta para abrir toda la informaci\u00f3n\)<\/span>/g, () => {n++; return '<span className="truncate">Pedidos</span>';});

// Order rows: h-11 -> h-10
c=c.replace(/w-full h-11 min-h-\[44px\] max-h-\[44px\] px-2\.5 rounded-xl border/g, () => {n++; return 'w-full h-10 min-h-[40px] max-h-[40px] px-2 rounded-lg border';});

// Empty state: less padding
c=c.replace(/py-8 px-4 rounded-xl border border-zinc-800 bg-\[#0f0f11\] text-center text-zinc-500 text-xs/g, () => {n++; return 'py-5 px-4 rounded-lg border border-zinc-800/60 bg-[#0f0f11] text-center text-zinc-500 text-xs';});

// Archive mode tabs: text-sm -> text-xs
c=c.replace(/py-1\.5 px-2 rounded-md text-sm font-medium cursor-pointer transition-colors duration-150 whitespace-nowrap/g, () => {n++; return 'py-1 px-2 rounded-md text-xs font-medium cursor-pointer transition-colors duration-150 whitespace-nowrap';});

// CLIENTES header smaller
c=c.replace(/text-xs font-semibold uppercase tracking-wider text-zinc-100">\n\s*Clientes/g, () => {n++; return 'text-[11px] font-medium uppercase tracking-wider text-zinc-300">\n                                  Clientes';});

// Product card header: remove status badges (already shown in tabs)
const badgesBlock = `                              {confirmedProdOrdersCount > 0 && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 shrink-0">
                                  {confirmedProdOrdersCount} Confirmado{confirmedProdOrdersCount === 1 ? '' : 's'}
                                </span>
                              )}
                              {prepaidPendingVerifyCount > 0 && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/60 shrink-0">
                                  {prepaidPendingVerifyCount} Pago Enviado
                                </span>
                              )}
                              {prepaidVerifiedOrdersCount > 0 && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/60 shrink-0">
                                  {prepaidVerifiedOrdersCount} Pago Adelantado
                                </span>
                              )}`;
if (c.includes(badgesBlock)) {
  c = c.replace(badgesBlock, '');
  n++;
  console.log('  Removed product card status badges');
}

// Remove duplicate Confirmados + Pago Adel buttons in CLIENTES section
const dupButtons = `                                <button
                                  type="button"
                                  onClick={() => setProductSubTab(prod.id, 'confirmados')}
                                  className="h-7 px-2.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>Confirmados ({confirmedProdOrdersCount})</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setProductSubTab(prod.id, 'pagos_adelantados')}
                                  className="h-7 px-2.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/70 text-cyan-200 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors "
                                >
                                  <span>Pago Adelantado ({prepaidVerifiedOrdersCount})</span>
                                </button>

                                `;
if (c.includes(dupButtons)) {
  c = c.replace(dupButtons, '                                ');
  n++;
  console.log('  Removed duplicate Confirmados/Pago Adel buttons');
}

// Cargar Cliente button: also make it smaller
c=c.replace(/h-7 px-2\.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-black text-\[11px\] font-medium inline-flex items-center gap-1 cursor-pointer transition-all shadow-sm/g, () => {n++; return 'h-6 px-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-black text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer transition-all';});

// Filter button smaller
c=c.replace(/h-7 px-2\.5 rounded-lg border text-\[11px\] font-bold inline-flex items-center gap-1 cursor-pointer/g, () => {n++; return 'h-6 px-2 rounded-md border text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer';});

// Bulk action buttons: smaller
c=c.replace(/px-3\.5 py-1\.5 rounded-lg text-xs font-semibold/g, () => {n++; return 'px-2.5 py-1 rounded-md text-[11px] font-medium';});

console.log('Total changes: ' + n);
fs.writeFileSync('src/views/AdminView.tsx', c, 'utf8');
