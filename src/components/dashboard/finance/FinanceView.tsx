import { useState } from "react";
import { motion } from "framer-motion";
import BudgetPlan from "./BudgetPlan";
import AssetOverview from "./AssetOverview";
import ExpenseAnalysis from "./ExpenseAnalysis";

const tabs = [
  { id: "budget", label: "예산 계획" },
  { id: "asset", label: "자산 현황" },
  { id: "analysis", label: "지출 분석" },
];

const FinanceView = () => {
  const [activeTab, setActiveTab] = useState("budget");

  return (
    <div className="space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold">자산 & 경제</h2>

      <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 relative px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors flex-shrink-0 ${
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="finance-tab"
                className="absolute inset-0 bg-card rounded-md shadow-sm"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === "budget" && <BudgetPlan />}
        {activeTab === "asset" && <AssetOverview />}
        {activeTab === "analysis" && <ExpenseAnalysis />}
      </motion.div>
    </div>
  );
};

export default FinanceView;
