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
import WebSocket from 'ws';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import zlib from 'zlib';

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
  sender: 'client' | 'admin' | 'ai';
  senderName?: string;
  text: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'pending_connection';
  orderId?: string;
  sessionId?: string;
  isVoiceCall?: boolean;
  isAudioNote?: boolean;
  agentChannel?: AgentChannel;
  callLink?: string;
  convStep?: number;
  voiceEngine?: string;
  audioDataUrl?: string;
}

export interface WaSessionSummary {
  id: string;
  label: string;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'syncing' | 'connected';
  qrDataUrl: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
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
}

// Supabase Cloud Bridge Configuration (sincroniza localhost <-> Producción en tiempo real)
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  readKeyFromEnvFile('SUPABASE_URL') ||
  'https://cmxcohevrlmzsfqslmft.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  readKeyFromEnvFile('SUPABASE_KEY') ||
  readKeyFromEnvFile('SUPABASE_ANON_KEY') ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNteGNvaGV2cmxtenNmcXNsbWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNjMwNzYsImV4cCI6MjEwODkzOTA3Nn0.6SLXT2tvyR6Y8_5j_NSy0eT7qN7e_aO5uiWW-P3UW7w';

const LEGACY_AUTH_DIR = path.resolve(os.homedir(), '.noelux_wa_auth_v2');
const MULTI_AUTH_ROOT = path.resolve(os.homedir(), '.noelux_wa_multi');
const CHATS_FILE = path.resolve(process.cwd(), 'wa_chats.json');
const PEDIDOS_FILE = path.resolve(process.cwd(), 'pedidos.json');
const CONFIG_FILE = path.resolve(process.cwd(), 'store_config.json');
const DELETED_ORDERS_FILE = path.resolve(process.cwd(), 'deleted_orders.json');

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
    fs.writeFileSync(DELETED_ORDERS_FILE, JSON.stringify(Array.from(set), null, 2), 'utf-8');
  } catch (e) { }
}

const deletedOrderIds = loadDeletedOrderIds();

export function isOrderDeleted(orderId: string): boolean {
  if (!orderId) return false;
  return deletedOrderIds.has(String(orderId).trim());
}

export async function markOrderDeleted(orderId: string, knownCustomerPhone?: string): Promise<boolean> {
  if (!orderId) return false;
  const cleanId = String(orderId).trim();
  deletedOrderIds.add(cleanId);
  saveDeletedOrderIds(deletedOrderIds);

  // 1. Quitar de pedidos.json local si existe y capturar el número de teléfono del cliente
  let customerPhone = knownCustomerPhone ? normalizeWaPhone(knownCustomerPhone) : '';
  try {
    const pedidos = loadPedidos();
    const targetOrder = pedidos.find((p: any) => p.reservaid === cleanId || p.id === cleanId);
    if (targetOrder?.celular && !customerPhone) {
      customerPhone = normalizeWaPhone(targetOrder.celular);
    }
    const filtered = pedidos.filter((p: any) => p.reservaid !== cleanId && p.id !== cleanId);
    savePedidos(filtered);
  } catch (e) { }

  // 2. Limpieza total de residuos en wa_chats.json y estado de conversación
  try {
    const storage = loadChatsStorage();
    let changed = false;

    // A. Eliminar mensajes específicos que tengan el orderId eliminado
    for (const [phone, msgs] of Object.entries(storage.chats)) {
      const beforeCount = msgs.length;
      storage.chats[phone] = msgs.filter(m => m.orderId !== cleanId);
      if (storage.chats[phone].length !== beforeCount) {
        changed = true;
      }
    }

    // B. Si capturamos el teléfono (o buscando en chats), verificar si quedan otros pedidos activos para este número
    if (customerPhone) {
      const remainingOrdersForPhone = loadPedidos().some(
        p => normalizeWaPhone(p.celular) === customerPhone && p.reservaid !== cleanId && p.id !== cleanId
      );

      // Si ya NO tiene otros pedidos activos, eliminar por completo todo el historial y estados del cliente
      if (!remainingOrdersForPhone) {
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

  // 3. Limpiar también del registro del agente de vendedor (seller_agent_chats.json)
  try {
    const sellerStorage = loadSellerChatsStorage();
    let sellerChanged = false;
    for (const [prodId, msgs] of Object.entries(sellerStorage.messagesByProduct)) {
      const beforeCount = msgs.length;
      sellerStorage.messagesByProduct[prodId] = msgs.filter(m => m.orderId !== cleanId);
      if (sellerStorage.messagesByProduct[prodId].length !== beforeCount) {
        sellerChanged = true;
      }
    }
    if (sellerChanged) {
      saveSellerChatsStorage(sellerStorage);
    }
  } catch (e) { }

  // 4. Limpieza en la Base de Datos Supabase (DEL-ORD-* y purgar WACHAT del cliente si quedó sin pedidos)
  try {
    if (SUPABASE_URL && SUPABASE_KEY) {
      fetch(`${SUPABASE_URL}/rest/v1/codigos`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          code: `DEL-ORD-${cleanId}-${Date.now()}`,
          dispositivo: JSON.stringify({
            deletedOrderId: cleanId,
            customerPhone: customerPhone || null,
            deletedAt: new Date().toISOString()
          })
        })
      }).catch(() => {});

      fetch(`${SUPABASE_URL}/rest/v1/codigos?code=like.ORD-${cleanId}*`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }).catch(() => {});

      fetch(`${SUPABASE_URL}/rest/v1/pedidos?reservaid=eq.${cleanId}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }).catch(() => {});

      if (customerPhone) {
        fetch(`${SUPABASE_URL}/rest/v1/codigos?code=eq.WACHAT-${customerPhone}`, {
          method: 'DELETE',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`
          }
        }).catch(() => {});
      }
    }
  } catch (e) { }

  return true;
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
    await markOrderDeleted(cleanId, phoneByOrderId[cleanId]);
  }

  // Asegurar ejecución directa en la base de datos Supabase antes de retornar
  if (SUPABASE_URL && SUPABASE_KEY) {
    await Promise.allSettled(
      cleanIds.flatMap((cleanId, idx) => {
        const customerPhone = phoneByOrderId[cleanId] || null;
        const delCode = `DEL-ORD-${cleanId}-${Date.now() + idx}`;
        const tasks: Promise<any>[] = [
          fetch(`${SUPABASE_URL}/rest/v1/codigos`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal'
            },
            body: JSON.stringify({
              code: delCode,
              dispositivo: JSON.stringify({
                deletedOrderId: cleanId,
                customerPhone,
                deletedAt: new Date().toISOString()
              })
            })
          }),
          fetch(`${SUPABASE_URL}/rest/v1/codigos?code=like.ORD-${cleanId}*`, {
            method: 'DELETE',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`
            }
          }),
          fetch(`${SUPABASE_URL}/rest/v1/pedidos?reservaid=eq.${cleanId}`, {
            method: 'DELETE',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`
            }
          })
        ];
        return tasks;
      })
    );
  }

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

  // Sincronización directa en la Base de Datos Supabase (reemplaza snapshots previos ORD-<id>* y guarda el nuevo estado archivado)
  if (SUPABASE_URL && SUPABASE_KEY && updatedOrders.length > 0) {
    await Promise.allSettled(
      updatedOrders.map(async (ord, idx) => {
        const rid = String(ord.reservaid || ord.id || '').trim();
        if (!rid) return;
        await fetch(`${SUPABASE_URL}/rest/v1/codigos?code=like.ORD-${rid}*`, {
          method: 'DELETE',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`
          }
        }).catch(() => {});

        const uniqueCode = `ORD-${rid}-${Date.now() + idx}`;
        processedCloudOrders.add(uniqueCode);
        await fetch(`${SUPABASE_URL}/rest/v1/codigos`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            code: uniqueCode,
            dispositivo: JSON.stringify(ord)
          })
        }).catch(() => {});

        await fetch(`${SUPABASE_URL}/rest/v1/pedidos?reservaid=eq.${rid}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            dispositivo: JSON.stringify(ord)
          })
        }).catch(() => {});
      })
    );
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
    if (process.env[keyName]) return process.env[keyName]!;
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
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
      return process.env.DEEPGRAM_API_KEY.trim();
    }
    const cfg = loadStoreConfig();
    if (cfg.deepgramApiKey && String(cfg.deepgramApiKey).trim()) {
      return String(cfg.deepgramApiKey).trim();
    }
  } catch {}
  const fromEnvFile = readKeyFromEnvFile('DEEPGRAM_API_KEY');
  if (fromEnvFile && fromEnvFile.trim()) return fromEnvFile.trim();
  return DEFAULT_DEEPGRAM_API_KEY;
}

// OpenRouter está 100% desconectado por decisión de arquitectura.
// Toda la infraestructura (STT + LLM + TTS) opera unificada sobre Deepgram.
function getOpenRouterApiKey(): string {
  return '';
}

// Deepgram All-in-One Voice Agent LLM (wss://agent.deepgram.com/v1/agent/converse)
// Utiliza la misma API Key de Deepgram (STT Nova-3 + LLM GPT-4o-mini gestionado por Deepgram + TTS Aura-2)
// sin depender de OpenRouter en absoluto.
export async function callDeepgramAgentLLM(
  systemPrompt: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
  jsonMode = false,
  isPostConfirmMode = false
): Promise<string> {
  const apiKey = getDeepgramApiKey();
  if (!apiKey) {
    console.error('[Deepgram Agent LLM] No Deepgram API key configured');
    return '';
  }

  const voiceProfile = getSelectedVoiceProfile();
  const historyBlock =
    conversationHistory.length > 0
      ? '\n\nHISTORIAL RECIENTE DE LA CONVERSACIÓN CON EL CLIENTE:\n' +
        conversationHistory
          .map(m => `${m.role === 'user' ? 'user/CLIENTE' : 'assistant/AGENTE'}: ${m.content}`)
          .join('\n')
      : '';

  const toolInstruction = isPostConfirmMode
    ? '\n\nINSTRUCCIÓN TÉCNICA OBLIGATORIA: Debés llamar SIEMPRE e INMEDIATAMENTE a la función "emit_reply" poniendo en "reply" tu respuesta completa, sumamente empática, cálida y conversacional de 3 a 5 oraciones completas (mínimo 35 palabras). ESTÁ TERMINANTEMENTE PROHIBIDO responder con 1, 2 o 3 palabras.'
    : jsonMode
      ? '\n\nINSTRUCCIÓN TÉCNICA OBLIGATORIA: Debés llamar SIEMPRE e INMEDIATAMENTE a la función "emit_reply" pasando todos los campos requeridos (reply, locationTextConfirmation, nextStep, congruent, orderConfirmed, extractedHouseReference, correctedName, correctedCity, correctedAddress).'
      : '\n\nINSTRUCCIÓN TÉCNICA OBLIGATORIA: Llamá SIEMPRE a la función "emit_reply" poniendo tu respuesta final en el campo "reply".';

  const fullPrompt = `${systemPrompt}${historyBlock}${toolInstruction}`;

  const functionsSpec = isPostConfirmMode
    ? [
        {
          name: 'emit_reply',
          description:
            'Obligatorio: Llamar SIEMPRE a esta función para entregar la respuesta post-confirmación amplia, empática y con argumentos potentes.',
          parameters: {
            type: 'object',
            properties: {
              reply: {
                type: 'string',
                description:
                  'Tu respuesta hablada AMPLIA, MUY EMPÁTICA, CONVERSACIONAL Y DETALLADA (obligatoriamente de 3 a 5 oraciones completas, mínimo 35 palabras, JAMÁS 1 a 3 palabras), buscando ángulos distintos sin repetir frases previas, sin emojis ni asteriscos.'
              }
            },
            required: ['reply']
          }
        }
      ]
    : jsonMode
      ? [
          {
            name: 'emit_reply',
            description:
              'Obligatorio: Llamar SIEMPRE a esta función para entregar la respuesta estructurada al cliente.',
            parameters: {
              type: 'object',
              properties: {
                reply: {
                  type: 'string',
                  description:
                    'Tu respuesta hablada natural y cálida (2 a 3 oraciones), SIN pronunciar el nombre de la calle, barrio ni ciudad, sin emojis ni asteriscos.'
                },
                locationTextConfirmation: {
                  type: 'string',
                  description:
                    'Texto escrito con la Calle, Barrio y Ciudad/Edificio para que el cliente lo lea en texto (obligatorio en paso 3; vacío en los demás pasos).'
                },
                nextStep: {
                  type: 'number',
                  description: 'Número de paso actual o siguiente (1 al 5).'
                },
                congruent: {
                  type: 'boolean',
                  description: 'true si la respuesta del cliente fue congruente con la pregunta.'
                },
                orderConfirmed: {
                  type: 'boolean',
                  description: 'true cuando el pedido llega al Paso 5 confirmado.'
                },
                extractedHouseReference: {
                  type: 'string',
                  description: 'Descripción de cómo es la casa / fachada / edificio / recepción / referencia cercana.'
                },
                correctedName: { type: 'string' },
                correctedCity: { type: 'string' },
                correctedAddress: { type: 'string' }
              },
              required: ['reply', 'locationTextConfirmation', 'nextStep', 'congruent', 'orderConfirmed']
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

  return new Promise<string>((resolve, reject) => {
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

    const overallTimeout = setTimeout(() => {
      if (assistantText.trim()) {
        finish(assistantText.trim());
      } else {
        finish('', new Error('Deepgram Voice Agent LLM timeout (8s)'));
      }
    }, 8000);

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
                provider: { type: 'open_ai', model: 'gpt-4o-mini', temperature: 0.65 },
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

    ws.on('message', (data, isBinary) => {
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
            console.log('[Deepgram Agent LLM JSON]:', rawArgs.substring(0, 160));
            finish(rawArgs);
          } else {
            try {
              const parsed = JSON.parse(rawArgs);
              const extracted = String(parsed.reply || rawArgs).trim();
              console.log('[Deepgram Agent LLM Text]:', extracted.substring(0, 160));
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
            // Do not prematurely cut off after 450ms if the LLM only emitted a 2-3 word filler phrase before calling emit_reply
            const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
            const minWordsToSettleEarly = isPostConfirmMode ? 24 : 10;
            const settleDelayMs = wordCount >= minWordsToSettleEarly ? 1100 : 2800;
            textSettleTimer = setTimeout(() => {
              if (assistantText.trim()) {
                const currentWords = assistantText.trim().split(/\s+/).filter(Boolean).length;
                if (isPostConfirmMode && currentWords < 20) {
                  // Let overallTimeout or FunctionCallRequest complete it, or resolve empty so rich fallback takes over
                  return;
                }
                if (jsonMode && !assistantText.trim().startsWith('{')) {
                  finish(
                    JSON.stringify({
                      reply: assistantText.trim(),
                      locationTextConfirmation: '',
                      nextStep: 0,
                      congruent: true,
                      orderConfirmed: false
                    })
                  );
                } else {
                  finish(assistantText.trim());
                }
              }
            }, settleDelayMs);
          }
        } else if (msg.type === 'AgentAudioDone' && assistantText.trim()) {
          const currentWords = assistantText.trim().split(/\s+/).filter(Boolean).length;
          if (isPostConfirmMode && currentWords < 20) {
            // Wait a bit in case FunctionCallRequest is right behind
            return;
          }
          if (jsonMode && !assistantText.trim().startsWith('{')) {
            finish(
              JSON.stringify({
                reply: assistantText.trim(),
                locationTextConfirmation: '',
                nextStep: 0,
                congruent: true,
                orderConfirmed: false
              })
            );
          } else {
            finish(assistantText.trim());
          }
        } else if (msg.type === 'Error') {
          console.error('[Deepgram Agent LLM WS Error]:', msg);
          finish('', new Error(msg.description || 'Deepgram Agent Error'));
        }
      } catch {}
    });

    ws.on('error', (err) => {
      console.error('[Deepgram Agent LLM Socket Error]:', err?.message || err);
      finish(assistantText.trim(), err instanceof Error ? err : new Error(String(err)));
    });

    ws.on('close', () => {
      if (!settled) {
        if (assistantText.trim()) {
          finish(assistantText.trim());
        } else {
          finish('', new Error('Deepgram Agent WebSocket closed before response'));
        }
      }
    });
  });
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
const processedCloudCmds = new Set<string>();
const processedCloudOrders = new Set<string>();
const automatedOrderIds = new Set<string>();

// Normalize any Paraguayan or international phone number to standard digits (e.g. 595981123456)
export function normalizeWaPhone(raw: string): string {
  let digits = String(raw || '').replace(/\D/g, '');
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

const lidToPhoneCache = new Map<string, string>();
const phoneToLidCache = new Map<string, string>();

// Resolve WhatsApp Linked Device LID (@lid) to customer's actual phone number
export function resolveJidToCleanPhone(
  session: WaSessionRuntime | undefined,
  jid: string
): string | null {
  if (!jid) return null;
  const rawDigits = jid.split('@')[0].split(':')[0];

  if (jid.endsWith('@s.whatsapp.net')) {
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

  // 1. Check in-memory cache
  if (lidToPhoneCache.has(rawDigits)) {
    return lidToPhoneCache.get(rawDigits)!;
  }

  // 2. Check Baileys v7 signalRepository lidMapping in-memory cache synchronously
  try {
    const sockAny = session?.sock as any;
    const mappingCache = sockAny?.signalRepository?.lidMapping?.mappingCache;
    if (mappingCache && typeof mappingCache.get === 'function') {
      const cachedPn = mappingCache.get(`lid:${rawDigits}`);
      if (cachedPn && typeof cachedPn === 'string') {
        const clean = normalizeWaPhone(cachedPn.split('@')[0].split(':')[0]);
        if (clean) {
          lidToPhoneCache.set(rawDigits, clean);
          phoneToLidCache.set(clean, rawDigits);
          return clean;
        }
      }
    }
  } catch { }

  // 3. Scan disk reverse files in auth directories: lid-mapping-<lid>_reverse.json or creds.json me.lid
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
        if (clean) {
          lidToPhoneCache.set(rawDigits, clean);
          phoneToLidCache.set(clean, rawDigits);
          return clean;
        }
      }
    } catch { }
  }

  // 4. Try matching with known orders in pedidos.json
  try {
    const pedidos = loadPedidos();
    const byOrder = pedidos.find(p => {
      const cp = normalizeWaPhone(p.celular);
      return cp === rawDigits || phoneToLidCache.get(cp) === rawDigits;
    });
    if (byOrder) {
      const clean = normalizeWaPhone(byOrder.celular);
      if (clean) {
        lidToPhoneCache.set(rawDigits, clean);
        return clean;
      }
    }
  } catch { }

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
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const voicePayload = {
      voiceId,
      voiceName,
      productId: productId || null,
      updatedAt: new Date().toISOString()
    };
    await fetch(`${SUPABASE_URL}/rest/v1/codigos`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: `WAVOICE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dispositivo: JSON.stringify(voicePayload)
      })
    }).catch(() => { });

    if (updatedCfg && Array.isArray(updatedCfg.productPages) && updatedCfg.productPages.length > 0) {
      // Fetch latest CFG-* from Supabase first so we merge without losing any remote product fields
      let baseCfg = updatedCfg;
      try {
        const resCfg = await fetch(
          `${SUPABASE_URL}/rest/v1/codigos?select=code,dispositivo&code=like.CFG-*&order=creado.desc&limit=5`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`
            }
          }
        );
        if (resCfg.ok) {
          const rows = await resCfg.json();
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
        }
      } catch (e) { }

      await fetch(`${SUPABASE_URL}/rest/v1/codigos`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: `CFG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dispositivo: JSON.stringify(baseCfg)
        })
      }).catch(() => { });
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
    lastSaveCredsPromise: Promise.resolve()
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

// Push real-time WhatsApp Engine State, Multi-Sessions & Chats to Supabase
let syncTimeout: NodeJS.Timeout | null = null;
export function scheduleCloudStateSync(immediate = false) {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncWhatsAppStateToCloud().catch(() => { });
  }, immediate ? 50 : 300);
}

export async function syncCustomerChatToCloud(phone: string): Promise<void> {
  const clean = normalizeWaPhone(phone);
  if (!clean || !SUPABASE_URL || !SUPABASE_KEY) return;
  // Solo sincronizar a la nube si esta instancia tiene el motor de WhatsApp conectado
  if (getWhatsAppEngineState().status !== 'connected') return;
  try {
    const storage = loadChatsStorage();
    const msgs = storage.chats[clean] || [];
    if (msgs.length === 0) return;

    // Quitar datos pesados de audio base64 para que el payload sea ultraligero (< 25KB)
    const lightweightMsgs = msgs.slice(-50).map(m => ({
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
      voiceEngine: m.voiceEngine
    }));

    const payload = {
      phone: clean,
      messages: lightweightMsgs,
      mode: storage.chatModes[clean] || 'automatico',
      channel: storage.customerChannels[clean] || 'audio',
      convStep: storage.convSteps[clean] || 1,
      updatedAt: new Date().toISOString()
    };

    // Actualizar registro atómico WACHAT-${clean} en Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/codigos?code=eq.WACHAT-${clean}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    }).catch(() => { });

    await fetch(`${SUPABASE_URL}/rest/v1/codigos`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: `WACHAT-${clean}`,
        dispositivo: JSON.stringify(payload)
      })
    }).catch(() => { });
  } catch (e) { }
}

export async function syncWhatsAppStateToCloud(): Promise<void> {
  try {
    const state = getWhatsAppEngineState();
    // REGLA FUNDAMENTAL: Si esta instancia NO está conectada a WhatsApp,
    // NO sobreescribir el estado en la nube con desconectado/vacío.
    if (state.status !== 'connected') {
      return;
    }

    const storage = loadChatsStorage();
    const summary = getAllChatsSummary();
    const payload = {
      engineState: {
        ...state,
        updatedAt: new Date().toISOString()
      },
      sessions: state.sessions || [],
      chatsSummary: summary,
      chats: storage.chats,
      chatModes: storage.chatModes,
      callModes: storage.callModes,
      customerChannels: storage.customerChannels,
      convSteps: storage.convSteps,
      autoChatOnOrder: storage.autoChatOnOrder,
      autoCallOnOrder: storage.autoCallOnOrder,
      preferredChannel: storage.preferredChannel,
      selectedVoiceId: storage.selectedVoiceId,
      voices: DEEPGRAM_VOICE_CATALOG,
      updatedAt: new Date().toISOString()
    };

    const uniqueCode = `WAENG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await fetch(`${SUPABASE_URL}/rest/v1/codigos`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: uniqueCode,
        dispositivo: JSON.stringify(payload)
      })
    });
  } catch (e) { }
}

// Push updated order (e.g. when AI confirms house reference & packs order or Admin edits manually) to Supabase
export async function syncOrderUpdateToCloud(order: any) {
  if (!order?.reservaid) return;
  try {
    order.actualizado_en = new Date().toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/codigos?code=like.ORD-${order.reservaid}*`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    }).catch(() => {});

    const uniqueCode = `ORD-${order.reservaid}-${Date.now()}`;
    processedCloudOrders.add(uniqueCode);
    await fetch(`${SUPABASE_URL}/rest/v1/codigos`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: uniqueCode,
        dispositivo: JSON.stringify(order)
      })
    });
  } catch (e) { }
}

// Automatically trigger chosen channel (Audio or Texto) when a new order arrives if Automático is active
export async function handleNewOrderAutomation(ord: any) {
  if (!ord?.celular) return;
  if (ord.reservaid && automatedOrderIds.has(ord.reservaid)) return;
  if (ord.reservaid) automatedOrderIds.add(ord.reservaid);

  const cleanPhone = normalizeWaPhone(ord.celular);
  if (!cleanPhone) return;

  const storage = loadChatsStorage();
  // Limpiar cualquier residuo de mensajes antiguos de pedidos anteriores eliminados para este teléfono
  if (storage.chats[cleanPhone] && storage.chats[cleanPhone].length > 0) {
    const activePedidos = loadPedidos();
    const otherActiveOrders = activePedidos.filter(
      p => normalizeWaPhone(p.celular) === cleanPhone && p.reservaid !== ord.reservaid && !isOrderDeleted(p.reservaid)
    );
    if (otherActiveOrders.length === 0) {
      storage.chats[cleanPhone] = [];
    }
  }

  const autoCall = storage.autoCallOnOrder;
  const autoChat = storage.autoChatOnOrder;
  const channel: AgentChannel = storage.preferredChannel === 'texto' ? 'texto' : 'audio';

  storage.customerChannels[cleanPhone] = channel;
  storage.callModes[cleanPhone] = autoCall ? 'automatico' : 'manual';
  storage.chatModes[cleanPhone] = autoChat || autoCall ? 'automatico' : 'manual';
  storage.convSteps[cleanPhone] = 1;
  if (!storage.postConfirmStrikes) storage.postConfirmStrikes = {};
  if (!storage.postConfirmBlocked) storage.postConfirmBlocked = {};
  storage.postConfirmStrikes[cleanPhone] = 0;
  storage.postConfirmBlocked[cleanPhone] = false;
  saveChatsStorage(storage);

  if (autoCall || autoChat) {
    if (channel === 'audio') {
      await startOrAdvanceVoiceCall(cleanPhone, ord.reservaid, undefined, true, 'audio');
    } else {
      await triggerAiConfirmationForOrder(cleanPhone, ord.reservaid, true);
    }
  }
}

// Poll Supabase for commands sent from Production UI
async function pollCloudCommandsAndOrders() {
  if ((globalThis as any).__noeluxEngineGen !== myEngineGen) return;
  try {
    const resCmd = await fetch(
      `${SUPABASE_URL}/rest/v1/codigos?select=code,dispositivo,creado&code=like.WACMD-*&order=creado.desc&limit=15`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (resCmd.ok) {
      const rows = await resCmd.json();
      if (Array.isArray(rows)) {
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
                const { reply, locationTextConfirmation, matchedOrder, convStep, forceAudioReply } = await generateSmartAiReply(
                  cleanPhone,
                  String(cmd.text).trim()
                );
                if (reply) {
                  if (historyInfo.channel === 'audio' || forceAudioReply) {
                    await sendWhatsAppVoiceCallTurn(
                      cleanPhone,
                      reply,
                      convStep,
                      matchedOrder?.reservaid,
                      undefined,
                      'audio',
                      undefined,
                      locationTextConfirmation
                    );
                  } else {
                    const fullText = locationTextConfirmation
                      ? `${reply}\n\n${locationTextConfirmation}`
                      : reply;
                    await sendWhatsAppMessage(cleanPhone, fullText, 'ai');
                  }
                }
              }
            } else if (cmd.type === 'add_session') {
              await addWhatsAppSession(cmd.label, cmd.sessionId);
            } else if (cmd.type === 'remove_session' && cmd.sessionId) {
              await removeWhatsAppSession(cmd.sessionId);
            } else if (cmd.type === 'pairing' && cmd.phone) {
              await requestWhatsAppPairingCode(cmd.phone, cmd.sessionId);
            } else if (cmd.type === 'connect') {
              await connectWhatsAppEngine(Boolean(cmd.forceNewQr), cmd.sessionId);
            } else if (cmd.type === 'logout') {
              await disconnectWhatsAppEngine(true, cmd.sessionId);
            }
          } catch (e) { }
        }

        if (anyProcessed) {
          const storage = loadChatsStorage();
          saveChatsStorage(storage);
          await syncWhatsAppStateToCloud();
        }
      }
    }

    // 1.5. Sincronizar lista global de pedidos eliminados (DEL-ORD-*) y configuración (CFG-*) desde Supabase
    try {
      const resDel = await fetch(
        `${SUPABASE_URL}/rest/v1/codigos?select=code,dispositivo&code=like.DEL-ORD-*&order=creado.desc&limit=500`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`
          }
        }
      );
      if (resDel.ok) {
        const delRows = await resDel.json();
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
          // Verificar siempre el archivo físico en disco (sin pre-filtro en memoria) para purgar residuos
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
      }
    } catch (e) {}

    try {
      // 1.5b. Sincronizar voz permanente (WAVOICE-*) y configuración de productos (CFG-*) desde Supabase
      let latestCloudVoiceId = '';
      let latestCloudVoiceProductId = '';
      try {
        const resVoice = await fetch(
          `${SUPABASE_URL}/rest/v1/codigos?select=code,dispositivo&code=like.WAVOICE-*&order=creado.desc&limit=5`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`
            }
          }
        );
        if (resVoice.ok) {
          const voiceRows = await resVoice.json();
          if (Array.isArray(voiceRows) && voiceRows.length > 0 && voiceRows[0]?.dispositivo) {
            const parsedVoice = JSON.parse(voiceRows[0].dispositivo);
            if (parsedVoice?.voiceId) {
              latestCloudVoiceId = normalizeVoiceId(parsedVoice.voiceId);
              latestCloudVoiceProductId = parsedVoice.productId ? String(parsedVoice.productId) : '';
            }
          }
        }
      } catch (e) {}

      const resCfg = await fetch(
        `${SUPABASE_URL}/rest/v1/codigos?select=code,dispositivo&code=like.CFG-*&order=creado.desc&limit=5`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`
          }
        }
      );
      if (resCfg.ok) {
        const cfgRows = await resCfg.json();
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
                // Si WAVOICE-* tiene una voz guardada y el producto en CFG aún no la tenía, aplicarla
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

            // Resolver la voz guardada en Supabase (del producto o de WAVOICE-* / CFG-*) y restaurarla en memoria/disco
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
      }
    } catch (e) {}

    // 2. Sync new ORD-* orders created on Production Website into local pedidos.json
    const resOrd = await fetch(
      `${SUPABASE_URL}/rest/v1/codigos?select=code,dispositivo,creado&code=like.ORD-*&order=creado.desc&limit=10`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (resOrd.ok) {
      const ordRows = await resOrd.json();
      if (Array.isArray(ordRows)) {
        const pedidos = loadPedidos();
        let pedidosChanged = false;
        const newlyAddedOrders: any[] = [];

        // Procesar de más antiguo a más reciente para que actualizaciones posteriores (Paso 2..5)
        // jamás sean sobreescritas por el registro inicial (Paso 1) en Supabase
        const chronologicalOrdRows = [...ordRows].reverse();

        for (const row of chronologicalOrdRows) {
          if (!row?.code || processedCloudOrders.has(row.code)) continue;
          processedCloudOrders.add(row.code);

          try {
            const ord = JSON.parse(row.dispositivo || '{}');
            if (!ord?.reservaid || !ord?.celular) continue;

            // Si el pedido fue eliminado permanentemente, purgar de Supabase y jamás restaurar
            if (deletedOrderIds.has(String(ord.reservaid)) || deletedOrderIds.has(String(ord.id))) {
              if (SUPABASE_URL && SUPABASE_KEY) {
                fetch(`${SUPABASE_URL}/rest/v1/codigos?code=eq.${row.code}`, {
                  method: 'DELETE',
                  headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                  }
                }).catch(() => { });
              }
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
              const alreadyStartedByAi =
                Boolean(ord.atendidoPorIA) ||
                Boolean(ord.ultimoMensajeIA) ||
                preservedStep > 1 ||
                Boolean(ord.datosConfirmados);

              ord.modoIA = ord.modoIA || (isAuto ? 'automatico' : 'manual');
              ord.convStep = preservedStep;
              ord.atendidoPorIA = Boolean(isAuto || alreadyStartedByAi);
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
              // Merge updated fields without ever downgrading convStep or confirmation flags
              const prev = pedidos[existingIdx];
              const mergedStep = Math.max(Number(prev?.convStep) || 1, Number(ord?.convStep) || 1);
              const mergedConfirmed = Boolean(prev?.datosConfirmados || ord?.datosConfirmados);
              const mergedCompleted = Boolean(prev?.agenteCompletado || ord?.agenteCompletado);
              const mergedPacked = Boolean(prev?.empaquetado || ord?.empaquetado);
              const mergedStrikes = Math.max(
                Number(prev?.postConfirmStrikes) || 0,
                Number(ord?.postConfirmStrikes) || 0
              );
              const mergedBlocked = Boolean(prev?.postConfirmBlocked || ord?.postConfirmBlocked);
              pedidos[existingIdx] = {
                ...prev,
                ...ord,
                convStep: mergedStep,
                datosConfirmados: mergedConfirmed,
                agenteCompletado: mergedCompleted,
                empaquetado: mergedPacked,
                postConfirmStrikes: mergedStrikes,
                postConfirmBlocked: mergedBlocked,
                referenciaCasa: ord.referenciaCasa || prev.referenciaCasa || '',
                ultimoMensajeIA: ord.ultimoMensajeIA || prev.ultimoMensajeIA || ''
              };
              pedidosChanged = true;
            }
          } catch (e) { }
        }

        if (pedidosChanged) {
          savePedidos(pedidos);
          const storage = loadChatsStorage();
          saveChatsStorage(storage);
          if (getWhatsAppEngineState().status === 'connected') {
            for (const newOrd of newlyAddedOrders) {
              handleNewOrderAutomation(newOrd).catch(() => { });
            }
          }
        }
      }
    }

    // 3. Self-healing watchdog: keep all registered sessions active or with a ready QR code
    ensureInitialSessionsLoaded();
    for (const session of sessionsMap.values()) {
      if (!session.sock && !session.isConnecting && session.status === 'disconnected') {
        connectWhatsAppEngine(false, session.id).catch(() => { });
      }
    }
  } catch (e) { }
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
    text: msg.text,
    timestamp: msg.timestamp || new Date().toISOString(),
    status: msg.status || 'sent',
    orderId: msg.orderId,
    sessionId: msg.sessionId,
    isVoiceCall: msg.isVoiceCall,
    isAudioNote: msg.isAudioNote,
    agentChannel: msg.agentChannel,
    callLink: msg.callLink,
    convStep: msg.convStep,
    voiceEngine: msg.voiceEngine
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

function loadStoreConfig(): any {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8') || '{}');
    }
  } catch (e) { }
  return {};
}

function loadPedidos(): any[] {
  try {
    if (fs.existsSync(PEDIDOS_FILE)) {
      const list = JSON.parse(fs.readFileSync(PEDIDOS_FILE, 'utf-8') || '[]');
      if (Array.isArray(list)) {
        const filtered = list.filter(
          (p: any) => !deletedOrderIds.has(String(p?.reservaid || '').trim()) && !deletedOrderIds.has(String(p?.id || '').trim())
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
  const pedidos = loadPedidos().filter(p => {
    if (isOrderDeleted(p?.reservaid) || isOrderDeleted(p?.id)) return false;
    const pCel = normalizeWaPhone(p?.celular || p?.telefono || p?.phone || '');
    return pCel === cleanPhone;
  });
  if (pedidos.length === 0) return null;
  // Si el pedido más reciente (pedidos[0]) ya existe, ese es el pedido actual del cliente.
  // También verificamos si el historial de chat activo apunta a un orderId específico.
  try {
    const storage = loadChatsStorage();
    const msgs = storage.chats[cleanPhone] || [];
    const lastOrderId = [...msgs].reverse().find(m => m.orderId)?.orderId;
    if (lastOrderId && (!pedidos[0] || pedidos[0].reservaid === lastOrderId)) {
      const byChatId = pedidos.find(p => p.reservaid === lastOrderId);
      if (byChatId) return byChatId;
    }
  } catch (e) { }
  return pedidos[0];
}

function savePedidos(list: any[]) {
  try {
    fs.writeFileSync(PEDIDOS_FILE, JSON.stringify(list, null, 2), 'utf-8');
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
  return text
    .replace(/Noelux™?\s*Proyector Navideño(\s*12\s*Diseños)?/gi, 'el Proyector Navideño')
    .replace(/\bde\s+el\s+Proyector/gi, 'del Proyector')
    .replace(/[™®©]/g, '')
    .replace(/\*+/g, '')
    .replace(/_+/g, '')
    .replace(/[«»"“”•]/g, '')
    .replace(/\bGs\.\s*([0-9.]+)/gi, '$1 guaraníes')
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



export async function transcribeWhatsAppAudioMessage(
  msg: any
): Promise<{ transcript: string; audioDataUrl: string | null }> {
  try {
    const innerMsg: any =
      msg?.message?.ephemeralMessage?.message ||
      msg?.message?.viewOnceMessage?.message ||
      msg?.message?.viewOnceMessageV2?.message ||
      msg?.message?.viewOnceMessageV2Extension?.message ||
      msg?.message?.documentWithCaptionMessage?.message ||
      msg?.message?.editedMessage?.message?.protocolMessage?.editedMessage ||
      msg?.message;

    const msgToDownload = {
      key: msg?.key,
      message: innerMsg
    };

    let rawBuffer: Buffer | null = null;
    try {
      const downloadPromise = downloadMediaMessage(msgToDownload as any, 'buffer', {}) as Promise<Buffer>;
      const timeoutPromise = new Promise<Buffer>((_, reject) =>
        setTimeout(() => reject(new Error('Audio download timeout')), 5000)
      );
      rawBuffer = await Promise.race([downloadPromise, timeoutPromise]);
    } catch {
      try {
        rawBuffer = (await downloadMediaMessage(msg, 'buffer', {})) as Buffer;
      } catch (e) {
        console.error('[Baileys Media Download Error]:', e);
      }
    }

    if (!rawBuffer || rawBuffer.length < 64) {
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
        const sttTimeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': rawMime || 'audio/ogg'
          },
          body: rawBuffer,
          signal: controller.signal
        }).finally(() => clearTimeout(sttTimeout));

        if (res.ok) {
          const data = await res.json();
          transcript = String(data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '').trim();
          if (transcript) break;
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

  try {
    // Generate OGG/Opus for WhatsApp PTT
    const oggRes = await fetch(
      `https://api.deepgram.com/v1/speak?model=${voiceProfile.deepgramModel}&encoding=opus&container=ogg`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: cleanText })
      }
    );

    if (!oggRes.ok) {
      const errText = await oggRes.text();
      console.error('[Deepgram TTS OGG Error]:', oggRes.status, errText);
      throw new Error(`Deepgram TTS failed: ${oggRes.status}`);
    }

    const oggBuffer = Buffer.from(await oggRes.arrayBuffer());
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
  } catch (e) {
    console.error('[Deepgram TTS Synthesis Error]:', e);
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

// PASO 1: Saludo humano natural, fluido, cálido y profesional (100% Infraestructura Deepgram All-in-One)
export async function buildInitialOrderAiMessage(order: any): Promise<{ text: string; error?: string }> {
  const deepgramKey = getDeepgramApiKey();
  const { contextoIA } = getProductKnowledgeForOrder(order);
  const rawName = String(order?.nombre || '').trim();
  const firstName = getNaturalFirstName(rawName);
  const shortProduct = getNaturalProductName(order?.producto);
  const isBuilding = isBuildingOrderServer(order);

  const fallbackGreeting = isBuilding
    ? `¡Hola ${firstName || 'qué tal'}! Te hablo del área de envíos de Noelux por tu pedido de ${shortProduct} para entrega en tu edificio. ¿Tenés un minutito para verificar tus datos de entrega?`
    : `¡Hola ${firstName || 'qué tal'}! Te hablo del área de envíos de Noelux por tu pedido de ${shortProduct}. ¿Tenés un minutito para verificar tus datos de entrega?`;

  if (!deepgramKey) {
    return {
      text: fallbackGreeting,
      error: '⚠️ AVISO: No hay API Key de Deepgram configurada. Se utilizó el saludo inicial de contingencia.'
    };
  }

  try {
    const genderInfo = detectCustomerGender(rawName);
    const systemPrompt = `Sos un agente de confirmación de envíos de Noelux en Paraguay. Hablás español paraguayo informal pero profesional (usás "vos", "tenés", "podés"). Sos cálido, empático y breve. NO usés emojis. NO usés asteriscos ni markdown.
${genderInfo.instruccionGenero}

PRODUCTO: ${contextoIA}

Generá un mensaje inicial de saludo para el cliente ${firstName || 'el cliente'} sobre su pedido de ${shortProduct}${isBuilding ? ' (registrado para entrega en edificio)' : ''}. Presentate como del área de envíos, mencioná el producto, y preguntale si tiene un minutito para confirmar datos de entrega. Sé breve y natural (2-3 oraciones máximo).`;

    const reply = await callDeepgramAgentLLM(systemPrompt, [], 'Generá el mensaje inicial de saludo.', false);
    if (reply) {
      return { text: reply };
    }
    return {
      text: fallbackGreeting
    };
  } catch (e: any) {
    console.warn('[Deepgram Agent Greeting Fallback]:', e?.message || e);
    return {
      text: fallbackGreeting
    };
  }
}

// Get or initialize current step (1..5) for a phone/order
function getOrderConvStep(cleanPhone: string, order: any): number {
  const storage = loadChatsStorage();
  if (order?.referenciaCasa && order?.empaquetado) return 5;
  const storedStep = storage.convSteps[cleanPhone] || order?.convStep || 1;
  return Math.min(Math.max(Number(storedStep) || 1, 1), 5);
}

function setOrderConvStep(cleanPhone: string, order: any | null, step: number) {
  const storage = loadChatsStorage();
  storage.convSteps[cleanPhone] = step;
  saveChatsStorage(storage);
  if (order) {
    order.convStep = step;
  }
}

// Returns 1 minute (60,000 ms) for Attempt #1, and 1 hour (3,600,000 ms) for Attempt #2, #3, #4... consecutive
export function getInactivityFollowUpDelayMs(attemptNumber: number): number {
  return attemptNumber <= 1 ? 60 * 1000 : 60 * 60 * 1000;
}

// Non-repetitive, empathetic, educated, and corporate/professional fallback messages for 1-minute and consecutive 1-hour follow-ups
export function buildCorporateInactivityFollowUpFallback(
  displayFirstName: string,
  gender: 'male' | 'female' | 'neutral',
  currentStep: number,
  attemptNumber: number,
  shortProduct: string,
  isBuilding = false
): string {
  const ocupadoWord = gender === 'female' ? 'ocupada' : 'ocupado';
  let pendingDatum = 'estos datos de entrega';
  if (currentStep === 2) {
    pendingDatum = 'la confirmación de tu nombre y número de contacto';
  } else if (currentStep === 3) {
    pendingDatum = isBuilding
      ? 'la confirmación de los datos de tu edificio, piso, departamento y el mapa que te pasé acá arriba'
      : 'la confirmación de la dirección y el mapa que te pasé acá arriba';
  } else if (currentStep === 4) {
    pendingDatum = isBuilding
      ? 'la confirmación de cómo recibe el pedido en tu edificio (si recibe la recepcionista o bajás personalmente y algún punto de referencia al lado del edificio)'
      : 'una breve referencia de cómo es la fachada o el color de portón de tu casa';
  }

  // Attempt #1: 1-minute follow-up (empathetic, educated, professional, never asking what time to call back)
  if (attemptNumber <= 1) {
    const oneMinVariants = [
      `${displayFirstName}, ¿sabés qué? Comprendo perfectamente que tal vez estarías ${ocupadoWord} o en tu trabajo en este momento y lamento mucho molestarte realmente, pero es muy importante para mí recibir ${pendingDatum} para dejar confirmado el envío de tu ${shortProduct}. ¿Será posible que me vuelvas a escribir por acá cuando tengas un tiempito libre? Así completamos tu pedido.`,
      `Hola ${displayFirstName}, disculpame la molestia, entiendo que quizás ahora mismo estás en pleno trabajo o con tus actividades y por eso no pudiste responderme. Como para nuestro equipo de envíos es fundamental contar con ${pendingDatum} para autorizar el despacho de tu ${shortProduct}, te dejo este mensaje para que me vuelvas a escribir apenas tengas un momentito libre y así lo dejamos listo.`,
      `${displayFirstName}, te pido mil disculpas por insistirte un segundito, comprendo totalmente si estás ${ocupadoWord} ahora mismo. Solo quería comentarte con todo respeto que necesitamos validar ${pendingDatum} en nuestro sistema informático para liberar la salida de tu ${shortProduct}. Cuando tengas un tiempito disponible, ¿me podés volver a escribir por este chat así terminamos de confirmar?`,
      `Estimado equipo de despacho por acá, ${displayFirstName}: comprendo de corazón que tal vez te encontrás ${ocupadoWord} en tu jornada laboral y lamento incomodarte. Para nosotros es sumamente importante registrar ${pendingDatum} y así garantizar el envío de tu ${shortProduct} sin demoras, por lo que quedamos atentos acá en línea esperando que nos vuelvas a escribir cuando tengas un ratito libre.`
    ];
    const vIdx = (currentStep - 1 + displayFirstName.length) % oneMinVariants.length;
    return oneMinVariants[vIdx];
  }

  // Attempt #2, #3, #4...: Consecutive 1-hour follow-ups (1h, 2h, 3h...) with distinct corporate/logistical angles
  const hoursElapsed = attemptNumber - 1;
  const hoursLabel = hoursElapsed === 1 ? 'ya pasó una hora' : `ya pasaron ${hoursElapsed} horas`;
  const hourlyVariants = [
    `${displayFirstName}, te saludo nuevamente con mucho respeto desde el área de logística. Te comento que ${hoursLabel} desde que quedamos pendientes y seguimos acá al tanto esperando para poder cerrar y precintar la caja de tu ${shortProduct}, ya que el móvil de reparto tiene programada su salida hacia tu zona. Comprendo que seguramente seguís ${ocupadoWord}, así que apenas tengas un momento libre por favor volvé a escribirme por acá para sellar tu paquete y despacharlo.`,
    `Hola ${displayFirstName}, disculpame que te deje este breve aviso empresarial: ${hoursLabel} que en el sector de empaque mantenemos tu caja de ${shortProduct} separada en mesa de despacho aguardando ${pendingDatum} para poder emitir tu guía de ruta. Sabemos que podés estar con mucho trabajo, por eso te esperamos con total paciencia; cuando tengas un tiempito por favor respondeme por este medio así cerramos tu caja y sale hoy mismo.`,
    `${displayFirstName}, ¿cómo estás? Te escribo con mucha educación desde coordinación de envíos porque ${hoursLabel} que estuvimos aguardando tu respuesta para terminar de sellar el embalaje de tu ${shortProduct} antes de que cierre la carga del camión repartidor. Lamento mucho molestarte en tus actividades, pero apenas tengas un minuto libre ¿será posible que me escribas por acá para darle salida inmediata a tu pedido?`,
    `Qué tal ${displayFirstName}, te contacto con total cortesía desde nuestra central operativa. Como ${hoursLabel} y el equipo técnico ya dejó probado tu ${shortProduct} listo para entrar en la camioneta de reparto, seguimos atentos únicamente a ${pendingDatum} para cerrar tu caja con su precinto de seguridad. Cuando te desocupes un ratito, escribinos por acá mismo y completamos el despacho al instante.`,
    `${displayFirstName}, lamento interrumpirte nuevamente, te hablo con mucho respeto desde administración de despacho. Ya cumplimos ${hoursElapsed === 1 ? 'una hora' : `${hoursElapsed} horas`} reservando tu prioridad en la hoja de ruta de hoy y manteniendo tu caja abierta a la espera de ${pendingDatum}. Quedamos atentos acá en el chat para que nos vuelvas a escribir en cuanto tengas un momento disponible y así enviarte tu ${shortProduct}.`
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
      if (!matchedOrder) return;

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
      const ocupadoWord = genderInfo.gender === 'female' ? 'ocupada' : 'ocupado';
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

      let followUpText = '';
      if (getDeepgramApiKey()) {
        try {
          const histForFollowUp = history.slice(-8).map(m => ({
            role: (m.sender === 'client' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: String(m.text || '')
          }));
          followUpText = await callDeepgramAgentLLM(
            followUpPrompt,
            histForFollowUp,
            attemptNumber === 1
              ? '[Pasó 1 minuto sin respuesta. Enviá el mensaje empático y profesional pidiéndole que te vuelva a escribir cuando tenga tiempo.]'
              : `[Pasaron ${hoursElapsed} hora(s) sin respuesta. Enviá un nuevo mensaje empresarial y muy amable avisando que seguimos esperando para cerrar la caja de su envío.]`,
            false
          );
        } catch {}
      }

      if (
        !followUpText ||
        followUpText.length < 15 ||
        /a qu[eé] hora te (llamo|escribo|vuelvo a escribir)/i.test(followUpText)
      ) {
        followUpText = buildCorporateInactivityFollowUpFallback(
          displayFirstName,
          genderInfo.gender,
          currentStep,
          attemptNumber,
          shortProduct
        );
      }

      followUpText = normalizeParaguayanPhonesInText(followUpText);

      const activeChannel: AgentChannel =
        storage.customerChannels[cleanPhone] ||
        matchedOrder.canalIA ||
        storage.preferredChannel ||
        'audio';

      if (activeChannel === 'audio') {
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
      } else {
        await sendWhatsAppMessage(
          cleanPhone,
          followUpText,
          'ai',
          matchedOrder.reservaid,
          preferredSessionId
        );
      }

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
    pedidos.find(p => normalizeWaPhone(p.celular) === cleanPhone) ||
    null;

  const history = getChatHistory(cleanPhone).messages;
  const lastMsg = history.length > 0 ? history[history.length - 1] : null;

  // 1. If the last message in the chat was from the client and not forceRestart, reply to the client and advance the conversation
  if (!forceRestart && lastMsg && lastMsg.sender === 'client') {
    const { reply, locationTextConfirmation, convStep } = await generateSmartAiReply(cleanPhone, lastMsg.text);
    if (reply) {
      const fullText = locationTextConfirmation ? `${reply}\n\n${locationTextConfirmation}` : reply;
      if (matchedOrder) {
        matchedOrder.modoIA = 'automatico';
        matchedOrder.canalIA = 'texto';
        matchedOrder.convStep = convStep;
        matchedOrder.atendidoPorIA = true;
        matchedOrder.ultimoMensajeIA = fullText;
        savePedidos(pedidos);
      }
      await sendWhatsAppMessage(cleanPhone, fullText, 'ai', matchedOrder?.reservaid);
      return;
    }
  }

  // 2. Otherwise (starting or explicitly clicking "💬 Texto"), send the initial Paso 1 greeting via WhatsApp Text!
  const { text: initialText, error: initError } = await buildInitialOrderAiMessage(matchedOrder);
  if (initError) {
    console.warn('[AI Init Notice]', initError);
    // Broadcast warning to admin panel via WebSocket/state
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
    matchedOrder.canalIA = 'texto';
    matchedOrder.convStep = 1;
    matchedOrder.atendidoPorIA = true;
    matchedOrder.ultimoMensajeIA = initialText;
    savePedidos(pedidos);
    syncOrderUpdateToCloud(matchedOrder).catch(() => { });
  }
  setOrderConvStep(cleanPhone, matchedOrder, 1);
  await sendWhatsAppMessage(cleanPhone, initialText, 'ai', matchedOrder?.reservaid);
  scheduleCustomerInactivityFollowUp(cleanPhone, matchedOrder?.reservaid);
}

// Send a Voice Note ('audio') via Deepgram Aura-2 + OGG/Opus PTT or text fallback,
// plus an optional companion TEXT message for street, neighborhood & city confirmation
export async function sendWhatsAppVoiceCallTurn(
  phone: string,
  spokenTextRaw: string | any,
  convStep: number,
  orderId?: string,
  preferredSessionId?: string,
  channel: AgentChannel = 'audio',
  voiceIdOverride?: string,
  locationTextConfirmation?: string,
  isFollowUpTurn = false
): Promise<{
  sentViaSocket: boolean;
  message: WaChatMessage;
  audioDataUrl: string | null;
  convStep: number;
  voiceEngine: string;
  callRung?: boolean;
}> {
  const cleanPhone = normalizeWaPhone(phone);
  const spokenText = typeof spokenTextRaw === 'string'
    ? spokenTextRaw
    : (spokenTextRaw && typeof spokenTextRaw === 'object' && spokenTextRaw.text ? String(spokenTextRaw.text) : String(spokenTextRaw || ''));
  const cleanLocationText = typeof locationTextConfirmation === 'string' ? locationTextConfirmation.trim() : '';

  let resolvedVoiceId = voiceIdOverride;
  if (!resolvedVoiceId) {
    try {
      const pedidos = loadPedidos();
      const matchedOrder =
        (orderId && pedidos.find(p => p.reservaid === orderId)) ||
        pedidos.find(p => normalizeWaPhone(p.celular) === cleanPhone) ||
        null;
      resolvedVoiceId = getVoiceProfileForOrder(matchedOrder).id;
    } catch (e) { }
  }
  const tts = await synthesizeSpeechSelfHosted(spokenText, resolvedVoiceId);
  const activeSession = pickConnectedSession(preferredSessionId);

  if (activeSession && activeSession.sock) {
    const jid = `${cleanPhone}@s.whatsapp.net`;
    // Proactively resolve and cache @lid <-> cleanPhone in Baileys v7 so incoming @lid replies always match this customer
    try {
      const sockAny = activeSession.sock as any;
      if (sockAny?.signalRepository?.lidMapping?.getLIDForPN) {
        Promise.resolve(sockAny.signalRepository.lidMapping.getLIDForPN(jid))
          .then((lid: any) => {
            if (lid && typeof lid === 'string') {
              const lidDigits = lid.split('@')[0].split(':')[0].replace(/\D/g, '');
              if (lidDigits) {
                lidToPhoneCache.set(lidDigits, cleanPhone);
                phoneToLidCache.set(cleanPhone, lidDigits);
              }
            }
          })
          .catch(() => {});
      }
    } catch {}

    const preMsgId = generateMessageIDV2(activeSession.sock.user?.id);
    recentlySentMsgIds.add(preMsgId);
    setTimeout(() => recentlySentMsgIds.delete(preMsgId), 45000);
    let msgId = preMsgId;
    let anySent = false;

    // 1. If channel === 'audio', send 100% compliant OGG/Opus (audio/ogg; codecs=opus) PTT Voice Note to chat
    if (channel === 'audio' && tts.audioBuffer) {
      try {
        await activeSession.sock.sendPresenceUpdate('recording', jid);
        const sentAudio = await activeSession.sock.sendMessage(
          jid,
          {
            audio: tts.audioBuffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            seconds: tts.durationSeconds,
            waveform: tts.waveform
          },
          { messageId: preMsgId }
        );
        if (sentAudio?.key?.id) {
          msgId = sentAudio.key.id;
          anySent = true;
          recentlySentMsgIds.add(msgId);
          setTimeout(() => recentlySentMsgIds.delete(msgId), 45000);
        }
      } catch (audioErr) {
        console.error('[Deepgram OGG/Opus PTT Send Error]:', audioErr);
      }
    }

    // 2. Fallback to text if channel === 'texto' OR if audio synthesis/sending failed so the customer is never left without a response
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
          setTimeout(() => recentlySentMsgIds.delete(sentText.key.id!), 45000);
        }
      } catch (textErr) {
        console.error('[Voice Note Fallback Text Error]:', textErr);
      }
    }

    if (anySent) {
      const senderLabel =
        channel === 'audio'
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

      // 3. Si estamos en modo 'audio' y este turno incluye confirmación/reconfirmación de Calle, Barrio y Ciudad,
      // pausar presencia y esperar 650ms para que la nota de voz termine de transmitirse y no colisione en el archivo de sesión Signal
      if (channel === 'audio' && cleanLocationText) {
        setTimeout(async () => {
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
        }, 650);
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
  const cleanChannel = normalizeChannel(channel);
  const pedidos = loadPedidos();
  const matchedOrder =
    (orderId && pedidos.find(p => p.reservaid === orderId)) ||
    pedidos.find(p => normalizeWaPhone(p.celular) === cleanPhone) ||
    null;
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
  const anyVoiceOrAudioSent = history.some(
    m =>
      m.sender === 'ai' &&
      m.isAudioNote &&
      m.status === 'sent' &&
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

    const { reply, locationTextConfirmation, matchedOrder: updatedOrder, convStep, forceAudioReply } = await generateSmartAiReply(
      cleanPhone,
      customerSpokenText.trim()
    );

    // Si el cliente ya superó los 3 mensajes post-confirmación (auto-bloqueado), NO responder nada ni gastar TTS
    if (!reply) {
      return {
        reply: '',
        audioDataUrl: null,
        convStep,
        voiceEngine: activeVoice.name,
        matchedOrder: updatedOrder,
        message: history[history.length - 1] || ({} as WaChatMessage),
        sentViaSocket: false,
        channel: cleanChannel,
        callRung: false
      };
    }

    const effectiveChannel: AgentChannel = forceAudioReply && cleanChannel === 'texto' ? 'audio' : cleanChannel;
    const turnRes = await sendWhatsAppVoiceCallTurn(
      cleanPhone,
      reply,
      convStep,
      updatedOrder?.reservaid,
      undefined,
      effectiveChannel,
      undefined,
      locationTextConfirmation
    );

    return {
      reply,
      audioDataUrl: turnRes.audioDataUrl,
      convStep,
      voiceEngine: turnRes.voiceEngine,
      matchedOrder: updatedOrder,
      message: turnRes.message,
      sentViaSocket: turnRes.sentViaSocket,
      channel: effectiveChannel,
      callRung: turnRes.callRung
    };
  }

  // 2. If starting the call/audio for the first time or resetting to Paso 1
  if (resetCall || !anyVoiceOrAudioSent) {
    const initRes = await buildInitialOrderAiMessage(matchedOrder);
    const initialSpoken = initRes?.text || 'Hola, ¿qué tal? ¿Cómo estás? Te hablo del área de envíos por tu pedido.';
    if (matchedOrder) {
      matchedOrder.modoIA = 'automatico';
      matchedOrder.canalIA = cleanChannel;
      matchedOrder.vozAgente = activeVoice.id;
      matchedOrder.vozAgenteNombre = activeVoice.name;
      matchedOrder.convStep = 1;
      matchedOrder.atendidoPorIA = true;
      matchedOrder.ultimoMensajeIA = initialSpoken;
      if (resetCall) {
        matchedOrder.datosConfirmados = false;
        matchedOrder.agenteCompletado = false;
        matchedOrder.postConfirmStrikes = 0;
        matchedOrder.postConfirmBlocked = false;
        matchedOrder.locationTextSentOnce = false;
        matchedOrder.systemLocationConfirmedSent = false;
        matchedOrder.promoPagoAdelantadoStage = '';
        matchedOrder.pagoAdelantadoComprobanteRecibido = false;
        matchedOrder.pagoAdelantadoEstado = '';
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
    }
    setOrderConvStep(cleanPhone, matchedOrder, 1);

    const turnRes = await sendWhatsAppVoiceCallTurn(
      cleanPhone,
      initialSpoken,
      1,
      matchedOrder?.reservaid,
      undefined,
      cleanChannel
    );
    return {
      reply: initialSpoken,
      audioDataUrl: turnRes.audioDataUrl,
      convStep: 1,
      voiceEngine: turnRes.voiceEngine,
      matchedOrder,
      message: turnRes.message,
      sentViaSocket: turnRes.sentViaSocket,
      channel: cleanChannel,
      callRung: turnRes.callRung
    };
  }

  // 3. If the last message in history was from the client, advance to the next step and send voice/audio turn
  if (lastMsg && lastMsg.sender === 'client') {
    const { reply, locationTextConfirmation, matchedOrder: updatedOrder, convStep, forceAudioReply } = await generateSmartAiReply(
      cleanPhone,
      lastMsg.text
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
        channel: cleanChannel,
        callRung: false
      };
    }
    const effectiveChannel: AgentChannel = forceAudioReply && cleanChannel === 'texto' ? 'audio' : cleanChannel;
    const turnRes = await sendWhatsAppVoiceCallTurn(
      cleanPhone,
      reply,
      convStep,
      updatedOrder?.reservaid,
      undefined,
      effectiveChannel,
      undefined,
      locationTextConfirmation
    );
    return {
      reply,
      audioDataUrl: turnRes.audioDataUrl,
      convStep,
      voiceEngine: turnRes.voiceEngine,
      matchedOrder: updatedOrder,
      message: turnRes.message,
      sentViaSocket: turnRes.sentViaSocket,
      channel: cleanChannel,
      callRung: turnRes.callRung
    };
  }

  // 4. Otherwise actively send the current step voice/audio turn to the customer's WhatsApp
  const currentStep = getOrderConvStep(cleanPhone, matchedOrder);
  const lastAiMsg = [...history].reverse().find(m => m.sender === 'ai');
  const isLegacyGreeting =
    !lastAiMsg?.text ||
    lastAiMsg.text.includes('Sabés para qué') ||
    lastAiMsg.text.includes('ni 10 segundos');
  const textToSpeak =
    currentStep === 1 || isLegacyGreeting
      ? (await buildInitialOrderAiMessage(matchedOrder))?.text || 'Hola, ¿qué tal? ¿Cómo estás? Te hablo del área de envíos por tu pedido.'
      : (typeof lastAiMsg.text === 'string' ? lastAiMsg.text : 'Hola, ¿qué tal? ¿Cómo estás?');

  if (matchedOrder) {
    matchedOrder.modoIA = 'automatico';
    matchedOrder.canalIA = cleanChannel;
    matchedOrder.atendidoPorIA = true;
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

// Asynchronous Smart AI Reply (Step-by-Step 1..5 Human Conversational Flow driven 100% by LLM)
export async function generateSmartAiReply(
  phone: string,
  incomingText: string
): Promise<{
  reply: string;
  locationTextConfirmation?: string;
  matchedOrder: any | null;
  convStep: number;
  error?: string;
  forceAudioReply?: boolean;
}> {
  return generateContextualAiReply(phone, incomingText);
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

// Extract the direct raw Google Maps URL from an order (never using external shorteners that can fail or redirect to broken pages)
export function extractCanonicalMapUrlFromOrder(order: any): string {
  if (!order) return '';
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
  const directMapUrl = extractCanonicalMapUrlFromOrder(order);
  const isBuilding = isBuildingOrderServer(order);

  // PASO 3: Primera y ÚNICA vez que se envía la dirección en texto + UN SOLO enlace directo del mapa bien explicado y guiado
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

      const mapSection = directMapUrl
        ? `\n\n🗺️ *Este es el mapa que se ha guardado de la ubicación exacta de tu edificio:*\n` +
          `🔘 *[ TOCÁ AQUÍ PARA ABRIR TU MAPA ]* 👇\n` +
          `${directMapUrl}\n\n` +
          `👉 *Cómo revisarlo paso a paso:* Podés darle clic al enlace de arriba y se te va a abrir en tu navegador. Visualizá bien que marque tu edificio, y después volvé otra vez acá al chat y confirmame si el nombre del edificio, tu piso, departamento y recepción están todos correctos para que sigamos en el siguiente paso.`
        : `\n\n👉 *Por favor revisá bien estos datos de tu edificio que pusiste en el formulario y confirmame acá en el chat si está todo correcto para que sigamos en el siguiente paso (o decime si querés corregir calle, edificio, piso o departamento).*`;

      return (
        `📋 *Estos son los datos de tu EDIFICIO que pusiste en el formulario para que se te entregue tu producto:*\n\n` +
        `🏙️ *Ciudad:* ${city}${dept ? ` (${dept})` : ''}\n` +
        `🏢 *Nombre del Edificio:* ${buildingName}\n` +
        `🔢 *Piso y Departamento / Cuarto:* Piso ${floor} · Dpto./Cuarto ${apt}\n` +
        `🛣️ *Calle donde está el edificio:* ${cleanAddress}\n` +
        `🛎️ *Recepción del pedido:* ${recepText}` +
        mapSection
      );
    }

    const mapSection = directMapUrl
      ? `\n\n🗺️ *Este es el mapa que se ha guardado de la dirección exacta de tu casa:*\n` +
        `🔘 *[ TOCÁ AQUÍ PARA ABRIR TU MAPA ]* 👇\n` +
        `${directMapUrl}\n\n` +
        `👉 *Cómo revisarlo paso a paso:* Podés darle clic al enlace de arriba y se te va a abrir en tu navegador. Visualizá bien que marque tu casa, y después volvé otra vez acá al chat y confirmame si está todo correcto para que sigamos en el siguiente paso.`
      : `\n\n👉 *Por favor revisá bien estos datos que pusiste en el formulario y confirmame acá en el chat si está todo correcto para que sigamos en el siguiente paso (o decime si querés corregir tu calle o barrio).*`;

    return (
      `📋 *Estos son los datos de dirección que pusiste en el formulario para que se te entregue tu producto:*\n\n` +
      `🏙️ *Ciudad donde vivís:* ${city}${dept ? ` (${dept})` : ''}\n` +
      `🏘️ *Calle y barrio donde vivís:* ${cleanAddress}` +
      mapSection
    );
  }

  // En el Paso 4 y Paso 5 NO se envía mensaje en texto (la confirmación del sistema informático se dice únicamente en VOZ)
  return '';
}

// Analyze ALL chat history and ALL orders for this phone number so the agent has global cross-chat context
// and knows whether the order is already ready to close/confirm ("apto para confirmar y cerrar")
function buildGlobalCustomerContextAndReadiness(
  cleanPhone: string,
  order: any,
  allPhoneOrders: any[],
  fullChatHistory: WaChatMessage[],
  latestCustomerInput: string
): {
  globalContextSummary: string;
  hasGpsConfirmed: boolean;
  detectedHouseRefFromChat: string;
  isReadyToConfirmNow: boolean;
} {
  const clientMessages = fullChatHistory
    .filter(m => m.sender === 'client')
    .map(m => String(m.text || '').replace(/^🎤\s*/, '').trim())
    .filter(Boolean);

  const allClientTextCombined = [...clientMessages, latestCustomerInput].join(' | ');
  const isBuilding = isBuildingOrderServer(order);
  const buildingSummary = formatBuildingDetailsServer(order);

  const hasGpsInOrder = Boolean(
    order?.gpsConfirmado ||
    order?.gpsLink ||
    (typeof order?.gpsLat === 'number' && typeof order?.gpsLng === 'number')
  );
  const hasGpsInChat =
    /Ubicaci[oó]n GPS|maps\.google|google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(
      allClientTextCombined
    );
  const hasGpsConfirmed = hasGpsInOrder || hasGpsInChat;

  // Detect if customer already mentioned house facade/gate/reference or building reception/reference anywhere in the chat or web address
  const houseRefRegex =
    /\b(casa\s+\w+|edificio\s+\w+|torre\s+\w+|piso\s*\d+|dpto|departamento|recepci[oó]n|recepcionista|porter[ií]a|guardia|conserje|port[oó]n\s+\w+|reja\s+\w+|rejas\s+\w+|muralla\s+\w+|frente\s+a|al\s+lado\s+de|esquina|despensa|supermercado|farmacia|escuela|colegio|capilla|iglesia|cancha|color\s+\w+|blanca|blanco|verde|amarilla|amarillo|azul|gris|roja|rojo|negro|negra|ladrillo|dos\s+pisos|2\s+pisos)\b/i;

  let detectedHouseRefFromChat = String(order?.referenciaCasa || '').trim();
  if (!detectedHouseRefFromChat && isBuilding && buildingSummary) {
    // If building order already has reception & floor details from the form, check if customer also gave any reference in chat
    for (const msgTxt of [...clientMessages, latestCustomerInput].reverse()) {
      if (houseRefRegex.test(msgTxt) && msgTxt.length >= 4) {
        detectedHouseRefFromChat = `${buildingSummary} · ${msgTxt}`;
        break;
      }
    }
  }
  if (!detectedHouseRefFromChat) {
    if (houseRefRegex.test(String(order?.direccion || ''))) {
      detectedHouseRefFromChat = String(order.direccion).trim();
    } else {
      for (const msgTxt of [...clientMessages, latestCustomerInput].reverse()) {
        if (houseRefRegex.test(msgTxt) && msgTxt.length >= 5) {
          detectedHouseRefFromChat = msgTxt;
          break;
        }
      }
    }
  }

  const hasValidNameAndPhone = Boolean(
    order?.nombre && String(order.nombre).trim().length >= 2 && cleanPhone.length >= 8
  );
  const hasValidAddressOrGps = Boolean(
    (order?.ciudad && order?.direccion) || hasGpsConfirmed
  );
  const hasHouseReference = Boolean(detectedHouseRefFromChat);

  const currentStep = getOrderConvStep(cleanPhone, order);
  const isReadyToConfirmNow =
    hasValidNameAndPhone &&
    hasValidAddressOrGps &&
    (currentStep >= 4 || (currentStep >= 3 && hasHouseReference));

  const previousOrdersSummary =
    allPhoneOrders.length > 1
      ? `Historial de pedidos de este número (${allPhoneOrders.length} pedidos registrados): ` +
        allPhoneOrders
          .slice(0, 4)
          .map(
            p =>
              `#${p.reservaid} (${p.producto || 'Noelux'}, ${p.cantidad || 1} un., estado: ${
                p.datosConfirmados ? 'CONFIRMADO' : `en paso ${p.convStep || 1}/5`
              })`
          )
          .join('; ')
      : `Pedido único activo: #${order?.reservaid || 'S/N'} (${order?.cantidad || 1} un.)`;

  const clientTranscriptSummary =
    clientMessages.length > 0
      ? clientMessages
          .slice(-15)
          .map((t, idx) => `  [Mensaje Cliente #${idx + 1}]: "${t}"`)
          .join('\n')
      : '  (Recién inicia la conversación)';

  const globalContextSummary = `MEMORIA GLOBAL Y DIAGNÓSTICO DE APTITUD DE TODA LA CONVERSACIÓN:
- ${previousOrdersSummary}
- Tipo de localidad del cliente: ${isBuilding ? `🏢 EDIFICIO DE DEPARTAMENTOS (${buildingSummary || 'Datos de edificio registrados'})` : '🏠 CASA INDEPENDIENTE'}
- Total de mensajes intercambiados en el historial de este cliente: ${fullChatHistory.length}
- Resumen de todo lo que el cliente ya dijo a lo largo del chat:
${clientTranscriptSummary}
- ¿Nombre y Teléfono validados?: ${hasValidNameAndPhone ? 'SÍ (' + order?.nombre + ' / ' + cleanPhone + ')' : 'PENDIENTE'}
- ¿Ciudad y Dirección registradas?: ${hasValidAddressOrGps ? 'SÍ (' + (order?.ciudad || '') + ' - ' + (order?.direccion || '') + ')' : 'PENDIENTE'}
- ¿Ubicación GPS Exacta en Mapa confirmada para el Courier?: ${
    hasGpsConfirmed
      ? 'SÍ, MAPA GPS EXACTO CONFIRMADO (' + (order?.gpsLink || 'Coordenadas GPS recibidas') + ')'
      : 'Todavía no envió pin GPS (opcional si confirma calle y referencia)'
  }
- ¿Referencia de ${isBuilding ? 'edificio / recepción / acceso' : 'fachada / casa'} detectada en el historial?: ${
    hasHouseReference
      ? 'SÍ ("' + detectedHouseRefFromChat + '")'
      : isBuilding
        ? 'Todavía falta reconfirmar acceso en recepción/portería y referencia al lado del edificio'
        : 'Todavía falta que indique cómo es la fachada/portón de su casa'
  }
- ¿ESTÁ APTO PARA CERRAR Y CONFIRMAR EL PEDIDO EN ESTE TURNO?: ${
    isReadyToConfirmNow
      ? 'SÍ (Si el mensaje actual del cliente confirma o aporta la referencia/ubicación, debés cerrar ya en nextStep: 5 con orderConfirmed: true)'
      : 'EN PROCESO (Guiá al cliente con amabilidad al siguiente dato pendiente sin repetir preguntas ya respondidas)'
  }`;

  return {
    globalContextSummary,
    hasGpsConfirmed,
    detectedHouseRefFromChat,
    isReadyToConfirmNow
  };
}

// Build the system prompt for the LLM with full product/order context and dynamic comprehension rules
function buildLLMSystemPrompt(
  order: any,
  productKnowledge: string,
  currentStep: number,
  globalReadinessInfo?: {
    globalContextSummary: string;
    hasGpsConfirmed: boolean;
    detectedHouseRefFromChat: string;
    isReadyToConfirmNow: boolean;
  }
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
    order?.referenciaCasa || globalReadinessInfo?.detectedHouseRefFromChat || buildingDetails || '';
  const gpsUrl = extractCanonicalMapUrlFromOrder(order);
  const targetNextStep = Math.min(5, currentStep + 1);

  const rawMontoNum = Number(String(order?.monto || '189000').replace(/\D/g, '')) || 189000;
  const discountedMontoNum = Math.max(50000, rawMontoNum - 50000);
  const montoOriginalFormatted = formatGsServer(rawMontoNum);
  const montoDescuentoFormatted = formatGsServer(discountedMontoNum);

  const step3To5Instructions = isBuilding
    ? `  1. Cuando pases al PASO 3 (Enviar por primera y ÚNICA vez el texto descriptivo de su EDIFICIO y mapa):
     - En "reply" (Audio cortito): NO pronuncies la calle, ni el barrio, ni la ciudad, y JAMÁS vuelvas a preguntar su teléfono. Decile con calidez a ${firstName}: "Mirá, acá abajo te voy a pasar en texto los datos de tu edificio, el piso, el departamento y el mapa que pusiste en el formulario para que se te entregue tu producto, miralo bien por favor y confirmame si está todo correcto".
     - El sistema adjuntará automáticamente en "locationTextConfirmation" el bloque descriptivo con el nombre del edificio, piso, departamento, recepción, calle y UN SOLO enlace directo de su mapa.
  2. Cuando pases al PASO 4 (Después de que el cliente confirmó los datos de su edificio del texto que le pasaste):
     - Ya NO envíes nada en texto ("locationTextConfirmation": "") y JAMÁS vuelvas a pedir confirmación de la calle ni del teléfono. Todo se dice ÚNICAMENTE EN VOZ.
     - En "reply" (Audio cortito): Decile en voz de forma superprofesional que la ubicación de su edificio, el piso y el departamento ya quedaron perfectamente confirmados en nuestro sistema informático, y como vive en un edificio, preguntale de forma congruente para dejar todo anotado para el repartidor: si la recepcionista o guardia de portería está autorizada a recibir el paquete o si prefiere que el repartidor lo llame al llegar a planta baja, y qué comercio o punto conocido hay al lado del edificio. (JAMÁS le preguntes de qué color es el techo o el portón de su casa porque vive en un EDIFICIO).
  3. Cuando pases al PASO 5 (Cierre de confirmación tras recibir la referencia de recepción/edificio + GANCHO VIP DE PAGO ADELANTADO CON 50.000 GS. DE DESCUENTO):
     - En "reply" (Audio persuasivo, educado y cálido): Agradecéle por su nombre (${firstName}), confirmále que todos los detalles de entrega en su edificio ya quedaron registrados en el sistema informático y su pedido ya está cien por ciento confirmado. Y ahí mismo hacéle esta propuesta exclusiva con mucha educación: "${firstName}, quiero preguntarte algo muy especial: estamos haciendo una promoción exclusiva y solamente las primeras cinco personas que abonan por adelantado su pedido participan de este beneficio donde te descontamos cincuenta mil guaraníes al instante. Es decir, en vez de pagar ${montoOriginalFormatted} al recibir, si decidís abonar ahora por transferencia bancaria te queda en solamente ${montoDescuentoFormatted}. ¿Te gustaría aprovechar uno de los cinco cupos con cincuenta mil guaraníes de descuento?". (IMPORTANTE: NO le pases el alias todavía en este paso, primero preguntale si quiere aprovechar la promo).
     - Dejá "locationTextConfirmation" vacío ("").`
    : `  1. Cuando pases al PASO 3 (Enviar por primera y ÚNICA vez el texto descriptivo de dirección y mapa):
     - En "reply" (Audio cortito): NO pronuncies la calle, ni el barrio, ni la ciudad, y JAMÁS vuelvas a preguntar su teléfono. Decile con calidez a ${firstName}: "Mirá, acá abajo te voy a pasar en texto las direcciones y el mapa que pusiste en el formulario para que se te entregue tu producto, miralo bien por favor y confirmame si está todo correcto".
     - El sistema adjuntará automáticamente en "locationTextConfirmation" el bloque descriptivo bien explicado con su ciudad, su calle/barrio y UN SOLO enlace directo de su mapa.
  2. Cuando pases al PASO 4 (Después de que el cliente confirmó esas direcciones del texto que le pasaste):
     - Ya NO envíes nada en texto ("locationTextConfirmation": "") y JAMÁS vuelvas a pedir confirmación de la calle ni del teléfono. Todo se dice ÚNICAMENTE EN VOZ.
     - En "reply" (Audio cortito): Decile en voz de forma superprofesional que sus ubicaciones fueron perfectamente confirmadas y ya están marcadas dentro de nuestro sistema informático para la entrega de su pedido, y para ir concretando el envío pedile que te cuente brevemente cómo es la fachada de su casa (color de pared o portón y algún comercio cercano de referencia).
  3. Cuando pases al PASO 5 (Cierre de confirmación tras recibir cómo es la fachada de su casa + GANCHO VIP DE PAGO ADELANTADO CON 50.000 GS. DE DESCUENTO):
     - En "reply" (Audio persuasivo, educado y cálido): Agradecéle por su nombre (${firstName}), confirmále que todos los detalles de su casa ya quedaron registrados en nuestro sistema informático para el repartidor y que su pedido ya está cien por ciento confirmado. Y ahí mismo hacéle esta propuesta exclusiva con mucha educación: "${firstName}, quiero preguntarte algo muy especial: estamos haciendo una promoción exclusiva y solamente las primeras cinco personas que abonan por adelantado su pedido participan de este beneficio donde te descontamos cincuenta mil guaraníes al instante. Es decir, en vez de pagar ${montoOriginalFormatted} al recibir, si decidís abonar ahora por transferencia bancaria te queda en solamente ${montoDescuentoFormatted}. ¿Te gustaría aprovechar uno de los cinco cupos con cincuenta mil guaraníes de descuento?". (IMPORTANTE: NO le pases el alias todavía en este paso, primero preguntale si quiere aprovechar la promo).
     - Dejá "locationTextConfirmation" vacío ("").`;

  return `Sos un agente humano real de confirmación de envíos de Noelux en Paraguay. Hablás español paraguayo natural, cálido, empático, educado y muy profesional/empresarial (usás "vos", "tenés", "podés", "decime").
NO sos un chatbot tradicional ni usás respuestas pregrabadas. Escuchás y contextualizás cada palabra que dice el cliente teniendo en cuenta TODA la conversación desde el principio.
Tu respuesta en el campo "reply" será convertida directamente a VOZ (Nota de Audio TTS), por lo que en "reply" NO debés usar emojis, ni asteriscos, ni markdown, ni enlaces URL, ni caracteres especiales.

REGLA CRÍTICA DE GÉNERO (RESPETO Y EDUCACIÓN ABSOLUTA):
- ${genderInfo.instruccionGenero}
- Jamás te equivoques diciéndole "señor" a una mujer ni "señora" a un hombre.

REGLA CRÍTICA DE PRONUNCIACIÓN DE NÚMEROS DE CELULAR EN PARAGUAY (SIEMPRE 4 - 3 - 3 Y DÍGITO POR DÍGITO, PROHIBIDO USAR CENTENAS O DECENAS):
- En Paraguay, TODOS los prefijos de las operadoras de celular tienen CUATRO (4) números al inicio (ej. Personal: 0971, 0972, 0973, 0975; Tigo: 0981, 0982, 0983, 0984; Claro: 0991, 0992; Vox: 0961), seguidos de una breve pausa, luego TRES (3) números y luego otros TRES (3) números.
- Ejemplo correcto escrito en dígitos: "0973 857 397" o "${phone}" (que nuestro motor de voz pronuncia número por número: "cero nueve siete tres, ocho cinco siete, tres nueve siete").
- ESTÁ TERMINANTEMENTE PROHIBIDO pronunciar o escribir los números con centenas o decenas (JAMÁS escribas "novecientos setenta y tres", "noventa y siete", "quinientos treinta y dos" ni "ochocientos cincuenta y siete") y PROHIBIDO agrupar 3 dígitos al inicio (JAMÁS digas "097"). Escribí el número siempre en formato 4 - 3 - 3 con dígitos (ej. ${phone}).

REGLA CRÍTICA DE CONGRUENCIA SEGÚN TIPO DE VIVIENDA (${isBuilding ? '🏢 EL CLIENTE VIVE EN UN EDIFICIO' : '🏠 EL CLIENTE VIVE EN UNA CASA INDEPENDIENTE'}):
${
  isBuilding
    ? `- ¡ATENCIÓN! El cliente indicó en el formulario que VIVE EN UN EDIFICIO (${buildingDetails || 'Edificio registrado en el formulario'}).
- Todas tus preguntas y confirmaciones deben ser 100% CONGRUENTES con un EDIFICIO: hablá de su edificio, su piso, su departamento o cuarto y si deja encargado en recepción/portería o baja a recibir personalmente. JAMÁS le preguntes de qué color es el portón o el techo de su casa.`
    : `- El cliente indicó que vive en una CASA INDEPENDIENTE. Tus preguntas deben ser congruentes con una casa normal (calle, barrio, color de pared o portón y referencia cercana).`
}

REGLA CRÍTICA E INQUEBRANTABLE SOBRE DIRECCIÓN Y MAPA (SE ENVÍA EN TEXTO UNA SOLA VEZ EN EL PASO 3, JAMÁS SE PRONUNCIA EN EL AUDIO):
- El motor de voz pronuncia mal los nombres propios de calles, barrios, ciudades y links de mapas.
- Por eso, en el campo "reply" (que es lo que se habla en el AUDIO), ESTÁ TERMINANTEMENTE PROHIBIDO escribir o pronunciar el nombre de la calle, el nombre del barrio, el nombre de la ciudad o enlaces web.
- La lista de direcciones y el enlace del mapa se envían en TEXTO UNA SOLA VEZ (en el PASO 3) y NUNCA se vuelven a repetir en el PASO 4 ni en el PASO 5:
${step3To5Instructions}

INFORMACIÓN DEL PRODUCTO (${shortProduct}):
${productKnowledge}

DATOS ACTUALES DEL PEDIDO REGISTRADO EN LA WEB:
- Cliente: ${rawName || 'No registrado'} (Primer nombre: ${firstName || 'Cliente'}, Género detectado: ${genderInfo.gender})
- Teléfono (formato paraguayo 4-3-3): ${phone || 'No registrado'}
- Tipo de Vivienda: ${isBuilding ? `🏢 EDIFICIO (${buildingDetails})` : '🏠 Casa Independiente'}
- Ciudad / Barrio registrado: ${city}${dept ? ', ' + dept : ''}
- Calle / Dirección registrada: ${address}
- Ubicación GPS Exacta en Mapa (para el Courier): ${gpsUrl ? `CONFIRMADA (${gpsUrl})` : 'No marcada aún'}
- Monto total a pagar al recibir: ${monto} (${pack} unidad/es)
- Referencia / Detalle de acceso actual: ${referenciaCasa || 'Todavía no proporcionada'}
- Estado del pedido: ${order?.estado || 'reservado'}

${globalReadinessInfo?.globalContextSummary || ''}

FLUJO INTELIGENTE DE CONFIRMACIÓN (5 PASOS) CON CONTEXTO GLOBAL:
Actualmente la conversación está en el PASO ${currentStep} (siguiente paso natural: PASO ${targetNextStep}):
- PASO 1 -> PASO 2: Si el cliente dice que sí tiene un minutito (o saluda / confirma), avanzá a "nextStep": 2 y confirmá que su nombre sea ${rawName || 'el registrado'} y su línea de contacto sea el ${phone} (siempre agrupado en 4 - 3 - 3).
- PASO 2 -> PASO 3: Si el cliente confirma su nombre y teléfono, avanzá a "nextStep": 3. En el audio ("reply") decile que acá abajo le pasás en texto ${isBuilding ? 'los datos de su edificio, piso, departamento y el mapa' : 'las direcciones y el mapa'} que puso en el formulario para que lo revise y te confirme si está todo correcto (sin pronunciar calle, barrio ni ciudad en el audio).
- PASO 3 -> PASO 4: Si el cliente confirma su dirección/mapa (o la corrige / envía ubicación GPS), avanzá a "nextStep": 4. En el audio ("reply") decile que sus ubicaciones fueron perfectamente confirmadas y ya quedaron marcadas en nuestro sistema informático, y preguntale ${isBuilding ? 'si en la recepción de su edificio ya quedan avisados para recibir el paquete o si prefiere bajar personalmente cuando llegue el repartidor, más algún local cercano al edificio' : 'cómo es la fachada de su casa (color de pared/portón y referencia cercana)'}.
- PASO 4 -> PASO 5 (CIERRE): Cuando el cliente responde esa referencia de ${isBuilding ? 'su edificio / recepción' : 'su casa / fachada / portón'}, avanzá OBLIGATORIAMENTE a "nextStep": 5, poné "orderConfirmed": true y guardá la descripción en "extractedHouseReference".

REGLAS DE INTELIGENCIA HUMANA PARA CASOS ESPECIALES EN MEDIO DE LA CONFIRMACIÓN:
1. SI EL CLIENTE ENVÍA SU UBICACIÓN GPS POR WHATSAPP O UN LINK DE GOOGLE MAPS EN CUALQUIER PASO:
   - Reconocé de inmediato que recibiste su ubicación GPS exacta y que ya quedó guardada en nuestro sistema informático para el courier.
   - Si todavía no tenés la referencia final (${isBuilding ? 'recepción/acceso al edificio' : 'fachada/portón de su casa'}), pasá a "nextStep": 4 y preguntásela. Si ya la tenías, pasá directo a "nextStep": 5 ("orderConfirmed": true) y cerrá la confirmación.
2. SI EL CLIENTE DICE QUE NO TIENE TIEMPO AHORA ("estoy trabajando", "estoy ocupado", "escribime más tarde", "ahora no puedo"):
   - Mantené "nextStep": ${currentStep} y "orderConfirmed": false.
   - NUNCA le digas "decime a qué hora te llamo" ni "avisame a qué hora te vuelvo a escribir", porque nosotros lo aguardamos en línea.
   - Respondé con total empatía, educación y tono empresarial llamándolo por su nombre (${firstName}): decile que comprendés perfectamente que esté en su trabajo o con sus actividades, pedile disculpas por la molestia, explicále que para nosotros es muy importante recibir esta información para dejar confirmado el envío de su producto, y pedile amablemente que te vuelva a escribir por acá mismo apenas tenga un tiempito libre para poder completar.
3. SI EL CLIENTE RESPONDE MUY CORTO, CORTADO, NO DICE CASI NADA O NO SE ENTIENDE LO QUE DIJO:
   - Mantené "nextStep": ${currentStep}, "congruent": false y "orderConfirmed": false.
   - Llamalo amablemente por su nombre (${firstName}) y decile con mucha calidez y educación (variando siempre la forma de expresarte para no sonar repetitivo): "${firstName}, ¿sabés qué? Disculpame pero no he entendido bien lo que me has dicho. ¿Será que es posible que me vuelvas a repetir un poquito más claro por favor?" recordándole suavemente qué dato estabas aguardando.
4. SI EL CLIENTE YA CONFIRMÓ VARIOS DATOS DE UNA SOLA VEZ:
   - Usá tu contexto global: NO vuelvas a preguntarle lo que ya te acaba de decir. Si ya están todos los datos listos, poné directamente "nextStep": 5 y "orderConfirmed": true.

FORMATO DE SALIDA OBLIGATORIO (llamá a la función emit_reply con estos campos):
{
  "reply": "Tu respuesta hablada natural y cálida (2 a 3 oraciones completas), SIN pronunciar el nombre de la calle, barrio, ciudad ni links, sin emojis ni asteriscos",
  "locationTextConfirmation": "",
  "nextStep": ${targetNextStep},
  "congruent": true,
  "orderConfirmed": ${targetNextStep === 5 ? 'true' : 'false'},
  "extractedHouseReference": "",
  "correctedName": "",
  "correctedCity": "",
  "correctedAddress": ""
}`;
}

// Build the system prompt for POST-CONFIRMATION messages (rich, empathetic, multi-angle conversational hospitality)
function buildPostConfirmationLLMSystemPrompt(
  order: any,
  productKnowledge: string,
  callPhoneSpeech: string,
  turnNumber: number,
  previousAiReplies: string[],
  isNaturalClosingTurn: boolean
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

  // Seleccionar un ángulo argumental diferente según el turno para que NUNCA repita la misma explicación ni suene a frase fija
  const angleIndex = ((turnNumber - 1) % 4) + 1;
  const currentAngleInstruction =
    angleIndex === 1
      ? `ÁNGULO CONVERSACIONAL DE ESTE TURNO (#1 - Precinto de Seguridad y Código de Barras en Depósito): Explicále con mucha calidez el porqué y para qué: en el mismo segundo en que confirmamos su ubicación, nuestro sistema informático imprimió la etiqueta con código de barras y el equipo de empaque selló su caja con precinto de seguridad en la cinta de salida; esto se hace justamente para proteger su equipo, evitar que nadie toque su caja y asegurar que suba hoy mismo a la camioneta del repartidor sin perder su lugar en la ruta.`
      : angleIndex === 2
        ? `ÁNGULO CONVERSACIONAL DE ESTE TURNO (#2 - Hoja de Ruta Cerrada y Auditoría del Repartidor): Explicále con total empatía el motivo real: una vez que el pedido pasa a despacho, el sistema bloquea la planilla acá en nuestra pantalla porque ya le asigna al chofer del courier la unidad exacta probada en taller y la boleta cerrada por ${monto}, justamente para que cuando el repartidor llegue a su ${isBuilding ? 'edificio' : 'casa'} no exista ninguna confusión de cobro ni de mercadería.`
        : angleIndex === 3
          ? `ÁNGULO CONVERSACIONAL DE ESTE TURNO (#3 - Separación de Permisos Informáticos por Seguridad del Comprador): Explicále con dulzura y detalle el porqué: por protocolo de calidad de la empresa, nuestra terminal de confirmación solo tiene permiso informático para verificar los datos de envío y darle prioridad de salida al paquete; apenas el paquete entra a la fila de despacho, el sistema bloquea las ediciones por chat para blindar la orden y garantizar que nadie altere por error los datos que usted ya aprobó.`
          : `ÁNGULO CONVERSACIONAL DE ESTE TURNO (#4 - Control de Calidad Individual en Mesa Técnica): Conversá con mucha simpatía explicándole que cada ${shortProduct} confirmado pasa de inmediato por una mesa de prueba técnica donde se revisa el equipo y se embala con protección especial a nombre de ${displayFirstName}, motivo por el cual la orden queda sellada en esta terminal de seguimiento.`;

  const closingGuidance = isNaturalClosingTurn
    ? `CIERRE CÁLIDO, CONVERSACIONAL Y CARIÑOSO (MÍNIMO 35 PALABRAS, 3 A 4 ORACIONES COMPLETAS):
- PROHIBIDO responder con 1, 2 o 3 palabras (jamás digas solo "De nada", "Gracias a vos" o "Dale chau").
- Respondé de forma amplia, cálida y empática a lo que te acaba de decir ${displayFirstName}, sin apurarte ni cortarle el rostro.
- Despedite con muchísimo cariño, agradeciéndole su buena onda y confianza, contándole que su paquete ya queda en manos de los chicos de reparto para llegar impecable a su ${isBuilding ? 'edificio' : 'casa'}, y dejándole con dulzura nuestro número directo ${callPhoneSpeech} por cualquier cosita que se le ofrezca.
- JAMÁS le digas que no le vas a responder más ni que vas a cerrar el chat.`
    : `CÓMO DEBÉS CONVERSAR SEGÚN LO QUE DIGA EL CLIENTE (PROHIBIDO RESPONDER CON 1, 2 O 3 PALABRAS — DEBÉS HABLAR ENTRE 3 Y 5 ORACIONES COMPLETAS, MÍNIMO 35 PALABRAS):

CASO 1 — SI EL CLIENTE COMENTA O PREGUNTA ALGO QUE NO ES CONGRUENTE CON EL PRODUCTO (otro tema, broma, charla casual o consulta ajena):
- PROHIBIDO responder con 2 o 3 palabras, PROHIBIDO decirle "eso no es el caso", PROHIBIDO decirle "eso no tiene que ver con el producto", y PROHIBIDO mandarlo a llamar a otro número solo porque habló de otro tema.
- NO le cierres la puerta en la cara ni lo cortes. Evadilo educadamente con mucha simpatía, respeto y ARGUMENTOS MUY POTENTES (en 3 a 5 oraciones fluidas):
  1. Primero seguile la corriente con calidez, empatía y buen humor sobre lo que acaba de mencionar, haciéndolo sentir escuchado y respetado.
  2. Luego, con argumentos sólidos y amables, contále que desde esta cabina de control operativo estamos conectados en vivo con los técnicos y empaquetadores que están probando y sellando las unidades que salen hoy a reparto, por lo que toda nuestra pantalla y nuestro trabajo en este sector están dedicados exclusivamente a cuidar que su ${shortProduct} salga verificado al cien por ciento y llegue perfecto hasta su ${isBuilding ? 'edificio' : 'casa'}.
  3. NO le tires el número de teléfono de golpe si no pidió hacer un cambio ni pidió un número; mantené una charla cálida, respetuosa y elegante.

CASO 2 — SI EL CLIENTE HACE UNA CONSULTA CONGRUENTE SOBRE EL PRODUCTO, EL USO, LA RESISTENCIA A LA LLUVIA, LOS 12 DISEÑOS, LA GARANTÍA O EL ENVÍO:
- PROHIBIDO responder corto (jamás 1, 2 o 3 palabras), y PROHIBIDO decirle de entrada "no podemos hacer, llamá a este número".
- Conversá con amplitud (de 3 a 5 oraciones ricas y fluidas, mínimo 35 palabras), explicándole con entusiasmo y detalle todo lo que preguntó sobre su ${shortProduct}, cómo se probó en depósito, cómo trabaja el courier para entregárselo en mano en su ${isBuilding ? 'edificio' : 'domicilio'} y que recién abona los ${monto} al recibirlo.

CASO 3 — SI EL CLIENTE PIDE MODIFICAR EL PEDIDO YA CONFIRMADO (agregar unidades, cambiar cantidad, cambiar dirección o anular) O PIDE EL NÚMERO DE SOPORTE:
- PROHIBIDO decirle secamente "no podemos hacer eso, llamá a este número" y PROHIBIDO usar una frase fija o repetida.
- Primero empatizá con ${displayFirstName} y explicále a fondo EL PORQUÉ, EL PARA QUÉ Y EL MOTIVO REAL por el cual el sistema ya no permite tocar la planilla desde este chat (en 3 a 5 oraciones completas), usando obligatoriamente este ángulo nuevo y fresco:
  ${currentAngleInstruction}
- Recién después de haberle explicado con todo cariño y detalle el porqué y el para qué, comentále con suavidad que si igualmente desea que desde administración central abran manualmente su orden antes de que salga el camión, puede pegarles un timbrazo rápido al ${callPhoneSpeech} (que también le queda anotado abajo) donde los encargados de central tienen la llave maestra del sistema para ayudarlo con todo gusto.`;

  return `Sos un operador humano real, sumamente conversacional, empático, culto y hospitalario del área de envíos de Noelux en Paraguay. Hablás español paraguayo natural, cálido y cercano (usás "vos", "tenés", "podés").
REGLA DE IDENTIDAD INQUEBRANTABLE: JAMÁS digas ni insinúes que sos una inteligencia artificial, un bot o un asistente virtual.
REGLA DE PRONUNCIACIÓN DE NÚMEROS DE CELULAR EN PARAGUAY (4 - 3 - 3 DÍGITO POR DÍGITO, NUNCA CENTENAS):
- Cuando menciones un número de celular en Paraguay, SIEMPRE escribí primero los 4 números del prefijo de la operadora, luego 3 y luego 3 en dígitos (ejemplo: "${callPhoneSpeech}"), para que el motor de voz lo lea número por número con una pausa después del prefijo ("cero nueve siete tres, cinco tres dos, cinco cinco cero"). JAMÁS pronuncies con centenas y JAMÁS agrupes 3 números al principio (nunca digas 097).
REGLA CRÍTICA DE EXTENSIÓN Y CALIDEZ (PROHIBIDO RESPONDER CON 1, 2 O 3 PALABRAS):
- El cliente YA COMPRÓ y confirmó su pedido. Tu misión es conversar con él/ella con tanta calidez, respeto y buenos argumentos que se sienta valorado y jamás piense en cancelar su compra.
- ESTÁ TERMINANTEMENTE PROHIBIDO responder con 1, 2 o 3 palabras o una sola frase corta. SIEMPRE debés explayarte con naturalidad en 3 a 5 oraciones completas y humanas (mínimo 35 palabras).
- Nunca uses frases fijas ni repitas explicaciones anteriores. Estas fueron tus respuestas previas (PROHIBIDO repetir sus mismas frases o estructura):
${prevRepliesText}
- Tu respuesta en el campo "reply" será convertida directamente a VOZ (Nota de Audio TTS), por lo que en "reply" NO debés usar emojis, ni asteriscos, ni markdown, ni caracteres especiales.

REGLA CRÍTICA DE GÉNERO (NUNCA EQUIVOCARSE ENTRE SEÑORA Y SEÑOR):
- ${genderInfo.instruccionGenero}
- Cliente: ${rawName || 'Cliente'} (Primer nombre: ${displayFirstName}, Trato: ${genderInfo.cortesia || genderInfo.estimado}).

INFORMACIÓN DEL PRODUCTO (${shortProduct}):
${productKnowledge}

DATOS DEL PEDIDO YA CONFIRMADO (INMUTABLE POR CHAT):
- Cantidad confirmada: ${pack} unidad(es) por un total de ${monto}
- Tipo de localidad confirmada: ${isBuilding ? `🏢 Edificio (${buildingDetails})` : '🏠 Casa Independiente'}
- Ubicación confirmada: ${address}, ${city}${dept ? ', ' + dept : ''} (Referencia: ${referenciaCasa})
- Número telefónico directo de central (formato 4-3-3, solo mencionarlo cuando pida cambios en la orden, pida teléfono o en la despedida final): ${callPhoneSpeech}

${closingGuidance}

FORMATO DE SALIDA OBLIGATORIO (llamá a emit_reply o respondé un objeto JSON válido con esta estructura):
{
  "reply": "Tu respuesta hablada amplia, muy conversacional, empática y con argumentos potentes (3 a 5 oraciones fluidas y variadas, mínimo 35 palabras), sin emojis ni asteriscos"
}`;
}

// Multi-angle conversational fallback for post-confirmation when LLM is unreachable or returns a short reply (< 22 words),
// ensuring rich, varied, non-repetitive explanations for congruent questions, non-congruent comments, and change requests.
function buildRichPostConfirmationFallback(
  order: any,
  cleanInput: string,
  turnNumber: number,
  callPhoneSpeech: string,
  isNaturalClosingTurn: boolean,
  clientAskedForPhoneOrChange: boolean
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

  if (isNaturalClosingTurn) {
    return `Muchísimas gracias a vos por tu excelente onda y por conversar conmigo, ${displayFirstName}. Ya mismo tu paquete de ${shortProduct} sigue su curso en la línea de despacho con todos los sellos de calidad para que el repartidor te lo entregue impecable en ${destinoLabel}, y por cualquier cosita que se te ofrezca te queda nuestro número directo ${callPhoneSpeech}. Que pases una jornada espectacular y disfrutes muchísimo tu compra.`;
  }

  const angle = ((turnNumber - 1) % 4) + 1;

  if (clientAskedForPhoneOrChange) {
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

  // Detect if customer is asking a congruent question about product features, rain resistance, shipping, or payment
  const isCongruentProductOrShippingQuestion =
    /\b(lluvia|agua|exterior|afuera|enchufa|enchufe|cable|instala|instalaci[oó]n|dise[ñn]o|tarjeta|slide|luz|luces|proyecta|distancia|metros|garant[ií]a|cu[aá]ndo\s+llega|hora|horario|repartidor|courier|env[ií]o|pago|pagar|efectivo|transferencia|qr|funciona|usar|uso|bater[ií]a|carga|material|medida|tama[ñn]o|incluye|trae|caja|precio|pack|unidades)\b/i.test(
      cleanInput
    );

  if (isCongruentProductOrShippingQuestion) {
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
      return `Qué excelente consulta me hacés, ${displayFirstName}, te explico con todo gusto para que te quedes cien por ciento tranquilo. Tu ${shortProduct} ya viene totalmente preparado para uso tanto en exterior como en interior, resiste perfectamente la lluvia y el sereno de la noche, y se conecta directo a la corriente normal sin ninguna complicación. Además, los técnicos acá en depósito ya revisaron tu unidad antes de sellar tu caja y el repartidor te la lleva hasta ${destinoLabel} con envío gratis para que abones recién al recibir los ${monto}.`;
    }
    if (angle === 2) {
      return `Me encanta que me preguntes eso, ${displayFirstName}, porque así aprovechás al máximo tu ${shortProduct} apenas te llegue a ${destinoLabel}. El equipo incluye sus doce diseños intercambiables de alta nitidez con movimiento automático y cubre toda la fachada o el ambiente con solo enchufarlo a unos metros de distancia. Quedate con total tranquilidad de que tu caja ya salió verificada de nuestra mesa técnica y el chofer te avisará al llegar para que revises todo con calma al momento de pagar los ${monto}.`;
    }
    if (angle === 3) {
      return `Te comento con todo detalle, ${displayFirstName}, para que tengas la seguridad completa sobre tu compra de ${shortProduct}. Cada equipo cuenta con carcasa sellada resistente a la intemperie, base para apoyar y estaca para jardín, y pasa por una prueba lumínica acá en logística antes de subir a la camioneta de reparto. Tu orden para ${destinoLabel} ya está confirmada con prioridad en la hoja de ruta y recordá que el envío es totalmente gratuito y abonás recién cuando el courier te entregue el paquete en mano.`;
    }
    return `Claro que sí, ${displayFirstName}, es un gusto enorme explicarte bien cada detalle de tu ${shortProduct}. Es superpráctico de instalar en menos de dos minutos, proyecta imágenes bien grandes y brillantes desde el primer encendido y tiene garantía real revisada por nuestro equipo técnico antes de salir. Tu paquete ya está debidamente precintado con todos los datos de ${destinoLabel} para que el repartidor te lo acerque sin demoras y abones los ${monto} cómodamente al recibir.`;
  }

  // Consulta o comentario no congruente (evasión educada con calidez y argumentos potentes SIN cerrarle la puerta ni mandarlo de golpe a otro número, ni jamás responder corto)
  if (angle === 1) {
    return `Qué interesante lo que me decís, ${displayFirstName}, la verdad es que da gusto conversar con clientes con tan buena onda como vos. Te cuento con todo cariño que desde esta terminal estamos conectados en vivo con la mesa técnica y de empaque donde están probando y sellando cada equipo que sale hoy a reparto, por eso acá concentramos el cien por ciento de nuestra atención en cuidar que tu ${shortProduct} salga verificado y llegue impecable hasta ${destinoLabel}.`;
  }
  if (angle === 2) {
    return `Te escucho con mucha atención, ${displayFirstName}, y te agradezco de corazón la confianza y la simpatía. Mirá, te comento que desde este puesto operativo nuestro sistema está dedicado exclusivamente a monitorear la ruta de los repartidores y el control de calidad de los paquetes confirmados, justamente para garantizarte que tu ${shortProduct} viaje seguro, bien protegido y lo recibas en ${destinoLabel} sin ningún contratiempo.`;
  }
  if (angle === 3) {
    return `Totalmente comprensible lo que me comentás, ${displayFirstName}, qué gusto charlar un ratito con vos mientras preparamos todo en depósito. En este sector de despacho trabajamos con las planillas de logística en tiempo real para que cada pedido salga probado de fábrica y con su embalaje reforzado, así que quedate con la tranquilidad absoluta de que tu ${shortProduct} ya tiene prioridad en la hoja de reparto hacia ${destinoLabel}.`;
  }
  return `Me encanta tu comentario, ${displayFirstName}, y te agradezco muchísimo la amabilidad y el buen humor. Como acá estamos justo en la cabina de coordinación logística supervisando la carga de los móviles de entrega, todo nuestro enfoque y nuestras herramientas están puestos en asegurar que tu ${shortProduct} llegue en tiempo y forma a ${destinoLabel} para que lo disfrutes muchísimo.`;
}

// Detect if a customer reply during confirmation (Steps 1..4) is too short, cut-off, empty audio, or incomprehensible
export function isUnclearOrTooShortCustomerReply(cleanInput: string, currentStep: number): boolean {
  const trimmed = String(cleanInput || '').trim();
  if (!trimmed) return true;
  if (/\[El cliente envi[oó] un audio que no se escuch[oó]|\[Nota de voz del cliente\]/i.test(trimmed)) {
    return true;
  }
  if (/👍|👌|✅|🙏/.test(trimmed) && currentStep < 4) {
    return false;
  }
  const alphaNum = trimmed.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '');
  if (!alphaNum) return true;
  if (/^(?:eh+|em+|mm+|hm+|ah+|oh+|uh+|q|qu[eé]|c[oó]mo|ha+|\?+|\.+|-+)$/i.test(trimmed)) {
    return true;
  }
  if (alphaNum.length === 1 && !/^[s12]$/i.test(alphaNum)) {
    return true;
  }
  // In Step 4, the customer needs to provide a house facade / gate color / reference (or building reception/reference), not just a 2-letter "ok"
  if (currentStep === 4 && /^(?:ok|dale|bueno|ya|hola|bien)$/i.test(trimmed)) {
    return true;
  }
  return false;
}

// Polite, non-repetitive clarification message calling the customer by their first name when their reply is short or unclear
export function buildPoliteUnclearReplyClarification(
  displayFirstName: string,
  currentStep: number,
  variationIndex = 0,
  isBuilding = false
): string {
  const nameToUse = displayFirstName && displayFirstName !== 'qué tal' ? displayFirstName : 'estimado cliente';
  let reminderContext = 'si disponés de un minutito ahora para verificar los datos de tu envío';
  if (currentStep === 2) {
    reminderContext = 'si tu nombre y este número de teléfono están correctamente registrados';
  } else if (currentStep === 3) {
    reminderContext = isBuilding
      ? 'si el nombre de tu edificio, el piso, el departamento y el mapa que te pasé acá arriba en el chat están todos correctos'
      : 'si la dirección y el mapa que te pasé acá arriba en el chat están todos correctos';
  } else if (currentStep === 4) {
    reminderContext = isBuilding
      ? 'si la recepcionista de tu edificio va a recibir el pedido o si bajás vos personalmente y qué comercio hay al lado del edificio'
      : 'cómo es la fachada de tu casa, el color de la pared o del portón y algún comercio cercano de referencia';
  }

  const variants = [
    `${nameToUse}, ¿sabés qué? Disculpame pero no he entendido bien lo que me has dicho recién. ¿Será que es posible que me vuelvas a repetir un poquito más claro por favor? Te consultaba ${reminderContext}.`,
    `Perdoname ${nameToUse}, ¿sabés qué? No alcancé a comprender bien tu mensaje porque llegó muy cortito. ¿Sería posible que me lo repitas de forma un poco más clara por favor? Así confirmamos ${reminderContext}.`,
    `${nameToUse}, te pido mil disculpas, te leo con mucha atención pero no logré entender bien lo que me quisiste decir. ¿Será posible que me vuelvas a escribir un poquito más detallado por favor? Necesitaba saber ${reminderContext}.`,
    `Disculpame la molestia ${nameToUse}, ¿sabés qué? No me quedó del todo claro lo que me comentaste recién. ¿Me podrías volver a repetir con un poquito más de claridad por favor? Quedamos atentos para saber ${reminderContext}.`
  ];
  const idx = Math.abs(variationIndex) % variants.length;
  return variants[idx];
}

// Robust Contingency Fallback when OpenRouter/Deepgram LLM is unavailable, returns 401/429, or times out.
// Guarantees the agent NEVER stays silent and guides the customer through all 5 confirmation steps.
function generateEmergencyFallbackStepReply(
  matchedOrder: any,
  currentStep: number,
  cleanInput: string,
  cleanPhone = ''
): {
  reply: string;
  locationTextConfirmation: string;
  nextStep: number;
  orderConfirmed: boolean;
  extractedHouseRef: string;
} {
  const rawName = String(matchedOrder?.nombre || '').trim();
  const firstName = getNaturalFirstName(rawName);
  const displayFirstName = firstName && firstName !== 'qué tal' ? firstName : '';
  const shortProduct = getNaturalProductName(matchedOrder?.producto);
  const speechPhone = formatPhoneForSpeech(matchedOrder?.celular || cleanPhone);
  const isBuilding = isBuildingOrderServer(matchedOrder);
  const buildingDetails = formatBuildingDetailsServer(matchedOrder);

  // If the customer replied with something too short, cut-off, or unclear during Steps 1..4, ask politely to repeat without advancing the step
  if (currentStep < 5 && isUnclearOrTooShortCustomerReply(cleanInput, currentStep)) {
    const prevCount = unclearReplyCounter.get(cleanPhone) || 0;
    unclearReplyCounter.set(cleanPhone, prevCount + 1);
    return {
      reply: buildPoliteUnclearReplyClarification(displayFirstName || 'cliente', currentStep, prevCount, isBuilding),
      locationTextConfirmation: '',
      nextStep: currentStep,
      orderConfirmed: false,
      extractedHouseRef: ''
    };
  }

  // PASO 1 -> PASO 2: Cliente dio disponibilidad ("sí", "tengo tiempo", etc.)
  if (currentStep <= 1) {
    return {
      reply: `Dale genial, gracias por tu tiempo. Te comento que registramos tu pedido de ${shortProduct} a nombre de ${displayFirstName || 'usted'} y con el número ${speechPhone}. ¿Estos datos están correctos?`,
      locationTextConfirmation: '',
      nextStep: 2,
      orderConfirmed: false,
      extractedHouseRef: ''
    };
  }

  // PASO 2 -> PASO 3: Cliente confirmó nombre y teléfono -> Se envía por ÚNICA vez el texto descriptivo de dirección/edificio y mapa
  if (currentStep === 2) {
    return {
      reply: isBuilding
        ? `Excelente${displayFirstName ? `, ${displayFirstName}` : ''}. Mirá, acá abajo te voy a pasar en texto los datos de tu edificio, el piso, el departamento y el mapa que pusiste en el formulario para que se te entregue tu producto. Miralo bien por favor y confirmame si está todo correcto.`
        : `Excelente${displayFirstName ? `, ${displayFirstName}` : ''}. Mirá, acá abajo te voy a pasar en texto las direcciones y el mapa que pusiste en el formulario para que se te entregue tu producto. Miralo bien por favor y confirmame si está todo correcto.`,
      locationTextConfirmation: buildLocationTextConfirmationMessage(matchedOrder, 3),
      nextStep: 3,
      orderConfirmed: false,
      extractedHouseRef: ''
    };
  }

  // PASO 3 -> PASO 4: Cliente confirmó las direcciones del texto -> Se confirma ÚNICAMENTE EN VOZ que ya está en el sistema informático (sin enviar texto en chat)
  if (currentStep === 3) {
    return {
      reply: isBuilding
        ? `Perfecto${displayFirstName ? `, ${displayFirstName}` : ''}, los datos de tu edificio, piso, departamento y el mapa fueron perfectamente confirmados y ya están marcados dentro de nuestro sistema informático. Para ir concretando tu envío a tu edificio, ¿me reconfirmás por favor si la recepcionista de portería está autorizada a recibir tu paquete o si preferís que el repartidor te avise al llegar a planta baja, y qué comercio conocido hay al lado del edificio?`
        : `Perfecto${displayFirstName ? `, ${displayFirstName}` : ''}, tus ubicaciones fueron perfectamente confirmadas y ya están marcadas dentro de nuestro sistema informático para la entrega de tu pedido. Para ir concretando tu envío, ¿me pasás por favor cómo es la fachada de tu casa, el color de la pared o del portón y algún comercio cercano de referencia?`,
      locationTextConfirmation: '',
      nextStep: 4,
      orderConfirmed: false,
      extractedHouseRef: ''
    };
  }

  // PASO 4 -> PASO 5: Cliente pasó datos de su casa/edificio -> Cierre + Gancho persuasivo VIP de Pago Adelantado (-50.000 Gs. para las primeras 5 personas, sin pasar el alias aún)
  if (currentStep === 4) {
    const houseRef = isBuilding
      ? [buildingDetails, cleanInput.length > 2 ? cleanInput : ''].filter(Boolean).join(' · ') || 'Edificio confirmado'
      : cleanInput.length > 2
        ? cleanInput
        : 'Casa particular';
    const rawMontoNum = Number(String(matchedOrder?.monto || '189000').replace(/\D/g, '')) || 189000;
    const discountedMontoNum = Math.max(50000, rawMontoNum - 50000);
    const montoOriginalFormatted = formatGsServer(rawMontoNum);
    const montoDescuentoFormatted = formatGsServer(discountedMontoNum);
    const nameVocative = displayFirstName || 'cliente';
    return {
      reply: isBuilding
        ? `Muchísimas gracias, ${nameVocative}. Ya anoté todos los detalles de entrega en tu edificio y recepción en nuestro sistema informático para el repartidor, y tu pedido ya queda cien por ciento confirmado. Antes de sellar tu boleta, ${nameVocative}, quiero preguntarte algo muy especial: ¿sabés que estamos haciendo una promoción exclusiva y solamente las primeras cinco personas que abonan por adelantado su pedido participan de este beneficio donde te descontamos cincuenta mil guaraníes al instante? Es decir, en vez de abonar ${montoOriginalFormatted} al recibir, si decidís abonar ahora por transferencia te queda en solamente ${montoDescuentoFormatted}. ¿Te gustaría aprovechar uno de los cinco cupos con cincuenta mil guaraníes de descuento?`
        : `Muchísimas gracias, ${nameVocative}. Ya anoté todos los detalles de tu casa en nuestro sistema informático para el repartidor, y tu pedido ya queda cien por ciento confirmado. Antes de sellar tu boleta, ${nameVocative}, quiero preguntarte algo muy especial: ¿sabés que estamos haciendo una promoción exclusiva y solamente las primeras cinco personas que abonan por adelantado su pedido participan de este beneficio donde te descontamos cincuenta mil guaraníes al instante? Es decir, en vez de abonar ${montoOriginalFormatted} al recibir, si decidís abonar ahora por transferencia te queda en solamente ${montoDescuentoFormatted}. ¿Te gustaría aprovechar uno de los cinco cupos con cincuenta mil guaraníes de descuento?`,
      locationTextConfirmation: '',
      nextStep: 5,
      orderConfirmed: true,
      extractedHouseRef: houseRef
    };
  }

  // PASO 5: Post-confirmación
  return {
    reply: buildRichPostConfirmationFallback(
      matchedOrder,
      cleanInput,
      1,
      speechPhone,
      false,
      false
    ),
    locationTextConfirmation: '',
    nextStep: 5,
    orderConfirmed: true,
    extractedHouseRef: matchedOrder?.referenciaCasa || ''
  };
}

// =========================================================================
// NEGOCIACIÓN VIP DE PAGO POR ADELANTADO (-50.000 GS. · PRIMERAS 5 PERSONAS)
// BANCO FAMILIAR · ALIAS PARAGUAY (SIPAP / CÉDULA): 3856033 (3.856.033)
// TITULAR: RICHARD ALMIRÓN
// =========================================================================
const VIP_PREPAYMENT_DISCOUNT_GS = 50000;
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
    `🏦 *DATOS OFICIALES PARA TRANSFERENCIA BANCARIA (PROMO EXCLUSIVA -50.000 Gs.)*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `🏛️ *Banco:* ${VIP_BANK_NAME}`,
    `🔑 *Alias (Cédula / SIPAP):* ${VIP_BANK_ALIAS_RAW}`,
    `*(También figura como: ${VIP_BANK_ALIAS_DOTTED})*`,
    `👤 *Titular de la cuenta:* ${VIP_BANK_HOLDER}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `💵 *Precio normal contra entrega:* ~${montoOriginalStr}~`,
    `🎁 *Descuento exclusivo aplicado:* -Gs. 50.000`,
    `✅ *MONTO EXACTO A TRANSFERIR AHORA:* *${montoDescuentoStr}*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 *Alias directo para copiar con un toque:*`,
    `${VIP_BANK_ALIAS_RAW}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📸 *PASO FINAL:* Apenas realices la transferencia de *${montoDescuentoStr}*, enviá por este chat la *captura de pantalla o comprobante del pago* para verificarlo y sellar tu pedido como *PAGADO*.`
  ].join('\n');
}

function handleVipPrepaymentNegotiationTurn(
  cleanPhone: string,
  matchedOrder: any,
  cleanInput: string,
  pedidos: any[]
): {
  handled: boolean;
  reply: string;
  locationTextConfirmation?: string;
  forceAudioReply?: boolean;
} {
  if (!matchedOrder) return { handled: false, reply: '' };

  const stage: string = matchedOrder.promoPagoAdelantadoStage || '';
  if (!stage || stage === 'declined_cod') {
    return { handled: false, reply: '' };
  }

  const rawName = String(matchedOrder?.nombre || '').trim();
  const firstName = getNaturalFirstName(rawName);
  const displayFirstName = firstName && firstName !== 'qué tal' ? firstName : 'cliente';
  const genderInfo = detectCustomerGender(rawName);
  const preparadaWord = genderInfo.gender === 'female' ? 'preparada' : 'preparado';

  const rawMontoNum =
    Number(String(matchedOrder?.montoOriginalSinDescuento || matchedOrder?.monto || '189000').replace(/\D/g, '')) || 189000;
  const discountedMontoNum = Math.max(50000, rawMontoNum - VIP_PREPAYMENT_DISCOUNT_GS);
  const montoOriginalStr = formatGsServer(rawMontoNum);
  const montoDescuentoStr = formatGsServer(discountedMontoNum);

  // Detectar si el cliente envió imagen/PDF de comprobante o afirma que ya transfirió
  const isReceiptImageOrDoc =
    /COMPROBANTE_PAGO_ADELANTADO|envi[oó] una foto|envi[oó] la imagen|captura|comprobante/i.test(cleanInput);
  const isVerbalPaymentDone =
    /\b(ya\s+transfer[ií]|ya\s+pagu[eé]|ya\s+envi[eé]|ya\s+deposit[eé]|ya\s+hice\s+la\s+transferencia|ya\s+te\s+mand[eé]\s+el\s+comprobante|te\s+paso\s+el\s+comprobante|ah[ií]\s+te\s+envi[eé]|ah[ií]\s+envi[eé]|listo\s+el\s+pago|ya\s+est[aá]\s+el\s+pago)\b/i.test(
      cleanInput
    );

  // STAGE D: El cliente envió el comprobante (foto/PDF o aviso de transferencia realizada) -> Responder SIEMPRE en AUDIO pidiendo aguardar un ratito mientras confirmamos el pago
  if (
    (stage === 'alias_sent_awaiting_receipt' || stage === 'awaiting_ready_for_alias' || stage === 'offered_hook') &&
    (isReceiptImageOrDoc || (stage === 'alias_sent_awaiting_receipt' && isVerbalPaymentDone))
  ) {
    matchedOrder.promoPagoAdelantadoStage = 'receipt_received_verifying';
    matchedOrder.pagoAdelantadoComprobanteRecibido = true;
    matchedOrder.pagoAdelantadoEstado = 'comprobante_recibido';
    matchedOrder.pagoAdelantadoFecha = new Date().toISOString();
    matchedOrder.modalidadPagoElegida = 'pago_adelantado_promo_50k';
    matchedOrder.montoOriginalSinDescuento = rawMontoNum;
    matchedOrder.montoConDescuentoAdelantado = discountedMontoNum;

    const audioReply = `Muchísimas gracias, ${displayFirstName}, acabo de recibir tu comprobante de pago por acá. Aguardame un ratito por favor mientras nuestro sector administrativo verifica e ingresa tu transferencia con los cincuenta mil guaraníes de descuento, y en unos momentos te avisamos apenas quede cien por ciento confirmado tu pago.`;
    matchedOrder.ultimoMensajeIA = audioReply;
    savePedidos(pedidos);
    syncOrderUpdateToCloud(matchedOrder).catch(() => {});
    notifySellerOfOrderEvent(matchedOrder, 'green').catch(() => {});

    return {
      handled: true,
      reply: audioReply,
      locationTextConfirmation: undefined,
      forceAudioReply: true
    };
  }

  // Si ya envió el comprobante y vuelve a escribir mientras se verifica:
  if (stage === 'receipt_received_verifying') {
    if (isReceiptImageOrDoc || isVerbalPaymentDone) {
      const audioReply = `Muchas gracias de nuevo, ${displayFirstName}, ya tenemos registrado tu comprobante en pantalla. Aguardame unos instantes por favor que ya mismo estamos validando la transferencia con administración central y te confirmamos enseguida.`;
      matchedOrder.ultimoMensajeIA = audioReply;
      savePedidos(pedidos);
      return {
        handled: true,
        reply: audioReply,
        locationTextConfirmation: undefined,
        forceAudioReply: true
      };
    }
    return { handled: false, reply: '' };
  }

  // Detectar si el cliente rechaza amablemente la promo y prefiere pagar al recibir (contra entrega)
  const isDecliningPromo =
    /\b(no\s+gracias|al\s+recibir|contra\s+entrega|cuando\s+llegue|en\s+efectivo|no\s+tengo\s+para\s+transferir|prefiero\s+pagar\s+al\s+recibir|despu[eé]s\s+nom[aá]s|al\s+entregar)\b/i.test(
      cleanInput
    ) || /^(?:no|nop|no\s+puedo\s+ahora)$/i.test(cleanInput.trim());

  if (isDecliningPromo && (stage === 'offered_hook' || stage === 'awaiting_ready_for_alias')) {
    matchedOrder.promoPagoAdelantadoStage = 'declined_cod';
    matchedOrder.modalidadPagoElegida = 'contra_entrega';
    const politeCodReply = `Dale, no te preocupes para nada, ${displayFirstName}, está superbién. Tu pedido queda cien por ciento confirmado con normalidad en modalidad de cobro contra entrega para que abones los ${montoOriginalStr} recién cuando el repartidor te entregue tu paquete en mano. Ya mismo pasa a despacho y muchas gracias por tu compra.`;
    matchedOrder.ultimoMensajeIA = politeCodReply;
    savePedidos(pedidos);
    syncOrderUpdateToCloud(matchedOrder).catch(() => {});
    return {
      handled: true,
      reply: politeCodReply,
      locationTextConfirmation: undefined
    };
  }

  // Detectar si el cliente acepta o pide el alias
  const isAffirmativeForPromo =
    /\b(s[ií]|claro|dale|quiero|me\s+interesa|depositar|transferir|transferencia|adelantado|descuento|promo|promoci[oó]n|aprovechar|bueno|ok|okay|listo|lista|preparad[oa]|pasame|p[aá]same|mandame|m[aá]ndame|enviame|env[ií]ame|alias|cuenta|banco|c[oó]mo\s+pago|d[oó]nde\s+trans|de\s+acuerdo|me\s+parece\s+bien|excelente|genial)\b/i.test(
      cleanInput
    ) || /👍|👌|✅/.test(cleanInput);

  // STAGE B: Estábamos en 'offered_hook' y el cliente dice "Sí, quiero depositar ahora" ->
  // REGLA DEL USUARIO: "No le vaya a pasar así al toque, que le felicite, que es una buena decisión y cuando estás de acuerdo y estás preparada para efectuar el pago me avisás y te paso el alias. ¿Qué te parece?"
  if (stage === 'offered_hook' && isAffirmativeForPromo) {
    matchedOrder.promoPagoAdelantadoStage = 'awaiting_ready_for_alias';
    matchedOrder.montoOriginalSinDescuento = rawMontoNum;
    matchedOrder.montoConDescuentoAdelantado = discountedMontoNum;

    const stageBReply = `Te felicito de corazón, ${displayFirstName}, es una excelente decisión porque te ahorrás cincuenta mil guaraníes al instante y ya te reservé uno de los cinco lugares exclusivos de la promoción, así que en vez de ${montoOriginalStr} vas a abonar solamente ${montoDescuentoStr}. Cuando estés de acuerdo y estés ${preparadaWord} para efectuar el pago ahora, avisame diciéndome pasame el alias y te paso enseguida los datos. ¿Qué te parece?`;
    matchedOrder.ultimoMensajeIA = stageBReply;
    savePedidos(pedidos);
    syncOrderUpdateToCloud(matchedOrder).catch(() => {});
    return {
      handled: true,
      reply: stageBReply,
      locationTextConfirmation: undefined
    };
  }

  // STAGE C: Estábamos en 'awaiting_ready_for_alias' y el cliente responde "Sí, pasame el alias" / "Estoy lista" ->
  // Ahora sí le pasamos el Alias del Banco Familiar (3856033 · Titular: Richard Almirón) bien diseñado + audio explicativo
  if (stage === 'awaiting_ready_for_alias' && isAffirmativeForPromo) {
    matchedOrder.promoPagoAdelantadoStage = 'alias_sent_awaiting_receipt';
    matchedOrder.montoOriginalSinDescuento = rawMontoNum;
    matchedOrder.montoConDescuentoAdelantado = discountedMontoNum;

    const stageCAudioReply = `Perfecto, ${displayFirstName}. Acá abajo te paso en texto los datos oficiales de nuestra cuenta del Banco Familiar con el alias tres ocho cinco seis cero tres tres a nombre de Richard Almirón, para que transfieras únicamente ${montoDescuentoStr} con tus cincuenta mil guaraníes de descuento ya aplicados. En cuanto envíes la transferencia, mandame por acá mismo la captura o el comprobante exacto del pago así te lo confirmamos enseguida.`;
    const aliasCardText = buildVipPrepaymentAliasCard(matchedOrder);
    matchedOrder.ultimoMensajeIA = stageCAudioReply;
    savePedidos(pedidos);
    syncOrderUpdateToCloud(matchedOrder).catch(() => {});
    return {
      handled: true,
      reply: stageCAudioReply,
      locationTextConfirmation: aliasCardText
    };
  }

  // Si ya se le envió el alias ('alias_sent_awaiting_receipt') y el cliente pregunta cómo es el alias o pide que se lo reenvíe:
  if (
    stage === 'alias_sent_awaiting_receipt' &&
    /\b(alias|cuenta|banco|titular|cu[aá]nto|monto|pasame|p[aá]same)\b/i.test(cleanInput)
  ) {
    const reminderReply = `Claro que sí, ${displayFirstName}, acá abajo te vuelvo a dejar la tarjeta con el alias tres ocho cinco seis cero tres tres del Banco Familiar a nombre de Richard Almirón por el monto con descuento de ${montoDescuentoStr}. Apenas tengas el comprobante mandame la captura por acá y te lo validamos al instante.`;
    const aliasCardText = buildVipPrepaymentAliasCard(matchedOrder);
    matchedOrder.ultimoMensajeIA = reminderReply;
    savePedidos(pedidos);
    return {
      handled: true,
      reply: reminderReply,
      locationTextConfirmation: aliasCardText
    };
  }

  return { handled: false, reply: '' };
}

// LLM-powered contextual AI reply — 100% driven by Deepgram Voice Agent LLM reasoning with automatic contingency fallback
export async function generateContextualAiReply(
  phone: string,
  incomingText: string
): Promise<{
  reply: string;
  locationTextConfirmation?: string;
  matchedOrder: any | null;
  convStep: number;
  error?: string;
  forceAudioReply?: boolean;
}> {
  const cleanPhone = normalizeWaPhone(phone);
  const pedidos = loadPedidos();
  const phoneOrders = pedidos.filter(p => {
    if (isOrderDeleted(p?.reservaid) || isOrderDeleted(p?.id)) return false;
    return normalizeWaPhone(p?.celular || p?.telefono || p?.phone || '') === cleanPhone;
  });
  const chatHistoryForOrder = getChatHistory(cleanPhone).messages;
  const lastChatOrderId = [...chatHistoryForOrder].reverse().find(m => m.orderId)?.orderId;
  const matchedOrder =
    (lastChatOrderId && (!phoneOrders[0] || phoneOrders[0].reservaid === lastChatOrderId)
      ? phoneOrders.find(p => p.reservaid === lastChatOrderId)
      : null) ||
    phoneOrders[0] ||
    null;

  if (!matchedOrder) {
    console.warn(`[Filtro Clientes] Se bloqueó generación de IA porque ${cleanPhone} no tiene un pedido activo registrado.`);
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
    apiWarning = '⚠️ AVISO SISTEMA: No hay API Key de Deepgram configurada. Se activó el protocolo de contingencia de 5 pasos para no dejar esperando al cliente.';
    console.warn('[AI Reply] ' + apiWarning);
  }

  // Build full conversation history from chat storage (up to 30 messages for complete context)
  const chatHistory = getChatHistory(cleanPhone).messages;
  const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const cleanInput = incomingText.replace(/^🎤\s*/, '').trim();

  // Extract any Google Maps link sent in text by the customer and save it directly onto matchedOrder
  const mapsUrlMatch = cleanInput.match(/https?:\/\/(?:www\.)?(?:google\.com\/maps\S+|maps\.app\.goo\.gl\/\S+|goo\.gl\/maps\/\S+)/i);
  if (mapsUrlMatch && matchedOrder) {
    matchedOrder.gpsLink = mapsUrlMatch[0];
    matchedOrder.gpsConfirmado = true;
  }

  const recentMsgs = chatHistory.slice(-30);
  for (let i = 0; i < recentMsgs.length; i++) {
    const msg = recentMsgs[i];
    const msgClean = String(msg.text || '').replace(/^🎤\s*/, '').trim();
    // Avoid duplicating the very last client message that is passed as userMessage
    if (i === recentMsgs.length - 1 && msg.sender === 'client' && msgClean === cleanInput) {
      continue;
    }
    if (msg.sender === 'client') {
      conversationHistory.push({ role: 'user', content: msgClean });
    } else if (msg.sender === 'ai' || (msg.sender === 'agent' && msg.status !== 'error')) {
      conversationHistory.push({ role: 'assistant', content: msg.text });
    }
  }

  // Compute global cross-chat context and readiness diagnostic across all messages & orders for this phone
  const globalReadiness = buildGlobalCustomerContextAndReadiness(
    cleanPhone,
    matchedOrder,
    phoneOrders,
    chatHistory,
    cleanInput
  );

  // =========================================================================
  // FLUJO POST-CONFIRMACIÓN AMABLE Y DULCE + NEGOCIACIÓN VIP PAGO ADELANTADO:
  // =========================================================================
  if (isAlreadyConfirmed) {
    // 1. Verificar primero si el cliente está interactuando con la promoción VIP de Pago Adelantado (-50.000 Gs. · Banco Familiar Alias 3856033)
    const vipNegotiationRes = handleVipPrepaymentNegotiationTurn(
      cleanPhone,
      matchedOrder,
      cleanInput,
      pedidos
    );
    if (vipNegotiationRes.handled) {
      return {
        reply: vipNegotiationRes.reply,
        locationTextConfirmation: vipNegotiationRes.locationTextConfirmation,
        matchedOrder,
        convStep: 5,
        ...(vipNegotiationRes.forceAudioReply ? { forceAudioReply: true } : {})
      } as any;
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

    // Detectar si es spam malintencionado evidente (texto gigante > 450 caracteres o caracteres repetidos sin sentido)
    const isObviousSpam =
      cleanInput.length > 450 || /(.)\1{9,}/.test(cleanInput);
    if (isObviousSpam && currentTurns >= 1) {
      storage.postConfirmBlocked[cleanPhone] = true;
      matchedOrder.postConfirmBlocked = true;
      saveChatsStorage(storage);
      savePedidos(pedidos);
      return { reply: '', matchedOrder, convStep: 5 };
    }

    const turnNumber = currentTurns + 1; // 1 .. 5
    const isClientSayingThanksGoodbye =
      turnNumber >= 2 &&
      /^(?:(?:dale|ok|okay|bueno|listo|genial|perfecto|gracias|muchas|muchisimas|muchísimas|mil|esta|est[aá]|bien|chau|adios|adiós|hasta|luego|bendiciones|super|s[uú]per|excelente)[\s!.,👍🙏❤️]*)+$/i.test(
        cleanInput
      );

    const isNaturalClosingTurn = turnNumber >= MAX_POST_CONFIRM_TURNS || isClientSayingThanksGoodbye;

    storage.postConfirmStrikes[cleanPhone] = turnNumber;
    matchedOrder.postConfirmStrikes = turnNumber;
    if (isNaturalClosingTurn) {
      storage.postConfirmBlocked[cleanPhone] = true;
      matchedOrder.postConfirmBlocked = true;
    }
    saveChatsStorage(storage);

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
      isNaturalClosingTurn
    );

    let rawPostOutput = '';
    if (deepgramKey) {
      try {
        // IMPORTANTE: pasar isPostConfirmMode = true para que emit_reply exija de 3 a 5 oraciones completas (mínimo 35 palabras) y jamás corte en 2-3 palabras
        rawPostOutput = await callDeepgramAgentLLM(
          postSystemPrompt,
          conversationHistory,
          cleanInput,
          true,
          true
        );
      } catch (e: any) {
        console.error('[Deepgram Agent Post-Confirm LLM Warning]:', e?.message || e);
      }
    }

    let postReply = '';
    if (rawPostOutput) {
      try {
        const cleanedJson = rawPostOutput
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();
        const parsed = JSON.parse(cleanedJson);
        postReply = String(parsed.reply || '').trim();
      } catch {
        postReply = rawPostOutput.trim();
      }
    }

    const clientAskedForPhoneOrChange =
      /\b(n[uú]mero|telefono|tel[eé]fono|soporte|llamar|llamo|contacto|agregar|aumentar|cambiar|modificar|cancelar|anular|otro|m[aá]s)\b/i.test(
        cleanInput
      );

    // BARRERA ESTRICTA ANTI-RESPUESTAS CORTAS: Si la respuesta tiene menos de 22 palabras (ej. 1, 2 o 3 palabras),
    // reemplazar obligatoriamente por la respuesta conversacional empática multi-ángulo de 3 a 5 oraciones
    const postReplyWords = postReply ? postReply.split(/\s+/).filter(Boolean).length : 0;
    if (!postReply || postReplyWords < 22) {
      postReply = buildRichPostConfirmationFallback(
        matchedOrder,
        cleanInput,
        turnNumber,
        callPhoneSpeech,
        isNaturalClosingTurn,
        clientAskedForPhoneOrChange
      );
    }

    postReply = normalizeParaguayanPhonesInText(postReply);

    // Solo adjuntar la tarjeta de teléfono cuando el cliente pida explícitamente un cambio / número de soporte
    // o en la despedida final, para no cerrarle la puerta de golpe cuando solo conversa o hace una consulta
    const shouldAttachContactCard =
      (clientAskedForPhoneOrChange && !matchedOrder.postConfirmCardSent) ||
      (isNaturalClosingTurn && !matchedOrder.postConfirmCardSent);

    let contactCardText: string | undefined = undefined;
    if (shouldAttachContactCard) {
      contactCardText = buildPostConfirmFinalContactCard(matchedOrder, rawCallPhone);
      matchedOrder.postConfirmCardSent = true;
    }

    // El pedido confirmado NO se modifica por chat (queda inmutable hasta que el dueño lo edite tras la llamada)
    matchedOrder.ultimoMensajeIA = postReply;
    savePedidos(pedidos);
    syncOrderUpdateToCloud(matchedOrder).catch(() => {});

    return {
      reply: postReply,
      locationTextConfirmation: contactCardText,
      matchedOrder,
      convStep: 5,
      error: apiWarning || undefined
    };
  }

  // =========================================================================
  // FLUJO DE CONFIRMACIÓN (PASOS 1 AL 5) — 100% INFRAESTRUCTURA DEEPGRAM AGENT
  // =========================================================================
  const isBuilding = isBuildingOrderServer(matchedOrder);
  const buildingDetails = formatBuildingDetailsServer(matchedOrder);

  // Si el cliente respondió algo muy cortito, cortado, vacío o incomprensible (ej. "?", "..", "eh", o audio ininteligible),
  // pedirle amablemente por su nombre que lo repita con más claridad sin avanzar de paso:
  if (isUnclearOrTooShortCustomerReply(cleanInput, currentStep)) {
    const rawName = String(matchedOrder?.nombre || '').trim();
    const firstName = getNaturalFirstName(rawName);
    const displayFirstName = firstName && firstName !== 'qué tal' ? firstName : 'cliente';
    const prevUnclear = unclearReplyCounter.get(cleanPhone) || 0;
    unclearReplyCounter.set(cleanPhone, prevUnclear + 1);
    const politeClarification = buildPoliteUnclearReplyClarification(
      displayFirstName,
      currentStep,
      prevUnclear,
      isBuilding
    );
    matchedOrder.atendidoPorIA = true;
    matchedOrder.ultimoMensajeIA = politeClarification;
    savePedidos(pedidos);
    return {
      reply: politeClarification,
      locationTextConfirmation: undefined,
      matchedOrder,
      convStep: currentStep,
      error: apiWarning || undefined
    };
  }

  const systemPrompt = buildLLMSystemPrompt(matchedOrder, contextoIA, currentStep, globalReadiness);

  let rawLlmOutput = '';
  if (deepgramKey) {
    try {
      rawLlmOutput = await callDeepgramAgentLLM(systemPrompt, conversationHistory, cleanInput, true, false);
    } catch (e: any) {
      console.warn('[Deepgram Agent LLM -> Contingencia de respaldo]:', e?.message || e);
    }
  }

  let llmReply = '';
  let locationTextConfirmation = '';
  let nextStep = currentStep;
  let orderConfirmed = false;
  let extractedHouseRef = '';
  let correctedName = '';
  let correctedCity = '';
  let correctedAddress = '';

  if (rawLlmOutput) {
    try {
      const cleanedJson = rawLlmOutput
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleanedJson);
      llmReply = String(parsed.reply || '').trim();
      locationTextConfirmation = String(parsed.locationTextConfirmation || '').trim();
      const parsedStep = Number(parsed.nextStep);
      if (!Number.isNaN(parsedStep) && parsedStep >= 1 && parsedStep <= 5) {
        nextStep = parsedStep;
      }
      orderConfirmed = Boolean(parsed.orderConfirmed) || nextStep === 5;
      extractedHouseRef = String(parsed.extractedHouseReference || '').trim();
      correctedName = String(parsed.correctedName || '').trim();
      correctedCity = String(parsed.correctedCity || '').trim();
      correctedAddress = String(parsed.correctedAddress || '').trim();

      // Si estábamos en el Paso 4 y el cliente acaba de dar la referencia de su casa o edificio (congruent=true o extrajo referencia),
      // garantizar que pase al Paso 5 de cierre y empaquetado:
      if (currentStep === 4 && (Boolean(extractedHouseRef) || (Boolean(parsed.congruent) && cleanInput.length > 2))) {
        nextStep = 5;
        orderConfirmed = true;
        if (!extractedHouseRef) {
          extractedHouseRef = isBuilding
            ? [buildingDetails, cleanInput].filter(Boolean).join(' · ')
            : cleanInput;
        }
        if (/c[oó]mo es tu casa|pasame por favor c[oó]mo es/i.test(llmReply)) {
          llmReply = isBuilding
            ? 'Perfecto, ya recibí y anoté todos los detalles de tu edificio y recepción en nuestro sistema informático para el repartidor, y tu pedido ya queda cien por ciento confirmado y pasa a empaquetado. Muchas gracias.'
            : 'Perfecto, ya recibí y anoté todos los detalles de tu casa en nuestro sistema informático para el repartidor, y tu pedido ya queda cien por ciento confirmado y pasa a empaquetado. Muchas gracias.';
        }
      }
    } catch {
      llmReply = rawLlmOutput.trim();
    }
  }

  // Asegurar que la dirección no tenga URLs incrustadas y que si tiene mapa, tenga su enlace recortado listo
  if (matchedOrder) {
    if (matchedOrder.direccion && /\[GPS:|google\.com\/maps|maps\.google\.com/i.test(String(matchedOrder.direccion))) {
      if (!matchedOrder.gpsLink) {
        matchedOrder.gpsLink = extractCanonicalMapUrlFromOrder(matchedOrder);
      }
      matchedOrder.direccion = cleanStreetAddressText(matchedOrder.direccion);
    }
    if (nextStep === 3 || currentStep === 2) {
      await ensureShortMapLinkForOrder(matchedOrder);
    }
  }

  // Si el LLM de Deepgram tardó o devolvió vacío, activar el protocolo de contingencia de 5 pasos sin interrumpir el flujo:
  if (!llmReply) {
    const fallback = generateEmergencyFallbackStepReply(matchedOrder, currentStep, cleanInput, cleanPhone);
    llmReply = fallback.reply;
    locationTextConfirmation = fallback.locationTextConfirmation;
    nextStep = fallback.nextStep;
    orderConfirmed = fallback.orderConfirmed;
    extractedHouseRef = fallback.extractedHouseRef;
  }

  // =========================================================================
  // BARRERA DETERMINÍSTICA ANTI-REPETICIÓN Y AVANCE MONOTÓNICO DE PASOS (1->2->3->4->5)
  // Evita al 100% que el agente pregunte 2 o 3 veces el teléfono o mande 2 veces la calle.
  // =========================================================================
  const isClientAskingToWait =
    /\b(estoy\s+trabajando|estoy\s+ocupad[oa]|escribime\s+m[aá]s\s+tarde|ahora\s+no\s+puedo|despu[eé]s\s+te\s+escribo|en\s+el\s+trabajo|manejando)\b/i.test(
      cleanInput
    );

  if (!isClientAskingToWait && currentStep < 5) {
    // Garantizar que el paso SIEMPRE avance hacia adelante cuando el cliente responde válidamente
    if (nextStep <= currentStep) {
      nextStep = Math.min(5, currentStep + 1);
    }
    // Si la tarjeta de calle/mapa (Paso 3) YA se envió antes en esta orden y el cliente no está editando su dirección,
    // prohibido quedarse en el Paso 3 o volver al Paso 3: avanzar directamente al Paso 4 (o 5 si ya estaba en 4)
    const addressWasEditedNow = Boolean(correctedCity) || Boolean(correctedAddress);
    if (nextStep === 3 && matchedOrder?.locationTextSentOnce && !addressWasEditedNow && currentStep >= 3) {
      nextStep = 4;
    }
    if (nextStep === 5) {
      orderConfirmed = true;
    }

    // Sanitizar llmReply si el LLM alucinó una pregunta de un paso anterior ya superado:
    const stepFallback = generateEmergencyFallbackStepReply(matchedOrder, currentStep, cleanInput, cleanPhone);

    if (nextStep === 3) {
      // En el Paso 3 el teléfono YA fue confirmado. Si el LLM vuelve a preguntar si el número de teléfono está bien, reemplazar por el audio limpio del Paso 3:
      const repeatsPhoneQuestion =
        /\b(n[uú]mero\s+de\s+tel[eé]fono|l[ií]nea\s+de\s+contacto|estos\s+datos\s+est[aá]n\s+correctos|tu\s+n[uú]mero\s+es)\b/i.test(
          llmReply
        );
      if (repeatsPhoneQuestion) {
        llmReply = stepFallback.reply;
      }
    } else if (nextStep === 4) {
      // En el Paso 4 ni el teléfono ni el texto de calle se deben volver a pedir. Se debe preguntar fachada/portón (o recepción de edificio):
      const repeatsPhoneOrStreetText =
        /\b(n[uú]mero\s+de\s+tel[eé]fono|ac[aá]\s+abajo\s+te\s+voy\s+a\s+pasar\s+en\s+texto|te\s+paso\s+en\s+texto\s+las\s+direcciones|estos\s+datos\s+est[aá]n\s+correctos)\b/i.test(
          llmReply
        );
      if (repeatsPhoneOrStreetText) {
        llmReply = stepFallback.reply;
      }
    } else if (nextStep === 5) {
      // En el Paso 5 (cierre de confirmación), asegurarnos de que SIEMPRE incluya la propuesta educativa VIP de -50.000 Gs. de descuento por pago adelantado (para las primeras 5 personas) sin enviar el alias todavía:
      if (!/cincuenta\s+mil|50\.?000|promoci[oó]n|adelantado/i.test(llmReply)) {
        llmReply = stepFallback.reply;
      }
    }
  }

  llmReply = normalizeParaguayanPhonesInText(llmReply);

  if (matchedOrder) {
    if (correctedName) matchedOrder.nombre = correctedName;
    if (correctedCity) matchedOrder.ciudad = correctedCity;
    if (correctedAddress) matchedOrder.direccion = cleanStreetAddressText(correctedAddress);
    if (extractedHouseRef) matchedOrder.referenciaCasa = extractedHouseRef;

    const addressWasEdited = Boolean(correctedCity) || Boolean(correctedAddress);

    // REGLA ESTRICTA DE CONFIRMACIÓN DE UBICACIÓN EN TEXTO (UNA SOLA VEZ):
    // - ÚNICAMENTE en el PASO 3 y SOLO UNA VEZ (cuando !matchedOrder.locationTextSentOnce o si corrigió la calle) se envía el texto con Ciudad, Calle/Barrio y mapa.
    if (nextStep === 3) {
      if (!matchedOrder.locationTextSentOnce || addressWasEdited) {
        await ensureShortMapLinkForOrder(matchedOrder);
        locationTextConfirmation = buildLocationTextConfirmationMessage(matchedOrder, 3);
        matchedOrder.locationTextSentOnce = true;
      } else {
        locationTextConfirmation = '';
      }
    } else {
      locationTextConfirmation = '';
    }

    if (orderConfirmed || nextStep === 5) {
      nextStep = 5;
      cancelCustomerInactivityFollowUp(cleanPhone);
      const rawRef =
        extractedHouseRef ||
        matchedOrder.referenciaCasa ||
        globalReadiness.detectedHouseRefFromChat ||
        cleanInput;
      const finalRef =
        isBuilding && buildingDetails && !String(rawRef).includes(buildingDetails)
          ? `${buildingDetails}${rawRef ? ` · ${rawRef}` : ''}`
          : rawRef;
      matchedOrder.referenciaCasa = finalRef;
      matchedOrder.datosConfirmados = true;
      matchedOrder.empaquetado = true;
      matchedOrder.agenteCompletado = true;
      matchedOrder.estado = 'en_camino';
      matchedOrder.estadoEnvioProducto = matchedOrder.estadoEnvioProducto || 'no_enviado';
      matchedOrder.concretadoCobrado = Boolean(matchedOrder.concretadoCobrado);

      // Activar Etapa A ('offered_hook') de la negociación VIP de Pago Adelantado (-50.000 Gs.) al cerrar la confirmación:
      if (!matchedOrder.promoPagoAdelantadoStage) {
        const rawMontoNum = Number(String(matchedOrder?.monto || '189000').replace(/\D/g, '')) || 189000;
        matchedOrder.promoPagoAdelantadoStage = 'offered_hook';
        matchedOrder.montoOriginalSinDescuento = rawMontoNum;
        matchedOrder.montoConDescuentoAdelantado = Math.max(50000, rawMontoNum - VIP_PREPAYMENT_DISCOUNT_GS);
      }

      const finalGpsUrl = extractCanonicalMapUrlFromOrder(matchedOrder) || undefined;
      const cleanAddr = cleanStreetAddressText(matchedOrder.direccion || '');
      matchedOrder.direccion = cleanAddr;

      const ubicacionStr = `${matchedOrder.ciudad || ''}, ${matchedOrder.departamento || ''}`.replace(/^,\s*|,\s*$/g, '');
      const resumenTexto = `El Agente IA completó la confirmación con ${matchedOrder.nombre} (${cleanPhone}). Entrega confirmada en ${isBuilding ? 'EDIFICIO' : 'CASA'} en ${ubicacionStr}, dirección "${cleanAddr}"${buildingDetails ? ` (${buildingDetails})` : ''}${finalGpsUrl ? ` (GPS exacto: ${finalGpsUrl})` : ''} y referencia "${finalRef}".`;
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
        packConfirmado: `${matchedOrder.cantidad || 1} un. · ${formatGsServer(matchedOrder.monto)}`,
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

      // Avisar en tiempo real al WhatsApp del Vendedor (en VERDE 🟢) que el pedido ya fue confirmado
      notifySellerOfOrderEvent(matchedOrder, 'green').catch(() => { });
    }

    setOrderConvStep(cleanPhone, matchedOrder, nextStep);
    matchedOrder.convStep = nextStep;
    matchedOrder.atendidoPorIA = true;
    matchedOrder.ultimoMensajeIA = llmReply;
    savePedidos(pedidos);
    syncOrderUpdateToCloud(matchedOrder).catch(() => {});
  } else {
    setOrderConvStep(cleanPhone, null, nextStep);
  }

  return {
    reply: llmReply,
    locationTextConfirmation: locationTextConfirmation || undefined,
    matchedOrder,
    convStep: nextStep,
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
            const jid = `${phone}@s.whatsapp.net`;
            if (msg.isVoiceCall || msg.isAudioNote) {
              try {
                const tts = await synthesizeSpeechSelfHosted(msg.text);
                if (tts.audioBuffer && session.sock) {
                  const sentAudio = await session.sock.sendMessage(jid, {
                    audio: tts.audioBuffer,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true,
                    seconds: tts.durationSeconds,
                    waveform: tts.waveform
                  });
                  if (sentAudio?.key?.id) {
                    recentlySentMsgIds.add(sentAudio.key.id);
                    setTimeout(() => recentlySentMsgIds.delete(sentAudio.key.id!), 30000);
                  }
                }
              } catch (e) { }
            }
            if (!msg.isAudioNote) {
              const sent = await session.sock.sendMessage(jid, { text: msg.text });
              if (sent?.key?.id) {
                recentlySentMsgIds.add(sent.key.id);
                setTimeout(() => recentlySentMsgIds.delete(sent.key.id!), 30000);
              }
            }
            msg.status = 'sent';
            msg.sessionId = session.id;
            changed = true;
          } catch (e) { }
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
// PERSISTENCIA PERMANENTE DE SESIÓN BAILEYS EN SUPABASE (WAAUTH-*)
// Evita que Railway desconecte el WhatsApp al redesplegar un nuevo contenedor
// ============================================================================

const authBackupTimers = new Map<string, NodeJS.Timeout>();
let bootRestorePromise: Promise<void> | null = null;
let skipDevAutoConnectBecauseProdActive = false;

function isProductionRuntime(): boolean {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID ||
    process.env.RAILWAY_STATIC_URL
  );
}

// Escanea y limpia archivos corruptos de 0 bytes o JSON inválido en el directorio de autenticación
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
          const content = fs.readFileSync(fullPath, 'utf-8');
          try {
            JSON.parse(content);
          } catch {
            fs.unlinkSync(fullPath);
            cleanedCount++;
          }
        }
      } catch (e) { }
    }
  } catch (e) { }
  return { cleanedCount };
}

export async function backupWaSessionAuthToCloud(
  session: WaSessionRuntime,
  loggedOut = false
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  // Solo la instancia de Producción (Railway) debe respaldar las credenciales activas de WhatsApp
  if (!isProductionRuntime() && !loggedOut) return;

  try {
    if (loggedOut) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/codigos?code=like.WAAUTH-${encodeURIComponent(session.id)}-*`,
        {
          method: 'DELETE',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        }
      ).catch(() => { });

      await fetch(`${SUPABASE_URL}/rest/v1/codigos`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: `WAAUTH-${session.id}-${Date.now()}`,
          dispositivo: JSON.stringify({
            sessionId: session.id,
            label: session.label,
            loggedOut: true,
            updatedAt: new Date().toISOString()
          })
        })
      }).catch(() => { });
      return;
    }

    if (!fs.existsSync(session.authDir)) return;
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

    // Solo respaldar en la nube cuando la sesión está genuinamente vinculada a un número (tiene me.id)
    if (!parsedCreds?.me?.id) return;

    const allFiles = fs.readdirSync(session.authDir).filter(f => f.endsWith('.json'));
    const preKeyFiles = allFiles
      .filter(f => f.startsWith('pre-key-'))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D+/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/\D+/g, ''), 10) || 0;
        return numB - numA;
      })
      .slice(0, 35);
    const keepPreKeys = new Set(preKeyFiles);

    const filesMap: Record<string, string> = {};
    for (const fileName of allFiles) {
      if (fileName.startsWith('pre-key-') && !keepPreKeys.has(fileName)) continue;
      try {
        const fullPath = path.join(session.authDir, fileName);
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && stat.size >= 2 && stat.size < 250000) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          // Validar que sea JSON parseable y no esté en blanco
          JSON.parse(content);
          filesMap[fileName] = content;
        }
      } catch (e) { }
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
      filesGzBase64: compressedBase64,
      updatedAt: new Date().toISOString()
    };

    const resPost = await fetch(`${SUPABASE_URL}/rest/v1/codigos`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: newCode,
        dispositivo: JSON.stringify(payload)
      })
    });

    if (resPost.ok) {
      // Limpiar respaldos antiguos de esta misma sesión para mantener liviana la tabla codigos
      await fetch(
        `${SUPABASE_URL}/rest/v1/codigos?code=like.WAAUTH-${encodeURIComponent(session.id)}-*&code=neq.${encodeURIComponent(newCode)}`,
        {
          method: 'DELETE',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        }
      ).catch(() => { });
    }
  } catch (e) { }
}

function scheduleWaSessionAuthBackup(session: WaSessionRuntime, delayMs = 60000) {
  const existing = authBackupTimers.get(session.id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    authBackupTimers.delete(session.id);
    backupWaSessionAuthToCloud(session, false).catch(() => { });
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
      const preKeyFiles = allFiles
        .filter(f => f.startsWith('pre-key-'))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/\D+/g, ''), 10) || 0;
          const numB = parseInt(b.replace(/\D+/g, ''), 10) || 0;
          return numB - numA;
        })
        .slice(0, 35);
      const keepPreKeys = new Set(preKeyFiles);

      const filesMap: Record<string, string> = {};
      for (const fileName of allFiles) {
        if (fileName.startsWith('pre-key-') && !keepPreKeys.has(fileName)) continue;
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
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  // 0. Restaurar historial de chats y pasos de conversación (WAENG-*) desde Supabase antes de cargar pedidos,
  // para que un reinicio de contenedor en Railway jamás borre el Paso actual (convStep) de los pedidos en curso
  try {
    const resEng = await fetch(
      `${SUPABASE_URL}/rest/v1/codigos?select=code,dispositivo,creado&code=like.WAENG-*&order=creado.desc&limit=3`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      }
    );
    if (resEng.ok) {
      const engRows = await resEng.json();
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
    }
  } catch (e) { }

  // 1. Restaurar voz permanente (WAVOICE-* y CFG-*) y pedidos antes de conectar
  try {
    await pollCloudCommandsAndOrders();
  } catch (e) { }

  // 2. AISLAMIENTO TOTAL DEV vs PRODUCCIÓN:
  // Si NO estamos en Producción (Railway), NO restaurar credenciales de WhatsApp ni conectar Baileys.
  // Esto garantiza al 100% que el entorno de desarrollo jamás interferirá con el WhatsApp de Railway.
  if (!isProductionRuntime()) {
    skipDevAutoConnectBecauseProdActive = true;
    console.log(
      '[WhatsApp Cloud Guard] Entorno de Desarrollo (no Railway): Baileys no se conectará automáticamente para no interferir con Producción.'
    );
    return;
  }

  // 3. Restaurar credenciales Baileys (WAAUTH-*) desde Supabase al disco local si el contenedor se acaba de desplegar
  try {
    const resAuth = await fetch(
      `${SUPABASE_URL}/rest/v1/codigos?select=code,dispositivo,creado&code=like.WAAUTH-*&order=creado.desc&limit=15`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      }
    );
    if (!resAuth.ok) return;
    const authRows = await resAuth.json();
    if (!Array.isArray(authRows) || authRows.length === 0) return;

    const handledSessions = new Set<string>();
    for (const row of authRows) {
      if (!row?.dispositivo) continue;
      try {
        const data = JSON.parse(row.dispositivo);
        const sessionId = String(data?.sessionId || 'wa-1');
        if (handledSessions.has(sessionId)) continue;
        handledSessions.add(sessionId);

        if (data?.loggedOut) continue;
        if (!data?.filesGzBase64) continue;

        const session = getOrCreateSessionRuntime(sessionId, data.label, data.createdAt);
        const localCredsPath = path.join(session.authDir, 'creds.json');
        let hasValidLocalCreds = false;
        if (fs.existsSync(localCredsPath)) {
          try {
            const localCreds = JSON.parse(fs.readFileSync(localCredsPath, 'utf-8') || '{}');
            if (localCreds?.me?.id) {
              hasValidLocalCreds = true;
            }
          } catch (e) { }
        }

        if (!hasValidLocalCreds) {
          const decompressed = zlib
            .gunzipSync(Buffer.from(data.filesGzBase64, 'base64'))
            .toString('utf-8');
          const filesMap = JSON.parse(decompressed || '{}');
          if (filesMap && typeof filesMap === 'object' && filesMap['creds.json']) {
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
                } catch { }
              }
            }
            sanitizeAuthDirectory(session.authDir);
            if (data.connectedPhone) session.connectedPhone = String(data.connectedPhone);
            if (data.connectedName) session.connectedName = String(data.connectedName);
            console.log(
              `[WhatsApp Cloud Restore] Sesión ${sessionId} (+${session.connectedPhone || ''}) restaurada exitosamente desde Supabase.`
            );
          }
        }
      } catch (e) { }
    }
    const storage = loadChatsStorage();
    saveChatsStorage(storage);
  } catch (e) { }
}

function ensureBootCloudRestoreCompleted(): Promise<void> {
  if (!bootRestorePromise) {
    bootRestorePromise = restoreCloudStateAndWaSessionsOnBoot().catch(() => { });
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
export async function removeWhatsAppSession(sessionId: string): Promise<boolean> {
  ensureInitialSessionsLoaded();
  const session = sessionsMap.get(sessionId);
  if (!session) return false;

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
  if ((globalThis as any).__noeluxEngineGen !== myEngineGen) {
    return getWhatsAppEngineState();
  }
  if (!forceNewQr) {
    await ensureBootCloudRestoreCompleted();
    if (skipDevAutoConnectBecauseProdActive && !isProductionRuntime()) {
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
      await stopSessionSocket(session, true);
      session.status = 'connecting';
      session.qrDataUrl = null;
      session.pairingCode = null;
      session.connectedPhone = null;
      session.connectedName = null;
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

    if ((globalThis as any).__noeluxEngineGen !== myEngineGen || mySeq !== session.socketSeq) {
      session.isConnecting = false;
      return getWhatsAppEngineState();
    }

    const newSock = makeWASocket({
      version,
      logger: silentLogger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, silentLogger)
      },
      browser: Browsers.macOS('Chrome'),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    });

    session.sock = newSock;
    session.creds = state.creds;
    if (state.creds?.me?.lid) {
      session.connectedLid = state.creds.me.lid;
    }
    session.isConnecting = false;

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
        if (session.status === 'connected' || Boolean(newSock.user?.id || state.creds?.me?.id)) {
          // Throttle auth backup so it does not hammer the event loop on rapid message exchanges
          scheduleWaSessionAuthBackup(session, 120000);
        }
      } catch (e) { }
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

        if (phonePart && rawLid) {
          const cleanP = normalizeWaPhone(phonePart);
          const lidDigits = rawLid.split('@')[0].split(':')[0].replace(/\D/g, '');
          if (cleanP && lidDigits) {
            lidToPhoneCache.set(lidDigits, cleanP);
            phoneToLidCache.set(cleanP, lidDigits);
          }
        }

        scheduleCloudStateSync(true);
        // Respaldar inmediatamente en Supabase las credenciales vinculadas para sobrevivir cualquier redeploy de Railway
        scheduleWaSessionAuthBackup(session, 1200);

        setTimeout(() => {
          flushPendingMessages(session).catch(() => { });
        }, 800);
      }

      if (connection === 'close') {
        if ((globalThis as any).__noeluxEngineGen !== myEngineGen) return;
        if (mySeq !== session.socketSeq || session.sock !== newSock) return;

        const statusCode =
          (lastDisconnect?.error as any)?.output?.statusCode ||
          (lastDisconnect?.error as any)?.data?.statusCode;

        session.sock = null;
        session.isConnecting = false;

        try {
          await session.lastSaveCredsPromise;
        } catch (e) { }

        if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
          session.status = 'syncing';
          session.qrDataUrl = null;
          scheduleCloudStateSync(true);
          setTimeout(() => {
            if ((globalThis as any).__noeluxEngineGen !== myEngineGen) return;
            connectWhatsAppEngine(false, session.id).catch(() => { });
          }, 150);
          return;
        }

        // IMPORTANTE: Solo considerar desvinculado cuando el usuario cerró sesión desde su celular (401 / 403 / loggedOut).
        // NO borrar authDir en badSession (500) o 440 para jamás perder la vinculación durante un redespliegue en Railway.
        const isLoggedOut =
          statusCode === DisconnectReason.loggedOut ||
          statusCode === 401 ||
          statusCode === 403;

        if (isLoggedOut) {
          try {
            if (fs.existsSync(session.authDir)) {
              fs.rmSync(session.authDir, { recursive: true, force: true });
            }
          } catch (e) { }
          backupWaSessionAuthToCloud(session, true).catch(() => { });
          session.status = 'connecting';
          session.qrDataUrl = null;
          session.pairingCode = null;
          session.connectedPhone = null;
          session.connectedName = null;
          scheduleCloudStateSync(true);
          setTimeout(() => {
            if ((globalThis as any).__noeluxEngineGen !== myEngineGen) return;
            connectWhatsAppEngine(false, session.id).catch(() => { });
          }, 350);
        } else {
          // Si otro contenedor (Producción en Railway) tomó la conexión (440) y este es el contenedor Dev, no reconectar en bucle
          if (statusCode === 440 && !isProductionRuntime()) {
            skipDevAutoConnectBecauseProdActive = true;
            session.status = 'disconnected';
            return;
          }
          session.status = state.creds?.me?.id ? 'syncing' : 'connecting';
          scheduleCloudStateSync(false);
          const delayMs = statusCode === 440 ? 4000 : 1000;
          setTimeout(() => {
            if ((globalThis as any).__noeluxEngineGen !== myEngineGen) return;
            connectWhatsAppEngine(false, session.id).catch(() => { });
          }, delayMs);
        }
      }
    });

    // Listen to real-time incoming & outgoing messages on this WhatsApp line
    newSock.ev.on('messages.upsert', async (event) => {
      if ((globalThis as any).__noeluxEngineGen !== myEngineGen) return;
      if (mySeq !== session.socketSeq || session.sock !== newSock) return;
      if (event.type !== 'notify' && event.type !== 'append') return;

      for (const msg of event.messages) {
        try {
          if (!msg.message) continue;
          const remoteJid = msg.key.remoteJid || '';
          if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;

          const msgId = msg.key.id || `baileys-${Date.now()}`;
          // Skip messages sent by our own server (AI or Admin Panel)
          if (recentlySentMsgIds.has(msgId)) {
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
            (newSock.user as any)?.lid ||
            ''
          ).split('@')[0].split(':')[0].replace(/\D/g, '');

          const rawRemoteDigits = remoteJid.split('@')[0].split(':')[0].replace(/\D/g, '');
          const isRemoteSelfLid = Boolean(selfLidDigits && rawRemoteDigits === selfLidDigits);

          const senderPn =
            (msg.key as any).remoteJidAlt ||
            (msg.key as any).participantAlt ||
            (msg.key as any).senderPn ||
            (msg.key as any).participantPn ||
            '';

          let cleanPhone =
            isRemoteSelfLid && selfCleanPhone
              ? selfCleanPhone
              : ((senderPn ? resolveJidToCleanPhone(session, senderPn) : null) ||
                 resolveJidToCleanPhone(session, remoteJid));

          // Si remoteJid es un @lid y aún no se resolvió al número real (o devolvió los 15 dígitos del LID),
          // consultar de forma asíncrona el lidMapping de Baileys v7:
          if (
            remoteJid.endsWith('@lid') &&
            (!cleanPhone || cleanPhone === rawRemoteDigits) &&
            !isRemoteSelfLid
          ) {
            try {
              const sockAny = newSock as any;
              if (sockAny?.signalRepository?.lidMapping?.getPNForLID) {
                const resolvedPn = await sockAny.signalRepository.lidMapping.getPNForLID(remoteJid);
                if (resolvedPn && typeof resolvedPn === 'string') {
                  const cleanFromPn = normalizeWaPhone(resolvedPn.split('@')[0].split(':')[0]);
                  if (cleanFromPn) {
                    lidToPhoneCache.set(rawRemoteDigits, cleanFromPn);
                    phoneToLidCache.set(cleanFromPn, rawRemoteDigits);
                    cleanPhone = cleanFromPn;
                  }
                }
              }
            } catch {}

            // Último recurso para @lid cuando solo hay 1 pedido activo en curso de confirmación recientemente
            if (!cleanPhone || cleanPhone === rawRemoteDigits) {
              const activePedidos = loadPedidos().filter(
                p => !isOrderDeleted(p?.reservaid) && !isOrderDeleted(p?.id)
              );
              const unconfirmedOrders = activePedidos.filter(
                p => !p.datosConfirmados && !p.agenteCompletado && (p.convStep || 1) < 5
              );
              if (unconfirmedOrders.length === 1) {
                const candidatePhone = normalizeWaPhone(unconfirmedOrders[0].celular);
                if (candidatePhone) {
                  lidToPhoneCache.set(rawRemoteDigits, candidatePhone);
                  phoneToLidCache.set(candidatePhone, rawRemoteDigits);
                  cleanPhone = candidatePhone;
                }
              }
            }
          }

          if (!cleanPhone && isRemoteSelfLid && selfCleanPhone) {
            cleanPhone = selfCleanPhone;
          }

          if (!cleanPhone) continue;

          // Skip if this exact message ID is already stored in chat history
          const existingHistory = loadChatsStorage().chats[cleanPhone] || [];
          if (existingHistory.some(m => m.id === msgId)) {
            continue;
          }

          // Unwrap ephemeral (disappearing), viewOnce, or edited message containers
          const innerMsg: any =
            msg.message.ephemeralMessage?.message ||
            msg.message.viewOnceMessage?.message ||
            msg.message.viewOnceMessageV2?.message ||
            msg.message.viewOnceMessageV2Extension?.message ||
            msg.message.documentWithCaptionMessage?.message ||
            msg.message.editedMessage?.message?.protocolMessage?.editedMessage ||
            msg.message;

          const isAudioMsg = Boolean(innerMsg?.audioMessage);
          const locMsg = innerMsg?.locationMessage || innerMsg?.liveLocationMessage || null;
          const isLocationMsg = Boolean(locMsg);
          const isImageWithoutCaption = Boolean(innerMsg?.imageMessage && !innerMsg?.imageMessage?.caption);

          // Determine if this message is from the Admin or from the Client.
          // IMPORTANT: If cleanPhone matches session.connectedPhone (Self-Chat testing from the owner's phone),
          // any message not in recentlySentMsgIds was typed/recorded on the phone to test the client flow!
          const isSelfChat = Boolean(selfCleanPhone && (cleanPhone === selfCleanPhone || isRemoteSelfLid));
          const isFromAdmin = Boolean(msg.key.fromMe) && !isSelfChat;

          // Cancel any pending 1-minute inactivity follow-up timer as soon as the customer sends any message
          if (!isFromAdmin) {
            cancelCustomerInactivityFollowUp(cleanPhone);
          }

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

          const isBlockedPostConfirm = !isFromAdmin && isCustomerPostConfirmBlocked(cleanPhone);
          const matchedOrderForPhone = findActiveOrderForPhone(cleanPhone);

          const isDocumentMsg = Boolean(
            innerMsg?.documentMessage || innerMsg?.documentWithCaptionMessage
          );
          const isAnyImageMsg = Boolean(innerMsg?.imageMessage);
          const isInPrepaymentPromoFlow = Boolean(
            matchedOrderForPhone &&
              (matchedOrderForPhone.promoPagoAdelantadoStage === 'alias_sent_awaiting_receipt' ||
                matchedOrderForPhone.promoPagoAdelantadoStage === 'awaiting_ready_for_alias' ||
                matchedOrderForPhone.promoPagoAdelantadoStage === 'offered_hook' ||
                matchedOrderForPhone.datosConfirmados)
          );

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
          } else if (isImageWithoutCaption && !isFromAdmin) {
            text = '📷 [El cliente envió una foto de la fachada/referencia de su casa]';
          }

          if (isAudioMsg) {
            if (!isFromAdmin) {
              if (isBlockedPostConfirm) {
                // Auto-bloqueado tras los mensajes post-confirmación: NO transcribir con Deepgram STT para no gastar créditos
                text = '🎤 [Nota de voz recibida tras cierre definitivo de atención]';
              } else {
                const sttRes = await transcribeWhatsAppAudioMessage(msg);
                customerAudioDataUrl = sttRes.audioDataUrl;
                if (sttRes.transcript) {
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

          if (!text.trim()) continue;

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
            // FILTRO ESTRICTO OPCIÓN 1: SOLO CLIENTES CON PEDIDO REGISTRADO
            // =========================================================================
            if (!matchedOrderForPhone) {
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

            // Validar que el mensaje no sea histórico antiguo (última hora) antes de auto-responder
            const rawTs = Number(msg.messageTimestamp || 0);
            const msgAgeSec = rawTs > 1000000000 ? Math.abs(Date.now() / 1000 - rawTs) : 0;
            if (msgAgeSec > 3600) continue;

            const storage = loadChatsStorage();
            const customerChatMode = storage.chatModes[cleanPhone];
            const isExplicitManual = customerChatMode === 'manual';
            if (isExplicitManual) {
              // El modo de chat está explícitamente en "Yo Escribo" (Manual). No auto-responder para respetar al usuario.
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
              'texto';

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

                // Wait if a previous turn for this exact phone is still in-flight
                const existingLock = inFlightCustomerReplyLocks.get(cleanPhone);
                if (existingLock) {
                  try {
                    await existingLock;
                  } catch {}
                }

                const turnPromise = (async () => {
                  try {
                    const smartRes: any = await generateSmartAiReply(cleanPhone, inputForLlm);
                    if (smartRes.error) {
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
                    const locationTextConfirmation = smartRes.locationTextConfirmation;
                    const matchedOrder = smartRes.matchedOrder;
                    const convStep = smartRes.convStep;
                    const forceAudioReply = Boolean(smartRes.forceAudioReply);

                    if (reply) {
                      // RULE:
                      // 1. If forceAudioReply is true (e.g., customer sent the payment receipt / comprobante), ALWAYS reply with a Voice Note ('audio')!
                      // 2. If the customer sent a Voice Note (combinedHasAudio) or activeChannel is 'audio', reply with a Voice Note ('audio')!
                      // 3. And when locationTextConfirmation is present (e.g. Step 3 address card or Stage C Banco Familiar Alias 3856033 card), send it in TEXT!
                      if (forceAudioReply || combinedHasAudio || activeChannel === 'audio') {
                        await sendWhatsAppVoiceCallTurn(
                          cleanPhone,
                          reply,
                          convStep,
                          matchedOrder?.reservaid,
                          session.id,
                          'audio',
                          undefined,
                          locationTextConfirmation
                        );
                      } else {
                        const fullTextReply = locationTextConfirmation
                          ? `${reply}\n\n${locationTextConfirmation}`
                          : reply;
                        await sendWhatsAppMessage(
                          cleanPhone,
                          fullTextReply,
                          'ai',
                          matchedOrder?.reservaid,
                          session.id
                        );
                        if (convStep < 5) {
                          scheduleCustomerInactivityFollowUp(cleanPhone, matchedOrder?.reservaid, session.id);
                        } else {
                          cancelCustomerInactivityFollowUp(cleanPhone);
                        }
                      }
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

    if (!session.sock || session.status === 'disconnected') {
      await connectWhatsAppEngine(true, session.id);
      await new Promise(r => setTimeout(r, 1500));
    }

    if (!session.sock) {
      return { success: false, error: 'El motor de WhatsApp está iniciando, intentá en 2 segundos.' };
    }

    const code = await session.sock.requestPairingCode(cleanPhone);
    const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
    session.pairingCode = formattedCode;
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
  sessionId?: string
): Promise<WaEngineState> {
  ensureInitialSessionsLoaded();
  const targetId = sessionId || Array.from(sessionsMap.keys())[0] || 'wa-1';
  const session = getOrCreateSessionRuntime(targetId);

  await stopSessionSocket(session, clearSession);

  session.status = 'connecting';
  session.qrDataUrl = null;
  session.pairingCode = null;
  session.connectedPhone = null;
  session.connectedName = null;
  scheduleCloudStateSync(true);

  setTimeout(() => {
    connectWhatsAppEngine(false, session.id).catch(() => { });
  }, 250);

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

  const activeSession = pickConnectedSession(preferredSessionId);

  if (activeSession && activeSession.sock) {
    try {
      const jid = `${cleanPhone}@s.whatsapp.net`;
      try {
        await activeSession.sock.sendPresenceUpdate('composing', jid);
      } catch (e) { }

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
        if (skipDevAutoConnectBecauseProdActive && !isProductionRuntime()) {
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
        pollCloudCommandsAndOrders().catch(() => { });
      }, 1800);
    }
  } catch (e) { }
}

// ============================================================================
// AGENTE DE AVISOS Y CONVERSACIÓN EXCLUSIVA CON EL VENDEDOR POR PRODUCTO
// ============================================================================

const SELLER_CHATS_FILE = path.resolve(process.cwd(), 'seller_agent_chats.json');

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

