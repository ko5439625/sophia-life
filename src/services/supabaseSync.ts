import { supabase } from "@/lib/supabase";
import type {
  FinancialState,
  Holding,
  Trade,
  Expense,
  PensionFund,
  OwnedProperty,
} from "@/store/financialStore";
import type { MonthlyBudget } from "@/components/dashboard/finance/budgetData";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** If supabase is not configured, all functions silently no-op. */
function isReady() {
  return !!supabase;
}

// camelCase <-> snake_case mappers

function holdingToRow(h: Holding) {
  return {
    id: h.id,
    name: h.name,
    category: h.category,
    quantity: h.quantity,
    avg_price: h.avgPrice,
    current_price: h.currentPrice,
  };
}

function rowToHolding(r: Record<string, unknown>): Holding {
  return {
    id: r.id as string,
    name: r.name as string,
    category: r.category as Holding["category"],
    quantity: r.quantity as number,
    avgPrice: r.avg_price as number,
    currentPrice: r.current_price as number,
  };
}

function tradeToRow(t: Trade) {
  return {
    id: t.id,
    date: t.date,
    type: t.type,
    holding_name: t.holdingName,
    quantity: t.quantity,
    price: t.price,
    total_amount: t.totalAmount,
    realized_pnl: t.realizedPnl ?? null,
    destination: t.destination ?? null,
  };
}

function rowToTrade(r: Record<string, unknown>): Trade {
  return {
    id: r.id as string,
    date: r.date as string,
    type: r.type as Trade["type"],
    holdingName: r.holding_name as string,
    quantity: r.quantity as number,
    price: r.price as number,
    totalAmount: r.total_amount as number,
    realizedPnl: r.realized_pnl as number | undefined,
    destination: r.destination as Trade["destination"],
  };
}

function expenseToRow(e: Expense) {
  return {
    id: e.id,
    type: e.type,
    amount: e.amount,
    category: e.category,
    date: e.date,
    memo: e.memo,
  };
}

function rowToExpense(r: Record<string, unknown>): Expense {
  return {
    id: r.id as string,
    type: r.type as Expense["type"],
    amount: r.amount as number,
    category: r.category as string,
    date: r.date as string,
    memo: r.memo as string,
  };
}

function pensionFundToRow(f: PensionFund) {
  return {
    id: f.id,
    account_type: f.accountType,
    name: f.name,
    quantity: f.quantity,
    avg_price: f.avgPrice,
    current_price: f.currentPrice,
  };
}

function rowToPensionFund(r: Record<string, unknown>): PensionFund {
  return {
    id: r.id as string,
    accountType: r.account_type as PensionFund["accountType"],
    name: r.name as string,
    quantity: r.quantity as number,
    avgPrice: r.avg_price as number,
    currentPrice: r.current_price as number,
  };
}

function ownedPropertyToRow(p: OwnedProperty) {
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    purchase_price: p.purchasePrice,
    current_value: p.currentValue,
    purchase_date: p.purchaseDate,
  };
}

function rowToOwnedProperty(r: Record<string, unknown>): OwnedProperty {
  return {
    id: r.id as string,
    name: r.name as string,
    address: r.address as string,
    purchasePrice: r.purchase_price as number,
    currentValue: r.current_value as number,
    purchaseDate: r.purchase_date as string,
  };
}

function budgetToRow(month: string, b: MonthlyBudget) {
  return {
    month,
    salary1: b.salary1,
    salary2: b.salary2,
    categories: b.categories, // stored as jsonb
  };
}

function rowToBudget(r: Record<string, unknown>): MonthlyBudget {
  return {
    month: r.month as string,
    salary1: r.salary1 as number,
    salary2: r.salary2 as number,
    categories: r.categories as MonthlyBudget["categories"],
  };
}

// ---------------------------------------------------------------------------
// Load all data from Supabase
// ---------------------------------------------------------------------------

export async function loadFinancialData(): Promise<Partial<FinancialState> | null> {
  if (!isReady() || !supabase) return null;

  try {
    const [holdingsRes, tradesRes, expensesRes, budgetsRes, pensionRes, settingsRes, propertiesRes] =
      await Promise.all([
        supabase.from("holdings").select("*"),
        supabase.from("trades").select("*"),
        supabase.from("finances").select("*"),
        supabase.from("budgets").select("*"),
        supabase.from("pension_funds").select("*"),
        supabase.from("user_settings").select("*").limit(1).single(),
        supabase.from("owned_properties").select("*"),
      ]);

    const result: Partial<FinancialState> = {};

    if (holdingsRes.data) {
      result.holdings = holdingsRes.data.map(rowToHolding);
    }
    if (tradesRes.data) {
      result.trades = tradesRes.data.map(rowToTrade);
    }
    if (expensesRes.data) {
      result.expenses = expensesRes.data.map(rowToExpense);
    }
    if (budgetsRes.data) {
      result.monthlyBudgets = budgetsRes.data.map(rowToBudget);
    }
    if (pensionRes.data) {
      result.pensionFunds = pensionRes.data.map(rowToPensionFund);
    }
    if (propertiesRes.data) {
      result.ownedProperties = propertiesRes.data.map(rowToOwnedProperty);
    }
    if (settingsRes.data) {
      const s = settingsRes.data;
      result.annualIncome1 = s.annual_income1 as number;
      result.annualIncome2 = s.annual_income2 as number;
      result.monthlyLoanPayment = s.monthly_loan_payment as number;
      result.cashSavings = s.cash_savings as number;
      result.emergencyFund = s.emergency_fund as number;
    }

    return result;
  } catch (err) {
    console.error("[supabaseSync] loadFinancialData error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Individual save / delete functions
// ---------------------------------------------------------------------------

export async function saveExpense(expense: Expense): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("finances").upsert(expenseToRow(expense));
  } catch (err) {
    console.error("[supabaseSync] saveExpense error:", err);
  }
}

export async function deleteExpense(id: string): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("finances").delete().eq("id", id);
  } catch (err) {
    console.error("[supabaseSync] deleteExpense error:", err);
  }
}

export async function saveHolding(holding: Holding): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("holdings").upsert(holdingToRow(holding));
  } catch (err) {
    console.error("[supabaseSync] saveHolding error:", err);
  }
}

export async function deleteHolding(id: string): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("holdings").delete().eq("id", id);
  } catch (err) {
    console.error("[supabaseSync] deleteHolding error:", err);
  }
}

export async function saveTrade(trade: Trade): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("trades").upsert(tradeToRow(trade));
  } catch (err) {
    console.error("[supabaseSync] saveTrade error:", err);
  }
}

export async function saveBudget(month: string, budget: MonthlyBudget): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("budgets").upsert(budgetToRow(month, budget));
  } catch (err) {
    console.error("[supabaseSync] saveBudget error:", err);
  }
}

export async function savePensionFund(fund: PensionFund): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("pension_funds").upsert(pensionFundToRow(fund));
  } catch (err) {
    console.error("[supabaseSync] savePensionFund error:", err);
  }
}

export async function saveSettings(
  settings: Partial<Pick<FinancialState, "annualIncome1" | "annualIncome2" | "monthlyLoanPayment" | "cashSavings" | "emergencyFund">>
): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    const row: Record<string, unknown> = {};
    if (settings.annualIncome1 !== undefined) row.annual_income1 = settings.annualIncome1;
    if (settings.annualIncome2 !== undefined) row.annual_income2 = settings.annualIncome2;
    if (settings.monthlyLoanPayment !== undefined) row.monthly_loan_payment = settings.monthlyLoanPayment;
    if (settings.cashSavings !== undefined) row.cash_savings = settings.cashSavings;
    if (settings.emergencyFund !== undefined) row.emergency_fund = settings.emergencyFund;

    await supabase.from("user_settings").upsert({ id: "default", ...row });
  } catch (err) {
    console.error("[supabaseSync] saveSettings error:", err);
  }
}

export async function saveOwnedProperty(property: OwnedProperty): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("owned_properties").upsert(ownedPropertyToRow(property));
  } catch (err) {
    console.error("[supabaseSync] saveOwnedProperty error:", err);
  }
}

export async function deleteOwnedProperty(id: string): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("owned_properties").delete().eq("id", id);
  } catch (err) {
    console.error("[supabaseSync] deleteOwnedProperty error:", err);
  }
}

// ---------------------------------------------------------------------------
// Bulk sync helpers for complex actions (sell/buy that touch multiple tables)
// ---------------------------------------------------------------------------

export async function syncHoldingsAndTrades(
  holdings: Holding[],
  trade: Trade,
  cashSavings: number
): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    // Upsert all current holdings (handles updates & new additions)
    await Promise.all([
      supabase.from("holdings").upsert(holdings.map(holdingToRow)),
      supabase.from("trades").upsert(tradeToRow(trade)),
      supabase.from("user_settings").upsert({ id: "default", cash_savings: cashSavings }),
    ]);
  } catch (err) {
    console.error("[supabaseSync] syncHoldingsAndTrades error:", err);
  }
}
