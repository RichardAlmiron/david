import type { OrderGpsFuente } from './utils/paraguayGeo';
export type { OrderGpsFuente };

export type OrderStatus = 'reservado' | 'en_camino' | 'entregado_pagado' | 'cancelado';

export type DeliveryStatus =
  | 'pendiente_envio'
  | 'en_transito'
  | 'reprogramado'
  | 'entregado_fisicamente'
  | 'devuelto'
  | 'cancelado';

export type CustomerPaymentStatus =
  | 'pendiente_cobro'
  | 'cobrado_verificado'
  | 'fallido_o_rechazado';

export type CourierSettlementStatus =
  | 'no_aplica'
  | 'pendiente_liquidacion'
  | 'liquidado_en_lote'
  | 'discrepancia';

export interface PaidTouchSnapshot {
  capturedAt: string;
  productSlug?: string;
  landingPath?: string;
  referrer?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  creative_id?: string;
  hypothesis_id?: string;
  angle_id?: string;
  aa_cid?: string;
  wa_token?: string;
}

export interface OrderAttributionPayload {
  visitorId?: string;
  firstTouch?: PaidTouchSnapshot | null;
  lastPaidTouch?: PaidTouchSnapshot | null;
  waToken?: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  referrer?: string;
  landingPath?: string;
  attributionMethod?: string;
}
export type AIMode = 'manual' | 'automatico';
export type WaCommercialStageId =
  | 'stage1_welcome'
  | 'stage2_warning'
  | 'stage3_confirmed';
export type WaCommercialPackKey = 'pack1' | 'pack2' | 'pack3';

export interface WaStageCommercialAsset {
  stageId: WaCommercialStageId;
  packKey: WaCommercialPackKey;
  packQty: number;
  imageUrl: string;
  aiSceneUrl?: string;
  framedPriceGs: number;
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
  gpsFuente?: OrderGpsFuente;
  waCommercialSentStages?: Partial<Record<WaCommercialStageId, boolean>>;
  // Circuito A (Atribución e idempotencia — inmutable post-confirmación del formulario)
  visitorId?: string;
  clientRequestKey?: string;
  confirmedFormAt?: string;
  canonicalConversionEvent?: 'Lead';
  canonicalLeadEventId?: string;
  attributionSnapshot?: OrderAttributionPayload;
  attributedAdId?: string;
  attributedCampaignId?: string;
  attributedAdsetId?: string;
  attributedCreativeId?: string;
  attributedHypothesisId?: string;
  attributedAngleId?: string;
  attributionSourceKind?: string;
  metaCommentOrigin?: MetaCommentOrderOrigin;
  // Circuito B (Logística 3 ejes, costos reales, courier & CAPI Purchase independiente)
  deliveryStatus?: DeliveryStatus;
  customerPaymentStatus?: CustomerPaymentStatus;
  courierSettlementStatus?: CourierSettlementStatus;
  deliveredAt?: string;
  collectedAt?: string;
  settledAt?: string;
  netCashCollectedPyg?: number;
  courierFeePyg?: number;
  courierSettlementId?: string;
  productUnitCostPyg?: number;
  packagingCostPyg?: number;
  returnCostPyg?: number;
  purchaseCapiStatus?: string;
  // Ruta de compra dual (Producto de entrada vs Paquete principal completo) y Evento WhatsApp 10 cupos
  purchasePath?: 'entry_only' | 'principal_bundle';
  purchaseOfferTitle?: string;
  tripwireEventState?: {
    stage:
      | 'pending_choice'
      | 'instant_upgraded'
      | 'waitlist_enrolled'
      | 'silenced_until_end'
      | 'final_dispatched';
    attemptsSent: number;
    enrolledAt?: string;
    lastAttemptAt?: string;
    nextFollowUpAt?: string;
    lastNoticeAt?: string;
    silenceStartedAt?: string;
    eventEndsAt: string;
    slotsTotal: number;
    slotsTaken: number;
    entryProductName: string;
    entryPriceGs: number;
    deliveryFeeGs: number;
    instantUpgradePriceGs: number;
    waitlistPriceGs: number;
    backgroundMusicPreset?: 'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none';
    pollMsgId?: string;
    pollEncKeyBase64?: string;
    pollCreatorJid?: string;
    pollVoterJid?: string;
    pollOptionHashes?: string[];
    selectedOption?: 'option_1_instant' | 'option_2_waitlist';
  };
}

export type MetaCommentChannel =
  | 'facebook_comment'
  | 'messenger_dm'
  | 'instagram_comment'
  | 'instagram_dm'
  | 'express_form';

export interface MetaCommentOrderOrigin {
  source: 'meta_comment_ai';
  channel: MetaCommentChannel;
  adId?: string;
  adName?: string;
  adIndex?: number;
  campaignId?: string;
  campaignName?: string;
  postId?: string;
  commentId?: string;
  threadId?: string;
  commentText?: string;
  authorName?: string;
  capturedAt?: string;
}

export interface MetaCommentChatMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  channel: MetaCommentChannel;
  text: string;
  createdAt: string;
  by?: 'customer' | 'ai_public' | 'ai_dm' | 'admin' | 'whatsapp';
  sentToMeta?: boolean;
  metaMessageId?: string;
  expressUrl?: string;
}

export interface MetaCommentThreadRecord {
  id: string;
  postId: string;
  commentId: string;
  parentCommentId?: string;
  platform: 'facebook' | 'instagram';
  pageId: string;
  adId?: string;
  adName?: string;
  adIndex?: number;
  campaignId?: string;
  campaignName?: string;
  productId?: string;
  productSlug?: string;
  productName?: string;
  authorId?: string;
  authorName: string;
  psid?: string;
  commentText: string;
  detectedPhones: string[];
  hiddenFromPublic: boolean;
  publicReplyText?: string;
  publicReplyId?: string;
  publicRepliedAt?: string;
  dmSentAt?: string;
  expressFormUrl?: string;
  whatsappNotifiedAt?: string;
  status: 'new' | 'public_replied' | 'dm_active' | 'form_sent' | 'order_closed' | 'ignored';
  intent?: 'price_inquiry' | 'buy_now' | 'phone_drop' | 'shipping_question' | 'objection' | 'other';
  angleUsed?: string;
  adSetId?: string;
  adSetName?: string;
  adHeadline?: string;
  adCopy?: string;
  adThumbnailUrl?: string;
  messages: MetaCommentChatMessage[];
  orderId?: string;
  orderTotalPyg?: number;
  isSimulation?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MetaCommentAdStats {
  adKey: string;
  adId: string;
  adName: string;
  adIndex?: number;
  adSetId?: string;
  adSetName?: string;
  campaignId?: string;
  campaignName?: string;
  postId?: string;
  adCopy?: string;
  adThumbnailUrl?: string;
  adStatus?: string;
  productId?: string;
  productSlug?: string;
  productName?: string;
  commentsCount: number;
  publicRepliesCount: number;
  dmSentCount: number;
  activeChatsCount: number;
  phonesCapturedCount: number;
  closedOrdersCount: number;
  revenuePyg: number;
  conversionRatePct: number;
  lastActivityAt: string;
  isWinner?: boolean;
}

export interface MetaActiveAdSnapshot {
  adId: string;
  adName: string;
  adIndex?: number;
  adStatus?: string;
  effectiveStatus?: string;
  adSetId?: string;
  adSetName?: string;
  campaignId?: string;
  campaignName?: string;
  postId?: string;
  adCopy?: string;
  adHeadline?: string;
  adThumbnailUrl?: string;
  productId?: string;
  productSlug?: string;
  productName?: string;
  updatedAt: string;
}

export interface MetaCommentAutomationConfig {
  enabled: boolean;
  autoPublicReply: boolean;
  autoPrivateDm: boolean;
  publicOnlyMode?: boolean;
  autoPollingSeconds?: number;
  autoHidePhoneComments: boolean;
  autoWhatsappOnPhone: boolean;
  defaultProductId: string;
  defaultProductSlug: string;
  publicBaseUrl: string;
  campaignProductMap: Record<string, { productId: string; productSlug: string; productName: string }>;
  adProductMap: Record<string, { productId: string; productSlug: string; productName: string }>;
  postAdMap: Record<
    string,
    {
      postId: string;
      adId: string;
      adName: string;
      adIndex?: number;
      adSetId?: string;
      adSetName?: string;
      campaignId?: string;
      campaignName?: string;
      adCopy?: string;
      adHeadline?: string;
      adThumbnailUrl?: string;
      adStatus?: string;
      productId?: string;
      productSlug?: string;
      productName?: string;
    }
  >;
  activeAdsSnapshot?: MetaActiveAdSnapshot[];
  webhookVerifyToken: string;
  lastSyncAt?: string;
  lastAutoPollAt?: string;
  lastAutoPollError?: string;
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

export type ViewType = 'store' | 'admin' | 'reparto' | 'promoter' | 'app-android' | 'app-iphone';

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
    OrderReservedCOD?: boolean;
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
  winnerAngle?: string;
  tripwireConfig?: ProductTripwireOfferConfig;
  visualLanding?: ProductVisualLandingConfig;
}

export interface ProductTripwireOfferConfig {
  enabled: boolean;
  entryProductName: string;
  entryProductDescription: string;
  entryPriceGs: number;
  entryNormalPriceGs?: number;
  entryProductPriceGs?: number;
  deliveryFeeGs: number;
  entryDeliveryFeeGs?: number;
  entryProductImage?: string;
  entryImageUrl?: string;
  entrySourceUrl?: string;
  sourceUrl?: string;
  eventDurationHours: number;
  slotsTotal: number;
  eventSlotsCount?: number;
  instantDiscountPercent: number;
  backgroundMusicPreset?: 'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none';
  entryOnlyClarification?: string;
  principalBundleClarification?: string;
}

export interface ProductVisualLandingSheet {
  id: string;
  title: string;
  subtitle?: string;
  caption?: string;
  imageUrl: string;
  aspectRatio?: '3:4' | '9:16' | '1:1' | '4:5';
  placement?: 'hero_sheet' | 'comparison_sheet' | 'proof_sheet';
  role?: 'hero_presentation' | 'comparison_need' | 'social_trust_specs';
  promptUsed?: string;
}

export interface ProductVisualLandingConfig {
  enabled: boolean;
  mode?: 'sober_graphic_2sheet' | 'sober_graphic_3sheet';
  generatorModel?: string;
  topNoticeText?: string;
  sobrietyHeadline?: string;
  subheadline?: string;
  reversePsychologyHook?: string;
  reversePsychologyNote?: string;
  winnerAngleHeadline?: string;
  winnerAngleDescription?: string;
  entryCtaLabel?: string;
  entryButtonLabel?: string;
  entryDisclaimer?: string;
  principalCtaLabel?: string;
  bundleButtonLabel?: string;
  bundleDisclaimer?: string;
  sheets: ProductVisualLandingSheet[];
  generatedAt?: string;
}

export interface AIAgentSettings {
  nombreAgente: string;
  activo: boolean;
  scriptPrompt: string;
  modoPorDefecto?: AIMode;
}

// ============================================================================
// AUTO ADS v2 — INTERFACES COMPARTIDAS CIRCUITO A Y CIRCUITO B
// ============================================================================

export type CompetitorSourceTier =
  | 'verified_meta_ad_library'
  | 'manual_operator_evidence'
  | 'llm_strategic_inference';

export interface CompetitorFindingV2 {
  id: string;
  pageName: string;
  headline: string;
  bodyCopy: string;
  ctaLabel: string;
  landingUrl?: string;
  detectedAngle: string;
  detectedOffer: string;
  sourceTier: CompetitorSourceTier;
  sourceVerified: boolean;
  evidenceNote: string;
  activeDays?: number;
  score?: number;
  isWinner?: boolean;
}

export interface PsychologicalProfileV2 {
  productSlug: string;
  awarenessLevel: 'unaware' | 'problem_aware' | 'solution_aware' | 'product_aware' | 'most_aware';
  marketSophistication: 1 | 2 | 3 | 4 | 5;
  visceralPains: string[];
  deepDesires: string[];
  cognitiveBiasesAndTriggers: string[];
  paraguayCodObjections: Array<{
    objection: string;
    reframe: string;
  }>;
  uniqueMechanismProblem: string;
  uniqueMechanismSolution: string;
  winningAnglesSummary: string[];
  saturatedPatternsToAvoid: string[];
}

export interface AutoAdsHypothesisV2 {
  id: string;
  hypothesisCode: string;
  angleId: string;
  angleName: string;
  awarenessLevel: string;
  marketSophistication: number;
  targetAvatar: string;
  corePain: string;
  deepDesire: string;
  objectionTargeted: string;
  uniqueMechanismProblem: string;
  uniqueMechanismSolution: string;
  bigIdea: string;
  promise: string;
  proofType: string;
  hookFormula: string;
  testVariable: string;
  copyFramework: string;
  visualArchetype: string;
  primaryTextDraft: string;
  headlineDraft: string;
  ctaDraft: string;
  aiImagePrompt: string;
  videoScriptPrompt: string;
  strategicRationale: string;
}

export interface CircuitAMetricRow {
  entityType: 'campaign' | 'adset' | 'ad' | 'creative' | 'hypothesis' | 'angle' | 'hook' | 'format';
  entityId: string;
  label: string;
  angleId?: string;
  hypothesisId?: string;
  impressions: number;
  clicks: number;
  inlineLinkClicks: number;
  spendUsd: number;
  spendPyg: number;
  formsCount: number;
  formCvrPct: number;
  cpfUsd: number | null;
  cpfPyg: number | null;
  verdict: 'winner' | 'promising' | 'loser' | 'insufficient_data';
  maturityProgressPct: number;
  confidenceScore: number;
  recommendedAction: string;
}

export interface ProductCostProfile {
  id: string;
  productSlug: string;
  effectiveFrom: string;
  unitProductCostPyg: number;
  packagingCostPyg: number;
  defaultCourierDeliveryFeePyg: number;
  defaultCourierReturnFeePyg: number;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export interface FxRatePeriod {
  id: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  usdToPygRate: number;
  source: 'manual_admin' | 'meta_invoice_reconciliation';
  metaInvoiceReference?: string;
  metaInvoiceAmountUsd?: number;
  metaInvoiceAmountPyg?: number;
  createdBy?: string;
  createdAt: string;
}

export interface CourierSettlementRecord {
  id: string;
  courierName: string;
  settlementDate: string;
  referenceCode?: string;
  totalGrossCollectedPyg: number;
  totalCourierFeesPyg: number;
  totalNetTransferredPyg: number;
  ordersCount: number;
  matchedOrderIds: string[];
  unmatchedRows: Array<{
    reservaId?: string;
    phone?: string;
    amountPyg?: number;
    feePyg?: number;
    reason: string;
  }>;
  rawSourceType: 'manual' | 'csv_import';
  createdBy?: string;
  createdAt: string;
}

export interface ErpProfitabilitySummary {
  auditStatus: 'auditado_completo' | 'faltan_costos_reales' | 'pendiente_liquidacion_courier';
  auditWarnings: string[];
  totalOrdersCount: number;
  deliveredAndCollectedCount: number;
  pendingCourierCount: number;
  returnedOrCancelledCount: number;
  grossCollectedPyg: number;
  settledCashPyg: number;
  productCogsPyg: number | null;
  packagingTotalPyg: number;
  courierFeesTotalPyg: number;
  returnFeesTotalPyg: number;
  adSpendUsd: number;
  adSpendPyg: number;
  fxRateUsed: number;
  fxSource: string;
  auditedNetProfitPyg: number | null;
  purchaseCapiSentCount: number;
  purchaseCapiSkippedWindowCount: number;
  purchaseCapiPendingCount: number;
}

export interface AutoAdsFeatureFlags {
  AUTOADS_STRATEGY_V2_ENABLED: boolean;
  AUTOADS_CANONICAL_LEAD_ONLY: boolean;
  AUTOADS_EMIT_COD_CUSTOM_EVENT: boolean;
  AUTOADS_PREFLIGHT_STRICT_CURRENCY: boolean;
  AUTOADS_PURCHASE_CAPI_INDEPENDENT_ENABLED: boolean;
}

export interface MetaPreflightCheckItem {
  code: string;
  level: 'ok' | 'warning' | 'error';
  message: string;
  detail?: string;
}

export interface MetaPreflightReport {
  readyToPublish: boolean;
  publisher: 'meta_direct' | 'pipeboard';
  adAccountId: string;
  accountCurrency: string;
  campaignObjective: 'OUTCOME_LEADS' | 'OUTCOME_SALES';
  optimizationEvent: 'LEAD' | 'PURCHASE';
  pixelId: string;
  pixelLeadEvents7d: number | null;
  pixelHasSufficientLeadHistory: boolean;
  dailyBudgetRaw: number;
  dailyBudgetAccountMinorUnits: number;
  dailyBudgetDisplay: string;
  urlTagsSupported: boolean;
  videoUploadSupported: boolean;
  trackingLinkMode: 'url_tags' | 'link_query_params';
  checks: MetaPreflightCheckItem[];
}



