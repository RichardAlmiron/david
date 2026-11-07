import React, { useState, useRef } from 'react';
import {
  Check,
  X,
  Droplets,
  Play,
  RotateCw,
  Home,
  Video,
  ArrowRight,
  Volume2,
  VolumeX,
  Maximize,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

type DemoScene = 'fachada' | 'macro' | 'camara';

const DEMO_SCENES: Record<
  DemoScene,
  {
    title: string;
    subtitle: string;
    badge: string;
    image: string;
    caption: string;
    tag: string;
  }
> = {
  fachada: {
    title: 'Fachada Panorámica 70 m²',
    subtitle: 'Cobertura masiva de más de 70 m² sobre muros de 2 pisos y garaje con 1 solo proyector',
    badge: 'Proyección Nocturna Exterior',
    image: '/src/assets/images/noelux_panoramica_70m2_1793968658255.jpg',
    caption: 'Cabezal de 19 lentes a 5 metros en el césped cubriendo casa completa con figuras navideñas nítidas.',
    tag: 'Cobertura 70 m²'
  },
  macro: {
    title: 'Cabezal Motorizado de 19 Lentes IP65',
    subtitle: 'Sellado hermético contra lluvias intensas con matriz panal de 19 lentes ópticos',
    badge: 'Detalle Óptico de Precisión',
    image: '/src/assets/images/noelux_cabezal_19_lentes_ip65_1793968653702.jpg',
    caption: 'Carcasa cilíndrica sellada con gotas de lluvia y 19 lentes convexos proyectando haz multicolor.',
    tag: 'Resistencia IP65'
  },
  camara: {
    title: 'Cámara en Vivo 1:1',
    subtitle: 'Grabación directa sin filtros mostrando la rotación continua en sensor',
    badge: 'Captura Óptica Real',
    image: '/assets/demo-fachada.gif',
    caption: 'Animación real de copos y figuras en movimiento suave de 360 grados.',
    tag: 'Giro Óptico 360°'
  }
};

const VS_COMPARISONS = [
  {
    feature: 'Tiempo de instalación',
    noelux: '90 segundos (clavás, enchufás y listo)',
    old: '3 a 5 horas colgado en escaleras'
  },
  {
    feature: 'Seguridad para tu familia',
    noelux: '100% Seguro · Cero riesgo de caídas',
    old: 'Peligro de caídas y cables pelados'
  },
  {
    feature: 'Lluvias y tormentas de verano',
    noelux: 'Blindaje IP65 sellado hermético',
    old: 'Entra agua y hace cortocircuito'
  },
  {
    feature: 'Consumo en factura de ANDE',
    noelux: 'Solo 5 Watts (95% de ahorro LED)',
    old: 'Hasta 150 Watts con varias guirnaldas'
  },
  {
    feature: 'Durabilidad año tras año',
    noelux: '50.000 horas de vida útil real',
    old: 'Se queman los foquitos y se tiran'
  }
];

export const InteractiveShowcase: React.FC = () => {
  const { openOrderFormFullscreen, currentProductPage } = useStore();
  const [activeScene, setActiveScene] = useState<DemoScene>('fachada');
  const currentSceneData = DEMO_SCENES[activeScene];

  const customLanding = currentProductPage?.landingContent;
  const customTheme = currentProductPage?.themeConfig;
  const customTruth = currentProductPage?.physicalTruth;
  const primaryBg = customTheme?.primaryBg || 'bg-[#0b3d2e]';
  const headerGradient = customTheme?.headerBg || 'from-[#062319] via-[#0b3d2e] to-[#062319]';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);

  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsVideoPlaying(true);
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  if (customLanding) {
    return (
      <div className="space-y-10 sm:space-y-14 py-4 sm:py-8">
        {/* 1. FICHA TÉCNICA Y VERDAD FÍSICA DEL PRODUCTO */}
        <section id="como-funciona" className="app-container">
          <div className={`bg-gradient-to-br ${headerGradient} text-white rounded-3xl p-5 sm:p-8 shadow-xl border-2 border-[#e8b23a]/40 space-y-6`}>
            <div className="text-center max-w-2xl mx-auto">
              <span className="bg-[#e8b23a] text-[#062319] text-xs sm:text-sm font-black px-4 py-1.5 rounded-full uppercase tracking-wider inline-flex items-center gap-2">
                <Zap className="w-4 h-4" /> {customLanding.showcaseBadge || 'Ficha Técnica Verificada'}
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight mt-3 leading-tight">
                {customLanding.showcaseTitle}
              </h2>
              <p className="text-stone-200 text-base sm:text-lg font-medium mt-2">
                {customLanding.showcaseSubtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-w-5xl mx-auto">
              {(customLanding.specsGrid || []).map((spec, idx) => (
                <div key={idx} className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/15">
                  <span className="text-xs font-black uppercase tracking-wider text-[#ffd778] block">
                    {spec.label}
                  </span>
                  <b className="text-sm sm:text-base font-extrabold text-white mt-1 block leading-snug">
                    {spec.value}
                  </b>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => openOrderFormFullscreen()}
                className="px-7 py-4 rounded-2xl bg-gradient-to-r from-[#e8b23a] to-[#f59e0b] hover:from-[#ffd778] hover:to-[#e8b23a] text-[#062319] font-black text-base sm:text-lg inline-flex items-center gap-2 shadow-lg cursor-pointer active:scale-95 transition-all"
              >
                <span>Pedir {currentProductPage?.nombre} Contra Entrega</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>

        {/* 2. COMPARATIVA DIRECTA MÓVIL VS COMPETENCIA */}
        <section id="video-demostracion" className="app-container">
          <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-8">
            <span className={`${primaryBg} text-[#ffd778] text-xs sm:text-sm font-black px-4 py-1.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5`}>
              <ShieldCheck className="w-4 h-4 text-[#25D366]" /> Comparativa de Calidad Real
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#062319] tracking-tight mt-3 leading-tight">
              {customLanding.vsCompetitorTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
            {(customLanding.vsComparisons || []).map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl border-2 border-[#dfdad0] p-5 shadow-md space-y-3"
              >
                <div className="text-base sm:text-lg font-black text-[#062319] uppercase tracking-tight border-b border-stone-200 pb-2">
                  {item.feature}
                </div>

                <div className="flex items-start gap-3 bg-[#eefaf3] border-2 border-[#86efac] rounded-2xl p-3.5">
                  <div className="w-7 h-7 rounded-full bg-[#1ea856] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase text-[#0a7a4a] block">
                      {customLanding.vsOursLabel || currentProductPage?.nombre}
                    </span>
                    <span className="text-base sm:text-lg font-black text-[#062319] leading-snug block">
                      {item.ours}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-red-50/70 border border-red-200 rounded-2xl p-3">
                  <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <X className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase text-red-700 block">
                      {customLanding.vsOldLabel || 'Opciones Comunes'}
                    </span>
                    <span className="text-sm sm:text-base font-semibold text-stone-600 leading-snug block">
                      {item.old}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-10 sm:space-y-14 py-4 sm:py-8">


      {/* ========================================================================= */}
      {/* 1. SECCIÓN: VIDEO DE DEMOSTRACIÓN ESTILO APP REELS / CINEMA               */}
      {/* ========================================================================= */}
      <section id="video-demostracion" className="app-container">
        <div className="max-w-4xl mx-auto bg-white rounded-3xl border-2 border-[#dfdad0] p-4 sm:p-7 shadow-xl space-y-6">
          <div className="text-center max-w-2xl mx-auto">
            <span className="bg-[#0b3d2e] text-[#ffd778] text-xs sm:text-sm font-black px-4 py-1.5 rounded-full uppercase tracking-wider inline-flex items-center gap-2 shadow-xs">
              <Video className="w-4 h-4 text-[#25D366]" /> Video Oficial en Vivo
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#062319] tracking-tight mt-3 leading-tight">
              Miralo funcionando en tiempo real
            </h2>
            <p className="text-stone-700 text-base sm:text-lg font-semibold mt-2 leading-relaxed">
              Observá el giro motorizado continuo de su cabezal y cómo cubre fachadas completas de dos plantas en segundos.
            </p>
          </div>

          {/* Cinema Frame with Live MP4 Video Player */}
          <div
            onClick={toggleVideoPlay}
            className="relative rounded-3xl overflow-hidden bg-black aspect-video max-h-[560px] w-full mx-auto shadow-xl border-2 border-stone-800 cursor-pointer group"
          >
            <video
              ref={videoRef}
              src="/assets/video-proyector-navideno.mp4"
              autoPlay
              loop
              muted={isMuted}
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Floating Top Badge */}
            <div className="absolute top-3.5 left-3.5 bg-black/80 backdrop-blur-md text-[#ffd778] text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-full border border-white/25 flex items-center gap-2 shadow-lg pointer-events-none">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span>GRABACIÓN REAL · HD</span>
            </div>

            {/* Play/Pause Overlay indicator when paused */}
            {!isVideoPlaying && (
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center transition-all">
                <div className="w-20 h-20 rounded-full bg-[#0b3d2e]/95 text-white flex items-center justify-center border-3 border-[#e8b23a] shadow-2xl">
                  <Play className="w-10 h-10 ml-1 fill-white text-white" />
                </div>
              </div>
            )}

            {/* Bottom Controls Bar */}
            <div className="absolute bottom-3.5 right-3.5 flex items-center gap-2.5 z-10">
              <button
                type="button"
                onClick={toggleMute}
                className="px-3.5 py-2.5 rounded-2xl bg-black/80 hover:bg-black text-white border border-white/25 backdrop-blur-md transition-all shadow-lg active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm font-black"
                title={isMuted ? 'Activar sonido' : 'Silenciar'}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-5 h-5 text-[#ffd778]" />
                    <span>Sonido</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-5 h-5 text-[#25D366]" />
                    <span>Activo</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2.5 rounded-2xl bg-black/80 hover:bg-black text-white border border-white/25 backdrop-blur-md transition-all shadow-lg active:scale-95 cursor-pointer"
                title="Pantalla completa"
              >
                <Maximize className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* 3-Pillar Mobile App Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="bg-[#f6f4ee] border-2 border-[#e2ddd2] rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-[#0b3d2e] text-[#ffd778] flex items-center justify-center font-black text-base shrink-0 shadow-xs">
                  1
                </div>
                <h4 className="text-base sm:text-lg font-black text-stone-900 leading-tight">
                  Listo en 90 Segundos
                </h4>
              </div>
              <p className="text-sm sm:text-base font-medium text-stone-700 leading-relaxed">
                Clavás la estaca en pasto o apoyás la base en piso. Enchufás directo a 220V sin herramientas.
              </p>
            </div>

            <div className="bg-[#f6f4ee] border-2 border-[#e2ddd2] rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-[#0b3d2e] text-[#ffd778] flex items-center justify-center font-black text-base shrink-0 shadow-xs">
                  2
                </div>
                <h4 className="text-base sm:text-lg font-black text-stone-900 leading-tight">
                  Giro Óptico 360°
                </h4>
              </div>
              <p className="text-sm sm:text-base font-medium text-stone-700 leading-relaxed">
                El motor interno rota todas las figuras en bucle suave sin cambiar diapositivas a mano.
              </p>
            </div>

            <div className="bg-[#f6f4ee] border-2 border-[#e2ddd2] rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-[#0b3d2e] text-[#ffd778] flex items-center justify-center font-black text-base shrink-0 shadow-xs">
                  3
                </div>
                <h4 className="text-base sm:text-lg font-black text-stone-900 leading-tight">
                  Sello IP65 Anti-Lluvia
                </h4>
              </div>
              <p className="text-sm sm:text-base font-medium text-stone-700 leading-relaxed">
                Carcasa hermética con doble anillo de silicona que soporta tormentas fuertes de verano.
              </p>
            </div>
          </div>

          {/* App Banner CTA */}
          <div className="bg-gradient-to-r from-[#062319] via-[#0b3d2e] to-[#062319] rounded-3xl p-5 sm:p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 border-2 border-[#e8b23a]/50 shadow-lg">
            <div className="text-center sm:text-left">
              <span className="text-sm sm:text-base font-black uppercase text-[#ffd778] tracking-wide block">
                🚚 Envío 100% Gratis a Todo Paraguay
              </span>
              <p className="text-sm sm:text-base font-semibold text-stone-200 mt-1">
                Abonás recién cuando el repartidor llegue a la puerta de tu casa.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openOrderFormFullscreen()}
              className="w-full sm:w-auto justify-center px-6 py-4 rounded-2xl bg-gradient-to-r from-[#e8b23a] to-[#f59e0b] hover:from-[#ffd778] hover:to-[#e8b23a] text-[#062319] font-black text-base sm:text-lg inline-flex items-center gap-2 shadow-lg cursor-pointer active:scale-95 transition-all shrink-0"
            >
              <span>Pedir Mi Proyector</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. SECCIÓN: DEMOSTRACIÓN ÓPTICA INTERACTIVA (3 VISTAS TÁCTILES)           */}
      {/* ========================================================================= */}
      <section id="optica-en-vivo" className="app-container">
        <div className="bg-gradient-to-b from-[#041a12] via-[#07291d] to-[#03120c] text-white py-8 sm:py-12 px-4 sm:px-8 rounded-3xl shadow-2xl border-2 border-[#e8b23a]/35 overflow-hidden relative">
          <div className="max-w-3xl mx-auto text-center mb-6 sm:mb-8 relative z-10">
            <span className="text-[#ffd778] text-xs sm:text-sm font-black uppercase tracking-wider bg-white/10 px-4 py-1.5 rounded-full inline-flex items-center gap-2 border border-[#ffd778]/40">
              <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] animate-ping" />
              <span>Potencia Óptica Real</span>
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mt-3 text-white tracking-tight leading-tight">
              Tocá cada botón para explorar el lente y la proyección
            </h2>

            {/* Interactive Touch Scene Switcher (Big App Buttons) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-5 max-w-2xl mx-auto">
              <button
                type="button"
                onClick={() => setActiveScene('fachada')}
                className={`px-4 py-3.5 rounded-2xl text-sm sm:text-base font-black transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 ${
                  activeScene === 'fachada'
                    ? 'bg-[#ffd778] text-[#062319] shadow-lg'
                    : 'bg-white/12 text-white hover:bg-white/20 border border-white/15'
                }`}
              >
                <Home className="w-5 h-5 shrink-0" />
                <span>1. Fachada 70 m²</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveScene('macro')}
                className={`px-4 py-3.5 rounded-2xl text-sm sm:text-base font-black transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 ${
                  activeScene === 'macro'
                    ? 'bg-[#ffd778] text-[#062319] shadow-lg'
                    : 'bg-white/12 text-white hover:bg-white/20 border border-white/15'
                }`}
              >
                <RotateCw className="w-5 h-5 shrink-0" />
                <span>2. Cabezal 19 Lentes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveScene('camara')}
                className={`px-4 py-3.5 rounded-2xl text-sm sm:text-base font-black transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 ${
                  activeScene === 'camara'
                    ? 'bg-[#ffd778] text-[#062319] shadow-lg'
                    : 'bg-white/12 text-white hover:bg-white/20 border border-white/15'
                }`}
              >
                <Video className="w-5 h-5 shrink-0" />
                <span>3. Giro en Cámara</span>
              </button>
            </div>
          </div>

          {/* Viewport + Separate Mobile-Friendly Caption Card so text never overlaps or shrinks */}
          <div className="max-w-4xl mx-auto bg-[#062319] rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl">
            <div className="relative aspect-[4/3] sm:aspect-[16/9] bg-black flex items-center justify-center">
              <img
                key={activeScene}
                src={currentSceneData.image}
                alt={currentSceneData.title}
                className={`w-full h-full ${
                  activeScene === 'camara' ? 'object-contain max-h-[440px]' : 'object-cover'
                }`}
              />
              <div className="absolute top-3.5 left-3.5 bg-black/80 backdrop-blur-md text-[#ffd778] text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-full border border-white/20">
                {currentSceneData.badge}
              </div>
              <div className="absolute top-3.5 right-3.5 bg-[#1ea856] text-white text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-full shadow-md">
                {currentSceneData.tag}
              </div>
            </div>

            <div className="p-4 sm:p-6 bg-[#083022] border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg sm:text-2xl font-black text-[#ffd778] leading-snug">
                  {currentSceneData.title}
                </h3>
                <p className="text-sm sm:text-base text-stone-200 font-medium mt-1 leading-relaxed">
                  {currentSceneData.caption}
                </p>
              </div>
              <span className="text-xs sm:text-sm font-black uppercase text-white bg-white/10 px-3.5 py-2 rounded-xl border border-white/20 shrink-0 self-start sm:self-center">
                Óptica 120° HD
              </span>
            </div>
          </div>

          {/* 4 Big App Stat Cards (2x2 Mobile Grid) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mt-6 max-w-4xl mx-auto">
            <div className="bg-white/10 rounded-2xl p-4 border border-white/15 text-center">
              <span className="text-2xl sm:text-3xl font-black text-[#ffd778] block leading-none">
                70 m²
              </span>
              <b className="text-sm sm:text-base text-white font-black mt-1.5 block">
                Cobertura Real
              </b>
              <span className="text-xs sm:text-sm text-stone-300 font-medium block mt-0.5">
                Cubre 2 plantas
              </span>
            </div>

            <div className="bg-white/10 rounded-2xl p-4 border border-white/15 text-center">
              <span className="text-2xl sm:text-3xl font-black text-[#ffd778] block leading-none">
                120°
              </span>
              <b className="text-sm sm:text-base text-white font-black mt-1.5 block">
                Gran Angular
              </b>
              <span className="text-xs sm:text-sm text-stone-300 font-medium block mt-0.5">
                Proyección nítida
              </span>
            </div>

            <div className="bg-white/10 rounded-2xl p-4 border border-white/15 text-center">
              <span className="text-2xl sm:text-3xl font-black text-[#ffd778] block leading-none">
                19 Lentes
              </span>
              <b className="text-sm sm:text-base text-white font-black mt-1.5 block">
                Cabezal Panal
              </b>
              <span className="text-xs sm:text-sm text-stone-300 font-medium block mt-0.5">
                Brillo uniforme
              </span>
            </div>

            <div className="bg-white/10 rounded-2xl p-4 border border-white/15 text-center">
              <span className="text-2xl sm:text-3xl font-black text-[#ffd778] block leading-none">
                Solo 5W
              </span>
              <b className="text-sm sm:text-base text-white font-black mt-1.5 block">
                Ultra Económico
              </b>
              <span className="text-xs sm:text-sm text-stone-300 font-medium block mt-0.5">
                No sube la ANDE
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. SECCIÓN: 3 PASOS EN 90 SEGUNDOS (TARJETAS GRANDES DE MÓVIL)            */}
      {/* ========================================================================= */}
      <section id="como-funciona" className="app-container">
        <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-8">
          <span className="bg-[#e5f6ec] border border-[#86efac] text-[#064e3b] text-xs sm:text-sm font-black px-4 py-1.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-[#1ea856]" /> Súper Fácil de Usar
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#062319] tracking-tight mt-3 leading-tight">
            Instalación completa en 90 segundos
          </h2>
          <p className="text-stone-700 text-base sm:text-lg font-semibold mt-2">
            Olvidate de pasar toda la tarde desenredando cables o subiendo a escaleras peligrosas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white border-2 border-[#dfdad0] rounded-3xl p-5 sm:p-6 shadow-md">
            <div className="flex items-center gap-3.5 mb-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#0b3d2e] text-[#ffd778] font-black text-xl sm:text-2xl flex items-center justify-center shadow-sm shrink-0">
                1
              </div>
              <h3 className="text-lg sm:text-xl font-black text-stone-900 leading-snug">
                Clavá la estaca o apoyá la base
              </h3>
            </div>
            <p className="text-base font-medium text-stone-700 leading-relaxed">
              Si tenés pasto o tierra, clavás la estaca de 20 cm. Si tenés piso de material o balcón, apoyás el soporte basculante incluido en la caja.
            </p>
          </div>

          <div className="bg-white border-2 border-[#dfdad0] rounded-3xl p-5 sm:p-6 shadow-md">
            <div className="flex items-center gap-3.5 mb-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#0b3d2e] text-[#ffd778] font-black text-xl sm:text-2xl flex items-center justify-center shadow-sm shrink-0">
                2
              </div>
              <h3 className="text-lg sm:text-xl font-black text-stone-900 leading-snug">
                Apuntá y enchufá a 220V
              </h3>
            </div>
            <p className="text-base font-medium text-stone-700 leading-relaxed">
              Inclinás el cabezal hacia tu pared y enchufás su cable hermético de 5 metros directo a cualquier tomacorriente normal.
            </p>
          </div>

          <div className="bg-white border-2 border-[#dfdad0] rounded-3xl p-5 sm:p-6 shadow-md">
            <div className="flex items-center gap-3.5 mb-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#0b3d2e] text-[#ffd778] font-black text-xl sm:text-2xl flex items-center justify-center shadow-sm shrink-0">
                3
              </div>
              <h3 className="text-lg sm:text-xl font-black text-stone-900 leading-snug">
                Disfrutá los 12 diseños
              </h3>
            </div>
            <p className="text-base font-medium text-stone-700 leading-relaxed">
              Al instante, tu casa brilla con los 12 motivos navideños girando suavemente. Al terminar las fiestas, lo guardás en su caja chica.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SECCIÓN: TARJETAS MÓVILES "VS" (REEMPLAZA TABLA WEB DE ESCRITORIO)     */}
      {/* ========================================================================= */}
      <section className="app-container">
        <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-8">
          <span className="bg-[#0b3d2e] text-[#ffd778] text-xs sm:text-sm font-black px-4 py-1.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#25D366]" /> Comparativa Directa
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#062319] tracking-tight mt-3 leading-tight">
            Noelux™ vs. Luces de Cable Tradicionales
          </h2>
          <p className="text-stone-700 text-base sm:text-lg font-semibold mt-2">
            Por qué miles de familias paraguayas ya jubilaron las guirnaldas viejas:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
          {VS_COMPARISONS.map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-3xl border-2 border-[#dfdad0] p-5 shadow-md space-y-3"
            >
              <div className="text-base sm:text-lg font-black text-[#062319] uppercase tracking-tight border-b border-stone-200 pb-2">
                {item.feature}
              </div>

              {/* Noelux Winner Row */}
              <div className="flex items-start gap-3 bg-[#eefaf3] border-2 border-[#86efac] rounded-2xl p-3.5">
                <div className="w-7 h-7 rounded-full bg-[#1ea856] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase text-[#0a7a4a] block">
                    Proyector Noelux™ HD
                  </span>
                  <span className="text-base sm:text-lg font-black text-[#062319] leading-snug block">
                    {item.noelux}
                  </span>
                </div>
              </div>

              {/* Old String Lights Loser Row */}
              <div className="flex items-start gap-3 bg-red-50/70 border border-red-200 rounded-2xl p-3">
                <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <X className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase text-red-700 block">
                    Luces Viejas de Cable
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-stone-600 leading-snug block">
                    {item.old}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. SECCIÓN: BLINDAJE IMPERMEABLE IP65                                     */}
      {/* ========================================================================= */}
      <section className="app-container">
        <div className="bg-gradient-to-br from-[#062319] via-[#0b3d2e] to-[#041a12] text-white rounded-3xl p-5 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 items-center gap-6 sm:gap-8 shadow-xl border-2 border-[#e8b23a]/35">
          <div className="lg:col-span-5 rounded-3xl overflow-hidden border-2 border-white/25 shadow-lg aspect-square max-w-[440px] mx-auto w-full bg-[#062319]">
            <img
              src="/src/assets/images/noelux_lluvia_ip65_jardin_1793968651758.jpg"
              alt="Proyector Noelux funcionando bajo lluvia intensa en jardín"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="lg:col-span-7 space-y-4">
            <span className="bg-[#e8b23a] text-[#062319] text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5">
              <Droplets className="w-4 h-4" /> Hecho para el Clima de Paraguay
            </span>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight">
              Soporta tormentas eléctricas de verano sin apagarse
            </h3>
            <p className="text-stone-200 text-base sm:text-lg font-medium leading-relaxed">
              Su carcasa con doble sello siliconado impide el paso de agua, humedad o polvo. Podés dejarlo instalado en el jardín toda la temporada con total tranquilidad.
            </p>
            <div className="pt-2 grid grid-cols-3 gap-3">
              <div className="bg-white/10 rounded-2xl p-3.5 text-center border border-white/15">
                <b className="block text-lg sm:text-2xl font-black text-[#ffd778]">IP65</b>
                <span className="text-xs sm:text-sm font-bold text-stone-200">Impermeable</span>
              </div>
              <div className="bg-white/10 rounded-2xl p-3.5 text-center border border-white/15">
                <b className="block text-lg sm:text-2xl font-black text-[#ffd778]">50°C</b>
                <span className="text-xs sm:text-sm font-bold text-stone-200">Anti-calor</span>
              </div>
              <div className="bg-white/10 rounded-2xl p-3.5 text-center border border-white/15">
                <b className="block text-lg sm:text-2xl font-black text-[#ffd778]">5 Metros</b>
                <span className="text-xs sm:text-sm font-bold text-stone-200">Cable sellado</span>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

