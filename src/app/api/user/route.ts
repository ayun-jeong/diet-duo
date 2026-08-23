import { NextRequest, NextResponse } from "next/server";
import { db, DB_DISABLED_RESPONSE } from "@/lib/server/db";
import { ensureAppUser, getSessionUser } from "@/lib/server/session";
import { profileToRow } from "@/lib/server/rows";
import type { AppSettings, FavoriteFood, UserProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Body {
  profile?: UserProfile;
  settings?: AppSettings;
  favorites?: FavoriteFood[];
  memo?: string;
}

/** 메모 최대 길이 — 무제한 텍스트가 그대로 들어오지 않도록 자른다. */
const MEMO_MAX = 2000;

/**
 * PUT /api/user
 *
 * profile / settings / favorites 중 전달된 것만 부분 저장한다.
 *
 * 구 SupabaseAdapter 는 settings·favorites 를 `.update()` 로 저장했는데,
 * 프로필을 만든 적 없는 사용자는 행 자체가 없어 0건 매칭 → 에러도 없이 조용히 유실됐다.
 * 여기서는 항상 upsert 한다.
 */
export async function PUT(req: NextRequest) {
  if (!db) return NextResponse.json(DB_DISABLED_RESPONSE, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "잘못된 JSON 본문" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    id: user.id,
    updated_at: new Date().toISOString(),
  };
  if (user.name) payload.display_name = user.name;
  if (body.profile) Object.assign(payload, profileToRow(body.profile));
  if (body.settings) payload.settings = body.settings;
  if (Array.isArray(body.favorites)) payload.favorites = body.favorites;
  if (typeof body.memo === "string") payload.memo = body.memo.slice(0, MEMO_MAX);

  const { error } = await db.from("app_users").upsert(payload, { onConflict: "id" });
  if (error) {
    console.error("[user] upsert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** GET /api/user — app_users 행 보장 + 존재 확인 (커플 연결 전 호출) */
export async function GET() {
  if (!db) return NextResponse.json(DB_DISABLED_RESPONSE, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureAppUser(user);
  return NextResponse.json({ id: user.id, displayName: user.name });
}
