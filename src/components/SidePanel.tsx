"use client";

import { BarChart2, Star, X } from "lucide-react";
import CalendarWidget from "./CalendarWidget";
import FavoritesPanel from "./FavoritesPanel";
import WeeklyChart from "./WeeklyChart";
import WeightChart from "./WeightChart";

export type SidePanelTab = "stats" | "favorites";

interface Props {
  open: boolean;
  tab: SidePanelTab;
  onTabChange: (t: SidePanelTab) => void;
  onClose: () => void;
}

export default function SidePanel({ open, tab, onTabChange, onClose }: Props) {
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
        className={`fixed right-0 top-0 z-50 flex h-full w-96 flex-col bg-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 패널 헤더 */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
          <div className="flex gap-1">
            <button
              onClick={() => onTabChange("stats")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                tab === "stats"
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              통계
            </button>
            <button
              onClick={() => onTabChange("favorites")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                tab === "favorites"
                  ? "bg-amber-50 text-amber-600"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${tab === "favorites" ? "fill-amber-400 text-amber-400" : ""}`} />
              즐겨찾기
            </button>
          </div>

          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === "stats" ? (
            <>
              <WeightChart />
              <WeeklyChart />
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
