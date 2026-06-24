import { create } from "zustand";
import { storage } from "./storage";
import {
  DEFAULT_SETTINGS,
  emptyDayLog,
  type AppSettings,
  type DayLog,
  type ExerciseItem,
  type FavoriteFood,
  type FoodItem,
  type MealType,
  type UserProfile,
} from "./types";

const WEIGHT_KEY = "diet:weights";

function readWeightLog(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(WEIGHT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch { return {}; }
}

function writeWeightLog(log: Record<string, number>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WEIGHT_KEY, JSON.stringify(log));
}

/** 로컬 기준 오늘 날짜 (YYYY-MM-DD) */
export function todayStr(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface DietState {
  ready: boolean;
  profile: UserProfile | null;
  settings: AppSettings;
  favorites: FavoriteFood[];
  date: string;
  log: DayLog;
  weightLog: Record<string, number>;

  init: () => Promise<void>;
  setProfile: (p: UserProfile) => Promise<void>;
  setSettings: (s: Partial<AppSettings>) => Promise<void>;
  setDate: (date: string) => Promise<void>;
  addFood: (meal: MealType, food: Omit<FoodItem, "id">) => Promise<void>;
  updateFood: (meal: MealType, id: string, updates: Partial<Omit<FoodItem, "id">>) => Promise<void>;
  removeFood: (meal: MealType, id: string) => Promise<void>;
  addWater: (ml: number) => Promise<void>;
  setWater: (ml: number) => Promise<void>;
  addFavorite: (food: Omit<FavoriteFood, "id">) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  setMemo: (memo: string) => Promise<void>;
  setSteps: (steps: number) => Promise<void>;
  addExercise: (exercise: Omit<ExerciseItem, "id">) => Promise<void>;
  removeExercise: (id: string) => Promise<void>;
  setDailyWeight: (date: string, weightKg: number) => void;
}

export const useDiet = create<DietState>((set, get) => ({
  ready: false,
  profile: null,
  settings: DEFAULT_SETTINGS,
  favorites: [],
  date: todayStr(),
  log: emptyDayLog(todayStr()),
  weightLog: {},

  init: async () => {
    const date = todayStr();
    const [profile, log, settings, favorites] = await Promise.all([
      storage.getProfile(),
      storage.getDayLog(date),
      storage.getSettings(),
      storage.getFavorites(),
    ]);
    // Supabase 실패 시 localStorage 백업에서 복구
    let resolvedProfile = profile;
    if (!resolvedProfile && typeof window !== "undefined") {
      try {
        const backup = window.localStorage.getItem("diet:profile-backup");
        if (backup) resolvedProfile = JSON.parse(backup) as UserProfile;
      } catch {}
    }
    const base = emptyDayLog(date);
    set({
      ready: true,
      profile: resolvedProfile,
      settings: settings ?? DEFAULT_SETTINGS,
      favorites,
      date,
      log: log ? { ...base, ...log, exercises: log.exercises ?? [] } : base,
      weightLog: readWeightLog(),
    });
  },

  setProfile: async (p) => {
    // localStorage 백업 항상 유지 (Supabase 장애 시 복구용)
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem("diet:profile-backup", JSON.stringify(p)); } catch {}
    }
    set({ profile: p }); // 메모리는 항상 즉시 업데이트
    await storage.saveProfile(p); // Supabase 실패 시 throw
  },

  setSettings: async (s) => {
    const next = { ...get().settings, ...s };
    await storage.saveSettings(next);
    set({ settings: next });
  },

  setDate: async (date) => {
    const log = await storage.getDayLog(date);
    const base = emptyDayLog(date);
    set({ date, log: log ? { ...base, ...log, exercises: log.exercises ?? [] } : base });
  },

  addFood: async (meal, food) => {
    const { log } = get();
    const next: DayLog = {
      ...log,
      meals: {
        ...log.meals,
        [meal]: [...log.meals[meal], { ...food, id: genId() }],
      },
    };
    await storage.saveDayLog(next);
    set({ log: next });
  },

  updateFood: async (meal, id, updates) => {
    const { log } = get();
    const next: DayLog = {
      ...log,
      meals: {
        ...log.meals,
        [meal]: log.meals[meal].map((f) =>
          f.id === id ? { ...f, ...updates } : f,
        ),
      },
    };
    await storage.saveDayLog(next);
    set({ log: next });
  },

  removeFood: async (meal, id) => {
    const { log } = get();
    const next: DayLog = {
      ...log,
      meals: {
        ...log.meals,
        [meal]: log.meals[meal].filter((f) => f.id !== id),
      },
    };
    await storage.saveDayLog(next);
    set({ log: next });
  },

  addWater: async (ml) => {
    const { log } = get();
    const next: DayLog = {
      ...log,
      waterMl: Math.max(0, log.waterMl + ml),
    };
    await storage.saveDayLog(next);
    set({ log: next });
  },

  setWater: async (ml) => {
    const { log } = get();
    const next: DayLog = { ...log, waterMl: Math.max(0, Math.round(ml)) };
    await storage.saveDayLog(next);
    set({ log: next });
  },

  addFavorite: async (food) => {
    const { favorites } = get();
    const next = [...favorites, { ...food, id: genId() }];
    await storage.saveFavorites(next);
    set({ favorites: next });
  },

  removeFavorite: async (id) => {
    const { favorites } = get();
    const next = favorites.filter((f) => f.id !== id);
    await storage.saveFavorites(next);
    set({ favorites: next });
  },

  setMemo: async (memo) => {
    const { log } = get();
    const next: DayLog = { ...log, memo };
    await storage.saveDayLog(next);
    set({ log: next });
  },

  setSteps: async (steps) => {
    const { log } = get();
    const next: DayLog = { ...log, steps: Math.max(0, steps) };
    await storage.saveDayLog(next);
    set({ log: next });
  },

  addExercise: async (exercise) => {
    const { log } = get();
    const next: DayLog = {
      ...log,
      exercises: [...(log.exercises ?? []), { ...exercise, id: genId() }],
    };
    await storage.saveDayLog(next);
    set({ log: next });
  },

  removeExercise: async (id) => {
    const { log } = get();
    const next: DayLog = {
      ...log,
      exercises: (log.exercises ?? []).filter((e) => e.id !== id),
    };
    await storage.saveDayLog(next);
    set({ log: next });
  },

  setDailyWeight: (date, weightKg) => {
    const { weightLog } = get();
    const next = { ...weightLog, [date]: weightKg };
    writeWeightLog(next);
    set({ weightLog: next });
  },
}));
