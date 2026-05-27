import { motion } from 'framer-motion';
import { haptic } from '@/lib/telegram';

interface Message {
  role: 'user' | 'void';
  text: string;
}

interface ChatThreadProps {
  messages: Message[];
  loading: boolean;
  onClarify: () => void;
  onNewQuestion: () => void;
}

export function ChatThread({ messages, loading, onClarify, onNewQuestion }: ChatThreadProps) {
  if (messages.length === 0 && !loading) return null;

  return (
    <div className="flex-1 px-5 py-6 space-y-6 overflow-y-auto">
      {messages.map((msg, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
        >
          {msg.role === 'user' ? (
            <div className="max-w-[80%] rounded-sm bg-foreground/10 px-4 py-3">
              <p className="text-[13px] leading-relaxed text-foreground">{msg.text}</p>
            </div>
          ) : (
            <div className="max-w-[90%]">
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground mb-3">
                Войд
              </p>
              <p className="text-[14px] leading-[1.8] text-foreground/90">{msg.text}</p>
            </div>
          )}
        </motion.div>
      ))}

      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-1.5 py-4"
        >
          <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Собираю ответ
          </span>
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1 w-1 rounded-full bg-muted-foreground"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </span>
        </motion.div>
      )}

      {/* Action buttons after last void message */}
      {!loading && messages.length > 0 && messages[messages.length - 1].role === 'void' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex gap-4 pt-2"
        >
          <button
            onClick={() => { haptic('light'); onClarify(); }}
            className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Ещё уточнить
          </button>
          <button
            onClick={() => { haptic('light'); onNewQuestion(); }}
            className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Новый вопрос
          </button>
        </motion.div>
      )}
    </div>
  );
}
