import { motion } from 'framer-motion';
import { haptic } from '@/lib/telegram';

const chips = [
  { label: 'Про отношения', question: 'Что сейчас происходит в моих отношениях и чего ждать?' },
  { label: 'Про работу', question: 'Как складывается ситуация на работе и что делать?' },
  { label: 'Про деньги', question: 'Какой сейчас период для финансов и как им распорядиться?' },
  { label: 'Про выбор', question: 'Я стою перед выбором — на что указывают звёзды?' },
  { label: 'Про тревогу', question: 'Откуда эта тревога и как с ней быть?' },
  { label: 'Ближайшие 7 дней', question: 'Что меня ждёт в ближайшие семь дней?' },
];

interface PromptChipsProps {
  onSelect: (question: string) => void;
}

export function PromptChips({ onSelect }: PromptChipsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="flex gap-2 overflow-x-auto px-5 pb-4 scrollbar-none"
      style={{ scrollbarWidth: 'none' }}
    >
      {chips.map((chip) => (
        <button
          key={chip.label}
          onClick={() => {
            haptic('light');
            onSelect(chip.question);
          }}
          className="shrink-0 rounded-full border border-border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          {chip.label}
        </button>
      ))}
    </motion.div>
  );
}
