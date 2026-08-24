// 식단 관리 앱 핵심 데이터 모델

export type Sex = "male" | "female";

/** 활동량 단계 (TDEE 계산에 사용) */
export type ActivityLevel =
  | "sedentary" // 거의 안 움직임
  | "light" // 가벼운 운동 주 1~3회
  | "moderate" // 보통 운동 주 3~5회
  | "active" // 활발한 운동 주 6~7회
  | "veryActive"; // 매우 활발 / 육체노동

/** 목표 */
export type Goal = "lose" | "maintain" | "gain";

export interface UserProfile {
  heightCm: number;
  weightKg: number;
  age: number;
  sex: Sex;
  activity: ActivityLevel;
  goal: Goal;
}

/** 끼니 구분 */
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPES: MealType[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식·음료",
};

/**
 * 파트너가 보내와 내 기록에 들어온 항목의 출처.
 *
 * 사본이므로 보낸 쪽과는 완전히 별개다. 내가 지워도 상대 기록은 그대로고,
 * 상대가 지워도 내 것은 남는다. 이 정보는 "누가 보냈는지"를 보여주고,
 * 보낸 사람만 되돌릴 수 있게 하는 데만 쓴다.
 */
export interface SharedFrom {
  userId: string;
  name: string;
}

/** 음식 1개 항목 (입력된 양 기준의 최종 영양값) */
export interface FoodItem {
  id: string;
  name: string;
  amount: string; // "1그릇", "100g" 등 사용자가 입력한 양 표현
  kcal: number;
  carbs: number; // g
  protein: number; // g
  fat: number; // g
  source: "ai" | "db" | "manual";
  /**
   * 파트너 기록에 만들어 둔 사본의 id.
   * 있으면 "연동됨" 상태이며, 이 값으로 사본을 되돌릴 수 있다.
   * 상대가 이미 지웠으면 되돌리기는 조용히 넘어간다.
   */
  sharedItemId?: string;
  /** 파트너가 보내와 들어온 항목이면 그 출처 */
  sharedFrom?: SharedFrom;
}

/** 하루 기록 */
export interface DayLog {
  date: string; // "YYYY-MM-DD"
  meals: Record<MealType, FoodItem[]>;
  waterMl: number;
  steps?: number;      // 걸음수
  exercises: ExerciseItem[]; // 운동 기록
  weightKg?: number;   // 그날 기록한 체중 (기기 간 동기화)
}

/** 캘린더·차트용 일별 요약 (meals 전체를 끌어오지 않기 위한 경량 형태) */
export interface DaySummary {
  date: string;
  kcal: number;
  weightKg?: number;
  /** 그날 마신 물 (ml). 추이 차트가 쓴다. */
  waterMl?: number;
}

export function emptyDayLog(date: string): DayLog {
  return {
    date,
    meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
    waterMl: 0,
    exercises: [],
  };
}

/**
 * 어떤 출처(localStorage·DB·API 응답)에서 온 값이든 안전한 DayLog 로 정규화한다.
 *
 * meals 의 특정 끼니 키가 빠져 있거나 배열이 아닌 경우 `.map()` / `.reduce()` 에서
 * 터지므로, 화면에 닿기 전에 여기서 한 번 막는다.
 */
export function normalizeDayLog(
  date: string,
  raw: Partial<DayLog> | null | undefined,
): DayLog {
  const base = emptyDayLog(date);
  if (!raw) return base;

  const meals = {} as DayLog["meals"];
  for (const meal of MEAL_TYPES) {
    const items = raw.meals?.[meal];
    meals[meal] = Array.isArray(items) ? items : [];
  }

  return {
    date,
    meals,
    waterMl: Number.isFinite(raw.waterMl) ? Number(raw.waterMl) : 0,
    steps: Number.isFinite(raw.steps) ? Number(raw.steps) : 0,
    exercises: Array.isArray(raw.exercises) ? raw.exercises : [],
    weightKg: typeof raw.weightKg === "number" ? raw.weightKg : undefined,
  };
}

/** 하루 총 섭취 칼로리 (day_logs.kcal 비정규화 컬럼 계산용) */
export function sumMealKcal(log: DayLog): number {
  let kcal = 0;
  for (const meal of MEAL_TYPES) {
    for (const f of log.meals[meal] ?? []) kcal += f.kcal ?? 0;
  }
  return Math.round(kcal);
}

/**
 * 직접 지정한 영양소 목표 (g).
 *
 * enabled 가 false 면 프로필 기반 자동 계산값(탄 50% / 단 25% / 지 25%)을 쓴다.
 * 목표 칼로리는 이 g 수에서 역산한다 (탄·단 4kcal/g, 지방 9kcal/g).
 * 그래야 화면에 표시되는 칼로리와 영양소 목표가 서로 어긋나지 않는다.
 */
export interface MacroGoal {
  enabled: boolean;
  carbs: number;
  protein: number;
  fat: number;
}

/** 앱 전역 설정 (프로필과 별개로 유지되는 사용자 환경값) */
export interface AppSettings {
  waterCupMl: number; // 물 한 컵 용량
  waterGoalMl: number; // 하루 물 섭취 목표
  macroGoal?: MacroGoal; // 직접 지정한 영양소 목표 (없으면 자동 계산)
}

export const DEFAULT_SETTINGS: AppSettings = {
  waterCupMl: 200,
  waterGoalMl: 2000,
};

/** 운동 1개 항목 */
export interface ExerciseItem {
  id: string;
  name: string;
  duration: string; // "30분", "1시간" 등 표현 그대로 저장
  burned: number; // kcal 소모량
}

/** 즐겨찾기 음식 (끼니와 무관하게 전역 저장) */
export interface FavoriteFood {
  id: string;
  name: string;
  amount: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}
