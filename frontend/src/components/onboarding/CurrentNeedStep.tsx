import { CURRENT_NEED_OPTIONS } from '@/lib/onboarding-config';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/telegram';

interface Props {
  currentNeed: string;
  onSelect: (value: string) => void;
}

export function CurrentNeedStep({ currentNeed, onSelect }: Props) {
  return (
    <div>
      <h2 className="font-display text-2xl font-bold mb-2">Чего вам сейчас особенно не хватает?</h2>
      <p className="text-sm text-muted-foreground mb-6">Это поможет расставить акценты в гороскопе.</p>

      <div className="space-y-2">
        {CURRENT_NEED_OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => {
              haptic('light');
              onSelect(opt);
            }}
            className={cn(
              'w-full rounded-xl border p-3.5 text-left text-sm transition-all',
              currentNeed === opt
                ? 'border-foreground bg-foreground/5'
                : 'border-border hover:border-foreground/30'
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
