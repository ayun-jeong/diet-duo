"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-store";
import { setStorage, ApiAdapter, LocalStorageAdapter } from "@/lib/storage";
import { useDiet, todayStr } from "@/lib/store";
import type { AppUser } from "@/lib/auth-store";

/** localStorage → 서버 최초 1회 이관 여부 표시 */
const migratedKey = (userId: string) => `diet:migrated:${userId}`;

/**
 * 비로그인 상태에서 쌓인 localStorage 데이터를 서버로 한 번만 옮긴다.
 *
 * 이전 구현은 로그인할 때마다 서버 프로필을 먼저 조회하고, 없으면 4번 읽고
 * 4번 쓰는 동안 화면 전체를 막고 있었다. 이제 배경에서 1회만 수행한다.
 */
async function migrateOnce(userId: string, api: ApiAdapter): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(migratedKey(userId))) return;

  try {
    const local = new LocalStorageAdapter();
    const [serverData, localData] = await Promise.all([
      api.bootstrap(todayStr()),
      local.bootstrap(todayStr()),
    ]);

    // 서버에 이미 프로필이 있으면 로컬 데이터로 덮어쓰지 않는다.
    if (!serverData.profile) {
      await Promise.allSettled([
        localData.profile ? api.saveProfile(localData.profile) : Promise.resolve(),
        localData.settings ? api.saveSettings(localData.settings) : Promise.resolve(),
        localData.favorites.length ? api.saveFavorites(localData.favorites) : Promise.resolve(),
        localData.dayLog ? api.saveDayLog(localData.dayLog) : Promise.resolve(),
      ]);
    }
    window.localStorage.setItem(migratedKey(userId), "1");
  } catch (e) {
    // 실패해도 앱은 계속 동작한다. 다음 진입 때 다시 시도된다.
    console.error("[migrate] 실패:", e);
  }
}

function AuthSync() {
  const { data: session, status } = useSession();
  const setUser = useAuth((s) => s.setUser);
  const setLoading = useAuth((s) => s.setLoading);
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (status === "loading") return;

    const userId =
      status === "authenticated"
        ? (session?.user as AppUser & { id?: string })?.id ?? null
        : null;

    // 같은 상태로 다시 들어오면 재초기화하지 않는다 (중복 init 방지).
    if (lastUserId.current === userId) {
      setLoading(false);
      return;
    }
    lastUserId.current = userId;

    if (userId) {
      const api = new ApiAdapter();
      setStorage(api);
      setUser({
        id: userId,
        name: session?.user?.name ?? null,
        image: session?.user?.image ?? null,
      });
      // init 을 기다리지 않는다 — 캐시가 있으면 이미 화면이 그려져 있다.
      void useDiet.getState().init(userId);
      void migrateOnce(userId, api);
    } else {
      setStorage(new LocalStorageAdapter());
      setUser(null);
      void useDiet.getState().init(null);
    }

    setLoading(false);
  }, [status, session?.user, setUser, setLoading]);

  return null;
}

/**
 * 세션 확인보다 먼저 캐시로 화면을 그린다.
 * SessionProvider 바깥(위쪽)에 두어 useSession 대기와 무관하게 실행된다.
 */
function Hydrate() {
  useEffect(() => {
    useDiet.getState().hydrate();
  }, []);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  // 모바일 번들 빌드 시 NEXT_PUBLIC_NEXTAUTH_URL로 크로스 오리진 세션 체크
  const nextAuthBase = process.env.NEXT_PUBLIC_NEXTAUTH_URL;
  const basePath = nextAuthBase ? `${nextAuthBase}/api/auth` : undefined;

  return (
    <SessionProvider basePath={basePath}>
      <Hydrate />
      <AuthSync />
      {children}
    </SessionProvider>
  );
}
