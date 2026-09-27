import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useFinancial } from "@/store/financialStore";
import type { Expense } from "@/store/financialStore";
import { defaultCategories } from "@/components/dashboard/finance/budgetData";
import { DAY_NAMES, toDateKey, toMonthKey } from "./homeUtils";

// 예산 배분(저축/투자/비상금)은 지출이 아니므로 빠른 입력 카테고리에서 제외
const ALLOCATION_IDS = new Set(["savings", "emergency", "investment"]);
// ExpenseAnalysis(지출 관리)와 같은 보조 카테고리
const EXTRA_CATEGORIES = ["교통", "카페", "문화", "경조사", "의료", "보험"];
const EXTRA_ICONS: Record<string, string> = {
  교통: "🚕",
  카페: "☕",
  문화: "🎬",
  경조사: "💐",
  의료: "💊",
  보험: "🛡️",
};

interface QuickExpenseSheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function QuickExpenseSheet({ open, onOpenChange }: QuickExpenseSheetProps) {
  const { state, addExpense } = useFinancial();
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("식비");
  const [memo, setMemo] = useState("");

  const now = new Date();
  const monthKey = toMonthKey(now);
  const budget = state.monthlyBudgets.find((b) => b.month === monthKey);

  // 이번 달 예산 카테고리(없으면 앱 기본 카테고리) + 지출 관리의 보조 카테고리
  const categories = useMemo(() => {
    const base = (budget?.categories ?? defaultCategories).filter((c) => !ALLOCATION_IDS.has(c.id));
    const names = new Set(base.map((c) => c.name));
    const list = [
      ...base.map((c) => ({ name: c.name, icon: c.icon })),
      ...EXTRA_CATEGORIES.filter((n) => !names.has(n)).map((n) => ({ name: n, icon: EXTRA_ICONS[n] })),
    ];
    // "기타"는 항상 마지막
    return [...list.filter((c) => c.name !== "기타"), ...list.filter((c) => c.name === "기타")];
  }, [budget]);

  useEffect(() => {
    if (open) {
      setAmount(0);
      setMemo("");
      setCategory((prev) => (categories.some((c) => c.name === prev) ? prev : categories[0]?.name ?? "기타"));
    }
  }, [open, categories]);

  // 선택 카테고리 예산 대비 사용률 (지출 관리와 동일: 카테고리 이름 기준 합산)
  const budgetInfo = useMemo(() => {
    const cat = budget?.categories.find((c) => c.name === category);
    if (!cat || cat.amount <= 0) return null;
    const spent = state.expenses
      .filter((e) => e.type === "expense" && e.date.startsWith(monthKey) && e.category === category)
      .reduce((s, e) => s + e.amount, 0);
    return {
      before: Math.round((spent / cat.amount) * 100),
      after: Math.round(((spent + amount) / cat.amount) * 100),
    };
  }, [budget, category, state.expenses, monthKey, amount]);

  const handleSave = () => {
    if (amount <= 0) return;
    const expense: Expense = {
      id: crypto.randomUUID(),
      type: "expense",
      amount,
      category,
      date: toDateKey(new Date()),
      memo: memo.trim(),
      deductFrom: "none", // 생활비 예산 사용률에 반영 (홈 막대·카테고리 %)
    };
    addExpense(expense);
    toast.success("지출을 기록했어요");
    onOpenChange(false);
  };

  const pctTone = (p: number) => (p > 100 ? "text-red-500" : p >= 90 ? "text-amber-500" : "text-foreground");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92vh] max-w-lg border-border bg-card px-[18px] pb-[max(1.5rem,env(safe-area-inset-bottom))] supports-[height:100dvh]:max-h-[92dvh]">
        <div className="mt-3 mb-3 flex items-center justify-between">
          <DrawerTitle className="text-[17px] font-bold">지출 기록</DrawerTitle>
          <DrawerDescription className="text-[13px]">
            오늘 · {now.getMonth() + 1}/{now.getDate()} ({DAY_NAMES[now.getDay()]})
          </DrawerDescription>
        </div>

        <form
          className="min-h-0 overflow-y-auto overscroll-contain"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <label className="flex items-baseline justify-center gap-1 py-2.5">
            <span className="sr-only">금액</span>
            <input
              inputMode="numeric"
              pattern="[0-9,]*"
              autoComplete="off"
              placeholder="0"
              value={amount > 0 ? amount.toLocaleString("ko-KR") : ""}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/[^\d]/g, ""), 10);
                setAmount(Number.isFinite(n) ? Math.min(n, 999_999_999) : 0);
              }}
              className="min-w-0 max-w-[80%] bg-transparent text-right font-mono !text-[38px] font-bold tabular-nums placeholder:text-muted-foreground/40 focus:outline-none"
              style={{ width: `${Math.max(1, (amount > 0 ? amount.toLocaleString("ko-KR") : "0").length) + 0.5}ch` }}
            />
            <span className="text-xl text-muted-foreground">원</span>
          </label>

          <p className="mb-4 min-h-[18px] text-center text-xs text-muted-foreground">
            {budgetInfo ? (
              <>
                {category} 예산 <span className={pctTone(budgetInfo.before)}>{budgetInfo.before}%</span>
                {amount > 0 && (
                  <>
                    {" "}→ 이번 지출 후 <span className={pctTone(budgetInfo.after)}>{budgetInfo.after}%</span>
                  </>
                )}
              </>
            ) : (
              `${category} · 이번 달 예산 없음`
            )}
          </p>

          <div className="mb-3.5 grid grid-cols-4 gap-2">
            {categories.map((c) => {
              const active = c.name === category;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setCategory(c.name)}
                  aria-pressed={active}
                  className={`flex h-[62px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs font-semibold transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "border border-border bg-background/40 hover:bg-muted"
                  }`}
                >
                  <span className="text-lg leading-none">{c.icon}</span>
                  <span className="max-w-full truncate">{c.name}</span>
                </button>
              );
            })}
          </div>

          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모 (선택) — 예: 성수 파스타"
            className="mb-3.5 min-h-[48px] w-full rounded-xl bg-muted px-3.5 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          <button
            type="submit"
            disabled={amount <= 0}
            className="min-h-[52px] w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground transition-opacity disabled:opacity-40"
          >
            저장
          </button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
