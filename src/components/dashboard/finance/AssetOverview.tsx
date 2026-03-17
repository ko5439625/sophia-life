import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Landmark,
  ShieldCheck,
  Banknote,
  BarChart3,
  Wallet,
} from "lucide-react";
import {
  AreaChart,
  Area,
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

const AssetOverview = () => {
  const { state, totalCash, totalInvestment, totalPension, totalNetWorth } = useFinancial();
  const { isGuest, maskAmount } = useGuestMode();
  const assetHistory = useMemo(() => deriveAssetHistory(state.monthlyBudgets), [state.monthlyBudgets]);

  const defaultPoint = { total: 0, cash: 0, investment: 0, emergency: 0, month: "" };
  const latest = assetHistory[assetHistory.length - 1] ?? defaultPoint;
  const prev = assetHistory[assetHistory.length - 2] ?? defaultPoint;
  const changeRate = prev.total > 0 ? (((latest.total - prev.total) / prev.total) * 100).toFixed(1) : "0.0";
  const isUp = latest.total >= prev.total;

  const cashChangeRate = prev.cash > 0 ? (((latest.cash - prev.cash) / prev.cash) * 100).toFixed(1) : "0.0";
  const investChangeRate = prev.investment > 0
    ? (((latest.investment - prev.investment) / prev.investment) * 100).toFixed(1)
    : "0.0";

  // Pie chart data – use store's live totals for current snapshot
  const pieData = [
    { name: "저축", value: state.cashSavings, color: "#00704A" },
    { name: "비상금", value: state.emergencyFund, color: "#F7DC6F" },
    { name: "투자", value: totalInvestment, color: "#2563EB" },
    { name: "연금", value: totalPension, color: "#BB8FCE" },
  ];

  const liveTotal = totalNetWorth || 1; // avoid division by 0
  const cashPct = Math.round((totalCash / liveTotal) * 100);
  const investPct = Math.round((totalInvestment / liveTotal) * 100);

  return (
    <div className="space-y-6">
      {/* 총 자산 */}
      <motion.div
        className="bg-card rounded-xl p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-sm text-muted-foreground mb-1">총 자산</p>
        <div className="flex items-end gap-3">
          <span className="text-2xl sm:text-3xl font-mono font-extrabold break-all">{isGuest ? maskAmount(latest.total) : `${formatKRW(latest.total)}원`}</span>
          <span className={`flex items-center gap-1 text-sm font-mono font-medium ${isUp ? "text-primary" : "text-destructive"}`}>
            {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {isUp ? "+" : ""}{changeRate}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">전월 대비</p>
      </motion.div>

      {/* 현금 vs 투자 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <motion.div
          className="bg-card rounded-xl p-4 border border-primary/20"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-5 w-5 text-primary" />
            <span className="text-xs text-muted-foreground">현금자산</span>
            <span className="text-[10px] text-primary font-mono ml-auto">{cashPct}%</span>
          </div>
          <p className="text-xl font-mono font-bold text-primary">{isGuest ? maskAmount(latest.cash) : `${formatCompact(latest.cash)}원`}</p>
          <p className="text-xs text-muted-foreground mt-1">
            전월 대비 <span className={Number(cashChangeRate) >= 0 ? "text-primary" : "text-destructive"}>
              {Number(cashChangeRate) >= 0 ? "+" : ""}{cashChangeRate}%
            </span>
          </p>
        </motion.div>

        <motion.div
          className="bg-card rounded-xl p-4 border border-accent/20"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-5 w-5 text-accent" />
            <span className="text-xs text-muted-foreground">투자자산</span>
            <span className="text-[10px] text-accent font-mono ml-auto">{investPct}%</span>
          </div>
          <p className="text-xl font-mono font-bold text-accent">{isGuest ? maskAmount(latest.investment) : `${formatCompact(latest.investment)}원`}</p>
          <p className="text-xs text-muted-foreground mt-1">
            전월 대비 <span className={Number(investChangeRate) >= 0 ? "text-primary" : "text-destructive"}>
              {Number(investChangeRate) >= 0 ? "+" : ""}{investChangeRate}%
            </span>
          </p>
        </motion.div>
      </div>

      {/* 자산 구성 + 추이 (좌우 배치) */}
      <div className="bg-card rounded-xl p-5">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          자산 구성 & 추이
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 좌: 파이 차트 */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 text-center">자산 구성</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={40}
                    outerRadius={65}
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
            {/* 비중 텍스트 */}
            <div className="flex justify-center gap-2 sm:gap-4 mt-1 flex-wrap">
              {pieData.map((d) => (
                <div key={d.name} className="text-center">
                  <p className="text-[10px] text-muted-foreground">{d.name}</p>
                  <p className="text-[10px] sm:text-xs font-mono font-bold" style={{ color: d.color }}>
                    {isGuest ? "₩•••" : `${formatCompact(d.value)}원`}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 우: 추이 차트 */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 text-center">자산 추이</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={assetHistory}>
                  <defs>
                    <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00704A" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#00704A" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="emgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F7DC6F" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#F7DC6F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "#8B949E" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => isGuest ? "•••" : `${(v / 10000).toFixed(0)}만`}
                    tick={{ fontSize: 10, fill: "#8B949E" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        savings: "저축 (현금)",
                        emergency: "비상금",
                        investment: "투자",
                      };
                      return [isGuest ? "₩•••••••" : `${formatKRW(value)}원`, labels[name] || name];
                    }}
                    labelFormatter={(label) => {
                      const point = assetHistory.find((h) => h.month === label);
                      return point ? `${label}  ·  총 자산: ${isGuest ? "₩•••••••" : `${formatKRW(point.total)}원`}` : label;
                    }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="savings"
                    stackId="1"
                    stroke="#00704A"
                    strokeWidth={1.5}
                    fill="url(#savGrad)"
                    animationDuration={1200}
                  />
                  <Area
                    type="monotone"
                    dataKey="emergency"
                    stackId="1"
                    stroke="#F7DC6F"
                    strokeWidth={1.5}
                    fill="url(#emgGrad)"
                    animationDuration={1200}
                  />
                  <Area
                    type="monotone"
                    dataKey="investment"
                    stackId="1"
                    stroke="#2563EB"
                    strokeWidth={1.5}
                    fill="url(#invGrad)"
                    animationDuration={1200}
                  />
                  <Legend
                    formatter={(value) => {
                      const labels: Record<string, string> = {
                        savings: "저축",
                        emergency: "비상금",
                        investment: "투자",
                      };
                      return <span className="text-[10px]">{labels[value] || value}</span>;
                    }}
                    iconSize={8}
                    wrapperStyle={{ fontSize: 10 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 세부 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <motion.div
          className="bg-card rounded-xl p-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="h-5 w-5 text-primary" />
            <span className="text-xs text-muted-foreground">누적 저축</span>
          </div>
          <p className="text-lg font-mono font-bold text-primary">{isGuest ? maskAmount(latest.savings) : `${formatCompact(latest.savings)}원`}</p>
          <p className="text-xs text-muted-foreground mt-1">
            월 +{isGuest ? "₩•••••••" : `${formatCompact(latest.savings - prev.savings)}원`}
          </p>
        </motion.div>

        <motion.div
          className="bg-card rounded-xl p-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-yellow-500" />
            <span className="text-xs text-muted-foreground">비상금</span>
          </div>
          <p className="text-lg font-mono font-bold text-yellow-500">{isGuest ? maskAmount(latest.emergency) : `${formatCompact(latest.emergency)}원`}</p>
          <p className="text-xs text-muted-foreground mt-1">
            월 +{isGuest ? "₩•••••••" : `${formatCompact(latest.emergency - prev.emergency)}원`}
          </p>
        </motion.div>
      </div>

      {/* 월별 상세 */}
      <div className="bg-card rounded-xl p-5">
        <h3 className="text-sm font-bold mb-3">월별 기록</h3>
        <div className="space-y-2">
          {[...assetHistory].reverse().map((m, i) => {
            const monthKey = m.month.replace(".", "-");
            const budgetEntry = state.monthlyBudgets.find((b) => b.month === monthKey);
            const monthlySavings = budgetEntry?.categories.find((c) => c.id === "savings")?.amount ?? 0;
            const monthlyEmergency = budgetEntry?.categories.find((c) => c.id === "emergency")?.amount ?? 0;

            return (
              <motion.div
                key={m.month}
                className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <div>
                  <span className="text-sm font-mono text-muted-foreground">{m.month}</span>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    +저축 {isGuest ? "₩•••" : formatCompact(monthlySavings)} / +비상 {isGuest ? "₩•••" : formatCompact(monthlyEmergency)}
                  </p>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="text-right">
                    <span className="text-sm font-mono tabular-nums font-medium">{isGuest ? "₩•••••••" : `${formatCompact(m.total)}원`}</span>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-[10px] text-primary font-mono">현금 {isGuest ? "₩•••" : formatCompact(m.cash)}</span>
                      <span className="text-[10px] text-accent font-mono">투자 {isGuest ? "₩•••" : formatCompact(m.investment)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AssetOverview;
