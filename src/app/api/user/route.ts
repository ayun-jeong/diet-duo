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

/**
 * 메모 저장 문자열의 최대 길이.
 *
 * 메모 여러 장이 JSON 배열로 직렬화돼 이 한 칸에 들어온다.
 * 길다고 잘라내면 JSON 이 깨져 메모 전체를 못 읽게 되므로, 자르지 않고 거절한다.
 * 클라이언트가 장수(20)와 장당 글자수(2000)를 이미 막고 있어 실제로 걸릴 일은 없다.
 */
const MEMO_MAX = 60000;

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
  /*
   * settings 는 jsonb 한 칸이라 통째로 교체된다. 그런데 보내는 쪽은 자기 메모리에
   * 있는 설정 전부를 싣고, 그 메모리는 부트스트랩 시점의 것이다. 다른 기기나
   * 오래 열어 둔 탭이 물 목표 하나만 저장해도 그 사이 켜 둔 shareScope 가 통째로
   * 사라진다 — 그리고 값이 없으면 전체 공개다. 지는 방향이 여는 방향이면 안 되므로
   * 서버에서 기존 값 위에 덮는다.
   */
  if (body.settings) {
    const { data: prev } = await db
      .from("app_users")
      .select("settings")
      .eq("id", user.id)
      .maybeSingle();
    const existing =
      prev?.settings && typeof prev.settings === "object" ? prev.settings : {};
    payload.settings = { ...existing, ...body.settings };
  }
  if (Array.isArray(body.favorites)) payload.favorites = body.favorites;
  if (typeof body.memo === "string") {
    if (body.memo.length > MEMO_MAX) {
      return NextResponse.json({ error: "메모가 너무 깁니다" }, { status: 400 });
    }
    payload.memo = body.memo;
  }

  const { error } = await db.from("app_users").upsert(payload, { onConflict: "id" });
  if (error) {
    console.error("[user] upsert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** GET /api/user — app_users 행 보장 + 존재 확인 (메이트 연결 전 호출) */
export async function GET() {
  if (!db) return NextResponse.json(DB_DISABLED_RESPONSE, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureAppUser(user);
  return NextResponse.json({ id: user.id, displayName: user.name });
}
