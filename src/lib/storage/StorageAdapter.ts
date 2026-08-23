import type {
  AppSettings,
  DayLog,
  DaySummary,
  FavoriteFood,
  UserProfile,
} from "../types";

/** 앱 시작 시 필요한 값 묶음 (한 번의 왕복으로 받기 위한 형태) */
export interface BootstrapData {
  profile: UserProfile | null;
  settings: AppSettings | null;
  favorites: FavoriteFood[];
  dayLog: DayLog | null;
}

/**
 * 저장소 추상화 인터페이스.
 *
 * 비로그인 상태는 LocalStorageAdapter(브라우저 localStorage),
 * 로그인 상태는 ApiAdapter(서버 라우트 → Supabase service_role)로 교체된다.
 * UI 코드는 어느 쪽인지 알 필요가 없다.
 */
export interface StorageAdapter {
  /** 프로필·설정·즐겨찾기·해당 날짜 기록을 한 번에 (초기 로드 전용) */
  bootstrap(date: string): Promise<BootstrapData>;

  saveProfile(profile: UserProfile): Promise<void>;
  saveSettings(settings: AppSettings): Promise<void>;
  saveFavorites(favorites: FavoriteFood[]): Promise<void>;

  getDayLog(date: string): Promise<DayLog | null>;
  saveDayLog(log: DayLog): Promise<void>;

  /** [from, to] 구간 일별 요약 — 캘린더·주간 차트·체중 추이가 공유한다. */
  getDaySummaries(from: string, to: string): Promise<DaySummary[]>;
}
