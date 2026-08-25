"use client";

import { Coffee, HeartHandshake, Loader2, Moon, Sun, Sunrise } from "lucide-react";
import { useDiet, usePartnerName } from "@/lib/store";
import { MEAL_LABELS, type MealType } from "@/lib/types";

/** MealCard 와 같은 아이콘을 쓴다 — 같은 끼니는 어느 쪽에서 봐도 같아 보여야 한다. */
const MEAL_ICONS: Record<MealType, React.ReactNode> = {
  breakfast: <Sunrise className="h-4 w-4 text-orange-400" />,
  lunch: <Sun className="h-4 w-4 text-yellow-400" />,
  dinner: <Moon className="h-4 w-4 text-indigo-400" />,
  snack: <Coffee className="h-4 w-4 text-rose-400" />,
};

interface Props {
  meal: MealType;
  /** 촘촘한 형태 (휴대폰 '함께' 보기) */
  compact?: boolean;
}

/**
 * 파트너의 한 끼니 — 읽기 전용.
 *
 * 생김새는 MealCard 와 맞춘다. 파트너 화면만 다르게 생기면 같은 정보를 두 번
 * 배워야 한다. 빠지는 것은 입력·수정·삭제·즐겨찾기·AI 추천뿐이다.
 */
export default function PartnerMealCard({ meal, compact = false }: Props) {
  const partner = useDiet((s) => s.partner);
  const partnerName = usePartnerName();

  const items = partner.log?.meals[meal] ?? [];
  const subtotal = items.reduce((sum, f) => sum + f.kcal, 0);

  if (compact) {
    return (
      <div className="rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-black/5">
        {items.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-gray-300">비어 있음</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((food) => (
              <li key={food.id}>
                <div className="flex items-baseline gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                    {food.name}
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-gray-700">
                    {food.kcal}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400">
                  탄 {food.carbs} · 단 {food.protein} · 지 {food.fat}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      {/* 헤더 — MealCard 와 같은 자리, 같은 크기 */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-bold">
          {MEAL_ICONS[meal]}
          {MEAL_LABELS[meal]}
        </h3>
        <span className="text-sm font-semibold text-gray-400">
          {subtotal.toLocaleString()} kcal
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {partner.loading && !partner.log ? (
          <li className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
          </li>
        ) : partner.failed ? (
          <li className="rounded-xl border border-dashed border-gray-200 py-3 text-center text-xs text-gray-400">
            불러오지 못했어요
          </li>
        ) : items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-gray-200 py-3 text-center text-xs text-gray-400">
            아직 기록이 없어요
          </li>
        ) : (
          items.map((food) => (
            <li
              key={food.id}
              className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="truncate text-sm font-medium">{food.name}</span>
                  {food.amount && (
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {food.amount}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-gray-400">
                  <span className="whitespace-nowrap">
                    탄 {food.carbs}g · 단 {food.protein}g · 지 {food.fat}g
                  </span>
                  {/* 내가 보낸 것 — 상대 화면에서 어떻게 보이는지 여기서도 확인된다 */}
                  {food.sharedFrom && (
                    <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-pink-50 px-1.5 text-[10px] font-medium text-pink-600">
                      <HeartHandshake className="h-2.5 w-2.5" />
                      {food.sharedFrom.name} 보냄
                    </span>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold text-gray-700">
                {food.kcal}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
