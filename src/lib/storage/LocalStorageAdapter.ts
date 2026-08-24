import {
  normalizeDayLog,
  sumMealKcal,
  type AppSettings,
  type DayLog,
  type DaySummary,
  type FavoriteFood,
  type UserProfile,
} from "../types";
import type { BootstrapData, StorageAdapter } from "./StorageAdapter";

const PROFILE_KEY = "diet:profile";
const SETTINGS_KEY = "diet:settings";
const FAVORITES_KEY = "diet:favorites";
const MEMO_KEY = "diet:memo";
/** 구버전에서 체중을 따로 보관하던 키 (읽기 호환용) */
const LEGACY_WEIGHT_KEY = "diet:weights";
const dayKey = (date: string) => `diet:day:${date}`;

function shiftDate(base: string, delta: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

/** 브라우저 localStorage 기반 저장소 (비로그인 모드) */
export class LocalStorageAdapter implements StorageAdapter {
  private read<T>(key: string): T | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // 용량 초과(QuotaExceededError) 등은 조용히 넘긴다 — 메모리 상태는 이미 갱신됨.
      console.error("[LocalStorageAdapter] write 실패:", key, e);
    }
  }

  private legacyWeights(): Record<string, number> {
    return this.read<Record<string, number>>(LEGACY_WEIGHT_KEY) ?? {};
  }

  async bootstrap(date: string): Promise<BootstrapData> {
    return {
      profile: await this.getProfile(),
      settings: await this.getSettings(),
      favorites: await this.getFavorites(),
      memo: this.read<string>(MEMO_KEY) ?? "",
      dayLog: await this.getDayLog(date),
    };
  }

  async saveMemo(memo: string): Promise<void> {
    this.write(MEMO_KEY, memo);
  }

  async getProfile(): Promise<UserProfile | null> {
    return this.read<UserProfile>(PROFILE_KEY);
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    this.write(PROFILE_KEY, profile);
  }

  async getDayLog(date: string): Promise<DayLog | null> {
    const raw = this.read<DayLog>(dayKey(date));
    if (!raw) return null;
    const log = normalizeDayLog(date, raw);
    // 구버전 체중 기록을 흡수한다.
    if (log.weightKg == null) {
      const legacy = this.legacyWeights()[date];
      if (legacy != null) log.weightKg = legacy;
    }
    return log;
  }

  async saveDayLog(log: DayLog): Promise<void> {
    this.write(dayKey(log.date), normalizeDayLog(log.date, log));
  }

  async getSettings(): Promise<AppSettings | null> {
    return this.read<AppSettings>(SETTINGS_KEY);
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    this.write(SETTINGS_KEY, settings);
  }

  async getFavorites(): Promise<FavoriteFood[]> {
    return this.read<FavoriteFood[]>(FAVORITES_KEY) ?? [];
  }

  async saveFavorites(favorites: FavoriteFood[]): Promise<void> {
    this.write(FAVORITES_KEY, favorites);
  }

  async getDaySummaries(from: string, to: string): Promise<DaySummary[]> {
    if (typeof window === "undefined") return [];
    const legacy = this.legacyWeights();
    const out: DaySummary[] = [];

    for (let d = from; d <= to; d = shiftDate(d, 1)) {
      const raw = this.read<DayLog>(dayKey(d));
      const weightKg = raw?.weightKg ?? legacy[d];
      if (!raw && weightKg == null) continue;
      out.push({
        date: d,
        kcal: raw ? sumMealKcal(normalizeDayLog(d, raw)) : 0,
        weightKg,
        waterMl: raw?.waterMl ?? 0,
      });
    }
    return out;
  }
}
