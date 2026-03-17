// Shared memo store using localStorage for pinned memo persistence
// Used by CoupleView (속닥속닥) and DashboardHome

export interface CoupleMemo {
  id: string;
  author: "sophia" | "partner";
  message: string;
  timestamp: string;
  pinned: boolean;
}

const STORAGE_KEY = "sophia-couple-memos";

export const initialMemos: CoupleMemo[] = [
  { id: "1", author: "sophia", message: "오늘 점심 맛있는 거 먹자! ❤️", timestamp: "2026-03-17 09:30", pinned: true },
  { id: "2", author: "partner", message: "좋아~ 뭐 먹을까? 파스타 어때?", timestamp: "2026-03-17 09:35", pinned: false },
  { id: "3", author: "sophia", message: "주말에 한강 산책 가자!", timestamp: "2026-03-16 20:10", pinned: false },
  { id: "4", author: "partner", message: "우리 결혼기념일 선물 뭐가 좋을까 고민 중...", timestamp: "2026-03-15 18:45", pinned: false },
  { id: "5", author: "sophia", message: "오늘 퇴근하면서 케이크 사갈게 🎰", timestamp: "2026-03-15 14:20", pinned: false },
];

export function loadMemos(): CoupleMemo[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore parse errors
  }
  return initialMemos;
}

export function saveMemos(memos: CoupleMemo[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
}

export function getPinnedMemos(): CoupleMemo[] {
  const memos = loadMemos();
  return memos.filter((m) => m.pinned);
}
