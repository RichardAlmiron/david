/**
 * DEEPSEEK HARNESS (DSH) AGENT RUNTIME & CORDIS KERNEL
 * Official Architecture based on https://github.com/deepseek-ai/deepseek-harness
 *
 * Core Principle: "Everything is a plugin"
 * Powered by Cordis Spatiotemporal Composability:
 * - Dynamic Plugin Tree (Hooks, Tools, State, Reducers)
 * - Reversible Effects & Clean State Unwinding
 * - Super-Agent Router (Portavoz) -> Worker Coding Agent
 */

import { ProductPage, ProductThemeConfig, ProductPhysicalTruth, ProductLandingContent } from '../types';
import { formatGs } from '../config';
import { THEME_PRESETS_MAP } from '../data/productTemplatesCatalog';

export interface DshPluginEffect {
  pluginId: string;
  name: string;
  description: string;
  timestamp: string;
}

export interface DshExecutionContext {
  instruction: string;
  currentDraft: ProductPage;
  currentLanding: ProductLandingContent;
  currentTheme: ProductThemeConfig;
  currentPrices: Record<number, number>;
  currentTruth: ProductPhysicalTruth;
  currentWa: string;
  currentWaNotificacionesVendedor: string;
  currentVozAgente: string;
  currentFreeShipping: boolean;
  appliedEffects: DshPluginEffect[];
  activePlugins: string[];
}

export interface DshPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  canHandle: (instruction: string) => boolean;
  apply: (ctx: DshExecutionContext) => void;
}

/**
 * CORDIS PLUGIN REGISTRY: "Everything is a Plugin"
 */
class CordisPluginRegistry {
  private plugins: Map<string, DshPlugin> = new Map();

  register(plugin: DshPlugin) {
    this.plugins.set(plugin.id, plugin);
  }

  getPlugins(): DshPlugin[] {
    return Array.from(this.plugins.values());
  }

  execute(ctx: DshExecutionContext): DshExecutionContext {
    for (const plugin of this.plugins.values()) {
      if (plugin.canHandle(ctx.instruction)) {
        ctx.activePlugins.push(plugin.id);
        plugin.apply(ctx);
      }
    }
    return ctx;
  }
}

// -------------------------------------------------------------
// DSH CORE PLUGINS (Cordis Plugins for E-Commerce COD Architecture)
// -------------------------------------------------------------

// Plugin 1: dsh-plugin-emblem-and-hero
const emblemPlugin: DshPlugin = {
  id: 'dsh-plugin-emblem-hero',
  name: 'DeepSeek Harness · Emblems & Hero Badge Plugin',
  description: 'Inyecta y modula sellos, insignias, ganchos de portada y distintivos de alta conversión.',
  version: '2.1.0-cordis',
  canHandle: (inst: string) => /\b(emblema|sello|badge|insignia|etiqueta|distintivo|promesa|titular|headline)\b/i.test(inst),
  apply: (ctx) => {
    const raw = ctx.instruction;
    const lower = raw.toLowerCase();

    if (/\b(emblema|sello|badge|insignia|etiqueta|distintivo)\b/i.test(lower)) {
      const quoted = raw.match(/["“”'«»]([^"“”'«»]{3,60})["“”'«»]/);
      let emblemText = '';
      if (quoted?.[1]) {
        emblemText = quoted[1].trim();
      } else {
        const extracted = raw.replace(/^.*?\b(emblema|sello|badge|insignia|etiqueta|distintivo)\b(?:\s+de|\s*:)?\s*/i, '').trim();
        const cleaned = extracted.replace(/\b(con sello dorado|sello dorado|dorado|con sello|en dorado)\b.*$/i, '').trim();
        emblemText = cleaned.slice(0, 45) || 'CALIDAD PREMIUM COMPROBADA';
      }

      if (/\b(oro|dorado|lujo)\b/i.test(lower)) {
        ctx.currentTheme.badgeStyle = 'golden-seal';
      } else if (/\b(industrial|peligro|seguridad)\b/i.test(lower)) {
        ctx.currentTheme.badgeStyle = 'hazard-tag';
      } else if (/\b(cl[ií]nico|m[eé]dico)\b/i.test(lower)) {
        ctx.currentTheme.badgeStyle = 'clinical-badge';
      } else if (/\b(cyber|tecnolog)\b/i.test(lower)) {
        ctx.currentTheme.badgeStyle = 'cyber-chip';
      } else {
        ctx.currentTheme.badgeStyle = 'golden-seal';
      }

      ctx.currentLanding.heroBadge = emblemText.toUpperCase();
      ctx.currentLanding.topBarBadge = '★ ' + emblemText.toUpperCase();
      ctx.currentLanding.emblemBadge = {
        text: emblemText.toUpperCase(),
        icon: ctx.currentTheme.badgeStyle || 'golden-seal'
      };

      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-emblem-hero',
        name: 'Emblema Inyectado',
        description: `Se instaló el emblema oficial: "${ctx.currentLanding.heroBadge}"`,
        timestamp: new Date().toISOString()
      });
    }

    if (/\b(t[ií]tulo|titular|encabezado|promesa|[aá]ngulo|enfoc[aá]|para )\b/i.test(lower)) {
      const quoted = raw.match(/["“”'«»]([^"“”'«»]{8,140})["“”'«»]/);
      if (quoted?.[1]) {
        ctx.currentLanding.heroHighlight = quoted[1].trim();
      } else {
        ctx.currentLanding.heroHighlight = `${ctx.currentDraft.nombre}: ${raw.slice(0, 110)}`;
      }
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-emblem-hero',
        name: 'Titular Actualizado',
        description: `Titular gancho adaptado a: "${ctx.currentLanding.heroHighlight}"`,
        timestamp: new Date().toISOString()
      });
    }
  }
};

// Plugin 2: dsh-plugin-theme-archetypes
const themePlugin: DshPlugin = {
  id: 'dsh-plugin-theme-archetypes',
  name: 'DeepSeek Harness · Theme Archetypes & Aesthetics Plugin',
  description: 'Reconfigura paleta cromática, forma de botones (rounded) y arquetipo de maquetación.',
  version: '2.1.0-cordis',
  canHandle: (inst: string) => /\b(color|diseño|paleta|negro|dorado|oro|lujo|rojo|azul|amarillo|industrial|esmeralda|verde|terracota|bot[oó]n|c[aá]psula|redondeado|cuadrado)\b/i.test(inst),
  apply: (ctx) => {
    const raw = ctx.instruction;
    const lower = raw.toLowerCase();

    if (/\b(negro|oscuro|mate|dorado|oro|lujo|vip|barber)\b/i.test(lower)) {
      ctx.currentTheme = {
        ...THEME_PRESETS_MAP.barber,
        name: 'Negro Mate & Oro VIP (DSH Harness)',
        layoutArchetype: 'minimalist-luxury',
        buttonShape: 'rounded-full'
      };
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-theme-archetypes',
        name: 'Paleta Lujo Negro & Oro',
        description: 'Arquetipo Minimalist Luxury con botones redondeados en cápsula.',
        timestamp: new Date().toISOString()
      });
    } else if (/\b(amarillo|industrial|herramienta|taller|robusto)\b/i.test(lower)) {
      ctx.currentTheme = {
        ...THEME_PRESETS_MAP.industrial,
        name: 'Amarillo Industrial & Acero (DSH Harness)',
        layoutArchetype: 'brutalist-industrial',
        buttonShape: 'rounded-none'
      };
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-theme-archetypes',
        name: 'Paleta Brutalista Industrial',
        description: 'Bordes rectos técnicos y amarillo de seguridad.',
        timestamp: new Date().toISOString()
      });
    } else if (/\b(azul|cl[ií]nico|m[eé]dico|salud|confianza|cobalto)\b/i.test(lower)) {
      ctx.currentTheme = {
        ...THEME_PRESETS_MAP.clinico,
        name: 'Azul Clínico & Turquesa (DSH Harness)',
        layoutArchetype: 'nordic-clinical',
        buttonShape: 'rounded-2xl'
      };
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-theme-archetypes',
        name: 'Paleta Azul Clínico',
        description: 'Diseño médico nórdico con certificaciones de salud.',
        timestamp: new Date().toISOString()
      });
    } else if (/\b(verde|esmeralda|noelux|original)\b/i.test(lower)) {
      ctx.currentTheme = {
        ...THEME_PRESETS_MAP.esmeralda,
        name: 'Esmeralda Real & Oro Noelux (DSH Harness)',
        layoutArchetype: 'noelux-classic',
        buttonShape: 'rounded-2xl'
      };
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-theme-archetypes',
        name: 'Paleta Noelux Clásica',
        description: 'Verde bosque esmeralda y oro para alta confianza COD.',
        timestamp: new Date().toISOString()
      });
    }

    if (/\b(bot[oó]n.*c[aá]psula|redondeado completo|rounded-full)\b/i.test(lower)) {
      ctx.currentTheme.buttonShape = 'rounded-full';
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-theme-archetypes',
        name: 'Botón Cápsula',
        description: 'Botones CTA redondeados en cápsula completa.',
        timestamp: new Date().toISOString()
      });
    } else if (/\b(bot[oó]n.*cuadrado|borde recto|sin redondear|rounded-none)\b/i.test(lower)) {
      ctx.currentTheme.buttonShape = 'rounded-none';
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-theme-archetypes',
        name: 'Botón Recto',
        description: 'Botones CTA rectangulares industriales.',
        timestamp: new Date().toISOString()
      });
    }
  }
};

// Plugin 3: dsh-plugin-cod-pricing-ladder
const pricingPlugin: DshPlugin = {
  id: 'dsh-plugin-cod-pricing',
  name: 'DeepSeek Harness · COD Pricing & Gift Ladder Plugin',
  description: 'Calcula combos psicológicos, escala de precios y bonos de regalo en Pack 2.',
  version: '2.1.0-cordis',
  canHandle: (inst: string) => /\b(precio|pack|costo|regalo|bono|gratis en el pack|incluya|incluir)\b/i.test(inst),
  apply: (ctx) => {
    const raw = ctx.instruction;
    const lower = raw.toLowerCase();

    const singlePriceMatch = raw.match(/(?:precio|costo)\D+(\d{2,3})[.\s]?(\d{3})/i);
    const priceMatch1 = raw.match(/(?:pack\s*1|precio\s*base|unitario)\D+(\d{2,3})[.\s]?(\d{3})/i);
    const priceMatch2 = raw.match(/pack\s*2\D+(\d{2,3})[.\s]?(\d{3})/i);
    const priceMatch3 = raw.match(/pack\s*3\D+(\d{2,3})[.\s]?(\d{3})/i);

    if (priceMatch1) {
      ctx.currentPrices[1] = Number(`${priceMatch1[1]}${priceMatch1[2]}`);
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-cod-pricing',
        name: 'Precio Pack 1',
        description: `Pack 1 fijado en ${formatGs(ctx.currentPrices[1])}`,
        timestamp: new Date().toISOString()
      });
    } else if (singlePriceMatch && !priceMatch2 && !priceMatch3) {
      const p1 = Number(`${singlePriceMatch[1]}${singlePriceMatch[2]}`);
      ctx.currentPrices[1] = p1;
      const rawP2 = Math.round(p1 * 1.8);
      ctx.currentPrices[2] = Math.ceil(rawP2 / 10000) * 10000 - 1000;
      const rawP3 = Math.round(p1 * 2.5);
      ctx.currentPrices[3] = Math.ceil(rawP3 / 10000) * 10000 - 1000;
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-cod-pricing',
        name: 'Escala Psicológica COD',
        description: `Pack 1 fijado en ${formatGs(p1)}, Pack 2 en ${formatGs(ctx.currentPrices[2])}`,
        timestamp: new Date().toISOString()
      });
    }

    if (priceMatch2) {
      ctx.currentPrices[2] = Number(`${priceMatch2[1]}${priceMatch2[2]}`);
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-cod-pricing',
        name: 'Precio Pack 2',
        description: `Pack 2 fijado en ${formatGs(ctx.currentPrices[2])}`,
        timestamp: new Date().toISOString()
      });
    }
    if (priceMatch3) {
      ctx.currentPrices[3] = Number(`${priceMatch3[1]}${priceMatch3[2]}`);
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-cod-pricing',
        name: 'Precio Pack 3',
        description: `Pack 3 fijado en ${formatGs(ctx.currentPrices[3])}`,
        timestamp: new Date().toISOString()
      });
    }

    if (/\b(regalo|bono|gratis en el pack 2|incluya|incluir)\b/i.test(lower)) {
      const giftExtract = raw.replace(/^.*?\b(regalo|bono|incluya|incluir)\b[:\s]*/i, '').trim();
      const cleanGift = giftExtract.slice(0, 65) || 'Regalo Especial Incluido';
      if (ctx.currentLanding.packLabels?.[2]) {
        ctx.currentLanding.packLabels[2].subtitle = `Llevás 2 unidades + BONO: ${cleanGift}`;
        ctx.currentLanding.packLabels[2].tag = '🎁 PACK 2 + REGALO HOY';
      }
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-cod-pricing',
        name: 'Regalo Pack 2',
        description: `Bono en Pack 2: "${cleanGift}"`,
        timestamp: new Date().toISOString()
      });
    }
  }
};

// Plugin 4: dsh-plugin-physical-truth
const truthPlugin: DshPlugin = {
  id: 'dsh-plugin-physical-truth',
  name: 'DeepSeek Harness · Physical Truth & Box Contents Plugin',
  description: 'Administra la verdad física del producto, contenido exacto de caja y garantía.',
  version: '2.1.0-cordis',
  canHandle: (inst: string) => /\b(caja|kit|incluye|viene con|garant[ií]a|d[ií]as|meses|alimentaci[oó]n|bater[ií]a|220v|solar)\b/i.test(inst),
  apply: (ctx) => {
    const raw = ctx.instruction;
    const lower = raw.toLowerCase();

    if (/\b(caja|kit|incluye|viene con)\b/i.test(lower)) {
      const boxExtract = raw.replace(/^.*?\b(caja|kit|incluye|viene con)\b[:\s]*/i, '').trim();
      if (boxExtract.length > 5) {
        ctx.currentTruth.boxContents = boxExtract.slice(0, 140);
        ctx.appliedEffects.push({
          pluginId: 'dsh-plugin-physical-truth',
          name: 'Caja Sellada',
          description: `Contenido de la caja: "${ctx.currentTruth.boxContents}"`,
          timestamp: new Date().toISOString()
        });
      }
    }

    const warrantyMatchDays = raw.match(/(\d{1,3})\s*d[ií]as\s*de\s*garant[ií]a/i);
    const warrantyMatchMonths = raw.match(/(\d{1,2})\s*mes(?:es)?\s*de\s*garant[ií]a/i);
    if (warrantyMatchMonths) {
      ctx.currentTruth.warrantyDays = parseInt(warrantyMatchMonths[1], 10) * 30;
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-physical-truth',
        name: 'Garantía Escrita',
        description: `Garantía fijada en ${ctx.currentTruth.warrantyDays} días oficiales`,
        timestamp: new Date().toISOString()
      });
    } else if (warrantyMatchDays) {
      ctx.currentTruth.warrantyDays = parseInt(warrantyMatchDays[1], 10);
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-physical-truth',
        name: 'Garantía Escrita',
        description: `Garantía fijada en ${ctx.currentTruth.warrantyDays} días oficiales`,
        timestamp: new Date().toISOString()
      });
    }

    if (/\b(220v|enchufe|toma\s*corriente)\b/i.test(lower)) {
      ctx.currentTruth.powerSource = 'enchufe_220v';
      ctx.currentTruth.powerSourceLabel = 'Enchufe 220V Directo (Norma Paraguay)';
    } else if (/\b(usb|bater[ií]a\s*recargable)\b/i.test(lower)) {
      ctx.currentTruth.powerSource = 'bateria_usb';
      ctx.currentTruth.powerSourceLabel = 'Batería de litio recargable USB';
    } else if (/\b(solar)\b/i.test(lower)) {
      ctx.currentTruth.powerSource = 'solar';
      ctx.currentTruth.powerSourceLabel = 'Panel solar integrado';
    }
  }
};

// Plugin 5: dsh-plugin-channels-voice
const voicePlugin: DshPlugin = {
  id: 'dsh-plugin-channels-voice',
  name: 'DeepSeek Harness · Channels & Voice Agent Plugin',
  description: 'Conecta teléfonos de WhatsApp (cliente/vendedor) y modelo de voz Deepgram Aura-2.',
  version: '2.1.0-cordis',
  canHandle: (inst: string) => /\b(whatsapp|wa|vendedor|tel[eé]fono|celular|voz|luna|estrella|celeste|sirio|n[eé]stor|env[ií]o|delivery)\b/i.test(inst),
  apply: (ctx) => {
    const raw = ctx.instruction;
    const lower = raw.toLowerCase();

    const phoneMatch = raw.match(/(?:09\d{2}[-.\s]?\d{3}[-.\s]?\d{3}|5959\d{8})/);
    if (phoneMatch) {
      const rawDigits = phoneMatch[0].replace(/[-.\s]/g, '');
      const cleanPhone = rawDigits.startsWith('0') ? '595' + rawDigits.slice(1) : rawDigits;
      if (/\b(vendedor|notificaci[oó]n|aviso|reporte)\b/i.test(lower)) {
        ctx.currentWaNotificacionesVendedor = cleanPhone;
        ctx.appliedEffects.push({
          pluginId: 'dsh-plugin-channels-voice',
          name: 'WhatsApp Vendedor',
          description: `Avisos al vendedor dirigidos a +${cleanPhone}`,
          timestamp: new Date().toISOString()
        });
      } else {
        ctx.currentWa = cleanPhone;
        ctx.appliedEffects.push({
          pluginId: 'dsh-plugin-channels-voice',
          name: 'WhatsApp Cliente',
          description: `Atención a clientes dirigida a +${cleanPhone}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    if (/\b(luna)\b/i.test(lower)) {
      ctx.currentVozAgente = 'aura-2-luna-es';
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-channels-voice',
        name: 'Voz Luna',
        description: 'Voz cambiada a Luna (Aura-2 Empática)',
        timestamp: new Date().toISOString()
      });
    } else if (/\b(estrella)\b/i.test(lower)) {
      ctx.currentVozAgente = 'deepgram-estrella';
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-channels-voice',
        name: 'Voz Estrella',
        description: 'Voz cambiada a Estrella (Femenina Natural Aura-2)',
        timestamp: new Date().toISOString()
      });
    } else if (/\b(n[eé]stor)\b/i.test(lower)) {
      ctx.currentVozAgente = 'deepgram-nestor';
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-channels-voice',
        name: 'Voz Néstor',
        description: 'Voz cambiada a Néstor (Masculina Ejecutiva Aura-2)',
        timestamp: new Date().toISOString()
      });
    } else if (/\b(sirio)\b/i.test(lower)) {
      ctx.currentVozAgente = 'deepgram-sirio';
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-channels-voice',
        name: 'Voz Sirio',
        description: 'Voz cambiada a Sirio (Masculina Profesional Aura-2)',
        timestamp: new Date().toISOString()
      });
    } else if (/\b(celeste)\b/i.test(lower)) {
      ctx.currentVozAgente = 'deepgram-celeste';
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-channels-voice',
        name: 'Voz Celeste',
        description: 'Voz cambiada a Celeste (Femenina Energética Aura-2)',
        timestamp: new Date().toISOString()
      });
    }

    if (/\b(env[ií]o gratis|sin costo de env[ií]o)\b/i.test(lower)) {
      ctx.currentFreeShipping = true;
      ctx.currentLanding.topBarText = 'ENVÍO GRATIS EN PARAGUAY · PAGÁS AL RECIBIR';
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-channels-voice',
        name: 'Envío Gratis',
        description: 'Envío configurado como 100% Gratis a todo el país',
        timestamp: new Date().toISOString()
      });
    } else if (/\b(cobrar env[ií]o|cobrar delivery|con costo de delivery)\b/i.test(lower)) {
      ctx.currentFreeShipping = false;
      ctx.currentLanding.topBarText = 'ENTREGA RÁPIDA · PAGÁS AL RECIBIR EN PUERTA';
      ctx.appliedEffects.push({
        pluginId: 'dsh-plugin-channels-voice',
        name: 'Con Costo Delivery',
        description: 'Envío configurado con costo de delivery (+25.000 Gs)',
        timestamp: new Date().toISOString()
      });
    }
  }
};

// Initialize the Cordis Registry
export const cordisKernel = new CordisPluginRegistry();
cordisKernel.register(emblemPlugin);
cordisKernel.register(themePlugin);
cordisKernel.register(pricingPlugin);
cordisKernel.register(truthPlugin);
cordisKernel.register(voicePlugin);

/**
 * Execute DeepSeek Harness (DSH) on a product draft
 */
export function executeDeepseekHarnessOnDraft(params: {
  instruction: string;
  currentDraft: ProductPage;
}): {
  updatedDraft: ProductPage;
  dshFramework: string;
  activePlugins: string[];
  appliedEffects: DshPluginEffect[];
  spokespersonReport: string;
} {
  const initialContext: DshExecutionContext = {
    instruction: params.instruction,
    currentDraft: params.currentDraft,
    currentLanding: JSON.parse(JSON.stringify(params.currentDraft.landingContent || {})),
    currentTheme: JSON.parse(JSON.stringify(params.currentDraft.themeConfig || {})),
    currentPrices: { ...params.currentDraft.precios },
    currentTruth: JSON.parse(JSON.stringify(params.currentDraft.physicalTruth || {})),
    currentWa: params.currentDraft.wa,
    currentWaNotificacionesVendedor: params.currentDraft.waNotificacionesVendedor || params.currentDraft.wa,
    currentVozAgente: params.currentDraft.vozAgente || 'deepgram-estrella',
    currentFreeShipping: params.currentDraft.freeShipping !== false,
    appliedEffects: [],
    activePlugins: []
  };

  const executedContext = cordisKernel.execute(initialContext);

  // If no plugin fired, apply generic hero highlight fallback
  if (executedContext.appliedEffects.length === 0) {
    const raw = params.instruction.trim();
    executedContext.currentLanding.heroHighlight = raw.length <= 120 ? raw : `${raw.slice(0, 117)}...`;
    executedContext.appliedEffects.push({
      pluginId: 'dsh-plugin-core-fallback',
      name: 'Promesa Principal',
      description: `Se adaptó la promesa gancho: "${executedContext.currentLanding.heroHighlight}"`,
      timestamp: new Date().toISOString()
    });
  }

  const updatedDraft: ProductPage = {
    ...params.currentDraft,
    landingContent: executedContext.currentLanding,
    themeConfig: executedContext.currentTheme,
    precios: executedContext.currentPrices,
    physicalTruth: executedContext.currentTruth,
    wa: executedContext.currentWa,
    waNotificacionesVendedor: executedContext.currentWaNotificacionesVendedor,
    vozAgente: executedContext.currentVozAgente,
    freeShipping: executedContext.currentFreeShipping
  };

  const spokespersonReport = `DeepSeek Harness (github.com/deepseek-ai/deepseek-harness) ejecutó ${executedContext.appliedEffects.length} efecto(s) en ${executedContext.activePlugins.length || 1} plugin(s) de Cordis:\n` +
    executedContext.appliedEffects.map(e => `• [${e.name}]: ${e.description}`).join('\n');

  return {
    updatedDraft,
    dshFramework: 'deepseek-ai/deepseek-harness (Cordis Spatiotemporal Kernel v2.1.0)',
    activePlugins: executedContext.activePlugins,
    appliedEffects: executedContext.appliedEffects,
    spokespersonReport
  };
}
