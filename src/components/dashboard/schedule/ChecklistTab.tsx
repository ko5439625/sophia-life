import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, Trash2, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Todo {
  id: string;
  title: string;
  memo: string;
  isDone: boolean;
  date: string;
}

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

// Helper: get Monday of the week containing `date`
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun,1=Mon,...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Spread mock data across the current week
function generateMockTodos(): Todo[] {
  const monday = getMonday(new Date());
  return [
    { id: "1", title: "아침 운동 30분", memo: "", isDone: false, date: formatDateKey(monday) },
    { id: "2", title: "장보기 - 우유, 계란, 빵", memo: "근처 마트", isDone: true, date: formatDateKey(monday) },
    { id: "3", title: "블로그 글 작성", memo: "여행 후기", isDone: false, date: formatDateKey(addDays(monday, 1)) },
    { id: "4", title: "코드 리뷰", memo: "", isDone: true, date: formatDateKey(addDays(monday, 1)) },
    { id: "5", title: "팀 미팅 준비", memo: "발표 자료", isDone: false, date: formatDateKey(addDays(monday, 2)) },
    { id: "6", title: "저녁 요리하기", memo: "", isDone: false, date: formatDateKey(addDays(monday, 2)) },
    { id: "7", title: "영어 공부 1시간", memo: "", isDone: true, date: formatDateKey(addDays(monday, 3)) },
    { id: "8", title: "택배 수령", memo: "", isDone: false, date: formatDateKey(addDays(monday, 3)) },
    { id: "9", title: "카페 방문", memo: "새로 오픈한 곳", isDone: false, date: formatDateKey(addDays(monday, 4)) },
    { id: "10", title: "운동복 빨래", memo: "", isDone: false, date: formatDateKey(addDays(monday, 5)) },
    { id: "11", title: "넷플릭스 영화", memo: "", isDone: false, date: formatDateKey(addDays(monday, 5)) },
    { id: "12", title: "다음 주 계획 세우기", memo: "", isDone: false, date: formatDateKey(addDays(monday, 6)) },
  ];
}

const ChecklistTab = () => {
  const isMobile = useIsMobile();
  const [todos, setTodos] = useState<Todo[]>(generateMockTodos);
  const [weekOffset, setWeekOffset] = useState(0);
  const [newTitles, setNewTitles] = useState<Record<string, string>>({});

  // Today's key using actual current date
  const todayKey = useMemo(() => formatDateKey(new Date()), []);

  // Selected day - default to today
  const [selectedDay, setSelectedDay] = useState<string>(todayKey);

  // Compute the Monday for the displayed week
  const baseMonday = useMemo(() => {
    const m = getMonday(new Date());
    return addDays(m, weekOffset * 7);
  }, [weekOffset]);

  // 7 days of the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(baseMonday, i);
      return {
        dateKey: formatDateKey(d),
        label: DAY_LABELS[i],
        month: d.getMonth() + 1,
        day: d.getDate(),
        isToday: formatDateKey(d) === todayKey,
      };
    });
  }, [baseMonday, todayKey]);

  // When week changes, select first day of that week (or today if in current week)
  const effectiveSelectedDay = useMemo(() => {
    const inThisWeek = weekDays.some((wd) => wd.dateKey === selectedDay);
    if (inThisWeek) return selectedDay;
    // If today is in this week, select today
    const todayInWeek = weekDays.find((wd) => wd.isToday);
    if (todayInWeek) return todayInWeek.dateKey;
    // Otherwise select first day
    return weekDays[0].dateKey;
  }, [weekDays, selectedDay]);

  const todosByDate = useMemo(() => {
    const map: Record<string, Todo[]> = {};
    for (const wd of weekDays) {
      map[wd.dateKey] = todos.filter((t) => t.date === wd.dateKey);
    }
    return map;
  }, [todos, weekDays]);

  const toggleTodo = (id: string) => {
    setTodos(todos.map((t) => (t.id === id ? { ...t, isDone: !t.isDone } : t)));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((t) => t.id !== id));
  };

  const addTodo = (dateKey: string) => {
    const title = (newTitles[dateKey] || "").trim();
    if (!title) return;
    setTodos([
      ...todos,
      {
        id: Date.now().toString(),
        title,
        memo: "",
        isDone: false,
        date: dateKey,
      },
    ]);
    setNewTitles({ ...newTitles, [dateKey]: "" });
  };

  const setNewTitle = (dateKey: string, value: string) => {
    setNewTitles({ ...newTitles, [dateKey]: value });
  };

  // Week header label
  const weekLabel = `${weekDays[0].month}/${weekDays[0].day} - ${weekDays[6].month}/${weekDays[6].day}`;

  // Selected day info
  const selectedDayInfo = weekDays.find((wd) => wd.dateKey === effectiveSelectedDay);
  const selectedDayTodos = todosByDate[effectiveSelectedDay] || [];
  const selectedDoneCount = selectedDayTodos.filter((t) => t.isDone).length;
  const selectedProgress =
    selectedDayTodos.length > 0
      ? (selectedDoneCount / selectedDayTodos.length) * 100
      : 0;

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <span className="text-sm font-mono font-medium">{weekLabel}</span>
          {weekOffset !== 0 && (
            <button
              onClick={() => {
                setWeekOffset(0);
                setSelectedDay(todayKey);
              }}
              className="ml-2 text-[10px] text-primary hover:underline font-mono"
            >
              오늘
            </button>
          )}
        </div>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Overall week progress */}
      {(() => {
        const allWeekTodos = weekDays.flatMap((wd) => todosByDate[wd.dateKey] || []);
        const allDone = allWeekTodos.filter((t) => t.isDone).length;
        return (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>주간 진행률</span>
              <span>
                {allDone}/{allWeekTodos.length}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{
                  width:
                    allWeekTodos.length > 0
                      ? `${(allDone / allWeekTodos.length) * 100}%`
                      : "0%",
                }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        );
      })()}

      {/* Date tabs / pills - horizontal row */}
      <div className={`flex gap-1.5 ${isMobile ? "overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide" : ""}`}>
        {weekDays.map((wd) => {
          const isSelected = wd.dateKey === effectiveSelectedDay;
          const dayTodos = todosByDate[wd.dateKey] || [];
          const doneCount = dayTodos.filter((t) => t.isDone).length;
          return (
            <button
              key={wd.dateKey}
              onClick={() => setSelectedDay(wd.dateKey)}
              className={`relative flex flex-col items-center px-3 py-2 rounded-xl transition-all flex-shrink-0 ${
                isMobile ? "min-w-[64px]" : "flex-1"
              } ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-md"
                  : wd.isToday
                  ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                  : "bg-card text-foreground hover:bg-muted"
              }`}
            >
              <span className={`text-xs font-medium ${isSelected ? "text-primary-foreground" : ""}`}>
                {wd.label}
              </span>
              <span className={`text-sm font-mono font-semibold ${isSelected ? "text-primary-foreground" : ""}`}>
                {wd.month}/{wd.day}
              </span>
              {dayTodos.length > 0 && (
                <span
                  className={`text-[9px] font-mono mt-0.5 ${
                    isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {doneCount}/{dayTodos.length}
                </span>
              )}
              {wd.isToday && !isSelected && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail view */}
      <AnimatePresence mode="wait">
        <motion.div
          key={effectiveSelectedDay}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="bg-card rounded-xl p-5 md:p-6"
        >
          {/* Day header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">
                {selectedDayInfo?.label} ({selectedDayInfo?.month}/{selectedDayInfo?.day})
              </h3>
              {selectedDayInfo?.isToday && (
                <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-mono font-medium">
                  오늘
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {selectedDoneCount}/{selectedDayTodos.length} 완료
            </span>
          </div>

          {/* Day progress bar */}
          <div className="h-1 bg-muted rounded-full overflow-hidden mb-5">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${selectedProgress}%` }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          {/* Task list */}
          <div className="space-y-2">
            {selectedDayTodos.map((todo) => (
              <motion.div
                key={todo.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 group py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-all flex-shrink-0 border-2 ${
                    todo.isDone
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/30 hover:border-primary"
                  }`}
                >
                  {todo.isDone && (
                    <Check className="h-3 w-3 text-primary-foreground" />
                  )}
                </button>
                <span
                  className={`flex-1 text-sm transition-all ${
                    todo.isDone
                      ? "line-through text-muted-foreground"
                      : "text-foreground"
                  }`}
                >
                  {todo.title}
                </span>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
            {selectedDayTodos.length === 0 && (
              <p className="text-sm text-muted-foreground/50 text-center py-6">
                이 날에는 할 일이 없습니다
              </p>
            )}
          </div>

          {/* Add task input */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
            <input
              type="text"
              placeholder="새 할 일 추가..."
              value={newTitles[effectiveSelectedDay] || ""}
              onChange={(e) => setNewTitle(effectiveSelectedDay, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTodo(effectiveSelectedDay)}
              className="flex-1 min-w-0 bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/40"
            />
            <button
              onClick={() => addTodo(effectiveSelectedDay)}
              className="bg-primary text-primary-foreground hover:opacity-90 transition-opacity rounded-lg px-3 py-2 flex-shrink-0"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ChecklistTab;
