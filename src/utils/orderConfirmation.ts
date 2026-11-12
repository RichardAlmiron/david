import { Order, OrderComparisonSummary } from '../types';
import { formatGs, formatWaPhone } from '../config';

const SPANISH_DIGIT_WORDS: Record<string, string> = {
  '0': 'cero',
  '1': 'uno',
  '2': 'dos',
  '3': 'tres',
  '4': 'cuatro',
  '5': 'cinco',
  '6': 'seis',
  '7': 'siete',
  '8': 'ocho',
  '9': 'nueve'
};

/**
 * Convierte un grupo de dígitos en palabras número por número (ej. "0973" -> "cero nueve siete tres",
 * "857" -> "ocho cinco siete"), evitando que el motor de voz lo lea como centenas ("novecientos setenta y tres").
 */
export function formatDigitGroupForSpanishTTS(group: string): string {
  const d = String(group || '').replace(/\D/g, '');
  if (!d) return '';
  return d
    .split('')
    .map(ch => SPANISH_DIGIT_WORDS[ch] || ch)
    .join(' ');
}

const SPANISH_UNITS_MAP: Record<string, number> = {
  cero: 0,
  uno: 1,
  un: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9
};

const SPANISH_TEENS_TWENTIES_MAP: Record<string, number> = {
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  dieciséis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiun: 21,
  veintiún: 21,
  veintidos: 22,
  veintidós: 22,
  veintitres: 23,
  veintitrés: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintiséis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29
};

const SPANISH_TENS_MAP: Record<string, number> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90
};

const SPANISH_HUNDREDS_MAP: Record<string, number> = {
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900
};

/**
 * Si el LLM escribió un número de teléfono paraguayo en palabras usando decenas ("cero noventa y siete tres..."),
 * centenas ("cero novecientos setenta y tres, quinientos treinta y dos...") o sin pausas,
 * lo convierte determinísticamente a "09XX XXX XXX".
 */
export function convertSpokenSpanishPhoneWordsToDigits(rawText: string): string {
  if (!rawText) return '';
  const spokenPhoneRegex =
    /\bcero[\s,.-]+(?:nueve|noventa|novecientos)(?:[\s,.-]+(?:y|cero|uno|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veinti[uú]n|veintid[oó]s|veintitr[eé]s|veinticuatro|veinticinco|veintis[eé]is|veintisiete|veintiocho|veintinueve|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|\d+)){3,20}\b/gi;

  return String(rawText).replace(spokenPhoneRegex, match => {
    const tokens = match
      .toLowerCase()
      .split(/[\s,.-]+/)
      .filter(Boolean);
    let digits = '';
    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i];
      if (tok === 'y') {
        i++;
        continue;
      }
      if (/^\d+$/.test(tok)) {
        digits += tok;
        i++;
        continue;
      }
      if (SPANISH_HUNDREDS_MAP[tok] !== undefined) {
        let val = SPANISH_HUNDREDS_MAP[tok];
        i++;
        if (i < tokens.length && SPANISH_TENS_MAP[tokens[i]] !== undefined) {
          val += SPANISH_TENS_MAP[tokens[i]];
          i++;
          if (
            i + 1 < tokens.length &&
            tokens[i] === 'y' &&
            SPANISH_UNITS_MAP[tokens[i + 1]] !== undefined
          ) {
            val += SPANISH_UNITS_MAP[tokens[i + 1]];
            i += 2;
          }
        } else if (i < tokens.length && SPANISH_TEENS_TWENTIES_MAP[tokens[i]] !== undefined) {
          val += SPANISH_TEENS_TWENTIES_MAP[tokens[i]];
          i++;
        } else if (i < tokens.length && SPANISH_UNITS_MAP[tokens[i]] !== undefined && tokens[i] !== 'cero') {
          val += SPANISH_UNITS_MAP[tokens[i]];
          i++;
        }
        digits += String(val);
        continue;
      }
      if (SPANISH_TENS_MAP[tok] !== undefined) {
        let val = SPANISH_TENS_MAP[tok];
        i++;
        if (
          i + 1 < tokens.length &&
          tokens[i] === 'y' &&
          SPANISH_UNITS_MAP[tokens[i + 1]] !== undefined
        ) {
          val += SPANISH_UNITS_MAP[tokens[i + 1]];
          i += 2;
        }
        digits += String(val);
        continue;
      }
      if (SPANISH_TEENS_TWENTIES_MAP[tok] !== undefined) {
        digits += String(SPANISH_TEENS_TWENTIES_MAP[tok]);
        i++;
        continue;
      }
      if (SPANISH_UNITS_MAP[tok] !== undefined) {
        digits += String(SPANISH_UNITS_MAP[tok]);
        i++;
        continue;
      }
      i++;
    }

    if (digits.length === 10 && digits.startsWith('09')) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
    }
    return match;
  });
}

/**
 * Normaliza cualquier número de celular paraguayo en un texto libre (incluso si fue separado en 3-3-4 como "097 353 2550"
 * o escrito con centenas/decenas en palabras) al formato paraguayo estricto 4 - 3 - 3 ("0973 532 550").
 */
export function normalizeParaguayanPhonesInText(rawText: string): string {
  if (!rawText) return '';
  return convertSpokenSpanishPhoneWordsToDigits(String(rawText))
    .replace(
      /(?:\+?595[\s,.-]*|0)(9)[\s,.-]*([6789])[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)\b/g,
      '0$1$2$3 $4$5$6 $7$8$9'
    )
    .replace(
      /\b(9)[\s,.-]*([6789])[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)\b/g,
      '0$1$2$3 $4$5$6 $7$8$9'
    );
}

/**
 * Formatea siempre un número de celular paraguayo en grupos de 4 - 3 - 3 (ej. "0973 532 550"):
 * primero los 4 números del prefijo de la operadora (0973, 0981, etc.), luego 3 y luego 3.
 */
export function formatParaguayanPhone433(rawPhone?: string): string {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  let local = digits;
  if (digits.startsWith('595') && digits.length === 12) {
    local = '0' + digits.slice(3);
  } else if (digits.length === 9 && digits.startsWith('9')) {
    local = '0' + digits;
  }
  if (local.length === 10 && local.startsWith('09')) {
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7, 10)}`;
  }
  return local || String(rawPhone || '');
}

/**
 * Prepara los números de celular paraguayos dentro de un texto para síntesis de voz (TTS) en español
 * garantizando que SIEMPRE pronuncie número por número (NUNCA con centenas) en estructura 4 - 3 - 3:
 * primero los 4 dígitos del prefijo de corrido número por número ("cero nueve siete tres"),
 * luego una breve pausa (", "), luego 3 dígitos número por número ("ocho cinco siete"),
 * otra breve pausa (", ") y los últimos 3 dígitos número por número ("tres nueve siete").
 */
export function formatParaguayanPhonesForSpanishTTS(rawText: string): string {
  const normalized = normalizeParaguayanPhonesInText(rawText);
  return normalized.replace(/\b(09\d{2})[\s,.-]+(\d{3})[\s,.-]+(\d{3})\b/g, (_m, g1, g2, g3) => {
    return `${formatDigitGroupForSpanishTTS(g1)}, ${formatDigitGroupForSpanishTTS(g2)}, ${formatDigitGroupForSpanishTTS(g3)}`;
  });
}

const UNDER_THIRTY_APOCOPATED: Record<number, string> = {
  0: 'cero',
  1: 'un',
  2: 'dos',
  3: 'tres',
  4: 'cuatro',
  5: 'cinco',
  6: 'seis',
  7: 'siete',
  8: 'ocho',
  9: 'nueve',
  10: 'diez',
  11: 'once',
  12: 'doce',
  13: 'trece',
  14: 'catorce',
  15: 'quince',
  16: 'dieciséis',
  17: 'diecisiete',
  18: 'dieciocho',
  19: 'diecinueve',
  20: 'veinte',
  21: 'veintiún',
  22: 'veintidós',
  23: 'veintitrés',
  24: 'veinticuatro',
  25: 'veinticinco',
  26: 'veintiséis',
  27: 'veintisiete',
  28: 'veintiocho',
  29: 'veintinueve'
};

const TENS_WORDS: Record<number, string> = {
  30: 'treinta',
  40: 'cuarenta',
  50: 'cincuenta',
  60: 'sesenta',
  70: 'setenta',
  80: 'ochenta',
  90: 'noventa'
};

const HUNDREDS_WORDS: Record<number, string> = {
  100: 'ciento',
  200: 'doscientos',
  300: 'trescientos',
  400: 'cuatrocientos',
  500: 'quinientos',
  600: 'seiscientos',
  700: 'setecientos',
  800: 'ochocientos',
  900: 'novecientos'
};

function convertUnderOneThousandToSpanishWords(n: number): string {
  const clean = Math.max(0, Math.min(999, Math.floor(n)));
  if (clean === 0) return '';
  if (clean === 100) return 'cien';
  const hundreds = Math.floor(clean / 100) * 100;
  const rem = clean % 100;
  const parts: string[] = [];
  if (hundreds > 0 && HUNDREDS_WORDS[hundreds]) {
    parts.push(HUNDREDS_WORDS[hundreds]);
  }
  if (rem > 0) {
    if (rem < 30) {
      parts.push(UNDER_THIRTY_APOCOPATED[rem]);
    } else {
      const tens = Math.floor(rem / 10) * 10;
      const unit = rem % 10;
      if (unit === 0) {
        parts.push(TENS_WORDS[tens]);
      } else {
        parts.push(`${TENS_WORDS[tens]} y ${UNDER_THIRTY_APOCOPATED[unit]}`);
      }
    }
  }
  return parts.join(' ');
}

/**
 * Convierte un monto numérico a palabras en español apocopadas para acompañar el sustantivo masculino "guaraníes"
 * (ej. 30000 -> "treinta mil", 189000 -> "ciento ochenta y nueve mil", 159000 -> "ciento cincuenta y nueve mil").
 */
export function numberToSpanishGuaraniesWords(amountGs: number): string {
  const clean = Math.max(0, Math.round(Number(amountGs) || 0));
  if (clean === 0) return 'cero';

  const millions = Math.floor(clean / 1_000_000);
  const thousands = Math.floor((clean % 1_000_000) / 1_000);
  const units = clean % 1_000;

  const chunks: string[] = [];
  if (millions > 0) {
    if (millions === 1) {
      chunks.push('un millón');
    } else {
      chunks.push(`${convertUnderOneThousandToSpanishWords(millions)} millones`);
    }
  }

  if (thousands > 0) {
    if (thousands === 1) {
      chunks.push('mil');
    } else {
      chunks.push(`${convertUnderOneThousandToSpanishWords(thousands)} mil`);
    }
  }

  if (units > 0) {
    chunks.push(convertUnderOneThousandToSpanishWords(units));
  }

  return chunks.join(' ');
}

/**
 * Formatea cualquier monto de dinero en Guaraníes listo para síntesis de voz (TTS),
 * garantizando que SIEMPRE pronuncie la moneda "guaraníes" completa (ej. "treinta mil guaraníes").
 */
export function formatGuaraniesSpeech(amountGs: number): string {
  const clean = Math.max(0, Math.round(Number(amountGs) || 0));
  const words = numberToSpanishGuaraniesWords(clean);
  if (clean >= 1_000_000 && clean % 1_000_000 === 0) {
    return `${words} de guaraníes`;
  }
  return `${words} guaraníes`;
}

/**
 * Normaliza todas las menciones monetarias en un texto hablado para que el motor de voz Deepgram Aura-2
 * pronuncie SIEMPRE el monto en letras seguido de "guaraníes" (ej. "treinta mil guaraníes", NUNCA "treinta" a secas).
 */
export function normalizeGuaraniesCurrencyForSpeech(rawText: string): string {
  if (!rawText) return '';
  let out = String(rawText);

  const parseDottedAmount = (numStr: string): number => {
    const digits = String(numStr || '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  };

  // 1. Reemplazar "-Gs. 30.000", "Gs. 189.000", "₲ 358.000"
  out = out.replace(/(?:-\s*)?(?:Gs\.?|₲)\s*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{4,9})\b/gi, (_m, numPart) => {
    const val = parseDottedAmount(numPart);
    return val > 0 ? formatGuaraniesSpeech(val) : _m;
  });

  // 2. Reemplazar "30.000 Gs", "189.000 guaraníes", "30000 guaranies"
  out = out.replace(/\b([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{4,9})\s*(?:Gs\.?|guaran[ií]es)\b/gi, (_m, numPart) => {
    const val = parseDottedAmount(numPart);
    return val > 0 ? formatGuaraniesSpeech(val) : _m;
  });

  // 3. Corregir frases donde el LLM haya omitido la palabra "guaraníes" al hablar del descuento o montos en miles
  out = out.replace(
    /\b(descuento(?:\s+directo|\s+exclusivo|\s+especial)?\s+de|promo(?:ci[oó]n)?(?:\s+especial|\s+exclusiva)?\s+de|ahorr[aá]s|ahorro\s+de|rebaja\s+de|menos)\s+30(?:\.?000)?(?!\s*guaran)/gi,
    '$1 treinta mil guaraníes'
  );
  out = out.replace(
    /\b(descuento(?:\s+directo|\s+exclusivo|\s+especial)?\s+de|promo(?:ci[oó]n)?(?:\s+especial|\s+exclusiva)?\s+de|ahorr[aá]s|ahorro\s+de|rebaja\s+de)\s+treinta(?:\s+mil)?(?!\s+guaran[ií]es)\b/gi,
    '$1 treinta mil guaraníes'
  );
  out = out.replace(/\btreinta\s+mil(?!\s+guaran[ií]es)\b/gi, 'treinta mil guaraníes');

  // Evitar duplicados accidentales "guaraníes guaraníes"
  out = out.replace(/\bguaran[ií]es(?:\s+de)?\s+guaran[ií]es\b/gi, 'guaraníes');
  return out;
}

/**
 * Devuelve 3 minutos (180.000 ms) para el 1er intento de seguimiento por inactividad,
 * y 1 hora (3.600.000 ms) para el 2do, 3er, 4to... intento consecutivo.
 */
export function getInactivityFollowUpDelayMs(attemptNumber: number): number {
  return attemptNumber <= 1 ? 3 * 60 * 1000 : 60 * 60 * 1000;
}

/**
 * Filtro superficial de ruido/vacío:
 * Bloquea únicamente mensajes vacíos, audios inaudibles, signos sueltos ("?", "..") o ruidos de vacilación ("eh", "mm").
 * Todas las respuestas con 1, 2, 3 o más palabras reales ("sí", "claro", "correcto", "está bien", "portón negro")
 * pasan directamente al cerebro LLM para evaluar su CONGRUENCIA real con la pregunta actual (en Paso 4 una mera afirmación "sí" sin descripción es incongruente).
 */
export function isUnclearOrTooShortCustomerReply(cleanInput: string, currentStep = 1): boolean {
  const trimmed = String(cleanInput || '')
    .replace(/^🎤\s*/, '')
    .trim();
  if (!trimmed) return true;
  if (/\[El cliente envi[oó] un audio que no se escuch[oó]|\[Nota de voz del cliente\]/i.test(trimmed)) {
    return true;
  }
  if (
    /https?:\/\/\S+|maps\.google|google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|Ubicaci[oó]n GPS|COMPROBANTE_PAGO_ADELANTADO/i.test(
      trimmed
    )
  ) {
    return false;
  }

  const pureNoiseTokens = new Set(['eh', 'ehh', 'em', 'emm', 'mm', 'mmm', 'hm', 'hmm', 'uh', 'uhm', 'xq']);
  const lexicalWords = trimmed
    .replace(/https?:\/\/\S+/gi, ' ')
    .split(/\s+/)
    .map(tok => tok.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]/g, ''))
    .filter(tok => tok.length >= 2 && !pureNoiseTokens.has(tok.toLowerCase()));

  if (lexicalWords.length === 0) return true;

  // En Paso 4 se pregunta cómo es la fachada/recepción: responder solo "sí", "ok" o "dale" carece de congruencia descriptiva
  if (
    currentStep === 4 &&
    /^(s[ií]|sip|sep|ok|oka|okay|dale|bueno|ya|claro|correcto|exacto|perfecto|bien|no)$/i.test(
      trimmed.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').trim()
    )
  ) {
    return true;
  }

  return false;
}

export function isBuildingOrder(order?: Partial<Order> | null): boolean {
  if (!order) return false;
  if (order.tipoVivienda === 'edificio') return true;
  if (order.nombreEdificio && String(order.nombreEdificio).trim().length > 0) return true;
  if (order.pisoEdificio && String(order.pisoEdificio).trim().length > 0) return true;
  if (order.departamentoNumero && String(order.departamentoNumero).trim().length > 0) return true;
  return /\bedificio\b.*?\bpiso\b/i.test(`${order.direccion || ''} ${order.referenciaCasa || ''}`);
}

export function formatBuildingDetailsSummary(order?: Partial<Order> | null): string {
  if (!order || !isBuildingOrder(order)) return '';
  const parts: string[] = [];
  if (order.nombreEdificio?.trim()) {
    parts.push(`Edificio ${order.nombreEdificio.trim()}`);
  }
  if (order.pisoEdificio?.trim()) {
    parts.push(`Piso ${order.pisoEdificio.trim()}`);
  }
  if (order.departamentoNumero?.trim()) {
    parts.push(`Dpto./Cuarto ${order.departamentoNumero.trim()}`);
  }
  if (order.detalleRecepcion?.trim()) {
    parts.push(`Recepción: ${order.detalleRecepcion.trim()}`);
  } else if (order.tieneRecepcion === 'si_recepcionista') {
    parts.push('Recepción: Sí, recibe la recepcionista / portería');
  } else if (order.tieneRecepcion === 'no_personalmente') {
    parts.push('Recepción: Recibe el cliente personalmente en entrada');
  }
  return parts.join(' · ');
}

export function buildPoliteUnclearReplyClarification(
  displayFirstName: string,
  currentStep: number,
  variationIndex = 0,
  isBuilding = false,
  rawCustomerWords = '',
  isFromAudio = false
): string {
  const nameToUse = displayFirstName && displayFirstName !== 'qué tal' ? displayFirstName : 'estimado cliente';
  let reminderContext = 'si disponés de un minutito ahora mismo para que verifiquemos juntos los datos de envío de tu pedido';
  if (currentStep === 2) {
    reminderContext = 'si tu nombre completo y este número de teléfono quedaron bien registrados en tu orden';
  } else if (currentStep === 3) {
    reminderContext = isBuilding
      ? 'si revisaste los datos de tu edificio, el piso, el departamento y el punto del mapa que te pasé acá arriba y si está todo correcto'
      : 'si pudiste mirar la dirección y el punto del mapa que te envié acá arriba en el chat y si están correctos';
  } else if (currentStep === 4) {
    reminderContext = isBuilding
      ? 'si en tu edificio la recepcionista o portería está autorizada a recibir el pedido o si bajás vos personalmente, y qué comercio conocido hay al lado del edificio'
      : 'cómo es la fachada de tu casa, por ejemplo el color de la pared o del portón y algún comercio cercano de referencia';
  }

  const cleanQuotedWords = String(rawCustomerWords || '')
    .replace(/^🎤\s*/, '')
    .trim()
    .replace(/["'\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 55);
  const hasQuotedWords =
    cleanQuotedWords.length > 0 &&
    !cleanQuotedWords.startsWith('[') &&
    /[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/.test(cleanQuotedWords);

  const gentleAudioSuggestion =
    !isFromAudio && variationIndex >= 1
      ? ' Si te resulta más práctico, también podés mandarme un audio cortito contándomelo con tus palabras.'
      : '';

  const variants = hasQuotedWords
    ? [
      `${nameToUse}, disculpame la molestia, recién vi que me pusiste "${cleanQuotedWords}" y no me quedó del todo claro en relación con tu pedido. ¿Me podrías comentar ${reminderContext}, por favor?${gentleAudioSuggestion}`,
      `Perdoname ${nameToUse}, leí con atención lo que me escribiste recién ("${cleanQuotedWords}"), pero para no equivocarme con ningún dato de tu entrega prefiero consultarte de nuevo. ¿Me decís por favor ${reminderContext}?${gentleAudioSuggestion}`,
      `${nameToUse}, te pido disculpas, me quedó una pequeña duda al leer "${cleanQuotedWords}" y quiero cuidar bien tu envío. ¿Me confirmás por favor ${reminderContext}?${gentleAudioSuggestion}`,
      `Disculpame ${nameToUse}, recién no logré relacionar bien el mensaje "${cleanQuotedWords}" con la consulta pendiente. ¿Podrías comentarme nuevamente ${reminderContext}, por favor?${gentleAudioSuggestion}`
    ]
    : [
      `${nameToUse}, disculpame pero recién no se llegó a escuchar o leer con claridad tu mensaje. ¿Me podrías comentar ${reminderContext}, por favor?${gentleAudioSuggestion}`,
      `Perdoname ${nameToUse}, recién entró tu mensaje sin audio o sin texto claro. ¿Sería posible que me cuentes nuevamente ${reminderContext} para dejar todo bien anotado?${gentleAudioSuggestion}`,
      `${nameToUse}, te pido disculpas de corazón, no se logró escuchar bien el mensaje que entró recién. Para cuidar cada detalle de tu envío, ¿me podrías decir ${reminderContext}?${gentleAudioSuggestion}`,
      `Disculpame la molestia ${nameToUse}, no entró con claridad el mensaje anterior. ¿Me confirmás por favor ${reminderContext}?${gentleAudioSuggestion}`
    ];

  const idx = Math.abs(variationIndex) % variants.length;
  return variants[idx];
}

export function cleanStreetAddressText(rawAddress: string): string {
  if (!rawAddress) return 'Por confirmar';
  const cleaned = String(rawAddress)
    .replace(/\s*·?\s*\[GPS:\s*https?:\/\/[^\]]+\]/gi, '')
    .replace(
      /\s*https?:\/\/(?:www\.)?(?:google\.com\/maps\S+|maps\.google\.com\S+|maps\.app\.goo\.gl\/\S+|goo\.gl\/maps\/\S+|tinyurl\.com\/\S+|is\.gd\/\S+)/gi,
      ''
    )
    .replace(/\s+·\s*$/g, '')
    .trim();
  return cleaned || 'Por confirmar';
}

export function buildOrderLocationConfirmationText(
  order: Partial<Order> & { gpsShortLink?: string; systemLocationConfirmedSent?: boolean },
  step: number
): string {
  const city = String(order?.ciudad || '').trim() || 'Por confirmar';
  const dept = String(order?.departamento || '').trim();
  const cleanAddress = cleanStreetAddressText(order?.direccion || '');
  const isBuilding = isBuildingOrder(order);

  if (step === 3) {
    if (isBuilding) {
      const buildingName = String(order?.nombreEdificio || '').trim() || 'Por confirmar';
      const floor = String(order?.pisoEdificio || '').trim() || 'Por confirmar';
      const apt = String(order?.departamentoNumero || '').trim() || 'Por confirmar';
      const receptionText =
        order?.detalleRecepcion?.trim() ||
        (order?.tieneRecepcion === 'si_recepcionista'
          ? 'Sí tiene recepción (La recepcionista / portería recibe el pedido)'
          : order?.tieneRecepcion === 'no_personalmente'
            ? 'Recibe el cliente personalmente en la entrada del edificio'
            : 'Por confirmar en recepción');

      return (
        `📋 *Estos son los datos de tu EDIFICIO que pusiste en el formulario para que se te entregue tu producto:*\n\n` +
        `🏙️ *Ciudad y barrio:* ${city}${dept ? ` (${dept})` : ''}\n` +
        `🛣️ *Calle donde está el edificio:* ${cleanAddress}\n` +
        `🏢 *Nombre del Edificio:* ${buildingName}\n` +
        `🔢 *Piso y Departamento / Cuarto:* Piso ${floor} · Dpto./Cuarto ${apt}\n` +
        `🛎️ *Recepción del pedido:* ${receptionText}\n\n` +
        `👉 *Por favor revisá bien estos datos de tu edificio y confirmame acá en el chat con la palabra "CORRECTO" para confirmar tu envío (o decime si querés corregir algún dato).*`
      );
    }

    return (
      `📋 *Estos son los datos de dirección que pusiste en el formulario para que se te entregue tu producto:*\n\n` +
      `🏙️ *Ciudad donde vivís:* ${city}${dept ? ` (${dept})` : ''}\n` +
      `🏘️ *Calle y barrio donde vivís:* ${cleanAddress}\n\n` +
      `👉 *Por favor revisá bien estos datos y confirmame acá en el chat con la palabra "CORRECTO" para confirmar tu envío (o decime si querés corregir tu calle o barrio).*`
    );
  }

  return '';
}

/**
 * Construye el resumen textual de entrega SIN exponer URLs de GPS/mapa al cliente:
 * el GPS capturado queda almacenado internamente para Admin, Reparto y Vendedor.
 */
export function buildExpressInitialAddressTextCard(order: Partial<Order> | null | undefined): string {
  const customerName = String(order?.nombre || '').trim();
  const phone = String(order?.celular || '').trim();
  const city = String(order?.ciudad || '').trim() || 'Por confirmar';
  const dept = String(order?.departamento || '').trim();
  const cleanAddress = cleanStreetAddressText(order?.direccion || '');
  const isBuilding = isBuildingOrder(order);

  const lines: string[] = [`📍 *VERIFICÁ TUS DATOS DE ENTREGA:*`];
  if (customerName) lines.push(`👤 *Cliente:* ${customerName}`);
  if (phone) lines.push(`📱 *Celular:* ${phone}`);
  lines.push(`🏙️ *Ciudad:* ${city}${dept ? ` (${dept})` : ''}`);
  lines.push(`🏘️ *Barrio / Dirección:* ${cleanAddress}`);

  if (isBuilding) {
    const bldgSummary = formatBuildingDetailsSummary(order);
    if (bldgSummary) {
      lines.push(`🏢 *Edificio:* ${bldgSummary}`);
    }
  }

  lines.push('');
  lines.push(
    `✅ *PARA CONFIRMAR:* Si tus datos de entrega son correctos, respondeme con la palabra *"CORRECTO"* para confirmar tu envío.`
  );

  return lines.join('\n');
}

export type ExpressConfirmationDecision =
  | 'CONFIRMED'
  | 'GPS_PIN_RECEIVED_CONFIRMED'
  | 'CORRECTION_OR_WRONG_MAP'
  | 'QUESTION_OR_OTHER';

/**
 * Evaluador determinístico de la palabra clave de confirmación ("CORRECTO") y recepción de pin GPS.
 * Tolera además variantes habladas/escritas como "mis datos son correctos", "están correctos", "está bien", etc.
 */
export function evaluateExpressOrderConfirmationInput(
  rawInput: string,
  hasGpsAlready: boolean
): {
  decision: ExpressConfirmationDecision;
  hasNewGpsPin: boolean;
  cleanText: string;
} {
  const cleanText = String(rawInput || '')
    .replace(/^🎤\s*/, '')
    .trim();

  const hasNewGpsPin =
    /Ubicaci[oó]n GPS exacta enviada por WhatsApp|https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(
      cleanText
    );

  const normalized = cleanText
    .toLowerCase()
    .replace(/[¡!¿?.,;:"'()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const hasNegationOrCorrection =
    /\b(no\s+es|no\s+est[aá]n?\s+bien|no\s+es\s+correct[oa]s?|no\s+son\s+correct[oa]s?|no\s+est[aá]n?\s+correct[oa]s?|no\s+correct[oa]s?|incorrect[oa]s?|est[aá]n?\s+mal|equivocad[oa]s?|cambiar|corregir|corrijo|otra\s+direcci[oó]n|otro\s+barrio|otra\s+ciudad|mal\s+ubicad[oa]|no\s+coincide|cancelar|anular|espera|pero\s+mi\s+barrio|pero\s+la\s+ciudad|en\s+realidad\s+es)\b/i.test(
      normalized
    );

  if (hasNegationOrCorrection) {
    return {
      decision: 'CORRECTION_OR_WRONG_MAP',
      hasNewGpsPin,
      cleanText
    };
  }

  // Si contiene explícitamente "correcto" / "correctos" / "correcta" / "correto" sin negación, confirma de inmediato
  const hasDirectCorrectoWord = /\b(correct[oa]s?|corret[oa]s?)\b/i.test(normalized);

  const hasQuestion =
    /[?¿]/.test(cleanText) ||
    /\b(cual|qu[eé]|cuando|cu[aá]ndo|donde|d[oó]nde|como|c[oó]mo|cuanto|cu[aá]nto|garant[ií]a|precio|costo)\b/i.test(
      normalized
    );
  const wordCount = normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;

  const matchesExplicitKeyword =
    hasDirectCorrectoWord ||
    /\b(est[aá]n?\s+bien|ta\s+bien|todo\s+bien|todo\s+en\s+orden|todo\s+ok|todo\s+perfecto|est[aá]n?\s+todo\s+bien|est[aá]n?\s+todo\s+correct[oa]s?|s[ií]\s*,?\s*est[aá]n?\s+bien|s[ií]\s*,?\s*as[ií]\s+mismo|as[ií]\s+mismo|as[ií]\s+es|confirmado|confirmo|exacto|exactamente|eso\s+mismo|tal\s+cual|de\s+acuerdo|afirmativo|aprobado|coincide\s+todo|los\s+datos\s+est[aá]n?\s+bien|mis\s+datos\s+est[aá]n?\s+bien|son\s+correct[oa]s?|esos\s+son\s+mis\s+datos|mis\s+datos\s+son\s+correct[oa]s?|los\s+datos\s+son\s+correct[oa]s?|estan?\s+correct[oa]s?|est[aá]n?\s+correct[oa]s?|audio\s+correct[oa]s?|audio\s+est[aá]n?\s+bien|palabra\s+correct[oa]s?|escribo\s+correct[oa]s?|digo\s+correct[oa]s?|super\s+bien|s[uú]per\s+bien|muy\s+bien)\b/i.test(
      normalized
    );

  const matchesShortAffirmative =
    !hasQuestion &&
    wordCount > 0 &&
    wordCount <= 6 &&
    /\b(s[ií]|ok|oka|okay|dale|perfecto|listo|claro|bueno|excelente|genial|joya|b[aá]rbaro|ch[eé]vere)\b/i.test(
      normalized
    );

  const matchesConfirmationTrigger =
    matchesExplicitKeyword ||
    matchesShortAffirmative ||
    /^(s[ií]|dale\s+s[ií]|claro\s+que\s+s[ií]|s[ií]\s+se[ñn]or|s[ií]\s+se[ñn]ora)$/i.test(normalized);

  if (hasNewGpsPin) {
    return {
      decision: 'GPS_PIN_RECEIVED_CONFIRMED',
      hasNewGpsPin: true,
      cleanText
    };
  }

  if (matchesConfirmationTrigger) {
    // La palabra "CORRECTO" (o afirmación equivalente) confirma los datos de la imagen inmediatamente
    return {
      decision: 'CONFIRMED',
      hasNewGpsPin: false,
      cleanText
    };
  }

  return {
    decision: 'QUESTION_OR_OTHER',
    hasNewGpsPin,
    cleanText
  };
}

export type ExpressPromoDecision =
  | 'ACCEPT_PROMO_SEND_ALIAS'
  | 'DECLINE_COD'
  | 'POLITE_ACK_KEEP_COD'
  | 'RECEIPT_SENT'
  | 'NEEDS_LLM';

/**
 * Evaluador determinístico de la palabra clave "QUIERO PARTICIPAR" / "SÍ QUIERO" para enviar directo el alias bancario,
 * tolerando además errores de tipeo reales como "Yo pago sl recibir" para cobro contra entrega.
 */
export function evaluateExpressPromoDecisionInput(rawInput: string): ExpressPromoDecision {
  const cleanText = String(rawInput || '')
    .replace(/^🎤\s*/, '')
    .trim();

  if (
    /COMPROBANTE_PAGO_ADELANTADO/i.test(cleanText) ||
    /\b(ya\s+transfer[ií]|ya\s+pagu[eé]|ya\s+hice\s+la\s+transferencia|ya\s+envi[eé]\s+el\s+comprobante|ah[ií]\s+te\s+mand[eé]\s+el\s+comprobante|te\s+paso\s+el\s+comprobante)\b/i.test(
      cleanText
    )
  ) {
    return 'RECEIPT_SENT';
  }

  const normalized = cleanText
    .toLowerCase()
    .replace(/[¡!¿?.,;:"'()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Reconocimiento tolerante a typos reales ("pago sl recibir", "pago al recibir", "contra entrega", "efectivo", "no gracias")
  const isCodChoice =
    /\b((pago|abono|pagar|abonar|prefiero|mejor|voy\s+a\s+pagar)\s*(al|sl|el|a|en|cuando)\s*(recibir|entregar|entrega|llegue|puerta|mano)|contra\s*entrega|contraentrega|en\s*efectivo|efectivo\s+al\s+recibir|\bal\s+recibir\b|\bsl\s+recibir\b|en\s+puerta|no\s+gracias|no\s+quiero\s+participar|no\s+participo|paso\s+por\s+ahora|sin\s+adelanto)\b/i.test(
      normalized
    );
  if (isCodChoice) {
    return 'DECLINE_COD';
  }

  // Cortesías genéricas ("ok", "dale gracias", "muchas gracias") JAMÁS deben disparar el alias bancario
  if (
    /^(ok|oka|okay|dale|bueno|listo|genial|excelente|perfecto|gracias|muchas\s+gracias|mil\s+gracias|dale\s+gracias|ok\s+gracias|bueno\s+gracias|est[aá]\s+bien\s+gracias|👍+|🙏+)$/i.test(
      normalized
    )
  ) {
    return 'POLITE_ACK_KEEP_COD';
  }

  const hasNegative = /\b(no\s+quiero|todav[ií]a\s+no|no\s+puedo|no\s+tengo\s+para\s+transferir)\b/i.test(
    normalized
  );

  const matchesParticipateTrigger =
    !hasNegative &&
    /\b(quiero\s+participar|participar|s[ií]\s+quiero|quiero\s+la\s+promo|quiero\s+la\s+promoci[oó]n|quiero\s+el\s+descuento|quiero\s+aprovechar|me\s+interesa\s+la\s+promo|pasame\s+el\s+alias|p[aá]same\s+el\s+alias|enviame\s+el\s+alias|env[ií]ame\s+el\s+alias|mandame\s+el\s+alias|m[aá]ndame\s+el\s+alias|pasame\s+los\s+datos|datos\s+bancarios|quiero\s+transferir|voy\s+a\s+transferir)\b/i.test(
      normalized
    );

  if (matchesParticipateTrigger) {
    return 'ACCEPT_PROMO_SEND_ALIAS';
  }

  return 'NEEDS_LLM';
}

/**
 * Valida si una respuesta generada en etapa post-confirmación (después del cierre en Paso 5)
 * es demasiado corta (ej. 1, 2, 3 o menos de 22 palabras), lo cual está prohibido porque el agente
 * debe ser sumamente empático, conversacional, buscar ángulos y nunca cortar en seco.
 */
export function isPostConfirmReplyTooShort(replyText: string): boolean {
  const cleaned = String(replyText || '').trim();
  if (!cleaned) return true;
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length < 22;
}

/**
 * Genera respuestas post-confirmación ricas, empáticas, conversacionales (de 3 a 5 oraciones, >40 palabras)
 * con múltiples ángulos argumentales sin repetir frases, adaptadas a preguntas congruentes,
 * comentarios no congruentes (evasión educada sin cerrar la puerta), solicitudes de cambio o despedida,
 * y congruentes con si el cliente vive en un Edificio o en una Casa Independiente.
 */
export function buildEmpatheticPostConfirmationReply(
  order: Partial<Order> | null | undefined,
  cleanInput: string,
  turnNumber: number,
  callPhoneSpeech: string,
  isNaturalClosingTurn: boolean
): string {
  const rawName = String(order?.nombre || '').trim();
  const firstName = rawName.split(/\s+/)[0] || 'cliente';
  const displayFirstName = firstName !== 'qué tal' ? firstName : 'cliente';
  const isBuilding = isBuildingOrder(order);
  const placeLabel = isBuilding
    ? `tu edificio${order?.nombreEdificio ? ` ${order.nombreEdificio}` : ''}`
    : 'tu casa';
  const monto = order?.monto ? formatGs(order.monto) : 'el monto acordado';
  const angle = ((Math.max(1, turnNumber) - 1) % 4) + 1;
  const rawProd = String(order?.producto || '').trim();
  const isDefaultNoelux = !rawProd || /noelux|proyector/i.test(rawProd);
  const productLabel = isDefaultNoelux ? 'Proyector Navideño' : rawProd;
  const customAngles: string[] | undefined = Array.isArray((order as any)?.agentBrain?.postConfirmationProductAngles)
    ? (order as any).agentBrain.postConfirmationProductAngles
    : undefined;

  const clientAskedForPhoneOrChange =
    /\b(n[uú]mero|telefono|tel[eé]fono|soporte|llamar|llamo|contacto|agregar|aumentar|cambiar|modificar|cancelar|anular|otro|m[aá]s|direcci[oó]n|piso|edificio)\b/i.test(
      cleanInput
    );

  const clientAskedProductOrShippingCongruent =
    /\b(proyector|luz|luces|lluvia|agua|afuera|exterior|enchufe|cable|garant[ií]a|dise[ñn]o|figura|cu[aá]ndo|hora|llega|repartidor|env[ií]o|entrega|pago|efectivo|qr|tarjeta|funciona|instala|distancia|metros|bater[ií]a|usa|caja|trae|incluye|tama[ñn]o|potencia|material)\b/i.test(
      cleanInput
    );

  if (isNaturalClosingTurn && !clientAskedForPhoneOrChange && !clientAskedProductOrShippingCongruent) {
    if (angle % 2 === 1) {
      return `Muchísimas gracias a vos por tu excelente buena onda y por conversar conmigo, ${displayFirstName}. Quedate con la tranquilidad total de que tu paquete del ${productLabel} ya sigue su curso en la línea de despacho con todos los sellos de calidad para que el repartidor te lo entregue impecable en ${placeLabel}, y por cualquier cosita te queda nuestro número directo ${callPhoneSpeech}. Que pases una hermosa jornada.`;
    }
    return `Te agradezco de corazón por tu amabilidad y por tu confianza, ${displayFirstName}, ha sido un verdadero gusto atenderte hoy. Tu pedido ya quedó cien por ciento embalado y priorizado en la hoja de ruta para llegar perfecto hasta ${placeLabel}, y recordá que recién abonás tus ${monto} al recibirlo en mano; cualquier consulta extra tenés nuestra línea directa ${callPhoneSpeech} siempre a tu disposición.`;
  }

  // CASO 1: Pide modificar el pedido confirmado, cancelar o pide el número de soporte (4 ángulos distintos explicando el porqué y para qué)
  if (clientAskedForPhoneOrChange) {
    if (angle === 1) {
      return `Te entiendo perfectamente lo que me comentás, ${displayFirstName}, y te explico con todo cariño el porqué y para qué desde esta pantalla ya no nos permite modificar la orden por chat. Lo que sucede es que apenas confirmamos los datos de ${placeLabel}, nuestro sistema informático emitió la etiqueta con código de barras y el equipo de depósito selló tu caja con precinto de seguridad para que suba directo a la camioneta del repartidor sin perder su prioridad. Justamente para blindar tu envío el sistema bloquea las ediciones por mensaje, pero si querés que en administración central abran manualmente tu planilla antes de que salga el chofer, podés pegarles una llamadita al ${callPhoneSpeech} donde un especialista te ayuda al instante.`;
    }
    if (angle === 2) {
      return `Claro que sí, ${displayFirstName}, mirá te cuento con total empatía el motivo real por el cual desde esta terminal de seguimiento ya no podemos alterar la planilla por escrito. Cuando tu pedido del ${productLabel} pasa al sector de despacho, el sistema le asigna automáticamente al repartidor tu unidad probada en taller y cierra la boleta de ruta hacia ${placeLabel} por ${monto}, todo esto para evitar cualquier confusión de mercadería o de cobro al entregarte. Si necesitás realizar ese ajuste en la orden maestra, comunicándote un segundito por llamada al ${callPhoneSpeech} los encargados de central tienen la llave del sistema para gestionártelo con todo gusto.`;
    }
    if (angle === 3) {
      return `Qué importante lo que me decís, ${displayFirstName}, y te explico con total transparencia cómo funciona nuestro protocolo informático para cuidar tu compra. Desde esta cabina de confirmación nuestro sistema únicamente nos habilita a verificar la ubicación de ${placeLabel} y darle salida prioritaria a tu paquete, y una vez aprobado se bloquea la edición por chat para garantizar que nadie altere por error los datos que ya validamos juntos. Por eso, para cualquier cambio de unidades o de orden, podés llamar directamente al ${callPhoneSpeech} donde el equipo de ventas tiene autorización para modificar tu ficha en vivo.`;
    }
    return `Te comprendo totalmente, ${displayFirstName}, y te comento con mucho respeto el porqué de este procedimiento operativo. Cada unidad confirmada entra enseguida a la mesa de control técnico donde se verifica su funcionamiento y se embala con protección reforzada a tu nombre para enviarla a ${placeLabel}, motivo por el cual la orden queda sellada en nuestra pantalla. Si deseás que desde administración central te gestionen algún ajuste manual antes de que parta el móvil, tenés a tu disposición la línea telefónica directa ${callPhoneSpeech} acá abajo en el chat.`;
  }

  // CASO 2: Pregunta CONGRUENTE sobre el producto, funcionamiento, garantía o envío
  if (clientAskedProductOrShippingCongruent) {
    if (!isDefaultNoelux && customAngles && customAngles.length > 0) {
      const customAngleText = customAngles[(angle - 1) % customAngles.length];
      return `Qué buena pregunta me hacés, ${displayFirstName}, con muchísimo gusto te cuento todos los detalles para que estés con total seguridad. ${customAngleText} Además, tu paquete ya quedó confirmado en despacho para entregarse en ${placeLabel} con envío totalmente gratis y recién abonás los ${monto} cuando el repartidor te lo entregue en mano.`;
    }
    if (angle === 1) {
      return `Qué buena pregunta me hacés, ${displayFirstName}, con muchísimo gusto te cuento todos los detalles para que estés con total seguridad. Tu Proyector Navideño cuenta con doce diseños en movimiento de alta definición, es totalmente impermeable con protección para lluvia o intemperie y cubre hasta setenta metros cuadrados enchufándolo directo en noventa segundos. Además, tu paquete ya quedó confirmado en despacho para entregarse en ${placeLabel} con envío totalmente gratis y recién abonás los ${monto} cuando el repartidor te lo entregue en mano.`;
    }
    if (angle === 2) {
      return `Me encanta que me consultes eso, ${displayFirstName}, te explico con todo detalle porque es una de las mayores ventajas de tu equipo. Antes de sellar tu caja en nuestra mesa técnica verificamos el motor rotatorio y la lámpara LED para que ilumine con nitidez total desde el primer minuto, contando además con garantía escrita y base doble tanto para exterior como para interior. Quedate con la tranquilidad de que el courier ya tiene agendada la ruta hacia ${placeLabel} y te avisará al llegar para que revises y abones recién en puerta.`;
    }
    if (angle === 3) {
      return `Con todo gusto te respondo esa duda, ${displayFirstName}, para que tengas la máxima tranquilidad con tu compra ya confirmada. El equipo va completo en su caja sellada con sus doce tarjetas intercambiables y cable reforzado listo para enchufar, y como ya dejamos registrada toda la referencia de ${placeLabel} en nuestro sistema informático, el chofer asignado a tu zona te va a contactar directamente cuando esté en camino para entregártelo en mano.`;
    }
    return `Excelente consulta, ${displayFirstName}, te comento con mucha alegría que tu unidad ya pasó por revisión de calidad en nuestro depósito y está lista en el sector de carga. El proyector está diseñado específicamente para resistir el clima de Paraguay sin recalentar y proyectar figuras súper nítidas a varios metros de distancia, así que muy pronto el repartidor estará llegando a ${placeLabel} para entregártelo con pago contra entrega.`;
  }

  // CASO 3: Comentario o pregunta NO CONGRUENTE (otro tema, broma, charla casual) -> Evasión educada, muy empática y con ángulos potentes sin cerrarle la puerta en la cara
  if (angle === 1) {
    return `Qué simpático e interesante lo que me comentás, ${displayFirstName}, la verdad es que da muchísimo gusto conversar con personas con tan buena onda como vos. Mirá, te cuento con todo cariño que en este momento te estoy hablando desde la cabina de control operativo donde estamos conectados en vivo con los técnicos y empaquetadores que están probando y sellando las cajas que salen hoy a reparto, por lo que toda nuestra pantalla en este sector está dedicada exclusivamente a cuidar que tu ${productLabel} salga verificado al cien por ciento y llegue impecable hasta ${placeLabel}.`;
  }
  if (angle === 2) {
    return `Te escucho con muchísima atención y simpatía, ${displayFirstName}, y te agradezco de corazón la confianza al escribirme. Te comento con total amabilidad que desde esta terminal de logística nuestro sistema informático está enfocado exclusivamente en monitorear las hojas de ruta de los repartidores y el control de calidad de los pedidos confirmados, justamente para garantizarte que tu paquete viaje seguro y lo recibas sin ningún contratiempo en ${placeLabel}.`;
  }
  if (angle === 3) {
    return `Totalmente comprensible lo que me decís, ${displayFirstName}, qué lindo poder charlar un ratito con vos mientras el equipo termina de alistar la carga del día. Como desde este puesto de despacho trabajamos únicamente con las planillas de envíos y el sellado técnico de cada unidad, concentramos todo nuestro trabajo de cabina en asegurar que tu ${productLabel} tenga prioridad en la camioneta que va hacia ${placeLabel} y llegue en perfectas condiciones.`;
  }
  return `Me saca una sonrisa tu mensaje, ${displayFirstName}, y te valoro muchísimo la buena predisposición. Te cuento con mucha educación que acá estamos justo en el centro de coordinación de empaque supervisando que cada equipo confirmado lleve sus accesorios completos y su precinto de seguridad, así que todo nuestro enfoque en esta línea está puesto en que disfrutes muchísimo tu pedido apenas llegue a ${placeLabel}.`;
}

export function isOrderConfirmedByAgent(order?: Partial<Order> | null): boolean {
  if (!order) return false;
  return Boolean(
    order.datosConfirmados ||
    (order.convStep && order.convStep >= 5) ||
    (order.empaquetado && order.referenciaCasa) ||
    order.pagoAdelantadoVerificadoAdmin ||
    order.pagoAdelantadoEstado === 'pagado_adelantado_confirmado'
  );
}

/**
 * Devuelve true cuando el cliente YA ENVIÓ el comprobante / aviso de pago adelantado,
 * pero el vendedor todavía NO activó el interruptor de verificación ("Pago Enviado / Pago Adelantado por Verificar").
 */
export function isOrderPrepaymentSentPendingVerification(order?: Partial<Order> | null): boolean {
  if (!order) return false;
  if (isOrderPrepaymentVerifiedAndPaid(order)) return false;
  return Boolean(
    order.pagoAdelantadoComprobanteRecibido ||
    order.promoPagoAdelantadoStage === 'receipt_received_verifying' ||
    order.pagoAdelantadoEstado === 'pago_enviado_por_verificar' ||
    order.pagoAdelantadoEstado === 'comprobante_recibido'
  );
}

/**
 * Devuelve true únicamente cuando el vendedor YA COMPROBÓ la transferencia en su cuenta
 * de Banco Familiar y activó el interruptor ("Confirmado Pago Adelantado").
 * Cuando esto es true, el pedido pasa automáticamente de la pestaña "✅ Confirmados"
 * a la pestaña exclusiva "💎 Pago Adelantado".
 */
export function isOrderPrepaymentVerifiedAndPaid(order?: Partial<Order> | null): boolean {
  if (!order) return false;
  return Boolean(
    order.pagoAdelantadoVerificadoAdmin ||
    order.pagoAdelantadoEstado === 'pagado_adelantado_confirmado'
  );
}

export function buildOrderComparisonSummary(order: Order): OrderComparisonSummary {
  const autoGpsLink =
    order.gpsLink ||
    (typeof order.gpsLat === 'number' && typeof order.gpsLng === 'number'
      ? `https://www.google.com/maps?q=${order.gpsLat.toFixed(6)},${order.gpsLng.toFixed(6)}`
      : undefined);

  const autoStreetViewLink =
    order.gpsStreetViewLink ||
    (typeof order.gpsLat === 'number' && typeof order.gpsLng === 'number'
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${order.gpsLat.toFixed(6)},${order.gpsLng.toFixed(6)}`
      : undefined);

  if (order.comparativaDatos && order.comparativaDatos.resumenTexto) {
    return {
      ...order.comparativaDatos,
      gpsLink: order.comparativaDatos.gpsLink || autoGpsLink,
      gpsStreetViewLink: order.comparativaDatos.gpsStreetViewLink || autoStreetViewLink,
      fachadaFotoUrl: order.comparativaDatos.fachadaFotoUrl || order.fachadaFotoUrl,
      gpsLat: order.comparativaDatos.gpsLat ?? order.gpsLat,
      gpsLng: order.comparativaDatos.gpsLng ?? order.gpsLng,
      gpsConfirmado: Boolean(order.comparativaDatos.gpsConfirmado || order.gpsConfirmado || autoGpsLink),
      tipoVivienda: order.comparativaDatos.tipoVivienda || order.tipoVivienda,
      nombreEdificio: order.comparativaDatos.nombreEdificio || order.nombreEdificio,
      pisoEdificio: order.comparativaDatos.pisoEdificio || order.pisoEdificio,
      departamentoNumero: order.comparativaDatos.departamentoNumero || order.departamentoNumero,
      tieneRecepcion: order.comparativaDatos.tieneRecepcion || order.tieneRecepcion,
      detalleRecepcion: order.comparativaDatos.detalleRecepcion || order.detalleRecepcion
    };
  }

  const nombreWeb = (order.nombre || '').trim();
  const celularWeb = (order.celular || '').trim();
  const ubicacionWeb = `${(order.ciudad || '').trim()}, ${(order.departamento || '').trim()}`.replace(/^,\s*|,\s*$/g, '');
  const direccionWeb = cleanStreetAddressText((order.direccion || '').trim());
  const buildingSummary = formatBuildingDetailsSummary(order);
  const referenciaConfirmada = (
    order.referenciaCasa ||
    buildingSummary ||
    (isBuildingOrder(order) ? 'Edificio verificado con el cliente en el chat' : 'Fachada verificada con el cliente en el chat')
  ).trim();
  const packConfirmado = `${order.cantidad || 1} ${(order.cantidad || 1) > 1 ? 'unidades' : 'unidad'} · ${formatGs(order.monto)} (${order.detalle || 'Efectivo al recibir'})`;

  const resumenTexto =
    order.resumenConfirmacionIA ||
    `El Agente IA completó los 5 pasos de validación con ${nombreWeb} (${formatWaPhone(celularWeb)}). Modalidad: ${isBuildingOrder(order) ? `EDIFICIO (${buildingSummary || direccionWeb})` : 'CASA INDEPENDIENTE'
    }. Se verificó que los datos dejados en el formulario web coinciden al 100% con los confirmados en la conversación: entrega en ${ubicacionWeb}, dirección "${direccionWeb}"${autoGpsLink ? ` (GPS exacto: ${autoGpsLink})` : ''} y referencia "${referenciaConfirmada}".`;

  return {
    nombreWeb,
    nombreConfirmado: nombreWeb,
    celularWeb,
    celularConfirmado: celularWeb,
    ubicacionWeb,
    ubicacionConfirmada: ubicacionWeb,
    direccionWeb,
    direccionConfirmada: direccionWeb,
    referenciaConfirmada,
    packConfirmado,
    coincidenDatos: true,
    resumenTexto,
    fechaConfirmacion: order.fecha,
    gpsLink: autoGpsLink,
    gpsStreetViewLink: autoStreetViewLink,
    fachadaFotoUrl: order.fachadaFotoUrl,
    gpsLat: order.gpsLat,
    gpsLng: order.gpsLng,
    gpsConfirmado: Boolean(order.gpsConfirmado || autoGpsLink),
    tipoVivienda: order.tipoVivienda || (isBuildingOrder(order) ? 'edificio' : 'casa'),
    nombreEdificio: order.nombreEdificio,
    pisoEdificio: order.pisoEdificio,
    departamentoNumero: order.departamentoNumero,
    tieneRecepcion: order.tieneRecepcion,
    detalleRecepcion: order.detalleRecepcion
  };
}

/**
 * Genera el reporte ejecutivo humano, espaciado y bien diseñado que el Agente envía
 * directamente al WhatsApp del vendedor sobre su producto específico.
 */
export function buildSellerExecutiveWhatsAppReport(
  productName: string,
  productOrders: Partial<Order>[],
  newlyConfirmedOrder?: Partial<Order> | null
): string {
  const confirmedList = productOrders.filter(o => isOrderConfirmedByAgent(o));
  const inProgressList = productOrders.filter(o => !isOrderConfirmedByAgent(o));
  const shippedCount = confirmedList.filter(
    o => o.estadoEnvioProducto === 'enviado' || o.estadoEnvioProducto === 'concretado' || o.estado === 'en_camino' || o.estado === 'entregado_pagado'
  ).length;
  const completedCount = confirmedList.filter(
    o => o.concretadoCobrado || o.estadoEnvioProducto === 'concretado' || o.estado === 'entregado_pagado'
  ).length;

  const lines: string[] = [];

  if (newlyConfirmedOrder) {
    lines.push(`📋 *REPORTE DE TU AGENTE · ${productName.toUpperCase()}*`);
    lines.push('');
    lines.push(
      `Hola jefe, acabo de terminar de confirmar el pedido de *${newlyConfirmedOrder.nombre || 'Cliente'}* (${newlyConfirmedOrder.ciudad || 'Paraguay'}). Te paso el resumen actualizado de tu producto:`
    );
  } else {
    lines.push(`📋 *REPORTE ACTUALIZADO · ${productName.toUpperCase()}*`);
    lines.push('');
    lines.push(`Hola jefe, acá tenés el estado en tiempo real de los pedidos de tu producto:`);
  }

  lines.push('');
  lines.push(`📊 *ESTADO GENERAL:*`);
  lines.push(`• ✅ *Confirmados listos:* ${confirmedList.length}`);
  lines.push(`• ⏳ *En curso de confirmación:* ${inProgressList.length}`);
  lines.push(`• 🚚 *Enviados / Concretados:* ${shippedCount} enviados (${completedCount} cobrados)`);

  if (confirmedList.length > 0) {
    lines.push('');
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`✅ *PEDIDOS CONFIRMADOS (${confirmedList.length}):*`);
    confirmedList.slice(0, 10).forEach((ord, idx) => {
      const num = idx + 1;
      const montoStr = formatGs(ord.monto || 189000);
      const estadoDespacho =
        ord.concretadoCobrado || ord.estadoEnvioProducto === 'concretado'
          ? '💰 Concretado'
          : ord.estadoEnvioProducto === 'enviado'
            ? '🚚 Enviado'
            : '📦 Listo p/ envío';
      const ordGpsLink =
        ord.gpsLink ||
        (typeof ord.gpsLat === 'number' && typeof ord.gpsLng === 'number'
          ? `https://www.google.com/maps?q=${ord.gpsLat.toFixed(6)},${ord.gpsLng.toFixed(6)}`
          : '');
      const ordStreetViewLink =
        ord.gpsStreetViewLink ||
        (typeof ord.gpsLat === 'number' && typeof ord.gpsLng === 'number'
          ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ord.gpsLat.toFixed(6)},${ord.gpsLng.toFixed(6)}`
          : '');
      const isBldg = isBuildingOrder(ord);
      const bldgDetails = formatBuildingDetailsSummary(ord);
      lines.push('');
      lines.push(
        `*#${num} · ${ord.nombre || 'Cliente'}* (${ord.celular || 'S/N'}) · ${isBldg ? '🏢 *EDIFICIO*' : '🏠 *CASA*'}`
      );
      lines.push(`📍 ${ord.ciudad || ''}, ${ord.departamento || ''} — ${ord.direccion || ''}`);
      if (isBldg && bldgDetails) {
        lines.push(`🏢 *Datos del Edificio:* ${bldgDetails}`);
      }
      if (ordGpsLink) {
        lines.push(`🗺️ *GPS Exacto p/ Courier:* ${ordGpsLink}`);
      }
      if (ordStreetViewLink) {
        lines.push(`🚶 *Fachada Street View 360°:* ${ordStreetViewLink}`);
      }
      lines.push(`🏠 Ref: ${ord.referenciaCasa || bldgDetails || 'Datos verificados en el chat'}`);
      lines.push(`🛍️ Pack: ${ord.cantidad || 1} un. (${montoStr}) · _${estadoDespacho}_`);
    });
  }

  if (inProgressList.length > 0) {
    lines.push('');
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`⏳ *EN CURSO DE CONFIRMACIÓN (${inProgressList.length}):*`);
    inProgressList.slice(0, 5).forEach((ord, idx) => {
      const num = idx + 1;
      lines.push(
        `• *#${num}* ${ord.nombre || 'Cliente'} (${ord.ciudad || 'Paraguay'}) — _En conversación (Paso ${ord.convStep || 1}/5)_`
      );
    });
    if (inProgressList.length > 5) {
      lines.push(`• _...y ${inProgressList.length - 5} pedido(s) más en gestión._`);
    }
  }

  lines.push('');
  lines.push(
    `💬 _Cuando quieras saber cuántos pedidos siguen en curso o cuáles ya están confirmados, escribime por acá mismo en WhatsApp._`
  );

  return lines.join('\n');
}

/**
 * Filtra pedidos del panel administrativo por nombre, número de teléfono (ignorando espacios/guiones/prefijo 595)
 * y estado de archivado ('activos' | 'archivados' | 'todos').
 */
export function filterAdminOrders(
  orders: Order[],
  options: {
    nameQuery?: string;
    phoneQuery?: string;
    archiveMode?: 'activos' | 'archivados' | 'todos';
  }
): Order[] {
  const nameFilter = String(options.nameQuery || '').trim().toLowerCase();
  const rawPhoneFilter = String(options.phoneQuery || '').trim();
  const phoneDigitsFilter = rawPhoneFilter.replace(/\D/g, '');
  const archiveMode = options.archiveMode || 'activos';

  return (orders || []).filter(ord => {
    const isArchived = Boolean(ord.archivado);
    if (archiveMode === 'activos' && isArchived) return false;
    if (archiveMode === 'archivados' && !isArchived) return false;

    if (nameFilter) {
      const ordName = String(ord.nombre || '').toLowerCase();
      const confirmedName = String(ord.comparativaDatos?.nombreConfirmado || '').toLowerCase();
      const ordId = String(ord.reservaid || '').toLowerCase();
      if (!ordName.includes(nameFilter) && !confirmedName.includes(nameFilter) && !ordId.includes(nameFilter)) {
        return false;
      }
    }

    if (rawPhoneFilter) {
      const ordPhoneRaw = String(ord.celular || '').toLowerCase();
      const ordPhoneDigits = ordPhoneRaw.replace(/\D/g, '');
      const ordPhone433 = formatParaguayanPhone433(ord.celular).toLowerCase();
      const ordPhoneNospace = ordPhone433.replace(/\s+/g, '');

      const matchesText = ordPhoneRaw.includes(rawPhoneFilter.toLowerCase()) || ordPhone433.includes(rawPhoneFilter.toLowerCase());
      const matchesDigits =
        phoneDigitsFilter.length > 0 &&
        (ordPhoneDigits.includes(phoneDigitsFilter) || ordPhoneNospace.includes(phoneDigitsFilter));

      if (!matchesText && !matchesDigits) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Genera el texto completo y estructurado de la ficha del cliente (Nombre, Teléfono, Ciudad, Dirección, Referencia y GPS)
 * listo para copiar con 1 clic y enviar al courier o pegar en WhatsApp.
 */
export function formatFullOrderTextForCourier(
  order: Partial<Order>,
  comp?: ReturnType<typeof buildOrderComparisonSummary> | null,
  source: 'web' | 'confirmado' = 'confirmado'
): string {
  const isWeb = source === 'web';
  const name = isWeb
    ? comp?.nombreWeb || order.nombre || ''
    : comp?.nombreConfirmado || order.nombre || '';
  const phone = isWeb
    ? comp?.celularWeb || order.celular || ''
    : comp?.celularConfirmado || order.celular || '';
  const city = isWeb
    ? comp?.ubicacionWeb || order.ciudad || ''
    : comp?.ubicacionConfirmada || order.ciudad || '';
  const address = isWeb
    ? comp?.direccionWeb || order.direccion || ''
    : comp?.direccionConfirmada || order.direccion || '';
  const ref = comp?.referenciaConfirmada || order.referenciaCasa || '';
  const gps =
    comp?.gpsLink ||
    order.gpsLink ||
    (typeof order.gpsLat === 'number' && typeof order.gpsLng === 'number'
      ? `https://www.google.com/maps?q=${order.gpsLat.toFixed(6)},${order.gpsLng.toFixed(6)}`
      : '');
  const isPrepaid = isOrderPrepaymentVerifiedAndPaid(order as any);
  const rawMonto = Number(order.monto) || 189000;
  const amount = isPrepaid
    ? Number(order.montoConDescuentoAdelantado) || Math.max(50000, rawMonto - 30000)
    : rawMonto;

  const lines = [
    `📦 FICHA DE DESPACHO · Pedido #${order.reservaid || 'S/N'} (${isPrepaid ? '💎 PAGO ADELANTADO' : '✅ PAGO CONTRA ENTREGA'})`,
    `👤 Cliente: ${name}`,
    `📱 WhatsApp: ${phone}`,
    `📍 Ciudad: ${city}`,
    `🏠 Dirección: ${address}`
  ];

  if (ref) {
    lines.push(`🏡 Referencia: ${ref}`);
  }
  if (gps) {
    lines.push(`🗺️ Mapa GPS: ${gps}`);
  }
  if (order.cantidad) {
    lines.push(`📦 Pack: ${order.cantidad} un. · Total: ${formatGs(amount)}`);
  }
  if (isPrepaid) {
    lines.push(`💎 Estado de Pago: PAGADO POR ADELANTADO (${order.pagoAdelantadoBanco || 'Banco Familiar'} · Alias ${order.pagoAdelantadoAlias || '3856033'})`);
  } else {
    lines.push(`💵 Cobro al Entregar: Cobrar ${formatGs(amount)} en efectivo al cliente`);
  }

  return lines.join('\n');
}

