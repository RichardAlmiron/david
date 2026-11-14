import type { ProductPage } from '../types';

export interface QuickCreatorCloneContext {
  sourceProductId: string;
  sourceProductName: string;
  sourceSlug: string;
  sourceMode: 'dual_tripwire_winner' | 'principal_only';
  sourceDescription?: string;
  sourceWinnerAngle?: string;
  sourceEntryProductName?: string;
  sourceContextoIA?: string;
  differentiationNote?: string;
}

export interface QuickCreatorClonePayload {
  suggestedMode: 'dual_tripwire_winner' | 'principal_only';
  productName: string;
  winnerAngle: string;
  productDescription: string;
  normalPriceGs: number;
  price1Gs: number;
  price2Gs: number;
  price3Gs: number;
  productImageInput: string;
  waNumber: string;
  entrySourceUrl: string;
  entryProductName: string;
  entryProductDescription: string;
  entryPriceGs: number;
  entryNormalPriceGs: number;
  entryDeliveryFeeGs: number;
  entryProductImageInput: string;
  instantDiscountPercent: number;
  eventDurationHours: number;
  slotsTotal: number;
  backgroundMusicPreset: 'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none';
  clonedFromContext: QuickCreatorCloneContext;
}

export function isProductCloneable(page: ProductPage | null | undefined): page is ProductPage {
  return Boolean(page && String(page.id || '').trim() && String(page.nombre || '').trim());
}

export function buildCloneDraftFromProductPage(source: ProductPage): QuickCreatorClonePayload {
  const hasTripwire = Boolean(
    source.tripwireConfig?.enabled && String(source.tripwireConfig?.entryProductName || '').trim()
  );
  const p1 = Math.max(35000, Number(source.precios?.[1] || source.precioNormal || 189000));
  const p2 = Math.max(50000, Number(source.precios?.[2] || Math.round(p1 * 1.85)));
  const p3 = Math.max(70000, Number(source.precios?.[3] || Math.round(p1 * 2.65)));
  const normalP = Math.max(p1, Number(source.precioNormal || Math.round(p1 * 1.32)));

  const winnerAngle =
    String(source.winnerAngle || '').trim() ||
    String(source.visualLanding?.winnerAngleHeadline || '').trim() ||
    String(source.landingContent?.heroTitle || '').trim() ||
    '';

  const productDesc =
    String(source.descripcion || '').trim() ||
    String(source.visualLanding?.winnerAngleDescription || '').trim() ||
    String(source.landingContent?.heroSubtitle || '').trim() ||
    source.nombre;

  const entryCfg = source.tripwireConfig;
  const entryPrice = Math.max(5000, Number(entryCfg?.entryPriceGs ?? entryCfg?.entryProductPriceGs ?? 20000));
  const entryNormal = Math.max(entryPrice, Number(entryCfg?.entryNormalPriceGs || Math.round(entryPrice * 2.2)));
  const entryDelivery = Math.max(15000, Number(entryCfg?.deliveryFeeGs ?? entryCfg?.entryDeliveryFeeGs ?? 40000));

  const contextSummaryParts = [
    source.contextoIA ? String(source.contextoIA).trim() : '',
    source.landingContent?.heroTitle ? `Titular previo: ${source.landingContent.heroTitle}` : '',
    Array.isArray(source.landingContent?.benefitCards) && source.landingContent.benefitCards.length > 0
      ? `Puntos clave previos: ${source.landingContent.benefitCards
          .slice(0, 4)
          .map(c => c.title)
          .filter(Boolean)
          .join(' | ')}`
      : ''
  ].filter(Boolean);

  return {
    suggestedMode: hasTripwire ? 'dual_tripwire_winner' : 'principal_only',
    productName: String(source.nombre || '').trim(),
    winnerAngle,
    productDescription: productDesc,
    normalPriceGs: normalP,
    price1Gs: p1,
    price2Gs: p2,
    price3Gs: p3,
    productImageInput: String(source.imagen || '').trim(),
    waNumber: String(source.wa || '595973532550').trim(),
    entrySourceUrl: String(entryCfg?.sourceUrl || '').trim(),
    entryProductName: hasTripwire ? String(entryCfg?.entryProductName || '').trim() : '',
    entryProductDescription: hasTripwire ? String(entryCfg?.entryProductDescription || '').trim() : '',
    entryPriceGs: entryPrice,
    entryNormalPriceGs: entryNormal,
    entryDeliveryFeeGs: entryDelivery,
    entryProductImageInput: hasTripwire
      ? String(entryCfg?.entryImageUrl || entryCfg?.entryProductImage || '').trim()
      : '',
    instantDiscountPercent: Number(entryCfg?.instantDiscountPercent || 12),
    eventDurationHours: Number(entryCfg?.eventDurationHours || 6),
    slotsTotal: Number(entryCfg?.slotsTotal || 10),
    backgroundMusicPreset: entryCfg?.backgroundMusicPreset || 'warm_ambient',
    clonedFromContext: {
      sourceProductId: source.id,
      sourceProductName: String(source.nombre || '').trim(),
      sourceSlug: String(source.slug || '').trim(),
      sourceMode: hasTripwire ? 'dual_tripwire_winner' : 'principal_only',
      sourceDescription: productDesc,
      sourceWinnerAngle: winnerAngle || undefined,
      sourceEntryProductName: hasTripwire ? String(entryCfg?.entryProductName || '').trim() : undefined,
      sourceContextoIA: contextSummaryParts.join('\n') || undefined
    }
  };
}
