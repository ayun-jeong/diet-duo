"use client";

import { Star, Trash2 } from "lucide-react";
import { useDiet } from "@/lib/store";
import { type MealType, MEAL_TYPES } from "@/lib/types";
import { toast } from "sonner";

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식",
};

export default function FavoritesPanel() {
  const favorites = useDiet((s) => s.favorites);
  const removeFavorite = useDiet((s) => s.removeFavorite);
  const addFood = useDiet((s) => s.addFood);

  if (favorites.length === 0) return null;

  const handleDelete = async (id: string, name: string) => {
    await removeFavorite(id);
    toast.info(`즐겨찾기 삭제: ${name}`);
  };

  const handleAddToMeal = async (fav: typeof favorites[0], meal: MealType) => {
    await addFood(meal, {
      name: fav.name,
      amount: fav.amount,
      kcal: fav.kcal,
      carbs: fav.carbs,
      protein: fav.protein,
      fat: fav.fat,
      source: "manual",
    });
    toast.success(`${fav.name} → ${MEAL_LABELS[meal]} 추가`);
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          즐겨찾기
        </h3>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600 ring-1 ring-amber-200">
          {favorites.length}개
        </span>
      </div>

      {/* 목록 */}
      <ul className="mt-3 space-y-1.5">
        {favorites.map((fav) => (
          <li
            key={fav.id}
            className="group flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-transparent hover:ring-amber-200"
          >
            {/* 음식 정보 */}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 truncate">
                <span className="truncate text-sm font-medium">{fav.name}</span>
                {fav.amount && (
                  <span className="shrink-0 text-xs text-gray-400">{fav.amount}</span>
                )}
                <span className="ml-auto shrink-0 text-xs font-semibold text-emerald-600">
                  {fav.kcal}kcal
                </span>
              </div>
              <div className="mt-0.5 flex gap-2 text-[10px] text-gray-400">
                <span>탄 {fav.carbs}g</span>
                <span>단 {fav.protein}g</span>
                <span>지 {fav.fat}g</span>
              </div>
            </div>

            {/* 추가 버튼 (hover 시 표시) */}
            <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
              {MEAL_TYPES.map((meal) => (
                <button
                  key={meal}
                  onClick={() => handleAddToMeal(fav, meal)}
                  title={`${MEAL_LABELS[meal]}에 추가`}
                  className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 hover:bg-amber-100"
                >
                  {MEAL_LABELS[meal]}
                </button>
              ))}
              <button
                onClick={() => handleDelete(fav.id, fav.name)}
                className="rounded-md p-1 text-gray-300 hover:bg-rose-50 hover:text-rose-500"
                title="삭제"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
