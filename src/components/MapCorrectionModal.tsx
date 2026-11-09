import React, { useState, useEffect, useRef } from 'react';
import { Crosshair, CheckCircle2, MapPin, Copy, Check, MessageCircle, X, Navigation } from 'lucide-react';
import { useStore } from '../context/StoreContext';

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

export const MapCorrectionModal: React.FC = () => {
  const { orders, updateOrder, config } = useStore();
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsConfirmado, setGpsConfirmado] = useState<boolean>(false);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [detectedStreet, setDetectedStreet] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [savedToOrder, setSavedToOrder] = useState<boolean>(false);
  const [mapZoom] = useState<number>(18);

  const [isDraggingMap, setIsDraggingMap] = useState<boolean>(false);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    startXFloat: number;
    startYFloat: number;
    moved: boolean;
  } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const watchTimeoutRef = useRef<number | null>(null);
  const bestAccuracyRef = useRef<number>(999999);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const orderParam = params.get('corregir-mapa');
    if (orderParam) {
      setTargetOrderId(orderParam.trim());
    }
  }, []);

  const matchedOrder = targetOrderId
    ? orders.find(o => o.reservaid === targetOrderId || o.id === targetOrderId)
    : null;

  useEffect(() => {
    if (matchedOrder && gpsLat === null && gpsLng === null) {
      if (typeof matchedOrder.gpsLat === 'number' && typeof matchedOrder.gpsLng === 'number') {
        setGpsLat(matchedOrder.gpsLat);
        setGpsLng(matchedOrder.gpsLng);
      }
    }
  }, [matchedOrder, gpsLat, gpsLng]);

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

  if (!targetOrderId) return null;

  const isBuilding = matchedOrder?.tipoVivienda === 'edificio' || Boolean(matchedOrder?.nombreEdificio);
  const firstName = String(matchedOrder?.nombre || '').trim().split(/\s+/)[0] || 'Cliente';
  const placeLabel = isBuilding ? 'tu edificio' : 'tu casa';

  const newMapUrl =
    gpsLat !== null && gpsLng !== null
      ? `https://www.google.com/maps?q=${gpsLat.toFixed(6)},${gpsLng.toFixed(6)}`
      : '';

  const tileData =
    gpsLat !== null && gpsLng !== null
      ? latLngToTilePixel(gpsLat, gpsLng, mapZoom)
      : null;

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

  const reverseGeocodeCoords = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`
      );
      if (!res.ok) return;
      const data = await res.json();
      const addr = data?.address || {};
      const road = addr.road || addr.pedestrian || addr.residential || '';
      const suburb = addr.suburb || addr.neighbourhood || '';
      const city = addr.city || addr.town || addr.municipality || '';
      const summary = [road, suburb ? `Barrio ${suburb}` : '', city].filter(Boolean).join(', ');
      if (summary) setDetectedStreet(summary);
    } catch {}
  };

  const persistNewMapToOrder = async (lat: number, lng: number) => {
    const cleanLat = Number(lat.toFixed(6));
    const cleanLng = Number(lng.toFixed(6));
    const finalUrl = `https://www.google.com/maps?q=${cleanLat.toFixed(6)},${cleanLng.toFixed(6)}`;
    if (targetOrderId) {
      await updateOrder(targetOrderId, {
        gpsLat: cleanLat,
        gpsLng: cleanLng,
        gpsLink: finalUrl,
        gpsConfirmado: true
      } as any);
      setSavedToOrder(true);
    }
  };

  const handleOneClickGpsLocation = () => {
    stopGpsWatch();
    setGpsLoading(true);
    bestAccuracyRef.current = 999999;

    const applyCoordinates = (lat: number, lng: number) => {
      const cleanLat = Number(lat.toFixed(6));
      const cleanLng = Number(lng.toFixed(6));
      setGpsLat(cleanLat);
      setGpsLng(cleanLng);
      setGpsConfirmado(true);
      setGpsLoading(false);
      reverseGeocodeCoords(cleanLat, cleanLng);
      persistNewMapToOrder(cleanLat, cleanLng);
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      let receivedAnyFix = false;
      const wId = navigator.geolocation.watchPosition(
        pos => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy || 50;
          if (!receivedAnyFix || acc <= bestAccuracyRef.current || acc <= 25) {
            receivedAnyFix = true;
            bestAccuracyRef.current = Math.min(bestAccuracyRef.current, acc);
            applyCoordinates(lat, lng);
          }
          if (acc <= 14) {
            stopGpsWatch();
          }
        },
        () => {
          stopGpsWatch();
          if (!receivedAnyFix) {
            applyCoordinates(-25.2867, -57.647);
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
      watchIdRef.current = wId;
      watchTimeoutRef.current = window.setTimeout(() => {
        stopGpsWatch();
      }, 6500);
    } else {
      applyCoordinates(-25.2867, -57.647);
    }
  };

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
      persistNewMapToOrder(gpsLat, gpsLng);
    } else if (mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const deltaPxX = clickX - rect.width / 2;
      const deltaPxY = clickY - rect.height / 2;
      const currentTile = latLngToTilePixel(gpsLat, gpsLng, mapZoom);
      const nextCoords = tileFloatToLatLng(
        currentTile.xFloat + deltaPxX / 256,
        currentTile.yFloat + deltaPxY / 256,
        mapZoom
      );
      const cleanLat = Number(nextCoords.lat.toFixed(6));
      const cleanLng = Number(nextCoords.lng.toFixed(6));
      setGpsLat(cleanLat);
      setGpsLng(cleanLng);
      setGpsConfirmado(true);
      reverseGeocodeCoords(cleanLat, cleanLng);
      persistNewMapToOrder(cleanLat, cleanLng);
    }
  };

  const handleCopyAndConfirmUrl = async () => {
    if (!newMapUrl || gpsLat === null || gpsLng === null) return;
    await persistNewMapToOrder(gpsLat, gpsLng);
    try {
      await navigator.clipboard.writeText(newMapUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 4000);
    } catch {}
  };

  const sellerWaDigits = String(matchedOrder?.waVendedor || config.wa || '595973532550').replace(/\D/g, '');
  const whatsappReturnHref = newMapUrl
    ? `https://wa.me/${sellerWaDigits}?text=${encodeURIComponent(
        `✅ Ya corregí y confirmé la ubicación exacta de ${placeLabel} en el mapa: ${newMapUrl}`
      )}`
    : '#';

  const handleClose = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('corregir-mapa');
    window.history.replaceState({}, '', url.toString());
    setTargetOrderId(null);
  };

  return (
    <div
      data-testid="map-correction-modal"
      className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-slate-900 border-2 border-emerald-500/70 rounded-3xl shadow-2xl overflow-hidden text-white my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 px-4 py-3.5 flex items-center justify-between border-b border-emerald-400/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wide">
                Localizador Satelital de {isBuilding ? 'Edificio' : 'Casa'}
              </h2>
              <p className="text-[11px] text-emerald-100 font-semibold">
                Pedido #{targetOrderId} · {firstName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg bg-black/25 hover:bg-black/40 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3 text-xs sm:text-sm leading-relaxed text-slate-200">
            <p className="font-bold text-white mb-1">
              👋 Hola {firstName}, seguí estos 3 pasos rápidos para corregir tu mapa:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-slate-300 text-xs">
              <li>
                Tocá el <b>botón de abajo</b> para localizar {placeLabel} con el GPS.
              </li>
              <li>
                Si querés ajustar el pin, <b>mové el mapa satelital con el dedo</b> hasta que quede exacto sobre tu techo.
              </li>
              <li>
                Tocá en <b>&ldquo;Copiar Nueva URL&rdquo;</b> o <b>&ldquo;Enviar al Agente por WhatsApp&rdquo;</b> para reemplazar el mapa anterior.
              </li>
            </ol>
          </div>

          {/* THE EXACT SAME 1-CLICK SATELLITE GPS BUTTON FROM THE FORM */}
          <button
            type="button"
            data-testid="btn-correct-gps-map-action"
            onClick={handleOneClickGpsLocation}
            disabled={gpsLoading}
            className={`w-full py-4 px-4 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer border-2 ${
              gpsConfirmado
                ? 'bg-[#16a34a] hover:bg-[#15803d] text-white border-white shadow-[0_5px_0_#065f46]'
                : 'bg-[#dc2626] hover:bg-[#b91c1c] text-white border-white shadow-[0_5px_0_#7f1d1d] animate-pulse'
            }`}
          >
            <Crosshair className={`w-5 h-5 shrink-0 ${gpsLoading ? 'animate-spin' : ''}`} />
            <span>
              {gpsLoading
                ? `Ubicando ${placeLabel} en el mapa satelital...`
                : gpsConfirmado
                  ? `✅ UBICACIÓN LOCALIZADA (TOCÁ PARA RE-CENTRAR)`
                  : `📍 1. TOCÁ AQUÍ PARA LOCALIZAR ${placeLabel.toUpperCase()} EN EL MAPA`}
            </span>
          </button>

          {/* INTERACTIVE SATELLITE ROOF MAP */}
          {gpsLat !== null && gpsLng !== null && tileData && (
            <div className="space-y-3">
              <div className="rounded-2xl overflow-hidden border-3 border-[#16a34a] bg-[#064e3b] flex flex-col select-none">
                <div className="bg-[#15803d] text-white px-3.5 py-2 border-b border-[#86efac] flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 bg-white text-[#065f46] text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
                    <span>2. MOVÉ EL MAPA HASTA TU TECHO</span>
                  </span>
                  {savedToOrder && (
                    <span className="text-[11px] font-bold text-emerald-100">
                      ✓ Guardado en tu pedido
                    </span>
                  )}
                </div>

                <div className="relative w-full h-56 overflow-hidden">
                  <div
                    ref={mapContainerRef}
                    onPointerDown={handleMapPointerDown}
                    onPointerMove={handleMapPointerMove}
                    onPointerUp={handleMapPointerUp}
                    className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing touch-none"
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
                      {[-1, 0, 1].map(dy =>
                        [-1, 0, 1].map(dx => {
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

                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-[#22c55e]/30 border-2 border-[#22c55e] animate-pulse" />
                    </div>

                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none flex flex-col items-center">
                      <div className="bg-[#16a34a] text-white border-2 border-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap mb-1">
                        {isBuilding ? '🏢 TU EDIFICIO AQUÍ' : '🏠 TU CASA AQUÍ'}
                      </div>
                      <div className="w-9 h-9 rounded-full bg-[#16a34a] border-2 border-white shadow-2xl flex items-center justify-center text-white">
                        <MapPin className="w-5 h-5 fill-white text-[#16a34a]" />
                      </div>
                    </div>
                  </div>
                </div>

                {detectedStreet && (
                  <div className="bg-slate-900/90 px-3.5 py-2 text-[11px] text-emerald-200 border-t border-emerald-500/30">
                    📍 Referencia detectada: <b>{detectedStreet}</b>
                  </div>
                )}
              </div>

              {/* NEW URL BOX + COPY & SEND BACK TO WHATSAPP */}
              <div className="bg-slate-950 border border-emerald-500/50 rounded-2xl p-3 space-y-2.5">
                <div className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
                  3. Tu Nueva URL Confirmada del Mapa:
                </div>
                <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-emerald-200 break-all select-all">
                  {newMapUrl}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="btn-copy-corrected-map-url"
                    onClick={handleCopyAndConfirmUrl}
                    className="w-full py-3 px-3 rounded-xl font-black text-xs uppercase bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>¡URL Copiada! Pegala en WhatsApp</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar Nueva URL del Mapa</span>
                      </>
                    )}
                  </button>

                  <a
                    href={whatsappReturnHref}
                    onClick={() => {
                      if (gpsLat !== null && gpsLng !== null) {
                        persistNewMapToOrder(gpsLat, gpsLng);
                      }
                    }}
                    className="w-full py-3 px-3 rounded-xl font-black text-xs uppercase bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-2 transition-colors shadow-md text-center"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Enviar al Agente en WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
