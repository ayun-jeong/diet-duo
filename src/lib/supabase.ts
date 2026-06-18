import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Supabase 환경변수 미설정 시 null (localStorage 전용 모드로 동작) */
export const supabase = url && key ? createClient(url, key) : null;
