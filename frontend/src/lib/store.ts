import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, DailyPayload } from './api';

interface AppState {
  user: UserProfile | null;
  daily: DailyPayload | null;
  isOnboarded: boolean;
  setUser: (user: UserProfile | null) => void;
  setDaily: (daily: DailyPayload | null) => void;
  setOnboarded: (v: boolean) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      daily: null,
      isOnboarded: false,
      setUser: (user) => set({ user }),
      setDaily: (daily) => set({ daily }),
      setOnboarded: (isOnboarded) => set({ isOnboarded }),
      logout: () => set({ user: null, daily: null, isOnboarded: false }),
    }),
    { name: 'zvezdnik-store' }
  )
);
