import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  X,
  Briefcase,
  BarChart3,
  Shield,
  ArrowDownRight,
  ArrowUpRight,
  History,
  CheckCircle2,
} from "lucide-react";
import { formatKRW } from "./budgetData";
import { useFinancial, type Holding } from "../../../store/financialStore";
import { useGuestMode } from "../../../hooks/useGuestMode";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  "주식": "#4ECDC4",
  "ETF": "#45B7D1",
  "채권": "#F7DC6F",
  "암호화폐": "#FF6B6B",
  "금": "#FFB347",
  "기타": "#BB8FCE",
  "stock": "#4ECDC4",
  "etf": "#45B7D1",
  "bond": "#F7DC6F",
  "crypto": "#FF6B6B",
  "gold": "#FFB347",
  "other": "#BB8FCE",
};

const CATEGORY_LABELS: Record<string, string> = {
  "stock": "주식",
  "etf": "ETF",
  "bond": "채권",
  "crypto": "암호화폐",
  "gold": "금",
  "other": "기타",
};

const PENSION_ACCOUNT_LABELS: Record<string, string> = {
  "pension_savings": "연금저축",
  "irp": "IRP",
  "dc": "DC",
};

const PENSION_CATEGORY_COLORS: Record<string, string> = {
  "pension_savings": "#4ECDC4",
  "irp": "#F7DC6F",
  "dc": "#BB8FCE",
};

const DESTINATION_LABELS: Record<string, string> = {
  cash: "현금으로",
  reinvest: "재투자 대기",
  savings: "저축으로",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const InvestmentView = () => {
  const {
    state,
    sellHolding: storeSellHolding,
    buyHolding: storeBuyHolding,
    removeHolding: storeRemoveHolding,
    updateHolding,
    totalInvestment,
    totalPension,
    totalNetWorth,
  } = useFinancial();
  const { isGuest, maskAmount } = useGuestMode();

  const holdings = state.holdings;
  const trades = state.trades;
  const pensionFunds = state.pensionFunds;

  const [showForm, setShowForm] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [symbolSearchResults, setSymbolSearchResults] = useState<{ symbol: string; name: string; type: string }[]>([]);
  const [symbolSearching, setSymbolSearching] = useState(false);
  const symbolSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [newHolding, setNewHolding] = useState({
    name: "",
    symbol: "",
    category: "stock" as Holding["category"],
    quantity: "",
    avgPrice: "",
    currentPrice: "",
  });

  // Search stock symbols by name (debounced)
  const searchSymbol = async (query: string) => {
    if (!query || query.length < 2) { setSymbolSearchResults([]); return; }
    setSymbolSearching(true);
    try {
      const { proxyFetch } = await import("../../../services/proxyFetch");
      const result = await proxyFetch<{
        quotes?: Array<{ symbol?: string; shortname?: string; longname?: string; quoteType?: string }>;
      }>("yahoo-search", { query });
      if (result?.quotes) {
        setSymbolSearchResults(
          result.quotes
            .filter((q) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF"))
            .slice(0, 6)
            .map((q) => ({
              symbol: q.symbol || "",
              name: q.shortname || q.longname || "",
              type: q.quoteType || "",
            }))
        );
      }
    } catch (e) {
      console.warn("Symbol search failed:", e);
    }
    setSymbolSearching(false);
  };

  const handleNameChange = (value: string) => {
    setNewHolding({ ...newHolding, name: value });
    // Debounced search
    if (symbolSearchTimer.current) clearTimeout(symbolSearchTimer.current);
    symbolSearchTimer.current = setTimeout(() => searchSymbol(value), 500);
  };

  // 한국 주요 종목 이름→심볼 매핑 (Yahoo Search 429 대비)
  const KR_SYMBOL_MAP: Record<string, string> = {
    "삼성전자": "005930.KS", "SK하이닉스": "000660.KS", "LG에너지솔루션": "373220.KS",
    "삼성바이오로직스": "207940.KS", "현대차": "005380.KS", "기아": "000270.KS",
    "셀트리온": "068270.KS", "KB금융": "105560.KS", "신한지주": "055550.KS",
    "NAVER": "035420.KS", "네이버": "035420.KS", "카카오": "035720.KS",
    "POSCO홀딩스": "005490.KS", "삼성SDI": "006400.KS", "LG화학": "051910.KS",
    "현대모비스": "012330.KS", "삼성물산": "028260.KS", "SK이노베이션": "096770.KS",
    "한화에어로스페이스": "012450.KS", "한화오션": "042660.KS", "LG전자": "066570.KS",
    "두산에너빌리티": "034020.KS", "HD현대중공업": "329180.KS", "크래프톤": "259960.KS",
    "엔씨소프트": "036570.KQ", "펄어비스": "263750.KQ", "넷마블": "251270.KS",
  };

  // Auto-fetch current prices for all holdings
  const fetchCurrentPrices = async () => {
    setPriceLoading(true);
    const { getQuote } = await import("../../../services/yahooFinanceApi");
    for (const h of holdings) {
      let symbol = h.name.match(/\(([^)]+)\)$/)?.[1];

      // 심볼 없으면 로컬 매핑에서 찾기
      if (!symbol) {
        const cleanName = h.name.replace(/\s*\([^)]*\)$/, "").trim();
        symbol = KR_SYMBOL_MAP[cleanName];
        // 찾으면 Vercel 프록시로 Yahoo Search 시도
        if (!symbol) {
          // proxyFetch를 통해 심볼 검색 시도 (별도 처리 불필요)
        }
        if (symbol) {
          updateHolding(h.id, { name: `${cleanName} (${symbol})` });
        }
      }

      if (!symbol) continue;
      try {
        const quote = await getQuote(symbol);
        if (quote.price > 0) {
          updateHolding(h.id, { currentPrice: Math.round(quote.price) });
        }
      } catch (e) {
        console.warn(`Price fetch failed for ${symbol}:`, e);
      }
    }
    setPriceLoading(false);
  };

  // 환율 (USD→KRW)
  const [usdKrw, setUsdKrw] = useState(1450); // 기본값
  useEffect(() => {
    import("../../../services/marketApi").then(({ getExchangeRate }) =>
      getExchangeRate("USD", "KRW").then((r) => { if (r.rate > 0) setUsdKrw(r.rate); }).catch(() => {})
    );
  }, []);

  // 종목이 미장인지 판별
  const isKrStock = (name: string) => {
    const sym = name.match(/\(([^)]+)\)$/)?.[1] || "";
    return sym.endsWith(".KS") || sym.endsWith(".KQ") || !sym; // 심볼 없으면 한국으로 간주
  };

  // 국장/미장 분리
  const krHoldings = holdings.filter((h) => isKrStock(h.name));
  const usHoldings = holdings.filter((h) => !isKrStock(h.name));

  // 미장 원화 환산 평가액
  const getKrwValue = (h: typeof holdings[0]) => {
    if (isKrStock(h.name)) return h.currentPrice * h.quantity;
    return Math.round(h.currentPrice * h.quantity * usdKrw);
  };

  // 마운트 시 currentPrice=0인 종목 자동 현재가 fetch
  const autoFetchDone = useRef(false);
  useEffect(() => {
    if (autoFetchDone.current || holdings.length === 0 || isGuest) return;
    const needsFetch = holdings.some((h) => h.currentPrice === 0);
    if (needsFetch) {
      autoFetchDone.current = true;
      fetchCurrentPrices();
    }
  }, [holdings.length]);

  // Sell state
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [sellForm, setSellForm] = useState({
    quantity: "",
    price: "",
    destination: "cash" as "cash" | "reinvest" | "savings",
  });
  const [sellToast, setSellToast] = useState<string | null>(null);

  // Current portfolio calculations
  const totalInvested = holdings.reduce(
    (sum, h) => sum + h.avgPrice * h.quantity,
    0
  );
  const totalCurrent = holdings.reduce(
    (sum, h) => sum + h.currentPrice * h.quantity,
    0
  );
  const totalReturn = totalCurrent - totalInvested;
  const totalReturnPct =
    totalInvested > 0 ? ((totalReturn / totalInvested) * 100).toFixed(2) : "0";
  const isProfit = totalReturn >= 0;

  // Current portfolio allocation by category
  const allocationMap = new Map<string, number>();
  holdings.forEach((h) => {
    const label = CATEGORY_LABELS[h.category] || h.category;
    const val = h.currentPrice * h.quantity;
    allocationMap.set(label, (allocationMap.get(label) || 0) + val);
  });
  const allocationData = Array.from(allocationMap.entries())
    .map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name] || "#999",
    }))
    .sort((a, b) => b.value - a.value);

  // Pension portfolio calculations
  const pensionInvested = pensionFunds.reduce(
    (sum, h) => sum + h.avgPrice * h.quantity, 0
  );
  const pensionCurrent = totalPension;
  const pensionReturn = pensionCurrent - pensionInvested;
  const pensionReturnPct =
    pensionInvested > 0 ? ((pensionReturn / pensionInvested) * 100).toFixed(2) : "0";
  const isPensionProfit = pensionReturn >= 0;

  // Pension allocation by account type
  const pensionAllocMap = new Map<string, number>();
  pensionFunds.forEach((h) => {
    const label = PENSION_ACCOUNT_LABELS[h.accountType] || h.accountType;
    const val = h.currentPrice * h.quantity;
    pensionAllocMap.set(label, (pensionAllocMap.get(label) || 0) + val);
  });
  const pensionAllocData = Array.from(pensionAllocMap.entries())
    .map(([name, value]) => ({
      name,
      value,
      color: PENSION_CATEGORY_COLORS[
        Object.keys(PENSION_ACCOUNT_LABELS).find(
          (k) => PENSION_ACCOUNT_LABELS[k] === name
        ) || ""
      ] || "#999",
    }))
    .sort((a, b) => b.value - a.value);

  // Combined total - use store's totalNetWorth
  const combinedTotal = totalNetWorth;

  // Trade history summary
  const tradeSummary = useMemo(() => {
    const sells = trades.filter((t) => t.type === "sell" && t.realizedPnl !== undefined);
    const totalGains = sells
      .filter((t) => (t.realizedPnl || 0) > 0)
      .reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const totalLosses = sells
      .filter((t) => (t.realizedPnl || 0) < 0)
      .reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const netPnl = totalGains + totalLosses;
    return { totalGains, totalLosses, netPnl };
  }, [trades]);

  const handleAddHolding = () => {
    if (!newHolding.name.trim()) return;
    // Include symbol in name for price lookup: "삼성전자 (005930.KS)"
    const displayName = newHolding.symbol
      ? `${newHolding.name} (${newHolding.symbol})`
      : newHolding.name;
    const h: Holding = {
      id: crypto.randomUUID(),
      name: displayName,
      category: newHolding.category,
      quantity: parseFloat(newHolding.quantity) || 0,
      avgPrice: parseInt(newHolding.avgPrice.replace(/,/g, "")) || 0,
      currentPrice: parseInt(newHolding.currentPrice.replace(/,/g, "")) || 0,
    };
    storeBuyHolding(h);
    setNewHolding({
      name: "",
      symbol: "",
      category: "stock",
      quantity: "",
      avgPrice: "",
      currentPrice: "",
    });
    setShowForm(false);
  };

  const removeHolding = (id: string) => {
    storeRemoveHolding(id);
  };

  // Sell handlers
  const openSellForm = (h: Holding) => {
    setSellingId(h.id);
    setSellForm({
      quantity: "",
      price: h.currentPrice.toString(),
      destination: "cash",
    });
  };

  const handleSell = (h: Holding) => {
    const sellQty = parseFloat(sellForm.quantity) || 0;
    const sellPrice = parseInt(sellForm.price.replace(/,/g, "")) || 0;
    if (sellQty <= 0 || sellQty > h.quantity) return;

    const realizedPnl = (sellPrice - h.avgPrice) * sellQty;

    // Use store action – it handles trade creation, holding update, and cash update
    storeSellHolding(h.id, sellQty, sellPrice, sellForm.destination);

    setSellingId(null);

    // Show toast
    const pnlStr = realizedPnl >= 0 ? `+${formatKRW(realizedPnl)}` : formatKRW(realizedPnl);
    setSellToast(`${sellQty}주 매도 완료. 실현 손익: ${pnlStr}원`);
    setTimeout(() => setSellToast(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Sell toast */}
      <AnimatePresence>
        {sellToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-card border border-primary/30 shadow-lg rounded-xl px-4 py-3 flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs font-medium">{sellToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Portfolio timestamp */}
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-[10px] text-muted-foreground/50 font-mono">
          기준: {new Date().toLocaleDateString("ko-KR")} 장마감
        </span>
      </div>

      {/* ================================================================ */}
      {/* Side-by-side: Current Portfolio vs Pension Portfolio */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Current Portfolio */}
        <motion.div
          className="bg-card rounded-xl p-5 space-y-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">현재 포트폴리오</h3>
          </div>

          {/* Value + return */}
          <div>
            <p className="text-xl font-mono font-extrabold">
              {isGuest ? maskAmount(totalCurrent) : `${formatKRW(totalCurrent)}원`}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              {isProfit ? (
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              )}
              <span
                className={`text-xs font-mono font-bold ${
                  isProfit ? "text-primary" : "text-destructive"
                }`}
              >
                {isProfit ? "+" : ""}
                {totalReturnPct}%
              </span>
            </div>
          </div>

          {/* Donut */}
          <div className="flex items-center gap-3">
            <div className="w-28 h-28 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={48}
                    paddingAngle={2}
                    dataKey="value"
                    animationDuration={800}
                  >
                    {allocationData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [isGuest ? "₩•••••••" : `${formatKRW(val)}원`, "평가액"]}
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
            <div className="flex-1 space-y-1">
              {allocationData.map((item) => {
                const pct = totalCurrent > 0 ? ((item.value / totalCurrent) * 100).toFixed(1) : "0";
                return (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[10px] flex-1">{item.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Holdings list (compact) */}
          <div className="space-y-1.5 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground font-medium">보유 종목</p>
              {holdings.length > 0 && (
                <button
                  onClick={fetchCurrentPrices}
                  disabled={priceLoading}
                  className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  {priceLoading ? "업데이트 중..." : "📊 현재가 업데이트"}
                </button>
              )}
            </div>
            {/* 국장 */}
            {krHoldings.length > 0 && (
              <p className="text-[9px] text-muted-foreground/60 font-mono mt-1">국장 (KRW)</p>
            )}
            {krHoldings.map((h) => {
              const totalValue = h.currentPrice * h.quantity;
              const invested = h.avgPrice * h.quantity;
              const returnPct = invested > 0 ? (((totalValue - invested) / invested) * 100).toFixed(1) : "0";
              const isUp = totalValue >= invested;
              return (
                <div key={h.id} className="flex items-center justify-between py-1 group">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[h.category] || "#999" }} />
                    <span className="text-[10px] truncate">{h.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-mono">{isGuest ? "₩•••" : `${formatKRW(totalValue)}원`}</span>
                    <span className={`text-[10px] font-mono ${isUp ? "text-primary" : "text-destructive"}`}>{isUp ? "+" : ""}{returnPct}%</span>
                    <button onClick={() => removeHolding(h.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              );
            })}
            {/* 미장 */}
            {usHoldings.length > 0 && (
              <p className="text-[9px] text-muted-foreground/60 font-mono mt-2">미장 (USD · {formatKRW(Math.round(usdKrw))}원/달러)</p>
            )}
            {usHoldings.map((h) => {
              const usdValue = h.currentPrice * h.quantity;
              const krwValue = getKrwValue(h);
              const invested = h.avgPrice * h.quantity;
              const returnPct = invested > 0 ? (((usdValue - invested) / invested) * 100).toFixed(1) : "0";
              const isUp = usdValue >= invested;
              return (
                <div key={h.id} className="flex items-center justify-between py-1 group">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[h.category] || "#999" }} />
                    <span className="text-[10px] truncate">{h.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] font-mono">{isGuest ? "$•••" : `$${h.currentPrice.toLocaleString()}`}</span>
                      <span className="text-[8px] text-muted-foreground ml-1">({isGuest ? "₩•••" : `₩${formatKRW(krwValue)}`})</span>
                    </div>
                    <span className={`text-[10px] font-mono ${isUp ? "text-primary" : "text-destructive"}`}>{isUp ? "+" : ""}{returnPct}%</span>
                    <button onClick={() => removeHolding(h.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Right: Pension Portfolio */}
        <motion.div
          className="bg-card rounded-xl p-5 space-y-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#BB8FCE]" />
            <h3 className="text-sm font-medium">연금 포트폴리오</h3>
          </div>

          {/* Value + return */}
          <div>
            <p className="text-xl font-mono font-extrabold">
              {isGuest ? maskAmount(pensionCurrent) : `${formatKRW(pensionCurrent)}원`}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              {isPensionProfit ? (
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              )}
              <span
                className={`text-xs font-mono font-bold ${
                  isPensionProfit ? "text-primary" : "text-destructive"
                }`}
              >
                {isPensionProfit ? "+" : ""}
                {pensionReturnPct}%
              </span>
            </div>
          </div>

          {/* Donut */}
          <div className="flex items-center gap-3">
            <div className="w-28 h-28 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pensionAllocData}
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={48}
                    paddingAngle={2}
                    dataKey="value"
                    animationDuration={800}
                  >
                    {pensionAllocData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [isGuest ? "₩•••••••" : `${formatKRW(val)}원`, "평가액"]}
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
            <div className="flex-1 space-y-1">
              {pensionAllocData.map((item) => {
                const pct = pensionCurrent > 0 ? ((item.value / pensionCurrent) * 100).toFixed(1) : "0";
                return (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[10px] flex-1">{item.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pension fund list */}
          <div className="space-y-1.5 pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground font-medium">보유 펀드</p>
            {pensionFunds.map((h) => {
              const totalValue = h.currentPrice * h.quantity;
              const invested = h.avgPrice * h.quantity;
              const returnAmt = totalValue - invested;
              const returnPct =
                invested > 0 ? ((returnAmt / invested) * 100).toFixed(1) : "0";
              const isUp = returnAmt >= 0;
              return (
                <div key={h.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PENSION_CATEGORY_COLORS[h.accountType] || "#999" }}
                    />
                    <span className="text-[10px] truncate">{h.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-mono">{isGuest ? "₩•••" : formatKRW(totalValue)}</span>
                    <span className={`text-[10px] font-mono ${isUp ? "text-primary" : "text-destructive"}`}>
                      {isUp ? "+" : ""}{returnPct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ================================================================ */}
      {/* Combined Total */}
      {/* ================================================================ */}
      <motion.div
        className="bg-card rounded-xl p-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">총 자산 합계</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-mono font-extrabold">
              {isGuest ? maskAmount(combinedTotal) : `${formatKRW(combinedTotal)}원`}
            </p>
            <div className="flex items-center justify-end gap-3 mt-0.5 text-[10px] text-muted-foreground font-mono">
              <span>투자 {isGuest ? "₩•••" : formatKRW(totalInvestment)}</span>
              <span>+</span>
              <span>연금 {isGuest ? "₩•••" : formatKRW(totalPension)}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ================================================================ */}
      {/* Holdings list (full detail) with Sell feature */}
      {/* ================================================================ */}
      <div className="bg-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold">보유 종목 관리</h4>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            종목 추가
          </button>
        </div>

        {/* Add form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-4 space-y-3 bg-muted/50 rounded-lg p-4 overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative sm:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    종목 검색 {symbolSearching && <span className="text-primary">검색 중...</span>}
                  </label>
                  <input
                    type="text"
                    value={newHolding.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="종목명을 입력하면 자동 검색됩니다 (예: 삼성전자, AAPL)"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {newHolding.symbol && (
                    <p className="text-[10px] text-primary font-mono mt-0.5">선택됨: {newHolding.symbol}</p>
                  )}
                  {/* Search results dropdown */}
                  {symbolSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                      {symbolSearchResults.map((r) => (
                        <button
                          key={r.symbol}
                          type="button"
                          onClick={async () => {
                            setNewHolding({ ...newHolding, name: r.name, symbol: r.symbol });
                            setSymbolSearchResults([]);
                            // Auto-fetch current price
                            try {
                              const { getQuote } = await import("../../../services/yahooFinanceApi");
                              const quote = await getQuote(r.symbol);
                              if (quote.price > 0) {
                                setNewHolding((prev) => ({
                                  ...prev,
                                  name: r.name,
                                  symbol: r.symbol,
                                  currentPrice: String(Math.round(quote.price)),
                                }));
                              }
                            } catch (e) {
                              console.warn("Auto price fetch failed:", e);
                            }
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                        >
                          <span>{r.name}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{r.symbol}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    카테고리
                  </label>
                  <select
                    value={newHolding.category}
                    onChange={(e) =>
                      setNewHolding({ ...newHolding, category: e.target.value as Holding["category"] })
                    }
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    수량
                  </label>
                  <input
                    type="text"
                    value={newHolding.quantity}
                    onChange={(e) =>
                      setNewHolding({ ...newHolding, quantity: e.target.value })
                    }
                    placeholder="10"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    평균 매입가
                  </label>
                  <input
                    type="text"
                    value={newHolding.avgPrice}
                    onChange={(e) =>
                      setNewHolding({ ...newHolding, avgPrice: e.target.value })
                    }
                    placeholder="68000"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    현재가
                  </label>
                  <input
                    type="text"
                    value={newHolding.currentPrice}
                    onChange={(e) =>
                      setNewHolding({
                        ...newHolding,
                        currentPrice: e.target.value,
                      })
                    }
                    placeholder="72500"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowForm(false)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleAddHolding}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  추가
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Holdings with sell button */}
        <div className="space-y-2">
          {holdings.map((h, i) => {
            const totalValue = h.currentPrice * h.quantity;
            const invested = h.avgPrice * h.quantity;
            const returnAmt = totalValue - invested;
            const returnPct =
              invested > 0 ? ((returnAmt / invested) * 100).toFixed(2) : "0";
            const isUp = returnAmt >= 0;
            const isSelling = sellingId === h.id;

            // Sell form calculations
            const sellQty = parseFloat(sellForm.quantity) || 0;
            const sellPrice = parseInt((sellForm.price || "0").replace(/,/g, "")) || 0;
            const sellTotal = sellPrice * sellQty;
            const sellPnl = (sellPrice - h.avgPrice) * sellQty;
            const sellPnlPct = h.avgPrice > 0 ? (((sellPrice - h.avgPrice) / h.avgPrice) * 100).toFixed(2) : "0";
            const isSellProfit = sellPnl >= 0;

            return (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3 py-2.5 group">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: CATEGORY_COLORS[h.category] || "#999",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {h.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {CATEGORY_LABELS[h.category] || h.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 mt-0.5 text-[10px] sm:text-xs text-muted-foreground font-mono flex-wrap">
                      <span>{h.quantity}주</span>
                      <span>평균 {isKrStock(h.name) ? formatKRW(h.avgPrice) : `$${h.avgPrice.toLocaleString()}`}</span>
                      <span>현재 {isKrStock(h.name) ? formatKRW(h.currentPrice) : `$${h.currentPrice.toLocaleString()}`}</span>
                      {!isKrStock(h.name) && <span className="text-primary/60">({formatKRW(Math.round(usdKrw))}원/$)</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-mono font-bold tabular-nums">
                      {isGuest ? maskAmount(getKrwValue(h)) : `${formatKRW(getKrwValue(h))}원`}
                    </p>
                    {!isKrStock(h.name) && (
                      <p className="text-[9px] text-muted-foreground font-mono">${(h.currentPrice * h.quantity).toLocaleString()}</p>
                    )}
                    <p
                      className={`text-xs font-mono tabular-nums ${
                        isUp ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {isUp ? "+" : ""}
                      {returnPct}%
                    </p>
                  </div>
                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => isSelling ? setSellingId(null) : openSellForm(h)}
                      className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors min-h-[28px] ${
                        isSelling
                          ? "bg-muted text-muted-foreground"
                          : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                      }`}
                    >
                      {isSelling ? "취소" : "매도"}
                    </button>
                    <button
                      onClick={() => removeHolding(h.id)}
                      className="p-1"
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>

                {/* Inline sell form */}
                <AnimatePresence>
                  {isSelling && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-muted/30 rounded-lg p-4 mb-2 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">
                              매도 수량 (최대 {h.quantity})
                            </label>
                            <input
                              type="text"
                              value={sellForm.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                const num = parseFloat(val) || 0;
                                if (num <= h.quantity) {
                                  setSellForm({ ...sellForm, quantity: val });
                                }
                              }}
                              placeholder={`최대 ${h.quantity}`}
                              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">
                              매도가
                            </label>
                            <input
                              type="text"
                              value={sellForm.price}
                              onChange={(e) =>
                                setSellForm({ ...sellForm, price: e.target.value })
                              }
                              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                        </div>

                        {/* Auto-calculated values */}
                        {sellQty > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="bg-background rounded-lg p-2 text-center">
                              <p className="text-[9px] text-muted-foreground">매도 금액</p>
                              <p className="text-xs font-mono font-bold mt-0.5">
                                {isGuest ? maskAmount(sellTotal) : `${formatKRW(sellTotal)}원`}
                              </p>
                            </div>
                            <div className="bg-background rounded-lg p-2 text-center">
                              <p className="text-[9px] text-muted-foreground">실현 손익</p>
                              <p
                                className={`text-xs font-mono font-bold mt-0.5 ${
                                  isSellProfit ? "text-primary" : "text-destructive"
                                }`}
                              >
                                {isGuest ? maskAmount(sellPnl) : `${isSellProfit ? "+" : ""}${formatKRW(sellPnl)}원`}
                              </p>
                            </div>
                            <div className="bg-background rounded-lg p-2 text-center">
                              <p className="text-[9px] text-muted-foreground">수익률</p>
                              <p
                                className={`text-xs font-mono font-bold mt-0.5 ${
                                  isSellProfit ? "text-primary" : "text-destructive"
                                }`}
                              >
                                {isSellProfit ? "+" : ""}
                                {sellPnlPct}%
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Destination selector */}
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-1.5 block">
                            매도 대금 처리
                          </label>
                          <div className="flex gap-1.5">
                            {(["cash", "reinvest", "savings"] as const).map((dest) => (
                              <button
                                key={dest}
                                onClick={() => setSellForm({ ...sellForm, destination: dest })}
                                className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-colors ${
                                  sellForm.destination === dest
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {DESTINATION_LABELS[dest]}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Confirm */}
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleSell(h)}
                            disabled={sellQty <= 0 || sellQty > h.quantity}
                            className="px-4 py-2 text-xs font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            매도 확인
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ================================================================ */}
      {/* Trade History (거래 내역) */}
      {/* ================================================================ */}
      <motion.div
        className="bg-card rounded-xl p-5 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">거래 내역</h3>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground">총 실현 수익</p>
            <p className="text-sm font-mono font-bold text-primary mt-0.5">
              {isGuest ? maskAmount(tradeSummary.totalGains) : `+${formatKRW(tradeSummary.totalGains)}원`}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground">총 실현 손실</p>
            <p className="text-sm font-mono font-bold text-destructive mt-0.5">
              {isGuest ? maskAmount(tradeSummary.totalLosses) : `${formatKRW(tradeSummary.totalLosses)}원`}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground">순 실현 손익</p>
            <p
              className={`text-sm font-mono font-bold mt-0.5 ${
                tradeSummary.netPnl >= 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {isGuest ? maskAmount(tradeSummary.netPnl) : `${tradeSummary.netPnl >= 0 ? "+" : ""}${formatKRW(tradeSummary.netPnl)}원`}
            </p>
          </div>
        </div>

        {/* Trade log */}
        <div className="space-y-1.5">
          {trades.map((trade, i) => {
            const isBuy = trade.type === "buy";
            const pnl = trade.realizedPnl || 0;
            const isPnlProfit = pnl >= 0;

            return (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
              >
                {/* Type icon */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isBuy
                      ? "bg-[#45B7D1]/15"
                      : isPnlProfit
                      ? "bg-primary/15"
                      : "bg-destructive/15"
                  }`}
                >
                  {isBuy ? (
                    <ArrowDownRight className="h-3 w-3 text-[#45B7D1]" />
                  ) : isPnlProfit ? (
                    <ArrowUpRight className="h-3 w-3 text-primary" />
                  ) : (
                    <ArrowUpRight className="h-3 w-3 text-destructive" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isBuy
                          ? "bg-[#45B7D1]/10 text-[#45B7D1]"
                          : isPnlProfit
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {isBuy ? "매수" : "매도"}
                    </span>
                    <span className="text-xs font-medium truncate">
                      {trade.holdingName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-mono">
                    <span>{trade.date}</span>
                    <span>{trade.quantity}주</span>
                    <span>@{formatKRW(trade.price)}</span>
                    {trade.destination && (
                      <span className="text-[9px] bg-muted px-1 py-0.5 rounded">
                        {DESTINATION_LABELS[trade.destination]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount + PnL */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-mono font-bold tabular-nums">
                    {isGuest ? maskAmount(trade.totalAmount) : `${formatKRW(trade.totalAmount)}원`}
                  </p>
                  {!isBuy && trade.realizedPnl !== undefined && (
                    <p
                      className={`text-[10px] font-mono tabular-nums ${
                        isPnlProfit ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {isGuest ? "₩•••" : `${isPnlProfit ? "+" : ""}${formatKRW(pnl)}원`}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default InvestmentView;
