import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useFinancial } from "../../../store/financialStore";
import { useGuestMode } from "../../../hooks/useGuestMode";

const CATEGORY_COLORS: Record<string, string> = {
  식비: "hsl(160, 100%, 22%)",
  교통: "hsl(217, 91%, 53%)",
  쇼핑: "hsl(340, 70%, 50%)",
  카페: "hsl(30, 80%, 50%)",
  문화: "hsl(270, 60%, 50%)",
  생활: "hsl(200, 60%, 45%)",
  경조사: "hsl(50, 70%, 50%)",
  용돈: "hsl(140, 50%, 40%)",
  기타: "hsl(0, 0%, 50%)",
};

const ExpenseAnalysis = () => {
  const { isGuest } = useGuestMode();
  const { state } = useFinancial();

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
        <Lock className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">비공개 콘텐츠입니다</p>
        <p className="text-xs text-muted-foreground/60 mt-1">게스트 모드에서는 열람할 수 없습니다</p>
      </div>
    );
  }
  const expenses = state.expenses.filter((t) => t.type === "expense");
  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);

  // Category breakdown
  const categoryMap = new Map<string, number>();
  expenses.forEach((t) => {
    categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + t.amount);
  });

  const categoryData = Array.from(categoryMap.entries())
    .map(([name, amount]) => ({
      name,
      amount,
      percent: Math.round((amount / totalExpense) * 100),
      color: CATEGORY_COLORS[name] || "hsl(0,0%,50%)",
    }))
    .sort((a, b) => b.amount - a.amount);

  const formatAmount = (n: number) =>
    new Intl.NumberFormat("ko-KR").format(n) + "원";

  // Top category insight
  const topCat = categoryData[0];

  return (
    <div className="space-y-6">
      {/* Total */}
      <div className="bg-card rounded-lg p-5 text-center">
        <p className="text-xs text-muted-foreground font-mono mb-1">이번 달 총 지출</p>
        <p className="text-3xl font-mono font-bold tabular-nums">
          {formatAmount(totalExpense)}
        </p>
      </div>

      {/* Insight */}
      {topCat && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-accent/10 border border-accent/20 rounded-lg px-4 py-3"
        >
          <p className="text-sm">
            💡 <strong>{topCat.name}</strong>이(가) 전체 지출의{" "}
            <strong>{topCat.percent}%</strong>를 차지하고 있어요.
          </p>
        </motion.div>
      )}

      {/* Bar chart */}
      <div className="bg-card rounded-lg p-5">
        <h4 className="text-sm font-mono text-muted-foreground mb-4">카테고리별 지출</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={50}
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(val: number) => formatAmount(val)}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]} animationDuration={800}>
                {categoryData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category breakdown list */}
      <div className="space-y-2">
        {categoryData.map((cat) => (
          <div key={cat.name} className="bg-card rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cat.color }} />
              <span className="text-sm">{cat.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono tabular-nums">{formatAmount(cat.amount)}</span>
              <span className="text-xs text-muted-foreground font-mono w-10 text-right">
                {cat.percent}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExpenseAnalysis;
