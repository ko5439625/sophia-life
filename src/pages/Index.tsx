import { useState, useMemo, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BlogHeader from "@/components/blog/BlogHeader";
import CategoryTabs from "@/components/blog/CategoryTabs";
import ArticleCard from "@/components/blog/ArticleCard";
import BlogFooter from "@/components/blog/BlogFooter";
import { BlogPost } from "@/lib/mockData";
import { loadPosts, loadBlogSettings, saveBlogSettings, getPostLikeCounts } from "@/services/supabaseSync";

function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function extractImagesFromHtml(html: string): string[] {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const imgs = tmp.querySelectorAll("img");
  return Array.from(imgs).map((img) => img.src).filter((src) => src && !src.startsWith("blob:"));
}

// Default locked categories - can be managed from settings
const DEFAULT_LOCKED_CATEGORIES = ["감성"];

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 이전에 PIN 인증한 기기면 바로 대시보드로 (blog 모드가 아닐 때만)
  useEffect(() => {
    const blogMode = searchParams.get("blog") === "true";
    if (!blogMode && localStorage.getItem("sophia-device-auth") === "true") {
      sessionStorage.setItem("sophia-auth", "true");
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, searchParams]);
  const [activeCategory, setActiveCategory] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [unlockedCategories, setUnlockedCategories] = useState<Set<string>>(new Set());
  const [allPosts, setAllPosts] = useState<BlogPost[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [lockedCategories, setLockedCategories] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("sophia-locked-categories");
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return DEFAULT_LOCKED_CATEGORIES;
  });
  const [subtitle, setSubtitle] = useState(
    () => localStorage.getItem("sophia-blog-subtitle") || "소피아코의 일상"
  );

  // Load posts from Supabase, merge with mock
  useEffect(() => {
    loadPosts().then((rows) => {
      if (rows.length > 0) {
        const dbPosts: BlogPost[] = rows.map((r) => ({
          id: r.id,
          title: r.title,
          excerpt: stripHtml(r.content).slice(0, 100),
          content: r.content,
          category: r.category,
          images: (r.images && r.images.length > 0) ? r.images : extractImagesFromHtml(r.content),
          tags: r.tags || [],
          date: r.created_at?.slice(0, 10) || "",
          isPublic: r.is_public,
        }));
        setAllPosts(dbPosts);
        // Fetch like counts for all posts
        const ids = dbPosts.map((p) => p.id);
        getPostLikeCounts(ids).then(setLikeCounts);
      }
    });
    // Sync blog settings: DB → local (pull), or local → DB (push if DB empty)
    loadBlogSettings().then((settings) => {
      if (settings.lockedCategories) {
        setLockedCategories(settings.lockedCategories);
        localStorage.setItem("sophia-locked-categories", JSON.stringify(settings.lockedCategories));
      }
      if (settings.blogSubtitle) {
        setSubtitle(settings.blogSubtitle);
        localStorage.setItem("sophia-blog-subtitle", settings.blogSubtitle);
      } else {
        // DB empty but local has value → push to DB
        const localSubtitle = localStorage.getItem("sophia-blog-subtitle");
        if (localSubtitle) {
          saveBlogSettings({ blog_subtitle: localSubtitle });
        }
      }
    });
  }, []);

  const handleTagClick = useCallback((tag: string) => {
    setActiveTag((prev) => (prev === tag ? null : tag));
    setActiveCategory("전체");
  }, []);

  const handleUnlock = useCallback((cat: string) => {
    setUnlockedCategories((prev) => new Set(prev).add(cat));
  }, []);

  const filteredPosts = useMemo(() => {
    let posts = allPosts;

    // Hide posts from locked categories that haven't been unlocked
    posts = posts.filter((p) => {
      const isLocked = lockedCategories.includes(p.category);
      const isUnlocked = unlockedCategories.has(p.category);
      return !isLocked || isUnlocked;
    });

    if (activeCategory !== "전체") {
      posts = posts.filter((p) => p.category === activeCategory);
    }

    if (activeTag) {
      posts = posts.filter((p) => p.tags.includes(activeTag));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      posts = posts.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return posts;
  }, [activeCategory, searchQuery, activeTag, lockedCategories, unlockedCategories, allPosts]);

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <BlogHeader />

      {/* Subtitle - centered under logo */}
      <motion.section
        className="container mx-auto px-4 md:px-8 pb-6 md:pb-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.5 }}
      >
        <p className="text-center text-xs md:text-sm text-muted-foreground font-light tracking-[0.2em] uppercase">
          {subtitle}
        </p>
      </motion.section>

      <CategoryTabs
        active={activeCategory}
        onChange={(cat) => { setActiveCategory(cat); setActiveTag(null); }}
        lockedCategories={lockedCategories}
        unlockedCategories={unlockedCategories}
        onUnlock={handleUnlock}
      />

      {/* Search bar - below category tabs, minimal */}
      <motion.section
        className="container mx-auto px-4 md:px-8 py-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.6 }}
      >
        <div className="relative max-w-sm mx-auto">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="검색..."
            className="w-full pl-7 pr-8 py-2 text-sm bg-transparent border-b border-border/50 outline-none focus:border-foreground/30 transition-colors placeholder:text-muted-foreground/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {activeTag && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <button
              onClick={() => setActiveTag(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-foreground/10 text-foreground rounded-full hover:bg-foreground/20 transition-colors"
            >
              #{activeTag}
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </motion.section>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeCategory}-${searchQuery}-${activeTag}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <section className="container mx-auto px-4 md:px-8 py-4 pb-12">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {filteredPosts.map((post, i) => (
                <ArticleCard key={post.id} post={post} index={i} onTagClick={handleTagClick} activeTag={activeTag} likeCount={likeCounts[post.id] ?? 0} />
              ))}
            </div>
            {filteredPosts.length === 0 && (
              <p className="text-center text-muted-foreground py-20 text-sm">
                {searchQuery || activeTag ? "검색 결과가 없습니다." : "아직 작성된 글이 없습니다."}
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
