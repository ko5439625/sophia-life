import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { AlertTriangle, Bell, Check, ChevronRight, Info, X } from "lucide-react";
import { getExchangeRate, getSectorFearGreed, getStockQuote } from "../../../services/marketApi";
import type { ExchangeRateResult, FearGreedResult, StockQuote } from "../../../services/marketApi";
import { getWeather } from "../../../services/weatherApi";
import type { WeatherResult } from "../../../services/weatherApi";
import { getRecentMemos, loadMemosAsync } from "../../../lib/memoStore";
import type { CoupleMemo } from "../../../lib/memoStore";
import { useFinancial } from "../../../store/financialStore";
import {
  loadBlogSettings,
  loadDdays,
  loadEvents,
  loadTodos,
  saveBlogSettings,
  saveTodo,
} from "../../../services/supabaseSync";
import type { DdayRow, EventRow, TodoRow } from "../../../services/supabaseSync";
import { getChatSender, loadTodayMessages, parseReply } from "../../../services/chatService";
import type { ChatMessage } from "../../../types/chat";
import {
  DAY_NAMES,
  ddayLabel,
  diffDays,
  formatMan,
  formatWon,
  loadWeddingSummary,
  parseDateKey,
  relativeTime,
  shortDate,
  toDateKey,
  toMonthKey,
} from "./homeUtils";
import type { WeddingSummary } from "./homeUtils";

interface DashboardHomeProps {
  onNavigate?: (tabId: string) => void;
  onQuickExpense?: () => void;
  onSmartInbox?: () => void;
}

// ---------------------------------------------------------------------------
// Motion — 절제된 등장 (stagger + 살짝 올라옴)
// ---------------------------------------------------------------------------

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
};

// ---------------------------------------------------------------------------
// Alerts — 중복 없는 중요 알림만 (예산 초과 / 다음 달 예산 / 청약)
// ---------------------------------------------------------------------------

interface HomeAlert {
  id: string;
  level: "warning" | "info";
  text: string;
  actionTab?: string;
}

function buildAlerts(opts: {
  monthKey: string;
  spent: number;
  budgetTotal: number;
  nextMonthBudgetExists: boolean;
}): HomeAlert[] {
  const alerts: HomeAlert[] = [];
  const now = new Date();

  if (opts.budgetTotal > 0 && opts.spent > opts.budgetTotal) {
    alerts.push({
      id: `budget-over-${opts.monthKey}`,
      level: "warning",
      text: `이번 달 생활비 예산 ${formatMan(opts.spent - opts.budgetTotal)}원 초과`,
      actionTab: "finance:budget",
    });
  }

  if (now.getDate() >= 25 && !opts.nextMonthBudgetExists) {
    let dismissedToday = false;
    try {
      dismissedToday = localStorage.getItem("sophia-budget-noti-dismissed") === toDateKey(now);
    } catch { /* ignore */ }
    if (!dismissedToday) {
      alerts.push({
        id: "budget-next-month",
        level: "info",
        text: "다음 달 예산을 아직 세우지 않았어요",
        actionTab: "finance:budget",
      });
    }
  }

  // 청약 알림 (구독한 단지)
  try {
    const notifIds: string[] = JSON.parse(localStorage.getItem("sophia-subscription-notifications") || "[]");
    if (notifIds.length > 0) {
      const subs: { id: string; houseName: string; applyStartDate: string; applyEndDate: string }[] =
        JSON.parse(localStorage.getItem("sophia-subscription-items-cache") || "[]");
      for (const s of subs) {
        if (!notifIds.includes(s.id)) continue;
        const toStart = diffDays(s.applyStartDate);
        const toEnd = diffDays(s.applyEndDate);
        if (toStart > 0 && toStart <= 7) {
          alerts.push({ id: `sub-upcoming-${s.id}`, level: "info", text: `청약 D-${toStart} · ${s.houseName}`, actionTab: "realestate:subscription" });
        } else if (toStart <= 0 && toEnd >= 0) {
          alerts.push({ id: `sub-ongoing-${s.id}`, level: "warning", text: `청약 진행 중 · ${s.houseName} (~${shortDate(s.applyEndDate)})`, actionTab: "realestate:subscription" });
        }
      }
    }
  } catch { /* ignore */ }

  return alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === "warning" ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

const cardClass = "bg-card border border-border rounded-2xl p-4";

function CardHeader({ title, linkLabel, onLink }: { title: ReactNode; linkLabel?: string; onLink?: () => void }) {
  return (
    <div className="-mt-2 mb-0.5 flex items-center justify-between">
      <h3 className="text-[13px] font-semibold text-muted-foreground">{title}</h3>
      {onLink && (
        <button
          onClick={onLink}
          className="-mr-2 flex items-center gap-0.5 min-h-[40px] px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {linkLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function weatherEmoji(desc: string): string {
  if (desc.includes("맑")) return "☀️";
  if (desc.includes("비")) return "🌧️";
  if (desc.includes("눈")) return "🌨️";
  if (desc.includes("흐")) return "☁️";
  if (desc.includes("구름")) return "⛅";
  if (desc.includes("안개") || desc.includes("박무")) return "🌫️";
  return "🌤️";
}

function fearGreedKo(v: number): string {
  if (v <= 25) return "극단공포";
  if (v <= 45) return "공포";
  if (v <= 55) return "중립";
  if (v <= 75) return "탐욕";
  return "극단탐욕";
}

const ALLOCATION_IDS = new Set(["savings", "emergency", "investment"]);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface UpcomingEvent {
  id: string;
  title: string;
  emoji: string;
  date: string;
  dateLabel?: string;
}

const DashboardHome = ({ onNavigate, onQuickExpense, onSmartInbox }: DashboardHomeProps) => {
  const { state, getMonthlyExpenseTotal } = useFinancial();

  const today = new Date();
  const todayKey = toDateKey(today);
  const monthKey = toMonthKey(today);

  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [todayEvents, setTodayEvents] = useState<EventRow[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([]);
  const [ddays, setDdays] = useState<DdayRow[]>([]);
  const [memos, setMemos] = useState<CoupleMemo[]>(() => getRecentMemos(2));
  const [lastChat, setLastChat] = useState<ChatMessage | null>(null);
  const [wedding, setWedding] = useState<WeddingSummary | null>(null);
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [fx, setFx] = useState<ExchangeRateResult | null>(null);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [fearGreed, setFearGreed] = useState<FearGreedResult | null>(null);
  const [newTodo, setNewTodo] = useState("");
  const todoInputRef = useRef<HTMLInputElement>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("sophia-dismissed-alerts");
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });

  // ---- Load: 할 일 / 일정 / 기념일 / 메모 / 채팅 / 웨딩 ----
  useEffect(() => {
    let cancelled = false;
    const tKey = toDateKey(new Date());

    loadTodos().then((rows) => {
      if (!cancelled) setTodos(rows.filter((r) => r.date === tKey));
    });

    loadEvents().then((rows) => {
      if (cancelled) return;
      setTodayEvents(
        rows.filter((r) => r.date === tKey).sort((a, b) => (a.time || "99").localeCompare(b.time || "99")),
      );

      // 여러 날 일정은 " (1/4)" 접미사 기준으로 묶음
      const grouped = new Map<string, { title: string; emoji: string; dates: string[] }>();
      for (const r of rows) {
        const baseTitle = r.title.replace(/\s*\(\d+\/\d+\)$/, "");
        const key = `${baseTitle}__${r.emoji}`;
        const g = grouped.get(key) ?? { title: baseTitle, emoji: r.emoji, dates: [] };
        g.dates.push(r.date);
        grouped.set(key, g);
      }
      const result: UpcomingEvent[] = [];
      for (const [key, g] of grouped) {
        const dates = g.dates.sort();
        const start = dates[0];
        const end = dates[dates.length - 1];
        // 오늘 이후 시작하는 일정만 (오늘 일정은 "오늘" 카드에 표시)
        if (start <= tKey) continue;
        const s = parseDateKey(start);
        const e = parseDateKey(end);
        result.push({
          id: key,
          title: g.title,
          emoji: g.emoji,
          date: start,
          dateLabel: start !== end ? `${s.getMonth() + 1}/${s.getDate()}~${e.getMonth() + 1 === s.getMonth() + 1 ? "" : `${e.getMonth() + 1}/`}${e.getDate()}` : undefined,
        });
      }
      result.sort((a, b) => a.date.localeCompare(b.date));
      setUpcoming(result.slice(0, 3));
    });

    loadDdays().then((rows) => {
      if (!cancelled) setDdays(rows);
    });

    loadMemosAsync()
      .then((all) => {
        if (cancelled) return;
        setMemos(
          [...all]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 2),
        );
      })
      .catch(() => {});

    if (getChatSender()) {
      loadTodayMessages().then((msgs) => {
        if (cancelled) return;
        const visible = msgs.filter((m) => !m.deleted);
        setLastChat(visible.length > 0 ? visible[visible.length - 1] : null);
      });
    }

    loadWeddingSummary()
      .then((s) => {
        if (!cancelled) setWedding(s);
      })
      .catch(() => {});

    // 알림 닫기 상태 동기화
    loadBlogSettings().then((settings) => {
      if (cancelled || !settings.dismissedAlerts?.length) return;
      setDismissed((prev) => {
        const merged = new Set([...prev, ...settings.dismissedAlerts!]);
        try {
          localStorage.setItem("sophia-dismissed-alerts", JSON.stringify([...merged]));
        } catch { /* ignore */ }
        return merged;
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Load: 날씨 / 경제 한 줄 ----
  useEffect(() => {
    let cancelled = false;
    getWeather("Seoul")
      .then((w) => {
        // 실패 시 빈 값(temp 0, description "")이 오므로 유효한 데이터만 표시
        if (!cancelled && (w.description || w.icon)) setWeather(w);
      })
      .catch(() => {});
    Promise.allSettled([getExchangeRate("USD", "KRW"), getStockQuote("^KS11"), getStockQuote("^IXIC")]).then(
      ([rateR, kospiR, nasdaqR]) => {
        if (cancelled) return;
        if (rateR.status === "fulfilled") setFx(rateR.value);
        setQuotes({
          ...(kospiR.status === "fulfilled" ? { "^KS11": kospiR.value } : {}),
          ...(nasdaqR.status === "fulfilled" ? { "^IXIC": nasdaqR.value } : {}),
        });
      },
    );
    getSectorFearGreed()
      .then((s) => {
        if (!cancelled) setFearGreed(s.nasdaq ?? s.crypto);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- 할 일 ----
  const toggleTodo = (id: string) => {
    const target = todos.find((t) => t.id === id);
    if (!target) return;
    const updated = { ...target, is_done: !target.is_done };
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
    saveTodo(updated);
  };

  const addTodo = () => {
    const title = newTodo.trim();
    if (!title) return;
    const todo: TodoRow = { id: crypto.randomUUID(), title, memo: "", is_done: false, date: todayKey };
    setTodos((prev) => [...prev, todo]);
    setNewTodo("");
    saveTodo(todo);
  };

  const focusTodoInput = () => {
    const el = todoInputRef.current;
    if (!el) return;
    // iOS 키보드가 뜨도록 제스처 안에서 바로 focus
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const doneCount = todos.filter((t) => t.is_done).length;

  // ---- 기념일 칩 ----
  const { weddingDday, metDays } = useMemo(() => {
    const withDiff = ddays.map((d) => ({ ...d, diff: diffDays(d.date) }));
    const w = withDiff
      .filter((d) => d.title.includes("결혼") && d.diff >= 0)
      .sort((a, b) => a.diff - b.diff)[0];
    const met = withDiff.find((d) => d.title.includes("만난") && d.diff <= 0);
    return { weddingDday: w ?? null, metDays: met ? -met.diff + 1 : null };
  }, [ddays]);

  // ---- 생활비 ----
  const spent = getMonthlyExpenseTotal(monthKey);
  const budget = state.monthlyBudgets.find((b) => b.month === monthKey);
  const spendingCats = useMemo(
    () => (budget?.categories ?? []).filter((c) => !ALLOCATION_IDS.has(c.id) && c.amount > 0),
    [budget],
  );
  const budgetTotal = spendingCats.reduce((s, c) => s + c.amount, 0);
  const usedPct = budgetTotal > 0 ? Math.round((spent / budgetTotal) * 100) : 0;
  const remaining = budgetTotal - spent;
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - today.getDate();

  const topCats = useMemo(() => {
    const spentByName = new Map<string, number>();
    for (const e of state.expenses) {
      if (e.type === "expense" && e.date.startsWith(monthKey)) {
        spentByName.set(e.category, (spentByName.get(e.category) || 0) + e.amount);
      }
    }
    return spendingCats
      .map((c) => {
        const s = spentByName.get(c.name) || 0;
        return { name: c.name, spent: s, pct: Math.round((s / c.amount) * 100) };
      })
      .sort((a, b) => b.spent - a.spent || b.pct - a.pct)
      .slice(0, 3);
  }, [state.expenses, spendingCats, monthKey]);

  const nextMonthKey = toMonthKey(new Date(today.getFullYear(), today.getMonth() + 1, 1));
  const nextMonthBudgetExists = state.monthlyBudgets.some((b) => b.month === nextMonthKey);

  const alerts = useMemo(
    () => buildAlerts({ monthKey, spent, budgetTotal, nextMonthBudgetExists }).filter((a) => !dismissed.has(a.id)),
    [monthKey, spent, budgetTotal, nextMonthBudgetExists, dismissed],
  );

  const dismissAlert = (id: string) => {
    if (id === "budget-next-month") {
      try {
        localStorage.setItem("sophia-budget-noti-dismissed", todayKey);
      } catch { /* ignore */ }
    }
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      const arr = [...next];
      try {
        localStorage.setItem("sophia-dismissed-alerts", JSON.stringify(arr));
      } catch { /* ignore */ }
      saveBlogSettings({ dismissed_alerts: arr });
      return next;
    });
  };

  // ---- 경제 한 줄 ----
  const tickerItems: { label: string; value: string; tone?: "up" | "down" }[] = [];
  if (fx) tickerItems.push({ label: "환율", value: Math.round(fx.rate).toLocaleString("ko-KR") });
  for (const [sym, label] of [["^KS11", "코스피"], ["^IXIC", "나스닥"]] as const) {
    const q = quotes[sym];
    if (q) {
      const up = q.changePercent >= 0;
      tickerItems.push({ label, value: `${up ? "▲" : "▼"}${Math.abs(q.changePercent).toFixed(1)}%`, tone: up ? "up" : "down" });
    }
  }
  if (fearGreed) tickerItems.push({ label: fearGreedKo(fearGreed.value), value: String(fearGreed.value) });

  const showWedding = !!weddingDday;
  // 오래된 메모는 홈에서 숨김 (최근 14일 이내만)
  const freshMemos = memos.filter((m) => Date.now() - new Date(m.timestamp).getTime() < 14 * 86400000);
  const chatLabel = lastChat ? (lastChat.sender === "degul" ? "데굴" : "무요") : "";
  const chatText = lastChat
    ? lastChat.kind === "image"
      ? "📷 사진"
      : parseReply(lastChat.text).body
    : "";

  const chipClass = "inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground";

  return (
    <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-3 pb-4">
      {/* 1. 헤더 */}
      <motion.header variants={itemVariants} className="px-1 pt-1 pb-1.5">
        <h2 className="text-[22px] font-extrabold tracking-tight">무요 & 데굴 🩷</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={chipClass}>
            {today.getMonth() + 1}월 {today.getDate()}일 ({DAY_NAMES[today.getDay()]})
          </span>
          {weather && (
            <span className={chipClass}>
              {weatherEmoji(weather.description)} {weather.temp}° {weather.description}
            </span>
          )}
          {weddingDday && (
            <button
              onClick={() => onNavigate?.("couple")}
              className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 px-2.5 py-1 text-xs text-pink-500 dark:text-pink-400"
            >
              💍 결혼 {ddayLabel(weddingDday.diff)}
            </button>
          )}
          {metDays !== null && (
            <button onClick={() => onNavigate?.("couple")} className={chipClass}>
              💖 만난 지 {metDays.toLocaleString("ko-KR")}일
            </button>
          )}
          {!weddingDday && metDays === null && ddays.length > 0 && (
            <button onClick={() => onNavigate?.("couple")} className={chipClass}>
              🎉 기념일 <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </motion.header>

      {/* 2. 빠른 입력 */}
      <motion.div variants={itemVariants} className="grid grid-cols-4 gap-2">
        {[
          { label: "지출", icon: "💸", main: true, onClick: () => onQuickExpense?.() },
          { label: "할 일", icon: "✅", onClick: focusTodoInput },
          { label: "메모", icon: "📝", onClick: () => onNavigate?.("couple:memo") },
          { label: "블로그", icon: "📷", onClick: () => onNavigate?.("blog:photo") },
        ].map((q) => (
          <button
            key={q.label}
            onClick={q.onClick}
            className={`flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl text-[13px] font-semibold transition-transform active:scale-[0.97] ${
              q.main ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted/60"
            }`}
          >
            <span className="text-xl leading-none">{q.icon}</span>
            {q.label}
          </button>
        ))}
      </motion.div>

      {/* 붙여넣기로 기록 — 채팅·영수증 → AI가 탭별로 정리 (승인한 것만 저장) */}
      <motion.button
        variants={itemVariants}
        onClick={() => onSmartInbox?.()}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-4 min-h-[56px] text-left transition-colors hover:bg-muted/60 active:scale-[0.99]"
      >
        <span className="text-xl leading-none">📋</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-semibold">붙여넣기로 기록</span>
          <span className="block truncate text-[12px] text-muted-foreground">채팅·영수증을 넣으면 지출·일정·할 일로 정리해줘요</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </motion.button>

      {/* 중요 알림 — 한 줄 스트립 */}
      {alerts.length > 0 && (
        <motion.div variants={itemVariants} className="space-y-1.5">
          {alerts.slice(0, 2).map((a) => {
            const Icon = a.level === "warning" ? AlertTriangle : a.id.startsWith("sub-") ? Bell : Info;
            return (
              <div
                key={a.id}
                className={`flex items-center gap-2 rounded-xl border pl-3 text-[13px] ${
                  a.level === "warning" ? "border-amber-500/30 bg-amber-500/10" : "border-border bg-card"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${a.level === "warning" ? "text-amber-500" : "text-muted-foreground"}`} />
                <button
                  onClick={() => a.actionTab && onNavigate?.(a.actionTab)}
                  className="flex min-h-[40px] min-w-0 flex-1 items-center gap-1 text-left"
                >
                  <span className="truncate">{a.text}</span>
                  {a.actionTab && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </button>
                <button
                  onClick={() => dismissAlert(a.id)}
                  aria-label="알림 닫기"
                  className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start">
        {/* 3. 오늘 */}
        <motion.section variants={itemVariants} className={cardClass}>
          <CardHeader
            title="오늘"
            linkLabel={todos.length > 0 ? `${doneCount}/${todos.length} 완료` : "체크리스트"}
            onLink={() => onNavigate?.("schedule:checklist")}
          />
          <div className="divide-y divide-border">
            {todos.map((t) => (
              <button
                key={t.id}
                onClick={() => toggleTodo(t.id)}
                className="flex min-h-[44px] w-full items-center gap-2.5 py-2 text-left text-sm"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors ${
                    t.is_done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/50"
                  }`}
                >
                  {t.is_done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className={`min-w-0 flex-1 truncate ${t.is_done ? "text-muted-foreground line-through" : ""}`}>
                  {t.title}
                </span>
              </button>
            ))}
            {todayEvents.map((e) => (
              <button
                key={e.id}
                onClick={() => onNavigate?.("schedule:calendar")}
                className="flex min-h-[44px] w-full items-center gap-2.5 py-2 text-left text-sm"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none">{e.emoji || "📅"}</span>
                <span className="min-w-0 flex-1 truncate">
                  {e.time ? `${e.time.slice(0, 5)} ` : ""}
                  {e.title}
                </span>
                <span className="shrink-0 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[11px] text-sky-600 dark:text-sky-400">일정</span>
              </button>
            ))}
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                addTodo();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={todoInputRef}
                value={newTodo}
                onChange={(ev) => setNewTodo(ev.target.value)}
                placeholder="＋ 할 일 추가"
                enterKeyHint="done"
                className="min-h-[44px] min-w-0 flex-1 bg-transparent text-base placeholder:text-muted-foreground focus:outline-none md:text-sm"
              />
              {newTodo.trim() && (
                <button type="submit" className="min-h-[36px] shrink-0 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground">
                  추가
                </button>
              )}
            </form>
          </div>
        </motion.section>

        {/* 4. 이번 달 생활비 */}
        <motion.section variants={itemVariants} className={cardClass}>
          <CardHeader title={`${today.getMonth() + 1}월 생활비`} linkLabel="돈 탭" onLink={() => onNavigate?.("finance:budget")} />
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-[22px] font-bold tabular-nums">{formatWon(spent)}</span>
            {budgetTotal > 0 && <span className="shrink-0 text-[13px] text-muted-foreground">/ {formatMan(budgetTotal)}원</span>}
          </div>
          {budgetTotal > 0 ? (
            <>
              <div className="mt-2.5 mb-2 h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(usedPct, 100)}%` }}
                  transition={{ duration: 0.6, ease: EASE_OUT }}
                  className={`h-full rounded-full ${
                    usedPct >= 100 ? "bg-red-500" : usedPct >= 90 ? "bg-amber-500" : "bg-gradient-to-r from-emerald-500 to-emerald-400"
                  }`}
                />
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">
                  {usedPct}% 사용 · {daysLeft}일 남음
                </span>
                <span className={remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
                  {remaining >= 0 ? `${formatMan(remaining)}원 남음` : `${formatMan(-remaining)}원 초과`}
                </span>
              </div>
              {topCats.length > 0 && (
                <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                  {topCats.map((c) => (
                    <div key={c.name} className="min-w-0 rounded-xl bg-muted px-2.5 py-2">
                      <p className="truncate text-xs text-muted-foreground">{c.name}</p>
                      <p className={`mt-0.5 text-[13px] font-bold tabular-nums ${c.pct > 90 ? "text-amber-500" : ""}`}>{c.pct}%</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <button
              onClick={() => onNavigate?.("finance:budget")}
              className="mt-1 flex min-h-[40px] items-center gap-0.5 text-[13px] text-muted-foreground"
            >
              이번 달 예산이 아직 없어요 · 예산 세우기 <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </motion.section>

        {/* 5. 결혼 준비 (결혼식 전까지만) */}
        {showWedding && (
          <motion.section variants={itemVariants}>
            <button
              onClick={() => onNavigate?.("wedding")}
              className="w-full rounded-2xl border border-pink-500/25 bg-gradient-to-br from-pink-500/[0.14] to-pink-500/[0.03] p-4 text-left"
            >
              <div className="flex items-center gap-3.5">
                {wedding && wedding.checklistTotal > 0 ? (
                  <WeddingRing pct={Math.round((wedding.checklistDone / wedding.checklistTotal) * 100)} />
                ) : (
                  <span className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full bg-pink-500/10 text-2xl">💍</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-[15px] font-bold">
                    결혼 준비 · {ddayLabel(weddingDday.diff)}
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                  </p>
                  {wedding && (wedding.checklistTotal > 0 || wedding.total > 0) && (
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {[
                        wedding.checklistTotal > 0 ? `체크리스트 ${wedding.checklistDone}/${wedding.checklistTotal}` : null,
                        wedding.total > 0 ? `결제 ${formatMan(wedding.paid)} / ${formatMan(wedding.total)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </div>
              {wedding?.nextThisWeek && (
                <p className="mt-3 border-t border-pink-500/20 pt-2.5 text-[13px]">
                  이번 주 ▸ {wedding.nextThisWeek.title}{" "}
                  <span className="text-muted-foreground">({shortDate(wedding.nextThisWeek.date)})</span>
                </p>
              )}
            </button>
          </motion.section>
        )}

        {/* 6. 최근 채팅 */}
        {lastChat && (
          <motion.section variants={itemVariants} className={cardClass}>
            <CardHeader title="💬 채팅" linkLabel="열기" onLink={() => onNavigate?.("chat")} />
            <button onClick={() => onNavigate?.("chat")} className="block w-full text-left">
              <p className="mb-1 text-xs text-muted-foreground">
                {chatLabel} · {relativeTime(lastChat.created_at)}
              </p>
              <p className="inline-block max-w-[85%] rounded-[14px] rounded-bl-[4px] bg-muted px-3 py-2 text-sm line-clamp-2 break-words">
                {chatText}
              </p>
            </button>
          </motion.section>
        )}

        {/* 속닥속닥 — 최근 메모 */}
        {freshMemos.length > 0 && (
          <motion.section variants={itemVariants} className={cardClass}>
            <CardHeader title="🩷 속닥속닥" linkLabel="메모" onLink={() => onNavigate?.("couple:memo")} />
            <div className="space-y-1">
              {freshMemos.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onNavigate?.("couple:memo")}
                  className="flex min-h-[40px] w-full items-center gap-2 text-left text-sm"
                >
                  <span className={`shrink-0 text-xs font-semibold ${m.author === "sophia" ? "text-pink-500" : "text-sky-500"}`}>
                    {m.author === "sophia" ? "데굴" : "무요"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.message}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(m.timestamp)}</span>
                </button>
              ))}
            </div>
          </motion.section>
        )}

        {/* 7. 다가오는 일정 */}
        <motion.section variants={itemVariants} className={cardClass}>
          <CardHeader title="다가오는 일정" linkLabel="일정" onLink={() => onNavigate?.("schedule:calendar")} />
          {upcoming.length === 0 ? (
            <p className="py-1.5 text-[13px] text-muted-foreground">예정된 일정이 없어요</p>
          ) : (
            <div>
              {upcoming.map((e) => {
                const diff = diffDays(e.date);
                return (
                  <div key={e.id} className="flex min-h-[40px] items-center gap-2.5 text-sm">
                    <span className="shrink-0 text-base leading-none">{e.emoji}</span>
                    <span className="min-w-0 truncate">{e.title}</span>
                    {e.dateLabel && <span className="shrink-0 text-xs text-muted-foreground">{e.dateLabel}</span>}
                    <span
                      className={`ml-auto shrink-0 font-mono text-[13px] ${
                        diff <= 7 ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {ddayLabel(diff)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>
      </div>

      {/* 8. 경제 한 줄 */}
      {tickerItems.length > 0 && (
        <motion.div variants={itemVariants}>
          <button
            onClick={() => onNavigate?.("investment")}
            className="flex min-h-[44px] w-full flex-wrap items-center gap-x-3.5 gap-y-1 rounded-2xl border border-border bg-card px-4 py-3 text-left text-xs text-muted-foreground"
          >
            {tickerItems.map((t) => (
              <span key={t.label} className="whitespace-nowrap">
                {t.label}{" "}
                <b
                  className={`font-mono font-semibold ${
                    t.tone === "up" ? "text-red-500 dark:text-red-400" : t.tone === "down" ? "text-blue-500 dark:text-blue-400" : "text-foreground"
                  }`}
                >
                  {t.value}
                </b>
              </span>
            ))}
            <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0" />
          </button>
        </motion.div>
      )}
    </motion.div>
  );
};

function WeddingRing({ pct }: { pct: number }) {
  return (
    <div
      className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#f472b6 0 ${pct}%, hsl(var(--muted)) ${pct}% 100%)` }}
    >
      <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-card text-[13px] font-bold tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

export default DashboardHome;
