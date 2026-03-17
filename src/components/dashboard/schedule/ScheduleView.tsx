import { useState } from "react";
import { motion } from "framer-motion";
import ChecklistTab from "./ChecklistTab";
import CalendarTab from "./CalendarTab";
import PlannerTab from "./PlannerTab";

const tabs = [
  { id: "checklist", label: "오늘 체크리스트" },
  { id: "calendar", label: "캘린더" },
  { id: "planner", label: "플래너" },
];

const ScheduleView = () => {
  const [activeTab, setActiveTab] = useState("checklist");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-serif font-bold">일정 관리</h2>

      {/* Tab bar */}
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
                layoutId="schedule-tab"
                className="absolute inset-0 bg-card rounded-md shadow-sm"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === "checklist" && <ChecklistTab />}
        {activeTab === "calendar" && <CalendarTab />}
        {activeTab === "planner" && <PlannerTab />}
      </motion.div>
    </div>
  );
};

export default ScheduleView;
