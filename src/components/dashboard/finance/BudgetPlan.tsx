import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Wallet, PiggyBank, TrendingUp, ChevronLeft, ChevronRight, Calendar, History, ShieldCheck } from "lucide-react";
import {
  type BudgetCategory,
  type MonthlyBudget,
  defaultCategories,
  formatMonthLabel,
  getNextMonth,
  getPrevMonth,
  formatKRW,
} from "./budgetData";
import { useFinancial } from "../../../store/financialStore";

const BudgetPlan = () => {
  const { state, updateBudget } = useFinancial();
  const budgets = state.monthlyBudgets;

  // Current month as "YYYY-MM"
  const currentMonth = "2026-03";
  const nextMonth = getNextMonth(currentMonth);

  // Selected month for editing – default to next month for planning
  const [selectedMonth, setSelectedMonth] = useState(nextMonth);
  const [editMode, setEditMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // All available months (past + current + next for planning)
  const allMonths = useMemo(() => {
    const months = new Set(budgets.map((b) => b.month));
    months.add(nextMonth); // always show next month as plannable
    return Array.from(months).sort();
  }, [budgets, nextMonth]);

  // Get or create budget for selected month
  const selectedBudget = useMemo(() => {
    const existing = budgets.find((b) => b.month === selectedMonth);
    if (existing) return existing;
    // New month: copy from latest existing or use defaults
    const latest = budgets[budgets.length - 1];
    return {
      month: selectedMonth,
      salary1: latest?.salary1 ?? 2500000,
      salary2: latest?.salary2 ?? 2500000,
      categories: latest
        ? latest.categories.map((c) => ({ ...c }))
        : defaultCategories.map((c) => ({ ...c })),
    };
  }, [budgets, selectedMonth]);

  const [salary1, setSalary1] = useState(selectedBudget.salary1);
  const [salary2, setSalary2] = useState(selectedBudget.salary2);
  const [budget, setBudget] = useState<BudgetCategory[]>(selectedBudget.categories);

  // Sync state when selectedMonth changes
  const handleMonthChange = (month: string) => {
    // Save current edits first
    saveCurrent();
    setSelectedMonth(month);
    const b = budgets.find((b) => b.month === month);
    if (b) {
      setSalary1(b.salary1);
      setSalary2(b.salary2);
      setBudget(b.categories.map((c) => ({ ...c })));
    } else {
      const latest = budgets[budgets.length - 1];
      setSalary1(latest?.salary1 ?? 2500000);
      setSalary2(latest?.salary2 ?? 2500000);
      setBudget(
        latest
          ? latest.categories.map((c) => ({ ...c }))
          : defaultCategories.map((c) => ({ ...c }))
      );
    }
    setEditMode(false);
  };

  const saveCurrent = () => {
    const updated: MonthlyBudget = {
      month: selectedMonth,
      salary1,
      salary2,
      categories: budget.map((c) => ({ ...c })),
    };
    updateBudget(selectedMonth, updated);
  };

  const totalIncome = salary1 + salary2;
  const totalBudget = budget.reduce((sum, b) => sum + b.amount, 0);
  const remaining = totalIncome - totalBudget;

  const isPastMonth = selectedMonth < currentMonth;
  const isNextMonth = selectedMonth > currentMonth;

  const handleAmountChange = (id: string, value: string) => {
    const num = parseInt(value.replace(/,/g, "")) || 0;
    setBudget((prev) =>
      prev.map((b) => (b.id === id ? { ...b, amount: num } : b))
    );
  };

  const handlePrevMonth = () => {
    const idx = allMonths.indexOf(selectedMonth);
    if (idx > 0) handleMonthChange(allMonths[idx - 1]);
  };

  const handleNextMonth = () => {
    const idx = allMonths.indexOf(selectedMonth);
    if (idx < allMonths.length - 1) handleMonthChange(allMonths[idx + 1]);
  };

  // Past budget history (excluding selected month)
  const pastBudgets = budgets
    .filter((b) => b.month !== selectedMonth)
    .sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="space-y-6">
      {/* 월 선택기 */}
      <motion.div
        className="bg-card rounded-xl p-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevMonth}
            disabled={allMonths.indexOf(selectedMonth) <= 0}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-bold">{formatMonthLabel(selectedMonth)} 예산 계획</h3>
            </div>
            {isNextMonth && (
              <span className="text-xs text-primary font-medium mt-1 inline-block bg-primary/10 px-2 py-0.5 rounded-full">
                다음 달 계획
              </span>
            )}
            {isPastMonth && (
              <span className="text-xs text-muted-foreground mt-1 inline-block bg-muted px-2 py-0.5 rounded-full">
                지난 기록
              </span>
            )}
            {selectedMonth === currentMonth && (
              <span className="text-xs text-accent font-medium mt-1 inline-block bg-accent/10 px-2 py-0.5 rounded-full">
                이번 달
              </span>
            )}
          </div>
          <button
            onClick={handleNextMonth}
            disabled={allMonths.indexOf(selectedMonth) >= allMonths.length - 1}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </motion.div>

      {/* 월급 입력 (2인) */}
      <div className="bg-card rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold">월급 (2인)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">본인</label>
            <div className="relative">
              <input
                type="text"
                value={formatKRW(salary1)}
                onChange={(e) => setSalary1(parseInt(e.target.value.replace(/,/g, "")) || 0)}
                className="w-full bg-background border border-border rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-base sm:text-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">원</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">배우자</label>
            <div className="relative">
              <input
                type="text"
                value={formatKRW(salary2)}
                onChange={(e) => setSalary2(parseInt(e.target.value.replace(/,/g, "")) || 0)}
                className="w-full bg-background border border-border rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-base sm:text-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">원</span>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">총 월수입</span>
          <span className="text-base sm:text-xl font-mono font-bold text-primary">{formatKRW(totalIncome)}원</span>
        </div>
      </div>

      {/* 예산 배분 */}
      <div className="bg-card rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-bold">월 예산 계획</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (editMode) saveCurrent();
                setEditMode(!editMode);
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
            >
              {editMode ? "저장" : "수정"}
            </button>
          </div>
        </div>

        {/* 예산 비율 바 */}
        <div className="w-full h-4 rounded-full overflow-hidden flex bg-muted">
          {budget.map((b) => {
            const pct = (b.amount / totalIncome) * 100;
            return (
              <motion.div
                key={b.id}
                className="h-full"
                style={{ backgroundColor: b.color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                title={`${b.name} ${Math.round(pct)}%`}
              />
            );
          })}
        </div>

        {/* 카테고리별 */}
        <div className="space-y-3">
          {budget.map((b) => {
            const pct = Math.round((b.amount / totalIncome) * 100);
            return (
              <motion.div
                key={b.id}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <span className="text-xl w-8 text-center">{b.icon}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">{b.name}</span>
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                  {editMode ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={formatKRW(b.amount)}
                        onChange={(e) => handleAmountChange(b.id, e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">원</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: b.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                      <span className="text-sm font-mono tabular-nums w-24 text-right">
                        {formatKRW(b.amount)}원
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* 잔여 */}
        <div className="pt-3 border-t border-border space-y-3">
          {remaining > 0 && (
            <motion.div
              className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="text-lg leading-none mt-0.5">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-500">
                  {formatKRW(remaining)}원이 미배분 상태입니다. 비상금 또는 기타에 배분하세요.
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      setBudget((prev) =>
                        prev.map((b) =>
                          b.id === "emergency"
                            ? { ...b, amount: b.amount + remaining }
                            : b
                        )
                      );
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-medium transition-colors"
                  >
                    비상금에 추가
                  </button>
                  <button
                    onClick={() => {
                      setBudget((prev) =>
                        prev.map((b) =>
                          b.id === "etc"
                            ? { ...b, amount: b.amount + remaining }
                            : b
                        )
                      );
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-medium transition-colors"
                  >
                    기타에 추가
                  </button>
                </div>
              </div>
            </motion.div>
          )}
          {remaining === 0 && (
            <motion.div
              className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="text-lg leading-none">✅</span>
              <p className="text-sm font-medium text-green-500">
                완벽하게 배분되었습니다!
              </p>
            </motion.div>
          )}
          {remaining < 0 && (
            <motion.div
              className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="text-lg leading-none">🚫</span>
              <p className="text-sm font-medium text-red-500">
                예산이 {formatKRW(Math.abs(remaining))}원 초과되었습니다.
              </p>
            </motion.div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">배분 후 잔여</span>
            <span className={`text-lg font-mono font-bold ${
              remaining === 0 ? "text-green-500" : remaining > 0 ? "text-yellow-500" : "text-red-500"
            }`}>
              {remaining >= 0 ? "+" : ""}{formatKRW(remaining)}원
            </span>
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card rounded-xl p-4 text-center">
          <PiggyBank className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="text-[11px] text-muted-foreground mb-1">저축 (현금)</p>
          <p className="text-base font-mono font-bold text-primary">
            {formatKRW(budget.find((b) => b.id === "savings")?.amount || 0)}원
          </p>
        </div>
        <div className="bg-card rounded-xl p-4 text-center">
          <TrendingUp className="h-5 w-5 text-accent mx-auto mb-2" />
          <p className="text-[11px] text-muted-foreground mb-1">투자</p>
          <p className="text-base font-mono font-bold text-accent">
            {formatKRW(budget.find((b) => b.id === "investment")?.amount || 0)}원
          </p>
        </div>
        <div className="bg-card rounded-xl p-4 text-center">
          <ShieldCheck className="h-5 w-5 text-yellow-500 mx-auto mb-2" />
          <p className="text-[11px] text-muted-foreground mb-1">비상금</p>
          <p className="text-base font-mono font-bold text-yellow-500">
            {formatKRW(budget.find((b) => b.id === "emergency")?.amount || 0)}원
          </p>
        </div>
      </div>

      {/* 지난 예산 기록 토글 */}
      <div className="bg-card rounded-xl p-5">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold">월별 예산 기록</h3>
          </div>
          <motion.div
            animate={{ rotate: showHistory ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground -rotate-90" />
          </motion.div>
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              className="space-y-2 mt-4"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {pastBudgets.map((pb, i) => {
                const total = pb.categories.reduce((s, c) => s + c.amount, 0);
                const income = pb.salary1 + pb.salary2;
                const savingsAmt = pb.categories.find((c) => c.id === "savings")?.amount ?? 0;
                const emergencyAmt = pb.categories.find((c) => c.id === "emergency")?.amount ?? 0;
                return (
                  <motion.div
                    key={pb.month}
                    className="flex items-center justify-between py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleMonthChange(pb.month)}
                  >
                    <div>
                      <span className="text-sm font-mono font-medium">{formatMonthLabel(pb.month)}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        수입 {formatKRW(income)}원
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono tabular-nums">{formatKRW(total)}원</span>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-xs text-primary font-mono tabular-nums">
                          저축 {formatKRW(savingsAmt)}
                        </span>
                        <span className="text-xs text-accent font-mono tabular-nums">
                          비상 {formatKRW(emergencyAmt)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BudgetPlan;
