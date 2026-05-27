import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

interface Props {
  onHistoryOpen?: () => void;
}

export function VoidHeader({ onHistoryOpen }: Props) {
  return (
    <motion.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-between px-5 pt-14 pb-6"
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-foreground">
        Войд
      </span>
      {onHistoryOpen && (
        <button onClick={onHistoryOpen} className="p-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </motion.header>
  );
}
