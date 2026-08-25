"use client";

import { useDiet, usePartnerName } from "@/lib/store";

export type HomeView = "me" | "partner" | "both";

interface Props {
  view: HomeView;
  onChange: (view: HomeView) => void;
}

/**
 * 나 · 파트너 · 함께 전환.
 * 커플이 연결돼 있지 않으면 아예 그리지 않는다 — 고를 것이 없는 버튼은 두지 않는다.
 */
export default function ViewToggle({ view, onChange }: Props) {
  const partner = useDiet((s) => s.partner);
  const partnerName = usePartnerName();
  if (!partner.linked) return null;

  const options: { key: HomeView; label: string; on: string }[] = [
    { key: "me", label: "나", on: "bg-white text-emerald-700" },
    { key: "partner", label: partnerName, on: "bg-white text-indigo-700" },
    { key: "both", label: "함께", on: "bg-white text-gray-800" },
  ];

  return (
    <div
      role="tablist"
      aria-label="누구의 기록을 볼지"
      className="flex w-full items-center gap-0.5 rounded-full bg-gray-100 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={view === o.key}
          onClick={() => onChange(o.key)}
          className={`flex-1 truncate rounded-full px-3 py-1.5 text-xs font-bold transition ${
            view === o.key ? `${o.on} shadow-sm` : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
