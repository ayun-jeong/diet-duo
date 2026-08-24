"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDiet, todayStr } from "@/lib/store";

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

/**
 * 날짜 이동. 홈에서는 제목 자리를 대신한다.
 *
 * "식단 기록"이라는 제목은 앱을 열어 놓고 보는 중에는 아무것도 알려주지 않는다.
 * 그 자리를 날짜에 내주면 화면에서 가장 큰 글자가 지금 보고 있는 날이 되어,
 * 어제를 보다가 그대로 두고 나가는 실수가 줄어든다.
 */
export default function DateNav() {
  const date = useDiet((s) => s.date);
  const setDate = useDiet((s) => s.setDate);

  const today = todayStr();
  const isToday = date === today;
  const isFuture = date > today;

  const prev = () => setDate(shiftDate(date, -1));
  const next = () => {
    const nextDate = shiftDate(date, 1);
    if (nextDate <= today) setDate(nextDate);
  };

  const d = new Date(date + "T00:00:00");
  const label = d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  const weekday = d.toLocaleDateString("ko-KR", { weekday: "short" });

  return (
    <div className="flex min-w-0 items-center gap-1">
      <button
        onClick={prev}
        className="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        aria-label="어제"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <h1 className="min-w-0 truncate text-lg font-extrabold tracking-tight">
        {label}
        <span className="ml-1.5 text-sm font-semibold text-gray-400">{weekday}</span>
      </h1>

      <button
        onClick={next}
        disabled={isToday || isFuture}
        className="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
        aria-label="내일"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* 오늘이 아닐 때만 — 오늘 보고 있는데 "오늘" 버튼이 있으면 누를 이유가 없다 */}
      {!isToday && (
        <button
          onClick={() => setDate(today)}
          className="ml-0.5 shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-600 hover:bg-emerald-100"
        >
          오늘
        </button>
      )}
    </div>
  );
}
