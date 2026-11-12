/**
 * Rediseño Visual Admin Panel — Fase 3-5 (Segundo pase)
 * Limpieza de font-black restantes, rounded-2xl, gradientes y emojis residuales
 */
const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // ========== REMAINING font-black CLEANUPS ==========
  // Replace ALL remaining font-black with font-semibold (except WhatsApp green buttons which can keep bold)
  content = content.replace(/font-black/g, (match, offset) => {
    const context = content.substring(Math.max(0, offset - 100), offset + 100);
    // Keep font-black only in WhatsApp brand buttons (green #25D366 context)
    if (context.includes('#25D366') || context.includes('#041911')) {
      return 'font-bold';
    }
    return 'font-semibold';
  });

  // ========== REMAINING rounded-2xl → rounded-lg ==========
  content = content.replace(/rounded-2xl/g, 'rounded-lg');

  // ========== rounded-xl on inputs and small elements → rounded-lg ==========
  content = content.replace(/py-2\.5 rounded-xl border/g, 'py-2.5 rounded-lg border');
  content = content.replace(/rounded-xl text-\[10px\]/g, 'rounded-lg text-[10px]');
  content = content.replace(/rounded-xl text-\[11px\]/g, 'rounded-lg text-[11px]');
  content = content.replace(/rounded-xl text-\[9px\]/g, 'rounded-lg text-[9px]');
  content = content.replace(/rounded-xl text-xs/g, 'rounded-lg text-xs');

  // ========== Remove remaining animate-pulse ==========
  content = content.replace(/ animate-pulse/g, (match, offset) => {
    const context = content.substring(Math.max(0, offset - 150), offset + 150);
    if (context.includes('Conectando') || context.includes('loading') || context.includes('Generando QR')) {
      return match;
    }
    return '';
  });

  // ========== Remove remaining noisy shadows ==========
  content = content.replace(/ shadow-\[0_0_\d+px[^\]]*\]/g, '');
  content = content.replace(/shadow-md/g, 'shadow-sm');

  // ========== Emoji cleanup in remaining JSX ==========
  // Target specific emoji patterns in JSX content
  const emojiPatterns = [
    [/>\s*📌\s*/g, '>'],
    [/>\s*📋\s*/g, '>'],
    [/>\s*⚡\s*/g, '>'],
    [/>\s*🔍\s*/g, '>'],
    [/>\s*🎯\s*/g, '>'],
    [/>\s*📥\s*/g, '>'],
    [/>\s*🗄️\s*/g, '>'],
    [/>\s*📱\s*/g, '>'],
    [/>\s*📦\s*/g, '>'],
    [/>\s*🚚\s*/g, '>'],
    [/>\s*📡\s*/g, '>'],
    [/>\s*🔊\s*/g, '>'],
    [/>\s*🎵\s*/g, '>'],
    [/>\s*🎧\s*/g, '>'],
    [/>\s*🔒\s*/g, '>'],
    [/>\s*🔑\s*/g, '>'],
    [/>\s*🧠\s*/g, '>'],
    [/>\s*🎙️\s*/g, '>'],
    [/>\s*🔥\s*/g, '>'],
    [/>\s*✨\s*/g, '>'],
    [/>\s*💡\s*/g, '>'],
    [/>\s*📝\s*/g, '>'],
    [/>\s*🛡️\s*/g, '>'],
    [/>\s*⚙️\s*/g, '>'],
    [/>\s*📊\s*/g, '>'],
    [/>\s*🏷️\s*/g, '>'],
    [/>\s*✏️\s*/g, '>'],
    [/>\s*🔄\s*/g, '>'],
  ];

  for (const [pattern, replacement] of emojiPatterns) {
    content = content.replace(pattern, replacement);
  }

  // ========== COLOR REFINEMENTS ==========
  // amber-300 text → amber-400 (better contrast on dark)
  content = content.replace(/text-amber-300/g, 'text-amber-400');

  // Remove text-[#041911] (too dark green) → text-black
  content = content.replace(/text-\[#041911\]/g, 'text-black');

  // ========== SPACING REFINEMENTS ==========
  // text-[9px] → text-[10px] minimum floor
  content = content.replace(/text-\[9px\]/g, 'text-[10px]');
  // text-[8px] → text-[10px]
  content = content.replace(/text-\[8px\]/g, 'text-[10px]');

  const changes = content !== original;
  if (changes) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  return changes;
}

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
  }
}
console.log(`\nDone: ${totalChanged} files modified.`);
