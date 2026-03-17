import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { useFinancial, type Expense } from "../../../store/financialStore";

// Keep mockTransactions export for backward compatibility (used by financialStore default init)
export const mockTransactions = [
  { id: "1", type: "expense" as const, amount: 15000, category: "식비", date: "2026-03-17", memo: "점심" },
  { id: "2", type: "expense" as const, amount: 4500, category: "카페", date: "2026-03-17", memo: "아메리카노" },
  { id: "3", type: "income" as const, amount: 3500000, category: "급여", date: "2026-03-15", memo: "3월 급여" },
  { id: "4", type: "expense" as const, amount: 52000, category: "쇼핑", date: "2026-03-16", memo: "운동화" },
  { id: "5", type: "expense" as const, amount: 8000, category: "교통", date: "2026-03-16", memo: "택시" },
  { id: "6", type: "expense" as const, amount: 35000, category: "식비", date: "2026-03-15", memo: "저녁 외식" },
  { id: "7", type: "expense" as const, amount: 120000, category: "생활", date: "2026-03-14", memo: "공과금" },
  { id: "8", type: "expense" as const, amount: 25000, category: "문화", date: "2026-03-13", memo: "영화" },
];

const expenseCategories = ["식비", "교통", "쇼핑", "카페", "문화", "생활", "경조사", "용돈", "기타"];
const incomeCategories = ["급여", "부수입", "투자", "기타"];

const ExpenseInput = () => {
  const { state, addExpense } = useFinancial();
  const transactions = state.expenses;
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");

  const cats = type === "expense" ? expenseCategories : incomeCategories;

  const handleAdd = () => {
    if (!amount || !category) return;
    const expense: Expense = {
      id: Date.now().toString(),
      type,
      amount: parseInt(amount),
      category,
      date,
      memo,
    };
    addExpense(expense);
    setAmount("");
    setCategory("");
    setMemo("");
  };

  const formatAmount = (n: number) =>
    new Intl.NumberFormat("ko-KR").format(n) + "원";

  return (
    <div className="space-y-6">
      {/* Input form */}
      <div className="bg-card rounded-lg p-5 space-y-4">
        {/* Type toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => { setType("expense"); setCategory(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              type === "expense"
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <ArrowDownCircle className="h-4 w-4" /> 지출
          </button>
          <button
            onClick={() => { setType("income"); setCategory(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              type === "income"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <ArrowUpCircle className="h-4 w-4" /> 수입
          </button>
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs text-muted-foreground font-mono mb-1 block">금액</label>
          <input
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs text-muted-foreground font-mono mb-2 block">카테고리</label>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  category === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Date + Memo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">메모</label>
            <input
              type="text"
              placeholder="메모"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <button
          onClick={handleAdd}
          className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" /> 추가
        </button>
      </div>

      {/* Recent transactions */}
      <div>
        <h4 className="text-sm font-mono text-muted-foreground mb-3">최근 내역</h4>
        <div className="space-y-2">
          {transactions.slice(0, 10).map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card rounded-lg px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    t.type === "income" ? "bg-primary" : "bg-destructive"
                  }`}
                />
                <div>
                  <p className="text-sm">{t.memo || t.category}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {t.category} · {t.date}
                  </p>
                </div>
              </div>
              <span
                className={`text-sm font-mono tabular-nums font-medium ${
                  t.type === "income" ? "text-primary" : "text-destructive"
                }`}
              >
                {t.type === "income" ? "+" : "-"}{formatAmount(t.amount)}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExpenseInput;
