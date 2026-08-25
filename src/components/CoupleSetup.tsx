"use client";

import { Check, Copy, CloudOff, Heart, Link2, Link2Off, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import { useDiet } from "@/lib/store";
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
  const [unavailable, setUnavailable] = useState(false);
  const [loadingCouple, setLoadingCouple] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  /**
   * 파트너를 부르는 이름.
   *
   * 카카오 본명이 화면 곳곳(탭·요약·끼니 카드)에 그대로 뜨는 게 어색해서,
   * 내가 부를 이름을 따로 적게 한다. 내 설정이라 상대에게는 보이지 않는다.
   */
  const savedNickname = useDiet((s) => s.settings.partnerNickname ?? "");
  const setSettings = useDiet((s) => s.setSettings);
  const [nickname, setNickname] = useState(savedNickname);

  // 설정은 로그인 후 서버에서 뒤늦게 도착할 수 있다. 입력 중일 때는 건드리지 않는다.
  const editingNickname = useRef(false);
  useEffect(() => {
    if (editingNickname.current) return;
    setNickname(savedNickname);
  }, [savedNickname]);

  const applyNickname = () => {
    editingNickname.current = false;
    const next = nickname.trim().slice(0, 20);
    setNickname(next);
    if (next !== savedNickname) setSettings({ partnerNickname: next });
  };

  const refresh = useCallback(async () => {
    if (!user) {
      setCouple(null);
      return;
    }
    setLoadingCouple(true);
    try {
      const status = await getCoupleStatus();
      setUnavailable(status.kind === "unavailable");
      setCouple(status.kind === "linked" ? status.couple : null);
    } finally {
      setLoadingCouple(false);
    }
  }, [user]);

  // user 객체가 아니라 id 로 비교해야 매 렌더마다 재조회되지 않는다.
  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    const { couple: created, error } = await createInvite();
    if (created) setCouple(created);
    else toast.error(error ?? "초대 코드 생성 실패");
    setBusy(false);
  };

  const handleAccept = async () => {
    if (!codeInput.trim()) { toast.error("코드를 입력하세요."); return; }
    setBusy(true);
    const { couple: linked, error } = await acceptInvite(codeInput.trim());
    if (linked) {
      setCouple(linked);
      setCodeInput("");
      toast.success("커플 연결 완료!");
    } else {
      // 실패 시 입력값을 지우지 않는다 (오타면 다시 고쳐 쓸 수 있게).
      toast.error(error ?? "연결 실패");
    }
    setBusy(false);
  };

  const handleDisconnect = async () => {
    if (!couple) return;
    if (!confirm("커플 연결을 해제하시겠어요?")) return;
    setBusy(true);
    const { error } = await disconnectCouple();
    if (error) {
      toast.error(error);
    } else {
      setCouple(null);
      toast.info("커플 연결이 해제되었습니다.");
    }
    setBusy(false);
  };

  const copyCode = () => {
    if (!couple?.inviteCode) return;
    // Capacitor WebView 등에서는 clipboard 접근이 거부될 수 있다.
    navigator.clipboard
      ?.writeText(couple.inviteCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("복사에 실패했습니다. 코드를 직접 입력해 주세요."));
  };

  if (loadingCouple) {
    return (
      <div className="flex items-center justify-center rounded-2xl bg-white p-6 ring-1 ring-black/5">
        <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
      </div>
    );
  }

  // ── 서버 동기화 미설정 ─────────────────────────────────────
  // DB 없이도 앱의 나머지 기능은 그대로 쓸 수 있으므로, 실패하는 버튼을
  // 띄우는 대신 왜 못 쓰는지만 알려준다.
  if (unavailable) {
    return (
      <div className="rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-200">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
          <CloudOff className="h-4 w-4" />
          커플 연결 사용 불가
        </div>
        <p className="mt-1.5 text-xs text-gray-400">
          서버 동기화가 설정되지 않았어요. 식단·운동 기록은 이 기기에 저장되며
          정상적으로 사용할 수 있습니다.
        </p>
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
        <label className="mt-2 block">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            부를 이름
          </span>
          <input
            value={nickname}
            onChange={(e) => {
              editingNickname.current = true;
              setNickname(e.target.value);
            }}
            onBlur={applyNickname}
            onKeyDown={(e) => e.key === "Enter" && applyNickname()}
            maxLength={20}
            placeholder={couple.partnerName ?? "파트너"}
            className="w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-300 focus:border-pink-400"
          />
        </label>
        <p className="mt-1 text-xs text-gray-400">
          비워 두면 <b className="font-semibold text-gray-500">
            {couple.partnerName ?? "파트너"}
          </b>{" "}
          로 표시됩니다. 나에게만 보이는 이름이에요.
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
