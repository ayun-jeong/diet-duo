"use client";

import { Check, GripHorizontal, Minus, Palette, StickyNote, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDiet } from "@/lib/store";
import {
  MEMO_COLORS,
  MEMO_COLOR_KEYS,
  memoTheme,
  type Memo,
  type MemoColor,
} from "@/lib/memo";
import {
  clamp,
  clearMemoLocalState,
  readCollapsed,
  readPosition,
  writeCollapsed,
  writePosition,
  type MemoPosition,
} from "@/lib/memo-position";

/** 타이핑이 멎고 이만큼 지나면 자동 저장한다. */
const AUTOSAVE_MS = 800;

const CARD_W = 256;
const CARD_H = 220;
const DOT = 48;
const MARGIN = 16;
/** 새 메모를 나란히 놓을 때의 간격 */
const GAP = 12;
/** 나란히 놓을 자리가 떨어졌을 때 비스듬히 밀어 놓는 간격 */
const CASCADE = 28;

/**
 * 새 메모가 처음 붙는 자리.
 *
 * 오른쪽 아래에서 시작해 왼쪽으로 한 장씩 채우고, 한 줄이 차면 윗줄로 올라간다.
 * 24px 씩만 어긋나게 두면 여러 장을 붙여도 한 장처럼 보여서 나란히 놓는다.
 * 화면이 좁아 줄이 더 없으면 그때만 비스듬히 겹친다.
 */
function defaultPosition(index: number): MemoPosition {
  const cols = Math.max(1, Math.floor((window.innerWidth - MARGIN) / (CARD_W + GAP)));
  const col = index % cols;
  const row = Math.floor(index / cols);

  const x = window.innerWidth - MARGIN - CARD_W - col * (CARD_W + GAP);
  const y = window.innerHeight - MARGIN - CARD_H - row * (CARD_H + GAP);

  // 윗줄까지 다 찼으면 오른쪽 아래에서 다시 비스듬히 쌓는다.
  if (y < MARGIN) {
    const offset = (index % 6) * CASCADE;
    return {
      x: window.innerWidth - MARGIN - CARD_W - offset,
      y: window.innerHeight - MARGIN - CARD_H - offset,
    };
  }
  return { x, y };
}

/**
 * 화면 어디에나 붙일 수 있는 포스트잇 메모 한 장.
 *
 * 레이아웃 흐름에서 빠져나와 position:fixed 로 떠 있고, 헤더를 잡아 끌어
 * 원하는 자리에 놓을 수 있다. 위치·접힘은 기기별 localStorage 에 남고,
 * 내용과 색은 계정에 동기화된다.
 *
 * z-index 는 30 — 사이드패널(40)과 로그인 모달(50) 아래에 둬서 그것들을 가리지 않는다.
 */
export default function StickyMemo({ memo, index }: { memo: Memo; index: number }) {
  const updateMemo = useDiet((s) => s.updateMemo);
  const removeMemo = useDiet((s) => s.removeMemo);

  const [text, setText] = useState(memo.text);
  const [justSaved, setJustSaved] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState<MemoPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pickingColor, setPickingColor] = useState(false);

  const editing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 포인터를 누른 지점과 카드 좌상단의 간격 — 끌 때 튀지 않게 한다. */
  const grab = useRef<MemoPosition>({ x: 0, y: 0 });
  /** 누른 뒤 실제로 움직였는지 — 접힌 동그라미에서 '클릭'과 '드래그'를 가른다. */
  const moved = useRef(false);

  const theme = memoTheme(memo.color);
  const size = collapsed ? { w: DOT, h: DOT } : { w: CARD_W, h: CARD_H };

  // 최초 위치: 저장된 값이 없으면 우측 하단에서 장수만큼 어긋나게 놓는다.
  // 새로 놓은 자리는 바로 기록해 둬야 다른 메모를 지워도 자리가 흔들리지 않는다.
  useEffect(() => {
    const saved = readPosition(memo.id);
    if (saved) {
      setPos(clamp(saved, CARD_W, CARD_H));
    } else {
      const initial = clamp(defaultPosition(index), CARD_W, CARD_H);
      setPos(initial);
      writePosition(memo.id, initial);
    }
    setCollapsed(readCollapsed(memo.id));
    // 메모가 바뀌면(=다른 장) 다시 잡는다. index 는 최초 배치에만 쓰인다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memo.id]);

  // 창 크기가 바뀌면 화면 안으로 되돌린다.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p, size.w, size.h) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [size.w, size.h]);

  useEffect(() => {
    if (editing.current) return;
    setText(memo.text);
  }, [memo.text]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const flash = () => {
    setJustSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(false), 1500);
  };

  const commit = (value: string) => {
    editing.current = false;
    if (timer.current) clearTimeout(timer.current);
    if (value === memo.text) return;
    updateMemo(memo.id, { text: value });
    flash();
  };

  const handleChange = (value: string) => {
    editing.current = true;
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(value), AUTOSAVE_MS);
  };

  /** 메모 한 장을 통째로 뗀다. */
  const remove = () => {
    if (text.trim() && !confirm("이 메모를 떼어낼까요?")) return;
    if (timer.current) clearTimeout(timer.current);
    editing.current = false;
    clearMemoLocalState(memo.id);
    removeMemo(memo.id);
  };

  const pickColor = (color: MemoColor) => {
    setPickingColor(false);
    if (color === memo.color) return;
    updateMemo(memo.id, { color });
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setPickingColor(false);
    writeCollapsed(memo.id, next);
    // 접거나 펼치면 크기가 달라지므로 다시 화면 안으로 가둔다.
    setPos((p) => (p ? clamp(p, next ? DOT : CARD_W, next ? DOT : CARD_H) : p));
  };

  /* ── 드래그 (마우스·터치 공통: Pointer Events) ── */

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!pos) return;
      // 헤더의 버튼을 눌렀을 때는 끌지 않는다.
      if ((e.target as HTMLElement).closest("button")) return;
      grab.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      moved.current = false;
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      e.preventDefault();
      moved.current = true;
      setPos(
        clamp(
          { x: e.clientX - grab.current.x, y: e.clientY - grab.current.y },
          size.w,
          size.h,
        ),
      );
    },
    [dragging, size.w, size.h],
  );

  const endDrag = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    setPos((p) => {
      if (p) writePosition(memo.id, p);
      return p;
    });
  }, [dragging, memo.id]);

  // 위치 계산 전에는 그리지 않는다.
  if (!pos) return null;

  const dragHandleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    // 터치에서 드래그가 스크롤로 가로채이지 않게 한다.
    style: { touchAction: "none" as const },
  };

  /* ── 접힌 상태: 동그란 손잡이 ── */
  // 안쪽을 button 으로 채우면 onPointerDown 의 closest("button") 가드에 걸려
  // 끌 수 없게 된다. 대신 div 로 두고, 움직이지 않았을 때만 펼침으로 처리한다.
  if (collapsed) {
    return (
      <div
        {...dragHandleProps}
        onPointerUp={(e) => {
          endDrag();
          if (!moved.current) {
            e.stopPropagation();
            toggleCollapsed();
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") toggleCollapsed();
        }}
        title="메모 펼치기 (끌어서 이동)"
        className={`fixed z-30 flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-1 ${theme.head} ${theme.ring} ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ ...dragHandleProps.style, left: pos.x, top: pos.y }}
      >
        <StickyNote className={`h-5 w-5 ${theme.headText}`} />
        {text.trim() && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
        )}
      </div>
    );
  }

  /* ── 펼친 상태: 포스트잇 ── */
  return (
    <div
      className={`fixed z-30 flex w-64 flex-col rounded-lg shadow-xl ring-1 ${theme.body} ${theme.ring} ${
        dragging ? "opacity-90" : ""
      }`}
      style={{ left: pos.x, top: pos.y, height: CARD_H }}
    >
      {/* 헤더 = 드래그 손잡이 */}
      <div
        {...dragHandleProps}
        className={`flex shrink-0 items-center gap-1 rounded-t-lg px-2 py-1.5 ${theme.head} ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <GripHorizontal className={`h-3.5 w-3.5 ${theme.headText}`} />
        <span className={`text-xs font-bold ${theme.headText}`}>메모</span>

        <div className="ml-auto flex items-center gap-0.5">
          {justSaved && (
            <span className="mr-1 flex items-center gap-0.5 text-[10px] font-medium text-emerald-700">
              <Check className="h-3 w-3" />
              저장됨
            </span>
          )}
          <button
            onClick={() => setPickingColor((v) => !v)}
            title="색 바꾸기"
            className={`rounded p-1 ${theme.headText} ${theme.headHover}`}
          >
            <Palette className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={remove}
            title="메모 떼어내기"
            className={`rounded p-1 ${theme.headText} ${theme.headHover}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={toggleCollapsed}
            title="접기"
            className={`rounded p-1 ${theme.headText} ${theme.headHover}`}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 색 고르기 */}
      {pickingColor && (
        <div
          className={`flex shrink-0 items-center justify-center gap-2 border-b border-black/5 px-2 py-1.5 ${theme.head}`}
        >
          {MEMO_COLOR_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => pickColor(key)}
              title={MEMO_COLORS[key].label}
              className={`h-5 w-5 rounded-full ring-1 ring-black/10 transition hover:scale-110 ${
                MEMO_COLORS[key].swatch
              } ${key === memo.color ? "ring-2 ring-gray-500" : ""}`}
            />
          ))}
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => commit(text)}
        placeholder="장보기 목록, 목표, 기억할 것…"
        className={`flex-1 resize-none rounded-b-lg bg-transparent px-3 py-2 text-sm outline-none ${theme.bodyText} ${theme.placeholder}`}
      />
    </div>
  );
}
