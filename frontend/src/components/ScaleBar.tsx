import { motion } from 'framer-motion';

interface ScaleBarProps {
  label: string;
  value: number;
  max?: number;
}

export function ScaleBar({ label, value, max = 10 }: ScaleBarProps) {
  const pct = Math.min(100, (value / max) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-display text-sm font-semibold">{value}/{max}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full rounded-full bg-foreground"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </div>
  );
}
