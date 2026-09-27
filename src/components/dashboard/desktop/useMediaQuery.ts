import { useEffect, useState } from "react";

/** 첫 렌더부터 정확한 값을 돌려주는 matchMedia 훅 (두 레이아웃을 번갈아 그리며 데이터를 두 번 불러오지 않도록) */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** 데스크톱(≥1280px, Tailwind xl) — 여러 패널을 한 화면에 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1280px)");
}
