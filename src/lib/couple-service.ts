import { apiUrl } from "./api";

export interface CoupleInfo {
  id: string;
  status: "pending" | "active";
  inviteCode: string;
  /** 파트너 user_id */
  partnerId?: string;
  /** 파트너 닉네임 */
  partnerName?: string;
  /** true = 내가 초대를 만든 쪽 (user_a) */
  isInitiator: boolean;
}

/**
 * 커플 기능은 전부 /api/couple 를 거친다.
 *
 * 이전에는 브라우저에서 Supabase 를 직접 호출했는데, 카카오 로그인은 Supabase 가
 * 모르는 사용자라 auth.uid() 가 항상 null 이었고 RLS 정책이 전부 막고 있었다.
 * 소유권 검사는 이제 서버가 NextAuth 세션으로 수행한다.
 */
/** 서버에 DB 가 없어 커플 기능 자체를 쓸 수 없는 상태 */
export class CoupleUnavailableError extends Error {
  constructor() {
    super("서버 동기화가 설정되지 않아 커플 기능을 사용할 수 없습니다.");
    this.name = "CoupleUnavailableError";
  }
}

async function call<T>(init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl("/api/couple"), {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (res.status === 503) throw new CoupleUnavailableError();

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `요청 실패 (${res.status})`);
  }
  return body as T;
}

export type CoupleStatus =
  | { kind: "none" }
  | { kind: "linked"; couple: CoupleInfo }
  | { kind: "unavailable" };

/** 현재 유저의 커플 상태 조회 */
export async function getCoupleStatus(): Promise<CoupleStatus> {
  try {
    const { couple } = await call<{ couple: CoupleInfo | null }>();
    return couple ? { kind: "linked", couple } : { kind: "none" };
  } catch (e) {
    // DB 미설정이면 버튼을 보여주고 눌렀을 때 실패시키는 대신, 아예 사용 불가로 표시한다.
    if (e instanceof CoupleUnavailableError) return { kind: "unavailable" };
    console.error("[couple] 상태 조회 실패:", e);
    return { kind: "none" };
  }
}

/** 초대 코드 생성 (이미 pending 이면 기존 코드 반환) */
export async function createInvite(): Promise<{ couple?: CoupleInfo; error?: string }> {
  try {
    const { couple } = await call<{ couple: CoupleInfo }>({
      method: "POST",
      body: JSON.stringify({ action: "create" }),
    });
    return { couple };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "초대 코드 생성 실패" };
  }
}

/** 초대 코드로 커플 연결 */
export async function acceptInvite(
  code: string,
): Promise<{ couple?: CoupleInfo; error?: string }> {
  try {
    const { couple } = await call<{ couple: CoupleInfo }>({
      method: "POST",
      body: JSON.stringify({ action: "accept", code }),
    });
    return { couple };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "연결 실패" };
  }
}

/** 커플 연결 해제 */
export async function disconnectCouple(): Promise<{ error?: string }> {
  try {
    await call({ method: "DELETE" });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "해제 실패" };
  }
}
