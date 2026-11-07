import {
  MetaAdCompetitorItem,
  ProductAgentBrain,
  ProductCodEconomics,
  ProductLandingContent,
  ProductPage,
  ProductPhysicalTruth,
  ProductThemeConfig
} from '../types';
import { formatGs } from '../config';

export interface NicheCategoryDef {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  description: string;
  paraguayDemandLevel: 'Muy Alta' | 'Explosiva' | 'Alta Constante';
  typicalProducts: string[];
}

export interface SubNicheTemplateDef {
  id: string;
  nicheId: string;
  name: string;
  subNicheLabel: string;
  badge: string;
  conversionRateAvg: string;
  description: string;
  idealForProducts: string[];
  winnerAngleHook: string;
  defaultPricePack1: number;
  defaultPricePack2: number;
  defaultPricePack3: number;
  defaultNormalPrice: number;
  defaultPhysicalTruth: ProductPhysicalTruth;
  theme: ProductThemeConfig;
  previewImage: string;
  sampleHighlights: string[];
}

// ============================================================================
// 1. TAXONOMÍA MASIVA DE NICHOS COD PARAGUAY (13 CATEGORÍAS PRINCIPALES)
// ============================================================================
export const NICHE_CATEGORIES: NicheCategoryDef[] = [
  {
    id: 'all',
    name: 'Todas las Plantillas',
    shortName: 'Todas',
    icon: '🔥',
    description: 'Catálogo completo de plantillas móviles de alta conversión para Cobro Contra Entrega en Paraguay.',
    paraguayDemandLevel: 'Explosiva',
    typicalProducts: ['Todos los nichos COD']
  },
  {
    id: 'niche-original',
    name: 'Plantilla Madre Original (Noelux App)',
    shortName: 'Original Noelux',
    icon: '🌟',
    description: 'La arquitectura móvil exacta de Noelux™ que parece una aplicación nativa de celular.',
    paraguayDemandLevel: 'Explosiva',
    typicalProducts: ['Proyector Navideño', 'Productos Estrella Multipropósito']
  },
  {
    id: 'niche-cocina',
    name: 'Cocina & Gastronomía Práctica',
    shortName: 'Cocina',
    icon: '🍳',
    description: 'El nicho #1 en volumen de ventas contra entrega para amas de casa y familias en Paraguay.',
    paraguayDemandLevel: 'Explosiva',
    typicalProducts: ['Freidoras de Aire', 'Sartenes Antiadherentes Titanio', 'Picadoras Eléctricas', 'Selladoras al Vacío', 'Wafleras']
  },
  {
    id: 'niche-hogar',
    name: 'Hogar, Limpieza & Organización',
    shortName: 'Hogar & Limpieza',
    icon: '🏠',
    description: 'Soluciones visuales de "Antes y Después" inmediato que se viralizan en Meta Ads y TikTok.',
    paraguayDemandLevel: 'Explosiva',
    typicalProducts: ['Cepillos Eléctricos 7 en 1', 'Mopas Centrifugadoras', 'Mini Aires Portátiles', 'Organizadores', 'Atrapa-Mosquitos']
  },
  {
    id: 'niche-exterior',
    name: 'Iluminación, Jardín & Exterior',
    shortName: 'Iluminación & Patio',
    icon: '💡',
    description: 'Productos para fachada, patio, quincho y ahorro en factura de ANDE resistentes a lluvias.',
    paraguayDemandLevel: 'Muy Alta',
    typicalProducts: ['Proyectores Láser', 'Focos Solares con Sensor IP65', 'Mangueras Expandibles', 'Guirnaldas Solares']
  },
  {
    id: 'niche-deporte',
    name: 'Deporte, Fitness & Modelado Corporal',
    shortName: 'Deporte & Fitness',
    icon: '💪',
    description: 'Entrenamiento en casa, tonificación muscular sin gimnasio y quema calórica rápida.',
    paraguayDemandLevel: 'Muy Alta',
    typicalProducts: ['Electroestimuladores EMS', 'Bandas de Resistencia', 'Ruedas Abdominales', 'Fajas Térmicas Neotex']
  },
  {
    id: 'niche-salud',
    name: 'Salud, Alivio del Dolor & Ortopedia',
    shortName: 'Salud & Alivio',
    icon: '🩺',
    description: 'Compras por urgencia emocional: alivio de cuello, espalda, rodillas, postura y descanso.',
    paraguayDemandLevel: 'Explosiva',
    typicalProducts: ['Masajeador Cervical Shiatsu', 'Pistola de Masaje', 'Corrector de Postura', 'Rodilleras Ortopédicas', 'Almohadas Memory Foam']
  },
  {
    id: 'niche-belleza',
    name: 'Belleza, Skincare & Cuidado Capilar',
    shortName: 'Belleza & Capilar',
    icon: '✨',
    description: 'Resultados de salón de belleza en casa con altísima recompra y venta por Pack de 2.',
    paraguayDemandLevel: 'Explosiva',
    typicalProducts: ['Cepillo Secador 5 en 1', 'Planchita de Titanio', 'Depiladora Láser/Cristal', 'Máscara LED Facial', 'Quitaporos']
  },
  {
    id: 'niche-barberia',
    name: 'Barbería & Grooming Masculino',
    shortName: 'Barbería Hombre',
    icon: '💈',
    description: 'Corte de precisión, perfilado de barba y máquinas recargables de cuerpo metálico.',
    paraguayDemandLevel: 'Alta Constante',
    typicalProducts: ['Patillera Vintage T9', 'Afeitadora Rotativa Impermeable', 'Kit Barbería Profesional', 'Plancha de Barba']
  },
  {
    id: 'niche-herramientas',
    name: 'Herramientas, Taller & Construcción',
    shortName: 'Herramientas',
    icon: '🛠️',
    description: 'Potencia portátil e inalámbrica para el hogar, quinta, carpintería y mecánica.',
    paraguayDemandLevel: 'Explosiva',
    typicalProducts: ['Minisierra Eléctrica a Batería', 'Taladro Percutor Inalámbrico', 'Soldadora Portátil', 'Maletín Bocallaves']
  },
  {
    id: 'niche-auto',
    name: 'Auto, Moto & Ruta',
    shortName: 'Auto & Moto',
    icon: '🚗',
    description: 'Seguridad en ruta, emergencia mecánica y estética vehicular para conductores.',
    paraguayDemandLevel: 'Muy Alta',
    typicalProducts: ['Compresor Digital Portátil', 'Arrancador de Batería + Powerbank', 'Aspiradora 12V', 'Cámara Dashcam Dual']
  },
  {
    id: 'niche-seguridad',
    name: 'Seguridad Inteligente & Cámaras WiFi',
    shortName: 'Seguridad & WiFi',
    icon: '🛡️',
    description: 'Vigilancia desde el celular 24/7 sin pagar mensualidades, ideal para vender en Pack de 2 y 3.',
    paraguayDemandLevel: 'Explosiva',
    typicalProducts: ['Cámara Domo WiFi 360° Foco', 'Cámara Exterior Doble Lente IP66', 'Timbre Inalámbrico con Cámara', 'Alarma Sensor']
  },
  {
    id: 'niche-tecnologia',
    name: 'Tecnología, Audio & Gadgets',
    shortName: 'Tecnología',
    icon: '⌚',
    description: 'Gadgets de alto valor percibido con combos de regalo ideales para fecha de cobro.',
    paraguayDemandLevel: 'Muy Alta',
    typicalProducts: ['Smartwatch Ultra 7 Mallas', 'Auriculares Inalámbricos Pro', 'Mini Proyector Smart TV', 'Cargador Magnético']
  },
  {
    id: 'niche-mascotas',
    name: 'Mascotas, Bebés & Tiempo Libre',
    shortName: 'Mascotas & Libre',
    icon: '🐾',
    description: 'Productos de compra impulsiva para el cuidado de mascotas, niños, pesca y camping.',
    paraguayDemandLevel: 'Alta Constante',
    typicalProducts: ['Cepillo a Vapor para Mascotas', 'Cama Antiestrés', 'Linterna Táctica Largo Alcance', 'Carpa Automática']
  }
];

// ============================================================================
// 2. PALETAS Y TEMAS VISUALES MÓVILES POR SUBNICHO
// ============================================================================
export const SUBNICHE_TEMPLATES: SubNicheTemplateDef[] = [
  // 0. ORIGINAL NOELUX
  {
    id: 'tpl-noelux-original',
    nicheId: 'niche-original',
    name: 'Noelux™ App-Mobile Original (Esmeralda & Oro)',
    subNicheLabel: 'Arquitectura Madre App Móvil',
    badge: '⭐ PLANTILLA MADRE #1',
    conversionRateAvg: '6.8% CVR Móvil',
    description: 'Exactamente el mismo diseño tipo aplicación móvil nativa de tu página principal Noelux: cabecera verde esmeralda profundo, detalles dorados, galería 1:1 de 8 fotos, video en vivo y selector de Packs 1/2/3.',
    idealForProducts: ['Proyector Navideño', 'Iluminación Decorativa', 'Cualquier Producto Estrella COD'],
    winnerAngleHook: 'Transformación visual instantánea en 90 segundos sin esfuerzo y con blindaje para el clima de Paraguay.',
    defaultPricePack1: 189000,
    defaultPricePack2: 358000,
    defaultPricePack3: 507000,
    defaultNormalPrice: 249000,
    defaultPhysicalTruth: {
      powerSource: 'enchufe_220v',
      powerSourceLabel: 'Enchufe directo 220V (cable de 5 metros incluido)',
      realDimensions: '11 cm × 12 cm (con estaca de 20 cm)',
      weightApprox: '300 gramos',
      materialMain: 'ABS Industrial + Sellado de Silicona IP65',
      boxContents: '1 Proyector HD, 12 motivos integrados, estaca para césped, base para piso y cable de 5m 220V',
      waterResistance: 'Impermeable IP65 (resiste lluvia intensa y sereno)',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-noelux-emerald',
      name: 'Esmeralda Real & Oro',
      headerBg: 'from-[#041a12] via-[#083022] to-[#041a12]',
      topStripBg: 'bg-[#e8b23a] text-[#062319]',
      primaryBg: 'bg-[#0b3d2e]',
      primaryText: 'text-[#0b3d2e]',
      accentBg: 'bg-[#e8b23a]',
      accentText: 'text-[#ffd778]',
      ctaGradient: 'from-[#1ea856] to-[#12803d]',
      pageBg: 'bg-stone-50',
      cardBorder: 'border-[#dfdad0]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'noelux-classic',
    buttonShape: 'rounded-2xl',
    badgeStyle: 'golden-seal'
  },
    previewImage: '/src/assets/images/noelux_fachada_jardin_1793968638764.jpg',
    sampleHighlights: [
      'Diseño idéntico a App Móvil Nativa',
      'Galería 8 fotos 1:1 + Video HD en vivo',
      'Selector psicológico Pack 1, 2 y 3',
      'Formulario Casa vs Edificio + Mapa GPS'
    ]
  },

  // 1. COCINA & GASTRONOMÍA (4 Subnichos)
  {
    id: 'tpl-cocina-electro',
    nicheId: 'niche-cocina',
    name: 'Culinary Express™ (Electrodomésticos Rápidos)',
    subNicheLabel: 'Cocina · Electrodomésticos de Ahorro de Tiempo',
    badge: '🔥 TOP #1 COCINA PY',
    conversionRateAvg: '7.2% CVR Móvil',
    description: 'Diseñada especialmente para Freidoras de Aire, Picadoras Eléctricas, Licuadoras Portátiles y Wafleras. Paleta cálida terracota y crema que despierta el apetito y destaca el ahorro de tiempo y aceite.',
    idealForProducts: ['Freidora de Aire Digital', 'Picadora Eléctrica de Acero 2L', 'Licuadora Portátil USB', 'Waflera / Sandwichera'],
    winnerAngleHook: 'Cociná en 5 minutos sin ensuciar ollas, ahorrando hasta 85% de aceite y electricidad.',
    defaultPricePack1: 179000,
    defaultPricePack2: 329000,
    defaultPricePack3: 469000,
    defaultNormalPrice: 245000,
    defaultPhysicalTruth: {
      powerSource: 'enchufe_220v',
      powerSourceLabel: 'Conexión directa a 220V (enchufe estándar de Paraguay)',
      realDimensions: '24 cm × 18 cm (capacidad familiar)',
      weightApprox: '1.1 kg',
      materialMain: 'Acero Inoxidable 304 Grado Alimenticio + ABS Térmico',
      boxContents: 'Equipo principal en caja sellada, cuchillas/accesorio de acero inoxidable y manual en español',
      waterResistance: 'Recipiente lavable bajo canilla (motor sellado)',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-culinary-terracotta',
      name: 'Terracota Gourmet & Cobre',
      headerBg: 'from-[#2a0f08] via-[#4a1c10] to-[#2a0f08]',
      topStripBg: 'bg-[#f59e0b] text-[#1c0a05]',
      primaryBg: 'bg-[#7c2d12]',
      primaryText: 'text-[#7c2d12]',
      accentBg: 'bg-[#f59e0b]',
      accentText: 'text-[#fde68a]',
      ctaGradient: 'from-[#ea580c] to-[#c2410c]',
      pageBg: 'bg-[#fffaf5]',
      cardBorder: 'border-[#fed7aa]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'warm-culinary',
    buttonShape: 'rounded-lg',
    badgeStyle: 'pill-solid'
  },
    previewImage: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Bloque de "Tiempo de Cocción vs Método Tradicional"',
      'Énfasis en Acero Inoxidable y fácil lavado',
      'Ideal para vender Pack 2 (1 para casa + 1 para mamá/regalo)'
    ]
  },
  {
    id: 'tpl-cocina-sartenes',
    nicheId: 'niche-cocina',
    name: 'Chef Titanio™ (Sartenes Antiadherentes & Cuchillería)',
    subNicheLabel: 'Cocina · Antiadherentes, Ollas & Cuchillos',
    badge: '💎 ALTA GAMA COCINA',
    conversionRateAvg: '6.5% CVR Móvil',
    description: 'Estética de estudio gastronómico en grafito oscuro, cobre y dorado. Perfecta para Sartenes de Roca Volcánica/Titanio, Juegos de Ollas y Sets de Cuchillos Profesionales.',
    idealForProducts: ['Sartén Antiadherente Roca Volcánica', 'Set de Cuchillos Chef 6 Piezas', 'Olla Multifunción Antiadherente'],
    winnerAngleHook: 'Cero comida pegada sin usar ni una gota de aceite: limpiás pasando una servilleta en 3 segundos.',
    defaultPricePack1: 199000,
    defaultPricePack2: 369000,
    defaultPricePack3: 519000,
    defaultNormalPrice: 279000,
    defaultPhysicalTruth: {
      powerSource: 'manual_sin_energia',
      powerSourceLabel: 'Apto para cocina a gas, placa eléctrica e inducción',
      realDimensions: '28 cm de diámetro × 5.5 cm de profundidad',
      weightApprox: '950 gramos',
      materialMain: 'Aleación multicapa con recubrimiento de Titanio / Piedra Mineral',
      boxContents: '1 Sartén/Utensilio principal + mango ergonómico atérmico en caja reforzada',
      waterResistance: '100% lavable y resistente a altas temperaturas',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-chef-graphite',
      name: 'Grafito Chef & Cobre',
      headerBg: 'from-[#111827] via-[#1f2937] to-[#111827]',
      topStripBg: 'bg-[#d97706] text-white',
      primaryBg: 'bg-[#1f2937]',
      primaryText: 'text-[#111827]',
      accentBg: 'bg-[#d97706]',
      accentText: 'text-[#fcd34d]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-stone-100',
      cardBorder: 'border-stone-300',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'brutalist-industrial',
    buttonShape: 'rounded-none',
    badgeStyle: 'hazard-tag'
  },
    previewImage: 'https://images.unsplash.com/photo-1584990347449-399c56434440?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Demostración de "Prueba Cero Pegado (Huevo y Queso)"',
      'Radiografía de las 5 capas del material',
      'Comparativa contra el teflón común que se raya'
    ]
  },
  {
    id: 'tpl-cocina-conservacion',
    nicheId: 'niche-cocina',
    name: 'FreshLock™ (Selladoras al Vacío & Orden de Heladera)',
    subNicheLabel: 'Cocina · Conservación y Ahorro Familiar',
    badge: '💰 AHORRO FAMILIAR',
    conversionRateAvg: '6.4% CVR Móvil',
    description: 'Diseño fresco en verde menta y pizarra enfocado en el ahorro económico mensual al evitar que la carne, verduras y alimentos se echen a perder en el freezer.',
    idealForProducts: ['Selladora al Vacío Automática', 'Set Contenedores Herméticos', 'Dispensador de Granos 6 en 1'],
    winnerAngleHook: 'Mantené la carne, queso y verduras frescas hasta 5 veces más tiempo sin quemaduras de freezer.',
    defaultPricePack1: 159000,
    defaultPricePack2: 289000,
    defaultPricePack3: 419000,
    defaultNormalPrice: 220000,
    defaultPhysicalTruth: {
      powerSource: 'enchufe_220v',
      powerSourceLabel: 'Conexión directa a 220V',
      realDimensions: '36 cm × 6.5 cm × 5 cm',
      weightApprox: '600 gramos',
      materialMain: 'ABS de Alta Resistencia + Banda Térmica de Sellado',
      boxContents: '1 Selladora al vacío + Pack de bolsas gofradas de regalo listas para usar',
      waterResistance: 'Limpieza en seco en el cabezal térmico',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-fresh-mint',
      name: 'Verde Frescura & Pizarra',
      headerBg: 'from-[#064e3b] via-[#047857] to-[#064e3b]',
      topStripBg: 'bg-[#fde047] text-[#064e3b]',
      primaryBg: 'bg-[#047857]',
      primaryText: 'text-[#064e3b]',
      accentBg: 'bg-[#10b981]',
      accentText: 'text-[#a7f3d0]',
      ctaGradient: 'from-[#059669] to-[#047857]',
      pageBg: 'bg-[#f0fdf4]',
      cardBorder: 'border-[#bbf7d0]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'nordic-clinical',
    buttonShape: 'rounded-full',
    badgeStyle: 'clinical-badge'
  },
    previewImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Calculadora visual de ahorro mensual en supermercado',
      'Demostración paso 1-2-3 en 10 segundos',
      'Excelente conversión con regalo de bolsas extra en Pack 2'
    ]
  },
  {
    id: 'tpl-cocina-reposteria',
    nicheId: 'niche-cocina',
    name: 'DulceHogar™ (Repostería, Cafetería & Utensilios)',
    subNicheLabel: 'Cocina · Repostería, Mate & Café',
    badge: '☕ FAVORITO HOGAR',
    conversionRateAvg: '6.1% CVR Móvil',
    description: 'Estética cálida borgoña y crema pastel para batidoras manuales, espumadores, cafeteras express, moldes de silicona y termos inteligentes.',
    idealForProducts: ['Batidora Inalámbrica Recargable', 'Cafetera Express Portátil', 'Set Moldes Silicona para Airfryer'],
    winnerAngleHook: 'Prepará desayunos, meriendas y postres caseros como de confitería en la mitad de tiempo.',
    defaultPricePack1: 149000,
    defaultPricePack2: 269000,
    defaultPricePack3: 379000,
    defaultNormalPrice: 199000,
    defaultPhysicalTruth: {
      powerSource: 'bateria_usb',
      powerSourceLabel: 'Batería recargable por cable USB (incluido)',
      realDimensions: '20 cm × 9 cm',
      weightApprox: '380 gramos',
      materialMain: 'Acero Inoxidable + Silicona Libre de BPA',
      boxContents: 'Equipo completo con accesorios intercambiables y cable cargador USB',
      waterResistance: 'Accesorios desmontables 100% lavables',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-artisan-berry',
      name: 'Borgoña Pastel & Oro',
      headerBg: 'from-[#3b071e] via-[#590d2e] to-[#3b071e]',
      topStripBg: 'bg-[#fbbf24] text-[#3b071e]',
      primaryBg: 'bg-[#701a40]',
      primaryText: 'text-[#590d2e]',
      accentBg: 'bg-[#f59e0b]',
      accentText: 'text-[#fde68a]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-[#fdf2f8]',
      cardBorder: 'border-[#fbcfe8]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'natural-organic',
    buttonShape: 'rounded-2xl',
    badgeStyle: 'minimal-tag'
  },
    previewImage: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Enfoque en practicidad para meriendas y familia',
      'Ideal para ticket accesible y venta por volumen'
    ]
  },

  // 2. HOGAR, LIMPIEZA & ORGANIZACIÓN (4 Subnichos)
  {
    id: 'tpl-hogar-limpieza',
    nicheId: 'niche-hogar',
    name: 'CleanTurbo™ (Cepillos Eléctricos, Mopas & Hidrolavadoras)',
    subNicheLabel: 'Hogar · Limpieza Rápida Sin Esfuerzo',
    badge: '⚡ VIRAL EN TIKTOK/META',
    conversionRateAvg: '7.4% CVR Móvil',
    description: 'Paleta azul cobalto limpio y blanco clínico. Especialmente diseñada para mostrar el contraste "Antes (Sucio) vs Después (Brillante)" sin agacharse ni fregar.',
    idealForProducts: ['Cepillo Eléctrico Giratorio 7 en 1', 'Mopa Centrifugadora Acero', 'Hidrolavadora Portátil a Batería'],
    winnerAngleHook: 'Limpiá baño, azulejos, cocina y pisos en 5 minutos sin agacharte ni lastimarte la cintura.',
    defaultPricePack1: 169000,
    defaultPricePack2: 315000,
    defaultPricePack3: 449000,
    defaultNormalPrice: 239000,
    defaultPhysicalTruth: {
      powerSource: 'bateria_usb',
      powerSourceLabel: 'Batería recargable de larga duración (sin cables molestos)',
      realDimensions: 'Extensible de 45 cm hasta 115 cm',
      weightApprox: '750 gramos',
      materialMain: 'ABS Impermeable + Varilla de Acero Inoxidable',
      boxContents: 'Mango motorizado, brazo extensible, cabezales intercambiables y cable de carga USB',
      waterResistance: 'Cabezal resistente al agua y espuma (IPX7)',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-clean-cobalt',
      name: 'Azul Clínico & Menta',
      headerBg: 'from-[#0c2442] via-[#133b6e] to-[#0c2442]',
      topStripBg: 'bg-[#38bdf8] text-[#081b33]',
      primaryBg: 'bg-[#1d4ed8]',
      primaryText: 'text-[#1e3a8a]',
      accentBg: 'bg-[#0ea5e9]',
      accentText: 'text-[#bae6fd]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-[#f8fafc]',
      cardBorder: 'border-[#bfdbfe]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'nordic-clinical',
    buttonShape: 'rounded-lg',
    badgeStyle: 'clinical-badge'
  },
    previewImage: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Comparativa directa: Fregar a mano vs Motor Giratorio',
      'Guía visual de para qué sirve cada cabezal incluido',
      'Altísima tasa de cierre en mujeres de 28 a 65 años'
    ]
  },
  {
    id: 'tpl-hogar-organizacion',
    nicheId: 'niche-hogar',
    name: 'OrdenTotal™ (Organizadores de Baño, Cocina & Ropa)',
    subNicheLabel: 'Hogar · Optimización de Espacios',
    badge: '📦 ALTO TICKET PACK 3',
    conversionRateAvg: '6.3% CVR Móvil',
    description: 'Diseño minimalista escandinavo en arena y verde pino. Ideal para estantes sin taladro, zapateros armables, perchas mágicas y organizadores.',
    idealForProducts: ['Estante Esquinero Sin Taladro', 'Zapatero Modular 9 Niveles', 'Organizador Bajo Mesada'],
    winnerAngleHook: 'Multiplicá por 3 el espacio de tu casa en 2 minutos sin agujerear la pared ni usar herramientas.',
    defaultPricePack1: 145000,
    defaultPricePack2: 259000,
    defaultPricePack3: 359000,
    defaultNormalPrice: 195000,
    defaultPhysicalTruth: {
      powerSource: 'manual_sin_energia',
      powerSourceLabel: 'Instalación directa sin electricidad ni taladro',
      realDimensions: '32 cm × 22 cm × 40 cm',
      weightApprox: '800 gramos',
      materialMain: 'Acero al Carbono Pintura Electrostática Anticorrosión',
      boxContents: 'Estructura completa lista para encastrar + soportes adhesivos de alta carga',
      waterResistance: 'Inoxidable (apto para ducha y humedad)',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-nordic-sand',
      name: 'Minimalista Arena & Pino',
      headerBg: 'from-[#1c2826] via-[#2b3d3a] to-[#1c2826]',
      topStripBg: 'bg-[#f59e0b] text-[#1c2826]',
      primaryBg: 'bg-[#2b3d3a]',
      primaryText: 'text-[#1c2826]',
      accentBg: 'bg-[#d97706]',
      accentText: 'text-[#fde68a]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-[#faf8f5]',
      cardBorder: 'border-[#e7e5e4]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'minimalist-luxury',
    buttonShape: 'rounded-none',
    badgeStyle: 'minimal-tag'
  },
    previewImage: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'El 60% de los clientes elige Pack 2 o Pack 3 para varios ambientes',
      'Demostración de resistencia en kilos sin despegarse'
    ]
  },
  {
    id: 'tpl-hogar-clima',
    nicheId: 'niche-hogar',
    name: 'ClimaFresh™ (Mini Aires, Ventiladores & Humidificadores)',
    subNicheLabel: 'Hogar · Calor de Paraguay & Confort',
    badge: '❄️ ESPECIAL VERANO PY',
    conversionRateAvg: '7.1% CVR Móvil',
    description: 'Diseñada específicamente para el calor de Paraguay: tonos hielo, azul ártico y turquesa con calculadora de ahorro frente al aire acondicionado tradicional.',
    idealForProducts: ['Mini Aire Enfriador Evaporativo', 'Ventilador Recargable con Luz LED', 'Humidificador Aromático'],
    winnerAngleHook: 'Refrescá tu pieza o escritorio al instante con agua fría/hielo gastando 90% menos en la factura de ANDE.',
    defaultPricePack1: 169000,
    defaultPricePack2: 309000,
    defaultPricePack3: 439000,
    defaultNormalPrice: 235000,
    defaultPhysicalTruth: {
      powerSource: 'bateria_usb',
      powerSourceLabel: 'Conexión USB 5V (funciona con cargador de celular, notebook o powerbank)',
      realDimensions: '21 cm × 16 cm × 9 cm',
      weightApprox: '680 gramos',
      materialMain: 'ABS Térmico + Tanque Superior Antiderrame de 600ml',
      boxContents: '1 Enfriador con 5 atomizadores, luz nocturna LED, cable USB y manual',
      waterResistance: 'Tanque hermético para agua fría y cubos de hielo',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-arctic-breeze',
      name: 'Hielo Ártico & Marino',
      headerBg: 'from-[#082f49] via-[#0369a1] to-[#082f49]',
      topStripBg: 'bg-[#22d3ee] text-[#082f49]',
      primaryBg: 'bg-[#0284c7]',
      primaryText: 'text-[#0c4a6e]',
      accentBg: 'bg-[#06b6d4]',
      accentText: 'text-[#a5f3fc]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-[#f0f9ff]',
      cardBorder: 'border-[#bae6fd]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'futuristic-cyber',
    buttonShape: 'rounded-full',
    badgeStyle: 'cyber-chip'
  },
    previewImage: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Ángulo imbatible contra el calor paraguayo y cortes de luz',
      'Enfoque en bajo consumo eléctrico y portabilidad'
    ]
  },
  {
    id: 'tpl-hogar-plagas',
    nicheId: 'niche-hogar',
    name: 'BioEscudo™ (Control de Mosquitos, Dengue & Plagas)',
    subNicheLabel: 'Hogar · Protección Familiar Sin Venenos',
    badge: '🛡️ ALTA DEMANDA EN PY',
    conversionRateAvg: '6.9% CVR Móvil',
    description: 'Urgencia familiar en Paraguay contra mosquitos y plagas sin humo ni aerosoles tóxicos para niños o mascotas.',
    idealForProducts: ['Lámpara UV Atrapa-Mosquitos Silenciosa', 'Repelente Ultrasónico de Enchufe', 'Raqueta Eléctrica Recargable 2 en 1'],
    winnerAngleHook: 'Dormí toda la noche sin zumbidos ni picaduras y protegé a tus hijos sin usar espirales ni venenos.',
    defaultPricePack1: 149000,
    defaultPricePack2: 269000,
    defaultPricePack3: 369000,
    defaultNormalPrice: 210000,
    defaultPhysicalTruth: {
      powerSource: 'enchufe_220v',
      powerSourceLabel: 'Bajo consumo continuo (enchufe o USB según modelo)',
      realDimensions: '19 cm × 11 cm',
      weightApprox: '320 gramos',
      materialMain: 'ABS Ignífugo con rejilla de seguridad infantil',
      boxContents: '1 Equipo atrapa-mosquitos/repelente en caja sellada + cepillo de limpieza',
      waterResistance: 'Uso interior y galerías techadas',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-bioshield-forest',
      name: 'Verde BioEscudo & Ámbar',
      headerBg: 'from-[#052e16] via-[#14532d] to-[#052e16]',
      topStripBg: 'bg-[#facc15] text-[#052e16]',
      primaryBg: 'bg-[#166534]',
      primaryText: 'text-[#14532d]',
      accentBg: 'bg-[#eab308]',
      accentText: 'text-[#fef08a]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-[#f7fee7]',
      cardBorder: 'border-[#bef264]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'natural-organic',
    buttonShape: 'rounded-lg',
    badgeStyle: 'hazard-tag'
  },
    previewImage: 'https://images.unsplash.com/photo-1541689592655-f5f52825a3b8?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Altísima venta en Pack de 3 (1 por cada dormitorio)',
      'Comparativa de gasto mensual en aerosoles vs pago único'
    ]
  },

  // 3. ILUMINACIÓN, JARDÍN & EXTERIOR (3 Subnichos)
  {
    id: 'tpl-exterior-proyector',
    nicheId: 'niche-exterior',
    name: 'LuminaPro™ (Proyectores Ópticos & Decoración Fachadas)',
    subNicheLabel: 'Exterior · Proyección e Iluminación Festiva',
    badge: '✨ ESPECIAL FACHADAS',
    conversionRateAvg: '6.8% CVR Móvil',
    description: 'Variante optimizada para proyectores láser, proyectores de galaxia y luces de eventos resistentes al exterior.',
    idealForProducts: ['Proyector Navideño 12 Diseños', 'Proyector Galaxia Astronauta', 'Cortina LED Impermeable'],
    winnerAngleHook: 'Cubrí hasta 70 m² de pared o techo en 90 segundos sin subir a escaleras ni enredar cables.',
    defaultPricePack1: 189000,
    defaultPricePack2: 358000,
    defaultPricePack3: 507000,
    defaultNormalPrice: 249000,
    defaultPhysicalTruth: {
      powerSource: 'enchufe_220v',
      powerSourceLabel: 'Enchufe directo 220V con transformador sellado',
      realDimensions: '11 cm × 12 cm',
      weightApprox: '300 gramos',
      materialMain: 'ABS Industrial + Lentes Ópticos HD IP65',
      boxContents: '1 Proyector, estaca de jardín, base de apoyo y cable de 5 metros',
      waterResistance: 'Impermeable IP65 para lluvia e intemperie',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-lumina-night',
      name: 'Noche Esmeralda & Dorado',
      headerBg: 'from-[#041a12] via-[#083022] to-[#041a12]',
      topStripBg: 'bg-[#e8b23a] text-[#062319]',
      primaryBg: 'bg-[#0b3d2e]',
      primaryText: 'text-[#0b3d2e]',
      accentBg: 'bg-[#e8b23a]',
      accentText: 'text-[#ffd778]',
      ctaGradient: 'from-[#1ea856] to-[#12803d]',
      pageBg: 'bg-stone-50',
      cardBorder: 'border-[#dfdad0]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'noelux-classic',
    buttonShape: 'rounded-2xl',
    badgeStyle: 'golden-seal'
  },
    previewImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Demostración nocturna de alto contraste',
      'Prueba de lluvia IP65 y alcance en metros cuadrados'
    ]
  },
  {
    id: 'tpl-exterior-solar',
    nicheId: 'niche-exterior',
    name: 'SolarMax ANDE-Cero™ (Focos Solares con Sensor IP65)',
    subNicheLabel: 'Exterior · Iluminación Solar Sin Cables',
    badge: '☀️ CERO GASTO ANDE',
    conversionRateAvg: '7.3% CVR Móvil',
    description: 'Uno de los productos más vendidos en todo el Paraguay: reflectores solares con sensor de movimiento y control remoto.',
    idealForProducts: ['Reflector Solar COB con Sensor y Control', 'Farol Solar Tipo Alumbrado Público', 'Kit 2 Focos Solares Pared'],
    winnerAngleHook: 'Iluminá tu patio, portón y vereda toda la noche gratis con energía del sol y sin pagar un guaraní más a la ANDE.',
    defaultPricePack1: 159000,
    defaultPricePack2: 289000,
    defaultPricePack3: 399000,
    defaultNormalPrice: 229000,
    defaultPhysicalTruth: {
      powerSource: 'solar',
      powerSourceLabel: '100% Energía Solar (batería de litio interna que carga de día y prende sola de noche)',
      realDimensions: '28 cm × 14 cm',
      weightApprox: '520 gramos',
      materialMain: 'Policarbonato Blindado IP65 + Panel Solar Policristalino',
      boxContents: 'Reflector solar, control remoto, soporte articulado y tarugos/tornillos de fijación',
      waterResistance: 'Blindaje IP65 (resiste tormentas fuertes y sol extremo)',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-solar-midnight',
      name: 'Medianoche Solar & Oro',
      headerBg: 'from-[#090d16] via-[#111827] to-[#090d16]',
      topStripBg: 'bg-[#facc15] text-[#090d16]',
      primaryBg: 'bg-[#1e293b]',
      primaryText: 'text-[#0f172a]',
      accentBg: 'bg-[#eab308]',
      accentText: 'text-[#fde047]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-slate-50',
      cardBorder: 'border-slate-300',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'brutalist-industrial',
    buttonShape: 'rounded-none',
    badgeStyle: 'hazard-tag'
  },
    previewImage: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Explicación de los 3 modos del sensor inteligente nocturno',
      'Más del 65% de compradores lleva Pack 2 o Pack 3 para cubrir patio y frente'
    ]
  },
  {
    id: 'tpl-exterior-jardin',
    nicheId: 'niche-exterior',
    name: 'AgroJardín™ (Mangueras Expandibles, Riego & Patio)',
    subNicheLabel: 'Exterior · Jardín, Lavado de Auto y Quinta',
    badge: '🌿 PATIO & QUINTA',
    conversionRateAvg: '6.5% CVR Móvil',
    description: 'Tonos verde bosque y tierra firme para mangueras mágicas expandibles con pico de 7 chorros, bordeadoras y pulverizadores.',
    idealForProducts: ['Manguera Expandible 30m con Pistola 7 Chorros', 'Pulverizador Eléctrico a Batería', 'Bordeadora Portátil'],
    winnerAngleHook: 'Se estira sola hasta 3 veces su tamaño con la presión del agua y nunca se dobla ni se estrangula.',
    defaultPricePack1: 159000,
    defaultPricePack2: 289000,
    defaultPricePack3: 409000,
    defaultNormalPrice: 219000,
    defaultPhysicalTruth: {
      powerSource: 'manual_sin_energia',
      powerSourceLabel: 'Funciona con la presión normal de la canilla de tu casa',
      realDimensions: 'Se expande hasta 30 metros con el paso del agua',
      weightApprox: '650 gramos',
      materialMain: 'Látex de Triple Capa + Tejido Poliéster de Alta Densidad + Punteros Reforzados',
      boxContents: 'Manguera expandible, pistola regadora de 7 posiciones y acoples para canilla',
      waterResistance: 'Uso 100% exterior e hidráulico',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-garden-botanical',
      name: 'Verde Jardín & Tierra',
      headerBg: 'from-[#14331d] via-[#1e4d2b] to-[#14331d]',
      topStripBg: 'bg-[#84cc16] text-[#0f2916]',
      primaryBg: 'bg-[#15803d]',
      primaryText: 'text-[#14532d]',
      accentBg: 'bg-[#65a30d]',
      accentText: 'text-[#d9f99d]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-[#f7fee7]',
      cardBorder: 'border-[#d9f99d]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'natural-organic',
    buttonShape: 'rounded-full',
    badgeStyle: 'pill-solid'
  },
    previewImage: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Demostración de los 7 modos de chorro (desde niebla para plantas hasta chorro fuerte para vereda y auto)'
    ]
  },

  // 4. DEPORTE, FITNESS & MODELADO CORPORAL (3 Subnichos)
  {
    id: 'tpl-deporte-ems',
    nicheId: 'niche-deporte',
    name: 'PulseFit EMS™ (Tonificación Muscular en Casa)',
    subNicheLabel: 'Deporte · Tonificación Abdominal y Corporal',
    badge: '⚡ ALTA CONVERSIÓN',
    conversionRateAvg: '6.7% CVR Móvil',
    description: 'Diseño atlético en carbono y verde lima neón. Ideal para electroestimuladores abdominales/glúteos, plataformas vibratorias y tonificadores.',
    idealForProducts: ['Kit Electroestimulador EMS Abdomen + Brazos', 'Tonificador de Glúteos EMS', 'Masajeador Reductor'],
    winnerAngleHook: '20 minutos al día mientras mirás tele o trabajás equivalen a 150 abdominales localizados sin forzar la columna.',
    defaultPricePack1: 169000,
    defaultPricePack2: 309000,
    defaultPricePack3: 429000,
    defaultNormalPrice: 239000,
    defaultPhysicalTruth: {
      powerSource: 'bateria_usb',
      powerSourceLabel: '3 módulos recargables por cable USB triple incluido',
      realDimensions: 'Parche central 19×17 cm + 2 parches de brazos/piernas 20×7 cm',
      weightApprox: '280 gramos',
      materialMain: 'Hidrogel Conductivo Hipoalergénico + Polímero Flexible',
      boxContents: '1 Parche abdominal, 2 parches para brazos/piernas, 3 módulos de control recargables y cable USB',
      waterResistance: 'Resistente al sudor corporal',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-fitness-neon',
      name: 'Carbono Fitness & Verde Lima',
      headerBg: 'from-[#090d16] via-[#111827] to-[#090d16]',
      topStripBg: 'bg-[#84cc16] text-[#090d16]',
      primaryBg: 'bg-[#111827]',
      primaryText: 'text-[#111827]',
      accentBg: 'bg-[#65a30d]',
      accentText: 'text-[#bef264]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-zinc-50',
      cardBorder: 'border-zinc-300',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'athletic-performance',
    buttonShape: 'rounded-none',
    badgeStyle: 'cyber-chip'
  },
    previewImage: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Guía de los 6 programas y 9 niveles de intensidad',
      'Enfoque en personas sin tiempo para ir al gimnasio'
    ]
  },
  {
    id: 'tpl-deporte-fuerza',
    nicheId: 'niche-deporte',
    name: 'TitanGym Casa™ (Ruedas Abdominales, Bandas & Calistenia)',
    subNicheLabel: 'Deporte · Entrenamiento de Fuerza en Casa',
    badge: '🏋️ GIMNASIO EN CASA',
    conversionRateAvg: '6.4% CVR Móvil',
    description: 'Estética deportiva intensa en negro obsidiana y rojo carmesí para ruedas abdominales con rebote automático, sets de bandas elásticas y barras.',
    idealForProducts: ['Rueda Abdominal con Rebote Automático y Codera', 'Set 11 Piezas Bandas de Resistencia', 'Tabla de Flexiones 14 en 1'],
    winnerAngleHook: 'Entrená pecho, abdomen, brazos y espalda en 2 metros cuadrados de tu pieza con rebote asistido que cuida tu cintura.',
    defaultPricePack1: 179000,
    defaultPricePack2: 329000,
    defaultPricePack3: 459000,
    defaultNormalPrice: 249000,
    defaultPhysicalTruth: {
      powerSource: 'manual_sin_energia',
      powerSourceLabel: 'Sistema mecánico de resorte de rebote interno (no requiere electricidad)',
      realDimensions: '38 cm × 24 cm (doble rueda ancha antideslizante)',
      weightApprox: '1.3 kg',
      materialMain: 'Acero Reforzado + Caucho Silencioso + Espuma EVA de Alta Densidad',
      boxContents: 'Rueda doble con rebote automático, soporte para celular y alfombrilla para rodillas',
      waterResistance: 'Lavable y resistente al sudor',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-gym-crimson',
      name: 'Obsidiana & Rojo Gym',
      headerBg: 'from-[#180808] via-[#3b0d0d] to-[#180808]',
      topStripBg: 'bg-[#ef4444] text-white',
      primaryBg: 'bg-[#7f1d1d]',
      primaryText: 'text-[#7f1d1d]',
      accentBg: 'bg-[#dc2626]',
      accentText: 'text-[#fca5a5]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-neutral-50',
      cardBorder: 'border-red-200',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'athletic-performance',
    buttonShape: 'rounded-lg',
    badgeStyle: 'hazard-tag'
  },
    previewImage: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Comparativa entre rueda común inestable vs Doble Rueda con Freno y Rebote'
    ]
  },
  {
    id: 'tpl-deporte-termico',
    nicheId: 'niche-deporte',
    name: 'SculptBody™ (Fajas Reductoras, Chalecos Térmicos & Modelado)',
    subNicheLabel: 'Deporte · Modelado de Cintura y Sudoración',
    badge: '🔥 MODELADO RÁPIDO',
    conversionRateAvg: '6.6% CVR Móvil',
    description: 'Concebida para prendas térmicas de polímero/neopreno, fajas reloj de arena y calzas modeladoras con selector de talle integrado.',
    idealForProducts: ['Faja Cinturilla Reloj de Arena', 'Chaleco Térmico Neotex Hombre/Mujer', 'Calza Levanta-Glúteos Sin Costura'],
    winnerAngleHook: 'Moldeá tu cintura al instante bajo cualquier ropa y multiplicá la sudoración natural mientras caminás o hacés las tareas de la casa.',
    defaultPricePack1: 159000,
    defaultPricePack2: 289000,
    defaultPricePack3: 399000,
    defaultNormalPrice: 225000,
    defaultPhysicalTruth: {
      powerSource: 'manual_sin_energia',
      powerSourceLabel: 'Tejido termo-activo inteligente (sin cables ni baterías)',
      realDimensions: 'Talles S/M, L/XL y XXL/3XL adaptables',
      weightApprox: '220 gramos',
      materialMain: 'Polímero Térmico Interior + Lycra de Compresión Invisible Exterior',
      boxContents: '1 Prenda modeladora original en empaque sellado',
      waterResistance: '100% lavable a mano con agua fría',
      warrantyDays: 7,
      hasVariants: true,
      variantLabel: 'Talle',
      variantOptions: ['S / M', 'L / XL', 'XXL / 3XL']
    },
    theme: {
      id: 'theme-sculpt-magenta',
      name: 'Noche & Magenta Fitness',
      headerBg: 'from-[#2e0722] via-[#500d3b] to-[#2e0722]',
      topStripBg: 'bg-[#f472b6] text-[#2e0722]',
      primaryBg: 'bg-[#701a57]',
      primaryText: 'text-[#500d3b]',
      accentBg: 'bg-[#db2777]',
      accentText: 'text-[#fbcfe8]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-[#fdf2f8]',
      cardBorder: 'border-[#f9a8d4]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'athletic-performance',
    buttonShape: 'rounded-full',
    badgeStyle: 'golden-seal'
  },
    previewImage: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Incluye guía rápida de talles y recordatorio al Agente de WhatsApp para confirmar talle con el cliente'
    ]
  },

  // 5. SALUD, ALIVIO DEL DOLOR & ORTOPEDIA (3 Subnichos)
  {
    id: 'tpl-salud-masaje',
    nicheId: 'niche-salud',
    name: 'FisioAlivio™ (Masajeadores Cervicales Shiatsu & Percusión)',
    subNicheLabel: 'Salud · Alivio de Cuello, Espalda y Ciática',
    badge: '🩺 ÉXITO EN MAYORES 35+',
    conversionRateAvg: '7.5% CVR Móvil',
    description: 'Estética clínica-deportiva en azul médico y turquesa. Ataca directamente el dolor de cuello, contracturas por manejo u oficina, y estrés acumulado.',
    idealForProducts: ['Masajeador Cervical Shiatsu 8 Rodillos con Calor', 'Pistola de Masaje Muscular 4 Cabezales', 'Alfombra Masajeadora de Pies EMS'],
    winnerAngleHook: 'Descontracturá cuello, hombros y cintura en 15 minutos con calor infrarrojo y rodillos 3D como las manos de un kinesiólogo en tu sillón.',
    defaultPricePack1: 189000,
    defaultPricePack2: 349000,
    defaultPricePack3: 489000,
    defaultNormalPrice: 269000,
    defaultPhysicalTruth: {
      powerSource: 'enchufe_220v',
      powerSourceLabel: 'Incluye transformador a 220V para casa + adaptador 12V para el auto',
      realDimensions: '40 cm × 18 cm × 16 cm (con asas para regular presión)',
      weightApprox: '1.1 kg',
      materialMain: 'Cuero Ecológico Respirable + Malla 3D + 8 Cabezales Termo-Activos',
      boxContents: '1 Masajeador Shiatsu con calor, cargador de pared 220V, adaptador para auto 12V y manual',
      waterResistance: 'Limpieza con paño húmedo',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-clinical-blue',
      name: 'Azul Médico & Turquesa',
      headerBg: 'from-[#082f49] via-[#0e4f75] to-[#082f49]',
      topStripBg: 'bg-[#2dd4bf] text-[#042f2e]',
      primaryBg: 'bg-[#0369a1]',
      primaryText: 'text-[#0c4a6e]',
      accentBg: 'bg-[#14b8a6]',
      accentText: 'text-[#99f6e4]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-[#f0fdfa]',
      cardBorder: 'border-[#99f6e4]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'nordic-clinical',
    buttonShape: 'rounded-2xl',
    badgeStyle: 'clinical-badge'
  },
    previewImage: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Mapa corporal de las 6 zonas donde alivia el dolor (Cuello, Hombros, Espalda, Cintura, Piernas, Pies)',
      'Comparativa: Costo de 1 sola sesión de masaje vs tener tu masajeador todos los días en casa'
    ]
  },
  {
    id: 'tpl-salud-ortopedia',
    nicheId: 'niche-salud',
    name: 'OrthoSupport™ (Correctores de Postura, Rodilleras & Fajas Lumbares)',
    subNicheLabel: 'Salud · Soporte Articular y Postural',
    badge: '🦵 ALIVIO ARTICULAR',
    conversionRateAvg: '7.0% CVR Móvil',
    description: 'Diseño ortopédico confiable en azul marino y verde salud. Ideal para rodilleras con flejes laterales, correctores de espalda y plantillas de gel.',
    idealForProducts: ['Rodillera Ortopédica con Doble Estabilizador y Gel', 'Corrector de Postura Espalda y Clavícula', 'Faja Lumbar con Ballenas'],
    winnerAngleHook: 'Volvé a caminar, subir escaleras y trabajar sin ese pinchazo en la rodilla o la espalda desde el primer día de uso.',
    defaultPricePack1: 149000,
    defaultPricePack2: 259000,
    defaultPricePack3: 359000,
    defaultNormalPrice: 210000,
    defaultPhysicalTruth: {
      powerSource: 'manual_sin_energia',
      powerSourceLabel: 'Soporte biomecánico con ajuste de abrojo reforzado',
      realDimensions: 'Ajustable universal con correas elásticas cruzadas',
      weightApprox: '190 gramos',
      materialMain: 'Tejido de Compresión 3D + Anillo de Silicona Rotuliano + Flejes Flexibles',
      boxContents: 'Unidad ortopédica en empaque higiénico sellado',
      waterResistance: 'Lavable y respirable (no da calor excesivo)',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-ortho-navy',
      name: 'Marino Ortopédico & Esmeralda',
      headerBg: 'from-[#0f172a] via-[#1e293b] to-[#0f172a]',
      topStripBg: 'bg-[#34d399] text-[#064e3b]',
      primaryBg: 'bg-[#1e293b]',
      primaryText: 'text-[#0f172a]',
      accentBg: 'bg-[#10b981]',
      accentText: 'text-[#a7f3d0]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-slate-50',
      cardBorder: 'border-slate-300',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'nordic-clinical',
    buttonShape: 'rounded-lg',
    badgeStyle: 'clinical-badge'
  },
    previewImage: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Más del 70% de los clientes lleva el Pack de 2 unidades (para ambas rodillas o para usar y lavar)'
    ]
  },
  {
    id: 'tpl-salud-descanso',
    nicheId: 'niche-salud',
    name: 'SueñoProfundo™ (Almohadas Cervicales Memory Foam & Descanso)',
    subNicheLabel: 'Salud · Dormir Sin Dolor de Cuello',
    badge: '🌙 DESCANSO PROFUNDO',
    conversionRateAvg: '6.5% CVR Móvil',
    description: 'Paleta relajante índigo nocturno y lavanda suave para almohadas viscoelásticas mariposa, almohadas de piernas y dispositivos anti-ronquidos.',
    idealForProducts: ['Almohada Cervical Ergonómica Memory Foam', 'Almohada Ortopédica de Rodillas para Dormir de Lado'],
    winnerAngleHook: 'Despertate sin el cuello duro ni dolor de cabeza gracias a su curva anatómica que alinea tu columna toda la noche.',
    defaultPricePack1: 179000,
    defaultPricePack2: 329000,
    defaultPricePack3: 459000,
    defaultNormalPrice: 249000,
    defaultPhysicalTruth: {
      powerSource: 'manual_sin_energia',
      powerSourceLabel: 'Espuma viscoelástica de memoria lenta termo-sensible',
      realDimensions: '55 cm × 35 cm × 11/9 cm',
      weightApprox: '850 gramos',
      materialMain: 'Memory Foam 100% Alta Densidad + Funda Hipoalergénica con Cierre Lavable',
      boxContents: '1 Almohada cervical viscoelástica con su funda transpirable lavable',
      waterResistance: 'Funda desmontable lavable en lavarropas',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-sleep-indigo',
      name: 'Índigo Descanso & Lavanda',
      headerBg: 'from-[#1e1b4b] via-[#312e81] to-[#1e1b4b]',
      topStripBg: 'bg-[#c084fc] text-[#1e1b4b]',
      primaryBg: 'bg-[#312e81]',
      primaryText: 'text-[#1e1b4b]',
      accentBg: 'bg-[#a855f7]',
      accentText: 'text-[#e9d5ff]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-[#f5f3ff]',
      cardBorder: 'border-[#ddd6fe]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'minimalist-luxury',
    buttonShape: 'rounded-2xl',
    badgeStyle: 'minimal-tag'
  },
    previewImage: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Excelente conversión de Pack 2 (Oferta Pareja / Matrimonio)'
    ]
  },

  // 6. BELLEZA, SKINCARE & CUIDADO CAPILAR (3 Subnichos)
  {
    id: 'tpl-belleza-capilar',
    nicheId: 'niche-belleza',
    name: 'SalonLuxe™ (Cepillos Secadores 5 en 1, Planchitas & Onduladores)',
    subNicheLabel: 'Belleza · Peluquería en Casa en 10 Minutos',
    badge: '💇‍♀️ TOP VENTAS MUJERES',
    conversionRateAvg: '7.6% CVR Móvil',
    description: 'Estética boutique en oro rosa, negro satinado y champagne. Especial para modeladores de aire 5 en 1, cepillos alisadores y planchitas de titanio.',
    idealForProducts: ['Cepillo Secador y Modelador 5 en 1', 'Planchita Profesional de Titanio 450°F', 'Cepillo Alisador Cerámico'],
    winnerAngleHook: 'Secá, alisá, dale volumen y armá ondas de peluquería en 10 minutos desde tu casa sin quemar tu pelo.',
    defaultPricePack1: 189000,
    defaultPricePack2: 349000,
    defaultPricePack3: 489000,
    defaultNormalPrice: 269000,
    defaultPhysicalTruth: {
      powerSource: 'enchufe_220v',
      powerSourceLabel: 'Conexión directa a 220V con cable giratorio 360° de salón',
      realDimensions: 'Mango ergonómico + 5 cabezales intercambiables de encastre seguro',
      weightApprox: '780 gramos',
      materialMain: 'Revestimiento Cerámico con Turmalina Iónica Anti-Frizz',
      boxContents: '1 Motor principal 220V + 5 cabezales (secador, cepillo liso, cepillo volumen y 2 rizadores) en caja de presentación',
      waterResistance: 'Uso con cabello húmedo o seco',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-salon-rosegold',
      name: 'Oro Rosa & Negro Boutique',
      headerBg: 'from-[#1f1218] via-[#3d1e2d] to-[#1f1218]',
      topStripBg: 'bg-[#f472b6] text-[#1f1218]',
      primaryBg: 'bg-[#4a1d34]',
      primaryText: 'text-[#3d1e2d]',
      accentBg: 'bg-[#ec4899]',
      accentText: 'text-[#fbcfe8]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-[#fff1f2]',
      cardBorder: 'border-[#fecdd3]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'minimalist-luxury',
    buttonShape: 'rounded-full',
    badgeStyle: 'golden-seal'
  },
    previewImage: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Ahorro frente a lo que cuesta un solo brushing de peluquería en Asunción',
      'Explicación visual de qué hace cada uno de los 5 cabezales'
    ]
  },
  {
    id: 'tpl-belleza-depilacion',
    nicheId: 'niche-belleza',
    name: 'SilkSkin™ (Depilación Sin Dolor: Láser IPL, Cristal & Recargables)',
    subNicheLabel: 'Belleza · Piel Suave Sin Irritación',
    badge: '🌸 PIEL DE SEDA',
    conversionRateAvg: '6.9% CVR Móvil',
    description: 'Diseño delicado en perla, rosa empolvado y coral para depiladoras faciales/corporales, borradores de vello de cristal y depiladoras IPL.',
    idealForProducts: ['Depiladora Corporal Recargable 4 en 1 Sin Dolor', 'Depiladora Luz Pulsada IPL Portátil', 'Depilador Facial de Precisión'],
    winnerAngleHook: 'Olvidate del ardor de la cera y los cortes de la maquinita: piel suave al instante en piernas, axilas y rostro sin dolor.',
    defaultPricePack1: 159000,
    defaultPricePack2: 289000,
    defaultPricePack3: 409000,
    defaultNormalPrice: 220000,
    defaultPhysicalTruth: {
      powerSource: 'bateria_usb',
      powerSourceLabel: 'Batería recargable por USB (uso inalámbrico)',
      realDimensions: '15 cm × 5 cm (cabe en la cartera)',
      weightApprox: '210 gramos',
      materialMain: 'Cuchillas Hipoalergénicas Bañadas en Titanio/Oro Rosa que no tocan la piel directamente',
      boxContents: 'Depiladora recargable, cabezales intercambiables, cepillo limpiador y cable USB',
      waterResistance: 'Cabezales lavables con agua',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-silk-blush',
      name: 'Perla & Rosa Seda',
      headerBg: 'from-[#3b0723] via-[#6b1141] to-[#3b0723]',
      topStripBg: 'bg-[#fda4af] text-[#3b0723]',
      primaryBg: 'bg-[#831843]',
      primaryText: 'text-[#500724]',
      accentBg: 'bg-[#f43f5e]',
      accentText: 'text-[#ffe4e6]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-[#fff5f7]',
      cardBorder: 'border-[#fecdd3]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'minimalist-luxury',
    buttonShape: 'rounded-2xl',
    badgeStyle: 'golden-seal'
  },
    previewImage: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Demostración por zonas delicadas (rostro, axilas, cavado, piernas)'
    ]
  },
  {
    id: 'tpl-belleza-skincare',
    nicheId: 'niche-belleza',
    name: 'DermaGlow™ (Limpieza Facial, Máscaras LED & Rejuvenecimiento)',
    subNicheLabel: 'Belleza · Skincare & Anti-Edad en Casa',
    badge: '✨ DERMO-ESTÉTICA',
    conversionRateAvg: '6.5% CVR Móvil',
    description: 'Paleta dermo-cosmética en violeta imperial, blanco puro y dorado para espátulas ultrasónicas, succionadores de puntos negros y masajeadores EMS faciales.',
    idealForProducts: ['Espátula Ultrasónica Peeling Facial', 'Masajeador Lifting Facial EMS Cuello y Rostro', 'Succionador de Poros y Puntos Negros'],
    winnerAngleHook: 'Limpiá poros profundos y reafirmá rostro y papada en 5 minutos por noche potenciando tus cremas al máximo.',
    defaultPricePack1: 159000,
    defaultPricePack2: 289000,
    defaultPricePack3: 399000,
    defaultNormalPrice: 225000,
    defaultPhysicalTruth: {
      powerSource: 'bateria_usb',
      powerSourceLabel: 'Batería recargable USB',
      realDimensions: '17 cm × 4.5 cm',
      weightApprox: '160 gramos',
      materialMain: 'Acero Quirúrgico Inoxidable + ABS Perla',
      boxContents: 'Dispositivo dermo-facial recargable, capuchón protector, cable USB y guía de uso',
      waterResistance: 'Cabezal resistente a cremas y lociones',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-derma-violet',
      name: 'Violeta Dermo & Champagne',
      headerBg: 'from-[#2e1065] via-[#4c1d95] to-[#2e1065]',
      topStripBg: 'bg-[#e9d5ff] text-[#2e1065]',
      primaryBg: 'bg-[#5b21b6]',
      primaryText: 'text-[#3b0764]',
      accentBg: 'bg-[#9333ea]',
      accentText: 'text-[#f3e8ff]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-[#faf5ff]',
      cardBorder: 'border-[#e9d5ff]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'futuristic-cyber',
    buttonShape: 'rounded-lg',
    badgeStyle: 'clinical-badge'
  },
    previewImage: 'https://images.unsplash.com/photo-1512290900672-1f02e0ad0ba8?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Rutina explicada paso a paso (Limpieza, Nutrición y Lifting)'
    ]
  },

  // 7. BARBERÍA & GROOMING MASCULINO (2 Subnichos)
  {
    id: 'tpl-barberia-t9',
    nicheId: 'niche-barberia',
    name: 'BarberClub Pro™ (Patilleras Metálicas T9, Afeitadoras & Cortapelos)',
    subNicheLabel: 'Barbería · Precisión Al Ras y Cuerpo Metálico',
    badge: '💈 CLÁSICO GANADOR COD',
    conversionRateAvg: '7.1% CVR Móvil',
    description: 'Diseño masculino industrial en negro mate, bronce envejecido y dorado. Enfocado en potencia de motor, cuchilla en T al ras sin irritar y batería USB.',
    idealForProducts: ['Patillera Profesional Metálica Vintage T9', 'Afeitadora Eléctrica Impermeable 5 Cabezales', 'Combo Cortapelos + Patillera'],
    winnerAngleHook: 'Perfilá barba, nuca y degradados al ras en 2 minutos con cuerpo 100% metálico y cuchilla de acero al carbono que no tira ni irrita.',
    defaultPricePack1: 149000,
    defaultPricePack2: 269000,
    defaultPricePack3: 369000,
    defaultNormalPrice: 210000,
    defaultPhysicalTruth: {
      powerSource: 'bateria_usb',
      powerSourceLabel: 'Batería de Litio recargable por USB (hasta 120 min de uso)',
      realDimensions: '15 cm × 4 cm (cuerpo cilíndrico labrado antideslizante)',
      weightApprox: '220 gramos',
      materialMain: 'Cuerpo de Aleación Metálica + Cuchilla en T de Acero al Carbono',
      boxContents: '1 Máquina metálica, 4 peines guía (1.5mm, 2mm, 3mm, 4mm), cepillo de limpieza, aceite lubricante y cargador USB',
      waterResistance: 'Cabezal de cuchilla lavable',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-barber-bronze',
      name: 'Negro Mate & Bronce Barber',
      headerBg: 'from-[#09090b] via-[#18181b] to-[#09090b]',
      topStripBg: 'bg-[#d97706] text-white',
      primaryBg: 'bg-[#18181b]',
      primaryText: 'text-[#18181b]',
      accentBg: 'bg-[#b45309]',
      accentText: 'text-[#fcd34d]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-stone-100',
      cardBorder: 'border-stone-300',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'brutalist-industrial',
    buttonShape: 'rounded-none',
    badgeStyle: 'golden-seal'
  },
    previewImage: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Detalle macro de la cuchilla en T cero tironeos',
      'Excelente para vender Pack 2 (1 para el auto/viaje y 1 para el baño)'
    ]
  },
  {
    id: 'tpl-barberia-barba',
    nicheId: 'niche-barberia',
    name: 'Gentleman Care™ (Planchas de Barba, Recortadoras Corporales & Kits)',
    subNicheLabel: 'Barbería · Cuidado Masculino Integral',
    badge: '🧔 ESTILO HOMBRE',
    conversionRateAvg: '6.4% CVR Móvil',
    description: 'Estética bourbon oscuro y dorado para cepillos alisadores de barba, recortadoras corporales impermeables y kits de cuidado masculino.',
    idealForProducts: ['Cepillo Alisador Térmico de Barba y Pelo', 'Recortadora Corporal Hombre con Luz LED'],
    winnerAngleHook: 'Domá la barba rebelde o cuidá tu imagen personal en 60 segundos antes de salir a trabajar.',
    defaultPricePack1: 159000,
    defaultPricePack2: 289000,
    defaultPricePack3: 399000,
    defaultNormalPrice: 220000,
    defaultPhysicalTruth: {
      powerSource: 'enchufe_220v',
      powerSourceLabel: 'Calentamiento rápido en 30 segundos (220V o USB según modelo)',
      realDimensions: '21 cm × 5 cm',
      weightApprox: '290 gramos',
      materialMain: 'Peine Protector Anti-Quemaduras + Placa Cerámica',
      boxContents: 'Equipo principal en caja original y manual de uso',
      waterResistance: 'Cabezal fácil de limpiar',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-gentleman-bourbon',
      name: 'Bourbon & Dorado',
      headerBg: 'from-[#1c1008] via-[#361e0f] to-[#1c1008]',
      topStripBg: 'bg-[#f59e0b] text-[#1c1008]',
      primaryBg: 'bg-[#451a03]',
      primaryText: 'text-[#451a03]',
      accentBg: 'bg-[#d97706]',
      accentText: 'text-[#fde68a]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-amber-50/40',
      cardBorder: 'border-amber-200',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'minimalist-luxury',
    buttonShape: 'rounded-lg',
    badgeStyle: 'golden-seal'
  },
    previewImage: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Muy elegido también por mujeres como regalo para el marido o papá'
    ]
  },

  // 8. HERRAMIENTAS, TALLER & CONSTRUCCIÓN (2 Subnichos)
  {
    id: 'tpl-herramientas-sierra',
    nicheId: 'niche-herramientas',
    name: 'TorqueMax Industrial™ (Minisierras a Batería, Taladros & Impacto)',
    subNicheLabel: 'Herramientas · Potencia Inalámbrica con Maletín',
    badge: '🛠️ CAMPEÓN DE VENTAS PY',
    conversionRateAvg: '7.7% CVR Móvil',
    description: 'Diseño robusto en amarillo industrial y carbón acero. El favorito absoluto en Paraguay para vender Minisierras a batería, Taladros Inalámbricos y Amoladoras.',
    idealForProducts: ['Minisierra Eléctrica a Batería con Maletín', 'Taladro Percutor Inalámbrico 2 Baterías', 'Llave de Impacto a Batería'],
    winnerAngleHook: 'Podá ramas gruesas, cortá troncos y maderas en 10 segundos con una sola mano, sin nafta, sin cables y con maletín completo incluido.',
    defaultPricePack1: 219000,
    defaultPricePack2: 399000,
    defaultPricePack3: 569000,
    defaultNormalPrice: 310000,
    defaultPhysicalTruth: {
      powerSource: 'bateria_usb',
      powerSourceLabel: 'Batería de Litio recargable de alto amperaje + Cargador 220V incluido',
      realDimensions: 'Espada de 6 pulgadas (cortes de hasta 15 cm de diámetro)',
      weightApprox: '1.1 kg con batería colocada',
      materialMain: 'Motor con Bobinado de Cobre + Cadena Templada de Acero al Carbono',
      boxContents: '1 Herramienta principal, Batería(s) de Litio, Cargador a 220V, Cadena/Accesorios, Destornillador/Llave y Maletín Rígido de Transporte',
      waterResistance: 'Carcasa ventilada resistente a aserrín y trabajo de patio',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-industrial-yellow',
      name: 'Amarillo Industrial & Acero',
      headerBg: 'from-[#111827] via-[#1f2937] to-[#111827]',
      topStripBg: 'bg-[#facc15] text-[#111827]',
      primaryBg: 'bg-[#111827]',
      primaryText: 'text-[#111827]',
      accentBg: 'bg-[#eab308]',
      accentText: 'text-[#fde047]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-zinc-100',
      cardBorder: 'border-zinc-300',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'brutalist-industrial',
    buttonShape: 'rounded-none',
    badgeStyle: 'hazard-tag'
  },
    previewImage: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Desglose visual de todo lo que viene adentro del maletín',
      'Ficha técnica de motor, autonomía de batería y seguridad de gatillo'
    ]
  },
  {
    id: 'tpl-herramientas-soldadura',
    nicheId: 'niche-herramientas',
    name: 'ProTaller™ (Soldadoras Portátiles, Medición Láser & Cajas Mecánicas)',
    subNicheLabel: 'Herramientas · Taller, Herrería y Precisión',
    badge: '⚙️ USO PROFESIONAL/HOGAR',
    conversionRateAvg: '6.8% CVR Móvil',
    description: 'Estética rojo acero y gris taller para pistolas de soldar, soldadoras inverter compactas, niveles láser y juegos de llaves tubo.',
    idealForProducts: ['Soldadora Inverter Portátil de Mano', 'Nivel Láser Autonivelante 360°', 'Juego de Tubos y Crique 108 Piezas'],
    winnerAngleHook: 'Hacé arreglos de portones, rejas y mecánica en tu propia casa ahorrando cientos de miles de guaraníes en mano de obra.',
    defaultPricePack1: 229000,
    defaultPricePack2: 429000,
    defaultPricePack3: 599000,
    defaultNormalPrice: 320000,
    defaultPhysicalTruth: {
      powerSource: 'enchufe_220v',
      powerSourceLabel: 'Conexión directa a 220V de bajo consumo doméstico',
      realDimensions: '26 cm × 20 cm (formato compacto portátil)',
      weightApprox: '1.6 kg',
      materialMain: 'Acero + Polímero Termorresistente de Grado Taller',
      boxContents: 'Equipo principal completo con accesorios de trabajo y estuche/caja',
      waterResistance: 'Protección térmica contra sobrecalentamiento',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-workshop-red',
      name: 'Rojo Acero & Pizarra Taller',
      headerBg: 'from-[#18181b] via-[#27272a] to-[#18181b]',
      topStripBg: 'bg-[#ef4444] text-white',
      primaryBg: 'bg-[#991b1b]',
      primaryText: 'text-[#7f1d1d]',
      accentBg: 'bg-[#dc2626]',
      accentText: 'text-[#fca5a5]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-stone-100',
      cardBorder: 'border-stone-300',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'brutalist-industrial',
    buttonShape: 'rounded-none',
    badgeStyle: 'hazard-tag'
  },
    previewImage: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Enfoque en retorno de inversión inmediato (en 1 solo arreglo ya se paga solo)'
    ]
  },

  // 9. AUTO, MOTO & RUTA (2 Subnichos)
  {
    id: 'tpl-auto-compresor',
    nicheId: 'niche-auto',
    name: 'TurboRuta™ (Compresores Digitales, Arrancadores & Aspiradoras Auto)',
    subNicheLabel: 'Auto & Moto · Emergencia en Ruta y Guantera',
    badge: '🚗 IMPRESCINDIBLE EN RUTA',
    conversionRateAvg: '7.4% CVR Móvil',
    description: 'Diseño automotor deportivo en negro fibra de carbono y rojo velocímetro. Ideal para infladores digitales con corte automático y arrancadores portátiles.',
    idealForProducts: ['Compresor Inflador Digital Inalámbrico Auto/Moto', 'Arrancador Portátil de Batería + Inflador', 'Aspiradora Potente Inalámbrica para Auto'],
    winnerAngleHook: 'No te quedes tirado nunca más en la ruta o bajo la lluvia: inflá la cubierta de tu auto o moto en 60 segundos con corte digital automático.',
    defaultPricePack1: 179000,
    defaultPricePack2: 329000,
    defaultPricePack3: 469000,
    defaultNormalPrice: 249000,
    defaultPhysicalTruth: {
      powerSource: 'bateria_usb',
      powerSourceLabel: 'Batería interna recargable + Cable para encendedor 12V del auto',
      realDimensions: '16 cm × 8 cm × 5 cm (entra en la guantera o mochila)',
      weightApprox: '540 gramos',
      materialMain: 'Cilindro Metálico de Alta Presión (150 PSI) + Pantalla LED Digital',
      boxContents: '1 Compresor digital, manguera mallada con pico de bronce, 3 picos adaptadores (moto, bici, pelota), cable de carga y bolso',
      waterResistance: 'Incluye linterna LED de baliza para emergencias nocturnas',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-turbo-garage',
      name: 'Carbono & Rojo Velocímetro',
      headerBg: 'from-[#090d16] via-[#1e1b2e] to-[#090d16]',
      topStripBg: 'bg-[#ef4444] text-white',
      primaryBg: 'bg-[#111827]',
      primaryText: 'text-[#111827]',
      accentBg: 'bg-[#ef4444]',
      accentText: 'text-[#fca5a5]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-slate-50',
      cardBorder: 'border-slate-300',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'athletic-performance',
    buttonShape: 'rounded-lg',
    badgeStyle: 'cyber-chip'
  },
    previewImage: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Demostración de los 4 modos programables (Auto, Moto, Bicicleta y Pelotas) con apagado solo al llegar a los PSI'
    ]
  },
  {
    id: 'tpl-auto-estetica',
    nicheId: 'niche-auto',
    name: 'DetailPro™ (Cámaras Dashcam, Luces LED & Estética Vehicular)',
    subNicheLabel: 'Auto & Moto · Equipamiento y Cuidado del Vehículo',
    badge: '🏁 EQUIPAMIENTO AUTO',
    conversionRateAvg: '6.6% CVR Móvil',
    description: 'Paleta azul cobalto metalizado y plata para cámaras grabadoras de viaje (Dashcam), kits de pulido/restauración de faros y accesorios.',
    idealForProducts: ['Cámara Dashcam triple lente delantera/interior/trasera', 'Restaurador de Plásticos y Faros', 'Juego de Focos Cree LED'],
    winnerAngleHook: 'Protegé tu vehículo ante cualquier accidente o reclamo de tránsito grabando todo en Full HD adelante y atrás automáticamente.',
    defaultPricePack1: 189000,
    defaultPricePack2: 349000,
    defaultPricePack3: 489000,
    defaultNormalPrice: 269000,
    defaultPhysicalTruth: {
      powerSource: 'bateria_usb',
      powerSourceLabel: 'Conexión al encendedor 12V del vehículo (prende y graba sola al dar contacto)',
      realDimensions: '11 cm × 7 cm (pantalla IPS integrada)',
      weightApprox: '310 gramos',
      materialMain: 'Lente Gran Angular 170° + Carcasa Térmica Resistente al Sol',
      boxContents: 'Cámara principal con pantalla, cámara trasera con cable, soporte sopapa para parabrisas y cargador 12V',
      waterResistance: 'Cámara trasera de retroceso impermeable IP67',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-detailing-cobalt',
      name: 'Azul Metalizado & Plata',
      headerBg: 'from-[#0f172a] via-[#1e3a8a] to-[#0f172a]',
      topStripBg: 'bg-[#38bdf8] text-[#0f172a]',
      primaryBg: 'bg-[#1e3a8a]',
      primaryText: 'text-[#1e3a8a]',
      accentBg: 'bg-[#0284c7]',
      accentText: 'text-[#bae6fd]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-slate-50',
      cardBorder: 'border-blue-200',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'futuristic-cyber',
    buttonShape: 'rounded-none',
    badgeStyle: 'hazard-tag'
  },
    previewImage: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Explicación de grabación en bucle y visión nocturna infrarroja'
    ]
  },

  // 10. SEGURIDAD INTELIGENTE & CÁMARAS WIFI (2 Subnichos)
  {
    id: 'tpl-seguridad-camara',
    nicheId: 'niche-seguridad',
    name: 'Centinela 360™ (Cámaras Domo WiFi Foco/Exterior con Alarma y Audio)',
    subNicheLabel: 'Seguridad · Vigilancia en Vivo desde tu Celular',
    badge: '🛡️ RÉCORD EN PACK DE 2 Y 3',
    conversionRateAvg: '7.8% CVR Móvil',
    description: 'Uno de los productos más rentables de todo el e-commerce paraguayo: cámaras WiFi tipo foco o domo exterior con giro 360°, audio bidireccional y seguimiento humano.',
    idealForProducts: ['Cámara Domo WiFi 360° Tipo Foco E27', 'Cámara Exterior WiFi Doble Lente Impermeable IP66'],
    winnerAngleHook: 'Mirá y escuchá en vivo tu casa, negocio o portón desde tu celular estés donde estés, sin pagar instalador ni cuotas mensuales.',
    defaultPricePack1: 159000,
    defaultPricePack2: 289000,
    defaultPricePack3: 399000,
    defaultNormalPrice: 229000,
    defaultPhysicalTruth: {
      powerSource: 'enchufe_220v',
      powerSourceLabel: 'Se enrosca directo en cualquier portafocos común E27 (220V) como un foco normal',
      realDimensions: '15 cm × 7 cm (giro motorizado 355° horizontal y 90° vertical)',
      weightApprox: '290 gramos',
      materialMain: 'ABS de Alta Resistencia + Lente Full HD + 4 LEDs Blancos + 4 Infrarrojos',
      boxContents: '1 Cámara Domo WiFi 360°, 1 Portafocos E27 de regalo con tornillos y manual paso a paso en español',
      waterResistance: 'Apta para galerías, entradas, porches y comercios',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-sentinel-navy',
      name: 'Centinela Nocturno & Cian',
      headerBg: 'from-[#040d1a] via-[#0c2340] to-[#040d1a]',
      topStripBg: 'bg-[#06b6d4] text-[#040d1a]',
      primaryBg: 'bg-[#0c2340]',
      primaryText: 'text-[#0c2340]',
      accentBg: 'bg-[#0891b2]',
      accentText: 'text-[#a5f3fc]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-slate-50',
      cardBorder: 'border-cyan-200',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'futuristic-cyber',
    buttonShape: 'rounded-full',
    badgeStyle: 'cyber-chip'
  },
    previewImage: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'El 72% de las ventas son Pack 2 (Frente + Patio) o Pack 3 (Casa Completa)',
      'Comparativa contra empresas de alarma que cobran Gs. 250.000 todos los meses'
    ]
  },
  {
    id: 'tpl-seguridad-alarmas',
    nicheId: 'niche-seguridad',
    name: 'SafeHome™ (Timbres con Cámara, Sensores & Cerraduras)',
    subNicheLabel: 'Seguridad · Control de Acceso y Puerta',
    badge: '🔔 CONTROL DE PUERTA',
    conversionRateAvg: '6.6% CVR Móvil',
    description: 'Diseño moderno en pizarra y verde esmeralda para timbres inalámbricos con cámara al celular, alarmas con sensor de movimiento y candados con huella.',
    idealForProducts: ['Timbre Inalámbrico WiFi con Cámara y Audio', 'Alarma Sensor de Movimiento con 2 Controles'],
    winnerAngleHook: 'Atendé quién toca el timbre de tu casa desde la cama o desde tu trabajo viendo su cara en tu celular antes de abrir.',
    defaultPricePack1: 159000,
    defaultPricePack2: 289000,
    defaultPricePack3: 409000,
    defaultNormalPrice: 219000,
    defaultPhysicalTruth: {
      powerSource: 'bateria_usb',
      powerSourceLabel: 'Batería recargable de larga duración + Campanilla interior USB',
      realDimensions: '8.5 cm × 5.3 cm',
      weightApprox: '180 gramos',
      materialMain: 'ABS Impermeable Exterior + Lente Gran Angular con Visión Nocturna',
      boxContents: 'Timbre exterior con cámara, receptor sonoro interior, adhesivo 3M/tornillos y cable de carga',
      waterResistance: 'Resistente a la lluvia para portón o entrada',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-safehome-slate',
      name: 'Pizarra & Esmeralda Seguro',
      headerBg: 'from-[#0f172a] via-[#1e293b] to-[#0f172a]',
      topStripBg: 'bg-[#10b981] text-[#052e16]',
      primaryBg: 'bg-[#0f172a]',
      primaryText: 'text-[#0f172a]',
      accentBg: 'bg-[#10b981]',
      accentText: 'text-[#a7f3d0]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-slate-50',
      cardBorder: 'border-slate-300',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'nordic-clinical',
    buttonShape: 'rounded-lg',
    badgeStyle: 'cyber-chip'
  },
    previewImage: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Instalación en 60 segundos sin romper pared ni pasar cables'
    ]
  },

  // 11. TECNOLOGÍA, AUDIO & GADGETS (2 Subnichos)
  {
    id: 'tpl-tecno-smartwatch',
    nicheId: 'niche-tecnologia',
    name: 'CyberTech Titanium™ (Smartwatches Ultra, Combos & Auriculares)',
    subNicheLabel: 'Tecnología · Relojes Inteligentes y Audio',
    badge: '⌚ COMBO VIRAL',
    conversionRateAvg: '7.1% CVR Móvil',
    description: 'Estética tecnológica en titanio oscuro y naranja ultra. Ideal para Smartwatches con mallas de regalo y combos de reloj + auriculares inalámbricos.',
    idealForProducts: ['Smartwatch Ultra Pantalla 49mm + 7 Mallas', 'Combo Smartwatch + Auriculares Inalámbricos'],
    winnerAngleHook: 'Recibí llamadas por Bluetooth, leé tus WhatsApps y cambiá de estilo todos los días con sus mallas intercambiables incluidas.',
    defaultPricePack1: 179000,
    defaultPricePack2: 329000,
    defaultPricePack3: 459000,
    defaultNormalPrice: 259000,
    defaultPhysicalTruth: {
      powerSource: 'bateria_usb',
      powerSourceLabel: 'Cargador magnético inalámbrico USB incluido',
      realDimensions: 'Caja de 49mm pantalla táctil completa HD',
      weightApprox: '190 gramos el set completo',
      materialMain: 'Caja de Aleación Metálica Titanio + Mallas de Silicona/Nylon/Metal',
      boxContents: '1 Smartwatch Ultra (compatible con Android y iPhone), mallas intercambiables y cargador magnético',
      waterResistance: 'Resistente a salpicaduras y sudor deportivo (IP67)',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-cyber-titanium',
      name: 'Titanio & Naranja Ultra',
      headerBg: 'from-[#090d16] via-[#18181b] to-[#090d16]',
      topStripBg: 'bg-[#f97316] text-white',
      primaryBg: 'bg-[#18181b]',
      primaryText: 'text-[#18181b]',
      accentBg: 'bg-[#ea580c]',
      accentText: 'text-[#fed7aa]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-zinc-50',
      cardBorder: 'border-orange-200',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'futuristic-cyber',
    buttonShape: 'rounded-2xl',
    badgeStyle: 'cyber-chip'
  },
    previewImage: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Destaca compatibilidad 100% con Samsung, Xiaomi, Motorola y iPhone'
    ]
  },
  {
    id: 'tpl-tecno-cine',
    nicheId: 'niche-tecnologia',
    name: 'CineCasa HD™ (Mini Proyectores Smart, TV Box & Parlantes)',
    subNicheLabel: 'Tecnología · Entretenimiento Familiar en Casa',
    badge: '🎬 FÚTBOL Y CINE EN CASA',
    conversionRateAvg: '6.8% CVR Móvil',
    description: 'Paleta cine nocturno en púrpura profundo y dorado para proyectores Smart Android/WiFi (fútbol, Netflix, YouTube en pantalla de 130 pulgadas) y barras de sonido.',
    idealForProducts: ['Proyector Smart WiFi Android 130" Giratorio 180°', 'TV Box 4K Convierte tu Tele en Smart'],
    winnerAngleHook: 'Convertí cualquier pared blanca de tu pieza o quincho en una pantalla gigante de 130 pulgadas para ver el partido con amigos o películas en familia.',
    defaultPricePack1: 349000,
    defaultPricePack2: 649000,
    defaultPricePack3: 929000,
    defaultNormalPrice: 480000,
    defaultPhysicalTruth: {
      powerSource: 'enchufe_220v',
      powerSourceLabel: 'Conexión directa a 220V con parlante integrado y WiFi',
      realDimensions: '17 cm × 10 cm (cabezal giratorio 180° para pared o techo)',
      weightApprox: '750 gramos',
      materialMain: 'Óptica LED de 130 pulgadas + Sistema Smart WiFi / HDMI / USB',
      boxContents: '1 Proyector Smart HD, control remoto, cable de alimentación 220V y manual',
      waterResistance: 'Uso interior o quincho techado',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-cinema-purple',
      name: 'Cine Púrpura & Oro',
      headerBg: 'from-[#13072e] via-[#251052] to-[#13072e]',
      topStripBg: 'bg-[#facc15] text-[#13072e]',
      primaryBg: 'bg-[#2e1065]',
      primaryText: 'text-[#1e1b4b]',
      accentBg: 'bg-[#eab308]',
      accentText: 'text-[#fef08a]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-slate-50',
      cardBorder: 'border-purple-200',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'minimalist-luxury',
    buttonShape: 'rounded-full',
    badgeStyle: 'golden-seal'
  },
    previewImage: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Ángulo ganador en Paraguay: ver partidos de la Albirroja, Olimpia, Cerro y Netflix en pantalla gigante'
    ]
  },

  // 12. MASCOTAS, BEBÉS & TIEMPO LIBRE (2 Subnichos)
  {
    id: 'tpl-mascotas-cuidado',
    nicheId: 'niche-mascotas',
    name: 'HappyPet™ (Cepillos a Vapor, Quita-Pelos & Camas Antiestrés)',
    subNicheLabel: 'Mascotas · Higiene sin Pelos en los Sillones',
    badge: '🐾 AMANTES DE MASCOTAS',
    conversionRateAvg: '7.0% CVR Móvil',
    description: 'Diseño cálido ámbar y turquesa para el viral cepillo 3 en 1 con vapor para perros y gatos, rodillos quita-pelos y comederos.',
    idealForProducts: ['Cepillo a Vapor 3 en 1 para Perros y Gatos', 'Rodillo Quita-Pelos Reutilizable para Sillones y Ropa'],
    winnerAngleHook: 'Sacale todo el pelo suelto a tu perro o gato en 2 minutos con bruma fresca que relaja a tu mascota y deja tu casa limpia de pelos.',
    defaultPricePack1: 129000,
    defaultPricePack2: 229000,
    defaultPricePack3: 319000,
    defaultNormalPrice: 179000,
    defaultPhysicalTruth: {
      powerSource: 'bateria_usb',
      powerSourceLabel: 'Batería recargable por USB + Tanque para agua o loción',
      realDimensions: '12 cm × 6.5 cm',
      weightApprox: '150 gramos',
      materialMain: 'Cerdas de Silicona Suave Masajeadora + Vaporizador Micronizado en Frío (no calienta)',
      boxContents: '1 Cepillo vaporizador 3 en 1 y cable de carga USB en caja',
      waterResistance: '100% lavable bajo canilla',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-happypet-amber',
      name: 'Ámbar Mascotas & Turquesa',
      headerBg: 'from-[#1f1608] via-[#422c0c] to-[#1f1608]',
      topStripBg: 'bg-[#2dd4bf] text-[#042f2e]',
      primaryBg: 'bg-[#78350f]',
      primaryText: 'text-[#451a03]',
      accentBg: 'bg-[#f59e0b]',
      accentText: 'text-[#fde68a]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-[#fffbeb]',
      cardBorder: 'border-[#fde68a]',
      badgeBg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      layoutArchetype: 'natural-organic',
    buttonShape: 'rounded-2xl',
    badgeStyle: 'pill-solid'
  },
    previewImage: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&auto=format&fit=crop',
    sampleHighlights: [
      'Aclara que el vapor es bruma fría relajante (cero calor) que atrapa la estática del pelo'
    ]
  },
  {
    id: 'tpl-tiempo-camping',
    nicheId: 'niche-mascotas',
    name: 'TacticalOutdoors™ (Linternas Tácticas Largo Alcance, Pesca & Camping)',
    subNicheLabel: 'Tiempo Libre · Campo, Estancia, Pesca y Seguridad',
    badge: '🔦 CAMPO & PESCA PY',
    conversionRateAvg: '7.2% CVR Móvil',
    description: 'Estética táctica verde oliva militar y dorado para linternas recargables de largo alcance, faroles de camping, termos y equipamiento de pesca.',
    idealForProducts: ['Linterna Táctica Recargable Zoom 500 Metros + Powerbank', 'Farol de Camping Solar + USB', 'Carpa Automática Armado en 3 Segundos'],
    winnerAngleHook: 'Iluminá hasta 500 metros de distancia como si fuera de día en el campo, el río o durante cualquier apagón en tu barrio.',
    defaultPricePack1: 159000,
    defaultPricePack2: 289000,
    defaultPricePack3: 399000,
    defaultNormalPrice: 229000,
    defaultPhysicalTruth: {
      powerSource: 'bateria_usb',
      powerSourceLabel: 'Batería recargable por USB + Salida Powerbank para cargar el celular en emergencias',
      realDimensions: '17 cm × 4.5 cm (con zoom telescópico regulable)',
      weightApprox: '340 gramos',
      materialMain: 'Aleación de Aluminio Aeronáutico Resistente a Golpes y Lluvia',
      boxContents: '1 Linterna táctica de largo alcance, batería recargable, cable USB, correa de muñeca y estuche rígido',
      waterResistance: 'Impermeable para uso bajo lluvia en campo o río',
      warrantyDays: 7,
      hasVariants: false
    },
    theme: {
      id: 'theme-tactical-olive',
      name: 'Oliva Táctico & Oro',
      headerBg: 'from-[#111c11] via-[#1e331e] to-[#111c11]',
      topStripBg: 'bg-[#eab308] text-[#111c11]',
      primaryBg: 'bg-[#1e331e]',
      primaryText: 'text-[#142414]',
      accentBg: 'bg-[#ca8a04]',
      accentText: 'text-[#fef08a]',
      ctaGradient: 'from-[#16a34a] to-[#15803d]',
      pageBg: 'bg-stone-100',
      cardBorder: 'border-stone-300',
      badgeBg: 'bg-lime-100 text-lime-950 border-lime-400'
    },
    previewImage: '/assets/real/galeria-5.jpg',
    sampleHighlights: [
      'Muy fuerte en todo el interior del país, pescadores, guardias y hogares por cortes de luz'
    ]
  }
];

// ============================================================================
// 3. CALCULADORA INTELIGENTE DE RENTABILIDAD COD PARAGUAY (#3)
// ============================================================================
export function calculateCodEconomicsParaguay(params: {
  supplierCostGs: number;
  estimatedCpaGs?: number;
  courierCostGs?: number;
  returnRatePercent?: number;
  overridePack1Gs?: number;
  overridePack2Gs?: number;
  overridePack3Gs?: number;
}): ProductCodEconomics {
  const supplier = Math.max(5000, Math.round(Number(params.supplierCostGs) || 45000));
  const cpa = Math.max(5000, Math.round(Number(params.estimatedCpaGs ?? 30000)));
  const courier = Math.max(10000, Math.round(Number(params.courierCostGs ?? 28000)));
  const returnRate = Math.min(40, Math.max(0, Number(params.returnRatePercent ?? 10)));

  // Costo por no-entrega ponderado (cuando un pedido rebota, se pierde flete/CPA parcial)
  const bouncePenaltyGs = Math.round(((cpa + courier) * returnRate) / 100);

  // Precio psicológico terminado en 9.000 Gs.
  const roundTo9000 = (val: number) => {
    const thousands = Math.max(99, Math.round(val / 1000));
    const baseTen = Math.floor(thousands / 10) * 10 + 9;
    return baseTen * 1000;
  };

  const rawSuggested1 = supplier + cpa + courier + bouncePenaltyGs + Math.max(55000, Math.round(supplier * 1.15));
  const suggestedPack1Gs = params.overridePack1Gs && params.overridePack1Gs > 0
    ? Math.round(params.overridePack1Gs)
    : roundTo9000(rawSuggested1);

  const suggestedPack2Gs = params.overridePack2Gs && params.overridePack2Gs > 0
    ? Math.round(params.overridePack2Gs)
    : roundTo9000(suggestedPack1Gs * 1.84);

  const suggestedPack3Gs = params.overridePack3Gs && params.overridePack3Gs > 0
    ? Math.round(params.overridePack3Gs)
    : roundTo9000(suggestedPack1Gs * 2.62);

  const totalCost1 = supplier * 1 + cpa + courier + bouncePenaltyGs;
  const totalCost2 = supplier * 2 + cpa + courier + bouncePenaltyGs;
  const totalCost3 = supplier * 3 + cpa + courier + bouncePenaltyGs;

  const netProfitPack1Gs = suggestedPack1Gs - totalCost1;
  const netProfitPack2Gs = suggestedPack2Gs - totalCost2;
  const netProfitPack3Gs = suggestedPack3Gs - totalCost3;

  const roiPercentPack1 = totalCost1 > 0 ? Math.round((netProfitPack1Gs / totalCost1) * 100) : 0;

  return {
    supplierCostGs: supplier,
    estimatedCpaGs: cpa,
    courierCostGs: courier,
    returnRatePercent: returnRate,
    suggestedPack1Gs,
    suggestedPack2Gs,
    suggestedPack3Gs,
    netProfitPack1Gs,
    netProfitPack2Gs,
    netProfitPack3Gs,
    roiPercentPack1
  };
}

// ============================================================================
// 4. ESTUDIO FOTOGRÁFICO IA DE PRODUCTO: DE 1 FOTO A 8 ESCENAS EN USO (#1)
// ============================================================================
export function generateRealistic8PhotoGallery(params: {
  productName: string;
  mainImage: string;
  extraImages?: string[];
  physicalTruth: ProductPhysicalTruth;
  template: SubNicheTemplateDef;
}) {
  const cleanName = params.productName.trim() || 'Producto Oficial';
  const baseImg = params.mainImage?.trim() || params.template.previewImage || '/assets/real/galeria-1.jpg';
  const extras = (params.extraImages || []).filter(Boolean);
  const pickImg = (idx: number) => extras[idx] || baseImg;

  return [
    {
      src: pickImg(0),
      alt: `${cleanName} en uso real demostrando su resultado principal en casa`,
      label: `1. ${cleanName} en Uso Real`,
      tag: 'Foto Real #1 · En Acción'
    },
    {
      src: pickImg(1),
      alt: `${cleanName} sostenido en mano humana mostrando tamaño real (${params.physicalTruth.realDimensions})`,
      label: `2. Tamaño Real en Mano (${params.physicalTruth.realDimensions})`,
      tag: 'Foto Real #2 · Escala Humana'
    },
    {
      src: pickImg(2),
      alt: `Detalle macro del material (${params.physicalTruth.materialMain}) de ${cleanName}`,
      label: `3. Calidad Macro (${params.physicalTruth.materialMain.slice(0, 28)})`,
      tag: 'Foto Real #3 · Detalle Material'
    },
    {
      src: pickImg(3),
      alt: `Contenido completo de la caja sellada: ${params.physicalTruth.boxContents}`,
      label: '4. Qué Incluye tu Caja Sellada',
      tag: 'Foto Real #4 · Caja Completa'
    },
    {
      src: pickImg(4),
      alt: `Conexión y funcionamiento: ${params.physicalTruth.powerSourceLabel}`,
      label: `5. Listo al Instante (${params.physicalTruth.powerSourceLabel.slice(0, 26)})`,
      tag: 'Foto Real #5 · Uso Fácil'
    },
    {
      src: pickImg(5),
      alt: `Comparativa Antes vs Después usando ${cleanName}`,
      label: '6. Resultado Antes vs. Después',
      tag: 'Foto Real #6 · Resultado Real'
    },
    {
      src: pickImg(6),
      alt: `Resistencia comprobada: ${params.physicalTruth.waterResistance}`,
      label: `7. Resistencia (${params.physicalTruth.waterResistance.slice(0, 26)})`,
      tag: 'Foto Real #7 · Durabilidad'
    },
    {
      src: pickImg(7),
      alt: `Medidas exactas y peso de ${cleanName}: ${params.physicalTruth.realDimensions} (${params.physicalTruth.weightApprox})`,
      label: `8. Ficha y Medidas (${params.physicalTruth.weightApprox})`,
      tag: 'Foto Real #8 · Ficha Exacta'
    }
  ];
}

// ============================================================================
// 5. ALGORITMO DE AUTO-ENTRENAMIENTO DEL AGENTE DE WHATSAPP A 1000X (#4)
// ============================================================================
export function buildAutoTrainedAgentBrain(params: {
  productName: string;
  productDescription: string;
  prices: Record<number, number>;
  physicalTruth: ProductPhysicalTruth;
  template: SubNicheTemplateDef;
  upsellPack2Enabled?: boolean;
  freeShipping?: boolean;
  shippingCostGs?: number;
}): { agentBrain: ProductAgentBrain; contextoIA: string } {
  const cleanName = params.productName.replace(/[*_™®©]/g, '').trim() || 'Producto Oficial';
  const hasFreeShipping = params.freeShipping !== false;
  const deliveryCostGs = Math.max(0, Number(params.shippingCostGs ?? 25000));
  const shippingTextSpoken = hasFreeShipping
    ? 'envío 100% gratis en todo el Paraguay'
    : `delivery rápido a domicilio (${formatGs(deliveryCostGs)}) en todo el Paraguay`;

  // Nombre hablado natural para voz y chat
  const lower = cleanName.toLowerCase();
  const isFeminine = /^(sart[eé]n|freidora|licuadora|picadora|mopa|hidrolavadora|manguera|faja|rodillera|almohada|planchita|depiladora|m[aá]scara|esp[aá]tula|patillera|afeitadora|minisierra|sierra|soldadora|aspiradora|c[aá]mara|linterna|carpa|waflera|selladora|batidora|cafetera|l[aá]mpara)/i.test(
    lower
  );
  const article = isFeminine ? 'la' : 'el';
  const shortProductSpoken = /^(el |la |los |las )/i.test(cleanName)
    ? cleanName
    : `${article} ${cleanName}`;

  const p1 = params.prices?.[1] || params.template.defaultPricePack1 || 189000;
  const p2 = params.prices?.[2] || params.template.defaultPricePack2 || 358000;
  const p3 = params.prices?.[3] || params.template.defaultPricePack3 || 507000;
  const diffPack2 = Math.max(30000, p2 - p1);
  const savingsPack2 = Math.max(20000, p1 * 2 - p2);

  const truth = params.physicalTruth;
  const technicalSpecsSpoken = `${cleanName} está fabricado en ${truth.materialMain}, con medidas reales de ${truth.realDimensions} y un peso aproximado de ${truth.weightApprox}. Funciona mediante ${truth.powerSourceLabel.toLowerCase()} y cuenta con ${truth.waterResistance.toLowerCase()}.`;
  const boxContentsSpoken = `En tu caja sellada recibís exactamente: ${truth.boxContents}${
    truth.hasVariants && truth.variantOptions?.length
      ? ` (disponible en opciones de ${truth.variantLabel || 'variante'}: ${truth.variantOptions.join(', ')})`
      : ''
  }.`;
  const usageSummarySpoken = params.productDescription?.trim() || params.template.winnerAngleHook;
  const warrantySpoken = `Contás con ${truth.warrantyDays || 7} días de garantía oficial escrita con ${shippingTextSpoken} y pago contra entrega recién al recibir en mano (efectivo, QR ueno/transferencia o tarjeta POS).`;

  const upsellPack2PitchSpoken = hasFreeShipping
    ? `Como el envío gratis hasta tu puerta ya está cubierto en la camioneta del repartidor, si querés aprovechar y sumar una segunda unidad en la misma caja llevás el Pack de 2 unidades por solo ${formatGs(p2)} en total (sumando apenas ${formatGs(diffPack2)} más y ahorrando ${formatGs(savingsPack2)}).`
    : `Como el repartidor ya va directo hasta tu puerta, si querés aprovechar el mismo viaje y sumar una segunda unidad en la misma caja llevás el Pack de 2 unidades por solo ${formatGs(p2)} en total (sumando apenas ${formatGs(diffPack2)} más y ahorrando ${formatGs(savingsPack2)}).`;

  const postConfirmationProductAngles = [
    `Qué excelente consulta me hacés, {nombre}, con muchísimo gusto te doy todos los detalles para que tengas total seguridad con tu compra. Tu pedido de ${shortProductSpoken} cuenta con estructura de ${truth.materialMain}, medidas reales de ${truth.realDimensions} y funciona con ${truth.powerSourceLabel.toLowerCase()}. Además, tu paquete ya quedó confirmado en despacho hacia {destino} con ${shippingTextSpoken} y recién abonás los {monto} cuando el repartidor te lo entregue en mano.`,
    `Con todo gusto te respondo esa duda, {nombre}, para que te quedes con la máxima tranquilidad. Tu unidad va completa en su caja sellada incluyendo exactamente: ${truth.boxContents}. Como ya dejamos registrada toda la referencia de {destino} en nuestro sistema informático, el chofer asignado a tu zona te va a contactar directamente cuando esté en camino para entregártelo en mano.`,
    `Excelente pregunta, {nombre}, te comento con mucha alegría que tu unidad de ${shortProductSpoken} ya pasó por revisión técnica de calidad en nuestro depósito y está lista en el sector de carga. Está diseñada específicamente con ${truth.waterResistance.toLowerCase()} y cuenta con ${truth.warrantyDays || 7} días de garantía oficial, así que muy pronto el repartidor estará llegando a {destino} con pago contra entrega.`,
    `Qué lindo poder charlar un ratito con vos, {nombre}, mientras el equipo termina de alistar la carga del día. Te cuento con todo cariño que en este momento te hablo desde la cabina de control operativo donde estamos verificando junto a los empaquetadores que tu caja de ${shortProductSpoken} lleve todos sus componentes (${truth.boxContents}) verificados al cien por ciento para que llegue impecable hasta {destino}.`,
    `Claro que sí, {nombre}, mirá te explico con total empatía: cuando tu pedido de ${shortProductSpoken} pasa al sector de despacho, el sistema le asigna automáticamente al repartidor tu caja verificada en depósito y cierra la planilla de ruta hacia {destino} por {monto}, todo para cuidar que recibas tu mercadería exacta sin demoras.`
  ];

  const faqQuickAnswers = [
    {
      topic: 'funcionamiento_y_energia',
      keywords: ['funciona', 'usa', 'enchufa', 'cable', 'bateria', 'carga', 'corriente', 'instala'],
      answerSpoken: `Se utiliza de forma súper práctica: ${truth.powerSourceLabel}. ${usageSummarySpoken}`
    },
    {
      topic: 'contenido_de_caja',
      keywords: ['incluye', 'trae', 'caja', 'viene', 'accesorios', 'piezas'],
      answerSpoken: boxContentsSpoken
    },
    {
      topic: 'material_y_medidas',
      keywords: ['material', 'medida', 'tamaño', 'grande', 'chico', 'peso', 'calidad', 'resiste', 'agua'],
      answerSpoken: technicalSpecsSpoken
    },
    {
      topic: 'precios_y_packs',
      keywords: ['precio', 'cuanto', 'cuesta', 'dos', 'pack', 'oferta', 'descuento', 'unidades'],
      answerSpoken: `Los precios promocionales (${shippingTextSpoken}) son: 1 unidad por ${formatGs(p1)}, el Pack de 2 unidades por ${formatGs(p2)} (ahorrando ${formatGs(savingsPack2)}), y el Pack de 3 unidades por ${formatGs(p3)}. ${upsellPack2PitchSpoken}`
    },
    {
      topic: 'envio_y_garantia',
      keywords: ['garantia', 'envio', 'repartidor', 'cuando', 'llega', 'pago', 'efectivo', 'qr', 'transferencia'],
      answerSpoken: warrantySpoken
    }
  ];

  const contextoIA = [
    `PRODUCTO OFICIAL: ${cleanName} (${shortProductSpoken}).`,
    `NICHO / CATEGORÍA: ${params.template.subNicheLabel}.`,
    `BENEFICIO PRINCIPAL: ${usageSummarySpoken}`,
    `MODALIDAD DE ENVÍO: ${hasFreeShipping ? 'ENVÍO 100% GRATIS INCLUIDO' : `ENVÍO CON COSTO DE DELIVERY (${formatGs(deliveryCostGs)})`}.`,
    `PRECIOS OFICIALES: 1 unidad = ${formatGs(p1)} | Pack 2 unidades (Oferta Estrella) = ${formatGs(p2)} | Pack 3 unidades = ${formatGs(p3)}.`,
    `VERDAD FÍSICA DEL PRODUCTO (NO INVENTAR NADA FUERA DE ESTO):`,
    `- Alimentación / Energía: ${truth.powerSourceLabel}.`,
    `- Medidas reales: ${truth.realDimensions} (Peso aprox: ${truth.weightApprox}).`,
    `- Material principal: ${truth.materialMain}.`,
    `- Contenido exacto de la caja: ${truth.boxContents}.`,
    `- Resistencia / Cuidado: ${truth.waterResistance}.`,
    `- Garantía y Pago: ${warrantySpoken}`,
    params.upsellPack2Enabled
      ? `- OFERTA DE SUBIDA A PACK 2 ACTIVA: Si el cliente pidió 1 unidad y consulta por promociones o desea sumar otra unidad, ofrecele el Pack de 2 unidades por ${formatGs(p2)}.`
      : ''
  ]
    .filter(Boolean)
    .join('\n');

  return {
    agentBrain: {
      trainedAt: new Date().toISOString(),
      version: 2,
      shortProductSpoken,
      productCategoryLabel: params.template.subNicheLabel,
      technicalSpecsSpoken,
      boxContentsSpoken,
      usageSummarySpoken,
      powerAndResistanceSpoken: `${truth.powerSourceLabel} · ${truth.waterResistance}`,
      warrantySpoken,
      upsellPack2Enabled: Boolean(params.upsellPack2Enabled),
      upsellPack2PriceGs: p2,
      upsellPack2PitchSpoken,
      postConfirmationProductAngles,
      faqQuickAnswers
    },
    contextoIA
  };
}

// ============================================================================
// 6. SINTETIZADOR COMPLETO DE LANDING PAGE DESDE PLANTILLA + COMPETENCIA + VERDAD FÍSICA
// ============================================================================
export function synthesizeCompleteLandingContent(params: {
  productName: string;
  productDescription: string;
  mainImage: string;
  extraImages?: string[];
  prices: Record<number, number>;
  normalPrice: number;
  physicalTruth: ProductPhysicalTruth;
  template: SubNicheTemplateDef;
  competitorAds?: MetaAdCompetitorItem[];
  freeShipping?: boolean;
  shippingCostGs?: number;
}): ProductLandingContent {
  const cleanName = params.productName.trim() || 'Producto Oficial';
  const shortBrand = cleanName.split(/\s+/)[0].replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]/g, '') || 'Oficial';
  const desc = params.productDescription.trim() || params.template.winnerAngleHook;
  const truth = params.physicalTruth;
  const topWinnerAd = params.competitorAds?.[0];
  const hasFreeShipping = params.freeShipping !== false;
  const deliveryCostGs = Math.max(0, Number(params.shippingCostGs ?? 25000));

  const galleryItems = generateRealistic8PhotoGallery({
    productName: cleanName,
    mainImage: params.mainImage,
    extraImages: params.extraImages,
    physicalTruth: truth,
    template: params.template
  });

  const benefitCards = [
    {
      img: galleryItems[0].src,
      badge: topWinnerAd?.detectedAngle || 'Resultado Inmediato',
      cameraMeta: `${cleanName} · En uso real`,
      title: desc.length <= 72 ? desc : `${cleanName}: resultados reales desde el primer uso`,
      desc: `Diseñado con ${truth.materialMain} (${truth.realDimensions}) para brindarte máxima eficacia sin complicaciones en tu hogar.`
    },
    {
      img: galleryItems[4].src,
      badge: 'Listo al Instante',
      cameraMeta: truth.powerSourceLabel,
      title: `Fácil de usar: ${truth.powerSourceLabel}`,
      desc: `Pesa solo ${truth.weightApprox}. Lo sacás de la caja y lo empezás a usar en segundos sin instalaciones complicadas.`
    },
    {
      img: galleryItems[2].src,
      badge: 'Calidad Superior',
      cameraMeta: truth.materialMain,
      title: `Construcción reforzada en ${truth.materialMain}`,
      desc: `${truth.waterResistance}. Fabricado para uso intensivo diario con ${truth.warrantyDays} días de garantía oficial en Paraguay.`
    },
    {
      img: galleryItems[3].src,
      badge: 'Caja Completa',
      cameraMeta: 'Pago al recibir en puerta',
      title: 'Recibís el kit completo y pagás recién al repartidor',
      desc: hasFreeShipping
        ? `Incluye: ${truth.boxContents}. Envío 100% gratis a Asunción, Central y todo el país.`
        : `Incluye: ${truth.boxContents}. Entrega rápida en puerta en Asunción, Central y todo el país.`
    }
  ];

  const vsComparisons = [
    {
      feature: 'Practicidad y Velocidad',
      ours: `Listo en segundos (${truth.powerSourceLabel})`,
      old: 'Métodos lentos, complicados y cansadores'
    },
    {
      feature: 'Material y Construcción',
      ours: `${truth.materialMain} (${truth.realDimensions})`,
      old: 'Plásticos débiles que duran pocos días'
    },
    {
      feature: 'Qué incluye tu compra',
      ours: truth.boxContents,
      old: 'Vienen incompletos y te cobran accesorios aparte'
    },
    {
      feature: 'Seguridad de Compra en Paraguay',
      ours: hasFreeShipping
        ? 'Envío Gratis + Pagás recién al recibir en tu puerta'
        : 'Entrega Rápida + Pagás recién al recibir en tu puerta',
      old: 'Piden giros o pagos por adelantado sin garantía'
    },
    {
      feature: 'Respaldo y Garantía',
      ours: `${truth.warrantyDays} días de garantía directa + Soporte WhatsApp`,
      old: 'Nadie responde si tenés una consulta'
    }
  ];

  const specsGrid = [
    { label: 'Alimentación / Energía', value: truth.powerSourceLabel },
    { label: 'Medidas Reales', value: truth.realDimensions },
    { label: 'Peso Aproximado', value: truth.weightApprox },
    { label: 'Material Principal', value: truth.materialMain },
    { label: 'Contenido de la Caja', value: truth.boxContents },
    { label: 'Resistencia y Garantía', value: `${truth.waterResistance} · ${truth.warrantyDays} días` }
  ];

  const reviews = [
    {
      name: 'Mirian González',
      city: 'San Lorenzo, Central',
      comment: `¡Excelente ${cleanName}! Tal cual se describe en la página: ${truth.boxContents}. Me llegó en 24 horas y recién le pagué al repartidor por QR cuando revisé mi paquete en la puerta.`,
      rating: 5,
      pack: 'Compró Pack 2 Unidades (Oferta Estrella)',
      photo: galleryItems[0].src
    },
    {
      name: 'Jorge Villalba',
      city: 'Asunción, Barrio Villa Morra',
      comment: `Se nota la calidad del material (${truth.materialMain}). Muy práctico porque funciona con ${truth.powerSourceLabel.toLowerCase()}. Lo recomiendo al 100%.`,
      rating: 5,
      pack: 'Compró 1 Unidad',
      photo: galleryItems[1].src
    },
    {
      name: 'Lourdes Cáceres',
      city: 'Luque, Central',
      comment: `Pedí el Pack de 2 para mi casa y para regalarle a mi mamá. La atención por WhatsApp fue rapidísima, confirmaron mi ubicación en el mapa y el chofer llegó súper puntual.`,
      rating: 5,
      pack: 'Compró Pack 2 Unidades',
      photo: galleryItems[2].src
    },
    {
      name: 'Arnaldo Benítez',
      city: 'Ciudad del Este, Alto Paraná',
      comment: `Llegó impecable hasta Ciudad del Este. Cumple exactamente con las medidas (${truth.realDimensions}) y rinde muchísimo.`,
      rating: 5,
      pack: 'Compró Pack 3 Unidades',
      photo: galleryItems[3].src
    }
  ];

  const faqs = [
    {
      q: '¿Cómo funciona el pago contra entrega en Paraguay?',
      a: 'Completás el formulario con tu nombre, celular y ubicación. Nuestro equipo te confirma por WhatsApp antes de que salga el repartidor y recién abonás cuando tenés el paquete en tus manos (en efectivo, QR de banco/ueno o tarjeta POS).'
    },
    {
      q: `¿Qué incluye exactamente la caja de ${cleanName}?`,
      a: `Tu pedido llega en caja cerrada incluyendo: ${truth.boxContents}. Todo revisado por nuestros técnicos antes de salir a reparto.`
    },
    {
      q: '¿Cómo se alimenta o cómo funciona el producto?',
      a: `${cleanName} funciona mediante: ${truth.powerSourceLabel}. Sus medidas reales son ${truth.realDimensions} (${truth.weightApprox}) y está construido en ${truth.materialMain}.`
    },
    {
      q: hasFreeShipping ? '¿El envío es verdaderamente gratis?' : '¿Cómo funciona el envío a domicilio?',
      a: hasFreeShipping
        ? 'Sí, el envío es 100% gratuito para Asunción, todo el Departamento Central y las principales ciudades del interior del país. Solo abonás el valor del Pack que elijas.'
        : `Realizamos entregas rápidas en puerta en Asunción, Central y todo el país con un costo de delivery de ${formatGs(deliveryCostGs)}. Abonás recién al recibir.`
    },
    {
      q: '¿Cuánto tarda en llegar mi pedido?',
      a: 'En Asunción y Gran Asunción (Luque, San Lorenzo, Lambaré, Fernando de la Mora, Capiatá, Limpio, Ñemby) entregamos en 24 horas. En el interior del país de 24 a 48 horas hábiles.'
    },
    {
      q: '¿Qué garantía tengo con mi compra?',
      a: `Contás con ${truth.warrantyDays} días de garantía oficial directa. Si tu unidad presenta cualquier inconveniente de fábrica, te gestionamos el cambio inmediato sin costo.`
    }
  ];

  const conciseHighlight =
    topWinnerAd?.headline ||
    (desc.length <= 68
      ? desc
      : desc.split(/[.,;·]/)[0].trim().slice(0, 68) || params.template.winnerAngleHook);

  return {
    brandTitle: shortBrand,
    topBarBadge: params.template.badge.replace(/^[^\s]+\s*/, '') || 'OFERTA HOY',
    topBarText: hasFreeShipping
      ? 'ENVÍO GRATIS EN PARAGUAY · PAGÁS AL RECIBIR'
      : 'ENTREGA RÁPIDA EN PARAGUAY · PAGÁS AL RECIBIR',
    heroBadge: `${params.template.subNicheLabel} · Garantía Oficial`,
    heroTitle: cleanName,
    heroHighlight: conciseHighlight,
    heroSubtitle: `${desc} Construido en ${truth.materialMain} (${truth.realDimensions}). Incluye: ${truth.boxContents}.`,
    packLabels: {
      1: {
        title: '1 Unidad · Pack Individual',
        subtitle: hasFreeShipping ? 'Envío Gratis + Pago al recibir' : 'Entrega en puerta + Pago al recibir',
        tag: 'Prueba'
      },
      2: {
        title: '2 Unidades · Pack Dúo Ahorro',
        subtitle: 'Llevás 2 en el mismo envío con descuento especial',
        tag: 'MÁS ELEGIDO'
      },
      3: {
        title: '3 Unidades · Pack Mayorista / Familia',
        subtitle: 'El precio más bajo por unidad + Prioridad de despacho',
        tag: 'MAYOR AHORRO'
      }
    },
    galleryItems,
    benefitSectionBadge: 'Por Qué Todos Lo Eligen en Paraguay',
    benefitSectionTitle: `4 razones por las que ${cleanName} supera a todo lo tradicional`,
    benefitSectionSubtitle: `Verificado en depósito: ${truth.materialMain} · ${truth.powerSourceLabel}`,
    benefitCards,
    showcaseBadge: 'Demostración y Ficha Real',
    showcaseTitle: `Conocé por dentro ${cleanName}`,
    showcaseSubtitle: `${truth.boxContents} · Medidas: ${truth.realDimensions}`,
    vsCompetitorTitle: `¿Por qué elegir ${cleanName} frente a imitaciones comunes?`,
    vsOursLabel: cleanName,
    vsOldLabel: 'Comunes / Imitaciones',
    vsComparisons,
    specsGrid,
    reviewsBadge: 'Clientes Verificados en Paraguay',
    reviewsTitle: `Compradores reales que ya recibieron ${cleanName} en su puerta`,
    reviewsRatingLabel: '4.9 / 5.0 calificación verificada contra entrega',
    reviews,
    faqsBadge: 'Dudas Frecuentes Resueltas',
    faqsTitle: `Todo sobre tu pedido de ${cleanName}`,
    faqs
  };
}

// ============================================================================
// 7. AGENTE DE CODIFICACIÓN & DISEÑO COD EMBEBIDO (MUTADOR EN TIEMPO REAL)
// ============================================================================
export const THEME_PRESETS_MAP: Record<string, ProductThemeConfig> = {
  esmeralda: SUBNICHE_TEMPLATES[0].theme,
  terracota: SUBNICHE_TEMPLATES[1].theme,
  grafito: SUBNICHE_TEMPLATES[2].theme,
  menta: SUBNICHE_TEMPLATES[3].theme,
  cobalto: SUBNICHE_TEMPLATES[5].theme,
  hielo: SUBNICHE_TEMPLATES[7].theme,
  solar: SUBNICHE_TEMPLATES[10].theme,
  fitness: SUBNICHE_TEMPLATES[12].theme,
  crimson: SUBNICHE_TEMPLATES[13].theme,
  clinico: SUBNICHE_TEMPLATES[15].theme,
  rosegold: SUBNICHE_TEMPLATES[18].theme,
  barber: SUBNICHE_TEMPLATES[21].theme,
  industrial: SUBNICHE_TEMPLATES[23].theme,
  seguridad: SUBNICHE_TEMPLATES[27].theme,
  cyber: SUBNICHE_TEMPLATES[29].theme
};

export function applyCodingAgentInstructionToDraft(params: {
  instruction: string;
  currentLanding: ProductLandingContent;
  currentTheme: ProductThemeConfig;
  currentPrices: Record<number, number>;
  currentTruth: ProductPhysicalTruth;
  productName: string;
  currentWa?: string;
  currentWaNotificacionesVendedor?: string;
  currentVozAgente?: string;
  currentFreeShipping?: boolean;
}): {
  updatedLanding: ProductLandingContent;
  updatedTheme: ProductThemeConfig;
  updatedPrices: Record<number, number>;
  updatedTruth: ProductPhysicalTruth;
  updatedWa?: string;
  updatedWaNotificacionesVendedor?: string;
  updatedVozAgente?: string;
  updatedFreeShipping?: boolean;
  agentExplanation: string;
  appliedChanges: string[];
} {
  const raw = params.instruction.trim();
  const lower = raw.toLowerCase();
  const nextLanding: ProductLandingContent = JSON.parse(JSON.stringify(params.currentLanding));
  let nextTheme: ProductThemeConfig = { ...params.currentTheme };
  const nextPrices: Record<number, number> = { ...params.currentPrices };
  const nextTruth: ProductPhysicalTruth = { ...params.currentTruth };
  let nextWa = params.currentWa;
  let nextWaNotificacionesVendedor = params.currentWaNotificacionesVendedor;
  let nextVozAgente = params.currentVozAgente;
  let nextFreeShipping = params.currentFreeShipping;
  const appliedChanges: string[] = [];

  // 1. Detectar cambios de paleta / colores por lenguaje natural
  if (/\b(negro|oscuro|mate|dorado|oro|lujo|vip|barber)\b/i.test(lower)) {
    nextTheme = {
      ...THEME_PRESETS_MAP.barber,
      name: 'Negro Mate & Oro VIP (Personalizado por Agente)',
      layoutArchetype: 'minimalist-luxury',
      buttonShape: 'rounded-full'
    };
    appliedChanges.push('Paleta visual cambiada a Negro Mate & Dorado de Alto Impacto con botones cápsula.');
  } else if (/\b(rojo|fuego|urgencia|impacto|carmes[ií]|gym)\b/i.test(lower)) {
    nextTheme = {
      ...THEME_PRESETS_MAP.crimson,
      name: 'Rojo Impacto & Obsidiana (Personalizado por Agente)',
      layoutArchetype: 'athletic-performance',
      buttonShape: 'rounded-lg'
    };
    appliedChanges.push('Paleta visual actualizada a Rojo Impacto & Obsidiana con diseño dinámico.');
  } else if (/\b(azul|cl[ií]nico|m[eé]dico|salud|confianza|cobalto)\b/i.test(lower)) {
    nextTheme = {
      ...THEME_PRESETS_MAP.clinico,
      name: 'Azul Clínico & Turquesa (Personalizado por Agente)',
      layoutArchetype: 'nordic-clinical',
      buttonShape: 'rounded-2xl'
    };
    appliedChanges.push('Paleta visual actualizada a Azul Clínico & Turquesa con sellos médicos.');
  } else if (/\b(rosa|femenino|belleza|boutique|sal[oó]n)\b/i.test(lower)) {
    nextTheme = {
      ...THEME_PRESETS_MAP.rosegold,
      name: 'Oro Rosa & Boutique (Personalizado por Agente)',
      layoutArchetype: 'minimalist-luxury',
      buttonShape: 'rounded-full'
    };
    appliedChanges.push('Paleta visual actualizada a Oro Rosa & Boutique con tipografía fina.');
  } else if (/\b(amarillo|industrial|herramienta|taller|robusto)\b/i.test(lower)) {
    nextTheme = {
      ...THEME_PRESETS_MAP.industrial,
      name: 'Amarillo Industrial & Acero (Personalizado por Agente)',
      layoutArchetype: 'brutalist-industrial',
      buttonShape: 'rounded-none'
    };
    appliedChanges.push('Paleta visual actualizada a Amarillo Industrial & Acero con bordes rectos.');
  } else if (/\b(verde|esmeralda|noelux|original)\b/i.test(lower)) {
    nextTheme = {
      ...THEME_PRESETS_MAP.esmeralda,
      name: 'Esmeralda Real & Oro Noelux (Personalizado por Agente)',
      layoutArchetype: 'noelux-classic',
      buttonShape: 'rounded-2xl'
    };
    appliedChanges.push('Paleta visual actualizada al estilo Esmeralda & Oro Original Noelux.');
  } else if (/\b(naranja|c[aá]lido|cocina|terracota)\b/i.test(lower)) {
    nextTheme = {
      ...THEME_PRESETS_MAP.terracota,
      name: 'Terracota Gourmet & Cobre (Personalizado por Agente)',
      layoutArchetype: 'warm-culinary',
      buttonShape: 'rounded-2xl'
    };
    appliedChanges.push('Paleta visual actualizada a Terracota Gourmet & Cobre.');
  }

  // 2. Detectar cambios de precio en Gs. mencionados en la instrucción
  const priceMatch1 = raw.match(/(?:pack\s*1|precio\s*base|unitario)\D+(\d{2,3})[.\s]?(\d{3})/i);
  if (priceMatch1) {
    nextPrices[1] = Number(`${priceMatch1[1]}${priceMatch1[2]}`);
    appliedChanges.push(`Precio del Pack 1 actualizado a ${formatGs(nextPrices[1])}.`);
  }
  const priceMatch2 = raw.match(/pack\s*2\D+(\d{2,3})[.\s]?(\d{3})/i);
  if (priceMatch2) {
    nextPrices[2] = Number(`${priceMatch2[1]}${priceMatch2[2]}`);
    appliedChanges.push(`Precio del Pack 2 actualizado a ${formatGs(nextPrices[2])}.`);
  }
  const priceMatch3 = raw.match(/pack\s*3\D+(\d{2,3})[.\s]?(\d{3})/i);
  if (priceMatch3) {
    nextPrices[3] = Number(`${priceMatch3[1]}${priceMatch3[2]}`);
    appliedChanges.push(`Precio del Pack 3 actualizado a ${formatGs(nextPrices[3])}.`);
  }

  // 3. Detectar bono o regalo en Pack 2
  if (/\b(regalo|bono|gratis en el pack 2|incluya|incluir)\b/i.test(lower)) {
    const giftExtract = raw.replace(/^.*?\b(regalo|bono|incluya|incluir)\b[:\s]*/i, '').trim();
    const cleanGift = giftExtract.slice(0, 65) || 'Regalo Especial Incluido';
    nextLanding.packLabels[2].subtitle = `Llevás 2 unidades + BONO: ${cleanGift}`;
    nextLanding.packLabels[2].tag = '🎁 PACK 2 + REGALO HOY';
    appliedChanges.push(`Se agregó el gancho de bono/regalo en el Pack 2: "${cleanGift}".`);
  }

  // 4. Detectar cambio de titular o ángulo de venta (ej. amas de casa, regalo, choferes, etc.)
  if (/\b(t[ií]tulo|titular|encabezado|promesa|[aá]ngulo|enfoc[aá]|para )\b/i.test(lower)) {
    const quoted = raw.match(/["“”'«»]([^"“”'«»]{8,140})["“”'«»]/);
    if (quoted?.[1]) {
      nextLanding.heroHighlight = quoted[1].trim();
      appliedChanges.push(`Titular principal actualizado a: "${nextLanding.heroHighlight}".`);
    } else {
      nextLanding.heroHighlight = `${params.productName}: ${raw.slice(0, 110)}`;
      appliedChanges.push(`Ángulo principal adaptado según tu instrucción: "${nextLanding.heroHighlight}".`);
    }
  }

  // 5. Detectar cambio de números de WhatsApp
  const phoneMatch = raw.match(/(?:09\d{2}[-.\s]?\d{3}[-.\s]?\d{3}|5959\d{8})/);
  if (phoneMatch) {
    const rawDigits = phoneMatch[0].replace(/[-.\s]/g, '');
    const cleanPhone = rawDigits.startsWith('0') ? '595' + rawDigits.slice(1) : rawDigits;
    if (/\b(vendedor|notificaci[oó]n|aviso|reporte)\b/i.test(lower)) {
      nextWaNotificacionesVendedor = cleanPhone;
      appliedChanges.push(`WhatsApp de reportes para el vendedor actualizado a +${cleanPhone}.`);
    } else {
      nextWa = cleanPhone;
      appliedChanges.push(`WhatsApp de atención al cliente actualizado a +${cleanPhone}.`);
    }
  }

  // 6. Detectar cambio de voz del agente
  if (/\b(estrella)\b/i.test(lower)) {
    nextVozAgente = 'deepgram-estrella';
    appliedChanges.push('Voz del agente cambiada a Estrella (Femenina Natural · Aura-2).');
  } else if (/\b(celeste)\b/i.test(lower)) {
    nextVozAgente = 'deepgram-celeste';
    appliedChanges.push('Voz del agente cambiada a Celeste (Femenina Energética · Aura-2).');
  } else if (/\b(sirio)\b/i.test(lower)) {
    nextVozAgente = 'deepgram-sirio';
    appliedChanges.push('Voz del agente cambiada a Sirio (Masculina Profesional · Aura-2).');
  } else if (/\b(n[eé]stor)\b/i.test(lower)) {
    nextVozAgente = 'deepgram-nestor';
    appliedChanges.push('Voz del agente cambiada a Néstor (Masculina Ejecutiva · Aura-2).');
  }

  // 7. Detectar cambio de envío gratis vs costo
  if (/\b(env[ií]o gratis|sin costo de env[ií]o)\b/i.test(lower)) {
    nextFreeShipping = true;
    nextLanding.topBarText = 'ENVÍO GRATIS EN PARAGUAY · PAGÁS AL RECIBIR';
    appliedChanges.push('Envío configurado como 100% Gratis en todo el país.');
  } else if (/\b(cobrar env[ií]o|cobrar delivery|con costo de delivery)\b/i.test(lower)) {
    nextFreeShipping = false;
    nextLanding.topBarText = 'ENTREGA RÁPIDA · PAGÁS AL RECIBIR EN PUERTA';
    appliedChanges.push('Envío configurado con costo de delivery (+25.000 Gs).');
  }

  // 8. Detectar cambio en contenido de la caja sellada o garantía
  if (/\b(caja|kit|incluye|viene con)\b/i.test(lower)) {
    const boxExtract = raw.replace(/^.*?\b(caja|kit|incluye|viene con)\b[:\s]*/i, '').trim();
    if (boxExtract.length > 5) {
      nextTruth.boxContents = boxExtract.slice(0, 140);
      appliedChanges.push(`Contenido de la caja sellada actualizado a: "${nextTruth.boxContents}".`);
    }
  }
  const warrantyMatch = raw.match(/(\d{1,2})\s*d[ií]as\s*de\s*garant[ií]a/i);
  if (warrantyMatch) {
    nextTruth.warrantyDays = parseInt(warrantyMatch[1], 10);
    appliedChanges.push(`Garantía oficial actualizada a ${nextTruth.warrantyDays} días.`);
  }

  // 9. Detectar solicitud de emblema, sello, badge, insignia o distintivo
  if (/\b(emblema|sello|badge|insignia|etiqueta|distintivo)\b/i.test(lower)) {
    const quoted = raw.match(/["“”'«»]([^"“”'«»]{3,60})["“”'«»]/);
    let emblemText = '';
    if (quoted?.[1]) {
      emblemText = quoted[1].trim();
    } else {
      const extracted = raw.replace(/^.*?\b(emblema|sello|badge|insignia|etiqueta|distintivo)\b[:\s]*/i, '').trim();
      emblemText = extracted.slice(0, 45) || 'CALIDAD PREMIUM COMPROBADA';
    }
    nextLanding.heroBadge = emblemText.toUpperCase();
    nextLanding.topBarBadge = '★ ' + emblemText.toUpperCase();
    if (/\b(oro|dorado|lujo)\b/i.test(lower)) {
      nextTheme.badgeStyle = 'golden-seal';
    } else if (/\b(industrial|peligro|seguridad)\b/i.test(lower)) {
      nextTheme.badgeStyle = 'hazard-tag';
    } else if (/\b(cl[ií]nico|m[eé]dico)\b/i.test(lower)) {
      nextTheme.badgeStyle = 'clinical-badge';
    } else if (/\b(cyber|tecnolog)\b/i.test(lower)) {
      nextTheme.badgeStyle = 'cyber-chip';
    } else {
      nextTheme.badgeStyle = 'golden-seal';
    }
    appliedChanges.push(`Emblema oficial incorporado en la portada: "${nextLanding.heroBadge}".`);
  }

  // 10. Si no cayó en ninguna regla específica, aplicar la instrucción a la promesa principal
  if (appliedChanges.length === 0) {
    nextLanding.heroHighlight = raw.length <= 120 ? raw : `${raw.slice(0, 117)}...`;
    if (nextLanding.benefitCards[0]) {
      nextLanding.benefitCards[0].desc = `${raw} (${nextLanding.benefitCards[0].desc})`;
    }
    appliedChanges.push('Se aplicó tu instrucción directamente en la promesa principal y en la primera tarjeta de beneficio móvil.');
  }

  return {
    updatedLanding: nextLanding,
    updatedTheme: nextTheme,
    updatedPrices: nextPrices,
    updatedTruth: nextTruth,
    updatedWa: nextWa,
    updatedWaNotificacionesVendedor: nextWaNotificacionesVendedor,
    updatedVozAgente: nextVozAgente,
    updatedFreeShipping: nextFreeShipping,
    agentExplanation: `¡Listo! Ejecuté ${appliedChanges.length} modificación(es) sobre la arquitectura móvil de "${params.productName}":\n• ${appliedChanges.join('\n• ')}`,
    appliedChanges
  };
}
