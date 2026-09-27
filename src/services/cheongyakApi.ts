// ---------------------------------------------------------------------------
// 청약 (청약홈 분양공고) — 실데이터 전용. 샘플/모의 데이터 폴백 없음.
//
// 1) 공고 목록: 브라우저의 공공데이터포털 키(localStorage "sophia-api-data")로
//    odcloud 청약홈 API 직접 호출 → 실패 시 Supabase api-proxy("subscription")
// 2) 폰 알림 지역: Cloudflare Worker (sophia-cheongyak-alert) GET/PUT /regions
// ---------------------------------------------------------------------------

import { proxyFetch } from "./proxyFetch";

export const CHEONGYAK_WORKER = "https://sophia-cheongyak-alert.ko5439625.workers.dev";
export const APPLYHOME_LIST_URL = "https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancListView.do";

const ODCLOUD_ENDPOINT = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail";

/** 워커 /regions 가 응답 못 할 때 쓰는 17개 시·도 */
export const SIDO_OPTIONS = [
  "서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

export interface CheongyakNotice {
  id: string;
  name: string;
  sido: string;          // "서울", "경기" …
  address: string;
  houseType: string;
  totalSupply: number | null;
  noticeDate: string;    // 모집공고일
  start: string;         // 접수 시작 YYYY-MM-DD
  end: string;           // 접수 마감 YYYY-MM-DD
  winnerDate: string;    // 당첨자 발표
  url: string;           // 청약홈 공고 링크
}

export type NoticeResult =
  | { status: "ok"; items: CheongyakNotice[]; source: "direct" | "proxy" }
  | { status: "no-key" }
  /** 키는 있지만 청약홈 분양정보 API 활용신청이 안 된 키 (odcloud 401 / code -4) */
  | { status: "key-not-registered" }
  | { status: "error"; message: string };

interface RawItem {
  HOUSE_MANAGE_NO?: string | number;
  PBLANC_NO?: string | number;
  HOUSE_NM?: string;
  HOUSE_SECD_NM?: string;
  HSSPLY_ADRES?: string;
  SUBSCRPT_AREA_CODE_NM?: string;
  TOT_SUPLY_HSHLDCO?: number | string;
  RCRIT_PBLANC_DE?: string;
  RCEPT_BGNDE?: string;
  RCEPT_ENDDE?: string;
  PRZWNER_PRESNATN_DE?: string;
  PBLANC_URL?: string;
}

function ymd(raw?: string): string {
  if (!raw) return "";
  const d = raw.replace(/[^0-9]/g, "");
  return d.length >= 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : raw;
}

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "서울특별시" / "경기도" 같은 긴 이름도 짧은 시·도로 */
export function normalizeSido(raw: string): string {
  const s = (raw || "").trim();
  const hit = SIDO_OPTIONS.find((o) => s.startsWith(o));
  if (hit) return hit;
  const long: Record<string, string> = { 충청북: "충북", 충청남: "충남", 전라북: "전북", 전북특: "전북", 전라남: "전남", 경상북: "경북", 경상남: "경남" };
  const key = Object.keys(long).find((k) => s.startsWith(k));
  return key ? long[key] : s;
}

function mapItems(items: RawItem[]): CheongyakNotice[] {
  return items.map((it, i) => ({
    id: String(it.PBLANC_NO ?? it.HOUSE_MANAGE_NO ?? `n-${i}`),
    name: it.HOUSE_NM ?? "(이름 없음)",
    sido: normalizeSido(it.SUBSCRPT_AREA_CODE_NM ?? it.HSSPLY_ADRES ?? ""),
    address: it.HSSPLY_ADRES ?? "",
    houseType: it.HOUSE_SECD_NM ?? "",
    totalSupply: it.TOT_SUPLY_HSHLDCO != null && it.TOT_SUPLY_HSHLDCO !== "" ? Number(it.TOT_SUPLY_HSHLDCO) : null,
    noticeDate: ymd(it.RCRIT_PBLANC_DE),
    start: ymd(it.RCEPT_BGNDE),
    end: ymd(it.RCEPT_ENDDE),
    winnerDate: ymd(it.PRZWNER_PRESNATN_DE),
    url: it.PBLANC_URL || APPLYHOME_LIST_URL,
  }));
}

/** 아직 마감 안 된 공고만, 접수 시작일 순 */
function openOnly(items: CheongyakNotice[]): CheongyakNotice[] {
  const today = todayYmd();
  const seen = new Set<string>();
  return items
    .filter((n) => n.end && n.end >= today)
    .filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function getDataKey(): string | null {
  const k = localStorage.getItem("sophia-api-data");
  if (!k) return null;
  // 포털의 "Encoding" 키를 붙여넣은 경우 이중 인코딩 방지
  try { return k.includes("%") ? decodeURIComponent(k) : k; } catch { return k; }
}

async function fetchDirect(key: string, withCond: boolean): Promise<CheongyakNotice[]> {
  const params = new URLSearchParams({ serviceKey: key, page: "1", perPage: "100" });
  if (withCond) params.set("cond[RCEPT_ENDDE::GTE]", todayYmd());
  const res = await fetch(`${ODCLOUD_ENDPOINT}?${params.toString()}`, { headers: { accept: "application/json" } });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j?.msg) msg = j.msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const json = await res.json();
  return mapItems((json?.data ?? []) as RawItem[]);
}

export async function fetchCheongyakNotices(): Promise<NoticeResult> {
  const key = getDataKey();
  let lastError = "";
  let unregistered = false;

  if (key) {
    try {
      return { status: "ok", items: openOnly(await fetchDirect(key, true)), source: "direct" };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      unregistered = /등록되지 않은 인증키|HTTP 401/.test(lastError);
      if (!unregistered) try {
        return { status: "ok", items: openOnly(await fetchDirect(key, false)), source: "direct" };
      } catch { /* proxy 로 */ }
    }
  }

  // Supabase Edge proxy (서버 키가 있으면 클라이언트 키 없이도 동작)
  try {
    const r = await proxyFetch<{ data?: RawItem[]; error?: string; msg?: string }>(
      "subscription", { apiKey: key || "", page: 1 }, 0,
    );
    if (r && Array.isArray(r.data) && r.data.length > 0) {
      return { status: "ok", items: openOnly(mapItems(r.data)), source: "proxy" };
    }
    if (r?.error === "No API key configured" && !key) return { status: "no-key" };
    if (r?.error || r?.msg) lastError = r.error || r.msg || lastError;
  } catch (e) {
    lastError = lastError || (e instanceof Error ? e.message : String(e));
  }

  if (!key) return { status: "no-key" };
  if (unregistered) return { status: "key-not-registered" };
  return { status: "error", message: lastError || "청약홈 응답이 비어 있어요" };
}

// ---------------------------------------------------------------------------
// D-day
// ---------------------------------------------------------------------------

export type NoticePhase = "upcoming" | "open" | "closed";

export function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00`);
  const b = new Date(`${toYmd}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function noticePhase(n: CheongyakNotice, today = todayYmd()): NoticePhase {
  if (n.start && today < n.start) return "upcoming";
  if (n.end && today > n.end) return "closed";
  return "open";
}

// ---------------------------------------------------------------------------
// Worker: 폰 알림 지역
// ---------------------------------------------------------------------------

export interface WorkerRegions { regions: string[]; options: string[] }

export async function getAlertRegions(): Promise<WorkerRegions> {
  const res = await fetch(`${CHEONGYAK_WORKER}/regions`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return {
    regions: Array.isArray(j?.regions) ? j.regions : [],
    options: Array.isArray(j?.options) && j.options.length ? j.options : SIDO_OPTIONS,
  };
}

export async function putAlertRegions(regions: string[]): Promise<string[]> {
  const res = await fetch(`${CHEONGYAK_WORKER}/regions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ regions }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json().catch(() => null);
  return Array.isArray(j?.regions) ? j.regions : regions;
}
