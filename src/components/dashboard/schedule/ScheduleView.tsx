import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import ChecklistTab from "./ChecklistTab";
import CalendarTab from "./CalendarTab";
import PlannerTab from "./PlannerTab";
import ScheduleDesktop from "../desktop/ScheduleDesktop";
import { useIsDesktop } from "../desktop/useMediaQuery";

const tabs = [
  { id: "checklist", label: "주간 계획" },
  { id: "calendar", label: "캘린더" },
  { id: "planner", label: "플래너" },
];

const ScheduleView = (props: { initialTab?: string | null; onTabUsed?: () => void } = {}) => {
  const isDesktop = useIsDesktop();
  // 데스크톱: 하위 탭 대신 캘린더 + 오늘/이번 주/D-day 동시 표시
  if (isDesktop) return <ScheduleDesktop initialTab={props.initialTab} onTabUsed={props.onTabUsed} />;
  return <ScheduleTabs {...props} />;
};

const ScheduleTabs = ({ initialTab, onTabUsed }: { initialTab?: string | null; onTabUsed?: () => void }) => {
  const [activeTab, setActiveTab] = useState(initialTab || "checklist");

  useEffect(() => {
    if (initialTab) { setActiveTab(initialTab); onTabUsed?.(); }
  }, [initialTab]);

  return (
    <div className="space-y-6">
      {/* 태블릿 이상은 상단 헤더에 탭 이름이 크게 보이므로 숨김 */}
      <h2 className="text-xl sm:text-2xl font-sans font-bold md:hidden">일정 관리</h2>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 relative min-h-[40px] px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors flex-shrink-0 ${
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
