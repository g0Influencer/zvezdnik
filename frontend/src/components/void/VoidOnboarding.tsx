import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'zvezdnik-void-onboarding';

export function useVoidOnboarding() {
  const [hasSeen, setHasSeen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch { /* noop */ }
    setHasSeen(true);
  };

  return { hasSeen, dismiss };
}

interface VoidOnboardingOverlayProps {
  onDismiss: () => void;
}

export function VoidOnboardingOverlay({ onDismiss }: VoidOnboardingOverlayProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm px-6"
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-[320px]"
        >
          {/* Decorative top element — subtle ring */}
          <div className="mx-auto mb-8 h-16 w-16 rounded-full border border-foreground/15 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6 text-foreground/40"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1" />
              <path
                d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h2 className="font-display text-center text-[22px] font-medium leading-[1.3] tracking-tight text-foreground mb-4">
            Вселенная
          </h2>

          <p className="text-center text-[13px] leading-[1.7] text-muted-foreground/80 mb-3">
            Ответы на твои вопросы строятся на основе натальной карты — положения планет в момент твоего рождения.
          </p>

          <p className="text-center text-[13px] leading-[1.7] text-muted-foreground/80 mb-10">
            Звёздник анализирует эти данные, сверяется с текущим небом и формирует персональный ответ.
          </p>

          <button
            onClick={onDismiss}
            className="mx-auto block w-full max-w-[200px] rounded-full border border-foreground/20 bg-foreground px-6 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-background transition-colors hover:bg-foreground/90"
          >
            Понятно
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
