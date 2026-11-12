const fs=require('fs');
const c=fs.readFileSync('src/views/AdminView.tsx','utf8');

console.log('=== VERIFICATION REPORT ===\n');

// data-testid count
const testIds = (c.match(/data-testid=/g) || []).length;
console.log('data-testid attributes: ' + testIds);

// All sub-tabs accessible
const tabs = ['pedidos', 'confirmados', 'pagos_adelantados', 'pixel', 'precios', 'voz'];
console.log('\nSub-tabs:');
tabs.forEach(t => {
  const count = (c.match(new RegExp("setProductSubTab\\(prod\\.id, '" + t + "'\\)", 'g')) || []).length;
  console.log('  ' + (count > 0 ? 'OK' : 'MISSING!') + ' ' + t + ' (' + count + ' calls)');
});

// Sidebar menus
console.log('\nSidebar menus:');
const menus = ['productos', 'creador', 'pipeboard', 'whatsapp', 'deepgram', 'openrouter'];
menus.forEach(m => {
  const count = (c.match(new RegExp("setActiveMenu\\('" + m + "'\\)", 'g')) || []).length;
  console.log('  ' + (count > 0 ? 'OK' : 'MISSING!') + ' ' + m + ' (' + count + ' calls)');
});

// Critical buttons by data-testid
console.log('\nButtons (data-testid):');
const buttons = [
  'quick-excel-confirmed', 'edit-with-ai-btn', 'view-live-product',
  'delete-product-btn', 'btn-manual-order', 'quick-autotrain-agent',
  'clone-ab-angle', 'toggle-order-filters', 'admin-bulk-archive-btn',
  'admin-bulk-unarchive-btn', 'admin-bulk-delete-btn', 'admin-select-all-btn',
  'edit-template-builder', 'toggle-pixel-config', 'tab-confirmed-orders',
  'tab-prepaid-orders', 'admin-filter-name', 'admin-filter-phone',
  'admin-tab-activos', 'admin-tab-archivados', 'admin-tab-todos',
  'admin-table-select-all-checkbox', 'admin-row-checkbox',
  'sidebar-menu-productos', 'sidebar-menu-creador', 'sidebar-menu-pipeboard',
  'sidebar-menu-whatsapp', 'sidebar-menu-deepgram', 'sidebar-menu-openrouter',
  'select-product-checkbox'
];
let allOk = true;
buttons.forEach(b => {
  const found = c.includes(b);
  if (!found) allOk = false;
  console.log('  ' + (found ? 'OK' : 'MISSING!') + ' ' + b);
});

// onClick count sanity
const onClicks = (c.match(/onClick/g) || []).length;
const onChanges = (c.match(/onChange/g) || []).length;
const onSubmits = (c.match(/onSubmit/g) || []).length;
console.log('\nEvent handlers: onClick=' + onClicks + ' onChange=' + onChanges + ' onSubmit=' + onSubmits);

console.log('\n' + (allOk ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED!'));
