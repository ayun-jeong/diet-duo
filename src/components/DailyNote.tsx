"use client";

import { Check, StickyNote } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDiet } from "@/lib/store";

/** 타이핑이 멎고 이만큼 지나면 자동 저장한다. */
const AUTOSAVE_MS = 800;

/**
 * 하루 메모.
 *
 * 걸음수 입력은 ExerciseCard 가 이미 담당하므로 여기서는 다루지 않는다.
 * (예전 구현에는 양쪽에 같은 입력이 있었고, 이 컴포넌트는 어디에도
 *  렌더되지 않는 죽은 코드였다.)
 */
export default function DailyNote() {
  const date = useDiet((s) => s.date);
  const storedMemo = useDiet((s) => s.log.memo ?? "");
  const setMemo = useDiet((s) => s.setMemo);

  const [text, setText] = useState(storedMemo);
  const [justSaved, setJustSaved] = useState(false);

  /** 사용자가 입력 중일 때는 저장소 값으로 덮어쓰지 않는다. */
  const editing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 날짜를 옮기거나 서버 동기화로 메모가 바뀌면 입력칸을 맞춘다.
   * 이 동기화가 없으면 어제 메모가 남은 채로 blur 되어 오늘 메모를 덮어쓴다.
   */
  useEffect(() => {
    if (editing.current) return;
    setText(storedMemo);
  }, [date, storedMemo]);

  // 날짜가 바뀌면 편집 상태와 예약된 저장을 정리한다.
  useEffect(() => {
    editing.current = false;
    if (timer.current) clearTimeout(timer.current);
  }, [date]);

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

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-bold">
          <StickyNote className="h-4 w-4 text-violet-500" />
          메모
        </h3>
        {justSaved && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-500">
            <Check className="h-3.5 w-3.5" />
            저장됨
          </span>
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => commit(text)}
        placeholder="컨디션, 오늘 느낀 점… 자유롭게 적어보세요."
        rows={3}
        className="mt-3 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 placeholder:text-gray-300"
      />
    </div>
  );
}
