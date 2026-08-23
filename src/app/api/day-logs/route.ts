import { NextRequest, NextResponse } from "next/server";
import { db, DB_DISABLED_RESPONSE } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/session";
import { isValidDate } from "@/lib/server/rows";
import type { DaySummary } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 한 번에 조회 가능한 최대 일수 (약 1년) */
const MAX_RANGE_DAYS = 400;

function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000;
}

/**
 * GET /api/day-logs?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * 구간 일별 요약(칼로리·체중)을 한 번에 돌려준다.
 *
 * 기존 캘린더는 한 달을 그리려고 storage.getDayLog() 를 날짜마다 호출해
 * 최대 31회를 개별 왕복했고, 주간 차트는 7일치를 순차 await 했다.
 * meals jsonb 를 통째로 끌어올 필요도 없어 kcal·weight_kg 두 컬럼만 읽는다.
 */
export async function GET(req: NextRequest) {
  if (!db) return NextResponse.json(DB_DISABLED_RESPONSE, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!isValidDate(from) || !isValidDate(to)) {
    return NextResponse.json({ error: "잘못된 from/to 파라미터" }, { status: 400 });
  }

  const span = daysBetween(from, to);
  if (span < 0) {
    return NextResponse.json({ error: "from 이 to 보다 늦습니다" }, { status: 400 });
  }
  if (span > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { error: `조회 구간은 최대 ${MAX_RANGE_DAYS}일입니다` },
      { status: 400 },
    );
  }

  const { data, error } = await db
    .from("day_logs")
    .select("date, kcal, weight_kg")
    .eq("user_id", user.id)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  if (error) {
    console.error("[day-logs] select:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summaries: DaySummary[] = (data ?? []).map((r) => ({
    date: r.date as string,
    kcal: (r.kcal as number) ?? 0,
    weightKg: (r.weight_kg as number | null) ?? undefined,
  }));

  return NextResponse.json({ summaries });
}
