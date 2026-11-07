import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sparkles,
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

  // Autopilot Quick Launcher inputs
  const [quickAutopilotQuery, setQuickAutopilotQuery] = useState<string>('');
  const [quickAutopilotPhoto, setQuickAutopilotPhoto] = useState<string>('');
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

    return {
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
    };
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
      const p1 = targetTemplate.defaultPricePack1;
      const rawP2 = Math.round(p1 * 1.84);
      const p2 = Math.ceil(rawP2 / 10000) * 10000 - 1000;
      const rawP3 = Math.round(p1 * 2.58);
      const p3 = Math.ceil(rawP3 / 10000) * 10000 - 1000;

      const prices: Record<number, number> = {
        1: p1,
        2: p2,
        3: p3
      };

      const truth: ProductPhysicalTruth = {
        ...targetTemplate.defaultPhysicalTruth
      };

      const landingContent = synthesizeCompleteLandingContent({
        productName: resolvedTitle,
        productDescription: targetTemplate.winnerAngleHook,
        mainImage: resolvedImage,
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

      const newPage: ProductPage = {
        id: `prod-${Date.now()}`,
        slug,
        nombre: resolvedTitle,
        descripcion: targetTemplate.winnerAngleHook,
        imagen: resolvedImage,
        precios: prices,
        precioNormal: targetTemplate.defaultNormalPrice,
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
        metaTracking: {
          ...DEFAULT_META_TRACKING_CONFIG,
          pixelId: '',
          capiAccessToken: '',
          capiServerEnabled: false
        },
        freeShipping: true,
        shippingCostGs: 25000
      };

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

    const draftPage: ProductPage = {
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
            model: 'z-ai/glm-5.3'
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
      await onSaveProductPage(liveDraft, false);
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
        <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-400 text-black border border-black rounded-none shadow-xs">
          [INDUSTRIAL PESADO]
        </span>
      );
    }
    if (arch === 'minimalist-luxury') {
      return (
        <span className="px-2.5 py-0.5 text-[10px] font-serif uppercase tracking-widest bg-stone-100 text-stone-900 border border-stone-300 rounded-full">
          LUJO EDITORIAL
        </span>
      );
    }
    if (arch === 'warm-culinary') {
      return (
        <span className="px-2.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-300 rounded-lg">
          🍳 COCINA GOURMET
        </span>
      );
    }
    if (arch === 'athletic-performance') {
      return (
        <span className="px-2.5 py-0.5 text-[10px] font-black uppercase italic bg-lime-400 text-black border border-lime-500 rounded-sm">
          ⚡ PERFORMANCE FITNESS
        </span>
      );
    }
    if (arch === 'nordic-clinical') {
      return (
        <span className="px-2.5 py-0.5 text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300 rounded-md">
          🩺 CLÍNICO ORTOPÉDICO
        </span>
      );
    }
    if (arch === 'futuristic-cyber') {
      return (
        <span className="px-2.5 py-0.5 text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-500 rounded-md">
          &lt;CYBER GADGET&gt;
        </span>
      );
    }
    if (arch === 'natural-organic') {
      return (
        <span className="px-2.5 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full">
          🌿 BOTÁNICO ORGÁNICO
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-900 text-emerald-200 border border-emerald-700 rounded-full">
        ⭐ NOELUX CLÁSICO
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
            ? 'w-full bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col'
            : 'w-full max-w-7xl bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]'
        }
      >
        {/* ============================================================== */}
        {/* VERCEL HEADER: Minimalist, Calm, Quiet, Monochrome             */}
        {/* ============================================================== */}
        <header className="px-5 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-white font-mono text-base font-bold">▲</span>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="text-zinc-500">studio</span>
              <span>/</span>
              <span className="text-white font-medium">autopiloto-cod</span>
              {initialProduct && (
                <>
                  <span>/</span>
                  <span className="text-emerald-400 font-semibold">{initialProduct.nombre}</span>
                </>
              )}
            </div>
            <a
              href="https://github.com/deepseek-ai/deepseek-harness"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800 rounded-full transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              deepseek-ai/deepseek-harness
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Audio Toggle Button */}
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
              className={`p-2 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                audioEnabled
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                  : 'bg-black border-zinc-800 text-zinc-600 hover:text-zinc-400'
              }`}
              title={audioEnabled ? 'Voz del Agente Activada' : 'Voz Silenciada'}
            >
              {audioEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline text-[11px]">Voz IA Activa</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="hidden sm:inline text-[11px]">Voz Silenciada</span>
                </>
              )}
            </button>

            {/* Vercel Mode Switcher: Catálogo Autopiloto vs Editor en Vivo */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveStep('catalogo')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeStep === 'catalogo'
                    ? 'bg-zinc-800 text-white font-medium shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>1. Catálogo Autopiloto ({SUBNICHE_TEMPLATES.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStep('editor')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeStep === 'editor'
                    ? 'bg-emerald-950 text-emerald-300 font-semibold border border-emerald-700 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
                <span>2. Editor en Vivo (DeepSeek Harness)</span>
              </button>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* ============================================================== */}
        {/* TAB 1: CATÁLOGO VISUAL DE PLANTILLAS 100% DIFERENCIADAS         */}
        {/* ============================================================== */}
        {activeStep === 'catalogo' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* VERCEL CALM AUTOPILOT BAR */}
            <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                      Lanzador de Autopiloto en 1 Clic
                    </h2>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Elegí cualquier plantilla de abajo o pegá el nombre/URL de tu producto. El autopiloto construye la landing, calcula precios psicológicos 9.000 Gs y entrena al cerebro de WhatsApp al instante.
                  </p>
                </div>
              </div>

              {/* Autopilot Instant Input */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={quickAutopilotQuery}
                    onChange={e => setQuickAutopilotQuery(e.target.value)}
                    placeholder="Escribí el nombre de tu producto o pegá la URL (ej: Freidora de Aire 6L)"
                    className="w-full bg-black border border-zinc-700/80 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors"
                  />
                </div>

                <button
                  type="button"
                  disabled={isSynthesizing}
                  onClick={() => handleLaunchAutopilot(selectedTemplate, quickAutopilotQuery)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50 shrink-0 shadow-sm"
                >
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>{isSynthesizing ? 'Publicando...' : '⚡ Lanzar Autopiloto (1-Clic)'}</span>
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Niche Categories Slider */}
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
                      className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-white text-black font-semibold shadow-xs'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.shortName}</span>
                    </button>
                  );
                })}
              </div>

              {/* Template Search Filter */}
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
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                />
              </div>
            </div>

            {/* Grid of 100% Unique Templates with Real Niche Photography */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {paginatedTemplates.map(tpl => {
                const isCurrent = selectedTemplate.id === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    className={`rounded-xl border transition-all flex flex-col justify-between overflow-hidden group ${
                      isCurrent
                        ? 'bg-zinc-900 border-zinc-400 ring-1 ring-zinc-400 shadow-lg'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    {/* Genuine Product Image (Distinct per niche) */}
                    <div className="relative aspect-video w-full bg-black overflow-hidden border-b border-zinc-800">
                      <img
                        src={tpl.previewImage}
                        alt={tpl.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1">
                        {getArchetypeBadge(tpl)}
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] font-mono text-zinc-300 border border-zinc-800">
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

                      <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-zinc-500">Precio Sugerido:</span>
                          <span className="text-emerald-400 font-semibold">
                            {formatGs(tpl.defaultPricePack1)}
                          </span>
                        </div>

                        {/* Dual Actions: 1-Click Autopilot (Immediate) or Open Editor */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <button
                            type="button"
                            disabled={isSynthesizing}
                            onClick={() => handleLaunchAutopilot(tpl)}
                            className="w-full py-2 px-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 shadow-sm"
                            title="Genera y publica la página inmediatamente sin preguntas"
                          >
                            <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                            <span>Autopiloto</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditorForTemplate(tpl)}
                            className="w-full py-2 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-medium flex items-center justify-center gap-1 border border-zinc-700 transition-all cursor-pointer"
                            title="Abre la maqueta interactiva y el Portavoz IA con DeepSeek Harness"
                          >
                            <Bot className="w-3.5 h-3.5 text-zinc-400" />
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
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800 text-xs text-zinc-400">
                <span>
                  Página {safeCurrentPage} de {totalTemplatePages} ({filteredTemplates.length} plantillas)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={safeCurrentPage >= totalTemplatePages}
                    onClick={() => setCurrentPage(prev => Math.min(totalTemplatePages, prev + 1))}
                    className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: MODO EDITOR EN TIEMPO REAL CON DEEPSEEK & PORTAVOZ IA   */}
        {/* ============================================================== */}
        {activeStep === 'editor' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Split Screen Container: Left (Chat Agente Portavoz + DeepSeek) / Right (Live Interactive Preview) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT: Agente Portavoz IA & Consola DeepSeek Harness */}
              <div className="lg:col-span-7 flex flex-col h-[75vh] bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                {/* Spokesperson Header */}
                <div className="p-4 bg-black border-b border-zinc-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white shadow-md">
                      <Bot className="w-5 h-5" />
                      {isSpeaking && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">Agente Portavoz IA</h3>
                        <a
                          href="https://github.com/deepseek-ai/deepseek-harness"
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400 border border-emerald-800 flex items-center gap-1 transition-colors"
                          title="deepseek-ai/deepseek-harness en GitHub"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          DeepSeek Harness (Cordis)
                        </a>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Edición en vivo para: <strong className="text-zinc-200">{liveDraft.nombre}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Seal Button */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={savingChangesToDb}
                      onClick={handleSealAndSaveFinalProduct}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                      title="Dar el OK y guardar en base de datos"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{savingChangesToDb ? 'Guardando...' : '✓ Dar el OK & Guardar'}</span>
                    </button>
                  </div>
                </div>

                {/* Conversation History Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-zinc-950/70">
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
                            <span className="text-emerald-400">{msg.usedEngine}</span>
                          </>
                        )}
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-zinc-800 text-white border border-zinc-700'
                            : 'bg-zinc-900 text-zinc-200 border border-zinc-800/90 shadow-sm'
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.text}</p>

                        {msg.appliedChanges && msg.appliedChanges.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-zinc-800 space-y-1">
                            <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold block">
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

                  {/* Live Coding Notice */}
                  {codingNotice && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-emerald-400 animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{codingNotice}</span>
                    </div>
                  )}

                  <div ref={chatMessagesEndRef} />
                </div>

                {/* Quick Recommendation Chips */}
                <div className="p-2.5 bg-black/60 border-t border-zinc-800/80 overflow-x-auto scrollbar-none flex items-center gap-1.5">
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
                      className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 whitespace-nowrap cursor-pointer transition-all shrink-0 disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Input Bar: Audio Mic + Text Prompt */}
                <div className="p-3 bg-black border-t border-zinc-800 flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={toggleMicrophone}
                    className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      isListeningMic
                        ? 'bg-red-950 text-red-400 border-red-700 animate-pulse'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
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
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                  />

                  <button
                    type="button"
                    disabled={!userInputInstruction.trim() || isCodingAgentWorking}
                    onClick={() => handleSendInstructionToCodingAgent()}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Enviar</span>
                  </button>
                </div>
              </div>

              {/* RIGHT: Live Interactive Mobile Preview (Reflected in Real Time) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-mono font-bold text-white">
                        Maqueta Móvil (Reflejada en Vivo)
                      </span>
                    </div>
                    {getArchetypeBadge(
                      SUBNICHE_TEMPLATES.find(t => t.id === liveDraft.templateId) || selectedTemplate
                    )}
                  </div>

                  {/* Simulated Mobile Frame */}
                  <div className="mx-auto max-w-xs w-full bg-zinc-950 rounded-3xl border-4 border-zinc-800 overflow-hidden shadow-2xl relative">
                    {/* Top Notch Bar */}
                    <div className="h-4 bg-zinc-900 flex items-center justify-center">
                      <div className="w-16 h-2 bg-zinc-950 rounded-full" />
                    </div>

                    {/* Dynamic Theme Banner */}
                    <div
                      className={`p-3 text-center text-xs font-bold ${liveDraft.themeConfig?.topStripBg || 'bg-amber-400 text-black'}`}
                    >
                      {liveDraft.landingContent?.topBarText ||
                        (liveDraft.freeShipping
                          ? 'ENVÍO GRATIS EN PARAGUAY · PAGÁS AL RECIBIR'
                          : 'ENTREGA RÁPIDA · PAGO CONTRA ENTREGA')}
                    </div>

                    {/* Product Photo & Real-Time Injected Emblem Badge */}
                    <div className="relative aspect-square w-full bg-black overflow-hidden">
                      <img
                        src={liveDraft.imagen}
                        alt={liveDraft.nombre}
                        className="w-full h-full object-cover"
                      />

                      {/* Emblem Badge injected by DeepSeek Harness dsh-plugin-emblem-hero */}
                      {liveDraft.landingContent?.emblemBadge && (
                        <div className="absolute top-3 left-3 bg-gradient-to-r from-amber-400 to-yellow-500 text-black px-2.5 py-1 rounded-full shadow-lg border border-yellow-200 flex items-center gap-1.5 animate-bounce">
                          <span className="text-xs">★</span>
                          <span className="text-[10px] font-black tracking-wider uppercase">
                            {liveDraft.landingContent.emblemBadge.text}
                          </span>
                        </div>
                      )}

                      <div className="absolute bottom-2 left-2 right-2 bg-black/85 backdrop-blur-xs p-2 rounded-xl text-left border border-zinc-800">
                        <span className="text-[9px] font-mono text-emerald-400 block font-bold">
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

                    {/* Pack Options Preview */}
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
                                ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50'
                                : 'bg-zinc-900 border-zinc-800'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white">
                                  {packNum === 1
                                    ? '1 Unidad'
                                    : packNum === 2
                                    ? 'Pack 2 (Llevás 2)'
                                    : 'Pack Familiar (3)'}
                                </span>
                                {isPack2 && (
                                  <span className="px-1.5 py-0.2 bg-emerald-500 text-black text-[9px] font-black rounded-full">
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
                            <span className="font-mono font-bold text-emerald-400">
                              {formatGs(price)}
                            </span>
                          </div>
                        );
                      })}

                      {/* CTA Button with Dynamic Shape */}
                      <div className="pt-2">
                        <button
                          type="button"
                          className={`w-full py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-black bg-emerald-400 hover:bg-emerald-300 shadow-md ${
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
                  <div className="pt-2 text-[11px] font-mono text-zinc-400 space-y-1 border-t border-zinc-800">
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
                  className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>
                    {savingChangesToDb
                      ? 'GUARDANDO EN BASE DE DATOS...'
                      : '✓ DAR EL OK & GUARDAR EN BASE DE DATOS'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SUCCESS PUBLISHED MODAL (Vercel Calm Deployment Card) */}
      {publishSuccessModal.open && publishSuccessModal.createdPage && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-xl flex items-center justify-center mx-auto text-xl font-bold">
              ✓
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">
                ¡Página Publicada con Autopiloto!
              </h3>
              <p className="text-xs text-zinc-400">
                Tu página para <strong className="text-white">{publishSuccessModal.createdPage.nombre}</strong> ya está activa con su diseño exclusivo, precios 9.000 Gs y cerebro de WhatsApp.
              </p>
            </div>

            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300">
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
                className="w-full py-2.5 px-4 rounded-xl bg-white text-black font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:bg-zinc-200"
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
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-zinc-800"
              >
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
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
