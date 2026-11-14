import type { ProductPage } from '../types';

export type AutoAdsStrategyMode = 'standard' | 'hybrid' | 'entry_hook';
export type AutoAdsSlotMode = 'standard' | 'entry_hook';

export interface PlannedAdSlotSpec {
  adIndex: number;
  slotMode: AutoAdsSlotMode;
  isReel: boolean;
}

export const MIN_ADS_PER_TYPE = 1;
export const MAX_ADS_PER_TYPE = 12;

export function clampAdsCount(value: number, fallback = 4): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(MIN_ADS_PER_TYPE, Math.min(MAX_ADS_PER_TYPE, Math.round(num)));
}

/**
 * Filtra únicamente páginas creadas con oferta Tripwire genuina activa.
 * Las páginas estándar puras (como Noelux™ sin tripwireConfig) quedan estrictamente excluidas.
 */
export function filterGenuineTripwirePages<T extends Pick<ProductPage, 'id' | 'tripwireConfig'>>(
  pages: T[]
): T[] {
  if (!Array.isArray(pages)) return [];
  return pages.filter(p =>
    Boolean(
      p?.tripwireConfig?.enabled &&
        typeof p.tripwireConfig.entryProductName === 'string' &&
        p.tripwireConfig.entryProductName.trim().length > 0 &&
        Number(p.tripwireConfig.entryPriceGs) > 0
    )
  );
}

export function computePlannedAdSetCounts(
  strategyMode: AutoAdsStrategyMode,
  standardAdsCount: number,
  tripwireAdsCount: number
): {
  standardCount: number;
  tripwireCount: number;
  totalCount: number;
} {
  const safeStd = clampAdsCount(standardAdsCount, 4);
  const safeTw = clampAdsCount(tripwireAdsCount, 1);

  if (strategyMode === 'standard') {
    return { standardCount: safeStd, tripwireCount: 0, totalCount: safeStd };
  }
  if (strategyMode === 'entry_hook') {
    return { standardCount: 0, tripwireCount: safeTw, totalCount: safeTw };
  }
  return {
    standardCount: safeStd,
    tripwireCount: safeTw,
    totalCount: safeStd + safeTw
  };
}

export function resolveDefaultSlotMode(
  adIndex: number,
  strategyMode: AutoAdsStrategyMode,
  plannedStandardCount: number,
  cardInjectModes?: Record<number, AutoAdsSlotMode>
): AutoAdsSlotMode {
  const override = cardInjectModes?.[adIndex];
  if (override === 'standard' || override === 'entry_hook') {
    return override;
  }
  if (strategyMode === 'entry_hook') {
    return 'entry_hook';
  }
  if (strategyMode === 'hybrid') {
    return adIndex >= Math.max(0, plannedStandardCount) ? 'entry_hook' : 'standard';
  }
  return 'standard';
}

export function buildPlannedSlotSpecs(params: {
  strategyMode: AutoAdsStrategyMode;
  standardAdsCount: number;
  tripwireAdsCount: number;
  onlyImagesMode: boolean;
  cardInjectModes?: Record<number, AutoAdsSlotMode>;
}): PlannedAdSlotSpec[] {
  const { standardCount, totalCount } = computePlannedAdSetCounts(
    params.strategyMode,
    params.standardAdsCount,
    params.tripwireAdsCount
  );

  const slots: PlannedAdSlotSpec[] = [];
  for (let i = 0; i < totalCount; i++) {
    const slotMode = resolveDefaultSlotMode(
      i,
      params.strategyMode,
      standardCount,
      params.cardInjectModes
    );
    const isReel =
      !params.onlyImagesMode &&
      slotMode === 'standard' &&
      standardCount >= 6 &&
      (i === 4 || i === 5);

    slots.push({
      adIndex: i,
      slotMode,
      isReel
    });
  }
  return slots;
}
