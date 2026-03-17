import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  emoji: string;
  isShared: boolean;
}

const mockEvents: CalendarEvent[] = [
  { id: "1", title: "결혼기념일", date: "2026-03-20", emoji: "❤️", isShared: true },
  { id: "2", title: "치과 예약", date: "2026-03-18", emoji: "🏥", isShared: false },
  { id: "3", title: "부모님 저녁", date: "2026-03-22", emoji: "🍽️", isShared: true },
  { id: "4", title: "제주도 여행", date: "2026-03-28", emoji: "✈️", isShared: true },
];

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const CalendarTab = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1)); // March 2026
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const dateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getEventsForDay = (day: number) =>
    mockEvents.filter((e) => e.date === dateStr(day));

  const selectedEvents = selectedDate
    ? mockEvents.filter((e) => e.date === selectedDate)
    : [];

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-6">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-lg font-serif font-semibold">
          {year}년 {month + 1}월
        </h3>
        <button onClick={nextMonth} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-mono text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const events = getEventsForDay(day);
          const ds = dateStr(day);
          const isSelected = selectedDate === ds;
          const isToday = ds === new Date().toISOString().slice(0, 10);

          return (
            <motion.button
              key={ds}
              onClick={() => setSelectedDate(isSelected ? null : ds)}
              whileTap={{ scale: 0.95 }}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative transition-colors ${
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
              {events.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {events.slice(0, 3).map((e) => (
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

      {/* Selected date events */}
      {selectedDate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-2"
        >
          <h4 className="text-sm font-mono text-muted-foreground">{selectedDate}</h4>
          {selectedEvents.length > 0 ? (
            selectedEvents.map((e) => (
              <div key={e.id} className="bg-card rounded-lg px-4 py-3 flex items-center gap-3">
                <span className="text-lg">{e.emoji}</span>
                <span className="text-sm">{e.title}</span>
                {e.isShared && (
                  <span className="text-xs text-primary font-mono ml-auto">공유</span>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground font-mono">일정 없음</p>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default CalendarTab;
