import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface ProductDemoVideoProps {
  isThumbnail?: boolean;
}

const CHAPTERS = [
  {
    id: 0,
    shortLabel: '1. En mano',
    stepBadge: 'PASO 1 DE 4 · VISTAZO EN MANO',
    captionLine1: 'Así es el proyector físico real: cilindro compacto (11 × 12 cm)',
    captionLine2: 'con soporte basculante en U y cabezal óptico de 19 lentes.'
  },
  {
    id: 1,
    shortLabel: '2. Prueba haz',
    stepBadge: 'PASO 2 DE 4 · PRUEBA DE ENCENDIDO',
    captionLine1: 'Al conectarlo proyecta las figuras navideñas a color en la mano',
    captionLine2: 'y empieza a girar automáticamente sobre la pared.'
  },
  {
    id: 2,
    shortLabel: '3. En patio',
    stepBadge: 'PASO 3 DE 4 · UBICACIÓN AFUERA DE CASA',
    captionLine1: 'Colocado en el jardín o patio a unos metros de la pared exterior,',
    captionLine2: 'el cabezal inclinado cubre de inmediato los dos pisos.'
  },
  {
    id: 3,
    shortLabel: '4. Fachada real',
    stepBadge: 'PASO 4 DE 4 · FACHADA REAL ILUMINADA',
    captionLine1: 'Vista real desde afuera de la casa: las figuras navideñas giran',
    captionLine2: 'con nitidez sobre toda la pared exterior en la oscuridad.'
  }
];

/**
 * 100% Real-Footage & Real-Photography UGC Presentation Video.
 * Renders at 1080x1080 HD internal resolution with high-quality Lanczos sprite sheets
 * and vector-sharp responsive HTML/CSS HUD overlays that adapt cleanly from 320px phones to 32" displays.
 */
export const ProductDemoVideo: React.FC<ProductDemoVideoProps> = ({ isThumbnail = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeChapter, setActiveChapter] = useState(0);
  const lockedChapterRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  const pausedElapsedRef = useRef<number>(0);

  const assetsRef = useRef<{
    handsSheet: HTMLImageElement | null;
    facadeSheet: HTMLImageElement | null;
    presenterSelfie: HTMLImageElement | null;
    presenterNight: HTMLImageElement | null;
    familyFacade: HTMLImageElement | null;
    houseNight: HTMLImageElement | null;
    houseWide: HTMLImageElement | null;
    projectorNight: HTMLImageElement | null;
    projectorStudio: HTMLImageElement | null;
    projectorRgb: HTMLImageElement | null;
    loadedCount: number;
  }>({
    handsSheet: null,
    facadeSheet: null,
    presenterSelfie: null,
    presenterNight: null,
    familyFacade: null,
    houseNight: null,
    houseWide: null,
    projectorNight: null,
    projectorStudio: null,
    projectorRgb: null,
    loadedCount: 0
  });

  const jumpToChapter = (chapterIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    lockedChapterRef.current = chapterIndex;
    const targetElapsed = chapterIndex * 4000;
    pausedElapsedRef.current = targetElapsed;
    startTimeRef.current = performance.now();
    setActiveChapter(chapterIndex);
    setIsPlaying(true);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const DURATION = 16000; // 16-second loop (4 chapters x 4 seconds)
    let timerId: number | null = null;
    let isCancelled = false;

    const drawCoverImage = (
      c: CanvasRenderingContext2D,
      img: HTMLImageElement,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
      zoom = 1,
      panX = 0,
      panY = 0
    ) => {
      if (!img.complete || img.naturalWidth === 0) return;
      c.save();
      c.beginPath();
      c.rect(dx, dy, dw, dh);
      c.clip();

      const imgAspect = img.naturalWidth / img.naturalHeight;
      const boxAspect = dw / dh;
      let renderW = dw;
      let renderH = dh;

      if (imgAspect > boxAspect) {
        renderH = dh;
        renderW = dh * imgAspect;
      } else {
        renderW = dw;
        renderH = dw / imgAspect;
      }

      renderW *= zoom;
      renderH *= zoom;

      const cx = dx + (dw - renderW) / 2 + panX;
      const cy = dy + (dh - renderH) / 2 + panY;
      c.drawImage(img, cx, cy, renderW, renderH);
      c.restore();
    };

    const drawRoundedImage = (
      c: CanvasRenderingContext2D,
      img: HTMLImageElement | null,
      x: number,
      y: number,
      w: number,
      h: number,
      radius: number,
      borderColor = 'rgba(255,255,255,0.88)',
      borderWidth = 3.5,
      label?: string
    ) => {
      if (!img || !img.complete || img.naturalWidth === 0) return;
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.6)';
      c.shadowBlur = 22;
      c.shadowOffsetY = 8;

      c.beginPath();
      c.roundRect(x, y, w, h, radius);
      c.fillStyle = '#071711';
      c.fill();

      c.shadowColor = 'transparent';
      c.clip();
      drawCoverImage(c, img, x, y, w, h, 1.03);

      if (label) {
        const barH = Math.round(h * 0.24);
        const grad = c.createLinearGradient(0, y + h - barH, 0, y + h);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.9)');
        c.fillStyle = grad;
        c.fillRect(x, y + h - barH, w, barH);

        c.fillStyle = '#ffffff';
        c.font = `700 ${Math.max(14, Math.round(w * 0.078))}px system-ui, -apple-system, sans-serif`;
        c.textAlign = 'center';
        c.fillText(label, x + w / 2, y + h - Math.round(barH * 0.25));
      }
      c.restore();

      c.save();
      c.strokeStyle = borderColor;
      c.lineWidth = borderWidth;
      c.beginPath();
      c.roundRect(x, y, w, h, radius);
      c.stroke();
      c.restore();
    };

    /**
     * Draws a specific frame (0..35) from the 6x6 HD Lanczos hands-on camera sprite sheet
     * (/assets/ugc/real-hands-sheet.jpg, 2400x2400, 400x400 per cell).
     */
    const drawHandsVideoFrame = (
      c: CanvasRenderingContext2D,
      frameFloat: number,
      dx: number,
      dy: number,
      dw: number,
      dh: number
    ) => {
      const sheet = assetsRef.current.handsSheet;
      if (!sheet || !sheet.complete || sheet.naturalWidth === 0) return;

      const cellW = sheet.naturalWidth / 6;
      const cellH = sheet.naturalHeight / 6;
      const inset = Math.round(cellW * 0.06);
      const cropW = cellW - inset * 2;
      const cropH = cellH - inset * 2;

      const idx1 = Math.max(0, Math.min(35, Math.floor(frameFloat)));
      const idx2 = Math.max(0, Math.min(35, idx1 + 1));
      const frac = frameFloat - Math.floor(frameFloat);

      const col1 = idx1 % 6;
      const row1 = Math.floor(idx1 / 6);
      const sx1 = col1 * cellW + inset;
      const sy1 = row1 * cellH + inset;

      c.save();
      c.drawImage(sheet, sx1, sy1, cropW, cropH, dx, dy, dw, dh);

      if (frac > 0.05 && idx2 !== idx1) {
        const col2 = idx2 % 6;
        const row2 = Math.floor(idx2 / 6);
        const sx2 = col2 * cellW + inset;
        const sy2 = row2 * cellH + inset;
        c.globalAlpha = frac;
        c.drawImage(sheet, sx2, sy2, cropW, cropH, dx, dy, dw, dh);
      }
      c.restore();
    };

    /**
     * Draws a specific frame (0..24) from the 5x5 HD Lanczos snowfall projection
     * camera sprite sheet (/assets/ugc/real-facade-sheet.jpg, 2000x2000, 400x400 per cell).
     */
    const drawFacadeSnowFrame = (
      c: CanvasRenderingContext2D,
      frameFloat: number,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
      compositeMode: GlobalCompositeOperation = 'source-over',
      alpha = 1
    ) => {
      const sheet = assetsRef.current.facadeSheet;
      if (!sheet || !sheet.complete || sheet.naturalWidth === 0) return;

      const cellW = sheet.naturalWidth / 5;
      const cellH = sheet.naturalHeight / 5;
      const inset = Math.round(cellW * 0.06);
      const cropW = cellW - inset * 2;
      const cropH = cellH - inset * 2;

      const idx1 = ((Math.floor(frameFloat) % 25) + 25) % 25;
      const idx2 = (idx1 + 1) % 25;
      const frac = frameFloat - Math.floor(frameFloat);

      const col1 = idx1 % 5;
      const row1 = Math.floor(idx1 / 5);
      const sx1 = col1 * cellW + inset;
      const sy1 = row1 * cellH + inset;

      c.save();
      c.globalCompositeOperation = compositeMode;
      c.globalAlpha = alpha;
      c.drawImage(sheet, sx1, sy1, cropW, cropH, dx, dy, dw, dh);

      if (frac > 0.05) {
        const col2 = idx2 % 5;
        const row2 = Math.floor(idx2 / 5);
        const sx2 = col2 * cellW + inset;
        const sy2 = row2 * cellH + inset;
        c.globalAlpha = alpha * frac;
        c.drawImage(sheet, sx2, sy2, cropW, cropH, dx, dy, dw, dh);
      }
      c.restore();
    };

    const getElapsedMs = (now: number) => {
      if (isThumbnail) return 13200; // Thumbnail shows Chapter 4 (real family & house facade)
      const raw = isPlaying ? now - startTimeRef.current : pausedElapsedRef.current;
      if (lockedChapterRef.current !== null) {
        return lockedChapterRef.current * 4000 + (raw % 4000);
      }
      return raw % DURATION;
    };

    const renderFrame = (now: number) => {
      const W = canvas.width;
      const H = canvas.height;

      const elapsed = getElapsedMs(now);
      const t = elapsed / 1000; // 0 .. 16.0s

      if (!isThumbnail && progressBarRef.current) {
        progressBarRef.current.style.width = `${(elapsed / DURATION) * 100}%`;
      }

      ctx.fillStyle = '#05140e';
      ctx.fillRect(0, 0, W, H);

      // ============================================================================
      // CHAPTER 1 (0.0s - 4.0s): REAL HANDS HOLDING & SHOWING THE PHYSICAL PROJECTOR
      // ============================================================================
      if (t < 4.0) {
        const localP = t / 4.0;
        const pingPong = localP < 0.5 ? localP * 2 : (1 - localP) * 2;
        const framePos = pingPong * 4.2;
        drawHandsVideoFrame(ctx, framePos, 0, 0, W, H);

        const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.72);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.34)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);

        if (!isThumbnail) {
          const pipW = Math.round(W * 0.215);
          const pipH1 = Math.round(H * 0.18);
          const pipH2 = Math.round(H * 0.2);
          const margin = Math.round(W * 0.025);

          // Real installation photo of the physical projector in grass
          drawRoundedImage(
            ctx,
            assetsRef.current.presenterSelfie,
            W - pipW - margin,
            margin,
            pipW,
            pipH1,
            20,
            '#e8b23a',
            3.5,
            'Estaca en jardín'
          );

          // Real studio photo of the physical projector showing U-bracket & 19 lenses
          drawRoundedImage(
            ctx,
            assetsRef.current.projectorStudio,
            W - pipW - margin,
            margin + pipH1 + 14,
            pipW,
            pipH2,
            20,
            'rgba(255,255,255,0.88)',
            3.5,
            'Cabezal 19 lentes'
          );
        }
      }

      // ============================================================================
      // CHAPTER 2 (4.0s - 8.0s): REAL HANDS TESTING COLORFUL BEAM ON PALM & WALL
      // ============================================================================
      else if (t < 8.0) {
        const localP = (t - 4.0) / 4.0;
        const frameSequence = [18, 19, 20, 19, 18, 23, 24, 25, 26, 27, 28, 29, 30, 31];
        const seqPos = localP * (frameSequence.length - 1);
        const fIdx = frameSequence[Math.floor(seqPos)];
        drawHandsVideoFrame(ctx, fIdx, 0, 0, W, H);

        if (!isThumbnail) {
          const pipW = Math.round(W * 0.225);
          const pipH = Math.round(H * 0.215);
          const margin = Math.round(W * 0.025);

          drawRoundedImage(
            ctx,
            assetsRef.current.projectorRgb,
            W - pipW - margin,
            margin,
            pipW,
            pipH,
            20,
            '#38bdf8',
            3.5,
            'Óptica LED encendida'
          );
        }
      }

      // ============================================================================
      // CHAPTER 3 (8.0s - 12.0s): REAL OUTDOOR NIGHT PLACEMENT & SNOWFLAKE PROJECTION
      // ============================================================================
      else if (t < 12.0) {
        const localP = (t - 8.0) / 4.0;
        const zoom = 1.02 + localP * 0.04;

        if (assetsRef.current.houseWide) {
          drawCoverImage(ctx, assetsRef.current.houseWide, 0, 0, W, H, zoom, 0, -12);
        }

        drawFacadeSnowFrame(
          ctx,
          t * 8,
          Math.round(W * 0.07),
          Math.round(H * 0.02),
          Math.round(W * 0.86),
          Math.round(H * 0.65),
          'screen',
          0.92
        );

        const margin = Math.round(W * 0.025);
        const cardW = Math.round(W * 0.26);
        const cardH = Math.round(H * 0.27);
        const cardY = H - cardH - Math.round(H * 0.22);

        drawRoundedImage(
          ctx,
          assetsRef.current.projectorNight,
          W - cardW - margin,
          cardY,
          cardW,
          cardH,
          22,
          '#f3ca52',
          3.5,
          'Soporte en jardín a 5 m'
        );

        drawRoundedImage(
          ctx,
          assetsRef.current.presenterNight,
          margin,
          cardY,
          Math.round(W * 0.235),
          cardH,
          22,
          'rgba(255,255,255,0.85)',
          3.5,
          'Resistente a lluvia IP65'
        );
      }

      // ============================================================================
      // CHAPTER 4 (12.0s - 16.0s): REAL FAMILY OUTDOORS AT NIGHT & FULL HOUSE FACADE
      // ============================================================================
      else {
        const localP = (t - 12.0) / 4.0;

        if (assetsRef.current.houseNight) {
          drawCoverImage(
            ctx,
            assetsRef.current.houseNight,
            0,
            0,
            W,
            H * 0.58,
            1.03 + localP * 0.04,
            0,
            0
          );
        }

        // Real dark-room snowflake optical projection blended seamlessly over the night facade
        drawFacadeSnowFrame(ctx, t * 7, 0, 0, W, H * 0.56, 'screen', 0.55);

        if (assetsRef.current.familyFacade) {
          ctx.save();
          drawCoverImage(
            ctx,
            assetsRef.current.familyFacade,
            0,
            H * 0.46,
            W,
            H * 0.54,
            1.02 + localP * 0.02,
            0,
            0
          );
          ctx.restore();
        }

        // Subtle soft horizon blend between top house facade and bottom family outdoors
        const seamGrad = ctx.createLinearGradient(0, H * 0.41, 0, H * 0.51);
        seamGrad.addColorStop(0, 'rgba(5, 20, 14, 0)');
        seamGrad.addColorStop(0.5, 'rgba(5, 20, 14, 0.55)');
        seamGrad.addColorStop(1, 'rgba(5, 20, 14, 0)');
        ctx.fillStyle = seamGrad;
        ctx.fillRect(0, H * 0.41, W, H * 0.1);
      }
    };

    const loadAllRealAssets = () => {
      const sources: Array<[keyof typeof assetsRef.current, string]> = [
        ['handsSheet', '/assets/ugc/real-hands-sheet.jpg'],
        ['facadeSheet', '/assets/ugc/real-facade-sheet.jpg'],
        ['presenterSelfie', '/src/assets/images/noelux_mano_estaca_cesped_1793968644514.jpg'],
        ['presenterNight', '/src/assets/images/noelux_lluvia_ip65_jardin_1793968651758.jpg'],
        ['familyFacade', '/src/assets/images/noelux_familia_fachada_1793968640573.jpg'],
        ['houseNight', '/src/assets/images/noelux_fachada_jardin_1793968638764.jpg'],
        ['houseWide', '/src/assets/images/noelux_panoramica_70m2_1793968658255.jpg'],
        ['projectorNight', '/src/assets/images/noelux_cabezal_19_lentes_ip65_1793968653702.jpg'],
        ['projectorStudio', '/assets/ugc/real-projector-studio.jpg'],
        ['projectorRgb', '/assets/ugc/real-projector-rgb.jpg']
      ];

      sources.forEach(([key, url]) => {
        const img = new Image();
        img.src = url;
        img.onload = () => {
          if (isCancelled) return;
          (assetsRef.current as Record<string, unknown>)[key] = img;
          assetsRef.current.loadedCount += 1;
          renderFrame(performance.now());
        };
      });
    };

    loadAllRealAssets();
    renderFrame(performance.now());

    if (!isThumbnail) {
      timerId = window.setInterval(() => {
        if (!isCancelled) {
          const now = performance.now();
          const elapsed = getElapsedMs(now);
          const chap = Math.min(3, Math.floor(elapsed / 4000));
          setActiveChapter((prev) => (prev !== chap ? chap : prev));
          renderFrame(now);
        }
      }, 42); // 24fps smooth playback
    }

    return () => {
      isCancelled = true;
      if (timerId !== null) window.clearInterval(timerId);
    };
  }, [isPlaying, isThumbnail]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      pausedElapsedRef.current = performance.now() - startTimeRef.current;
      setIsPlaying(false);
    } else {
      startTimeRef.current = performance.now() - pausedElapsedRef.current;
      setIsPlaying(true);
    }
  };

  const restartVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    lockedChapterRef.current = null;
    pausedElapsedRef.current = 0;
    startTimeRef.current = performance.now();
    setActiveChapter(0);
    setIsPlaying(true);
  };

  if (isThumbnail) {
    return (
      <div className="relative w-full h-full bg-[#051a13] overflow-hidden">
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="w-full h-full object-cover block"
        />
        <div className="absolute inset-x-1 bottom-1 bg-[#0b3d2e]/95 text-[#f3ca52] text-[9px] sm:text-[10px] font-black text-center py-0.5 rounded-md border border-[#f3ca52]/40 leading-tight truncate">
          ▶ USO REAL
        </div>
      </div>
    );
  }

  const currentChapterInfo = CHAPTERS[activeChapter] || CHAPTERS[0];

  return (
    <div
      onClick={togglePlay}
      className="relative w-full h-full bg-[#051a13] select-none cursor-pointer group overflow-hidden"
    >
      {/* 1080x1080 HD Internal Resolution Canvas */}
      <canvas
        ref={canvasRef}
        width={1080}
        height={1080}
        className="w-full h-full object-cover block"
      />

      {/* Top-Left Crisp Vector HTML Status & Step Badges (adapts cleanly from 320px to 32" TV) */}
      <div className="absolute top-2.5 left-2.5 sm:top-3.5 sm:left-3.5 z-10 flex flex-col items-start gap-1.5 pointer-events-none max-w-[68%]">
        <div className="inline-flex items-center gap-1.5 bg-[#081610]/90 backdrop-blur-md border border-white/25 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-md">
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#22c55e] animate-pulse shrink-0" />
          <span className="text-white font-extrabold text-[10px] sm:text-xs tracking-wide uppercase truncate">
            VIDEO REAL · PRUEBA DE USO
          </span>
        </div>
        <div className="bg-[#e8b23a] text-[#062319] font-black text-[9.5px] sm:text-[11px] px-2.5 py-0.5 sm:py-1 rounded-md shadow-sm uppercase tracking-wider truncate max-w-full">
          {currentChapterInfo.stepBadge}
        </div>
      </div>

      {/* Bottom Responsive HTML Overlay Stack (Caption + Chapter Selector + Controls) */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3.5 sm:left-3.5 sm:right-3.5 z-10 flex flex-col gap-2 pointer-events-none">
        {/* Vector-sharp Descriptive Caption Box */}
        <div className="bg-[#08120e]/90 backdrop-blur-md border border-white/20 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 text-center shadow-lg">
          <p className="text-white font-semibold text-[11px] sm:text-xs md:text-sm leading-snug">
            {currentChapterInfo.captionLine1}
          </p>
          <p className="text-emerald-200 font-medium text-[10px] sm:text-xs leading-snug mt-0.5">
            {currentChapterInfo.captionLine2}
          </p>
        </div>

        {/* Interactive Chapter Selector + Play/Pause Controls */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 pointer-events-auto">
          <div className="flex items-center gap-0.5 sm:gap-1 bg-black/80 backdrop-blur-md p-1 rounded-xl border border-white/15 overflow-x-auto no-scrollbar max-w-full">
            {CHAPTERS.map((chap) => (
              <button
                key={chap.id}
                type="button"
                onClick={(e) => jumpToChapter(chap.id, e)}
                className={`px-1.5 sm:px-2.5 py-1 rounded-lg text-[9.5px] sm:text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  activeChapter === chap.id
                    ? 'bg-[#e8b23a] text-[#062319] shadow-xs'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                {chap.shortLabel}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={togglePlay}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/80 backdrop-blur-md text-white flex items-center justify-center border border-white/20 hover:bg-black/95 transition-colors cursor-pointer"
              title={isPlaying ? 'Pausar demostración' : 'Reproducir demostración'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={restartVideo}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/80 backdrop-blur-md text-white flex items-center justify-center border border-white/20 hover:bg-black/95 transition-colors cursor-pointer"
              title="Ver ciclo completo desde el principio"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 overflow-hidden">
        <div
          ref={progressBarRef}
          className="h-full bg-[#e8b23a]"
          style={{ width: '0%' }}
        />
      </div>
    </div>
  );
};
