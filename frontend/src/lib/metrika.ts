// Yandex.Metrika goal tracking.
// The counter is initialized lazily from main.tsx via initMetrika(),
// and is skipped entirely in dev builds so local pageviews don't pollute prod stats.

const COUNTER_ID = 108772645;

declare global {
  interface Window {
    ym?: YmFn;
  }
}

type YmFn = ((counterId: number, action: string, ...args: unknown[]) => void) & {
  a?: IArguments[];
  l?: number;
};

export type MetrikaGoal =
  | 'onboarding_open'
  | 'daily_advice_open'
  | 'daily_detail_open'
  | 'universe_open'
  | 'universe_question_submit'
  | 'longreads_open'
  | 'longread_natal_chart_open'
  | 'longread_inner_resource_open'
  | 'paywall_open'
  | 'subscription_activated';

/**
 * Injects the Yandex.Metrika tag.js loader and initializes the counter.
 * Only runs in production builds — dev mode skips entirely.
 * Idempotent: safe to call multiple times.
 */
export function initMetrika(): void {
  if (typeof window === 'undefined') return;
  if (!import.meta.env.PROD) return;

  const src = `https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}`;
  for (let i = 0; i < document.scripts.length; i++) {
    if (document.scripts[i].src === src) return; // already loaded
  }

  // Set up the queue stub before tag.js loads, so reachGoal() called early
  // gets buffered and flushed once the real ym() arrives.
  const w = window as Window & { ym?: YmFn };
  if (!w.ym) {
    const stub = function (this: unknown) {
      (stub.a = stub.a || []).push(arguments);
    } as YmFn;
    stub.l = Date.now();
    w.ym = stub;
  }

  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  document.head.appendChild(script);

  w.ym!(COUNTER_ID, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });
}

export function reachGoal(goal: MetrikaGoal | string, params?: Record<string, unknown>): void {
  try {
    if (typeof window === 'undefined') return;
    if (typeof window.ym !== 'function') return;
    if (params) {
      window.ym(COUNTER_ID, 'reachGoal', goal, params);
    } else {
      window.ym(COUNTER_ID, 'reachGoal', goal);
    }
  } catch (e) {
    console.warn('[metrika] reachGoal failed', goal, e);
  }
}
