import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Profile } from '../types';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  streamToken: string | null;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setStreamToken: (token: string | null) => void;
  setInitialized: (value: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      streamToken: null,
      isInitialized: false,
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setStreamToken: (streamToken) => set({ streamToken }),
      setInitialized: (isInitialized) => set({ isInitialized }),
      clearAuth: () => set({ user: null, profile: null, streamToken: null }),
    }),
    {
      name: 'nomadmeet-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // isInitialized is transient — never persist it
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        streamToken: state.streamToken,
      }),
    },
  ),
);
