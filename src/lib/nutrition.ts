import { MEAL_TYPES } from "./types";
import type {
  ActivityLevel,
  AppSettings,
  DayLog,
  Goal,
  MealType,
  UserProfile,
} from "./types";

/**
 * 끼니별 칼로리 비중.
 *
 * 공식 기준에는 끼니별 칼로리 비율 규정이 **없다**. 2020 한국인 영양소
 * 섭취기준은 "끼니"·"배분"·"간식"이라는 말 자체가 안 나오고, 식사구성안의
 * 지시문은 "세 끼니에 적절하게 배분합니다"가 전부다. WHO·미국 DGA·EFSA·
 * 북유럽 NNR 도 같고, 북유럽은 검토 끝에 권고 설정을 명시적으로 거부했다.
 * 돌아다니는 비율 숫자들은 전부 "사람들이 이렇게 먹더라"는 관찰 평균이지
 * 처방이 아니다.
 *
 * 그래서 세 끼는 균등하게 두고 간식만 덜어낸다. 이 값이 한국 공식 자료와
 * 그나마 맞는 유일한 조합이다 — 학교급식법 시행규칙 별표3 이 점심을 1일
 * 에너지필요량의 정확히 1/3 로 잡고(전 학년·성별 구간 33.3~33.6%),
 * 식사구성안 공식 예시 식단을 역산하면 약 30/30/29/12 가 나온다.
 *
 * 비율을 더 정교하게 고를 이유는 없다. 등열량 조건에서 45/35/20 과
 * 20/35/45 를 비교한 실험에서도 체중 차이가 0.05kg 이었다 — 여기서 고르는
 * 차이는 문헌이 구분하지 못하는 영역이고, 메뉴 칼로리 추정 오차에 묻힌다.
 *
 * 다만 간식 10% 는 이 표에서 가장 약한 숫자다. 실측으로는 성인 하루
 * 에너지의 20% 를 넘기도 한다. 아래 정규화 구조에서 간식을 작게 잡으면
 * 다른 끼니가 커지는 게 아니라 여유분이 남는 쪽이라 안전한 방향의 오차다.
 */
const MEAL_SHARE: Record<MealType, number> = {
  breakfast: 0.3,
  lunch: 0.3,
  dinner: 0.3,
  snack: 0.1,
};

/** 목표를 이미 넘긴 날에도 "그래도 먹는다면 이 정도"를 보여준다 */
const MIN_MEAL_KCAL = 100;

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

/**
 * 이 끼니에 쓸 수 있는 칼로리 — AI 메뉴 추천의 기준값.
 *
 * 하루 남은 칼로리를 "아직 먹지 않은 끼니"들이 비중대로 나눠 갖는다.
 * 지금 끼니는 이미 먹었더라도 분모에 넣는다 — 여기에 더 담으려는 참이므로.
 *
 * 분모로 나누는 것은 정규화다. 비중은 하루 전체를 1.0 으로 놓은 값인데
 * 식에 넣는 것은 남은 칼로리라 기준이 어긋난다. 아침을 이미 먹었다면
 * 남은 1400 을 점심·저녁·간식(비중 합 0.75)이 나눠야 하는데, 나누지 않으면
 * 1400 × 0.75 = 1050 만 배정되고 350 이 어느 끼니에도 가지 않는다.
 *
 * 이전에는 하루 남은 칼로리를 그대로 한 끼니 예산으로 넘겨서, 목표 2000 에
 * 아침이 비어 있으면 1100~1700kcal 짜리 아침을 추천했다.
 */
export function mealBudgetKcal(
  log: DayLog,
  effectiveTargetKcal: number,
  meal: MealType,
): number {
  const remaining = Math.max(0, effectiveTargetKcal - sumDayTotals(log).kcal);

  let denom = MEAL_SHARE[meal];
  for (const m of MEAL_TYPES) {
    if (m === meal) continue;
    if ((log.meals[m] ?? []).length === 0) denom += MEAL_SHARE[m];
  }

  return Math.max(MIN_MEAL_KCAL, Math.round((remaining * MEAL_SHARE[meal]) / denom));
}
