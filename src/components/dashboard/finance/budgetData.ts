// Shared budget data types and mock monthly budget history

export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  amount: number;
  color: string;
}

export interface MonthlyBudget {
  /** Format: "YYYY-MM" e.g. "2026-03" */
  month: string;
  salary1: number;
  salary2: number;
  categories: BudgetCategory[];
}

export const defaultCategories: BudgetCategory[] = [
  { id: "food", name: "식비", icon: "🍽️", amount: 500000, color: "#FF6B6B" },
  { id: "fixed", name: "고정지출", icon: "🏠", amount: 800000, color: "#4ECDC4" },
  { id: "allowance", name: "용돈", icon: "💸", amount: 300000, color: "#45B7D1" },
  { id: "savings", name: "저축 (현금)", icon: "🏦", amount: 700000, color: "#00704A" },
  { id: "investment", name: "투자", icon: "📈", amount: 300000, color: "#2563EB" },
  { id: "emergency", name: "비상금", icon: "🛡️", amount: 200000, color: "#F7DC6F" },
  { id: "etc", name: "기타", icon: "📦", amount: 200000, color: "#BB8FCE" },
];

/** Mock history – each month is an independent budget plan */
export const mockMonthlyBudgets: MonthlyBudget[] = [
  {
    month: "2025-10",
    salary1: 2400000,
    salary2: 2400000,
    categories: [
      { id: "food", name: "식비", icon: "🍽️", amount: 450000, color: "#FF6B6B" },
      { id: "fixed", name: "고정지출", icon: "🏠", amount: 800000, color: "#4ECDC4" },
      { id: "allowance", name: "용돈", icon: "💸", amount: 250000, color: "#45B7D1" },
      { id: "savings", name: "저축 (현금)", icon: "🏦", amount: 600000, color: "#00704A" },
      { id: "investment", name: "투자", icon: "📈", amount: 300000, color: "#2563EB" },
      { id: "emergency", name: "비상금", icon: "🛡️", amount: 200000, color: "#F7DC6F" },
      { id: "etc", name: "기타", icon: "📦", amount: 200000, color: "#BB8FCE" },
    ],
  },
  {
    month: "2025-11",
    salary1: 2400000,
    salary2: 2400000,
    categories: [
      { id: "food", name: "식비", icon: "🍽️", amount: 480000, color: "#FF6B6B" },
      { id: "fixed", name: "고정지출", icon: "🏠", amount: 800000, color: "#4ECDC4" },
      { id: "allowance", name: "용돈", icon: "💸", amount: 270000, color: "#45B7D1" },
      { id: "savings", name: "저축 (현금)", icon: "🏦", amount: 650000, color: "#00704A" },
      { id: "investment", name: "투자", icon: "📈", amount: 300000, color: "#2563EB" },
      { id: "emergency", name: "비상금", icon: "🛡️", amount: 200000, color: "#F7DC6F" },
      { id: "etc", name: "기타", icon: "📦", amount: 150000, color: "#BB8FCE" },
    ],
  },
  {
    month: "2025-12",
    salary1: 2500000,
    salary2: 2500000,
    categories: [
      { id: "food", name: "식비", icon: "🍽️", amount: 500000, color: "#FF6B6B" },
      { id: "fixed", name: "고정지출", icon: "🏠", amount: 800000, color: "#4ECDC4" },
      { id: "allowance", name: "용돈", icon: "💸", amount: 300000, color: "#45B7D1" },
      { id: "savings", name: "저축 (현금)", icon: "🏦", amount: 700000, color: "#00704A" },
      { id: "investment", name: "투자", icon: "📈", amount: 300000, color: "#2563EB" },
      { id: "emergency", name: "비상금", icon: "🛡️", amount: 200000, color: "#F7DC6F" },
      { id: "etc", name: "기타", icon: "📦", amount: 200000, color: "#BB8FCE" },
    ],
  },
  {
    month: "2026-01",
    salary1: 2500000,
    salary2: 2500000,
    categories: [
      { id: "food", name: "식비", icon: "🍽️", amount: 500000, color: "#FF6B6B" },
      { id: "fixed", name: "고정지출", icon: "🏠", amount: 800000, color: "#4ECDC4" },
      { id: "allowance", name: "용돈", icon: "💸", amount: 300000, color: "#45B7D1" },
      { id: "savings", name: "저축 (현금)", icon: "🏦", amount: 700000, color: "#00704A" },
      { id: "investment", name: "투자", icon: "📈", amount: 300000, color: "#2563EB" },
      { id: "emergency", name: "비상금", icon: "🛡️", amount: 200000, color: "#F7DC6F" },
      { id: "etc", name: "기타", icon: "📦", amount: 200000, color: "#BB8FCE" },
    ],
  },
  {
    month: "2026-02",
    salary1: 2500000,
    salary2: 2500000,
    categories: [
      { id: "food", name: "식비", icon: "🍽️", amount: 520000, color: "#FF6B6B" },
      { id: "fixed", name: "고정지출", icon: "🏠", amount: 800000, color: "#4ECDC4" },
      { id: "allowance", name: "용돈", icon: "💸", amount: 280000, color: "#45B7D1" },
      { id: "savings", name: "저축 (현금)", icon: "🏦", amount: 700000, color: "#00704A" },
      { id: "investment", name: "투자", icon: "📈", amount: 300000, color: "#2563EB" },
      { id: "emergency", name: "비상금", icon: "🛡️", amount: 200000, color: "#F7DC6F" },
      { id: "etc", name: "기타", icon: "📦", amount: 200000, color: "#BB8FCE" },
    ],
  },
  {
    month: "2026-03",
    salary1: 2500000,
    salary2: 2500000,
    categories: [
      { id: "food", name: "식비", icon: "🍽️", amount: 500000, color: "#FF6B6B" },
      { id: "fixed", name: "고정지출", icon: "🏠", amount: 800000, color: "#4ECDC4" },
      { id: "allowance", name: "용돈", icon: "💸", amount: 300000, color: "#45B7D1" },
      { id: "savings", name: "저축 (현금)", icon: "🏦", amount: 700000, color: "#00704A" },
      { id: "investment", name: "투자", icon: "📈", amount: 300000, color: "#2563EB" },
      { id: "emergency", name: "비상금", icon: "🛡️", amount: 200000, color: "#F7DC6F" },
      { id: "etc", name: "기타", icon: "📦", amount: 200000, color: "#BB8FCE" },
    ],
  },
];

/** Helper: format "YYYY-MM" → "YYYY년 M월" */
export const formatMonthLabel = (month: string): string => {
  const [y, m] = month.split("-");
  return `${y}년 ${parseInt(m)}월`;
};

/** Helper: get next month string from "YYYY-MM" */
export const getNextMonth = (month: string): string => {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  return `${next.y}-${String(next.m).padStart(2, "0")}`;
};

/** Helper: get previous month string from "YYYY-MM" */
export const getPrevMonth = (month: string): string => {
  const [y, m] = month.split("-").map(Number);
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  return `${prev.y}-${String(prev.m).padStart(2, "0")}`;
};

export const formatKRW = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

export const formatCompact = (n: number) => {
  if (n >= 10000) return `${(n / 10000).toFixed(0)}만`;
  return formatKRW(n);
};

/** Derive cumulative asset data from monthly budget history */
export interface AssetDataPoint {
  month: string;
  total: number;
  cash: number;       // 현금자산 (저축 + 비상금)
  investment: number;  // 투자자산
  savings: number;
  emergency: number;
}

/** Mock investment data (monthly investment value snapshots) */
export interface InvestmentSnapshot {
  month: string;
  value: number; // 투자 총 평가액
}

export const mockInvestmentSnapshots: InvestmentSnapshot[] = [
  { month: "2025-10", value: 5200000 },
  { month: "2025-11", value: 5450000 },
  { month: "2025-12", value: 5800000 },
  { month: "2026-01", value: 5600000 },
  { month: "2026-02", value: 6100000 },
  { month: "2026-03", value: 6500000 },
];

export const deriveAssetHistory = (
  budgets: MonthlyBudget[],
  investmentSnapshots: InvestmentSnapshot[] = mockInvestmentSnapshots,
): AssetDataPoint[] => {
  const baseSavings = 11100000;
  const baseEmergency = 2300000;

  let cumulativeSavings = baseSavings;
  let cumulativeEmergency = baseEmergency;

  return budgets.map((b) => {
    const savingsAmount = b.categories.find((c) => c.id === "savings")?.amount ?? 0;
    const emergencyAmount = b.categories.find((c) => c.id === "emergency")?.amount ?? 0;
    cumulativeSavings += savingsAmount;
    cumulativeEmergency += emergencyAmount;

    const investmentValue = investmentSnapshots.find((s) => s.month === b.month)?.value ?? 0;
    const cashTotal = cumulativeSavings + cumulativeEmergency;

    return {
      month: b.month.replace("-", "."),
      total: cashTotal + investmentValue,
      cash: cashTotal,
      investment: investmentValue,
      savings: cumulativeSavings,
      emergency: cumulativeEmergency,
    };
  });
};
