"use client";

import {
  BarChart2,
  LogIn,
  LogOut,
  MoreHorizontal,
  Settings2,
  Star,
  User,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-store";

interface Props {
  onOpenStats: () => void;
  onOpenFavorites: () => void;
  onOpenProfile: () => void;
  /** 메이트 연결 — 실제 설정은 내 정보 화면 안에 있다 */
  onOpenDuo: () => void;
}

/**
 * 가끔 쓰는 것들을 한 버튼 뒤로 접는다.
 *
 * 통계·즐겨찾기·내 정보·로그아웃은 하루에 한 번도 안 누르는 날이 대부분인데
 * 매일 보는 화면 맨 위를 하나씩 차지하고 있었다.
 *
 * 누른 버튼 바로 아래에 편다. 화면 아래에서 올라오는 시트로 두면
 * 손가락이 누른 곳과 결과가 나타나는 곳이 화면 양 끝으로 갈린다.
 */
export default function MoreMenu({
  onOpenStats,
  onOpenFavorites,
  onOpenProfile,
  onOpenDuo,
}: Props) {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const setAuthModalOpen = useAuth((s) => s.setAuthModalOpen);

  const [open, setOpen] = useState(false);

  // 메뉴가 열린 채로 뒤가 스크롤되면 손가락이 어디를 만지는지 알 수 없다.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="더 보기"
        className={`flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 ${
          open ? "bg-gray-100" : "bg-white"
        }`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <>
          {/* 바깥을 눌러 닫기 — 드롭다운이므로 화면을 어둡게 덮지 않는다 */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div
            role="menu"
            className="absolute right-0 top-10 z-50 w-56 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-black/10"
          >
            {user && (
              <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700">
                <User className="h-3.5 w-3.5" />
                {user.name ?? "카카오 유저"}
              </div>
            )}

            <MenuItem icon={<BarChart2 className="h-4 w-4" />} onClick={run(onOpenStats)}>
              통계 · 캘린더
            </MenuItem>
            <MenuItem icon={<Star className="h-4 w-4" />} onClick={run(onOpenFavorites)}>
              즐겨찾기
            </MenuItem>
            <MenuItem icon={<UserPlus className="h-4 w-4" />} onClick={run(onOpenDuo)}>
              함께하기
            </MenuItem>
            <MenuItem icon={<Settings2 className="h-4 w-4" />} onClick={run(onOpenProfile)}>
              내 정보
            </MenuItem>

            <div className="my-1 border-t border-gray-100" />

            {user ? (
              <MenuItem icon={<LogOut className="h-4 w-4" />} onClick={run(() => void signOut())}>
                로그아웃
              </MenuItem>
            ) : (
              <MenuItem
                icon={<LogIn className="h-4 w-4" />}
                onClick={run(() => setAuthModalOpen(true))}
              >
                로그인
              </MenuItem>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      <span className="text-gray-400">{icon}</span>
      {children}
    </button>
  );
}
