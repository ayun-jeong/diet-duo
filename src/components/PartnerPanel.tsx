"use client";

import { Dumbbell, EyeOff, Loader2, RefreshCw, Utensils } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { supabase } from "@/lib/supabase";
import { useDiet } from "@/lib/store";
import { MEAL_LABELS, MEAL_TYPES, type DayLog } from "@/lib/types";

interface MaskedDayLog extends DayLog {
  partnerName: string;
}

export default function PartnerPanel() {
  const user = useAuth((s) => s.user);
  const date = useDiet((s) => s.date);
  const [data, setData] = useState<MaskedDayLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [coupled, setCoupled] = useState(false);

  const fetchPartnerLog = useCallback(async () => {
    if (!user || !supabase) return;

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/partner/today?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 204) {
        // 커플 연결 없음
        setCoupled(false);
        setData(null);
        return;
      }

      if (res.ok) {
        setCoupled(true);
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [user, date]);

  useEffect(() => {
    fetchPartnerLog();
  }, [fetchPartnerLog]);

  if (!user || !coupled) return null;

  const totalKcal = data
    ? MEAL_TYPES.reduce(
        (sum, m) => sum + data.meals[m].reduce((s, f) => s + f.kcal, 0),
        0,
      )
    : 0;

  const totalExercise = data?.exercises?.reduce((s, e) => s + e.burned, 0) ?? 0;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <Utensils className="h-4 w-4 text-pink-500" />
          {data?.partnerName ?? "파트너"}의 오늘
        </div>
        <button
          onClick={fetchPartnerLog}
          disabled={loading}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
          aria-label="새로고침"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : !data ? (
        <p className="mt-3 text-center text-xs text-gray-400">
          아직 오늘 기록이 없어요.
        </p>
      ) : (
        <>
          {/* 총 칼로리 */}
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold">
              {totalKcal.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400">kcal 섭취</span>
            {totalExercise > 0 && (
              <span className="ml-auto flex items-center gap-0.5 text-xs font-medium text-rose-500">
                <Dumbbell className="h-3 w-3" />
                -{totalExercise.toLocaleString()}
              </span>
            )}
          </div>

          {/* 끼니별 목록 */}
          <div className="mt-3 space-y-2">
            {MEAL_TYPES.map((meal) => {
              const items = data.meals[meal];
              if (items.length === 0) return null;
              return (
                <div key={meal}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {MEAL_LABELS[meal]}
                  </div>
                  <ul className="mt-0.5 space-y-0.5">
                    {items.map((food) => (
                      <li
                        key={food.id}
                        className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs"
                      >
                        {food.private ? (
                          <span className="flex items-center gap-1 text-gray-400">
                            <EyeOff className="h-3 w-3" />
                            비공개 음식
                          </span>
                        ) : (
                          <span className="flex-1 truncate">{food.name}</span>
                        )}
                        <span className="shrink-0 font-medium text-gray-500">
                          {food.kcal}kcal
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* 운동 */}
          {(data.exercises?.length ?? 0) > 0 && (
            <div className="mt-2 border-t border-gray-100 pt-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                운동
              </div>
              {data.exercises!.map((ex) => (
                <div key={ex.id} className="mt-0.5 flex items-center gap-1 text-xs">
                  <span className="flex-1 truncate">{ex.name}</span>
                  <span className="font-medium text-rose-500">-{ex.burned}kcal</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
