"use client";

import { ChevronDown, ChevronUp, Droplets, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { useDiet } from "@/lib/store";

export default function WaterTracker() {
  const waterMl = useDiet((s) => s.log.waterMl);
  const { waterCupMl, waterGoalMl } = useDiet((s) => s.settings);
  const setSettings = useDiet((s) => s.setSettings);
  const addWater = useDiet((s) => s.addWater);
  const setWater = useDiet((s) => s.setWater);

  const [showSettings, setShowSettings] = useState(false);

  const cup = Math.max(1, waterCupMl);
  const goal = Math.max(cup, waterGoalMl);
  const totalCups = Math.ceil(goal / cup);
  const filledCups = Math.min(totalCups, Math.floor(waterMl / cup));
  const num = (v: string) => Number(v.replace(/[^0-9]/g, "")) || 0;

  const waterLabel = waterMl >= 1000 ? `${(waterMl / 1000).toFixed(1)}L` : `${waterMl}ml`;
  const goalLabel = goal >= 1000 ? `${(goal / 1000).toFixed(1)}L` : `${goal}ml`;

  const handleCupClick = (index: number) => {
    const clickedCups = index + 1;
    if (filledCups === clickedCups) {
      setWater((clickedCups - 1) * cup);
    } else {
      setWater(clickedCups * cup);
    }
  };

  return (
    <div className="flex h-full w-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      {/* 헤더 - MealCard와 동일한 스타일 */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-bold">
          <Droplets className="h-4 w-4 text-sky-400" />
          물 섭취
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-sky-500">
            {waterLabel}
            <span className="text-sm font-normal text-gray-400"> / {goalLabel}</span>
          </span>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50"
          >
            {showSettings ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* 물방울 그리드 - 한 줄에 10개 */}
      <div className="mt-4 grid grid-cols-10 gap-y-2">
        {Array.from({ length: totalCups }).map((_, i) => {
          const filled = i < filledCups;
          return (
            <button
              key={i}
              onClick={() => handleCupClick(i)}
              title={`${(i + 1) * cup}ml`}
              className="group flex justify-center transition-transform active:scale-90"
            >
              <svg
                viewBox="0 0 24 28"
                style={{ height: "32px", width: "auto" }}
                className={`transition-colors duration-200 ${
                  filled
                    ? "text-sky-400 drop-shadow-[0_0_5px_rgba(56,189,248,0.6)]"
                    : "text-gray-200 group-hover:text-sky-200"
                }`}
                fill="currentColor"
              >
                <path d="M12 2 C12 2 3 12 3 18 C3 22.4 7.1 26 12 26 C16.9 26 21 22.4 21 18 C21 12 12 2 12 2Z" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* +/- 버튼 */}
      <div className="mt-auto flex items-center gap-2 pt-3">
        <button
          onClick={() => addWater(-cup)}
          disabled={waterMl <= 0}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={() => addWater(cup)}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-sky-500 text-sm font-semibold text-white hover:bg-sky-600"
        >
          <Plus className="h-4 w-4" />
          {cup}ml 추가
        </button>
      </div>

      {/* 설정 */}
      {showSettings && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
          <label className="block">
            <span className="mb-1 block text-xs text-gray-400">컵 용량 (ml)</span>
            <input
              type="number"
              value={waterCupMl}
              min={1}
              onChange={(e) => setSettings({ waterCupMl: num(e.target.value) })}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-sky-400"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-400">목표 (ml)</span>
            <input
              type="number"
              value={waterGoalMl}
              min={cup}
              onChange={(e) => setSettings({ waterGoalMl: num(e.target.value) })}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-sky-400"
            />
          </label>
          <button
            onClick={() => setWater(0)}
            className="col-span-2 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-400 hover:bg-gray-50"
          >
            오늘 기록 초기화
          </button>
        </div>
      )}
    </div>
  );
}
