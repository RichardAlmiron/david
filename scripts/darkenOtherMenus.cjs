const fs = require('fs');
const path = require('path');

// 1. AdminView.tsx updates for WhatsApp, Deepgram & OpenRouter tabs
const adminViewPath = path.resolve(__dirname, '../src/views/AdminView.tsx');
let code = fs.readFileSync(adminViewPath, 'utf8');

// WhatsApp Tab
code = code.replace(
  `{/* Top Banner: Add Unlimited WhatsApp Lines */}
              <div className="bg-white border border-[#dfdad0] rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-black uppercase tracking-wider">
                    <Smartphone className="w-3.5 h-3.5 text-[#0a7a4a]" />
                    <span>Sincronización Multi-Línea Ilimitada</span>
                  </div>
                  <h2 className="text-lg font-black text-[#0b3d2e]">
                    Administración de Cuentas de WhatsApp ({waSessions.length})
                  </h2>
                  <p className="text-xs text-stone-600 max-w-2xl">`,
  `{/* Top Banner: Add Unlimited WhatsApp Lines */}
              <div className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-mono uppercase tracking-wider">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sincronización Multi-Línea Ilimitada</span>
                  </div>
                  <h2 className="text-lg font-bold text-zinc-100">
                    Administración de Cuentas de WhatsApp ({waSessions.length})
                  </h2>
                  <p className="text-xs text-zinc-400 max-w-2xl">`
);

code = code.replace(
  `className="px-3.5 py-2.5 rounded-2xl border border-stone-300 bg-stone-50 focus:bg-white text-xs font-bold outline-none min-w-[230px]"`,
  `className="px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 text-xs font-medium outline-none min-w-[230px] focus:border-emerald-500"`
);

code = code.replace(
  `className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden flex flex-col justify-between"`,
  `className="bg-[#0d0d0f] rounded-2xl border border-zinc-800 shadow-xs overflow-hidden flex flex-col justify-between"`
);

code = code.replace(
  `className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[230px] text-center"`,
  `className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center min-h-[230px] text-center"`
);

code = code.replace(
  `className="bg-stone-50 border border-stone-200 rounded-2xl p-3 text-left space-y-2"`,
  `className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-left space-y-2"`
);

code = code.replace(
  `className="text-[11px] font-black text-stone-800"`,
  `className="text-[11px] font-semibold text-zinc-300"`
);

code = code.replace(
  `className="flex-1 px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-bold outline-none"`,
  `className="flex-1 px-3 py-2 rounded-xl border border-zinc-800 bg-black text-xs font-mono text-zinc-100 outline-none placeholder-zinc-500 focus:border-emerald-500"`
);

code = code.replace(
  `className="p-5 rounded-2xl bg-emerald-50 border-2 border-[#25D366] text-center space-y-3 my-auto"`,
  `className="p-5 rounded-2xl bg-zinc-900 border border-emerald-500/50 text-center space-y-3 my-auto"`
);

code = code.replace(
  `className="text-lg font-black text-[#0b3d2e] mt-2"`,
  `className="text-lg font-bold text-zinc-100 mt-2"`
);

code = code.replace(
  `className="text-xs text-stone-600 mt-1"`,
  `className="text-xs text-zinc-400 mt-1"`
);

// Deepgram tab
code = code.replace(
  `className="flex items-center bg-stone-200/70 p-1 rounded-2xl gap-1 max-w-md mx-auto"`,
  `className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 gap-1 max-w-md mx-auto"`
);

code = code.replace(
  `className="flex-1 py-2 px-3 rounded-xl text-xs font-black bg-white text-[#0b3d2e] shadow-xs flex items-center justify-center gap-2"`,
  `className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-zinc-800 text-white shadow-xs flex items-center justify-center gap-2"`
);

code = code.replace(
  `className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 flex items-center justify-center gap-2 cursor-pointer"`,
  `className="flex-1 py-2 px-3 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-2 cursor-pointer"`
);

code = code.replace(
  `className="bg-white border border-[#dfdad0] rounded-3xl p-6 shadow-xs space-y-4"`,
  `className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4"`
);

code = code.replaceAll(
  `className="bg-white border border-[#dfdad0] rounded-3xl p-6 shadow-xs`,
  `className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs`
);

code = code.replaceAll(
  `text-[#0b3d2e]`,
  `text-zinc-100`
);

code = code.replaceAll(
  `text-stone-500`,
  `text-zinc-400`
);

code = code.replaceAll(
  `text-stone-600`,
  `text-zinc-400`
);

code = code.replaceAll(
  `text-stone-700`,
  `text-zinc-300`
);

code = code.replaceAll(
  `text-stone-900`,
  `text-zinc-100`
);

fs.writeFileSync(adminViewPath, code, 'utf8');
console.log('✅ AdminView tabs updated to pure dark Vercel mode');

// 2. ProductConfirmedOrdersPanel.tsx updates
const confirmedPanelPath = path.resolve(__dirname, '../src/components/ProductConfirmedOrdersPanel.tsx');
if (fs.existsSync(confirmedPanelPath)) {
  let cCode = fs.readFileSync(confirmedPanelPath, 'utf8');
  
  cCode = cCode.replace(
    `className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#ecfdf5] via-white to-[#f0fdf4] border-2 border-[#16a34a] shadow-md space-y-4 animate-fadeIn"`,
    `className="p-4 sm:p-5 rounded-2xl bg-[#0d0d0f] border border-emerald-900/60 shadow-md space-y-4 animate-fadeIn text-zinc-100"`
  );

  cCode = cCode.replace(
    `className="p-3.5 rounded-2xl bg-white border border-emerald-200 shadow-2xs space-y-3"`,
    `className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xs space-y-3"`
  );

  cCode = cCode.replace(
    `className="self-end sm:self-auto px-3 py-1.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-xs font-black text-emerald-950 inline-flex items-center gap-1 cursor-pointer transition-colors"`,
    `className="self-end sm:self-auto px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 inline-flex items-center gap-1 cursor-pointer transition-colors"`
  );

  cCode = cCode.replaceAll(
    `className="w-full pl-3 pr-8 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 bg-stone-50/70 focus:bg-white focus:border-[#16a34a] outline-none"`,
    `className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-zinc-800 text-xs font-medium text-zinc-100 bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"`
  );

  cCode = cCode.replaceAll(
    `className="w-full pl-3 pr-8 py-2 rounded-xl border border-stone-300 text-xs font-bold font-mono text-stone-900 bg-stone-50/70 focus:bg-white focus:border-[#16a34a] outline-none"`,
    `className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-zinc-800 text-xs font-mono font-medium text-zinc-100 bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"`
  );

  cCode = cCode.replaceAll(
    `text-[#064e3b]`,
    `text-zinc-100`
  );

  cCode = cCode.replaceAll(
    `text-stone-600`,
    `text-zinc-400`
  );

  fs.writeFileSync(confirmedPanelPath, cCode, 'utf8');
  console.log('✅ ProductConfirmedOrdersPanel updated to dark mode');
}
