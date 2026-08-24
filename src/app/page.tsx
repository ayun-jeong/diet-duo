"use client";

import {
  BarChart2,
  LogIn,
  LogOut,
  Settings2,
  Star,
  StickyNote,
  User,
  Utensils,
} from "lucide-react";
import { useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import DailySummary from "@/components/DailySummary";
import DateNav from "@/components/DateNav";
import ExerciseCard from "@/components/ExerciseCard";
import MealCard from "@/components/MealCard";
import ProfileForm from "@/components/ProfileForm";
import SidePanel, { type SidePanelTab } from "@/components/SidePanel";
import StickyMemos from "@/components/StickyMemos";
import WaterTracker from "@/components/WaterTracker";
import { useAuth } from "@/lib/auth-store";
import { useDiet } from "@/lib/store";

/**
 * 첫 진입 로그인 안내를 이미 띄웠는지 (기기별).
 * 한 번 닫은 사람에게 들어올 때마다 다시 들이밀지 않기 위한 표시다.
 */
const AUTH_PROMPTED_KEY = "diet:auth-prompted";

function alreadyPrompted(): boolean {
  try {
    return window.localStorage.getItem(AUTH_PROMPTED_KEY) === "1";
  } catch {
    // 저장소를 못 쓰면 안내를 건너뛴다 (매번 뜨는 것보다 낫다).
    return true;
  }
}

function markPrompted(): void {
  try {
    window.localStorage.setItem(AUTH_PROMPTED_KEY, "1");
  } catch {
    /* 무시 */
  }
}

export default function Home() {
  const ready = useDiet((s) => s.ready);
  const profile = useDiet((s) => s.profile);

  const user = useAuth((s) => s.user);
  const authLoading = useAuth((s) => s.loading);
  const signOut = useAuth((s) => s.signOut);
  const setAuthModalOpen = useAuth((s) => s.setAuthModalOpen);

  const addMemo = useDiet((s) => s.addMemo);

  const [editing, setEditing] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>("stats");

  /**
   * 첫 화면(키·몸무게를 넣는 내 정보 화면)에서 로그인 창을 먼저 띄운다.
   *
   * 이전에는 로그인 버튼이 프로필 저장 후의 홈 헤더에만 있어서,
   * 처음 들어온 사람은 로그인할 방법 자체를 보지 못했다.
   * 세션 확인이 끝난 뒤 판단해야 이미 로그인한 사람에게 잘못 뜨지 않는다.
   */
  useEffect(() => {
    if (!ready || authLoading) return;
    if (user || profile) return;
    if (alreadyPrompted()) return;
    markPrompted();
    setAuthModalOpen(true);
  }, [ready, authLoading, user, profile, setAuthModalOpen]);

  // 초기화는 Providers 의 Hydrate/AuthSync 가 담당한다.
  // 여기서 별도로 init 을 부르면 로그인 시 두 번 로드된다.

  // authLoading 은 더 이상 기다리지 않는다.
  // 세션 확인은 배경에서 끝나고, 화면은 캐시/로컬 데이터로 먼저 그려진다.
  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-400">
        불러오는 중…
      </main>
    );
  }

  if (!profile || editing) {
    return (
      <>
        <AuthModal />
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4">
          <div className="flex w-full max-w-md items-center justify-between">
            <div className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-emerald-600" />
              <h1 className="text-lg font-extrabold tracking-tight">식단 기록</h1>
            </div>
            {user ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <User className="h-3 w-3" />
                {user.name ?? "카카오 유저"}
              </span>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <LogIn className="h-3.5 w-3.5" />
                로그인
              </button>
            )}
          </div>
          <ProfileForm onDone={() => setEditing(false)} />
        </main>
      </>
    );
  }

  return (
    <>
      <AuthModal />
      {/* 레이아웃과 무관하게 떠 있는 포스트잇 — 원하는 위치로 끌어다 놓을 수 있다 */}
      <StickyMemos />
      <SidePanel
        open={sidePanelOpen}
        tab={sidePanelTab}
        onTabChange={setSidePanelTab}
        onClose={() => setSidePanelOpen(false)}
      />

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-4 sm:px-6 sm:pt-6">

        {/* 헤더 */}
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-emerald-600" />
            <h1 className="text-lg font-extrabold tracking-tight">식단 기록</h1>
          </div>
          <div className="flex items-center gap-1.5">
            {/* 통계 버튼 */}
            <button
              onClick={() => { setSidePanelTab("stats"); setSidePanelOpen(true); }}
              className="flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-500 hover:bg-gray-50"
              title="통계 · 캘린더"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              통계
            </button>

            {/* 즐겨찾기 버튼 */}
            <button
              onClick={() => { setSidePanelTab("favorites"); setSidePanelOpen(true); }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              title="즐겨찾기"
            >
              <Star className="h-4 w-4" />
            </button>

            {/* 메모 추가 */}
            <button
              onClick={() => addMemo()}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              title="메모 추가"
            >
              <StickyNote className="h-4 w-4" />
            </button>

            <button
              onClick={() => setEditing(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              title="내 정보"
            >
              <Settings2 className="h-4 w-4" />
            </button>

            {user ? (
              <div className="flex items-center gap-1.5">
                <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 sm:flex">
                  <User className="h-3 w-3" />
                  {user.name ?? "카카오 유저"}
                </span>
                <button
                  onClick={() => signOut()}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  title="로그아웃"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <LogIn className="h-3.5 w-3.5" />
                로그인
              </button>
            )}
          </div>
        </header>

        {/* 날짜 이동 */}
        <DateNav />

        {/* ── 주요 영역 ── */}
        <div className="mt-4 space-y-3">

          {/* 칼로리 + 영양소 요약 */}
          <DailySummary />

          {/* 아침·점심·저녁 3열 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MealCard meal="breakfast" />
            <MealCard meal="lunch" />
            <MealCard meal="dinner" />
          </div>

          {/* 간식·음료 + 물 섭취 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MealCard meal="snack" />
            <div className="flex sm:col-span-2">
              <WaterTracker />
            </div>
          </div>

          {/* 운동 기록 */}
          <ExerciseCard />

        </div>

      </main>
    </>
  );
}
