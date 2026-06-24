export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { DayLog } from "@/lib/types";
import { MEAL_TYPES, emptyDayLog } from "@/lib/types";

function maskPrivateItems(log: DayLog): DayLog {
  return {
    ...log,
    meals: Object.fromEntries(
      MEAL_TYPES.map((meal) => [
        meal,
        log.meals[meal].map((f) =>
          f.private ? { ...f, name: "비공개 음식", amount: "" } : f,
        ),
      ]),
    ) as DayLog["meals"],
  };
}

export async function GET(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 미설정" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 커플 조회
  const { data: couple } = await supabase
    .from("couples")
    .select("user_a, user_b")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .eq("status", "active")
    .maybeSingle();

  if (!couple) {
    return new NextResponse(null, { status: 204 });
  }

  const partnerId =
    couple.user_a === userId ? couple.user_b : couple.user_a;

  if (!partnerId) {
    return new NextResponse(null, { status: 204 });
  }

  // 파트너 닉네임 (user_profiles.display_name)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("id", partnerId)
    .maybeSingle();

  // 날짜
  const dateParam = req.nextUrl.searchParams.get("date");
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : new Date().toISOString().slice(0, 10);

  // 파트너 day_log
  const { data: logRow } = await supabase
    .from("day_logs")
    .select("meals, water_ml, memo, steps, exercises")
    .eq("user_id", partnerId)
    .eq("date", date)
    .maybeSingle();

  const rawLog: DayLog = logRow
    ? {
        date,
        meals: logRow.meals ?? emptyDayLog(date).meals,
        waterMl: logRow.water_ml ?? 0,
        memo: logRow.memo ?? "",
        steps: logRow.steps ?? 0,
        exercises: logRow.exercises ?? [],
      }
    : emptyDayLog(date);

  const masked = maskPrivateItems(rawLog);

  return NextResponse.json({
    ...masked,
    partnerName: profile?.display_name ?? "파트너",
  });
}
