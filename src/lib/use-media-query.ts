"use client";

import { useEffect, useState } from "react";

/**
 * 화면 폭에 따라 레이아웃 자체를 갈아끼울 때 쓴다.
 *
 * CSS 로 감추기만 하면 무거운 MealCard 가 양쪽 다 렌더되고 상태도 두 벌 생긴다.
 * 서버 렌더에서는 항상 false 로 시작해 하이드레이션 불일치를 피한다.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** 두 열을 나란히 세울 수 있는 폭인지 */
export const WIDE_QUERY = "(min-width: 900px)";
