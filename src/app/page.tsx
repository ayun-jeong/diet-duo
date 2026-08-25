"use client";

import { LogIn, StickyNote, User, UserRound, Utensils } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AuthModal from "@/components/AuthModal";
import DailySummary from "@/components/DailySummary";
import DateNav from "@/components/DateNav";
import ExerciseCard from "@/components/ExerciseCard";
import InviteBanner from "@/components/InviteBanner";
import MealCard from "@/components/MealCard";
import ProfileForm from "@/components/ProfileForm";
import SidePanel, { type SidePanelTab } from "@/components/SidePanel";
import StickyMemos from "@/components/StickyMemos";
import CompareSummary from "@/components/CompareSummary";
import PartnerMealCard from "@/components/PartnerMealCard";
import ViewToggle, { type HomeView } from "@/components/ViewToggle";
import MoreMenu from "@/components/MoreMenu";
import { useMediaQuery, WIDE_QUERY } from "@/lib/use-media-query";
import WaterTracker from "@/components/WaterTracker";
import { useAuth } from "@/lib/auth-store";
import { useDiet, usePartnerName } from "@/lib/store";
import { MEAL_LABELS, MEAL_TYPES, isCounted } from "@/lib/types";

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

/** 마지막에 고른 보기 (나 / 파트너 / 함께) */
const VIEW_KEY = "diet:home-view";

function readView(): HomeView | null {
  try {
    const v = window.localStorage.getItem(VIEW_KEY);
    return v === "me" || v === "partner" || v === "both" ? v : null;
  } catch {
    return null;
  }
}

function writeView(view: HomeView): void {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    /* 무시 */
  }
}

export default function Home() {
  const ready = useDiet((s) => s.ready);
  const profile = useDiet((s) => s.profile);

  const user = useAuth((s) => s.user);
  const authLoading = useAuth((s) => s.loading);
  const setAuthModalOpen = useAuth((s) => s.setAuthModalOpen);

  const addMemo = useDiet((s) => s.addMemo);
  const partner = useDiet((s) => s.partner);
  const partnerName = usePartnerName();
  const date = useDiet((s) => s.date);
  const isWide = useMediaQuery(WIDE_QUERY);

  const [view, setView] = useState<HomeView>("me");

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

  /**
   * 처음 열 때의 보기.
   *
   * 저장된 선택이 있으면 그걸 쓰고, 없으면 화면 폭으로 정한다 —
   * 넓으면 두 열이 다 들어가니 '함께', 좁으면 익숙한 '나'.
   * 메이트가 연결돼 있어야 의미가 있으므로 연결이 확인된 뒤에 한 번만 정한다.
   */
  const viewInit = useRef(false);
  useEffect(() => {
    if (viewInit.current || !partner.linked) return;
    viewInit.current = true;
    setView(readView() ?? (isWide ? "both" : "me"));
  }, [partner.linked, isWide]);

  // 연결이 끊기면 볼 것이 없으므로 내 화면으로 되돌린다.
  useEffect(() => {
    if (!partner.linked) setView("me");
  }, [partner.linked]);

  const changeView = (next: HomeView) => {
    setView(next);
    writeView(next);
  };

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
        onClose={() => setSidePanelOpen(false)}
      />

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-4 sm:px-6 sm:pt-6">

        {/*
          헤더 = 날짜.
          "식단 기록" 제목 줄과 통계·즐겨찾기·내정보·로그아웃 버튼을 걷어내고
          그 자리를 날짜에 내줬다. 가끔 쓰는 것들은 ⋯ 뒤로 접었다.
        */}
        <header className="mb-3 flex items-center justify-between gap-2">
          <DateNav />

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => addMemo()}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              title="메모 추가"
            >
              <StickyNote className="h-4 w-4" />
            </button>

            {/* 로그인은 아직 안 한 사람에게 가장 중요한 버튼이라 접지 않는다 */}
            {!user && (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <LogIn className="h-3.5 w-3.5" />
                로그인
              </button>
            )}

            <MoreMenu
              onOpenStats={() => {
                setSidePanelTab("stats");
                setSidePanelOpen(true);
              }}
              onOpenFavorites={() => {
                setSidePanelTab("favorites");
                setSidePanelOpen(true);
              }}
              onOpenProfile={() => setEditing(true)}
              onOpenDuo={() => setEditing(true)}
            />
          </div>
        </header>

        {/*
          보기 전환 — 셋이 가로를 똑같이 나눠 갖는다 (이름이 길어도 안 찌그러짐).
          연결이 없으면 고를 것도 없으므로 같은 자리를 초대 배너에 내준다.
        */}
        {/*
          상대가 공개 범위를 좁혀 둔 날. 이 안내가 없으면 "아무것도 안 먹었다"로
          읽혀서, 걱정하거나 캐묻게 만든다.
        */}
        {view !== "me" && partner.outOfScope && partner.date === date && (
          <p className="mb-2 rounded-xl bg-gray-100 px-3 py-2 text-center text-xs text-gray-500">
            {partnerName}님이 이 날짜는 공개하지 않았어요
          </p>
        )}

        <div className="mb-3">
          {partner.linked ? (
            <ViewToggle view={view} onChange={changeView} />
          ) : (
            <InviteBanner
              onClick={() => (user ? setEditing(true) : setAuthModalOpen(true))}
            />
          )}
        </div>

        {/* ── 주요 영역 ── */}
        <div className="space-y-3">
          {view === "me" && <MyDay />}
          {view === "partner" && <PartnerDay />}
          {view === "both" && (isWide ? <BothWide /> : <BothNarrow />)}
        </div>

      </main>
    </>
  );
}

/* ── 보기별 본문 ─────────────────────────────────────────────── */

/** 나만 — 기존 화면 그대로 */
function MyDay() {
  return (
    <>
      <DailySummary />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MealCard meal="breakfast" />
        <MealCard meal="lunch" />
        <MealCard meal="dinner" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MealCard meal="snack" />
        <div className="flex sm:col-span-2">
          <WaterTracker />
        </div>
      </div>

      <ExerciseCard />
    </>
  );
}

/**
 * 파트너만 — 내 화면과 같은 구조, 같은 컴포넌트.
 *
 * 요약·물·운동은 내 것과 같은 컴포넌트에 남의 기록을 넘겨 그린다.
 * 화면이 갈라지면 같은 정보를 두 번 배워야 하고, 한쪽만 고쳐져 어긋난다.
 * 빠지는 것은 입력·수정·삭제뿐이다.
 */
function PartnerDay() {
  const partner = useDiet((s) => s.partner);
  const log = partner.log;

  if (!log) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm ring-1 ring-black/5">
        {partner.failed ? "불러오지 못했어요" : "불러오는 중…"}
      </div>
    );
  }

  return (
    <>
      <DailySummary
        log={log}
        targets={partner.targets}
        waterGoalMl={partner.waterGoalMl}
        celebrate={false}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PartnerMealCard meal="breakfast" />
        <PartnerMealCard meal="lunch" />
        <PartnerMealCard meal="dinner" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PartnerMealCard meal="snack" />
        <div className="flex sm:col-span-2">
          <WaterTracker readOnlyMl={log.waterMl} readOnlyGoalMl={partner.waterGoalMl} />
        </div>
      </div>

      <ExerciseCard readOnlyLog={log} />
    </>
  );
}

/**
 * 함께 — 넓은 화면.
 *
 * 사람이 아니라 끼니로 줄을 맞춘다. 사람별로 쭉 쌓으면 먹은 개수가 달라
 * 높이가 어긋나고, 내 점심 옆에 상대의 아침이 오게 된다.
 */
function BothWide() {
  const partnerName = usePartnerName();
  const partnerLog = useDiet((s) => s.partner.log);
  const partnerWaterGoal = useDiet((s) => s.partner.waterGoalMl);

  return (
    <>
      <CompareSummary />

      {/* 열 제목 — 스크롤해도 어느 쪽이 누구인지 잃지 않게 붙여 둔다 */}
      <div className="sticky top-0 z-20 grid grid-cols-2 gap-3 bg-[var(--background)] py-1.5">
        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
          <User className="h-3.5 w-3.5" /> 나
        </span>
        <span className="flex items-center gap-1.5 truncate text-xs font-bold text-indigo-700">
          <UserRound className="h-3.5 w-3.5" /> {partnerName}
        </span>
      </div>

      {MEAL_TYPES.map((meal) => (
        <div key={meal} className="grid grid-cols-2 items-start gap-3">
          <MealCard meal={meal} />
          <PartnerMealCard meal={meal} />
        </div>
      ))}

      <div className="grid grid-cols-2 items-start gap-3">
        <WaterTracker />
        <WaterTracker
          readOnlyMl={partnerLog?.waterMl ?? 0}
          readOnlyGoalMl={partnerWaterGoal}
        />
      </div>

      <div className="grid grid-cols-2 items-start gap-3">
        <ExerciseCard />
        {partnerLog ? <ExerciseCard readOnlyLog={partnerLog} /> : <div />}
      </div>
    </>
  );
}

/**
 * 함께 — 좁은 화면.
 *
 * 375px 에서 두 열이면 한 칸이 약 165px 이다. 여기에 입력 칸까지 넣으면
 * 음식 이름이 서너 글자에서 잘리므로 대조 전용으로 두고, 적는 것은 '나' 로 보낸다.
 */
function BothNarrow() {
  const log = useDiet((s) => s.log);
  const partner = useDiet((s) => s.partner);

  return (
    <>
      <CompareSummary />

      {MEAL_TYPES.map((meal) => {
        const mine = log.meals[meal] ?? [];
        const theirs = partner.log?.meals[meal] ?? [];
        const myKcal = mine.filter(isCounted).reduce((sum, f) => sum + f.kcal, 0);
        const theirKcal = theirs.filter(isCounted).reduce((sum, f) => sum + f.kcal, 0);

        return (
          <div key={meal}>
            <div className="mb-1 flex items-baseline gap-2 px-0.5">
              <span className="text-xs font-bold text-gray-600">
                {MEAL_LABELS[meal]}
              </span>
              <span className="ml-auto text-[11px] tabular-nums text-gray-400">
                <b className="text-emerald-600">{myKcal}</b>
                {" · "}
                <b className="text-indigo-600">{theirKcal}</b>
              </span>
            </div>

            <div className="grid grid-cols-2 items-start gap-2">
              <div className="rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-black/5">
                {mine.length === 0 ? (
                  <p className="py-2 text-center text-[11px] text-gray-300">비어 있음</p>
                ) : (
                  <ul className="space-y-1.5">
                    {mine.map((f) => (
                      <li key={f.id}>
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className={`min-w-0 flex-1 truncate text-[12px] font-medium ${
                              f.pending ? "text-gray-400" : ""
                            }`}
                          >
                            {f.name}
                          </span>
                          <span className="shrink-0 text-[12px] font-semibold text-gray-700">
                            {f.kcal}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400">
                          탄 {f.carbs} · 단 {f.protein} · 지 {f.fat}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <PartnerMealCard meal={meal} compact />
            </div>
          </div>
        );
      })}

      <p className="pt-1 text-center text-xs text-gray-400">
        먹은 걸 적으려면 위에서 <b className="text-emerald-600">나</b> 를 누르세요
      </p>
    </>
  );
}
