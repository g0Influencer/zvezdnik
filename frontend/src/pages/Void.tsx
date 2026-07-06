import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BottomNav } from '@/components/BottomNav';
import { VoidHeader } from '@/components/void/VoidHeader';
import { PromptChips } from '@/components/void/PromptChips';
import { ChatThread } from '@/components/void/ChatThread';
import { InputBar } from '@/components/void/InputBar';
import { PaywallModal } from '@/components/void/PaywallModal';
import { VoidHistory } from '@/components/void/VoidHistory';
import { VoidOnboardingOverlay, useVoidOnboarding } from '@/components/void/VoidOnboarding';
import { api, VoidEntry } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { reachGoal } from '@/lib/metrika';

interface ChatMessage {
  role: 'user' | 'void';
  text: string;
}

export default function Void() {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<VoidEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { hasSeen: hasSeenOnboarding, dismiss: dismissOnboarding } = useVoidOnboarding();

  const loadHistory = () => {
    api.getVoidHistory()
      .then((res) => {
        setHistory(res.entries);
        setRemaining(res.remaining);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadHistory();
    reachGoal('universe_open');
    // Longreads (InteractiveNatalChart) hand off a suggested question via
    // sessionStorage — prefill the input so the user lands ready to send.
    try {
      const prefill = sessionStorage.getItem('void_prefill');
      if (prefill) {
        setInput(prefill);
        sessionStorage.removeItem('void_prefill');
      }
    } catch { /* noop */ }
  }, []);

  const handleSend = async () => {
    const question = input.trim();
    if (!question) return;

    if (remaining <= 0) {
      setPaywallOpen(true);
      return;
    }

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const res = await api.askVoid(question);
      setMessages((prev) => [...prev, { role: 'void', text: res.entry.answer }]);
      setRemaining(res.remaining);
      reachGoal('universe_question_submit');
      loadHistory();
    } catch (e: any) {
      if (e.code === 'PRO_REQUIRED') {
        setPaywallOpen(true);
        setRemaining(0);
      } else {
        toast({ title: 'Не удалось получить ответ', variant: 'destructive' });
      }
      if (e.code !== 'PRO_REQUIRED') {
        setMessages((prev) => prev.slice(0, -1));
        setInput(question);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChipSelect = (question: string) => {
    setInput(question);
  };

  const handleClarify = () => {
    setInput('Расскажи подробнее — ');
  };

  const handleNewQuestion = () => {
    setMessages([]);
    setInput('');
  };

  const handleHistorySelect = (question: string, answer: string) => {
    const msgs: ChatMessage[] = [{ role: 'user', text: question }];
    if (answer) {
      msgs.push({ role: 'void', text: answer });
    }
    setMessages(msgs);
  };

  const showIntro = messages.length === 0 && !loading;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <VoidHeader onHistoryOpen={() => setHistoryOpen(true)} />

      <div className="flex-1 flex flex-col pb-[140px]" ref={scrollRef}>
        {showIntro && (
          <div className="px-5 pt-4">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground mb-4"
            >
              Задай вопрос
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-[14px] leading-[1.75] text-muted-foreground/70 mb-8 max-w-[320px]"
            >
              Сформулируй вопрос — и получишь ответ, собранный по твоей карте и текущему небу.
            </motion.p>
          </div>
        )}

        {showIntro && <PromptChips onSelect={handleChipSelect} />}

        <ChatThread
          messages={messages}
          loading={loading}
          onClarify={handleClarify}
          onNewQuestion={handleNewQuestion}
        />
      </div>

      <InputBar
        value={input}
        onChange={setInput}
        onSend={handleSend}
        remaining={remaining}
        loading={loading}
        onPaywall={() => setPaywallOpen(true)}
      />

      <BottomNav />

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />

      <VoidHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        items={history}
        onSelect={handleHistorySelect}
      />

      {!hasSeenOnboarding && <VoidOnboardingOverlay onDismiss={dismissOnboarding} />}
    </div>
  );
}
