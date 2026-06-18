import type { AppSettings, DayLog, FavoriteFood, UserProfile } from "../types";
import type { StorageAdapter } from "./StorageAdapter";

const PROFILE_KEY = "diet:profile";
const SETTINGS_KEY = "diet:settings";
const FAVORITES_KEY = "diet:favorites";
const dayKey = (date: string) => `diet:day:${date}`;

/** 브라우저 localStorage 기반 저장소 구현 (MVP) */
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
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  async getProfile(): Promise<UserProfile | null> {
    return this.read<UserProfile>(PROFILE_KEY);
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    this.write(PROFILE_KEY, profile);
  }

  async getDayLog(date: string): Promise<DayLog | null> {
    return this.read<DayLog>(dayKey(date));
  }

  async saveDayLog(log: DayLog): Promise<void> {
    this.write(dayKey(log.date), log);
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
}
