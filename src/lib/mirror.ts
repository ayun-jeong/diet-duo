import type { BootstrapData } from "./storage";

/**
 * 로그인 사용자의 마지막 서버 응답을 localStorage 에 복사해 둔다.
 *
 * 목적은 오프라인 지원이 아니라 초기 렌더 지연 제거다.
 * 앱을 다시 열면 서버 응답을 기다리지 않고 이 값으로 즉시 그린 뒤,
 * 응답이 도착하면 조용히 교체한다.
 *
 * 한 브라우저를 두 계정이 쓸 수 있으므로 사용자별로 키를 나눈다.
 */
const key = (userId: string) => `diet:mirror:${userId}`;

export function readMirror(userId: string): BootstrapData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as BootstrapData) : null;
  } catch {
    return null;
  }
}

export function writeMirror(userId: string, data: BootstrapData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(data));
  } catch {
    /* 용량 초과 시 캐시만 포기한다 */
  }
}

export function clearMirror(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(userId));
  } catch {
    /* 무시 */
  }
}

/**
 * 마지막으로 로그인했던 사용자 id.
 *
 * 앱을 다시 열면 NextAuth 세션 확인(/api/auth/session 왕복)이 끝나기 전까지는
 * 내가 누구인지 알 수 없다. 그 사이에도 캐시를 찾아 그리기 위해 따로 남겨둔다.
 */
const LAST_USER_KEY = "diet:last-user";

export function readLastUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export function writeLastUserId(userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) window.localStorage.setItem(LAST_USER_KEY, userId);
    else window.localStorage.removeItem(LAST_USER_KEY);
  } catch {
    /* 무시 */
  }
}
