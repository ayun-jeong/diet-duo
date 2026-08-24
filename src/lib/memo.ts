/**
 * 포스트잇 메모.
 *
 * 여러 장을 붙일 수 있고, 각 장은 자기 색을 가진다.
 * 저장은 기존 memo 칸(문자열) 하나에 JSON 배열로 직렬화해 넣는다.
 * DB 스키마를 건드리지 않으면서 여러 장을 담기 위한 선택이며,
 * 구버전이 남긴 순수 텍스트 한 장도 그대로 읽어 들인다.
 */

export type MemoColor = "mint" | "sky" | "sand" | "blush" | "lilac";

export interface Memo {
  id: string;
  text: string;
  color: MemoColor;
}

export interface MemoTheme {
  label: string;
  /** 헤더(드래그 손잡이) · 접힌 동그라미 배경 */
  head: string;
  /** 본문 텍스트 영역 배경 */
  body: string;
  ring: string;
  headText: string;
  bodyText: string;
  placeholder: string;
  headHover: string;
  /** 색 고르기 점 */
  swatch: string;
}

/**
 * 사이트 기조색(emerald)과 배경(#f7f8fa)에 얹었을 때 튀지 않도록
 * 전부 같은 톤(파스텔 100~200 계열)으로 맞춘 팔레트.
 */
export const MEMO_COLORS: Record<MemoColor, MemoTheme> = {
  mint: {
    label: "민트",
    head: "bg-emerald-200",
    body: "bg-emerald-50",
    ring: "ring-emerald-300",
    headText: "text-emerald-800",
    bodyText: "text-emerald-900",
    placeholder: "placeholder:text-emerald-400",
    headHover: "hover:bg-emerald-300",
    swatch: "bg-emerald-300",
  },
  sky: {
    label: "하늘",
    head: "bg-sky-200",
    body: "bg-sky-50",
    ring: "ring-sky-300",
    headText: "text-sky-800",
    bodyText: "text-sky-900",
    placeholder: "placeholder:text-sky-400",
    headHover: "hover:bg-sky-300",
    swatch: "bg-sky-300",
  },
  sand: {
    label: "모래",
    head: "bg-amber-200",
    body: "bg-amber-50",
    ring: "ring-amber-300",
    headText: "text-amber-800",
    bodyText: "text-amber-900",
    placeholder: "placeholder:text-amber-400",
    headHover: "hover:bg-amber-300",
    swatch: "bg-amber-300",
  },
  blush: {
    label: "코랄",
    head: "bg-rose-200",
    body: "bg-rose-50",
    ring: "ring-rose-300",
    headText: "text-rose-800",
    bodyText: "text-rose-900",
    placeholder: "placeholder:text-rose-400",
    headHover: "hover:bg-rose-300",
    swatch: "bg-rose-300",
  },
  lilac: {
    label: "라일락",
    head: "bg-violet-200",
    body: "bg-violet-50",
    ring: "ring-violet-300",
    headText: "text-violet-800",
    bodyText: "text-violet-900",
    placeholder: "placeholder:text-violet-400",
    headHover: "hover:bg-violet-300",
    swatch: "bg-violet-300",
  },
};

export const MEMO_COLOR_KEYS = Object.keys(MEMO_COLORS) as MemoColor[];

export const DEFAULT_MEMO_COLOR: MemoColor = "mint";

/** 메모 한 장의 최대 글자 수 (서버 저장 한도를 넘지 않게 하는 안전선) */
export const MEMO_TEXT_MAX = 2000;

/** 붙일 수 있는 메모 장수 */
export const MEMO_MAX_COUNT = 20;

/**
 * 구버전 메모(문자열 한 장)를 옮겨올 때 쓰는 고정 id.
 * 고정값이라야 이미 저장돼 있던 위치·접힘 상태를 그대로 이어받을 수 있다.
 */
export const LEGACY_MEMO_ID = "legacy";

export function newMemoId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function memoTheme(color: MemoColor): MemoTheme {
  return MEMO_COLORS[color] ?? MEMO_COLORS[DEFAULT_MEMO_COLOR];
}

/** 새 메모의 색 — 이미 붙어 있는 장수에 따라 팔레트를 돌아가며 쓴다. */
export function nextMemoColor(count: number): MemoColor {
  return MEMO_COLOR_KEYS[count % MEMO_COLOR_KEYS.length];
}

function normalizeMemo(raw: unknown): Memo | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<Memo>;
  const text = typeof m.text === "string" ? m.text.slice(0, MEMO_TEXT_MAX) : "";
  const color =
    typeof m.color === "string" && m.color in MEMO_COLORS
      ? (m.color as MemoColor)
      : DEFAULT_MEMO_COLOR;
  return {
    id: typeof m.id === "string" && m.id ? m.id : newMemoId(),
    text,
    color,
  };
}

/** 메모 목록 → 저장용 문자열 */
export function serializeMemos(memos: Memo[]): string {
  return memos.length ? JSON.stringify(memos) : "";
}

/**
 * 저장된 문자열 → 메모 목록.
 *
 * JSON 배열이면 그대로 읽고, 아니면 구버전이 남긴 메모 한 장으로 본다.
 */
export function parseMemos(raw: string | null | undefined): Memo[] {
  if (!raw) return [];

  if (raw.trimStart().startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map(normalizeMemo)
          .filter((m): m is Memo => m !== null)
          .slice(0, MEMO_MAX_COUNT);
      }
    } catch {
      // JSON 이 아니면 아래 구버전 처리로 내려간다.
    }
  }

  return [
    { id: LEGACY_MEMO_ID, text: raw.slice(0, MEMO_TEXT_MAX), color: DEFAULT_MEMO_COLOR },
  ];
}
