"use client";

import {
  Activity,
  Dumbbell,
  Flame,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDiet } from "@/lib/store";
import { apiUrl } from "@/lib/api";
import type { DayLog } from "@/lib/types";

function stepsToKcal(steps: number, weightKg: number): number {
  return Math.round(steps * weightKg * 0.0005);
}

interface Props {
  /** 남의 운동 기록을 그릴 때 넘긴다. 넘기면 읽기 전용이 된다. */
  readOnlyLog?: DayLog;
}

export default function ExerciseCard({ readOnlyLog }: Props = {}) {
  const myLog = useDiet((s) => s.log);
  const profile = useDiet((s) => s.profile);

  const readOnly = readOnlyLog !== undefined;
  const log = readOnlyLog ?? myLog;
  const exercises = log.exercises;
  const addExercise = useDiet((s) => s.addExercise);
  const removeExercise = useDiet((s) => s.removeExercise);
  const setSteps = useDiet((s) => s.setSteps);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepsInput, setStepsInput] = useState(String(log.steps ?? 0));

  /**
   * 날짜가 바뀌거나, 같은 날짜의 걸음수가 저장소에서 갱신되면 입력칸을 맞춘다.
   * (이전에는 날짜가 바뀔 때만 동기화해서, 로그인 후 서버 걸음수가 도착해도
   *  입력칸은 0 을 들고 있다가 blur 시 그 0 을 다시 저장해 기록을 지웠다.)
   * 사용자가 입력 중일 때는 건드리지 않는다.
   */
  const editing = useRef(false);
  useEffect(() => {
    if (editing.current) return;
    setStepsInput(String(log.steps ?? 0));
  }, [log.date, log.steps]);

  const totalBurned = exercises.reduce((s, e) => s + e.burned, 0);
  // 파트너 체중은 공유하지 않으므로 남의 기록에서는 걸음수를 칼로리로 환산하지 않는다.
  const burnedKcal =
    !readOnly && profile && log.steps && log.steps > 0
      ? stepsToKcal(log.steps, profile.weightKg)
      : 0;
  const grandTotal = totalBurned + burnedKcal;

  const saveSteps = () => {
    editing.current = false;
    const n = Math.max(0, parseInt(stepsInput, 10) || 0);
    setStepsInput(String(n));
    setSteps(n);
  };

  const lookup = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/exercise/lookup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, weightKg: profile?.weightKg ?? 70 }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "조회 실패"); return; }
      await addExercise({ name: data.name || q, duration: data.duration || "", burned: data.burned });
      setQuery("");
      toast.success(`${data.name} · ${data.burned.toLocaleString()}kcal 소모`);
    } catch {
      toast.error("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">

      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-bold">
          <Dumbbell className="h-4 w-4 text-rose-500" />
          운동 기록
        </h3>
        {grandTotal > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-500 ring-1 ring-rose-100">
            <Flame className="h-3 w-3" />
            총 {grandTotal.toLocaleString()} kcal 소모
          </span>
        )}
      </div>

      {/* 본문: 운동(2) + 걸음수(1) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* 운동 목록 + 입력 */}
        <div className="flex flex-col gap-2.5 sm:col-span-2">
          <ul className="space-y-1.5">
            {exercises.map((ex) => (
              <li
                key={ex.id}
                className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{ex.name}</span>
                  {ex.duration && (
                    <span className="ml-2 text-xs text-gray-400">{ex.duration}</span>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold text-rose-600">
                  {ex.burned.toLocaleString()} kcal
                </span>
                {!readOnly && (
                  <button
                    onClick={() => removeExercise(ex.id)}
                    className="shrink-0 rounded-md p-1 text-rose-300 hover:bg-rose-100 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
            {exercises.length === 0 && (
              <li className="rounded-xl border border-dashed border-gray-200 py-3 text-center text-xs text-gray-400">
                {readOnly
                  ? "아직 운동 기록이 없어요"
                  : "운동을 입력하면 소모 칼로리가 자동 계산됩니다"}
              </li>
            )}
          </ul>

          {/* 입력창 — 남의 기록에서는 그리지 않는다 */}
          {!readOnly && (
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !loading) lookup(); }}
              placeholder="예: 배드민턴 30분, 달리기 1시간"
              className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-rose-400"
            />
            <button
              onClick={lookup}
              disabled={loading || !query.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              추가
            </button>
          </div>
          )}
        </div>

        {/* 걸음수 */}
        <div className="flex flex-col justify-center gap-3 rounded-2xl bg-gray-50 px-4 py-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            <Activity className="h-3.5 w-3.5 text-rose-400" />
            오늘 걸음수
          </div>
          <div>
            {readOnly ? (
              <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                {(log.steps ?? 0).toLocaleString()}
              </div>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <input
                  type="number"
                  value={stepsInput}
                  min={0}
                  onChange={(e) => { editing.current = true; setStepsInput(e.target.value); }}
                  onBlur={saveSteps}
                  onKeyDown={(e) => e.key === "Enter" && saveSteps()}
                  placeholder="0"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-rose-400"
                />
              </div>
            )}
            <p className="mt-1 text-right text-xs text-gray-400">걸음</p>
          </div>
          {burnedKcal > 0 ? (
            <div className="flex items-center justify-center gap-1 rounded-full bg-rose-100 py-1.5 text-xs font-semibold text-rose-500">
              <Flame className="h-3.5 w-3.5" />
              {burnedKcal.toLocaleString()} kcal
            </div>
          ) : (
            <p className="text-center text-xs text-gray-300">
              {readOnly ? <>체중을 공유하지 않아<br />칼로리는 계산하지 않아요</> : <>걸음수 입력 시<br />칼로리 반영</>}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
