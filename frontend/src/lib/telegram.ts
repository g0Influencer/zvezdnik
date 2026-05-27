// Telegram WebApp SDK helpers

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
          start_param?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
        };
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        colorScheme: 'light' | 'dark';
        viewportHeight: number;
        viewportStableHeight: number;
      };
    };
  }
}

export const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

export function getTelegramUser() {
  return tg?.initDataUnsafe?.user;
}

// Priority:
// 1. Real Telegram initData (signed with HMAC) — when running inside Telegram WebApp
// 2. Dev-fake initData — when running in regular browser during development
// 3. Empty — production browser outside Telegram (auth will fail, as designed)
export function getInitData() {
  if (tg?.initData && tg.initData.length > 0) {
    return tg.initData;
  }
  if (import.meta.env.DEV) {
    const fakeUser = encodeURIComponent(
      JSON.stringify({
        id: 123456789,
        username: 'devuser',
        first_name: 'Dev',
      }),
    );
    return `user=${fakeUser}&hash=dev-fake`;
  }
  return '';
}

export function getStartParam() {
  return tg?.initDataUnsafe?.start_param;
}

export function haptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  tg?.HapticFeedback?.impactOccurred(type);
}

export function hapticNotification(type: 'success' | 'error' | 'warning' = 'success') {
  tg?.HapticFeedback?.notificationOccurred(type);
}

export function isTelegramWebApp(): boolean {
  return !!tg?.initData;
}
