"use client";

import { Check, Copy, Heart, Link2, Link2Off, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import {
  acceptInvite,
  createInvite,
  disconnectCouple,
  getCoupleStatus,
  type CoupleInfo,
} from "@/lib/couple-service";

export default function CoupleSetup() {
  const user = useAuth((s) => s.user);
  const [couple, setCouple] = useState<CoupleInfo | null>(null);
  const [loadingCouple, setLoadingCouple] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    if (!user) return;
    setLoadingCouple(true);
    const c = await getCoupleStatus(user.id);
    setCouple(c);
    setLoadingCouple(false);
  };

  useEffect(() => {
    refresh();
  }, [user]);

  if (!user) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-pink-50 to-rose-50 p-4 ring-1 ring-pink-100">
        <div className="flex items-center gap-2 text-sm font-bold text-pink-600">
          <Heart className="h-4 w-4 fill-pink-400" />
          커플 연결
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          로그인하면 연인과 식단을 공유할 수 있어요.
        </p>
      </div>
    );
  }

  const handleCreateInvite = async () => {
    setBusy(true);
    const code = await createInvite(user.id);
    if (code) {
      await refresh();
    } else {
      toast.error("초대 코드 생성 실패");
    }
    setBusy(false);
  };

  const handleAccept = async () => {
    if (!codeInput.trim()) { toast.error("코드를 입력하세요."); return; }
    setBusy(true);
    const result = await acceptInvite(codeInput.trim(), user.id);
    if (result.ok) {
      toast.success("커플 연결 완료!");
      await refresh();
    } else {
      toast.error(result.error ?? "연결 실패");
    }
    setCodeInput("");
    setBusy(false);
  };

  const handleDisconnect = async () => {
    if (!couple) return;
    if (!confirm("커플 연결을 해제하시겠어요?")) return;
    setBusy(true);
    await disconnectCouple(couple.id);
    setCouple(null);
    toast.info("커플 연결이 해제되었습니다.");
    setBusy(false);
  };

  const copyCode = () => {
    if (!couple?.inviteCode) return;
    navigator.clipboard.writeText(couple.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loadingCouple) {
    return (
      <div className="flex items-center justify-center rounded-2xl bg-white p-6 ring-1 ring-black/5">
        <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
      </div>
    );
  }

  // ── 연결됨 ─────────────────────────────────────────────────
  if (couple?.status === "active") {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-pink-50 to-rose-50 p-4 ring-1 ring-pink-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-pink-600">
            <Heart className="h-4 w-4 fill-pink-500" />
            커플 연결됨
          </div>
          <button
            onClick={handleDisconnect}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-rose-100 hover:text-rose-600"
          >
            <Link2Off className="h-3.5 w-3.5" />
            해제
          </button>
        </div>
        <p className="mt-1.5 text-sm font-semibold text-gray-700">
          {couple.partnerName ?? "파트너"}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          상대방의 오늘 식단을 아래에서 볼 수 있어요.
        </p>
      </div>
    );
  }

  // ── 대기 중 (내가 초대 생성) ──────────────────────────────
  if (couple?.status === "pending" && couple.isInitiator) {
    return (
      <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <Link2 className="h-4 w-4 text-emerald-500" />
          초대 코드
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 rounded-xl bg-emerald-50 px-4 py-3 text-center font-mono text-2xl font-extrabold tracking-[0.25em] text-emerald-700">
            {couple.inviteCode}
          </div>
          <button
            onClick={copyCode}
            className="shrink-0 rounded-xl bg-emerald-600 p-3 text-white hover:bg-emerald-700"
            aria-label="복사"
          >
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-400">
          파트너가 이 코드를 입력하면 연결됩니다.
        </p>
        <button
          onClick={refresh}
          disabled={busy}
          className="mt-3 w-full rounded-xl border border-gray-200 py-2 text-xs text-gray-500 hover:bg-gray-50"
        >
          연결 확인
        </button>
      </div>
    );
  }

  // ── 커플 없음 ─────────────────────────────────────────────
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
        <Heart className="h-4 w-4 text-pink-400" />
        커플 연결
      </div>

      <button
        onClick={handleCreateInvite}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 py-2.5 text-sm font-bold text-white hover:bg-pink-600 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
        초대 코드 생성
      </button>

      <div className="my-3 flex items-center gap-2 text-xs text-gray-300">
        <div className="flex-1 h-px bg-gray-100" />
        또는
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <div className="flex gap-2">
        <input
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") handleAccept(); }}
          placeholder="코드 입력 (예: AB3X7Z)"
          maxLength={6}
          className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-pink-400"
        />
        <button
          onClick={handleAccept}
          disabled={busy || !codeInput.trim()}
          className="shrink-0 rounded-xl bg-gray-800 px-3 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:opacity-40"
        >
          연결
        </button>
      </div>
    </div>
  );
}
