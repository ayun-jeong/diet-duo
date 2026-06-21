import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthState {
  user: User | null;
  loading: boolean;
  authModalOpen: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setAuthModalOpen: (open: boolean) => void;
  initAuth: () => void;
  signInWithKakao: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: !!supabase,
  authModalOpen: false,

  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setAuthModalOpen: (open) => set({ authModalOpen: open }),

  initAuth: () => {
    if (!supabase) {
      set({ loading: false });
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ user: session?.user ?? null, loading: false });
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, loading: false });
    });
  },

  signInWithKakao: async () => {
    if (!supabase) return "Supabase가 설정되지 않았습니다.";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return error ? error.message : null;
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  },
}));
