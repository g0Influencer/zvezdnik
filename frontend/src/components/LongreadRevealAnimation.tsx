import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onComplete: () => void;
}

const STAGES = [
  'Анализируем твою карту',
  'Сверяем положение планет',
  'Ищем главный акцент',
  'Собираем текст',
];

const STAGE_DURATION = 1250; // ms per stage → ~5s total

export function LongreadRevealAnimation({ onComplete }: Props) {
  const [stage, setStage] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timers: number[] = [];
    STAGES.forEach((_, i) => {
      if (i === 0) return;
      timers.push(window.setTimeout(() => setStage(i), i * STAGE_DURATION));
    });
    timers.push(
      window.setTimeout(() => setDone(true), STAGES.length * STAGE_DURATION)
    );
    timers.push(
      window.setTimeout(() => onComplete(), STAGES.length * STAGE_DURATION + 600)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [onComplete]);

  // Static faint stars
  const stars = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 1.4 + 0.4,
        opacity: Math.random() * 0.5 + 0.15,
        delay: Math.random() * 2,
      })),
    []
  );

  // Occasional shooting stars
  const shootingStars = useMemo(
    () =>
      Array.from({ length: 3 }, (_, i) => ({
        id: i,
        top: 10 + Math.random() * 40,
        left: Math.random() * 60,
        delay: 1 + i * 1.8,
      })),
    []
  );

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="fixed inset-0 z-[60] bg-background overflow-hidden"
        >
          {/* Star field */}
          <div className="absolute inset-0">
            {stars.map((s) => (
              <motion.div
                key={s.id}
                className="absolute rounded-full bg-foreground"
                style={{
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  width: `${s.size}px`,
                  height: `${s.size}px`,
                }}
                animate={{ opacity: [s.opacity * 0.4, s.opacity, s.opacity * 0.4] }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: s.delay,
                  ease: 'easeInOut',
                }}
              />
            ))}

            {/* Shooting stars */}
            {shootingStars.map((s) => (
              <motion.div
                key={`sh-${s.id}`}
                className="absolute h-px w-24 bg-gradient-to-r from-transparent via-foreground/70 to-transparent"
                style={{ top: `${s.top}%`, left: `${s.left}%` }}
                initial={{ opacity: 0, x: -50, y: -20 }}
                animate={{
                  opacity: [0, 0.7, 0],
                  x: [0, 200],
                  y: [0, 80],
                }}
                transition={{
                  duration: 1.6,
                  delay: s.delay,
                  repeat: Infinity,
                  repeatDelay: 4 + Math.random() * 3,
                  ease: 'easeOut',
                }}
              />
            ))}
          </div>

          {/* Center block */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center px-8">
            {/* Pulsing star with thin orbit */}
            <div className="relative mb-12 h-28 w-28 flex items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full border border-foreground/15"
                animate={{ rotate: 360 }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              >
                <div className="absolute -top-[3px] left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-foreground/70" />
              </motion.div>
              <motion.div
                className="absolute inset-3 rounded-full border border-foreground/10"
                animate={{ rotate: -360 }}
                transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
              >
                <div className="absolute top-1/2 -right-[2px] -translate-y-1/2 h-1 w-1 rounded-full bg-foreground/50" />
              </motion.div>
              <motion.div
                className="h-2 w-2 rounded-full bg-foreground"
                animate={{
                  scale: [1, 1.6, 1],
                  opacity: [0.7, 1, 0.7],
                  boxShadow: [
                    '0 0 8px hsl(var(--foreground) / 0.4)',
                    '0 0 22px hsl(var(--foreground) / 0.8)',
                    '0 0 8px hsl(var(--foreground) / 0.4)',
                  ],
                }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            {/* Stage text */}
            <div className="h-8 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={stage}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="text-[13px] uppercase tracking-[0.3em] text-foreground/80 text-center"
                >
                  {STAGES[stage]}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Stage progress dots */}
            <div className="mt-6 flex items-center gap-2">
              {STAGES.map((_, i) => (
                <motion.div
                  key={i}
                  className="h-1 w-1 rounded-full bg-foreground"
                  animate={{
                    opacity: i <= stage ? 0.9 : 0.2,
                    scale: i === stage ? 1.4 : 1,
                  }}
                  transition={{ duration: 0.4 }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
