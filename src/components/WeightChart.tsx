"use client";

import { Scale } from "lucide-react";
import { useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useDiet, todayStr } from "@/lib/store";

interface WeightPoint {
  date: string;
  mmdd: string;
  weight: number;
}

function shiftDate(base: string, delta: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WeightTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: WeightPoint = payload[0].payload;
  return (
    <div className="rounded-xl bg-white px-3 py-2 shadow-lg ring-1 ring-black/10 text-xs">
      <div className="font-semibold text-gray-600">{d.mmdd}</div>
      <div className="mt-0.5 text-sky-600 font-bold text-sm">{d.weight} kg</div>
    </div>
  );
}

export default function WeightChart() {
  const today = todayStr();
  const weightLog = useDiet((s) => s.weightLog);
  const setDailyWeight = useDiet((s) => s.setDailyWeight);

  const [input, setInput] = useState("");

  const todayWeight = weightLog[today];

  // 최근 30일 데이터 (기록 있는 날만)
  const data: WeightPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = shiftDate(today, -i);
    const w = weightLog[d];
    if (w != null) {
      const dt = new Date(d + "T00:00:00");
      data.push({
        date: d,
        mmdd: `${dt.getMonth() + 1}/${dt.getDate()}`,
        weight: w,
      });
    }
  }

  const handleSave = () => {
    const n = parseFloat(input);
    if (!n || n < 20 || n > 300) {
      toast.error("20~300 사이의 몸무게를 입력하세요.");
      return;
    }
    setDailyWeight(today, Math.round(n * 10) / 10);
    setInput("");
    toast.success("체중이 기록되었습니다.");
  };

  // Y 도메인: 최소-최대에 여유 추가
  const weights = data.map((d) => d.weight);
  const minW = weights.length ? Math.min(...weights) - 1 : 40;
  const maxW = weights.length ? Math.max(...weights) + 1 : 100;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold">
          <Scale className="h-3.5 w-3.5 text-sky-500" />
          체중 추이
        </h3>
        {todayWeight != null && (
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-500 ring-1 ring-sky-100">
            오늘 기록됨
          </span>
        )}
      </div>

      {/* 오늘 체중 입력 */}
      <div className="mt-3 flex gap-2">
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder={todayWeight != null ? "오늘 체중 수정" : "오늘 몸무게 입력 (kg)"}
          step="0.1"
          min={20}
          max={300}
          className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
        />
        <button
          onClick={handleSave}
          disabled={!input.trim()}
          className="shrink-0 rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-40"
        >
          기록
        </button>
      </div>

      {/* 그래프 */}
      {data.length >= 2 ? (
        <div className="mt-4 h-[130px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 4, right: 8, left: -38, bottom: 0 }}
            >
              <XAxis
                dataKey="mmdd"
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              {/* Y축: 눈금·레이블 모두 숨김 */}
              <YAxis
                domain={[minW, maxW]}
                hide
              />
              <Tooltip
                content={<WeightTooltip />}
                cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#0ea5e9", stroke: "white", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-4 py-4 text-center text-xs text-gray-400">
          2일 이상 기록하면 그래프가 표시됩니다
        </p>
      )}
    </div>
  );
}
