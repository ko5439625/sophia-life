/**
 * Supabase Database Schema Types
 * ================================
 *
 * These interfaces define the data models for future Supabase integration.
 * Each interface maps to a potential Supabase table with standard fields:
 *   - id: UUID primary key
 *   - created_at: timestamp of creation
 *   - updated_at: timestamp of last update
 *   - user_id: foreign key to auth.users (for RLS)
 *
 * Current data flow: localStorage / in-memory mock data
 * Target data flow:  Supabase Postgres + Realtime subscriptions
 *
 * Table relationships:
 *   - DBPost belongs to user
 *   - DBTodo belongs to user
 *   - DBEvent belongs to user (optionally shared via is_shared)
 *   - DBBudget has many DBBudgetCategory (embedded as JSONB or separate table)
 *   - DBFinance (Transaction) belongs to user
 *   - DBInspection belongs to user, has embedded scores (JSONB)
 *   - DBHolding belongs to user
 *   - DBTrade belongs to user, references holding_name
 *   - DBDday belongs to user (couple-shared)
 *   - DBWish belongs to user (couple-shared)
 *   - DBAlbum has many DBPhoto (separate table or JSONB array)
 *   - DBMemo belongs to user (couple-shared, supports pinning)
 *   - DBMood belongs to user
 *   - DBPensionFund belongs to user
 *   - DBPlan has many DBPlanItem (embedded JSONB or separate table)
 */

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

export interface DBPost {
  id: string;
  user_id: string;
  title: string;
  content: string; // HTML content
  category: string;
  tags: string[];
  is_public: boolean;
  images: string[]; // URLs
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export interface DBTodo {
  id: string;
  user_id: string;
  title: string;
  memo: string;
  is_done: boolean;
  date: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface DBEvent {
  id: string;
  user_id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null;
  emoji: string;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface DBPlanItem {
  id: string;
  plan_id: string;
  day_number: number;
  time: string;
  title: string;
  place: string;
  category: string;
  memo: string;
}

export interface DBPlan {
  id: string;
  user_id: string;
  title: string;
  start_date: string;
  end_date: string;
  estimated_cost: number;
  status: "planned" | "completed";
  memo: string;
  items: DBPlanItem[]; // JSONB in Supabase
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Finance - Budget
// ---------------------------------------------------------------------------

export interface DBBudgetCategory {
  id: string;
  name: string;
  icon: string;
  amount: number;
  color: string;
}

export interface DBBudget {
  id: string;
  user_id: string;
  month: string; // "YYYY-MM"
  salary1: number;
  salary2: number;
  categories: DBBudgetCategory[]; // JSONB
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Finance - Transactions (Income/Expense)
// ---------------------------------------------------------------------------

export interface DBFinance {
  id: string;
  user_id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  memo: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Real Estate - Inspection
// ---------------------------------------------------------------------------

export interface DBInspectionScores {
  transportation: number;
  school: number;
  environment: number;
  commercial: number;
  complex: number;
}

export interface DBInspection {
  id: string;
  user_id: string;
  apartment_name: string;
  visit_date: string;
  scores: DBInspectionScores; // JSONB
  photos: string[]; // URLs
  review: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Investment - Holdings & Trades
// ---------------------------------------------------------------------------

export interface DBHolding {
  id: string;
  user_id: string;
  name: string;
  category: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  created_at: string;
  updated_at: string;
}

export interface DBTrade {
  id: string;
  user_id: string;
  date: string;
  type: "buy" | "sell";
  holding_name: string;
  quantity: number;
  price: number;
  total_amount: number;
  realized_pnl: number | null; // only for sells
  destination: "cash" | "reinvest" | "savings" | null; // only for sells
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Couple - D-day
// ---------------------------------------------------------------------------

export interface DBDday {
  id: string;
  user_id: string;
  title: string;
  emoji: string;
  date: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Couple - Wishlist
// ---------------------------------------------------------------------------

export interface DBWish {
  id: string;
  user_id: string;
  title: string;
  category: "물건" | "장소" | "경험";
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Couple - Gallery
// ---------------------------------------------------------------------------

export interface DBPhoto {
  id: string;
  album_id: string;
  url: string;
  alt: string;
  created_at: string;
}

export interface DBAlbum {
  id: string;
  user_id: string;
  title: string;
  description: string;
  is_public: boolean;
  photos: DBPhoto[]; // JSONB or separate table
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Couple - Memo (속닥속닥)
// ---------------------------------------------------------------------------

export interface DBMemo {
  id: string;
  user_id: string;
  author: "sophia" | "partner";
  message: string;
  pinned: boolean;
  timestamp: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Mood Tracker (future feature)
// ---------------------------------------------------------------------------

export interface DBMood {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  mood: "great" | "good" | "okay" | "bad" | "terrible";
  note: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Pension
// ---------------------------------------------------------------------------

export interface DBPensionFund {
  id: string;
  user_id: string;
  account_type: "irp" | "pension_saving" | "dc";
  name: string;
  buy_price: number;
  current_price: number;
  quantity: number;
  weight: number; // percentage
  created_at: string;
  updated_at: string;
}
