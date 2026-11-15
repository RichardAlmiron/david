import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Phone,
  MapPin,
  CheckCircle2,
  X,
  Crosshair,
  Plus,
  Minus,
  Pencil,
  Lock,
  ShoppingBag,
  Sun,
  Moon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useStore } from '../context/StoreContext';
import { formatGs, formatWaPhone } from '../config';
import { trackMetaFullFunnelEvent } from '../utils/metaPixelEngine';
import {
  forwardGeocodeParaguayAddress,
  inferParaguayDepartmentFromCity,
  type OrderGpsFuente
} from '../utils/paraguayGeo';
import { validateWhatsAppPhoneFormat } from '../utils/whatsappPhoneValidation';

const DEPARTAMENTOS_PY = [
  'Central',
  'Asunción (Capital)',
  'Alto Paraná',
  'Itapúa',
  'Caaguazú',
  'Cordillera',
  'Guairá',
  'Paraguarí',
  'San Pedro',
  'Concepción',
  'Amambay',
  'Canindeyú',
  'Misiones',
  'Ñeembucú',
  'Presidente Hayes',
  'Boquerón',
  'Alto Paraguay',
  'Caazapá'
];

// Default coordinates by Department in Paraguay only used if device has no GPS sensor at all
const PARAGUAY_DEPT_COORDS: Record<string, { lat: number; lng: number }> = {
  'Central': { lat: -25.2969, lng: -57.5519 },
  'Asunción (Capital)': { lat: -25.2867, lng: -57.6470 },
  'Alto Paraná': { lat: -25.5097, lng: -54.6111 },
  'Itapúa': { lat: -27.3306, lng: -55.8667 },
  'Caaguazú': { lat: -25.4500, lng: -56.0167 },
  'Cordillera': { lat: -25.3861, lng: -57.1408 },
  'Guairá': { lat: -25.7833, lng: -56.4500 },
  'Paraguarí': { lat: -25.6333, lng: -57.1500 },
  'San Pedro': { lat: -24.0917, lng: -57.0833 },
  'Concepción': { lat: -23.4064, lng: -57.4344 },
  'Amambay': { lat: -22.5472, lng: -55.7333 },
  'Canindeyú': { lat: -24.0667, lng: -54.3000 },
  'Misiones': { lat: -26.6667, lng: -57.1167 },
  'Ñeembucú': { lat: -26.8667, lng: -58.3000 },
  'Presidente Hayes': { lat: -25.1667, lng: -57.5500 },
  'Boquerón': { lat: -22.3500, lng: -60.0333 },
  'Alto Paraguay': { lat: -21.0333, lng: -57.8667 },
  'Caazapá': { lat: -26.1958, lng: -56.3681 }
};

function latLngToTilePixel(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const xFloat = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yFloat =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const tileX = Math.floor(xFloat);
  const tileY = Math.floor(yFloat);
  const offsetX = (xFloat - tileX) * 256;
  const offsetY = (yFloat - tileY) * 256;
  return { tileX, tileY, offsetX, offsetY, xFloat, yFloat };
}

function tileFloatToLatLng(xFloat: number, yFloat: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const lng = (xFloat / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * yFloat) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

export const OrderForm: React.FC<{
  expressDirectMode?: boolean;
  hidePrincipalUpgradeHint?: boolean;
  modalOnly?: boolean;
}> = ({
  expressDirectMode = false,
  hidePrincipalUpgradeHint = false,
  modalOnly = false
}) => {
  const {
    config,
    selectedPack,
    setSelectedPack,
    purchasePath,
    setPurchasePath,
    addOrder,
    currentProductPage,
    orderFormFullscreen,
    setOrderFormFullscreen
  } = useStore();

  // "Casa" preselected by default so 90%+ of customers never have to answer an extra gate
  const [tipoVivienda, setTipoVivienda] = useState<'casa' | 'edificio'>('casa');
  const [mapLocked, setMapLocked] = useState<boolean>(true);
  const [nombre, setNombre] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('author_name') || p.get('nombre') || '';
    } catch {
      return '';
    }
  });
  const [celular, setCelular] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('phone') || p.get('whatsapp') || '';
    } catch {
      return '';
    }
  });
  const [departamento, setDepartamento] = useState('');
  // Campos precisos escritos por el cliente (jamás pisados por el mapa GPS): Ciudad, Barrio y Nombre de Calle
  const [ciudadTexto, setCiudadTexto] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('ciudad') || '';
    } catch {
      return '';
    }
  });
  const [barrioTexto, setBarrioTexto] = useState('');
  const [calleTexto, setCalleTexto] = useState('');
  const [ubicacionTexto, setUbicacionTexto] = useState('');
  const [ciudadDetectada, setCiudadDetectada] = useState('');
  const [calleDetectada, setCalleDetectada] = useState('');

  // Optional building details (only shown if customer explicitly switches chip to Edificio)
  const [nombreEdificio, setNombreEdificio] = useState('');
  const [pisoDepartamento, setPisoDepartamento] = useState('');
  const [tieneRecepcion, setTieneRecepcion] = useState<'si_recepcionista' | 'no_personalmente'>('si_recepcionista');

  const [submitting, setSubmitting] = useState(false);
  const [submittingPhase, setSubmittingPhase] = useState<'idle' | 'gps' | 'sending'>('idle');
  const [submitCountdown, setSubmitCountdown] = useState<number>(0);
  const countdownIntervalRef = useRef<number | null>(null);
  const [orderComplete, setOrderComplete] = useState<any | null>(null);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [validationNotice, setValidationNotice] = useState<string>('');
  const [validationField, setValidationField] = useState<'nombre' | 'celular' | 'ciudad' | 'barrio' | 'calle' | null>(null);
  const [leadEventFired, setLeadEventFired] = useState(false);
  const [waVerifyState, setWaVerifyState] = useState<{
    status: 'idle' | 'checking' | 'verified_whatsapp' | 'not_on_whatsapp' | 'invalid_format' | 'format_only';
    checkedPhone: string;
    message?: string;
  }>({ status: 'idle', checkedPhone: '' });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Optional 1-Touch GPS Helper State (Never blocks submission!)
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsConfirmado, setGpsConfirmado] = useState<boolean>(false);
  const [gpsFuente, setGpsFuente] = useState<OrderGpsFuente | undefined>(undefined);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsLiveAccuracy, setGpsLiveAccuracy] = useState<number | null>(null);
  const [gpsBestCoarseAccuracy, setGpsBestCoarseAccuracy] = useState<number | null>(null);
  const [gpsPopupOpen, setGpsPopupOpen] = useState<boolean>(false);
  const [gpsPopupStep, setGpsPopupStep] = useState<'activate' | 'return_retry'>('activate');
  const [gpsPopupReason, setGpsPopupReason] = useState<'gps_off' | 'permission_denied' | 'coarse_only' | 'timeout' | 'unsupported'>('gps_off');
  const [gpsReturnedFromSettings, setGpsReturnedFromSettings] = useState<boolean>(false);
  const [gpsDetectedAddress, setGpsDetectedAddress] = useState<string>('');
  const [gpsNotice, setGpsNotice] = useState<string>('');
  const [mapZoom, setMapZoom] = useState<number>(18);

  const [isDraggingMap, setIsDraggingMap] = useState<boolean>(false);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    startXFloat: number;
    startYFloat: number;
    moved: boolean;
  } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const ciudadInputRef = useRef<HTMLInputElement | null>(null);
  const barrioInputRef = useRef<HTMLInputElement | null>(null);
  const calleInputRef = useRef<HTMLInputElement | null>(null);
  const ubicacionInputRef = useRef<HTMLInputElement | null>(null);
  const step1CardRef = useRef<HTMLDivElement | null>(null);
  const step2CardRef = useRef<HTMLDivElement | null>(null);
  const step3CardRef = useRef<HTMLDivElement | null>(null);
  const ciudadBoxRef = useRef<HTMLDivElement | null>(null);
  const barrioBoxRef = useRef<HTMLDivElement | null>(null);
  const calleBoxRef = useRef<HTMLDivElement | null>(null);
  const submitAreaRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const watchTimeoutRef = useRef<number | null>(null);
  const bestAccuracyRef = useRef<number>(999999);
  const gpsAttemptIdRef = useRef<number>(0);

  // Intelligent auto-scroll helper: ONLY called on blur (when finished & leaving field) or explicit focus, NEVER mid-typing
  const smoothCenterElement = (el: HTMLElement | null) => {
    if (!el || typeof window === 'undefined') return;
    if (scrollTimerRef.current) {
      window.clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }
    scrollTimerRef.current = window.setTimeout(() => {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}
    }, 95);
  };

  const firstName = (nombre || '').trim().split(/\s+/)[0] || '';
  const isBuilding = tipoVivienda === 'edificio';

  const effectivePack = selectedPack > 0 ? selectedPack : 1;
  const targetProductId = currentProductPage?.id || 'prod-noelux-01';
  const targetProductName =
    currentProductPage?.nombre || `${config.marca}™ Proyector Navideño 12 Diseños`;
  const hasEntryHook = Boolean(currentProductPage?.tripwireConfig?.enabled && currentProductPage?.tripwireConfig?.entryProductName);
  const isEntryOnly = hasEntryHook && purchasePath === 'entry_only';
  const entryOfferCfg = currentProductPage?.tripwireConfig;
  const resolvedEntryPrice = Number(
    entryOfferCfg?.entryPriceGs ??
      entryOfferCfg?.entryProductPriceGs ??
      currentProductPage?.precios?.[1] ??
      20000
  );
  const principalTotal =
    currentProductPage?.precios?.[effectivePack] ||
    config.lote[effectivePack] ||
    189000;
  const total = isEntryOnly ? resolvedEntryPrice : principalTotal;
  const entryProductDisplayName = String(
    entryOfferCfg?.entryProductName || targetProductName
  ).trim();
  const orderSubmittedProductName = isEntryOnly
    ? entryProductDisplayName
    : targetProductName;
  const activeOfferTitle = isEntryOnly
    ? entryProductDisplayName
    : hasEntryHook
    ? `${targetProductName} + ${entryProductDisplayName} DE REGALO`
    : targetProductName;

  const gpsLink =
    gpsLat !== null && gpsLng !== null
      ? `https://www.google.com/maps?q=${gpsLat.toFixed(6)},${gpsLng.toFixed(6)}`
      : '';

  const gpsStreetViewLink =
    gpsLat !== null && gpsLng !== null
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${gpsLat.toFixed(6)},${gpsLng.toFixed(6)}`
      : '';

  // Asegurar limpieza de cualquier borrador antiguo en localStorage (sin persistencia en navegador)
  useEffect(() => {
    try {
      localStorage.removeItem('noelux_express_checkout_draft_v2');
    } catch { }
  }, []);

  // Fire Meta InitiateCheckout once as soon as customer starts filling Name + WhatsApp
  // (Canonical Lead is emitted ONLY when the order form completes & server confirms persistence)
  useEffect(() => {
    const digits = celular.replace(/\D/g, '');
    if (!leadEventFired && nombre.trim().length >= 3 && digits.length >= 8) {
      setLeadEventFired(true);
      trackMetaFullFunnelEvent({
        eventName: 'InitiateCheckout',
        product: currentProductPage,
        globalPixelId: config.pixelId,
        packQuantity: effectivePack,
        valueGs: total,
        userData: { nombre: nombre.trim(), celular: celular.trim(), departamento }
      });
    }
  }, [nombre, celular, leadEventFired, currentProductPage, config.pixelId, effectivePack, total, departamento]);

  // Autoverificación en tiempo real del número de WhatsApp (formato Paraguay + consulta en vivo vía Baileys onWhatsApp)
  useEffect(() => {
    const rawDigits = celular.replace(/\D/g, '');
    if (!rawDigits) {
      setWaVerifyState({ status: 'idle', checkedPhone: '' });
      return;
    }

    const fmt = validateWhatsAppPhoneFormat(celular);
    if (!fmt.valid) {
      if (rawDigits.length >= 9 || fmt.reasonCode === 'landline' || fmt.reasonCode === 'fake_sequence') {
        setWaVerifyState({
          status: 'invalid_format',
          checkedPhone: celular,
          message: fmt.message
        });
      } else {
        setWaVerifyState({ status: 'idle', checkedPhone: '' });
      }
      return;
    }

    const controller = new AbortController();
    setWaVerifyState({
      status: 'checking',
      checkedPhone: fmt.normalizedPhone
    });

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/whatsapp/verify-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ phone: celular })
        });
        if (!res.ok) {
          setWaVerifyState({ status: 'format_only', checkedPhone: fmt.normalizedPhone });
          return;
        }
        const data = await res.json();
        if (controller.signal.aborted) return;
        setWaVerifyState({
          status: data?.status || 'format_only',
          checkedPhone: data?.normalizedPhone || fmt.normalizedPhone,
          message: data?.message
        });
      } catch {
        if (!controller.signal.aborted) {
          setWaVerifyState({ status: 'format_only', checkedPhone: fmt.normalizedPhone });
        }
      }
    }, 420);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [celular]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (watchTimeoutRef.current !== null) {
        window.clearTimeout(watchTimeoutRef.current);
      }
      if (countdownIntervalRef.current !== null) {
        window.clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Paraguay geo-bounds + max acceptable hardware GPS accuracy:
  // Strict <= 10m auto-verification so 1000m/2000m cell-tower or IP approximations NEVER pass as exact GPS.
  const MAX_EXACT_GPS_ACCURACY_METERS = 10;
  const isWithinParaguayGpsBounds = (lat: number, lng: number): boolean =>
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -28.0 &&
    lat <= -19.0 &&
    lng >= -63.0 &&
    lng <= -54.0 &&
    !(lat === 0 && lng === 0);

  const verifyExactGpsReading = (
    lat: number,
    lng: number,
    rawAcc: unknown
  ): { valid: boolean; cleanLat: number; cleanLng: number; roundedAcc: number } => {
    const cleanLat = Number(Number(lat).toFixed(6));
    const cleanLng = Number(Number(lng).toFixed(6));
    const parsedAcc = Number(rawAcc);
    const roundedAcc =
      Number.isFinite(parsedAcc) && parsedAcc > 0
        ? Math.max(1, Math.round(parsedAcc))
        : 99999;
    const valid =
      isWithinParaguayGpsBounds(cleanLat, cleanLng) &&
      roundedAcc > 0 &&
      roundedAcc <= MAX_EXACT_GPS_ACCURACY_METERS;
    return { valid, cleanLat, cleanLng, roundedAcc };
  };

  // Detect return from device Location/GPS settings while pop-up is waiting in Step 2
  useEffect(() => {
    if (!gpsPopupOpen || gpsPopupStep !== 'return_retry') return;
    const markReturned = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        setGpsReturnedFromSettings(true);
      }
    };
    window.addEventListener('focus', markReturned);
    document.addEventListener('visibilitychange', markReturned);
    return () => {
      window.removeEventListener('focus', markReturned);
      document.removeEventListener('visibilitychange', markReturned);
    };
  }, [gpsPopupOpen, gpsPopupStep]);

  // Pre-calentamiento silencioso de GPS SOLO si ya tiene permiso concedido Y precisión satelital real (<= 10m)
  useEffect(() => {
    if (gpsConfirmado || gpsLat !== null || orderComplete) return;
    const step1Ready = nombre.trim().length >= 3;
    if (!step1Ready || typeof navigator === 'undefined' || !navigator.geolocation) return;

    let cancelled = false;
    const warmUpPosition = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const verified = verifyExactGpsReading(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy
          );
          if (!verified.valid) {
            // Rechaza coordenadas IP/antena (>10m) para nunca envenenar el pedido con ubicación imprecisa
            return;
          }
          setGpsLat(verified.cleanLat);
          setGpsLng(verified.cleanLng);
          setGpsAccuracy(verified.roundedAcc);
          setGpsConfirmado(true);
          setGpsFuente('gps_dispositivo');
          setMapLocked(true);
          reverseGeocodeCoords(verified.cleanLat, verified.cleanLng);
        },
        () => {
          // Silent ignore
        },
        { enableHighAccuracy: true, timeout: 6500, maximumAge: 0 }
      );
    };

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((perm) => {
          if (!cancelled && perm.state === 'granted') {
            warmUpPosition();
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [nombre, celular, gpsLat, gpsConfirmado, orderComplete]);

  // Smoothly focus first empty input ONLY when explicitly opening the fullscreen modal from a CTA button
  useEffect(() => {
    if (orderFormFullscreen && !orderComplete) {
      const timer = window.setTimeout(() => {
        if (!nombre.trim()) {
          nameInputRef.current?.focus({ preventScroll: true });
        } else if (celular.replace(/\D/g, '').length < 8) {
          phoneInputRef.current?.focus({ preventScroll: true });
        } else if (!ciudadTexto.trim()) {
          ciudadInputRef.current?.focus({ preventScroll: true });
        } else if (!barrioTexto.trim()) {
          barrioInputRef.current?.focus({ preventScroll: true });
        } else {
          calleInputRef.current?.focus({ preventScroll: true });
        }
      }, 120);
      return () => window.clearTimeout(timer);
    }
  }, [orderFormFullscreen, orderComplete]);

  const handleExitFullscreen = () => {
    setOrderFormFullscreen(false);
    setValidationNotice('');
  };

  // Reverse geocoding helper via OpenStreetMap Nominatim (100% Free) to auto-fill city, neighborhood & street
  const reverseGeocodeCoords = async (
    lat: number,
    lng: number,
    timeoutMs = 5000
  ): Promise<{
    detectedSummary: string;
    detectedCityLabel: string;
    detectedStreetLabel: string;
    matchedDep: string;
  } | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`,
        {
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        }
      );
      window.clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      const addr = data?.address || {};
      const road = addr.road || addr.pedestrian || addr.residential || addr.path || '';
      const houseNumber = addr.house_number ? ` N° ${addr.house_number}` : '';
      const suburb = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '';
      const detectedCity =
        addr.city || addr.town || addr.municipality || addr.village || '';
      const detectedState = addr.state || '';

      const summaryParts = [
        detectedCity,
        suburb ? `Barrio ${suburb}` : '',
        road ? `${road}${houseNumber}` : ''
      ].filter(Boolean);

      const detectedSummary =
        summaryParts.join(', ') ||
        String(data?.display_name || '')
          .split(',')
          .slice(0, 3)
          .join(', ')
          .trim();

      const detectedCityLabel = detectedCity
        ? suburb
          ? `${detectedCity} - Barrio ${suburb}`
          : detectedCity
        : '';

      const detectedStreetLabel = [
        road ? `${road}${houseNumber}` : '',
        suburb ? `Barrio ${suburb}` : ''
      ]
        .filter(Boolean)
        .join(', ');

      let matchedDep = '';
      if (detectedState) {
        matchedDep =
          DEPARTAMENTOS_PY.find((d) =>
            d
              .toLowerCase()
              .includes(detectedState.toLowerCase().replace('departamento de ', '').trim())
          ) || '';
      }

      if (detectedSummary) {
        setGpsDetectedAddress(detectedSummary);
        setUbicacionTexto((prev) => (prev.trim().length > 0 ? prev : detectedSummary));
      }
      if (detectedCityLabel) {
        setCiudadDetectada(detectedCityLabel);
      }
      if (detectedStreetLabel) {
        setCalleDetectada(detectedStreetLabel);
      }
      if (matchedDep) {
        setDepartamento(matchedDep);
      }

      return {
        detectedSummary,
        detectedCityLabel,
        detectedStreetLabel,
        matchedDep
      };
    } catch {
      // Fallback gracefully if offline or timed out
      return null;
    }
  };

  // Captura síncrona de alta precisión al enviar el pedido:
  // Jamás acepta coordenadas IP/antena (> 200m) ni fuera de Paraguay como GPS exacto.
  const captureLiveGeolocationForSubmit = (
    timeoutMs = 5200
  ): Promise<{ lat: number; lng: number; acc: number } | null> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      let settled = false;
      let localWatchId: number | null = null;
      let bestFix: { lat: number; lng: number; acc: number } | null = null;
      let watchErrored = false;
      let fastErrored = false;

      const finish = (result: { lat: number; lng: number; acc: number } | null) => {
        if (settled) return;
        settled = true;
        if (localWatchId !== null) {
          try {
            navigator.geolocation.clearWatch(localWatchId);
          } catch { }
          localWatchId = null;
        }
        window.clearTimeout(deadlineTimer);
        resolve(result);
      };

      const onPosition = (pos: GeolocationPosition) => {
        const verified = verifyExactGpsReading(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy
        );

        if (!verified.valid) {
          // Descartar lecturas de antena/IP imprecisas (>10m) para nunca enviar un enlace equivocado como confirmado
          return;
        }

        if (!bestFix || verified.roundedAcc <= bestFix.acc) {
          bestFix = {
            lat: verified.cleanLat,
            lng: verified.cleanLng,
            acc: verified.roundedAcc
          };
        }

        if (verified.roundedAcc <= MAX_EXACT_GPS_ACCURACY_METERS) {
          finish(bestFix);
        }
      };

      const maybeFinishOnError = (err: GeolocationPositionError) => {
        if (err && err.code === 1) {
          finish(bestFix);
          return;
        }
        if (watchErrored && fastErrored) {
          finish(bestFix);
        }
      };

      const deadlineTimer = window.setTimeout(() => {
        finish(bestFix);
      }, timeoutMs);

      try {
        navigator.geolocation.getCurrentPosition(
          onPosition,
          (err) => {
            fastErrored = true;
            maybeFinishOnError(err);
          },
          {
            enableHighAccuracy: true,
            timeout: Math.min(timeoutMs, 4200),
            maximumAge: 0
          }
        );

        localWatchId = navigator.geolocation.watchPosition(
          onPosition,
          (err) => {
            watchErrored = true;
            maybeFinishOnError(err);
          },
          {
            enableHighAccuracy: true,
            timeout: timeoutMs,
            maximumAge: 0
          }
        );
      } catch {
        finish(bestFix);
      }
    });
  };

  const stopGpsWatch = () => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch {}
      watchIdRef.current = null;
    }
    if (watchTimeoutRef.current !== null) {
      window.clearTimeout(watchTimeoutRef.current);
      watchTimeoutRef.current = null;
    }
    setGpsLoading(false);
  };

  // Botón principal de GPS satelital exacto con autoverificación estricta <= 10m (tipo WhatsApp)
  const handleOneClickGpsLocation = () => {
    stopGpsWatch();
    const attemptId = ++gpsAttemptIdRef.current;
    setGpsLoading(true);
    setGpsLiveAccuracy(null);
    setGpsBestCoarseAccuracy(null);
    setGpsNotice('');
    setValidationNotice('');
    bestAccuracyRef.current = 999999;

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([20, 30, 20]);
      }
    } catch { }

    const applyVerifiedCoordinates = (lat: number, lng: number, acc: number) => {
      const verified = verifyExactGpsReading(lat, lng, acc);
      if (!verified.valid) return false;

      stopGpsWatch();
      setGpsLat(verified.cleanLat);
      setGpsLng(verified.cleanLng);
      setGpsAccuracy(verified.roundedAcc);
      setGpsLiveAccuracy(verified.roundedAcc);
      setGpsConfirmado(true);
      setGpsFuente('gps_dispositivo');
      setMapLocked(true);
      setGpsLoading(false);
      setGpsPopupOpen(false);
      setGpsNotice('');
      setMapZoom(18);
      reverseGeocodeCoords(verified.cleanLat, verified.cleanLng);

      trackMetaFullFunnelEvent({
        eventName: 'AddPaymentInfo',
        product: currentProductPage,
        globalPixelId: config.pixelId,
        packQuantity: effectivePack,
        valueGs: total,
        userData: { nombre, celular, ciudad: ciudadDetectada || ciudadTexto || ubicacionTexto, departamento }
      });
      return true;
    };

    const openGpsActivationPopup = (
      reason: 'gps_off' | 'permission_denied' | 'coarse_only' | 'timeout' | 'unsupported',
      coarseAcc?: number
    ) => {
      if (gpsAttemptIdRef.current !== attemptId) return;
      stopGpsWatch();
      setGpsConfirmado(false);
      setGpsAccuracy(null);
      setGpsLiveAccuracy(null);
      if (typeof coarseAcc === 'number') {
        setGpsBestCoarseAccuracy(coarseAcc);
      }
      setGpsPopupReason(reason);
      setGpsPopupStep('activate');
      setGpsReturnedFromSettings(false);
      setGpsPopupOpen(true);
    };

    if (
      typeof window !== 'undefined' &&
      window.isSecureContext === false
    ) {
      openGpsActivationPopup('unsupported');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      openGpsActivationPopup('unsupported');
      return;
    }

    let settled = false;
    let highestCoarseSeen: number | undefined = undefined;
    let getCurrentFailed = false;
    let watchFailed = false;

    const handleIncomingPosition = (pos: GeolocationPosition) => {
      if (settled || gpsAttemptIdRef.current !== attemptId) return;
      const verified = verifyExactGpsReading(
        pos.coords.latitude,
        pos.coords.longitude,
        pos.coords.accuracy
      );

      if (!isWithinParaguayGpsBounds(verified.cleanLat, verified.cleanLng)) {
        return;
      }

      setGpsLiveAccuracy(verified.roundedAcc);

      if (!verified.valid) {
        // Lectura todavía imprecisa (>10m): seguimos esperando que baje como en WhatsApp
        highestCoarseSeen = highestCoarseSeen
          ? Math.min(highestCoarseSeen, verified.roundedAcc)
          : verified.roundedAcc;
        setGpsBestCoarseAccuracy(highestCoarseSeen);
        return;
      }

      // ¡Autoverificación aprobada (<= 10m exactos)!
      settled = true;
      applyVerifiedCoordinates(verified.cleanLat, verified.cleanLng, verified.roundedAcc);
    };

    const handleGeoError = (err: GeolocationPositionError | null, source: 'current' | 'watch') => {
      if (settled || gpsAttemptIdRef.current !== attemptId) return;
      if (source === 'current') getCurrentFailed = true;
      if (source === 'watch') watchFailed = true;

      // Si el error es permiso denegado (1) o GPS apagado/no disponible (2), abrir pop-up de inmediato si ambos fallaron o si es permiso/hardware
      if (err?.code === 1) {
        settled = true;
        openGpsActivationPopup('permission_denied', highestCoarseSeen);
        return;
      }
      if (err?.code === 2 && (watchFailed || getCurrentFailed)) {
        // En muchos móviles getCurrentPosition o watchPosition devuelve POSITION_UNAVAILABLE cuando el GPS está apagado
        if (source === 'watch' || (getCurrentFailed && watchFailed)) {
          settled = true;
          openGpsActivationPopup('gps_off', highestCoarseSeen);
        }
        return;
      }
      if (getCurrentFailed && watchFailed) {
        settled = true;
        const reason =
          typeof highestCoarseSeen === 'number'
            ? 'coarse_only'
            : err?.code === 3
            ? 'timeout'
            : 'gps_off';
        openGpsActivationPopup(reason, highestCoarseSeen);
      }
    };

    try {
      // Disparamos getCurrentPosition + watchPosition en paralelo para máxima compatibilidad en Safari iOS y Chrome Android
      navigator.geolocation.getCurrentPosition(
        handleIncomingPosition,
        (err) => handleGeoError(err, 'current'),
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        }
      );

      const wId = navigator.geolocation.watchPosition(
        handleIncomingPosition,
        (err) => handleGeoError(err, 'watch'),
        {
          enableHighAccuracy: true,
          timeout: 16000,
          maximumAge: 0
        }
      );

      watchIdRef.current = wId;
      watchTimeoutRef.current = window.setTimeout(() => {
        if (settled || gpsAttemptIdRef.current !== attemptId) return;
        settled = true;
        openGpsActivationPopup(
          typeof highestCoarseSeen === 'number' ? 'coarse_only' : 'gps_off',
          highestCoarseSeen
        );
      }, 14500);
    } catch {
      openGpsActivationPopup('gps_off');
    }
  };

  // Botón directo Paso 1 dentro del pop-up: intenta activar el diálogo nativo o abrir Ajustes de Ubicación en Android
  const handlePopupActivateGpsClick = () => {
    setGpsPopupStep('return_retry');
    setGpsReturnedFromSettings(false);

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isAndroid = /android/i.test(ua);
    const isInAppWebView = /FBAN|FBAV|Instagram|WhatsApp|Line|TikTok|wv\)/i.test(ua);
    const isAndroidChrome = isAndroid && /Chrome\/\d+/i.test(ua) && !isInAppWebView;

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const verified = verifyExactGpsReading(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.accuracy
            );
            if (verified.valid) {
              setGpsLat(verified.cleanLat);
              setGpsLng(verified.cleanLng);
              setGpsAccuracy(verified.roundedAcc);
              setGpsLiveAccuracy(verified.roundedAcc);
              setGpsConfirmado(true);
              setGpsFuente('gps_dispositivo');
              setMapLocked(true);
              setGpsPopupOpen(false);
              setGpsNotice('');
              reverseGeocodeCoords(verified.cleanLat, verified.cleanLng);
              return;
            }
            if (isAndroidChrome && isWithinParaguayGpsBounds(verified.cleanLat, verified.cleanLng)) {
              setGpsLiveAccuracy(verified.roundedAcc);
              setGpsBestCoarseAccuracy(verified.roundedAcc);
            }
          },
          (err) => {
            if (isAndroidChrome && err?.code === 2) {
              try {
                const fallbackUrl = encodeURIComponent(window.location.href);
                window.location.href = `intent:#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;S.browser_fallback_url=${fallbackUrl};end`;
              } catch {}
            } else if (err?.code === 1) {
              setGpsPopupReason('permission_denied');
            }
          },
          { enableHighAccuracy: true, timeout: 3500, maximumAge: 0 }
        );
      } catch {
        if (isAndroidChrome) {
          try {
            const fallbackUrl = encodeURIComponent(window.location.href);
            window.location.href = `intent:#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;S.browser_fallback_url=${fallbackUrl};end`;
          } catch {}
        }
      }
    }
  };

  const handleMapPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mapLocked || gpsLat === null || gpsLng === null) return;
    stopGpsWatch();
    const currentTile = latLngToTilePixel(gpsLat, gpsLng, mapZoom);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startXFloat: currentTile.xFloat,
      startYFloat: currentTile.yFloat,
      moved: false
    };
    setIsDraggingMap(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { }
  };

  const handleMapPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingMap || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragStartRef.current.moved = true;
    }
    const newXFloat = dragStartRef.current.startXFloat - dx / 256;
    const newYFloat = dragStartRef.current.startYFloat - dy / 256;
    const nextCoords = tileFloatToLatLng(newXFloat, newYFloat, mapZoom);
    setGpsLat(Number(nextCoords.lat.toFixed(6)));
    setGpsLng(Number(nextCoords.lng.toFixed(6)));
    setGpsAccuracy(4);
    setGpsConfirmado(true);
    setGpsFuente('mapa_manual');
  };

  const handleMapPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || gpsLat === null || gpsLng === null) {
      setIsDraggingMap(false);
      return;
    }
    const wasDragged = dragStartRef.current.moved;
    dragStartRef.current = null;
    setIsDraggingMap(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch { }

    if (wasDragged) {
      reverseGeocodeCoords(gpsLat, gpsLng);
    } else if (mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const deltaPxX = clickX - rect.width / 2;
      const deltaPxY = clickY - rect.height / 2;

      const currentTile = latLngToTilePixel(gpsLat, gpsLng, mapZoom);
      const newXFloat = currentTile.xFloat + deltaPxX / 256;
      const newYFloat = currentTile.yFloat + deltaPxY / 256;
      const nextCoords = tileFloatToLatLng(newXFloat, newYFloat, mapZoom);

      const cleanLat = Number(nextCoords.lat.toFixed(6));
      const cleanLng = Number(nextCoords.lng.toFixed(6));
      setGpsLat(cleanLat);
      setGpsLng(cleanLng);
      setGpsAccuracy(4);
      setGpsConfirmado(true);
      setGpsFuente('mapa_manual');
      reverseGeocodeCoords(cleanLat, cleanLng);
    }
  };

  // Guard ref to prevent duplicate submissions (double-tap, React re-renders, slow networks)
  const submitGuardRef = useRef<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    stopGpsWatch();

    // ── Anti-duplicate guard: block if a submission is already in flight ──
    if (submitGuardRef.current || submitting) return;

    if (nombre.trim().length < 3) {
      setValidationField('nombre');
      setValidationNotice('Escribí primero tu nombre y apellido completo aquí abajo.');
      smoothCenterElement(step1CardRef.current);
      nameInputRef.current?.focus();
      return;
    }

    const waFmt = validateWhatsAppPhoneFormat(celular);
    if (!waFmt.valid) {
      setValidationField('celular');
      setValidationNotice(waFmt.message || 'Escribí un número de WhatsApp válido (ej: 0981 452 890).');
      setWaVerifyState({
        status: 'invalid_format',
        checkedPhone: celular,
        message: waFmt.message
      });
      smoothCenterElement(step3CardRef.current);
      phoneInputRef.current?.focus();
      return;
    }

    if (
      waVerifyState.status === 'not_on_whatsapp' &&
      waVerifyState.checkedPhone === waFmt.normalizedPhone
    ) {
      setValidationField('celular');
      setValidationNotice(
        waVerifyState.message ||
          'Este número NO tiene WhatsApp activo. Revisá los dígitos y escribí tu número real con WhatsApp.'
      );
      smoothCenterElement(step3CardRef.current);
      phoneInputRef.current?.focus();
      return;
    }

    if (waVerifyState.checkedPhone !== waFmt.normalizedPhone || waVerifyState.status === 'checking') {
      try {
        const controller = new AbortController();
        const t = window.setTimeout(() => controller.abort(), 2400);
        const verifyRes = await fetch('/api/whatsapp/verify-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ phone: celular })
        });
        window.clearTimeout(t);
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          setWaVerifyState({
            status: verifyData?.status || 'format_only',
            checkedPhone: verifyData?.normalizedPhone || waFmt.normalizedPhone,
            message: verifyData?.message
          });
          if (verifyData?.status === 'not_on_whatsapp' || verifyData?.status === 'invalid_format') {
            setValidationField('celular');
            setValidationNotice(
              verifyData?.message ||
                'Este número NO es un WhatsApp válido. Revisá los dígitos y escribí un número con WhatsApp.'
            );
            smoothCenterElement(step3CardRef.current);
            phoneInputRef.current?.focus();
            return;
          }
        }
      } catch {}
    }

    if (ciudadTexto.trim().length < 2) {
      setValidationField('ciudad');
      setValidationNotice('Escribí tu ciudad aquí abajo (ej: San Lorenzo, Asunción).');
      smoothCenterElement(ciudadBoxRef.current);
      ciudadInputRef.current?.focus();
      return;
    }

    if (barrioTexto.trim().length < 2) {
      setValidationField('barrio');
      setValidationNotice('Escribí tu barrio o zona aquí abajo.');
      smoothCenterElement(barrioBoxRef.current);
      barrioInputRef.current?.focus();
      return;
    }

    if (calleTexto.trim().length < 2) {
      setValidationField('calle');
      setValidationNotice('Escribí el nombre de tu calle o una referencia (ej: portón blanco).');
      smoothCenterElement(calleBoxRef.current);
      calleInputRef.current?.focus();
      return;
    }

    setValidationField(null);

    // Lock the guard BEFORE any async work
    submitGuardRef.current = true;

    const alreadyHasExactGps = Boolean(gpsConfirmado && gpsLat !== null && gpsLng !== null);
    const liveCiudad = ciudadTexto.trim();
    const rawLiveBarrio = barrioTexto.trim();
    const formattedLiveBarrio = rawLiveBarrio
      ? /^barrio\b/i.test(rawLiveBarrio)
        ? rawLiveBarrio
        : `Barrio ${rawLiveBarrio}`
      : '';
    const liveCalle = calleTexto.trim();
    let resolvedDepartamento = inferParaguayDepartmentFromCity(liveCiudad, departamento);

    // FUNCIÓN 1 DEL BOTÓN PRINCIPAL DUAL (Síncrona al toque del botón para máxima compatibilidad en iPhone Safari / Android Chrome):
    // Capturar la geolocalización exacta del cliente mientras corre la cuenta regresiva de 5 segundos ("Preparando tus datos...").
    const liveGpsPromise = alreadyHasExactGps
      ? Promise.resolve({ lat: gpsLat as number, lng: gpsLng as number, acc: gpsAccuracy ?? 10 })
      : Promise.race([
        captureLiveGeolocationForSubmit(4600),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 4800))
      ]);

    setValidationNotice('');
    setSubmitting(true);
    setSubmittingPhase(alreadyHasExactGps ? 'sending' : 'gps');
    setSubmitCountdown(5);

    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
    }
    const countdownPromise = new Promise<void>((resolve) => {
      let remaining = 5;
      countdownIntervalRef.current = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          setSubmitCountdown(0);
          if (countdownIntervalRef.current !== null) {
            window.clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          resolve();
        } else {
          setSubmitCountdown(remaining);
        }
      }, 1000);
    });

    try {
      let effectiveLat = gpsLat;
      let effectiveLng = gpsLng;
      let effectiveAcc = gpsAccuracy;
      let effectiveConfirmado = alreadyHasExactGps;
      let effectiveGpsFuente: OrderGpsFuente | undefined = alreadyHasExactGps
        ? gpsFuente || 'gps_dispositivo'
        : undefined;

      if (!alreadyHasExactGps) {
        let capturedGps: { lat: number; lng: number; acc: number } | null = null;
        try {
          capturedGps = await liveGpsPromise;
        } catch {
          capturedGps = null;
        }

        if (capturedGps) {
          effectiveLat = capturedGps.lat;
          effectiveLng = capturedGps.lng;
          effectiveAcc = capturedGps.acc;
          effectiveConfirmado = true;
          effectiveGpsFuente = 'gps_dispositivo';
          setGpsLat(capturedGps.lat);
          setGpsLng(capturedGps.lng);
          setGpsAccuracy(capturedGps.acc);
          setGpsConfirmado(true);
          setGpsFuente('gps_dispositivo');
          // IMPORTANTE: JAMÁS consultamos ni pisamos la ciudad, el barrio ni la calle con datos del mapa GPS.
          // El mapa se adjunta exclusivamente como coordenadas/enlace para el repartidor.
        } else {
          // Hardware GPS bloqueado/no disponible: intentar geocodificación honesta de calle/barrio/ciudad durante la espera
          const geoFallback = await forwardGeocodeParaguayAddress(
            {
              calle: liveCalle,
              barrio: formattedLiveBarrio,
              ciudad: liveCiudad,
              departamento: resolvedDepartamento
            },
            2200
          ).catch(() => null);

          if (geoFallback) {
            effectiveLat = Number(geoFallback.lat.toFixed(6));
            effectiveLng = Number(geoFallback.lng.toFixed(6));
            effectiveAcc = null;
            effectiveConfirmado = false;
            effectiveGpsFuente = 'geocodificacion_direccion';
            if (!resolvedDepartamento && geoFallback.matchedDepartment) {
              resolvedDepartamento = geoFallback.matchedDepartment;
            }
          } else {
            effectiveLat = null;
            effectiveLng = null;
            effectiveAcc = null;
            effectiveConfirmado = false;
            effectiveGpsFuente = undefined;
            setGpsConfirmado(false);
          }
        }
      }

      // Esperar a que se complete la cuenta regresiva de 5 segundos ("Preparando tus datos...") antes de disparar el envío final
      await countdownPromise;
      setSubmittingPhase('sending');

      const finalPack = selectedPack > 0 ? selectedPack : 1;

      // 100% DATOS ESCRITOS POR EL CLIENTE EN EL FORMULARIO (CERO DATOS DEL MAPA EN TEXTO E IMÁGENES)
      const finalCiudad = liveCiudad;
      const formattedBarrio = formattedLiveBarrio;
      const finalCalle = liveCalle;

      const baseStreet = [formattedBarrio, finalCalle].filter(Boolean).join(', ');

      const buildingExtra = [
        nombreEdificio.trim() ? `Edificio ${nombreEdificio.trim()}` : '',
        pisoDepartamento.trim() ? `Piso/Dpto. ${pisoDepartamento.trim()}` : ''
      ]
        .filter(Boolean)
        .join(', ');

      const recepSummary =
        tieneRecepcion === 'si_recepcionista'
          ? 'Sí tiene recepción (La recepcionista / guardia recibe el pedido)'
          : 'Sin recepción / Recibe personalmente en planta baja';

      const finalDireccion = isBuilding && buildingExtra
        ? `${baseStreet} (${buildingExtra})`
        : baseStreet;

      const effectiveGpsLink =
        effectiveLat !== null && effectiveLng !== null
          ? `https://www.google.com/maps?q=${effectiveLat.toFixed(6)},${effectiveLng.toFixed(6)}`
          : '';

      const effectiveStreetViewLink =
        effectiveLat !== null && effectiveLng !== null
          ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${effectiveLat.toFixed(6)},${effectiveLng.toFixed(6)}`
          : '';

      const effectiveOrderQuantity = isEntryOnly ? 1 : finalPack;

      // FUNCIÓN 2 DEL BOTÓN DUAL: Enviar los datos escritos por el cliente + el enlace del mapa GPS viajando JUNTOS
      const order = await addOrder({
        productoId: targetProductId,
        producto: orderSubmittedProductName,
        waVendedor: formatWaPhone(currentProductPage?.wa || ''),
        nombre: nombre.trim(),
        celular: celular.trim(),
        departamento: resolvedDepartamento,
        ciudad: finalCiudad,
        barrio: formattedBarrio,
        calle: finalCalle,
        direccion: finalDireccion,
        detalle: 'Pago contra entrega',
        cantidad: effectiveOrderQuantity,
        monto: total,
        ...(hasEntryHook
          ? {
              purchasePath: isEntryOnly ? 'entry_only' : 'principal_bundle',
              purchaseOfferTitle: activeOfferTitle
            }
          : {}),
        ref_code: null,
        estado: 'reservado',
        tipoVivienda,
        ...(isBuilding
          ? {
            nombreEdificio: nombreEdificio.trim() || 'A confirmar por WhatsApp',
            pisoEdificio: pisoDepartamento.trim() || 'A confirmar por WhatsApp',
            departamentoNumero: pisoDepartamento.trim() || '',
            tieneRecepcion,
            detalleRecepcion: recepSummary
          }
          : {}),
        ...(effectiveLat !== null ? { gpsLat: effectiveLat } : {}),
        ...(effectiveLng !== null ? { gpsLng: effectiveLng } : {}),
        ...(effectiveAcc !== null ? { gpsAccuracy: effectiveAcc } : {}),
        ...(effectiveGpsLink ? { gpsLink: effectiveGpsLink } : {}),
        ...(effectiveStreetViewLink ? { gpsStreetViewLink: effectiveStreetViewLink } : {}),
        ...(effectiveGpsFuente ? { gpsFuente: effectiveGpsFuente } : {}),
        gpsConfirmado: effectiveConfirmado
      });

      setOrderComplete(order);
      setShowConfirmPopup(true);

      // Evento canónico ÚNICO del formulario confirmado: `Lead` (nunca Purchase en checkout COD;
      // Purchase se emite únicamente desde el servidor tras entrega física + cobro verificado).
      await trackMetaFullFunnelEvent({
        eventName: 'Lead',
        product: currentProductPage,
        globalPixelId: config.pixelId,
        packQuantity: effectiveOrderQuantity,
        valueGs: total,
        orderId: order.reservaid,
        userData: {
          nombre: nombre.trim(),
          celular: celular.trim(),
          ciudad: finalCiudad,
          departamento: resolvedDepartamento || finalCiudad,
          externalId: order.visitorId || order.reservaid
        }
      });

      if (currentProductPage?.metaTracking?.enabledEvents?.OrderReservedCOD !== false) {
        void trackMetaFullFunnelEvent({
          eventName: 'OrderReservedCOD',
          product: currentProductPage,
          globalPixelId: config.pixelId,
          packQuantity: effectiveOrderQuantity,
          valueGs: total,
          orderId: order.reservaid,
          userData: {
            nombre: nombre.trim(),
            celular: celular.trim(),
            ciudad: finalCiudad,
            departamento: resolvedDepartamento || finalCiudad,
            externalId: order.visitorId || order.reservaid
          }
        });
      }

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch { }
    } catch (err) {
      console.error('Error al procesar reserva:', err);
      setValidationNotice('Ocurrió un error al enviar tu pedido. Por favor intentá de nuevo.');
    } finally {
      if (countdownIntervalRef.current !== null) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setSubmitCountdown(0);
      setSubmitting(false);
      setSubmittingPhase('idle');
      submitGuardRef.current = false;
    }
  };

  const confirmedPackCount = orderComplete?.cantidad || (isEntryOnly ? 1 : effectivePack);
  const confirmedProductTitle =
    orderComplete?.purchaseOfferTitle || orderComplete?.producto || orderSubmittedProductName;
  const confirmedTotalAmount = orderComplete?.monto || total;
  const confirmedClientPhone = orderComplete?.celular || celular;
  const confirmedGpsLink = orderComplete?.gpsLink || gpsLink;

  const tileData =
    gpsLat !== null && gpsLng !== null
      ? latLngToTilePixel(gpsLat, gpsLng, mapZoom)
      : null;

  const renderFormCardContent = (isFullscreenMode: boolean) => {
    const explicitShippingFee =
      !isEntryOnly &&
      currentProductPage?.freeShipping === false &&
      Number(currentProductPage?.shippingCostGs) > 0
        ? Number(currentProductPage.shippingCostGs)
        : 0;
    const totalPayableOnDelivery = total + explicitShippingFee;

    const waFormatCheck = validateWhatsAppPhoneFormat(celular);
    const waHasHardError =
      waVerifyState.status === 'not_on_whatsapp' || waVerifyState.status === 'invalid_format';
    const nombreOk = nombre.trim().length >= 3;
    const celularOk = waFormatCheck.valid && !waHasHardError;
    const ciudadOk = ciudadTexto.trim().length >= 2;
    const barrioOk = barrioTexto.trim().length >= 2;
    const calleOk = calleTexto.trim().length >= 2;

    const missingFields: string[] = [];
    if (!nombreOk) missingFields.push('Nombre');
    if (!celularOk) missingFields.push('WhatsApp válido');
    if (!ciudadOk) missingFields.push('Ciudad');
    if (!barrioOk) missingFields.push('Barrio');
    if (!calleOk) missingFields.push('Calle');
    const isFormReady = missingFields.length === 0;

    const dark = isDarkMode;

    const getFieldBoxClass = (fieldKey: 'nombre' | 'celular' | 'ciudad' | 'barrio' | 'calle', isDone: boolean) => {
      if (validationField === fieldKey || (fieldKey === 'celular' && waHasHardError)) {
        return dark
          ? 'bg-[#450A0A]/45 border-[1.5px] border-[#F87171] ring-[3px] ring-[#F87171]/25 rounded-[8px] px-3.5 py-2.5 transition-all cursor-text'
          : 'bg-[#FEF2F2] border-[1.5px] border-[#DC2626] ring-[3px] ring-[#DC2626]/20 rounded-[8px] px-3.5 py-2.5 transition-all cursor-text';
      }
      if (isDone) {
        return dark
          ? 'bg-[#1E293B] border-[1.5px] border-[#34D399]/70 focus-within:border-[#38BDF8] focus-within:ring-[3px] focus-within:ring-[#38BDF8]/25 rounded-[8px] px-3.5 py-2.5 transition-all cursor-text'
          : 'bg-white border-[1.5px] border-[#15803D]/70 shadow-[inset_0_2px_4px_rgba(15,23,42,0.05)] focus-within:border-[#1773B0] focus-within:ring-[3px] focus-within:ring-[#1773B0]/25 rounded-[8px] px-3.5 py-2.5 transition-all cursor-text';
      }
      return dark
        ? 'bg-[#1E293B] border-[1.5px] border-[#475569] shadow-[inset_0_2px_4px_rgba(0,0,0,0.28)] focus-within:border-[#38BDF8] focus-within:ring-[3px] focus-within:ring-[#38BDF8]/25 rounded-[8px] px-3.5 py-2.5 transition-all cursor-text'
        : 'bg-white border-[1.5px] border-[#64748B] shadow-[inset_0_2px_4px_rgba(15,23,42,0.06)] focus-within:border-[#1773B0] focus-within:ring-[3px] focus-within:ring-[#1773B0]/25 rounded-[8px] px-3.5 py-2.5 transition-all cursor-text';
    };

    const labelClass = dark
      ? 'block text-[13px] leading-[16px] font-semibold text-[#E2E8F0] select-none'
      : 'block text-[13px] leading-[16px] font-semibold text-[#0F172A] select-none';
    const inputTextClass = dark
      ? 'w-full bg-transparent text-[16px] leading-[22px] font-semibold text-[#F8FAFC] placeholder:text-[#94A3B8] outline-none'
      : 'w-full bg-transparent text-[16px] leading-[22px] font-semibold text-[#0F172A] placeholder:text-[#475569] outline-none';
    const doneBadgeClass = dark
      ? 'text-[12px] font-semibold text-[#4ADE80] shrink-0'
      : 'text-[12px] font-semibold text-[#15803D] shrink-0';
    const sectionTitleClass = dark
      ? 'text-[16px] font-bold text-[#F8FAFC]'
      : 'text-[16px] font-bold text-[#0F172A]';
    const iconTintClass = dark ? 'w-4 h-4 text-[#93C5FD] shrink-0' : 'w-4 h-4 text-[#334155] shrink-0';

    return (
      <div
        data-theme-mode={dark ? 'dark' : 'light'}
        className={
          isFullscreenMode
            ? `w-full max-w-[520px] mx-auto max-h-[94dvh] flex flex-col rounded-[10px] border overflow-hidden shadow-[0_22px_55px_rgba(0,0,0,0.34)] ${
                dark ? 'bg-[#0F172A] border-[#334155]' : 'bg-[#EEF2F6] border-[#CBD5E1]'
              }`
            : `w-full max-w-[520px] mx-auto rounded-[10px] border overflow-hidden shadow-[0_4px_20px_rgba(15,23,42,0.08)] ${
                dark ? 'bg-[#0F172A] border-[#334155]' : 'bg-[#EEF2F6] border-[#CBD5E1]'
              }`
        }
      >
        {/* Cabecera Ejecutiva Antirreflejo + Selector Integrado Claro / Oscuro */}
        <div
          className={`px-4 sm:px-5 py-3 border-b shrink-0 space-y-2.5 ${
            dark ? 'bg-[#090D16] border-[#1E293B]' : 'bg-[#111827] border-[#1F2937]'
          }`}
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
                <span className="text-[16px] font-semibold tracking-[-0.01em] text-white leading-snug">
                  Confirmar pedido · Pagás al recibir
                </span>
              </div>
              <p className="text-[13px] text-[#CBD5E1] mt-0.5 leading-snug">
                {isEntryOnly
                  ? 'No pedimos tarjeta · Sin cobro previo online'
                  : 'No pedimos tarjeta · Pagás recién en la puerta de tu casa'}
              </p>
            </div>

            {isFullscreenMode && (
              <button
                type="button"
                onClick={handleExitFullscreen}
                aria-label="Cerrar"
                className="w-9 h-9 rounded-[6px] text-[#CBD5E1] hover:text-white hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div
            data-testid="theme-toggle-tooltip"
            role="region"
            aria-label="Selector de color de lectura"
            className={`rounded-[8px] border px-3 py-2 flex flex-wrap items-center justify-between gap-2 ${
              dark
                ? 'bg-[#111827] border-[#FDE047]/45'
                : 'bg-[#1E293B] border-[#38BDF8]/50'
            }`}
          >
            <span className="text-[12px] leading-snug text-[#E2E8F0]">
              {dark ? (
                <>
                  <span className="font-semibold text-white">Modo oscuro activado.</span>{' '}
                  ¿Preferís el fondo claro?
                </>
              ) : (
                <>
                  <span className="font-semibold text-white">¿Te molesta el color claro?</span>{' '}
                  Tocá el botón para pasar a oscuro
                </>
              )}
            </span>

            <button
              type="button"
              data-testid="toggle-form-theme"
              title={dark ? 'Cambiar a modo claro suave' : 'Cambiar a modo oscuro para descansar la vista'}
              onClick={() => setIsDarkMode((v) => !v)}
              aria-label={dark ? 'Cambiar a modo claro suave' : 'Cambiar a modo oscuro'}
              className={`h-8 px-3 rounded-[6px] border text-white text-[12px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                dark
                  ? 'border-[#FDE047]/55 bg-[#0F172A] hover:bg-[#1773B0]'
                  : 'border-[#38BDF8]/65 bg-[#0F172A] hover:bg-[#1773B0]'
              }`}
            >
              {dark ? <Sun className="w-3.5 h-3.5 text-[#FDE047]" /> : <Moon className="w-3.5 h-3.5 text-[#93C5FD]" />}
              <span>{dark ? 'Modo claro' : 'Modo oscuro'}</span>
            </button>
          </div>
        </div>

        {/* Resumen del Pedido 100% Visible, Descriptivo y Dinámico */}
        {!orderComplete && (() => {
          const selectedQuantity = isEntryOnly ? 1 : effectivePack;
          const baseSingleUnitPrice = isEntryOnly
            ? resolvedEntryPrice
            : Number(currentProductPage?.precios?.[1] || config.lote[1] || 189000);
          const appliedUnitPrice =
            selectedQuantity > 0 ? Math.round(total / selectedQuantity) : baseSingleUnitPrice;
          const hasPackDiscount =
            !isEntryOnly && selectedQuantity > 1 && total < baseSingleUnitPrice * selectedQuantity;
          const packSavings = hasPackDiscount
            ? baseSingleUnitPrice * selectedQuantity - total
            : 0;

          return (
            <div
              data-testid="orderform-dual-path-clarification"
              className={`px-4 sm:px-5 py-3.5 border-b shrink-0 space-y-2.5 ${
                dark ? 'bg-[#1E293B] border-[#334155]' : 'bg-[#E2E8F0] border-[#CBD5E1]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <ShoppingBag className={`w-4 h-4 mt-0.5 shrink-0 ${dark ? 'text-[#38BDF8]' : 'text-[#1773B0]'}`} />
                  <div className="min-w-0">
                    <div className={`text-[11px] font-bold uppercase tracking-[0.04em] ${dark ? 'text-[#93C5FD]' : 'text-[#125C8C]'}`}>
                      Resumen de tu pedido
                    </div>
                    <div className={`text-[15px] font-bold leading-snug break-words ${dark ? 'text-white' : 'text-[#0F172A]'}`}>
                      {activeOfferTitle}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={`text-[11px] font-bold ${dark ? 'text-[#CBD5E1]' : 'text-[#334155]'}`}>
                    {isEntryOnly ? 'Precio del producto' : 'Total al recibir'}
                  </div>
                  <div
                    data-testid="orderform-visible-total"
                    className={`text-[20px] font-extrabold tabular-nums whitespace-nowrap leading-tight ${
                      dark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    {formatGs(totalPayableOnDelivery)}
                  </div>
                </div>
              </div>

              {(!isEntryOnly || (hasEntryHook && entryOfferCfg && !hidePrincipalUpgradeHint)) && (
                <div
                  data-testid="orderform-quantity-breakdown"
                  className={`pt-2.5 border-t space-y-1.5 text-[13px] ${
                    dark ? 'border-[#334155]' : 'border-[#CBD5E1]'
                  }`}
                >
                  {!isEntryOnly && (
                    <>
                      <div className={`flex items-start justify-between gap-2 ${dark ? 'text-[#E2E8F0]' : 'text-[#1E293B]'}`}>
                        <span className="font-medium leading-snug">
                          Precio unitario de este producto
                        </span>
                        <span className={`font-bold tabular-nums shrink-0 ${dark ? 'text-white' : 'text-[#0F172A]'}`}>
                          {formatGs(baseSingleUnitPrice)}
                        </span>
                      </div>

                      <div className={`flex items-start justify-between gap-2 ${dark ? 'text-[#E2E8F0]' : 'text-[#1E293B]'}`}>
                        <span className="font-medium leading-snug">
                          Cantidad que estás pidiendo
                        </span>
                        <span className={`font-bold tabular-nums shrink-0 ${dark ? 'text-white' : 'text-[#0F172A]'}`}>
                          {selectedQuantity === 1 ? '1 unidad' : `${selectedQuantity} unidades`}
                        </span>
                      </div>

                      <div
                        className={`flex items-start justify-between gap-2 rounded-[6px] px-2.5 py-1.5 ${
                          dark ? 'bg-[#0F172A]/70 text-[#F8FAFC]' : 'bg-white/75 text-[#0F172A]'
                        }`}
                      >
                        <span className="font-semibold leading-snug">
                          Equivale a {selectedQuantity} {selectedQuantity === 1 ? 'unidad' : 'unidades'} × {formatGs(appliedUnitPrice)}
                          {hasPackDiscount && (
                            <span className={`block text-[11px] font-medium ${dark ? 'text-[#4ADE80]' : 'text-[#15803D]'}`}>
                              Precio pack aplicado · ahorrás {formatGs(packSavings)}
                            </span>
                          )}
                        </span>
                        <span className="font-extrabold tabular-nums shrink-0">
                          = {formatGs(total)}
                        </span>
                      </div>

                      <div className={`flex items-center justify-between gap-2 pt-0.5 ${dark ? 'text-[#CBD5E1]' : 'text-[#334155]'}`}>
                        <span className="font-medium">Envío a domicilio</span>
                        <span
                          className={`font-bold tabular-nums shrink-0 ${
                            explicitShippingFee > 0
                              ? dark
                                ? 'text-white'
                                : 'text-[#0F172A]'
                              : dark
                              ? 'text-[#4ADE80]'
                              : 'text-[#15803D]'
                          }`}
                        >
                          {explicitShippingFee > 0 ? formatGs(explicitShippingFee) : 'Gratis'}
                        </span>
                      </div>
                    </>
                  )}

                  {hasEntryHook && entryOfferCfg && isEntryOnly && !hidePrincipalUpgradeHint && (
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => setPurchasePath('principal_bundle')}
                        className={`text-[12px] font-bold hover:underline cursor-pointer text-left ${
                          dark ? 'text-[#38BDF8]' : 'text-[#125C8C]'
                        }`}
                      >
                        Cambiar al paquete completo ({targetProductName} + {entryOfferCfg.entryProductName} de regalo)
                      </button>
                    </div>
                  )}

                  {hasEntryHook && entryOfferCfg && !isEntryOnly && !hidePrincipalUpgradeHint && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPurchasePath('entry_only');
                          setSelectedPack(1);
                        }}
                        className={`text-[12px] font-semibold underline cursor-pointer text-left ${
                          dark ? 'text-[#CBD5E1] hover:text-white' : 'text-[#334155] hover:text-[#0F172A]'
                        }`}
                      >
                        Llevar solo {entryOfferCfg.entryProductName} ({formatGs(resolvedEntryPrice)})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Cuerpo Principal Mate Antirreflejo con Contraste Real */}
        <div
          className={
            isFullscreenMode
              ? `flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 ${dark ? 'bg-[#0F172A]' : 'bg-[#EEF2F6]'}`
              : `px-4 sm:px-5 py-4 space-y-4 ${dark ? 'bg-[#0F172A]' : 'bg-[#EEF2F6]'}`
          }
        >
          {/* Selector Descriptivo de Cantidad (Solo si aplica paquete principal) */}
          {!orderComplete && !isEntryOnly && (
            <div className="space-y-1.5">
              <div className={`text-[13px] font-bold ${dark ? 'text-[#E2E8F0]' : 'text-[#0F172A]'}`}>
                Elegí la cantidad que querés pedir:
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((packNum) => {
                  const packPrice =
                    currentProductPage?.precios?.[packNum] ||
                    config.lote[packNum] ||
                    189000;
                  const isSelected = effectivePack === packNum;
                  return (
                    <button
                      key={packNum}
                      type="button"
                      onClick={() => setSelectedPack(packNum)}
                      className={`px-2.5 py-2 rounded-[8px] border-[1.5px] text-left transition-colors cursor-pointer ${
                        isSelected
                          ? dark
                            ? 'bg-[#172554]/60 border-[#38BDF8] ring-1 ring-[#38BDF8] text-white'
                            : 'bg-white border-[#1773B0] ring-1 ring-[#1773B0] text-[#0F172A]'
                          : dark
                          ? 'bg-[#1E293B] border-[#475569] text-[#E2E8F0] hover:border-[#64748B]'
                          : 'bg-white/80 border-[#94A3B8] text-[#1E293B] hover:border-[#64748B]'
                      }`}
                    >
                      <div className={`text-[13px] font-bold leading-tight ${dark ? 'text-white' : 'text-[#0F172A]'}`}>
                        {packNum === 1 ? '1 unidad' : `${packNum} unidades`}
                      </div>
                      <div className={`text-[12px] font-semibold tabular-nums mt-0.5 ${dark ? 'text-[#CBD5E1]' : 'text-[#334155]'}`}>
                        {formatGs(packPrice)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aviso de Validación Claro */}
          {validationNotice && (
            <div
              className={`border-[1.5px] rounded-[8px] px-3.5 py-2.5 text-[14px] font-semibold flex items-center justify-between gap-2 ${
                dark
                  ? 'bg-[#450A0A] border-[#F87171] text-[#FECACA]'
                  : 'bg-[#FEF2F2] border-[#DC2626] text-[#991B1B]'
              }`}
            >
              <span>{validationNotice}</span>
              <button
                type="button"
                onClick={() => {
                  setValidationNotice('');
                  setValidationField(null);
                }}
                className="p-1 cursor-pointer shrink-0"
                aria-label="Cerrar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {orderComplete ? (
            /* Confirmación Estilo Shopify Order Status */
            <div className="py-3 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full border-2 border-[#1773B0] text-[#1773B0] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className={`text-[13px] font-medium ${dark ? 'text-[#CBD5E1]' : 'text-[#334155]'}`}>
                    Pedido #{orderComplete.reservaid}
                  </p>
                  <h3 className={`text-[18px] font-bold ${dark ? 'text-white' : 'text-[#0F172A]'}`}>
                    ¡Gracias{firstName ? `, ${firstName}` : ''}! Tu pedido está confirmado
                  </h3>
                </div>
              </div>

              <div
                className={`rounded-[8px] border-[1.5px] p-4 space-y-2 text-[14px] ${
                  dark ? 'bg-[#1E293B] border-[#334155]' : 'bg-white border-[#94A3B8]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`font-semibold ${dark ? 'text-white' : 'text-[#0F172A]'}`}>
                    {confirmedProductTitle}
                  </span>
                  <span className={`font-bold tabular-nums shrink-0 ${dark ? 'text-white' : 'text-[#0F172A]'}`}>
                    {formatGs(confirmedTotalAmount)}
                  </span>
                </div>
                <div className={`text-[13px] font-medium ${dark ? 'text-[#CBD5E1]' : 'text-[#334155]'}`}>
                  {isEntryOnly
                    ? 'Pagás al recibir'
                    : `Cantidad: ${confirmedPackCount} ${confirmedPackCount > 1 ? 'unidades' : 'unidad'} · Pagás al recibir`}
                </div>
                {confirmedGpsLink && (
                  <div className={`text-[13px] font-semibold ${dark ? 'text-[#38BDF8]' : 'text-[#1773B0]'}`}>
                    ✓ Ubicación GPS adjuntada
                  </div>
                )}
              </div>

              <p className={`text-[14px] leading-relaxed ${dark ? 'text-[#CBD5E1]' : 'text-[#334155]'}`}>
                En instantes te escribimos por WhatsApp al{' '}
                <span className={`font-bold ${dark ? 'text-white' : 'text-[#0F172A]'}`}>{confirmedClientPhone}</span> para avisarte cuándo sale tu repartidor.
              </p>

              {isFullscreenMode && (
                <button
                  type="button"
                  onClick={handleExitFullscreen}
                  className="w-full h-[50px] bg-[#1773B0] hover:bg-[#125C8C] text-white font-semibold text-[15px] rounded-[8px] transition-colors cursor-pointer"
                >
                  Seguir viendo la tienda
                </button>
              )}
            </div>
          ) : (
            /* Formulario Shopify Accesible con Cajas Táctiles Inconfundibles */
            <form onSubmit={handleSubmit} noValidate className="space-y-4" data-testid="express-order-form">

              {/* 1. Tus datos */}
              <section className="space-y-2.5">
                <h3 className={sectionTitleClass}>
                  1. Tus datos
                </h3>

                <div
                  ref={step1CardRef}
                  data-testid="step-card-nombre"
                  onClick={() => nameInputRef.current?.focus()}
                  className={getFieldBoxClass('nombre', nombreOk)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="checkout-nombre"
                      className={labelClass}
                    >
                      Tu nombre y apellido
                    </label>
                    {nombreOk && (
                      <span className={doneBadgeClass}>✓ Listo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 pt-1.5">
                    <User className={iconTintClass} />
                    <input
                      id="checkout-nombre"
                      ref={nameInputRef}
                      type="text"
                      autoComplete="name"
                      value={nombre}
                      onChange={(e) => {
                        setNombre(e.target.value);
                        if (validationField === 'nombre') {
                          setValidationField(null);
                          setValidationNotice('');
                        }
                      }}
                      onBlur={(e) => {
                        if (e.currentTarget.value.trim().length >= 3 && !celularOk) {
                          smoothCenterElement(step3CardRef.current);
                        }
                      }}
                      placeholder="Ej: Juan Carlos López"
                      className={inputTextClass}
                    />
                  </div>
                </div>

                <div
                  ref={step3CardRef}
                  data-testid="step-card-whatsapp"
                  onClick={() => phoneInputRef.current?.focus()}
                  className={getFieldBoxClass('celular', celularOk)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="checkout-whatsapp"
                      className={labelClass}
                    >
                      Tu número de WhatsApp (sin +595)
                    </label>
                    {waVerifyState.status === 'checking' ? (
                      <span className={`text-[12px] font-semibold ${dark ? 'text-[#93C5FD]' : 'text-[#125C8C]'}`}>
                        Verificando WhatsApp...
                      </span>
                    ) : waVerifyState.status === 'verified_whatsapp' && celularOk ? (
                      <span className={doneBadgeClass}>✓ WhatsApp verificado</span>
                    ) : celularOk ? (
                      <span className={doneBadgeClass}>✓ Formato válido</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2.5 pt-1.5">
                    <Phone className={iconTintClass} />
                    <input
                      id="checkout-whatsapp"
                      ref={phoneInputRef}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={celular}
                      onChange={(e) => {
                        setCelular(e.target.value);
                        if (validationField === 'celular') {
                          setValidationField(null);
                          setValidationNotice('');
                        }
                      }}
                      onFocus={() => smoothCenterElement(step3CardRef.current)}
                      onBlur={(e) => {
                        const val = e.currentTarget.value;
                        const fmt = validateWhatsAppPhoneFormat(val);
                        if (!fmt.valid && val.replace(/\D/g, '').length > 0) {
                          setWaVerifyState({
                            status: 'invalid_format',
                            checkedPhone: val,
                            message: fmt.message
                          });
                        } else if (fmt.valid && !ciudadOk) {
                          smoothCenterElement(step2CardRef.current);
                        }
                      }}
                      placeholder="Ej: 0981 452 890"
                      className={inputTextClass}
                    />
                  </div>
                  {(waVerifyState.status === 'not_on_whatsapp' || waVerifyState.status === 'invalid_format') &&
                    waVerifyState.message && (
                      <p
                        data-testid="whatsapp-verify-feedback"
                        className={`mt-2 text-[12.5px] font-semibold leading-snug ${
                          dark ? 'text-[#FCA5A5]' : 'text-[#B91C1C]'
                        }`}
                      >
                        {waVerifyState.message}
                      </p>
                    )}
                </div>
              </section>

              {/* 2. Dirección de entrega */}
              <section
                ref={step2CardRef}
                data-testid="step-card-ubicacion"
                className="space-y-2.5 pt-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className={sectionTitleClass}>
                    2. Dónde te enviamos
                  </h3>

                  <div
                    className={`inline-flex rounded-[6px] p-0.5 border text-[13px] font-semibold ${
                      dark ? 'bg-[#1E293B] border-[#475569]' : 'bg-[#CBD5E1] border-[#94A3B8]'
                    }`}
                  >
                    <button
                      type="button"
                      data-testid="btn-vivienda-casa"
                      onClick={() => setTipoVivienda('casa')}
                      className={`px-3 py-1 rounded-[4px] transition-all cursor-pointer whitespace-nowrap ${
                        !isBuilding
                          ? dark
                            ? 'bg-[#1773B0] text-white shadow-xs'
                            : 'bg-white text-[#0F172A] shadow-xs'
                          : dark
                          ? 'text-[#CBD5E1] hover:text-white'
                          : 'text-[#334155] hover:text-[#0F172A]'
                      }`}
                    >
                      Casa
                    </button>
                    <button
                      type="button"
                      data-testid="btn-vivienda-edificio"
                      onClick={() => setTipoVivienda('edificio')}
                      className={`px-3 py-1 rounded-[4px] transition-all cursor-pointer whitespace-nowrap ${
                        isBuilding
                          ? dark
                            ? 'bg-[#1773B0] text-white shadow-xs'
                            : 'bg-white text-[#0F172A] shadow-xs'
                          : dark
                          ? 'text-[#CBD5E1] hover:text-white'
                          : 'text-[#334155] hover:text-[#0F172A]'
                      }`}
                    >
                      Edificio
                    </button>
                  </div>
                </div>

                {/* Botón GPS Prominente y Principal (Primero en Sección de Entrega) */}
                {!gpsConfirmado && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      data-testid="btn-capture-gps"
                      disabled={gpsLoading}
                      onClick={handleOneClickGpsLocation}
                      className={`w-full rounded-[8px] border-[1.5px] px-3.5 py-3 flex items-center justify-between gap-3 text-left transition-all cursor-pointer disabled:opacity-85 ${
                        dark
                          ? 'bg-[#172554]/55 border-[#38BDF8] hover:bg-[#172554]/80 text-white'
                          : 'bg-[#F0F7FC] border-[#1773B0] hover:bg-[#E0F0FA] text-[#0F172A]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 ${
                            dark ? 'bg-[#38BDF8] text-[#0F172A]' : 'bg-[#1773B0] text-white'
                          }`}
                        >
                          <Crosshair className={`w-5 h-5 ${gpsLoading ? 'animate-spin' : ''}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[15px] font-bold leading-snug">
                            {gpsLoading
                              ? gpsLiveAccuracy !== null
                                ? `Calibrando GPS: ±${gpsLiveAccuracy}m (meta ≤ 10m)`
                                : 'Buscando señal GPS satelital...'
                              : 'Enviar mi ubicación GPS exacta'}
                          </div>
                          <div className={`text-[12px] font-medium mt-0.5 leading-snug ${dark ? 'text-[#CBD5E1]' : 'text-[#334155]'}`}>
                            {gpsLoading
                              ? 'Igual que en WhatsApp: esperando que baje a 5m–10m sin moverte...'
                              : 'Principal: tocá aquí para marcar tu casa en 1 toque (precisión ≤ 10m)'}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1.5 rounded-[6px] text-[12px] font-bold shrink-0 ${
                          dark ? 'bg-[#38BDF8] text-[#0F172A]' : 'bg-[#1773B0] text-white'
                        }`}
                      >
                        {gpsLoading ? 'Midiendo' : 'Activar GPS'}
                      </span>
                    </button>

                    {/* Barra visual estilo WhatsApp mientras converge la precisión hasta ≤ 10m */}
                    {gpsLoading && (
                      <div
                        data-testid="gps-live-calibration-bar"
                        className={`rounded-[8px] border px-3.5 py-2.5 space-y-1.5 ${
                          dark
                            ? 'bg-[#0F172A] border-[#38BDF8]/40 text-[#E2E8F0]'
                            : 'bg-[#F8FAFC] border-[#93C5FD] text-[#0F172A]'
                        }`}
                      >
                        {(() => {
                          const acc = gpsLiveAccuracy ?? 1500;
                          const pct =
                            acc <= 10
                              ? 100
                              : acc <= 25
                              ? 84
                              : acc <= 60
                              ? 66
                              : acc <= 150
                              ? 46
                              : acc <= 500
                              ? 28
                              : 14;
                          return (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] font-semibold">
                                <span>
                                  {gpsLiveAccuracy !== null
                                    ? `Precisión actual: ±${gpsLiveAccuracy} metros`
                                    : 'Conectando con satélites GPS...'}
                                </span>
                                <span className={dark ? 'text-[#38BDF8]' : 'text-[#125C8C]'}>
                                  Meta: bajar a ≤ 10m (5m–10m)
                                </span>
                              </div>
                              <div className={`w-full h-2 rounded-full overflow-hidden ${dark ? 'bg-[#1E293B]' : 'bg-[#E2E8F0]'}`}>
                                <div
                                  className="h-full bg-[#1773B0] transition-all duration-500 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className={`text-[11px] leading-snug ${dark ? 'text-[#CBD5E1]' : 'text-[#475569]'}`}>
                                Igual que cuando enviás ubicación por WhatsApp: no aceptamos señales de antena a 1000m o 2000m, esperamos hasta que baje a 10 metros o menos.
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {gpsNotice && (
                  <p
                    className={`text-[13px] font-semibold border-[1.5px] rounded-[8px] px-3.5 py-2.5 ${
                      dark
                        ? 'bg-[#1E293B] border-[#FBBF24]/60 text-[#FEF08A]'
                        : 'bg-[#FFFBEB] border-[#D97706] text-[#92400E]'
                    }`}
                  >
                    {gpsNotice}
                  </p>
                )}

                {gpsLat !== null && gpsLng !== null && tileData && (
                  <div className="rounded-[8px] overflow-hidden border-[1.5px] border-[#1773B0] bg-[#111827] select-none">
                    <div className="bg-[#111827] text-white px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[12px] font-semibold">
                      <span className="flex items-start gap-1.5 min-w-0">
                        <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${gpsConfirmado ? 'text-emerald-400' : 'text-amber-400'}`} />
                        <span className="leading-snug">
                          {gpsConfirmado
                            ? `GPS exacto adjuntado${gpsAccuracy ? ` (±${gpsAccuracy}m)` : ''}`
                            : 'Arrastrá el pin hasta tu casa y tocá Fijar'}
                        </span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={handleOneClickGpsLocation}
                          className="px-2 py-1 rounded bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Actualizar
                        </button>
                        <button
                          type="button"
                          onClick={() => setMapLocked(!mapLocked)}
                          className="px-2.5 py-1 rounded bg-white text-[#111827] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {mapLocked ? (
                            <>
                              <Pencil className="w-3 h-3" />
                              <span>Ajustar</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>Fijar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="relative w-full h-36 overflow-hidden">
                      <div
                        ref={mapContainerRef}
                        onPointerDown={!mapLocked ? handleMapPointerDown : undefined}
                        onPointerMove={!mapLocked ? handleMapPointerMove : undefined}
                        onPointerUp={!mapLocked ? handleMapPointerUp : undefined}
                        className={`relative w-full h-full overflow-hidden ${
                          mapLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing touch-none'
                        }`}
                      >
                        <div
                          className="absolute"
                          style={{
                            left: `calc(50% - ${tileData.offsetX + 256}px)`,
                            top: `calc(50% - ${tileData.offsetY + 256}px)`,
                            width: '768px',
                            height: '768px'
                          }}
                        >
                          {[-1, 0, 1].map((dy) =>
                            [-1, 0, 1].map((dx) => {
                              const tx = tileData.tileX + dx;
                              const ty = tileData.tileY + dy;
                              return (
                                <React.Fragment key={`${tx}-${ty}-${mapZoom}`}>
                                  <img
                                    src={`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${mapZoom}/${ty}/${tx}`}
                                    alt="Mapa satelital"
                                    draggable={false}
                                    className="absolute w-[256px] h-[256px] max-w-none pointer-events-none"
                                    style={{
                                      left: `${(dx + 1) * 256}px`,
                                      top: `${(dy + 1) * 256}px`
                                    }}
                                  />
                                  <img
                                    src={`https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/${mapZoom}/${ty}/${tx}`}
                                    alt=""
                                    draggable={false}
                                    className="absolute w-[256px] h-[256px] max-w-none pointer-events-none opacity-95"
                                    style={{
                                      left: `${(dx + 1) * 256}px`,
                                      top: `${(dy + 1) * 256}px`
                                    }}
                                  />
                                </React.Fragment>
                              );
                            })
                          )}
                        </div>

                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-[#1773B0] border-2 border-white shadow-md flex items-center justify-center text-white">
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>

                      {!mapLocked && (
                        <div className="absolute bottom-2 left-2 right-2 bg-[#111827]/90 text-white text-[11px] font-medium px-2.5 py-1 rounded flex items-center justify-between z-20">
                          <span>Arrastrá el mapa hasta tu casa</span>
                          <button
                            type="button"
                            onClick={() => setMapLocked(true)}
                            className="bg-white text-[#111827] font-semibold px-2 py-0.5 rounded cursor-pointer"
                          >
                            Listo
                          </button>
                        </div>
                      )}

                      <div className="absolute top-2 right-2 flex flex-col gap-1 z-20">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMapZoom((z) => Math.min(19, z + 1));
                          }}
                          className="w-7 h-7 rounded bg-[#111827]/85 text-white border border-white/25 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMapZoom((z) => Math.max(14, z - 1));
                          }}
                          className="w-7 h-7 rounded bg-[#111827]/85 text-white border border-white/25 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* En celular va en 1 columna ancha para evitar errores de dedo o vista */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div
                    ref={ciudadBoxRef}
                    onClick={() => ciudadInputRef.current?.focus()}
                    className={getFieldBoxClass('ciudad', ciudadOk)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="checkout-ciudad"
                        className={labelClass}
                      >
                        Tu ciudad
                      </label>
                      {ciudadOk && (
                        <span className={doneBadgeClass}>✓</span>
                      )}
                    </div>
                    <input
                      id="checkout-ciudad"
                      ref={ciudadInputRef}
                      type="text"
                      data-testid="input-ciudad"
                      autoComplete="address-level2"
                      value={ciudadTexto}
                      onChange={(e) => {
                        setCiudadTexto(e.target.value);
                        if (validationField === 'ciudad') {
                          setValidationField(null);
                          setValidationNotice('');
                        }
                      }}
                      onFocus={() => smoothCenterElement(ciudadBoxRef.current)}
                      onBlur={(e) => {
                        if (e.currentTarget.value.trim().length >= 2 && !barrioOk) {
                          smoothCenterElement(barrioBoxRef.current);
                        }
                      }}
                      placeholder="Ej: San Lorenzo, Asunción"
                      className={`${inputTextClass} pt-1.5`}
                    />
                  </div>

                  <div
                    ref={barrioBoxRef}
                    onClick={() => barrioInputRef.current?.focus()}
                    className={getFieldBoxClass('barrio', barrioOk)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="checkout-barrio"
                        className={labelClass}
                      >
                        Tu barrio o zona
                      </label>
                      {barrioOk && (
                        <span className={doneBadgeClass}>✓</span>
                      )}
                    </div>
                    <input
                      id="checkout-barrio"
                      ref={barrioInputRef}
                      type="text"
                      data-testid="input-barrio"
                      value={barrioTexto}
                      onChange={(e) => {
                        setBarrioTexto(e.target.value);
                        if (validationField === 'barrio') {
                          setValidationField(null);
                          setValidationNotice('');
                        }
                      }}
                      onFocus={() => smoothCenterElement(barrioBoxRef.current)}
                      onBlur={(e) => {
                        if (e.currentTarget.value.trim().length >= 2 && !calleOk) {
                          smoothCenterElement(calleBoxRef.current);
                        }
                      }}
                      placeholder="Ej: Barrio Centro, San Miguel"
                      className={`${inputTextClass} pt-1.5`}
                    />
                  </div>
                </div>

                <div
                  ref={calleBoxRef}
                  onClick={() => calleInputRef.current?.focus()}
                  className={getFieldBoxClass('calle', calleOk)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="checkout-calle"
                      className={labelClass}
                    >
                      Tu calle y referencia
                    </label>
                    {calleOk && (
                      <span className={doneBadgeClass}>✓ Listo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 pt-1.5">
                    <MapPin className={iconTintClass} />
                    <input
                      id="checkout-calle"
                      ref={calleInputRef}
                      type="text"
                      data-testid="input-calle"
                      autoComplete="street-address"
                      value={calleTexto}
                      onChange={(e) => {
                        setCalleTexto(e.target.value);
                        if (validationField === 'calle') {
                          setValidationField(null);
                          setValidationNotice('');
                        }
                      }}
                      onFocus={() => smoothCenterElement(calleBoxRef.current)}
                      onBlur={(e) => {
                        if (e.currentTarget.value.trim().length >= 2) {
                          smoothCenterElement(submitAreaRef.current);
                        }
                      }}
                      placeholder={
                        isBuilding
                          ? 'Ej: Av. Mcal. López casi San Martín'
                          : 'Ej: Calle España casi Ruta 2, portón blanco'
                      }
                      className={inputTextClass}
                    />
                  </div>
                </div>

                {/* Campos de Edificio (solo cuando se selecciona Edificio) */}
                {isBuilding && (
                  <div className="space-y-2 pt-0.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div
                        className={`border-[1.5px] rounded-[8px] px-3 py-2 ${
                          dark
                            ? 'bg-[#1E293B] border-[#475569] focus-within:border-[#38BDF8]'
                            : 'bg-white border-[#64748B] focus-within:border-[#1773B0]'
                        }`}
                      >
                        <label className={`block text-[12px] font-semibold ${dark ? 'text-[#E2E8F0]' : 'text-[#0F172A]'}`}>
                          Edificio (opcional)
                        </label>
                        <input
                          type="text"
                          value={nombreEdificio}
                          onChange={(e) => setNombreEdificio(e.target.value)}
                          placeholder="Nombre"
                          className={`w-full bg-transparent text-[15px] font-semibold outline-none pt-1 ${
                            dark ? 'text-white placeholder:text-[#94A3B8]' : 'text-[#0F172A] placeholder:text-[#475569]'
                          }`}
                        />
                      </div>
                      <div
                        className={`border-[1.5px] rounded-[8px] px-3 py-2 ${
                          dark
                            ? 'bg-[#1E293B] border-[#475569] focus-within:border-[#38BDF8]'
                            : 'bg-white border-[#64748B] focus-within:border-[#1773B0]'
                        }`}
                      >
                        <label className={`block text-[12px] font-semibold ${dark ? 'text-[#E2E8F0]' : 'text-[#0F172A]'}`}>
                          Piso / Dpto.
                        </label>
                        <input
                          type="text"
                          value={pisoDepartamento}
                          onChange={(e) => setPisoDepartamento(e.target.value)}
                          placeholder="Ej: 4B"
                          className={`w-full bg-transparent text-[15px] font-semibold outline-none pt-1 ${
                            dark ? 'text-white placeholder:text-[#94A3B8]' : 'text-[#0F172A] placeholder:text-[#475569]'
                          }`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[13px]">
                      <button
                        type="button"
                        onClick={() => setTieneRecepcion('si_recepcionista')}
                        className={`py-2 px-3 rounded-[6px] border-[1.5px] font-semibold cursor-pointer ${
                          tieneRecepcion === 'si_recepcionista'
                            ? dark
                              ? 'bg-[#172554]/60 border-[#38BDF8] text-white'
                              : 'bg-white border-[#1773B0] text-[#0F172A]'
                            : dark
                            ? 'bg-[#1E293B] border-[#475569] text-[#CBD5E1]'
                            : 'bg-white/80 border-[#94A3B8] text-[#334155]'
                        }`}
                      >
                        Recibe portería
                      </button>
                      <button
                        type="button"
                        onClick={() => setTieneRecepcion('no_personalmente')}
                        className={`py-2 px-3 rounded-[6px] border-[1.5px] font-semibold cursor-pointer ${
                          tieneRecepcion === 'no_personalmente'
                            ? dark
                              ? 'bg-[#172554]/60 border-[#38BDF8] text-white'
                              : 'bg-white border-[#1773B0] text-[#0F172A]'
                            : dark
                            ? 'bg-[#1E293B] border-[#475569] text-[#CBD5E1]'
                            : 'bg-white/80 border-[#94A3B8] text-[#334155]'
                        }`}
                      >
                        Recibo personalmente
                      </button>
                    </div>
                  </div>
                )}

              </section>

              {/* 3. Botón Oficial Shopify Checkout CTA con Guía Explícita y Bloqueo si Faltan Datos */}
              <div ref={submitAreaRef} className="pt-1.5 space-y-2">
                {!submitting && (
                  <p
                    data-testid="submit-readiness-hint"
                    className={`text-center text-[13px] font-semibold ${
                      isFormReady
                        ? dark
                          ? 'text-[#93C5FD]'
                          : 'text-[#125C8C]'
                        : dark
                        ? 'text-[#FBBF24]'
                        : 'text-[#B45309]'
                    }`}
                  >
                    {isFormReady
                      ? 'Tocá el botón azul de abajo para enviar tu información 👇'
                      : `Completá todos los datos para activar el botón (falta: ${missingFields.join(', ')})`}
                  </p>
                )}

                {submitting ? (
                  <div
                    data-testid="btn-dual-submit-order"
                    className="w-full rounded-[8px] bg-[#1773B0] text-white py-3.5 px-4 flex flex-col items-center justify-center gap-1.5"
                  >
                    <div className="flex items-center justify-center gap-2 text-[15px] font-semibold">
                      <Crosshair className="w-4 h-4 animate-spin shrink-0" />
                      <span>
                        Confirmando tu pedido{firstName ? `, ${firstName}` : ''}...{' '}
                        {submitCountdown > 0 ? `${submitCountdown}s` : 'Listo'}
                      </span>
                    </div>
                    <div className="w-3/4 max-w-xs h-1 bg-white/25 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-1000 ease-linear"
                        style={{
                          width: `${Math.min(100, Math.max(10, ((5 - submitCountdown) / 5) * 100))}%`
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    type="submit"
                    data-testid="btn-dual-submit-order"
                    disabled={!isFormReady || submitting}
                    aria-disabled={!isFormReady || submitting}
                    className={`w-full h-[54px] font-semibold text-[16px] tracking-[-0.01em] px-5 rounded-[8px] shadow-xs transition-all flex items-center justify-center gap-2 ${
                      isFormReady
                        ? 'bg-[#1773B0] hover:bg-[#125C8C] active:scale-[0.99] text-white cursor-pointer'
                        : dark
                        ? 'bg-[#334155] text-[#94A3B8] border border-[#475569] cursor-not-allowed'
                        : 'bg-[#94A3B8] text-white/95 cursor-not-allowed'
                    }`}
                  >
                    <Lock className="w-4 h-4 opacity-90 shrink-0" />
                    <span>Confirmar pedido ahora</span>
                  </button>
                )}

                <p className={`text-center text-[13px] font-medium ${dark ? 'text-[#CBD5E1]' : 'text-[#334155]'}`}>
                  Revisás tu paquete antes de abonar · Garantía directa 7 días
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {orderFormFullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Finalizar compra"
          className="fixed inset-0 z-[95] w-screen h-[100dvh] bg-black/55 backdrop-blur-[2px] flex flex-col justify-center items-center p-2 sm:p-4 overflow-hidden animate-fadeIn"
        >
          {renderFormCardContent(true)}
        </div>
      )}

      {showConfirmPopup && orderComplete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="relative w-full max-w-[440px] bg-white rounded-[10px] border border-[#E5E5E5] shadow-2xl overflow-hidden p-5 sm:p-6">
            <button
              type="button"
              onClick={() => {
                setShowConfirmPopup(false);
                setOrderFormFullscreen(false);
              }}
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-[6px] hover:bg-[#F5F5F5] flex items-center justify-center text-[#707070] cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full border-2 border-[#1773B0] text-[#1773B0] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[12px] text-[#707070]">
                  Pedido #{orderComplete.reservaid}
                </p>
                <h3 className="text-[17px] font-semibold text-[#111827]">
                  ¡Pedido confirmado!
                </h3>
              </div>
            </div>

            <div className="bg-[#F5F5F5] border border-[#E6E6E6] rounded-[6px] p-3.5 space-y-2 text-[13px]">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-[#111827] leading-snug">
                  {confirmedProductTitle}
                </span>
                <span className="font-semibold text-[#111827] tabular-nums shrink-0">
                  {formatGs(confirmedTotalAmount)}
                </span>
              </div>

              <div className="border-t border-[#E6E6E6] pt-2 text-[12px] text-[#555555]">
                {isEntryOnly
                  ? 'Pago contra entrega'
                  : `${confirmedPackCount} ${confirmedPackCount > 1 ? 'unidades' : 'unidad'} · Pago contra entrega`}
              </div>
            </div>

            <p className="mt-3.5 text-[13px] text-[#555555] leading-relaxed">
              Nuestro equipo ya te está escribiendo a tu WhatsApp{' '}
              <span className="font-semibold text-[#111827]">{confirmedClientPhone}</span> para coordinar la entrega.
            </p>

            <button
              type="button"
              onClick={() => {
                setShowConfirmPopup(false);
                setOrderFormFullscreen(false);
              }}
              className="mt-4 w-full h-[44px] bg-[#1773B0] hover:bg-[#125C8C] text-white font-semibold text-[14px] rounded-[6px] transition-colors cursor-pointer"
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {gpsPopupOpen && !gpsConfirmado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Activá tu GPS urgente para encontrar tu casa"
          data-testid="gps-activation-popup"
          className="fixed inset-0 z-[115] flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-[2px] animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-[460px] max-h-[92dvh] overflow-y-auto bg-white rounded-[12px] border border-[#CBD5E1] shadow-2xl p-5 sm:p-6 text-[#0F172A]">
            <button
              type="button"
              onClick={() => setGpsPopupOpen(false)}
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-[6px] hover:bg-[#F1F5F9] flex items-center justify-center text-[#475569] cursor-pointer"
              aria-label="Cerrar aviso de GPS"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3 pr-7">
              <div className="w-11 h-11 rounded-[10px] bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] flex items-center justify-center shrink-0">
                <Crosshair className="w-5 h-5" />
              </div>
              <div>
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#DC2626] bg-[#FEE2E2] px-2 py-0.5 rounded mb-1">
                  Urgente para tu envío
                </span>
                <h3 className="text-[17px] sm:text-[18px] font-bold text-[#0F172A] leading-snug">
                  {gpsPopupReason === 'permission_denied'
                    ? 'Tu navegador bloqueó el acceso a tu GPS'
                    : gpsPopupReason === 'coarse_only'
                    ? 'Tu GPS está apagado (solo dio señal aproximada)'
                    : '¡Tu GPS está apagado! Necesitamos activarlo'}
                </h3>
              </div>
            </div>

            <div className="mt-3.5 rounded-[8px] bg-[#FFFBEB] border border-[#F59E0B] p-3.5 text-[13px] leading-relaxed text-[#78350F]">
              <p className="font-bold text-[#92400E]">
                ¿Por qué es urgente encender tu GPS?
              </p>
              <p className="mt-1">
                Sin tu ubicación GPS exacta, <strong>no vamos a poder encontrar tu casa para el courier</strong> y tu pedido se puede atrasar o perder.
                {gpsBestCoarseAccuracy !== null && gpsBestCoarseAccuracy > MAX_EXACT_GPS_ACCURACY_METERS && (
                  <>
                    {' '}Ahora mismo tu celular solo detectó antena a <strong>±{gpsBestCoarseAccuracy} metros</strong> (como 1000m o 2000m a la redonda, y eso no nos sirve).
                  </>
                )}
              </p>
            </div>

            {/* Explicación visual estilo WhatsApp: bajar hasta 5m–10m */}
            <div className="mt-3 rounded-[8px] bg-[#F0F9FF] border border-[#BAE6FD] p-3.5 text-[12.5px] leading-relaxed text-[#0C4A6E]">
              <p className="font-bold text-[#075985]">
                Igual que cuando ubicás por WhatsApp (hasta 5m – 10m):
              </p>
              <p className="mt-1">
                Cuando prendés tu GPS y tocás el botón, el mapa va afinando los metros automáticamente hasta bajar a un <strong>mínimo de 10 metros</strong> (ideal <strong>5 a 10 metros</strong>). Recién ahí se autoverifica y marca el frente exacto de tu casa.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px] font-bold">
                <div className="rounded bg-[#FEE2E2] text-[#991B1B] py-1 px-1.5">1000m–2000m ❌</div>
                <div className="rounded bg-[#FEF3C7] text-[#92400E] py-1 px-1.5">50m–100m ⏳</div>
                <div className="rounded bg-[#DCFCE7] text-[#166534] py-1 px-1.5">5m–10m ✅</div>
              </div>
            </div>

            {gpsPopupStep === 'activate' ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-[8px] bg-[#F8FAFC] border border-[#CBD5E1] p-3.5 text-[13px] space-y-2 text-[#1E293B]">
                  <p className="font-bold text-[#0F172A]">
                    Seguí estos 2 pasos rápidos:
                  </p>
                  <p>
                    <strong>1.</strong> Tocá el botón azul de abajo para <strong>activar tu GPS / Ubicación</strong> (en celular podés deslizar arriba y encender <em>Ubicación</em>, o darle <em>Permitir</em>).
                  </p>
                  <p>
                    <strong>2.</strong> Al volver aquí, tocá una vez más para <strong>juntar tu GPS exacto</strong> (≤ 10 metros).
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="btn-popup-activate-gps"
                  onClick={handlePopupActivateGpsClick}
                  className="w-full min-h-[50px] py-3 px-4 rounded-[8px] bg-[#1773B0] hover:bg-[#125C8C] text-white font-bold text-[15px] shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Crosshair className="w-5 h-5 shrink-0" />
                  <span>1. Activar mi GPS ahora</span>
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div
                  className={`rounded-[8px] border p-3.5 text-[13px] leading-relaxed ${
                    gpsReturnedFromSettings
                      ? 'bg-[#ECFDF5] border-[#10B981] text-[#065F46]'
                      : 'bg-[#EFF6FF] border-[#3B82F6] text-[#1E3A8A]'
                  }`}
                >
                  <p className="font-bold">
                    {gpsReturnedFromSettings
                      ? '¡Perfecto, ya volviste! Ahora tocá el botón de abajo otra vez'
                      : '¿Ya encendiste tu GPS o permitiste la ubicación?'}
                  </p>
                  <p className="mt-1">
                    Tocá ahora <strong>"2. Juntar mi GPS ahora"</strong> para que empiece a bajar los metros como en WhatsApp hasta <strong>5m–10m</strong> y quede adjuntado al pedido.
                  </p>
                </div>

                {gpsLoading && (
                  <div className="rounded-[8px] border border-[#93C5FD] bg-[#F8FAFC] px-3.5 py-2.5 text-[12px] font-semibold text-[#0F172A] space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {gpsLiveAccuracy !== null
                          ? `Bajando precisión: ±${gpsLiveAccuracy}m`
                          : 'Buscando satélite GPS...'}
                      </span>
                      <span className="text-[#125C8C]">Meta: ≤ 10m</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                      <div
                        className="h-full bg-[#1773B0] transition-all duration-500 rounded-full"
                        style={{
                          width: `${
                            gpsLiveAccuracy === null
                              ? 15
                              : gpsLiveAccuracy <= 10
                              ? 100
                              : gpsLiveAccuracy <= 30
                              ? 82
                              : gpsLiveAccuracy <= 100
                              ? 58
                              : 28
                          }%`
                        }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  data-testid="btn-popup-retry-gps"
                  disabled={gpsLoading}
                  onClick={handleOneClickGpsLocation}
                  className="w-full min-h-[50px] py-3 px-4 rounded-[8px] bg-[#15803D] hover:bg-[#166534] disabled:opacity-75 text-white font-bold text-[15px] shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Crosshair className={`w-5 h-5 shrink-0 ${gpsLoading ? 'animate-spin' : ''}`} />
                  <span>
                    {gpsLoading
                      ? 'Juntando tu GPS exacto...'
                      : '2. Tocá otra vez para juntar mi GPS'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handlePopupActivateGpsClick}
                  className="w-full py-2 text-[12px] font-semibold text-[#1773B0] hover:underline cursor-pointer"
                >
                  Volver a intentar abrir ajustes de GPS
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setGpsPopupOpen(false);
                setGpsNotice(
                  'Recordá activar tu GPS antes de enviar para que el courier encuentre tu casa sin demoras (precisión ≤ 10m).'
                );
              }}
              className="mt-3 w-full py-2 text-center text-[12px] font-medium text-[#64748B] hover:text-[#0F172A] cursor-pointer"
            >
              Cerrar y completar dirección manualmente por ahora
            </button>
          </div>
        </div>
      )}

      {!modalOnly && (
        <section
          id="pedido"
          className={
            expressDirectMode
              ? 'py-3 sm:py-5 max-w-[500px] mx-auto px-3 sm:px-4'
              : 'py-8 sm:py-12 max-w-[540px] mx-auto app-container'
          }
        >
          {renderFormCardContent(false)}
        </section>
      )}
    </>
  );
};
