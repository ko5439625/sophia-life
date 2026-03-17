import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, Heart, MapPin, Gift, Sparkles, Trash2, Search, Loader2, Send, User, Smile, Pin } from "lucide-react";
import GalleryView from "../gallery/GalleryView";
import { searchPlaces } from "../../../services/kakaoApi";
import type { PlaceResult } from "../../../services/kakaoApi";
import { loadMemos, saveMemos } from "../../../lib/memoStore";
import type { CoupleMemo } from "../../../lib/memoStore";

interface Dday {
  id: string;
  title: string;
  emoji: string;
  date: string;
}

interface WishItem {
  id: string;
  title: string;
  category: "\uBB3C\uAC74" | "\uC7A5\uC18C" | "\uACBD\uD5D8";
  isDone: boolean;
}

const tabs = [
  { id: "dday", label: "D-day" },
  { id: "wishlist", label: "위시리스트" },
  { id: "memo", label: "속닥속닥" },
  { id: "gallery", label: "갤러리" },
];

const initialDdays: Dday[] = [
  { id: "1", title: "\uCC98\uC74C \uB9CC\uB09C \uB0A0", emoji: "\u{1F496}", date: "2024-05-15" },
  { id: "2", title: "\uACB0\uD63C\uAE30\uB150\uC77C", emoji: "\u{1F48D}", date: "2025-11-08" },
  { id: "3", title: "sophia \uC0DD\uC77C", emoji: "\u{1F382}", date: "2026-04-15" },
  { id: "4", title: "\uCCAB \uC5EC\uD589 \uAE30\uB150\uC77C", emoji: "\u2708\uFE0F", date: "2024-08-22" },
];

const initialWishes: WishItem[] = [
  { id: "1", title: "\uB2CC\uD150\uB3C4 \uC2A4\uC704\uCE58 2", category: "\uBB3C\uAC74", isDone: false },
  { id: "2", title: "\uC81C\uC8FC\uB3C4 \uC6B0\uB3C4 \uC5EC\uD589", category: "\uC7A5\uC18C", isDone: true },
  { id: "3", title: "\uD30C\uC778\uB2E4\uC774\uB2DD \uCF54\uC2A4 \uC694\uB9AC", category: "\uACBD\uD5D8", isDone: false },
  { id: "4", title: "\uCEE4\uD50C \uC2A4\uD30C", category: "\uACBD\uD5D8", isDone: false },
  { id: "5", title: "\uACF5\uAE30\uCCAD\uC815\uAE30", category: "\uBB3C\uAC74", isDone: true },
];

const categoryIcons = {
  "\uBB3C\uAC74": Gift,
  "\uC7A5\uC18C": MapPin,
  "\uACBD\uD5D8": Sparkles,
};

const CoupleView = () => {
  const [activeTab, setActiveTab] = useState("dday");
  const [ddays, setDdays] = useState<Dday[]>(initialDdays);
  const [wishes, setWishes] = useState<WishItem[]>(initialWishes);
  const [memos, setMemos] = useState<CoupleMemo[]>(() => loadMemos());
  const [newMemoText, setNewMemoText] = useState("");
  const [newMemoAuthor, setNewMemoAuthor] = useState<"sophia" | "partner">("sophia");

  // Persist memos to localStorage whenever they change
  useEffect(() => {
    saveMemos(memos);
  }, [memos]);

  const toggleMemoPin = (id: string) => {
    setMemos(memos.map((m) => (m.id === id ? { ...m, pinned: !m.pinned } : m)));
  };

  // D-day form
  const [newDdayTitle, setNewDdayTitle] = useState("");
  const [newDdayEmoji, setNewDdayEmoji] = useState("\u2764\uFE0F");
  const [newDdayDate, setNewDdayDate] = useState("");

  // Wish form
  const [newWishTitle, setNewWishTitle] = useState("");
  const [newWishCategory, setNewWishCategory] = useState<"\uBB3C\uAC74" | "\uC7A5\uC18C" | "\uACBD\uD5D8">("\uBB3C\uAC74");
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search for places
  const debouncedSearch = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setPlaceResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setPlacesLoading(true);
      try {
        const results = await searchPlaces(query);
        setPlaceResults(results);
      } catch (e) {
        console.warn("Place search failed:", e);
      }
      setPlacesLoading(false);
    }, 300);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationSearch(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDday = (dateStr: string) => {
    const target = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil(
      (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 0) return "D-Day";
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  };

  const addDday = () => {
    if (!newDdayTitle.trim() || !newDdayDate) return;
    setDdays([
      ...ddays,
      {
        id: Date.now().toString(),
        title: newDdayTitle.trim(),
        emoji: newDdayEmoji,
        date: newDdayDate,
      },
    ]);
    setNewDdayTitle("");
    setNewDdayEmoji("\u2764\uFE0F");
    setNewDdayDate("");
  };

  const deleteDday = (id: string) => {
    setDdays(ddays.filter((d) => d.id !== id));
  };

  const addWish = () => {
    if (!newWishTitle.trim()) return;
    setWishes([
      ...wishes,
      {
        id: Date.now().toString(),
        title: newWishTitle.trim(),
        category: newWishCategory,
        isDone: false,
      },
    ]);
    setNewWishTitle("");
  };

  const toggleWish = (id: string) => {
    setWishes(
      wishes.map((w) => (w.id === id ? { ...w, isDone: !w.isDone } : w))
    );
  };

  const deleteWish = (id: string) => {
    setWishes(wishes.filter((w) => w.id !== id));
  };

  const emojiOptions = ["\u2764\uFE0F", "\u{1F496}", "\u{1F48D}", "\u{1F382}", "\u2708\uFE0F", "\u{1F3E0}", "\u{1F31F}", "\u{1F389}", "\u{1F37D}\uFE0F", "\u{1F3B5}"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Heart className="h-5 w-5 text-pink-400" />
        <h2 className="text-xl sm:text-2xl font-bold">부부 공간</h2>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 relative px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors min-w-[60px] flex-shrink-0 ${
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="couple-tab"
                className="absolute inset-0 bg-card rounded-md shadow-sm"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === "dday" && (
            <div className="space-y-4">
              {/* Add D-day form */}
              <div className="bg-card rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-mono text-muted-foreground">
                  새 D-day 추가
                </h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="기념일 이름"
                    value={newDdayTitle}
                    onChange={(e) => setNewDdayTitle(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                  />
                  <input
                    type="date"
                    value={newDdayDate}
                    onChange={(e) => setNewDdayDate(e.target.value)}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-auto"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    이모지:
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {emojiOptions.map((e) => (
                      <button
                        key={e}
                        onClick={() => setNewDdayEmoji(e)}
                        className={`text-lg p-1 rounded transition-all ${
                          newDdayEmoji === e
                            ? "bg-primary/15 ring-1 ring-primary/30"
                            : "hover:bg-muted"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={addDday}
                  className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" /> 추가
                </button>
              </div>

              {/* D-day list */}
              <div className="space-y-2">
                {ddays
                  .sort(
                    (a, b) =>
                      new Date(a.date).getTime() - new Date(b.date).getTime()
                  )
                  .map((dday) => (
                    <motion.div
                      key={dday.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-card rounded-xl px-5 py-4 flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{dday.emoji}</span>
                        <div>
                          <p className="text-sm font-medium">{dday.title}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {dday.date}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-sm font-mono font-bold ${
                            getDday(dday.date) === "D-Day"
                              ? "text-pink-400"
                              : getDday(dday.date).startsWith("D+")
                              ? "text-muted-foreground"
                              : "text-primary"
                          }`}
                        >
                          {getDday(dday.date)}
                        </span>
                        <button
                          onClick={() => deleteDday(dday.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === "gallery" && (
            <GalleryView />
          )}

          {activeTab === "memo" && (
            <div className="space-y-4">
              {/* Add memo form */}
              <div className="bg-card rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">작성자:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setNewMemoAuthor("sophia")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        newMemoAuthor === "sophia"
                          ? "bg-pink-500/15 text-pink-400 ring-1 ring-pink-400/30"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Smile className="h-3 w-3" />
                      sophia
                    </button>
                    <button
                      onClick={() => setNewMemoAuthor("partner")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        newMemoAuthor === "partner"
                          ? "bg-blue-500/15 text-blue-400 ring-1 ring-blue-400/30"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <User className="h-3 w-3" />
                      partner
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="메모를 남겨보세요..."
                    value={newMemoText}
                    onChange={(e) => setNewMemoText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newMemoText.trim()) {
                        setMemos([
                          {
                            id: Date.now().toString(),
                            author: newMemoAuthor,
                            message: newMemoText.trim(),
                            timestamp: new Date().toLocaleString("ko-KR", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }),
                            pinned: false,
                          },
                          ...memos,
                        ]);
                        setNewMemoText("");
                      }
                    }}
                    className="flex-1 bg-background border border-border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => {
                      if (!newMemoText.trim()) return;
                      setMemos([
                        {
                          id: Date.now().toString(),
                          author: newMemoAuthor,
                          message: newMemoText.trim(),
                          timestamp: new Date().toLocaleString("ko-KR", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          }),
                          pinned: false,
                        },
                        ...memos,
                      ]);
                      setNewMemoText("");
                    }}
                    className="bg-primary text-primary-foreground rounded-full p-2.5 hover:opacity-90 transition-opacity"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Memo timeline */}
              <div className="space-y-3">
                {memos.map((memo) => {
                  const isSophia = memo.author === "sophia";
                  return (
                    <motion.div
                      key={memo.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isSophia ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm relative ${
                          isSophia
                            ? "bg-pink-500/10 border border-pink-500/20 rounded-br-md"
                            : "bg-blue-500/10 border border-blue-500/20 rounded-bl-md"
                        }`}
                        style={{ transform: `rotate(${isSophia ? "0.3" : "-0.3"}deg)` }}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          {isSophia ? (
                            <Smile className="h-3 w-3 text-pink-400" />
                          ) : (
                            <User className="h-3 w-3 text-blue-400" />
                          )}
                          <span
                            className={`text-[10px] font-medium ${
                              isSophia ? "text-pink-400" : "text-blue-400"
                            }`}
                          >
                            {memo.author}
                          </span>
                        </div>
                        <p className="text-sm">{memo.message}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <button
                            onClick={() => toggleMemoPin(memo.id)}
                            className={`flex items-center gap-1 text-[10px] font-medium transition-colors rounded-full px-1.5 py-0.5 ${
                              memo.pinned
                                ? "text-amber-500 bg-amber-500/10"
                                : "text-muted-foreground/50 hover:text-muted-foreground"
                            }`}
                            title={memo.pinned ? "공지 해제" : "공지 등록"}
                          >
                            <Pin className="h-2.5 w-2.5" />
                            {memo.pinned ? "공지 중" : "공지 등록"}
                          </button>
                          <p className="text-[10px] text-muted-foreground/60 font-mono">
                            {memo.timestamp}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {memos.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-10 font-mono">
                    아직 메모가 없습니다
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "wishlist" && (
            <div className="space-y-4">
              {/* Add wish form */}
              <div className="bg-card rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-mono text-muted-foreground">
                  새 위시 추가
                </h3>
                <div className="relative" ref={locationRef}>
                  <div className="relative">
                    {newWishCategory === "\uC7A5\uC18C" && (
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <input
                      type="text"
                      placeholder={
                        newWishCategory === "\uC7A5\uC18C"
                          ? "장소 검색..."
                          : "위시리스트 항목"
                      }
                      value={newWishTitle}
                      onChange={(e) => {
                        setNewWishTitle(e.target.value);
                        if (newWishCategory === "\uC7A5\uC18C") {
                          setLocationQuery(e.target.value);
                          setShowLocationSearch(true);
                          debouncedSearch(e.target.value);
                        }
                      }}
                      onFocus={() => {
                        if (newWishCategory === "\uC7A5\uC18C") {
                          setShowLocationSearch(true);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setShowLocationSearch(false);
                          addWish();
                        }
                      }}
                      className={`w-full bg-background border border-border rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground ${
                        newWishCategory === "\uC7A5\uC18C" ? "pl-9 pr-3" : "px-3"
                      }`}
                    />
                  </div>
                  {/* Location search dropdown */}
                  <AnimatePresence>
                    {newWishCategory === "\uC7A5\uC18C" &&
                      showLocationSearch && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
                        >
                          {placesLoading ? (
                            <div className="flex items-center justify-center py-3">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                              <span className="text-xs text-muted-foreground ml-2">검색 중...</span>
                            </div>
                          ) : placeResults.length > 0 ? (
                            placeResults.map((place, idx) => (
                              <button
                                key={`${place.placeName}-${idx}`}
                                onClick={() => {
                                  setNewWishTitle(place.placeName);
                                  setShowLocationSearch(false);
                                }}
                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                              >
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="truncate">{place.placeName}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{place.address}</p>
                                </div>
                              </button>
                            ))
                          ) : locationQuery.trim() ? (
                            <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                              검색 결과가 없습니다
                            </div>
                          ) : null}
                          <div className="px-3 py-2 border-t border-border">
                            <p className="text-[10px] text-muted-foreground">
                              카카오 Places API 연동
                            </p>
                          </div>
                        </motion.div>
                      )}
                  </AnimatePresence>
                </div>
                <div className="flex gap-2">
                  {(
                    ["\uBB3C\uAC74", "\uC7A5\uC18C", "\uACBD\uD5D8"] as const
                  ).map((cat) => {
                    const Icon = categoryIcons[cat];
                    return (
                      <button
                        key={cat}
                        onClick={() => setNewWishCategory(cat)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                          newWishCategory === cat
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {cat}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={addWish}
                  className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" /> 추가
                </button>
              </div>

              {/* Wishlist items */}
              <div className="space-y-2">
                {wishes.map((wish) => {
                  const Icon = categoryIcons[wish.category];
                  return (
                    <motion.div
                      key={wish.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card rounded-xl px-5 py-3.5 flex items-center gap-3 group"
                    >
                      <button
                        onClick={() => toggleWish(wish.id)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                          wish.isDone
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/30 hover:border-primary"
                        }`}
                      >
                        {wish.isDone && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: "spring" as const,
                              stiffness: 300,
                              damping: 20,
                            }}
                          >
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </motion.div>
                        )}
                      </button>
                      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span
                        className={`flex-1 text-sm transition-all ${
                          wish.isDone
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {wish.title}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {wish.category}
                      </span>
                      <button
                        onClick={() => deleteWish(wish.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default CoupleView;
