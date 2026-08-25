import { NextRequest, NextResponse } from "next/server";
import { db, DB_DISABLED_RESPONSE } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/session";
import { getPartnerId } from "@/lib/server/partner";
import { isValidDate, rowToDayLog, rowToProfile, rowToSettings } from "@/lib/server/rows";
import { resolveTargets } from "@/lib/nutrition";
import { emptyDayLog, isWithinScope } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/partner/today?date=YYYY-MM-DD — 파트너의 하루 기록.
 *
 * 목표 칼로리·영양소는 함께 내려준다. 상대가 얼마나 먹었는지만 알고 목표를 모르면
 * 진행률을 그릴 수 없어 "많이 먹었다"를 판단할 기준이 사라진다.
 * 체중은 여전히 공유하지 않는다.
 *
 * 상대가 공개 범위를 좁혀 두었으면 그 밖의 날짜는 빈 기록으로 내려보낸다.
 * 여기서 204 를 쓰면 안 된다 — 클라이언트는 그것을 "연결 없음"으로 읽어
 * 연결 자체가 끊긴 것처럼 보인다.
 */
export async function GET(req: NextRequest) {
  if (!db) return NextResponse.json(DB_DISABLED_RESPONSE, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partnerId = await getPartnerId(user.id);

  // 메이트 미연결 → 204
  if (!partnerId) return new NextResponse(null, { status: 204 });

  const dateParam = req.nextUrl.searchParams.get("date");
  const date = isValidDate(dateParam)
    ? dateParam
    : new Date().toISOString().slice(0, 10);

  const [userRes, logRes] = await Promise.all([
    db
      .from("app_users")
      .select("display_name, height_cm, weight_kg, age, sex, activity, goal, settings")
      .eq("id", partnerId)
      .maybeSingle(),
    db
      .from("day_logs")
      .select("meals, water_ml, steps, exercises, weight_kg")
      .eq("user_id", partnerId)
      .eq("date", date)
      .maybeSingle(),
  ]);

  const log = rowToDayLog(date, logRes.data) ?? emptyDayLog(date);

  // 프로필을 아직 안 채웠으면 목표를 계산할 수 없다 — 그때는 null 로 두고
  // 화면이 진행률 대신 섭취량만 그리게 한다.
  const profile = rowToProfile(userRes.data);
  const settings = rowToSettings(userRes.data);
  const targets = profile ? resolveTargets(profile, settings ?? undefined) : null;

  // 상대가 정한 범위 밖이면 내용은 비우고, 왜 비었는지만 알려준다.
  const outOfScope = !isWithinScope(date, settings?.shareScope);

  return NextResponse.json({
    ...(outOfScope ? emptyDayLog(date) : log),
    outOfScope,
    // 파트너 체중은 공유하지 않는다.
    weightKg: undefined,
    partnerId,
    partnerName: userRes.data?.display_name || "메이트",
    targets,
    // 물 목표는 사람마다 다르므로 함께 내려준다 (내 목표로 상대 진행률을 그리면 틀린다).
    waterGoalMl: settings?.waterGoalMl ?? null,
  });
}
