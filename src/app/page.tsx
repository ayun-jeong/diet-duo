"use client";

import {
  BarChart2,
  LogIn,
  LogOut,
  Settings2,
  Star,
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
import WaterTracker from "@/components/WaterTracker";
import { useAuth } from "@/lib/auth-store";
import { supabase } from "@/lib/supabase";
import { useDiet } from "@/lib/store";

export default function Home() {
  const ready = useDiet((s) => s.ready);
  const profile = useDiet((s) => s.profile);
  const init = useDiet((s) => s.init);

  const user = useAuth((s) => s.user);
  const authLoading = useAuth((s) => s.loading);
  const signOut = useAuth((s) => s.signOut);
  const setAuthModalOpen = useAuth((s) => s.setAuthModalOpen);

  const [editing, setEditing] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>("stats");

  useEffect(() => {
    init();
  }, [init]);

  if (!ready || authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-400">
        불러오는 중…
      </main>
    );
  }

  if (!profile || editing) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <ProfileForm onDone={() => setEditing(false)} />
      </main>
    );
  }

  return (
    <>
      <AuthModal />
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

            <button
              onClick={() => setEditing(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              title="내 정보"
            >
              <Settings2 className="h-4 w-4" />
            </button>

            {supabase && (
              user ? (
                <div className="flex items-center gap-1.5">
                  <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 sm:flex">
                    <User className="h-3 w-3" />
                    {user.email?.split("@")[0]}
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
              )
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
