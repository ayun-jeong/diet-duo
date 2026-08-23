export interface MemoPosition {
  x: number;
  y: number;
}

/**
 * 포스트잇 위치·접힘 상태는 기기마다 다르므로 서버에 동기화하지 않는다.
 * (데스크톱에서 놓은 좌표를 휴대폰에 그대로 적용하면 화면 밖으로 나간다.)
 * 메모 "내용"만 계정에 동기화된다.
 */
const POS_KEY = "diet:memo-pos";
const COLLAPSED_KEY = "diet:memo-collapsed";

export function readPosition(): MemoPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as MemoPosition;
    return typeof p?.x === "number" && typeof p?.y === "number" ? p : null;
  } catch {
    return null;
  }
}

export function writePosition(pos: MemoPosition): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POS_KEY, JSON.stringify(pos));
  } catch {
    /* 무시 */
  }
}

export function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* 무시 */
  }
}

/** 창 크기가 바뀌어도 포스트잇이 화면 밖으로 사라지지 않게 가둔다. */
export function clamp(pos: MemoPosition, w: number, h: number): MemoPosition {
  if (typeof window === "undefined") return pos;
  const maxX = Math.max(0, window.innerWidth - w);
  const maxY = Math.max(0, window.innerHeight - h);
  return {
    x: Math.min(Math.max(0, pos.x), maxX),
    y: Math.min(Math.max(0, pos.y), maxY),
  };
}
