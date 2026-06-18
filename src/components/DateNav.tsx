"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDiet, todayStr } from "@/lib/store";

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

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

  const label = new Date(date + "T00:00:00").toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        onClick={prev}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
        aria-label="어제"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <span className="flex-1 text-center text-sm font-semibold text-gray-700">
        {label}
      </span>

      <button
        onClick={next}
        disabled={isToday || isFuture}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="내일"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {!isToday && (
        <button
          onClick={() => setDate(today)}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-100"
        >
          오늘
        </button>
      )}
    </div>
  );
}
