import { useEffect, useMemo, useState } from 'react';

interface Star {
  id: number;
  top: string;
  left: string;
  size: number;
  delay: string;
  duration: string;
  baseOpacity: number;
  glow: boolean;
}


function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// Deterministic pseudo-random so the layout is stable across renders.
function rand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function MainScreenStarBackground() {
  const reduced = usePrefersReducedMotion();

  const stars = useMemo<Star[]>(() => {
    const count = 80;
    return Array.from({ length: count }, (_, i) => {
      const r1 = rand(i + 1);
      const r2 = rand(i + 99);
      const r3 = rand(i + 211);
      const r4 = rand(i + 333);
      const r5 = rand(i + 444);
      // Mostly tiny stars, a few slightly bigger for depth.
      const size = r3 < 0.75 ? 1 : r3 < 0.94 ? 1.5 : 2;
      return {
        id: i,
        top: `${r1 * 100}%`,
        left: `${r2 * 100}%`,
        size,
        delay: `${(r4 * 8).toFixed(2)}s`,
        duration: `${(5 + r5 * 6).toFixed(2)}s`,
        baseOpacity: 0.25 + r3 * 0.35, // 0.25 – 0.6, subtle
        glow: size === 2, // only the largest ~6-8% get a faint glow
      };
    });
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background"
    >
      {/* Flat dark background — no central glow */}
      <div className="absolute inset-0" style={{ background: 'hsl(0 0% 4%)' }} />

      {/* Stars */}
      <div className="absolute inset-0">
        {stars.map((s) => (
          <span
            key={s.id}
            className="absolute rounded-full bg-foreground"
            style={{
              top: s.top,
              left: s.left,
              width: `${s.size}px`,
              height: `${s.size}px`,
              opacity: s.baseOpacity,
              boxShadow: s.glow
                ? `0 0 ${s.size * 2.5}px hsl(0 0% 100% / 0.2)`
                : undefined,
              animation: reduced
                ? undefined
                : `star-twinkle ${s.duration} ease-in-out ${s.delay} infinite`,
              willChange: reduced ? undefined : 'opacity',
            }}
          />
        ))}
      </div>

      {/* Very light vignette only at the very bottom for nav legibility */}
      <div
        className="absolute inset-x-0 bottom-0 h-32"
        style={{
          background:
            'linear-gradient(180deg, hsl(0 0% 0% / 0) 0%, hsl(0 0% 0% / 0.5) 100%)',
        }}
      />
    </div>
  );
}
