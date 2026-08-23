import { normalizeDayLog, sumMealKcal } from "@/lib/types";
import type { AppSettings, DayLog, FavoriteFood, UserProfile } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

/** app_users 행 → UserProfile (필수값이 비어 있으면 프로필 미설정으로 간주) */
export function rowToProfile(row: Row | null): UserProfile | null {
  if (!row?.height_cm || !row?.weight_kg || !row?.age) return null;
  return {
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    age: row.age,
    sex: row.sex,
    activity: row.activity,
    goal: row.goal,
  } as UserProfile;
}

export function profileToRow(profile: UserProfile): Row {
  return {
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    age: profile.age,
    sex: profile.sex,
    activity: profile.activity,
    goal: profile.goal,
  };
}

/** settings 가 빈 jsonb({}) 인 경우 null 을 돌려 클라이언트 기본값을 쓰게 한다. */
export function rowToSettings(row: Row | null): AppSettings | null {
  const s = row?.settings;
  return s && typeof s.waterCupMl === "number" ? (s as AppSettings) : null;
}

export function rowToFavorites(row: Row | null): FavoriteFood[] {
  return Array.isArray(row?.favorites) ? (row.favorites as FavoriteFood[]) : [];
}

export function rowToDayLog(date: string, row: Row | null): DayLog | null {
  if (!row) return null;
  return normalizeDayLog(date, {
    meals: row.meals,
    waterMl: row.water_ml,
    memo: row.memo,
    steps: row.steps,
    exercises: row.exercises,
    weightKg: row.weight_kg ?? undefined,
  });
}

/**
 * DayLog → day_logs 행.
 * kcal 은 여기서 계산해 저장한다. 캘린더·주간 차트가 meals jsonb 전체를 내려받지 않고
 * 숫자 컬럼만 range 조회할 수 있게 하기 위한 비정규화 컬럼이다.
 */
export function dayLogToRow(userId: string, log: DayLog): Row {
  const safe = normalizeDayLog(log.date, log);
  return {
    user_id: userId,
    date: safe.date,
    meals: safe.meals,
    water_ml: safe.waterMl,
    memo: safe.memo ?? "",
    steps: safe.steps ?? 0,
    exercises: safe.exercises,
    weight_kg: safe.weightKg ?? null,
    kcal: sumMealKcal(safe),
    updated_at: new Date().toISOString(),
  };
}

/** 날짜 문자열 검증 (YYYY-MM-DD) — 쿼리 파라미터를 그대로 신뢰하지 않기 위함 */
export function isValidDate(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}
