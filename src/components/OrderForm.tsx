import React, { useState, useEffect, useRef } from 'react';
import {
  Truck,
  User,
  Phone,
  MapPin,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  X,
  PackageCheck,
  Sparkles,
  Crosshair,
  Plus,
  Minus,
  Pencil,
  Lock,
  Unlock,
  ShieldCheck,
  ArrowDown,
  ArrowRight
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

export const OrderForm: React.FC<{ expressDirectMode?: boolean }> = ({
  expressDirectMode = false
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

  const [pago, setPago] = useState('Efectivo al recibir');
  const [submitting, setSubmitting] = useState(false);
  const [submittingPhase, setSubmittingPhase] = useState<'idle' | 'gps' | 'sending'>('idle');
  const [submitCountdown, setSubmitCountdown] = useState<number>(0);
  const countdownIntervalRef = useRef<number | null>(null);
  const [orderComplete, setOrderComplete] = useState<any | null>(null);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [validationNotice, setValidationNotice] = useState<string>('');
  const [leadEventFired, setLeadEventFired] = useState(false);

  // Optional 1-Touch GPS Helper State (Never blocks submission!)
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsConfirmado, setGpsConfirmado] = useState<boolean>(false);
  const [gpsFuente, setGpsFuente] = useState<OrderGpsFuente | undefined>(undefined);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
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
  const watchIdRef = useRef<number | null>(null);
  const watchTimeoutRef = useRef<number | null>(null);
  const bestAccuracyRef = useRef<number>(999999);

  const firstName = (nombre || '').trim().split(/\s+/)[0] || '';
  const isBuilding = tipoVivienda === 'edificio';

  const effectivePack = selectedPack > 0 ? selectedPack : 1;
  const targetProductId = currentProductPage?.id || 'prod-noelux-01';
  const targetProductName =
    currentProductPage?.nombre || `${config.marca}™ Proyector Navideño 12 Diseños`;
  const hasEntryHook = Boolean(currentProductPage?.tripwireConfig?.enabled && currentProductPage?.tripwireConfig?.entryProductName);
  const isEntryOnly = hasEntryHook && purchasePath === 'entry_only';
  const entryOfferCfg = currentProductPage?.tripwireConfig;
  const principalTotal =
    currentProductPage?.precios?.[effectivePack] ||
    config.lote[effectivePack] ||
    189000;
  const total = isEntryOnly
    ? Number(entryOfferCfg?.entryPriceGs || 20000)
    : principalTotal;
  const activeOfferTitle = isEntryOnly
    ? String(entryOfferCfg?.entryProductName || targetProductName)
    : hasEntryHook
    ? `${targetProductName} + ${entryOfferCfg?.entryProductName} DE REGALO`
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

  // Pre-calentamiento silencioso de GPS cuando el permiso ya está concedido (cero popups)
  useEffect(() => {
    if (gpsConfirmado || gpsLat !== null || orderComplete) return;
    const step2Ready = nombre.trim().length >= 3 && celular.replace(/\D/g, '').length >= 8;
    if (!step2Ready || typeof navigator === 'undefined' || !navigator.geolocation) return;

    let cancelled = false;
    const warmUpPosition = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const cleanLat = Number(pos.coords.latitude.toFixed(6));
          const cleanLng = Number(pos.coords.longitude.toFixed(6));
          const roundedAcc = Math.max(3, Math.round(pos.coords.accuracy || 40));
          setGpsLat(cleanLat);
          setGpsLng(cleanLng);
          setGpsAccuracy(roundedAcc);
          setGpsConfirmado(true);
          setGpsFuente('gps_dispositivo');
          setMapLocked(true);
          reverseGeocodeCoords(cleanLat, cleanLng);
        },
        () => {
          // Silent ignore
        },
        { enableHighAccuracy: false, timeout: 4500, maximumAge: 300000 }
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

  // Synchronous user-gesture GPS acquisition for the Dual-Function Submit Button:
  // Captures the sharpest high-accuracy GPS fix within `timeoutMs` and NEVER throws or blocks lead submission if denied.
  const captureLiveGeolocationForSubmit = (
    timeoutMs = 4600
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
        const cleanLat = Number(pos.coords.latitude.toFixed(6));
        const cleanLng = Number(pos.coords.longitude.toFixed(6));
        const roundedAcc = Math.max(3, Math.round(pos.coords.accuracy || 40));

        if (!bestFix || roundedAcc <= bestFix.acc) {
          bestFix = { lat: cleanLat, lng: cleanLng, acc: roundedAcc };
        }

        // Resolve immediately as soon as we lock a crisp rooftop/street-level GPS fix (<= 25m)
        if (roundedAcc <= 25) {
          finish(bestFix);
        }
      };

      const maybeFinishOnError = (err: GeolocationPositionError) => {
        // Code 1 = PERMISSION_DENIED -> abort immediately without stalling
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
        // Fast cached/Wi-Fi/cell fix resolves in <150ms if browser/device has one
        navigator.geolocation.getCurrentPosition(
          onPosition,
          (err) => {
            fastErrored = true;
            maybeFinishOnError(err);
          },
          {
            enableHighAccuracy: false,
            timeout: Math.min(timeoutMs, 3500),
            maximumAge: 300000
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
            maximumAge: 60000
          }
        );
      } catch {
        finish(bestFix);
      }
    });
  };

  const stopGpsWatch = () => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (watchTimeoutRef.current !== null) {
      window.clearTimeout(watchTimeoutRef.current);
      watchTimeoutRef.current = null;
    }
    setGpsLoading(false);
  };

  // Optional 1-Touch GPS Shortcut: fills location automatically if granted, NEVER blocks customer if denied!
  const handleOneClickGpsLocation = () => {
    stopGpsWatch();
    setGpsLoading(true);
    setGpsNotice('');
    setValidationNotice('');
    bestAccuracyRef.current = 999999;

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([20, 30, 20]);
      }
    } catch { }

    const applyCoordinates = (lat: number, lng: number, acc: number) => {
      const cleanLat = Number(lat.toFixed(6));
      const cleanLng = Number(lng.toFixed(6));
      const roundedAcc = Math.max(3, Math.round(acc));

      setGpsLat(cleanLat);
      setGpsLng(cleanLng);
      setGpsAccuracy(roundedAcc);
      setGpsConfirmado(true);
      setGpsFuente('gps_dispositivo');
      setMapLocked(true);
      setGpsLoading(false);
      setMapZoom(18);
      reverseGeocodeCoords(cleanLat, cleanLng);

      trackMetaFullFunnelEvent({
        eventName: 'AddPaymentInfo',
        product: currentProductPage,
        globalPixelId: config.pixelId,
        packQuantity: effectivePack,
        valueGs: total,
        userData: { nombre, celular, ciudad: ciudadDetectada || ciudadTexto || ubicacionTexto, departamento }
      });
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      let receivedAnyFix = false;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy || 60;
          if (!receivedAnyFix || acc < bestAccuracyRef.current) {
            receivedAnyFix = true;
            bestAccuracyRef.current = Math.min(bestAccuracyRef.current, acc);
            applyCoordinates(lat, lng, acc);
          }
        },
        () => {},
        { enableHighAccuracy: false, timeout: 4500, maximumAge: 180000 }
      );

      const wId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy || 50;

          if (!receivedAnyFix || acc <= bestAccuracyRef.current || acc <= 25) {
            receivedAnyFix = true;
            bestAccuracyRef.current = Math.min(bestAccuracyRef.current, acc);
            applyCoordinates(lat, lng, acc);
          }

          if (acc <= 14) {
            stopGpsWatch();
          }
        },
        () => {
          if (receivedAnyFix) {
            stopGpsWatch();
            return;
          }
          stopGpsWatch();
          // Never block or place fake pin on denial — simply invite typing City/Neighborhood
          setGpsNotice('No hay problema: escribí tu Ciudad, Barrio y Calle arriba y al confirmar buscaremos el mapa automáticamente.');
          ciudadInputRef.current?.focus();
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 30000
        }
      );

      watchIdRef.current = wId;
      watchTimeoutRef.current = window.setTimeout(() => {
        stopGpsWatch();
      }, 6500);
    } else {
      setGpsLoading(false);
      setGpsNotice('Tu navegador bloqueó el GPS automático: completá tu Ciudad, Barrio y Calle y ubicamos tu zona al confirmar.');
      ciudadInputRef.current?.focus();
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

    if (!nombre.trim()) {
      setValidationNotice('Por favor escribí tu Nombre Completo (Nombre y Apellido).');
      nameInputRef.current?.focus();
      return;
    }

    const cleanDigits = celular.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 8) {
      setValidationNotice('Por favor ingresá un número de WhatsApp válido (ej: 0981 123 456).');
      phoneInputRef.current?.focus();
      return;
    }

    if (!ciudadTexto.trim()) {
      setValidationNotice('Por favor escribí el nombre de tu Ciudad.');
      ciudadInputRef.current?.focus();
      return;
    }

    if (!barrioTexto.trim()) {
      setValidationNotice('Por favor escribí el nombre de tu Barrio.');
      barrioInputRef.current?.focus();
      return;
    }

    if (!calleTexto.trim()) {
      setValidationNotice('Por favor escribí el nombre de tu Calle.');
      calleInputRef.current?.focus();
      return;
    }

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

      // FUNCIÓN 2 DEL BOTÓN DUAL: Enviar los datos escritos por el cliente + el enlace del mapa GPS viajando JUNTOS
      const order = await addOrder({
        productoId: targetProductId,
        producto: targetProductName,
        waVendedor: formatWaPhone(currentProductPage?.wa || ''),
        nombre: nombre.trim(),
        celular: celular.trim(),
        departamento: resolvedDepartamento,
        ciudad: finalCiudad,
        barrio: formattedBarrio,
        calle: finalCalle,
        direccion: finalDireccion,
        detalle: pago,
        cantidad: isEntryOnly ? 1 : finalPack,
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
        packQuantity: finalPack,
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
          packQuantity: finalPack,
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

  const confirmedPackCount = orderComplete?.cantidad || effectivePack;
  const confirmedProductTitle = orderComplete?.producto || targetProductName;
  const confirmedTotalAmount = orderComplete?.monto || total;
  const confirmedClientPhone = orderComplete?.celular || celular;
  const confirmedGpsLink = orderComplete?.gpsLink || gpsLink;

  const tileData =
    gpsLat !== null && gpsLng !== null
      ? latLngToTilePixel(gpsLat, gpsLng, mapZoom)
      : null;

  const renderFormCardContent = (isFullscreenMode: boolean) => {
    // ── Step Progress Tracking & Progressive Unlocking for Low-Vision Guided Flow ──
    const step1Done = nombre.trim().length >= 3;
    const step2Done = step1Done && celular.replace(/\D/g, '').length >= 8;
    const ciudadDone = step2Done && ciudadTexto.trim().length >= 2;
    const barrioDone = ciudadDone && barrioTexto.trim().length >= 2;
    const calleDone = barrioDone && calleTexto.trim().length >= 2;
    const step3Done = ciudadDone && barrioDone && calleDone;
    const activeStep = !step1Done ? 1 : !step2Done ? 2 : 3;

    return (
      <div
        className={
          isFullscreenMode
            ? 'w-full max-w-xl mx-auto max-h-[96dvh] flex flex-col bg-white sm:rounded-3xl sm:border-4 sm:border-[#e8b23a] shadow-[0_25px_70px_rgba(0,0,0,0.65)] overflow-hidden'
            : 'bg-white rounded-3xl border-4 border-[#0b3d2e] shadow-2xl overflow-hidden'
        }
      >
        {/* ═══ Enhanced Header Bar (Letra Grande Alta Visibilidad) ═══ */}
        <div className="bg-gradient-to-r from-[#041a12] via-[#0b3d2e] to-[#041a12] text-white py-3.5 sm:py-4 px-4 sm:px-6 flex items-center justify-between gap-2 border-b-2 border-[#e8b23a] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-3.5 h-3.5 rounded-full bg-[#25D366] animate-pulse shrink-0" />
            <div className="min-w-0">
              <span className="text-sm sm:text-base font-black uppercase tracking-wide text-[#ffd778] block truncate">
                {expressDirectMode ? '⚡ Pedido Express Directo · Pago al Recibir' : 'Pedido Fácil · Pago al Recibir'}
              </span>
              <span className="text-xs sm:text-sm text-emerald-200 font-extrabold block truncate">
                {expressDirectMode ? 'Captura GPS Automática · Confirmación en 30 seg' : 'Letra Grande · Guía Paso a Paso'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isFullscreenMode && (
              <span className="text-xs sm:text-sm bg-[#1ea856] px-3 py-1 rounded-full text-white font-black">
                Envío Gratis
              </span>
            )}
            {isFullscreenMode && (
              <button
                type="button"
                onClick={handleExitFullscreen}
                aria-label="Cerrar formulario"
                className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white font-black text-sm px-3.5 py-2 rounded-xl border-2 border-white/40 cursor-pointer transition-all"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
                <span>Cerrar</span>
              </button>
            )}
          </div>
        </div>

        {/* ═══ TRUST BAR — Alta legibilidad ═══ */}
        {!orderComplete && (
          <div className="bg-[#062319] border-b border-[#1ea856]/40 px-3 py-2.5 flex items-center justify-center gap-3 sm:gap-5 shrink-0 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-emerald-300">
              <ShieldCheck className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
              <span>Pago al Recibir</span>
            </span>
            <span className="w-px h-4 bg-emerald-700" />
            <span className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-emerald-300">
              <Truck className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
              <span>Envío Gratis</span>
            </span>
            <span className="w-px h-4 bg-emerald-700" />
            <span className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-emerald-300">
              <CheckCircle2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
              <span>Garantía 7 Días</span>
            </span>
          </div>
        )}

        {/* Main Form Body */}
        <div
          className={
            isFullscreenMode
              ? 'flex-1 overflow-y-auto p-4 sm:p-6 space-y-4'
              : 'p-4 sm:p-7 space-y-4'
          }
        >
          {/* ═══ STEP PROGRESS BAR — Guía visual paso a paso en letra grande ═══ */}
          {!orderComplete && (
            <div className="flex items-center justify-center gap-0 px-2 sm:px-6 pb-1">
              {[
                { num: 1, label: '1. Nombre', done: step1Done },
                { num: 2, label: '2. WhatsApp', done: step2Done },
                { num: 3, label: '3. Dirección', done: step3Done }
              ].map((step, idx) => (
                <React.Fragment key={step.num}>
                  {idx > 0 && (
                    <div className={`h-1.5 flex-1 rounded-full mx-2 transition-all duration-700 ${(idx === 1 && step1Done) || (idx === 2 && step2Done)
                      ? 'bg-[#16a34a]' : 'bg-stone-300'
                      }`} />
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-base sm:text-lg font-black border-3 transition-all duration-500 ${step.done
                      ? 'bg-[#16a34a] border-[#16a34a] text-white scale-105'
                      : activeStep === step.num
                        ? 'bg-red-600 border-red-300 text-white shadow-lg scale-110'
                        : 'bg-stone-200 border-stone-300 text-stone-500'
                      }`}>
                      {step.done ? <CheckCircle2 className="w-6 h-6" /> : step.num}
                    </div>
                    <span className={`text-xs sm:text-sm font-black transition-colors duration-300 ${step.done ? 'text-[#16a34a]' : activeStep === step.num ? 'text-red-700' : 'text-stone-500'
                      }`}>
                      {step.label}
                    </span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* ═══ AVISO TRANSPARENTE DE OPCIÓN ELEGIDA (SOLO COMPLEMENTO VS EQUIPO COMPLETO) ═══ */}
          {!orderComplete && hasEntryHook && entryOfferCfg && (
            <div
              data-testid="orderform-dual-path-clarification"
              className={`rounded-2xl border-2 p-3.5 text-xs sm:text-sm space-y-2 ${
                isEntryOnly
                  ? 'bg-amber-50 border-amber-400 text-stone-900'
                  : 'bg-emerald-50 border-emerald-500 text-stone-900'
              }`}
            >
              <div className="font-black">
                {isEntryOnly
                  ? `Opción seleccionada: SOLO ${entryOfferCfg.entryProductName} (${formatGs(entryOfferCfg.entryPriceGs)})`
                  : `Opción seleccionada: ${targetProductName} + ${entryOfferCfg.entryProductName} DE REGALO`}
              </div>
              <p className="text-stone-700 leading-snug">
                {isEntryOnly
                  ? `Aclaración importante: esta opción NO incluye ${targetProductName}. Delivery según zona: ${formatGs(
                      entryOfferCfg.deliveryFeeGs || 40000
                    )}.`
                  : `Incluye ${targetProductName} completo + ${entryOfferCfg.entryProductName} GRATIS + Envío Gratis directo a tu puerta (sin lista de espera).`}
              </p>
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                {isEntryOnly ? (
                  <button
                    type="button"
                    onClick={() => setPurchasePath('principal_bundle')}
                    className="text-xs font-bold text-[#062319] underline cursor-pointer"
                  >
                    Cambiar al equipo completo (con envío gratis + {entryOfferCfg.entryProductName} incluido)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPurchasePath('entry_only');
                      setSelectedPack(1);
                    }}
                    className="text-xs font-semibold text-stone-600 underline cursor-pointer"
                  >
                    Preferir pedir solo {entryOfferCfg.entryProductName} ({formatGs(entryOfferCfg.entryPriceGs)})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ═══ PACK SELECTOR — Con números y precios grandes ═══ */}
          {!orderComplete && !isEntryOnly && (
            <div className="bg-gradient-to-br from-[#f8f6f0] to-[#f0ede4] border-2 border-[#dfdad0] rounded-2xl p-3">
              <div className="flex items-center justify-between text-sm sm:text-base font-black uppercase text-stone-800 mb-2.5 px-1">
                <span>Elegí tu cantidad:</span>
                <span className="text-[#0a7a4a]">🚚 Envío Gratis</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((packNum) => {
                  const packPrice =
                    currentProductPage?.precios?.[packNum] ||
                    config.lote[packNum] ||
                    189000;
                  const normalPrice = config.normal || 249000;
                  const isSelected = effectivePack === packNum;
                  const packBadge = packNum === 2 ? '🔥 Más Pedido' : packNum === 3 ? '💰 Mejor Precio' : null;
                  return (
                    <button
                      key={packNum}
                      type="button"
                      onClick={() => setSelectedPack(packNum)}
                      className={`relative p-2.5 sm:p-3 rounded-xl border-3 text-center transition-all cursor-pointer ${isSelected
                        ? 'bg-[#062319] border-[#e8b23a] text-white shadow-lg scale-[1.03]'
                        : 'bg-white border-stone-300 text-stone-900 hover:border-[#0b3d2e]'
                        }`}
                    >
                      {packBadge && (
                        <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] sm:text-xs font-black px-2.5 py-0.5 rounded-full whitespace-nowrap z-10 ${isSelected
                          ? 'bg-[#e8b23a] text-[#062319]'
                          : packNum === 2 ? 'bg-red-600 text-white' : 'bg-[#16a34a] text-white'
                          }`}>
                          {packBadge}
                        </span>
                      )}
                      <div
                        className={`text-sm sm:text-base font-black leading-tight mt-0.5 ${isSelected ? 'text-[#ffd778]' : 'text-[#062319]'
                          }`}
                      >
                        {packNum === 1 ? '1 Unidad' : `Pack ${packNum}X`}
                      </div>
                      {packNum > 1 && (
                        <div className="text-xs line-through text-stone-400 font-bold">
                          {formatGs(normalPrice * packNum)}
                        </div>
                      )}
                      <div
                        className={`text-sm sm:text-base font-black ${packNum > 1 ? '' : 'mt-1'} ${isSelected ? 'text-white' : 'text-stone-800'
                          }`}
                      >
                        {formatGs(packPrice)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Validation Notice */}
          {validationNotice && (
            <div className="bg-red-50 border-3 border-red-600 text-red-950 rounded-2xl px-4 py-3 text-base sm:text-lg font-black flex items-center justify-between gap-2 shadow-md">
              <span>⚠️ {validationNotice}</span>
              <button
                type="button"
                onClick={() => setValidationNotice('')}
                className="text-red-700 font-black px-2.5 py-1 rounded-lg hover:bg-red-100 cursor-pointer text-lg"
              >
                ✕
              </button>
            </div>
          )}

          {orderComplete ? (
            /* Order Success State */
            <div className="text-center py-4 space-y-4">
              <div className="w-20 h-20 rounded-full bg-[#e5f6ec] text-[#0a7a4a] flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-[#062319]">
                ¡Tu pedido #{orderComplete.reservaid} está registrado!
              </h3>

              <div className="max-w-md mx-auto bg-[#f6f4ee] border-2 border-[#cde6d7] rounded-2xl p-4 text-left space-y-3">
                <div className="text-base sm:text-lg text-stone-900">
                  <span className="font-black text-stone-600 block text-sm uppercase">
                    Producto reservado:
                  </span>
                  <b className="text-[#062319] font-black text-lg sm:text-xl">{confirmedProductTitle}</b>
                </div>
                <div className="text-base sm:text-lg text-stone-900 border-t border-stone-300 pt-3 flex justify-between">
                  <span className="font-black text-stone-700">Total al recibir:</span>
                  <b className="text-[#062319] font-black text-lg sm:text-xl">
                    {confirmedPackCount} un. ({formatGs(confirmedTotalAmount)})
                  </b>
                </div>
                {confirmedGpsLink && (
                  <div className="text-sm sm:text-base text-white bg-[#16a34a] border-2 border-[#15803d] rounded-xl p-3 flex items-center justify-between gap-2">
                    <span className="font-black">📍 Ubicación GPS Adjuntada</span>
                    <span className="bg-white text-[#065f46] text-xs font-black px-2.5 py-1 rounded-full">
                      ✓ GUARDADA
                    </span>
                  </div>
                )}
              </div>

              <p className="text-stone-900 text-base sm:text-lg font-bold max-w-md mx-auto leading-relaxed bg-[#eefaf3] border-2 border-[#86efac] rounded-2xl p-4">
                Ahora mismo te estamos enviando un mensaje a tu WhatsApp (<b>{confirmedClientPhone}</b>) para coordinar tu entrega rápida en puerta.
              </p>

              {isFullscreenMode && (
                <button
                  type="button"
                  onClick={handleExitFullscreen}
                  className="w-full max-w-md mx-auto bg-[#062319] hover:bg-[#0b3d2e] text-[#ffd778] font-black text-lg py-4 rounded-2xl border-2 border-[#e8b23a] cursor-pointer block"
                >
                  Volver a la Tienda
                </button>
              )}
            </div>
          ) : (
            /* ═══ FORMULARIO GUIADO CON LETRAS GRANDES Y FLECHAS ROJAS EN MOVIMIENTO PASO A PASO ═══ */
            <form onSubmit={handleSubmit} noValidate className="space-y-4" data-testid="express-order-form">

              {/* ═══ ETAPA 1: Nombre Completo (Nombre y Apellido) ═══ */}
              <div
                data-testid="step-card-nombre"
                className={`rounded-2xl p-4 sm:p-5 transition-all duration-300 ${step1Done
                  ? 'bg-[#f0fdf4] border-3 border-[#16a34a]'
                  : 'bg-[#fffdf5] border-4 border-red-600 shadow-[0_0_0_4px_rgba(220,38,38,0.15)]'
                  }`}
              >
                {/* FLECHA ROJA EN MOVIMIENTO APUNTANDO AL PASO 1 */}
                {!step1Done && (
                  <div
                    data-testid="red-arrow-step-1"
                    className="mb-3 bg-red-600 text-white rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 shadow-md animate-bounce"
                  >
                    <ArrowDown className="w-7 h-7 stroke-[3] text-yellow-300 shrink-0" />
                    <span className="text-base sm:text-lg font-black uppercase tracking-wide leading-tight">
                      PASO 1: Escribí aquí abajo tu Nombre y Apellido
                    </span>
                  </div>
                )}

                <label className="block text-lg sm:text-xl font-black text-stone-950 mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-base font-black shrink-0 ${step1Done ? 'bg-[#16a34a] text-white' : 'bg-red-600 text-white'
                      }`}>
                      {step1Done ? '✓' : '1'}
                    </span>
                    <span>Tu Nombre Completo (Nombre y Apellido)</span>
                  </span>
                  {step1Done && (
                    <span className="text-sm font-black text-[#16a34a] bg-[#dcfce7] px-3 py-1 rounded-full shrink-0">
                      ✓ Completado
                    </span>
                  )}
                </label>

                <p className="text-sm sm:text-base font-bold text-stone-800 mb-3 leading-snug">
                  Poné tu <b>Nombre y tu Apellido</b> completos para registrar tu pedido:
                </p>

                <div className="relative flex items-center">
                  {!step1Done && (
                    <div className="mr-2 text-red-600 animate-pulse shrink-0">
                      <ArrowRight className="w-8 h-8 stroke-[3.5]" />
                    </div>
                  )}
                  <div className="relative flex-1">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#0b3d2e] pointer-events-none" />
                    <input
                      ref={nameInputRef}
                      type="text"
                      autoComplete="name"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej: Juan Carlos López"
                      className={`w-full pl-12 pr-4 py-4 sm:py-4.5 border-3 bg-white rounded-2xl text-lg sm:text-xl font-black text-stone-950 placeholder:text-stone-400 placeholder:font-bold outline-none transition-all ${!step1Done
                        ? 'border-red-600 focus:border-red-700 focus:ring-4 focus:ring-red-500/25'
                        : 'border-[#16a34a] focus:border-[#0b3d2e]'
                        }`}
                    />
                  </div>
                </div>
              </div>

              {/* ═══ ETAPA 2: Tu WhatsApp (Se activa cuando completa el Nombre) ═══ */}
              <div
                data-testid="step-card-whatsapp"
                className={`rounded-2xl p-4 sm:p-5 transition-all duration-300 ${!step1Done
                  ? 'bg-stone-100 border-3 border-stone-300 opacity-65'
                  : step2Done
                    ? 'bg-[#f0fdf4] border-3 border-[#16a34a]'
                    : 'bg-[#fffdf5] border-4 border-red-600 shadow-[0_0_0_4px_rgba(220,38,38,0.15)]'
                  }`}
              >
                {/* FLECHA ROJA EN MOVIMIENTO APUNTANDO AL PASO 2 */}
                {step1Done && !step2Done && (
                  <div
                    data-testid="red-arrow-step-2"
                    className="mb-3 bg-red-600 text-white rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 shadow-md animate-bounce"
                  >
                    <ArrowDown className="w-7 h-7 stroke-[3] text-yellow-300 shrink-0" />
                    <span className="text-base sm:text-lg font-black uppercase tracking-wide leading-tight">
                      PASO 2: Ahora escribí aquí tu número de WhatsApp
                    </span>
                  </div>
                )}

                <label className="block text-lg sm:text-xl font-black text-stone-950 mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-base font-black shrink-0 ${step2Done ? 'bg-[#16a34a] text-white' : step1Done ? 'bg-red-600 text-white' : 'bg-stone-400 text-white'
                      }`}>
                      {step2Done ? '✓' : '2'}
                    </span>
                    <span>Tu Número de WhatsApp</span>
                  </span>
                  {!step1Done ? (
                    <span className="text-xs sm:text-sm font-black text-stone-600 bg-stone-200 px-2.5 py-1 rounded-full shrink-0">
                      🔒 Primero tu Nombre
                    </span>
                  ) : step2Done ? (
                    <span className="text-sm font-black text-[#16a34a] bg-[#dcfce7] px-3 py-1 rounded-full shrink-0">
                      ✓ Completado
                    </span>
                  ) : null}
                </label>

                <p className="text-sm sm:text-base font-bold text-stone-800 mb-3 leading-snug">
                  Poné tu número de celular con WhatsApp para enviarte la confirmación:
                </p>

                <div className="relative flex items-center">
                  {step1Done && !step2Done && (
                    <div className="mr-2 text-red-600 animate-pulse shrink-0">
                      <ArrowRight className="w-8 h-8 stroke-[3.5]" />
                    </div>
                  )}
                  <div className="relative flex-1">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#0b3d2e] pointer-events-none" />
                    <input
                      ref={phoneInputRef}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      disabled={!step1Done}
                      value={celular}
                      onChange={(e) => setCelular(e.target.value)}
                      placeholder={step1Done ? 'Ej: 0981 123 456' : '🔒 Completá primero tu Nombre arriba'}
                      className={`w-full pl-12 pr-4 py-4 sm:py-4.5 border-3 rounded-2xl text-lg sm:text-xl font-black text-stone-950 placeholder:text-stone-400 placeholder:font-bold outline-none transition-all ${!step1Done
                        ? 'bg-stone-200 border-stone-300 text-stone-500 cursor-not-allowed'
                        : !step2Done
                          ? 'bg-white border-red-600 focus:border-red-700 focus:ring-4 focus:ring-red-500/25'
                          : 'bg-white border-[#16a34a] focus:border-[#0b3d2e]'
                        }`}
                    />
                  </div>
                </div>
              </div>

              {/* ═══ ETAPA 3: Ubicación Paso a Paso (Ciudad -> Barrio -> Calle) ═══ */}
              <div
                data-testid="step-card-ubicacion"
                className={`rounded-2xl p-4 sm:p-5 space-y-4 transition-all duration-300 ${!step2Done
                  ? 'bg-stone-100 border-3 border-stone-300 opacity-65'
                  : step3Done
                    ? 'bg-[#f0fdf4] border-3 border-[#16a34a]'
                    : 'bg-[#fffdf5] border-4 border-red-600 shadow-[0_0_0_4px_rgba(220,38,38,0.15)]'
                  }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-lg sm:text-xl font-black text-stone-950 flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-base font-black shrink-0 ${step3Done ? 'bg-[#16a34a] text-white' : step2Done ? 'bg-red-600 text-white' : 'bg-stone-400 text-white'
                      }`}>
                      {step3Done ? '✓' : '3'}
                    </span>
                    <span>¿Dónde te entregamos?</span>
                  </label>

                  {!step2Done ? (
                    <span className="text-xs sm:text-sm font-black text-stone-600 bg-stone-200 px-2.5 py-1 rounded-full">
                      🔒 Primero tu WhatsApp
                    </span>
                  ) : step3Done ? (
                    <span className="text-sm font-black text-[#16a34a] bg-[#dcfce7] px-3 py-1 rounded-full">
                      ✓ Dirección Lista
                    </span>
                  ) : null}

                  {/* Selector Casa / Edificio en letra grande */}
                  <div className="inline-flex rounded-xl bg-stone-200 p-1 border-2 border-stone-300 text-sm sm:text-base font-black w-full sm:w-auto justify-center">
                    <button
                      type="button"
                      data-testid="btn-vivienda-casa"
                      disabled={!step2Done}
                      onClick={() => setTipoVivienda('casa')}
                      className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${!isBuilding
                        ? 'bg-[#062319] text-[#ffd778] shadow-xs'
                        : 'text-stone-700 hover:text-stone-950'
                        }`}
                    >
                      🏠 Casa
                    </button>
                    <button
                      type="button"
                      data-testid="btn-vivienda-edificio"
                      disabled={!step2Done}
                      onClick={() => setTipoVivienda('edificio')}
                      className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${isBuilding
                        ? 'bg-[#062319] text-[#ffd778] shadow-xs'
                        : 'text-stone-700 hover:text-stone-950'
                        }`}
                    >
                      🏢 Edificio
                    </button>
                  </div>
                </div>

                <p className="text-sm sm:text-base font-bold text-stone-800 leading-snug">
                  Completá uno por uno tu <b>Ciudad</b>, tu <b>Barrio</b> y el <b>Nombre de tu Calle</b>:
                </p>

                <div className="space-y-4">
                  {/* ── SUB-ETAPA 3.1: CIUDAD ── */}
                  <div
                    className={`rounded-2xl p-3.5 transition-all ${!step2Done
                      ? 'bg-stone-200/70 border-2 border-stone-300'
                      : !ciudadDone
                        ? 'bg-red-50/80 border-3 border-red-600'
                        : 'bg-white border-2 border-[#16a34a]'
                      }`}
                  >
                    {step2Done && !ciudadDone && (
                      <div
                        data-testid="red-arrow-ciudad"
                        className="mb-2.5 bg-red-600 text-white rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm animate-bounce"
                      >
                        <ArrowDown className="w-6 h-6 stroke-[3] text-yellow-300 shrink-0" />
                        <span className="text-sm sm:text-base font-black uppercase">
                          PASO 3.1: Escribí aquí el nombre de tu Ciudad
                        </span>
                      </div>
                    )}
                    <label className="block text-base sm:text-lg font-black text-stone-950 mb-1.5 flex items-center justify-between">
                      <span>🏙️ 1. Tu Ciudad</span>
                      {ciudadDone && (
                        <span className="text-xs sm:text-sm font-black text-[#16a34a] bg-[#dcfce7] px-2.5 py-0.5 rounded-full">
                          ✓ Listo
                        </span>
                      )}
                    </label>
                    <div className="relative flex items-center">
                      {step2Done && !ciudadDone && (
                        <div className="mr-2 text-red-600 animate-pulse shrink-0">
                          <ArrowRight className="w-7 h-7 stroke-[3.5]" />
                        </div>
                      )}
                      <div className="relative flex-1">
                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-6 h-6 text-[#0b3d2e] pointer-events-none" />
                        <input
                          ref={ciudadInputRef}
                          type="text"
                          data-testid="input-ciudad"
                          autoComplete="address-level2"
                          disabled={!step2Done}
                          value={ciudadTexto}
                          onChange={(e) => setCiudadTexto(e.target.value)}
                          placeholder={step2Done ? 'Ej: San Lorenzo, Luque, Asunción...' : '🔒 Completá primero tu WhatsApp'}
                          className={`w-full pl-11 pr-4 py-3.5 sm:py-4 border-3 rounded-xl text-lg sm:text-xl font-black text-stone-950 placeholder:text-stone-400 placeholder:font-bold outline-none transition-all ${!step2Done
                            ? 'bg-stone-200 border-stone-300 text-stone-500 cursor-not-allowed'
                            : !ciudadDone
                              ? 'bg-white border-red-600 focus:border-red-700 focus:ring-4 focus:ring-red-500/25'
                              : 'bg-white border-[#16a34a]'
                            }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── SUB-ETAPA 3.2: BARRIO (Se activa cuando llena Ciudad) ── */}
                  <div
                    className={`rounded-2xl p-3.5 transition-all ${!ciudadDone
                      ? 'bg-stone-200/70 border-2 border-stone-300 opacity-70'
                      : !barrioDone
                        ? 'bg-red-50/80 border-3 border-red-600'
                        : 'bg-white border-2 border-[#16a34a]'
                      }`}
                  >
                    {ciudadDone && !barrioDone && (
                      <div
                        data-testid="red-arrow-barrio"
                        className="mb-2.5 bg-red-600 text-white rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm animate-bounce"
                      >
                        <ArrowDown className="w-6 h-6 stroke-[3] text-yellow-300 shrink-0" />
                        <span className="text-sm sm:text-base font-black uppercase">
                          PASO 3.2: Ahora escribí aquí el nombre de tu Barrio
                        </span>
                      </div>
                    )}
                    <label className="block text-base sm:text-lg font-black text-stone-950 mb-1.5 flex items-center justify-between">
                      <span>🏘️ 2. Tu Barrio</span>
                      {!ciudadDone ? (
                        <span className="text-xs font-black text-stone-600 bg-stone-300 px-2.5 py-0.5 rounded-full">
                          🔒 Primero tu Ciudad
                        </span>
                      ) : barrioDone ? (
                        <span className="text-xs sm:text-sm font-black text-[#16a34a] bg-[#dcfce7] px-2.5 py-0.5 rounded-full">
                          ✓ Listo
                        </span>
                      ) : null}
                    </label>
                    <div className="relative flex items-center">
                      {ciudadDone && !barrioDone && (
                        <div className="mr-2 text-red-600 animate-pulse shrink-0">
                          <ArrowRight className="w-7 h-7 stroke-[3.5]" />
                        </div>
                      )}
                      <div className="relative flex-1">
                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-6 h-6 text-[#0b3d2e] pointer-events-none" />
                        <input
                          ref={barrioInputRef}
                          type="text"
                          data-testid="input-barrio"
                          disabled={!ciudadDone}
                          value={barrioTexto}
                          onChange={(e) => setBarrioTexto(e.target.value)}
                          placeholder={ciudadDone ? 'Ej: Barrio Centro, San Miguel...' : '🔒 Escribí primero tu Ciudad arriba'}
                          className={`w-full pl-11 pr-4 py-3.5 sm:py-4 border-3 rounded-xl text-lg sm:text-xl font-black text-stone-950 placeholder:text-stone-400 placeholder:font-bold outline-none transition-all ${!ciudadDone
                            ? 'bg-stone-200 border-stone-300 text-stone-500 cursor-not-allowed'
                            : !barrioDone
                              ? 'bg-white border-red-600 focus:border-red-700 focus:ring-4 focus:ring-red-500/25'
                              : 'bg-white border-[#16a34a]'
                            }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── SUB-ETAPA 3.3: NOMBRE DE CALLE (Se activa cuando llena Barrio) ── */}
                  <div
                    className={`rounded-2xl p-3.5 transition-all ${!barrioDone
                      ? 'bg-stone-200/70 border-2 border-stone-300 opacity-70'
                      : !calleDone
                        ? 'bg-red-50/80 border-3 border-red-600'
                        : 'bg-white border-2 border-[#16a34a]'
                      }`}
                  >
                    {barrioDone && !calleDone && (
                      <div
                        data-testid="red-arrow-calle"
                        className="mb-2.5 bg-red-600 text-white rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm animate-bounce"
                      >
                        <ArrowDown className="w-6 h-6 stroke-[3] text-yellow-300 shrink-0" />
                        <span className="text-sm sm:text-base font-black uppercase">
                          PASO 3.3: Por último escribí el Nombre de tu Calle
                        </span>
                      </div>
                    )}
                    <label className="block text-base sm:text-lg font-black text-stone-950 mb-1.5 flex items-center justify-between">
                      <span>🛣️ 3. Nombre de tu Calle</span>
                      {!barrioDone ? (
                        <span className="text-xs font-black text-stone-600 bg-stone-300 px-2.5 py-0.5 rounded-full">
                          🔒 Primero tu Barrio
                        </span>
                      ) : calleDone ? (
                        <span className="text-xs sm:text-sm font-black text-[#16a34a] bg-[#dcfce7] px-2.5 py-0.5 rounded-full">
                          ✓ Listo
                        </span>
                      ) : null}
                    </label>
                    <div className="relative flex items-center">
                      {barrioDone && !calleDone && (
                        <div className="mr-2 text-red-600 animate-pulse shrink-0">
                          <ArrowRight className="w-7 h-7 stroke-[3.5]" />
                        </div>
                      )}
                      <div className="relative flex-1">
                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-6 h-6 text-[#0b3d2e] pointer-events-none" />
                        <input
                          ref={calleInputRef}
                          type="text"
                          data-testid="input-calle"
                          autoComplete="street-address"
                          disabled={!barrioDone}
                          value={calleTexto}
                          onChange={(e) => setCalleTexto(e.target.value)}
                          placeholder={
                            !barrioDone
                              ? '🔒 Escribí primero tu Barrio arriba'
                              : isBuilding
                                ? 'Ej: Av. Mcal. López casi San Martín'
                                : 'Ej: Calle España casi Ruta 2'
                          }
                          className={`w-full pl-11 pr-4 py-3.5 sm:py-4 border-3 rounded-xl text-lg sm:text-xl font-black text-stone-950 placeholder:text-stone-400 placeholder:font-bold outline-none transition-all ${!barrioDone
                            ? 'bg-stone-200 border-stone-300 text-stone-500 cursor-not-allowed'
                            : !calleDone
                              ? 'bg-white border-red-600 focus:border-red-700 focus:ring-4 focus:ring-red-500/25'
                              : 'bg-white border-[#16a34a]'
                            }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {step2Done && !gpsConfirmado && (
                  <div className="rounded-2xl bg-[#ecfdf5] border-2 border-[#6ee7b7] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-sm sm:text-base font-black text-[#064e3b] flex items-center gap-1.5">
                        <Crosshair className="w-4 h-4 text-[#059669] shrink-0" />
                        <span>¿Querés enviar tu GPS exacto? (Opcional · 1 toque)</span>
                      </p>
                      <p className="text-xs font-bold text-[#065f46]/90">
                        Ayuda al repartidor a ubicar tu casa al instante sin tener que llamarte.
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid="btn-capture-gps"
                      disabled={gpsLoading}
                      onClick={handleOneClickGpsLocation}
                      className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-sm font-black shadow-sm cursor-pointer disabled:opacity-65 transition-all"
                    >
                      <Crosshair className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
                      <span>{gpsLoading ? 'Buscando GPS...' : 'Usar mi GPS actual'}</span>
                    </button>
                  </div>
                )}

                {gpsNotice && (
                  <p className="text-sm sm:text-base font-bold text-amber-900 bg-amber-50 border-2 border-amber-300 rounded-xl px-3.5 py-2.5">
                    💡 {gpsNotice}
                  </p>
                )}

                {/* Compact Satellite Map Preview ONLY when GPS confirmed */}
                {gpsConfirmado && gpsLat !== null && gpsLng !== null && tileData && (
                  <div className="rounded-2xl overflow-hidden border-3 border-[#16a34a] bg-[#064e3b] select-none">
                    <div className="bg-[#15803d] text-white px-3.5 py-2.5 flex items-center justify-between gap-2 text-sm font-black">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-5 h-5 text-[#86efac]" />
                        <span>Pin GPS listo para el repartidor</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setMapLocked(!mapLocked)}
                        className="px-3 py-1 rounded-lg bg-white text-[#065f46] text-xs sm:text-sm font-black flex items-center gap-1 cursor-pointer"
                      >
                        {mapLocked ? (
                          <>
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Ajustar pin</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Fijar pin</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="relative w-full h-44 overflow-hidden">
                      <div
                        ref={mapContainerRef}
                        onPointerDown={!mapLocked ? handleMapPointerDown : undefined}
                        onPointerMove={!mapLocked ? handleMapPointerMove : undefined}
                        onPointerUp={!mapLocked ? handleMapPointerUp : undefined}
                        className={`relative w-full h-full overflow-hidden ${mapLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing touch-none'
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
                          <div className="w-9 h-9 rounded-full bg-[#16a34a] border-3 border-white shadow-xl flex items-center justify-center text-white">
                            <MapPin className="w-4 h-4 fill-white text-[#16a34a]" />
                          </div>
                          <div className="w-3 h-1.5 rounded-full bg-black/60 mt-0.5" />
                        </div>
                      </div>

                      {!mapLocked && (
                        <div className="absolute bottom-2 left-2 right-2 bg-[#062319]/90 text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl flex items-center justify-between z-20">
                          <span>👆 Arrastrá el mapa hasta tu techo</span>
                          <button
                            type="button"
                            onClick={() => setMapLocked(true)}
                            className="bg-[#16a34a] text-white font-black px-3 py-1 rounded-lg cursor-pointer"
                          >
                            Listo ✓
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
                          className="w-8 h-8 rounded-lg bg-[#064e3b]/90 text-white border border-white/30 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMapZoom((z) => Math.max(14, z - 1));
                          }}
                          className="w-8 h-8 rounded-lg bg-[#064e3b]/90 text-white border border-white/30 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Building fields (only if Edificio selected) */}
                {isBuilding && step2Done && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-[#f8fafc] border-2 border-stone-300 rounded-2xl p-3.5">
                    <input
                      type="text"
                      value={nombreEdificio}
                      onChange={(e) => setNombreEdificio(e.target.value)}
                      placeholder="Nombre del Edificio (opcional)"
                      className="w-full px-3.5 py-3 border-2 border-stone-300 focus:border-[#16a34a] bg-white rounded-xl text-base font-black text-stone-900 outline-none"
                    />
                    <input
                      type="text"
                      value={pisoDepartamento}
                      onChange={(e) => setPisoDepartamento(e.target.value)}
                      placeholder="Piso y N° Dpto. (ej: Piso 4, 4B)"
                      className="w-full px-3.5 py-3 border-2 border-stone-300 focus:border-[#16a34a] bg-white rounded-xl text-base font-black text-stone-900 outline-none"
                    />
                    <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTieneRecepcion('si_recepcionista')}
                        className={`py-2.5 px-3 rounded-xl border-2 text-sm font-black cursor-pointer ${tieneRecepcion === 'si_recepcionista'
                          ? 'bg-[#16a34a] text-white border-[#065f46]'
                          : 'bg-white text-stone-800 border-stone-300'
                          }`}
                      >
                        🛎️ Recibe Portería
                      </button>
                      <button
                        type="button"
                        onClick={() => setTieneRecepcion('no_personalmente')}
                        className={`py-2.5 px-3 rounded-xl border-2 text-sm font-black cursor-pointer ${tieneRecepcion === 'no_personalmente'
                          ? 'bg-[#16a34a] text-white border-[#065f46]'
                          : 'bg-white text-stone-800 border-stone-300'
                          }`}
                      >
                        🙋 Recibo Yo Abajo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ═══ Payment Selector (Letra grande) ═══ */}
              <div className="pt-1">
                <div className="flex items-center justify-between text-base sm:text-lg font-black text-stone-900 mb-2">
                  <span>💰 ¿Cómo preferís pagar al recibir?:</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'Efectivo al recibir', label: 'Efectivo', Icon: Banknote },
                    { value: 'QR / Transferencia en puerta', label: 'QR / Transf.', Icon: QrCode },
                    { value: 'Tarjeta Débito/Crédito al repartidor', label: 'Tarjeta POS', Icon: CreditCard }
                  ].map(({ value, label, Icon }) => {
                    const active = pago === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPago(value)}
                        className={`flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl border-3 text-sm sm:text-base font-black cursor-pointer transition-all ${active
                          ? 'bg-[#eefaf3] border-[#0b3d2e] text-[#062319] shadow-sm'
                          : 'bg-[#faf9f5] border-stone-300 text-stone-700 hover:border-stone-400'
                          }`}
                      >
                        <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#1ea856]' : 'text-stone-500'}`} />
                        <span className="truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ═══ DUAL-FUNCTION CTA — Con Flecha Roja Final cuando todo está listo y Cuenta Regresiva 5s ═══ */}
              <div className="pt-2">
                {step3Done && !submitting && (
                  <div
                    data-testid="red-arrow-submit"
                    className="mb-3 bg-red-600 text-white rounded-xl px-4 py-3 flex items-center justify-center gap-2.5 shadow-lg animate-bounce"
                  >
                    <ArrowDown className="w-7 h-7 stroke-[3] text-yellow-300 shrink-0" />
                    <span className="text-base sm:text-lg font-black uppercase tracking-wide text-center">
                      ¡TODO LISTO! TOCÁ EL BOTÓN DE ABAJO PARA ENVIAR TU PEDIDO
                    </span>
                    <ArrowDown className="w-7 h-7 stroke-[3] text-yellow-300 shrink-0" />
                  </div>
                )}

                <button
                  type="submit"
                  data-testid="btn-dual-submit-order"
                  disabled={submitting}
                  className={`relative overflow-hidden w-full bg-gradient-to-r from-[#e8b23a] via-[#ffd778] to-[#f59e0b] hover:from-[#ffd778] hover:to-[#e8b23a] text-[#062319] font-black text-xl sm:text-2xl py-5 sm:py-6 px-4 rounded-2xl shadow-[0_6px_0_#9c7310,0_14px_28px_rgba(232,178,58,0.45)] active:translate-y-0.5 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer disabled:opacity-95 ${step3Done ? 'ring-4 ring-red-600' : ''
                    }`}
                >
                  {submitting ? (
                    <>
                      <div className="flex items-center justify-center gap-3 text-center">
                        <Crosshair className="w-7 h-7 text-[#062319] animate-spin shrink-0" />
                        <span>
                          Preparando tus datos{firstName ? `, ${firstName}` : ''}...{' '}
                          {submitCountdown > 0 ? `${submitCountdown}s` : '¡Enviando!'}
                        </span>
                      </div>
                      <div className="w-4/5 max-w-xs h-3 bg-[#062319]/20 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-[#062319] rounded-full transition-all duration-1000 ease-linear"
                          style={{
                            width: `${Math.min(100, Math.max(10, ((5 - submitCountdown) / 5) * 100))}%`
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-2.5 text-center leading-tight">
                      <Truck className="w-7 h-7 sm:w-8 sm:h-8 text-[#062319] shrink-0" />
                      <span>
                        {firstName ? `¡PEDIR AHORA, ${firstName}!` : '¡CONFIRMAR MI PEDIDO AHORA!'} ·{' '}
                        {formatGs(total)}
                      </span>
                    </div>
                  )}
                </button>

                {/* Información clara en letra legible */}
                <div className="mt-3 flex flex-col items-center gap-1.5">
                  <p className="text-sm sm:text-base text-center font-bold text-stone-800 flex items-center justify-center gap-1.5">
                    <MapPin className="w-5 h-5 text-[#16a34a] shrink-0" />
                    <span>
                      Al tocar el botón adjuntamos tu ubicación GPS y enviamos tus datos al mismo tiempo.
                    </span>
                  </p>
                  <p className="text-sm text-center font-bold text-stone-700 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#1ea856] shrink-0" />
                    <span>Sin riesgos: revisás tu paquete en mano antes de pagar.</span>
                  </p>
                </div>
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
          aria-label="Formulario rápido de pedido"
          className="fixed inset-0 z-[95] w-screen h-[100dvh] bg-[#041a12]/90 backdrop-blur-sm flex flex-col justify-center items-center p-2 sm:p-4 overflow-hidden animate-fadeIn"
        >
          {renderFormCardContent(true)}
        </div>
      )}

      {showConfirmPopup && orderComplete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl border-3 border-[#1ea856] shadow-2xl overflow-hidden p-6 sm:p-7 text-center">
            <button
              type="button"
              onClick={() => {
                setShowConfirmPopup(false);
                setOrderFormFullscreen(false);
              }}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-full bg-[#e5f6ec] text-[#0a7a4a] flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <span className="inline-block bg-[#e5f6ec] text-[#0a7a4a] text-xs sm:text-sm font-black uppercase tracking-wider px-3.5 py-1 rounded-full mb-2">
              Pedido #{orderComplete.reservaid}
            </span>

            <h3 className="text-2xl sm:text-3xl font-black text-[#062319] tracking-tight">
              ¡Pedido Confirmado!
            </h3>

            <div className="mt-4 bg-[#f6f4ee] border-2 border-[#cde6d7] rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-start gap-3">
                <PackageCheck className="w-6 h-6 text-[#1ea856] shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-stone-500 block">
                    Producto reservado
                  </span>
                  <span className="text-base font-black text-[#062319] leading-snug block">
                    {confirmedProductTitle}
                  </span>
                </div>
              </div>

              <div className="border-t border-stone-200 pt-2.5 flex items-center justify-between text-sm sm:text-base">
                <span className="font-bold text-stone-700">Total al recibir:</span>
                <span className="font-black text-[#062319]">
                  {confirmedPackCount} {confirmedPackCount > 1 ? 'unidades' : 'unidad'} (
                  {formatGs(confirmedTotalAmount)})
                </span>
              </div>
            </div>

            <div className="mt-4 bg-[#062319] text-white rounded-2xl p-4 text-left">
              <p className="text-sm sm:text-base leading-relaxed text-[#e9f7ef] font-medium">
                En este instante nuestro{' '}
                <b className="text-[#ffd778]">equipo de envíos</b> te está escribiendo a tu WhatsApp{' '}
                <b className="text-white underline">{confirmedClientPhone}</b> para coordinar la entrega rápida en tu puerta.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowConfirmPopup(false);
                setOrderFormFullscreen(false);
              }}
              className="mt-5 w-full bg-gradient-to-r from-[#1ea856] to-[#158a44] hover:from-[#22b85e] hover:to-[#17964b] text-white font-black text-base sm:text-lg py-4 rounded-2xl shadow-[0_4px_0_#0d612e] active:translate-y-0.5 transition-all cursor-pointer"
            >
              Entendido, muchas gracias
            </button>
          </div>
        </div>
      )}

      <section
        id="pedido"
        className={
          expressDirectMode
            ? 'py-3 sm:py-5 max-w-xl mx-auto px-3 sm:px-4'
            : 'py-8 sm:py-12 max-w-2xl mx-auto app-container'
        }
      >
        {renderFormCardContent(false)}
      </section>
    </>
  );
};
