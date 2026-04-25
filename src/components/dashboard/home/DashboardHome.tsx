import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Calendar,
  TrendingDown,
  DollarSign,
  Heart,
  Gauge,
  Newspaper,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Info,
  ShieldCheck,
  X,
  Bell,
  Cloud,
} from "lucide-react";
import { getFearGreedIndex, getStockQuote, getExchangeRate, getSectorFearGreed } from "../../../services/marketApi";
import type { SectorFearGreed } from "../../../services/marketApi";
import { getNews } from "../../../services/newsApi";
import { getWeather } from "../../../services/weatherApi";
import type { WeatherResult } from "../../../services/weatherApi";
import type { FearGreedResult, StockQuote, ExchangeRateResult } from "../../../services/marketApi";
import type { NewsArticle } from "../../../services/newsApi";
import { getRecentMemos } from "../../../lib/memoStore";
import type { CoupleMemo } from "../../../lib/memoStore";
import { useFinancial } from "../../../store/financialStore";
import { useGuestMode } from "../../../hooks/useGuestMode";
import { loadTodos, loadEvents, loadDdays, saveTodo, loadBlogSettings, saveBlogSettings } from "../../../services/supabaseSync";
import { ChevronDown, ChevronUp } from "lucide-react";

interface DashboardHomeProps {
  onNavigate?: (tabId: string) => void;
}

const mockChecklist: { id: string; title: string; isDone: boolean }[] = [];

const initialEvents: { id: string; title: string; emoji: string; date: string; dateLabel?: string }[] = [];

// Pinned memos are loaded from shared memo store

// ---------------------------------------------------------------------------
// Alert System
// ---------------------------------------------------------------------------

interface Alert {
  id: string;
  level: "critical" | "warning" | "info" | "stable";
  title: string;
  message: string;
  timestamp: string;
  actionLabel?: string;
  actionTab?: string;
}

const alertStyles: Record<Alert["level"], { bg: string; icon: typeof AlertTriangle; iconColor: string }> = {
  critical: { bg: "bg-red-500/15 border border-red-500/30", icon: AlertTriangle, iconColor: "text-red-400" },
  warning: { bg: "bg-yellow-500/15 border border-yellow-500/30", icon: Bell, iconColor: "text-yellow-400" },
  info: { bg: "bg-green-500/10 border border-green-500/20", icon: Info, iconColor: "text-green-400" },
  stable: { bg: "bg-primary/5 border border-primary/15", icon: ShieldCheck, iconColor: "text-primary" },
};

function generateAlerts(
  fearGreedValue: number | null,
  stockQuotes: Record<string, StockQuote>,
  exchangeRate: ExchangeRateResult | null,
  events: { id: string; title: string; emoji: string; date: string }[],
  budgetUsed: number,
  budgetTotal: number,
  nextMonthBudgetExists?: boolean,
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();

  // Subscription notification alerts
  try {
    const notifRaw = localStorage.getItem("sophia-subscription-notifications");
    if (notifRaw) {
      const notifIds: string[] = JSON.parse(notifRaw);
      if (notifIds.length > 0) {
        // Try to load cached subscription data from last fetch
        // We read from the subscription items stored alongside notifications
        const subsRaw = localStorage.getItem("sophia-subscription-items-cache");
        const subsItems: {
          id: string;
          houseName: string;
          applyStartDate: string;
          applyEndDate: string;
        }[] = subsRaw ? JSON.parse(subsRaw) : [];

        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        for (const item of subsItems) {
          if (!notifIds.includes(item.id)) continue;

          const startDate = new Date(item.applyStartDate);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(item.applyEndDate);
          endDate.setHours(23, 59, 59, 999);

          const daysUntilStart = Math.ceil(
            (startDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (daysUntilStart > 0 && daysUntilStart <= 7) {
            // Upcoming within 7 days
            alerts.push({
              id: `sub-upcoming-${item.id}`,
              level: "info",
              title: `청약 알림: ${item.houseName}`,
              message: `청약 시작일 D-${daysUntilStart}`,
              timestamp: now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
              actionLabel: "청약 정보 보기",
              actionTab: "realestate:subscription",
            });
          } else if (todayDate >= startDate && todayDate <= endDate) {
            // Currently ongoing
            const endDateStr = `${endDate.getFullYear()}.${String(endDate.getMonth() + 1).padStart(2, "0")}.${String(endDate.getDate()).padStart(2, "0")}`;
            alerts.push({
              id: `sub-ongoing-${item.id}`,
              level: "warning",
              title: `청약 진행 중: ${item.houseName}`,
              message: `마감일: ${endDateStr}`,
              timestamp: now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
              actionLabel: "청약 정보 보기",
              actionTab: "realestate:subscription",
            });
          }
        }
      }
    }
  } catch {
    /* ignore subscription notification errors */
  }

  // Fear & Greed alerts
  if (fearGreedValue !== null) {
    if (fearGreedValue <= 25) {
      alerts.push({
        id: "fg-critical",
        level: "critical",
        title: "극단적 공포 감지",
        message: `공포탐욕지수 ${fearGreedValue} - 극단적 공포 구간. 헷징 전략 즉시 점검 필요`,
        timestamp: now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        actionLabel: "헷징 분석 보기",
        actionTab: "investment:hedging",
      });
    } else if (fearGreedValue <= 40) {
      alerts.push({
        id: "fg-warning",
        level: "warning",
        title: "시장 공포 주의",
        message: `공포탐욕지수 ${fearGreedValue} - 공포 구간 진입. 포트폴리오 점검 권장`,
        timestamp: now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        actionLabel: "헷징 분석",
        actionTab: "investment:hedging",
      });
    }
  }

  // Stock change alerts
  const stockEntries = Object.entries(stockQuotes);
  for (const [symbol, quote] of stockEntries) {
    if (quote.changePercent <= -3) {
      alerts.push({
        id: `stock-${symbol}`,
        level: "warning",
        title: `${symbol} 급락`,
        message: `${symbol} 전일 대비 ${quote.changePercent}% 하락`,
        timestamp: now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        actionLabel: "투자 현황",
        actionTab: "investment:portfolio",
      });
    }
  }

  // Exchange rate alert
  if (exchangeRate && exchangeRate.rate > 1400) {
    alerts.push({
      id: "fx-warning",
      level: "warning",
      title: "환율 1,400원 돌파",
      message: `현재 USD/KRW ${exchangeRate.rate.toFixed(2)}원. 환율 리스크 주의`,
      timestamp: now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
      actionLabel: "헷징 분석",
      actionTab: "investment:hedging",
    });
  }

  // Upcoming events within 7 days
  for (const event of events) {
    const target = new Date(event.date);
    target.setHours(0, 0, 0, 0);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((target.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 7) {
      alerts.push({
        id: `event-${event.id}`,
        level: "info",
        title: `이번 주 일정: ${event.title}`,
        message: diffDays === 0 ? "오늘입니다!" : `${diffDays}일 후 (${event.date})`,
        timestamp: now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
      });
    }
  }

  // Budget alert
  const budgetPct = budgetTotal > 0 ? (budgetUsed / budgetTotal) * 100 : 0;
  if (budgetPct > 70) {
    alerts.push({
      id: "budget-warning",
      level: "info",
      title: "예산 소진 주의",
      message: `이번 달 예산 ${Math.round(budgetPct)}% 소진`,
      timestamp: now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
      actionLabel: "지출 현황",
      actionTab: "finance:analysis",
    });
  }

  // Next month budget reminder (25th~31st)
  const dayOfMonth = now.getDate();
  if (dayOfMonth >= 25 && nextMonthBudgetExists === false) {
    // Check if dismissed today
    const dismissKey = "sophia-budget-noti-dismissed";
    const dismissedDate = localStorage.getItem(dismissKey);
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
    if (dismissedDate !== todayStr) {
      alerts.push({
        id: "budget-next-month",
        level: "warning",
        title: "다음 달 예산 미작성",
        message: "다음 달 예산 계획을 아직 세우지 않았습니다. 예산 탭에서 작성해주세요.",
        timestamp: now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        actionLabel: "예산 작성하기",
        actionTab: "finance:budget",
      });
    }
  }

  // If everything is normal
  if (alerts.length === 0) {
    alerts.push({
      id: "stable",
      level: "stable",
      title: "시장 안정",
      message: "현재 시장은 안정 상태입니다. 기존 포트폴리오 유지를 추천합니다.",
      timestamp: now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    });
  }

  // Sort: critical > warning > info > stable
  const levelOrder: Record<Alert["level"], number> = { critical: 0, warning: 1, info: 2, stable: 3 };
  return alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
}

const DashboardHome = ({ onNavigate }: DashboardHomeProps) => {
  const { state, getMonthlyExpenseTotal } = useFinancial();
  const { isGuest, maskAmount } = useGuestMode();
  const [checklist, setChecklist] = useState(mockChecklist);
  const [events, setEvents] = useState(initialEvents);
  const [ddays, setDdays] = useState<{ id: string; title: string; emoji: string; date: string }[]>([]);
  const [recentMemos, setRecentMemos] = useState<CoupleMemo[]>([]);
  const [marketExpanded, setMarketExpanded] = useState(() => {
    // Mobile: collapsed by default, Desktop: expanded
    return window.innerWidth >= 768;
  });

  // Load checklist, events, pinned memos from Supabase
  useEffect(() => {
    setRecentMemos(getRecentMemos(3));

    // Load today's todos
    loadTodos().then((rows) => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayTodos = rows
        .filter((r) => r.date === todayStr)
        .map((r) => ({ id: r.id, title: r.title, isDone: r.is_done }));
      if (todayTodos.length > 0) setChecklist(todayTodos);
    });

    // Load upcoming events (group multi-day events)
    loadEvents().then((rows) => {
      if (rows.length === 0) return;
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // Group consecutive events by base title (remove " (1/4)" suffix)
      const grouped = new Map<string, { emoji: string; dates: string[] }>();
      for (const r of rows) {
        const baseTitle = r.title.replace(/\s*\(\d+\/\d+\)$/, "");
        const key = `${baseTitle}__${r.emoji}`;
        if (!grouped.has(key)) {
          grouped.set(key, { emoji: r.emoji, dates: [] });
        }
        grouped.get(key)!.dates.push(r.date);
      }

      const result: { id: string; title: string; emoji: string; date: string; dateLabel?: string }[] = [];
      for (const [key, val] of grouped) {
        const baseTitle = key.split("__")[0];
        const sortedDates = val.dates.sort();
        const startDate = sortedDates[0];
        const endDate = sortedDates[sortedDates.length - 1];

        // Skip past events
        if (new Date(endDate) < now) continue;

        if (sortedDates.length > 1 && startDate !== endDate) {
          const s = new Date(startDate);
          const e = new Date(endDate);
          const dateLabel = `${s.getMonth()+1}/${s.getDate()}~${e.getMonth()+1}/${e.getDate()}`;
          result.push({ id: key, title: baseTitle, emoji: val.emoji, date: startDate, dateLabel });
        } else {
          result.push({ id: key, title: baseTitle, emoji: val.emoji, date: startDate });
        }
      }

      result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(result.slice(0, 5));
    });

    // Load D-days
    loadDdays().then((rows) => {
      if (rows.length > 0) {
        setDdays(rows.map((r) => ({ id: r.id, title: r.title, emoji: r.emoji, date: r.date })));
      }
    });

    // Sync dismissed alerts from Supabase
    loadBlogSettings().then((settings) => {
      if (settings.dismissedAlerts && settings.dismissedAlerts.length > 0) {
        setDismissedAlerts((prev) => {
          const merged = new Set([...prev, ...settings.dismissedAlerts!]);
          localStorage.setItem("sophia-dismissed-alerts", JSON.stringify([...merged]));
          return merged;
        });
      }
    });
  }, []);

  // Market data state
  const [fearGreed, setFearGreed] = useState<FearGreedResult | null>(null);
  const [stockQuotes, setStockQuotes] = useState<Record<string, StockQuote>>({});
  const [exchangeRate, setExchangeRate] = useState<ExchangeRateResult | null>(null);
  const [newsItems, setNewsItems] = useState<NewsArticle[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("sophia-dismissed-alerts");
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });
  const [sectorFG, setSectorFG] = useState<SectorFearGreed>({ nasdaq: null, kosdaq: null, crypto: null });
  const [marketTimestamp, setMarketTimestamp] = useState<string>("");
  const [newsTimestamp, setNewsTimestamp] = useState<string>("");
  const [weather, setWeather] = useState<WeatherResult | null>(null);

  useEffect(() => {
    // Fetch market data
    const fetchMarket = async () => {
      setMarketLoading(true);
      try {
        const [fg, sp500, nasdaq, kospi, rate] = await Promise.all([
          getFearGreedIndex(),
          getStockQuote("^GSPC"),
          getStockQuote("^IXIC"),
          getStockQuote("^KS11"),
          getExchangeRate("USD", "KRW"),
        ]);
        setFearGreed(fg);
        setStockQuotes({ "^GSPC": sp500, "^IXIC": nasdaq, "^KS11": kospi });
        setExchangeRate(rate);
        setMarketTimestamp(new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }));
        // Sector Fear & Greed (parallel, non-blocking)
        getSectorFearGreed().then(setSectorFG).catch(() => {});
      } catch (e) {
        console.warn("Market data fetch error:", e);
      }
      setMarketLoading(false);
    };

    // Fetch news
    const fetchNews = async () => {
      setNewsLoading(true);
      try {
        const [krNews, usNews] = await Promise.all([
          getNews("business", "kr"),
          getNews("business", "us"),
        ]);
        // Interleave KR and US news, take top 4
        const mixed: NewsArticle[] = [];
        const maxLen = Math.max(krNews.length, usNews.length);
        for (let i = 0; i < maxLen && mixed.length < 4; i++) {
          if (i < krNews.length && mixed.length < 4) mixed.push(krNews[i]);
          if (i < usNews.length && mixed.length < 4) mixed.push(usNews[i]);
        }
        setNewsItems(mixed);
        setNewsTimestamp(new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }));
      } catch (e) {
        console.warn("News fetch error:", e);
      }
      setNewsLoading(false);
    };

    // Fetch weather
    const fetchWeather = async () => {
      try {
        const w = await getWeather("Seoul");
        setWeather(w);
      } catch (e) {
        console.warn("Weather fetch error:", e);
      }
    };

    fetchMarket();
    fetchNews();
    fetchWeather();
  }, []);

  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dayStr = dayNames[today.getDay()];

  const toggleCheck = (id: string) => {
    const updated = checklist.map((item) =>
      item.id === id ? { ...item, isDone: !item.isDone } : item
    );
    setChecklist(updated);
    // Sync to Supabase
    const item = updated.find((i) => i.id === id);
    if (item) {
      const d = new Date();
      const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      saveTodo({ id: item.id, title: item.title, memo: "", is_done: item.isDone, date: dateKey });
    }
  };

  const getDday = (dateStr: string) => {
    const target = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil(
      (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 0) return "D-Day";
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  };

  const formatAmount = (n: number) =>
    new Intl.NumberFormat("ko-KR").format(n) + "\uC6D0";

  const doneCount = checklist.filter((c) => c.isDone).length;

  // Compute expense & budget totals from store
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const monthlyExpenseUsed = getMonthlyExpenseTotal(currentMonthStr);
  const currentBudget = state.monthlyBudgets.find((b) => b.month === currentMonthStr);
  const monthlyBudgetTotal = currentBudget
    ? currentBudget.categories
        .filter((c) => !["savings", "emergency", "investment"].includes(c.id))
        .reduce((sum, c) => sum + c.amount, 0)
    : 0;

  // Check if next month budget exists
  const nextMonthStr = (() => {
    const [y, m] = currentMonthStr.split("-").map(Number);
    const nm = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
    return `${nm.y}-${String(nm.m).padStart(2, "0")}`;
  })();
  const nextMonthBudgetExists = state.monthlyBudgets.some((b) => b.month === nextMonthStr);

  // Alert system
  const alerts = useMemo(() => {
    if (marketLoading) return [];
    return generateAlerts(
      fearGreed?.value ?? null,
      stockQuotes,
      exchangeRate,
      events,
      monthlyExpenseUsed,
      monthlyBudgetTotal,
      nextMonthBudgetExists,
    );
  }, [fearGreed, stockQuotes, exchangeRate, marketLoading, monthlyExpenseUsed, monthlyBudgetTotal, nextMonthBudgetExists]);

  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id));

  const dismissAlert = (id: string) => {
    // Budget noti: save today's date so it re-appears tomorrow
    if (id === "budget-next-month") {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      localStorage.setItem("sophia-budget-noti-dismissed", todayStr);
    }
    setDismissedAlerts((prev) => {
      const next = new Set(prev);
      next.add(id);
      const arr = [...next];
      try {
        localStorage.setItem("sophia-dismissed-alerts", JSON.stringify(arr));
      } catch (e) {
        console.warn("Failed to save dismissed alerts:", e);
      }
      saveBlogSettings({ dismissed_alerts: arr });
      return next;
    });
  };

  // Relative time helper for news
  const getRelativeTime = (dateStr: string) => {
    const now = new Date();
    const pubDate = new Date(dateStr);
    const diffMs = now.getTime() - pubDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins}분 전`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}일 전`;
  };

  // Fear & Greed derived values
  const fearGreedValue = fearGreed?.value ?? null;
  const fearGreedDisplay = fearGreedValue ?? 0;
  const fearGreedKoLabel = fearGreedValue === null ? "--" : fearGreedValue <= 25 ? "극단적 공포" : fearGreedValue <= 45 ? "공포" : fearGreedValue <= 55 ? "중립" : fearGreedValue <= 75 ? "탐욕" : "극단적 탐욕";
  const fearGreedColor = fearGreedValue === null ? "#6b7280" : fearGreedValue <= 25 ? "#ef4444" : fearGreedValue <= 45 ? "#f97316" : fearGreedValue <= 55 ? "#eab308" : fearGreedValue <= 75 ? "#84cc16" : "#22c55e";

  const fearGreedExplanations = [
    { range: "0-25", label: "극단적 공포", desc: "시장 패닉, 매수 기회 가능성", color: "#ef4444", min: 0, max: 25 },
    { range: "25-45", label: "공포", desc: "투자자 불안, 방어적 전략 권장", color: "#f97316", min: 25, max: 45 },
    { range: "45-55", label: "중립", desc: "균형 상태, 현 포지션 유지", color: "#eab308", min: 45, max: 55 },
    { range: "55-75", label: "탐욕", desc: "과열 주의, 리스크 관리 필요", color: "#84cc16", min: 55, max: 75 },
    { range: "75-100", label: "극단적 탐욕", desc: "버블 경계, 차익 실현 고려", color: "#22c55e", min: 75, max: 100 },
  ];

  // Market indices from fetched data (direct index symbols via Yahoo Finance)
  const indices = [
    {
      name: "S&P 500",
      value: stockQuotes["^GSPC"] ? stockQuotes["^GSPC"].price.toLocaleString() : "--",
      change: stockQuotes["^GSPC"] ? `${stockQuotes["^GSPC"].changePercent >= 0 ? "+" : ""}${stockQuotes["^GSPC"].changePercent}%` : "--",
      isUp: stockQuotes["^GSPC"] ? stockQuotes["^GSPC"].changePercent >= 0 : true,
    },
    {
      name: "NASDAQ",
      value: stockQuotes["^IXIC"] ? stockQuotes["^IXIC"].price.toLocaleString() : "--",
      change: stockQuotes["^IXIC"] ? `${stockQuotes["^IXIC"].changePercent >= 0 ? "+" : ""}${stockQuotes["^IXIC"].changePercent}%` : "--",
      isUp: stockQuotes["^IXIC"] ? stockQuotes["^IXIC"].changePercent >= 0 : true,
    },
    {
      name: "KOSPI",
      value: stockQuotes["^KS11"] ? stockQuotes["^KS11"].price.toLocaleString() : "--",
      change: stockQuotes["^KS11"] ? `${stockQuotes["^KS11"].changePercent >= 0 ? "+" : ""}${stockQuotes["^KS11"].changePercent}%` : "--",
      isUp: stockQuotes["^KS11"] ? stockQuotes["^KS11"].changePercent >= 0 : true,
    },
  ];

  const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] },
    }),
  };

  const handleNewsClick = () => {
    onNavigate?.("news");
  };

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <motion.div
        custom={0}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="bg-card rounded-xl p-5"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold">
              {isGuest ? "안녕하세요, 게스트 님!" : <>안녕하세요,<br />무요 & 데굴 님! 🩷</>}
            </h2>
            {weather && weather.temp != null ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-lg">{
                  weather.description?.includes("맑") ? "☀️" :
                  weather.description?.includes("구름") ? "⛅" :
                  weather.description?.includes("흐") ? "☁️" :
                  weather.description?.includes("비") ? "🌧️" :
                  weather.description?.includes("눈") ? "🌨️" :
                  weather.description?.includes("안개") ? "🌫️" : "🌤️"
                }</span>
                <span className="font-mono">{weather.tempMin != null && weather.tempMax != null ? `${weather.tempMin}° / ${weather.tempMax}°` : `${weather.temp}°`}</span>
                <span className="text-[10px] text-muted-foreground/50">체감 {weather.feelsLike}°</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">오늘도 좋은 하루 되세요!</p>
            )}
            {/* Upcoming event within 3 days - inline */}
            {(() => {
              const todayDate = new Date();
              todayDate.setHours(0, 0, 0, 0);
              const nearEvents = (events || [])
                .map((event) => {
                  const target = new Date(event.date);
                  target.setHours(0, 0, 0, 0);
                  const diffDays = Math.ceil((target.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
                  return { ...event, diffDays };
                })
                .filter((e) => e.diffDays >= 0 && e.diffDays <= 3)
                .sort((a, b) => a.diffDays - b.diffDays);

              if (nearEvents.length === 0) return null;
              const nearest = nearEvents[0];
              const dayLabel = nearest.diffDays === 0 ? "오늘" : nearest.diffDays === 1 ? "내일" : `${nearest.diffDays}일 후`;
              return (
                <p className="text-xs text-primary font-medium">
                  {isGuest ? `📅 ${dayLabel} 일정` : `📅 ${dayLabel} ${nearest.title}`}
                </p>
              );
            })()}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground font-mono whitespace-nowrap ml-2 sm:ml-4 mt-1">
            {dateStr} ({dayStr})
          </p>
        </div>
      </motion.div>

      {/* Alert Cards */}
      <AnimatePresence mode="popLayout">
        {visibleAlerts.length > 0 && (
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {visibleAlerts.map((alert, i) => {
              const style = alertStyles[alert.level];
              const Icon = style.icon;
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16, height: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  className={`rounded-xl p-3.5 flex items-start gap-3 ${style.bg}`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${style.iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{alert.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {alert.message}
                    </p>
                    {alert.actionLabel && alert.actionTab && (
                      <button
                        onClick={() => onNavigate?.(alert.actionTab!)}
                        className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors mt-1.5 flex items-center gap-0.5"
                      >
                        {alert.actionLabel}
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="flex-shrink-0 p-0.5 hover:bg-muted/50 rounded transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* D-day section - always visible */}
      {ddays.length > 0 && (
        <motion.div
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="bg-card rounded-xl p-5"
        >
          <button
            onClick={() => onNavigate?.("couple")}
            className="flex items-center justify-between mb-3 w-full group"
          >
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-400" />
              <h3 className="text-sm font-mono text-muted-foreground group-hover:text-foreground transition-colors">기념일</h3>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          </button>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ddays
              .map((d) => {
                const target = new Date(d.date);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                target.setHours(0, 0, 0, 0);
                const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return { ...d, diff };
              })
              .sort((a, b) => {
                // Show D-0 first, then nearest upcoming, then past (by recurrence)
                const aAbs = a.diff >= 0 ? a.diff : 365 + a.diff;
                const bAbs = b.diff >= 0 ? b.diff : 365 + b.diff;
                return aAbs - bAbs;
              })
              .slice(0, 6)
              .map((d) => (
                <div
                  key={d.id}
                  className={`flex items-center gap-2 p-2.5 rounded-lg ${
                    d.diff === 0 ? "bg-pink-500/10 ring-1 ring-pink-500/30" : "bg-muted/50"
                  }`}
                >
                  <span className="text-lg">{d.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{isGuest ? "기념일" : d.title}</p>
                    <p className={`text-[10px] font-mono ${
                      d.diff === 0 ? "text-pink-500 font-bold" : d.diff > 0 ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {d.diff === 0 ? "오늘!" : d.diff > 0 ? `D-${d.diff}` : `D+${Math.abs(d.diff)}`}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </motion.div>
      )}

      {/* 2-column: checklist + events - BEFORE economy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today's checklist */}
        <motion.div
          custom={2}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="bg-card rounded-xl p-5"
        >
          <button
            onClick={() => onNavigate?.("schedule:checklist")}
            className="flex items-center justify-between mb-3 w-full group"
          >
            <h3 className="text-sm font-mono text-muted-foreground group-hover:text-foreground transition-colors">오늘 할 일</h3>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono text-muted-foreground">{doneCount}/{checklist.length}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
          </button>
          <div className="space-y-1.5">
            {checklist.length === 0 && (
              <p className="text-xs text-muted-foreground/50">등록된 할 일이 없습니다</p>
            )}
            {checklist.map((item) => (
              <button
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className="flex items-center gap-2 w-full text-left group py-0.5"
              >
                {item.isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/60 flex-shrink-0 transition-colors" />
                )}
                <span className={`text-sm transition-all ${item.isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {item.title}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Upcoming events */}
        <motion.div
          custom={3}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="bg-card rounded-xl p-5"
        >
          <button
            onClick={() => onNavigate?.("schedule:calendar")}
            className="flex items-center justify-between mb-3 w-full group"
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-mono text-muted-foreground group-hover:text-foreground transition-colors">다가오는 일정</h3>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          </button>
          <div className="space-y-2.5">
            {events.length === 0 && (
              <p className="text-xs text-muted-foreground/50">등록된 일정이 없습니다</p>
            )}
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{event.emoji}</span>
                  <span className="text-sm">{isGuest ? "일정이 있습니다" : event.title}</span>
                  {event.dateLabel && (
                    <span className="text-[10px] text-muted-foreground/60 font-mono">({event.dateLabel})</span>
                  )}
                </div>
                <span className="text-xs font-mono text-primary font-medium">{getDday(event.date)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Economy section - collapsible on mobile */}
      <button
        onClick={() => setMarketExpanded(!marketExpanded)}
        className="w-full flex items-center justify-between bg-card rounded-xl px-5 py-3 md:hidden"
      >
        <span className="text-sm font-mono text-muted-foreground flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          경제 & 시장
        </span>
        {marketExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      <div className={`space-y-4 ${!marketExpanded ? "hidden md:block" : ""}`}>
      {/* Fear & Greed + USD/KRW - prominent */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="bg-card rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-mono text-muted-foreground">
              Fear & Greed Index
            </h3>
            {marketTimestamp && (
              <span className="text-[9px] text-muted-foreground/40 font-mono ml-auto">
                {marketTimestamp}
              </span>
            )}
          </div>
          {/* Sector Fear & Greed */}
          <div className="space-y-3">
            {marketLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground ml-2">불러오는 중...</span>
              </div>
            ) : (
            <>
            {/* 3-sector gauges */}
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: "나스닥", data: sectorFG.nasdaq, fallback: null },
                { label: "코스피", data: sectorFG.kosdaq, fallback: null },
                { label: "코인", data: sectorFG.crypto, fallback: null },
              ] as const).map((sector) => {
                const fg = sector.data ?? sector.fallback;
                const val = fg?.value ?? null;
                const color = val === null ? "#6b7280" : val <= 25 ? "#ef4444" : val <= 45 ? "#f97316" : val <= 55 ? "#eab308" : val <= 75 ? "#84cc16" : "#22c55e";
                const koLabel = val === null ? "--" : val <= 25 ? "극단공포" : val <= 45 ? "공포" : val <= 55 ? "중립" : val <= 75 ? "탐욕" : "극단탐욕";
                return (
                  <div key={sector.label} className="text-center">
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium">{sector.label}</p>
                    <p className="text-3xl sm:text-4xl font-mono font-extrabold tabular-nums" style={{ color }}>
                      {val ?? "--"}
                    </p>
                    <p className="text-xs font-medium mt-1" style={{ color }}>{koLabel}</p>
                    {/* Mini bar */}
                    <div className="mt-1.5 mx-auto max-w-[80px]">
                      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                        <div className="flex-1 bg-[#ef4444] rounded-l-full" />
                        <div className="flex-1 bg-[#f97316]" />
                        <div className="flex-1 bg-[#eab308]" />
                        <div className="flex-1 bg-[#84cc16]" />
                        <div className="flex-1 bg-[#22c55e] rounded-r-full" />
                      </div>
                      {val !== null && (
                        <div className="relative h-1.5">
                          <motion.div
                            className="absolute -top-0.5 w-1.5 h-1.5 rounded-full bg-foreground border border-background shadow"
                            initial={{ left: "0%" }}
                            animate={{ left: `${Math.min(Math.max(val, 2), 98)}%` }}
                            transition={{ duration: 0.6 }}
                            style={{ transform: "translateX(-50%)" }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend + 설명 */}
            <div className="flex justify-center gap-3 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />공포</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#eab308]" />중립</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />탐욕</span>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 mt-1">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground/70">0~25 극단공포</strong> — 시장 패닉, 역발상 매수 기회 가능성
              </p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground/70">25~45 공포</strong> — 투자자 불안, 방어적 전략 권장
              </p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground/70">45~55 중립</strong> — 균형 상태, 현 포지션 유지
              </p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground/70">55~75 탐욕</strong> — 과열 주의, 리스크 관리 필요
              </p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground/70">75~100 극단탐욕</strong> — 버블 경계, 차익 실현 고려
              </p>
              <hr className="border-border/50" />
              <div className="text-[9px] text-muted-foreground/60 space-y-0.5">
                <p>나스닥: CNN Fear & Greed Index (미국 주식 심리)</p>
                <p>코스피: KOSPI Fear & Greed Index (kospi-fear-greed-index.co.kr)</p>
                <p>코인: Crypto Fear & Greed Index (alternative.me)</p>
              </div>
            </div>
            </>
            )}
          </div>
        </motion.div>

        {/* USD/KRW + Market indices */}
        <motion.div
          custom={2}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="bg-card rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-mono text-muted-foreground">
              환율 & 지수
            </h3>
            {marketTimestamp && (
              <span className="text-[9px] text-muted-foreground/40 font-mono ml-auto">
                기준: {marketTimestamp}
              </span>
            )}
          </div>
          {/* USD/KRW */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">USD/KRW</p>
            {marketLoading ? (
              <div className="flex items-center gap-2 h-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">불러오는 중...</span>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <span className="text-2xl font-mono font-extrabold tabular-nums">
                  {exchangeRate ? exchangeRate.rate.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--"}
                </span>
                <span className={`text-xs font-mono mb-1 ${exchangeRate && exchangeRate.change >= 0 ? "text-primary" : "text-destructive"}`}>
                  {exchangeRate ? `${exchangeRate.change >= 0 ? "+" : ""}${exchangeRate.change.toFixed(2)}` : ""}
                </span>
              </div>
            )}
          </div>
          {/* Market indices */}
          <div className="grid grid-cols-3 gap-2">
            {marketLoading ? (
              <div className="col-span-3 flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              indices.map((idx) => (
                <div
                  key={idx.name}
                  className="bg-muted/50 rounded-lg p-2.5 text-center"
                >
                  <p className="text-[10px] text-muted-foreground font-mono mb-1">
                    {idx.name}
                  </p>
                  <p className="text-xs font-mono font-bold tabular-nums">
                    {idx.value}
                  </p>
                  <p
                    className={`text-[10px] font-mono tabular-nums mt-0.5 ${
                      idx.isUp ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {idx.change}
                  </p>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* News headlines */}
      <motion.div
        custom={3}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="bg-card rounded-xl p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-mono text-muted-foreground">
              경제 뉴스
            </h3>
            {newsTimestamp && (
              <span className="text-[9px] text-muted-foreground/40 font-mono">
                {newsTimestamp}
              </span>
            )}
          </div>
          <button
            onClick={handleNewsClick}
            className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          >
            더보기
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-2.5">
          {newsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground ml-2">뉴스 불러오는 중...</span>
            </div>
          ) : (
            newsItems.map((news, idx) => (
              <button
                key={`${news.source}-${idx}`}
                onClick={handleNewsClick}
                className="flex items-start gap-2.5 group cursor-pointer w-full text-left"
              >
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 ${
                    !news.isEnglish
                      ? "bg-blue-500/10 text-blue-500"
                      : "bg-green-500/10 text-green-500"
                  }`}
                >
                  {!news.isEnglish ? "KR" : "US"}
                </span>
                <p className="text-xs sm:text-sm leading-snug group-hover:text-primary transition-colors flex-1 min-w-0">
                  {news.title}
                </p>
                <div className="flex flex-col items-end flex-shrink-0 mt-0.5 hidden sm:flex">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {news.source}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50 font-mono">
                    {news.publishedAt ? getRelativeTime(news.publishedAt) : ""}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>

      </div>{/* end economy collapsible */}

      {/* Expense + couple note */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Expense summary */}
        <motion.div
          custom={6}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="bg-card rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-mono text-muted-foreground">
              이번 달 지출
            </h3>
          </div>
          <p className="text-xl sm:text-2xl font-mono font-bold tabular-nums mb-1 break-all">
            {isGuest ? maskAmount(monthlyExpenseUsed) : formatAmount(monthlyExpenseUsed)}
          </p>
          <p className="text-xs text-muted-foreground">
            {(() => {
              const monthExpenses = state.expenses.filter(
                (e) => e.type === "expense" && e.date.startsWith(currentMonthStr)
              );
              const catMap = new Map<string, number>();
              monthExpenses.forEach((e) => {
                catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount);
              });
              const top = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1])[0];
              return top
                ? <>최다 카테고리: <span className="text-foreground font-medium">{top[0]}</span> ({isGuest ? maskAmount(top[1]) : formatAmount(top[1])})</>
                : "지출 내역 없음";
            })()}
          </p>
        </motion.div>

        {/* 속닥속닥 - recent memos (hidden for guest) */}
        {!isGuest && (
          <motion.div
            custom={7}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="bg-card rounded-xl p-5 cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all"
            onClick={() => onNavigate?.("couple:memo")}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-pink-400" />
                <h3 className="text-sm font-mono text-muted-foreground">
                  속닥속닥
                </h3>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
            {recentMemos.length > 0 ? (
              <div className="space-y-2">
                {recentMemos.map((memo) => {
                  const isSophia = memo.author === "sophia";
                  return (
                    <div
                      key={memo.id}
                      className={`flex ${isSophia ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                          isSophia
                            ? "bg-pink-500/10 border border-pink-500/20 rounded-br-md"
                            : "bg-blue-500/10 border border-blue-500/20 rounded-bl-md"
                        }`}
                      >
                        <p className={`text-[10px] font-medium mb-0.5 ${
                          isSophia ? "text-pink-400" : "text-blue-400"
                        }`}>
                          {isSophia ? "데굴" : "무요"}
                        </p>
                        <p className="text-sm">{memo.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono text-right mt-0.5">
                          {(() => { try { const d = new Date(memo.timestamp); return isNaN(d.getTime()) ? memo.timestamp : d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return memo.timestamp; } })()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  아직 메모가 없어요
                </p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DashboardHome;
