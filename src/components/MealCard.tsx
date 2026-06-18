"use client";

import {
  ChevronDown,
  ChevronUp,
  Coffee,
  Loader2,
  Lock,
  LockOpen,
  Moon,
  Pencil,
  Plus,
  Star,
  Sun,
  Sunrise,
  Trash2,
  Sparkles,
  Check,
  X,
  Wand2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SuggestItem } from "@/app/api/food/suggest/route";
import type { RecommendItem } from "@/app/api/food/recommend/route";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import { useDiet } from "@/lib/store";
import { calcMacroTargets, sumDayTotals } from "@/lib/nutrition";
import { MEAL_LABELS, type FoodItem, type MealType } from "@/lib/types";
import type { FavoriteFood } from "@/lib/types";

const MEAL_ICONS: Record<MealType, React.ReactNode> = {
  breakfast: <Sunrise className="h-4 w-4 text-orange-400" />,
  lunch:     <Sun     className="h-4 w-4 text-yellow-400" />,
  dinner:    <Moon    className="h-4 w-4 text-indigo-400" />,
  snack:     <Coffee  className="h-4 w-4 text-rose-400"   />,
};

interface Props {
  meal: MealType;
}

interface EditState {
  name: string;
  amount: string;
  kcal: string;
  carbs: string;
  protein: string;
  fat: string;
}

function foodToEdit(f: FoodItem): EditState {
  return {
    name: f.name,
    amount: f.amount,
    kcal: String(f.kcal),
    carbs: String(f.carbs),
    protein: String(f.protein),
    fat: String(f.fat),
  };
}

function parseEdit(e: EditState): Partial<Omit<FoodItem, "id">> {
  return {
    name: e.name.trim(),
    amount: e.amount.trim(),
    kcal: Math.round(parseFloat(e.kcal) || 0),
    carbs: parseFloat(e.carbs) || 0,
    protein: parseFloat(e.protein) || 0,
    fat: parseFloat(e.fat) || 0,
  };
}

export default function MealCard({ meal }: Props) {
  const user = useAuth((s) => s.user);
  const items = useDiet((s) => s.log.meals[meal]);
  const favorites = useDiet((s) => s.favorites);
  const addFood = useDiet((s) => s.addFood);
  const updateFood = useDiet((s) => s.updateFood);
  const removeFood = useDiet((s) => s.removeFood);
  const addFavorite = useDiet((s) => s.addFavorite);
  const removeFavorite = useDiet((s) => s.removeFavorite);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditState | null>(null);
  const [showFav, setShowFav] = useState(false);
  const [showRec, setShowRec] = useState(false);
  const [recItems, setRecItems] = useState<RecommendItem[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  const profile = useDiet((s) => s.profile);
  const log = useDiet((s) => s.log);

  const remainingKcal = (() => {
    if (!profile) return 600;
    const target = calcMacroTargets(profile);
    const totals = sumDayTotals(log);
    const stepsBurned = (log.steps ?? 0) > 0
      ? Math.round((log.steps ?? 0) * profile.weightKg * 0.0005)
      : 0;
    const exerciseBurned = log.exercises.reduce((s, e) => s + e.burned, 0);
    const effectiveTarget = target.kcal + stepsBurned + exerciseBurned;
    return Math.max(0, effectiveTarget - totals.kcal);
  })();

  const fetchRecommend = async (refresh = false) => {
    setRecLoading(true);
    if (refresh) setRecItems([]);
    const eatenFoods = (["breakfast", "lunch", "dinner", "snack"] as MealType[])
      .flatMap((m) => log.meals[m].map((f) => f.name));
    try {
      const res = await fetch("/api/food/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealType: meal, remainingKcal, eatenFoods, refresh }),
      });
      const data = await res.json();
      if (Array.isArray(data)) setRecItems(data);
      else toast.error("추천을 불러오지 못했습니다.");
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setRecLoading(false);
    }
  };

  const handleRecommend = async () => {
    if (showRec) { setShowRec(false); return; }
    setShowRec(true);
    if (recItems.length > 0) return;
    fetchRecommend();
  };

  const addFromRecommend = async (item: RecommendItem) => {
    await addFood(meal, {
      name: item.name,
      amount: item.amount,
      kcal: item.kcal,
      carbs: item.carbs,
      protein: item.protein,
      fat: item.fat,
      source: "ai",
    });
    toast.success(`${item.name} 추가 · ${item.kcal}kcal`);
    setShowRec(false);
  };

  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [sugLoading, setSugLoading] = useState(false);
  const sugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 300ms 디바운스 자동완성
  useEffect(() => {
    if (sugTimer.current) clearTimeout(sugTimer.current);
    const q = query.trim();
    if (q.length < 1) { setSuggestions([]); setShowSug(false); return; }
    sugTimer.current = setTimeout(async () => {
      setSugLoading(true);
      try {
        const res = await fetch(`/api/food/suggest?q=${encodeURIComponent(q)}`);
        const data: SuggestItem[] = await res.json();
        setSuggestions(data);
        setShowSug(data.length > 0);
      } catch { setSuggestions([]); }
      finally { setSugLoading(false); }
    }, 300);
    return () => { if (sugTimer.current) clearTimeout(sugTimer.current); };
  }, [query]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSug(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const subtotal = items.reduce((s, f) => s + f.kcal, 0);

  const favByName = (name: string) =>
    favorites.find((f) => f.name.toLowerCase() === name.toLowerCase());

  const startEdit = (food: FoodItem) => {
    setEditId(food.id);
    setEditForm(foodToEdit(food));
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editId || !editForm) return;
    const updates = parseEdit(editForm);
    if (!updates.name) { toast.error("음식 이름을 입력하세요."); return; }
    await updateFood(meal, editId, { ...updates, source: "manual" });
    toast.success("수정했습니다.");
    cancelEdit();
  };

  const togglePrivate = async (food: FoodItem) => {
    await updateFood(meal, food.id, { private: !food.private });
  };

  const toggleFavorite = async (food: FoodItem) => {
    const fav = favByName(food.name);
    if (fav) {
      await removeFavorite(fav.id);
      toast.info(`즐겨찾기에서 제거: ${food.name}`);
    } else {
      await addFavorite({
        name: food.name,
        amount: food.amount,
        kcal: food.kcal,
        carbs: food.carbs,
        protein: food.protein,
        fat: food.fat,
      });
      toast.success(`즐겨찾기 추가: ${food.name}`);
    }
  };

  const addFromFavorite = async (fav: FavoriteFood) => {
    await addFood(meal, {
      name: fav.name,
      amount: fav.amount,
      kcal: fav.kcal,
      carbs: fav.carbs,
      protein: fav.protein,
      fat: fav.fat,
      source: "manual",
    });
    toast.success(`${fav.name} 추가됨 · ${fav.kcal}kcal`);
  };

  const lookup = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const res = await fetch("/api/food/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "조회 실패"); return; }
      await addFood(meal, {
        name: data.name || q,
        amount: data.amount || "",
        kcal: Math.round(data.kcal),
        carbs: data.carbs,
        protein: data.protein,
        fat: data.fat,
        source: data.source ?? "ai",
      });
      setQuery("");
      toast.success(`${data.name} 추가 · ${Math.round(data.kcal)}kcal`);
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-bold">
          {MEAL_ICONS[meal]}
          {MEAL_LABELS[meal]}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRecommend}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
              showRec
                ? "bg-violet-100 text-violet-600"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            }`}
          >
            <Wand2 className="h-3.5 w-3.5" />
            추천
          </button>
          <span className="text-sm font-semibold text-gray-400">
            {subtotal.toLocaleString()} kcal
          </span>
        </div>
      </div>

      {/* AI 메뉴 추천 패널 */}
      {showRec && (
        <div className="mt-2 rounded-xl bg-violet-50 p-2.5 ring-1 ring-violet-100">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-violet-500">
              <Wand2 className="h-3 w-3" />
              남은 {remainingKcal.toLocaleString()}kcal 기준 추천
            </span>
            <button
              onClick={() => fetchRecommend(true)}
              disabled={recLoading}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-violet-400 hover:bg-violet-100 hover:text-violet-600 disabled:opacity-40 transition"
              title="새로고침"
            >
              <RefreshCw className={`h-3 w-3 ${recLoading ? "animate-spin" : ""}`} />
              새로고침
            </button>
          </div>
          {recLoading ? (
            <div className="flex items-center justify-center py-4 gap-2 text-xs text-violet-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI가 메뉴를 추천 중...
            </div>
          ) : (
            <div className="space-y-1.5">
              {recItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-violet-100"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-800">{item.name}</div>
                    <div className="text-[11px] text-gray-400">
                      {item.reason} · {item.amount}
                      <span className="ml-1.5 text-gray-300">
                        탄{item.carbs}g 단{item.protein}g 지{item.fat}g
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-600">
                    {item.kcal}kcal
                  </span>
                  <button
                    onClick={() => addFromRecommend(item)}
                    className="shrink-0 rounded-lg bg-violet-500 p-1.5 text-white hover:bg-violet-600 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 즐겨찾기 패널 */}
      {favorites.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowFav((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-amber-500 hover:text-amber-600"
          >
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            즐겨찾기
            {showFav ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          {showFav && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {favorites.map((fav) => (
                <button
                  key={fav.id}
                  onClick={() => addFromFavorite(fav)}
                  className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
                >
                  <Plus className="h-3 w-3" />
                  {fav.name}
                  <span className="text-amber-400">{fav.kcal}kcal</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 음식 리스트 */}
      <ul className="mt-3 space-y-1.5">
        {items.map((food) =>
          editId === food.id && editForm ? (
            // 인라인 편집 폼
            <li
              key={food.id}
              className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200"
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  placeholder="음식 이름"
                  className={editInput + " col-span-1"}
                />
                <input
                  value={editForm.amount}
                  onChange={(e) =>
                    setEditForm({ ...editForm, amount: e.target.value })
                  }
                  placeholder="양 (1그릇, 100g…)"
                  className={editInput}
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ["kcal", "칼로리"],
                    ["carbs", "탄수화물"],
                    ["protein", "단백질"],
                    ["fat", "지방"],
                  ] as [keyof EditState, string][]
                ).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="mb-0.5 block text-[10px] text-gray-500">
                      {label}
                    </span>
                    <input
                      type="number"
                      value={editForm[key]}
                      onChange={(e) =>
                        setEditForm({ ...editForm, [key]: e.target.value })
                      }
                      className={editInput + " text-center"}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-2 flex justify-end gap-1.5">
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
                >
                  <X className="h-3.5 w-3.5" /> 취소
                </button>
                <button
                  onClick={saveEdit}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Check className="h-3.5 w-3.5" /> 저장
                </button>
              </div>
            </li>
          ) : (
            // 일반 행
            <li
              key={food.id}
              className="group flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="truncate text-sm font-medium">
                    {food.name}
                  </span>
                  {food.amount && (
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {food.amount}
                    </span>
                  )}
                  {food.source === "ai" && (
                    <Sparkles className="h-3 w-3 shrink-0 text-emerald-400" />
                  )}
                </div>
                <div className="text-[11px] text-gray-400">
                  탄 {food.carbs}g · 단 {food.protein}g · 지 {food.fat}g
                </div>
              </div>

              {/* 기본: kcal만 표시 */}
              <span className="shrink-0 text-sm font-semibold text-gray-700 group-hover:hidden">
                {food.kcal}
              </span>

              {/* hover 시: kcal(작게) + 버튼들 */}
              <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                <span className="mr-1 text-xs font-semibold text-gray-500">{food.kcal}</span>
                {/* 편집 */}
                <button
                  onClick={() => startEdit(food)}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                  aria-label="수정"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {/* 즐겨찾기 */}
                <button
                  onClick={() => toggleFavorite(food)}
                  className="rounded-md p-1 hover:bg-amber-50"
                  aria-label="즐겨찾기"
                >
                  <Star
                    className={`h-3.5 w-3.5 ${
                      favByName(food.name)
                        ? "fill-amber-400 text-amber-400"
                        : "text-gray-300 hover:text-amber-400"
                    }`}
                  />
                </button>
                {/* 비공개 (로그인 시) */}
                {user && (
                  <button
                    onClick={() => togglePrivate(food)}
                    className={`rounded-md p-1 transition ${
                      food.private
                        ? "text-rose-400 hover:bg-rose-50"
                        : "text-gray-300 hover:bg-gray-200 hover:text-gray-500"
                    }`}
                    aria-label={food.private ? "공개로 전환" : "비공개로 전환"}
                    title={food.private ? "파트너에게 숨김" : "파트너에게 공개"}
                  >
                    {food.private ? (
                      <Lock className="h-3.5 w-3.5" />
                    ) : (
                      <LockOpen className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
                {/* 삭제 */}
                <button
                  onClick={() => removeFood(meal, food.id)}
                  className="rounded-md p-1 text-gray-300 hover:bg-rose-50 hover:text-rose-500"
                  aria-label="삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ),
        )}
        {items.length === 0 && (
          <li className="rounded-xl border border-dashed border-gray-200 py-3 text-center text-xs text-gray-400">
            먹은 음식을 입력하면 칼로리가 자동 계산됩니다
          </li>
        )}
      </ul>

      {/* 입력 바 + 자동완성 */}
      <div ref={wrapRef} className="relative mt-3">
        {/* 자동완성 드롭다운 (입력창 위에 표시) */}
        {showSug && (
          <div className="absolute bottom-full left-0 right-0 mb-1 z-50 rounded-xl border border-gray-100 bg-white shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={(e) => {
                  // mousedown으로 처리해야 input blur보다 먼저 실행됨
                  e.preventDefault();
                  addFood(meal, {
                    name: s.name,
                    amount: "100g",
                    kcal: s.kcal,
                    carbs: s.carbs,
                    protein: s.protein,
                    fat: s.fat,
                    source: "db",
                  });
                  toast.success(`${s.name} 추가 · ${s.kcal}kcal`);
                  setQuery("");
                  setShowSug(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-emerald-50 transition-colors"
              >
                <span className="truncate font-medium text-gray-800">{s.name}</span>
                <span className="ml-2 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                  {s.kcal} kcal
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !showSug && !loading) lookup();
                if (e.key === "Escape") setShowSug(false);
              }}
              onFocus={() => { if (suggestions.length > 0) setShowSug(true); }}
              placeholder="음식 검색"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            {sugLoading && (
              <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-gray-300" />
            )}
          </div>
          <button
            onClick={lookup}
            disabled={loading || !query.trim()}
            className="flex shrink-0 items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            추가
          </button>
        </div>
      </div>
    </div>
  );
}

const editInput =
  "w-full rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-500";
