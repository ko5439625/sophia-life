import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Plus, X, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useFinancial } from "../../../store/financialStore";
import { useGuestMode } from "../../../hooks/useGuestMode";
import type { Expense } from "../../../store/financialStore";

const formatAmount = (n: number) => new Intl.NumberFormat("ko-KR").format(n) + "원";

const ExpenseAnalysis = () => {
  const { isGuest } = useGuestMode();
  const { state, addExpense } = useFinancial();
  const [showForm, setShowForm] = useState(false);
  const [newExpense, setNewExpense] = useState({
    category: "식비",
    amount: "",
    memo: "",
  });

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
        <Lock className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">비공개 콘텐츠입니다</p>
      </div>
    );
  }

  // Current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Get budget for current month
  const currentBudget = state.monthlyBudgets.find((b) => b.month === currentMonth);
  const budgetCategories = currentBudget?.categories || [];
  const totalBudget = budgetCategories.reduce((sum, c) => sum + c.amount, 0);

  // This month's expenses
  const monthExpenses = state.expenses.filter((t) => t.type === "expense" && t.date.startsWith(currentMonth));
  const totalExpense = monthExpenses.reduce((sum, t) => sum + t.amount, 0);
  const remaining = totalBudget - totalExpense;
  const usagePct = totalBudget > 0 ? Math.round((totalExpense / totalBudget) * 100) : 0;

  // Category breakdown: budget vs actual
  const categoryMap = new Map<string, number>();
  monthExpenses.forEach((t) => {
    categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + t.amount);
  });

  const categoryComparison = budgetCategories.map((bc) => {
    const spent = categoryMap.get(bc.name) || 0;
    const pct = bc.amount > 0 ? Math.round((spent / bc.amount) * 100) : 0;
    return {
      name: bc.name,
      icon: bc.icon,
      budget: bc.amount,
      spent,
      remaining: bc.amount - spent,
      pct,
      over: spent > bc.amount,
    };
  });

  // Unbudgeted spending (categories not in budget)
  const budgetCatNames = new Set(budgetCategories.map((c) => c.name));
  const unbudgeted = Array.from(categoryMap.entries())
    .filter(([name]) => !budgetCatNames.has(name))
    .map(([name, amount]) => ({ name, amount }));

  // Available expense categories (from budget + custom)
  const expenseCategories = [
    ...budgetCategories.map((c) => c.name),
    ...["교통", "카페", "문화", "경조사", "의료", "보험"].filter((c) => !budgetCatNames.has(c)),
  ];

  const handleAddExpense = () => {
    if (!newExpense.amount) return;
    const d = new Date();
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const expense: Expense = {
      id: crypto.randomUUID(),
      type: "expense",
      amount: parseInt(newExpense.amount.replace(/,/g, "")) || 0,
      category: newExpense.category,
      date: dateKey,
      memo: newExpense.memo,
    };
    addExpense(expense);
    setNewExpense({ category: "식비", amount: "", memo: "" });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground font-mono">{currentMonth} 지출 현황</p>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            지출 추가
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground">예산</p>
            <p className="text-sm font-mono font-bold">{formatAmount(totalBudget)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">지출</p>
            <p className="text-sm font-mono font-bold text-destructive">{formatAmount(totalExpense)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">잔여</p>
            <p className={`text-sm font-mono font-bold ${remaining >= 0 ? "text-primary" : "text-destructive"}`}>
              {remaining >= 0 ? formatAmount(remaining) : `-${formatAmount(Math.abs(remaining))}`}
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>사용률</span>
            <span>{usagePct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usagePct > 100 ? "bg-destructive" : usagePct > 80 ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${Math.min(usagePct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Add expense form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold">지출 추가</h4>
                <button onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">카테고리</label>
                  <select
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {expenseCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">금액</label>
                  <input
                    type="text"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value.replace(/[^\d]/g, "") })}
                    placeholder="50000"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">메모 (왜 추가됐는지)</label>
                <input
                  type="text"
                  value={newExpense.memo}
                  onChange={(e) => setNewExpense({ ...newExpense, memo: e.target.value })}
                  placeholder="예: 친구 결혼식 축의금"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <button
                onClick={handleAddExpense}
                disabled={!newExpense.amount}
                className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
              >
                추가
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category budget vs actual */}
      {categoryComparison.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs text-muted-foreground font-mono">카테고리별 예산 vs 실적</h4>
          {categoryComparison.map((cat) => (
            <div key={cat.name} className="bg-card rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{cat.icon}</span>
                  <span className="text-sm font-medium">{cat.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">{formatAmount(cat.spent)}</span>
                  <span className="text-[10px] text-muted-foreground">/</span>
                  <span className="text-xs font-mono">{formatAmount(cat.budget)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${cat.over ? "bg-destructive" : cat.pct > 80 ? "bg-amber-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(cat.pct, 100)}%` }}
                />
              </div>
              {cat.over && (
                <p className="text-[10px] text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  {formatAmount(Math.abs(cat.remaining))} 초과
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Unbudgeted spending */}
      {unbudgeted.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs text-muted-foreground font-mono">예산 외 지출</h4>
          {unbudgeted.map((item) => (
            <div key={item.name} className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm">{item.name}</span>
              <span className="text-sm font-mono">{formatAmount(item.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent expenses */}
      {monthExpenses.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs text-muted-foreground font-mono">최근 지출 내역</h4>
          {monthExpenses
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 10)
            .map((exp) => (
              <div key={exp.id} className="bg-card rounded-lg px-4 py-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 bg-muted rounded">{exp.category}</span>
                    <span className="text-sm">{formatAmount(exp.amount)}</span>
                  </div>
                  {exp.memo && <p className="text-[10px] text-muted-foreground mt-0.5">{exp.memo}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">{exp.date}</span>
              </div>
            ))}
        </div>
      )}

      {/* Empty state */}
      {monthExpenses.length === 0 && categoryComparison.length === 0 && (
        <div className="text-center py-10">
          <p className="text-sm text-muted-foreground">이번 달 지출 내역이 없습니다</p>
          <p className="text-xs text-muted-foreground/60 mt-1">예산 계획을 먼저 세우고, 지출을 기록해보세요</p>
        </div>
      )}
    </div>
  );
};

export default ExpenseAnalysis;
