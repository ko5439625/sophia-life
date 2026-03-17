import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Check, Trash2 } from "lucide-react";

interface Todo {
  id: string;
  title: string;
  memo: string;
  isDone: boolean;
  date: string;
}

const initialTodos: Todo[] = [
  { id: "1", title: "아침 운동 30분", memo: "", isDone: false, date: "2026-03-17" },
  { id: "2", title: "장보기 - 우유, 계란, 빵", memo: "근처 마트", isDone: true, date: "2026-03-17" },
  { id: "3", title: "블로그 글 작성", memo: "여행 후기", isDone: false, date: "2026-03-17" },
];

const ChecklistTab = () => {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [newTitle, setNewTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const filteredTodos = todos.filter((t) => t.date === selectedDate);
  const doneCount = filteredTodos.filter((t) => t.isDone).length;

  const addTodo = () => {
    if (!newTitle.trim()) return;
    setTodos([
      ...todos,
      {
        id: Date.now().toString(),
        title: newTitle.trim(),
        memo: "",
        isDone: false,
        date: selectedDate,
      },
    ]);
    setNewTitle("");
  };

  const toggleTodo = (id: string) => {
    setTodos(
      todos.map((t) => (t.id === id ? { ...t, isDone: !t.isDone } : t))
    );
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Date picker + progress */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <span className="text-sm text-muted-foreground font-mono">
          {doneCount}/{filteredTodos.length} 완료
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{
            width:
              filteredTodos.length > 0
                ? `${(doneCount / filteredTodos.length) * 100}%`
                : "0%",
          }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Add todo */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="할 일 추가..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
          className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
        />
        <button
          onClick={addTodo}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Todo list */}
      <div className="space-y-2">
        {filteredTodos.map((todo) => (
          <motion.div
            key={todo.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-card rounded-lg px-4 py-3 group"
          >
            <button
              onClick={() => toggleTodo(todo.id)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                todo.isDone
                  ? "bg-primary border-primary"
                  : "border-muted-foreground/30 hover:border-primary"
              }`}
            >
              {todo.isDone && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring" as const, stiffness: 300, damping: 20 }}
                >
                  <Check className="h-3 w-3 text-primary-foreground" />
                </motion.div>
              )}
            </button>
            <span
              className={`flex-1 text-sm transition-all duration-300 ${
                todo.isDone
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              }`}
            >
              {todo.title}
            </span>
            <button
              onClick={() => deleteTodo(todo.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
        {filteredTodos.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-10 font-mono">
            할 일이 없습니다
          </p>
        )}
      </div>
    </div>
  );
};

export default ChecklistTab;
