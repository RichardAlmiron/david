import type {
  Order,
  ProductPage,
  WaCommercialPackKey,
  WaCommercialStageId,
  WaStageCommercialAsset,
  ProductWaStageCommercialMap
} from '../types';

export interface WaCommercialStageDefinition {
  id: WaCommercialStageId;
  stepBadge: string;
  shortTitle: string;
  triggerDescription: string;
  audioCongruenceNote: string;
  accentHex: string;
  secondaryHex: string;
}

export const WA_COMMERCIAL_STAGES: WaCommercialStageDefinition[] = [
  {
    id: 'stage1_welcome',
    stepBadge: 'Comercial Único · Paquete Adquirido',
    shortTitle: 'Presentación Oficial del Paquete Reservado',
    triggerDescription: 'Única imagen comercial del pedido: muestra el paquete exacto adquirido (Pack 1, Pack 2 o Pack 3) con su precio oficial enmarcado junto al primer audio.',
    audioCongruenceNote: 'Acompaña el primer audio de bienvenida y confirmación express sin texto redundante.',
    accentHex: '#10b981',
    secondaryHex: '#e8b23a'
  }
];

export const WA_COMMERCIAL_PACKS: Array<{
  packQty: 1 | 2 | 3;
  packKey: WaCommercialPackKey;
  label: string;
  shortTag: string;
}> = [
  { packQty: 1, packKey: 'pack1', label: 'Pack 1 Unidad', shortTag: '1X Individual' },
  { packQty: 2, packKey: 'pack2', label: 'Pack 2 Unidades', shortTag: '2X Dúo Ahorro' },
  { packQty: 3, packKey: 'pack3', label: 'Pack 3 Unidades', shortTag: '3X Pack Mayorista' }
];

export function formatGuaraniesCompact(amountGs: number): string {
  const clean = Math.max(0, Math.round(Number(amountGs) || 0));
  const dotted = clean.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Gs. ${dotted}`;
}

export function packQtyToKey(packQty: number): WaCommercialPackKey {
  if (packQty === 2) return 'pack2';
  if (packQty >= 3) return 'pack3';
  return 'pack1';
}

export interface ResolvedCommercialPackAndPrice {
  unitCount: number;
  catalogTierQty: 1 | 2 | 3;
  packKey: WaCommercialPackKey;
  isCustomQuantity: boolean;
  packTitleUpper: string;
  packBadgeCode: string;
  packVisualUnitsCount: 1 | 2 | 3;
  officialPriceGs: number;
  officialPriceFormatted: string;
  normalStrikePriceGs: number;
  normalStrikeFormatted: string;
  savingsGs: number;
  savingsFormatted: string;
  productDisplayName: string;
}

export interface MinimalProductPricingInput {
  id?: string;
  nombre?: string;
  imagen?: string;
  precioNormal?: number;
  precios?: Record<number, number>;
  waStageCommercials?: ProductWaStageCommercialMap;
  waStageCommercialsEnabled?: boolean;
}

function parseCleanPositiveInt(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw));
  }
  if (typeof raw === 'string') {
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) return 0;
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
  }
  return 0;
}

export function getCatalogPackPrices(product?: MinimalProductPricingInput | null): {
  1: number;
  2: number;
  3: number;
  normalUnit: number;
} {
  const p1 = parseCleanPositiveInt(product?.precios?.[1]) || 189000;
  const p2 = parseCleanPositiveInt(product?.precios?.[2]) || Math.max(p1 + 50000, Math.round((p1 * 1.74) / 1000) * 1000);
  const p3 = parseCleanPositiveInt(product?.precios?.[3]) || Math.max(p2 + 50000, Math.round((p1 * 2.38) / 1000) * 1000);
  const normalRaw = parseCleanPositiveInt(product?.precioNormal);
  const normalUnit = normalRaw > p1 ? normalRaw : Math.round((p1 * 1.35) / 1000) * 1000;
  return { 1: p1, 2: p2, 3: p3, normalUnit };
}

/**
 * Resuelve matemáticamente y sin ambigüedad la cantidad exacta adquirida (Pack 1, Pack 2, Pack 3 o N unidades)
 * y el precio exacto a enmarcar. Impide que un cliente que solicitó Pack 3 reciba jamás una imagen de Pack 1.
 */
export function resolveOrderCommercialPackAndPrice(
  orderOrPackQty: Partial<Order> | number,
  product?: MinimalProductPricingInput | null
): ResolvedCommercialPackAndPrice {
  const catalog = getCatalogPackPrices(product);
  const cleanProductName = String(
    product?.nombre ||
      (typeof orderOrPackQty === 'object' && orderOrPackQty?.producto ? orderOrPackQty.producto : '') ||
      'Producto Oficial'
  )
    .replace(/\s*\(Ángulo\s*#\d+\)/gi, '')
    .trim();

  let unitCount = 1;
  let officialPriceGs = catalog[1];

  if (typeof orderOrPackQty === 'number') {
    unitCount = Math.max(1, Math.round(orderOrPackQty));
    if (unitCount === 1) officialPriceGs = catalog[1];
    else if (unitCount === 2) officialPriceGs = catalog[2];
    else if (unitCount === 3) officialPriceGs = catalog[3];
    else officialPriceGs = catalog[3] + (unitCount - 3) * Math.round(catalog[1] * 0.75);
  } else {
    const rawQty = parseCleanPositiveInt(orderOrPackQty?.cantidad);
    const rawMonto = parseCleanPositiveInt(orderOrPackQty?.monto);

    if (rawQty >= 1) {
      unitCount = rawQty;
    } else if (rawMonto > 0) {
      // Si por alguna razón un lead vino sin cantidad numérica pero con el monto exacto de un pack, deducir con exactitud
      if (rawMonto === catalog[3]) unitCount = 3;
      else if (rawMonto === catalog[2]) unitCount = 2;
      else unitCount = 1;
    } else {
      unitCount = 1;
    }

    if (rawMonto > 0) {
      officialPriceGs = rawMonto;
    } else if (unitCount === 1) {
      officialPriceGs = catalog[1];
    } else if (unitCount === 2) {
      officialPriceGs = catalog[2];
    } else if (unitCount === 3) {
      officialPriceGs = catalog[3];
    } else {
      officialPriceGs = catalog[3] + (unitCount - 3) * Math.round(catalog[1] * 0.75);
    }
  }

  const catalogTierQty: 1 | 2 | 3 = unitCount === 1 ? 1 : unitCount === 2 ? 2 : 3;
  const packKey = packQtyToKey(unitCount);
  const isCustomQuantity = unitCount > 3;
  const packVisualUnitsCount: 1 | 2 | 3 = catalogTierQty;

  const packTitleUpper =
    unitCount === 1 ? 'PACK 1 UNIDAD' : `PACK ${unitCount} UNIDADES`;
  const packBadgeCode = `${unitCount}X`;

  const normalStrikePriceGs = Math.max(
    officialPriceGs + 30000,
    catalog.normalUnit * unitCount
  );
  const savingsGs = Math.max(0, normalStrikePriceGs - officialPriceGs);

  return {
    unitCount,
    catalogTierQty,
    packKey,
    isCustomQuantity,
    packTitleUpper,
    packBadgeCode,
    packVisualUnitsCount,
    officialPriceGs,
    officialPriceFormatted: formatGuaraniesCompact(officialPriceGs),
    normalStrikePriceGs,
    normalStrikeFormatted: formatGuaraniesCompact(normalStrikePriceGs),
    savingsGs,
    savingsFormatted: formatGuaraniesCompact(savingsGs),
    productDisplayName: cleanProductName
  };
}

/**
 * Verifica que un activo comercial guardado coincida 100% en etapa, cantidad de unidades del pack y precio enmarcado.
 * Si el cliente pidió Pack 3 (o se actualizó el precio), rechaza cualquier imagen de Pack 1 o con precio desactualizado.
 */
export function isSavedCommercialAssetExactMatch(
  asset: WaStageCommercialAsset | undefined | null,
  stageId: WaCommercialStageId,
  resolved: ResolvedCommercialPackAndPrice
): boolean {
  if (!asset || !asset.imageUrl) return false;
  if (asset.stageId !== stageId) return false;
  if (Number(asset.packQty) !== resolved.unitCount) return false;
  if (Number(asset.framedPriceGs) !== resolved.officialPriceGs) return false;
  return true;
}

export interface StageCommercialCopySpec {
  stageId: WaCommercialStageId;
  packKey: WaCommercialPackKey;
  packQty: number;
  topRibbon: string;
  headline: string;
  subheadline: string;
  priceFrameLabel: string;
  framedPrimaryPriceText: string;
  framedSecondaryPriceText: string;
  ctaBannerText: string;
  whatsappCaption: string;
  openRouterPrompt: string;
}

export function buildStageCommercialCopyAndPrompt(
  stageId: WaCommercialStageId,
  resolved: ResolvedCommercialPackAndPrice,
  productDescription = ''
): StageCommercialCopySpec {
  const {
    unitCount,
    packKey,
    packTitleUpper,
    officialPriceFormatted,
    normalStrikeFormatted,
    productDisplayName
  } = resolved;

  const visualUnitsPhraseEn =
    unitCount === 1
      ? 'EXACTLY ONE (1) single unit of the product prominently displayed center-stage'
      : unitCount === 2
      ? 'EXACTLY TWO (2) identical units of the product displayed side-by-side together as a double bundle pack'
      : `EXACTLY THREE (3) identical units of the product arranged together as a triple family/wholesale pack`;

  const cleanDesc = String(productDescription || productDisplayName).slice(0, 180);

  if (stageId === 'stage1_welcome') {
    return {
      stageId,
      packKey,
      packQty: unitCount,
      topRibbon: `RESERVA OFICIAL · ${packTitleUpper} · ENVÍO GRATIS`,
      headline: `${productDisplayName}`,
      subheadline: `Tu ${unitCount === 1 ? 'paquete de 1 unidad' : `paquete de ${unitCount} unidades`} ya está reservado para entrega`,
      priceFrameLabel: `${packTitleUpper} · PAGO CONTRA ENTREGA`,
      framedPrimaryPriceText: officialPriceFormatted,
      framedSecondaryPriceText: `Antes ${normalStrikeFormatted} · Garantía Oficial`,
      ctaBannerText: 'RESPONDÉ "CORRECTO" PARA CONFIRMAR',
      whatsappCaption: '',
      openRouterPrompt: `Commercial studio product photography for "${productDisplayName}" (${cleanDesc}). Show ${visualUnitsPhraseEn} on a sleek dark emerald and warm gold illuminated tabletop podium, luxury e-commerce advertisement lighting, ultra-sharp 8k product focus, clean upper and lower margins, no text, no numbers, no watermarks.`
    };
  }

  if (stageId === 'stage2_warning') {
    return {
      stageId,
      packKey,
      packQty: unitCount,
      topRibbon: `AVISO DE DESPACHO · ${packTitleUpper}`,
      headline: `¡Tu ${packTitleUpper.toLowerCase()} sigue en espera!`,
      subheadline: `No pudimos validar tu envío de ${productDisplayName} todavía`,
      priceFrameLabel: `RESERVADO: ${packTitleUpper}`,
      framedPrimaryPriceText: officialPriceFormatted,
      framedSecondaryPriceText: `Sin adelantos · Abonás en tu puerta`,
      ctaBannerText: 'RESPONDÉ "CORRECTO" POR FAVOR PARA DESPACHAR',
      whatsappCaption: '',
      openRouterPrompt: `Warm, trustworthy Latin American e-commerce logistics coordinator wearing a clean corporate polo and headset in a modern parcel dispatch center, kindly gesturing toward ${visualUnitsPhraseEn} of "${productDisplayName}" (${cleanDesc}) ready on the packing counter, cinematic warm rim lighting, photorealistic editorial 8k, no text, no numbers, no watermarks.`
    };
  }

  // stage3_confirmed
  return {
    stageId,
    packKey,
    packQty: unitCount,
    topRibbon: `ORDEN CONFIRMADA · PASA A EMPAQUETADO`,
    headline: `${productDisplayName} Confirmado`,
    subheadline: `Preparando ${unitCount === 1 ? 'tu unidad reservada' : `tus ${unitCount} unidades reservadas`} para salida con courier`,
    priceFrameLabel: `TOTAL CONFIRMADO · ${packTitleUpper}`,
    framedPrimaryPriceText: officialPriceFormatted,
    framedSecondaryPriceText: `Entrega 48 a 72 hs · Cobro en puerta`,
    ctaBannerText: 'ORDEN SELLADA · PAGÁS AL RECIBIR EN TU DOMICILIO',
    whatsappCaption: '',
    openRouterPrompt: `Premium e-commerce fulfillment station close-up featuring ${visualUnitsPhraseEn} of "${productDisplayName}" (${cleanDesc}) undergoing final quality verification next to a neat parcel box on a sleek dark slate counter with subtle emerald ambient lighting, photorealistic 8k commercial photography, no text, no numbers, no watermarks.`
  };
}

export function buildDynamicCommercialCardUrl(params: {
  productId: string;
  stageId: WaCommercialStageId;
  packQty: number;
  priceGs: number;
  voiceGender?: 'Femenina' | 'Masculina';
  cacheBust?: string | number;
}): string {
  const qs = new URLSearchParams({
    productId: String(params.productId || 'default'),
    stage: params.stageId,
    pack: String(Math.max(1, Math.round(params.packQty || 1))),
    price: String(Math.max(0, Math.round(params.priceGs || 0)))
  });
  if (params.voiceGender) {
    qs.set('gender', params.voiceGender);
  }
  if (params.cacheBust !== undefined) {
    qs.set('v', String(params.cacheBust));
  }
  return `/api/whatsapp/stage-commercials/card.jpg?${qs.toString()}`;
}

export function buildFullProductCommercialMatrixSpecs(
  product: MinimalProductPricingInput & { descripcion?: string }
): Array<{
  stage: WaCommercialStageDefinition;
  packQty: 1 | 2 | 3;
  packKey: WaCommercialPackKey;
  resolved: ResolvedCommercialPackAndPrice;
  copy: StageCommercialCopySpec;
  savedAsset?: WaStageCommercialAsset;
  effectiveImageUrl: string;
  isExactSavedMatch: boolean;
}> {
  const items: Array<{
    stage: WaCommercialStageDefinition;
    packQty: 1 | 2 | 3;
    packKey: WaCommercialPackKey;
    resolved: ResolvedCommercialPackAndPrice;
    copy: StageCommercialCopySpec;
    savedAsset?: WaStageCommercialAsset;
    effectiveImageUrl: string;
    isExactSavedMatch: boolean;
  }> = [];

  for (const stage of WA_COMMERCIAL_STAGES) {
    for (const pack of WA_COMMERCIAL_PACKS) {
      const resolved = resolveOrderCommercialPackAndPrice(pack.packQty, product);
      const copy = buildStageCommercialCopyAndPrompt(
        stage.id,
        resolved,
        product.descripcion || ''
      );
      const savedAsset = product.waStageCommercials?.[stage.id]?.[pack.packKey];
      const exactMatch = isSavedCommercialAssetExactMatch(savedAsset, stage.id, resolved);
      const effectiveImageUrl =
        exactMatch && savedAsset?.imageUrl
          ? savedAsset.imageUrl
          : buildDynamicCommercialCardUrl({
              productId: product.id || 'default',
              stageId: stage.id,
              packQty: pack.packQty,
              priceGs: resolved.officialPriceGs
            });

      items.push({
        stage,
        packQty: pack.packQty,
        packKey: pack.packKey,
        resolved,
        copy,
        savedAsset: exactMatch ? savedAsset : undefined,
        effectiveImageUrl,
        isExactSavedMatch: exactMatch
      });
    }
  }

  return items;
}

/**
 * Regla de Imagen Única: solamente existe 1 imagen comercial espectacular por paquete al inicio del pedido (`stage1_welcome`).
 * En los turnos posteriores nunca se envían imágenes adicionales (solo notas de voz + texto de ubicación/alias).
 */
export function resolvePostTurnCommercialStage(
  _order: Partial<Order> | null | undefined,
  _convStep: number
): WaCommercialStageId | null {
  return null;
}

