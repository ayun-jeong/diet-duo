"use client";

import { Check, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDiet } from "@/lib/store";

/** 타이핑이 멎고 이만큼 지나면 자동 저장한다. */
const AUTOSAVE_MS = 800;

/**
 * 메모 (포스트잇).
 *
 * 하루 기록이 아니라 사용자 단위로 저장한다. 날짜를 옮겨도 그대로 붙어 있고,
 * 직접 지울 때까지 남는다.
 *
 * 걸음수 입력은 ExerciseCard 가 담당하므로 여기서는 다루지 않는다.
 */
export default function DailyNote() {
  const storedMemo = useDiet((s) => s.memo);
  const setMemo = useDiet((s) => s.setMemo);

  const [text, setText] = useState(storedMemo);
  const [justSaved, setJustSaved] = useState(false);

  /** 사용자가 입력 중일 때는 저장소 값으로 덮어쓰지 않는다. */
  const editing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 로그인 후 서버 메모가 도착하면 입력칸을 맞춘다.
   * (이 동기화가 없으면 빈 입력칸이 남아 있다가 저장되며 서버 메모를 지운다.)
   */
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

    // 타이핑이 멎으면 알아서 저장한다 (저장 버튼 없이).
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(value), AUTOSAVE_MS);
  };

  const clear = () => {
    if (!text.trim()) return;
    if (!confirm("메모를 지우시겠어요?")) return;
    setText("");
    commit("");
  };

  return (
    <div className="rounded-2xl bg-amber-50 p-5 shadow-sm ring-1 ring-amber-200">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-bold text-amber-900">
          <StickyNote className="h-4 w-4 text-amber-500" />
          메모
        </h3>
        <div className="flex items-center gap-2">
          {justSaved && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Check className="h-3.5 w-3.5" />
              저장됨
            </span>
          )}
          {text.trim() && (
            <button
              onClick={clear}
              title="메모 지우기"
              className="rounded-md p-1 text-amber-400 hover:bg-amber-100 hover:text-amber-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => commit(text)}
        placeholder="장보기 목록, 목표, 기억할 것… 지울 때까지 계속 남아 있어요."
        rows={3}
        className="mt-3 w-full resize-none rounded-xl border border-amber-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-amber-400 placeholder:text-amber-300"
      />
    </div>
  );
}
