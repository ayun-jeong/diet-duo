"use client";

import { Eye, EyeOff, Loader2, Mail, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import { supabase } from "@/lib/supabase";

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export default function AuthModal() {
  const open = useAuth((s) => s.authModalOpen);
  const setOpen = useAuth((s) => s.setAuthModalOpen);
  const signIn = useAuth((s) => s.signIn);
  const signUp = useAuth((s) => s.signUp);
  const loading = useAuth((s) => s.loading);

  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [emailPending, setEmailPending] = useState(false);

  if (!open) return null;

  const reset = () => {
    setEmail("");
    setPassword("");
    setName("");
    setShowPw(false);
    setEmailPending(false);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) {
      toast.error(".env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.");
      return;
    }

    if (tab === "login") {
      const err = await signIn(email, password);
      if (err === "EMAIL_NOT_CONFIRMED") {
        setEmailPending(true);
      } else if (err) {
        toast.error(err);
      } else {
        toast.success("로그인되었습니다.");
        close();
      }
    } else {
      if (!name.trim()) { toast.error("닉네임을 입력하세요."); return; }
      if (password.length < 6) { toast.error("비밀번호는 6자 이상이어야 합니다."); return; }
      const err = await signUp(email, password, name.trim());
      if (err) {
        toast.error(err);
      } else {
        setEmailPending(true);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">

        {/* 닫기 */}
        <button
          onClick={close}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </button>

        {emailPending ? (
          /* 이메일 확인 대기 */
          <div className="py-4 text-center">
            <Mail className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
            <p className="text-sm font-semibold text-gray-800">이메일을 확인해 주세요</p>
            <p className="mt-1.5 text-xs text-gray-500">
              <span className="font-medium text-emerald-600">{email}</span>으로<br />
              인증 링크를 보냈습니다. 링크를 클릭하면 로그인됩니다.
            </p>
            <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-400 text-left">
              메일이 안 오면 스팸함을 확인하거나,<br />
              Supabase 대시보드 → Authentication → Providers → Email →<br />
              <span className="font-medium">&quot;Confirm email&quot; 끄기</span>를 하면 즉시 로그인할 수 있습니다.
            </p>
            <button
              onClick={close}
              className="mt-4 w-full rounded-xl border border-gray-200 py-2 text-sm text-gray-500 hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        ) : (
          /* 로그인 / 회원가입 폼 */
          <>
            {/* 탭 */}
            <div className="mb-5 flex gap-2 rounded-xl bg-gray-100 p-1">
              {(["login", "signup"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={[
                    "flex-1 rounded-lg py-1.5 text-sm font-semibold transition",
                    tab === t
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700",
                  ].join(" ")}
                >
                  {t === "login" ? "로그인" : "회원가입"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {tab === "signup" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">닉네임</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="파트너에게 보여질 이름"
                    className={inputCls}
                    required
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">비밀번호</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={tab === "signup" ? "6자 이상" : ""}
                    className={inputCls + " pr-10"}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {tab === "login" ? "로그인" : "가입하기"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-gray-400">
              {tab === "login" ? (
                <>
                  계정이 없으신가요?{" "}
                  <button onClick={() => setTab("signup")} className="font-semibold text-emerald-600 hover:underline">
                    회원가입
                  </button>
                </>
              ) : (
                <>
                  이미 계정이 있으신가요?{" "}
                  <button onClick={() => setTab("login")} className="font-semibold text-emerald-600 hover:underline">
                    로그인
                  </button>
                </>
              )}
            </p>
          </>
        )}

      </div>
    </div>
  );
}
