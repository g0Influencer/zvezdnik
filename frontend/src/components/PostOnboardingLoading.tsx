import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface PostOnboardingLoadingProps {
  onComplete: () => void;
  durationMs?: number;
}

const PHRASES = [
  'Собираем твою карту',
  'Сверяем ритм дня',
  'Ищем главную тему',
  'Настраиваем подсказки',
];

const PHRASE_INTERVAL = 1500;

// 12 evenly spaced points around the chart
const POINTS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
  return {
    x: 100 + Math.cos(angle) * 78,
    y: 100 + Math.sin(angle) * 78,
  };
});

// A handful of "aspect" lines connecting points
const ASPECTS: Array<[number, number]> = [
  [0, 5],
  [2, 8],
  [3, 9],
  [1, 7],
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

export function PostOnboardingLoading({
  onComplete,
  durationMs = 7000,
}: PostOnboardingLoadingProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [phraseIndex, setPhraseIndex] = useState(0);

  // Stable randomized particles
  const particles = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 1.4 + 0.6,
        delay: Math.random() * 4,
        duration: 2.4 + Math.random() * 3,
        opacity: 0.35 + Math.random() * 0.45,
      })),
    []
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % PHRASES.length);
    }, PHRASE_INTERVAL);
    const finishTimer = setTimeout(onComplete, durationMs);
    return () => {
      clearInterval(interval);
      clearTimeout(finishTimer);
    };
  }, [onComplete, durationMs]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-background"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at center, hsl(var(--foreground) / 0.04) 0%, hsl(var(--background)) 60%)',
      }}
    >
      {/* Star particles */}
      <div className="absolute inset-0">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute rounded-full bg-foreground"
            style={{
              top: `${p.top}%`,
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              animation: reducedMotion
                ? undefined
                : `ritual-twinkle ${p.duration}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6">
        {/* Natal chart diagram */}
        <div className="relative h-64 w-64">
          {/* Soft central glow */}
          <div
            className="absolute inset-0 m-auto h-32 w-32 rounded-full"
            style={{
              background:
                'radial-gradient(circle, hsl(var(--foreground) / 0.08) 0%, transparent 70%)',
              animation: reducedMotion
                ? undefined
                : 'ritual-pulse 4s ease-in-out infinite',
            }}
          />

          <div
            className="absolute inset-0"
            style={{
              animation: reducedMotion
                ? undefined
                : 'ritual-spin 60s linear infinite',
            }}
          >
            <svg
              viewBox="0 0 200 200"
              className="h-full w-full"
              fill="none"
              aria-hidden="true"
            >
              {/* Outer ring */}
              <circle
                cx="100"
                cy="100"
                r="90"
                stroke="hsl(var(--foreground) / 0.22)"
                strokeWidth="0.6"
              />
              {/* Inner ring */}
              <circle
                cx="100"
                cy="100"
                r="62"
                stroke="hsl(var(--foreground) / 0.12)"
                strokeWidth="0.5"
              />
              {/* Tick marks */}
              {POINTS.map((p, i) => {
                const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
                const x1 = 100 + Math.cos(a) * 86;
                const y1 = 100 + Math.sin(a) * 86;
                const x2 = 100 + Math.cos(a) * 90;
                const y2 = 100 + Math.sin(a) * 90;
                return (
                  <line
                    key={`t-${i}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="hsl(var(--foreground) / 0.25)"
                    strokeWidth="0.5"
                  />
                );
              })}
              {/* Aspect lines */}
              {ASPECTS.map(([a, b], idx) => (
                <line
                  key={`asp-${idx}`}
                  x1={POINTS[a].x}
                  y1={POINTS[a].y}
                  x2={POINTS[b].x}
                  y2={POINTS[b].y}
                  stroke="hsl(var(--foreground) / 0.18)"
                  strokeWidth="0.4"
                  style={{
                    animation: reducedMotion
                      ? undefined
                      : `ritual-aspect 6s ease-in-out ${idx * 1.2}s infinite`,
                  }}
                />
              ))}
              {/* Glowing points */}
              {POINTS.map((p, i) => (
                <g key={`p-${i}`}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="3"
                    fill="hsl(var(--foreground) / 0.08)"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="1.4"
                    fill="hsl(var(--foreground) / 0.85)"
                    style={{
                      animation: reducedMotion
                        ? undefined
                        : `ritual-twinkle ${3 + (i % 4)}s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                </g>
              ))}
              {/* Center mark */}
              <circle
                cx="100"
                cy="100"
                r="1.2"
                fill="hsl(var(--foreground) / 0.6)"
              />
            </svg>
          </div>
        </div>

        {/* Status text */}
        <div
          role="status"
          aria-live="polite"
          className="mt-12 flex h-8 items-center justify-center"
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={phraseIndex}
              initial={
                reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }
              }
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="font-display text-xl font-medium tracking-tight text-foreground"
            >
              {PHRASES[phraseIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Hint caps */}
        <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Мгновение
        </p>

        {/* Progress hairline */}
        <div className="mt-8 h-px w-40 overflow-hidden bg-foreground/10">
          <div
            className="h-full bg-foreground/60"
            style={{
              width: '0%',
              animation: `ritual-progress ${durationMs}ms linear forwards`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default PostOnboardingLoading;
