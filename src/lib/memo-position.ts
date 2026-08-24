import { LEGACY_MEMO_ID } from "./memo";

export interface MemoPosition {
  x: number;
  y: number;
}

/**
 * 포스트잇 위치·접힘 상태는 기기마다 다르므로 서버에 동기화하지 않는다.
 * (데스크톱에서 놓은 좌표를 휴대폰에 그대로 적용하면 화면 밖으로 나간다.)
 * 메모 "내용"과 "색"만 계정에 동기화된다.
 *
 * 메모가 여러 장이 되면서 키를 메모 id 별로 나눈다.
 * 구버전이 남긴 단일 키는 옮겨온 메모(LEGACY_MEMO_ID)가 이어받는다.
 */
const posKey = (id: string) => `diet:memo-pos:${id}`;
const collapsedKey = (id: string) => `diet:memo-collapsed:${id}`;

const LEGACY_POS_KEY = "diet:memo-pos";
const LEGACY_COLLAPSED_KEY = "diet:memo-collapsed";

function rawGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function rawSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 무시 */
  }
}

function parsePosition(raw: string | null): MemoPosition | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as MemoPosition;
    return typeof p?.x === "number" && typeof p?.y === "number" ? p : null;
  } catch {
    return null;
  }
}

export function readPosition(id: string): MemoPosition | null {
  const own = parsePosition(rawGet(posKey(id)));
  if (own) return own;
  // 구버전에서 옮겨온 메모는 예전 좌표를 그대로 쓴다.
  return id === LEGACY_MEMO_ID ? parsePosition(rawGet(LEGACY_POS_KEY)) : null;
}

export function writePosition(id: string, pos: MemoPosition): void {
  rawSet(posKey(id), JSON.stringify(pos));
}

export function readCollapsed(id: string): boolean {
  const own = rawGet(collapsedKey(id));
  if (own !== null) return own === "1";
  return id === LEGACY_MEMO_ID && rawGet(LEGACY_COLLAPSED_KEY) === "1";
}

export function writeCollapsed(id: string, collapsed: boolean): void {
  rawSet(collapsedKey(id), collapsed ? "1" : "0");
}

/** 메모를 지울 때 이 기기에 남은 위치·접힘 기록도 함께 치운다. */
export function clearMemoLocalState(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(posKey(id));
    window.localStorage.removeItem(collapsedKey(id));
    if (id === LEGACY_MEMO_ID) {
      window.localStorage.removeItem(LEGACY_POS_KEY);
      window.localStorage.removeItem(LEGACY_COLLAPSED_KEY);
    }
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
