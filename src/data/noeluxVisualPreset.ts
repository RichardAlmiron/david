import type { ProductTripwireOfferConfig, ProductVisualLandingConfig } from '../types';

export const NOELUX_TRIPWIRE_CONFIG: ProductTripwireOfferConfig = {
  enabled: true,
  entryProductName: 'Guirnalda LED Navideña Cálida 10m',
  entryProductDescription:
    'Tira cálida de 10 metros resistente para exteriores, ideal para balcones, portones y marcos de puerta.',
  entryPriceGs: 20000,
  entryNormalPriceGs: 45000,
  deliveryFeeGs: 40000,
  entryProductImage: '/assets/visual-pages/noelux-entry-guirnalda.jpg',
  entryImageUrl: '/assets/visual-pages/noelux-entry-guirnalda.jpg',
  eventDurationHours: 6,
  slotsTotal: 10,
  instantDiscountPercent: 12,
  backgroundMusicPreset: 'warm_ambient',
  entryOnlyClarification:
    'Incluye únicamente 1x Guirnalda LED 10m. No incluye el Proyector Noelux™ ni envío gratis por separado.',
  principalBundleClarification:
    'Incluye Proyector Noelux™ 12 Diseños + Guirnalda LED 10m de regalo + Envío Gratis sin esperar evento.'
};

export const NOELUX_VISUAL_LANDING: ProductVisualLandingConfig = {
  enabled: true,
  mode: 'sober_graphic_3sheet',
  generatorModel: 'openai/gpt-image-2.6-sunburst',
  topNoticeText: 'Pago en puerta al recibir · Paraguay',
  sobrietyHeadline: 'Iluminá toda tu fachada en 90 segundos, sin escaleras',
  subheadline:
    'Proyector láser Noelux™ 12 Diseños IP65 para lluvia con envío gratis en todo Paraguay y pago recién al recibir.',
  winnerAngleHeadline: 'Ángulo Completo: Resolvé Toda tu Fachada en 90 Segundos (Sin Colgar Cables)',
  winnerAngleDescription:
    'En lugar de cubrir solo un marco con una tira corta, el Proyector Láser Noelux™ cubre hasta 70 m² de paredes, techo y jardín con 12 motivos en movimiento e impermeabilidad IP65.',
  reversePsychologyHook:
    'Fijate en los números antes de elegir: pedir solo la Guirnalda LED (Gs. 20.000) suma delivery aparte. En cambio, asegurando hoy tu Proyector Noelux™, llevás la Guirnalda totalmente de regalo con envío gratis directo a tu puerta.',
  entryButtonLabel: 'Elegir solo Guirnalda LED 10m (Gs. 20.000)',
  entryDisclaimer:
    'Esta opción envía únicamente 1x Guirnalda LED 10m. NO incluye el Proyector Noelux™. Participás del evento por WhatsApp o se suma delivery de zona (Gs. 40.000) al finalizar.',
  bundleButtonLabel: 'Llevar Proyector Noelux™ + Guirnalda GRATIS (Gs. 189.000)',
  bundleDisclaimer:
    'Pedido completo asegurado sin lista de espera: incluye Proyector Noelux™ 12 Diseños + Guirnalda LED 10m DE REGALO + Envío Gratis.',
  sheets: [
    {
      id: 'noelux_sheet_1',
      role: 'hero_presentation',
      placement: 'hero_sheet',
      aspectRatio: '3:4',
      title: 'Noelux™ Proyector Navideño 12 Diseños · Fachada Completa en 90 Segundos',
      caption: 'Cobertura de 70m², lente HD intercambiable y protección IP65 para lluvia.',
      imageUrl: '/assets/visual-pages/noelux-sheet-1.jpg'
    },
    {
      id: 'noelux_sheet_2',
      role: 'comparison_need',
      placement: 'comparison_sheet',
      aspectRatio: '3:4',
      title: 'Comparativa transparente: Solo Guirnalda LED vs Proyector Noelux™ Completo',
      caption: 'Dos caminos claros y separados según lo que necesites hoy para tu hogar.',
      imageUrl: '/assets/visual-pages/noelux-sheet-2.jpg'
    },
    {
      id: 'noelux_sheet_3',
      role: 'social_trust_specs',
      placement: 'proof_sheet',
      aspectRatio: '3:4',
      title: 'Contenido real de caja, garantía escrita y pago en puerta',
      caption: 'Enchufe directo 220V, estaca exterior, base interior y 12 diseños incluidos.',
      imageUrl: '/assets/visual-pages/noelux-sheet-3.jpg'
    }
  ],
  generatedAt: '2026-11-14T01:20:00.000Z'
};

export function upgradeDefaultNoeluxWithVisualPreset<T extends Record<string, any>>(product: T): T {
  if (!product || product.id !== 'prod-noelux-01') return product;
  const hasTripwire = Boolean(product.tripwireConfig?.enabled && product.tripwireConfig?.entryProductName);
  const nextProduct: Record<string, any> = {
    ...product,
    tripwireConfig: hasTripwire ? product.tripwireConfig : NOELUX_TRIPWIRE_CONFIG
  };
  if ('visualLanding' in nextProduct) {
    delete nextProduct.visualLanding;
  }
  return nextProduct as T;
}

/**
 * Garantiza que CUALQUIER página de producto creada cuente siempre con oferta de entrada activa
 * y jamás exponga términos técnicos internos en textos públicos.
 */
export function ensureProductHasMandatoryTripwire<T extends Record<string, any>>(product: T): T {
  if (!product || typeof product !== 'object') return product;
  const noeluxChecked = upgradeDefaultNoeluxWithVisualPreset(product);
  if (noeluxChecked.tripwireConfig?.enabled && noeluxChecked.tripwireConfig?.entryProductName) {
    return noeluxChecked;
  }
  const prodName = String(noeluxChecked.nombre || 'Producto Principal').trim();
  const existingTrip = noeluxChecked.tripwireConfig || {};
  const fallbackEntryName = String(
    existingTrip.entryProductName || `Complemento Esencial para ${prodName.split(/\s+/).slice(0, 3).join(' ')}`
  ).trim();
  const entryPriceGs = Number(existingTrip.entryPriceGs || 20000);
  return {
    ...noeluxChecked,
    tripwireConfig: {
      enabled: true,
      entryProductName: fallbackEntryName,
      entryProductDescription: String(
        existingTrip.entryProductDescription ||
          `Accesorio práctico de entrada compatible con ${prodName}. Ideal para uso diario en el hogar.`
      ).trim(),
      entryPriceGs,
      entryNormalPriceGs: Number(existingTrip.entryNormalPriceGs || Math.round(entryPriceGs * 2.2)),
      deliveryFeeGs: Number(existingTrip.deliveryFeeGs || 40000),
      entryProductImage: existingTrip.entryProductImage || existingTrip.entryImageUrl || noeluxChecked.imagen || '',
      entryImageUrl: existingTrip.entryImageUrl || existingTrip.entryProductImage || noeluxChecked.imagen || '',
      eventDurationHours: Number(existingTrip.eventDurationHours || 6),
      slotsTotal: Number(existingTrip.slotsTotal || 10),
      instantDiscountPercent: Number(existingTrip.instantDiscountPercent || 12),
      backgroundMusicPreset: existingTrip.backgroundMusicPreset || 'warm_ambient',
      entryOnlyClarification:
        existingTrip.entryOnlyClarification ||
        `Incluye únicamente 1x ${fallbackEntryName}. No incluye ${prodName} ni envío gratis por separado.`,
      principalBundleClarification:
        existingTrip.principalBundleClarification ||
        `Incluye ${prodName} completo + ${fallbackEntryName} de regalo + Envío Gratis sin esperar evento.`
    }
  };
}
