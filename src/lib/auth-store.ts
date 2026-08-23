import { create } from "zustand";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { setStorage, LocalStorageAdapter } from "./storage";
import { clearMirror, writeLastUserId } from "./mirror";
import { useDiet } from "./store";

export interface AppUser {
  id: string;
  name?: string | null;
  image?: string | null;
}

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  authModalOpen: boolean;
  setUser: (user: AppUser | null) => void;
  setLoading: (loading: boolean) => void;
  setAuthModalOpen: (open: boolean) => void;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  authModalOpen: false,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setAuthModalOpen: (open) => set({ authModalOpen: open }),

  signOut: async () => {
    // 로그아웃 시 이 기기에 남은 서버 데이터 캐시를 지운다.
    // (같은 브라우저를 다른 계정이 쓸 때 이전 사용자 기록이 잠깐 보이는 것을 막는다.)
    const { user } = useAuth.getState();
    if (user) clearMirror(user.id);
    writeLastUserId(null);

    set({ user: null });
    setStorage(new LocalStorageAdapter());
    await useDiet.getState().reset();
    await nextAuthSignOut({ callbackUrl: "/" });
  },
}));
