import { apiUrl } from "../api";
import {
  normalizeDayLog,
  type AppSettings,
  type DayLog,
  type DaySummary,
  type FavoriteFood,
  type UserProfile,
} from "../types";
import type { BootstrapData, StorageAdapter } from "./StorageAdapter";

/**
 * 서버에 DB 가 설정되지 않았을 때(503) 던진다.
 *
 * 카카오 로그인은 Supabase 없이도 동작하므로 "로그인은 됐는데 DB 는 없는" 상태가
 * 실제로 생긴다. 이때는 오류를 반복해서 띄우지 말고 localStorage 전용으로 물러난다.
 */
export class DbUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DbUnavailableError";
  }
}

/**
 * 로그인 상태 저장소.
 *
 * Supabase 를 브라우저에서 직접 호출하지 않고 Next.js API 라우트를 거친다.
 * 서버가 NextAuth 세션으로 본인 확인 후 service_role 키로 접근하므로
 * DB 키가 브라우저 번들에 실리지 않는다.
 */
export class ApiAdapter implements StorageAdapter {
  private async request<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const res = await fetch(apiUrl(path), {
      credentials: "include",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      ...init,
    });

    if (!res.ok) {
      let message = `요청 실패 (${res.status})`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch {
        /* 본문이 JSON 이 아니면 상태 코드 메시지를 쓴다 */
      }
      if (res.status === 503) throw new DbUnavailableError(message);
      throw new Error(message);
    }
    return (await res.json()) as T;
  }

  async bootstrap(date: string): Promise<BootstrapData> {
    const data = await this.request<{
      profile: UserProfile | null;
      settings: AppSettings | null;
      favorites: FavoriteFood[];
      dayLog: DayLog | null;
    }>(`/api/bootstrap?date=${date}`);

    return {
      profile: data.profile,
      settings: data.settings,
      favorites: data.favorites ?? [],
      dayLog: data.dayLog ? normalizeDayLog(date, data.dayLog) : null,
    };
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    await this.request("/api/user", {
      method: "PUT",
      body: JSON.stringify({ profile }),
    });
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.request("/api/user", {
      method: "PUT",
      body: JSON.stringify({ settings }),
    });
  }

  async saveFavorites(favorites: FavoriteFood[]): Promise<void> {
    await this.request("/api/user", {
      method: "PUT",
      body: JSON.stringify({ favorites }),
    });
  }

  async getDayLog(date: string): Promise<DayLog | null> {
    const { dayLog } = await this.request<{ dayLog: DayLog | null }>(
      `/api/day-log?date=${date}`,
    );
    return dayLog ? normalizeDayLog(date, dayLog) : null;
  }

  async saveDayLog(log: DayLog): Promise<void> {
    await this.request("/api/day-log", {
      method: "PUT",
      body: JSON.stringify({ dayLog: log }),
    });
  }

  async getDaySummaries(from: string, to: string): Promise<DaySummary[]> {
    const { summaries } = await this.request<{ summaries: DaySummary[] }>(
      `/api/day-logs?from=${from}&to=${to}`,
    );
    return summaries ?? [];
  }
}
