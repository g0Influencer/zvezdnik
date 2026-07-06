import { api } from '@/lib/api';
import { openLink } from '@/lib/telegram';
import { reachGoal } from '@/lib/metrika';

// Set when the user leaves for the Robokassa payment page; checked on the next
// app load so subscription_activated is attributed once PRO shows up active.
export const PENDING_PAYMENT_KEY = 'zvezdnik-pending-payment';

/**
 * Creates a PRO checkout and opens the Robokassa payment page.
 * Throws on API failure — callers keep their own toast/error handling.
 */
export async function startProCheckout(consent: boolean): Promise<void> {
  const res = await api.createPayment('monthly_pro', consent);
  reachGoal('payment_open');
  try {
    localStorage.setItem(PENDING_PAYMENT_KEY, '1');
  } catch { /* noop */ }
  openLink(res.payment_url);
}
