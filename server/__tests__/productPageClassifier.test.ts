import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyProductPageType,
  matchesProductPageCategoryFilter,
  countProductPageCategories,
  getProductPageCategoryMeta
} from '../../src/utils/productPageClassifier.ts';

const LEGACY_CLASSIC_PAGE = {
  id: 'prod-noelux-01',
  nombre: 'Noelux™ Proyector Clásico',
  slug: 'noelux-proyector'
};

const LEGACY_TEMPLATE_WITH_OLD_TRIPWIRE = {
  id: 'prod-legacy-tpl',
  nombre: 'Taladro Clásico Plantilla',
  slug: 'taladro-clasico',
  tripwireConfig: {
    enabled: true,
    entryProductName: 'Juego de Mechas',
    entryProductDescription: 'Mechas básicas',
    entryPriceGs: 25000,
    deliveryFeeGs: 40000,
    eventDurationHours: 6,
    slotsTotal: 10,
    instantDiscountPercent: 12
  }
};

const QUICK_CREATOR_STANDARD_PAGE = {
  id: 'prod-qc-std-01',
  nombre: 'Cafetera Espresso Portátil',
  slug: 'cafetera-espresso-abc',
  visualLanding: {
    enabled: true,
    mode: 'sober_graphic_2sheet' as const,
    sheets: [
      { id: 's1', title: 'Lámina 1', imageUrl: '/assets/visual-pages/cafe-1.jpg' },
      { id: 's2', title: 'Lámina 2', imageUrl: '/assets/visual-pages/cafe-2.jpg' }
    ]
  }
};

const QUICK_CREATOR_TRIPWIRE_PAGE = {
  id: 'prod-qc-tw-01',
  nombre: 'Proyector Astral Galaxia Pro',
  slug: 'proyector-astral-xyz',
  visualLanding: {
    enabled: true,
    mode: 'sober_graphic_2sheet' as const,
    sheets: [
      { id: 's1', title: 'Gancho Guirnalda', imageUrl: '/assets/visual-pages/hook-1.jpg' },
      { id: 's2', title: 'Principal Proyector', imageUrl: '/assets/visual-pages/main-2.jpg' }
    ]
  },
  tripwireConfig: {
    enabled: true,
    entryProductName: 'Guirnalda LED 10m',
    entryProductDescription: 'Tira LED cálida exterior',
    entryPriceGs: 20000,
    deliveryFeeGs: 40000,
    eventDurationHours: 6,
    slotsTotal: 10,
    instantDiscountPercent: 12
  }
};

test('classifyProductPageType diferencia páginas antiguas, nuevas estándar y nuevas tripwire del Creador Rápido', () => {
  assert.equal(classifyProductPageType(LEGACY_CLASSIC_PAGE), 'legacy');
  assert.equal(classifyProductPageType(LEGACY_TEMPLATE_WITH_OLD_TRIPWIRE), 'legacy');
  assert.equal(classifyProductPageType(QUICK_CREATOR_STANDARD_PAGE), 'quick_standard');
  assert.equal(classifyProductPageType(QUICK_CREATOR_TRIPWIRE_PAGE), 'quick_tripwire');

  assert.equal(getProductPageCategoryMeta('legacy').label, 'Página Antigua');
  assert.equal(getProductPageCategoryMeta('quick_standard').label, 'Creador Rápido · Estándar');
  assert.equal(getProductPageCategoryMeta('quick_tripwire').label, 'Creador Rápido · Tripwire');
});

test('matchesProductPageCategoryFilter y countProductPageCategories filtran con precisión cada categoría', () => {
  const allPages = [
    LEGACY_CLASSIC_PAGE,
    LEGACY_TEMPLATE_WITH_OLD_TRIPWIRE,
    QUICK_CREATOR_STANDARD_PAGE,
    QUICK_CREATOR_TRIPWIRE_PAGE
  ];

  const counts = countProductPageCategories(allPages);
  assert.deepEqual(counts, {
    todas: 4,
    antiguas: 2,
    nuevas: 2,
    nuevas_estandar: 1,
    nuevas_tripwire: 1
  });

  assert.deepEqual(
    allPages.filter((p) => matchesProductPageCategoryFilter(p, 'todas')).map((p) => p.id),
    ['prod-noelux-01', 'prod-legacy-tpl', 'prod-qc-std-01', 'prod-qc-tw-01']
  );
  assert.deepEqual(
    allPages.filter((p) => matchesProductPageCategoryFilter(p, 'antiguas')).map((p) => p.id),
    ['prod-noelux-01', 'prod-legacy-tpl']
  );
  assert.deepEqual(
    allPages.filter((p) => matchesProductPageCategoryFilter(p, 'nuevas')).map((p) => p.id),
    ['prod-qc-std-01', 'prod-qc-tw-01']
  );
  assert.deepEqual(
    allPages.filter((p) => matchesProductPageCategoryFilter(p, 'nuevas_estandar')).map((p) => p.id),
    ['prod-qc-std-01']
  );
  assert.deepEqual(
    allPages.filter((p) => matchesProductPageCategoryFilter(p, 'nuevas_tripwire')).map((p) => p.id),
    ['prod-qc-tw-01']
  );
});
