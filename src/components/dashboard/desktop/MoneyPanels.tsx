// 데스크톱 돈 대시보드 패널 — 계산은 useFinancial 과 기존 화면 규칙을 그대로 따른다
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  LineChart,
  Newspaper,
  PiggyBank,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useFinancial } from "@/store/financialStore";
import { getExchangeRate, getStockQuote } from "@/services/marketApi";
import type { ExchangeRateResult, StockQuote } from "@/services/marketApi";
import { getNews } from "@/services/newsApi";
import type { NewsArticle } from "@/services/newsApi";
import { cn } from "@/lib/utils";
import { EmptyState, Panel, PanelLink } from "./Panel";
import { PensionLine } from "./PensionDialog";

export type MoneyToolView =
  | "dashboard"
  | "budget"
  | "expenses"
  | "assets"
  | "portfolio"
  | "news"
  | "quant"
  | "hedging"
  | "trading";

const ALLOCATION_IDS = new Set(["savings", "emergency", "investment"]);
const EASE = [0.16, 1, 0.3, 1] as const;

const won = (n: number) => `${new Intl.NumberFormat("ko-KR").format(Math.round(n))}원`;
/** 18,400,000 → "1,840만" */
const man = (n: number) =>
  Math.abs(n) < 10000 ? new Intl.NumberFormat("ko-KR").format(Math.round(n)) : `${new Intl.NumberFormat("ko-KR").format(Math.round(n / 10000))}만`;

function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// 이번 달 생활비 — 예산 대비 지출 + 카테고리 막대
// ---------------------------------------------------------------------------

export function BudgetPanel({ onOpen }: { onOpen: (v: MoneyToolView) => void }) {
  const { state, getMonthlyExpenseTotal } = useFinancial();
  const now = new Date();
  const monthKey = monthKeyOf(now);
  const budget = state.monthlyBudgets.find((b) => b.month === monthKey);
  const spent = getMonthlyExpenseTotal(monthKey);

  const cats = useMemo(() => {
    const spentByName = new Map<string, number>();
    for (const e of state.expenses) {
      if (e.type === "expense" && e.date.startsWith(monthKey)) spentByName.set(e.category, (spentByName.get(e.category) || 0) + e.amount);
    }
    return (budget?.categories ?? [])
      .filter((c) => !ALLOCATION_IDS.has(c.id) && c.amount > 0)
      .map((c) => ({ id: c.id, name: c.name, budget: c.amount, spent: spentByName.get(c.name) || 0 }))
      .sort((a, b) => b.budget - a.budget);
  }, [budget, state.expenses, monthKey]);

  const allocations = (budget?.categories ?? []).filter((c) => ALLOCATION_IDS.has(c.id) && c.amount > 0);
  const total = cats.reduce((s, c) => s + c.budget, 0);
  const pct = total > 0 ? Math.round((spent / total) * 100) : 0;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate();

  return (
    <Panel title={`${now.getMonth() + 1}월 생활비`} icon={PiggyBank} action={<PanelLink onClick={() => onOpen("budget")}>예산 계획</PanelLink>}>
      {total === 0 ? (
        <>
          {spent > 0 && (
            <p className="mb-1 flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">이번 달 지출</span>
              <span className="font-mono font-semibold tabular-nums">{won(spent)}</span>
            </p>
          )}
          <EmptyState
            icon={PiggyBank}
            title="아직 예산이 없어요"
            description="이번 달 생활비 예산을 세우면 카테고리별로 얼마나 썼는지 여기서 보여드려요"
            actionLabel="예산 세우기"
            onAction={() => onOpen("budget")}
          />
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-2xl font-bold tabular-nums">{won(spent)}</span>
              <span className="text-[13px] text-muted-foreground">/ {man(total)}원</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(pct, 100)}%` }}
                transition={{ duration: 0.6, ease: EASE }}
                className={cn("h-full rounded-full", pct >= 100 ? "bg-destructive" : pct >= 90 ? "bg-warn" : "bg-foreground")}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span>
                {pct}% 사용 · {daysLeft}일 남음
              </span>
              <span className={total - spent < 0 ? "text-destructive" : "text-foreground"}>
                {total - spent >= 0 ? `${man(total - spent)}원 남음` : `${man(spent - total)}원 초과`}
              </span>
            </div>
          </div>
          <ul className="space-y-2.5">
            {cats.map((c) => {
              const p = Math.round((c.spent / c.budget) * 100);
              return (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      <span className={cn(p > 100 ? "text-destructive" : p >= 90 ? "text-warn" : "text-foreground")}>{man(c.spent)}</span> / {man(c.budget)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", p > 100 ? "bg-destructive" : p >= 90 ? "bg-warn" : "bg-foreground/70")}
                      style={{ width: `${Math.min(p, 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {allocations.length > 0 && (
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              배분 · {allocations.map((a) => `${a.name.replace(/\s*\(.*\)/, "")} ${man(a.amount)}`).join(" · ")}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 최근 지출
// ---------------------------------------------------------------------------

export function RecentExpensesPanel({ onOpen, onQuickExpense }: { onOpen: (v: MoneyToolView) => void; onQuickExpense?: () => void }) {
  const { state } = useFinancial();
  const recent = useMemo(
    () => [...state.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    [state.expenses],
  );

  return (
    <Panel
      title="최근 지출"
      icon={Receipt}
      action={
        <button
          onClick={onQuickExpense}
          className="-mr-1 inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> 지출
        </button>
      }
      bodyClassName="p-0"
    >
      {recent.length === 0 ? (
        <EmptyState
          className="px-4"
          icon={Receipt}
          title="지출을 기록해보세요"
          description="＋ 지출로 바로 적거나, 영수증·채팅을 붙여넣으면 AI가 정리해줘요"
          actionLabel="지출 기록"
          onAction={onQuickExpense}
        />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {recent.map((e) => {
              const d = new Date(e.date + "T00:00:00");
              return (
                <li key={e.id} className="flex min-h-[44px] items-center gap-3 px-4 py-2 text-[13px]">
                  <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {d.getMonth() + 1}/{d.getDate()}
                  </span>
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{e.category}</span>
                  <span className="min-w-0 flex-1 truncate">{e.memo || <span className="text-muted-foreground">메모 없음</span>}</span>
                  <span className="shrink-0 font-mono tabular-nums">
                    {e.type === "income" ? "+" : ""}
                    {won(e.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border px-4 py-1.5">
            <PanelLink onClick={() => onOpen("expenses")}>지출 관리 전체</PanelLink>
          </div>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 자산 요약 — 순자산 + 현금/저축/투자 + 연금 잔액 한 줄
// ---------------------------------------------------------------------------

export function AssetSummaryPanel({ onOpen }: { onOpen: (v: MoneyToolView) => void }) {
  const { totalNetWorth, totalCash, totalInvestment, effectiveCashSavings, effectiveEmergencyFund, totalAvailable } = useFinancial();
  const rows = [
    { label: "현금", hint: "저축·비상금·현금보유", value: totalCash },
    { label: "적금·저축", hint: "기초값 + 예산 적립", value: effectiveCashSavings },
    { label: "비상금", value: effectiveEmergencyFund },
    { label: "투자", hint: "보유 종목 현재가", value: totalInvestment },
  ];
  const empty = totalNetWorth === 0;

  return (
    <Panel title="자산 요약" icon={Wallet} action={<PanelLink onClick={() => onOpen("assets")}>자산 현황</PanelLink>}>
      <p className="text-xs text-muted-foreground">순자산</p>
      <p className="font-mono text-2xl font-bold tabular-nums">{won(totalNetWorth)}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        바로 쓸 수 있는 돈 <span className="font-mono text-foreground">{won(totalAvailable)}</span>
      </p>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {rows.map((r) => (
          <li key={r.label} className="flex min-h-[40px] items-center gap-2 text-[13px]">
            <span>{r.label}</span>
            {r.hint && <span className="truncate text-[11px] text-muted-foreground">{r.hint}</span>}
            <span className="ml-auto shrink-0 font-mono tabular-nums">{won(r.value)}</span>
          </li>
        ))}
      </ul>
      <PensionLine className="mt-1" format={won} />
      {empty && (
        <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          설정에서 현금·저축 기초값을 넣거나 예산에 저축을 배분하면 여기가 채워져요.
        </p>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 투자 현황 — 보유 종목 표
// ---------------------------------------------------------------------------

const HOLDING_KIND: Record<string, string> = { stock: "주식", etf: "ETF", bond: "채권", crypto: "코인", gold: "금", other: "기타" };

export function HoldingsPanel({ onOpen }: { onOpen: (v: MoneyToolView) => void }) {
  const { state } = useFinancial();
  const rows = useMemo(
    () =>
      state.holdings
        .map((h) => {
          const value = h.currentPrice * h.quantity;
          const cost = h.avgPrice * h.quantity;
          return { ...h, value, cost, ret: cost > 0 ? ((value - cost) / cost) * 100 : 0 };
        })
        .sort((a, b) => b.value - a.value),
    [state.holdings],
  );
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalRet = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
  // 주식 관례: 오름 = 빨강, 내림 = 파랑
  const tone = (n: number) => (n > 0 ? "text-red-500 dark:text-red-400" : n < 0 ? "text-blue-500 dark:text-blue-400" : "text-muted-foreground");

  return (
    <Panel
      title="투자 현황"
      icon={LineChart}
      action={<PanelLink onClick={() => onOpen("portfolio")}>{rows.length ? "종목 관리" : "종목 추가"}</PanelLink>}
      bodyClassName="p-0"
    >
      {rows.length === 0 ? (
        <EmptyState
          className="px-4 py-10"
          icon={LineChart}
          title="보유 종목이 없어요"
          description="투자 현황에서 종목을 추가하면 평가금액과 수익률을 여기 표로 보여드려요"
          actionLabel="종목 추가"
          onAction={() => onOpen("portfolio")}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">종목</th>
                <th className="px-2 py-2 font-medium">구분</th>
                <th className="px-2 py-2 text-right font-medium">수량</th>
                <th className="px-2 py-2 text-right font-medium">평균단가</th>
                <th className="px-2 py-2 text-right font-medium">현재가</th>
                <th className="px-2 py-2 text-right font-medium">평가금액</th>
                <th className="px-4 py-2 text-right font-medium">수익률</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="max-w-[220px] truncate px-4 py-2.5 font-medium">{r.name}</td>
                  <td className="px-2 py-2.5 text-muted-foreground">{HOLDING_KIND[r.category] ?? r.category}</td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums">{r.quantity.toLocaleString("ko-KR")}</td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums">{Math.round(r.avgPrice).toLocaleString("ko-KR")}</td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums">{Math.round(r.currentPrice).toLocaleString("ko-KR")}</td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums">{won(r.value)}</td>
                  <td className={cn("px-4 py-2.5 text-right font-mono tabular-nums", tone(r.ret))}>
                    {r.ret > 0 ? "+" : ""}
                    {r.ret.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border text-[13px] font-semibold">
                <td className="px-4 py-2.5" colSpan={5}>
                  합계 · {rows.length}종목
                </td>
                <td className="px-2 py-2.5 text-right font-mono tabular-nums">{won(totalValue)}</td>
                <td className={cn("px-4 py-2.5 text-right font-mono tabular-nums", tone(totalRet))}>
                  {totalRet > 0 ? "+" : ""}
                  {totalRet.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 시장 한 줄 + 뉴스 헤드라인
// ---------------------------------------------------------------------------

export function MarketNewsPanel({ onOpen }: { onOpen: (v: MoneyToolView) => void }) {
  const [fx, setFx] = useState<ExchangeRateResult | null>(null);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [news, setNews] = useState<NewsArticle[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getExchangeRate("USD", "KRW"), getStockQuote("^KS11"), getStockQuote("^IXIC"), getStockQuote("^GSPC")]).then(
      ([r, k, n, s]) => {
        if (cancelled) return;
        if (r.status === "fulfilled") setFx(r.value);
        const q: Record<string, StockQuote> = {};
        if (k.status === "fulfilled") q["^KS11"] = k.value;
        if (n.status === "fulfilled") q["^IXIC"] = n.value;
        if (s.status === "fulfilled") q["^GSPC"] = s.value;
        setQuotes(q);
      },
    );
    getNews("business", "kr")
      .then((list) => {
        if (cancelled) return;
        setNews([...list].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 5));
      })
      .catch(() => !cancelled && setNews([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const tickers: { label: string; value: string; change?: number }[] = [];
  if (fx) tickers.push({ label: "USD/KRW", value: Math.round(fx.rate).toLocaleString("ko-KR") });
  for (const [sym, label] of [["^KS11", "코스피"], ["^IXIC", "나스닥"], ["^GSPC", "S&P500"]] as const) {
    const q = quotes[sym];
    if (q) tickers.push({ label, value: q.price.toLocaleString("ko-KR", { maximumFractionDigits: 0 }), change: q.changePercent });
  }

  return (
    <Panel title="시장 · 뉴스" icon={TrendingUp} action={<PanelLink onClick={() => onOpen("news")}>뉴스 전체</PanelLink>} bodyClassName="p-0">
      <div className="grid grid-cols-2 gap-px border-b border-border bg-border">
        {tickers.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card px-4 py-2.5">
                <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                <div className="mt-1.5 h-4 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))
          : tickers.map((t) => (
              <div key={t.label} className="bg-card px-4 py-2.5">
                <p className="text-[11px] text-muted-foreground">{t.label}</p>
                <p className="flex items-baseline gap-1.5 font-mono text-sm font-semibold tabular-nums">
                  {t.value}
                  {t.change !== undefined && (
                    <span className={cn("text-xs font-medium", t.change >= 0 ? "text-red-500 dark:text-red-400" : "text-blue-500 dark:text-blue-400")}>
                      {t.change >= 0 ? "▲" : "▼"}
                      {Math.abs(t.change).toFixed(1)}%
                    </span>
                  )}
                </p>
              </div>
            ))}
      </div>
      {news === null ? (
        <ul className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="h-4 animate-pulse rounded bg-muted" />
          ))}
        </ul>
      ) : news.length === 0 ? (
        <EmptyState className="px-4" icon={Newspaper} title="뉴스를 불러오지 못했어요" description="잠시 후 다시 확인해 주세요" />
      ) : (
        <ul className="divide-y divide-border">
          {news.map((n, i) => (
            <li key={`${n.url}-${i}`}>
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex min-h-[44px] items-start gap-2 px-4 py-2.5 text-[13px] hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 leading-snug">{n.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{n.source}</span>
                </span>
                <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

