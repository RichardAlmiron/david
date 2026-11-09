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
import { DEFAULT_CONFIG, getOrCreatePromoterCode, getDeviceToken, formatWaPhone, resolveProductSellerWa } from '../config';

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
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem('noelux_custom_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          wa: formatWaPhone(parsed.wa),
          lote: { ...DEFAULT_CONFIG.lote, ...(parsed.lote || {}) },
          viral: { ...DEFAULT_CONFIG.viral, ...(parsed.viral || {}) }
        };
      }
    } catch (e) { }
    return DEFAULT_CONFIG;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('noelux_pedidos_local');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const storedDeleted = localStorage.getItem('noelux_deleted_order_ids');
          const deletedSet = storedDeleted ? new Set(JSON.parse(storedDeleted)) : new Set();
          return parsed.filter((p: Order) => !deletedSet.has(p.reservaid) && !deletedSet.has(p.id));
        }
      }
    } catch (e) { }
    return [];
  });

  const [currentView, setCurrentView] = useState<ViewType>('store');
  const [selectedPack, setSelectedPackState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('noelux_cart_pack');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
          return parsed;
        }
      }
    } catch (e) { }
    return 0; // Inicia en 0 predeterminadamente hasta que el cliente decida adquirir/elegir
  });

  const setSelectedPack = (pack: number) => {
    const validPack = Math.max(0, Math.min(config.maxCant || 10, pack));
    setSelectedPackState(validPack);
    try {
      if (validPack === 0) {
        localStorage.removeItem('noelux_cart_pack');
      } else {
        localStorage.setItem('noelux_cart_pack', validPack.toString());
      }
    } catch (e) { }
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
    } catch {}
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
      } catch {}
    };
  }, []);
  const [policyModal, setPolicyModal] = useState<PolicyType | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>(INITIAL_EVENTS);
  const [promoterCode] = useState<string>(() => getOrCreatePromoterCode());
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Admin Authentication State (Solo permite sesión del usuario oficial encuestas977@gmail.com)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => {
    try {
      const saved = localStorage.getItem('noelux_admin_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && String(parsed.email).toLowerCase() === 'encuestas977@gmail.com') {
          return parsed;
        }
        localStorage.removeItem('noelux_admin_user');
        localStorage.removeItem('noelux_admin_token');
      }
    } catch (e) { }
    return null;
  });

  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try {
      const savedUser = localStorage.getItem('noelux_admin_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && String(parsed.email).toLowerCase() === 'encuestas977@gmail.com') {
          return localStorage.getItem('noelux_admin_token');
        }
      }
      localStorage.removeItem('noelux_admin_token');
    } catch (e) { }
    return null;
  });

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      const savedUser = localStorage.getItem('noelux_admin_user');
      const token = localStorage.getItem('noelux_admin_token');
      if (savedUser && token) {
        const parsed = JSON.parse(savedUser);
        return Boolean(parsed && String(parsed.email).toLowerCase() === 'encuestas977@gmail.com');
      }
    } catch (e) { }
    return false;
  });

  // Product Pages State
  const [productPages, setProductPages] = useState<ProductPage[]>(() => {
    try {
      const saved = localStorage.getItem('noelux_product_pages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: ProductPage) => ({
            ...p,
            wa: formatWaPhone(p.wa)
          }));
        }
      }
    } catch (e) { }
    return DEFAULT_PRODUCTS;
  });

  // Active / Current Product Page
  const [activeProductId, setActiveProductId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('noelux_active_product_id');
      if (saved) return saved;
    } catch (e) { }
    return productPages[0]?.id || 'prod-noelux-01';
  });

  // AI Agent Settings State
  const [aiAgentSettings, setAiAgentSettings] = useState<AIAgentSettings>(() => {
    try {
      const saved = localStorage.getItem('noelux_ai_agent_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) { }
    return {
      nombreAgente: 'Andrea (Agente IA)',
      activo: true,
      scriptPrompt: DEFAULT_AI_SCRIPT,
      modoPorDefecto: 'automatico'
    };
  });

  // Referencias síncronas para impedir cierres obsoletos (stale closures) al guardar páginas nuevas
  const productPagesRef = React.useRef<ProductPage[]>(productPages);
  const activeProductIdRef = React.useRef<string>(activeProductId);
  const configRef = React.useRef<AppConfig>(config);
  const aiAgentSettingsRef = React.useRef<AIAgentSettings>(aiAgentSettings);
  const lastLocalPersistMsRef = React.useRef<number>(0);
  const deletedProductIdsRef = React.useRef<Set<string>>(
    new Set(
      (() => {
        try {
          const raw = localStorage.getItem('noelux_deleted_product_ids');
          return raw ? JSON.parse(raw) : [];
        } catch {
          return [];
        }
      })()
    )
  );

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

    const sbUrl = DEFAULT_CONFIG.supabase?.url;
    const sbKey = DEFAULT_CONFIG.supabase?.anonKey;

    let savedToDb = false;

    // 1. Guardar directamente en Base de Datos Supabase (accesible desde cualquier navegador/dispositivo)
    if (sbUrl && sbKey) {
      try {
        const uniqueCode = `CFG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const res = await fetch(`${sbUrl}/rest/v1/codigos`, {
          method: 'POST',
          headers: {
            'apikey': sbKey,
            'Authorization': `Bearer ${sbKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            code: uniqueCode,
            dispositivo: JSON.stringify(payload)
          })
        });
        if (res.ok) {
          savedToDb = true;
        }
      } catch (err) {
        console.warn('Error guardando configuración en Supabase:', err);
      }
    }

    // 2. Guardar también en servidor local (/api/config) si está activo
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const resLocal = await fetch('/api/config', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (resLocal.ok) {
        savedToDb = true;
      }
    } catch (e) { }

    return savedToDb;
  };

  // Cargar configuración real desde la Base de Datos Supabase al abrir en cualquier navegador o dispositivo
  const syncConfigFromDatabase = async () => {
    const sbUrl = DEFAULT_CONFIG.supabase?.url;
    const sbKey = DEFAULT_CONFIG.supabase?.anonKey;

    let remoteData: any = null;

    if (sbUrl && sbKey) {
      try {
        const res = await fetch(
          `${sbUrl}/rest/v1/codigos?code=like.CFG-*&order=creado.desc&limit=10`,
          {
            headers: {
              'apikey': sbKey,
              'Authorization': `Bearer ${sbKey}`,
              'Cache-Control': 'no-cache'
            },
            cache: 'no-store'
          }
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
        const resLocal = await fetch('/api/config', { cache: 'no-store' });
        if (resLocal.ok) {
          const dataLocal = await resLocal.json();
          if (dataLocal && dataLocal.config) {
            remoteData = dataLocal.config;
          }
        }
      } catch (e) { }
    }

    if (remoteData && typeof remoteData === 'object') {
      const cleanRemoteWa = remoteData.wa ? formatWaPhone(remoteData.wa) : undefined;

      setConfig(prev => {
        const nextConfig: AppConfig = {
          ...prev,
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
        try {
          localStorage.setItem('noelux_custom_config', JSON.stringify(nextConfig));
        } catch (e) { }
        return nextConfig;
      });

      if (Array.isArray(remoteData.productPages) && remoteData.productPages.length > 0) {
        let fallbackVoiceId = remoteData.selectedVoiceId || '';
        let fallbackVoiceName = remoteData.selectedVoiceName || '';
        let fallbackVoiceProductId = '';

        // Si algún producto no tenía vozAgente en el CFG, consultar también el registro WAVOICE-* en Supabase
        if (sbUrl && sbKey && !remoteData.productPages.every((p: ProductPage) => Boolean(p?.vozAgente))) {
          try {
            const resVoice = await fetch(
              `${sbUrl}/rest/v1/codigos?code=like.WAVOICE-*&order=creado.desc&limit=3`,
              {
                headers: {
                  'apikey': sbKey,
                  'Authorization': `Bearer ${sbKey}`,
                  'Cache-Control': 'no-cache'
                },
                cache: 'no-store'
              }
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
          try {
            localStorage.setItem(
              'noelux_deleted_product_ids',
              JSON.stringify(Array.from(deletedProductIdsRef.current))
            );
          } catch {}
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
                return {
                  ...localMatch,
                  ...p,
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
            try {
              localStorage.setItem('noelux_product_pages', JSON.stringify(mergedPages));
            } catch (e) { }
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
          try {
            localStorage.setItem('noelux_product_pages', JSON.stringify(next));
          } catch (e) { }
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
          try {
            localStorage.setItem('noelux_active_product_id', remoteData.activeProductId);
          } catch (e) { }
        }
      }

      if (remoteData.aiAgentSettings) {
        setAiAgentSettings(prev => {
          const nextAi = { ...prev, ...remoteData.aiAgentSettings };
          aiAgentSettingsRef.current = nextAi;
          try {
            localStorage.setItem('noelux_ai_agent_settings', JSON.stringify(nextAi));
          } catch (e) { }
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
        try {
          localStorage.setItem('noelux_product_pages', JSON.stringify(latestPages));
        } catch (e) { }
      }
    }

    activeProductIdRef.current = id;
    setActiveProductId(id);
    try {
      localStorage.setItem('noelux_active_product_id', id);
    } catch (e) { }
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
    try {
      localStorage.setItem('noelux_product_pages', JSON.stringify(nextProductPages));
    } catch (e) { }

    const targetActiveId = setAsActive ? id : activeProductIdRef.current;
    if (setAsActive) {
      activeProductIdRef.current = id;
      setActiveProductId(id);
      try {
        localStorage.setItem('noelux_active_product_id', id);
      } catch (e) { }
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
    try {
      localStorage.setItem('noelux_custom_config', JSON.stringify(nextConfig));
    } catch (e) { }

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
    try {
      localStorage.setItem('noelux_product_pages', JSON.stringify(nextProductPages));
    } catch (e) { }

    const targetActiveId = setAsActive ? newProd.id : activeProductIdRef.current;
    if (setAsActive) {
      activeProductIdRef.current = newProd.id;
      setActiveProductId(newProd.id);
      try {
        localStorage.setItem('noelux_active_product_id', newProd.id);
      } catch (e) { }
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
    try {
      localStorage.setItem(
        'noelux_deleted_product_ids',
        JSON.stringify(Array.from(deletedProductIdsRef.current))
      );
    } catch {}

    productPagesRef.current = remaining;
    setProductPages(remaining);
    try {
      localStorage.setItem('noelux_product_pages', JSON.stringify(remaining));
    } catch {}

    const nextActiveId = remaining.some(p => p.id === activeProductIdRef.current)
      ? activeProductIdRef.current
      : remaining[0]?.id || 'prod-noelux-01';
    activeProductIdRef.current = nextActiveId;
    setActiveProductId(nextActiveId);
    try {
      localStorage.setItem('noelux_active_product_id', nextActiveId);
    } catch {}

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
    try {
      localStorage.setItem('noelux_ai_agent_settings', JSON.stringify(nextAi));
    } catch (e) { }
    return await persistStoreToDatabase(configRef.current, productPagesRef.current, activeProductIdRef.current, nextAi);
  };

  // Verify Admin Token on mount
  const checkAdminAuth = async (): Promise<boolean> => {
    const token = adminToken || localStorage.getItem('noelux_admin_token');
    if (!token) {
      setIsAdminAuthenticated(false);
      setAdminUser(null);
      return false;
    }

    try {
      const savedUser = localStorage.getItem('noelux_admin_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && String(parsed.email).toLowerCase() === 'encuestas977@gmail.com') {
          setAdminUser(parsed);
          setIsAdminAuthenticated(true);
          return true;
        }
      }
    } catch (e) { }

    // Si la sesión guardada no pertenece al usuario oficial, cerrarla de inmediato
    setAdminToken(null);
    setAdminUser(null);
    setIsAdminAuthenticated(false);
    try {
      localStorage.removeItem('noelux_admin_token');
      localStorage.removeItem('noelux_admin_user');
    } catch (e) { }
    return false;
  };

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const loginAdmin = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Verificar contra la función RPC de la Base de Datos Supabase (si ya fue ejecutado el SQL)
    const sbUrl = DEFAULT_CONFIG.supabase?.url;
    const sbKey = DEFAULT_CONFIG.supabase?.anonKey;
    if (sbUrl && sbKey) {
      try {
        const rpcRes = await fetch(`${sbUrl}/rest/v1/rpc/verificar_login_admin`, {
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
        });
        if (rpcRes.ok) {
          const rpcData = await rpcRes.json();
          if (rpcData && rpcData.success && rpcData.user) {
            const dbToken = 'token-sb-' + Date.now();
            setAdminToken(dbToken);
            setAdminUser(rpcData.user);
            setIsAdminAuthenticated(true);
            try {
              localStorage.setItem('noelux_admin_token', dbToken);
              localStorage.setItem('noelux_admin_user', JSON.stringify(rpcData.user));
            } catch (e) { }
            return { success: true };
          } else if (rpcData && rpcData.success === false) {
            return { success: false, error: rpcData.error || 'Credenciales inválidas. Acceso denegado.' };
          }
        }
      } catch (e) { }
    }

    // 2. Verificar contra endpoint /api/admin/login
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            try {
              localStorage.setItem('noelux_admin_token', data.token);
              localStorage.setItem('noelux_admin_user', JSON.stringify(data.user));
            } catch (e) { }
            return { success: true };
          }
          return { success: false, error: data.error || 'Credenciales inválidas. Acceso denegado.' };
        } catch (e) { }
      }
    } catch (err: any) { }

    // 3. Validación estricta y exclusiva del único usuario oficial autorizado
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
      try {
        localStorage.setItem('noelux_admin_token', officialToken);
        localStorage.setItem('noelux_admin_user', JSON.stringify(officialUser));
      } catch (e) { }
      return { success: true };
    }

    return { success: false, error: 'Credenciales inválidas. Acceso denegado.' };
  };

  const logoutAdmin = async () => {
    if (adminToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
      } catch (e) { }
    }
    setAdminToken(null);
    setAdminUser(null);
    setIsAdminAuthenticated(false);
    try {
      localStorage.removeItem('noelux_admin_token');
      localStorage.removeItem('noelux_admin_user');
    } catch (e) { }
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

      const ref = params.get('ref') || params.get('bind');
      if (ref) {
        setReferralCode(ref);
        try {
          sessionStorage.setItem('noelux_ref', ref);
        } catch (e) { }
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
        try {
          localStorage.setItem('noelux_active_product_id', matchedBySlug.id);
        } catch (e) {}
      }
    }
  }, [productPages, activeProductId]);

  // Persist single order state to Supabase DB
  const persistOrderToDatabase = async (orderObj: Order, isNewInsert = false) => {
    const sbUrl = DEFAULT_CONFIG.supabase?.url;
    const sbKey = DEFAULT_CONFIG.supabase?.anonKey;
    if (!sbUrl || !sbKey) return;

    // 1. Si es un pedido nuevo, insertar en tabla oficial 'pedidos' y 'eventos_publicos'
    if (isNewInsert) {
      try {
        await fetch(`${sbUrl}/rest/v1/pedidos`, {
          method: 'POST',
          headers: {
            'apikey': sbKey,
            'Authorization': `Bearer ${sbKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            reservaid: orderObj.reservaid,
            nombre: orderObj.nombre,
            celular: orderObj.celular,
            departamento: orderObj.departamento || '',
            ciudad: orderObj.ciudad || '',
            direccion: orderObj.direccion || '',
            detalle: orderObj.detalle || 'Efectivo al recibir',
            cantidad: Number(orderObj.cantidad) || 1,
            monto: Number(orderObj.monto) || 0,
            ref_code: orderObj.ref_code || null,
            dispositivo: orderObj.dispositivo || 'web',
            estado: orderObj.estado || 'reservado',
            acredita: true
          })
        });
      } catch (e) { }

      try {
        await fetch(`${sbUrl}/rest/v1/eventos_publicos`, {
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
        });
      } catch (e) { }
    }

    // 2. Guardar registro sincronizable multi-dispositivo en Supabase (limpiando snapshots previos si es actualización)
    try {
      orderObj.actualizado_en = orderObj.actualizado_en || new Date().toISOString();
      if (!isNewInsert) {
        await fetch(`${sbUrl}/rest/v1/codigos?code=like.ORD-${orderObj.reservaid}*`, {
          method: 'DELETE',
          headers: {
            'apikey': sbKey,
            'Authorization': `Bearer ${sbKey}`
          }
        }).catch(() => {});

        await fetch(`${sbUrl}/rest/v1/pedidos?reservaid=eq.${orderObj.reservaid}`, {
          method: 'PATCH',
          headers: {
            'apikey': sbKey,
            'Authorization': `Bearer ${sbKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            estado: orderObj.estado || 'reservado',
            dispositivo: JSON.stringify(orderObj)
          })
        }).catch(() => {});
      }

      const codeKey = `ORD-${orderObj.reservaid}-${Date.now()}`;
      await fetch(`${sbUrl}/rest/v1/codigos`, {
        method: 'POST',
        headers: {
          'apikey': sbKey,
          'Authorization': `Bearer ${sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          code: codeKey,
          dispositivo: JSON.stringify(orderObj)
        })
      });
    } catch (e) { }
  };

  // Fetch orders from Supabase Database + local API (sincronizando también eliminados DEL-ORD-* desde Supabase)
  const refreshOrders = async () => {
    const sbUrl = DEFAULT_CONFIG.supabase?.url;
    const sbKey = DEFAULT_CONFIG.supabase?.anonKey;
    const mergedMap = new Map<string, Order>();
    let fetchedFromAnySource = false;

    let deletedSet = new Set<string>();
    try {
      const storedDeleted = localStorage.getItem('noelux_deleted_order_ids');
      if (storedDeleted) {
        const parsedDel = JSON.parse(storedDeleted);
        if (Array.isArray(parsedDel)) {
          parsedDel.forEach(id => deletedSet.add(String(id).trim()));
        }
      }
    } catch (e) { }

    // 0. Leer primero desde la Base de Datos Supabase todos los pedidos marcados como eliminados (DEL-ORD-*)
    if (sbUrl && sbKey) {
      try {
        const resDelSb = await fetch(
          `${sbUrl}/rest/v1/codigos?select=code,dispositivo&code=like.DEL-ORD-*&order=creado.desc&limit=500`,
          {
            headers: {
              'apikey': sbKey,
              'Authorization': `Bearer ${sbKey}`,
              'Cache-Control': 'no-cache'
            },
            cache: 'no-store'
          }
        );
        if (resDelSb.ok) {
          const delRows = await resDelSb.json();
          if (Array.isArray(delRows)) {
            for (const r of delRows) {
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
              } catch (e) { }
            }
          }
          try {
            localStorage.setItem('noelux_deleted_order_ids', JSON.stringify(Array.from(deletedSet)));
          } catch (e) { }
        }
      } catch (e) { }
    }

    // 1. Leer pedidos desde la Base de Datos Supabase (ordenados del más reciente al más antiguo)
    if (sbUrl && sbKey) {
      try {
        const resSb = await fetch(
          `${sbUrl}/rest/v1/codigos?code=like.ORD-*&order=creado.desc&limit=250`,
          {
            headers: {
              'apikey': sbKey,
              'Authorization': `Bearer ${sbKey}`,
              'Cache-Control': 'no-cache'
            },
            cache: 'no-store'
          }
        );
        if (resSb.ok) {
          fetchedFromAnySource = true;
          const rows = await resSb.json();
          if (Array.isArray(rows)) {
            for (const r of rows) {
              try {
                const parsed: Order = JSON.parse(r.dispositivo);
                if (
                  parsed &&
                  parsed.reservaid &&
                  !deletedSet.has(String(parsed.reservaid).trim()) &&
                  !deletedSet.has(String(parsed.id || '').trim()) &&
                  !mergedMap.has(parsed.reservaid)
                ) {
                  mergedMap.set(parsed.reservaid, parsed);
                }
              } catch (e) { }
            }
          }
        }
      } catch (e) { }
    }

    // 2. Combinar con /api/pedidos local si está disponible (filtrando siempre contra deletedSet de Supabase y priorizando el registro más reciente por actualizado_en)
    try {
      const res = await fetch('/api/pedidos', { cache: 'no-store' });
      if (res.ok) {
        fetchedFromAnySource = true;
        const data = await res.json();
        if (Array.isArray(data.pedidos)) {
          for (const ord of data.pedidos) {
            if (
              ord &&
              ord.reservaid &&
              !deletedSet.has(String(ord.reservaid).trim()) &&
              !deletedSet.has(String(ord.id || '').trim())
            ) {
              const existing = mergedMap.get(ord.reservaid);
              if (!existing) {
                mergedMap.set(ord.reservaid, ord);
              } else {
                const tExisting = existing.actualizado_en ? new Date(existing.actualizado_en).getTime() : 0;
                const tLocal = ord.actualizado_en ? new Date(ord.actualizado_en).getTime() : 0;
                if (tLocal >= tExisting) {
                  mergedMap.set(ord.reservaid, { ...existing, ...ord });
                } else {
                  mergedMap.set(ord.reservaid, { ...ord, ...existing });
                }
              }
            }
          }
        }
      }
    } catch (e) { }

    if (fetchedFromAnySource || mergedMap.size > 0) {
      const finalOrders = Array.from(mergedMap.values()).sort((a, b) => {
        const tA = a.fecha ? new Date(a.fecha).getTime() : 0;
        const tB = b.fecha ? new Date(b.fecha).getTime() : 0;
        return tB - tA;
      });
      setOrders(finalOrders);
      try {
        localStorage.setItem('noelux_pedidos_local', JSON.stringify(finalOrders));
      } catch (e) { }
    } else {
      try {
        const saved = localStorage.getItem('noelux_pedidos_local');
        if (saved) {
          const parsedSaved = JSON.parse(saved);
          if (Array.isArray(parsedSaved)) {
            setOrders(
              parsedSaved.filter(
                (o: Order) =>
                  !deletedSet.has(String(o.reservaid).trim()) &&
                  !deletedSet.has(String(o.id || '').trim())
              )
            );
          }
        }
      } catch (err) { }
    }
  };

  // Sincronización automática con la Base de Datos al iniciar, al cambiar de vista y al enfocar la ventana
  useEffect(() => {
    syncConfigFromDatabase();
    refreshOrders();

    const handleFocus = () => {
      syncConfigFromDatabase();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    syncConfigFromDatabase();
  }, [currentView]);

  const updateConfig = async (newConfig: Partial<AppConfig>): Promise<boolean> => {
    const cleanWa = newConfig.wa ? formatWaPhone(newConfig.wa) : config.wa;
    const updated: AppConfig = {
      ...config,
      ...newConfig,
      wa: cleanWa,
      lote: { ...config.lote, ...(newConfig.lote || {}) },
      viral: { ...config.viral, ...(newConfig.viral || {}) }
    };
    setConfig(updated);
    try {
      localStorage.setItem('noelux_custom_config', JSON.stringify(updated));
    } catch (e) { }

    let nextPages = productPages;
    if (newConfig.wa) {
      nextPages = productPages.map((p, idx) =>
        p.id === activeProductId || idx === 0 ? { ...p, wa: cleanWa } : p
      );
      setProductPages(nextPages);
      try {
        localStorage.setItem('noelux_product_pages', JSON.stringify(nextPages));
      } catch (e) { }
    }

    return await persistStoreToDatabase(updated, nextPages, activeProductId, aiAgentSettings);
  };

  const addOrder = async (orderData: Omit<Order, 'reservaid' | 'fecha'>): Promise<Order> => {
    const reservaid = "NX-" + String(Math.floor(Math.random() * 900000) + 100000);
    const targetProdId = orderData.productoId || currentProductPage?.id || activeProductId;
    const targetProdName = orderData.producto || currentProductPage?.nombre || (config.marca + '™ Proyector Navideño 12 Diseños');

    // Consultar siempre el valor real del WhatsApp del producto en la Base de Datos para que viaje con el pedido
    const dbProductWa = await fetchProductSellerWaFromDatabase(targetProdId, targetProdName);
    const resolvedSellerWa = formatWaPhone(
      dbProductWa ||
      orderData.waVendedor ||
      resolveProductSellerWa({ id: targetProdId, nombre: targetProdName, wa: currentProductPage?.wa }, productPages)
    );

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
      acredita: true
    };

    setLastOrder(newOrder);

    // Optimistic UI update
    const nextOrders = [newOrder, ...orders];
    setOrders(nextOrders);
    try {
      localStorage.setItem('noelux_pedidos_local', JSON.stringify(nextOrders));
    } catch (e) { }

    // 1. Guardar en Base de Datos Supabase (el pedido viaja con waVendedor y productoId)
    await persistOrderToDatabase(newOrder, true);

    // 2. Guardar en servidor local si existe
    try {
      await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder)
      });
    } catch (e) { }

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
  };

  const updateOrderStatus = async (id: string, newStatus: OrderStatus): Promise<boolean> => {
    let affectedRefCode: string | null = null;
    let orderCity = 'Paraguay';
    let updatedOrderObj: Order | null = null;
    const nowIso = new Date().toISOString();

    const nextOrders = orders.map(ord => {
      if (ord.reservaid === id || ord.id === id) {
        affectedRefCode = ord.ref_code;
        orderCity = ord.ciudad;
        updatedOrderObj = { ...ord, estado: newStatus, actualizado_en: nowIso };
        return updatedOrderObj;
      }
      return ord;
    });

    setOrders(nextOrders);
    try {
      localStorage.setItem('noelux_pedidos_local', JSON.stringify(nextOrders));
    } catch (e) { }

    if (updatedOrderObj) {
      await persistOrderToDatabase(updatedOrderObj, false);
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      await fetch('/api/pedidos/estado', {
        method: 'POST',
        headers,
        body: JSON.stringify({ id, estado: newStatus, orderSnapshot: updatedOrderObj })
      });
    } catch (e) { }

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
    let updatedOrderObj: Order | null = null;
    const nowIso = new Date().toISOString();

    const nextOrders = orders.map(ord => {
      if (ord.reservaid === id || ord.id === id) {
        updatedOrderObj = { ...ord, ...updates, actualizado_en: nowIso };
        return updatedOrderObj;
      }
      return ord;
    });

    setOrders(nextOrders);
    try {
      localStorage.setItem('noelux_pedidos_local', JSON.stringify(nextOrders));
    } catch (e) { }

    if (updatedOrderObj) {
      await persistOrderToDatabase(updatedOrderObj, false);
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      await fetch('/api/pedidos/estado', {
        method: 'POST',
        headers,
        body: JSON.stringify({ id, estado: updates.estado, updates, orderSnapshot: updatedOrderObj })
      });
    } catch (e) { }

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
    const cleanSet = new Set(cleanIds);

    // 1. Guardar permanentemente en lista negra de eliminados en localStorage
    try {
      const stored = localStorage.getItem('noelux_deleted_order_ids');
      const list: string[] = stored ? JSON.parse(stored) : [];
      for (const cid of cleanIds) {
        if (!list.includes(cid)) {
          list.push(cid);
        }
      }
      localStorage.setItem('noelux_deleted_order_ids', JSON.stringify(list));
    } catch (e) { }

    const targetOrders = orders.filter(
      ord => cleanSet.has(String(ord.reservaid || '').trim()) || cleanSet.has(String(ord.id || '').trim())
    );

    // 2. Filtrar estado de pedidos en React y en localStorage local
    const nextOrders = orders.filter(
      ord => !cleanSet.has(String(ord.reservaid || '').trim()) && !cleanSet.has(String(ord.id || '').trim())
    );
    setOrders(nextOrders);
    try {
      localStorage.setItem('noelux_pedidos_local', JSON.stringify(nextOrders));
    } catch (e) { }

    // 3. Ejecutar eliminación directa en la Base de Datos Supabase (DEL-ORD-* + DELETE codigos + DELETE pedidos)
    const sbUrl = DEFAULT_CONFIG.supabase?.url;
    const sbKey = DEFAULT_CONFIG.supabase?.anonKey;
    if (sbUrl && sbKey) {
      await Promise.allSettled(
        cleanIds.map(async (cleanId, idx) => {
          const targetOrder = targetOrders.find(
            ord => ord.reservaid === cleanId || ord.id === cleanId
          );
          const targetPhone = targetOrder?.celular || (targetOrder as any)?.telefono || '';
          try {
            await fetch(`${sbUrl}/rest/v1/codigos`, {
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
            });
          } catch (e) { }

          try {
            await fetch(`${sbUrl}/rest/v1/codigos?code=like.ORD-${cleanId}*`, {
              method: 'DELETE',
              headers: {
                'apikey': sbKey,
                'Authorization': `Bearer ${sbKey}`
              }
            });
          } catch (e) { }

          try {
            await fetch(`${sbUrl}/rest/v1/pedidos?reservaid=eq.${cleanId}`, {
              method: 'DELETE',
              headers: {
                'apikey': sbKey,
                'Authorization': `Bearer ${sbKey}`
              }
            });
          } catch (e) { }
        })
      );
    }

    // 4. Notificar a backend /api/pedidos/delete (ejecuta eliminación en servidor + base de datos)
    try {
      await fetch('/api/pedidos/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: cleanIds, id: cleanIds[0], ordersSnapshot: targetOrders })
      });
    } catch (e) { }

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
    const cleanSet = new Set(cleanIds);
    const nowIso = new Date().toISOString();
    const updatedList: Order[] = [];

    const nextOrders = orders.map(ord => {
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

    setOrders(nextOrders);
    try {
      localStorage.setItem('noelux_pedidos_local', JSON.stringify(nextOrders));
    } catch (e) { }

    // 1. Persistir directamente cada pedido archivado/desarchivado en la Base de Datos Supabase
    await Promise.allSettled(updatedList.map(ord => persistOrderToDatabase(ord, false)));

    // 2. Persistir en backend /api/pedidos/archive (que también sincroniza con Supabase y pedidos.json)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      await fetch('/api/pedidos/archive', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ids: cleanIds,
          archivado: Boolean(archivado),
          ordersSnapshot: updatedList
        })
      });
    } catch (e) { }

    return true;
  };

  // BÓVEDA PERMANENTE ANTI-DESCONEXIÓN WHATSAPP Y CONFIG (Respaldo y Auto-Restauración tras Deploy en Railway)
  useEffect(() => {
    let isMounted = true;
    const syncRailwayVault = async () => {
      try {
        const res = await fetch('/api/system/vault-snapshot');
        if (!res.ok || !isMounted) return;
        const snap = await res.json();
        if (!snap?.success) return;

        const VAULT_KEY = 'noelux_permanent_railway_vault_v1';
        let localVault: any = null;
        try {
          const raw = localStorage.getItem(VAULT_KEY);
          if (raw) localVault = JSON.parse(raw);
        } catch {}

        const serverHasWaCreds = Array.isArray(snap.waAuthBundle) && snap.waAuthBundle.length > 0;
        const localHasWaCreds = Array.isArray(localVault?.waAuthBundle) && localVault.waAuthBundle.length > 0;

        // Verificar si el navegador tiene un CAPI Token guardado que el contenedor recién desplegado aún no tiene
        const localPages = productPagesRef.current || [];
        const localHasCapiToken = localPages.some(p => Boolean(p?.metaTracking?.capiAccessToken?.trim()));
        const serverPages: any[] = Array.isArray(snap.storeConfig?.productPages) ? snap.storeConfig.productPages : [];
        const serverHasCapiToken = serverPages.some(p => Boolean(p?.metaTracking?.capiAccessToken?.trim()));

        if ((!serverHasWaCreds && localHasWaCreds) || (localHasCapiToken && !serverHasCapiToken)) {
          // El servidor acaba de iniciar tras un deploy: restaurar credenciales de WhatsApp y configuración al instante
          await fetch('/api/system/vault-restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              waAuthBundle: localHasWaCreds ? localVault.waAuthBundle : [],
              storeConfig: {
                ...(localVault?.storeConfig || {}),
                ...(snap.storeConfig || {}),
                productPages: localPages
              }
            })
          }).catch(() => {});
        } else if (serverHasWaCreds) {
          // Respaldar las credenciales activas de WhatsApp y configuración en la bóveda permanente del navegador
          const nextVault = {
            waAuthBundle: snap.waAuthBundle,
            connectedPhone: snap.connectedPhone || localVault?.connectedPhone || null,
            storeConfig: {
              ...(snap.storeConfig || {}),
              productPages: localPages.length > 0 ? localPages : snap.storeConfig?.productPages
            },
            updatedAt: new Date().toISOString()
          };
          try {
            localStorage.setItem(VAULT_KEY, JSON.stringify(nextVault));
          } catch {}
        }
      } catch {}
    };

    syncRailwayVault();
    const timer = setInterval(syncRailwayVault, 20000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

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
