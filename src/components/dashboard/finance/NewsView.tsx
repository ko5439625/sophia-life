import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper,
  Globe,
  ExternalLink,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  X,
} from "lucide-react";
import { getNews } from "../../../services/newsApi";
import { translateText, summarizeNews } from "../../../services/geminiApi";
import type { NewsArticle } from "../../../services/newsApi";
import type { NewsSummary } from "../../../services/geminiApi";

interface NewsItem {
  id: string;
  title: string;
  source: string;
  date: string;
  publishedAt: string;
  category: "경제" | "사회" | "미국" | "암호화폐";
  summary: string;
  url: string;
  isEnglish: boolean;
  translatedText?: string;
}

const ITEMS_PER_PAGE = 10;
const DAYS_WINDOW = 7;

const categoryTabs = [
  { id: "all", label: "전체" },
  { id: "경제", label: "경제" },
  { id: "사회", label: "사회" },
  { id: "미국", label: "미국" },
  { id: "암호화폐", label: "암호화폐" },
];

const categoryColors: Record<string, string> = {
  경제: "bg-blue-500/15 text-blue-400",
  사회: "bg-green-500/15 text-green-400",
  미국: "bg-purple-500/15 text-purple-400",
  암호화폐: "bg-orange-500/15 text-orange-400",
};

/** Return start-of-day Date for `daysAgo` days before now */
function daysAgoDate(daysAgo: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

const NewsView = () => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  /** How many 7-day windows to include (1 = last 7 days, 2 = last 14 days, ...) */
  const [windowCount, setWindowCount] = useState(1);
  const [aiSummary, setAiSummary] = useState<NewsSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllNews = async () => {
      setLoading(true);
      try {
        const [krBiz, krGeneral, usNews, cryptoNews] = await Promise.all([
          getNews("business", "kr"),
          getNews("general", "kr"),
          getNews("business", "us"),
          getNews("crypto", "kr"),
        ]);

        const mapArticle = (
          article: NewsArticle,
          idx: number,
          cat: "경제" | "사회" | "미국" | "암호화폐",
        ): NewsItem => ({
          id: `${cat}-${idx}`,
          title: article.title,
          source: article.source,
          date: article.publishedAt.split("T")[0],
          publishedAt: article.publishedAt,
          category: cat,
          summary: article.description,
          url: article.url,
          isEnglish: article.isEnglish,
        });

        const items: NewsItem[] = [
          ...krBiz.map((a, i) => mapArticle(a, i, "경제")),
          ...krGeneral.map((a, i) => mapArticle(a, i, "사회")),
          ...usNews.map((a, i) => mapArticle(a, i, "미국")),
          ...cryptoNews.map((a, i) => mapArticle(a, i, "암호화폐")),
        ];

        // Sort by publishedAt descending
        items.sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
        );

        setNewsData(items);
      } catch (e) {
        console.warn("News fetch error:", e);
      }
      setLoading(false);
    };

    fetchAllNews();
  }, []);

  const handleTranslate = useCallback(
    async (item: NewsItem) => {
      if (item.translatedText || translatingIds.has(item.id)) return;
      setTranslatingIds((prev) => new Set(prev).add(item.id));
      try {
        const combined = item.title + ". " + item.summary;
        const translatedText = await translateText(combined, "en", "ko");
        setNewsData((prev) =>
          prev.map((n) =>
            n.id === item.id ? { ...n, translatedText } : n,
          ),
        );
      } catch (e) {
        console.warn("Translation failed:", e);
      }
      setTranslatingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    },
    [translatingIds],
  );

  // 7-day window filter
  const cutoffDate = useMemo(
    () => daysAgoDate(DAYS_WINDOW * windowCount),
    [windowCount],
  );

  const filteredNews = useMemo(() => {
    let list = newsData.filter(
      (n) => new Date(n.publishedAt).getTime() >= cutoffDate.getTime(),
    );
    if (activeCategory !== "all") {
      list = list.filter((n) => n.category === activeCategory);
    }
    return list;
  }, [newsData, activeCategory, cutoffDate]);

  // Check if there are older items beyond the current window
  const hasOlderNews = useMemo(() => {
    const allCatFiltered =
      activeCategory === "all"
        ? newsData
        : newsData.filter((n) => n.category === activeCategory);
    return allCatFiltered.some(
      (n) => new Date(n.publishedAt).getTime() < cutoffDate.getTime(),
    );
  }, [newsData, activeCategory, cutoffDate]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredNews.length / ITEMS_PER_PAGE));
  const paginatedNews = useMemo(
    () =>
      filteredNews.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE,
      ),
    [filteredNews, page],
  );

  // Reset page when category or window changes
  useEffect(() => {
    setPage(1);
  }, [activeCategory, windowCount]);

  const handleOpenArticle = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleLoadOlder = () => {
    setWindowCount((prev) => prev + 1);
  };

  const handleAiAnalyze = async () => {
    if (aiLoading || newsData.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const articles = newsData.slice(0, 60).map((n) => ({
        title: n.title,
        category: n.category,
        source: n.source,
      }));
      const result = await summarizeNews(articles);
      setAiSummary(result);
    } catch (e) {
      console.warn("AI summary failed:", e);
      const errMsg = e instanceof Error ? e.message : String(e);
      setAiError(`AI 요약에 실패했어요: ${errMsg}`);
    }
    setAiLoading(false);
  };

  return (
    <div className="space-y-5">
      {/* Category tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 overflow-x-auto">
        {categoryTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`flex-1 relative px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors min-w-[52px] flex-shrink-0 ${
              activeCategory === tab.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {activeCategory === tab.id && (
              <motion.div
                layoutId="news-category-tab"
                className="absolute inset-0 bg-card rounded-md shadow-sm"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* News count & AI analyze button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono">
            {filteredNews.length}건의 뉴스
            <span className="ml-1 text-muted-foreground/60">
              (최근 {DAYS_WINDOW * windowCount}일)
            </span>
          </span>
        </div>
        {!loading && newsData.length > 0 && (
          <button
            onClick={handleAiAnalyze}
            disabled={aiLoading}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {aiLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                AI 분석
              </>
            )}
          </button>
        )}
      </div>

      {/* AI Summary Card */}
      {aiError && (
        <div className="bg-destructive/10 text-destructive text-xs rounded-xl p-3">
          {aiError}
        </div>
      )}
      {aiSummary && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary">오늘의 뉴스 AI 브리핑</span>
            </div>
            <button
              onClick={() => setAiSummary(null)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-sm font-medium">{aiSummary.headline}</p>
          <div className="space-y-2">
            {aiSummary.sections.map((s, i) => (
              <div key={i} className="pl-3 border-l-2 border-primary/20">
                <span className="text-[10px] font-semibold text-primary/70">{s.category}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{s.summary}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-foreground/80 bg-primary/5 rounded-lg p-2">
            {aiSummary.keyTakeaway}
          </p>
        </motion.div>
      )}

      {/* News list */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground ml-2">뉴스 불러오는 중...</span>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="flex items-center">
              <Newspaper className="h-5 w-5 text-muted-foreground/40 mr-2" />
              <span className="text-sm text-muted-foreground">뉴스가 없습니다</span>
            </div>
            {hasOlderNews && (
              <button
                onClick={handleLoadOlder}
                className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                이전 {DAYS_WINDOW}일 더 보기
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`page-${page}-window-${windowCount}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {paginatedNews.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card rounded-xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Category & language badges */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            categoryColors[item.category]
                          }`}
                        >
                          {item.category}
                        </span>
                        {item.isEnglish && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 flex items-center gap-1">
                            <Globe className="h-2.5 w-2.5" />
                            EN
                          </span>
                        )}
                        {item.isEnglish && !item.translatedText && (
                          <button
                            onClick={() => handleTranslate(item)}
                            disabled={translatingIds.has(item.id)}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            {translatingIds.has(item.id) ? (
                              <>
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                번역 중...
                              </>
                            ) : (
                              "번역"
                            )}
                          </button>
                        )}
                      </div>

                      {/* Clickable title */}
                      <button
                        onClick={() => handleOpenArticle(item.url)}
                        className="text-left group"
                      >
                        <h4 className="text-sm font-medium leading-snug group-hover:text-primary transition-colors flex items-center gap-1.5">
                          {item.title}
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </h4>
                      </button>

                      {/* Summary (1-2 lines) */}
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                        {item.summary}
                      </p>

                      {/* Inline Korean translation for English articles */}
                      {item.isEnglish && item.translatedText && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          transition={{ duration: 0.2 }}
                          className="mt-2 pl-3 border-l-2 border-primary/20"
                        >
                          <p className="text-[11px] text-muted-foreground/70">
                            {item.translatedText}
                          </p>
                        </motion.div>
                      )}

                      {/* Source, date, and time */}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground font-mono">
                        <span>{item.source}</span>
                        <span>|</span>
                        <span>{item.date}</span>
                        <span>|</span>
                        <span className="text-muted-foreground/60">
                          {(() => {
                            const now = new Date();
                            const pub = new Date(item.publishedAt);
                            const diffMs = now.getTime() - pub.getTime();
                            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                            if (diffHours < 1) return `${Math.max(1, Math.floor(diffMs / (1000 * 60)))}분 전`;
                            if (diffHours < 24) return `${diffHours}시간 전`;
                            return `${Math.floor(diffHours / 24)}일 전`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Pagination */}
      {!loading && filteredNews.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px] px-3"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </button>

          <span className="text-xs text-muted-foreground font-mono">
            {page} / {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px] px-3"
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Load older news button */}
      {!loading && hasOlderNews && (
        <div className="flex justify-center pt-1">
          <button
            onClick={handleLoadOlder}
            className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 px-4 py-2 rounded-lg bg-primary/5 hover:bg-primary/10"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            더 보기 (이전 {DAYS_WINDOW}일)
          </button>
        </div>
      )}
    </div>
  );
};

export default NewsView;
