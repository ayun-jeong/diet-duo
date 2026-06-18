"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-store";
import { setStorage, SupabaseAdapter, LocalStorageAdapter } from "@/lib/storage";
import { useDiet } from "@/lib/store";

export default function Providers({ children }: { children: React.ReactNode }) {
  const setUser = useAuth((s) => s.setUser);
  const setLoading = useAuth((s) => s.setLoading);

  useEffect(() => {
    if (!supabase) {
      // Supabase 미설정 → localStorage 모드, auth 로딩 완료
      setUser(null);
      return;
    }

    // 페이지 로드 시 기존 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setStorage(new SupabaseAdapter(supabase as any, session.user.id));
        setUser(session.user);
        useDiet.getState().init();
      } else {
        setUser(null);
      }
    });

    // 로그인/로그아웃 이벤트 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setStorage(new SupabaseAdapter(supabase as any, session.user.id));
        setUser(session.user);
        if (event === "SIGNED_IN") {
          await useDiet.getState().init();
        }
      } else {
        setStorage(new LocalStorageAdapter());
        setUser(null);
        if (event === "SIGNED_OUT") {
          setLoading(false);
          await useDiet.getState().init();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setLoading]);

  return <>{children}</>;
}
