import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BlogHeader from "@/components/blog/BlogHeader";
import CategoryTabs from "@/components/blog/CategoryTabs";
import HeroSection from "@/components/blog/HeroSection";
import ArticleCard from "@/components/blog/ArticleCard";
import BlogFooter from "@/components/blog/BlogFooter";
import { mockPosts } from "@/lib/mockData";

const Index = () => {
  const [activeCategory, setActiveCategory] = useState("전체");

  const filteredPosts = useMemo(() => {
    if (activeCategory === "전체") return mockPosts;
    return mockPosts.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const heroPost = filteredPosts[0];
  const gridPosts = filteredPosts.slice(1);

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <BlogHeader />
      <CategoryTabs active={activeCategory} onChange={setActiveCategory} />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {heroPost && <HeroSection post={heroPost} />}

          {gridPosts.length > 0 && (
            <section className="container mx-auto px-4 md:px-8 pb-12">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {gridPosts.map((post, i) => (
                  <ArticleCard key={post.id} post={post} index={i} />
                ))}
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      <BlogFooter />
    </div>
  );
};

export default Index;
