import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Order,
  AppConfig,
  OrderStatus,
  ViewType,
  PolicyType,
  PublicEvent,
  AdminUser,
  ProductPage,
  AIAgentSettings
} from '../types';
import {
  DEFAULT_CONFIG,
  sanitizeSupabaseCredentials,
  getOrCreatePromoterCode,
  getDeviceToken,
  formatWaPhone,
  resolveProductSellerWa
} from '../config';
import {
  captureUrlAttributionTouch,
  getOrderAttributionSnapshot
} from '../utils/metaPixelEngine';

interface StoreContextType {
  config: AppConfig;
  updateConfig: (newConfig: Partial<AppConfig>) => Promise<boolean>;
  orders: Order[];
  addOrder: (order: Omit<Order, 'reservaid' | 'fecha'>) => Promise<Order>;
  updateOrderStatus: (id: string, newStatus: OrderStatus) => Promise<boolean>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<boolean>;
  deleteOrder: (id: string) => Promise<boolean>;
  deleteOrdersBatch: (ids: string[]) => Promise<boolean>;
  archiveOrdersBatch: (ids: string[], archivado: boolean) => Promise<boolean>;
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  selectedPack: number;
  setSelectedPack: (pack: number) => void;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  orderFormFullscreen: boolean;
  setOrderFormFullscreen: (open: boolean) => void;
  openOrderFormFullscreen: (packOverride?: number) => void;
  viralModalOpen: boolean;
  setViralModalOpen: (open: boolean) => void;
  policyModal: PolicyType | null;
  setPolicyModal: (policy: PolicyType | null) => void;
  promoterCode: string;
  referralCode: string | null;
  lastOrder: Order | null;
  events: PublicEvent[];
  refreshOrders: () => Promise<void>;
  // Admin Authentication
  adminUser: AdminUser | null;
  adminToken: string | null;
  isAdminAuthenticated: boolean;
  loginAdmin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => Promise<void>;
  checkAdminAuth: () => Promise<boolean>;
  // Product Pages Management
  productPages: ProductPage[];
  updateProductPage: (id: string, updates: Partial<ProductPage>, setAsActive?: boolean) => Promise<boolean>;
  addProductPage: (prod: Omit<ProductPage, 'id' | 'creadoEn'> & { id?: string; creadoEn?: string }, setAsActive?: boolean) => Promise<boolean>;
  deleteProductPage: (id: string) => Promise<boolean>;
  deleteProductPagesBatch: (ids: string[]) => Promise<boolean>;
  currentProductPage: ProductPage;
  setCurrentProductPage: (prodIdOrObj: ProductPage | string) => void;
  effectiveWhatsApp: string;
  // AI Agent for Customer Service & Order Confirmation
  aiAgentSettings: AIAgentSettings;
  updateAIAgentSettings: (updates: Partial<AIAgentSettings>) => Promise<boolean>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export function isOfficialStoreOrder(ord: Order | null | undefined): boolean {
  if (!ord || typeof ord !== 'object') return false;
  const rid = String(ord.reservaid || '').trim();
  if (!rid || rid.startsWith('NX-WA-') || rid.startsWith('TEST-UNIT-') || rid.startsWith('NX-TEST-')) {
    return false;
  }
  const disp = typeof ord.dispositivo === 'string' ? ord.dispositivo.trim() : '';
  if (disp.startsWith('wa-lead-')) return false;
  const addr = String(ord.direccion || '').trim();
  if (addr === 'Por confirmar por IA') return false;
  const rawPhone = String(ord.celular || '').trim();
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length < 6 || rawPhone.startsWith('lid-')) {
    return false;
  }
  return true;
}

const INITIAL_EVENTS: PublicEvent[] = [
  {
    id: 'ev-1',
    tipo: 'pago',
    ciudad: 'San Lorenzo',
    fecha: 'Hace 4 min',
    descripcion: 'Pedido de 2 unidades entregado y cobrado'
  },
  {
    id: 'ev-2',
    tipo: 'reserva',
    ciudad: 'Asunción',
    fecha: 'Hace 9 min',
    descripcion: 'Nueva reserva confirmada para Barrio Jara'
  },
  {
    id: 'ev-3',
    tipo: 'premio',
    ciudad: 'Luque',
    fecha: 'Hace 18 min',
    descripcion: 'Ciclo completado: Gs. 100.000 acreditados a promotor'
  },
  {
    id: 'ev-4',
    tipo: 'pago',
    ciudad: 'Fernando de la Mora',
    fecha: 'Hace 27 min',
    descripcion: 'Pedido entregado y pagado en puerta'
  },
  {
    id: 'ev-5',
    tipo: 'reserva',
    ciudad: 'Ciudad del Este',
    fecha: 'Hace 38 min',
    descripcion: 'Reserva Pack Familiar confirmada'
  }
];

const DEFAULT_PRODUCTS: ProductPage[] = [
  {
    id: 'prod-noelux-01',
    nombre: 'Noelux™ Proyector Navideño 12 Diseños',
    descripcion: 'Proyector láser LED con 12 diapositivas navideñas de alta definición, cobertura 70m² e impermeabilidad IP65 para exteriores.',
    imagen: '/assets/real/galeria-1.jpg',
    slug: 'noelux-proyector-12-disenos',
    precioNormal: 249000,
    precios: {
      1: 189000,
      2: 358000,
      3: 507000
    },
    wa: '',
    activo: true,
    creadoEn: '2026-11-01T10:00:00.000Z',
    waStageCommercialsEnabled: true,
    waStageCommercials: {
      stage1_welcome: {
        pack1: {
          stageId: 'stage1_welcome',
          packKey: 'pack1',
          packQty: 1,
          imageUrl: '/assets/wa-commercials/wacom_prod-noelux-01_stage1_welcome_p1_189000_640416dc7d87c5.jpg',
          framedPriceGs: 189000,
          vipPriceGs: 159000,
          normalStrikePriceGs: 249000,
          headline: 'Noelux™ Proyector Navideño 12 Diseños',
          ctaText: 'DECÍ O ESCRIBÍ "CORRECTO" PARA CONFIRMAR',
          whatsappCaption: '',
          sourceType: 'studio_framed',
          generatedAt: '2026-11-11T01:20:00.000Z'
        },
        pack2: {
          stageId: 'stage1_welcome',
          packKey: 'pack2',
          packQty: 2,
          imageUrl: '/assets/wa-commercials/wacom_prod-noelux-01_stage1_welcome_p2_358000_1019018c734eec.jpg',
          framedPriceGs: 358000,
          vipPriceGs: 328000,
          normalStrikePriceGs: 498000,
          headline: 'Noelux™ Proyector Navideño 12 Diseños',
          ctaText: 'DECÍ O ESCRIBÍ "CORRECTO" PARA CONFIRMAR',
          whatsappCaption: '',
          sourceType: 'studio_framed',
          generatedAt: '2026-11-11T01:20:00.000Z'
        },
        pack3: {
          stageId: 'stage1_welcome',
          packKey: 'pack3',
          packQty: 3,
          imageUrl: '/assets/wa-commercials/wacom_prod-noelux-01_stage1_welcome_p3_507000_9e7fb0bf76223b.jpg',
          framedPriceGs: 507000,
          vipPriceGs: 477000,
          normalStrikePriceGs: 747000,
          headline: 'Noelux™ Proyector Navideño 12 Diseños',
          ctaText: 'DECÍ O ESCRIBÍ "CORRECTO" PARA CONFIRMAR',
          whatsappCaption: '',
          sourceType: 'studio_framed',
          generatedAt: '2026-11-11T01:20:00.000Z'
        }
      }
    },
    contextoIA: `PRODUCTO: Noelux™ Proyector Navideño 12 Diseños
FICHA DE CONOCIMIENTO PARA EL AGENTE:
- Proyecta 12 motivos festivos en movimiento con lente óptica HD (Papá Noel, copos, renos, arbolitos, estrellas).
- Cobertura real de 70 m² a 5 metros de distancia (ilumina fachadas completas de 2 plantas).
- Instalación en 90 segundos: estaca de jardín para tierra/pasto y base plana para sala o balcón. Enchufe directo a 220V.
- Impermeable IP65: resiste tormentas, lluvias y calor extremo sin quemarse ni recalentar.
- Garantía escrita de 7 días con reemplazo inmediato y Envío Gratis en todo Paraguay.
- Pago 100% Contra Entrega al recibir (Efectivo, QR o POS).`
  }
];

function normalizeSingleStageCommercials(
  rawMatrix: ProductPage['waStageCommercials'],
  seedMatrix?: ProductPage['waStageCommercials']
): ProductPage['waStageCommercials'] {
  if (!rawMatrix || !rawMatrix.stage1_welcome) {
    return seedMatrix;
  }
  const anyRaw = rawMatrix as Record<string, any>;
  const hasLegacyStages = Boolean(anyRaw.stage2_warning || anyRaw.stage3_confirmed || anyRaw.stage4_vip_upsell);
  const hasLegacy50kDiscount = rawMatrix.stage1_welcome?.pack1?.vipPriceGs === 139000;
  if ((hasLegacyStages || hasLegacy50kDiscount) && seedMatrix?.stage1_welcome) {
    return seedMatrix;
  }
  return {
    stage1_welcome: {
      pack1: rawMatrix.stage1_welcome.pack1
        ? { ...rawMatrix.stage1_welcome.pack1, whatsappCaption: '' }
        : seedMatrix?.stage1_welcome?.pack1!,
      pack2: rawMatrix.stage1_welcome.pack2
        ? { ...rawMatrix.stage1_welcome.pack2, whatsappCaption: '' }
        : seedMatrix?.stage1_welcome?.pack2!,
      pack3: rawMatrix.stage1_welcome.pack3
        ? { ...rawMatrix.stage1_welcome.pack3, whatsappCaption: '' }
        : seedMatrix?.stage1_welcome?.pack3!
    }
  };
}

const DEFAULT_AI_SCRIPT = `METODOLOGÍA MAESTRA DE VENTAS Y CONFIRMACIÓN COD (GLOBAL):

ROL DEL AGENTE:
Eres Andrea, especialista en atención y confirmación de ventas contra entrega en Paraguay. Tu misión es generar confianza, validar los datos del cliente, resolver dudas del producto y confirmar el despacho inmediato.

PAUTAS DE ATENCIÓN:
1. SALUDO CÁLIDO Y PERSONALIZADO:
   "¡Hola {nombre}! Te saluda Andrea de la tienda oficial 🎄✨"

2. RECONFIRMACIÓN DE COMPRA ENTUSIASTA:
   "Acabamos de registrar tu pedido web de {producto}. Elegiste el Pack de {cantidad} por un total de {monto} con ENVÍO GRATIS a tu puerta."

3. VALIDACIÓN DE ENTREGA:
   "Para que el chofer llegue sin demoras, confírmanos si tu entrega es en {ciudad}, {departamento} en la dirección: {direccion} y si tienes alguna referencia de la fachada (color de portón, muralla, etc.)."

4. FORMA DE PAGO EN PUERTA:
   "Recordá que el pago es 100% Contra Entrega al recibir. ¿Preferís abonar en Efectivo, QR (ueno / transferencia) o Tarjeta POS?"

5. ARGUMENTACIÓN Y SEGURIDAD (USA EL CONTEXTO DEL PRODUCTO):
   Si el cliente pregunta por la calidad o el funcionamiento, utiliza los beneficios específicos del producto indicados en su contexto para darle total tranquilidad y cerrar la venta.`;

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const resolveValidSupabase = (candidate?: { url?: string; anonKey?: string }) => {
    return sanitizeSupabaseCredentials(
      candidate?.url && candidate?.anonKey ? candidate : DEFAULT_CONFIG.supabase
    );
  };

  const [config, setConfig] = useState<AppConfig>(() => ({
    ...DEFAULT_CONFIG,
    supabase: resolveValidSupabase(DEFAULT_CONFIG.supabase)
  }));

  const [orders, setOrders] = useState<Order[]>([]);

  // Destruir toda memoria persistente en el navegador (localStorage y sessionStorage):
  // pedidos, configuraciones y productos viven EXCLUSIVAMENTE en la Base de Datos Supabase.
  useEffect(() => {
    try {
      localStorage.clear();
    } catch (e) { }
    try {
      sessionStorage.clear();
    } catch (e) { }
  }, []);

  const [currentView, setCurrentView] = useState<ViewType>('store');
  const [selectedPack, setSelectedPackState] = useState<number>(0);

  const setSelectedPack = (pack: number) => {
    const validPack = Math.max(0, Math.min(config.maxCant || 10, pack));
    setSelectedPackState(validPack);
  };
  const [cartDrawerOpen, setCartDrawerOpen] = useState<boolean>(false);
  const [orderFormFullscreen, setOrderFormFullscreenState] = useState<boolean>(false);
  const [viralModalOpen, setViralModalOpen] = useState<boolean>(false);

  const setOrderFormFullscreen = (open: boolean) => {
    setOrderFormFullscreenState(open);
    try {
      if (typeof document !== 'undefined') {
        if (open) {
          document.body.style.overflow = 'hidden';
          document.documentElement.style.overflow = 'hidden';
        } else {
          document.body.style.overflow = '';
          document.documentElement.style.overflow = '';
        }
      }
    } catch { }
  };

  const openOrderFormFullscreen = (packOverride?: number) => {
    if (typeof packOverride === 'number' && packOverride > 0) {
      setSelectedPack(packOverride);
    } else if (selectedPack === 0) {
      setSelectedPack(1);
    }
    setCartDrawerOpen(false);
    setOrderFormFullscreen(true);
  };

  useEffect(() => {
    return () => {
      try {
        if (typeof document !== 'undefined') {
          document.body.style.overflow = '';
          document.documentElement.style.overflow = '';
        }
      } catch { }
    };
  }, []);
  const [policyModal, setPolicyModal] = useState<PolicyType | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>(INITIAL_EVENTS);
  const [promoterCode] = useState<string>(() => getOrCreatePromoterCode());
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Admin Authentication State (en memoria + cookie HttpOnly de servidor; cero localStorage)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);

  // Product Pages State (fuente de verdad en Supabase CFG-*; cero localStorage)
  const [productPages, setProductPages] = useState<ProductPage[]>(DEFAULT_PRODUCTS);

  // Active / Current Product Page
  const [activeProductId, setActiveProductId] = useState<string>(() => productPages[0]?.id || 'prod-noelux-01');

  // AI Agent Settings State (fuente de verdad en Supabase CFG-*; cero localStorage)
  const [aiAgentSettings, setAiAgentSettings] = useState<AIAgentSettings>({
    nombreAgente: 'Andrea (Agente IA)',
    activo: true,
    scriptPrompt: DEFAULT_AI_SCRIPT,
    modoPorDefecto: 'automatico'
  });

  // Referencias síncronas para impedir cierres obsoletos (stale closures) al guardar páginas nuevas
  const productPagesRef = React.useRef<ProductPage[]>(productPages);
  const activeProductIdRef = React.useRef<string>(activeProductId);
  const configRef = React.useRef<AppConfig>(config);
  const aiAgentSettingsRef = React.useRef<AIAgentSettings>(aiAgentSettings);
  const lastLocalPersistMsRef = React.useRef<number>(0);
  const deletedProductIdsRef = React.useRef<Set<string>>(new Set());
  const locallyDeletedOrderIdsRef = React.useRef<Set<string>>(new Set());
  const ordersRef = React.useRef<Order[]>(orders);
  const orderMutationEpochRef = React.useRef<number>(0);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    productPagesRef.current = productPages;
  }, [productPages]);

  useEffect(() => {
    activeProductIdRef.current = activeProductId;
  }, [activeProductId]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    aiAgentSettingsRef.current = aiAgentSettings;
  }, [aiAgentSettings]);

  // Helper centralizado para guardar toda la configuración en la Base de Datos Real (Supabase) + servidor local
  const persistStoreToDatabase = async (
    nextConfig: AppConfig,
    nextProductPages: ProductPage[],
    nextActiveId: string,
    nextAiSettings: AIAgentSettings
  ): Promise<boolean> => {
    lastLocalPersistMsRef.current = Date.now();
    const activeProd = nextProductPages.find(p => p.id === nextActiveId) || nextProductPages[0];
    const cleanWa = formatWaPhone(activeProd?.wa || nextConfig.wa || '');
    const payload = {
      wa: cleanWa,
      normal: nextConfig.normal,
      lote: nextConfig.lote,
      stock: nextConfig.stock,
      directoWhatsapp: nextConfig.directoWhatsapp,
      activeProductId: nextActiveId,
      selectedVoiceId: activeProd?.vozAgente || undefined,
      selectedVoiceName: activeProd?.vozAgenteNombre || undefined,
      productPages: nextProductPages.map(p => ({
        ...p,
        wa: formatWaPhone(p.wa)
      })),
      deletedProductIds: Array.from(deletedProductIdsRef.current),
      aiAgentSettings: nextAiSettings,
      updatedAt: new Date().toISOString()
    };

    const activeSb = resolveValidSupabase(config.supabase);
    const sbUrl = activeSb.url;
    const sbKey = activeSb.anonKey;

    const sbHeaders: Record<string, string> = sbKey
      ? {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        }
      : {};

    const localHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) {
      localHeaders['Authorization'] = `Bearer ${adminToken}`;
    }

    const sbPromise: Promise<boolean> =
      sbUrl && sbKey
        ? fetchWithTimeout(
            `${sbUrl}/rest/v1/codigos`,
            {
              method: 'POST',
              headers: sbHeaders,
              body: JSON.stringify({
                code: `CFG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                dispositivo: JSON.stringify(payload)
              })
            },
            5000
          )
            .then(r => r.ok)
            .catch(() => false)
        : Promise.resolve(false);

    let localOk = false;
    try {
      const resLocal = await fetchWithTimeout(
        '/api/config',
        {
          method: 'POST',
          headers: localHeaders,
          body: JSON.stringify(payload)
        },
        4500
      );
      const ct = resLocal.headers.get('content-type') || '';
      if (resLocal.ok && ct.includes('application/json')) {
        localOk = true;
      }
    } catch (e) { }

    if (localOk) {
      // No bloquear la interfaz esperando Supabase si el servidor central ya persistió la configuración
      void sbPromise;
      return true;
    }

    return await sbPromise;
  };

  // Cargar configuración real desde la Base de Datos Supabase al abrir en cualquier navegador o dispositivo
  const syncConfigFromDatabase = async () => {
    let activeSb = resolveValidSupabase(config.supabase);
    let sbUrl = activeSb.url;
    let sbKey = activeSb.anonKey;

    let remoteData: any = null;

    if (!sbUrl || !sbKey) {
      try {
        const resLocalInit = await fetchWithTimeout('/api/config', { cache: 'no-store' }, 4500);
        if (resLocalInit.ok) {
          const dataLocalInit = await resLocalInit.json();
          if (dataLocalInit?.supabase?.url && dataLocalInit?.supabase?.anonKey) {
            const validServerSb = resolveValidSupabase(dataLocalInit.supabase);
            if (validServerSb.url && validServerSb.anonKey) {
              DEFAULT_CONFIG.supabase = validServerSb;
              sbUrl = validServerSb.url;
              sbKey = validServerSb.anonKey;
            }
          }
          if (dataLocalInit?.config) {
            remoteData = dataLocalInit.config;
          }
        }
      } catch (e) { }
    }

    if (sbUrl && sbKey) {
      try {
        const res = await fetchWithTimeout(
          `${sbUrl}/rest/v1/codigos?select=code,dispositivo,creado&code=like.CFG-*&order=id.desc&limit=2`,
          {
            headers: {
              'apikey': sbKey,
              'Authorization': `Bearer ${sbKey}`,
              'Cache-Control': 'no-cache'
            },
            cache: 'no-store'
          },
          5000
        );
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            // Priorizar registros guardados por el administrador sobre el registro inicial (-init)
            const nonInitRow = rows.find((r: any) => r.code && !String(r.code).endsWith('-init')) || rows[0];
            if (nonInitRow && nonInitRow.dispositivo) {
              try {
                remoteData = JSON.parse(nonInitRow.dispositivo);
              } catch (e) { }
            }
          }
        }
      } catch (err) {
        console.warn('Error consultando configuración desde Supabase:', err);
      }
    }

    // Fallback al endpoint local /api/config si Supabase no devolvió datos
    if (!remoteData) {
      try {
        const resLocal = await fetchWithTimeout('/api/config', { cache: 'no-store' }, 4500);
        if (resLocal.ok) {
          const dataLocal = await resLocal.json();
          if (dataLocal?.supabase?.url && dataLocal?.supabase?.anonKey) {
            const validServerSb = resolveValidSupabase(dataLocal.supabase);
            if (validServerSb.url && validServerSb.anonKey) {
              DEFAULT_CONFIG.supabase = validServerSb;
              sbUrl = validServerSb.url;
              sbKey = validServerSb.anonKey;
            }
          }
          if (dataLocal && dataLocal.config) {
            remoteData = dataLocal.config;
          }
        }
      } catch (e) { }
    }

    if (remoteData && typeof remoteData === 'object') {
      const cleanRemoteWa = remoteData.wa ? formatWaPhone(remoteData.wa) : undefined;
      const resolvedSb = resolveValidSupabase(
        remoteData.supabase?.url ? remoteData.supabase : { url: sbUrl, anonKey: sbKey }
      );
      if (resolvedSb.url && resolvedSb.anonKey) {
        DEFAULT_CONFIG.supabase = resolvedSb;
      }

      setConfig(prev => {
        const nextConfig: AppConfig = {
          ...prev,
          supabase: resolvedSb.url ? resolvedSb : resolveValidSupabase(prev.supabase),
          wa: cleanRemoteWa || prev.wa,
          normal: Number(remoteData.normal) || prev.normal,
          lote: {
            1: Number(remoteData.lote?.[1] || remoteData.lote1) || prev.lote[1],
            2: Number(remoteData.lote?.[2] || remoteData.lote2) || prev.lote[2],
            3: Number(remoteData.lote?.[3] || remoteData.lote3) || prev.lote[3]
          },
          stock: remoteData.stock !== undefined ? Number(remoteData.stock) : prev.stock,
          directoWhatsapp: remoteData.directoWhatsapp !== undefined ? Boolean(remoteData.directoWhatsapp) : prev.directoWhatsapp
        };
        return nextConfig;
      });

      if (Array.isArray(remoteData.productPages) && remoteData.productPages.length > 0) {
        let fallbackVoiceId = remoteData.selectedVoiceId || '';
        let fallbackVoiceName = remoteData.selectedVoiceName || '';
        let fallbackVoiceProductId = '';

        // Si algún producto no tenía vozAgente en el CFG, consultar también el registro WAVOICE-* en Supabase
        if (sbUrl && sbKey && !remoteData.productPages.every((p: ProductPage) => Boolean(p?.vozAgente))) {
          try {
            const resVoice = await fetchWithTimeout(
              `${sbUrl}/rest/v1/codigos?code=like.WAVOICE-*&order=id.desc&limit=3`,
              {
                headers: {
                  'apikey': sbKey,
                  'Authorization': `Bearer ${sbKey}`,
                  'Cache-Control': 'no-cache'
                },
                cache: 'no-store'
              },
              4500
            );
            if (resVoice.ok) {
              const vRows = await resVoice.json();
              if (Array.isArray(vRows) && vRows.length > 0 && vRows[0]?.dispositivo) {
                const parsedV = JSON.parse(vRows[0].dispositivo);
                if (parsedV?.voiceId) {
                  fallbackVoiceId = parsedV.voiceId;
                  fallbackVoiceName = parsedV.voiceName || fallbackVoiceName;
                  fallbackVoiceProductId = parsedV.productId || '';
                }
              }
            }
          } catch (e) { }
        }

        if (Array.isArray(remoteData.deletedProductIds)) {
          remoteData.deletedProductIds.forEach((delId: string) => deletedProductIdsRef.current.add(delId));
        }

        // Si acabamos de guardar localmente hace menos de 5 segundos, no pisar las páginas recién creadas con lecturas en vuelo
        const recentlySavedLocally = Date.now() - lastLocalPersistMsRef.current < 5000;

        if (!recentlySavedLocally) {
          setProductPages(prev => {
            const remoteMapped: ProductPage[] = remoteData.productPages
              .filter((p: ProductPage) => p?.id && !deletedProductIdsRef.current.has(p.id))
              .map((p: ProductPage) => {
                const localMatch = prev.find(lp => lp.id === p.id);
                const appliesFallback = !fallbackVoiceProductId || fallbackVoiceProductId === p.id;
                const resolvedVoz =
                  p.vozAgente ||
                  (appliesFallback ? fallbackVoiceId : '') ||
                  localMatch?.vozAgente ||
                  remoteData.selectedVoiceId;
                const resolvedVozNombre =
                  p.vozAgenteNombre ||
                  (appliesFallback ? fallbackVoiceName : '') ||
                  localMatch?.vozAgenteNombre ||
                  remoteData.selectedVoiceName;
                const mergedMetaTracking = {
                  ...(localMatch?.metaTracking || {}),
                  ...(p.metaTracking || {}),
                  pixelId:
                    p.metaTracking?.pixelId ||
                    localMatch?.metaTracking?.pixelId ||
                    '1276031534651377',
                  capiAccessToken:
                    p.metaTracking?.capiAccessToken ||
                    localMatch?.metaTracking?.capiAccessToken ||
                    '',
                  testEventCode:
                    p.metaTracking?.testEventCode ||
                    localMatch?.metaTracking?.testEventCode ||
                    ''
                };
                const seedMatch = DEFAULT_PRODUCTS.find(dp => dp.id === p.id);
                return {
                  ...seedMatch,
                  ...localMatch,
                  ...p,
                  waStageCommercialsEnabled: true,
                  waStageCommercials: normalizeSingleStageCommercials(
                    p.waStageCommercials || localMatch?.waStageCommercials,
                    seedMatch?.waStageCommercials
                  ),
                  metaTracking: mergedMetaTracking,
                  wa: formatWaPhone(p.wa || cleanRemoteWa || ''),
                  ...(resolvedVoz ? { vozAgente: resolvedVoz } : {}),
                  ...(resolvedVozNombre ? { vozAgenteNombre: resolvedVozNombre } : {})
                };
              });

            // Preservar cualquier página creada localmente que aún no esté en remoteMapped (salvo que haya sido eliminada)
            const remoteIdSet = new Set(remoteMapped.map(p => p.id));
            const localOnlyPages = prev.filter(
              lp => lp?.id && !remoteIdSet.has(lp.id) && !deletedProductIdsRef.current.has(lp.id)
            );
            const mergedPages = [...localOnlyPages, ...remoteMapped];
            productPagesRef.current = mergedPages;
            return mergedPages;
          });
        }
      } else if (cleanRemoteWa) {
        // Si el registro en la BD tenía wa/lote/normal pero no productPages, sincronizarlo al producto activo
        setProductPages(prev => {
          const next = prev.map((p, idx) =>
            idx === 0 || p.id === activeProductIdRef.current
              ? {
                ...p,
                wa: cleanRemoteWa,
                precioNormal: Number(remoteData.normal) || p.precioNormal,
                precios: {
                  1: Number(remoteData.lote?.[1] || remoteData.lote1) || p.precios[1],
                  2: Number(remoteData.lote?.[2] || remoteData.lote2) || p.precios[2],
                  3: Number(remoteData.lote?.[3] || remoteData.lote3) || p.precios[3]
                }
              }
              : p
          );
          productPagesRef.current = next;
          return next;
        });
      }

      if (remoteData.activeProductId && Date.now() - lastLocalPersistMsRef.current >= 5000) {
        // Solo cambiar activeProductId desde BD si la URL actual no está pidiendo un ?p=slug específico
        const urlParams = new URLSearchParams(window.location.search);
        const hasExplicitSlugInUrl = Boolean(urlParams.get('p') || urlParams.get('producto'));
        if (!hasExplicitSlugInUrl) {
          activeProductIdRef.current = remoteData.activeProductId;
          setActiveProductId(remoteData.activeProductId);
        }
      }

      if (remoteData.aiAgentSettings) {
        setAiAgentSettings(prev => {
          const nextAi = { ...prev, ...remoteData.aiAgentSettings };
          aiAgentSettingsRef.current = nextAi;
          return nextAi;
        });
      }
    }
    return remoteData;
  };

  // Consulta directa en tiempo real del WhatsApp asignado al producto en la Base de Datos
  const fetchProductSellerWaFromDatabase = async (
    targetProdId?: string,
    targetProdName?: string
  ): Promise<string> => {
    try {
      const remoteData = await syncConfigFromDatabase();
      if (remoteData && Array.isArray(remoteData.productPages)) {
        const matched = remoteData.productPages.find(
          (p: ProductPage) =>
            (targetProdId && p.id === targetProdId) ||
            (targetProdName && p.nombre && p.nombre.toLowerCase() === targetProdName.toLowerCase())
        ) || remoteData.productPages.find((p: ProductPage) => p.id === activeProductIdRef.current) || remoteData.productPages[0];
        const dbWa = formatWaPhone(matched?.wa || remoteData.wa || '');
        if (dbWa) return dbWa;
      }
      if (remoteData?.wa) {
        return formatWaPhone(remoteData.wa);
      }
    } catch (e) { }
    return '';
  };

  const setCurrentProductPage = (prodIdOrObj: ProductPage | string) => {
    const id = typeof prodIdOrObj === 'string' ? prodIdOrObj : prodIdOrObj.id;
    let latestPages = productPagesRef.current;

    // Si se pasó el objeto completo de una página recién creada que aún no estaba en el ref, incluirla sin perder nada
    if (typeof prodIdOrObj === 'object' && prodIdOrObj && prodIdOrObj.id) {
      const existsInRef = latestPages.some(p => p.id === prodIdOrObj.id);
      if (!existsInRef) {
        latestPages = [prodIdOrObj, ...latestPages];
        productPagesRef.current = latestPages;
        setProductPages(latestPages);
      }
    }

    activeProductIdRef.current = id;
    setActiveProductId(id);
    persistStoreToDatabase(configRef.current, latestPages, id, aiAgentSettingsRef.current);
  };

  const currentProductPage = useMemo(() => {
    const found = productPages.find(p => p.id === activeProductId) || productPages[0] || DEFAULT_PRODUCTS[0];
    const resolvedWa = resolveProductSellerWa(found, productPages) || formatWaPhone(config.wa);
    return {
      ...found,
      wa: resolvedWa
    };
  }, [productPages, activeProductId, config.wa]);

  const effectiveWhatsApp = useMemo(() => {
    return formatWaPhone(currentProductPage?.wa || '');
  }, [currentProductPage?.wa]);

  const updateProductPage = async (
    id: string,
    updates: Partial<ProductPage>,
    setAsActive = false
  ): Promise<boolean> => {
    const cleanWa = updates.wa !== undefined ? formatWaPhone(updates.wa) : undefined;
    const finalUpdates = cleanWa !== undefined ? { ...updates, wa: cleanWa } : updates;

    const currentPages = productPagesRef.current;
    const nextProductPages = currentPages.map(p => (p.id === id ? { ...p, ...finalUpdates } : p));
    productPagesRef.current = nextProductPages;
    setProductPages(nextProductPages);

    const targetActiveId = setAsActive ? id : activeProductIdRef.current;
    if (setAsActive) {
      activeProductIdRef.current = id;
      setActiveProductId(id);
    }

    const isActiveProd = id === targetActiveId || nextProductPages[0]?.id === id;
    const curCfg = configRef.current;
    const nextConfig: AppConfig = {
      ...curCfg,
      wa: isActiveProd && cleanWa !== undefined ? cleanWa : curCfg.wa,
      normal: isActiveProd && updates.precioNormal !== undefined ? Number(updates.precioNormal) : curCfg.normal,
      lote: isActiveProd && updates.precios
        ? {
          1: Number(updates.precios[1]) || curCfg.lote[1],
          2: Number(updates.precios[2]) || curCfg.lote[2],
          3: Number(updates.precios[3]) || curCfg.lote[3]
        }
        : curCfg.lote
    };

    configRef.current = nextConfig;
    setConfig(nextConfig);

    return await persistStoreToDatabase(nextConfig, nextProductPages, targetActiveId, aiAgentSettingsRef.current);
  };

  const addProductPage = async (
    prod: Omit<ProductPage, 'id' | 'creadoEn'> & { id?: string; creadoEn?: string },
    setAsActive = true
  ): Promise<boolean> => {
    const cleanWa = formatWaPhone(prod.wa);
    const newId = prod.id || 'prod-' + Date.now().toString(36);
    deletedProductIdsRef.current.delete(newId);

    const newProd: ProductPage = {
      ...prod,
      wa: cleanWa,
      id: newId,
      creadoEn: prod.creadoEn || new Date().toISOString()
    };

    const currentPages = productPagesRef.current.filter(p => p.id !== newId);
    const nextProductPages = [newProd, ...currentPages];
    productPagesRef.current = nextProductPages;
    setProductPages(nextProductPages);

    const targetActiveId = setAsActive ? newProd.id : activeProductIdRef.current;
    if (setAsActive) {
      activeProductIdRef.current = newProd.id;
      setActiveProductId(newProd.id);
    }

    return await persistStoreToDatabase(configRef.current, nextProductPages, targetActiveId, aiAgentSettingsRef.current);
  };

  const deleteProductPage = async (id: string): Promise<boolean> => {
    return await deleteProductPagesBatch([id]);
  };

  const deleteProductPagesBatch = async (ids: string[]): Promise<boolean> => {
    const cleanIds = Array.from(new Set((ids || []).map(x => String(x || '').trim()).filter(Boolean)));
    if (cleanIds.length === 0) return false;

    const currentList = productPagesRef.current;
    let remaining = currentList.filter(p => !cleanIds.includes(p.id));
    // Garantizar que al menos quede 1 página base si se seleccionaron todas
    if (remaining.length === 0 && currentList.length > 0) {
      const fallback = currentList.find(p => p.id === 'prod-noelux-01') || currentList[currentList.length - 1];
      remaining = [fallback];
    }

    const actuallyDeleted = currentList
      .filter(p => !remaining.some(r => r.id === p.id))
      .map(p => p.id);
    if (actuallyDeleted.length === 0) return false;

    for (const delId of actuallyDeleted) {
      deletedProductIdsRef.current.add(delId);
    }

    productPagesRef.current = remaining;
    setProductPages(remaining);

    const nextActiveId = remaining.some(p => p.id === activeProductIdRef.current)
      ? activeProductIdRef.current
      : remaining[0]?.id || 'prod-noelux-01';
    activeProductIdRef.current = nextActiveId;
    setActiveProductId(nextActiveId);

    return await persistStoreToDatabase(
      configRef.current,
      remaining,
      nextActiveId,
      aiAgentSettingsRef.current
    );
  };

  const updateAIAgentSettings = async (updates: Partial<AIAgentSettings>): Promise<boolean> => {
    const nextAi = { ...aiAgentSettingsRef.current, ...updates };
    aiAgentSettingsRef.current = nextAi;
    setAiAgentSettings(nextAi);
    return await persistStoreToDatabase(configRef.current, productPagesRef.current, activeProductIdRef.current, nextAi);
  };

  // Verify Admin Token against server HttpOnly cookie session (cero localStorage)
  const checkAdminAuth = async (): Promise<boolean> => {
    try {
      const headers: Record<string, string> = {};
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const res = await fetch('/api/admin/verify', {
        method: 'GET',
        headers,
        credentials: 'include',
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.valid && String(data?.user?.email || '').toLowerCase() === 'encuestas977@gmail.com') {
          setAdminUser(data.user);
          setIsAdminAuthenticated(true);
          return true;
        }
      }
    } catch (e) { }

    if (adminToken && adminUser && String(adminUser.email).toLowerCase() === 'encuestas977@gmail.com') {
      return true;
    }

    setAdminToken(null);
    setAdminUser(null);
    setIsAdminAuthenticated(false);
    return false;
  };

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const loginAdmin = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Verificar contra /api/admin/login (emite cookie HttpOnly firmada sin depender de localStorage)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: cleanUser, password: cleanPass })
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (data.success && data.token && data.user?.email === 'encuestas977@gmail.com') {
            setAdminToken(data.token);
            setAdminUser(data.user);
            setIsAdminAuthenticated(true);
            return { success: true };
          }
          return { success: false, error: data.error || 'Credenciales inválidas. Acceso denegado.' };
        } catch (e) { }
      } else if (res.status === 401) {
        return { success: false, error: 'Credenciales inválidas. Acceso denegado.' };
      }
    } catch (err: any) { }

    // 2. Verificar contra RPC Supabase si el endpoint local no respondió
    const activeSb = resolveValidSupabase(config.supabase);
    const sbUrl = activeSb.url;
    const sbKey = activeSb.anonKey;
    if (sbUrl && sbKey) {
      try {
        const rpcRes = await fetchWithTimeout(
          `${sbUrl}/rest/v1/rpc/verificar_login_admin`,
          {
            method: 'POST',
            headers: {
              'apikey': sbKey,
              'Authorization': `Bearer ${sbKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              p_email: cleanUser,
              p_password: cleanPass
            })
          },
          5000
        );
        if (rpcRes.ok) {
          const rpcData = await rpcRes.json();
          if (rpcData && rpcData.success && rpcData.user) {
            const dbToken = 'token-sb-' + Date.now();
            setAdminToken(dbToken);
            setAdminUser(rpcData.user);
            setIsAdminAuthenticated(true);
            return { success: true };
          } else if (rpcData && rpcData.success === false) {
            return { success: false, error: rpcData.error || 'Credenciales inválidas. Acceso denegado.' };
          }
        }
      } catch (e) { }
    }

    // 3. Validación de respaldo exclusiva del usuario oficial autorizado (solo memoria React)
    if (cleanUser === 'encuestas977@gmail.com' && cleanPass === 'qqwwee112233') {
      const officialUser: AdminUser = {
        id: 'usr-admin-official',
        username: 'encuestas977@gmail.com',
        email: 'encuestas977@gmail.com',
        nombre: 'Administrador Oficial',
        rol: 'superadmin'
      };
      const officialToken = 'token-auth-' + Date.now();
      setAdminToken(officialToken);
      setAdminUser(officialUser);
      setIsAdminAuthenticated(true);
      return { success: true };
    }

    return { success: false, error: 'Credenciales inválidas. Acceso denegado.' };
  };

  const logoutAdmin = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
        headers: adminToken ? { 'Authorization': `Bearer ${adminToken}` } : undefined
      });
    } catch (e) { }
    setAdminToken(null);
    setAdminUser(null);
    setIsAdminAuthenticated(false);
    if (currentView === 'admin') {
      window.location.hash = '';
      setCurrentView('store');
    }
  };

  // Sync route based on URL hash or path (solo en montaje inicial y eventos de navegación del navegador)
  useEffect(() => {
    const handleUrlState = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      captureUrlAttributionTouch(params.get('p') || undefined);

      const ref = params.get('ref') || params.get('bind');
      if (ref) {
        setReferralCode(ref);
      }

      // Check strictly against hash or exact path to prevent false matches with directory names
      if (
        hash === '#admin' ||
        path === '/admin' ||
        path === '/admin/' ||
        path.endsWith('/admin') ||
        path.endsWith('/admin/')
      ) {
        setCurrentView('admin');
      } else if (
        hash === '#reparto' ||
        path === '/reparto' ||
        path === '/reparto/' ||
        path.endsWith('/reparto') ||
        path.endsWith('/reparto/')
      ) {
        setCurrentView('reparto');
      } else if (
        hash === '#app' ||
        hash === '#promoter' ||
        path === '/app' ||
        path === '/app/' ||
        path.endsWith('/app') ||
        path.endsWith('/app/')
      ) {
        setCurrentView('promoter');
      } else {
        setCurrentView('store');
      }
    };

    handleUrlState();
    window.addEventListener('hashchange', handleUrlState);
    window.addEventListener('popstate', handleUrlState);
    return () => {
      window.removeEventListener('hashchange', handleUrlState);
      window.removeEventListener('popstate', handleUrlState);
    };
  }, []);

  // Sincronizar ?p=slug con activeProductId sin alterar currentView
  useEffect(() => {
    const path = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const slugParam = (params.get('p') || params.get('producto') || '').trim().toLowerCase();
    const cleanPathSlug = path.replace(/^\/+|\/+$/g, '').toLowerCase();
    const candidateSlug =
      slugParam ||
      (cleanPathSlug && !['admin', 'reparto', 'app', 'promoter'].includes(cleanPathSlug)
        ? cleanPathSlug
        : '');
    if (candidateSlug) {
      const matchedBySlug = productPages.find(
        p =>
          (p.slug || '').toLowerCase() === candidateSlug ||
          (p.id || '').toLowerCase() === candidateSlug
      );
      if (matchedBySlug && matchedBySlug.id !== activeProductId) {
        activeProductIdRef.current = matchedBySlug.id;
        setActiveProductId(matchedBySlug.id);
      }
    }
  }, [productPages, activeProductId]);

  // Persist single order state to Supabase DB (con auto-reintento y doble respaldo en 'codigos' y 'pedidos')
  const persistOrderToDatabase = async (orderObj: Order, isNewInsert = false): Promise<boolean> => {
    const activeSb = resolveValidSupabase(config.supabase);
    const sbUrl = activeSb.url;
    const sbKey = activeSb.anonKey;
    if (!sbUrl || !sbKey) return false;

    orderObj.actualizado_en = orderObj.actualizado_en || new Date().toISOString();

    const structuredPedidoRow = {
      reservaid: orderObj.reservaid,
      producto_id: orderObj.productoId || 'prod-noelux-01',
      producto: orderObj.producto || null,
      wa_vendedor: orderObj.waVendedor || null,
      nombre: orderObj.nombre,
      celular: orderObj.celular,
      departamento: orderObj.departamento || '',
      ciudad: orderObj.ciudad || '',
      direccion: orderObj.direccion || '',
      detalle: orderObj.detalle || 'Efectivo al recibir',
      cantidad: Number(orderObj.cantidad) || 1,
      monto: Number(orderObj.monto) || 0,
      ref_code: orderObj.ref_code || null,
      estado: orderObj.estado || 'reservado',
      tipo_vivienda: orderObj.tipoVivienda || 'casa',
      gps_lat: typeof orderObj.gpsLat === 'number' ? orderObj.gpsLat : null,
      gps_lng: typeof orderObj.gpsLng === 'number' ? orderObj.gpsLng : null,
      gps_link: orderObj.gpsLink || null,
      gps_confirmado: Boolean(orderObj.gpsConfirmado),
      referencia_casa: orderObj.referenciaCasa || null,
      modo_ia: orderObj.modoIA || 'automatico',
      conv_step: Number(orderObj.convStep) || 1,
      atendido_por_ia: isNewInsert ? Boolean(orderObj.atendidoPorIA) : orderObj.atendidoPorIA !== false,
      datos_confirmados: Boolean(orderObj.datosConfirmados),
      agente_completado: Boolean(orderObj.agenteCompletado),
      empaquetado: Boolean(orderObj.empaquetado),
      archivado: Boolean(orderObj.archivado),
      fecha_archivado: orderObj.fechaArchivado || null,
      ...(orderObj.fecha ? { fecha: orderObj.fecha } : {}),
      dispositivo: orderObj as any,
      actualizado_en: orderObj.actualizado_en
    };

    let pedidosOk = false;
    let codigosOk = false;
    const maxAttempts = isNewInsert ? 3 : 1;

    // 1. Upsert en tabla estructurada 'pedidos' con timeout acotado
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const resPed = await fetchWithTimeout(
          `${sbUrl}/rest/v1/pedidos?on_conflict=reservaid`,
          {
            method: 'POST',
            headers: {
              'apikey': sbKey,
              'Authorization': `Bearer ${sbKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify(structuredPedidoRow)
          },
          5500
        );
        if (resPed.ok) {
          pedidosOk = true;
          break;
        }
      } catch { }
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 350 * (attempt + 1)));
      }
    }

    if (isNewInsert) {
      try {
        await fetchWithTimeout(
          `${sbUrl}/rest/v1/eventos_publicos`,
          {
            method: 'POST',
            headers: {
              'apikey': sbKey,
              'Authorization': `Bearer ${sbKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              tipo: 'reserva',
              ciudad: (orderObj.ciudad || 'Paraguay').slice(0, 30),
              ref_code: orderObj.ref_code || null
            })
          },
          4500
        );
      } catch { }
    }

    // 2. Guardar snapshot atómico en Supabase 'codigos'
    const codeKey = `ORD-${orderObj.reservaid}-${Date.now()}`;
    const bodyPayload = JSON.stringify({
      code: codeKey,
      dispositivo: JSON.stringify(orderObj)
    });

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const resCod = await fetchWithTimeout(
          `${sbUrl}/rest/v1/codigos`,
          {
            method: 'POST',
            headers: {
              'apikey': sbKey,
              'Authorization': `Bearer ${sbKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: bodyPayload
          },
          5500
        );
        if (resCod.ok) {
          codigosOk = true;
          break;
        }
      } catch { }
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 350 * (attempt + 1)));
      }
    }

    if (codigosOk) {
      void fetchWithTimeout(
        `${sbUrl}/rest/v1/codigos?code=like.${encodeURIComponent(`ORD-${orderObj.reservaid}-`)}*&code=neq.${encodeURIComponent(codeKey)}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': sbKey,
            'Authorization': `Bearer ${sbKey}`
          }
        },
        4500
      ).catch(() => { });
    }

    return pedidosOk || codigosOk;
  };

  const refreshOrdersInFlightRef = React.useRef<Promise<void> | null>(null);

  // Fetch orders from Supabase Database ('codigos' + 'pedidos') + local API (sincronizando también eliminados DEL-ORD-*)
  const refreshOrders = async (): Promise<void> => {
    if (refreshOrdersInFlightRef.current) {
      return refreshOrdersInFlightRef.current;
    }

    const run = async () => {
      const startEpoch = orderMutationEpochRef.current;
      const activeSb = resolveValidSupabase(config.supabase);
      const sbUrl = activeSb.url;
      const sbKey = activeSb.anonKey;
      const mergedMap = new Map<string, Order>();
      let supabaseReachable = false;
      let localApiReachable = false;
      const deletedSet = new Set<string>(locallyDeletedOrderIdsRef.current);

      const mergeOrderCandidate = (candidate: Order | null | undefined) => {
        if (!isOfficialStoreOrder(candidate)) return;
        const rid = String(candidate!.reservaid).trim();
        const cid = String(candidate!.id || '').trim();
        if (
          !rid ||
          deletedSet.has(rid) ||
          (cid && deletedSet.has(cid)) ||
          locallyDeletedOrderIdsRef.current.has(rid) ||
          (cid && locallyDeletedOrderIdsRef.current.has(cid))
        ) {
          return;
        }
        const existing = mergedMap.get(rid);
        if (!existing) {
          mergedMap.set(rid, candidate!);
          return;
        }
        const tExisting = new Date(existing.actualizado_en || existing.fecha || 0).getTime() || 0;
        const tCandidate = new Date(candidate!.actualizado_en || candidate!.fecha || 0).getTime() || 0;
        const base = tCandidate >= tExisting ? { ...existing, ...candidate! } : { ...candidate!, ...existing };
        mergedMap.set(rid, {
          ...base,
          convStep: Math.max(Number(existing.convStep) || 1, Number(candidate!.convStep) || 1),
          datosConfirmados: Boolean(existing.datosConfirmados || candidate!.datosConfirmados),
          agenteCompletado: Boolean(existing.agenteCompletado || candidate!.agenteCompletado),
          empaquetado: Boolean(existing.empaquetado || candidate!.empaquetado)
        });
      };

      const sbHeaders: Record<string, string> = sbKey
        ? {
            apikey: sbKey,
            Authorization: `Bearer ${sbKey}`,
            'Cache-Control': 'no-cache'
          }
        : {};

      const [delResult, ordResult, pedTableResult, apiResult] = await Promise.allSettled([
        sbUrl && sbKey
          ? fetchWithTimeout(
              `${sbUrl}/rest/v1/codigos?select=code,dispositivo&code=like.DEL-ORD-*&order=id.desc&limit=250`,
              { headers: sbHeaders, cache: 'no-store' },
              4500
            ).then(r => (r.ok ? r.json() : null))
          : Promise.resolve(null),
        sbUrl && sbKey
          ? fetchWithTimeout(
              `${sbUrl}/rest/v1/codigos?select=code,dispositivo&code=like.ORD-*&order=id.desc&limit=1000`,
              { headers: sbHeaders, cache: 'no-store' },
              4500
            ).then(async r => {
              if (!r.ok) return null;
              supabaseReachable = true;
              return r.json();
            })
          : Promise.resolve(null),
        sbUrl && sbKey
          ? fetchWithTimeout(
              `${sbUrl}/rest/v1/pedidos?order=fecha.desc&limit=1000`,
              { headers: sbHeaders, cache: 'no-store' },
              4500
            ).then(async r => {
              if (!r.ok) return null;
              supabaseReachable = true;
              return r.json();
            })
          : Promise.resolve(null),
        fetchWithTimeout('/api/pedidos', { cache: 'no-store' }, 4500).then(async r => {
          const ct = r.headers.get('content-type') || '';
          if (!r.ok || !ct.includes('application/json')) return null;
          const json = await r.json().catch(() => null);
          if (json && Array.isArray(json.pedidos)) {
            localApiReachable = true;
          }
          return json;
        })
      ]);

      // 0. Procesar primero todos los eliminados (DEL-ORD-* de Supabase + deletedIds locales de /api/pedidos)
      if (apiResult.status === 'fulfilled' && Array.isArray(apiResult.value?.deletedIds)) {
        for (const delId of apiResult.value.deletedIds) {
          const clean = String(delId || '').trim();
          if (clean) deletedSet.add(clean);
        }
      }
      if (delResult.status === 'fulfilled' && Array.isArray(delResult.value)) {
        for (const r of delResult.value) {
          try {
            if (r.dispositivo) {
              const parsed = JSON.parse(r.dispositivo);
              if (parsed?.deletedOrderId) {
                deletedSet.add(String(parsed.deletedOrderId).trim());
              }
              if (Array.isArray(parsed?.deletedOrderIds)) {
                parsed.deletedOrderIds.forEach((id: string) => deletedSet.add(String(id).trim()));
              }
            }
            const codeStr = String(r.code || '');
            const match = codeStr.match(/^DEL-ORD-(.+)-\d+$/) || codeStr.match(/^DEL-ORD-(NX-\d+)/);
            if (match?.[1]) {
              deletedSet.add(match[1]);
            }
          } catch {}
        }
      }

      // 1. Procesar snapshots ORD-* de Supabase 'codigos'
      if (ordResult.status === 'fulfilled' && Array.isArray(ordResult.value)) {
        for (const r of ordResult.value) {
          try {
            const parsed: Order = JSON.parse(r.dispositivo);
            mergeOrderCandidate(parsed);
          } catch {}
        }
      }

      // 1b. Procesar filas estructuradas de la tabla 'pedidos' en Supabase
      if (pedTableResult.status === 'fulfilled' && Array.isArray(pedTableResult.value)) {
        for (const row of pedTableResult.value) {
          if (!row?.reservaid) continue;
          const snap =
            row.dispositivo && typeof row.dispositivo === 'object' && row.dispositivo.reservaid
              ? (row.dispositivo as Order)
              : null;
          const reconstructed: Order = {
            ...(snap || {}),
            reservaid: String(row.reservaid),
            productoId: row.producto_id || snap?.productoId || 'prod-noelux-01',
            producto: row.producto || snap?.producto || 'Noelux™ Proyector Navideño 12 Diseños',
            waVendedor: row.wa_vendedor || snap?.waVendedor || '',
            nombre: row.nombre || snap?.nombre || 'Cliente',
            celular: row.celular || snap?.celular || '',
            departamento: row.departamento || snap?.departamento || '',
            ciudad: row.ciudad || snap?.ciudad || '',
            direccion: row.direccion || snap?.direccion || '',
            detalle: row.detalle || snap?.detalle || 'Efectivo al recibir',
            cantidad: Number(row.cantidad || snap?.cantidad || 1),
            monto: Number(row.monto || snap?.monto || 0),
            ref_code: row.ref_code ?? snap?.ref_code ?? null,
            estado: (row.estado || snap?.estado || 'reservado') as OrderStatus,
            acredita: row.acredita !== false,
            tipoVivienda: (row.tipo_vivienda || snap?.tipoVivienda || 'casa') as any,
            ...(typeof row.gps_lat === 'number' ? { gpsLat: row.gps_lat } : {}),
            ...(typeof row.gps_lng === 'number' ? { gpsLng: row.gps_lng } : {}),
            ...(row.gps_link ? { gpsLink: row.gps_link } : {}),
            gpsConfirmado: Boolean(row.gps_confirmado ?? snap?.gpsConfirmado),
            referenciaCasa: row.referencia_casa || snap?.referenciaCasa || '',
            modoIA: (row.modo_ia || snap?.modoIA || 'automatico') as any,
            convStep: Number(row.conv_step || snap?.convStep || 1),
            atendidoPorIA: Boolean(row.atendido_por_ia ?? snap?.atendidoPorIA ?? true),
            datosConfirmados: Boolean(row.datos_confirmados ?? snap?.datosConfirmados),
            agenteCompletado: Boolean(row.agente_completado ?? snap?.agenteCompletado),
            empaquetado: Boolean(row.empaquetado ?? snap?.empaquetado),
            archivado: Boolean(row.archivado ?? snap?.archivado),
            fechaArchivado: row.fecha_archivado || snap?.fechaArchivado || null,
            fecha: row.fecha || snap?.fecha || new Date().toISOString(),
            actualizado_en: row.actualizado_en || snap?.actualizado_en || row.fecha || ''
          };
          mergeOrderCandidate(reconstructed);
        }
      }

      // 2. Combinar con /api/pedidos local
      if (apiResult.status === 'fulfilled' && apiResult.value && Array.isArray(apiResult.value.pedidos)) {
        for (const ord of apiResult.value.pedidos) {
          mergeOrderCandidate(ord);
        }
      }

      // Actualizar lista de pedidos excluyendo siempre cualquier ID eliminado durante la sesión o en vuelo
      if (mergedMap.size > 0 || supabaseReachable || localApiReachable) {
        const sortByFechaDesc = (a: Order, b: Order) => {
          const tA = a.fecha ? new Date(a.fecha).getTime() : 0;
          const tB = b.fecha ? new Date(b.fecha).getTime() : 0;
          return tB - tA;
        };

        setOrders(prev => {
          const prevByRid = new Map<string, Order>();
          for (const p of prev) {
            const pRid = String(p?.reservaid || '').trim();
            if (pRid) prevByRid.set(pRid, p);
          }

          const mutatedDuringPoll = orderMutationEpochRef.current !== startEpoch;
          const safeMap = new Map<string, Order>();

          for (const [rid, candidate] of mergedMap.entries()) {
            const cid = String(candidate.id || '').trim();
            if (
              locallyDeletedOrderIdsRef.current.has(rid) ||
              (cid && locallyDeletedOrderIdsRef.current.has(cid))
            ) {
              continue;
            }
            const existingLocal = prevByRid.get(rid);
            if (mutatedDuringPoll && existingLocal) {
              const tLocal = new Date(existingLocal.actualizado_en || existingLocal.fecha || 0).getTime() || 0;
              const tCand = new Date(candidate.actualizado_en || candidate.fecha || 0).getTime() || 0;
              safeMap.set(rid, tLocal >= tCand ? existingLocal : candidate);
            } else {
              safeMap.set(rid, candidate);
            }
          }

          // Preservar pedidos recién creados localmente mientras este poll estaba en vuelo
          if (mutatedDuringPoll) {
            for (const p of prev) {
              const pRid = String(p?.reservaid || '').trim();
              const pCid = String(p?.id || '').trim();
              if (
                pRid &&
                !safeMap.has(pRid) &&
                !deletedSet.has(pRid) &&
                !locallyDeletedOrderIdsRef.current.has(pRid) &&
                (!pCid || !locallyDeletedOrderIdsRef.current.has(pCid))
              ) {
                safeMap.set(pRid, p);
              }
            }
          }

          const finalOrders = Array.from(safeMap.values()).sort(sortByFechaDesc);
          ordersRef.current = finalOrders;
          return finalOrders;
        });
      }
    };

    const promise = run().finally(() => {
      if (refreshOrdersInFlightRef.current === promise) {
        refreshOrdersInFlightRef.current = null;
      }
    });
    refreshOrdersInFlightRef.current = promise;
    return promise;
  };

  // Sincronización automática con la Base de Datos al iniciar, al cambiar de vista, al autenticar admin y al enfocar la ventana
  useEffect(() => {
    syncConfigFromDatabase();
    if (currentView !== 'store' || isAdminAuthenticated) {
      refreshOrders();
    }

    const handleFocus = () => {
      syncConfigFromDatabase();
      if (currentView !== 'store' || isAdminAuthenticated) {
        refreshOrders();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentView, isAdminAuthenticated]);

  useEffect(() => {
    if (currentView === 'admin' || currentView === 'reparto' || isAdminAuthenticated) {
      const pollTimer = setInterval(() => {
        refreshOrders();
      }, 4000);
      return () => clearInterval(pollTimer);
    }
  }, [currentView, isAdminAuthenticated]);

  const updateConfig = async (newConfig: Partial<AppConfig>): Promise<boolean> => {
    const cleanWa = newConfig.wa ? formatWaPhone(newConfig.wa) : config.wa;
    const updated: AppConfig = {
      ...config,
      ...newConfig,
      supabase: resolveValidSupabase(newConfig.supabase || config.supabase),
      wa: cleanWa,
      lote: { ...config.lote, ...(newConfig.lote || {}) },
      viral: { ...config.viral, ...(newConfig.viral || {}) }
    };
    setConfig(updated);

    let nextPages = productPages;
    if (newConfig.wa) {
      nextPages = productPages.map((p, idx) =>
        p.id === activeProductId || idx === 0 ? { ...p, wa: cleanWa } : p
      );
      setProductPages(nextPages);
    }

    return await persistStoreToDatabase(updated, nextPages, activeProductId, aiAgentSettings);
  };

  // Anti-duplicate guard: tracks in-flight addOrder calls by celular to prevent double-submissions
  const addOrderInFlightRef = React.useRef<Set<string>>(new Set());

  const addOrder = async (orderData: Omit<Order, 'reservaid' | 'fecha'>): Promise<Order> => {
    // ── Duplicate submission guard: same phone number cannot have 2 orders in-flight simultaneously ──
    const phoneKey = String(orderData.celular || '').replace(/\D/g, '');
    if (phoneKey && addOrderInFlightRef.current.has(phoneKey)) {
      // Return the last order that is already being submitted to prevent duplication
      const existingRecent = orders.find(
        o => String(o.celular || '').replace(/\D/g, '') === phoneKey &&
          o.fecha && (Date.now() - new Date(o.fecha).getTime()) < 15000
      );
      if (existingRecent) return existingRecent;
    }
    if (phoneKey) addOrderInFlightRef.current.add(phoneKey);

    try {
      const reservaid = "NX-" + String(Math.floor(Math.random() * 900000) + 100000);
      const targetProdId = orderData.productoId || currentProductPage?.id || activeProductId;
      const targetProdName = orderData.producto || currentProductPage?.nombre || (config.marca + '™ Proyector Navideño 12 Diseños');

      // Consultar el WhatsApp del producto en la BD con un timeout agresivo para NO bloquear jamás la compra
      let dbProductWa = '';
      try {
        const waPromise = fetchProductSellerWaFromDatabase(targetProdId, targetProdName);
        const waTimeout = new Promise<string>((resolve) => window.setTimeout(() => resolve(''), 3000));
        dbProductWa = await Promise.race([waPromise, waTimeout]);
      } catch {
        // Si falla la consulta a la BD, usar el WA local sin bloquear
      }

      const resolvedSellerWa = formatWaPhone(
        dbProductWa ||
        orderData.waVendedor ||
        resolveProductSellerWa({ id: targetProdId, nombre: targetProdName, wa: currentProductPage?.wa }, productPages)
      );

      const attrPayload = getOrderAttributionSnapshot(currentProductPage?.slug || targetProdId);
      const clientRequestKey =
        orderData.clientRequestKey ||
        `ck_${reservaid}_${Date.now().toString(36)}`;

      const newOrder: Order = {
        ...orderData,
        productoId: targetProdId,
        producto: targetProdName,
        waVendedor: resolvedSellerWa,
        reservaid,
        ref_code: orderData.ref_code || referralCode || null,
        dispositivo: getDeviceToken(),
        fecha: new Date().toISOString(),
        estado: orderData.estado || 'reservado',
        acredita: true,
        visitorId: attrPayload.visitorId,
        clientRequestKey,
        attributionSnapshot: attrPayload
      };

      // Optimistic UI update usando actualización funcional para no pisar pedidos concurrentes
      orderMutationEpochRef.current += 1;
      setOrders(prev => {
        const next = [newOrder, ...prev.filter(o => o.reservaid !== newOrder.reservaid)];
        ordersRef.current = next;
        return next;
      });

      // 1. Ruta atómica principal: POST /api/pedidos persiste conjuntamente pedido + order_attribution
      // (y encola respaldo idempotente si Supabase falla). Solo usamos persistOrderToDatabase directo si el servidor no responde.
      let serverOk = false;
      let supabaseOk = false;
      let persistedOrderFromServer: Order | null = null;

      const serverPromise = fetchWithTimeout(
        '/api/pedidos',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newOrder)
        },
        6000
      )
        .then(async (res) => {
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || !ct.includes('application/json')) return false;
          const data = await res.json().catch(() => null);
          if (data && data.success !== false) {
            serverOk = true;
            if (data.order && data.order.reservaid) {
              persistedOrderFromServer = data.order as Order;
            }
            return true;
          }
          return false;
        })
        .catch(() => false);

      await serverPromise;
      if (!serverOk) {
        const supabasePromise = persistOrderToDatabase(newOrder, true)
          .then((ok) => {
            supabaseOk = Boolean(ok);
            return supabaseOk;
          })
          .catch(() => false);
        let timeoutId: number | undefined;
        const hardTimeout = new Promise<void>((resolve) => {
          timeoutId = window.setTimeout(resolve, 9000);
        });
        try {
          await Promise.race([supabasePromise, hardTimeout]);
        } finally {
          if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        }
      }

      if (persistedOrderFromServer) {
        Object.assign(newOrder, persistedOrderFromServer);
      }

      if (!serverOk && !supabaseOk) {
        setOrders(prev => {
          const next = prev.filter(o => o.reservaid !== newOrder.reservaid);
          ordersRef.current = next;
          return next;
        });
        setLastOrder(null);
        throw new Error('No se pudo guardar el pedido en la base de datos. Verificá tu conexión e intentá nuevamente.');
      }

      setLastOrder(newOrder);

      // Trigger local public event
      const newEvent: PublicEvent = {
        id: 'ev-' + Date.now(),
        tipo: 'reserva',
        ciudad: orderData.ciudad || 'Paraguay',
        ref_code: newOrder.ref_code,
        fecha: 'Ahora',
        descripcion: `Nueva reserva Pack ${orderData.cantidad} un. confirmada`
      };
      setEvents(prev => [newEvent, ...prev.slice(0, 15)]);

      return newOrder;
    } finally {
      // Release the duplicate guard after a short cooldown to prevent rapid re-taps
      if (phoneKey) {
        window.setTimeout(() => {
          addOrderInFlightRef.current.delete(phoneKey);
        }, 10000);
      }
    }
  };

  const updateOrderStatus = async (id: string, newStatus: OrderStatus): Promise<boolean> => {
    orderMutationEpochRef.current += 1;
    let affectedRefCode: string | null = null;
    let orderCity = 'Paraguay';
    let updatedOrderObj: Order | null = null;
    const nowIso = new Date().toISOString();

    const nextOrders = ordersRef.current.map(ord => {
      if (ord.reservaid === id || ord.id === id) {
        affectedRefCode = ord.ref_code;
        orderCity = ord.ciudad;
        updatedOrderObj = { ...ord, estado: newStatus, actualizado_en: nowIso };
        return updatedOrderObj;
      }
      return ord;
    });

    ordersRef.current = nextOrders;
    setOrders(prev =>
      prev.map(ord =>
        ord.reservaid === id || ord.id === id
          ? { ...ord, estado: newStatus, actualizado_en: nowIso }
          : ord
      )
    );

    let backendOk = false;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const res = await fetchWithTimeout(
        '/api/pedidos/estado',
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ id, estado: newStatus, orderSnapshot: updatedOrderObj })
        },
        4500
      );
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        backendOk = true;
      }
    } catch (e) { }

    // Fallback directo a Supabase solo si el servidor local/Railway no respondió
    if (!backendOk && updatedOrderObj) {
      await persistOrderToDatabase(updatedOrderObj, false);
    }

    if (newStatus === 'entregado_pagado') {
      const paymentEvent: PublicEvent = {
        id: 'ev-' + Date.now(),
        tipo: 'pago',
        ciudad: orderCity,
        ref_code: affectedRefCode,
        fecha: 'Ahora',
        descripcion: 'Pedido entregado y cobrado en puerta'
      };
      setEvents(prev => [paymentEvent, ...prev.slice(0, 15)]);
    }

    return true;
  };

  const updateOrder = async (id: string, updates: Partial<Order>): Promise<boolean> => {
    orderMutationEpochRef.current += 1;
    let updatedOrderObj: Order | null = null;
    const nowIso = new Date().toISOString();

    const nextOrders = ordersRef.current.map(ord => {
      if (ord.reservaid === id || ord.id === id) {
        updatedOrderObj = { ...ord, ...updates, actualizado_en: nowIso };
        return updatedOrderObj;
      }
      return ord;
    });

    ordersRef.current = nextOrders;
    setOrders(prev =>
      prev.map(ord =>
        ord.reservaid === id || ord.id === id
          ? { ...ord, ...updates, actualizado_en: nowIso }
          : ord
      )
    );

    let backendOk = false;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const res = await fetchWithTimeout(
        '/api/pedidos/estado',
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ id, estado: updates.estado, updates, orderSnapshot: updatedOrderObj })
        },
        4500
      );
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        backendOk = true;
      }
    } catch (e) { }

    if (!backendOk && updatedOrderObj) {
      await persistOrderToDatabase(updatedOrderObj, false);
    }

    return true;
  };

  const deleteOrdersBatch = async (ids: string[]): Promise<boolean> => {
    const cleanIds = Array.from(
      new Set(
        (ids || [])
          .map(id => String(id || '').trim())
          .filter(Boolean)
      )
    );
    if (cleanIds.length === 0) return false;

    orderMutationEpochRef.current += 1;
    const cleanSet = new Set(cleanIds);
    for (const delId of cleanIds) {
      locallyDeletedOrderIdsRef.current.add(delId);
    }

    const targetOrders = ordersRef.current.filter(
      ord => cleanSet.has(String(ord.reservaid || '').trim()) || cleanSet.has(String(ord.id || '').trim())
    );

    // 1. Remover inmediatamente en memoria y UI sin congelar el modal
    const filteredOrders = ordersRef.current.filter(
      ord => !cleanSet.has(String(ord.reservaid || '').trim()) && !cleanSet.has(String(ord.id || '').trim())
    );
    ordersRef.current = filteredOrders;
    setOrders(prev =>
      prev.filter(
        ord => !cleanSet.has(String(ord.reservaid || '').trim()) && !cleanSet.has(String(ord.id || '').trim())
      )
    );

    // 2. Ejecutar borrado atómico en backend /api/pedidos/delete (< 15ms; sincroniza Supabase con reintento en segundo plano)
    let backendDeleted = false;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const res = await fetchWithTimeout(
        '/api/pedidos/delete',
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ ids: cleanIds, id: cleanIds[0], ordersSnapshot: targetOrders })
        },
        4500
      );
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json().catch(() => null);
        if (json?.success !== false) {
          backendDeleted = true;
        }
      }
    } catch (e) { }

    // 3. Fallback directo a Supabase solo si el backend no está disponible (con timeouts estrictos para jamás congelar)
    if (!backendDeleted) {
      const activeSb = resolveValidSupabase(config.supabase);
      const sbUrl = activeSb.url;
      const sbKey = activeSb.anonKey;
      if (sbUrl && sbKey) {
        await Promise.allSettled(
          cleanIds.map(async (cleanId, idx) => {
            const targetOrder = targetOrders.find(
              ord => ord.reservaid === cleanId || ord.id === cleanId
            );
            const targetPhone = targetOrder?.celular || (targetOrder as any)?.telefono || '';
            await Promise.allSettled([
              fetchWithTimeout(
                `${sbUrl}/rest/v1/codigos`,
                {
                  method: 'POST',
                  headers: {
                    'apikey': sbKey,
                    'Authorization': `Bearer ${sbKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                  },
                  body: JSON.stringify({
                    code: `DEL-ORD-${cleanId}-${Date.now() + idx}`,
                    dispositivo: JSON.stringify({
                      deletedOrderId: cleanId,
                      customerPhone: targetPhone ? targetPhone.replace(/\D/g, '') : null,
                      deletedAt: new Date().toISOString()
                    })
                  })
                },
                4500
              ),
              fetchWithTimeout(
                `${sbUrl}/rest/v1/codigos?code=like.${encodeURIComponent(`ORD-${cleanId}`)}*`,
                {
                  method: 'DELETE',
                  headers: {
                    'apikey': sbKey,
                    'Authorization': `Bearer ${sbKey}`
                  }
                },
                4500
              ),
              fetchWithTimeout(
                `${sbUrl}/rest/v1/pedidos?reservaid=eq.${encodeURIComponent(cleanId)}`,
                {
                  method: 'DELETE',
                  headers: {
                    'apikey': sbKey,
                    'Authorization': `Bearer ${sbKey}`
                  }
                },
                4500
              )
            ]);
          })
        );
      }
    }

    return true;
  };

  const deleteOrder = async (id: string): Promise<boolean> => {
    return await deleteOrdersBatch([id]);
  };

  const archiveOrdersBatch = async (ids: string[], archivado: boolean): Promise<boolean> => {
    const cleanIds = Array.from(
      new Set(
        (ids || [])
          .map(id => String(id || '').trim())
          .filter(Boolean)
      )
    );
    if (cleanIds.length === 0) return false;
    orderMutationEpochRef.current += 1;
    const cleanSet = new Set(cleanIds);
    const nowIso = new Date().toISOString();
    const updatedList: Order[] = [];

    const nextOrders = ordersRef.current.map(ord => {
      const rid = String(ord.reservaid || ord.id || '').trim();
      if (rid && cleanSet.has(rid)) {
        const updatedOrd: Order = {
          ...ord,
          archivado: Boolean(archivado),
          fechaArchivado: archivado ? nowIso : null,
          actualizado_en: nowIso
        };
        updatedList.push(updatedOrd);
        return updatedOrd;
      }
      return ord;
    });

    ordersRef.current = nextOrders;
    setOrders(prev =>
      prev.map(ord => {
        const rid = String(ord.reservaid || ord.id || '').trim();
        if (rid && cleanSet.has(rid)) {
          return {
            ...ord,
            archivado: Boolean(archivado),
            fechaArchivado: archivado ? nowIso : null,
            actualizado_en: nowIso
          };
        }
        return ord;
      })
    );

    // 1. Guardar en backend /api/pedidos/archive (< 15ms; sincroniza Supabase con cola de reintento)
    let backendArchived = false;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const res = await fetchWithTimeout(
        '/api/pedidos/archive',
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            ids: cleanIds,
            archivado: Boolean(archivado),
            ordersSnapshot: updatedList
          })
        },
        4500
      );
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        backendArchived = true;
      }
    } catch (e) { }

    // 2. Fallback directo a Supabase solo si el backend no respondió
    if (!backendArchived && updatedList.length > 0) {
      await Promise.allSettled(updatedList.map(ord => persistOrderToDatabase(ord, false)));
    }

    return true;
  };

  return (
    <StoreContext.Provider
      value={{
        config,
        updateConfig,
        orders,
        addOrder,
        updateOrderStatus,
        updateOrder,
        deleteOrder,
        deleteOrdersBatch,
        archiveOrdersBatch,
        currentView,
        setCurrentView,
        selectedPack,
        setSelectedPack,
        cartDrawerOpen,
        setCartDrawerOpen,
        orderFormFullscreen,
        setOrderFormFullscreen,
        openOrderFormFullscreen,
        viralModalOpen,
        setViralModalOpen,
        policyModal,
        setPolicyModal,
        promoterCode,
        referralCode,
        lastOrder,
        events,
        refreshOrders,
        adminUser,
        adminToken,
        isAdminAuthenticated,
        loginAdmin,
        logoutAdmin,
        checkAdminAuth,
        productPages,
        updateProductPage,
        addProductPage,
        deleteProductPage,
        deleteProductPagesBatch,
        currentProductPage,
        setCurrentProductPage,
        effectiveWhatsApp,
        aiAgentSettings,
        updateAIAgentSettings
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
