"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  calcMacroTargets,
  macrosToKcal,
} from "@/lib/nutrition";
import { useDiet } from "@/lib/store";
import type { MacroGoal } from "@/lib/types";
import type {
  ActivityLevel,
  Goal,
  Sex,
  UserProfile,
} from "@/lib/types";
import CoupleSetup from "./CoupleSetup";
import SafeSection from "./SafeSection";

const ACTIVITIES = Object.keys(ACTIVITY_LABELS) as ActivityLevel[];
const GOALS = Object.keys(GOAL_LABELS) as Goal[];

interface Props {
  onDone?: () => void;
}

export default function ProfileForm({ onDone }: Props) {
  const profile = useDiet((s) => s.profile);
  const setProfile = useDiet((s) => s.setProfile);
  const settings = useDiet((s) => s.settings);
  const setSettings = useDiet((s) => s.setSettings);

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
  /** 사용자가 폼을 건드린 뒤에는 서버 값으로 되돌리지 않는다. */
  const [dirty, setDirty] = useState(false);

  /**
   * 프로필은 로그인 직후 서버에서 뒤늦게 도착할 수 있다.
   * useState 초기값만 쓰면 그때 이미 렌더된 폼은 기본값(170/65/25)을 들고 있고,
   * 그대로 저장하면 서버의 실제 프로필을 기본값으로 덮어써 버린다.
   */
  useEffect(() => {
    if (profile && !dirty) setForm(profile);
  }, [profile, dirty]);

  const update = (patch: Partial<UserProfile>) => {
    setDirty(true);
    setForm((f) => ({ ...f, ...patch }));
  };

  const auto = calcMacroTargets(form);

  /**
   * 영양소 목표 직접 지정.
   *
   * 켜면 g 수를 직접 넣고, 목표 칼로리는 그 g 수에서 역산한다.
   * (칼로리를 따로 두면 화면에 표시되는 두 값이 어긋난다.)
   */
  const goal: MacroGoal = settings.macroGoal ?? {
    enabled: false,
    carbs: auto.carbs,
    protein: auto.protein,
    fat: auto.fat,
  };

  const custom = goal.enabled;
  const shown = custom ? goal : auto;
  const shownKcal = custom
    ? macrosToKcal(goal.carbs, goal.protein, goal.fat)
    : auto.kcal;

  const updateGoal = (patch: Partial<MacroGoal>) =>
    setSettings({ macroGoal: { ...goal, ...patch } });

  /** 켤 때는 현재 자동값을 시작점으로 채워 넣는다. */
  const toggleCustom = () =>
    setSettings({
      macroGoal: custom
        ? { ...goal, enabled: false }
        : { enabled: true, carbs: auto.carbs, protein: auto.protein, fat: auto.fat },
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.heightCm <= 0 || form.weightKg <= 0 || form.age <= 0) {
      toast.error("키, 몸무게, 나이를 올바르게 입력하세요.");
      return;
    }
    try {
      await setProfile(form);
      setDirty(false);
      toast.success("프로필이 저장되었습니다.");
      onDone?.();
    } catch (err) {
      // 저장에 실패하면 폼을 닫지 않는다 — 닫으면 입력값이 사라진다.
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`저장 실패: ${msg}`);
      console.error("[ProfileForm] setProfile error:", msg);
    }
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
            onChange={(e) => update({ heightCm: num(e.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="몸무게 (kg)">
          <input
            type="number"
            value={form.weightKg}
            onChange={(e) => update({ weightKg: num(e.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="나이">
          <input
            type="number"
            value={form.age}
            onChange={(e) => update({ age: num(e.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="성별">
          <select
            value={form.sex}
            onChange={(e) => update({ sex: e.target.value as Sex })}
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
            onChange={(e) => update({ activity: e.target.value as ActivityLevel })}
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
                onClick={() => update({ goal: g })}
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
        <div className="flex items-center justify-between">
          <div className="text-sm text-emerald-700">
            {custom ? "내가 정한 목표" : "예상 목표 칼로리"}
          </div>
          <button
            type="button"
            onClick={toggleCustom}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              custom
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-white text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
            }`}
          >
            {custom ? "자동으로 되돌리기" : "직접 정하기"}
          </button>
        </div>

        <div className="mt-0.5 text-2xl font-extrabold text-emerald-700">
          {shownKcal.toLocaleString()} kcal
          <span className="ml-1 text-sm font-normal">/ 일</span>
        </div>

        {custom ? (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  ["carbs", "탄수화물"],
                  ["protein", "단백질"],
                  ["fat", "지방"],
                ] as [keyof Omit<MacroGoal, "enabled">, string][]
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-[11px] font-medium text-emerald-700">
                    {label} (g)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={goal[key]}
                    onChange={(e) =>
                      updateGoal({ [key]: Math.max(0, num(e.target.value)) } as Partial<MacroGoal>)
                    }
                    className="w-full rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-emerald-600">
              칼로리는 입력한 g 수에서 자동 계산됩니다 (탄·단 4kcal/g, 지방 9kcal/g).
              <br />
              자동 추천값: 탄 {auto.carbs}g · 단 {auto.protein}g · 지 {auto.fat}g
            </p>
          </>
        ) : (
          <div className="mt-1 text-xs text-emerald-600">
            탄수화물 {shown.carbs}g · 단백질 {shown.protein}g · 지방 {shown.fat}g
          </div>
        )}
      </div>

      <button
        type="submit"
        className="mt-5 w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700"
      >
        저장하고 시작하기
      </button>
    </form>

    {/*
      커플 기능은 부가 기능이다. 여기서 무슨 일이 생겨도 프로필 설정·저장은
      항상 가능해야 하므로 에러 경계로 격리한다.
    */}
    {/*
      파트너의 "기록"은 홈에서 보여준다 (나 / 파트너 / 함께 전환).
      여기 남는 건 한 번 하고 끝나는 "연결" 설정뿐이다.
    */}
    <SafeSection label="커플 연결">
      <CoupleSetup />
    </SafeSection>
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
