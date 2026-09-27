import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import InvestmentView from "../finance/InvestmentView";
import HedgingView from "../finance/HedgingView";
import QuantRecommendView from "../finance/QuantRecommendView";
import TradingView from "../finance/TradingView";

const tabs = [
  { id: "portfolio", label: "투자 현황" },
  { id: "quant", label: "퀀트 추천" },
  { id: "trading", label: "매매" },
  { id: "hedging", label: "헷징 분석" },
];

// 연금은 인출 전까지 못 쓰는 돈이라 별도 탭 대신 자산 현황의 "연금 잔액 · 상세"로 이동
const TAB_IDS = new Set(tabs.map((t) => t.id));

const InvestmentHub = ({ initialTab, onTabUsed, embedded }: { initialTab?: string | null; onTabUsed?: () => void; embedded?: boolean }) => {
  const [activeTab, setActiveTab] = useState(initialTab && TAB_IDS.has(initialTab) ? initialTab : "portfolio");

  useEffect(() => {
    if (initialTab) {
      setActiveTab(TAB_IDS.has(initialTab) ? initialTab : "portfolio");
      onTabUsed?.();
    }
  }, [initialTab]);

  return (
    <div className="space-y-6">
      {!embedded && <h2 className="text-xl sm:text-2xl font-bold">투자</h2>}

      <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-none sm:flex-1 whitespace-nowrap relative px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium rounded-md transition-colors min-h-[40px] ${
              activeTab === tab.id
                ? tab.id === "hedging"
                  ? "text-primary-foreground"
                  : "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="investment-hub-tab"
                className={`absolute inset-0 rounded-md shadow-sm ${
                  tab.id === "hedging"
                    ? "bg-primary"
                    : "bg-card"
                }`}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1">
              {tab.label}
              {tab.id === "hedging" && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0" />
              )}
            </span>
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === "portfolio" && <InvestmentView />}
        {activeTab === "quant" && <QuantRecommendView />}
        {activeTab === "trading" && <TradingView />}
        {activeTab === "hedging" && <HedgingView />}
      </motion.div>
    </div>
  );
};

export default InvestmentHub;
