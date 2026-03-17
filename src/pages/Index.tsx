import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BlogHeader from "@/components/blog/BlogHeader";
import CategoryTabs from "@/components/blog/CategoryTabs";
import ArticleCard from "@/components/blog/ArticleCard";
import BlogFooter from "@/components/blog/BlogFooter";
import { mockPosts } from "@/lib/mockData";

const Index = () => {
  const [activeCategory, setActiveCategory] = useState("전체");

  const filteredPosts = useMemo(() => {
    if (activeCategory === "전체") return mockPosts;
    return mockPosts.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <BlogHeader />

      {/* Hero text area */}
      <motion.section
        className="container mx-auto px-4 md:px-8 py-12 md:py-20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold leading-tight tracking-tight mb-4">
          디자인, 삶,
          <br />
          그 사이의 공간에 대한 생각.
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-lg leading-relaxed">
          일상의 작은 순간들을 기록합니다.
        </p>
      </motion.section>

      <CategoryTabs active={activeCategory} onChange={setActiveCategory} />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <section className="container mx-auto px-4 md:px-8 py-8 pb-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post, i) => (
                <ArticleCard key={post.id} post={post} index={i} />
              ))}
            </div>
            {filteredPosts.length === 0 && (
              <p className="text-center text-muted-foreground py-20 font-mono text-sm">
                아직 작성된 글이 없습니다.
              </p>
            )}
          </section>
        </motion.div>
      </AnimatePresence>

      <BlogFooter />
    </div>
  );
};

export default Index;
