"use client";

import { Check, GripHorizontal, Minus, StickyNote, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDiet } from "@/lib/store";
import {
  clamp,
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

/**
 * 화면 어디에나 붙일 수 있는 포스트잇 메모.
 *
 * 레이아웃 흐름에서 빠져나와 position:fixed 로 떠 있고, 헤더를 잡아 끌어
 * 원하는 자리에 놓을 수 있다. 위치는 기기별 localStorage 에 남고,
 * 메모 내용은 계정에 동기화된다.
 *
 * z-index 는 30 — 사이드패널(40)과 로그인 모달(50) 아래에 둬서 그것들을 가리지 않는다.
 */
export default function StickyMemo() {
  const storedMemo = useDiet((s) => s.memo);
  const setMemo = useDiet((s) => s.setMemo);
  const ready = useDiet((s) => s.ready);

  const [text, setText] = useState(storedMemo);
  const [justSaved, setJustSaved] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState<MemoPosition | null>(null);
  const [dragging, setDragging] = useState(false);

  const editing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 포인터를 누른 지점과 카드 좌상단의 간격 — 끌 때 튀지 않게 한다. */
  const grab = useRef<MemoPosition>({ x: 0, y: 0 });
  /** 누른 뒤 실제로 움직였는지 — 접힌 동그라미에서 '클릭'과 '드래그'를 가른다. */
  const moved = useRef(false);

  const size = collapsed ? { w: DOT, h: DOT } : { w: CARD_W, h: CARD_H };

  // 최초 위치: 저장된 값이 없으면 우측 하단
  useEffect(() => {
    const saved = readPosition();
    const initial =
      saved ??
      {
        x: window.innerWidth - CARD_W - MARGIN,
        y: window.innerHeight - CARD_H - MARGIN,
      };
    setPos(clamp(initial, CARD_W, CARD_H));
    setCollapsed(readCollapsed());
  }, []);

  // 창 크기가 바뀌면 화면 안으로 되돌린다.
  useEffect(() => {
    const onResize = () =>
      setPos((p) => (p ? clamp(p, size.w, size.h) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [size.w, size.h]);

  useEffect(() => {
    if (editing.current) return;
    setText(storedMemo);
  }, [storedMemo]);

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
    if (value === storedMemo) return;
    setMemo(value);
    flash();
  };

  const handleChange = (value: string) => {
    editing.current = true;
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(value), AUTOSAVE_MS);
  };

  const clear = () => {
    if (!text.trim()) return;
    if (!confirm("메모를 지우시겠어요?")) return;
    setText("");
    commit("");
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(next);
    // 접거나 펼치면 크기가 달라지므로 다시 화면 안으로 가둔다.
    setPos((p) =>
      p ? clamp(p, next ? DOT : CARD_W, next ? DOT : CARD_H) : p,
    );
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
      if (p) writePosition(p);
      return p;
    });
  }, [dragging]);

  // 위치 계산 전이나 초기 로딩 중에는 그리지 않는다.
  if (!ready || !pos) return null;

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
        className={`fixed z-30 flex h-12 w-12 items-center justify-center rounded-full bg-amber-300 shadow-lg ring-1 ring-amber-400 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ ...dragHandleProps.style, left: pos.x, top: pos.y }}
      >
        <StickyNote className="h-5 w-5 text-amber-900" />
        {text.trim() && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-amber-300" />
        )}
      </div>
    );
  }

  /* ── 펼친 상태: 포스트잇 ── */
  return (
    <div
      className={`fixed z-30 flex w-64 flex-col rounded-lg bg-amber-200 shadow-xl ring-1 ring-amber-300 ${
        dragging ? "opacity-90" : ""
      }`}
      style={{ left: pos.x, top: pos.y, height: CARD_H }}
    >
      {/* 헤더 = 드래그 손잡이 */}
      <div
        {...dragHandleProps}
        className={`flex shrink-0 items-center gap-1 rounded-t-lg bg-amber-300/70 px-2 py-1.5 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <GripHorizontal className="h-3.5 w-3.5 text-amber-700" />
        <span className="text-xs font-bold text-amber-900">메모</span>

        <div className="ml-auto flex items-center gap-0.5">
          {justSaved && (
            <span className="mr-1 flex items-center gap-0.5 text-[10px] font-medium text-emerald-700">
              <Check className="h-3 w-3" />
              저장됨
            </span>
          )}
          {text.trim() && (
            <button
              onClick={clear}
              title="메모 지우기"
              className="rounded p-1 text-amber-700 hover:bg-amber-400/60"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={toggleCollapsed}
            title="접기"
            className="rounded p-1 text-amber-700 hover:bg-amber-400/60"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => commit(text)}
        placeholder="장보기 목록, 목표, 기억할 것…"
        className="flex-1 resize-none rounded-b-lg bg-amber-100 px-3 py-2 text-sm text-amber-950 outline-none placeholder:text-amber-400"
      />
    </div>
  );
}
