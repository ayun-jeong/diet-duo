import { NextRequest, NextResponse } from "next/server";
import { db, DB_DISABLED_RESPONSE } from "@/lib/server/db";
import { ensureAppUser, getSessionUser } from "@/lib/server/session";
import { dayLogToRow, isValidDate, rowToDayLog } from "@/lib/server/rows";
import { MEAL_TYPES, normalizeDayLog } from "@/lib/types";
import type { DayLog } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 클라이언트가 보지 못한 제안을 되살린다.
 *
 * 저장된 행에는 있는데 들어온 본문에는 없고, pending 이면서 남이 보낸 항목만
 * 대상이다. 세 조건을 모두 걸어야 사용자가 방금 지운 자기 음식까지 되살아나는
 * 일이 없다 — 자기 음식에는 sharedFrom 이 없고, 담기를 누른 항목은 pending 이
 * false 로 남아 여기 걸리지 않는다.
 */
async function preservePending(userId: string, next: DayLog): Promise<DayLog> {
  const { data, error } = await db!
    .from("day_logs")
    .select("meals, water_ml, steps, exercises, weight_kg")
    .eq("user_id", userId)
    .eq("date", next.date)
    .maybeSingle();

  // 못 읽었으면 저장을 막지는 않는다. 제안 보존은 부가 기능이다.
  if (error || !data) return next;

  const stored = rowToDayLog(next.date, data);
  if (!stored) return next;

  let restored = 0;
  const meals = { ...next.meals };
  for (const meal of MEAL_TYPES) {
    const incoming = next.meals[meal] ?? [];
    const seen = new Set(incoming.map((f) => f.id));
    const missed = (stored.meals[meal] ?? []).filter(
      (f) => f.pending === true && f.sharedFrom && !seen.has(f.id),
    );
    if (missed.length) {
      meals[meal] = [...incoming, ...missed];
      restored += missed.length;
    }
  }

  return restored ? { ...next, meals } : next;
}

/** GET /api/day-log?date=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  if (!db) return NextResponse.json(DB_DISABLED_RESPONSE, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date");
  if (!isValidDate(date)) {
    return NextResponse.json({ error: "잘못된 date 파라미터" }, { status: 400 });
  }

  const { data, error } = await db
    .from("day_logs")
    .select("meals, water_ml, steps, exercises, weight_kg")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  if (error) {
    console.error("[day-log] select:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dayLog: rowToDayLog(date, data) });
}

/** PUT /api/day-log — 하루 기록 전체 저장 */
export async function PUT(req: NextRequest) {
  if (!db) return NextResponse.json(DB_DISABLED_RESPONSE, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { dayLog?: DayLog };
  try {
    body = (await req.json()) as { dayLog?: DayLog };
  } catch {
    return NextResponse.json({ error: "잘못된 JSON 본문" }, { status: 400 });
  }

  const raw = body.dayLog;
  if (!raw || !isValidDate(raw.date)) {
    return NextResponse.json({ error: "dayLog.date 가 필요합니다" }, { status: 400 });
  }

  // day_logs.user_id 가 app_users(id) 를 참조하므로 행 존재를 먼저 보장한다.
  await ensureAppUser(user);

  const safe = normalizeDayLog(raw.date, raw);

  /*
   * 메이트가 보낸 제안 지키기.
   *
   * 이 라우트는 클라이언트 메모리에 있는 하루를 통째로 덮어쓴다. 그런데 제안은
   * 상대가 내 행에 직접 써 넣으므로, 내가 앱을 열어 둔 사이 도착한 제안은 내
   * 스냅샷에 없다. 그 상태로 물 한 컵만 눌러도 제안이 화면에 뜬 적도 없이
   * 사라진다. 본문에 없는 pending 제안만 골라 되돌려 놓는다.
   */
  const merged = await preservePending(user.id, safe);

  const { error } = await db
    .from("day_logs")
    .upsert(dayLogToRow(user.id, merged), { onConflict: "user_id,date" });

  if (error) {
    console.error("[day-log] upsert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
