import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Layers,
  ExternalLink,
  LogOut,
  Plus,
  Save,
  CheckCircle2,
  Send,
  Bell,
  RefreshCw,
  X,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Eye,
  Menu,
  Zap,
  MessageCircle,
  Smartphone,
  Trash2,
  PackageCheck,
  Home,
  Volume2,
  Mic,
  MicOff,
  RotateCcw,
  MessageSquare,
  Bot,
  Sparkles,
  Settings,
  Search,
  Archive,
  ArchiveRestore,
  AlertTriangle,
  CheckSquare,
  Square,
  Info,
  HelpCircle,
  Lightbulb
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs, formatWaPhone } from '../config';
import { Order, ProductPage, OrderStatus } from '../types';
import { ProductConfirmedOrdersPanel } from '../components/ProductConfirmedOrdersPanel';
import { ProductSellerAgentPanel } from '../components/ProductSellerAgentPanel';
import { ProductTemplateBuilderModal } from '../components/ProductTemplateBuilderModal';
import { ProductTemplateBuilderStudio } from '../components/ProductTemplateBuilderStudio';
import { AutoAdsView } from '../components/AutoAdsView';
import { AdminSectionGuide } from '../components/AdminSectionGuide';
import { SUBNICHE_TEMPLATES, buildAutoTrainedAgentBrain } from '../data/productTemplatesCatalog';
import {
  DEFAULT_META_TRACKING_CONFIG,
  trackMetaFullFunnelEvent
} from '../utils/metaPixelEngine';
import {
  isOrderConfirmedByAgent,
  buildOrderComparisonSummary,
  filterAdminOrders,
  formatParaguayanPhone433
} from '../utils/orderConfirmation';

export interface WaSessionCardData {
  id: string;
  label: string;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'syncing' | 'connected';
  qrDataUrl: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  lastError: string | null;
  createdAt?: string;
}

export interface DeepgramVoiceItem {
  id: string;
  name: string;
  gender: 'Femenina' | 'Masculina';
  accent: string;
  description: string;
  role?: string;
  sampleText?: string;
  deepgramModel?: string;
}

export type VibeVoiceItem = DeepgramVoiceItem;
export type MingVoiceItem = DeepgramVoiceItem;

// Catálogo Deepgram Aura-2 — Voces ultra-realistas con entonación natural y cadencia humana
const DEFAULT_DEEPGRAM_CATALOG: DeepgramVoiceItem[] = [
  {
    id: 'deepgram-estrella',
    name: 'Estrella (Femenina Natural · Deepgram Aura-2)',
    gender: 'Femenina',
    accent: 'Español Mexicano (es-MX)',
    description: 'Voz femenina natural, cálida y expresiva con acento mexicano. Ideal para atención al cliente.',
    deepgramModel: 'aura-2-estrella-es'
  },
  {
    id: 'deepgram-celeste',
    name: 'Celeste (Femenina Energética · Deepgram Aura-2)',
    gender: 'Femenina',
    accent: 'Español Colombiano (es-CO)',
    description: 'Voz femenina clara, energética y entusiasta con acento colombiano.',
    deepgramModel: 'aura-2-celeste-es'
  },
  {
    id: 'deepgram-sirio',
    name: 'Sirio (Masculina Profesional · Deepgram Aura-2)',
    gender: 'Masculina',
    accent: 'Español Mexicano (es-MX)',
    description: 'Voz masculina calmada, profesional y empática con tono barítono.',
    deepgramModel: 'aura-2-sirio-es'
  },
  {
    id: 'deepgram-nestor',
    name: 'Néstor (Masculina Ejecutiva · Deepgram Aura-2)',
    gender: 'Masculina',
    accent: 'Español Peninsular (es-ES)',
    description: 'Voz masculina ejecutiva, serena y profesional con claridad excepcional.',
    deepgramModel: 'aura-2-nestor-es'
  }
];

const DEFAULT_VIBEVOICE_CATALOG = DEFAULT_DEEPGRAM_CATALOG;
const DEFAULT_MING_VOICES = DEFAULT_DEEPGRAM_CATALOG;

const ITEMS_PER_PAGE = 10;

export const AdminView: React.FC = () => {
  const {
    config,
    orders,
    updateOrderStatus,
    updateOrder,
    deleteOrder,
    deleteOrdersBatch,
    archiveOrdersBatch,
    refreshOrders,
    setCurrentView,
    adminUser,
    logoutAdmin,
    productPages,
    updateProductPage,
    addProductPage,
    deleteProductPagesBatch,
    setCurrentProductPage
  } = useStore();

  // Sidebar navigation:
  // 1. 'productos' -> Páginas de Productos
  // 2. 'creador'   -> Creador de Páginas IA (Entrevista Audio + 1-Clic)
  // 3. 'pipeboard' -> Automatización Meta Ads + Creativos IA
  // 4. 'whatsapp'  -> Conexiones Múltiples WhatsApp
  // 5. 'deepgram'  -> Deepgram Todo-en-Uno
  // 6. 'openrouter'-> Cerebro LLM Deepgram
  const [activeMenu, setActiveMenu] = useState<'productos' | 'creador' | 'pipeboard' | 'whatsapp' | 'deepgram' | 'openrouter'>('productos');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Selected product page and accordion expanded state
  const [selectedProductId, setSelectedProductId] = useState<string>(productPages[0]?.id || '');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(productPages[0]?.id || null);
  const [recentlyCreatedProductId, setRecentlyCreatedProductId] = useState<string | null>(null);

  // Filtros y Selección Múltiple de Páginas de Productos + Eliminación Masiva
  const [filterProductName, setFilterProductName] = useState('');
  const [filterProductPhoneOrPixel, setFilterProductPhoneOrPixel] = useState('');
  const [filterProductTab, setFilterProductTab] = useState<'todas' | 'con_pixel' | 'envio_gratis'>('todas');
  const [selectedProductPageIds, setSelectedProductPageIds] = useState<string[]>([]);
  const [deleteProductsConfirmModal, setDeleteProductsConfirmModal] = useState<{
    open: boolean;
    productIds: string[];
    productsPreview: ProductPage[];
    isDeleting: boolean;
  }>({
    open: false,
    productIds: [],
    productsPreview: [],
    isDeleting: false
  });

  const filteredProductPages = useMemo(() => {
    const qName = filterProductName.trim().toLowerCase();
    const qMeta = filterProductPhoneOrPixel.trim().toLowerCase();
    return productPages.filter(prod => {
      if (filterProductTab === 'con_pixel' && !prod.metaTracking?.pixelId?.trim()) {
        return false;
      }
      if (filterProductTab === 'envio_gratis' && prod.freeShipping === false) {
        return false;
      }
      if (qName) {
        const hayName = `${prod.nombre || ''} ${prod.slug || ''} ${prod.id || ''}`.toLowerCase();
        if (!hayName.includes(qName)) return false;
      }
      if (qMeta) {
        const hayMeta = `${prod.wa || ''} ${prod.metaTracking?.pixelId || ''} ${prod.slug || ''}`.toLowerCase();
        if (!hayMeta.includes(qMeta)) return false;
      }
      return true;
    });
  }, [productPages, filterProductName, filterProductPhoneOrPixel, filterProductTab]);

  const toggleSelectProductPage = (prodId: string) => {
    const cleanId = String(prodId || '').trim();
    if (!cleanId) return;
    setSelectedProductPageIds(prev =>
      prev.includes(cleanId) ? prev.filter(id => id !== cleanId) : [...prev, cleanId]
    );
  };

  const toggleSelectAllProductPages = (idsInList: string[]) => {
    const cleanList = idsInList.map(id => String(id || '').trim()).filter(Boolean);
    if (cleanList.length === 0) return;
    setSelectedProductPageIds(prev => {
      const allAlreadySelected = cleanList.every(id => prev.includes(id));
      if (allAlreadySelected) {
        const removeSet = new Set(cleanList);
        return prev.filter(id => !removeSet.has(id));
      } else {
        return Array.from(new Set([...prev, ...cleanList]));
      }
    });
  };

  const openRedDeleteProductsModal = (idsToDelete: string[]) => {
    const cleanIds = Array.from(
      new Set(idsToDelete.map(id => String(id || '').trim()).filter(Boolean))
    );
    if (cleanIds.length === 0) return;
    const cleanSet = new Set(cleanIds);
    const preview = productPages.filter(p => cleanSet.has(String(p.id || '').trim()));
    setDeleteProductsConfirmModal({
      open: true,
      productIds: cleanIds,
      productsPreview: preview,
      isDeleting: false
    });
  };

  const handleConfirmExecuteDeleteProducts = async () => {
    if (deleteProductsConfirmModal.productIds.length === 0 || deleteProductsConfirmModal.isDeleting) return;
    const idsToDelete = [...deleteProductsConfirmModal.productIds];
    setDeleteProductsConfirmModal(prev => ({ ...prev, isDeleting: true }));
    try {
      await deleteProductPagesBatch(idsToDelete);
      const deletedSet = new Set(idsToDelete);
      setSelectedProductPageIds(prev => prev.filter(id => !deletedSet.has(id)));
      if (expandedProductId && deletedSet.has(expandedProductId)) {
        const remaining = productPages.filter(p => !deletedSet.has(p.id));
        setExpandedProductId(remaining[0]?.id || null);
        setSelectedProductId(remaining[0]?.id || '');
      }
      setDeleteProductsConfirmModal({
        open: false,
        productIds: [],
        productsPreview: [],
        isDeleting: false
      });
      showToast(
        idsToDelete.length === 1
          ? `🗑️ Página de producto eliminada directamente de la Base de Datos.`
          : `🗑️ ${idsToDelete.length} páginas de producto eliminadas directamente de la Base de Datos.`
      );
    } catch (e) {
      setDeleteProductsConfirmModal(prev => ({ ...prev, isDeleting: false }));
      showToast('⚠️ Ocurrió un error al intentar eliminar las páginas de producto.');
    }
  };

  // Pagination state (10 by 10) per product ID
  const [productPageMap, setProductPageMap] = useState<Record<string, number>>({});

  // Filtros de pedidos por Nombre, Teléfono y Estado de Archivado + Selección Múltiple y Pop-up Rojo de Eliminación
  const [filterOrderName, setFilterOrderName] = useState('');
  const [filterOrderPhone, setFilterOrderPhone] = useState('');
  const [filterArchiveMode, setFilterArchiveMode] = useState<'activos' | 'archivados' | 'todos'>('activos');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isArchivingBatch, setIsArchivingBatch] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    open: boolean;
    orderIds: string[];
    ordersPreview: Order[];
    isDeleting: boolean;
  }>({
    open: false,
    orderIds: [],
    ordersPreview: [],
    isDeleting: false
  });

  const toggleSelectOrder = (reservaid: string) => {
    const cleanId = String(reservaid || '').trim();
    if (!cleanId) return;
    setSelectedOrderIds(prev =>
      prev.includes(cleanId) ? prev.filter(id => id !== cleanId) : [...prev, cleanId]
    );
  };

  const toggleSelectAllOrdersInList = (orderIdsInList: string[]) => {
    const cleanList = orderIdsInList.map(id => String(id || '').trim()).filter(Boolean);
    if (cleanList.length === 0) return;
    setSelectedOrderIds(prev => {
      const allAlreadySelected = cleanList.every(id => prev.includes(id));
      if (allAlreadySelected) {
        const removeSet = new Set(cleanList);
        return prev.filter(id => !removeSet.has(id));
      } else {
        return Array.from(new Set([...prev, ...cleanList]));
      }
    });
  };

  const openRedDeleteConfirmModal = (idsToDelete: string[]) => {
    const cleanIds = Array.from(
      new Set(idsToDelete.map(id => String(id || '').trim()).filter(Boolean))
    );
    if (cleanIds.length === 0) return;
    const cleanSet = new Set(cleanIds);
    const preview = orders.filter(
      o => cleanSet.has(String(o.reservaid || '').trim()) || cleanSet.has(String(o.id || '').trim())
    );
    setDeleteConfirmModal({
      open: true,
      orderIds: cleanIds,
      ordersPreview: preview,
      isDeleting: false
    });
  };

  const handleConfirmExecuteDelete = async () => {
    if (deleteConfirmModal.orderIds.length === 0 || deleteConfirmModal.isDeleting) return;
    const idsToDelete = [...deleteConfirmModal.orderIds];
    setDeleteConfirmModal(prev => ({ ...prev, isDeleting: true }));
    try {
      await deleteOrdersBatch(idsToDelete);
      if (activeAiOrder && idsToDelete.includes(activeAiOrder.reservaid)) {
        setActiveAiOrder(null);
      }
      const deletedSet = new Set(idsToDelete);
      setSelectedOrderIds(prev => prev.filter(id => !deletedSet.has(id)));
      setDeleteConfirmModal({
        open: false,
        orderIds: [],
        ordersPreview: [],
        isDeleting: false
      });
      showToast(
        idsToDelete.length === 1
          ? `🗑️ Pedido ${idsToDelete[0]} eliminado directamente de la Base de Datos.`
          : `🗑️ ${idsToDelete.length} pedidos eliminados directamente de la Base de Datos.`
      );
    } catch (e) {
      setDeleteConfirmModal(prev => ({ ...prev, isDeleting: false }));
      showToast('⚠️ Ocurrió un error al intentar eliminar los pedidos.');
    }
  };

  const handleArchiveOrders = async (idsToArchive: string[], archivado: boolean) => {
    const cleanIds = Array.from(
      new Set(idsToArchive.map(id => String(id || '').trim()).filter(Boolean))
    );
    if (cleanIds.length === 0 || isArchivingBatch) return;
    setIsArchivingBatch(true);
    try {
      await archiveOrdersBatch(cleanIds, archivado);
      const changedSet = new Set(cleanIds);
      setSelectedOrderIds(prev => prev.filter(id => !changedSet.has(id)));
      showToast(
        archivado
          ? cleanIds.length === 1
            ? `🗄️ Pedido ${cleanIds[0]} archivado y guardado en la Base de Datos.`
            : `🗄️ ${cleanIds.length} pedidos archivados y guardados en la Base de Datos.`
          : cleanIds.length === 1
            ? `📤 Pedido ${cleanIds[0]} restaurado a Activos en la Base de Datos.`
            : `📤 ${cleanIds.length} pedidos restaurados a Activos en la Base de Datos.`
      );
    } finally {
      setIsArchivingBatch(false);
    }
  };

  const getProductCurrentPage = (prodId: string) => productPageMap[prodId] || 1;
  const setProductCurrentPage = (prodId: string, page: number) => {
    setProductPageMap(prev => ({ ...prev, [prodId]: Math.max(1, page) }));
  };

  const toggleProductExpand = (prod: ProductPage) => {
    if (expandedProductId === prod.id) {
      setExpandedProductId(null);
    } else {
      setExpandedProductId(prod.id);
      setSelectedProductId(prod.id);
      setEditPriceNormal(prod.precioNormal || 249000);
      setEditPricePack1(prod.precios?.[1] || 189000);
      setEditPricePack2(prod.precios?.[2] || 358000);
      setEditPricePack3(prod.precios?.[3] || 507000);
      setEditWa(prod.wa || '');
      setEditPixelId(prod.metaTracking?.pixelId || '');
      setEditCapiToken(prod.metaTracking?.capiAccessToken || '');
      setEditTestEventCode(prod.metaTracking?.testEventCode || '');
    }
  };

  const selectedProduct = useMemo(() => {
    return productPages.find(p => p.id === (expandedProductId || selectedProductId)) || productPages[0];
  }, [productPages, expandedProductId, selectedProductId]);

  const [editPriceNormal, setEditPriceNormal] = useState<number>(249000);
  const [editPricePack1, setEditPricePack1] = useState<number>(189000);
  const [editPricePack2, setEditPricePack2] = useState<number>(358000);
  const [editPricePack3, setEditPricePack3] = useState<number>(507000);
  const [editWa, setEditWa] = useState<string>('');
  const [editPixelId, setEditPixelId] = useState<string>('');
  const [editCapiToken, setEditCapiToken] = useState<string>('');
  const [editTestEventCode, setEditTestEventCode] = useState<string>('');
  const [showPixelConfig, setShowPixelConfig] = useState<boolean>(false);
  const [testingProductCapi, setTestingProductCapi] = useState<boolean>(false);

  useEffect(() => {
    if (selectedProduct) {
      setEditPriceNormal(selectedProduct.precioNormal || 249000);
      setEditPricePack1(selectedProduct.precios?.[1] || 189000);
      setEditPricePack2(selectedProduct.precios?.[2] || 358000);
      setEditPricePack3(selectedProduct.precios?.[3] || 507000);
      setEditWa(selectedProduct.wa || '');
      setEditPixelId(selectedProduct.metaTracking?.pixelId || '');
      setEditCapiToken(selectedProduct.metaTracking?.capiAccessToken || '');
      setEditTestEventCode(selectedProduct.metaTracking?.testEventCode || '');
    }
  }, [selectedProduct]);

  // Modal: New / Edit Product Page via Intelligent Template Builder
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [editingProductInBuilder, setEditingProductInBuilder] = useState<ProductPage | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductWa, setNewProductWa] = useState('');
  const [newProductPrice1, setNewProductPrice1] = useState(189000);
  const [newProductPrice2, setNewProductPrice2] = useState(358000);
  const [newProductPrice3, setNewProductPrice3] = useState(507000);

  // Modal: Embedded Live WhatsApp Chat Console for a Specific Order
  const [activeAiOrder, setActiveAiOrder] = useState<Order | null>(null);
  const [modalAiMode, setModalAiMode] = useState<'automatico' | 'manual'>('manual');
  const [modalAiChannel, setModalAiChannel] = useState<'audio' | 'texto'>('audio');
  const [simulatedCustomerReply, setSimulatedCustomerReply] = useState<string>('');

  // Interruptores Globales de Automatización y Selección de Opciones (Audio o Texto)
  const [autoCallOnOrder, setAutoCallOnOrder] = useState<boolean>(true);
  const [autoChatOnOrder, setAutoChatOnOrder] = useState<boolean>(true);
  const [preferredChannel, setPreferredChannel] = useState<'audio' | 'texto'>('audio');
  const [showChannelSelector, setShowChannelSelector] = useState<boolean>(false);

  // Catálogo Deepgram Aura-2 (Sincronizado desde la Base de Datos Supabase en el producto)
  const [voicesCatalog, setVoicesCatalog] = useState<DeepgramVoiceItem[]>(DEFAULT_DEEPGRAM_CATALOG);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(
    selectedProduct?.vozAgente || 'deepgram-estrella'
  );
  const userLockedVoiceIdRef = useRef<string | null>(null);
  const lastVoiceSelectMsRef = useRef<number>(0);

  useEffect(() => {
    if (selectedProduct?.vozAgente) {
      userLockedVoiceIdRef.current = selectedProduct.vozAgente;
      setSelectedVoiceId(selectedProduct.vozAgente);
    }
  }, [selectedProduct?.id, selectedProduct?.vozAgente]);
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);
  const [savingVoice, setSavingVoice] = useState<boolean>(false);
  const [showVoiceCatalog, setShowVoiceCatalog] = useState<boolean>(false);
  const [showPriceConfig, setShowPriceConfig] = useState<boolean>(false);
  const [showConfirmedOrdersPanel, setShowConfirmedOrdersPanel] = useState<boolean>(false);
  const [showSellerAgentPanel, setShowSellerAgentPanel] = useState<boolean>(false);
  const [expandedBottomSummaryOrderId, setExpandedBottomSummaryOrderId] = useState<string | null>(null);
  const [productSubTabMap, setProductSubTabMap] = useState<Record<string, 'pedidos' | 'precios' | 'pixel' | 'voz'>>({});

  const getProductSubTab = (productId: string): 'pedidos' | 'precios' | 'pixel' | 'voz' => {
    return productSubTabMap[productId] || 'pedidos';
  };

  const setProductSubTab = (productId: string, tab: 'pedidos' | 'precios' | 'pixel' | 'voz') => {
    setProductSubTabMap(prev => ({ ...prev, [productId]: tab }));
  };

  const activeVoiceProfile = useMemo(() => {
    return (
      voicesCatalog.find(v => v.id === selectedVoiceId) ||
      DEFAULT_DEEPGRAM_CATALOG.find(v => v.id === selectedVoiceId) ||
      DEFAULT_DEEPGRAM_CATALOG[0]
    );
  }, [voicesCatalog, selectedVoiceId]);




  const [isSpeakingCall, setIsSpeakingCall] = useState<boolean>(false);



  const currentAudioRef = useRef<HTMLAudioElement | null>(null);


  // Deepgram API Key Configuration State
  const [deepgramApiKey, setDeepgramApiKey] = useState<string>('');
  const [deepgramApiKeyPreview, setDeepgramApiKeyPreview] = useState<string>('');
  const [deepgramHasKey, setDeepgramHasKey] = useState<boolean>(false);
  const [deepgramSaving, setDeepgramSaving] = useState<boolean>(false);
  const [deepgramTesting, setDeepgramTesting] = useState<boolean>(false);
  const [deepgramShowKey, setDeepgramShowKey] = useState<boolean>(false);

  // OpenRouter LLM API Key Configuration State
  const [openRouterApiKey, setOpenRouterApiKey] = useState<string>('');
  const [openRouterApiKeyPreview, setOpenRouterApiKeyPreview] = useState<string>('');
  const [openRouterHasKey, setOpenRouterHasKey] = useState<boolean>(false);
  const [openRouterSaving, setOpenRouterSaving] = useState<boolean>(false);
  const [openRouterTesting, setOpenRouterTesting] = useState<boolean>(false);
  const [openRouterShowKey, setOpenRouterShowKey] = useState<boolean>(false);
  const [openRouterTestReply, setOpenRouterTestReply] = useState<string>('');

  // Multi-Session WhatsApp State (supports unlimited WhatsApp accounts!)
  const [waSessions, setWaSessions] = useState<WaSessionCardData[]>([
    {
      id: 'wa-1',
      label: 'WhatsApp Principal #1',
      status: 'connecting',
      qrDataUrl: null,
      pairingCode: null,
      connectedPhone: null,
      connectedName: null,
      lastError: null
    }
  ]);
  const [newSessionLabel, setNewSessionLabel] = useState<string>('');
  const [addingSession, setAddingSession] = useState<boolean>(false);
  const [pairingInputs, setPairingInputs] = useState<Record<string, string>>({});
  const [loadingSessionMap, setLoadingSessionMap] = useState<Record<string, boolean>>({});

  const [chatsSummary, setChatsSummary] = useState<
    Record<
      string,
      {
        lastMessage: any;
        totalMessages: number;
        mode: 'automatico' | 'manual';
        channel?: 'audio' | 'texto';
      }
    >
  >({});
  const [liveChatMessages, setLiveChatMessages] = useState<
    Array<{
      id: string;
      phone: string;
      sender: 'client' | 'admin' | 'ai';
      senderName?: string;
      text: string;
      timestamp: string;
      status?: string;
      isVoiceCall?: boolean;
      isAudioNote?: boolean;
      agentChannel?: 'audio' | 'texto';
      callLink?: string;
      convStep?: number;
      voiceEngine?: string;
      audioDataUrl?: string;
    }>
  >([]);
  const [embeddedWaInput, setEmbeddedWaInput] = useState<string>('');
  const [sendingWaMsg, setSendingWaMsg] = useState<boolean>(false);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const chatBottomAnchorRef = useRef<HTMLDivElement | null>(null);


  const lastMsgKeyRef = useRef<string>('');

  const scrollChatAndCallToBottom = (smooth = true) => {
    const runScroll = () => {
      if (chatScrollContainerRef.current) {
        const el = chatScrollContainerRef.current;
        if (smooth) {
          try {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
          } catch (e) {
            el.scrollTop = el.scrollHeight;
          }
        } else {
          el.scrollTop = el.scrollHeight;
        }
      }
    };
    runScroll();
    requestAnimationFrame(runScroll);
    setTimeout(runScroll, 40);
    setTimeout(runScroll, 120);
    setTimeout(runScroll, 300);
  };

  // Mantener scroll fijo en el último mensaje automáticamente ante cualquier mutación DOM
  useEffect(() => {
    const el = chatScrollContainerRef.current;
    if (!el || !activeAiOrder) return;
    const forceBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    forceBottom();
    const observer = new MutationObserver(forceBottom);
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [activeAiOrder?.reservaid]);

  useEffect(() => {
    if (activeAiOrder) {
      lastMsgKeyRef.current = '';
      scrollChatAndCallToBottom(false);
    }
  }, [activeAiOrder?.reservaid]);

  useEffect(() => {
    if (!activeAiOrder) return;
    const latest = liveChatMessages[liveChatMessages.length - 1];
    const key = `${liveChatMessages.length}:${latest?.id || ''}:${latest?.text || ''}`;
    if (key !== lastMsgKeyRef.current) {
      const isInitialLoad = lastMsgKeyRef.current === '';
      lastMsgKeyRef.current = key;
      scrollChatAndCallToBottom(!isInitialLoad);
    }
  }, [liveChatMessages, activeAiOrder?.reservaid]);

  // Live notification banner
  const [newOrderNotification, setNewOrderNotification] = useState<Order | null>(null);
  const [prevOrderCount, setPrevOrderCount] = useState<number>(orders.length);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    if (orders.length > prevOrderCount) {
      const latest = orders[0];
      setNewOrderNotification(latest);
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => { });
      } catch (e) { }
    }
    setPrevOrderCount(orders.length);
  }, [orders, prevOrderCount]);

  // Keep activeAiOrder synced if orders update (e.g. when AI saves referenciaCasa)
  useEffect(() => {
    if (activeAiOrder) {
      const updated = orders.find(o => o.reservaid === activeAiOrder.reservaid);
      if (updated) setActiveAiOrder(updated);
    }
  }, [orders]);

  // Cloud cache of chats synced from Supabase
  const cloudChatsCacheRef = React.useRef<Record<string, any[]>>({});

  const sendWhatsAppCommandToCloud = async (cmdPayload: Record<string, any>): Promise<boolean> => {
    const sbUrl = config.supabase?.url || 'https://cmxcohevrlmzsfqslmft.supabase.co';
    const sbKey =
      config.supabase?.anonKey ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNteGNvaGV2cmxtenNmcXNsbWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNjMwNzYsImV4cCI6MjEwODkzOTA3Nn0.6SLXT2tvyR6Y8_5j_NSy0eT7qN7e_aO5uiWW-P3UW7w';

    try {
      const uniqueCode = `WACMD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const res = await fetch(`${sbUrl}/rest/v1/codigos`, {
        method: 'POST',
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: uniqueCode,
          dispositivo: JSON.stringify({
            ...cmdPayload,
            createdAt: new Date().toISOString()
          })
        })
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  const fetchWhatsAppStateFromCloud = async (): Promise<any | null> => {
    const sbUrl = config.supabase?.url || 'https://cmxcohevrlmzsfqslmft.supabase.co';
    const sbKey =
      config.supabase?.anonKey ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNteGNvaGV2cmxtenNmcXNsbWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNjMwNzYsImV4cCI6MjEwODkzOTA3Nn0.6SLXT2tvyR6Y8_5j_NSy0eT7qN7e_aO5uiWW-P3UW7w';

    try {
      const res = await fetch(
        `${sbUrl}/rest/v1/codigos?select=code,dispositivo,creado&code=like.WAENG-*&order=creado.desc&limit=1`,
        {
          headers: {
            apikey: sbKey,
            Authorization: `Bearer ${sbKey}`
          }
        }
      );
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0 && rows[0]?.dispositivo) {
          const parsed = JSON.parse(rows[0].dispositivo);
          if (parsed?.chats) {
            cloudChatsCacheRef.current = parsed.chats;
          }
          return parsed;
        }
      }
    } catch (e) { }
    return null;
  };

  // Poll WhatsApp Multi-Sessions & Chats Summary in real time
  const fetchWhatsAppStatus = async () => {
    let usedLocal = false;
    try {
      const res = await fetch('/api/whatsapp/status');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && typeof data.status === 'string') {
          usedLocal = true;
          if (typeof data.autoCallOnOrder === 'boolean') {
            setAutoCallOnOrder(data.autoCallOnOrder);
          }
          if (typeof data.autoChatOnOrder === 'boolean') {
            setAutoChatOnOrder(data.autoChatOnOrder);
          }
          if (
            data.preferredChannel === 'audio' ||
            data.preferredChannel === 'texto'
          ) {
            setPreferredChannel(data.preferredChannel);
          }
          if (Array.isArray(data.voices) && data.voices.length > 0) {
            setVoicesCatalog(data.voices);
          }
          if (typeof data.selectedVoiceId === 'string' && data.selectedVoiceId) {
            const lockedId = userLockedVoiceIdRef.current || selectedProduct?.vozAgente || null;
            if (lockedId) {
              if (selectedVoiceId !== lockedId) {
                setSelectedVoiceId(lockedId);
              }
              if (data.selectedVoiceId !== lockedId && Date.now() - lastVoiceSelectMsRef.current > 4000) {
                lastVoiceSelectMsRef.current = Date.now();
                fetch('/api/whatsapp/voice/select', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ voiceId: lockedId, productId: selectedProduct?.id })
                }).catch(() => { });
              }
            } else if (Date.now() - lastVoiceSelectMsRef.current > 10000) {
              setSelectedVoiceId(data.selectedVoiceId);
            }
          }
          if (Array.isArray(data.sessions) && data.sessions.length > 0) {
            setWaSessions(data.sessions);
          } else {
            setWaSessions([
              {
                id: 'wa-1',
                label: 'WhatsApp Principal #1',
                status: data.status || 'disconnected',
                qrDataUrl: data.qrDataUrl || null,
                pairingCode: data.pairingCode || null,
                connectedPhone: data.connectedPhone || null,
                connectedName: data.connectedName || null,
                lastError: data.lastError || null
              }
            ]);
          }
          if (data.chatsSummary) {
            setChatsSummary(data.chatsSummary);
          }
        }
      }
    } catch (e) { }

    if (!usedLocal) {
      const cloud = await fetchWhatsAppStateFromCloud();
      if (cloud) {
        if (typeof cloud.autoCallOnOrder === 'boolean') {
          setAutoCallOnOrder(cloud.autoCallOnOrder);
        } else if (typeof cloud.engineState?.autoCallOnOrder === 'boolean') {
          setAutoCallOnOrder(cloud.engineState.autoCallOnOrder);
        }
        if (typeof cloud.autoChatOnOrder === 'boolean') {
          setAutoChatOnOrder(cloud.autoChatOnOrder);
        } else if (typeof cloud.engineState?.autoChatOnOrder === 'boolean') {
          setAutoChatOnOrder(cloud.engineState.autoChatOnOrder);
        }
        const cloudPrefCh = cloud.preferredChannel || cloud.engineState?.preferredChannel;
        if (cloudPrefCh === 'audio' || cloudPrefCh === 'texto') {
          setPreferredChannel(cloudPrefCh);
        }
        const cloudVoices = cloud.voices || cloud.engineState?.voices;
        if (Array.isArray(cloudVoices) && cloudVoices.length > 0) {
          setVoicesCatalog(cloudVoices);
        }
        const cloudVoiceId = cloud.selectedVoiceId || cloud.engineState?.selectedVoiceId;
        if (typeof cloudVoiceId === 'string' && cloudVoiceId) {
          const lockedId = userLockedVoiceIdRef.current || selectedProduct?.vozAgente || null;
          if (lockedId) {
            setSelectedVoiceId(lockedId);
          } else if (Date.now() - lastVoiceSelectMsRef.current > 10000) {
            setSelectedVoiceId(cloudVoiceId);
          }
        }
        const cloudSessions = cloud.sessions || cloud.engineState?.sessions;
        if (Array.isArray(cloudSessions) && cloudSessions.length > 0) {
          setWaSessions(cloudSessions);
        } else if (cloud.engineState) {
          setWaSessions([
            {
              id: 'wa-1',
              label: 'WhatsApp Principal #1',
              status: cloud.engineState.status || 'disconnected',
              qrDataUrl: cloud.engineState.qrDataUrl || null,
              pairingCode: cloud.engineState.pairingCode || null,
              connectedPhone: cloud.engineState.connectedPhone || null,
              connectedName: cloud.engineState.connectedName || null,
              lastError: cloud.engineState.lastError || null
            }
          ]);
        }
        if (cloud.chatsSummary) {
          setChatsSummary(cloud.chatsSummary);
        }
      }
    }
  };

  useEffect(() => {
    fetchWhatsAppStatus();
    const timer = setInterval(fetchWhatsAppStatus, activeMenu === 'whatsapp' ? 1400 : 2500);
    return () => clearInterval(timer);
  }, [activeMenu]);

  // Fetch OpenRouter & Deepgram API configs on mount and when activeMenu changes
  const fetchOpenRouterConfig = () => {
    fetch("/api/openrouter/config")
      .then(r => r.json())
      .then(d => {
        setOpenRouterHasKey(!!d.hasApiKey);
        setOpenRouterApiKeyPreview(d.apiKeyPreview || "");
      })
      .catch(() => {});
  };

  const fetchDeepgramConfig = () => {
    fetch("/api/deepgram/config")
      .then(r => r.json())
      .then(data => {
        if (data?.success) {
          setDeepgramHasKey(data.hasApiKey);
          setDeepgramApiKeyPreview(data.apiKeyPreview || "");
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchOpenRouterConfig();
    fetchDeepgramConfig();
  }, [activeMenu]);

  // Add a new WhatsApp account/line (unlimited!)
  const handleAddWhatsAppSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingSession(true);
    const label = newSessionLabel.trim() || `WhatsApp #${waSessions.length + 1}`;
    const customId = `wa-${Date.now()}`;
    setNewSessionLabel('');

    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/sessions/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, sessionId: customId })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        handledLocal = true;
        const data = await res.json();
        if (Array.isArray(data.sessions)) {
          setWaSessions(data.sessions);
        }
      }
    } catch (e) { }

    if (!handledLocal) {
      setWaSessions(prev => [
        ...prev,
        {
          id: customId,
          label,
          status: 'connecting',
          qrDataUrl: null,
          pairingCode: null,
          connectedPhone: null,
          connectedName: null,
          lastError: null
        }
      ]);
      await sendWhatsAppCommandToCloud({
        type: 'add_session',
        label,
        sessionId: customId
      });
      setTimeout(fetchWhatsAppStatus, 1500);
      setTimeout(fetchWhatsAppStatus, 3000);
    }

    showToast(`✅ Nueva línea "${label}" agregada. Generando código QR...`);
    setAddingSession(false);
  };

  // Remove a WhatsApp line
  const handleRemoveWhatsAppSession = async (sessionId: string, label: string) => {
    setLoadingSessionMap(prev => ({ ...prev, [sessionId]: true }));
    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/sessions/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        handledLocal = true;
        const data = await res.json();
        if (Array.isArray(data.sessions)) {
          setWaSessions(data.sessions);
        }
      }
    } catch (e) { }

    if (!handledLocal) {
      setWaSessions(prev => prev.filter(s => s.id !== sessionId));
      await sendWhatsAppCommandToCloud({
        type: 'remove_session',
        sessionId
      });
      setTimeout(fetchWhatsAppStatus, 1500);
    }

    showToast(`Línea "${label}" eliminada.`);
    setLoadingSessionMap(prev => ({ ...prev, [sessionId]: false }));
  };

  // Connect or Refresh QR for a specific WhatsApp session
  const handleConnectSession = async (sessionId: string, forceNewQr = false) => {
    setLoadingSessionMap(prev => ({ ...prev, [sessionId]: true }));
    if (forceNewQr) {
      setWaSessions(prev =>
        prev.map(s =>
          s.id === sessionId ? { ...s, status: 'connecting', qrDataUrl: null, pairingCode: null } : s
        )
      );
    }

    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceNewQr, sessionId })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        handledLocal = true;
        const data = await res.json();
        if (Array.isArray(data.sessions)) {
          setWaSessions(data.sessions);
        }
      }
    } catch (e) { }

    if (!handledLocal) {
      await sendWhatsAppCommandToCloud({ type: 'connect', forceNewQr, sessionId });
    }
    setTimeout(fetchWhatsAppStatus, 1200);
    setTimeout(fetchWhatsAppStatus, 2500);
    setLoadingSessionMap(prev => ({ ...prev, [sessionId]: false }));
  };

  // Request 8-digit Pairing Code for a specific WhatsApp session
  const handleRequestSessionPairingCode = async (sessionId: string) => {
    const rawPhone = (pairingInputs[sessionId] || '').trim();
    if (!rawPhone) return;
    setLoadingSessionMap(prev => ({ ...prev, [sessionId]: true }));

    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: rawPhone, sessionId })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        handledLocal = true;
        const data = await res.json();
        if (Array.isArray(data.sessions)) {
          setWaSessions(data.sessions);
        }
        if (data.pairingCode) {
          showToast(`Código generado: ${data.pairingCode}. Ingresalo en tu celular.`);
        } else if (data.error) {
          showToast(data.error);
        }
      }
    } catch (e) { }

    if (!handledLocal) {
      await sendWhatsAppCommandToCloud({
        type: 'pairing',
        phone: rawPhone,
        sessionId
      });
      showToast('Generando código numérico de 8 dígitos...');
      setTimeout(fetchWhatsAppStatus, 2200);
    }

    setLoadingSessionMap(prev => ({ ...prev, [sessionId]: false }));
  };

  // Disconnect / Unlink a specific WhatsApp session
  const handleDisconnectSession = async (sessionId: string) => {
    setLoadingSessionMap(prev => ({ ...prev, [sessionId]: true }));
    setWaSessions(prev =>
      prev.map(s =>
        s.id === sessionId
          ? { ...s, status: 'connecting', qrDataUrl: null, pairingCode: null, connectedPhone: null }
          : s
      )
    );

    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        handledLocal = true;
      }
    } catch (e) { }

    if (!handledLocal) {
      await sendWhatsAppCommandToCloud({ type: 'logout', sessionId });
    }

    setTimeout(fetchWhatsAppStatus, 1200);
    setTimeout(fetchWhatsAppStatus, 2600);
    showToast('Sesión desvinculada. Generando nuevo QR...');
    setLoadingSessionMap(prev => ({ ...prev, [sessionId]: false }));
  };

  // Poll live WhatsApp chat messages for the currently open customer order
  const fetchLiveOrderChat = async (phone: string) => {
    if (!phone) return;
    const cleanPhone = formatWaPhone(phone);
    let loadedMessages: any[] = [];
    let detectedMode = modalAiMode;
    let detectedChannel = modalAiChannel;

    // 1. Consultar endpoint del servidor (/api/whatsapp/messages)
    try {
      const res = await fetch(`/api/whatsapp/messages?phone=${encodeURIComponent(cleanPhone)}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          loadedMessages = data.messages;
          if (data.mode === 'automatico' || data.mode === 'manual') {
            detectedMode = data.mode;
          }
          if (data.channel === 'audio' || data.channel === 'texto') {
            detectedChannel = data.channel;
          }
        }
      }
    } catch (e) { }


    if (loadedMessages.length > 0) {
      setLiveChatMessages(loadedMessages);
      setModalAiMode(detectedMode);
      setModalAiChannel(detectedChannel);
    }
  };

  useEffect(() => {
    if (!activeAiOrder) return;
    fetchLiveOrderChat(activeAiOrder.celular);
    const timer = setInterval(() => {
      fetchLiveOrderChat(activeAiOrder.celular);
      refreshOrders();
    }, 1500);
    return () => clearInterval(timer);
  }, [activeAiOrder?.reservaid]);

  // Reproduce audio humano sintetizado por Deepgram Aura-2 con la voz seleccionada (o override para probar una voz de la lista)
  const playSpokenAudio = async (
    rawText: string,
    providedDataUrl?: string | null,
    voiceIdOverride?: string
  ) => {
    const cleanText = String(rawText || '')
      .replace(/\*+/g, '')
      .replace(/_+/g, '')
      .replace(/[«»"“”]/g, '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\r\n|\r|\n/g, ' ')
      .trim();
    if (!cleanText) return;

    try {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    } catch (e) { }

    setIsSpeakingCall(true);
    const targetVoiceId = voiceIdOverride || selectedVoiceId || 'deepgram-estrella';

    let dataUrlToPlay = providedDataUrl || null;
    if (!dataUrlToPlay) {
      try {
        const res = await fetch(
          `/api/whatsapp/tts-audio?text=${encodeURIComponent(cleanText)}&voiceId=${encodeURIComponent(targetVoiceId)}`
        );
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (data?.audioDataUrl) {
            dataUrlToPlay = data.audioDataUrl;
          }
        }
      } catch (e) { }
    }

    if (dataUrlToPlay) {
      try {
        const audio = new Audio(dataUrlToPlay);
        currentAudioRef.current = audio;
        audio.onended = () => {
          setIsSpeakingCall(false);
          setTestingVoiceId(null);
        };
        audio.onerror = () => {
          setIsSpeakingCall(false);
          setTestingVoiceId(null);
        };
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn('[Audio Playback Autoplay Notice]:', err);
            setIsSpeakingCall(false);
            setTestingVoiceId(null);
            showToast('🔊 Hacé clic en la pantalla para escuchar el audio.');
          });
        }
        return;
      } catch (e) {
        setIsSpeakingCall(false);
        setTestingVoiceId(null);
      }
    }

    // Sin fallback robótico de navegador: sólo audio neuronal humano de alta fidelidad
    setIsSpeakingCall(false);
    setTestingVoiceId(null);
  };

  // Probar en vivo cualquier voz del catálogo Deepgram Aura-2
  const handleTestVoiceSample = async (voice: DeepgramVoiceItem) => {
    setTestingVoiceId(voice.id);
    const shortName = voice.name.split(' (')[0];
    const sampleText =
      voice.sampleText ||
      `Hola, ¿qué tal? ¿Cómo estás? Soy ${shortName} del área de envíos. Quería confirmarte tu ubicación antes del despacho del paquete, ¿tenés un minutito ahora?`;
    showToast(`🔊 Reproduciendo muestra de voz humana: ${voice.name}...`);
    await playSpokenAudio(sampleText, null, voice.id);
  };

  // Seleccionar y grabar la voz Deepgram Aura-2 elegida como voz oficial del Agente IA
  const handleSelectAndSaveVoice = async (voice: DeepgramVoiceItem) => {
    setSavingVoice(true);
    userLockedVoiceIdRef.current = voice.id;
    lastVoiceSelectMsRef.current = Date.now();
    try {
      localStorage.setItem('noelux_selected_voice_id', voice.id);
    } catch (e) { }
    setSelectedVoiceId(voice.id);

    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/voice/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: voice.id,
          productId: selectedProduct?.id
        })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        handledLocal = true;
      }
    } catch (e) { }

    if (selectedProduct) {
      try {
        await updateProductPage(selectedProduct.id, {
          vozAgente: voice.id,
          vozAgenteNombre: voice.name
        });
      } catch (e) { }
    }

    if (!handledLocal) {
      await sendWhatsAppCommandToCloud({
        type: 'select_voice',
        voiceId: voice.id,
        productId: selectedProduct?.id
      });
    }

    refreshOrders();
    setSavingVoice(false);
    setShowVoiceCatalog(false);
    showToast(`✅ Voz grabada en el paquete y asignada al Agente IA: ${voice.name}`);
  };

  // Elegir entre las opciones del Agente IA: 'audio' | 'texto'
  const handleSelectPreferredChannel = async (nextChannel: 'audio' | 'texto') => {
    setPreferredChannel(nextChannel);
    setShowChannelSelector(false);
    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/automation-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoCallOnOrder,
          autoChatOnOrder,
          preferredChannel: nextChannel
        })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        handledLocal = true;
      }
    } catch (e) { }

    if (!handledLocal) {
      await sendWhatsAppCommandToCloud({
        type: 'automation_settings',
        autoCallOnOrder,
        autoChatOnOrder,
        preferredChannel: nextChannel
      });
    }

    if (nextChannel === 'audio') {
      showToast(
        '🎤 Opción seleccionada: AUDIO IA (El agente enviará notas de voz reales OGG/Opus paso a paso).'
      );
    } else {
      showToast(
        '💬 Opción seleccionada: TEXTO IA (El agente chateará con mensajes de texto paso a paso).'
      );
    }
  };

  // Cambiar interruptores globales: Automático al recibir pedido vs Manual al dar clic
  const handleToggleAutomationSetting = async (
    field: 'autoCallOnOrder' | 'autoChatOnOrder',
    nextVal: boolean
  ) => {
    const updatedCall = field === 'autoCallOnOrder' ? nextVal : nextVal;
    const updatedChat = field === 'autoChatOnOrder' ? nextVal : nextVal;

    setAutoCallOnOrder(updatedCall);
    setAutoChatOnOrder(updatedChat);

    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/automation-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoCallOnOrder: updatedCall,
          autoChatOnOrder: updatedChat,
          preferredChannel
        })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        handledLocal = true;
      }
    } catch (e) { }

    if (!handledLocal) {
      await sendWhatsAppCommandToCloud({
        type: 'automation_settings',
        autoCallOnOrder: updatedCall,
        autoChatOnOrder: updatedChat,
        preferredChannel
      });
    }

    showToast(
      nextVal
        ? `⚡ Modo AUTOMÁTICO activado: Al entrar un pedido, el Agente responderá automáticamente por ${preferredChannel === 'audio' ? 'AUDIO (Nota de Voz)' : 'TEXTO'}.`
        : '👆 Modo MANUAL activado: El Agente esperará a que hagas clic en Audio o Texto en el pedido.'
    );
  };

  // Enviar Nota de Voz pura ('audio' - OGG/Opus real sin texto duplicado) y abrir consola de chat
  const handleSendOrderAudioNote = async (order: Order, customText?: string) => {
    const cleanPhone = formatWaPhone(order.celular);
    setActiveAiOrder(order);
    setModalAiMode('manual');
    setModalAiChannel('audio');
    showToast(`🎤 Generando y enviando Nota de Voz IA (OGG/Opus) a ${order.nombre}...`);

    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/call/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          orderId: order.reservaid,
          resetCall: false,
          channel: 'audio',
          customText: customText ? customText.trim() : undefined
        })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        handledLocal = true;
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setLiveChatMessages(data.messages);
        }
        if (data.sentViaSocket) {
          showToast(
            `✅ Nota de Voz IA (OGG/Opus) enviada al WhatsApp de ${order.nombre}`
          );
        } else {
          showToast(
            `🎤 Nota de Voz IA lista para ${order.nombre}`
          );
        }
        if (data.reply) {
          playSpokenAudio(data.reply, data.audioDataUrl);
        }
      }
    } catch (e) { }

    if (!handledLocal) {
      await sendWhatsAppCommandToCloud({
        type: 'call_start',
        phone: cleanPhone,
        orderId: order.reservaid,
        resetCall: false,
        channel: 'audio',
        customText: customText ? customText.trim() : undefined
      });
      setTimeout(() => {
        fetchLiveOrderChat(order.celular);
        fetchWhatsAppStatus();
      }, 1800);
    }
  };

  const [savingToDb, setSavingToDb] = useState<boolean>(false);

  const handleSaveProductConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    setSavingToDb(true);
    const cleanWaPhone = formatWaPhone(editWa);
    const nextMetaTracking = {
      ...DEFAULT_META_TRACKING_CONFIG,
      ...(selectedProduct.metaTracking || {}),
      pixelId: editPixelId.trim(),
      capiAccessToken: editCapiToken.trim(),
      testEventCode: editTestEventCode.trim(),
      capiServerEnabled: true,
      advancedMatchingSha256: true,
      firstPartyCookiesEnabled: true
    };
    const ok = await updateProductPage(selectedProduct.id, {
      precioNormal: Number(editPriceNormal),
      wa: cleanWaPhone,
      precios: {
        1: Number(editPricePack1),
        2: Number(editPricePack2),
        3: Number(editPricePack3)
      },
      metaTracking: nextMetaTracking
    });
    setSavingToDb(false);

    if (ok) {
      showToast(`✅ Guardado en Base de Datos: WhatsApp, precios, Píxel y Token API actualizados.`);
    } else {
      showToast(`WhatsApp, precios, Píxel y Token API actualizados.`);
    }
    setShowPriceConfig(false);
  };

  const handleSaveProductPixelConfig = async (e: React.FormEvent, prodTarget?: ProductPage) => {
    e.preventDefault();
    const target = prodTarget || selectedProduct;
    if (!target) return;

    setSavingToDb(true);
    const nextMetaTracking = {
      ...DEFAULT_META_TRACKING_CONFIG,
      ...(target.metaTracking || {}),
      pixelId: editPixelId.trim(),
      capiAccessToken: editCapiToken.trim(),
      testEventCode: editTestEventCode.trim(),
      capiServerEnabled: true,
      advancedMatchingSha256: true,
      firstPartyCookiesEnabled: true
    };
    const ok = await updateProductPage(target.id, {
      metaTracking: nextMetaTracking
    });
    setSavingToDb(false);

    if (ok) {
      showToast(
        `🎯 Píxel (${editPixelId.trim() || 'vacío'}) y Token API guardados en Base de Datos para "${target.nombre}".`
      );
    } else {
      showToast(`🎯 Píxel y Token API actualizados para "${target.nombre}".`);
    }
  };

  const handleTestProductCapi = async (prodTarget: ProductPage) => {
    setTestingProductCapi(true);
    try {
      const testProd: ProductPage = {
        ...prodTarget,
        metaTracking: {
          ...DEFAULT_META_TRACKING_CONFIG,
          ...(prodTarget.metaTracking || {}),
          pixelId: editPixelId.trim(),
          capiAccessToken: editCapiToken.trim(),
          testEventCode: editTestEventCode.trim(),
          capiServerEnabled: true,
          advancedMatchingSha256: true,
          firstPartyCookiesEnabled: true
        }
      };
      const res = await trackMetaFullFunnelEvent({
        eventName: 'PageView',
        product: testProd,
        extraCustomData: {
          test_source: 'admin_product_card_capi_check'
        }
      });
      if (res.capiSent) {
        showToast(
          `✅ Servidor Anti-Apple CAPI operativo para "${prodTarget.nombre}" (Event ID: ${res.eventId.slice(0, 14)}...)`
        );
      } else {
        showToast(`⚠️ Respuesta local recibida. Guardá el Píxel y Token para sincronizar con Meta.`);
      }
    } finally {
      setTestingProductCapi(false);
    }
  };

  const handleSaveFromTemplateBuilder = async (
    savedPage: ProductPage,
    openPreviewAfterSave = false
  ) => {
    const exists = productPages.some(p => p.id === savedPage.id);
    if (exists) {
      await updateProductPage(savedPage.id, savedPage, true);
      showToast(
        `✅ Página "${savedPage.nombre}" (/?p=${savedPage.slug}) actualizada y guardada en Base de Datos.`
      );
    } else {
      await addProductPage(savedPage, true);
      showToast(
        `🚀 Nueva página "${savedPage.nombre}" (/?p=${savedPage.slug}) creada y activada en Base de Datos.`
      );
    }
    setActiveMenu('productos');
    setSelectedProductId(savedPage.id);
    setExpandedProductId(savedPage.id);
    setRecentlyCreatedProductId(savedPage.id);
    setShowNewProductModal(false);
    setEditingProductInBuilder(null);
    if (openPreviewAfterSave) {
      window.history.pushState({}, '', `/?p=${savedPage.slug}`);
      setCurrentView('store');
    }
  };

  const handleQuickAutoTrainProductAgent = async (prod: ProductPage) => {
    const matchedTemplate =
      SUBNICHE_TEMPLATES.find(t => t.id === prod.templateId) || SUBNICHE_TEMPLATES[0];
    const truth = prod.physicalTruth || matchedTemplate.defaultPhysicalTruth;
    const { agentBrain, contextoIA } = buildAutoTrainedAgentBrain({
      productName: prod.nombre,
      productDescription: prod.descripcion || matchedTemplate.winnerAngleHook,
      prices: prod.precios,
      physicalTruth: truth,
      template: matchedTemplate,
      upsellPack2Enabled: prod.agentBrain?.upsellPack2Enabled ?? true
    });
    await updateProductPage(prod.id, {
      physicalTruth: truth,
      agentBrain,
      contextoIA
    });
    showToast(
      `🧠 ¡Agente de WhatsApp auto-entrenado a 1000x para "${prod.nombre}" y guardado en Base de Datos!`
    );
  };

  const handleCloneProductWithNewAngle = async (prod: ProductPage) => {
    const nextAngleNum =
      productPages.filter(p => p.parentProductId === prod.id || p.slug.startsWith(prod.slug)).length + 1;
    const clonedSlug = `${prod.slug}-angulo-${nextAngleNum}`;
    const clonedPage: ProductPage = {
      ...prod,
      id: `prod-${Date.now().toString(36)}`,
      nombre: `${prod.nombre} (Ángulo #${nextAngleNum})`,
      slug: clonedSlug,
      parentProductId: prod.id,
      creadoEn: new Date().toISOString()
    };
    setEditingProductInBuilder(clonedPage);
    setShowNewProductModal(true);
    showToast(
      `🧬 Clonando "${prod.nombre}" para Test A/B. Elegí otro subnicho o pedile un nuevo ángulo al Agente de Codificación.`
    );
  };

  // Send direct message from the embedded WhatsApp console
  const handleSendEmbeddedWhatsApp = async (
    order: Order,
    textToSend: string,
    senderType: 'admin' | 'ai' = 'admin'
  ) => {
    if (!textToSend.trim()) return;
    setSendingWaMsg(true);

    const cleanPhone = formatWaPhone(order.celular);
    const optimisticMsg = {
      id: `opt-${Date.now()}`,
      phone: cleanPhone,
      sender: senderType,
      senderName:
        senderType === 'ai' ? '🤖 Agente de Confirmación IA' : '👤 Tú (WhatsApp Directo)',
      text: textToSend.trim(),
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    setLiveChatMessages(prev => [...prev, optimisticMsg]);
    if (senderType === 'admin') {
      setEmbeddedWaInput('');
    }

    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          text: textToSend.trim(),
          sender: senderType,
          orderId: order.reservaid
        })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        handledLocal = true;
        await fetchLiveOrderChat(order.celular);
        await fetchWhatsAppStatus();
        showToast(`✅ Mensaje enviado por tu WhatsApp a ${order.nombre}.`);
      }
    } catch (e) { }

    if (!handledLocal) {
      const ok = await sendWhatsAppCommandToCloud({
        type: 'send',
        phone: cleanPhone,
        text: textToSend.trim(),
        sender: senderType,
        orderId: order.reservaid
      });
      if (ok) {
        showToast(`✅ Mensaje enviado a ${order.nombre} por tu WhatsApp.`);
        setTimeout(() => {
          fetchLiveOrderChat(order.celular);
          fetchWhatsAppStatus();
        }, 1800);
      }
    }

    setSendingWaMsg(false);
  };

  // Open the embedded WhatsApp chat console for a customer (Always defaults to "Yo Escribo" / Manual mode)
  const handleOpenOrderWhatsAppChat = async (
    order: Order,
    initialChannel: 'audio' | 'texto' = 'audio'
  ) => {
    setActiveAiOrder(order);
    // Modo "Yo Escribo" (manual) por defecto absoluto al entrar al chat para permitir escribir sin que la IA interrumpa
    setModalAiMode('manual');
    setModalAiChannel(initialChannel);
    await fetchLiveOrderChat(order.celular);
  };

  // Switch between AI channels ('audio' | 'texto') and "👤 Yo Escribo" ('manual')
  const handleSwitchOrderChatMode = async (
    order: Order,
    nextMode: 'automatico' | 'manual',
    nextChannel: 'audio' | 'texto' = modalAiChannel
  ) => {
    setModalAiMode(nextMode);
    setModalAiChannel(nextChannel);
    const cleanPhone = formatWaPhone(order.celular);
    const triggerAiNow = nextMode === 'automatico';

    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          mode: nextMode,
          channel: nextChannel,
          triggerAiNow,
          orderId: order.reservaid
        })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        handledLocal = true;
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setLiveChatMessages(data.messages);
        }
      }
    } catch (e) { }

    if (!handledLocal) {
      await sendWhatsAppCommandToCloud({
        type: 'mode',
        phone: cleanPhone,
        mode: nextMode,
        channel: nextChannel,
        triggerAiNow,
        orderId: order.reservaid
      });
      setTimeout(() => {
        fetchLiveOrderChat(order.celular);
        fetchWhatsAppStatus();
      }, 1800);
    }

    await updateOrder(order.reservaid, {
      modoIA: nextMode,
      atendidoPorIA: nextMode === 'automatico'
    });

    if (nextMode === 'manual') {
      showToast(`👤 Yo Escribo activado: Ahora vos le escribís directamente a ${order.nombre}.`);
    } else if (nextChannel === 'audio') {
      showToast(`🎤 Modo AUDIO IA (Nota de Voz OGG/Opus) activado y enviado para ${order.nombre}.`);
    } else {
      showToast(`💬 Modo TEXTO IA activado y enviado para ${order.nombre}.`);
    }
  };

  // Simulate incoming customer WhatsApp reply for testing the AI confirmation flow
  const handleSendSimulatedReply = async () => {
    if (!simulatedCustomerReply.trim() || !activeAiOrder) return;
    const text = simulatedCustomerReply.trim();
    const cleanPhone = formatWaPhone(activeAiOrder.celular);
    setSimulatedCustomerReply('');

    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/simulate-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          clientName: activeAiOrder.nombre,
          text
        })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        handledLocal = true;
      }
    } catch (e) { }

    if (!handledLocal) {
      await sendWhatsAppCommandToCloud({
        type: 'simulate',
        phone: cleanPhone,
        clientName: activeAiOrder.nombre,
        text
      });
    }

    setTimeout(() => {
      fetchLiveOrderChat(activeAiOrder.celular);
      fetchWhatsAppStatus();
      refreshOrders();
    }, handledLocal ? 150 : 2000);
  };

  const connectedSessionsCount = waSessions.filter(s => s.status === 'connected').length;

  return (
    <div className="flex h-screen bg-[#000000] text-zinc-100 overflow-hidden font-sans">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#062319] text-white px-5 py-3 rounded-2xl shadow-2xl border-2 border-[#e8b23a] flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-[#e8b23a] shrink-0" />
          <span className="text-xs sm:text-sm font-black">{toast}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. LEFT SIDEBAR: VERCEL CALM AESTHETIC                          */}
      {/* ============================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-black text-zinc-300 flex flex-col border-r border-zinc-800 transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white font-mono font-bold text-sm">
              ▲
            </div>
            <div>
              <div className="font-semibold text-white text-sm tracking-tight flex items-center gap-1.5">
                <span>NOELUX</span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                  ADMIN
                </span>
              </div>
              <small className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                E-Commerce COD Suite
              </small>
            </div>
          </div>

          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden text-zinc-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Badge */}
        <div className="px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-950 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono text-zinc-300 text-xs">
            {(adminUser?.nombre || 'AD').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-zinc-200 truncate">
              {adminUser?.nombre || 'Administrador'}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
              {adminUser?.rol || 'superadmin'}
            </div>
          </div>
        </div>

        {/* Navigation Menus */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Módulos del Sistema
          </div>

          {/* Menu 1: Páginas de Productos */}
          <button
            data-testid="sidebar-menu-productos"
            onClick={() => {
              setActiveMenu('productos');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer group ${
              activeMenu === 'productos'
                ? 'bg-zinc-800 text-white border-l-2 border-white'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Layers
                className={`w-4 h-4 transition-transform group-hover:scale-105 ${
                  activeMenu === 'productos' ? 'text-white' : 'text-zinc-400'
                }`}
              />
              <span className="text-sm">Páginas de Productos</span>
            </div>
            <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full text-zinc-400">
              {productPages.length}
            </span>
          </button>

          {/* Menu 2: Creador de Páginas IA (Entrevista Audio + 1-Clic) */}
          <button
            data-testid="sidebar-menu-creador"
            onClick={() => {
              setEditingProductInBuilder(null);
              setActiveMenu('creador');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer group ${
              activeMenu === 'creador'
                ? 'bg-zinc-800 text-white border-l-2 border-white'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sparkles
                className={`w-4 h-4 transition-transform group-hover:scale-105 ${
                  activeMenu === 'creador' ? 'text-emerald-400' : 'text-zinc-400'
                }`}
              />
              <span className="text-sm">Crear con Agente IA</span>
            </div>
            <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded-full uppercase">
              1-Clic
            </span>
          </button>

          {/* Menu 3: Pipeboard Meta Ads IA */}
          <button
            data-testid="sidebar-menu-pipeboard"
            onClick={() => {
              setActiveMenu('pipeboard');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer group ${
              activeMenu === 'pipeboard'
                ? 'bg-zinc-800 text-white border-l-2 border-white'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Bot
                className={`w-4 h-4 transition-transform group-hover:scale-105 ${
                  activeMenu === 'pipeboard' ? 'text-white' : 'text-zinc-400'
                }`}
              />
              <span className="text-sm">AutoAds</span>
            </div>
            <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full uppercase">
              Cerebro IA
            </span>
          </button>

          {/* Menu 4: Conexiones WhatsApp */}
          <button
            data-testid="sidebar-menu-whatsapp"
            onClick={() => {
              setActiveMenu('whatsapp');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer group ${
              activeMenu === 'whatsapp'
                ? 'bg-zinc-800 text-white border-l-2 border-white'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Smartphone
                className={`w-4 h-4 transition-transform group-hover:scale-105 ${
                  activeMenu === 'whatsapp' ? 'text-emerald-400' : 'text-zinc-400'
                }`}
              />
              <span className="text-sm">Conexiones WhatsApp</span>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                connectedSessionsCount > 0
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
              }`}
            >
              {connectedSessionsCount}/{waSessions.length}
            </span>
          </button>

          {/* Menu 5: Deepgram Todo-en-Uno */}
          <button
            data-testid="sidebar-menu-deepgram"
            onClick={() => {
              setActiveMenu('deepgram');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer group ${
              activeMenu === 'deepgram'
                ? 'bg-zinc-800 text-white border-l-2 border-white'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Zap
                className={`w-4 h-4 transition-transform group-hover:scale-105 ${
                  activeMenu === 'deepgram' ? 'text-white' : 'text-zinc-400'
                }`}
              />
              <span className="text-sm">Deepgram Todo-en-Uno</span>
            </div>
            <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
              STT·TTS
            </span>
          </button>

          {/* Menu 6: Cerebro LLM Deepgram */}
          <button
            data-testid="sidebar-menu-openrouter"
            onClick={() => {
              setActiveMenu('openrouter');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer group ${
              activeMenu === 'openrouter'
                ? 'bg-zinc-800 text-white border-l-2 border-white'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Bot
                className={`w-4 h-4 transition-transform group-hover:scale-105 ${
                  activeMenu === 'openrouter' ? 'text-white' : 'text-zinc-400'
                }`}
              />
              <span className="text-sm">Cerebro LLM Agente</span>
            </div>
            <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
              Activo
            </span>
          </button>
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-zinc-800 space-y-1.5 bg-black">
          <button
            onClick={() => setCurrentView('store')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 text-xs text-zinc-300 hover:text-white transition-all cursor-pointer border border-zinc-800"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              <span>Ver Tienda Pública</span>
            </div>
            <ChevronRight className="w-3 h-3 text-zinc-500" />
          </button>

          <button
            onClick={() => logoutAdmin()}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-red-950/20 hover:bg-red-950/40 text-xs text-red-300 hover:text-white transition-all cursor-pointer border border-red-900/30"
          >
            <div className="flex items-center gap-2">
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span>Cerrar Sesión</span>
            </div>
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* ============================================================== */}
      {/* 2. RIGHT MAIN INTERFACE AREA (VERCEL CALM AESTHETIC)           */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#09090b]">
        {/* Top Header */}
        <header className="h-14 bg-black/95 backdrop-blur-md border-b border-zinc-800/80 flex items-center justify-between px-3 sm:px-6 shrink-0 z-20 sticky top-0">
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
                  {activeMenu === 'pipeboard' && 'AutoAds'}
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
        </header>

        {/* Live Incoming Order Alert Banner */}
        {newOrderNotification && (
          <div className="bg-gradient-to-r from-[#062319] via-[#0b3d2e] to-[#062319] text-white px-4 sm:px-8 py-2.5 flex items-center justify-between border-b border-[#e8b23a]/40 shadow-sm animate-pulse">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-black">
              <span className="p-1 rounded-full bg-[#e8b23a] text-[#062319]">
                <Bell className="w-3.5 h-3.5" />
              </span>
              <span>
                ¡Nuevo pedido recibido!{' '}
                <strong className="text-[#ffd778]">{newOrderNotification.nombre}</strong> (
                {newOrderNotification.ciudad}) ordenó Pack {newOrderNotification.cantidad} un. (
                {formatGs(newOrderNotification.monto)})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handleOpenOrderWhatsAppChat(newOrderNotification);
                  setNewOrderNotification(null);
                }}
                className="text-xs font-black bg-[#e8b23a] text-[#062319] px-3 py-1 rounded-lg hover:bg-[#ffd778] cursor-pointer"
              >
                💬 Abrir Chat del Cliente →
              </button>
              <button
                type="button"
                onClick={() => setNewOrderNotification(null)}
                className="text-stone-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 pb-28 lg:pb-8 space-y-4 sm:space-y-6 bg-black text-zinc-100">
          {/* ======================================================== */}
          {/* INTERFAZ CREADOR: CONSTRUCTOR DE PÁGINAS IA (1-CLIC)    */}
          {/* ======================================================== */}
          {activeMenu === 'creador' && (
            <div className="space-y-4 sm:space-y-5 max-w-7xl mx-auto">
              <AdminSectionGuide
                id="creador"
                title="Constructor de Páginas IA (1-Clic)"
                subtitle="Creá landings ultra-rápidas para cualquier nicho o producto sin escribir código"
                badge="Guía del Creador IA"
                steps={[
                  {
                    icon: '🗂️',
                    title: 'Paso 1: Catálogo de Nichos',
                    description: 'Elegí una plantilla optimizada según la categoría de tu producto (Electrodomésticos, Belleza, Herramientas, etc.).'
                  },
                  {
                    icon: '📸',
                    title: 'Paso 2: Foto y Nombre',
                    description: 'Subí la foto del producto o usá una del catálogo; el Agente redactará titulares persuasivos automáticamente.'
                  },
                  {
                    icon: '🚀',
                    title: 'Paso 3: Lanzamiento en 1 Clic',
                    description: 'La IA calcula tus costos de courier, márgenes de ganancia y publica la página al instante.'
                  }
                ]}
                proTip="Si ya tenés una página creada, podés pedirle cambios al Agente de Codificación por voz o texto en cualquier momento."
              />

              <ProductTemplateBuilderStudio
                embeddedInView={true}
                initialProduct={editingProductInBuilder}
                onClose={() => {
                  setEditingProductInBuilder(null);
                  setActiveMenu('productos');
                }}
                defaultWaNumber={selectedProduct?.wa || config.wa || '595973532550'}
                availableVoices={voicesCatalog}
                onSaveProductPage={async (newOrUpdatedPage, openPreview) => {
                  await handleSaveFromTemplateBuilder(newOrUpdatedPage, openPreview);
                  setEditingProductInBuilder(null);
                }}
              />
            </div>
          )}

          {/* ======================================================== */}
          {/* INTERFAZ AUTOADS: PLATAFORMA DE ANUNCIOS CON CEREBRO IA   */}
          {/* ======================================================== */}
          {activeMenu === 'pipeboard' && (
            <div className="max-w-7xl mx-auto">
              <AutoAdsView
                productPages={productPages}
                onOpenLiveProductPage={prod => {
                  setCurrentProductPage(prod);
                  setCurrentView('store');
                }}
                showToast={showToast}
              />
            </div>
          )}

          {/* ======================================================== */}
          {/* INTERFAZ 1: PÁGINAS DE PRODUCTOS + CLIENTES (10 EN 10)   */}
          {/* ======================================================== */}
          {activeMenu === 'productos' && (
            <div className="space-y-4 sm:space-y-5 max-w-7xl mx-auto">
              {/* Guía Rápida & Explicación de la Sección */}
              <AdminSectionGuide
                id="productos"
                title="Páginas de Productos & Centro de Ventas"
                subtitle="Gestioná tus landings de alta conversión para venta contra entrega (COD) en Paraguay"
                badge="Guía de Páginas & Ventas"
                defaultExpanded={true}
                steps={[
                  {
                    icon: '🤖',
                    title: 'Edición en Tiempo Real con Agente IA',
                    description: 'Tocá "Editar con Agente IA" para abrir el chat/voz interactivo y pedirle cambios de textos, colores o fotos.'
                  },
                  {
                    icon: '👁️',
                    title: 'Ver Página en Vivo',
                    description: 'Abrí la tienda en una pestaña para ver la experiencia que tendrán tus compradores en su teléfono móvil.'
                  },
                  {
                    icon: '📦',
                    title: 'Gestión y Confirmación de Pedidos',
                    description: 'Desplegá "Clientes / Ajustes" para ver las compras confirmadas con geolocalización GPS lista para el courier.'
                  }
                ]}
                proTip="Las páginas con envío gratis y precios psicológicos terminados en 9.000 Gs (ej: 189.000 Gs) tienen hasta un 34% más de conversión en Paraguay."
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 px-1">
                <span>
                  💡 Tocá cualquier página para desplegar sus pedidos, configurar su Píxel de Meta o editar sus precios de oferta:
                </span>
                <span className="font-bold text-zinc-300">
                  Mostrando {filteredProductPages.length} de {productPages.length} página(s) activa(s)
                </span>
              </div>

              {/* BARRA DE FILTROS + SELECCIÓN MÚLTIPLE Y ELIMINADO DE PÁGINAS DE PRODUCTO */}
              <div
                data-testid="product-pages-filter-bar"
                className="p-3.5 sm:p-4 rounded-2xl bg-[#0d0d0f] border border-zinc-800/80 shadow-xs space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
                  <div className="lg:col-span-4">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
                      <span>🔍 Filtrar por Nombre o Slug</span>
                      <span className="text-[9px] text-zinc-500 font-normal">Búsqueda rápida</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        data-testid="admin-filter-product-name"
                        value={filterProductName}
                        onChange={e => setFilterProductName(e.target.value)}
                        placeholder="Ej: Proyector, Taladro, ?p=..."
                        className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-zinc-800 text-xs font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
                        title="Escribí el nombre del producto o parte de su link para filtrar"
                      />
                      {filterProductName && (
                        <button
                          type="button"
                          onClick={() => setFilterProductName('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-zinc-300 text-xs font-black cursor-pointer"
                          title="Limpiar filtro"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                      🎯 Filtrar por ID de Píxel o WhatsApp
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        data-testid="admin-filter-product-wa"
                        value={filterProductPhoneOrPixel}
                        onChange={e => setFilterProductPhoneOrPixel(e.target.value)}
                        placeholder="Ej: 123456789012345 o 595973..."
                        className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-zinc-800 text-xs font-mono font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
                      />
                      {filterProductPhoneOrPixel && (
                        <button
                          type="button"
                          onClick={() => setFilterProductPhoneOrPixel('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-zinc-300 text-xs font-black cursor-pointer"
                          title="Limpiar filtro"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                      📋 Filtro Rápido de Páginas
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
                      <button
                        type="button"
                        data-testid="admin-product-tab-todas"
                        onClick={() => setFilterProductTab('todas')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-black cursor-pointer transition-all whitespace-nowrap ${
                          filterProductTab === 'todas'
                            ? 'bg-zinc-800 text-white shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Todas ({productPages.length})
                      </button>
                      <button
                        type="button"
                        data-testid="admin-product-tab-pixel"
                        onClick={() => setFilterProductTab('con_pixel')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-black cursor-pointer transition-all whitespace-nowrap ${
                          filterProductTab === 'con_pixel'
                            ? 'bg-zinc-800 text-emerald-400 shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        🎯 Con Píxel ({productPages.filter(p => Boolean(p.metaTracking?.pixelId?.trim())).length})
                      </button>
                      <button
                        type="button"
                        data-testid="admin-product-tab-free-shipping"
                        onClick={() => setFilterProductTab('envio_gratis')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-black cursor-pointer transition-all whitespace-nowrap ${
                          filterProductTab === 'envio_gratis'
                            ? 'bg-zinc-800 text-white shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        🚚 Envío Gratis ({productPages.filter(p => p.freeShipping !== false).length})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Fila 2: Seleccionar Una, Varias o Todas las Páginas de Producto + Botón Rojo de Eliminación */}
                {(() => {
                  const allFilteredProductIds = filteredProductPages.map(p => p.id);
                  const isAllProductsSelected =
                    allFilteredProductIds.length > 0 &&
                    allFilteredProductIds.every(id => selectedProductPageIds.includes(id));
                  return (
                    <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          data-testid="admin-select-all-products-btn"
                          onClick={() => toggleSelectAllProductPages(allFilteredProductIds)}
                          disabled={allFilteredProductIds.length === 0}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black border inline-flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 ${
                            isAllProductsSelected
                              ? 'bg-zinc-800 text-white border-zinc-700'
                              : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            readOnly
                            checked={isAllProductsSelected}
                            className="w-3.5 h-3.5 accent-[#16a34a] pointer-events-none"
                          />
                          <span>
                            {isAllProductsSelected
                              ? `Deseleccionar todas (${allFilteredProductIds.length})`
                              : `Seleccionar todas (${allFilteredProductIds.length})`}
                          </span>
                        </button>

                        {selectedProductPageIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedProductPageIds([])}
                            className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800 cursor-pointer"
                          >
                            Limpiar selección ({selectedProductPageIds.length})
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          data-testid="admin-bulk-delete-products-btn"
                          disabled={selectedProductPageIds.length === 0}
                          onClick={() => openRedDeleteProductsModal(selectedProductPageIds)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-950/40 hover:bg-red-900/60 disabled:opacity-40 text-red-300 border border-red-900/50 shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-all"
                          title="Eliminar todas las páginas de producto seleccionadas directamente de la Base de Datos"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>
                            Eliminar seleccionadas ({selectedProductPageIds.length})
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {recentlyCreatedProductId && (() => {
                const recentProd = productPages.find(p => p.id === recentlyCreatedProductId);
                if (!recentProd) return null;
                return (
                  <div
                    data-testid="recently-created-product-banner"
                    className="bg-[#0d0d0f] text-white rounded-2xl p-4 border border-emerald-500/50 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-black uppercase tracking-wider text-[#ffd778] block">
                        ✓ Página Creada y Guardada con Éxito
                      </span>
                      <p className="text-sm font-black text-white">
                        {recentProd.nombre}{' '}
                        <span className="font-mono text-xs text-emerald-300">
                          (/?p={recentProd.slug})
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid="open-recent-created-page-btn"
                        onClick={() => {
                          setCurrentProductPage(recentProd);
                          window.history.pushState({}, '', `/?p=${recentProd.slug}`);
                          setCurrentView('store');
                        }}
                        className="bg-[#1ea856] hover:bg-[#16a34a] text-white text-xs font-black px-4 py-2 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Abrir Página Creada en Vivo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/?p=${recentProd.slug}`;
                          navigator.clipboard?.writeText(url);
                          showToast(`🔗 Link copiado: ${url}`);
                        }}
                        className="bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer"
                      >
                        Copiar Link
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-4">
                {filteredProductPages.map(prod => {
                  const isExpanded = expandedProductId === prod.id;
                  const isProductChecked = selectedProductPageIds.includes(prod.id);
                  const hasPixelConfigured = Boolean(prod.metaTracking?.pixelId?.trim());
                  const hasCapiTokenConfigured = Boolean(prod.metaTracking?.capiAccessToken?.trim());
                  const allProdOrders = orders.filter(o =>
                    (o.productoId && o.productoId === prod.id) ||
                    (o.producto || 'Noelux™ Proyector')
                      .toLowerCase()
                      .includes(prod.nombre.toLowerCase().slice(0, 10))
                  );
                  const activeProdOrdersCount = allProdOrders.filter(o => !o.archivado).length;
                  const archivedProdOrdersCount = allProdOrders.filter(o => Boolean(o.archivado)).length;
                  const prodOrders = filterAdminOrders(allProdOrders, {
                    nameQuery: filterOrderName,
                    phoneQuery: filterOrderPhone,
                    archiveMode: filterArchiveMode
                  });
                  const totalVentasProd = allProdOrders
                    .filter(o => !o.archivado)
                    .reduce((s, o) => s + (Number(o.monto) || 0), 0);
                  const confirmedProdOrdersCount = allProdOrders.filter(o =>
                    !o.archivado && isOrderConfirmedByAgent(o)
                  ).length;

                  // Paginación de 10 en 10 sobre los pedidos filtrados
                  const totalPages = Math.max(1, Math.ceil(prodOrders.length / ITEMS_PER_PAGE));
                  const currentPage = Math.min(getProductCurrentPage(prod.id), totalPages);
                  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                  const paginatedOrders = prodOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
                  const allFilteredIdsForProd = prodOrders.map(o => o.reservaid);
                  const selectedIdsForProd = allProdOrders
                    .map(o => o.reservaid)
                    .filter(id => selectedOrderIds.includes(id));
                  const isAllFilteredSelected =
                    allFilteredIdsForProd.length > 0 &&
                    allFilteredIdsForProd.every(id => selectedOrderIds.includes(id));

                  const isJustCreated = recentlyCreatedProductId === prod.id;

                  return (
                    <div
                      key={prod.id}
                      data-testid={`product-card-${prod.id}`}
                      className={`w-full bg-[#0d0d0f] rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                        isProductChecked
                          ? 'border-red-500/60 ring-1 ring-red-500/30'
                          : isJustCreated
                            ? 'border-emerald-500/60 ring-1 ring-emerald-500/30 shadow-md'
                            : isExpanded
                              ? 'border-zinc-700 ring-1 ring-zinc-700/50'
                              : 'border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      {/* Product Row Header - Mobile First & Anti-Overflow */}
                      <div
                        onClick={() => toggleProductExpand(prod)}
                        className="w-full p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 cursor-pointer select-none"
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <label
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center justify-center cursor-pointer shrink-0 mt-1 sm:mt-0"
                            title="Seleccionar esta página de producto"
                          >
                            <input
                              type="checkbox"
                              data-testid={`select-product-checkbox-${prod.id}`}
                              checked={isProductChecked}
                              onChange={() => toggleSelectProductPage(prod.id)}
                              className="w-4 h-4 rounded accent-[#0b3d2e] cursor-pointer"
                            />
                          </label>
                          <img
                            src={prod.imagen || '/assets/real/galeria-1.jpg'}
                            alt={prod.nombre}
                            className="w-12 h-12 rounded-xl object-cover border border-zinc-800 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-zinc-100 truncate">
                                {prod.nombre}
                              </h3>
                              <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/80 shrink-0">
                                Activo
                              </span>
                              <span
                                className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full shrink-0 ${
                                  hasPixelConfigured
                                    ? 'bg-blue-950 text-blue-300 border border-blue-800/80'
                                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                                }`}
                              >
                                {hasPixelConfigured
                                  ? `🎯 Píxel: ${prod.metaTracking?.pixelId}${hasCapiTokenConfigured ? ' + CAPI' : ''}`
                                  : '🎯 Sin Píxel'}
                              </span>
                              {isJustCreated && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-300 text-[#062319] shrink-0">
                                  ★ Recién Creada
                                </span>
                              )}
                            </div>
                            {/* Badges de precios y link limpios sin desborde */}
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400 mt-1.5">
                              <span className="font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800/80">
                                /?p={prod.slug}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-200 border border-zinc-800/80 font-semibold">
                                1x: {formatGs(prod.precios?.[1] || 189000)}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-900/60 font-bold">
                                2x: {formatGs(prod.precios?.[2] || 358000)}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-zinc-900/80 text-zinc-400 border border-zinc-800/60">
                                {prod.freeShipping === false ? '📦 Con Costo Envío' : '🚚 Envío Gratis'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Botones de Acción: En móvil el botón IA ocupa todo el ancho y los demás van en fila inferior */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t border-zinc-800/60 lg:border-t-0">
                          {/* Botón Principal: Editar con Agente IA (DeepSeek · GLM-5.3) */}
                          <button
                            type="button"
                            data-testid={`edit-with-ai-btn-${prod.id}`}
                            onClick={e => {
                              e.stopPropagation();
                              setEditingProductInBuilder(prod);
                              setActiveMenu('creador');
                            }}
                            className="w-full sm:w-auto h-11 px-4 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-200 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs border border-emerald-600/60 transition-all hover:border-emerald-500 active:scale-98 whitespace-nowrap"
                            title="Abrir Agente Portavoz IA y DeepSeek para editar esta página en tiempo real"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">🤖 Editar con Agente IA (DeepSeek)</span>
                          </button>

                          {/* Fila secundaria de acciones en móviles: Ver Página + Clientes / Ajustes + Eliminar */}
                          <div className="grid grid-cols-12 gap-1.5 w-full sm:w-auto sm:flex sm:items-center">
                            <button
                              type="button"
                              data-testid={`view-live-product-${prod.id}`}
                              onClick={e => {
                                e.stopPropagation();
                                setCurrentProductPage(prod);
                                window.history.pushState({}, '', `/?p=${prod.slug}`);
                                setCurrentView('store');
                              }}
                              className="col-span-5 sm:col-auto h-10 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer border border-zinc-800 transition-colors whitespace-nowrap"
                              title="Abrir y ver esta página de producto en vivo"
                            >
                              <Eye className="w-3.5 h-3.5 shrink-0" />
                              <span>Ver Página</span>
                            </button>

                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                toggleProductExpand(prod);
                              }}
                              className={`col-span-5 sm:col-auto h-10 px-3 rounded-xl text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer border whitespace-nowrap ${
                                isExpanded
                                  ? 'bg-zinc-800 text-white border-zinc-700'
                                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                              }`}
                            >
                              <span>{isExpanded ? 'Cerrar' : 'Clientes / Ajustes'}</span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180 text-white' : 'text-zinc-400'
                                }`}
                              />
                            </button>

                            <button
                              type="button"
                              data-testid={`delete-product-btn-${prod.id}`}
                              onClick={e => {
                                e.stopPropagation();
                                openRedDeleteProductsModal([prod.id]);
                              }}
                              className="col-span-2 sm:col-auto h-10 w-full sm:w-10 rounded-xl bg-zinc-900 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-900/50 flex items-center justify-center cursor-pointer transition-colors"
                              title="Eliminar esta página de producto"
                              aria-label="Eliminar página"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Product Body */}
                      {isExpanded && (
                        <div className="border-t border-zinc-800/90 bg-[#09090b] p-3 sm:p-5 space-y-4 animate-fadeIn">
                          {/* COMPACT PRODUCT TOOLBAR */}
                          <div className="space-y-3">
                            {/* Android Native Segmented Tabs (Vercel Calm) */}
                            <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-900/90 rounded-xl border border-zinc-800">
                              <button
                                type="button"
                                onClick={() => setProductSubTab(prod.id, 'pedidos')}
                                className={`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                                  getProductSubTab(prod.id) === 'pedidos'
                                    ? 'bg-zinc-800 text-white shadow-xs font-semibold'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Pedidos ({allProdOrders.length})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setProductSubTab(prod.id, 'precios')}
                                className={`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                                  getProductSubTab(prod.id) === 'precios'
                                    ? 'bg-zinc-800 text-white shadow-xs font-semibold'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                <Settings className="w-3.5 h-3.5 text-amber-400" />
                                <span>Precios & WA</span>
                              </button>

                              <button
                                type="button"
                                data-testid={`toggle-pixel-config-${prod.id}`}
                                onClick={() => setProductSubTab(prod.id, 'pixel')}
                                className={`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                                  getProductSubTab(prod.id) === 'pixel'
                                    ? 'bg-zinc-800 text-white shadow-xs font-semibold'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                <span className="text-blue-400 text-xs">🎯</span>
                                <span>Píxel & CAPI</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setProductSubTab(prod.id, 'voz')}
                                className={`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                                  getProductSubTab(prod.id) === 'voz'
                                    ? 'bg-zinc-800 text-white shadow-xs font-semibold'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                <Bot className="w-3.5 h-3.5 text-purple-400" />
                                <span>Voz & IA</span>
                              </button>
                            </div>

                            {/* Quick Auto/Manual WhatsApp bar */}
                            <div className="p-2.5 rounded-xl bg-[#0d0d0f] border border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-zinc-300">Modo de Atención:</span>
                                <div className="inline-flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleToggleAutomationSetting('autoCallOnOrder', true);
                                      handleToggleAutomationSetting('autoChatOnOrder', true);
                                    }}
                                    className={`py-1 px-2.5 rounded-md text-xs font-medium cursor-pointer transition-all ${
                                      autoCallOnOrder || autoChatOnOrder
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 shadow-xs'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                                  >
                                    ⚡ Auto (${preferredChannel === 'audio' ? 'Audio' : 'Texto'})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleToggleAutomationSetting('autoCallOnOrder', false);
                                      handleToggleAutomationSetting('autoChatOnOrder', false);
                                    }}
                                    className={`py-1 px-2.5 rounded-md text-xs font-medium cursor-pointer transition-all ${
                                      !autoCallOnOrder && !autoChatOnOrder
                                        ? 'bg-zinc-800 text-white shadow-xs'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                                  >
                                    👆 Manual
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  data-testid={`edit-template-builder-${prod.id}`}
                                  onClick={() => {
                                    setEditingProductInBuilder(prod);
                                    setShowNewProductModal(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 cursor-pointer"
                                >
                                  Plantillas
                                </button>
                                <button
                                  type="button"
                                  data-testid={`quick-autotrain-agent-${prod.id}`}
                                  onClick={() => handleQuickAutoTrainProductAgent(prod)}
                                  className="px-2.5 py-1 rounded-lg border border-emerald-900/60 bg-emerald-950/40 hover:bg-emerald-900/40 text-xs text-emerald-300 cursor-pointer"
                                >
                                  Entrenar 1000x
                                </button>
                                <button
                                  type="button"
                                  data-testid={`clone-ab-angle-${prod.id}`}
                                  onClick={() => handleCloneProductWithNewAngle(prod)}
                                  className="px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 cursor-pointer"
                                >
                                  Clonar A/B
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* TAB PIXEL */}
                          {getProductSubTab(prod.id) === 'pixel' && (
                          <form
                            onSubmit={e => handleSaveProductPixelConfig(e, prod)}
                            data-testid={`product-pixel-token-box-${prod.id}`}
                            className="p-3.5 sm:p-4 rounded-2xl bg-[#0d0d0f] border border-zinc-800 shadow-xs space-y-3"
                          >
                            {/* Referencia fija oficial para no olvidar ni confundir cuentas/píxeles */}
                            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/70 space-y-2 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-black text-emerald-300 text-[11px] uppercase tracking-wider">
                                  📌 Tu Referencia Oficial de Meta Ads (1 Clic para Copiar o Usar)
                                </span>
                                <span className="text-[10px] font-mono text-zinc-400">
                                  Portafolio: <strong className="text-white">Landingcod</strong> · Cuenta (834): <strong className="text-white">Landingcod PY</strong>
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-2">
                                  <div>
                                    <span className="text-[10px] text-zinc-400 block">Portafolio Comercial</span>
                                    <strong className="text-zinc-100 font-mono text-xs">Landingcod</strong>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      try { navigator.clipboard.writeText('Landingcod'); } catch {}
                                      showToast('📋 Copiado Portafolio Comercial: Landingcod');
                                    }}
                                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-[10px] font-bold cursor-pointer"
                                  >
                                    📋 Copiar
                                  </button>
                                </div>
                                <div className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-2">
                                  <div>
                                    <span className="text-[10px] text-emerald-300 block">Cuenta Publicitaria (834)</span>
                                    <strong className="text-white font-mono text-xs">Landingcod PY (1048211497774834)</strong>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      try { navigator.clipboard.writeText('1048211497774834'); } catch {}
                                      showToast('📋 Copiado ID Cuenta 834: 1048211497774834');
                                    }}
                                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-300 font-mono text-[10px] font-bold cursor-pointer"
                                  >
                                    📋 Copiar 834
                                  </button>
                                </div>
                                <div className="p-2 rounded-lg bg-zinc-900/90 border border-emerald-700/70 flex items-center justify-between gap-2">
                                  <div>
                                    <span className="text-[10px] text-emerald-300 block">Píxel de Cuenta 834 (377)</span>
                                    <strong className="text-white font-mono text-xs">Auto Ads 360 (1276031534651377)</strong>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        try { navigator.clipboard.writeText('1276031534651377'); } catch {}
                                        showToast('📋 Copiado ID Píxel Auto Ads 360 (377): 1276031534651377');
                                      }}
                                      className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-300 font-mono text-[10px] font-bold cursor-pointer"
                                    >
                                      📋 Copiar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditPixelId('1276031534651377');
                                        showToast('🎯 Píxel Auto Ads 360 (1276031534651377) colocado en el campo.');
                                      }}
                                      className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-mono text-[10px] font-black cursor-pointer"
                                    >
                                      ⚡ Usar 377
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800">
                                  🎯 Píxel de Facebook & Token de API (Servidor Anti-Apple CAPI)
                                </span>
                                <span className="text-[11px] text-zinc-400 font-medium">
                                  Pegá acá el Píxel y el Token de este producto ({prod.nombre})
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  disabled={testingProductCapi}
                                  data-testid={`test-product-capi-btn-${prod.id}`}
                                  onClick={() => handleTestProductCapi(prod)}
                                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-medium text-xs cursor-pointer transition-colors"
                                >
                                  {testingProductCapi ? 'Probando...' : 'Probar CAPI'}
                                </button>
                                <button
                                  type="submit"
                                  disabled={savingToDb}
                                  data-testid={`save-product-pixel-btn-${prod.id}`}
                                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                                >
                                  <Save className="w-3.5 h-3.5 text-[#e8b23a]" />
                                  <span>{savingToDb ? 'Guardando...' : 'Guardar Píxel y Token'}</span>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                              <div className="sm:col-span-5">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                  ID del Píxel de Facebook (Auto Ads 360: 1276031534651377)
                                </label>
                                <input
                                  type="text"
                                  data-testid={`product-pixel-id-input-${prod.id}`}
                                  value={editPixelId}
                                  onChange={e => setEditPixelId(e.target.value)}
                                  placeholder="1276031534651377 (Píxel Auto Ads 360)"
                                  className="w-full px-3 py-2.5 border border-zinc-800 rounded-xl text-xs font-mono font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
                                />
                              </div>

                              <div className="sm:col-span-7">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                  Token de API de Conversiones (CAPI Access Token)
                                </label>
                                <input
                                  type="text"
                                  data-testid={`product-capi-token-input-${prod.id}`}
                                  value={editCapiToken}
                                  onChange={e => setEditCapiToken(e.target.value)}
                                  placeholder="Pegá aquí tu Token EAAB... de Meta Events Manager"
                                  className="w-full px-3 py-2.5 border border-zinc-800 rounded-xl text-xs font-mono font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
                                />
                              </div>
                            </div>
                          </form>
                          )}

                          {/* TAB PRECIOS */}
                          {(getProductSubTab(prod.id) === 'precios' || showPriceConfig) && (
                            <form
                              onSubmit={handleSaveProductConfig}
                              className="p-3.5 sm:p-4 rounded-2xl bg-[#0d0d0f] border border-zinc-800 shadow-xs space-y-3 animate-fadeIn"
                            >
                              <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-200">
                                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div className="leading-relaxed">
                                  <strong className="text-amber-300 font-bold block text-[11px] uppercase tracking-wide">
                                    💰 Estrategia de Precios Psicológicos y Número de WhatsApp
                                  </strong>
                                  <span className="text-[11px] text-zinc-300 mt-0.5 block">
                                    Ajustá el precio base (1x) y las ofertas por volumen (2x y 3x). También podés asignar un número de WhatsApp dedicado para este producto.
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800">
                                    📦 Configuración de Producto
                                  </span>
                                  <h4 className="text-xs sm:text-sm font-black text-zinc-100 truncate max-w-sm">
                                    {prod.nombre}
                                  </h4>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                  <button
                                    type="button"
                                    onClick={() => setShowPriceConfig(false)}
                                    className="px-2.5 py-1.5 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-xs font-medium text-zinc-400 cursor-pointer transition-colors"
                                  >
                                    Cerrar
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={savingToDb}
                                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all shrink-0"
                                  >
                                    <Save className="w-3.5 h-3.5 text-[#e8b23a]" />
                                    <span>{savingToDb ? 'Guardando...' : 'Guardar Configuración'}</span>
                                  </button>
                                </div>
                              </div>

                              {/* 5 Campos en 1 sola fila responsiva horizontal compacta */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 items-start">
                                <div>
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-0.5">
                                    📱 WhatsApp Ventas
                                  </label>
                                  <input
                                    type="text"
                                    value={editWa}
                                    onChange={e => setEditWa(e.target.value)}
                                    placeholder="Ej: 595973532550"
                                    className="w-full px-2.5 py-2 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-100 outline-none bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500"
                                  />
                                  <span className="text-[9px] text-stone-400 block mt-0.5 truncate font-mono">
                                    +{formatWaPhone(editWa)}
                                  </span>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-0.5">
                                    🏷️ Normal (Tachado)
                                  </label>
                                  <input
                                    type="number"
                                    value={editPriceNormal}
                                    onChange={e => setEditPriceNormal(Number(e.target.value))}
                                    className="w-full px-2.5 py-2 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-100 outline-none bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500"
                                  />
                                  <span className="text-[9px] text-stone-400 block mt-0.5 truncate line-through">
                                    {formatGs(editPriceNormal)}
                                  </span>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-0.5">
                                    📦 Pack 1 un.
                                  </label>
                                  <input
                                    type="number"
                                    value={editPricePack1}
                                    onChange={e => setEditPricePack1(Number(e.target.value))}
                                    className="w-full px-2.5 py-2 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-100 outline-none bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500"
                                  />
                                  <span className="text-[9px] text-stone-400 block mt-0.5 truncate">
                                    {formatGs(editPricePack1)}
                                  </span>
                                </div>

                                <div className="bg-zinc-900/60 p-1.5 rounded-xl border border-emerald-900/60">
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#0a7a4a] mb-0.5 flex items-center justify-between">
                                    <span>📦 Pack 2 un.</span>
                                    <span className="text-[9px] bg-[#0a7a4a] text-white px-1 rounded font-bold">
                                      Popular
                                    </span>
                                  </label>
                                  <input
                                    type="number"
                                    value={editPricePack2}
                                    onChange={e => setEditPricePack2(Number(e.target.value))}
                                    className="w-full px-2.5 py-2 border border-emerald-800 rounded-xl text-xs font-bold outline-none bg-zinc-900 text-emerald-400 focus:border-emerald-500"
                                  />
                                  <span className="text-[9px] text-emerald-700 block mt-0.5 truncate font-bold">
                                    {formatGs(editPricePack2)}
                                  </span>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-0.5">
                                    📦 Pack 3 un.
                                  </label>
                                  <input
                                    type="number"
                                    value={editPricePack3}
                                    onChange={e => setEditPricePack3(Number(e.target.value))}
                                    className="w-full px-2.5 py-2 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-100 outline-none bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500"
                                  />
                                  <span className="text-[9px] text-stone-400 block mt-0.5 truncate">
                                    {formatGs(editPricePack3)}
                                  </span>
                                </div>
                              </div>
                            </form>
                          )}

                          {/* TAB VOZ & OPCIONES */}
                          {(getProductSubTab(prod.id) === 'voz' || showVoiceCatalog) && (
                            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0d0d0f] text-zinc-100 border border-zinc-800 shadow-xs space-y-3 animate-fadeIn">
                              <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-900/50 flex items-start gap-2.5 text-xs text-purple-200">
                                <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                <div className="leading-relaxed">
                                  <strong className="text-purple-300 font-bold block text-[11px] uppercase tracking-wide">
                                    🎙️ Selección de Voz Humana para Confirmación Telefónica
                                  </strong>
                                  <span className="text-[11px] text-zinc-300 mt-0.5 block">
                                    El Agente Telefónico llamará automáticamente al comprador usando la voz que selecciones aquí para confirmar su horario de recepción del paquete.
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                  <span className="font-bold text-zinc-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                    <Bot className="w-4 h-4 text-emerald-400" />
                                    <span>Voces Oficiales · Deepgram Aura-2</span>
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowVoiceCatalog(false)}
                                  className="text-zinc-400 hover:text-white text-xs font-bold px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 cursor-pointer transition-colors"
                                >
                                  Cerrar ✕
                                </button>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                {voicesCatalog.map(voice => {
                                  const isSelected = voice.id === selectedVoiceId;
                                  return (
                                    <div
                                      key={voice.id}
                                      className={`p-2.5 rounded-xl border text-[11px] transition-all flex flex-col justify-between gap-2 ${
                                        isSelected
                                          ? 'bg-emerald-950/70 border-emerald-600 shadow-xs'
                                          : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                                      }`}
                                    >
                                      <div>
                                        <div className="flex items-center justify-between text-[9px] font-bold">
                                          <span className={voice.gender === 'Femenina' ? 'text-pink-400' : 'text-blue-400'}>
                                            {voice.gender === 'Femenina' ? '👩 Mujer' : '👨 Hombre'}
                                          </span>
                                          {isSelected && (
                                            <span className="text-emerald-400 uppercase font-bold tracking-wide">Activa</span>
                                          )}
                                        </div>
                                        <div className="font-bold text-zinc-100 truncate mt-1">
                                          {voice.name.split(' (')[0]}
                                        </div>
                                        <div className="text-[10px] text-zinc-400 line-clamp-2">
                                          {voice.description}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 pt-1">
                                        <button
                                          type="button"
                                          onClick={() => handleTestVoiceSample(voice)}
                                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer transition-colors"
                                          title={`Probar voz de ${voice.name}`}
                                        >
                                          <Volume2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={savingVoice}
                                          onClick={() => handleSelectAndSaveVoice(voice)}
                                          className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold cursor-pointer text-center truncate transition-all ${
                                            isSelected
                                              ? 'bg-emerald-500 text-black'
                                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                                          }`}
                                        >
                                          {isSelected ? '✓ Activa' : 'Elegir'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* INTERFAZ 1: Panel Exclusivo de Pedidos Confirmados + Función Universal de Logística */}
                          {showConfirmedOrdersPanel && (
                            <ProductConfirmedOrdersPanel
                              product={prod}
                              orders={prodOrders}
                              onUpdateOrderLogistics={async (orderId, updates, toastMsg) => {
                                await updateOrder(orderId, updates);
                                if (toastMsg) showToast(toastMsg);
                              }}
                              onRequestDeleteOrders={openRedDeleteConfirmModal}
                              onClose={() => setShowConfirmedOrdersPanel(false)}
                            />
                          )}

                          {/* INTERFAZ 2: Panel de Avisos al Vendedor en Tiempo Real (Rojo / Verde) y Chat Vendedor <-> Agente */}
                          {showSellerAgentPanel && (
                            <ProductSellerAgentPanel
                              product={prod}
                              orders={prodOrders}
                              onSaveSellerNotificationPhone={async (cleanPhone: string) => {
                                await updateProductPage(prod.id, {
                                  waNotificacionesVendedor: cleanPhone
                                });
                              }}
                              onClose={() => setShowSellerAgentPanel(false)}
                              showToast={showToast}
                            />
                          )}

                          {/* TAB PEDIDOS */}
                          {getProductSubTab(prod.id) === 'pedidos' && (
                          <div className="space-y-3 pt-1">
                            <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-300">
                              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              <div className="leading-relaxed">
                                <strong className="text-zinc-200 font-bold block text-[11px] uppercase tracking-wide">
                                  📦 Lista de Clientes y Gestión de Entregas (COD)
                                </strong>
                                <span className="text-[11px] text-zinc-400 mt-0.5 block">
                                  Tocá cualquier pedido para ver los datos cargados por el cliente, abrir el chat de WhatsApp con 1 clic o actualizar el estado de entrega para tu transportadora.
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-100">
                                  Clientes de este Producto ({prodOrders.length} de {allProdOrders.length})
                                </h5>
                                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                                  Sincronizado con Base de Datos
                                </span>
                              </div>
                              <span className="text-xs font-mono text-zinc-400">
                                Total Ventas Activas:{' '}
                                <strong className="text-emerald-400 font-bold">
                                  {formatGs(totalVentasProd)}
                                </strong>
                              </span>
                            </div>

                            {/* BARRA DE FILTROS (POR NOMBRE, POR TELÉFONO Y ARCHIVADOS) + SELECCIÓN MÚLTIPLE Y ACCIONES EN LOTE */}
                            <div className="p-3 sm:p-4 rounded-2xl bg-[#0d0d0f] border border-zinc-800 shadow-xs space-y-3">
                              {/* Fila 1: Buscador por Nombre, Buscador por Teléfono y Pestañas Activos / Archivados / Todos */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
                                <div className="lg:col-span-3">
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                    🔍 Filtrar por Nombre o Reserva
                                  </label>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      data-testid="admin-filter-name"
                                      value={filterOrderName}
                                      onChange={e => {
                                        setFilterOrderName(e.target.value);
                                        setProductCurrentPage(prod.id, 1);
                                      }}
                                      placeholder="Ej: Christopher, María o NX-..."
                                      className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-zinc-800 text-xs font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
                                    />
                                    {filterOrderName && (
                                      <button
                                        type="button"
                                        onClick={() => setFilterOrderName('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-zinc-300 text-xs font-black cursor-pointer"
                                        title="Limpiar filtro de nombre"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="lg:col-span-4">
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                    📱 Filtrar por Número de Teléfono
                                  </label>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      data-testid="admin-filter-phone"
                                      value={filterOrderPhone}
                                      onChange={e => {
                                        setFilterOrderPhone(e.target.value);
                                        setProductCurrentPage(prod.id, 1);
                                      }}
                                      placeholder="Ej: 0973 857 397 o 0981..."
                                      className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-zinc-800 text-xs font-mono font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
                                    />
                                    {filterOrderPhone && (
                                      <button
                                        type="button"
                                        onClick={() => setFilterOrderPhone('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-zinc-300 text-xs font-black cursor-pointer"
                                        title="Limpiar filtro de teléfono"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="lg:col-span-5">
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                    🗄️ Vista de Pedidos (Base de Datos)
                                  </label>
                                  <div className="grid grid-cols-3 gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
                                    <button
                                      type="button"
                                      data-testid="admin-tab-activos"
                                      onClick={() => {
                                        setFilterArchiveMode('activos');
                                        setProductCurrentPage(prod.id, 1);
                                      }}
                                      className={`py-1.5 px-2 rounded-lg text-[11px] font-black cursor-pointer transition-all whitespace-nowrap ${
                                        filterArchiveMode === 'activos'
                                          ? 'bg-zinc-800 text-emerald-400 shadow-xs'
                                          : 'text-zinc-400 hover:text-zinc-200'
                                      }`}
                                    >
                                      📥 Activos ({activeProdOrdersCount})
                                    </button>
                                    <button
                                      type="button"
                                      data-testid="admin-tab-archivados"
                                      onClick={() => {
                                        setFilterArchiveMode('archivados');
                                        setProductCurrentPage(prod.id, 1);
                                      }}
                                      className={`py-1.5 px-2 rounded-lg text-[11px] font-black cursor-pointer transition-all whitespace-nowrap ${
                                        filterArchiveMode === 'archivados'
                                          ? 'bg-zinc-800 text-amber-300 shadow-xs'
                                          : 'text-zinc-400 hover:text-zinc-200'
                                      }`}
                                    >
                                      🗄️ Archivados ({archivedProdOrdersCount})
                                    </button>
                                    <button
                                      type="button"
                                      data-testid="admin-tab-todos"
                                      onClick={() => {
                                        setFilterArchiveMode('todos');
                                        setProductCurrentPage(prod.id, 1);
                                      }}
                                      className={`py-1.5 px-2 rounded-lg text-[11px] font-black cursor-pointer transition-all whitespace-nowrap ${
                                        filterArchiveMode === 'todos'
                                          ? 'bg-zinc-800 text-white shadow-xs'
                                          : 'text-zinc-400 hover:text-zinc-200'
                                      }`}
                                    >
                                      📋 Todos ({allProdOrders.length})
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Fila 2: Selector de Uno o Todos + Acciones Masivas de Archivado y Eliminado con Pop-up Rojo */}
                              <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    data-testid="admin-select-all-btn"
                                    onClick={() => toggleSelectAllOrdersInList(allFilteredIdsForProd)}
                                    disabled={allFilteredIdsForProd.length === 0}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black border inline-flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 ${
                                      isAllFilteredSelected
                                        ? 'bg-zinc-800 text-white border-zinc-700'
                                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      readOnly
                                      checked={isAllFilteredSelected}
                                      className="w-3.5 h-3.5 accent-[#16a34a] pointer-events-none"
                                    />
                                    <span>
                                      {isAllFilteredSelected
                                        ? `Deseleccionar todos (${allFilteredIdsForProd.length})`
                                        : `Seleccionar todos (${allFilteredIdsForProd.length})`}
                                    </span>
                                  </button>

                                  {selectedIdsForProd.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedOrderIds([])}
                                      className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800 cursor-pointer"
                                    >
                                      Limpiar selección ({selectedIdsForProd.length})
                                    </button>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  {filterArchiveMode !== 'archivados' && (
                                    <button
                                      type="button"
                                      data-testid="admin-bulk-archive-btn"
                                      disabled={selectedIdsForProd.length === 0 || isArchivingBatch}
                                      onClick={() => handleArchiveOrders(selectedIdsForProd, true)}
                                      className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-amber-300 border border-zinc-800 shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-all"
                                      title="Archivar todos los pedidos seleccionados directamente en la Base de Datos"
                                    >
                                      <span>🗄️</span>
                                      <span>
                                        Archivar seleccionados ({selectedIdsForProd.length})
                                      </span>
                                    </button>
                                  )}

                                  {filterArchiveMode !== 'activos' && (
                                    <button
                                      type="button"
                                      data-testid="admin-bulk-unarchive-btn"
                                      disabled={selectedIdsForProd.length === 0 || isArchivingBatch}
                                      onClick={() => handleArchiveOrders(selectedIdsForProd, false)}
                                      className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white border border-emerald-800 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-all"
                                      title="Restaurar los pedidos seleccionados a Activos en la Base de Datos"
                                    >
                                      <span>📤</span>
                                      <span>
                                        Desarchivar seleccionados ({selectedIdsForProd.length})
                                      </span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    data-testid="admin-bulk-delete-btn"
                                    disabled={selectedIdsForProd.length === 0}
                                    onClick={() => openRedDeleteConfirmModal(selectedIdsForProd)}
                                    className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-40 text-white border border-red-800 shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-all"
                                    title="Eliminar los pedidos seleccionados de la Base de Datos (abre confirmación roja)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>
                                      Eliminar seleccionados ({selectedIdsForProd.length})
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              {/* Cabecera Compacta de la Lista de Tarjetas Horizontales */}
                              <div className="px-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <input
                                    type="checkbox"
                                    data-testid="admin-table-select-all-checkbox"
                                    checked={isAllFilteredSelected}
                                    onChange={() => toggleSelectAllOrdersInList(allFilteredIdsForProd)}
                                    title="Seleccionar o deseleccionar todos los pedidos filtrados"
                                    className="w-3.5 h-3.5 accent-[#16a34a] cursor-pointer shrink-0"
                                  />
                                  <span className="truncate">Pedidos (Tocá cualquier tarjeta para abrir toda la información)</span>
                                </div>
                                <div className="hidden sm:flex items-center gap-3 text-[10px] font-bold text-zinc-400 shrink-0">
                                  <span className="inline-flex items-center gap-1 text-emerald-400">
                                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-950 border border-emerald-500 inline-block" />
                                    Verde = Confirmado
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-zinc-400">
                                    <span className="w-2.5 h-2.5 rounded-xs bg-zinc-900 border border-zinc-700 inline-block" />
                                    Gris = Pendiente
                                  </span>
                                </div>
                              </div>

                              {paginatedOrders.length === 0 ? (
                                <div className="py-8 px-4 rounded-xl border border-zinc-800 bg-[#0d0d0f] text-center text-zinc-500 text-xs">
                                  {filterOrderName || filterOrderPhone
                                    ? 'No se encontraron pedidos que coincidan con el nombre o teléfono buscado.'
                                    : filterArchiveMode === 'archivados'
                                      ? 'No tenés pedidos archivados en este momento.'
                                      : 'Aún no hay ventas activas registradas para este producto.'}
                                </div>
                              ) : (
                                paginatedOrders.map((ord, idx) => {
                                  const orderDate = ord.fecha ? new Date(ord.fecha) : new Date();
                                  const formattedTime = orderDate.toLocaleTimeString('es-PY', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false
                                  });
                                  const fullFormattedDate = orderDate.toLocaleDateString('es-PY');
                                  const cleanOrdPhone = formatWaPhone(ord.celular);
                                  const chatInfo = chatsSummary[cleanOrdPhone];
                                  const msgCount = chatInfo?.totalMessages || 0;
                                  const isConfirmedByAgent = isOrderConfirmedByAgent(ord);
                                  const comparison = isConfirmedByAgent
                                    ? buildOrderComparisonSummary(ord)
                                    : null;
                                  const isOrderOpen = expandedBottomSummaryOrderId === ord.reservaid;
                                  const isRowSelected = selectedOrderIds.includes(ord.reservaid);
                                  const rowNumber = startIndex + idx + 1;
                                  const shortCity = String(ord.ciudad || '').split(' - ')[0].split(',')[0].trim();
                                  const gpsUrl =
                                    ord.gpsLink ||
                                    (typeof ord.gpsLat === 'number' && typeof ord.gpsLng === 'number'
                                      ? `https://www.google.com/maps?q=${ord.gpsLat.toFixed(6)},${ord.gpsLng.toFixed(6)}`
                                      : null);

                                  return (
                                    <div key={ord.reservaid} className="w-full">
                                      {/* TARJETA HORIZONTAL ULTRA-COMPACTA DE ALTURA FIJA E IDÉNTICA (44px) */}
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        aria-expanded={isOrderOpen}
                                        data-testid={`admin-order-card-${ord.reservaid}`}
                                        onClick={() =>
                                          setExpandedBottomSummaryOrderId(prev =>
                                            prev === ord.reservaid ? null : ord.reservaid
                                          )
                                        }
                                        onKeyDown={e => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setExpandedBottomSummaryOrderId(prev =>
                                              prev === ord.reservaid ? null : ord.reservaid
                                            );
                                          }
                                        }}
                                        className={`w-full h-11 min-h-[44px] max-h-[44px] px-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors cursor-pointer select-none overflow-hidden ${
                                          isConfirmedByAgent
                                            ? 'bg-[#0d0d0f] hover:bg-zinc-900/90 border-emerald-800/80 text-zinc-100'
                                            : 'bg-[#0d0d0f] hover:bg-zinc-900/90 border-zinc-800 text-zinc-200'
                                        } ${isRowSelected ? 'ring-1 ring-emerald-500/50' : ''}`}
                                      >
                                        {/* IZQUIERDA Y CENTRO: Pequeñas informaciones bien alineadas en 1 sola línea */}
                                        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                                          <input
                                            type="checkbox"
                                            data-testid={`admin-row-checkbox-${ord.reservaid}`}
                                            checked={isRowSelected}
                                            onClick={e => e.stopPropagation()}
                                            onChange={() => toggleSelectOrder(ord.reservaid)}
                                            className="w-3.5 h-3.5 accent-[#16a34a] cursor-pointer shrink-0"
                                            title={`Seleccionar pedido ${ord.reservaid}`}
                                          />

                                          <span
                                            className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 tabular-nums ${
                                              isConfirmedByAgent
                                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                                : 'bg-zinc-800 text-zinc-400'
                                            }`}
                                          >
                                            #{rowNumber}
                                          </span>

                                          <span className="font-mono text-[11px] font-black shrink-0 tabular-nums">
                                            {ord.reservaid}
                                          </span>

                                          {/* Estado Compacto */}
                                          {isConfirmedByAgent ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[9px] font-black uppercase tracking-tight shrink-0">
                                              <CheckCircle2 className="w-2.5 h-2.5" />
                                              <span>Confirmado</span>
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-800/70 text-amber-300 text-[9px] font-bold uppercase tracking-tight shrink-0">
                                              Pendiente
                                            </span>
                                          )}

                                          {ord.archivado && (
                                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 text-[9px] font-black uppercase shrink-0">
                                              🗄️ Arch.
                                            </span>
                                          )}

                                          {/* Nombre del Cliente */}
                                          <span
                                            className="font-extrabold text-xs truncate max-w-[135px] sm:max-w-[155px] shrink-0 text-zinc-100"
                                            title={ord.nombre}
                                          >
                                            {ord.nombre}
                                          </span>

                                          {/* Teléfono 4-3-3 */}
                                          <span
                                            className={`hidden sm:inline-block font-mono text-[11px] font-bold tabular-nums whitespace-nowrap shrink-0 ${
                                              isConfirmedByAgent ? 'text-emerald-400' : 'text-zinc-400'
                                            }`}
                                          >
                                            {formatParaguayanPhone433(ord.celular)}
                                          </span>

                                          {/* Ciudad resumida */}
                                          {shortCity && (
                                            <span
                                              className={`hidden md:inline-block text-[11px] font-semibold truncate min-w-0 max-w-[120px] ${
                                                isConfirmedByAgent ? 'text-emerald-400' : 'text-zinc-400'
                                              }`}
                                              title={`${ord.ciudad}, ${ord.departamento}`}
                                            >
                                              {ord.tipoVivienda === 'edificio' ? '🏢' : '📍'} {shortCity}
                                            </span>
                                          )}
                                        </div>

                                        {/* DERECHA: Precio + Accesos Rápidos Compactos (Chatear, Archivar, Eliminar y Abrir Detalle) */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {/* Pack y Monto siempre 100% visible */}
                                          <span
                                            className={`hidden lg:inline-block font-mono text-[11px] font-black tabular-nums whitespace-nowrap px-1.5 py-0.5 rounded ${
                                              isConfirmedByAgent
                                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                                                : 'bg-zinc-900 text-emerald-400 border border-zinc-800'
                                            }`}
                                          >
                                            {ord.cantidad}u · {formatGs(ord.monto)}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={e => {
                                              e.stopPropagation();
                                              handleOpenOrderWhatsAppChat(ord, preferredChannel);
                                            }}
                                            className="h-8 px-3 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-all bg-[#25D366] hover:bg-[#1ebd5a] text-[#041911] shadow-xs"
                                            title="Abrir chat de este pedido"
                                          >
                                            <MessageCircle className="w-3 h-3 text-[#041911]" />
                                            <span className="hidden sm:inline">Chatear</span>
                                            {msgCount > 0 && (
                                              <span className="px-1 rounded-full bg-[#0b3d2e] text-[#25D366] text-[9px] font-black tabular-nums">
                                                {msgCount}
                                              </span>
                                            )}
                                          </button>

                                          <button
                                            type="button"
                                            data-testid={`admin-row-archive-${ord.reservaid}`}
                                            disabled={isArchivingBatch}
                                            onClick={e => {
                                              e.stopPropagation();
                                              handleArchiveOrders([ord.reservaid], !ord.archivado);
                                            }}
                                            className={`h-7 px-2 rounded-lg text-[10px] font-black border transition-all cursor-pointer inline-flex items-center gap-1 ${
                                              ord.archivado
                                                ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                                                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
                                            }`}
                                            title={
                                              ord.archivado
                                                ? 'Desarchivar pedido en Base de Datos'
                                                : 'Archivar pedido en Base de Datos'
                                            }
                                          >
                                            <span>{ord.archivado ? '📤' : '🗄️'}</span>
                                            <span className="hidden xl:inline">
                                              {ord.archivado ? 'Desarchivar' : 'Archivar'}
                                            </span>
                                          </button>

                                          <button
                                            type="button"
                                            data-testid={`admin-row-delete-${ord.reservaid}`}
                                            onClick={e => {
                                              e.stopPropagation();
                                              openRedDeleteConfirmModal([ord.reservaid]);
                                            }}
                                            className="h-7 w-7 rounded-lg text-white bg-red-600/90 hover:bg-red-600 border border-red-800 flex items-center justify-center transition-all cursor-pointer"
                                            title="Eliminar este pedido de la Base de Datos (abre confirmación roja)"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>

                                          <span
                                            className={`h-7 px-2 rounded-lg text-[10px] font-black inline-flex items-center gap-1 border ${
                                              isConfirmedByAgent
                                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                                : 'bg-zinc-900 text-zinc-300 border-zinc-800'
                                            }`}
                                            title="Clic para ver u ocultar toda la información dentro del pedido"
                                          >
                                            <span className="hidden md:inline">
                                              {isOrderOpen ? 'Cerrar' : 'Abrir'}
                                            </span>
                                            <ChevronDown
                                              className={`w-3.5 h-3.5 transition-transform ${
                                                isOrderOpen ? 'rotate-180' : ''
                                              }`}
                                            />
                                          </span>
                                        </div>
                                      </div>

                                      {/* DETALLE COMPLETO DEL PEDIDO: SE ABRE SOLAMENTE AL HACER CLIC EN LA TARJETA */}
                                      {isOrderOpen && (
                                        <div
                                          data-testid={`admin-order-detail-panel-${ord.reservaid}`}
                                          className={`mt-1 p-3.5 sm:p-4 rounded-xl border space-y-3 animate-fadeIn ${
                                            isConfirmedByAgent
                                              ? 'bg-[#09090b] border-emerald-800/80'
                                              : 'bg-[#09090b] border-zinc-800'
                                          }`}
                                        >
                                          {/* Fila Superior del Detalle: Cabecera + Controles de Unidades, Estado y Acciones */}
                                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-800">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-emerald-400 font-mono text-xs font-black">
                                                Pedido #{rowNumber} · {ord.reservaid}
                                              </span>
                                              <span className="text-xs font-bold text-zinc-400">
                                                📅 {fullFormattedDate} a las {formattedTime}hs
                                              </span>
                                              {(ord.waVendedor || prod.wa) && (
                                                <span className="text-[11px] font-mono text-zinc-400">
                                                  · WA Producto: <strong className="text-zinc-200">+{formatWaPhone(ord.waVendedor || prod.wa)}</strong>
                                                </span>
                                              )}
                                            </div>

                                            {/* Controles de Pack (+/-), Precio y Estado */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <div className="inline-flex items-center gap-1 bg-zinc-900 rounded-lg px-2 py-1 border border-zinc-800">
                                                <span className="text-[10px] font-black uppercase text-zinc-400 mr-1">
                                                  Pack:
                                                </span>
                                                <button
                                                  type="button"
                                                  title="Disminuir 1 unidad"
                                                  onClick={async e => {
                                                    e.stopPropagation();
                                                    const currentQty = Number(ord.cantidad) || 1;
                                                    if (currentQty <= 1) return;
                                                    const nextQty = currentQty - 1;
                                                    const p1 = Number(prod.precios?.[1]) || 189000;
                                                    const p2 = Number(prod.precios?.[2]) || 358000;
                                                    const p3 = Number(prod.precios?.[3]) || 507000;
                                                    const nextMonto =
                                                      nextQty === 1
                                                        ? p1
                                                        : nextQty === 2
                                                          ? p2
                                                          : nextQty === 3
                                                            ? p3
                                                            : p3 + (nextQty - 3) * (p1 - 20000);
                                                    await updateOrder(ord.reservaid, {
                                                      cantidad: nextQty as 1 | 2 | 3,
                                                      monto: nextMonto
                                                    });
                                                    showToast(
                                                      `✏️ Pedido ${ord.reservaid} actualizado a ${nextQty} un. (${formatGs(nextMonto)}).`
                                                    );
                                                  }}
                                                  className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black text-xs flex items-center justify-center cursor-pointer"
                                                >
                                                  -
                                                </button>
                                                <span className="px-1.5 text-xs font-black text-zinc-100 tabular-nums">
                                                  {ord.cantidad} un.
                                                </span>
                                                <button
                                                  type="button"
                                                  title="Aumentar 1 unidad"
                                                  onClick={async e => {
                                                    e.stopPropagation();
                                                    const currentQty = Number(ord.cantidad) || 1;
                                                    const nextQty = currentQty + 1;
                                                    const p1 = Number(prod.precios?.[1]) || 189000;
                                                    const p2 = Number(prod.precios?.[2]) || 358000;
                                                    const p3 = Number(prod.precios?.[3]) || 507000;
                                                    const nextMonto =
                                                      nextQty === 1
                                                        ? p1
                                                        : nextQty === 2
                                                          ? p2
                                                          : nextQty === 3
                                                            ? p3
                                                            : p3 + (nextQty - 3) * (p1 - 20000);
                                                    await updateOrder(ord.reservaid, {
                                                      cantidad: nextQty as 1 | 2 | 3,
                                                      monto: nextMonto
                                                    });
                                                    showToast(
                                                      `✏️ Pedido ${ord.reservaid} actualizado a ${nextQty} un. (${formatGs(nextMonto)}).`
                                                    );
                                                  }}
                                                  className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black text-xs flex items-center justify-center cursor-pointer"
                                                >
                                                  +
                                                </button>
                                                <span className="ml-1.5 font-mono text-xs font-black text-emerald-400 tabular-nums">
                                                  {formatGs(ord.monto)}
                                                </span>
                                              </div>

                                              <select
                                                aria-label={`Estado del pedido ${ord.reservaid}`}
                                                value={ord.estado}
                                                onChange={async e => {
                                                  const next = e.target.value as OrderStatus;
                                                  await updateOrderStatus(ord.reservaid, next);
                                                  showToast(
                                                    `Pedido ${ord.reservaid} actualizado a '${next}'.`
                                                  );
                                                }}
                                                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border outline-none cursor-pointer bg-zinc-900 ${
                                                  isConfirmedByAgent
                                                    ? 'text-emerald-300 border-emerald-700'
                                                    : ord.estado === 'reservado'
                                                      ? 'text-amber-300 border-amber-800'
                                                      : ord.estado === 'en_camino'
                                                        ? 'text-blue-300 border-blue-800'
                                                        : ord.estado === 'entregado_pagado'
                                                          ? 'text-emerald-300 border-emerald-800'
                                                          : 'text-red-300 border-red-800'
                                                }`}
                                              >
                                                <option value="reservado">Reservado</option>
                                                <option value="en_camino">Confirmado / Courier</option>
                                                <option value="entregado_pagado">Entregado</option>
                                                <option value="cancelado">Cancelado</option>
                                              </select>
                                            </div>
                                          </div>

                                          {/* Grilla de Información Completa del Pedido */}
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                            {/* Columna 1: Cliente y Contacto */}
                                            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1.5">
                                              <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                                                👤 Datos del Cliente
                                              </div>
                                              <div className="font-black text-zinc-100 text-sm">
                                                {ord.nombre}
                                              </div>
                                              <div className="font-mono text-xs font-bold text-emerald-400">
                                                📱 {formatParaguayanPhone433(ord.celular)}
                                              </div>
                                              <div className="text-[11px] text-zinc-400">
                                                Forma de pago: <strong className="text-zinc-200">{ord.detalle || 'Efectivo al recibir'}</strong>
                                              </div>
                                            </div>

                                            {/* Columna 2: Dirección y Vivienda */}
                                            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1.5">
                                              <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                                                📍 Ubicación y Dirección
                                              </div>
                                              <div className="font-bold text-zinc-100">
                                                {ord.ciudad}, {ord.departamento}
                                              </div>
                                              <div className="text-zinc-300 leading-snug">
                                                {ord.direccion}
                                              </div>
                                              {ord.tipoVivienda === 'edificio' && (
                                                <div className="p-2 rounded-lg bg-blue-950/50 border border-blue-800/70 text-[11px] text-blue-200">
                                                  <strong>🏢 Edificio:</strong> {ord.nombreEdificio || 'Confirmado'} ·{' '}
                                                  <strong>Piso:</strong> {ord.pisoEdificio || '-'} ·{' '}
                                                  <strong>Dpto:</strong> {ord.departamentoNumero || '-'}
                                                  {ord.detalleRecepcion ? ` · ${ord.detalleRecepcion}` : ''}
                                                </div>
                                              )}
                                            </div>

                                            {/* Columna 3: Referencia de Fachada y Mapa GPS */}
                                            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2 flex flex-col justify-between">
                                              <div className="space-y-1">
                                                <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                                                  🏠 Referencia y GPS Exacto
                                                </div>
                                                {ord.referenciaCasa ? (
                                                  <div className="p-2 rounded-lg bg-emerald-950/50 border border-emerald-800/70 text-emerald-200 font-bold text-xs flex items-start gap-1.5">
                                                    <Home className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                                    <span>{ord.referenciaCasa}</span>
                                                  </div>
                                                ) : (
                                                  <div className="text-zinc-500 italic text-[11px]">
                                                    Pendiente de confirmar referencia de fachada en el chat.
                                                  </div>
                                                )}
                                              </div>

                                              {gpsUrl && (
                                                <a
                                                  href={gpsUrl}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-black text-[11px] inline-flex items-center justify-center gap-1.5 transition-colors"
                                                >
                                                  <span>📍 Abrir Mapa GPS Exacto</span>
                                                  <ExternalLink className="w-3 h-3" />
                                                </a>
                                              )}
                                            </div>
                                          </div>

                                          {/* Si está confirmado por el Agente IA, mostrar Comparativa Formulario Web vs Chat IA */}
                                          {isConfirmedByAgent && comparison && (
                                            <div className="p-3 rounded-xl bg-zinc-900/80 border border-emerald-800/70 space-y-2">
                                              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-zinc-800">
                                                <span className="text-[11px] font-black uppercase text-zinc-100 flex items-center gap-1.5">
                                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                  Resumen del Agente IA: Datos Formulario Web vs. Datos Confirmados en Chat
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-black uppercase">
                                                  ✓ 100% Verificado por IA
                                                </span>
                                              </div>
                                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                                                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                                                  <div className="text-[9px] font-black uppercase text-zinc-400">
                                                    1. Datos Formulario Web
                                                  </div>
                                                  <div className="font-bold text-zinc-100 mt-0.5">
                                                    {comparison.nombreWeb} ({comparison.celularWeb})
                                                  </div>
                                                  <div className="text-zinc-400">
                                                    {comparison.ubicacionWeb} — {comparison.direccionWeb}
                                                  </div>
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/60">
                                                  <div className="text-[9px] font-black uppercase text-emerald-400">
                                                    2. Datos Confirmados Chat IA
                                                  </div>
                                                  <div className="font-bold text-emerald-200 mt-0.5">
                                                    {comparison.nombreConfirmado} ({comparison.celularConfirmado})
                                                  </div>
                                                  <div className="text-zinc-300">
                                                    {comparison.ubicacionConfirmada} — {comparison.direccionConfirmada}
                                                  </div>
                                                  <div className="text-emerald-300 font-black mt-0.5">
                                                    🏠 Ref: {comparison.referenciaConfirmada}
                                                  </div>
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200">
                                                  <div className="text-[9px] font-black uppercase text-amber-400">
                                                    3. Dictamen del Agente IA
                                                  </div>
                                                  <p className="text-[11px] text-zinc-300 mt-0.5 leading-snug">
                                                    {ord.resumenConfirmacionIA || comparison.resumenTexto}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* BARRA DE PAGINACIÓN DE 10 EN 10 */}
                            {prodOrders.length > 0 && (
                              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 px-1">
                                <span className="text-xs font-bold text-zinc-400">
                                  Mostrando{' '}
                                  <strong className="text-zinc-100">{startIndex + 1}</strong> a{' '}
                                  <strong className="text-zinc-100">
                                    {Math.min(startIndex + ITEMS_PER_PAGE, prodOrders.length)}
                                  </strong>{' '}
                                  de <strong className="text-zinc-100">{prodOrders.length}</strong>{' '}
                                  clientes (10 por página)
                                </span>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    disabled={currentPage <= 1}
                                    onClick={() => setProductCurrentPage(prod.id, currentPage - 1)}
                                    className="px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-xs font-bold text-zinc-200 flex items-center gap-1 cursor-pointer"
                                  >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                    <span>Anterior</span>
                                  </button>

                                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(
                                    pageNum => (
                                      <button
                                        key={pageNum}
                                        type="button"
                                        onClick={() => setProductCurrentPage(prod.id, pageNum)}
                                        className={`w-8 h-8 rounded-xl text-xs font-black cursor-pointer transition-all ${pageNum === currentPage
                                            ? 'bg-emerald-500 text-black shadow-xs'
                                            : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                                          }`}
                                      >
                                        {pageNum}
                                      </button>
                                    )
                                  )}

                                  <button
                                    type="button"
                                    disabled={currentPage >= totalPages}
                                    onClick={() => setProductCurrentPage(prod.id, currentPage + 1)}
                                    className="px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-xs font-bold text-zinc-200 flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>Siguiente</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* INTERFAZ 2: CENTRO DEDICADO DE MÚLTIPLES WHATSAPPS       */}
          {/* ======================================================== */}
          {activeMenu === 'whatsapp' && (
            <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
              <AdminSectionGuide
                id="whatsapp"
                title="WhatsApp Multi-Línea & Asistente IA"
                subtitle="Conectá todas tus líneas de WhatsApp para atención y confirmación automática 24/7"
                badge="Guía de WhatsApp"
                steps={[
                  {
                    icon: '📲',
                    title: 'Vinculación en 2 Segundos',
                    description: 'Conectá tu línea escaneando el código QR o usando el código numérico de 8 dígitos desde WhatsApp > Dispositivos Vinculados.'
                  },
                  {
                    icon: '🤖',
                    title: 'Confirmación sin Errores',
                    description: 'El Agente IA le escribe al comprador, confirma la dirección exacta, solicita la ubicación GPS y notifica al vendedor.'
                  },
                  {
                    icon: '🛡️',
                    title: 'Anti-Bloqueo Inteligente',
                    description: 'Tiempos de respuesta y pausas humanas realistas para proteger tus chips de suspensiones o bloqueos.'
                  }
                ]}
                proTip="Asigná una línea exclusiva para confirmación de pedidos y otra para atención al cliente para acelerar las entregas."
              />

              {/* Top Banner: Add Unlimited WhatsApp Lines */}
              <div className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-mono uppercase tracking-wider">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sincronización Multi-Línea Ilimitada</span>
                  </div>
                  <h2 className="text-lg font-bold text-zinc-100">
                    Administración de Cuentas de WhatsApp ({waSessions.length})
                  </h2>
                  <p className="text-xs text-zinc-400 max-w-2xl">
                    Desde esta interfaz dedicada podés vincular y sincronizar todos los números de
                    WhatsApp que quieras (por Código QR o por Código Numérico de 8 dígitos).
                  </p>
                </div>

                <form
                  onSubmit={handleAddWhatsAppSession}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto"
                >
                  <input
                    type="text"
                    value={newSessionLabel}
                    onChange={e => setNewSessionLabel(e.target.value)}
                    placeholder="Nombre (ej: WhatsApp Ventas #2)..."
                    className="px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 text-xs font-medium outline-none min-w-[230px] focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={addingSession}
                    className="px-5 py-2.5 rounded-2xl bg-[#25D366] hover:bg-[#1ebd5a] text-[#041911] font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shrink-0 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{addingSession ? 'Agregando...' : 'Agregar Nuevo WhatsApp'}</span>
                  </button>
                </form>
              </div>

              {/* Grid of Unlimited WhatsApp Sessions */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {waSessions.map((session, idx) => {
                  const isLoading = Boolean(loadingSessionMap[session.id]);
                  const phoneInputVal = pairingInputs[session.id] || '';

                  return (
                    <div
                      key={session.id}
                      className="bg-[#0d0d0f] rounded-2xl border border-zinc-800 shadow-xs overflow-hidden flex flex-col justify-between"
                    >
                      {/* Card Header */}
                      <div className="p-5 bg-gradient-to-r from-[#075E54] to-[#0b3d2e] text-white flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-[#25D366] text-[#041911] flex items-center justify-center font-black shrink-0 shadow-xs">
                            #{idx + 1}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-black truncate">{session.label}</h3>
                            <span className="text-[11px] text-emerald-200 font-bold flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${session.status === 'connected'
                                    ? 'bg-[#25D366] animate-pulse'
                                    : 'bg-amber-400'
                                  }`}
                              />
                              {session.status === 'connected'
                                ? `Conectado (+${session.connectedPhone})`
                                : session.status === 'syncing'
                                  ? 'Sincronizando...'
                                  : session.status === 'qr_ready'
                                    ? 'QR Listo para Escanear'
                                    : 'Preparando QR...'}
                            </span>
                          </div>
                        </div>

                        {waSessions.length > 1 && (
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleRemoveWhatsAppSession(session.id, session.label)}
                            className="p-2 rounded-xl bg-white/10 hover:bg-red-600 text-white transition-colors cursor-pointer"
                            title="Eliminar esta línea de WhatsApp"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Card Body */}
                      <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                        {session.status === 'connected' ? (
                          <div className="p-5 rounded-2xl bg-zinc-900 border border-emerald-500/50 text-center space-y-3 my-auto">
                            <div className="w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center mx-auto shadow-md">
                              <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-950">
                                Línea Activa en Tiempo Real
                              </span>
                              <h4 className="text-lg font-bold text-zinc-100 mt-2">
                                +{session.connectedPhone}
                              </h4>
                              <p className="text-xs text-zinc-400 mt-1">
                                Este WhatsApp está sincronizado y listo para atender pedidos de tus
                                productos.
                              </p>
                            </div>
                            <div className="pt-2">
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleDisconnectSession(session.id)}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black cursor-pointer"
                              >
                                Desvincular / Cambiar Número
                              </button>
                            </div>
                          </div>
                        ) : session.status === 'syncing' ? (
                          <div className="p-6 rounded-2xl bg-emerald-50 border-2 border-emerald-400 text-center space-y-3 my-auto">
                            <RefreshCw className="w-10 h-10 text-[#0a7a4a] animate-spin mx-auto" />
                            <h4 className="text-sm font-black text-zinc-100">
                              ¡Sincronizando con tu celular!
                            </h4>
                            <p className="text-xs text-zinc-400">
                              Mantené WhatsApp abierto en tu teléfono unos segundos mientras se
                              completa la conexión.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* QR Box */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center min-h-[230px] text-center">
                              {session.qrDataUrl ? (
                                <div className="space-y-2 flex flex-col items-center">
                                  <img
                                    src={session.qrDataUrl}
                                    alt={`QR ${session.label}`}
                                    className="w-52 h-52 rounded-2xl border-4 border-[#0b3d2e] shadow-md bg-white p-1"
                                  />
                                  <div className="flex items-center gap-2 pt-1">
                                    <span className="text-[11px] font-black text-[#0a7a4a]">
                                      Escaneá este QR con tu WhatsApp
                                    </span>
                                    <button
                                      type="button"
                                      disabled={isLoading}
                                      onClick={() => handleConnectSession(session.id, true)}
                                      className="text-[11px] font-black text-zinc-400 hover:text-zinc-100 underline cursor-pointer"
                                    >
                                      Refrescar QR
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3 py-6">
                                  <RefreshCw className="w-8 h-8 text-[#0a7a4a] animate-spin mx-auto" />
                                  <p className="text-xs font-bold text-zinc-400">
                                    Generando código QR para {session.label}...
                                  </p>
                                  <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleConnectSession(session.id, true)}
                                    className="px-4 py-2 rounded-xl bg-[#0b3d2e] text-white text-xs font-black cursor-pointer"
                                  >
                                    Generar Nuevo QR
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* 8-Digit Pairing Code Option */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-left space-y-2">
                              <div className="text-[11px] font-semibold text-zinc-300">
                                📲 ¿Preferís vincular con código numérico de 8 dígitos?
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={phoneInputVal}
                                  onChange={e =>
                                    setPairingInputs(prev => ({
                                      ...prev,
                                      [session.id]: e.target.value
                                    }))
                                  }
                                  placeholder="Ej: 0981123456"
                                  className="flex-1 px-3 py-2 rounded-xl border border-zinc-800 bg-black text-xs font-mono text-zinc-100 outline-none placeholder-zinc-500 focus:border-emerald-500"
                                />
                                <button
                                  type="button"
                                  disabled={isLoading || !phoneInputVal.trim()}
                                  onClick={() => handleRequestSessionPairingCode(session.id)}
                                  className="px-3 py-1.5 rounded-xl bg-[#0b3d2e] hover:bg-[#135944] disabled:opacity-50 text-white text-[11px] font-black cursor-pointer shrink-0"
                                >
                                  Pedir Código
                                </button>
                              </div>
                              {session.pairingCode && (
                                <div className="p-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-center">
                                  <span className="text-[10px] font-bold text-emerald-900 block">
                                    Ingresá este código en tu celular:
                                  </span>
                                  <strong className="text-lg font-mono font-black tracking-widest text-zinc-100">
                                    {session.pairingCode}
                                  </strong>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* INTERFAZ 3: CONEXIÓN API DE DEEPGRAM (TTS/STT)          */}
          {/* ======================================================== */}
          {activeMenu === 'deepgram' && (
            <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto">
              <AdminSectionGuide
                id="deepgram"
                title="Voz Telefónica Deepgram Aura-2"
                subtitle="Llamadas automáticas de confirmación y síntesis de voz humana en español"
                badge="Guía de Voz Telefónica"
                steps={[
                  {
                    icon: '🔑',
                    title: 'API Key Centralizada',
                    description: 'Una sola clave de Deepgram activa la escucha de llamadas (Nova-3 STT) y la voz humana ultra-realista (Aura-2 TTS).'
                  },
                  {
                    icon: '🎙️',
                    title: 'Catálogo de Voces',
                    description: 'Voces masculinas y femeninas con dicción natural en español para contactar al comprador.'
                  },
                  {
                    icon: '🔊',
                    title: 'Prueba en Vivo',
                    description: 'Tocá "Probar Conexión" para escuchar una muestra de audio generada al instante en tu celular.'
                  }
                ]}
                proTip="La voz 'Aura Luna' transmite calidez y confianza para confirmar la disponibilidad del comprador."
              />

              {/* Tab Selector: Deepgram Todo-en-Uno vs Cerebro LLM */}
              <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 gap-1 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => setActiveMenu("deepgram")}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-zinc-800 text-white shadow-xs flex items-center justify-center gap-2"
                >
                  <Zap className="w-3.5 h-3.5 text-[#e8b23a]" />
                  <span>🎙️ Deepgram Todo-en-Uno</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMenu("openrouter")}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5 text-emerald-400" />
                  <span>🤖 Cerebro GLM-5.3</span>
                </button>
              </div>

              <div className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg">
                    <Zap className="w-6 h-6 text-[#e8b23a]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-zinc-100">Infraestructura de Voz Deepgram (STT + TTS)</h2>
                    <p className="text-xs text-zinc-400">Deepgram impulsa la escucha (Nova-3 STT) y la voz humana ultra-realista (Aura-2 TTS) para llamadas automáticas a compradores.</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold ${deepgramHasKey ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80' : 'bg-amber-950/80 text-amber-300 border border-amber-800/80'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${deepgramHasKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {deepgramHasKey ? `✅ Deepgram Activo (${deepgramApiKeyPreview})` : '⚠️ No hay API Key configurada — Las funciones de voz están deshabilitadas'}
                </div>
              </div>

              <div className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-black text-zinc-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#e8b23a]" />
                  API Key de Deepgram
                </h3>
                <p className="text-xs text-zinc-400">
                  Obtiene tu API Key desde{' '}
                  <a href="https://console.deepgram.com" target="_blank" rel="noopener noreferrer" className="text-[#25D366] underline font-bold hover:text-zinc-100">console.deepgram.com</a>
                  {' '}→ API Keys → Create Key
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input type={deepgramShowKey ? 'text' : 'password'} value={deepgramApiKey} onChange={e => setDeepgramApiKey(e.target.value)} placeholder="Pegar tu API Key aquí..." className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]/40 outline-none text-sm font-mono placeholder-zinc-500" />
                    <button type="button" onClick={() => setDeepgramShowKey(prev => !prev)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-zinc-300 cursor-pointer" title={deepgramShowKey ? 'Ocultar' : 'Mostrar'}>
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                  <button type="button" disabled={deepgramSaving || !deepgramApiKey.trim()} onClick={async () => {
                    setDeepgramSaving(true);
                    try {
                      const res = await fetch('/api/deepgram/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: deepgramApiKey.trim() }) });
                      const data = await res.json();
                      if (data?.success) { setDeepgramHasKey(data.hasApiKey); setDeepgramApiKeyPreview(data.apiKeyPreview || ''); setDeepgramApiKey(''); showToast('✅ API Key de Deepgram guardada correctamente'); }
                      else { showToast(`❌ Error: ${data?.error || 'Error desconocido'}`); }
                    } catch (e) { showToast('❌ Error al guardar la API Key'); }
                    setDeepgramSaving(false);
                  }} className="px-5 py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebd5a] text-[#041911] font-black text-sm cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-xs">
                    <Save className="w-4 h-4" />
                    {deepgramSaving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>

              <div className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-black text-zinc-100 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-[#25D366]" />
                  Probar Conexión
                </h3>
                <p className="text-xs text-zinc-400">Verifica que tu API Key funciona correctamente realizando una prueba de síntesis de voz.</p>
                <button type="button" disabled={deepgramTesting || !deepgramHasKey} onClick={async () => {
                  setDeepgramTesting(true);
                  try {
                    const res = await fetch('/api/deepgram/test', { method: 'POST' });
                    const data = await res.json();
                    if (data?.success && data.audioDataUrl) { showToast('✅ Conexión exitosa con Deepgram — Reproduciendo audio...'); const audio = new Audio(data.audioDataUrl); audio.play().catch(() => showToast('🔊 Hacé clic en la pantalla y volvé a probar.')); }
                    else { showToast(`❌ Error: ${data?.error || 'No se pudo conectar'}`); }
                  } catch (e) { showToast('❌ Error al probar la conexión'); }
                  setDeepgramTesting(false);
                }} className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-emerald-300 font-bold text-sm cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-xs">
                  <Volume2 className="w-4 h-4" />
                  {deepgramTesting ? 'Probando...' : 'Probar Conexión'}
                </button>
              </div>

              <div className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-black text-zinc-100 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-[#e8b23a]" />
                  Voces Disponibles (Deepgram Aura-2 · Español)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DEFAULT_DEEPGRAM_CATALOG.map(voice => (
                    <div key={voice.id} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-black uppercase ${voice.gender === 'Femenina' ? 'text-pink-400' : 'text-blue-400'}`}>{voice.gender === 'Femenina' ? '👩 Mujer' : '👨 Hombre'}</span>
                        <span className="text-[9px] font-mono text-zinc-500">{voice.deepgramModel}</span>
                      </div>
                      <div className="font-black text-sm text-zinc-100">{voice.name.split(' (')[0]}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{voice.description}</div>
                      <div className="text-[10px] text-zinc-500 mt-1">{voice.accent}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500">💡 Podés seleccionar la voz activa desde el panel del Agente IA dentro de cada página de producto.</p>
              </div>
            </div>
          )}

        
          {/* ======================================================== */}
          {/* INTERFAZ 4: CEREBRO LLM GLM-5.3 (OPENROUTER)             */}
          {/* ======================================================== */}
          {activeMenu === 'openrouter' && (
            <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto">
              <AdminSectionGuide
                id="openrouter"
                title="Cerebro LLM · Inteligencia Conversacional (GLM-5.3)"
                subtitle="Motor de razonamiento para cierre de ventas, resolución de dudas y objeciones"
                badge="Guía del Cerebro IA"
                steps={[
                  {
                    icon: '🧠',
                    title: 'Modelo GLM-5.3',
                    description: 'Comprende consultas complejas, modismos paraguayos y geografía local para cerrar ventas con empatía.'
                  },
                  {
                    icon: '🗺️',
                    title: 'Validación de Dirección y GPS',
                    description: 'Detecta si la dirección ingresada es casa, edificio o local y solicita referencias precisas para el courier.'
                  },
                  {
                    icon: '🤝',
                    title: 'Oferta de Packs con Descuento',
                    description: 'Propone ofertas psicológicas de 2 y 3 unidades para maximizar el ticket promedio de compra.'
                  }
                ]}
                proTip="El modelo GLM-5.3 ya se encuentra configurado a través de las variables de entorno para una respuesta instantánea."
              />

              {/* Tab Selector: Deepgram Todo-en-Uno vs Cerebro LLM */}
              <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 gap-1 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => setActiveMenu('deepgram')}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-[#e8b23a]" />
                  <span>🎙️ Deepgram Todo-en-Uno</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMenu('openrouter')}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-zinc-800 text-white shadow-xs flex items-center justify-center gap-2"
                >
                  <Bot className="w-3.5 h-3.5 text-emerald-400" />
                  <span>🤖 Cerebro GLM-5.3</span>
                </button>
              </div>

              {/* Header */}
              <div className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-xs">
                    <Bot className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-zinc-100">Cerebro LLM · GLM-5.3 (OpenRouter)</h2>
                    <p className="text-xs text-zinc-400">
                      Modelo conversacional inteligente que atiende dudas de compradores, confirma reservas y asiste al Agente de Codificación en tiempo real.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>Modelo Activo: GLM-5.3 · Conexión directa vía OpenRouter</span>
                </div>
              </div>

              {/* Test Connection */}
              <div className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-3">
                <h3 className="text-sm font-black text-zinc-100 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  Probar Razonamiento del LLM de Deepgram en Vivo
                </h3>
                <p className="text-xs text-zinc-400">
                  Verifica en tiempo real que el agente conversacional de Deepgram (`wss://agent.deepgram.com/v1/agent/converse`) razona y responde sin usar OpenRouter.
                </p>
                <button
                  type="button"
                  disabled={openRouterTesting}
                  onClick={async () => {
                    setOpenRouterTesting(true);
                    setOpenRouterTestReply('');
                    try {
                      const r = await fetch('/api/openrouter/test', { method: 'POST' });
                      const d = await r.json();
                      if (d.success) {
                        setOpenRouterTestReply(d.reply || 'OK');
                        showToast('✅ Respuesta recibida de Deepgram Voice Agent LLM');
                      } else {
                        showToast('❌ Error: ' + (d.error || 'Fallo la conexión'));
                      }
                    } catch (e: any) {
                      showToast('❌ Error de conexión: ' + e?.message);
                    }
                    setOpenRouterTesting(false);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-50 text-emerald-300 font-bold text-sm inline-flex items-center gap-2 cursor-pointer transition-all shadow-xs"
                >
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <span>{openRouterTesting ? 'Probando LLM GLM-5.3...' : 'Probar LLM GLM-5.3'}</span>
                </button>
                {openRouterTestReply && (
                  <div className="mt-3 p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-1">
                    <p className="text-xs font-bold text-emerald-300">Respuesta en vivo de GLM-5.3:</p>
                    <p className="text-sm text-zinc-200">{openRouterTestReply}</p>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-2">
                <h3 className="text-sm font-black text-zinc-100">ℹ️ Arquitectura Todo-en-Uno de Deepgram</h3>
                <ul className="text-xs text-zinc-400 space-y-1.5 list-disc pl-4">
                  <li><strong>STT (Voz a Texto):</strong> Deepgram Nova-3 Español transcribe al instante los audios que envía el cliente.</li>
                  <li><strong>LLM (Cerebro IA):</strong> Deepgram Voice Agent (`open_ai / gpt-4o-mini` gestionado por Deepgram) razona cada paso sin depender de OpenRouter.</li>
                  <li><strong>TTS (Texto a Voz):</strong> Deepgram Aura-2 Español sintetiza notas de voz OGG/Opus nativas para WhatsApp.</li>
                  <li><strong>Flujo de 5 Pasos:</strong> Saludo y disponibilidad → Nombre y Teléfono → Ciudad/Barrio/Calle en texto → Referencia de fachada de casa → Cierre y empaquetado.</li>
                </ul>
              </div>
            </div>
          )}

        </main>

        {/* Mobile Native Android Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#09090b]/95 backdrop-blur-md border-t border-zinc-800/90 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 px-1 flex items-center justify-around shadow-2xl">
          <button
            type="button"
            data-testid="bottom-nav-productos"
            onClick={() => setActiveMenu('productos')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeMenu === 'productos' ? 'text-emerald-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Layers className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Páginas</span>
          </button>
          <button
            type="button"
            data-testid="bottom-nav-creador"
            onClick={() => setActiveMenu('creador')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeMenu === 'creador' ? 'text-amber-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
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
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeMenu === 'pipeboard' ? 'text-blue-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Bot className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">AutoAds</span>
          </button>
          <button
            type="button"
            data-testid="bottom-nav-whatsapp"
            onClick={() => setActiveMenu('whatsapp')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeMenu === 'whatsapp' ? 'text-emerald-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
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
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeMenu === 'deepgram' || activeMenu === 'openrouter' ? 'text-purple-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Zap className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Voz & LLM</span>
          </button>
        </nav>
      </div>

      {/* ============================================================== */}
      {/* 3. CONSOLA DE WHATSAPP INCRUSTADA EN EL SISTEMA (CHAT EN VIVO) */}
      {/* ============================================================== */}
      {activeAiOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-[#0d0d0f] rounded-2xl max-w-4xl w-full shadow-2xl border border-zinc-800 overflow-hidden max-h-[92vh] flex flex-col">
            {/* CABECERA ESTILO WHATSAPP DARK */}
            <div className="px-4 sm:px-6 py-3.5 bg-zinc-900 text-zinc-100 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-zinc-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center font-black text-base shadow-md shrink-0">
                  {(activeAiOrder.nombre || 'C').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black truncate text-white">
                      {activeAiOrder.nombre}
                    </h3>
                    <span className="text-[11px] font-mono bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded-full text-amber-400 font-bold">
                      +{formatWaPhone(activeAiOrder.celular)}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-200">
                      {activeAiOrder.reservaid} · {activeAiOrder.producto || 'Producto'} (
                      {formatGs(activeAiOrder.monto)})
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                    📍 {activeAiOrder.ciudad}, {activeAiOrder.departamento} —{' '}
                    {activeAiOrder.direccion}
                    {activeAiOrder.referenciaCasa
                      ? ` | 🏠 Ref: ${activeAiOrder.referenciaCasa}`
                      : ''}
                  </p>
                </div>
              </div>

              {/* Controles de Canal y Autorización dentro del Chat: Yo Escribo | Texto IA | Audio IA */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <div className="inline-flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 gap-1">
                  {/* 1. MODO MANUAL: YO ESCRIBO (Default cuando abre chat) */}
                  <button
                    type="button"
                    onClick={() => handleSwitchOrderChatMode(activeAiOrder, 'manual', modalAiChannel)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                      modalAiMode === 'manual'
                        ? 'bg-amber-400 text-black shadow-xs'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                    title="Modo Manual: Vos escribís y respondés con tus propias palabras (La IA no responde sola)"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>👤 Yo Escribo</span>
                  </button>

                  {/* 2. TEXTO IA */}
                  <button
                    type="button"
                    onClick={() => handleSwitchOrderChatMode(activeAiOrder, 'automatico', 'texto')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all ${
                      modalAiMode === 'automatico' && modalAiChannel === 'texto'
                        ? 'bg-emerald-500 text-black shadow-xs'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                    title="Activar que el Agente IA responda automáticamente por texto"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>💬 IA Texto</span>
                  </button>

                  {/* 3. AUDIO IA */}
                  <button
                    type="button"
                    onClick={() => handleSwitchOrderChatMode(activeAiOrder, 'automatico', 'audio')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all ${
                      modalAiMode === 'automatico' && modalAiChannel === 'audio'
                        ? 'bg-emerald-500 text-black shadow-xs'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                    title="Activar que el Agente IA responda con notas de voz OGG/Opus"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>🎤 IA Audio</span>
                  </button>
                </div>

                <button
                  onClick={() => setActiveAiOrder(null)}
                  className="text-zinc-400 hover:text-white p-1.5 rounded-xl hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Estado de Confirmación y Referencia del Paquete */}
            {activeAiOrder.referenciaCasa && (
              <div className="px-4 py-2 bg-emerald-950/60 border-b border-emerald-500/30 flex items-center justify-between gap-2 text-xs text-emerald-300 font-bold shrink-0">
                <div className="flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Pedido Confirmado y Empaquetado:</strong> Referencia de casa guardada:{' '}
                    <em>«{activeAiOrder.referenciaCasa}»</em>
                  </span>
                </div>
              </div>
            )}

            {/* VENTANA CENTRAL DE CHAT DE WHATSAPP EN TIEMPO REAL */}
            <div
              ref={chatScrollContainerRef}
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#09090b]"
            >
              <div className="text-center">
                <span className="inline-block px-3.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 text-[11px] font-bold border border-amber-500/25">
                  {modalAiMode === 'automatico'
                    ? modalAiChannel === 'audio'
                      ? '🎤 Modo Audio IA Activo: El Agente IA envía y responde con Notas de Voz OGG/Opus (Deepgram Aura-2) al WhatsApp del cliente.'
                      : '💬 Modo Texto IA Activo: El Agente IA conversa por texto con el cliente, confirma su dirección y guarda la referencia de su casa.'
                    : '👤 Modo "Yo Escribo" Activo: El Agente IA está en espera. Podés elegir arriba 🎤 Audio IA o 💬 Texto IA.'}
                </span>
              </div>

              {liveChatMessages.length === 0 ? (
                <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 max-w-xl mx-auto space-y-3 mt-4 text-center">
                  <div className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    Pedido recibido de {activeAiOrder.nombre} ({activeAiOrder.producto})
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Elegí cómo querés que el Agente IA atienda este pedido ahora mismo: mandando{' '}
                    <strong>🎤 Audio de Voz</strong> o chateando con{' '}
                    <strong>💬 Texto</strong>:
                  </p>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSwitchOrderChatMode(activeAiOrder, 'automatico', 'audio')}
                      className="px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>1. Mandar 🎤 Audio de Voz IA</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchOrderChatMode(activeAiOrder, 'automatico', 'texto')}
                      className="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>2. Chatear con 💬 Texto IA</span>
                    </button>
                  </div>
                </div>
              ) : (
                liveChatMessages.map(msg => {
                  const isOutgoing = msg.sender === 'admin' || msg.sender === 'ai';
                  const timeStr = msg.timestamp
                    ? new Date(msg.timestamp).toLocaleTimeString('es-PY', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                    : '';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[10px] font-extrabold text-zinc-400 mb-0.5 px-1.5">
                        {msg.sender === 'ai'
                          ? '🤖 Agente IA de Confirmación (Desde tu WhatsApp)'
                          : msg.sender === 'admin'
                            ? '👤 Tú (Desde tu WhatsApp)'
                            : `📱 ${activeAiOrder.nombre} (Cliente)`}
                      </span>
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-[13px] whitespace-pre-line leading-relaxed shadow-xs ${isOutgoing
                            ? 'bg-emerald-950/80 text-emerald-100 rounded-tr-xs border border-emerald-500/30'
                            : 'bg-zinc-900 text-zinc-100 rounded-tl-xs border border-zinc-800'
                          }`}
                      >
                        <div>{typeof msg.text === 'string' ? msg.text.replace(/\n{2,}/g, '\n') : (msg.text && typeof msg.text === 'object' && (msg.text as any).text ? String((msg.text as any).text) : String(msg.text || ''))}</div>
                        <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px] text-zinc-400">
                          {msg.sender === 'ai' ? (
                            <button
                              type="button"
                              onClick={() => playSpokenAudio(msg.text, msg.audioDataUrl)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-[9px] cursor-pointer hover:bg-emerald-500/30"
                            >
                              <Volume2 className="w-3 h-3 text-emerald-400" />
                              <span>Escuchar Voz (Deepgram Aura-2)</span>
                            </button>
                          ) : msg.audioDataUrl ? (
                            <button
                              type="button"
                              onClick={() => playSpokenAudio(msg.text, msg.audioDataUrl)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-black font-black text-[9px] cursor-pointer hover:bg-amber-400"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>Escuchar Audio del Cliente</span>
                            </button>
                          ) : (
                            <span />
                          )}
                          <div className="flex items-center gap-1">
                            <span>{timeStr}</span>
                            {isOutgoing && (
                              <span className="text-emerald-400 font-black">
                                {msg.status === 'pending_connection' ? '✓' : '✓✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomAnchorRef} className="h-1 shrink-0" />
            </div>

            {/* CAMPO DE WHATSAPP INCRUSTADO PARA ESCRIBIR Y ENVIAR DESDE EL SISTEMA */}
            <div className="p-3 sm:p-4 bg-zinc-900 border-t border-zinc-800 space-y-2 shrink-0">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (!embeddedWaInput.trim()) return;
                  handleSendEmbeddedWhatsApp(activeAiOrder, embeddedWaInput, 'admin');
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={embeddedWaInput}
                  onChange={e => setEmbeddedWaInput(e.target.value)}
                  placeholder={
                    modalAiMode === 'manual'
                      ? `✍️ Escribí tu mensaje manual para ${activeAiOrder.nombre}...`
                      : `Escribí acá tu mensaje para ${activeAiOrder.nombre}...`
                  }
                  className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm text-zinc-100 outline-none focus:border-emerald-500"
                />

                <button
                  type="button"
                  onClick={() => {
                    const text = embeddedWaInput.trim();
                    setEmbeddedWaInput('');
                    handleSendOrderAudioNote(activeAiOrder, text || undefined);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all shrink-0"
                  title={
                    embeddedWaInput.trim()
                      ? 'Sintetizar y enviar este mensaje como Nota de Voz IA (Deepgram Aura-2)'
                      : 'Enviar siguiente paso como Nota de Voz IA (Deepgram Aura-2)'
                  }
                >
                  <Volume2 className="w-4 h-4 text-black" />
                  <span className="hidden sm:inline">Mandar Audio</span>
                </button>

                <button
                  type="submit"
                  disabled={sendingWaMsg || !embeddedWaInput.trim()}
                  className="px-4 sm:px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md shrink-0 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>{sendingWaMsg ? 'Enviando...' : 'Enviar'}</span>
                </button>
              </form>

              {/* Simulador de respuesta del cliente para probar la confirmación paso a paso */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1.5 border-t border-zinc-800 text-[11px]">
                <span className="font-bold text-zinc-400">
                  🧪 Probar respuesta paso a paso del cliente:
                </span>
                <div className="flex items-center gap-1.5 flex-1 max-w-md">
                  <input
                    type="text"
                    value={simulatedCustomerReply}
                    onChange={e => setSimulatedCustomerReply(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendSimulatedReply();
                      }
                    }}
                    placeholder="Ej: Sí estoy con tiempo / Sí soy yo / Mi casa es blanca al lado de la despensa..."
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs outline-none focus:border-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={handleSendSimulatedReply}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[11px] cursor-pointer shrink-0"
                  >
                    Simular Respuesta
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MODAL: CONSTRUCTOR DE PÁGINAS DE PRODUCTO POR PLANTILLAS IA */}
      {/* ============================================================== */}
      {showNewProductModal && (
        <ProductTemplateBuilderModal
          isOpen={showNewProductModal}
          onClose={() => {
            setShowNewProductModal(false);
            setEditingProductInBuilder(null);
          }}
          initialProduct={editingProductInBuilder}
          defaultWaNumber={selectedProduct?.wa || config.wa || '595973532550'}
          availableVoices={voicesCatalog}
          onSaveProductPage={handleSaveFromTemplateBuilder}
        />
      )}

      {/* POP-UP ROJO DE CONFIRMACIÓN DE ELIMINADO EN BASE DE DATOS */}
      {deleteConfirmModal.open && (
        <div
          data-testid="admin-red-delete-modal"
          className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-[#991b1b] border-4 border-[#ef4444] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-white">
            {/* Cabecera Roja Impactante */}
            <div className="bg-[#dc2626] px-6 py-5 border-b-2 border-red-400/40 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white text-[#dc2626] flex items-center justify-center font-black text-2xl shrink-0 shadow-md">
                  ⚠️
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-black/30 text-red-100 text-[10px] font-black uppercase tracking-widest mb-1">
                    ALERTA ROJA · ELIMINACIÓN DIRECTA EN BASE DE DATOS
                  </span>
                  <h3 className="text-base sm:text-lg font-black uppercase tracking-wide leading-tight text-white">
                    ¿Estás seguro de que querés ejecutar el eliminado?
                  </h3>
                </div>
              </div>
              <button
                type="button"
                disabled={deleteConfirmModal.isDeleting}
                onClick={() =>
                  setDeleteConfirmModal({
                    open: false,
                    orderIds: [],
                    ordersPreview: [],
                    isDeleting: false
                  })
                }
                className="w-8 h-8 rounded-xl bg-black/25 hover:bg-black/40 text-white flex items-center justify-center font-black cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo del Pop-Up Rojo */}
            <div className="p-6 space-y-4 bg-gradient-to-b from-[#991b1b] to-[#7f1d1d]">
              <p className="text-xs sm:text-sm font-bold text-red-100 leading-relaxed">
                Vas a eliminar de forma <strong className="text-white underline">permanente e irreversible</strong>{' '}
                {deleteConfirmModal.orderIds.length === 1
                  ? 'el siguiente pedido seleccionado'
                  : `los siguientes ${deleteConfirmModal.orderIds.length} pedidos seleccionados`}{' '}
                directamente de la Base de Datos (Supabase + Servidor Central):
              </p>

              <div className="max-h-48 overflow-y-auto rounded-2xl bg-black/35 border border-red-400/30 divide-y divide-red-400/20 p-2 space-y-1.5">
                {deleteConfirmModal.ordersPreview.length > 0 ? (
                  deleteConfirmModal.ordersPreview.map(ord => (
                    <div
                      key={ord.reservaid}
                      className="px-3 py-2 rounded-xl bg-red-950/60 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-black text-white truncate">
                          {ord.nombre || 'Cliente'} · <span className="font-mono text-amber-300">{ord.reservaid}</span>
                        </div>
                        <div className="text-[11px] text-red-200 font-mono">
                          📱 {formatParaguayanPhone433(ord.celular)} · 📍 {ord.ciudad}
                        </div>
                      </div>
                      <span className="font-black text-amber-300 shrink-0">
                        {formatGs(ord.monto)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs font-mono text-red-100">
                    IDs a eliminar: {deleteConfirmModal.orderIds.join(', ')}
                  </div>
                )}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  data-testid="admin-cancel-delete-btn"
                  disabled={deleteConfirmModal.isDeleting}
                  onClick={() =>
                    setDeleteConfirmModal({
                      open: false,
                      orderIds: [],
                      ordersPreview: [],
                      isDeleting: false
                    })
                  }
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-black text-xs uppercase tracking-wider cursor-pointer transition-all"
                >
                  No, Cancelar
                </button>
                <button
                  type="button"
                  data-testid="admin-confirm-delete-btn"
                  disabled={deleteConfirmModal.isDeleting}
                  onClick={handleConfirmExecuteDelete}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#ef4444] hover:bg-[#dc2626] text-white font-black text-xs sm:text-sm uppercase tracking-wider border-2 border-white shadow-xl inline-flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {deleteConfirmModal.isDeleting
                      ? 'Eliminando de la Base de Datos...'
                      : `Sí, ejecutar eliminado (${deleteConfirmModal.orderIds.length})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP ROJO DE CONFIRMACIÓN DE ELIMINADO DE PÁGINAS DE PRODUCTO */}
      {deleteProductsConfirmModal.open && (
        <div
          data-testid="admin-red-delete-products-modal"
          className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-[#991b1b] border-4 border-[#ef4444] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-white">
            <div className="bg-[#dc2626] px-6 py-5 border-b-2 border-red-400/40 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white text-[#dc2626] flex items-center justify-center font-black text-2xl shrink-0 shadow-md">
                  ⚠️
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-black/30 text-red-100 text-[10px] font-black uppercase tracking-widest mb-1">
                    ALERTA ROJA · ELIMINAR PÁGINAS DE PRODUCTO
                  </span>
                  <h3 className="text-base sm:text-lg font-black uppercase tracking-wide leading-tight text-white">
                    ¿Estás seguro de eliminar {deleteProductsConfirmModal.productIds.length === 1 ? 'esta página' : `estas ${deleteProductsConfirmModal.productIds.length} páginas`}?
                  </h3>
                </div>
              </div>
              <button
                type="button"
                disabled={deleteProductsConfirmModal.isDeleting}
                onClick={() =>
                  setDeleteProductsConfirmModal({
                    open: false,
                    productIds: [],
                    productsPreview: [],
                    isDeleting: false
                  })
                }
                className="w-8 h-8 rounded-xl bg-black/25 hover:bg-black/40 text-white flex items-center justify-center font-black cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 bg-gradient-to-b from-[#991b1b] to-[#7f1d1d]">
              <p className="text-xs sm:text-sm font-bold text-red-100 leading-relaxed">
                Vas a eliminar de forma <strong className="text-white underline">permanente</strong>{' '}
                {deleteProductsConfirmModal.productIds.length === 1
                  ? 'la siguiente página de producto seleccionada'
                  : `las siguientes ${deleteProductsConfirmModal.productIds.length} páginas de producto seleccionadas`}{' '}
                directamente de la Base de Datos:
              </p>

              <div className="max-h-48 overflow-y-auto rounded-2xl bg-black/35 border border-red-400/30 divide-y divide-red-400/20 p-2 space-y-1.5">
                {deleteProductsConfirmModal.productsPreview.map(p => (
                  <div
                    key={p.id}
                    className="px-3 py-2 rounded-xl bg-red-950/60 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-black text-white truncate">
                        {p.nombre}
                      </div>
                      <div className="text-[11px] text-red-200 font-mono">
                        /?p={p.slug} · ID: {p.id}
                      </div>
                    </div>
                    <span className="font-black text-amber-300 shrink-0">
                      {formatGs(p.precios?.[1] || 189000)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  data-testid="admin-cancel-delete-products-btn"
                  disabled={deleteProductsConfirmModal.isDeleting}
                  onClick={() =>
                    setDeleteProductsConfirmModal({
                      open: false,
                      productIds: [],
                      productsPreview: [],
                      isDeleting: false
                    })
                  }
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-black text-xs uppercase tracking-wider cursor-pointer transition-all"
                >
                  No, Cancelar
                </button>
                <button
                  type="button"
                  data-testid="admin-confirm-delete-products-btn"
                  disabled={deleteProductsConfirmModal.isDeleting}
                  onClick={handleConfirmExecuteDeleteProducts}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#ef4444] hover:bg-[#dc2626] text-white font-black text-xs sm:text-sm uppercase tracking-wider border-2 border-white shadow-xl inline-flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {deleteProductsConfirmModal.isDeleting
                      ? 'Eliminando de la Base de Datos...'
                      : `Sí, eliminar página(s) (${deleteProductsConfirmModal.productIds.length})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
