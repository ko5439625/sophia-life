import { useState } from "react";
import { motion } from "framer-motion";
import ExpenseInput from "./ExpenseInput";
import ExpenseAnalysis from "./ExpenseAnalysis";

const tabs = [
  { id: "input", label: "입력" },
  { id: "analysis", label: "분석" },
];

const FinanceView = () => {
  const [activeTab, setActiveTab] = useState("input");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-serif font-bold">자산 & 경제</h2>

      <div className="flex gap-1 bg-muted rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 relative px-4 py-2 text-sm font-medium rounded-md transition-colors ${
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
        {activeTab === "input" && <ExpenseInput />}
        {activeTab === "analysis" && <ExpenseAnalysis />}
      </motion.div>
    </div>
  );
};

export default FinanceView;
