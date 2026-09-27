import { useEffect } from "react";
import { motion } from "framer-motion";
import { Newspaper, TrendingUp, Wallet } from "lucide-react";
import FinanceView from "../finance/FinanceView";
import InvestmentHub from "../investment/InvestmentHub";
import NewsView from "../finance/NewsView";

// 돈 탭 — 기존 자산 / 투자 / 뉴스 최상위 탭을 하나로 합침
export type MoneySection = "finance" | "investment" | "news";

const sections: { id: MoneySection; label: string; icon: typeof Wallet }[] = [
  { id: "finance", label: "자산", icon: Wallet },
  { id: "investment", label: "투자", icon: TrendingUp },
  { id: "news", label: "뉴스", icon: Newspaper },
];

interface MoneyViewProps {
  section: MoneySection;
  onSectionChange: (s: MoneySection) => void;
  initialTab?: string | null;
  onTabUsed?: () => void;
}

const MoneyView = ({ section, onSectionChange, initialTab, onTabUsed }: MoneyViewProps) => {
  // 뉴스는 하위 탭이 없으므로 넘어온 하위 탭 지시는 바로 소비
  useEffect(() => {
    if (section === "news" && initialTab) onTabUsed?.();
  }, [section, initialTab, onTabUsed]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold">돈</h2>
        <div className="flex gap-1 bg-muted rounded-full p-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => onSectionChange(s.id)}
              className={`relative flex items-center gap-1.5 px-3.5 sm:px-4 min-h-[36px] text-sm font-medium rounded-full transition-colors ${
                section === s.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {section === s.id && (
                <motion.div
                  layoutId="money-section"
                  className="absolute inset-0 bg-card rounded-full shadow-sm"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <s.icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {section === "finance" && <FinanceView embedded initialTab={initialTab} onTabUsed={onTabUsed} />}
      {section === "investment" && <InvestmentHub embedded initialTab={initialTab} onTabUsed={onTabUsed} />}
      {section === "news" && <NewsView />}
    </div>
  );
};

export default MoneyView;
