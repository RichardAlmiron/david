import { AppConfig } from './types';

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
    url: "https://cmxcohevrlmzsfqslmft.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNteGNvaGV2cmxtenNmcXNsbWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNjMwNzYsImV4cCI6MjEwODkzOTA3Nn0.6SLXT2tvyR6Y8_5j_NSy0eT7qN7e_aO5uiWW-P3UW7w"
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

export function getDeviceToken(): string {
  let d = "";
  try {
    d = localStorage.getItem("nl_dev") || "";
  } catch (err) {}
  if (!d) {
    d = "dev-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
    try {
      localStorage.setItem("nl_dev", d);
    } catch (err) {}
  }
  return d;
}

export function getOrCreatePromoterCode(): string {
  let code = "";
  try {
    code = localStorage.getItem("nl_code") || "";
  } catch (err) {}
  if (!code) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let suf = "";
    for (let i = 0; i < 5; i++) {
      suf += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = "NOE-" + suf;
    try {
      localStorage.setItem("nl_code", code);
    } catch (err) {}
  }
  return code;
}
