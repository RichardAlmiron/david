import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestWaWebVersion,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  encodeSignedDeviceIdentity,
  jidEncode,
  generateMessageIDV2,
  downloadMediaMessage,
  Browsers,
  type WASocket
} from '@whiskeysockets/baileys';
// @ts-ignore
import WebSocket from 'ws';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import zlib from 'zlib';
import type { WaCommercialStageId } from '../src/types';
import {
  VIP_PREPAYMENT_DISCOUNT_GS,
  resolvePostTurnCommercialStage
} from '../src/utils/waStageCommercials';
import {
  formatGuaraniesSpeech,
  normalizeGuaraniesCurrencyForSpeech,
  buildExpressInitialAddressTextCard,
  evaluateExpressOrderConfirmationInput,
  evaluateExpressPromoDecisionInput
} from '../src/utils/orderConfirmation';
import {
  renderWaStageCommercialImage,
  renderPersonalizedOrderWelcomeImage,
  renderPersonalizedOrderConfirmedImage,
  type RenderPersonalizedOrderWelcomeResult
} from './waStageCommercialRenderer';

export type AgentChannel = 'audio' | 'texto';

export interface DeepgramVoiceProfile {
  id: string;
  name: string;
  gender: 'Femenina' | 'Masculina';
  accent: string;
  role: string;
  description: string;
  deepgramModel: string; // e.g. 'aura-2-estrella-es'
  sampleText: string;
}

// Backward compatibility aliases
export type VibeVoiceProfile = DeepgramVoiceProfile;
export type MingVoiceProfile = DeepgramVoiceProfile;

export const DEEPGRAM_VOICE_CATALOG: DeepgramVoiceProfile[] = [
  {
    id: 'deepgram-estrella',
    name: 'Estrella (Femenina Natural · Deepgram Aura-2)',
    gender: 'Femenina',
    accent: 'Español Mexicano (es-MX)',
    role: 'Confirmación de Pedidos & Atención al Cliente',
    description: 'Voz femenina natural, cálida y expresiva con acento mexicano. Ideal para atención al cliente.',
    deepgramModel: 'aura-2-estrella-es',
    sampleText: 'Hola, ¿qué tal? ¿Cómo estás? Te hablo del área de envíos por tu pedido del Proyector Navideño. Antes de que salga el repartidor hacia tu casa, quería confirmarte tu ubicación, ¿tenés un minutito ahora?'
  },
  {
    id: 'deepgram-celeste',
    name: 'Celeste (Femenina Energética · Deepgram Aura-2)',
    gender: 'Femenina',
    accent: 'Español Colombiano (es-CO)',
    role: 'Agente de Voz Conversacional',
    description: 'Voz femenina clara, energética y entusiasta con acento colombiano.',
    deepgramModel: 'aura-2-celeste-es',
    sampleText: 'Hola, ¿cómo estás? Te hablo del área de envíos por tu pedido del Proyector Navideño, ¿tienes un minutito para confirmar tu dirección de entrega?'
  },
  {
    id: 'deepgram-sirio',
    name: 'Sirio (Masculina Profesional · Deepgram Aura-2)',
    gender: 'Masculina',
    accent: 'Español Mexicano (es-MX)',
    role: 'Asesor Comercial & Logística Courier',
    description: 'Voz masculina calmada, profesional y empática con tono barítono.',
    deepgramModel: 'aura-2-sirio-es',
    sampleText: 'Hola, ¿qué tal? ¿Cómo estás? Te hablo del área de envíos para confirmar la dirección exacta de entrega de tu pedido, ¿tenés un minutito ahora?'
  },
  {
    id: 'deepgram-nestor',
    name: 'Néstor (Masculina Ejecutiva · Deepgram Aura-2)',
    gender: 'Masculina',
    accent: 'Español Peninsular (es-ES)',
    role: 'Ejecutivo de Confirmación Telefónica',
    description: 'Voz masculina ejecutiva, serena y profesional con claridad excepcional.',
    deepgramModel: 'aura-2-nestor-es',
    sampleText: 'Hola, ¿cómo estás? Te hablo un segundito del área de envíos para anotar la referencia de tu casa para el repartidor.'
  }
];

export const VIBEVOICE_CATALOG = DEEPGRAM_VOICE_CATALOG;
export const MING_VOICE_CATALOG = DEEPGRAM_VOICE_CATALOG;

export interface WaChatMessage {
  id: string;
  phone: string;
  sender: 'client' | 'admin' | 'ai' | 'agent';
  senderName?: string;
  text: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'pending_connection' | 'error';
  orderId?: string;
  sessionId?: string;
  isVoiceCall?: boolean;
  isAudioNote?: boolean;
  agentChannel?: AgentChannel;
  callLink?: string;
  convStep?: number;
  voiceEngine?: string;
  audioDataUrl?: string;
  imageUrl?: string;
  commercialStage?: WaCommercialStageId;
  commercialPackQty?: number;
  commercialFramedPriceGs?: number;
}

export interface WaSessionSummary {
  id: string;
  label: string;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'syncing' | 'connected';
  qrDataUrl: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  connectedLid?: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface WaEngineState {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'syncing' | 'connected';
  qrDataUrl: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  lastError: string | null;
  globalAiMode: 'automatico' | 'manual';
  autoChatOnOrder: boolean;
  autoCallOnOrder: boolean;
  preferredChannel: AgentChannel;
  selectedVoiceId: string;
  voices?: MingVoiceProfile[];
  sessions?: WaSessionSummary[];
}

interface WaSessionRuntime {
  id: string;
  label: string;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'syncing' | 'connected';
  qrDataUrl: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  connectedLid?: string | null;
  creds?: any;
  lastError: string | null;
  createdAt: string;
  authDir: string;
  sock: WASocket | null;
  socketSeq: number;
  isConnecting: boolean;
  lastSaveCredsPromise: Promise<any>;
  lastKeyWritePromise?: Promise<any>;
}

// Detección automática de Volumen Persistente en Railway (/data o RAILWAY_VOLUME_MOUNT_PATH):
// Si hay volumen montado, las llaves de WhatsApp sobreviven en disco físico a todos los deploys en 0ms, incluso si Supabase está caído.
function resolvePersistentDataDir(): { authRootParent: string; dataRoot: string; isPersistentVolume: boolean } {
  const candidates = [
    process.env.RAILWAY_VOLUME_MOUNT_PATH,
    process.env.NOELUX_PERSISTENT_DIR,
    process.platform !== 'win32' ? '/data' : ''
  ]
    .map(v => String(v || '').trim())
    .filter(Boolean);

  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        const probeFile = path.join(dir, '.noelux_write_probe');
        fs.writeFileSync(probeFile, 'ok', 'utf-8');
        fs.unlinkSync(probeFile);
        return { authRootParent: dir, dataRoot: dir, isPersistentVolume: true };
      }
    } catch {}
  }
  return { authRootParent: os.homedir(), dataRoot: process.cwd(), isPersistentVolume: false };
}

const PERSISTENT_PATHS = resolvePersistentDataDir();
const LEGACY_AUTH_DIR = path.resolve(os.homedir(), '.noelux_wa_auth_v2');
const MULTI_AUTH_ROOT = path.resolve(PERSISTENT_PATHS.authRootParent, '.noelux_wa_multi');
const CHATS_FILE = path.resolve(PERSISTENT_PATHS.dataRoot, 'wa_chats.json');
const PEDIDOS_FILE = path.resolve(PERSISTENT_PATHS.dataRoot, 'pedidos.json');
const CONFIG_FILE = path.resolve(PERSISTENT_PATHS.dataRoot, 'store_config.json');
const DELETED_ORDERS_FILE = path.resolve(PERSISTENT_PATHS.dataRoot, 'deleted_orders.json');
const SELLER_CHATS_FILE = path.resolve(PERSISTENT_PATHS.dataRoot, 'seller_agent_chats.json');
const ADMIN_SESSIONS_FILE = path.resolve(PERSISTENT_PATHS.dataRoot, 'admin_sessions.json');
const AUTOADS_WORKSPACES_FILE = path.resolve(PERSISTENT_PATHS.dataRoot, 'autoads_workspaces.json');

export function getPersistentDataPaths() {
  return {
    ...PERSISTENT_PATHS,
    chatsFile: CHATS_FILE,
    pedidosFile: PEDIDOS_FILE,
    configFile: CONFIG_FILE,
    deletedOrdersFile: DELETED_ORDERS_FILE,
    sellerChatsFile: SELLER_CHATS_FILE,
    adminSessionsFile: ADMIN_SESSIONS_FILE,
    autoAdsWorkspacesFile: AUTOADS_WORKSPACES_FILE
  };
}

function resolveServerAssetPath(fileName: string): string {
  const cwdAsset = path.resolve(process.cwd(), 'server', 'assets', fileName);
  if (fs.existsSync(cwdAsset)) return cwdAsset;
  try {
    if (typeof __dirname !== 'undefined' && __dirname) {
      return path.join(__dirname, 'assets', fileName);
    }
  } catch { }
  return cwdAsset;
}

const OFFICIAL_SUPABASE_URL = 'https://pgpmopannzzubunuhlmb.supabase.co';
const OFFICIAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncG1vcGFubnp6dWJ1bnVobG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNjg2MTAsImV4cCI6MjEwOTg0NDYxMH0.Mgy-Uo7_nJcFf_Wii9RBmAuI9meWZGcNdgp8X_bls88';

export function getSupabaseCredentials(): { url: string; key: string } | null {
  try {
    let rawUrl =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      readKeyFromEnvFile('SUPABASE_URL') ||
      readKeyFromEnvFile('VITE_SUPABASE_URL') ||
      '';
    let rawKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      readKeyFromEnvFile('SUPABASE_ANON_KEY') ||
      readKeyFromEnvFile('VITE_SUPABASE_ANON_KEY') ||
      '';

    if (!rawUrl || !rawKey) {
      const cfg = loadStoreConfig();
      if (!rawUrl && cfg?.supabase?.url) rawUrl = String(cfg.supabase.url);
      if (!rawKey && cfg?.supabase?.anonKey) rawKey = String(cfg.supabase.anonKey);
    }

    let cleanUrl = String(rawUrl || '')
      .trim()
      .replace(/^["']|["']$/g, '')
      .trim()
      .replace(/\/+$/, '');
    let cleanKey = String(rawKey || '')
      .trim()
      .replace(/^["']|["']$/g, '')
      .trim();

    if (
      !cleanUrl ||
      !cleanKey ||
      cleanKey === 'native-internal-key' ||
      cleanUrl.includes('cmxcohevrlmzsfqslmft.supabase.co') ||
      cleanUrl.includes('127.0.0.1') ||
      cleanUrl.includes('localhost')
    ) {
      cleanUrl = OFFICIAL_SUPABASE_URL;
      cleanKey = OFFICIAL_SUPABASE_ANON_KEY;
    }

    return { url: cleanUrl, key: cleanKey };
  } catch {
    return { url: OFFICIAL_SUPABASE_URL, key: OFFICIAL_SUPABASE_ANON_KEY };
  }
}

export async function querySupabaseCodigosWithStatus(options?: {
  select?: string;
  codeFilter?: string | string[];
  orderDesc?: boolean;
  limit?: number;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; rows: any[] }> {
  const creds = getSupabaseCredentials();
  if (!creds) return { ok: false, status: 0, rows: [] };
  try {
    const params = new URLSearchParams();
    params.set('select', options?.select || 'code,dispositivo,creado');
    if (options?.codeFilter) {
      const filters = Array.isArray(options.codeFilter) ? options.codeFilter : [options.codeFilter];
      for (const f of filters) {
        if (f) params.append('code', f);
      }
    }
    if (options?.orderDesc !== false) {
      params.set('order', 'id.desc');
    }
    if (options?.limit && options.limit > 0) {
      params.set('limit', String(options.limit));
    }

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), options?.timeoutMs || 10000);
    const res = await fetch(`${creds.url}/rest/v1/codigos?${params.toString()}`, {
      method: 'GET',
      headers: {
        apikey: creds.key,
        Authorization: `Bearer ${creds.key}`
      },
      signal: ctrl.signal
    });
    clearTimeout(tid);
    if (!res.ok) return { ok: false, status: res.status, rows: [] };
    const data = await res.json();
    return { ok: true, status: res.status, rows: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, status: 504, rows: [] };
  }
}

export async function querySupabaseCodigos(options?: {
  select?: string;
  codeFilter?: string | string[];
  orderDesc?: boolean;
  limit?: number;
  timeoutMs?: number;
}): Promise<any[]> {
  const res = await querySupabaseCodigosWithStatus(options);
  return res.rows;
}

export async function deleteSupabaseCodigos(codeFilter: string | string[]): Promise<void> {
  const creds = getSupabaseCredentials();
  if (!creds) return;
  const filters = Array.isArray(codeFilter) ? codeFilter : [codeFilter];
  for (const f of filters) {
    if (!f) continue;
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 8000);
      await fetch(`${creds.url}/rest/v1/codigos?code=${encodeURIComponent(f)}`, {
        method: 'DELETE',
        headers: {
          apikey: creds.key,
          Authorization: `Bearer ${creds.key}`
        },
        signal: ctrl.signal
      });
      clearTimeout(tid);
    } catch {}
  }
}

async function deletePreviousSupabaseCodigosExcept(codePrefixPattern: string, keepCode: string): Promise<void> {
  const creds = getSupabaseCredentials();
  if (!creds || !codePrefixPattern || !keepCode) return;
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8000);
    await fetch(
      `${creds.url}/rest/v1/codigos?code=like.${encodeURIComponent(codePrefixPattern)}&code=neq.${encodeURIComponent(keepCode)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: creds.key,
          Authorization: `Bearer ${creds.key}`
        },
        signal: ctrl.signal
      }
    );
    clearTimeout(tid);
  } catch {}
}

export async function insertOrUpdateSupabaseCodigo(code: string, dispositivo: string): Promise<boolean> {
  const creds = getSupabaseCredentials();
  if (!creds || !code) return false;
  try {
    // Para claves singleton (WACHAT-<tel>, WAHEART-beat, WALOCK-leader) limpiar la anterior antes de insertar la actualizada
    if (
      code.startsWith('WACHAT-') ||
      code === 'WAHEART-beat' ||
      code === 'WALOCK-leader'
    ) {
      await deleteSupabaseCodigos(`eq.${code}`);
    }

    const bodyJson = JSON.stringify({
      code,
      dispositivo: typeof dispositivo === 'string' ? dispositivo : JSON.stringify(dispositivo)
    });

    const isCriticalAuth = code.startsWith('WAAUTH-');
    const postTimeoutMs = isCriticalAuth ? 16000 : 8500;
    let ok = false;
    for (let attempt = 0; attempt < (isCriticalAuth ? 3 : 2); attempt++) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), postTimeoutMs);
        const res = await fetch(`${creds.url}/rest/v1/codigos`, {
          method: 'POST',
          headers: {
            apikey: creds.key,
            Authorization: `Bearer ${creds.key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: bodyJson,
          signal: ctrl.signal
        });
        clearTimeout(tid);
        if (res.ok) {
          ok = true;
          break;
        }
      } catch {}
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 350));
      }
    }

    // Solo limpiar snapshots anteriores DESPUÉS de confirmar que el nuevo registro quedó guardado en Supabase
    if (ok) {
      if (code.startsWith('WAENG-')) {
        await deletePreviousSupabaseCodigosExcept('WAENG-*', code);
      } else if (code.startsWith('WAVOICE-')) {
        await deletePreviousSupabaseCodigosExcept('WAVOICE-*', code);
      } else if (code.startsWith('CFG-') && !code.endsWith('-init')) {
        await deletePreviousSupabaseCodigosExcept('CFG-*', code);
      } else if (code.startsWith('ORD-')) {
        const ordMatch = code.match(/^(ORD-.+)-\d+$/);
        if (ordMatch?.[1]) {
          await deletePreviousSupabaseCodigosExcept(`${ordMatch[1]}-*`, code);
        }
      }
    }

    return ok;
  } catch {
    return false;
  }
}

function loadDeletedOrderIds(): Set<string> {
  try {
    if (fs.existsSync(DELETED_ORDERS_FILE)) {
      const arr = JSON.parse(fs.readFileSync(DELETED_ORDERS_FILE, 'utf-8') || '[]');
      if (Array.isArray(arr)) {
        return new Set(arr.map(String));
      }
    }
  } catch (e) { }
  return new Set();
}

function saveDeletedOrderIds(set: Set<string>) {
  try {
    const tmpFile = `${DELETED_ORDERS_FILE}.tmp.${process.pid}`;
    fs.writeFileSync(tmpFile, JSON.stringify(Array.from(set), null, 2), 'utf-8');
    fs.renameSync(tmpFile, DELETED_ORDERS_FILE);
  } catch (e) { }
}

const deletedOrderIds = loadDeletedOrderIds();
const pendingCloudDeletes = new Map<string, string>();
const inFlightCloudDeleteIds = new Set<string>();
const pendingCloudOrderSyncs = new Map<string, any>();

export function getDeletedOrderIdsArray(): string[] {
  return Array.from(deletedOrderIds);
}

export function isOrderDeleted(orderId: string): boolean {
  if (!orderId) return false;
  return deletedOrderIds.has(String(orderId).trim());
}

async function syncSingleDeletedOrderToCloud(
  cleanId: string,
  customerPhone: string,
  tsOffset = 0
): Promise<boolean> {
  let tombstoneOk = false;
  let tableDeleteOk = true;
  try {
    const tasks: Promise<any>[] = [
      insertOrUpdateSupabaseCodigo(
        `DEL-ORD-${cleanId}-${Date.now() + tsOffset}`,
        JSON.stringify({
          deletedOrderId: cleanId,
          customerPhone: customerPhone || null,
          deletedAt: new Date().toISOString()
        })
      ).then(ok => {
        tombstoneOk = ok;
      }),
      deleteSupabaseCodigos(`like.ORD-${cleanId}*`)
    ];

    const creds = getSupabaseCredentials();
    if (creds?.url && creds?.key) {
      tasks.push(
        (async () => {
          tableDeleteOk = false;
          try {
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 7000);
            const res = await fetch(`${creds.url}/rest/v1/pedidos?reservaid=eq.${encodeURIComponent(cleanId)}`, {
              method: 'DELETE',
              headers: {
                apikey: creds.key,
                Authorization: `Bearer ${creds.key}`
              },
              signal: ctrl.signal
            });
            clearTimeout(tid);
            tableDeleteOk = res.ok;
          } catch {
            tableDeleteOk = false;
          }
        })()
      );
    }

    if (customerPhone) {
      const remainingOrders = loadPedidos().some(
        p => normalizeWaPhone(p.celular) === customerPhone && p.reservaid !== cleanId && p.id !== cleanId
      );
      if (!remainingOrders) {
        tasks.push(deleteSupabaseCodigos(`eq.WACHAT-${customerPhone}`));
      }
    }

    await Promise.allSettled(tasks);
  } catch {}
  return tombstoneOk && tableDeleteOk;
}

async function flushPendingCloudDeletes(maxBatch = 10): Promise<void> {
  if (pendingCloudDeletes.size === 0) return;
  const entries = Array.from(pendingCloudDeletes.entries())
    .filter(([cleanId]) => !inFlightCloudDeleteIds.has(cleanId))
    .slice(0, maxBatch);
  if (entries.length === 0) return;
  await Promise.allSettled(
    entries.map(async ([cleanId, customerPhone], idx) => {
      inFlightCloudDeleteIds.add(cleanId);
      try {
        const ok = await syncSingleDeletedOrderToCloud(cleanId, customerPhone, idx);
        if (ok) {
          pendingCloudDeletes.delete(cleanId);
        }
      } finally {
        inFlightCloudDeleteIds.delete(cleanId);
      }
    })
  );
}

export function queueOrderCloudSync(order: any): void {
  const rid = String(order?.reservaid || order?.id || '').trim();
  if (!rid || isOrderDeleted(rid)) return;
  pendingCloudOrderSyncs.set(rid, order);
  void (async () => {
    const ok = await syncOrderUpdateToCloud(order).catch(() => false);
    if (ok && pendingCloudOrderSyncs.get(rid) === order) {
      pendingCloudOrderSyncs.delete(rid);
    }
  })();
}

async function flushPendingCloudOrderSyncs(maxBatch = 8): Promise<void> {
  if (pendingCloudOrderSyncs.size === 0) return;
  const entries = Array.from(pendingCloudOrderSyncs.entries()).slice(0, maxBatch);
  await Promise.allSettled(
    entries.map(async ([rid, order]) => {
      if (isOrderDeleted(rid)) {
        pendingCloudOrderSyncs.delete(rid);
        return;
      }
      const ok = await syncOrderUpdateToCloud(order).catch(() => false);
      if (ok && pendingCloudOrderSyncs.get(rid) === order) {
        pendingCloudOrderSyncs.delete(rid);
      }
    })
  );
}

export async function markOrderDeleted(orderId: string, knownCustomerPhone?: string): Promise<boolean> {
  if (!orderId) return false;
  const result = await markOrdersDeletedBatch(
    [orderId],
    knownCustomerPhone ? [{ reservaid: orderId, celular: knownCustomerPhone }] : undefined
  );
  return result.count > 0;
}

export async function markOrdersDeletedBatch(
  orderIds: string[],
  ordersSnapshot?: any[]
): Promise<{ deletedIds: string[]; count: number }> {
  const cleanIds = Array.from(
    new Set(
      (orderIds || [])
        .map(id => String(id || '').trim())
        .filter(Boolean)
    )
  );
  if (cleanIds.length === 0) {
    return { deletedIds: [], count: 0 };
  }
  const cleanSet = new Set(cleanIds);

  // 1. Registrar tombstones y capturar teléfonos antes de filtrar pedidos.json (0ms local)
  const currentPedidos = loadPedidos();
  const phoneByOrderId: Record<string, string> = {};
  for (const p of currentPedidos) {
    const rid = String(p?.reservaid || p?.id || '').trim();
    if (rid && (p?.celular || p?.telefono)) {
      phoneByOrderId[rid] = normalizeWaPhone(p.celular || p.telefono);
    }
  }
  if (Array.isArray(ordersSnapshot)) {
    for (const p of ordersSnapshot) {
      const rid = String(p?.reservaid || p?.id || '').trim();
      if (rid && !phoneByOrderId[rid] && (p?.celular || p?.telefono)) {
        phoneByOrderId[rid] = normalizeWaPhone(p.celular || p.telefono);
      }
    }
  }

  for (const cleanId of cleanIds) {
    deletedOrderIds.add(cleanId);
    pendingCloudOrderSyncs.delete(cleanId);
    pendingCloudDeletes.set(cleanId, phoneByOrderId[cleanId] || '');
  }
  saveDeletedOrderIds(deletedOrderIds);

  // 2. Filtrar pedidos.json local una sola vez para todo el lote
  const remainingPedidos = currentPedidos.filter(
    (p: any) => !cleanSet.has(String(p?.reservaid || '').trim()) && !cleanSet.has(String(p?.id || '').trim())
  );
  if (remainingPedidos.length !== currentPedidos.length) {
    savePedidos(remainingPedidos);
  }

  // 3. Limpiar residuos en wa_chats.json y estados de clientes sin otros pedidos activos (una sola escritura)
  try {
    const storage = loadChatsStorage();
    let changed = false;

    for (const [phone, msgs] of Object.entries(storage.chats)) {
      const beforeCount = msgs.length;
      storage.chats[phone] = msgs.filter(m => !m.orderId || !cleanSet.has(String(m.orderId).trim()));
      if (storage.chats[phone].length !== beforeCount) {
        changed = true;
      }
    }

    const touchedPhones = new Set(Object.values(phoneByOrderId).filter(Boolean));
    const activePhonesRemaining = new Set(
      remainingPedidos
        .map((p: any) => normalizeWaPhone(p?.celular || p?.telefono || ''))
        .filter(Boolean)
    );
    for (const customerPhone of touchedPhones) {
      if (!activePhonesRemaining.has(customerPhone)) {
        delete storage.chats[customerPhone];
        delete storage.chatModes[customerPhone];
        delete storage.callModes[customerPhone];
        delete storage.customerChannels[customerPhone];
        delete storage.convSteps[customerPhone];
        changed = true;
      }
    }

    if (changed) {
      saveChatsStorage(storage);
      scheduleCloudStateSync(true);
    }
  } catch (e) { }

  // 4. Limpiar también del registro del agente de vendedor (seller_agent_chats.json)
  try {
    const sellerStorage = loadSellerChatsStorage();
    let sellerChanged = false;
    for (const [prodId, msgs] of Object.entries(sellerStorage.messagesByProduct)) {
      const beforeCount = msgs.length;
      sellerStorage.messagesByProduct[prodId] = msgs.filter(
        m => !m.orderId || !cleanSet.has(String(m.orderId).trim())
      );
      if (sellerStorage.messagesByProduct[prodId].length !== beforeCount) {
        sellerChanged = true;
      }
    }
    if (sellerChanged) {
      saveSellerChatsStorage(sellerStorage);
    }
  } catch (e) { }

  // 5. Ejecutar limpieza en Supabase en segundo plano sin bloquear jamás la respuesta HTTP al usuario
  //    Si Supabase está con 504 en este instante, queda en pendingCloudDeletes y se reintenta en el próximo poll.
  void flushPendingCloudDeletes(cleanIds.length).catch(() => { });

  return { deletedIds: cleanIds, count: cleanIds.length };
}

export async function markOrdersArchivedBatch(
  orderIds: string[],
  archivado: boolean,
  ordersSnapshot?: any[]
): Promise<{ updatedOrders: any[]; count: number }> {
  const cleanIds = new Set(
    (orderIds || [])
      .map(id => String(id || '').trim())
      .filter(Boolean)
  );
  if (cleanIds.size === 0) {
    return { updatedOrders: [], count: 0 };
  }

  const nowIso = new Date().toISOString();
  const pedidos = loadPedidos();
  const existingIds = new Set<string>();
  const updatedOrders: any[] = [];

  for (const p of pedidos) {
    const rid = String(p?.reservaid || p?.id || '').trim();
    if (rid && cleanIds.has(rid)) {
      p.archivado = Boolean(archivado);
      p.fechaArchivado = archivado ? nowIso : null;
      p.actualizado_en = nowIso;
      existingIds.add(rid);
      updatedOrders.push(p);
    }
  }

  // Si algún pedido venía de Supabase y aún no estaba en pedidos.json local, incorporarlo actualizado
  if (Array.isArray(ordersSnapshot)) {
    for (const snap of ordersSnapshot) {
      const rid = String(snap?.reservaid || snap?.id || '').trim();
      if (rid && cleanIds.has(rid) && !existingIds.has(rid) && !isOrderDeleted(rid)) {
        const merged = {
          ...snap,
          reservaid: rid,
          archivado: Boolean(archivado),
          fechaArchivado: archivado ? nowIso : null,
          actualizado_en: nowIso
        };
        pedidos.unshift(merged);
        existingIds.add(rid);
        updatedOrders.push(merged);
      }
    }
  }

  savePedidos(pedidos);

  // Sincronización en Supabase en segundo plano con cola de reintento para nunca congelar el panel admin
  if (updatedOrders.length > 0) {
    for (const ord of updatedOrders) {
      queueOrderCloudSync(ord);
    }
  }

  return { updatedOrders, count: updatedOrders.length };
}

// Purga automática de chats y estados huérfanos que ya no correspondan a ningún pedido activo en pedidos.json
export function purgeOrphanedChatsAndResidues(): { purgedPhones: string[]; remainingChats: number } {
  const pedidos = loadPedidos();
  const activePhones = new Set<string>();
  for (const p of pedidos) {
    const clean = normalizeWaPhone(p?.celular || p?.telefono || '');
    if (clean) activePhones.add(clean);
  }

  const storage = loadChatsStorage();
  const purgedPhones: string[] = [];
  let changed = false;

  for (const phone of Object.keys(storage.chats)) {
    if (!activePhones.has(phone)) {
      delete storage.chats[phone];
      delete storage.chatModes[phone];
      delete storage.callModes[phone];
      delete storage.customerChannels[phone];
      delete storage.convSteps[phone];
      purgedPhones.push(phone);
      changed = true;
    }
  }

  // También limpiar en convSteps o chatModes si quedaron registros huérfanos
  for (const phone of Object.keys(storage.convSteps)) {
    if (!activePhones.has(phone)) {
      delete storage.convSteps[phone];
      delete storage.chatModes[phone];
      delete storage.callModes[phone];
      delete storage.customerChannels[phone];
      changed = true;
    }
  }

  if (changed) {
    saveChatsStorage(storage);
    scheduleCloudStateSync(true);
  }

  return {
    purgedPhones,
    remainingChats: Object.keys(storage.chats).length
  };
}

function readKeyFromEnvFile(keyName: string): string {
  try {
    if (process.env[keyName]) return process.env[keyName]!.replace(/^["']|["']$/g, '').trim();
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs
        .readFileSync(envPath, 'utf8')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.replace(/^\uFEFF/, '').trim();
        if (trimmed.startsWith(keyName + '=')) {
          return trimmed.substring(keyName.length + 1).replace(/^["']|["']$/g, '').trim();
        }
      }
    }
  } catch {}
  return '';
}

const DEFAULT_DEEPGRAM_API_KEY = 'fe2a93361cde252fff48ad5ac92dbf85cb5a2f51';

export function getDeepgramApiKey(): string {
  try {
    if (process.env.DEEPGRAM_API_KEY && process.env.DEEPGRAM_API_KEY.trim()) {
      return process.env.DEEPGRAM_API_KEY.replace(/^["']|["']$/g, '').trim();
    }
    const cfg = loadStoreConfig();
    if (cfg.deepgramApiKey && String(cfg.deepgramApiKey).trim()) {
      return String(cfg.deepgramApiKey).replace(/^["']|["']$/g, '').trim();
    }
  } catch {}
  const fromEnvFile = readKeyFromEnvFile('DEEPGRAM_API_KEY');
  if (fromEnvFile && fromEnvFile.trim()) return fromEnvFile.trim();
  return DEFAULT_DEEPGRAM_API_KEY;
}

const REVOKED_OPENROUTER_PREFIX = 'sk-or-v1-3beb27ab931009adbe6afe9e';

function isUsableOpenRouterKeyServer(rawKey: string): boolean {
  const clean = String(rawKey || '').trim();
  if (!clean.startsWith('sk-or-')) return false;
  if (clean.startsWith(REVOKED_OPENROUTER_PREFIX)) return false;
  if (
    clean.includes('tu-clave') ||
    clean.includes('placeholder') ||
    clean.includes('example') ||
    clean.includes('your-key')
  ) {
    return false;
  }
  return clean.length > 45;
}

// Cliente OpenRouter conectado para generación dinámica de Imagen #1 con GPT Image 2.6.
// Prioridad: Railway ENV / process.env -> .env -> store_config.json (sin fallback de imagen).
export function getOpenRouterApiKey(): string {
  const candidates = [
    process.env.OPENROUTER_API_KEY,
    process.env.OPENROUTER_KEY,
    readKeyFromEnvFile('OPENROUTER_API_KEY'),
    readKeyFromEnvFile('OPENROUTER_KEY')
  ];
  for (const c of candidates) {
    if (c && isUsableOpenRouterKeyServer(c)) {
      return c.trim();
    }
  }
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8') || '{}');
      const cfgCandidates = [
        cfg?.openRouterApiKey,
        cfg?.pipeboardConfig?.openRouterApiKey
      ];
      for (const c of cfgCandidates) {
        if (c && isUsableOpenRouterKeyServer(c)) {
          return String(c).trim();
        }
      }
    }
  } catch {}
  return '';
}

export function getOpenRouterImageModel(): string {
  const model =
    process.env.OPENROUTER_IMAGE_MODEL ||
    readKeyFromEnvFile('OPENROUTER_IMAGE_MODEL') ||
    '';
  const clean = String(model || '').trim();
  return clean || 'openai/gpt-image-2.6-sunburst';
}

// Deepgram All-in-One Voice Agent LLM (wss://agent.deepgram.com/v1/agent/converse)
// Utiliza la misma API Key de Deepgram (STT Nova-3 + LLM GPT-4o-mini gestionado por Deepgram + TTS Aura-2)
// con razonamiento semántico de discurso completo (0% palabras clave).
export async function callDeepgramAgentLLM(
  systemPrompt: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
  jsonMode = false,
  isPostConfirmMode = false,
  isPromoNegotiationMode = false
): Promise<string> {
  const apiKey = getDeepgramApiKey();
  if (!apiKey) {
    console.error('[Deepgram Agent LLM] No Deepgram API key configured');
    return '';
  }

  const voiceProfile = getSelectedVoiceProfile();
  const historyBlock =
    conversationHistory.length > 0
      ? '\n\nLÍNEA DE TIEMPO COMPLETA DE LA CONVERSACIÓN DESDE EL INICIO HASTA AHORA:\n' +
        conversationHistory
          .map(
            (m, idx) =>
              `[Turno #${idx + 1} · ${m.role === 'user' ? 'CLIENTE' : 'AGENTE'}]: ${m.content}`
          )
          .join('\n')
      : '';

  const toolInstruction = isPromoNegotiationMode
    ? '\n\nINSTRUCCIÓN TÉCNICA OBLIGATORIA: Actuá con inteligencia humana real. Entendé con naturalidad respuestas de 1, 2, 3 o más palabras cuando tengan sentido y congruencia directa con la pregunta de la promoción. Solo pedí aclaración si lo que dijo el cliente no tiene sentido o es contradictorio/incongruente con lo preguntado. Llamá SIEMPRE e INMEDIATAMENTE a la función "emit_reply" completando "intent", "isGrammaticallyAndLogicallyCoherent", "hasDoubtOrCondition" y "reply".'
    : isPostConfirmMode
      ? '\n\nINSTRUCCIÓN TÉCNICA OBLIGATORIA: Actuá con inteligencia humana real. Entendé con naturalidad tanto frases largas como mensajes cortos de 1, 2 o 3 palabras (ej. "gracias", "excelente", "cuándo llega") cuando tengan sentido en el chat; solo marcá UNCLEAR_OR_TRUNCATED_MESSAGE si el texto no tiene sentido ni congruencia alguna. Llamá SIEMPRE e INMEDIATAMENTE a la función "emit_reply" completando "speechAct", "isGrammaticallyAndLogicallyCoherent", "needsSupportPhoneCard", "isNaturalFarewell" y "reply".'
      : jsonMode
        ? '\n\nINSTRUCCIÓN TÉCNICA OBLIGATORIA: Actuá con inteligencia humana real y sentido común. Si el cliente responde en 1, 2 o 3 palabras (o en una oración más larga) y su respuesta es clara y CONGRUENTE con la pregunta exacta del paso actual, entendelo perfectamente y avanzá sin trabarlo. ÚNICAMENTE repreguntá cuando lo que dijo el cliente NO tenga sentido o NO tenga congruencia con lo que le preguntaste. Llamá SIEMPRE e INMEDIATAMENTE a la función "emit_reply" pasando todos los campos requeridos.'
        : '\n\nINSTRUCCIÓN TÉCNICA OBLIGATORIA: Llamá SIEMPRE a la función "emit_reply" poniendo tu respuesta humana, natural y completa en el campo "reply".';

  const fullPrompt = `${systemPrompt}${historyBlock}${toolInstruction}`;

  const functionsSpec = isPromoNegotiationMode
    ? [
        {
          name: 'emit_reply',
          description:
            'Obligatorio: Evaluar con inteligencia humana la congruencia de la respuesta del cliente sobre la promoción de pago adelantado (aceptando respuestas cortas de 1 a 3 palabras si son claras y congruentes).',
          parameters: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                enum: [
                  'ASKING_EXPLANATION_OR_DOUBTING',
                  'UNCLEAR_OR_SINGLE_WORD_NEEDS_CLARIFICATION',
                  'CONFIRMING_PARTICIPATION',
                  'READY_FOR_ALIAS',
                  'DECLINING_PROMO_COD',
                  'RECEIPT_OR_PAYMENT_SENT',
                  'PRODUCT_OR_OTHER_QUESTION'
                ],
                description:
                  'Intención real y congruente con la pregunta actual: CONFIRMING_PARTICIPATION si el cliente acepta participar del descuento (incluso con respuestas cortas claras como "sí", "claro", "dale", "sí quiero", "me interesa"); READY_FOR_ALIAS si indica que está listo o pide los datos/alias para transferir (incluso corto como "listo", "pasame", "pasame el alias", "alias", "dale pasame"); DECLINING_PROMO_COD si prefiere pagar contra entrega o rechaza la promo (ej. "no", "no gracias", "al recibir", "contra entrega", "efectivo"); RECEIPT_OR_PAYMENT_SENT si avisa que ya transfirió o pagó; ASKING_EXPLANATION_OR_DOUBTING si pide explicación, pregunta cómo funciona o pone condiciones ("pero..."); PRODUCT_OR_OTHER_QUESTION si consulta sobre el producto o envío; UNCLEAR_OR_SINGLE_WORD_NEEDS_CLARIFICATION ÚNICAMENTE si lo que escribió NO tiene sentido ni congruencia con la conversación.'
              },
              isGrammaticallyAndLogicallyCoherent: {
                type: 'boolean',
                description:
                  'true siempre que el mensaje (aunque tenga 1, 2 o 3 palabras) tenga sentido claro y congruencia con lo preguntado; false únicamente si no tiene sentido o es incongruente.'
              },
              hasDoubtOrCondition: {
                type: 'boolean',
                description:
                  'true solo si el cliente expresa duda real, condición ("pero...") o pide que le expliques antes de decidir.'
              },
              reply: {
                type: 'string',
                description:
                  'Tu respuesta hablada humana, cálida, profesional y variada en español paraguayo (sin emojis ni asteriscos, sin repetir frases anteriores).'
              }
            },
            required: ['intent', 'isGrammaticallyAndLogicallyCoherent', 'hasDoubtOrCondition', 'reply']
          }
        }
      ]
    : isPostConfirmMode
      ? [
          {
            name: 'emit_reply',
            description:
              'Obligatorio: Emitir el análisis de congruencia del mensaje post-confirmación y la respuesta conversacional humana.',
            parameters: {
              type: 'object',
              properties: {
                speechAct: {
                  type: 'string',
                  enum: [
                    'PRODUCT_OR_SHIPPING_QUESTION',
                    'ORDER_MODIFICATION_OR_SUPPORT_REQUEST',
                    'UNCLEAR_OR_TRUNCATED_MESSAGE',
                    'WARM_FAREWELL_CLOSING',
                    'CASUAL_CONVERSATION'
                  ],
                  description:
                    'Acto comunicativo en contexto: WARM_FAREWELL_CLOSING si agradece o se despide (incluso en 1-3 palabras como "gracias", "dale gracias", "excelente", "genial"); PRODUCT_OR_SHIPPING_QUESTION si consulta sobre el producto, garantía o entrega; ORDER_MODIFICATION_OR_SUPPORT_REQUEST si pide modificar/anular el pedido o un teléfono de soporte; CASUAL_CONVERSATION para comentarios claros; UNCLEAR_OR_TRUNCATED_MESSAGE ÚNICAMENTE si escribió algo sin sentido ni congruencia.'
                },
                isGrammaticallyAndLogicallyCoherent: {
                  type: 'boolean',
                  description: 'true siempre que el mensaje se entienda en contexto (incluso si tiene 1-3 palabras); false solo si carece de sentido.'
                },
                needsSupportPhoneCard: {
                  type: 'boolean',
                  description:
                    'true únicamente si el cliente solicitó modificar/anular su orden ya confirmada o pidió un número telefónico de atención.'
                },
                isNaturalFarewell: {
                  type: 'boolean',
                  description:
                    'true si el cliente está agradeciendo o cerrando amablemente la charla (ej. "gracias", "muchas gracias", "perfecto gracias").'
                },
                reply: {
                  type: 'string',
                  description:
                    'Respuesta hablada sumamente humana, empática, profesional y variada (de 3 a 5 oraciones completas, sin emojis ni asteriscos, sin repetir explicaciones anteriores).'
                }
              },
              required: [
                'speechAct',
                'isGrammaticallyAndLogicallyCoherent',
                'needsSupportPhoneCard',
                'isNaturalFarewell',
                'reply'
              ]
            }
          }
        ]
      : jsonMode
        ? [
            {
              name: 'emit_reply',
              description:
                'Obligatorio: Comprender con inteligencia humana la respuesta del cliente en relación con la pregunta del paso actual (aceptando respuestas cortas de 1, 2 o 3 palabras si son congruentes, y repreguntando solo si lo que dice no tiene sentido o no es congruente).',
              parameters: {
                type: 'object',
                properties: {
                  speechAct: {
                    type: 'string',
                    enum: [
                      'STEP_CONFIRMATION_COMPLETE',
                      'DATA_CORRECTION_OR_UPDATE',
                      'MAP_PIN_REPORTED_WRONG',
                      'CUSTOMER_QUESTION_OR_DOUBT',
                      'CUSTOMER_BUSY_WAIT',
                      'INCOHERENT_TRUNCATED_OR_SINGLE_WORD'
                    ],
                    description:
                      'Clasificación inteligente por congruencia: STEP_CONFIRMATION_COMPLETE cuando el cliente responde con congruencia y sentido claro a la pregunta del paso actual (incluyendo respuestas cortas de 1, 2 o 3 palabras como "sí", "claro", "correcto", "dale", "está bien", "todo bien" en Pasos 1-3, o descripciones cortas claras como "portón negro frente a despensa" / "recibe portería" en Paso 4); DATA_CORRECTION_OR_UPDATE si corrige su nombre, ciudad o dirección; MAP_PIN_REPORTED_WRONG si indica que el mapa está mal ubicado ("está mal", "no es ahí"); CUSTOMER_QUESTION_OR_DOUBT si hace una consulta sobre el producto, precio o envío; CUSTOMER_BUSY_WAIT si avisa que ahora no puede o está ocupado ("ahora no", "estoy trabajando", "más tarde"); INCOHERENT_TRUNCATED_OR_SINGLE_WORD ÚNICAMENTE cuando lo que dijo el cliente NO tiene sentido o NO tiene congruencia con la pregunta actual (ej. responder solo "sí" o "ok" cuando en Paso 4 se le preguntó cómo es la fachada de su casa, o palabras inconexas sin sentido).'
                  },
                  isGrammaticallyAndLogicallyCoherent: {
                    type: 'boolean',
                    description:
                      'true siempre que lo dicho por el cliente (sea de 1, 2, 3 o más palabras) se entienda claramente y sea congruente con la pregunta actual o con el producto; false ÚNICAMENTE cuando carece de sentido o es incongruente con lo conversado.'
                  },
                  answeredCurrentStepQuestionCompletely: {
                    type: 'boolean',
                    description:
                      'true si la respuesta del cliente (corta o larga) responde de forma congruente y suficiente lo preguntado en el paso actual.'
                  },
                  reasoningSummary: {
                    type: 'string',
                    description:
                      'Breve razonamiento de 1 oración explicando por qué la respuesta del cliente es congruente con la pregunta actual o por qué carece de congruencia.'
                  },
                  reply: {
                    type: 'string',
                    description:
                      'Tu respuesta hablada humana, cálida y muy profesional (2 a 4 oraciones naturales), SIN pronunciar nombres de calles, barrios, ciudades ni links, sin emojis ni asteriscos, sin repetir robóticamente la pregunta anterior.'
                  },
                  locationTextConfirmation: {
                    type: 'string',
                    description: 'Dejar siempre vacío ""; el sistema adjunta la tarjeta de texto del Paso 3 cuando corresponde.'
                  },
                  nextStep: {
                    type: 'number',
                    description:
                      'Si speechAct es STEP_CONFIRMATION_COMPLETE o DATA_CORRECTION_OR_UPDATE (y answeredCurrentStepQuestionCompletely es true), el siguiente paso (currentStep + 1, máximo 5). Si es incongruente, duda del cliente u ocupado, DEBE ser igual a currentStep.'
                  },
                  orderConfirmed: {
                    type: 'boolean',
                    description:
                      'true ÚNICAMENTE cuando se completó con congruencia el Paso 4 (referencia clara de fachada/portón o recepción de edificio) pasando a nextStep = 5.'
                  },
                  extractedHouseReference: {
                    type: 'string',
                    description:
                      'Descripción limpia de la fachada/portón de la casa o recepción/referencia del edificio indicada por el cliente en el Paso 4 (ej. "Casa blanca con portón negro", "Recibe en portería del edificio").'
                  },
                  correctedName: { type: 'string' },
                  correctedCity: { type: 'string' },
                  correctedAddress: { type: 'string' }
                },
                required: [
                  'speechAct',
                  'isGrammaticallyAndLogicallyCoherent',
                  'answeredCurrentStepQuestionCompletely',
                  'reasoningSummary',
                  'reply',
                  'locationTextConfirmation',
                  'nextStep',
                  'orderConfirmed'
                ]
              }
            }
          ]
        : [
            {
              name: 'emit_reply',
              description: 'Obligatorio: Llamar SIEMPRE a esta función para emitir el texto de respuesta.',
              parameters: {
                type: 'object',
                properties: {
                  reply: {
                    type: 'string',
                    description: 'Texto completo de tu respuesta sin emojis ni asteriscos si es para voz.'
                  }
                },
                required: ['reply']
              }
            }
          ];

  const runSingleAttempt = (): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      let settled = false;
      let assistantText = '';
      let textSettleTimer: NodeJS.Timeout | null = null;

      const ws = new WebSocket('wss://agent.deepgram.com/v1/agent/converse', {
        headers: {
          Authorization: `Token ${apiKey}`
        }
      });

      const finish = (result: string, err?: Error) => {
        if (settled) return;
        settled = true;
        if (textSettleTimer) clearTimeout(textSettleTimer);
        clearTimeout(overallTimeout);
        try {
          ws.close();
        } catch {}
        if (err && !result) {
          reject(err);
        } else {
          resolve(result);
        }
      };

      const buildSafeUnstructuredJson = (plainReply: string): string =>
        JSON.stringify({
          speechAct: 'INCOHERENT_TRUNCATED_OR_SINGLE_WORD',
          isGrammaticallyAndLogicallyCoherent: false,
          answeredCurrentStepQuestionCompletely: false,
          reasoningSummary: 'Respuesta conversacional directa sin confirmación estructurada',
          reply: plainReply,
          locationTextConfirmation: '',
          nextStep: 0,
          orderConfirmed: false
        });

      const overallTimeout = setTimeout(() => {
        if (assistantText.trim()) {
          const trimmed = assistantText.trim();
          finish(jsonMode && !trimmed.startsWith('{') ? buildSafeUnstructuredJson(trimmed) : trimmed);
        } else {
          finish('', new Error('Deepgram Voice Agent LLM timeout (9s)'));
        }
      }, 9000);

      ws.on('open', () => {
        try {
          ws.send(
            JSON.stringify({
              type: 'Settings',
              audio: {
                input: { encoding: 'linear16', sample_rate: 16000 },
                output: { encoding: 'linear16', sample_rate: 16000, container: 'none' }
              },
              agent: {
                language: 'es',
                listen: {
                  provider: { type: 'deepgram', model: 'nova-3' }
                },
                think: {
                  provider: { type: 'open_ai', model: 'gpt-4o-mini', temperature: 0.35 },
                  prompt: fullPrompt,
                  functions: functionsSpec
                },
                speak: {
                  provider: { type: 'deepgram', model: voiceProfile.deepgramModel || 'aura-2-celeste-es' }
                }
              }
            })
          );
        } catch (err: any) {
          finish('', err instanceof Error ? err : new Error(String(err)));
        }
      });

      ws.on('message', (data: any, isBinary: any) => {
        if (isBinary || settled) return;
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'SettingsApplied') {
            ws.send(
              JSON.stringify({
                type: 'InjectUserMessage',
                content: userMessage
              })
            );
          } else if (msg.type === 'FunctionCallRequest' && Array.isArray(msg.functions) && msg.functions.length > 0) {
            const fn = msg.functions[0];
            const rawArgs = typeof fn?.arguments === 'string' ? fn.arguments.trim() : JSON.stringify(fn?.arguments || {});
            if (jsonMode) {
              console.log('[Deepgram Semantic Brain JSON]:', rawArgs.substring(0, 200));
              finish(rawArgs);
            } else {
              try {
                const parsed = JSON.parse(rawArgs);
                const extracted = String(parsed.reply || rawArgs).trim();
                console.log('[Deepgram Semantic Brain Text]:', extracted.substring(0, 160));
                finish(extracted);
              } catch {
                finish(rawArgs);
              }
            }
          } else if (msg.type === 'ConversationText' && msg.role === 'assistant' && msg.content) {
            assistantText += (assistantText ? ' ' : '') + String(msg.content).trim();
            if (textSettleTimer) clearTimeout(textSettleTimer);
            const trimmed = assistantText.trim();
            if (jsonMode && trimmed.startsWith('{') && trimmed.endsWith('}')) {
              finish(trimmed);
            } else {
              const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
              const minWordsToSettleEarly = isPostConfirmMode ? 24 : 12;
              const settleDelayMs = wordCount >= minWordsToSettleEarly ? 1200 : 2800;
              textSettleTimer = setTimeout(() => {
                if (assistantText.trim()) {
                  const currentWords = assistantText.trim().split(/\s+/).filter(Boolean).length;
                  if (isPostConfirmMode && currentWords < 20) {
                    return;
                  }
                  if (jsonMode && !assistantText.trim().startsWith('{')) {
                    finish(buildSafeUnstructuredJson(assistantText.trim()));
                  } else {
                    finish(assistantText.trim());
                  }
                }
              }, settleDelayMs);
            }
          } else if (msg.type === 'AgentAudioDone' && assistantText.trim()) {
            const currentWords = assistantText.trim().split(/\s+/).filter(Boolean).length;
            if (isPostConfirmMode && currentWords < 20) {
              return;
            }
            if (jsonMode && !assistantText.trim().startsWith('{')) {
              finish(buildSafeUnstructuredJson(assistantText.trim()));
            } else {
              finish(assistantText.trim());
            }
          } else if (msg.type === 'Error') {
            console.error('[Deepgram Agent LLM WS Error]:', msg);
            finish('', new Error(msg.description || 'Deepgram Agent Error'));
          }
        } catch {}
      });

      ws.on('error', (err: any) => {
        console.error('[Deepgram Agent LLM Socket Error]:', err?.message || err);
        finish(assistantText.trim(), err instanceof Error ? err : new Error(String(err)));
      });

      ws.on('close', () => {
        if (!settled) {
          if (assistantText.trim()) {
            const trimmed = assistantText.trim();
            finish(jsonMode && !trimmed.startsWith('{') ? buildSafeUnstructuredJson(trimmed) : trimmed);
          } else {
            finish('', new Error('Deepgram Agent WebSocket closed before response'));
          }
        }
      });
    });

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const out = await runSingleAttempt();
      if (out && out.trim()) return out;
    } catch (err: any) {
      if (attempt === 2) throw err;
      await new Promise(r => setTimeout(r, 350));
    }
  }
  return '';
}

const silentLogger = pino({ level: 'silent' }) as any;

// Clean up any previous sockets/timers across Vite hot reloads in the same Node process
const g = globalThis as any;
g.__noeluxEngineGen = (g.__noeluxEngineGen || 0) + 1;
const myEngineGen: number = g.__noeluxEngineGen;

if (g.__noeluxWaPoller) {
  clearInterval(g.__noeluxWaPoller);
  g.__noeluxWaPoller = null;
}
if (g.__noeluxNasaHeartbeat) {
  clearInterval(g.__noeluxNasaHeartbeat);
  g.__noeluxNasaHeartbeat = null;
}
if (g.__noeluxNasaPeriodicBackup) {
  clearInterval(g.__noeluxNasaPeriodicBackup);
  g.__noeluxNasaPeriodicBackup = null;
}
if (g.__noeluxNasaLeaderWatcher) {
  clearInterval(g.__noeluxNasaLeaderWatcher);
  g.__noeluxNasaLeaderWatcher = null;
}
if (g.__noeluxWaSessionsMap && g.__noeluxWaSessionsMap instanceof Map) {
  for (const s of g.__noeluxWaSessionsMap.values()) {
    try {
      // Invalidate any pending timers/reconnects from the previous module evaluation
      s.socketSeq = (s.socketSeq || 0) + 10000;
      s.isConnecting = true;
      s.sock?.ev?.removeAllListeners('connection.update');
      s.sock?.ev?.removeAllListeners('creds.update');
      s.sock?.ev?.removeAllListeners('messages.upsert');
      s.sock?.end?.(undefined);
      s.sock = null;
    } catch (e) { }
  }
}
if (g.__noeluxWaSock) {
  try {
    g.__noeluxWaSock.ev?.removeAllListeners('connection.update');
    g.__noeluxWaSock.end?.(undefined);
  } catch (e) { }
  g.__noeluxWaSock = null;
}

if (g.__noeluxInactivityTimers && g.__noeluxInactivityTimers instanceof Map) {
  for (const t of g.__noeluxInactivityTimers.values()) {
    try {
      clearTimeout(t);
    } catch {}
  }
  g.__noeluxInactivityTimers.clear();
}

const sessionsMap = new Map<string, WaSessionRuntime>();
g.__noeluxWaSessionsMap = sessionsMap;

const customerInactivityTimers = new Map<string, NodeJS.Timeout>();
g.__noeluxInactivityTimers = customerInactivityTimers;
const inactivityFollowUpCount = new Map<string, number>();
const unclearReplyCounter = new Map<string, number>();

let cloudPollerStarted = false;
const recentlySentMsgIds = new Set<string>();
const recentSentProtoMessages = new Map<string, any>();
const recentIncomingDiagnostics: Array<{
  ts: string;
  remoteJid: string;
  senderPn?: string;
  resolvedPhone?: string | null;
  hasMessage: boolean;
  stubType?: number;
  stubParams?: string[];
  status: string;
}> = [];

function recordSentProtoMessage(msgId?: string, protoMsg?: any) {
  if (!msgId || !protoMsg) return;
  recentSentProtoMessages.set(msgId, protoMsg);
  setTimeout(() => recentSentProtoMessages.delete(msgId), 10 * 60 * 1000);
}

const MAX_INCOMING_DIAGNOSTICS = 80;

const TELEMETRY_ONLY_STATUS_PREFIXES = [
  'wire_cb_',
  'baileys_warn:',
  'baileys_error:',
  'signal_decrypt_',
  'upsert_ignored_',
  'upsert_skipped_recently_sent:',
  'ev_buffer_'
];

export function extractWireMessageTelemetry(node: any): {
  id: string;
  from: string;
  recipient: string;
  participant: string;
  type: string;
  category: string;
  offline: string;
  addressingMode: string;
  senderLid: string;
  senderPn: string;
  encTypes: string[];
} | null {
  if (!node || typeof node !== 'object') return null;
  const attrs = node.attrs && typeof node.attrs === 'object' ? node.attrs : {};
  const from = String(attrs.from || '').trim();
  const recipient = String(attrs.recipient || '').trim();
  if (from.endsWith('@g.us') || from === 'status@broadcast') return null;
  if (!from && !recipient) return null;
  const children = Array.isArray(node.content) ? node.content : [];
  const encTypes = children
    .filter((c: any) => c && c.tag === 'enc')
    .map((c: any) => String(c.attrs?.type || 'enc'));
  return {
    id: String(attrs.id || ''),
    from,
    recipient,
    participant: String(attrs.participant || ''),
    type: String(attrs.type || ''),
    category: String(attrs.category || ''),
    offline: String(attrs.offline || ''),
    addressingMode: String(attrs.addressing_mode || ''),
    senderLid: String(attrs.sender_lid || ''),
    senderPn: String(attrs.sender_pn || ''),
    encTypes
  };
}

export function dedupePatchMessageBeforeSending(msg: any, recipientJids?: string[]): any {
  if (!Array.isArray(recipientJids) || recipientJids.length === 0) {
    return msg;
  }
  const cleanJids = recipientJids.filter(Boolean);
  if (cleanJids.length === 0) return msg;
  const uniqueJids = Array.from(new Set(cleanJids));
  if (uniqueJids.length === cleanJids.length) {
    // No duplicates present: return msg directly so reporting_token / native structure is preserved.
    return msg;
  }
  return uniqueJids.map(jid => ({ recipientJid: jid, message: msg }));
}

function summarizePinoLogArgs(args: any[]): { msg: string; metaText: string } {
  const parts: string[] = [];
  const metas: string[] = [];
  for (const a of args) {
    if (typeof a === 'string') {
      parts.push(a);
    } else if (a instanceof Error) {
      parts.push(a.message);
    } else if (a && typeof a === 'object') {
      const errObj = a.err || a.error;
      if (errObj) {
        metas.push(String(errObj?.message || errObj).slice(0, 120));
      }
      if (a.jid) metas.push(`jid=${String(a.jid)}`);
      if (a.fromJid) metas.push(`from=${String(a.fromJid)}`);
      if (a.msgId) metas.push(`id=${String(a.msgId)}`);
      if (a.node?.attrs?.from) metas.push(`nodeFrom=${String(a.node.attrs.from)}`);
      if (a.node?.attrs?.id) metas.push(`nodeId=${String(a.node.attrs.id)}`);
    }
  }
  return {
    msg: parts.join(' ').trim() || 'baileys_log',
    metaText: metas.slice(0, 5).join(' ')
  };
}

export function createBaileysDiagnosticLogger(
  onDiagnostic: (level: 'info' | 'warn' | 'error', msg: string, metaText: string, bindings: Record<string, any>) => void,
  bindings: Record<string, any> = {}
) {
  const isTransientSocketNoise = (msg: string): boolean => {
    return (
      msg.includes('connection errored') ||
      msg.includes('WebSocket') ||
      msg.includes('Connection Closed') ||
      msg.includes('Stream Errored')
    );
  };

  const logger: any = {
    level: 'info',
    trace: () => {},
    debug: () => {},
    info: (...args: any[]) => {
      const { msg, metaText } = summarizePinoLogArgs(args);
      if (isTransientSocketNoise(msg)) {
        return;
      }
      if (
        msg.includes('opened connection') ||
        msg.includes('Own LID session') ||
        msg.includes('uploading pre-keys') ||
        msg.includes('got my own devices') ||
        msg.includes('resyncing') ||
        msg.includes('blocked on missing key')
      ) {
        onDiagnostic('info', msg, metaText, bindings);
      }
    },
    warn: (...args: any[]) => {
      const { msg, metaText } = summarizePinoLogArgs(args);
      if (isTransientSocketNoise(msg)) {
        return;
      }
      onDiagnostic('warn', msg, metaText, bindings);
    },
    error: (...args: any[]) => {
      const { msg, metaText } = summarizePinoLogArgs(args);
      if (isTransientSocketNoise(msg)) {
        return;
      }
      onDiagnostic('error', msg, metaText, bindings);
    },
    fatal: (...args: any[]) => {
      const { msg, metaText } = summarizePinoLogArgs(args);
      if (isTransientSocketNoise(msg)) {
        return;
      }
      onDiagnostic('error', msg, metaText, bindings);
    },
    child: (childBindings: Record<string, any> = {}) =>
      createBaileysDiagnosticLogger(onDiagnostic, { ...bindings, ...childBindings })
  };
  return logger;
}

function recordIncomingDiagnostic(entry: {
  remoteJid: string;
  senderPn?: string;
  resolvedPhone?: string | null;
  hasMessage: boolean;
  stubType?: number;
  stubParams?: string[];
  status: string;
}) {
  recentIncomingDiagnostics.unshift({
    ts: new Date().toISOString(),
    ...entry
  });
  if (recentIncomingDiagnostics.length > MAX_INCOMING_DIAGNOSTICS) {
    recentIncomingDiagnostics.length = MAX_INCOMING_DIAGNOSTICS;
  }
  const isTelemetryOnly =
    entry.status === 'outbound_audio_sent' ||
    entry.status === 'outbound_admin_echo' ||
    TELEMETRY_ONLY_STATUS_PREFIXES.some(p => entry.status.startsWith(p));
  if (!isTelemetryOnly) {
    try {
      scheduleCloudStateSync(false);
    } catch { }
  }
}

export function getRecentIncomingDiagnostics(limit = 40) {
  return recentIncomingDiagnostics.slice(0, Math.max(1, limit));
}

const processedCloudCmds = new Set<string>();
const processedCloudOrders = new Set<string>();
const automatedOrderIds = new Set<string>();

// Normalize any Paraguayan or international phone number to standard digits (e.g. 595981123456)
export function normalizeWaPhone(raw: string): string {
  const rawStr = String(raw || '').trim();
  if (/^lid-/i.test(rawStr) || rawStr.endsWith('@lid')) {
    return '';
  }
  let digits = rawStr.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('09') && digits.length === 10) {
    digits = '595' + digits.slice(1);
  } else if (digits.startsWith('9') && digits.length === 9) {
    digits = '595' + digits;
  } else if (digits.startsWith('0') && digits.length > 8) {
    digits = '595' + digits.slice(1);
  }
  return digits;
}

// =========================================================================
// MURO DE HIERRO: VALIDACIÓN ESTRICTA DE CLIENTE OFICIAL DE REGISTRO DE PRODUCTOS
// Queda terminantemente prohibido que el Agente hable, responda, haga seguimiento
// o cree órdenes automáticas para cualquier persona que NO provenga del registro oficial de productos.
// =========================================================================
export function isPersistableOrderRecord(order: any): boolean {
  if (!order || typeof order !== 'object') return false;
  const rid = String(order.reservaid || order.id || '').trim();
  if (!rid || rid.startsWith('NX-WA-') || rid.startsWith('TEST-UNIT-') || rid.startsWith('NX-TEST-')) {
    return false;
  }
  const disp = typeof order.dispositivo === 'string' ? order.dispositivo.trim() : '';
  if (disp.startsWith('wa-lead-')) return false;
  return Boolean(order.celular || order.telefono || order.phone || order.nombre);
}

export function isOfficialRegisteredProductOrder(order: any): boolean {
  if (!order || typeof order !== 'object') return false;
  const rid = String(order.reservaid || '').trim();
  if (!rid || rid.startsWith('NX-WA-') || rid.startsWith('TEST-UNIT-') || rid.startsWith('NX-TEST-')) {
    return false;
  }
  const disp = typeof order.dispositivo === 'string' ? order.dispositivo.trim() : '';
  if (disp.startsWith('wa-lead-')) return false;
  const addr = String(order.direccion || '').trim();
  if (!addr || addr === 'Por confirmar por IA') return false;
  const ph = normalizeWaPhone(order.celular || order.telefono || order.phone || '');
  if (!ph || ph.length < 8 || ph.length > 13) return false;
  return Boolean(order.productoId || order.producto);
}

export function resolveOutboundWhatsAppJid(targetKey: string): string {
  const clean = normalizeWaPhone(targetKey);
  return clean ? `${clean}@s.whatsapp.net` : '';
}

export function createSelfChatSafeUserDevicesCache(
  getOwnUsers: () => string[],
  ttlMs = 5 * 60 * 1000
) {
  const store = new Map<string, { value: any; expiresAt: number }>();

  const dedupeDevices = (value: any) => {
    if (!Array.isArray(value)) return value;
    const seen = new Set<string>();
    const out: any[] = [];
    for (const d of value) {
      const k = d?.jid
        ? String(d.jid)
        : `${String(d?.user || '')}:${String(d?.device ?? 0)}@${String(d?.server || '')}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(d);
      }
    }
    return out;
  };

  const isOwnKey = (key: string) => {
    const cleanKey = String(key || '').split('@')[0].split(':')[0].trim();
    if (!cleanKey) return false;
    return getOwnUsers().some(u => u && u === cleanKey);
  };

  return {
    get<T>(key: string): T | undefined {
      if (isOwnKey(key)) return undefined;
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return entry.value as T;
    },
    set<T>(key: string, value: T): void {
      if (isOwnKey(key)) return;
      store.set(key, { value: dedupeDevices(value), expiresAt: Date.now() + ttlMs });
    },
    del(key: string): void {
      store.delete(key);
    },
    flushAll(): void {
      store.clear();
    },
    async mget<T>(keys: string[]): Promise<Record<string, T | undefined>> {
      const res: Record<string, T | undefined> = {};
      for (const k of keys) {
        if (!k || isOwnKey(k)) continue;
        const entry = store.get(k);
        if (entry && Date.now() <= entry.expiresAt) {
          res[k] = entry.value as T;
        } else if (entry) {
          store.delete(k);
        }
      }
      return res;
    },
    mset<T>(entries: { key: string; value: T }[]): void {
      for (const e of entries) {
        if (!e?.key || isOwnKey(e.key)) continue;
        store.set(e.key, { value: dedupeDevices(e.value), expiresAt: Date.now() + ttlMs });
      }
    },
    mdel(keys: string[]): void {
      for (const k of keys) store.delete(k);
    }
  };
}

const lidToPhoneCache = new Map<string, string>();
const phoneToLidCache = new Map<string, string>();
const recentOutboundByPhone = new Map<string, { orderId?: string; sentAt: number; sessionId?: string }>();

function persistLidPhoneMapping(
  session: WaSessionRuntime | undefined,
  rawLid: string,
  rawPhone: string
): void {
  const lidDigits = String(rawLid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
  const cleanPhone = normalizeWaPhone(String(rawPhone || '').split('@')[0].split(':')[0]);
  if (!lidDigits || !cleanPhone || lidDigits === cleanPhone) return;

  lidToPhoneCache.set(lidDigits, cleanPhone);
  phoneToLidCache.set(cleanPhone, lidDigits);

  try {
    if (session?.authDir && fs.existsSync(session.authDir)) {
      const fwdPath = path.join(session.authDir, `lid-mapping-${cleanPhone}.json`);
      const revPath = path.join(session.authDir, `lid-mapping-${lidDigits}_reverse.json`);
      if (!fs.existsSync(fwdPath)) {
        fs.writeFileSync(fwdPath, JSON.stringify(lidDigits), 'utf8');
      }
      if (!fs.existsSync(revPath)) {
        fs.writeFileSync(revPath, JSON.stringify(cleanPhone), 'utf8');
      }
    }
  } catch {}

  try {
    const sockAny = session?.sock as any;
    if (sockAny?.signalRepository?.lidMapping?.storeLIDPNMappings) {
      Promise.resolve(
        sockAny.signalRepository.lidMapping.storeLIDPNMappings([
          { lid: `${lidDigits}@lid`, pn: `${cleanPhone}@s.whatsapp.net` }
        ])
      ).catch(() => {});
    }
  } catch {}
}

async function cacheRecipientLidMapping(
  session: WaSessionRuntime | undefined,
  cleanPhone: string,
  orderId?: string
): Promise<void> {
  if (!cleanPhone || cleanPhone.startsWith('lid-')) return;
  recentOutboundByPhone.set(cleanPhone, {
    orderId,
    sentAt: Date.now(),
    sessionId: session?.id
  });

  try {
    if (session?.authDir && fs.existsSync(session.authDir)) {
      const fwdPath = path.join(session.authDir, `lid-mapping-${cleanPhone}.json`);
      if (fs.existsSync(fwdPath)) {
        const rawVal = JSON.parse(fs.readFileSync(fwdPath, 'utf8'));
        const lidDigits = String(rawVal || '').split('@')[0].split(':')[0].replace(/\D/g, '');
        if (lidDigits) {
          lidToPhoneCache.set(lidDigits, cleanPhone);
          phoneToLidCache.set(cleanPhone, lidDigits);
        }
      }
    }
  } catch {}

  const sockAny = session?.sock as any;
  if (!sockAny) return;
  const jid = `${cleanPhone}@s.whatsapp.net`;

  try {
    if (sockAny?.signalRepository?.lidMapping?.getLIDForPN) {
      const lid = await Promise.resolve(sockAny.signalRepository.lidMapping.getLIDForPN(jid)).catch(() => null);
      if (lid && typeof lid === 'string') {
        persistLidPhoneMapping(session, lid, cleanPhone);
      }
    }
  } catch {}

  // Si aún no conocemos el @lid de este cliente nuevo, consultarlo proactivamente vía getLIDsForPNs (USync LID-Protocol)
  // ANTES de que el cliente responda, para que su primer mensaje entrante desde @lid se asocie en 0ms:
  if (!phoneToLidCache.has(cleanPhone)) {
    try {
      if (sockAny?.signalRepository?.lidMapping?.getLIDsForPNs) {
        const pairs = await Promise.race([
          sockAny.signalRepository.lidMapping.getLIDsForPNs([jid]),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 2500))
        ]);
        if (Array.isArray(pairs)) {
          for (const pair of pairs) {
            if (pair?.lid) {
              persistLidPhoneMapping(session, String(pair.lid), cleanPhone);
            }
          }
        }
      }
    } catch {}
  }
}

// Resolve WhatsApp Linked Device LID (@lid) to customer's actual phone number
export function resolveJidToCleanPhone(
  session: WaSessionRuntime | undefined,
  jid: string
): string | null {
  if (!jid) return null;
  const rawDigits = jid.split('@')[0].split(':')[0].replace(/\D/g, '');

  if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@pn') || jid.endsWith('@c.us')) {
    const clean = normalizeWaPhone(rawDigits);
    if (clean) return clean;
  }

  // 0. Check if this @lid belongs to the connected WhatsApp account itself (Self-Chat testing from owner's own phone)
  if (jid.endsWith('@lid')) {
    const selfPhone = normalizeWaPhone(
      session?.connectedPhone ||
      session?.sock?.user?.id?.split(':')[0]?.split('@')[0] ||
      (session as any)?.creds?.me?.id?.split(':')[0]?.split('@')[0] ||
      ''
    );
    const selfLidRaw =
      (session as any)?.connectedLid ||
      (session as any)?.creds?.me?.lid ||
      (session?.sock as any)?.authState?.creds?.me?.lid ||
      (session?.sock?.user as any)?.lid ||
      '';
    const selfLidDigits = String(selfLidRaw).split('@')[0].split(':')[0].replace(/\D/g, '');
    if (selfPhone && selfLidDigits && rawDigits === selfLidDigits) {
      lidToPhoneCache.set(rawDigits, selfPhone);
      phoneToLidCache.set(selfPhone, rawDigits);
      return selfPhone;
    }
    if (selfPhone && phoneToLidCache.get(selfPhone) === rawDigits) {
      return selfPhone;
    }
  }

  // 1. Check in-memory cache (verifying it is a real phone number and not an unmapped LID)
  if (lidToPhoneCache.has(rawDigits)) {
    const cached = lidToPhoneCache.get(rawDigits)!;
    if (!jid.endsWith('@lid') || (cached && cached !== rawDigits && cached.length >= 8 && cached.length <= 13)) {
      return cached;
    }
  }

  // 2. Check Baileys v7 signalRepository lidMapping in-memory cache synchronously
  try {
    const sockAny = session?.sock as any;
    const mappingCache = sockAny?.signalRepository?.lidMapping?.mappingCache;
    if (mappingCache && typeof mappingCache.get === 'function') {
      const cachedPn = mappingCache.get(`lid:${rawDigits}`);
      if (cachedPn && typeof cachedPn === 'string') {
        const clean = normalizeWaPhone(cachedPn.split('@')[0].split(':')[0]);
        if (clean && clean !== rawDigits) {
          lidToPhoneCache.set(rawDigits, clean);
          phoneToLidCache.set(clean, rawDigits);
          return clean;
        }
      }
    }
  } catch { }

  // 3. Scan disk reverse & forward files in auth directories: lid-mapping-<lid>_reverse.json, lid-mapping-<pn>.json, or creds.json me.lid
  const dirsToCheck: string[] = [];
  if (session?.authDir) dirsToCheck.push(session.authDir);
  if (fs.existsSync(MULTI_AUTH_ROOT)) {
    try {
      const subs = fs.readdirSync(MULTI_AUTH_ROOT).map(d => path.join(MULTI_AUTH_ROOT, d));
      for (const s of subs) {
        if (fs.statSync(s).isDirectory() && !dirsToCheck.includes(s)) dirsToCheck.push(s);
      }
    } catch { }
  }
  if (fs.existsSync(LEGACY_AUTH_DIR) && !dirsToCheck.includes(LEGACY_AUTH_DIR)) {
    dirsToCheck.push(LEGACY_AUTH_DIR);
  }

  for (const dir of dirsToCheck) {
    try {
      const credsPath = path.join(dir, 'creds.json');
      if (jid.endsWith('@lid') && fs.existsSync(credsPath)) {
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        const meLid = String(creds?.me?.lid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
        const mePhone = normalizeWaPhone(String(creds?.me?.id || '').split(':')[0].split('@')[0]);
        if (meLid && mePhone && rawDigits === meLid) {
          lidToPhoneCache.set(rawDigits, mePhone);
          phoneToLidCache.set(mePhone, rawDigits);
          return mePhone;
        }
      }
      const revPath = path.join(dir, `lid-mapping-${rawDigits}_reverse.json`);
      if (fs.existsSync(revPath)) {
        const val = JSON.parse(fs.readFileSync(revPath, 'utf8'));
        const clean = normalizeWaPhone(String(val));
        if (clean && clean !== rawDigits) {
          lidToPhoneCache.set(rawDigits, clean);
          phoneToLidCache.set(clean, rawDigits);
          return clean;
        }
      }
      // Also scan forward lid-mapping-<pn>.json files written by Baileys when sending to <pn>@s.whatsapp.net
      if (jid.endsWith('@lid') && fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (f.startsWith('lid-mapping-') && f.endsWith('.json') && !f.endsWith('_reverse.json')) {
            const pnCandidate = f.slice('lid-mapping-'.length, -'.json'.length);
            const cleanPn = normalizeWaPhone(pnCandidate);
            if (!cleanPn || cleanPn.length > 13) continue;
            try {
              const mappedVal = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
              const mappedLidDigits = String(mappedVal || '').split('@')[0].split(':')[0].replace(/\D/g, '');
              if (mappedLidDigits) {
                lidToPhoneCache.set(mappedLidDigits, cleanPn);
                phoneToLidCache.set(cleanPn, mappedLidDigits);
                if (mappedLidDigits === rawDigits) {
                  return cleanPn;
                }
              }
            } catch {}
          }
        }
      }
    } catch { }
  }

  // 4. Try matching with known orders in pedidos.json
  try {
    const pedidos = loadPedidos();
    const byOrder = pedidos.find(p => {
      const cp = normalizeWaPhone(p.celular);
      if (!cp || cp.length < 8 || cp.length > 13) return false;
      if (jid.endsWith('@lid')) {
        return phoneToLidCache.get(cp) === rawDigits;
      }
      return cp === rawDigits || phoneToLidCache.get(cp) === rawDigits;
    });
    if (byOrder) {
      const clean = normalizeWaPhone(byOrder.celular);
      if (clean && (!jid.endsWith('@lid') || clean !== rawDigits)) {
        lidToPhoneCache.set(rawDigits, clean);
        return clean;
      }
    }
  } catch { }

  if (jid.endsWith('@lid')) {
    return null;
  }

  return normalizeWaPhone(rawDigits);
}

interface StoredSessionMeta {
  id: string;
  label: string;
  createdAt: string;
}

interface ChatsStorage {
  chats: Record<string, WaChatMessage[]>;
  chatModes: Record<string, 'automatico' | 'manual'>;
  callModes: Record<string, 'automatico' | 'manual'>;
  customerChannels: Record<string, AgentChannel>;
  convSteps: Record<string, number>;
  postConfirmStrikes?: Record<string, number>;
  postConfirmBlocked?: Record<string, boolean>;
  globalAiMode?: 'automatico' | 'manual';
  autoChatOnOrder: boolean;
  autoCallOnOrder: boolean;
  preferredChannel: AgentChannel;
  selectedVoiceId: string;
  sessionsMeta?: StoredSessionMeta[];
  processedCmds?: string[];
  processedOrders?: string[];
}

function normalizeChannel(ch?: string): AgentChannel {
  if (ch === 'texto') return 'texto';
  return 'audio';
}

const VOICE_ID_ALIASES: Record<string, string> = {
  'vibevoice-sp-spk2': 'deepgram-estrella',
  'vibevoice-sp-spk1': 'deepgram-estrella',
  'vibevoice-sp-spk0': 'deepgram-estrella',
  'vibevoice-sp-spk3': 'deepgram-estrella',
  'vibevoice-sp-spk4': 'deepgram-estrella',
  'vibevoice-sp-spk5': 'deepgram-estrella',
  'vibevoice-camila-py': 'deepgram-estrella',
  'vibevoice-mateo-py': 'deepgram-estrella',
  'vibevoice-sofia-ar': 'deepgram-estrella',
  'vibevoice-lucas-ar': 'deepgram-estrella',
  'vibevoice-valentina-co': 'deepgram-estrella',
  'vibevoice-nicolas-co': 'deepgram-estrella',
  'vibevoice-martina-uy': 'deepgram-estrella',
  'vibevoice-daniel-uy': 'deepgram-estrella',
  'vibevoice-isabella-mx': 'deepgram-estrella',
  'vibevoice-gabriel-mx': 'deepgram-estrella',
  'ming-tania-py': 'deepgram-estrella',
  'ming-mario-py': 'deepgram-estrella',
  'ming-elena-ar': 'deepgram-estrella',
  'ming-tomas-ar': 'deepgram-estrella',
  'ming-xiaorou': 'deepgram-estrella',
  'ming-kai': 'deepgram-estrella',
  'ming-emma': 'deepgram-estrella',
  'ming-george': 'deepgram-estrella',
  'ming-xiaozhi': 'deepgram-estrella',
  'ming-jinghong': 'deepgram-estrella',
  'ming-xirui': 'deepgram-estrella',
  'ming-duoer': 'deepgram-estrella',
  'tania': 'deepgram-estrella',
  'mario': 'deepgram-estrella',
  'camila': 'deepgram-estrella',
  'mateo': 'deepgram-estrella',
  'sofia': 'deepgram-estrella',
  'lucas': 'deepgram-estrella',
  'valentina': 'deepgram-estrella',
  'nicolas': 'deepgram-estrella',
  'martina': 'deepgram-estrella',
  'daniel': 'deepgram-estrella',
  'isabella': 'deepgram-estrella',
  'gabriel': 'deepgram-estrella',
  'estrella': 'deepgram-estrella',
  'celeste': 'deepgram-celeste',
  'sirio': 'deepgram-sirio',
  'nestor': 'deepgram-nestor',
  'aura-2-estrella-es': 'deepgram-estrella',
  'aura-2-celeste-es': 'deepgram-celeste',
  'aura-2-sirio-es': 'deepgram-sirio',
  'aura-2-nestor-es': 'deepgram-nestor'
};

function normalizeVoiceId(voiceId?: string): string {
  if (!voiceId) return DEEPGRAM_VOICE_CATALOG[0].id;
  const mapped = VOICE_ID_ALIASES[voiceId] || voiceId;
  const found = DEEPGRAM_VOICE_CATALOG.find(
    v => v.id === mapped || v.id.toLowerCase() === mapped.toLowerCase()
  );
  if (found) {
    return found.id;
  }
  return DEEPGRAM_VOICE_CATALOG[0].id;
}

export function getSelectedVoiceProfile(voiceIdOverride?: string): DeepgramVoiceProfile {
  if (voiceIdOverride) {
    const mapped = VOICE_ID_ALIASES[voiceIdOverride] || voiceIdOverride;
    const found = DEEPGRAM_VOICE_CATALOG.find(
      v => v.id === mapped || v.id.toLowerCase() === mapped.toLowerCase()
    );
    if (found) return found;
  }

  // Also check store_config.json for product-level or global saved voice
  try {
    const cfg = loadStoreConfig();
    const cfgVoice =
      cfg?.selectedVoiceId ||
      (Array.isArray(cfg?.productPages) && cfg.productPages.find((p: any) => p?.vozAgente)?.vozAgente);
    if (cfgVoice) {
      const mappedCfg = VOICE_ID_ALIASES[cfgVoice] || cfgVoice;
      const foundCfg = DEEPGRAM_VOICE_CATALOG.find(
        v => v.id === mappedCfg || v.id.toLowerCase() === String(mappedCfg).toLowerCase()
      );
      if (foundCfg) return foundCfg;
    }
  } catch (e) { }

  const storage = loadChatsStorage();
  const foundInStorage = DEEPGRAM_VOICE_CATALOG.find(v => v.id === storage.selectedVoiceId);
  if (foundInStorage) return foundInStorage;

  // Check aliases for what might be in storage
  const aliasTarget = VOICE_ID_ALIASES[storage.selectedVoiceId];
  if (aliasTarget) {
    const foundAlias = DEEPGRAM_VOICE_CATALOG.find(v => v.id === aliasTarget);
    if (foundAlias) return foundAlias;
  }

  return DEEPGRAM_VOICE_CATALOG[0];
}

// Resolve the exact Deepgram voice profile assigned to an order's specific product
export function getVoiceProfileForOrder(
  order?: any,
  productId?: string,
  voiceIdOverride?: string
): DeepgramVoiceProfile {
  if (voiceIdOverride) {
    return getSelectedVoiceProfile(voiceIdOverride);
  }
  try {
    const cfg = loadStoreConfig();
    const pages: any[] = Array.isArray(cfg?.productPages) ? cfg.productPages : [];
    const targetProdId = productId || order?.productoId;
    const targetProdName = order?.producto;
    const matchedProd =
      pages.find(
        p =>
          (targetProdId && p.id === targetProdId) ||
          (targetProdName && p.nombre && String(p.nombre).toLowerCase() === String(targetProdName).toLowerCase())
      ) || pages[0];

    if (matchedProd?.vozAgente) {
      return getSelectedVoiceProfile(matchedProd.vozAgente);
    }
    if (order?.vozAgente) {
      return getSelectedVoiceProfile(order.vozAgente);
    }
    if (cfg?.selectedVoiceId) {
      return getSelectedVoiceProfile(cfg.selectedVoiceId);
    }
  } catch (e) { }
  return getSelectedVoiceProfile();
}

export async function persistVoiceSelectionToCloud(
  voiceId: string,
  voiceName: string,
  productId?: string,
  updatedCfg?: any
): Promise<void> {
  try {
    const voicePayload = {
      voiceId,
      voiceName,
      productId: productId || null,
      updatedAt: new Date().toISOString()
    };
    await insertOrUpdateSupabaseCodigo(
      `WAVOICE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      JSON.stringify(voicePayload)
    );

    if (updatedCfg && Array.isArray(updatedCfg.productPages) && updatedCfg.productPages.length > 0) {
      let baseCfg = updatedCfg;
      try {
        const rows = await querySupabaseCodigos({
          codeFilter: 'like.CFG-*',
          orderDesc: true,
          limit: 5
        });
        const nonInit = Array.isArray(rows)
          ? rows.find((r: any) => r.code && !String(r.code).endsWith('-init')) || rows[0]
          : null;
        if (nonInit?.dispositivo) {
          const parsedRemote = JSON.parse(nonInit.dispositivo);
          if (parsedRemote && typeof parsedRemote === 'object') {
            baseCfg = {
              ...parsedRemote,
              selectedVoiceId: voiceId,
              selectedVoiceName: voiceName,
              productPages: Array.isArray(parsedRemote.productPages)
                ? parsedRemote.productPages.map((p: any) =>
                    !productId || p.id === productId
                      ? { ...p, vozAgente: voiceId, vozAgenteNombre: voiceName }
                      : p
                  )
                : updatedCfg.productPages,
              updatedAt: new Date().toISOString()
            };
          }
        }
      } catch {}

      await insertOrUpdateSupabaseCodigo(
        `CFG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        JSON.stringify(baseCfg)
      );
    }
  } catch (e) { }
}

export function setSelectedVoiceId(voiceId: string, productId?: string): DeepgramVoiceProfile {
  const cleanId = normalizeVoiceId(voiceId);
  const profile = getSelectedVoiceProfile(cleanId);
  const storage = loadChatsStorage();
  storage.selectedVoiceId = cleanId;
  saveChatsStorage(storage);

  // Also stamp the selected voice into store_config.json and pedidos.json so the package retains it
  let updatedCfg: any = null;
  try {
    const cfg = loadStoreConfig();
    cfg.selectedVoiceId = cleanId;
    cfg.selectedVoiceName = profile.name;
    if (Array.isArray(cfg.productPages)) {
      cfg.productPages = cfg.productPages.map((p: any) =>
        !productId || p.id === productId
          ? {
              ...p,
              vozAgente: cleanId,
              vozAgenteNombre: profile.name
            }
          : p
      );
    }
    updatedCfg = cfg;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) { }

  try {
    const pedidos = loadPedidos();
    if (Array.isArray(pedidos) && pedidos.length > 0) {
      for (const ord of pedidos) {
        if (!productId || ord.productoId === productId) {
          ord.vozAgente = cleanId;
          ord.vozAgenteNombre = profile.name;
        }
      }
      savePedidos(pedidos);
    }
  } catch (e) { }

  persistVoiceSelectionToCloud(cleanId, profile.name, productId, updatedCfg).catch(() => { });
  scheduleCloudStateSync(true);
  return profile;
}

function loadChatsStorage(): ChatsStorage {
  try {
    if (fs.existsSync(CHATS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CHATS_FILE, 'utf-8') || '{}');
      if (Array.isArray(parsed.processedCmds)) {
        parsed.processedCmds.forEach((c: string) => processedCloudCmds.add(c));
      }
      if (Array.isArray(parsed.processedOrders)) {
        parsed.processedOrders.forEach((o: string) => processedCloudOrders.add(o));
      }
      return {
        chats: parsed.chats || {},
        chatModes: parsed.chatModes || {},
        callModes: parsed.callModes || {},
        customerChannels: parsed.customerChannels || {},
        convSteps: parsed.convSteps || {},
        postConfirmStrikes: parsed.postConfirmStrikes || {},
        postConfirmBlocked: parsed.postConfirmBlocked || {},
        globalAiMode: 'automatico',
        autoChatOnOrder: typeof parsed.autoChatOnOrder === 'boolean' ? parsed.autoChatOnOrder : true,
        autoCallOnOrder: typeof parsed.autoCallOnOrder === 'boolean' ? parsed.autoCallOnOrder : true,
        preferredChannel: normalizeChannel(parsed.preferredChannel || 'audio'),
        selectedVoiceId: normalizeVoiceId(parsed.selectedVoiceId),
        sessionsMeta: Array.isArray(parsed.sessionsMeta) ? parsed.sessionsMeta : undefined,
        processedCmds: Array.from(processedCloudCmds).slice(-200),
        processedOrders: Array.from(processedCloudOrders).slice(-200)
      };
    }
  } catch (e) { }
  return {
    chats: {},
    chatModes: {},
    callModes: {},
    customerChannels: {},
    convSteps: {},
    postConfirmStrikes: {},
    postConfirmBlocked: {},
    globalAiMode: 'automatico',
    autoChatOnOrder: true,
    autoCallOnOrder: true,
    preferredChannel: 'audio',
    selectedVoiceId: DEEPGRAM_VOICE_CATALOG[0].id,
    processedCmds: Array.from(processedCloudCmds).slice(-200),
    processedOrders: Array.from(processedCloudOrders).slice(-200)
  };
}

function saveChatsStorage(data: ChatsStorage) {
  try {
    data.processedCmds = Array.from(processedCloudCmds).slice(-200);
    data.processedOrders = Array.from(processedCloudOrders).slice(-200);
    data.sessionsMeta = Array.from(sessionsMap.values()).map(s => ({
      id: s.id,
      label: s.label,
      createdAt: s.createdAt
    }));
    fs.writeFileSync(CHATS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) { }
}

export function setAutomationSettings(settings: {
  autoChatOnOrder?: boolean;
  autoCallOnOrder?: boolean;
  preferredChannel?: AgentChannel;
  selectedVoiceId?: string;
}): {
  autoChatOnOrder: boolean;
  autoCallOnOrder: boolean;
  preferredChannel: AgentChannel;
  selectedVoiceId: string;
} {
  const storage = loadChatsStorage();
  if (typeof settings.autoChatOnOrder === 'boolean') {
    storage.autoChatOnOrder = settings.autoChatOnOrder;
  }
  if (typeof settings.autoCallOnOrder === 'boolean') {
    storage.autoCallOnOrder = settings.autoCallOnOrder;
  }
  if (settings.preferredChannel) {
    storage.preferredChannel = normalizeChannel(settings.preferredChannel);
  }
  if (settings.selectedVoiceId) {
    storage.selectedVoiceId = normalizeVoiceId(settings.selectedVoiceId);
    setSelectedVoiceId(storage.selectedVoiceId);
  }
  saveChatsStorage(storage);
  scheduleCloudStateSync(true);
  return {
    autoChatOnOrder: storage.autoChatOnOrder,
    autoCallOnOrder: storage.autoCallOnOrder,
    preferredChannel: storage.preferredChannel,
    selectedVoiceId: storage.selectedVoiceId
  };
}

function getOrCreateSessionRuntime(id: string, label?: string, createdAt?: string): WaSessionRuntime {
  const existing = sessionsMap.get(id);
  if (existing) {
    if (label) existing.label = label;
    return existing;
  }
  const authDir = path.join(MULTI_AUTH_ROOT, id);
  const runtime: WaSessionRuntime = {
    id,
    label: label || `WhatsApp #${sessionsMap.size + 1}`,
    status: 'disconnected',
    qrDataUrl: null,
    pairingCode: null,
    connectedPhone: null,
    connectedName: null,
    lastError: null,
    createdAt: createdAt || new Date().toISOString(),
    authDir,
    sock: null,
    socketSeq: 0,
    isConnecting: false,
    lastSaveCredsPromise: Promise.resolve(),
    lastKeyWritePromise: Promise.resolve()
  };
  sessionsMap.set(id, runtime);
  return runtime;
}

function ensureInitialSessionsLoaded() {
  if (!fs.existsSync(MULTI_AUTH_ROOT)) {
    fs.mkdirSync(MULTI_AUTH_ROOT, { recursive: true });
  }

  // Migrate legacy ~/.noelux_wa_auth_v2 into ~/.noelux_wa_multi/wa-1 if present
  const wa1AuthDir = path.join(MULTI_AUTH_ROOT, 'wa-1');
  if (
    fs.existsSync(path.join(LEGACY_AUTH_DIR, 'creds.json')) &&
    !fs.existsSync(path.join(wa1AuthDir, 'creds.json'))
  ) {
    try {
      fs.mkdirSync(wa1AuthDir, { recursive: true });
      for (const file of fs.readdirSync(LEGACY_AUTH_DIR)) {
        fs.copyFileSync(path.join(LEGACY_AUTH_DIR, file), path.join(wa1AuthDir, file));
      }
    } catch (e) { }
  }

  const storage = loadChatsStorage();
  if (Array.isArray(storage.sessionsMeta) && storage.sessionsMeta.length > 0) {
    for (const meta of storage.sessionsMeta) {
      if (meta?.id) {
        getOrCreateSessionRuntime(meta.id, meta.label, meta.createdAt);
      }
    }
  }

  if (sessionsMap.size === 0) {
    getOrCreateSessionRuntime('wa-1', 'WhatsApp Principal #1');
    saveChatsStorage(storage);
  }
}

export function getAllSessionsSummary(): WaSessionSummary[] {
  ensureInitialSessionsLoaded();
  return Array.from(sessionsMap.values()).map(s => ({
    id: s.id,
    label: s.label,
    status: s.status,
    qrDataUrl: s.qrDataUrl,
    pairingCode: s.pairingCode,
    connectedPhone: s.connectedPhone,
    connectedName: s.connectedName,
    connectedLid:
      s.connectedLid ||
      ((s.creds?.me as any)?.lid ? String((s.creds.me as any).lid) : null) ||
      ((s.sock?.user as any)?.lid ? String((s.sock?.user as any).lid) : null),
    lastError: s.lastError,
    createdAt: s.createdAt
  }));
}

export function getWhatsAppEngineState(): WaEngineState {
  const summaries = getAllSessionsSummary();
  const storage = loadChatsStorage();
  const primary =
    summaries.find(s => s.status === 'connected') ||
    summaries.find(s => s.status === 'syncing') ||
    summaries.find(s => s.status === 'qr_ready') ||
    summaries[0] || {
      status: 'disconnected',
      qrDataUrl: null,
      pairingCode: null,
      connectedPhone: null,
      connectedName: null,
      lastError: null
    };

  return {
    status: primary.status,
    qrDataUrl: primary.qrDataUrl,
    pairingCode: primary.pairingCode,
    connectedPhone: primary.connectedPhone,
    connectedName: primary.connectedName,
    lastError: primary.lastError,
    globalAiMode: 'automatico',
    autoChatOnOrder: storage.autoChatOnOrder,
    autoCallOnOrder: storage.autoCallOnOrder,
    preferredChannel: storage.preferredChannel,
    selectedVoiceId: storage.selectedVoiceId,
    voices: DEEPGRAM_VOICE_CATALOG,
    sessions: summaries
  };
}

// Push real-time WhatsApp Engine State, Multi-Sessions & Chats to Supabase (Ultraligero: CERO Base64 de audio/imagen)
let syncTimeout: NodeJS.Timeout | null = null;
export function scheduleCloudStateSync(immediate = false) {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncWhatsAppStateToCloud().catch(() => { });
  }, immediate ? 250 : 2500);
}

function stripHeavyMediaFromChatMsg(m: WaChatMessage): Partial<WaChatMessage> {
  const safeImageUrl =
    typeof m.imageUrl === 'string' && !m.imageUrl.startsWith('data:') && m.imageUrl.length < 600
      ? m.imageUrl
      : undefined;
  return {
    id: m.id,
    phone: m.phone,
    sender: m.sender,
    senderName: m.senderName,
    text: m.text,
    timestamp: m.timestamp,
    status: m.status,
    orderId: m.orderId,
    isAudioNote: m.isAudioNote,
    convStep: m.convStep,
    voiceEngine: m.voiceEngine,
    ...(safeImageUrl ? { imageUrl: safeImageUrl } : {}),
    ...(m.commercialStage ? { commercialStage: m.commercialStage } : {}),
    ...(m.commercialPackQty ? { commercialPackQty: m.commercialPackQty } : {}),
    ...(m.commercialFramedPriceGs ? { commercialFramedPriceGs: m.commercialFramedPriceGs } : {})
  };
}

export async function syncCustomerChatToCloud(phone: string): Promise<void> {
  const clean = normalizeWaPhone(phone);
  if (!clean) return;
  try {
    const storage = loadChatsStorage();
    const msgs = storage.chats[clean] || [];
    if (msgs.length === 0) return;

    // Quitar datos pesados de audio/imagen base64 para que el payload sea ultraligero (< 15KB) y no sature Disk IO de Supabase
    const lightweightMsgs = msgs.slice(-40).map(stripHeavyMediaFromChatMsg);

    const payload = {
      phone: clean,
      messages: lightweightMsgs,
      mode: storage.chatModes[clean] || 'automatico',
      channel: storage.customerChannels[clean] || 'audio',
      convStep: storage.convSteps[clean] || 1,
      updatedAt: new Date().toISOString()
    };

    // Actualizar registro atómico WACHAT-${clean} en Supabase
    await insertOrUpdateSupabaseCodigo(`WACHAT-${clean}`, JSON.stringify(payload));
  } catch (e) { }
}

export async function syncWhatsAppStateToCloud(): Promise<void> {
  if ((globalThis as any).__noeluxIsYieldingToNewerDeploy) return;
  try {
    const state = getWhatsAppEngineState();
    const storage = loadChatsStorage();
    const summary = getAllChatsSummary();

    // CRÍTICO ANTI-504 SUPABASE: Jamás incluir audioDataUrl ni data:image/* Base64 dentro de WAENG-*
    // (reduce cada snapshot WAENG-* de ~5MB a ~10KB, eliminando el agotamiento de Disk IO en PostgreSQL)
    const compactChats: Record<string, Partial<WaChatMessage>[]> = {};
    const chatEntries = Object.entries(storage.chats || {}).slice(-60);
    for (const [ph, list] of chatEntries) {
      if (Array.isArray(list) && list.length > 0) {
        compactChats[ph] = list.slice(-15).map(stripHeavyMediaFromChatMsg);
      }
    }

    const payload = {
      engineState: {
        ...state,
        updatedAt: new Date().toISOString()
      },
      sessions: state.sessions || [],
      chatsSummary: summary,
      chats: compactChats,
      chatModes: storage.chatModes,
      callModes: storage.callModes,
      customerChannels: storage.customerChannels,
      convSteps: storage.convSteps,
      autoChatOnOrder: storage.autoChatOnOrder,
      autoCallOnOrder: storage.autoCallOnOrder,
      preferredChannel: storage.preferredChannel,
      selectedVoiceId: storage.selectedVoiceId,
      voices: DEEPGRAM_VOICE_CATALOG,
      incomingDiagnostics: recentIncomingDiagnostics.slice(0, 25),
      updatedAt: new Date().toISOString()
    };

    const uniqueCode = `WAENG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await insertOrUpdateSupabaseCodigo(uniqueCode, JSON.stringify(payload));
  } catch (e) { }
}

// Push updated order (e.g. when AI confirms house reference & packs order or Admin edits manually) to Supabase ('codigos' + 'pedidos')
export async function syncOrderUpdateToCloud(order: any): Promise<boolean> {
  if (!isPersistableOrderRecord(order)) return false;
  try {
    order.actualizado_en = order.actualizado_en || new Date().toISOString();
    const payloadRow = {
      reservaid: order.reservaid,
      producto_id: order.productoId || 'prod-noelux-01',
      producto: order.producto || null,
      wa_vendedor: order.waVendedor || null,
      nombre: order.nombre || 'Cliente',
      celular: order.celular || '',
      departamento: order.departamento || '',
      ciudad: order.ciudad || '',
      direccion: order.direccion || '',
      detalle: order.detalle || 'Efectivo al recibir',
      cantidad: Number(order.cantidad) || 1,
      monto: Number(order.monto) || 0,
      ref_code: order.ref_code || null,
      estado: order.estado || 'reservado',
      tipo_vivienda: order.tipoVivienda || 'casa',
      gps_lat: typeof order.gpsLat === 'number' ? order.gpsLat : null,
      gps_lng: typeof order.gpsLng === 'number' ? order.gpsLng : null,
      gps_link: order.gpsLink || null,
      gps_confirmado: Boolean(order.gpsConfirmado),
      referencia_casa: order.referenciaCasa || null,
      modo_ia: order.modoIA || 'automatico',
      conv_step: Number(order.convStep) || 1,
      atendido_por_ia: order.atendidoPorIA !== false,
      datos_confirmados: Boolean(order.datosConfirmados),
      agente_completado: Boolean(order.agenteCompletado),
      empaquetado: Boolean(order.empaquetado),
      archivado: Boolean(order.archivado),
      fecha_archivado: order.fechaArchivado || null,
      dispositivo: order,
      actualizado_en: order.actualizado_en
    };

    const creds = getSupabaseCredentials();
    let pedidosOk = false;
    if (creds) {
      const bodyStr = JSON.stringify(payloadRow);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 8000);
          const resPed = await fetch(`${creds.url}/rest/v1/pedidos?on_conflict=reservaid`, {
            method: 'POST',
            headers: {
              apikey: creds.key,
              Authorization: `Bearer ${creds.key}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal'
            },
            body: bodyStr,
            signal: ctrl.signal
          });
          clearTimeout(tid);
          if (resPed.ok) {
            pedidosOk = true;
            break;
          }
        } catch {}
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        }
      }
    }

    const uniqueCode = `ORD-${order.reservaid}-${Date.now()}`;
    processedCloudOrders.add(uniqueCode);
    const serializedOrder = JSON.stringify(order);
    let codigosOk = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      codigosOk = await insertOrUpdateSupabaseCodigo(uniqueCode, serializedOrder);
      if (codigosOk) break;
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
      }
    }

    return pedidosOk || codigosOk;
  } catch (e) {
    return false;
  }
}

// Automatically trigger chosen channel (Audio or Texto) when a new order arrives if Automático is active
export async function handleNewOrderAutomation(ord: any) {
  if (!isOfficialRegisteredProductOrder(ord)) return;
  const rid = String(ord?.reservaid || '').trim();
  if (rid && (automatedOrderIds.has(rid) || sentWelcomeStageByOrderId.has(rid))) return;
  if (ord?.atendidoPorIA || ord?.ultimoMensajeIA || ord?.waCommercialSentStages?.stage1_welcome) {
    if (rid) automatedOrderIds.add(rid);
    return;
  }

  const cleanPhone = normalizeWaPhone(ord.celular);
  if (!cleanPhone) return;

  // Si WhatsApp aún se está reconectando tras un deploy (0-4s), NO marcar aún como procesado:
  // reintentar automáticamente en cuanto la sesión quede conectada para JAMÁS perder la bienvenida!
  if (getWhatsAppEngineState().status !== 'connected') {
    setTimeout(() => {
      if (rid && !automatedOrderIds.has(rid) && !sentWelcomeStageByOrderId.has(rid)) {
        handleNewOrderAutomation(ord).catch((err: any) => {
          console.error('[handleNewOrderAutomation Retry Error]:', err);
        });
      }
    }, 3500);
    return;
  }

  if (rid) automatedOrderIds.add(rid);

  cancelCustomerInactivityFollowUp(cleanPhone);

  // Asegurar que el pedido oficial exista en pedidos.json local ANTES de iniciar la conversación
  try {
    const currentPedidos = loadPedidos();
    const foundCurrent = currentPedidos.some(p => rid && p.reservaid === rid);
    if (!foundCurrent && rid) {
      currentPedidos.unshift(ord);
      savePedidos(currentPedidos);
    }
  } catch {}

  const storage = loadChatsStorage();
  // Reiniciar el historial únicamente si no existen mensajes ya enviados para este mismo pedido
  const existingMsgsForOrder = (storage.chats[cleanPhone] || []).filter(
    (m: any) => rid && m.orderId === rid
  );
  if (existingMsgsForOrder.length === 0) {
    storage.chats[cleanPhone] = [];
  }

  const autoCall = storage.autoCallOnOrder;
  const autoChat = storage.autoChatOnOrder;
  // Estrategia 99-100% Audio: siempre iniciar los pedidos nuevos en canal 'audio'
  const channel: AgentChannel = 'audio';

  storage.customerChannels[cleanPhone] = channel;
  storage.callModes[cleanPhone] = autoCall || autoChat ? 'automatico' : 'manual';
  storage.chatModes[cleanPhone] = autoChat || autoCall ? 'automatico' : 'manual';
  storage.convSteps[cleanPhone] = 3;
  if (!storage.postConfirmStrikes) storage.postConfirmStrikes = {};
  if (!storage.postConfirmBlocked) storage.postConfirmBlocked = {};
  storage.postConfirmStrikes[cleanPhone] = 0;
  storage.postConfirmBlocked[cleanPhone] = false;
  saveChatsStorage(storage);

  if (autoCall || autoChat) {
    await startOrAdvanceVoiceCall(cleanPhone, ord.reservaid, undefined, false, 'audio');
  }
}

// Poll Supabase for commands and orders
let cloudPollInFlight = false;
let lastHeavyCloudSyncAt = 0;
export async function pollCloudCommandsAndOrders(forceHeavySync = false) {
  if ((globalThis as any).__noeluxEngineGen !== myEngineGen) return;
  if (cloudPollInFlight) return; // Mutex: skip if previous poll is still running
  cloudPollInFlight = true;
  const runHeavyCloudSync =
    forceHeavySync || lastHeavyCloudSyncAt === 0 || Date.now() - lastHeavyCloudSyncAt >= 15000;
  try {
    const rows = await querySupabaseCodigos({
      codeFilter: 'like.WACMD-*',
      orderDesc: true,
      limit: 15
    });

    if (Array.isArray(rows) && rows.length > 0) {
      const chronological = [...rows].reverse();
      let anyProcessed = false;

      for (const row of chronological) {
        if (!row?.code || processedCloudCmds.has(row.code)) continue;
        const createdMs = row.creado ? new Date(row.creado).getTime() : Date.now();
        if (Date.now() - createdMs > 5 * 60 * 1000) {
          processedCloudCmds.add(row.code);
          continue;
        }

        processedCloudCmds.add(row.code);
        anyProcessed = true;

        try {
          const cmd = JSON.parse(row.dispositivo || '{}');
          if (cmd.type === 'send' && cmd.phone && cmd.text) {
            await sendWhatsAppMessage(
              cmd.phone,
              cmd.text,
              cmd.sender === 'ai' ? 'ai' : 'admin',
              cmd.orderId,
              cmd.sessionId
            );
          } else if (cmd.type === 'mode') {
            const cleanMode = cmd.mode === 'manual' ? 'manual' : 'automatico';
            if (cmd.phone) {
              setCustomerChatMode(cmd.phone, cleanMode, cmd.channel);
              if (cleanMode === 'automatico' && cmd.triggerAiNow) {
                const targetCh = normalizeChannel(cmd.channel || 'audio');
                if (targetCh === 'audio') {
                  await startOrAdvanceVoiceCall(
                    cmd.phone,
                    cmd.orderId,
                    undefined,
                    false,
                    'audio'
                  );
                } else {
                  await triggerAiConfirmationForOrder(cmd.phone, cmd.orderId);
                }
              }
            }
          } else if (cmd.type === 'authorize_ai' && cmd.phone) {
            const targetCh = normalizeChannel(cmd.channel || 'audio');
            setCustomerChatMode(cmd.phone, 'automatico', targetCh);
            if (targetCh === 'audio') {
              await startOrAdvanceVoiceCall(cmd.phone, cmd.orderId, undefined, false, 'audio');
            } else {
              await triggerAiConfirmationForOrder(cmd.phone, cmd.orderId);
            }
          } else if (cmd.type === 'automation_settings') {
            setAutomationSettings({
              autoChatOnOrder: cmd.autoChatOnOrder,
              autoCallOnOrder: cmd.autoCallOnOrder,
              preferredChannel: cmd.preferredChannel,
              selectedVoiceId: cmd.selectedVoiceId
            });
          } else if (cmd.type === 'select_voice' && cmd.voiceId) {
            setSelectedVoiceId(
              String(cmd.voiceId),
              cmd.productId ? String(cmd.productId) : undefined
            );
          } else if (cmd.type === 'purge_chat' && cmd.phone) {
            const cleanP = normalizeWaPhone(cmd.phone);
            const storage = loadChatsStorage();
            delete storage.chats[cleanP];
            delete storage.convSteps[cleanP];
            if (storage.postConfirmStrikes) delete storage.postConfirmStrikes[cleanP];
            if (storage.postConfirmBlocked) delete storage.postConfirmBlocked[cleanP];
            saveChatsStorage(storage);
            scheduleCloudStateSync(true);
          } else if (cmd.type === 'purge_all_orphans') {
            purgeOrphanedChatsAndResidues();
          } else if (cmd.type === 'call_start' && cmd.phone) {
            const ch = normalizeChannel(cmd.channel || 'audio');
            await startOrAdvanceVoiceCall(
              cmd.phone,
              cmd.orderId,
              undefined,
              Boolean(cmd.resetCall),
              ch,
              cmd.customText
            );
          } else if (cmd.type === 'call_respond' && cmd.phone && cmd.text) {
            const ch = normalizeChannel(cmd.channel || 'audio');
            await startOrAdvanceVoiceCall(
              cmd.phone,
              cmd.orderId,
              String(cmd.text).trim(),
              false,
              ch,
              cmd.customText
            );
          } else if (cmd.type === 'simulate' && cmd.phone && cmd.text) {
            const cleanPhone = normalizeWaPhone(cmd.phone);
            appendChatMessage(cleanPhone, {
              sender: 'client',
              senderName: cmd.clientName || 'Cliente (WhatsApp)',
              text: String(cmd.text).trim(),
              status: 'delivered'
            });
            const historyInfo = getChatHistory(cleanPhone);
            if (historyInfo.mode === 'automatico') {
              const {
                reply,
                secondaryAudioReply,
                locationTextConfirmation,
                matchedOrder,
                convStep
              } = await generateSmartAiReply(cleanPhone, String(cmd.text).trim());
              if (reply) {
                await sendWhatsAppVoiceCallTurn(
                  cleanPhone,
                  reply,
                  convStep,
                  matchedOrder?.reservaid,
                  undefined,
                  'audio',
                  undefined,
                  locationTextConfirmation,
                  false,
                  secondaryAudioReply
                );
              }
            }
          } else if (cmd.type === 'approve_prepayment' && cmd.orderId) {
            await approveOrderPrepaymentAndNotifyCustomer(
              String(cmd.orderId),
              cmd.phone ? String(cmd.phone) : undefined,
              cmd.orderSnapshot
            );
          } else if (cmd.type === 'add_session') {
            await addWhatsAppSession(cmd.label, cmd.sessionId);
          } else if (cmd.type === 'remove_session' && cmd.sessionId) {
            await removeWhatsAppSession(cmd.sessionId, cmd.confirmCode);
          } else if (cmd.type === 'pairing' && cmd.phone) {
            await requestWhatsAppPairingCode(cmd.phone, cmd.sessionId);
          } else if (cmd.type === 'connect') {
            await connectWhatsAppEngine(Boolean(cmd.forceNewQr), cmd.sessionId);
          } else if (cmd.type === 'repair_session') {
            await repairWhatsAppSession(cmd.sessionId);
          } else if (cmd.type === 'logout') {
            await disconnectWhatsAppEngine(true, cmd.sessionId, cmd.confirmCode);
          }
        } catch {}
      }

      if (anyProcessed) {
        const storage = loadChatsStorage();
        saveChatsStorage(storage);
        await syncWhatsAppStateToCloud();
      }
    }

    if (runHeavyCloudSync) {
      lastHeavyCloudSyncAt = Date.now();

      await flushPendingCloudDeletes(8).catch(() => { });
      await flushPendingCloudOrderSyncs(6).catch(() => { });

    // 1.5. Sincronizar lista global de pedidos eliminados (DEL-ORD-*) y configuración (CFG-*) desde Supabase
    try {
      const delRows = await querySupabaseCodigos({
        codeFilter: 'like.DEL-ORD-*',
        orderDesc: true,
        limit: 500
      });
      if (Array.isArray(delRows)) {
        let newDelFound = false;
        for (const r of delRows) {
          try {
            if (r.dispositivo) {
              const parsed = JSON.parse(r.dispositivo);
              if (parsed?.deletedOrderId && !deletedOrderIds.has(String(parsed.deletedOrderId).trim())) {
                deletedOrderIds.add(String(parsed.deletedOrderId).trim());
                newDelFound = true;
              }
              if (Array.isArray(parsed?.deletedOrderIds)) {
                for (const id of parsed.deletedOrderIds) {
                  const cId = String(id).trim();
                  if (cId && !deletedOrderIds.has(cId)) {
                    deletedOrderIds.add(cId);
                    newDelFound = true;
                  }
                }
              }
            }
            const codeStr = String(r.code || '');
            const match = codeStr.match(/^DEL-ORD-(.+)-\d+$/) || codeStr.match(/^DEL-ORD-(NX-\d+)/);
            if (match?.[1] && !deletedOrderIds.has(match[1])) {
              deletedOrderIds.add(match[1]);
              newDelFound = true;
            }
          } catch (e) {}
        }
        if (newDelFound) {
          saveDeletedOrderIds(deletedOrderIds);
        }
        if (fs.existsSync(PEDIDOS_FILE)) {
          try {
            const rawDiskPedidos = JSON.parse(fs.readFileSync(PEDIDOS_FILE, 'utf-8') || '[]');
            if (Array.isArray(rawDiskPedidos)) {
              const afterPurge = rawDiskPedidos.filter(
                (p: any) => !deletedOrderIds.has(String(p?.reservaid || '').trim()) && !deletedOrderIds.has(String(p?.id || '').trim())
              );
              if (afterPurge.length !== rawDiskPedidos.length) {
                savePedidos(afterPurge);
                purgeOrphanedChatsAndResidues();
              } else if (newDelFound) {
                purgeOrphanedChatsAndResidues();
              }
            }
          } catch (e) {}
        } else if (newDelFound) {
          purgeOrphanedChatsAndResidues();
        }
      }
    } catch (e) {}

    try {
      // 1.5b. Sincronizar voz permanente (WAVOICE-*) y configuración de productos (CFG-*) desde Supabase
      let latestCloudVoiceId = '';
      let latestCloudVoiceProductId = '';
      try {
        const voiceRows = await querySupabaseCodigos({
          codeFilter: 'like.WAVOICE-*',
          orderDesc: true,
          limit: 5
        });
        if (Array.isArray(voiceRows) && voiceRows.length > 0 && voiceRows[0]?.dispositivo) {
          const parsedVoice = JSON.parse(voiceRows[0].dispositivo);
          if (parsedVoice?.voiceId) {
            latestCloudVoiceId = normalizeVoiceId(parsedVoice.voiceId);
            latestCloudVoiceProductId = parsedVoice.productId ? String(parsedVoice.productId) : '';
          }
        }
      } catch (e) {}

      const cfgRows = await querySupabaseCodigos({
        codeFilter: 'like.CFG-*',
        orderDesc: true,
        limit: 5
      });
      if (Array.isArray(cfgRows) && cfgRows.length > 0) {
        const nonInit = cfgRows.find((r: any) => r.code && !String(r.code).endsWith('-init')) || cfgRows[0];
        if (nonInit?.dispositivo) {
          const remoteCfg = JSON.parse(nonInit.dispositivo);
          const localCfg = loadStoreConfig();
          let cfgUpdated = false;
          const sellerStorage = loadSellerChatsStorage();
          let sellerUpdated = false;

          if (Array.isArray(remoteCfg?.productPages) && remoteCfg.productPages.length > 0) {
            for (const rp of remoteCfg.productPages) {
              if (rp?.id && rp?.waNotificacionesVendedor) {
                const cleanSellerWa = normalizeWaPhone(rp.waNotificacionesVendedor);
                if (cleanSellerWa && sellerStorage.sellerPhonesByProduct[rp.id] !== cleanSellerWa) {
                  sellerStorage.sellerPhonesByProduct[rp.id] = cleanSellerWa;
                  sellerUpdated = true;
                }
              }
              if (
                latestCloudVoiceId &&
                (!rp.vozAgente || (!latestCloudVoiceProductId || rp.id === latestCloudVoiceProductId))
              ) {
                rp.vozAgente = rp.vozAgente ? normalizeVoiceId(rp.vozAgente) : latestCloudVoiceId;
                rp.vozAgenteNombre = getSelectedVoiceProfile(rp.vozAgente).name;
              }
            }
            if (sellerUpdated) {
              saveSellerChatsStorage(sellerStorage);
            }
            if (JSON.stringify(localCfg.productPages) !== JSON.stringify(remoteCfg.productPages)) {
              localCfg.productPages = remoteCfg.productPages;
              cfgUpdated = true;
            }
          }

          const resolvedRemoteVoice =
            latestCloudVoiceId ||
            (remoteCfg?.selectedVoiceId ? normalizeVoiceId(remoteCfg.selectedVoiceId) : '') ||
            (Array.isArray(remoteCfg?.productPages)
              ? remoteCfg.productPages.find((p: any) => p?.vozAgente)?.vozAgente
              : '');

          if (resolvedRemoteVoice) {
            const cleanRemoteVoice = normalizeVoiceId(resolvedRemoteVoice);
            const voiceProf = getSelectedVoiceProfile(cleanRemoteVoice);
            if (localCfg.selectedVoiceId !== cleanRemoteVoice) {
              localCfg.selectedVoiceId = cleanRemoteVoice;
              localCfg.selectedVoiceName = voiceProf.name;
              cfgUpdated = true;
            }
            const chatStorage = loadChatsStorage();
            if (chatStorage.selectedVoiceId !== cleanRemoteVoice) {
              chatStorage.selectedVoiceId = cleanRemoteVoice;
              saveChatsStorage(chatStorage);
            }
          }

          if (cfgUpdated) {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(localCfg, null, 2), 'utf-8');
          }
        }
      }
    } catch (e) {}

    // 2. Sync new ORD-* orders (and structured 'pedidos' rows) created on Website into local pedidos.json
    const ordRows = await querySupabaseCodigos({
      codeFilter: 'like.ORD-*',
      orderDesc: true,
      limit: 500
    });

    const localPedidosSnapshot = loadPedidos();
    const localExistingReservaIds = new Set<string>(
      Array.isArray(localPedidosSnapshot)
        ? localPedidosSnapshot.map((p: any) => String(p?.reservaid || '').trim()).filter(Boolean)
        : []
    );

    const combinedOrdRows: Array<{ code: string; dispositivo: string }> = Array.isArray(ordRows) ? [...ordRows] : [];
    try {
      const creds = getSupabaseCredentials();
      if (creds) {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 8000);
        const resPedTable = await fetch(`${creds.url}/rest/v1/pedidos?order=fecha.desc&limit=500`, {
          headers: {
            apikey: creds.key,
            Authorization: `Bearer ${creds.key}`
          },
          signal: ctrl.signal
        });
        clearTimeout(tid);
        if (resPedTable.ok) {
          const pedRows = await resPedTable.json();
          if (Array.isArray(pedRows)) {
            for (const pr of pedRows) {
              if (!pr?.reservaid) continue;
              const rid = String(pr.reservaid).trim();
              if (isOrderDeleted(rid)) {
                pendingCloudDeletes.set(rid, normalizeWaPhone(pr?.celular || ''));
                continue;
              }
              const synKey = `PEDTABLE-${rid}-${pr.actualizado_en || pr.fecha || ''}`;
              if (processedCloudOrders.has(synKey) && localExistingReservaIds.has(rid)) continue;
              const snap = pr.dispositivo && typeof pr.dispositivo === 'object' && pr.dispositivo.reservaid ? pr.dispositivo : null;
              const reconstructed = {
                ...(snap || {}),
                reservaid: rid,
                productoId: pr.producto_id || snap?.productoId || 'prod-noelux-01',
                producto: pr.producto || snap?.producto || 'Noelux™ Proyector Navideño 12 Diseños',
                waVendedor: pr.wa_vendedor || snap?.waVendedor || '',
                nombre: pr.nombre || snap?.nombre || 'Cliente',
                celular: pr.celular || snap?.celular || '',
                departamento: pr.departamento || snap?.departamento || '',
                ciudad: pr.ciudad || snap?.ciudad || '',
                direccion: pr.direccion || snap?.direccion || '',
                detalle: pr.detalle || snap?.detalle || 'Efectivo al recibir',
                cantidad: Number(pr.cantidad || snap?.cantidad || 1),
                monto: Number(pr.monto || snap?.monto || 0),
                ref_code: pr.ref_code ?? snap?.ref_code ?? null,
                estado: pr.estado || snap?.estado || 'reservado',
                acredita: pr.acredita !== false,
                tipoVivienda: pr.tipo_vivienda || snap?.tipoVivienda || 'casa',
                ...(typeof pr.gps_lat === 'number' ? { gpsLat: pr.gps_lat } : {}),
                ...(typeof pr.gps_lng === 'number' ? { gpsLng: pr.gps_lng } : {}),
                ...(pr.gps_link ? { gpsLink: pr.gps_link } : {}),
                gpsConfirmado: Boolean(pr.gps_confirmado ?? snap?.gpsConfirmado),
                referenciaCasa: pr.referencia_casa || snap?.referenciaCasa || '',
                modoIA: pr.modo_ia || snap?.modoIA || 'automatico',
                convStep: Number(pr.conv_step || snap?.convStep || 1),
                atendidoPorIA: Boolean(pr.atendido_por_ia ?? snap?.atendidoPorIA ?? false),
                datosConfirmados: Boolean(pr.datos_confirmados ?? snap?.datosConfirmados),
                agenteCompletado: Boolean(pr.agente_completado ?? snap?.agenteCompletado),
                empaquetado: Boolean(pr.empaquetado ?? snap?.empaquetado),
                archivado: Boolean(pr.archivado ?? snap?.archivado),
                fechaArchivado: pr.fecha_archivado || snap?.fechaArchivado || null,
                fecha: pr.fecha || snap?.fecha || new Date().toISOString(),
                actualizado_en: pr.actualizado_en || snap?.actualizado_en || pr.fecha || new Date().toISOString()
              };
              combinedOrdRows.push({
                code: synKey,
                dispositivo: JSON.stringify(reconstructed)
              });
            }
          }
        }
      }
    } catch {}

    if (combinedOrdRows.length > 0) {
      const pedidos = loadPedidos();
      let pedidosChanged = false;
      const newlyAddedOrders: any[] = [];

      const chronologicalOrdRows = [...combinedOrdRows].reverse();

      for (const row of chronologicalOrdRows) {
        if (!row?.code) continue;

        try {
          const ord = JSON.parse(row.dispositivo || '{}');
          if (!ord?.reservaid || !ord?.celular) continue;
          const rid = String(ord.reservaid).trim();
          const existsInLocal = pedidos.some((p: any) => String(p?.reservaid || '').trim() === rid);
          if (processedCloudOrders.has(row.code) && existsInLocal) continue;
          processedCloudOrders.add(row.code);
          if (!isPersistableOrderRecord(ord)) {
            if (String(ord.reservaid).startsWith('NX-WA-')) {
              await deleteSupabaseCodigos(`eq.${row.code}`);
            }
            continue;
          }

          // Si el pedido fue eliminado permanentemente, purgar en segundo plano y jamás restaurar
          if (deletedOrderIds.has(String(ord.reservaid)) || deletedOrderIds.has(String(ord.id))) {
            pendingCloudDeletes.set(rid, normalizeWaPhone(ord?.celular || ''));
            void deleteSupabaseCodigos(`eq.${row.code}`).catch(() => { });
            continue;
          }

            if (!ord.waVendedor || !ord.productoId) {
              const storeCfg = loadStoreConfig();
              const pages: any[] = Array.isArray(storeCfg?.productPages) ? storeCfg.productPages : [];
              const matchedProd =
                pages.find(
                  p =>
                    (ord.productoId && p.id === ord.productoId) ||
                    (ord.producto && p.nombre && p.nombre.toLowerCase() === String(ord.producto).toLowerCase())
                ) || pages[0];
              if (!ord.waVendedor && matchedProd?.wa) {
                ord.waVendedor = normalizeWaPhone(matchedProd.wa);
              }
              if (!ord.productoId && matchedProd?.id) {
                ord.productoId = matchedProd.id;
              }
            } else {
              ord.waVendedor = normalizeWaPhone(ord.waVendedor);
            }

            const existingIdx = pedidos.findIndex((p: any) => p.reservaid === ord.reservaid);
            if (existingIdx === -1) {
              const storage = loadChatsStorage();
              const cleanPhone = normalizeWaPhone(ord.celular);
              const isAuto = storage.autoCallOnOrder || storage.autoChatOnOrder;
              const preservedStep = Math.max(
                Number(ord.convStep) || 1,
                cleanPhone ? Number(storage.convSteps[cleanPhone] || 1) : 1
              );
              const existingChatMsgs = cleanPhone ? storage.chats[cleanPhone] || [] : [];
              const hasSentGreetingForThisOrder = existingChatMsgs.some(
                (m: any) =>
                  (m.sender === 'ai' || m.sender === 'agent') &&
                  (!ord.reservaid || m.orderId === ord.reservaid)
              );
              const alreadyStartedByAi =
                Boolean(ord.ultimoMensajeIA) ||
                hasSentGreetingForThisOrder ||
                preservedStep > 1 ||
                Boolean(ord.datosConfirmados) ||
                Boolean(ord.agenteCompletado);

              ord.modoIA = ord.modoIA || (isAuto ? 'automatico' : 'manual');
              ord.convStep = preservedStep;
              ord.atendidoPorIA = Boolean(alreadyStartedByAi);
              pedidos.unshift(ord);
              pedidosChanged = true;

              if (!alreadyStartedByAi) {
                newlyAddedOrders.push(ord);
                // LIMPIEZA INMEDIATA: Solo cuando el pedido es verdaderamente nuevo (sin avance previo de IA)
                if (cleanPhone) {
                  storage.chats[cleanPhone] = [];
                  storage.convSteps[cleanPhone] = 1;
                  if (!storage.postConfirmStrikes) storage.postConfirmStrikes = {};
                  if (!storage.postConfirmBlocked) storage.postConfirmBlocked = {};
                  storage.postConfirmStrikes[cleanPhone] = 0;
                  storage.postConfirmBlocked[cleanPhone] = false;
                  storage.chatModes[cleanPhone] = 'automatico';
                  storage.customerChannels[cleanPhone] = ord.canalIA || storage.preferredChannel || 'audio';
                  saveChatsStorage(storage);
                }
              } else if (cleanPhone) {
                if (ord.reservaid) automatedOrderIds.add(ord.reservaid);
                storage.convSteps[cleanPhone] = preservedStep;
                storage.chatModes[cleanPhone] = ord.modoIA === 'manual' ? 'manual' : 'automatico';
                storage.customerChannels[cleanPhone] = ord.canalIA || storage.preferredChannel || 'audio';
                saveChatsStorage(storage);
              }
            } else {
              // Merge respetando el snapshot más reciente por actualizado_en/fecha sin degradar avance de IA ni empaquetado
              const prev = pedidos[existingIdx];
              const tPrev = prev?.actualizado_en
                ? new Date(prev.actualizado_en).getTime()
                : prev?.fecha
                  ? new Date(prev.fecha).getTime()
                  : 0;
              const tOrd = ord?.actualizado_en
                ? new Date(ord.actualizado_en).getTime()
                : ord?.fecha
                  ? new Date(ord.fecha).getTime()
                  : 0;
              const baseOrder = tOrd >= tPrev ? { ...prev, ...ord } : { ...ord, ...prev };
              const mergedStep = Math.max(Number(prev?.convStep) || 1, Number(ord?.convStep) || 1);
              const mergedConfirmed = Boolean(prev?.datosConfirmados || ord?.datosConfirmados);
              const mergedCompleted = Boolean(prev?.agenteCompletado || ord?.agenteCompletado);
              const mergedPacked = Boolean(prev?.empaquetado || ord?.empaquetado);
              const mergedStrikes = Math.max(
                Number(prev?.postConfirmStrikes) || 0,
                Number(ord?.postConfirmStrikes) || 0
              );
              const mergedBlocked = Boolean(prev?.postConfirmBlocked || ord?.postConfirmBlocked);
              const mergedAtendido = Boolean(
                prev?.atendidoPorIA ||
                  ord?.atendidoPorIA ||
                  (prev?.reservaid && sentWelcomeStageByOrderId.has(String(prev.reservaid)))
              );
              const mergedSentStages = {
                ...(ord?.waCommercialSentStages || {}),
                ...(prev?.waCommercialSentStages || {}),
                ...(prev?.reservaid && sentWelcomeStageByOrderId.has(String(prev.reservaid))
                  ? { stage1_welcome: true }
                  : {}),
                ...(prev?.reservaid && sentConfirmedStageByOrderId.has(String(prev.reservaid))
                  ? { stage3_confirmed: true }
                  : {})
              };
              pedidos[existingIdx] = {
                ...baseOrder,
                convStep: mergedStep,
                atendidoPorIA: mergedAtendido,
                locationTextSentOnce: Boolean(prev?.locationTextSentOnce || ord?.locationTextSentOnce),
                waCommercialSentStages: mergedSentStages,
                datosConfirmados: mergedConfirmed,
                agenteCompletado: mergedCompleted,
                empaquetado: mergedPacked,
                postConfirmStrikes: mergedStrikes,
                postConfirmBlocked: mergedBlocked,
                referenciaCasa: baseOrder.referenciaCasa || prev.referenciaCasa || ord.referenciaCasa || '',
                ultimoMensajeIA: prev.ultimoMensajeIA || baseOrder.ultimoMensajeIA || ord.ultimoMensajeIA || ''
              };
              pedidosChanged = true;
            }
          } catch {}
        }

        if (pedidosChanged) {
          savePedidos(pedidos);
          const storage = loadChatsStorage();
          saveChatsStorage(storage);
          if (getWhatsAppEngineState().status === 'connected') {
            for (const newOrd of newlyAddedOrders) {
              handleNewOrderAutomation(newOrd).catch((err: any) => {
                console.error('[Cloud Sync handleNewOrderAutomation Error]:', err);
              });
            }
          }
        }
      }
    }

    // 3. Self-healing watchdog: keep all registered sessions active, recover zombie WebSockets, and auto-restore cloud auth if missing
    ensureInitialSessionsLoaded();
    for (const session of sessionsMap.values()) {
      const wsAny = (session.sock as any)?.ws;
      const isZombieWs = Boolean(
        session.sock &&
        session.status === 'connected' &&
        wsAny &&
        (wsAny.isClosed === true || wsAny.isClosing === true)
      );
      if (isZombieWs && !session.isConnecting) {
        stopSessionSocket(session, false)
          .then(() => connectWhatsAppEngine(false, session.id))
          .catch(() => { });
        continue;
      }
      if (!session.sock && !session.isConnecting && session.status === 'disconnected') {
        connectWhatsAppEngine(false, session.id).catch(() => { });
      }
    }
  } catch (e) { } finally { cloudPollInFlight = false; }
}

const recentAudioDataUrls = new Map<string, string>();

export function appendChatMessage(
  phone: string,
  msg: Omit<WaChatMessage, 'id' | 'phone' | 'timestamp'> & { id?: string; timestamp?: string }
): WaChatMessage {
  const cleanPhone = normalizeWaPhone(phone);
  const safeText = typeof msg.text === 'string'
    ? msg.text
    : (msg.text && typeof msg.text === 'object' && (msg.text as any).text ? String((msg.text as any).text) : String(msg.text || ''));
  const storage = loadChatsStorage();
  if (!storage.chats[cleanPhone]) {
    storage.chats[cleanPhone] = [];
  }

  const msgId = msg.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  if (msg.audioDataUrl) {
    recentAudioDataUrls.set(msgId, msg.audioDataUrl);
  }

  const fullMsg: WaChatMessage = {
    id: msgId,
    phone: cleanPhone,
    sender: msg.sender,
    senderName: msg.senderName,
    text: safeText,
    timestamp: msg.timestamp || new Date().toISOString(),
    status: msg.status || 'sent',
    orderId: msg.orderId,
    sessionId: msg.sessionId,
    isVoiceCall: msg.isVoiceCall,
    isAudioNote: msg.isAudioNote,
    agentChannel: msg.agentChannel,
    callLink: msg.callLink,
    convStep: msg.convStep,
    voiceEngine: msg.voiceEngine,
    ...(msg.imageUrl ? { imageUrl: msg.imageUrl } : {}),
    ...(msg.commercialStage ? { commercialStage: msg.commercialStage } : {}),
    ...(msg.commercialPackQty ? { commercialPackQty: msg.commercialPackQty } : {}),
    ...(msg.commercialFramedPriceGs ? { commercialFramedPriceGs: msg.commercialFramedPriceGs } : {})
  };

  const exists = storage.chats[cleanPhone].some(m => m.id === fullMsg.id);
  if (!exists) {
    storage.chats[cleanPhone].push(fullMsg);
    saveChatsStorage(storage);
    scheduleCloudStateSync(false);
    syncCustomerChatToCloud(cleanPhone).catch(() => { });
  }
  return {
    ...fullMsg,
    audioDataUrl: msg.audioDataUrl || recentAudioDataUrls.get(msgId)
  };
}

export function getChatHistory(phone: string): {
  messages: WaChatMessage[];
  mode: 'automatico' | 'manual';
  callMode: 'automatico' | 'manual';
  channel: AgentChannel;
  convStep: number;
} {
  const cleanPhone = normalizeWaPhone(phone);
  const storage = loadChatsStorage();
  const rawMsgs = storage.chats[cleanPhone] || [];
  return {
    messages: rawMsgs.map(m =>
      recentAudioDataUrls.has(m.id) ? { ...m, audioDataUrl: recentAudioDataUrls.get(m.id) } : m
    ),
    mode: storage.chatModes[cleanPhone] || (storage.autoChatOnOrder ? 'automatico' : 'manual'),
    callMode: storage.callModes[cleanPhone] || (storage.autoCallOnOrder ? 'automatico' : 'manual'),
    channel: storage.customerChannels[cleanPhone] || storage.preferredChannel || 'audio',
    convStep: storage.convSteps[cleanPhone] || 1
  };
}

export function getAllChatsSummary(): Record<
  string,
  { lastMessage: WaChatMessage | null; totalMessages: number; mode: 'automatico' | 'manual'; channel: AgentChannel }
> {
  const storage = loadChatsStorage();
  const summary: Record<
    string,
    { lastMessage: WaChatMessage | null; totalMessages: number; mode: 'automatico' | 'manual'; channel: AgentChannel }
  > = {};
  for (const [phone, list] of Object.entries(storage.chats)) {
    if (!findActiveOrderForPhone(phone)) continue;
    summary[phone] = {
      lastMessage: list.length > 0 ? list[list.length - 1] : null,
      totalMessages: list.length,
      mode: storage.chatModes[phone] || 'manual',
      channel: storage.customerChannels[phone] || storage.preferredChannel || 'audio'
    };
  }
  return summary;
}

export function setCustomerChatMode(
  phone: string,
  mode: 'automatico' | 'manual',
  channel?: AgentChannel
) {
  const cleanPhone = normalizeWaPhone(phone);
  const storage = loadChatsStorage();
  storage.chatModes[cleanPhone] = mode;
  if (channel) {
    storage.customerChannels[cleanPhone] = normalizeChannel(channel);
    storage.callModes[cleanPhone] = channel === 'audio' ? 'automatico' : 'manual';
  }
  saveChatsStorage(storage);
  scheduleCloudStateSync(false);
}

export function setGlobalAiEngineMode(_mode: 'automatico' | 'manual') {
  const storage = loadChatsStorage();
  storage.globalAiMode = 'automatico';
  saveChatsStorage(storage);
  scheduleCloudStateSync(false);
}

export function loadStoreConfig(): any {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8') || '{}');
    }
  } catch (e) { }
  return {};
}

export function saveStoreConfig(cfg: any) {
  try {
    const tmpFile = `${CONFIG_FILE}.tmp.${process.pid}`;
    fs.writeFileSync(tmpFile, JSON.stringify(cfg ?? {}, null, 2), 'utf-8');
    fs.renameSync(tmpFile, CONFIG_FILE);
  } catch (e) { }
}

export function loadPedidos(): any[] {
  try {
    if (fs.existsSync(PEDIDOS_FILE)) {
      const list = JSON.parse(fs.readFileSync(PEDIDOS_FILE, 'utf-8') || '[]');
      if (Array.isArray(list)) {
        const filtered = list.filter(
          (p: any) =>
            isPersistableOrderRecord(p) &&
            !deletedOrderIds.has(String(p?.reservaid || '').trim()) &&
            !deletedOrderIds.has(String(p?.id || '').trim())
        );
        if (filtered.length !== list.length) {
          savePedidos(filtered);
        }
        return filtered;
      }
    }
  } catch (e) { }
  return [];
}

export function findActiveOrderForPhone(phone: string): any | null {
  const cleanPhone = normalizeWaPhone(phone);
  if (!cleanPhone || cleanPhone.length < 8) return null;
  const allOrders = loadPedidos().filter(
    p =>
      isOfficialRegisteredProductOrder(p) &&
      !isOrderDeleted(p?.reservaid) &&
      !isOrderDeleted(p?.id)
  );

  // 1. Coincidencia exacta por teléfono normalizado de cliente oficial registrado en página de producto
  let pedidos = allOrders.filter(p => {
    const pCel = normalizeWaPhone(p?.celular || p?.telefono || p?.phone || '');
    return pCel === cleanPhone;
  });

  // 2. Si no hubo coincidencia exacta, buscar por los últimos 8 dígitos (ej. 81445566)
  if (pedidos.length === 0 && cleanPhone.length >= 8) {
    const last8 = cleanPhone.slice(-8);
    pedidos = allOrders.filter(p => {
      const pCel = normalizeWaPhone(p?.celular || p?.telefono || p?.phone || '');
      return pCel.length >= 8 && pCel.slice(-8) === last8;
    });
  }

  if (pedidos.length === 0) return null;

  // 3. Priorizar primero cualquier pedido oficial en curso de confirmación (convStep < 5 y no confirmado aún)
  const inProgressWeb = pedidos.find(
    p => !p.datosConfirmados && !p.agenteCompletado && (p.convStep || 1) < 5
  );
  if (inProgressWeb) return inProgressWeb;

  // 4. Si el historial de chat apunta a un orderId específico, usar esa orden oficial
  try {
    const storage = loadChatsStorage();
    const msgs = storage.chats[cleanPhone] || [];
    const lastOrderId = [...msgs].reverse().find(m => m.orderId)?.orderId;
    if (lastOrderId) {
      const byChatId = pedidos.find(p => p.reservaid === lastOrderId);
      if (byChatId) return byChatId;
    }
  } catch (e) { }

  return pedidos[0];
}

export function savePedidos(list: any[]) {
  try {
    const tmpFile = `${PEDIDOS_FILE}.tmp.${process.pid}`;
    fs.writeFileSync(tmpFile, JSON.stringify(list, null, 2), 'utf-8');
    fs.renameSync(tmpFile, PEDIDOS_FILE);
  } catch (e) { }
}

function formatGsServer(n: number): string {
  return 'Gs. ' + Math.round(Number(n) || 0).toLocaleString('es-PY');
}

function getProductKnowledgeForOrder(order: any): {
  productName: string;
  p1: string;
  p2: string;
  p3: string;
  contextoIA: string;
  agentBrain?: any;
} {
  const storeCfg = loadStoreConfig();
  const productPages: any[] = storeCfg?.productPages || [];
  const rawProdName = order?.producto || 'Noelux™ Proyector Navideño 12 Diseños';

  const matchedProd =
    productPages.find(p =>
      (order?.productoId && p.id === order.productoId) ||
      rawProdName.toLowerCase().includes((p.nombre || '').toLowerCase().slice(0, 10)) ||
      (p.nombre || '').toLowerCase().includes(rawProdName.toLowerCase().slice(0, 10))
    ) || productPages[0];

  const p1 = formatGsServer(matchedProd?.precios?.[1] || storeCfg?.config?.lote?.[1] || 189000);
  const p2 = formatGsServer(matchedProd?.precios?.[2] || storeCfg?.config?.lote?.[2] || 358000);
  const p3 = formatGsServer(matchedProd?.precios?.[3] || storeCfg?.config?.lote?.[3] || 507000);

  const defaultKnowledge = `Producto: ${matchedProd?.nombre || rawProdName}. Cobertura de proyección hasta 70 m² (casas de hasta 2 pisos a 5-10m de distancia). Incluye 12 tarjetas ópticas HD con diseños en movimiento (Navidad, Año Nuevo, fiestas), carcasa blindada IP65 resistente a lluvia e intemperie, estaca para jardín + base redonda interior y cable de 5 metros (220V). Envío 100% gratis a todo el Paraguay, pago contra entrega al recibir y 7 días de garantía oficial.`;

  return {
    productName: matchedProd?.nombre || rawProdName,
    p1,
    p2,
    p3,
    contextoIA: matchedProd?.contextoIA || defaultKnowledge,
    agentBrain: matchedProd?.agentBrain || undefined
  };
}

function resolveMatchedProductPageForOrder(order: any): any {
  const storeCfg = loadStoreConfig();
  const productPages: any[] = storeCfg?.productPages || [];
  const rawProdName = String(order?.producto || 'Noelux™ Proyector Navideño');

  const matchedProd =
    productPages.find(
      p =>
        (order?.productoId && p.id === order.productoId) ||
        rawProdName.toLowerCase().includes(String(p.nombre || '').toLowerCase().slice(0, 10)) ||
        String(p.nombre || '').toLowerCase().includes(rawProdName.toLowerCase().slice(0, 10))
    ) || productPages[0];

  if (matchedProd) return matchedProd;

  return {
    id: order?.productoId || 'prod-noelux-default',
    nombre: rawProdName,
    imagen: '/assets/real/galeria-1.jpg',
    precioNormal: Number(storeCfg?.config?.normal) || 249000,
    precios: {
      1: Number(storeCfg?.config?.lote?.[1]) || 189000,
      2: Number(storeCfg?.config?.lote?.[2]) || 358000,
      3: Number(storeCfg?.config?.lote?.[3]) || 507000
    },
    waStageCommercialsEnabled: true
  };
}

const inFlightStageCommercialKeys = new Set<string>();
const sentWelcomeStageByOrderId = new Set<string>();
const sentConfirmedStageByOrderId = new Set<string>();
const activeAiOutboundLockByPhone = new Map<string, number>();

/**
 * Pre-genera en memoria la imagen personalizada de la etapa ('stage1_welcome' o 'stage3_confirmed')
 * SIN enviarla jamás por WhatsApp antes que el audio. La compuerta Audio-First autoriza su envío
 * únicamente 1 segundo (1000ms) después de que el Agente haya enviado la nota de voz.
 */
export async function preGenerateStageCommercialForOrder(
  phone: string,
  orderInput: any,
  stageId: WaCommercialStageId,
  forceRegenerate = false
): Promise<RenderPersonalizedOrderWelcomeResult | null> {
  try {
    if (stageId !== 'stage1_welcome' && stageId !== 'stage3_confirmed') {
      return null;
    }
    const cleanPhone = normalizeWaPhone(phone);
    if (!cleanPhone || !orderInput) return null;

    const pedidos = loadPedidos();
    const liveOrder =
      (orderInput.reservaid && pedidos.find((p: any) => p.reservaid === orderInput.reservaid)) ||
      orderInput;

    if (!isOfficialRegisteredProductOrder(liveOrder)) {
      return null;
    }

    const orderIdKey = String(liveOrder.reservaid || '').trim();

    // REGLA INQUEBRANTABLE: La imagen de Pedido Confirmado ('stage3_confirmed') JAMÁS puede pre-generarse
    // ni enviarse si el cliente aún NO ha confirmado explícitamente su pedido (datosConfirmados === true)
    if (stageId === 'stage3_confirmed' && !liveOrder.datosConfirmados) {
      return null;
    }

    if (!forceRegenerate && orderIdKey) {
      if (stageId === 'stage1_welcome' && sentWelcomeStageByOrderId.has(orderIdKey)) {
        return null;
      }
      if (stageId === 'stage3_confirmed' && sentConfirmedStageByOrderId.has(orderIdKey)) {
        return null;
      }
    }

    const existingChatMsgs = getChatHistory(cleanPhone).messages;
    const alreadyInChat = existingChatMsgs.some(
      m =>
        m.commercialStage === stageId &&
        (!liveOrder.reservaid || !m.orderId || m.orderId === liveOrder.reservaid)
    );
    if (!forceRegenerate && (liveOrder.waCommercialSentStages?.[stageId] || alreadyInChat)) {
      return null;
    }

    const matchedProduct = resolveMatchedProductPageForOrder(liveOrder);
    const renderFn =
      stageId === 'stage3_confirmed'
        ? renderPersonalizedOrderConfirmedImage
        : renderPersonalizedOrderWelcomeImage;

    const generated = await renderFn({
      order: liveOrder,
      product: matchedProduct,
      openRouterApiKey: getOpenRouterApiKey(),
      openRouterImageModel: getOpenRouterImageModel(),
      appReferer:
        process.env.APP_URL ||
        process.env.PUBLIC_URL ||
        'https://noelux.app',
      forceRegenerate
    });

    console.log(
      `[Pre-Generated ${stageId}] Lista en memoria (retenida hasta enviar audio) para ${liveOrder.reservaid || cleanPhone} (${liveOrder.nombre || 'Cliente'}) -> ${generated.publicUrl}`
    );
    return generated;
  } catch (err: any) {
    console.warn(
      `[Pre-Generated ${stageId} Notice]:`,
      String(err?.message || err || 'Error pre-generando imagen')
    );
    return null;
  }
}

export async function dispatchStageCommercialForOrderIfNeeded(
  phone: string,
  orderInput: any,
  stageId: WaCommercialStageId,
  preferredSessionId?: string,
  forceRegenerate = false,
  preGeneratedResult?: RenderPersonalizedOrderWelcomeResult | null
): Promise<{ sent: boolean; imageUrl?: string; error?: string }> {
  let lockKey = '';
  try {
    // Etapas soportadas dinámicamente por cliente:
    // - 'stage1_welcome': Ficha inicial de confirmación de datos (1s después del Audio #1)
    // - 'stage3_confirmed': Imagen final de Pedido Confirmado + Felicidades + Aviso Courier 48-72 hs (1s después del Audio de Confirmación)
    if (stageId !== 'stage1_welcome' && stageId !== 'stage3_confirmed') {
      return { sent: false };
    }
    const cleanPhone = normalizeWaPhone(phone);
    if (!cleanPhone || !orderInput) return { sent: false };

    const pedidos = loadPedidos();
    const liveOrder =
      (orderInput.reservaid && pedidos.find((p: any) => p.reservaid === orderInput.reservaid)) ||
      orderInput;

    if (!isOfficialRegisteredProductOrder(liveOrder)) {
      return { sent: false };
    }

    const orderIdKey = String(liveOrder.reservaid || '').trim();

    // REGLA INQUEBRANTABLE: Jamás enviar 'stage3_confirmed' si el pedido no está confirmado por el cliente
    if (stageId === 'stage3_confirmed' && !liveOrder.datosConfirmados) {
      return { sent: false };
    }

    if (forceRegenerate && orderIdKey) {
      if (stageId === 'stage1_welcome') sentWelcomeStageByOrderId.delete(orderIdKey);
      if (stageId === 'stage3_confirmed') sentConfirmedStageByOrderId.delete(orderIdKey);
    }

    if (!forceRegenerate && orderIdKey) {
      if (stageId === 'stage1_welcome' && sentWelcomeStageByOrderId.has(orderIdKey)) {
        return { sent: false };
      }
      if (stageId === 'stage3_confirmed' && sentConfirmedStageByOrderId.has(orderIdKey)) {
        return { sent: false };
      }
    }

    lockKey = `${cleanPhone}::${liveOrder.reservaid || 'ord'}::${stageId}`;
    if (inFlightStageCommercialKeys.has(lockKey)) {
      return { sent: false };
    }

    const existingChatMsgs = getChatHistory(cleanPhone).messages;
    const alreadyInChat = existingChatMsgs.some(
      m =>
        m.commercialStage === stageId &&
        (!liveOrder.reservaid || !m.orderId || m.orderId === liveOrder.reservaid)
    );
    if (!forceRegenerate && (liveOrder.waCommercialSentStages?.[stageId] || alreadyInChat)) {
      if (orderIdKey) {
        if (stageId === 'stage1_welcome') sentWelcomeStageByOrderId.add(orderIdKey);
        if (stageId === 'stage3_confirmed') sentConfirmedStageByOrderId.add(orderIdKey);
      }
      return { sent: false };
    }

    inFlightStageCommercialKeys.add(lockKey);
    if (orderIdKey) {
      if (stageId === 'stage1_welcome') sentWelcomeStageByOrderId.add(orderIdKey);
      if (stageId === 'stage3_confirmed') sentConfirmedStageByOrderId.add(orderIdKey);
    }
    activeAiOutboundLockByPhone.set(cleanPhone, Date.now() + 60000);

    const matchedProduct = resolveMatchedProductPageForOrder(liveOrder);
    const activeSession = pickConnectedSession(preferredSessionId);
    const outboundJid = activeSession?.sock ? resolveOutboundWhatsAppJid(cleanPhone) : '';

    let imageBuffer: Buffer | null = preGeneratedResult?.buffer || null;
    let publicImageUrl = preGeneratedResult?.publicUrl || '';
    let generatedEngineLabel = preGeneratedResult?.generatedBy || 'openrouter';
    let genErrorMsg = '';

    if (!imageBuffer || imageBuffer.length < 2000) {
      let composingHeartbeat: ReturnType<typeof setInterval> | null = null;
      if (activeSession?.sock && outboundJid) {
        activeSession.sock.sendPresenceUpdate('composing', outboundJid).catch(() => {});
        composingHeartbeat = setInterval(() => {
          activeSession.sock?.sendPresenceUpdate('composing', outboundJid).catch(() => {});
        }, 8500);
      }

      try {
        const renderFn =
          stageId === 'stage3_confirmed'
            ? renderPersonalizedOrderConfirmedImage
            : renderPersonalizedOrderWelcomeImage;

        const [generated] = await Promise.all([
          renderFn({
            order: liveOrder,
            product: matchedProduct,
            openRouterApiKey: getOpenRouterApiKey(),
            openRouterImageModel: getOpenRouterImageModel(),
            appReferer:
              process.env.APP_URL ||
              process.env.PUBLIC_URL ||
              'https://noelux.app',
            forceRegenerate
          }),
          activeSession?.sock
            ? cacheRecipientLidMapping(activeSession, cleanPhone, liveOrder.reservaid).catch(() => {})
            : Promise.resolve()
        ]);
        imageBuffer = generated.buffer;
        publicImageUrl = generated.publicUrl;
        generatedEngineLabel = generated.generatedBy;
        console.log(
          `[Personalized Image ${stageId}] Generada para ${liveOrder.reservaid || cleanPhone} (${liveOrder.nombre || 'Cliente'}) via ${generatedEngineLabel} -> ${publicImageUrl}`
        );
      } catch (genErr: any) {
        genErrorMsg = String(genErr?.message || genErr || 'Error generando imagen en OpenRouter');
        console.error(`[Personalized Image ${stageId} BLOQUEADO SIN FALLBACK]:`, genErrorMsg);
      } finally {
        if (composingHeartbeat) {
          clearInterval(composingHeartbeat);
          composingHeartbeat = null;
        }
      }
    }

    if (!imageBuffer || imageBuffer.length < 2000) {
      const failStatus = genErrorMsg || 'OpenRouter no devolvió imagen válida (fallback desactivado)';
      console.warn(`[StageCommercial ${stageId}] Imagen abortada sin fallback: ${failStatus}`);
      recordIncomingDiagnostic({
        remoteJid: outboundJid || `${cleanPhone}@s.whatsapp.net`,
        resolvedPhone: cleanPhone,
        hasMessage: false,
        status: `image_generation_blocked_no_fallback:${failStatus.slice(0, 80)}`
      });
      return { sent: false, error: failStatus };
    }

    let sentViaWaSocket = false;
    let msgId = `wacom-${stageId}-${Date.now()}`;

    if (activeSession && activeSession.sock) {
      try {
        const jid = outboundJid || resolveOutboundWhatsAppJid(cleanPhone);
        const preMsgId = generateMessageIDV2(activeSession.sock.user?.id);
        recentlySentMsgIds.add(preMsgId);
        setTimeout(() => recentlySentMsgIds.delete(preMsgId), 45000);

        const sentImg = await activeSession.sock.sendMessage(
          jid,
          {
            image: imageBuffer,
            mimetype: 'image/jpeg'
          } as any,
          { messageId: preMsgId }
        );

        if (sentImg?.key?.id) {
          msgId = sentImg.key.id;
          sentViaWaSocket = true;
          recentlySentMsgIds.add(msgId);
          setTimeout(() => recentlySentMsgIds.delete(msgId), 45000);
          recordSentProtoMessage(msgId, sentImg.message);
        } else {
          recordIncomingDiagnostic({
            remoteJid: jid,
            resolvedPhone: cleanPhone,
            hasMessage: false,
            status: 'outbound_image_no_key_id'
          });
        }
      } catch (waImgErr: any) {
        console.error(`[StageCommercial ${stageId}] Error enviando imagen por Baileys:`, waImgErr);
        recordIncomingDiagnostic({
          remoteJid: outboundJid || `${cleanPhone}@s.whatsapp.net`,
          resolvedPhone: cleanPhone,
          hasMessage: false,
          status: `outbound_image_error:${String(waImgErr?.message || waImgErr).slice(0, 80)}`
        });
      }
    }

    const qtyNum = Math.max(1, Math.round(Number(liveOrder.cantidad) || 1));
    const packLabel = qtyNum === 1 ? 'Pack 1X' : qtyNum === 2 ? 'Pack 2X' : `Pack ${qtyNum}X`;
    const customerLabel = String(liveOrder.nombre || '').trim() || packLabel;
    const isConfirmedStage = stageId === 'stage3_confirmed';

    appendChatMessage(cleanPhone, {
      id: msgId,
      sender: 'ai',
      senderName: isConfirmedStage
        ? `🎉 Pedido Confirmado · ${customerLabel}`
        : `🖼️ Ficha VIP · ${customerLabel}`,
      text: isConfirmedStage
        ? `🎉 Imagen de Pedido Confirmado #${liveOrder.reservaid || ''} · ¡Felicidades ${customerLabel}! Entrega por Courier en 48 a 72 hs (${packLabel})`
        : `🖼️ Imagen personalizada del pedido #${liveOrder.reservaid || ''} · ${customerLabel} (${packLabel})`,
      imageUrl: publicImageUrl || undefined,
      status: sentViaWaSocket ? 'sent' : 'pending_connection',
      orderId: liveOrder.reservaid,
      sessionId: activeSession?.id,
      convStep: isConfirmedStage ? 5 : liveOrder.convStep || 3,
      commercialStage: stageId,
      commercialPackQty: qtyNum
    });

    if (sentViaWaSocket) {
      const nextSentStages = {
        ...(liveOrder.waCommercialSentStages || {}),
        [stageId]: true
      };
      liveOrder.waCommercialSentStages = nextSentStages;
      orderInput.waCommercialSentStages = nextSentStages;
      savePedidos(pedidos);
    }

    return { sent: sentViaWaSocket, imageUrl: publicImageUrl || undefined };
  } catch (err) {
    console.error(`[StageCommercial ${stageId}] Error general:`, err);
    return { sent: false };
  } finally {
    if (lockKey) {
      inFlightStageCommercialKeys.delete(lockKey);
    }
  }
}

export function getNaturalFirstName(rawName?: string): string {
  const clean = String(rawName || '')
    .replace(/[*_™®©]/g, '')
    .trim();
  if (!clean || clean.toLowerCase() === 'test' || clean.toLowerCase() === 'cliente') {
    return 'qué tal';
  }
  const first = clean.split(/\s+/)[0];
  if (first.length <= 2) return clean;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function detectCustomerGender(rawName?: string): {
  gender: 'femenino' | 'masculino' | 'neutro';
  cortesia: string;
  estimado: string;
  instruccionGenero: string;
} {
  const clean = String(rawName || '')
    .replace(/[*_™®©.,]/g, '')
    .trim();
  if (!clean || clean.toLowerCase() === 'test' || clean.toLowerCase() === 'cliente') {
    return {
      gender: 'neutro',
      cortesia: '',
      estimado: 'estimado cliente',
      instruccionGenero:
        'GÉNERO DEL CLIENTE: No se pudo determinar por el nombre. Usá lenguaje neutro ("gracias por comunicarte", "un placer hablar con vos") sin decir "señor" ni "señora" para no equivocarte.'
    };
  }

  const tokens = clean
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  // Ignorar prefijos como sr, sra, don, doña, dr, dra, lic, ing
  let first = tokens[0] || '';
  if (['sra', 'srta', 'dona', 'dra', 'licda', 'se\u00f1ora'].includes(first)) {
    return {
      gender: 'femenino',
      cortesia: 'señora',
      estimado: 'estimada',
      instruccionGenero:
        'GÉNERO DEL CLIENTE: FEMENINO (MUJER). Tratá siempre a la clienta en FEMENINO ("señora", "estimada", "segura", "tranquila", "atendida"). ESTÁ TERMINANTEMENTE PROHIBIDO decirle "señor", "estimado" o usar adjetivos masculinos hacia ella.'
    };
  }
  if (['sr', 'don', 'dr', 'se\u00f1or'].includes(first)) {
    return {
      gender: 'masculino',
      cortesia: 'señor',
      estimado: 'estimado',
      instruccionGenero:
        'GÉNERO DEL CLIENTE: MASCULINO (HOMBRE). Tratá siempre al cliente en MASCULINO ("señor", "estimado", "seguro", "tranquilo", "atendido"). ESTÁ TERMINANTEMENTE PROHIBIDO decirle "señora", "estimada" o usar adjetivos femeninos hacia él.'
    };
  }
  if (['lic', 'ing', 'prof', 'arq', 'abog'].includes(first) && tokens.length > 1) {
    first = tokens[1];
  }

  const femaleExceptions = new Set([
    'carmen', 'rocio', 'pilar', 'consuelo', 'milagros', 'dolores', 'mercedes', 'lourdes',
    'beatriz', 'raquel', 'ester', 'esther', 'ruth', 'noemi', 'abigail', 'miriam', 'myriam',
    'edith', 'judith', 'elizabeth', 'liz', 'luz', 'sol', 'mar', 'paz', 'cruz', 'flor',
    'belen', 'ayelen', 'mailen', 'jazmin', 'yasmin', 'evelyn', 'karen', 'sharon', 'alison',
    'nicole', 'michelle', 'gisselle', 'giselle', 'yennifer', 'jennifer', 'ingrid', 'astrid',
    'sigrid', 'marisol', 'soledad', 'trinidad', 'natividad', 'caridad', 'piedad', 'concepcion',
    'asuncion', 'encarnacion', 'visitacion', 'ines', 'gladys', 'gladis', 'doris', 'iris',
    'genesis', 'analis', 'maribel', 'mabel', 'anabel', 'isabel', 'ysabel', 'araceli', 'aracely',
    'noeli', 'nayeli', 'yanet', 'janeth', 'lizeth', 'lisbeth', 'wendy', 'cindy', 'katy',
    'nancy', 'fanny', 'fany', 'betty', 'lilian', 'liliana', 'vivian', 'mirian', 'marian',
    'grisel', 'mariel', 'claire', 'jacqueline', 'ivonne', 'simone', 'celeste', 'guadalupe'
  ]);

  const maleExceptions = new Set([
    'jose', 'maria' // handled specially below
  ]);

  const maleEndingWithA = new Set([
    'luca', 'lucas', 'matias', 'elias', 'tobias', 'isaias', 'jeremias', 'ezequias', 'zacarias',
    'nicolas', 'tomas', 'jonas', 'blas', 'borja', 'ventura', 'bautista', 'evangelista', 'nikita',
    'joshua', 'noa', 'elisha', 'mustafa'
  ]);

  const maleCommon = new Set([
    'juan', 'carlos', 'luis', 'miguel', 'angel', 'jorge', 'pedro', 'pablo', 'diego', 'sergio',
    'fernando', 'roberto', 'ricardo', 'eduardo', 'alejandro', 'daniel', 'david', 'gabriel',
    'rafael', 'samuel', 'manuel', 'emanuel', 'emmanuel', 'israel', 'joel', 'noel', 'abel',
    'ariel', 'uriel', 'gael', 'axel', 'alex', 'alexander', 'alexis', 'fidel', 'leonel', 'lionel',
    'marcelo', 'marcos', 'marco', 'mario', 'martin', 'mateo', 'matias', 'mauricio', 'maximiliano',
    'nelson', 'nestor', 'nicolas', 'oscar', 'omar', 'orlando', 'osvaldo', 'patricio', 'pablo',
    'ramon', 'raul', 'rene', 'reinaldo', 'rodrigo', 'rolando', '纳', 'ruben', 'salomon', 'santiago',
    'sebastian', 'simon', 'teodoro', 'tomas', 'ulises', 'valentin', 'victor', 'vicente', 'walter',
    'wilson', 'william', 'xavier', 'javier', 'hector', 'hugo', 'hernan', 'horacio', 'ignacio',
    'ivan', 'jaime', 'jesus', 'joaquin', 'jonathan', 'jorge', 'julian', 'julio', 'kevin', 'leandro',
    'leonardo', 'lorenzo', 'luciano', 'gustavo', 'guillermo', 'gonzalo', 'gerardo', 'german',
    'gilberto', 'gregorio', 'federico', 'felipe', 'felix', 'francisco', 'franco', 'fabian',
    'fabricio', 'esteban', 'ernesto', 'enrique', 'emilio', 'emiliano', 'edgar', 'edgardo',
    'edison', 'edwin', 'efrain', 'eladio', 'eliseo', 'eloy', 'elvis', 'emanuel', 'epifanio',
    'erick', 'erik', 'eugenio', 'usebio', 'ever', 'ezequiel', 'damian', 'dario', 'denis', 'derlis',
    'cesar', 'claudio', 'clemente', 'cristian', 'christian', 'cristobal', 'bruno', 'bryan', 'braian',
    'bernardo', 'benjamin', 'benito', 'basilio', 'arturo', 'armando', 'arnaldo', 'antonio',
    'andres', 'anibal', 'alfredo', 'alberto', 'aldo', 'alcides', 'agustin', 'adrian', 'adolfo',
    'adan', 'abraham', 'arthur', 'richard', 'richar', 'fredy', 'freddy', 'alcides', ' milciades',
    'aristides', 'diogenes', 'socrates', 'hercules', 'porfirio', 'catalino', 'celso', ' Blas'
  ]);

  // "Jose Maria" -> masculino; "Maria Jose" -> femenino
  if (first === 'jose' && tokens[1] === 'maria') {
    return {
      gender: 'masculino',
      cortesia: 'señor',
      estimado: 'estimado',
      instruccionGenero:
        'GÉNERO DEL CLIENTE: MASCULINO (HOMBRE). Tratá siempre al cliente en MASCULINO ("señor", "estimado", "tranquilo", "seguro"). JAMÁS le digas "señora" ni "estimada".'
    };
  }
  if (first === 'maria') {
    return {
      gender: 'femenino',
      cortesia: 'señora',
      estimado: 'estimada',
      instruccionGenero:
        'GÉNERO DEL CLIENTE: FEMENINO (MUJER). Tratá siempre a la clienta en FEMENINO ("señora", "estimada", "tranquila", "segura"). JAMÁS le digas "señor" ni "estimado".'
    };
  }

  let isFemale = false;
  let isMale = false;

  if (femaleExceptions.has(first)) {
    isFemale = true;
  } else if (maleEndingWithA.has(first) || maleCommon.has(first) || first === 'jose') {
    isMale = true;
  } else if (first.endsWith('a') || first.endsWith('ia') || first.endsWith('na') || first.endsWith('la') || first.endsWith('ra') || first.endsWith('da') || first.endsWith('ta')) {
    isFemale = true;
  } else if (first.endsWith('o') || first.endsWith('os') || first.endsWith('on') || first.endsWith('or') || first.endsWith('el') || first.endsWith('an') || first.endsWith('in')) {
    isMale = true;
  }

  if (isFemale) {
    return {
      gender: 'femenino',
      cortesia: 'señora',
      estimado: 'estimada',
      instruccionGenero:
        'GÉNERO DEL CLIENTE: FEMENINO (MUJER). El nombre de la clienta es femenino. Tratá SIEMPRE a la clienta en FEMENINO ("señora", "estimada", "tranquila", "segura", "bienvenida"). ESTÁ TERMINANTEMENTE PROHIBIDO decirle "señor" o "estimado" por ningún motivo.'
    };
  }

  if (isMale) {
    return {
      gender: 'masculino',
      cortesia: 'señor',
      estimado: 'estimado',
      instruccionGenero:
        'GÉNERO DEL CLIENTE: MASCULINO (HOMBRE). El nombre del cliente es masculino. Tratá SIEMPRE al cliente en MASCULINO ("señor", "estimado", "tranquilo", "seguro", "bienvenido"). ESTÁ TERMINANTEMENTE PROHIBIDO decirle "señora" o "estimada" por ningún motivo.'
    };
  }

  return {
    gender: 'neutro',
    cortesia: '',
    estimado: 'estimado cliente',
    instruccionGenero:
      'GÉNERO DEL CLIENTE: No concluyente por el nombre. Usá trato respetuoso y cálido por su primer nombre sin usar las palabras "señor" ni "señora" para jamás equivocarte de género.'
  };
}

const MAX_POST_CONFIRM_TURNS = 5;

// Helper to check if a customer's confirmed order chat has already completed its warm post-confirmation window and is silently paused to protect credits
export function isCustomerPostConfirmBlocked(phone: string): boolean {
  const cleanPhone = normalizeWaPhone(phone);
  if (!cleanPhone) return false;
  try {
    const storage = loadChatsStorage();
    if (storage.postConfirmBlocked?.[cleanPhone]) {
      return true;
    }
    if ((storage.postConfirmStrikes?.[cleanPhone] || 0) >= MAX_POST_CONFIRM_TURNS) {
      return true;
    }
    const matchedOrder = findActiveOrderForPhone(cleanPhone);
    if (
      matchedOrder &&
      (matchedOrder.postConfirmBlocked || Number(matchedOrder.postConfirmStrikes || 0) >= MAX_POST_CONFIRM_TURNS)
    ) {
      return true;
    }
  } catch (e) { }
  return false;
}

// Build the friendly contact card deposited in the chat so the customer always has the support/sales phone number in text
function buildPostConfirmFinalContactCard(order: any, rawCallPhone: string): string {
  const digits = String(rawCallPhone || '0973532550').replace(/\D/g, '');
  const localPhone = digits.startsWith('595') ? '0' + digits.slice(3) : digits || '0973532550';
  const formattedPhone =
    localPhone.length === 10 && localPhone.startsWith('09')
      ? `${localPhone.slice(0, 4)} ${localPhone.slice(4, 7)} ${localPhone.slice(7)}`
      : localPhone;
  const shortProduct = getNaturalProductName(order?.producto);
  const firstName = getNaturalFirstName(order?.nombre);
  const genderInfo = detectCustomerGender(order?.nombre);
  const saludoFinal =
    genderInfo.gender === 'femenino'
      ? `Estimada ${firstName !== 'qué tal' ? firstName : 'clienta'}`
      : genderInfo.gender === 'masculino'
      ? `Estimado ${firstName !== 'qué tal' ? firstName : 'cliente'}`
      : `Hola ${firstName !== 'qué tal' ? firstName : ''}`.trim();

  return (
    `📞 *LÍNEA DIRECTA DE ATENCIÓN AL CLIENTE*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `✨ *${saludoFinal}:*\n` +
    `📦 *Tu pedido:* ✅ Confirmado y en preparación (${shortProduct})\n` +
    `☎️ *Teléfono directo para llamadas:* *${formattedPhone}*\n` +
    `👤 *Atención personalizada:* Equipo de Ventas y Despacho\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💛 _Por cualquier consulta adicional o si deseás agregar otra unidad a tu envío, podés llamarnos directamente al *${formattedPhone}* y te atendemos al instante. ¡Muchas gracias por tu compra!_`
  );
}

export function getNaturalProductName(rawProduct?: string): string {
  const raw = String(rawProduct || '')
    .replace(/[™®©*]/g, '')
    .replace(/\bNoelux\b/gi, '')
    .replace(/\b12\s*Diseños\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw || raw.toLowerCase().includes('proyector')) {
    return 'el Proyector Navideño';
  }
  return raw;
}

const SPANISH_DIGIT_WORDS_SERVER: Record<string, string> = {
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

function formatDigitGroupForSpanishTTS(group: string): string {
  const d = String(group || '').replace(/\D/g, '');
  if (!d) return '';
  return d
    .split('')
    .map(ch => SPANISH_DIGIT_WORDS_SERVER[ch] || ch)
    .join(' ');
}

const SPANISH_UNITS_MAP_SERVER: Record<string, number> = {
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

const SPANISH_TEENS_TWENTIES_MAP_SERVER: Record<string, number> = {
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

const SPANISH_TENS_MAP_SERVER: Record<string, number> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90
};

const SPANISH_HUNDREDS_MAP_SERVER: Record<string, number> = {
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
      if (SPANISH_HUNDREDS_MAP_SERVER[tok] !== undefined) {
        let val = SPANISH_HUNDREDS_MAP_SERVER[tok];
        i++;
        if (i < tokens.length && SPANISH_TENS_MAP_SERVER[tokens[i]] !== undefined) {
          val += SPANISH_TENS_MAP_SERVER[tokens[i]];
          i++;
          if (
            i + 1 < tokens.length &&
            tokens[i] === 'y' &&
            SPANISH_UNITS_MAP_SERVER[tokens[i + 1]] !== undefined
          ) {
            val += SPANISH_UNITS_MAP_SERVER[tokens[i + 1]];
            i += 2;
          }
        } else if (i < tokens.length && SPANISH_TEENS_TWENTIES_MAP_SERVER[tokens[i]] !== undefined) {
          val += SPANISH_TEENS_TWENTIES_MAP_SERVER[tokens[i]];
          i++;
        } else if (i < tokens.length && SPANISH_UNITS_MAP_SERVER[tokens[i]] !== undefined && tokens[i] !== 'cero') {
          val += SPANISH_UNITS_MAP_SERVER[tokens[i]];
          i++;
        }
        digits += String(val);
        continue;
      }
      if (SPANISH_TENS_MAP_SERVER[tok] !== undefined) {
        let val = SPANISH_TENS_MAP_SERVER[tok];
        i++;
        if (
          i + 1 < tokens.length &&
          tokens[i] === 'y' &&
          SPANISH_UNITS_MAP_SERVER[tokens[i + 1]] !== undefined
        ) {
          val += SPANISH_UNITS_MAP_SERVER[tokens[i + 1]];
          i += 2;
        }
        digits += String(val);
        continue;
      }
      if (SPANISH_TEENS_TWENTIES_MAP_SERVER[tok] !== undefined) {
        digits += String(SPANISH_TEENS_TWENTIES_MAP_SERVER[tok]);
        i++;
        continue;
      }
      if (SPANISH_UNITS_MAP_SERVER[tok] !== undefined) {
        digits += String(SPANISH_UNITS_MAP_SERVER[tok]);
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

// Normalize any Paraguayan mobile number in free text (even if spaced 3-3-4 like "097 353 2550" or "+595 973 532 550" or written in centenas/decenas)
// into the strict Paraguayan 4 - 3 - 3 grouping: "0973 532 550"
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

// Always format Paraguayan mobile numbers in 4 - 3 - 3 grouping (e.g. "0973 532 550"):
// 4 digits for the operator prefix (0973, 0981, etc.), then 3 digits, then 3 digits.
export function formatPhoneForSpeech(rawPhone?: string): string {
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

// Clean markdown, trademark symbols, and emojis into natural conversational speech,
// and ensure Paraguayan phone numbers are ALWAYS pronounced in 4 - 3 - 3 grouping (0973, 532, 550)
export function cleanTextForSpeech(rawText: string): string {
  let text = String(rawText || '');
  // Rewrite any legacy greeting text stored in old chat histories so it never speaks the old robotic script
  if (text.includes('Sabés para qué me comunico contigo') || text.includes('ni 10 segundos')) {
    text =
      'Hola, ¿qué tal? ¿Cómo estás? Te hablo del área de envíos por tu pedido del Proyector Navideño. Antes de que salga el repartidor hacia tu casa, quería confirmarte un par de datos de tu ubicación, ¿tenés un minutito ahora?';
  }
  text = normalizeParaguayanPhonesInText(text);
  text = normalizeGuaraniesCurrencyForSpeech(text);
  return text
    .replace(/Noelux™?\s*Proyector Navideño(\s*12\s*Diseños)?/gi, 'el Proyector Navideño')
    .replace(/\bde\s+el\s+Proyector/gi, 'del Proyector')
    .replace(/[™®©]/g, '')
    .replace(/\*+/g, '')
    .replace(/_+/g, '')
    .replace(/[«»"“”•]/g, '')
    .replace(/\bGs\.\s*([0-9.]+)/gi, (_m, n) => formatGuaraniesSpeech(Number(String(n).replace(/\D/g, '')) || 0))
    .replace(/\bGs\b\.?/gi, 'guaraníes')
    .replace(/\b(09\d{2})[\s,.-]+(\d{3})[\s,.-]+(\d{3})\b/g, (_m, g1, g2, g3) => {
      return `${formatDigitGroupForSpanishTTS(g1)}, ${formatDigitGroupForSpanishTTS(g2)}, ${formatDigitGroupForSpanishTTS(g3)}`;
    })
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;?!])/g, '$1')
    .trim();
}

// Preserve clean human punctuation without injecting artificial dots or pauses
export function formatHumanBreaths(text: string): string {
  return cleanTextForSpeech(text);
}


function buildWaveformFromBuffer(buf: Buffer): Uint8Array {
  const wave = new Uint8Array(64);
  if (!buf || buf.length < 128) {
    return new Uint8Array([
      20, 45, 65, 80, 55, 90, 70, 40, 85, 60, 75, 50, 95, 65, 45, 80,
      35, 70, 60, 85, 50, 75, 90, 65, 40, 80, 55, 70, 85, 60, 45, 75,
      50, 85, 65, 90, 55, 70, 40, 80, 60, 75, 50, 85, 65, 45, 70, 55,
      80, 60, 40, 75, 50, 65, 85, 55, 45, 70, 50, 60, 40, 30, 25, 15
    ]);
  }
  const step = Math.max(1, Math.floor(buf.length / 64));
  for (let i = 0; i < 64; i++) {
    const val = buf[Math.min(buf.length - 1, i * step)];
    wave[i] = Math.max(15, Math.min(96, 18 + (val % 78)));
  }
  return wave;
}



export function unwrapWhatsAppMessage(rawContent: any): any {
  let curr = rawContent;
  for (let i = 0; i < 6 && curr && typeof curr === 'object'; i++) {
    const next =
      curr.deviceSentMessage?.message ||
      curr.ephemeralMessage?.message ||
      curr.viewOnceMessage?.message ||
      curr.viewOnceMessageV2?.message ||
      curr.viewOnceMessageV2Extension?.message ||
      curr.documentWithCaptionMessage?.message ||
      curr.editedMessage?.message?.protocolMessage?.editedMessage ||
      curr.editedMessage?.message ||
      curr.associatedChildMessage?.message;
    if (!next) break;
    curr = next;
  }
  return curr;
}

export async function transcribeWhatsAppAudioMessage(
  msg: any
): Promise<{ transcript: string; audioDataUrl: string | null }> {
  try {
    const innerMsg: any = unwrapWhatsAppMessage(msg?.message);

    const msgToDownload = {
      key: msg?.key,
      message: innerMsg
    };

    let rawBuffer: Buffer | null = null;
    try {
      const downloadPromise = downloadMediaMessage(msgToDownload as any, 'buffer', {}) as Promise<Buffer>;
      const timeoutPromise = new Promise<Buffer>((_, reject) =>
        setTimeout(() => reject(new Error('Audio download timeout')), 15000)
      );
      rawBuffer = await Promise.race([downloadPromise, timeoutPromise]);
    } catch {
      try {
        rawBuffer = (await Promise.race([
          downloadMediaMessage(msg, 'buffer', {}) as Promise<Buffer>,
          new Promise<Buffer>((_, reject) =>
            setTimeout(() => reject(new Error('Fallback audio download timeout')), 15000)
          )
        ])) as Buffer;
      } catch (e) {
        console.error('[Baileys Media Download Error]:', e);
      }
    }

    if (!rawBuffer || rawBuffer.length < 64) {
      console.warn('[Deepgram STT] Downloaded audio buffer empty or too small:', rawBuffer?.length || 0);
      return { transcript: '', audioDataUrl: null };
    }

    const apiKey = getDeepgramApiKey();
    if (!apiKey) {
      console.error('[Deepgram STT] No API key configured');
      return { transcript: '', audioDataUrl: null };
    }

    const rawMime = String(innerMsg?.audioMessage?.mimetype || 'audio/ogg').split(';')[0].trim();
    const audioDataUrl = `data:${rawMime};base64,${rawBuffer.toString('base64')}`;

    // Deepgram STT (Try Nova-3 Spanish, with immediate fallback to Nova-2 Spanish)
    let transcript = '';
    const sttUrls = [
      'https://api.deepgram.com/v1/listen?model=nova-3&language=es&smart_format=true&punctuate=true',
      'https://api.deepgram.com/v1/listen?model=nova-2&language=es&smart_format=true&punctuate=true'
    ];

    for (const url of sttUrls) {
      try {
        const controller = new AbortController();
        const sttTimeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': rawMime || 'audio/ogg'
          },
          body: new Uint8Array(rawBuffer),
          signal: controller.signal
        }).finally(() => clearTimeout(sttTimeout));

        if (res.ok) {
          const data = await res.json();
          transcript = String(data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '').trim();
          if (transcript) break;
          console.warn(`[Deepgram STT ${url.includes('nova-3') ? 'nova-3' : 'nova-2'}] empty transcript (${rawBuffer.length} bytes)`);
        } else {
          const errText = await res.text().catch(() => '');
          console.warn(`[Deepgram STT ${url.includes('nova-3') ? 'nova-3' : 'nova-2'}] status ${res.status}:`, errText);
        }
      } catch (err) {
        console.warn('[Deepgram STT Attempt Warning]:', err);
      }
    }

    return { transcript, audioDataUrl };
  } catch (err) {
    console.error('[Deepgram STT Error]:', err);
    return { transcript: '', audioDataUrl: null };
  }
}

export async function downloadWhatsAppReceiptMedia(
  msg: any
): Promise<{ dataUrl: string | null; mimeType: string; fileName: string }> {
  try {
    const innerMsg: any =
      msg?.message?.ephemeralMessage?.message ||
      msg?.message?.viewOnceMessage?.message ||
      msg?.message?.viewOnceMessageV2?.message ||
      msg?.message?.viewOnceMessageV2Extension?.message ||
      msg?.message?.documentWithCaptionMessage?.message ||
      msg?.message?.editedMessage?.message?.protocolMessage?.editedMessage ||
      msg?.message;

    const imgNode = innerMsg?.imageMessage;
    const docNode = innerMsg?.documentMessage || innerMsg?.documentWithCaptionMessage?.message?.documentMessage;
    const rawMime = String(imgNode?.mimetype || docNode?.mimetype || 'image/jpeg').split(';')[0].trim();
    const fileName = String(docNode?.fileName || (rawMime.includes('pdf') ? 'comprobante.pdf' : 'comprobante.jpg')).trim();

    const msgToDownload = {
      key: msg?.key,
      message: innerMsg
    };

    let rawBuffer: Buffer | null = null;
    try {
      const downloadPromise = downloadMediaMessage(msgToDownload as any, 'buffer', {}) as Promise<Buffer>;
      const timeoutPromise = new Promise<Buffer>((_, reject) =>
        setTimeout(() => reject(new Error('Receipt media download timeout')), 6000)
      );
      rawBuffer = await Promise.race([downloadPromise, timeoutPromise]);
    } catch {
      try {
        rawBuffer = (await downloadMediaMessage(msg, 'buffer', {})) as Buffer;
      } catch (e) {
        console.error('[Receipt Media Download Error]:', e);
      }
    }

    if (!rawBuffer || rawBuffer.length < 32) {
      return { dataUrl: null, mimeType: rawMime, fileName };
    }

    const dataUrl = `data:${rawMime};base64,${rawBuffer.toString('base64')}`;
    return { dataUrl, mimeType: rawMime, fileName };
  } catch (err) {
    console.error('[downloadWhatsAppReceiptMedia Error]:', err);
    return { dataUrl: null, mimeType: 'image/jpeg', fileName: 'comprobante.jpg' };
  }
}


// Open-Source Conversational Voice Synthesis (Deepgram Aura-2 -> OGG/Opus 48kHz VoIP & MP3 Web)
export async function synthesizeSpeechSelfHosted(
  text: string,
  voiceIdOverride?: string
): Promise<{
  audioBuffer: Buffer | null;
  mimeType: string;
  audioDataUrl: string | null;
  durationSeconds: number;
  waveform: Uint8Array;
  engine: string;
  voiceProfile: DeepgramVoiceProfile;
}> {
  const voiceProfile = getSelectedVoiceProfile(voiceIdOverride);
  const cleanText = cleanTextForSpeech(text);
  const estSeconds = Math.max(3, Math.min(45, Math.round(cleanText.length / 10)));
  
  if (!cleanText) {
    return {
      audioBuffer: null,
      mimeType: 'audio/ogg; codecs=opus',
      audioDataUrl: null,
      durationSeconds: 3,
      waveform: buildWaveformFromBuffer(Buffer.alloc(0)),
      engine: `Deepgram Aura-2 · ${voiceProfile.name}`,
      voiceProfile
    };
  }

  const apiKey = getDeepgramApiKey();
  if (!apiKey) {
    console.error('[Deepgram TTS] No API key configured');
    return {
      audioBuffer: null,
      mimeType: 'audio/ogg; codecs=opus',
      audioDataUrl: null,
      durationSeconds: estSeconds,
      waveform: buildWaveformFromBuffer(Buffer.alloc(0)),
      engine: `Deepgram Aura-2 · ${voiceProfile.name} (sin API key)`,
      voiceProfile
    };
  }

  let lastErr: any = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const startedAt = Date.now();
    try {
      // Generate OGG/Opus for WhatsApp PTT (45s timeout para evitar cortes en audios largos + 1 reintento)
      const oggRes = await fetch(
        `https://api.deepgram.com/v1/speak?model=${voiceProfile.deepgramModel}&encoding=opus&container=ogg`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text: cleanText }),
          signal: AbortSignal.timeout(45000)
        }
      );

      if (!oggRes.ok) {
        const errText = await oggRes.text().catch(() => '');
        console.error(`[Deepgram TTS OGG Error attempt ${attempt}/2]:`, oggRes.status, errText);
        if (oggRes.status === 401 || oggRes.status === 403) {
          throw new Error(`Deepgram TTS auth failed: ${oggRes.status}`);
        }
        lastErr = new Error(`Deepgram TTS failed: ${oggRes.status}`);
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 650));
          continue;
        }
        throw lastErr;
      }

      const oggBuffer = Buffer.from(await oggRes.arrayBuffer());
      if (oggBuffer.length < 128) {
        lastErr = new Error(`Deepgram TTS empty OGG buffer (${oggBuffer.length} bytes)`);
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 550));
          continue;
        }
        throw lastErr;
      }

      const elapsedMs = Date.now() - startedAt;
      console.log(
        `[Deepgram TTS OK] ${voiceProfile.deepgramModel} en ${elapsedMs}ms (${cleanText.length} chars, ${oggBuffer.length} bytes, intento ${attempt}/2)`
      );
      // Generar URL directa OGG instantánea para reproducción web sin esperar una segunda petición de red
      const oggDataUrl = `data:audio/ogg;base64,${oggBuffer.toString('base64')}`;

      return {
        audioBuffer: oggBuffer,
        mimeType: 'audio/ogg; codecs=opus',
        audioDataUrl: oggDataUrl,
        durationSeconds: estSeconds,
        waveform: buildWaveformFromBuffer(oggBuffer),
        engine: `Deepgram Aura-2 · ${voiceProfile.name}`,
        voiceProfile
      };
    } catch (e: any) {
      lastErr = e;
      console.error(`[Deepgram TTS Synthesis Error attempt ${attempt}/2]:`, e?.message || e);
      if (attempt < 2 && !String(e?.message || '').includes('auth failed')) {
        await new Promise(resolve => setTimeout(resolve, 650));
        continue;
      }
    }
  }

  console.error('[Deepgram TTS Synthesis Final Failure]:', lastErr);
  return {
    audioBuffer: null,
    mimeType: 'audio/ogg; codecs=opus',
    audioDataUrl: null,
    durationSeconds: estSeconds,
    waveform: buildWaveformFromBuffer(Buffer.alloc(0)),
    engine: `Deepgram Aura-2 · ${voiceProfile.name}`,
    voiceProfile
  };
}

export function isBuildingOrderServer(order: any): boolean {
  if (!order) return false;
  if (order.tipoVivienda === 'edificio' || order?.comparativaDatos?.tipoVivienda === 'edificio') {
    return true;
  }
  if (
    Boolean(String(order.nombreEdificio || '').trim()) ||
    Boolean(String(order.pisoEdificio || '').trim()) ||
    Boolean(String(order.departamentoNumero || '').trim())
  ) {
    return true;
  }
  return /\bedificio\b|\bpiso\s*\d+|\bdpto\.?\s*\w+|\bdepartamento\s*\w+/i.test(
    String(order.direccion || '')
  );
}

export function formatBuildingDetailsServer(order: any): string {
  if (!isBuildingOrderServer(order)) return '';
  const parts: string[] = [];
  const buildingName = String(order?.nombreEdificio || order?.comparativaDatos?.nombreEdificio || '').trim();
  const floor = String(order?.pisoEdificio || order?.comparativaDatos?.pisoEdificio || '').trim();
  const apt = String(order?.departamentoNumero || order?.comparativaDatos?.departamentoNumero || '').trim();
  const recep = order?.tieneRecepcion || order?.comparativaDatos?.tieneRecepcion;
  const recepDetail = String(order?.detalleRecepcion || order?.comparativaDatos?.detalleRecepcion || '').trim();

  if (buildingName) parts.push(`Edificio ${buildingName}`);
  if (floor) parts.push(`Piso ${floor}`);
  if (apt) parts.push(`Dpto./Cuarto ${apt}`);
  if (recepDetail) {
    parts.push(`Recepción: ${recepDetail}`);
  } else if (recep === 'si_recepcionista') {
    parts.push('Recibe en Recepción / Portería');
  } else if (recep === 'no_personalmente') {
    parts.push('Sin recepción (recibe personalmente al bajar)');
  }
  return parts.join(' · ');
}

// CONFIRMACIÓN EXPRESS EN 1 PASO:
// 1) Audio #1 enviado PRIMERO pidiendo al cliente que mire la imagen de acá abajo que se le acabó de enviar y confirme con "CORRECTO" o "ESTÁ BIEN"
// 2) Imagen #1 generada dinámicamente con TODOS los datos del cliente (nombre, celular, ciudad, barrio/dirección, monto, SIN GPS), enviada 1s DESPUÉS del Audio #1 (queda abajo del audio)
export async function buildInitialOrderAiMessage(
  order: any
): Promise<{ text: string; locationTextConfirmation: string; error?: string }> {
  const rawName = String(order?.nombre || '').trim();
  const firstName = getNaturalFirstName(rawName);
  const displayFirstName = firstName && firstName !== 'qué tal' ? firstName : 'cliente';
  const fullDisplayName = rawName || displayFirstName;
  const shortProduct = getNaturalProductName(order?.producto);
  const phone433 = formatPhoneForSpeech(order?.celular || '');
  const qty = Math.max(1, Math.round(Number(order?.cantidad) || 1));
  const packPhrase =
    qty === 1
      ? 'el paquete de una unidad'
      : qty === 2
        ? 'el pack de dos unidades'
        : qty === 3
          ? 'el pack de tres unidades'
          : `el paquete de ${qty} unidades`;
  const rawMontoNum = Number(String(order?.monto || '189000').replace(/\D/g, '')) || 189000;
  const montoSpeech = formatGuaraniesSpeech(rawMontoNum);

  if (order?.direccion && /\[GPS:|google\.com\/maps|maps\.google\.com/i.test(String(order.direccion))) {
    order.direccion = cleanStreetAddressText(order.direccion);
  }

  const productDePhrase = /^el\s+/i.test(shortProduct)
    ? `del ${shortProduct.replace(/^el\s+/i, '')}`
    : `de ${shortProduct}`;

  // Audio Paso 1: Saludo personalizado conciso y cálido (sale primero que la imagen 1:1) guiando al cliente a revisar la imagen de acá abajo y responder con la palabra CORRECTO
  const expressGreetingAudio = `¡Hola ${displayFirstName}, qué tal! Te hablo del área de envíos de Noelux para confirmar ${packPhrase} ${productDePhrase} a nombre de ${fullDisplayName}, por ${montoSpeech} con envío gratis al recibir. Mirá la imagen de acá abajo que te acabé de enviar con tu celular ${phone433}, tu ciudad, tu barrio y tu dirección, y para confirmar que tus datos son correctos, respondeme con la palabra CORRECTO para confirmar tu envío.`;

  return {
    text: normalizeParaguayanPhonesInText(expressGreetingAudio),
    locationTextConfirmation: ''
  };
}

// Get or initialize current step (1..5) for a phone/order
function getOrderConvStep(cleanPhone: string, order: any): number {
  const storage = loadChatsStorage();
  if (order?.datosConfirmados || (order?.referenciaCasa && order?.empaquetado)) return 5;
  const storedStep = storage.convSteps[cleanPhone] || order?.convStep || 3;
  return Math.min(Math.max(Number(storedStep) || 3, 1), 5);
}

function setOrderConvStep(cleanPhone: string, order: any | null, step: number) {
  const storage = loadChatsStorage();
  storage.convSteps[cleanPhone] = step;
  saveChatsStorage(storage);
  if (order) {
    order.convStep = step;
  }
}

// Returns 5 minutes (300,000 ms) for Attempt #1, and 1 hour (3,600,000 ms) for Attempt #2, #3, #4... consecutive
export function getInactivityFollowUpDelayMs(attemptNumber: number): number {
  return attemptNumber <= 1 ? 5 * 60 * 1000 : 60 * 60 * 1000;
}

// Non-repetitive, empathetic, educated, and corporate/professional fallback messages for 3-minute and consecutive 1-hour follow-ups
export function buildCorporateInactivityFollowUpFallback(
  displayFirstName: string,
  gender: 'male' | 'female' | 'neutral',
  currentStep: number,
  attemptNumber: number,
  shortProduct: string,
  _isBuilding = false
): string {
  const ocupadoWord = gender === 'female' ? 'ocupada' : 'ocupado';

  // Attempt #1: 3-minute follow-up (empathetic, educated, professional, reminding keyword "CORRECTO")
  if (attemptNumber <= 1) {
    const threeMinVariants = [
      `Hola ${displayFirstName}, disculpame la molestia, comprendo perfectamente que tal vez estás ${ocupadoWord} ahora mismo. Solo te recuerdo con mucho respeto que arriba tenés la imagen con tu nombre, tu ciudad, tu barrio y la dirección para el envío de tu ${shortProduct}; apenas tengas un momentito mirala y para confirmar que tus datos son correctos, respondeme con la palabra CORRECTO para despachar tu paquete.`,
      `${displayFirstName}, te pido mil disculpas por interrumpirte un segundito, entiendo que quizás estás en tus actividades. Para dejar cien por ciento confirmado el envío de tu ${shortProduct}, cuando tengas un ratito libre mirá por favor tus datos en la imagen que te envié acá arriba y respondeme con la palabra CORRECTO.`,
      `Qué tal ${displayFirstName}, te hablo con mucha amabilidad desde despacho. Comprendo si estás ${ocupadoWord} en este instante; quedamos atentos únicamente a que revises tu nombre, ciudad y barrio en la imagen de acá arriba y nos digas en texto o en audio la palabra CORRECTO para sellar y enviar tu ${shortProduct}.`
    ];
    const vIdx = (currentStep + displayFirstName.length) % threeMinVariants.length;
    return threeMinVariants[vIdx];
  }

  // Attempt #2, #3, #4...: Consecutive 1-hour follow-ups
  const hoursElapsed = attemptNumber - 1;
  const hoursLabel = hoursElapsed === 1 ? 'ya pasó una hora' : `ya pasaron ${hoursElapsed} horas`;
  const hourlyVariants = [
    `${displayFirstName}, te saludo nuevamente con mucho respeto desde logística. Te comento que ${hoursLabel} que seguimos guardando tu paquete reservado de ${shortProduct} listo para salir a reparto. Cuando tengas un tiempito libre, revisá por favor tu barrio y ciudad acá arriba y respondeme con la palabra CORRECTO, así cerramos tu caja enseguida.`,
    `Hola ${displayFirstName}, disculpame este breve aviso: ${hoursLabel} que en el área de empaque mantenemos tu ${shortProduct} separado para vos. Sabemos que podés estar con trabajo, así que apenas te desocupes escribinos o decinos en audio la palabra CORRECTO para autorizar tu envío sin demoras.`
  ];
  const hIdx = (attemptNumber - 2 + currentStep) % hourlyVariants.length;
  return hourlyVariants[hIdx];
}

export function cancelCustomerInactivityFollowUp(rawPhone: string) {
  const cleanPhone = normalizeWaPhone(rawPhone);
  if (!cleanPhone) return;
  const existing = customerInactivityTimers.get(cleanPhone);
  if (existing) {
    clearTimeout(existing);
    customerInactivityTimers.delete(cleanPhone);
  }
  // Reset the consecutive follow-up counter whenever the customer replies or the order finishes
  inactivityFollowUpCount.delete(cleanPhone);
}

// Progressive Inactivity Follow-Up Schedule (Steps 1..4):
// - Attempt #1 fires after 1 MINUTE (60s) of customer silence.
// - Attempt #2 fires after 1 HOUR (3600s) if still no reply.
// - Attempt #3, #4, #5... fire every 1 HOUR consecutively until the customer replies.
// - Once the customer replies, cancelCustomerInactivityFollowUp deactivates and resets the cycle.
export function scheduleCustomerInactivityFollowUp(
  rawPhone: string,
  orderId?: string,
  preferredSessionId?: string,
  attemptNumber = 1
) {
  const cleanPhone = normalizeWaPhone(rawPhone);
  if (!cleanPhone) return;

  // Clear any existing timeout without wiping inactivityFollowUpCount if advancing to the next hourly attempt
  const existing = customerInactivityTimers.get(cleanPhone);
  if (existing) {
    clearTimeout(existing);
    customerInactivityTimers.delete(cleanPhone);
  }
  if (attemptNumber <= 1) {
    inactivityFollowUpCount.set(cleanPhone, 0);
  }

  // Cap at 24 consecutive hourly follow-ups for safety
  if (attemptNumber > 25) return;

  const delayMs = getInactivityFollowUpDelayMs(attemptNumber);

  const timer = setTimeout(async () => {
    customerInactivityTimers.delete(cleanPhone);
    try {
      if ((globalThis as any).__noeluxEngineGen !== myEngineGen) return;
      if (isCustomerPostConfirmBlocked(cleanPhone)) return;

      const storage = loadChatsStorage();
      if (storage.chatModes[cleanPhone] === 'manual') return;

      const pedidos = loadPedidos();
      const matchedOrder =
        (orderId && pedidos.find(p => p.reservaid === orderId)) ||
        findActiveOrderForPhone(cleanPhone);
      if (!matchedOrder || !isOfficialRegisteredProductOrder(matchedOrder)) return;

      const currentStep = getOrderConvStep(cleanPhone, matchedOrder);
      const isConfirmed =
        Boolean(matchedOrder.datosConfirmados) ||
        Boolean(matchedOrder.agenteCompletado) ||
        currentStep >= 5;
      if (isConfirmed) {
        inactivityFollowUpCount.delete(cleanPhone);
        return;
      }

      const history = getChatHistory(cleanPhone).messages;
      const lastMsg = history.length > 0 ? history[history.length - 1] : null;
      // If the customer already replied or no AI message was sent yet, abort follow-up
      if (!lastMsg || (lastMsg.sender !== 'ai' && lastMsg.sender !== 'agent')) {
        inactivityFollowUpCount.delete(cleanPhone);
        return;
      }

      inactivityFollowUpCount.set(cleanPhone, attemptNumber);

      const rawName = String(matchedOrder.nombre || '').trim();
      const firstName = getNaturalFirstName(rawName);
      const displayFirstName = firstName && firstName !== 'qué tal' ? firstName : 'cliente';
      const genderInfo = detectCustomerGender(rawName);
      const ocupadoWord = (genderInfo.gender as string) === 'female' || genderInfo.gender === 'femenino' ? 'ocupada' : 'ocupado';
      const shortProduct = getNaturalProductName(matchedOrder.producto);

      let pendingQuestionSummary = 'si tenías un minutito para confirmar los datos de envío de tu pedido';
      if (currentStep === 2) {
        pendingQuestionSummary = 'si tu nombre y este número de celular estaban bien registrados';
      } else if (currentStep === 3) {
        pendingQuestionSummary = 'si la dirección y el mapa que te pasé acá arriba en el chat estaban correctos';
      } else if (currentStep === 4) {
        pendingQuestionSummary = 'cómo es la fachada de tu casa o qué color de portón tenés para que el repartidor te ubique rápido';
      }

      const previousAiFollowUps = history
        .filter(m => m.sender === 'ai' || m.sender === 'agent')
        .slice(-4)
        .map(m => String(m.text || '').trim())
        .filter(Boolean);

      const hoursElapsed = Math.max(1, attemptNumber - 1);
      const timingContext =
        attemptNumber === 1
          ? `Pasó 1 MINUTO desde que le hiciste la consulta a ${displayFirstName} (Paso ${currentStep}/5: ${pendingQuestionSummary}) y dejó de escribir.
Instrucciones para este recordatorio de 1 minuto:
- Llamalo/a con mucha amabilidad por su nombre (${displayFirstName}).
- Decile con total empatía y educación empresarial que comprendés que tal vez estaría ${ocupadoWord} o en su trabajo en este momento y que lamentás mucho molestarle realmente, pero que para nosotros es muy importante recibir esta información para dar como confirmado el envío de su ${shortProduct}.
- Preguntale con calidez: "¿Será posible que me vuelvas a escribir por acá cuando tengas un tiempito libre? Así completamos."
- PROHIBIDO decirle "decime a qué hora te llamo" o "avisame a qué hora te vuelvo a escribir" (nosotros NO lo vamos a llamar a una hora fija, lo esperamos a que él/ella nos vuelva a escribir cuando tenga tiempo).`
          : `Ya ${hoursElapsed === 1 ? 'pasó 1 HORA' : `pasaron ${hoursElapsed} HORAS consecutivas`} sin respuesta de ${displayFirstName} (Seguimiento horario #${hoursElapsed} en el Paso ${currentStep}/5: pendiente ${pendingQuestionSummary}).
Instrucciones para este seguimiento de ${hoursElapsed} hora(s):
- Llamalo/a con mucha educación, empatía y tono empresarial/profesional por su nombre (${displayFirstName}).
- Explicále con palabras totalmente nuevas y diferentes que ya ${hoursElapsed === 1 ? 'pasó una hora' : `pasaron ${hoursElapsed} horas`} que estuvimos esperando atentos en el sector de despacho porque tenemos su caja de ${shortProduct} abierta lista para cerrar y precintar antes de que salga el móvil de reparto hacia su zona.
- Pedile con mucha amabilidad y respeto que apenas tenga un momento libre en su trabajo o actividades nos vuelva a escribir por acá para cerrar su caja y despachar su producto.
- PROHIBIDO decirle "decime a qué hora te llamo" o "avisame a qué hora te escribo".`;

      const followUpPrompt = `Sos un ejecutivo humano real de logística y confirmación de envíos de Noelux en Paraguay. Tu trato es sumamente amable, empático, muy educado, pero a la vez muy profesional y empresarial. Hablás español paraguayo culto y cálido (usás "vos", "tenés", "podés").
REGLA DE GÉNERO: ${genderInfo.instruccionGenero}
${timingContext}
REGLA ANTI-REPETICIÓN INQUEBRANTABLE:
- Estas fueron tus intervenciones anteriores en el chat (ESTÁ PROHIBIDO repetir las mismas frases o estructura):
${previousAiFollowUps.map((t, idx) => `  [${idx + 1}] "${t}"`).join('\n')}
- Generá un mensaje hablado fluido de 2 a 3 oraciones (SIN emojis, SIN asteriscos, SIN pronunciar nombres de calles ni ciudades).`;

      let followUpText = buildCorporateInactivityFollowUpFallback(
        displayFirstName,
        genderInfo.gender === 'femenino' ? 'female' : genderInfo.gender === 'masculino' ? 'male' : 'neutral',
        currentStep,
        attemptNumber,
        shortProduct
      );

      followUpText = normalizeParaguayanPhonesInText(followUpText);

      // En seguimiento por inactividad (3 minutos y luego cada 1 hora): 100% Audio, CERO imágenes adicionales
      await sendWhatsAppVoiceCallTurn(
        cleanPhone,
        followUpText,
        currentStep,
        matchedOrder.reservaid,
        preferredSessionId,
        'audio',
        undefined,
        undefined,
        true // isFollowUpTurn: we schedule the next hourly attempt explicitly below
      );

      // Schedule the next consecutive 1-hour follow-up until the customer responds
      scheduleCustomerInactivityFollowUp(
        cleanPhone,
        matchedOrder.reservaid,
        preferredSessionId,
        attemptNumber + 1
      );
    } catch (err) {
      console.error(`[Inactivity FollowUp Attempt #${attemptNumber} Error]:`, err);
    }
  }, delayMs);

  customerInactivityTimers.set(cleanPhone, timer);
}

// Trigger AI Text Mode ("💬 Texto") immediately when Admin clicks "💬 Texto" or when autoChatOnOrder triggers in 'texto' mode
export async function triggerAiConfirmationForOrder(
  phone: string,
  orderId?: string,
  forceRestart = false
) {
  const cleanPhone = normalizeWaPhone(phone);
  const storage = loadChatsStorage();
  storage.customerChannels[cleanPhone] = 'texto';
  storage.chatModes[cleanPhone] = 'automatico';
  storage.callModes[cleanPhone] = 'manual';
  saveChatsStorage(storage);

  const pedidos = loadPedidos();
  const matchedOrder =
    (orderId && pedidos.find(p => p.reservaid === orderId)) ||
    findActiveOrderForPhone(cleanPhone) ||
    null;

  if (!matchedOrder || !isOfficialRegisteredProductOrder(matchedOrder)) {
    console.warn(`[Muro Estricto] Se bloqueó triggerAiConfirmationForOrder para ${cleanPhone} (no es cliente oficial registrado).`);
    return;
  }

  const history = getChatHistory(cleanPhone).messages;
  const lastMsg = history.length > 0 ? history[history.length - 1] : null;

  // 1. If the last message in the chat was from the client and not forceRestart, reply in AUDIO and advance the conversation
  if (!forceRestart && lastMsg && lastMsg.sender === 'client') {
    const {
      reply,
      secondaryAudioReply,
      locationTextConfirmation,
      convStep
    } = await generateSmartAiReply(
      cleanPhone,
      lastMsg.text,
      Boolean(lastMsg.isAudioNote || String(lastMsg.text || '').startsWith('🎤'))
    );
    if (reply) {
      if (matchedOrder) {
        matchedOrder.modoIA = 'automatico';
        matchedOrder.canalIA = 'audio';
        matchedOrder.convStep = convStep;
        matchedOrder.atendidoPorIA = true;
        matchedOrder.ultimoMensajeIA = reply;
        savePedidos(pedidos);
      }
      await sendWhatsAppVoiceCallTurn(
        cleanPhone,
        reply,
        convStep,
        matchedOrder?.reservaid,
        undefined,
        'audio',
        undefined,
        locationTextConfirmation,
        false,
        secondaryAudioReply
      );
      return;
    }
  }

  // 2. Iniciar confirmación Express con Imagen Única + Audio #1 + Tarjeta de Ciudad/Barrio/GPS en Texto
  const { text: initialText, locationTextConfirmation: initialLocCard, error: initError } =
    await buildInitialOrderAiMessage(matchedOrder);
  if (initError) {
    console.warn('[AI Init Notice]', initError);
    appendChatMessage(cleanPhone, {
      id: `err-${Date.now()}`,
      sender: 'agent',
      senderName: 'Sistema',
      text: initError,
      status: 'error'
    });
    if (!initialText) {
      return;
    }
  }
  if (matchedOrder) {
    matchedOrder.modoIA = 'automatico';
    matchedOrder.canalIA = 'audio';
    matchedOrder.convStep = 3;
    matchedOrder.locationTextSentOnce = true;
    matchedOrder.atendidoPorIA = true;
    matchedOrder.ultimoMensajeIA = initialText;
    if (forceRestart) {
      matchedOrder.waCommercialSentStages = {};
    }
    savePedidos(pedidos);
    syncOrderUpdateToCloud(matchedOrder).catch(() => { });
  }
  setOrderConvStep(cleanPhone, matchedOrder, 3);
  await sendWhatsAppVoiceCallTurn(
    cleanPhone,
    initialText,
    3,
    matchedOrder?.reservaid,
    undefined,
    'audio',
    undefined,
    initialLocCard,
    false,
    undefined,
    'stage1_welcome',
    Boolean(forceRestart)
  );
}

// Memoria anti-duplicado de audios consecutivos por teléfono para impedir que se envíen 2 notas de voz iguales seguidas
const recentAiSpokenTurnByPhone = new Map<string, { text: string; sentAt: number }>();

// Send a Voice Note ('audio') via Deepgram Aura-2 + OGG/Opus PTT or text fallback,
// plus an optional companion TEXT message for street, neighborhood & city confirmation,
// plus an optional secondary voice note (e.g. Second Audio offering the 30.000 guaraníes promo right after confirming)
export async function sendWhatsAppVoiceCallTurn(
  phone: string,
  spokenTextRaw: string | any,
  convStep: number,
  orderId?: string,
  preferredSessionId?: string,
  channel: AgentChannel = 'audio',
  voiceIdOverride?: string,
  locationTextConfirmation?: string,
  isFollowUpTurn = false,
  secondaryAudioText?: string,
  companionCommercialStage?: WaCommercialStageId,
  forceRegenerateCommercial = false
): Promise<{
  sentViaSocket: boolean;
  message: WaChatMessage;
  audioDataUrl: string | null;
  convStep: number;
  voiceEngine: string;
  callRung?: boolean;
}> {
  const cleanPhone = normalizeWaPhone(phone);
  const spokenText = (
    typeof spokenTextRaw === 'string'
      ? spokenTextRaw
      : spokenTextRaw && typeof spokenTextRaw === 'object' && spokenTextRaw.text
        ? String(spokenTextRaw.text)
        : String(spokenTextRaw || '')
  )
    .replace(/\bde el\b/gi, m => (m[0] === 'D' ? 'Del' : 'del'))
    .replace(/\ba el\b/gi, m => (m[0] === 'A' ? 'Al' : 'al'));
  const cleanLocationText = typeof locationTextConfirmation === 'string' ? locationTextConfirmation.trim() : '';

  const pedidosCheck = loadPedidos();
  const officialOrderCheck =
    (orderId && pedidosCheck.find(p => p.reservaid === orderId)) ||
    findActiveOrderForPhone(cleanPhone) ||
    null;
  if (!officialOrderCheck || !isOfficialRegisteredProductOrder(officialOrderCheck)) {
    console.warn(`[Muro Estricto] Se bloqueó sendWhatsAppVoiceCallTurn para ${cleanPhone} (no es cliente oficial registrado).`);
    return {
      sentViaSocket: false,
      message: {} as WaChatMessage,
      audioDataUrl: null,
      convStep,
      voiceEngine: 'Bloqueado (No es cliente oficial)',
      callRung: false
    };
  }

  // Guardia estricta anti-audios duplicados consecutivos (< 180s con similitud >= 85%)
  const prevAudio = recentAiSpokenTurnByPhone.get(cleanPhone);
  if (
    prevAudio &&
    Date.now() - prevAudio.sentAt < 180_000 &&
    calculateNormalizedSentenceSimilarity(spokenText, prevAudio.text) >= 0.85
  ) {
    console.warn(`[Anti-Duplicate Audio Guard] Se bloqueó envío de audio repetido consecutivo para ${cleanPhone}.`);
    const existingHist = getChatHistory(cleanPhone).messages;
    return {
      sentViaSocket: false,
      message: existingHist[existingHist.length - 1] || ({} as WaChatMessage),
      audioDataUrl: null,
      convStep,
      voiceEngine: 'Anti-duplicado activo',
      callRung: false
    };
  }
  recentAiSpokenTurnByPhone.set(cleanPhone, { text: spokenText, sentAt: Date.now() });
  activeAiOutboundLockByPhone.set(cleanPhone, Date.now() + 90_000);

  const ordKey = String(officialOrderCheck?.reservaid || orderId || '').trim();
  if (forceRegenerateCommercial && ordKey) {
    if (companionCommercialStage === 'stage1_welcome') sentWelcomeStageByOrderId.delete(ordKey);
    if (companionCommercialStage === 'stage3_confirmed') sentConfirmedStageByOrderId.delete(ordKey);
  }

  // Determinar si este turno lleva una imagen personalizada asociada que DEBE esperar a que el Audio salga primero:
  // - 'stage1_welcome': Bienvenida / Confirmación inicial (1s después del Audio #1)
  // - 'stage3_confirmed': Pedido Confirmado con Felicidades y aviso de Courier 48-72 hs (1s después del Audio de Confirmación)
  let effectiveCommercialStage: WaCommercialStageId | undefined =
    companionCommercialStage ||
    (!isFollowUpTurn &&
    convStep >= 5 &&
    officialOrderCheck?.datosConfirmados &&
    !officialOrderCheck?.waCommercialSentStages?.stage3_confirmed &&
    (!ordKey || !sentConfirmedStageByOrderId.has(ordKey))
      ? 'stage3_confirmed'
      : undefined);

  if (
    effectiveCommercialStage === 'stage1_welcome' &&
    !forceRegenerateCommercial &&
    ((ordKey && sentWelcomeStageByOrderId.has(ordKey)) ||
      officialOrderCheck?.waCommercialSentStages?.stage1_welcome)
  ) {
    effectiveCommercialStage = undefined;
  }
  if (
    effectiveCommercialStage === 'stage3_confirmed' &&
    (!officialOrderCheck?.datosConfirmados ||
      (!forceRegenerateCommercial &&
        ((ordKey && sentConfirmedStageByOrderId.has(ordKey)) ||
          officialOrderCheck?.waCommercialSentStages?.stage3_confirmed)))
  ) {
    effectiveCommercialStage = undefined;
  }

  let resolvedVoiceId = voiceIdOverride;
  if (!resolvedVoiceId) {
    try {
      resolvedVoiceId = getVoiceProfileForOrder(officialOrderCheck).id;
    } catch (e) { }
  }
  const activeSession = pickConnectedSession(preferredSessionId);
  const preResolvedJid = activeSession?.sock ? resolveOutboundWhatsAppJid(cleanPhone) : '';
  let recordingHeartbeat: ReturnType<typeof setInterval> | null = null;
  if (activeSession?.sock && preResolvedJid) {
    const presenceType = channel === 'audio' ? 'recording' : 'composing';
    activeSession.sock.sendPresenceUpdate(presenceType, preResolvedJid).catch(() => {});
    if (effectiveCommercialStage) {
      recordingHeartbeat = setInterval(() => {
        activeSession.sock?.sendPresenceUpdate(presenceType, preResolvedJid).catch(() => {});
      }, 8000);
    }
  }

  let tts: Awaited<ReturnType<typeof synthesizeSpeechSelfHosted>>;
  let preGeneratedCommercial: RenderPersonalizedOrderWelcomeResult | null = null;
  try {
    [tts, preGeneratedCommercial] = await Promise.all([
      synthesizeSpeechSelfHosted(spokenText, resolvedVoiceId),
      effectiveCommercialStage
        ? preGenerateStageCommercialForOrder(
            cleanPhone,
            officialOrderCheck,
            effectiveCommercialStage,
            forceRegenerateCommercial
          )
        : Promise.resolve(null),
      activeSession?.sock
        ? cacheRecipientLidMapping(activeSession, cleanPhone, orderId).catch(() => {})
        : Promise.resolve()
    ]);

    if (channel === 'audio' && !tts.audioBuffer) {
      await new Promise(resolve => setTimeout(resolve, 750));
      tts = await synthesizeSpeechSelfHosted(spokenText, resolvedVoiceId);
    }
  } finally {
    if (recordingHeartbeat) {
      clearInterval(recordingHeartbeat);
      recordingHeartbeat = null;
    }
  }

  // Actualizar el timestamp anti-duplicados y el bloqueo de eco saliente DESPUÉS de que terminó la generación
  recentAiSpokenTurnByPhone.set(cleanPhone, { text: spokenText, sentAt: Date.now() });
  activeAiOutboundLockByPhone.set(cleanPhone, Date.now() + 15_000);

  if (activeSession && activeSession.sock) {
    const jid = preResolvedJid || resolveOutboundWhatsAppJid(cleanPhone);

    const preMsgId = generateMessageIDV2(activeSession.sock.user?.id);
    recentlySentMsgIds.add(preMsgId);
    setTimeout(() => recentlySentMsgIds.delete(preMsgId), 60000);
    let msgId = preMsgId;
    let anySent = false;

    // 1. PRIMERO SIEMPRE EL AUDIO: enviar la nota de voz PTT OGG/Opus antes de autorizar cualquier imagen
    if (channel === 'audio' && tts.audioBuffer) {
      try {
        await activeSession.sock.sendPresenceUpdate('recording', jid).catch(() => {});
        const sentAudio = await activeSession.sock.sendMessage(
          jid,
          {
            audio: tts.audioBuffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            seconds: tts.durationSeconds,
            waveform: tts.waveform
          } as any,
          { messageId: preMsgId }
        );
        if (sentAudio?.key?.id) {
          msgId = sentAudio.key.id;
          anySent = true;
          recentlySentMsgIds.add(msgId);
          setTimeout(() => recentlySentMsgIds.delete(msgId), 60000);
          recordSentProtoMessage(msgId, sentAudio.message);
        }
        recentOutboundByPhone.set(cleanPhone, { orderId, sentAt: Date.now(), sessionId: activeSession.id });
        activeAiOutboundLockByPhone.set(cleanPhone, Date.now() + 12_000);
        cacheRecipientLidMapping(activeSession, cleanPhone, orderId).catch(() => {});
      } catch (audioErr: any) {
        console.error('[Deepgram OGG/Opus PTT Send Error]:', audioErr);
        recordIncomingDiagnostic({
          remoteJid: jid,
          resolvedPhone: cleanPhone,
          hasMessage: false,
          status: `outbound_audio_error:${String(audioErr?.message || audioErr).slice(0, 80)}`
        });
      }
    }

    // 2. Si no se pudo enviar como audio (o si el canal es texto), enviar en texto para garantizar que el cliente jamás quede en silencio
    if (!anySent) {
      try {
        const textPayload = cleanLocationText ? `${spokenText}\n\n${cleanLocationText}` : spokenText;
        const sentText = await activeSession.sock.sendMessage(
          jid,
          { text: textPayload },
          { messageId: preMsgId }
        );
        if (sentText?.key?.id) {
          msgId = sentText.key.id;
          anySent = true;
          recentlySentMsgIds.add(sentText.key.id);
          setTimeout(() => recentlySentMsgIds.delete(sentText.key.id!), 60000);
          recordSentProtoMessage(sentText.key.id, sentText.message);
        }
        recentOutboundByPhone.set(cleanPhone, { orderId, sentAt: Date.now(), sessionId: activeSession.id });
        activeAiOutboundLockByPhone.set(cleanPhone, Date.now() + 12_000);
        cacheRecipientLidMapping(activeSession, cleanPhone, orderId).catch(() => {});
      } catch (textErr: any) {
        console.error('[Voice Note Fallback Text Error]:', textErr);
        recordIncomingDiagnostic({
          remoteJid: jid,
          resolvedPhone: cleanPhone,
          hasMessage: false,
          status: `outbound_text_error:${String(textErr?.message || textErr).slice(0, 80)}`
        });
      }
    }

    if (anySent) {
      const senderLabel =
        channel === 'audio' && tts.audioBuffer
          ? `🎤 ${tts.voiceProfile.name} · Nota de Voz (Paso ${convStep}/5)`
          : `🤖 Agente IA (Paso ${convStep}/5)`;

      const savedMsg = appendChatMessage(cleanPhone, {
        id: msgId,
        sender: 'ai',
        senderName: senderLabel,
        text: spokenText,
        status: 'sent',
        orderId,
        sessionId: activeSession.id,
        isVoiceCall: false,
        isAudioNote: channel === 'audio',
        agentChannel: channel,
        convStep,
        voiceEngine: tts.engine,
        audioDataUrl: tts.audioDataUrl || undefined
      });

      // 3. COMPUERTA ESTRICTA AUDIO-PRIMERO:
      // Una vez enviado el audio por el agente, se autoriza automáticamente en tiempo real la imagen
      // exactamente 1 segundo (1000ms) después de que salió el audio.
      if (effectiveCommercialStage) {
        activeAiOutboundLockByPhone.set(cleanPhone, Date.now() + 15_000);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await dispatchStageCommercialForOrderIfNeeded(
          cleanPhone,
          officialOrderCheck,
          effectiveCommercialStage,
          activeSession.id,
          forceRegenerateCommercial,
          preGeneratedCommercial
        );
        activeAiOutboundLockByPhone.set(cleanPhone, Date.now() + 10_000);

        // Si acabamos de enviar la Imagen #1 de Bienvenida (stage1_welcome), pre-renderizar en segundo plano
        // en disco la Imagen Final de Pedido Confirmado (stage3_confirmed) SIN enviarla, para que apenas el cliente
        // responda "CORRECTO" la imagen ya esté lista en caché y el turno de confirmación salga al instante.
        if (effectiveCommercialStage === 'stage1_welcome' && officialOrderCheck) {
          setImmediate(() => {
            const matchedProductBg = resolveMatchedProductPageForOrder(officialOrderCheck);
            renderPersonalizedOrderConfirmedImage({
              order: officialOrderCheck,
              product: matchedProductBg,
              openRouterApiKey: getOpenRouterApiKey(),
              openRouterImageModel: getOpenRouterImageModel(),
              appReferer:
                process.env.APP_URL ||
                process.env.PUBLIC_URL ||
                'https://noelux.app',
              forceRegenerate: false
            }).catch(() => {});
          });
        }
      }

      // 4. Si este turno incluye tarjeta en TEXTO (Ciudad/Barrio/GPS inicial), enviarla tras breve pausa
      if (channel === 'audio' && cleanLocationText) {
        await new Promise(resolve => setTimeout(resolve, 650));
        try {
          if (activeSession.sock) {
            await activeSession.sock.sendPresenceUpdate('paused', jid).catch(() => {});
          }
          await sendWhatsAppMessage(
            cleanPhone,
            cleanLocationText,
            'ai',
            orderId,
            activeSession.id
          );
        } catch (locErr) {
          console.error('[Location Text Companion Error]:', locErr);
        }
      }

      // 5. Si este turno tiene un SEGUNDO AUDIO consecutivo distinto, enviarlo sin ninguna imagen de promoción
      const cleanSecondaryAudio = typeof secondaryAudioText === 'string' ? secondaryAudioText.trim() : '';
      if (cleanSecondaryAudio) {
        await new Promise(resolve => setTimeout(resolve, 850));
        await sendWhatsAppVoiceCallTurn(
          cleanPhone,
          cleanSecondaryAudio,
          convStep,
          orderId,
          activeSession.id,
          'audio',
          resolvedVoiceId,
          undefined,
          true
        );
      }

      if (!isFollowUpTurn && convStep < 5) {
        scheduleCustomerInactivityFollowUp(cleanPhone, orderId, activeSession.id);
      } else if (convStep >= 5) {
        cancelCustomerInactivityFollowUp(cleanPhone);
      }

      scheduleCloudStateSync(true);
      return {
        sentViaSocket: true,
        message: savedMsg,
        audioDataUrl: tts.audioDataUrl,
        convStep,
        voiceEngine: tts.engine,
        callRung: false
      };
    }
  }

  const senderLabel =
    channel === 'audio'
      ? `🎤 Agente IA · Nota de Voz (Paso ${convStep}/5)`
      : `🤖 Agente IA (Paso ${convStep}/5)`;

  const savedMsg = appendChatMessage(cleanPhone, {
    sender: 'ai',
    senderName: senderLabel,
    text: spokenText,
    status: 'pending_connection',
    orderId,
    isVoiceCall: false,
    isAudioNote: channel === 'audio',
    agentChannel: channel,
    convStep,
    voiceEngine: tts.engine,
    audioDataUrl: tts.audioDataUrl || undefined
  });

  // Si la sesión estaba desconectada, encolar la imagen DESPUÉS del audio para que al reconectar salga siempre Audio -> 1s -> Imagen
  if (effectiveCommercialStage) {
    await dispatchStageCommercialForOrderIfNeeded(
      cleanPhone,
      officialOrderCheck,
      effectiveCommercialStage,
      preferredSessionId,
      forceRegenerateCommercial,
      preGeneratedCommercial
    );
  }

  if (cleanLocationText) {
    appendChatMessage(cleanPhone, {
      sender: 'ai',
      senderName: '🤖 Agente IA · Datos en Texto',
      text: cleanLocationText,
      status: 'pending_connection',
      orderId,
      isVoiceCall: false,
      isAudioNote: false,
      agentChannel: 'texto',
      convStep
    });
  }

  const cleanSecondaryAudioOffline = typeof secondaryAudioText === 'string' ? secondaryAudioText.trim() : '';
  if (cleanSecondaryAudioOffline) {
    const tts2 = await synthesizeSpeechSelfHosted(cleanSecondaryAudioOffline, resolvedVoiceId);
    appendChatMessage(cleanPhone, {
      sender: 'ai',
      senderName: `🎤 ${tts2.voiceProfile.name} · Nota de Voz`,
      text: cleanSecondaryAudioOffline,
      status: 'pending_connection',
      orderId,
      isVoiceCall: false,
      isAudioNote: true,
      agentChannel: 'audio',
      convStep,
      voiceEngine: tts2.engine,
      audioDataUrl: tts2.audioDataUrl || undefined
    });
  }

  scheduleCloudStateSync(true);
  return {
    sentViaSocket: false,
    message: savedMsg,
    audioDataUrl: tts.audioDataUrl,
    convStep,
    voiceEngine: tts.engine,
    callRung: false
  };
}

const perPhoneVoiceTurnQueue = new Map<string, Promise<any>>();

// Start or Advance Step-by-Step Voice Note ('audio') (Paso 1 -> 2 -> 3 -> 4 -> 5)
export async function startOrAdvanceVoiceCall(
  phone: string,
  orderId?: string,
  customerSpokenText?: string,
  resetCall = false,
  channel: AgentChannel = 'audio',
  customSpokenText?: string
): Promise<{
  reply: string;
  audioDataUrl: string | null;
  convStep: number;
  voiceEngine: string;
  matchedOrder: any | null;
  message: WaChatMessage;
  sentViaSocket: boolean;
  channel: AgentChannel;
  callRung?: boolean;
}> {
  const cleanPhone = normalizeWaPhone(phone);
  const prevTask = perPhoneVoiceTurnQueue.get(cleanPhone) || Promise.resolve();
  const nextTask = prevTask
    .catch(() => {})
    .then(() =>
      executeStartOrAdvanceVoiceCallSerial(
        cleanPhone,
        orderId,
        customerSpokenText,
        resetCall,
        channel,
        customSpokenText
      )
    );
  perPhoneVoiceTurnQueue.set(cleanPhone, nextTask);
  try {
    return await nextTask;
  } finally {
    if (perPhoneVoiceTurnQueue.get(cleanPhone) === nextTask) {
      perPhoneVoiceTurnQueue.delete(cleanPhone);
    }
  }
}

async function executeStartOrAdvanceVoiceCallSerial(
  cleanPhone: string,
  orderId?: string,
  customerSpokenText?: string,
  resetCall = false,
  channel: AgentChannel = 'audio',
  customSpokenText?: string
): Promise<{
  reply: string;
  audioDataUrl: string | null;
  convStep: number;
  voiceEngine: string;
  matchedOrder: any | null;
  message: WaChatMessage;
  sentViaSocket: boolean;
  channel: AgentChannel;
  callRung?: boolean;
}> {
  const cleanChannel = normalizeChannel(channel);
  const pedidos = loadPedidos();
  const matchedOrder =
    (orderId && pedidos.find(p => p.reservaid === orderId)) ||
    findActiveOrderForPhone(cleanPhone) ||
    null;

  if (!matchedOrder || !isOfficialRegisteredProductOrder(matchedOrder)) {
    console.warn(`[Muro Estricto] Se bloqueó startOrAdvanceVoiceCall para ${cleanPhone} (no es cliente oficial registrado).`);
    return {
      reply: '',
      audioDataUrl: null,
      convStep: 1,
      voiceEngine: 'Bloqueado (No es cliente oficial)',
      matchedOrder: null,
      message: {} as WaChatMessage,
      sentViaSocket: false,
      channel: cleanChannel,
      callRung: false
    };
  }
  const activeVoice = getVoiceProfileForOrder(matchedOrder);

  if (matchedOrder) {
    matchedOrder.vozAgente = activeVoice.id;
    matchedOrder.vozAgenteNombre = activeVoice.name;
    savePedidos(pedidos);
  }

  const storage = loadChatsStorage();
  storage.customerChannels[cleanPhone] = cleanChannel;
  storage.callModes[cleanPhone] = 'automatico';
  storage.chatModes[cleanPhone] = 'automatico';
  saveChatsStorage(storage);

  // 0. If operator sent custom typed text to be spoken via Deepgram audio note
  if (customSpokenText && customSpokenText.trim()) {
    const textToSpeak = customSpokenText.trim();
    const currentStep = getOrderConvStep(cleanPhone, matchedOrder);
    if (matchedOrder) {
      matchedOrder.ultimoMensajeIA = textToSpeak;
      savePedidos(pedidos);
    }
    const turnRes = await sendWhatsAppVoiceCallTurn(
      cleanPhone,
      textToSpeak,
      currentStep,
      matchedOrder?.reservaid,
      undefined,
      cleanChannel
    );
    return {
      reply: textToSpeak,
      audioDataUrl: turnRes.audioDataUrl,
      convStep: currentStep,
      voiceEngine: turnRes.voiceEngine,
      matchedOrder,
      message: turnRes.message,
      sentViaSocket: turnRes.sentViaSocket,
      channel: cleanChannel,
      callRung: turnRes.callRung
    };
  }

  const history = getChatHistory(cleanPhone).messages;
  const ordIdStr = String(matchedOrder?.reservaid || orderId || '').trim();
  const anyVoiceOrAudioSent =
    Boolean(ordIdStr && sentWelcomeStageByOrderId.has(ordIdStr)) ||
    Boolean(matchedOrder?.waCommercialSentStages?.stage1_welcome) ||
    Boolean(matchedOrder?.atendidoPorIA && matchedOrder?.ultimoMensajeIA) ||
    history.some(
      m =>
        m.sender === 'ai' &&
        (m.isAudioNote || m.commercialStage === 'stage1_welcome') &&
        (m.status === 'sent' || m.status === 'pending_connection') &&
        (!orderId || m.orderId === orderId)
    );
  const lastMsg = history.length > 0 ? history[history.length - 1] : null;

  // 1. If customer spoke or replied during the voice note conversation
  if (customerSpokenText && customerSpokenText.trim()) {
    cancelCustomerInactivityFollowUp(cleanPhone);
    appendChatMessage(cleanPhone, {
      sender: 'client',
      senderName: matchedOrder?.nombre || 'Cliente',
      text: customerSpokenText.trim(),
      status: 'delivered',
      orderId: matchedOrder?.reservaid,
      isVoiceCall: false,
      isAudioNote: cleanChannel === 'audio',
      agentChannel: cleanChannel
    });

    const {
      reply,
      secondaryAudioReply,
      locationTextConfirmation,
      matchedOrder: updatedOrder,
      convStep
    } = await generateSmartAiReply(
      cleanPhone,
      customerSpokenText.trim(),
      cleanChannel === 'audio'
    );

    if (!reply) {
      return {
        reply: '',
        audioDataUrl: null,
        convStep,
        voiceEngine: activeVoice.name,
        matchedOrder: updatedOrder,
        message: history[history.length - 1] || ({} as WaChatMessage),
        sentViaSocket: false,
        channel: 'audio',
        callRung: false
      };
    }

    const turnRes = await sendWhatsAppVoiceCallTurn(
      cleanPhone,
      reply,
      convStep,
      updatedOrder?.reservaid,
      undefined,
      'audio',
      undefined,
      locationTextConfirmation,
      false,
      secondaryAudioReply
    );

    return {
      reply,
      audioDataUrl: turnRes.audioDataUrl,
      convStep,
      voiceEngine: turnRes.voiceEngine,
      matchedOrder: updatedOrder,
      message: turnRes.message,
      sentViaSocket: turnRes.sentViaSocket,
      channel: 'audio',
      callRung: turnRes.callRung
    };
  }

  // 2. If starting the call/audio for the first time or resetting -> Imagen Única del Pack + Audio #1 + Tarjeta de Ciudad/Barrio/GPS
  if (resetCall || !anyVoiceOrAudioSent) {
    const initRes = await buildInitialOrderAiMessage(matchedOrder);
    const initialSpoken = initRes?.text || 'Hola, ¿qué tal? Te hablo del área de envíos por tu pedido.';
    const initialLocCard = initRes?.locationTextConfirmation || '';
    if (matchedOrder) {
      matchedOrder.modoIA = 'automatico';
      matchedOrder.canalIA = 'audio';
      matchedOrder.vozAgente = activeVoice.id;
      matchedOrder.vozAgenteNombre = activeVoice.name;
      matchedOrder.convStep = 3;
      matchedOrder.locationTextSentOnce = true;
      matchedOrder.atendidoPorIA = true;
      matchedOrder.ultimoMensajeIA = initialSpoken;
      if (resetCall) {
        matchedOrder.datosConfirmados = false;
        matchedOrder.agenteCompletado = false;
        matchedOrder.postConfirmStrikes = 0;
        matchedOrder.postConfirmBlocked = false;
        matchedOrder.systemLocationConfirmedSent = false;
        matchedOrder.promoPagoAdelantadoStage = '';
        matchedOrder.pagoAdelantadoComprobanteRecibido = false;
        matchedOrder.pagoAdelantadoEstado = '';
        matchedOrder.waCommercialSentStages = {};
      }
      savePedidos(pedidos);
      syncOrderUpdateToCloud(matchedOrder).catch(() => { });
    }
    if (resetCall) {
      const stReset = loadChatsStorage();
      if (!stReset.postConfirmStrikes) stReset.postConfirmStrikes = {};
      if (!stReset.postConfirmBlocked) stReset.postConfirmBlocked = {};
      stReset.postConfirmStrikes[cleanPhone] = 0;
      stReset.postConfirmBlocked[cleanPhone] = false;
      saveChatsStorage(stReset);
      recentAiSpokenTurnByPhone.delete(cleanPhone);
    }
    setOrderConvStep(cleanPhone, matchedOrder, 3);

    const turnRes = await sendWhatsAppVoiceCallTurn(
      cleanPhone,
      initialSpoken,
      3,
      matchedOrder?.reservaid,
      undefined,
      'audio',
      undefined,
      initialLocCard,
      false,
      undefined,
      'stage1_welcome',
      Boolean(resetCall)
    );
    return {
      reply: initialSpoken,
      audioDataUrl: turnRes.audioDataUrl,
      convStep: 3,
      voiceEngine: turnRes.voiceEngine,
      matchedOrder,
      message: turnRes.message,
      sentViaSocket: turnRes.sentViaSocket,
      channel: 'audio',
      callRung: turnRes.callRung
    };
  }

  // 3. If the last message in history was from the client, advance and send voice note
  if (lastMsg && lastMsg.sender === 'client') {
    const {
      reply,
      secondaryAudioReply,
      locationTextConfirmation,
      matchedOrder: updatedOrder,
      convStep
    } = await generateSmartAiReply(
      cleanPhone,
      lastMsg.text,
      Boolean(lastMsg.isAudioNote || String(lastMsg.text || '').startsWith('🎤'))
    );
    if (!reply) {
      return {
        reply: '',
        audioDataUrl: null,
        convStep,
        voiceEngine: activeVoice.name,
        matchedOrder: updatedOrder,
        message: lastMsg,
        sentViaSocket: false,
        channel: 'audio',
        callRung: false
      };
    }
    const turnRes = await sendWhatsAppVoiceCallTurn(
      cleanPhone,
      reply,
      convStep,
      updatedOrder?.reservaid,
      undefined,
      'audio',
      undefined,
      locationTextConfirmation,
      false,
      secondaryAudioReply
    );
    return {
      reply,
      audioDataUrl: turnRes.audioDataUrl,
      convStep,
      voiceEngine: turnRes.voiceEngine,
      matchedOrder: updatedOrder,
      message: turnRes.message,
      sentViaSocket: turnRes.sentViaSocket,
      channel: 'audio',
      callRung: turnRes.callRung
    };
  }

  // 4. Si el Agente YA envió su audio inicial y el último mensaje sigue siendo del Agente (sin resetCall), NO repetir el saludo
  const currentStep = getOrderConvStep(cleanPhone, matchedOrder);
  const lastAiMsg = [...history].reverse().find(m => m.sender === 'ai' && !m.imageUrl);
  if (!resetCall && anyVoiceOrAudioSent && lastMsg?.sender === 'ai' && lastAiMsg) {
    return {
      reply: typeof lastAiMsg.text === 'string' ? lastAiMsg.text : '',
      audioDataUrl: lastAiMsg.audioDataUrl || null,
      convStep: currentStep,
      voiceEngine: lastAiMsg.voiceEngine || activeVoice.name,
      matchedOrder,
      message: lastAiMsg,
      sentViaSocket: lastAiMsg.status === 'sent',
      channel: 'audio',
      callRung: false
    };
  }

  const initFallback = currentStep <= 3 ? await buildInitialOrderAiMessage(matchedOrder) : null;
  const textToSpeak =
    initFallback?.text ||
    (typeof lastAiMsg?.text === 'string' ? lastAiMsg.text : 'Hola, ¿qué tal? ¿Cómo estás?');
  const companionCard =
    initFallback && !matchedOrder?.locationTextSentOnce ? initFallback.locationTextConfirmation : undefined;

  if (matchedOrder) {
    matchedOrder.modoIA = 'automatico';
    matchedOrder.canalIA = 'audio';
    matchedOrder.atendidoPorIA = true;
    matchedOrder.ultimoMensajeIA = textToSpeak;
    if (companionCard) matchedOrder.locationTextSentOnce = true;
    savePedidos(pedidos);
  }

  const turnRes = await sendWhatsAppVoiceCallTurn(
    cleanPhone,
    textToSpeak,
    currentStep,
    matchedOrder?.reservaid,
    undefined,
    'audio',
    undefined,
    companionCard,
    false,
    undefined,
    currentStep <= 3 && matchedOrder ? 'stage1_welcome' : undefined,
    false
  );

  return {
    reply: textToSpeak,
    audioDataUrl: turnRes.audioDataUrl,
    convStep: currentStep,
    voiceEngine: turnRes.voiceEngine,
    matchedOrder,
    message: turnRes.message,
    sentViaSocket: turnRes.sentViaSocket,
    channel: 'audio',
    callRung: turnRes.callRung
  };
}

export async function generateSmartAiReply(
  phone: string,
  incomingText: string,
  isFromAudio?: boolean
): Promise<{
  reply: string;
  secondaryAudioReply?: string;
  locationTextConfirmation?: string;
  matchedOrder: any | null;
  convStep: number;
  error?: string;
  forceAudioReply?: boolean;
}> {
  return generateContextualAiReply(phone, incomingText, isFromAudio);
}

// Strip any embedded [GPS: ...] or raw Google Maps URLs from the street/neighborhood string so two maps are NEVER shown
export function cleanStreetAddressText(rawAddress: string): string {
  if (!rawAddress) return 'Por confirmar';
  const cleaned = String(rawAddress)
    .replace(/\s*·?\s*\[GPS:\s*https?:\/\/[^\]]+\]/gi, '')
    .replace(/\s*https?:\/\/(?:www\.)?(?:google\.com\/maps\S+|maps\.google\.com\S+|maps\.app\.goo\.gl\/\S+|goo\.gl\/maps\/\S+|tinyurl\.com\/\S+|is\.gd\/\S+)/gi, '')
    .replace(/\s+·\s*$/g, '')
    .trim();
  return cleaned || 'Por confirmar';
}

// Extract the direct raw Google Maps URL from an order (prioritizing an explicit gpsLink when corrected by the customer)
export function extractCanonicalMapUrlFromOrder(order: any): string {
  if (!order) return '';
  if (
    order.mapaCorregidoPorCliente &&
    order.gpsLink &&
    String(order.gpsLink).trim().startsWith('http') &&
    !/tinyurl\.com|is\.gd/i.test(String(order.gpsLink))
  ) {
    return String(order.gpsLink).trim();
  }
  if (typeof order.gpsLat === 'number' && typeof order.gpsLng === 'number') {
    return `https://www.google.com/maps?q=${Number(order.gpsLat).toFixed(6)},${Number(order.gpsLng).toFixed(6)}`;
  }
  if (
    order.gpsLink &&
    String(order.gpsLink).trim().startsWith('http') &&
    !/tinyurl\.com|is\.gd/i.test(String(order.gpsLink))
  ) {
    return String(order.gpsLink).trim();
  }
  const embeddedMatch = String(order.direccion || '').match(
    /https?:\/\/(?:www\.)?(?:google\.com\/maps\S+|maps\.google\.com\S+|maps\.app\.goo\.gl\/\S+|goo\.gl\/maps\/\S+)/i
  );
  if (embeddedMatch) {
    return embeddedMatch[0].replace(/[\])]+$/, '').trim();
  }
  return '';
}

export function getPublicAppBaseUrl(order?: any): string {
  const fromOrder = String(order?.originUrl || '').trim().replace(/\/+$/, '');
  if (fromOrder && /^https?:\/\//i.test(fromOrder) && !/localhost/i.test(fromOrder)) {
    return fromOrder;
  }
  const fromEnv = String(process.env.APP_URL || process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) {
    return fromEnv;
  }
  return 'https://ais-pre-xkbo5ig6qtdnoqvylrohce-196392939008.us-east5.run.app';
}

// NOTA ARQUITECTÓNICA: Se eliminó al 100% la detección por palabras clave de mapa incorrecto.
// El cerebro semántico evalúa el significado completo de la oración en contexto (speechAct === 'MAP_PIN_REPORTED_WRONG').
export function isCustomerReportingWrongMap(_cleanInput: string): boolean {
  return false;
}

// Parse a new map URL or coordinates sent by the customer and overwrite the old wrong map on the order
export function applyNewMapUrlAndCoordinatesToOrder(
  order: any,
  rawInputText: string
): { updated: boolean; newMapUrl: string } {
  if (!order || !rawInputText) return { updated: false, newMapUrl: '' };
  const text = String(rawInputText).trim();

  const urlMatch = text.match(
    /https?:\/\/(?:www\.)?(?:google\.com\/maps\S+|maps\.google\.com\S+|maps\.app\.goo\.gl\/\S+|goo\.gl\/maps\/\S+)/i
  );

  // Also check if the user pasted raw coordinates like "-25.286700, -57.647000"
  const rawCoordsOnlyMatch = !urlMatch
    ? text.match(/(-2[0-9]\.\d{4,})\s*,\s*(-5[0-9]\.\d{4,})/)
    : null;

  if (!urlMatch && !rawCoordsOnlyMatch) {
    return { updated: false, newMapUrl: '' };
  }

  let extractedLat: number | null = null;
  let extractedLng: number | null = null;
  let finalMapUrl = '';

  if (rawCoordsOnlyMatch) {
    extractedLat = Number(rawCoordsOnlyMatch[1]);
    extractedLng = Number(rawCoordsOnlyMatch[2]);
    finalMapUrl = `https://www.google.com/maps?q=${extractedLat.toFixed(6)},${extractedLng.toFixed(6)}`;
  } else if (urlMatch) {
    const rawUrl = urlMatch[0].replace(/[.,;)\]]+$/, '').trim();
    // Try extracting lat,lng from ?q=lat,lng or @lat,lng or !3dlat!4dlng
    const qMatch =
      rawUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/i) ||
      rawUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/i) ||
      rawUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/i) ||
      rawUrl.match(/viewpoint=(-?\d+\.\d+),(-?\d+\.\d+)/i);

    if (qMatch) {
      const latNum = Number(qMatch[1]);
      const lngNum = Number(qMatch[2]);
      if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
        extractedLat = Number(latNum.toFixed(6));
        extractedLng = Number(lngNum.toFixed(6));
        finalMapUrl = `https://www.google.com/maps?q=${extractedLat.toFixed(6)},${extractedLng.toFixed(6)}`;
      }
    }
    if (!finalMapUrl) {
      finalMapUrl = rawUrl;
    }
  }

  if (!finalMapUrl) {
    return { updated: false, newMapUrl: '' };
  }

  // Overwrite old wrong map URL and coordinates on the order
  order.gpsLink = finalMapUrl;
  order.gpsConfirmado = true;
  order.mapaCorregidoPorCliente = true;
  order.awaitingMapCorrection = false;

  if (extractedLat !== null && extractedLng !== null) {
    order.gpsLat = extractedLat;
    order.gpsLng = extractedLng;
  } else {
    // If customer pasted a short link (maps.app.goo.gl) without embedded coords, clear old wrong coords so old coords never override new gpsLink
    delete order.gpsLat;
    delete order.gpsLng;
  }

  if (order.comparativaDatos && typeof order.comparativaDatos === 'object') {
    order.comparativaDatos.gpsLink = finalMapUrl;
    order.comparativaDatos.gpsConfirmado = true;
    if (extractedLat !== null && extractedLng !== null) {
      order.comparativaDatos.gpsLat = extractedLat;
      order.comparativaDatos.gpsLng = extractedLng;
    } else {
      delete order.comparativaDatos.gpsLat;
      delete order.comparativaDatos.gpsLng;
    }
  }

  return { updated: true, newMapUrl: finalMapUrl };
}

// Build the step-by-step interactive card with the exact same satellite locator button from the checkout form
export function buildMapCorrectionHelperCard(order: any): string {
  const isBuilding = isBuildingOrderServer(order);
  const placeLabel = isBuilding ? 'tu edificio' : 'tu casa';
  const baseUrl = getPublicAppBaseUrl(order);
  const reservaId = String(order?.reservaid || order?.id || 'pedido').trim();
  const locatorUrl = `${baseUrl}/?corregir-mapa=${encodeURIComponent(reservaId)}`;

  return [
    `📍 *BOTÓN LOCALIZADOR PARA CORREGIR EL MAPA DE ${placeLabel.toUpperCase()}*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `No hay ningún problema, vamos a reemplazar el mapa que estaba mal por la ubicación exacta de ${placeLabel}:`,
    ``,
    `🔘 *[ TOCÁ AQUÍ PARA ABRIR EL LOCALIZADOR DE ${placeLabel.toUpperCase()} ]* 👇`,
    `${locatorUrl}`,
    ``,
    `📝 *Instrucciones paso a paso (muy fácil):*`,
    `1️⃣ *Dale clic* al enlace de arriba para abrir el mismo botón localizador satelital del formulario.`,
    `2️⃣ *Tocá el botón para localizar ${placeLabel}* (podés mover el mapa con el dedo hasta que el pin quede exacto sobre tu techo).`,
    `3️⃣ *Dale clic en "Copiar y Confirmar mi Nuevo Mapa"* y *pegá acá en el chat la nueva URL* (o tocá "Enviar por WhatsApp" ahí mismo).`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `🗺️ *Opción alternativa (Google Maps directo):*`,
    `También podés abrir https://www.google.com/maps , mantener apretado con el dedo sobre ${placeLabel}, copiar el enlace y pegarlo acá en este chat.`
  ].join('\n');
}

// Ensure the order has the clean direct raw Google Maps URL and a clean street address without duplicate embedded links
export async function ensureShortMapLinkForOrder(order: any): Promise<string> {
  if (!order) return '';
  const canonicalUrl = extractCanonicalMapUrlFromOrder(order);
  if (order.gpsShortLink) {
    delete order.gpsShortLink;
  }
  if (!canonicalUrl) return '';

  if (!order.gpsLink || /tinyurl\.com|is\.gd/i.test(String(order.gpsLink))) {
    order.gpsLink = canonicalUrl;
  }
  if (order.direccion && /\[GPS:|google\.com\/maps|maps\.google\.com/i.test(String(order.direccion))) {
    order.direccion = cleanStreetAddressText(order.direccion);
  }

  return canonicalUrl;
}

// Build the TEXT confirmation block:
// - Step 3 (SENT ONLY ONCE IN TEXT): Very descriptive explanation of the city, neighborhood/street, and ONE single direct raw Google Maps link with guided instructions.
// - Step 4 & Step 5: Empty string '' (the confirmation that locations are marked in our computer system is spoken ONLY in voice by the agent).
export function buildLocationTextConfirmationMessage(
  order: any,
  step: number,
  _customText?: string,
  _houseReference?: string
): string {
  const city = String(order?.ciudad || '').trim() || 'Por confirmar';
  const dept = String(order?.departamento || '').trim();
  const cleanAddress = cleanStreetAddressText(order?.direccion || '');
  const isBuilding = isBuildingOrderServer(order);

  // En la confirmación al cliente NO exponemos enlaces ni URLs de GPS/mapa (el GPS permanece interno para Admin y Reparto)
  if (step === 3) {
    if (isBuilding) {
      const buildingName = String(order?.nombreEdificio || '').trim() || 'Por confirmar';
      const floor = String(order?.pisoEdificio || '').trim() || 'Por confirmar';
      const apt = String(order?.departamentoNumero || '').trim() || 'Por confirmar';
      const recepText =
        order?.detalleRecepcion ||
        (order?.tieneRecepcion === 'si_recepcionista'
          ? 'Sí tiene recepción (recibe la recepcionista / guardia)'
          : order?.tieneRecepcion === 'no_personalmente'
            ? 'Recibe personalmente en planta baja'
            : 'Por confirmar en recepción');

      return (
        `📋 *Estos son los datos de tu EDIFICIO registrados para entregar tu pedido:*\n\n` +
        `🏙️ *Ciudad:* ${city}${dept ? ` (${dept})` : ''}\n` +
        `🏢 *Nombre del Edificio:* ${buildingName}\n` +
        `🔢 *Piso y Departamento / Cuarto:* Piso ${floor} · Dpto./Cuarto ${apt}\n` +
        `🛣️ *Calle donde está el edificio:* ${cleanAddress}\n` +
        `🛎️ *Recepción del pedido:* ${recepText}\n\n` +
        `👉 *Por favor revisá bien estos datos de tu edificio y confirmame acá en el chat con la palabra "CORRECTO" para confirmar tu envío (o decime si querés corregir algún dato).*`
      );
    }

    return (
      `📋 *Estos son los datos de dirección registrados para entregar tu pedido:*\n\n` +
      `🏙️ *Ciudad:* ${city}${dept ? ` (${dept})` : ''}\n` +
      `🏘️ *Calle y barrio:* ${cleanAddress}\n\n` +
      `👉 *Por favor revisá bien estos datos y confirmame acá en el chat con la palabra "CORRECTO" para confirmar tu envío (o decime si querés corregir tu calle o barrio).*`
    );
  }

  return '';
}

// ============================================================================
// MOTOR SEMÁNTICO DE COMPRENSIÓN HUMANA Y CONTINUIDAD GLOBAL (0% PALABRAS CLAVE)
// ============================================================================

/**
 * Calcula la similitud léxica normalizada (Jaccard sobre palabras significativas)
 * entre dos respuestas del agente para impedir repeticiones robóticas turno tras turno.
 */
export function calculateNormalizedSentenceSimilarity(textA: string, textB: string): number {
  const tokenize = (s: string): Set<string> => {
    const norm = String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9ñ\s]/g, ' ');
    const tokens = norm
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length >= 3);
    return new Set(tokens);
  };
  const setA = tokenize(textA);
  const setB = tokenize(textB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const tok of setA) {
    if (setB.has(tok)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Inspección superficial de señal vacía/ruido y diagnóstico de canal (AUDIO vs TEXTO ESCRITO).
 * Deja pasar palabras cortas reales (1, 2, 3 o más palabras como "sí", "claro", "correcto", "está bien", "portón negro")
 * hacia el cerebro LLM para que evalúe su CONGRUENCIA real con la pregunta actual, bloqueando únicamente audios inaudibles,
 * signos sueltos ("?", "..") o ruidos vacíos ("eh", "mm").
 */
export function evaluateSurfaceSyntacticIntegrity(
  rawInput: string,
  isFromAudio = false,
  priorUnclearCount = 0
): {
  isFailedAudioSignal: boolean;
  isProtocolMediaPayload: boolean;
  lexicalWordCount: number;
  isSingleWordOrEmpty: boolean;
  isShortTypedFragment: boolean;
  channelLabel: string;
  channelDiagnosticPrompt: string;
} {
  const trimmed = String(rawInput || '')
    .replace(/^🎤\s*/, '')
    .trim();

  const isFailedAudioSignal =
    !trimmed ||
    /\[El cliente envi[oó] un audio que no se escuch[oó]|\[Nota de voz del cliente\]/i.test(trimmed);

  const isProtocolMediaPayload =
    /https?:\/\/\S+|maps\.google|google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|Ubicaci[oó]n GPS|COMPROBANTE_PAGO_ADELANTADO|📷 \[El cliente envi[oó] una foto/i.test(
      trimmed
    );

  // Extraer tokens léxicos reales (>= 2 letras/dígitos), descartando ruidos puros de vacilación ("eh", "mm", "hm") y signos sueltos
  const pureNoiseTokens = new Set(['eh', 'ehh', 'em', 'emm', 'mm', 'mmm', 'hm', 'hmm', 'uh', 'uhm', 'xq']);
  const cleanTokens = trimmed
    .replace(/https?:\/\/\S+/gi, ' ')
    .split(/\s+/)
    .map(tok => tok.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]/g, ''))
    .filter(tok => tok.length >= 2 && !pureNoiseTokens.has(tok.toLowerCase()));

  const lexicalWordCount = cleanTokens.length;
  const isSingleWordOrEmpty = !isProtocolMediaPayload && (isFailedAudioSignal || lexicalWordCount === 0);
  const isShortTypedFragment = !isFromAudio && !isProtocolMediaPayload && lexicalWordCount >= 1 && lexicalWordCount <= 3;

  const channelLabel = isFromAudio ? 'AUDIO DE VOZ HABLADO' : 'TEXTO ESCRITO POR TECLADO';

  const channelDiagnosticPrompt = isFromAudio
    ? `CANAL DEL MENSAJE ACTUAL: 🎤 NOTA DE VOZ / AUDIO HABLADO DEL CLIENTE (transcrito por Deepgram Nova-3).
- Comprendé con naturalidad tanto respuestas breves de 1, 2 o 3 palabras ("sí", "claro", "correcto", "está bien", "portón verde") como frases habladas largas, siempre que tengan sentido y sean congruentes con la pregunta actual.
- Únicamente repreguntá con calidez si lo que se escuchó carece de sentido o no tiene ninguna congruencia con lo conversado.`
    : `CANAL DEL MENSAJE ACTUAL: ⌨️ TEXTO ESCRITO POR EL CLIENTE (${lexicalWordCount} palabra/s comprensible/s).
- En WhatsApp es completamente normal responder en 1, 2 o 3 palabras (ej. "sí", "claro", "dale", "correcto", "está bien", "todo bien", "portón negro frente despensa", "recibe portería").
- Sé inteligente y natural: si esas 1, 2 o 3 palabras responden con sentido y CONGRUENCIA directa a la pregunta que le acabás de hacer, entendelas al instante y avanzá sin trabar al cliente.
- ÚNICAMENTE clasificá "INCOHERENT_TRUNCATED_OR_SINGLE_WORD" y repreguntá cuando lo que escribió NO tenga sentido o NO tenga congruencia con la pregunta actual (por ejemplo, responder solo "sí" cuando preguntaste cómo es la fachada de su casa, o escribir palabras desconectadas sin sentido)${
        priorUnclearCount >= 1
          ? ' (y si notás que le cuesta explicarse por escrito, podés ofrecerle con amabilidad que mande un audio cortito si prefiere)'
          : ''
      }.`;

  return {
    isFailedAudioSignal,
    isProtocolMediaPayload,
    lexicalWordCount,
    isSingleWordOrEmpty,
    isShortTypedFragment,
    channelLabel,
    channelDiagnosticPrompt
  };
}

interface FullChatNarrativeMemory {
  globalContextSummary: string;
  hasGpsConfirmed: boolean;
  verifiedHouseReference: string;
  lastAgentMessage: string;
  previousAgentMessages: string[];
  turnsInCurrentStep: number;
}

/**
 * Construye la memoria narrativa continua de principio a fin del chat y la coherencia del producto/pedido,
 * SIN ningún regex de palabras clave sobre los mensajes del cliente.
 */
function buildFullChatNarrativeMemory(
  cleanPhone: string,
  order: any,
  allPhoneOrders: any[],
  fullChatHistory: WaChatMessage[],
  latestCustomerInput: string,
  isLatestFromAudio = false
): FullChatNarrativeMemory {
  const isBuilding = isBuildingOrderServer(order);
  const buildingSummary = formatBuildingDetailsServer(order);
  const currentStep = getOrderConvStep(cleanPhone, order);

  const hasGpsConfirmed = Boolean(
    order?.gpsConfirmado ||
      order?.gpsLink ||
      (typeof order?.gpsLat === 'number' && typeof order?.gpsLng === 'number')
  );

  // SOLO se considera referencia verificada aquella que ya fue confirmada semánticamente y guardada en la orden (0% regex de colores/palabras sueltas)
  const verifiedHouseReference = String(order?.referenciaCasa || '').trim();

  const agentMessages: string[] = [];
  const timelineLines: string[] = [];

  const relevantHistory = fullChatHistory.slice(-40);
  for (let idx = 0; idx < relevantHistory.length; idx++) {
    const m = relevantHistory[idx];
    const rawTxt = String(m.text || '').trim();
    if (!rawTxt || m.status === 'error') continue;
    const cleanTxt = rawTxt.replace(/^🎤\s*/, '').trim();

    if (m.sender === 'client') {
      const msgWasAudio = Boolean(m.isAudioNote || rawTxt.startsWith('🎤'));
      timelineLines.push(
        `  [Turno #${timelineLines.length + 1} · CLIENTE vía ${msgWasAudio ? 'AUDIO HABLADO' : 'TEXTO ESCRITO'}]: "${cleanTxt}"`
      );
    } else if (m.sender === 'ai' || m.sender === 'admin' || m.sender === 'agent') {
      agentMessages.push(cleanTxt);
      timelineLines.push(`  [Turno #${timelineLines.length + 1} · AGENTE]: "${cleanTxt}"`);
    }
  }

  // Contar cuántos turnos lleva el cliente en el paso actual sin avanzar (para variar el ángulo humano y jamás repetir como robot)
  let turnsInCurrentStep = 0;
  for (let i = relevantHistory.length - 1; i >= 0; i--) {
    const m = relevantHistory[i];
    if (m.sender === 'ai' || m.sender === 'admin') {
      turnsInCurrentStep++;
      if (turnsInCurrentStep >= 6) break;
    }
  }

  const lastAgentMessage = agentMessages.length > 0 ? agentMessages[agentMessages.length - 1] : '';
  const previousAgentMessages = agentMessages.slice(-5);

  const previousOrdersSummary =
    allPhoneOrders.length > 1
      ? `Historial del número (${allPhoneOrders.length} pedidos registrados): ` +
        allPhoneOrders
          .slice(0, 4)
          .map(
            p =>
              `#${p.reservaid} (${p.producto || 'Noelux'}, ${p.cantidad || 1} un., estado: ${
                p.datosConfirmados ? 'CONFIRMADO' : `en paso ${p.convStep || 1}/5`
              })`
          )
          .join('; ')
      : `Pedido activo único: #${order?.reservaid || 'S/N'} (${order?.producto || 'Producto'}, ${order?.cantidad || 1} un.)`;

  const stepObjectiveMap: Record<number, string> = {
    1: 'Confirmación Express: verificar que la dirección, ciudad, barrio y mapa estén correctos (aceptando "sí", "correcto", "está bien").',
    2: 'Confirmación Express: verificar que la dirección, ciudad, barrio y mapa estén correctos (aceptando "sí", "correcto", "está bien").',
    3: isBuilding
      ? 'Confirmar que los datos de su edificio, piso, departamento, calle y mapa enviados en texto estén correctos (aceptando "sí", "correcto", "está bien", o asistiéndolo si indica un error).'
      : 'Confirmar que su ciudad, calle/barrio y mapa enviados en texto estén correctos (aceptando "sí", "correcto", "está bien", o asistiéndolo si indica un error).',
    4: 'Confirmación Express: verificar datos de dirección.',
    5: 'Pedido ya confirmado; atender dudas del producto/envío o acompañar con naturalidad en la promoción opcional de pago adelantado.'
  };

  const antiRepetitionDirective =
    turnsInCurrentStep <= 1
      ? 'Primer intercambio en este paso: respondé con frescura, naturalidad y calidez humana.'
      : turnsInCurrentStep === 2
        ? 'Segundo intercambio sobre este punto: ESTÁ PROHIBIDO repetir las mismas palabras ni la misma estructura de tu mensaje anterior. Reformulá con empatía genuina desde un ángulo nuevo y sencillo.'
        : `Intercambio #${turnsInCurrentStep} sin cerrar aún este paso: PROHIBIDO sonar mecánico o insistente. Cambiá completamente la forma de preguntar, explicále brevemente con cariño PARA QUÉ necesitamos ese dato para cuidar su entrega, y ofrecéle suavemente que puede mandarte un audio cortito si le resulta más práctico.`;

  const globalContextSummary = `MEMORIA NARRATIVA CONTINUA DEL CHAT (DE PRINCIPIO A FIN) Y ESTADO REAL DE LA ORDEN:
- ${previousOrdersSummary}
- Tipo de vivienda registrada: ${
    isBuilding
      ? `🏢 EDIFICIO DE DEPARTAMENTOS (${buildingSummary || 'Datos de edificio en formulario'})`
      : '🏠 CASA INDEPENDIENTE'
  }
- Paso actual de confirmación: PASO ${currentStep} de 5
- Objetivo exacto pendiente en este PASO ${currentStep}: ${stepObjectiveMap[currentStep] || stepObjectiveMap[1]}
- Última pregunta/intervención exacta que vos (el AGENTE) le hiciste al cliente:
  "${lastAgentMessage || '(Saludo inicial de contacto)'}"
- Directriz humana anti-repetición para este turno: ${antiRepetitionDirective}
- Hechos verificados hasta este instante:
  * Disponibilidad inicial (Paso 1): ${currentStep >= 2 ? 'VERIFICADA' : 'PENDIENTE DE RESPUESTA CONGRUENTE'}
  * Nombre y Teléfono (Paso 2): ${currentStep >= 3 ? `CONFIRMADOS (${order?.nombre || ''} / ${cleanPhone})` : 'PENDIENTE DE CONFIRMACIÓN'}
  * Dirección y Mapa en texto (Paso 3): ${
    currentStep >= 4
      ? `CONFIRMADOS (${order?.ciudad || ''} - ${cleanStreetAddressText(order?.direccion || '')})`
      : order?.locationTextSentOnce
        ? 'TARJETA DE DIRECCIÓN YA ENVIADA EN EL CHAT — AGUARDANDO CONFIRMACIÓN CONGRUENTE DEL CLIENTE'
        : 'AÚN NO ENVIADA'
  }
  * Mapa GPS registrado: ${hasGpsConfirmed ? `SÍ (${extractCanonicalMapUrlFromOrder(order) || 'Coordenadas GPS'})` : 'Sin pin GPS aún'}
  * Referencia de ${isBuilding ? 'recepción/edificio' : 'fachada/portón'} (Paso 4): ${
    verifiedHouseReference ? `CONFIRMADA ("${verifiedHouseReference}")` : 'PENDIENTE DE DESCRIPCIÓN CONGRUENTE'
  }
- Hilo cronológico previo de la conversación:
${timelineLines.length > 0 ? timelineLines.join('\n') : '  (Inicio de la conversación)'}
- Último mensaje entrante del cliente a analizar ahora (${isLatestFromAudio ? 'AUDIO HABLADO' : 'TEXTO ESCRITO'}): "${latestCustomerInput}"`;

  return {
    globalContextSummary,
    hasGpsConfirmed,
    verifiedHouseReference,
    lastAgentMessage,
    previousAgentMessages,
    turnsInCurrentStep
  };
}

// Build the system prompt for the LLM with full product/order context and smart human congruence comprehension
function buildLLMSystemPrompt(
  order: any,
  productKnowledge: string,
  currentStep: number,
  narrativeMemory?: FullChatNarrativeMemory,
  channelDiagnosticPrompt = ''
): string {
  const rawName = String(order?.nombre || '').trim();
  const firstName = getNaturalFirstName(rawName);
  const genderInfo = detectCustomerGender(rawName);
  const shortProduct = getNaturalProductName(order?.producto);
  const city = order?.ciudad || 'su ciudad';
  const dept = order?.departamento || '';
  const address = cleanStreetAddressText(order?.direccion || '') || 'dirección no registrada';
  const phone = formatPhoneForSpeech(order?.celular || '');
  const monto = order ? formatGsServer(order.monto) : '';
  const pack = order?.cantidad || order?.pack || 1;
  const isBuilding = isBuildingOrderServer(order);
  const buildingDetails = formatBuildingDetailsServer(order);
  const referenciaCasa =
    order?.referenciaCasa || narrativeMemory?.verifiedHouseReference || buildingDetails || '';
  const gpsUrl = extractCanonicalMapUrlFromOrder(order);
  const targetNextStep = Math.min(5, currentStep + 1);

  const rawMontoNum = Number(String(order?.monto || '189000').replace(/\D/g, '')) || 189000;
  const discountedMontoNum = Math.max(50000, rawMontoNum - VIP_PREPAYMENT_DISCOUNT_GS);
  const montoOriginalFormatted = formatGuaraniesSpeech(rawMontoNum);
  const montoDescuentoFormatted = formatGuaraniesSpeech(discountedMontoNum);

  const prevAgentBlock =
    narrativeMemory && narrativeMemory.previousAgentMessages.length > 0
      ? narrativeMemory.previousAgentMessages
          .map((m, idx) => `  - Tu intervención previa #${idx + 1}: "${m}"`)
          .join('\n')
      : '  - (Sin intervenciones previas)';

  const step3To5Instructions = `CONFIRMACIÓN EXPRESS (FLUJO SIMPLIFICADO):
  PASO 1 (Ya realizado): Se envió Imagen #1 personalizada generada dinámicamente con el nombre completo, celular, ciudad, barrio/dirección, pack y monto total (SIN GPS) + Audio #1 pidiendo revisar la imagen.
  PASO 2 (Cuando confirme): El sistema envía automáticamente la imagen estática universal de la promo (-30.000 Gs) + Audio de la oferta de pago anticipado.
  PASO 3 (Cierre): El cliente elige pagar adelantado o contra entrega.
  
  REGLA ABSOLUTA SOBRE DIRECCIÓN Y DATOS DE ENTREGA:
  - En "reply" (AUDIO) ESTÁ PROHIBIDO pronunciar calle, barrio, ciudad o enlaces web. Esos datos ya figuran visibles en su Imagen #1 personalizada.
  - NUNCA le pidas ubicación GPS ni envíes links de Google Maps o localizadores al cliente.
  - Si el cliente confirma con "correcto", "está bien", "sí", "todo bien" o similar: marcá "orderConfirmed": true.
  - Si el cliente corrige un dato (nombre, ciudad, barrio, dirección): actualizá y volvé a pedir confirmación.
  - Dejá "locationTextConfirmation" vacío ("") a menos que haya una corrección de datos que requiera confirmar en texto limpio.`;

  return `Sos un ejecutivo humano real, inteligente, cálido y sumamente profesional del área de confirmación de envíos de Noelux en Paraguay. Hablás español paraguayo natural, cercano, educado y empresarial (usás "vos", "tenés", "podés", "contame").
Tu respuesta en el campo "reply" se convierte directamente a VOZ (Nota de Audio TTS), por lo que en "reply" NO debés usar emojis, ni asteriscos, ni markdown, ni enlaces URL, ni caracteres especiales.

================================================================================
LEYES DE INTELIGENCIA HUMANA Y CONGRUENCIA CONTEXTUAL
================================================================================
1. COMPRENSIÓN NATURAL DE RESPUESTAS CORTAS (1, 2 O 3 PALABRAS) CUANDO SON CONGRUENTES:
   - Sé inteligente y empático como una persona real en WhatsApp: NO seas rígido ni digas "no te entendí" cuando el cliente responde en 1, 2 o 3 palabras que SÍ tienen total sentido y congruencia con lo que le acabás de preguntar.
   - Si tu pregunta fue de confirmación o disponibilidad (Pasos 1, 2 y 3) y el cliente responde con palabras claras como "sí", "claro", "dale", "ok", "correcto", "exacto", "está bien", "todo bien", "sí señor", "decime", "adelante": ENTENDELO AL INSTANTE como una confirmación válida y avanzá al siguiente paso.
   - Si en el Paso 4 pediste cómo es su casa o quién recibe en su edificio, y el cliente responde con una descripción breve aunque no tenga verbo conjugado (ej. "casa blanca portón negro", "muralla amarilla", "portón gris frente a despensa", "recibe portería", "en recepción", "bajo yo"): ENTENDELO AL INSTANTE como una referencia válida, guardala en "extractedHouseReference" y avanzá al Paso 5.

2. CUÁNDO SÍ DEBÉS REPREGUNTAR (ÚNICAMENTE SI NO TIENE SENTIDO O NO TIENE CONGRUENCIA):
   ${channelDiagnosticPrompt}
   - ÚNICAMENTE marcá "speechAct": "INCOHERENT_TRUNCATED_OR_SINGLE_WORD", "isGrammaticallyAndLogicallyCoherent": false, "answeredCurrentStepQuestionCompletely": false, "nextStep": ${currentStep} y "orderConfirmed": false cuando lo que dijo el cliente REALMENTE NO TENGA SENTIDO o NO TENGA CONGRUENCIA con la pregunta actual:
     * Ejemplo de incongruencia real #1: En el Paso 4 le preguntaste "¿Cómo es la fachada de tu casa y de qué color es tu portón?" y el cliente responde solo "sí", "dale" u "ok" (eso no describe ninguna casa).
     * Ejemplo de incongruencia real #2: El cliente escribe palabras sueltas desconectadas o sin sentido frente a la charla (ej. "envío qué", "mba'e pio", "zapato", palabras cortadas ininteligibles).
   - Solo en esos casos sin sentido o sin congruencia, pedile disculpas con amabilidad llamándolo por su nombre (${firstName}) y volvé a hacerle la pregunta de forma sencilla y natural (JAMÁS le exijas que "escriba una oración completa").

3. CONTINUIDAD LÓGICA DE TODO EL CHAT Y DEL PRODUCTO DE PRINCIPIO A FIN:
   - Jamás pierdas el hilo de lo que el cliente viene diciendo desde el primer mensaje, ni la lógica comercial y técnica del producto (${shortProduct}, pack de ${pack} unidad/es por ${monto} contra entrega con envío gratis).
   - Si en medio de cualquier paso (1, 2, 3 o 4) el cliente te hace una pregunta sobre el producto, precio, qué incluye, cuánto tarda el envío o cómo se paga:
     * Poné "speechAct": "CUSTOMER_QUESTION_OR_DOUBT", "isGrammaticallyAndLogicallyCoherent": true, "answeredCurrentStepQuestionCompletely": false, "nextStep": ${currentStep} y "orderConfirmed": false.
     * Primero respondé su consulta con total claridad y calidez humana, y en la misma respuesta retomá con suavidad la pregunta pendiente del PASO ${currentStep}.

4. HUMANIZACIÓN Y CERO REPETICIÓN ROBÓTICA:
   - Revisá tus intervenciones anteriores antes de hablar y JAMÁS repitas como loro la misma oración ni las mismas muletillas:
${prevAgentBlock}
   - El saludo inicial ("Hola ${firstName}") YA SE HIZO al abrir el chat. ESTÁ PROHIBIDO volver a empezar tus respuestas diciendo "Hola ${firstName}" o "Hola". Hablá fluido como una persona real en plena charla.

REGLA CRÍTICA DE GÉNERO (RESPETO Y EDUCACIÓN ABSOLUTA):
- ${genderInfo.instruccionGenero}
- Jamás te equivoques diciéndole "señor" a una mujer ni "señora" a un hombre.

REGLA CRÍTICA DE PRONUNCIACIÓN DE NÚMEROS DE CELULAR EN PARAGUAY (SIEMPRE 4 - 3 - 3 Y DÍGITO POR DÍGITO, PROHIBIDO USAR CENTENAS O DECENAS):
- En Paraguay, TODOS los prefijos de operadoras tienen CUATRO (4) dígitos al inicio (0971, 0972, 0973, 0981, 0982, 0991, 0961), luego TRES (3) dígitos y luego otros TRES (3) dígitos.
- Ejemplo escrito obligatorio: "${phone}".
- PROHIBIDO escribir números con centenas o decenas y PROHIBIDO agrupar 3 dígitos al inicio.

REGLA CRÍTICA DE CONGRUENCIA SEGÚN TIPO DE VIVIENDA (${isBuilding ? '🏢 EL CLIENTE VIVE EN UN EDIFICIO' : '🏠 EL CLIENTE VIVE EN UNA CASA INDEPENDIENTE'}):
${
  isBuilding
    ? `- El cliente indicó en el formulario que VIVE EN UN EDIFICIO (${buildingDetails || 'Edificio registrado'}). Todas tus preguntas deben referirse a su edificio, piso, departamento y recepción/portería. JAMÁS preguntes color de techo o portón de casa.`
    : `- El cliente indicó que vive en una CASA INDEPENDIENTE. Tus preguntas deben ser congruentes con una casa (calle, barrio, color de fachada/pared o portón y referencia cercana).`
}

REGLA CRÍTICA E INQUEBRANTABLE SOBRE DIRECCIÓN Y MAPA (SE ENVÍA EN TEXTO UNA SOLA VEZ EN EL PASO 3, JAMÁS SE PRONUNCIA EN EL AUDIO):
- En el campo "reply" (AUDIO), ESTÁ TERMINANTEMENTE PROHIBIDO escribir o pronunciar el nombre de la calle, barrio, ciudad o enlaces web.
- La tarjeta de dirección y mapa se envía en TEXTO UNA SOLA VEZ en el PASO 3 y NUNCA se repite en el PASO 4 ni en el PASO 5:
${step3To5Instructions}

INFORMACIÓN COMPLETA Y LÓGICA DEL PRODUCTO (${shortProduct}):
${productKnowledge}

DATOS ACTUALES DEL PEDIDO REGISTRADO EN LA WEB:
- Cliente: ${rawName || 'No registrado'} (Primer nombre: ${firstName || 'Cliente'}, Género: ${genderInfo.gender})
- Teléfono (formato paraguayo 4-3-3): ${phone || 'No registrado'}
- Tipo de Vivienda: ${isBuilding ? `🏢 EDIFICIO (${buildingDetails})` : '🏠 Casa Independiente'}
- Ciudad / Barrio registrado: ${city}${dept ? ', ' + dept : ''}
- Calle / Dirección registrada: ${address}
- Ubicación GPS Exacta en Mapa: ${gpsUrl ? `CONFIRMADA (${gpsUrl})` : 'No marcada aún'}
- Monto total contra entrega: ${monto} (${pack} unidad/es)
- Referencia verificada actual: ${referenciaCasa || 'Todavía no proporcionada'}

${narrativeMemory?.globalContextSummary || ''}

REGLAS DE AVANCE CONFIRMACIÓN EXPRESS (PASO ACTUAL = ${currentStep}):
- CONFIRMACIÓN DIRECTA: Si el cliente confirma de forma congruente los datos mostrados en su imagen (ej. "sí", "correcto", "está bien", "todo correcto", "todo impecable", "esos son mis datos"), poné "speechAct": "STEP_CONFIRMATION_COMPLETE", "isGrammaticallyAndLogicallyCoherent": true, "answeredCurrentStepQuestionCompletely": true, "nextStep": 5 y "orderConfirmed": true.
- CORRECCIÓN DE DATOS: Si el cliente corrige su nombre, ciudad o barrio/calle, poné "speechAct": "DATA_CORRECTION_OR_UPDATE", "orderConfirmed": false.
- PREGUNTA O DUDA: Si el cliente pregunta sobre el producto/envío/precio, respondé con calidez y al final recordále confirmar con "correcto".
- CLIENTE OCUPADO ("CUSTOMER_BUSY_WAIT"): Si avisa que ahora no puede o está ocupado, mantené "nextStep": ${currentStep}, "orderConfirmed": false; respondé con empatía pidiéndole que nos vuelva a escribir cuando se desocupe.`;
}

// Build the system prompt for POST-CONFIRMATION messages (rich, empathetic, multi-angle conversational hospitality, 0% keyword triggers)
function buildPostConfirmationLLMSystemPrompt(
  order: any,
  productKnowledge: string,
  callPhoneSpeech: string,
  turnNumber: number,
  previousAiReplies: string[],
  isForceClosingByTurnLimit: boolean,
  channelDiagnosticPrompt = ''
): string {
  const rawName = String(order?.nombre || '').trim();
  const firstName = getNaturalFirstName(rawName);
  const displayFirstName = firstName !== 'qué tal' ? firstName : 'cliente';
  const genderInfo = detectCustomerGender(rawName);
  const shortProduct = getNaturalProductName(order?.producto);
  const city = order?.ciudad || 'su ciudad';
  const dept = order?.departamento || '';
  const address = cleanStreetAddressText(order?.direccion || '') || 'dirección registrada';
  const monto = order ? formatGsServer(order.monto) : '';
  const pack = order?.cantidad || order?.pack || 1;
  const isBuilding = isBuildingOrderServer(order);
  const buildingDetails = formatBuildingDetailsServer(order);
  const referenciaCasa = order?.referenciaCasa || buildingDetails || 'confirmada';

  const prevRepliesText =
    previousAiReplies.length > 0
      ? previousAiReplies.map((r, i) => `  - Respuesta previa #${i + 1}: "${r}"`).join('\n')
      : '  - (Ninguna respuesta post-confirmación previa)';

  const angleIndex = ((turnNumber - 1) % 4) + 1;
  const currentAngleInstruction =
    angleIndex === 1
      ? `ÁNGULO CONVERSACIONAL DE ESTE TURNO (#1 - Precinto de Seguridad y Código de Barras en Depósito): Explicále con mucha calidez el porqué y para qué: en el mismo segundo en que confirmamos su ubicación, nuestro sistema informático imprimió la etiqueta con código de barras y el equipo de empaque selló su caja con precinto de seguridad en la cinta de salida; esto se hace justamente para proteger su equipo, evitar que nadie toque su caja y asegurar que suba hoy mismo a la camioneta del repartidor sin perder su lugar en la ruta.`
      : angleIndex === 2
        ? `ÁNGULO CONVERSACIONAL DE ESTE TURNO (#2 - Hoja de Ruta Cerrada y Auditoría del Repartidor): Explicále con total empatía el motivo real: una vez que el pedido pasa a despacho, el sistema bloquea la planilla acá en nuestra pantalla porque ya le asigna al chofer del courier la unidad exacta probada en taller y la boleta cerrada por ${monto}, justamente para que cuando el repartidor llegue a su ${isBuilding ? 'edificio' : 'casa'} no exista ninguna confusión de cobro ni de mercadería.`
        : angleIndex === 3
          ? `ÁNGULO CONVERSACIONAL DE ESTE TURNO (#3 - Separación de Permisos Informáticos por Seguridad del Comprador): Explicále con dulzura y detalle el porqué: por protocolo de calidad de la empresa, nuestra terminal de confirmación solo tiene permiso informático para verificar los datos de envío y darle prioridad de salida al paquete; apenas el paquete entra a la fila de despacho, el sistema bloquea las ediciones por chat para blindar la orden y garantizar que nadie altere por error los datos que usted ya aprobó.`
          : `ÁNGULO CONVERSACIONAL DE ESTE TURNO (#4 - Control de Calidad Individual en Mesa Técnica): Conversá con mucha simpatía explicándole que cada ${shortProduct} confirmado pasa de inmediato por una mesa de prueba técnica donde se revisa el equipo y se embala con protección especial a nombre de ${displayFirstName}, motivo por el cual la orden queda sellada en esta terminal de seguimiento.`;

  const closingGuidance = isForceClosingByTurnLimit
    ? `CIERRE CÁLIDO, CONVERSACIONAL Y CARIÑOSO (MÍNIMO 35 PALABRAS, 3 A 4 ORACIONES COMPLETAS):
- PROHIBIDO responder con 1, 2 o 3 palabras (jamás digas solo "De nada", "Gracias a vos" o "Dale chau").
- Respondé de forma amplia, cálida y empática al sentido completo de lo que te acaba de decir ${displayFirstName}.
- Despedite con muchísimo cariño, agradeciéndole su buena onda y confianza, contándole que su paquete ya queda en manos de los chicos de reparto para llegar impecable a su ${isBuilding ? 'edificio' : 'casa'}, y dejándole con dulzura nuestro número directo ${callPhoneSpeech} por cualquier cosita que se le ofrezca.`
    : `CÓMO DEBÉS ANALIZAR Y CONVERSAR CON INTELIGENCIA HUMANA SEGÚN LA CONGRUENCIA DEL MENSAJE (MÍNIMO 35 PALABRAS, 3 A 5 ORACIONES COMPLETAS EN TU RESPUESTA):

${channelDiagnosticPrompt}

CASO 0 — ÚNICAMENTE SI EL CLIENTE MANDÓ ALGO SIN SENTIDO NI CONGRUENCIA ("UNCLEAR_OR_TRUNCATED_MESSAGE"):
- Poné "speechAct": "UNCLEAR_OR_TRUNCATED_MESSAGE", "isGrammaticallyAndLogicallyCoherent": false, "needsSupportPhoneCard": false, "isNaturalFarewell": false.
- En "reply" (3 a 4 oraciones cálidas): decile con muchísimo respeto a ${displayFirstName} que su pedido de ${shortProduct} sigue firme en preparación hacia su ${isBuilding ? 'edificio' : 'casa'}, pero que recién no lograste captar qué necesitaba consultarte, pidiéndole con cariño que te comente su duda para ayudarlo de inmediato.

CASO 1 — SI EL CLIENTE HACE UNA CONSULTA SOBRE EL PRODUCTO, USO, GARANTÍA O EL ENVÍO (AUNQUE SEA BREVE, EJ. "CUÁNDO LLEGA", "ES IMPERMEABLE?") ("PRODUCT_OR_SHIPPING_QUESTION"):
- Poné "speechAct": "PRODUCT_OR_SHIPPING_QUESTION", "isGrammaticallyAndLogicallyCoherent": true, "needsSupportPhoneCard": false, "isNaturalFarewell": false.
- Conversá con amplitud (de 3 a 5 oraciones ricas y fluidas, mínimo 35 palabras), respondiendo exactamente su duda sobre su ${shortProduct}, recordándole cómo se probó en depósito, cómo se entrega en mano en su ${isBuilding ? 'edificio' : 'domicilio'} y el monto acordado de ${monto}.

CASO 2 — SI EL CLIENTE PIDE MODIFICAR/ANULAR LA ORDEN YA SELLADA O PIDE UN TELÉFONO DE ATENCIÓN ("ORDER_MODIFICATION_OR_SUPPORT_REQUEST"):
- Poné "speechAct": "ORDER_MODIFICATION_OR_SUPPORT_REQUEST", "isGrammaticallyAndLogicallyCoherent": true, "needsSupportPhoneCard": true, "isNaturalFarewell": false.
- Primero empatizá con ${displayFirstName} y explicále a fondo EL PORQUÉ y EL PARA QUÉ el sistema ya no permite tocar la planilla desde este chat usando este ángulo nuevo:
  ${currentAngleInstruction}
- Luego comentále con suavidad que si desea que desde administración central abran manualmente su orden antes de que salga el camión, puede pegarles un timbrazo al ${callPhoneSpeech}.

CASO 3 — SI EL CLIENTE SE DESPIDE O AGRADECE (INCLUSO EN 1, 2 O 3 PALABRAS COMO "GRACIAS", "MUCHAS GRACIAS", "DALE GRACIAS", "EXCELENTE", "GENIAL") ("WARM_FAREWELL_CLOSING"):
- Poné "speechAct": "WARM_FAREWELL_CLOSING", "isGrammaticallyAndLogicallyCoherent": true, "needsSupportPhoneCard": false, "isNaturalFarewell": true.
- Despedite con mucha calidez en 3 a 4 oraciones completas dejándole el número ${callPhoneSpeech} a disposición.

CASO 4 — SI CONVERSA DE OTRO TEMA CON SENTIDO CLARO ("CASUAL_CONVERSATION"):
- Poné "speechAct": "CASUAL_CONVERSATION", "isGrammaticallyAndLogicallyCoherent": true, "needsSupportPhoneCard": false, "isNaturalFarewell": false.
- Seguile la charla con simpatía y conectalo con calidez con el cuidado logístico de su ${shortProduct}.`;

  return `Sos un operador humano real, inteligente, sumamente conversacional, empático y hospitalario del área de envíos de Noelux en Paraguay. Hablás español paraguayo natural, cálido y cercano (usás "vos", "tenés", "podés").
REGLA DE IDENTIDAD INQUEBRANTABLE: JAMÁS digas ni insinúes que sos una inteligencia artificial, un bot o un asistente virtual.
REGLA DE INTELIGENCIA HUMANA: Entendé con naturalidad mensajes cortos de 1, 2 o 3 palabras cuando tengan sentido y congruencia dentro de la charla; solo repreguntá si el texto carece totalmente de sentido.
REGLA DE PRONUNCIACIÓN DE NÚMEROS DE CELULAR EN PARAGUAY (4 - 3 - 3 DÍGITO POR DÍGITO, NUNCA CENTENAS):
- Siempre escribí primero 4 dígitos del prefijo, luego 3 y luego 3 (ejemplo: "${callPhoneSpeech}"). JAMÁS pronuncies con centenas ni agrupes 3 números al inicio.
REGLA CRÍTICA DE EXTENSIÓN Y ANTI-REPETICIÓN:
- SIEMPRE debés explayarte con naturalidad en 3 a 5 oraciones completas y humanas (mínimo 35 palabras), sin emojis ni asteriscos.
- PROHIBIDO repetir las frases o estructuras de tus respuestas previas:
${prevRepliesText}

REGLA CRÍTICA DE GÉNERO:
- ${genderInfo.instruccionGenero}
- Cliente: ${rawName || 'Cliente'} (Primer nombre: ${displayFirstName}, Trato: ${genderInfo.cortesia || genderInfo.estimado}).

INFORMACIÓN DEL PRODUCTO (${shortProduct}):
${productKnowledge}

DATOS DEL PEDIDO YA CONFIRMADO (INMUTABLE POR CHAT):
- Cantidad confirmada: ${pack} unidad(es) por un total de ${monto}
- Tipo de localidad confirmada: ${isBuilding ? `🏢 Edificio (${buildingDetails})` : '🏠 Casa Independiente'}
- Ubicación confirmada: ${address}, ${city}${dept ? ', ' + dept : ''} (Referencia: ${referenciaCasa})
- Número telefónico directo de central (formato 4-3-3): ${callPhoneSpeech}

${closingGuidance}`;
}

// Multi-angle conversational fallback for post-confirmation (0% keyword regexes — driven by semantic speechAct or safe clarification)
function buildRichPostConfirmationFallback(
  order: any,
  _cleanInput: string,
  turnNumber: number,
  callPhoneSpeech: string,
  isNaturalClosingTurn: boolean,
  needsSupportPhoneCard: boolean,
  semanticSpeechAct = ''
): string {
  const rawName = String(order?.nombre || '').trim();
  const firstName = getNaturalFirstName(rawName);
  const displayFirstName = firstName !== 'qué tal' ? firstName : 'cliente';
  const shortProduct = getNaturalProductName(order?.producto);
  const monto = order ? formatGsServer(order.monto) : 'el monto acordado';
  const isBuilding = isBuildingOrderServer(order);
  const destinoLabel = isBuilding
    ? `tu edificio${order?.nombreEdificio ? ' ' + order.nombreEdificio : ''}`
    : 'tu domicilio';

  if (isNaturalClosingTurn || semanticSpeechAct === 'WARM_FAREWELL_CLOSING') {
    return `Muchísimas gracias a vos por tu excelente onda y por conversar conmigo, ${displayFirstName}. Ya mismo tu paquete de ${shortProduct} sigue su curso en la línea de despacho con todos los sellos de calidad para que el repartidor te lo entregue impecable en ${destinoLabel}, y por cualquier cosita que se te ofrezca te queda nuestro número directo ${callPhoneSpeech}. Que pases una jornada espectacular y disfrutes muchísimo tu compra.`;
  }

  const angle = ((turnNumber - 1) % 4) + 1;

  if (semanticSpeechAct === 'UNCLEAR_OR_TRUNCATED_MESSAGE') {
    if (angle % 2 === 1) {
      return `Perdoname la molestia, ${displayFirstName}, te leo con muchísima atención mientras cuidamos la salida de tu ${shortProduct} hacia ${destinoLabel}, pero recién me llegó tu mensaje un poquito cortado y no quisiera adivinar ni malinterpretar lo que necesitás consultarme. ¿Serías tan amable de contármelo en una oración completa o, si te resulta más cómodo, mandarme un audio cortito por acá mismo para poder responderte con total precisión?`;
    }
    return `Te pido mil disculpas, ${displayFirstName}, quiero asegurarme de entender al cien por ciento lo que me quisiste comentar recién porque no me quedó del todo claro el sentido del mensaje. Quedate con la tranquilidad de que tu paquete de ${shortProduct} sigue firme en despacho hacia ${destinoLabel}, y contame por favor con un poquito más de detalle tu consulta en texto o en nota de voz así te ayudo enseguida.`;
  }

  if (needsSupportPhoneCard || semanticSpeechAct === 'ORDER_MODIFICATION_OR_SUPPORT_REQUEST') {
    if (angle === 1) {
      return `Te entiendo perfectamente lo que me comentás, ${displayFirstName}, y te explico con todo cariño por qué desde acá ya no nos deja tocar la orden. Lo que pasa es que apenas confirmamos tu ubicación en ${destinoLabel}, nuestro sistema informático emitió el código de barras de tu paquete y los chicos de depósito ya sellaron tu caja con precinto de seguridad para que suba directo a la camioneta del repartidor sin demoras. Justamente para proteger tu compra el sistema bloquea las modificaciones por chat, pero si querés que en administración central abran una nota manual antes de que salga el chofer, podés pegarles una llamadita al ${callPhoneSpeech} que te dejo anotado acá abajo y te ayudan al instante.`;
    }
    if (angle === 2) {
      return `Claro que sí, ${displayFirstName}, mirá te cuento bien el motivo por el cual desde esta pantalla de seguimiento ya no podemos modificar la planilla. Cuando tu pedido de ${shortProduct} pasa a empaquetado, el sistema le asigna automáticamente al repartidor tu unidad probada en taller y cierra la hoja de ruta por ${monto}, todo esto para que al llegar a ${destinoLabel} no haya ninguna confusión con tu entrega. Si necesitás hacer ese ajuste en la planilla maestra, comunicándote un segundito al ${callPhoneSpeech} los compañeros de central tienen la clave de sistema para gestionártelo con todo gusto.`;
    }
    if (angle === 3) {
      return `Qué buena consulta me hacés, ${displayFirstName}, y te explico con total transparencia cómo funciona nuestro protocolo para cuidar tu envío. Desde esta cabina de confirmación nuestro sistema solo nos habilita a verificar tus datos y darle prioridad de salida a tu paquete hacia ${destinoLabel}, y una vez aprobado se bloquea la edición por chat para que ningún paquete pierda su turno en el reparto del día. Por eso, para cualquier retoque especial en tu orden, podés llamar directamente al ${callPhoneSpeech} donde el área administrativa te atiende enseguida.`;
    }
    return `Te comprendo totalmente, ${displayFirstName}, y te comento el porqué de este procedimiento. Cada unidad confirmada entra enseguida a la mesa de control técnico donde se verifica su funcionamiento y se embala con protección especial a tu nombre para enviarlo a ${destinoLabel}, motivo por el cual la orden queda sellada en nuestro sistema de despacho. Si deseás que los encargados de central te gestionen algún detalle adicional antes de que parta el móvil, tenés a disposición la línea directa ${callPhoneSpeech} acá abajo en el chat.`;
  }

  if (semanticSpeechAct === 'PRODUCT_OR_SHIPPING_QUESTION') {
    const prodKnowledge = getProductKnowledgeForOrder(order);
    const trainedAngles: string[] = prodKnowledge?.agentBrain?.postConfirmationProductAngles || [];
    if (trainedAngles.length > 0 && !/proyector/i.test(shortProduct)) {
      const templateAngle = trainedAngles[(angle - 1) % trainedAngles.length];
      return templateAngle
        .replace(/\{nombre\}/g, displayFirstName)
        .replace(/\{destino\}/g, destinoLabel)
        .replace(/\{monto\}/g, monto);
    }
    if (angle === 1) {
      return `Qué excelente consulta me hacés, ${displayFirstName}, te explico con todo gusto para que te quedes cien por ciento tranquilo. Tu ${shortProduct} ya fue revisado íntegramente por los técnicos acá en depósito antes de sellar tu caja con protección reforzada, y el repartidor te lo lleva directo hasta ${destinoLabel} con envío gratuito según la modalidad confirmada de ${monto}.`;
    }
    return `Claro que sí, ${displayFirstName}, es un gusto enorme acompañarte con cada detalle de tu ${shortProduct}. Cada equipo sale verificado por control de calidad desde nuestra mesa técnica con garantía real y embalaje seguro hacia ${destinoLabel}, para que recibas tu compra impecable y en tiempo y forma.`;
  }

  if (angle === 1) {
    return `Te escucho con muchísima atención, ${displayFirstName}, la verdad es que da gusto conversar con clientes tan amables como vos. Te cuento con cariño que desde esta cabina estamos conectados en vivo con la mesa técnica y de empaque cuidando que tu ${shortProduct} salga cien por ciento verificado hacia ${destinoLabel}, y si tenés alguna consulta específica sobre tu producto o tu entrega contámela con toda confianza.`;
  }
  if (angle === 2) {
    return `Muchas gracias por escribirme, ${displayFirstName}, te leo atentamente desde el sector operativo de despacho. Acá estamos supervisando que tu ${shortProduct} viaje bien protegido y con prioridad en la hoja de ruta hacia ${destinoLabel}, así que cualquier duda puntual que quieras aclararme podés comentármela tranquilamente con tus palabras.`;
  }
  if (angle === 3) {
    return `Qué gusto saludarte en línea, ${displayFirstName}, mientras nuestro equipo de logística deja todo listo con tu paquete. Recordá que tu orden de ${shortProduct} ya está debidamente registrada para entregarse en ${destinoLabel}, y quedo atento por acá por si querés hacerme alguna pregunta concreta sobre tu envío.`;
  }
  return `Te agradezco de corazón la comunicación y la buena onda, ${displayFirstName}. Desde esta terminal seguimos cuidando el recorrido de tu ${shortProduct} rumbo a ${destinoLabel} para que llegue impecable, y si necesitás consultarme algún detalle más explicámelo con tranquilidad que te respondo enseguida.`;
}

/**
 * Barrera sintáctica pura (0% listas de palabras clave en español):
 * Una palabra aislada, emoji suelto, signo o audio vacío ("?", "eh", "👍", "sí", "no", "dale", "ok")
 * JAMÁS tiene conjugación oracional suficiente para confirmar ni desaprobar un paso.
 * Para frases de 2 o más palabras léxicas, el LLM semántico evalúa su conjugación y coherencia real en contexto.
 */
export function isUnclearOrTooShortCustomerReply(cleanInput: string, _currentStep = 1): boolean {
  return evaluateSurfaceSyntacticIntegrity(cleanInput, false).isSingleWordOrEmpty;
}

// Polite, non-repetitive human clarification calling the customer by their first name when their reply lacks full contextual meaning
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
      ? 'si revisaste en la imagen de acá arriba los datos de tu edificio, el piso, el departamento y tu ciudad y si está todo correcto'
      : 'si pudiste mirar en la imagen de acá arriba tu nombre, tu ciudad, tu barrio y dirección y si están correctos';
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

/**
 * Audio limpio de transición para un paso que YA FUE VALIDADO SEMÁNTICAMENTE por el LLM,
 * usado únicamente como red de saneamiento cuando el LLM avanzó de paso válidamente pero omitió
 * una instrucción obligatoria de formato (ej. el gancho educativo de Paso 5 o no repetir teléfono en Paso 3).
 */
function buildVerifiedStepPromptAudio(
  matchedOrder: any,
  verifiedTargetStep: number,
  cleanPhone = ''
): string {
  const rawName = String(matchedOrder?.nombre || '').trim();
  const firstName = getNaturalFirstName(rawName);
  const displayFirstName = firstName && firstName !== 'qué tal' ? firstName : '';
  const shortProduct = getNaturalProductName(matchedOrder?.producto);
  const speechPhone = formatPhoneForSpeech(matchedOrder?.celular || cleanPhone);
  const isBuilding = isBuildingOrderServer(matchedOrder);

  if (verifiedTargetStep === 2) {
    return `Excelente${displayFirstName ? `, ${displayFirstName}` : ''}, muchas gracias por tu tiempo. Te comento que tenemos registrado tu pedido de ${shortProduct} a nombre de ${rawName || displayFirstName || 'usted'} y con la línea de contacto ${speechPhone}. ¿Me confirmás con tus palabras si tu nombre y tu número están correctos?`;
  }
  if (verifiedTargetStep === 3) {
    return isBuilding
      ? `Muchas gracias${displayFirstName ? `, ${displayFirstName}` : ''}. Mirá, acá arriba tenés la imagen con los datos de tu edificio, tu ciudad y dirección registrados para tu entrega. Revisalo con calma por favor y confirmame si está todo correcto.`
      : `Muchas gracias${displayFirstName ? `, ${displayFirstName}` : ''}. Mirá, acá arriba tenés la imagen con tu nombre, ciudad y barrio registrados para tu entrega. Revisalo con calma por favor y confirmame si está todo correcto.`;
  }
  if (verifiedTargetStep === 4) {
    return isBuilding
      ? `Perfecto${displayFirstName ? `, ${displayFirstName}` : ''}, los datos de tu edificio, piso, departamento y el mapa ya quedaron confirmados dentro de nuestro sistema informático. Para dejar lista la entrega con el repartidor, ¿me contás por favor si en recepción de portería están autorizados a recibir tu paquete o si preferís bajar personalmente al llegar, y qué comercio conocido hay al lado del edificio?`
      : `Perfecto${displayFirstName ? `, ${displayFirstName}` : ''}, tus ubicaciones ya quedaron perfectamente confirmadas y marcadas dentro de nuestro sistema informático para el envío. Para dejar todo anotado para el repartidor, ¿me contás por favor cómo es la fachada de tu casa, el color de la pared o del portón y algún comercio cercano de referencia?`;
  }

  const nameVocative = displayFirstName || 'cliente';

  return isBuilding
    ? `Muchísimas gracias, ${nameVocative}. Ya dejé registrados todos los detalles de entrega en tu edificio dentro de nuestro sistema informático para el repartidor, y tu pedido ya queda totalmente confirmado y pasa directo a empaquetado a tu nombre.`
    : `Muchísimas gracias, ${nameVocative}. Ya dejé registrados todos tus datos dentro de nuestro sistema informático para el repartidor, y tu pedido ya queda totalmente confirmado y pasa directo a empaquetado a tu nombre.`;
}

/**
 * Contingencia segura cuando el motor LLM de Deepgram sufre micro-corte o timeout:
 * PROHIBIDO deducir, adivinar o avanzar de paso a ciegas sin análisis semántico real.
 * Mantiene estrictamente currentStep y orderConfirmed = false pidiendo con calidez humana reconfirmar.
 */
function generateEmergencyFallbackStepReply(
  matchedOrder: any,
  currentStep: number,
  cleanInput: string,
  cleanPhone = '',
  isFromAudio = false
): {
  reply: string;
  locationTextConfirmation: string;
  nextStep: number;
  orderConfirmed: boolean;
  extractedHouseRef: string;
} {
  const rawName = String(matchedOrder?.nombre || '').trim();
  const firstName = getNaturalFirstName(rawName);
  const displayFirstName = firstName && firstName !== 'qué tal' ? firstName : 'cliente';
  const speechPhone = formatPhoneForSpeech(matchedOrder?.celular || cleanPhone);
  const isBuilding = isBuildingOrderServer(matchedOrder);

  if (currentStep >= 5) {
    return {
      reply: buildRichPostConfirmationFallback(
        matchedOrder,
        cleanInput,
        1,
        speechPhone,
        false,
        false,
        'CASUAL_CONVERSATION'
      ),
      locationTextConfirmation: '',
      nextStep: 5,
      orderConfirmed: true,
      extractedHouseRef: matchedOrder?.referenciaCasa || ''
    };
  }

  const prevCount = unclearReplyCounter.get(cleanPhone) || 0;
  unclearReplyCounter.set(cleanPhone, prevCount + 1);

  return {
    reply: buildPoliteUnclearReplyClarification(
      displayFirstName,
      currentStep,
      prevCount,
      isBuilding,
      cleanInput,
      isFromAudio
    ),
    locationTextConfirmation: '',
    nextStep: currentStep,
    orderConfirmed: false,
    extractedHouseRef: ''
  };
}

// =========================================================================
// NEGOCIACIÓN VIP DE PAGO POR ADELANTADO (-30.000 GS. · DESCUENTO DIRECTO)
// BANCO FAMILIAR · ALIAS PARAGUAY (SIPAP / CÉDULA): 3856033 (3.856.033)
// TITULAR: RICHARD ALMIRÓN
// =========================================================================
const VIP_BANK_NAME = 'Banco Familiar';
const VIP_BANK_ALIAS_RAW = '3856033';
const VIP_BANK_ALIAS_DOTTED = '3.856.033';
const VIP_BANK_HOLDER = 'Richard Almirón';

// Per-phone burst message debounce & serialization locks so rapid customer messages never trigger duplicate parallel confirmations
const pendingCustomerBurstState = new Map<
  string,
  { timer: ReturnType<typeof setTimeout>; texts: string[]; hasAudio: boolean }
>();
const inFlightCustomerReplyLocks = new Map<string, Promise<void>>();

export function buildVipPrepaymentAliasCard(order: any): string {
  const rawMontoNum =
    Number(String(order?.montoOriginalSinDescuento || order?.monto || '189000').replace(/\D/g, '')) || 189000;
  const discountedMontoNum = Math.max(50000, rawMontoNum - VIP_PREPAYMENT_DISCOUNT_GS);
  const montoOriginalStr = formatGsServer(rawMontoNum);
  const montoDescuentoStr = formatGsServer(discountedMontoNum);

  return [
    `🏦 *DATOS OFICIALES PARA TRANSFERENCIA BANCARIA (PROMO EXCLUSIVA -30.000 Gs.)*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `🏛️ *Banco:* ${VIP_BANK_NAME}`,
    `🔑 *Alias (Cédula / SIPAP):* ${VIP_BANK_ALIAS_RAW}`,
    `*(También figura como: ${VIP_BANK_ALIAS_DOTTED})*`,
    `👤 *Titular de la cuenta:* ${VIP_BANK_HOLDER}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `💵 *Precio normal contra entrega:* ~${montoOriginalStr}~`,
    `🎁 *Descuento exclusivo aplicado:* -Gs. 30.000`,
    `✅ *MONTO EXACTO A TRANSFERIR AHORA:* *${montoDescuentoStr}*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 *Alias directo para copiar con un toque:*`,
    `${VIP_BANK_ALIAS_RAW}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📸 *PASO FINAL:* Apenas realices la transferencia de *${montoDescuentoStr}*, enviá por este chat la *captura de pantalla o comprobante del pago* para verificarlo en el banco y aprobar tu descuento.`
  ].join('\n');
}

function buildPolitePromoClarificationReply(
  matchedOrder: any,
  stage: string,
  rawCustomerWords: string,
  variationIndex = 0,
  isFromAudio = false
): string {
  const rawName = String(matchedOrder?.nombre || '').trim();
  const firstName = getNaturalFirstName(rawName);
  const displayFirstName = firstName && firstName !== 'qué tal' ? firstName : 'cliente';
  const rawMontoNum =
    Number(String(matchedOrder?.montoOriginalSinDescuento || matchedOrder?.monto || '189000').replace(/\D/g, '')) || 189000;
  const discountedMontoNum = Math.max(50000, rawMontoNum - VIP_PREPAYMENT_DISCOUNT_GS);
  const montoOriginalSpeech = formatGuaraniesSpeech(rawMontoNum);
  const montoDescuentoSpeech = formatGuaraniesSpeech(discountedMontoNum);

  const cleanQuoted = String(rawCustomerWords || '')
    .replace(/^🎤\s*/, '')
    .trim()
    .replace(/["'\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 50);
  const hasQuoted = cleanQuoted.length > 0 && !cleanQuoted.startsWith('[') && /[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/.test(cleanQuoted);
  const audioHint =
    !isFromAudio && variationIndex >= 1
      ? ' Si te queda más práctico, también podés enviarme un audio cortito.'
      : '';

  let contextQuestion = `si querés aprovechar el descuento de treinta mil guaraníes diciendo las palabras quiero participar para abonar ${montoDescuentoSpeech} por transferencia, o si preferís abonar normalmente ${montoOriginalSpeech} al recibir`;
  if (stage === 'alias_sent_awaiting_receipt') {
    contextQuestion = `si pudiste realizar la transferencia de ${montoDescuentoSpeech} para enviarme la foto de tu comprobante por acá, o si necesitás que te aclare algún dato de la cuenta`;
  }

  if (hasQuoted) {
    return variationIndex % 2 === 0
      ? `Disculpame ${displayFirstName}, recién vi tu mensaje y para no malinterpretarlo te consulto con cariño: ¿me comentás por favor ${contextQuestion}?${audioHint}`
      : `Perdoname la consulta, ${displayFirstName}, ¿me decís por favor ${contextQuestion}?${audioHint}`;
  }

  return `Disculpame ${displayFirstName}, recién no se escuchó con claridad tu mensaje. ¿Me comentás por favor ${contextQuestion}?${audioHint}`;
}

function buildPromoNegotiationLLMSystemPrompt(
  order: any,
  stage: string,
  cleanInput: string,
  explanationCount: number,
  channelDiagnosticPrompt = ''
): string {
  const rawName = String(order?.nombre || '').trim();
  const firstName = getNaturalFirstName(rawName);
  const displayFirstName = firstName && firstName !== 'qué tal' ? firstName : 'cliente';
  const genderInfo = detectCustomerGender(rawName);
  const shortProduct = getNaturalProductName(order?.producto);

  const rawMontoNum =
    Number(String(order?.montoOriginalSinDescuento || order?.monto || '189000').replace(/\D/g, '')) || 189000;
  const discountedMontoNum = Math.max(50000, rawMontoNum - VIP_PREPAYMENT_DISCOUNT_GS);
  const montoOriginalSpeech = formatGuaraniesSpeech(rawMontoNum);
  const montoDescuentoSpeech = formatGuaraniesSpeech(discountedMontoNum);

  return `Sos un ejecutivo humano real, inteligente, empático, educado y muy profesional de Noelux en Paraguay. Hablás español paraguayo natural (usás "vos", "tenés", "podés").
Tu respuesta en "reply" se convierte directamente a VOZ (Nota de Audio TTS), por lo que NO debés usar emojis, ni asteriscos, ni markdown, ni caracteres especiales.
REGLA OBLIGATORIA DE MONEDA EN AUDIO: SIEMPRE escribí los montos en letras seguidos de la palabra "guaraníes" (por ejemplo: "treinta mil guaraníes", "${montoDescuentoSpeech}", "${montoOriginalSpeech}"). JAMÁS digas "treinta" a secas ni números sueltos sin decir "guaraníes".

================================================================================
INTELIGENCIA HUMANA Y CONGRUENCIA CONTEXTUAL EN LA PROMOCIÓN (-30.000 GUARANÍES)
================================================================================
- Comprendé con naturalidad respuestas cortas cuando sean congruentes con la etapa "${stage}".
${channelDiagnosticPrompt}
- Si el cliente pide explicación o hace una pregunta sobre cómo funciona:
  * Clasificá "intent": "ASKING_EXPLANATION_OR_DOUBTING", "isGrammaticallyAndLogicallyCoherent": true, "hasDoubtOrCondition": true.
  * Explicále con transparencia cómo funciona el descuento de treinta mil guaraníes y decile que si desea aprovecharlo escriba o diga "quiero participar" para enviarle al instante los datos bancarios.

DATOS DE LA PROMOCIÓN Y DEL PEDIDO:
- Cliente: ${rawName || 'Cliente'} (Primer nombre: ${displayFirstName}, Género: ${genderInfo.gender}, Trato: ${genderInfo.instruccionGenero})
- Producto: ${shortProduct}
- Etapa actual sobre la promo: ${stage} (Explicación #${explanationCount + 1})
- Precio normal contra entrega (al recibir): ${montoOriginalSpeech}
- Descuento exclusivo por pago adelantado hoy: treinta mil guaraníes
- Monto final con descuento si transfiere ahora: ${montoDescuentoSpeech}
- Cuenta oficial de la empresa: Banco Familiar, alias tres ocho cinco seis cero tres tres a nombre de Richard Almirón.

REGLAS DE CLASIFICACIÓN DE "intent" POR CONGRUENCIA REAL DE "${cleanInput}":
1. "UNCLEAR_OR_SINGLE_WORD_NEEDS_CLARIFICATION": Únicamente si el mensaje carece totalmente de sentido.
2. "ASKING_EXPLANATION_OR_DOUBTING": Pide explicación ("cómo es", "a qué banco", "explicame") o tiene dudas.
3. "CONFIRMING_PARTICIPATION": Expresa que desea participar o aprovechar el descuento de treinta mil guaraníes ("quiero participar", "sí quiero", "me interesa", "pasame el alias").
4. "READY_FOR_ALIAS": Pide los datos bancarios o el alias para transferir.
5. "DECLINING_PROMO_COD": Expresa que prefiere abonar al recibir el paquete / contra entrega / efectivo.
6. "RECEIPT_OR_PAYMENT_SENT": Informa que ya realizó la transferencia bancaria o envió el comprobante.
7. "PRODUCT_OR_OTHER_QUESTION": Hace una consulta clara sobre el producto, garantía o horario de entrega ajena al pago.`;
}

function buildContextualPromoExplanationReply(
  matchedOrder: any,
  _cleanInput: string,
  explicitlyNotApprovedYet: boolean,
  explanationCount: number
): string {
  const rawName = String(matchedOrder?.nombre || '').trim();
  const firstName = getNaturalFirstName(rawName);
  const displayFirstName = firstName && firstName !== 'qué tal' ? firstName : 'cliente';
  const shortProduct = getNaturalProductName(matchedOrder?.producto);

  const rawMontoNum =
    Number(String(matchedOrder?.montoOriginalSinDescuento || matchedOrder?.monto || '189000').replace(/\D/g, '')) || 189000;
  const discountedMontoNum = Math.max(50000, rawMontoNum - VIP_PREPAYMENT_DISCOUNT_GS);
  const montoOriginalSpeech = formatGuaraniesSpeech(rawMontoNum);
  const montoDescuentoSpeech = formatGuaraniesSpeech(discountedMontoNum);

  if (explicitlyNotApprovedYet) {
    return `Tenés toda la razón, ${displayFirstName}, te explico con total claridad: tu pedido de ${shortProduct} ya está confirmado para pagarse contra entrega por ${montoOriginalSpeech} al recibir, y esta promoción opcional consiste en que si decidís abonar hoy por adelantado mediante transferencia bancaria al Banco Familiar antes de que salga el móvil de reparto, te descontamos treinta mil guaraníes al instante, abonando únicamente ${montoDescuentoSpeech}. Si querés aprovechar este descuento decime quiero participar y te paso el alias, o si preferís abonar al recibir tu paquete queda así confirmado.`;
  }

  const variant = explanationCount % 2;
  if (variant === 0) {
    return `Con muchísimo gusto te explico cómo funciona, ${displayFirstName}. Normalmente tu pedido de ${shortProduct} se abona en efectivo al recibir por ${montoOriginalSpeech}, pero si elegís adelantar tu pago hoy por transferencia bancaria a nuestra cuenta oficial del Banco Familiar antes del despacho, te descontamos treinta mil guaraníes en el acto, por lo que transferís solamente ${montoDescuentoSpeech} y recibís tu paquete en mano sin pagar ni un guaraní más. Si te gustaría aprovechar esos treinta mil guaraníes de descuento, escribime o decime en audio quiero participar y te envío el alias enseguida.`;
  }
  return `Claro que sí, ${displayFirstName}, te comento en detalle: tu envío ya está garantizado y en empaquetado. Si optás por abonar ahora mediante transferencia bancaria te restamos treinta mil guaraníes de tu boleta, quedando en solamente ${montoDescuentoSpeech} en vez de ${montoOriginalSpeech}, y apenas nos enviás el comprobante nuestro equipo administrativo lo verifica en el banco y sella tu pedido como pagado. Decime quiero participar si querés que te pase los datos bancarios, o decime pago al recibir si preferís abonar en efectivo en tu puerta.`;
}

async function handleVipPrepaymentNegotiationTurn(
  _cleanPhone: string,
  _matchedOrder: any,
  _cleanInput: string,
  _pedidos: any[],
  _conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  _isFromAudio = false
): Promise<{
  handled: boolean;
  reply: string;
  locationTextConfirmation?: string;
  forceAudioReply?: boolean;
}> {
  // Promoción de Gs. 30.000 erradicada por decisión directiva: el flujo termina al confirmar el pedido
  return { handled: false, reply: '' };
}

/**
 * Acción de 1 clic desde la Tarjeta del Pedido en el Panel Admin ("Aprobar Pago Adelantado"):
 * Marca el pago adelantado (-Gs. 30.000) como verificado y aprobado por administración, sella el pedido como
 * empaquetado/listo para despacho y envía automáticamente una Nota de Voz humana al WhatsApp del cliente.
 */
export async function approveOrderPrepaymentAndNotifyCustomer(
  orderId: string,
  phoneOverride?: string,
  orderSnapshot?: any
): Promise<{
  success: boolean;
  order: any | null;
  reply: string;
  audioDataUrl: string | null;
  sentViaSocket: boolean;
  message?: WaChatMessage;
  error?: string;
}> {
  const cleanOrderId = String(orderId || '').trim();
  if (!cleanOrderId && !phoneOverride) {
    return {
      success: false,
      order: null,
      reply: '',
      audioDataUrl: null,
      sentViaSocket: false,
      error: 'Falta identificador del pedido'
    };
  }

  const pedidos = loadPedidos();
  let targetOrder =
    pedidos.find(
      p =>
        (cleanOrderId && (p.reservaid === cleanOrderId || p.id === cleanOrderId)) ||
        (phoneOverride &&
          normalizeWaPhone(p.celular || p.telefono || '') === normalizeWaPhone(phoneOverride))
    ) || null;

  if (!targetOrder && orderSnapshot && typeof orderSnapshot === 'object') {
    targetOrder = {
      ...orderSnapshot,
      reservaid: orderSnapshot.reservaid || orderSnapshot.id || cleanOrderId
    };
    pedidos.unshift(targetOrder);
  }

  if (!targetOrder) {
    return {
      success: false,
      order: null,
      reply: '',
      audioDataUrl: null,
      sentViaSocket: false,
      error: `No se encontró el pedido ${cleanOrderId}`
    };
  }

  const cleanPhone = normalizeWaPhone(
    phoneOverride || targetOrder.celular || targetOrder.telefono || ''
  );
  if (!cleanPhone) {
    return {
      success: false,
      order: targetOrder,
      reply: '',
      audioDataUrl: null,
      sentViaSocket: false,
      error: 'El pedido no tiene un número de WhatsApp válido'
    };
  }

  const rawMontoNum =
    Number(
      String(targetOrder.montoOriginalSinDescuento || targetOrder.monto || '189000').replace(/\D/g, '')
    ) || 189000;
  const discountedMontoNum = Math.max(50000, rawMontoNum - VIP_PREPAYMENT_DISCOUNT_GS);
  const montoDescuentoSpeech = formatGuaraniesSpeech(discountedMontoNum);

  const rawName = String(targetOrder.nombre || '').trim();
  const firstName = getNaturalFirstName(rawName);
  const displayFirstName = firstName && firstName !== 'qué tal' ? firstName : 'cliente';
  const shortProduct = getNaturalProductName(targetOrder.producto);
  const nowIso = new Date().toISOString();

  cancelCustomerInactivityFollowUp(cleanPhone);

  targetOrder.datosConfirmados = true;
  targetOrder.agenteCompletado = true;
  targetOrder.empaquetado = true;
  if (targetOrder.estado !== 'entregado_pagado') {
    targetOrder.estado = 'en_camino';
  }
  targetOrder.convStep = 5;
  targetOrder.pagoAdelantadoComprobanteRecibido = true;
  targetOrder.pagoAdelantadoVerificadoAdmin = true;
  targetOrder.pagoAdelantadoEstado = 'pagado_adelantado_confirmado';
  targetOrder.promoPagoAdelantadoStage = 'approved_by_admin';
  targetOrder.modalidadPagoElegida = 'pago_adelantado_promo_30k';
  targetOrder.pagoAdelantadoFecha = targetOrder.pagoAdelantadoFecha || nowIso;
  targetOrder.pagoAdelantadoFechaAprobacion = nowIso;
  targetOrder.pagoAdelantadoBanco = VIP_BANK_NAME;
  targetOrder.pagoAdelantadoAlias = `${VIP_BANK_ALIAS_RAW} (${VIP_BANK_ALIAS_DOTTED})`;
  targetOrder.pagoAdelantadoTitular = VIP_BANK_HOLDER;
  targetOrder.montoOriginalSinDescuento = rawMontoNum;
  targetOrder.montoConDescuentoAdelantado = discountedMontoNum;

  const approvalAudioText = `Hola ${displayFirstName}, te hablo de administración central de Noelux para darte una excelente noticia. Acabamos de verificar y aprobar tu pago adelantado en nuestro banco con tu descuento exclusivo de treinta mil guaraníes, quedando tu boleta totalmente cancelada por ${montoDescuentoSpeech}. Tu pedido de ${shortProduct} ya está empaquetado, sellado y listo en el sector de despacho para salir directo hasta tus manos sin que tengas que abonar ni un guaraní más al recibir. Muchísimas gracias por tu confianza.`;

  targetOrder.ultimoMensajeIA = approvalAudioText;
  targetOrder.actualizado_en = nowIso;
  setOrderConvStep(cleanPhone, targetOrder, 5);
  savePedidos(pedidos);
  syncOrderUpdateToCloud(targetOrder).catch(() => {});

  // Permitir envío inmediato del audio de aprobación administrativa
  recentAiSpokenTurnByPhone.delete(cleanPhone);

  const turnRes = await sendWhatsAppVoiceCallTurn(
    cleanPhone,
    approvalAudioText,
    5,
    targetOrder.reservaid,
    undefined,
    'audio',
    undefined,
    undefined,
    true
  );

  return {
    success: true,
    order: targetOrder,
    reply: approvalAudioText,
    audioDataUrl: turnRes.audioDataUrl,
    sentViaSocket: turnRes.sentViaSocket,
    message: turnRes.message
  };
}

// Confirmación Express en 1 paso + Negociación VIP -Gs. 30.000 + Hospitalidad Post-Confirmación (99-100% Audio)
export async function generateContextualAiReply(
  phone: string,
  incomingText: string,
  isFromAudio = false
): Promise<{
  reply: string;
  secondaryAudioReply?: string;
  locationTextConfirmation?: string;
  matchedOrder: any | null;
  convStep: number;
  error?: string;
  forceAudioReply?: boolean;
}> {
  const pedidos = loadPedidos();
  const activeCandidate = findActiveOrderForPhone(phone);
  const cleanPhone = normalizeWaPhone(
    activeCandidate?.celular || activeCandidate?.telefono || phone
  );
  const phoneOrders = pedidos.filter(p => {
    if (isOrderDeleted(p?.reservaid) || isOrderDeleted(p?.id)) return false;
    const pCel = normalizeWaPhone(p?.celular || p?.telefono || p?.phone || '');
    return pCel === cleanPhone || (cleanPhone.length >= 8 && pCel.length >= 8 && pCel.slice(-8) === cleanPhone.slice(-8));
  });
  const matchedOrder =
    (activeCandidate?.reservaid
      ? pedidos.find(p => p.reservaid === activeCandidate.reservaid)
      : null) ||
    phoneOrders[0] ||
    null;

  if (!matchedOrder || !isOfficialRegisteredProductOrder(matchedOrder)) {
    console.warn(`[Filtro Clientes] Se bloqueó generación de IA porque ${cleanPhone} no tiene un pedido oficial de producto registrado.`);
    return { reply: '', matchedOrder: null, convStep: 1 };
  }
  const { contextoIA } = getProductKnowledgeForOrder(matchedOrder);

  const currentStep = getOrderConvStep(cleanPhone, matchedOrder);
  const isAlreadyConfirmed =
    Boolean(matchedOrder.datosConfirmados) ||
    Boolean(matchedOrder.agenteCompletado) ||
    currentStep >= 5;

  let apiWarning = '';
  const deepgramKey = getDeepgramApiKey();
  if (!deepgramKey) {
    apiWarning =
      '⚠️ AVISO SISTEMA: No hay API Key de Deepgram configurada. El agente operó en modo determinístico seguro.';
    console.warn('[AI Reply] ' + apiWarning);
  }

  const rawChatHistory = getChatHistory(cleanPhone).messages;
  const chatHistory = rawChatHistory.filter(
    m => !m.orderId || !matchedOrder.reservaid || m.orderId === matchedOrder.reservaid
  );
  const effectiveIsFromAudio = Boolean(isFromAudio || /^🎤\s*/.test(String(incomingText || '')));
  const cleanInput = String(incomingText || '').replace(/^🎤\s*/, '').trim();

  const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const recentMsgs = chatHistory.slice(-50);
  for (let i = 0; i < recentMsgs.length; i++) {
    const msg = recentMsgs[i];
    const rawMsgTxt = String(msg.text || '').trim();
    const msgClean = rawMsgTxt.replace(/^🎤\s*/, '').trim();
    if (!msgClean) continue;
    if (i === recentMsgs.length - 1 && msg.sender === 'client' && msgClean === cleanInput) {
      continue;
    }
    if (msg.sender === 'client') {
      const wasAudioMsg = Boolean(msg.isAudioNote || rawMsgTxt.startsWith('🎤'));
      conversationHistory.push({
        role: 'user',
        content: `[${wasAudioMsg ? 'Audio hablado' : 'Texto escrito'}]: ${msgClean}`
      });
    } else if (msg.sender === 'ai' || msg.sender === 'admin' || (msg.sender === 'agent' && msg.status !== 'error')) {
      conversationHistory.push({ role: 'assistant', content: msgClean });
    }
  }

  const wasAwaitingMapCorrection = Boolean(matchedOrder?.awaitingMapCorrection);
  const mapReplacementRes = matchedOrder
    ? applyNewMapUrlAndCoordinatesToOrder(matchedOrder, cleanInput)
    : { updated: false, newMapUrl: '' };

  if (matchedOrder && mapReplacementRes.updated && isAlreadyConfirmed) {
    const rawName = String(matchedOrder?.nombre || '').trim();
    const firstName = getNaturalFirstName(rawName);
    const displayFirstName = firstName && firstName !== 'qué tal' ? firstName : 'cliente';

    matchedOrder.awaitingMapCorrection = false;
    matchedOrder.gpsConfirmado = true;
    matchedOrder.mapaCorregidoPorCliente = true;
    matchedOrder.actualizado_en = new Date().toISOString();

    const updatedPostConfirmReply = `Excelente, ${displayFirstName}, muchísimas gracias por enviarme tu nueva ubicación GPS. Acabo de actualizar tu orden en nuestro sistema informático para que el repartidor llegue directo y sin ninguna confusión.`;
    matchedOrder.ultimoMensajeIA = updatedPostConfirmReply;
    savePedidos(pedidos);
    syncOrderUpdateToCloud(matchedOrder).catch(() => {});
    return {
      reply: updatedPostConfirmReply,
      locationTextConfirmation: undefined,
      matchedOrder,
      convStep: 5,
      forceAudioReply: true,
      error: apiWarning || undefined
    };
  }

  const priorUnclearCount = unclearReplyCounter.get(cleanPhone) || 0;
  const syntacticCheck = evaluateSurfaceSyntacticIntegrity(cleanInput, effectiveIsFromAudio, priorUnclearCount);
  const narrativeMemory = buildFullChatNarrativeMemory(
    cleanPhone,
    matchedOrder,
    phoneOrders,
    chatHistory,
    cleanInput,
    effectiveIsFromAudio
  );
  const taggedUserMessage = `[${syntacticCheck.channelLabel}]: ${cleanInput}`;

  // Si el cliente escribe la palabra clave "CORRECTO" y todavía no se le ha enviado la imagen final de Pedido Confirmado (stage3_confirmed),
  // permitir que ejecute el bloque de confirmación principal para enviarle el Audio de Confirmación + 1s + Imagen de Pedido Confirmado.
  const orderKeyForStage = String(matchedOrder?.reservaid || '').trim();
  const hasSentConfirmedImageAlready =
    Boolean(matchedOrder?.waCommercialSentStages?.stage3_confirmed) ||
    Boolean(orderKeyForStage && sentConfirmedStageByOrderId.has(orderKeyForStage));
  const isExplicitConfirmationKeywordNow =
    evaluateExpressOrderConfirmationInput(
      cleanInput,
      Boolean(extractCanonicalMapUrlFromOrder(matchedOrder))
    ).decision === 'CONFIRMED';

  if (isAlreadyConfirmed && isExplicitConfirmationKeywordNow && !hasSentConfirmedImageAlready) {
    recentAiSpokenTurnByPhone.delete(cleanPhone);
  }

  // =========================================================================
  // FLUJO POST-CONFIRMACIÓN AMABLE Y DULCE + NEGOCIACIÓN VIP (-30.000 GS.)
  // =========================================================================
  if (isAlreadyConfirmed && (!isExplicitConfirmationKeywordNow || hasSentConfirmedImageAlready)) {
    const vipNegotiationRes = await handleVipPrepaymentNegotiationTurn(
      cleanPhone,
      matchedOrder,
      cleanInput,
      pedidos,
      conversationHistory,
      effectiveIsFromAudio
    );
    if (vipNegotiationRes.handled) {
      return {
        reply: vipNegotiationRes.reply,
        locationTextConfirmation: vipNegotiationRes.locationTextConfirmation,
        matchedOrder,
        convStep: 5,
        forceAudioReply: true
      };
    }

    const storage = loadChatsStorage();
    if (!storage.postConfirmStrikes) storage.postConfirmStrikes = {};
    if (!storage.postConfirmBlocked) storage.postConfirmBlocked = {};

    const currentTurns = Math.max(
      Number(storage.postConfirmStrikes[cleanPhone] || 0),
      Number(matchedOrder.postConfirmStrikes || 0)
    );
    const alreadyBlocked =
      Boolean(storage.postConfirmBlocked[cleanPhone]) ||
      Boolean(matchedOrder.postConfirmBlocked) ||
      currentTurns >= MAX_POST_CONFIRM_TURNS;

    if (alreadyBlocked) {
      console.log(
        `[Pausa Silenciosa Post-Confirmación] Cliente ${cleanPhone} ya completó la ventana de atención post-confirmación. Ignorando en silencio para proteger créditos.`
      );
      return { reply: '', matchedOrder, convStep: 5 };
    }

    const isObviousSpam = cleanInput.length > 450 || /(.)\1{9,}/.test(cleanInput);
    if (isObviousSpam && currentTurns >= 1) {
      storage.postConfirmBlocked[cleanPhone] = true;
      matchedOrder.postConfirmBlocked = true;
      saveChatsStorage(storage);
      savePedidos(pedidos);
      return { reply: '', matchedOrder, convStep: 5 };
    }

    const turnNumber = currentTurns + 1;
    const isForceClosingByTurnLimit = turnNumber >= MAX_POST_CONFIRM_TURNS;

    const engineState = getWhatsAppEngineState();
    const sellerInfo = getSellerNotificationPhoneForProduct(matchedOrder.productoId, matchedOrder.producto);
    const rawCallPhone =
      engineState.connectedPhone ||
      matchedOrder.waVendedor ||
      sellerInfo.sellerPhone ||
      '0973532550';
    const callPhoneSpeech = formatPhoneForSpeech(rawCallPhone);

    const previousAiReplies = conversationHistory
      .filter(m => m.role === 'assistant')
      .slice(-4)
      .map(m => m.content);

    const postSystemPrompt = buildPostConfirmationLLMSystemPrompt(
      matchedOrder,
      contextoIA,
      callPhoneSpeech,
      turnNumber,
      previousAiReplies,
      isForceClosingByTurnLimit,
      syntacticCheck.channelDiagnosticPrompt
    );

    let rawPostOutput = '';
    if (deepgramKey) {
      try {
        rawPostOutput = await callDeepgramAgentLLM(
          postSystemPrompt,
          conversationHistory,
          taggedUserMessage,
          true,
          true
        );
      } catch (e: any) {
        console.error('[Deepgram Agent Post-Confirm LLM Warning]:', e?.message || e);
      }
    }

    let postReply = '';
    let postSpeechAct = '';
    let postCoherent = false;
    let llmNeedsSupportPhoneCard = false;
    let llmIsNaturalFarewell = false;

    if (rawPostOutput) {
      try {
        const cleanedJson = rawPostOutput
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();
        const parsed = JSON.parse(cleanedJson);
        postReply = String(parsed.reply || '').trim();
        postSpeechAct = String(parsed.speechAct || '').trim();
        postCoherent = Boolean(parsed.isGrammaticallyAndLogicallyCoherent);
        llmNeedsSupportPhoneCard = Boolean(parsed.needsSupportPhoneCard);
        llmIsNaturalFarewell = Boolean(parsed.isNaturalFarewell);
      } catch {
        postReply = rawPostOutput.trim();
      }
    }

    const isNaturalClosingTurn =
      isForceClosingByTurnLimit || (turnNumber >= 2 && postCoherent && llmIsNaturalFarewell);

    storage.postConfirmStrikes[cleanPhone] = turnNumber;
    matchedOrder.postConfirmStrikes = turnNumber;
    if (isNaturalClosingTurn) {
      storage.postConfirmBlocked[cleanPhone] = true;
      matchedOrder.postConfirmBlocked = true;
    }
    saveChatsStorage(storage);

    const postReplyWords = postReply ? postReply.split(/\s+/).filter(Boolean).length : 0;
    const postEchoSimilarity = narrativeMemory.lastAgentMessage
      ? calculateNormalizedSentenceSimilarity(postReply, narrativeMemory.lastAgentMessage)
      : 0;

    if (!postReply || postReplyWords < 22 || postEchoSimilarity >= 0.72) {
      postReply = buildRichPostConfirmationFallback(
        matchedOrder,
        cleanInput,
        turnNumber,
        callPhoneSpeech,
        isNaturalClosingTurn,
        postCoherent && llmNeedsSupportPhoneCard,
        postSpeechAct
      );
    }

    postReply = normalizeParaguayanPhonesInText(postReply);
    matchedOrder.ultimoMensajeIA = postReply;
    savePedidos(pedidos);
    syncOrderUpdateToCloud(matchedOrder).catch(() => {});

    return {
      reply: postReply,
      locationTextConfirmation: undefined,
      matchedOrder,
      convStep: 5,
      forceAudioReply: true,
      error: apiWarning || undefined
    };
  }

  // =========================================================================
  // FLUJO DE CONFIRMACIÓN EXPRESS EN 1 PASO ("CORRECTO" / "ESTÁ BIEN" / GPS)
  // Audio #1: Pedido Totalmente Confirmado y en Empaquetado
  // Audio #2: Oferta Exclusiva -Gs. 30.000 Pago Adelantado ("QUIERO PARTICIPAR")
  // =========================================================================
  const isBuilding = isBuildingOrderServer(matchedOrder);
  const buildingDetails = formatBuildingDetailsServer(matchedOrder);
  const rawCustomerName = String(matchedOrder?.nombre || '').trim();
  const customerFirstName = getNaturalFirstName(rawCustomerName);
  const displayFirstName = customerFirstName && customerFirstName !== 'qué tal' ? customerFirstName : 'cliente';
  const shortProduct = getNaturalProductName(matchedOrder?.producto);
  const packQty = Math.min(3, Math.max(1, Number(matchedOrder?.cantidad || matchedOrder?.pack || 1) || 1));
  const packSpeech =
    packQty === 3 ? 'tu pack de tres unidades' : packQty === 2 ? 'tu pack de dos unidades' : 'tu unidad';

  if (matchedOrder && mapReplacementRes.updated) {
    matchedOrder.awaitingMapCorrection = false;
    matchedOrder.gpsConfirmado = true;
    matchedOrder.mapaCorregidoPorCliente = true;
  }

  // Limpiar dirección si traía URL embebida del formulario
  if (matchedOrder?.direccion && /\[GPS:|google\.com\/maps|maps\.google\.com/i.test(String(matchedOrder.direccion))) {
    if (!matchedOrder.gpsLink) {
      matchedOrder.gpsLink = extractCanonicalMapUrlFromOrder(matchedOrder);
    }
    matchedOrder.direccion = cleanStreetAddressText(matchedOrder.direccion);
  }

  const finalizeExpressConfirmationAndPromoTurn = (extraHouseRef = '') => {
    cancelCustomerInactivityFollowUp(cleanPhone);
    unclearReplyCounter.set(cleanPhone, 0);

    const rawRef =
      extraHouseRef ||
      matchedOrder.referenciaCasa ||
      narrativeMemory.verifiedHouseReference ||
      (isBuilding ? buildingDetails || 'Edificio confirmado' : 'Ubicación y datos confirmados por WhatsApp');
    const finalRef =
      isBuilding && buildingDetails && !String(rawRef).includes(buildingDetails)
        ? `${buildingDetails}${rawRef ? ` · ${rawRef}` : ''}`
        : rawRef;

    const rawMontoNum = Number(String(matchedOrder?.monto || '189000').replace(/\D/g, '')) || 189000;

    matchedOrder.referenciaCasa = finalRef;
    matchedOrder.datosConfirmados = true;
    matchedOrder.empaquetado = true;
    matchedOrder.agenteCompletado = true;
    matchedOrder.estado = 'en_camino';
    matchedOrder.estadoEnvioProducto = matchedOrder.estadoEnvioProducto || 'no_enviado';
    matchedOrder.concretadoCobrado = Boolean(matchedOrder.concretadoCobrado);
    matchedOrder.promoPagoAdelantadoStage = '';
    matchedOrder.modalidadPagoElegida = 'contra_entrega';

    const finalGpsUrl = extractCanonicalMapUrlFromOrder(matchedOrder) || undefined;
    const cleanAddr = cleanStreetAddressText(matchedOrder.direccion || '');
    matchedOrder.direccion = cleanAddr;

    const ubicacionStr = `${matchedOrder.ciudad || ''}, ${matchedOrder.departamento || ''}`.replace(/^,\s*|,\s*$/g, '');
    const resumenTexto = `Confirmación Express completada con ${matchedOrder.nombre} (${cleanPhone}). Entrega confirmada en ${isBuilding ? 'EDIFICIO' : 'CASA'} en ${ubicacionStr}, barrio/dirección "${cleanAddr}"${buildingDetails ? ` (${buildingDetails})` : ''}${finalGpsUrl ? ` (GPS: ${finalGpsUrl})` : ''}.`;
    matchedOrder.resumenConfirmacionIA = resumenTexto;
    matchedOrder.comparativaDatos = {
      nombreWeb: matchedOrder.nombre || '',
      nombreConfirmado: matchedOrder.nombre || '',
      celularWeb: matchedOrder.celular || '',
      celularConfirmado: matchedOrder.celular || '',
      ubicacionWeb: ubicacionStr,
      ubicacionConfirmada: ubicacionStr,
      direccionWeb: cleanAddr,
      direccionConfirmada: cleanAddr,
      referenciaConfirmada: finalRef,
      packConfirmado: `${packQty} un. · ${formatGsServer(rawMontoNum)}`,
      coincidenDatos: true,
      resumenTexto,
      fechaConfirmacion: new Date().toISOString(),
      tipoVivienda: isBuilding ? 'edificio' : 'casa',
      ...(matchedOrder.nombreEdificio ? { nombreEdificio: matchedOrder.nombreEdificio } : {}),
      ...(matchedOrder.pisoEdificio ? { pisoEdificio: matchedOrder.pisoEdificio } : {}),
      ...(matchedOrder.departamentoNumero ? { departamentoNumero: matchedOrder.departamentoNumero } : {}),
      ...(matchedOrder.tieneRecepcion ? { tieneRecepcion: matchedOrder.tieneRecepcion } : {}),
      ...(matchedOrder.detalleRecepcion ? { detalleRecepcion: matchedOrder.detalleRecepcion } : {}),
      ...(finalGpsUrl ? { gpsLink: finalGpsUrl, gpsConfirmado: true } : {}),
      ...(typeof matchedOrder.gpsLat === 'number' ? { gpsLat: matchedOrder.gpsLat } : {}),
      ...(typeof matchedOrder.gpsLng === 'number' ? { gpsLng: matchedOrder.gpsLng } : {})
    };

    // PASO 2 FINAL: Audio único de confirmación y pase a empaquetado (sin promoción de pago anticipado)
    const confirmAudio = `Excelente, ${displayFirstName}, muchísimas gracias por tu confirmación. Tu pedido de ${packSpeech} de ${shortProduct} ya está totalmente confirmado y pasa directo a empaquetado a tu nombre.`;

    setOrderConvStep(cleanPhone, matchedOrder, 5);
    matchedOrder.convStep = 5;
    matchedOrder.atendidoPorIA = true;
    matchedOrder.ultimoMensajeIA = confirmAudio;
    matchedOrder.actualizado_en = new Date().toISOString();
    savePedidos(pedidos);
    syncOrderUpdateToCloud(matchedOrder).catch(() => {});
    notifySellerOfOrderEvent(matchedOrder, 'green').catch(() => {});

    return {
      reply: confirmAudio,
      secondaryAudioReply: undefined,
      secondaryPromoImage: false,
      locationTextConfirmation: undefined,
      matchedOrder,
      convStep: 5,
      forceAudioReply: true,
      error: apiWarning || undefined
    };
  };

  // Si el cliente adjuntó voluntariamente un pin GPS de WhatsApp durante la charla, se guarda en silencio para Admin/Reparto y confirmamos
  if (wasAwaitingMapCorrection && mapReplacementRes.updated) {
    matchedOrder.awaitingMapCorrection = false;
  }

  // 1. Evaluación determinística instantánea de la palabra clave "CORRECTO" / "ESTÁ BIEN" (o pin GPS recibido)
  const hasGpsNow = Boolean(extractCanonicalMapUrlFromOrder(matchedOrder));
  const expressEval = evaluateExpressOrderConfirmationInput(cleanInput, hasGpsNow);

  if (expressEval.decision === 'CONFIRMED' || expressEval.decision === 'GPS_PIN_RECEIVED_CONFIRMED') {
    return finalizeExpressConfirmationAndPromoTurn();
  }

  // 2. Si el cliente hizo una consulta, reportó un cambio de barrio/ciudad/nombre o respondió con otra frase, analizar con Deepgram LLM en Audio
  let llmReply = '';
  let llmSpeechAct = '';
  let llmCoherent = false;
  let llmOrderConfirmed = false;
  let extractedHouseRef = '';
  let correctedName = '';
  let correctedCity = '';
  let correctedAddress = '';

  if (deepgramKey) {
    try {
      const expressSystemPrompt = `Sos un ejecutivo humano real, cálido y muy eficiente del área de confirmación de envíos de Noelux en Paraguay. Hablás español paraguayo natural (usás "vos", "tenés", "podés").
Tu respuesta en "reply" se convierte directamente a VOZ (Nota de Audio TTS), por lo que ESTÁ PROHIBIDO usar emojis, asteriscos, enlaces URL, y ESTÁ PROHIBIDO pronunciar el nombre de la calle, barrio o ciudad en el audio.
REGLA DE MONEDA: Siempre escribí los montos en letras seguidos de la palabra "guaraníes" (ej. "${formatGuaraniesSpeech(matchedOrder?.monto || 189000)}").

CONTEXTO DE CONFIRMACIÓN EXPRESS CON IMAGEN DINÁMICA PERSONALIZADA:
- Ya le enviamos al cliente nuestro Audio #1 pidiendo que mire la imagen de abajo que le acabamos de enviar, seguido 1 segundo después por su Imagen #1 VIP generada dinámicamente con TODOS sus datos de entrega (${packSpeech} de ${shortProduct}, nombre ${rawCustomerName}, teléfono ${formatPhoneForSpeech(matchedOrder?.celular || cleanPhone)}, ciudad ${matchedOrder?.ciudad || ''}, barrio/dirección ${cleanStreetAddressText(matchedOrder?.direccion || '')}) SIN enlaces GPS.
- NUNCA le pidas GPS al cliente ni le envíes enlaces de mapas o Google Maps; la confirmación se basa en los datos mostrados en su imagen (nombre, ciudad, barrio y dirección).
- Solo necesitamos que el cliente confirme si esos datos están bien diciendo o escribiendo la palabra "correcto".
- Si el cliente ya está confirmando con otras palabras claras (ej. "todo impecable mandame nomás", "esos mismos son mis datos", "sí señor todo bien"), marcá "speechAct": "STEP_CONFIRMATION_COMPLETE" y "orderConfirmed": true.
- Si el cliente corrige su nombre, su ciudad o su barrio/calle, extraelo en "correctedName", "correctedCity" o "correctedAddress", poné "speechAct": "DATA_CORRECTION_OR_UPDATE", "orderConfirmed": false, y en "reply" confirmále que ya corregiste ese dato acá abajo y pedile que te diga la palabra "correcto" para cerrar su confirmación.
- Si el cliente hace una pregunta sobre el producto (${shortProduct}) o el envío, respondé su consulta con calidez usando este conocimiento:
${contextoIA}
Y al final de tu audio recordále amablemente: "Si los datos de entrega que ves en tu imagen acá arriba están bien, decime o escribime la palabra correcto así ya pasamos tu pedido a empaquetado".`;

      const rawLlmOutput = await callDeepgramAgentLLM(
        expressSystemPrompt,
        conversationHistory,
        taggedUserMessage,
        true,
        false
      );
      if (rawLlmOutput) {
        const cleanedJson = rawLlmOutput
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();
        const parsed = JSON.parse(cleanedJson);
        llmSpeechAct = String(parsed.speechAct || '').trim();
        llmCoherent = Boolean(parsed.isGrammaticallyAndLogicallyCoherent);
        llmReply = String(parsed.reply || '').trim();
        llmOrderConfirmed = Boolean(parsed.orderConfirmed);
        extractedHouseRef = String(parsed.extractedHouseReference || '').trim();
        correctedName = String(parsed.correctedName || '').trim();
        correctedCity = String(parsed.correctedCity || '').trim();
        correctedAddress = String(parsed.correctedAddress || '').trim();
      }
    } catch (e: any) {
      console.warn('[Express Confirmation LLM Warning]:', e?.message || e);
    }
  }

  if (llmCoherent && (llmOrderConfirmed || llmSpeechAct === 'STEP_CONFIRMATION_COMPLETE')) {
    return finalizeExpressConfirmationAndPromoTurn(extractedHouseRef);
  }

  let updatedLocationCard: string | undefined = undefined;
  if (llmCoherent) {
    if (correctedName) matchedOrder.nombre = correctedName;
    if (correctedCity) matchedOrder.ciudad = correctedCity;
    if (correctedAddress) matchedOrder.direccion = cleanStreetAddressText(correctedAddress);
    if (extractedHouseRef) matchedOrder.referenciaCasa = extractedHouseRef;
    if (correctedName || correctedCity || correctedAddress) {
      updatedLocationCard = buildExpressInitialAddressTextCard(matchedOrder);
    }
  }

  if (!llmReply) {
    unclearReplyCounter.set(cleanPhone, priorUnclearCount + 1);
    llmReply = `Disculpame ${displayFirstName}, recién recibí tu mensaje y quiero asegurarme de dejar tu envío impecable. Revisá por favor tu nombre, tu ciudad y tu barrio en la imagen que te pasé acá arriba, y si está todo bien escribime o decime en audio simplemente la palabra correcto para confirmar tu pedido.`;
  } else {
    llmReply = normalizeParaguayanPhonesInText(llmReply);
  }

  setOrderConvStep(cleanPhone, matchedOrder, 3);
  matchedOrder.convStep = 3;
  matchedOrder.atendidoPorIA = true;
  matchedOrder.ultimoMensajeIA = llmReply;
  matchedOrder.actualizado_en = new Date().toISOString();
  savePedidos(pedidos);
  syncOrderUpdateToCloud(matchedOrder).catch(() => {});

  return {
    reply: llmReply,
    locationTextConfirmation: updatedLocationCard,
    matchedOrder,
    convStep: 3,
    forceAudioReply: true,
    error: apiWarning || undefined
  };
}

// Flush messages that were queued while WhatsApp was waiting for connection
async function flushPendingMessages(session: WaSessionRuntime) {
  if (!session.sock || session.status !== 'connected') return;
  try {
    const storage = loadChatsStorage();
    let changed = false;
    for (const [phone, messages] of Object.entries(storage.chats)) {
      for (const msg of messages) {
        if (msg.status === 'pending_connection' && (msg.sender === 'admin' || msg.sender === 'ai')) {
          try {
            const jid = resolveOutboundWhatsAppJid(phone);
            if (msg.isVoiceCall || msg.isAudioNote) {
              let audioSentOk = false;
              try {
                const tts = await synthesizeSpeechSelfHosted(msg.text);
                if (tts.audioBuffer && session.sock) {
                  const sentAudio = await session.sock.sendMessage(jid, {
                    audio: tts.audioBuffer,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true,
                    seconds: tts.durationSeconds,
                    waveform: tts.waveform
                  } as any);
                  if (sentAudio?.key?.id) {
                    audioSentOk = true;
                    if (tts.audioDataUrl) {
                      msg.audioDataUrl = tts.audioDataUrl;
                    }
                    msg.voiceEngine = tts.engine;
                    recentlySentMsgIds.add(sentAudio.key.id);
                    setTimeout(() => recentlySentMsgIds.delete(sentAudio.key.id!), 30000);
                    recordSentProtoMessage(sentAudio.key.id, sentAudio.message);
                  }
                }
              } catch {}
              if (msg.isAudioNote && !audioSentOk) {
                continue;
              }
            }
            if (!msg.isAudioNote) {
              if (msg.imageUrl && String(msg.imageUrl).trim()) {
                const relImgPath = String(msg.imageUrl).replace(/^\/+/, '');
                if (relImgPath.includes('promo_prepayment')) {
                  msg.status = 'sent';
                  changed = true;
                  continue;
                }
                const candidateImgPath = path.resolve(process.cwd(), 'public', relImgPath);
                const resolvedQueuedImgPath = fs.existsSync(candidateImgPath) ? candidateImgPath : '';
                if (resolvedQueuedImgPath) {
                  // Garantizar que también al vaciar cola offline la imagen salga 1 segundo después del audio previo
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  const queuedImgBuf = fs.readFileSync(resolvedQueuedImgPath);
                  const sentImg = await session.sock.sendMessage(jid, {
                    image: queuedImgBuf,
                    mimetype: 'image/jpeg'
                  } as any);
                  if (sentImg?.key?.id) {
                    recentlySentMsgIds.add(sentImg.key.id);
                    setTimeout(() => recentlySentMsgIds.delete(sentImg.key.id!), 30000);
                    recordSentProtoMessage(sentImg.key.id, sentImg.message);
                  }
                } else {
                  const sent = await session.sock.sendMessage(jid, { text: msg.text });
                  if (sent?.key?.id) {
                    recentlySentMsgIds.add(sent.key.id);
                    setTimeout(() => recentlySentMsgIds.delete(sent.key.id!), 30000);
                    recordSentProtoMessage(sent.key.id, sent.message);
                  }
                }
              } else {
                const sent = await session.sock.sendMessage(jid, { text: msg.text });
                if (sent?.key?.id) {
                  recentlySentMsgIds.add(sent.key.id);
                  setTimeout(() => recentlySentMsgIds.delete(sent.key.id!), 30000);
                  recordSentProtoMessage(sent.key.id, sent.message);
                }
              }
            }
            msg.status = 'sent';
            msg.sessionId = session.id;
            changed = true;
          } catch {}
        }
      }
    }
    if (changed) {
      saveChatsStorage(storage);
      scheduleCloudStateSync(true);
    }
  } catch (e) { }
}

// ============================================================================
// 🛡️ BLINDAJE NASA v3: RELEVO ATÓMICO SIN COLISIONES (ZERO-COLLISION HANDOFF)
// Resuelve definitivamente las caídas de WhatsApp en cada deploy de Railway:
//   1. Leader Lease Atómico (WALOCK-leader): El contenedor NUEVO anuncia su bootEpoch
//      ANTES de abrir socket y espera a que el contenedor VIEJO suelte limpiamente
//      la conexión y suba el último ratchet Signal (WAAUTH-*) → CERO guerra 440.
//   2. Vigilante de Relevo (1.5s): El contenedor VIEJO detecta al nuevo líder incluso
//      antes de recibir SIGTERM, bloquea reconexiones, espera saveCreds + keys.set,
//      cierra sock.end(), sube WAAUTH-* íntegro y entrega el testigo (yieldedForEpoch).
//   3. Interceptor Criptográfico Signal (keys.set + creds.update): Cada giro del
//      ratchet criptográfico dispara backup rápido (2s–4s) a Supabase.
//   4. Doble Bóveda Redundante (Snapshots N y N-1): Jamás borra el backup anterior
//      hasta tener 2 snapshots completos validados; nunca sube backups truncados.
//   5. Auto-Curación ante 401/440: Distingue reemplazo de contenedor vs logout real
//      y re-hidrata desde la bóveda N-1 antes de aceptar una desconexión.
// ============================================================================

const authBackupTimers = new Map<string, NodeJS.Timeout>();
const authBackupDeadlines = new Map<string, number>();
const inFlightAuthBackupBySession = new Map<string, Promise<void>>();
const lastPreKeySelfHealBySession = new Map<string, number>();
const consecutiveLogoutCodes = new Map<string, number>();
export const MANUAL_DISCONNECT_CONFIRM_CODE = 'CONFIRMAR_DESCONEXION_MANUAL';
let bootRestorePromise: Promise<void> | null = null;
let skipDevAutoConnectBecauseProdActive = false;

const MY_BOOT_EPOCH: number =
  (globalThis as any).__noeluxBootEpoch ||
  ((globalThis as any).__noeluxBootEpoch = Date.now());
const MY_INSTANCE_ID: string =
  (globalThis as any).__noeluxInstanceId ||
  ((globalThis as any).__noeluxInstanceId = `inst-${MY_BOOT_EPOCH}-${crypto.randomBytes(3).toString('hex')}`);

let yieldInFlightPromise: Promise<void> | null = null;

function isYieldingToNewerDeploy(): boolean {
  return Boolean((globalThis as any).__noeluxIsYieldingToNewerDeploy);
}

interface WaLeaderLockPayload {
  leaderId: string;
  bootEpoch: number;
  phase: 'claiming' | 'active' | 'yielding';
  yieldedBy?: string;
  yieldedForEpoch?: number;
  yieldedAt?: number;
  updatedAt: string;
}

async function readCloudLeaderLock(): Promise<WaLeaderLockPayload | null> {
  try {
    const rows = await querySupabaseCodigos({
      codeFilter: 'eq.WALOCK-leader',
      orderDesc: true,
      limit: 1
    });
    if (Array.isArray(rows) && rows[0]?.dispositivo) {
      const parsed = JSON.parse(rows[0].dispositivo);
      if (parsed && typeof parsed.bootEpoch === 'number' && parsed.leaderId) {
        return parsed as WaLeaderLockPayload;
      }
    }
  } catch {}
  return null;
}

// Ejecutado por el Contenedor SALIENTE en cuanto detecta un deploy más nuevo o recibe SIGTERM:
// Cierra sockets sin hacer logout(), guarda hasta el último byte de Signal en Supabase y cede el turno.
async function yieldToNewerDeployLeader(reason: string, newerEpoch?: number): Promise<void> {
  if (yieldInFlightPromise) return yieldInFlightPromise;
  (globalThis as any).__noeluxIsYieldingToNewerDeploy = true;

  yieldInFlightPromise = (async () => {
    const t0 = Date.now();
    console.log(`[NASA Handoff] 🤝 Contenedor saliente (${MY_INSTANCE_ID}) cediendo liderazgo (${reason})...`);
    try {
      // 1. Cancelar timers diferidos para ejecutar el flush definitivo ahora mismo
      for (const [id, timer] of authBackupTimers) {
        clearTimeout(timer);
        authBackupTimers.delete(id);
        authBackupDeadlines.delete(id);
      }

      // 2. Frenar reconexiones y cerrar sockets suavemente (end, JAMÁS logout) tras asentar escrituras en disco
      for (const s of sessionsMap.values()) {
        s.socketSeq += 10000;
        s.isConnecting = false;
        const activeSock = s.sock;
        s.sock = null;

        await Promise.race([
          Promise.allSettled([
            Promise.resolve(s.lastSaveCredsPromise),
            Promise.resolve(s.lastKeyWritePromise)
          ]),
          new Promise(r => setTimeout(r, 1500))
        ]);

        if (activeSock) {
          try {
            activeSock.ev?.removeAllListeners('connection.update');
            activeSock.ev?.removeAllListeners('creds.update');
            activeSock.ev?.removeAllListeners('messages.upsert');
            activeSock.end?.(undefined);
          } catch {}
        }

        // 3. Respaldar estado Signal COMPLETO (creds + pre-keys + sessions) a Supabase
        if (s.status === 'connected' || s.connectedPhone || hasValidLinkedCredsOnDisk(s.authDir)) {
          try {
            await Promise.race([
              backupWaSessionAuthToCloud(s, false),
              new Promise((_, rej) => setTimeout(() => rej(new Error('handoff_backup_timeout')), 5500))
            ]);
          } catch (err: any) {
            console.error(`[NASA Handoff] ⚠️ Timeout/error en backup final de ${s.id}: ${err?.message || err}`);
          }
        }
        s.status = 'disconnected';
      }

      // 4. Confirmar al nuevo contenedor que la bóveda WAAUTH-* ya está lista y el socket liberado
      const currentLock = await readCloudLeaderLock();
      const targetEpoch = newerEpoch || currentLock?.bootEpoch || MY_BOOT_EPOCH;
      const targetLeader =
        currentLock && currentLock.bootEpoch >= targetEpoch
          ? currentLock.leaderId
          : MY_INSTANCE_ID;

      await insertOrUpdateSupabaseCodigo(
        'WALOCK-leader',
        JSON.stringify({
          leaderId: targetLeader,
          bootEpoch: targetEpoch,
          phase: 'active',
          yieldedBy: MY_INSTANCE_ID,
          yieldedForEpoch: targetEpoch,
          yieldedAt: Date.now(),
          updatedAt: new Date().toISOString()
        } satisfies WaLeaderLockPayload)
      );

      console.log(`[NASA Handoff] ✅ Traspaso limpio completado en ${Date.now() - t0}ms.`);
    } catch (e: any) {
      console.error(`[NASA Handoff] ❌ Error cediendo liderazgo: ${e?.message || e}`);
    }
  })();

  return yieldInFlightPromise;
}

// Ejecutado por el Contenedor ENTRANTE antes de leer WAAUTH-* y antes de abrir sockets:
// Reclama WALOCK-leader y espera (máx 5.5s) a que el contenedor anterior suelte el socket y suba llaves frescas.
async function claimLeaderLeaseAndAwaitOldContainerHandoff(): Promise<void> {
  if (!isProductionRuntime()) return;
  try {
    const prevLock = await readCloudLeaderLock();
    let prevHeartbeatMs = 0;
    try {
      const hbRows = await querySupabaseCodigos({
        codeFilter: 'eq.WAHEART-beat',
        orderDesc: true,
        limit: 1
      });
      if (Array.isArray(hbRows) && hbRows[0]?.dispositivo) {
        const hb = JSON.parse(hbRows[0].dispositivo);
        if (hb?.alive && hb?.timestamp) {
          prevHeartbeatMs = new Date(hb.timestamp).getTime() || 0;
        }
      }
    } catch {}

    const hadRecentOldContainer =
      (prevLock &&
        prevLock.leaderId !== MY_INSTANCE_ID &&
        Date.now() - (new Date(prevLock.updatedAt || 0).getTime() || 0) < 90_000) ||
      (prevHeartbeatMs > 0 && Date.now() - prevHeartbeatMs < 75_000);

    await insertOrUpdateSupabaseCodigo(
      'WALOCK-leader',
      JSON.stringify({
        leaderId: MY_INSTANCE_ID,
        bootEpoch: MY_BOOT_EPOCH,
        phase: hadRecentOldContainer ? 'claiming' : 'active',
        updatedAt: new Date().toISOString()
      } satisfies WaLeaderLockPayload)
    );

    if (!hadRecentOldContainer) {
      console.log(`[NASA Leader] 👑 Liderazgo directo adquirido por ${MY_INSTANCE_ID} (sin contenedor previo activo).`);
      return;
    }

    console.log(`[NASA Leader] ⏳ Esperando relevo limpio del contenedor anterior antes de abrir socket WhatsApp...`);
    const deadline = Date.now() + 5500;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 450));
      const lockNow = await readCloudLeaderLock();
      if (lockNow && lockNow.bootEpoch > MY_BOOT_EPOCH && lockNow.leaderId !== MY_INSTANCE_ID) {
        // Otro deploy aún más nuevo apareció mientras arrancábamos
        await yieldToNewerDeployLeader('superseded_during_boot', lockNow.bootEpoch);
        return;
      }
      if (lockNow && lockNow.yieldedForEpoch === MY_BOOT_EPOCH) {
        console.log(`[NASA Leader] 🤝 Contenedor anterior (${lockNow.yieldedBy}) entregó llaves y cerró socket. Tomando control limpio.`);
        break;
      }
    }

    await insertOrUpdateSupabaseCodigo(
      'WALOCK-leader',
      JSON.stringify({
        leaderId: MY_INSTANCE_ID,
        bootEpoch: MY_BOOT_EPOCH,
        phase: 'active',
        updatedAt: new Date().toISOString()
      } satisfies WaLeaderLockPayload)
    );
  } catch (e: any) {
    console.warn(`[NASA Leader] ⚠️ Aviso en claimLeaderLease: ${e?.message || e}`);
  }
}

function startNasaLeaderWatcher() {
  if ((globalThis as any).__noeluxNasaLeaderWatcher) return;
  (globalThis as any).__noeluxNasaLeaderWatcher = setInterval(async () => {
    if (!isProductionRuntime() || isYieldingToNewerDeploy()) return;
    try {
      const lock = await readCloudLeaderLock();
      if (lock && lock.leaderId !== MY_INSTANCE_ID && lock.bootEpoch > MY_BOOT_EPOCH) {
        await yieldToNewerDeployLeader(`newer_leader_${lock.leaderId}`, lock.bootEpoch);
      }
    } catch {}
  }, 5000);
}

// Heartbeat cada 45s para telemetría de vida y vigencia del Leader Lease (ultra liviano para Supabase Disk IO)
function startNasaHeartbeat() {
  if ((globalThis as any).__noeluxNasaHeartbeat) return;
  (globalThis as any).__noeluxNasaHeartbeat = setInterval(async () => {
    if (isYieldingToNewerDeploy()) return;
    try {
      const connectedSessions = Array.from(sessionsMap.values()).filter(s => s.status === 'connected');
      if (connectedSessions.length === 0) return;
      const heartbeat = {
        alive: true,
        instanceId: MY_INSTANCE_ID,
        bootEpoch: MY_BOOT_EPOCH,
        pid: process.pid,
        persistentVolume: PERSISTENT_PATHS.isPersistentVolume,
        timestamp: new Date().toISOString(),
        sessions: connectedSessions.map(s => ({ id: s.id, phone: s.connectedPhone })),
        runtime: isProductionRuntime() ? 'production' : 'dev'
      };
      await insertOrUpdateSupabaseCodigo('WAHEART-beat', JSON.stringify(heartbeat));
    } catch {}
  }, 45_000);
}

// Backup periódico de seguridad cada 180s (complementa los backups reactivos instantáneos de creds.update y keys.set)
function startNasaPeriodicBackup() {
  if ((globalThis as any).__noeluxNasaPeriodicBackup) return;
  (globalThis as any).__noeluxNasaPeriodicBackup = setInterval(async () => {
    if (isYieldingToNewerDeploy()) return;
    for (const session of sessionsMap.values()) {
      if (session.status === 'connected' && session.connectedPhone) {
        try {
          await backupWaSessionAuthToCloud(session, false);
        } catch (e: any) {
          console.error(`[NASA Periodic] ❌ Backup periódico ${session.id} falló:`, e?.message || e);
        }
      }
    }
  }, 180_000);
}

export function hasValidLinkedCredsOnDisk(authDir: string): boolean {
  try {
    const credsPath = path.join(authDir, 'creds.json');
    if (!fs.existsSync(credsPath)) return false;
    const raw = fs.readFileSync(credsPath, 'utf-8');
    const parsed = JSON.parse(raw || '{}');
    return Boolean(parsed?.me?.id);
  } catch {
    return false;
  }
}

function isProductionRuntime(): boolean {
  return process.env.DISABLE_WA_AUTOCONNECT !== 'true';
}

// Escanea y limpia únicamente archivos corruptos de 0 bytes o JSON inválido.
// IMPORTANTE: JAMÁS borrar archivos pre-key-*.json ni session-*.json válidos:
// - Baileys genera 812 Pre-Keys al vincular y WhatsApp entrega primero las de menor ID (pre-key-1..462);
//   borrar pre-keys activas causa "Invalid PreKey ID" en los mensajes entrantes de nuevos clientes.
// - El propio protocolo Signal elimina automáticamente cada pre-key individual apenas se consume.
const validatedImmutablePreKeyCache = new Map<string, string>();
const MAX_IMMUTABLE_PREKEY_CACHE = 30000;

function readValidatedAuthJsonFile(
  fullPath: string,
  fileName: string,
  stat: fs.Stats
): string | null {
  const isImmutablePreKey = fileName.startsWith('pre-key-');
  const cacheKey = isImmutablePreKey
    ? `${fullPath}|${stat.size}|${stat.mtimeMs}`
    : '';
  if (isImmutablePreKey && validatedImmutablePreKeyCache.has(cacheKey)) {
    return validatedImmutablePreKeyCache.get(cacheKey)!;
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  JSON.parse(content);
  if (isImmutablePreKey) {
    if (validatedImmutablePreKeyCache.size >= MAX_IMMUTABLE_PREKEY_CACHE) {
      validatedImmutablePreKeyCache.clear();
    }
    validatedImmutablePreKeyCache.set(cacheKey, content);
  }
  return content;
}

export function sanitizeAuthDirectory(authDir: string): { cleanedCount: number } {
  let cleanedCount = 0;
  try {
    if (!fs.existsSync(authDir)) return { cleanedCount: 0 };
    const files = fs.readdirSync(authDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const fullPath = path.join(authDir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          if (stat.size < 2) {
            fs.unlinkSync(fullPath);
            cleanedCount++;
            continue;
          }
          try {
            readValidatedAuthJsonFile(fullPath, file, stat);
          } catch {
            fs.unlinkSync(fullPath);
            cleanedCount++;
          }
        }
      } catch {}
    }
  } catch {}
  return { cleanedCount };
}

export async function backupWaSessionAuthToCloud(
  session: WaSessionRuntime,
  loggedOut = false
): Promise<void> {
  // Serializar backups por sesión para jamás entrelazar dos subidas simultáneas
  const prevInFlight = inFlightAuthBackupBySession.get(session.id);
  if (prevInFlight && !loggedOut) {
    try {
      await prevInFlight;
    } catch {}
  }

  const task = (async () => {
    try {
      if (loggedOut) {
        await deleteSupabaseCodigos(`like.WAAUTH-${session.id}-*`);
        await insertOrUpdateSupabaseCodigo(
          `WAAUTH-${session.id}-${Date.now()}`,
          JSON.stringify({
            sessionId: session.id,
            label: session.label,
            loggedOut: true,
            instanceId: MY_INSTANCE_ID,
            updatedAt: new Date().toISOString()
          })
        );
        return;
      }

      if (!fs.existsSync(session.authDir)) return;

      // Esperar cualquier escritura pendiente de creds o llaves Signal antes de empaquetar
      await Promise.race([
        Promise.allSettled([
          Promise.resolve(session.lastSaveCredsPromise),
          Promise.resolve(session.lastKeyWritePromise)
        ]),
        new Promise(r => setTimeout(r, 1200))
      ]);

      sanitizeAuthDirectory(session.authDir);

      const credsPath = path.join(session.authDir, 'creds.json');
      if (!fs.existsSync(credsPath)) return;

      let parsedCreds: any = null;
      try {
        const rawCreds = fs.readFileSync(credsPath, 'utf-8');
        parsedCreds = JSON.parse(rawCreds || '{}');
      } catch {
        return;
      }

      // Solo respaldar cuando la sesión está genuinamente vinculada a un número (tiene me.id)
      if (!parsedCreds?.me?.id) return;

      const allFiles = fs.readdirSync(session.authDir).filter(f => f.endsWith('.json'));

      const filesMap: Record<string, string> = {};
      for (const fileName of allFiles) {
        try {
          const fullPath = path.join(session.authDir, fileName);
          const stat = fs.statSync(fullPath);
          if (stat.isFile() && stat.size >= 2 && stat.size < 500000) {
            const content = readValidatedAuthJsonFile(fullPath, fileName, stat);
            if (content) {
              filesMap[fileName] = content;
            }
          }
        } catch {}
      }

      if (!filesMap['creds.json']) return;

      const compressedBase64 = zlib
        .gzipSync(Buffer.from(JSON.stringify(filesMap), 'utf-8'))
        .toString('base64');

      const newCode = `WAAUTH-${session.id}-${Date.now()}`;
      const payload = {
        sessionId: session.id,
        label: session.label,
        connectedPhone:
          session.connectedPhone ||
          String(parsedCreds?.me?.id || '').split(':')[0].split('@')[0] ||
          null,
        connectedName: session.connectedName || parsedCreds?.me?.name || session.label,
        createdAt: session.createdAt,
        loggedOut: false,
        instanceId: MY_INSTANCE_ID,
        bootEpoch: MY_BOOT_EPOCH,
        fileCount: Object.keys(filesMap).length,
        filesGzBase64: compressedBase64,
        updatedAt: new Date().toISOString()
      };

      const savedOk = await insertOrUpdateSupabaseCodigo(newCode, JSON.stringify(payload));
      if (savedOk) {
        console.log(
          `[NASA Backup] ✅ Snapshot íntegro ${session.id} (+${payload.connectedPhone || '?'}) guardado — ${Object.keys(filesMap).length} archivos (${(compressedBase64.length / 1024).toFixed(1)}KB)`
        );
        // DOBLE BÓVEDA (N y N-1): Conservar los 2 respaldos más recientes de esta sesión y limpiar solo los más viejos
        try {
          const prevRows = await querySupabaseCodigos({
            select: 'code',
            codeFilter: `like.WAAUTH-${session.id}-*`,
            orderDesc: true,
            limit: 20
          });
          const codesToKeep = new Set<string>([newCode]);
          for (const row of prevRows) {
            if (row?.code && codesToKeep.size < 2) {
              codesToKeep.add(row.code);
            }
          }
          for (const row of prevRows) {
            if (row?.code && !codesToKeep.has(row.code)) {
              await deleteSupabaseCodigos(`eq.${row.code}`);
            }
          }
        } catch {}
      } else {
        console.error(`[NASA Backup] ❌ Supabase no confirmó el guardado de ${newCode}`);
      }
    } catch (e: any) {
      console.error(`[NASA Backup] ❌ Error en backup ${session.id}:`, e?.message || e);
    }
  })();

  inFlightAuthBackupBySession.set(session.id, task);
  try {
    await task;
  } finally {
    if (inFlightAuthBackupBySession.get(session.id) === task) {
      inFlightAuthBackupBySession.delete(session.id);
    }
  }
}

function scheduleWaSessionAuthBackup(session: WaSessionRuntime, delayMs = 4000) {
  if (isYieldingToNewerDeploy()) return;
  const now = Date.now();
  const targetDeadline = now + delayMs;
  const existingTimer = authBackupTimers.get(session.id);
  const existingDeadline = authBackupDeadlines.get(session.id) || 0;

  // JAMÁS cancelar un respaldo que ya está programado para ejecutarse antes que el nuevo delayMs
  if (existingTimer && existingDeadline > now && existingDeadline <= targetDeadline + 250) {
    return;
  }

  if (existingTimer) clearTimeout(existingTimer);
  authBackupDeadlines.set(session.id, targetDeadline);
  const timer = setTimeout(() => {
    authBackupTimers.delete(session.id);
    authBackupDeadlines.delete(session.id);
    if (!isYieldingToNewerDeploy()) {
      backupWaSessionAuthToCloud(session, false).catch(() => { });
    }
  }, delayMs);
  authBackupTimers.set(session.id, timer);
}

export function exportAllWaSessionsAuthBundle(): Array<{
  sessionId: string;
  label: string;
  connectedPhone: string | null;
  connectedName: string | null;
  createdAt: string;
  filesGzBase64: string;
  updatedAt: string;
}> {
  ensureInitialSessionsLoaded();
  const bundle: Array<{
    sessionId: string;
    label: string;
    connectedPhone: string | null;
    connectedName: string | null;
    createdAt: string;
    filesGzBase64: string;
    updatedAt: string;
  }> = [];

  for (const session of sessionsMap.values()) {
    try {
      if (!fs.existsSync(session.authDir)) continue;
      sanitizeAuthDirectory(session.authDir);
      const credsPath = path.join(session.authDir, 'creds.json');
      if (!fs.existsSync(credsPath)) continue;
      const rawCreds = fs.readFileSync(credsPath, 'utf-8');
      const parsedCreds = JSON.parse(rawCreds || '{}');
      if (!parsedCreds?.me?.id) continue;

      const allFiles = fs.readdirSync(session.authDir).filter(f => f.endsWith('.json'));

      const filesMap: Record<string, string> = {};
      for (const fileName of allFiles) {
        try {
          const fullPath = path.join(session.authDir, fileName);
          const stat = fs.statSync(fullPath);
          if (stat.isFile() && stat.size >= 2 && stat.size < 250000) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            JSON.parse(content);
            filesMap[fileName] = content;
          }
        } catch {}
      }
      if (!filesMap['creds.json']) continue;

      const compressedBase64 = zlib
        .gzipSync(Buffer.from(JSON.stringify(filesMap), 'utf-8'))
        .toString('base64');

      bundle.push({
        sessionId: session.id,
        label: session.label,
        connectedPhone:
          session.connectedPhone ||
          String(parsedCreds?.me?.id || '').split(':')[0].split('@')[0] ||
          null,
        connectedName: session.connectedName || parsedCreds?.me?.name || session.label,
        createdAt: session.createdAt,
        filesGzBase64: compressedBase64,
        updatedAt: new Date().toISOString()
      });
    } catch {}
  }
  return bundle;
}

export async function restoreWaSessionsFromVaultBundle(
  vaultSessions: Array<{
    sessionId?: string;
    label?: string;
    connectedPhone?: string | null;
    connectedName?: string | null;
    createdAt?: string;
    filesGzBase64?: string;
  }>
): Promise<{ restoredCount: number; restoredPhones: string[] }> {
  ensureInitialSessionsLoaded();
  let restoredCount = 0;
  const restoredPhones: string[] = [];
  if (!Array.isArray(vaultSessions) || vaultSessions.length === 0) {
    return { restoredCount: 0, restoredPhones: [] };
  }

  for (const data of vaultSessions) {
    try {
      const sessionId = String(data?.sessionId || 'wa-1');
      if (!data?.filesGzBase64) continue;
      const session = getOrCreateSessionRuntime(sessionId, data.label, data.createdAt);

      // Si ya está conectada activamente en este contenedor, no la interrumpimos
      if (session.status === 'connected' && session.connectedPhone) {
        continue;
      }

      const localCredsPath = path.join(session.authDir, 'creds.json');
      let hasValidLocalCreds = false;
      if (fs.existsSync(localCredsPath)) {
        try {
          const localCreds = JSON.parse(fs.readFileSync(localCredsPath, 'utf-8') || '{}');
          if (localCreds?.me?.id) {
            hasValidLocalCreds = true;
          }
        } catch {}
      }

      if (!hasValidLocalCreds) {
        const decompressed = zlib
          .gunzipSync(Buffer.from(data.filesGzBase64, 'base64'))
          .toString('utf-8');
        const filesMap = JSON.parse(decompressed || '{}');
        if (filesMap && typeof filesMap === 'object' && filesMap['creds.json']) {
          await stopSessionSocket(session, false);
          fs.mkdirSync(session.authDir, { recursive: true });
          for (const [fileName, fileContent] of Object.entries(filesMap)) {
            if (
              typeof fileContent === 'string' &&
              fileContent.trim().length >= 2 &&
              !fileName.includes('..') &&
              !fileName.includes('/')
            ) {
              try {
                JSON.parse(fileContent);
                const targetFile = path.join(session.authDir, fileName);
                const tmpFile = targetFile + '.tmp';
                fs.writeFileSync(tmpFile, fileContent, 'utf-8');
                fs.renameSync(tmpFile, targetFile);
              } catch {}
            }
          }
          sanitizeAuthDirectory(session.authDir);
          if (data.connectedPhone) session.connectedPhone = String(data.connectedPhone);
          if (data.connectedName) session.connectedName = String(data.connectedName);
          restoredCount++;
          if (session.connectedPhone) restoredPhones.push(session.connectedPhone);
          // Si estamos en producción (Railway), reconectar el socket inmediatamente con las credenciales restauradas
          if (isProductionRuntime()) {
            connectWhatsAppEngine(false, session.id).catch(() => {});
          }
        }
      } else if (isProductionRuntime() && session.status !== 'connected' && !session.isConnecting) {
        connectWhatsAppEngine(false, session.id).catch(() => {});
      }
    } catch {}
  }

  if (restoredCount > 0) {
    const storage = loadChatsStorage();
    saveChatsStorage(storage);
  }
  return { restoredCount, restoredPhones };
}

async function restoreCloudStateAndWaSessionsOnBoot(): Promise<void> {
  // 0. Restaurar historial de chats y pasos de conversación (WAENG-*) desde Supabase antes de cargar pedidos
  try {
    const engRows = await querySupabaseCodigos({
      codeFilter: 'like.WAENG-*',
      orderDesc: true,
      limit: 3
    });
    if (Array.isArray(engRows) && engRows.length > 0) {
      const latest = engRows.find((r: any) => r?.dispositivo);
      if (latest?.dispositivo) {
        const parsedEng = JSON.parse(latest.dispositivo);
        const storage = loadChatsStorage();
        let restoredAny = false;
        if (parsedEng.chats && typeof parsedEng.chats === 'object') {
          for (const [ph, msgs] of Object.entries(parsedEng.chats)) {
            if (Array.isArray(msgs) && msgs.length > 0 && (!storage.chats[ph] || storage.chats[ph].length === 0)) {
              storage.chats[ph] = msgs as WaChatMessage[];
              restoredAny = true;
            }
          }
        }
        if (parsedEng.convSteps && typeof parsedEng.convSteps === 'object') {
          for (const [ph, st] of Object.entries(parsedEng.convSteps)) {
            const numSt = Number(st) || 1;
            if (numSt > (storage.convSteps[ph] || 1)) {
              storage.convSteps[ph] = numSt;
              restoredAny = true;
            }
          }
        }
        if (parsedEng.chatModes && typeof parsedEng.chatModes === 'object') {
          storage.chatModes = { ...parsedEng.chatModes, ...storage.chatModes };
          restoredAny = true;
        }
        if (parsedEng.customerChannels && typeof parsedEng.customerChannels === 'object') {
          storage.customerChannels = { ...parsedEng.customerChannels, ...storage.customerChannels };
          restoredAny = true;
        }
        if (restoredAny) {
          saveChatsStorage(storage);
        }
      }
    }
  } catch (e) { }

  // 1. Restaurar voz permanente (WAVOICE-* y CFG-*) y pedidos antes de conectar
  try {
    await pollCloudCommandsAndOrders();
  } catch (e) { }

  if (!isProductionRuntime()) {
    skipDevAutoConnectBecauseProdActive = true;
    return;
  }

  // 2. RELEVO ATÓMICO NASA: Reclamar liderazgo y esperar a que el contenedor anterior suelte el socket y suba su último WAAUTH-*
  await claimLeaderLeaseAndAwaitOldContainerHandoff();
  if (isYieldingToNewerDeploy()) {
    return;
  }

  // 3. Restaurar credenciales Baileys (WAAUTH-*) desde Supabase al disco local (con Doble Bóveda N / N-1 y Escudo Anti-504)
  try {
    let authQuery = { ok: false, status: 504, rows: [] as any[] };
    for (let attempt = 1; attempt <= 3; attempt++) {
      authQuery = await querySupabaseCodigosWithStatus({
        codeFilter: 'like.WAAUTH-*',
        orderDesc: true,
        limit: 12,
        timeoutMs: 20000
      });
      if (authQuery.ok) break;
      console.warn(
        `[NASA Restore] ⏳ Supabase devolvió HTTP ${authQuery.status} al leer WAAUTH-* (intento ${attempt}/3)...`
      );
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
    }

    // Si Supabase está caído con 504 y NO hay credenciales en Volumen local, activar auto-reintento en segundo plano
    // en lugar de iniciar una sesión en blanco que pida QR innecesariamente:
    const anyLocalLinked = Array.from(sessionsMap.values()).some(s => hasValidLinkedCredsOnDisk(s.authDir));
    if (!authQuery.ok && !anyLocalLinked) {
      console.error(
        `[NASA Anti-504] 🛡️ Supabase no responde (HTTP ${authQuery.status}). Reintentando recuperar sesión WAAUTH-* cada 12s en segundo plano...`
      );
      const retryTimer = setInterval(async () => {
        if (isYieldingToNewerDeploy()) {
          clearInterval(retryTimer);
          return;
        }
        const probe = await querySupabaseCodigosWithStatus({
          codeFilter: 'like.WAAUTH-*',
          orderDesc: true,
          limit: 10,
          timeoutMs: 18000
        });
        if (!probe.ok) return;
        clearInterval(retryTimer);
        for (const row of probe.rows) {
          if (!row?.dispositivo) continue;
          try {
            const d = JSON.parse(row.dispositivo);
            const sid = String(d?.sessionId || 'wa-1');
            if (!d?.loggedOut && d?.filesGzBase64) {
              if (applyCloudAuthBundleToSessionDisk(sid, d, false)) {
                const s = sessionsMap.get(sid);
                if (s && s.status !== 'connected') {
                  await stopSessionSocket(s, false);
                  connectWhatsAppEngine(false, sid).catch(() => {});
                }
                break;
              }
            }
          } catch {}
        }
      }, 12000);
      return;
    }

    const authRows = authQuery.rows;
    if (!Array.isArray(authRows) || authRows.length === 0) return;

    const restoredSessions = new Set<string>();
    const explicitlyLoggedOutSessions = new Set<string>();

    for (const row of authRows) {
      if (!row?.dispositivo) continue;
      try {
        const data = JSON.parse(row.dispositivo);
        const sessionId = String(data?.sessionId || 'wa-1');
        if (restoredSessions.has(sessionId) || explicitlyLoggedOutSessions.has(sessionId)) continue;

        if (data?.loggedOut) {
          explicitlyLoggedOutSessions.add(sessionId);
          continue;
        }
        if (!data?.filesGzBase64) continue;

        // Si ya estamos en Volumen Persistente (/data) con sesión activa local, no sobreescribir el ratchet local más nuevo
        const overwriteLocal = !PERSISTENT_PATHS.isPersistentVolume;
        const ok = applyCloudAuthBundleToSessionDisk(sessionId, data, overwriteLocal);
        if (ok) {
          restoredSessions.add(sessionId);
        }
      } catch (e: any) {
        console.warn(`[NASA Restore] ⚠️ Fila WAAUTH dañada ignorada (probando respaldo N-1): ${e?.message || e}`);
      }
    }
    const storage = loadChatsStorage();
    saveChatsStorage(storage);
  } catch (e) { }
}

function applyCloudAuthBundleToSessionDisk(
  sessionId: string,
  data: any,
  forceOverwriteIfCloudNewer = true
): boolean {
  try {
    const session = getOrCreateSessionRuntime(sessionId, data?.label, data?.createdAt);
    const localCredsPath = path.join(session.authDir, 'creds.json');
    if (!forceOverwriteIfCloudNewer && hasValidLinkedCredsOnDisk(session.authDir)) {
      return true;
    }

    const decompressed = zlib
      .gunzipSync(Buffer.from(data.filesGzBase64, 'base64'))
      .toString('utf-8');
    const filesMap = JSON.parse(decompressed || '{}');
    if (!filesMap || typeof filesMap !== 'object' || !filesMap['creds.json']) {
      return false;
    }

    const parsedCloudCreds = JSON.parse(filesMap['creds.json'] || '{}');
    if (!parsedCloudCreds?.me?.id) {
      return false;
    }

    fs.mkdirSync(session.authDir, { recursive: true });
    for (const [fileName, fileContent] of Object.entries(filesMap)) {
      if (
        typeof fileContent === 'string' &&
        fileContent.trim().length >= 2 &&
        !fileName.includes('..') &&
        !fileName.includes('/')
      ) {
        try {
          JSON.parse(fileContent);
          const targetFile = path.join(session.authDir, fileName);
          const tmpFile = targetFile + '.tmp';
          fs.writeFileSync(tmpFile, fileContent, 'utf-8');
          fs.renameSync(tmpFile, targetFile);
        } catch {}
      }
    }
    sanitizeAuthDirectory(session.authDir);
    if (data.connectedPhone) session.connectedPhone = String(data.connectedPhone);
    if (data.connectedName) session.connectedName = String(data.connectedName);

    const verifiedOk = hasValidLinkedCredsOnDisk(localCredsPath ? session.authDir : session.authDir);
    if (verifiedOk) {
      console.log(
        `[NASA Restore] ✅ Sesión ${sessionId} (+${session.connectedPhone || ''}) hidratada y VERIFICADA desde Supabase (${Object.keys(filesMap).length} archivos Signal)`
      );
      return true;
    }
  } catch (err: any) {
    console.warn(`[NASA Restore] ⚠️ Error aplicando snapshot en ${sessionId}: ${err?.message || err}`);
  }
  return false;
}

// Re-hidratación de emergencia desde la Bóveda N-1 si un disco local sufrió corrupción transitoria
async function rehydrateSessionFromCloudBackupFallback(
  sessionId: string,
  preferSecondLatest = false
): Promise<boolean> {
  try {
    const rows = await querySupabaseCodigos({
      codeFilter: `like.WAAUTH-${sessionId}-*`,
      orderDesc: true,
      limit: 5
    });
    if (!Array.isArray(rows) || rows.length === 0) return false;
    const validCandidates: any[] = [];
    for (const r of rows) {
      if (!r?.dispositivo) continue;
      try {
        const parsed = JSON.parse(r.dispositivo);
        if (parsed?.loggedOut) return false;
        if (parsed?.filesGzBase64) validCandidates.push(parsed);
      } catch {}
    }
    if (validCandidates.length === 0) return false;
    const target = preferSecondLatest && validCandidates.length >= 2
      ? validCandidates[1]
      : validCandidates[0];
    return applyCloudAuthBundleToSessionDisk(sessionId, target, true);
  } catch {
    return false;
  }
}

let bootCloudRestoreFinished = false;
export function isBootCloudRestoreFinished(): boolean {
  return bootCloudRestoreFinished;
}

export function ensureBootCloudRestoreCompleted(): Promise<void> {
  if (!bootRestorePromise) {
    bootRestorePromise = restoreCloudStateAndWaSessionsOnBoot()
      .catch(() => { })
      .finally(() => {
        bootCloudRestoreFinished = true;
      });
  }
  return bootRestorePromise;
}

// Cleanly tear down a specific session's socket without triggering reconnect loops
async function stopSessionSocket(session: WaSessionRuntime, clearSession = true): Promise<void> {
  session.socketSeq++;
  session.isConnecting = false;
  const oldSock = session.sock;
  session.sock = null;

  if (oldSock) {
    try {
      oldSock.ev?.removeAllListeners('connection.update');
      oldSock.ev?.removeAllListeners('creds.update');
      oldSock.ev?.removeAllListeners('messages.upsert');
      if (clearSession && session.status === 'connected') {
        await oldSock.logout();
      } else {
        oldSock.end(undefined);
      }
    } catch (e) { }
  }

  if (clearSession) {
    try {
      if (fs.existsSync(session.authDir)) {
        fs.rmSync(session.authDir, { recursive: true, force: true });
      }
    } catch (e) { }
    await backupWaSessionAuthToCloud(session, true).catch(() => { });
  }
}

// Add a new WhatsApp account/session slot (supports unlimited WhatsApp numbers!)
export async function addWhatsAppSession(
  label?: string,
  customId?: string
): Promise<WaSessionSummary> {
  ensureInitialSessionsLoaded();
  const id = customId || `wa-${Date.now()}`;
  const cleanLabel = (label || '').trim() || `WhatsApp #${sessionsMap.size + 1}`;
  const session = getOrCreateSessionRuntime(id, cleanLabel);
  const storage = loadChatsStorage();
  saveChatsStorage(storage);
  await connectWhatsAppEngine(false, session.id);
  scheduleCloudStateSync(true);
  return {
    id: session.id,
    label: session.label,
    status: session.status,
    qrDataUrl: session.qrDataUrl,
    pairingCode: session.pairingCode,
    connectedPhone: session.connectedPhone,
    connectedName: session.connectedName,
    lastError: session.lastError,
    createdAt: session.createdAt
  };
}

// Remove a WhatsApp session slot
export async function removeWhatsAppSession(
  sessionId: string,
  confirmCode?: string
): Promise<boolean> {
  ensureInitialSessionsLoaded();
  const session = sessionsMap.get(sessionId);
  if (!session) return false;

  const isLinked =
    session.status === 'connected' ||
    Boolean(session.connectedPhone) ||
    hasValidLinkedCredsOnDisk(session.authDir);

  if (isLinked && confirmCode !== MANUAL_DISCONNECT_CONFIRM_CODE) {
    throw new Error(
      '🛡️ Bloqueo de seguridad antidesconexión activo: No se permite eliminar una sesión vinculada sin el código de seguridad explícito (CONFIRMAR_DESCONEXION_MANUAL).'
    );
  }

  await stopSessionSocket(session, true);
  sessionsMap.delete(sessionId);

  // Ensure at least 1 default slot remains
  if (sessionsMap.size === 0) {
    const def = getOrCreateSessionRuntime('wa-1', 'WhatsApp Principal #1');
    connectWhatsAppEngine(false, def.id).catch(() => { });
  }

  const storage = loadChatsStorage();
  saveChatsStorage(storage);
  scheduleCloudStateSync(true);
  return true;
}

// Start or restart a Baileys WhatsApp session
export async function connectWhatsAppEngine(
  forceNewQr = false,
  sessionId?: string
): Promise<WaEngineState> {
  if ((globalThis as any).__noeluxEngineGen !== myEngineGen || isYieldingToNewerDeploy()) {
    return getWhatsAppEngineState();
  }
  if (!forceNewQr) {
    await ensureBootCloudRestoreCompleted();
    if (isYieldingToNewerDeploy() || (skipDevAutoConnectBecauseProdActive && !isProductionRuntime())) {
      return getWhatsAppEngineState();
    }
  } else {
    skipDevAutoConnectBecauseProdActive = false;
  }
  ensureInitialSessionsLoaded();
  const targetId = sessionId || Array.from(sessionsMap.keys())[0] || 'wa-1';
  const session = getOrCreateSessionRuntime(targetId);

  try {
    if (forceNewQr) {
      // BLINDAJE ANTIDESCONEXIÓN: Si la sesión ya tiene credenciales válidas (me.id) en disco o está conectada,
      // jamás borrar authDir con forceNewQr; solo hacer reconexión suave (stopSessionSocket(session, false)).
      const hasLinkedCreds =
        session.status === 'connected' ||
        Boolean(session.connectedPhone) ||
        hasValidLinkedCredsOnDisk(session.authDir);
      await stopSessionSocket(session, !hasLinkedCreds);
      session.status = hasLinkedCreds ? 'syncing' : 'connecting';
      session.qrDataUrl = null;
      session.pairingCode = null;
      if (!hasLinkedCreds) {
        session.connectedPhone = null;
        session.connectedName = null;
      }
      session.lastError = null;
    }

    if (session.isConnecting) {
      return getWhatsAppEngineState();
    }

    if (
      session.sock &&
      (session.status === 'connected' ||
        session.status === 'qr_ready' ||
        session.status === 'syncing')
    ) {
      return getWhatsAppEngineState();
    }

    session.isConnecting = true;
    const mySeq = ++session.socketSeq;

    if (session.status !== 'syncing') {
      session.status = 'connecting';
    }
    session.lastError = null;
    scheduleCloudStateSync(false);

    if (!fs.existsSync(session.authDir)) {
      fs.mkdirSync(session.authDir, { recursive: true });
    }
    sanitizeAuthDirectory(session.authDir);

    await session.lastSaveCredsPromise.catch(() => { });
    const { state, saveCreds } = await useMultiFileAuthState(session.authDir);

    let version: [number, number, number] = [2, 3000, 1052855845];
    try {
      const waWeb = await fetchLatestWaWebVersion({});
      if (waWeb?.version && Array.isArray(waWeb.version)) {
        version = waWeb.version as [number, number, number];
      } else {
        const latest = await fetchLatestBaileysVersion();
        if (latest?.version) version = latest.version;
      }
    } catch (e) { }

    if (
      (globalThis as any).__noeluxEngineGen !== myEngineGen ||
      mySeq !== session.socketSeq ||
      isYieldingToNewerDeploy()
    ) {
      session.isConnecting = false;
      return getWhatsAppEngineState();
    }

    // Interceptor Criptográfico Signal en Vivo: rastrea cada escritura de session-*, sender-key-*, pre-key-* y lid-mapping-*
    const rawKeysSet = state.keys.set.bind(state.keys);
    state.keys.set = async (data: any) => {
      const writePromise = Promise.resolve(rawKeysSet(data));
      session.lastKeyWritePromise = writePromise;
      try {
        await writePromise;
        if (!isYieldingToNewerDeploy() && (session.status === 'connected' || Boolean(state.creds?.me?.id))) {
          const touchedCriticalRatchet = Boolean(
            data?.session || data?.['app-state-sync-key'] || data?.['sender-key'] || data?.['lid-mapping']
          );
          scheduleWaSessionAuthBackup(session, touchedCriticalRatchet ? 2500 : 4500);
        }
      } catch (err) {
        throw err;
      }
    };

    const cacheableKeys = makeCacheableSignalKeyStore(state.keys, silentLogger);
    const userDevicesCache = createSelfChatSafeUserDevicesCache(() => {
      const own: string[] = [];
      const pnUser = String(
        session.connectedPhone ||
        state.creds?.me?.id?.split(':')[0]?.split('@')[0] ||
        ''
      ).replace(/\D/g, '');
      const lidUser = String(
        session.connectedLid ||
        state.creds?.me?.lid?.split(':')[0]?.split('@')[0] ||
        ''
      ).replace(/\D/g, '');
      if (pnUser) own.push(pnUser);
      if (lidUser) own.push(lidUser);
      return own;
    });

    let lastBaileysDiagSig = '';
    let lastBaileysDiagAt = 0;
    const baileysLogger = createBaileysDiagnosticLogger((level, msg, metaText, bindings) => {
      const summary = `${msg}${metaText ? ' [' + metaText + ']' : ''}`.slice(0, 180);
      const lowerSummary = summary.toLowerCase();
      if (
        lowerSummary.includes('connection errored') ||
        lowerSummary.includes('websocket') ||
        lowerSummary.includes('stream errored') ||
        lowerSummary.includes('timed out') ||
        lowerSummary.includes('timeout') ||
        lowerSummary.includes('pre-key') ||
        lowerSummary.includes('closed')
      ) {
        return;
      }
      if (level === 'info') {
        return;
      }
      const sig = `${level}:${msg}:${metaText}`;
      const nowMs = Date.now();
      if (sig === lastBaileysDiagSig && nowMs - lastBaileysDiagAt < 4000) {
        return;
      }
      lastBaileysDiagSig = sig;
      lastBaileysDiagAt = nowMs;
      recordIncomingDiagnostic({
        remoteJid: String(bindings?.class || bindings?.jid || 'baileys'),
        hasMessage: false,
        status: `baileys_${level}:${summary.slice(0, 130)}`
      });
    });

    const newSock = makeWASocket({
      version,
      logger: baileysLogger as any,
      auth: {
        creds: state.creds,
        keys: cacheableKeys
      },
      userDevicesCache,
      browser: Browsers.macOS('Chrome'),
      printQRInTerminal: false,
      syncFullHistory: false,
      // Skip FULL (2) and RECENT (3) history syncs so Baileys transitions immediately to Online (0ms event buffer delay)
      // while allowing NON_BLOCKING_DATA (5) which carries lidPnMappings from the phone
      shouldSyncHistoryMessage: ({ syncType }: any) => syncType !== 2 && syncType !== 3,
      // Deduplicar destinatarios en envíos 1-a-1 y Self-Chat únicamente cuando hay duplicados reales
      patchMessageBeforeSending: (msg: any, recipientJids?: string[]) =>
        dedupePatchMessageBeforeSending(msg, recipientJids),
      maxMsgRetryCount: 6,
      getMessage: async (key: any) => {
        if (key?.id && recentSentProtoMessages.has(key.id)) {
          return recentSentProtoMessages.get(key.id);
        }
        return undefined;
      },
      markOnlineOnConnect: true,
      enableAutoSessionRecreation: true,
      retryRequestDelayMs: 250,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    });

    // Wire-level tap: confirma si los stanzas CB:message / CB:notification / CB:ack llegan del servidor WA
    // incluso antes de descifrado Signal o event-buffer. Cero mutación, solo telemetría.
    const resolveSelfDigitsSnapshot = () => {
      const selfPn = normalizeWaPhone(
        session.connectedPhone ||
        String(state.creds?.me?.id || (newSock.user as any)?.id || '').split('@')[0].split(':')[0]
      );
      const selfLid = String(
        session.connectedLid ||
        (state.creds?.me as any)?.lid ||
        (newSock.user as any)?.lid ||
        ''
      ).split('@')[0].split(':')[0].replace(/\D/g, '');
      return { selfPn, selfLid };
    };

    try {
      (newSock as any).ws?.on?.('CB:message', (node: any) => {
        try {
          const meta = extractWireMessageTelemetry(node);
          if (!meta) return;
          const summary = `wire_cb_message:type=${meta.type}|cat=${meta.category || '-'}|from=${meta.from}|to=${meta.recipient || '-'}|part=${meta.participant || '-'}|enc=${meta.encTypes.join(',') || 'none'}|off=${meta.offline || '-'}`;
          console.log(`[WA Wire CB:message] id=${meta.id} ${summary}`);
          recordIncomingDiagnostic({
            remoteJid: meta.from || meta.recipient || 'wire',
            senderPn: meta.senderPn || meta.senderLid || undefined,
            resolvedPhone: resolveJidToCleanPhone(session, meta.senderPn || meta.from || meta.recipient),
            hasMessage: meta.encTypes.length > 0,
            status: `${summary}|id=${meta.id}`.slice(0, 160)
          });
        } catch { }
      });

      (newSock as any).ws?.on?.('CB:notification', (node: any) => {
        try {
          const nType = String(node?.attrs?.type || '');
          if (nType !== 'devices' && nType !== 'encrypt' && nType !== 'account_sync') return;
          const from = String(node?.attrs?.from || '');
          console.log(`[WA Wire CB:notification] type=${nType} from=${from}`);
          recordIncomingDiagnostic({
            remoteJid: from || 'notification',
            hasMessage: false,
            status: `wire_cb_notif:${nType}:${from}`.slice(0, 140)
          });
        } catch { }
      });

      (newSock as any).ws?.on?.('CB:ack,class:message', (node: any) => {
        try {
          const errAttr = String(node?.attrs?.error || '').trim();
          if (!errAttr) return;
          const from = String(node?.attrs?.from || '');
          const id = String(node?.attrs?.id || '');
          console.warn(`[WA Wire CB:ack ERR] id=${id} from=${from} err=${errAttr}`);
          recordIncomingDiagnostic({
            remoteJid: from || 'ack',
            hasMessage: false,
            status: `wire_cb_ack_err:${errAttr}:${id}`.slice(0, 140)
          });
        } catch { }
      });
    } catch { }

    // Monitorización Signal nativa previa al wrapper de auto-recreación de sesión:
    // registra errores reales (ej. 'Key used already or never filled', 'Bad MAC') y descifrados de Self-Chat.
    try {
      const prePatchSignalRepo = (newSock as any).signalRepository;
      if (prePatchSignalRepo && typeof prePatchSignalRepo.decryptMessage === 'function') {
        const nativeDecryptMessage = prePatchSignalRepo.decryptMessage.bind(prePatchSignalRepo);
        prePatchSignalRepo.decryptMessage = async (opts: any) => {
          const jid = String(opts?.jid || '');
          const type = String(opts?.type || '');
          const { selfPn, selfLid } = resolveSelfDigitsSnapshot();
          const jidDigits = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
          const isSelfSignalJid = Boolean(
            jidDigits && ((selfPn && jidDigits === selfPn) || (selfLid && jidDigits === selfLid))
          );
          try {
            const plain = await nativeDecryptMessage(opts);
            if (isSelfSignalJid) {
              console.log(`[WA Signal Decrypt OK Self] jid=${jid} type=${type}`);
              recordIncomingDiagnostic({
                remoteJid: jid,
                resolvedPhone: selfPn || null,
                hasMessage: true,
                status: `signal_decrypt_ok_self:${type}:${jid}`.slice(0, 140)
              });
            }
            return plain;
          } catch (sigErr: any) {
            const rawErrMsg = String(sigErr?.message || sigErr || 'unknown');
            console.warn(`[WA Signal Decrypt ERR] jid=${jid} type=${type} err=${rawErrMsg}`);
            recordIncomingDiagnostic({
              remoteJid: jid || 'signal',
              resolvedPhone: isSelfSignalJid ? selfPn || null : resolveJidToCleanPhone(session, jid),
              hasMessage: false,
              status: `signal_decrypt_err:${type}:${rawErrMsg}`.slice(0, 160)
            });
            throw sigErr;
          }
        };
      }
    } catch { }

    // Watchdog anti-congelamiento del EventBuffer: si ev.isBuffering() queda atascado >= 4s seguidos, fuerza ev.flush()
    let consecutiveBufferingHits = 0;
    const evBufferWatchdog = setInterval(() => {
      try {
        if ((globalThis as any).__noeluxEngineGen !== myEngineGen || session.sock !== newSock) {
          clearInterval(evBufferWatchdog);
          return;
        }
        const evAny = newSock.ev as any;
        if (typeof evAny?.isBuffering === 'function' && evAny.isBuffering()) {
          consecutiveBufferingHits++;
          if (consecutiveBufferingHits >= 2 && typeof evAny.flush === 'function') {
            consecutiveBufferingHits = 0;
            evAny.flush();
            console.warn(`[WA EventBuffer Watchdog] session=${session.id} stuck buffering -> forced flush()`);
            recordIncomingDiagnostic({
              remoteJid: 'ev_buffer',
              hasMessage: false,
              status: 'ev_buffer_stuck_flushed'
            });
          }
        } else {
          consecutiveBufferingHits = 0;
        }
      } catch { }
    }, 4000);
    evBufferWatchdog.unref?.();

    // =========================================================================
    // BLINDAJE CRIPTOGRÁFICO SIGNAL PARA BAILEYS 7.0.0-rc14:
    // 1. Evita que getUSyncDevices -> assertSessions(lids, true) cierre y destruya sesiones Signal sanas al enviar mensajes.
    // 2. Convierte 'Key used already or never filled' (MISSING_KEYS_ERROR_TEXT) en un error recuperable ('Bad MAC')
    //    para que Baileys envíe un retry receipt nativo en vez de descartar el mensaje con NACK 487, SIN borrar la sesión en el primer intento.
    // =========================================================================
    const forceRecreateSignalAddrs = new Set<string>();
    const rawSignalRepo = (newSock as any).signalRepository;
    if (rawSignalRepo) {
      if (typeof rawSignalRepo.injectE2ESession === 'function') {
        const origInjectE2ESession = rawSignalRepo.injectE2ESession.bind(rawSignalRepo);
        rawSignalRepo.injectE2ESession = async (opts: any) => {
          try {
            const jid = String(opts?.jid || '');
            const addr =
              jid && typeof rawSignalRepo.jidToSignalProtocolAddress === 'function'
                ? String(rawSignalRepo.jidToSignalProtocolAddress(jid))
                : '';
            if (addr && !forceRecreateSignalAddrs.has(addr)) {
              const validation = await rawSignalRepo.validateSession(jid);
              if (validation?.exists) {
                return;
              }
            }
            if (addr) {
              forceRecreateSignalAddrs.delete(addr);
            }
          } catch {}
          return origInjectE2ESession(opts);
        };
      }

      if (typeof rawSignalRepo.decryptMessage === 'function') {
        const origDecryptMessage = rawSignalRepo.decryptMessage.bind(rawSignalRepo);
        rawSignalRepo.decryptMessage = async (opts: any) => {
          try {
            return await origDecryptMessage(opts);
          } catch (err: any) {
            const errMsg = String(err?.message || err || '');
            const jid = String(opts?.jid || '');
            try {
              const addr =
                jid && typeof rawSignalRepo.jidToSignalProtocolAddress === 'function'
                  ? String(rawSignalRepo.jidToSignalProtocolAddress(jid))
                  : '';
              if (addr) {
                forceRecreateSignalAddrs.add(addr);
              }
            } catch {}
            if (err && typeof err === 'object' && errMsg.includes('Key used already or never filled')) {
              err.message = 'Bad MAC';
            }
            throw err;
          }
        };
      }
    }

    session.sock = newSock;
    session.creds = state.creds;
    if (state.creds?.me?.lid) {
      session.connectedLid = state.creds.me.lid;
    }
    session.isConnecting = false;

    let lastSeenNextPreKeyId = Number(state.creds?.nextPreKeyId || 0);
    let lastSeenMeId = String(state.creds?.me?.id || '');
    newSock.ev.on('creds.update', async () => {
      try {
        session.creds = state.creds;
        if (state.creds?.me?.lid) {
          session.connectedLid = state.creds.me.lid;
          const cleanP = normalizeWaPhone(session.connectedPhone || state.creds.me.id || '');
          const lidDigits = state.creds.me.lid.split('@')[0].split(':')[0].replace(/\D/g, '');
          if (cleanP && lidDigits) {
            lidToPhoneCache.set(lidDigits, cleanP);
            phoneToLidCache.set(cleanP, lidDigits);
          }
        }
        session.lastSaveCredsPromise = saveCreds();
        await session.lastSaveCredsPromise;

        const currMeId = String(state.creds?.me?.id || '');
        const currNextPreKeyId = Number(state.creds?.nextPreKeyId || 0);
        const preKeysChanged = currNextPreKeyId !== lastSeenNextPreKeyId;
        const identityChanged = currMeId && currMeId !== lastSeenMeId && lastSeenMeId !== '';
        lastSeenNextPreKeyId = currNextPreKeyId;
        lastSeenMeId = currMeId;

        if (!isYieldingToNewerDeploy() && (session.status === 'connected' || Boolean(newSock.user?.id || state.creds?.me?.id))) {
          if (identityChanged) {
            console.log(`[NASA Signal] 🚨 Identidad vinculada/actualizada en ${session.id} (${currMeId}) — backup inmediato`);
            backupWaSessionAuthToCloud(session, false).catch((e: any) => {
              console.error(`[NASA Signal] ❌ Backup inmediato falló:`, e?.message || e);
            });
          } else {
            scheduleWaSessionAuthBackup(session, preKeysChanged ? 1800 : 4000);
          }
        }
      } catch (credErr: any) {
        console.error(`[NASA creds.update] ❌ Error guardando credenciales: ${credErr?.message || credErr}`);
      }
    });

    newSock.ev.on('connection.update', async (update) => {
      if ((globalThis as any).__noeluxEngineGen !== myEngineGen) return;
      if (mySeq !== session.socketSeq || session.sock !== newSock) return;

      const { connection, lastDisconnect, qr, isNewLogin } = update;

      if (isNewLogin) {
        session.status = 'syncing';
        session.qrDataUrl = null;
        session.pairingCode = null;
        session.lastError = null;
        scheduleCloudStateSync(true);
        scheduleWaSessionAuthBackup(session, 1500);
      }

      if (qr && session.status !== 'connected') {
        try {
          const dataUrl = await QRCode.toDataURL(qr, {
            width: 320,
            margin: 2,
            color: {
              dark: '#062319',
              light: '#ffffff'
            }
          });
          if (mySeq !== session.socketSeq || session.sock !== newSock) return;
          session.status = 'qr_ready';
          session.qrDataUrl = dataUrl;
          session.lastError = null;
          scheduleCloudStateSync(true);
        } catch (err: any) {
          session.lastError = err?.message || 'Error generando QR';
        }
      }

      if (connection === 'open') {
        consecutiveLogoutCodes.set(session.id, 0);
        const rawUserId = newSock.user?.id || state.creds?.me?.id || '';
        const phonePart = rawUserId.split(':')[0].split('@')[0];
        const rawLid = state.creds?.me?.lid || (newSock.user as any)?.lid || '';
        session.status = 'connected';
        session.qrDataUrl = null;
        session.pairingCode = null;
        session.connectedPhone = phonePart || null;
        session.connectedName =
          newSock.user?.name || state.creds?.me?.name || session.label;
        session.connectedLid = rawLid || null;
        session.creds = state.creds;
        session.lastError = null;

        console.log(`[NASA] ✅ WhatsApp ${session.id} CONECTADO (+${phonePart || '?'}) — sesión activa y protegida`);

        if (phonePart && rawLid) {
          const cleanP = normalizeWaPhone(phonePart);
          const lidDigits = rawLid.split('@')[0].split(':')[0].replace(/\D/g, '');
          if (cleanP && lidDigits) {
            lidToPhoneCache.set(lidDigits, cleanP);
            phoneToLidCache.set(cleanP, lidDigits);
          }
        }

        scheduleCloudStateSync(true);
        try {
          (newSock.ev as any).flush?.();
        } catch {}

        // Respaldar credenciales al conectar y auto-curar si el directorio local tiene menos de 400 pre-keys
        // (ej. si una versión anterior podó pre-key-1..462 tras el emparejamiento inicial de 812 llaves):
        (async () => {
          try {
            let localPreKeyCount = 0;
            if (fs.existsSync(session.authDir)) {
              localPreKeyCount = fs
                .readdirSync(session.authDir)
                .filter(f => f.startsWith('pre-key-') && f.endsWith('.json')).length;
            }
            const nextId = Number(state.creds?.nextPreKeyId || 0);
            if (nextId > 50 && localPreKeyCount <= 360) {
              await newSock.uploadPreKeys(812);
              session.lastSaveCredsPromise = saveCreds();
              await session.lastSaveCredsPromise;
              await backupWaSessionAuthToCloud(session, false);
            } else {
              scheduleWaSessionAuthBackup(session, 1500);
            }
          } catch (pkErr: any) {
            scheduleWaSessionAuthBackup(session, 1500);
          }
        })();

        setTimeout(() => {
          flushPendingMessages(session).catch(() => { });
          // Auto-recuperación de bienvenida: si entró un pedido oficial durante los 0-5s de reconexión de WhatsApp
          // y aún no recibió su saludo inicial (Paso 1), dispararlo automáticamente apenas el socket está conectado
          try {
            const storageOpen = loadChatsStorage();
            if (storageOpen.autoCallOnOrder || storageOpen.autoChatOnOrder) {
              const nowMs = Date.now();
              const recentOfficialOrders = loadPedidos().filter(p => {
                if (!isOfficialRegisteredProductOrder(p)) return false;
                if (p.datosConfirmados || p.agenteCompletado || p.ultimoMensajeIA) return false;
                if ((Number(p.convStep) || 1) > 1) return false;
                const ordMs = p.fecha ? new Date(p.fecha).getTime() : 0;
                // Solo pedidos recientes (últimas 6 horas) sin mensaje de IA enviado
                if (!ordMs || nowMs - ordMs > 6 * 3600 * 1000) return false;
                const cleanP = normalizeWaPhone(p.celular || p.telefono || '');
                if (!cleanP) return false;
                const hist = storageOpen.chats[cleanP] || [];
                const alreadyHasAiMsg = hist.some(
                  (m: any) => (m.sender === 'ai' || m.sender === 'agent') && (!p.reservaid || m.orderId === p.reservaid)
                );
                return !alreadyHasAiMsg;
              });
              for (const pendingOrd of recentOfficialOrders) {
                // FIX: NO borrar el guard anti-duplicados — solo disparar si aún no fue procesado
                if (!automatedOrderIds.has(pendingOrd.reservaid)) {
                  handleNewOrderAutomation(pendingOrd).catch((err: any) => {
                    console.error('[Reconnect Auto-Recover Order Error]:', err);
                  });
                }
              }
            }
          } catch {}
        }, 800);
      }

      if (connection === 'close') {
        if ((globalThis as any).__noeluxEngineGen !== myEngineGen) return;
        if (mySeq !== session.socketSeq || session.sock !== newSock) return;

        const statusCode =
          (lastDisconnect?.error as any)?.output?.statusCode ||
          (lastDisconnect?.error as any)?.data?.statusCode;

        console.warn(`[NASA] ⚠️ WhatsApp ${session.id} DESCONECTADO — statusCode=${statusCode}, error=${lastDisconnect?.error?.message || 'ninguno'}`);

        session.sock = null;
        session.isConnecting = false;

        await Promise.allSettled([
          Promise.resolve(session.lastSaveCredsPromise),
          Promise.resolve(session.lastKeyWritePromise)
        ]);

        if (isYieldingToNewerDeploy()) {
          session.status = 'disconnected';
          return;
        }

        // RESOLUCIÓN NASA DE RELEVO EN ROLLING DEPLOY (440 / 401):
        // Si otro contenedor más nuevo de Railway reclamó WALOCK-leader, este contenedor saliente JAMÁS debe reconectar ni borrar llaves.
        if (statusCode === 440 || statusCode === 401 || statusCode === DisconnectReason.loggedOut) {
          const cloudLock = await readCloudLeaderLock();
          if (cloudLock && cloudLock.leaderId !== MY_INSTANCE_ID && cloudLock.bootEpoch > MY_BOOT_EPOCH) {
            console.log(
              `[NASA Handoff] 🛑 Desconexión ${statusCode} causada por nuevo deploy (${cloudLock.leaderId}). Cediendo sin reconectar.`
            );
            await yieldToNewerDeployLeader(`close_${statusCode}_newer_leader`, cloudLock.bootEpoch);
            return;
          }
        }

        if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
          session.status = 'syncing';
          session.qrDataUrl = null;
          scheduleCloudStateSync(true);
          setTimeout(() => {
            if ((globalThis as any).__noeluxEngineGen !== myEngineGen || isYieldingToNewerDeploy()) return;
            connectWhatsAppEngine(false, session.id).catch(() => { });
          }, 150);
          return;
        }

        // ESCUDO ALGORÍTMICO ANTIDESCONEXIÓN NIVEL NASA:
        // 1) 403 / 408 / 428 / 500 / 503 son cortes de red: reconectar suavemente preservando llaves.
        // 2) Ante 401 (loggedOut): exigimos 4 fallos consecutivos reales. En el intento #2 y #3 auto-reparamos
        //    hidratando desde la Bóveda N / N-1 de Supabase antes de aceptar jamás que el usuario desvinculó desde el celular.
        const isPotentialLogout =
          statusCode === DisconnectReason.loggedOut ||
          statusCode === 401;

        let isConfirmedLogout = false;
        if (isPotentialLogout) {
          const prevCount = consecutiveLogoutCodes.get(session.id) || 0;
          const nextCount = prevCount + 1;
          consecutiveLogoutCodes.set(session.id, nextCount);
          if (nextCount >= 4) {
            isConfirmedLogout = true;
          } else {
            console.warn(
              `[NASA Escudo 401] Código 401 en ${session.id} (intento #${nextCount}/4). Conservando sesión y ejecutando auto-curación...`
            );
            if (nextCount === 2 || nextCount === 3) {
              await rehydrateSessionFromCloudBackupFallback(session.id, nextCount === 3);
            }
          }
        } else if (statusCode !== 440 && statusCode !== 515) {
          consecutiveLogoutCodes.set(session.id, 0);
        }

        if (isConfirmedLogout) {
          consecutiveLogoutCodes.set(session.id, 0);
          try {
            if (fs.existsSync(session.authDir)) {
              fs.rmSync(session.authDir, { recursive: true, force: true });
            }
          } catch {}
          backupWaSessionAuthToCloud(session, true).catch(() => { });
          session.status = 'connecting';
          session.qrDataUrl = null;
          session.pairingCode = null;
          session.connectedPhone = null;
          session.connectedName = null;
          scheduleCloudStateSync(true);
          setTimeout(() => {
            if ((globalThis as any).__noeluxEngineGen !== myEngineGen || isYieldingToNewerDeploy()) return;
            connectWhatsAppEngine(false, session.id).catch(() => { });
          }, 500);
        } else {
          if (statusCode === 440 && !isProductionRuntime()) {
            skipDevAutoConnectBecauseProdActive = true;
            session.status = 'disconnected';
            return;
          }
          session.status = state.creds?.me?.id ? 'syncing' : 'connecting';
          scheduleCloudStateSync(false);
          const delayMs = statusCode === 440 ? 5500 : isPotentialLogout ? 3000 : 1200;
          setTimeout(() => {
            if ((globalThis as any).__noeluxEngineGen !== myEngineGen || isYieldingToNewerDeploy()) return;
            connectWhatsAppEngine(false, session.id).catch(() => { });
          }, delayMs);
        }
      }
    });

    // Escuchar actualizaciones de mapeo LID <-> Número de Teléfono de Baileys v7
    newSock.ev.on('lid-mapping.update' as any, (mapping: any) => {
      try {
        const items = Array.isArray(mapping) ? mapping : [mapping];
        for (const item of items) {
          const lidDigits = String(item?.lid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
          const cleanPn = normalizeWaPhone(String(item?.pn || '').split('@')[0].split(':')[0]);
          if (lidDigits && cleanPn) {
            lidToPhoneCache.set(lidDigits, cleanPn);
            phoneToLidCache.set(cleanPn, lidDigits);
          }
        }
      } catch {}
    });

    newSock.ev.on('contacts.upsert' as any, (contacts: any[]) => {
      try {
        if (!Array.isArray(contacts)) return;
        for (const c of contacts) {
          const lidRaw = c?.lid || (String(c?.id || '').endsWith('@lid') ? c.id : '');
          const pnRaw = c?.phoneNumber || c?.pn || (String(c?.id || '').endsWith('@s.whatsapp.net') ? c.id : '');
          const lidDigits = String(lidRaw || '').split('@')[0].split(':')[0].replace(/\D/g, '');
          const cleanPn = normalizeWaPhone(String(pnRaw || '').split('@')[0].split(':')[0]);
          if (lidDigits && cleanPn) {
            lidToPhoneCache.set(lidDigits, cleanPn);
            phoneToLidCache.set(cleanPn, lidDigits);
          }
        }
      } catch {}
    });

    newSock.ev.on('messaging-history.set' as any, (historyData: any) => {
      try {
        const contacts = Array.isArray(historyData?.contacts) ? historyData.contacts : [];
        for (const c of contacts) {
          const lidRaw = c?.lid || (String(c?.id || '').endsWith('@lid') ? c.id : '');
          const pnRaw = c?.phoneNumber || c?.pn || (String(c?.id || '').endsWith('@s.whatsapp.net') ? c.id : '');
          const lidDigits = String(lidRaw || '').split('@')[0].split(':')[0].replace(/\D/g, '');
          const cleanPn = normalizeWaPhone(String(pnRaw || '').split('@')[0].split(':')[0]);
          if (lidDigits && cleanPn) {
            lidToPhoneCache.set(lidDigits, cleanPn);
            phoneToLidCache.set(cleanPn, lidDigits);
          }
        }
        const chats = Array.isArray(historyData?.chats) ? historyData.chats : [];
        for (const ch of chats) {
          const lidRaw = ch?.lidJid || ch?.lid || (String(ch?.id || '').endsWith('@lid') ? ch.id : '');
          const pnRaw = ch?.pnJid || ch?.phoneNumber || (String(ch?.id || '').endsWith('@s.whatsapp.net') ? ch.id : '');
          const lidDigits = String(lidRaw || '').split('@')[0].split(':')[0].replace(/\D/g, '');
          const cleanPn = normalizeWaPhone(String(pnRaw || '').split('@')[0].split(':')[0]);
          if (lidDigits && cleanPn) {
            lidToPhoneCache.set(lidDigits, cleanPn);
            phoneToLidCache.set(cleanPn, lidDigits);
          }
        }
      } catch {}
    });

    // Listen to real-time incoming & outgoing messages on this WhatsApp line
    newSock.ev.on('messages.upsert', async (event) => {
      if ((globalThis as any).__noeluxEngineGen !== myEngineGen) {
        if (event?.messages?.length) {
          recordIncomingDiagnostic({
            remoteJid: String(event.messages[0]?.key?.remoteJid || 'engine'),
            hasMessage: Boolean(event.messages[0]?.message),
            status: 'upsert_ignored_stale_gen'
          });
        }
        return;
      }
      if (mySeq !== session.socketSeq || session.sock !== newSock) {
        if (event?.messages?.length) {
          recordIncomingDiagnostic({
            remoteJid: String(event.messages[0]?.key?.remoteJid || 'socket'),
            hasMessage: Boolean(event.messages[0]?.message),
            status: 'upsert_ignored_stale_seq'
          });
        }
        return;
      }
      if (event.type !== 'notify' && event.type !== 'append') {
        if (event?.messages?.length) {
          recordIncomingDiagnostic({
            remoteJid: String(event.messages[0]?.key?.remoteJid || 'type'),
            hasMessage: Boolean(event.messages[0]?.message),
            status: `upsert_ignored_type:${String(event.type)}`
          });
        }
        return;
      }

      for (const msg of event.messages) {
        try {
          const remoteJid = msg.key.remoteJid || '';
          if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;

          const msgId = msg.key.id || `baileys-${Date.now()}`;
          // Skip messages sent by our own server (AI or Admin Panel)
          if (recentlySentMsgIds.has(msgId)) {
            recordIncomingDiagnostic({
              remoteJid,
              hasMessage: Boolean(msg.message),
              status: `upsert_skipped_recently_sent:${event.type}:${msgId}`.slice(0, 140)
            });
            continue;
          }

          const selfCleanPhone = normalizeWaPhone(
            session.connectedPhone ||
            newSock.user?.id?.split(':')[0]?.split('@')[0] ||
            state.creds?.me?.id?.split(':')[0]?.split('@')[0] ||
            ''
          );

          const selfLidDigits = String(
            session.connectedLid ||
            state.creds?.me?.lid ||
            (newSock.authState?.creds?.me as any)?.lid ||
            (newSock.user as any)?.lid ||
            ''
          ).split('@')[0].split(':')[0].replace(/\D/g, '');

          const rawRemoteDigits = remoteJid.split('@')[0].split(':')[0].replace(/\D/g, '');
          const deviceSentDestJid = String(
            (msg.message as any)?.deviceSentMessage?.destinationJid || ''
          ).trim();
          const deviceDestDigits = deviceSentDestJid.split('@')[0].split(':')[0].replace(/\D/g, '');
          const isRemoteSelfLid = Boolean(
            selfLidDigits && (rawRemoteDigits === selfLidDigits || deviceDestDigits === selfLidDigits)
          );
          const isDeviceDestSelfPhone = Boolean(
            selfCleanPhone && deviceDestDigits && normalizeWaPhone(deviceDestDigits) === selfCleanPhone
          );

          const senderPn =
            (msg.key as any).remoteJidAlt ||
            (msg.key as any).participantAlt ||
            (msg.key as any).senderPn ||
            (msg.key as any).participantPn ||
            '';

          // Si el sobre del mensaje incluye tanto @lid como el número real (remoteJidAlt / senderPn), guardar el mapeo de inmediato:
          if (remoteJid.endsWith('@lid') && senderPn && !senderPn.endsWith('@lid')) {
            persistLidPhoneMapping(session, remoteJid, senderPn);
          } else if (senderPn.endsWith('@lid') && !remoteJid.endsWith('@lid')) {
            persistLidPhoneMapping(session, senderPn, remoteJid);
          }

          let cleanPhone =
            (isRemoteSelfLid || isDeviceDestSelfPhone) && selfCleanPhone
              ? selfCleanPhone
              : ((senderPn ? resolveJidToCleanPhone(session, senderPn) : null) ||
                 (deviceSentDestJid && !deviceSentDestJid.endsWith('@lid')
                   ? resolveJidToCleanPhone(session, deviceSentDestJid)
                   : null) ||
                 resolveJidToCleanPhone(session, remoteJid));

          // Si el mensaje entrante es un evento de reintento Signal (!msg.message / stubType === 2),
          // cancelar el temporizador de inactividad del cliente pero JAMÁS borrar session-*.json ni subir pre-keys,
          // permitiendo que enableAutoSessionRecreation de Baileys v7 complete el retry receipt limpiamente:
          if (!msg.message) {
            const stubType = (msg as any).messageStubType;
            const stubParams: string[] = Array.isArray((msg as any).messageStubParameters)
              ? (msg as any).messageStubParameters.map((x: any) => String(x))
              : [];

            recordIncomingDiagnostic({
              remoteJid,
              senderPn: senderPn || undefined,
              resolvedPhone: cleanPhone,
              hasMessage: false,
              stubType,
              stubParams,
              status: stubType === 2 ? 'ciphertext_native_retry' : 'no_message_stub'
            });

            if (cleanPhone && (!msg.key.fromMe || isRemoteSelfLid || cleanPhone === selfCleanPhone)) {
              cancelCustomerInactivityFollowUp(cleanPhone);
            } else if (!cleanPhone) {
              for (const recentPh of recentOutboundByPhone.keys()) {
                cancelCustomerInactivityFollowUp(recentPh);
              }
            }

            if (stubType === 2) {
              const hasInvalidPreKey = stubParams.some(p =>
                String(p).toLowerCase().includes('invalid prekey id')
              );
              const nowMs = Date.now();
              const lastHeal = lastPreKeySelfHealBySession.get(session.id) || 0;
              if (hasInvalidPreKey && nowMs - lastHeal > 60000) {
                lastPreKeySelfHealBySession.set(session.id, nowMs);
                (async () => {
                  try {
                    await newSock.uploadPreKeys(400);
                    session.lastSaveCredsPromise = saveCreds();
                    await session.lastSaveCredsPromise;
                    await backupWaSessionAuthToCloud(session, false);
                  } catch {}
                })();
              } else {
                scheduleWaSessionAuthBackup(session, 8000);
              }
            }
            scheduleCloudStateSync(false);
            continue;
          }

          // Si remoteJid es un @lid y aún no se resolvió al número real (o devolvió los dígitos del LID),
          // consultar de forma asíncrona el lidMapping y USync de Baileys v7 contra todos los pedidos activos:
          if (
            remoteJid.endsWith('@lid') &&
            (!cleanPhone || cleanPhone === rawRemoteDigits) &&
            !isRemoteSelfLid
          ) {
            const sockAny = newSock as any;

            // Paso A: Intentar getPNForLID directo en el almacén Signal
            try {
              if (sockAny?.signalRepository?.lidMapping?.getPNForLID) {
                const resolvedPn = await sockAny.signalRepository.lidMapping.getPNForLID(remoteJid);
                if (resolvedPn && typeof resolvedPn === 'string') {
                  const cleanFromPn = normalizeWaPhone(resolvedPn.split('@')[0].split(':')[0]);
                  if (cleanFromPn && cleanFromPn !== rawRemoteDigits) {
                    persistLidPhoneMapping(session, rawRemoteDigits, cleanFromPn);
                    cleanPhone = cleanFromPn;
                  }
                }
              }
            } catch {}

            // Paso B: Consultar USync (getLIDsForPNs y onWhatsApp) para los teléfonos de pedidos activos y envíos recientes
            if (!cleanPhone || cleanPhone === rawRemoteDigits) {
              const activePedidos = loadPedidos().filter(
                p => !isOrderDeleted(p?.reservaid) && !isOrderDeleted(p?.id)
              );
              const unconfirmedOrders = activePedidos.filter(
                p => !p.datosConfirmados && !p.agenteCompletado && (p.convStep || 1) < 5
              );
              const candidateOrders = activePedidos.slice(0, 25);

              const candidatePhones = new Set<string>();
              for (const p of candidateOrders) {
                const cp = normalizeWaPhone(p.celular || p.telefono || '');
                if (cp && cp.length >= 8 && cp.length <= 13) candidatePhones.add(cp);
              }
              for (const cp of recentOutboundByPhone.keys()) {
                if (cp && cp.length >= 8 && cp.length <= 13) candidatePhones.add(cp);
              }
              const pnJids = Array.from(candidatePhones).map(cp => `${cp}@s.whatsapp.net`);

              try {
                if (pnJids.length > 0 && sockAny?.signalRepository?.lidMapping?.getLIDsForPNs) {
                  const pairs = await sockAny.signalRepository.lidMapping.getLIDsForPNs(pnJids);
                  if (Array.isArray(pairs)) {
                    for (const pair of pairs) {
                      const pairLidDigits = String(pair?.lid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
                      const pairCleanPn = normalizeWaPhone(String(pair?.pn || '').split('@')[0].split(':')[0]);
                      if (pairLidDigits && pairCleanPn) {
                        persistLidPhoneMapping(session, pairLidDigits, pairCleanPn);
                        if (pairLidDigits === rawRemoteDigits) {
                          cleanPhone = pairCleanPn;
                        }
                      }
                    }
                  }
                }
              } catch {}

              // Consultar USync LID-Protocol vía signalRepository.lidMapping.getLIDForPN cuando getLIDsForPNs aún no lo resolvió
              if (
                (!cleanPhone || cleanPhone === rawRemoteDigits) &&
                pnJids.length > 0 &&
                sockAny?.signalRepository?.lidMapping?.getLIDForPN
              ) {
                try {
                  const directLookups = await Promise.race([
                    Promise.allSettled(
                      pnJids.slice(0, 8).map(async (pnJid) => ({
                        pnJid,
                        lid: await sockAny.signalRepository.lidMapping.getLIDForPN(pnJid)
                      }))
                    ),
                    new Promise<null>(resolve => setTimeout(() => resolve(null), 2500))
                  ]);
                  if (Array.isArray(directLookups)) {
                    for (const resItem of directLookups) {
                      if (resItem.status !== 'fulfilled' || !resItem.value?.lid) continue;
                      const itemLidDigits = String(resItem.value.lid).split('@')[0].split(':')[0].replace(/\D/g, '');
                      const itemCleanPn = normalizeWaPhone(resItem.value.pnJid.split('@')[0].split(':')[0]);
                      if (itemLidDigits && itemCleanPn) {
                        persistLidPhoneMapping(session, itemLidDigits, itemCleanPn);
                        if (itemLidDigits === rawRemoteDigits) {
                          cleanPhone = itemCleanPn;
                        }
                      }
                    }
                  }
                } catch {}
              }

              // Re-verificar archivos lid-mapping-*.json en disco por si Baileys los acaba de escribir
              if (!cleanPhone || cleanPhone === rawRemoteDigits) {
                const diskResolved = resolveJidToCleanPhone(session, remoteJid);
                if (diskResolved && diskResolved !== rawRemoteDigits) {
                  cleanPhone = diskResolved;
                }
              }

              // Paso C: Coincidencia por nombre de WhatsApp (pushName) contra pedidos activos
              if ((!cleanPhone || cleanPhone === rawRemoteDigits) && msg.pushName && candidateOrders.length > 0) {
                const normPush = String(msg.pushName)
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .trim();
                if (normPush.length >= 3) {
                  const poolToSearch = unconfirmedOrders.length > 0 ? unconfirmedOrders : candidateOrders;
                  const matchedByName = poolToSearch.find(o => {
                    const normOrdName = String(o.nombre || '')
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .trim();
                    const firstOrdWord = normOrdName.split(/\s+/)[0] || '';
                    return (
                      normOrdName &&
                      (normOrdName.includes(normPush) ||
                        normPush.includes(normOrdName) ||
                        (firstOrdWord.length >= 3 && normPush.includes(firstOrdWord)))
                    );
                  });
                  if (matchedByName) {
                    const candidatePhone = normalizeWaPhone(matchedByName.celular);
                    if (candidatePhone && candidatePhone !== rawRemoteDigits) {
                      persistLidPhoneMapping(session, rawRemoteDigits, candidatePhone);
                      cleanPhone = candidatePhone;
                    }
                  }
                }
              }

              // Paso D: Si hay un pedido en curso al que el Agente acaba de enviar un mensaje saliente recientemente,
              // asociar a ese teléfono activo (sin bloquear por mapeos antiguos en phoneToLidCache)
              if (!cleanPhone || cleanPhone === rawRemoteDigits) {
                const nowMs = Date.now();
                const poolForRecent = unconfirmedOrders.length > 0 ? unconfirmedOrders : candidateOrders;
                if (poolForRecent.length >= 1) {
                  const sortedByRecent = [...poolForRecent].sort((a, b) => {
                    const phA = normalizeWaPhone(a.celular || a.telefono || '');
                    const phB = normalizeWaPhone(b.celular || b.telefono || '');
                    const sentA = recentOutboundByPhone.get(phA)?.sentAt || 0;
                    const sentB = recentOutboundByPhone.get(phB)?.sentAt || 0;
                    if (sentA !== sentB) return sentB - sentA;

                    const rawTa = new Date(a.actualizado_en || a.fecha || 0).getTime();
                    const rawTb = new Date(b.actualizado_en || b.fecha || 0).getTime();
                    const ta = rawTa > nowMs + 60000 ? 0 : rawTa;
                    const tb = rawTb > nowMs + 60000 ? 0 : rawTb;
                    return tb - ta;
                  });
                  const mostRecentActive = sortedByRecent[0];
                  const candidatePhone = normalizeWaPhone(mostRecentActive.celular || mostRecentActive.telefono || '');
                  const sentInfo = candidatePhone ? recentOutboundByPhone.get(candidatePhone) : undefined;
                  const ordTimeMs = new Date(mostRecentActive.actualizado_en || mostRecentActive.fecha || 0).getTime();
                  const isRecentlyActive =
                    (sentInfo && nowMs - sentInfo.sentAt < 3 * 60 * 60 * 1000) ||
                    (ordTimeMs > 0 && nowMs - ordTimeMs < 3 * 60 * 60 * 1000) ||
                    unconfirmedOrders.length === 1;
                  if (
                    isRecentlyActive &&
                    candidatePhone &&
                    candidatePhone !== rawRemoteDigits &&
                    candidatePhone.length <= 13
                  ) {
                    persistLidPhoneMapping(session, rawRemoteDigits, candidatePhone);
                    cleanPhone = candidatePhone;
                  }
                }
              }
            }
          }

          // Self-Chat fallback: si el mensaje vino desde nuestro propio dispositivo (fromMe: true) con @lid sin resolver
          // y nuestra propia línea tiene un pedido activo sin confirmar, enrutar a selfCleanPhone
          if ((!cleanPhone || cleanPhone === rawRemoteDigits) && msg.key.fromMe && selfCleanPhone) {
            if (isRemoteSelfLid || isDeviceDestSelfPhone || findActiveOrderForPhone(selfCleanPhone)) {
              cleanPhone = selfCleanPhone;
              if (remoteJid.endsWith('@lid') && rawRemoteDigits) {
                persistLidPhoneMapping(session, rawRemoteDigits, selfCleanPhone);
              }
            }
          }

          if (!cleanPhone) {
            recordIncomingDiagnostic({
              remoteJid,
              senderPn: senderPn || undefined,
              resolvedPhone: null,
              hasMessage: Boolean(msg.message),
              status: 'dropped_unmatched_lid'
            });
            continue;
          }

          // Skip if this exact message ID is already stored in chat history
          const existingHistory = loadChatsStorage().chats[cleanPhone] || [];
          if (existingHistory.some(m => m.id === msgId)) {
            continue;
          }

          // Unwrap ephemeral (disappearing), viewOnce, deviceSent, or edited message containers
          const innerMsg: any = unwrapWhatsAppMessage(msg.message);

          const isAudioMsg = Boolean(innerMsg?.audioMessage);
          const locMsg = innerMsg?.locationMessage || innerMsg?.liveLocationMessage || null;
          const isLocationMsg = Boolean(locMsg);
          const isImageWithoutCaption = Boolean(innerMsg?.imageMessage && !innerMsg?.imageMessage?.caption);

          // Determine if this message is from the Admin or from the Client.
          // IMPORTANT: If cleanPhone matches session.connectedPhone (Self-Chat testing from the owner's phone),
          // any message not in recentlySentMsgIds was typed/recorded on the phone to test the client flow —
          // EXCEPT when activeAiOutboundLockByPhone is active or when it is an uncaptioned image!
          const isSelfChat = Boolean(selfCleanPhone && (cleanPhone === selfCleanPhone || isRemoteSelfLid));

          // Si el mensaje tiene fromMe=true y es una imagen sin texto enviada desde nuestra propia cuenta,
          // es el eco saliente de la Imagen #1 o Imagen de Pedido Confirmado del Agente: ignorar al 100%
          // (sin bloquear jamás textos escritos como "CORRECTO" cuando el dueño prueba desde su propio número).
          if (msg.key.fromMe && isImageWithoutCaption) {
            recordIncomingDiagnostic({
              remoteJid,
              senderPn: senderPn || undefined,
              resolvedPhone: cleanPhone,
              hasMessage: true,
              status: 'upsert_skipped_ai_outbound_image_echo'
            });
            continue;
          }

          const isFromAdmin = Boolean(msg.key.fromMe) && !isSelfChat;

          // Cancel any pending 1-minute inactivity follow-up timer as soon as the customer sends any message
          if (!isFromAdmin) {
            cancelCustomerInactivityFollowUp(cleanPhone);
            scheduleWaSessionAuthBackup(session, 25000);
          }

          recordIncomingDiagnostic({
            remoteJid,
            senderPn: senderPn || undefined,
            resolvedPhone: cleanPhone,
            hasMessage: true,
            status: isFromAdmin ? 'outbound_admin_echo' : 'decrypted_customer_message'
          });

          let text =
            innerMsg?.conversation ||
            innerMsg?.extendedTextMessage?.text ||
            innerMsg?.imageMessage?.caption ||
            innerMsg?.videoMessage?.caption ||
            innerMsg?.buttonsResponseMessage?.selectedDisplayText ||
            innerMsg?.listResponseMessage?.title ||
            '';

          let customerAudioDataUrl: string | null = null;
          let sttFailed = false;

          let matchedOrderForPhone = findActiveOrderForPhone(cleanPhone);

          // Canonicalize cleanPhone to the matched order's normalized phone so chat history, convSteps, and inactivity timers use the exact same key
          if (matchedOrderForPhone) {
            const canonicalOrdPhone = normalizeWaPhone(
              matchedOrderForPhone.celular || matchedOrderForPhone.telefono || ''
            );
            if (canonicalOrdPhone && canonicalOrdPhone.length >= 8 && canonicalOrdPhone.length <= 13) {
              if (msg.key.fromMe && isImageWithoutCaption) {
                continue;
              }
              if (!isFromAdmin) {
                cancelCustomerInactivityFollowUp(canonicalOrdPhone);
              }
              if (remoteJid.endsWith('@lid') && rawRemoteDigits) {
                lidToPhoneCache.set(rawRemoteDigits, canonicalOrdPhone);
                phoneToLidCache.set(canonicalOrdPhone, rawRemoteDigits);
              }
              cleanPhone = canonicalOrdPhone;
            }
          }

          // Si estamos en Self-Chat (msg.key.fromMe === true) y el texto coincide exactamente con el último mensaje hablado/escrito por la IA, ignorar el eco
          if (msg.key.fromMe && text.trim().length > 35) {
            const lastAiMsg = String(
              matchedOrderForPhone?.ultimoMensajeIA ||
                recentAiSpokenTurnByPhone.get(cleanPhone)?.text ||
                ''
            ).trim();
            if (
              lastAiMsg &&
              (text.trim() === lastAiMsg ||
                calculateNormalizedSentenceSimilarity(text.trim(), lastAiMsg) >= 0.8)
            ) {
              recordIncomingDiagnostic({
                remoteJid,
                senderPn: senderPn || undefined,
                resolvedPhone: cleanPhone,
                hasMessage: true,
                status: 'upsert_skipped_self_ai_text_echo'
              });
              continue;
            }
          }

          const isBlockedPostConfirm = !isFromAdmin && isCustomerPostConfirmBlocked(cleanPhone);

          // =========================================================================
          // PROHIBICIÓN ESTRICTA: EL AGENTE TIENE TERMINANTEMENTE PROHIBIDO HABLAR,
          // TRANSCRIBIR AUDIOS, PROCESAR UBICACIÓN O CREAR PEDIDOS PARA PERSONAS
          // QUE NO SEAN CLIENTES OFICIALES PROVENIENTES DEL REGISTRO DE PRODUCTOS
          // =========================================================================
          const sellerProdEarly = !isFromAdmin ? findProductForSellerNotificationPhone(cleanPhone) : null;
          const hasOfficialOrder = Boolean(
            matchedOrderForPhone && isOfficialRegisteredProductOrder(matchedOrderForPhone)
          );

          if (!hasOfficialOrder && !sellerProdEarly) {
            // Silencio absoluto para contactos externos, personales o leads sin pedido oficial registrado
            recordIncomingDiagnostic({
              remoteJid,
              senderPn: senderPn || undefined,
              resolvedPhone: cleanPhone,
              hasMessage: true,
              status: 'dropped_no_official_order'
            });
            continue;
          }

          const isDocumentMsg = Boolean(
            innerMsg?.documentMessage || innerMsg?.documentWithCaptionMessage
          );
          const isAnyImageMsg = Boolean(innerMsg?.imageMessage);
          const isInPrepaymentPromoFlow = false;

          // If the customer sent a WhatsApp Location Pin (locationMessage / liveLocationMessage), extract exact GPS coordinates!
          if (isLocationMsg && locMsg) {
            const lat = Number(locMsg.degreesLatitude);
            const lng = Number(locMsg.degreesLongitude);
            const locName = String(locMsg.name || '').trim();
            const locAddr = String(locMsg.address || '').trim();
            if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
              const gpsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
              let reverseSummary = [locName, locAddr].filter(Boolean).join(', ');
              if (!reverseSummary && !isBlockedPostConfirm) {
                try {
                  const ctrl = new AbortController();
                  const tid = setTimeout(() => ctrl.abort(), 3000);
                  const revRes = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`,
                    { signal: ctrl.signal, headers: { Accept: 'application/json', 'User-Agent': 'NoeluxParaguayApp/1.0' } }
                  );
                  clearTimeout(tid);
                  if (revRes.ok) {
                    const revData = await revRes.json();
                    const a = revData?.address || {};
                    const road = a.road || a.pedestrian || a.residential || '';
                    const suburb = a.suburb || a.neighbourhood || '';
                    const city = a.city || a.town || a.municipality || '';
                    reverseSummary = [road, suburb ? `Barrio ${suburb}` : '', city].filter(Boolean).join(', ');
                  }
                } catch {}
              }

              text = `📍 [Ubicación GPS exacta enviada por WhatsApp: ${gpsUrl}${reverseSummary ? ` (${reverseSummary})` : ''}]`;

              // Save exact GPS coordinates directly onto the active order for the Courier & Agent
              if (matchedOrderForPhone && !isFromAdmin) {
                const allPedidos = loadPedidos();
                const targetOrd = allPedidos.find(p => p.reservaid === matchedOrderForPhone.reservaid);
                if (targetOrd) {
                  targetOrd.gpsLat = Number(lat.toFixed(6));
                  targetOrd.gpsLng = Number(lng.toFixed(6));
                  targetOrd.gpsLink = gpsUrl;
                  targetOrd.gpsConfirmado = true;
                  if (reverseSummary) {
                    targetOrd.gpsDireccionDetectada = reverseSummary;
                  }
                  savePedidos(allPedidos);
                  syncOrderUpdateToCloud(targetOrd).catch(() => {});
                }
                matchedOrderForPhone.gpsLat = Number(lat.toFixed(6));
                matchedOrderForPhone.gpsLng = Number(lng.toFixed(6));
                matchedOrderForPhone.gpsLink = gpsUrl;
                matchedOrderForPhone.gpsConfirmado = true;
              }
            }
          } else if ((isAnyImageMsg || isDocumentMsg) && !isFromAdmin && isInPrepaymentPromoFlow) {
            const captionExtra =
              innerMsg?.imageMessage?.caption ||
              innerMsg?.documentMessage?.caption ||
              innerMsg?.documentWithCaptionMessage?.message?.documentMessage?.caption ||
              '';
            text = `🧾 [COMPROBANTE_PAGO_ADELANTADO: El cliente envió el comprobante de transferencia bancaria${captionExtra ? ` (${captionExtra})` : ''}]`;
          }
          // IMPORTANTE: Jamás convertir una imagen sin texto (isImageWithoutCaption) en un mensaje falso de cliente,
          // ya que las imágenes generadas por el Agente (stage1_welcome / stage3_confirmed) no llevan caption.

          if (isAudioMsg) {
            if (!isFromAdmin) {
              if (isBlockedPostConfirm) {
                // Auto-bloqueado tras los mensajes post-confirmación: NO transcribir con Deepgram STT para no gastar créditos
                text = '🎤 [Nota de voz recibida tras cierre definitivo de atención]';
              } else {
                const sttRes = await transcribeWhatsAppAudioMessage(msg);
                customerAudioDataUrl = sttRes.audioDataUrl;
                if (sttRes.transcript) {
                  const normTr = sttRes.transcript.toLowerCase();
                  const lastAiText = String(
                    matchedOrderForPhone?.ultimoMensajeIA ||
                      recentAiSpokenTurnByPhone.get(cleanPhone)?.text ||
                      ''
                  );
                  const isOwnAiAudioEcho =
                    Boolean(msg.key.fromMe) &&
                    (normTr.includes('te hablo del área de envíos') ||
                      normTr.includes('area de envios') ||
                      normTr.includes('respondeme con la palabra correcto') ||
                      normTr.includes('pasa directo a empaquetado') ||
                      (lastAiText &&
                        calculateNormalizedSentenceSimilarity(sttRes.transcript, lastAiText) >= 0.45));
                  if (isOwnAiAudioEcho) {
                    recordIncomingDiagnostic({
                      remoteJid,
                      senderPn: senderPn || undefined,
                      resolvedPhone: cleanPhone,
                      hasMessage: true,
                      status: 'upsert_skipped_self_ai_audio_echo'
                    });
                    continue;
                  }
                  text = `🎤 ${sttRes.transcript}`;
                } else {
                  sttFailed = true;
                  text = '🎤 [Nota de voz del cliente]';
                }
              }
            } else {
              text = '🎤 [Nota de voz enviada]';
            }
          }

          if (!text.trim()) {
            recordIncomingDiagnostic({
              remoteJid,
              senderPn: senderPn || undefined,
              resolvedPhone: cleanPhone,
              hasMessage: true,
              status: 'dropped_empty_text'
            });
            continue;
          }

          // Mark msgId as processed so duplicate notify/append events never double-trigger
          recentlySentMsgIds.add(msgId);
          setTimeout(() => recentlySentMsgIds.delete(msgId), 60000);

          if (isFromAdmin) {
            // Solo registrar en el historial si el mensaje del admin va dirigido a un cliente con pedido registrado
            if (matchedOrderForPhone) {
              appendChatMessage(cleanPhone, {
                id: msgId,
                sender: 'admin',
                senderName: session.connectedName || 'Tú (WhatsApp)',
                text: text.trim(),
                status: 'sent',
                orderId: matchedOrderForPhone.reservaid,
                sessionId: session.id
              });
            }
          } else {
            // 0. Si el mensaje entrante proviene del número de notificaciones del VENDEDOR de un producto:
            const sellerProd = findProductForSellerNotificationPhone(cleanPhone);
            const isExplicitSellerReportRequest =
              /\b(reporte|resumen de pedidos|estado de pedidos|cu[aá]ntos pedidos|lista de confirmados)\b/i.test(
                text.trim()
              );

            // Si ese número NO tiene un pedido de cliente registrado, o si pide explícitamente un reporte de vendedor:
            if (sellerProd && (!matchedOrderForPhone || isExplicitSellerReportRequest)) {
              handleIncomingSellerWhatsAppInstruction(sellerProd.id, cleanPhone, text.trim(), session.id).catch(() => { });
              continue;
            }

            // =========================================================================
            // FILTRO ESTRICTO: SOLO CLIENTES OFICIALES DE REGISTRO DE PRODUCTOS
            // =========================================================================
            if (!matchedOrderForPhone || !isOfficialRegisteredProductOrder(matchedOrderForPhone)) {
              continue;
            }

            const customerName =
              matchedOrderForPhone.nombre && matchedOrderForPhone.nombre !== 'test'
                ? matchedOrderForPhone.nombre
                : msg.pushName || 'Cliente';

            appendChatMessage(cleanPhone, {
              id: msgId,
              sender: 'client',
              senderName: customerName,
              text: text.trim(),
              status: 'delivered',
              orderId: matchedOrderForPhone.reservaid,
              sessionId: session.id,
              isVoiceCall: false,
              isAudioNote: isAudioMsg,
              audioDataUrl: customerAudioDataUrl || undefined
            });

            // Si el cliente ya agotó sus 3 mensajes post-confirmación ("Jaque Mate"), cortar para siempre sin gastar LLM ni TTS
            if (isBlockedPostConfirm || isCustomerPostConfirmBlocked(cleanPhone)) {
              continue;
            }

            // Jamás descartar mensajes en vivo ('notify') por diferencias de reloj del servidor.
            // Solo ignorar mensajes de sincronización histórica ('append') si tienen más de 1 hora de antigüedad real.
            if (event.type === 'append') {
              const rawTsObj: any = msg.messageTimestamp;
              const rawTs =
                typeof rawTsObj === 'number'
                  ? rawTsObj
                  : typeof rawTsObj?.low === 'number'
                    ? rawTsObj.low
                    : Number(rawTsObj || 0);
              const nowSec = Date.now() / 1000;
              if (rawTs > 1000000000 && nowSec - rawTs > 3600 && nowSec - rawTs < 86400 * 30) {
                continue;
              }
            }

            const storage = loadChatsStorage();
            const customerChatMode = storage.chatModes[cleanPhone];
            const isExplicitManual = customerChatMode === 'manual';
            if (isExplicitManual) {
              // El modo de chat está explícitamente en "Yo Escribo" (Manual). No auto-responder para respetar al usuario.
              recordIncomingDiagnostic({
                remoteJid,
                senderPn: senderPn || undefined,
                resolvedPhone: cleanPhone,
                hasMessage: true,
                status: 'dropped_manual_mode'
              });
              continue;
            }

            const isAutoEnabled =
              customerChatMode === 'automatico' ||
              matchedOrderForPhone.modoIA === 'automatico' ||
              (storage.autoChatOnOrder && customerChatMode !== 'manual') ||
              (storage.autoCallOnOrder && customerChatMode !== 'manual');

            const activeChannel: AgentChannel =
              storage.customerChannels[cleanPhone] ||
              matchedOrderForPhone.canalIA ||
              storage.preferredChannel ||
              'audio';

            if (isAutoEnabled) {
              const burstInputPiece =
                isAudioMsg && sttFailed
                  ? '[El cliente envió un audio que no se escuchó con claridad o no se pudo entender lo que dijo]'
                  : text.trim();

              // Debounce & serialize burst messages per customer phone so 2 rapid messages never trigger duplicate parallel confirmations
              const prevBurst = pendingCustomerBurstState.get(cleanPhone);
              if (prevBurst?.timer) {
                clearTimeout(prevBurst.timer);
              }
              const combinedTexts = prevBurst ? [...prevBurst.texts, burstInputPiece] : [burstInputPiece];
              const combinedHasAudio = Boolean(prevBurst?.hasAudio || isAudioMsg);

              const burstTimer = setTimeout(async () => {
                pendingCustomerBurstState.delete(cleanPhone);
                const inputForLlm = combinedTexts.join('. ');

                // Wait if a previous turn for this exact phone is still in-flight (con timeout de seguridad de 12s)
                const existingLock = inFlightCustomerReplyLocks.get(cleanPhone);
                if (existingLock) {
                  try {
                    await Promise.race([
                      existingLock,
                      new Promise(resolve => setTimeout(resolve, 12000))
                    ]);
                  } catch {}
                }

                const turnPromise = (async () => {
                  try {
                    console.log(
                      `[Auto AI Reply] phone=${cleanPhone} hasAudio=${combinedHasAudio} input=${JSON.stringify(inputForLlm.slice(0, 120))}`
                    );
                    const smartRes: any = await generateSmartAiReply(cleanPhone, inputForLlm, combinedHasAudio);
                    if (smartRes.error) {
                      console.warn(`[Auto AI Reply] phone=${cleanPhone} warning=${smartRes.error}`);
                      appendChatMessage(cleanPhone, {
                        id: `err-${Date.now()}`,
                        sender: 'agent',
                        senderName: 'Sistema',
                        text: smartRes.error,
                        status: 'error'
                      });
                      if (!smartRes.reply) {
                        return;
                      }
                    }
                    const reply = smartRes.reply;
                    const secondaryAudioReply = smartRes.secondaryAudioReply;
                    const locationTextConfirmation = smartRes.locationTextConfirmation;
                    const matchedOrder = smartRes.matchedOrder;
                    const convStep = smartRes.convStep;

                    console.log(
                      `[Auto AI Reply Ready] phone=${cleanPhone} order=${matchedOrder?.reservaid || '?'} step=${convStep} confirmed=${Boolean(matchedOrder?.datosConfirmados)} replyLen=${reply?.length || 0} secAudioLen=${secondaryAudioReply?.length || 0}`
                    );

                    if (reply) {
                      recordIncomingDiagnostic({
                        remoteJid,
                        senderPn: senderPn || undefined,
                        resolvedPhone: cleanPhone,
                        hasMessage: true,
                        status: matchedOrder?.datosConfirmados ? 'ai_confirmed_reply_sent' : 'ai_reply_sent'
                      });
                      // 99-100% AUDIO: El Agente responde SIEMPRE en Nota de Voz (Deepgram Aura-2),
                      // enviando texto ÚNICAMENTE cuando locationTextConfirmation existe (Ciudad/Barrio/GPS o Alias 3856033),
                      // y despachando secondaryAudioReply (ej. Audio #2 de la promo -Gs. 30.000) automáticamente después del Audio #1.
                      await sendWhatsAppVoiceCallTurn(
                        cleanPhone,
                        reply,
                        convStep,
                        matchedOrder?.reservaid,
                        session.id,
                        activeChannel === 'audio' ? 'audio' : 'audio',
                        undefined,
                        locationTextConfirmation,
                        false,
                        secondaryAudioReply
                      );
                    }
                  } catch (e) {
                    console.error('[Auto AI Reply Error]:', e);
                  }
                })();

                inFlightCustomerReplyLocks.set(cleanPhone, turnPromise);
                try {
                  await turnPromise;
                } finally {
                  if (inFlightCustomerReplyLocks.get(cleanPhone) === turnPromise) {
                    inFlightCustomerReplyLocks.delete(cleanPhone);
                  }
                }
              }, 1100);

              pendingCustomerBurstState.set(cleanPhone, {
                timer: burstTimer,
                texts: combinedTexts,
                hasAudio: combinedHasAudio
              });
            }
          }
        } catch (err) {
          console.error('[messages.upsert Handler Error]:', err);
        }
      }
    });

    return getWhatsAppEngineState();
  } catch (err: any) {
    session.isConnecting = false;
    session.status = 'disconnected';
    session.lastError = err?.message || 'Error iniciando sesión de WhatsApp';
    scheduleCloudStateSync(true);
    return getWhatsAppEngineState();
  }
}

// Request an 8-digit Pairing Code for linking a specific WhatsApp session via phone number
export async function requestWhatsAppPairingCode(
  phoneNumber: string,
  sessionId?: string
): Promise<{
  success: boolean;
  pairingCode?: string;
  error?: string;
}> {
  ensureInitialSessionsLoaded();
  const targetId = sessionId || Array.from(sessionsMap.keys())[0] || 'wa-1';
  const session = getOrCreateSessionRuntime(targetId);

  try {
    const cleanPhone = normalizeWaPhone(phoneNumber);
    if (!cleanPhone || cleanPhone.length < 8) {
      return { success: false, error: 'Ingresá un número de WhatsApp válido (ej: 0981123456)' };
    }

    if (session.status === 'connected') {
      return {
        success: false,
        error: `Esta línea ya está conectada (+${session.connectedPhone || 'activa'}). Para conectar otro celular, tocá "Agregar Nuevo WhatsApp".`
      };
    }

    const waitUntilHandshakeReady = async (timeoutMs = 15000): Promise<boolean> => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (session.status === 'connected') return true;
        const wsOpen = Boolean((session.sock as any)?.ws?.isOpen);
        if (session.sock && (session.status === 'qr_ready' || Boolean(session.qrDataUrl) || wsOpen)) {
          return true;
        }
        await new Promise(r => setTimeout(r, 250));
      }
      return Boolean(session.sock && (session.status === 'qr_ready' || (session.sock as any)?.ws?.isOpen));
    };

    if (
      !session.sock ||
      session.status === 'disconnected' ||
      (session.status === 'connecting' && !session.isConnecting)
    ) {
      await connectWhatsAppEngine(true, session.id);
    }

    let ready = await waitUntilHandshakeReady(15000);
    if (!ready || !session.sock) {
      await connectWhatsAppEngine(true, session.id);
      ready = await waitUntilHandshakeReady(12000);
    }

    if (!session.sock || !ready) {
      return {
        success: false,
        error: 'El servidor de WhatsApp tardó en responder. Tocá "Dame el Código" de nuevo.'
      };
    }

    let code: string;
    try {
      code = await session.sock.requestPairingCode(cleanPhone);
    } catch (firstErr: any) {
      const msg = String(firstErr?.message || '');
      if (/closed|timeout|not open|connect/i.test(msg)) {
        await connectWhatsAppEngine(true, session.id);
        const retryReady = await waitUntilHandshakeReady(12000);
        if (!session.sock || !retryReady) throw firstErr;
        code = await session.sock.requestPairingCode(cleanPhone);
      } else {
        throw firstErr;
      }
    }

    const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
    session.pairingCode = formattedCode;
    session.lastError = null;
    scheduleCloudStateSync(true);
    return { success: true, pairingCode: formattedCode };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'No se pudo generar el código de vinculación'
    };
  }
}

export async function disconnectWhatsAppEngine(
  clearSession = true,
  sessionId?: string,
  confirmCode?: string
): Promise<WaEngineState> {
  ensureInitialSessionsLoaded();
  const targetId = sessionId || Array.from(sessionsMap.keys())[0] || 'wa-1';
  const session = getOrCreateSessionRuntime(targetId);

  const isLinked =
    session.status === 'connected' ||
    Boolean(session.connectedPhone) ||
    hasValidLinkedCredsOnDisk(session.authDir);

  if (clearSession && isLinked && confirmCode !== MANUAL_DISCONNECT_CONFIRM_CODE) {
    throw new Error(
      '🛡️ Bloqueo de seguridad antidesconexión activo: Para desvincular el WhatsApp debes completar la confirmación de doble seguridad (CONFIRMAR_DESCONEXION_MANUAL).'
    );
  }

  await stopSessionSocket(session, clearSession);

  session.status = 'connecting';
  session.qrDataUrl = null;
  session.pairingCode = null;
  if (clearSession) {
    session.connectedPhone = null;
    session.connectedName = null;
  }
  scheduleCloudStateSync(true);

  setTimeout(() => {
    connectWhatsAppEngine(false, session.id).catch(() => { });
  }, 250);

  return getWhatsAppEngineState();
}

// Reparación y refresco de señal sin desvincular jamás el WhatsApp:
// Sube un lote nuevo de Pre-Keys (400), respalda en Supabase y reinicia suavemente el socket conservando 100% la sesión.
export async function repairWhatsAppSession(sessionId?: string): Promise<WaEngineState> {
  ensureInitialSessionsLoaded();
  const targetId = sessionId || Array.from(sessionsMap.keys())[0] || 'wa-1';
  const session = getOrCreateSessionRuntime(targetId);

  try {
    sanitizeAuthDirectory(session.authDir);
    if (session.sock && session.status === 'connected') {
      try {
        await session.sock.uploadPreKeys(400);
        await Promise.resolve(session.lastSaveCredsPromise).catch(() => {});
      } catch {}
      await backupWaSessionAuthToCloud(session, false);
    }
    await stopSessionSocket(session, false);
    session.status = hasValidLinkedCredsOnDisk(session.authDir) ? 'syncing' : 'connecting';
    session.lastError = null;
    scheduleCloudStateSync(true);
    await connectWhatsAppEngine(false, session.id);
  } catch (e: any) {
    session.lastError = e?.message || 'Error al refrescar conexión';
  }

  return getWhatsAppEngineState();
}

// Pick the best connected WhatsApp session to send a message
function pickConnectedSession(preferredSessionId?: string): WaSessionRuntime | null {
  ensureInitialSessionsLoaded();
  if (preferredSessionId) {
    const pref = sessionsMap.get(preferredSessionId);
    if (pref && pref.sock && (pref.status === 'connected' || Boolean(pref.sock.user?.id))) {
      return pref;
    }
  }
  for (const s of sessionsMap.values()) {
    if (s.sock && s.status === 'connected') return s;
  }
  for (const s of sessionsMap.values()) {
    if (s.sock && Boolean(s.sock.user?.id)) return s;
  }
  return null;
}

export async function sendWhatsAppMessage(
  phone: string,
  text: string,
  sender: 'admin' | 'ai' = 'admin',
  orderId?: string,
  preferredSessionId?: string
): Promise<{ sentViaSocket: boolean; message: WaChatMessage; error?: string }> {
  const cleanPhone = normalizeWaPhone(phone);
  if (!cleanPhone) {
    throw new Error('Número de teléfono inválido');
  }

  // PROHIBICIÓN ESTRICTA: El Agente ('ai') JAMÁS puede enviar mensajes a números que no sean clientes oficiales
  // registrados en el formulario de productos (ni al vendedor salvo a través del canal 'admin' de reportes)
  if (sender === 'ai') {
    const pedidosCheck = loadPedidos();
    const officialOrd =
      (orderId && pedidosCheck.find(p => p.reservaid === orderId)) ||
      findActiveOrderForPhone(cleanPhone) ||
      null;
    if (!officialOrd || !isOfficialRegisteredProductOrder(officialOrd)) {
      console.warn(`[Muro Estricto] Se bloqueó sendWhatsAppMessage('ai') hacia ${cleanPhone} (no es cliente oficial registrado).`);
      return {
        sentViaSocket: false,
        message: {} as WaChatMessage,
        error: 'Bloqueado: destinatario no es cliente oficial del registro de productos'
      };
    }
  }

  const activeSession = pickConnectedSession(preferredSessionId);

  if (activeSession && activeSession.sock) {
    try {
      const jid = resolveOutboundWhatsAppJid(cleanPhone);
      // Proactively resolve and cache @lid <-> cleanPhone in Baileys v7 before and after sending so incoming @lid replies always match this customer
      await cacheRecipientLidMapping(activeSession, cleanPhone, orderId);

      try {
        await activeSession.sock.sendPresenceUpdate('composing', jid);
      } catch {}

      const preMsgId = generateMessageIDV2(activeSession.sock.user?.id);
      recentlySentMsgIds.add(preMsgId);
      setTimeout(() => recentlySentMsgIds.delete(preMsgId), 45000);

      const sent = await activeSession.sock.sendMessage(
        jid,
        { text },
        { messageId: preMsgId }
      );
      const msgId = sent?.key?.id || preMsgId;
      recentlySentMsgIds.add(msgId);
      setTimeout(() => recentlySentMsgIds.delete(msgId), 45000);
      recordSentProtoMessage(msgId, sent?.message);
      cacheRecipientLidMapping(activeSession, cleanPhone, orderId).catch(() => {});

      const savedMsg = appendChatMessage(cleanPhone, {
        id: msgId,
        sender,
        senderName:
          sender === 'ai'
            ? '🤖 Agente de Confirmación IA'
            : `👤 Tú (+${activeSession.connectedPhone || 'WhatsApp'})`,
        text,
        status: 'sent',
        orderId,
        sessionId: activeSession.id
      });

      scheduleCloudStateSync(true);
      return { sentViaSocket: true, message: savedMsg };
    } catch (err: any) {
      const savedMsg = appendChatMessage(cleanPhone, {
        sender,
        senderName: sender === 'ai' ? '🤖 Agente de Confirmación IA' : '👤 Tú (En cola)',
        text,
        status: 'pending_connection',
        orderId
      });
      scheduleCloudStateSync(true);
      return {
        sentViaSocket: false,
        message: savedMsg,
        error: err?.message || 'Error al enviar por socket de WhatsApp'
      };
    }
  } else {
    const savedMsg = appendChatMessage(cleanPhone, {
      sender,
      senderName: sender === 'ai' ? '🤖 Agente de Confirmación IA' : '👤 Tú (Panel Admin)',
      text,
      status: 'pending_connection',
      orderId
    });
    scheduleCloudStateSync(true);
    return {
      sentViaSocket: false,
      message: savedMsg,
      error: 'Ningún WhatsApp está vinculado en este momento.'
    };
  }
}

// Auto-initialize all saved sessions on startup and start Supabase cloud poller
export function autoBootWhatsAppIfSessionExists() {
  try {
    ensureInitialSessionsLoaded();
    ensureBootCloudRestoreCompleted()
      .then(() => {
        if (isYieldingToNewerDeploy() || (skipDevAutoConnectBecauseProdActive && !isProductionRuntime())) {
          return;
        }
        ensureInitialSessionsLoaded();
        for (const session of sessionsMap.values()) {
          connectWhatsAppEngine(false, session.id).catch(() => { });
        }
      })
      .catch(() => { });

    if (!cloudPollerStarted) {
      cloudPollerStarted = true;
      (globalThis as any).__noeluxWaPoller = setInterval(() => {
        if (isYieldingToNewerDeploy()) return;
        pollCloudCommandsAndOrders().catch(() => { });
      }, 3000);

      if (isProductionRuntime()) {
        startNasaLeaderWatcher();
        startNasaHeartbeat();
        startNasaPeriodicBackup();
        console.log(
          `[NASA v3] 🚀 Relevo Atómico Sin Colisiones activo (${MY_INSTANCE_ID}) — LeaderWatcher 1.5s, Heartbeat 25s, Doble Bóveda 75s`
        );
      }

      if (!(globalThis as any).__noeluxShutdownHookRegistered) {
        (globalThis as any).__noeluxShutdownHookRegistered = true;
        const flushBeforeExit = async (signalName: string) => {
          console.log(`[NASA Shutdown] ⚠️ Señal ${signalName} recibida — iniciando relevo atómico (máx 8.5s)...`);
          try {
            await Promise.race([
              yieldToNewerDeployLeader(signalName),
              new Promise(resolve => setTimeout(resolve, 8500))
            ]);
            try {
              await insertOrUpdateSupabaseCodigo(
                'WAHEART-beat',
                JSON.stringify({
                  alive: false,
                  instanceId: MY_INSTANCE_ID,
                  bootEpoch: MY_BOOT_EPOCH,
                  pid: process.pid,
                  shutdownAt: new Date().toISOString(),
                  runtime: isProductionRuntime() ? 'production' : 'dev'
                })
              );
            } catch {}
          } catch {}
        };
        process.once('SIGTERM', () => {
          flushBeforeExit('SIGTERM').finally(() => process.exit(0));
        });
        process.once('SIGINT', () => {
          flushBeforeExit('SIGINT').finally(() => process.exit(0));
        });
      }
    }
  } catch {}
}

// ============================================================================
// AGENTE DE AVISOS Y CONVERSACIÓN EXCLUSIVA CON EL VENDEDOR POR PRODUCTO
// ============================================================================

export interface SellerAgentChatRecord {
  id: string;
  productId: string;
  sellerPhone: string;
  sender: 'agent' | 'seller';
  senderName: string;
  text: string;
  timestamp: string;
  alertColor?: 'red' | 'green' | 'normal';
  orderId?: string;
  sentViaWhatsApp?: boolean;
}

interface SellerChatsStorage {
  sellerPhonesByProduct: Record<string, string>;
  messagesByProduct: Record<string, SellerAgentChatRecord[]>;
}

function loadSellerChatsStorage(): SellerChatsStorage {
  try {
    if (fs.existsSync(SELLER_CHATS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SELLER_CHATS_FILE, 'utf-8') || '{}');
      return {
        sellerPhonesByProduct: parsed.sellerPhonesByProduct || {},
        messagesByProduct: parsed.messagesByProduct || {}
      };
    }
  } catch (e) { }
  return {
    sellerPhonesByProduct: {},
    messagesByProduct: {}
  };
}

function saveSellerChatsStorage(data: SellerChatsStorage) {
  try {
    fs.writeFileSync(SELLER_CHATS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) { }
}

export function getSellerNotificationPhoneForProduct(productId?: string, productName?: string): {
  productId: string;
  productName: string;
  sellerPhone: string;
} {
  const storeCfg = loadStoreConfig();
  const pages: any[] = Array.isArray(storeCfg?.productPages) ? storeCfg.productPages : [];
  const matchedProd =
    pages.find(
      p =>
        (productId && p.id === productId) ||
        (productName && p.nombre && p.nombre.toLowerCase() === String(productName).toLowerCase())
    ) || pages[0];

  const resolvedProdId = matchedProd?.id || productId || 'prod-noelux-01';
  const resolvedProdName = matchedProd?.nombre || productName || 'Noelux™ Proyector Navideño 12 Diseños';

  const sellerStorage = loadSellerChatsStorage();
  const rawPhone =
    matchedProd?.waNotificacionesVendedor ||
    sellerStorage.sellerPhonesByProduct[resolvedProdId] ||
    '';

  return {
    productId: resolvedProdId,
    productName: resolvedProdName,
    sellerPhone: normalizeWaPhone(rawPhone)
  };
}

function findProductForSellerNotificationPhone(incomingCleanPhone: string): any | null {
  if (!incomingCleanPhone) return null;
  const storeCfg = loadStoreConfig();
  const pages: any[] = Array.isArray(storeCfg?.productPages) ? storeCfg.productPages : [];
  const sellerStorage = loadSellerChatsStorage();

  for (const p of pages) {
    const pNotify = normalizeWaPhone(p.waNotificacionesVendedor || sellerStorage.sellerPhonesByProduct[p.id] || '');
    if (pNotify && pNotify === incomingCleanPhone) {
      return p;
    }
  }
  for (const [prodId, phone] of Object.entries(sellerStorage.sellerPhonesByProduct)) {
    if (normalizeWaPhone(phone) === incomingCleanPhone) {
      return pages.find(p => p.id === prodId) || { id: prodId, nombre: 'Noelux™ Proyector Navideño 12 Diseños' };
    }
  }
  return null;
}

export function setSellerNotificationPhone(productId: string, rawPhone: string): {
  productId: string;
  sellerPhone: string;
  messages: SellerAgentChatRecord[];
} {
  const cleanPhone = normalizeWaPhone(rawPhone);
  const sellerStorage = loadSellerChatsStorage();
  sellerStorage.sellerPhonesByProduct[productId] = cleanPhone;
  saveSellerChatsStorage(sellerStorage);

  try {
    const cfg = loadStoreConfig();
    if (Array.isArray(cfg.productPages)) {
      cfg.productPages = cfg.productPages.map((p: any) =>
        p.id === productId ? { ...p, waNotificacionesVendedor: cleanPhone } : p
      );
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
    }
  } catch (e) { }

  return {
    productId,
    sellerPhone: cleanPhone,
    messages: sellerStorage.messagesByProduct[productId] || []
  };
}

export function getSellerAgentState(productId: string): {
  productId: string;
  sellerPhone: string;
  messages: SellerAgentChatRecord[];
} {
  const info = getSellerNotificationPhoneForProduct(productId);
  const sellerStorage = loadSellerChatsStorage();
  return {
    productId: info.productId,
    sellerPhone: info.sellerPhone,
    messages: sellerStorage.messagesByProduct[info.productId] || []
  };
}

async function sendDirectRawWhatsAppToSeller(
  sellerPhone: string,
  text: string,
  preferredSessionId?: string
): Promise<boolean> {
  const cleanPhone = normalizeWaPhone(sellerPhone);
  if (!cleanPhone) return false;
  const activeSession = pickConnectedSession(preferredSessionId);
  if (!activeSession || !activeSession.sock) return false;

  try {
    const jid = `${cleanPhone}@s.whatsapp.net`;
    const preMsgId = generateMessageIDV2(activeSession.sock.user?.id);
    recentlySentMsgIds.add(preMsgId);
    setTimeout(() => recentlySentMsgIds.delete(preMsgId), 45000);

    const sent = await activeSession.sock.sendMessage(
      jid,
      { text },
      { messageId: preMsgId }
    );
    if (sent?.key?.id) {
      recentlySentMsgIds.add(sent.key.id);
      setTimeout(() => recentlySentMsgIds.delete(sent.key.id!), 45000);
      recordSentProtoMessage(sent.key.id, sent.message);
    }
    return true;
  } catch (e) {
    return false;
  }
}

function appendSellerAgentMessage(
  productId: string,
  msg: Omit<SellerAgentChatRecord, 'id' | 'productId' | 'timestamp'>
): SellerAgentChatRecord {
  const sellerStorage = loadSellerChatsStorage();
  if (!sellerStorage.messagesByProduct[productId]) {
    sellerStorage.messagesByProduct[productId] = [];
  }
  const fullMsg: SellerAgentChatRecord = {
    id: `selmsg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    productId,
    sellerPhone: msg.sellerPhone,
    sender: msg.sender,
    senderName: msg.senderName,
    text: msg.text,
    timestamp: new Date().toISOString(),
    alertColor: msg.alertColor || 'normal',
    orderId: msg.orderId,
    sentViaWhatsApp: msg.sentViaWhatsApp
  };
  sellerStorage.messagesByProduct[productId].push(fullMsg);
  saveSellerChatsStorage(sellerStorage);
  return fullMsg;
}

// Construye un reporte ejecutivo profesional, espaciado y enumerado para el WhatsApp del Vendedor
function buildServerExecutiveWhatsAppReport(
  prodName: string,
  pedidosProducto: any[],
  newlyConfirmedOrder?: any | null
): string {
  const confirmados = pedidosProducto.filter(
    p => p.datosConfirmados || (p.convStep && p.convStep >= 5) || (p.empaquetado && p.referenciaCasa)
  );
  const enCurso = pedidosProducto.filter(
    p => !p.datosConfirmados && !(p.convStep && p.convStep >= 5) && !(p.empaquetado && p.referenciaCasa)
  );
  const enviados = confirmados.filter(
    p => p.estadoEnvioProducto === 'enviado' || p.estadoEnvioProducto === 'concretado' || p.estado === 'en_camino' || p.estado === 'entregado_pagado'
  );
  const concretados = confirmados.filter(
    p => p.concretadoCobrado || p.estadoEnvioProducto === 'concretado' || p.estado === 'entregado_pagado'
  );

  const lines: string[] = [];

  if (newlyConfirmedOrder) {
    lines.push(`📋 *REPORTE DE TU AGENTE · ${prodName.toUpperCase()}*`);
    lines.push('');
    lines.push(
      `Hola jefe, acabo de confirmar todos los datos del pedido de *${newlyConfirmedOrder.nombre || 'Cliente'}* (${newlyConfirmedOrder.ciudad || 'Paraguay'}). Te comparto el estado actualizado de tu producto:`
    );
  } else {
    lines.push(`📋 *REPORTE EJECUTIVO · ${prodName.toUpperCase()}*`);
    lines.push('');
    lines.push(`Hola jefe, acá tenés el reporte actualizado de los pedidos de tu producto:`);
  }

  lines.push('');
  lines.push(`📊 *RESUMEN ACTUAL:*`);
  lines.push(`• ✅ *Pedidos Confirmados:* ${confirmados.length}`);
  lines.push(`• ⏳ *Pedidos en Curso (por confirmar):* ${enCurso.length}`);
  lines.push(`• 🚚 *Enviados / Concretados:* ${enviados.length} enviados (${concretados.length} cobrados)`);

  if (confirmados.length > 0) {
    lines.push('');
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`✅ *LISTA DE CONFIRMADOS (${confirmados.length}):*`);
    confirmados.slice(0, 10).forEach((ord, idx) => {
      const num = idx + 1;
      const montoStr = formatGsServer(ord.monto || 189000);
      const estadoEnvio =
        ord.concretadoCobrado || ord.estadoEnvioProducto === 'concretado'
          ? '💰 Concretado y cobrado'
          : ord.estadoEnvioProducto === 'enviado'
            ? '🚚 Enviado por courier'
            : '📦 Listo para enviar';
      const ordGpsUrl =
        ord.gpsLink ||
        (typeof ord.gpsLat === 'number' && typeof ord.gpsLng === 'number'
          ? `https://www.google.com/maps?q=${Number(ord.gpsLat).toFixed(6)},${Number(ord.gpsLng).toFixed(6)}`
          : '');
      lines.push('');
      lines.push(`*#${num} · ${ord.nombre || 'Cliente'}* (${ord.celular || 'S/N'})`);
      lines.push(`📍 ${ord.ciudad || ''}, ${ord.departamento || ''} — ${ord.direccion || ''}`);
      if (isBuildingOrderServer(ord)) {
        lines.push(`🏢 *Edificio:* ${formatBuildingDetailsServer(ord)}`);
      }
      if (ordGpsUrl) {
        lines.push(`🗺️ *GPS Exacto p/ Courier:* ${ordGpsUrl}`);
      }
      lines.push(`${isBuildingOrderServer(ord) ? '🛎️' : '🏠'} Ref: ${ord.referenciaCasa || 'Datos verificados en el chat'}`);
      lines.push(`🛍️ Pack: ${ord.cantidad || 1} un. (${montoStr}) · _${estadoEnvio}_`);
    });
  }

  if (enCurso.length > 0) {
    lines.push('');
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`⏳ *EN CURSO DE CONFIRMACIÓN (${enCurso.length}):*`);
    enCurso.slice(0, 6).forEach((ord, idx) => {
      const num = idx + 1;
      lines.push(
        `• *#${num}* ${ord.nombre || 'Cliente'} (${ord.ciudad || 'Paraguay'}) — _Confirmando con el cliente (Paso ${ord.convStep || 1}/5)_`
      );
    });
    if (enCurso.length > 6) {
      lines.push(`• _...y ${enCurso.length - 6} pedido(s) más en proceso de confirmación._`);
    }
  }

  lines.push('');
  lines.push(
    `💬 _Podés consultarme por acá en cualquier momento cuántos pedidos siguen en curso o cuáles ya están confirmados._`
  );

  return lines.join('\n');
}

// Envía reporte automático directamente al WhatsApp del Vendedor cuando el Agente termina de confirmar un pedido
export async function notifySellerOfOrderEvent(
  order: any,
  alertType: 'red' | 'green'
): Promise<SellerAgentChatRecord | null> {
  if (!order || alertType === 'red') return null;
  const info = getSellerNotificationPhoneForProduct(order.productoId, order.producto);
  const sellerPhone = info.sellerPhone;
  const prodId = info.productId;
  const prodName = info.productName;

  const pedidosProducto = loadPedidos().filter(
    p =>
      (p.productoId && p.productoId === prodId) ||
      String(p.producto || '')
        .toLowerCase()
        .includes(prodName.toLowerCase().slice(0, 10))
  );

  const text = buildServerExecutiveWhatsAppReport(prodName, pedidosProducto, order);

  let sentViaWa = false;
  if (sellerPhone) {
    sentViaWa = await sendDirectRawWhatsAppToSeller(sellerPhone, text);
  }

  const record = appendSellerAgentMessage(prodId, {
    sellerPhone: sellerPhone || '',
    sender: 'agent',
    senderName: `🤖 Agente de ${prodName}`,
    text,
    alertColor: 'green',
    orderId: order.reservaid,
    sentViaWhatsApp: sentViaWa
  });

  return record;
}

// Procesa consultas y conversaciones que el Vendedor envía desde su propio WhatsApp al Agente del producto
export async function handleIncomingSellerWhatsAppInstruction(
  productId: string,
  sellerPhone: string,
  sellerText: string,
  preferredSessionId?: string
): Promise<{
  sellerMessage: SellerAgentChatRecord;
  agentReply: SellerAgentChatRecord;
  messages: SellerAgentChatRecord[];
}> {
  const info = getSellerNotificationPhoneForProduct(productId);
  const targetProdId = info.productId;
  const cleanSellerPhone = normalizeWaPhone(sellerPhone || info.sellerPhone);

  const sellerMsg = appendSellerAgentMessage(targetProdId, {
    sellerPhone: cleanSellerPhone,
    sender: 'seller',
    senderName: '👤 Vendedor (Dueño del Producto)',
    text: sellerText,
    alertColor: 'normal',
    sentViaWhatsApp: true
  });

  const pedidos = loadPedidos().filter(
    p =>
      (p.productoId && p.productoId === targetProdId) ||
      String(p.producto || '')
        .toLowerCase()
        .includes(info.productName.toLowerCase().slice(0, 10))
  );

  const structuredReport = buildServerExecutiveWhatsAppReport(info.productName, pedidos, null);

  let replyText = '';
  const deepgramKey = getDeepgramApiKey();

  if (deepgramKey) {
    try {
      const sysPrompt = `Sos el Agente asistente humano y exclusivo del producto "${info.productName}". Estás conversando por WhatsApp con el VENDEDOR (dueño del producto).
Tu objetivo es responderle como una persona real, profesional, clara y amable, entregándole el reporte bien diseñado y espaciado para que pueda leerlo cómodamente en su WhatsApp cuando no tiene tiempo de abrir el panel administrativo.
No seas evasivo ni mandes texto amontonado. Usá saltos de línea claros y enumeración (#1, #2...).

DATOS REALES DE "${info.productName}" EN ESTE MOMENTO:
${structuredReport}

Respondé directamente a lo que preguntó el vendedor incluyendo los datos enumerados bien estructurados para lectura en WhatsApp.`;

      const llmRes = await callDeepgramAgentLLM(sysPrompt, [], sellerText, false);
      if (llmRes) {
        replyText = llmRes;
      }
    } catch (e) { }
  }

  if (!replyText) {
    replyText = structuredReport;
  }

  let sentViaWa = false;
  if (cleanSellerPhone) {
    sentViaWa = await sendDirectRawWhatsAppToSeller(cleanSellerPhone, replyText, preferredSessionId);
  }

  const agentReply = appendSellerAgentMessage(targetProdId, {
    sellerPhone: cleanSellerPhone,
    sender: 'agent',
    senderName: `🤖 Agente de ${info.productName}`,
    text: replyText.trim(),
    alertColor: 'normal',
    sentViaWhatsApp: sentViaWa
  });

  const sellerStorage = loadSellerChatsStorage();
  return {
    sellerMessage: sellerMsg,
    agentReply,
    messages: sellerStorage.messagesByProduct[targetProdId] || []
  };
}

