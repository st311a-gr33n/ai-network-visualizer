import React, { useRef, useEffect, useCallback } from 'react';
import { animate } from 'animejs';

interface DotGridBackgroundProps {
  isActive: boolean;
}

const DOT_SPACING = 25;
const ACCENT = { r: 214, g: 194, b: 239 }; // #d6c2ef
const WAVE_DURATION = 8000;

interface Dot {
  x: number;
  y: number;
  dist: number; // normalized 0 (center) → 1 (farthest corner)
}

const DotGridBackground: React.FC<DotGridBackgroundProps> = ({ isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const dotsRef = useRef<Dot[]>([]);
  const phaseObjRef = useRef({ phase: 0 });
  const dimsRef = useRef({ cssW: 0, cssH: 0, dpr: 1 });

  /**
   * Build the dot grid for the given CSS-pixel dimensions.
   * Normalized distance is measured from the viewport center so the wave
   * expands as a ring radiating outward.
   */
  const buildDots = useCallback((cssW: number, cssH: number): Dot[] => {
    const cx = cssW / 2;
    const cy = cssH / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;

    const dots: Dot[] = [];
    // Offset by half-spacing so dots are centered in the grid cells,
    // matching the feel of the original radial-gradient.
    for (let x = DOT_SPACING / 2; x < cssW; x += DOT_SPACING) {
      for (let y = DOT_SPACING / 2; y < cssH; y += DOT_SPACING) {
        const dx = x - cx;
        const dy = y - cy;
        dots.push({
          x,
          y,
          dist: Math.sqrt(dx * dx + dy * dy) / maxDist,
        });
      }
    }
    return dots;
  }, []);

  /**
   * Draw all dots for a given wave phase (0–1).
   *
   * The wave is a subtle band of accent color that travels outward from the
   * center.  Dots inside the band take on the accent colour; dots outside
   * stay a neutral gray.  No halos, no size change — just a quiet colour
   * shift as the wave passes.
   */
  const drawDots = useCallback(
    (phase: number, ctx: CanvasRenderingContext2D, cssW: number, cssH: number) => {
      ctx.clearRect(0, 0, cssW, cssH);

      const bandWidth = 0.25; // wide band → gradual transition
      const dots = dotsRef.current;

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];

        // How far is this dot from the current wave front?
        const rawDelta = d.dist - phase;
        const wrapped = Math.min(Math.abs(rawDelta), 1 - Math.abs(rawDelta));
        const t = wrapped / bandWidth; // 0 = at wave front, ≥1 = outside band
        const glow = t < 1 ? 1 - t : 0;

        // Always 1 px — no size change
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1, 0, Math.PI * 2);

        if (glow > 0.005) {
          // Inside the wave band — subtle accent tint
          const eased = glow * glow * (3 - 2 * glow); // smoothstep
          const alpha = 0.08 + eased * 0.32; // 0.08 … 0.40
          ctx.fillStyle = `rgba(${ACCENT.r},${ACCENT.g},${ACCENT.b},${alpha})`;
        } else {
          // Neutral gray dot
          ctx.fillStyle = 'rgba(128,128,128,0.12)';
        }

        ctx.fill();
      }
    },
    [],
  );

  // ----- Canvas setup & resize handling -------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setup = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = window.innerWidth;
      const cssH = window.innerHeight;

      dimsRef.current = { cssW, cssH, dpr };

      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctxRef.current = ctx;
      }

      dotsRef.current = buildDots(cssW, cssH);
    };

    setup();

    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setup();
        // Re-draw static dots (or let the running animation pick up new dims)
        const ctx = ctxRef.current;
        if (ctx && !animationRef.current) {
          drawDots(0, ctx, dimsRef.current.cssW, dimsRef.current.cssH);
        }
      }, 100);
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
    };
  }, [buildDots, drawDots]);

  // ----- Initial static draw when NOT active --------------------------

  useEffect(() => {
    if (isActive) return; // animation effect handles drawing
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { cssW, cssH } = dimsRef.current;
    drawDots(0, ctx, cssW, cssH);
  }, [isActive, drawDots]);

  // ----- Start / stop the anime.js wave -------------------------------

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (isActive) {
      // Reset phase so the wave starts at the center
      phaseObjRef.current.phase = 0;

      const anim = animate(phaseObjRef.current, {
        phase: 1,
        duration: WAVE_DURATION,
        loop: true,
        ease: 'linear',
        onUpdate: () => {
          const { cssW, cssH, dpr } = dimsRef.current;
          const c = ctxRef.current;
          if (!c) return;
          c.save();
          c.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawDots(phaseObjRef.current.phase, c, cssW, cssH);
          c.restore();
        },
      });

      animationRef.current = anim;

      return () => {
        anim.pause();
        animationRef.current = null;
      };
    } else {
      // Draw static dots
      const { cssW, cssH, dpr } = dimsRef.current;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawDots(0, ctx, cssW, cssH);
      ctx.restore();
    }
  }, [isActive, drawDots]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};

export default DotGridBackground;
