"use client";

import { useDiet } from "@/lib/store";
import StickyMemo from "./StickyMemo";

/**
 * 붙어 있는 포스트잇 전부를 그린다.
 *
 * 각 장은 스스로 위치를 들고 fixed 로 떠 있으므로 여기서는 감싸는 요소를 두지 않는다.
 * (감싸면 그 상자가 화면 전체를 덮어 아래쪽 클릭을 먹는다.)
 */
export default function StickyMemos() {
  const ready = useDiet((s) => s.ready);
  const memos = useDiet((s) => s.memos);

  if (!ready) return null;

  return (
    <>
      {memos.map((memo, i) => (
        <StickyMemo key={memo.id} memo={memo} index={i} />
      ))}
    </>
  );
}
