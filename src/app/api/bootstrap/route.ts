import { NextRequest, NextResponse } from "next/server";
import { db, DB_DISABLED_RESPONSE } from "@/lib/server/db";
import { ensureAppUser, getSessionUser } from "@/lib/server/session";
import {
  isValidDate,
  rowToDayLog,
  rowToFavorites,
  rowToProfile,
  rowToSettings,
} from "@/lib/server/rows";

export const dynamic = "force-dynamic";

/**
 * GET /api/bootstrap?date=YYYY-MM-DD
 *
 * 프로필·설정·즐겨찾기·해당 날짜 기록을 한 번에 돌려준다.
 * 기존 구현은 로그인 직후 getProfile/getDayLog/getSettings/getFavorites 를
 * 각각 왕복시켜 4회 요청이 걸렸고, 그동안 화면이 "불러오는 중…"에 묶여 있었다.
 */
export async function GET(req: NextRequest) {
  if (!db) return NextResponse.json(DB_DISABLED_RESPONSE, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dateParam = req.nextUrl.searchParams.get("date");
  if (!isValidDate(dateParam)) {
    return NextResponse.json({ error: "잘못된 date 파라미터" }, { status: 400 });
  }

  await ensureAppUser(user);

  const [userRes, logRes] = await Promise.all([
    db
      .from("app_users")
      .select("height_cm, weight_kg, age, sex, activity, goal, settings, favorites")
      .eq("id", user.id)
      .maybeSingle(),
    db
      .from("day_logs")
      .select("meals, water_ml, memo, steps, exercises, weight_kg")
      .eq("user_id", user.id)
      .eq("date", dateParam)
      .maybeSingle(),
  ]);

  if (userRes.error) {
    console.error("[bootstrap] app_users:", userRes.error);
    return NextResponse.json({ error: userRes.error.message }, { status: 500 });
  }
  if (logRes.error) {
    console.error("[bootstrap] day_logs:", logRes.error);
    return NextResponse.json({ error: logRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    profile: rowToProfile(userRes.data),
    settings: rowToSettings(userRes.data),
    favorites: rowToFavorites(userRes.data),
    dayLog: rowToDayLog(dateParam, logRes.data),
  });
}
