import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Loader2, TrendingUp, TrendingDown, Building2,
  MapPin, BarChart3, Clock, ChevronDown, ChevronRight,
  X, Minus, AlertTriangle, ArrowUp, ArrowDown, Activity,
} from "lucide-react";
import {
  searchByRegion, getRegionCodes, sqmToPyeong, fetchRealTransactions,
  type ApartmentSearchResult, type ApartmentTransaction,
} from "../../../services/realEstateApi";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Cell,
} from "recharts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECENT_SEARCH_KEY = "sophia-re-recent-searches";
const MAX_RECENT = 8;

type SortKey = "latest" | "priceHigh" | "priceLow" | "txCount" | "changeUp" | "changeDown";

// ---------------------------------------------------------------------------
// 카테고리 탭 구조
// ---------------------------------------------------------------------------

interface RegionItem {
  label: string;
  code: string;
}

interface RegionCategory {
  id: string;
  label: string;
  regions: RegionItem[];
}

const REGION_CATEGORIES: RegionCategory[] = [
  {
    id: "gangnam",
    label: "강남권",
    regions: [
      { label: "강남", code: "11680" },
      { label: "서초", code: "11650" },
      { label: "송파", code: "11710" },
      { label: "강동", code: "11740" },
    ],
  },
  {
    id: "gangseo",
    label: "강서권",
    regions: [
      { label: "강서", code: "11500" },
      { label: "양천", code: "11470" },
      { label: "영등포", code: "11560" },
      { label: "구로", code: "11530" },
      { label: "금천", code: "11545" },
    ],
  },
  {
    id: "gangbuk",
    label: "강북권",
    regions: [
      { label: "종로", code: "11110" },
      { label: "중구", code: "11140" },
      { label: "용산", code: "11170" },
      { label: "성북", code: "11290" },
      { label: "강북", code: "11305" },
      { label: "도봉", code: "11320" },
      { label: "노원", code: "11350" },
    ],
  },
  {
    id: "dongbu",
    label: "동부권",
    regions: [
      { label: "성동", code: "11200" },
      { label: "광진", code: "11215" },
      { label: "동대문", code: "11230" },
      { label: "중랑", code: "11260" },
      { label: "마포", code: "11440" },
      { label: "서대문", code: "11410" },
      { label: "은평", code: "11380" },
      { label: "동작", code: "11590" },
      { label: "관악", code: "11620" },
    ],
  },
  {
    id: "gyeonggi",
    label: "경기",
    regions: [
      { label: "분당", code: "41135" },
      { label: "수정", code: "41131" },
      { label: "중원", code: "41133" },
      { label: "수지", code: "41463" },
      { label: "기흥", code: "41465" },
      { label: "영통", code: "41117" },
      { label: "하남", code: "41450" },
      { label: "광명", code: "41210" },
      { label: "과천", code: "41290" },
      { label: "일산서", code: "41287" },
      { label: "일산동", code: "41285" },
      { label: "화성", code: "41590" },
    ],
  },
  {
    id: "insights",
    label: "참고사항",
    regions: [], // 분석 전용 탭
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(man: number): string {
  if (!man) return "-";
  if (man >= 10000) {
    const eok = Math.floor(man / 10000);
    const rest = man % 10000;
    return rest > 0 ? `${eok}억 ${rest.toLocaleString()}만` : `${eok}억`;
  }
  return `${man.toLocaleString()}만`;
}

interface RecentSearch {
  code: string;
  label: string;
  count: number;
  lastAt: string;
}

function loadRecentSearches(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecentSearch(code: string, label: string) {
  const list = loadRecentSearches();
  const existing = list.find((r) => r.code === code);
  if (existing) { existing.count++; existing.lastAt = new Date().toISOString(); }
  else { list.unshift({ code, label, count: 1, lastAt: new Date().toISOString() }); }
  list.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

function removeRecentSearch(code: string) {
  const list = loadRecentSearches().filter((r) => r.code !== code);
  localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(list));
}

// ---------------------------------------------------------------------------
// Stats 계산
// ---------------------------------------------------------------------------

interface SearchStats {
  totalTx: number;
  totalApt: number;
  avgPrice: number;
  maxPrice: number;
  minPrice: number;
  maxApt: string;
  minApt: string;
  monthlyAvg: { month: string; avg: number; count: number }[];
  priceDistribution: { range: string; count: number }[];
}

function calcStats(results: ApartmentSearchResult[]): SearchStats {
  const allTx = results.flatMap((r) => r.transactions);
  const prices = allTx.map((t) => t.price).filter((p) => p > 0);
  const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  let maxApt = "", minApt = "";
  results.forEach((r) => {
    if (r.recentPrice === maxPrice) maxApt = r.aptName;
    if (r.recentPrice === minPrice) minApt = r.aptName;
  });
  const monthMap = new Map<string, { sum: number; count: number }>();
  allTx.forEach((tx) => {
    const month = tx.dealDate.substring(0, 7);
    const e = monthMap.get(month) || { sum: 0, count: 0 };
    e.sum += tx.price; e.count++;
    monthMap.set(month, e);
  });
  const monthlyAvg = Array.from(monthMap.entries())
    .map(([month, { sum, count }]) => ({ month, avg: Math.round(sum / count), count }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const ranges = [
    { label: "~3억", min: 0, max: 30000 },
    { label: "3~5억", min: 30000, max: 50000 },
    { label: "5~7억", min: 50000, max: 70000 },
    { label: "7~10억", min: 70000, max: 100000 },
    { label: "10~15억", min: 100000, max: 150000 },
    { label: "15~20억", min: 150000, max: 200000 },
    { label: "20억~", min: 200000, max: Infinity },
  ];
  const priceDistribution = ranges.map((r) => ({
    range: r.label,
    count: prices.filter((p) => p >= r.min && p < r.max).length,
  }));
  return { totalTx: allTx.length, totalApt: results.length, avgPrice, maxPrice, minPrice, maxApt, minApt, monthlyAvg, priceDistribution };
}

// ---------------------------------------------------------------------------
// 이상 변동 감지
// ---------------------------------------------------------------------------

interface AnomalyItem {
  region: string;
  regionCode: string;
  type: "spike" | "drop" | "volume_surge" | "volume_drop";
  description: string;
  severity: "high" | "medium" | "low";
  changePct: number;
  detail: string;
}

// 주요 지역별 데이터를 캐시에서 분석하여 이상 변동 감지
const INSIGHT_REGIONS = [
  { label: "강남구", code: "11680" },
  { label: "서초구", code: "11650" },
  { label: "송파구", code: "11710" },
  { label: "마포구", code: "11440" },
  { label: "용산구", code: "11170" },
  { label: "성동구", code: "11200" },
  { label: "분당구", code: "41135" },
  { label: "하남시", code: "41450" },
  { label: "수지구", code: "41463" },
  { label: "영통구", code: "41117" },
  { label: "과천시", code: "41290" },
  { label: "광명시", code: "41210" },
];

// 지역별 추세 요약
interface RegionTrend {
  region: string;
  regionCode: string;
  latestMonth: string;
  latestAvg: number;
  latestCount: number;
  prevAvg: number;
  prevCount: number;
  thirdAvg: number;
  thirdCount: number;
  priceChangePct: number;   // 전월 대비
  volumeChangePct: number;  // 전월 대비
  trend3m: "up" | "down" | "flat"; // 3개월 추세
}

async function detectAnomalies(): Promise<{ anomalies: AnomalyItem[]; trends: RegionTrend[] }> {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const anomalies: AnomalyItem[] = [];
  const trends: RegionTrend[] = [];

  // 각 지역별로 최근 3개월 데이터 수집
  const regionDataPromises = INSIGHT_REGIONS.map(async (region) => {
    try {
      const monthlyData = await Promise.all(
        months.map((ym) => fetchRealTransactions(region.code, ym))
      );
      return { region, monthlyData, months };
    } catch {
      return null;
    }
  });

  const results = await Promise.allSettled(regionDataPromises);

  for (const result of results) {
    if (result.status !== "fulfilled" || !result.value) continue;
    const { region, monthlyData, months: ms } = result.value;

    // 월별 평균가 계산
    const monthlyAvg: { month: string; avg: number; count: number }[] = [];
    monthlyData.forEach((txs, idx) => {
      const prices = txs.map((t) => t.price).filter((p) => p > 0);
      if (prices.length > 0) {
        monthlyAvg.push({
          month: ms[idx],
          avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
          count: prices.length,
        });
      }
    });

    // 추세 데이터 수집
    if (monthlyAvg.length >= 2) {
      const latest = monthlyAvg[0];
      const prev = monthlyAvg[1];
      const third = monthlyAvg[2] || { avg: 0, count: 0, month: "" };
      const pricePct = prev.avg > 0 ? ((latest.avg - prev.avg) / prev.avg) * 100 : 0;
      const volPct = prev.count > 0 ? ((latest.count - prev.count) / prev.count) * 100 : 0;

      // 3개월 추세 판단
      let trend3m: "up" | "down" | "flat" = "flat";
      if (monthlyAvg.length >= 3 && third.avg > 0) {
        const total3mChange = ((latest.avg - third.avg) / third.avg) * 100;
        if (total3mChange >= 3) trend3m = "up";
        else if (total3mChange <= -3) trend3m = "down";
      } else {
        if (pricePct >= 3) trend3m = "up";
        else if (pricePct <= -3) trend3m = "down";
      }

      trends.push({
        region: region.label,
        regionCode: region.code,
        latestMonth: latest.month,
        latestAvg: latest.avg,
        latestCount: latest.count,
        prevAvg: prev.avg,
        prevCount: prev.count,
        thirdAvg: third.avg,
        thirdCount: third.count,
        priceChangePct: Math.round(pricePct * 10) / 10,
        volumeChangePct: Math.round(volPct),
        trend3m,
      });
    }

    // 최근 달 vs 이전 달 비교 (이상 변동 감지)
    if (monthlyAvg.length >= 2) {
      const latest = monthlyAvg[0]; // 가장 최근
      const prev = monthlyAvg[1]; // 그 이전

      if (latest.avg > 0 && prev.avg > 0) {
        const priceChangePct = ((latest.avg - prev.avg) / prev.avg) * 100;

        // 가격 급등 (10% 이상)
        if (priceChangePct >= 10) {
          anomalies.push({
            region: region.label,
            regionCode: region.code,
            type: "spike",
            description: `${region.label} 평균 매매가 급등`,
            severity: priceChangePct >= 20 ? "high" : "medium",
            changePct: Math.round(priceChangePct * 10) / 10,
            detail: `전월 대비 +${priceChangePct.toFixed(1)}% 상승 (${formatPrice(prev.avg)} → ${formatPrice(latest.avg)}). 거래 ${latest.count}건 기준.`,
          });
        }

        // 가격 급락 (-10% 이하)
        if (priceChangePct <= -10) {
          anomalies.push({
            region: region.label,
            regionCode: region.code,
            type: "drop",
            description: `${region.label} 평균 매매가 급락`,
            severity: priceChangePct <= -20 ? "high" : "medium",
            changePct: Math.round(priceChangePct * 10) / 10,
            detail: `전월 대비 ${priceChangePct.toFixed(1)}% 하락 (${formatPrice(prev.avg)} → ${formatPrice(latest.avg)}). 거래 ${latest.count}건 기준.`,
          });
        }

        // 완만한 변동 (5~10%)
        if (priceChangePct >= 5 && priceChangePct < 10) {
          anomalies.push({
            region: region.label,
            regionCode: region.code,
            type: "spike",
            description: `${region.label} 상승 추세`,
            severity: "low",
            changePct: Math.round(priceChangePct * 10) / 10,
            detail: `전월 대비 +${priceChangePct.toFixed(1)}% 상승. ${formatPrice(prev.avg)} → ${formatPrice(latest.avg)}`,
          });
        }
        if (priceChangePct <= -5 && priceChangePct > -10) {
          anomalies.push({
            region: region.label,
            regionCode: region.code,
            type: "drop",
            description: `${region.label} 하락 추세`,
            severity: "low",
            changePct: Math.round(priceChangePct * 10) / 10,
            detail: `전월 대비 ${priceChangePct.toFixed(1)}% 하락. ${formatPrice(prev.avg)} → ${formatPrice(latest.avg)}`,
          });
        }
      }

      // 거래량 급변
      if (latest.count > 0 && prev.count > 0) {
        const volChangePct = ((latest.count - prev.count) / prev.count) * 100;
        if (volChangePct >= 50) {
          anomalies.push({
            region: region.label,
            regionCode: region.code,
            type: "volume_surge",
            description: `${region.label} 거래량 급증`,
            severity: volChangePct >= 100 ? "high" : "medium",
            changePct: Math.round(volChangePct),
            detail: `거래량 전월 대비 +${Math.round(volChangePct)}% (${prev.count}건 → ${latest.count}건). 시장 관심 증가 신호.`,
          });
        }
        if (volChangePct <= -50) {
          anomalies.push({
            region: region.label,
            regionCode: region.code,
            type: "volume_drop",
            description: `${region.label} 거래량 급감`,
            severity: volChangePct <= -70 ? "high" : "medium",
            changePct: Math.round(volChangePct),
            detail: `거래량 전월 대비 ${Math.round(volChangePct)}% (${prev.count}건 → ${latest.count}건). 관망세 심화 가능성.`,
          });
        }
      }
    }
  }

  // severity 순 정렬
  const order = { high: 0, medium: 1, low: 2 };
  anomalies.sort((a, b) => order[a.severity] - order[b.severity]);

  // trends: 거래량 많은 순
  trends.sort((a, b) => b.latestCount - a.latestCount);

  return { anomalies, trends };
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

const StatCard = ({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string;
}) => (
  <div className="bg-card rounded-xl p-3 border border-border/50">
    <div className="flex items-center gap-1.5 mb-1">
      <div className={color}>{icon}</div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
    <p className="text-sm font-bold font-mono">{value}</p>
    {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
  </div>
);

// ---------------------------------------------------------------------------
// Anomaly Card
// ---------------------------------------------------------------------------

const anomalyConfig = {
  spike: { icon: ArrowUp, color: "text-red-500", bg: "bg-red-500/10 dark:bg-red-500/15 border-red-500/20", label: "가격 상승" },
  drop: { icon: ArrowDown, color: "text-blue-500", bg: "bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/20", label: "가격 하락" },
  volume_surge: { icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20", label: "거래량 급증" },
  volume_drop: { icon: TrendingDown, color: "text-purple-500", bg: "bg-purple-500/10 dark:bg-purple-500/15 border-purple-500/20", label: "거래량 급감" },
};

const severityConfig = {
  high: { label: "주의", className: "bg-red-500/15 text-red-500 dark:text-red-400" },
  medium: { label: "관심", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  low: { label: "참고", className: "bg-muted text-muted-foreground" },
};

const AnomalyCard = ({ item, onRegionClick }: { item: AnomalyItem; onRegionClick: (code: string, label: string) => void }) => {
  const config = anomalyConfig[item.type];
  const sev = severityConfig[item.severity];
  const Icon = config.icon;

  return (
    <div className={`rounded-xl p-3.5 border ${config.bg} transition-colors`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div className={`mt-0.5 ${config.color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold">{item.description}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${sev.className}`}>
                {sev.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.detail}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-sm font-bold font-mono ${config.color}`}>
            {item.changePct > 0 ? "+" : ""}{item.changePct}%
          </span>
          <button
            onClick={() => onRegionClick(item.regionCode, item.region)}
            className="text-[10px] text-primary hover:text-primary/80 transition-colors"
          >
            상세 보기
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const RealEstateSearch = () => {
  const [regionCode, setRegionCode] = useState("");
  const [results, setResults] = useState<ApartmentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("latest");
  const [showChart, setShowChart] = useState(true);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(loadRecentSearches());
  const [searchLabel, setSearchLabel] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // 카테고리 탭
  const [activeCategory, setActiveCategory] = useState("gangnam");

  // 참고사항 (이상 변동 + 추세 분석) 상태
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [regionTrends, setRegionTrends] = useState<RegionTrend[]>([]);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [anomalyLoaded, setAnomalyLoaded] = useState(false);

  const regionCodes = getRegionCodes();

  const handleSearch = useCallback(async (code?: string, label?: string) => {
    const targetCode = code || regionCode;
    if (!targetCode) return;
    const targetLabel = label || regionCodes.find((r) => r.code === targetCode)?.label || targetCode;
    setRegionCode(targetCode);
    setSearchLabel(targetLabel);
    setLoading(true);
    setSearched(true);
    setPage(1);
    // insights 탭에서 상세보기 클릭 시 카테고리 전환 안 함
    try {
      const data = await searchByRegion(targetCode);
      setResults(data);
      saveRecentSearch(targetCode, targetLabel);
      setRecentSearches(loadRecentSearches());
    } catch (e) {
      console.warn("실거래가 검색 실패:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [regionCode, regionCodes]);

  // 참고사항 탭 진입 시 분석 로드
  const loadAnomalies = useCallback(async () => {
    if (anomalyLoaded) return;
    setAnomalyLoading(true);
    try {
      const result = await detectAnomalies();
      setAnomalies(result.anomalies);
      setRegionTrends(result.trends);
      setAnomalyLoaded(true);
    } catch (e) {
      console.warn("이상 변동 감지 실패:", e);
    } finally {
      setAnomalyLoading(false);
    }
  }, [anomalyLoaded]);

  const handleCategoryChange = (catId: string) => {
    setActiveCategory(catId);
    if (catId === "insights") {
      loadAnomalies();
    }
  };

  const handleAnomalyRegionClick = (code: string, label: string) => {
    setActiveCategory("gangnam"); // 임시로 첫 탭
    handleSearch(code, label);
  };

  const stats = useMemo(() => (results.length > 0 ? calcStats(results) : null), [results]);

  // 아파트별 가격 변동률 계산
  const calcChangePct = useCallback((apt: ApartmentSearchResult): number => {
    const txSorted = [...apt.transactions].sort((a, b) => a.dealDate.localeCompare(b.dealDate));
    if (txSorted.length < 2) return 0;
    const first = txSorted[0].price;
    const last = txSorted[txSorted.length - 1].price;
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }, []);

  const sortedResults = useMemo(() => {
    const list = [...results];
    switch (sortKey) {
      case "latest": return list.sort((a, b) => b.recentDate.localeCompare(a.recentDate));
      case "priceHigh": return list.sort((a, b) => b.recentPrice - a.recentPrice);
      case "priceLow": return list.sort((a, b) => a.recentPrice - b.recentPrice);
      case "txCount": return list.sort((a, b) => b.transactions.length - a.transactions.length);
      case "changeUp": return list.sort((a, b) => calcChangePct(b) - calcChangePct(a));
      case "changeDown": return list.sort((a, b) => calcChangePct(a) - calcChangePct(b));
    }
  }, [results, sortKey, calcChangePct]);

  const totalPages = Math.ceil(sortedResults.length / PAGE_SIZE);
  const pagedResults = sortedResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const trendDirection = useMemo(() => {
    if (!stats || stats.monthlyAvg.length < 2) return null;
    const last = stats.monthlyAvg[stats.monthlyAvg.length - 1].avg;
    const prev = stats.monthlyAvg[stats.monthlyAvg.length - 2].avg;
    const diff = last - prev;
    const pct = prev > 0 ? ((diff / prev) * 100).toFixed(1) : "0";
    return { diff, pct, up: diff > 0 };
  }, [stats]);

  const handleRemoveRecent = (code: string) => {
    removeRecentSearch(code);
    setRecentSearches(loadRecentSearches());
  };

  const activeCat = REGION_CATEGORIES.find((c) => c.id === activeCategory);
  const isInsightsTab = activeCategory === "insights";

  return (
    <div className="space-y-4">
      {/* 검색 영역 */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">실거래가 검색</h3>
          <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">국토교통부 공공데이터</span>
        </div>

        {/* 드롭다운 검색 */}
        <div className="flex gap-2 mb-3">
          <select
            value={regionCode}
            onChange={(e) => setRegionCode(e.target.value)}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">지역 선택</option>
            {regionCodes.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={() => handleSearch()}
            disabled={!regionCode || loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            검색
          </button>
        </div>

        {/* 카테고리 탭 */}
        <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5 overflow-x-auto">
          {REGION_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`relative px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors flex-shrink-0 ${
                activeCategory === cat.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {activeCategory === cat.id && (
                <motion.div
                  layoutId="re-search-cat-tab"
                  className="absolute inset-0 bg-card rounded-md shadow-sm"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1">
                {cat.id === "insights" && <Activity className="h-3 w-3" />}
                {cat.label}
              </span>
            </button>
          ))}
        </div>

        {/* 카테고리별 지역 버튼 */}
        {!isInsightsTab && activeCat && activeCat.regions.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {activeCat.regions.map((r) => (
              <button
                key={r.code}
                onClick={() => handleSearch(r.code, r.label)}
                disabled={loading}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  regionCode === r.code && searched
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent"
                }`}
              >
                <MapPin className="h-2.5 w-2.5 inline mr-0.5" />
                {r.label}
              </button>
            ))}
          </div>
        )}

        {!localStorage.getItem("sophia-api-data") && (
          <p className="text-[10px] text-amber-500 mt-2">{"설정 > 공공데이터포털 API 키를 입력해주세요"}</p>
        )}
      </div>

      {/* 참고사항 (이상 변동 분석) 탭 */}
      {isInsightsTab && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold">시장 이상 변동 감지</h3>
            <span className="text-[10px] text-muted-foreground">최근 3개월 기준</span>
          </div>
          <p className="text-xs text-muted-foreground">
            주요 12개 지역의 최근 실거래 데이터를 분석하여 가격 급등/급락, 거래량 이상 변동을 자동으로 감지합니다.
          </p>

          {anomalyLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">12개 지역 분석 중... (최대 1분 소요)</span>
            </div>
          )}

          {anomalyLoaded && anomalies.length === 0 && !anomalyLoading && (
            <div className="text-center py-10">
              <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">현재 특이 변동이 감지되지 않았습니다</p>
              <p className="text-xs text-muted-foreground/60 mt-1">모든 주요 지역이 안정적인 추세를 보이고 있습니다</p>
            </div>
          )}

          {anomalies.length > 0 && (
            <div className="space-y-2">
              {/* 요약 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                <div className="bg-card rounded-lg p-2.5 border border-border/50 text-center">
                  <p className="text-[10px] text-muted-foreground">총 감지</p>
                  <p className="text-lg font-bold font-mono">{anomalies.length}</p>
                </div>
                <div className="bg-red-500/5 rounded-lg p-2.5 border border-red-500/10 text-center">
                  <p className="text-[10px] text-red-500">가격 상승</p>
                  <p className="text-lg font-bold font-mono text-red-500">
                    {anomalies.filter((a) => a.type === "spike").length}
                  </p>
                </div>
                <div className="bg-blue-500/5 rounded-lg p-2.5 border border-blue-500/10 text-center">
                  <p className="text-[10px] text-blue-500">가격 하락</p>
                  <p className="text-lg font-bold font-mono text-blue-500">
                    {anomalies.filter((a) => a.type === "drop").length}
                  </p>
                </div>
                <div className="bg-amber-500/5 rounded-lg p-2.5 border border-amber-500/10 text-center">
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">거래량 변동</p>
                  <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                    {anomalies.filter((a) => a.type === "volume_surge" || a.type === "volume_drop").length}
                  </p>
                </div>
              </div>

              {/* 개별 카드 */}
              {anomalies.map((item, i) => (
                <motion.div
                  key={`${item.regionCode}-${item.type}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <AnomalyCard item={item} onRegionClick={handleAnomalyRegionClick} />
                </motion.div>
              ))}

              <p className="text-[10px] text-muted-foreground/50 text-center pt-2">
                * 이상 변동 기준: 가격 5% 이상 변동, 거래량 50% 이상 변동
              </p>
            </div>
          )}

          {/* 지역별 추세 분석 테이블 */}
          {regionTrends.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold">지역별 추세 분석</h3>
                <span className="text-[10px] text-muted-foreground">최근 3개월</span>
              </div>
              <p className="text-xs text-muted-foreground">
                12개 주요 지역의 평균 매매가와 거래량 변동을 한눈에 비교합니다.
              </p>
              <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                {/* 테이블 헤더 */}
                <div className="grid grid-cols-[1fr_80px_60px_60px_56px] gap-1 px-3 py-2 bg-muted/50 border-b border-border/50 text-[10px] font-medium text-muted-foreground">
                  <span>지역</span>
                  <span className="text-right">평균가</span>
                  <span className="text-right">가격변동</span>
                  <span className="text-right">거래량</span>
                  <span className="text-center">3개월</span>
                </div>
                {/* 테이블 행 */}
                {regionTrends.map((t) => {
                  const trendIcon = t.trend3m === "up" ? "text-red-500" : t.trend3m === "down" ? "text-blue-500" : "text-muted-foreground";
                  const trendLabel = t.trend3m === "up" ? "상승" : t.trend3m === "down" ? "하락" : "보합";
                  return (
                    <button
                      key={t.regionCode}
                      onClick={() => handleAnomalyRegionClick(t.regionCode, t.region)}
                      className="grid grid-cols-[1fr_80px_60px_60px_56px] gap-1 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0 items-center"
                    >
                      <span className="text-xs font-medium">{t.region}</span>
                      <span className="text-xs font-mono text-right">{formatPrice(t.latestAvg)}</span>
                      <span className={`text-[11px] font-mono text-right font-medium ${t.priceChangePct > 0 ? "text-red-500" : t.priceChangePct < 0 ? "text-blue-500" : "text-muted-foreground"}`}>
                        {t.priceChangePct > 0 ? "+" : ""}{t.priceChangePct}%
                      </span>
                      <span className="text-xs text-muted-foreground text-right font-mono">
                        {t.latestCount}건
                        {t.volumeChangePct !== 0 && (
                          <span className={`text-[9px] ml-0.5 ${t.volumeChangePct > 0 ? "text-amber-500" : "text-purple-500"}`}>
                            {t.volumeChangePct > 0 ? "+" : ""}{t.volumeChangePct}%
                          </span>
                        )}
                      </span>
                      <span className={`text-[10px] text-center font-medium flex items-center justify-center gap-0.5 ${trendIcon}`}>
                        {t.trend3m === "up" && <TrendingUp className="h-3 w-3" />}
                        {t.trend3m === "down" && <TrendingDown className="h-3 w-3" />}
                        {t.trend3m === "flat" && <Minus className="h-3 w-3" />}
                        {trendLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground/50 text-center">
                * 지역명 클릭 시 해당 지역 실거래 상세 조회 | 3개월 추세: ±3% 이상 변동 시 상승/하락 판정
              </p>
            </div>
          )}
        </div>
      )}

      {/* 최근 검색 기록 (검색 전 + 비 insights 탭) */}
      {!searched && !isInsightsTab && recentSearches.length > 0 && (
        <div className="bg-card rounded-xl p-4 border border-border/50">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">최근 검색</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recentSearches.map((r) => (
              <div key={r.code} className="group flex items-center gap-1 bg-muted/50 rounded-lg pr-1">
                <button
                  onClick={() => handleSearch(r.code, r.label)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-foreground hover:text-primary transition-colors"
                >
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  {r.label}
                  {r.count > 1 && (
                    <span className="text-[9px] text-muted-foreground font-mono">({r.count})</span>
                  )}
                </button>
                <button
                  onClick={() => handleRemoveRecent(r.code)}
                  className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 로딩 */}
      {loading && !isInsightsTab && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">최근 6개월 실거래 조회 중...</span>
        </div>
      )}

      {/* 검색 결과 없음 */}
      {searched && !loading && results.length === 0 && !isInsightsTab && (
        <p className="text-center text-sm text-muted-foreground py-10">해당 지역의 실거래 데이터가 없습니다</p>
      )}

      {/* 통계 + 결과 */}
      {!loading && results.length > 0 && stats && !isInsightsTab && (
        <>
          {/* 결과 헤더 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">{searchLabel} 실거래</h3>
              <span className="text-xs text-muted-foreground font-mono">최근 6개월</span>
            </div>
            {trendDirection && (
              <div className={`flex items-center gap-1 text-xs font-medium ${trendDirection.up ? "text-red-500" : "text-blue-500"}`}>
                {trendDirection.up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                전월 대비 {trendDirection.up ? "+" : ""}{trendDirection.pct}%
              </div>
            )}
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="총 거래" value={`${stats.totalTx}건`} sub={`${stats.totalApt}개 아파트`}
              icon={<BarChart3 className="h-3.5 w-3.5" />} color="text-primary" />
            <StatCard label="평균가" value={formatPrice(stats.avgPrice)}
              icon={<Minus className="h-3.5 w-3.5" />} color="text-muted-foreground" />
            <StatCard label="최고가" value={formatPrice(stats.maxPrice)} sub={stats.maxApt}
              icon={<TrendingUp className="h-3.5 w-3.5" />} color="text-red-500" />
            <StatCard label="최저가" value={formatPrice(stats.minPrice)} sub={stats.minApt}
              icon={<TrendingDown className="h-3.5 w-3.5" />} color="text-blue-500" />
          </div>

          {/* 차트 토글 */}
          <button onClick={() => setShowChart(!showChart)}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
            <BarChart3 className="h-3.5 w-3.5" />
            {showChart ? "차트 접기" : "차트 보기"}
          </button>

          {/* 차트 영역 */}
          <AnimatePresence>
            {showChart && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stats.monthlyAvg.length > 1 && (
                    <div className="bg-card rounded-xl p-4 border border-border/50">
                      <h4 className="text-xs font-bold mb-3">월별 평균 가격 추이</h4>
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={stats.monthlyAvg}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              tickFormatter={(v) => v.substring(5)} />
                            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}억` : `${v}`} width={45} />
                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                              formatter={(value: number) => [formatPrice(value), "평균가"]} labelFormatter={(label) => `${label}`} />
                            <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2}
                              dot={{ fill: "hsl(var(--primary))", r: 3 }} activeDot={{ r: 5 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  <div className="bg-card rounded-xl p-4 border border-border/50">
                    <h4 className="text-xs font-bold mb-3">가격대별 거래 분포</h4>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.priceDistribution.filter((d) => d.count > 0)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="range" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={30} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            formatter={(value: number) => [`${value}건`, "거래"]} />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {stats.priceDistribution.filter((d) => d.count > 0).map((_, idx) => (
                              <Cell key={idx} fill={`hsl(var(--primary) / ${0.3 + (idx * 0.1)})`} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 아파트별 실거래 정보 섹션 */}
          <div className="mt-2 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-bold">아파트별 실거래 정보</h3>
                <span className="text-[10px] text-muted-foreground font-mono">{results.length}개 아파트</span>
              </div>
              <div className="flex flex-wrap items-center gap-1 bg-muted rounded-lg p-0.5">
                {([
                  { key: "latest", label: "최신순" },
                  { key: "priceHigh", label: "고가순" },
                  { key: "priceLow", label: "저가순" },
                  { key: "txCount", label: "거래많은순" },
                  { key: "changeUp", label: "상승률순" },
                  { key: "changeDown", label: "하락률순" },
                ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                  <button key={key} onClick={() => { setSortKey(key); setPage(1); }}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                      sortKey === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 페이지 정보 */}
            {totalPages > 1 && (
              <p className="text-[10px] text-muted-foreground mb-2">
                {(page - 1) * PAGE_SIZE + 1}~{Math.min(page * PAGE_SIZE, sortedResults.length)}개 표시 / 총 {sortedResults.length}개
              </p>
            )}
          </div>

          {/* 결과 리스트 (페이징) */}
          <div className="space-y-2">
            {pagedResults.map((apt, i) => {
              const isExpanded = expanded === apt.aptName;
              const txSorted = [...apt.transactions].sort((a, b) => a.dealDate.localeCompare(b.dealDate));
              const priceChange = txSorted.length >= 2 ? txSorted[txSorted.length - 1].price - txSorted[0].price : 0;
              const firstPrice = txSorted.length >= 2 ? txSorted[0].price : 0;
              const changePct = firstPrice > 0 ? ((priceChange / firstPrice) * 100) : 0;
              return (
                <motion.div key={apt.aptName}
                  className="bg-card rounded-xl overflow-hidden border border-border/30 hover:border-border/60 transition-colors"
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                  <button onClick={() => setExpanded(isExpanded ? null : apt.aptName)}
                    className="w-full text-left px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                        <div className="min-w-0">
                          <span className="text-sm font-bold">{apt.aptName}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">{apt.address}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-bold">{formatPrice(apt.recentPrice)}</span>
                          {priceChange !== 0 && (
                            <span className={`text-[10px] font-mono ${priceChange > 0 ? "text-red-500" : "text-blue-500"}`}>
                              {changePct > 0 ? "+" : ""}{changePct.toFixed(1)}%
                              <span className="text-[9px] ml-0.5 opacity-70">({priceChange > 0 ? "+" : ""}{formatPrice(Math.abs(priceChange))})</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{sqmToPyeong(apt.area)}평</span>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground ml-5">
                      <span>최근: {apt.recentDate}</span>
                      <span>거래 {apt.transactions.length}건</span>
                      {apt.jeonseRate > 0 && <span>전세가율 {apt.jeonseRate}%</span>}
                    </div>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-3 space-y-2 border-t border-border pt-2">
                          {apt.transactions.length >= 2 && (
                            <div className="h-24 mb-2">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={txSorted}>
                                  <XAxis dataKey="dealDate" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                                    tickFormatter={(v) => v.substring(5)} />
                                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                                    tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}억` : `${v}`} width={35} />
                                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                                    formatter={(value: number) => [formatPrice(value), "거래가"]} />
                                  <Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={1.5}
                                    dot={{ fill: "hsl(var(--primary))", r: 2.5 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground font-mono">거래 내역</p>
                          {apt.transactions.slice(0, 15).map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between text-xs py-1 border-b border-border/20 last:border-0">
                              <div className="flex gap-2 text-muted-foreground">
                                <span className="font-mono w-20">{tx.dealDate}</span>
                                <span className="w-12">{tx.dong}</span>
                                <span className="w-10 text-right">{sqmToPyeong(tx.area)}평</span>
                                <span className="w-8 text-right">{tx.floor}층</span>
                              </div>
                              <span className="font-mono font-bold">{formatPrice(tx.price)}</span>
                            </div>
                          ))}
                          {apt.transactions.length > 15 && (
                            <p className="text-[10px] text-muted-foreground text-center pt-1">
                              +{apt.transactions.length - 15}건 더
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {/* 페이징 컨트롤 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                이전
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "..." ? (
                    <span key={`dot-${idx}`} className="px-1 text-xs text-muted-foreground">...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                        page === p
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RealEstateSearch;
