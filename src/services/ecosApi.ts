// 한국은행 ECOS API - 소비자물가지수(CPI) 조회

const ECOS_BASE = "https://ecos.bok.or.kr/api/StatisticSearch";
const CPI_STAT_CODE = "901Y009"; // 4.2.1. 소비자물가지수
const CPI_ITEM_CODE = "0"; // 총지수 (2020=100)

function getApiKey(): string | null {
  return localStorage.getItem("sophia-api-ecos");
}

export interface CpiDataPoint {
  month: string; // "YYYY-MM"
  value: number; // 지수값 (2020=100 기준)
  yoyChange: number; // 전년동월 대비 변동률 (%)
}

/**
 * ECOS API에서 소비자물가지수를 가져옵니다.
 * @param startMonth "YYYYMM" 형식
 * @param endMonth "YYYYMM" 형식
 */
export async function fetchCpiData(
  startMonth?: string,
  endMonth?: string,
): Promise<CpiDataPoint[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const now = new Date();
  const end = endMonth || `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  // Default: 2 years back
  const startDate = new Date(now.getFullYear() - 2, now.getMonth(), 1);
  const start = startMonth || `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, "0")}`;

  try {
    const url = `${ECOS_BASE}/${apiKey}/json/kr/1/100/${CPI_STAT_CODE}/M/${start}/${end}/${CPI_ITEM_CODE}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[ecosApi] CPI fetch failed: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const rows = data?.StatisticSearch?.row;
    if (!Array.isArray(rows)) {
      console.warn("[ecosApi] No CPI data rows", data);
      return [];
    }

    return rows.map((row: Record<string, string>) => {
      const time = row.TIME || "";
      const month = `${time.slice(0, 4)}-${time.slice(4, 6)}`;
      return {
        month,
        value: parseFloat(row.DATA_VALUE) || 0,
        yoyChange: parseFloat(row.DATA_VALUE) || 0, // 총지수 값
      };
    });
  } catch (e) {
    console.warn("[ecosApi] fetchCpiData error:", e);
    return [];
  }
}

/**
 * 최근 12개월 평균 물가상승률(%)을 계산합니다.
 * ECOS API 키가 없으면 null 반환 → 호출자가 기본값 3% 사용.
 */
export async function getAnnualCpiRate(): Promise<number | null> {
  const data = await fetchCpiData();
  if (data.length < 13) return null; // 최소 13개월 데이터 필요 (전년 동월 비교)

  // 최신 달의 지수 / 12개월 전 지수 → 연간 변동률
  const latest = data[data.length - 1];
  const yearAgo = data.find((d) => {
    const [ly, lm] = latest.month.split("-").map(Number);
    const targetMonth = `${ly - 1}-${String(lm).padStart(2, "0")}`;
    return d.month === targetMonth;
  });

  if (!yearAgo || yearAgo.value === 0) return null;
  const rate = ((latest.value - yearAgo.value) / yearAgo.value) * 100;
  return Math.round(rate * 10) / 10; // 소수 1자리
}
