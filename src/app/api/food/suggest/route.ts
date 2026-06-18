import { NextResponse } from "next/server";

export const runtime = "nodejs";

export interface SuggestItem {
  name: string;
  kcal: number;   // per 100g
  carbs: number;
  protein: number;
  fat: number;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);

  const apiKey = process.env.FOOD_API_KEY;
  if (!apiKey) return NextResponse.json([]);

  try {
    const url = new URL(
      "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02",
    );
    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("FOOD_NM_KR", q);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "20");
    url.searchParams.set("type", "json");

    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return NextResponse.json([]);
    const d = await r.json();

    type Row = Record<string, string>;
    const items: Row[] = d?.body?.items ?? [];
    if (!items.length) return NextResponse.json([]);

    // 품목대표(대표 영양 기준) 우선, 없으면 전체에서 짧은 이름 우선
    const sortByLen = (a: Row, b: Row) =>
      (a.FOOD_NM_KR?.length ?? 99) - (b.FOOD_NM_KR?.length ?? 99);

    const rep = items.filter((i) => i.DB_CLASS_NM === "품목대표").sort(sortByLen);
    const rest = items.filter((i) => i.DB_CLASS_NM !== "품목대표").sort(sortByLen);
    const sorted = [...rep, ...rest];

    const results: SuggestItem[] = sorted
      .filter((item) => {
        const kcal = parseFloat(item.AMT_NUM1 ?? "0");
        return kcal > 0 && item.FOOD_NM_KR;
      })
      .slice(0, 6)
      .map((item) => ({
        name: item.FOOD_NM_KR.trim(),
        kcal:    Math.round(parseFloat(item.AMT_NUM1 ?? "0")),
        carbs:   Math.round(parseFloat(item.AMT_NUM6 ?? "0") * 10) / 10,
        protein: Math.round(parseFloat(item.AMT_NUM3 ?? "0") * 10) / 10,
        fat:     Math.round(parseFloat(item.AMT_NUM4 ?? "0") * 10) / 10,
      }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
