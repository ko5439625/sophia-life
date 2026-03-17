import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Shield,
  Target,
  Lightbulb,
  Clock,
  Loader2,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sunrise,
  Zap,
  Mountain,
  CloudRain,
  MessageSquare,
  Lock,
} from "lucide-react";
import { getFearGreedIndex, getStockQuote, getHistoricalData } from "../../../services/marketApi";
import { analyzeHedging } from "../../../services/geminiApi";
import type { HedgingAnalysis } from "../../../services/geminiApi";
import { useFinancial } from "../../../store/financialStore";
import { useGuestMode } from "../../../hooks/useGuestMode";

// ---------------------------------------------------------------------------
// Constants & Mock Data
// ---------------------------------------------------------------------------

const cyclePhases = [
  { id: "recovery", label: "회복기", color: "#45B7D1", angle: 225 },
  { id: "expansion", label: "확장기", color: "#4ECDC4", angle: 315 },
  { id: "peak", label: "정점", color: "#FFB347", angle: 45 },
  { id: "contraction", label: "수축기", color: "#FF6B6B", angle: 135 },
];

const currentPhase = "expansion";

const cycleReasons = [
  "GDP 성장률 2.8% (3분기 연속 양의 성장률 기록)",
  "고용지표: 실업률 3.4%, 신규 취업자 수 증가 추세",
  "기업실적: S&P500 기업 72%가 시장 예상 상회",
  "소비자심리지수 102.5 (100 이상 = 낙관적)",
  "제조업 PMI 52.8 (50 이상 = 확장 국면)",
];

const historicalCycles = [
  { period: "2020.04 ~ 2021.11", phase: "확장기", duration: "20개월", gdp: "+6.2%" },
  { period: "2022.01 ~ 2022.10", phase: "수축기", duration: "10개월", gdp: "-1.1%" },
  { period: "2023.01 ~ 2024.06", phase: "확장기", duration: "18개월", gdp: "+3.4%" },
  { period: "2025.03 ~ 현재", phase: "확장기", duration: "14개월째", gdp: "+2.8%" },
];

const defaultNasdaqData = [
  { month: "4월", value: 14200 }, { month: "5월", value: 14800 },
  { month: "6월", value: 15100 }, { month: "7월", value: 15600 },
  { month: "8월", value: 15200 }, { month: "9월", value: 15800 },
  { month: "10월", value: 16100 }, { month: "11월", value: 16500 },
  { month: "12월", value: 16800 }, { month: "1월", value: 17200 },
  { month: "2월", value: 17600 }, { month: "3월", value: 18125 },
];

const defaultKospiData = [
  { month: "4월", value: 2580 }, { month: "5월", value: 2620 },
  { month: "6월", value: 2700 }, { month: "7월", value: 2750 },
  { month: "8월", value: 2680 }, { month: "9월", value: 2720 },
  { month: "10월", value: 2800 }, { month: "11월", value: 2850 },
  { month: "12월", value: 2900 }, { month: "1월", value: 2950 },
  { month: "2월", value: 2980 }, { month: "3월", value: 3012 },
];

const defaultKosdaqData = [
  { month: "4월", value: 820 }, { month: "5월", value: 835 },
  { month: "6월", value: 860 }, { month: "7월", value: 880 },
  { month: "8월", value: 850 }, { month: "9월", value: 870 },
  { month: "10월", value: 890 }, { month: "11월", value: 910 },
  { month: "12월", value: 925 }, { month: "1월", value: 940 },
  { month: "2월", value: 955 }, { month: "3월", value: 968 },
];

const defaultBtcData = [
  { month: "4월", value: 65000000 }, { month: "5월", value: 68000000 },
  { month: "6월", value: 72000000 }, { month: "7월", value: 70000000 },
  { month: "8월", value: 74000000 }, { month: "9월", value: 78000000 },
  { month: "10월", value: 80000000 }, { month: "11월", value: 83000000 },
  { month: "12월", value: 85000000 }, { month: "1월", value: 88000000 },
  { month: "2월", value: 90000000 }, { month: "3월", value: 92000000 },
];

// ---------------------------------------------------------------------------
// Cycle Strategy Data
// ---------------------------------------------------------------------------

interface CycleStrategy {
  id: string;
  label: string;
  labelEn: string;
  icon: typeof Sunrise;
  color: string;
  strategies: string[];
  allocation: { name: string; value: number; color: string }[];
}

const cycleStrategies: CycleStrategy[] = [
  {
    id: "recovery",
    label: "회복기",
    labelEn: "Recovery",
    icon: Sunrise,
    color: "#45B7D1",
    strategies: [
      "주식 비중 확대 (경기민감주, 소형주)",
      "부동산 매수 적기",
      "채권 비중 축소",
      "원자재/금 비중 유지",
    ],
    allocation: [
      { name: "주식", value: 50, color: "#4ECDC4" },
      { name: "채권", value: 15, color: "#F7DC6F" },
      { name: "부동산", value: 20, color: "#FF6B6B" },
      { name: "금/원자재", value: 10, color: "#FFB347" },
      { name: "현금", value: 5, color: "#BB8FCE" },
    ],
  },
  {
    id: "expansion",
    label: "확장기",
    labelEn: "Expansion",
    icon: Zap,
    color: "#4ECDC4",
    strategies: [
      "주식 유지하되 대형주/배당주로 전환",
      "금리 인상 대비 단기 채권 선호",
      "부동산 보유 유지, 추가 매수 신중",
      "인플레이션 헷징 (원자재, TIPS)",
    ],
    allocation: [
      { name: "주식", value: 40, color: "#4ECDC4" },
      { name: "채권", value: 20, color: "#F7DC6F" },
      { name: "부동산", value: 15, color: "#FF6B6B" },
      { name: "금/원자재", value: 15, color: "#FFB347" },
      { name: "현금", value: 10, color: "#BB8FCE" },
    ],
  },
  {
    id: "peak",
    label: "정점",
    labelEn: "Peak",
    icon: Mountain,
    color: "#FFB347",
    strategies: [
      "주식 비중 축소 시작",
      "채권 비중 확대 (장기채)",
      "현금 비중 확대",
      "방어적 섹터 (필수소비재, 헬스케어)",
    ],
    allocation: [
      { name: "주식", value: 25, color: "#4ECDC4" },
      { name: "채권", value: 30, color: "#F7DC6F" },
      { name: "부동산", value: 10, color: "#FF6B6B" },
      { name: "금/원자재", value: 10, color: "#FFB347" },
      { name: "현금", value: 25, color: "#BB8FCE" },
    ],
  },
  {
    id: "contraction",
    label: "수축기",
    labelEn: "Contraction",
    icon: CloudRain,
    color: "#FF6B6B",
    strategies: [
      "주식 최소화, 채권 확대",
      "현금/금 비중 극대화",
      "경기방어주만 유지",
      "저점 매수 기회 대기",
    ],
    allocation: [
      { name: "주식", value: 15, color: "#4ECDC4" },
      { name: "채권", value: 35, color: "#F7DC6F" },
      { name: "부동산", value: 5, color: "#FF6B6B" },
      { name: "금/원자재", value: 15, color: "#FFB347" },
      { name: "현금", value: 30, color: "#BB8FCE" },
    ],
  },
];

// Correlation patterns
const correlationPatterns = [
  {
    trigger: "부동산 가격 급등기",
    description: "서울 아파트 가격이 30% 이상 급등한 시기 (2020-2021)",
    data: [
      { name: "부동산", value: 30, color: "#FF6B6B" },
      { name: "주식", value: 15, color: "#4ECDC4" },
      { name: "채권", value: -5, color: "#F7DC6F" },
      { name: "금", value: 8, color: "#FFB347" },
      { name: "암호화폐", value: 120, color: "#BB8FCE" },
    ],
  },
  {
    trigger: "금리 인상기",
    description: "한국은행 기준금리 0.5% → 3.5% 인상기 (2021-2023)",
    data: [
      { name: "부동산", value: -15, color: "#FF6B6B" },
      { name: "주식", value: -20, color: "#4ECDC4" },
      { name: "채권", value: -12, color: "#F7DC6F" },
      { name: "금", value: 5, color: "#FFB347" },
      { name: "암호화폐", value: -65, color: "#BB8FCE" },
    ],
  },
  {
    trigger: "규제 충격 (한국)",
    description: "가상자산 과세, 대출 규제, 공매도 금지 등 정책 변화",
    data: [
      { name: "부동산", value: -8, color: "#FF6B6B" },
      { name: "주식", value: -12, color: "#4ECDC4" },
      { name: "채권", value: 3, color: "#F7DC6F" },
      { name: "금", value: 2, color: "#FFB347" },
      { name: "암호화폐", value: -30, color: "#BB8FCE" },
    ],
  },
];

// Allocation data
const currentAllocation = [
  { name: "주식", value: 60, color: "#4ECDC4" },
  { name: "채권", value: 10, color: "#F7DC6F" },
  { name: "현금", value: 20, color: "#BB8FCE" },
  { name: "금", value: 5, color: "#FFB347" },
  { name: "암호화폐", value: 5, color: "#FF6B6B" },
];

const recommendedAllocation = [
  { name: "주식", value: 45, color: "#4ECDC4" },
  { name: "채권", value: 25, color: "#F7DC6F" },
  { name: "현금", value: 15, color: "#BB8FCE" },
  { name: "금", value: 10, color: "#FFB347" },
  { name: "암호화폐", value: 5, color: "#FF6B6B" },
];

const allocationChanges = [
  { name: "주식", from: 60, to: 45, reason: "확장기 후반 변동성 대비, 수익 실현 구간" },
  { name: "채권", from: 10, to: 25, reason: "금리 인하 기대로 채권 가격 상승 예상" },
  { name: "현금", from: 20, to: 15, reason: "채권으로 일부 이전, 최소 유동성 유지" },
  { name: "금", from: 5, to: 10, reason: "지정학적 리스크 및 인플레이션 헤지 강화" },
  { name: "암호화폐", from: 5, to: 5, reason: "현재 비중 유지, 변동성 감안 추가 편입 보류" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getFearGreedLabel = (value: number) => {
  if (value <= 20) return "극도의 공포";
  if (value <= 40) return "공포";
  if (value <= 60) return "중립";
  if (value <= 80) return "탐욕";
  return "극도의 탐욕";
};

const getFearGreedColor = (value: number) => {
  if (value <= 20) return "#FF6B6B";
  if (value <= 40) return "#FF9F43";
  if (value <= 60) return "#F7DC6F";
  if (value <= 80) return "#4ECDC4";
  return "#45B7D1";
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MiniChartProps {
  title: string;
  data: { month: string; value: number }[];
  color: string;
  currentValue: string;
  change: string;
  isPositive: boolean;
  formatValue?: (v: number) => string;
}

const MiniChart = ({
  title,
  data,
  color,
  currentValue,
  change,
  isPositive,
  formatValue,
}: MiniChartProps) => (
  <div className="bg-card rounded-xl p-4">
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="flex items-center gap-1">
        {isPositive ? (
          <TrendingUp className="h-3 w-3 text-primary" />
        ) : (
          <TrendingDown className="h-3 w-3 text-destructive" />
        )}
        <span
          className={`text-xs font-mono ${
            isPositive ? "text-primary" : "text-destructive"
          }`}
        >
          {change}
        </span>
      </div>
    </div>
    <p className="text-lg font-mono font-bold mb-2">{currentValue}</p>
    <div className="h-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 11,
            }}
            formatter={(val: number) => [
              formatValue ? formatValue(val) : val.toLocaleString(),
              title,
            ]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            animationDuration={1000}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Economic Cycle SVG
// ---------------------------------------------------------------------------

const CycleDiagram = () => {
  const cx = 120;
  const cy = 120;
  const r = 85;

  return (
    <div className="flex justify-center">
      <svg width="240" height="240" viewBox="0 0 240 240">
        {/* Background circle */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="2"
          opacity={0.3}
        />

        {/* Phase arcs and nodes */}
        {cyclePhases.map((phase, i) => {
          const angleRad = (phase.angle * Math.PI) / 180;
          const x = cx + r * Math.cos(angleRad);
          const y = cy + r * Math.sin(angleRad);
          const isActive = phase.id === currentPhase;

          // Arrow to next phase
          const nextPhase = cyclePhases[(i + 1) % cyclePhases.length];
          const nextAngleRad = (nextPhase.angle * Math.PI) / 180;
          const midAngle = ((phase.angle + nextPhase.angle + (nextPhase.angle < phase.angle ? 360 : 0)) / 2) * Math.PI / 180;
          const arrowX = cx + (r - 2) * Math.cos(midAngle);
          const arrowY = cy + (r - 2) * Math.sin(midAngle);
          const _nextX = cx + r * Math.cos(nextAngleRad);
          const _nextY = cy + r * Math.sin(nextAngleRad);

          return (
            <g key={phase.id}>
              {/* Connecting arrow dot */}
              <circle
                cx={arrowX}
                cy={arrowY}
                r={2}
                fill={phase.color}
                opacity={0.5}
              />

              {/* Glow effect for active */}
              {isActive && (
                <>
                  {/* Outer pulse ring */}
                  <circle
                    cx={x}
                    cy={y}
                    r={38}
                    fill="none"
                    stroke={phase.color}
                    strokeWidth="1.5"
                    opacity={0.15}
                  >
                    <animate
                      attributeName="r"
                      values="32;42;32"
                      dur="2.5s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.2;0.02;0.2"
                      dur="2.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  {/* Inner glow */}
                  <circle
                    cx={x}
                    cy={y}
                    r={32}
                    fill={phase.color}
                    opacity={0.1}
                  >
                    <animate
                      attributeName="r"
                      values="28;36;28"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.2;0.06;0.2"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle
                    cx={x}
                    cy={y}
                    r={26}
                    fill={phase.color}
                    opacity={0.2}
                  />
                </>
              )}

              {/* Node circle */}
              <circle
                cx={x}
                cy={y}
                r={isActive ? 24 : 20}
                fill={isActive ? `${phase.color}30` : "transparent"}
                stroke={phase.color}
                strokeWidth={isActive ? 3 : 1.5}
                opacity={isActive ? 1 : 0.4}
              />

              {/* Label */}
              <text
                x={x}
                y={y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isActive ? phase.color : "hsl(var(--muted-foreground))"}
                fontSize={isActive ? 11 : 10}
                fontWeight={isActive ? "bold" : "normal"}
                opacity={isActive ? 1 : 0.5}
              >
                {phase.label}
              </text>
            </g>
          );
        })}

        {/* Center label */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="hsl(var(--muted-foreground))"
          fontSize={9}
        >
          경기
        </text>
        <text
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="hsl(var(--muted-foreground))"
          fontSize={9}
        >
          사이클
        </text>
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Cycle Strategy Mini Donut
// ---------------------------------------------------------------------------

const MiniDonut = ({ data }: { data: { name: string; value: number; color: string }[] }) => (
  <div className="w-20 h-20 flex-shrink-0">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="35%"
          outerRadius="70%"
          paddingAngle={2}
          dataKey="value"
          animationDuration={600}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(val: number) => [`${val}%`, "비중"]}
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 10,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const HEDGING_CATEGORY_MAP: Record<string, string> = {
  stock: "주식",
  etf: "주식",   // ETFs count as stocks for hedging allocation
  bond: "채권",
  crypto: "암호화폐",
  gold: "금",
  other: "기타",
};

const HEDGING_CATEGORY_COLORS: Record<string, string> = {
  "주식": "#4ECDC4",
  "채권": "#F7DC6F",
  "현금": "#BB8FCE",
  "금": "#FFB347",
  "암호화폐": "#FF6B6B",
  "기타": "#999",
};

const HedgingView = () => {
  const { isGuest } = useGuestMode();
  const { state, totalCash, totalInvestment, totalPension, totalNetWorth } = useFinancial();

  // Compute real portfolio allocation for "현재 배분" donut
  const computedAllocation = (() => {
    const catMap = new Map<string, number>();
    // Holdings by category
    state.holdings.forEach((h) => {
      const cat = HEDGING_CATEGORY_MAP[h.category] || "기타";
      const val = h.currentPrice * h.quantity;
      catMap.set(cat, (catMap.get(cat) || 0) + val);
    });
    // Add cash
    catMap.set("현금", (catMap.get("현금") || 0) + totalCash);
    // Total for percentage
    const total = totalCash + totalInvestment;
    if (total <= 0) return currentAllocation; // fallback to mock if no data

    return Array.from(catMap.entries())
      .map(([name, value]) => ({
        name,
        value: Math.round((value / total) * 100),
        color: HEDGING_CATEGORY_COLORS[name] || "#999",
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  })();

  const [fearGreedValue, setFearGreedValue] = useState(68);
  const [loading, setLoading] = useState(true);
  const [nasdaqData, setNasdaqData] = useState(defaultNasdaqData);
  const [kospiData, setKospiData] = useState(defaultKospiData);
  const [kosdaqData, setKosdaqData] = useState(defaultKosdaqData);
  const [btcData, setBtcData] = useState(defaultBtcData);
  const [nasdaqQuote, setNasdaqQuote] = useState({ value: "18,125.50", change: "+27.6%", isPositive: true });
  const [kospiQuote, setKospiQuote] = useState({ value: "3,012.45", change: "+16.7%", isPositive: true });
  const [kosdaqQuote, setKosdaqQuote] = useState({ value: "968.32", change: "+18.1%", isPositive: true });
  const [btcQuote, setBtcQuote] = useState({ value: "92,000,000", change: "+41.5%", isPositive: true });
  const [hedgingResult, setHedgingResult] = useState<HedgingAnalysis | null>(null);
  const [hedgingLoading, setHedgingLoading] = useState(false);
  const [aiAnalysisTriggered, setAiAnalysisTriggered] = useState(false);
  const [expandedPattern, setExpandedPattern] = useState<number | null>(null);
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(currentPhase);

  // Personal situation analysis
  const [personalSituation, setPersonalSituation] = useState("");
  const [personalResult, setPersonalResult] = useState<string | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);

  // Data fetch timestamp
  const [dataTimestamp, setDataTimestamp] = useState<string>("");
  const fearGreedLabel = getFearGreedLabel(fearGreedValue);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch quotes using direct index symbols via Yahoo Finance
        const [fg, nasdaqQ, kospiQ, kosdaqQ, btcQ] = await Promise.all([
          getFearGreedIndex(),
          getStockQuote("^IXIC"),
          getStockQuote("^KS11"),
          getStockQuote("^KQ11"),
          getStockQuote("BTC-USD"),
        ]);

        setFearGreedValue(fg.value);

        // NASDAQ
        setNasdaqQuote({
          value: nasdaqQ.price.toLocaleString(),
          change: `${nasdaqQ.changePercent >= 0 ? "+" : ""}${nasdaqQ.changePercent}%`,
          isPositive: nasdaqQ.changePercent >= 0,
        });

        // KOSPI
        setKospiQuote({
          value: kospiQ.price.toLocaleString(),
          change: `${kospiQ.changePercent >= 0 ? "+" : ""}${kospiQ.changePercent}%`,
          isPositive: kospiQ.changePercent >= 0,
        });

        // KOSDAQ
        setKosdaqQuote({
          value: kosdaqQ.price.toLocaleString(),
          change: `${kosdaqQ.changePercent >= 0 ? "+" : ""}${kosdaqQ.changePercent}%`,
          isPositive: kosdaqQ.changePercent >= 0,
        });

        // BTC
        setBtcQuote({
          value: btcQ.price.toLocaleString(),
          change: `${btcQ.changePercent >= 0 ? "+" : ""}${btcQ.changePercent}%`,
          isPositive: btcQ.changePercent >= 0,
        });

        // Fetch 1-year historical data for charts
        const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
        const toMonthlyChart = (data: { date: string; close: number }[]) => {
          // Group by month, take last close per month, keep last 12 months
          const monthMap = new Map<string, number>();
          for (const d of data) {
            const dateObj = new Date(d.date);
            const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth()).padStart(2, "0")}`;
            monthMap.set(key, d.close);
          }
          const sorted = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
          return sorted.slice(-12).map(([key, close]) => ({
            month: months[parseInt(key.split("-")[1])],
            value: Math.round(close),
          }));
        };

        const [nasdaqHist, kospiHist, kosdaqHist, btcHist] = await Promise.all([
          getHistoricalData("^IXIC", "1y").catch(() => []),
          getHistoricalData("^KS11", "1y").catch(() => []),
          getHistoricalData("^KQ11", "1y").catch(() => []),
          getHistoricalData("BTC-USD", "1y").catch(() => []),
        ]);

        if (nasdaqHist.length > 0) {
          const chartData = toMonthlyChart(nasdaqHist);
          if (chartData.length > 0) setNasdaqData(chartData);
        }
        if (kospiHist.length > 0) {
          const chartData = toMonthlyChart(kospiHist);
          if (chartData.length > 0) setKospiData(chartData);
        }
        if (kosdaqHist.length > 0) {
          const chartData = toMonthlyChart(kosdaqHist);
          if (chartData.length > 0) setKosdaqData(chartData);
        }
        if (btcHist.length > 0) {
          const chartData = toMonthlyChart(btcHist);
          if (chartData.length > 0) setBtcData(chartData);
        }

        setDataTimestamp(new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }));
      } catch (e) {
        console.warn("Market data fetch error:", e);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleAiAnalysis = async () => {
    setAiAnalysisTriggered(true);
    setHedgingLoading(true);
    try {
      const analysis = await analyzeHedging({
        fearGreedIndex: fearGreedValue,
        sp500Change: parseFloat(nasdaqQuote.change) || 0,
        nasdaqChange: parseFloat(nasdaqQuote.change) || 0,
        kospiChange: parseFloat(kospiQuote.change) || 0,
        usdKrw: 1345,
        usdKrwChange: 0,
      });
      setHedgingResult(analysis);
    } catch (e) {
      console.warn("Hedging analysis failed:", e);
    }
    setHedgingLoading(false);
  };

  const handlePersonalAnalysis = async () => {
    if (!personalSituation.trim()) return;
    setPersonalLoading(true);
    setPersonalResult(null);

    const apiKey = localStorage.getItem("sophia-api-gemini");
    if (!apiKey) {
      // Mock response
      await new Promise((r) => setTimeout(r, 1500));
      setPersonalResult(
        `## 개인 상황 분석 결과\n\n` +
        `입력하신 상황: "${personalSituation}"\n\n` +
        `### 분석\n` +
        `현재 경기 확장기 후반부로, 신중한 접근이 필요합니다.\n\n` +
        `- **아파트 구매 관련**: 현재 금리 수준과 DSR 규제를 고려하면 대출 여력을 먼저 확인하세요\n` +
        `- **자산 배분**: 아파트 구매 시 현금 비중이 크게 줄어들므로, 투자 포트폴리오의 유동성 확보가 중요합니다\n` +
        `- **타이밍**: 부동산 시장은 지역별 편차가 크므로 해당 지역의 실거래가 추이를 반드시 확인하세요\n` +
        `- **리스크**: 경기 정점 진입 시 금리 추가 인상 가능성이 있어, 변동금리 대출은 신중히 고려하세요\n\n` +
        `### 추천\n` +
        `1. 비상금은 최소 6개월치 생활비를 유지하세요\n` +
        `2. 투자 포트폴리오를 방어적으로 전환 (채권 비중 ↑)\n` +
        `3. 대출 상환 계획을 먼저 수립한 후 매수 결정\n\n` +
        `*설정에서 Gemini API 키를 입력하면 더 정교한 맞춤 분석이 가능합니다.*`
      );
      setPersonalLoading(false);
      return;
    }

    try {
      const prompt = `당신은 한국 시장 전문 투자 분석가입니다. 아래 시장 상황과 사용자의 개인 상황을 종합적으로 분석해주세요.

## 현재 시장 상황
- 경기 사이클: ${currentPhase === "expansion" ? "확장기 (14개월째)" : currentPhase}
- 공포탐욕지수: ${fearGreedValue} (${fearGreedLabel})
- NASDAQ: ${nasdaqQuote.value} (${nasdaqQuote.change})
- KOSPI: ${kospiQuote.value} (${kospiQuote.change})
- BTC: ${btcQuote.value}원 (${btcQuote.change})

## 사용자 개인 상황
${personalSituation}

## 요청
1. 사용자 상황에 맞는 구체적인 투자/재무 전략을 제시해주세요
2. 현재 시장 상황과 연계하여 리스크와 기회를 분석해주세요
3. 한국 부동산/규제/세금 특수성을 반드시 고려해주세요
4. 타임라인별 (단기 3개월, 중기 1년, 장기 3년) 액션 플랜을 제시해주세요
5. 주의해야 할 리스크를 구체적으로 나열해주세요

한국어로 마크다운 형식으로 답변해주세요.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      setPersonalResult(text || "분석 결과를 받아오지 못했습니다.");
    } catch (e) {
      console.warn("Personal analysis failed:", e);
      setPersonalResult("분석에 실패했습니다. API 키를 확인하고 다시 시도해주세요.");
    }
    setPersonalLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Page-level timestamp */}
      {dataTimestamp && (
        <div className="flex items-center justify-end gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground/60 font-mono">
            기준일: {dataTimestamp} KST
          </span>
        </div>
      )}

      {/* ================================================================== */}
      {/* Section 1: 경기 사이클 (Economic Cycle) */}
      {/* ================================================================== */}
      <motion.div
        className="bg-card rounded-xl p-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4" style={{ color: "#45B7D1" }} />
          <h3 className="text-sm font-medium">경기 사이클</h3>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-[#45B7D1]/30 to-transparent ml-1" />
        </div>

        <CycleDiagram />

        <p className="text-center text-xs text-muted-foreground mt-2">
          현재 시장은{" "}
          <span className="text-primary font-bold">확장기</span>에 있습니다
        </p>

        {/* WHY analysis */}
        <div className="mt-4 bg-primary/5 border border-primary/10 rounded-lg p-4 space-y-3">
          <p className="text-xs font-bold text-primary">
            현재 확장기로 판단하는 근거:
          </p>
          <ul className="space-y-1.5">
            {cycleReasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary text-xs mt-0.5 flex-shrink-0">-</span>
                <span className="text-xs text-muted-foreground">{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Historical cycles */}
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            과거 경기 사이클 타임라인
          </p>
          {historicalCycles.map((cycle, i) => (
            <div
              key={i}
              className={`flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 ${
                cycle.period.includes("현재") ? "border border-primary/20" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    cycle.phase === "확장기" ? "bg-primary" : "bg-destructive"
                  }`}
                />
                <span className="text-xs font-mono">{cycle.period}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground">
                  {cycle.duration}
                </span>
                <span
                  className={`text-[10px] font-mono font-medium ${
                    cycle.gdp.startsWith("+") ? "text-primary" : "text-destructive"
                  }`}
                >
                  GDP {cycle.gdp}
                </span>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            평균 확장기 지속 기간: ~24개월, 현재: 14개월째
          </p>
        </div>
      </motion.div>

      {/* ================================================================== */}
      {/* Section 1.5: 경기 사이클별 투자 전략 */}
      {/* ================================================================== */}
      <motion.div
        className="bg-card rounded-xl p-5 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4" style={{ color: "#4ECDC4" }} />
          <h3 className="text-sm font-medium">경기 사이클별 투자 전략</h3>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-[#4ECDC4]/30 to-transparent ml-1" />
        </div>

        <div className="space-y-3">
          {cycleStrategies.map((strategy) => {
            const isCurrentPhase = strategy.id === currentPhase;
            const isExpanded = expandedStrategy === strategy.id;
            const Icon = strategy.icon;

            return (
              <div
                key={strategy.id}
                className={`rounded-lg overflow-hidden transition-all ${
                  isCurrentPhase
                    ? "border-2 border-primary/30 bg-primary/5"
                    : "bg-muted/30 border border-transparent"
                }`}
              >
                <button
                  onClick={() =>
                    setExpandedStrategy(isExpanded ? null : strategy.id)
                  }
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${strategy.color}20` }}
                    >
                      <Icon
                        className="h-3.5 w-3.5"
                        style={{ color: strategy.color }}
                      />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium">
                          {strategy.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({strategy.labelEn})
                        </span>
                        {isCurrentPhase && (
                          <span className="relative text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-medium">
                            <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-30" />
                            <span className="relative">현재</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-4 space-y-3">
                        <div className="flex items-start gap-4">
                          {/* Mini donut chart */}
                          <MiniDonut data={strategy.allocation} />

                          {/* Allocation legend */}
                          <div className="flex-1 space-y-1 pt-1">
                            {strategy.allocation.map((a) => (
                              <div
                                key={a.name}
                                className="flex items-center gap-1.5"
                              >
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: a.color }}
                                />
                                <span className="text-[10px] flex-1">
                                  {a.name}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {a.value}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Strategies */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-medium text-muted-foreground">
                            핵심 전략
                          </p>
                          {strategy.strategies.map((s, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2"
                            >
                              <span
                                className="text-xs mt-0.5 flex-shrink-0"
                                style={{ color: strategy.color }}
                              >
                                -
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {s}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ================================================================== */}
      {/* Section 2: 시장 지표 & 차트 */}
      {/* ================================================================== */}

      {/* Fear & Greed Index */}
      <motion.div
        className="bg-card rounded-xl p-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-4 w-4" style={{ color: getFearGreedColor(fearGreedValue) }} />
          <h3 className="text-sm font-medium">Fear & Greed Index</h3>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-[#FFB347]/30 to-transparent ml-1" />
        </div>

        <div className="flex flex-col items-center">
          <div className="relative w-48 h-24 mb-2">
            <svg viewBox="0 0 200 100" className="w-full h-full">
              <path
                d="M 20 90 A 80 80 0 0 1 180 90"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M 20 90 A 80 80 0 0 1 52 30"
                fill="none"
                stroke="#FF6B6B"
                strokeWidth="12"
                strokeLinecap="round"
                opacity={0.3}
              />
              <path
                d="M 52 30 A 80 80 0 0 1 100 10"
                fill="none"
                stroke="#FF9F43"
                strokeWidth="12"
                opacity={0.3}
              />
              <path
                d="M 100 10 A 80 80 0 0 1 148 30"
                fill="none"
                stroke="#F7DC6F"
                strokeWidth="12"
                opacity={0.3}
              />
              <path
                d="M 148 30 A 80 80 0 0 1 180 90"
                fill="none"
                stroke="#4ECDC4"
                strokeWidth="12"
                strokeLinecap="round"
                opacity={0.3}
              />
              <line
                x1="100"
                y1="90"
                x2={100 + 70 * Math.cos(Math.PI - (fearGreedValue / 100) * Math.PI)}
                y2={90 - 70 * Math.sin(Math.PI - (fearGreedValue / 100) * Math.PI)}
                stroke={getFearGreedColor(fearGreedValue)}
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle
                cx="100"
                cy="90"
                r="4"
                fill={getFearGreedColor(fearGreedValue)}
              />
            </svg>
          </div>
          <p
            className="text-5xl font-mono font-extrabold drop-shadow-lg"
            style={{
              color: getFearGreedColor(fearGreedValue),
              textShadow: `0 0 20px ${getFearGreedColor(fearGreedValue)}40`,
            }}
          >
            {fearGreedValue}
          </p>
          <p
            className="text-sm font-bold mt-1 px-3 py-0.5 rounded-full"
            style={{
              color: getFearGreedColor(fearGreedValue),
              backgroundColor: `${getFearGreedColor(fearGreedValue)}15`,
            }}
          >
            {getFearGreedLabel(fearGreedValue)}
          </p>
          <div className="flex justify-between w-full max-w-xs mt-2 text-[10px] text-muted-foreground font-mono">
            <span>극도의 공포</span>
            <span>중립</span>
            <span>극도의 탐욕</span>
          </div>
        </div>
      </motion.div>

      {/* Market Charts */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4" style={{ color: "#45B7D1" }} />
          <h3 className="text-sm font-medium">주요 지수 (12개월)</h3>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-[#45B7D1]/30 to-transparent ml-1" />
          {dataTimestamp && (
            <span className="text-[9px] text-muted-foreground/50 font-mono flex-shrink-0">
              {dataTimestamp}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-2 flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground ml-2">시장 데이터 불러오는 중...</span>
            </div>
          ) : (
            <>
              <MiniChart
                title="NASDAQ"
                data={nasdaqData}
                color="#45B7D1"
                currentValue={nasdaqQuote.value}
                change={nasdaqQuote.change}
                isPositive={nasdaqQuote.isPositive}
              />
              <MiniChart
                title="KOSPI"
                data={kospiData}
                color="#4ECDC4"
                currentValue={kospiQuote.value}
                change={kospiQuote.change}
                isPositive={kospiQuote.isPositive}
              />
              <MiniChart
                title="KOSDAQ"
                data={kosdaqData}
                color="#FFB347"
                currentValue={kosdaqQuote.value}
                change={kosdaqQuote.change}
                isPositive={kosdaqQuote.isPositive}
              />
              <MiniChart
                title="BTC"
                data={btcData}
                color="#FF6B6B"
                currentValue={`${btcQuote.value}원`}
                change={btcQuote.change}
                isPositive={btcQuote.isPositive}
                formatValue={(v) => `${(v / 10000).toLocaleString()}만원`}
              />
            </>
          )}
        </div>
      </motion.div>

      {/* ================================================================== */}
      {/* Section 3: 자산 상관관계 분석 */}
      {/* ================================================================== */}
      <motion.div
        className="bg-card rounded-xl p-5 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4" style={{ color: "#F7DC6F" }} />
          <h3 className="text-sm font-medium">과거 유사 패턴 분석</h3>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-[#F7DC6F]/30 to-transparent ml-1" />
        </div>

        <div className="space-y-3">
          {correlationPatterns.map((pattern, i) => (
            <div key={i} className="bg-muted/30 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedPattern(expandedPattern === i ? null : i)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="text-left">
                  <p className="text-xs font-medium">{pattern.trigger}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {pattern.description}
                  </p>
                </div>
                {expandedPattern === i ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              <AnimatePresence>
                {expandedPattern === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3">
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={pattern.data} layout="vertical">
                            <XAxis
                              type="number"
                              tick={{ fontSize: 9 }}
                              tickLine={false}
                              axisLine={false}
                              domain={["dataMin", "dataMax"]}
                              tickFormatter={(v) => `${v}%`}
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              tick={{ fontSize: 10 }}
                              tickLine={false}
                              axisLine={false}
                              width={55}
                            />
                            <Tooltip
                              formatter={(val: number) => [`${val}%`, "수익률"]}
                              contentStyle={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 8,
                                fontSize: 11,
                              }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                              {pattern.data.map((entry, j) => (
                                <Cell
                                  key={j}
                                  fill={entry.value >= 0 ? "#4ECDC4" : "#FF6B6B"}
                                  opacity={0.8}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ================================================================== */}
      {/* Section 4: 헷징 전략 추천 */}
      {/* ================================================================== */}
      <motion.div
        className="bg-card rounded-xl p-5 space-y-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center gap-2 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg px-3 py-2 -mx-1">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold bg-gradient-to-r from-primary to-[#45B7D1] bg-clip-text text-transparent">
            헷징 전략 추천
          </h3>
        </div>

        {/* Side-by-side donut charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Current allocation */}
          <div>
            <p className="text-xs font-medium text-center mb-2 text-muted-foreground">
              현재 배분
            </p>
            {isGuest ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Lock className="h-6 w-6 text-muted-foreground/30 mb-2" />
                <p className="text-[10px] text-muted-foreground">비공개</p>
              </div>
            ) : (
              <>
                <div className="w-full aspect-square max-w-[160px] mx-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={computedAllocation}
                        cx="50%"
                        cy="50%"
                        innerRadius="40%"
                        outerRadius="70%"
                        paddingAngle={2}
                        dataKey="value"
                        animationDuration={800}
                      >
                        {computedAllocation.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number) => [`${val}%`, "비중"]}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1 mt-2">
                  {computedAllocation.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[10px] flex-1 text-foreground">{item.name}</span>
                      <span className="text-[10px] font-mono text-foreground/60">
                        {item.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Arrow between */}
          <div className="relative">
            <div className="absolute left-[-16px] top-1/3 transform -translate-y-1/2 z-10">
              <ArrowRight className="h-5 w-5 text-primary" />
            </div>
            <p className="text-xs font-medium text-center mb-2 text-primary">
              추천 배분
            </p>
            <div className="w-full aspect-square max-w-[160px] mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={recommendedAllocation}
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="70%"
                    paddingAngle={2}
                    dataKey="value"
                    animationDuration={800}
                  >
                    {recommendedAllocation.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [`${val}%`, "비중"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1 mt-2">
              {recommendedAllocation.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[10px] flex-1 text-foreground">{item.name}</span>
                  <span className="text-[10px] font-mono text-primary font-medium">
                    {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Change details */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            변경 상세
          </p>
          {allocationChanges.map((change) => {
            const diff = change.to - change.from;
            const borderColor = diff > 0
              ? "border-l-[3px] border-l-emerald-500/60"
              : diff < 0
              ? "border-l-[3px] border-l-red-400/60"
              : "border-l-[3px] border-l-blue-400/60";
            const badgeClass = diff > 0
              ? "bg-emerald-500/10 text-emerald-400"
              : diff < 0
              ? "bg-red-500/10 text-red-400"
              : "bg-blue-500/10 text-blue-400";
            const badgeLabel = diff > 0 ? "확대" : diff < 0 ? "축소" : "유지";
            return (
              <div key={change.name} className={`bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors group/change ${borderColor}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{change.name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>
                      {badgeLabel}
                    </span>
                  </div>
                  {diff !== 0 && (
                    <span
                      className={`text-xs font-mono font-bold ${
                        diff > 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {change.from}% → {change.to}% ({diff > 0 ? "▲" : "▼"}
                      {Math.abs(diff)}%p)
                    </span>
                  )}
                  {diff === 0 && (
                    <span className="text-xs font-mono text-blue-400">
                      {change.from}% (유지)
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-foreground/60 group-hover/change:text-foreground/70 transition-colors">
                  {change.reason}
                </p>
              </div>
            );
          })}
        </div>

        {/* Duration */}
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/10 rounded-lg p-3">
          <Clock className="h-4 w-4 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs font-medium">추천 헷징 유지 기간</p>
            <p className="text-sm font-mono font-bold text-primary">~3개월 (2026-06-17까지)</p>
          </div>
        </div>
      </motion.div>

      {/* ================================================================== */}
      {/* Section 5: Gemini AI 분석 */}
      {/* ================================================================== */}
      <motion.div
        className="bg-card rounded-xl p-5 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: "#BB8FCE" }} />
          <h3 className="text-sm font-medium">AI 심층 분석</h3>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-[#BB8FCE]/30 to-transparent ml-1" />
        </div>

        {!aiAnalysisTriggered ? (
          <button
            onClick={handleAiAnalysis}
            className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg p-4 transition-colors"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Gemini AI 심층 분석 실행
            </span>
          </button>
        ) : hedgingLoading ? (
          <div className="space-y-3">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-5/6" />
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-20 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-4/5" />
            </div>
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground ml-2">
                AI가 한국 시장 데이터를 분석 중입니다...
              </span>
            </div>
          </div>
        ) : hedgingResult ? (
          <div className="space-y-3">
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    hedgingResult.riskLevel === "low"
                      ? "bg-green-400"
                      : hedgingResult.riskLevel === "medium"
                      ? "bg-yellow-400"
                      : hedgingResult.riskLevel === "high"
                      ? "bg-orange-400"
                      : "bg-red-400"
                  }`}
                />
                <span className="text-xs font-medium">
                  리스크 수준: {hedgingResult.riskLevel.toUpperCase()}
                </span>
              </div>
              <p className="text-sm font-medium">{hedgingResult.summary}</p>
            </div>

            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <p className="text-xs font-medium mb-2">AI 추천 전략</p>
              {hedgingResult.strategies.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Shield className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">
                      {s.action}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({s.allocation}%)
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {hedgingResult.marketOutlook && (
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-xs font-medium mb-1">시장 전망</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {hedgingResult.marketOutlook}
                </p>
              </div>
            )}

            <button
              onClick={handleAiAnalysis}
              className="w-full text-xs text-primary hover:text-primary/80 transition-colors py-2"
            >
              다시 분석하기
            </button>
          </div>
        ) : (
          <div className="bg-muted/30 rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground">
              AI 분석에 실패했습니다. 다시 시도해주세요.
            </p>
            <button
              onClick={handleAiAnalysis}
              className="text-xs text-primary hover:text-primary/80 transition-colors mt-2"
            >
              재시도
            </button>
          </div>
        )}
      </motion.div>

      {/* ================================================================== */}
      {/* Section 6: 내 상황 맞춤 분석 */}
      {/* ================================================================== */}
      <motion.div
        className="bg-card rounded-xl p-5 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-medium">내 상황 맞춤 분석</h3>
        </div>

        {isGuest ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Lock className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">비공개 콘텐츠입니다</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">게스트 모드에서는 열람할 수 없습니다</p>
          </div>
        ) : (
        <>
        <p className="text-xs text-muted-foreground">
          개인 상황을 구체적으로 작성하면 현재 시장 데이터와 결합하여 맞춤 분석해드립니다.
        </p>

        <textarea
          value={personalSituation}
          onChange={(e) => setPersonalSituation(e.target.value)}
          placeholder="예: 올해 5월에 서울 강남구에 9억대 아파트 구매를 고려 중입니다. 현재 자산은 현금 2억, 투자 5천만원이고, 부부 합산 연봉은 1억입니다. 이 상황에서 현재 투자 포트폴리오를 어떻게 조정해야 할까요?"
          rows={4}
          className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none placeholder:text-muted-foreground/40 leading-relaxed"
        />

        <button
          onClick={handlePersonalAnalysis}
          disabled={personalLoading || !personalSituation.trim()}
          className="w-full flex items-center justify-center gap-2 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-lg p-3 transition-colors disabled:opacity-40"
        >
          {personalLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span className="text-sm font-medium text-accent">분석 중...</span>
            </>
          ) : (
            <>
              <MessageSquare className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-accent">내 상황 분석하기</span>
            </>
          )}
        </button>

        {personalLoading && (
          <div className="space-y-3">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-5/6" />
              <div className="h-20 bg-muted rounded w-full" />
            </div>
          </div>
        )}

        {personalResult && !personalLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-accent/5 border border-accent/10 rounded-lg p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-xs font-medium text-accent">맞춤 분석 결과</span>
            </div>
            <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {personalResult.split("\n").map((line, i) => {
                if (line.startsWith("## ")) {
                  return <h3 key={i} className="text-base font-bold mt-4 mb-2">{line.replace("## ", "")}</h3>;
                }
                if (line.startsWith("### ")) {
                  return <h4 key={i} className="text-sm font-bold mt-3 mb-1 text-accent">{line.replace("### ", "")}</h4>;
                }
                if (line.startsWith("- **")) {
                  const match = line.match(/- \*\*(.+?)\*\*:?\s*(.*)/);
                  if (match) {
                    return (
                      <p key={i} className="text-xs mt-1.5 pl-3 border-l-2 border-accent/30">
                        <span className="font-bold">{match[1]}</span>
                        {match[2] && `: ${match[2]}`}
                      </p>
                    );
                  }
                }
                if (line.startsWith("- ")) {
                  return <p key={i} className="text-xs mt-1 pl-3">• {line.slice(2)}</p>;
                }
                if (line.match(/^\d+\./)) {
                  return <p key={i} className="text-xs mt-1 pl-3">{line}</p>;
                }
                if (line.startsWith("*") && line.endsWith("*")) {
                  return <p key={i} className="text-[10px] text-muted-foreground mt-3 italic">{line.replace(/\*/g, "")}</p>;
                }
                if (line.trim() === "") return <br key={i} />;
                return <p key={i} className="text-xs mt-1">{line}</p>;
              })}
            </div>

            <button
              onClick={() => { setPersonalResult(null); setPersonalSituation(""); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-4"
            >
              새로운 상황 분석하기
            </button>
          </motion.div>
        )}
        </>
        )}
      </motion.div>
    </div>
  );
};

export default HedgingView;
