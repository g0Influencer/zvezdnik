import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/telegram';

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const ITEM_HEIGHT = 44;
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
    if (containerRef.current && !isScrollingRef.current) {
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
      {/* Selection highlight */}
      <div
        className="absolute left-0 right-0 rounded-lg bg-secondary/80 pointer-events-none z-0"
        style={{ top: CENTER_INDEX * ITEM_HEIGHT, height: ITEM_HEIGHT }}
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scrollbar-hide snap-y snap-mandatory"
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
                isSelected ? 'text-foreground font-semibold text-lg' : 'text-muted-foreground text-base'
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

interface BirthDateStepProps {
  birthDate: Date | undefined;
  onDateChange: (date: Date) => void;
}

export function BirthDateStep({ birthDate, onDateChange }: BirthDateStepProps) {
  const now = new Date();
  const [day, setDay] = useState(birthDate?.getDate() ?? 15);
  const [month, setMonth] = useState(birthDate?.getMonth() ?? 5);
  const [year, setYear] = useState(birthDate?.getFullYear() ?? 1995);

  const currentYear = now.getFullYear();
  const years = Array.from({ length: currentYear - 1920 + 1 }, (_, i) => ({
    value: 1920 + i,
    label: String(1920 + i),
  })).reverse();

  const months = MONTHS.map((label, i) => ({ value: i, label }));

  const maxDay = getDaysInMonth(month, year);
  const days = Array.from({ length: maxDay }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  }));

  const clampedDay = Math.min(day, maxDay);

  useEffect(() => {
    const d = new Date(year, month, clampedDay);
    if (d <= now && d >= new Date(1920, 0, 1)) {
      onDateChange(d);
    }
  }, [clampedDay, month, year]);

  useEffect(() => {
    if (clampedDay !== day) setDay(clampedDay);
  }, [clampedDay, day]);

  return (
    <div>
      <h2 className="font-display text-2xl font-bold mb-2">Когда ты родился?</h2>
      <p className="text-sm text-muted-foreground mb-8">Нужна точная дата для натальной карты</p>

      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground text-center mb-2 font-medium">День</p>
          <WheelColumn items={days} selected={clampedDay} onChange={setDay} />
        </div>
        <div className="flex-[1.4]">
          <p className="text-xs text-muted-foreground text-center mb-2 font-medium">Месяц</p>
          <WheelColumn items={months} selected={month} onChange={setMonth} />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground text-center mb-2 font-medium">Год</p>
          <WheelColumn items={years} selected={year} onChange={setYear} />
        </div>
      </div>
    </div>
  );
}
