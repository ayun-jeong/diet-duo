import { apiUrl } from "./api";

export interface DuoInfo {
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
 * 메이트 연결은 전부 /api/duo 를 거친다.
 *
 * 이전에는 브라우저에서 Supabase 를 직접 호출했는데, 카카오 로그인은 Supabase 가
 * 모르는 사용자라 auth.uid() 가 항상 null 이었고 RLS 정책이 전부 막고 있었다.
 * 소유권 검사는 이제 서버가 NextAuth 세션으로 수행한다.
 */
/** 서버에 DB 가 없어 메이트 연결 자체를 쓸 수 없는 상태 */
export class DuoUnavailableError extends Error {
  constructor() {
    super("서버 동기화가 설정되지 않아 메이트 연결 기능을 사용할 수 없습니다.");
    this.name = "DuoUnavailableError";
  }
}

async function call<T>(init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl("/api/duo"), {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (res.status === 503) throw new DuoUnavailableError();

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `요청 실패 (${res.status})`);
  }
  return body as T;
}

export type DuoStatus =
  | { kind: "none" }
  | { kind: "linked"; duo: DuoInfo }
  | { kind: "unavailable" }
  /** 조회 자체가 실패 — "연결 없음"과 섞으면 안 된다 */
  | { kind: "error" };

/** 현재 유저의 연결 상태 조회 */
export async function getDuoStatus(): Promise<DuoStatus> {
  try {
    const { duo } = await call<{ duo: DuoInfo | null }>();
    return duo ? { kind: "linked", duo } : { kind: "none" };
  } catch (e) {
    // DB 미설정이면 버튼을 보여주고 눌렀을 때 실패시키는 대신, 아예 사용 불가로 표시한다.
    if (e instanceof DuoUnavailableError) return { kind: "unavailable" };
    /*
     * 연결 없음은 서버가 duo:null 을 명시적으로 돌려줬을 때만 주장한다.
     * 네트워크 오류나 배포 직후 옛 번들의 404 를 "연결 없음"으로 읽으면,
     * 멀쩡히 연결된 사람에게 초대 코드 화면을 들이밀게 된다.
     */
    console.error("[duo] 상태 조회 실패:", e);
    return { kind: "error" };
  }
}

/** 초대 코드 생성 (이미 pending 이면 기존 코드 반환) */
export async function createInvite(): Promise<{ duo?: DuoInfo; error?: string }> {
  try {
    const { duo } = await call<{ duo: DuoInfo }>({
      method: "POST",
      body: JSON.stringify({ action: "create" }),
    });
    return { duo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "초대 코드 생성 실패" };
  }
}

/** 초대 코드로 메이트 연결 */
export async function acceptInvite(
  code: string,
): Promise<{ duo?: DuoInfo; error?: string }> {
  try {
    const { duo } = await call<{ duo: DuoInfo }>({
      method: "POST",
      body: JSON.stringify({ action: "accept", code }),
    });
    return { duo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "연결 실패" };
  }
}

/** 메이트 연결 해제 */
export async function unlink(): Promise<{ error?: string }> {
  try {
    await call({ method: "DELETE" });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "해제 실패" };
  }
}
