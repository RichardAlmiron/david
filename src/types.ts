export type OrderStatus = 'reservado' | 'en_camino' | 'entregado_pagado' | 'cancelado';
export type AIMode = 'manual' | 'automatico';
export type WaCommercialStageId =
  | 'stage1_welcome'
  | 'stage2_warning'
  | 'stage3_confirmed'
  | 'stage4_vip_upsell';
export type WaCommercialPackKey = 'pack1' | 'pack2' | 'pack3';

export interface WaStageCommercialAsset {
  stageId: WaCommercialStageId;
  packKey: WaCommercialPackKey;
  packQty: number;
  imageUrl: string;
  aiSceneUrl?: string;
  framedPriceGs: number;
  vipPriceGs?: number;
  normalStrikePriceGs?: number;
  headline: string;
  ctaText: string;
  whatsappCaption: string;
  sourceType: 'studio_framed' | 'ai_framed';
  generatedAt: string;
}

export type ProductWaStageCommercialMap = Partial<
  Record<WaCommercialStageId, Partial<Record<WaCommercialPackKey, WaStageCommercialAsset>>>
>;

export interface OrderComparisonSummary {
  nombreWeb: string;
  nombreConfirmado: string;
  celularWeb: string;
  celularConfirmado: string;
  ubicacionWeb: string;
  ubicacionConfirmada: string;
  direccionWeb: string;
  direccionConfirmada: string;
  referenciaConfirmada: string;
  packConfirmado: string;
  coincidenDatos: boolean;
  resumenTexto: string;
  fechaConfirmacion?: string;
  gpsLink?: string;
  gpsStreetViewLink?: string;
  fachadaFotoUrl?: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsConfirmado?: boolean;
  tipoVivienda?: 'casa' | 'edificio';
  nombreEdificio?: string;
  pisoEdificio?: string;
  departamentoNumero?: string;
  tieneRecepcion?: 'si_recepcionista' | 'no_personalmente';
  detalleRecepcion?: string;
}

export interface SellerAgentChatMessage {
  id: string;
  productId: string;
  sellerPhone: string;
  sender: 'agent' | 'seller';
  senderName: string;
  text: string;
  timestamp: string;
  alertColor?: 'red' | 'green' | 'normal';
  orderId?: string;
  sentViaWhatsApp?: boolean;
}

export interface Order {
  id?: string;
  reservaid: string;
  productoId?: string;
  producto?: string;
  waVendedor?: string;
  nombre: string;
  celular: string;
  departamento: string;
  ciudad: string;
  barrio?: string;
  calle?: string;
  direccion: string;
  detalle: string;
  cantidad: number;
  monto: number;
  ref_code: string | null;
  dispositivo?: string;
  estado: OrderStatus;
  fecha?: string;
  acredita?: boolean;
  modoIA?: AIMode;
  llamadaIA?: AIMode;
  canalIA?: 'audio' | 'texto';
  vozAgente?: string;
  vozAgenteNombre?: string;
  convStep?: number;
  atendidoPorIA?: boolean;
  ultimoMensajeIA?: string;
  referenciaCasa?: string;
  datosConfirmados?: boolean;
  agenteCompletado?: boolean;
  empaquetado?: boolean;
  resumenConfirmacionIA?: string;
  comparativaDatos?: OrderComparisonSummary;
  estadoEnvioProducto?: 'no_enviado' | 'enviado' | 'concretado';
  concretadoCobrado?: boolean;
  avisoVendedorRojoEnviado?: boolean;
  avisoVendedorVerdeEnviado?: boolean;
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracy?: number;
  gpsLink?: string;
  gpsStreetViewLink?: string;
  fachadaFotoUrl?: string;
  gpsConfirmado?: boolean;
  gpsDireccionDetectada?: string;
  tipoVivienda?: 'casa' | 'edificio';
  nombreEdificio?: string;
  pisoEdificio?: string;
  departamentoNumero?: string;
  tieneRecepcion?: 'si_recepcionista' | 'no_personalmente';
  detalleRecepcion?: string;
  archivado?: boolean;
  fechaArchivado?: string | null;
  actualizado_en?: string;
  promoPagoAdelantadoStage?: string;
  promoExplanationCount?: number;
  pagoAdelantadoComprobanteRecibido?: boolean;
  pagoAdelantadoVerificadoAdmin?: boolean;
  pagoAdelantadoEstado?: 'pago_enviado_por_verificar' | 'pagado_adelantado_confirmado' | string;
  pagoAdelantadoFecha?: string;
  pagoAdelantadoFechaVerificado?: string;
  pagoAdelantadoBanco?: string;
  pagoAdelantadoAlias?: string;
  pagoAdelantadoTitular?: string;
  modalidadPagoElegida?: string;
  montoOriginalSinDescuento?: number;
  montoConDescuentoAdelantado?: number;
  comprobantePagoDataUrl?: string;
  comprobantePagoMimeType?: string;
  comprobantePagoNombreArchivo?: string;
  waCommercialSentStages?: Partial<Record<WaCommercialStageId, boolean>>;
}

export interface AppConfig {
  marca: string;
  base: string;
  wa: string;
  directoWhatsapp: boolean;
  normal: number;
  lote: Record<number, number>;
  maxCant: number;
  stock: number;
  pixelId: string;
  corte: {
    activa: boolean;
    texto: string;
  };
  urgencia: {
    activa: boolean;
    texto: string;
  };
  supabase: {
    url: string;
    anonKey: string;
  };
  viral: {
    activo: boolean;
    ciclo: number;
    premio: number;
  };
}

export interface PublicEvent {
  id: string;
  tipo: 'vista' | 'reserva' | 'pago' | 'premio';
  ciudad: string;
  ref_code?: string | null;
  fecha: string;
  descripcion: string;
}

export type ViewType = 'store' | 'admin' | 'reparto' | 'promoter';

export type PolicyType = 'envio' | 'privacidad' | 'reembolsos' | 'terminos';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  nombre: string;
  rol: 'superadmin' | 'admin' | 'operador' | 'reparto';
}

export interface AdminAuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: AdminUser | null;
}

export interface ProductThemeConfig {
  id: string;
  name: string;
  headerBg: string; // e.g. 'from-[#041a12] via-[#083022] to-[#041a12]'
  topStripBg: string; // e.g. 'bg-[#e8b23a] text-[#062319]'
  primaryBg: string; // e.g. 'bg-[#0b3d2e]'
  primaryText: string; // e.g. 'text-[#0b3d2e]'
  accentBg: string; // e.g. 'bg-[#e8b23a]'
  accentText: string; // e.g. 'text-[#ffd778]'
  ctaGradient: string; // e.g. 'from-[#1ea856] to-[#12803d]'
  pageBg: string; // e.g. 'bg-stone-50'
  cardBorder: string; // e.g. 'border-[#dfdad0]'
  badgeBg: string; // e.g. 'bg-[#e5f6ec] text-[#064e3b] border-[#86efac]'
  layoutArchetype?:
    | 'brutalist-industrial'
    | 'warm-culinary'
    | 'athletic-performance'
    | 'minimalist-luxury'
    | 'nordic-clinical'
    | 'futuristic-cyber'
    | 'natural-organic'
    | 'noelux-classic';
  buttonShape?: 'rounded-none' | 'rounded-lg' | 'rounded-2xl' | 'rounded-full';
  typographyStyle?: 'sans-modern' | 'serif-editorial' | 'mono-industrial' | 'athletic-bold';
  badgeStyle?: 'minimal-tag' | 'pill-solid' | 'hazard-tag' | 'golden-seal' | 'clinical-badge' | 'cyber-chip';
  cardFormat?: 'bordered-raw' | 'soft-elevated' | 'glass-dark' | 'cream-stone' | 'tactical-grid';
  previewSnapshotUrl?: string;
}

export interface ProductPhysicalTruth {
  powerSource: 'enchufe_220v' | 'bateria_usb' | 'pilas' | 'solar' | 'manual_sin_energia';
  powerSourceLabel: string;
  realDimensions: string;
  weightApprox: string;
  materialMain: string;
  boxContents: string;
  waterResistance: string;
  warrantyDays: number;
  hasVariants: boolean;
  variantLabel?: string; // ej. 'Color o Talle'
  variantOptions?: string[];
}

export interface ProductCodEconomics {
  supplierCostGs: number;
  estimatedCpaGs: number;
  courierCostGs: number;
  returnRatePercent: number;
  suggestedPack1Gs: number;
  suggestedPack2Gs: number;
  suggestedPack3Gs: number;
  netProfitPack1Gs: number;
  netProfitPack2Gs: number;
  netProfitPack3Gs: number;
  roiPercentPack1: number;
}

export interface ProductLandingGalleryItem {
  src: string;
  alt: string;
  label: string;
  tag: string;
}

export interface ProductLandingBenefitCard {
  img: string;
  badge: string;
  cameraMeta: string;
  title: string;
  desc: string;
}

export interface ProductLandingComparisonRow {
  feature: string;
  ours: string;
  old: string;
}

export interface ProductLandingReview {
  name: string;
  city: string;
  comment: string;
  rating: number;
  pack: string;
  photo: string;
}

export interface ProductLandingFaq {
  q: string;
  a: string;
}

export interface ProductLandingContent {
  brandTitle: string;
  topBarBadge: string;
  topBarText: string;
  heroBadge: string;
  emblemBadge?: {
    text: string;
    icon: string;
  };
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  packLabels: {
    1: { title: string; subtitle: string; tag: string };
    2: { title: string; subtitle: string; tag: string };
    3: { title: string; subtitle: string; tag: string };
  };
  galleryItems: ProductLandingGalleryItem[];
  benefitSectionBadge: string;
  benefitSectionTitle: string;
  benefitSectionSubtitle: string;
  benefitCards: ProductLandingBenefitCard[];
  showcaseBadge: string;
  showcaseTitle: string;
  showcaseSubtitle: string;
  vsCompetitorTitle: string;
  vsOursLabel: string;
  vsOldLabel: string;
  vsComparisons: ProductLandingComparisonRow[];
  specsGrid: Array<{ label: string; value: string }>;
  reviewsBadge: string;
  reviewsTitle: string;
  reviewsRatingLabel: string;
  reviews: ProductLandingReview[];
  faqsBadge: string;
  faqsTitle: string;
  faqs: ProductLandingFaq[];
}

export interface ProductAgentBrain {
  trainedAt: string;
  version: number;
  shortProductSpoken: string;
  productCategoryLabel: string;
  technicalSpecsSpoken: string;
  boxContentsSpoken: string;
  usageSummarySpoken: string;
  powerAndResistanceSpoken: string;
  warrantySpoken: string;
  upsellPack2Enabled: boolean;
  upsellPack2PriceGs: number;
  upsellPack2PitchSpoken: string;
  postConfirmationProductAngles: string[];
  faqQuickAnswers: Array<{
    topic: string;
    keywords: string[];
    answerSpoken: string;
  }>;
}

export interface MetaAdCompetitorItem {
  id: string;
  pageName: string;
  activeDays: number;
  score: number;
  isWinner: boolean;
  headline: string;
  bodyCopy: string;
  ctaLabel: string;
  landingUrl?: string;
  detectedAngle: string;
  detectedOffer: string;
}

export interface ProductMetaTrackingConfig {
  pixelId: string;
  capiAccessToken: string;
  testEventCode?: string;
  capiServerEnabled: boolean;
  advancedMatchingSha256: boolean;
  firstPartyCookiesEnabled: boolean;
  enabledEvents: {
    PageView: boolean;
    ViewContent: boolean;
    CustomizeProduct: boolean;
    AddToCart: boolean;
    InitiateCheckout: boolean;
    AddPaymentInfo: boolean;
    Lead: boolean;
    Purchase: boolean;
    Contact: boolean;
    GalleryInteraction: boolean;
    EngagedVisitor: boolean;
    DeepScroll: boolean;
  };
}

export interface ProductPage {
  id: string;
  nombre: string;
  descripcion: string;
  imagen: string;
  slug: string;
  precioNormal: number;
  precios: Record<number, number>; // 1, 2, 3
  wa: string;
  waNotificacionesVendedor?: string;
  activo: boolean;
  creadoEn: string;
  contextoIA?: string;
  vozAgente?: string;
  vozAgenteNombre?: string;
  agentMode?: AIMode;
  canalIA?: 'audio' | 'texto';
  templateId?: string;
  nicheId?: string;
  subNicheId?: string;
  angleTag?: string;
  parentProductId?: string;
  themeConfig?: ProductThemeConfig;
  physicalTruth?: ProductPhysicalTruth;
  codEconomics?: ProductCodEconomics;
  landingContent?: ProductLandingContent;
  agentBrain?: ProductAgentBrain;
  metaTracking?: ProductMetaTrackingConfig;
  freeShipping?: boolean;
  shippingCostGs?: number;
  waStageCommercialsEnabled?: boolean;
  waStageCommercials?: ProductWaStageCommercialMap;
}

export interface AIAgentSettings {
  nombreAgente: string;
  activo: boolean;
  scriptPrompt: string;
  modoPorDefecto?: AIMode;
}



