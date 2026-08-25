"use client";

import { UserPlus } from "lucide-react";

/**
 * 아직 아무와도 연결되지 않았을 때 홈에 뜨는 초대 자리.
 *
 * ViewToggle 은 고를 것이 있어야 그린다. 그래서 연결 전에는 그 자리가 통째로
 * 비었고, 초대는 내 정보 화면 맨 아래에만 있었다. 둘이 같이 설치하면 문제가
 * 없지만 혼자 먼저 깔아 본 사람은 이 앱이 둘이 쓰는 앱이라는 것을 알 방법이
 * 없다 — 같은 자리에서 초대로 이어 준다.
 */
export default function InviteBanner({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-full border border-dashed border-emerald-300 bg-emerald-50/70 px-4 py-1.5 text-left text-xs font-bold text-emerald-700 hover:bg-emerald-50"
    >
      <UserPlus className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">함께할 사람 초대하기</span>
      {/*
        누구와 쓰는 앱인지 여기서 한 번 못 박는다.
        이 앱은 세로 화면이 기본이라 좁은 폭에서 숨기면 정작 볼 사람이 못 본다.
      */}
      <span className="shrink-0 text-[11px] font-medium text-emerald-600/80">
        친구 · 가족 누구나
      </span>
    </button>
  );
}
