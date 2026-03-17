import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { categories } from "@/lib/mockData";
import { Lock, X } from "lucide-react";

interface CategoryTabsProps {
  active: string;
  onChange: (cat: string) => void;
  lockedCategories?: string[];
  unlockedCategories?: Set<string>;
  onUnlock?: (cat: string) => void;
}

const CategoryTabs = ({
  active,
  onChange,
  lockedCategories = [],
  unlockedCategories = new Set(),
  onUnlock,
}: CategoryTabsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [pinModal, setPinModal] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeEl = container.querySelector(`[data-cat="${active}"]`) as HTMLElement;
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      });
    }
  }, [active]);

  const handleCategoryClick = (cat: string) => {
    const isLocked = lockedCategories.includes(cat);
    const isUnlocked = unlockedCategories.has(cat);

    if (isLocked && !isUnlocked) {
      setPinModal(cat);
      setPinInput("");
      setPinError(false);
      return;
    }

    onChange(cat);
  };

  const handlePinSubmit = () => {
    const storedPin = localStorage.getItem("sophia-category-pin") || "100200";
    if (pinInput === storedPin) {
      if (pinModal && onUnlock) {
        onUnlock(pinModal);
      }
      if (pinModal) {
        onChange(pinModal);
      }
      setPinModal(null);
      setPinInput("");
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  const handlePinChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 6);
    setPinInput(cleaned);
    setPinError(false);
    if (cleaned.length === 6) {
      // Auto-submit when 6 digits entered
      setTimeout(() => {
        const storedPin = localStorage.getItem("sophia-category-pin") || "100200";
        if (cleaned === storedPin) {
          if (pinModal && onUnlock) {
            onUnlock(pinModal);
          }
          if (pinModal) {
            onChange(pinModal);
          }
          setPinModal(null);
          setPinInput("");
          setPinError(false);
        } else {
          setPinError(true);
          setPinInput("");
        }
      }, 100);
    }
  };

  return (
    <>
      <div className="relative border-b border-border">
        <div
          ref={containerRef}
          className="container mx-auto px-4 md:px-8 flex gap-1 overflow-x-auto scrollbar-hide"
        >
          {categories.map((cat) => {
            const isLocked = lockedCategories.includes(cat);
            const isUnlocked = unlockedCategories.has(cat);
            const showLocked = isLocked && !isUnlocked;

            return (
              <button
                key={cat}
                data-cat={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
                  active === cat
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {showLocked ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  cat
                )}
              </button>
            );
          })}
          <motion.div
            className="absolute bottom-0 h-0.5 bg-primary rounded-full"
            animate={{ left: indicatorStyle.left, width: indicatorStyle.width }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>
      </div>

      {/* PIN Modal */}
      <AnimatePresence>
        {pinModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPinModal(null)}
          >
            <motion.div
              className="bg-card border border-border rounded-2xl p-6 w-80 shadow-xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">잠금 해제</h3>
                </div>
                <button
                  onClick={() => setPinModal(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                6자리 PIN을 입력해주세요
              </p>
              <div className="flex justify-center gap-2 mb-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-mono font-bold transition-colors ${
                      pinError
                        ? "border-destructive text-destructive"
                        : i < pinInput.length
                        ? "border-primary text-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {i < pinInput.length ? "\u2022" : ""}
                  </div>
                ))}
              </div>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={pinInput}
                onChange={(e) => handlePinChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pinInput.length === 6) {
                    handlePinSubmit();
                  }
                }}
                className="sr-only"
              />
              {/* Visible input for typing */}
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                maxLength={6}
                value={pinInput}
                onChange={(e) => handlePinChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pinInput.length === 6) {
                    handlePinSubmit();
                  }
                }}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3"
                placeholder="000000"
              />
              {pinError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-destructive text-center mb-3"
                >
                  PIN이 일치하지 않습니다
                </motion.p>
              )}
              <button
                onClick={handlePinSubmit}
                disabled={pinInput.length !== 6}
                className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                확인
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CategoryTabs;
