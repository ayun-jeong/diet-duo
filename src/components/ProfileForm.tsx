"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  calcGoalCalories,
  calcMacroTargets,
} from "@/lib/nutrition";
import { useDiet } from "@/lib/store";
import type {
  ActivityLevel,
  Goal,
  Sex,
  UserProfile,
} from "@/lib/types";
import CoupleSetup from "./CoupleSetup";
import PartnerPanel from "./PartnerPanel";
import { supabase } from "@/lib/supabase";

const ACTIVITIES = Object.keys(ACTIVITY_LABELS) as ActivityLevel[];
const GOALS = Object.keys(GOAL_LABELS) as Goal[];

interface Props {
  onDone?: () => void;
}

export default function ProfileForm({ onDone }: Props) {
  const profile = useDiet((s) => s.profile);
  const setProfile = useDiet((s) => s.setProfile);

  const [form, setForm] = useState<UserProfile>(
    profile ?? {
      heightCm: 170,
      weightKg: 65,
      age: 25,
      sex: "male",
      activity: "light",
      goal: "lose",
    },
  );

  const preview = calcMacroTargets(form);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.heightCm <= 0 || form.weightKg <= 0 || form.age <= 0) {
      toast.error("키, 몸무게, 나이를 올바르게 입력하세요.");
      return;
    }
    try {
      await setProfile(form);
      toast.success("프로필이 저장되었습니다.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.warning(`임시 저장됨 (서버 오류: ${msg})`);
      console.error("[ProfileForm] setProfile error:", msg);
    }
    onDone?.();
  };

  const num = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
    <form
      onSubmit={submit}
      className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5"
    >
      <h2 className="text-lg font-bold">내 정보</h2>
      <p className="mt-1 text-sm text-gray-500">
        목표 칼로리를 계산하기 위해 입력해 주세요.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Field label="키 (cm)">
          <input
            type="number"
            value={form.heightCm}
            onChange={(e) => setForm({ ...form, heightCm: num(e.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="몸무게 (kg)">
          <input
            type="number"
            value={form.weightKg}
            onChange={(e) => setForm({ ...form, weightKg: num(e.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="나이">
          <input
            type="number"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: num(e.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="성별">
          <select
            value={form.sex}
            onChange={(e) => setForm({ ...form, sex: e.target.value as Sex })}
            className={inputCls}
          >
            <option value="male">남성</option>
            <option value="female">여성</option>
          </select>
        </Field>
      </div>

      <div className="mt-3">
        <Field label="활동량">
          <select
            value={form.activity}
            onChange={(e) =>
              setForm({ ...form, activity: e.target.value as ActivityLevel })
            }
            className={inputCls}
          >
            {ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {ACTIVITY_LABELS[a]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-3">
        <Field label="목표">
          <div className="grid grid-cols-3 gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setForm({ ...form, goal: g })}
                className={`rounded-lg border py-2 text-sm font-medium transition ${
                  form.goal === g
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {GOAL_LABELS[g]}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="mt-5 rounded-xl bg-emerald-50 p-4">
        <div className="text-sm text-emerald-700">예상 목표 칼로리</div>
        <div className="mt-0.5 text-2xl font-extrabold text-emerald-700">
          {Math.round(calcGoalCalories(form)).toLocaleString()} kcal
          <span className="ml-1 text-sm font-normal">/ 일</span>
        </div>
        <div className="mt-1 text-xs text-emerald-600">
          탄수화물 {preview.carbs}g · 단백질 {preview.protein}g · 지방 {preview.fat}g
        </div>
      </div>

      <button
        type="submit"
        className="mt-5 w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700"
      >
        저장하고 시작하기
      </button>
    </form>

    {supabase && <CoupleSetup />}
    <PartnerPanel />
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}
