import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { setStorage, SupabaseAdapter, LocalStorageAdapter } from "./storage";
import { useDiet, todayStr } from "./store";

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

async function switchToSupabase(userId: string) {
  if (!supabase) return;

  const sbAdapter = new SupabaseAdapter(supabase, userId);
  const lsAdapter = new LocalStorageAdapter();

  // Supabase에 프로필이 없으면 localStorage 데이터를 마이그레이션
  const sbProfile = await sbAdapter.getProfile();
  if (!sbProfile) {
    const [lsProfile, lsSettings, lsFavorites, lsLog] = await Promise.all([
      lsAdapter.getProfile(),
      lsAdapter.getSettings(),
      lsAdapter.getFavorites(),
      lsAdapter.getDayLog(todayStr()),
    ]);
    await Promise.all([
      lsProfile ? sbAdapter.saveProfile(lsProfile) : Promise.resolve(),
      lsSettings ? sbAdapter.saveSettings(lsSettings) : Promise.resolve(),
      lsFavorites.length > 0 ? sbAdapter.saveFavorites(lsFavorites) : Promise.resolve(),
      lsLog ? sbAdapter.saveDayLog(lsLog) : Promise.resolve(),
    ]);
  }

  setStorage(sbAdapter);
  // 새 어댑터로 store 데이터 다시 로드
  await useDiet.getState().init();
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

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await switchToSupabase(session.user.id);
        set({ user: session.user, loading: false });
      } else {
        set({ user: null, loading: false });
      }
    });

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await switchToSupabase(session.user.id);
        set({ user: session.user, loading: false });
      } else {
        setStorage(new LocalStorageAdapter());
        await useDiet.getState().init();
        set({ user: null, loading: false });
      }
    });
  },

  signInWithKakao: async () => {
    if (!supabase) return "Supabase가 설정되지 않았습니다.";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "profile_nickname profile_image",
      },
    });
    return error ? error.message : null;
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setStorage(new LocalStorageAdapter());
    await useDiet.getState().init();
  },
}));
