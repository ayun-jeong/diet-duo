"use client";

import { Droplets, Flame } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { resolveTargets } from "@/lib/nutrition";
import { shiftDate, todayStr, useDiet } from "@/lib/store";

const DAYS = 30;

export interface TrendPoint {
  date: string;
  mmdd: string;
  /**
   * 기록이 없는 날은 null.
   *
   * 0 으로 채우면 "그날 아무것도 안 먹었다"는 그림이 되어 추이가 거짓말을 한다.
   * null 로 두고 선을 끊어 빈 날을 빈 날로 보여준다.
   */
  value: number | null;
}

interface Props {
  title: string;
  icon: React.ReactNode;
  /** 선·면 색 (계열이 하나뿐이라 범례는 두지 않는다 — 제목이 이름을 말한다) */
  color: string;
  gradientId: string;
  data: TrendPoint[];
  goal?: number;
  unit: string;
  /** 툴팁·헤드라인 표기 (전체 숫자) */
  format: (v: number) => string;
  /**
   * 축 눈금 표기.
   *
   * 축은 폭이 좁아 네 자리 숫자를 그대로 넣으면 앞자리가 잘린다 ("1,500" → "500").
   * 축에서는 줄여 쓰고, 정확한 값은 툴팁이 맡는다.
   */
  tickFormat: (v: number) => string;
  emptyLabel: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function TrendTooltip({ active, payload, color, unit, format }: any) {
  if (!active || !payload?.length) return null;
  const d: TrendPoint = payload[0].payload;
  if (d.value == null) return null;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-black/10">
      <div className="font-semibold text-gray-600">{d.mmdd}</div>
      <div className="mt-0.5 text-sm font-bold" style={{ color }}>
        {format(d.value)}
        <span className="ml-0.5 text-[11px] font-medium text-gray-400">{unit}</span>
      </div>
    </div>
  );
}

function TrendChart({
  title,
  icon,
  color,
  gradientId,
  data,
  goal,
  unit,
  format,
  tickFormat,
  emptyLabel,
}: Props) {
  const recorded = data.filter((d) => d.value != null) as (TrendPoint & { value: number })[];
  const avg =
    recorded.length > 0
      ? Math.round(recorded.reduce((sum, d) => sum + d.value, 0) / recorded.length)
      : null;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold">
          {icon}
          {title}
        </h3>
        {goal != null && (
          <span className="text-xs text-gray-400">
            목표 {format(goal)}
            {unit}
          </span>
        )}
      </div>

      {avg == null ? (
        <p className="py-8 text-center text-xs text-gray-400">{emptyLabel}</p>
      ) : (
        <>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold tabular-nums" style={{ color }}>
              {format(avg)}
            </span>
            <span className="text-xs text-gray-400">
              {unit} · 하루 평균
            </span>
            <span className="ml-auto text-[11px] text-gray-300">
              기록 {recorded.length}일 / {DAYS}일
            </span>
          </div>

          <div className="mt-2 h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <XAxis
                  dataKey="mmdd"
                  tick={{ fontSize: 9, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.floor(DAYS / 5)}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  width={34}
                  tickFormatter={(v) => tickFormat(v as number)}
                />

                {goal != null && (
                  <ReferenceLine
                    y={goal}
                    stroke="#e5e7eb"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                  />
                )}

                <Tooltip
                  content={<TrendTooltip color={color} unit={unit} format={format} />}
                  cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }}
                />

                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  // 기록이 없는 날은 선을 잇지 않는다 — 빈 날은 빈 날로 보여야 한다.
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 4, fill: color, stroke: "white", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

/** 최근 30일치를 요약 캐시에서 뽑는다 (기록 없는 날은 null) */
function useTrendData(pick: (s: { kcal: number; waterMl?: number }) => number): TrendPoint[] {
  const today = todayStr();
  const summaries = useDiet((s) => s.summaries);
  const loadSummaries = useDiet((s) => s.loadSummaries);
  const storageGen = useDiet((s) => s.storageGen);

  const from = shiftDate(today, -(DAYS - 1));

  useEffect(() => {
    void loadSummaries(from, today);
  }, [loadSummaries, from, today, storageGen]);

  return useMemo(() => {
    const out: TrendPoint[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = shiftDate(today, -i);
      const s = summaries[d];
      const dt = new Date(d + "T00:00:00");
      out.push({
        date: d,
        mmdd: `${dt.getMonth() + 1}/${dt.getDate()}`,
        value: s ? pick(s) : null,
      });
    }
    return out;
    // pick 은 호출부에서 고정 함수로 넘긴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaries, today]);
}

const pickKcal = (s: { kcal: number }) => s.kcal;
const pickWater = (s: { waterMl?: number }) => s.waterMl ?? 0;

/** 칼로리 추이 — 30일 */
export function CalorieTrendChart() {
  const profile = useDiet((s) => s.profile);
  const settings = useDiet((s) => s.settings);
  const data = useTrendData(pickKcal);

  const goal = profile ? resolveTargets(profile, settings).kcal : undefined;

  return (
    <TrendChart
      title="칼로리 추이"
      icon={<Flame className="h-4 w-4 text-emerald-500" />}
      color="#10b981"
      gradientId="trend-kcal"
      data={data}
      goal={goal}
      unit=" kcal"
      format={(v) => Math.round(v).toLocaleString()}
      tickFormat={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))}
      emptyLabel="최근 30일에 기록이 없어요"
    />
  );
}

/** 물 섭취 추이 — 30일 */
export function WaterTrendChart() {
  const goalMl = useDiet((s) => s.settings.waterGoalMl);
  const data = useTrendData(pickWater);

  return (
    <TrendChart
      title="물 섭취 추이"
      icon={<Droplets className="h-4 w-4 text-sky-500" />}
      color="#0ea5e9"
      gradientId="trend-water"
      data={data}
      goal={goalMl}
      unit="L"
      format={(v) => (Math.round(v / 100) / 10).toFixed(1)}
      tickFormat={(v) => (Math.round(v / 100) / 10).toFixed(1)}
      emptyLabel="최근 30일에 기록이 없어요"
    />
  );
}
