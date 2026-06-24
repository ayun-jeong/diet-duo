/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AppSettings, DayLog, FavoriteFood, UserProfile } from "../types";
import { emptyDayLog } from "../types";
import type { StorageAdapter } from "./StorageAdapter";

type Row = Record<string, any>;

export class SupabaseAdapter implements StorageAdapter {
  constructor(
    private readonly db: any,
    private readonly userId: string,
  ) {}

  private async query<T = Row>(
    table: string,
    select: string,
    filters: [string, string][] = [],
    single = true,
  ): Promise<T | null> {
    let q = this.db.from(table).select(select);
    for (const [col, val] of filters) q = q.eq(col, val);
    const { data } = single ? await q.maybeSingle() : await q;
    return (data as T | null) ?? null;
  }

  async getProfile(): Promise<UserProfile | null> {
    const data = await this.query<Row>(
      "user_profiles",
      "height_cm, weight_kg, age, sex, activity, goal",
      [["id", this.userId]],
    );
    if (!data?.height_cm) return null;
    return {
      heightCm: data.height_cm,
      weightKg: data.weight_kg,
      age: data.age,
      sex: data.sex,
      activity: data.activity,
      goal: data.goal,
    } as UserProfile;
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    const { error } = await this.db.from("user_profiles").upsert(
      {
        id: this.userId,
        height_cm: profile.heightCm,
        weight_kg: profile.weightKg,
        age: profile.age,
        sex: profile.sex,
        activity: profile.activity,
        goal: profile.goal,
      },
      { onConflict: "id" },
    );
    if (error) {
      console.error("[SupabaseAdapter] saveProfile error:", error);
      throw new Error(error.message);
    }
  }

  async getDayLog(date: string): Promise<DayLog | null> {
    const data = await this.query<Row>(
      "day_logs",
      "meals, water_ml, memo, steps, exercises",
      [
        ["user_id", this.userId],
        ["date", date],
      ],
    );
    if (!data) return null;
    return {
      date,
      meals: data.meals ?? emptyDayLog(date).meals,
      waterMl: data.water_ml ?? 0,
      memo: data.memo ?? "",
      steps: data.steps ?? 0,
      exercises: data.exercises ?? [],
    };
  }

  async saveDayLog(log: DayLog): Promise<void> {
    const { error } = await this.db.from("day_logs").upsert(
      {
        user_id: this.userId,
        date: log.date,
        meals: log.meals,
        water_ml: log.waterMl,
        memo: log.memo ?? "",
        steps: log.steps ?? 0,
        exercises: log.exercises ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" },
    );
    if (error) console.error("[SupabaseAdapter] saveDayLog error:", error);
  }

  async getSettings(): Promise<AppSettings | null> {
    const data = await this.query<Row>(
      "user_profiles",
      "settings",
      [["id", this.userId]],
    );
    const s = data?.settings;
    if (!s?.waterCupMl) return null;
    return s as AppSettings;
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const { error } = await this.db
      .from("user_profiles")
      .update({ settings })
      .eq("id", this.userId);
    if (error) console.error("[SupabaseAdapter] saveSettings error:", error);
  }

  async getFavorites(): Promise<FavoriteFood[]> {
    const data = await this.query<Row>(
      "user_profiles",
      "favorites",
      [["id", this.userId]],
    );
    return (data?.favorites as FavoriteFood[]) ?? [];
  }

  async saveFavorites(favorites: FavoriteFood[]): Promise<void> {
    const { error } = await this.db
      .from("user_profiles")
      .update({ favorites })
      .eq("id", this.userId);
    if (error) console.error("[SupabaseAdapter] saveFavorites error:", error);
  }
}
