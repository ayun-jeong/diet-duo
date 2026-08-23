import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 서버 전용 Supabase 클라이언트 (service_role).
 *
 * service_role 키는 RLS 를 우회하므로 절대 클라이언트 번들에 들어가면 안 된다.
 * NEXT_PUBLIC_ 접두사가 없는 환경변수만 사용하며, 아래 가드로 브라우저 유입을 막는다.
 */
if (typeof window !== "undefined") {
  throw new Error("src/lib/server/db.ts 는 서버에서만 import 할 수 있습니다.");
}

const url = process.env.SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const db: SupabaseClient | null =
  url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

/** DB 미설정 시 localStorage 전용 모드로 동작하므로 라우트는 503 을 돌려준다. */
export const DB_DISABLED_RESPONSE = {
  error: "서버 DB가 설정되지 않았습니다 (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
} as const;
