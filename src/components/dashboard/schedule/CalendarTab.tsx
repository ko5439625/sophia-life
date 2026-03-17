import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Lock } from "lucide-react";
import { useGuestMode } from "@/hooks/useGuestMode";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  emoji: string;
  isShared: boolean;
}

const EMOJI_OPTIONS = [
  "\u2764\uFE0F", "\u{1F389}", "\u{1F3E5}", "\u{1F37D}\uFE0F", "\u2708\uFE0F",
  "\u{1F4DA}", "\u{1F3B5}", "\u{1F381}", "\u{1F3C3}", "\u{1F4BC}",
  "\u{1F4DD}", "\u2615", "\u{1F3AC}", "\u{1F6D2}", "\u{1F46B}",
  "\u{1F393}", "\u{1F4AA}", "\u{1F3A8}", "\u{1F6EB}", "\u{1F370}",
];

const DAYS = ["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"];

const CalendarTab = () => {
  const { isGuest } = useGuestMode();
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [events, setEvents] = useState<CalendarEvent[]>([
    { id: "1", title: "\uACB0\uD63C\uAE30\uB150\uC77C", date: "2026-03-20", emoji: "\u2764\uFE0F", isShared: true },
    { id: "2", title: "\uCE58\uACFC \uC608\uC57D", date: "2026-03-18", time: "14:00", emoji: "\u{1F3E5}", isShared: false },
    { id: "3", title: "\uBD80\uBAA8\uB2D8 \uC800\uB155", date: "2026-03-22", time: "18:30", emoji: "\u{1F37D}\uFE0F", isShared: true },
    { id: "4", title: "\uC81C\uC8FC\uB3C4 \uC5EC\uD589", date: "2026-03-28", emoji: "\u2708\uFE0F", isShared: true },
  ]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newEmoji, setNewEmoji] = useState("\u{1F4DD}");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const dateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getEventsForDay = (day: number) =>
    events.filter((e) => e.date === dateStr(day));

  const getEventsForDateStr = (ds: string) =>
    events.filter((e) => e.date === ds);

  // Group all events in this month by date
  const monthEventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = dateStr(d);
      const dayEvents = events.filter((e) => e.date === ds);
      if (dayEvents.length > 0) {
        grouped[ds] = dayEvents;
      }
    }
    return grouped;
  }, [events, daysInMonth, year, month]);

  const sortedEventDates = useMemo(
    () => Object.keys(monthEventsByDate).sort(),
    [monthEventsByDate]
  );

  const handleDateClick = (day: number) => {
    const ds = dateStr(day);
    if (selectedDate === ds) {
      setSelectedDate(null);
    } else {
      setSelectedDate(ds);
      setAddingForDate(null);
    }
  };

  const handleAddEvent = (forDate: string) => {
    const title = newTitle.trim();
    if (!title) return;
    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      title,
      date: forDate,
      time: newTime || undefined,
      emoji: newEmoji,
      isShared: false,
    };
    setEvents([...events, newEvent]);
    setNewTitle("");
    setNewTime("");
    setNewEmoji("\u{1F4DD}");
    setAddingForDate(null);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter((e) => e.id !== id));
  };

  const startAdding = (forDate: string) => {
    setAddingForDate(forDate);
    setNewTitle("");
    setNewTime("");
    setNewEmoji("\u{1F4DD}");
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Inline add form component
  const renderAddForm = (forDate: string) => (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="bg-muted/30 rounded-lg p-3 mt-2 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">일정 추가</span>
          <button
            onClick={() => setAddingForDate(null)}
            className="text-muted-foreground hover:text-foreground p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddEvent(forDate)}
          placeholder="일정 제목"
          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/40"
          autoFocus
        />
        <input
          type="time"
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-muted-foreground"
        />
        {/* Emoji selector */}
        <div>
          <span className="text-[10px] text-muted-foreground mb-1 block">이모지</span>
          <div className="flex flex-wrap gap-1">
            {EMOJI_OPTIONS.map((em) => (
              <button
                key={em}
                onClick={() => setNewEmoji(em)}
                className={`w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all ${
                  newEmoji === em
                    ? "bg-primary/20 ring-1 ring-primary scale-110"
                    : "hover:bg-muted"
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => handleAddEvent(forDate)}
          disabled={!newTitle.trim()}
          className="w-full py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          추가
        </button>
      </div>
    </motion.div>
  );

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
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-base font-semibold">
          {year}년 {month + 1}월
        </h3>
        <button onClick={nextMonth} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-mono text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="h-10 sm:h-12" />;
          const dayEvents = getEventsForDay(day);
          const ds = dateStr(day);
          const isSelected = selectedDate === ds;
          const isToday = ds === todayStr;

          return (
            <motion.button
              key={ds}
              onClick={() => handleDateClick(day)}
              whileTap={{ scale: 0.95 }}
              className={`h-10 sm:h-12 rounded flex flex-col items-center justify-center text-xs relative transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : isToday
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted"
              }`}
            >
              <span className={`font-mono tabular-nums ${isToday && !isSelected ? "font-bold" : ""}`}>
                {day}
              </span>
              {dayEvents.length > 0 && (
                <div className="absolute bottom-0.5 flex gap-px">
                  {dayEvents.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      className={`w-1 h-1 rounded-full ${
                        isSelected
                          ? "bg-primary-foreground"
                          : e.isShared
                          ? "bg-primary"
                          : "bg-accent"
                      }`}
                    />
                  ))}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Selected date detail */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">{selectedDate}</h4>
                <button
                  onClick={() => startAdding(selectedDate)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  일정 추가
                </button>
              </div>
              {getEventsForDateStr(selectedDate).length > 0 ? (
                getEventsForDateStr(selectedDate).map((e) => (
                  <div key={e.id} className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg group">
                    <span className="text-sm">{e.emoji}</span>
                    <span className="text-sm flex-1">{e.title}</span>
                    {e.time && (
                      <span className="text-[10px] text-muted-foreground font-mono">{e.time}</span>
                    )}
                    {e.isShared && (
                      <span className="text-[10px] text-primary font-mono">공유</span>
                    )}
                    <button
                      onClick={() => handleDeleteEvent(e.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground font-mono py-2">일정 없음</p>
              )}
              <AnimatePresence>
                {addingForDate === selectedDate && renderAddForm(selectedDate)}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* All events for the current month */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">
          {month + 1}월 전체 일정
        </h4>
        {sortedEventDates.length > 0 ? (
          sortedEventDates.map((ds) => {
            const dayNum = parseInt(ds.split("-")[2], 10);
            const dayOfWeek = DAYS[new Date(parseInt(ds.split("-")[0]), parseInt(ds.split("-")[1]) - 1, dayNum).getDay()];
            const dayEvents = monthEventsByDate[ds];
            return (
              <div key={ds} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-foreground">
                      {parseInt(ds.split("-")[1])}월 {dayNum}일 ({dayOfWeek})
                    </span>
                    {ds === todayStr && (
                      <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-mono">
                        오늘
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedDate(ds);
                      startAdding(ds);
                    }}
                    className="text-[10px] text-primary hover:underline font-medium flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" />
                    추가
                  </button>
                </div>
                {dayEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg group">
                    <span className="text-sm">{e.emoji}</span>
                    <span className="text-sm flex-1">{e.title}</span>
                    {e.time && (
                      <span className="text-[10px] text-muted-foreground font-mono">{e.time}</span>
                    )}
                    {e.isShared && (
                      <span className="text-[10px] text-primary font-mono">공유</span>
                    )}
                    <button
                      onClick={() => handleDeleteEvent(e.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground font-mono text-center py-4">이번 달 일정이 없습니다</p>
        )}

        {/* Add event for a new date (not in the list yet) */}
        {sortedEventDates.length > 0 && (
          <p className="text-[10px] text-muted-foreground/60 text-center pt-2">
            달력에서 날짜를 클릭하여 새 일정을 추가할 수 있습니다
          </p>
        )}
      </div>
    </div>
  );
};

export default CalendarTab;
