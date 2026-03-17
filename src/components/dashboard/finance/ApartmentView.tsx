import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Star,
  MapPin,
  Home,
  Calculator,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Calendar,
  Building2,
  Layers,
  X,
  ArrowLeft,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatKRW } from "./budgetData";
import { useFinancial } from "../../../store/financialStore";
import { useGuestMode } from "../../../hooks/useGuestMode";
import {
  searchApartments,
  searchApartmentsByRegion,
  getTransactionHistory,
  getRegionStats,
  sqmToPyeong,
  type ApartmentSearchResult,
  type ApartmentTransaction,
  type RegionStats,
} from "../../../services/realEstateApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatMan = (n: number) => {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${formatKRW(n)}만`;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Transaction history table */
const TransactionTable = ({
  transactions,
}: {
  transactions: ApartmentTransaction[];
}) => {
  const sorted = useMemo(
    () =>
      [...transactions]
        .sort(
          (a, b) =>
            new Date(b.dealDate).getTime() - new Date(a.dealDate).getTime(),
        )
        .slice(0, 10),
    [transactions],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left py-2 font-mono font-medium">거래일</th>
            <th className="text-right py-2 font-mono font-medium">층</th>
            <th className="text-right py-2 font-mono font-medium">면적</th>
            <th className="text-right py-2 font-mono font-medium">거래가</th>
            <th className="text-right py-2 font-mono font-medium">전세가</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((tx) => (
            <tr
              key={tx.id}
              className="border-b border-border/50 last:border-0"
            >
              <td className="py-2 font-mono">{formatDate(tx.dealDate)}</td>
              <td className="py-2 text-right font-mono">{tx.floor}층</td>
              <td className="py-2 text-right font-mono">
                {tx.area}㎡ ({sqmToPyeong(tx.area)}평)
              </td>
              <td className="py-2 text-right font-mono font-bold">
                {formatMan(tx.price)}
              </td>
              <td className="py-2 text-right font-mono text-muted-foreground">
                {tx.jeonsePrice ? formatMan(tx.jeonsePrice) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Price trend chart */
const PriceChart = ({
  transactions,
}: {
  transactions: ApartmentTransaction[];
}) => {
  const chartData = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) =>
        new Date(a.dealDate).getTime() - new Date(b.dealDate).getTime(),
    );
    return sorted.map((tx) => ({
      date: tx.dealDate.slice(2, 7).replace("-", "."),
      price: tx.price,
      jeonse: tx.jeonsePrice ?? null,
    }));
  }, [transactions]);

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#8B949E" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) =>
              v >= 10000
                ? `${(v / 10000).toFixed(1)}억`
                : `${(v / 1000).toFixed(0)}천`
            }
            tick={{ fontSize: 10, fill: "#8B949E" }}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={["dataMin - 5000", "dataMax + 5000"]}
          />
          <Tooltip
            formatter={(val: number, name: string) => [
              formatMan(val),
              name === "price" ? "실거래가" : "전세가",
            ]}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3, fill: "hsl(var(--primary))" }}
            activeDot={{ r: 5 }}
            name="price"
          />
          <Line
            type="monotone"
            dataKey="jeonse"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={{ r: 2, fill: "#f59e0b" }}
            connectNulls
            name="jeonse"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/** Jeonse rate gauge bar */
const JeonseRateBar = ({ rate }: { rate: number }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          rate >= 70
            ? "bg-destructive"
            : rate >= 50
              ? "bg-yellow-500"
              : "bg-primary"
        }`}
        style={{ width: `${Math.min(rate, 100)}%` }}
      />
    </div>
    <span className="text-xs font-mono font-bold">{rate}%</span>
  </div>
);

/** Region card for the map overview */
const REGION_GRADIENTS: Record<string, string> = {
  "서울": "from-blue-600/20 to-indigo-600/10 hover:from-blue-600/30 hover:to-indigo-600/20",
  "경기": "from-emerald-600/20 to-teal-600/10 hover:from-emerald-600/30 hover:to-teal-600/20",
  "인천": "from-violet-600/20 to-purple-600/10 hover:from-violet-600/30 hover:to-purple-600/20",
};

const REGION_BORDERS: Record<string, string> = {
  "서울": "border-blue-500/30 hover:border-blue-500/50",
  "경기": "border-emerald-500/30 hover:border-emerald-500/50",
  "인천": "border-violet-500/30 hover:border-violet-500/50",
};

const RegionCard = ({
  stats,
  onClick,
}: {
  stats: RegionStats;
  onClick: () => void;
}) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`relative w-full text-left rounded-xl border p-4 bg-gradient-to-br transition-all cursor-pointer ${REGION_GRADIENTS[stats.region]} ${REGION_BORDERS[stats.region]}`}
  >
    <div className="flex items-start justify-between mb-3">
      <h3 className="text-lg font-bold">{stats.region}</h3>
      <div className={`flex items-center gap-0.5 text-xs font-mono font-bold ${stats.trendUp ? "text-red-400" : "text-blue-400"}`}>
        {stats.trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
        {stats.trendUp ? "▲" : "▼"}
      </div>
    </div>
    <p className="text-sm font-mono font-bold mb-1">
      평균 {formatMan(stats.avgPrice)}
    </p>
    <p className="text-[11px] text-muted-foreground">
      최근 거래 {stats.recentTransactions}건
    </p>
  </motion.button>
);

// ---------------------------------------------------------------------------
// Collapsible section wrapper
// ---------------------------------------------------------------------------

const CollapsibleSection = ({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors w-full"
      >
        {icon}
        <span className="font-sans font-medium">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// Address popup state
interface AddressPopupData {
  aptName: string;
  roadAddress: string;
  detailAddress: string;
  selectedArea: number;
}

const ApartmentView = () => {
  const { totalCash, state } = useFinancial();
  const { isGuest, maskAmount } = useGuestMode();
  const [query, setQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("sophia-apartment-favorites");
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });
  const [expandedApt, setExpandedApt] = useState<string | null>(null);
  const [expandedFavApt, setExpandedFavApt] = useState<string | null>(null);

  // Address popup state
  const [addressPopup, setAddressPopup] = useState<AddressPopupData | null>(null);

  // Calculator state
  const [ltvRate, setLtvRate] = useState(70);
  const [interestRate, setInterestRate] = useState(3.5);
  const [loanYears, setLoanYears] = useState(30);
  const [repaymentType, setRepaymentType] = useState<"equal_payment" | "equal_principal" | "graduated">("equal_payment");
  const [gracePeriod, setGracePeriod] = useState(0);

  // Total assets from store (convert won to 만원)
  const totalAssets = Math.round(totalCash / 10000);

  // Region stats (cached)
  const regionStats = useMemo(() => getRegionStats(), []);

  // Determine if we're in "browsing" mode (showing results) vs default view
  const isSearching = query.trim().length > 0;
  const isRegionFiltered = selectedRegion !== null;
  const showResults = isSearching || isRegionFiltered;

  // Search results
  const results: ApartmentSearchResult[] = useMemo(() => {
    if (isSearching) return searchApartments(query);
    if (isRegionFiltered) return searchApartmentsByRegion(selectedRegion!);
    return [];
  }, [query, isSearching, isRegionFiltered, selectedRegion]);

  // All favorites (always fetch from full data)
  const allFavoriteNames = useMemo(() => Array.from(favorites), [favorites]);
  const allFavorites = useMemo(
    () => searchApartments("").filter((apt) => allFavoriteNames.includes(apt.aptName)),
    [allFavoriteNames],
  );

  const toggleFavorite = (aptName: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(aptName)) next.delete(aptName);
      else next.add(aptName);
      try {
        localStorage.setItem("sophia-apartment-favorites", JSON.stringify([...next]));
      } catch (e) {
        console.warn("Failed to save apartment favorites:", e);
      }
      return next;
    });
  };

  const handleExpand = (aptName: string) => {
    setExpandedApt(expandedApt === aptName ? null : aptName);
  };

  const handleFavExpand = (aptName: string) => {
    setExpandedFavApt(expandedFavApt === aptName ? null : aptName);
  };

  const handleSearchResultClick = (apt: ApartmentSearchResult) => {
    setAddressPopup({
      aptName: apt.aptName,
      roadAddress: apt.address,
      detailAddress: "",
      selectedArea: apt.area,
    });
  };

  const handleAddressConfirm = () => {
    if (addressPopup) {
      setExpandedApt(addressPopup.aptName);
      setAddressPopup(null);
    }
  };

  const handleBackToOverview = () => {
    setSelectedRegion(null);
    setQuery("");
    setExpandedApt(null);
  };

  // Mortgage calculation with repayment types
  const calcMortgage = (apt: ApartmentSearchResult) => {
    const priceTotalWon = apt.recentPrice * 10000;
    const maxLoan = Math.floor(priceTotalWon * (ltvRate / 100));
    const monthlyRate = interestRate / 100 / 12;
    const graceMonths = gracePeriod * 12;
    const repayMonths = loanYears * 12 - graceMonths;

    let monthlyPayment = 0;
    let firstMonthPayment = 0;
    let lastMonthPayment = 0;
    let totalInterest = 0;

    if (repaymentType === "equal_payment") {
      if (graceMonths > 0) {
        const gracePayment = Math.round(maxLoan * monthlyRate);
        totalInterest += gracePayment * graceMonths;
      }
      monthlyPayment = monthlyRate > 0
        ? Math.round(
            (maxLoan * monthlyRate * Math.pow(1 + monthlyRate, repayMonths)) /
            (Math.pow(1 + monthlyRate, repayMonths) - 1)
          )
        : Math.round(maxLoan / repayMonths);
      firstMonthPayment = monthlyPayment;
      lastMonthPayment = monthlyPayment;
      totalInterest += monthlyPayment * repayMonths - maxLoan;
    } else if (repaymentType === "equal_principal") {
      const monthlyPrincipal = Math.round(maxLoan / repayMonths);
      firstMonthPayment = monthlyPrincipal + Math.round(maxLoan * monthlyRate);
      lastMonthPayment = monthlyPrincipal + Math.round(monthlyPrincipal * monthlyRate);
      monthlyPayment = firstMonthPayment;
      for (let i = 0; i < repayMonths; i++) {
        const remaining = maxLoan - monthlyPrincipal * i;
        totalInterest += Math.round(remaining * monthlyRate);
      }
      if (graceMonths > 0) {
        totalInterest += Math.round(maxLoan * monthlyRate) * graceMonths;
      }
    } else {
      const growthRate = 0.06;
      const repayYears = repayMonths / 12;
      let sumGrowth = 0;
      for (let y = 0; y < repayYears; y++) {
        sumGrowth += Math.pow(1 + growthRate, y);
      }
      const firstYearPrincipal = maxLoan / sumGrowth;
      firstMonthPayment = Math.round(firstYearPrincipal / 12) + Math.round(maxLoan * monthlyRate);
      const lastYearPrincipal = firstYearPrincipal * Math.pow(1 + growthRate, repayYears - 1);
      lastMonthPayment = Math.round(lastYearPrincipal / 12) + Math.round((maxLoan * 0.05) * monthlyRate);
      monthlyPayment = firstMonthPayment;
      totalInterest = Math.round(maxLoan * monthlyRate * repayMonths * 0.55);
      if (graceMonths > 0) {
        totalInterest += Math.round(maxLoan * monthlyRate) * graceMonths;
      }
    }

    const totalAssetsWon = totalAssets * 10000;
    const selfFund = priceTotalWon - maxLoan;
    const canBuy = totalAssetsWon >= selfFund;
    const shortage = selfFund - totalAssetsWon;

    const annualIncome = state.annualIncome1 + state.annualIncome2;
    const annualPayment = monthlyPayment * 12;
    const dsr = Math.round((annualPayment / annualIncome) * 100);

    const graceMonthlyPayment = graceMonths > 0 ? Math.round(maxLoan * monthlyRate) : 0;

    return {
      maxLoan, monthlyPayment, selfFund, canBuy, shortage, dsr,
      firstMonthPayment, lastMonthPayment, totalInterest,
      graceMonthlyPayment, repayMonths,
    };
  };

  // Render mortgage calculator content (shared between favorites and results)
  const renderMortgageCalc = (apt: ApartmentSearchResult) => {
    const result = calcMortgage(apt);
    return (
      <div className="space-y-4 bg-muted/50 rounded-lg p-4">
        {/* Current assets */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">현재 총 자산 (자동)</span>
          <span className="text-sm font-mono font-bold text-primary">{isGuest ? "₩•••••••" : formatMan(totalAssets)}</span>
        </div>

        {/* LTV */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">LTV (담보인정비율)</span>
            <span className="text-xs font-mono font-bold">{ltvRate}%</span>
          </div>
          <input type="range" min={30} max={80} step={5} value={ltvRate}
            onChange={(e) => setLtvRate(Number(e.target.value))}
            className="w-full accent-primary h-1.5" />
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>30%</span><span>80%</span>
          </div>
        </div>

        {/* Interest rate */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">대출 금리</span>
            <span className="text-xs font-mono font-bold">{interestRate}%</span>
          </div>
          <input type="range" min={2} max={7} step={0.1} value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            className="w-full accent-primary h-1.5" />
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>2%</span><span>7%</span>
          </div>
        </div>

        {/* Loan years */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">대출 기간</span>
            <span className="text-xs font-mono font-bold">{loanYears}년</span>
          </div>
          <input type="range" min={10} max={40} step={5} value={loanYears}
            onChange={(e) => setLoanYears(Number(e.target.value))}
            className="w-full accent-primary h-1.5" />
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>10년</span><span>40년</span>
          </div>
        </div>

        {/* Repayment type */}
        <div>
          <span className="text-xs text-muted-foreground block mb-2">상환 방식</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {([
              { value: "equal_payment" as const, label: "원리금균등", desc: "매달 동일" },
              { value: "equal_principal" as const, label: "원금균등", desc: "원금 동일" },
              { value: "graduated" as const, label: "체증식", desc: "점차 증가" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRepaymentType(opt.value)}
                className={`px-2 py-2 rounded-lg text-center transition-colors ${
                  repaymentType === opt.value
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-muted text-muted-foreground border border-transparent hover:text-foreground"
                }`}
              >
                <p className="text-xs font-medium">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Grace period */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">거치 기간 (이자만 납부)</span>
            <span className="text-xs font-mono font-bold">{gracePeriod === 0 ? "없음" : `${gracePeriod}년`}</span>
          </div>
          <input type="range" min={0} max={5} step={1} value={gracePeriod}
            onChange={(e) => setGracePeriod(Number(e.target.value))}
            className="w-full accent-primary h-1.5" />
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>없음</span><span>5년</span>
          </div>
        </div>

        {/* Result */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">최대 대출금</span>
            <span className="font-mono font-bold">{isGuest ? maskAmount(result.maxLoan) : `${formatKRW(result.maxLoan)}원`}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">필요 자기자본</span>
            <span className="font-mono font-bold">{isGuest ? maskAmount(result.selfFund) : `${formatKRW(result.selfFund)}원`}</span>
          </div>

          <div className="bg-background/50 rounded-lg p-3 space-y-1.5 border border-border/50">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
              {repaymentType === "equal_payment" ? "원리금균등" : repaymentType === "equal_principal" ? "원금균등" : "체증식"} 상환
              {gracePeriod > 0 && ` · 거치 ${gracePeriod}년`}
            </p>

            {gracePeriod > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">거치기간 월 납부 (이자만)</span>
                <span className="font-mono font-bold">{isGuest ? maskAmount(result.graceMonthlyPayment) : `${formatKRW(result.graceMonthlyPayment)}원`}</span>
              </div>
            )}

            {repaymentType === "equal_payment" ? (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">월 상환금 (고정)</span>
                <span className="font-mono font-bold">{isGuest ? maskAmount(result.monthlyPayment) : `${formatKRW(result.monthlyPayment)}원`}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">초기 월 상환금</span>
                  <span className="font-mono font-bold">{isGuest ? maskAmount(result.firstMonthPayment) : `${formatKRW(result.firstMonthPayment)}원`}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {repaymentType === "equal_principal" ? "최종 월 상환금" : "후기 월 상환금"}
                  </span>
                  <span className="font-mono font-bold">{isGuest ? maskAmount(result.lastMonthPayment) : `${formatKRW(result.lastMonthPayment)}원`}</span>
                </div>
              </>
            )}

            <div className="flex justify-between text-xs pt-1 border-t border-border/30">
              <span className="text-muted-foreground">총 이자</span>
              <span className="font-mono font-bold text-destructive/80">{isGuest ? maskAmount(result.totalInterest) : `${formatKRW(result.totalInterest)}원`}</span>
            </div>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">DSR</span>
            <span className={`font-mono font-bold ${result.dsr > 40 ? "text-destructive" : "text-primary"}`}>
              {result.dsr}%{result.dsr > 40 && " (초과)"}
            </span>
          </div>

          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className={`mt-3 rounded-lg p-3 text-center ${
              result.canBuy
                ? "bg-primary/10 border border-primary/20"
                : "bg-destructive/10 border border-destructive/20"
            }`}
          >
            <p className={`text-sm font-sans font-bold ${result.canBuy ? "text-primary" : "text-destructive"}`}>
              {result.canBuy ? "구매 가능" : isGuest ? `부족 금액: ${maskAmount(result.shortage)}` : `부족 금액: ${formatKRW(result.shortage)}원`}
            </p>
            {result.canBuy && (
              <p className="text-xs text-muted-foreground mt-1">
                자기자본 여유: {isGuest ? maskAmount(totalAssets * 10000 - result.selfFund) : `${formatKRW(totalAssets * 10000 - result.selfFund)}원`}
              </p>
            )}
          </motion.div>
        </div>
      </div>
    );
  };

  // Render an apartment result card (used in results list)
  const renderApartmentCard = (apt: ApartmentSearchResult) => {
    const pyeong = sqmToPyeong(apt.area);
    const isExpanded = expandedApt === apt.aptName;
    const transactions = isExpanded ? getTransactionHistory(apt.aptName) : [];

    return (
      <motion.div key={apt.aptName} layout className="bg-card rounded-xl overflow-hidden">
        {/* Card header */}
        <button
          onClick={() => isExpanded ? handleExpand(apt.aptName) : handleSearchResultClick(apt)}
          className="w-full p-4 text-left"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-primary flex-shrink-0" />
                <h4 className="font-sans font-semibold text-sm">{apt.aptName}</h4>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{apt.address}</span>
                <span className="text-xs text-muted-foreground">|</span>
                <span className="text-xs text-muted-foreground">{apt.area}㎡ ({pyeong}평)</span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(apt.aptName);
              }}
              className="p-1"
            >
              <Star
                className={`h-4 w-4 transition-colors ${
                  favorites.has(apt.aptName)
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          </div>

          {/* Price summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mt-3">
            <div>
              <p className="text-xs text-muted-foreground">최근 실거래가</p>
              <p className="text-base font-mono font-bold text-foreground">{formatMan(apt.recentPrice)}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{formatDate(apt.recentDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">전세가</p>
              <p className="text-sm font-mono font-bold text-foreground">{formatMan(apt.jeonsePrice)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">전세가율</p>
              <JeonseRateBar rate={apt.jeonseRate} />
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
              className="px-4 pb-4 space-y-5"
            >
              <CollapsibleSection
                title="실거래 내역 (최근 10건)"
                icon={<Calendar className="h-3.5 w-3.5" />}
              >
                <TransactionTable transactions={transactions} />
              </CollapsibleSection>

              <CollapsibleSection
                title="가격 추이 (최근 2년)"
                icon={<TrendingUp className="h-3.5 w-3.5" />}
              >
                <PriceChart transactions={transactions} />
                <div className="flex items-center gap-4 mt-2 justify-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-[hsl(var(--primary))] rounded" />
                    <span className="text-[10px] text-muted-foreground">실거래가</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-[#f59e0b] rounded border-dashed" />
                    <span className="text-[10px] text-muted-foreground">전세가</span>
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title="구매 시뮬레이션"
                icon={<Calculator className="h-4 w-4" />}
              >
                {renderMortgageCalc(apt)}
              </CollapsibleSection>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="아파트명 또는 지역으로 검색..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim()) setSelectedRegion(null);
          }}
          className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Back button when region is filtered */}
      {isRegionFiltered && !isSearching && (
        <button
          onClick={handleBackToOverview}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-mono">전체 지역으로 돌아가기</span>
        </button>
      )}

      {/* ===== DEFAULT VIEW (no search, no region filter) ===== */}
      {!showResults && (
        <>
          {/* Favorites section */}
          {allFavorites.length > 0 && (
            <div className="bg-card rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-mono text-muted-foreground flex items-center gap-1.5">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                내 관심 아파트
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-1">
                  {allFavorites.length}
                </span>
              </h4>
              <div className="space-y-2">
                {allFavorites.map((apt) => {
                  const isExpFav = expandedFavApt === apt.aptName;
                  const favTransactions = isExpFav ? getTransactionHistory(apt.aptName) : [];

                  return (
                    <div key={apt.aptName} className="bg-muted/50 border border-border rounded-lg overflow-hidden">
                      {/* Compact card header */}
                      <div
                        className="relative p-3 cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => handleFavExpand(apt.aptName)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(apt.aptName);
                          }}
                          className="absolute top-2 right-2 p-1 bg-destructive/10 hover:bg-destructive/20 rounded-md transition-colors border border-destructive/20"
                          title="관심 목록에서 제거"
                        >
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </button>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Home className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <span className="text-sm font-semibold truncate pr-8">{apt.aptName}</span>
                          {isExpFav ? (
                            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-auto mr-7" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto mr-7" />
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold">{formatMan(apt.recentPrice)}</span>
                          <span className="text-[10px] text-muted-foreground">전세율 {apt.jeonseRate}%</span>
                        </div>
                      </div>

                      {/* Expanded detail inside favorites */}
                      <AnimatePresence>
                        {isExpFav && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="px-3 pb-3 space-y-4 border-t border-border/50"
                          >
                            <div className="pt-3">
                              <CollapsibleSection
                                title="실거래 내역 (최근 10건)"
                                icon={<Calendar className="h-3.5 w-3.5" />}
                              >
                                <TransactionTable transactions={favTransactions} />
                              </CollapsibleSection>
                            </div>

                            <CollapsibleSection
                              title="가격 추이 (최근 2년)"
                              icon={<TrendingUp className="h-3.5 w-3.5" />}
                            >
                              <PriceChart transactions={favTransactions} />
                              <div className="flex items-center gap-4 mt-2 justify-center">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-3 h-0.5 bg-[hsl(var(--primary))] rounded" />
                                  <span className="text-[10px] text-muted-foreground">실거래가</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-3 h-0.5 bg-[#f59e0b] rounded border-dashed" />
                                  <span className="text-[10px] text-muted-foreground">전세가</span>
                                </div>
                              </div>
                            </CollapsibleSection>

                            <CollapsibleSection
                              title="구매 시뮬레이션"
                              icon={<Calculator className="h-4 w-4" />}
                            >
                              {renderMortgageCalc(apt)}
                            </CollapsibleSection>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Region map overview */}
          <div className="space-y-3">
            <h4 className="text-sm font-mono text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              지역별 시세 개요
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {regionStats.map((stats) => (
                <RegionCard
                  key={stats.region}
                  stats={stats}
                  onClick={() => {
                    setSelectedRegion(stats.region);
                    setExpandedApt(null);
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* ===== RESULTS VIEW (search or region filter active) ===== */}
      {showResults && (
        <div className="space-y-3">
          {isRegionFiltered && !isSearching && (
            <h4 className="text-sm font-mono text-muted-foreground">
              {selectedRegion} 지역 아파트 ({results.length}건)
            </h4>
          )}
          {results.map((apt) => renderApartmentCard(apt))}
          {results.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-10 font-mono">
              검색 결과가 없습니다
            </p>
          )}
        </div>
      )}

      {/* Address Popup Modal */}
      <AnimatePresence>
        {addressPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setAddressPopup(null)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 space-y-5">
                {/* Title */}
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-sans font-bold">주소 정보 입력</h3>
                </div>

                {/* Apartment name (readonly) */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">아파트명</label>
                  <div className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground">
                    {addressPopup.aptName}
                  </div>
                </div>

                {/* Road address */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">도로명 주소</label>
                  <input
                    type="text"
                    value={addressPopup.roadAddress}
                    onChange={(e) =>
                      setAddressPopup({ ...addressPopup, roadAddress: e.target.value })
                    }
                    placeholder="서울특별시 서초구 금광로 40"
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* Detail address */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">상세 주소</label>
                  <input
                    type="text"
                    value={addressPopup.detailAddress}
                    onChange={(e) =>
                      setAddressPopup({ ...addressPopup, detailAddress: e.target.value })
                    }
                    placeholder="101동 1502호"
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* Area selector */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">면적</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[59, 84, 114, 134].map((area) => (
                      <button
                        key={area}
                        onClick={() =>
                          setAddressPopup({ ...addressPopup, selectedArea: area })
                        }
                        className={`px-3 py-2.5 rounded-xl text-center transition-colors ${
                          addressPopup.selectedArea === area
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "bg-muted text-muted-foreground border border-transparent hover:text-foreground"
                        }`}
                      >
                        <p className="text-xs font-mono font-medium">{area}m2</p>
                        <p className="text-[10px] text-muted-foreground">{sqmToPyeong(area)}평</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Confirm button */}
                <button
                  onClick={handleAddressConfirm}
                  className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-sans font-bold hover:bg-primary/90 transition-colors"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ApartmentView;
