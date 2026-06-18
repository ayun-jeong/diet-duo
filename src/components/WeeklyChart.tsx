"use client";

import { TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { calcGoalCalories } from "@/lib/nutrition";
import { storage } from "@/lib/storage";
import { useDiet, todayStr } from "@/lib/store";
import { sumDayTotals } from "@/lib/nutrition";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

interface DayData {
  label: string;
  mmdd: string;
  kcal: number;
  target: number;
  hasData: boolean;
  isToday: boolean;
}

function shiftDate(base: string, delta: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function barColor(d: DayData): string {
  if (!d.hasData) return "#e5e7eb";
  if (d.kcal > d.target * 1.05) return "#f87171"; // 초과 — rose
  if (d.kcal >= d.target * 0.8) return "#34d399";  // 적정 — emerald
  return "#fbbf24";                                  // 부족 — amber
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: DayData = payload[0].payload;
  return (
    <div className="rounded-xl bg-white px-3 py-2 shadow-lg ring-1 ring-black/10 text-xs">
      <div className="font-semibold text-gray-700">{d.mmdd} ({d.label})</div>
      {d.hasData ? (
        <>
          <div className="mt-1 text-gray-500">
            섭취 <span className="font-bold text-gray-800">{d.kcal.toLocaleString()}</span> kcal
          </div>
          <div className="text-gray-400">
            목표 {d.target.toLocaleString()} kcal
          </div>
        </>
      ) : (
        <div className="mt-1 text-gray-400">기록 없음</div>
      )}
    </div>
  );
}

export default function WeeklyChart() {
  const profile = useDiet((s) => s.profile);
  const date = useDiet((s) => s.date);
  const [data, setData] = useState<DayData[]>([]);

  useEffect(() => {
    if (!profile) return;
    const target = Math.round(calcGoalCalories(profile));
    const today = todayStr();

    const load = async () => {
      const days: DayData[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = shiftDate(today, -i);
        const log = await storage.getDayLog(d);
        const dt = new Date(d + "T00:00:00");
        const mmdd = `${dt.getMonth() + 1}/${dt.getDate()}`;
        const label = DAY_LABELS[dt.getDay()];
        const kcal = log ? sumDayTotals(log).kcal : 0;
        days.push({
          label,
          mmdd,
          kcal,
          target,
          hasData: !!log && kcal > 0,
          isToday: d === today,
        });
      }
      setData(days);
    };

    load();
  }, [profile, date]); // date 변경 시(오늘 기록 추가) 재로드

  if (!profile || data.length === 0) return null;

  const target = data[0]?.target ?? 0;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          최근 7일
        </h3>
        <span className="text-xs text-gray-400">목표 {target.toLocaleString()} kcal</span>
      </div>

      {/* 차트 */}
      <div className="mt-3 h-[140px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barCategoryGap="28%"
            margin={{ top: 4, right: 0, left: -28, bottom: 0 }}
          >
            <XAxis
              dataKey="label"
              tick={(props) => {
                const d: DayData = data[props.index];
                return (
                  <text
                    x={props.x}
                    y={props.y + 9}
                    textAnchor="middle"
                    fontSize={10}
                    fill={d?.isToday ? "#059669" : "#9ca3af"}
                    fontWeight={d?.isToday ? 700 : 400}
                  >
                    {d?.isToday ? "오늘" : props.value}
                  </text>
                );
              }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={target} stroke="#e5e7eb" strokeDasharray="4 3" strokeWidth={1.5} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
            <Bar dataKey="kcal" radius={[3, 3, 0, 0]} maxBarSize={32} yAxisId={0}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={barColor(d)}
                  opacity={d.isToday ? 1 : 0.7}
                  stroke={d.isToday ? barColor(d) : "none"}
                  strokeWidth={d.isToday ? 1.5 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 범례 */}
      <div className="mt-2 flex items-center justify-end gap-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400" />적정</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" />부족</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-400" />초과</span>
      </div>
    </div>
  );
}
