// ---------------------------------------------------------------------------
// 분양 정보 API - 청약홈 공공 API
// ---------------------------------------------------------------------------

import { proxyFetch } from "./proxyFetch";

export interface SubscriptionInfo {
  id: string;
  houseName: string;        // 주택명
  region: string;           // 지역
  houseType: string;        // 주택유형 (아파트/오피스텔 등)
  totalSupply: number;      // 공급세대수
  applyStartDate: string;   // 청약시작일
  applyEndDate: string;     // 청약마감일
  announcementDate: string; // 당첨자발표일
  moveInDate: string;       // 입주예정월
  constructorName: string;  // 시공사
  priceRange: string;       // 분양가 범위
}

export type SubscriptionStatus = "ongoing" | "upcoming" | "closed";

export function getSubscriptionStatus(item: SubscriptionInfo): SubscriptionStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(item.applyStartDate);
  const end = new Date(item.applyEndDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (today < start) return "upcoming";
  if (today > end) return "closed";
  return "ongoing";
}

// ---------------------------------------------------------------------------
// API key
// ---------------------------------------------------------------------------

function getApiKey(): string | null {
  return localStorage.getItem("sophia-api-data");
}

// ---------------------------------------------------------------------------
// Real API fetch (direct)
// ---------------------------------------------------------------------------

const APT_SUBSCRIPTION_ENDPOINT =
  "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail";

interface ApiResponseItem {
  PBLANC_NO?: string;
  HOUSE_NM?: string;
  SUBSCRPT_AREA_CODE_NM?: string;
  HOUSE_SECD_NM?: string;
  TOT_SUPLY_HSHLDCO?: number;
  RCEPT_BGNDE?: string;
  RCEPT_ENDDE?: string;
  PRZWNER_PRESNATN_DE?: string;
  MVN_PREARNGE_YM?: string;
  CNSTRCT_ENTRPS_NM?: string;
  BSNS_MBY_NM?: string;
}

function parseDate(raw: string | undefined): string {
  if (!raw) return "";
  // Format: "YYYY-MM-DD" or "YYYYMMDD"
  const cleaned = raw.replace(/[^0-9]/g, "");
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  }
  return raw;
}

function mapApiItems(items: ApiResponseItem[]): SubscriptionInfo[] {
  return items.map((item, idx) => ({
    id: item.PBLANC_NO ?? `api-${idx}`,
    houseName: item.HOUSE_NM ?? "알 수 없음",
    region: item.SUBSCRPT_AREA_CODE_NM ?? "",
    houseType: item.HOUSE_SECD_NM ?? "아파트",
    totalSupply: item.TOT_SUPLY_HSHLDCO ?? 0,
    applyStartDate: parseDate(item.RCEPT_BGNDE),
    applyEndDate: parseDate(item.RCEPT_ENDDE),
    announcementDate: parseDate(item.PRZWNER_PRESNATN_DE),
    moveInDate: item.MVN_PREARNGE_YM ?? "",
    constructorName: item.CNSTRCT_ENTRPS_NM ?? item.BSNS_MBY_NM ?? "",
    priceRange: "",
  }));
}

export async function fetchSubscriptions(): Promise<SubscriptionInfo[]> {
  const apiKey = getApiKey();

  // 1. Try Supabase proxy (서버 환경변수에 API 키가 설정되어 있으면 클라이언트 키 없이도 동작)
  try {
    const proxyResult = await proxyFetch<{
      data?: ApiResponseItem[];
      currentCount?: number;
      error?: string;
    }>("subscription", { apiKey: apiKey || "", page: 1 });

    if (proxyResult) {
      const items = proxyResult.data ?? [];
      if (Array.isArray(items) && items.length > 0) {
        console.log(`[fetchSubscriptions] proxy success: ${items.length} items`);
        return mapApiItems(items);
      }
      if (proxyResult.error) {
        console.warn("[fetchSubscriptions] proxy error:", proxyResult.error);
      }
    }
  } catch (e) {
    console.warn("[fetchSubscriptions] proxy failed:", e);
  }

  // 2. Try direct API (클라이언트에 API 키가 있는 경우)
  if (apiKey) {
    try {
      const params = new URLSearchParams({
        serviceKey: apiKey,
        page: "1",
        perPage: "30",
      });

      const res = await fetch(`${APT_SUBSCRIPTION_ENDPOINT}?${params.toString()}`, {
        headers: { accept: "application/json" },
      });

      if (res.ok) {
        const json = await res.json();
        const items: ApiResponseItem[] = json.data ?? [];

        if (items.length > 0) {
          console.log(`[fetchSubscriptions] direct API success: ${items.length} items`);
          return mapApiItems(items);
        }
      } else {
        console.warn("Subscription API error:", res.status);
      }
    } catch (err) {
      console.warn("Subscription API fetch failed:", err);
    }
  }

  // 3. Mock fallback (API 키 미설정 시)
  console.warn("[subscriptionApi] Using mock data - set API key or configure DATA_GO_KR_API_KEY in Supabase secrets");
  return getMockSubscriptions();
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function getMockSubscriptions(): SubscriptionInfo[] {
  return [
    // 청약 진행 중 (2026-03-21 기준)
    {
      id: "mock-1",
      houseName: "래미안 원펜타스",
      region: "서울특별시 서초구",
      houseType: "아파트",
      totalSupply: 641,
      applyStartDate: "2026-03-18",
      applyEndDate: "2026-03-25",
      announcementDate: "2026-04-02",
      moveInDate: "2028-06",
      constructorName: "삼성물산",
      priceRange: "14억~28억",
    },
    {
      id: "mock-2",
      houseName: "롯데캐슬 이스트폴",
      region: "서울특별시 강동구",
      houseType: "아파트",
      totalSupply: 1089,
      applyStartDate: "2026-03-17",
      applyEndDate: "2026-03-24",
      announcementDate: "2026-04-01",
      moveInDate: "2028-08",
      constructorName: "롯데건설",
      priceRange: "9억~16억",
    },
    // 청약 예정
    {
      id: "mock-3",
      houseName: "디에이치 퍼스티어",
      region: "서울특별시 강남구",
      houseType: "아파트",
      totalSupply: 489,
      applyStartDate: "2026-04-07",
      applyEndDate: "2026-04-14",
      announcementDate: "2026-04-22",
      moveInDate: "2028-11",
      constructorName: "현대건설",
      priceRange: "18억~35억",
    },
    {
      id: "mock-4",
      houseName: "힐스테이트 위례 센트럴",
      region: "경기도 성남시",
      houseType: "아파트",
      totalSupply: 1204,
      applyStartDate: "2026-04-14",
      applyEndDate: "2026-04-21",
      announcementDate: "2026-04-29",
      moveInDate: "2029-01",
      constructorName: "현대엔지니어링",
      priceRange: "8억~15억",
    },
    {
      id: "mock-5",
      houseName: "아크로 리버뷰 신반포",
      region: "서울특별시 서초구",
      houseType: "아파트",
      totalSupply: 312,
      applyStartDate: "2026-05-12",
      applyEndDate: "2026-05-19",
      announcementDate: "2026-05-27",
      moveInDate: "2029-06",
      constructorName: "대림산업",
      priceRange: "20억~40억",
    },
    {
      id: "mock-6",
      houseName: "e편한세상 하남 드림시티",
      region: "경기도 하남시",
      houseType: "아파트",
      totalSupply: 936,
      applyStartDate: "2026-04-21",
      applyEndDate: "2026-04-28",
      announcementDate: "2026-05-08",
      moveInDate: "2028-12",
      constructorName: "DL이앤씨",
      priceRange: "7억~12억",
    },
    // 최근 마감
    {
      id: "mock-7",
      houseName: "e편한세상 청라 마리나",
      region: "인천광역시 서구",
      houseType: "아파트",
      totalSupply: 856,
      applyStartDate: "2026-03-03",
      applyEndDate: "2026-03-10",
      announcementDate: "2026-03-18",
      moveInDate: "2028-09",
      constructorName: "DL이앤씨",
      priceRange: "5억~9억",
    },
    {
      id: "mock-8",
      houseName: "더샵 분당 파크리버",
      region: "경기도 성남시",
      houseType: "아파트",
      totalSupply: 724,
      applyStartDate: "2026-02-24",
      applyEndDate: "2026-03-03",
      announcementDate: "2026-03-11",
      moveInDate: "2028-06",
      constructorName: "포스코이앤씨",
      priceRange: "10억~18억",
    },
    {
      id: "mock-9",
      houseName: "푸르지오 광명역 시그니처",
      region: "경기도 광명시",
      houseType: "아파트",
      totalSupply: 1532,
      applyStartDate: "2026-02-17",
      applyEndDate: "2026-02-24",
      announcementDate: "2026-03-04",
      moveInDate: "2028-10",
      constructorName: "대우건설",
      priceRange: "6억~11억",
    },
  ];
}

// ---------------------------------------------------------------------------
// Notification helpers (localStorage-based)
// ---------------------------------------------------------------------------

const NOTIFICATION_KEY = "sophia-subscription-notifications";

export function getNotificationIds(): string[] {
  try {
    const stored = localStorage.getItem(NOTIFICATION_KEY);
    if (stored) return JSON.parse(stored) as string[];
  } catch { /* ignore */ }
  return [];
}

export function toggleNotification(id: string): boolean {
  const ids = getNotificationIds();
  const idx = ids.indexOf(id);
  if (idx >= 0) {
    ids.splice(idx, 1);
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(ids));
    return false;
  } else {
    ids.push(id);
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(ids));
    return true;
  }
}
