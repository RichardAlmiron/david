import fs from 'node:fs';
import path from 'node:path';
import type {
  AutoAdsFeatureFlags,
  AutoAdsHypothesisV2,
  CompetitorFindingV2,
  CourierSettlementRecord,
  FxRatePeriod,
  Order,
  ProductCostProfile,
  PsychologicalProfileV2
} from '../src/types.ts';
import {
  inferParaguayDepartmentFromCity,
  normalizeOrderGpsFields
} from '../src/utils/paraguayGeo.ts';

export interface StoredWaToken {
  token: string;
  productSlug: string;
  visitorId?: string;
  adId?: string;
  adsetId?: string;
  campaignId?: string;
  creativeId?: string;
  hypothesisId?: string;
  angleId?: string;
  aaCid?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmContent?: string;
  phoneNormalized?: string;
  touchPayload?: Record<string, any> | null;
  createdAt: string;
  expiresAt: string;
}

export interface StoredOrderAttribution {
  id: string;
  pedidoId?: number | string | null;
  reservaId: string;
  clientRequestKey?: string;
  visitorId?: string;
  productSlug: string;
  attributionChannel: string;
  attributionMethod: string;
  attributionConfidence: number;
  adId?: string;
  adsetId?: string;
  campaignId?: string;
  creativeId?: string;
  hypothesisId?: string;
  angleId?: string;
  aaCid?: string;
  waToken?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  referrer?: string;
  landingPath?: string;
  deviceType?: string;
  phoneNormalized?: string;
  clientIp?: string;
  clientUserAgent?: string;
  firstTouchJson?: Record<string, any> | null;
  lastPaidTouchJson?: Record<string, any> | null;
  rawSnapshotJson?: Record<string, any> | null;
  confirmedFormAt: string;
  createdAt: string;
}

export interface CloudSyncQueueItem {
  id: string;
  kind: 'pedido_and_attribution' | 'order_axis_update';
  dedupKey: string;
  payload: Record<string, any>;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'synced' | 'dead_letter';
  lastError?: string;
  nextRetryAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredAdEntity {
  id: string;
  productSlug: string;
  publisher: 'meta_direct' | 'pipeboard';
  adAccountId: string;
  accountCurrency: string;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  creativeId?: string;
  metaCreativeId?: string;
  aaCid?: string;
  hypothesisId?: string;
  angleId?: string;
  mediaType: 'image' | 'video';
  headline?: string;
  primaryText?: string;
  ctaLabel?: string;
  destinationUrl?: string;
  urlTags?: string;
  preflightStatus?: string;
  payloadSnapshot?: Record<string, any>;
  publishedAt: string;
}

export interface StoredResearchDossier {
  id: string;
  productSlug: string;
  market: string;
  productTruthJson?: Record<string, any>;
  competitorFindingsJson: CompetitorFindingV2[];
  competitorSourceSummary: {
    verifiedCount: number;
    manualCount: number;
    inferredCount: number;
    adArchiveError?: string;
  };
  psychologicalProfileJson: PsychologicalProfileV2;
  awarenessLevel: string;
  marketSophistication: number;
  createdAt: string;
}

export interface StoredHypothesisRecord extends AutoAdsHypothesisV2 {
  dossierId: string;
  productSlug: string;
  verdict: 'pending' | 'winner' | 'promising' | 'loser' | 'insufficient_data';
  createdAt: string;
}

export interface StoredMetaDailyInsight {
  id: string;
  insightDate: string;
  adAccountId: string;
  accountCurrency: string;
  campaignId?: string;
  adsetId?: string;
  adId: string;
  impressions: number;
  clicks: number;
  inlineLinkClicks: number;
  spendRaw: number;
  spendUsd: number;
  spendPyg: number;
  metaLeadsReported: number;
  cpmUsd: number;
  cpcUsd: number;
  ctrPct: number;
  rawActionsJson?: any[];
  syncedAt: string;
}

export interface StoredLearningMemoryRow {
  id: string;
  productSlug: string;
  entityType: 'campaign' | 'adset' | 'ad' | 'creative' | 'hypothesis' | 'angle' | 'hook' | 'format';
  entityId: string;
  angleId?: string;
  hypothesisId?: string;
  verdict: 'winner' | 'promising' | 'loser' | 'insufficient_data';
  formsCount: number;
  inlineLinkClicks: number;
  impressions: number;
  spendUsd: number;
  spendPyg: number;
  formCvrPct: number;
  cpfUsd: number | null;
  cpfPyg: number | null;
  confidenceScore: number;
  recommendedAction: string;
  learnedPatternSummary: string;
  updatedAt: string;
}

export interface MetaCapiDispatchEntry {
  id: string;
  eventId: string;
  eventName: 'Lead' | 'OrderReservedCOD' | 'Purchase' | string;
  pedidoId?: number | string | null;
  reservaId?: string;
  pixelId: string;
  circuit: 'circuit_a_conversion' | 'circuit_b_purchase';
  status: 'queued' | 'sent' | 'failed_retrying' | 'dead_letter' | 'skipped_window_expired_erp_only';
  attempts: number;
  maxAttempts: number;
  eventTimeUnix: number;
  payloadJson: Record<string, any>;
  responseJson?: Record<string, any> | null;
  lastError?: string;
  nextRetryAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

interface OrdersAttributionFile {
  orders: Order[];
  attributions: StoredOrderAttribution[];
  waTokens: StoredWaToken[];
  cloudSyncQueue: CloudSyncQueueItem[];
}

interface IntelligenceFile {
  dossiers: StoredResearchDossier[];
  hypotheses: StoredHypothesisRecord[];
  adEntities: StoredAdEntity[];
  metaDailyInsights: StoredMetaDailyInsight[];
  learningMemory: StoredLearningMemoryRow[];
}

interface ErpFinanceFile {
  costProfiles: ProductCostProfile[];
  fxPeriods: FxRatePeriod[];
  settlements: CourierSettlementRecord[];
}

interface CapiDispatchFile {
  entries: MetaCapiDispatchEntry[];
}

const DEFAULT_FEATURE_FLAGS: AutoAdsFeatureFlags = {
  AUTOADS_STRATEGY_V2_ENABLED: true,
  AUTOADS_CANONICAL_LEAD_ONLY: true,
  AUTOADS_EMIT_COD_CUSTOM_EVENT: true,
  AUTOADS_PREFLIGHT_STRICT_CURRENCY: true,
  AUTOADS_PURCHASE_CAPI_INDEPENDENT_ENABLED: true
};

let overrideDataRootForTests: string | null = null;
let supabaseSchemaMissingWarned = new Set<string>();
let cachedEnvVars: Record<string, string> | null = null;

const OFFICIAL_SUPABASE_URL = 'https://pgpmopannzzubunuhlmb.supabase.co';
const OFFICIAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncG1vcGFubnp6dWJ1bnVobG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNjg2MTAsImV4cCI6MjEwOTg0NDYxMH0.Mgy-Uo7_nJcFf_Wii9RBmAuI9meWZGcNdgp8X_bls88';

interface HydratedRootCache {
  ordersAttr?: OrdersAttributionFile;
  intel?: IntelligenceFile;
  erp?: ErpFinanceFile;
  capi?: CapiDispatchFile;
  flags?: Partial<AutoAdsFeatureFlags>;
  lastHydratedAt: number;
  lastErrors: string[];
}

const memoryStoreCache = new Map<string, HydratedRootCache>();
const pendingSupabaseSyncs = new Set<Promise<any>>();
const activeHydrations = new Map<string, Promise<{ ok: boolean; tablesLoaded: string[]; errors: string[] }>>();

function getOrCreateRootCache(): HydratedRootCache {
  const root = getAutoadsDataRoot();
  let entry = memoryStoreCache.get(root);
  if (!entry) {
    entry = { lastHydratedAt: 0, lastErrors: [] };
    memoryStoreCache.set(root, entry);
  }
  return entry;
}

function trackSupabasePromise<T>(promise: Promise<T>): Promise<T> {
  pendingSupabaseSyncs.add(promise);
  promise.finally(() => {
    pendingSupabaseSyncs.delete(promise);
  });
  return promise;
}

export async function flushPendingSupabaseSyncs(timeoutMs = 5000): Promise<void> {
  if (pendingSupabaseSyncs.size === 0) return;
  const snapshot = Array.from(pendingSupabaseSyncs);
  await Promise.race([
    Promise.allSettled(snapshot),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

export function setAutoadsDataRootForTesting(dirPath: string | null): void {
  overrideDataRootForTests = dirPath ? path.resolve(dirPath) : null;
  supabaseSchemaMissingWarned = new Set<string>();
  memoryStoreCache.clear();
  activeHydrations.clear();
}

function loadEnvMap(): Record<string, string> {
  if (cachedEnvVars) return cachedEnvVars;
  const out: Record<string, string> = {};
  const candidates = ['.env.local', '.env'];
  for (const fname of candidates) {
    const fpath = path.resolve(process.cwd(), fname);
    if (!fs.existsSync(fpath)) continue;
    try {
      const content = fs.readFileSync(fpath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx <= 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!(key in out)) out[key] = val;
      }
    } catch {
      // ignore env file errors
    }
  }
  cachedEnvVars = out;
  return out;
}

export function getEnvValue(key: string): string {
  const proc = process.env[key];
  if (typeof proc === 'string' && proc.trim()) return proc.trim();
  const envMap = loadEnvMap();
  return String(envMap[key] || '').trim();
}

export function getAutoadsDataRoot(): string {
  if (overrideDataRootForTests) {
    if (!fs.existsSync(overrideDataRootForTests)) {
      fs.mkdirSync(overrideDataRootForTests, { recursive: true });
    }
    return overrideDataRootForTests;
  }
  const envRoot = getEnvValue('PERSISTENT_DATA_ROOT');
  if (envRoot && fs.existsSync(envRoot)) {
    const dir = path.join(envRoot, 'autoads_v2');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
  const railwayData = '/data';
  if (process.platform !== 'win32' && fs.existsSync(railwayData)) {
    const dir = path.join(railwayData, 'autoads_v2');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
  const localDir = path.resolve(process.cwd(), 'data', 'autoads_v2');
  fs.mkdirSync(localDir, { recursive: true });
  return localDir;
}

function readJsonFile<T>(filename: string, fallback: T): T {
  const fpath = path.join(getAutoadsDataRoot(), filename);
  try {
    if (!fs.existsSync(fpath)) return fallback;
    const raw = fs.readFileSync(fpath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile<T>(filename: string, data: T): void {
  const dir = getAutoadsDataRoot();
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

function cleanEnvString(raw: string): string {
  return String(raw || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
}

export function getSupabaseCreds(): { url: string; key: string } | null {
  if (overrideDataRootForTests) return null; // keep unit tests completely offline & deterministic
  const rawUrl = cleanEnvString(getEnvValue('SUPABASE_URL') || getEnvValue('VITE_SUPABASE_URL'));
  const rawKey = cleanEnvString(
    getEnvValue('SUPABASE_SERVICE_ROLE_KEY') ||
      getEnvValue('VITE_SUPABASE_ANON_KEY') ||
      getEnvValue('SUPABASE_ANON_KEY')
  ).replace(/\/+$/, '');
  const validPair =
    Boolean(rawUrl && rawKey) &&
    rawKey !== 'native-internal-key' &&
    !rawUrl.includes('cmxcohevrlmzsfqslmft.supabase.co') &&
    !rawUrl.includes('localhost') &&
    !rawUrl.includes('127.0.0.1') &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(rawUrl);
  return {
    url: validPair ? rawUrl : OFFICIAL_SUPABASE_URL,
    key: validPair ? rawKey : OFFICIAL_SUPABASE_ANON_KEY
  };
}

function isSchemaMissingResponse(status: number, text: string): boolean {
  return (
    status === 404 ||
    text.includes('PGRST205') ||
    text.includes('does not exist') ||
    text.includes('Could not find the table')
  );
}

export async function postgrestUpsert(
  table: string,
  row: Record<string, any> | Array<Record<string, any>>,
  onConflict?: string,
  options?: { returning?: boolean; timeoutMs?: number }
): Promise<{ ok: boolean; status: number; rows?: any[]; schemaMissing?: boolean; error?: string }> {
  const creds = getSupabaseCreds();
  if (!creds) return { ok: false, status: 0, error: 'supabase_not_configured' };
  const rows = Array.isArray(row) ? row : [row];
  if (rows.length === 0) return { ok: true, status: 200, rows: [] };
  const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  const prefer = options?.returning
    ? 'resolution=merge-duplicates,return=representation'
    : 'resolution=merge-duplicates,return=minimal';

  return trackSupabasePromise(
    (async () => {
      try {
        const resp = await fetch(`${creds.url}/rest/v1/${encodeURIComponent(table)}${qs}`, {
          method: 'POST',
          headers: {
            apikey: creds.key,
            Authorization: `Bearer ${creds.key}`,
            'Content-Type': 'application/json',
            Prefer: prefer
          },
          body: JSON.stringify(rows),
          signal: AbortSignal.timeout(options?.timeoutMs ?? 8000)
        });
        if (resp.ok) {
          let returnedRows: any[] | undefined;
          if (options?.returning) {
            try {
              const parsed = await resp.json();
              returnedRows = Array.isArray(parsed) ? parsed : [];
            } catch {
              returnedRows = [];
            }
          }
          return { ok: true, status: resp.status, rows: returnedRows };
        }
        const text = await resp.text().catch(() => '');
        const schemaMissing = isSchemaMissingResponse(resp.status, text);
        if (schemaMissing && !supabaseSchemaMissingWarned.has(table)) {
          supabaseSchemaMissingWarned.add(table);
          console.warn(`[autoadsStore] Tabla '${table}' aún no existe en Supabase. Ejecutá database/autoads_v2_additive_migration.sql.`);
        } else if (!schemaMissing) {
          console.warn(`[autoadsStore] Upsert '${table}' HTTP ${resp.status}: ${text.slice(0, 200)}`);
        }
        return { ok: false, status: resp.status, schemaMissing, error: text.slice(0, 300) };
      } catch (err: any) {
        return { ok: false, status: 0, error: String(err?.message || err) };
      }
    })()
  );
}

export async function postgrestSelect<T = Record<string, any>>(
  table: string,
  query?: string,
  timeoutMs = 8000
): Promise<{ ok: boolean; status: number; rows: T[]; schemaMissing?: boolean; error?: string }> {
  const creds = getSupabaseCreds();
  if (!creds) return { ok: false, status: 0, rows: [], error: 'supabase_not_configured' };
  const qs = query ? `?${query}` : '';
  try {
    const resp = await fetch(`${creds.url}/rest/v1/${encodeURIComponent(table)}${qs}`, {
      method: 'GET',
      headers: {
        apikey: creds.key,
        Authorization: `Bearer ${creds.key}`,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => []);
      return { ok: true, status: resp.status, rows: Array.isArray(data) ? data : [] };
    }
    const text = await resp.text().catch(() => '');
    const schemaMissing = isSchemaMissingResponse(resp.status, text);
    if (schemaMissing && !supabaseSchemaMissingWarned.has(table)) {
      supabaseSchemaMissingWarned.add(table);
      console.warn(`[autoadsStore] Tabla '${table}' aún no existe en Supabase.`);
    }
    return { ok: false, status: resp.status, rows: [], schemaMissing, error: text.slice(0, 300) };
  } catch (err: any) {
    return { ok: false, status: 0, rows: [], error: String(err?.message || err) };
  }
}

export async function postgrestDelete(
  table: string,
  query: string,
  timeoutMs = 8000
): Promise<{ ok: boolean; status: number; error?: string }> {
  const creds = getSupabaseCreds();
  if (!creds) return { ok: false, status: 0, error: 'supabase_not_configured' };
  return trackSupabasePromise(
    (async () => {
      try {
        const resp = await fetch(`${creds.url}/rest/v1/${encodeURIComponent(table)}?${query}`, {
          method: 'DELETE',
          headers: {
            apikey: creds.key,
            Authorization: `Bearer ${creds.key}`,
            Prefer: 'return=minimal'
          },
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (resp.ok) return { ok: true, status: resp.status };
        const text = await resp.text().catch(() => '');
        return { ok: false, status: resp.status, error: text.slice(0, 300) };
      } catch (err: any) {
        return { ok: false, status: 0, error: String(err?.message || err) };
      }
    })()
  );
}

async function syncFeatureFlagsToSupabase(flags: AutoAdsFeatureFlags): Promise<void> {
  const creds = getSupabaseCreds();
  if (!creds) return;
  const code = `AAFLAGS-v2-${Date.now()}`;
  const res = await trackSupabasePromise(
    (async () => {
      try {
        const resp = await fetch(`${creds.url}/rest/v1/codigos`, {
          method: 'POST',
          headers: {
            apikey: creds.key,
            Authorization: `Bearer ${creds.key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({ code, dispositivo: JSON.stringify(flags) }),
          signal: AbortSignal.timeout(7000)
        });
        if (!resp.ok) return false;
        await postgrestDelete('codigos', `code=like.AAFLAGS-v2-*&code=neq.${encodeURIComponent(code)}`);
        return true;
      } catch {
        return false;
      }
    })()
  );
  void res;
}

export function getSupabaseMigrationWarnings(): string[] {
  return Array.from(supabaseSchemaMissingWarned);
}

// ============================================================================
// MAPPERS PUROS SUPABASE <-> MODELOS INTERNOS (HIDRATACIÓN REAL SIN JSON LOCAL)
// ============================================================================

export function mapSupabasePedidoRowToOrder(r: Record<string, any>): Order {
  const legacyObj =
    r.dispositivo && typeof r.dispositivo === 'object' && !Array.isArray(r.dispositivo)
      ? (r.dispositivo as Record<string, any>)
      : {};
  const resolvedCiudad = String(r.ciudad ?? legacyObj.ciudad ?? '').trim();
  const resolvedDepartamento = inferParaguayDepartmentFromCity(
    resolvedCiudad,
    String(r.departamento ?? legacyObj.departamento ?? '')
  );
  const normalizedGps = normalizeOrderGpsFields(r, legacyObj, legacyObj?.comparativaDatos);

  return {
    ...legacyObj,
    id: r.id ?? legacyObj.id,
    reservaid: String(r.reservaid || legacyObj.reservaid || ''),
    productoId: r.producto_id || legacyObj.productoId || 'prod-noelux-01',
    producto: r.producto ?? legacyObj.producto,
    waVendedor: r.wa_vendedor ?? legacyObj.waVendedor,
    nombre: r.nombre || legacyObj.nombre || 'Cliente',
    celular: r.celular || legacyObj.celular || '',
    departamento: resolvedDepartamento,
    ciudad: resolvedCiudad,
    direccion: r.direccion ?? legacyObj.direccion ?? '',
    detalle: r.detalle ?? legacyObj.detalle ?? '',
    cantidad: Number(r.cantidad ?? legacyObj.cantidad ?? 1),
    monto: Number(r.monto ?? legacyObj.monto ?? 0),
    ref_code: r.ref_code ?? legacyObj.ref_code,
    estado: r.estado || legacyObj.estado || 'reservado',
    tipoVivienda: r.tipo_vivienda ?? legacyObj.tipoVivienda,
    ...normalizedGps,
    referenciaCasa: r.referencia_casa ?? legacyObj.referenciaCasa,
    modoIA: r.modo_ia ?? legacyObj.modoIA,
    convStep: r.conv_step != null ? Number(r.conv_step) : legacyObj.convStep,
    atendidoPorIA: r.atendido_por_ia != null ? Boolean(r.atendido_por_ia) : legacyObj.atendidoPorIA,
    datosConfirmados: r.datos_confirmados != null ? Boolean(r.datos_confirmados) : legacyObj.datosConfirmados,
    agenteCompletado: r.agente_completado != null ? Boolean(r.agente_completado) : legacyObj.agenteCompletado,
    empaquetado: r.empaquetado != null ? Boolean(r.empaquetado) : legacyObj.empaquetado,
    archivado: r.archivado != null ? Boolean(r.archivado) : legacyObj.archivado,
    fechaArchivado: r.fecha_archivado ?? legacyObj.fechaArchivado,
    fecha: String(r.fecha || legacyObj.fecha || r.confirmed_form_at || new Date().toISOString()),
    actualizado_en: r.actualizado_en ?? legacyObj.actualizado_en,
    visitorId: r.visitor_id ?? legacyObj.visitorId ?? undefined,
    clientRequestKey: r.client_request_key ?? legacyObj.clientRequestKey ?? undefined,
    confirmedFormAt: String(r.confirmed_form_at || r.fecha || legacyObj.confirmedFormAt || ''),
    canonicalConversionEvent: 'Lead',
    canonicalLeadEventId: r.canonical_lead_event_id ?? legacyObj.canonicalLeadEventId ?? undefined,
    attributedAdId: r.attributed_ad_id ?? legacyObj.attributedAdId ?? undefined,
    attributedCampaignId: r.attributed_campaign_id ?? legacyObj.attributedCampaignId ?? undefined,
    attributedAdsetId: r.attributed_adset_id ?? legacyObj.attributedAdsetId ?? undefined,
    attributedCreativeId: r.attributed_creative_id ?? legacyObj.attributedCreativeId ?? undefined,
    attributedHypothesisId: r.attributed_hypothesis_id ?? legacyObj.attributedHypothesisId ?? undefined,
    attributedAngleId: r.attributed_angle_id ?? legacyObj.attributedAngleId ?? undefined,
    attributionSourceKind: r.attribution_source_kind ?? legacyObj.attributionSourceKind ?? undefined,
    deliveryStatus: r.delivery_status ?? legacyObj.deliveryStatus ?? undefined,
    customerPaymentStatus: r.customer_payment_status ?? legacyObj.customerPaymentStatus ?? undefined,
    courierSettlementStatus: r.courier_settlement_status ?? legacyObj.courierSettlementStatus ?? undefined,
    deliveredAt: r.delivered_at ?? legacyObj.deliveredAt ?? undefined,
    collectedAt: r.collected_at ?? legacyObj.collectedAt ?? undefined,
    settledAt: r.settled_at ?? legacyObj.settledAt ?? undefined,
    netCashCollectedPyg: r.net_cash_collected_pyg != null ? Number(r.net_cash_collected_pyg) : legacyObj.netCashCollectedPyg,
    courierFeePyg: r.courier_fee_pyg != null ? Number(r.courier_fee_pyg) : legacyObj.courierFeePyg,
    courierSettlementId: r.courier_settlement_id ?? legacyObj.courierSettlementId ?? undefined,
    productUnitCostPyg: r.product_unit_cost_pyg != null ? Number(r.product_unit_cost_pyg) : legacyObj.productUnitCostPyg,
    packagingCostPyg: r.packaging_cost_pyg != null ? Number(r.packaging_cost_pyg) : legacyObj.packagingCostPyg,
    returnCostPyg: r.return_cost_pyg != null ? Number(r.return_cost_pyg) : legacyObj.returnCostPyg,
    purchaseCapiStatus: r.purchase_capi_status ?? legacyObj.purchaseCapiStatus ?? undefined
  };
}

export function mapSupabaseOrderAttributionRow(r: Record<string, any>): StoredOrderAttribution {
  return {
    id: r.id != null ? String(r.id) : `attr_${r.reservaid}`,
    pedidoId: r.pedido_id ?? null,
    reservaId: String(r.reservaid || ''),
    clientRequestKey: r.client_request_key || undefined,
    visitorId: r.visitor_id || undefined,
    productSlug: String(r.product_slug || 'default'),
    attributionChannel: String(r.attribution_channel || 'direct'),
    attributionMethod: String(r.attribution_method || 'none'),
    attributionConfidence: Number(r.attribution_confidence || 0),
    adId: r.ad_id || undefined,
    adsetId: r.adset_id || undefined,
    campaignId: r.campaign_id || undefined,
    creativeId: r.creative_id || undefined,
    hypothesisId: r.hypothesis_id || undefined,
    angleId: r.angle_id || undefined,
    aaCid: r.aa_cid || undefined,
    waToken: r.wa_token || undefined,
    utmSource: r.utm_source || undefined,
    utmMedium: r.utm_medium || undefined,
    utmCampaign: r.utm_campaign || undefined,
    utmContent: r.utm_content || undefined,
    utmTerm: r.utm_term || undefined,
    fbclid: r.fbclid || undefined,
    fbc: r.fbc || undefined,
    fbp: r.fbp || undefined,
    referrer: r.referrer || undefined,
    landingPath: r.landing_path || undefined,
    deviceType: r.device_type || undefined,
    phoneNormalized: r.phone_normalized || undefined,
    clientIp: r.client_ip || undefined,
    clientUserAgent: r.client_user_agent || undefined,
    firstTouchJson: r.first_touch_json || null,
    lastPaidTouchJson: r.last_paid_touch_json || null,
    rawSnapshotJson: r.raw_snapshot_json || null,
    confirmedFormAt: String(r.confirmed_form_at || r.created_at || new Date().toISOString()),
    createdAt: String(r.created_at || r.confirmed_form_at || new Date().toISOString())
  };
}

export function mapSupabaseWaTokenRow(r: Record<string, any>): StoredWaToken {
  return {
    token: String(r.token || ''),
    productSlug: String(r.product_slug || 'default'),
    visitorId: r.visitor_id || undefined,
    adId: r.ad_id || undefined,
    adsetId: r.adset_id || undefined,
    campaignId: r.campaign_id || undefined,
    creativeId: r.creative_id || undefined,
    hypothesisId: r.hypothesis_id || undefined,
    angleId: r.angle_id || undefined,
    aaCid: r.aa_cid || undefined,
    fbclid: r.fbclid || undefined,
    fbc: r.fbc || undefined,
    fbp: r.fbp || undefined,
    utmSource: r.utm_source || undefined,
    utmCampaign: r.utm_campaign || undefined,
    utmContent: r.utm_content || undefined,
    phoneNormalized: r.phone_normalized || undefined,
    touchPayload: r.touch_payload || null,
    createdAt: String(r.created_at || new Date().toISOString()),
    expiresAt: String(r.expires_at || new Date().toISOString())
  };
}

export function mapSupabaseAdEntityRow(r: Record<string, any>): StoredAdEntity {
  return {
    id: String(r.id || ''),
    productSlug: String(r.product_slug || 'default'),
    publisher: r.publisher === 'pipeboard' ? 'pipeboard' : 'meta_direct',
    adAccountId: String(r.ad_account_id || ''),
    accountCurrency: String(r.account_currency || 'USD'),
    campaignId: r.campaign_id || undefined,
    adsetId: r.adset_id || undefined,
    adId: r.ad_id || undefined,
    creativeId: r.creative_id || undefined,
    metaCreativeId: r.meta_creative_id || undefined,
    aaCid: r.aa_cid || undefined,
    hypothesisId: r.hypothesis_id || undefined,
    angleId: r.angle_id || undefined,
    mediaType: r.media_type === 'video' ? 'video' : 'image',
    headline: r.headline || undefined,
    primaryText: r.primary_text || undefined,
    ctaLabel: r.cta_label || undefined,
    destinationUrl: r.destination_url || undefined,
    urlTags: r.url_tags || undefined,
    preflightStatus: r.preflight_status || undefined,
    payloadSnapshot: r.payload_snapshot || undefined,
    publishedAt: String(r.published_at || new Date().toISOString())
  };
}

export function mapSupabaseDossierRow(r: Record<string, any>): StoredResearchDossier {
  return {
    id: String(r.id || ''),
    productSlug: String(r.product_slug || 'default'),
    market: String(r.market || 'PY'),
    productTruthJson: r.product_truth_json || {},
    competitorFindingsJson: Array.isArray(r.competitor_findings_json) ? r.competitor_findings_json : [],
    competitorSourceSummary: r.competitor_source_summary || { verifiedCount: 0, manualCount: 0, inferredCount: 0 },
    psychologicalProfileJson: r.psychological_profile_json || {},
    awarenessLevel: String(r.awareness_level || ''),
    marketSophistication: Number(r.market_sophistication || 3),
    createdAt: String(r.created_at || new Date().toISOString())
  };
}

export function mapSupabaseHypothesisRow(r: Record<string, any>): StoredHypothesisRecord {
  const v = r.verdict;
  const verdict: StoredHypothesisRecord['verdict'] =
    v === 'winner' || v === 'promising' || v === 'loser' || v === 'insufficient_data' ? v : 'pending';
  return {
    id: String(r.id || ''),
    dossierId: String(r.dossier_id || ''),
    productSlug: String(r.product_slug || 'default'),
    hypothesisCode: String(r.hypothesis_code || ''),
    angleId: String(r.angle_id || ''),
    angleName: String(r.angle_name || r.big_idea || r.angle_id || ''),
    awarenessLevel: String(r.awareness_level || ''),
    marketSophistication: Number(r.market_sophistication || 3),
    targetAvatar: String(r.target_avatar || ''),
    corePain: String(r.core_pain || ''),
    deepDesire: String(r.deep_desire || ''),
    objectionTargeted: String(r.objection_targeted || ''),
    uniqueMechanismProblem: String(r.unique_mechanism_problem || ''),
    uniqueMechanismSolution: String(r.unique_mechanism_solution || ''),
    bigIdea: String(r.big_idea || ''),
    promise: String(r.promise || ''),
    proofType: String(r.proof_type || ''),
    hookFormula: String(r.hook_formula || ''),
    testVariable: String(r.test_variable || ''),
    copyFramework: String(r.copy_framework || ''),
    visualArchetype: String(r.visual_archetype || ''),
    primaryTextDraft: String(r.primary_text_draft || ''),
    headlineDraft: String(r.headline_draft || ''),
    ctaDraft: String(r.cta_draft || ''),
    aiImagePrompt: String(r.ai_image_prompt || ''),
    videoScriptPrompt: String(r.video_script_prompt || ''),
    strategicRationale: String(r.strategic_rationale || ''),
    verdict,
    createdAt: String(r.created_at || new Date().toISOString())
  };
}

export function mapSupabaseInsightRow(r: Record<string, any>): StoredMetaDailyInsight {
  const insightDate = String(r.insight_date || '');
  const adAccountId = String(r.ad_account_id || '');
  const adId = String(r.ad_id || '');
  return {
    id: `${insightDate}_${adAccountId}_${adId}`,
    insightDate,
    adAccountId,
    accountCurrency: String(r.account_currency || 'USD'),
    campaignId: r.campaign_id || undefined,
    adsetId: r.adset_id || undefined,
    adId,
    impressions: Number(r.impressions || 0),
    clicks: Number(r.clicks || 0),
    inlineLinkClicks: Number(r.inline_link_clicks || 0),
    spendRaw: Number(r.spend_raw || 0),
    spendUsd: Number(r.spend_usd || 0),
    spendPyg: Number(r.spend_pyg || 0),
    metaLeadsReported: Number(r.meta_leads_reported || 0),
    cpmUsd: Number(r.cpm_usd || 0),
    cpcUsd: Number(r.cpc_usd || 0),
    ctrPct: Number(r.ctr_pct || 0),
    rawActionsJson: Array.isArray(r.raw_actions_json) ? r.raw_actions_json : [],
    syncedAt: String(r.synced_at || new Date().toISOString())
  };
}

export function mapSupabaseLearningMemoryRow(r: Record<string, any>): StoredLearningMemoryRow {
  return {
    id: String(r.id || ''),
    productSlug: String(r.product_slug || 'default'),
    entityType: r.entity_type || 'ad',
    entityId: String(r.entity_id || ''),
    angleId: r.angle_id || undefined,
    hypothesisId: r.hypothesis_id || undefined,
    verdict: r.verdict || 'insufficient_data',
    formsCount: Number(r.forms_count || 0),
    inlineLinkClicks: Number(r.inline_link_clicks || 0),
    impressions: Number(r.impressions || 0),
    spendUsd: Number(r.spend_usd || 0),
    spendPyg: Number(r.spend_pyg || 0),
    formCvrPct: Number(r.form_cvr_pct || 0),
    cpfUsd: r.cpf_usd != null ? Number(r.cpf_usd) : null,
    cpfPyg: r.cpf_pyg != null ? Number(r.cpf_pyg) : null,
    confidenceScore: Number(r.confidence_score || 0),
    recommendedAction: String(r.recommended_action || ''),
    learnedPatternSummary: String(r.learned_pattern_summary || ''),
    updatedAt: String(r.updated_at || new Date().toISOString())
  };
}

export function mapSupabaseCostProfileRow(r: Record<string, any>): ProductCostProfile {
  return {
    id: String(r.id || ''),
    productSlug: String(r.product_slug || 'default'),
    effectiveFrom: String(r.effective_from || r.created_at || new Date().toISOString()),
    unitProductCostPyg: Number(r.unit_product_cost_pyg || 0),
    packagingCostPyg: Number(r.packaging_cost_pyg || 0),
    defaultCourierDeliveryFeePyg: Number(r.default_courier_delivery_fee_pyg || 0),
    defaultCourierReturnFeePyg: Number(r.default_courier_return_fee_pyg || 0),
    notes: r.notes || undefined,
    createdBy: r.created_by || undefined,
    createdAt: String(r.created_at || new Date().toISOString())
  };
}

export function mapSupabaseFxPeriodRow(r: Record<string, any>): FxRatePeriod {
  return {
    id: String(r.id || ''),
    effectiveFrom: String(r.effective_from || r.created_at || new Date().toISOString()),
    effectiveTo: r.effective_to || null,
    usdToPygRate: Number(r.usd_to_pyg_rate || 0),
    source: r.source === 'meta_invoice_reconciliation' ? 'meta_invoice_reconciliation' : 'manual_admin',
    metaInvoiceReference: r.meta_invoice_reference || undefined,
    metaInvoiceAmountUsd: r.meta_invoice_amount_usd != null ? Number(r.meta_invoice_amount_usd) : undefined,
    metaInvoiceAmountPyg: r.meta_invoice_amount_pyg != null ? Number(r.meta_invoice_amount_pyg) : undefined,
    createdBy: r.created_by || undefined,
    createdAt: String(r.created_at || new Date().toISOString())
  };
}

export function mapSupabaseSettlementRow(r: Record<string, any>): CourierSettlementRecord {
  return {
    id: String(r.id || ''),
    courierName: String(r.courier_name || ''),
    settlementDate: String(r.settlement_date || ''),
    referenceCode: r.reference_code || undefined,
    totalGrossCollectedPyg: Number(r.total_gross_collected_pyg || 0),
    totalCourierFeesPyg: Number(r.total_courier_fees_pyg || 0),
    totalNetTransferredPyg: Number(r.total_net_transferred_pyg || 0),
    ordersCount: Number(r.orders_count || 0),
    matchedOrderIds: Array.isArray(r.matched_order_ids_json) ? r.matched_order_ids_json : [],
    unmatchedRows: Array.isArray(r.unmatched_rows_json) ? r.unmatched_rows_json : [],
    rawSourceType: r.raw_source_type === 'csv_import' ? 'csv_import' : 'manual',
    createdBy: r.created_by || undefined,
    createdAt: String(r.created_at || new Date().toISOString())
  };
}

export function mapSupabaseCapiLogRow(r: Record<string, any>): MetaCapiDispatchEntry {
  return {
    id: r.id != null ? String(r.id) : `capi_${r.event_id}`,
    eventId: String(r.event_id || ''),
    eventName: String(r.event_name || ''),
    pedidoId: r.pedido_id ?? null,
    reservaId: r.reservaid || undefined,
    pixelId: String(r.pixel_id || ''),
    circuit: r.circuit === 'circuit_b_purchase' ? 'circuit_b_purchase' : 'circuit_a_conversion',
    status: r.status || 'queued',
    attempts: Number(r.attempts || 0),
    maxAttempts: Number(r.max_attempts || 5),
    eventTimeUnix: Number(r.event_time_unix || 0),
    payloadJson: r.payload_json || {},
    responseJson: r.response_json || null,
    lastError: r.last_error || undefined,
    nextRetryAt: r.next_retry_at || null,
    sentAt: r.sent_at || null,
    createdAt: String(r.created_at || new Date().toISOString())
  };
}

export async function hydrateAutoadsFromSupabase(options?: {
  forceRefresh?: boolean;
  ttlMs?: number;
}): Promise<{ ok: boolean; skippedOffline?: boolean; tablesLoaded: string[]; errors: string[] }> {
  const creds = getSupabaseCreds();
  if (!creds) {
    return { ok: true, skippedOffline: true, tablesLoaded: [], errors: [] };
  }

  const root = getAutoadsDataRoot();
  const cache = getOrCreateRootCache();
  const ttlMs = options?.ttlMs ?? 4000;
  if (!options?.forceRefresh && cache.lastHydratedAt > 0 && Date.now() - cache.lastHydratedAt < ttlMs) {
    return { ok: true, tablesLoaded: ['cached'], errors: cache.lastErrors };
  }

  const existing = activeHydrations.get(root);
  if (existing && !options?.forceRefresh) {
    return existing;
  }

  const runPromise = (async () => {
    await flushPendingSupabaseSyncs(3000);

    const [
      pedRes,
      attrRes,
      waRes,
      adEntRes,
      dossierRes,
      hypRes,
      insRes,
      memRes,
      costRes,
      fxRes,
      stlRes,
      capiRes,
      flagsRes
    ] = await Promise.all([
      postgrestSelect<Record<string, any>>('pedidos', 'select=*&order=fecha.desc.nullslast&limit=500'),
      postgrestSelect<Record<string, any>>('order_attribution', 'select=*&order=confirmed_form_at.desc&limit=500'),
      postgrestSelect<Record<string, any>>('wa_attribution_tokens', 'select=*&order=created_at.desc&limit=500'),
      postgrestSelect<Record<string, any>>('ad_entities', 'select=*&order=published_at.desc&limit=500'),
      postgrestSelect<Record<string, any>>('autoads_research_dossiers', 'select=*&order=created_at.desc&limit=200'),
      postgrestSelect<Record<string, any>>('autoads_hypotheses', 'select=*&order=created_at.desc&limit=600'),
      postgrestSelect<Record<string, any>>('meta_ads_daily_insights', 'select=*&order=insight_date.desc&limit=1000'),
      postgrestSelect<Record<string, any>>('autoads_learning_memory', 'select=*&order=updated_at.desc&limit=1000'),
      postgrestSelect<Record<string, any>>('product_cost_profiles', 'select=*&order=effective_from.desc&limit=500'),
      postgrestSelect<Record<string, any>>('fx_rate_periods', 'select=*&order=effective_from.desc&limit=500'),
      postgrestSelect<Record<string, any>>('courier_settlements', 'select=*&order=created_at.desc&limit=500'),
      postgrestSelect<Record<string, any>>('meta_capi_dispatch_log', 'select=*&order=created_at.desc&limit=1000'),
      postgrestSelect<{ code: string; dispositivo: string }>('codigos', 'select=code,dispositivo,creado&code=like.AAFLAGS-v2*&order=creado.desc&limit=1')
    ]);

    const tablesLoaded: string[] = [];
    const errors: string[] = [];

    const checkRes = (name: string, r: { ok: boolean; error?: string }) => {
      if (r.ok) tablesLoaded.push(name);
      else if (r.error) errors.push(`${name}: ${r.error}`);
    };

    checkRes('pedidos', pedRes);
    checkRes('order_attribution', attrRes);
    checkRes('wa_attribution_tokens', waRes);
    checkRes('ad_entities', adEntRes);
    checkRes('autoads_research_dossiers', dossierRes);
    checkRes('autoads_hypotheses', hypRes);
    checkRes('meta_ads_daily_insights', insRes);
    checkRes('autoads_learning_memory', memRes);
    checkRes('product_cost_profiles', costRes);
    checkRes('fx_rate_periods', fxRes);
    checkRes('courier_settlements', stlRes);
    checkRes('meta_capi_dispatch_log', capiRes);
    checkRes('codigos(AAFLAGS-v2)', flagsRes);

    // Preservar únicamente cola pendiente offline mientras reemplazamos lecturas desde Supabase
    const diskOrdersAttr = readJsonFile<OrdersAttributionFile>('orders_and_attribution.json', {
      orders: [],
      attributions: [],
      waTokens: [],
      cloudSyncQueue: []
    });
    const prevOrdersAttr = cache.ordersAttr || diskOrdersAttr;
    if (pedRes.ok || attrRes.ok || waRes.ok) {
      const pendingQueue = (Array.isArray(prevOrdersAttr.cloudSyncQueue) ? prevOrdersAttr.cloudSyncQueue : []).filter(
        (q) => q.status === 'pending' && q.kind === 'pedido_and_attribution' && q.payload?.order
      );
      const hydratedOrders = pedRes.ok
        ? pedRes.rows.map(mapSupabasePedidoRowToOrder).filter((o) => Boolean(o.reservaid))
        : [...prevOrdersAttr.orders];
      const hydratedAttrs = attrRes.ok
        ? attrRes.rows.map(mapSupabaseOrderAttributionRow).filter((a) => Boolean(a.reservaId))
        : [...prevOrdersAttr.attributions];

      for (const qItem of pendingQueue) {
        const qOrd = qItem.payload.order as Order;
        const qAttr = qItem.payload.attribution as StoredOrderAttribution | undefined;
        if (qOrd?.reservaid && !hydratedOrders.some((o) => o.reservaid === qOrd.reservaid)) {
          hydratedOrders.unshift(qOrd);
        }
        if (qAttr?.reservaId && !hydratedAttrs.some((a) => a.reservaId === qAttr.reservaId)) {
          hydratedAttrs.unshift(qAttr);
        }
      }

      const nextOA: OrdersAttributionFile = {
        orders: hydratedOrders,
        attributions: hydratedAttrs,
        waTokens: waRes.ok ? waRes.rows.map(mapSupabaseWaTokenRow).filter((t) => Boolean(t.token)) : prevOrdersAttr.waTokens,
        cloudSyncQueue: Array.isArray(prevOrdersAttr.cloudSyncQueue) ? prevOrdersAttr.cloudSyncQueue : []
      };
      cache.ordersAttr = nextOA;
      try {
        writeJsonFile('orders_and_attribution.json', nextOA);
      } catch {}
    }

    const diskIntel = readJsonFile<IntelligenceFile>('intelligence.json', {
      dossiers: [],
      hypotheses: [],
      adEntities: [],
      metaDailyInsights: [],
      learningMemory: []
    });
    const prevIntel = cache.intel || diskIntel;
    if (dossierRes.ok || hypRes.ok || adEntRes.ok || insRes.ok || memRes.ok) {
      const nextIntel: IntelligenceFile = {
        dossiers: dossierRes.ok ? dossierRes.rows.map(mapSupabaseDossierRow) : prevIntel.dossiers,
        hypotheses: hypRes.ok ? hypRes.rows.map(mapSupabaseHypothesisRow) : prevIntel.hypotheses,
        adEntities: adEntRes.ok ? adEntRes.rows.map(mapSupabaseAdEntityRow) : prevIntel.adEntities,
        metaDailyInsights: insRes.ok ? insRes.rows.map(mapSupabaseInsightRow) : prevIntel.metaDailyInsights,
        learningMemory: memRes.ok ? memRes.rows.map(mapSupabaseLearningMemoryRow) : prevIntel.learningMemory
      };
      cache.intel = nextIntel;
      try {
        writeJsonFile('intelligence.json', nextIntel);
      } catch {}
    }

    const diskErp = readJsonFile<ErpFinanceFile>('erp_finance.json', {
      costProfiles: [],
      fxPeriods: [],
      settlements: []
    });
    const prevErp = cache.erp || diskErp;
    if (costRes.ok || fxRes.ok || stlRes.ok) {
      const nextErp: ErpFinanceFile = {
        costProfiles: costRes.ok ? costRes.rows.map(mapSupabaseCostProfileRow) : prevErp.costProfiles,
        fxPeriods: fxRes.ok ? fxRes.rows.map(mapSupabaseFxPeriodRow) : prevErp.fxPeriods,
        settlements: stlRes.ok ? stlRes.rows.map(mapSupabaseSettlementRow) : prevErp.settlements
      };
      cache.erp = nextErp;
      try {
        writeJsonFile('erp_finance.json', nextErp);
      } catch {}
    }

    const diskCapi = readJsonFile<CapiDispatchFile>('capi_dispatch.json', { entries: [] });
    const prevCapi = cache.capi || diskCapi;
    if (capiRes.ok) {
      const nextCapi: CapiDispatchFile = {
        entries: capiRes.rows.map(mapSupabaseCapiLogRow)
      };
      cache.capi = nextCapi;
      try {
        writeJsonFile('capi_dispatch.json', nextCapi);
      } catch {}
    }

    if (flagsRes.ok && flagsRes.rows[0]?.dispositivo) {
      try {
        const parsedFlags = JSON.parse(String(flagsRes.rows[0].dispositivo));
        if (parsedFlags && typeof parsedFlags === 'object') {
          cache.flags = parsedFlags;
          try {
            writeJsonFile('feature_flags.json', parsedFlags);
          } catch {}
        }
      } catch {}
    }

    cache.lastHydratedAt = Date.now();
    cache.lastErrors = errors;
    return {
      ok: errors.length === 0,
      tablesLoaded,
      errors
    };
  })().finally(() => {
    activeHydrations.delete(root);
  });

  activeHydrations.set(root, runPromise);
  return runPromise;
}

export function getAutoadsSupabaseHealth(): {
  configured: boolean;
  lastHydratedAt: number | null;
  lastErrors: string[];
  pendingSyncCount: number;
} {
  const creds = getSupabaseCreds();
  const cache = memoryStoreCache.get(getAutoadsDataRoot());
  return {
    configured: Boolean(creds),
    lastHydratedAt: cache?.lastHydratedAt || null,
    lastErrors: cache?.lastErrors || [],
    pendingSyncCount: pendingSupabaseSyncs.size
  };
}

// ============================================================================
// FEATURE FLAGS EN TIEMPO DE EJECUCIÓN
// ============================================================================

export function getFeatureFlags(): AutoAdsFeatureFlags {
  const cache = !overrideDataRootForTests ? getOrCreateRootCache() : null;
  const persisted =
    cache?.flags || readJsonFile<Partial<AutoAdsFeatureFlags>>('feature_flags.json', {});
  const envOverrides: Partial<AutoAdsFeatureFlags> = {};
  (Object.keys(DEFAULT_FEATURE_FLAGS) as Array<keyof AutoAdsFeatureFlags>).forEach((k) => {
    const raw = getEnvValue(k);
    if (raw === 'true' || raw === '1') envOverrides[k] = true;
    else if (raw === 'false' || raw === '0') envOverrides[k] = false;
  });
  return {
    ...DEFAULT_FEATURE_FLAGS,
    ...persisted,
    ...envOverrides
  };
}

export function setFeatureFlags(patch: Partial<AutoAdsFeatureFlags>): AutoAdsFeatureFlags {
  const cache = !overrideDataRootForTests ? getOrCreateRootCache() : null;
  const current =
    cache?.flags || readJsonFile<Partial<AutoAdsFeatureFlags>>('feature_flags.json', {});
  const next = {
    ...DEFAULT_FEATURE_FLAGS,
    ...current,
    ...patch
  };
  if (cache) cache.flags = next;
  writeJsonFile('feature_flags.json', next);
  void syncFeatureFlagsToSupabase(next);
  return getFeatureFlags();
}

// ============================================================================
// ALMACÉN CONJUNTO DE PEDIDOS + ATRIBUCIÓN + TOKENS WA + COLA CLOUD
// ============================================================================

export function readOrdersAttributionState(): OrdersAttributionFile {
  const fallback: OrdersAttributionFile = {
    orders: [],
    attributions: [],
    waTokens: [],
    cloudSyncQueue: []
  };
  if (!overrideDataRootForTests) {
    const cache = getOrCreateRootCache();
    if (cache.ordersAttr) return cache.ordersAttr;
    const loaded = readJsonFile<OrdersAttributionFile>('orders_and_attribution.json', fallback);
    cache.ordersAttr = loaded;
    return loaded;
  }
  return readJsonFile<OrdersAttributionFile>('orders_and_attribution.json', fallback);
}

export function writeOrdersAttributionState(next: OrdersAttributionFile): void {
  if (!overrideDataRootForTests) {
    const cache = getOrCreateRootCache();
    cache.ordersAttr = next;
  }
  writeJsonFile('orders_and_attribution.json', next);
}

// ============================================================================
// ALMACÉN CIRCUITO A (INTELLIGENCE, HYPOTHESES, AD_ENTITIES, INSIGHTS, MEMORY)
// ============================================================================

export function readIntelligenceState(): IntelligenceFile {
  const fallback: IntelligenceFile = {
    dossiers: [],
    hypotheses: [],
    adEntities: [],
    metaDailyInsights: [],
    learningMemory: []
  };
  if (!overrideDataRootForTests) {
    const cache = getOrCreateRootCache();
    if (cache.intel) return cache.intel;
    const loaded = readJsonFile<IntelligenceFile>('intelligence.json', fallback);
    cache.intel = loaded;
    return loaded;
  }
  return readJsonFile<IntelligenceFile>('intelligence.json', fallback);
}

export function writeIntelligenceState(next: IntelligenceFile): void {
  if (!overrideDataRootForTests) {
    const cache = getOrCreateRootCache();
    cache.intel = next;
  }
  writeJsonFile('intelligence.json', next);
}

// ============================================================================
// ALMACÉN CIRCUITO B (COSTOS REALES, FX PERIODS, COURIER SETTLEMENTS)
// ============================================================================

export function readErpFinanceState(): ErpFinanceFile {
  const fallback: ErpFinanceFile = {
    costProfiles: [],
    fxPeriods: [],
    settlements: []
  };
  if (!overrideDataRootForTests) {
    const cache = getOrCreateRootCache();
    if (cache.erp) return cache.erp;
    const loaded = readJsonFile<ErpFinanceFile>('erp_finance.json', fallback);
    cache.erp = loaded;
    return loaded;
  }
  return readJsonFile<ErpFinanceFile>('erp_finance.json', fallback);
}

export function writeErpFinanceState(next: ErpFinanceFile): void {
  if (!overrideDataRootForTests) {
    const cache = getOrCreateRootCache();
    cache.erp = next;
  }
  writeJsonFile('erp_finance.json', next);
}

// ============================================================================
// ALMACÉN COLA CAPI
// ============================================================================

export function readCapiDispatchState(): CapiDispatchFile {
  const fallback: CapiDispatchFile = { entries: [] };
  if (!overrideDataRootForTests) {
    const cache = getOrCreateRootCache();
    if (cache.capi) return cache.capi;
    const loaded = readJsonFile<CapiDispatchFile>('capi_dispatch.json', fallback);
    cache.capi = loaded;
    return loaded;
  }
  return readJsonFile<CapiDispatchFile>('capi_dispatch.json', fallback);
}

export function writeCapiDispatchState(next: CapiDispatchFile): void {
  if (!overrideDataRootForTests) {
    const cache = getOrCreateRootCache();
    cache.capi = next;
  }
  writeJsonFile('capi_dispatch.json', next);
}

// ============================================================================
// ESPÍAS / VISTAS AISLADAS DE REPOSITORIO PARA VERIFICACIÓN DE AISLAMIENTO (ISO-05)
// Circuito A únicamente accede mediante `getCircuitAReadView()`, que NUNCA
// expone estado logístico, cobros, devoluciones, costos ni liquidaciones.
// ============================================================================

export interface CircuitAAccessAuditEvent {
  accessor: string;
  at: string;
}

const circuitAAccessLog: CircuitAAccessAuditEvent[] = [];

export function clearCircuitAAccessLogForTesting(): void {
  circuitAAccessLog.length = 0;
}

export function getCircuitAAccessLogForTesting(): CircuitAAccessAuditEvent[] {
  return [...circuitAAccessLog];
}

export interface CircuitASanitizedOrderView {
  reservaId: string;
  producto: string;
  confirmedFormAt: string;
  canonicalConversionEvent: 'Lead';
  attributedAdId?: string;
  attributedCampaignId?: string;
  attributedAdsetId?: string;
  attributedCreativeId?: string;
  attributedHypothesisId?: string;
  attributedAngleId?: string;
}

export function getCircuitAReadView(productSlug?: string) {
  circuitAAccessLog.push({
    accessor: 'circuit_a_intelligence_read',
    at: new Date().toISOString()
  });
  const oa = readOrdersAttributionState();
  const intel = readIntelligenceState();

  const matchesProduct = (slug?: string) =>
    !productSlug || !slug || slug.toLowerCase() === productSlug.toLowerCase();

  // IMPORTANTE: Proyectar únicamente señal canónica de formulario confirmado y atribución.
  // JAMÁS se copian estado, deliveryStatus, customerPaymentStatus, courierSettlementStatus, costos ni Purchase.
  const sanitizedConfirmedOrders: CircuitASanitizedOrderView[] = oa.orders
    .filter((o) => matchesProduct(o.productoId || o.producto))
    .map((o) => {
      const attr = oa.attributions.find((a) => a.reservaId === o.reservaid);
      return {
        reservaId: o.reservaid,
        producto: o.producto || o.productoId || 'default',
        confirmedFormAt: o.confirmedFormAt || o.fecha || new Date().toISOString(),
        canonicalConversionEvent: 'Lead',
        attributedAdId: attr?.adId || o.attributedAdId,
        attributedCampaignId: attr?.campaignId || o.attributedCampaignId,
        attributedAdsetId: attr?.adsetId || o.attributedAdsetId,
        attributedCreativeId: attr?.creativeId || o.attributedCreativeId,
        attributedHypothesisId: attr?.hypothesisId || o.attributedHypothesisId,
        attributedAngleId: attr?.angleId || o.attributedAngleId
      };
    });

  return {
    confirmedOrders: sanitizedConfirmedOrders,
    attributions: oa.attributions.filter((a) => matchesProduct(a.productSlug)),
    adEntities: intel.adEntities.filter((e) => matchesProduct(e.productSlug)),
    metaDailyInsights: [...intel.metaDailyInsights],
    learningMemory: intel.learningMemory.filter((m) => matchesProduct(m.productSlug)),
    hypotheses: intel.hypotheses.filter((h) => matchesProduct(h.productSlug)),
    dossiers: intel.dossiers.filter((d) => matchesProduct(d.productSlug))
  };
}
