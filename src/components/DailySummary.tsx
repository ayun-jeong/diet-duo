"use client";

import { CheckCircle2, Dumbbell, Flame } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { calcMacroTargets, sumDayTotals } from "@/lib/nutrition";
import { useDiet } from "@/lib/store";

function stepsToKcal(steps: number, weightKg: number): number {
  return Math.round(steps * weightKg * 0.0005);
}

async function fireConfetti() {
  const confetti = (await import("canvas-confetti")).default;
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.35 },
    colors: ["#34d399", "#6ee7b7", "#fbbf24", "#f9a8d4", "#a78bfa"],
  });
}

// ── 원그래프 ──────────────────────────────────────────────
const PIE_SEGS = [
  { color: "#fbbf24", label: "탄수화물" },
  { color: "#fb7185", label: "단백질"   },
  { color: "#a78bfa", label: "지방"     },
] as const;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutPath(cx: number, cy: number, oR: number, iR: number, s: number, e: number) {
  const large = e - s > 180 ? 1 : 0;
  const o1 = polar(cx, cy, oR, s), o2 = polar(cx, cy, oR, e);
  const i1 = polar(cx, cy, iR, e), i2 = polar(cx, cy, iR, s);
  return `M${o1.x} ${o1.y} A${oR} ${oR} 0 ${large} 1 ${o2.x} ${o2.y} L${i1.x} ${i1.y} A${iR} ${iR} 0 ${large} 0 ${i2.x} ${i2.y}Z`;
}

function MacroPie({ carbsG, proteinG, fatG }: { carbsG: number; proteinG: number; fatG: number }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const kcals = [carbsG * 4, proteinG * 4, fatG * 9];
  const total = kcals.reduce((a, b) => a + b, 0);
  const cx = 60, cy = 60, oR = 52, iR = 36;

  let cumDeg = 0;
  const slices = kcals.map((kcal, i) => {
    const pct = total > 0 ? kcal / total : 0;
    const startDeg = cumDeg;
    cumDeg += pct * 360;
    return { color: PIE_SEGS[i].color, label: PIE_SEGS[i].label, pct, startDeg, endDeg: cumDeg };
  });

  const h = hovered !== null ? slices[hovered] : null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="100%" height="100%" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet">
        {/* 빈 링 */}
        {total === 0 && (
          <circle cx={cx} cy={cy} r={(oR + iR) / 2} fill="none" stroke="#f3f4f6" strokeWidth={oR - iR} />
        )}
        {/* 세그먼트 */}
        {total > 0 && slices.map((s, i) =>
          s.pct > 0.002 ? (
            <path
              key={i}
              d={donutPath(cx, cy, oR, iR, s.startDeg, s.endDeg)}
              fill={s.color}
              opacity={hovered === null || hovered === i ? 1 : 0.3}
              className="cursor-pointer transition-opacity duration-150"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ) : null
        )}
        {/* 호버 시 가운데 텍스트 */}
        {h && (
          <>
            <text x={cx} y={cy - 5} textAnchor="middle" fontSize="10" fill={h.color} fontWeight="600">
              {h.label}
            </text>
            <text x={cx} y={cy + 11} textAnchor="middle" fontSize="14" fill={h.color} fontWeight="800">
              {Math.round(h.pct * 100)}%
            </text>
          </>
        )}
      </svg>
      <div className="flex gap-2">
        {PIE_SEGS.map((s) => (
          <span key={s.label} className="flex items-center gap-0.5 text-[9px] text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label.slice(0, 1)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── 영양소 바 ──────────────────────────────────────────────
function MacroBar({ label, value, goal, color }: {
  label: string; value: number; goal: number; color: string;
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-[11px] font-medium text-gray-500">{label}</span>
        <span className="text-[10px] text-gray-400">{goal}g</span>
      </div>
      <div className="text-base font-bold leading-tight">{value}g</div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function WaterBar({ value, goalLabel, pct }: {
  value: string; goalLabel: string; pct: number;
}) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-[11px] font-medium text-gray-500">물 섭취</span>
        <span className="text-[10px] text-gray-400">{goalLabel}</span>
      </div>
      <div className="text-base font-bold leading-tight text-sky-500">{value}</div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-sky-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function DailySummary() {
  const profile = useDiet((s) => s.profile);
  const log = useDiet((s) => s.log);
  const waterMl = useDiet((s) => s.log.waterMl);
  const { waterCupMl, waterGoalMl } = useDiet((s) => s.settings);

  const prevPct = useRef<number | null>(null);
  const celebratedDate = useRef<string | null>(null);

  if (!profile) return null;

  const target = calcMacroTargets(profile);
  const totals = sumDayTotals(log);

  const stepsBurned = (log.steps ?? 0) > 0 ? stepsToKcal(log.steps ?? 0, profile.weightKg) : 0;
  const exerciseBurned = log.exercises.reduce((sum, e) => sum + e.burned, 0);
  const totalBurned = stepsBurned + exerciseBurned;

  const effectiveTarget = target.kcal + totalBurned;
  const remaining = effectiveTarget - totals.kcal;
  const over = remaining < 0;
  const rawPct = effectiveTarget > 0 ? (totals.kcal / effectiveTarget) * 100 : 0;
  const pct = Math.min(100, Math.round(rawPct));
  const achieved = rawPct >= 80 && rawPct <= 105;

  const cup = Math.max(1, waterCupMl);
  const waterGoal = Math.max(cup, waterGoalMl);
  const waterPct = Math.min(100, Math.round((waterMl / waterGoal) * 100));
  const waterLabel = waterMl >= 1000 ? `${(waterMl / 1000).toFixed(1)}L` : `${waterMl}ml`;
  const waterGoalLabel = waterGoal >= 1000 ? `${(waterGoal / 1000).toFixed(1)}L` : `${waterGoal}ml`;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (prevPct.current === null) { prevPct.current = rawPct; return; }
    const prev = prevPct.current;
    prevPct.current = rawPct;
    if (prev < 80 && rawPct >= 80 && rawPct <= 105 && celebratedDate.current !== log.date) {
      celebratedDate.current = log.date;
      fireConfetti();
      toast.success("오늘 목표 달성!", {
        description: `${totals.kcal.toLocaleString()} kcal — 딱 좋아요!`,
        duration: 4000,
      });
    }
  }, [rawPct, log.date, totals.kcal]);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">

      {/* 상단 2열: 왼쪽(칼로리 정보 + 바) / 오른쪽(원그래프 전체 높이) */}
      <div className="flex items-stretch gap-5">

        {/* 왼쪽: 섭취량(좌) + 남은량(우) + 진행바 */}
        <div className="flex flex-1 flex-col min-w-0">

          {/* 위: 섭취량 ↔ 남은 칼로리 */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-400">오늘 섭취</span>
                {achieved && (
                  <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />목표 달성
                  </span>
                )}
                {over && (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-500 ring-1 ring-rose-200">초과</span>
                )}
              </div>
              <div className="text-3xl font-extrabold leading-none">
                {totals.kcal.toLocaleString()}
                <span className="ml-1 text-sm font-medium text-gray-400">/ {effectiveTarget.toLocaleString()} kcal</span>
              </div>
              {totalBurned > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-gray-400">기본 {target.kcal.toLocaleString()}</span>
                  {stepsBurned > 0 && (
                    <span className="flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-400">
                      <Flame className="h-2.5 w-2.5" />+{stepsBurned}
                    </span>
                  )}
                  {exerciseBurned > 0 && (
                    <span className="flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-400">
                      <Dumbbell className="h-2.5 w-2.5" />+{exerciseBurned}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 남음 / 초과 */}
            <div className="shrink-0 self-end text-right">
              <div className={`text-2xl font-extrabold leading-none ${over ? "text-rose-500" : "text-emerald-500"}`}>
                {Math.abs(remaining).toLocaleString()}
                <span className="ml-0.5 text-sm font-normal text-gray-400"> kcal</span>
              </div>
              <div className="mt-0.5 text-xs font-medium text-gray-400">{over ? "초과" : "남음"}</div>
            </div>
          </div>

          {/* 아래: 진행 바 */}
          <div className="mt-4">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  achieved ? "bg-emerald-500 shadow-[0_0_6px_#34d399]"
                    : over ? "bg-rose-500"
                    : "bg-emerald-400"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* 오른쪽: 원그래프 — 카드 높이 전체 */}
        <div className="w-[120px] shrink-0">
          <MacroPie carbsG={totals.carbs} proteinG={totals.protein} fatG={totals.fat} />
        </div>
      </div>

      {/* 영양소 4칸: 탄 · 단 · 지 · 물 */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MacroBar label="탄수화물" value={totals.carbs}   goal={target.carbs}   color="bg-amber-400"   />
        <MacroBar label="단백질"   value={totals.protein} goal={target.protein} color="bg-rose-400" />
        <MacroBar label="지방"     value={totals.fat}     goal={target.fat}     color="bg-violet-400"  />
        <WaterBar value={waterLabel} goalLabel={waterGoalLabel} pct={waterPct} />
      </div>
    </div>
  );
}
