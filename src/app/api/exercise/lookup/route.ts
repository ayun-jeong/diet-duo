export const dynamic = "force-dynamic";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { cacheGet, cacheSet, normalizeKey } from "@/lib/server/ai-cache";
import { getSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";

const MODEL = "gemini-2.5-flash";

// [운동명 정규식, MET값, 표준명]
// MET 공식: burned = MET × weightKg × hours
const LOCAL_EXERCISES: [RegExp, number, string][] = [
  // 걷기
  [/걷기|산책|워킹/, 3.5, "걷기"],
  [/빠르게\s*걷기|빠른\s*걷기|파워워킹/, 4.5, "빠르게 걷기"],
  // 달리기
  [/달리기|조깅|러닝|뛰기/, 8.0, "달리기"],
  [/마라톤|빠른\s*달리기/, 11.0, "빠른 달리기"],
  // 자전거
  [/자전거|싸이클|사이클|바이크/, 6.0, "자전거"],
  // 수영
  [/수영|수영장/, 7.0, "수영"],
  // 헬스·웨이트
  [/헬스|웨이트|근력운동|근력|덤벨|바벨|벤치프레스/, 5.5, "헬스 (웨이트트레이닝)"],
  // 배드민턴
  [/배드민턴/, 5.5, "배드민턴"],
  // 테니스
  [/테니스/, 7.0, "테니스"],
  // 탁구
  [/탁구/, 4.0, "탁구"],
  // 축구
  [/축구/, 7.0, "축구"],
  // 농구
  [/농구/, 6.5, "농구"],
  // 야구·캐치볼
  [/야구|캐치볼/, 5.0, "야구"],
  // 골프
  [/골프/, 3.5, "골프"],
  // 등산·하이킹
  [/등산|하이킹|트레킹/, 6.5, "등산"],
  // 줄넘기
  [/줄넘기/, 10.0, "줄넘기"],
  // 스쿼트·푸시업 등 맨몸
  [/스쿼트|푸시업|팔굽혀펴기|버피|플랭크|런지/, 5.0, "맨몸운동"],
  // 요가·스트레칭
  [/요가|스트레칭/, 3.0, "요가"],
  // 필라테스
  [/필라테스/, 3.5, "필라테스"],
  // 에어로빅·댄스
  [/에어로빅|댄스|줌바|zumba/, 6.0, "에어로빅"],
  // 계단
  [/계단|계단\s*오르기|계단\s*내려가기|계단\s*오르내리기/, 8.0, "계단 오르기"],
  // 등산·하이킹 (중복 방지용 이미 위에 있으나 계단과 구분)
  [/클라이밍|암벽/, 8.0, "클라이밍"],
  // 스케이트
  [/스케이트|인라인/, 7.0, "인라인스케이트"],
  // 볼링
  [/볼링/, 3.0, "볼링"],
  // 배구
  [/배구/, 4.0, "배구"],
  // 크로스핏
  [/크로스핏|crossfit/, 8.0, "크로스핏"],
  // 복싱·격투
  [/복싱|킥복싱|무에타이|격투|유도|태권도/, 9.0, "복싱"],
  // 홈트·기타
  [/홈트|홈트레이닝/, 5.0, "홈트레이닝"],
  [/힙힌지|데드리프트/, 6.0, "데드리프트"],
  [/자전거\s*타기|실내\s*자전거|스피닝/, 6.5, "실내 자전거"],
  [/수영\s*자유형|자유형/, 8.0, "자유형 수영"],
  [/철봉|턱걸이|풀업/, 5.0, "철봉"],
  [/런닝머신|트레드밀/, 8.0, "런닝머신"],
  [/일립티컬|엘립티컬/, 5.0, "일립티컬"],
  [/로잉|조정|로잉머신/, 7.0, "로잉머신"],
  [/배드민턴\s*복식|배드민턴\s*단식/, 5.5, "배드민턴"],
  [/피클볼|피클/, 4.5, "피클볼"],
  [/서핑|파도타기/, 5.0, "서핑"],
  [/카약|카누/, 5.0, "카약"],
];

// "30분", "1시간", "1시간 30분", "45분" 등을 시간(h)으로 변환
/**
 * 시간 표현을 걷어내 운동 이름만 남긴다 — 캐시 키에 쓴다.
 * "수영 30분" 과 "수영 43분" 은 같은 운동이므로 같은 칸을 봐야 한다.
 */
function stripDuration(query: string): string {
  return query
    .replace(/(\d+(?:\.\d+)?)\s*시간\s*(\d+)\s*분/g, " ")
    .replace(/(\d+(?:\.\d+)?)\s*시간/g, " ")
    .replace(/(\d+)\s*분/g, " ")
    .trim();
}

function parseDuration(query: string): { hours: number; label: string } | null {
  // 시간+분 복합: "1시간 30분"
  const hmMatch = query.match(/(\d+(?:\.\d+)?)\s*시간\s*(\d+)\s*분/);
  if (hmMatch) {
    const h = parseFloat(hmMatch[1]);
    const m = parseInt(hmMatch[2]);
    const total = h + m / 60;
    return { hours: total, label: `${hmMatch[1]}시간 ${hmMatch[2]}분` };
  }
  // 시간만: "1시간", "1.5시간"
  const hMatch = query.match(/(\d+(?:\.\d+)?)\s*시간/);
  if (hMatch) {
    const h = parseFloat(hMatch[1]);
    return { hours: h, label: `${hMatch[1]}시간` };
  }
  // 분만: "30분"
  const mMatch = query.match(/(\d+)\s*분/);
  if (mMatch) {
    const m = parseInt(mMatch[1]);
    return { hours: m / 60, label: `${mMatch[1]}분` };
  }
  return null;
}

function lookupLocal(
  query: string,
  weightKg: number,
): { name: string; duration: string; burned: number } | null {
  const dur = parseDuration(query);
  if (!dur || dur.hours <= 0) return null;

  const entry = LOCAL_EXERCISES.find(([re]) => re.test(query));
  if (!entry) return null;

  const [, met, name] = entry;
  const burned = Math.round(met * weightKg * dur.hours);
  return { name, duration: dur.label, burned };
}

const SYSTEM_PROMPT = `너는 운동 생리학 전문가다.
사용자의 운동 설명, 시간, 체중을 받아 MET(Metabolic Equivalent) 기준으로 소모 칼로리를 계산해라.
공식: 소모 kcal = MET × 체중(kg) × 시간(h)

규칙:
- 반드시 아래 JSON 형식만 출력한다. 설명·마크다운·코드블록 금지.
{"name":"운동명","duration":"시간 표현","burned":숫자}

burned는 정수 kcal.`;

interface ExerciseResult {
  name: string;
  duration: string;
  burned: number;
}

// 서버 인메모리 캐시

function extractJson(text: string): ExerciseResult | null {
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    const o = JSON.parse(match[0]);
    return {
      name: String(o.name ?? ""),
      duration: String(o.duration ?? ""),
      burned: Math.round(Number(o.burned) || 0),
    };
  } catch {
    return null;
  }
}

async function callGemini(
  apiKey: string,
  query: string,
  weightKg: number,
): Promise<ExerciseResult | null> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  });
  const result = await model.generateContent(`${query} (체중: ${weightKg}kg)`);
  return extractJson(result.response.text());
}

function isRetryable(err: unknown): boolean {
  if (!err) return false;
  const msg = String((err as { message?: string })?.message ?? "");
  return (
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("TooManyRequests") ||
    msg.includes("RESOURCE_EXHAUSTED")
  );
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  let query = "";
  let weightKg = 70;
  try {
    const body = await req.json();
    query = String(body?.query ?? "").trim();
    weightKg = Number(body?.weightKg) || 70;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!query) {
    return NextResponse.json({ error: "운동을 입력하세요." }, { status: 400 });
  }

  // 1) 로컬 테이블 우선
  const local = lookupLocal(query, weightKg);
  if (local) return NextResponse.json(local);

  /*
   * 2) 캐시 확인 — 값이 아니라 MET 을 저장한다.
   *
   * 소모 칼로리는 MET × 체중 × 시간이라 시간과 체중에 정비례한다. 결과값을
   * 그대로 캐시하면 "수영 30분" 과 "수영 43분" 이 서로 다른 칸이 되어 매번
   * 다시 묻게 된다. 변하지 않는 것은 운동 자체의 MET 뿐이므로 그것만 남기고
   * 나머지는 여기서 곱한다 — 시간이 달라져도, 체중이 바뀌어도 재호출이 없다.
   */
  const dur = parseDuration(query);
  const cacheKey = normalizeKey(stripDuration(query));
  const cached =
    dur && dur.hours > 0
      ? await cacheGet<{ met: number; name: string }>("exercise", cacheKey)
      : null;

  if (cached && dur) {
    return NextResponse.json({
      name: cached.name,
      duration: dur.label,
      burned: Math.round(cached.met * weightKg * dur.hours),
    });
  }

  // 3) Gemini (503/429 시 4초 후 재시도 1회)
  try {
    let parsed: ExerciseResult | null = null;
    try {
      parsed = await callGemini(apiKey, query, weightKg);
    } catch (err) {
      if (isRetryable(err)) {
        await new Promise((r) => setTimeout(r, 4000));
        parsed = await callGemini(apiKey, query, weightKg);
      } else {
        throw err;
      }
    }

    if (!parsed || parsed.burned <= 0) {
      return NextResponse.json(
        { error: "소모 칼로리를 계산하지 못했습니다. 다시 시도해 주세요." },
        { status: 502 },
      );
    }
    // 응답에는 소모 칼로리만 오므로 MET 을 역산해 둔다.
    if (dur && dur.hours > 0 && weightKg > 0) {
      const met = parsed.burned / (weightKg * dur.hours);
      await cacheSet(
        "exercise",
        cacheKey,
        { met, name: parsed.name },
        !!(await getSessionUser()),
      );
    }
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("exercise lookup error", err);
    if (isRetryable(err)) {
      return NextResponse.json(
        { error: "AI 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "AI 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
