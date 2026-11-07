import React, { useState, useEffect, useRef } from 'react';
import {
  Truck,
  User,
  Phone,
  MapPin,
  Building,
  CreditCard,
  Banknote,
  QrCode,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  X,
  PackageCheck,
  Navigation,
  Sparkles,
  Crosshair,
  Plus,
  Minus,
  Pencil
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useStore } from '../context/StoreContext';
import { formatGs, formatWaPhone } from '../config';
import { trackMetaFullFunnelEvent } from '../utils/metaPixelEngine';

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

// Default coordinates by Department/City in Paraguay only used if device has no GPS sensor at all
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

// Web Mercator helpers to convert lat/lng <-> Satellite Tile X/Y + pixel offsets
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

export const OrderForm: React.FC = () => {
  const {
    config,
    selectedPack,
    setSelectedPack,
    addOrder,
    currentProductPage,
    orderFormFullscreen,
    setOrderFormFullscreen
  } = useStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [tipoVivienda, setTipoVivienda] = useState<'casa' | 'edificio'>('casa');
  const [hasAnsweredVivienda, setHasAnsweredVivienda] = useState<boolean>(false);
  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [departamento, setDepartamento] = useState('Central');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  // Campos exclusivos para cuando el cliente vive en un EDIFICIO
  const [nombreEdificio, setNombreEdificio] = useState('');
  const [pisoEdificio, setPisoEdificio] = useState('');
  const [departamentoNumero, setDepartamentoNumero] = useState('');
  const [tieneRecepcion, setTieneRecepcion] = useState<'si_recepcionista' | 'no_personalmente'>('si_recepcionista');
  const [detalleRecepcion, setDetalleRecepcion] = useState('');

  const [pago, setPago] = useState('Efectivo al recibir');
  const [submitting, setSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState<any | null>(null);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [validationNotice, setValidationNotice] = useState<string>('');

  // Clean Single-View Satellite + Pin GPS State ("Sin barullo")
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsConfirmado, setGpsConfirmado] = useState<boolean>(false);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsDetectedAddress, setGpsDetectedAddress] = useState<string>('');
  const [mapZoom, setMapZoom] = useState<number>(18); // Zoom 18 shows house roofs & streets clearly

  // Drag / Pan state for smooth WhatsApp-style interactive satellite map
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
  const direccionInputRef = useRef<HTMLInputElement | null>(null);
  const edificioInputRef = useRef<HTMLInputElement | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const watchTimeoutRef = useRef<number | null>(null);
  const bestAccuracyRef = useRef<number>(999999);

  // Extract customer's first name to guide them personally by the hand
  const firstName = (nombre || '').trim().split(/\s+/)[0] || 'amigo/a';
  const isBuilding = tipoVivienda === 'edificio';

  // Dynamic values from active product
  const effectivePack = selectedPack > 0 ? selectedPack : 1;
  const targetProductId = currentProductPage?.id || 'prod-noelux-01';
  const targetProductName =
    currentProductPage?.nombre || `${config.marca}™ Proyector Navideño 12 Diseños`;
  const total =
    currentProductPage?.precios?.[effectivePack] ||
    config.lote[effectivePack] ||
    189000;

  const gpsLink =
    gpsLat !== null && gpsLng !== null
      ? `https://www.google.com/maps?q=${gpsLat.toFixed(6)},${gpsLng.toFixed(6)}`
      : '';

  const gpsStreetViewLink =
    gpsLat !== null && gpsLng !== null
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${gpsLat.toFixed(6)},${gpsLng.toFixed(6)}`
      : '';

  // Clean up any active GPS watch when unmounting
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (watchTimeoutRef.current !== null) {
        window.clearTimeout(watchTimeoutRef.current);
      }
    };
  }, []);

  // Automatically enter Fullscreen Focus Mode when user clicks or types in any form field
  const activateFullscreenFocus = () => {
    if (!orderFormFullscreen) {
      if (selectedPack === 0) {
        setSelectedPack(1);
      }
      setOrderFormFullscreen(true);
    }
  };

  // Exit Fullscreen Focus Mode and return to normal product page
  const handleExitFullscreen = () => {
    setOrderFormFullscreen(false);
    setValidationNotice('');
  };

  // Reverse geocoding helper via OpenStreetMap Nominatim (100% Free) to auto-fill barrio, street & city
  const reverseGeocodeCoords = async (lat: number, lng: number) => {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`,
        {
          signal: controller.signal,
          headers: {
            Accept: 'application/json'
          }
        }
      );
      window.clearTimeout(timeoutId);
      if (!res.ok) return;
      const data = await res.json();
      const addr = data?.address || {};
      const road = addr.road || addr.pedestrian || addr.residential || addr.path || '';
      const houseNumber = addr.house_number ? ` N° ${addr.house_number}` : '';
      const suburb = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '';
      const detectedCity =
        addr.city || addr.town || addr.municipality || addr.village || '';
      const detectedState = addr.state || '';

      const summaryParts = [
        road ? `${road}${houseNumber}` : '',
        suburb ? `Barrio ${suburb}` : '',
        detectedCity
      ].filter(Boolean);

      const detectedSummary =
        summaryParts.join(', ') ||
        String(data?.display_name || '')
          .split(',')
          .slice(0, 3)
          .join(', ')
          .trim();

      if (detectedSummary) {
        setGpsDetectedAddress(detectedSummary);
      }

      if (detectedCity) {
        setCiudad(suburb ? `${detectedCity} - Barrio ${suburb}` : detectedCity);
      }
      if (road || suburb) {
        const autoDir = [
          road ? `${road}${houseNumber}` : '',
          suburb ? `Barrio ${suburb}` : ''
        ]
          .filter(Boolean)
          .join(', ');
        if (autoDir) {
          setDireccion(autoDir);
        }
      }
      if (detectedState) {
        const matchedDep = DEPARTAMENTOS_PY.find((d) =>
          d
            .toLowerCase()
            .includes(detectedState.toLowerCase().replace('departamento de ', '').trim())
        );
        if (matchedDep) setDepartamento(matchedDep);
      }
    } catch {
      // Fallback gracefully if offline
    }
  };

  // Stop active GPS watch helper
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

  // ============================================================================
  // SINGLE 1-CLICK BUTTON: SHOW EXACT HOUSE / BUILDING ON SATELLITE MAP + PIN
  // ============================================================================
  const handleOneClickGpsLocation = () => {
    activateFullscreenFocus();
    stopGpsWatch();
    setGpsLoading(true);
    setValidationNotice('');
    bestAccuracyRef.current = 999999;

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([25, 40, 25]);
      }
    } catch {}

    const applyCoordinates = (lat: number, lng: number, acc: number) => {
      const cleanLat = Number(lat.toFixed(6));
      const cleanLng = Number(lng.toFixed(6));
      const roundedAcc = Math.max(3, Math.round(acc));

      setGpsLat(cleanLat);
      setGpsLng(cleanLng);
      setGpsAccuracy(roundedAcc);
      setGpsConfirmado(true);
      setGpsLoading(false);
      setMapZoom(18);
      reverseGeocodeCoords(cleanLat, cleanLng);
      trackMetaFullFunnelEvent({
        eventName: 'AddPaymentInfo',
        product: currentProductPage,
        globalPixelId: config.pixelId,
        packQuantity: effectivePack,
        valueGs: total,
        userData: { nombre, celular, ciudad, departamento }
      });
    };

    const deptFallback =
      PARAGUAY_DEPT_COORDS[departamento] || PARAGUAY_DEPT_COORDS['Central'];

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      let receivedAnyFix = false;

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
        async () => {
          if (receivedAnyFix) {
            stopGpsWatch();
            return;
          }
          stopGpsWatch();
          applyCoordinates(deptFallback.lat, deptFallback.lng, 30);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );

      watchIdRef.current = wId;
      watchTimeoutRef.current = window.setTimeout(() => {
        stopGpsWatch();
      }, 6500);
    } else {
      applyCoordinates(deptFallback.lat, deptFallback.lng, 30);
    }
  };

  // ============================================================================
  // INTERACTIVE WHATSAPP-STYLE TOUCH DRAG & TAP ON REAL SATELLITE MAP
  // ============================================================================
  const handleMapPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gpsLat === null || gpsLng === null) return;
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
    } catch {}
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
    } catch {}

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
      reverseGeocodeCoords(cleanLat, cleanLng);
    }
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    activateFullscreenFocus();
    if (selectedPack === 0) {
      setSelectedPack(1);
    }
    if (!nombre.trim() || !celular.trim()) {
      setValidationNotice('Por favor completá tu Nombre y tu Número de WhatsApp para continuar.');
      return;
    }
    setValidationNotice('');
    setStep(2);
    trackMetaFullFunnelEvent({
      eventName: 'InitiateCheckout',
      product: currentProductPage,
      globalPixelId: config.pixelId,
      packQuantity: effectivePack,
      valueGs: total,
      userData: { nombre: nombre.trim(), celular: celular.trim(), departamento }
    });
    trackMetaFullFunnelEvent({
      eventName: 'Lead',
      product: currentProductPage,
      globalPixelId: config.pixelId,
      packQuantity: effectivePack,
      valueGs: total,
      userData: { nombre: nombre.trim(), celular: celular.trim(), departamento }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    stopGpsWatch();
    if (!ciudad.trim() && !gpsConfirmado) {
      setValidationNotice(
        `${firstName}, tocá primero el botón rojo de ubicación o escribí tu Ciudad y Barrio.`
      );
      return;
    }
    if (!direccion.trim() && !gpsConfirmado) {
      setValidationNotice(
        `${firstName}, por favor escribí en qué calle está ${isBuilding ? 'tu edificio' : 'tu casa'} antes de confirmar.`
      );
      return;
    }
    if (isBuilding) {
      if (!nombreEdificio.trim()) {
        setValidationNotice(`${firstName}, por favor escribí cómo se llama tu edificio.`);
        edificioInputRef.current?.focus();
        return;
      }
      if (!pisoEdificio.trim() || !departamentoNumero.trim()) {
        setValidationNotice(
          `${firstName}, por favor indicá en qué piso y qué número de departamento o cuarto estás.`
        );
        return;
      }
    }

    setValidationNotice('');
    setSubmitting(true);

    try {
      const finalPack = selectedPack > 0 ? selectedPack : 1;
      const finalCiudad =
        ciudad.trim() ||
        (gpsDetectedAddress ? gpsDetectedAddress.split(',')[0].trim() : departamento);
      const baseStreet =
        direccion.trim() ||
        gpsDetectedAddress ||
        `Ubicación GPS confirmada (${gpsLat?.toFixed(5)}, ${gpsLng?.toFixed(5)})`;

      const recepSummary =
        tieneRecepcion === 'si_recepcionista'
          ? `Sí tiene recepción (La recepcionista recibe el pedido)${detalleRecepcion.trim() ? ` - ${detalleRecepcion.trim()}` : ''}`
          : `Sin recepción / Recibe personalmente en planta baja${detalleRecepcion.trim() ? ` - ${detalleRecepcion.trim()}` : ''}`;

      const finalDireccion = isBuilding
        ? `${baseStreet} (Edificio ${nombreEdificio.trim()}, Piso ${pisoEdificio.trim()}, Dpto./Cuarto ${departamentoNumero.trim()})`
        : baseStreet;

      const order = await addOrder({
        productoId: targetProductId,
        producto: targetProductName,
        waVendedor: formatWaPhone(currentProductPage?.wa || ''),
        nombre: nombre.trim(),
        celular: celular.trim(),
        departamento,
        ciudad: finalCiudad,
        direccion: finalDireccion,
        detalle: pago,
        cantidad: finalPack,
        monto: total,
        ref_code: null,
        estado: 'reservado',
        tipoVivienda,
        ...(isBuilding
          ? {
              nombreEdificio: nombreEdificio.trim(),
              pisoEdificio: pisoEdificio.trim(),
              departamentoNumero: departamentoNumero.trim(),
              tieneRecepcion,
              detalleRecepcion: recepSummary
            }
          : {}),
        ...(gpsLat !== null ? { gpsLat } : {}),
        ...(gpsLng !== null ? { gpsLng } : {}),
        ...(gpsAccuracy !== null ? { gpsAccuracy } : {}),
        ...(gpsLink ? { gpsLink } : {}),
        ...(gpsStreetViewLink ? { gpsStreetViewLink } : {}),
        gpsConfirmado: Boolean(gpsConfirmado),
        ...(gpsDetectedAddress ? { gpsDireccionDetectada: gpsDetectedAddress } : {})
      });

      setOrderComplete(order);
      setShowConfirmPopup(true);

      trackMetaFullFunnelEvent({
        eventName: 'Purchase',
        product: currentProductPage,
        globalPixelId: config.pixelId,
        packQuantity: finalPack,
        valueGs: total,
        orderId: order.reservaid,
        userData: {
          nombre: nombre.trim(),
          celular: celular.trim(),
          ciudad: finalCiudad,
          departamento,
          externalId: order.reservaid
        }
      });

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}
    } catch (err) {
      console.error('Error al procesar reserva:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Focus first input smoothly when entering fullscreen
  useEffect(() => {
    if (orderFormFullscreen && step === 1 && !orderComplete && hasAnsweredVivienda) {
      const timer = window.setTimeout(() => {
        nameInputRef.current?.focus({ preventScroll: true });
      }, 120);
      return () => window.clearTimeout(timer);
    }
  }, [orderFormFullscreen, step, orderComplete, hasAnsweredVivienda]);

  const confirmedPackCount = orderComplete?.cantidad || effectivePack;
  const confirmedProductTitle = orderComplete?.producto || targetProductName;
  const confirmedTotalAmount = orderComplete?.monto || total;
  const confirmedClientPhone = orderComplete?.celular || celular;
  const confirmedGpsLink = orderComplete?.gpsLink || gpsLink;

  // Compute 3x3 Satellite Hybrid Tile Grid around (gpsLat, gpsLng)
  const tileData =
    gpsLat !== null && gpsLng !== null
      ? latLngToTilePixel(gpsLat, gpsLng, mapZoom)
      : null;

  // Personalized Step-by-Step Hand-Holding Banner
  const activeGuidanceText = orderComplete
    ? `✅ ¡Excelente ${firstName}! Tu pedido y tu dirección ya quedaron confirmados.`
    : !hasAnsweredVivienda
      ? '👇 Antes de escribir, respondé por favor si vivís en una Casa Independiente o en un Edificio.'
      : step === 1
        ? !nombre.trim()
          ? '👆 Paso 1: Escribí tu Nombre y Apellido acá abajo.'
          : !celular.trim()
            ? `📱 ¡Muy bien ${firstName}! Ahora poné tu número de WhatsApp.`
            : `✅ ¡Perfecto ${firstName}! Ahora tocá el botón verde "Siguiente" de abajo.`
        : !gpsConfirmado
          ? `🔴 ${firstName}, dale clic al botón ROJO de abajo para marcar tu ${isBuilding ? 'edificio' : 'casa'} en el mapa.`
          : `🟢 ¡Ubicación confirmada en VERDE, ${firstName}! Revisá los datos de tu ${isBuilding ? 'edificio' : 'casa'} abajo y confirmá.`;

  // Pre-question selector block shown prominently before filling out Step 1, and as a compact bar in Step 2
  const renderViviendaPreQuestion = () => {
    if (step === 2) {
      return (
        <div
          data-testid="vivienda-prequestion-card"
          className="rounded-2xl border-2 border-[#0b3d2e] bg-[#f6f4ee] p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2"
        >
          <span className="text-xs font-black text-[#062319] px-1">
            ¿Vivís en edificio o casa independiente?
          </span>
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <button
              type="button"
              data-testid="btn-vivienda-casa"
              onClick={() => {
                setTipoVivienda('casa');
                setHasAnsweredVivienda(true);
                setValidationNotice('');
              }}
              className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                tipoVivienda === 'casa'
                  ? 'bg-[#062319] text-[#ffd778] border-[#16a34a] shadow-xs'
                  : 'bg-white text-stone-700 border-stone-300'
              }`}
            >
              <span>🏠 Casa Independiente</span>
              {tipoVivienda === 'casa' && <span>✓</span>}
            </button>
            <button
              type="button"
              data-testid="btn-vivienda-edificio"
              onClick={() => {
                setTipoVivienda('edificio');
                setHasAnsweredVivienda(true);
                setValidationNotice('');
              }}
              className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                tipoVivienda === 'edificio'
                  ? 'bg-[#062319] text-[#ffd778] border-[#e8b23a] shadow-xs'
                  : 'bg-white text-stone-700 border-stone-300'
              }`}
            >
              <span>🏢 Vivo en Edificio</span>
              {tipoVivienda === 'edificio' && <span>✓</span>}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        data-testid="vivienda-prequestion-card"
        className="rounded-3xl border-3 border-[#0b3d2e] bg-gradient-to-b from-[#fef9c3] via-[#fffbeb] to-white p-3.5 sm:p-4 shadow-md space-y-3"
      >
        <div className="flex items-start gap-2.5">
          <span className="w-7 h-7 rounded-full bg-[#062319] text-[#ffd778] font-black text-xs sm:text-sm flex items-center justify-center shrink-0 mt-0.5">
            ?
          </span>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#b45309] block">
              Pregunta rápida antes de completar el formulario
            </span>
            <h4 className="text-sm sm:text-base font-black text-[#062319] leading-snug mt-0.5">
              Antes de completar el formulario, ¿podrías responder por favor: ¿vivís en un edificio o vivís en una casa independiente?
            </h4>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            data-testid="btn-vivienda-casa"
            onClick={() => {
              activateFullscreenFocus();
              setTipoVivienda('casa');
              setHasAnsweredVivienda(true);
              setValidationNotice('');
            }}
            className={`p-3 sm:p-3.5 rounded-2xl border-3 text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
              tipoVivienda === 'casa'
                ? 'bg-[#062319] border-[#16a34a] text-white shadow-[0_6px_16px_rgba(22,163,74,0.3)] scale-[1.01]'
                : 'bg-white border-stone-300 text-stone-800 hover:border-[#0b3d2e]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-2xl shrink-0">🏠</span>
              <div className="min-w-0">
                <span
                  className={`text-xs sm:text-sm font-black block leading-tight ${
                    tipoVivienda === 'casa' ? 'text-[#ffd778]' : 'text-[#062319]'
                  }`}
                >
                  Vivo en una Casa Independiente
                </span>
                <span
                  className={`text-[11px] font-bold block mt-0.5 ${
                    tipoVivienda === 'casa' ? 'text-emerald-200' : 'text-stone-500'
                  }`}
                >
                  Formulario normal de casa y barrio
                </span>
              </div>
            </div>
            {tipoVivienda === 'casa' && (
              <span className="bg-[#16a34a] text-white text-[10px] font-black px-2 py-1 rounded-lg shrink-0">
                ✓ ELEGIDO
              </span>
            )}
          </button>

          <button
            type="button"
            data-testid="btn-vivienda-edificio"
            onClick={() => {
              activateFullscreenFocus();
              setTipoVivienda('edificio');
              setHasAnsweredVivienda(true);
              setValidationNotice('');
            }}
            className={`p-3 sm:p-3.5 rounded-2xl border-3 text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
              tipoVivienda === 'edificio'
                ? 'bg-[#062319] border-[#e8b23a] text-white shadow-[0_6px_16px_rgba(232,178,58,0.35)] scale-[1.01]'
                : 'bg-white border-stone-300 text-stone-800 hover:border-[#0b3d2e]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-2xl shrink-0">🏢</span>
              <div className="min-w-0">
                <span
                  className={`text-xs sm:text-sm font-black block leading-tight ${
                    tipoVivienda === 'edificio' ? 'text-[#ffd778]' : 'text-[#062319]'
                  }`}
                >
                  Vivo en un Edificio / Dpto.
                </span>
                <span
                  className={`text-[11px] font-bold block mt-0.5 ${
                    tipoVivienda === 'edificio' ? 'text-amber-200' : 'text-stone-500'
                  }`}
                >
                  Formulario de edificio, piso y recepción
                </span>
              </div>
            </div>
            {tipoVivienda === 'edificio' && (
              <span className="bg-[#e8b23a] text-[#062319] text-[10px] font-black px-2 py-1 rounded-lg shrink-0">
                ✓ ELEGIDO
              </span>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderFormCardContent = (isFullscreenMode: boolean) => (
    <div
      className={
        isFullscreenMode
          ? 'w-full max-w-2xl mx-auto h-full flex flex-col bg-white sm:rounded-3xl sm:border-3 sm:border-[#e8b23a] shadow-[0_25px_70px_rgba(0,0,0,0.65)] overflow-hidden'
          : 'bg-white rounded-3xl border-3 border-[#0b3d2e] shadow-2xl overflow-hidden'
      }
    >
      {/* Top App Header Bar — Includes Prominent Top-Right "Salir" Button in Fullscreen */}
      <div className="bg-gradient-to-r from-[#041a12] via-[#0b3d2e] to-[#041a12] text-white py-3 sm:py-4 px-4 sm:px-6 flex items-center justify-between gap-2 border-b-2 border-[#e8b23a] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full bg-[#25D366] animate-pulse shrink-0" />
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#ffd778] block truncate">
              {isFullscreenMode ? 'Centro Oficial de Solicitud' : 'Pedido Express · Pago al Recibir'}
            </span>
            <span className="text-[11px] sm:text-xs text-emerald-200 font-bold block truncate">
              Envío 100% Gratis · Pagás recién al recibir
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
              aria-label="Salir del formulario y volver a la página"
              className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-xs sm:text-sm px-3.5 py-2 rounded-xl border-2 border-white/40 shadow-[0_4px_12px_rgba(220,38,38,0.5)] cursor-pointer transition-all"
            >
              <X className="w-4 h-4 stroke-[3]" />
              <span>Salir</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Live Guidance Banner ("Llevándole de la mano") */}
      <div className="bg-gradient-to-r from-[#fef9c3] via-[#fef08a] to-[#fde047] text-[#062319] px-4 py-2.5 border-b border-[#eab308] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-black leading-snug">
          <Sparkles className="w-4 h-4 text-[#b45309] shrink-0" />
          <span>{activeGuidanceText}</span>
        </div>
        {!orderComplete && (
          <span className="text-[11px] font-black uppercase bg-[#062319] text-[#ffd778] px-2.5 py-0.5 rounded-full shrink-0">
            Paso {step}/2
          </span>
        )}
      </div>

      {/* Main Form Body */}
      <div
        className={
          isFullscreenMode
            ? 'flex-1 overflow-y-auto p-4 sm:p-6 space-y-4'
            : 'p-5 sm:p-8 space-y-5'
        }
      >
        {/* Quick Pack Selector Bar (Shown in Step 1) */}
        {!orderComplete && step === 1 && (
          <div className="bg-[#f6f4ee] border-2 border-[#dfdad0] rounded-2xl p-2.5 sm:p-3">
            <div className="flex items-center justify-between text-xs font-black uppercase text-stone-600 mb-2 px-1">
              <span>Pack seleccionado (Tocá para cambiar):</span>
              <span className="text-[#0a7a4a]">🚚 Envío Gratis</span>
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
                    onClick={() => {
                      activateFullscreenFocus();
                      setSelectedPack(packNum);
                    }}
                    className={`p-2 sm:p-2.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#062319] border-[#e8b23a] text-white shadow-md scale-[1.02]'
                        : 'bg-white border-stone-300 text-stone-800 hover:border-[#0b3d2e]'
                    }`}
                  >
                    <div
                      className={`text-xs sm:text-sm font-black leading-tight ${
                        isSelected ? 'text-[#ffd778]' : 'text-[#062319]'
                      }`}
                    >
                      {packNum === 1 ? '1 Unidad' : `Pack ${packNum}X`}
                    </div>
                    <div
                      className={`text-xs sm:text-sm font-extrabold mt-0.5 ${
                        isSelected ? 'text-white' : 'text-stone-700'
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

        {/* Validation Notice Banner */}
        {validationNotice && (
          <div className="bg-red-50 border-2 border-red-500 text-red-900 rounded-2xl px-4 py-3 text-xs sm:text-sm font-black flex items-center justify-between gap-2">
            <span>⚠️ {validationNotice}</span>
            <button
              type="button"
              onClick={() => setValidationNotice('')}
              className="text-red-700 font-black px-2 py-0.5 rounded hover:bg-red-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {orderComplete ? (
          /* Order Success State */
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#e5f6ec] text-[#0a7a4a] flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-[#062319]">
              ¡Tu pedido #{orderComplete.reservaid} está confirmado!
            </h3>

            <div className="max-w-md mx-auto bg-[#f6f4ee] border-2 border-[#cde6d7] rounded-2xl p-4 text-left space-y-2.5">
              <div className="text-sm sm:text-base text-stone-800">
                <span className="font-bold text-stone-500 block text-xs uppercase">
                  Producto confirmado:
                </span>
                <b className="text-[#062319] font-black">{confirmedProductTitle}</b>
              </div>
              <div className="text-sm sm:text-base text-stone-800 border-t border-stone-200 pt-2.5 flex justify-between">
                <span className="font-bold text-stone-600">Cantidad confirmada:</span>
                <b className="text-[#062319] font-black">
                  {confirmedPackCount} {confirmedPackCount > 1 ? 'unidades' : 'unidad'} (
                  {formatGs(confirmedTotalAmount)})
                </b>
              </div>
              <div className="text-xs sm:text-sm text-stone-800 border-t border-stone-200 pt-2.5 flex justify-between">
                <span className="font-bold text-stone-600">Modalidad de entrega:</span>
                <b className="text-[#062319] font-black">
                  {isBuilding
                    ? `🏢 Edificio ${nombreEdificio} (Piso ${pisoEdificio} · Dpto. ${departamentoNumero})`
                    : '🏠 Casa Independiente'}
                </b>
              </div>
              {confirmedGpsLink && (
                <div className="text-xs sm:text-sm text-white bg-[#16a34a] border-2 border-[#15803d] rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <span className="font-black">
                    📍 Ubicación de tu {isBuilding ? 'Edificio' : 'Casa'} Registrada
                  </span>
                  <span className="bg-white text-[#065f46] text-[10px] font-black px-2 py-0.5 rounded-full">
                    ✓ ENVIADO AL COURIER
                  </span>
                </div>
              )}
            </div>

            <p className="text-stone-800 text-sm sm:text-base font-medium max-w-md mx-auto leading-relaxed bg-[#eefaf3] border-2 border-[#86efac] rounded-2xl p-4">
              En breves minutos, nuestro <b>agente de confirmación y empaquetado</b> te escribirá a tu WhatsApp (<b>{confirmedClientPhone}</b>) con todos los datos de tu {isBuilding ? 'edificio' : 'casa'} listos.
            </p>

            {isFullscreenMode && (
              <button
                type="button"
                onClick={handleExitFullscreen}
                className="w-full max-w-md mx-auto bg-[#062319] hover:bg-[#0b3d2e] text-[#ffd778] font-black text-base py-4 rounded-2xl border-2 border-[#e8b23a] cursor-pointer block"
              >
                Volver a la Página Principal
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* PREGUNTA PREVIA ANTES DE COMPLETAR EL FORMULARIO: ¿VIVÍS EN UN EDIFICIO O EN UNA CASA INDEPENDIENTE? */}
            {renderViviendaPreQuestion()}

            {/* Progress Stepper */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 border-2 transition-all cursor-pointer ${
                  step === 1
                    ? 'bg-[#062319] text-[#ffd778] border-[#e8b23a] shadow-sm'
                    : 'bg-[#e5f6ec] text-[#064e3b] border-[#86efac]'
                }`}
              >
                <span>1. Tus Datos</span>
                {nombre.trim() && celular.trim() && (
                  <CheckCircle2 className="w-4 h-4 text-[#25D366] shrink-0" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (nombre.trim() && celular.trim()) setStep(2);
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 border-2 transition-all cursor-pointer ${
                  step === 2
                    ? 'bg-[#062319] text-[#ffd778] border-[#e8b23a] shadow-sm'
                    : 'bg-stone-100 text-stone-500 border-stone-300'
                }`}
              >
                <span>{isBuilding ? '2. Tu Edificio y Entrega' : '2. Tu Casa y Entrega'}</span>
                {gpsConfirmado && <CheckCircle2 className="w-4 h-4 text-[#25D366] shrink-0" />}
              </button>
            </div>

            {step === 1 ? (
              /* STEP 1: CUSTOMER CONTACT */
              <form onSubmit={handleNextStep} className="space-y-4">
                <div>
                  <label className="block text-base sm:text-lg font-black text-stone-900 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <User className="w-5 h-5 text-[#1ea856]" />
                      <span>1. Tu Nombre y Apellido</span>
                      <span className="text-red-500">*</span>
                    </span>
                    {nombre.trim().length >= 3 && (
                      <span className="text-xs font-black text-[#16a34a] bg-[#e5f6ec] px-2.5 py-0.5 rounded-full">
                        ✓ Listo
                      </span>
                    )}
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    required
                    value={nombre}
                    onFocus={activateFullscreenFocus}
                    onClick={activateFullscreenFocus}
                    onChange={(e) => {
                      activateFullscreenFocus();
                      setNombre(e.target.value);
                    }}
                    placeholder="Ej: Carmen Gómez"
                    className="w-full px-4 py-3.5 sm:py-4 border-2 border-[#0b3d2e]/40 focus:border-[#1ea856] bg-[#faf9f5] focus:bg-white rounded-2xl text-base sm:text-lg font-bold text-stone-900 outline-none transition-all focus:ring-4 focus:ring-[#1ea856]/20"
                  />
                </div>

                <div>
                  <label className="block text-base sm:text-lg font-black text-stone-900 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Phone className="w-5 h-5 text-[#1ea856]" />
                      <span>2. Tu Número de WhatsApp / Celular</span>
                      <span className="text-red-500">*</span>
                    </span>
                    {celular.replace(/\D/g, '').length >= 8 && (
                      <span className="text-xs font-black text-[#16a34a] bg-[#e5f6ec] px-2.5 py-0.5 rounded-full">
                        ✓ Listo
                      </span>
                    )}
                  </label>
                  <input
                    type="tel"
                    required
                    value={celular}
                    onFocus={activateFullscreenFocus}
                    onClick={activateFullscreenFocus}
                    onChange={(e) => {
                      activateFullscreenFocus();
                      setCelular(e.target.value);
                    }}
                    placeholder="Ej: 0981 123 456"
                    className="w-full px-4 py-3.5 sm:py-4 border-2 border-[#0b3d2e]/40 focus:border-[#1ea856] bg-[#faf9f5] focus:bg-white rounded-2xl text-base sm:text-lg font-bold text-stone-900 outline-none transition-all focus:ring-4 focus:ring-[#1ea856]/20"
                  />
                  <span className="text-xs sm:text-sm font-bold text-stone-600 block mt-1.5">
                    📱 Nuestro agente y el repartidor te contactarán a este número.
                  </span>
                </div>

                <div className="bg-[#062319] text-white border-2 border-[#e8b23a] rounded-2xl p-3.5 text-center text-sm sm:text-base font-black flex items-center justify-between px-4">
                  <span>
                    Modalidad:{' '}
                    <strong className="text-[#ffd778]">
                      {isBuilding ? '🏢 Edificio' : '🏠 Casa Independiente'}
                    </strong>
                  </span>
                  <span>
                    Total:{' '}
                    <strong className="text-[#ffd778] text-lg sm:text-xl">
                      {formatGs(total)}
                    </strong>
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#1ea856] via-[#22c55e] to-[#158a44] hover:from-[#22b85e] hover:to-[#17964b] text-white font-black text-lg sm:text-xl py-4.5 sm:py-5 rounded-2xl shadow-[0_5px_0_#0d612e,0_12px_24px_rgba(30,168,86,0.35)] active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>
                    {isBuilding
                      ? 'Siguiente: Datos de Mi Edificio'
                      : 'Siguiente: Marcar Mi Casa'}
                  </span>
                  <ArrowRight className="w-6 h-6" />
                </button>
              </form>
            ) : (
              /* ===================================================================== */
              /* STEP 2: PURE RED (UNCONFIRMED) -> PURE GREEN (CONFIRMED) + FORMULARIO */
              /* ===================================================================== */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* =================================================================== */}
                {/* PASO A: BOTÓN Y MAPA DE UBICACIÓN — 100% ROJO PURO O 100% VERDE PURO */}
                {/* (SIN MEZCLAR ROJO CON VERDE JAMÁS)                                   */}
                {/* =================================================================== */}
                <div
                  data-testid="gps-status-container"
                  className={`rounded-3xl border-4 p-4 sm:p-5 transition-all space-y-3.5 ${
                    gpsConfirmado
                      ? 'border-[#16a34a] bg-[#ecfdf5] shadow-[0_12px_32px_rgba(22,163,74,0.28)]'
                      : 'border-[#dc2626] bg-[#fef2f2] shadow-[0_12px_32px_rgba(220,38,38,0.25)]'
                  }`}
                >
                  {/* Top Prominent Status Callout: Pure Red vs Pure Green */}
                  <div
                    className={`flex items-start gap-3 rounded-2xl p-3.5 border-2 ${
                      gpsConfirmado
                        ? 'bg-[#16a34a] text-white border-[#15803d]'
                        : 'bg-[#dc2626] text-white border-[#991b1b]'
                    }`}
                  >
                    <div
                      className={`px-2.5 py-1 rounded-xl font-black text-xs uppercase shrink-0 border-2 ${
                        gpsConfirmado
                          ? 'bg-white text-[#065f46] border-white'
                          : 'bg-white text-[#991b1b] border-white'
                      }`}
                    >
                      {gpsConfirmado ? '✓ CONFIRMADO' : 'PASO 1 OBLIGATORIO'}
                    </div>
                    <p className="text-xs sm:text-sm font-black leading-snug">
                      {!gpsConfirmado ? (
                        <>
                          Hola <span className="underline">{firstName}</span>: tocá el{' '}
                          <span className="underline">BOTÓN ROJO DE ABAJO</span> para marcar{' '}
                          {isBuilding ? 'tu edificio' : 'tu casa'} en el mapa y rellenar tu calle automáticamente.
                        </>
                      ) : (
                        <>
                          ¡EXCELENTE <span className="underline">{firstName.toUpperCase()}</span>! TU MAPA Y UBICACIÓN YA ESTÁN 100% CONFIRMADOS EN VERDE. Si el pin no está exacto sobre {isBuilding ? 'tu edificio' : 'tu techo'}, mové el mapa con el dedo.
                        </>
                      )}
                    </p>
                  </div>

                  {/* THE PROMINENT PURE RED (UNCONFIRMED) OR PURE GREEN (CONFIRMED) BUTTON */}
                  <button
                    type="button"
                    data-testid="btn-gps-map-action"
                    onClick={handleOneClickGpsLocation}
                    disabled={gpsLoading}
                    className={`w-full py-4 sm:py-5 px-4 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3 transition-all cursor-pointer border-3 ${
                      gpsConfirmado
                        ? 'bg-[#16a34a] hover:bg-[#15803d] text-white border-white shadow-[0_6px_0_#065f46,0_12px_25px_rgba(22,163,74,0.45)]'
                        : 'bg-[#dc2626] hover:bg-[#b91c1c] text-white border-white shadow-[0_6px_0_#7f1d1d,0_12px_25px_rgba(220,38,38,0.5)] animate-pulse'
                    }`}
                  >
                    <Crosshair className={`w-6 h-6 shrink-0 ${gpsLoading ? 'animate-spin' : ''}`} />
                    <span>
                      {gpsLoading
                        ? `Ubicando ${isBuilding ? 'tu edificio' : 'tu casa'} en el mapa, ${firstName}...`
                        : gpsConfirmado
                          ? `✅ UBICACIÓN CONFIRMADA (TOCÁ SI QUERÉS RE-CENTRAR ${isBuilding ? 'TU EDIFICIO' : 'TU CASA'})`
                          : `📍 TOCÁ AQUÍ PARA MARCAR ${isBuilding ? 'TU EDIFICIO' : 'TU CASA'} EN EL MAPA`}
                    </span>
                  </button>

                  {/* SINGLE SATELLITE + PIN MAP WITH 100% PURE GREEN CONFIRMED BANNER */}
                  {gpsConfirmado && gpsLat !== null && gpsLng !== null && tileData && (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="rounded-2xl overflow-hidden border-4 border-[#16a34a] shadow-[0_0_28px_rgba(22,163,74,0.5)] bg-[#064e3b] flex flex-col select-none">
                        {/* ================================================================= */}
                        {/* 100% PURE GREEN CONFIRMATION BANNER STRIP AT THE TOP OF THE MAP   */}
                        {/* ================================================================= */}
                        <div
                          data-testid="gps-confirmed-green-banner"
                          className="bg-[#15803d] text-white px-4 py-3 border-b-2 border-[#86efac] shadow-md shrink-0"
                        >
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 bg-white text-[#065f46] text-xs font-black uppercase px-3 py-1 rounded-full shadow-xs shrink-0">
                              <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                              <span>MAPA CONFIRMADO</span>
                            </span>
                            <span className="text-xs sm:text-sm font-black uppercase tracking-wide text-white leading-tight">
                              ¡La ubicación de {isBuilding ? 'tu edificio' : 'tu casa'} ya quedó guardada!
                            </span>
                          </div>
                          <p className="text-xs font-bold text-emerald-100 leading-snug mt-1.5">
                            ✅ <b>{firstName}</b>, ya guardamos tu punto GPS exacto. Ahora completá o revisá los datos de {isBuilding ? 'tu edificio' : 'tu dirección'} acá abajo.
                          </p>
                        </div>

                        {/* Unobstructed Interactive Satellite Canvas */}
                        <div className="relative w-full h-52 sm:h-60 overflow-hidden">
                          <div
                            ref={mapContainerRef}
                            onPointerDown={handleMapPointerDown}
                            onPointerMove={handleMapPointerMove}
                            onPointerUp={handleMapPointerUp}
                            title="Mové el mapa con el dedo o tocá el punto exacto"
                            className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing touch-none"
                          >
                            {/* 3x3 Real Satellite Roofs + Street Names */}
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

                            {/* Center Pin in 100% Pure Green on Customer's Roof / Building */}
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                              <div className="w-16 h-16 rounded-full bg-[#22c55e]/30 border-2 border-[#22c55e] animate-pulse" />
                            </div>

                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none flex flex-col items-center">
                              <div className="bg-[#16a34a] text-white border-2 border-white text-[11px] font-black px-3 py-1 rounded-full shadow-lg whitespace-nowrap mb-1 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                <span>
                                  {isBuilding
                                    ? '🏢 ¡EDIFICIO UBICADO Y CONFIRMADO!'
                                    : '🏠 ¡CASA UBICADA Y CONFIRMADA!'}
                                </span>
                              </div>
                              <div className="w-10 h-10 rounded-full bg-[#16a34a] border-3 border-white shadow-2xl flex items-center justify-center text-white">
                                <MapPin className="w-5 h-5 fill-white text-[#16a34a]" />
                              </div>
                              <div className="w-3.5 h-1.5 rounded-full bg-black/60 mt-0.5" />
                            </div>
                          </div>

                          {/* Clear Zoom In / Out Buttons */}
                          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-10">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMapZoom((z) => Math.min(19, z + 1));
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-[#064e3b]/95 text-white border border-[#86efac] flex items-center gap-1 text-xs font-black shadow-md cursor-pointer active:scale-95"
                              title="Acercar mapa"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Acercar</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMapZoom((z) => Math.max(14, z - 1));
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-[#064e3b]/95 text-white border border-white/30 flex items-center gap-1 text-xs font-black shadow-md cursor-pointer active:scale-95"
                              title="Alejar mapa"
                            >
                              <Minus className="w-4 h-4" />
                              <span>Alejar</span>
                            </button>
                          </div>

                          {/* Bottom Map Strip */}
                          <div className="absolute bottom-2 left-2 right-2 bg-[#15803d]/95 border border-white text-white text-[11px] sm:text-xs font-black px-3 py-1.5 rounded-xl text-center pointer-events-none">
                            👆 Si querés ajustar el punto, mové el mapa · 👇 Si está bien, seguí al Paso 2 abajo
                          </div>
                        </div>
                      </div>

                      {/* Pure Green High-Impact Action Strip below the map */}
                      <button
                        type="button"
                        onClick={() =>
                          isBuilding
                            ? edificioInputRef.current?.focus()
                            : direccionInputRef.current?.focus()
                        }
                        className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white rounded-2xl p-3.5 border-3 border-white shadow-[0_5px_0_#065f46] flex items-center justify-between gap-2 text-left cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-full bg-white text-[#15803d] flex items-center justify-center font-black shrink-0">
                            ✓
                          </span>
                          <div className="min-w-0">
                            <span className="text-xs sm:text-sm font-black text-white block leading-tight uppercase">
                              ¡MAPA Y DIRECCIÓN CONFIRMADOS EN VERDE!
                            </span>
                            <span className="text-[11px] sm:text-xs text-emerald-100 font-bold block truncate">
                              👇 Tocá acá para completar los datos de {isBuilding ? 'tu edificio' : 'tu calle'} abajo
                            </span>
                          </div>
                        </div>
                        <span className="bg-white text-[#065f46] text-xs font-black px-3 py-1.5 rounded-xl shrink-0">
                          Seguir ↓
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* =================================================================== */}
                {/* PASO B: FORMULARIO DIFERENCIADO SEGÚN VIVA EN EDIFICIO O CASA       */}
                {/* =================================================================== */}
                {isBuilding ? (
                  /* FORMULARIO EXCLUSIVO Y CONTUNDENTE PARA CLIENTES QUE VIVEN EN EDIFICIO */
                  <div
                    data-testid="building-specific-fields"
                    className="rounded-3xl border-3 border-[#0b3d2e] bg-[#f8fafc] p-4 sm:p-5 space-y-3.5 shadow-sm"
                  >
                    <div className="flex items-start gap-2.5 bg-[#062319] text-white rounded-2xl p-3.5 border-2 border-[#e8b23a]">
                      <div className="w-7 h-7 rounded-full bg-[#e8b23a] text-[#062319] font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </div>
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-[#ffd778] block">
                          🏢 Formulario Especial para Entrega en Edificio
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-emerald-100 leading-snug mt-0.5">
                          <b>{firstName}</b>, como vivís en un edificio, respondé por favor estas preguntas exactas para que el repartidor y nuestro agente registren tu entrega sin errores:
                        </p>
                      </div>
                    </div>

                    {/* 1. Nombre del Edificio (Full width for clean visual hierarchy) */}
                    <div>
                      <label className="block text-xs sm:text-sm font-black text-stone-900 mb-1">
                        🏢 ¿Cómo se llama el edificio? <span className="text-red-600">*</span>
                      </label>
                      <input
                        ref={edificioInputRef}
                        type="text"
                        required
                        value={nombreEdificio}
                        onFocus={activateFullscreenFocus}
                        onChange={(e) => {
                          activateFullscreenFocus();
                          setNombreEdificio(e.target.value);
                        }}
                        placeholder="Ej: Edificio Fortaleza / Torre Miranda"
                        className="w-full px-3.5 py-3 border-2 border-[#0b3d2e] focus:border-[#16a34a] bg-white rounded-2xl text-sm sm:text-base font-bold text-stone-900 outline-none"
                      />
                    </div>

                    {/* 2. Piso + 3. Departamento/Cuarto (Aligned 2-column grid) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs sm:text-sm font-black text-stone-900 mb-1">
                          🔢 ¿En qué piso estás? <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={pisoEdificio}
                          onFocus={activateFullscreenFocus}
                          onChange={(e) => {
                            activateFullscreenFocus();
                            setPisoEdificio(e.target.value);
                          }}
                          placeholder="Ej: Piso 5"
                          className="w-full px-3.5 py-3 border-2 border-[#0b3d2e] focus:border-[#16a34a] bg-white rounded-2xl text-sm sm:text-base font-bold text-stone-900 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-black text-stone-900 mb-1">
                          🚪 ¿N° de Departamento o Cuarto? <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={departamentoNumero}
                          onFocus={activateFullscreenFocus}
                          onChange={(e) => {
                            activateFullscreenFocus();
                            setDepartamentoNumero(e.target.value);
                          }}
                          placeholder="Ej: Dpto. 502 / Cuarto 5B"
                          className="w-full px-3.5 py-3 border-2 border-[#0b3d2e] focus:border-[#16a34a] bg-white rounded-2xl text-sm sm:text-base font-bold text-stone-900 outline-none"
                        />
                      </div>
                    </div>

                    {/* 4. ¿En qué calle está ese edificio y en qué ciudad/barrio? */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs sm:text-sm font-black text-stone-900 mb-1">
                          🏙️ Departamento y Ciudad del Edificio <span className="text-red-600">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={departamento}
                            onFocus={activateFullscreenFocus}
                            onChange={(e) => {
                              activateFullscreenFocus();
                              setDepartamento(e.target.value);
                            }}
                            className="w-full px-2.5 py-3 border-2 border-[#cdc8ba] focus:border-[#0b3d2e] rounded-2xl text-xs sm:text-sm font-bold text-stone-900 outline-none bg-white"
                          >
                            {DEPARTAMENTOS_PY.map((dep) => (
                              <option key={dep} value={dep}>
                                {dep}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            required={!gpsConfirmado}
                            value={ciudad}
                            onFocus={activateFullscreenFocus}
                            onChange={(e) => {
                              activateFullscreenFocus();
                              setCiudad(e.target.value);
                            }}
                            placeholder="Ciudad / Barrio"
                            className="w-full px-3 py-3 border-2 border-[#0b3d2e]/40 focus:border-[#16a34a] bg-white rounded-2xl text-xs sm:text-sm font-bold text-stone-900 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-black text-stone-900 mb-1">
                          🛣️ ¿En qué calle está ese edificio? <span className="text-red-600">*</span>
                        </label>
                        <input
                          ref={direccionInputRef}
                          type="text"
                          required={!gpsConfirmado}
                          value={direccion}
                          onFocus={activateFullscreenFocus}
                          onChange={(e) => {
                            activateFullscreenFocus();
                            setDireccion(e.target.value);
                          }}
                          placeholder="Ej: Av. Santa Teresa casi Aviadores del Chaco"
                          className="w-full px-3.5 py-3 border-2 border-[#0b3d2e] focus:border-[#16a34a] bg-white rounded-2xl text-sm sm:text-base font-bold text-stone-900 outline-none"
                        />
                      </div>
                    </div>

                    {/* 5. ¿Tiene recepción? ¿La recepcionista va a recibir? */}
                    <div className="space-y-2 pt-1">
                      <label className="block text-xs sm:text-sm font-black text-stone-900">
                        🛎️ ¿El edificio tiene recepción? ¿La recepcionista va a recibir o recibís vos?
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setTieneRecepcion('si_recepcionista')}
                          className={`p-3 rounded-2xl border-2 text-left text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            tieneRecepcion === 'si_recepcionista'
                              ? 'bg-[#16a34a] text-white border-[#065f46] shadow-xs'
                              : 'bg-white text-stone-800 border-stone-300'
                          }`}
                        >
                          <span>🛎️ Sí tiene recepción (La recepcionista / guardia recibe)</span>
                          {tieneRecepcion === 'si_recepcionista' && <span>✓</span>}
                        </button>

                        <button
                          type="button"
                          onClick={() => setTieneRecepcion('no_personalmente')}
                          className={`p-3 rounded-2xl border-2 text-left text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            tieneRecepcion === 'no_personalmente'
                              ? 'bg-[#16a34a] text-white border-[#065f46] shadow-xs'
                              : 'bg-white text-stone-800 border-stone-300'
                          }`}
                        >
                          <span>🙋 Recibo yo personalmente al llegar el repartidor</span>
                          {tieneRecepcion === 'no_personalmente' && <span>✓</span>}
                        </button>
                      </div>

                      <input
                        type="text"
                        value={detalleRecepcion}
                        onFocus={activateFullscreenFocus}
                        onChange={(e) => setDetalleRecepcion(e.target.value)}
                        placeholder="Opcional: Ej. Dejar en portería con la Srta. Laura / Al lado de Farmacenter"
                        className="w-full px-3.5 py-2.5 border-2 border-stone-300 focus:border-[#16a34a] bg-white rounded-xl text-xs sm:text-sm font-bold text-stone-800 outline-none mt-1.5"
                      />
                    </div>
                  </div>
                ) : (
                  /* FORMULARIO NORMAL PARA CASA INDEPENDIENTE */
                  <div
                    data-testid="house-specific-fields"
                    className="rounded-3xl border-2 border-[#eab308] bg-[#fffbeb] p-3.5 sm:p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2 bg-white border border-[#fde047] rounded-2xl p-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#d97706] text-white font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                          2
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-stone-900 leading-snug">
                          <b className="text-[#b45309] underline">{firstName}</b>, mirá un poco acá
                          abajo tu <b>Barrio y tu Calle</b>: muchas veces el mapa rellena el nombre de
                          la calle equivocadamente.{' '}
                          <span className="text-[#062319] font-black">
                            Revisalo y editalo si hace falta:
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => direccionInputRef.current?.focus()}
                        className="inline-flex items-center gap-1 bg-[#fef08a] hover:bg-[#fde047] text-[#062319] font-black text-xs px-2.5 py-1.5 rounded-xl border border-[#eab308] shrink-0 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                    </div>

                    {/* City & Department Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs sm:text-sm font-black text-stone-900 mb-1 flex items-center gap-1.5">
                          <Building className="w-4 h-4 text-[#1ea856]" />
                          <span>Departamento</span>
                        </label>
                        <select
                          value={departamento}
                          onFocus={activateFullscreenFocus}
                          onChange={(e) => {
                            activateFullscreenFocus();
                            setDepartamento(e.target.value);
                          }}
                          className="w-full px-3.5 py-3 border-2 border-[#cdc8ba] focus:border-[#0b3d2e] rounded-2xl text-sm sm:text-base font-bold text-stone-900 outline-none bg-white"
                        >
                          {DEPARTAMENTOS_PY.map((dep) => (
                            <option key={dep} value={dep}>
                              {dep}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-black text-stone-900 mb-1 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-[#1ea856]" />
                          <span>Tu Ciudad y Barrio (Podés editar)</span>
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={!gpsConfirmado}
                          value={ciudad}
                          onFocus={activateFullscreenFocus}
                          onChange={(e) => {
                            activateFullscreenFocus();
                            setCiudad(e.target.value);
                          }}
                          placeholder="Ej: Luque - Barrio Cuarto Barrio"
                          className="w-full px-3.5 py-3 border-2 border-[#0b3d2e]/40 focus:border-[#16a34a] bg-white rounded-2xl text-sm sm:text-base font-bold text-stone-900 outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* Street & Reference Input */}
                    <div>
                      <label className="block text-xs sm:text-sm font-black text-stone-900 mb-1 flex items-center gap-1.5">
                        <Pencil className="w-4 h-4 text-[#d97706]" />
                        <span>Tu Calle y Referencia de tu Casa (Corregí acá si está mal)</span>
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        ref={direccionInputRef}
                        type="text"
                        required={!gpsConfirmado}
                        value={direccion}
                        onFocus={activateFullscreenFocus}
                        onChange={(e) => {
                          activateFullscreenFocus();
                          setDireccion(e.target.value);
                        }}
                        placeholder="Ej: Calle Boquerón casi España, casa blanca con rejas negras"
                        className="w-full px-3.5 py-3 border-2 border-[#d97706] focus:border-[#16a34a] bg-white rounded-2xl text-sm sm:text-base font-bold text-stone-900 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-xs sm:text-sm font-black text-stone-900 mb-1.5">
                    ¿Cómo preferís pagar al recibir en tu puerta?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <label
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 p-2.5 sm:p-3 rounded-2xl border-2 transition-all cursor-pointer text-xs sm:text-sm font-black text-center ${
                        pago === 'Efectivo al recibir'
                          ? 'bg-[#eefaf3] border-[#0b3d2e] text-[#062319] shadow-xs'
                          : 'bg-[#faf9f5] border-[#cdc8ba] text-stone-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pago"
                        checked={pago === 'Efectivo al recibir'}
                        onChange={() => setPago('Efectivo al recibir')}
                        className="sr-only"
                      />
                      <Banknote className="w-4 h-4 text-[#1ea856] shrink-0" />
                      <span>Efectivo</span>
                    </label>

                    <label
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 p-2.5 sm:p-3 rounded-2xl border-2 transition-all cursor-pointer text-xs sm:text-sm font-black text-center ${
                        pago === 'QR / Transferencia en puerta'
                          ? 'bg-[#eefaf3] border-[#0b3d2e] text-[#062319] shadow-xs'
                          : 'bg-[#faf9f5] border-[#cdc8ba] text-stone-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pago"
                        checked={pago === 'QR / Transferencia en puerta'}
                        onChange={() => setPago('QR / Transferencia en puerta')}
                        className="sr-only"
                      />
                      <QrCode className="w-4 h-4 text-[#1ea856] shrink-0" />
                      <span>QR / ueno</span>
                    </label>

                    <label
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 p-2.5 sm:p-3 rounded-2xl border-2 transition-all cursor-pointer text-xs sm:text-sm font-black text-center ${
                        pago === 'Tarjeta Débito/Crédito al repartidor'
                          ? 'bg-[#eefaf3] border-[#0b3d2e] text-[#062319] shadow-xs'
                          : 'bg-[#faf9f5] border-[#cdc8ba] text-stone-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pago"
                        checked={pago === 'Tarjeta Débito/Crédito al repartidor'}
                        onChange={() => setPago('Tarjeta Débito/Crédito al repartidor')}
                        className="sr-only"
                      />
                      <CreditCard className="w-4 h-4 text-[#1ea856] shrink-0" />
                      <span>Tarjeta POS</span>
                    </label>
                  </div>
                </div>

                {/* PASO 3: FINAL CONFIRMATION BUTTON */}
                <div className="space-y-1.5">
                  <div className="text-xs sm:text-sm font-black text-[#062319] flex items-center gap-1.5 px-1">
                    <span className="w-5 h-5 rounded-full bg-[#062319] text-[#ffd778] text-xs font-black inline-flex items-center justify-center shrink-0">
                      3
                    </span>
                    <span>
                      Ahora sí, <b>{firstName}</b>, dale clic acá abajo para confirmar tu pedido:
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-[#e8b23a] via-[#ffd778] to-[#f59e0b] hover:from-[#ffd778] hover:to-[#e8b23a] text-[#062319] font-black text-base sm:text-xl py-4.5 sm:py-5 rounded-2xl shadow-[0_5px_0_#9c7310,0_12px_24px_rgba(232,178,58,0.4)] active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>
                      {submitting
                        ? 'Confirmando tu pedido...'
                        : `¡CONFIRMAR MI PEDIDO (${formatGs(total)})!`}
                    </span>
                    <Truck className="w-6 h-6 text-[#062319] shrink-0" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full text-center text-xs sm:text-sm font-bold text-stone-600 hover:text-stone-900 pt-1 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver al Paso 1 (Nombre y Teléfono)
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ========================================================================= */}
      {/* FULLSCREEN FOCUS OVERLAY ("EL NÚCLEO Y CENTRO DE LA VERDAD" SIN SCROLL)   */}
      {/* ========================================================================= */}
      {orderFormFullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Formulario de solicitud del producto a pantalla completa"
          className="fixed inset-0 z-[95] w-screen h-[100dvh] bg-[#041a12]/95 backdrop-blur-md flex flex-col justify-center items-center sm:p-4 overflow-hidden animate-fadeIn"
        >
          {renderFormCardContent(true)}
        </div>
      )}

      {/* ========================================================================= */}
      {/* POP-UP MODAL INSTANTÁNEO DE CONFIRMACIÓN DE PEDIDO                        */}
      {/* ========================================================================= */}
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

            <div className="w-18 h-18 rounded-full bg-[#e5f6ec] text-[#0a7a4a] flex items-center justify-center mx-auto mb-4 shadow-inner">
              <CheckCircle2 className="w-11 h-11" />
            </div>

            <span className="inline-block bg-[#e5f6ec] text-[#0a7a4a] text-xs sm:text-sm font-black uppercase tracking-wider px-3.5 py-1 rounded-full mb-2">
              Pedido #{orderComplete.reservaid}
            </span>

            <h3 className="text-2xl sm:text-3xl font-black text-[#062319] tracking-tight">
              ¡Tu pedido está confirmado!
            </h3>

            <div className="mt-4 bg-[#f6f4ee] border-2 border-[#cde6d7] rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-start gap-3">
                <PackageCheck className="w-6 h-6 text-[#1ea856] shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-stone-500 block">
                    Producto confirmado
                  </span>
                  <span className="text-base font-black text-[#062319] leading-snug block">
                    {confirmedProductTitle}
                  </span>
                </div>
              </div>

              <div className="border-t border-stone-200 pt-2.5 flex items-center justify-between text-sm sm:text-base">
                <span className="font-bold text-stone-700">Cantidad confirmada:</span>
                <span className="font-black text-[#062319]">
                  {confirmedPackCount} {confirmedPackCount > 1 ? 'unidades' : 'unidad'} (
                  {formatGs(confirmedTotalAmount)})
                </span>
              </div>

              {confirmedGpsLink && (
                <div className="border-t border-stone-200 pt-2.5 flex items-center justify-between text-xs sm:text-sm text-[#064e3b]">
                  <span className="font-black">
                    📍 Ubicación de tu {isBuilding ? 'Edificio' : 'Casa'}:
                  </span>
                  <span className="bg-[#16a34a] text-white font-black px-2.5 py-0.5 rounded-full">
                    ✓ Confirmada
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 bg-[#062319] text-white rounded-2xl p-4 text-left">
              <p className="text-sm sm:text-base leading-relaxed text-[#e9f7ef] font-medium">
                En breves minutos, un{' '}
                <b className="text-[#ffd778]">
                  agente especializado de nuestro equipo de confirmación y empaquetado
                </b>{' '}
                se pondrá en contacto con vos al WhatsApp{' '}
                <b className="text-white underline">{confirmedClientPhone}</b> con tu ubicación y
                datos listos.
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

      {/* ========================================================================= */}
      {/* INLINE SECTION ON PRODUCT PAGE (AUTO-CENTERS FULLSCREEN ON FOCUS/CLICK)   */}
      {/* ========================================================================= */}
      <section id="pedido" className="py-8 sm:py-12 max-w-3xl mx-auto app-container">
        {renderFormCardContent(false)}
      </section>
    </>
  );
};
