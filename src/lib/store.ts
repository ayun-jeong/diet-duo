import { create } from "zustand";
import { toast } from "sonner";
import { storage, setStorage, LocalStorageAdapter, DbUnavailableError } from "./storage";
import { readLastUserId, readMirror, writeLastUserId, writeMirror } from "./mirror";
import { apiUrl } from "./api";
import type { MacroTargets } from "./nutrition";
import {
  MEMO_MAX_COUNT,
  MEMO_TEXT_MAX,
  newMemoId,
  nextMemoColor,
  parseMemos,
  serializeMemos,
  type Memo,
} from "./memo";
import {
  DEFAULT_SETTINGS,
  MEAL_LABELS,
  MEAL_TYPES,
  emptyDayLog,
  normalizeDayLog,
  sumMealKcal,
  type AppSettings,
  type DayLog,
  type DaySummary,
  type ExerciseItem,
  type FavoriteFood,
  type FoodItem,
  type MealType,
  type UserProfile,
} from "./types";

/**
 * 파트너의 하루.
 *
 * linked 가 false 면 메이트 연결이 없다는 뜻이고, 화면은 파트너 관련 요소를
 * 전부 감춘다. loading 은 파트너 조회만 가리키며 내 화면을 막지 않는다.
 */
export interface PartnerState {
  linked: boolean;
  /** 파트너 사용자 id — 받은 항목이 지금 파트너가 보낸 것인지 가릴 때 쓴다 */
  id: string | null;
  /** 카카오 본명 (별명이 없을 때 쓰는 기본값) */
  name: string;
  log: DayLog | null;
  /** 파트너의 목표 (프로필 미설정이면 null) */
  targets: MacroTargets | null;
  /** 파트너의 물 목표 (미설정이면 null) */
  waterGoalMl: number | null;
  loading: boolean;
  failed: boolean;
  /** log 가 어느 날짜의 것인지 — 날짜를 옮겼을 때 옛 기록을 그리지 않기 위해 */
  date: string | null;
}

/**
 * 직전에 연결돼 있었는지 (사용자별).
 *
 * 상대가 연결을 끊으면 이쪽은 204 를 받고 조용히 리셋된다. 서로 오프라인으로
 * 아는 사이면 넘어갈 수 있지만, 그렇지 않으면 어제까지 있던 탭이 말없이 사라진
 * 것이 고장으로 보인다. 앱을 다시 연 뒤에도 한 번은 알리기 위해 기기에 남긴다.
 *
 * 한 브라우저를 두 계정이 쓸 수 있으므로 사용자별로 키를 나눈다.
 */
const linkedKey = (userId: string) => `diet:last-duo:${userId}`;

function wasLinked(userId: string | null | undefined): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(linkedKey(userId)) === "1";
  } catch {
    return false;
  }
}

function rememberLinked(userId: string | null | undefined, linked: boolean): void {
  if (!userId || typeof window === "undefined") return;
  try {
    if (linked) window.localStorage.setItem(linkedKey(userId), "1");
    else window.localStorage.removeItem(linkedKey(userId));
  } catch {
    /* 무시 */
  }
}

const EMPTY_PARTNER: PartnerState = {
  linked: false,
  id: null,
  name: "메이트",
  log: null,
  targets: null,
  waterGoalMl: null,
  loading: false,
  failed: false,
  date: null,
};

/** 로컬 기준 오늘 날짜 (YYYY-MM-DD) */
export function todayStr(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function shiftDate(base: string, delta: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

interface DietState {
  ready: boolean;
  /** 서버 동기화가 진행 중인지 (화면은 이미 그려진 상태) */
  syncing: boolean;
  userId: string | null;

  profile: UserProfile | null;
  settings: AppSettings;
  favorites: FavoriteFood[];
  /** 날짜와 무관하게 유지되는 메모 (포스트잇) — 여러 장을 붙일 수 있다 */
  memos: Memo[];
  /** 메이트의 같은 날짜 기록 */
  partner: PartnerState;
  date: string;
  log: DayLog;

  /** date -> 일별 요약. 캘린더·주간 차트·체중 추이가 공유하는 단일 캐시 */
  summaries: Record<string, DaySummary>;
  /** 이미 서버에서 받아온 구간 (중복 요청 방지) */
  loadedRanges: string[];
  /**
   * 저장소 세대. 로그인·로그아웃으로 어댑터가 바뀌면 증가한다.
   * 차트 컴포넌트가 이 값을 effect 의존성에 넣어, 캐시가 비워졌을 때
   * 스스로 다시 조회하도록 만든다.
   */
  storageGen: number;

  hydrate: () => void;
  init: (userId?: string | null, date?: string) => Promise<void>;
  reset: () => Promise<void>;
  loadSummaries: (from: string, to: string) => Promise<void>;

  setProfile: (p: UserProfile) => Promise<void>;
  setSettings: (s: Partial<AppSettings>) => void;
  setDate: (date: string) => Promise<void>;
  addFood: (meal: MealType, food: Omit<FoodItem, "id">) => void;
  updateFood: (meal: MealType, id: string, updates: Partial<Omit<FoodItem, "id">>) => void;
  removeFood: (meal: MealType, id: string) => void;
  addWater: (ml: number) => void;
  setWater: (ml: number) => void;
  addFavorite: (food: Omit<FavoriteFood, "id">) => void;
  removeFavorite: (id: string) => void;
  loadPartner: (date?: string) => Promise<void>;
  /** 내가 직접 연결을 끊었을 때 — 화면과 기억을 함께 비운다 */
  clearPartner: () => void;
  shareFood: (meal: MealType, id: string) => Promise<void>;
  unshareFood: (meal: MealType, id: string) => Promise<void>;
  addMemo: () => void;
  updateMemo: (id: string, patch: Partial<Omit<Memo, "id">>) => void;
  removeMemo: (id: string) => void;
  setSteps: (steps: number) => void;
  addExercise: (exercise: Omit<ExerciseItem, "id">) => void;
  removeExercise: (id: string) => void;
  setDailyWeight: (date: string, weightKg: number) => void;
}

/** init 세대 카운터 — 늦게 도착한 오래된 로드가 최신 상태를 덮지 않게 한다. */
let initSeq = 0;

export const useDiet = create<DietState>((set, get) => {
  /** 요약 캐시에 하루치를 반영 (캘린더·차트가 즉시 따라오도록) */
  function touchSummary(log: DayLog) {
    // 체중도 DayLog 에 실려 오므로 log 값을 그대로 쓴다.
    // 이전 요약값을 fallback 으로 두면 저장 실패 롤백 시 되돌린 체중이 남는다.
    set((s) => ({
      summaries: {
        ...s.summaries,
        [log.date]: {
          date: log.date,
          kcal: sumMealKcal(log),
          weightKg: log.weightKg,
          waterMl: log.waterMl,
        },
      },
    }));
  }

  /**
   * 낙관적 저장.
   *
   * 이전 구현은 `await storage.saveDayLog()` 후에야 화면을 갱신해서,
   * 음식 하나 추가할 때마다 네트워크 왕복만큼 UI 가 멈춰 있었다.
   * 여기서는 먼저 그리고 뒤에서 저장하며, 실패하면 되돌린 뒤 알린다.
   */
  function commitLog(next: DayLog) {
    const prev = get().log;
    set({ log: next });
    touchSummary(next);

    void storage.saveDayLog(next).catch((e) => {
      // 그 사이 사용자가 또 수정했다면 되돌리지 않는다 (최신 입력이 우선).
      if (get().log !== next) return;
      set({ log: prev });
      touchSummary(prev);
      toast.error(`저장 실패: ${errText(e)}`);
    });
  }

  /**
   * "연동됨" 표시를 실제와 맞춘다.
   *
   * 파트너가 자기 쪽에서 사본을 지우면 내 항목만 연동됨으로 남는다.
   * 그대로 두면 되돌리기 버튼이 아무 일도 하지 않는 것처럼 보이므로,
   * 파트너 기록을 새로 받을 때마다 사라진 사본의 표시를 걷어낸다.
   * 내 항목 자체는 건드리지 않는다 — 상대가 지웠다고 내 기록이 지워지면 안 된다.
   */
  function reconcileShared(partnerLog: DayLog) {
    const { log } = get();
    const alive = new Set<string>();
    for (const meal of MEAL_TYPES) {
      for (const f of partnerLog.meals[meal] ?? []) alive.add(f.id);
    }

    let changed = false;
    const meals = {} as DayLog["meals"];
    for (const meal of MEAL_TYPES) {
      meals[meal] = (log.meals[meal] ?? []).map((f) => {
        if (f.sharedItemId && !alive.has(f.sharedItemId)) {
          changed = true;
          const { sharedItemId: _drop, ...rest } = f;
          return rest;
        }
        return f;
      });
    }

    if (changed) commitLog({ ...log, meals });
  }

  /** 메모 목록 저장 — 한 칸에 직렬화해 넣으므로 항상 전체를 함께 쓴다. */
  function commitMemos(next: Memo[]) {
    const prev = get().memos;
    set({ memos: next });

    void storage.saveMemo(serializeMemos(next)).catch((e) => {
      if (get().memos !== next) return;
      set({ memos: prev });
      toast.error(`메모 저장 실패: ${errText(e)}`);
    });
  }

  function commitFavorites(next: FavoriteFood[]) {
    const prev = get().favorites;
    set({ favorites: next });

    void storage.saveFavorites(next).catch((e) => {
      if (get().favorites !== next) return;
      set({ favorites: prev });
      toast.error(`즐겨찾기 저장 실패: ${errText(e)}`);
    });
  }

  return {
    ready: false,
    syncing: false,
    userId: null,
    profile: null,
    settings: DEFAULT_SETTINGS,
    favorites: [],
    memos: [],
    partner: EMPTY_PARTNER,
    date: todayStr(),
    log: emptyDayLog(todayStr()),
    summaries: {},
    loadedRanges: [],
    storageGen: 0,

    /**
     * 마운트 직후 동기 하이드레이션.
     *
     * NextAuth 는 세션을 알아내려고 /api/auth/session 을 왕복한다. 모바일에서는
     * 이 한 번이 체감 렉의 대부분이었다. 그 응답을 기다리지 않고, 마지막 로그인
     * 사용자의 캐시를 찾아 즉시 그린다. 세션이 확정되면 init 이 조용히 교체한다.
     */
    hydrate: () => {
      if (get().ready) return;

      const lastUser = readLastUserId();
      const cached = lastUser ? readMirror(lastUser) : null;

      if (!cached) {
        // 캐시가 없으면 (비로그인이거나 이 기기 첫 로그인) 기본 저장소로 바로 채운다.
        // LocalStorageAdapter 는 동기라 네트워크 대기가 없다.
        void get().init(null);
        return;
      }

      const date = todayStr();
      set({
        ready: true,
        userId: lastUser,
        profile: cached.profile,
        settings: cached.settings ?? DEFAULT_SETTINGS,
        favorites: cached.favorites ?? [],
        memos: parseMemos(cached.memo),
        date,
        // 캐시된 기록이 오늘 것일 때만 쓴다 (어제 기록을 오늘로 보여주지 않도록).
        log: cached.dayLog?.date === date
          ? normalizeDayLog(date, cached.dayLog)
          : emptyDayLog(date),
      });
    },

    /**
     * 초기 로드.
     *
     * 로그인 상태면 캐시(mirror)로 먼저 그린 뒤 서버 응답으로 교체한다.
     * 화면이 네트워크를 기다리며 "불러오는 중…"에 묶이지 않게 하는 것이 핵심.
     */
    init: async (userId = null, date) => {
      const targetDate = date ?? get().date ?? todayStr();
      // 하이드레이션 init 과 세션 확정 후 init 이 겹칠 수 있다.
      // 늦게 끝난 오래된 요청이 최신 상태를 덮어쓰지 않도록 세대를 센다.
      const seq = ++initSeq;

      // 1) 캐시가 있으면 즉시 그린다.
      if (userId) {
        const cached = readMirror(userId);
        if (cached) {
          set({
            ready: true,
            userId,
            profile: cached.profile,
            settings: cached.settings ?? DEFAULT_SETTINGS,
            favorites: cached.favorites ?? [],
            memos: parseMemos(cached.memo),
            date: targetDate,
            // 캐시된 기록이 대상 날짜의 것일 때만 쓴다.
            // (어제 캐시를 오늘 기록으로 보여주면 없는 음식이 표시된다.)
            log:
              cached.dayLog?.date === targetDate
                ? normalizeDayLog(targetDate, cached.dayLog)
                : emptyDayLog(targetDate),
          });
        }
      }

      set({ syncing: true, userId });

      // 2) 실제 저장소에서 읽어 교체한다.
      try {
        const data = await storage.bootstrap(targetDate);
        if (seq !== initSeq) return; // 더 최신 init 이 시작됨
        set({
          ready: true,
          profile: data.profile,
          settings: data.settings ?? DEFAULT_SETTINGS,
          favorites: data.favorites ?? [],
          memos: parseMemos(data.memo),
          date: targetDate,
          log: normalizeDayLog(targetDate, data.dayLog),
          // 저장소가 바뀌었으므로 이전 요약 캐시는 버리고,
          // 세대를 올려 차트들이 새 저장소로 다시 조회하게 한다.
          summaries: {},
          loadedRanges: [],
          storageGen: get().storageGen + 1,
        });
        if (userId) {
          writeMirror(userId, data);
          writeLastUserId(userId);
          void get().loadPartner(targetDate);
        } else {
          set({ partner: EMPTY_PARTNER });
        }
      } catch (e) {
        if (seq !== initSeq) return;

        // 서버에 DB 가 없으면 로컬 전용으로 계속 동작한다.
        if (e instanceof DbUnavailableError) {
          console.warn("[store] 서버 DB 미설정 — localStorage 전용으로 전환합니다.");
          setStorage(new LocalStorageAdapter());
          set({ syncing: false });
          await get().init(null, targetDate);
          return;
        }

        // 캐시로 이미 그려둔 상태면 조용히 넘어간다.
        if (!get().ready) {
          set({ ready: true });
          toast.error(`불러오기 실패: ${errText(e)}`);
        } else {
          console.error("[store] bootstrap 실패:", e);
        }
      } finally {
        if (seq === initSeq) set({ syncing: false });
      }
    },

    /** 로그아웃 시 메모리 상태 초기화 */
    reset: async () => {
      set({
        ready: false,
        userId: null,
        profile: null,
        settings: DEFAULT_SETTINGS,
        favorites: [],
        memos: [],
        partner: EMPTY_PARTNER,
        summaries: {},
        loadedRanges: [],
        storageGen: get().storageGen + 1,
      });
      await get().init(null, todayStr());
    },

    /**
     * 구간 요약 로드.
     * 캘린더(한 달)·주간 차트(7일)·체중 추이(30일)가 각자 왕복하지 않고
     * 이 캐시를 공유한다. 이미 받아온 구간이면 요청하지 않는다.
     */
    loadSummaries: async (from, to) => {
      const rangeKey = `${from}~${to}`;
      if (get().loadedRanges.includes(rangeKey)) return;

      // 요청 중복을 막기 위해 먼저 표시한다.
      set((s) => ({ loadedRanges: [...s.loadedRanges, rangeKey] }));

      try {
        const list = await storage.getDaySummaries(from, to);
        set((s) => {
          const merged = { ...s.summaries };
          for (const item of list) merged[item.date] = item;
          return { summaries: merged };
        });
      } catch (e) {
        // 실패한 구간은 다시 시도할 수 있게 표시를 걷어낸다.
        set((s) => ({ loadedRanges: s.loadedRanges.filter((r) => r !== rangeKey) }));
        console.error("[store] loadSummaries 실패:", e);
      }
    },

    setProfile: async (p) => {
      const prev = get().profile;
      set({ profile: p });
      try {
        await storage.saveProfile(p);
        const { userId, settings, favorites, memos, log } = get();
        if (userId) {
          writeMirror(userId, {
            profile: p,
            settings,
            favorites,
            memo: serializeMemos(memos),
            dayLog: log,
          });
        }
      } catch (e) {
        set({ profile: prev });
        throw e;
      }
    },

    setSettings: (s) => {
      const prev = get().settings;
      const next = { ...prev, ...s };
      set({ settings: next });

      void storage.saveSettings(next).catch((e) => {
        if (get().settings !== next) return;
        set({ settings: prev });
        toast.error(`설정 저장 실패: ${errText(e)}`);
      });
    },

    setDate: async (date) => {
      if (date === get().date) return;
      // 날짜만 먼저 바꿔 이동이 즉시 반영되게 한다.
      set({ date, log: emptyDayLog(date), partner: { ...get().partner, log: null } });
      void get().loadPartner(date);
      try {
        const log = await storage.getDayLog(date);
        // 그 사이 사용자가 또 날짜를 옮겼다면 무시한다.
        if (get().date !== date) return;
        set({ log: normalizeDayLog(date, log) });
      } catch (e) {
        if (get().date === date) toast.error(`기록 불러오기 실패: ${errText(e)}`);
      }
    },

    addFood: (meal, food) => {
      const { log } = get();
      commitLog({
        ...log,
        meals: { ...log.meals, [meal]: [...log.meals[meal], { ...food, id: genId() }] },
      });
    },

    updateFood: (meal, id, updates) => {
      const { log } = get();
      commitLog({
        ...log,
        meals: {
          ...log.meals,
          [meal]: log.meals[meal].map((f) => (f.id === id ? { ...f, ...updates } : f)),
        },
      });
    },

    removeFood: (meal, id) => {
      const { log } = get();
      commitLog({
        ...log,
        meals: { ...log.meals, [meal]: log.meals[meal].filter((f) => f.id !== id) },
      });
    },

    addWater: (ml) => {
      const { log } = get();
      commitLog({ ...log, waterMl: Math.max(0, log.waterMl + ml) });
    },

    setWater: (ml) => {
      const { log } = get();
      commitLog({ ...log, waterMl: Math.max(0, Math.round(ml)) });
    },

    addFavorite: (food) => {
      commitFavorites([...get().favorites, { ...food, id: genId() }]);
    },

    removeFavorite: (id) => {
      commitFavorites(get().favorites.filter((f) => f.id !== id));
    },

    /**
     * 파트너의 같은 날짜 기록을 불러온다.
     *
     * 내 화면을 막지 않는다 — 실패해도 토스트를 띄우지 않고 파트너 칸에만 표시한다.
     * 날짜를 빠르게 넘기면 늦게 도착한 응답이 최신 날짜를 덮을 수 있어,
     * 응답을 받은 뒤 날짜가 그대로인지 확인한다.
     */
    loadPartner: async (date) => {
      const targetDate = date ?? get().date;

      // 비로그인은 파트너 개념 자체가 없다 (로컬 저장소 모드).
      if (!get().userId) {
        set({ partner: EMPTY_PARTNER });
        return;
      }

      set((s) => ({ partner: { ...s.partner, loading: true, failed: false } }));

      try {
        const res = await fetch(apiUrl(`/api/partner/today?date=${targetDate}`), {
          credentials: "include",
        });
        if (get().date !== targetDate) return;

        // 204 = 메이트 미연결
        if (res.status === 204) {
          // 직전까지 연결돼 있었다면 상대가 끊은 것이다. 한 번만 알린다.
          if (wasLinked(get().userId)) {
            rememberLinked(get().userId, false);
            toast.info("연결이 해제되었어요. 새 코드로 다시 연결할 수 있어요.");
          }
          set({ partner: EMPTY_PARTNER });
          return;
        }
        if (!res.ok) throw new Error(`요청 실패 (${res.status})`);

        const json = await res.json();
        if (get().date !== targetDate) return;

        const partnerLog = normalizeDayLog(targetDate, json);
        set({
          partner: {
            linked: true,
            id: json.partnerId ?? null,
            name: json.partnerName ?? "메이트",
            log: partnerLog,
            targets: json.targets ?? null,
            waterGoalMl: json.waterGoalMl ?? null,
            loading: false,
            failed: false,
            date: targetDate,
          },
        });

        rememberLinked(get().userId, true);
        reconcileShared(partnerLog);
      } catch (e) {
        if (get().date !== targetDate) return;
        console.error("[store] loadPartner 실패:", e);
        set((s) => ({ partner: { ...s.partner, loading: false, failed: true } }));
      }
    },

    /*
     * 내가 해제 버튼을 눌렀을 때. 다음 loadPartner 를 기다리지 않고 바로 비운다.
     * 기억까지 지워야 내가 끊은 것을 상대가 끊었다고 알리지 않는다.
     */
    clearPartner: () => {
      rememberLinked(get().userId, false);
      set({ partner: EMPTY_PARTNER });
    },

    /** 내가 먹은 것을 메이트의 같은 끼니에 사본으로 보낸다. */
    shareFood: async (meal, id) => {
      const { log, date, partner } = get();
      const food = log.meals[meal].find((f) => f.id === id);
      if (!food || food.sharedItemId) return;

      if (!partner.linked) {
        toast.error("연결된 메이트가 없어요.");
        return;
      }

      try {
        const res = await fetch(apiUrl("/api/partner/share"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, meal, food }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? `요청 실패 (${res.status})`);

        get().updateFood(meal, id, { sharedItemId: json.itemId });
        const shown = get().settings.partnerNickname?.trim() || partner.name;
        toast.success(`${shown}의 ${MEAL_LABELS[meal]}에 추가했어요.`);
        void get().loadPartner(date);
      } catch (e) {
        toast.error(`연동 실패: ${errText(e)}`);
      }
    },

    /**
     * 잘못 보낸 것을 되돌린다.
     * 상대가 먼저 지웠으면 그대로 성공으로 친다 — 결과가 같기 때문이다.
     */
    unshareFood: async (meal, id) => {
      const { log, date } = get();
      const food = log.meals[meal].find((f) => f.id === id);
      if (!food?.sharedItemId) return;

      const query = `date=${date}&meal=${meal}&itemId=${encodeURIComponent(food.sharedItemId)}`;

      try {
        const res = await fetch(apiUrl(`/api/partner/share?${query}`), {
          method: "DELETE",
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? `요청 실패 (${res.status})`);

        get().updateFood(meal, id, { sharedItemId: undefined });
        toast.success(
          json?.alreadyGone ? "메이트가 이미 지운 항목이에요." : "연동을 되돌렸어요.",
        );
        void get().loadPartner(date);
      } catch (e) {
        toast.error(`되돌리기 실패: ${errText(e)}`);
      }
    },

    /**
     * 메모는 하루 기록이 아니라 사용자 단위로 남는다.
     * 날짜를 옮겨도 그대로 붙어 있고, 직접 지울 때까지 유지된다.
     */
    addMemo: () => {
      const { memos } = get();
      if (memos.length >= MEMO_MAX_COUNT) {
        toast.error(`메모는 최대 ${MEMO_MAX_COUNT}장까지 붙일 수 있어요.`);
        return;
      }
      commitMemos([
        ...memos,
        { id: newMemoId(), text: "", color: nextMemoColor(memos.length) },
      ]);
    },

    updateMemo: (id, patch) => {
      const next = get().memos.map((m) =>
        m.id === id
          ? {
              ...m,
              ...patch,
              ...(patch.text !== undefined
                ? { text: patch.text.slice(0, MEMO_TEXT_MAX) }
                : null),
            }
          : m,
      );
      commitMemos(next);
    },

    removeMemo: (id) => {
      commitMemos(get().memos.filter((m) => m.id !== id));
    },

    setSteps: (steps) => {
      commitLog({ ...get().log, steps: Math.max(0, steps) });
    },

    addExercise: (exercise) => {
      const { log } = get();
      commitLog({ ...log, exercises: [...log.exercises, { ...exercise, id: genId() }] });
    },

    removeExercise: (id) => {
      const { log } = get();
      commitLog({ ...log, exercises: log.exercises.filter((e) => e.id !== id) });
    },

    /**
     * 체중 기록. 체중도 day_logs 에 함께 저장해 기기 간 동기화된다.
     * (이전에는 localStorage 전용이라 다른 기기에서 로그인하면 그래프가 비어 있었다.)
     */
    setDailyWeight: (date, weightKg) => {
      if (date === get().date) {
        commitLog({ ...get().log, weightKg });
        return;
      }

      // 보고 있지 않은 날짜면 해당 기록만 불러와 갱신한다.
      void (async () => {
        try {
          const existing = await storage.getDayLog(date);
          const next = { ...normalizeDayLog(date, existing), weightKg };
          await storage.saveDayLog(next);
          touchSummary(next);
        } catch (e) {
          toast.error(`체중 저장 실패: ${errText(e)}`);
        }
      })();
    },
  };
});

/**
 * 화면에 보여줄 파트너 이름.
 *
 * 내가 붙인 별명이 있으면 그것, 없으면 카카오 본명.
 * 여러 화면이 같은 이름을 써야 하므로 계산을 이 하나로 모은다.
 */
export function usePartnerName(): string {
  return useDiet((s) => s.settings.partnerNickname?.trim() || s.partner.name);
}
