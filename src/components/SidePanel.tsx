"use client";

import { BarChart2, Star, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import FavoritesPanel from "./FavoritesPanel";

/**
 * 통계 탭은 recharts 를 쓴다. 초기 번들에서 떼어내 패널을 실제로 열 때 받아온다.
 * (첫 화면에서는 한 번도 보이지 않는데 recharts 전체가 함께 로드되고 있었다.)
 */
const chartFallback = (
  <div className="h-[190px] animate-pulse rounded-2xl bg-gray-100" />
);

const WeightChart = dynamic(() => import("./WeightChart"), {
  ssr: false,
  loading: () => chartFallback,
});
const WeeklyChart = dynamic(() => import("./WeeklyChart"), {
  ssr: false,
  loading: () => chartFallback,
});
const CalorieTrendChart = dynamic(
  () => import("./TrendChart").then((m) => m.CalorieTrendChart),
  { ssr: false, loading: () => chartFallback },
);
const WaterTrendChart = dynamic(
  () => import("./TrendChart").then((m) => m.WaterTrendChart),
  { ssr: false, loading: () => chartFallback },
);
const CalendarWidget = dynamic(() => import("./CalendarWidget"), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-2xl bg-gray-100" />,
});

export type SidePanelTab = "stats" | "favorites";

interface Props {
  open: boolean;
  /** 무엇을 열었는지 — ⋯ 메뉴가 정한다 */
  tab: SidePanelTab;
  onClose: () => void;
}

export default function SidePanel({ open, tab, onClose }: Props) {
  /**
   * 패널은 CSS transform 으로 밀어 넣는 구조라 닫혀 있어도 계속 마운트돼 있었다.
   * 그래서 첫 진입에 보이지도 않는 캘린더가 한 달치를, 주간 차트가 7일치를 조회했다.
   * 한 번 연 뒤로는 마운트를 유지해 재조회 없이 다시 열리게 한다.
   */
  const opened = useRef(false);
  if (open) opened.current = true;

  // ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* 슬라이딩 패널 */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-300 sm:w-96 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
        inert={!open}
      >
        {/*
          패널 헤더 = 제목.
          통계와 즐겨찾기는 서로 볼 일이 없는데 한 패널에 탭으로 묶여 있었다.
          이제 ⋯ 메뉴에서 각각 따로 열리므로, 여기서는 무엇을 열었는지만 말한다.
        */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
          {tab === "stats" ? (
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
              <BarChart2 className="h-4 w-4" />
              통계 · 캘린더
            </h2>
          ) : (
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-amber-600">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              즐겨찾기
            </h2>
          )}

          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!opened.current ? null : tab === "stats" ? (
            <>
              <WeeklyChart />
              <CalorieTrendChart />
              <WaterTrendChart />
              <WeightChart />
              <CalendarWidget />
            </>
          ) : (
            <FavoritesPanel />
          )}
        </div>
      </div>
    </>
  );
}
