import { db } from "./db";

/**
 * AI 응답 공유 캐시.
 *
 * 음식 영양값·운동 소모량·메뉴 추천은 누가 묻든 같은 답이므로 사용자별로
 * 나눌 이유가 없다. 그런데 지금까지는 각 라우트가 프로세스 메모리의 Map 만
 * 썼다 — 서버리스에서는 콜드스타트마다 비고 인스턴스도 여러 개라, 어제 조회한
 * 음식이 오늘 다시 Gemini 를 부르는 구조였다.
 *
 * 그래서 두 겹으로 둔다.
 *   1) 인메모리: 같은 인스턴스 안에서는 왕복 없이 즉시
 *   2) Supabase: 인스턴스와 사용자를 가로질러 살아남는다
 *
 * 캐시는 없어도 되는 부속이다. DB 가 없거나 테이블을 아직 안 만들었으면
 * 조용히 인메모리만 쓰고, 기능은 그대로 동작한다.
 */

/** 웜 인스턴스가 오래 살아도 메모리가 계속 늘지 않게 막는다. */
const MEM_MAX = 500;
const mem = new Map<string, unknown>();

/**
 * 테이블이 없으면 매 요청마다 실패하는 왕복을 반복하게 된다.
 * 한 번 확인하면 그 인스턴스에서는 더 시도하지 않는다.
 */
let dbCacheUsable = true;

function memGet<T>(k: string): T | undefined {
  const hit = mem.get(k);
  if (hit === undefined) return undefined;
  // 다시 쓰인 항목을 뒤로 보내 오래된 것부터 밀려나게 한다 (간이 LRU).
  mem.delete(k);
  mem.set(k, hit);
  return hit as T;
}

function memSet(k: string, v: unknown): void {
  if (mem.size >= MEM_MAX) {
    const oldest = mem.keys().next().value;
    if (oldest !== undefined) mem.delete(oldest);
  }
  mem.set(k, v);
}

/**
 * 캐시 키 정규화.
 *
 * "김치찌개 1그릇" 과 "김치찌개  1 그릇" 은 같은 질문이다. 공백을 하나로
 * 줄이지 않으면 같은 음식이 서로 다른 키로 쌓여 히트율이 떨어진다.
 */
export function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200);
}

export async function cacheGet<T>(kind: string, key: string): Promise<T | null> {
  const k = `${kind}:${key}`;

  const hit = memGet<T>(k);
  if (hit !== undefined) return hit;

  if (!db || !dbCacheUsable) return null;

  const { data, error } = await db
    .from("ai_cache")
    .select("value")
    .eq("kind", kind)
    .eq("key", key)
    .maybeSingle();

  if (error) {
    // 테이블 미생성(42P01) 등 — 캐시 없이 계속 간다.
    dbCacheUsable = false;
    console.warn("[ai-cache] 비활성화:", error.message);
    return null;
  }

  if (!data?.value) return null;
  memSet(k, data.value);
  return data.value as T;
}

/**
 * 캐시에 저장한다.
 *
 * persist 는 "이 결과를 DB 에도 남길지"다. AI 라우트는 로그인 없이도 쓸 수
 * 있고 주소가 공개돼 있어서, 아무나 임의의 문자열을 반복해 던지면 그게 전부
 * 영구 행으로 쌓인다. 그래서 **읽기는 누구나, 쓰기는 로그인한 사람만**으로
 * 나눈다. 비로그인 요청도 인메모리에는 남기므로 같은 인스턴스 안에서는
 * 그대로 빠르고, 남이 채워 둔 DB 캐시도 그대로 읽는다.
 */
export async function cacheSet(
  kind: string,
  key: string,
  value: unknown,
  persist: boolean,
): Promise<void> {
  memSet(`${kind}:${key}`, value);

  if (!persist || !db || !dbCacheUsable) return;

  const { error } = await db
    .from("ai_cache")
    .upsert({ kind, key, value }, { onConflict: "kind,key" });

  if (error) {
    dbCacheUsable = false;
    console.warn("[ai-cache] 쓰기 실패로 비활성화:", error.message);
  }
}

/** 새로고침 요청처럼 일부러 캐시를 버려야 할 때. */
export async function cacheDelete(kind: string, key: string): Promise<void> {
  mem.delete(`${kind}:${key}`);
  if (!db || !dbCacheUsable) return;
  await db.from("ai_cache").delete().eq("kind", kind).eq("key", key);
}
