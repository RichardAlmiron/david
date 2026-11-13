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
  Lightbulb,
  Download,
  Filter,
  Copy,
  Clock
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { DEFAULT_CONFIG, sanitizeSupabaseCredentials, formatGs, formatWaPhone } from '../config';
import { Order, ProductPage, OrderStatus, WaCommercialStageId } from '../types';
import {
  buildWhatsAppChatStageAndTimerSnapshot,
  ChatFollowUpStatusLike,
  ChatStatusMessageLike
} from '../utils/whatsappChatStatus';
import {
  downloadConfirmedOrdersExcelCsv,
  CopyFieldBtn
} from '../components/ProductConfirmedOrdersPanel';
import { ProductSellerAgentPanel } from '../components/ProductSellerAgentPanel';
import { ProductTemplateBuilderModal } from '../components/ProductTemplateBuilderModal';
import { ProductTemplateBuilderStudio } from '../components/ProductTemplateBuilderStudio';
import { AutoAdsView } from '../components/AutoAdsView';
import { AdminSectionGuide } from '../components/AdminSectionGuide';
import { DownloadAppsModal } from '../components/DownloadAppsModal';
import { SUBNICHE_TEMPLATES, buildAutoTrainedAgentBrain } from '../data/productTemplatesCatalog';
import {
  DEFAULT_META_TRACKING_CONFIG,
  trackMetaFullFunnelEvent
} from '../utils/metaPixelEngine';
import {
  isOrderConfirmedByAgent,
  buildOrderComparisonSummary,
  filterAdminOrders,
  formatParaguayanPhone433,
  formatFullOrderTextForCourier
} from '../utils/orderConfirmation';
import {
  formatFullCityDepartment,
  normalizeOrderGpsFields,
  buildGoogleMapsSearchUrl
} from '../utils/paraguayGeo';

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

export type AdminMenuKey = 'productos' | 'creador' | 'pipeboard' | 'whatsapp' | 'deepgram' | 'openrouter';

export interface AdminViewProps {
  androidShell?: {
    activeMenu: AdminMenuKey;
    onSelectMenu: (menu: AdminMenuKey) => void;
  };
}

export const AdminView: React.FC<AdminViewProps> = ({ androidShell }) => {
  const {
    config,
    orders,
    addOrder,
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
  const [internalActiveMenu, setInternalActiveMenu] = useState<AdminMenuKey>('productos');
  const activeMenu = androidShell ? androidShell.activeMenu : internalActiveMenu;
  const setActiveMenu = (nextMenu: AdminMenuKey) => {
    if (androidShell) {
      androidShell.onSelectMenu(nextMenu);
    } else {
      setInternalActiveMenu(nextMenu);
    }
  };
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showDownloadAppsModal, setShowDownloadAppsModal] = useState(false);

  // Selected product page and accordion expanded state (todas las tarjetas inician cerradas)
  const [selectedProductId, setSelectedProductId] = useState<string>(productPages[0]?.id || '');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [recentlyCreatedProductId, setRecentlyCreatedProductId] = useState<string | null>(null);

  useEffect(() => {
    if (productPages.length > 0 && !selectedProductId) {
      setSelectedProductId(productPages[0].id);
    }
  }, [productPages]);
  const [showPageFiltersBar, setShowPageFiltersBar] = useState<boolean>(false);
  const [showOrderFiltersBar, setShowOrderFiltersBar] = useState<boolean>(false);
  const [showAudioPopover, setShowAudioPopover] = useState<string | null>(null);

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

  // Modal de Carga Rápida de Cliente / Pedido de WhatsApp
  const [showManualOrderModal, setShowManualOrderModal] = useState<boolean>(false);
  const [manualOrderProduct, setManualOrderProduct] = useState<ProductPage | null>(null);
  const [manualNombre, setManualNombre] = useState<string>('');
  const [manualCelular, setManualCelular] = useState<string>('');
  const [manualCiudad, setManualCiudad] = useState<string>('Asunción');
  const [manualDepartamento, setManualDepartamento] = useState<string>('Central');
  const [manualDireccion, setManualDireccion] = useState<string>('');
  const [manualPack, setManualPack] = useState<number>(1);
  const [manualVivienda, setManualVivienda] = useState<'casa' | 'edificio'>('casa');
  const [manualSubmitting, setManualSubmitting] = useState<boolean>(false);

  const openManualOrderModal = (prod: ProductPage) => {
    setManualOrderProduct(prod);
    setManualNombre('');
    setManualCelular('');
    setManualCiudad('Asunción');
    setManualDepartamento('Central');
    setManualDireccion('');
    setManualPack(1);
    setManualVivienda('casa');
    setShowManualOrderModal(true);
  };

  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualOrderProduct) return;
    if (!manualNombre.trim()) {
      showToast('Por favor completá el Nombre del cliente');
      return;
    }
    const cleanDigits = manualCelular.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 8) {
      showToast('Por favor ingresá un número de WhatsApp válido (mínimo 8 dígitos)');
      return;
    }

    setManualSubmitting(true);
    try {
      const precioPack =
        manualOrderProduct.precios?.[manualPack] ||
        (manualPack === 1 ? 189000 : manualPack === 2 ? 358000 : 507000);

      const created = await addOrder({
        productoId: manualOrderProduct.id,
        producto: manualOrderProduct.nombre,
        waVendedor: manualOrderProduct.wa || '',
        nombre: manualNombre.trim(),
        celular: manualCelular.trim(),
        departamento: manualDepartamento,
        ciudad: manualCiudad.trim() || 'Asunción',
        direccion: manualDireccion.trim() || 'Coordinar ubicación por WhatsApp',
        detalle: 'Efectivo al recibir (WhatsApp)',
        cantidad: manualPack,
        monto: precioPack,
        tipoVivienda: manualVivienda,
        estado: 'reservado',
        ref_code: null
      });

      showToast(`✅ Pedido ${created.reservaid} de ${manualNombre.trim()} registrado con éxito`);
      setShowManualOrderModal(false);
      setManualNombre('');
      setManualCelular('');
      setManualDireccion('');
      await refreshOrders();
    } catch (err: any) {
      showToast('Error al registrar pedido: ' + (err?.message || 'Error'));
    } finally {
      setManualSubmitting(false);
    }
  };

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
        setExpandedProductId(null);
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

  // Nombres en vivo de Cuenta Publicitaria 834 y Píxel 377 sincronizados con Meta Graph API
  const [liveMetaRef, setLiveMetaRef] = useState<{
    adAccountName: string;
    pixelName: string;
    pixelId: string;
  }>({
    adAccountName: 'Cuenta Publicitaria (834)',
    pixelName: 'Píxel Cuenta 834 (377)',
    pixelId: '1276031534651377'
  });

  useEffect(() => {
    const handleLiveNamesEvent = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (detail) {
        setLiveMetaRef(prev => ({
          adAccountName: String(detail.adAccountName || prev.adAccountName),
          pixelName: String(detail.pixelName || prev.pixelName),
          pixelId: String(detail.pixelId || prev.pixelId || '1276031534651377')
        }));
      }
    };
    window.addEventListener('meta-live-names-updated', handleLiveNamesEvent);
    fetch('/api/meta/status')
      .then(r => r.json())
      .then(data => {
        if (data?.selectedAdAccountName || data?.universalPixelName) {
          setLiveMetaRef(prev => ({
            adAccountName: String(data.selectedAdAccountName || prev.adAccountName),
            pixelName: String(data.universalPixelName || prev.pixelName),
            pixelId: String(data.universalPixelId || prev.pixelId || '1276031534651377')
          }));
        }
      })
      .catch(() => {});
    return () => window.removeEventListener('meta-live-names-updated', handleLiveNamesEvent);
  }, []);

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
      try {
        for (const delId of idsToDelete) {
          localStorage.removeItem(`noelux_chat_imgs_${delId}`);
        }
      } catch {}
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
  const [productSubTabMap, setProductSubTabMap] = useState<
    Record<
      string,
      'pedidos' | 'confirmados' | 'precios' | 'pixel' | 'voz'
    >
  >({});

  const getProductSubTab = (
    productId: string
  ): 'pedidos' | 'confirmados' | 'precios' | 'pixel' | 'voz' => {
    return productSubTabMap[productId] || 'pedidos';
  };

  const setProductSubTab = (
    productId: string,
    tab: 'pedidos' | 'confirmados' | 'precios' | 'pixel' | 'voz'
  ) => {
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
  const [pairingErrorMap, setPairingErrorMap] = useState<Record<string, string | null>>({});

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
      isFollowUpReminder?: boolean;
      followUpAttemptNumber?: number;
      agentChannel?: 'audio' | 'texto';
      callLink?: string;
      convStep?: number;
      voiceEngine?: string;
      audioDataUrl?: string;
      imageUrl?: string;
      commercialStage?: WaCommercialStageId;
      commercialPackQty?: number;
      commercialFramedPriceGs?: number;
    }>
  >([]);
  const [liveFollowUpStatus, setLiveFollowUpStatus] = useState<ChatFollowUpStatusLike | null>(null);
  const [liveChatConvStep, setLiveChatConvStep] = useState<number | null>(null);
  const [chatClockNowMs, setChatClockNowMs] = useState<number>(() => Date.now());
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

  // Escudo Antidesconexión (Pop-up Fuerte de Seguridad)
  const [disconnectSecurityModal, setDisconnectSecurityModal] = useState<{
    sessionId: string;
    label: string;
    phone: string | null;
    action: 'logout' | 'remove';
  } | null>(null);
  const [disconnectConfirmText, setDisconnectConfirmText] = useState('');
  const [disconnectConfirmChecked, setDisconnectConfirmChecked] = useState(false);

  const openDisconnectSecurityModal = (
    sessionId: string,
    label: string,
    phone: string | null,
    action: 'logout' | 'remove' = 'logout'
  ) => {
    setDisconnectConfirmText('');
    setDisconnectConfirmChecked(false);
    setDisconnectSecurityModal({ sessionId, label, phone, action });
  };

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
    const { url: rawSbUrl, anonKey: sbKey } = sanitizeSupabaseCredentials(
      config.supabase?.url ? config.supabase : DEFAULT_CONFIG.supabase
    );
    if (!rawSbUrl || !sbKey) {
      return false;
    }

    try {
      const uniqueCode = `WACMD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const ctrl = new AbortController();
      const tid = window.setTimeout(() => ctrl.abort(), 5500);
      const res = await fetch(`${rawSbUrl}/rest/v1/codigos`, {
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
        }),
        signal: ctrl.signal
      });
      window.clearTimeout(tid);
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  const fetchWhatsAppStateFromCloud = async (): Promise<any | null> => {
    const { url: rawSbUrl, anonKey: sbKey } = sanitizeSupabaseCredentials(
      config.supabase?.url ? config.supabase : DEFAULT_CONFIG.supabase
    );
    if (!rawSbUrl || !sbKey) {
      return null;
    }

    try {
      const ctrl = new AbortController();
      const tid = window.setTimeout(() => ctrl.abort(), 5500);
      const res = await fetch(
        `${rawSbUrl}/rest/v1/codigos?select=code,dispositivo,creado&code=like.WAENG-*&order=id.desc&limit=1`,
        {
          headers: {
            apikey: sbKey,
            Authorization: `Bearer ${sbKey}`
          },
          signal: ctrl.signal
        }
      );
      window.clearTimeout(tid);
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
    refreshOrders();
    const timer = setInterval(() => {
      fetchWhatsAppStatus();
      if (activeMenu === 'productos' || activeMenu === 'whatsapp') {
        refreshOrders();
      }
    }, activeMenu === 'whatsapp' ? 1400 : 2500);
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

  // Remove a WhatsApp line (requires explicit confirmation code if connected)
  const handleRemoveWhatsAppSession = async (
    sessionId: string,
    label: string,
    confirmCode?: string
  ) => {
    const targetSession = waSessions.find(s => s.id === sessionId);
    if (
      (targetSession?.status === 'connected' || targetSession?.connectedPhone) &&
      confirmCode !== 'CONFIRMAR_DESCONEXION_MANUAL'
    ) {
      openDisconnectSecurityModal(
        sessionId,
        label,
        targetSession?.connectedPhone || null,
        'remove'
      );
      return;
    }

    setLoadingSessionMap(prev => ({ ...prev, [sessionId]: true }));
    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/sessions/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, confirmCode })
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
        sessionId,
        confirmCode
      });
      setTimeout(fetchWhatsAppStatus, 1500);
    }

    showToast(`Línea "${label}" eliminada.`);
    setLoadingSessionMap(prev => ({ ...prev, [sessionId]: false }));
  };

  // Repair / Refresh a WhatsApp session WITHOUT unlinking (uploads fresh Pre-Keys, backs up to Supabase, and restarts socket safely)
  const handleRepairSession = async (sessionId: string) => {
    setLoadingSessionMap(prev => ({ ...prev, [sessionId]: true }));
    setDisconnectSecurityModal(null);
    showToast('🛡️ Reparando y refrescando llaves Signal sin desvincular tu WhatsApp...');

    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/repair', {
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
    } catch (e) {}

    if (!handledLocal) {
      await sendWhatsAppCommandToCloud({ type: 'repair_session', sessionId });
    }

    setTimeout(fetchWhatsAppStatus, 1200);
    setTimeout(fetchWhatsAppStatus, 2800);
    setTimeout(() => {
      showToast('✅ Conexión de WhatsApp reparada y blindada (sin desconectar tu número).');
      setLoadingSessionMap(prev => ({ ...prev, [sessionId]: false }));
    }, 1800);
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
    if (!rawPhone) {
      setPairingErrorMap(prev => ({
        ...prev,
        [sessionId]: 'Escribí primero tu número de celular (ej: 0973532550).'
      }));
      return;
    }
    setLoadingSessionMap(prev => ({ ...prev, [sessionId]: true }));
    setPairingErrorMap(prev => ({ ...prev, [sessionId]: null }));

    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: rawPhone, sessionId })
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        handledLocal = true;
        const data = await res.json();
        if (Array.isArray(data.sessions)) {
          setWaSessions(
            data.sessions.map((s: any) =>
              s.id === sessionId && data.pairingCode ? { ...s, pairingCode: data.pairingCode } : s
            )
          );
        } else if (data.pairingCode) {
          setWaSessions(prev =>
            prev.map(s => (s.id === sessionId ? { ...s, pairingCode: data.pairingCode } : s))
          );
        }
        if (data.pairingCode) {
          setPairingErrorMap(prev => ({ ...prev, [sessionId]: null }));
          showToast(`Código generado: ${data.pairingCode}. Pegalo en tu WhatsApp normal.`);
        } else if (data.error || !data.success) {
          const msg = data.error || 'No se pudo generar el código. Intentá de nuevo.';
          setPairingErrorMap(prev => ({ ...prev, [sessionId]: msg }));
          showToast(msg);
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

  // Disconnect / Unlink a specific WhatsApp session (protected by Anti-Disconnect Security Modal)
  const handleDisconnectSession = async (sessionId: string, confirmCode?: string) => {
    const targetSession = waSessions.find(s => s.id === sessionId);
    if (confirmCode !== 'CONFIRMAR_DESCONEXION_MANUAL') {
      openDisconnectSecurityModal(
        sessionId,
        targetSession?.label || 'WhatsApp Principal #1',
        targetSession?.connectedPhone || null,
        'logout'
      );
      return;
    }

    setDisconnectSecurityModal(null);
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
        body: JSON.stringify({ sessionId, confirmCode })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        handledLocal = true;
      }
    } catch (e) { }

    if (!handledLocal) {
      await sendWhatsAppCommandToCloud({ type: 'logout', sessionId, confirmCode });
    }

    setTimeout(fetchWhatsAppStatus, 1200);
    setTimeout(fetchWhatsAppStatus, 2600);
    showToast('Sesión desvinculada manualmente. Generando nuevo QR...');
    setLoadingSessionMap(prev => ({ ...prev, [sessionId]: false }));
  };

  // Guardar imágenes de chat en el localStorage del navegador (por pedido) y usarlas como respaldo local sin saturar la BD
  const getCachedOrderChatImages = (orderId?: string): Record<string, string> => {
    if (!orderId) return {};
    try {
      const raw = localStorage.getItem(`noelux_chat_imgs_${orderId}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const cacheOrderChatImageInBrowser = async (orderId: string, msgId: string, imageUrl: string) => {
    if (!orderId || !msgId || !imageUrl) return;
    try {
      const current = getCachedOrderChatImages(orderId);
      if (current[msgId]) return;
      let dataUrl = imageUrl;
      if (!imageUrl.startsWith('data:')) {
        const resp = await fetch(imageUrl);
        if (!resp.ok) return;
        const blob = await resp.blob();
        if (blob.size > 450 * 1024) return;
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('read_err'));
          reader.readAsDataURL(blob);
        });
      }
      if (!dataUrl) return;
      current[msgId] = dataUrl;
      localStorage.setItem(`noelux_chat_imgs_${orderId}`, JSON.stringify(current));
    } catch {}
  };

  // Poll live WhatsApp chat messages for the currently open customer order (solo lectura, sin autodisparo)
  const fetchLiveOrderChat = async (phone: string) => {
    if (!phone) return;
    const cleanPhone = formatWaPhone(phone);
    let loadedMessages: any[] = [];
    let fetchedOk = false;
    let detectedMode = modalAiMode;
    let detectedChannel = modalAiChannel;
    let detectedFollowUpStatus: ChatFollowUpStatusLike | null = null;
    let detectedConvStep: number | null = null;

    // 1. Consultar endpoint del servidor (/api/whatsapp/messages)
    try {
      const res = await fetch(`/api/whatsapp/messages?phone=${encodeURIComponent(cleanPhone)}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        fetchedOk = true;
        if (Array.isArray(data.messages)) {
          const orderIdForCache = activeAiOrder?.reservaid || '';
          const cachedImgs = getCachedOrderChatImages(orderIdForCache);
          loadedMessages = data.messages.map((m: any) => {
            if (m.imageUrl && orderIdForCache && m.id && String(m.imageUrl).includes('client_')) {
              cacheOrderChatImageInBrowser(orderIdForCache, m.id, m.imageUrl);
            }
            if (!m.imageUrl && m.id && cachedImgs[m.id]) {
              return { ...m, imageUrl: cachedImgs[m.id] };
            }
            return m;
          });
        }
        if (data.mode === 'automatico' || data.mode === 'manual') {
          detectedMode = data.mode;
        }
        if (data.channel === 'audio' || data.channel === 'texto') {
          detectedChannel = data.channel;
        }
        if (typeof data.convStep === 'number' && Number.isFinite(data.convStep)) {
          detectedConvStep = data.convStep;
        }
        if (data.followUpStatus && typeof data.followUpStatus === 'object') {
          detectedFollowUpStatus = data.followUpStatus as ChatFollowUpStatusLike;
        }
      }
    } catch (e) { }

    if (fetchedOk) {
      setLiveChatMessages(loadedMessages);
      setModalAiMode(detectedMode);
      setModalAiChannel(detectedChannel);
      if (detectedFollowUpStatus !== null) {
        setLiveFollowUpStatus(detectedFollowUpStatus);
      }
      if (detectedConvStep !== null) {
        setLiveChatConvStep(detectedConvStep);
      }
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

  useEffect(() => {
    if (!activeAiOrder) return;
    setChatClockNowMs(Date.now());
    const secTimer = setInterval(() => {
      setChatClockNowMs(Date.now());
    }, 1000);
    return () => clearInterval(secTimer);
  }, [activeAiOrder?.reservaid]);

  const activeChatStageSnapshot = useMemo(() => {
    if (!activeAiOrder) return null;
    return buildWhatsAppChatStageAndTimerSnapshot({
      order: activeAiOrder,
      messages: liveChatMessages as ChatStatusMessageLike[],
      mode: modalAiMode,
      channel: modalAiChannel,
      convStep: liveChatConvStep ?? activeAiOrder.convStep,
      followUpStatus: liveFollowUpStatus,
      nowMs: chatClockNowMs
    });
  }, [
    activeAiOrder,
    liveChatMessages,
    modalAiMode,
    modalAiChannel,
    liveChatConvStep,
    liveFollowUpStatus,
    chatClockNowMs
  ]);

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

  // Enviar Nota de Voz o Respuesta Contextual IA y actualizar consola de chat
  const handleSendOrderAudioNote = async (
    order: Order,
    customText?: string,
    channelOverride: 'audio' | 'texto' = 'audio'
  ) => {
    const cleanPhone = formatWaPhone(order.celular);
    setActiveAiOrder(order);
    setModalAiChannel(channelOverride);
    showToast(
      customText
        ? `🎤 Generando y enviando respuesta IA (${channelOverride === 'audio' ? 'Nota de Voz' : 'Texto'}) a ${order.nombre}...`
        : `🤖 Verificando contexto (${(order.convStep || 1) >= 5 || order.datosConfirmados ? 'Etapa 2/2' : 'Etapa 1/2'}) para ${order.nombre}...`
    );

    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/call/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          orderId: order.reservaid,
          resetCall: false,
          channel: channelOverride,
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
        fetchLiveOrderChat(order.celular);
        if (data.sentViaSocket) {
          showToast(
            channelOverride === 'audio'
              ? `✅ Nota de Voz IA (OGG/Opus) enviada al WhatsApp de ${order.nombre}`
              : `✅ Respuesta IA en texto enviada al WhatsApp de ${order.nombre}`
          );
        } else if (!data.callRung && !customText) {
          showToast(
            `ℹ️ La conversación con ${order.nombre} ya está en ${(data.convStep || order.convStep || 1) >= 5 || order.datosConfirmados ? 'Etapa 2/2 (Confirmado)' : 'Etapa 1/2'} (sin mensaje nuevo del cliente pendiente).`
          );
        } else {
          showToast(`🎤 Nota de Voz IA lista para ${order.nombre}`);
        }
        if (data.reply && (data.sentViaSocket || customText)) {
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
        channel: channelOverride,
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
    const updatedPrices = {
      1: Number(editPricePack1),
      2: Number(editPricePack2),
      3: Number(editPricePack3)
    };
    const ok = await updateProductPage(selectedProduct.id, {
      precioNormal: Number(editPriceNormal),
      wa: cleanWaPhone,
      precios: updatedPrices,
      metaTracking: nextMetaTracking
    });

    // Re-enmarcar automáticamente los 12 comerciales (Packs 1x, 2x y 3x) con los nuevos precios guardados
    try {
      const matrixRes = await fetch('/api/whatsapp/stage-commercials/render-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: {
            ...selectedProduct,
            precioNormal: Number(editPriceNormal),
            precios: updatedPrices
          }
        })
      });
      if (matrixRes.ok) {
        const matrixJson = await matrixRes.json();
        if (matrixJson?.waStageCommercials) {
          await updateProductPage(selectedProduct.id, {
            waStageCommercials: matrixJson.waStageCommercials
          });
        }
      }
    } catch {}

    setSavingToDb(false);

    if (ok) {
      showToast(`✅ Guardado: Precios actualizados y 12 comerciales de WhatsApp re-enmarcados automáticamente.`);
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

  // Open the embedded WhatsApp chat console in pure read-only view (ZERO autodisparo / no auto-send on open)
  const handleOpenOrderWhatsAppChat = async (
    order: Order,
    initialChannel: 'audio' | 'texto' = 'audio'
  ) => {
    setLiveChatMessages([]);
    setLiveFollowUpStatus(null);
    setLiveChatConvStep(order.convStep || 1);
    setChatClockNowMs(Date.now());
    setActiveAiOrder(order);
    setModalAiMode(order.modoIA === 'automatico' ? 'automatico' : 'manual');
    setModalAiChannel(order.canalIA || initialChannel);
    await fetchLiveOrderChat(order.celular);
  };

  // Switch between AI channels ('audio' | 'texto') and "👤 Yo Escribo" ('manual') without auto-firing unless explicitly requested
  const handleSwitchOrderChatMode = async (
    order: Order,
    nextMode: 'automatico' | 'manual',
    nextChannel: 'audio' | 'texto' = modalAiChannel,
    triggerAiNow = false
  ) => {
    setModalAiMode(nextMode);
    setModalAiChannel(nextChannel);
    const cleanPhone = formatWaPhone(order.celular);
    const shouldTrigger = nextMode === 'automatico' && Boolean(triggerAiNow);

    let handledLocal = false;
    try {
      const res = await fetch('/api/whatsapp/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          mode: nextMode,
          channel: nextChannel,
          triggerAiNow: shouldTrigger,
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
        fetchLiveOrderChat(order.celular);
      }
    } catch (e) { }

    if (!handledLocal) {
      await sendWhatsAppCommandToCloud({
        type: 'mode',
        phone: cleanPhone,
        mode: nextMode,
        channel: nextChannel,
        triggerAiNow: shouldTrigger,
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
    } else if (shouldTrigger) {
      showToast(
        nextChannel === 'audio'
          ? `🎤 Modo AUDIO IA activado y procesado en contexto para ${order.nombre}.`
          : `💬 Modo TEXTO IA activado y procesado en contexto para ${order.nombre}.`
      );
    } else {
      showToast(
        nextChannel === 'audio'
          ? `🎤 Modo AUDIO IA activado para ${order.nombre} (${(order.convStep || 1) >= 5 || order.datosConfirmados ? 'Etapa 2/2' : 'Etapa 1/2'}, sin autodisparo).`
          : `💬 Modo TEXTO IA activado para ${order.nombre} (${(order.convStep || 1) >= 5 || order.datosConfirmados ? 'Etapa 2/2' : 'Etapa 1/2'}, sin autodisparo).`
      );
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
    <div className={androidShell ? 'flex flex-col min-h-full bg-[#111318] text-zinc-100 font-sans' : 'flex h-screen bg-[#000000] text-zinc-100 overflow-hidden font-sans'}>
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed z-50 bg-zinc-900 text-white px-4 py-3 rounded-lg shadow-lg border border-zinc-700 flex items-center gap-2.5 ${
            androidShell ? 'bottom-20 left-4 right-4 sm:left-auto sm:right-6' : 'bottom-6 right-6'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. LEFT SIDEBAR — PREMIUM SaaS (oculto en modo Android App)    */}
      {/* ============================================================== */}
      {!androidShell && (
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-52 bg-[#0a0a0a] text-zinc-300 flex flex-col border-r border-zinc-800 transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="px-4 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white font-bold text-xs">
              ▲
            </div>
            <div>
              <div className="font-semibold text-white text-xs tracking-tight flex items-center gap-1.5">
                <span>NOELUX</span>
                <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded">
                  ADMIN
                </span>
              </div>
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
        <div className="px-4 py-2.5 border-b border-zinc-800/70 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono text-zinc-300 text-[10px]">
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
        <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">

          {/* Section: Principal */}
          <div>
            <div className="px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Principal
            </div>
            <div className="space-y-1">

              {/* Menu 1: Páginas de Productos */}
              <button
                data-testid="sidebar-menu-productos"
                onClick={() => {
                  setActiveMenu('productos');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                  activeMenu === 'productos'
                    ? 'bg-zinc-800/60 text-white border-l-2 border-emerald-500'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Layers
                    className={`w-4 h-4 shrink-0 ${
                      activeMenu === 'productos' ? 'text-white' : 'text-zinc-500'
                    }`}
                  />
                  <span className="truncate">Páginas de Productos</span>
                </div>
                <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full text-zinc-400">
                  {productPages.length}
                </span>
              </button>

              {/* Menu 2: Creador de Páginas IA */}
              <button
                data-testid="sidebar-menu-creador"
                onClick={() => {
                  setEditingProductInBuilder(null);
                  setActiveMenu('creador');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                  activeMenu === 'creador'
                    ? 'bg-zinc-800/60 text-white border-l-2 border-emerald-500'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles
                    className={`w-4 h-4 shrink-0 ${
                      activeMenu === 'creador' ? 'text-emerald-400' : 'text-zinc-500'
                    }`}
                  />
                  <span className="truncate">Creador IA</span>
                </div>
              </button>
            </div>
          </div>

          {/* Section: Automatización */}
          <div>
            <div className="px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Automatización
            </div>
            <div className="space-y-1">

              {/* Menu 3: Pipeboard Meta Ads IA */}
              <button
                data-testid="sidebar-menu-pipeboard"
                onClick={() => {
                  setActiveMenu('pipeboard');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                  activeMenu === 'pipeboard'
                    ? 'bg-zinc-800/60 text-white border-l-2 border-emerald-500'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Bot
                    className={`w-4 h-4 shrink-0 ${
                      activeMenu === 'pipeboard' ? 'text-white' : 'text-zinc-500'
                    }`}
                  />
                  <span className="truncate">AutoAds</span>
                </div>
                <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">
                  Meta
                </span>
              </button>

              {/* Menu 4: Conexiones WhatsApp */}
              <button
                data-testid="sidebar-menu-whatsapp"
                onClick={() => {
                  setActiveMenu('whatsapp');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                  activeMenu === 'whatsapp'
                    ? 'bg-zinc-800/60 text-white border-l-2 border-emerald-500'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Smartphone
                    className={`w-4 h-4 shrink-0 ${
                      activeMenu === 'whatsapp' ? 'text-emerald-400' : 'text-zinc-500'
                    }`}
                  />
                  <span className="truncate">WhatsApp</span>
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
            </div>
          </div>

          {/* Section: Configuración */}
          <div>
            <div className="px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Configuración
            </div>
            <div className="space-y-1">

              {/* Menu 5: Deepgram Todo-en-Uno */}
              <button
                data-testid="sidebar-menu-deepgram"
                onClick={() => {
                  setActiveMenu('deepgram');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                  activeMenu === 'deepgram'
                    ? 'bg-zinc-800/60 text-white border-l-2 border-emerald-500'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Zap
                    className={`w-4 h-4 shrink-0 ${
                      activeMenu === 'deepgram' ? 'text-white' : 'text-zinc-500'
                    }`}
                  />
                  <span className="truncate">Deepgram</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  STT·TTS
                </span>
              </button>

              {/* Menu 6: Cerebro LLM */}
              <button
                data-testid="sidebar-menu-openrouter"
                onClick={() => {
                  setActiveMenu('openrouter');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                  activeMenu === 'openrouter'
                    ? 'bg-zinc-800/60 text-white border-l-2 border-emerald-500'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Bot
                    className={`w-4 h-4 shrink-0 ${
                      activeMenu === 'openrouter' ? 'text-white' : 'text-zinc-500'
                    }`}
                  />
                  <span className="truncate">Cerebro LLM</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  Activo
                </span>
              </button>
            </div>
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="p-2.5 border-t border-zinc-800 space-y-1">
          <button
            onClick={() => setCurrentView('store')}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/40 hover:bg-zinc-800 text-xs text-zinc-400 hover:text-white transition-colors duration-150 cursor-pointer border border-zinc-800"
          >
            <div className="flex items-center gap-2 min-w-0">
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="truncate">Ver Tienda</span>
            </div>
            <ChevronRight className="w-3 h-3 text-zinc-600" />
          </button>

          <button
            onClick={() => logoutAdmin()}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-red-400/80 hover:text-red-300 hover:bg-red-950/20 transition-colors duration-150 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
      )}

      {/* Backdrop for mobile */}
      {!androidShell && mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* ============================================================== */}
      {/* 2. MAIN CONTENT AREA                                            */}
      {/* ============================================================== */}
      <div className={androidShell ? 'flex-1 flex flex-col min-w-0 bg-[#111318]' : 'flex-1 flex flex-col min-w-0 overflow-hidden bg-[#09090b]'}>
        {/* Top Header */}
        {!androidShell && (
        <header className="h-14 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-zinc-800/80 flex items-center justify-between px-3 sm:px-6 shrink-0 z-20 sticky top-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              title="Abrir Menú"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 text-sm font-mono">
              <span className="text-zinc-500 hidden sm:inline">admin</span>
              <span className="text-zinc-700 hidden sm:inline">/</span>
              <span className="text-white font-medium truncate max-w-[160px] sm:max-w-none">
                {activeMenu === 'productos' && 'Páginas & Ventas'}
                {activeMenu === 'creador' && 'Creador IA'}
                {activeMenu === 'pipeboard' && 'AutoAds'}
                {activeMenu === 'whatsapp' && 'WhatsApp Multi-Línea'}
                {activeMenu === 'deepgram' && 'Deepgram Aura-2'}
                {activeMenu === 'openrouter' && 'Cerebro LLM'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="header-download-apps-btn"
              onClick={() => setShowDownloadAppsModal(true)}
              className="px-3 py-1.5 rounded-lg border border-emerald-700/60 bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              title="Descargar aplicaciones para Android y iPhone"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Descargar App</span>
            </button>

            <button
              onClick={() => {
                refreshOrders();
                fetchWhatsAppStatus();
                showToast('Datos actualizados.');
              }}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
              title="Actualizar datos"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden sm:inline">Actualizar</span>
            </button>

            <button
              onClick={() => setCurrentView('store')}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
              title="Ver Tienda Pública"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Tienda</span>
            </button>

            <button
              onClick={() => logoutAdmin()}
              className="p-2 rounded-lg border border-red-900/30 bg-red-950/20 hover:bg-red-950/40 text-red-400 transition-colors duration-150 cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>
        )}

        {/* Live Incoming Order Alert Banner */}
        {newOrderNotification && (
          <div className="bg-emerald-950/80 text-white px-4 sm:px-6 py-2.5 flex items-center justify-between border-b border-emerald-800/40">
            <div className="flex items-center gap-2.5 text-sm font-medium">
              <span className="p-1 rounded-full bg-emerald-500 text-white">
                <Bell className="w-3 h-3" />
              </span>
              <span>
                Nuevo pedido recibido —{' '}
                <strong className="text-emerald-300">{newOrderNotification.nombre}</strong> (
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
                className="text-sm font-medium bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-500 cursor-pointer transition-colors"
              >
                Abrir Chat →
              </button>
              <button
                type="button"
                onClick={() => setNewOrderNotification(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 lg:pb-8 space-y-5 bg-[#09090b] text-zinc-100">
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
            <div className="space-y-4 max-w-6xl mx-auto">
              {/* Cabecera Compacta con Botón de Guía y Botón de Filtros en una sola barra */}
              <AdminSectionGuide
                id="productos"
                title={`Páginas & Ventas (${filteredProductPages.length})`}
                subtitle="Seleccioná una tarjeta para ver pedidos, confirmados, configuración de Píxel y más"
                badge="Guía"
                defaultExpanded={false}
                extraRightActions={
                  <button
                    type="button"
                    data-testid="toggle-product-pages-filter-btn"
                    onClick={() => setShowPageFiltersBar(prev => !prev)}
                    className={`h-8 px-3 rounded-lg border text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer select-none transition-colors duration-150 ${
                      showPageFiltersBar ||
                      filterProductName ||
                      filterProductPhoneOrPixel ||
                      filterProductTab !== 'todas' ||
                      selectedProductPageIds.length > 0
                        ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                        : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400'
                    }`}
                    title="Mostrar u ocultar filtros y selección múltiple de páginas"
                  >
                    <Filter className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Filtrar
                      {selectedProductPageIds.length > 0 ? ` (${selectedProductPageIds.length})` : ''}
                    </span>
                  </button>
                }
                steps={[
                  {
                    icon: '🤖',
                    title: 'Edición en Tiempo Real con Agente IA',
                    description: 'Tocá "Editar IA" para abrir el chat/voz interactivo y pedirle cambios de textos, colores o fotos.'
                  },
                  {
                    icon: '✅',
                    title: 'Pestaña de Confirmados + Descarga Excel',
                    description: 'Dentro de cada producto tenés la pestaña Confirmados para descargar en 1 clic el Excel listo para despacho.'
                  },
                  {
                    icon: '📦',
                    title: 'Gestión y Confirmación de Pedidos',
                    description: 'Tocá la tarjeta del producto para abrir sus pedidos confirmados con geolocalización GPS para el courier.'
                  }
                ]}
                proTip="Las páginas con envío gratis y precios psicológicos terminados en 9.000 Gs (ej: 189.000 Gs) tienen hasta un 34% más de conversión en Paraguay."
              />

              {/* BARRA DE FILTROS + SELECCIÓN MÚLTIPLE (Oculta por defecto, se despliega al tocar el botón Filtrar) */}
              {(showPageFiltersBar ||
                Boolean(filterProductName) ||
                Boolean(filterProductPhoneOrPixel) ||
                filterProductTab !== 'todas' ||
                selectedProductPageIds.length > 0) && (
              <div
                data-testid="product-pages-filter-bar"
                className="p-3 rounded-lg bg-[#0f0f11] border border-zinc-800/80 shadow-sm space-y-2.5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
                  <div className="lg:col-span-4">
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
                      <span>Filtrar por Nombre o Slug</span>
                      <span className="text-[10px] text-zinc-500 font-normal">Búsqueda rápida</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        data-testid="admin-filter-product-name"
                        value={filterProductName}
                        onChange={e => setFilterProductName(e.target.value)}
                        placeholder="Ej: Proyector, Taladro, ?p=..."
                        className="w-full pl-3 pr-8 py-2.5 rounded-lg border border-zinc-800 text-xs font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
                        title="Escribí el nombre del producto o parte de su link para filtrar"
                      />
                      {filterProductName && (
                        <button
                          type="button"
                          onClick={() => setFilterProductName('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs font-semibold cursor-pointer"
                          title="Limpiar filtro"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1">
                      Filtrar por ID de Píxel o WhatsApp
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        data-testid="admin-filter-product-wa"
                        value={filterProductPhoneOrPixel}
                        onChange={e => setFilterProductPhoneOrPixel(e.target.value)}
                        placeholder="Ej: 123456789012345 o 595973..."
                        className="w-full pl-3 pr-8 py-2.5 rounded-lg border border-zinc-800 text-xs font-mono font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
                      />
                      {filterProductPhoneOrPixel && (
                        <button
                          type="button"
                          onClick={() => setFilterProductPhoneOrPixel('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs font-semibold cursor-pointer"
                          title="Limpiar filtro"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1">
                    Filtro Rápido de Páginas
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
                      <button
                        type="button"
                        data-testid="admin-product-tab-todas"
                        onClick={() => setFilterProductTab('todas')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-medium cursor-pointer transition-all whitespace-nowrap ${
                          filterProductTab === 'todas'
                            ? 'bg-zinc-800 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Todas ({productPages.length})
                      </button>
                      <button
                        type="button"
                        data-testid="admin-product-tab-pixel"
                        onClick={() => setFilterProductTab('con_pixel')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-medium cursor-pointer transition-all whitespace-nowrap ${
                          filterProductTab === 'con_pixel'
                            ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Con Píxel ({productPages.filter(p => Boolean(p.metaTracking?.pixelId?.trim())).length})
                      </button>
                      <button
                        type="button"
                        data-testid="admin-product-tab-free-shipping"
                        onClick={() => setFilterProductTab('envio_gratis')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-medium cursor-pointer transition-all whitespace-nowrap ${
                          filterProductTab === 'envio_gratis'
                            ? 'bg-zinc-800 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Envío Gratis ({productPages.filter(p => p.freeShipping !== false).length})
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border inline-flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 ${
                            isAllProductsSelected
                              ? 'bg-zinc-800 text-white border-zinc-700'
                              : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            readOnly
                            checked={isAllProductsSelected}
                            className="w-3.5 h-3.5 accent-emerald-500 pointer-events-none"
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
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800 cursor-pointer"
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
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-red-950/40 hover:bg-red-900/60 disabled:opacity-40 text-red-300 border border-red-900/50 shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition-all"
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
              )}

              {recentlyCreatedProductId && (() => {
                const recentProd = productPages.find(p => p.id === recentlyCreatedProductId);
                if (!recentProd) return null;
                return (
                  <div
                    data-testid="recently-created-product-banner"
                    className="bg-[#0f0f11] text-white rounded-lg p-4 border border-emerald-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[12px] font-medium uppercase tracking-wider text-emerald-400 block">
                        Página Creada y Guardada
                      </span>
                      <p className="text-sm font-semibold text-white">
                        {recentProd.nombre}{' '}
                        <span className="font-mono text-xs text-zinc-400">
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
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors duration-150"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Abrir Página en Vivo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/?p=${recentProd.slug}`;
                          navigator.clipboard?.writeText(url);
                          showToast(`Link copiado: ${url}`);
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium px-3 py-2 rounded-lg cursor-pointer transition-colors duration-150"
                      >
                        Copiar Link
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2.5">
                {filteredProductPages.map((prod, prodIdx) => {
                  const isExpanded = expandedProductId === prod.id;
                  const isProductChecked = selectedProductPageIds.includes(prod.id);
                  const hasPixelConfigured = Boolean(prod.metaTracking?.pixelId?.trim());
                  const hasCapiTokenConfigured = Boolean(prod.metaTracking?.capiAccessToken?.trim());
                  const matchesProductOrder = (o: Order, targetProd: ProductPage) =>
                    (o.productoId && o.productoId === targetProd.id) ||
                    (o.producto || 'Noelux™ Proyector')
                      .toLowerCase()
                      .includes(targetProd.nombre.toLowerCase().slice(0, 10));

                  const allProdOrders = orders.filter(o => {
                    if (matchesProductOrder(o, prod)) return true;
                    if (prodIdx === 0) {
                      const matchesAnyOther = productPages.some(
                        (otherP, otherIdx) => otherIdx !== 0 && matchesProductOrder(o, otherP)
                      );
                      return !matchesAnyOther;
                    }
                    return false;
                  });
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
                  const charLabel = `PÁGINA #${prodIdx + 1}`;

                  return (
                    <div
                      key={prod.id}
                      data-testid={`product-card-${prod.id}`}
                      className={`w-full bg-[#0f0f11] rounded-lg border transition-colors duration-150 overflow-hidden ${
                        isProductChecked
                          ? 'border-red-500/60 ring-1 ring-red-500/30'
                          : isJustCreated
                            ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                            : isExpanded
                              ? 'border-zinc-700'
                              : 'border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      {/* TARJETA DE PRODUCTO — FILA PREMIUM */}
                      <div
                        onClick={() => toggleProductExpand(prod)}
                        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-zinc-900/30 transition-colors duration-150"
                      >
                        {/* IZQUIERDA: Checkbox + Miniatura + Etiqueta Característica + Nombre Completo + Badges en Línea */}
                        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                          <label
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center justify-center cursor-pointer shrink-0"
                            title="Seleccionar esta página de producto"
                          >
                            <input
                              type="checkbox"
                              data-testid={`select-product-checkbox-${prod.id}`}
                              checked={isProductChecked}
                              onChange={() => toggleSelectProductPage(prod.id)}
                              className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
                            />
                          </label>
                          <img
                            src={prod.imagen || '/assets/real/galeria-1.jpg'}
                            alt={prod.nombre}
                            className="w-11 h-11 rounded-lg object-cover border border-zinc-800 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3
                                className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-[280px] md:max-w-[360px] xl:max-w-none"
                                title={prod.nombre}
                              >
                                {prod.nombre}
                              </h3>
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ${
                                  hasPixelConfigured
                                    ? 'bg-sky-950/80 text-sky-300 border border-sky-800/60'
                                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                                }`}
                              >
                                {hasPixelConfigured
                                  ? `Píxel •${String(prod.metaTracking?.pixelId).slice(-3)}${hasCapiTokenConfigured ? ' + CAPI' : ''}`
                                  : 'Sin Píxel'}
                              </span>

                              {isJustCreated && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 shrink-0">
                                  Nueva
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[12px] text-zinc-500 mt-1 overflow-hidden">
                              <span className="font-mono truncate max-w-[130px] sm:max-w-[190px]">
                                /?p={prod.slug}
                              </span>
                              <span className="text-zinc-700">·</span>
                              <span className="text-zinc-300 font-medium whitespace-nowrap">
                                1x: {formatGs(prod.precios?.[1] || 189000)}
                              </span>
                              <span className="hidden sm:inline text-emerald-400 font-medium whitespace-nowrap">
                                · 2x: {formatGs(prod.precios?.[2] || 358000)}
                              </span>
                              <span className="hidden md:inline text-zinc-500 whitespace-nowrap">
                                · {prod.freeShipping === false ? 'Envío Pagado' : 'Envío Gratis'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* DERECHA: Toolbar compacto */}
                        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                          {isExpanded && (
                            <>
                              <button type="button" data-testid={`toggle-pixel-config-${prod.id}`} onClick={e => { e.stopPropagation(); setProductSubTab(prod.id, 'pixel'); }} className={`h-6 px-2 rounded text-[11px] font-medium cursor-pointer transition-colors border ${getProductSubTab(prod.id)==='pixel' ? 'bg-zinc-700 text-white border-zinc-600' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'}`}>
                                Píxel
                              </button>
                              <button type="button" onClick={e => { e.stopPropagation(); setProductSubTab(prod.id, 'precios'); }} className={`h-6 px-2 rounded text-[11px] font-medium cursor-pointer transition-colors border ${getProductSubTab(prod.id)==='precios' ? 'bg-zinc-700 text-white border-zinc-600' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'}`}>
                                Precios
                              </button>
                              <button type="button" onClick={e => { e.stopPropagation(); setProductSubTab(prod.id, 'voz'); }} className={`h-6 px-2 rounded text-[11px] font-medium cursor-pointer transition-colors border ${getProductSubTab(prod.id)==='voz' ? 'bg-zinc-700 text-white border-zinc-600' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'}`}>
                                Voz
                              </button>
                              <button type="button" data-testid={`quick-excel-confirmed-${prod.id}`} onClick={e => { e.stopPropagation(); const count = downloadConfirmedOrdersExcelCsv(prod, allProdOrders); showToast(count > 0 ? `Excel descargada (${count} pedidos).` : 'Sin pedidos para exportar.'); }} className="h-6 px-2 rounded text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors inline-flex items-center gap-1" title="Descargar Excel">
                                <Download className="w-3 h-3" /> Excel
                              </button>
                              <div className="relative" onClick={e => e.stopPropagation()}>
                                <button type="button" onClick={() => setShowAudioPopover(prev => prev === prod.id ? null : prod.id)} className={`h-6 px-2 rounded text-[11px] font-medium cursor-pointer transition-colors border inline-flex items-center gap-1 ${(autoCallOnOrder || autoChatOnOrder) ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'}`}>
                                  Audio <ChevronDown className="w-3 h-3" />
                                </button>
                                {showAudioPopover === prod.id && (
                                  <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-2 min-w-[140px] space-y-1">
                                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider px-2 pb-1">Recepción de pedidos</div>
                                    <button type="button" onClick={() => { handleToggleAutomationSetting('autoCallOnOrder', true); handleToggleAutomationSetting('autoChatOnOrder', true); setShowAudioPopover(null); }} className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${(autoCallOnOrder || autoChatOnOrder) ? 'bg-emerald-950 text-emerald-300' : 'text-zinc-300 hover:bg-zinc-800'}`}>
                                      Automático
                                    </button>
                                    <button type="button" onClick={() => { handleToggleAutomationSetting('autoCallOnOrder', false); handleToggleAutomationSetting('autoChatOnOrder', false); setShowAudioPopover(null); }} className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${(!autoCallOnOrder && !autoChatOnOrder) ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}>
                                      Manual
                                    </button>
                                  </div>
                                )}
                              </div>
                              <button type="button" data-testid={`btn-manual-order-${prod.id}`} onClick={e => { e.stopPropagation(); openManualOrderModal(prod); }} className="h-6 px-2 rounded text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors inline-flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Nuevo
                              </button>
                              <button type="button" data-testid={`toggle-order-filters-${prod.id}`} onClick={e => { e.stopPropagation(); setShowOrderFiltersBar(prev => !prev); }} className={`h-6 px-2 rounded text-[11px] font-medium cursor-pointer transition-colors border inline-flex items-center gap-1 ${(showOrderFiltersBar || filterOrderName || filterOrderPhone) ? 'bg-emerald-950 text-emerald-200 border-emerald-600' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'}`}>
                                <Filter className="w-3 h-3" /> Filtrar
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); toggleProductExpand(prod); }}
                            className={`h-6 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer border inline-flex items-center gap-1 ${isExpanded ? 'bg-zinc-700 text-white border-zinc-600' : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'}`}
                          >
                            {isExpanded ? 'Cerrar' : `Abrir (${activeProdOrdersCount})`}
                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          <button
                            type="button"
                            data-testid={`delete-product-btn-${prod.id}`}
                            onClick={e => { e.stopPropagation(); openRedDeleteProductsModal([prod.id]); }}
                            className="h-6 w-6 rounded bg-zinc-900 hover:bg-red-950/50 text-zinc-500 hover:text-red-400 border border-zinc-800 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* CONTENIDO EXPANDIDO DEL PRODUCTO */}
                      {isExpanded && (
                        <div className="border-t border-zinc-800/80 bg-[#09090b] px-3 py-3 space-y-2.5">


                          {/* TAB PIXEL */}
                          {getProductSubTab(prod.id) === 'pixel' && (
                          <form
                            onSubmit={e => handleSaveProductPixelConfig(e, prod)}
                            data-testid={`product-pixel-token-box-${prod.id}`}
                            className="p-3.5 sm:p-4 rounded-lg bg-[#0f0f11] border border-zinc-800 shadow-sm space-y-3"
                          >
                            {/* Referencia oficial en vivo sincronizada con Meta Graph API */}
                            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/70 space-y-2 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-emerald-300 text-[11px] uppercase tracking-wider">
                                  Referencia Meta Ads
                                </span>
                                <span className="text-[10px] font-mono text-zinc-400">
                                  Portafolio: <strong className="text-white">Landingcod</strong> · Cuenta (834): <strong className="text-white">{liveMetaRef.adAccountName}</strong>
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
                                    Copiar
                                  </button>
                                </div>
                                <div className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-2">
                                  <div>
                                    <span className="text-[10px] text-zinc-400 block">Cuenta Publicitaria</span>
                                    <strong className="text-white font-mono text-xs">{liveMetaRef.adAccountName}</strong>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      try { navigator.clipboard.writeText('1048211497774834'); } catch {}
                                      showToast(`📋 Copiado ID Cuenta ${liveMetaRef.adAccountName} (834): 1048211497774834`);
                                    }}
                                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-300 font-mono text-[10px] font-bold cursor-pointer"
                                  >
                                    Copiar 834
                                  </button>
                                </div>
                                <div className="p-2 rounded-lg bg-zinc-900/90 border border-emerald-700/70 flex items-center justify-between gap-2">
                                  <div>
                                    <span className="text-[10px] text-zinc-400 block">Píxel</span>
                                    <strong className="text-white font-mono text-xs">{liveMetaRef.pixelName}</strong>
                                    <span className="text-[10px] text-zinc-500 font-mono block">{liveMetaRef.pixelId}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      try { navigator.clipboard.writeText(liveMetaRef.pixelId); } catch {}
                                      setEditPixelId(liveMetaRef.pixelId);
                                      showToast(`Píxel ${liveMetaRef.pixelName} copiado y colocado en el campo.`);
                                    }}
                                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-300 font-mono text-[10px] font-bold cursor-pointer"
                                  >
                                    Copiar
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800">
                                  Píxel de Facebook & Token API (CAPI)
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
                                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-medium text-xs cursor-pointer transition-colors"
                                >
                                  {testingProductCapi ? 'Probando...' : 'Probar CAPI'}
                                </button>
                                <button
                                  type="submit"
                                  disabled={savingToDb}
                                  data-testid={`save-product-pixel-btn-${prod.id}`}
                                  onClick={undefined}
                                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                                >
                                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>{savingToDb ? 'Guardando...' : 'Guardar Píxel y Token'}</span>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                              <div className="sm:col-span-5">
                                <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1">
                                  ID del Píxel de Facebook ({liveMetaRef.pixelName}: {liveMetaRef.pixelId})
                                </label>
                                <input
                                  type="text"
                                  data-testid={`product-pixel-id-input-${prod.id}`}
                                  value={editPixelId}
                                  onChange={e => setEditPixelId(e.target.value)}
                                  placeholder={`${liveMetaRef.pixelId} (Píxel ${liveMetaRef.pixelName})`}
                                  className="w-full px-3 py-2.5 border border-zinc-800 rounded-lg text-xs font-mono font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
                                />
                              </div>

                              <div className="sm:col-span-7">
                                <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1">
                                  Token de API de Conversiones (CAPI Access Token)
                                </label>
                                <input
                                  type="text"
                                  data-testid={`product-capi-token-input-${prod.id}`}
                                  value={editCapiToken}
                                  onChange={e => setEditCapiToken(e.target.value)}
                                  placeholder="Pegá aquí tu Token EAAB... de Meta Events Manager"
                                  className="w-full px-3 py-2.5 border border-zinc-800 rounded-lg text-xs font-mono font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
                                />
                              </div>
                            </div>
                          </form>
                          )}

                          {/* TAB PRECIOS */}
                          {(getProductSubTab(prod.id) === 'precios' || showPriceConfig) && (
                            <form
                              onSubmit={handleSaveProductConfig}
                              className="p-3.5 sm:p-4 rounded-lg bg-[#0f0f11] border border-zinc-800 shadow-sm space-y-3"
                            >
                              <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-200">
                                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div className="leading-relaxed">
                                  <strong className="text-amber-400 font-bold block text-[11px] uppercase tracking-wide">
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
                                    Configuración de Producto
                                  </span>
                                  <h4 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate max-w-sm">
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
                                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-all shrink-0"
                                  >
                                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>{savingToDb ? 'Guardando...' : 'Guardar Configuración'}</span>
                                  </button>
                                </div>
                              </div>

                              {/* 5 Campos en 1 sola fila responsiva horizontal compacta */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 items-start">
                                <div>
                                  <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-0.5">
                                    WhatsApp Ventas
                                  </label>
                                  <input
                                    type="text"
                                    value={editWa}
                                    onChange={e => setEditWa(e.target.value)}
                                    placeholder="Ej: 595973532550"
                                    className="w-full px-2.5 py-2 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-100 outline-none bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500"
                                  />
                                  <span className="text-[10px] text-zinc-500 block mt-0.5 truncate font-mono">
                                    +{formatWaPhone(editWa)}
                                  </span>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-0.5">
                                    Normal (Tachado)
                                  </label>
                                  <input
                                    type="number"
                                    value={editPriceNormal}
                                    onChange={e => setEditPriceNormal(Number(e.target.value))}
                                    className="w-full px-2.5 py-2 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-100 outline-none bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500"
                                  />
                                  <span className="text-[10px] text-zinc-500 block mt-0.5 truncate line-through">
                                    {formatGs(editPriceNormal)}
                                  </span>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-0.5">
                                    Pack 1 un.
                                  </label>
                                  <input
                                    type="number"
                                    value={editPricePack1}
                                    onChange={e => setEditPricePack1(Number(e.target.value))}
                                    className="w-full px-2.5 py-2 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-100 outline-none bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500"
                                  />
                                  <span className="text-[10px] text-zinc-500 block mt-0.5 truncate">
                                    {formatGs(editPricePack1)}
                                  </span>
                                </div>

                                <div className="bg-zinc-900/60 p-1.5 rounded-xl border border-emerald-900/60">
                                  <label className="block text-[10px] font-medium uppercase tracking-wider text-[#0a7a4a] mb-0.5 flex items-center justify-between">
                                    <span>Pack 2 un.</span>
                                    <span className="text-[10px] bg-[#0a7a4a] text-white px-1 rounded font-bold">
                                      Popular
                                    </span>
                                  </label>
                                  <input
                                    type="number"
                                    value={editPricePack2}
                                    onChange={e => setEditPricePack2(Number(e.target.value))}
                                    className="w-full px-2.5 py-2 border border-emerald-800 rounded-lg text-xs font-bold outline-none bg-zinc-900 text-emerald-400 focus:border-emerald-500"
                                  />
                                  <span className="text-[10px] text-emerald-700 block mt-0.5 truncate font-bold">
                                    {formatGs(editPricePack2)}
                                  </span>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-0.5">
                                    Pack 3 un.
                                  </label>
                                  <input
                                    type="number"
                                    value={editPricePack3}
                                    onChange={e => setEditPricePack3(Number(e.target.value))}
                                    className="w-full px-2.5 py-2 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-100 outline-none bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500"
                                  />
                                  <span className="text-[10px] text-zinc-500 block mt-0.5 truncate">
                                    {formatGs(editPricePack3)}
                                  </span>
                                </div>
                              </div>
                            </form>
                          )}

                          {/* TAB VOZ & OPCIONES */}
                          {(getProductSubTab(prod.id) === 'voz' || showVoiceCatalog) && (
                            <div className="p-3.5 sm:p-4 rounded-lg bg-[#0f0f11] text-zinc-100 border border-zinc-800 shadow-sm space-y-3">
                              <div className="p-2.5 rounded-lg bg-zinc-900/30 border border-zinc-900/50 flex items-start gap-2.5 text-xs text-zinc-300">
                                <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                                <div className="leading-relaxed">
                                  <strong className="text-zinc-300 font-bold block text-[11px] uppercase tracking-wide">
                                    Selección de Voz Humana para Confirmación Telefónica
                                  </strong>
                                  <span className="text-[11px] text-zinc-300 mt-0.5 block">
                                    El Agente Telefónico llamará automáticamente al comprador usando la voz que selecciones aquí para confirmar su horario de recepción del paquete.
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
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
                                          ? 'bg-emerald-950/70 border-emerald-600 shadow-sm'
                                          : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                                      }`}
                                    >
                                      <div>
                                        <div className="flex items-center justify-between text-[10px] font-bold">
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

                          {/* PEDIDOS */}
                          {!['pixel', 'precios', 'voz'].includes(getProductSubTab(prod.id)) && (
                          <div className="space-y-2 pt-0.5">

                            {/* BARRA DE FILTROS DE PEDIDOS (Se despliega solo al darle clic al botón Filtrar) */}
                            {(showOrderFiltersBar ||
                              Boolean(filterOrderName) ||
                              Boolean(filterOrderPhone) ||
                              selectedIdsForProd.length > 0) && (
                            <div className="p-3 rounded-lg bg-[#0f0f11] border border-zinc-800 space-y-2.5">
                              {/* Filtros: Nombre y Teléfono */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                                <div>
                                  <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1">
                                    Nombre
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
                                      className="w-full pl-3 pr-8 py-2.5 rounded-lg border border-zinc-800 text-xs font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
                                    />
                                    {filterOrderName && (
                                      <button
                                        type="button"
                                        onClick={() => setFilterOrderName('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs font-semibold cursor-pointer"
                                        title="Limpiar filtro de nombre"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1">
                                    Teléfono
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
                                      className="w-full pl-3 pr-8 py-2.5 rounded-lg border border-zinc-800 text-xs font-mono font-medium text-zinc-100 bg-zinc-900/80 focus:bg-zinc-900 focus:border-emerald-500 outline-none placeholder-zinc-500"
                                    />
                                    {filterOrderPhone && (
                                      <button
                                        type="button"
                                        onClick={() => setFilterOrderPhone('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs font-semibold cursor-pointer"
                                        title="Limpiar filtro de teléfono"
                                      >
                                        ✕
                                      </button>
                                    )}
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
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border inline-flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 ${
                                      isAllFilteredSelected
                                        ? 'bg-zinc-800 text-white border-zinc-700'
                                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      readOnly
                                      checked={isAllFilteredSelected}
                                      className="w-3.5 h-3.5 accent-emerald-500 pointer-events-none"
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
                                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800 cursor-pointer"
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
                                      className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-amber-400 border border-zinc-800 shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition-all"
                                      title="Archivar todos los pedidos seleccionados directamente en la Base de Datos"
                                    >
                                      <span></span>
                                      <span>
                                        Archivar ({selectedIdsForProd.length})
                                      </span>
                                    </button>
                                  )}

                                  {filterArchiveMode !== 'activos' && (
                                    <button
                                      type="button"
                                      data-testid="admin-bulk-unarchive-btn"
                                      disabled={selectedIdsForProd.length === 0 || isArchivingBatch}
                                      onClick={() => handleArchiveOrders(selectedIdsForProd, false)}
                                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white border border-emerald-800 shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition-all"
                                      title="Restaurar los pedidos seleccionados a Activos en la Base de Datos"
                                    >
                                      <span>
                                        Desarchivar ({selectedIdsForProd.length})
                                      </span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    data-testid="admin-bulk-delete-btn"
                                    disabled={selectedIdsForProd.length === 0}
                                    onClick={() => openRedDeleteConfirmModal(selectedIdsForProd)}
                                    className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-40 text-white border border-red-800 shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition-all"
                                    title="Eliminar los pedidos seleccionados de la Base de Datos (abre confirmación roja)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>
                                      Eliminar ({selectedIdsForProd.length})
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </div>
                            )}

                            <div className="space-y-1.5">
                              {/* Cabecera Compacta de la Lista de Tarjetas Horizontales */}
                              <div className="px-2 py-1.5 rounded-md bg-zinc-900/40 border border-zinc-800/50 flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <input
                                    type="checkbox"
                                    data-testid="admin-table-select-all-checkbox"
                                    checked={isAllFilteredSelected}
                                    onChange={() => toggleSelectAllOrdersInList(allFilteredIdsForProd)}
                                    title="Seleccionar o deseleccionar todos los pedidos filtrados"
                                    className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer shrink-0"
                                  />
                                  <span className="truncate">{prodOrders.length} pedidos</span>
                                </div>
  
                              </div>

                              {paginatedOrders.length === 0 ? (
                                <div className="py-5 px-4 rounded-lg border border-zinc-800/60 bg-[#0f0f11] text-center text-zinc-500 text-xs">
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
                                  const fullCityDept = formatFullCityDepartment(ord.ciudad, ord.departamento);
                                  const shortCity =
                                    String(ord.ciudad || '').split(' - ')[0].split(',')[0].trim() || fullCityDept;
                                  const gpsNorm = normalizeOrderGpsFields(ord, ord.comparativaDatos);
                                  const gpsUrl = gpsNorm.gpsLink;
                                  const hasExactGps = Boolean(gpsNorm.gpsLink && gpsNorm.gpsConfirmado);
                                  const hasApproxPin = Boolean(gpsNorm.gpsLink && !gpsNorm.gpsConfirmado);
                                  const effectiveMapUrl = gpsUrl || buildGoogleMapsSearchUrl(ord);
                                  const displayAmount = Number(ord.monto) || 189000;

                                  return (
                                    <div key={ord.reservaid} className="w-full">
                                      {/* TARJETA HORIZONTAL ULTRA-COMPACTA DE ALTURA FIJA E IDÉNTICA */}
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
                                        className={`w-full h-10 min-h-[40px] max-h-[40px] px-2 rounded-lg border flex items-center justify-between gap-2 transition-all cursor-pointer select-none overflow-hidden ${
                                          isConfirmedByAgent
                                            ? 'bg-[#0f0f11] hover:bg-zinc-900/90 border-emerald-800/80 text-zinc-100'
                                            : 'bg-[#0f0f11] hover:bg-zinc-900/90 border-zinc-800 text-zinc-200'
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
                                            className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer shrink-0"
                                            title={`Seleccionar pedido ${ord.reservaid}`}
                                          />

                                          <span
                                            className={`font-mono text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 tabular-nums ${
                                              isConfirmedByAgent
                                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                                : 'bg-zinc-800 text-zinc-400'
                                            }`}
                                          >
                                            #{rowNumber}
                                          </span>

                                          <span className="font-mono text-[11px] font-medium shrink-0 tabular-nums">
                                            {ord.reservaid}
                                          </span>

                                          {isConfirmedByAgent ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-semibold uppercase tracking-tight shrink-0">
                                              <CheckCircle2 className="w-2.5 h-2.5" />
                                              <span>Confirmado</span>
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-800/70 text-amber-400 text-[10px] font-bold uppercase tracking-tight shrink-0">
                                              Pendiente
                                            </span>
                                          )}

                                          {ord.archivado && (
                                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 text-[10px] font-semibold uppercase shrink-0">
                                              Arch.
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

                                          {/* Ciudad completa */}
                                          {fullCityDept && (
                                            <span
                                              className={`hidden md:inline-block text-[11px] font-semibold truncate min-w-0 max-w-[160px] ${
                                                isConfirmedByAgent ? 'text-emerald-400' : 'text-zinc-400'
                                              }`}
                                              title={fullCityDept}
                                            >
                                              {ord.tipoVivienda === 'edificio' ? '🏢' : '📍'} {fullCityDept || shortCity}
                                            </span>
                                          )}
                                        </div>

                                        {/* DERECHA: Precio + Accesos Rápidos Compactos (Mensaje, Archivar, Eliminar y Abrir Detalle) */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {/* Pack y Monto siempre 100% visible */}
                                          <span
                                            className={`hidden lg:inline-block font-mono text-[11px] font-medium tabular-nums whitespace-nowrap px-1.5 py-0.5 rounded ${
                                              isConfirmedByAgent
                                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                                                : 'bg-zinc-900 text-emerald-400 border border-zinc-800'
                                            }`}
                                          >
                                            {ord.cantidad}u · {formatGs(displayAmount)}
                                          </span>

                                          <button
                                            type="button"
                                            onClick={e => {
                                              e.stopPropagation();
                                              handleOpenOrderWhatsAppChat(ord, preferredChannel);
                                            }}
                                            className="h-8 px-3 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-all bg-[#25D366] hover:bg-[#1ebd5a] text-black shadow-sm"
                                            title="Ver mensajes del chat de este pedido (solo lectura, sin autodisparo)"
                                          >
                                            <MessageCircle className="w-3 h-3 text-black" />
                                            <span className="hidden sm:inline">Mensaje</span>
                                            {msgCount > 0 && (
                                              <span
                                                className="px-1.5 rounded-full bg-[#0b3d2e] text-[#25D366] text-[10px] font-bold tabular-nums"
                                                title={`${msgCount} mensajes en este chat`}
                                              >
                                                {msgCount} msg
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
                                            className={`h-7 px-2 rounded-lg text-[10px] font-medium border transition-all cursor-pointer inline-flex items-center gap-1 ${
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
                                            className={`h-7 px-2 rounded-lg text-[10px] font-medium inline-flex items-center gap-1 border ${
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
                                          className={`mt-1 p-3.5 sm:p-4 rounded-xl border space-y-3 ${
                                            isConfirmedByAgent
                                              ? 'bg-[#09090b] border-emerald-800/80'
                                              : 'bg-[#09090b] border-zinc-800'
                                          }`}
                                        >

                                          {/* Fila Superior del Detalle: Cabecera + Controles de Unidades, Estado y Acciones */}
                                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-800">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-emerald-400 font-mono text-xs font-semibold">
                                                #{rowNumber}
                                              </span>
                                              <span className="text-xs font-bold text-zinc-400">
                                                {fullFormattedDate} · {formattedTime}
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
                                                <span className="text-[10px] font-medium uppercase text-zinc-400 mr-1">
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
                                                  className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center justify-center cursor-pointer"
                                                >
                                                  -
                                                </button>
                                                <span className="px-1.5 text-xs font-semibold text-zinc-100 tabular-nums">
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
                                                  className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center justify-center cursor-pointer"
                                                >
                                                  +
                                                </button>
                                                <span className="ml-1.5 font-mono text-xs font-semibold text-emerald-400 tabular-nums">
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
                                                      ? 'text-amber-400 border-amber-800'
                                                      : ord.estado === 'en_camino'
                                                        ? 'text-sky-300 border-blue-800'
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
                                            {/* Columna 1: Datos Completos del Cliente (Nombre + Teléfono) */}
                                            <div className="p-2.5 sm:p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-2 flex flex-col justify-between">
                                              <div className="space-y-1.5">
                                                <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                                                  Datos del Cliente
                                                </div>
                                                <div className="flex items-center justify-between gap-2 pb-1 border-b border-zinc-800/70">
                                                  <div className="min-w-0">
                                                    <span className="text-[10px] uppercase text-zinc-500 block">
                                                      Nombre completo
                                                    </span>
                                                    <div className="font-semibold text-zinc-100 text-sm truncate" title={ord.nombre}>
                                                      {ord.nombre}
                                                    </div>
                                                  </div>
                                                  <CopyFieldBtn text={ord.nombre} label="Copiar" tooltip="Copiar Nombre Completo" />
                                                </div>
                                                <div className="flex items-center justify-between gap-2 pb-1 border-b border-zinc-800/70">
                                                  <div className="min-w-0">
                                                    <span className="text-[10px] uppercase text-zinc-500 block">
                                                      Teléfono (WhatsApp)
                                                    </span>
                                                    <div className="font-mono text-xs font-bold text-emerald-400">
                                                      {formatParaguayanPhone433(ord.celular)}
                                                    </div>
                                                  </div>
                                                  <CopyFieldBtn text={ord.celular} label="Copiar" tooltip="Copiar Teléfono" />
                                                </div>
                                                <div className="text-[11px] text-zinc-400">
                                                  Modalidad de pago:{' '}
                                                  <strong className="text-zinc-200">
                                                    {ord.detalle || 'Efectivo / QR al recibir (Contra Entrega)'}
                                                  </strong>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Columna 2: Ciudad Completa y Dirección */}
                                            <div className="p-2.5 sm:p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-1.5 flex flex-col justify-between">
                                              <div className="space-y-1.5">
                                                <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                                                  <span>Ciudad Completa y Dirección</span>
                                                  <CopyFieldBtn
                                                    text={`${fullCityDept}${ord.direccion ? ` — ${ord.direccion}` : ''}`}
                                                    label="Copiar"
                                                    tooltip="Copiar Ciudad Completa y Dirección"
                                                  />
                                                </div>
                                                <div>
                                                  <span className="text-[10px] uppercase text-zinc-500 block">
                                                    Ciudad / Departamento
                                                  </span>
                                                  <div
                                                    className="font-bold text-zinc-100 text-xs truncate"
                                                    title={fullCityDept}
                                                  >
                                                    {fullCityDept || 'Sin ciudad especificada'}
                                                  </div>
                                                </div>
                                                <div>
                                                  <span className="text-[10px] uppercase text-zinc-500 block">
                                                    Dirección y Barrio
                                                  </span>
                                                  <div className="text-zinc-300 text-[11px] leading-snug break-words">
                                                    {ord.direccion || 'Sin dirección especificada'}
                                                  </div>
                                                </div>
                                                {ord.tipoVivienda === 'edificio' && (
                                                  <div className="p-1.5 rounded-lg bg-blue-950/50 border border-blue-800/70 text-[10px] text-blue-200 mt-1">
                                                    <strong>🏢 Edificio:</strong> {ord.nombreEdificio || 'Confirmado'} ·{' '}
                                                    <strong>Piso:</strong> {ord.pisoEdificio || '-'} ·{' '}
                                                    <strong>Dpto:</strong> {ord.departamentoNumero || '-'}
                                                    {ord.detalleRecepcion ? ` · ${ord.detalleRecepcion}` : ''}
                                                  </div>
                                                )}
                                              </div>
                                            </div>

                                            {/* Columna 3: Ubicación GPS y Referencia */}
                                            <div className="p-2.5 sm:p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-2 flex flex-col justify-between">
                                              <div className="space-y-1.5">
                                                <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                                                  <span>Ubicación GPS y Referencia</span>
                                                  {ord.referenciaCasa && (
                                                    <CopyFieldBtn text={ord.referenciaCasa} label="Copiar Ref." tooltip="Copiar Referencia" />
                                                  )}
                                                </div>

                                                {gpsUrl ? (
                                                  <div
                                                    className={`p-2 rounded-lg border space-y-1.5 ${
                                                      hasExactGps
                                                        ? 'bg-emerald-950/50 border-emerald-700/70'
                                                        : 'bg-sky-950/50 border-sky-700/60'
                                                    }`}
                                                  >
                                                    <div className="flex items-center justify-between gap-2">
                                                      <span
                                                        className={`text-[10px] font-bold uppercase ${
                                                          hasExactGps ? 'text-emerald-300' : 'text-sky-300'
                                                        }`}
                                                      >
                                                        {hasExactGps
                                                          ? '📍 GPS Exacto del Cliente'
                                                          : hasApproxPin
                                                            ? '🧭 Pin Barrio / Dirección'
                                                            : '📍 Mapa GPS'}
                                                      </span>
                                                      {typeof gpsNorm.gpsLat === 'number' &&
                                                        typeof gpsNorm.gpsLng === 'number' && (
                                                          <span className="font-mono text-[10px] text-zinc-300">
                                                            {gpsNorm.gpsLat.toFixed(4)}, {gpsNorm.gpsLng.toFixed(4)}
                                                          </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                      <CopyFieldBtn
                                                        text={gpsUrl}
                                                        label="Copiar GPS"
                                                        tooltip="Copiar Link de Google Maps"
                                                      />
                                                      <a
                                                        href={gpsUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className={`flex-1 px-2.5 py-1 rounded-lg font-bold text-[11px] inline-flex items-center justify-center gap-1 shadow-sm ${
                                                          hasExactGps
                                                            ? 'bg-[#25D366] hover:bg-[#20bd5a] text-black'
                                                            : 'bg-sky-500 hover:bg-sky-400 text-black'
                                                        }`}
                                                      >
                                                        <span>{hasApproxPin ? 'Ver Pin en Maps' : 'Abrir GPS'}</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                      </a>
                                                    </div>
                                                  </div>
                                                ) : effectiveMapUrl ? (
                                                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-700/80 space-y-1.5">
                                                    <div className="text-[10px] text-amber-300 font-semibold">
                                                      📍 GPS exacto no autorizado — Enlace por dirección
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                      <CopyFieldBtn
                                                        text={effectiveMapUrl}
                                                        label="Copiar Maps"
                                                        tooltip="Copiar enlace de búsqueda en Google Maps"
                                                      />
                                                      <a
                                                        href={effectiveMapUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex-1 px-2.5 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-semibold text-[11px] inline-flex items-center justify-center gap-1"
                                                      >
                                                        <span>🔍 Buscar en Google Maps</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                      </a>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div className="text-[10px] text-zinc-500 italic">
                                                    Sin coordenadas ni dirección suficiente para mapa.
                                                  </div>
                                                )}

                                                {ord.referenciaCasa ? (
                                                  <div className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-emerald-200 font-semibold text-[11px] flex items-start gap-1.5">
                                                    <Home className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                                    <span className="leading-tight">{ord.referenciaCasa}</span>
                                                  </div>
                                                ) : (
                                                  <div className="text-zinc-500 italic text-[10px]">
                                                    Referencia de fachada: pendiente de confirmar en chat.
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Botón General de Copiar Ficha Completa */}
                                          <div className="pt-0.5">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const fullText = formatFullOrderTextForCourier(ord, comparison, 'confirmado');
                                                try {
                                                  navigator.clipboard.writeText(fullText);
                                                  showToast(`📋 Ficha completa de ${ord.nombre} copiada al portapapeles.`);
                                                } catch {}
                                              }}
                                              className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer select-none"
                                              title="Copiar todos los datos de este pedido (Nombre, Teléfono, Ciudad, Dirección, Referencia, GPS y Total) de una sola vez"
                                            >
                                              <Copy className="w-3.5 h-3.5" />
                                              <span>Copiar Ficha Completa</span>
                                            </button>
                                          </div>

                                          {/* Si está confirmado por el Agente IA, mostrar Comparativa Formulario Web vs Chat IA */}
                                          {isConfirmedByAgent && comparison && (
                                            <div className="p-3 rounded-lg bg-zinc-900/80 border border-emerald-800/70 space-y-2">
                                              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-zinc-800">
                                                <span className="text-[11px] font-medium uppercase text-zinc-100 flex items-center gap-1.5">
                                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                  Resumen del Agente IA: Datos Formulario Web vs. Datos Confirmados en Chat
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-medium uppercase">
                                                  ✓ 100% Verificado por IA
                                                </span>
                                              </div>
                                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                                                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                                                  <div className="text-[10px] font-semibold uppercase text-zinc-400">
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
                                                  <div className="text-[10px] font-semibold uppercase text-emerald-400">
                                                    2. Datos Confirmados Chat IA
                                                  </div>
                                                  <div className="font-bold text-emerald-200 mt-0.5">
                                                    {comparison.nombreConfirmado} ({comparison.celularConfirmado})
                                                  </div>
                                                  <div className="text-zinc-300">
                                                    {comparison.ubicacionConfirmada} — {comparison.direccionConfirmada}
                                                  </div>
                                                  <div className="text-emerald-300 font-semibold mt-0.5">
                                                    🏠 Ref: {comparison.referenciaConfirmada}
                                                  </div>
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200">
                                                  <div className="text-[10px] font-semibold uppercase text-amber-400">
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
                                  pedidos (10 por página)
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
                                        className={`w-8 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-all ${pageNum === currentPage
                                            ? 'bg-emerald-500 text-black shadow-sm'
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
              <div className="bg-[#0f0f11] border border-zinc-800 rounded-lg p-4 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
                    className="px-3.5 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 text-xs font-medium outline-none min-w-[230px] focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={addingSession}
                    className="px-5 py-2.5 rounded-lg bg-[#25D366] hover:bg-[#1ebd5a] text-black font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm shrink-0 transition-all"
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
                      className="bg-[#0f0f11] rounded-lg border border-zinc-800 shadow-sm overflow-hidden flex flex-col justify-between"
                    >
                      {/* Card Header */}
                      <div className="p-5 bg-[#075E54] text-white flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-[#25D366] text-black flex items-center justify-center font-bold shrink-0 shadow-sm">
                            #{idx + 1}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold truncate">{session.label}</h3>
                            <span className="text-[11px] text-emerald-200 font-bold flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${session.status === 'connected'
                                    ? 'bg-[#25D366]'
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
                          <div className="p-5 rounded-lg bg-zinc-900 border border-emerald-500/50 text-center space-y-3 my-auto">
                            <div className="w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center mx-auto shadow-sm">
                              <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div>
                              <span className="text-[10px] font-medium uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-950">
                                Línea Blindada Activa 24/7
                              </span>
                              <h4 className="text-lg font-bold text-zinc-100 mt-2">
                                +{session.connectedPhone}
                              </h4>
                              <p className="text-xs text-zinc-400 mt-1">
                                Protegida con auto-curación de llaves Signal, respaldo en Supabase y reconexión en segundo plano.
                              </p>
                            </div>
                            <div className="pt-2 flex flex-col gap-2">
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleRepairSession(session.id)}
                                className="w-full px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold uppercase tracking-wide shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Reparar / Refrescar Señal (Sin Desconectar)</span>
                              </button>
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() =>
                                  openDisconnectSecurityModal(
                                    session.id,
                                    session.label,
                                    session.connectedPhone,
                                    'logout'
                                  )
                                }
                                className="w-full px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-red-950/80 border border-zinc-700 hover:border-red-500/60 text-zinc-400 hover:text-red-300 text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                Desvincular / Cambiar Número (Protegido)
                              </button>
                            </div>
                          </div>
                        ) : session.status === 'syncing' ? (
                          <div className="p-6 rounded-lg bg-emerald-50 border-2 border-emerald-400 text-center space-y-3 my-auto">
                            <RefreshCw className="w-10 h-10 text-[#0a7a4a] animate-spin mx-auto" />
                            <h4 className="text-sm font-semibold text-zinc-100">
                              ¡Sincronizando con tu celular!
                            </h4>
                            <p className="text-xs text-zinc-400">
                              Mantené WhatsApp abierto en tu teléfono unos segundos mientras se
                              completa la conexión.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* 8-Digit Pairing Code Option (Sin escanear QR — ideal desde el celular) */}
                            <div className="bg-zinc-900 border border-emerald-700/40 rounded-xl p-3.5 text-left space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-emerald-300">
                                  Conectar con Código (sin QR)
                                </span>
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                                  Paso 1 · Acá
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-snug">
                                Poné tu número de celular y tocá <strong>Dame el Código</strong>. Después pegás ese código dentro de tu WhatsApp normal.
                              </p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="tel"
                                  inputMode="tel"
                                  value={phoneInputVal}
                                  onChange={e =>
                                    setPairingInputs(prev => ({
                                      ...prev,
                                      [session.id]: e.target.value
                                    }))
                                  }
                                  placeholder="Ej: 0973532550"
                                  className="flex-1 min-h-[42px] px-3 py-2 rounded-xl border border-zinc-700 bg-black text-xs font-mono text-zinc-100 outline-none placeholder-zinc-500 focus:border-emerald-500"
                                />
                                <button
                                  type="button"
                                  disabled={isLoading || !phoneInputVal.trim()}
                                  onClick={() => handleRequestSessionPairingCode(session.id)}
                                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-bold cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                                >
                                  {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                  <span>{isLoading ? 'Generando...' : 'Dame el Código'}</span>
                                </button>
                              </div>

                              {pairingErrorMap[session.id] && (
                                <div className="p-2.5 rounded-lg bg-red-950/70 border border-red-700/60 text-xs text-red-200">
                                  {pairingErrorMap[session.id]}
                                </div>
                              )}

                              {session.pairingCode && (
                                <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 space-y-3">
                                  <div className="text-center space-y-2">
                                    <span className="text-[11px] font-semibold text-emerald-200 block">
                                      Tu código de 8 dígitos:
                                    </span>
                                    <div className="flex items-center justify-center gap-2.5 flex-wrap">
                                      <strong className="text-xl sm:text-2xl font-mono font-bold tracking-widest text-emerald-300">
                                        {session.pairingCode}
                                      </strong>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard?.writeText(String(session.pairingCode).replace(/-/g, ''));
                                          showToast('Código copiado. Ahora abrilo en tu WhatsApp normal.');
                                        }}
                                        className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold cursor-pointer hover:bg-emerald-400"
                                      >
                                        Copiar Código
                                      </button>
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-emerald-700/50 text-[11px] text-emerald-100 space-y-1">
                                    <div className="font-bold text-emerald-300 uppercase tracking-wider text-[10px]">
                                      Paso 2 · Pegalo en tu app de WhatsApp normal:
                                    </div>
                                    <p>1. Salí de acá y abrí tu <strong>WhatsApp normal</strong> (el ícono verde).</p>
                                    <p>2. Tocá <strong>3 puntitos (⋮)</strong> o <strong>Configuración</strong> → <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong>.</p>
                                    <p>3. Abajo tocá <strong>“Vincular con el número de teléfono”</strong> y pegá este código.</p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* QR Box (Opción B: escanear desde otro celular) */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                              <div className="text-[11px] font-semibold text-zinc-400 mb-2">
                                Opción B · Escanear QR con otro teléfono
                              </div>
                              {session.qrDataUrl ? (
                                <div className="space-y-2 flex flex-col items-center">
                                  <img
                                    src={session.qrDataUrl}
                                    alt={`QR ${session.label}`}
                                    className="w-44 h-44 rounded-lg border-4 border-[#0b3d2e] shadow-sm bg-white p-1"
                                  />
                                  <div className="flex items-center gap-2 pt-1">
                                    <span className="text-[11px] font-medium text-[#0a7a4a]">
                                      Escaneá este QR con tu WhatsApp
                                    </span>
                                    <button
                                      type="button"
                                      disabled={isLoading}
                                      onClick={() => handleConnectSession(session.id, true)}
                                      className="text-[11px] font-medium text-zinc-400 hover:text-zinc-100 underline cursor-pointer"
                                    >
                                      Refrescar QR
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2.5 py-3">
                                  <RefreshCw className="w-6 h-6 text-[#0a7a4a] animate-spin mx-auto" />
                                  <p className="text-xs font-medium text-zinc-400">
                                    Preparando QR de respaldo para {session.label}...
                                  </p>
                                  <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleConnectSession(session.id, true)}
                                    className="px-3.5 py-1.5 rounded-lg bg-[#0b3d2e] text-white text-xs font-semibold cursor-pointer"
                                  >
                                    Generar Nuevo QR
                                  </button>
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
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-zinc-800 text-white shadow-sm flex items-center justify-center gap-2"
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Deepgram Todo-en-Uno</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMenu("openrouter")}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cerebro GLM-5.3</span>
                </button>
              </div>

              <div className="bg-[#0f0f11] border border-zinc-800 rounded-lg p-4 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg">
                    <Zap className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-100">Infraestructura de Voz Deepgram (STT + TTS)</h2>
                    <p className="text-xs text-zinc-400">Deepgram impulsa la escucha (Nova-3 STT) y la voz humana ultra-realista (Aura-2 TTS) para llamadas automáticas a compradores.</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold ${deepgramHasKey ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80' : 'bg-amber-950/80 text-amber-400 border border-amber-800/80'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${deepgramHasKey ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {deepgramHasKey ? `✅ Deepgram Activo (${deepgramApiKeyPreview})` : '⚠️ No hay API Key configurada — Las funciones de voz están deshabilitadas'}
                </div>
              </div>

              <div className="bg-[#0f0f11] border border-zinc-800 rounded-lg p-4 sm:p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
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
                    <button type="button" onClick={() => setDeepgramShowKey(prev => !prev)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-zinc-300 cursor-pointer" title={deepgramShowKey ? 'Ocultar' : 'Mostrar'}>
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
                  }} className="px-5 py-3 rounded-lg bg-[#25D366] hover:bg-[#1ebd5a] text-black font-bold text-sm cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-sm">
                    <Save className="w-4 h-4" />
                    {deepgramSaving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>

              <div className="bg-[#0f0f11] border border-zinc-800 rounded-lg p-4 sm:p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
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
                }} className="px-5 py-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-emerald-300 font-bold text-sm cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-sm">
                  <Volume2 className="w-4 h-4" />
                  {deepgramTesting ? 'Probando...' : 'Probar Conexión'}
                </button>
              </div>

              <div className="bg-[#0f0f11] border border-zinc-800 rounded-lg p-4 sm:p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-emerald-400" />
                  Voces Disponibles (Deepgram Aura-2 · Español)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DEFAULT_DEEPGRAM_CATALOG.map(voice => (
                    <div key={voice.id} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-medium uppercase ${voice.gender === 'Femenina' ? 'text-rose-400' : 'text-sky-400'}`}>{voice.gender === 'Femenina' ? 'Mujer' : 'Hombre'}</span>
                        <span className="text-[10px] font-mono text-zinc-500">{voice.deepgramModel}</span>
                      </div>
                      <div className="font-semibold text-sm text-zinc-100">{voice.name.split(' (')[0]}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{voice.description}</div>
                      <div className="text-[10px] text-zinc-500 mt-1">{voice.accent}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500">Podés seleccionar la voz activa desde el panel del Agente IA dentro de cada página de producto.</p>
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
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Deepgram Todo-en-Uno</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMenu('openrouter')}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-zinc-800 text-white shadow-sm flex items-center justify-center gap-2"
                >
                  <Bot className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cerebro GLM-5.3</span>
                </button>
              </div>

              {/* Header */}
              <div className="bg-[#0f0f11] border border-zinc-800 rounded-lg p-4 sm:p-6 shadow-sm space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-sm">
                    <Bot className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-100">Cerebro LLM · GLM-5.3 (OpenRouter)</h2>
                    <p className="text-xs text-zinc-400">
                      Modelo conversacional inteligente que atiende dudas de compradores, confirma reservas y asiste al Agente de Codificación en tiempo real.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Modelo Activo: GLM-5.3 · Conexión directa vía OpenRouter</span>
                </div>
              </div>

              {/* Test Connection */}
              <div className="bg-[#0f0f11] border border-zinc-800 rounded-lg p-4 sm:p-6 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
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
                  className="px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-50 text-emerald-300 font-bold text-sm inline-flex items-center gap-2 cursor-pointer transition-all shadow-sm"
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
              <div className="bg-[#0f0f11] border border-zinc-800 rounded-lg p-4 sm:p-6 shadow-sm space-y-2">
                <h3 className="text-sm font-semibold text-zinc-100">ℹ️ Arquitectura Todo-en-Uno de Deepgram</h3>
                <ul className="text-xs text-zinc-400 space-y-1.5 list-disc pl-4">
                  <li><strong>STT (Voz a Texto):</strong> Deepgram Nova-3 Español transcribe al instante los audios que envía el cliente.</li>
                  <li><strong>LLM (Cerebro IA):</strong> Deepgram Voice Agent (`open_ai / gpt-4o-mini` gestionado por Deepgram) razona cada paso sin depender de OpenRouter.</li>
                  <li><strong>TTS (Texto a Voz):</strong> Deepgram Aura-2 Español sintetiza notas de voz OGG/Opus nativas para WhatsApp.</li>
                  <li><strong>Flujo Express de 2 Etapas:</strong> Etapa 1 (Saludo + Imagen del pedido esperando confirmación "CORRECTO") → Etapa 2 (Pedido confirmado y agradecimiento final).</li>
                </ul>
              </div>
            </div>
          )}

        </main>

        {/* Mobile Bottom Navigation — iOS/Android Native Style */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#0a0a0a]/95 backdrop-blur-md border-t border-zinc-800 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 px-2 flex items-center justify-around">
          <button
            type="button"
            data-testid="bottom-nav-productos"
            onClick={() => setActiveMenu('productos')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer ${
              activeMenu === 'productos' ? 'text-emerald-400' : 'text-zinc-500'
            }`}
          >
            <Layers className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">Páginas</span>
          </button>
          <button
            type="button"
            data-testid="bottom-nav-creador"
            onClick={() => setActiveMenu('creador')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer ${
              activeMenu === 'creador' ? 'text-emerald-400' : 'text-zinc-500'
            }`}
          >
            <Sparkles className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">Creador</span>
          </button>
          <button
            type="button"
            data-testid="bottom-nav-pipeboard"
            onClick={() => setActiveMenu('pipeboard')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer ${
              activeMenu === 'pipeboard' ? 'text-emerald-400' : 'text-zinc-500'
            }`}
          >
            <Bot className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">AutoAds</span>
          </button>
          <button
            type="button"
            data-testid="bottom-nav-whatsapp"
            onClick={() => setActiveMenu('whatsapp')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer ${
              activeMenu === 'whatsapp' ? 'text-emerald-400' : 'text-zinc-500'
            }`}
          >
            <div className="relative">
              <Smartphone className="w-5 h-5 mb-0.5" />
              {connectedSessionsCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </div>
            <span className="text-[10px] font-medium">WhatsApp</span>
          </button>
          <button
            type="button"
            data-testid="bottom-nav-deepgram"
            onClick={() => setActiveMenu('deepgram')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer ${
              activeMenu === 'deepgram' || activeMenu === 'openrouter' ? 'text-emerald-400' : 'text-zinc-500'
            }`}
          >
            <Zap className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">Config</span>
          </button>
        </nav>
      </div>

      {/* ============================================================== */}
      {/* 3. CONSOLA DE WHATSAPP INCRUSTADA EN EL SISTEMA (CHAT EN VIVO) */}
      {/* ============================================================== */}
      {activeAiOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#0a0a0a] rounded-t-2xl sm:rounded-xl max-w-4xl w-full shadow-lg border border-zinc-800 overflow-hidden max-h-[95vh] sm:max-h-[92vh] flex flex-col">
            {/* CABECERA */}
            <div className="px-4 sm:px-6 py-3 bg-zinc-900 text-zinc-100 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-zinc-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-semibold text-base shrink-0">
                  {(activeAiOrder.nombre || 'C').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold truncate text-white">
                      {activeAiOrder.nombre}
                    </h3>
                    <span className="text-[11px] font-mono bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded text-zinc-300">
                      +{formatWaPhone(activeAiOrder.celular)}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {activeAiOrder.reservaid} · {activeAiOrder.producto || 'Producto'} (
                      {formatGs(activeAiOrder.monto)})
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                    {activeAiOrder.ciudad}, {activeAiOrder.departamento} —{' '}
                    {activeAiOrder.direccion}
                    {activeAiOrder.referenciaCasa
                      ? ` | 🏠 Ref: ${activeAiOrder.referenciaCasa}`
                      : ''}
                  </p>
                </div>
              </div>

              {/* Controles de Canal y Autorización dentro del Chat: Yo Escribo | Texto IA | Audio IA (solo cambia el modo, sin autodisparo) */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <div className="inline-flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 gap-1">
                  {/* 1. MODO MANUAL: YO ESCRIBO */}
                  <button
                    type="button"
                    onClick={() => handleSwitchOrderChatMode(activeAiOrder, 'manual', modalAiChannel, false)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
                      modalAiMode === 'manual'
                        ? 'bg-amber-400 text-black shadow-sm'
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
                    onClick={() => handleSwitchOrderChatMode(activeAiOrder, 'automatico', 'texto', false)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-all ${
                      modalAiMode === 'automatico' && modalAiChannel === 'texto'
                        ? 'bg-emerald-500 text-black shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                    title="Activar Agente IA por texto (en contexto, sin autodisparo)"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>IA Texto</span>
                  </button>

                  {/* 3. AUDIO IA */}
                  <button
                    type="button"
                    onClick={() => handleSwitchOrderChatMode(activeAiOrder, 'automatico', 'audio', false)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-all ${
                      modalAiMode === 'automatico' && modalAiChannel === 'audio'
                        ? 'bg-emerald-500 text-black shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                    title="Activar Agente IA con notas de voz OGG/Opus (en contexto, sin autodisparo)"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>IA Audio</span>
                  </button>
                </div>

                <button
                  type="button"
                  aria-label="Cerrar ventana de chat"
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

            {/* TARJETA HORIZONTAL DE ETAPA + ÚLTIMO MENSAJE ENVIADO + TEMPORIZADOR DINÁMICO */}
            {activeChatStageSnapshot && (
              <div className="px-3 sm:px-5 py-2.5 bg-zinc-950 border-b border-zinc-800/90 shrink-0 max-h-[38vh] overflow-y-auto md:max-h-none md:overflow-visible">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                  {/* LADO IZQUIERDO: TARJETA ELEGANTE DE ETAPA 1/2 Y 2/2 */}
                  <div
                    className={`md:col-span-7 rounded-xl border px-3.5 py-2.5 flex flex-col justify-between gap-2 ${
                      activeChatStageSnapshot.stage === 'stage_2_confirmed'
                        ? 'bg-emerald-950/35 border-emerald-500/35'
                        : activeChatStageSnapshot.stage === 'stage_1_waiting_correcto'
                          ? 'bg-amber-950/30 border-amber-500/35'
                          : 'bg-zinc-900/90 border-zinc-700/75'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1 bg-zinc-950/85 p-0.5 rounded-lg border border-zinc-800 text-[11px] font-bold">
                        <span
                          className={`px-2 py-1 rounded-md transition-colors ${
                            activeChatStageSnapshot.stage !== 'stage_2_confirmed'
                              ? 'bg-amber-400 text-black'
                              : 'text-zinc-400'
                          }`}
                        >
                          Etapa 1/2 · Saludo + Imagen
                        </span>
                        <span
                          className={`px-2 py-1 rounded-md transition-colors ${
                            activeChatStageSnapshot.stage === 'stage_2_confirmed'
                              ? 'bg-emerald-500 text-black'
                              : 'text-zinc-400'
                          }`}
                        >
                          Etapa 2/2 · Confirmado
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            modalAiMode === 'automatico'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                              : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                          }`}
                        >
                          {modalAiMode === 'automatico'
                            ? modalAiChannel === 'audio'
                              ? '🎤 Audio IA Activo'
                              : '💬 Texto IA Activo'
                            : '👤 Yo Escribo (Manual)'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const isEtapa2 = Boolean(
                              activeAiOrder.datosConfirmados ||
                                (liveChatConvStep ?? activeAiOrder.convStep ?? 1) >= 5
                            );
                            if (isEtapa2) {
                              handleSendOrderAudioNote(
                                activeAiOrder,
                                `Excelente ${activeAiOrder.nombre?.split(' ')[0] || ''}, tu pedido ya está 100% confirmado para entrega. ¡Muchas gracias por tu compra!`,
                                modalAiChannel
                              );
                            } else {
                              fetch('/api/whatsapp/call/start', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  phone: formatWaPhone(activeAiOrder.celular),
                                  orderId: activeAiOrder.reservaid,
                                  resetCall: true,
                                  channel: modalAiChannel
                                })
                              })
                                .then(r => r.json())
                                .then(d => {
                                  if (Array.isArray(d.messages)) setLiveChatMessages(d.messages);
                                  fetchLiveOrderChat(activeAiOrder.celular);
                                  showToast(`🔄 Etapa 1/2 re-disparada manualmente para ${activeAiOrder.nombre}.`);
                                })
                                .catch(() => {});
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-600 text-[11px] font-semibold cursor-pointer transition-colors"
                          title="Re-enviar manualmente el mensaje de la etapa actual"
                        >
                          🔄 Re-disparar etapa
                        </button>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <p
                        className={`text-xs sm:text-[13px] font-bold flex items-center gap-1.5 ${
                          activeChatStageSnapshot.stage === 'stage_2_confirmed'
                            ? 'text-emerald-300'
                            : activeChatStageSnapshot.stage === 'stage_1_waiting_correcto'
                              ? 'text-amber-300'
                              : 'text-zinc-200'
                        }`}
                      >
                        {activeChatStageSnapshot.stage === 'stage_2_confirmed' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : activeChatStageSnapshot.stage === 'stage_1_waiting_correcto' ? (
                          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <Info className="w-4 h-4 text-zinc-400 shrink-0" />
                        )}
                        <span>{activeChatStageSnapshot.stageTitle}</span>
                      </p>
                      <p className="text-[11px] text-zinc-300/90 leading-snug">
                        {activeChatStageSnapshot.stageSubtitle}
                      </p>
                    </div>
                  </div>

                  {/* LADO DERECHO (AL LADO DENTRO DE LA TARJETA): ÚLTIMO MENSAJE ENVIADO */}
                  <div className="md:col-span-5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 flex flex-col justify-between gap-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                        <Send className="w-3 h-3 text-emerald-400" />
                        Último Mensaje Enviado
                      </span>
                      {activeChatStageSnapshot.lastOutgoingMsg && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700">
                          {activeChatStageSnapshot.lastOutgoingMsg.channelBadge}
                        </span>
                      )}
                    </div>

                    {activeChatStageSnapshot.lastOutgoingMsg ? (
                      <>
                        <p className="text-[11px] text-zinc-200 leading-snug line-clamp-2">
                          «{activeChatStageSnapshot.lastOutgoingMsg.previewText}»
                        </p>
                        <div className="flex items-center justify-between gap-2 text-[10px] pt-0.5 flex-wrap">
                          <span
                            className={`font-semibold px-1.5 py-0.5 rounded ${
                              activeChatStageSnapshot.lastOutgoingMsg.isReminder
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {activeChatStageSnapshot.lastOutgoingMsg.kindBadge}
                          </span>
                          <span className="text-zinc-400 font-medium">
                            Hace {activeChatStageSnapshot.lastOutgoingMsg.elapsedLabel}
                            {activeChatStageSnapshot.lastOutgoingMsg.clockText
                              ? ` · ${activeChatStageSnapshot.lastOutgoingMsg.clockText}`
                              : ''}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-zinc-500 italic my-auto">
                        Todavía no se registró ningún mensaje saliente para este cliente.
                      </p>
                    )}
                  </div>
                </div>

                {/* TEMPORIZADOR DESCRIPTIVO Y DINÁMICO (DEBAJO DE LA TARJETA) */}
                <div
                  className={`mt-2 rounded-xl border px-3.5 py-2 flex flex-col sm:flex-row sm:items-center gap-2 ${
                    activeChatStageSnapshot.timerBanner.status === 'counting' ||
                    activeChatStageSnapshot.timerBanner.status === 'due_now'
                      ? 'bg-amber-500/10 border-amber-500/35 text-amber-100'
                      : activeChatStageSnapshot.timerBanner.status === 'confirmed'
                        ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-100'
                        : activeChatStageSnapshot.timerBanner.status === 'pending_connection'
                          ? 'bg-sky-500/10 border-sky-500/30 text-sky-100'
                          : 'bg-zinc-900/90 border-zinc-700/80 text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <Clock
                      className={`w-4 h-4 shrink-0 ${
                        activeChatStageSnapshot.timerBanner.status === 'counting' ||
                        activeChatStageSnapshot.timerBanner.status === 'due_now'
                          ? 'text-amber-400 animate-pulse'
                          : activeChatStageSnapshot.timerBanner.status === 'confirmed'
                            ? 'text-emerald-400'
                            : 'text-zinc-400'
                      }`}
                    />
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/35 border border-white/10">
                      {activeChatStageSnapshot.timerBanner.badgeText}
                    </span>
                    {activeChatStageSnapshot.timerBanner.countdownBadge && (
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-black/50 border border-white/15 text-amber-300">
                        {activeChatStageSnapshot.timerBanner.countdownBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs leading-relaxed text-zinc-100 font-medium">
                    {activeChatStageSnapshot.timerBanner.descriptiveText}
                  </p>
                </div>
              </div>
            )}

            {/* VENTANA CENTRAL DE CHAT DE WHATSAPP EN TIEMPO REAL */}
            <div
              ref={chatScrollContainerRef}
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#09090b]"
            >
              {liveChatMessages.length === 0 ? (
                activeAiOrder.ultimoMensajeIA || activeAiOrder.datosConfirmados || (activeAiOrder.convStep || 1) >= 2 ? (
                  <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 max-w-xl mx-auto space-y-2 mt-4 text-center">
                    <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      Conversación ya iniciada con {activeAiOrder.nombre} ({activeAiOrder.datosConfirmados || (activeAiOrder.convStep || 1) >= 5 ? 'Etapa 2/2' : 'Etapa 1/2'})
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      El agente ya registró avance en este pedido y no reiniciará desde el saludo #1. Podés escribir un mensaje manual abajo si necesitás contactarlo.
                    </p>
                  </div>
                ) : (
                  <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 max-w-xl mx-auto space-y-3 mt-4 text-center">
                    <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      Pedido recibido de {activeAiOrder.nombre} ({activeAiOrder.producto})
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Este pedido aún no tiene mensajes. Elegí cómo querés iniciar el contacto:
                    </p>
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleSwitchOrderChatMode(activeAiOrder, 'automatico', 'audio', true)}
                        className="px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>1. Mandar 🎤 Audio de Voz IA</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchOrderChatMode(activeAiOrder, 'automatico', 'texto', true)}
                        className="px-3.5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>2. Iniciar con 💬 Texto IA</span>
                      </button>
                    </div>
                  </div>
                )
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
                        {msg.senderName
                          ? msg.senderName
                          : msg.sender === 'ai'
                            ? '🤖 Agente IA de Confirmación (Desde tu WhatsApp)'
                            : msg.sender === 'admin'
                              ? '👤 Tú (Desde tu WhatsApp)'
                              : `📱 ${activeAiOrder.nombre} (Cliente)`}
                      </span>
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] px-3.5 py-2.5 rounded-lg text-xs sm:text-[13px] whitespace-pre-line leading-relaxed shadow-sm ${isOutgoing
                            ? 'bg-emerald-950/80 text-emerald-100 rounded-tr-xs border border-emerald-500/30'
                            : 'bg-zinc-900 text-zinc-100 rounded-tl-xs border border-zinc-800'
                          }`}
                      >
                        {msg.imageUrl && (
                          <div className="mb-2.5 rounded-xl overflow-hidden border border-amber-400/40 bg-black max-w-[300px]">
                            <img
                              src={msg.imageUrl}
                              alt={msg.senderName || 'Comercial de etapa'}
                              referrerPolicy="no-referrer"
                              className="w-full aspect-square object-cover"
                            />
                            {msg.commercialPackQty && msg.commercialFramedPriceGs && (
                              <div className="px-2.5 py-1.5 bg-zinc-950 text-[11px] font-mono tabular-nums text-amber-400 flex items-center justify-between">
                                <span>Pack {msg.commercialPackQty}x verificado</span>
                                <span>{formatGs(msg.commercialFramedPriceGs)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div>{typeof msg.text === 'string' ? msg.text.replace(/\n{2,}/g, '\n') : (msg.text && typeof msg.text === 'object' && (msg.text as any).text ? String((msg.text as any).text) : String(msg.text || ''))}</div>
                        <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px] text-zinc-400">
                          {msg.sender === 'ai' && !msg.imageUrl ? (
                            <button
                              type="button"
                              onClick={() => playSpokenAudio(msg.text, msg.audioDataUrl)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold text-[10px] cursor-pointer hover:bg-emerald-500/30"
                            >
                              <Volume2 className="w-3 h-3 text-emerald-400" />
                              <span>Escuchar Voz (Deepgram Aura-2)</span>
                            </button>
                          ) : msg.audioDataUrl ? (
                            <button
                              type="button"
                              onClick={() => playSpokenAudio(msg.text, msg.audioDataUrl)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-black font-semibold text-[10px] cursor-pointer hover:bg-amber-400"
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
                              <span className="text-emerald-400 font-semibold">
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
              {liveChatMessages.length > 0 &&
                liveChatMessages[liveChatMessages.length - 1]?.sender === 'client' &&
                !activeAiOrder.datosConfirmados && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-xs">
                    <span className="text-emerald-200 font-medium">
                      📩 El cliente respondió último ({activeAiOrder.datosConfirmados || (activeAiOrder.convStep || 1) >= 5 ? 'Etapa 2/2' : 'Etapa 1/2'}). Podés responderle en contexto sin reiniciar desde cero:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSendOrderAudioNote(activeAiOrder, undefined, modalAiChannel)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs shrink-0 cursor-pointer"
                    >
                      🤖 Responder en contexto
                    </button>
                  </div>
                )}
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
                  className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all shrink-0"
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
                  className="px-4 sm:px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm shrink-0 transition-all"
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
          className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#991b1b] border-4 border-[#ef4444] rounded-3xl w-full max-w-lg overflow-hidden shadow-lg text-white">
            {/* Cabecera Roja Impactante */}
            <div className="bg-[#dc2626] px-6 py-5 border-b-2 border-red-400/40 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white text-[#dc2626] flex items-center justify-center font-semibold text-2xl shrink-0 shadow-sm">
                  ⚠️
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-black/30 text-red-100 text-[10px] font-medium uppercase tracking-widest mb-1">
                    ALERTA ROJA · ELIMINACIÓN DIRECTA EN BASE DE DATOS
                  </span>
                  <h3 className="text-base sm:text-lg font-semibold uppercase tracking-wide leading-tight text-white">
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
                className="w-8 h-8 rounded-xl bg-black/25 hover:bg-black/40 text-white flex items-center justify-center font-semibold cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo del Pop-Up Rojo */}
            <div className="p-6 space-y-4 bg-red-900">
              <p className="text-xs sm:text-sm font-bold text-red-100 leading-relaxed">
                Vas a eliminar de forma <strong className="text-white underline">permanente e irreversible</strong>{' '}
                {deleteConfirmModal.orderIds.length === 1
                  ? 'el siguiente pedido seleccionado'
                  : `los siguientes ${deleteConfirmModal.orderIds.length} pedidos seleccionados`}{' '}
                directamente de la Base de Datos (Supabase + Servidor Central):
              </p>

              <div className="max-h-48 overflow-y-auto rounded-lg bg-black/35 border border-red-400/30 divide-y divide-red-400/20 p-2 space-y-1.5">
                {deleteConfirmModal.ordersPreview.length > 0 ? (
                  deleteConfirmModal.ordersPreview.map(ord => (
                    <div
                      key={ord.reservaid}
                      className="px-3 py-2 rounded-lg bg-red-950/60 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">
                          {ord.nombre || 'Cliente'} · <span className="font-mono text-amber-400">{ord.reservaid}</span>
                        </div>
                        <div className="text-[11px] text-red-200 font-mono">
                          {formatParaguayanPhone433(ord.celular)} · 📍 {ord.ciudad}
                        </div>
                      </div>
                      <span className="font-semibold text-amber-400 shrink-0">
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
                  className="w-full sm:w-auto px-5 py-3 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold text-xs uppercase tracking-wider cursor-pointer transition-all"
                >
                  No, Cancelar
                </button>
                <button
                  type="button"
                  data-testid="admin-confirm-delete-btn"
                  disabled={deleteConfirmModal.isDeleting}
                  onClick={handleConfirmExecuteDelete}
                  className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold text-xs sm:text-sm uppercase tracking-wider border-2 border-white shadow-xl inline-flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
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
          className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#991b1b] border-4 border-[#ef4444] rounded-3xl w-full max-w-lg overflow-hidden shadow-lg text-white">
            <div className="bg-[#dc2626] px-6 py-5 border-b-2 border-red-400/40 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white text-[#dc2626] flex items-center justify-center font-semibold text-2xl shrink-0 shadow-sm">
                  ⚠️
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-black/30 text-red-100 text-[10px] font-medium uppercase tracking-widest mb-1">
                    ALERTA ROJA · ELIMINAR PÁGINAS DE PRODUCTO
                  </span>
                  <h3 className="text-base sm:text-lg font-semibold uppercase tracking-wide leading-tight text-white">
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
                className="w-8 h-8 rounded-xl bg-black/25 hover:bg-black/40 text-white flex items-center justify-center font-semibold cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 bg-red-900">
              <p className="text-xs sm:text-sm font-bold text-red-100 leading-relaxed">
                Vas a eliminar de forma <strong className="text-white underline">permanente</strong>{' '}
                {deleteProductsConfirmModal.productIds.length === 1
                  ? 'la siguiente página de producto seleccionada'
                  : `las siguientes ${deleteProductsConfirmModal.productIds.length} páginas de producto seleccionadas`}{' '}
                directamente de la Base de Datos:
              </p>

              <div className="max-h-48 overflow-y-auto rounded-lg bg-black/35 border border-red-400/30 divide-y divide-red-400/20 p-2 space-y-1.5">
                {deleteProductsConfirmModal.productsPreview.map(p => (
                  <div
                    key={p.id}
                    className="px-3 py-2 rounded-lg bg-red-950/60 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {p.nombre}
                      </div>
                      <div className="text-[11px] text-red-200 font-mono">
                        /?p={p.slug} · ID: {p.id}
                      </div>
                    </div>
                    <span className="font-semibold text-amber-400 shrink-0">
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
                  className="w-full sm:w-auto px-5 py-3 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold text-xs uppercase tracking-wider cursor-pointer transition-all"
                >
                  No, Cancelar
                </button>
                <button
                  type="button"
                  data-testid="admin-confirm-delete-products-btn"
                  disabled={deleteProductsConfirmModal.isDeleting}
                  onClick={handleConfirmExecuteDeleteProducts}
                  className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold text-xs sm:text-sm uppercase tracking-wider border-2 border-white shadow-xl inline-flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
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

      {/* MODAL DE CARGA RÁPIDA DE CLIENTE / PEDIDO DE WHATSAPP */}
      {showManualOrderModal && manualOrderProduct && (
        <div
          data-testid="admin-manual-order-modal"
          className="fixed inset-0 z-[95] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-[#0f0f12] border-2 border-emerald-500/60 rounded-3xl w-full max-w-lg overflow-hidden shadow-lg text-white">
            <div className="bg-emerald-950/80 px-5 py-4 border-b border-emerald-700/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-500 text-black flex items-center justify-center font-semibold text-lg shrink-0 shadow-sm">
                  📲
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold uppercase tracking-wide text-emerald-200">
                    Registrar Cliente de WhatsApp
                  </h3>
                  <p className="text-[11px] text-zinc-300 font-medium truncate max-w-xs">
                    {manualOrderProduct.nombre}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManualOrderModal(false)}
                className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center font-semibold cursor-pointer shrink-0 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManualOrder} className="p-5 space-y-3.5 bg-[#0f0f11] max-h-[80vh] overflow-y-auto">
              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-200 leading-relaxed">
                <strong>Guardado Directo en Base de Datos:</strong> Este cliente se registrará de inmediato en la base de datos de tu servidor y tu Agente IA lo vinculará automáticamente para continuar la confirmación.
              </div>

              {/* Nombre y Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-300 mb-1">
                    👤 Nombre del Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. María Benítez"
                    value={manualNombre}
                    onChange={e => setManualNombre(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white font-bold text-xs focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-300 mb-1">
                    WhatsApp / Celular *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="0981 123 456"
                    value={manualCelular}
                    onChange={e => setManualCelular(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white font-bold text-xs focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Selector de Pack */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-300 mb-1">
                  Pack Seleccionado
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map(packNum => {
                    const price = manualOrderProduct.precios?.[packNum] || (packNum === 1 ? 189000 : packNum === 2 ? 358000 : 507000);
                    const isSelected = manualPack === packNum;
                    return (
                      <button
                        key={packNum}
                        type="button"
                        onClick={() => setManualPack(packNum)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-sm ring-1 ring-emerald-500'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-semibold">{packNum} un.</div>
                        <div className="text-[10px] font-mono font-bold text-emerald-400 mt-0.5">
                          {formatGs(price)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tipo de Vivienda */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-300 mb-1">
                  🏠 Tipo de Vivienda
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualVivienda('casa')}
                    className={`p-2 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                      manualVivienda === 'casa'
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    🏡 Casa Independiente
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualVivienda('edificio')}
                    className={`p-2 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                      manualVivienda === 'edificio'
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    🏢 Edificio / Dpto
                  </button>
                </div>
              </div>

              {/* Ciudad y Departamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-300 mb-1">
                    Ciudad / Barrio
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Asunción, San Lorenzo..."
                    value={manualCiudad}
                    onChange={e => setManualCiudad(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white font-medium text-xs focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-300 mb-1">
                    🏛️ Departamento
                  </label>
                  <select
                    value={manualDepartamento}
                    onChange={e => setManualDepartamento(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white font-medium text-xs focus:border-emerald-500 outline-none"
                  >
                    <option value="Central">Central</option>
                    <option value="Capital (Asunción)">Capital (Asunción)</option>
                    <option value="Alto Paraná">Alto Paraná</option>
                    <option value="Itapúa">Itapúa</option>
                    <option value="Caaguazú">Caaguazú</option>
                    <option value="Cordillera">Cordillera</option>
                    <option value="San Pedro">San Pedro</option>
                    <option value="Paraguarí">Paraguarí</option>
                    <option value="Concepción">Concepción</option>
                    <option value="Guairá">Guairá</option>
                    <option value="Amambay">Amambay</option>
                    <option value="Canindeyú">Canindeyú</option>
                    <option value="Presidente Hayes">Presidente Hayes</option>
                    <option value="Misiones">Misiones</option>
                    <option value="Caazapá">Caazapá</option>
                    <option value="Ñeembucú">Ñeembucú</option>
                    <option value="Boquerón">Boquerón</option>
                    <option value="Alto Paraguay">Alto Paraguay</option>
                  </select>
                </div>
              </div>

              {/* Dirección / Referencia */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-300 mb-1">
                  🧭 Dirección / Calle / Referencia
                </label>
                <input
                  type="text"
                  placeholder="Calle, número de casa, color de portón..."
                  value={manualDireccion}
                  onChange={e => setManualDireccion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white font-medium text-xs focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Botones de acción */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={manualSubmitting}
                  onClick={() => setShowManualOrderModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  <span>{manualSubmitting ? 'Guardando...' : '💾 Registrar Cliente en Base de Datos'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP FUERTE DE SEGURIDAD ANTIDESCONEXIÓN DE WHATSAPP */}
      {disconnectSecurityModal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setDisconnectSecurityModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-zinc-950 border-2 border-red-500  overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header de Alerta Máxima */}
            <div className="bg-red-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-black/30 border border-white/25 flex items-center justify-center text-white shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-widest px-2 py-0.5 rounded bg-black/40 text-amber-200">
                    Escudo de Blindaje Antidesconexión
                  </span>
                  <h3 className="text-base font-semibold text-white uppercase tracking-tight mt-0.5">
                    ¡Alto! Protección de Campañas y Ventas Activa
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDisconnectSecurityModal(null)}
                className="w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-lg bg-red-950/60 border border-red-500/50 space-y-1.5">
                <p className="text-xs font-semibold text-red-200 uppercase">
                  ⚠️ Advertencia Crítica sobre tus Anuncios Activos:
                </p>
                <p className="text-xs text-red-100/90 leading-relaxed">
                  Estás intentando desvincular la línea{' '}
                  <span className="font-semibold text-white">
                    {disconnectSecurityModal.label}{' '}
                    {disconnectSecurityModal.phone ? `(+${disconnectSecurityModal.phone})` : ''}
                  </span>
                  . Si la desconectás, el Agente IA dejará de responder a los clientes que entren desde tus anuncios hasta que escanées un nuevo QR.
                </p>
              </div>

              {/* Opción Recomendada: Reparar SIN desconectar */}
              <div className="p-4 rounded-lg bg-emerald-950/60 border-2 border-emerald-500/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-300">
                    Alternativa Segura (Sin perder vinculación)
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500 text-zinc-950 uppercase">
                    Recomendado
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Si sentís que algún mensaje tardó o querés refrescar la conexión, <strong>NO hace falta desconectar</strong>. Usá el botón de abajo para regenerar llaves Signal y reiniciar el canal manteniendo tu número conectado:
                </p>
                <button
                  type="button"
                  onClick={() => handleRepairSession(disconnectSecurityModal.sessionId)}
                  className="w-full py-3 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reparar y Refrescar Señal SIN Desconectar</span>
                </button>
              </div>

              {/* Doble llave de confirmación manual */}
              <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Desbloqueo Manual de Seguridad (Solo si vas a cambiar de número):
                </p>

                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={disconnectConfirmChecked}
                    onChange={e => setDisconnectConfirmChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-red-600 rounded cursor-pointer"
                  />
                  <span className="text-xs text-zinc-300 leading-snug">
                    Comprendo que al desvincular este número se pausará la atención automática de WhatsApp hasta vincular otro teléfono.
                  </span>
                </label>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Escribí la palabra <span className="text-red-400 font-semibold">DESCONECTAR</span> para desbloquear el botón:
                  </label>
                  <input
                    type="text"
                    value={disconnectConfirmText}
                    onChange={e => setDisconnectConfirmText(e.target.value)}
                    placeholder="Escribí DESCONECTAR aquí..."
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700 focus:border-red-500 text-white font-semibold text-xs tracking-wider uppercase outline-none"
                  />
                </div>
              </div>

              {/* Botones inferiores */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setDisconnectSecurityModal(null)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs uppercase cursor-pointer"
                >
                  Cancelar y Mantener Conectado
                </button>
                <button
                  type="button"
                  disabled={
                    !disconnectConfirmChecked ||
                    disconnectConfirmText.trim().toUpperCase() !== 'DESCONECTAR'
                  }
                  onClick={() => {
                    if (disconnectSecurityModal.action === 'remove') {
                      handleRemoveWhatsAppSession(
                        disconnectSecurityModal.sessionId,
                        disconnectSecurityModal.label,
                        'CONFIRMAR_DESCONEXION_MANUAL'
                      );
                      setDisconnectSecurityModal(null);
                    } else {
                      handleDisconnectSession(
                        disconnectSecurityModal.sessionId,
                        'CONFIRMAR_DESCONEXION_MANUAL'
                      );
                    }
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold text-xs uppercase tracking-wider shadow-lg cursor-pointer disabled:cursor-not-allowed transition-all"
                >
                  🔓 Confirmar Desconexión Definitiva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DownloadAppsModal
        isOpen={showDownloadAppsModal}
        onClose={() => setShowDownloadAppsModal(false)}
        onLaunchAndroidApp={() => {
          window.history.pushState({}, '', '/app-android');
          setCurrentView('app-android');
        }}
        onLaunchIphoneApp={() => {
          window.history.pushState({}, '', '/app-iphone');
          setCurrentView('app-iphone');
        }}
      />
    </div>
  );
};
