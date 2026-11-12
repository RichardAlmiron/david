import { AppConfig } from './types';

const runtimeEnv: Record<string, any> =
  typeof import.meta !== 'undefined' && (import.meta as any).env
    ? (import.meta as any).env
    : typeof process !== 'undefined' && process.env
      ? process.env
      : {};

export const OFFICIAL_SUPABASE_URL = 'https://pgpmopannzzubunuhlmb.supabase.co';
export const OFFICIAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncG1vcGFubnp6dWJ1bnVobG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNjg2MTAsImV4cCI6MjEwOTg0NDYxMH0.Mgy-Uo7_nJcFf_Wii9RBmAuI9meWZGcNdgp8X_bls88';

export function sanitizeSupabaseCredentials(candidate?: {
  url?: string | null;
  anonKey?: string | null;
}): { url: string; anonKey: string } {
  const rawUrl = String(candidate?.url || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
    .replace(/\/+$/, '');
  const rawKey = String(candidate?.anonKey || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();

  const isInvalid =
    !rawUrl ||
    !rawKey ||
    rawKey === 'native-internal-key' ||
    rawUrl.includes('cmxcohevrlmzsfqslmft.supabase.co') ||
    rawUrl.includes('localhost') ||
    rawUrl.includes('127.0.0.1') ||
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(rawUrl) ||
    (typeof window !== 'undefined' && rawUrl === window.location.origin);

  if (isInvalid) {
    return {
      url: OFFICIAL_SUPABASE_URL,
      anonKey: OFFICIAL_SUPABASE_ANON_KEY
    };
  }

  return {
    url: rawUrl,
    anonKey: rawKey
  };
}

const sanitizedBootSupabase = sanitizeSupabaseCredentials({
  url:
    runtimeEnv.VITE_SUPABASE_URL ||
    runtimeEnv.SUPABASE_URL ||
    (typeof process !== 'undefined' && process.env
      ? process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
      : ''),
  anonKey:
    runtimeEnv.VITE_SUPABASE_ANON_KEY ||
    runtimeEnv.SUPABASE_ANON_KEY ||
    (typeof process !== 'undefined' && process.env
      ? process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
      : '')
});

const envSupabaseUrl = sanitizedBootSupabase.url;
const envSupabaseAnonKey = sanitizedBootSupabase.anonKey;

export const DEFAULT_CONFIG: AppConfig = {
  marca: "Noelux",
  base: "",
  wa: "",
  directoWhatsapp: true,
  normal: 249000,
  lote: {
    1: 189000,
    2: 358000,
    3: 507000
  },
  maxCant: 3,
  stock: 14,
  pixelId: "",
  corte: {
    activa: false,
    texto: "Reservas confirmadas antes de las 20:00 entran a la coordinación de entrega más próxima."
  },
  urgencia: {
    activa: false,
    texto: "Las reservas de esta semana cierran el domingo — después se coordinan para el lote siguiente."
  },
  supabase: {
    url: envSupabaseUrl,
    anonKey: envSupabaseAnonKey
  },
  viral: {
    activo: false,
    ciclo: 5,
    premio: 100000
  }
};

export function formatGs(num: number | undefined | null): string {
  return "Gs. " + Number(num || 0).toLocaleString("es-PY");
}

export function formatWaPhone(phone: string | undefined | null): string {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('09') && cleaned.length === 10) {
    cleaned = '595' + cleaned.slice(1);
  } else if (cleaned.startsWith('9') && cleaned.length === 9) {
    cleaned = '595' + cleaned;
  }
  return cleaned;
}

export function resolveProductSellerWa(
  product?: { id?: string; nombre?: string; wa?: string } | null,
  allProducts?: Array<{ id?: string; nombre?: string; wa?: string }>
): string {
  const directWa = formatWaPhone(product?.wa);
  if (directWa) return directWa;

  if (product && Array.isArray(allProducts) && allProducts.length > 0) {
    const matched = allProducts.find(
      p =>
        (product.id && p.id === product.id) ||
        (product.nombre && p.nombre && p.nombre.toLowerCase() === product.nombre.toLowerCase())
    );
    const matchedWa = formatWaPhone(matched?.wa);
    if (matchedWa) return matchedWa;
  }

  return '';
}

export function buildOrderWhatsAppUrl(sellerWa: string | undefined | null, message: string): string {
  const cleanPhone = formatWaPhone(sellerWa);
  const encodedMsg = encodeURIComponent(message || '');
  if (!cleanPhone) {
    return `https://wa.me/?text=${encodedMsg}`;
  }
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
}

let memoryDeviceToken = "";
let memoryPromoterCode = "";

export function getDeviceToken(): string {
  if (!memoryDeviceToken) {
    memoryDeviceToken = "dev-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
  }
  return memoryDeviceToken;
}

export function getOrCreatePromoterCode(): string {
  if (!memoryPromoterCode) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let suf = "";
    for (let i = 0; i < 5; i++) {
      suf += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    memoryPromoterCode = "NOE-" + suf;
  }
  return memoryPromoterCode;
}
