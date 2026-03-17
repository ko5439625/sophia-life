import { useState } from "react";
import { motion } from "framer-motion";
import ChecklistTab from "./ChecklistTab";
import CalendarTab from "./CalendarTab";
import PlannerTab from "./PlannerTab";

const tabs = [
  { id: "checklist", label: "주간 계획" },
  { id: "calendar", label: "캘린더" },
  { id: "planner", label: "플래너" },
];

const ScheduleView = () => {
  const [activeTab, setActiveTab] = useState("checklist");

  return (
    <div className="space-y-6">
      <h2 className="text-xl sm:text-2xl font-sans font-bold">일정 관리</h2>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 relative px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors flex-shrink-0 ${
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
