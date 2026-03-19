import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Plus, X, AlertTriangle, ChevronLeft, ChevronRight, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useFinancial } from "../../../store/financialStore";
import { useGuestMode } from "../../../hooks/useGuestMode";
import type { Expense, DeductFrom } from "../../../store/financialStore";
import { getNextMonth, getPrevMonth, formatMonthLabel, formatKRW } from "./budgetData";

const formatAmount = (n: number) => new Intl.NumberFormat("ko-KR").format(n) + "원";

const ExpenseAnalysis = () => {
  const { isGuest } = useGuestMode();
  const { state, addExpense, removeExpense } = useFinancial();
  const [showForm, setShowForm] = useState(false);

  // Month selection: current or next
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nextMonth = getNextMonth(currentMonth);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const [newExpense, setNewExpense] = useState({
    category: "식비",
    amount: "",
    memo: "",
    deductFrom: "cashSavings" as DeductFrom,
  });

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
        <Lock className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">비공개 콘텐츠입니다</p>
      </div>
    );
  }

  // Compute effective balance as of selected month
  const monthCashSavings = Math.max(0,
    state.cashSavings
    + state.monthlyBudgets.filter((b) => b.month <= selectedMonth)
        .reduce((s, b) => s + (b.categories.find((c) => c.id === "savings")?.amount ?? 0), 0)
    - state.expenses.filter((e) => e.type === "expense" && e.deductFrom === "cashSavings" && e.date.slice(0, 7) <= selectedMonth)
        .reduce((s, e) => s + e.amount, 0)
  );
  const monthEmergencyFund = Math.max(0,
    state.emergencyFund
    + state.monthlyBudgets.filter((b) => b.month <= selectedMonth)
        .reduce((s, b) => s + (b.categories.find((c) => c.id === "emergency")?.amount ?? 0), 0)
    - state.expenses.filter((e) => e.type === "expense" && e.deductFrom === "emergencyFund" && e.date.slice(0, 7) <= selectedMonth)
        .reduce((s, e) => s + e.amount, 0)
  );

  // Get budget for selected month
  const selectedBudget = state.monthlyBudgets.find((b) => b.month === selectedMonth);
  const budgetCategories = selectedBudget?.categories || [];

  // Separate budget into spending vs allocation
  const allocationIds = new Set(["savings", "investment", "emergency"]);
  const spendingCategories = budgetCategories.filter((c) => !allocationIds.has(c.id));
  const spendingBudget = spendingCategories.reduce((sum, c) => sum + c.amount, 0);

  // Selected month's expenses
  const monthExpenses = state.expenses.filter((t) => t.type === "expense" && t.date.startsWith(selectedMonth));
  const totalExpense = monthExpenses.reduce((sum, t) => sum + t.amount, 0);

  // Split: budget-funded vs asset-funded spending
  const budgetFunded = monthExpenses
    .filter((e) => !e.deductFrom || e.deductFrom === "none")
    .reduce((sum, e) => sum + e.amount, 0);
  const cashFunded = monthExpenses
    .filter((e) => e.deductFrom === "cashSavings")
    .reduce((sum, e) => sum + e.amount, 0);
  const emergencyFunded = monthExpenses
    .filter((e) => e.deductFrom === "emergencyFund")
    .reduce((sum, e) => sum + e.amount, 0);
  const extraSpending = cashFunded + emergencyFunded;

  const spendingRemaining = spendingBudget - budgetFunded;
  const spendingPct = spendingBudget > 0 ? Math.round((budgetFunded / spendingBudget) * 100) : 0;

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

  // Unbudgeted spending
  const budgetCatNames = new Set(budgetCategories.map((c) => c.name));
  const unbudgeted = Array.from(categoryMap.entries())
    .filter(([name]) => !budgetCatNames.has(name))
    .map(([name, amount]) => ({ name, amount }));

  // Available expense categories
  const expenseCategories = [
    ...budgetCategories.map((c) => c.name),
    ...["교통", "카페", "문화", "경조사", "의료", "보험"].filter((c) => !budgetCatNames.has(c)),
  ];

  const handleAddExpense = () => {
    if (!newExpense.amount) return;
    // Date defaults to 1st of selected month if future, or today if current
    const isCurrentMonth = selectedMonth === currentMonth;
    const dateKey = isCurrentMonth
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
      : `${selectedMonth}-01`;
    const expense: Expense = {
      id: crypto.randomUUID(),
      type: "expense",
      amount: parseInt(newExpense.amount.replace(/,/g, "")) || 0,
      category: newExpense.category,
      date: dateKey,
      memo: newExpense.memo,
      deductFrom: newExpense.deductFrom,
    };
    addExpense(expense);
    setNewExpense({ category: "식비", amount: "", memo: "", deductFrom: "cashSavings" });
    setShowForm(false);
  };

  // Month navigation: open (any month with budget or expenses)
  const allExpenseMonths = new Set(state.expenses.map((e) => e.date.slice(0, 7)));
  state.monthlyBudgets.forEach((b) => allExpenseMonths.add(b.month));
  allExpenseMonths.add(currentMonth);
  const sortedMonths = Array.from(allExpenseMonths).sort();
  const currentIdx = sortedMonths.indexOf(selectedMonth);
  const canGoPrev = currentIdx > 0;
  const canGoNext = currentIdx < sortedMonths.length - 1;

  return (
    <div className="space-y-4">
      {/* Month Selector */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => canGoPrev && setSelectedMonth(sortedMonths[currentIdx - 1])}
          disabled={!canGoPrev}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-20 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold font-mono min-w-[100px] text-center">
          {formatMonthLabel(selectedMonth)}
          {selectedMonth > currentMonth && (
            <span className="ml-1.5 text-[10px] text-primary font-normal">(미래)</span>
          )}
          {selectedMonth < currentMonth && (
            <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">(지난달)</span>
          )}
        </span>
        <button
          onClick={() => canGoNext && setSelectedMonth(sortedMonths[currentIdx + 1])}
          disabled={!canGoNext}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-20 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Summary */}
      <div className="bg-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground font-mono">{selectedMonth} 지출 현황</p>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            지출 추가
          </button>
        </div>

        {/* Row 1: 계획 지출 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">계획 지출</span>
            <span className="text-xs font-mono">
              <span className="text-destructive font-bold">{formatAmount(budgetFunded)}</span>
              <span className="text-muted-foreground"> / {formatAmount(spendingBudget)}</span>
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${spendingPct > 100 ? "bg-destructive" : spendingPct > 80 ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${Math.min(spendingPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>잔여 {spendingRemaining >= 0 ? formatAmount(spendingRemaining) : `-${formatAmount(Math.abs(spendingRemaining))}`}</span>
            <span>{spendingPct}%</span>
          </div>
        </div>

        {/* Row 2: 추가 지출 */}
        {extraSpending > 0 && (
          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-amber-500 font-bold">추가 지출</span>
              <span className="text-xs font-mono font-bold text-amber-500">{formatAmount(extraSpending)}</span>
            </div>
            {cashFunded > 0 && (
              <div className="flex items-center justify-between pl-2">
                <span className="text-[10px] text-muted-foreground">현금저축에서</span>
                <span className="text-[10px] font-mono text-muted-foreground">-{formatAmount(cashFunded)}</span>
              </div>
            )}
            {emergencyFunded > 0 && (
              <div className="flex items-center justify-between pl-2">
                <span className="text-[10px] text-muted-foreground">비상금에서</span>
                <span className="text-[10px] font-mono text-muted-foreground">-{formatAmount(emergencyFunded)}</span>
              </div>
            )}
          </div>
        )}

        {/* Row 3: 총 지출 + 잔액 */}
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">이번 달 총 지출</span>
            <span className="text-sm font-mono font-bold text-destructive">{formatAmount(totalExpense)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-primary/5 rounded-lg px-3 py-2">
              <p className="text-[10px] text-muted-foreground">현금저축 잔액 <span className="text-muted-foreground/50">({formatMonthLabel(selectedMonth)})</span></p>
              <p className="text-sm font-mono font-bold text-primary">{formatAmount(monthCashSavings)}</p>
            </div>
            <div className="bg-yellow-500/5 rounded-lg px-3 py-2">
              <p className="text-[10px] text-muted-foreground">비상금 잔액 <span className="text-muted-foreground/50">({formatMonthLabel(selectedMonth)})</span></p>
              <p className="text-sm font-mono font-bold text-yellow-500">{formatAmount(monthEmergencyFund)}</p>
            </div>
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
              {/* Deduct source selector */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">차감 소스</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "cashSavings" as DeductFrom, label: "현금저축", balance: monthCashSavings },
                    { value: "emergencyFund" as DeductFrom, label: "비상금", balance: monthEmergencyFund },
                    { value: "none" as DeductFrom, label: "차감안함", balance: -1 },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewExpense({ ...newExpense, deductFrom: opt.value })}
                      className={`px-2 py-2 rounded-lg border text-xs transition-colors ${
                        newExpense.deductFrom === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      {opt.balance >= 0 && (
                        <div className="text-[10px] font-mono mt-0.5">{formatKRW(opt.balance)}원</div>
                      )}
                    </button>
                  ))}
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
              <div key={exp.id} className="bg-card rounded-lg px-4 py-2.5 flex items-center justify-between group">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 bg-muted rounded">{exp.category}</span>
                    <span className="text-sm">{formatAmount(exp.amount)}</span>
                    {exp.deductFrom && exp.deductFrom !== "none" && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary">
                        {exp.deductFrom === "cashSavings" ? "현금" : "비상금"}
                      </span>
                    )}
                  </div>
                  {exp.memo && <p className="text-[10px] text-muted-foreground mt-0.5">{exp.memo}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">{exp.date}</span>
                  <button
                    onClick={() => removeExpense(exp.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Monthly Analysis History */}
      <MonthlyHistory expenses={state.expenses} budgets={state.monthlyBudgets} currentMonth={currentMonth} />

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

// ---------------------------------------------------------------------------
// Monthly History Component
// ---------------------------------------------------------------------------

function MonthlyHistory({
  expenses,
  budgets,
  currentMonth,
}: {
  expenses: Expense[];
  budgets: { month: string; categories: { name: string; amount: number }[] }[];
  currentMonth: string;
}) {
  const [open, setOpen] = useState(false);

  // Get all months with budget or expense data (excluding current)
  const monthSet = new Set<string>();
  budgets.forEach((b) => { if (b.month < currentMonth) monthSet.add(b.month); });
  expenses
    .filter((e) => e.type === "expense")
    .forEach((e) => {
      const m = e.date.slice(0, 7);
      if (m < currentMonth) monthSet.add(m);
    });

  const months = Array.from(monthSet).sort().reverse();
  if (months.length === 0) return null;

  // Group by year
  const byYear = new Map<string, string[]>();
  months.forEach((m) => {
    const year = m.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(m);
  });

  return (
    <div className="bg-card rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
      >
        <h4 className="text-xs text-muted-foreground font-mono">월별 분석 히스토리</h4>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-4">
              {Array.from(byYear.entries()).map(([year, yearMonths]) => (
                <div key={year}>
                  <p className="text-[10px] text-muted-foreground font-mono mb-2">{year}년</p>
                  <div className="space-y-2">
                    {yearMonths.map((month) => {
                      const budget = budgets.find((b) => b.month === month);
                      const totalBudget = budget?.categories.reduce((s, c) => s + c.amount, 0) ?? 0;
                      const monthExp = expenses.filter((e) => e.type === "expense" && e.date.startsWith(month));
                      const totalSpent = monthExp.reduce((s, e) => s + e.amount, 0);
                      const pct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

                      // Unbudgeted categories
                      const budgetCats = new Set(budget?.categories.map((c) => c.name) ?? []);
                      const unbudgetedCats = new Set(
                        monthExp.filter((e) => !budgetCats.has(e.category)).map((e) => e.category)
                      );

                      return (
                        <div key={month} className="bg-muted/30 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-mono font-medium">{formatMonthLabel(month)}</span>
                            <span className={`text-xs font-mono ${pct > 100 ? "text-destructive" : "text-muted-foreground"}`}>
                              {formatAmount(totalSpent)} / {formatAmount(totalBudget)} ({pct}%)
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct > 100 ? "bg-destructive" : pct > 80 ? "bg-amber-500" : "bg-primary"}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          {unbudgetedCats.size > 0 && (
                            <p className="text-[10px] text-amber-500 mt-1">
                              예산 외: {Array.from(unbudgetedCats).join(", ")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ExpenseAnalysis;
