import React, { useState } from 'react';
import {
  Star,
  ShieldCheck,
  Truck,
  Clock,
  CheckCircle2,
  Sparkles,
  Flame,
  Eye,
  Camera,
  Play,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Zap,
  Package
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';
import { ProductDemoVideo } from './ProductDemoVideo';
import { trackMetaFullFunnelEvent } from '../utils/metaPixelEngine';

const GALLERY_ITEMS = [
  {
    src: '/src/assets/images/noelux_fachada_jardin_1793968638764.jpg',
    alt: 'Proyector Noelux clavado en el césped iluminando la fachada completa de una casa con figuras navideñas',
    label: 'Fachada Completa Iluminada',
    tag: 'Foto Real #1'
  },
  {
    src: '/assets/real/galeria-2.jpg',
    alt: 'Macro detalle del cabezal óptico Noelux con 19 lentes nido de abeja',
    label: 'Cabezal Óptico de 19 Lentes',
    tag: 'Foto Real #2'
  },
  {
    src: '/assets/real/galeria-3.jpg',
    alt: 'Proyección óptica giratoria en tiempo real sobre la pared del living',
    label: 'Proyección Real en Pared',
    tag: 'Foto Real #3'
  },
  {
    src: '/src/assets/images/noelux_familia_fachada_1793968640573.jpg',
    alt: 'Familia en el jardín junto al proyector Noelux admirando las figuras proyectadas en la pared de su casa',
    label: 'Familia Disfrutando en Jardín',
    tag: 'Foto Real #4'
  },
  {
    src: '/src/assets/images/noelux_mano_estaca_cesped_1793968644514.jpg',
    alt: 'Manos instalando el proyector compacto Noelux con su estaca en el césped del jardín',
    label: 'Instalación con Estaca en Pasto',
    tag: 'Foto Real #5'
  },
  {
    src: '/src/assets/images/noelux_porche_balcon_base_1793968643055.jpg',
    alt: 'Proyector Noelux apoyado sobre su soporte en U en el piso del porche proyectando figuras en la pared de entrada',
    label: 'Uso en Porche, Piso o Balcón',
    tag: 'Foto Real #6'
  },
  {
    src: '/src/assets/images/noelux_living_interior_pared_1793968646701.jpg',
    alt: 'Proyector Noelux sobre mesa proyectando figuras navideñas a color en la pared del living',
    label: 'Proyección en Living Interior',
    tag: 'Foto Real #7'
  },
  {
    src: '/assets/real/galeria-8.jpg',
    alt: 'Cuerpo cilíndrico sobre soporte basculante con medidas exactas 11x12 cm',
    label: 'Medidas Exactas (11×12 cm)',
    tag: 'Foto Real #8'
  }
];

const BENEFIT_CARDS = [
  {
    img: '/src/assets/images/noelux_fachada_jardin_1793968638764.jpg',
    badge: 'Cobertura Real 70 m²',
    cameraMeta: 'Proyector en jardín · Fachada completa',
    title: 'Ilumina todo el frente de tu casa con 1 solo equipo',
    desc: 'Colocado a 5 metros, su cabezal de 19 lentes cubre hasta 70 m² con figuras navideñas gigantes y nítidas.'
  },
  {
    img: '/src/assets/images/noelux_mano_estaca_cesped_1793968644514.jpg',
    badge: 'Listo en 90 Segundos',
    cameraMeta: 'Estaca en pasto o base en piso',
    title: 'Apoyás o clavás en el pasto, enchufás a 220V y listo',
    desc: 'Pesa solo 300g. Lo ponés en tu jardín, balcón o patio y tu casa queda decorada al instante sin esfuerzo.'
  },
  {
    img: '/src/assets/images/noelux_lluvia_ip65_jardin_1793968651758.jpg',
    badge: 'Blindaje Exterior IP65',
    cameraMeta: 'Proyectando bajo lluvia de verano',
    title: 'Queda afuera bajo lluvia intensa sin apagarse',
    desc: 'Sellado hermético de silicona industrial que bloquea el agua y el polvo. Funciona toda la noche sin calentar.'
  },
  {
    img: '/src/assets/images/noelux_familia_fachada_1793968640573.jpg',
    badge: 'Magia Familiar en Vivo',
    cameraMeta: '12 diseños navideños en movimiento',
    title: 'La emoción de toda tu familia al ver la casa brillar',
    desc: 'Tus hijos y vecinos van a quedar encantados viendo girar a Papá Noel, renos, árboles y copos de nieve.'
  }
];

export const HeroSection: React.FC = () => {
  const { config, selectedPack, setSelectedPack, currentProductPage, openOrderFormFullscreen } = useStore();
  const [activeImage, setActiveImage] = useState(0);
  const [showLiveVideo, setShowLiveVideo] = useState(false);

  const customLanding = currentProductPage?.landingContent;
  const customTheme = currentProductPage?.themeConfig;
  const customTruth = currentProductPage?.physicalTruth;

  const galleryItems = customLanding?.galleryItems?.length ? customLanding.galleryItems : GALLERY_ITEMS;
  const benefitCards = customLanding?.benefitCards?.length ? customLanding.benefitCards : BENEFIT_CARDS;
  const primaryBg = customTheme?.primaryBg || 'bg-[#0b3d2e]';
  const headerGradient = customTheme?.headerBg || 'from-[#041a12] via-[#0b3d2e] to-[#062319]';
  const ctaGradient = customTheme?.ctaGradient || 'from-[#1ea856] via-[#22c55e] to-[#158a44]';

  // Differentiated Archetype Classes (100% Unique Visual Identity)
  const buttonRadius =
    customTheme?.buttonShape === 'rounded-none'
      ? 'rounded-none'
      : customTheme?.buttonShape === 'rounded-lg'
      ? 'rounded-lg'
      : customTheme?.buttonShape === 'rounded-full'
      ? 'rounded-full'
      : 'rounded-3xl';

  const cardRadius =
    customTheme?.buttonShape === 'rounded-none'
      ? 'rounded-none'
      : customTheme?.buttonShape === 'rounded-lg'
      ? 'rounded-xl'
      : customTheme?.buttonShape === 'rounded-full'
      ? 'rounded-3xl'
      : 'rounded-3xl';

  const fontHeading =
    customTheme?.typographyStyle === 'serif-editorial'
      ? 'font-serif tracking-normal'
      : customTheme?.typographyStyle === 'mono-industrial'
      ? 'font-mono uppercase tracking-tight'
      : customTheme?.typographyStyle === 'athletic-bold'
      ? 'font-black uppercase italic tracking-tighter'
      : 'font-black tracking-tight';

  const pricePack1 = currentProductPage?.precios?.[1] || config.lote[1] || 189000;
  const pricePack2 = currentProductPage?.precios?.[2] || config.lote[2] || 358000;
  const pricePack3 = currentProductPage?.precios?.[3] || config.lote[3] || 507000;
  const packPrices: Record<number, number> = { 1: pricePack1, 2: pricePack2, 3: pricePack3 };

  const effectivePack = selectedPack > 0 ? selectedPack : 1;
  const currentPrice = packPrices[effectivePack] || pricePack1;
  const normalUnit = currentProductPage?.precioNormal || config.normal || Math.round(pricePack1 * 1.32);
  const normalTotal = normalUnit * effectivePack;
  const savings = Math.max(20000, normalTotal - currentPrice);

  const handleSelectPackWithTracking = (packNum: number) => {
    setSelectedPack(packNum);
    trackMetaFullFunnelEvent({
      eventName: 'CustomizeProduct',
      product: currentProductPage,
      globalPixelId: config.pixelId,
      packQuantity: packNum,
      valueGs: packPrices[packNum] || pricePack1
    });
  };

  const scrollToOrder = () => {
    trackMetaFullFunnelEvent({
      eventName: 'AddToCart',
      product: currentProductPage,
      globalPixelId: config.pixelId,
      packQuantity: effectivePack,
      valueGs: currentPrice
    });
    openOrderFormFullscreen();
  };

  const handlePrevImage = () => {
    setShowLiveVideo(false);
    const nextIdx = activeImage === 0 ? galleryItems.length - 1 : activeImage - 1;
    setActiveImage(nextIdx);
    trackMetaFullFunnelEvent({
      eventName: 'GalleryInteraction',
      product: currentProductPage,
      globalPixelId: config.pixelId,
      extraCustomData: { scene_index: nextIdx + 1 }
    });
  };

  const handleNextImage = () => {
    setShowLiveVideo(false);
    const nextIdx = activeImage === galleryItems.length - 1 ? 0 : activeImage + 1;
    setActiveImage(nextIdx);
    trackMetaFullFunnelEvent({
      eventName: 'GalleryInteraction',
      product: currentProductPage,
      globalPixelId: config.pixelId,
      extraCustomData: { scene_index: nextIdx + 1 }
    });
  };

  const activeItem = galleryItems[activeImage] || galleryItems[0];

  const boxBullets = customTruth?.boxContents
    ? customTruth.boxContents
        .split(/[,+·]/)
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 4)
    : [
        'Proyector LED HD (19 lentes + 12 diseños)',
        'Estaca de 20 cm para clavar en césped',
        'Base de apoyo para piso, balcón o pared',
        'Cable sellado de 5 metros + fuente 220V'
      ];

  const whatsInBoxCard = (
    <div className="bg-white rounded-3xl border-2 border-[#dfdad0] p-5 sm:p-6 shadow-md">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-[#0b3d2e] flex items-center gap-2">
          <Package className="w-5 h-5 text-[#1ea856]" />
          <span>
            {customLanding
              ? `¿Qué trae tu caja de ${currentProductPage?.nombre || 'tu pedido'}?`
              : '¿Qué trae tu caja Noelux™?'}
          </span>
        </h3>
        <span className="text-xs sm:text-sm bg-[#e5f6ec] text-[#0a7a4a] border border-[#b7eb8f] px-3 py-1 rounded-full font-black">
          {customTruth?.powerSourceLabel ? customTruth.powerSourceLabel.slice(0, 26) : 'Kit Completo 220V'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {boxBullets.map((itemText, idx) => (
          <div key={idx} className="flex items-center gap-3 bg-[#f6f4ee] p-3.5 rounded-2xl border border-[#e2ddd2]">
            <CheckCircle2 className="w-6 h-6 text-[#1ea856] shrink-0" />
            <span className="text-sm sm:text-base font-extrabold text-stone-900 leading-snug">
              {itemText}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section id="galeria" className="app-container pt-3 sm:pt-6 pb-8 sm:pb-12">
      {/* Main 2-Column Native App Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-start">

        {/* Left Column: Full-Impact App Media Card */}
        <div className="lg:col-span-6 lg:sticky lg:top-24 space-y-4">
          <div className={`bg-white ${cardRadius} border-2 border-[#dfdad0] p-3 sm:p-4 shadow-[0_14px_34px_rgba(6,35,25,0.08)]`}>
            
            {/* App Media Top Pill Bar */}
            <div className="flex items-center justify-between gap-2 mb-3 px-1">
              <div className="inline-flex items-center gap-1.5 bg-[#e5f6ec] border border-[#86efac] px-3 py-1 rounded-full text-xs sm:text-sm font-black text-[#064e3b]">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>4.9 ★ (+1.420 clientes)</span>
              </div>

              {!customLanding && (
                <button
                  type="button"
                  onClick={() => setShowLiveVideo(v => !v)}
                  className={`${primaryBg} hover:bg-[#062319] text-[#ffd778] border border-[#e8b23a] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer`}
                >
                  {showLiveVideo ? (
                    <>
                      <ImageIcon className="w-4 h-4" />
                      <span>Ver 8 Fotos</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-[#ffd778]" />
                      <span>Ver Video en Vivo</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Main 1:1 Square App Viewport */}
            <div className="relative rounded-2xl overflow-hidden bg-[#051a13] aspect-square w-full shadow-inner">
              {showLiveVideo && !customLanding ? (
                <ProductDemoVideo />
              ) : (
                <>
                  <img
                    src={activeItem.src}
                    alt={activeItem.alt}
                    className="w-full h-full object-cover bg-[#051a13] transition-all duration-300"
                  />

                  {/* Top-Left Real Photo Tag */}
                  <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5 text-xs sm:text-sm font-black shadow-lg">
                    <Camera className="w-4 h-4 text-[#ffd778]" />
                    <span>{activeItem.tag}</span>
                  </div>

                  {/* Large Touch-Friendly Left/Right Carousel Buttons */}
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    aria-label="Foto anterior"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/65 hover:bg-black/85 text-white border-2 border-white/30 backdrop-blur-md flex items-center justify-center shadow-xl active:scale-90 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    aria-label="Siguiente foto"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/65 hover:bg-black/85 text-white border-2 border-white/30 backdrop-blur-md flex items-center justify-center shadow-xl active:scale-90 transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>

                  {/* Bottom App Caption Overlay */}
                  <div className="absolute bottom-3 left-3 right-3 bg-black/80 backdrop-blur-md text-white px-3.5 py-2.5 rounded-2xl border border-white/20 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-black text-sm sm:text-base truncate">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] shrink-0" />
                      <span className="truncate">{activeItem.label}</span>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-[#062319] bg-[#ffd778] px-2.5 py-0.5 rounded-lg shrink-0">
                      {activeImage + 1} / {galleryItems.length}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Large Thumb-Friendly Swipeable App Thumbnail Strip */}
            <div className="flex sm:grid sm:grid-cols-8 gap-2.5 mt-3.5 overflow-x-auto no-scrollbar snap-x py-1">
              {galleryItems.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setShowLiveVideo(false);
                    setActiveImage(idx);
                    trackMetaFullFunnelEvent({
                      eventName: 'GalleryInteraction',
                      product: currentProductPage,
                      globalPixelId: config.pixelId,
                      extraCustomData: { scene_index: idx + 1 }
                    });
                  }}
                  aria-label={`Ver ${item.label}`}
                  className={`relative rounded-2xl overflow-hidden aspect-square w-18 sm:w-auto shrink-0 snap-start border-3 transition-all cursor-pointer bg-[#051a13] ${
                    !showLiveVideo && activeImage === idx
                      ? 'border-[#1ea856] ring-2 ring-[#0b3d2e]/30 scale-[1.04]'
                      : 'border-stone-200 opacity-80 hover:opacity-100'
                  }`}
                >
                  <img
                    src={item.src}
                    alt={item.alt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute bottom-1 right-1 bg-black/85 text-white text-xs font-black px-1.5 py-0.5 rounded-md">
                    {idx + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Desktop What's in the Box Card */}
          <div className="hidden lg:block">{whatsInBoxCard}</div>
        </div>

        {/* Right Column: High-Impact Mobile App Product Sheet */}
        <div className="lg:col-span-6 space-y-5">

          {/* Main App Product Card */}
          <div className={`bg-white ${cardRadius} border-2 border-[#dfdad0] p-5 sm:p-7 shadow-[0_14px_34px_rgba(6,35,25,0.08)] space-y-5`}>
            
            {/* App Top Guarantee Pill */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 ${primaryBg} text-[#ffd778] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-black uppercase tracking-wide`}>
                <Zap className="w-4 h-4 fill-[#ffd778]" /> {customLanding?.heroBadge || 'Instalación en 90 Segundos'}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-[#e5f6ec] text-[#0a7a4a] border border-[#86efac] px-3 py-1.5 rounded-full text-xs sm:text-sm font-black">
                <Truck className="w-4 h-4" />{' '}
                {currentProductPage?.freeShipping === false ? 'Entrega Rápida Hoy' : 'Envío Gratis Hoy'}
              </span>
            </div>

            {/* Big, Bold, Ultra-Legible App Headline */}
            <h1 className={`text-2xl sm:text-3xl xl:text-4xl ${fontHeading} text-[#062319] leading-[1.15]`}>
              {customLanding ? `${customLanding.heroTitle}: ` : `Proyector Navideño ${config.marca}™ HD: `}
              <span className="text-[#c0392b] underline decoration-[#e8b23a] decoration-4">
                {customLanding?.heroHighlight || 'Decorá toda tu casa sin escaleras ni cables'}
              </span>
            </h1>

            {/* Large, Easy-to-Read App Lead Description */}
            <p className="text-stone-700 text-base sm:text-lg font-semibold leading-relaxed">
              {customLanding ? (
                customLanding.heroSubtitle
              ) : (
                <>
                  Clavás la estaca en el pasto o apoyás la base en el piso, enchufás a 220V y proyectás{' '}
                  <strong className="text-[#062319] font-black">12 diseños navideños en movimiento</strong> resistentes a lluvia intensa (IP65).
                </>
              )}
            </p>

            {/* Native Mobile App "Oferta Relámpago" Flash Deal Card */}
            <div className={`bg-gradient-to-br ${headerGradient} text-white rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 border-2 border-[#e8b23a]`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-[#e8b23a] text-[#062319] text-xs sm:text-sm font-black px-3 py-1 rounded-full uppercase">
                  <Flame className="w-4 h-4 fill-[#062319]" /> Oferta Contra Entrega
                </span>
                <span className="bg-[#1ea856] text-white text-sm sm:text-base font-black px-3.5 py-1 rounded-xl shadow-sm">
                  Ahorrás {formatGs(savings)}
                </span>
              </div>

              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl sm:text-4xl xl:text-5xl font-black text-[#ffd778] tracking-tight leading-none">
                  {formatGs(currentPrice)}
                </span>
                <span className="text-base sm:text-xl text-stone-300 line-through font-bold">
                  {formatGs(normalTotal)}
                </span>
              </div>

              {/* Visual Mobile-App Stock Progress Bar */}
              <div className="space-y-2 pt-2 border-t border-white/15">
                <div className="flex items-center justify-between text-sm sm:text-base font-extrabold text-white">
                  <span className="flex items-center gap-1.5 text-[#ffd778]">
                    🔥 ¡Quedan solo {config.stock} unidades en stock!
                  </span>
                  <span className="text-emerald-300 flex items-center gap-1 text-xs sm:text-sm">
                    <Eye className="w-4 h-4" /> 28 viendo
                  </span>
                </div>
                <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/15">
                  <div className="h-full w-[82%] bg-gradient-to-r from-[#ffd778] via-[#f59e0b] to-[#ef4444] rounded-full" />
                </div>
              </div>
            </div>

            {/* High-Impact Mobile App Pack Cards (1X, 2X, 3X) */}
            <div className="space-y-3.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-base sm:text-lg font-black uppercase tracking-tight text-[#062319]">
                  👇 Tocá para elegir tu Pack:
                </label>
                <span className="text-xs sm:text-sm font-black text-[#0a7a4a]">
                  {currentProductPage?.freeShipping === false ? 'Entrega Rápida en Puerta' : 'Envío 100% Gratis'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {/* Pack 1 Card */}
                <button
                  type="button"
                  onClick={() => handleSelectPackWithTracking(1)}
                  className={`w-full text-left p-4 sm:p-5 rounded-3xl border-3 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    effectivePack === 1
                      ? 'border-[#0b3d2e] bg-[#eefaf3] shadow-[0_8px_20px_rgba(11,61,46,0.12)]'
                      : 'border-[#dcd6c8] bg-[#faf8f4] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div
                      className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 font-black border-2 ${
                        effectivePack === 1
                          ? `${primaryBg} text-[#ffd778] border-[#e8b23a]`
                          : 'bg-white text-stone-800 border-stone-300'
                      }`}
                    >
                      <span className="text-lg sm:text-xl leading-none">1X</span>
                      <span className="text-[10px] uppercase mt-0.5">Unid.</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-stone-900 text-base sm:text-xl leading-snug">
                        {customLanding?.packLabels?.[1]?.title || '1 Unidad · Pack Hogar'}
                      </div>
                      <div className="text-sm sm:text-base font-bold text-stone-600 mt-0.5">
                        {customLanding?.packLabels?.[1]?.subtitle || 'Cubre hasta 70 m² de fachada'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-[#0b3d2e] text-lg sm:text-2xl leading-none">
                      {formatGs(pricePack1)}
                    </div>
                    <div className="text-xs sm:text-sm text-stone-400 line-through font-bold mt-1">
                      {formatGs(normalUnit)}
                    </div>
                    <span
                      className={`inline-block mt-1.5 text-xs sm:text-sm font-black px-3 py-1 rounded-xl ${
                        effectivePack === 1
                          ? 'bg-[#1ea856] text-white shadow-xs'
                          : 'bg-stone-200 text-stone-800'
                      }`}
                    >
                      {effectivePack === 1 ? '✓ ELEGIDO' : 'ELEGIR'}
                    </span>
                  </div>
                </button>

                {/* Pack 2 Card - Most Popular */}
                <button
                  type="button"
                  onClick={() => handleSelectPackWithTracking(2)}
                  className={`w-full text-left p-4 sm:p-5 rounded-3xl border-3 transition-all cursor-pointer flex items-center justify-between gap-3 relative mt-2 ${
                    effectivePack === 2
                      ? 'border-[#0b3d2e] bg-[#eefaf3] shadow-[0_8px_20px_rgba(11,61,46,0.12)]'
                      : 'border-[#e8b23a] bg-[#faf8f4] hover:bg-white'
                  }`}
                >
                  <span className="absolute -top-3.5 left-4 bg-gradient-to-r from-[#e8b23a] to-[#f59e0b] text-[#062319] text-xs sm:text-sm font-black px-3.5 py-1 rounded-full uppercase tracking-wide shadow-md border border-[#062319]/15">
                    {customLanding?.packLabels?.[2]?.tag || '★ MÁS ELEGIDO · 2º AL 50% OFF'}
                  </span>
                  <div className="flex items-center gap-3.5 min-w-0 flex-1 pt-1.5">
                    <div
                      className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 font-black border-2 ${
                        effectivePack === 2
                          ? `${primaryBg} text-[#ffd778] border-[#e8b23a]`
                          : 'bg-[#fff8e6] text-[#062319] border-[#e8b23a]'
                      }`}
                    >
                      <span className="text-lg sm:text-xl leading-none">2X</span>
                      <span className="text-[10px] uppercase mt-0.5">Pack</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-stone-900 text-base sm:text-xl leading-snug">
                        {customLanding?.packLabels?.[2]?.title || '2 Unidades · Pack Familia'}
                      </div>
                      <div className="text-sm sm:text-base text-[#0a7a4a] font-black mt-0.5">
                        {customLanding?.packLabels?.[2]?.subtitle || `${formatGs(Math.round(pricePack2 / 2))} c/u · Frente + Patio`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pt-1.5">
                    <div className="font-black text-[#0b3d2e] text-lg sm:text-2xl leading-none">
                      {formatGs(pricePack2)}
                    </div>
                    <div className="text-xs sm:text-sm text-stone-400 line-through font-bold mt-1">
                      {formatGs(normalUnit * 2)}
                    </div>
                    <span
                      className={`inline-block mt-1.5 text-xs sm:text-sm font-black px-3 py-1 rounded-xl ${
                        effectivePack === 2
                          ? 'bg-[#1ea856] text-white shadow-xs'
                          : 'bg-stone-200 text-stone-800'
                      }`}
                    >
                      {effectivePack === 2 ? '✓ ELEGIDO' : 'ELEGIR'}
                    </span>
                  </div>
                </button>

                {/* Pack 3 Card - Maximum Savings */}
                <button
                  type="button"
                  onClick={() => handleSelectPackWithTracking(3)}
                  className={`w-full text-left p-4 sm:p-5 rounded-3xl border-3 transition-all cursor-pointer flex items-center justify-between gap-3 relative mt-2 ${
                    effectivePack === 3
                      ? 'border-[#0b3d2e] bg-[#eefaf3] shadow-[0_8px_20px_rgba(11,61,46,0.12)]'
                      : 'border-[#dcd6c8] bg-[#faf8f4] hover:bg-white'
                  }`}
                >
                  <span className={`absolute -top-3.5 left-4 ${primaryBg} text-[#ffd778] text-xs sm:text-sm font-black px-3.5 py-1 rounded-full uppercase tracking-wide shadow-md border border-[#e8b23a]/50`}>
                    {customLanding?.packLabels?.[3]?.tag || '🎁 MÁXIMO AHORRO FAMILIAR'}
                  </span>
                  <div className="flex items-center gap-3.5 min-w-0 flex-1 pt-1.5">
                    <div
                      className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 font-black border-2 ${
                        effectivePack === 3
                          ? `${primaryBg} text-[#ffd778] border-[#e8b23a]`
                          : 'bg-white text-stone-800 border-stone-300'
                      }`}
                    >
                      <span className="text-lg sm:text-xl leading-none">3X</span>
                      <span className="text-[10px] uppercase mt-0.5">Pack</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-stone-900 text-base sm:text-xl leading-snug">
                        {customLanding?.packLabels?.[3]?.title || '3 Unidades · Pack Regalo'}
                      </div>
                      <div className="text-sm sm:text-base text-[#0a7a4a] font-black mt-0.5">
                        {formatGs(Math.round(pricePack3 / 3))} c/u · Ahorrás {formatGs(Math.max(30000, normalUnit * 3 - pricePack3))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pt-1.5">
                    <div className="font-black text-[#0b3d2e] text-lg sm:text-2xl leading-none">
                      {formatGs(pricePack3)}
                    </div>
                    <div className="text-xs sm:text-sm text-stone-400 line-through font-bold mt-1">
                      {formatGs(normalUnit * 3)}
                    </div>
                    <span
                      className={`inline-block mt-1.5 text-xs sm:text-sm font-black px-3 py-1 rounded-xl ${
                        effectivePack === 3
                          ? 'bg-[#1ea856] text-white shadow-xs'
                          : 'bg-stone-200 text-stone-800'
                      }`}
                    >
                      {effectivePack === 3 ? '✓ ELEGIDO' : 'ELEGIR'}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Giant Primary Mobile-App Call To Action Button */}
            <div className="pt-2">
              <button
                onClick={scrollToOrder}
                className={`w-full bg-gradient-to-r ${ctaGradient} text-white font-black text-lg sm:text-2xl py-5 px-6 ${buttonRadius} shadow-[0_6px_0_#0d612e,0_14px_28px_rgba(21,138,68,0.35)] active:translate-y-1 transition-all cursor-pointer flex flex-col items-center justify-center leading-tight border-2 border-white/25`}
              >
                <span className="flex items-center gap-2 text-center">
                  <Sparkles className="w-6 h-6 text-[#ffd778] shrink-0" />
                  <span>¡PEDIR AHORA! — {formatGs(currentPrice)}</span>
                </span>
                <span className="text-xs sm:text-base font-extrabold text-emerald-100 mt-1.5">
                  {currentProductPage?.freeShipping === false
                    ? 'Entrega rápida · Pagás en puerta en efectivo, QR o tarjeta'
                    : 'Envío GRATIS · Pagás en puerta en efectivo, QR o tarjeta'}
                </span>
              </button>
            </div>

            {/* 3-Column High-Visibility App Trust Cards */}
            <div className="grid grid-cols-3 gap-2.5 pt-1 text-center">
              <div className="bg-[#f6f4ee] border-2 border-[#e2ddd2] rounded-2xl p-3 flex flex-col items-center gap-1">
                <Truck className="w-6 h-6 text-[#1ea856]" />
                <span className="text-xs sm:text-sm font-black text-stone-900 leading-tight">
                  {currentProductPage?.freeShipping === false ? 'Entrega Rápida' : 'Envío Gratis'}
                </span>
                <span className="text-xs font-bold text-stone-600 leading-tight">Todo el país</span>
              </div>
              <div className="bg-[#f6f4ee] border-2 border-[#e2ddd2] rounded-2xl p-3 flex flex-col items-center gap-1">
                <ShieldCheck className="w-6 h-6 text-[#1ea856]" />
                <span className="text-xs sm:text-sm font-black text-stone-900 leading-tight">
                  Pago al Recibir
                </span>
                <span className="text-xs font-bold text-stone-600 leading-tight">Cero riesgo</span>
              </div>
              <div className="bg-[#f6f4ee] border-2 border-[#e2ddd2] rounded-2xl p-3 flex flex-col items-center gap-1">
                <Clock className="w-6 h-6 text-[#1ea856]" />
                <span className="text-xs sm:text-sm font-black text-stone-900 leading-tight">
                  Garantía {customTruth?.warrantyDays || 7} Días
                </span>
                <span className="text-xs font-bold text-stone-600 leading-tight">Cambio directo</span>
              </div>
            </div>
          </div>

          {/* Mobile-Only What's in the Box Card */}
          <div className="lg:hidden">{whatsInBoxCard}</div>
        </div>
      </div>

      {/* Full-Width Impactful Mobile-App Feed Cards ("Ventajas Principales") */}
      <div id="ventajas" className="mt-10 sm:mt-14 pt-8 sm:pt-10 border-t-2 border-[#dfdad0]">
        <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-8 px-1">
          <span className={`${primaryBg} text-[#ffd778] text-xs sm:text-sm font-black px-4 py-1.5 rounded-full uppercase tracking-wider inline-flex items-center gap-2 shadow-sm`}>
            <Camera className="w-4 h-4 text-[#25D366]" /> {customLanding?.benefitSectionBadge || 'Fotos Reales en Hogares'}
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#062319] tracking-tight mt-3 leading-tight">
            {customLanding?.benefitSectionTitle || 'Mirá cómo queda funcionando en casas reales'}
          </h2>
          <p className="text-stone-700 text-base sm:text-lg font-semibold mt-2">
            {customLanding?.benefitSectionSubtitle || 'Capturas directas sin filtros mostrando su potencia óptica y facilidad de uso.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {benefitCards.map((card, i) => (
            <div
              key={i}
              className="bg-white rounded-3xl border-2 border-[#dfdad0] overflow-hidden shadow-md hover:shadow-xl transition-shadow flex flex-col"
            >
              {/* True 1:1 aspect-square real photograph */}
              <div className="relative aspect-square w-full bg-[#062319] overflow-hidden border-b-2 border-[#e5e0d4]">
                <img
                  src={card.img}
                  alt={card.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <span className={`absolute top-3 left-3 ${primaryBg} text-[#ffd778] border border-[#e8b23a] text-xs sm:text-sm font-black px-3 py-1 rounded-full shadow-md`}>
                  {card.badge}
                </span>
                <div className="absolute bottom-3 left-3 right-3 bg-black/80 backdrop-blur-md text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-2 truncate">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#25d366] shrink-0" />
                  <span className="truncate">{card.cameraMeta}</span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-stone-900 text-lg sm:text-xl leading-snug">
                    {card.title}
                  </h3>
                  <p className="text-sm sm:text-base font-medium text-stone-700 mt-2 leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};



