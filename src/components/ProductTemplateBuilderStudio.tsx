import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Wand2,
  Search,
  Check,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  Upload,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Radio,
  Eye,
  CheckCircle2,
  Truck,
  ShieldCheck,
  Zap,
  ShoppingBag,
  ExternalLink,
  Flame,
  Layers,
  Wrench,
  Utensils,
  Dumbbell,
  HeartPulse,
  Sparkle,
  Car,
  Shield,
  Smartphone,
  Compass,
  X,
  Camera,
  Send,
  Bot,
  RefreshCw,
  MessageSquare,
  Phone,
  Package,
  Tag,
  Palette,
  CheckCircle,
  HelpCircle,
  Clock,
  Play
} from 'lucide-react';
import { ProductPage, ProductPhysicalTruth, ProductThemeConfig } from '../types';
import {
  NICHE_CATEGORIES,
  SUBNICHE_TEMPLATES,
  SubNicheTemplateDef,
  calculateCodEconomicsParaguay,
  buildAutoTrainedAgentBrain,
  synthesizeCompleteLandingContent,
  applyCodingAgentInstructionToDraft
} from '../data/productTemplatesCatalog';
import { DEFAULT_META_TRACKING_CONFIG } from '../utils/metaPixelEngine';
import { executeDeepseekHarnessOnDraft } from '../services/deepseekHarnessEngine';
import { formatGs, formatWaPhone } from '../config';
import { ensureProductHasMandatoryTripwire } from '../data/noeluxVisualPreset';

export interface ProductTemplateBuilderStudioProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialProduct?: ProductPage | null;
  defaultWaNumber: string;
  availableVoices: Array<{ id: string; name: string; accent?: string }>;
  onSaveProductPage: (newOrUpdatedPage: ProductPage, openPreviewAfterSave?: boolean) => Promise<void>;
  embeddedInView?: boolean;
}

export type StudioStepId = 'catalogo' | 'editor';

export interface AgentChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  timestamp: string;
  appliedChanges?: string[];
  usedEngine?: string;
}

function cleanText(raw: string): string {
  return raw
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const ProductTemplateBuilderStudio: React.FC<ProductTemplateBuilderStudioProps> = ({
  isOpen = true,
  onClose,
  initialProduct,
  defaultWaNumber,
  availableVoices,
  onSaveProductPage,
  embeddedInView = false
}) => {
  // Navigation step: if editing existing product, land directly in DeepSeek real-time editor
  const [activeStep, setActiveStep] = useState<StudioStepId>(initialProduct ? 'editor' : 'catalogo');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [templateSearchQuery, setTemplateSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // Selected template
  const defaultTemplate = useMemo(() => {
    if (initialProduct?.templateId) {
      return SUBNICHE_TEMPLATES.find(t => t.id === initialProduct.templateId) || SUBNICHE_TEMPLATES[0];
    }
    return SUBNICHE_TEMPLATES[1] || SUBNICHE_TEMPLATES[0];
  }, [initialProduct]);

  const [selectedTemplate, setSelectedTemplate] = useState<SubNicheTemplateDef>(defaultTemplate);

  // Selector del tipo de página a crear: Dual (Tripwire + Ganador) vs Solo Producto Principal
  const [templateCreationMode, setTemplateCreationMode] = useState<'dual_tripwire_winner' | 'principal_only'>(
    initialProduct && !initialProduct.tripwireConfig?.enabled ? 'principal_only' : 'dual_tripwire_winner'
  );
  const [quickAutopilotQuery, setQuickAutopilotQuery] = useState<string>('');
  const [quickAutopilotPhoto, setQuickAutopilotPhoto] = useState<string>('');
  const [quickWinnerDesc, setQuickWinnerDesc] = useState<string>('');
  const [quickWinnerAngle, setQuickWinnerAngle] = useState<string>('');
  const [quickWinnerPrice1, setQuickWinnerPrice1] = useState<number>(189000);
  const [quickTripwireName, setQuickTripwireName] = useState<string>('');
  const [quickTripwireDesc, setQuickTripwireDesc] = useState<string>('');
  const [quickTripwirePrice, setQuickTripwirePrice] = useState<number>(20000);
  const [quickTripwireDelivery, setQuickTripwireDelivery] = useState<number>(40000);
  const [quickTripwirePhoto, setQuickTripwirePhoto] = useState<string>('');
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);

  // Audio / Speech State for the AI Interview Agent & Portavoz
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isListeningMic, setIsListeningMic] = useState<boolean>(false);
  const [spokenTranscript, setSpokenTranscript] = useState<string>('');

  // -------------------------------------------------------------
  // REAL-TIME DEEPSEEK CODING AGENT & PORTAVOZ STATE
  // -------------------------------------------------------------
  const [liveDraft, setLiveDraft] = useState<ProductPage>(() => {
    if (initialProduct) return initialProduct;
    // Build initial draft from selected template
    const prices: Record<number, number> = {
      1: selectedTemplate.defaultPricePack1,
      2: Math.round(selectedTemplate.defaultPricePack1 * 1.84 / 1000) * 1000,
      3: Math.round(selectedTemplate.defaultPricePack1 * 2.58 / 1000) * 1000
    };
    const truth = { ...selectedTemplate.defaultPhysicalTruth };
    const landing = synthesizeCompleteLandingContent({
      productName: selectedTemplate.idealForProducts[0] || cleanText(selectedTemplate.name),
      productDescription: selectedTemplate.winnerAngleHook,
      mainImage: selectedTemplate.previewImage || '/assets/real/galeria-1.jpg',
      prices,
      normalPrice: selectedTemplate.defaultNormalPrice,
      physicalTruth: truth,
      template: selectedTemplate,
      freeShipping: true,
      shippingCostGs: 25000
    });
    const { agentBrain, contextoIA } = buildAutoTrainedAgentBrain({
      productName: selectedTemplate.idealForProducts[0] || cleanText(selectedTemplate.name),
      productDescription: selectedTemplate.winnerAngleHook,
      prices,
      physicalTruth: truth,
      template: selectedTemplate,
      upsellPack2Enabled: true,
      freeShipping: true,
      shippingCostGs: 25000
    });

    return ensureProductHasMandatoryTripwire({
      id: `prod-${Date.now()}`,
      slug: (selectedTemplate.idealForProducts[0] || cleanText(selectedTemplate.name))
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
      nombre: selectedTemplate.idealForProducts[0] || cleanText(selectedTemplate.name),
      descripcion: selectedTemplate.winnerAngleHook,
      imagen: selectedTemplate.previewImage || '/assets/real/galeria-1.jpg',
      precios: prices,
      precioNormal: selectedTemplate.defaultNormalPrice,
      wa: defaultWaNumber || '595973532550',
      waNotificacionesVendedor: defaultWaNumber || '595973532550',
      activo: true,
      creadoEn: new Date().toISOString(),
      templateId: selectedTemplate.id,
      themeConfig: selectedTemplate.theme,
      physicalTruth: truth,
      landingContent: landing,
      agentBrain: agentBrain,
      contextoIA: contextoIA,
      vozAgente: 'deepgram-estrella',
      agentMode: 'automatico',
      canalIA: 'audio',
      freeShipping: true,
      shippingCostGs: 25000
    });
  });

  const [chatHistory, setChatHistory] = useState<AgentChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      text: `Hola, soy tu Agente Portavoz con DeepSeek Harness (github.com/deepseek-ai/deepseek-harness). Estoy conectado en vivo con la arquitectura de "${liveDraft.nombre}". Cualquier cambio que me pidas por voz o texto (colores, emblemas de calidad, precios, contenido de caja o voz del agente) lo aplico inmediatamente en tiempo real.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      usedEngine: 'DeepSeek Harness · Cordis Kernel'
    }
  ]);
  const [userInputInstruction, setUserInputInstruction] = useState<string>('');
  const [isCodingAgentWorking, setIsCodingAgentWorking] = useState<boolean>(false);
  const [codingNotice, setCodingNotice] = useState<string | null>(null);
  const [savingChangesToDb, setSavingChangesToDb] = useState<boolean>(false);

  // Success modal after 1-click synthesis
  const [publishSuccessModal, setPublishSuccessModal] = useState<{
    open: boolean;
    createdPage: ProductPage | null;
  }>({
    open: false,
    createdPage: null
  });

  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, codingNotice]);

  // Speech Synthesis Helper
  const speakText = (text: string) => {
    if (!audioEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText(text));
      utterance.lang = 'es-PY';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  };

  // Speech Recognition (Mic to Text)
  const toggleMicrophone = () => {
    if (typeof window === 'undefined') return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta entrada de voz directa. Podés escribir en el chat.');
      return;
    }

    if (isListeningMic) {
      setIsListeningMic(false);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRecognition as any)();
      recognition.lang = 'es-PY';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListeningMic(true);
        setSpokenTranscript('Escuchando...');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSpokenTranscript(transcript);
        setIsListeningMic(false);

        if (activeStep === 'editor') {
          handleSendInstructionToCodingAgent(transcript);
        } else {
          setQuickAutopilotQuery(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListeningMic(false);
      };

      recognition.onend = () => {
        setIsListeningMic(false);
      };

      recognition.start();
    } catch {
      setIsListeningMic(false);
    }
  };

  // -----------------------------------------------------------------
  // 1-CLICK MASTER AUTOPILOT: Creates complete high-converting page
  // -----------------------------------------------------------------
  const handleLaunchAutopilot = async (
    targetTemplate: SubNicheTemplateDef,
    customTitle?: string,
    customImage?: string
  ) => {
    if (isSynthesizing) return;
    setIsSynthesizing(true);

    try {
      setSelectedTemplate(targetTemplate);

      const resolvedTitle =
        (customTitle || quickAutopilotQuery).trim() ||
        targetTemplate.idealForProducts[0] ||
        cleanText(targetTemplate.name);

      const resolvedImage =
        (customImage || quickAutopilotPhoto).trim() ||
        targetTemplate.previewImage ||
        '/assets/real/galeria-1.jpg';

      const slug =
        resolvedTitle
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || `producto-${Date.now()}`;

      // Calculate psychological 9.000 Gs ladder
      const p1 = quickAutopilotQuery.trim() && quickWinnerPrice1 >= 35000
        ? quickWinnerPrice1
        : targetTemplate.defaultPricePack1;
      const rawP2 = Math.round(p1 * 1.84);
      const p2 = Math.ceil(rawP2 / 10000) * 10000 - 1000;
      const rawP3 = Math.round(p1 * 2.58);
      const p3 = Math.ceil(rawP3 / 10000) * 10000 - 1000;

      const prices: Record<number, number> = {
        1: p1,
        2: p2,
        3: p3
      };

      const winnerDesc = quickWinnerDesc.trim() || targetTemplate.winnerAngleHook;
      const winnerAngleVal =
        quickWinnerAngle.trim() ||
        `Solución completa superior para ${resolvedTitle}`;

      const truth: ProductPhysicalTruth = {
        ...targetTemplate.defaultPhysicalTruth
      };

      const landingContent = synthesizeCompleteLandingContent({
        productName: resolvedTitle,
        productDescription: winnerDesc,
        mainImage: resolvedImage,
        prices,
        normalPrice: Math.max(targetTemplate.defaultNormalPrice, Math.round(p1 * 1.3)),
        physicalTruth: truth,
        template: targetTemplate,
        freeShipping: true,
        shippingCostGs: 25000
      });

      const { agentBrain, contextoIA } = buildAutoTrainedAgentBrain({
        productName: resolvedTitle,
        productDescription: winnerDesc,
        prices,
        physicalTruth: truth,
        template: targetTemplate,
        upsellPack2Enabled: true,
        freeShipping: true,
        shippingCostGs: 25000
      });

      const resolvedTripwireName =
        quickTripwireName.trim() ||
        `Complemento Esencial para ${resolvedTitle.split(/\s+/).slice(0, 3).join(' ')}`;
      const resolvedTripwirePrice = Math.max(5000, Number(quickTripwirePrice) || 20000);
      const resolvedTripwireDelivery = Math.max(10000, Number(quickTripwireDelivery) || 40000);
      const resolvedTripwireImg = quickTripwirePhoto.trim() || resolvedImage;

      const basePage: ProductPage = {
        id: `prod-${Date.now()}`,
        slug,
        nombre: resolvedTitle,
        descripcion: winnerDesc,
        winnerAngle: winnerAngleVal,
        imagen: resolvedImage,
        precios: prices,
        precioNormal: Math.max(targetTemplate.defaultNormalPrice, Math.round(p1 * 1.3)),
        wa: defaultWaNumber || '595973532550',
        waNotificacionesVendedor: defaultWaNumber || '595973532550',
        activo: true,
        creadoEn: new Date().toISOString(),
        templateId: targetTemplate.id,
        themeConfig: targetTemplate.theme,
        physicalTruth: truth,
        landingContent,
        agentBrain,
        contextoIA,
        vozAgente: 'deepgram-estrella',
        agentMode: 'automatico',
        canalIA: 'audio',
        ...(templateCreationMode === 'dual_tripwire_winner'
          ? {
              tripwireConfig: {
                enabled: true,
                entryProductName: resolvedTripwireName,
                entryProductDescription:
                  quickTripwireDesc.trim() ||
                  `Artículo de entrada accesible compatible con ${resolvedTitle}.`,
                entryPriceGs: resolvedTripwirePrice,
                entryNormalPriceGs: Math.round(resolvedTripwirePrice * 2.2),
                deliveryFeeGs: resolvedTripwireDelivery,
                entryProductImage: resolvedTripwireImg,
                entryImageUrl: resolvedTripwireImg,
                eventDurationHours: 6,
                slotsTotal: 10,
                instantDiscountPercent: 12,
                backgroundMusicPreset: 'warm_ambient',
                entryOnlyClarification: `Incluye únicamente 1x ${resolvedTripwireName}. No incluye ${resolvedTitle} ni envío gratis por separado.`,
                principalBundleClarification: `Incluye ${resolvedTitle} + ${resolvedTripwireName} de regalo + Envío Gratis sin esperar evento.`
              }
            }
          : {}),
        metaTracking: {
          ...DEFAULT_META_TRACKING_CONFIG,
          pixelId: '',
          capiAccessToken: '',
          capiServerEnabled: false
        },
        freeShipping: true,
        shippingCostGs: 25000
      };

      const newPage: ProductPage =
        templateCreationMode === 'dual_tripwire_winner'
          ? ensureProductHasMandatoryTripwire(basePage)
          : basePage;

      await onSaveProductPage(newPage, false);
      setLiveDraft(newPage);
      setIsSynthesizing(false);
      setPublishSuccessModal({
        open: true,
        createdPage: newPage
      });

      speakText(`¡Página para ${resolvedTitle} creada y publicada en 1 clic! Ya podés verla en vivo o refinarla conmigo.`);
    } catch {
      setIsSynthesizing(false);
      alert('Ocurrió un inconveniente al guardar. Por favor, reintentá con un clic.');
    }
  };

  // -----------------------------------------------------------------
  // OPEN LIVE EDITOR DIRECTLY FOR A TEMPLATE
  // -----------------------------------------------------------------
  const handleOpenEditorForTemplate = (targetTemplate: SubNicheTemplateDef) => {
    setSelectedTemplate(targetTemplate);

    const resolvedTitle =
      targetTemplate.idealForProducts[0] || cleanText(targetTemplate.name);

    const prices: Record<number, number> = {
      1: targetTemplate.defaultPricePack1,
      2: Math.round(targetTemplate.defaultPricePack1 * 1.84 / 1000) * 1000,
      3: Math.round(targetTemplate.defaultPricePack1 * 2.58 / 1000) * 1000
    };

    const truth = { ...targetTemplate.defaultPhysicalTruth };
    const landing = synthesizeCompleteLandingContent({
      productName: resolvedTitle,
      productDescription: targetTemplate.winnerAngleHook,
      mainImage: targetTemplate.previewImage,
      prices,
      normalPrice: targetTemplate.defaultNormalPrice,
      physicalTruth: truth,
      template: targetTemplate,
      freeShipping: true,
      shippingCostGs: 25000
    });

    const { agentBrain, contextoIA } = buildAutoTrainedAgentBrain({
      productName: resolvedTitle,
      productDescription: targetTemplate.winnerAngleHook,
      prices,
      physicalTruth: truth,
      template: targetTemplate,
      upsellPack2Enabled: true,
      freeShipping: true,
      shippingCostGs: 25000
    });

    const rawDraftPage: ProductPage = {
      id: `prod-${Date.now()}`,
      slug: resolvedTitle
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
      nombre: resolvedTitle,
      descripcion: targetTemplate.winnerAngleHook,
      imagen: targetTemplate.previewImage,
      precios: prices,
      precioNormal: targetTemplate.defaultNormalPrice,
      wa: defaultWaNumber || '595973532550',
      waNotificacionesVendedor: defaultWaNumber || '595973532550',
      activo: true,
      creadoEn: new Date().toISOString(),
      templateId: targetTemplate.id,
      themeConfig: targetTemplate.theme,
      physicalTruth: truth,
      landingContent: landing,
      agentBrain,
      contextoIA,
      vozAgente: 'deepgram-estrella',
      agentMode: 'automatico',
      canalIA: 'audio',
      freeShipping: true,
      shippingCostGs: 25000
    };

    const draftPage: ProductPage =
      templateCreationMode === 'dual_tripwire_winner'
        ? ensureProductHasMandatoryTripwire(rawDraftPage)
        : rawDraftPage;

    setLiveDraft(draftPage);
    setActiveStep('editor');
    speakText(`Abriendo editor en vivo con DeepSeek Harness para ${resolvedTitle}. Podés indicarme qué cambiar.`);
  };

  // -----------------------------------------------------------------
  // REAL-TIME DEEPSEEK CODING AGENT INSTRUCTION HANDLER
  // -----------------------------------------------------------------
  const handleSendInstructionToCodingAgent = async (instructionRaw?: string) => {
    const instruction = (instructionRaw || userInputInstruction).trim();
    if (!instruction || isCodingAgentWorking) return;

    setUserInputInstruction('');

    // Append user message
    const userMsg: AgentChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: instruction,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatHistory(prev => [...prev, userMsg]);
    setIsCodingAgentWorking(true);
    setCodingNotice('DeepSeek Harness (github.com/deepseek-ai/deepseek-harness) ejecutando plugins Cordis...');

    try {
      // 1. Check if user just said "okay", "me gusta", "guardar"
      const lower = instruction.toLowerCase();
      if (
        lower === 'okay' ||
        lower === 'ok' ||
        lower === 'me gusta' ||
        lower === 'guardar' ||
        lower === 'listo' ||
        lower === 'perfecto'
      ) {
        await handleSealAndSaveFinalProduct();
        setIsCodingAgentWorking(false);
        setCodingNotice(null);
        return;
      }

      // 2. Call backend endpoint POST /api/builder/coding-agent (DeepSeek Harness)
      let aiExplanation = '';
      let usedEngine = 'DeepSeek Harness (Cordis Kernel)';

      try {
        const resp = await fetch('/api/builder/coding-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction,
            currentDraft: liveDraft,
            model: 'z-ai/glm-5.3-flash'
          })
        });
        if (resp.ok) {
          const resJson = await resp.json();
          if (resJson.success) {
            aiExplanation = resJson.aiExplanation;
            if (resJson.usedEngine) usedEngine = resJson.usedEngine;
          }
        }
      } catch {
        // Fallback continues with DSH Cordis local kernel
      }

      // 3. Execute DeepSeek Harness (DSH) Cordis Plugin Tree
      const dshResult = executeDeepseekHarnessOnDraft({
        instruction,
        currentDraft: liveDraft
      });

      // Update live draft state in real time with DSH result
      setLiveDraft(dshResult.updatedDraft);

      // Construct empathetic Agente Portavoz response
      const spokespersonResponse =
        aiExplanation ||
        `¡Listo! DeepSeek Harness aplicó los cambios mediante sus plugins Cordis:\n${dshResult.appliedEffects.map(c => `• [${c.name}]: ${c.description}`).join('\n')}\n¿Querés hacer algún otro ajuste o te parece que ya quedó perfecto?`;

      const botMsg: AgentChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: spokespersonResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        appliedChanges: dshResult.appliedEffects.map(e => e.description),
        usedEngine: dshResult.dshFramework
      };

      setChatHistory(prev => [...prev, botMsg]);
      speakText(spokespersonResponse.replace(/•.*$/gm, ''));
    } catch {
      const errorMsg: AgentChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: 'Hubo un inconveniente al procesar esa instrucción. Por favor, reintentá o decime qué querés cambiar.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsCodingAgentWorking(false);
      setCodingNotice(null);
    }
  };

  // -----------------------------------------------------------------
  // SEAL & SAVE FINAL PRODUCT TO DATABASE (DAR EL OK)
  // -----------------------------------------------------------------
  const handleSealAndSaveFinalProduct = async () => {
    if (savingChangesToDb) return;
    setSavingChangesToDb(true);

    try {
      const sealedDraft =
        liveDraft.tripwireConfig?.enabled ||
        (templateCreationMode === 'dual_tripwire_winner' && liveDraft.id !== 'prod-noelux-01')
          ? ensureProductHasMandatoryTripwire(liveDraft)
          : { ...liveDraft, tripwireConfig: undefined };
      await onSaveProductPage(sealedDraft, false);
      const sealMsg: AgentChatMessage = {
        id: `seal-${Date.now()}`,
        role: 'assistant',
        text: `✓ ¡Excelente! He sellado todas las modificaciones de "${liveDraft.nombre}" en la base de datos de tu tienda. La página está 100% activa.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        usedEngine: 'Persistencia Oficial en Base de Datos'
      };
      setChatHistory(prev => [...prev, sealMsg]);
      speakText(`¡Excelente! Todos los cambios han quedado sellados y guardados en la base de datos.`);
    } catch {
      alert('Error al guardar en la base de datos. Por favor intentá de nuevo.');
    } finally {
      setSavingChangesToDb(false);
    }
  };

  // Helper for Archetype Visual Badge
  const getArchetypeBadge = (tpl: SubNicheTemplateDef) => {
    const arch = tpl.theme.layoutArchetype || 'noelux-classic';
    if (arch === 'brutalist-industrial') {
      return (
        <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-[#0b0e16]/90 text-[#e5c88b] border border-[#e5c88b]/30 rounded-md">
          INDUSTRIAL PESADO
        </span>
      );
    }
    if (arch === 'minimalist-luxury') {
      return (
        <span className="px-2 py-0.5 text-[10px] font-serif uppercase tracking-widest bg-[#0b0e16]/90 text-stone-200 border border-white/15 rounded-md">
          LUJO EDITORIAL
        </span>
      );
    }
    if (arch === 'warm-culinary') {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#0b0e16]/90 text-amber-200 border border-white/15 rounded-md">
          COCINA GOURMET
        </span>
      );
    }
    if (arch === 'athletic-performance') {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#0b0e16]/90 text-emerald-300 border border-white/15 rounded-md">
          PERFORMANCE FITNESS
        </span>
      );
    }
    if (arch === 'nordic-clinical') {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#0b0e16]/90 text-zinc-200 border border-white/15 rounded-md">
          CLÍNICO ORTOPÉDICO
        </span>
      );
    }
    if (arch === 'futuristic-cyber') {
      return (
        <span className="px-2 py-0.5 text-[10px] font-mono bg-[#0b0e16]/90 text-zinc-200 border border-white/15 rounded-md">
          CYBER GADGET
        </span>
      );
    }
    if (arch === 'natural-organic') {
      return (
        <span className="px-2 py-0.5 text-[10px] font-medium bg-[#0b0e16]/90 text-emerald-200 border border-white/15 rounded-md">
          BOTÁNICO ORGÁNICO
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#0b0e16]/90 text-[#e5c88b] border border-[#e5c88b]/30 rounded-md">
        NOELUX CLÁSICO
      </span>
    );
  };

  // Filter templates by category and search
  const filteredTemplates = useMemo(() => {
    return SUBNICHE_TEMPLATES.filter(tpl => {
      const matchesCat =
        selectedCategoryFilter === 'all' ||
        (selectedCategoryFilter === 'niche-original' && tpl.nicheId === 'niche-original') ||
        tpl.nicheId === selectedCategoryFilter;

      if (!matchesCat) return false;

      if (!templateSearchQuery.trim()) return true;

      const q = templateSearchQuery.toLowerCase();
      return (
        tpl.name.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q) ||
        tpl.subNicheLabel.toLowerCase().includes(q) ||
        tpl.idealForProducts.some(p => p.toLowerCase().includes(q))
      );
    });
  }, [selectedCategoryFilter, templateSearchQuery]);

  const totalTemplatePages = Math.ceil(filteredTemplates.length / itemsPerPage);
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalTemplatePages));
  const paginatedTemplates = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredTemplates.slice(start, start + itemsPerPage);
  }, [filteredTemplates, safeCurrentPage]);

  if (!isOpen) return null;

  return (
    <div
      className={
        embeddedInView
          ? 'w-full space-y-6 text-zinc-100'
          : 'fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto'
      }
    >
      <div
        className={
          embeddedInView
            ? 'w-full bg-[#0b0e16]/80 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col'
            : 'w-full max-w-7xl bg-[#0b0e16]/95 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]'
        }
      >
        <header className="px-5 py-3.5 border-b border-white/10 bg-[#07090f]/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[#e5c88b] font-mono text-base font-bold">▲</span>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="text-zinc-500">studio</span>
              <span>/</span>
              <span className="text-white font-medium">autopiloto-cod</span>
              {initialProduct && (
                <>
                  <span>/</span>
                  <span className="text-[#e5c88b] font-semibold">{initialProduct.nombre}</span>
                </>
              )}
            </div>
            <a
              href="https://github.com/deepseek-ai/deepseek-harness"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-mono bg-white/[0.04] text-zinc-300 hover:text-white border border-white/10 rounded-md transition-colors"
            >
              deepseek-ai/deepseek-harness
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                const next = !audioEnabled;
                setAudioEnabled(next);
                if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                }
              }}
              className={`p-2 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                audioEnabled
                  ? 'bg-white/[0.05] border-white/10 text-zinc-200 hover:bg-white/[0.1]'
                  : 'bg-[#06080d] border-white/10 text-zinc-500 hover:text-zinc-300'
              }`}
              title={audioEnabled ? 'Voz del Agente Activada' : 'Voz Silenciada'}
            >
              {audioEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-[#e5c88b]" />
                  <span className="hidden sm:inline text-[11px]">Voz IA Activa</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="hidden sm:inline text-[11px]">Voz Silenciada</span>
                </>
              )}
            </button>

            <div className="flex items-center bg-[#06080d] border border-white/10 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveStep('catalogo')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeStep === 'catalogo'
                    ? 'bg-white/[0.1] border border-[#e5c88b]/40 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-[#e5c88b]" />
                <span className="font-mono tabular-nums">1. Catálogo Autopiloto ({SUBNICHE_TEMPLATES.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStep('editor')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeStep === 'editor'
                    ? 'bg-white/[0.1] border border-[#e5c88b]/40 text-[#e5c88b] font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-[#e5c88b]" />
                <span>2. Editor en Vivo (DeepSeek Harness)</span>
              </button>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 text-zinc-400 hover:text-white cursor-pointer"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* TAB 1: CATÁLOGO */}
        {activeStep === 'catalogo' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#07090f]/80 border border-white/10 space-y-4">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                    {templateCreationMode === 'principal_only'
                      ? 'Lanzador Directo: Exclusivamente Producto Principal'
                      : 'Lanzador Dual: Página Tripwire + Producto Ganador (Misma Página)'}
                  </h2>
                  <p className="text-xs text-zinc-400">
                    {templateCreationMode === 'principal_only'
                      ? 'Creá una página enfocada 100% en tu Producto Principal (sin Tripwire) para tus campañas estándar normales.'
                      : 'Creá en un paso tu bloque Tripwire (Entrada) y tu bloque Producto Ganador (Ángulo Diferente) dentro de la misma página.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-end">
                  <div className="inline-flex rounded-xl bg-[#06080d] border border-white/10 p-1 text-[11px]">
                    <button
                      type="button"
                      data-testid="studio-mode-dual"
                      onClick={() => setTemplateCreationMode('dual_tripwire_winner')}
                      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                        templateCreationMode === 'dual_tripwire_winner'
                          ? 'bg-[#e5c88b] text-[#090b10]'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Dual (Tripwire + Ganador)
                    </button>
                    <button
                      type="button"
                      data-testid="studio-mode-principal"
                      onClick={() => setTemplateCreationMode('principal_only')}
                      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                        templateCreationMode === 'principal_only'
                          ? 'bg-white text-[#090b10]'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Solo Producto Principal
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={isSynthesizing}
                    onClick={() => handleLaunchAutopilot(selectedTemplate, quickAutopilotQuery)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    <Wand2 className="w-4 h-4" />
                    <span>
                      {isSynthesizing
                        ? 'Publicando...'
                        : templateCreationMode === 'principal_only'
                          ? 'Lanzar Producto Principal (1-Clic)'
                          : 'Lanzar Página Dual (1-Clic)'}
                    </span>
                  </button>
                </div>
              </div>

              <div
                className={`grid grid-cols-1 ${
                  templateCreationMode === 'dual_tripwire_winner' ? 'lg:grid-cols-2' : ''
                } gap-3.5`}
              >
                {templateCreationMode === 'dual_tripwire_winner' && (
                <div className="p-3.5 rounded-xl bg-[#0b0e16]/80 border border-[#e5c88b]/25 space-y-2.5">
                  <span className="inline-block px-2 py-0.5 rounded bg-[#e5c88b]/15 border border-[#e5c88b]/30 text-[#e5c88b] text-[10px] font-semibold uppercase tracking-wider">
                    ESTE ES PARA PÁGINA TRIPWIRE (ENTRADA)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={quickTripwireName}
                      onChange={e => setQuickTripwireName(e.target.value)}
                      placeholder="Nombre Tripwire (ej: Guirnalda LED 10m)"
                      className="sm:col-span-2 bg-[#06080d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#e5c88b]/60"
                    />
                    <input
                      type="number"
                      min={5000}
                      step={1000}
                      value={quickTripwirePrice}
                      onChange={e => setQuickTripwirePrice(Number(e.target.value) || 20000)}
                      placeholder="Gs. 20000"
                      className="bg-[#06080d] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-[#e5c88b] outline-none focus:border-[#e5c88b]/60"
                    />
                  </div>
                  <input
                    type="text"
                    value={quickTripwireDesc}
                    onChange={e => setQuickTripwireDesc(e.target.value)}
                    placeholder="Descripción Tripwire (medidas, qué incluye)"
                    className="w-full bg-[#06080d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#e5c88b]/60"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={quickTripwirePhoto}
                      onChange={e => setQuickTripwirePhoto(e.target.value)}
                      placeholder="URL Foto Tripwire"
                      className="bg-[#06080d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#e5c88b]/60"
                    />
                    <input
                      type="number"
                      min={10000}
                      step={5000}
                      value={quickTripwireDelivery}
                      onChange={e => setQuickTripwireDelivery(Number(e.target.value) || 40000)}
                      placeholder="Delivery Gs."
                      className="bg-[#06080d] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-zinc-300 outline-none focus:border-[#e5c88b]/60"
                    />
                  </div>
                </div>
                )}

                <div className="p-3.5 rounded-xl bg-[#0b0e16]/80 border border-white/10 space-y-2.5">
                  <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold uppercase tracking-wider">
                    {templateCreationMode === 'principal_only'
                      ? 'ESTE ES EXCLUSIVAMENTE PARA PÁGINA DE PRODUCTO PRINCIPAL'
                      : 'ESTE VA A SER PARA PÁGINA PRODUCTO GANADOR (ÁNGULO DIFERENTE)'}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={quickAutopilotQuery}
                      onChange={e => setQuickAutopilotQuery(e.target.value)}
                      placeholder="Producto Ganador (ej: Freidora 6L)"
                      className="sm:col-span-2 bg-[#06080d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#e5c88b]/60"
                    />
                    <input
                      type="number"
                      min={35000}
                      step={1000}
                      value={quickWinnerPrice1}
                      onChange={e => setQuickWinnerPrice1(Number(e.target.value) || 189000)}
                      placeholder="Gs. 189000"
                      className="bg-[#06080d] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-emerald-300 outline-none focus:border-[#e5c88b]/60"
                    />
                  </div>
                  <input
                    type="text"
                    value={quickWinnerAngle}
                    onChange={e => setQuickWinnerAngle(e.target.value)}
                    placeholder="Ángulo diferente del Producto Ganador en esta misma página"
                    className="w-full bg-[#06080d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#e5c88b]/60"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={quickAutopilotPhoto}
                      onChange={e => setQuickAutopilotPhoto(e.target.value)}
                      placeholder="URL Foto Producto Ganador"
                      className="bg-[#06080d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#e5c88b]/60"
                    />
                    <input
                      type="text"
                      value={quickWinnerDesc}
                      onChange={e => setQuickWinnerDesc(e.target.value)}
                      placeholder="Descripción / beneficios clave"
                      className="bg-[#06080d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#e5c88b]/60"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
                {NICHE_CATEGORIES.map(cat => {
                  const isSelected = selectedCategoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategoryFilter(cat.id);
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#e5c88b] text-[#090b10] font-bold'
                          : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08] border border-white/10'
                      }`}
                    >
                      <span>{cat.shortName}</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-60 shrink-0">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={templateSearchQuery}
                  onChange={e => {
                    setTemplateSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Buscar en catálogo..."
                  className="w-full bg-[#07090f]/80 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#e5c88b]/60"
                />
              </div>
            </div>

            {/* Grid of Templates */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {paginatedTemplates.map(tpl => {
                const isCurrent = selectedTemplate.id === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden group ${
                      isCurrent
                        ? 'bg-[#07090f] border-[#e5c88b]/50 ring-1 ring-[#e5c88b]/30 shadow-lg'
                        : 'bg-[#07090f]/80 border-white/10 hover:border-[#e5c88b]/30'
                    }`}
                  >
                    <div className="relative aspect-video w-full bg-black overflow-hidden border-b border-white/10">
                      <img
                        src={tpl.previewImage}
                        alt={tpl.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1">
                        {getArchetypeBadge(tpl)}
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] font-mono tabular-nums text-[#e5c88b] border border-white/15">
                        {tpl.conversionRateAvg}
                      </div>
                    </div>

                    <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">
                          {tpl.subNicheLabel}
                        </span>
                        <h3 className="text-sm font-semibold text-white leading-tight">
                          {tpl.name}
                        </h3>
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                          {tpl.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                          <span className="text-zinc-500">Precio Sugerido:</span>
                          <span className="text-[#e5c88b] font-semibold">
                            {formatGs(tpl.defaultPricePack1)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <button
                            type="button"
                            disabled={isSynthesizing}
                            onClick={() => handleLaunchAutopilot(tpl)}
                            className="w-full py-2 px-2 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95"
                            title="Genera y publica la página inmediatamente sin preguntas"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Autopiloto</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditorForTemplate(tpl)}
                            className="w-full py-2 px-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 hover:text-white text-xs font-medium flex items-center justify-center gap-1 border border-white/10 transition-all cursor-pointer"
                            title="Abre la maqueta interactiva y el Portavoz IA con DeepSeek Harness"
                          >
                            <Bot className="w-3.5 h-3.5 text-[#e5c88b]" />
                            <span>Refinar IA</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalTemplatePages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-zinc-400">
                <span className="font-mono tabular-nums">
                  Página {safeCurrentPage} de {totalTemplatePages} ({filteredTemplates.length} plantillas)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={safeCurrentPage >= totalTemplatePages}
                    onClick={() => setCurrentPage(prev => Math.min(totalTemplatePages, prev + 1))}
                    className="p-1.5 rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: EDITOR EN TIEMPO REAL */}
        {activeStep === 'editor' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT: Agente Portavoz IA & Consola DeepSeek Harness */}
              <div className="lg:col-span-7 flex flex-col h-[75vh] bg-[#07090f]/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 bg-[#0b0e16]/90 border-b border-white/10 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl bg-[#e5c88b]/10 border border-[#e5c88b]/30 flex items-center justify-center text-[#e5c88b]">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">Agente Portavoz IA</h3>
                        <a
                          href="https://github.com/deepseek-ai/deepseek-harness"
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 flex items-center gap-1 transition-colors"
                          title="deepseek-ai/deepseek-harness en GitHub"
                        >
                          DeepSeek Harness (Cordis)
                        </a>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Edición en vivo para: <strong className="text-zinc-200">{liveDraft.nombre}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={savingChangesToDb}
                      onClick={handleSealAndSaveFinalProduct}
                      className="px-3.5 py-1.5 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Dar el OK y guardar en base de datos"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{savingChangesToDb ? 'Guardando...' : 'Dar el OK & Guardar'}</span>
                    </button>
                  </div>
                </div>

                {/* Conversation History Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#06080d]">
                  {chatHistory.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 mb-1 px-1">
                        <span>{msg.role === 'user' ? 'Vos (Dueño)' : 'Agente Portavoz'}</span>
                        <span>·</span>
                        <span>{msg.timestamp}</span>
                        {msg.usedEngine && (
                          <>
                            <span>·</span>
                            <span className="text-[#e5c88b]">{msg.usedEngine}</span>
                          </>
                        )}
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-white/[0.07] text-white border border-white/15'
                            : 'bg-[#0b0e16] text-zinc-200 border border-white/10'
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.text}</p>

                        {msg.appliedChanges && msg.appliedChanges.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1">
                            <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold block">
                              Cambios aplicados en la arquitectura:
                            </span>
                            {msg.appliedChanges.map((change, cIdx) => (
                              <div key={cIdx} className="text-[11px] font-mono text-zinc-300 flex items-center gap-1.5">
                                <span className="text-emerald-400">✓</span> {change}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {codingNotice && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono text-[#e5c88b]">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{codingNotice}</span>
                    </div>
                  )}

                  <div ref={chatMessagesEndRef} />
                </div>

                {/* Quick Recommendation Chips */}
                <div className="p-2.5 bg-[#07090f] border-t border-white/10 overflow-x-auto scrollbar-none flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap px-1">
                    Pedir a DeepSeek:
                  </span>
                  {[
                    'Poné un emblema de CALIDAD PREMIUM 100% PARAGUAY',
                    'Cambiame el diseño a Brutalista Industrial con negro y amarillo',
                    'Cambiame los colores a Lujo Minimalista con dorado y marfil',
                    'Poné que el pack 2 incluye una batería extra de regalo',
                    'Ajustá pack 1 a 199.000 Gs y pack 2 a 329.000 Gs',
                    'Cambiá la forma de botones a cápsula redondeada',
                    'Cambiá la voz del agente a Aura-2 Luna',
                    'La caja incluye maletín rígido y manual oficial'
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isCodingAgentWorking}
                      onClick={() => handleSendInstructionToCodingAgent(chip)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/10 whitespace-nowrap cursor-pointer transition-all shrink-0 disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Input Bar: Audio Mic + Text Prompt */}
                <div className="p-3 bg-[#0b0e16] border-t border-white/10 flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={toggleMicrophone}
                    className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      isListeningMic
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : 'bg-white/[0.05] text-zinc-300 border-white/10 hover:bg-white/[0.1]'
                    }`}
                    title={isListeningMic ? 'Detener micrófono' : 'Hablar por micrófono con el Portavoz'}
                  >
                    {isListeningMic ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <input
                    type="text"
                    value={userInputInstruction}
                    onChange={e => setUserInputInstruction(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendInstructionToCodingAgent();
                      }
                    }}
                    placeholder={
                      isListeningMic
                        ? 'Escuchando tu voz...'
                        : 'Pedile cambios a la IA: "Cambiame de color esto", "Poné un sello", "Ajustá el precio"...'
                    }
                    className="flex-1 bg-[#06080d] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#e5c88b]/60"
                  />

                  <button
                    type="button"
                    disabled={!userInputInstruction.trim() || isCodingAgentWorking}
                    onClick={() => handleSendInstructionToCodingAgent()}
                    className="px-4 py-2 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Enviar</span>
                  </button>
                </div>
              </div>

              {/* RIGHT: Live Interactive Mobile Preview */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[#07090f]/80 border border-white/10 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-[#e5c88b]" />
                      <span className="text-xs font-mono font-semibold text-white">
                        Maqueta Móvil (Reflejada en Vivo)
                      </span>
                    </div>
                    {getArchetypeBadge(
                      SUBNICHE_TEMPLATES.find(t => t.id === liveDraft.templateId) || selectedTemplate
                    )}
                  </div>

                  {/* Simulated Mobile Frame */}
                  <div className="mx-auto max-w-xs w-full bg-[#06080d] rounded-3xl border-4 border-zinc-800 overflow-hidden shadow-2xl relative">
                    <div className="h-4 bg-zinc-900 flex items-center justify-center">
                      <div className="w-16 h-2 bg-zinc-950 rounded-full" />
                    </div>

                    <div
                      className={`p-3 text-center text-xs font-bold ${liveDraft.themeConfig?.topStripBg || 'bg-amber-400 text-black'}`}
                    >
                      {liveDraft.landingContent?.topBarText ||
                        (liveDraft.freeShipping
                          ? 'ENVÍO GRATIS EN PARAGUAY · PAGÁS AL RECIBIR'
                          : 'ENTREGA RÁPIDA · PAGO CONTRA ENTREGA')}
                    </div>

                    <div className="relative aspect-square w-full bg-black overflow-hidden">
                      <img
                        src={liveDraft.imagen}
                        alt={liveDraft.nombre}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />

                      {liveDraft.landingContent?.emblemBadge && (
                        <div className="absolute top-3 left-3 bg-[#e5c88b] text-[#090b10] px-2.5 py-1 rounded-md shadow-lg border border-white/20 flex items-center gap-1.5">
                          <span className="text-[10px] font-black tracking-wider uppercase">
                            {liveDraft.landingContent.emblemBadge.text}
                          </span>
                        </div>
                      )}

                      <div className="absolute bottom-2 left-2 right-2 bg-black/85 backdrop-blur-xs p-2 rounded-xl text-left border border-white/10">
                        <span className="text-[9px] font-mono text-[#e5c88b] block font-bold">
                          {liveDraft.landingContent?.heroBadge || 'EDICIÓN ESPECIAL'}
                        </span>
                        <h4 className="text-xs font-bold text-white truncate">
                          {liveDraft.landingContent?.heroTitle || liveDraft.nombre}
                        </h4>
                        <p className="text-[10px] text-zinc-300 line-clamp-1">
                          {liveDraft.landingContent?.heroHighlight || liveDraft.descripcion}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 space-y-2">
                      <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                        Opciones de Compra Contra Entrega:
                      </div>

                      {[1, 2, 3].map(packNum => {
                        const price = liveDraft.precios[packNum];
                        if (!price) return null;
                        const isPack2 = packNum === 2;
                        return (
                          <div
                            key={packNum}
                            className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                              isPack2
                                ? 'bg-white/[0.06] border-[#e5c88b]/50'
                                : 'bg-white/[0.02] border-white/10'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-white">
                                  {packNum === 1
                                    ? '1 Unidad'
                                    : packNum === 2
                                    ? 'Pack 2 (Llevás 2)'
                                    : 'Pack Familiar (3)'}
                                </span>
                                {isPack2 && (
                                  <span className="px-1.5 py-0.5 bg-[#e5c88b] text-[#090b10] text-[9px] font-bold rounded">
                                    MÁS ELEGIDO
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-400 block">
                                {isPack2
                                  ? liveDraft.landingContent?.packLabels?.[2]?.subtitle || 'Incluye regalo sorpresa'
                                  : 'Pago en efectivo al recibir'}
                              </span>
                            </div>
                            <span className="font-mono tabular-nums font-bold text-[#e5c88b]">
                              {formatGs(price)}
                            </span>
                          </div>
                        );
                      })}

                      <div className="pt-2">
                        <button
                          type="button"
                          className={`w-full py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-[#090b10] bg-[#e5c88b] hover:bg-[#edd49e] shadow-md ${
                            liveDraft.themeConfig?.buttonShape === 'rounded-full'
                              ? 'rounded-full'
                              : liveDraft.themeConfig?.buttonShape === 'rounded-none'
                              ? 'rounded-none'
                              : liveDraft.themeConfig?.buttonShape === 'rounded-lg'
                              ? 'rounded-lg'
                              : 'rounded-xl'
                          }`}
                        >
                          PEDIR AHORA · PAGÁS AL RECIBIR
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Summary Details */}
                  <div className="pt-2 text-[11px] font-mono tabular-nums text-zinc-400 space-y-1 border-t border-white/10">
                    <div>
                      <span className="text-zinc-500">WhatsApp Tienda:</span> +{liveDraft.wa}
                    </div>
                    <div>
                      <span className="text-zinc-500">WhatsApp Avisos:</span> +{liveDraft.waNotificacionesVendedor || liveDraft.wa}
                    </div>
                    <div>
                      <span className="text-zinc-500">Voz Asignada:</span> {liveDraft.vozAgente || 'deepgram-estrella'}
                    </div>
                  </div>
                </div>

                {/* Final Confirmation Button */}
                <button
                  type="button"
                  disabled={savingChangesToDb}
                  onClick={handleSealAndSaveFinalProduct}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {savingChangesToDb
                      ? 'GUARDANDO EN BASE DE DATOS...'
                      : 'DAR EL OK & GUARDAR EN BASE DE DATOS'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SUCCESS PUBLISHED MODAL */}
      {publishSuccessModal.open && publishSuccessModal.createdPage && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0b0e16]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center justify-center mx-auto text-xl font-bold">
              ✓
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">
                ¡Página Publicada con Autopiloto!
              </h3>
              <p className="text-xs text-zinc-400">
                Tu página para <strong className="text-white">{publishSuccessModal.createdPage.nombre}</strong> ya está activa con su diseño exclusivo, precios 9.000 Gs y cerebro de WhatsApp.
              </p>
            </div>

            <div className="p-3 bg-[#07090f] border border-white/10 rounded-xl text-xs font-mono text-[#e5c88b]">
              /?p={publishSuccessModal.createdPage.slug}
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.href = `/?p=${publishSuccessModal.createdPage?.slug}`;
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#e5c88b] text-[#090b10] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#edd49e]"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Ver Tienda en Vivo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPublishSuccessModal({ open: false, createdPage: null });
                  setActiveStep('editor');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
              >
                <Bot className="w-3.5 h-3.5 text-[#e5c88b]" />
                <span>Personalizar con DeepSeek Harness (Portavoz IA)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPublishSuccessModal({ open: false, createdPage: null });
                  if (onClose) onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl text-zinc-400 hover:text-zinc-200 text-xs cursor-pointer"
              >
                Cerrar y volver al panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
