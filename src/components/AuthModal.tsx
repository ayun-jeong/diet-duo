"use client";

import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useAuth } from "@/lib/auth-store";

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3C6.477 3 2 6.477 2 10.84c0 2.763 1.73 5.19 4.33 6.63L5.2 21l4.62-2.46C10.43 18.84 11.2 18.9 12 18.9c5.523 0 10-3.477 10-7.84C22 6.477 17.523 3 12 3z" />
    </svg>
  );
}

export default function AuthModal() {
  const open = useAuth((s) => s.authModalOpen);
  const setOpen = useAuth((s) => s.setAuthModalOpen);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleKakao = async () => {
    setLoading(true);
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    if (apiBase) {
      // 모바일: WebView 전체를 Vercel로 이동 → 카카오 로그인 → 앱으로 복귀
      const callbackUrl = encodeURIComponent(`${window.location.origin}/`);
      window.location.href = `${apiBase}/api/auth/signin/kakao?callbackUrl=${callbackUrl}`;
    } else {
      await signIn("kakao", { callbackUrl: "/" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-xs rounded-2xl bg-white p-8 shadow-2xl">

        <button
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <h2 className="text-lg font-extrabold text-gray-800">로그인</h2>
            <p className="mt-1 text-xs text-gray-400">카카오 계정으로 간편하게 시작하세요</p>
          </div>

          <button
            onClick={handleKakao}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-bold text-[#1A1A1A] transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#FEE500" }}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <KakaoIcon />}
            카카오로 로그인
          </button>

          <p className="text-center text-[11px] text-gray-400">
            로그인하지 않아도 모든 기능을 사용할 수 있어요.<br />
            로그인 시 기기 간 데이터 동기화가 가능합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
