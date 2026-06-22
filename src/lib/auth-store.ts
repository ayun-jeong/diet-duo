import { create } from "zustand";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { setStorage, LocalStorageAdapter } from "./storage";
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
    setStorage(new LocalStorageAdapter());
    await useDiet.getState().init();
    await nextAuthSignOut({ callbackUrl: "/" });
  },
}));
