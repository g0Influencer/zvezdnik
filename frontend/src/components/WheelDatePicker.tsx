import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/telegram';

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const CENTER_INDEX = Math.floor(VISIBLE_ITEMS / 2);

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

interface WheelColumnProps {
  items: { value: number; label: string }[];
  selected: number;
  onChange: (value: number) => void;
}

function WheelColumn({ items, selected, onChange }: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const selectedIndex = items.findIndex((i) => i.value === selected);

  useEffect(() => {
    if (containerRef.current && !isScrollingRef.current && selectedIndex >= 0) {
      containerRef.current.scrollTop = selectedIndex * ITEM_HEIGHT;
    }
  }, [selectedIndex]);

  const handleScroll = useCallback(() => {
    isScrollingRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const scrollTop = containerRef.current.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(index, items.length - 1));
      containerRef.current.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: 'smooth' });
      if (items[clamped] && items[clamped].value !== selected) {
        haptic('light');
        onChange(items[clamped].value);
      }
      isScrollingRef.current = false;
    }, 80);
  }, [items, selected, onChange]);

  return (
    <div className="relative" style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
      <div
        className="absolute left-0 right-0 rounded-lg bg-secondary/80 pointer-events-none z-0"
        style={{ top: CENTER_INDEX * ITEM_HEIGHT, height: ITEM_HEIGHT }}
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scrollbar-hide snap-y snap-mandatory relative z-10"
        style={{
          paddingTop: CENTER_INDEX * ITEM_HEIGHT,
          paddingBottom: CENTER_INDEX * ITEM_HEIGHT,
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {items.map((item) => {
          const isSelected = item.value === selected;
          return (
            <div
              key={item.value}
              className={cn(
                'flex items-center justify-center transition-all snap-center',
                isSelected ? 'text-foreground font-semibold text-[15px]' : 'text-muted-foreground text-[14px]'
              )}
              style={{ height: ITEM_HEIGHT }}
            >
              {item.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface WheelDatePickerProps {
  value: Date | undefined;
  onChange: (date: Date) => void;
  minYear?: number;
  maxYear?: number;
}

export function WheelDatePicker({
  value,
  onChange,
  minYear = 1930,
  maxYear = new Date().getFullYear(),
}: WheelDatePickerProps) {
  const fallback = value ?? new Date(1995, 5, 15);
  const day = fallback.getDate();
  const month = fallback.getMonth();
  const year = fallback.getFullYear();

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => ({
    value: maxYear - i,
    label: String(maxYear - i),
  }));

  const months = MONTHS.map((label, i) => ({ value: i, label }));

  const maxDay = getDaysInMonth(month, year);
  const days = Array.from({ length: maxDay }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  }));

  const update = (d: number, m: number, y: number) => {
    const md = getDaysInMonth(m, y);
    const safeDay = Math.min(d, md);
    onChange(new Date(y, m, safeDay));
  };

  return (
    <div className="flex gap-2 items-center w-full">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground text-center mb-2">День</p>
        <WheelColumn items={days} selected={Math.min(day, maxDay)} onChange={(v) => update(v, month, year)} />
      </div>
      <div className="flex-[1.5] min-w-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground text-center mb-2">Месяц</p>
        <WheelColumn items={months} selected={month} onChange={(v) => update(day, v, year)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground text-center mb-2">Год</p>
        <WheelColumn items={years} selected={year} onChange={(v) => update(day, month, v)} />
      </div>
    </div>
  );
}
