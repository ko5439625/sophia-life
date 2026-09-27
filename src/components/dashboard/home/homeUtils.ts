// 홈 대시보드 공용 헬퍼 (날짜/금액 포맷, 결혼 준비 요약 로더)
import {
  checkSettlementTablesExist,
  loadSettlementItems,
  loadSettlementVendors,
  loadWeddingItems,
} from "../../../services/supabaseSync";
import type { WeddingItemRow } from "../../../services/supabaseSync";

export const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

/** 로컬 기준 YYYY-MM-DD */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 로컬 기준 YYYY-MM */
export function toMonthKey(d: Date): string {
  return toDateKey(d).slice(0, 7);
}

/** YYYY-MM-DD → 로컬 자정 Date (UTC 파싱으로 하루 밀리는 문제 방지) */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 오늘 대비 날짜 차 (양수 = 미래) */
export function diffDays(key: string, from = new Date()): number {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((parseDateKey(key).getTime() - base.getTime()) / 86400000);
}

export function ddayLabel(diff: number): string {
  if (diff === 0) return "D-Day";
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

export function formatWon(n: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(Math.round(n))}원`;
}

/** 3,000,000 → "300만", 18,400,000 → "1,840만", 9,000 → "9,000" */
export function formatMan(n: number): string {
  const abs = Math.abs(n);
  if (abs < 10000) return new Intl.NumberFormat("ko-KR").format(Math.round(n));
  return `${new Intl.NumberFormat("ko-KR").format(Math.round(n / 10000))}만`;
}

export function shortDate(key: string): string {
  const d = parseDateKey(key);
  return `${d.getMonth() + 1}/${d.getDate()} ${DAY_NAMES[d.getDay()]}`;
}

export function relativeTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(diffMin)) return "";
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

// ---------------------------------------------------------------------------
// 결혼 준비 요약 — WeddingView 와 같은 계산, 읽기 전용 (DB 쓰기 없음)
// ---------------------------------------------------------------------------

export interface WeddingSummary {
  checklistDone: number;
  checklistTotal: number;
  /** 결제 완료 금액 (체크리스트 완료 예산 + 정산 결제액) */
  paid: number;
  /** 총 금액 (체크리스트 예산 + 정산 총액) */
  total: number;
  /** 7일 이내 잔금일이 있는 업체 */
  nextThisWeek: { title: string; date: string } | null;
}

interface LocalSettlementStore {
  vendors?: { name: string; finalPaymentDate?: string }[];
  items?: { amount: number; paymentStatus: string; paidAmount?: number; isPrepayment?: boolean }[];
}

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function loadWeddingSummary(): Promise<WeddingSummary> {
  let checklist: WeddingItemRow[] = await loadWeddingItems();
  if (checklist.length === 0) checklist = readLocal<WeddingItemRow[]>("sophia-wedding-ledger") ?? [];

  let vendors: { name: string; finalPaymentDate?: string }[] = [];
  let items: { amount: number; paymentStatus: string; paidAmount?: number; isPrepayment?: boolean }[] = [];
  const local = readLocal<LocalSettlementStore>("sophia-wedding-settlement");
  if (await checkSettlementTablesExist()) {
    const [vRows, iRows] = await Promise.all([loadSettlementVendors(), loadSettlementItems()]);
    vendors = vRows.map((v) => ({ name: v.name, finalPaymentDate: v.final_payment_date ?? undefined }));
    items = iRows.map((i) => ({
      amount: i.amount,
      paymentStatus: i.payment_status,
      paidAmount: i.paid_amount ?? undefined,
      isPrepayment: i.is_prepayment,
    }));
  }
  if (vendors.length === 0 && local?.vendors) vendors = local.vendors;
  if (items.length === 0 && local?.items) items = local.items;

  // 정산 통계 (useWeddingSettlement.globalStats 와 동일)
  let sTotal = 0;
  let sPaid = 0;
  for (const i of items) {
    if (i.paymentStatus === "service") continue;
    if (!i.isPrepayment) sTotal += i.amount;
    if (i.paymentStatus === "paid") sPaid += i.isPrepayment ? Math.abs(i.amount) : i.amount;
    else if (i.paymentStatus === "partial" && i.paidAmount) sPaid += i.paidAmount;
  }

  const cBudget = checklist.reduce((s, i) => s + (i.budget || 0), 0);
  const cDoneBudget = checklist.filter((i) => i.is_done).reduce((s, i) => s + (i.budget || 0), 0);

  const upcoming = vendors
    .filter((v) => v.finalPaymentDate)
    .map((v) => ({ title: `${v.name} 잔금`, date: v.finalPaymentDate!.slice(0, 10) }))
    .filter((v) => {
      const d = diffDays(v.date);
      return d >= 0 && d <= 7;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    checklistDone: checklist.filter((i) => i.is_done).length,
    checklistTotal: checklist.length,
    paid: cDoneBudget + sPaid,
    total: cBudget + sTotal,
    nextThisWeek: upcoming[0] ?? null,
  };
}
