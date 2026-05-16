import { create } from 'zustand';
import { User, Claim } from '@/constants/types';

interface AppState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  claims: Claim[];
  trendingClaims: Claim[];
  hasCompletedOnboarding: boolean;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setClaims: (claims: Claim[]) => void;
  setTrendingClaims: (claims: Claim[]) => void;
  setHasCompletedOnboarding: (val: boolean) => void;
  logout: () => void;
  updateUserTier: (tier: 'free' | 'premium') => void;
  incrementChecksUsed: () => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  claims: [],
  trendingClaims: [],
  hasCompletedOnboarding: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setToken: (token) => set({ token }),
  setLoading: (isLoading) => set({ isLoading }),
  setClaims: (claims) => set({ claims }),
  setTrendingClaims: (trendingClaims) => set({ trendingClaims }),
  setHasCompletedOnboarding: (hasCompletedOnboarding) => set({ hasCompletedOnboarding }),
  logout: () => set({ user: null, token: null, isAuthenticated: false }),
  updateUserTier: (tier) =>
    set((state) => ({
      user: state.user ? { ...state.user, tier } : null,
    })),
  incrementChecksUsed: () =>
    set((state) => ({
      user: state.user
        ? { ...state.user, checksUsedToday: state.user.checksUsedToday + 1 }
        : null,
    })),
}));
