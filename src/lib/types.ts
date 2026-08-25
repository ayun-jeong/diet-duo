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
  /** 메이트가 보내와 들어온 항목이면 그 출처 */
  sharedFrom?: SharedFrom;
  /**
   * 아직 받아들이지 않은 제안.
   *
   * 메이트가 보낸 항목은 이 표시를 달고 들어와, 받는 쪽이 "담기"를 누르기
   * 전까지 어떤 합계에도 들어가지 않는다. 같이 먹는 사이라면 대신 적어 주는
   * 것이 편하지만, 그렇지 않은 두 사람에게는 내 숫자가 남의 손에 바뀌는 일이
   * 된다.
   */
  pending?: boolean;
  /**
   * 메이트가 담기를 눌러 확정된 사본.
   *
   * pending 을 지우는 대신 false 로 남기는 이유는, "담았다" 와 "이 기능이 있기
   * 전에 보내진 옛 항목" 이 둘 다 필드 없음이 되어 구분할 수 없기 때문이다.
   */
  sharedAccepted?: boolean;
}

/**
 * 합계에 넣을 항목인지.
 *
 * 요약·끼니 소계·캘린더·주간 차트가 저마다 다른 함수로 합을 내므로, 판단은
 * 여기 한 곳에 둔다. 한 곳이라도 빠지면 화면끼리 숫자가 어긋난다.
 */
export function isCounted(food: FoodItem): boolean {
  return !food.pending;
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
    for (const f of log.meals[meal] ?? []) {
      if (!isCounted(f)) continue;
      kcal += f.kcal ?? 0;
    }
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
  /**
   * 내가 파트너를 부르는 이름.
   *
   * 카카오 본명 대신 화면에 띄운다. 내 설정이므로 상대에게는 보이지 않고,
   * 비워 두면 본명으로 돌아간다.
   */
  partnerNickname?: string;
  /**
   * 메이트에게 열어 줄 기간.
   *
   * 연결한 사이라도 "오늘만 보여주고 싶다"는 경계는 흔하다. 특히 친구·동료라면
   * 지난달에 뭘 먹었는지까지 한 장씩 넘겨 보는 것은 부담이 된다.
   *
   * 값이 없으면 all — 이미 쓰고 있던 사람의 화면을 말없이 좁히지 않기 위해서다.
   * 새로 좁히고 싶은 사람이 직접 고른다.
   */
  shareScope?: ShareScope;
}

/** 메이트에게 열어 줄 기간 */
export type ShareScope = "today" | "week" | "all";

export const SHARE_SCOPE_LABELS: Record<ShareScope, string> = {
  today: "오늘만",
  week: "최근 7일",
  all: "전체 기록",
};

/**
 * 요청한 날짜가 공개 범위 안인지.
 *
 * days = UTC 오늘 − 요청 날짜. 과거일수록 커진다.
 *
 * 여유는 **미래 방향으로만** 준다. 서버는 UTC 로 오늘을 잡는데 한국은 UTC+9 라,
 * 한국 시간 새벽 0~9시에는 사용자의 "오늘"이 서버 기준 내일로 보여 days = -1 이
 * 된다. 과거 방향(days = +1)은 어떤 시간대에서도 생기지 않으므로, 여유를 주면
 * 어제를 통째로 여는 것 말고는 하는 일이 없다 — "오늘만"이 오늘만이 아니게 된다.
 *
 * 전제: 사용자가 한국 시간대에 있다. UTC 보다 뒤진 시간대(미주 등)에서는 그쪽의
 * "오늘"이 서버 기준 어제라 하루가 가려질 수 있다. 이 앱은 카카오 로그인 기반의
 * 한국어 전용이라 그 경우를 열어 두는 쪽보다 닫아 두는 쪽을 택했다.
 */
export function isWithinScope(date: string, scope: ShareScope | undefined): boolean {
  if (!scope || scope === "all") return true;
  const target = Date.parse(`${date}T00:00:00Z`);
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const days = Math.round((today - target) / 86_400_000);
  if (days < -1) return false; // 내일 이후는 어느 범위에서도 열지 않는다
  return scope === "today" ? days <= 0 : days <= 6; // 최근 7일 = 오늘 + 6일
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
