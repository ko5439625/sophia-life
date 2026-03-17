// NOTE: Some APIs require a backend proxy to avoid CORS. For development, use mock data.
// 국토교통부 API returns XML and may require a backend proxy for CORS.

import { proxyFetch } from "./proxyFetch";

export interface ApartmentTransaction {
  id: string;
  aptName: string; // 아파트명
  area: number; // 전용면적 (㎡)
  floor: number; // 층
  price: number; // 거래금액 (만원)
  dealDate: string; // 거래일 (YYYY-MM-DD)
  dong: string; // 법정동
  jeonsePrice?: number; // 전세가 (만원)
  buildYear: number; // 건축년도
}

export interface ApartmentSearchResult {
  aptName: string;
  address: string;
  region: "서울" | "경기" | "인천"; // 지역
  recentPrice: number; // 최근 거래가
  recentDate: string;
  jeonsePrice: number;
  jeonseRate: number; // 전세가율 %
  area: number;
  transactions: ApartmentTransaction[];
}

// ---------------------------------------------------------------------------
// Mock data - realistic apartments with 8-10 transactions each over 2 years
// ---------------------------------------------------------------------------

const mockData: ApartmentSearchResult[] = [
  {
    aptName: "래미안 원베일리",
    address: "서울 서초구 반포동 18-1",
    region: "서울",
    recentPrice: 350000,
    recentDate: "2026-02-15",
    jeonsePrice: 180000,
    jeonseRate: 51,
    area: 112.92,
    transactions: [
      { id: "rb-1", aptName: "래미안 원베일리", area: 112.92, floor: 28, price: 350000, dealDate: "2026-02-15", dong: "반포동", jeonsePrice: 180000, buildYear: 2023 },
      { id: "rb-2", aptName: "래미안 원베일리", area: 112.92, floor: 15, price: 345000, dealDate: "2025-12-20", dong: "반포동", jeonsePrice: 175000, buildYear: 2023 },
      { id: "rb-3", aptName: "래미안 원베일리", area: 112.92, floor: 32, price: 348000, dealDate: "2025-10-08", dong: "반포동", jeonsePrice: 178000, buildYear: 2023 },
      { id: "rb-4", aptName: "래미안 원베일리", area: 112.92, floor: 20, price: 340000, dealDate: "2025-07-22", dong: "반포동", jeonsePrice: 172000, buildYear: 2023 },
      { id: "rb-5", aptName: "래미안 원베일리", area: 112.92, floor: 10, price: 335000, dealDate: "2025-04-15", dong: "반포동", jeonsePrice: 168000, buildYear: 2023 },
      { id: "rb-6", aptName: "래미안 원베일리", area: 112.92, floor: 25, price: 330000, dealDate: "2025-01-10", dong: "반포동", jeonsePrice: 165000, buildYear: 2023 },
      { id: "rb-7", aptName: "래미안 원베일리", area: 112.92, floor: 18, price: 325000, dealDate: "2024-10-05", dong: "반포동", jeonsePrice: 160000, buildYear: 2023 },
      { id: "rb-8", aptName: "래미안 원베일리", area: 112.92, floor: 22, price: 318000, dealDate: "2024-07-18", dong: "반포동", jeonsePrice: 158000, buildYear: 2023 },
      { id: "rb-9", aptName: "래미안 원베일리", area: 112.92, floor: 8, price: 310000, dealDate: "2024-04-12", dong: "반포동", jeonsePrice: 155000, buildYear: 2023 },
      { id: "rb-10", aptName: "래미안 원베일리", area: 112.92, floor: 30, price: 315000, dealDate: "2024-03-20", dong: "반포동", jeonsePrice: 157000, buildYear: 2023 },
    ],
  },
  {
    aptName: "힐스테이트 광교중앙역",
    address: "경기 수원시 영통구 이의동 1338",
    region: "경기",
    recentPrice: 85000,
    recentDate: "2026-01-28",
    jeonsePrice: 52000,
    jeonseRate: 61,
    area: 84.97,
    transactions: [
      { id: "hg-1", aptName: "힐스테이트 광교중앙역", area: 84.97, floor: 22, price: 85000, dealDate: "2026-01-28", dong: "이의동", jeonsePrice: 52000, buildYear: 2020 },
      { id: "hg-2", aptName: "힐스테이트 광교중앙역", area: 84.97, floor: 15, price: 84000, dealDate: "2025-11-10", dong: "이의동", jeonsePrice: 51000, buildYear: 2020 },
      { id: "hg-3", aptName: "힐스테이트 광교중앙역", area: 84.97, floor: 8, price: 82000, dealDate: "2025-08-22", dong: "이의동", jeonsePrice: 50000, buildYear: 2020 },
      { id: "hg-4", aptName: "힐스테이트 광교중앙역", area: 84.97, floor: 18, price: 80000, dealDate: "2025-05-15", dong: "이의동", jeonsePrice: 49000, buildYear: 2020 },
      { id: "hg-5", aptName: "힐스테이트 광교중앙역", area: 84.97, floor: 12, price: 78000, dealDate: "2025-02-08", dong: "이의동", jeonsePrice: 48000, buildYear: 2020 },
      { id: "hg-6", aptName: "힐스테이트 광교중앙역", area: 84.97, floor: 20, price: 76000, dealDate: "2024-10-30", dong: "이의동", jeonsePrice: 47000, buildYear: 2020 },
      { id: "hg-7", aptName: "힐스테이트 광교중앙역", area: 84.97, floor: 5, price: 74000, dealDate: "2024-07-12", dong: "이의동", jeonsePrice: 46000, buildYear: 2020 },
      { id: "hg-8", aptName: "힐스테이트 광교중앙역", area: 84.97, floor: 10, price: 72000, dealDate: "2024-04-05", dong: "이의동", jeonsePrice: 45000, buildYear: 2020 },
    ],
  },
  {
    aptName: "자이 르네",
    address: "서울 마포구 아현동 756",
    region: "서울",
    recentPrice: 185000,
    recentDate: "2026-03-02",
    jeonsePrice: 95000,
    jeonseRate: 51,
    area: 99.17,
    transactions: [
      { id: "zr-1", aptName: "자이 르네", area: 99.17, floor: 18, price: 185000, dealDate: "2026-03-02", dong: "아현동", jeonsePrice: 95000, buildYear: 2021 },
      { id: "zr-2", aptName: "자이 르네", area: 99.17, floor: 12, price: 183000, dealDate: "2025-12-18", dong: "아현동", jeonsePrice: 93000, buildYear: 2021 },
      { id: "zr-3", aptName: "자이 르네", area: 99.17, floor: 25, price: 182000, dealDate: "2025-09-25", dong: "아현동", jeonsePrice: 92000, buildYear: 2021 },
      { id: "zr-4", aptName: "자이 르네", area: 99.17, floor: 8, price: 178000, dealDate: "2025-06-10", dong: "아현동", jeonsePrice: 90000, buildYear: 2021 },
      { id: "zr-5", aptName: "자이 르네", area: 99.17, floor: 20, price: 175000, dealDate: "2025-03-15", dong: "아현동", jeonsePrice: 88000, buildYear: 2021 },
      { id: "zr-6", aptName: "자이 르네", area: 99.17, floor: 15, price: 172000, dealDate: "2024-12-08", dong: "아현동", jeonsePrice: 86000, buildYear: 2021 },
      { id: "zr-7", aptName: "자이 르네", area: 99.17, floor: 6, price: 168000, dealDate: "2024-08-20", dong: "아현동", jeonsePrice: 84000, buildYear: 2021 },
      { id: "zr-8", aptName: "자이 르네", area: 99.17, floor: 22, price: 165000, dealDate: "2024-05-12", dong: "아현동", jeonsePrice: 82000, buildYear: 2021 },
      { id: "zr-9", aptName: "자이 르네", area: 99.17, floor: 10, price: 163000, dealDate: "2024-03-28", dong: "아현동", buildYear: 2021 },
    ],
  },
  {
    aptName: "e편한세상 시티 일산",
    address: "경기 고양시 일산서구 탄현동 1500",
    region: "경기",
    recentPrice: 48000,
    recentDate: "2026-02-22",
    jeonsePrice: 32000,
    jeonseRate: 67,
    area: 79.64,
    transactions: [
      { id: "ec-1", aptName: "e편한세상 시티 일산", area: 79.64, floor: 15, price: 48000, dealDate: "2026-02-22", dong: "탄현동", jeonsePrice: 32000, buildYear: 2019 },
      { id: "ec-2", aptName: "e편한세상 시티 일산", area: 79.64, floor: 8, price: 47500, dealDate: "2025-11-15", dong: "탄현동", jeonsePrice: 31500, buildYear: 2019 },
      { id: "ec-3", aptName: "e편한세상 시티 일산", area: 79.64, floor: 20, price: 47000, dealDate: "2025-08-10", dong: "탄현동", jeonsePrice: 31000, buildYear: 2019 },
      { id: "ec-4", aptName: "e편한세상 시티 일산", area: 79.64, floor: 12, price: 46500, dealDate: "2025-05-20", dong: "탄현동", jeonsePrice: 30500, buildYear: 2019 },
      { id: "ec-5", aptName: "e편한세상 시티 일산", area: 79.64, floor: 5, price: 46000, dealDate: "2025-02-12", dong: "탄현동", jeonsePrice: 30000, buildYear: 2019 },
      { id: "ec-6", aptName: "e편한세상 시티 일산", area: 79.64, floor: 18, price: 45500, dealDate: "2024-10-18", dong: "탄현동", jeonsePrice: 29500, buildYear: 2019 },
      { id: "ec-7", aptName: "e편한세상 시티 일산", area: 79.64, floor: 10, price: 44500, dealDate: "2024-07-05", dong: "탄현동", jeonsePrice: 29000, buildYear: 2019 },
      { id: "ec-8", aptName: "e편한세상 시티 일산", area: 79.64, floor: 3, price: 44000, dealDate: "2024-04-15", dong: "탄현동", jeonsePrice: 28500, buildYear: 2019 },
    ],
  },
  {
    aptName: "더샵 센트럴파크",
    address: "인천 연수구 송도동 12-8",
    region: "인천",
    recentPrice: 72000,
    recentDate: "2026-01-15",
    jeonsePrice: 40000,
    jeonseRate: 56,
    area: 84.99,
    transactions: [
      { id: "dc-1", aptName: "더샵 센트럴파크", area: 84.99, floor: 30, price: 72000, dealDate: "2026-01-15", dong: "송도동", jeonsePrice: 40000, buildYear: 2017 },
      { id: "dc-2", aptName: "더샵 센트럴파크", area: 84.99, floor: 18, price: 71000, dealDate: "2025-10-22", dong: "송도동", jeonsePrice: 39500, buildYear: 2017 },
      { id: "dc-3", aptName: "더샵 센트럴파크", area: 84.99, floor: 25, price: 70000, dealDate: "2025-07-18", dong: "송도동", jeonsePrice: 39000, buildYear: 2017 },
      { id: "dc-4", aptName: "더샵 센트럴파크", area: 84.99, floor: 10, price: 68000, dealDate: "2025-04-05", dong: "송도동", jeonsePrice: 38000, buildYear: 2017 },
      { id: "dc-5", aptName: "더샵 센트럴파크", area: 84.99, floor: 22, price: 66000, dealDate: "2025-01-20", dong: "송도동", jeonsePrice: 37000, buildYear: 2017 },
      { id: "dc-6", aptName: "더샵 센트럴파크", area: 84.99, floor: 15, price: 64000, dealDate: "2024-09-10", dong: "송도동", jeonsePrice: 36000, buildYear: 2017 },
      { id: "dc-7", aptName: "더샵 센트럴파크", area: 84.99, floor: 8, price: 62000, dealDate: "2024-06-15", dong: "송도동", jeonsePrice: 35500, buildYear: 2017 },
      { id: "dc-8", aptName: "더샵 센트럴파크", area: 84.99, floor: 20, price: 60000, dealDate: "2024-03-22", dong: "송도동", jeonsePrice: 35000, buildYear: 2017 },
      { id: "dc-9", aptName: "더샵 센트럴파크", area: 84.99, floor: 12, price: 58000, dealDate: "2024-03-05", dong: "송도동", buildYear: 2017 },
    ],
  },
  {
    aptName: "아크로리버파크",
    address: "서울 서초구 반포동 1-1",
    region: "서울",
    recentPrice: 420000,
    recentDate: "2026-02-28",
    jeonsePrice: 200000,
    jeonseRate: 48,
    area: 129.96,
    transactions: [
      { id: "ar-1", aptName: "아크로리버파크", area: 129.96, floor: 35, price: 420000, dealDate: "2026-02-28", dong: "반포동", jeonsePrice: 200000, buildYear: 2016 },
      { id: "ar-2", aptName: "아크로리버파크", area: 129.96, floor: 20, price: 415000, dealDate: "2025-11-05", dong: "반포동", jeonsePrice: 195000, buildYear: 2016 },
      { id: "ar-3", aptName: "아크로리버파크", area: 129.96, floor: 28, price: 410000, dealDate: "2025-08-18", dong: "반포동", jeonsePrice: 192000, buildYear: 2016 },
      { id: "ar-4", aptName: "아크로리버파크", area: 129.96, floor: 15, price: 400000, dealDate: "2025-05-10", dong: "반포동", jeonsePrice: 188000, buildYear: 2016 },
      { id: "ar-5", aptName: "아크로리버파크", area: 129.96, floor: 32, price: 395000, dealDate: "2025-02-22", dong: "반포동", jeonsePrice: 185000, buildYear: 2016 },
      { id: "ar-6", aptName: "아크로리버파크", area: 129.96, floor: 10, price: 385000, dealDate: "2024-11-15", dong: "반포동", jeonsePrice: 180000, buildYear: 2016 },
      { id: "ar-7", aptName: "아크로리버파크", area: 129.96, floor: 25, price: 378000, dealDate: "2024-08-08", dong: "반포동", jeonsePrice: 178000, buildYear: 2016 },
      { id: "ar-8", aptName: "아크로리버파크", area: 129.96, floor: 18, price: 370000, dealDate: "2024-05-20", dong: "반포동", jeonsePrice: 175000, buildYear: 2016 },
      { id: "ar-9", aptName: "아크로리버파크", area: 129.96, floor: 30, price: 365000, dealDate: "2024-03-10", dong: "반포동", jeonsePrice: 172000, buildYear: 2016 },
      { id: "ar-10", aptName: "아크로리버파크", area: 129.96, floor: 8, price: 358000, dealDate: "2024-03-02", dong: "반포동", buildYear: 2016 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Real API function - 국토교통부 실거래가 API
// ---------------------------------------------------------------------------

const MOLIT_ENDPOINT =
  "http://openapi.molit.go.kr/OpenAPI_ToolInstallPackage/service/rest/RTMSOBJSvc/getRTMSDataSvcAptTradeDev";

function getApiKey(): string | null {
  return localStorage.getItem("sophia-api-data");
}

/**
 * Parse XML response from 국토교통부 API into ApartmentTransaction[]
 */
function parseMolitXml(
  xmlText: string,
  regionCode: string,
  yearMonth: string,
): ApartmentTransaction[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  const items = doc.querySelectorAll("item");
  const results: ApartmentTransaction[] = [];

  items.forEach((item, index) => {
    const getText = (tag: string): string =>
      item.querySelector(tag)?.textContent?.trim() || "";

    const dealYear = getText("dealYear") || getText("년");
    const dealMonth = (getText("dealMonth") || getText("월")).padStart(2, "0");
    const dealDay = (getText("dealDay") || getText("일")).padStart(2, "0");
    const priceStr = (getText("dealAmount") || getText("거래금액")).replace(/,/g, "");

    results.push({
      id: `${regionCode}-${yearMonth}-${index}`,
      aptName: getText("aptNm") || getText("아파트"),
      area: parseFloat(getText("excluUseAr") || getText("전용면적")) || 0,
      floor: parseInt(getText("floor") || getText("층"), 10) || 0,
      price: parseInt(priceStr, 10) || 0,
      dealDate: `${dealYear}-${dealMonth}-${dealDay}`,
      dong: getText("umdNm") || getText("법정동"),
      buildYear: parseInt(getText("buildYear") || getText("건축년도"), 10) || 0,
    });
  });

  return results;
}

/**
 * Fetch real apartment transactions from 국토교통부 API (direct).
 */
async function realFetchTransactions(
  regionCode: string,
  yearMonth: string,
): Promise<ApartmentTransaction[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No 국토교통부 API key");

  const params = new URLSearchParams({
    serviceKey: apiKey,
    LAWD_CD: regionCode,
    DEAL_YMD: yearMonth,
    pageNo: "1",
    numOfRows: "100",
  });

  const res = await fetch(`${MOLIT_ENDPOINT}?${params.toString()}`);
  if (!res.ok) throw new Error(`국토교통부 API error ${res.status}`);

  const xmlText = await res.text();
  return parseMolitXml(xmlText, regionCode, yearMonth);
}

/**
 * Unified fetch: proxy → direct → empty array.
 * For full mock data, use searchApartments / getAllApartments below.
 */
export async function fetchRealTransactions(
  regionCode: string,
  yearMonth: string,
): Promise<ApartmentTransaction[]> {
  const apiKey = getApiKey();

  // 1. Try Supabase proxy
  try {
    const proxyResult = await proxyFetch<{ xml?: string; data?: ApartmentTransaction[] }>(
      "molit-trade",
      { regionCode, yearMonth, apiKey: apiKey || "" },
    );

    if (proxyResult) {
      // If the proxy returns pre-parsed data
      if (proxyResult.data && Array.isArray(proxyResult.data) && proxyResult.data.length > 0) {
        return proxyResult.data;
      }
      // If the proxy returns raw XML
      if (proxyResult.xml) {
        return parseMolitXml(proxyResult.xml, regionCode, yearMonth);
      }
    }
  } catch (e) {
    console.warn("[fetchRealTransactions] proxy failed:", e);
  }

  // 2. Try direct API
  try {
    if (apiKey) {
      return await realFetchTransactions(regionCode, yearMonth);
    }
  } catch (e) {
    console.warn("국토교통부 API failed:", e);
  }

  // 3. Mock fallback (empty array - callers use searchApartments for mock data)
  return [];
}

// ---------------------------------------------------------------------------
// Mock API functions
// ---------------------------------------------------------------------------

/**
 * Search apartments by name, address, or dong.
 * TODO: Replace with real API call to 국토교통부 실거래가 API
 */
export function searchApartments(query: string): ApartmentSearchResult[] {
  if (!query.trim()) return mockData;

  const q = query.trim().toLowerCase();
  return mockData.filter(
    (apt) =>
      apt.aptName.toLowerCase().includes(q) ||
      apt.address.toLowerCase().includes(q) ||
      apt.transactions.some((t) => t.dong.toLowerCase().includes(q)),
  );
}

/**
 * Get transaction history for a specific apartment.
 * TODO: Replace with real API call to 국토교통부 실거래가 API
 */
export function getTransactionHistory(
  aptName: string,
): ApartmentTransaction[] {
  const apt = mockData.find((a) => a.aptName === aptName);
  if (!apt) return [];
  return [...apt.transactions].sort(
    (a, b) => new Date(b.dealDate).getTime() - new Date(a.dealDate).getTime(),
  );
}

/**
 * Get all mock data (for initial load / no query).
 */
export function getAllApartments(): ApartmentSearchResult[] {
  return mockData;
}

/**
 * Search apartments by region.
 */
export function searchApartmentsByRegion(region: string): ApartmentSearchResult[] {
  return mockData.filter((apt) => apt.region === region);
}

/**
 * Region statistics for the overview cards.
 */
export interface RegionStats {
  region: "서울" | "경기" | "인천";
  avgPrice: number; // 평균가 (만원)
  trendUp: boolean; // 상승 추세
  recentTransactions: number; // 최근 거래 수
}

export function getRegionStats(): RegionStats[] {
  const regions: ("서울" | "경기" | "인천")[] = ["서울", "경기", "인천"];
  return regions.map((region) => {
    const apts = mockData.filter((a) => a.region === region);
    const avgPrice = apts.length > 0
      ? Math.round(apts.reduce((sum, a) => sum + a.recentPrice, 0) / apts.length)
      : 0;
    const totalTx = apts.reduce((sum, a) => sum + a.transactions.length, 0);
    // trend: compare first and last transaction average
    const allTx = apts.flatMap((a) => a.transactions);
    const sorted = [...allTx].sort((a, b) => new Date(a.dealDate).getTime() - new Date(b.dealDate).getTime());
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((s, t) => s + t.price, 0) / firstHalf.length : 0;
    const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((s, t) => s + t.price, 0) / secondHalf.length : 0;
    return {
      region,
      avgPrice,
      trendUp: avgSecond >= avgFirst,
      recentTransactions: totalTx,
    };
  });
}

/**
 * Convert ㎡ to 평 (pyeong).
 */
export function sqmToPyeong(sqm: number): number {
  return Math.round(sqm / 3.3058 * 10) / 10;
}
