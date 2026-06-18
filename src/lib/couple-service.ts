import { supabase } from "./supabase";
import type { DayLog } from "./types";
import { MEAL_TYPES, emptyDayLog } from "./types";

export interface CoupleInfo {
  id: string;
  status: "pending" | "active";
  inviteCode: string;
  /** 파트너 user_id */
  partnerId?: string;
  /** 파트너 닉네임 */
  partnerName?: string;
  /** true = 내가 초대를 만든 쪽 (user_a) */
  isInitiator: boolean;
}

function makeCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

/** 현재 유저의 커플 상태 조회 */
export async function getCoupleStatus(userId: string): Promise<CoupleInfo | null> {
  if (!supabase) return null;

  const { data: couple } = await supabase
    .from("couples")
    .select("id, status, invite_code, user_a, user_b")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!couple) return null;

  const isInitiator = couple.user_a === userId;
  const partnerId: string | undefined = isInitiator
    ? couple.user_b ?? undefined
    : couple.user_a;

  let partnerName: string | undefined;
  if (partnerId) {
    const { data: display } = await supabase
      .from("user_display")
      .select("display_name")
      .eq("id", partnerId)
      .maybeSingle();
    partnerName = display?.display_name;
  }

  return {
    id: couple.id,
    status: couple.status,
    inviteCode: couple.invite_code,
    partnerId,
    partnerName,
    isInitiator,
  };
}

/** 초대 코드 생성 (이미 pending이면 기존 코드 반환) */
export async function createInvite(userId: string): Promise<string | null> {
  if (!supabase) return null;

  // 기존 pending 초대가 있으면 재사용
  const existing = await getCoupleStatus(userId);
  if (existing?.status === "pending" && existing.isInitiator) {
    return existing.inviteCode;
  }

  const code = makeCode();
  const { error } = await supabase
    .from("couples")
    .insert({ user_a: userId, invite_code: code });

  return error ? null : code;
}

/** 초대 코드로 커플 연결 */
export async function acceptInvite(
  code: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Supabase 미설정" };

  const { data: couple, error: selectErr } = await supabase
    .from("couples")
    .select("id, user_a")
    .eq("invite_code", code.toUpperCase())
    .eq("status", "pending")
    .is("user_b", null)
    .maybeSingle();

  if (selectErr || !couple) {
    return { ok: false, error: "유효하지 않은 코드입니다." };
  }
  if (couple.user_a === userId) {
    return { ok: false, error: "자신의 초대 코드는 사용할 수 없습니다." };
  }

  const { error: updateErr } = await supabase
    .from("couples")
    .update({ user_b: userId, status: "active" })
    .eq("id", couple.id);

  return updateErr
    ? { ok: false, error: "연결 중 오류가 발생했습니다." }
    : { ok: true };
}

/** 커플 연결 해제 */
export async function disconnectCouple(coupleId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("couples").delete().eq("id", coupleId);
}

/** 파트너의 day_log 조회 (비공개 항목 포함 원본 - 서버에서만 호출할 것) */
export async function getPartnerDayLog(
  partnerId: string,
  date: string,
): Promise<DayLog | null> {
  if (!supabase) return null;

  const { data } = await supabase
    .from("day_logs")
    .select("*")
    .eq("user_id", partnerId)
    .eq("date", date)
    .maybeSingle();

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

/** 파트너 닉네임 조회 */
export async function getDisplayName(userId: string): Promise<string> {
  if (!supabase) return "파트너";
  const { data } = await supabase
    .from("user_display")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name ?? "파트너";
}
