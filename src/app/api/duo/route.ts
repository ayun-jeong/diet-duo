import { NextRequest, NextResponse } from "next/server";
import { db, DB_DISABLED_RESPONSE } from "@/lib/server/db";
import { ensureAppUser, getSessionUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function makeCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadDuo(userId: string): Promise<any | null> {
  const { data } = await db!
    .from("couples")
    .select("id, status, invite_code, user_a, user_b")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function toDuoInfo(userId: string, duo: any) {
  const isInitiator = duo.user_a === userId;
  const partnerId: string | undefined = isInitiator
    ? duo.user_b ?? undefined
    : duo.user_a;

  let partnerName: string | undefined;
  if (partnerId) {
    // display_name 은 app_users 에 있다.
    // (구 코드는 /api/partner/today 에서 user_profiles 를 조회해 항상 비어 있었다.)
    const { data } = await db!
      .from("app_users")
      .select("display_name")
      .eq("id", partnerId)
      .maybeSingle();
    partnerName = data?.display_name || undefined;
  }

  return {
    id: duo.id as string,
    status: duo.status as "pending" | "active",
    inviteCode: duo.invite_code as string,
    partnerId,
    partnerName,
    isInitiator,
  };
}

/** GET /api/duo — 현재 연결 상태 */
export async function GET() {
  if (!db) return NextResponse.json(DB_DISABLED_RESPONSE, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const duo = await loadDuo(user.id);
  return NextResponse.json({ duo: duo ? await toDuoInfo(user.id, duo) : null });
}

/** POST /api/duo — { action: "create" } 초대 생성 / { action: "accept", code } 수락 */
export async function POST(req: NextRequest) {
  if (!db) return NextResponse.json(DB_DISABLED_RESPONSE, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: string; code?: string };
  try {
    body = (await req.json()) as { action?: string; code?: string };
  } catch {
    return NextResponse.json({ error: "잘못된 JSON 본문" }, { status: 400 });
  }

  // couples 가 app_users(id) 를 참조하므로 양쪽 행이 먼저 있어야 한다.
  await ensureAppUser(user);

  if (body.action === "create") {
    const existing = await loadDuo(user.id);
    if (existing?.status === "active") {
      return NextResponse.json({ error: "이미 연결된 메이트가 있습니다." }, { status: 409 });
    }
    // 대기 중인 내 초대가 있으면 코드를 재사용한다.
    if (existing?.status === "pending" && existing.user_a === user.id) {
      return NextResponse.json({ duo: await toDuoInfo(user.id, existing) });
    }

    const { data, error } = await db
      .from("couples")
      .insert({ user_a: user.id, invite_code: makeCode() })
      .select("id, status, invite_code, user_a, user_b")
      .single();

    if (error) {
      console.error("[duo] create:", error);
      return NextResponse.json({ error: "초대 코드 생성에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ duo: await toDuoInfo(user.id, data) });
  }

  if (body.action === "accept") {
    const code = (body.code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      return NextResponse.json({ error: "유효하지 않은 코드입니다." }, { status: 400 });
    }

    const mine = await loadDuo(user.id);
    if (mine?.status === "active") {
      return NextResponse.json({ error: "이미 연결된 메이트가 있습니다." }, { status: 409 });
    }

    // user_b is null 조건을 UPDATE 문 안에 두어, 두 사람이 동시에 같은 코드를
    // 입력해도 한 명만 성공하도록 한다.
    const { data, error } = await db
      .from("couples")
      .update({ user_b: user.id, status: "active" })
      .eq("invite_code", code)
      .eq("status", "pending")
      .is("user_b", null)
      .neq("user_a", user.id)
      .select("id, status, invite_code, user_a, user_b")
      .maybeSingle();

    if (error) {
      console.error("[duo] accept:", error);
      return NextResponse.json({ error: "연결 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "유효하지 않거나 이미 사용된 코드입니다." },
        { status: 404 },
      );
    }

    // 내가 만들어 둔 대기 중 초대는 정리한다.
    if (mine?.status === "pending" && mine.user_a === user.id) {
      await db.from("couples").delete().eq("id", mine.id);
    }

    return NextResponse.json({ duo: await toDuoInfo(user.id, data) });
  }

  return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
}

/**
 * DELETE /api/duo — 연결 해제.
 *
 * 구 클라이언트는 duoId 만 받아 그대로 삭제했고 소유권 검사는 (깨져 있던) RLS 에
 * 의존했다. 여기서는 세션 사용자가 당사자인 건만 지운다.
 */
export async function DELETE() {
  if (!db) return NextResponse.json(DB_DISABLED_RESPONSE, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await db
    .from("couples")
    .delete()
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

  if (error) {
    console.error("[duo] delete:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
