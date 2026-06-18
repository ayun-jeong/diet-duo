"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { calcGoalCalories } from "@/lib/nutrition";
import { sumDayTotals } from "@/lib/nutrition";
import { storage } from "@/lib/storage";
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

  // date -> kcal 합계
  const [monthData, setMonthData] = useState<Record<string, number>>({});
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!profile || loadingRef.current) return;
    loadingRef.current = true;

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const data: Record<string, number> = {};
    let pending = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toDateStr(viewYear, viewMonth, d);
      if (dateStr > today) continue;
      pending++;
      storage.getDayLog(dateStr).then((log) => {
        if (log) data[dateStr] = sumDayTotals(log).kcal;
        pending--;
        if (pending === 0) {
          setMonthData({ ...data });
          loadingRef.current = false;
        }
      });
    }
    if (pending === 0) {
      setMonthData({});
      loadingRef.current = false;
    }
  }, [viewYear, viewMonth, profile, currentDate]); // currentDate 바뀌면 오늘 데이터 갱신

  const target = profile ? Math.round(calcGoalCalories(profile)) : 0;

  const getStatus = (dateStr: string): DayStatus => {
    const kcal = monthData[dateStr];
    if (!kcal || kcal === 0) return "empty";
    const ratio = kcal / target;
    if (ratio > 1.05) return "over";
    if (ratio >= 0.8) return "good";
    return "under";
  };

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const canGoPrev = toDateStr(viewYear, viewMonth, 1) > "2020-01-01";
  const canGoNext =
    toDateStr(viewYear, viewMonth + 1, 1) <=
    today.slice(0, 8) + pad(todayObj.getDate());

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
    const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
    const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
    if (toDateStr(nextY, nextM, 1) > today) return;
    setViewYear(nextY);
    setViewMonth(nextM);
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
