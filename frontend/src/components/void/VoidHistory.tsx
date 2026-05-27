import { X } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

export interface HistoryItem {
  id: number;
  question: string;
  answer: string;
  created_at: string;
}

interface VoidHistoryProps {
  open: boolean;
  onClose: () => void;
  items: HistoryItem[];
  onSelect: (question: string, answer: string) => void;
}

export function VoidHistory({ open, onClose, items, onSelect }: VoidHistoryProps) {
  const pairs = items;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full sm:max-w-md bg-background border-l border-border"
          >
            <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b border-border">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.3em] text-foreground">
                История вопросов
              </h2>
              <button onClick={onClose} className="p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto h-full pb-20">
              {pairs.length === 0 ? (
                <p className="px-5 py-12 text-[13px] text-muted-foreground/60 text-center">
                  Пока нет вопросов
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {pairs.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        onSelect(item.question, item.answer);
                        onClose();
                      }}
                      className="w-full text-left px-5 py-4 hover:bg-foreground/5 transition-colors"
                    >
                      <p className="text-[13px] text-foreground leading-snug line-clamp-2">
                        {item.question}
                      </p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1.5 uppercase tracking-[0.15em]">
                        {format(new Date(item.created_at), 'd MMM, HH:mm', { locale: ru })}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
