import { format, isSameDay, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { haptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

interface DayPickerProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
}

const DAY_SHORT: Record<number, string> = {
  0: 'ВС',
  1: 'ПН',
  2: 'ВТ',
  3: 'СР',
  4: 'ЧТ',
  5: 'ПТ',
  6: 'СБ',
};

export function DayPicker({ selectedDate, onChange }: DayPickerProps) {
  const today = new Date();
  const days = [-2, -1, 0, 1, 2].map((offset) => addDays(today, offset));

  return (
    <div className="flex items-center justify-center gap-7 px-5">
      {days.map((day) => {
        const isSelected = isSameDay(day, selectedDate);
        const isToday = isSameDay(day, today);
        const isPast = day < today && !isToday;
        return (
          <button
            key={day.toISOString()}
            onClick={() => {
              haptic('light');
              onChange(day);
            }}
            className={cn(
              'relative flex flex-col items-center gap-1.5 pb-1.5 transition-colors',
              isSelected
                ? 'text-foreground'
                : isPast
                  ? 'text-muted-foreground/50'
                  : 'text-muted-foreground'
            )}
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.25em]">
              {DAY_SHORT[day.getDay()]}
            </span>
            {isSelected && (
              <span className="absolute -bottom-0 left-1/2 h-px w-5 -translate-x-1/2 bg-foreground" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function formatSelectedDateLabel(date: Date): string {
  return format(date, 'EEEE, d MMMM', { locale: ru }).toUpperCase();
}
