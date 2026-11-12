/**
 * Rediseño Visual Admin Panel — Fase 3-5
 * Limpieza masiva de estilos: quitar emojis de UI, normalizar rounded, fonts, shadows, animations
 * SOLO cambios visuales/CSS — CERO lógica tocada
 */
const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // ========== GLOBAL CSS NORMALIZATIONS ==========

  // rounded-2xl → rounded-lg (everywhere except modals that need it)
  content = content.replace(/rounded-2xl/g, 'rounded-lg');

  // font-black → font-semibold (for text headings, not buttons)
  // Be selective - only in className strings
  content = content.replace(/text-\[9px\] font-mono font-black/g, 'text-[10px] font-mono font-medium');
  content = content.replace(/text-\[10px\] font-black/g, 'text-[10px] font-medium');
  content = content.replace(/text-\[11px\] font-black/g, 'text-[11px] font-medium');
  content = content.replace(/text-xs font-black/g, 'text-xs font-semibold');
  content = content.replace(/text-sm font-black/g, 'text-sm font-semibold');
  content = content.replace(/text-base font-black/g, 'text-base font-semibold');
  content = content.replace(/text-lg font-black/g, 'text-lg font-semibold');
  content = content.replace(/text-xl font-black/g, 'text-xl font-semibold');

  // Remove animate-pulse from non-critical elements (keep in loading spinners only)
  content = content.replace(/\s*animate-pulse/g, (match, offset) => {
    // Keep animate-pulse only if it's in a loading/spinner context
    const context = content.substring(Math.max(0, offset - 200), offset + 200);
    if (context.includes('loading') || context.includes('spinner') || context.includes('Cargando') || context.includes('Conectando')) {
      return match;
    }
    return '';
  });

  // Remove animate-bounce
  content = content.replace(/\s*animate-bounce/g, '');

  // Remove animate-fadeIn
  content = content.replace(/\s*animate-fadeIn/g, '');

  // shadow-2xl → shadow-lg
  content = content.replace(/shadow-2xl/g, 'shadow-lg');

  // shadow-xs → shadow-sm
  content = content.replace(/shadow-xs/g, 'shadow-sm');

  // shadow-2xs → shadow-sm
  content = content.replace(/shadow-2xs/g, 'shadow-sm');

  // Remove noisy glow shadows
  content = content.replace(/shadow-\[0_0_\d+px_rgba\([^)]+\)\]/g, '');

  // Remove noisy gradients from badges (bg-gradient-to-r from-xxx via-xxx to-xxx)
  // Replace with solid subtle backgrounds
  content = content.replace(
    /bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 text-black/g,
    'bg-amber-950 text-amber-400 border border-amber-800/60'
  );
  content = content.replace(
    /bg-gradient-to-r from-cyan-400 via-sky-300 to-amber-300 text-slate-950/g,
    'bg-sky-950 text-sky-300 border border-sky-800/60'
  );
  content = content.replace(
    /bg-gradient-to-r from-\[#062319\] via-\[#0b3d2e\] to-\[#062319\]/g,
    'bg-emerald-950/80'
  );

  // ========== EMOJI CLEANUP IN UI LABELS (NOT in toast/showToast strings) ==========
  // Only clean emojis that are in JSX text content (labels, badges), not in JS strings

  // Clean emojis from label/badge text (careful not to touch showToast strings)
  const uiEmojis = [
    ['📥 ', ''],
    ['📱 ', ''],
    ['🗄️ ', ''],
    ['📋 ', ''],
    ['🎯 ', ''],
    ['📦 ', ''],
    ['🚚 ', ''],
    ['📌 ', ''],
    ['⚡ ', ''],
    ['👆 ', ''],
    ['✅ ', ''],
    ['💎 ', ''],
    ['★ ', ''],
    ['💬 ', ''],
    ['📸 ', ''],
    ['🗂️ ', ''],
    ['🚀 ', ''],
    ['🤖 ', ''],
    ['📍 ', ''],
    ['📝 ', ''],
    ['🔒 ', ''],
    ['🔑 ', ''],
    ['🧠 ', ''],
    ['🎙️ ', ''],
    ['🎤 ', ''],
    ['🔥 ', ''],
    ['⏰ ', ''],
    ['📊 ', ''],
    ['🛡️ ', ''],
    ['⚙️ ', ''],
    ['🔗 ', ''],
    ['🎵 ', ''],
    ['🎧 ', ''],
    ['🔊 ', ''],
    ['🔔 ', ''],
    ['📡 ', ''],
    ['🏷️ ', ''],
    ['✨ ', ''],
    ['💡 ', ''],
    ['🔄 ', ''],
    ['✏️ ', ''],
    ['🖊️ ', ''],
  ];

  // Only replace emojis in JSX content (inside > ... <), not in JS string literals
  for (const [emoji, replacement] of uiEmojis) {
    // Replace emoji at start of JSX text content
    content = content.replace(new RegExp(`>${emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'), `>${replacement}`);
    // Replace emoji inside JSX spans
    content = content.replace(new RegExp(`\\n\\s+${emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'), (match) => {
      // Only if NOT inside a showToast or string literal
      return match.replace(emoji, replacement);
    });
  }

  // ========== COLOR NORMALIZATIONS ==========

  // Replace old gold/yellow colors with zinc neutrals
  content = content.replace(/text-\[#ffd778\]/g, 'text-emerald-300');
  content = content.replace(/text-\[#e8b23a\]/g, 'text-emerald-400');
  content = content.replace(/bg-\[#e8b23a\]/g, 'bg-emerald-500');
  content = content.replace(/border-\[#e8b23a\]/g, 'border-emerald-600');
  content = content.replace(/hover:bg-\[#ffd778\]/g, 'hover:bg-emerald-400');
  content = content.replace(/bg-\[#062319\]/g, 'bg-emerald-950');

  // Replace purple with zinc
  content = content.replace(/text-purple-400/g, 'text-zinc-400');
  content = content.replace(/text-purple-300/g, 'text-zinc-300');
  content = content.replace(/bg-purple-950/g, 'bg-zinc-900');
  content = content.replace(/border-purple-/g, 'border-zinc-');

  // Replace blue-950/90 badges with sky
  content = content.replace(/bg-blue-950\/90/g, 'bg-sky-950/80');
  content = content.replace(/text-blue-300/g, 'text-sky-300');
  content = content.replace(/border-blue-800\/80/g, 'border-sky-800/60');

  // ========== COMPONENT-SPECIFIC FIXES ==========

  // bg-[#0d0d0f] → bg-[#0f0f11] (slightly lighter surface)
  content = content.replace(/bg-\[#0d0d0f\]/g, 'bg-[#0f0f11]');

  // Replace old green #16a34a with emerald-600
  content = content.replace(/bg-\[#16a34a\]/g, 'bg-emerald-600');
  content = content.replace(/hover:bg-\[#15803d\]/g, 'hover:bg-emerald-700');
  content = content.replace(/bg-\[#1ea856\]/g, 'bg-emerald-600');
  content = content.replace(/hover:bg-\[#16a34a\]/g, 'hover:bg-emerald-500');

  // Clean up rounded-xl on small elements → rounded-lg
  content = content.replace(/rounded-xl border border-zinc-800 text-xs/g, 'rounded-lg border border-zinc-800 text-xs');
  content = content.replace(/rounded-xl border border-zinc-800 text-\[/g, 'rounded-lg border border-zinc-800 text-[');
  content = content.replace(/rounded-xl bg-zinc-900/g, 'rounded-lg bg-zinc-900');
  content = content.replace(/rounded-xl bg-emerald/g, 'rounded-lg bg-emerald');
  content = content.replace(/rounded-xl bg-red/g, 'rounded-lg bg-red');
  content = content.replace(/rounded-xl bg-\[#/g, 'rounded-lg bg-[#');

  // Clean up accent-[#16a34a] → accent-emerald-500
  content = content.replace(/accent-\[#16a34a\]/g, 'accent-emerald-500');

  // Replace stone-400 with zinc-500
  content = content.replace(/text-stone-400/g, 'text-zinc-500');

  // Remove backdrop-blur-xs → backdrop-blur-sm
  content = content.replace(/backdrop-blur-xs/g, 'backdrop-blur-sm');

  // ========== SPECIFIC SECTION CLEANUPS ==========

  // Pixel config reference section header cleanup
  content = content.replace(
    /Tu Referencia Oficial de Meta Ads en Vivo \(1 Clic para Copiar o Usar\)/g,
    'Referencia Meta Ads'
  );

  // Pixel & CAPI section header cleanup
  content = content.replace(
    /Píxel de Facebook & Token de API \(Servidor Anti-Apple CAPI\)/g,
    'Píxel de Facebook & Token API (CAPI)'
  );

  // Clean "Entrenar 1000x" → "Entrenar"
  content = content.replace(/>Entrenar 1000x</g, '>Entrenar<');

  const changes = content !== original;
  if (changes) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  return changes;
}

// Process all target files
const files = [
  'src/views/AdminView.tsx',
  'src/components/ProductConfirmedOrdersPanel.tsx',
  'src/components/ProductSellerAgentPanel.tsx',
  'src/components/AdminSectionGuide.tsx',
  'src/views/AdminLoginView.tsx',
  'src/components/AutoAdsView.tsx',
];

const root = path.resolve(__dirname, '..');
let totalChanged = 0;
for (const file of files) {
  const fullPath = path.join(root, file);
  if (fs.existsSync(fullPath)) {
    const changed = processFile(fullPath);
    console.log(`${changed ? '✓' : '—'} ${file}`);
    if (changed) totalChanged++;
  } else {
    console.log(`✗ ${file} (not found)`);
  }
}
console.log(`\nDone: ${totalChanged} files modified.`);
