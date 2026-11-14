import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  Edit3,
  ExternalLink,
  Layers,
  Link as LinkIcon,
  Loader2,
  Lock,
  PackageCheck,
  PlusCircle,
  Rocket,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Upload,
  Wand2
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

interface AiAngleOption {
  id: string;
  title: string;
  archetype: string;
  winnerAngle: string;
  visualDirection: string;
  recommendedSheetCount: 2 | 3;
  recommendedAudioPreset: 'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none';
  whyItConverts: string;
  tripwireBridgeNote?: string;
}

interface AiStrategyState {
  currentPageDiagnosis: string;
  assistantReply: string;
  recommendedSheetCount: 2 | 3;
  recommendedAudioPreset: 'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none';
  options: AiAngleOption[];
  recommendedOptionId: string;
}

interface AiChatEntry {
  role: 'user' | 'assistant';
  content: string;
}

const AUDIO_LABELS: Record<string, string> = {
  warm_ambient: 'Acústica Cálida',
  soft_lounge: 'Lounge Suave',
  commercial_pulse: 'Pulso Dinámico',
  none: 'Solo Voz'
};

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

  // Ordenar productos estándar primero cuando se va a elegir Producto Principal para un Tripwire
  const orderedPagesForTripwire = useMemo(() => {
    return [...cloneablePages].sort((a, b) => {
      const aIsTw = Boolean(a.tripwireConfig?.enabled && a.tripwireConfig?.entryProductName);
      const bIsTw = Boolean(b.tripwireConfig?.enabled && b.tripwireConfig?.entryProductName);
      if (aIsTw === bIsTw) return 0;
      return aIsTw ? 1 : -1;
    });
  }, [cloneablePages]);

  // 4-step Mode-Pure Wizard:
  // 1 = Tipo (Estándar vs Tripwire)
  // 2 = Origen / Producto Base
  //     - Estándar: Nuevo desde cero | Clonar página existente (al elegir clon -> salta directo a Paso 4!)
  //     - Tripwire: Elegir Página de Producto Estándar ya hecha para introducirla | Cargar principal nuevo
  // 3 = Carga / Edición de Datos
  //     - Estándar: SOLO Producto Principal (cero mención ni campos de Tripwire)
  //     - Tripwire: Oferta de Gancho (Tripwire) + Oferta Principal vinculada
  // 4 = Estudio IA Orbital + Ángulo + Lanzamiento (con botones Editar vs Lanzar)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [pageCreationMode, setPageCreationMode] = useState<'dual_tripwire_winner' | 'principal_only' | null>(
    null
  );
  const [startOrigin, setStartOrigin] = useState<'fresh' | 'clone' | null>(null);

  // Referencia clonada (Estándar) o Producto Principal Estándar importado (Tripwire)
  const [clonedFrom, setClonedFrom] = useState<QuickCreatorCloneContext | null>(null);
  const [cloneFilterQuery, setCloneFilterQuery] = useState('');
  const [differentiationNote, setDifferentiationNote] = useState('');

  // BLOQUE GANCHO / TRIPWIRE (EXCLUSIVO MODO TRIPWIRE)
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

  // BLOQUE PRODUCTO PRINCIPAL / ESTÁNDAR
  const [productName, setProductName] = useState('');
  const [winnerAngle, setWinnerAngle] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [normalPriceGs, setNormalPriceGs] = useState<number>(249000);
  const [price1Gs, setPrice1Gs] = useState<number>(189000);
  const [price2Gs, setPrice2Gs] = useState<number>(358000);
  const [price3Gs, setPrice3Gs] = useState<number>(507000);
  const [packsEditedManually, setPacksEditedManually] = useState(false);
  const [productImageInput, setProductImageInput] = useState('');
  const [waNumber, setWaNumber] = useState(defaultWaNumber || '595973532550');
  const [showPrincipalEditInTripwire, setShowPrincipalEditInTripwire] = useState(false);

  // ESTRATEGA IA ORBITAL (PASO 4)
  const [aiStrategy, setAiStrategy] = useState<AiStrategyState | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [studyStageIndex, setStudyStageIndex] = useState(0);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [aiChatHistory, setAiChatHistory] = useState<AiChatEntry[]>([]);
  const [showManualOverrides, setShowManualOverrides] = useState(false);
  const [sheetCount, setSheetCount] = useState<2 | 3>(2);
  const [manualOverrideUsed, setManualOverrideUsed] = useState(false);

  const lastAnalyzedSignatureRef = useRef<string>('');

  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    product: ProductPage;
    strategySummary: string;
  } | null>(null);

  const isStandardMode = pageCreationMode === 'principal_only';
  const isTripwireMode = pageCreationMode === 'dual_tripwire_winner';

  const displayedCatalogPages = useMemo(() => {
    const base = isTripwireMode ? orderedPagesForTripwire : cloneablePages;
    const q = cloneFilterQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) =>
        String(p.nombre || '').toLowerCase().includes(q) ||
        String(p.slug || '').toLowerCase().includes(q)
    );
  }, [isTripwireMode, orderedPagesForTripwire, cloneablePages, cloneFilterQuery]);

  // Validaciones por paso
  const isStep1Complete = Boolean(pageCreationMode);
  const isStep2Complete = useMemo(() => {
    if (!isStep1Complete || !startOrigin) return false;
    if (startOrigin === 'clone' && !clonedFrom) return false;
    return true;
  }, [isStep1Complete, startOrigin, clonedFrom]);

  const missingDataChecklist = useMemo(() => {
    const items: Array<{ label: string; ok: boolean }> = [];
    if (isTripwireMode) {
      items.push({
        label: 'Nombre de la Oferta de Gancho (Tripwire)',
        ok: Boolean(entryProductName.trim())
      });
      items.push({
        label: 'Precio del Gancho en Gs.',
        ok: entryPriceGs >= 5000
      });
    }
    items.push({
      label: isTripwireMode ? 'Nombre de la Oferta Principal' : 'Nombre del Producto Estándar',
      ok: Boolean(productName.trim())
    });
    items.push({
      label: 'Descripción clara de qué incluye',
      ok: Boolean(productDescription.trim())
    });
    items.push({
      label: 'Precio 1x en Guaraníes (mín. Gs. 35.000)',
      ok: price1Gs >= 35000
    });
    return items;
  }, [isTripwireMode, entryProductName, entryPriceGs, productName, productDescription, price1Gs]);

  const isReadyForLaunchStep = useMemo(
    () => Boolean(pageCreationMode) && missingDataChecklist.every((i) => i.ok),
    [pageCreationMode, missingDataChecklist]
  );

  // En Estándar, al clonar una página ya tenemos todos los datos del Producto Principal listos sin tocar Step 3
  const canFastTrackStandardClone = Boolean(
    isStandardMode &&
      startOrigin === 'clone' &&
      clonedFrom &&
      productName.trim() &&
      productDescription.trim() &&
      price1Gs >= 35000
  );

  const strategySignature = useMemo(
    () =>
      [
        pageCreationMode || 'none',
        clonedFrom?.sourceProductId || 'fresh',
        productName.trim(),
        productDescription.trim(),
        isTripwireMode ? entryProductName.trim() : '',
        String(price1Gs),
        String(price2Gs),
        String(price3Gs)
      ].join('::'),
    [
      pageCreationMode,
      clonedFrom?.sourceProductId,
      productName,
      productDescription,
      isTripwireMode,
      entryProductName,
      price1Gs,
      price2Gs,
      price3Gs
    ]
  );

  const selectedAiOption = useMemo(() => {
    if (!aiStrategy?.options?.length) return null;
    return aiStrategy.options.find((o) => o.id === selectedOptionId) || aiStrategy.options[0];
  }, [aiStrategy, selectedOptionId]);

  const effectiveSheetCount: 2 | 3 = manualOverrideUsed
    ? sheetCount
    : selectedAiOption?.recommendedSheetCount ||
      aiStrategy?.recommendedSheetCount ||
      (isStandardMode ? 2 : 3);

  const effectiveAudioPreset: 'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none' =
    manualOverrideUsed
      ? backgroundMusicPreset
      : selectedAiOption?.recommendedAudioPreset || aiStrategy?.recommendedAudioPreset || backgroundMusicPreset;

  // Animación orbital progresiva mientras estudia la IA
  useEffect(() => {
    if (!loadingStrategy) {
      setStudyStageIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setStudyStageIndex((prev) => (prev + 1) % 3);
    }, 1800);
    return () => clearInterval(timer);
  }, [loadingStrategy]);

  const fetchAiStrategy = async (customQuestion?: string) => {
    if (!isReadyForLaunchStep || !pageCreationMode) return;
    setLoadingStrategy(true);
    setStrategyError(null);

    const nextHistory = customQuestion
      ? [...aiChatHistory, { role: 'user' as const, content: customQuestion }]
      : [];
    if (customQuestion) {
      setAiChatHistory(nextHistory);
      setDifferentiationNote(customQuestion);
    }

    // En modo Estándar, jamás pasar contexto Tripwire a la IA
    const sanitizedCloneContext = clonedFrom
      ? isStandardMode
        ? {
            ...clonedFrom,
            sourceMode: 'principal_only' as const,
            sourceEntryProductName: undefined
          }
        : clonedFrom
      : undefined;

    try {
      const res = await fetch('/api/products/quick-creator-ai-strategy', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          pageCreationMode,
          productName: productName.trim(),
          productDescription: productDescription.trim(),
          winnerAngle: winnerAngle.trim() || undefined,
          price1Gs,
          normalPriceGs,
          entryProductName: isTripwireMode ? entryProductName.trim() : undefined,
          entryProductDescription: isTripwireMode ? entryProductDescription.trim() : undefined,
          entryPriceGs: isTripwireMode ? entryPriceGs : undefined,
          entryDeliveryFeeGs: isTripwireMode ? entryDeliveryFeeGs : undefined,
          clonedFromContext: sanitizedCloneContext,
          userQuestion: customQuestion || undefined,
          conversationHistory: customQuestion ? nextHistory : undefined
        })
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.strategy) {
        setStrategyError(data?.error || 'No se pudo consultar al Estratega IA.');
        return;
      }

      const strat: AiStrategyState = data.strategy;
      setAiStrategy(strat);
      setSelectedOptionId(strat.recommendedOptionId || strat.options?.[0]?.id || '');
      lastAnalyzedSignatureRef.current = strategySignature;

      if (!manualOverrideUsed) {
        setSheetCount(strat.recommendedSheetCount);
        setBackgroundMusicPreset(strat.recommendedAudioPreset);
      }

      if (strat.assistantReply) {
        setAiChatHistory((prev) => [...prev, { role: 'assistant', content: strat.assistantReply }]);
      }
    } catch (err: any) {
      setStrategyError(err?.message || 'Error conectando con el Estratega IA.');
    } finally {
      setLoadingStrategy(false);
    }
  };

  useEffect(() => {
    if (wizardStep === 4 && isReadyForLaunchStep && lastAnalyzedSignatureRef.current !== strategySignature) {
      setAiChatHistory([]);
      setManualOverrideUsed(false);
      void fetchAiStrategy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, strategySignature, isReadyForLaunchStep]);

  const handleSelectMode = (mode: 'dual_tripwire_winner' | 'principal_only') => {
    setPageCreationMode(mode);
    // Reset origen e info previa de IA al cambiar de arquitectura para evitar cruces
    setStartOrigin(null);
    setClonedFrom(null);
    setAiStrategy(null);
    setSelectedOptionId('');
    setAiChatHistory([]);
    lastAnalyzedSignatureRef.current = '';
    setShowPrincipalEditInTripwire(mode === 'dual_tripwire_winner' ? false : false);
    if (mode === 'principal_only') {
      setEntryProductName('');
      setEntryProductDescription('');
      setEntryProductImageInput('');
      setEntrySourceUrl('');
    }
  };

  const handleSelectSourceProduct = (source: ProductPage) => {
    const cloned = buildCloneDraftFromProductPage(source);
    setStartOrigin('clone');

    // Siempre cargamos los datos del Producto Principal
    setProductName(cloned.productName);
    setWinnerAngle(cloned.winnerAngle);
    setProductDescription(cloned.productDescription);
    setNormalPriceGs(cloned.normalPriceGs);
    setPrice1Gs(cloned.price1Gs);
    setPrice2Gs(cloned.price2Gs);
    setPrice3Gs(cloned.price3Gs);
    setPacksEditedManually(true);
    setProductImageInput(cloned.productImageInput);
    setWaNumber(cloned.waNumber || defaultWaNumber || '595973532550');

    if (isStandardMode) {
      // MODO ESTÁNDAR PURO: ignorar cualquier dato de tripwire que tuviera la página original
      setClonedFrom({
        ...cloned.clonedFromContext,
        sourceMode: 'principal_only',
        sourceEntryProductName: undefined
      });
      setEntrySourceUrl('');
      setEntryProductName('');
      setEntryProductDescription('');
      setEntryProductImageInput('');
      showToast(`"${source.nombre}" seleccionado. Dale siguiente para que la IA estudie y prepare el lanzamiento.`);
    } else {
      // MODO TRIPWIRE: introducimos el Producto Principal Estándar y dejamos limpio el Gancho para definirlo ahora
      // (Si la página origen ya era Tripwire y el usuario quiere reusar también el gancho, lo dejamos listo o editable en Paso 3)
      setClonedFrom(cloned.clonedFromContext);
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
      setShowPrincipalEditInTripwire(false);
      showToast(
        `Oferta Principal "${source.nombre}" cargada dentro de tu página Tripwire. Ahora definí tu Gancho en el Paso 3.`
      );
    }

    setAiStrategy(null);
    setSelectedOptionId('');
    setAiChatHistory([]);
    lastAnalyzedSignatureRef.current = '';
  };

  const handleChooseFreshOrigin = () => {
    setStartOrigin('fresh');
    setClonedFrom(null);
    setDifferentiationNote('');
    setAiStrategy(null);
    setSelectedOptionId('');
    setAiChatHistory([]);
    lastAnalyzedSignatureRef.current = '';
    if (isTripwireMode) {
      setShowPrincipalEditInTripwire(true);
    }
  };

  const handleClearSourceSelection = () => {
    setClonedFrom(null);
    setDifferentiationNote('');
    setAiStrategy(null);
    setSelectedOptionId('');
    setAiChatHistory([]);
    lastAnalyzedSignatureRef.current = '';
    showToast('Selección liberada.');
  };

  const handleResetAll = () => {
    setCreatedResult(null);
    setPageCreationMode(null);
    setStartOrigin(null);
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
    setPacksEditedManually(false);
    setShowPrincipalEditInTripwire(false);
    setAiStrategy(null);
    setSelectedOptionId('');
    setAiChatHistory([]);
    setManualOverrideUsed(false);
    setShowManualOverrides(false);
    lastAnalyzedSignatureRef.current = '';
    setWizardStep(1);
  };

  const handlePrice1Change = (val: number) => {
    const clean = Math.max(0, val);
    setPrice1Gs(clean);
    if (!packsEditedManually && clean > 0) {
      setNormalPriceGs(Math.round((clean * 1.32) / 1000) * 1000);
      setPrice2Gs(Math.round((clean * 1.85) / 1000) * 1000);
      setPrice3Gs(Math.round((clean * 2.65) / 1000) * 1000);
    }
  };

  const handleUploadPrincipalImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await readFileAsDataUrl(f);
      setProductImageInput(dataUrl);
    } catch (err: any) {
      showToast(err?.message || 'Error leyendo foto del producto.');
    }
  };

  const handleUploadEntryImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await readFileAsDataUrl(f);
      setEntryProductImageInput(dataUrl);
    } catch (err: any) {
      showToast(err?.message || 'Error leyendo foto de la oferta gancho.');
    }
  };

  const handleAnalyzeHookUrl = async () => {
    if (!entrySourceUrl.trim()) {
      showToast('Pegá primero el link del artículo gancho.');
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
      showToast('Datos e imagen cargados en la oferta gancho.');
    } catch (err: any) {
      showToast(err?.message || 'Error analizando URL.');
    } finally {
      setAnalyzingUrl(false);
    }
  };

  const handleStep2Next = () => {
    if (!isStep2Complete) {
      showToast(
        startOrigin === 'clone'
          ? 'Seleccioná primero un producto de la lista.'
          : 'Elegí una opción para continuar.'
      );
      return;
    }
    // ESTÁNDAR + CLONAR -> SALTA DIRECTO AL ESTUDIO IA ORBITAL + LANZAMIENTO (PASO 4)
    if (canFastTrackStandardClone) {
      setWizardStep(4);
      return;
    }
    // En Estándar nuevo o en Tripwire (para cargar la oferta gancho) -> va al Paso 3
    setWizardStep(3);
  };

  const handleAskAiStrategist = async () => {
    const q = differentiationNote.trim();
    if (!q) {
      await fetchAiStrategy('Proponeme 3 ángulos y direcciones visuales todavía más distintos.');
      return;
    }
    await fetchAiStrategy(q);
  };

  const handleCreateVisualProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageCreationMode) {
      setWizardStep(1);
      showToast('Primero elegí el tipo de página.');
      return;
    }
    if (!isReadyForLaunchStep) {
      setWizardStep(3);
      showToast('Completá los datos obligatorios antes de lanzar.');
      return;
    }

    setCreating(true);
    try {
      const effectiveAngle =
        selectedAiOption?.winnerAngle?.trim() || winnerAngle.trim() || undefined;
      const effectiveVisualDir = selectedAiOption?.visualDirection?.trim() || undefined;

      const sanitizedClone = clonedFrom
        ? {
            ...(isStandardMode
              ? { ...clonedFrom, sourceMode: 'principal_only' as const, sourceEntryProductName: undefined }
              : clonedFrom),
            differentiationNote:
              differentiationNote.trim() ||
              (selectedAiOption
                ? `${selectedAiOption.title}: ${selectedAiOption.winnerAngle}. Estilo visual: ${selectedAiOption.visualDirection}`
                : undefined)
          }
        : undefined;

      const payload: Record<string, any> = {
        pageCreationMode,
        productName: productName.trim(),
        winnerAngle: effectiveAngle,
        visualDirection: effectiveVisualDir,
        productDescription: productDescription.trim(),
        normalPriceGs,
        price1Gs,
        price2Gs,
        price3Gs,
        productImageInput: productImageInput.trim(),
        backgroundMusicPreset: manualOverrideUsed ? backgroundMusicPreset : 'auto',
        sheetCount: manualOverrideUsed ? sheetCount : selectedAiOption?.recommendedSheetCount || 'auto',
        waNumber: waNumber.trim(),
        clonedFromContext: sanitizedClone
      };

      if (isTripwireMode) {
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
        isStandardMode
          ? `Página Estándar creada: "${data.product.nombre}".`
          : `Página Tripwire + Oferta Principal creada: "${data.product.nombre}".`
      );
    } catch (err: any) {
      showToast(err?.message || 'Error creando producto.');
    } finally {
      setCreating(false);
    }
  };

  // Etiquetas adaptadas estrictamente al modo elegido (Estándar NO habla de Tripwire!)
  const stepsMeta = useMemo(() => {
    if (isTripwireMode) {
      return [
        { id: 1 as const, label: '01 · Tipo' },
        { id: 2 as const, label: '02 · Oferta Principal' },
        { id: 3 as const, label: '03 · Oferta Gancho' },
        { id: 4 as const, label: '04 · Estudio IA y Lanzar' }
      ];
    }
    return [
      { id: 1 as const, label: '01 · Tipo' },
      { id: 2 as const, label: '02 · Nuevo o Clonar' },
      { id: 3 as const, label: '03 · Datos y Precios' },
      { id: 4 as const, label: '04 · Estudio IA y Lanzar' }
    ];
  }, [isTripwireMode]);

  const canNavigateToStep = (target: 1 | 2 | 3 | 4): boolean => {
    if (target === 1) return true;
    if (target === 2) return isStep1Complete;
    if (target === 3) return isStep2Complete;
    if (target === 4) return isStep2Complete && isReadyForLaunchStep;
    return false;
  };

  const activeGuide = useMemo(() => {
    if (wizardStep === 1) {
      return {
        title: 'Paso 1 de 4 · ¿Qué tipo de página vas a crear hoy?',
        whatYouDo:
          'Elegí una de las 2 tarjetas de abajo según lo que querés vender: una Página Estándar (producto único directo) o una Página Tripwire (oferta gancho + producto principal en la misma página).',
        whyItMatters:
          'La Página Estándar es 100% directa a un solo producto. La Página Tripwire combina un producto gancho económico con tu Producto Principal adentro de la misma página.',
        unlockHint: pageCreationMode
          ? `Elegiste "${isStandardMode ? 'Página Estándar' : 'Página Tripwire'}". Tocá "Continuar al Paso 2" para avanzar.`
          : 'Tocá una de las 2 tarjetas de abajo para desbloquear el botón Continuar.'
      };
    }
    if (wizardStep === 2) {
      if (isStandardMode) {
        return {
          title: 'Paso 2 de 4 · Página Estándar: ¿Producto nuevo o clonar uno existente?',
          whatYouDo:
            'Elegí si vas a cargar un producto nuevo desde cero, o si querés clonar una página estándar que ya tenés creada.',
          whyItMatters:
            'Si clonás un producto existente, al tocar Siguiente no tenés que llenar formularios: pasás directo al Estudio IA donde te mostramos tus precios, paquetes y el nuevo ángulo listo para lanzar.',
          unlockHint: !startOrigin
            ? 'Elegí "Clonar una página existente" o "Crear Producto Estándar nuevo desde cero".'
            : startOrigin === 'clone' && !clonedFrom
              ? 'Ahora tocá en la lista de abajo cuál producto querés clonar para destrabar Siguiente.'
              : canFastTrackStandardClone
                ? `Producto "${clonedFrom?.sourceProductName}" listo. Tocá Siguiente para pasar directo al Estudio IA y Lanzamiento.`
                : 'Listo. Tocá Siguiente para cargar los datos de tu Producto Estándar.'
        };
      }
      return {
        title: 'Paso 2 de 4 · Página Tripwire: Elegí tu Producto Principal',
        whatYouDo:
          'Toda página Tripwire lleva un gancho arriba y tu Oferta Principal abajo. Seleccioná acá una Página de Producto Estándar ya hecha para meterla dentro de este Tripwire (o elegí crear una nueva desde cero).',
        whyItMatters:
          'Al seleccionar tu Página Estándar ya creada, importamos automático su nombre, fotos, descripción y paquetes para que en el Paso 3 te enfoques solo en tu oferta gancho.',
        unlockHint: !startOrigin
          ? 'Elegí si vas a introducir una Página Estándar ya hecha o cargar todo desde cero.'
          : startOrigin === 'clone' && !clonedFrom
            ? 'Tocá en la lista de abajo cuál Página Estándar va a ser la Oferta Principal de este Tripwire.'
            : clonedFrom
              ? `Oferta Principal "${clonedFrom.sourceProductName}" conectada. Tocá Siguiente para definir tu Gancho.`
              : 'Listo. Tocá Siguiente para cargar tu Gancho y tu Oferta Principal.'
      };
    }
    if (wizardStep === 3) {
      if (isStandardMode) {
        return {
          title: 'Paso 3 de 4 · Datos y precios de tu Producto Estándar',
          whatYouDo:
            'Cargá o ajustá el nombre, descripción, precio 1x, packs 2x/3x y foto de tu único producto estándar.',
          whyItMatters:
            'Con esta ficha armamos tu página visual estándar y entrenamos automáticamente a tu Agente de WhatsApp y al bot de Comentarios Meta sin inventar precios.',
          unlockHint: isReadyForLaunchStep
            ? 'Todos los datos obligatorios están completos. Tocá "Ir al Estudio IA y Lanzamiento".'
            : 'Completá los campos marcados arriba en el checklist para habilitar el Estudio IA.'
        };
      }
      return {
        title: 'Paso 3 de 4 · Definí tu Oferta de Gancho (Tripwire)',
        whatYouDo: clonedFrom
          ? `Tu Oferta Principal ("${productName}") ya quedó conectada a la derecha. Acá a la izquierda definí solamente la oferta económica de gancho que atrae el clic.`
          : 'A la izquierda cargá tu Oferta de Gancho económica (Tripwire) y a la derecha tu Oferta Principal completa.',
        whyItMatters:
          'En la misma página, el cliente entra por el gancho accesible y descubre que llevando la Oferta Principal se lleva el gancho DE REGALO + Envío Gratis.',
        unlockHint: isReadyForLaunchStep
          ? 'Gancho y Oferta Principal listos. Tocá "Ir al Estudio IA y Lanzamiento".'
          : 'Completá el nombre y precio del Gancho (y de la Oferta Principal si la cargás nueva) para continuar.'
      };
    }
    // Step 4
    if (isStandardMode) {
      return {
        title: 'Paso 4 de 4 · Estudio IA y Lanzamiento Estándar',
        whatYouDo:
          'La IA analiza toda la información de tu producto y prepara 3 ángulos listos (el mejor ya viene elegido). Revisá el resumen y usá uno de los 2 botones de abajo: Editar o Lanzar.',
        whyItMatters:
          'Si clonaste una página, te aseguramos un ángulo y láminas totalmente diferentes a la anterior. Si querés retocar precio, packs o algún bono antes de publicar, tocás "Editar precios, paquetes o datos".',
        unlockHint:
          'Tocá "Lanzar Página Estándar" cuando estés listo para generar las láminas GPT-2.6 y publicar.'
      };
    }
    return {
      title: 'Paso 4 de 4 · Estudio IA y Lanzamiento Tripwire',
      whatYouDo:
        'La IA une tu Oferta Gancho con tu Oferta Principal bajo un enfoque de alto impacto. Revisá todo y elegí "Editar precios, paquetes o gancho" o "Lanzar Página Tripwire".',
      whyItMatters:
        'Al lanzar, GPT-2.6 diseña las láminas visuales conectando ambas ofertas en la misma página con el gancho gratis al elegir la oferta principal.',
      unlockHint:
        'Tocá "Lanzar Página Tripwire" para generar la página visual completa y conectarla a tus campañas.'
    };
  }, [
    wizardStep,
    pageCreationMode,
    isStandardMode,
    startOrigin,
    clonedFrom,
    canFastTrackStandardClone,
    productName,
    isReadyForLaunchStep
  ]);

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl bg-[#07090f]/90 border border-white/10 focus:border-[#e5c88b]/70 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors';
  const monoInputClass =
    'w-full px-3 py-2.5 rounded-xl bg-[#07090f]/90 border border-white/10 focus:border-[#e5c88b]/70 text-sm text-zinc-100 font-mono tabular-nums outline-none transition-colors';

  const studyStagesText = isStandardMode
    ? [
        'Recabando ficha técnica, precios y paquetes de tu producto...',
        'Estudiando el ángulo actual para proponer un enfoque inédito...',
        'Preparando opciones de lanzamiento para tu Página Estándar...'
      ]
    : [
        'Recabando ficha de tu Oferta Gancho y Oferta Principal...',
        'Calculando el puente psicológico Gancho → Regalo + Envío Gratis...',
        'Preparando ángulos de alto impacto para tu Página Tripwire...'
      ];

  return (
    <div
      data-testid="quick-product-creator-view"
      className="relative max-w-6xl mx-auto rounded-2xl bg-[#06080d] border border-white/10 overflow-hidden"
    >
      {/* Fondo 3D con Orbes Flotantes Luminosos */}
      <LuminousOrbsBackdrop />

      {/* Contenedor Principal Smoked Glass */}
      <div className="relative z-10 p-5 sm:p-8 lg:p-10 space-y-7">
        {/* Cabecera Editorial + Stepper Adaptativo */}
        <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 border-b border-white/10 pb-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="text-xs font-mono tracking-wider text-[#e5c88b] uppercase">
              {isStandardMode
                ? 'Modo Estándar · Producto Único'
                : isTripwireMode
                  ? 'Modo Tripwire · Gancho + Oferta Principal'
                  : 'Estudio Guiado · Manos Libres'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
              Creador Guiado de Páginas de Producto
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {isStandardMode
                ? 'Modo Estándar: creás una página limpia enfocada 100% en tu producto único, con edición opcional de precios y paquetes antes de lanzar.'
                : isTripwireMode
                  ? 'Modo Tripwire: conectás tu producto principal estándar con una oferta de gancho accesible dentro de la misma página.'
                  : 'Te llevamos paso a paso de la mano: cada pantalla te explica qué hacer y destraba el siguiente paso sin confusiones.'}
            </p>
          </div>

          <nav
            aria-label="Pasos guiados"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 shrink-0"
          >
            {stepsMeta.map((s) => {
              const isActive = wizardStep === s.id;
              const isCompleted =
                wizardStep > s.id ||
                (s.id === 3 && canFastTrackStandardClone && wizardStep === 4);
              const allowed = canNavigateToStep(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`wizard-step-tab-${s.id}`}
                  onClick={() => {
                    if (!allowed) {
                      showToast('Completá primero el paso actual para desbloquear este paso.');
                      return;
                    }
                    setWizardStep(s.id);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#e5c88b] text-[#090b10] font-bold cursor-pointer'
                      : allowed
                        ? 'text-zinc-200 hover:bg-white/[0.06] cursor-pointer'
                        : 'text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 text-[#e5c88b]" />
                  ) : !allowed ? (
                    <Lock className="w-3 h-3 text-zinc-600" />
                  ) : null}
                  <span>{s.label}</span>
                </button>
              );
            })}
          </nav>
        </header>

        {/* GUÍA EXPLICATIVA EN CADA PASO */}
        <section
          data-testid={`wizard-step-explainer-${wizardStep}`}
          className="p-5 sm:p-6 rounded-xl bg-[#0b0e16]/85 border border-[#e5c88b]/30 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#e5c88b]">
              <Compass className="w-4 h-4 shrink-0" />
              <span>{activeGuide.title}</span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-zinc-500">{wizardStep} / 4</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-white">Qué hacés aquí</div>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{activeGuide.whatYouDo}</p>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-white">Para qué sirve</div>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{activeGuide.whyItMatters}</p>
            </div>
          </div>

          <div className="pt-2.5 border-t border-white/10 text-xs text-[#e5c88b] flex items-center gap-2">
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span>{activeGuide.unlockHint}</span>
          </div>
        </section>

        <form onSubmit={handleCreateVisualProduct} className="space-y-8">
          {/* ============================================================== */}
          {/* PASO 1: ELECCIÓN DE ARQUITECTURA (SIN MEZCLAR FLUJOS)          */}
          {/* ============================================================== */}
          {wizardStep === 1 && (
            <div className="space-y-6">
              <div
                data-testid="quick-creator-mode-switcher"
                className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch"
              >
                <button
                  type="button"
                  data-testid="quick-creator-mode-principal"
                  onClick={() => handleSelectMode('principal_only')}
                  className={`text-left p-6 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                    isStandardMode
                      ? 'bg-white/[0.08] border-[#e5c88b]'
                      : 'bg-[#0b0e16]/75 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-bold text-white">
                        Página de Producto Estándar
                      </span>
                      <span
                        className={`text-[11px] font-mono uppercase ${
                          isStandardMode ? 'text-[#e5c88b]' : 'text-zinc-500'
                        }`}
                      >
                        {isStandardMode ? 'Elegido' : 'Producto Único'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      Página 100% enfocada en un solo producto directo, sin ningún gancho ni segundo artículo. Podés crearlo desde cero o clonar una página existente directo a lanzamiento con otro ángulo.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/10 text-xs text-zinc-400 leading-relaxed">
                    <span className="text-[#e5c88b] font-semibold">Recorrido Estándar:</span> Tipo → Clonar o Nuevo → Estudio IA y Lanzar.
                  </div>
                </button>

                <button
                  type="button"
                  data-testid="quick-creator-mode-dual"
                  onClick={() => handleSelectMode('dual_tripwire_winner')}
                  className={`text-left p-6 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                    isTripwireMode
                      ? 'bg-white/[0.08] border-[#e5c88b]'
                      : 'bg-[#0b0e16]/75 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-bold text-white">
                        Página Tripwire (Gancho + Oferta Principal)
                      </span>
                      <span
                        className={`text-[11px] font-mono uppercase ${
                          isTripwireMode ? 'text-[#e5c88b]' : 'text-zinc-500'
                        }`}
                      >
                        {isTripwireMode ? 'Elegido' : 'Embudo Gancho'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      Creás una oferta accesible de gancho (Tripwire) junto a tu Oferta Principal en la misma página. En el Paso 2 podés seleccionar directamente una página estándar que ya tengas hecha para introducirla como Oferta Principal.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/10 text-xs text-zinc-400 leading-relaxed">
                    <span className="text-[#e5c88b] font-semibold">Recorrido Tripwire:</span> Elegir Producto Principal ya hecho → Definir Gancho → Lanzar.
                  </div>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
                <div className="text-xs text-zinc-400">
                  {pageCreationMode ? (
                    <span>
                      Elegiste{' '}
                      <strong className="text-white">
                        {isStandardMode
                          ? 'Página de Producto Estándar'
                          : 'Página Tripwire (Gancho + Oferta Principal)'}
                      </strong>
                      .
                    </span>
                  ) : (
                    <span>Tocá una de las 2 tarjetas de arriba para continuar.</span>
                  )}
                </div>

                <button
                  type="button"
                  data-testid="wizard-next-step-1"
                  disabled={!isStep1Complete}
                  onClick={() => setWizardStep(2)}
                  className="px-6 py-3 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] font-bold text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <span>Continuar al Paso 2</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 2: ORIGEN ADAPTADO AL MODO                                */}
          {/* - ESTÁNDAR: Nuevo desde cero | Clonar página existente         */}
          {/* - TRIPWIRE: Elegir Página Estándar ya hecha como Oferta Princ. */}
          {/* ============================================================== */}
          {wizardStep === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                <button
                  type="button"
                  data-testid="quick-creator-origin-clone"
                  onClick={() => setStartOrigin('clone')}
                  disabled={cloneablePages.length === 0}
                  className={`text-left p-5 sm:p-6 rounded-xl border transition-all space-y-2 ${
                    cloneablePages.length === 0
                      ? 'bg-[#0b0e16]/40 border-white/5 opacity-50 cursor-not-allowed'
                      : startOrigin === 'clone'
                        ? 'bg-white/[0.08] border-[#e5c88b] cursor-pointer'
                        : 'bg-[#0b0e16]/75 border-white/10 hover:border-white/25 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      {isTripwireMode ? (
                        <PackageCheck className="w-4 h-4 text-[#e5c88b]" />
                      ) : (
                        <Copy className="w-4 h-4 text-[#e5c88b]" />
                      )}
                      <span>
                        {isTripwireMode
                          ? 'Introducir una Página Estándar ya hecha como Oferta Principal'
                          : 'Clonar una página existente (directo a IA)'}
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-[#e5c88b]">
                      {startOrigin === 'clone' ? 'Elegido' : `${cloneablePages.length} disp.`}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                    {cloneablePages.length === 0
                      ? 'Todavía no tenés productos guardados en tu catálogo.'
                      : isTripwireMode
                        ? 'Seleccioná tu producto estándar ya creado: sus precios, fotos y descripción entran automático como Oferta Principal y en el siguiente paso solo cargás el gancho.'
                        : 'Seleccioná cualquier producto ya creado y al darle Siguiente saltás directo al Estudio IA para lanzar una nueva página estándar con otro ángulo.'}
                  </p>
                </button>

                <button
                  type="button"
                  data-testid="quick-creator-origin-fresh"
                  onClick={handleChooseFreshOrigin}
                  className={`text-left p-5 sm:p-6 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    startOrigin === 'fresh'
                      ? 'bg-white/[0.08] border-[#e5c88b]'
                      : 'bg-[#0b0e16]/75 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-[#e5c88b]" />
                      <span>
                        {isTripwireMode
                          ? 'Crear Gancho y Oferta Principal nuevos desde cero'
                          : 'Crear Producto Estándar nuevo desde cero'}
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-[#e5c88b]">
                      {startOrigin === 'fresh' ? 'Elegido' : ''}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                    {isTripwireMode
                      ? 'Usalo solo si todavía no creaste la página estándar del producto principal y querés cargar ambos desde cero.'
                      : 'Cargá nombre, descripción y precio en Guaraníes de un producto nuevo que todavía no está en el catálogo.'}
                  </p>
                </button>
              </div>

              {/* Catálogo seleccionable cuando eligió Clonar (Estándar) o Introducir Principal (Tripwire) */}
              {startOrigin === 'clone' && (
                <section
                  data-testid="quick-creator-clone-panel"
                  className="space-y-4 p-5 rounded-xl bg-[#0b0e16]/80 border border-white/10"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {isTripwireMode
                          ? 'Elegí la Página Estándar que va como Oferta Principal dentro de este Tripwire'
                          : 'Elegí la página existente que querés clonar'}
                      </h3>
                      <p className="text-xs text-zinc-400">
                        {isTripwireMode
                          ? 'Tus páginas estándar aparecen primero. Al elegir una, queda vinculada como Oferta Principal en la misma página del Tripwire.'
                          : 'Copiamos nombre, descripción, precios y paquetes de este producto para lanzar una página estándar nueva con otro ángulo.'}
                      </p>
                    </div>
                    {clonedFrom && (
                      <button
                        type="button"
                        data-testid="quick-creator-clear-clone-btn"
                        onClick={handleClearSourceSelection}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-zinc-300 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Cambiar selección</span>
                      </button>
                    )}
                  </div>

                  {clonedFrom && (
                    <div
                      data-testid="quick-creator-clone-ready-banner"
                      className="p-4 rounded-xl bg-white/[0.05] border border-[#e5c88b]/50 text-xs sm:text-sm text-zinc-200 space-y-1"
                    >
                      <div>
                        <span className="text-[#e5c88b] font-semibold">
                          {isTripwireMode ? 'Oferta Principal conectada:' : 'Producto base listo:'}
                        </span>{' '}
                        <strong>{clonedFrom.sourceProductName}</strong>{' '}
                        <span className="text-zinc-400 font-mono tabular-nums">(1x {formatGs(price1Gs)})</span>
                      </div>
                      <div className="text-xs text-zinc-400">
                        {isStandardMode
                          ? 'Toda la información y paquetes ya fueron capturados. Al dar Siguiente, la IA estudia el producto y te lleva directo al lanzamiento.'
                          : 'La Oferta Principal ya está lista. En el siguiente paso solo cargás tu Oferta de Gancho (Tripwire).'}
                      </div>
                    </div>
                  )}

                  {cloneablePages.length > 4 && (
                    <input
                      type="text"
                      value={cloneFilterQuery}
                      onChange={(e) => setCloneFilterQuery(e.target.value)}
                      placeholder="Buscar producto por nombre o slug..."
                      className={inputClass}
                    />
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {displayedCatalogPages.map((p) => {
                      const isSelectedClone = clonedFrom?.sourceProductId === p.id;
                      const isTwSource = Boolean(
                        p.tripwireConfig?.enabled && p.tripwireConfig?.entryProductName
                      );
                      return (
                        <button
                          key={p.id}
                          type="button"
                          data-testid={`clone-source-${p.id}`}
                          onClick={() => handleSelectSourceProduct(p)}
                          className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                            isSelectedClone
                              ? 'bg-white/[0.09] border-[#e5c88b]'
                              : 'bg-[#07090f]/80 border-white/10 hover:border-white/25'
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
                            <div className="text-xs font-semibold text-white truncate">{p.nombre}</div>
                            <div className="text-[11px] text-zinc-400 truncate">
                              {isStandardMode
                                ? 'Producto Principal'
                                : isTwSource
                                  ? 'Base existente'
                                  : 'Página Estándar'}
                              {' · '}
                              <span className="font-mono tabular-nums">
                                {formatGs(Number(p.precios?.[1] || p.precioNormal || 0))}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 truncate">/?p={p.slug}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver al Paso 1</span>
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  {startOrigin === 'clone' && !clonedFrom && (
                    <span className="text-xs text-[#e5c88b]">
                      Tocá un producto de la lista para continuar.
                    </span>
                  )}

                  <button
                    type="button"
                    data-testid="wizard-next-step-2"
                    disabled={!isStep2Complete}
                    onClick={handleStep2Next}
                    className="px-6 py-3 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] font-bold text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span>
                      {canFastTrackStandardClone
                        ? 'Siguiente · Estudiar y Lanzar Página Estándar'
                        : isTripwireMode
                          ? 'Siguiente · Definir Oferta Gancho (Tripwire)'
                          : 'Siguiente · Cargar Datos del Producto'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 3:                                                        */}
          {/* - ESTÁNDAR: ÚNICAMENTE PRODUCTO ESTÁNDAR (CERO TRIPWIRE)       */}
          {/* - TRIPWIRE: GANCHO + OFERTA PRINCIPAL YA CONECTADA             */}
          {/* ============================================================== */}
          {wizardStep === 3 && (
            <div className="space-y-6">
              <div
                data-testid="quick-creator-step3-checklist"
                className="p-4 rounded-xl bg-[#07090f]/90 border border-white/10 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"
              >
                <span className="font-mono uppercase text-[11px] text-zinc-500">Estado de campos:</span>
                {missingDataChecklist.map((item, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1.5 ${
                      item.ok ? 'text-zinc-300' : 'text-[#e5c88b] font-semibold'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${item.ok ? 'text-[#e5c88b]' : 'text-zinc-600'}`}
                    />
                    <span>{item.label}</span>
                  </span>
                ))}
              </div>

              <div
                className={`grid grid-cols-1 ${
                  isTripwireMode ? 'lg:grid-cols-2 lg:gap-8' : ''
                } gap-6 items-start`}
              >
                {/* BLOQUE GANCHO — SOLO EXISTE EN MODO TRIPWIRE */}
                {isTripwireMode && (
                  <section
                    data-testid="quick-creator-tripwire-block"
                    className="p-5 sm:p-6 rounded-xl bg-[#0b0e16]/80 border border-white/10 space-y-4"
                  >
                    <div className="border-b border-white/10 pb-3 space-y-1">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-[#e5c88b]">
                        Oferta de Gancho · Tripwire
                      </div>
                      <h3 className="text-base font-bold text-white">Producto Gancho Accesible</h3>
                      <p className="text-xs text-zinc-400">
                        Es el artículo económico que atrae el clic en tu anuncio y va DE REGALO si llevan la Oferta Principal.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-300 block">
                        Importar desde link del proveedor (opcional)
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
                          {analyzingUrl ? 'Leyendo...' : 'Leer URL'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-300 block">
                        1. Nombre del producto gancho *
                      </label>
                      <input
                        type="text"
                        data-testid="quick-creator-entry-name"
                        placeholder="Ej: Set de Papeles Antiadherentes x50"
                        value={entryProductName}
                        onChange={(e) => setEntryProductName(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-300 block">
                        2. Qué incluye exactamente
                      </label>
                      <textarea
                        data-testid="quick-creator-entry-desc"
                        rows={2}
                        placeholder="Ej: Pack de 50 unidades descartables medida universal."
                        value={entryProductDescription}
                        onChange={(e) => setEntryProductDescription(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-[#e5c88b] font-medium block">Precio Gancho (Gs.) *</label>
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
                        <label className="text-xs text-zinc-400 block">Normal tachado</label>
                        <input
                          type="number"
                          min={10000}
                          step={1000}
                          value={entryNormalPriceGs}
                          onChange={(e) => setEntryNormalPriceGs(Number(e.target.value) || 45000)}
                          className={monoInputClass}
                        />
                      </div>
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="text-xs text-zinc-400 block">Delivery (solo gancho)</label>
                        <input
                          type="number"
                          min={10000}
                          step={5000}
                          value={entryDeliveryFeeGs}
                          onChange={(e) => setEntryDeliveryFeeGs(Number(e.target.value) || 40000)}
                          className={monoInputClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-300 block">
                        Foto de referencia del gancho (opcional)
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
                            alt="Vista previa producto gancho"
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-lg object-cover border border-white/15"
                          />
                          <span className="text-[11px] text-zinc-400">Imagen lista</span>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* BLOQUE PRODUCTO ESTÁNDAR / OFERTA PRINCIPAL */}
                <section
                  data-testid="quick-creator-winner-block"
                  className="p-5 sm:p-6 rounded-xl bg-[#0b0e16]/80 border border-white/10 space-y-4"
                >
                  <div className="border-b border-white/10 pb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                        {isStandardMode
                          ? 'Página Estándar · Envío Gratis en Paraguay'
                          : 'Oferta Principal en la misma página · Envío Gratis'}
                      </div>
                      <h3 className="text-base font-bold text-white">
                        {isStandardMode
                          ? 'Información y Paquetes de tu Producto'
                          : clonedFrom
                            ? `Oferta Principal Conectada: ${productName}`
                            : 'Tu Producto Principal (Incluye Gancho de Regalo)'}
                      </h3>
                    </div>

                    {isTripwireMode && clonedFrom && (
                      <button
                        type="button"
                        onClick={() => setShowPrincipalEditInTripwire((v) => !v)}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#e5c88b]" />
                        <span>{showPrincipalEditInTripwire ? 'Ocultar edición' : 'Editar precios / packs'}</span>
                      </button>
                    )}
                  </div>

                  {/* Si es Tripwire y ya vino conectado desde una página estándar, mostramos resumen limpio salvo que toque Editar */}
                  {isTripwireMode && clonedFrom && !showPrincipalEditInTripwire ? (
                    <div className="space-y-3 text-xs sm:text-sm">
                      <div className="flex items-center gap-3">
                        {productImageInput ? (
                          <img
                            src={productImageInput}
                            alt={productName}
                            referrerPolicy="no-referrer"
                            className="w-14 h-14 rounded-lg object-cover border border-white/10 shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
                            <Layers className="w-5 h-5 text-zinc-400" />
                          </div>
                        )}
                        <div className="space-y-0.5">
                          <div className="font-bold text-white">{productName}</div>
                          <div className="text-xs font-mono tabular-nums text-[#e5c88b]">
                            1x {formatGs(price1Gs)} · Pack 2x {formatGs(price2Gs)} · Pack 3x {formatGs(price3Gs)}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{productDescription}</p>
                      <div className="text-xs text-zinc-300 pt-2 border-t border-white/10">
                        Ya quedó importado como tu Oferta Principal dentro de esta página Tripwire. Si querés cambiar precios o paquetes, tocá arriba <strong>Editar precios / packs</strong>.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-300 block">
                          Nombre del producto *
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
                          Descripción técnica y qué incluye *
                        </label>
                        <textarea
                          data-testid="quick-creator-main-desc"
                          rows={3}
                          placeholder="Ej: Cobertura exterior amplia, 12 discos HD, enchufe 220V y pago al recibir en Paraguay."
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
                            onChange={(e) => {
                              setPacksEditedManually(true);
                              setNormalPriceGs(Number(e.target.value) || 249000);
                            }}
                            className={monoInputClass}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-[#e5c88b] font-medium block">Precio 1x *</label>
                          <input
                            type="number"
                            min={35000}
                            step={1000}
                            value={price1Gs}
                            onChange={(e) => handlePrice1Change(Number(e.target.value) || 0)}
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
                            onChange={(e) => {
                              setPacksEditedManually(true);
                              setPrice2Gs(Number(e.target.value) || 0);
                            }}
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
                            onChange={(e) => {
                              setPacksEditedManually(true);
                              setPrice3Gs(Number(e.target.value) || 0);
                            }}
                            className={monoInputClass}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-zinc-300 block">
                            Imagen de referencia del producto
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
                                alt="Vista previa producto"
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-lg object-cover border border-white/15"
                              />
                              <span className="text-[11px] text-zinc-400">Imagen lista</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-zinc-300 block">
                            WhatsApp de pedidos
                          </label>
                          <input
                            type="text"
                            value={waNumber}
                            onChange={(e) => setWaNumber(e.target.value)}
                            className={monoInputClass}
                          />
                          <span className="text-[11px] text-zinc-500 block">
                            Envío Gratis incluido en todo Paraguay
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400 block">
                          Nota de enfoque inicial (opcional — la IA igual propondrá 3 ángulos en el siguiente paso)
                        </label>
                        <input
                          type="text"
                          data-testid="quick-creator-winner-angle"
                          placeholder="Ej: Resultados profesionales en 60 segundos sin instalación"
                          value={winnerAngle}
                          onChange={(e) => setWinnerAngle(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </>
                  )}
                </section>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver al Paso 2</span>
                </button>

                <button
                  type="button"
                  data-testid="wizard-next-step-3"
                  disabled={!isReadyForLaunchStep}
                  onClick={() => setWizardStep(4)}
                  className="px-6 py-3 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] font-bold text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <span>Ir al Estudio IA y Lanzamiento</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 4: ESTUDIO IA ORBITAL + ÁNGULO + LANZAMIENTO DIRECTO      */}
          {/* (Incluye botones claros "Editar precios/paquetes" y "Lanzar")   */}
          {/* ============================================================== */}
          {wizardStep === 4 && (
            <div className="space-y-6">
              {/* Estado de Estudio Orbital mientras la IA analiza toda la información */}
              {loadingStrategy && !aiStrategy ? (
                <div
                  data-testid="quick-creator-ai-loading"
                  className="p-8 sm:p-12 rounded-2xl bg-[#0b0e16]/85 border border-[#e5c88b]/30 flex flex-col items-center text-center space-y-6"
                >
                  {/* Órbita Luminosa Minimalista */}
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <div
                      className="absolute inset-0 rounded-full border border-[#e5c88b]/25 border-t-[#e5c88b] animate-spin"
                      style={{ animationDuration: '2.6s' }}
                    />
                    <div
                      className="absolute inset-3 rounded-full border border-white/10 border-b-[#e5c88b]/70 animate-spin"
                      style={{ animationDuration: '4s', animationDirection: 'reverse' }}
                    />
                    <div className="w-12 h-12 rounded-xl bg-[#e5c88b]/10 border border-[#e5c88b]/40 flex items-center justify-center">
                      <BrainCircuit className="w-6 h-6 text-[#e5c88b]" />
                    </div>
                  </div>

                  <div className="space-y-2 max-w-md">
                    <div className="text-xs font-mono uppercase tracking-wider text-[#e5c88b]">
                      Estudiando e Integrando Información
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-white">
                      {clonedFrom
                        ? `Analizando "${clonedFrom.sourceProductName}"`
                        : `Analizando "${productName}"`}
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-400">
                      {studyStagesText[studyStageIndex]}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-5 sm:p-7 rounded-xl bg-[#0b0e16]/85 border border-white/10 space-y-6">
                  {/* Cabecera Limpia con Resumen de Datos Obtenidos */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="space-y-1">
                      <div className="text-xs font-mono uppercase tracking-wider text-[#e5c88b]">
                        {isStandardMode
                          ? 'Listo para Lanzar · Página Estándar'
                          : 'Listo para Lanzar · Página Tripwire + Oferta Principal'}
                      </div>
                      <div className="text-lg sm:text-xl font-bold text-white">{productName}</div>
                      <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-2 font-mono tabular-nums">
                        <span>1x {formatGs(price1Gs)}</span>
                        <span aria-hidden="true">·</span>
                        <span>2x {formatGs(price2Gs)}</span>
                        <span aria-hidden="true">·</span>
                        <span>3x {formatGs(price3Gs)}</span>
                        {isTripwireMode && entryProductName && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-sans text-[#e5c88b]">
                              Gancho: {entryProductName} ({formatGs(entryPriceGs)})
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      data-testid="quick-creator-refresh-ai-btn"
                      onClick={() => fetchAiStrategy()}
                      disabled={loadingStrategy}
                      className="px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {loadingStrategy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#e5c88b]" />
                      ) : (
                        <BrainCircuit className="w-3.5 h-3.5 text-[#e5c88b]" />
                      )}
                      <span>{loadingStrategy ? 'Estudiando...' : 'Re-estudiar con IA'}</span>
                    </button>
                  </div>

                  {strategyError && (
                    <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-xs sm:text-sm text-red-200 flex flex-wrap items-center justify-between gap-3">
                      <span>{strategyError}</span>
                      <button
                        type="button"
                        onClick={() => fetchAiStrategy()}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white cursor-pointer"
                      >
                        Reintentar análisis IA
                      </button>
                    </div>
                  )}

                  {aiStrategy && (
                    <div className="space-y-6">
                      <div
                        data-testid="quick-creator-ai-diagnosis"
                        className="p-4 rounded-xl bg-[#07090f]/80 border border-white/10 space-y-1.5"
                      >
                        <div className="text-[11px] font-mono uppercase tracking-wider text-[#e5c88b] flex items-center gap-1.5">
                          <BrainCircuit className="w-3.5 h-3.5" />
                          <span>
                            {clonedFrom
                              ? `Lo que detectó la IA en "${clonedFrom.sourceProductName}"`
                              : 'Diagnóstico del Estratega IA'}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                          {aiStrategy.currentPageDiagnosis}
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="text-sm font-bold text-white">
                            Ángulo preparado para tu lanzamiento (elegí cualquiera con 1 clic)
                          </h3>
                          <span className="text-xs text-zinc-500">
                            Diseño de láminas GPT-2.6 decidido automáticamente
                          </span>
                        </div>

                        <div
                          data-testid="quick-creator-ai-options-grid"
                          className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch"
                        >
                          {aiStrategy.options.map((opt) => {
                            const isSelected = selectedAiOption?.id === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                data-testid={`ai-angle-option-${opt.id}`}
                                onClick={() => {
                                  setSelectedOptionId(opt.id);
                                  if (!manualOverrideUsed) {
                                    setSheetCount(opt.recommendedSheetCount);
                                    setBackgroundMusicPreset(opt.recommendedAudioPreset);
                                  }
                                }}
                                className={`text-left p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                                  isSelected
                                    ? 'bg-white/[0.08] border-[#e5c88b]'
                                    : 'bg-[#07090f]/75 border-white/10 hover:border-white/25'
                                }`}
                              >
                                <div className="space-y-2.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span
                                      className={`text-[10px] font-mono uppercase tracking-wider ${
                                        isSelected ? 'text-[#e5c88b]' : 'text-zinc-500'
                                      }`}
                                    >
                                      {opt.archetype}
                                    </span>
                                    {isSelected && (
                                      <CheckCircle2 className="w-4 h-4 text-[#e5c88b] shrink-0" />
                                    )}
                                  </div>

                                  <div className="text-sm font-bold text-white leading-snug">
                                    {opt.title}
                                  </div>

                                  <div className="text-xs font-medium text-[#e5c88b]/90 leading-relaxed">
                                    “{opt.winnerAngle}”
                                  </div>

                                  <p className="text-xs text-zinc-400 leading-relaxed">
                                    {opt.whyItConverts}
                                  </p>

                                  {isTripwireMode && opt.tripwireBridgeNote && (
                                    <p className="text-[11px] text-zinc-300/90 pt-1 border-t border-white/10">
                                      Puente Gancho → Principal: {opt.tripwireBridgeNote}
                                    </p>
                                  )}
                                </div>

                                <div className="pt-2 border-t border-white/10 text-[11px] font-mono text-zinc-500 flex items-center justify-between gap-2">
                                  <span>{opt.recommendedSheetCount} láminas IA</span>
                                  <span className="truncate">
                                    {AUDIO_LABELS[opt.recommendedAudioPreset] || 'Auto'}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Chat / ajuste rápido opcional con el Estratega IA */}
                  <div className="p-4 sm:p-5 rounded-xl bg-[#07090f]/80 border border-white/10 space-y-3">
                    <div className="text-xs font-semibold text-white flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-[#e5c88b]" />
                      <span>¿Querés pedirle otro ángulo o estilo diferente a la IA? (opcional)</span>
                    </div>

                    {aiChatHistory.length > 0 && (
                      <div
                        data-testid="quick-creator-ai-chat-feed"
                        className="space-y-2 max-h-40 overflow-y-auto pr-1"
                      >
                        {aiChatHistory.slice(-4).map((msg, i) => (
                          <div
                            key={i}
                            className={`text-xs leading-relaxed px-3 py-2 rounded-lg ${
                              msg.role === 'user'
                                ? 'bg-white/[0.06] text-zinc-200 ml-6'
                                : 'bg-[#0b0e16] border border-white/10 text-zinc-300 mr-6'
                            }`}
                          >
                            <span className="font-mono text-[10px] uppercase tracking-wider text-[#e5c88b] mr-2">
                              {msg.role === 'user' ? 'Vos' : 'Estratega IA'}
                            </span>
                            <span>{msg.content}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {[
                        'Proponé otro ángulo completamente diferente',
                        'Enfoque emocional para familias',
                        'Estilo visual minimalista oscuro'
                      ].map((quickPrompt) => (
                        <button
                          key={quickPrompt}
                          type="button"
                          disabled={loadingStrategy}
                          onClick={() => fetchAiStrategy(quickPrompt)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 text-[11px] text-zinc-300 cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {quickPrompt}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        data-testid="quick-creator-clone-angle-note"
                        placeholder="Escribí una indicación si querés cambiar el enfoque..."
                        value={differentiationNote}
                        onChange={(e) => setDifferentiationNote(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleAskAiStrategist();
                          }
                        }}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        data-testid="quick-creator-ask-ai-btn"
                        onClick={handleAskAiStrategist}
                        disabled={loadingStrategy}
                        className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {loadingStrategy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5 text-[#e5c88b]" />
                        )}
                        <span>Consultar IA</span>
                      </button>
                    </div>
                  </div>

                  {/* Línea silenciosa automática + override opcional */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-zinc-400">
                    <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-[11px]">
                      <span className="text-[#e5c88b]">Automático IA:</span>
                      <span>{effectiveSheetCount} láminas 3:4 full-bleed (GPT-2.6)</span>
                      <span aria-hidden="true">·</span>
                      <span>Audio: {AUDIO_LABELS[effectiveAudioPreset] || 'Acústica Cálida'}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowManualOverrides((v) => !v)}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>{showManualOverrides ? 'Ocultar ajuste manual' : 'Ajuste manual opcional'}</span>
                    </button>
                  </div>

                  {showManualOverrides && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#07090f]/70 border border-white/10">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-300 block">
                          Cantidad de láminas
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {([2, 3] as const).map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                setManualOverrideUsed(true);
                                setSheetCount(n);
                              }}
                              className={`px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                                effectiveSheetCount === n
                                  ? 'bg-white/[0.08] border-[#e5c88b] text-white'
                                  : 'bg-[#0b0e16] border-white/10 text-zinc-400'
                              }`}
                            >
                              {n} Láminas (3:4)
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-300 block">
                          Ambientación sonora WhatsApp
                        </label>
                        <select
                          value={effectiveAudioPreset}
                          onChange={(e) => {
                            setManualOverrideUsed(true);
                            setBackgroundMusicPreset(e.target.value as any);
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-[#0b0e16] border border-white/10 text-xs text-white outline-none focus:border-[#e5c88b]/70 cursor-pointer"
                        >
                          <option value="warm_ambient">Acústica Cálida</option>
                          <option value="soft_lounge">Lounge Suave Elegante</option>
                          <option value="commercial_pulse">Pulso Dinámico Sutil</option>
                          <option value="none">Solo Voz (Sin música)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MINI GUÍA + BOTONERA FINAL: EDITAR PRECIOS/PAQUETES vs LANZAR */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <p className="text-xs text-zinc-400">
                  {isStandardMode
                    ? '¿Querés ajustar precios, paquetes 2x/3x o algún bono antes de publicar? Usá "Editar precios, paquetes o datos". Si está todo bien, tocá "Lanzar Página Estándar" para generar y publicar ahora.'
                    : '¿Querés cambiar precios, paquetes o la oferta gancho? Usá "Editar precios, paquetes o gancho". Si está todo listo, tocá "Lanzar Página Tripwire" para generar ambas ofertas en la página.'}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    data-testid="wizard-edit-before-launch"
                    onClick={() => {
                      if (isTripwireMode && clonedFrom) setShowPrincipalEditInTripwire(true);
                      setWizardStep(3);
                    }}
                    disabled={creating}
                    className="px-5 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-xs sm:text-sm font-semibold text-zinc-100 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Edit3 className="w-4 h-4 text-[#e5c88b]" />
                    <span>
                      {isStandardMode
                        ? 'Editar precios, paquetes o datos'
                        : 'Editar precios, paquetes o gancho'}
                    </span>
                  </button>

                  <button
                    type="submit"
                    data-testid="quick-creator-submit-btn"
                    disabled={creating || (loadingStrategy && !aiStrategy)}
                    className="px-7 py-3.5 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creando y publicando tu página con GPT-2.6...</span>
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4" />
                        <span>
                          {isStandardMode
                            ? 'Lanzar Página Estándar (GPT-2.6)'
                            : 'Lanzar Página Tripwire (GPT-2.6)'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
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
