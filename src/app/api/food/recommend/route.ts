import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import type { MealType } from "@/lib/types";

export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-2.5-flash";

export interface RecommendItem {
  name: string;
  amount: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  reason: string;
}

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식/음료",
};

// 인메모리 캐시 (mealType + 남은 칼로리 100kcal 단위로 버킷)
const cache = new Map<string, RecommendItem[]>();

export async function POST(req: Request) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: "API 키 없음" }, { status: 500 });

  let mealType: MealType = "dinner";
  let remainingKcal = 600;
  let eatenFoods: string[] = [];
  let refresh = false;

  try {
    const body = await req.json();
    mealType = body.mealType ?? "dinner";
    remainingKcal = Math.max(0, Number(body.remainingKcal) || 0);
    eatenFoods = Array.isArray(body.eatenFoods) ? body.eatenFoods.slice(0, 20) : [];
    refresh = Boolean(body.refresh);
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  // 버킷 단위 캐시 (남은 칼로리 100kcal 단위), refresh=true면 캐시 무시
  const bucket = Math.round(remainingKcal / 100) * 100;
  const cacheKey = `${mealType}-${bucket}`;
  if (!refresh) {
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);
  } else {
    cache.delete(cacheKey);
  }

  const label = MEAL_LABEL[mealType] ?? "식사";
  const eatenStr = eatenFoods.length > 0 ? eatenFoods.join(", ") : "없음";

  const targetKcal =
    remainingKcal < 200 ? `${remainingKcal}kcal 이하 가벼운 메뉴`
    : remainingKcal < 400 ? `${Math.round(remainingKcal * 0.7)}~${remainingKcal}kcal`
    : `${Math.round(remainingKcal * 0.55)}~${Math.round(remainingKcal * 0.85)}kcal`;

  const prompt = `끼니: ${label}
오늘 남은 칼로리: ${remainingKcal}kcal
이미 먹은 음식: ${eatenStr}

아래 조건에 맞는 메뉴 4가지를 추천해줘.
- 1인분 칼로리 목표: ${targetKcal}
- 한식·양식·일식·중식·분식 등 다양한 종류로 골고루 추천 (한식만 추천하지 말 것)
- 영양 균형(탄단지)이 좋은 메뉴 위주
- 이미 먹은 음식과 겹치지 않게
- reason은 추천 이유를 10자 이내로

반드시 JSON 배열만 출력. 설명·마크다운·코드블록 금지.
[{"name":"","amount":"1인분","kcal":숫자,"carbs":숫자,"protein":숫자,"fat":숫자,"reason":""}]`;

  const run = async () => {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("parse_fail");
    const items: RecommendItem[] = JSON.parse(match[0]);
    if (!Array.isArray(items) || items.length === 0) throw new Error("empty");
    return items;
  };

  try {
    let items: RecommendItem[];
    try {
      items = await run();
    } catch (e) {
      const msg = String(e);
      // 503 과부하 또는 429 할당량 → 4초 뒤 1회 재시도
      if (msg.includes("503") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        await new Promise((r) => setTimeout(r, 4000));
        items = await run();
      } else {
        throw e;
      }
    }
    cache.set(cacheKey, items);
    return NextResponse.json(items);
  } catch (e) {
    console.error("[Recommend error]", e);
    return NextResponse.json({ error: "추천 실패" }, { status: 502 });
  }
}
