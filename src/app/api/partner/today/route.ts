import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { DayLog } from "@/lib/types";
import { MEAL_TYPES, emptyDayLog } from "@/lib/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function maskPrivateItems(log: DayLog): DayLog {
  return {
    ...log,
    meals: Object.fromEntries(
      MEAL_TYPES.map((meal) => [
        meal,
        log.meals[meal].map((f) =>
          f.private
            ? { ...f, name: "비공개 음식", amount: "" }
            : f,
        ),
      ]),
    ) as DayLog["meals"],
  };
}

export async function GET(req: NextRequest) {
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase 미설정" }, { status: 503 });
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createClient(url, key);
  const {
    data: { user },
  } = await sb.auth.getUser(token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 현재 유저의 커플 조회
  const { data: couple } = await sb
    .from("couples")
    .select("user_a, user_b")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .eq("status", "active")
    .maybeSingle();

  if (!couple) {
    // 커플 없음 → 204 No Content
    return new NextResponse(null, { status: 204 });
  }

  const partnerId =
    couple.user_a === user.id ? couple.user_b : couple.user_a;

  if (!partnerId) {
    return new NextResponse(null, { status: 204 });
  }

  // 파트너 닉네임
  const { data: display } = await sb
    .from("user_display")
    .select("display_name")
    .eq("id", partnerId)
    .maybeSingle();

  // 파트너 날짜 파라미터
  const dateParam = req.nextUrl.searchParams.get("date");
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : new Date().toISOString().slice(0, 10);

  // 파트너의 day_log 조회
  const { data: logRow } = await sb
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
    partnerName: display?.display_name ?? "파트너",
  });
}
