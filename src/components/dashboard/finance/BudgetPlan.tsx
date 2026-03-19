import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Wallet, PiggyBank, TrendingUp, ChevronLeft, ChevronRight, Calendar, History, ShieldCheck, Copy, Check } from "lucide-react";
import {
  type BudgetCategory,
  type MonthlyBudget,
  defaultCategories,
  formatMonthLabel,
  getNextMonth,
  formatKRW,
} from "./budgetData";
import { useFinancial } from "../../../store/financialStore";
import { useGuestMode } from "../../../hooks/useGuestMode";

const BudgetPlan = () => {
  const { state, updateBudget } = useFinancial();
  const { isGuest, maskAmount } = useGuestMode();
  const budgets = state.monthlyBudgets;

  // Dynamic current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nextMonth = getNextMonth(currentMonth);

  const [selectedMonth, setSelectedMonth] = useState(nextMonth);
  const [editMode, setEditMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBulkApply, setShowBulkApply] = useState(false);
  const [bulkEndMonth, setBulkEndMonth] = useState("");
  const [bulkApplied, setBulkApplied] = useState(false);

  // All available months: past budgets + current + up to 12 months ahead
  const allMonths = useMemo(() => {
    const months = new Set(budgets.map((b) => b.month));
    // Add current + next 12 months as plannable
    let m = currentMonth;
    for (let i = 0; i < 13; i++) {
      months.add(m);
      m = getNextMonth(m);
    }
    return Array.from(months).sort();
  }, [budgets, currentMonth]);

  // Generate end-month options for bulk apply (from next month to 12 months ahead)
  const bulkEndOptions = useMemo(() => {
    const opts: string[] = [];
    let m = getNextMonth(selectedMonth);
    const maxYear = now.getFullYear() + 2;
    while (m <= `${maxYear}-12`) {
      opts.push(m);
      m = getNextMonth(m);
      if (opts.length >= 24) break;
    }
    return opts;
  }, [selectedMonth]);

  // Get or create budget for selected month
  const selectedBudget = useMemo(() => {
    const existing = budgets.find((b) => b.month === selectedMonth);
    if (existing) return existing;
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

  const handleMonthChange = (month: string) => {
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
    setBulkApplied(false);
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

  // 자동 저장: salary/budget 변경 시 1초 후 자동 반영
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveCurrent();
    }, 1000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [salary1, salary2, budget, selectedMonth]);

  // Bulk apply: copy current budget to all months from selectedMonth+1 to endMonth
  const handleBulkApply = () => {
    if (!bulkEndMonth) return;
    saveCurrent(); // Save current first

    let m = getNextMonth(selectedMonth);
    while (m <= bulkEndMonth) {
      const copied: MonthlyBudget = {
        month: m,
        salary1,
        salary2,
        categories: budget.map((c) => ({ ...c })),
      };
      updateBudget(m, copied);
      m = getNextMonth(m);
    }
    setBulkApplied(true);
    setTimeout(() => setBulkApplied(false), 3000);
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
                {selectedMonth > nextMonth ? "미래 계획" : "다음 달 계획"}
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
                value={isGuest ? "•••••••" : formatKRW(salary1)}
                onChange={(e) => !isGuest && setSalary1(parseInt(e.target.value.replace(/,/g, "")) || 0)}
                readOnly={isGuest}
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
                value={isGuest ? "•••••••" : formatKRW(salary2)}
                onChange={(e) => !isGuest && setSalary2(parseInt(e.target.value.replace(/,/g, "")) || 0)}
                readOnly={isGuest}
                className="w-full bg-background border border-border rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-base sm:text-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">원</span>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">총 월수입</span>
          <span className="text-base sm:text-xl font-mono font-bold text-primary">{isGuest ? maskAmount(totalIncome) : `${formatKRW(totalIncome)}원`}</span>
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
            {!isGuest && (
              <button
                onClick={() => setShowBulkApply(!showBulkApply)}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors flex items-center gap-1"
              >
                <Copy className="h-3 w-3" />
                연간 적용
              </button>
            )}
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

        {/* 연간 적용 패널 */}
        <AnimatePresence>
          {showBulkApply && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  현재 예산을 <strong>{formatMonthLabel(selectedMonth)}</strong>부터 선택한 월까지 동일하게 적용합니다.
                </p>
                <div className="flex items-center gap-3">
                  <select
                    value={bulkEndMonth}
                    onChange={(e) => setBulkEndMonth(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">적용 종료 월 선택</option>
                    {bulkEndOptions.map((m) => (
                      <option key={m} value={m}>{formatMonthLabel(m)}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkApply}
                    disabled={!bulkEndMonth || bulkApplied}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {bulkApplied ? (
                      <><Check className="h-3.5 w-3.5" /> 적용 완료</>
                    ) : (
                      "적용"
                    )}
                  </button>
                </div>
                {bulkEndMonth && (
                  <p className="text-[10px] text-muted-foreground">
                    {formatMonthLabel(getNextMonth(selectedMonth))} ~ {formatMonthLabel(bulkEndMonth)} ({
                      (() => {
                        let count = 0;
                        let m = getNextMonth(selectedMonth);
                        while (m <= bulkEndMonth) { count++; m = getNextMonth(m); }
                        return count;
                      })()
                    }개월)에 동일 예산이 적용됩니다.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  {editMode && !isGuest ? (
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
                        {isGuest ? maskAmount(b.amount) : `${formatKRW(b.amount)}원`}
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
                  {isGuest ? maskAmount(remaining) : `${formatKRW(remaining)}원`}이 미배분 상태입니다.
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      setBudget((prev) =>
                        prev.map((b) =>
                          b.id === "emergency" ? { ...b, amount: b.amount + remaining } : b
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
                          b.id === "etc" ? { ...b, amount: b.amount + remaining } : b
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
              <p className="text-sm font-medium text-green-500">완벽하게 배분되었습니다!</p>
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
                예산이 {isGuest ? maskAmount(Math.abs(remaining)) : `${formatKRW(Math.abs(remaining))}원`} 초과되었습니다.
              </p>
            </motion.div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">배분 후 잔여</span>
            <span className={`text-lg font-mono font-bold ${
              remaining === 0 ? "text-green-500" : remaining > 0 ? "text-yellow-500" : "text-red-500"
            }`}>
              {isGuest ? maskAmount(remaining) : `${remaining >= 0 ? "+" : ""}${formatKRW(remaining)}원`}
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
            {isGuest ? maskAmount(budget.find((b) => b.id === "savings")?.amount || 0) : `${formatKRW(budget.find((b) => b.id === "savings")?.amount || 0)}원`}
          </p>
        </div>
        <div className="bg-card rounded-xl p-4 text-center">
          <TrendingUp className="h-5 w-5 text-accent mx-auto mb-2" />
          <p className="text-[11px] text-muted-foreground mb-1">투자</p>
          <p className="text-base font-mono font-bold text-accent">
            {isGuest ? maskAmount(budget.find((b) => b.id === "investment")?.amount || 0) : `${formatKRW(budget.find((b) => b.id === "investment")?.amount || 0)}원`}
          </p>
        </div>
        <div className="bg-card rounded-xl p-4 text-center">
          <ShieldCheck className="h-5 w-5 text-yellow-500 mx-auto mb-2" />
          <p className="text-[11px] text-muted-foreground mb-1">비상금</p>
          <p className="text-base font-mono font-bold text-yellow-500">
            {isGuest ? maskAmount(budget.find((b) => b.id === "emergency")?.amount || 0) : `${formatKRW(budget.find((b) => b.id === "emergency")?.amount || 0)}원`}
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
                        수입 {isGuest ? maskAmount(income) : `${formatKRW(income)}원`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono tabular-nums">{isGuest ? maskAmount(total) : `${formatKRW(total)}원`}</span>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-xs text-primary font-mono tabular-nums">
                          저축 {isGuest ? "₩•••" : formatKRW(savingsAmt)}
                        </span>
                        <span className="text-xs text-accent font-mono tabular-nums">
                          비상 {isGuest ? "₩•••" : formatKRW(emergencyAmt)}
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
