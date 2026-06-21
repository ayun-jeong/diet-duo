"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Supabase 클라이언트가 URL의 code 파라미터를 자동으로 감지해 세션을 교환
    supabase?.auth.getSession().then(() => {
      router.replace("/");
    });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center text-gray-400 text-sm">
      로그인 중…
    </main>
  );
}
