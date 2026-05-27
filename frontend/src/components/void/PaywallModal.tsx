import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { haptic } from '@/lib/telegram';

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
}

export function PaywallModal({ open, onClose }: PaywallModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-border bg-background max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[11px] font-medium uppercase tracking-[0.3em] text-foreground text-center">
            Вопросы закончились
          </DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed text-muted-foreground text-center pt-3">
            Хочешь продолжить — пополни пакет вопросов.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-4">
          <button
            onClick={() => {
              haptic('medium');
              // TODO: integrate payment
              onClose();
            }}
            className="w-full bg-foreground text-background text-[11px] font-semibold uppercase tracking-[0.25em] py-4 hover:bg-foreground/90 transition-colors"
          >
            Купить 10 вопросов
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
