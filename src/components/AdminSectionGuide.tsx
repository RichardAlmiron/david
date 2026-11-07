import React, { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  Sparkles,
  Lightbulb,
  CheckCircle2,
  Info
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
}

export const AdminSectionGuide: React.FC<AdminSectionGuideProps> = ({
  id,
  title,
  subtitle,
  badge = 'Guía Rápida & Explicación',
  steps,
  proTip,
  defaultExpanded = true
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`admin_guide_${id}`);
      return saved !== null ? saved === 'true' : defaultExpanded;
    } catch {
      return defaultExpanded;
    }
  });

  const toggleOpen = () => {
    setIsOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem(`admin_guide_${id}`, String(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="w-full rounded-2xl bg-[#0d0d0f] border border-zinc-800/90 shadow-sm overflow-hidden transition-all text-zinc-100">
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-3 text-left hover:bg-zinc-900/60 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700/80 text-emerald-400 flex items-center justify-center shrink-0">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                {badge}
              </span>
              <h3 className="text-xs sm:text-sm font-bold text-zinc-100 truncate">
                {title}
              </h3>
            </div>
            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-xs text-zinc-400">
          <span className="hidden sm:inline text-[11px] font-medium">
            {isOpen ? 'Ocultar Guía' : 'Ver Guía e Indicaciones'}
          </span>
          <div className="w-7 h-7 rounded-lg bg-zinc-800/80 border border-zinc-700 flex items-center justify-center">
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-white' : 'text-zinc-400'
              }`}
            />
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="p-3.5 sm:p-5 pt-0 border-t border-zinc-800/80 space-y-3.5 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-3">
            {steps.map((st, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/90 flex flex-col justify-between gap-1.5 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span className="text-base shrink-0 mt-0.5">
                    {st.icon || '📌'}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200">
                      {st.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
                      {st.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {proTip && (
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-start gap-2.5 text-xs text-emerald-200">
              <Lightbulb className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-emerald-300 font-bold block mb-0.5">
                  💡 Consejo Pro para Vender Más:
                </strong>
                <span className="text-zinc-300 text-[11px]">{proTip}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
