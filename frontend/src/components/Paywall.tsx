import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { haptic, hapticNotification } from '@/lib/telegram';
import { startProCheckout } from '@/lib/checkout';
import { useToast } from '@/hooks/use-toast';
import { MainScreenStarBackground } from '@/components/MainScreenStarBackground';
import { SubscriptionConsent } from '@/components/SubscriptionConsent';

type PaywallVariant = 'void' | 'longread';

interface PaywallProps {
  open: boolean;
  onClose: () => void;
  variant?: PaywallVariant;
}

const BENEFITS = [
  'Ежедневные персональные обзоры, которые помогают тысячам наших пользователей лучше понять день и спокойнее его проходить',
  'Глубокие лонгриды о твоих внутренних ограничениях, целях, ресурсе и связи с собой',
  'Вопросы к Вселенной — когда нужен конкретный ответ здесь и сейчас',
  'Смотри карты других людей и вашу совместимость',
  'Еженедельный большой персональный разбор важной темы по твоей натальной карте',
];

export function Paywall({ open, onClose }: PaywallProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [consented, setConsented] = useState(false);

  const handleClose = () => {
    haptic('light');
    onClose();
  };

  const handleSubscribe = async () => {
    if (!consented) return;
    haptic('medium');
    setLoading(true);
    try {
      await startProCheckout(consented);
      onClose();
    } catch {
      hapticNotification('error');
      toast({ title: 'Не удалось открыть оплату', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="paywall"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-0 z-[60] overflow-y-auto"
          style={{ backgroundColor: 'hsl(0 0% 4%)', color: 'hsl(0 0% 98%)' }}
        >
          <MainScreenStarBackground />

          <div className="relative z-10 min-h-screen flex flex-col px-6 pt-6 pb-8">
            {/* Close */}
            <button
              onClick={handleClose}
              aria-label="Закрыть"
              className="self-start h-9 w-9 rounded-full flex items-center justify-center transition-colors"
              style={{ backgroundColor: 'hsl(0 0% 100% / 0.08)' }}
            >
              <X className="h-4 w-4" style={{ color: 'hsl(0 0% 98%)' }} />
            </button>

            {/* Header */}
            <div className="mt-6">
              <h1
                className="text-[36px] leading-[1.05] tracking-tight"
                style={{ fontFamily: '"Cormorant Garamond", "Times New Roman", serif', fontWeight: 400 }}
              >
                Открой
                <br />
                Pro-Star
              </h1>
            </div>

            {/* Benefits */}
            <ul className="mt-8 space-y-4 max-w-md">
              {BENEFITS.map((b, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex items-start gap-3"
                >
                  <span
                    className="mt-[3px] text-[12px] leading-none"
                    style={{ color: 'hsl(0 0% 98%)' }}
                    aria-hidden
                  >
                    ✦
                  </span>
                  <span
                    className="text-[13px] leading-[1.45]"
                    style={{ color: 'hsl(0 0% 92%)' }}
                  >
                    {b}
                  </span>
                </motion.li>
              ))}
            </ul>

            {/* Spacer */}
            <div className="flex-1 min-h-[40px]" />

            {/* Plan + CTA */}
            <div className="mt-10 space-y-3">
              <div
                className="w-full px-5 py-4 flex items-center justify-between"
                style={{
                  border: '1px solid hsl(0 0% 100%)',
                  boxShadow: '0 0 24px hsl(0 0% 100% / 0.08)',
                }}
              >
                <span
                  className="text-[11px] font-medium uppercase tracking-[0.3em]"
                  style={{ color: 'hsl(0 0% 98%)' }}
                >
                  Месяц
                </span>
                <span
                  className="text-[15px]"
                  style={{ color: 'hsl(0 0% 98%)', fontVariantNumeric: 'tabular-nums' }}
                >
                  199 ₽
                </span>
              </div>

              <SubscriptionConsent checked={consented} onChange={setConsented} />

              <button
                onClick={handleSubscribe}
                disabled={loading || !consented}
                className="w-full py-4 text-[12px] font-semibold uppercase tracking-[0.3em] transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: 'hsl(0 0% 98%)', color: 'hsl(0 0% 4%)' }}
              >
                {loading ? 'Открываем оплату…' : 'Подключить'}
              </button>

              <p
                className="text-center text-[10px] uppercase tracking-[0.2em] pt-1"
                style={{ color: 'hsl(0 0% 60%)' }}
              >
                Автопродление, отмена в любой момент
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
