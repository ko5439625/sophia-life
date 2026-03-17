import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { categories } from "@/lib/mockData";

interface CategoryTabsProps {
  active: string;
  onChange: (cat: string) => void;
}

const CategoryTabs = ({ active, onChange }: CategoryTabsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

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

  return (
    <div className="relative border-b border-border">
      <div
        ref={containerRef}
        className="container mx-auto px-4 md:px-8 flex gap-1 overflow-x-auto scrollbar-hide"
      >
        {categories.map((cat) => (
          <button
            key={cat}
            data-cat={cat}
            onClick={() => onChange(cat)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
              active === cat
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
        <motion.div
          className="absolute bottom-0 h-0.5 bg-primary rounded-full"
          animate={{ left: indicatorStyle.left, width: indicatorStyle.width }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </div>
    </div>
  );
};

export default CategoryTabs;
