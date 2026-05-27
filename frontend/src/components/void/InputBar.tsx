import { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { haptic } from '@/lib/telegram';

interface InputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  remaining: number;
  loading: boolean;
  onPaywall: () => void;
}

export function InputBar({ value, onChange, onSend, remaining, loading, onPaywall }: InputBarProps) {
  const handleSubmit = () => {
    if (!value.trim() || loading) return;
    haptic('medium');
    onSend();
  };

  return (
    <div className="fixed bottom-[72px] left-0 right-0 z-40 border-t border-border bg-background px-4 pb-2 pt-3">
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Напиши свой вопрос…"
            disabled={loading}
            className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/50 outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || loading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-30 transition-opacity"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] tracking-[0.15em] text-muted-foreground/60">
            Осталось вопросов: {remaining}
          </span>
          <button
            onClick={() => { haptic('light'); onPaywall(); }}
            className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Пополнить
          </button>
        </div>
      </div>
    </div>
  );
}
