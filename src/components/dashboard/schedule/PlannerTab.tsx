import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Plane,
  Trash2,
  Edit3,
  Save,
  Lock,
} from "lucide-react";
import { useGuestMode } from "@/hooks/useGuestMode";

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
  memo: string;
  items: PlanItem[];
}

const categoryEmojis: Record<string, string> = {
  food: "\u{1F37D}\uFE0F",
  tour: "\u{1F4F8}",
  hotel: "\u{1F3E8}",
  cafe: "\u2615",
  activity: "\u{1F3AF}",
  transport: "\u{1F697}",
};

const mockPlans: Plan[] = [
  {
    id: "1",
    title: "제주도 3박 4일",
    startDate: "2026-03-28",
    endDate: "2026-03-31",
    estimatedCost: 800000,
    status: "planned",
    memo: "봄 제주 여행! 벚꽃 시즌",
    items: [
      { id: "a", dayNumber: 1, time: "10:00", title: "공항 도착", place: "제주공항", category: "transport", memo: "" },
      { id: "b", dayNumber: 1, time: "12:00", title: "흑돼지 점심", place: "돈사돈", category: "food", memo: "예약 완료" },
      { id: "c", dayNumber: 1, time: "14:00", title: "성산일출봉", place: "성산읍", category: "tour", memo: "" },
      { id: "d", dayNumber: 2, time: "09:00", title: "카페 투어", place: "한림읍", category: "cafe", memo: "" },
      { id: "e", dayNumber: 2, time: "18:00", title: "해산물 저녁", place: "협재 해변", category: "food", memo: "" },
    ],
  },
];

const YEARS = [2025, 2026, 2027];

/** Calculate number of days between two date strings (inclusive) */
const getDayCount = (start: string, end: string): number => {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
};

const PlannerTab = () => {
  const { isGuest } = useGuestMode();
  const [plans, setPlans] = useState<Plan[]>(mockPlans);
  const [expandedPlan, setExpandedPlan] = useState<string | null>("1");
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(3);
  const [showForm, setShowForm] = useState(false);
  const [newTrip, setNewTrip] = useState({
    title: "",
    startDate: "",
    endDate: "",
    memo: "",
    estimatedCost: "",
  });

  // Editing trip state
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editTrip, setEditTrip] = useState({
    title: "",
    startDate: "",
    endDate: "",
    memo: "",
    estimatedCost: "",
  });

  // Adding schedule item state per plan
  const [addingScheduleDay, setAddingScheduleDay] = useState<{
    planId: string;
    dayNumber: number;
  } | null>(null);
  const [newScheduleItem, setNewScheduleItem] = useState({
    time: "",
    title: "",
    place: "",
    memo: "",
    category: "activity",
  });

  const formatCost = (n: number) =>
    new Intl.NumberFormat("ko-KR").format(n) + "원";

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleAddTrip = () => {
    if (!newTrip.title.trim() || !newTrip.startDate || !newTrip.endDate) return;
    const plan: Plan = {
      id: Date.now().toString(),
      title: newTrip.title,
      startDate: newTrip.startDate,
      endDate: newTrip.endDate,
      estimatedCost: parseInt(newTrip.estimatedCost.replace(/,/g, "")) || 0,
      status: "planned",
      memo: newTrip.memo,
      items: [],
    };
    setPlans((prev) => [...prev, plan]);
    setNewTrip({ title: "", startDate: "", endDate: "", memo: "", estimatedCost: "" });
    setShowForm(false);
    setExpandedPlan(plan.id);
  };

  const handleDeleteTrip = (planId: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== planId));
    if (expandedPlan === planId) setExpandedPlan(null);
  };

  const startEditTrip = (plan: Plan) => {
    setEditingTripId(plan.id);
    setEditTrip({
      title: plan.title,
      startDate: plan.startDate,
      endDate: plan.endDate,
      memo: plan.memo,
      estimatedCost: plan.estimatedCost.toString(),
    });
  };

  const handleSaveEditTrip = () => {
    if (!editingTripId) return;
    setPlans((prev) =>
      prev.map((p) =>
        p.id === editingTripId
          ? {
              ...p,
              title: editTrip.title,
              startDate: editTrip.startDate,
              endDate: editTrip.endDate,
              memo: editTrip.memo,
              estimatedCost: parseInt(editTrip.estimatedCost.replace(/,/g, "")) || 0,
            }
          : p
      )
    );
    setEditingTripId(null);
  };

  const handleAddScheduleItem = (planId: string, dayNumber: number) => {
    if (!newScheduleItem.title.trim()) return;
    const item: PlanItem = {
      id: Date.now().toString(),
      dayNumber,
      time: newScheduleItem.time,
      title: newScheduleItem.title,
      place: newScheduleItem.place,
      category: newScheduleItem.category,
      memo: newScheduleItem.memo,
    };
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId ? { ...p, items: [...p.items, item] } : p
      )
    );
    setNewScheduleItem({ time: "", title: "", place: "", memo: "", category: "activity" });
    setAddingScheduleDay(null);
  };

  const handleDeleteScheduleItem = (planId: string, itemId: string) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? { ...p, items: p.items.filter((i) => i.id !== itemId) }
          : p
      )
    );
  };

  // Filter plans for selected year/month
  const filteredPlans = plans.filter((plan) => {
    const start = new Date(plan.startDate);
    const end = new Date(plan.endDate);
    const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
    const monthEnd = new Date(selectedYear, selectedMonth, 0);
    return start <= monthEnd && end >= monthStart;
  });

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
        <Lock className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">비공개 콘텐츠입니다</p>
        <p className="text-xs text-muted-foreground/60 mt-1">게스트 모드에서는 열람할 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Year/Month Navigation */}
      <div className="bg-card rounded-xl p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-mono font-bold focus:outline-none cursor-pointer"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <span className="text-lg font-bold">{selectedMonth}월</span>
          </div>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Add trip button */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full flex items-center justify-center gap-2 py-3 bg-card rounded-xl text-sm text-primary hover:bg-card/80 transition-colors border border-dashed border-primary/30"
      >
        <Plane className="h-4 w-4" />
        여행 추가
      </button>

      {/* Add trip form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-card rounded-xl overflow-hidden"
          >
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  새 여행 계획
                </h4>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1 hover:bg-muted rounded-md transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  여행명
                </label>
                <input
                  type="text"
                  value={newTrip.title}
                  onChange={(e) =>
                    setNewTrip({ ...newTrip, title: e.target.value })
                  }
                  placeholder="오사카 2박 3일"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    시작일
                  </label>
                  <input
                    type="date"
                    value={newTrip.startDate}
                    onChange={(e) =>
                      setNewTrip({ ...newTrip, startDate: e.target.value })
                    }
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    종료일
                  </label>
                  <input
                    type="date"
                    value={newTrip.endDate}
                    onChange={(e) =>
                      setNewTrip({ ...newTrip, endDate: e.target.value })
                    }
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  예상 비용
                </label>
                <input
                  type="text"
                  value={newTrip.estimatedCost}
                  onChange={(e) =>
                    setNewTrip({ ...newTrip, estimatedCost: e.target.value })
                  }
                  placeholder="800000"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  메모
                </label>
                <textarea
                  value={newTrip.memo}
                  onChange={(e) =>
                    setNewTrip({ ...newTrip, memo: e.target.value })
                  }
                  placeholder="여행 메모..."
                  rows={2}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <button
                onClick={handleAddTrip}
                className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                추가하기
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plans list */}
      {filteredPlans.map((plan) => {
        const isExpanded = expandedPlan === plan.id;
        const isEditingThis = editingTripId === plan.id;
        const dayCount = getDayCount(plan.startDate, plan.endDate);

        return (
          <motion.div
            key={plan.id}
            layout
            className="bg-card rounded-lg overflow-hidden"
          >
            {/* Trip header */}
            <div className="flex items-start sm:items-center justify-between p-4 sm:p-5 gap-2">
              <button
                onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                className="flex-1 text-left min-w-0"
              >
                <h4 className="font-semibold text-base sm:text-lg truncate">{plan.title}</h4>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-mono mt-1 break-all">
                  {plan.startDate} ~ {plan.endDate} ({dayCount}일) ·{" "}
                  {formatCost(plan.estimatedCost)}
                </p>
                {plan.memo && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.memo}
                  </p>
                )}
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => startEditTrip(plan)}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                  title="수정"
                >
                  <Edit3 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
                <button
                  onClick={() => handleDeleteTrip(plan.id)}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                  title="삭제"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
                <span
                  className={`text-xs font-mono px-2 py-1 rounded-md ${
                    plan.status === "planned"
                      ? "bg-accent/20 text-accent"
                      : "bg-primary/20 text-primary"
                  }`}
                >
                  {plan.status === "planned" ? "예정" : "완료"}
                </span>
                <button onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>

            {/* Edit trip form */}
            <AnimatePresence>
              {isEditingThis && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-5 pb-4 space-y-3 border-t border-border pt-4 overflow-hidden"
                >
                  <h5 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    여행 정보 수정
                  </h5>
                  <input
                    type="text"
                    value={editTrip.title}
                    onChange={(e) => setEditTrip({ ...editTrip, title: e.target.value })}
                    placeholder="여행명"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={editTrip.startDate}
                      onChange={(e) => setEditTrip({ ...editTrip, startDate: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <input
                      type="date"
                      value={editTrip.endDate}
                      onChange={(e) => setEditTrip({ ...editTrip, endDate: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <input
                    type="text"
                    value={editTrip.estimatedCost}
                    onChange={(e) => setEditTrip({ ...editTrip, estimatedCost: e.target.value })}
                    placeholder="예상 비용"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <textarea
                    value={editTrip.memo}
                    onChange={(e) => setEditTrip({ ...editTrip, memo: e.target.value })}
                    placeholder="메모"
                    rows={2}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEditTrip}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <Save className="h-3.5 w-3.5" />
                      저장
                    </button>
                    <button
                      onClick={() => setEditingTripId(null)}
                      className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-medium hover:bg-muted/80 transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Expanded day-by-day schedule */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="px-5 pb-5 space-y-4"
                >
                  {Array.from({ length: dayCount }, (_, i) => i + 1).map(
                    (day) => {
                      const dayItems = plan.items
                        .filter((item) => item.dayNumber === day)
                        .sort((a, b) => a.time.localeCompare(b.time));
                      const isAddingForThisDay =
                        addingScheduleDay?.planId === plan.id &&
                        addingScheduleDay?.dayNumber === day;

                      return (
                        <div key={day}>
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                              Day {day}
                            </h5>
                            <button
                              onClick={() => {
                                if (isAddingForThisDay) {
                                  setAddingScheduleDay(null);
                                } else {
                                  setAddingScheduleDay({ planId: plan.id, dayNumber: day });
                                  setNewScheduleItem({ time: "", title: "", place: "", memo: "", category: "activity" });
                                }
                              }}
                              className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                              일정 추가
                            </button>
                          </div>

                          {/* Add schedule item form */}
                          <AnimatePresence>
                            {isAddingForThisDay && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="mb-3 p-3 bg-muted/30 rounded-lg space-y-2 overflow-hidden"
                              >
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[10px] text-muted-foreground mb-0.5 block">시간</label>
                                    <input
                                      type="time"
                                      value={newScheduleItem.time}
                                      onChange={(e) =>
                                        setNewScheduleItem({ ...newScheduleItem, time: e.target.value })
                                      }
                                      className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-muted-foreground mb-0.5 block">카테고리</label>
                                    <select
                                      value={newScheduleItem.category}
                                      onChange={(e) =>
                                        setNewScheduleItem({ ...newScheduleItem, category: e.target.value })
                                      }
                                      className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                      {Object.entries(categoryEmojis).map(([key, emoji]) => (
                                        <option key={key} value={key}>
                                          {emoji} {key}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground mb-0.5 block">일정 제목</label>
                                  <input
                                    type="text"
                                    value={newScheduleItem.title}
                                    onChange={(e) =>
                                      setNewScheduleItem({ ...newScheduleItem, title: e.target.value })
                                    }
                                    placeholder="일정명"
                                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground mb-0.5 block">장소</label>
                                  <input
                                    type="text"
                                    value={newScheduleItem.place}
                                    onChange={(e) =>
                                      setNewScheduleItem({ ...newScheduleItem, place: e.target.value })
                                    }
                                    placeholder="장소"
                                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground mb-0.5 block">메모</label>
                                  <input
                                    type="text"
                                    value={newScheduleItem.memo}
                                    onChange={(e) =>
                                      setNewScheduleItem({ ...newScheduleItem, memo: e.target.value })
                                    }
                                    placeholder="메모 (선택)"
                                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAddScheduleItem(plan.id, day)}
                                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                                  >
                                    추가
                                  </button>
                                  <button
                                    onClick={() => setAddingScheduleDay(null)}
                                    className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-medium hover:bg-muted/80 transition-colors"
                                  >
                                    취소
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Schedule items for this day */}
                          {dayItems.length > 0 ? (
                            <div className="space-y-2 ml-2 border-l-2 border-border pl-4">
                              {dayItems.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-start gap-3 py-1 group"
                                >
                                  <span className="text-sm mt-0.5">
                                    {categoryEmojis[item.category] || "\u{1F4CC}"}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      <span className="text-xs font-mono text-muted-foreground">
                                        {item.time}
                                      </span>
                                    </div>
                                    <p className="text-sm font-medium mt-0.5">
                                      {item.title}
                                    </p>
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
                                  <button
                                    onClick={() => handleDeleteScheduleItem(plan.id, item.id)}
                                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-muted rounded transition-all flex-shrink-0"
                                    title="삭제"
                                  >
                                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground/50 ml-6 mb-2">
                              일정이 없습니다
                            </p>
                          )}
                        </div>
                      );
                    }
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}

      {filteredPlans.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-10 font-mono">
          {selectedYear}년 {selectedMonth}월에 플랜이 없습니다
        </p>
      )}
    </div>
  );
};

export default PlannerTab;
