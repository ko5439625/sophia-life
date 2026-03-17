// ---------------------------------------------------------------------------
// 분양 정보 API - 청약홈 공공 API
// ---------------------------------------------------------------------------

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
// Real API fetch
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

export async function fetchSubscriptions(): Promise<SubscriptionInfo[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("No API key found, using mock data");
    return getMockSubscriptions();
  }

  try {
    const params = new URLSearchParams({
      serviceKey: apiKey,
      page: "1",
      perPage: "30",
    });

    const res = await fetch(`${APT_SUBSCRIPTION_ENDPOINT}?${params.toString()}`, {
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      console.warn("Subscription API error, falling back to mock data");
      return getMockSubscriptions();
    }

    const json = await res.json();
    const items: ApiResponseItem[] = json.data ?? [];

    if (items.length === 0) {
      return getMockSubscriptions();
    }

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
  } catch (err) {
    console.warn("Subscription API fetch failed:", err);
    return getMockSubscriptions();
  }
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function getMockSubscriptions(): SubscriptionInfo[] {
  return [
    {
      id: "mock-1",
      houseName: "래미안 원펜타스",
      region: "서울특별시 서초구",
      houseType: "아파트",
      totalSupply: 641,
      applyStartDate: "2026-03-10",
      applyEndDate: "2026-03-20",
      announcementDate: "2026-03-28",
      moveInDate: "2028-06",
      constructorName: "삼성물산",
      priceRange: "14억~28억",
    },
    {
      id: "mock-2",
      houseName: "디에이치 퍼스티어",
      region: "서울특별시 강남구",
      houseType: "아파트",
      totalSupply: 489,
      applyStartDate: "2026-03-25",
      applyEndDate: "2026-04-02",
      announcementDate: "2026-04-10",
      moveInDate: "2028-09",
      constructorName: "현대건설",
      priceRange: "18억~35억",
    },
    {
      id: "mock-3",
      houseName: "힐스테이트 위례 센트럴",
      region: "경기도 성남시",
      houseType: "아파트",
      totalSupply: 1204,
      applyStartDate: "2026-04-05",
      applyEndDate: "2026-04-12",
      announcementDate: "2026-04-20",
      moveInDate: "2028-12",
      constructorName: "현대엔지니어링",
      priceRange: "8억~15억",
    },
    {
      id: "mock-4",
      houseName: "e편한세상 청라 마리나",
      region: "인천광역시 서구",
      houseType: "아파트",
      totalSupply: 856,
      applyStartDate: "2026-02-15",
      applyEndDate: "2026-02-22",
      announcementDate: "2026-03-02",
      moveInDate: "2028-03",
      constructorName: "DL이앤씨",
      priceRange: "5억~9억",
    },
    {
      id: "mock-5",
      houseName: "아크로 리버뷰 신반포",
      region: "서울특별시 서초구",
      houseType: "아파트",
      totalSupply: 312,
      applyStartDate: "2026-03-15",
      applyEndDate: "2026-03-22",
      announcementDate: "2026-04-01",
      moveInDate: "2029-01",
      constructorName: "대림산업",
      priceRange: "20억~40억",
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
