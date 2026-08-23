"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { calcGoalCalories } from "@/lib/nutrition";
import { useDiet, todayStr } from "@/lib/store";

const DAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];

type DayStatus = "over" | "good" | "under" | "empty";

const STATUS_BG: Record<DayStatus, string> = {
  over: "bg-rose-100 text-rose-600",
  good: "bg-emerald-100 text-emerald-700",
  under: "bg-amber-100 text-amber-600",
  empty: "text-gray-300",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export default function CalendarWidget() {
  const profile = useDiet((s) => s.profile);
  const currentDate = useDiet((s) => s.date); // 현재 보고 있는 날짜
  const setDate = useDiet((s) => s.setDate);

  const today = todayStr();
  const todayObj = new Date(today + "T00:00:00");

  const [viewYear, setViewYear] = useState(todayObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayObj.getMonth()); // 0-indexed

  const summaries = useDiet((s) => s.summaries);
  const loadSummaries = useDiet((s) => s.loadSummaries);
  // 로그인/로그아웃으로 저장소가 바뀌면 요약 캐시가 비워지므로 다시 조회한다.
  const storageGen = useDiet((s) => s.storageGen);

  /**
   * 보고 있는 달을 한 번의 range 조회로 가져온다.
   *
   * 이전에는 날짜마다 storage.getDayLog() 를 불러 한 달에 최대 31회를 개별 왕복했고,
   * loadingRef 가드 때문에 로딩 중 달을 넘기면 그 달은 아예 조회되지 않고
   * 이전 달 수치가 남아 있었다.
   */
  useEffect(() => {
    if (!profile) return;
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    const from = toDateStr(viewYear, viewMonth, 1);
    const to = toDateStr(viewYear, viewMonth, lastDay);
    void loadSummaries(from, to > today ? today : to);
  }, [viewYear, viewMonth, profile, loadSummaries, today, storageGen]);

  const target = profile ? Math.round(calcGoalCalories(profile)) : 0;

  const getStatus = (dateStr: string): DayStatus => {
    const kcal = summaries[dateStr]?.kcal;
    if (!kcal || kcal === 0) return "empty";
    const ratio = kcal / target;
    if (ratio > 1.05) return "over";
    if (ratio >= 0.8) return "good";
    return "under";
  };

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const canGoPrev = toDateStr(viewYear, viewMonth, 1) > "2020-01-01";

  // 다음 달 1일이 오늘 이후면 이동할 곳이 없다.
  // (구현이 toDateStr(y, viewMonth + 1, 1) 이라 12월에는 월이 13으로 넘어가
  //  "2026-13-01" 같은 문자열이 만들어져 비교가 항상 실패했고, 12월에서 앞으로
  //  나갈 수 없었다. 연/월 자리올림을 먼저 처리한다.)
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextMonth0 = viewMonth === 11 ? 0 : viewMonth + 1;
  const canGoNext = toDateStr(nextYear, nextMonth0, 1) <= today;

  const prevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (!canGoNext) return;
    setViewYear(nextYear);
    setViewMonth(nextMonth0);
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      {/* 월 이동 */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-20"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold">
          {viewYear}년 {viewMonth + 1}월
        </span>
        <button
          onClick={nextMonth}
          disabled={!canGoNext}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-20"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="mt-2 grid grid-cols-7">
        {DAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={`pb-1 text-center text-[10px] font-medium ${
              i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-gray-400"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* 첫째 주 빈 칸 */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = toDateStr(viewYear, viewMonth, day);
          const isFuture = dateStr > today;
          const isToday = dateStr === today;
          const isSelected = dateStr === currentDate;
          const status = getStatus(dateStr);
          const dow = (firstDayOfWeek + i) % 7;

          return (
            <button
              key={day}
              onClick={() => !isFuture && setDate(dateStr)}
              disabled={isFuture}
              className={[
                "flex h-7 w-full items-center justify-center rounded-lg text-[11px] font-medium transition",
                isFuture ? "cursor-default text-gray-200" : "hover:opacity-80 cursor-pointer",
                !isFuture ? STATUS_BG[status] : "",
                // 요일 색상 (데이터 없는 날만 적용)
                status === "empty" && !isFuture && dow === 0 ? "text-rose-400" : "",
                status === "empty" && !isFuture && dow === 6 ? "text-sky-400" : "",
                isToday ? "ring-2 ring-emerald-400 ring-offset-1" : "",
                isSelected && !isToday ? "ring-2 ring-blue-400 ring-offset-1" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-gray-100 pt-3 text-[10px] text-gray-500">
        {(
          [
            ["bg-emerald-200", "목표 달성"],
            ["bg-amber-200", "목표 미달"],
            ["bg-rose-200", "목표 초과"],
            ["bg-gray-100", "기록 없음"],
          ] as [string, string][]
        ).map(([bg, label]) => (
          <div key={label} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-sm ${bg}`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
