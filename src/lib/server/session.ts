import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "./db";

export interface SessionUser {
  id: string;
  name: string;
}

/** NextAuth 세션에서 사용자 식별 (미로그인 시 null) */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  return { id, name: session?.user?.name ?? "" };
}

/**
 * app_users 행을 보장한다.
 *
 * couples·day_logs 가 app_users(id) 를 참조하므로 첫 쓰기 전에 반드시 필요하고,
 * 동시에 카카오 닉네임을 display_name 에 반영해 파트너 화면에 이름이 뜨게 한다.
 * (기존 구현은 display_name 을 어디에서도 쓰지 않아 항상 "파트너"로 표시됐다.)
 */
export async function ensureAppUser(user: SessionUser): Promise<void> {
  if (!db) return;
  // 닉네임이 비어 있으면 기존 display_name 을 덮어쓰지 않는다.
  const payload: Record<string, unknown> = {
    id: user.id,
    updated_at: new Date().toISOString(),
  };
  if (user.name) payload.display_name = user.name;

  await db.from("app_users").upsert(payload, { onConflict: "id" });
}
