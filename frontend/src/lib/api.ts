import { getInitData } from './telegram';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export interface UserProfile {
  display_name: string;
  sun_sign: string;
  ascendant_sign: string;
  birth_date: string;
  birth_place: string;
  gender: 'male' | 'female' | null;
  style: 'gentle' | 'blunt';
  focus: string;
  personalization: Record<string, unknown> | null;
  pro_status: 'free' | 'active' | 'expired';
  pro_activated_at: string | null;
  trial_ends_at: string | null;
  push_enabled: boolean;
}

export interface VoidEntry {
  id: number;
  user_id: number;
  question: string;
  answer: string;
  created_at: string;
}

export interface VoidCredits {
  remaining: number;
  is_pro: boolean;
}

export interface VoidHistory {
  entries: VoidEntry[];
  remaining: number;
  is_pro: boolean;
}

export interface DailyPayload {
  date: string;
  title: string;
  short_description: string;
  full_description: string;
  do: string[];
  dont: string[];
  has_longread: boolean;
}

export interface ChartData {
  svg: string;
  ascendant: string;
  chart_shape: string;
  chart_shape_ru: string;
  planets: {
    name: string;
    name_en: string;
    sign: string;
    sign_ru: string;
    house: number;
    degree: string;
    retro: boolean;
  }[];
  aspect_patterns: unknown;
  portrait: string;
  portrait_status: string;
}

export interface PaymentResult {
  payment_url: string;
  payment_id: string;
}

export interface CompatibilitySection {
  id: string;
  title: string;
  text: string;
}

export interface CompatibilityResult {
  title: string;
  shortDescription: string;
  compatibilityScore: number;
  compatibilityLabel: string;
  sections: CompatibilitySection[];
  dos: string[];
  donts: string[];
}

export interface CompatibilityCardSummary {
  id: number;
  other_birth_date: string;
  other_birth_time: string | null;
  other_birth_place: string | null;
  other_gender: 'female' | 'male';
  include_love: boolean;
  title: string | null;
  compatibility_score: number | null;
  compatibility_label: string | null;
  created_at: string;
}

export interface CompatibilityCard extends CompatibilityCardSummary {
  user_id: number;
  result: CompatibilityResult;
}

export interface CompatibilityCredits {
  remaining: number;
  is_pro: boolean;
}

export interface CompatibilityHistory {
  cards: CompatibilityCardSummary[];
  remaining: number;
  is_pro: boolean;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': getInitData(),
    'ngrok-skip-browser-warning': '1',
  };

  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();

  if (!res.ok || json.error) {
    const err = json.error || { code: 'UNKNOWN', message: res.statusText };
    const error = new Error(err.message) as Error & { code: string };
    error.code = err.code;
    throw error;
  }

  return json.data as T;
}

export const api = {
  // Onboarding
  onboarding: (data: {
    birth_date: string;
    birth_time: string;
    birth_place: string;
    birth_lat: number;
    birth_lon: number;
    gender: 'male' | 'female' | '';
    style: string;
    focus: string;
    personalization?: Record<string, unknown>;
  }) => request<{ status: string; natal_ready: boolean; portrait_ready: boolean }>('POST', '/onboarding', data),

  // Today
  getToday: () => request<DailyPayload>('GET', '/today'),
  getLongread: () => request<unknown>('GET', '/today/longread'),

  // Void (Вопросы вселенной)
  askVoid: (question: string) =>
    request<{ entry: VoidEntry; remaining: number }>('POST', '/void/ask', { question }),
  getVoidCredits: () => request<VoidCredits>('GET', '/void/credits'),
  getVoidHistory: () => request<VoidHistory>('GET', '/void'),
  deleteVoidEntry: (id: number) =>
    request<{ deleted: boolean }>('DELETE', `/void/${id}`),

  // Chart
  getChart: () => request<ChartData>('GET', '/chart'),

  // Profile
  getProfile: () => request<UserProfile>('GET', '/profile'),
  updateProfile: (data: Partial<{
    style: string;
    focus: string;
    display_name: string;
    pro_status: 'free' | 'active';
    personalization: Record<string, unknown>;
    push_enabled: boolean;
  }>) => request<{ user: UserProfile }>('PATCH', '/profile', data),

  // Payments
  createPayment: (product: string, consent?: boolean) =>
    request<PaymentResult>('POST', '/payments/create', { product, consent }),

  // Compatibility
  getCompatibilityCredits: () =>
    request<CompatibilityCredits>('GET', '/compatibility/credits'),
  getCompatibilityHistory: () =>
    request<CompatibilityHistory>('GET', '/compatibility'),
  getCompatibilityCard: (id: number) =>
    request<CompatibilityCard>('GET', `/compatibility/${id}`),
  generateCompatibility: (data: {
    other_birth_date: string;
    other_birth_time: string | null;
    other_birth_place: string | null;
    other_gender: 'female' | 'male';
    include_love: boolean;
  }) =>
    request<{ card: CompatibilityCard; remaining: number }>(
      'POST',
      '/compatibility/generate',
      data,
    ),
};
