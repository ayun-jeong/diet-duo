import { NextRequest, NextResponse } from "next/server";
import { db, DB_DISABLED_RESPONSE } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/session";
import { getPartnerId } from "@/lib/server/couple";
import { dayLogToRow, isValidDate, rowToDayLog } from "@/lib/server/rows";
import { MEAL_TYPES, emptyDayLog } from "@/lib/types";
import type { FoodItem, MealType } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 한 끼니에 쌓일 수 있는 항목 수 — 실수로 상대 기록이 넘치지 않게 막는다. */
const MEAL_ITEM_CAP = 50;

function isMeal(v: string | null | undefined): v is MealType {
  return !!v && (MEAL_TYPES as string[]).includes(v);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * 남의 기록에 들어갈 값이므로 필요한 필드만 골라 새로 만든다.
 * 본문을 그대로 믿고 저장하면 임의의 구조를 상대 jsonb 에 밀어 넣을 수 있다.
 */
function sanitizeFood(
  raw: unknown,
  from: { userId: string; name: string },
): FoodItem | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  const name = typeof f.name === "string" ? f.name.trim().slice(0, 100) : "";
  if (!name) return null;

  return {
    id: genId(),
    name,
    amount: typeof f.amount === "string" ? f.amount.slice(0, 50) : "",
    kcal: Math.max(0, Math.round(num(f.kcal))),
    carbs: Math.max(0, Math.round(num(f.carbs))),
    protein: Math.max(0, Math.round(num(f.protein))),
    fat: Math.max(0, Math.round(num(f.fat))),
    source: f.source === "ai" || f.source === "db" ? f.source : "manual",
    // 사본에는 sharedItemId 를 붙이지 않는다 — 연동의 연동은 만들지 않는다.
    sharedFrom: from,
  };
}

/**
 * POST /api/partner/share
 * body: { date, meal, food }
 *
 * 내가 먹은 것을 파트너의 같은 날짜·같은 끼니에 사본으로 넣는다.
 * 사본은 그 순간부터 상대의 기록이다 — 상대가 지워도 내 것은 남고, 그 반대도 같다.
 */
export async function POST(req: NextRequest) {
  if (!db) return NextResponse.json(DB_DISABLED_RESPONSE, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partnerId = await getPartnerId(user.id);
  if (!partnerId) {
    return NextResponse.json({ error: "연결된 메이트가 없습니다" }, { status: 409 });
  }

  let body: { date?: string; meal?: string; food?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 JSON 본문" }, { status: 400 });
  }

  const date = body.date ?? null;
  const meal = body.meal;
  if (!isValidDate(date)) {
    return NextResponse.json({ error: "잘못된 date" }, { status: 400 });
  }
  if (!isMeal(meal)) {
    return NextResponse.json({ error: "잘못된 meal" }, { status: 400 });
  }

  const food = sanitizeFood(body.food, {
    userId: user.id,
    name: user.name || "메이트",
  });
  if (!food) {
    return NextResponse.json({ error: "보낼 음식 정보가 없습니다" }, { status: 400 });
  }

  const { data, error: readErr } = await db
    .from("day_logs")
    .select("meals, water_ml, steps, exercises, weight_kg")
    .eq("user_id", partnerId)
    .eq("date", date)
    .maybeSingle();

  if (readErr) {
    console.error("[share] select:", readErr);
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  const log = rowToDayLog(date, data) ?? emptyDayLog(date);
  if (log.meals[meal].length >= MEAL_ITEM_CAP) {
    return NextResponse.json(
      { error: "메이트의 해당 끼니가 가득 찼습니다" },
      { status: 409 },
    );
  }

  const next = {
    ...log,
    meals: { ...log.meals, [meal]: [...log.meals[meal], food] },
  };

  const { error } = await db
    .from("day_logs")
    .upsert(dayLogToRow(partnerId, next), { onConflict: "user_id,date" });

  if (error) {
    console.error("[share] upsert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ itemId: food.id });
}

/**
 * DELETE /api/partner/share?date=&meal=&itemId=
 *
 * 내가 보낸 사본을 되돌린다. 보낸 사람만 지울 수 있고(sharedFrom 확인),
 * 상대가 이미 지웠으면 성공으로 친다 — 결과가 같으므로 오류로 만들 이유가 없다.
 */
export async function DELETE(req: NextRequest) {
  if (!db) return NextResponse.json(DB_DISABLED_RESPONSE, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partnerId = await getPartnerId(user.id);
  if (!partnerId) {
    return NextResponse.json({ error: "연결된 메이트가 없습니다" }, { status: 409 });
  }

  const params = req.nextUrl.searchParams;
  const date = params.get("date");
  const meal = params.get("meal");
  const itemId = params.get("itemId");

  if (!isValidDate(date)) {
    return NextResponse.json({ error: "잘못된 date" }, { status: 400 });
  }
  if (!isMeal(meal)) {
    return NextResponse.json({ error: "잘못된 meal" }, { status: 400 });
  }
  if (!itemId) {
    return NextResponse.json({ error: "itemId 가 필요합니다" }, { status: 400 });
  }

  const { data, error: readErr } = await db
    .from("day_logs")
    .select("meals, water_ml, steps, exercises, weight_kg")
    .eq("user_id", partnerId)
    .eq("date", date)
    .maybeSingle();

  if (readErr) {
    console.error("[share] select:", readErr);
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  const log = rowToDayLog(date, data);
  const target = log?.meals[meal].find((f) => f.id === itemId);

  // 이미 없으면 되돌릴 것도 없다.
  if (!log || !target) return NextResponse.json({ ok: true, alreadyGone: true });

  // 내가 보낸 것만 지울 수 있다. 상대가 직접 적은 음식은 건드리지 못한다.
  if (target.sharedFrom?.userId !== user.id) {
    return NextResponse.json({ error: "되돌릴 수 없는 항목입니다" }, { status: 403 });
  }

  const next = {
    ...log,
    meals: { ...log.meals, [meal]: log.meals[meal].filter((f) => f.id !== itemId) },
  };

  const { error } = await db
    .from("day_logs")
    .upsert(dayLogToRow(partnerId, next), { onConflict: "user_id,date" });

  if (error) {
    console.error("[share] upsert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
