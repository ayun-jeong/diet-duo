"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-store";
import { setStorage, SupabaseAdapter, LocalStorageAdapter } from "@/lib/storage";
import { useDiet, todayStr } from "@/lib/store";
import type { AppUser } from "@/lib/auth-store";

function AuthSync() {
  const { data: session, status } = useSession();
  const setUser = useAuth((s) => s.setUser);
  const setLoading = useAuth((s) => s.setLoading);

  useEffect(() => {
    if (status === "loading") return;

    const sync = async () => {
      if (status === "authenticated" && session?.user) {
        const userId = (session.user as AppUser & { id: string }).id;
        const appUser: AppUser = { id: userId, name: session.user.name, image: session.user.image };

        if (supabase) {
          const sbAdapter = new SupabaseAdapter(supabase, userId);
          const lsAdapter = new LocalStorageAdapter();

          // 처음 로그인 시 localStorage → Supabase 마이그레이션
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
        }

        setUser(appUser);
        await useDiet.getState().init();
      } else {
        setStorage(new LocalStorageAdapter());
        setUser(null);
        await useDiet.getState().init();
      }
      setLoading(false);
    };

    sync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, (session?.user as AppUser & { id?: string })?.id]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  // 모바일 번들 빌드 시 NEXT_PUBLIC_NEXTAUTH_URL로 크로스 오리진 세션 체크
  const nextAuthBase = process.env.NEXT_PUBLIC_NEXTAUTH_URL;
  const basePath = nextAuthBase ? `${nextAuthBase}/api/auth` : undefined;

  return (
    <SessionProvider basePath={basePath}>
      <AuthSync />
      {children}
    </SessionProvider>
  );
}
