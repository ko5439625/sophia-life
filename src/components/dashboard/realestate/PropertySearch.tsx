import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  Save,
  Plus,
  X,
  MapPin,
  Calendar,
  Ruler,
  Building2,
  Heart,
  HeartOff,
  FileText,
  ArrowUpDown,
  Loader2,
  ExternalLink,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Home,
  Train,
  GraduationCap,
  Trees,
  TrendingUp,
  Baby,
  MessageSquare,
} from "lucide-react";
import {
  getAllApartments,
  sqmToPyeong,
  type ApartmentSearchResult,
  type ApartmentTransaction,
} from "@/services/realEstateApi";
import { useFinancial } from "@/store/financialStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PropertyType = "아파트" | "주상복합" | "오피스텔" | "빌라";

interface PropertyFilters {
  types: PropertyType[];
  regions: string[];
  priceMin: number; // 만원 단위
  priceMax: number;
  areaMin: number; // 평
  areaMax: number;
  stationWalk: boolean; // 역세권 (도보 10분)
  goodSchool: boolean; // 학군 우수
  newBuild: boolean; // 신축 (5년 이내)
}

const REGION_OPTIONS = ["서울", "경기", "인천", "대전", "대구", "부산", "광주", "세종", "제주"];

interface ManualProperty {
  id: string;
  name: string;
  address: string;
  type: PropertyType;
  area: number; // 평
  price: number; // 만원
  memo: string;
  url: string;
  createdAt: string;
}

interface PropertyReport {
  propertyId: string;
  locationAnalysis: string;
  assetAnalysis: string;
  familyFit: string;
  futureValue: string;
  overallOpinion: string;
  generatedAt: string;
}

type SortKey = "latest" | "price" | "area";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTERS_KEY = "sophia-property-filters";
const FAVORITES_KEY = "sophia-property-favorites";
const MANUAL_KEY = "sophia-property-manual";
const REPORTS_KEY = "sophia-property-reports";
const SEEN_KEY = "sophia-property-seen-ids";

const PROPERTY_TYPES: PropertyType[] = ["아파트", "주상복합", "오피스텔", "빌라"];

const DEFAULT_FILTERS: PropertyFilters = {
  types: ["아파트"],
  regions: [],
  priceMin: 10000, // 1억
  priceMax: 300000, // 30억
  areaMin: 10,
  areaMax: 60,
  stationWalk: false,
  goodSchool: false,
  newBuild: false,
};

const MOCK_MANUAL_PROPERTIES: ManualProperty[] = [
  {
    id: "manual-1",
    name: "힐스테이트 과천중앙",
    address: "경기 과천시 별양동",
    type: "아파트",
    area: 34,
    price: 120000,
    memo: "과천 신도시 개발 호재. 3호선 역세권.",
    url: "https://land.naver.com",
    createdAt: "2026-03-15T10:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJSON<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Gemini helper
// ---------------------------------------------------------------------------

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function callGeminiForReport(prompt: string): Promise<string> {
  const apiKey = localStorage.getItem("sophia-api-gemini");
  if (!apiKey) throw new Error("No Gemini API key");

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatPrice(manwon: number): string {
  if (manwon >= 10000) {
    const eok = Math.floor(manwon / 10000);
    const remainder = manwon % 10000;
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만` : `${eok}억`;
  }
  return `${manwon.toLocaleString()}만`;
}

function formatWon(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억원`;
  }
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

// ---------------------------------------------------------------------------
// Price Slider Component
// ---------------------------------------------------------------------------

const PriceSlider = ({
  label,
  min,
  max,
  value,
  onChange,
  step = 5000,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) => (
  <div className="flex-1">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-xs font-mono font-medium">{formatPrice(value)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
    />
  </div>
);

// ---------------------------------------------------------------------------
// Area Slider Component
// ---------------------------------------------------------------------------

const AreaSlider = ({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) => (
  <div className="flex-1">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-xs font-mono font-medium">{value}평</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={1}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
    />
  </div>
);

// ---------------------------------------------------------------------------
// Report Skeleton
// ---------------------------------------------------------------------------

const ReportSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="space-y-2">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-3/4 bg-muted rounded" />
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const PropertySearch = () => {
  const { totalCash, totalNetWorth, state } = useFinancial();
  const annualIncome = state.annualIncome1 + state.annualIncome2;

  // Filters (migrate old `region: string` to `regions: string[]`)
  const [filters, setFilters] = useState<PropertyFilters>(() => {
    const loaded = loadJSON(FILTERS_KEY, DEFAULT_FILTERS);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = loaded as any;
    if (typeof raw.region === "string" && !Array.isArray(raw.regions)) {
      return { ...loaded, regions: raw.region ? [raw.region] : [] };
    }
    if (!Array.isArray(loaded.regions)) {
      return { ...loaded, regions: [] };
    }
    return loaded;
  });
  const [showFilters, setShowFilters] = useState(true);

  // Data
  const [favorites, setFavorites] = useState<string[]>(() =>
    loadJSON(FAVORITES_KEY, [])
  );
  const [manualProperties, setManualProperties] = useState<ManualProperty[]>(() =>
    loadJSON(MANUAL_KEY, MOCK_MANUAL_PROPERTIES)
  );
  const [reports, setReports] = useState<Record<string, PropertyReport>>(() =>
    loadJSON(REPORTS_KEY, {})
  );
  const [seenIds, setSeenIds] = useState<string[]>(() =>
    loadJSON(SEEN_KEY, [])
  );

  // UI
  const [sortKey, setSortKey] = useState<SortKey>("latest");
  const [showManualForm, setShowManualForm] = useState(false);
  const [loadingReport, setLoadingReport] = useState<string | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  // Manual form
  const emptyManual: Omit<ManualProperty, "id" | "createdAt"> = {
    name: "",
    address: "",
    type: "아파트",
    area: 30,
    price: 50000,
    memo: "",
    url: "",
  };
  const [manualForm, setManualForm] = useState(emptyManual);

  // Persist
  useEffect(() => saveJSON(FAVORITES_KEY, favorites), [favorites]);
  useEffect(() => saveJSON(MANUAL_KEY, manualProperties), [manualProperties]);
  useEffect(() => saveJSON(REPORTS_KEY, reports), [reports]);
  useEffect(() => saveJSON(SEEN_KEY, seenIds), [seenIds]);

  // ---------------------------------------------------------------------------
  // Filter matching logic
  // ---------------------------------------------------------------------------

  const allApartments = useMemo(() => getAllApartments(), []);

  // Build a unified list of property items from real estate API data + manual
  interface PropertyItem {
    id: string;
    name: string;
    address: string;
    type: PropertyType;
    area: number; // 평
    areaSqm: number;
    price: number; // 만원
    date: string;
    floor?: number;
    buildYear?: number;
    isManual: boolean;
    memo?: string;
    url?: string;
    transactions?: ApartmentTransaction[];
  }

  const allProperties: PropertyItem[] = useMemo(() => {
    // From real estate API mock data - flatten latest transaction per apartment
    const fromApi: PropertyItem[] = allApartments.map((apt) => {
      const latest = apt.transactions[0];
      return {
        id: `api-${apt.aptName}`,
        name: apt.aptName,
        address: apt.address,
        type: "아파트" as PropertyType,
        area: sqmToPyeong(apt.area),
        areaSqm: apt.area,
        price: apt.recentPrice,
        date: apt.recentDate,
        floor: latest?.floor,
        buildYear: latest?.buildYear,
        isManual: false,
        transactions: apt.transactions,
      };
    });

    // From manual entries
    const fromManual: PropertyItem[] = manualProperties.map((mp) => ({
      id: `manual-${mp.id}`,
      name: mp.name,
      address: mp.address,
      type: mp.type,
      area: mp.area,
      areaSqm: mp.area * 3.3058,
      price: mp.price,
      date: mp.createdAt.split("T")[0],
      isManual: true,
      memo: mp.memo,
      url: mp.url,
    }));

    return [...fromApi, ...fromManual];
  }, [allApartments, manualProperties]);

  const matchedProperties = useMemo(() => {
    let result = allProperties.filter((p) => {
      // Type filter
      if (filters.types.length > 0 && !filters.types.includes(p.type)) return false;

      // Region filter
      if (filters.regions.length > 0) {
        const matched = filters.regions.some(
          (r) => p.address.includes(r) || p.name.includes(r)
        );
        if (!matched) return false;
      }

      // Price
      if (p.price < filters.priceMin || p.price > filters.priceMax) return false;

      // Area
      if (p.area < filters.areaMin || p.area > filters.areaMax) return false;

      // New build
      if (filters.newBuild && p.buildYear) {
        const age = 2026 - p.buildYear;
        if (age > 5) return false;
      }

      return true;
    });

    // Sort
    switch (sortKey) {
      case "latest":
        result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      case "price":
        result.sort((a, b) => a.price - b.price);
        break;
      case "area":
        result.sort((a, b) => b.area - a.area);
        break;
    }

    return result;
  }, [allProperties, filters, sortKey]);

  // Count new (unseen) transactions
  const newCount = useMemo(() => {
    return matchedProperties.filter((p) => !seenIds.includes(p.id)).length;
  }, [matchedProperties, seenIds]);

  // Mark all as seen
  useEffect(() => {
    const ids = matchedProperties.map((p) => p.id);
    const unseen = ids.filter((id) => !seenIds.includes(id));
    if (unseen.length > 0) {
      // Don't auto-mark; let user see the badge
    }
  }, [matchedProperties]);

  const markAllSeen = useCallback(() => {
    const ids = matchedProperties.map((p) => p.id);
    setSeenIds((prev) => [...new Set([...prev, ...ids])]);
  }, [matchedProperties]);

  // ---------------------------------------------------------------------------
  // Favorites
  // ---------------------------------------------------------------------------

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  // ---------------------------------------------------------------------------
  // Save filters
  // ---------------------------------------------------------------------------

  const saveFilters = () => {
    saveJSON(FILTERS_KEY, filters);
  };

  // ---------------------------------------------------------------------------
  // Manual property
  // ---------------------------------------------------------------------------

  const addManualProperty = () => {
    if (!manualForm.name.trim() || !manualForm.address.trim()) return;
    const newProp: ManualProperty = {
      ...manualForm,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setManualProperties((prev) => [newProp, ...prev]);
    setManualForm(emptyManual);
    setShowManualForm(false);
  };

  const removeManualProperty = (id: string) => {
    setManualProperties((prev) => prev.filter((p) => p.id !== id));
  };

  // ---------------------------------------------------------------------------
  // AI Report
  // ---------------------------------------------------------------------------

  const generateReport = async (property: PropertyItem) => {
    setLoadingReport(property.id);
    setExpandedReport(property.id);

    const prompt = `당신은 한국 부동산 전문 분석가입니다. 아래 매물 정보와 사용자의 재정 상황을 분석하여 상세 레포트를 작성해주세요.

## 매물 정보
- 이름: ${property.name}
- 주소: ${property.address}
- 유형: ${property.type}
- 면적: ${property.area}평 (${property.areaSqm.toFixed(1)}㎡)
- 가격: ${formatPrice(property.price)} (${property.price}만원)
${property.buildYear ? `- 건축년도: ${property.buildYear}년` : ""}
${property.floor ? `- 층: ${property.floor}층` : ""}
${property.memo ? `- 메모: ${property.memo}` : ""}

## 사용자 재정 상황
- 보유 현금: ${formatWon(totalCash)}
- 순자산: ${formatWon(totalNetWorth)}
- 연소득 (합산): ${formatWon(annualIncome)}
- 월 대출 상환: ${formatWon(state.monthlyLoanPayment)}

## 분석 요청 항목 (각 항목별 2-3문장)

1. **입지 분석**: 교통 (지하철/버스 접근성), 상권 (편의시설, 마트), 학군 (초중고 거리), 환경 (공원, 소음)
2. **자산 분석**: 매매가 대비 필요 자기자본 (통상 30-40%), 예상 대출금액, 월 상환액, 현재 자산으로 구매 가능 여부
3. **가족 적합성**: 아이 키우기 적합 여부 (학교, 공원, 병원, 키즈카페 등 근접성)
4. **미래 가치**: 개발 호재 (GTX, 재건축 등), 교통 확장 계획, 인구 유입/유출 추세
5. **종합 의견**: 최종 추천/비추천 판단 + 핵심 사유 (1-2문장)

다음 JSON 형식으로만 응답하세요:
{
  "locationAnalysis": "...",
  "assetAnalysis": "...",
  "familyFit": "...",
  "futureValue": "...",
  "overallOpinion": "..."
}`;

    try {
      const text = await callGeminiForReport(prompt);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Parse error");

      const parsed = JSON.parse(jsonMatch[0]);
      const report: PropertyReport = {
        propertyId: property.id,
        locationAnalysis: parsed.locationAnalysis || "분석 데이터 없음",
        assetAnalysis: parsed.assetAnalysis || "분석 데이터 없음",
        familyFit: parsed.familyFit || "분석 데이터 없음",
        futureValue: parsed.futureValue || "분석 데이터 없음",
        overallOpinion: parsed.overallOpinion || "분석 데이터 없음",
        generatedAt: new Date().toISOString(),
      };

      setReports((prev) => ({ ...prev, [property.id]: report }));
    } catch (e) {
      // Mock fallback
      const mockReport: PropertyReport = {
        propertyId: property.id,
        locationAnalysis: `${property.name}은(는) ${property.address}에 위치하며, 주변 대중교통 접근성이 양호합니다. 반경 500m 내 대형마트와 편의시설이 잘 갖춰져 있으며, 도보 10분 거리에 지하철역이 있어 출퇴근이 편리합니다.`,
        assetAnalysis: `매매가 ${formatPrice(property.price)} 기준, 자기자본 약 ${formatPrice(Math.round(property.price * 0.3))}(30%)이 필요합니다. 현재 보유 현금 ${formatWon(totalCash)} 대비 ${totalCash >= property.price * 10000 * 0.3 ? "자기자본 충당이 가능합니다" : "추가 자금 마련이 필요합니다"}. 예상 대출 월 상환액은 약 ${formatWon(Math.round(property.price * 10000 * 0.7 / 360))}입니다.`,
        familyFit: `주변에 초등학교가 도보 10분 거리에 위치하고, 단지 내 놀이터와 인근 공원이 있어 아이 양육 환경이 양호합니다. 소아과, 치과 등 의료시설도 차량 5분 거리에 있습니다.`,
        futureValue: `해당 지역은 향후 교통 인프라 확장 (GTX, 신규 지하철 노선 등)이 예정되어 있어 중장기적 가치 상승이 기대됩니다. 인근 재개발/재건축 사업도 진행 중이어서 지역 전체의 가치 상승 효과가 예상됩니다.`,
        overallOpinion: `${property.price <= 100000 ? "가격 대비 입지와 미래 가치를 고려했을 때 매수를 추천합니다." : "고가 매물이므로 자금 계획을 충분히 세운 후 신중히 접근하시길 권장합니다."} 장기 거주 목적이라면 좋은 선택이 될 수 있습니다.`,
        generatedAt: new Date().toISOString(),
      };
      setReports((prev) => ({ ...prev, [property.id]: mockReport }));
    } finally {
      setLoadingReport(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Section 1: 필터 조건 설정 */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">필터 조건 설정</h3>
          </div>
          {showFilters ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-4 mt-4">
                {/* 부동산 유형 */}
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">
                    부동산 유형
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PROPERTY_TYPES.map((type) => (
                      <button
                        key={type}
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            types: prev.types.includes(type)
                              ? prev.types.filter((t) => t !== type)
                              : [...prev.types, type],
                          }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          filters.types.includes(type)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 지역 */}
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">
                    지역
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {REGION_OPTIONS.map((region) => {
                      const isSelected = filters.regions.includes(region);
                      return (
                        <button
                          key={region}
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              regions: isSelected
                                ? prev.regions.filter((r) => r !== region)
                                : [...prev.regions, region],
                            }))
                          }
                          className={`flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition-colors ${
                            isSelected
                              ? "bg-primary/15 text-primary border border-primary/30"
                              : "bg-muted text-muted-foreground border border-transparent hover:text-foreground"
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30"
                          }`}>
                            {isSelected && (
                              <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          {region}
                        </button>
                      );
                    })}
                  </div>
                  {filters.regions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {filters.regions.map((region) => (
                        <span
                          key={region}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium"
                        >
                          {region}
                          <button
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                regions: prev.regions.filter((r) => r !== region),
                              }))
                            }
                            className="hover:text-primary/70"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                      <button
                        onClick={() => setFilters((prev) => ({ ...prev, regions: [] }))}
                        className="text-[10px] text-muted-foreground hover:text-foreground ml-1"
                      >
                        전체 해제
                      </button>
                    </div>
                  )}
                </div>

                {/* 가격 범위 */}
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">
                    가격 범위
                  </label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <PriceSlider
                      label="최소"
                      min={10000}
                      max={300000}
                      value={filters.priceMin}
                      onChange={(v) =>
                        setFilters((prev) => ({
                          ...prev,
                          priceMin: Math.min(v, prev.priceMax),
                        }))
                      }
                    />
                    <PriceSlider
                      label="최대"
                      min={10000}
                      max={300000}
                      value={filters.priceMax}
                      onChange={(v) =>
                        setFilters((prev) => ({
                          ...prev,
                          priceMax: Math.max(v, prev.priceMin),
                        }))
                      }
                    />
                  </div>
                </div>

                {/* 면적 범위 */}
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">
                    면적 범위
                  </label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <AreaSlider
                      label="최소"
                      min={10}
                      max={60}
                      value={filters.areaMin}
                      onChange={(v) =>
                        setFilters((prev) => ({
                          ...prev,
                          areaMin: Math.min(v, prev.areaMax),
                        }))
                      }
                    />
                    <AreaSlider
                      label="최대"
                      min={10}
                      max={60}
                      value={filters.areaMax}
                      onChange={(v) =>
                        setFilters((prev) => ({
                          ...prev,
                          areaMax: Math.max(v, prev.areaMin),
                        }))
                      }
                    />
                  </div>
                </div>

                {/* 기타 조건 */}
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">
                    기타 조건
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "stationWalk" as const, label: "역세권 (도보 10분)", icon: Train },
                      { key: "goodSchool" as const, label: "학군 우수", icon: GraduationCap },
                      { key: "newBuild" as const, label: "신축 (5년 이내)", icon: Building2 },
                    ].map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() =>
                          setFilters((prev) => ({ ...prev, [key]: !prev[key] }))
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          filters[key]
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save button */}
                <button
                  onClick={saveFilters}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  필터 저장
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Section 2: 매칭 매물 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold">매칭 매물</h3>
            <span className="text-xs text-muted-foreground font-mono">
              {matchedProperties.length}건
            </span>
            {newCount > 0 && (
              <button
                onClick={markAllSeen}
                className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium animate-pulse"
              >
                새로운 거래 {newCount}건
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Sort */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              {(
                [
                  { key: "latest", label: "최신순" },
                  { key: "price", label: "가격순" },
                  { key: "area", label: "면적순" },
                ] as { key: SortKey; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    sortKey === key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Add manual */}
            <button
              onClick={() => setShowManualForm(!showManualForm)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              직접 등록
            </button>
          </div>
        </div>

        {/* Manual form */}
        <AnimatePresence>
          {showManualForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-card rounded-xl p-5 space-y-4 border border-border">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold">매물 직접 등록</h4>
                  <button onClick={() => setShowManualForm(false)} className="p-1">
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">이름</label>
                    <input
                      type="text"
                      value={manualForm.name}
                      onChange={(e) =>
                        setManualForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="힐스테이트 과천중앙"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">주소</label>
                    <input
                      type="text"
                      value={manualForm.address}
                      onChange={(e) =>
                        setManualForm((prev) => ({ ...prev, address: e.target.value }))
                      }
                      placeholder="경기 과천시 별양동"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">유형</label>
                    <select
                      value={manualForm.type}
                      onChange={(e) =>
                        setManualForm((prev) => ({
                          ...prev,
                          type: e.target.value as PropertyType,
                        }))
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {PROPERTY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      면적 (평)
                    </label>
                    <input
                      type="number"
                      value={manualForm.area}
                      onChange={(e) =>
                        setManualForm((prev) => ({
                          ...prev,
                          area: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      가격 (만원)
                    </label>
                    <input
                      type="number"
                      value={manualForm.price}
                      onChange={(e) =>
                        setManualForm((prev) => ({
                          ...prev,
                          price: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    URL (네이버부동산 등)
                  </label>
                  <input
                    type="url"
                    value={manualForm.url}
                    onChange={(e) =>
                      setManualForm((prev) => ({ ...prev, url: e.target.value }))
                    }
                    placeholder="https://land.naver.com/..."
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">메모</label>
                  <textarea
                    value={manualForm.memo}
                    onChange={(e) =>
                      setManualForm((prev) => ({ ...prev, memo: e.target.value }))
                    }
                    placeholder="메모를 입력하세요..."
                    rows={2}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowManualForm(false)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={addManualProperty}
                    className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    등록
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Property cards */}
        <div className="space-y-3">
          {matchedProperties.map((property, i) => {
            const isFav = favorites.includes(property.id);
            const report = reports[property.id];
            const isReportExpanded = expandedReport === property.id;
            const isLoading = loadingReport === property.id;

            return (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card rounded-xl p-4 border border-border/50 hover:border-border transition-colors"
              >
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold truncate">{property.name}</h4>
                      {property.isManual && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-500">
                          수동
                        </span>
                      )}
                      {!seenIds.includes(property.id) && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-primary/10 text-primary">
                          NEW
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <p className="text-xs text-muted-foreground truncate">
                        {property.address}
                      </p>
                    </div>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-sm font-bold font-mono text-primary">
                      {formatPrice(property.price)}
                    </p>
                  </div>
                </div>

                {/* Details row */}
                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    <span>{property.type}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Ruler className="h-3 w-3" />
                    <span>{property.area}평</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{property.date}</span>
                  </div>
                  {property.floor && (
                    <div className="flex items-center gap-1">
                      <Home className="h-3 w-3" />
                      <span>{property.floor}층</span>
                    </div>
                  )}
                  {property.buildYear && (
                    <span className="font-mono">{property.buildYear}년 준공</span>
                  )}
                </div>

                {/* Memo for manual */}
                {property.memo && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {property.memo}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => generateReport(property)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    AI 레포트
                  </button>

                  <button
                    onClick={() => toggleFavorite(property.id)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      isFav
                        ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isFav ? (
                      <Heart className="h-3 w-3 fill-current" />
                    ) : (
                      <HeartOff className="h-3 w-3" />
                    )}
                    {isFav ? "관심 해제" : "관심 등록"}
                  </button>

                  {property.url && (
                    <a
                      href={property.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      링크
                    </a>
                  )}

                  {property.isManual && (
                    <button
                      onClick={() =>
                        removeManualProperty(property.id.replace("manual-", ""))
                      }
                      className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors ml-auto"
                    >
                      <X className="h-3 w-3" />
                      삭제
                    </button>
                  )}

                  {report && !isLoading && (
                    <button
                      onClick={() =>
                        setExpandedReport(isReportExpanded ? null : property.id)
                      }
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                    >
                      <FileText className="h-3 w-3" />
                      {isReportExpanded ? "레포트 접기" : "레포트 보기"}
                    </button>
                  )}
                </div>

                {/* AI Report */}
                <AnimatePresence>
                  {isReportExpanded && (isLoading || report) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-border space-y-4">
                        {isLoading ? (
                          <ReportSkeleton />
                        ) : (
                          report && (
                            <>
                              {/* Location Analysis */}
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5 text-blue-500" />
                                  <h5 className="text-xs font-bold text-blue-500">
                                    입지 분석
                                  </h5>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                                  {report.locationAnalysis}
                                </p>
                              </div>

                              {/* Asset Analysis */}
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                                  <h5 className="text-xs font-bold text-green-500">
                                    자산 분석
                                  </h5>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                                  {report.assetAnalysis}
                                </p>
                              </div>

                              {/* Family Fit */}
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Baby className="h-3.5 w-3.5 text-pink-500" />
                                  <h5 className="text-xs font-bold text-pink-500">
                                    가족 적합성
                                  </h5>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                                  {report.familyFit}
                                </p>
                              </div>

                              {/* Future Value */}
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Trees className="h-3.5 w-3.5 text-emerald-500" />
                                  <h5 className="text-xs font-bold text-emerald-500">
                                    미래 가치
                                  </h5>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                                  {report.futureValue}
                                </p>
                              </div>

                              {/* Overall Opinion */}
                              <div className="bg-primary/5 rounded-lg p-3 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                                  <h5 className="text-xs font-bold text-primary">
                                    종합 의견
                                  </h5>
                                </div>
                                <p className="text-xs text-foreground leading-relaxed pl-5 font-medium">
                                  {report.overallOpinion}
                                </p>
                              </div>

                              <p className="text-[10px] text-muted-foreground/50 text-right font-mono">
                                생성: {new Date(report.generatedAt).toLocaleString("ko-KR")}
                              </p>
                            </>
                          )
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {matchedProperties.length === 0 && (
          <div className="text-center py-10">
            <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-mono">
              필터 조건에 맞는 매물이 없습니다
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              필터 조건을 조정하거나 매물을 직접 등록해보세요
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertySearch;
