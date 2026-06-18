import type {
  ActivityLevel,
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

export interface DayTotals {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

/** 하루 동안 먹은 모든 음식의 영양 합계 */
export function sumDayTotals(log: DayLog): DayTotals {
  const totals: DayTotals = { kcal: 0, carbs: 0, protein: 0, fat: 0 };
  for (const items of Object.values(log.meals)) {
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
