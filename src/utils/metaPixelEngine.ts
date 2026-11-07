import { ProductMetaTrackingConfig, ProductPage } from '../types';

export type MetaFunnelEventName =
  | 'PageView'
  | 'ViewContent'
  | 'CustomizeProduct'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'AddPaymentInfo'
  | 'Lead'
  | 'Purchase'
  | 'Contact'
  | 'GalleryInteraction'
  | 'EngagedVisitor'
  | 'DeepScroll';

export interface MetaEventDefinition {
  id: MetaFunnelEventName;
  type: 'standard' | 'custom_micro';
  title: string;
  triggerDescription: string;
  metaAlgorithmImpact: string;
}

export const META_EVENTS_CATALOG: MetaEventDefinition[] = [
  {
    id: 'PageView',
    type: 'standard',
    title: 'PageView (Visita Inicial + Captura fbclid)',
    triggerDescription: 'Se dispara al abrir la página y guarda _fbc y _fbp en cookie de primera parte.',
    metaAlgorithmImpact: 'Asegura atribución exacta del clic publicitario incluso en Safari iOS 14.5+.'
  },
  {
    id: 'ViewContent',
    type: 'standard',
    title: 'ViewContent (Visualización de Producto)',
    triggerDescription: 'Envía ID del producto, nicho, nombre y valor en Guaraníes (PYG) al cargar la oferta.',
    metaAlgorithmImpact: 'Entrena a Meta Ads sobre qué perfil demográfico abre la página sin rebotar.'
  },
  {
    id: 'GalleryInteraction',
    type: 'custom_micro',
    title: 'GalleryInteraction (Exploración de las 8 Escenas)',
    triggerDescription: 'Se activa cuando el visitante desliza o toca las fotos 1:1 o el video en vivo.',
    metaAlgorithmImpact: 'Filtra curiosos de compradores reales con alto interés visual en el producto.'
  },
  {
    id: 'EngagedVisitor',
    type: 'custom_micro',
    title: 'EngagedVisitor (Lectura Activa 15s y 45s)',
    triggerDescription: 'Se envía automáticamente a los 15 y 45 segundos de permanencia activa.',
    metaAlgorithmImpact: 'Premia a los anuncios que traen tráfico de alta retención y baja el CPM.'
  },
  {
    id: 'DeepScroll',
    type: 'custom_micro',
    title: 'DeepScroll (Scroll Profundo 50% y 80%)',
    triggerDescription: 'Se dispara al leer beneficios, testimonios y preguntas frecuentes.',
    metaAlgorithmImpact: 'Alimenta audiencias Lookalike de compradores que evalúan toda la oferta.'
  },
  {
    id: 'CustomizeProduct',
    type: 'standard',
    title: 'CustomizeProduct (Cambio a Pack 2x / 3x)',
    triggerDescription: 'Se dispara cuando el cliente elige entre Pack 1, Pack 2 (Oferta) o Pack 3.',
    metaAlgorithmImpact: 'Optimiza el algoritmo de Meta hacia clientes de ticket alto (Pack 2 y Pack 3).'
  },
  {
    id: 'AddToCart',
    type: 'standard',
    title: 'AddToCart (Clic en Pedir Contra Entrega)',
    triggerDescription: 'Se envía al abrir el formulario de pedido con el monto en PYG y cantidad.',
    metaAlgorithmImpact: 'Señal clave de intención de compra para campañas de conversión.'
  },
  {
    id: 'InitiateCheckout',
    type: 'standard',
    title: 'InitiateCheckout (Inicio de Formulario / Casa o Edificio)',
    triggerDescription: 'Se activa al elegir tipo de vivienda o avanzar al Paso 2 de ubicación.',
    metaAlgorithmImpact: 'Identifica usuarios que inician activamente el proceso de envío.'
  },
  {
    id: 'AddPaymentInfo',
    type: 'standard',
    title: 'AddPaymentInfo (Confirmación de Pin GPS y Método COD)',
    triggerDescription: 'Se dispara cuando el cliente fija su ubicación GPS y método de pago al recibir.',
    metaAlgorithmImpact: 'Señal previa a la compra que confirma alta intención de recepción real.'
  },
  {
    id: 'Lead',
    type: 'standard',
    title: 'Lead (Captura de Nombre y WhatsApp con SHA-256)',
    triggerDescription: 'Envía teléfono paraguayo (595...) y nombre hasheados en SHA-256.',
    metaAlgorithmImpact: 'Eleva el Event Match Quality (EMQ) por encima de 9.2/10.'
  },
  {
    id: 'Purchase',
    type: 'standard',
    title: 'Purchase (Pedido Contra Entrega Confirmado)',
    triggerDescription: 'Disparo dual (Píxel + Servidor CAPI) con deduplicación event_id, monto PYG y orden.',
    metaAlgorithmImpact: 'El evento rey para que el algoritmo Andromeda busque miles de compradores idénticos.'
  },
  {
    id: 'Contact',
    type: 'standard',
    title: 'Contact (Interacción Directa con WhatsApp)',
    triggerDescription: 'Se activa cuando el cliente abre el canal de atención o confirmación en WhatsApp.',
    metaAlgorithmImpact: 'Cierra el ciclo omnicanal entre la página web y la confirmación en WhatsApp.'
  }
];

export const DEFAULT_META_TRACKING_CONFIG: ProductMetaTrackingConfig = {
  pixelId: '',
  capiAccessToken: '',
  testEventCode: '',
  capiServerEnabled: true,
  advancedMatchingSha256: true,
  firstPartyCookiesEnabled: true,
  enabledEvents: {
    PageView: true,
    ViewContent: true,
    CustomizeProduct: true,
    AddToCart: true,
    InitiateCheckout: true,
    AddPaymentInfo: true,
    Lead: true,
    Purchase: true,
    Contact: true,
    GalleryInteraction: true,
    EngagedVisitor: true,
    DeepScroll: true
  }
};

export interface MetaUserDataInput {
  nombre?: string;
  celular?: string;
  ciudad?: string;
  departamento?: string;
  externalId?: string;
}

export interface NormalizedMetaUserData {
  fn: string;
  ln: string;
  ph: string;
  ct: string;
  st: string;
  country: string;
  externalId: string;
}

/**
 * Normaliza datos del comprador según el estándar oficial de Meta Conversions API
 * antes de aplicar SHA-256 en el servidor.
 */
export function normalizeCustomerForAdvancedMatching(input?: MetaUserDataInput): NormalizedMetaUserData {
  const rawName = String(input?.nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .trim();
  const nameParts = rawName.split(/\s+/).filter(Boolean);
  const fn = nameParts[0] || '';
  const ln = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

  let digits = String(input?.celular || '').replace(/\D+/g, '');
  if (digits.startsWith('09') && digits.length >= 9) {
    digits = `595${digits.slice(1)}`;
  } else if (digits.startsWith('9') && digits.length === 9) {
    digits = `595${digits}`;
  }

  const ct = String(input?.ciudad || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const st = String(input?.departamento || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const externalId = String(input?.externalId || '').trim().toLowerCase();

  return {
    fn,
    ln,
    ph: digits,
    ct,
    st,
    country: 'py',
    externalId
  };
}

/**
 * Genera un event_id único para deduplicación exacta entre el Píxel del Navegador y el Servidor CAPI.
 */
export function generateDeduplicationEventId(eventName: string, orderOrCustomSeed?: string): string {
  if (orderOrCustomSeed) {
    const cleanSeed = orderOrCustomSeed.replace(/[^a-zA-Z0-9_-]/g, '');
    return `evt_${eventName}_${cleanSeed}`;
  }
  const rand = Math.random().toString(36).substring(2, 10);
  return `evt_${eventName}_${Date.now()}_${rand}`;
}

function setFirstPartyCookie(name: string, value: string, days = 90) {
  if (typeof document === 'undefined') return;
  try {
    const expires = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {}
}

function getCookieValue(name: string): string {
  if (typeof document === 'undefined') return '';
  try {
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : '';
  } catch {
    return '';
  }
}

/**
 * Obtiene o crea el identificador _fbp de primera parte (resistente a Safari ITP).
 */
export function getOrCreateFbp(): string {
  if (typeof window === 'undefined') return '';
  try {
    const fromCookie = getCookieValue('_fbp');
    if (fromCookie && fromCookie.startsWith('fb.')) {
      localStorage.setItem('noelux_meta_fbp', fromCookie);
      return fromCookie;
    }
    const fromStorage = localStorage.getItem('noelux_meta_fbp');
    if (fromStorage && fromStorage.startsWith('fb.')) {
      setFirstPartyCookie('_fbp', fromStorage, 90);
      return fromStorage;
    }
    const random10 = Math.floor(1000000000 + Math.random() * 9000000000);
    const created = `fb.1.${Date.now()}.${random10}`;
    localStorage.setItem('noelux_meta_fbp', created);
    setFirstPartyCookie('_fbp', created, 90);
    return created;
  } catch {
    return `fb.1.${Date.now()}.1234567890`;
  }
}

/**
 * Captura ?fbclid=... de la URL cuando el usuario entra desde un anuncio de Instagram/Facebook
 * y lo persiste como _fbc en primera parte para que el bloqueador de Apple iOS no lo borre.
 */
export function captureAndPersistFbc(): string {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get('fbclid');
    if (fbclid && fbclid.trim()) {
      const fbc = `fb.1.${Date.now()}.${fbclid.trim()}`;
      localStorage.setItem('noelux_meta_fbc', fbc);
      setFirstPartyCookie('_fbc', fbc, 90);
      return fbc;
    }
    const fromCookie = getCookieValue('_fbc');
    if (fromCookie) return fromCookie;
    return localStorage.getItem('noelux_meta_fbc') || '';
  } catch {
    return '';
  }
}

const initializedPixels = new Set<string>();

/**
 * Inicializa el Píxel de Facebook en el navegador si hay un pixelId configurado.
 */
export function initMetaBrowserPixel(pixelId?: string): void {
  if (typeof window === 'undefined') return;
  const cleanId = String(pixelId || '').replace(/\D+/g, '');
  if (!cleanId || cleanId.length < 5) return;

  try {
    const w = window as any;
    if (!w.fbq) {
      const n: any = (w.fbq = function (...args: any[]) {
        if (n.callMethod) {
          n.callMethod.apply(n, args);
        } else {
          n.queue.push(args);
        }
      });
      if (!w._fbq) w._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      const firstScript = document.getElementsByTagName('script')[0];
      if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
      } else {
        document.head.appendChild(script);
      }
    }

    if (!initializedPixels.has(cleanId)) {
      w.fbq('init', cleanId);
      initializedPixels.add(cleanId);
    }
  } catch {}
}

export interface TrackMetaEventOptions {
  eventName: MetaFunnelEventName;
  product?: ProductPage | null;
  globalPixelId?: string;
  packQuantity?: number;
  valueGs?: number;
  orderId?: string;
  userData?: MetaUserDataInput;
  extraCustomData?: Record<string, any>;
}

/**
 * Motor Dual (Píxel de Navegador + Servidor Conversions API Anti-Bloqueo Apple iOS)
 * Dispara ambos canales simultáneamente con el mismo event_id para deduplicación perfecta.
 */
export async function trackMetaFullFunnelEvent(options: TrackMetaEventOptions): Promise<{
  eventId: string;
  browserFired: boolean;
  capiSent: boolean;
}> {
  const {
    eventName,
    product,
    globalPixelId,
    packQuantity = 1,
    valueGs,
    orderId,
    userData,
    extraCustomData
  } = options;

  const trackingCfg = product?.metaTracking || DEFAULT_META_TRACKING_CONFIG;

  // Verificar si el evento específico está habilitado en la plantilla/producto
  if (trackingCfg.enabledEvents && trackingCfg.enabledEvents[eventName] === false) {
    return { eventId: '', browserFired: false, capiSent: false };
  }

  const effectivePixelId = String(trackingCfg.pixelId || globalPixelId || '').replace(/\D+/g, '');
  const eventId = generateDeduplicationEventId(
    eventName,
    orderId ? `${orderId}_${eventName}` : undefined
  );

  const fbp = getOrCreateFbp();
  const fbc = captureAndPersistFbc();

  const unitOrPackPrice =
    valueGs !== undefined
      ? valueGs
      : product?.precios?.[packQuantity] || product?.precios?.[1] || 189000;

  const contentId = product?.slug || product?.id || 'producto-cod-py';
  const contentName = product?.nombre || 'Producto Estrella COD';
  const contentCategory = product?.nicheId || 'ecommerce_cod_paraguay';

  const numericTotalGs = Number(unitOrPackPrice) || 0;
  const safeQty = Math.max(1, Number(packQuantity) || 1);
  const unitItemPrice = Math.round(numericTotalGs / safeQty);

  const customData: Record<string, any> = {
    content_name: contentName,
    content_category: contentCategory,
    content_ids: [contentId],
    content_type: 'product',
    contents: [
      {
        id: contentId,
        quantity: safeQty,
        item_price: unitItemPrice,
        delivery_category: 'home_delivery'
      }
    ],
    value: numericTotalGs,
    currency: 'PYG',
    num_items: safeQty,
    delivery_category: 'home_delivery',
    ...(orderId ? { order_id: orderId } : {}),
    ...(extraCustomData || {})
  };

  // 1. Disparar por el Píxel del Navegador (si no fue bloqueado por Safari/AdBlock)
  let browserFired = false;
  if (typeof window !== 'undefined' && effectivePixelId) {
    try {
      initMetaBrowserPixel(effectivePixelId);
      const w = window as any;
      if (typeof w.fbq === 'function') {
        if (userData && (userData.celular || userData.nombre)) {
          const norm = normalizeCustomerForAdvancedMatching(userData);
          w.fbq('init', effectivePixelId, {
            ...(norm.ph ? { ph: norm.ph } : {}),
            ...(norm.fn ? { fn: norm.fn } : {}),
            ...(norm.ln ? { ln: norm.ln } : {}),
            ...(norm.ct ? { ct: norm.ct } : {}),
            ...(norm.st ? { st: norm.st } : {}),
            country: 'py',
            ...(norm.externalId ? { external_id: norm.externalId } : {})
          });
        }

        const isStandard = [
          'PageView',
          'ViewContent',
          'CustomizeProduct',
          'AddToCart',
          'InitiateCheckout',
          'AddPaymentInfo',
          'Lead',
          'Purchase',
          'Contact'
        ].includes(eventName);

        if (isStandard) {
          w.fbq('track', eventName, customData, { eventID: eventId });
        } else {
          w.fbq('trackCustom', eventName, customData, { eventID: eventId });
        }
        browserFired = true;
      }
    } catch {}
  }

  // 2. Disparar por el Servidor First-Party Meta Conversions API (CAPI) Anti-Bloqueo iOS 14+
  let capiSent = false;
  if (typeof window !== 'undefined' && (trackingCfg.capiServerEnabled ?? true)) {
    try {
      const eventSourceUrl = window.location.href;
      const resp = await fetch('/api/meta-capi/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          eventName,
          eventId,
          eventTime: Math.floor(Date.now() / 1000),
          eventSourceUrl,
          pixelId: effectivePixelId,
          capiAccessToken: trackingCfg.capiAccessToken || '',
          testEventCode: trackingCfg.testEventCode || '',
          productId: product?.id || '',
          productSlug: contentId,
          fbp,
          fbc,
          userData: userData || {},
          customData
        })
      });
      capiSent = resp.ok;
    } catch {}
  }

  return { eventId, browserFired, capiSent };
}
