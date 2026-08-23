import { NextRequest, NextResponse } from "next/server";
import { db, DB_DISABLED_RESPONSE } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/session";
import { isValidDate, rowToDayLog } from "@/lib/server/rows";
import { MEAL_TYPES, emptyDayLog } from "@/lib/types";
import type { DayLog } from "@/lib/types";

export const dynamic = "force-dynamic";

/** private 항목은 이름·양을 가리고 칼로리만 남긴다. */
function maskPrivateItems(log: DayLog): DayLog {
  const meals = {} as DayLog["meals"];
  for (const meal of MEAL_TYPES) {
    meals[meal] = (log.meals[meal] ?? []).map((f) =>
      f.private ? { ...f, name: "비공개 음식", amount: "" } : f,
    );
  }
  return { ...log, meals };
}

/** GET /api/partner/today?date=YYYY-MM-DD — 파트너의 하루 기록 (비공개 항목 마스킹) */
export async function GET(req: NextRequest) {
  if (!db) return NextResponse.json(DB_DISABLED_RESPONSE, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: couple } = await db
    .from("couples")
    .select("user_a, user_b")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .eq("status", "active")
    .maybeSingle();

  const partnerId = couple
    ? couple.user_a === user.id
      ? couple.user_b
      : couple.user_a
    : null;

  // 커플 미연결 → 204
  if (!partnerId) return new NextResponse(null, { status: 204 });

  const dateParam = req.nextUrl.searchParams.get("date");
  const date = isValidDate(dateParam)
    ? dateParam
    : new Date().toISOString().slice(0, 10);

  const [nameRes, logRes] = await Promise.all([
    // display_name 은 app_users 에 있다 (구 코드는 user_profiles 를 조회해 항상 null 이었다).
    db.from("app_users").select("display_name").eq("id", partnerId).maybeSingle(),
    db
      .from("day_logs")
      .select("meals, water_ml, steps, exercises, weight_kg")
      .eq("user_id", partnerId)
      .eq("date", date)
      .maybeSingle(),
  ]);

  const log = rowToDayLog(date, logRes.data) ?? emptyDayLog(date);

  return NextResponse.json({
    ...maskPrivateItems(log),
    // 파트너 체중은 공유하지 않는다.
    weightKg: undefined,
    partnerName: nameRes.data?.display_name || "파트너",
  });
}
