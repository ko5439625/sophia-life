import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, MapPin, Clock, ChevronDown, ChevronUp } from "lucide-react";

interface PlanItem {
  id: string;
  dayNumber: number;
  time: string;
  title: string;
  place: string;
  category: string;
  memo: string;
}

interface Plan {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  estimatedCost: number;
  status: "planned" | "completed";
  items: PlanItem[];
}

const categoryEmojis: Record<string, string> = {
  food: "🍽️",
  tour: "📸",
  hotel: "🏨",
  cafe: "☕",
  activity: "🎯",
  transport: "🚗",
};

const mockPlans: Plan[] = [
  {
    id: "1",
    title: "제주도 3박 4일",
    startDate: "2026-03-28",
    endDate: "2026-03-31",
    estimatedCost: 800000,
    status: "planned",
    items: [
      { id: "a", dayNumber: 1, time: "10:00", title: "공항 도착", place: "제주공항", category: "transport", memo: "" },
      { id: "b", dayNumber: 1, time: "12:00", title: "흑돼지 점심", place: "돈사돈", category: "food", memo: "예약 완료" },
      { id: "c", dayNumber: 1, time: "14:00", title: "성산일출봉", place: "성산읍", category: "tour", memo: "" },
      { id: "d", dayNumber: 2, time: "09:00", title: "카페 투어", place: "한림읍", category: "cafe", memo: "" },
      { id: "e", dayNumber: 2, time: "18:00", title: "해산물 저녁", place: "협재 해변", category: "food", memo: "" },
    ],
  },
];

const PlannerTab = () => {
  const [plans] = useState<Plan[]>(mockPlans);
  const [expandedPlan, setExpandedPlan] = useState<string | null>("1");

  const formatCost = (n: number) =>
    new Intl.NumberFormat("ko-KR").format(n) + "원";

  return (
    <div className="space-y-4">
      {plans.map((plan) => {
        const isExpanded = expandedPlan === plan.id;
        const days = Math.max(...plan.items.map((i) => i.dayNumber));

        return (
          <motion.div
            key={plan.id}
            layout
            className="bg-card rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <div>
                <h4 className="font-serif font-semibold text-lg">{plan.title}</h4>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {plan.startDate} ~ {plan.endDate} · {formatCost(plan.estimatedCost)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-mono px-2 py-1 rounded-md ${
                    plan.status === "planned"
                      ? "bg-accent/20 text-accent"
                      : "bg-primary/20 text-primary"
                  }`}
                >
                  {plan.status === "planned" ? "예정" : "완료"}
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {isExpanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-5 pb-5 space-y-4"
              >
                {Array.from({ length: days }, (_, i) => i + 1).map((day) => (
                  <div key={day}>
                    <h5 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
                      Day {day}
                    </h5>
                    <div className="space-y-2 ml-2 border-l-2 border-border pl-4">
                      {plan.items
                        .filter((item) => item.dayNumber === day)
                        .map((item) => (
                          <div key={item.id} className="flex items-start gap-3 py-1">
                            <span className="text-sm mt-0.5">
                              {categoryEmojis[item.category] || "📌"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs font-mono text-muted-foreground">
                                  {item.time}
                                </span>
                              </div>
                              <p className="text-sm font-medium mt-0.5">{item.title}</p>
                              {item.place && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    {item.place}
                                  </span>
                                </div>
                              )}
                              {item.memo && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.memo}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>
        );
      })}

      {plans.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-10 font-mono">
          플랜이 없습니다
        </p>
      )}
    </div>
  );
};

export default PlannerTab;
