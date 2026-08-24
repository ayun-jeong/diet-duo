import { db } from "./db";

/**
 * 활성 커플의 상대방 id.
 *
 * 연결이 없으면 null. 파트너 기록을 읽거나 쓰는 모든 라우트가 이 함수를 거쳐
 * "정말 연결된 사이인가"를 한 곳에서 판단하게 한다.
 */
export async function getPartnerId(userId: string): Promise<string | null> {
  if (!db) return null;

  const { data } = await db
    .from("couples")
    .select("user_a, user_b")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .eq("status", "active")
    .maybeSingle();

  if (!data) return null;
  return data.user_a === userId ? data.user_b : data.user_a;
}
