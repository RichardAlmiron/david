export type WhatsAppFormatReason =
  | 'too_short'
  | 'invalid_length'
  | 'landline'
  | 'invalid_prefix'
  | 'fake_sequence';

export interface WhatsAppFormatValidationResult {
  valid: boolean;
  normalizedPhone: string;
  localDigits: string;
  reasonCode?: WhatsAppFormatReason;
  message?: string;
}

const PARAGUAY_LANDLINE_PREFIXES = [
  '021',
  '024',
  '025',
  '026',
  '027',
  '028',
  '029',
  '031',
  '032',
  '033',
  '034',
  '041',
  '042',
  '043',
  '045',
  '046',
  '047',
  '048',
  '051',
  '052',
  '053',
  '054',
  '061',
  '062',
  '063',
  '064',
  '071',
  '072',
  '073',
  '074',
  '075',
  '081',
  '082',
  '083',
  '085'
];

const REJECTED_TEST_SUBSCRIBERS = new Set([
  '000000',
  '111111',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
  '123456',
  '654321',
  '012345',
  '543210',
  '234567',
  '123123',
  '000111',
  '111222'
]);

/**
 * Normalizes any Paraguayan phone input into 5959XXXXXXXX (or international digits when non-PY +cc is provided).
 * Also repairs common Paraguay typing mistake "+595 0981..." -> "595981...".
 */
export function normalizeParaguayPhoneDigits(raw: string): string {
  const rawStr = String(raw || '').trim();
  let digits = rawStr.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('59509') && digits.length >= 13) {
    digits = '5959' + digits.slice(5);
  } else if (digits.startsWith('5950') && digits.length >= 12) {
    digits = '595' + digits.slice(4);
  } else if (digits.startsWith('09') && digits.length === 10) {
    digits = '595' + digits.slice(1);
  } else if (digits.startsWith('9') && digits.length === 9) {
    digits = '595' + digits;
  }

  return digits;
}

/**
 * Strict Paraguayan mobile / WhatsApp format & anti-dummy validation.
 * Runs synchronously in 0ms on both client and server before live Baileys onWhatsApp lookup.
 */
export function validateWhatsAppPhoneFormat(raw: string): WhatsAppFormatValidationResult {
  const trimmed = String(raw || '').trim();
  const rawDigits = trimmed.replace(/\D/g, '');

  if (rawDigits.length < 8) {
    return {
      valid: false,
      normalizedPhone: '',
      localDigits: rawDigits,
      reasonCode: 'too_short',
      message: 'Faltan números. Escribí tu WhatsApp completo (ej: 0981 452 890).'
    };
  }

  // Detect landline numbers typed locally (021..., 061...) or with 595 (59521..., 59561...)
  const asLocal = rawDigits.startsWith('595')
    ? '0' + rawDigits.slice(3).replace(/^0+/, '')
    : rawDigits.startsWith('0')
    ? rawDigits
    : '0' + rawDigits;

  if (PARAGUAY_LANDLINE_PREFIXES.some((prefix) => asLocal.startsWith(prefix))) {
    return {
      valid: false,
      normalizedPhone: '',
      localDigits: asLocal,
      reasonCode: 'landline',
      message: 'Ese es un teléfono fijo, no un número de WhatsApp. Escribí tu celular (ej: 0981...).'
    };
  }

  const normalized = normalizeParaguayPhoneDigits(trimmed);

  // Explicit Paraguayan mobile check if entered without foreign +country or starts with 595 / 0 / 9
  const looksParaguayan =
    trimmed.startsWith('0') ||
    trimmed.startsWith('9') ||
    normalized.startsWith('595');

  if (looksParaguayan) {
    if (normalized.length !== 12 || !normalized.startsWith('595')) {
      return {
        valid: false,
        normalizedPhone: normalized,
        localDigits: asLocal,
        reasonCode: 'invalid_length',
        message: 'Número equivocado: en Paraguay un WhatsApp tiene 10 dígitos empezando con 09 (ej: 0981 452 890).'
      };
    }

    // Valid Paraguayan mobile carriers (CONATEL):
    // 096x (Vox), 097x (Personal), 098x (Tigo), 099x (Claro) with 4th digit 1-9
    if (!/^5959[6-9][1-9]\d{6}$/.test(normalized)) {
      return {
        valid: false,
        normalizedPhone: normalized,
        localDigits: asLocal,
        reasonCode: 'invalid_prefix',
        message: 'Este prefijo no corresponde a ninguna línea de WhatsApp válida en Paraguay (usá 096, 097, 098 o 099).'
      };
    }

    const subscriber = normalized.slice(6); // last 6 digits
    if (/^(\d)\1{5}$/.test(subscriber) || REJECTED_TEST_SUBSCRIBERS.has(subscriber)) {
      return {
        valid: false,
        normalizedPhone: normalized,
        localDigits: asLocal,
        reasonCode: 'fake_sequence',
        message: 'Este número no parece un WhatsApp real. Revisá y escribí tu número verdadero.'
      };
    }

    return {
      valid: true,
      normalizedPhone: normalized,
      localDigits: '0' + normalized.slice(3)
    };
  }

  // International explicit +country number (e.g. +54..., +55..., +1...)
  if (trimmed.startsWith('+') && normalized.length >= 10 && normalized.length <= 15) {
    return {
      valid: true,
      normalizedPhone: normalized,
      localDigits: normalized
    };
  }

  return {
    valid: false,
    normalizedPhone: normalized,
    localDigits: rawDigits,
    reasonCode: 'invalid_prefix',
    message: 'Este número no es un WhatsApp válido. Empezá con 09 (ej: 0981 452 890).'
  };
}
