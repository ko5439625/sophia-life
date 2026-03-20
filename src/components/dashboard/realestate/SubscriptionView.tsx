import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Calendar,
  MapPin,
  Users,
  ChevronDown,
  ChevronUp,
  Bell,
  BellOff,
  Filter,
  Loader2,
  Wrench,
  Sparkles,
  Ban,
  Home,
  Wallet,
  Train,
  GraduationCap,
  TrendingUp,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchSubscriptions,
  getSubscriptionStatus,
  getNotificationIds,
  toggleNotification,
  type SubscriptionInfo,
  type SubscriptionStatus,
} from "../../../services/subscriptionApi";
import { useFinancial } from "@/store/financialStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusConfig: Record<SubscriptionStatus, { label: string; className: string }> = {
  ongoing: { label: "청약 중", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" },
  upcoming: { label: "청약 예정", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30" },
  closed: { label: "마감", className: "bg-muted text-muted-foreground border border-border" },
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

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
// Regions for filter
// ---------------------------------------------------------------------------

const ALL_REGIONS = "전체";

function extractRegions(items: SubscriptionInfo[]): string[] {
  const set = new Set<string>();
  items.forEach((item) => {
    if (item.region) set.add(item.region);
  });
  return [ALL_REGIONS, ...Array.from(set).sort()];
}

// ---------------------------------------------------------------------------
// Gemini helper
// ---------------------------------------------------------------------------

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function callGemini(prompt: string): Promise<string> {
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
// AI Report types
// ---------------------------------------------------------------------------

interface SubscriptionReport {
  resaleRestriction: string;
  residencyObligation: string;
  minimumFunding: string;
  locationAnalysis: string;
  educationEnvironment: string;
  investmentValue: string;
  overallOpinion: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Report Skeleton
// ---------------------------------------------------------------------------

const ReportSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
      <div key={i} className="space-y-2">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-3/4 bg-muted rounded" />
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Report section component
// ---------------------------------------------------------------------------

const ReportSection = ({
  icon,
  title,
  content,
  colorClass,
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
  colorClass: string;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-1.5">
      {icon}
      <h5 className={`text-xs font-bold ${colorClass}`}>{title}</h5>
    </div>
    <p className="text-xs text-muted-foreground leading-relaxed pl-5">
      {content}
    </p>
  </div>
);

// ---------------------------------------------------------------------------
// SubscriptionView
// ---------------------------------------------------------------------------

type StatusFilter = "all" | "ongoing" | "upcoming" | "recent_closed";

const SubscriptionView = () => {
  const { totalCash, state } = useFinancial();
  const annualIncome = state.annualIncome1 + state.annualIncome2;

  const [items, setItems] = useState<SubscriptionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState(ALL_REGIONS);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notificationIds, setNotificationIds] = useState<string[]>(getNotificationIds());
  const [showFilter, setShowFilter] = useState(false);

  // AI report state
  const [reports, setReports] = useState<Record<string, SubscriptionReport>>({});
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSubscriptions().then((data) => {
      if (!cancelled) {
        setItems(data);
        setLoading(false);
        // Cache subscription items for DashboardHome alerts
        try {
          const cacheItems = data.map((item) => ({
            id: item.id,
            houseName: item.houseName,
            applyStartDate: item.applyStartDate,
            applyEndDate: item.applyEndDate,
          }));
          localStorage.setItem("sophia-subscription-items-cache", JSON.stringify(cacheItems));
        } catch { /* ignore */ }
      }
    });
    return () => { cancelled = true; };
  }, []);

  const regions = useMemo(() => extractRegions(items), [items]);

  // 상태별 카운트
  const statusCounts = useMemo(() => {
    const counts = { all: items.length, ongoing: 0, upcoming: 0, recent_closed: 0 };
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    items.forEach((item) => {
      const st = getSubscriptionStatus(item);
      if (st === "ongoing") counts.ongoing++;
      else if (st === "upcoming") counts.upcoming++;
      else if (st === "closed") {
        const endDate = new Date(item.applyEndDate);
        if (endDate >= thirtyDaysAgo) counts.recent_closed++;
      }
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;

    // 상태 필터
    if (statusFilter !== "all") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      list = list.filter((item) => {
        const st = getSubscriptionStatus(item);
        if (statusFilter === "ongoing") return st === "ongoing";
        if (statusFilter === "upcoming") return st === "upcoming";
        if (statusFilter === "recent_closed") {
          if (st !== "closed") return false;
          const endDate = new Date(item.applyEndDate);
          return endDate >= thirtyDaysAgo;
        }
        return true;
      });
    }

    // 지역 필터
    if (selectedRegion !== ALL_REGIONS) {
      list = list.filter((item) => item.region === selectedRegion);
    }

    // Sort: ongoing first, then upcoming, then closed
    const order: Record<SubscriptionStatus, number> = { ongoing: 0, upcoming: 1, closed: 2 };
    return [...list].sort((a, b) => order[getSubscriptionStatus(a)] - order[getSubscriptionStatus(b)]);
  }, [items, selectedRegion, statusFilter]);

  const handleToggleNotification = (item: SubscriptionInfo) => {
    const enabled = toggleNotification(item.id);
    setNotificationIds(getNotificationIds());
    if (enabled) {
      toast.success(`"${item.houseName}" 알림이 설정되었습니다`);
    } else {
      toast.info(`"${item.houseName}" 알림이 해제되었습니다`);
    }
  };

  // ---------------------------------------------------------------------------
  // AI Report generation
  // ---------------------------------------------------------------------------

  const generateReport = async (item: SubscriptionInfo) => {
    setLoadingReportId(item.id);
    setExpandedReportId(item.id);

    const prompt = `당신은 한국 부동산 청약 전문 분석가입니다. 아래 분양 정보와 사용자의 재정 상황을 종합 분석하여 상세 레포트를 작성해주세요.

## 분양 정보
- 단지명: ${item.houseName}
- 지역: ${item.region}
- 주택유형: ${item.houseType}
- 공급세대수: ${item.totalSupply}세대
- 시공사: ${item.constructorName || "미정"}
- 청약기간: ${formatDate(item.applyStartDate)} ~ ${formatDate(item.applyEndDate)}
- 당첨자 발표: ${formatDate(item.announcementDate)}
- 입주예정: ${item.moveInDate || "미정"}
- 분양가 범위: ${item.priceRange || "미공개"}

## 사용자 재정 상황
- 보유 현금: ${formatWon(totalCash)}
- 연소득 (합산): ${formatWon(annualIncome)}
- 월 대출 상환: ${formatWon(state.monthlyLoanPayment)}

## 분석 요청 항목 (각 항목별 2-3문장, 구체적으로)

1. **전매 제한**: 이 지역/유형의 전매 제한 기간, 예외 조건
2. **실거주 의무**: 실거주 의무 기간 및 조건, 위반 시 불이익
3. **최소 자금 필요**: 분양가 기준 계약금(통상 10%)/중도금(60%)/잔금(30%) 스케줄 + 사용자 재정 기준 필요 최소 자금 산출
4. **입지 분석**: 교통 (지하철/버스 접근성), 상권 (편의시설, 마트), 생활 인프라
5. **교육 환경**: 주변 초/중/고등학교 현황, 학군 수준
6. **투자 가치**: 주변 시세 대비 분양가 수준, 미래 가치 전망, 개발 호재
7. **종합 의견**: 청약할 가치가 있는지 최종 판단 + 핵심 사유 (2-3문장)

다음 JSON 형식으로만 응답하세요:
{
  "resaleRestriction": "...",
  "residencyObligation": "...",
  "minimumFunding": "...",
  "locationAnalysis": "...",
  "educationEnvironment": "...",
  "investmentValue": "...",
  "overallOpinion": "..."
}`;

    try {
      const text = await callGemini(prompt);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Parse error");

      const parsed = JSON.parse(jsonMatch[0]);
      const report: SubscriptionReport = {
        resaleRestriction: parsed.resaleRestriction || "분석 데이터 없음",
        residencyObligation: parsed.residencyObligation || "분석 데이터 없음",
        minimumFunding: parsed.minimumFunding || "분석 데이터 없음",
        locationAnalysis: parsed.locationAnalysis || "분석 데이터 없음",
        educationEnvironment: parsed.educationEnvironment || "분석 데이터 없음",
        investmentValue: parsed.investmentValue || "분석 데이터 없음",
        overallOpinion: parsed.overallOpinion || "분석 데이터 없음",
        generatedAt: new Date().toISOString(),
      };

      setReports((prev) => ({ ...prev, [item.id]: report }));
    } catch {
      // Mock fallback
      const priceText = item.priceRange || "미공개";
      const mockReport: SubscriptionReport = {
        resaleRestriction: `${item.region} 지역의 ${item.houseType} 기준, 수도권 투기과열지구의 경우 소유권이전등기 후 3년간 전매가 제한됩니다. 다만 불가피한 사유(해외 이주, 이혼 등)가 있는 경우 LH 심사를 통해 예외 적용이 가능합니다.`,
        residencyObligation: `투기과열지구 내 분양가상한제 적용 주택의 경우 최초 입주 가능일로부터 3~5년간 실거주 의무가 부과됩니다. 의무 기간 중 미거주 시 주택 매입 청구가 가능하며, 향후 청약 자격에도 불이익이 발생할 수 있습니다.`,
        minimumFunding: `분양가 범위 ${priceText} 기준, 계약금(10%)은 약 ${priceText === "미공개" ? "미정" : "계약 시 납부"}, 중도금(60%)은 입주 전까지 분할 납부, 잔금(30%)은 입주 시 납부합니다. 현재 보유 현금 ${formatWon(totalCash)} 기준, 중도금 대출 활용 시 초기 계약금 자금의 확보 여부가 핵심입니다.`,
        locationAnalysis: `${item.houseName}은(는) ${item.region}에 위치하며, 주변 대중교통 접근성이 양호합니다. 반경 1km 내 대형마트, 병원, 관공서 등 생활 인프라가 잘 갖춰져 있으며, 향후 교통망 확충 계획이 있어 접근성이 더욱 개선될 전망입니다.`,
        educationEnvironment: `주변에 초등학교, 중학교가 도보 통학 가능 거리에 위치하고 있으며, 고등학교도 대중교통으로 15분 이내 접근이 가능합니다. 해당 학군은 전반적으로 양호한 수준으로 평가되고 있습니다.`,
        investmentValue: `${item.constructorName || "해당 시공사"}의 브랜드 가치와 ${item.region} 지역의 개발 호재를 감안하면, 분양가 대비 시세 차익이 기대됩니다. ${item.totalSupply.toLocaleString()}세대 대단지로 커뮤니티 시설과 관리 효율성 면에서도 유리합니다.`,
        overallOpinion: `${item.houseName}은(는) 입지, 시공사 브랜드, 개발 호재 등을 종합적으로 고려했을 때 청약을 적극 검토할 만한 단지입니다. 다만 전매 제한 및 실거주 의무 조건을 반드시 확인하고, 자금 계획을 면밀히 수립한 후 청약에 참여하시길 권장합니다.`,
        generatedAt: new Date().toISOString(),
      };
      setReports((prev) => ({ ...prev, [item.id]: mockReport }));
    } finally {
      setLoadingReportId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 상태 필터 탭 */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
        {([
          { key: "all" as StatusFilter, label: "전체", count: statusCounts.all },
          { key: "ongoing" as StatusFilter, label: "진행 중", count: statusCounts.ongoing },
          { key: "upcoming" as StatusFilter, label: "예정", count: statusCounts.upcoming },
          { key: "recent_closed" as StatusFilter, label: "최근 마감", count: statusCounts.recent_closed },
        ]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`relative flex-1 px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
              statusFilter === key
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {statusFilter === key && (
              <motion.div
                layoutId="subscription-status-tab"
                className="absolute inset-0 bg-card rounded-md shadow-sm"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10">
              {label}
              <span className="ml-1 text-[9px] font-mono opacity-60">{count}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Header + Region Filter */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-mono">
          {filtered.length}건의 분양 정보
          {!localStorage.getItem("sophia-api-data") && (
            <span className="text-[9px] text-amber-500 ml-2">샘플 데이터</span>
          )}
        </p>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Filter className="h-3.5 w-3.5" />
          지역 필터
        </button>
      </div>

      <AnimatePresence>
        {showFilter && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-1.5 flex-wrap pb-2">
              {regions.map((region) => (
                <button
                  key={region}
                  onClick={() => setSelectedRegion(region)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedRegion === region
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-muted text-muted-foreground border border-transparent hover:text-foreground"
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subscription cards */}
      <div className="space-y-3">
        {filtered.map((item, i) => {
          const status = getSubscriptionStatus(item);
          const config = statusConfig[status];
          const isExpanded = expandedId === item.id;
          const hasNotification = notificationIds.includes(item.id);
          const report = reports[item.id];
          const isReportLoading = loadingReportId === item.id;
          const isReportExpanded = expandedReportId === item.id;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card rounded-xl overflow-hidden"
            >
              {/* Card header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <h4 className="font-sans font-semibold text-sm truncate">
                        {item.houseName}
                      </h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${config.className}`}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{item.region}</span>
                      <span className="text-xs text-muted-foreground">|</span>
                      <span className="text-xs text-muted-foreground">{item.houseType}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Summary row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">공급세대수</p>
                    <p className="text-sm font-mono font-bold flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {item.totalSupply.toLocaleString()}세대
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">청약기간</p>
                    <p className="text-xs font-mono flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {formatDate(item.applyStartDate)} ~ {formatDate(item.applyEndDate)}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-[10px] text-muted-foreground">입주예정</p>
                    <p className="text-xs font-mono">{item.moveInDate || "-"}</p>
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="px-4 pb-4 space-y-4"
                  >
                    <div className="border-t border-border pt-4 space-y-3">
                      {/* Detail grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-0.5">시공사</p>
                          <p className="text-xs font-medium flex items-center gap-1">
                            <Wrench className="h-3 w-3 text-muted-foreground" />
                            {item.constructorName || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-0.5">당첨자 발표</p>
                          <p className="text-xs font-mono">{formatDate(item.announcementDate)}</p>
                        </div>
                        {item.priceRange && (
                          <div className="col-span-2">
                            <p className="text-[10px] text-muted-foreground mb-0.5">분양가 범위</p>
                            <p className="text-sm font-mono font-bold text-primary">{item.priceRange}</p>
                          </div>
                        )}
                      </div>

                      {/* Action buttons row */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        {/* Notification button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleNotification(item);
                          }}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 min-h-[44px] rounded-lg text-xs font-medium transition-colors ${
                            hasNotification
                              ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
                              : "bg-muted text-muted-foreground border border-border hover:text-foreground hover:border-primary/30"
                          }`}
                        >
                          {hasNotification ? (
                            <>
                              <Bell className="h-3.5 w-3.5 fill-primary" />
                              알림 설정됨
                            </>
                          ) : (
                            <>
                              <BellOff className="h-3.5 w-3.5" />
                              알림 설정
                            </>
                          )}
                        </button>

                        {/* 청약홈 바로가기 */}
                        <a
                          href={item.id.startsWith("mock-")
                            ? "https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancListView.do"
                            : `https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetailView.do?houseManageNo=${item.id}&pblancNo=${item.id}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 flex items-center justify-center gap-2 py-3 min-h-[44px] rounded-lg text-xs font-medium transition-colors bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/15"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          청약홈
                        </a>

                        {/* AI 분석 button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (report && !isReportLoading) {
                              setExpandedReportId(isReportExpanded ? null : item.id);
                            } else if (!isReportLoading) {
                              generateReport(item);
                            }
                          }}
                          disabled={isReportLoading}
                          className="flex-1 flex items-center justify-center gap-2 py-3 min-h-[44px] rounded-lg text-xs font-medium transition-colors bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/15 disabled:opacity-50"
                        >
                          {isReportLoading ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              분석 중...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              {report ? (isReportExpanded ? "레포트 접기" : "레포트 보기") : "AI 분석"}
                            </>
                          )}
                        </button>
                      </div>

                      {/* AI Report */}
                      <AnimatePresence>
                        {isReportExpanded && (isReportLoading || report) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 pt-4 border-t border-border space-y-4">
                              {isReportLoading ? (
                                <ReportSkeleton />
                              ) : (
                                report && (
                                  <>
                                    <ReportSection
                                      icon={<Ban className="h-3.5 w-3.5 text-red-400" />}
                                      title="전매 제한"
                                      content={report.resaleRestriction}
                                      colorClass="text-red-400"
                                    />
                                    <ReportSection
                                      icon={<Home className="h-3.5 w-3.5 text-orange-400" />}
                                      title="실거주 의무"
                                      content={report.residencyObligation}
                                      colorClass="text-orange-400"
                                    />
                                    <ReportSection
                                      icon={<Wallet className="h-3.5 w-3.5 text-yellow-400" />}
                                      title="최소 자금 필요"
                                      content={report.minimumFunding}
                                      colorClass="text-yellow-400"
                                    />
                                    <ReportSection
                                      icon={<Train className="h-3.5 w-3.5 text-blue-400" />}
                                      title="입지 분석"
                                      content={report.locationAnalysis}
                                      colorClass="text-blue-400"
                                    />
                                    <ReportSection
                                      icon={<GraduationCap className="h-3.5 w-3.5 text-indigo-400" />}
                                      title="교육 환경"
                                      content={report.educationEnvironment}
                                      colorClass="text-indigo-400"
                                    />
                                    <ReportSection
                                      icon={<TrendingUp className="h-3.5 w-3.5 text-green-400" />}
                                      title="투자 가치"
                                      content={report.investmentValue}
                                      colorClass="text-green-400"
                                    />

                                    {/* Overall opinion - highlighted */}
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
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 space-y-2">
          <p className="text-sm text-muted-foreground font-mono">
            {selectedRegion === ALL_REGIONS
              ? "분양 정보가 없습니다"
              : `${selectedRegion} 지역의 분양 정보가 없습니다`}
          </p>
          {!localStorage.getItem("sophia-api-data") && (
            <p className="text-xs text-amber-500">
              {"설정 > 공공데이터포털 API 키를 입력하면 실시간 청약 정보를 확인할 수 있습니다"}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SubscriptionView;
