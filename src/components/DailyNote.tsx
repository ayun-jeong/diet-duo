"use client";

import { Activity, Flame, Info, StickyNote } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDiet } from "@/lib/store";

function stepsToKcal(steps: number, weightKg: number): number {
  return Math.round(steps * weightKg * 0.0005);
}

export default function DailyNote() {
  const log = useDiet((s) => s.log);
  const profile = useDiet((s) => s.profile);
  const setMemo = useDiet((s) => s.setMemo);
  const setSteps = useDiet((s) => s.setSteps);

  const [memo, setMemoLocal] = useState(log.memo ?? "");
  const [stepsInput, setStepsInput] = useState(String(log.steps ?? 0));

  // 날짜 이동 시 로컬 상태 동기화
  const prevDate = useRef(log.date);
  useEffect(() => {
    if (prevDate.current !== log.date) {
      setMemoLocal(log.memo ?? "");
      setStepsInput(String(log.steps ?? 0));
      prevDate.current = log.date;
    }
  }, [log.date, log.memo, log.steps]);

  const burnedKcal =
    profile && log.steps && log.steps > 0
      ? stepsToKcal(log.steps, profile.weightKg)
      : 0;

  const saveSteps = () => {
    const n = Math.max(0, parseInt(stepsInput, 10) || 0);
    setStepsInput(String(n));
    setSteps(n);
  };

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h3 className="flex items-center gap-2 font-bold">
        <StickyNote className="h-4 w-4 text-violet-500" />
        오늘의 기록
      </h3>

      {/* 메모 */}
      <textarea
        value={memo}
        onChange={(e) => setMemoLocal(e.target.value)}
        onBlur={() => setMemo(memo)}
        placeholder="컨디션, 운동 종류, 오늘 느낀 점… 자유롭게 적어보세요."
        rows={2}
        className="mt-3 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 placeholder:text-gray-300"
      />

      {/* 걸음수 */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Activity className="h-4 w-4 shrink-0 text-rose-400" />
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={stepsInput}
            min={0}
            onChange={(e) => setStepsInput(e.target.value)}
            onBlur={saveSteps}
            onKeyDown={(e) => e.key === "Enter" && saveSteps()}
            placeholder="0"
            className="w-28 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-rose-400"
          />
          <span className="text-sm text-gray-500">걸음</span>
        </div>

        {burnedKcal > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-500">
            <Flame className="h-3.5 w-3.5" />
            {burnedKcal.toLocaleString()} kcal 소모
          </div>
        )}
      </div>

      {/* 연동 안내 */}
      <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-gray-50 px-3 py-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
        <p className="text-xs text-gray-400">
          Apple Health · Google Fit 연동은 웹 브라우저에서 지원하지 않습니다.
          핸드폰 건강 앱에서 걸음수를 확인 후 수동으로 입력하면 목표 칼로리에 자동 반영됩니다.
        </p>
      </div>
    </div>
  );
}
