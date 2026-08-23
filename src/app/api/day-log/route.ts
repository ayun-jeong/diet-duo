import { NextRequest, NextResponse } from "next/server";
import { db, DB_DISABLED_RESPONSE } from "@/lib/server/db";
import { ensureAppUser, getSessionUser } from "@/lib/server/session";
import { dayLogToRow, isValidDate, rowToDayLog } from "@/lib/server/rows";
import { normalizeDayLog } from "@/lib/types";
import type { DayLog } from "@/lib/types";

export const dynamic = "force-dynamic";

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
    .select("meals, water_ml, memo, steps, exercises, weight_kg")
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
  const { error } = await db
    .from("day_logs")
    .upsert(dayLogToRow(user.id, safe), { onConflict: "user_id,date" });

  if (error) {
    console.error("[day-log] upsert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
