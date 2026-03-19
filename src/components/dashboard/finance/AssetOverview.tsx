import { useMemo, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Landmark,
  ShieldCheck,
  Banknote,
  BarChart3,
  Wallet,
  Sparkles,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  deriveAssetHistory,
  formatKRW,
  formatCompact,
} from "./budgetData";
import { useFinancial } from "../../../store/financialStore";
import { useGuestMode } from "../../../hooks/useGuestMode";
import { getAnnualCpiRate } from "../../../services/ecosApi";

// ---------------------------------------------------------------------------
// Gemini AI Report
// ---------------------------------------------------------------------------

async function generateFinancialReport(data: {
  totalNetWorth: number;
  totalCash: number;
  totalInvestment: number;
  totalPension: number;
  totalRealEstate: number;
  cashSavings: number;
  emergencyFund: number;
  monthlyBudgets: { month: string; categories: { id: string; name: string; amount: number }[] }[];
  expenses: { type: string; amount: number; category: string; date: string; deductFrom?: string }[];
  holdings: { name: string; category: string; quantity: number; avgPrice: number; currentPrice: number }[];
  analysisMonths: number;
}): Promise<string> {
  const apiKey = localStorage.getItem("sophia-api-gemini");
  if (!apiKey) throw new Error("Gemini API 키가 설정되지 않았습니다. 설정에서 추가해주세요.");

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth() - data.analysisMonths + 1, 1);
  const startStr = `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, "0")}`;

  // Filter data to analysis period
  const periodBudgets = data.monthlyBudgets.filter((b) => b.month >= startStr);
  const periodExpenses = data.expenses.filter((e) => e.date >= startStr && e.type === "expense");

  const totalBudget = periodBudgets.reduce(
    (sum, b) => sum + b.categories.reduce((s, c) => s + c.amount, 0), 0
  );
  const totalSpent = periodExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Category spending breakdown
  const catSpending: Record<string, number> = {};
  periodExpenses.forEach((e) => {
    catSpending[e.category] = (catSpending[e.category] || 0) + e.amount;
  });

  // Budget vs actual per category
  const budgetVsActual = periodBudgets.flatMap((b) =>
    b.categories.map((c) => ({ month: b.month, category: c.name, budget: c.amount }))
  );
  const catBudgets: Record<string, number> = {};
  budgetVsActual.forEach((item) => {
    catBudgets[item.category] = (catBudgets[item.category] || 0) + item.budget;
  });

  // Investment holdings
  const holdingsSummary = data.holdings.map((h) => {
    const value = h.currentPrice * h.quantity;
    const cost = h.avgPrice * h.quantity;
    const pnl = value - cost;
    return `${h.name}(${h.category}): 평가액 ${formatKRW(value)}원, 수익률 ${cost > 0 ? ((pnl / cost) * 100).toFixed(1) : 0}%`;
  }).join("\n");

  const cashRatio = data.totalNetWorth > 0 ? ((data.totalCash / data.totalNetWorth) * 100).toFixed(1) : "0";
  const investRatio = data.totalNetWorth > 0 ? ((data.totalInvestment / data.totalNetWorth) * 100).toFixed(1) : "0";
  const pensionRatio = data.totalNetWorth > 0 ? ((data.totalPension / data.totalNetWorth) * 100).toFixed(1) : "0";

  const prompt = `당신은 개인 재무 분석 전문가입니다. 아래 데이터를 기반으로 재무 건전성 분석 보고서를 작성해주세요.

## 분석 기간: 최근 ${data.analysisMonths}개월

## 자산 현황
- 총 자산: ${formatKRW(data.totalNetWorth)}원
- 현금자산: ${formatKRW(data.totalCash)}원 (${cashRatio}%)
  - 저축: ${formatKRW(data.cashSavings)}원
  - 비상금: ${formatKRW(data.emergencyFund)}원
- 투자자산: ${formatKRW(data.totalInvestment)}원 (${investRatio}%)
- 연금: ${formatKRW(data.totalPension)}원 (${pensionRatio}%)
${data.totalRealEstate > 0 ? `- 부동산: ${formatKRW(data.totalRealEstate)}원` : ""}

## 투자 포트폴리오
${holdingsSummary || "없음"}

## 예산 vs 실적 (${data.analysisMonths}개월 합산)
- 총 예산: ${formatKRW(totalBudget)}원
- 총 지출: ${formatKRW(totalSpent)}원 (${totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(0) : 0}%)

## 카테고리별 지출
${Object.entries(catSpending).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
    const budgetAmt = catBudgets[cat] || 0;
    return `- ${cat}: ${formatKRW(amt)}원 (예산 ${formatKRW(budgetAmt)}원, ${budgetAmt > 0 ? ((amt / budgetAmt) * 100).toFixed(0) : "∞"}%)`;
  }).join("\n")}

다음 항목을 포함해 한국어로 마크다운 보고서를 작성해주세요:
1. **재무 건전성 점수** (100점 만점, 비상금 비율/저축률/투자 다각화/예산 준수율 기반)
2. **실질 구매력 분석** - 연 3% 물가상승률 대비 자산 증식 속도 평가. 물가를 이기고 있는지, 부족하다면 얼마나 더 투자/저축해야 하는지 구체 금액 제시
3. **자산 배분 분석** - 현금/투자/연금 비율 적정성, 개선 방향
4. **지출 패턴 분석** - 예산 초과 카테고리, 절약 가능 항목
5. **투자 포트폴리오 평가** - 분산도, 리스크, 개선 제안
6. **비상금 적정성** - 월 지출 대비 비상금 충분성 (3~6개월분 권장)
7. **핵심 조언** 3가지 (실질 구매력 개선 방안 포함, 구체적이고 실행 가능한)

간결하고 실용적으로 작성해주세요. 불필요한 서론 없이 바로 분석 내용으로 시작하세요.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini API 오류 (${res.status})`);
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "분석 결과를 생성할 수 없습니다.";
}

// ---------------------------------------------------------------------------
// Simple Markdown renderer
// ---------------------------------------------------------------------------

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return <h4 key={i} className="text-sm font-bold mt-4 mb-1">{line.slice(4)}</h4>;
    if (line.startsWith("## ")) return <h3 key={i} className="text-base font-bold mt-5 mb-2 text-primary">{line.slice(3)}</h3>;
    if (line.startsWith("# ")) return <h2 key={i} className="text-lg font-bold mt-5 mb-2">{line.slice(2)}</h2>;
    if (line.startsWith("- ")) return <li key={i} className="text-sm ml-4 mb-0.5 list-disc">{renderInline(line.slice(2))}</li>;
    if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="text-sm font-bold mt-2">{line.slice(2, -2)}</p>;
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{renderInline(line)}</p>;
  });
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-foreground">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AssetOverview = () => {
  const {
    state, totalCash, totalInvestment, totalPension, totalNetWorth, totalAvailable,
    effectiveCashSavings, effectiveEmergencyFund,
  } = useFinancial();
  const { isGuest, maskAmount } = useGuestMode();
  const now = new Date();
  // Live investment total from holdings
  const liveInvestmentTotal = state.holdings.reduce(
    (sum, h) => sum + h.currentPrice * h.quantity, 0
  );

  const assetHistory = useMemo(
    () => deriveAssetHistory(state.monthlyBudgets, undefined, state.expenses, {
      cashSavings: state.cashSavings,
      emergencyFund: state.emergencyFund,
      investmentTotal: liveInvestmentTotal,
    }),
    [state.monthlyBudgets, state.expenses, state.cashSavings, state.emergencyFund, liveInvestmentTotal]
  );

  // CPI: ECOS API에서 실제 물가상승률 로드, 없으면 3% 고정
  const [annualCpi, setAnnualCpi] = useState(3.0); // 기본 3%
  const [cpiSource, setCpiSource] = useState<"default" | "ecos">("default");
  useEffect(() => {
    getAnnualCpiRate().then((rate) => {
      if (rate !== null) {
        setAnnualCpi(rate);
        setCpiSource("ecos");
      }
    });
  }, []);

  // Build chart data
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const MONTHLY_CPI = annualCpi / 100 / 12;

  const chartData = useMemo(() => {
    if (assetHistory.length === 0) return [];
    const baseTotal = assetHistory[0].total || 1;

    return assetHistory.map((point, idx) => {
      const monthKey = point.month.replace(".", "-");
      const isFuture = monthKey > currentMonthStr;
      const inflationNeeded = Math.round(point.total * Math.pow(1 + MONTHLY_CPI, idx));
      const growthPct = Math.round(((point.total - baseTotal) / baseTotal) * 1000) / 10;
      const prevTotal = idx > 0 ? assetHistory[idx - 1].total : point.total;
      const momPct = prevTotal > 0
        ? Math.round(((point.total - prevTotal) / prevTotal) * 1000) / 10
        : 0;

      return {
        month: point.month,
        planSavings: point.savings,
        planEmergency: point.emergency,
        planInvestment: point.investment,
        actualSavings: isFuture ? undefined : point.savings,
        actualEmergency: isFuture ? undefined : point.emergency,
        actualInvestment: isFuture ? undefined : point.investment,
        assetTotal: point.total,
        inflation: inflationNeeded,
        gap: point.total - inflationNeeded,
        growthPct,
        momPct,
      };
    });
  }, [assetHistory]);

  // AI Report state
  const [showReport, setShowReport] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportError, setReportError] = useState("");
  const [analysisMonths, setAnalysisMonths] = useState(3);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleGenerateReport = useCallback(async () => {
    setReportLoading(true);
    setReportError("");
    setReportText("");
    try {
      const text = await generateFinancialReport({
        totalNetWorth,
        totalCash,
        totalInvestment,
        totalPension,
        totalRealEstate: state.ownedProperties.reduce((s, p) => s + p.currentValue, 0),
        cashSavings: effectiveCashSavings,
        emergencyFund: effectiveEmergencyFund,
        monthlyBudgets: state.monthlyBudgets,
        expenses: state.expenses,
        holdings: state.holdings,
        analysisMonths,
      });
      setReportText(text);
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : "분석 실패");
    } finally {
      setReportLoading(false);
    }
  }, [totalNetWorth, totalCash, totalInvestment, totalPension, effectiveCashSavings, effectiveEmergencyFund, state, analysisMonths]);

  const defaultPoint = { total: 0, cash: 0, investment: 0, emergency: 0, savings: 0, month: "" };
  const latest = assetHistory[assetHistory.length - 1] ?? defaultPoint;
  const prev = assetHistory[assetHistory.length - 2] ?? defaultPoint;
  const changeRate = prev.total > 0 ? (((latest.total - prev.total) / prev.total) * 100).toFixed(1) : "0.0";
  const isUp = latest.total >= prev.total;

  // Pie chart data – use computed effective values
  const pieData = [
    { name: "저축", value: effectiveCashSavings, color: "#00704A" },
    { name: "비상금", value: effectiveEmergencyFund, color: "#F7DC6F" },
    { name: "현금보유", value: Math.max(0, totalCash - effectiveCashSavings - effectiveEmergencyFund), color: "#45B7D1" },
    { name: "투자", value: totalInvestment, color: "#2563EB" },
    { name: "연금", value: totalPension, color: "#BB8FCE" },
  ].filter((d) => d.value > 0);

  const liveTotal = totalNetWorth || 1;
  const cashPct = Math.round((totalCash / liveTotal) * 100);
  const investPct = Math.round((totalInvestment / liveTotal) * 100);

  return (
    <div className="space-y-5">
      {/* 총 자산 + AI 분석 버튼 */}
      <motion.div
        className="bg-card rounded-xl p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-muted-foreground">총 자산</p>
              <span className="text-[10px] text-muted-foreground/50 font-mono">{now.getFullYear()}년 {now.getMonth() + 1}월 기준</span>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-2xl sm:text-3xl font-mono font-extrabold break-all">
                {isGuest ? maskAmount(totalNetWorth) : `${formatKRW(totalNetWorth)}원`}
              </span>
              <span className={`text-xs font-mono mb-1 ${isUp ? "text-primary" : "text-destructive"}`}>
                {isUp ? "+" : ""}{changeRate}%
              </span>
            </div>
            {!isGuest && (
              <p className="text-[10px] text-muted-foreground/50 mt-1">{"현금 + 투자 + 연금 + 부동산 (설정 > 현금보유 포함)"}</p>
            )}
            <div className="flex gap-4 mt-2">
              <div>
                <p className="text-[10px] text-muted-foreground">가용자산</p>
                <p className="text-sm font-mono font-bold text-primary">{isGuest ? "₩•••" : `${formatKRW(totalAvailable)}원`}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">연금 (비가용)</p>
                <p className="text-sm font-mono font-bold text-purple-400">{isGuest ? "₩•••" : `${formatKRW(totalPension)}원`}</p>
              </div>
            </div>
          </div>
          {/* AI 분석 버튼 */}
          {!isGuest && (
            <button
              onClick={() => setShowReport(!showReport)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI 분석
            </button>
          )}
        </div>
      </motion.div>

      {/* AI Report Panel */}
      <AnimatePresence>
        {showReport && !isGuest && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card rounded-xl p-5 border border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  재무 분석 보고서
                </h4>
                <button onClick={() => setShowReport(false)}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* Period selector + Generate */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs text-muted-foreground">분석 기간:</span>
                {[1, 3, 6, 12].map((m) => (
                  <button
                    key={m}
                    onClick={() => setAnalysisMonths(m)}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                      analysisMonths === m
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {m === 12 ? "1년" : `${m}개월`}
                  </button>
                ))}
                <button
                  onClick={handleGenerateReport}
                  disabled={reportLoading}
                  className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {reportLoading ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 분석 중...</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" /> 분석 시작</>
                  )}
                </button>
              </div>

              {/* Report content */}
              {reportError && (
                <p className="text-sm text-destructive">{reportError}</p>
              )}
              {reportText && (
                <div className="prose-sm max-h-[500px] overflow-y-auto pr-2">
                  {renderMarkdown(reportText)}
                </div>
              )}
              {!reportText && !reportError && !reportLoading && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  기간을 선택하고 "분석 시작"을 눌러주세요
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 자산 추이 (콤보: 스택 막대 + 선 그래프) */}
      <div className="bg-card rounded-xl p-5">
        <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          자산 추이
        </h3>
        <div className="h-72 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} barGap={2} barCategoryGap="20%">
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#8B949E" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={(v) => isGuest ? "•••" : `${(v / 10000).toFixed(0)}만`}
                tick={{ fontSize: 10, fill: "#8B949E" }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 10, fill: "#10B981" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const point = chartData.find((d) => d.month === label);
                  if (!point || isGuest) return null;
                  const isFuture = point.actualSavings === undefined;
                  return (
                    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs space-y-1">
                      <p className="font-bold text-sm">{label}</p>
                      <div className="flex justify-between gap-6">
                        <span>{isFuture ? "계획" : "실제"}</span>
                        <span className="font-mono font-bold">{formatKRW(point.assetTotal)}원</span>
                      </div>
                      <div className="text-muted-foreground/70">
                        <span className="text-[10px]">저축 {formatCompact(point.planSavings)} · 비상금 {formatCompact(point.planEmergency)} · 투자 {formatCompact(point.planInvestment)}</span>
                      </div>
                      <hr className="border-border" />
                      <div className="flex justify-between gap-6">
                        <span className="text-red-400">물가 반영 필요액</span>
                        <span className="font-mono text-red-400">{formatKRW(point.inflation)}원</span>
                      </div>
                      <div className="flex justify-between gap-6">
                        <span className="text-emerald-400">누적 증식</span>
                        <span className="font-mono text-emerald-400 font-bold">{point.growthPct >= 0 ? "+" : ""}{point.growthPct}%</span>
                      </div>
                      <div className="flex justify-between gap-6">
                        <span className="text-amber-400">전월 대비</span>
                        <span className="font-mono text-amber-400 font-bold">{point.momPct >= 0 ? "+" : ""}{point.momPct}%</span>
                      </div>
                      <p className={`text-[10px] font-bold ${point.gap >= 0 ? "text-primary" : "text-destructive"}`}>
                        {point.gap >= 0 ? `실질 +${formatCompact(point.gap)}원` : `실질 -${formatCompact(Math.abs(point.gap))}원`}
                      </p>
                    </div>
                  );
                }}
              />

              {/* 계획 막대 (그레이 계열) */}
              <Bar yAxisId="left" dataKey="planSavings" stackId="plan" fill="#9CA3AF" barSize={16} name="plan" />
              <Bar yAxisId="left" dataKey="planEmergency" stackId="plan" fill="#6B7280" legendType="none" />
              <Bar yAxisId="left" dataKey="planInvestment" stackId="plan" fill="#4B5563" legendType="none" />

              {/* 실제 막대 (블루 계열) */}
              <Bar yAxisId="left" dataKey="actualSavings" stackId="actual" fill="#93C5FD" barSize={16} name="actual" />
              <Bar yAxisId="left" dataKey="actualEmergency" stackId="actual" fill="#60A5FA" legendType="none" />
              <Bar yAxisId="left" dataKey="actualInvestment" stackId="actual" fill="#3B82F6" legendType="none" />

              {/* 자산 총액 선 */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="assetTotal"
                stroke="#2563EB"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#2563EB" }}
                activeDot={{ r: 5 }}
                name="asset"
                connectNulls
              />

              {/* 물가 반영 필요액 선 */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="inflation"
                stroke="#EF4444"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                name="cpi"
                connectNulls
              />

              {/* 누적 증식률 % 선 */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="growthPct"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ r: 2, fill: "#10B981" }}
                name="growth"
                connectNulls
              />

              {/* 전월 대비 % 선 */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="momPct"
                stroke="#F59E0B"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={{ r: 2, fill: "#F59E0B" }}
                name="mom"
                connectNulls
              />

              <Legend
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    plan: "계획", actual: "실제",
                    asset: "자산 총액", cpi: "물가", growth: "누적 증식(%)", mom: "전월 대비(%)",
                  };
                  return <span className="text-[10px]">{labels[value] || ""}</span>;
                }}
                iconSize={8}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {/* 실질 구매력 gap 노티 */}
        {chartData.length > 1 && !isGuest && (() => {
          const currentMonthDot = currentMonthStr.replace("-", ".");
          const current = chartData.find((d) => d.month === currentMonthDot) || chartData[chartData.length - 1];
          const gap = current.gap;
          return (
            <div className={`mt-3 rounded-lg px-4 py-2.5 text-xs flex items-center justify-between ${
              gap >= 0 ? "bg-primary/10 border border-primary/20" : "bg-destructive/10 border border-destructive/20"
            }`}>
              <div>
                <span className={`font-bold ${gap >= 0 ? "text-primary" : "text-destructive"}`}>
                  {current.month} 실질 구매력:
                </span>
                <span className="text-muted-foreground ml-1">
                  {gap >= 0
                    ? `물가 대비 +${formatCompact(gap)}원`
                    : `물가 대비 -${formatCompact(Math.abs(gap))}원 부족`
                  }
                </span>
              </div>
              <span className={`font-mono font-bold text-sm ${gap >= 0 ? "text-primary" : "text-destructive"}`}>
                {gap >= 0 ? "+" : "-"}{formatCompact(Math.abs(gap))}
              </span>
            </div>
          );
        })()}
        <p className="text-[10px] text-muted-foreground text-center mt-1">
          {"연한 막대 = 계획 · 진한 막대 = 실제 · 빨간 점선 위로 자산이 올라가야 실질 성장"}
        </p>
      </div>

      {/* 자산 요약 카드 (2x2) */}
      {!isGuest && (
        <p className="text-[10px] text-muted-foreground text-right font-mono">
          {now.getFullYear()}년 {now.getMonth() + 1}월 기준 · 현재가 반영
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 border border-primary/15">
          <div className="flex items-center gap-2 mb-1.5">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-[10px] text-muted-foreground">현금자산</span>
            <span className="text-[10px] text-primary font-mono ml-auto">{cashPct}%</span>
          </div>
          <p className="text-lg font-mono font-bold text-primary">
            {isGuest ? "₩•••" : `${formatCompact(totalCash)}원`}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{"저축 + 비상금 + 현금보유 (설정)"}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-blue-500/15">
          <div className="flex items-center gap-2 mb-1.5">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <span className="text-[10px] text-muted-foreground">투자자산</span>
            <span className="text-[10px] text-blue-500 font-mono ml-auto">{investPct}%</span>
          </div>
          <p className="text-lg font-mono font-bold text-blue-500">
            {isGuest ? "₩•••" : `${formatCompact(totalInvestment)}원`}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {state.holdings.length > 0 ? `${state.holdings.length}종목 보유` : "보유 종목 없음"}
          </p>
        </div>
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Banknote className="h-4 w-4 text-primary" />
            <span className="text-[10px] text-muted-foreground">저축</span>
          </div>
          <p className="text-base font-mono font-bold text-primary">
            {isGuest ? "₩•••" : `${formatCompact(effectiveCashSavings)}원`}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">기초 {formatCompact(state.cashSavings)} + 적립분</p>
        </div>
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="h-4 w-4 text-yellow-500" />
            <span className="text-[10px] text-muted-foreground">비상금</span>
          </div>
          <p className="text-base font-mono font-bold text-yellow-500">
            {isGuest ? "₩•••" : `${formatCompact(effectiveEmergencyFund)}원`}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">기초 {formatCompact(state.emergencyFund)} + 적립분</p>
        </div>
      </div>

      {/* 자산 구성 파이 차트 */}
      <div className="bg-card rounded-xl p-5">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          자산 구성
        </h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                innerRadius={45}
                outerRadius={70}
                dataKey="value"
                animationDuration={800}
              >
                {pieData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [isGuest ? "₩•••••••" : `${formatKRW(value)}원`, ""]}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend
                verticalAlign="bottom"
                formatter={(value) => <span className="text-[11px]">{value}</span>}
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-3 mt-1 flex-wrap">
          {pieData.map((d) => (
            <div key={d.name} className="text-center">
              <p className="text-[10px] text-muted-foreground">{d.name}</p>
              <p className="text-[10px] font-mono font-bold" style={{ color: d.color }}>
                {isGuest ? "₩•••" : `${formatCompact(d.value)}원`}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 월별 상세 (접힘) */}
      <div className="bg-card rounded-xl overflow-hidden">
        <button
          onClick={() => setDetailsOpen(!detailsOpen)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
        >
          <h3 className="text-sm font-bold">월별 기록</h3>
          {detailsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        <AnimatePresence>
          {detailsOpen && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-4 space-y-1">
                {[...assetHistory].reverse().map((m) => {
                  const monthKey = m.month.replace(".", "-");
                  const budgetEntry = state.monthlyBudgets.find((b) => b.month === monthKey);
                  const monthlySavings = budgetEntry?.categories.find((c) => c.id === "savings")?.amount ?? 0;
                  const monthlyEmergency = budgetEntry?.categories.find((c) => c.id === "emergency")?.amount ?? 0;

                  return (
                    <div
                      key={m.month}
                      className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    >
                      <div>
                        <span className="text-sm font-mono text-muted-foreground">{m.month}</span>
                        <p className="text-[10px] text-muted-foreground/60">
                          +저축 {isGuest ? "₩•••" : formatCompact(monthlySavings)} / +비상 {isGuest ? "₩•••" : formatCompact(monthlyEmergency)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-mono font-medium">{isGuest ? "₩•••" : `${formatCompact(m.total)}원`}</span>
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-[10px] text-primary font-mono">현금 {isGuest ? "₩•••" : formatCompact(m.cash)}</span>
                          <span className="text-[10px] text-blue-500 font-mono">투자 {isGuest ? "₩•••" : formatCompact(m.investment)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AssetOverview;
