export type OrderGpsFuente =
  | 'gps_dispositivo'
  | 'mapa_manual'
  | 'whatsapp_pin'
  | 'geocodificacion_direccion';

const DEPARTMENT_DISPLAY_NAMES: Record<string, string> = {
  'asuncion': 'Asunción (Capital)',
  'asuncion capital': 'Asunción (Capital)',
  'capital': 'Asunción (Capital)',
  'central': 'Central',
  'alto parana': 'Alto Paraná',
  'caaguazu': 'Caaguazú',
  'itapua': 'Itapúa',
  'cordillera': 'Cordillera',
  'paraguari': 'Paraguarí',
  'guaira': 'Guairá',
  'san pedro': 'San Pedro',
  'concepcion': 'Concepción',
  'amambay': 'Amambay',
  'caazapa': 'Caazapá',
  'misiones': 'Misiones',
  'neembucu': 'Ñeembucú',
  'canindeyu': 'Canindeyú',
  'presidente hayes': 'Presidente Hayes',
  'pte hayes': 'Presidente Hayes',
  'boqueron': 'Boquerón',
  'alto paraguay': 'Alto Paraguay',
};

const CITY_TO_DEPARTMENT: Record<string, string> = {
  // Capital
  'asuncion': 'Asunción (Capital)',
  // Central
  'san lorenzo': 'Central',
  'luque': 'Central',
  'lambare': 'Central',
  'capiata': 'Central',
  'fernando de la mora': 'Central',
  'limpio': 'Central',
  'nemby': 'Central',
  'villa elisa': 'Central',
  'mariano roque alonso': 'Central',
  'mra': 'Central',
  'itaugua': 'Central',
  'ita': 'Central',
  'san antonio': 'Central',
  'ypane': 'Central',
  'j augusto saldivar': 'Central',
  'augusto saldivar': 'Central',
  'julian augusto saldivar': 'Central',
  'aregua': 'Central',
  'guarambare': 'Central',
  'villeta': 'Central',
  'ypacarai': 'Central',
  'nueva italia': 'Central',
  // Alto Paraná
  'ciudad del este': 'Alto Paraná',
  'cde': 'Alto Paraná',
  'hernandarias': 'Alto Paraná',
  'minga guazu': 'Alto Paraná',
  'presidente franco': 'Alto Paraná',
  'pte franco': 'Alto Paraná',
  'santa rita': 'Alto Paraná',
  'naranjal': 'Alto Paraná',
  'san alberto': 'Alto Paraná',
  'itakyry': 'Alto Paraná',
  'juan leon mallorquin': 'Alto Paraná',
  'juan e o leary': 'Alto Paraná',
  'oleary': 'Alto Paraná',
  'minga pora': 'Alto Paraná',
  'san cristobal': 'Alto Paraná',
  'los cedrales': 'Alto Paraná',
  'yguazu': 'Alto Paraná',
  // Caaguazú
  'coronel oviedo': 'Caaguazú',
  'cnel oviedo': 'Caaguazú',
  'caaguazu': 'Caaguazú',
  'j eulogio estigarribia': 'Caaguazú',
  'campo 9': 'Caaguazú',
  'repatriacion': 'Caaguazú',
  'san jose de los arroyos': 'Caaguazú',
  'carayao': 'Caaguazú',
  'yhu': 'Caaguazú',
  'vaqueria': 'Caaguazú',
  'juan manuel frutos': 'Caaguazú',
  // Itapúa
  'encarnacion': 'Itapúa',
  'cambyreta': 'Itapúa',
  'hohenau': 'Itapúa',
  'obligado': 'Itapúa',
  'bella vista itapua': 'Itapúa',
  'natalio': 'Itapúa',
  'maria auxiliadora': 'Itapúa',
  'tomas romero pereira': 'Itapúa',
  'coronel bogado': 'Itapúa',
  'fram': 'Itapúa',
  'san cosme y damian': 'Itapúa',
  'carmen del parana': 'Itapúa',
  'capitan miranda': 'Itapúa',
  'san pedro del parana': 'Itapúa',
  'mayor otano': 'Itapúa',
  // Cordillera
  'caacupe': 'Cordillera',
  'piribebuy': 'Cordillera',
  'tobati': 'Cordillera',
  'atyra': 'Cordillera',
  'altos': 'Cordillera',
  'san bernardino': 'Cordillera',
  'eusebio ayala': 'Cordillera',
  'arroyos y esteros': 'Cordillera',
  'emboscada': 'Cordillera',
  'itacurubi de la cordillera': 'Cordillera',
  'caraguatay': 'Cordillera',
  'valenzuela': 'Cordillera',
  // Paraguarí
  'paraguari': 'Paraguarí',
  'carapegua': 'Paraguarí',
  'yaguaron': 'Paraguarí',
  'pirayu': 'Paraguarí',
  'quiindy': 'Paraguarí',
  'ybycui': 'Paraguarí',
  'acahay': 'Paraguarí',
  'la colmena': 'Paraguarí',
  'sapucai': 'Paraguarí',
  'caapucu': 'Paraguarí',
  'san roque gonzalez': 'Paraguarí',
  // Guairá
  'villarrica': 'Guairá',
  'colonia independencia': 'Guairá',
  'independencia': 'Guairá',
  'mbocayaty': 'Guairá',
  'yataity': 'Guairá',
  'paso yobai': 'Guairá',
  'mauricio jose troche': 'Guairá',
  'iturbe': 'Guairá',
  // San Pedro
  'san pedro del ycuamandiyu': 'San Pedro',
  'santa rosa del aguaray': 'San Pedro',
  'san estanislao': 'San Pedro',
  'santani': 'San Pedro',
  'chore': 'San Pedro',
  'guayaibi': 'San Pedro',
  'capiibary': 'San Pedro',
  'general elizardo aquino': 'San Pedro',
  'liberacion': 'San Pedro',
  // Concepción
  'concepcion': 'Concepción',
  'horqueta': 'Concepción',
  'yby yau': 'Concepción',
  'loreto': 'Concepción',
  'vallemi': 'Concepción',
  'belen': 'Concepción',
  // Amambay
  'pedro juan caballero': 'Amambay',
  'pjc': 'Amambay',
  'capitan bado': 'Amambay',
  'bella vista norte': 'Amambay',
  'zanja pyta': 'Amambay',
  // Caazapá
  'caazapa': 'Caazapá',
  'yuty': 'Caazapá',
  'san juan nepomuceno': 'Caazapá',
  'abai': 'Caazapá',
  'fulgencio yegros': 'Caazapá',
  // Misiones
  'san juan bautista': 'Misiones',
  'san ignacio': 'Misiones',
  'san ignacio guazu': 'Misiones',
  'ayolas': 'Misiones',
  'santa rosa misiones': 'Misiones',
  'santiago': 'Misiones',
  'san miguel': 'Misiones',
  'villa florida': 'Misiones',
  // Ñeembucú
  'pilar': 'Ñeembucú',
  'alberdi': 'Ñeembucú',
  'villa oliva': 'Ñeembucú',
  'humaita': 'Ñeembucú',
  // Canindeyú
  'salto del guaira': 'Canindeyú',
  'saltos del guaira': 'Canindeyú',
  'curuguaty': 'Canindeyú',
  'katuete': 'Canindeyú',
  'la paloma': 'Canindeyú',
  'nueva esperanza': 'Canindeyú',
  // Chaco
  'villa hayes': 'Presidente Hayes',
  'benjamin aceval': 'Presidente Hayes',
  'pozo colorado': 'Presidente Hayes',
  'nanawa': 'Presidente Hayes',
  'jose falcon': 'Presidente Hayes',
  'filadelfia': 'Boquerón',
  'loma plata': 'Boquerón',
  'neuland': 'Boquerón',
  'mariscal estigarribia': 'Boquerón',
  'fuerte olimpo': 'Alto Paraguay',
  'bahia negra': 'Alto Paraguay',
  'puerto casado': 'Alto Paraguay',
  'carmelo peralta': 'Alto Paraguay',
};

const SORTED_CITY_KEYS = Object.keys(CITY_TO_DEPARTMENT).sort((a, b) => b.length - a.length);
const SORTED_DEPT_KEYS = Object.keys(DEPARTMENT_DISPLAY_NAMES).sort((a, b) => b.length - a.length);

export function normalizeParaguayText(raw?: string | null): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchBoundary(haystack: string, key: string): boolean {
  if (!haystack || !key) return false;
  if (haystack === key) return true;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`).test(haystack);
}

export function normalizeParaguayDepartment(rawDept?: string | null): string {
  const norm = normalizeParaguayText(rawDept);
  if (!norm || norm === 'sin especificar' || norm === 'sin departamento' || norm === 's d') {
    return '';
  }
  if (DEPARTMENT_DISPLAY_NAMES[norm]) return DEPARTMENT_DISPLAY_NAMES[norm];
  for (const key of SORTED_DEPT_KEYS) {
    if (matchBoundary(norm, key)) {
      return DEPARTMENT_DISPLAY_NAMES[key];
    }
  }
  return String(rawDept || '').trim();
}

export function inferParaguayDepartmentFromCity(
  city?: string | null,
  fallbackDept?: string | null,
): string {
  const normCity = normalizeParaguayText(city);
  if (normCity) {
    for (const key of SORTED_CITY_KEYS) {
      if (matchBoundary(normCity, key)) {
        return CITY_TO_DEPARTMENT[key];
      }
    }
    for (const key of SORTED_DEPT_KEYS) {
      if (matchBoundary(normCity, key)) {
        return DEPARTMENT_DISPLAY_NAMES[key];
      }
    }
  }
  return normalizeParaguayDepartment(fallbackDept);
}

function isPlaceholderLocationText(val?: string | null): boolean {
  const norm = normalizeParaguayText(val);
  return (
    !norm ||
    norm === 'sin especificar' ||
    norm === 'sin ciudad' ||
    norm === 'por confirmar' ||
    norm === 'por confirmar en chat' ||
    norm === 'n a' ||
    norm === 'na' ||
    norm === 'none' ||
    norm === 'null'
  );
}

export function formatFullCityDepartment(
  ciudad?: string | null,
  departamento?: string | null,
): string {
  const cleanCity = isPlaceholderLocationText(ciudad) ? '' : String(ciudad || '').trim();
  const resolvedDept = inferParaguayDepartmentFromCity(cleanCity, departamento);
  if (!cleanCity && !resolvedDept) return 'Sin ciudad';
  if (!cleanCity) return resolvedDept;
  if (!resolvedDept) return cleanCity;

  const normCity = normalizeParaguayText(cleanCity);
  const normDeptBase = normalizeParaguayText(resolvedDept.replace(/\(Capital\)/i, ''));
  if (normDeptBase && matchBoundary(normCity, normDeptBase)) {
    return normCity === 'asuncion' ? 'Asunción (Capital)' : cleanCity;
  }
  return `${cleanCity}, ${resolvedDept}`;
}

export function parseFiniteCoord(val: unknown): number | null {
  if (typeof val === 'number') {
    return Number.isFinite(val) && val !== 0 ? val : null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim().replace(',', '.');
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
  }
  return null;
}

function isValidLatLngPair(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

export function extractLatLngFromGoogleMapsUrl(
  url?: string | null,
): { lat: number; lng: number } | null {
  const raw = String(url || '').trim();
  if (!raw) return null;

  const patterns = [
    /[?&](?:q|ll|query|destination|center|sll)=(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/i,
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/,
  ];

  for (const regex of patterns) {
    const match = raw.match(regex);
    if (match) {
      const lat = parseFiniteCoord(match[1]);
      const lng = parseFiniteCoord(match[2]);
      if (isValidLatLngPair(lat, lng)) {
        return { lat: lat as number, lng: lng as number };
      }
    }
  }
  return null;
}

const VALID_GPS_FUENTES: Set<string> = new Set([
  'gps_dispositivo',
  'mapa_manual',
  'whatsapp_pin',
  'geocodificacion_direccion',
]);

export interface RawGpsCandidate {
  gpsLat?: unknown;
  gps_lat?: unknown;
  gpsLng?: unknown;
  gps_lng?: unknown;
  gpsLink?: unknown;
  gps_link?: unknown;
  gpsConfirmado?: unknown;
  gps_confirmado?: unknown;
  gpsFuente?: unknown;
  gps_fuente?: unknown;
}

export interface NormalizedOrderGps {
  gpsLat?: number;
  gpsLng?: number;
  gpsLink?: string;
  gpsConfirmado: boolean;
  gpsFuente?: OrderGpsFuente;
}

export function normalizeOrderGpsFields(
  ...candidates: Array<RawGpsCandidate | null | undefined>
): NormalizedOrderGps {
  let lat: number | null = null;
  let lng: number | null = null;
  let link = '';
  let confirmado = false;
  let fuente: OrderGpsFuente | undefined;

  for (const src of candidates) {
    if (!src || typeof src !== 'object') continue;
    if (lat === null) {
      lat = parseFiniteCoord(src.gpsLat ?? src.gps_lat);
    }
    if (lng === null) {
      lng = parseFiniteCoord(src.gpsLng ?? src.gps_lng);
    }
    if (!link) {
      const rawLink = String(src.gpsLink ?? src.gps_link ?? '').trim();
      if (rawLink && /^https?:\/\//i.test(rawLink)) {
        link = rawLink;
      }
    }
    if (!confirmado && Boolean(src.gpsConfirmado ?? src.gps_confirmado)) {
      confirmado = true;
    }
    if (!fuente) {
      const rawFuente = String(src.gpsFuente ?? src.gps_fuente ?? '').trim();
      if (VALID_GPS_FUENTES.has(rawFuente)) {
        fuente = rawFuente as OrderGpsFuente;
      }
    }
  }

  if ((!isValidLatLngPair(lat, lng)) && link) {
    const parsed = extractLatLngFromGoogleMapsUrl(link);
    if (parsed) {
      lat = parsed.lat;
      lng = parsed.lng;
    }
  }

  const hasValidCoords = isValidLatLngPair(lat, lng);
  if (hasValidCoords && !link) {
    link = `https://www.google.com/maps?q=${(lat as number).toFixed(6)},${(lng as number).toFixed(6)}`;
  }

  if (fuente === 'geocodificacion_direccion') {
    confirmado = false;
  } else if (!fuente && confirmado && (hasValidCoords || link)) {
    fuente = 'gps_dispositivo';
  }

  return {
    ...(hasValidCoords ? { gpsLat: lat as number, gpsLng: lng as number } : {}),
    ...(link ? { gpsLink: link } : {}),
    gpsConfirmado: Boolean(confirmado && (hasValidCoords || link)),
    ...(fuente ? { gpsFuente: fuente } : {}),
  };
}

export function buildGoogleMapsSearchUrl(order: {
  calle?: string | null;
  barrio?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  departamento?: string | null;
  referenciaCasa?: string | null;
}): string | null {
  const cleanDir = String(order.direccion || '').replace(/\[GPS:[^\]]*\]/gi, '').trim();
  const resolvedDept = inferParaguayDepartmentFromCity(order.ciudad, order.departamento);
  const parts = [order.calle, order.barrio, !order.calle && !order.barrio ? cleanDir : '', order.ciudad, resolvedDept]
    .map((p) => String(p || '').trim())
    .filter((p) => !isPlaceholderLocationText(p));

  const uniqueParts: string[] = [];
  for (const part of parts) {
    const normPart = normalizeParaguayText(part);
    if (!normPart) continue;
    if (!uniqueParts.some((u) => normalizeParaguayText(u) === normPart)) {
      uniqueParts.push(part);
    }
  }

  if (uniqueParts.length === 0) return null;
  uniqueParts.push('Paraguay');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(uniqueParts.join(', '))}`;
}

export interface ForwardGeocodeResult {
  lat: number;
  lng: number;
  gpsLink: string;
  matchedDepartment: string;
  matchedDisplay: string;
  precision: 'direccion' | 'barrio' | 'ciudad';
}

function isWithinParaguayBounds(lat: number, lng: number): boolean {
  return lat >= -28.0 && lat <= -19.0 && lng >= -63.0 && lng <= -54.0;
}

export async function forwardGeocodeParaguayAddress(
  params: {
    calle?: string | null;
    barrio?: string | null;
    direccion?: string | null;
    ciudad?: string | null;
    departamento?: string | null;
  },
  timeoutMs = 2600,
): Promise<ForwardGeocodeResult | null> {
  const calle = isPlaceholderLocationText(params.calle) ? '' : String(params.calle || '').trim();
  const barrio = isPlaceholderLocationText(params.barrio) ? '' : String(params.barrio || '').trim();
  const rawDir = String(params.direccion || '').replace(/\[GPS:[^\]]*\]/gi, '').trim();
  const direccion = isPlaceholderLocationText(rawDir) ? '' : rawDir;
  const ciudad = isPlaceholderLocationText(params.ciudad) ? '' : String(params.ciudad || '').trim();
  const dept = inferParaguayDepartmentFromCity(ciudad, params.departamento);

  const queries: Array<{ query: string; precision: 'direccion' | 'barrio' | 'ciudad' }> = [];
  const pushQuery = (parts: string[], precision: 'direccion' | 'barrio' | 'ciudad') => {
    const clean = parts.map((p) => p.trim()).filter(Boolean);
    if (clean.length === 0) return;
    const q = [...clean, 'Paraguay'].join(', ');
    if (!queries.some((item) => item.query.toLowerCase() === q.toLowerCase())) {
      queries.push({ query: q, precision });
    }
  };

  if (calle && ciudad) {
    pushQuery([calle, barrio, ciudad, dept], 'direccion');
  } else if (direccion && ciudad) {
    pushQuery([direccion, ciudad, dept], 'direccion');
  }
  if (barrio && ciudad) {
    pushQuery([barrio, ciudad, dept], 'barrio');
  }
  if (ciudad) {
    pushQuery([ciudad, dept], 'ciudad');
  }

  if (queries.length === 0) return null;

  const deadline = Date.now() + timeoutMs;
  const isNode = typeof window === 'undefined';

  for (const candidate of queries) {
    const remaining = deadline - Date.now();
    if (remaining <= 250) break;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(remaining, 1800));
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=py&addressdetails=1&limit=1&q=${encodeURIComponent(candidate.query)}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'es',
          ...(isNode ? { 'User-Agent': 'LandingCod-GeoFallback/1.0' } : {}),
        },
      });
      if (!res.ok) continue;
      const rows = (await res.json()) as Array<{
        lat?: string;
        lon?: string;
        display_name?: string;
        address?: { state?: string; city?: string; town?: string; suburb?: string };
      }>;
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const top = rows[0];
      const lat = parseFiniteCoord(top.lat);
      const lng = parseFiniteCoord(top.lon);
      if (lat === null || lng === null || !isWithinParaguayBounds(lat, lng)) continue;

      const matchedDepartment =
        inferParaguayDepartmentFromCity(ciudad, top.address?.state || dept) || dept;

      return {
        lat,
        lng,
        gpsLink: `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`,
        matchedDepartment,
        matchedDisplay: String(top.display_name || candidate.query),
        precision: candidate.precision,
      };
    } catch {
      // Fall through to coarser precision query
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}
