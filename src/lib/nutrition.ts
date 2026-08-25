import type {
  ActivityLevel,
  AppSettings,
  DayLog,
  Goal,
  UserProfile,
} from "./types";

/** 활동량 계수 */
const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "거의 안 움직임 (좌식 생활)",
  light: "가벼운 운동 (주 1~3회)",
  moderate: "보통 운동 (주 3~5회)",
  active: "활발한 운동 (주 6~7회)",
  veryActive: "매우 활발 / 육체노동",
};

export const GOAL_LABELS: Record<Goal, string> = {
  lose: "체중 감량",
  maintain: "체중 유지",
  gain: "체중 증량",
};

/** 기초대사량 (Mifflin-St Jeor 공식) */
export function calcBMR(p: UserProfile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
}

/** 일일 총 에너지 소비량 */
export function calcTDEE(p: UserProfile): number {
  return calcBMR(p) * ACTIVITY_FACTOR[p.activity];
}

/** 목표에 따른 1일 권장 섭취 칼로리 */
export function calcGoalCalories(p: UserProfile): number {
  const tdee = calcTDEE(p);
  if (p.goal === "lose") return tdee - 500; // 주 약 0.5kg 감량
  if (p.goal === "gain") return tdee + 300;
  return tdee;
}

export interface MacroTargets {
  kcal: number;
  carbs: number; // g
  protein: number; // g
  fat: number; // g
}

/** 목표 칼로리 기반 권장 탄단지 (탄 50% / 단 25% / 지 25%) */
export function calcMacroTargets(p: UserProfile): MacroTargets {
  const kcal = calcGoalCalories(p);
  return {
    kcal: Math.round(kcal),
    carbs: Math.round((kcal * 0.5) / 4),
    protein: Math.round((kcal * 0.25) / 4),
    fat: Math.round((kcal * 0.25) / 9),
  };
}

/** 영양소 g → 칼로리 (탄·단 4, 지방 9) */
export function macrosToKcal(carbs: number, protein: number, fat: number): number {
  return Math.round(carbs * 4 + protein * 4 + fat * 9);
}

/**
 * 실제로 적용할 하루 목표.
 *
 * 사용자가 영양소 g 을 직접 지정했으면 그 값을 쓰고, 목표 칼로리도 거기서
 * 역산한다. 지정하지 않았으면 프로필 기반 자동 계산값을 그대로 쓴다.
 *
 * 화면 여러 곳(요약·끼니 카드·주간 차트·캘린더)이 목표를 참조하므로
 * 계산은 반드시 이 함수 하나를 거치게 한다.
 */
export function resolveTargets(
  profile: UserProfile,
  settings?: AppSettings,
): MacroTargets {
  const auto = calcMacroTargets(profile);
  const g = settings?.macroGoal;

  if (!g?.enabled) return auto;

  const carbs = Math.max(0, Math.round(g.carbs));
  const protein = Math.max(0, Math.round(g.protein));
  const fat = Math.max(0, Math.round(g.fat));

  // 셋 다 0 이면 의미가 없으므로 자동값으로 되돌린다.
  if (carbs + protein + fat === 0) return auto;

  return { kcal: macrosToKcal(carbs, protein, fat), carbs, protein, fat };
}

export interface DayTotals {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

/** 하루 동안 먹은 모든 음식의 영양 합계 */
export function sumDayTotals(log: DayLog): DayTotals {
  const totals: DayTotals = { kcal: 0, carbs: 0, protein: 0, fat: 0 };
  for (const items of Object.values(log.meals ?? {})) {
    if (!Array.isArray(items)) continue;
    for (const f of items) {
      totals.kcal += f.kcal;
      totals.carbs += f.carbs;
      totals.protein += f.protein;
      totals.fat += f.fat;
    }
  }
  return {
    kcal: Math.round(totals.kcal),
    carbs: Math.round(totals.carbs),
    protein: Math.round(totals.protein),
    fat: Math.round(totals.fat),
  };
}
