import type { ProductPage } from '../types';

export type ProductPageOriginCategory =
  | 'legacy'
  | 'quick_standard'
  | 'quick_tripwire';

export type ProductPageCategoryFilter =
  | 'todas'
  | 'antiguas'
  | 'nuevas'
  | 'nuevas_estandar'
  | 'nuevas_tripwire';

export type ProductPageClassifierInput = Pick<
  ProductPage,
  'visualLanding' | 'tripwireConfig'
>;

export function isQuickCreatorProductPage(
  prod: Partial<ProductPageClassifierInput> | null | undefined
): boolean {
  return Boolean(prod?.visualLanding?.enabled);
}

export function isTripwireProductPage(
  prod: Partial<ProductPageClassifierInput> | null | undefined
): boolean {
  const trip = prod?.tripwireConfig;
  if (!trip?.enabled) return false;
  const entryName = typeof trip.entryProductName === 'string' ? trip.entryProductName.trim() : '';
  const entryPrice = Number(trip.entryPriceGs ?? trip.entryProductPriceGs ?? 0);
  return entryName.length > 0 && Number.isFinite(entryPrice) && entryPrice > 0;
}

export function classifyProductPageType(
  prod: Partial<ProductPageClassifierInput> | null | undefined
): ProductPageOriginCategory {
  if (!isQuickCreatorProductPage(prod)) {
    return 'legacy';
  }
  if (isTripwireProductPage(prod)) {
    return 'quick_tripwire';
  }
  return 'quick_standard';
}

export function matchesProductPageCategoryFilter(
  prod: Partial<ProductPageClassifierInput> | null | undefined,
  filter: ProductPageCategoryFilter
): boolean {
  if (filter === 'todas') return true;
  const category = classifyProductPageType(prod);
  if (filter === 'antiguas') return category === 'legacy';
  if (filter === 'nuevas') {
    return category === 'quick_standard' || category === 'quick_tripwire';
  }
  if (filter === 'nuevas_estandar') return category === 'quick_standard';
  if (filter === 'nuevas_tripwire') return category === 'quick_tripwire';
  return true;
}

export function countProductPageCategories(
  pages: Array<Partial<ProductPageClassifierInput>> | null | undefined
): Record<ProductPageCategoryFilter, number> {
  const list = Array.isArray(pages) ? pages : [];
  let antiguas = 0;
  let nuevasEstandar = 0;
  let nuevasTripwire = 0;

  for (const page of list) {
    const category = classifyProductPageType(page);
    if (category === 'legacy') antiguas += 1;
    else if (category === 'quick_tripwire') nuevasTripwire += 1;
    else nuevasEstandar += 1;
  }

  return {
    todas: list.length,
    antiguas,
    nuevas: nuevasEstandar + nuevasTripwire,
    nuevas_estandar: nuevasEstandar,
    nuevas_tripwire: nuevasTripwire
  };
}

export function getProductPageCategoryMeta(category: ProductPageOriginCategory): {
  label: string;
  shortLabel: string;
  kicker: string;
  description: string;
} {
  if (category === 'quick_tripwire') {
    return {
      label: 'Creador Rápido · Tripwire',
      shortLabel: 'Tripwire',
      kicker: 'Creador Rápido · Página Tripwire',
      description: 'Gancho accesible arriba + ruptura chocante + producto principal con envío gratis'
    };
  }
  if (category === 'quick_standard') {
    return {
      label: 'Creador Rápido · Estándar',
      shortLabel: 'Estándar',
      kicker: 'Creador Rápido · Página Estándar',
      description: 'Página visual enfocada 100% en un único producto ganador'
    };
  }
  return {
    label: 'Página Antigua',
    shortLabel: 'Antigua',
    kicker: 'Página Antigua · Clásica',
    description: 'Estructura anterior tradicional previa al Creador Rápido'
  };
}
