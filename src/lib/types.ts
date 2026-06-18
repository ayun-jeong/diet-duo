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
  /** true = 커플에게 이름/양을 숨김 (칼로리만 공유) */
  private?: boolean;
}

/** 하루 기록 */
export interface DayLog {
  date: string; // "YYYY-MM-DD"
  meals: Record<MealType, FoodItem[]>;
  waterMl: number;
  memo?: string;       // 하루 메모 (컨디션·운동 등)
  steps?: number;      // 걸음수
  exercises: ExerciseItem[]; // 운동 기록
}

export function emptyDayLog(date: string): DayLog {
  return {
    date,
    meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
    waterMl: 0,
    exercises: [],
  };
}

/** 앱 전역 설정 (프로필과 별개로 유지되는 사용자 환경값) */
export interface AppSettings {
  waterCupMl: number; // 물 한 컵 용량
  waterGoalMl: number; // 하루 물 섭취 목표
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
