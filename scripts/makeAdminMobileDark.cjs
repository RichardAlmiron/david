const fs = require('fs');
const path = require('path');

const adminViewPath = path.resolve(__dirname, '../src/views/AdminView.tsx');
let code = fs.readFileSync(adminViewPath, 'utf8');

// 1. Replace Top Header with Android Native Vercel Header
const oldHeader = `<header className="h-14 bg-black border-b border-zinc-800 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="text-zinc-500">admin</span>
              <span>/</span>
              <span className="text-white font-medium">
                {activeMenu === 'productos' && 'paginas-y-ventas'}
                {activeMenu === 'creador' && 'creador-de-paginas-ia'}
                {activeMenu === 'pipeboard' && 'pipeboard-meta-ads'}
                {activeMenu === 'whatsapp' && 'conexiones-whatsapp'}
                {activeMenu === 'deepgram' && 'deepgram-todo-en-uno'}
                {activeMenu === 'openrouter' && 'cerebro-llm-deepgram'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                refreshOrders();
                fetchWhatsAppStatus();
                showToast('Datos actualizados.');
              }}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </header>`;

const newHeader = `<header className="h-14 bg-black/95 backdrop-blur-md border-b border-zinc-800/80 flex items-center justify-between px-3 sm:px-6 shrink-0 z-20 sticky top-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              title="Abrir Menú"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <span className="text-emerald-400 font-black text-xs font-mono">▲</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-zinc-500 hidden sm:inline">admin</span>
                <span className="text-zinc-700 hidden sm:inline">/</span>
                <span className="text-zinc-100 font-semibold truncate max-w-[140px] sm:max-w-none">
                  {activeMenu === 'productos' && 'Páginas & Ventas'}
                  {activeMenu === 'creador' && 'Creador IA'}
                  {activeMenu === 'pipeboard' && 'Pipeboard Ads'}
                  {activeMenu === 'whatsapp' && 'WhatsApp Multi-Línea'}
                  {activeMenu === 'deepgram' && 'Deepgram Aura-2'}
                  {activeMenu === 'openrouter' && 'Cerebro GLM-5.3'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => {
                refreshOrders();
                fetchWhatsAppStatus();
                showToast('Datos actualizados.');
              }}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
              title="Actualizar datos"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Actualizar</span>
            </button>

            <button
              onClick={() => setCurrentView('store')}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
              title="Ver Tienda Pública"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Tienda</span>
            </button>

            <button
              onClick={() => logoutAdmin()}
              className="p-2 rounded-xl border border-red-900/30 bg-red-950/20 hover:bg-red-950/40 text-red-400 transition-all cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>`;

if (code.includes(oldHeader)) {
  code = code.replace(oldHeader, newHeader);
  console.log('✅ Replaced Top Header');
} else {
  console.log('⚠️ oldHeader not matched');
}

// 2. Replace <main> styling with mobile-first safe area pb-28
const oldMain = `<main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">`;
const newMain = `<main className="flex-1 overflow-y-auto p-3 sm:p-6 pb-28 lg:pb-8 space-y-4 sm:space-y-6 bg-black text-zinc-100">`;

if (code.includes(oldMain)) {
  code = code.replace(oldMain, newMain);
  console.log('✅ Replaced <main> styling');
} else {
  console.log('⚠️ oldMain not matched');
}

// 3. Add Android Bottom Navigation Bar right after </main>
const bottomNavJsx = `        {/* Mobile Native Android Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#09090b]/95 backdrop-blur-md border-t border-zinc-800/90 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 px-1 flex items-center justify-around shadow-2xl">
          <button
            type="button"
            data-testid="bottom-nav-productos"
            onClick={() => setActiveMenu('productos')}
            className={\`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer \${
              activeMenu === 'productos' ? 'text-emerald-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }\`}
          >
            <Layers className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Páginas</span>
          </button>
          <button
            type="button"
            data-testid="bottom-nav-creador"
            onClick={() => setActiveMenu('creador')}
            className={\`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer \${
              activeMenu === 'creador' ? 'text-amber-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }\`}
          >
            <div className="relative">
              <Sparkles className="w-5 h-5 mb-0.5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <span className="text-[10px] tracking-tight">Creador IA</span>
          </button>
          <button
            type="button"
            data-testid="bottom-nav-pipeboard"
            onClick={() => setActiveMenu('pipeboard')}
            className={\`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer \${
              activeMenu === 'pipeboard' ? 'text-blue-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }\`}
          >
            <Bot className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Meta Ads</span>
          </button>
          <button
            type="button"
            data-testid="bottom-nav-whatsapp"
            onClick={() => setActiveMenu('whatsapp')}
            className={\`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer \${
              activeMenu === 'whatsapp' ? 'text-emerald-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }\`}
          >
            <div className="relative">
              <Smartphone className="w-5 h-5 mb-0.5" />
              {connectedSessionsCount > 0 && (
                <span className="absolute -top-1 -right-1.5 px-1 py-0.2 rounded-full bg-emerald-500 text-black text-[8px] font-black font-mono">
                  {connectedSessionsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">WhatsApp</span>
          </button>
          <button
            type="button"
            data-testid="bottom-nav-deepgram"
            onClick={() => setActiveMenu('deepgram')}
            className={\`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer \${
              activeMenu === 'deepgram' || activeMenu === 'openrouter' ? 'text-purple-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }\`}
          >
            <Zap className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Voz & LLM</span>
          </button>
        </nav>`;

if (!code.includes('bottom-nav-productos') && code.includes('        </main>\n      </div>')) {
  code = code.replace('        </main>\n      </div>', `        </main>\n\n${bottomNavJsx}\n      </div>`);
  console.log('✅ Added Android Bottom Navigation Bar');
}

fs.writeFileSync(adminViewPath, code, 'utf8');
console.log('Finished initial header & bottom nav updates.');
