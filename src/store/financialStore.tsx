import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import {
  type MonthlyBudget,
  mockMonthlyBudgets,
  defaultCategories,
} from "@/components/dashboard/finance/budgetData";
import { mockTransactions } from "@/components/dashboard/finance/ExpenseInput";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Holding {
  id: string;
  name: string;
  category: "stock" | "etf" | "bond" | "crypto" | "gold" | "other";
  quantity: number;
  avgPrice: number;
  currentPrice: number;
}

export interface Trade {
  id: string;
  date: string;
  type: "buy" | "sell";
  holdingName: string;
  quantity: number;
  price: number;
  totalAmount: number;
  realizedPnl?: number;
  destination?: "cash" | "reinvest" | "savings";
}

export interface Expense {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  date: string;
  memo: string;
}

export interface OwnedProperty {
  id: string;
  name: string;
  address: string;
  purchasePrice: number;
  currentValue: number;
  purchaseDate: string;
}

export interface PensionFund {
  id: string;
  accountType: "irp" | "pension_savings" | "dc";
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface FinancialState {
  // Budget
  monthlyBudgets: MonthlyBudget[];

  // Cash assets
  cashSavings: number;
  emergencyFund: number;

  // Investment holdings
  holdings: Holding[];
  trades: Trade[];

  // Pension
  pensionFunds: PensionFund[];
  pensionBalance: number;

  // Real estate (owned properties)
  ownedProperties: OwnedProperty[];

  // Expenses
  expenses: Expense[];

  // Settings
  annualIncome1: number;
  annualIncome2: number;
  monthlyLoanPayment: number;
}

// ---------------------------------------------------------------------------
// Default / Initial Data (used when localStorage is empty)
// ---------------------------------------------------------------------------

const DEFAULT_HOLDINGS: Holding[] = [
  { id: "1", name: "Samsung Electronics", category: "stock", quantity: 50, avgPrice: 68000, currentPrice: 72500 },
  { id: "2", name: "TIGER S&P500", category: "etf", quantity: 30, avgPrice: 15200, currentPrice: 16800 },
  { id: "3", name: "KODEX 200", category: "etf", quantity: 20, avgPrice: 35000, currentPrice: 36200 },
  { id: "4", name: "KR Treasury 10Y", category: "bond", quantity: 5, avgPrice: 102000, currentPrice: 103500 },
  { id: "5", name: "Bitcoin", category: "crypto", quantity: 0.05, avgPrice: 85000000, currentPrice: 92000000 },
  { id: "6", name: "Ethereum", category: "crypto", quantity: 0.8, avgPrice: 4200000, currentPrice: 4500000 },
  { id: "7", name: "KG Gold ETF", category: "gold", quantity: 15, avgPrice: 12000, currentPrice: 13200 },
];

const DEFAULT_TRADES: Trade[] = [
  { id: "t1", date: "2026-03-15", type: "buy", holdingName: "Samsung Electronics", quantity: 20, price: 68000, totalAmount: 1360000 },
  { id: "t2", date: "2026-03-10", type: "sell", holdingName: "LG Energy Solution", quantity: 5, price: 420000, totalAmount: 2100000, realizedPnl: 150000, destination: "cash" },
  { id: "t3", date: "2026-03-05", type: "buy", holdingName: "TIGER S&P500", quantity: 15, price: 15800, totalAmount: 237000 },
  { id: "t4", date: "2026-02-28", type: "sell", holdingName: "Kakao", quantity: 30, price: 52000, totalAmount: 1560000, realizedPnl: -180000, destination: "reinvest" },
  { id: "t5", date: "2026-02-20", type: "buy", holdingName: "Bitcoin", quantity: 0.02, price: 88000000, totalAmount: 1760000 },
  { id: "t6", date: "2026-02-15", type: "sell", holdingName: "KODEX 200", quantity: 10, price: 36500, totalAmount: 365000, realizedPnl: 15000, destination: "savings" },
];

const DEFAULT_PENSION_FUNDS: PensionFund[] = [
  { id: "p1", accountType: "pension_savings", name: "Samsung TDF2050", quantity: 500, avgPrice: 12500, currentPrice: 14200 },
  { id: "p2", accountType: "irp", name: "TIGER S&P500 ETF", quantity: 300, avgPrice: 16800, currentPrice: 18500 },
  { id: "p3", accountType: "irp", name: "KODEX KR Bond ETF", quantity: 50, avgPrice: 105000, currentPrice: 107200 },
  { id: "p4", accountType: "dc", name: "TIGER Global REIT ETF", quantity: 400, avgPrice: 8500, currentPrice: 9100 },
];

const DEFAULT_EXPENSES: Expense[] = mockTransactions.map((t) => ({
  id: t.id,
  type: t.type,
  amount: t.amount,
  category: t.category,
  date: t.date,
  memo: t.memo,
}));

const DEFAULT_STATE: FinancialState = {
  monthlyBudgets: mockMonthlyBudgets,
  cashSavings: 15500000,
  emergencyFund: 3500000,
  holdings: DEFAULT_HOLDINGS,
  trades: DEFAULT_TRADES,
  pensionFunds: DEFAULT_PENSION_FUNDS,
  pensionBalance: 0, // computed from pensionFunds
  ownedProperties: [],
  expenses: DEFAULT_EXPENSES,
  annualIncome1: 30000000,
  annualIncome2: 30000000,
  monthlyLoanPayment: 0,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: "ADD_EXPENSE"; payload: Expense }
  | { type: "REMOVE_EXPENSE"; payload: string }
  | { type: "ADD_HOLDING"; payload: Holding }
  | { type: "UPDATE_HOLDING"; payload: { id: string; data: Partial<Holding> } }
  | { type: "REMOVE_HOLDING"; payload: string }
  | {
      type: "SELL_HOLDING";
      payload: {
        id: string;
        quantity: number;
        sellPrice: number;
        destination: "cash" | "reinvest" | "savings";
      };
    }
  | { type: "BUY_HOLDING"; payload: Holding }
  | { type: "UPDATE_BUDGET"; payload: { month: string; budget: MonthlyBudget } }
  | { type: "ADD_PENSION_FUND"; payload: PensionFund }
  | { type: "UPDATE_PENSION_FUND"; payload: { id: string; data: Partial<PensionFund> } }
  | {
      type: "UPDATE_SETTINGS";
      payload: Partial<
        Pick<FinancialState, "annualIncome1" | "annualIncome2" | "monthlyLoanPayment" | "cashSavings" | "emergencyFund">
      >;
    }
  | { type: "ADD_OWNED_PROPERTY"; payload: OwnedProperty }
  | { type: "REMOVE_OWNED_PROPERTY"; payload: string }
  | { type: "LOAD_STATE"; payload: FinancialState };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function financialReducer(state: FinancialState, action: Action): FinancialState {
  switch (action.type) {
    // --- Expenses ---
    case "ADD_EXPENSE":
      return { ...state, expenses: [action.payload, ...state.expenses] };

    case "REMOVE_EXPENSE":
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.payload),
      };

    // --- Holdings ---
    case "ADD_HOLDING":
      return { ...state, holdings: [...state.holdings, action.payload] };

    case "UPDATE_HOLDING":
      return {
        ...state,
        holdings: state.holdings.map((h) =>
          h.id === action.payload.id ? { ...h, ...action.payload.data } : h
        ),
      };

    case "REMOVE_HOLDING":
      return {
        ...state,
        holdings: state.holdings.filter((h) => h.id !== action.payload),
      };

    case "SELL_HOLDING": {
      const { id, quantity, sellPrice, destination } = action.payload;
      const holding = state.holdings.find((h) => h.id === id);
      if (!holding) return state;

      const realizedPnl = (sellPrice - holding.avgPrice) * quantity;
      const trade: Trade = {
        id: `t-${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        type: "sell",
        holdingName: holding.name,
        quantity,
        price: sellPrice,
        totalAmount: sellPrice * quantity,
        realizedPnl,
        destination,
      };

      const updatedHoldings =
        quantity >= holding.quantity
          ? state.holdings.filter((h) => h.id !== id)
          : state.holdings.map((h) =>
              h.id === id ? { ...h, quantity: h.quantity - quantity } : h
            );

      const cashDelta =
        destination === "cash" || destination === "savings"
          ? sellPrice * quantity
          : 0;

      return {
        ...state,
        holdings: updatedHoldings,
        trades: [trade, ...state.trades],
        cashSavings:
          destination === "savings"
            ? state.cashSavings + cashDelta
            : destination === "cash"
            ? state.cashSavings + cashDelta
            : state.cashSavings,
      };
    }

    case "BUY_HOLDING": {
      const newHolding = action.payload;
      const cost = newHolding.avgPrice * newHolding.quantity;

      const trade: Trade = {
        id: `t-${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        type: "buy",
        holdingName: newHolding.name,
        quantity: newHolding.quantity,
        price: newHolding.avgPrice,
        totalAmount: cost,
      };

      // Check if holding with same name exists -> merge
      const existing = state.holdings.find((h) => h.name === newHolding.name);
      let updatedHoldings: Holding[];
      if (existing) {
        const totalQty = existing.quantity + newHolding.quantity;
        const newAvg =
          (existing.avgPrice * existing.quantity +
            newHolding.avgPrice * newHolding.quantity) /
          totalQty;
        updatedHoldings = state.holdings.map((h) =>
          h.id === existing.id
            ? {
                ...h,
                quantity: totalQty,
                avgPrice: Math.round(newAvg),
                currentPrice: newHolding.currentPrice || h.currentPrice,
              }
            : h
        );
      } else {
        updatedHoldings = [...state.holdings, newHolding];
      }

      return {
        ...state,
        holdings: updatedHoldings,
        trades: [trade, ...state.trades],
        cashSavings: Math.max(0, state.cashSavings - cost),
      };
    }

    // --- Budget ---
    case "UPDATE_BUDGET": {
      const { month, budget } = action.payload;
      const exists = state.monthlyBudgets.some((b) => b.month === month);
      return {
        ...state,
        monthlyBudgets: exists
          ? state.monthlyBudgets.map((b) => (b.month === month ? budget : b))
          : [...state.monthlyBudgets, budget].sort((a, b) =>
              a.month.localeCompare(b.month)
            ),
      };
    }

    // --- Pension ---
    case "ADD_PENSION_FUND":
      return {
        ...state,
        pensionFunds: [...state.pensionFunds, action.payload],
      };

    case "UPDATE_PENSION_FUND":
      return {
        ...state,
        pensionFunds: state.pensionFunds.map((f) =>
          f.id === action.payload.id ? { ...f, ...action.payload.data } : f
        ),
      };

    // --- Settings ---
    case "UPDATE_SETTINGS":
      return { ...state, ...action.payload };

    // --- Real Estate ---
    case "ADD_OWNED_PROPERTY":
      return {
        ...state,
        ownedProperties: [...state.ownedProperties, action.payload],
      };

    case "REMOVE_OWNED_PROPERTY":
      return {
        ...state,
        ownedProperties: state.ownedProperties.filter(
          (p) => p.id !== action.payload
        ),
      };

    // --- Bulk load ---
    case "LOAD_STATE":
      return action.payload;

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Computed values helper
// ---------------------------------------------------------------------------

function computeDerived(state: FinancialState) {
  const totalCash = state.cashSavings + state.emergencyFund;

  const totalInvestment = state.holdings.reduce(
    (sum, h) => sum + h.currentPrice * h.quantity,
    0
  );

  const totalPension = state.pensionFunds.reduce(
    (sum, f) => sum + f.currentPrice * f.quantity,
    0
  );

  const totalRealEstate = state.ownedProperties.reduce(
    (sum, p) => sum + p.currentValue,
    0
  );

  const totalNetWorth =
    totalCash + totalInvestment + totalPension + totalRealEstate;

  return { totalCash, totalInvestment, totalPension, totalRealEstate, totalNetWorth };
}

function monthlyExpenseTotal(expenses: Expense[], month: string): number {
  return expenses
    .filter((e) => e.type === "expense" && e.date.startsWith(month))
    .reduce((sum, e) => sum + e.amount, 0);
}

function budgetRemainingByCategory(
  budgets: MonthlyBudget[],
  expenses: Expense[],
  month: string,
  categoryId: string
): number {
  const budget = budgets.find((b) => b.month === month);
  if (!budget) return 0;
  const cat = budget.categories.find((c) => c.id === categoryId);
  if (!cat) return 0;
  const spent = expenses
    .filter(
      (e) =>
        e.type === "expense" &&
        e.date.startsWith(month) &&
        e.category === cat.name
    )
    .reduce((sum, e) => sum + e.amount, 0);
  return cat.amount - spent;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface FinancialContextValue {
  state: FinancialState;

  // Actions
  addExpense: (expense: Expense) => void;
  removeExpense: (id: string) => void;
  addHolding: (holding: Holding) => void;
  updateHolding: (id: string, data: Partial<Holding>) => void;
  removeHolding: (id: string) => void;
  sellHolding: (
    id: string,
    quantity: number,
    sellPrice: number,
    destination: "cash" | "reinvest" | "savings"
  ) => void;
  buyHolding: (holding: Holding) => void;
  updateBudget: (month: string, budget: MonthlyBudget) => void;
  addPensionFund: (fund: PensionFund) => void;
  updatePensionFund: (id: string, data: Partial<PensionFund>) => void;
  updateSettings: (
    settings: Partial<
      Pick<FinancialState, "annualIncome1" | "annualIncome2" | "monthlyLoanPayment" | "cashSavings" | "emergencyFund">
    >
  ) => void;
  addOwnedProperty: (property: OwnedProperty) => void;
  removeOwnedProperty: (id: string) => void;

  // Computed
  totalCash: number;
  totalInvestment: number;
  totalPension: number;
  totalRealEstate: number;
  totalNetWorth: number;
  getMonthlyExpenseTotal: (month: string) => number;
  getBudgetRemainingByCategory: (month: string, categoryId: string) => number;
}

const FinancialContext = createContext<FinancialContextValue | null>(null);

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = "sophia-financial-data";

function loadFromStorage(): FinancialState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FinancialState;
  } catch {
    return null;
  }
}

function saveToStorage(state: FinancialState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable - fail silently
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function FinancialProvider({ children }: { children: ReactNode }) {
  const initialState = loadFromStorage() ?? DEFAULT_STATE;
  const [state, dispatch] = useReducer(financialReducer, initialState);

  // Persist on every state change
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  // Computed values
  const derived = useMemo(() => computeDerived(state), [state]);

  // --- Action callbacks (stable references) ---
  const addExpense = useCallback(
    (expense: Expense) => dispatch({ type: "ADD_EXPENSE", payload: expense }),
    []
  );
  const removeExpense = useCallback(
    (id: string) => dispatch({ type: "REMOVE_EXPENSE", payload: id }),
    []
  );
  const addHolding = useCallback(
    (holding: Holding) => dispatch({ type: "ADD_HOLDING", payload: holding }),
    []
  );
  const updateHolding = useCallback(
    (id: string, data: Partial<Holding>) =>
      dispatch({ type: "UPDATE_HOLDING", payload: { id, data } }),
    []
  );
  const removeHolding = useCallback(
    (id: string) => dispatch({ type: "REMOVE_HOLDING", payload: id }),
    []
  );
  const sellHolding = useCallback(
    (
      id: string,
      quantity: number,
      sellPrice: number,
      destination: "cash" | "reinvest" | "savings"
    ) =>
      dispatch({
        type: "SELL_HOLDING",
        payload: { id, quantity, sellPrice, destination },
      }),
    []
  );
  const buyHolding = useCallback(
    (holding: Holding) => dispatch({ type: "BUY_HOLDING", payload: holding }),
    []
  );
  const updateBudget = useCallback(
    (month: string, budget: MonthlyBudget) =>
      dispatch({ type: "UPDATE_BUDGET", payload: { month, budget } }),
    []
  );
  const addPensionFund = useCallback(
    (fund: PensionFund) =>
      dispatch({ type: "ADD_PENSION_FUND", payload: fund }),
    []
  );
  const updatePensionFund = useCallback(
    (id: string, data: Partial<PensionFund>) =>
      dispatch({ type: "UPDATE_PENSION_FUND", payload: { id, data } }),
    []
  );
  const updateSettings = useCallback(
    (
      settings: Partial<
        Pick<FinancialState, "annualIncome1" | "annualIncome2" | "monthlyLoanPayment" | "cashSavings" | "emergencyFund">
      >
    ) => dispatch({ type: "UPDATE_SETTINGS", payload: settings }),
    []
  );
  const addOwnedProperty = useCallback(
    (property: OwnedProperty) =>
      dispatch({ type: "ADD_OWNED_PROPERTY", payload: property }),
    []
  );
  const removeOwnedProperty = useCallback(
    (id: string) =>
      dispatch({ type: "REMOVE_OWNED_PROPERTY", payload: id }),
    []
  );

  // Computed query helpers
  const getMonthlyExpenseTotal = useCallback(
    (month: string) => monthlyExpenseTotal(state.expenses, month),
    [state.expenses]
  );
  const getBudgetRemainingByCategory = useCallback(
    (month: string, categoryId: string) =>
      budgetRemainingByCategory(
        state.monthlyBudgets,
        state.expenses,
        month,
        categoryId
      ),
    [state.monthlyBudgets, state.expenses]
  );

  const value: FinancialContextValue = useMemo(
    () => ({
      state,
      addExpense,
      removeExpense,
      addHolding,
      updateHolding,
      removeHolding,
      sellHolding,
      buyHolding,
      updateBudget,
      addPensionFund,
      updatePensionFund,
      updateSettings,
      addOwnedProperty,
      removeOwnedProperty,
      ...derived,
      getMonthlyExpenseTotal,
      getBudgetRemainingByCategory,
    }),
    [state, derived, getMonthlyExpenseTotal, getBudgetRemainingByCategory]
  );

  return (
    <FinancialContext.Provider value={value}>
      {children}
    </FinancialContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFinancial(): FinancialContextValue {
  const ctx = useContext(FinancialContext);
  if (!ctx) {
    throw new Error("useFinancial must be used within <FinancialProvider>");
  }
  return ctx;
}
