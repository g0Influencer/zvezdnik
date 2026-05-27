import { motion } from 'framer-motion';

interface MessageCardProps {
  message: string;
  index: number;
  locked?: boolean;
}

export function MessageCard({ message, index, locked }: MessageCardProps) {
  if (locked) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="rounded-xl border border-border bg-secondary/50 p-4 relative overflow-hidden"
      >
        <div className="blur-sm select-none">
          <p className="text-sm leading-relaxed">Это сообщение доступно в PRO</p>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground bg-background/80 px-3 py-1 rounded-full">
            🔒 PRO
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <p className="text-sm leading-relaxed">{message}</p>
    </motion.div>
  );
}
