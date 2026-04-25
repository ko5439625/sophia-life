// Shared memo store - Supabase synced
// Used by CoupleView (속닥속닥) and DashboardHome

import { loadMemosFromDB, saveMemoToDB, deleteMemoFromDB } from "../services/supabaseSync";
import type { MemoRow } from "../services/supabaseSync";

export interface CoupleMemo {
  id: string;
  author: "sophia" | "partner";
  message: string;
  timestamp: string;
  pinned: boolean;
}

const STORAGE_KEY = "sophia-couple-memos";

function toMemo(r: MemoRow): CoupleMemo {
  return {
    id: r.id,
    author: r.author as CoupleMemo["author"],
    message: r.message,
    timestamp: r.timestamp,
    pinned: r.pinned,
  };
}

function toRow(m: CoupleMemo): MemoRow {
  return {
    id: m.id,
    author: m.author,
    message: m.message,
    timestamp: m.timestamp,
    pinned: m.pinned,
  };
}

// Load: Supabase first, then localStorage fallback
export async function loadMemosAsync(): Promise<CoupleMemo[]> {
  const rows = await loadMemosFromDB();
  if (rows.length > 0) {
    const memos = rows.map(toMemo);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
    return memos;
  }
  return loadMemos();
}

// Sync load (localStorage only, for initial render)
export function loadMemos(): CoupleMemo[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

export function saveMemos(memos: CoupleMemo[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
}

export function getPinnedMemos(): CoupleMemo[] {
  const memos = loadMemos();
  return memos.filter((m) => m.pinned);
}

export function getRecentMemos(limit = 3): CoupleMemo[] {
  const memos = loadMemos();
  return [...memos]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

// Supabase CRUD
export async function addMemoToDB(memo: CoupleMemo): Promise<void> {
  await saveMemoToDB(toRow(memo));
}

export async function updateMemoInDB(memo: CoupleMemo): Promise<void> {
  await saveMemoToDB(toRow(memo));
}

export async function removeMemoFromDB(id: string): Promise<void> {
  await deleteMemoFromDB(id);
}
