import crypto from 'node:crypto';
import type {
  CourierSettlementRecord,
  ErpProfitabilitySummary,
  FxRatePeriod,
  Order,
  ProductCostProfile
} from '../src/types.ts';
import {
  postgrestUpsert,
  readErpFinanceState,
  readIntelligenceState,
  readOrdersAttributionState,
  writeErpFinanceState,
  writeOrdersAttributionState
} from './autoadsStore.ts';
import { applyOrderAxisUpdate, normalizeParaguayPhone } from './attributionAndOrders.ts';

export function saveProductCostProfile(input: {
  productSlug: string;
  unitProductCostPyg: number;
  packagingCostPyg?: number;
  defaultCourierDeliveryFeePyg?: number;
  defaultCourierReturnFeePyg?: number;
  effectiveFrom?: string;
  notes?: string;
  createdBy?: string;
}): ProductCostProfile {
  if (!Number.isFinite(input.unitProductCostPyg) || input.unitProductCostPyg < 0) {
    throw new Error('unitProductCostPyg real requerido (>= 0)');
  }
  const nowIso = new Date().toISOString();
  const profile: ProductCostProfile = {
    id: `cost_${crypto.randomBytes(5).toString('hex')}`,
    productSlug: String(input.productSlug || '').trim(),
    effectiveFrom: input.effectiveFrom || nowIso,
    unitProductCostPyg: Math.round(input.unitProductCostPyg),
    packagingCostPyg: Math.round(Number(input.packagingCostPyg || 0)),
    defaultCourierDeliveryFeePyg: Math.round(Number(input.defaultCourierDeliveryFeePyg || 0)),
    defaultCourierReturnFeePyg: Math.round(Number(input.defaultCourierReturnFeePyg || 0)),
    notes: input.notes,
    createdBy: input.createdBy || 'admin',
    createdAt: nowIso
  };
  const state = readErpFinanceState();
  state.costProfiles.unshift(profile);
  writeErpFinanceState(state);

  void postgrestUpsert(
    'product_cost_profiles',
    {
      id: profile.id,
      product_slug: profile.productSlug,
      effective_from: profile.effectiveFrom,
      unit_product_cost_pyg: profile.unitProductCostPyg,
      packaging_cost_pyg: profile.packagingCostPyg,
      default_courier_delivery_fee_pyg: profile.defaultCourierDeliveryFeePyg,
      default_courier_return_fee_pyg: profile.defaultCourierReturnFeePyg,
      notes: profile.notes || null,
      created_by: profile.createdBy || 'admin',
      created_at: profile.createdAt
    },
    'id'
  );
  return profile;
}

export function listProductCostProfiles(productSlug?: string): ProductCostProfile[] {
  const state = readErpFinanceState();
  return state.costProfiles.filter(
    (c) => !productSlug || c.productSlug.toLowerCase() === productSlug.toLowerCase()
  );
}

export function findCostProfileForOrder(
  productSlug: string,
  orderDateIso?: string
): ProductCostProfile | null {
  const state = readErpFinanceState();
  const candidates = state.costProfiles
    .filter((c) => c.productSlug.toLowerCase() === String(productSlug || '').toLowerCase())
    .sort((a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom));
  if (candidates.length === 0) return null;
  const ordTs = orderDateIso ? Date.parse(orderDateIso) : Date.now();
  const matched = candidates.find((c) => Date.parse(c.effectiveFrom) <= ordTs);
  return matched || candidates[candidates.length - 1];
}

export function saveFxRatePeriod(input: {
  usdToPygRate?: number;
  source?: 'manual_admin' | 'meta_invoice_reconciliation';
  effectiveFrom?: string;
  effectiveTo?: string | null;
  metaInvoiceReference?: string;
  metaInvoiceAmountUsd?: number;
  metaInvoiceAmountPyg?: number;
  createdBy?: string;
}): FxRatePeriod {
  let computedRate = Number(input.usdToPygRate || 0);
  if (
    input.source === 'meta_invoice_reconciliation' &&
    Number(input.metaInvoiceAmountUsd) > 0 &&
    Number(input.metaInvoiceAmountPyg) > 0
  ) {
    computedRate = Number(input.metaInvoiceAmountPyg) / Number(input.metaInvoiceAmountUsd);
  }
  if (!Number.isFinite(computedRate) || computedRate <= 100) {
    throw new Error('Tipo de cambio USD->PYG inválido (requiere tasa válida o factura real USD/PYG).');
  }
  const nowIso = new Date().toISOString();
  const period: FxRatePeriod = {
    id: `fx_${crypto.randomBytes(5).toString('hex')}`,
    effectiveFrom: input.effectiveFrom || nowIso,
    effectiveTo: input.effectiveTo || null,
    usdToPygRate: Number(computedRate.toFixed(2)),
    source: input.source || 'manual_admin',
    metaInvoiceReference: input.metaInvoiceReference,
    metaInvoiceAmountUsd: input.metaInvoiceAmountUsd,
    metaInvoiceAmountPyg: input.metaInvoiceAmountPyg,
    createdBy: input.createdBy || 'admin',
    createdAt: nowIso
  };

  const state = readErpFinanceState();
  state.fxPeriods.unshift(period);
  writeErpFinanceState(state);

  void postgrestUpsert(
    'fx_rate_periods',
    {
      id: period.id,
      effective_from: period.effectiveFrom,
      effective_to: period.effectiveTo || null,
      usd_to_pyg_rate: period.usdToPygRate,
      source: period.source,
      meta_invoice_reference: period.metaInvoiceReference || null,
      meta_invoice_amount_usd: period.metaInvoiceAmountUsd ?? null,
      meta_invoice_amount_pyg: period.metaInvoiceAmountPyg ?? null,
      created_by: period.createdBy || 'admin',
      created_at: period.createdAt
    },
    'id'
  );

  return period;
}

export function getEffectiveFxRate(referenceIso?: string): {
  usdToPygRate: number;
  source: string;
  isConfigured: boolean;
} {
  const state = readErpFinanceState();
  const sorted = [...state.fxPeriods].sort(
    (a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom)
  );
  if (sorted.length === 0) {
    return { usdToPygRate: 7800, source: 'fallback_sin_configurar', isConfigured: false };
  }
  const ts = referenceIso ? Date.parse(referenceIso) : Date.now();
  const active =
    sorted.find((p) => {
      const from = Date.parse(p.effectiveFrom);
      const to = p.effectiveTo ? Date.parse(p.effectiveTo) : Infinity;
      return ts >= from && ts <= to;
    }) || sorted[0];
  return {
    usdToPygRate: active.usdToPygRate,
    source: active.source,
    isConfigured: true
  };
}

export function recordCourierSettlement(input: {
  courierName: string;
  settlementDate?: string;
  referenceCode?: string;
  rawSourceType?: 'manual' | 'csv_import';
  createdBy?: string;
  rows: Array<{
    reservaId?: string;
    phone?: string;
    grossCollectedPyg: number;
    courierFeePyg: number;
    deliveryOutcome?: 'entregado_fisicamente' | 'devuelto';
  }>;
}): CourierSettlementRecord {
  const settlementId = `stl_${crypto.randomBytes(5).toString('hex')}`;
  const nowIso = new Date().toISOString();
  const settlementDate = input.settlementDate || nowIso.slice(0, 10);

  const oaState = readOrdersAttributionState();
  const matchedOrderIds: string[] = [];
  const unmatchedRows: CourierSettlementRecord['unmatchedRows'] = [];

  let totalGross = 0;
  let totalFees = 0;

  for (const row of input.rows) {
    const gross = Math.max(0, Math.round(Number(row.grossCollectedPyg || 0)));
    const fee = Math.max(0, Math.round(Number(row.courierFeePyg || 0)));
    const phoneNorm = normalizeParaguayPhone(row.phone);

    const matchedOrder = oaState.orders.find(
      (o) =>
        (row.reservaId && o.reservaid.toLowerCase() === row.reservaId.trim().toLowerCase()) ||
        (phoneNorm && normalizeParaguayPhone(o.celular) === phoneNorm)
    );

    if (!matchedOrder) {
      unmatchedRows.push({
        reservaId: row.reservaId,
        phone: row.phone,
        amountPyg: gross,
        feePyg: fee,
        reason: 'Pedido no encontrado por reservaid ni celular'
      });
      continue;
    }

    const isReturned = row.deliveryOutcome === 'devuelto';
    const expectedPrice = Number(matchedOrder.monto || 0);
    const hasDiscrepancy = !isReturned && gross > 0 && Math.abs(gross - expectedPrice) > 1000;

    applyOrderAxisUpdate({
      reservaIdOrOrderId: matchedOrder.reservaid,
      deliveryStatus: isReturned ? 'devuelto' : 'entregado_fisicamente',
      customerPaymentStatus: isReturned ? 'fallido_o_rechazado' : 'cobrado_verificado',
      courierSettlementStatus: hasDiscrepancy ? 'discrepancia' : 'liquidado_en_lote',
      netCashCollectedPyg: Math.max(0, gross - fee),
      courierFeePyg: fee,
      courierSettlementId: settlementId,
      returnCostPyg: isReturned ? fee : undefined
    });

    matchedOrderIds.push(matchedOrder.reservaid);
    totalGross += gross;
    totalFees += fee;
  }

  const record: CourierSettlementRecord = {
    id: settlementId,
    courierName: input.courierName.trim() || 'Courier COD',
    settlementDate,
    referenceCode: input.referenceCode,
    totalGrossCollectedPyg: totalGross,
    totalCourierFeesPyg: totalFees,
    totalNetTransferredPyg: Math.max(0, totalGross - totalFees),
    ordersCount: matchedOrderIds.length,
    matchedOrderIds,
    unmatchedRows,
    rawSourceType: input.rawSourceType || 'manual',
    createdBy: input.createdBy || 'admin',
    createdAt: nowIso
  };

  const erp = readErpFinanceState();
  erp.settlements.unshift(record);
  writeErpFinanceState(erp);

  void postgrestUpsert(
    'courier_settlements',
    {
      id: record.id,
      courier_name: record.courierName,
      settlement_date: record.settlementDate,
      reference_code: record.referenceCode || null,
      total_gross_collected_pyg: record.totalGrossCollectedPyg,
      total_courier_fees_pyg: record.totalCourierFeesPyg,
      total_net_transferred_pyg: record.totalNetTransferredPyg,
      orders_count: record.ordersCount,
      matched_order_ids_json: record.matchedOrderIds,
      unmatched_rows_json: record.unmatchedRows,
      raw_source_type: record.rawSourceType,
      created_by: record.createdBy || 'admin',
      created_at: record.createdAt
    },
    'id'
  );

  return record;
}

export function importCourierSettlementCsv(params: {
  courierName: string;
  settlementDate?: string;
  referenceCode?: string;
  csvText: string;
  createdBy?: string;
}): CourierSettlementRecord {
  const lines = String(params.csvText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('El archivo CSV/planilla está vacío.');
  }

  const delimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const splitLine = (line: string) => line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
  const firstCols = splitLine(lines[0]).map((c) => c.toLowerCase());
  const hasHeader =
    firstCols.some((c) => c.includes('reserva') || c.includes('pedido') || c.includes('monto') || c.includes('tel'));

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const idxReserva = hasHeader ? firstCols.findIndex((c) => c.includes('reserva') || c.includes('id')) : 0;
  const idxPhone = hasHeader ? firstCols.findIndex((c) => c.includes('tel') || c.includes('cel')) : 1;
  const idxGross = hasHeader ? firstCols.findIndex((c) => c.includes('monto') || c.includes('cobro') || c.includes('importe')) : 2;
  const idxFee = hasHeader ? firstCols.findIndex((c) => c.includes('comis') || c.includes('envio') || c.includes('flete') || c.includes('fee')) : 3;
  const idxOutcome = hasHeader ? firstCols.findIndex((c) => c.includes('estado') || c.includes('resultado')) : 4;

  const parseNum = (raw?: string) => Number(String(raw || '0').replace(/[^\d.-]/g, '')) || 0;

  const parsedRows = dataLines.map((line) => {
    const cols = splitLine(line);
    const outcomeRaw = String(cols[idxOutcome >= 0 ? idxOutcome : 4] || '').toLowerCase();
    return {
      reservaId: cols[idxReserva >= 0 ? idxReserva : 0] || undefined,
      phone: cols[idxPhone >= 0 ? idxPhone : 1] || undefined,
      grossCollectedPyg: parseNum(cols[idxGross >= 0 ? idxGross : 2]),
      courierFeePyg: parseNum(cols[idxFee >= 0 ? idxFee : 3]),
      deliveryOutcome: (outcomeRaw.includes('dev') || outcomeRaw.includes('rech')
        ? 'devuelto'
        : 'entregado_fisicamente') as 'entregado_fisicamente' | 'devuelto'
    };
  });

  return recordCourierSettlement({
    courierName: params.courierName,
    settlementDate: params.settlementDate,
    referenceCode: params.referenceCode,
    rawSourceType: 'csv_import',
    createdBy: params.createdBy,
    rows: parsedRows
  });
}

export function computeAuditedErpProfitability(params: {
  productSlug?: string;
}): ErpProfitabilitySummary {
  const oa = readOrdersAttributionState();
  const intel = readIntelligenceState();
  const slugFilter = params.productSlug?.trim().toLowerCase();

  const orders: Order[] = oa.orders.filter(
    (o) =>
      !slugFilter ||
      String(o.productoId || o.producto || '').toLowerCase() === slugFilter ||
      String(o.producto || '').toLowerCase() === slugFilter
  );

  const fxInfo = getEffectiveFxRate();
  const auditWarnings: string[] = [];
  if (!fxInfo.isConfigured) {
    auditWarnings.push('FX USD->PYG no configurado manualmente todavía (usando referencia Gs. 7.800).');
  }

  let deliveredAndCollectedCount = 0;
  let pendingCourierCount = 0;
  let returnedOrCancelledCount = 0;
  let grossCollectedPyg = 0;
  let settledCashPyg = 0;
  let packagingTotalPyg = 0;
  let courierFeesTotalPyg = 0;
  let returnFeesTotalPyg = 0;
  let purchaseCapiSentCount = 0;
  let purchaseCapiSkippedWindowCount = 0;
  let purchaseCapiPendingCount = 0;

  let totalRealCogs = 0;
  let missingRealCostCount = 0;
  let unsettledDeliveredCount = 0;

  for (const ord of orders) {
    if (ord.purchaseCapiStatus === 'sent') purchaseCapiSentCount++;
    else if (ord.purchaseCapiStatus === 'skipped_window_expired_erp_only') purchaseCapiSkippedWindowCount++;
    else if (ord.purchaseCapiStatus && ord.purchaseCapiStatus !== 'no_elegible') purchaseCapiPendingCount++;

    const isDeliveredAndPaid =
      ord.deliveryStatus === 'entregado_fisicamente' &&
      ord.customerPaymentStatus === 'cobrado_verificado';
    const isReturnedOrCancelled =
      ord.deliveryStatus === 'devuelto' ||
      ord.deliveryStatus === 'cancelado' ||
      ord.estado === 'cancelado';

    const profile = findCostProfileForOrder(ord.productoId || ord.producto || '', ord.fecha || ord.confirmedFormAt);

    if (isDeliveredAndPaid) {
      deliveredAndCollectedCount++;
      grossCollectedPyg += Number(ord.monto || 0);

      if (ord.courierSettlementStatus === 'liquidado_en_lote') {
        settledCashPyg += Number(
          ord.netCashCollectedPyg !== undefined ? ord.netCashCollectedPyg : ord.monto || 0
        );
      } else {
        unsettledDeliveredCount++;
      }

      const unitCost =
        ord.productUnitCostPyg !== undefined
          ? Number(ord.productUnitCostPyg)
          : profile?.unitProductCostPyg;

      if (unitCost === undefined || unitCost === null) {
        missingRealCostCount++;
      } else {
        totalRealCogs += unitCost * Math.max(1, Number(ord.cantidad || 1));
      }

      packagingTotalPyg +=
        ord.packagingCostPyg !== undefined
          ? Number(ord.packagingCostPyg)
          : Number(profile?.packagingCostPyg || 0);

      courierFeesTotalPyg +=
        ord.courierFeePyg !== undefined
          ? Number(ord.courierFeePyg)
          : Number(profile?.defaultCourierDeliveryFeePyg || 0);
    } else if (isReturnedOrCancelled) {
      returnedOrCancelledCount++;
      returnFeesTotalPyg +=
        ord.returnCostPyg !== undefined
          ? Number(ord.returnCostPyg)
          : ord.deliveryStatus === 'devuelto'
            ? Number(profile?.defaultCourierReturnFeePyg || 0)
            : 0;
    } else {
      pendingCourierCount++;
    }
  }

  // Gasto publicitario del periodo desde insights (convertido con FX real del periodo)
  let adSpendUsd = 0;
  for (const ins of intel.metaDailyInsights) {
    adSpendUsd += ins.spendUsd;
  }
  const adSpendPyg = Math.round(adSpendUsd * fxInfo.usdToPygRate);

  if (missingRealCostCount > 0) {
    auditWarnings.push(
      `Faltan costos unitarios reales en ${missingRealCostCount} pedido(s) entregados/cobrados. Cargá product_cost_profiles antes de emitir utilidad neta.`
    );
  }
  if (unsettledDeliveredCount > 0) {
    auditWarnings.push(
      `${unsettledDeliveredCount} pedido(s) entregados y cobrados siguen pendientes de liquidación bancaria del courier.`
    );
  }

  const hasMissingCosts = missingRealCostCount > 0;
  const auditStatus: ErpProfitabilitySummary['auditStatus'] = hasMissingCosts
    ? 'faltan_costos_reales'
    : unsettledDeliveredCount > 0
      ? 'pendiente_liquidacion_courier'
      : 'auditado_completo';

  // PROHIBIDO inventar utilidades si faltan costos reales del producto
  const auditedNetProfitPyg = hasMissingCosts
    ? null
    : Math.round(
        grossCollectedPyg -
          totalRealCogs -
          packagingTotalPyg -
          courierFeesTotalPyg -
          returnFeesTotalPyg -
          adSpendPyg
      );

  return {
    auditStatus,
    auditWarnings,
    totalOrdersCount: orders.length,
    deliveredAndCollectedCount,
    pendingCourierCount,
    returnedOrCancelledCount,
    grossCollectedPyg: Math.round(grossCollectedPyg),
    settledCashPyg: Math.round(settledCashPyg),
    productCogsPyg: hasMissingCosts ? null : Math.round(totalRealCogs),
    packagingTotalPyg: Math.round(packagingTotalPyg),
    courierFeesTotalPyg: Math.round(courierFeesTotalPyg),
    returnFeesTotalPyg: Math.round(returnFeesTotalPyg),
    adSpendUsd: Number(adSpendUsd.toFixed(4)),
    adSpendPyg,
    fxRateUsed: fxInfo.usdToPygRate,
    fxSource: fxInfo.source,
    auditedNetProfitPyg,
    purchaseCapiSentCount,
    purchaseCapiSkippedWindowCount,
    purchaseCapiPendingCount
  };
}
