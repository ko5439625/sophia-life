// 데스크톱 일정 탭 — 왼쪽 큰 캘린더(또는 플래너) + 오른쪽 [오늘 할 일 · 이번 주 · 다가오는 D-day]
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, CalendarHeart, Check, ListChecks, Map as MapIcon, Plus } from "lucide-react";
import CalendarTab from "../schedule/CalendarTab";
import ChecklistTab from "../schedule/ChecklistTab";
import PlannerTab from "../schedule/PlannerTab";
import { loadDdays, loadTodos, saveTodo } from "@/services/supabaseSync";
import type { DdayRow, TodoRow } from "@/services/supabaseSync";
import { cn } from "@/lib/utils";
import { EmptyState, Panel, PanelLink } from "./Panel";
import { DAY_NAMES, ddayLabel, diffDays, parseDateKey, toDateKey } from "../home/homeUtils";

type MainView = "calendar" | "planner" | "week";

const MAIN_LABEL: Record<MainView, string> = { calendar: "캘린더", week: "주간 계획", planner: "플래너" };

function mondayOf(d: Date) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day));
  return r;
}

export default function ScheduleDesktop({ initialTab, onTabUsed }: { initialTab?: string | null; onTabUsed?: () => void }) {
  const [main, setMain] = useState<MainView>(initialTab === "planner" ? "planner" : "calendar");
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [ddays, setDdays] = useState<DdayRow[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const todayKey = toDateKey(new Date());

  useEffect(() => {
    if (!initialTab) return;
    if (initialTab === "planner") setMain("planner");
    else if (initialTab === "calendar") setMain("calendar");
    else if (initialTab === "checklist") inputRef.current?.focus({ preventScroll: true });
    onTabUsed?.();
  }, [initialTab, onTabUsed]);

  // 주간 계획 화면(ChecklistTab)에서 고친 내용이 오른쪽에도 보이도록 화면 전환 때 다시 읽음
  useEffect(() => {
    let cancelled = false;
    loadTodos().then((rows) => !cancelled && setTodos(rows));
    return () => {
      cancelled = true;
    };
  }, [main]);

  useEffect(() => {
    let cancelled = false;
    loadDdays().then((rows) => !cancelled && setDdays(rows));
    return () => {
      cancelled = true;
    };
  }, []);

  const todayTodos = todos.filter((t) => t.date === todayKey);
  const doneToday = todayTodos.filter((t) => t.is_done).length;

  const week = useMemo(() => {
    const mon = mondayOf(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const key = toDateKey(d);
      const list = todos.filter((t) => t.date === key);
      return { key, d, list, done: list.filter((t) => t.is_done).length };
    });
  }, [todos]);
  const weekTotal = week.reduce((s, w) => s + w.list.length, 0);
  const weekDone = week.reduce((s, w) => s + w.done, 0);

  const upcomingDdays = useMemo(
    () =>
      ddays
        .map((d) => ({ ...d, diff: diffDays(d.date) }))
        .filter((d) => d.diff >= 0)
        .sort((a, b) => a.diff - b.diff)
        .slice(0, 5),
    [ddays],
  );

  const toggle = (t: TodoRow) => {
    const updated = { ...t, is_done: !t.is_done };
    setTodos((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    saveTodo(updated);
  };

  const add = () => {
    const title = newTodo.trim();
    if (!title) return;
    const todo: TodoRow = { id: crypto.randomUUID(), title, memo: "", is_done: false, date: todayKey };
    setTodos((prev) => [...prev, todo]);
    setNewTodo("");
    saveTodo(todo);
  };

  const today = new Date();

  return (
    <div className="space-y-4" data-testid="schedule-desktop">
      <nav className="flex w-fit gap-0.5 rounded-lg border border-border bg-card p-0.5" aria-label="일정 화면">
        {(["calendar", "week", "planner"] as MainView[]).map((v) => {
          const Icon = v === "calendar" ? CalendarDays : v === "week" ? ListChecks : MapIcon;
          return (
            <button
              key={v}
              onClick={() => setMain(v)}
              aria-current={main === v ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] transition-colors",
                main === v ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {MAIN_LABEL[v]}
            </button>
          );
        })}
      </nav>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] items-start gap-4">
        <motion.div key={main} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="min-w-0 rounded-2xl border border-border bg-card p-5">
          {main === "calendar" && <CalendarTab />}
          {main === "week" && <ChecklistTab />}
          {main === "planner" && <PlannerTab />}
        </motion.div>

        <div className="space-y-4">
          {/* 오늘 할 일 */}
          <Panel
            title={`오늘 할 일 · ${today.getMonth() + 1}/${today.getDate()} (${DAY_NAMES[today.getDay()]})`}
            icon={ListChecks}
            action={todayTodos.length > 0 ? <span className="font-mono text-xs text-muted-foreground">{doneToday}/{todayTodos.length}</span> : undefined}
            bodyClassName="py-1"
          >
            <ul className="divide-y divide-border">
              {todayTodos.map((t) => (
                <li key={t.id}>
                  <button onClick={() => toggle(t)} className="flex min-h-[40px] w-full items-center gap-2.5 text-left text-[13px]">
                    <span
                      className={cn(
                        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors",
                        t.is_done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
                      )}
                    >
                      {t.is_done && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate", t.is_done && "text-muted-foreground line-through")}>{t.title}</span>
                  </button>
                </li>
              ))}
              <li>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    add();
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    placeholder={todayTodos.length ? "할 일 추가" : "오늘 할 일이 없어요 · 추가해보세요"}
                    className="min-h-[40px] min-w-0 flex-1 bg-transparent text-[13px] placeholder:text-muted-foreground focus:outline-none"
                  />
                  {newTodo.trim() && (
                    <button type="submit" className="h-8 shrink-0 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground">
                      추가
                    </button>
                  )}
                </form>
              </li>
            </ul>
          </Panel>

          {/* 이번 주 계획 */}
          <Panel
            title="이번 주 계획"
            icon={CalendarDays}
            action={<PanelLink onClick={() => setMain("week")}>{weekTotal ? `${weekDone}/${weekTotal} 완료` : "주간 계획"}</PanelLink>}
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-border">
              {week.map((w) => {
                const isToday = w.key === todayKey;
                const past = w.key < todayKey;
                return (
                  <li key={w.key} className={cn("flex items-start gap-3 px-4 py-2 text-[13px]", past && "opacity-60")}>
                    <span className={cn("w-12 shrink-0 font-mono text-xs tabular-nums", isToday ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {DAY_NAMES[w.d.getDay()]} {w.d.getMonth() + 1}/{w.d.getDate()}
                    </span>
                    <span className="min-w-0 flex-1">
                      {w.list.length === 0 ? (
                        <span className="text-muted-foreground/70">—</span>
                      ) : (
                        <span className="line-clamp-2">
                          {w.list.map((t, i) => (
                            <span key={t.id} className={cn(t.is_done && "text-muted-foreground line-through")}>
                              {i > 0 && <span className="text-muted-foreground"> · </span>}
                              {t.title}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    {w.list.length > 0 && (
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {w.done}/{w.list.length}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* 다가오는 D-day */}
          <Panel title="다가오는 D-day" icon={CalendarHeart} bodyClassName="py-1">
            {upcomingDdays.length === 0 ? (
              <EmptyState icon={CalendarHeart} title="다가오는 기념일이 없어요" description="기록 탭에서 D-day를 추가할 수 있어요" />
            ) : (
              <ul className="divide-y divide-border">
                {upcomingDdays.map((d) => {
                  const couple = /결혼|만난|기념|생일|웨딩/.test(d.title);
                  return (
                    <li key={d.id} className="flex min-h-[40px] items-center gap-2.5 text-[13px]">
                      <span className="min-w-0 flex-1 truncate">{d.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {parseDateKey(d.date).getMonth() + 1}/{parseDateKey(d.date).getDate()}
                      </span>
                      <span className={cn("w-14 shrink-0 text-right font-mono text-[13px] font-semibold", couple ? "text-love" : "text-foreground")}>
                        {ddayLabel(d.diff)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
