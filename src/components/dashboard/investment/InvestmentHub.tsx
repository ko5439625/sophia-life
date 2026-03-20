import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import InvestmentView from "../finance/InvestmentView";
import HedgingView from "../finance/HedgingView";
import QuantRecommendView from "../finance/QuantRecommendView";
import TradingView from "../finance/TradingView";
import PensionView from "./PensionView";

const tabs = [
  { id: "portfolio", label: "투자 현황" },
  { id: "pension", label: "연금 투자" },
  { id: "quant", label: "퀀트 추천" },
  { id: "trading", label: "매매" },
  { id: "hedging", label: "헷징 분석" },
];

const InvestmentHub = ({ initialTab, onTabUsed }: { initialTab?: string | null; onTabUsed?: () => void }) => {
  const [activeTab, setActiveTab] = useState(initialTab || "portfolio");

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      onTabUsed?.();
    }
  }, [initialTab]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold">투자</h2>

      <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 relative px-2 sm:px-4 py-2.5 text-[11px] sm:text-sm font-medium rounded-md transition-colors min-h-[40px] ${
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
              {tab.id === "quant" && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500/50 flex-shrink-0" />
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
        {activeTab === "pension" && <PensionView />}
        {activeTab === "quant" && <QuantRecommendView />}
        {activeTab === "trading" && <TradingView />}
        {activeTab === "hedging" && <HedgingView />}
      </motion.div>
    </div>
  );
};

export default InvestmentHub;
