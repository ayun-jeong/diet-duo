import type { AppSettings, DayLog, FavoriteFood, UserProfile } from "../types";

/**
 * 저장소 추상화 인터페이스.
 *
 * MVP는 LocalStorageAdapter(브라우저 localStorage)로 동작하고,
 * 나중에 로그인을 붙일 때 동일한 인터페이스의 SupabaseAdapter 등으로
 * 갈아끼우면 UI 코드는 수정 없이 그대로 사용할 수 있다.
 */
export interface StorageAdapter {
  getProfile(): Promise<UserProfile | null>;
  saveProfile(profile: UserProfile): Promise<void>;

  getDayLog(date: string): Promise<DayLog | null>;
  saveDayLog(log: DayLog): Promise<void>;

  getSettings(): Promise<AppSettings | null>;
  saveSettings(settings: AppSettings): Promise<void>;

  getFavorites(): Promise<FavoriteFood[]>;
  saveFavorites(favorites: FavoriteFood[]): Promise<void>;
}
