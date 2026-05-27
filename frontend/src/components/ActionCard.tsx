import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface ActionCardProps {
  action: string;
}

export function ActionCard({ action }: ActionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5 }}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/10">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
            Сделай сегодня
          </p>
          <p className="text-sm font-medium leading-relaxed">{action}</p>
        </div>
      </div>
    </motion.div>
  );
}
