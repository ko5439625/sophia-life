// 데스크톱 돈 탭 — 하위 탭 대신 대시보드 한 화면 + 필요할 때 전체 화면 도구
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart3, CandlestickChart, LayoutGrid, Shield } from "lucide-react";
import BudgetPlan from "../finance/BudgetPlan";
import ExpenseAnalysis from "../finance/ExpenseAnalysis";
import AssetOverview from "../finance/AssetOverview";
import InvestmentView from "../finance/InvestmentView";
import NewsView from "../finance/NewsView";
import QuantRecommendView from "../finance/QuantRecommendView";
import HedgingView from "../finance/HedgingView";
import TradingView from "../finance/TradingView";
import { cn } from "@/lib/utils";
import { AssetSummaryPanel, BudgetPanel, HoldingsPanel, MarketNewsPanel, RecentExpensesPanel } from "./MoneyPanels";
import type { MoneyToolView } from "./MoneyPanels";
import { PensionDialog } from "./PensionDialog";

const VIEW_LABEL: Record<MoneyToolView, string> = {
  dashboard: "대시보드",
  budget: "예산 계획",
  expenses: "지출 관리",
  assets: "자산 현황",
  portfolio: "투자 현황",
  news: "뉴스",
  quant: "퀀트 추천",
  hedging: "헷징 분석",
  trading: "매매",
};

const PAGES: MoneyToolView[] = ["dashboard", "budget", "expenses", "assets", "portfolio", "news"];
const TOOLS: { id: MoneyToolView; icon: typeof BarChart3 }[] = [
  { id: "quant", icon: BarChart3 },
  { id: "hedging", icon: Shield },
  { id: "trading", icon: CandlestickChart },
];

// 예전 하위 탭 id → 데스크톱 화면
const SUBTAB_TO_VIEW: Record<string, MoneyToolView> = {
  budget: "budget",
  analysis: "expenses",
  asset: "assets",
  portfolio: "portfolio",
  quant: "quant",
  trading: "trading",
  hedging: "hedging",
};

interface Props {
  section?: "finance" | "investment" | "news";
  initialTab?: string | null;
  onTabUsed?: () => void;
  onQuickExpense?: () => void;
}

export default function MoneyDesktop({ section, initialTab, onTabUsed, onQuickExpense }: Props) {
  const [view, setView] = useState<MoneyToolView>(() =>
    initialTab && SUBTAB_TO_VIEW[initialTab] ? SUBTAB_TO_VIEW[initialTab] : section === "news" ? "news" : "dashboard",
  );
  const [pensionOpen, setPensionOpen] = useState(initialTab === "pension");

  useEffect(() => {
    if (!initialTab) return;
    if (initialTab === "pension") setPensionOpen(true);
    else if (SUBTAB_TO_VIEW[initialTab]) setView(SUBTAB_TO_VIEW[initialTab]);
    onTabUsed?.();
  }, [initialTab, onTabUsed]);

  const open = (v: MoneyToolView) => {
    setView(v);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="space-y-4" data-testid="money-desktop" data-view={view}>
      {/* 화면 전환 + 분석 도구 */}
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex gap-0.5 rounded-lg border border-border bg-card p-0.5" aria-label="돈 화면">
          {PAGES.map((p) => (
            <button
              key={p}
              onClick={() => open(p)}
              aria-current={view === p ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] transition-colors",
                view === p ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p === "dashboard" && <LayoutGrid className="h-3.5 w-3.5" />}
              {VIEW_LABEL[p]}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5" data-testid="money-tools">
          <span className="mr-1 text-xs text-muted-foreground">분석 도구</span>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => open(t.id)}
              aria-current={view === t.id ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] transition-colors",
                view === t.id ? "border-foreground/40 bg-muted font-medium" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {VIEW_LABEL[t.id]}
            </button>
          ))}
        </div>
      </div>

      <motion.div key={view} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {view === "dashboard" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 items-start gap-4">
              <BudgetPanel onOpen={open} />
              <RecentExpensesPanel onOpen={open} onQuickExpense={onQuickExpense} />
              <AssetSummaryPanel onOpen={open} />
            </div>
            {/* 윗줄과 같은 3열 격자 → 모서리가 맞도록 투자 표는 2칸 */}
            <div className="grid grid-cols-3 items-start gap-4">
              <div className="col-span-2 min-w-0">
                <HoldingsPanel onOpen={open} />
              </div>
              <MarketNewsPanel onOpen={open} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => open("dashboard")}
              className="-ml-2 inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> 대시보드
            </button>
            {/* 한 화면 도구는 읽기 편한 폭으로 */}
            <div className={cn(view === "news" || view === "budget" || view === "expenses" ? "max-w-5xl" : "")}>
              {view === "budget" && <BudgetPlan />}
              {view === "expenses" && <ExpenseAnalysis />}
              {view === "assets" && <AssetOverview />}
              {view === "portfolio" && <InvestmentView />}
              {view === "news" && <NewsView />}
              {view === "quant" && <QuantRecommendView />}
              {view === "hedging" && <HedgingView />}
              {view === "trading" && <TradingView />}
            </div>
          </div>
        )}
      </motion.div>
      <PensionDialog open={pensionOpen} onOpenChange={setPensionOpen} />
    </div>
  );
}
