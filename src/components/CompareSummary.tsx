"use client";

import { Dumbbell, HeartHandshake, User } from "lucide-react";
import { resolveTargets, sumDayTotals, type MacroTargets } from "@/lib/nutrition";
import { useDiet, usePartnerName } from "@/lib/store";
import type { DayLog } from "@/lib/types";

interface Side {
  label: string;
  totals: ReturnType<typeof sumDayTotals>;
  targets: MacroTargets | null;
  waterMl: number;
  waterGoalMl: number;
  burned: number;
  mine: boolean;
}

const EMPTY_LOG: DayLog = {
  date: "",
  meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
  waterMl: 0,
  exercises: [],
};

/**
 * 두 사람의 하루를 한 카드에 나란히.
 *
 * 진행률 막대는 각자의 목표를 기준으로 그린다. 목표가 다른데 같은 눈금을 쓰면
 * "누가 더 먹었나"가 아니라 "누구 목표가 높나"를 그리게 되어 비교가 거짓말이 된다.
 */
export default function CompareSummary() {
  const log = useDiet((s) => s.log);
  const profile = useDiet((s) => s.profile);
  const settings = useDiet((s) => s.settings);
  const partner = useDiet((s) => s.partner);
  const partnerName = usePartnerName();

  const partnerLog = partner.log ?? EMPTY_LOG;

  const sides: Side[] = [
    {
      label: "나",
      totals: sumDayTotals(log),
      targets: profile ? resolveTargets(profile, settings) : null,
      waterMl: log.waterMl,
      waterGoalMl: settings.waterGoalMl,
      burned: burnedOf(log),
      mine: true,
    },
    {
      label: partnerName,
      totals: sumDayTotals(partnerLog),
      targets: partner.targets,
      waterMl: partnerLog.waterMl,
      waterGoalMl: partner.waterGoalMl ?? settings.waterGoalMl,
      burned: burnedOf(partnerLog),
      mine: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:grid-cols-2 sm:gap-5">
      {sides.map((side) => (
        <SideBlock key={side.label} side={side} />
      ))}
    </div>
  );
}

function SideBlock({ side }: { side: Side }) {
  const { totals, targets, mine } = side;
  const goal = targets?.kcal ?? 0;
  const rawPct = goal > 0 ? (totals.kcal / goal) * 100 : 0;
  const pct = Math.min(100, Math.round(rawPct));
  const left = goal > 0 ? goal - totals.kcal : null;
  const over = left !== null && left < 0;

  // 80~105% 면 "딱 좋음" — 내 요약 화면과 같은 기준을 쓴다.
  const achieved = rawPct >= 80 && rawPct <= 105;

  const ink = mine ? "text-emerald-700" : "text-pink-700";
  /*
   * 바 색은 언제나 그 사람의 색으로 둔다.
   *
   * 이전에는 목표를 넘기면 바를 통째로 빨갛게 칠했다. 한 사람만 볼 때는 경고로
   * 읽히지만, 두 사람을 나란히 두면 둘 다 초과했을 때 양쪽이 같은 빨강이 되어
   * 누가 누구인지 사라지고 화면 전체가 붉어진다.
   * 초과는 위쪽 "N 초과" 글자만 붉게 해서 알린다.
   */
  const fill = mine
    ? achieved
      ? "bg-emerald-500 shadow-[0_0_6px_#34d399]"
      : "bg-emerald-400"
    : achieved
      ? "bg-pink-500 shadow-[0_0_6px_#f9a8d4]"
      : "bg-pink-400";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1.5 text-xs font-bold ${ink}`}>
          {mine ? (
            <User className="h-3.5 w-3.5" />
          ) : (
            <HeartHandshake className="h-3.5 w-3.5" />
          )}
          <span className="max-w-28 truncate">{side.label}</span>
        </div>
        <span
          className={`text-[11px] font-medium ${over ? "text-rose-500" : "text-gray-400"}`}
        >
          {left === null
            ? "목표 미설정"
            : over
              ? `${Math.abs(left).toLocaleString()}kcal 초과`
              : `${left.toLocaleString()}kcal 남음`}
        </span>
      </div>

      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={`text-2xl font-extrabold tabular-nums ${ink}`}>
          {totals.kcal.toLocaleString()}
        </span>
        {goal > 0 && (
          <span className="text-xs text-gray-400">/ {goal.toLocaleString()} kcal</span>
        )}
        {/*
          운동으로 소모한 칼로리. 앞에 붙이던 "−" 는 뺐다 —
          소모량이지 음수가 아닌데 마이너스 값처럼 읽혔다.
          무엇이 소모된 값인지는 아령 아이콘이 말해 준다.
          (걸음수는 파트너 체중을 몰라 환산할 수 없으므로 여기 포함하지 않는다.)
        */}
        {side.burned > 0 && (
          <span
            className="ml-auto flex items-center gap-0.5 text-xs font-semibold text-rose-500"
            title={`운동으로 ${side.burned.toLocaleString()} kcal 소모`}
          >
            <Dumbbell className="h-3 w-3" />
            {side.burned.toLocaleString()}kcal
          </span>
        )}
      </div>

      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${fill}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 영양성분 — 칼로리만으로는 무엇을 먹었는지 알 수 없다 */}
      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
        <Macro label="탄" value={totals.carbs} goal={targets?.carbs ?? 0} color="bg-amber-400" />
        <Macro label="단" value={totals.protein} goal={targets?.protein ?? 0} color="bg-rose-400" />
        <Macro label="지" value={totals.fat} goal={targets?.fat ?? 0} color="bg-violet-400" />
        <Macro
          label="물"
          value={Math.round(side.waterMl / 100) / 10}
          goal={Math.round(side.waterGoalMl / 100) / 10}
          color="bg-sky-400"
          unit="L"
        />
      </div>
    </div>
  );
}

function Macro({
  label,
  value,
  goal,
  color,
  unit = "g",
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
  unit?: string;
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div className="rounded-lg bg-gray-50 px-2 py-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium text-gray-500">{label}</span>
        {goal > 0 && <span className="text-[9px] text-gray-300">{goal}</span>}
      </div>
      <div className="text-[13px] font-bold leading-tight tabular-nums">
        {value}
        <span className="text-[9px] font-normal text-gray-400">{unit}</span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function burnedOf(log: DayLog): number {
  return (log.exercises ?? []).reduce((sum, e) => sum + e.burned, 0);
}
