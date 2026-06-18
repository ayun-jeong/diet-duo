import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

function toKorean(msg: string): string {
  if (!msg) return msg;
  if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials"))
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (msg.includes("Email not confirmed"))
    return "EMAIL_NOT_CONFIRMED";
  if (msg.includes("User already registered") || msg.includes("already registered"))
    return "이미 가입된 이메일입니다.";
  if (msg.includes("Password should be at least"))
    return "비밀번호는 6자 이상이어야 합니다.";
  if (msg.includes("Unable to validate email") || msg.includes("invalid format"))
    return "올바른 이메일 형식이 아닙니다.";
  if (msg.includes("Email rate limit"))
    return "이메일 전송 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.";
  if (msg.includes("signup_disabled"))
    return "현재 회원가입이 비활성화되어 있습니다.";
  return msg;
}

interface AuthState {
  user: User | null;
  /** 초기 세션 확인 전까지 true */
  loading: boolean;
  authModalOpen: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setAuthModalOpen: (open: boolean) => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, name: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  authModalOpen: false,

  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setAuthModalOpen: (open) => set({ authModalOpen: open }),

  signIn: async (email, password) => {
    if (!supabase) return "Supabase가 설정되지 않았습니다.";
    set({ loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false });
    return error ? toKorean(error.message) : null;
  },

  signUp: async (email, password, name) => {
    if (!supabase) return "Supabase가 설정되지 않았습니다.";
    set({ loading: true });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (!error && data.user && data.session) {
      // 이메일 확인 없이 바로 세션이 생긴 경우에만 테이블 삽입
      await Promise.all([
        supabase.from("user_display").insert({ id: data.user.id, display_name: name }),
        supabase.from("user_profiles").insert({ id: data.user.id }),
      ]);
    }
    set({ loading: false });
    return error ? toKorean(error.message) : null;
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  },
}));
