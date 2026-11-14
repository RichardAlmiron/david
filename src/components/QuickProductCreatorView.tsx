import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Link as LinkIcon,
  Loader2,
  RotateCcw,
  Upload
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';
import type { ProductPage } from '../types';
import { LuminousOrbsBackdrop } from './LuminousOrbsBackdrop';
import {
  buildCloneDraftFromProductPage,
  isProductCloneable,
  type QuickCreatorCloneContext
} from '../utils/quickCreatorCloner';

interface QuickProductCreatorViewProps {
  defaultWaNumber: string;
  showToast: (msg: string) => void;
  onProductCreated: (product: ProductPage, openStorePreview?: boolean) => Promise<void>;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

export const QuickProductCreatorView: React.FC<QuickProductCreatorViewProps> = ({
  defaultWaNumber,
  showToast,
  onProductCreated
}) => {
  const { adminToken, productPages } = useStore();

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) h['Authorization'] = `Bearer ${adminToken}`;
    return h;
  }, [adminToken]);

  const cloneablePages = useMemo(
    () => (Array.isArray(productPages) ? productPages : []).filter(isProductCloneable),
    [productPages]
  );

  // Guided 3-step Wizard State
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [pageCreationMode, setPageCreationMode] = useState<'dual_tripwire_winner' | 'principal_only'>(
    'dual_tripwire_winner'
  );

  // Clone State
  const [clonedFrom, setClonedFrom] = useState<QuickCreatorCloneContext | null>(null);
  const [cloneFilterQuery, setCloneFilterQuery] = useState('');
  const [differentiationNote, setDifferentiationNote] = useState('');

  // BLOQUE TRIPWIRE (SOLO MODO DUAL)
  const [entrySourceUrl, setEntrySourceUrl] = useState('');
  const [analyzingUrl, setAnalyzingUrl] = useState(false);
  const [entryProductName, setEntryProductName] = useState('');
  const [entryProductDescription, setEntryProductDescription] = useState('');
  const [entryPriceGs, setEntryPriceGs] = useState<number>(20000);
  const [entryNormalPriceGs, setEntryNormalPriceGs] = useState<number>(45000);
  const [entryDeliveryFeeGs, setEntryDeliveryFeeGs] = useState<number>(40000);
  const [entryProductImageInput, setEntryProductImageInput] = useState('');
  const [instantDiscountPercent, setInstantDiscountPercent] = useState<number>(12);
  const [eventDurationHours, setEventDurationHours] = useState<number>(6);
  const [slotsTotal, setSlotsTotal] = useState<number>(10);
  const [backgroundMusicPreset, setBackgroundMusicPreset] = useState<
    'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none'
  >('warm_ambient');

  // BLOQUE PRODUCTO GANADOR / PRINCIPAL
  const [productName, setProductName] = useState('');
  const [winnerAngle, setWinnerAngle] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [normalPriceGs, setNormalPriceGs] = useState<number>(249000);
  const [price1Gs, setPrice1Gs] = useState<number>(189000);
  const [price2Gs, setPrice2Gs] = useState<number>(358000);
  const [price3Gs, setPrice3Gs] = useState<number>(507000);
  const [productImageInput, setProductImageInput] = useState('');
  const [waNumber, setWaNumber] = useState(defaultWaNumber || '595973532550');

  // ESTRUCTURA LÁMINAS GPT-2.6
  const [sheetCount, setSheetCount] = useState<2 | 3>(2);
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    product: ProductPage;
    strategySummary: string;
  } | null>(null);

  const filteredClonePages = useMemo(() => {
    const q = cloneFilterQuery.trim().toLowerCase();
    if (!q) return cloneablePages;
    return cloneablePages.filter(
      p =>
        String(p.nombre || '').toLowerCase().includes(q) ||
        String(p.slug || '').toLowerCase().includes(q) ||
        String(p.tripwireConfig?.entryProductName || '').toLowerCase().includes(q)
    );
  }, [cloneablePages, cloneFilterQuery]);

  const handleSelectCloneSource = (source: ProductPage) => {
    const cloned = buildCloneDraftFromProductPage(source);
    setClonedFrom(cloned.clonedFromContext);
    setProductName(cloned.productName);
    setWinnerAngle(cloned.winnerAngle);
    setProductDescription(cloned.productDescription);
    setNormalPriceGs(cloned.normalPriceGs);
    setPrice1Gs(cloned.price1Gs);
    setPrice2Gs(cloned.price2Gs);
    setPrice3Gs(cloned.price3Gs);
    setProductImageInput(cloned.productImageInput);
    setWaNumber(cloned.waNumber || defaultWaNumber || '595973532550');

    setEntrySourceUrl(cloned.entrySourceUrl);
    setEntryProductName(cloned.entryProductName);
    setEntryProductDescription(cloned.entryProductDescription);
    setEntryPriceGs(cloned.entryPriceGs);
    setEntryNormalPriceGs(cloned.entryNormalPriceGs);
    setEntryDeliveryFeeGs(cloned.entryDeliveryFeeGs);
    setEntryProductImageInput(cloned.entryProductImageInput);
    setInstantDiscountPercent(cloned.instantDiscountPercent);
    setEventDurationHours(cloned.eventDurationHours);
    setSlotsTotal(cloned.slotsTotal);
    setBackgroundMusicPreset(cloned.backgroundMusicPreset);

    if (pageCreationMode === 'dual_tripwire_winner' && cloned.suggestedMode === 'principal_only') {
      // Keep user mode or hint smoothly
      showToast(`Información de "${source.nombre}" cargada. Completá el producto Tripwire o cambiá a Producto Ganador Único.`);
    } else {
      showToast(`Datos copiados desde "${source.nombre}". El agente generará un ángulo visual nuevo con GPT-2.6.`);
    }
  };

  const handleClearClone = () => {
    setClonedFrom(null);
    setDifferentiationNote('');
    showToast('Referencia clonada liberada. Estás creando desde cero.');
  };

  const handleResetAll = () => {
    setCreatedResult(null);
    setClonedFrom(null);
    setDifferentiationNote('');
    setEntrySourceUrl('');
    setEntryProductName('');
    setEntryProductDescription('');
    setEntryProductImageInput('');
    setProductName('');
    setWinnerAngle('');
    setProductDescription('');
    setProductImageInput('');
    setWizardStep(1);
  };

  const handleUploadPrincipalImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await readFileAsDataUrl(f);
      setProductImageInput(dataUrl);
    } catch (err: any) {
      showToast(err?.message || 'Error leyendo foto del Producto Ganador.');
    }
  };

  const handleUploadEntryImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await readFileAsDataUrl(f);
      setEntryProductImageInput(dataUrl);
    } catch (err: any) {
      showToast(err?.message || 'Error leyendo foto del Producto Tripwire.');
    }
  };

  const handleAnalyzeHookUrl = async () => {
    if (!entrySourceUrl.trim()) {
      showToast('Pegá primero la URL del artículo de entrada.');
      return;
    }
    setAnalyzingUrl(true);
    try {
      const res = await fetch('/api/products/analyze-hook-url', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ url: entrySourceUrl.trim() })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        showToast(data?.error || 'No se pudo extraer info de esa URL.');
        return;
      }
      if (data.title && !entryProductName.trim()) setEntryProductName(data.title);
      if (data.description) setEntryProductDescription(data.description);
      if (data.imageUrl && !entryProductImageInput) setEntryProductImageInput(data.imageUrl);
      showToast('Datos e imagen cargados en el artículo de entrada.');
    } catch (err: any) {
      showToast(err?.message || 'Error analizando URL.');
    } finally {
      setAnalyzingUrl(false);
    }
  };

  const validateStep2AndAdvance = () => {
    if (pageCreationMode === 'dual_tripwire_winner' && !entryProductName.trim()) {
      showToast('Completá el nombre del producto de entrada (Tripwire).');
      return;
    }
    if (!productName.trim() || !productDescription.trim()) {
      showToast('Completá el nombre y descripción de tu Producto Ganador.');
      return;
    }
    setWizardStep(3);
  };

  const handleCreateVisualProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pageCreationMode === 'dual_tripwire_winner' && !entryProductName.trim()) {
      setWizardStep(2);
      showToast('Completá el nombre del producto para tu página Tripwire.');
      return;
    }
    if (!productName.trim() || !productDescription.trim()) {
      setWizardStep(2);
      showToast('Completá el nombre y descripción de tu Producto Ganador.');
      return;
    }

    setCreating(true);
    try {
      const payload: Record<string, any> = {
        pageCreationMode,
        productName: productName.trim(),
        winnerAngle: winnerAngle.trim() || undefined,
        productDescription: productDescription.trim(),
        normalPriceGs,
        price1Gs,
        price2Gs,
        price3Gs,
        productImageInput: productImageInput.trim(),
        backgroundMusicPreset,
        sheetCount,
        waNumber: waNumber.trim(),
        clonedFromContext: clonedFrom
          ? {
              ...clonedFrom,
              differentiationNote: differentiationNote.trim() || undefined
            }
          : undefined
      };
      if (pageCreationMode === 'dual_tripwire_winner') {
        payload.entryProductName = entryProductName.trim();
        payload.entryProductDescription = entryProductDescription.trim() || entryProductName.trim();
        payload.entryPriceGs = entryPriceGs;
        payload.entryNormalPriceGs = entryNormalPriceGs;
        payload.entryDeliveryFeeGs = entryDeliveryFeeGs;
        payload.entryProductImageInput = entryProductImageInput.trim();
        payload.entrySourceUrl = entrySourceUrl.trim() || undefined;
        payload.instantDiscountPercent = instantDiscountPercent;
        payload.eventDurationHours = eventDurationHours;
        payload.slotsTotal = slotsTotal;
      }

      const res = await fetch('/api/products/quick-create-visual', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.product) {
        showToast(data?.error || 'Error generando el producto visual.');
        return;
      }
      await onProductCreated(data.product, false);
      setCreatedResult({
        product: data.product,
        strategySummary: String(data.strategySummary || '')
      });
      showToast(
        pageCreationMode === 'principal_only'
          ? `Página de Producto Ganador creada: "${data.product.nombre}".`
          : `Página Tripwire + Ganador creada: "${data.product.nombre}".`
      );
    } catch (err: any) {
      showToast(err?.message || 'Error creando producto.');
    } finally {
      setCreating(false);
    }
  };

  const stepsMeta = [
    { id: 1 as const, label: '01. Estructura y Clonaje' },
    { id: 2 as const, label: '02. Producto y Precios' },
    { id: 3 as const, label: '03. Diseño GPT-2.6' }
  ];

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl bg-[#07090f]/90 border border-white/10 focus:border-[#e5c88b]/70 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors';
  const monoInputClass =
    'w-full px-3 py-2.5 rounded-xl bg-[#07090f]/90 border border-white/10 focus:border-[#e5c88b]/70 text-sm text-zinc-100 font-mono tabular-nums outline-none transition-colors';

  return (
    <div
      data-testid="quick-product-creator-view"
      className="relative max-w-6xl mx-auto rounded-2xl bg-[#06080d] border border-white/10 overflow-hidden"
    >
      {/* Fondo 3D con Orbes Flotantes Luminosos */}
      <LuminousOrbsBackdrop />

      {/* Contenedor Principal Smoked Glass */}
      <div className="relative z-10 p-5 sm:p-8 lg:p-10 space-y-8">
        {/* Cabecera Editorial Limpia + Rail del Wizard */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-white/10 pb-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="text-xs font-mono tracking-wider text-[#e5c88b] uppercase">
              Estudio de Creación Visual · GPT-2.6
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
              Creador Guiado de Páginas de Producto
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Elegí el tipo de página, cloná el conocimiento de un producto existente si querés lanzar otro ángulo y generá láminas full-bleed listas para vender.
            </p>
          </div>

          {/* Stepper Horizontal Sobrio */}
          <nav
            aria-label="Pasos de creación"
            className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/10 shrink-0"
          >
            {stepsMeta.map((s) => {
              const isActive = wizardStep === s.id;
              const isCompleted = wizardStep > s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`wizard-step-tab-${s.id}`}
                  onClick={() => {
                    if (s.id === 3 && (!productName.trim() || !productDescription.trim())) {
                      setWizardStep(2);
                      return;
                    }
                    setWizardStep(s.id);
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#e5c88b] text-[#090b10] font-bold'
                      : isCompleted
                        ? 'text-zinc-200 hover:bg-white/[0.06]'
                        : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {isCompleted && <Check className="w-3.5 h-3.5 text-[#e5c88b]" />}
                  <span>{s.label}</span>
                </button>
              );
            })}
          </nav>
        </header>

        <form onSubmit={handleCreateVisualProduct} className="space-y-8">
          {/* ============================================================== */}
          {/* PASO 1: TIPO DE PÁGINA + ALGORITMO DE CLONAJE 1-CLIC           */}
          {/* ============================================================== */}
          {wizardStep === 1 && (
            <div className="space-y-8">
              {/* 1A. Selección de Tipo de Página */}
              <section className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold text-white">
                    1. ¿Qué arquitectura de página vas a crear hoy?
                  </h3>
                  <span className="text-xs text-zinc-500">
                    Definí si incluís oferta de entrada o un único producto directo
                  </span>
                </div>

                <div
                  data-testid="quick-creator-mode-switcher"
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch"
                >
                  <button
                    type="button"
                    data-testid="quick-creator-mode-dual"
                    onClick={() => setPageCreationMode('dual_tripwire_winner')}
                    className={`text-left p-6 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      pageCreationMode === 'dual_tripwire_winner'
                        ? 'bg-white/[0.08] border-[#e5c88b]/70'
                        : 'bg-[#0b0e16]/75 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white">
                          Página Tripwire + Producto Ganador
                        </span>
                        <span
                          className={`text-[11px] font-mono ${
                            pageCreationMode === 'dual_tripwire_winner'
                              ? 'text-[#e5c88b]'
                              : 'text-zinc-500'
                          }`}
                        >
                          {pageCreationMode === 'dual_tripwire_winner' ? 'Seleccionado' : 'Dual'}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                        Creás tu oferta de entrada accesible (Tripwire) y en la misma página presentás el Producto Ganador con un ángulo superior. Si lleva el Producto Ganador, obtiene el artículo de entrada de regalo con Envío Gratis.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    data-testid="quick-creator-mode-principal"
                    onClick={() => setPageCreationMode('principal_only')}
                    className={`text-left p-6 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      pageCreationMode === 'principal_only'
                        ? 'bg-white/[0.08] border-[#e5c88b]/70'
                        : 'bg-[#0b0e16]/75 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white">
                          Producto Ganador Único
                        </span>
                        <span
                          className={`text-[11px] font-mono ${
                            pageCreationMode === 'principal_only'
                              ? 'text-[#e5c88b]'
                              : 'text-zinc-500'
                          }`}
                        >
                          {pageCreationMode === 'principal_only' ? 'Seleccionado' : 'Directo'}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                        Página simple, clara y directa enfocada 100% en un único Producto Ganador (sin segundo producto ni bloques secundarios). Ideal para campañas estándar.
                      </p>
                    </div>
                  </button>
                </div>
              </section>

              {/* Divider */}
              <div className="border-t border-white/10" />

              {/* 1B. Algoritmo de Clonaje Inteligente */}
              <section data-testid="quick-creator-clone-panel" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      <Copy className="w-4 h-4 text-[#e5c88b]" />
                      <span>Clonar información de una página existente (opcional)</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-400">
                      Elegí cualquier página Tripwire o Estándar del catálogo para copiar su ficha técnica al agente y crear una nueva página con otro ángulo e imágenes GPT-2.6 inéditas.
                    </p>
                  </div>

                  {clonedFrom && (
                    <button
                      type="button"
                      data-testid="quick-creator-clear-clone-btn"
                      onClick={handleClearClone}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-zinc-300 inline-flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-center"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Quitar clon</span>
                    </button>
                  )}
                </div>

                {clonedFrom && (
                  <div className="p-4 rounded-xl bg-white/[0.05] border border-[#e5c88b]/40 text-xs sm:text-sm text-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[#e5c88b] font-semibold">Conocimiento heredado:</span>{' '}
                      <strong>{clonedFrom.sourceProductName}</strong>{' '}
                      <span className="text-zinc-400">
                        (/?p={clonedFrom.sourceSlug}) — Listo para generar nuevo ángulo y láminas distintas.
                      </span>
                    </div>
                  </div>
                )}

                {cloneablePages.length > 0 ? (
                  <div className="space-y-3">
                    {cloneablePages.length > 4 && (
                      <input
                        type="text"
                        value={cloneFilterQuery}
                        onChange={(e) => setCloneFilterQuery(e.target.value)}
                        placeholder="Buscar página existente por nombre o slug..."
                        className={inputClass}
                      />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredClonePages.map((p) => {
                        const isSelectedClone = clonedFrom?.sourceProductId === p.id;
                        const hasTw = Boolean(p.tripwireConfig?.enabled && p.tripwireConfig?.entryProductName);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            data-testid={`clone-source-${p.id}`}
                            onClick={() => handleSelectCloneSource(p)}
                            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                              isSelectedClone
                                ? 'bg-white/[0.09] border-[#e5c88b]'
                                : 'bg-[#0b0e16]/70 border-white/10 hover:border-white/25'
                            }`}
                          >
                            {p.imagen ? (
                              <img
                                src={p.imagen}
                                alt={p.nombre}
                                referrerPolicy="no-referrer"
                                className="w-11 h-11 rounded-lg object-cover border border-white/10 shrink-0"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
                                <Layers className="w-4 h-4 text-zinc-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="text-xs font-semibold text-white truncate">
                                {p.nombre}
                              </div>
                              <div className="text-[11px] text-zinc-400 truncate">
                                {hasTw ? `Tripwire: ${p.tripwireConfig?.entryProductName}` : 'Producto Ganador'}
                                {' · '}
                                <span className="font-mono tabular-nums">
                                  {formatGs(Number(p.precios?.[1] || p.precioNormal || 0))}
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-zinc-500 truncate">
                                /?p={p.slug}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Todavía no tenés otras páginas guardadas para clonar. Completá los datos desde cero en el siguiente paso.
                  </p>
                )}
              </section>

              <div className="flex items-center justify-end pt-2 border-t border-white/10">
                <button
                  type="button"
                  data-testid="wizard-next-step-1"
                  onClick={() => setWizardStep(2)}
                  className="px-6 py-3 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] font-bold text-sm inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span>Continuar a Producto y Precios</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 2: DEFINICIÓN DE PRODUCTO(S) Y PRECIOS                    */}
          {/* ============================================================== */}
          {wizardStep === 2 && (
            <div className="space-y-6">
              <div
                className={`grid grid-cols-1 ${
                  pageCreationMode === 'dual_tripwire_winner' ? 'lg:grid-cols-2 lg:gap-8' : ''
                } gap-6 items-start`}
              >
                {/* COLUMNA TRIPWIRE (SOLO MODO DUAL) */}
                {pageCreationMode === 'dual_tripwire_winner' && (
                  <section
                    data-testid="quick-creator-tripwire-block"
                    className="p-5 sm:p-6 rounded-xl bg-[#0b0e16]/80 border border-white/10 space-y-4"
                  >
                    <div className="border-b border-white/10 pb-3 space-y-1">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-[#e5c88b]">
                        Oferta de Entrada · Tripwire
                      </div>
                      <h3 className="text-base font-bold text-white">
                        Producto Gancho Accesible
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Artículo accesible que atrae el clic y aparece como Opción 1 antes del Producto Ganador.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-300 block">
                        Importar desde URL (opcional)
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <LinkIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="url"
                            placeholder="https://proveedor.com/producto"
                            value={entrySourceUrl}
                            onChange={(e) => setEntrySourceUrl(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#07090f]/90 border border-white/10 text-xs text-white outline-none focus:border-[#e5c88b]/70"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAnalyzeHookUrl}
                          disabled={analyzingUrl}
                          className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-zinc-200 cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          {analyzingUrl ? 'Leyendo...' : 'Analizar URL'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-300 block">
                        Nombre del artículo de entrada
                      </label>
                      <input
                        type="text"
                        data-testid="quick-creator-entry-name"
                        placeholder="Ej: Guirnalda Solar LED Navideña 10 Metros"
                        value={entryProductName}
                        onChange={(e) => setEntryProductName(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-300 block">
                        Descripción clara del artículo (medidas, qué incluye)
                      </label>
                      <textarea
                        data-testid="quick-creator-entry-desc"
                        rows={3}
                        placeholder="Ej: Tira LED luz cálida de 10 metros para marco de puerta o balcón, enchufe directo."
                        value={entryProductDescription}
                        onChange={(e) => setEntryProductDescription(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-[#e5c88b] font-medium block">Precio (Gs.)</label>
                        <input
                          type="number"
                          min={5000}
                          step={1000}
                          value={entryPriceGs}
                          onChange={(e) => setEntryPriceGs(Number(e.target.value) || 0)}
                          className={monoInputClass}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400 block">Normal</label>
                        <input
                          type="number"
                          min={10000}
                          step={1000}
                          value={entryNormalPriceGs}
                          onChange={(e) => setEntryNormalPriceGs(Number(e.target.value) || 45000)}
                          className={monoInputClass}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400 block">Delivery</label>
                        <input
                          type="number"
                          min={10000}
                          step={5000}
                          value={entryDeliveryFeeGs}
                          onChange={(e) => setEntryDeliveryFeeGs(Number(e.target.value) || 40000)}
                          className={monoInputClass}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400 block">Desc. (%)</label>
                        <input
                          type="number"
                          min={5}
                          max={40}
                          value={instantDiscountPercent}
                          onChange={(e) => setInstantDiscountPercent(Number(e.target.value) || 12)}
                          className={monoInputClass}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-300 block">
                          Imagen de referencia
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="https://... o subí foto"
                            value={
                              entryProductImageInput.startsWith('data:')
                                ? 'Imagen cargada'
                                : entryProductImageInput
                            }
                            onChange={(e) => setEntryProductImageInput(e.target.value)}
                            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#07090f]/90 border border-white/10 text-xs text-white outline-none"
                          />
                          <label className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs text-zinc-200 cursor-pointer shrink-0 inline-flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Subir</span>
                            <input type="file" accept="image/*" onChange={handleUploadEntryImg} className="hidden" />
                          </label>
                        </div>
                        {entryProductImageInput && (
                          <div className="flex items-center gap-2 pt-1">
                            <img
                              src={entryProductImageInput}
                              alt="Vista previa artículo de entrada"
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-lg object-cover border border-white/15"
                            />
                            <span className="text-[11px] text-zinc-400">Imagen lista</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-300 block">
                          Cupos / Horas evento WhatsApp
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={5}
                            max={20}
                            value={slotsTotal}
                            onChange={(e) => setSlotsTotal(Number(e.target.value) || 10)}
                            title="Cupos de lista exclusiva"
                            className={monoInputClass}
                          />
                          <input
                            type="number"
                            min={2}
                            max={12}
                            value={eventDurationHours}
                            onChange={(e) => setEventDurationHours(Number(e.target.value) || 6)}
                            title="Horas totales del evento"
                            className={monoInputClass}
                          />
                        </div>
                        <span className="text-[11px] text-zinc-500 font-mono tabular-nums block">
                          {slotsTotal} cupos · {eventDurationHours}h · 2 intentos máx
                        </span>
                      </div>
                    </div>
                  </section>
                )}

                {/* COLUMNA PRODUCTO GANADOR / PRINCIPAL */}
                <section
                  data-testid="quick-creator-winner-block"
                  className="p-5 sm:p-6 rounded-xl bg-[#0b0e16]/80 border border-white/10 space-y-4"
                >
                  <div className="border-b border-white/10 pb-3 space-y-1">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      {pageCreationMode === 'principal_only'
                        ? 'Producto Ganador Único'
                        : 'Producto Ganador · En la misma página'}
                    </div>
                    <h3 className="text-base font-bold text-white">
                      {pageCreationMode === 'principal_only'
                        ? 'Información del Producto Principal'
                        : 'Oferta Completa (Incluye Tripwire de Regalo)'}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {pageCreationMode === 'principal_only'
                        ? 'Landing limpia enfocada únicamente en este producto con Envío Gratis y pago al recibir.'
                        : 'Si el cliente adquiere este Producto Ganador, recibe el artículo de entrada gratis con Envío Gratis.'}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300 block">
                      Nombre del Producto Ganador
                    </label>
                    <input
                      type="text"
                      data-testid="quick-creator-main-name"
                      placeholder="Ej: Proyector Navideño Láser HD 12 Diseños"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300 block">
                      {clonedFrom
                        ? 'Ángulo diferente para esta nueva página'
                        : 'Ángulo principal de venta'}
                    </label>
                    <input
                      type="text"
                      data-testid="quick-creator-winner-angle"
                      placeholder="Ej: Iluminá toda la fachada en 90 segundos sin escaleras ni cables"
                      value={winnerAngle}
                      onChange={(e) => setWinnerAngle(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300 block">
                      Descripción técnica y qué incluye la caja
                    </label>
                    <textarea
                      data-testid="quick-creator-main-desc"
                      rows={3}
                      placeholder="Cobertura amplia, enchufe directo 220V, materiales resistentes y pago al recibir en Paraguay."
                      value={productDescription}
                      onChange={(e) => setProductDescription(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400 block">Normal</label>
                      <input
                        type="number"
                        min={40000}
                        step={1000}
                        value={normalPriceGs}
                        onChange={(e) => setNormalPriceGs(Number(e.target.value) || 249000)}
                        className={monoInputClass}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[#e5c88b] font-medium block">Precio 1x</label>
                      <input
                        type="number"
                        min={35000}
                        step={1000}
                        value={price1Gs}
                        onChange={(e) => setPrice1Gs(Number(e.target.value) || 0)}
                        className={monoInputClass}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400 block">Pack 2x</label>
                      <input
                        type="number"
                        min={50000}
                        step={1000}
                        value={price2Gs}
                        onChange={(e) => setPrice2Gs(Number(e.target.value) || 0)}
                        className={monoInputClass}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400 block">Pack 3x</label>
                      <input
                        type="number"
                        min={70000}
                        step={1000}
                        value={price3Gs}
                        onChange={(e) => setPrice3Gs(Number(e.target.value) || 0)}
                        className={monoInputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-300 block">
                        Imagen del Producto Ganador
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="https://... o subí foto"
                          value={productImageInput.startsWith('data:') ? 'Imagen cargada' : productImageInput}
                          onChange={(e) => setProductImageInput(e.target.value)}
                          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#07090f]/90 border border-white/10 text-xs text-white outline-none"
                        />
                        <label className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs text-zinc-200 cursor-pointer shrink-0 inline-flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Subir</span>
                          <input type="file" accept="image/*" onChange={handleUploadPrincipalImg} className="hidden" />
                        </label>
                      </div>
                      {productImageInput && (
                        <div className="flex items-center gap-2 pt-1">
                          <img
                            src={productImageInput}
                            alt="Vista previa Producto Ganador"
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-lg object-cover border border-white/15"
                          />
                          <span className="text-[11px] text-zinc-400">Imagen lista</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-300 block">WhatsApp del producto</label>
                      <input
                        type="text"
                        value={waNumber}
                        onChange={(e) => setWaNumber(e.target.value)}
                        className={monoInputClass}
                      />
                      <span className="text-[11px] text-zinc-500 block">
                        Envío Gratis incluido en Producto Ganador
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Paso anterior</span>
                </button>
                <button
                  type="button"
                  data-testid="wizard-next-step-2"
                  onClick={validateStep2AndAdvance}
                  className="px-6 py-3 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] font-bold text-sm inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span>Continuar al Paso 3</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 3: DIRECCIÓN GRÁFICA GPT-2.6 Y GENERACIÓN                 */}
          {/* ============================================================== */}
          {wizardStep === 3 && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-[#0b0e16]/80 border border-white/10 space-y-6">
                {/* Resumen sin barullo */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-[#e5c88b]">
                      Resumen de arquitectura
                    </div>
                    <div className="text-lg font-bold text-white">
                      {productName || 'Producto sin nombre'}
                    </div>
                    <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-2">
                      <span>
                        {pageCreationMode === 'principal_only'
                          ? 'Producto Ganador Único'
                          : `Tripwire (${entryProductName || 'Entrada'}) + Producto Ganador`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">1x {formatGs(price1Gs)}</span>
                      {clonedFrom && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Clonado desde {clonedFrom.sourceProductName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dirección visual para diferenciación del clon (si aplica) */}
                {clonedFrom && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300 block">
                      ¿Qué nuevo estilo visual o ángulo distinto querés que cree GPT-2.6 sobre esta base? (opcional)
                    </label>
                    <input
                      type="text"
                      data-testid="quick-creator-clone-angle-note"
                      placeholder="Ej: Enfoque nocturno minimalista destacando ahorro de tiempo para familias ocupadas"
                      value={differentiationNote}
                      onChange={(e) => setDifferentiationNote(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Cantidad de Láminas GPT-2.6 */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-medium text-zinc-300 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-[#e5c88b]" />
                      <span>Láminas verticales full-bleed (GPT-2.6)</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSheetCount(2)}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition-colors ${
                          sheetCount === 2
                            ? 'bg-white/[0.08] border-[#e5c88b] text-white'
                            : 'bg-[#07090f]/80 border-white/10 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="text-xs font-bold">2 Láminas (3:4)</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          Presentación + Comparativa
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSheetCount(3)}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition-colors ${
                          sheetCount === 3
                            ? 'bg-white/[0.08] border-[#e5c88b] text-white'
                            : 'bg-[#07090f]/80 border-white/10 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="text-xs font-bold">3 Láminas (3:4)</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          + Garantía y Contenido
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Audio BGM (para seguimiento WhatsApp si es Dual) */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-medium text-zinc-300 block">
                      Ambientación sonora para notas de voz WhatsApp
                    </label>
                    <select
                      value={backgroundMusicPreset}
                      onChange={(e) => setBackgroundMusicPreset(e.target.value as any)}
                      className="w-full px-3.5 py-3 rounded-xl bg-[#07090f]/90 border border-white/10 text-xs text-white outline-none focus:border-[#e5c88b]/70 cursor-pointer"
                    >
                      <option value="warm_ambient">Acústica Cálida (Recomendada)</option>
                      <option value="soft_lounge">Lounge Suave Elegante</option>
                      <option value="commercial_pulse">Pulso Dinámico Sutil</option>
                      <option value="none">Solo Voz (Sin música)</option>
                    </select>
                    <p className="text-[11px] text-zinc-500">
                      La landing pública mostrará exclusivamente las láminas GPT-2.6 de lado a lado y el formulario directo abierto.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  disabled={creating}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Editar datos</span>
                </button>

                <button
                  type="submit"
                  data-testid="quick-creator-submit-btn"
                  disabled={creating}
                  className="px-7 py-3.5 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generando diseño de alto impacto con GPT-2.6...</span>
                    </>
                  ) : (
                    <span>
                      {pageCreationMode === 'principal_only'
                        ? 'Generar Página Producto Ganador (GPT-2.6)'
                        : 'Generar Página Tripwire + Ganador (GPT-2.6)'}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>

        {/* PREVIEW DEL PRODUCTO CREADO */}
        {createdResult && (
          <section
            data-testid="quick-creator-result-preview"
            className="rounded-xl bg-[#0b0e16]/90 border border-[#e5c88b]/40 p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[#e5c88b] text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Página Visual Generada y Conectada al Catálogo</span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  {createdResult.product.nombre} ·{' '}
                  <span className="font-mono text-sm text-zinc-400">/?p={createdResult.product.slug}</span>
                </h3>
                {createdResult.strategySummary && (
                  <p className="text-xs text-zinc-400">{createdResult.strategySummary}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-zinc-200 cursor-pointer"
                >
                  Crear Otra
                </button>
                <button
                  type="button"
                  onClick={() => onProductCreated(createdResult.product, false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Ver en Páginas Creadas</span>
                </button>
                <a
                  href={`/?p=${createdResult.product.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <span>Abrir Página Pública</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {createdResult.product.visualLanding?.sheets.map((sh) => (
                <div key={sh.id} className="rounded-xl bg-[#07090f] border border-white/10 overflow-hidden">
                  <img
                    src={sh.imageUrl}
                    alt={sh.title}
                    referrerPolicy="no-referrer"
                    className="w-full aspect-[3/4] object-cover"
                  />
                  <div className="p-3 space-y-0.5">
                    <div className="text-xs font-semibold text-white">{sh.title}</div>
                    {sh.caption && <div className="text-[11px] text-zinc-400">{sh.caption}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
