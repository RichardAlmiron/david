const fs = require('fs');
const file = 'src/views/AdminView.tsx';
let src = fs.readFileSync(file, 'utf8');
const original = src;

// 1. Remove the redundant "Pedidos" button from toolbar (lines 2940-2942)
src = src.replace(
  /                               <button type="button" onClick=\{e => \{ e\.stopPropagation\(\); setProductSubTab\(prod\.id, 'pedidos'\); \}\} className=\{`h-6 px-2 rounded text-\[11px\].*?\}\}\`\}>\n                                Pedidos <span className="text-\[10px\] text-zinc-400 ml-0\.5">\{activeProdOrdersCount\}<\/span>\n                              <\/button>\n/,
  ''
);

// 2. In the orders list header, replace "Pedidos" with just the count
src = src.replace(
  `<span className="truncate">Pedidos</span>`,
  `<span className="truncate">{prodOrders.length} pedidos</span>`
);

// 3. In the pagination, change "clientes" to "pedidos"
src = src.replace(
  `clientes (10 por página)`,
  `pedidos (10 por página)`
);

// 4. Add order count badge to the Abrir/Cerrar button
src = src.replace(
  `{isExpanded ? 'Cerrar' : 'Abrir'}
                            <ChevronDown className={\`w-3 h-3 transition-transform \${isExpanded ? 'rotate-180' : ''}\`} />`,
  `{isExpanded ? 'Cerrar' : \`Abrir (\${activeProdOrdersCount})\`}
                            <ChevronDown className={\`w-3 h-3 transition-transform \${isExpanded ? 'rotate-180' : ''}\`} />`
);

// 5. Simplify the order detail header - remove redundant "Pedido #N · ID" since it's already visible in the row
src = src.replace(
  `Pedido #{rowNumber} · {ord.reservaid}`,
  `#{rowNumber}`
);

// 6. Remove the verbose emoji from date
src = src.replace(
  `📅 {fullFormattedDate} a las {formattedTime}hs`,
  `{fullFormattedDate} · {formattedTime}`
);

// 7. Simplify "Copiar Ficha Completa del Pedido (1 Clic)" - too verbose
src = src.replace(
  `Copiar Ficha Completa del Pedido (1 Clic)`,
  `Copiar Ficha Completa`
);

// 8. Remove emojis from order detail section headers
src = src.replace(`<span>👤 Datos del Cliente</span>`, `<span>Datos del Cliente</span>`);
src = src.replace(`<span>🏠 Referencia y GPS</span>`, `<span>Referencia y GPS</span>`);

// 9. Remove emoji from "Abrir GPS" button text already clean, but clean building emoji  
// Already has emoji in tipoVivienda line, keep that since it's informational

const changed = src !== original;
if (changed) {
  fs.writeFileSync(file, src, 'utf8');
  console.log('OK: Orders cleanup done.');
} else {
  console.log('WARN: No changes made - patterns not found.');
}

// Verify
const after = fs.readFileSync(file, 'utf8');
console.log('Has Pedidos button in toolbar:', /setProductSubTab\(prod\.id, 'pedidos'\)/.test(after));
console.log('Has "clientes (10 por pagina)":', after.includes('clientes (10 por'));
console.log('Has "Copiar Ficha Completa del Pedido (1 Clic)":', after.includes('Copiar Ficha Completa del Pedido (1 Clic)'));
console.log('Lines:', after.split('\n').length);
