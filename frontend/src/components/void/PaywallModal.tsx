import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { haptic, hapticNotification, openLink } from '@/lib/telegram';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { SubscriptionConsent } from '@/components/SubscriptionConsent';

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
}

export function PaywallModal({ open, onClose }: PaywallModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [consented, setConsented] = useState(false);

  const handleSubscribe = async () => {
    if (!consented) return;
    haptic('medium');
    setLoading(true);
    try {
      const res = await api.createPayment('monthly_pro', consented);
      openLink(res.payment_url);
      onClose();
    } catch {
      hapticNotification('error');
      toast({ title: 'Не удалось открыть оплату', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-border bg-background max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[11px] font-medium uppercase tracking-[0.3em] text-foreground text-center">
            Вопросы закончились
          </DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed text-muted-foreground text-center pt-3">
            Оформи PRO — 20 вопросов каждый месяц и весь Звёздник целиком.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-4">
          <SubscriptionConsent checked={consented} onChange={setConsented} />
          <button
            onClick={handleSubscribe}
            disabled={loading || !consented}
            className="w-full bg-foreground text-background text-[11px] font-semibold uppercase tracking-[0.25em] py-4 hover:bg-foreground/90 transition-colors disabled:opacity-60"
          >
            {loading ? 'Открываем оплату…' : 'Подключить PRO · 299 ₽/мес'}
          </button>
          <button
            onClick={onClose}
            className="w-full text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground py-3 hover:text-foreground transition-colors"
          >
            Не сейчас
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
