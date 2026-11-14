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
      <div className="flex flex-wrap items-center justify-between gap-3 py-1 px-0.5">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
            {title}
          </h2>
          <span className="hidden md:inline text-xs text-zinc-400 truncate">
            · {subtitle}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {extraRightActions}
          <button
            type="button"
            data-testid={`guide-toggle-btn-${id}`}
            onClick={() => setIsOpen(prev => !prev)}
            className={`h-8 px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer select-none transition-colors whitespace-nowrap ${
              isOpen
                ? 'bg-white/[0.08] border-[#e5c88b]/60 text-[#e5c88b]'
                : 'bg-[#0b0e16]/80 hover:bg-white/[0.06] border-white/10 text-zinc-300'
            }`}
            title={isOpen ? 'Ocultar guía de esta sección' : 'Abrir guía rápida de esta sección'}
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#e5c88b] shrink-0" />
            <span>Guía</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-[#e5c88b]' : 'text-zinc-500'
              }`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-2.5 p-4 sm:p-5 rounded-2xl bg-[#0b0e16]/85 backdrop-blur-md border border-white/10 space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0 text-xs">
              <span className="font-mono text-[#e5c88b] font-semibold shrink-0">
                {badge}
              </span>
              <span className="text-zinc-600" aria-hidden="true">·</span>
              <span className="text-zinc-300 font-medium truncate">
                {subtitle}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 hover:text-white border border-white/10 cursor-pointer transition-colors"
              title="Cerrar Guía"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {steps.map((st, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-[#07090f]/80 border border-white/10 space-y-1"
              >
                <div className="text-[11px] font-mono text-[#e5c88b]">
                  0{i + 1}
                </div>
                <h4 className="text-xs font-semibold text-white">
                  {st.title}
                </h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {st.description}
                </p>
              </div>
            ))}
          </div>

          {proTip && (
            <div className="pt-2 border-t border-white/10 flex items-start gap-2.5 text-xs text-zinc-300">
              <Lightbulb className="w-4 h-4 text-[#e5c88b] shrink-0 mt-0.5" />
              <div className="leading-relaxed text-xs">
                <strong className="text-[#e5c88b] font-semibold mr-1.5">
                  Sugerencia:
                </strong>
                <span>{proTip}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
