// 국토교통부 실거래가 API + Supabase Edge Function proxy
import { proxyFetch } from "./proxyFetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApartmentTransaction {
  id: string;
  aptName: string;
  area: number; // 전용면적 (㎡)
  floor: number;
  price: number; // 거래금액 (만원)
  dealDate: string; // YYYY-MM-DD
  dong: string; // 법정동
  jeonsePrice?: number;
  buildYear: number;
}

export interface ApartmentSearchResult {
  aptName: string;
  address: string;
  recentPrice: number;
  recentDate: string;
  jeonsePrice: number;
  jeonseRate: number;
  area: number;
  transactions: ApartmentTransaction[];
}

export interface RegionStats {
  region: string;
  avgPrice: number;
  trendUp: boolean;
  recentTransactions: number;
}

// ---------------------------------------------------------------------------
// 국토교통부 API
// ---------------------------------------------------------------------------

const MOLIT_ENDPOINT =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";

function getApiKey(): string | null {
  return localStorage.getItem("sophia-api-data");
}

function parseMolitXml(xmlText: string, regionCode: string, yearMonth: string): ApartmentTransaction[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const items = doc.querySelectorAll("item");
  const results: ApartmentTransaction[] = [];

  items.forEach((item, index) => {
    const getText = (tag: string): string => item.querySelector(tag)?.textContent?.trim() || "";
    const dealYear = getText("dealYear") || getText("년");
    const dealMonth = (getText("dealMonth") || getText("월")).padStart(2, "0");
    const dealDay = (getText("dealDay") || getText("일")).padStart(2, "0");
    const priceStr = (getText("dealAmount") || getText("거래금액")).replace(/,/g, "").trim();

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

// ---------------------------------------------------------------------------
// Fetch transactions (proxy → direct → empty)
// ---------------------------------------------------------------------------

export async function fetchRealTransactions(
  regionCode: string,
  yearMonth: string,
): Promise<ApartmentTransaction[]> {
  const apiKey = getApiKey();

  // 1. Supabase Edge Function proxy
  try {
    const proxyResult = await proxyFetch<{ xml?: string; data?: ApartmentTransaction[] }>(
      "molit-trade",
      { regionCode, yearMonth, apiKey: apiKey || "" },
    );
    if (proxyResult) {
      if (proxyResult.data && Array.isArray(proxyResult.data) && proxyResult.data.length > 0) {
        return proxyResult.data;
      }
      if (proxyResult.xml) {
        return parseMolitXml(proxyResult.xml, regionCode, yearMonth);
      }
    }
  } catch (e) {
    console.warn("[realEstateApi] proxy failed:", e);
  }

  // 2. Direct API call
  try {
    if (apiKey) {
      const params = new URLSearchParams({
        serviceKey: apiKey,
        LAWD_CD: regionCode,
        DEAL_YMD: yearMonth,
        pageNo: "1",
        numOfRows: "100",
      });
      const res = await fetch(`${MOLIT_ENDPOINT}?${params.toString()}`);
      if (res.ok) {
        const xmlText = await res.text();
        return parseMolitXml(xmlText, regionCode, yearMonth);
      }
    }
  } catch (e) {
    console.warn("[realEstateApi] direct API failed:", e);
  }

  return [];
}

// ---------------------------------------------------------------------------
// Search by apartment name (국토교통부 데이터 기반)
// ---------------------------------------------------------------------------

// 주요 법정동 코드 매핑 (검색용)
const REGION_CODES: Record<string, string> = {
  "서울 강남구": "11680", "서울 서초구": "11650", "서울 송파구": "11710",
  "서울 마포구": "11440", "서울 용산구": "11170", "서울 성동구": "11200",
  "서울 강서구": "11500", "서울 영등포구": "11560", "서울 노원구": "11350",
  "경기 성남시 분당구": "41135", "경기 성남시 수정구": "41131",
  "경기 용인시 수지구": "41463", "경기 용인시 기흥구": "41465",
  "경기 수원시 영통구": "41117", "경기 수원시 팔달구": "41113",
  "경기 고양시 일산서구": "41287", "경기 고양시 일산동구": "41285",
  "경기 하남시": "41450", "경기 광명시": "41210",
  "인천 연수구": "28185", "인천 남동구": "28200",
};

/**
 * 지역 코드 + 최근 6개월 실거래 데이터를 가져와서 아파트별로 그룹핑
 */
export async function searchByRegion(regionCode: string): Promise<ApartmentSearchResult[]> {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // Fetch last 6 months in parallel
  const allTransactions: ApartmentTransaction[] = [];
  const results = await Promise.allSettled(
    months.map((ym) => fetchRealTransactions(regionCode, ym))
  );
  results.forEach((r) => {
    if (r.status === "fulfilled") allTransactions.push(...r.value);
  });

  if (allTransactions.length === 0) return [];

  // Group by apartment name
  const grouped = new Map<string, ApartmentTransaction[]>();
  allTransactions.forEach((tx) => {
    const key = tx.aptName;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(tx);
  });

  // Convert to search results
  const searchResults: ApartmentSearchResult[] = [];
  grouped.forEach((txs, aptName) => {
    const sorted = [...txs].sort((a, b) => b.dealDate.localeCompare(a.dealDate));
    const recent = sorted[0];
    const avgArea = txs.reduce((s, t) => s + t.area, 0) / txs.length;

    // 전세가율: 전세가가 있는 거래의 평균
    const jeonseTxs = txs.filter((t) => t.jeonsePrice && t.jeonsePrice > 0);
    const avgJeonse = jeonseTxs.length > 0
      ? Math.round(jeonseTxs.reduce((s, t) => s + (t.jeonsePrice || 0), 0) / jeonseTxs.length)
      : 0;
    const jeonseRate = recent.price > 0 && avgJeonse > 0
      ? Math.round((avgJeonse / recent.price) * 100)
      : 0;

    searchResults.push({
      aptName,
      address: `${recent.dong}`,
      recentPrice: recent.price,
      recentDate: recent.dealDate,
      jeonsePrice: avgJeonse,
      jeonseRate,
      area: Math.round(avgArea * 100) / 100,
      transactions: sorted,
    });
  });

  // Sort by recent date
  return searchResults.sort((a, b) => b.recentDate.localeCompare(a.recentDate));
}

/**
 * 아파트 이름으로 검색 (전 지역 대상은 불가, 특정 지역 코드 필요)
 */
export async function searchApartments(query: string, regionCode?: string): Promise<ApartmentSearchResult[]> {
  if (!query.trim() && !regionCode) return [];

  // 지역 코드가 주어지면 해당 지역에서 검색
  const code = regionCode || Object.values(REGION_CODES)[0];
  const results = await searchByRegion(code);

  if (!query.trim()) return results;

  const q = query.trim().toLowerCase();
  return results.filter(
    (apt) =>
      apt.aptName.toLowerCase().includes(q) ||
      apt.address.toLowerCase().includes(q)
  );
}

/**
 * 지역 코드 목록 반환
 */
export function getRegionCodes(): { label: string; code: string }[] {
  return Object.entries(REGION_CODES).map(([label, code]) => ({ label, code }));
}

/**
 * ㎡ → 평 변환
 */
export function sqmToPyeong(sqm: number): number {
  return Math.round(sqm / 3.3058 * 10) / 10;
}

// ---------------------------------------------------------------------------
// Legacy compat (기존 컴포넌트 호환용 - mock 없이 빈 데이터 반환)
// ---------------------------------------------------------------------------

export function getAllApartments(): ApartmentSearchResult[] {
  return []; // API 키 설정 후 실거래가 검색 사용
}

export function searchApartmentsByRegion(_region: string): ApartmentSearchResult[] {
  return []; // searchByRegion(regionCode) 사용
}

export function getTransactionHistory(_aptName: string): ApartmentTransaction[] {
  return []; // searchByRegion 결과에서 transactions 사용
}

export function getRegionStats(): RegionStats[] {
  return []; // API 연동 후 동적 계산
}
