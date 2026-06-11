import { openLink } from '@/lib/telegram';

interface SubscriptionConsentProps {
  checked: boolean;
  onChange: (value: boolean) => void;
}

// Recurring-charge consent. Robokassa requires it shown before payment, not
// pre-checked, with a clickable link to the offer and the charge frequency.
export function SubscriptionConsent({ checked, onChange }: SubscriptionConsentProps) {
  return (
    <div className="flex items-start gap-2.5 text-left">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-foreground"
      />
      <span className="text-[11px] leading-[1.5] text-muted-foreground">
        Я согласен на автоматические ежемесячные списания 199&nbsp;₽ согласно{' '}
        <button
          type="button"
          onClick={() => openLink(`${window.location.origin}/oferta`)}
          className="underline text-foreground"
        >
          условиям оферты
        </button>
        . Отменить подписку можно в любой момент в профиле.
      </span>
    </div>
  );
}
