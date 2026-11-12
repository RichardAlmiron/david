import React, { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  Lightbulb,
  X
} from 'lucide-react';

export interface GuideStep {
  icon?: string;
  title: string;
  description: string;
}

interface AdminSectionGuideProps {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  steps: GuideStep[];
  proTip?: string;
  defaultExpanded?: boolean;
  extraRightActions?: React.ReactNode;
}

export const AdminSectionGuide: React.FC<AdminSectionGuideProps> = ({
  id,
  title,
  subtitle,
  badge = 'Guía',
  steps,
  proTip,
  defaultExpanded = false,
  extraRightActions
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(defaultExpanded);

  return (
    <div className="w-full text-zinc-100">
      {/* Barra de Cabecera Ultra-Compacta: Título a la izquierda + Botón Simple de Guía (y acciones extra como Filtros) a la derecha */}
      <div className="flex flex-wrap items-center justify-between gap-2 py-1 px-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">
            {title}
          </h3>
          <span className="hidden md:inline text-[11px] text-zinc-500 truncate">
            — {subtitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {extraRightActions}
          <button
            type="button"
            data-testid={`guide-toggle-btn-${id}`}
            onClick={() => setIsOpen(prev => !prev)}
            className={`h-8 px-2.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer select-none transition-all ${
              isOpen
                ? 'bg-emerald-950/90 border-emerald-600 text-emerald-200 shadow-sm'
                : 'bg-[#0f0f11] hover:bg-zinc-900 border-zinc-800 text-zinc-300'
            }`}
            title={isOpen ? 'Ocultar guía de esta sección' : 'Abrir guía rápida de esta sección'}
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>📖 Guía</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-emerald-300' : 'text-zinc-500'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Panel Desplegable solo al hacer clic en el botón Guía */}
      {isOpen && (
        <div className="mt-2 p-3.5 rounded-lg bg-[#0f0f11] border border-zinc-800 shadow-lg space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/70 shrink-0">
                {badge}
              </span>
              <span className="text-xs font-bold text-zinc-200 truncate">
                {subtitle}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 cursor-pointer"
              title="Cerrar Guía"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {steps.map((st, i) => (
              <div
                key={i}
                className="p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800/90 flex items-start gap-2"
              >
                <span className="text-sm shrink-0 mt-0.5">
                  {st.icon || '📌'}
                </span>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-zinc-200">
                    {st.title}
                  </h4>
                  <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
                    {st.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {proTip && (
            <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 flex items-start gap-2 text-xs text-emerald-200">
              <Lightbulb className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-snug text-[11px]">
                <strong className="text-emerald-300 font-bold mr-1">
                  Consejo Pro:
                </strong>
                <span className="text-zinc-300">{proTip}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
