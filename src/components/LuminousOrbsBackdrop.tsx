import React, { useEffect, useRef } from 'react';

/**
 * Architectural 3D Luminous Orbs Backdrop for Creador Rápido Studio.
 * Uses GPU-composited specular radial spheres + subtle parallax without WebGL failure modes.
 */
export const LuminousOrbsBackdrop: React.FC = () => {
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    let rafId = 0;
    const handlePointerMove = (e: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const nx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
        const ny = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
        el.style.transform = `translate3d(${(nx * -12).toFixed(1)}px, ${(ny * -10).toFixed(1)}px, 0)`;
      });
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
    >
      {/* Subtle architectural dark studio ambient radial lighting */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(229, 200, 139, 0.08) 0%, rgba(12, 16, 26, 0.92) 55%, rgba(6, 8, 13, 1) 100%)'
        }}
      />

      <div
        ref={layerRef}
        className="absolute inset-0 transition-transform duration-300 ease-out will-change-transform"
      >
        {/* Esfera 3D Principal — Champagne Luminoso (Superior Derecha) */}
        <div
          className="orb-float-a absolute -top-20 -right-12 w-72 h-72 sm:w-96 sm:h-96 rounded-full opacity-80"
          style={{
            background:
              'radial-gradient(circle at 30% 26%, rgba(255, 251, 240, 0.9) 0%, rgba(235, 205, 145, 0.42) 22%, rgba(92, 74, 48, 0.24) 52%, rgba(11, 14, 22, 0.92) 78%, rgba(6, 8, 13, 0) 100%)',
            boxShadow:
              'inset 0 -18px 42px rgba(0, 0, 0, 0.85), inset 0 8px 26px rgba(255, 246, 220, 0.35), 0 0 80px rgba(229, 200, 139, 0.16)'
          }}
        />

        {/* Esfera 3D Secundaria — Platino Ahumado (Centro Izquierda) */}
        <div
          className="orb-float-b absolute top-1/3 -left-24 w-64 h-64 sm:w-80 sm:h-80 rounded-full opacity-75"
          style={{
            background:
              'radial-gradient(circle at 34% 28%, rgba(244, 247, 255, 0.65) 0%, rgba(148, 163, 184, 0.28) 26%, rgba(30, 41, 59, 0.42) 58%, rgba(8, 11, 18, 0.92) 82%, rgba(6, 8, 13, 0) 100%)',
            boxShadow:
              'inset 0 -16px 36px rgba(0, 0, 0, 0.88), inset 0 6px 22px rgba(226, 232, 240, 0.22), 0 0 64px rgba(148, 163, 184, 0.12)'
          }}
        />

        {/* Esfera 3D Satélite — Perla Dorada (Inferior Derecha) */}
        <div
          className="orb-float-c absolute -bottom-16 right-1/4 w-44 h-44 sm:w-56 sm:h-56 rounded-full opacity-70"
          style={{
            background:
              'radial-gradient(circle at 32% 28%, rgba(255, 250, 235, 0.78) 0%, rgba(212, 178, 116, 0.32) 28%, rgba(45, 38, 28, 0.45) 60%, rgba(6, 8, 13, 0.94) 84%, rgba(6, 8, 13, 0) 100%)',
            boxShadow:
              'inset 0 -12px 28px rgba(0, 0, 0, 0.88), inset 0 4px 16px rgba(255, 244, 214, 0.28), 0 0 50px rgba(212, 178, 116, 0.14)'
          }}
        />
      </div>
    </div>
  );
};
