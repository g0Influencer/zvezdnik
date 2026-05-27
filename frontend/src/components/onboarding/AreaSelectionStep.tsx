import { AREAS } from '@/lib/onboarding-config';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/telegram';

interface Props {
  selectedAreas: string[];
  onToggle: (id: string) => void;
}

export function AreaSelectionStep({ selectedAreas, onToggle }: Props) {
  const maxReached = selectedAreas.length >= 2;

  return (
    <div>
      <h2 className="font-display text-2xl font-bold mb-2">Что сейчас для вас важнее всего?</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Выберите до двух сфер — мы сделаем гороскоп более персональным.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {AREAS.map((area) => {
          const isSelected = selectedAreas.includes(area.id);
          const isDisabled = maxReached && !isSelected;

          return (
            <button
              key={area.id}
              onClick={() => {
                if (isDisabled) return;
                haptic('light');
                onToggle(area.id);
              }}
              disabled={isDisabled}
              className={cn(
                'rounded-xl border p-4 text-left transition-all',
                isSelected
                  ? 'border-foreground bg-foreground/5'
                  : 'border-border hover:border-foreground/30',
                isDisabled && 'opacity-40 pointer-events-none'
              )}
            >
              <span className="text-lg mb-1 block">{area.emoji}</span>
              <p className="text-sm font-medium">{area.title}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
