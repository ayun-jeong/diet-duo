import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-2.5-flash";

// 서버 인메모리 캐시 (프로세스 재시작 전까지 유지, 중복 API 호출 방지)
const geminiCache = new Map<string, FoodResult>();

const GEMINI_SYSTEM = `너는 한국 음식 영양성분 전문가다.
사용자가 먹은 음식 설명을 받으면, 그 양 기준의 영양성분을 추정해라.

규칙:
- 양 표현(예: "1그릇", "100g", "4개")을 그대로 해석해 그 양 전체의 값을 계산한다.
- 양이 없으면 1인분(가정식·일반 식당 1인분) 기준으로 추정한다. 과도하게 크게 잡지 말 것.
  - 국·찌개·볶음밥: 1인분 ≈ 300~350g
  - 조림·찜류: 1인분 ≈ 200~300g
  - 면류: 1인분 ≈ 400~500g (국물 포함)
  - 고기구이 1인분: 150~200g
- 칼로리는 현실적인 중간값을 사용한다. 재료 지방이나 양념 추가분을 과대 산정하지 말 것.
- 반드시 아래 JSON 형식만 출력한다. 설명·마크다운·코드블록 금지.

{"name":"음식명","amount":"양","kcal":숫자,"carbs":숫자,"protein":숫자,"fat":숫자}

kcal는 kcal, carbs/protein/fat은 g 단위 정수 또는 소수1자리.`;

interface FoodResult {
  name: string;
  amount: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  source: "db" | "ai";
}

// 개(個) 단위 식품별 1개 무게 (g)
const PER_ITEM_GRAMS: Array<[RegExp, number]> = [
  // 달걀류
  [/달걀|계란|반숙란|삶은.*란|구운.*란|수란/, 55],
  [/메추리알/, 10],
  // 육류·어패류
  [/새우/, 15],
  [/굴/, 10],
  [/닭가슴살/, 100],
  [/닭다리/, 150],
  // 채소·과일
  [/바나나/, 120],
  [/사과/, 200],
  [/귤|감귤/, 80],
  [/오렌지/, 180],
  [/딸기/, 15],
  [/방울토마토/, 15],
  [/토마토/, 150],
  [/고구마/, 150],
  [/감자/, 130],
  [/아보카도/, 180],
  [/키위/, 100],
  // 견과류 (낱알 기준)
  [/아몬드/, 1.2],
  [/호두/, 4],
  [/캐슈넛|캐슈/, 2],
  [/피스타치오/, 1.5],
  [/잣/, 0.2],
  [/땅콩/, 0.8],
  // 기타
  [/만두/, 35],
  [/떡/, 30],
  [/쿠키|비스킷/, 10],
  [/사탕/, 5],
  [/초콜릿/, 5],
];

// 부피·분량 단위별 기본 g
const PORTION_GRAMS: Record<string, number> = {
  인분: 200, 공기: 210, 그릇: 250, 컵: 200, 잔: 200,
  캔: 355, 봉: 120, 봉지: 120, 팩: 200, 병: 500,
  장: 20, 쪽: 5, 조각: 50,
  // 요리 계량 단위
  스푼: 15, 큰술: 15, 테이블스푼: 15,
  작은술: 5, 티스푼: 5,
  숟가락: 15, 밥숟가락: 15,
};

interface Parsed {
  food: string;  // 수량 제거된 음식명
  grams: number; // 계산할 총 무게 (g)
  amountLabel: string; // 표시용 (e.g. "4개", "200g")
}

function parseInput(query: string): Parsed {
  const korNums: Record<string, number> = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6 };

  // 숫자 + g/kg/ml/L
  const gramRe = /(\d+(?:\.\d+)?)\s*(kg|ml|l|g)/i;
  const gm = query.match(gramRe);
  if (gm) {
    const n = parseFloat(gm[1]);
    const u = gm[2].toLowerCase();
    const grams = u === "kg" ? n * 1000 : u === "l" ? n * 1000 : n;
    const food = query.replace(gm[0], "").trim();
    return { food, grams, amountLabel: gm[0].trim() };
  }

  // 숫자 + 한국어 단위
  const korUnitRe = /(\d+(?:\.\d+)?)\s*(개|인분|공기|그릇|컵|잔|캔|봉|봉지|팩|병|장|쪽|조각|스푼|큰술|테이블스푼|작은술|티스푼|숟가락|밥숟가락)/;
  const ku = query.match(korUnitRe);
  if (ku) {
    const count = parseFloat(ku[1]);
    const unit = ku[2];
    const food = query.replace(ku[0], "").trim();
    return { food, grams: calcGrams(food, unit, count), amountLabel: ku[0].trim() };
  }

  // 한글 수사 + 한국어 단위 (한 개, 두 인분 …)
  const korNumRe = new RegExp(`(${Object.keys(korNums).join("|")})\\s*(개|인분|공기|그릇|컵|잔|봉|봉지|팩|조각|스푼|큰술|작은술|숟가락)`);
  const kn = query.match(korNumRe);
  if (kn) {
    const count = korNums[kn[1]] ?? 1;
    const unit = kn[2];
    const food = query.replace(kn[0], "").trim();
    return { food, grams: calcGrams(food, unit, count), amountLabel: kn[0].trim() };
  }

  // 수량 없음 → 100g 기본
  return { food: query.trim(), grams: 100, amountLabel: "100g" };
}

function calcGrams(food: string, unit: string, count: number): number {
  if (unit === "개" || unit === "조각" || unit === "장" || unit === "쪽" || unit === "알") {
    const entry = PER_ITEM_GRAMS.find(([re]) => re.test(food));
    const perItem = entry?.[1] ?? PORTION_GRAMS[unit] ?? 50;
    return count * perItem;
  }
  return count * (PORTION_GRAMS[unit] ?? 100);
}

// 로컬 영양 테이블 (100g 또는 100ml 기준)
// [패턴, kcal, 탄수화물g, 단백질g, 지방g, 표시명]
const LOCAL_INGREDIENTS: Array<[RegExp, number, number, number, number, string]> = [
  // ── 커피·차 음료 ───────────────────────────────────────────
  [/아메리카노|블랙커피/, 5, 0.8, 0.1, 0, "아메리카노"],
  [/에스프레소/, 9, 1.5, 0.6, 0.2, "에스프레소"],
  [/카페라떼|카페 라떼|라떼$/, 50, 5, 3, 2, "카페라떼"],
  [/카푸치노/, 40, 4.2, 3, 1.5, "카푸치노"],
  [/카페모카|모카라떼/, 75, 10, 3, 3, "카페모카"],
  [/바닐라라떼|바닐라 라떼/, 75, 10, 3, 2.5, "바닐라라떼"],
  [/녹차라떼|그린티라떼/, 60, 9, 2.5, 1.5, "녹차라떼"],
  [/녹차|말차/, 2, 0.3, 0.3, 0, "녹차"],
  [/홍차/, 1, 0.2, 0.1, 0, "홍차"],
  [/아이스티/, 25, 6.5, 0, 0, "아이스티"],
  // ── 음료·주류 ──────────────────────────────────────────────
  [/콜라/, 42, 10.6, 0, 0, "콜라"],
  [/사이다|스프라이트/, 39, 9.8, 0, 0, "사이다"],
  [/환타|오렌지에이드/, 45, 11.5, 0, 0, "환타"],
  [/오렌지주스|오렌지 주스/, 45, 10.4, 0.7, 0.2, "오렌지주스"],
  [/사과주스|애플주스/, 47, 11.5, 0.1, 0.1, "사과주스"],
  [/포도주스/, 60, 14.8, 0.4, 0.1, "포도주스"],
  [/토마토주스/, 17, 3.5, 0.7, 0.1, "토마토주스"],
  [/이온음료|스포츠음료|게토레이|포카리/, 25, 6.2, 0, 0, "이온음료"],
  [/에너지드링크|레드불|몬스터/, 45, 11, 0, 0, "에너지드링크"],
  [/맥주/, 43, 3.6, 0.5, 0, "맥주"],
  [/소주/, 147, 0, 0, 0, "소주"],
  [/막걸리|동동주/, 54, 4.5, 1.6, 0.1, "막걸리"],
  [/와인|적포도주|백포도주/, 85, 2.6, 0.1, 0, "와인"],
  // ── 육류·단백질 ────────────────────────────────────────────
  [/닭가슴살/, 165, 0, 31, 3.6, "닭가슴살"],
  [/닭안심/, 109, 0, 23, 1, "닭안심"],
  [/닭다리(?!살)/, 177, 0, 18.4, 11.2, "닭다리"],
  [/삼겹살/, 467, 0, 16.5, 44.7, "삼겹살"],
  [/목살|돼지목살/, 189, 0.1, 18.1, 12.5, "돼지목살"],
  [/안심(?:고기|스테이크)?/, 144, 0, 21.9, 6.2, "소안심"],
  [/등심(?:고기|스테이크)?/, 198, 0, 19.5, 13.2, "소등심"],
  [/소고기(?!볶음|국|미역)/, 250, 0, 19, 19, "소고기"],
  [/돼지고기(?!볶음|국)/, 263, 0, 17.3, 21.8, "돼지고기"],
  [/참치(?:캔|통조림)?/, 132, 0, 28, 2.3, "참치"],
  [/연어/, 208, 0, 20, 13.4, "연어"],
  [/고등어/, 262, 0, 19, 20.5, "고등어"],
  [/두부/, 76, 1.9, 8.2, 4.2, "두부"],
  [/콩나물/, 30, 5.4, 3.6, 0.2, "콩나물"],
  // ── 달걀·유제품 ────────────────────────────────────────────
  [/달걀|계란|반숙란|삶은.*란|구운.*란|수란/, 155, 1.1, 12.6, 10.6, "달걀"],
  [/메추리알/, 158, 0.7, 12.8, 11.2, "메추리알"],
  [/우유/, 62, 4.7, 3.2, 3.5, "우유"],
  [/저지방우유/, 46, 4.9, 3.4, 1, "저지방우유"],
  [/두유/, 45, 3.5, 4, 2, "두유"],
  [/생크림/, 340, 3, 2.7, 35, "생크림"],
  [/플레인요거트|무가당요거트/, 59, 3.6, 10, 0.4, "플레인요거트"],
  [/요거트|요구르트/, 80, 12, 4, 2, "요거트"],
  [/치즈/, 402, 1.3, 25, 33, "치즈"],
  [/파마산/, 431, 4, 38, 29, "파마산치즈"],
  [/버터/, 717, 0.1, 0.9, 81, "버터"],
  [/마가린/, 717, 0.1, 0.1, 80, "마가린"],
  // ── 과일 ───────────────────────────────────────────────────
  [/바나나/, 89, 23, 1.1, 0.3, "바나나"],
  [/사과/, 52, 14, 0.3, 0.2, "사과"],
  [/귤|감귤/, 53, 13, 0.8, 0.2, "귤"],
  [/오렌지/, 47, 11.8, 0.9, 0.1, "오렌지"],
  [/딸기/, 32, 7.7, 0.7, 0.3, "딸기"],
  [/포도/, 67, 17, 0.6, 0.4, "포도"],
  [/수박/, 30, 7.6, 0.6, 0.2, "수박"],
  [/참외/, 29, 6.8, 0.7, 0.1, "참외"],
  [/복숭아/, 39, 9.5, 0.9, 0.3, "복숭아"],
  [/키위/, 61, 15, 1.1, 0.5, "키위"],
  [/망고/, 60, 15, 0.8, 0.4, "망고"],
  [/파인애플/, 50, 13.1, 0.5, 0.1, "파인애플"],
  [/블루베리/, 57, 14.5, 0.7, 0.3, "블루베리"],
  [/아보카도/, 160, 9, 2, 15, "아보카도"],
  [/토마토/, 18, 3.9, 0.9, 0.2, "토마토"],
  [/방울토마토/, 20, 4.4, 0.9, 0.2, "방울토마토"],
  [/레몬/, 29, 9, 1.1, 0.3, "레몬"],
  [/자몽/, 42, 10.7, 0.8, 0.1, "자몽"],
  // ── 견과류 ─────────────────────────────────────────────────
  [/아몬드/, 579, 22, 21, 50, "아몬드"],
  [/호두/, 654, 14, 15, 65, "호두"],
  [/땅콩/, 567, 16, 26, 49, "땅콩"],
  [/캐슈넛|캐슈/, 553, 33, 18, 44, "캐슈넛"],
  [/피스타치오/, 560, 28, 20, 45, "피스타치오"],
  [/잣/, 673, 13, 14, 68, "잣"],
  [/해바라기씨/, 584, 20, 21, 51, "해바라기씨"],
  [/참깨/, 573, 23, 18, 50, "참깨"],
  // ── 식용유·조미료 ──────────────────────────────────────────
  [/올리브유|엑스트라버진/, 884, 0, 0, 100, "올리브유"],
  [/참기름/, 884, 0, 0, 100, "참기름"],
  [/들기름/, 884, 0, 0, 100, "들기름"],
  [/식용유|콩기름|대두유|카놀라유|포도씨유|해바라기유|코코넛오일/, 884, 0, 0, 100, "식용유"],
  [/마요네즈/, 670, 3, 1.5, 74, "마요네즈"],
  [/간장/, 60, 9, 6, 0.1, "간장"],
  [/된장/, 183, 22, 16, 5.5, "된장"],
  [/고추장/, 191, 37, 8.8, 2.3, "고추장"],
  [/쌈장/, 200, 26, 12, 5, "쌈장"],
  [/케첩|토마토소스/, 101, 26, 1.8, 0.4, "케첩"],
  [/설탕|백설탕/, 387, 100, 0, 0, "설탕"],
  [/꿀/, 304, 82, 0.3, 0, "꿀"],
  [/올리고당/, 308, 80, 0, 0, "올리고당"],
  [/시럽/, 260, 67, 0, 0, "시럽"],
  [/소금/, 0, 0, 0, 0, "소금"],
  [/후추/, 251, 64, 10, 3.3, "후추"],
  [/밀가루/, 366, 76, 10, 1.5, "밀가루"],
  [/전분|녹말/, 347, 85, 0.3, 0.1, "전분"],
];

function lookupLocal(food: string, grams: number, amountLabel: string): FoodResult | null {
  const cleaned = food.replace(/\s+/g, "");
  const entry = LOCAL_INGREDIENTS.find(([re]) => {
    const m = cleaned.match(re);
    if (!m) return false;
    // 매칭된 글자가 음식명의 65% 이상이어야 함 (된장찌개에서 된장만 뽑히는 오매칭 방지)
    return m[0].length / cleaned.length >= 0.65;
  });
  if (!entry) return null;
  const [, kcalPer, carbsPer, proteinPer, fatPer, name] = entry;
  const ratio = grams / 100;
  return {
    name,
    amount: amountLabel,
    kcal: Math.round(kcalPer * ratio),
    carbs: Math.round(carbsPer * ratio * 10) / 10,
    protein: Math.round(proteinPer * ratio * 10) / 10,
    fat: Math.round(fatPer * ratio * 10) / 10,
    source: "db",
  };
}

// 식약처 식품영양성분DB 공공API v2 조회
async function lookupFoodDB(
  query: string,
  apiKey: string,
): Promise<FoodResult | null> {
  try {
    const { food: rawFood, grams, amountLabel } = parseInput(query);

    // 수량 표현 제거 후 최대 3단어, 공백 유지 (베이컨 포테이토 포카치아 → 마지막 단어까지 검색)
    const keyword = rawFood
      .replace(/\d+(\.\d+)?\s*(g|ml|kg|l|개|인분|공기|컵|캔|조각|봉|봉지|장|쪽|팩|병|잔|그릇)/gi, "")
      .replace(/(한|두|세|네)\s*(개|인분|공기|컵|캔|조각|봉|봉지|장|쪽|팩|병|잔|그릇)/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join(" ");

    if (!keyword) return null;

    const words = keyword.split(" ");

    // DB API 검색 헬퍼
    const searchDB = async (kw: string) => {
      const url = new URL(
        "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02",
      );
      url.searchParams.set("serviceKey", apiKey);
      url.searchParams.set("FOOD_NM_KR", kw);
      url.searchParams.set("pageNo", "1");
      url.searchParams.set("numOfRows", "15");
      url.searchParams.set("type", "json");
      const r = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return [];
      const d = await r.json();
      if (d?.header?.resultCode !== "00") return [];
      return (d?.body?.items ?? []) as Record<string, string>[];
    };

    // 전체 키워드 검색, 결과 없으면 마지막 단어(음식 유형)로 재시도
    let items = await searchDB(keyword);
    let matchKeyword = keyword;
    if (!items.length && words.length > 1) {
      matchKeyword = words[words.length - 1];
      items = await searchDB(matchKeyword);
    }
    if (!items.length) return null;

    // 정확도 순: 1) 정확 일치, 2) 품목대표 중 키워드 포함, 3) 최단 이름
    const sortByLen = (a: Record<string, string>, b: Record<string, string>) =>
      (a.FOOD_NM_KR?.length ?? 99) - (b.FOOD_NM_KR?.length ?? 99);

    const exactMatch = items.find((i) => i.FOOD_NM_KR?.trim() === matchKeyword);

    // 키워드로 시작하는 항목만 신뢰 (앞에 브랜드명 붙은 항목 제외)
    const startsWith = items
      .filter((i) => i.FOOD_NM_KR?.startsWith(matchKeyword))
      .sort(sortByLen);

    // 품목대표 중 키워드 포함 (브랜드 제품명 제외됨)
    const repContains = items
      .filter((i) => i.DB_CLASS_NM === "품목대표" && i.FOOD_NM_KR?.includes(matchKeyword))
      .sort(sortByLen);

    if (!exactMatch && !startsWith.length && !repContains.length) return null;

    const item =
      exactMatch ??
      startsWith.find((i) => i.DB_CLASS_NM === "품목대표") ??
      startsWith[0] ??
      repContains[0];

    const kcalPer100 = parseFloat(item.AMT_NUM1 ?? "0") || 0;
    const proteinPer100 = parseFloat(item.AMT_NUM3 ?? "0") || 0;
    const fatPer100 = parseFloat(item.AMT_NUM4 ?? "0") || 0;
    const carbsPer100 = parseFloat(item.AMT_NUM6 ?? "0") || 0;

    if (kcalPer100 < 20) return null;
    // 탄수화물·지방 둘 다 0이면 불완전 데이터 → Gemini fallback
    if (kcalPer100 > 50 && carbsPer100 === 0 && fatPer100 === 0) return null;

    const ratio = grams / 100;
    return {
      name: item.FOOD_NM_KR ?? keyword,
      amount: amountLabel,
      kcal: Math.round(kcalPer100 * ratio),
      carbs: Math.round(carbsPer100 * ratio * 10) / 10,
      protein: Math.round(proteinPer100 * ratio * 10) / 10,
      fat: Math.round(fatPer100 * ratio * 10) / 10,
      source: "db",
    };
  } catch {
    return null;
  }
}

// Gemini AI 추정 (원본 쿼리 그대로 전달 — 수량 포함, 429 시 1회 재시도)
async function lookupGemini(
  query: string,
  apiKey: string,
): Promise<FoodResult | null> {
  const run = async () => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: GEMINI_SYSTEM,
    });
    const result = await model.generateContent(query);
    const text = result.response.text();
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return null;
    const o = JSON.parse(match[0]);
    return {
      name: String(o.name ?? ""),
      amount: String(o.amount ?? ""),
      kcal: Number(o.kcal) || 0,
      carbs: Number(o.carbs) || 0,
      protein: Number(o.protein) || 0,
      fat: Number(o.fat) || 0,
      source: "ai" as const,
    };
  };

  try {
    return await run();
  } catch (e: unknown) {
    const msg = String(e);
    // 429 속도 제한 → 5초 대기 후 1회 재시도
    if (msg.includes("503") || msg.includes("429") || msg.includes("TooManyRequests") || msg.includes("RESOURCE_EXHAUSTED")) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        return await run();
      } catch (e2) {
        console.error("[Gemini retry failed]", e2);
        return null;
      }
    }
    console.error("[Gemini error]", e);
    return null;
  }
}

export async function POST(req: Request) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY가 설정되지 않았습니다. .env.local을 확인하세요." },
      { status: 500 },
    );
  }

  let query = "";
  try {
    const body = await req.json();
    query = String(body?.query ?? "").trim();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!query) {
    return NextResponse.json({ error: "음식을 입력하세요." }, { status: 400 });
  }

  // 1순위: 로컬 식재료 테이블 (올리브유, 간장 등 기본 식재료)
  const { food: parsedFood, grams, amountLabel } = parseInput(query);
  const localResult = lookupLocal(parsedFood, grams, amountLabel);
  if (localResult) return NextResponse.json(localResult);

  // 2순위: 식약처 공공 DB
  const foodApiKey = process.env.FOOD_API_KEY;
  if (foodApiKey) {
    const dbResult = await lookupFoodDB(query, foodApiKey);
    if (dbResult) return NextResponse.json(dbResult);
  }

  // 3순위: Gemini AI 추정 — 캐시 우선, 없으면 API 호출 후 캐시 저장
  const cacheKey = query.trim().toLowerCase();
  const cached = geminiCache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  const aiResult = await lookupGemini(query, geminiKey);
  if (aiResult) {
    geminiCache.set(cacheKey, aiResult);
    return NextResponse.json(aiResult);
  }

  return NextResponse.json(
    { error: "영양성분을 추정하지 못했습니다. 다시 시도해 주세요." },
    { status: 502 },
  );
}
