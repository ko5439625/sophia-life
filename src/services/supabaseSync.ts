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
    deduct_from: e.deductFrom ?? null,
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
    deductFrom: (r.deduct_from as Expense["deductFrom"]) ?? undefined,
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
        supabase.from("user_settings").select("*").limit(1).maybeSingle(),
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
    // Check if budget for this month already exists
    const { data: existing } = await supabase
      .from("budgets")
      .select("id")
      .eq("month", month)
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Update existing
      await supabase.from("budgets").update(budgetToRow(month, budget)).eq("id", existing.id);
    } else {
      // Insert new
      await supabase.from("budgets").insert({ id: crypto.randomUUID(), ...budgetToRow(month, budget) });
    }
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
// Blog settings sync (locked_categories, subtitle, dismissed_alerts)
// ---------------------------------------------------------------------------

export interface BlogSettings {
  lockedCategories?: string[];
  blogSubtitle?: string;
  dismissedAlerts?: string[];
}

export async function loadBlogSettings(): Promise<BlogSettings> {
  if (!isReady() || !supabase) return {};
  try {
    const { data } = await supabase
      .from("user_settings")
      .select("locked_categories, blog_subtitle, dismissed_alerts")
      .limit(1)
      .maybeSingle();

    if (!data) return {};
    return {
      lockedCategories: (data.locked_categories as string[]) ?? undefined,
      blogSubtitle: (data.blog_subtitle as string) ?? undefined,
      dismissedAlerts: (data.dismissed_alerts as string[]) ?? undefined,
    };
  } catch (e) {
    console.warn("[supabaseSync] loadBlogSettings error:", e);
    return {};
  }
}

export async function saveBlogSettings(settings: Partial<{
  locked_categories: string[];
  blog_subtitle: string;
  dismissed_alerts: string[];
}>): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("user_settings").upsert({ id: "c7a9defe-0e45-57e0-9b26-4ef82dd867c1", ...settings });
  } catch (e) {
    console.error("[supabaseSync] saveBlogSettings error:", e);
  }
}

// ---------------------------------------------------------------------------
// API Keys sync (cross-device)
// ---------------------------------------------------------------------------

export async function loadApiKeysFromSupabase(): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    const { data } = await supabase
      .from("user_settings")
      .select("api_keys")
      .limit(1)
      .single();

    if (data?.api_keys && typeof data.api_keys === "object") {
      const keys = data.api_keys as Record<string, string>;
      const keyMap: Record<string, string> = {
        kakao: "sophia-api-kakao",
        news: "sophia-api-news",
        stock: "sophia-api-stock",
        data: "sophia-api-data",
        weather: "sophia-api-weather",
        ecos: "sophia-api-ecos",
        kisAppkey: "sophia-api-kis-appkey",
        kisSecret: "sophia-api-kis-secret",
        openai: "sophia-api-openai",
        gemini: "sophia-api-gemini",
      };
      for (const [key, storageKey] of Object.entries(keyMap)) {
        if (keys[key]) {
          localStorage.setItem(storageKey, keys[key]);
        }
      }
    }
  } catch (e) {
    console.warn("[supabaseSync] loadApiKeys error:", e);
  }
}

// ---------------------------------------------------------------------------
// Todos (체크리스트)
// ---------------------------------------------------------------------------

export interface TodoRow {
  id: string;
  title: string;
  memo: string;
  is_done: boolean;
  date: string;
}

export async function loadTodos(): Promise<TodoRow[]> {
  if (!isReady() || !supabase) return [];
  try {
    const { data } = await supabase.from("todos").select("*").order("date");
    return (data || []) as TodoRow[];
  } catch (e) {
    console.warn("[supabaseSync] loadTodos error:", e);
    return [];
  }
}

export async function saveTodo(todo: TodoRow): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("todos").upsert(todo);
  } catch (e) {
    console.error("[supabaseSync] saveTodo error:", e);
  }
}

export async function deleteTodo(id: string): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("todos").delete().eq("id", id);
  } catch (e) {
    console.error("[supabaseSync] deleteTodo error:", e);
  }
}

// ---------------------------------------------------------------------------
// Plans (플래너/여행 계획)
// ---------------------------------------------------------------------------

export interface PlanRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  estimated_cost: number;
  status: string;
  memo: string;
  items: unknown; // jsonb
}

export async function loadPlans(): Promise<PlanRow[]> {
  if (!isReady() || !supabase) return [];
  try {
    const { data } = await supabase.from("plans").select("*").order("start_date");
    return (data || []) as PlanRow[];
  } catch (e) {
    console.warn("[supabaseSync] loadPlans error:", e);
    return [];
  }
}

export async function savePlan(plan: PlanRow): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("plans").upsert(plan);
  } catch (e) {
    console.error("[supabaseSync] savePlan error:", e);
  }
}

export async function deletePlan(id: string): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("plans").delete().eq("id", id);
  } catch (e) {
    console.error("[supabaseSync] deletePlan error:", e);
  }
}

// ---------------------------------------------------------------------------
// Events (캘린더 일정)
// ---------------------------------------------------------------------------

export interface EventRow {
  id: string;
  title: string;
  date: string;
  time: string | null;
  emoji: string;
  is_shared: boolean;
}

export async function loadEvents(): Promise<EventRow[]> {
  if (!isReady() || !supabase) return [];
  try {
    const { data } = await supabase.from("events").select("*").order("date");
    return (data || []) as EventRow[];
  } catch (e) {
    console.warn("[supabaseSync] loadEvents error:", e);
    return [];
  }
}

export async function saveEvent(event: EventRow): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("events").upsert(event);
  } catch (e) {
    console.error("[supabaseSync] saveEvent error:", e);
  }
}

export async function deleteEvent(id: string): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("events").delete().eq("id", id);
  } catch (e) {
    console.error("[supabaseSync] deleteEvent error:", e);
  }
}

// ---------------------------------------------------------------------------
// D-days
// ---------------------------------------------------------------------------

export interface DdayRow {
  id: string;
  title: string;
  emoji: string;
  date: string;
}

export async function loadDdays(): Promise<DdayRow[]> {
  if (!isReady() || !supabase) return [];
  try {
    const { data } = await supabase.from("ddays").select("*").order("date");
    return (data || []) as DdayRow[];
  } catch (e) {
    console.warn("[supabaseSync] loadDdays error:", e);
    return [];
  }
}

export async function saveDday(dday: DdayRow): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("ddays").upsert(dday);
  } catch (e) {
    console.error("[supabaseSync] saveDday error:", e);
  }
}

export async function deleteDday(id: string): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("ddays").delete().eq("id", id);
  } catch (e) {
    console.error("[supabaseSync] deleteDday error:", e);
  }
}

// ---------------------------------------------------------------------------
// Wishes (위시리스트)
// ---------------------------------------------------------------------------

export interface WishRow {
  id: string;
  title: string;
  category: string;
  is_done: boolean;
}

export async function loadWishes(): Promise<WishRow[]> {
  if (!isReady() || !supabase) return [];
  try {
    const { data } = await supabase.from("wishes").select("*");
    return (data || []) as WishRow[];
  } catch (e) {
    console.warn("[supabaseSync] loadWishes error:", e);
    return [];
  }
}

export async function saveWish(wish: WishRow): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("wishes").upsert(wish);
  } catch (e) {
    console.error("[supabaseSync] saveWish error:", e);
  }
}

export async function deleteWish(id: string): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("wishes").delete().eq("id", id);
  } catch (e) {
    console.error("[supabaseSync] deleteWish error:", e);
  }
}

// ---------------------------------------------------------------------------
// Memos (속닥속닥)
// ---------------------------------------------------------------------------

export interface MemoRow {
  id: string;
  author: string;
  message: string;
  timestamp: string;
  pinned: boolean;
}

export async function loadMemosFromDB(): Promise<MemoRow[]> {
  if (!isReady() || !supabase) return [];
  try {
    const { data } = await supabase.from("memos").select("*").order("created_at", { ascending: false });
    return (data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      author: r.author as string,
      message: r.message as string,
      timestamp: (r.created_at as string) || "",
      pinned: (r.pinned as boolean) || false,
    }));
  } catch (e) {
    console.warn("[supabaseSync] loadMemos error:", e);
    return [];
  }
}

export async function saveMemoToDB(memo: MemoRow): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    // Only send columns that exist in the DB (not timestamp)
    await supabase.from("memos").upsert({
      id: memo.id,
      author: memo.author,
      message: memo.message,
      pinned: memo.pinned,
    });
  } catch (e) {
    console.error("[supabaseSync] saveMemo error:", e);
  }
}

export async function deleteMemoFromDB(id: string): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("memos").delete().eq("id", id);
  } catch (e) {
    console.error("[supabaseSync] deleteMemo error:", e);
  }
}

// ---------------------------------------------------------------------------
// Blog Posts
// ---------------------------------------------------------------------------

export interface PostRow {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  is_public: boolean;
  created_at: string;
  images: string[];
}

export async function loadPosts(): Promise<PostRow[]> {
  if (!isReady() || !supabase) return [];
  try {
    const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
    return (data || []) as PostRow[];
  } catch (e) {
    console.warn("[supabaseSync] loadPosts error:", e);
    return [];
  }
}

export async function savePost(post: PostRow): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("posts").upsert(post);
  } catch (e) {
    console.error("[supabaseSync] savePost error:", e);
  }
}

export async function deletePost(id: string): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("posts").delete().eq("id", id);
  } catch (e) {
    console.error("[supabaseSync] deletePost error:", e);
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

// ---------------------------------------------------------------------------
// Inspections (임장 기록)
// ---------------------------------------------------------------------------

export interface InspectionRow {
  id: string;
  apartment_name: string;
  location: string;
  visit_date: string;
  score_transport: number;
  score_school: number;
  score_environment: number;
  score_commercial: number;
  score_complex: number;
  total_score: number;
  photos: string[];
  review: string;
}

export async function loadInspections(): Promise<InspectionRow[]> {
  if (!isReady() || !supabase) return [];
  try {
    const { data } = await supabase.from("inspections").select("*").order("visit_date", { ascending: false });
    return (data || []) as InspectionRow[];
  } catch (e) {
    console.warn("[supabaseSync] loadInspections error:", e);
    return [];
  }
}

export async function saveInspection(ins: InspectionRow): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("inspections").upsert(ins);
  } catch (e) {
    console.error("[supabaseSync] saveInspection error:", e);
  }
}

export async function deleteInspection(id: string): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("inspections").delete().eq("id", id);
  } catch (e) {
    console.error("[supabaseSync] deleteInspection error:", e);
  }
}

// ---------------------------------------------------------------------------
// RE Filters (매물 모니터 필터)
// ---------------------------------------------------------------------------

export interface ReFilterRow {
  id: string;
  name: string;
  region_code: string;
  region_name: string;
  trade_type: string;
  price_min: number | null;
  price_max: number | null;
  area_min: number | null;
  area_max: number | null;
  is_active: boolean;
}

export async function loadReFilters(): Promise<ReFilterRow[]> {
  if (!isReady() || !supabase) return [];
  try {
    const { data } = await supabase.from("re_filters").select("*").order("created_at");
    return (data || []) as ReFilterRow[];
  } catch (e) {
    console.warn("[supabaseSync] loadReFilters error:", e);
    return [];
  }
}

export async function saveReFilter(filter: Omit<ReFilterRow, "id"> & { id?: string }): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("re_filters").upsert({ id: filter.id || crypto.randomUUID(), ...filter });
  } catch (e) {
    console.error("[supabaseSync] saveReFilter error:", e);
  }
}

export async function deleteReFilter(id: string): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    await supabase.from("re_filters").delete().eq("id", id);
  } catch (e) {
    console.error("[supabaseSync] deleteReFilter error:", e);
  }
}

// ---------------------------------------------------------------------------
// RE Listings (매물)
// ---------------------------------------------------------------------------

export interface ReListingRow {
  id: string;
  filter_id: string;
  naver_article_id: string;
  complex_name: string;
  price_text: string;
  price_man: number;
  area_m2: number | null;
  area_pyeong: number | null;
  floor_info: string | null;
  direction: string | null;
  description: string | null;
  detail_url: string | null;
  status: string;
  is_new: boolean;
  is_favorited: boolean;
  first_seen_at: string;
}

export async function loadReListings(filterId?: string): Promise<ReListingRow[]> {
  if (!isReady() || !supabase) return [];
  try {
    let q = supabase.from("re_listings").select("*").order("first_seen_at", { ascending: false });
    if (filterId) q = q.eq("filter_id", filterId);
    const { data } = await q;
    return (data || []) as ReListingRow[];
  } catch (e) {
    console.warn("[supabaseSync] loadReListings error:", e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// RE Regions (지역)
// ---------------------------------------------------------------------------

export interface ReRegionRow {
  id: string;
  city_name: string;
  district_name: string | null;
  display_name: string;
  cortar_no: string;
}

export async function loadReRegions(): Promise<ReRegionRow[]> {
  if (!isReady() || !supabase) return [];
  try {
    const { data } = await supabase.from("re_regions").select("*").order("sort_order");
    return (data || []) as ReRegionRow[];
  } catch (e) {
    console.warn("[supabaseSync] loadReRegions error:", e);
    return [];
  }
}
