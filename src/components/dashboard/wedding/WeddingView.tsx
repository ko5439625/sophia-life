import { useState, useEffect, useMemo, useRef } from "react";
import {
  Heart,
  Plus,
  Check,
  Trash2,
  MessageSquare,
  X,
  ChevronDown,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  loadWeddingItems,
  saveWeddingItem,
  deleteWeddingItem,
} from "../../../services/supabaseSync";
import type { WeddingItemRow } from "../../../services/supabaseSync";

// ---------------------------------------------------------------------------
// Default categories (대분류 > 소분류)
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORIES: Record<string, string[]> = {
  "웨딩홀": ["장소", "식대", "대관", "기타"],
  "스드메": ["스튜디오", "드레스", "메이크업", "기타"],
  "예물/예단": ["반지", "시계", "목걸이", "예단", "기타"],
  "혼수": ["가전", "가구", "침구", "생활용품", "기타"],
  "혼주": ["한복/양복", "메이크업", "상견례", "함/폐백", "이바지", "기타"],
  "예약": ["사회자", "축가", "영상촬영", "스냅촬영", "웨딩카", "기타"],
  "허니문": ["항공", "숙소", "보험", "기타"],
  "청첩장/답례품": ["청첩장", "답례품", "부케", "기타"],
  "기타": ["기타"],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(n: number) {
  if (n === 0) return "-";
  if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}만`;
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface WeddingViewProps {
  initialTab?: string | null;
  onTabUsed?: () => void;
}

export default function WeddingView({ initialTab, onTabUsed }: WeddingViewProps) {
  const [items, setItems] = useState<WeddingItemRow[]>([]);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterDone, setFilterDone] = useState<"all" | "done" | "todo">("all");
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [commentOpenId, setCommentOpenId] = useState<string | null>(null);
  const [showAddRow, setShowAddRow] = useState(false);

  // New row state
  const [newCat, setNewCat] = useState(Object.keys(DEFAULT_CATEGORIES)[0]);
  const [newSub, setNewSub] = useState("");
  const [newCustomSub, setNewCustomSub] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [newMemo, setNewMemo] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialTab) onTabUsed?.();
  }, [initialTab]);

  // Load
  useEffect(() => {
    loadWeddingItems().then((rows) => {
      if (rows.length > 0) setItems(rows);
      else {
        // Load from localStorage fallback
        try {
          const stored = localStorage.getItem("sophia-wedding-ledger");
          if (stored) setItems(JSON.parse(stored));
        } catch { /* ignore */ }
      }
    });
  }, []);

  // Persist
  useEffect(() => {
    localStorage.setItem("sophia-wedding-ledger", JSON.stringify(items));
  }, [items]);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  // All categories used (merge default + custom)
  const allCategories = useMemo(() => {
    const cats = new Set(Object.keys(DEFAULT_CATEGORIES));
    items.forEach((i) => cats.add(i.category));
    return Array.from(cats);
  }, [items]);

  // Sub-categories for a given category
  const getSubCategories = (cat: string) => {
    const defaults = DEFAULT_CATEGORIES[cat] || [];
    const custom = items.filter((i) => i.category === cat).map((i) => i.sub_category);
    const all = new Set([...defaults, ...custom]);
    return Array.from(all).filter(Boolean);
  };

  // Filtered & grouped items
  const filteredItems = useMemo(() => {
    let result = items;
    if (filterCategory) result = result.filter((i) => i.category === filterCategory);
    if (filterDone === "done") result = result.filter((i) => i.is_done);
    if (filterDone === "todo") result = result.filter((i) => !i.is_done);
    return result;
  }, [items, filterCategory, filterDone]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, WeddingItemRow[]>();
    for (const item of filteredItems) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [filteredItems]);

  // Stats
  const totalBudget = items.reduce((s, i) => s + i.budget, 0);
  const doneBudget = items.filter((i) => i.is_done).reduce((s, i) => s + i.budget, 0);
  const totalCount = items.length;
  const doneCount = items.filter((i) => i.is_done).length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Budget by category for dashboard
  const budgetByCategory = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((i) => {
      map.set(i.category, (map.get(i.category) || 0) + i.budget);
    });
    return Array.from(map.entries())
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [items]);

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  const addRow = async () => {
    if (!newTitle.trim()) return;
    const resolvedSub = newSub === "__custom__" ? newCustomSub.trim() : (newSub || (DEFAULT_CATEGORIES[newCat]?.[0] ?? ""));
    if (newSub === "__custom__" && !resolvedSub) return;
    const item: WeddingItemRow = {
      id: crypto.randomUUID(),
      category: newCat,
      sub_category: resolvedSub,
      title: newTitle.trim(),
      is_done: false,
      memo: newMemo.trim(),
      budget: Number(newBudget) || 0,
      sort_order: items.filter((i) => i.category === newCat).length,
    };
    setItems((prev) => [...prev, item]);
    await saveWeddingItem(item);
    setNewTitle("");
    setNewBudget("");
    setNewMemo("");
    // Keep category & sub for batch adding (reset custom if used)
    if (newSub === "__custom__") { setNewSub(""); setNewCustomSub(""); }
    setTimeout(() => titleInputRef.current?.focus(), 50);
  };

  const toggleDone = async (id: string) => {
    const updated = items.map((i) => (i.id === id ? { ...i, is_done: !i.is_done } : i));
    setItems(updated);
    const item = updated.find((i) => i.id === id);
    if (item) await saveWeddingItem(item);
  };

  const removeRow = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await deleteWeddingItem(id);
  };

  const updateMemo = async (id: string, memo: string) => {
    const updated = items.map((i) => (i.id === id ? { ...i, memo } : i));
    setItems(updated);
    const item = updated.find((i) => i.id === id);
    if (item) await saveWeddingItem(item);
  };

  const updateBudget = async (id: string, budget: number) => {
    const updated = items.map((i) => (i.id === id ? { ...i, budget } : i));
    setItems(updated);
    const item = updated.find((i) => i.id === id);
    if (item) await saveWeddingItem(item);
  };

  const toggleCollapse = (cat: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Heart className="h-5 w-5 text-pink-400" />
        <h2 className="text-xl sm:text-2xl font-bold">웨딩 준비</h2>
      </div>

      {/* Dashboard summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-[10px] text-muted-foreground/60 font-mono">진행률</p>
          <p className="text-lg font-bold font-mono mt-1">{progressPct}%</p>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
            <div className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground/50 font-mono mt-1">{doneCount}/{totalCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-[10px] text-muted-foreground/60 font-mono">총 예산</p>
          <p className="text-lg font-bold font-mono mt-1">{totalBudget > 0 ? `${formatAmount(totalBudget)}원` : "-"}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-[10px] text-muted-foreground/60 font-mono">완료 금액</p>
          <p className="text-lg font-bold font-mono mt-1 text-emerald-400">{doneBudget > 0 ? `${formatAmount(doneBudget)}원` : "-"}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-[10px] text-muted-foreground/60 font-mono">남은 금액</p>
          <p className="text-lg font-bold font-mono mt-1 text-amber-400">{totalBudget - doneBudget > 0 ? `${formatAmount(totalBudget - doneBudget)}원` : "-"}</p>
        </div>
      </div>

      {/* Budget by category */}
      {budgetByCategory.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium mb-2">카테고리별 예산</p>
          <div className="space-y-1.5">
            {budgetByCategory.map(([cat, amount]) => {
              const pct = totalBudget > 0 ? Math.round((amount / totalBudget) * 100) : 0;
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24 truncate">{cat}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground w-16 text-right">{formatAmount(amount)}원</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground/50" />
        </div>
        <button
          onClick={() => setFilterCategory(null)}
          className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${!filterCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
        >
          전체
        </button>
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
            className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${filterCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            {cat}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          {(["all", "todo", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterDone(f)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${filterDone === f ? "bg-foreground/10 text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"}`}
            >
              {f === "all" ? "전체" : f === "todo" ? "미완료" : "완료"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[28px_1fr_80px_80px_36px_36px] sm:grid-cols-[28px_100px_100px_1fr_100px_36px_36px] gap-0 border-b border-border bg-muted/50 text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">
          <div className="p-2 flex items-center justify-center">
            <Check className="h-3 w-3" />
          </div>
          <div className="p-2 hidden sm:block">대분류</div>
          <div className="p-2 hidden sm:block">소분류</div>
          <div className="p-2">항목</div>
          <div className="p-2 text-right">금액</div>
          <div className="p-2" />
          <div className="p-2" />
        </div>

        {/* Grouped rows */}
        {Array.from(groupedByCategory.entries()).map(([cat, catItems]) => {
          const isCollapsed = collapsedCats.has(cat);
          const catBudget = catItems.reduce((s, i) => s + i.budget, 0);
          const catDone = catItems.filter((i) => i.is_done).length;

          return (
            <div key={cat}>
              {/* Category group header */}
              <button
                onClick={() => toggleCollapse(cat)}
                className="w-full grid grid-cols-[28px_1fr_80px_80px_36px_36px] sm:grid-cols-[28px_100px_100px_1fr_100px_36px_36px] gap-0 bg-muted/30 hover:bg-muted/50 border-b border-border/50 transition-colors"
              >
                <div className="p-2 flex items-center justify-center">
                  {isCollapsed ? <ChevronRight className="h-3 w-3 text-muted-foreground/50" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/50" />}
                </div>
                <div className="p-2 col-span-3 sm:col-span-4 text-left">
                  <span className="text-xs font-medium">{cat}</span>
                  <span className="text-[10px] text-muted-foreground/50 ml-2 font-mono">{catDone}/{catItems.length}</span>
                </div>
                <div className="p-2 text-right text-[11px] font-mono text-muted-foreground">
                  {catBudget > 0 ? `${formatAmount(catBudget)}원` : ""}
                </div>
                <div className="p-2" />
              </button>

              {/* Items */}
              {!isCollapsed && catItems.map((item) => (
                <div key={item.id}>
                  <div className={`grid grid-cols-[28px_1fr_80px_80px_36px_36px] sm:grid-cols-[28px_100px_100px_1fr_100px_36px_36px] gap-0 border-b border-border/30 hover:bg-muted/20 transition-colors group ${item.is_done ? "opacity-50" : ""}`}>
                    {/* Checkbox */}
                    <div className="p-2 flex items-center justify-center">
                      <button
                        onClick={() => toggleDone(item.id)}
                        className={`w-4 h-4 rounded border transition-colors flex-shrink-0 ${item.is_done ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-primary"}`}
                      >
                        {item.is_done && <Check className="h-4 w-4 text-primary-foreground" />}
                      </button>
                    </div>

                    {/* Category (desktop) */}
                    <div className="p-2 hidden sm:flex items-center">
                      <span className="text-[11px] text-muted-foreground/60 truncate">{item.category}</span>
                    </div>

                    {/* Sub-category (desktop) */}
                    <div className="p-2 hidden sm:flex items-center">
                      <span className="text-[11px] text-muted-foreground/60 truncate">{item.sub_category}</span>
                    </div>

                    {/* Title */}
                    <div className="p-2 flex items-center min-w-0">
                      <div className="min-w-0">
                        <p className={`text-sm truncate ${item.is_done ? "line-through" : ""}`}>{item.title}</p>
                        {/* Mobile: show sub_category */}
                        <p className="text-[10px] text-muted-foreground/40 sm:hidden">{item.sub_category}</p>
                        {/* Memo preview */}
                        {item.memo && commentOpenId !== item.id && (
                          <p className="text-[10px] text-muted-foreground/40 truncate max-w-[200px]">{item.memo}</p>
                        )}
                      </div>
                    </div>

                    {/* Budget */}
                    <div className="p-2 flex items-center justify-end">
                      <input
                        type="number"
                        value={item.budget || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, budget: val } : i)));
                        }}
                        onBlur={() => updateBudget(item.id, item.budget)}
                        placeholder="-"
                        className="w-full text-right text-[11px] font-mono bg-transparent border-0 outline-none focus:bg-muted/50 rounded px-1 py-0.5"
                      />
                    </div>

                    {/* Comment toggle */}
                    <div className="p-2 flex items-center justify-center">
                      <button
                        onClick={() => setCommentOpenId(commentOpenId === item.id ? null : item.id)}
                        className={`p-0.5 rounded transition-colors ${item.memo ? "text-blue-400" : "text-muted-foreground/30 hover:text-muted-foreground/60 opacity-0 group-hover:opacity-100"}`}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Delete */}
                    <div className="p-2 flex items-center justify-center">
                      <button
                        onClick={() => removeRow(item.id)}
                        className="p-0.5 text-muted-foreground/30 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Comment row */}
                  {commentOpenId === item.id && (
                    <div className="border-b border-border/30 bg-muted/10 px-4 py-2">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-blue-400/60 mt-1 flex-shrink-0" />
                        <textarea
                          value={item.memo}
                          onChange={(e) => setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, memo: e.target.value } : i)))}
                          onBlur={() => updateMemo(item.id, item.memo)}
                          placeholder="코멘트를 남겨주세요..."
                          rows={2}
                          className="flex-1 bg-transparent border border-border/50 rounded-md px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <button
                          onClick={() => setCommentOpenId(null)}
                          className="p-0.5 text-muted-foreground/40 hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {/* Empty state */}
        {filteredItems.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground/50">
              {filterCategory || filterDone !== "all" ? "조건에 맞는 항목이 없어요" : "아래 + 버튼으로 항목을 추가해보세요"}
            </p>
          </div>
        )}

        {/* Add row */}
        {showAddRow ? (
          <div className="border-t border-border bg-primary/5 p-3 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground/60 block mb-0.5">대분류</label>
                <select
                  value={newCat}
                  onChange={(e) => {
                    setNewCat(e.target.value);
                    setNewSub(DEFAULT_CATEGORIES[e.target.value]?.[0] ?? "");
                  }}
                  className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs"
                >
                  {Object.keys(DEFAULT_CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground/60 block mb-0.5">소분류</label>
                <select
                  value={newSub}
                  onChange={(e) => { setNewSub(e.target.value); if (e.target.value !== "__custom__") setNewCustomSub(""); }}
                  className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs"
                >
                  {getSubCategories(newCat).map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                  <option value="__custom__">+ 직접 입력</option>
                </select>
                {newSub === "__custom__" && (
                  <input
                    value={newCustomSub}
                    onChange={(e) => setNewCustomSub(e.target.value)}
                    placeholder="새 소분류명"
                    autoFocus
                    className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs mt-1 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                )}
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground/60 block mb-0.5">항목명</label>
                <input
                  ref={titleInputRef}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addRow(); }}
                  placeholder="예: 드레스 대여"
                  autoFocus
                  className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground/60 block mb-0.5">금액 (만원)</label>
                <input
                  type="number"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addRow(); }}
                  placeholder="0"
                  className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground/60 block mb-0.5">코멘트 (선택)</label>
              <input
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addRow(); }}
                placeholder="메모..."
                className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div className="flex justify-end gap-1.5">
              <button onClick={() => { setShowAddRow(false); setNewTitle(""); setNewBudget(""); setNewMemo(""); }} className="text-xs text-muted-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors">
                닫기
              </button>
              <button onClick={addRow} disabled={!newTitle.trim()} className="text-xs text-primary-foreground bg-primary px-3 py-1.5 rounded-md disabled:opacity-40 hover:bg-primary/90 transition-colors">
                추가
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddRow(true)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground py-3 border-t border-border hover:bg-muted/30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            항목 추가
          </button>
        )}
      </div>
    </div>
  );
}
