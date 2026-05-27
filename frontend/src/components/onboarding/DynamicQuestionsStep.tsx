import { getAreaById } from '@/lib/onboarding-config';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/telegram';

interface Props {
  selectedAreas: string[];
  answers: Record<string, string>;
  onAnswer: (fieldName: string, value: string) => void;
}

export function DynamicQuestionsStep({ selectedAreas, answers, onAnswer }: Props) {
  return (
    <div>
      <h2 className="font-display text-2xl font-bold mb-2">
        Расскажите немного о том, что сейчас происходит
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Это поможет сделать ежедневный гороскоп точнее.
      </p>

      <div className="space-y-8">
        {selectedAreas.map((areaId) => {
          const area = getAreaById(areaId);
          if (!area) return null;

          return (
            <div key={areaId}>
              <p className="text-sm font-medium mb-3">{area.question}</p>
              <div className="space-y-2">
                {area.options.map((opt) => {
                  const isSelected = answers[area.fieldName] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => {
                        haptic('light');
                        onAnswer(area.fieldName, opt);
                      }}
                      className={cn(
                        'w-full rounded-xl border p-3.5 text-left text-sm transition-all',
                        isSelected
                          ? 'border-foreground bg-foreground/5'
                          : 'border-border hover:border-foreground/30'
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
