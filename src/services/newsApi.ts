// Google News RSS via Supabase Edge Function (proxyFetch)

import { proxyFetch } from "./proxyFetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NewsArticle {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  urlToImage: string | null;
  category: string;
  isEnglish: boolean;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export async function getNews(
  category?: string,
  country?: string,
): Promise<NewsArticle[]> {
  const cat = category || "general";
  const resolvedCountry = country || "kr";
  const isEnglish = resolvedCountry === "us";

  try {
    const data = await proxyFetch<{
      articles?: Array<{
        title?: string;
        description?: string;
        source?: string;
        url?: string;
        publishedAt?: string;
      }>;
    }>("google-news", { category: cat, country: resolvedCountry });

    if (!data) {
      console.warn("[getNews] proxyFetch returned null");
      return [];
    }

    return (data.articles || []).map(
      (article) => ({
        title: article.title || "",
        description: article.description || "",
        source: article.source || "Google News",
        url: article.url || "",
        publishedAt: article.publishedAt || new Date().toISOString(),
        urlToImage: null,
        category: cat,
        isEnglish,
      }),
    );
  } catch (e) {
    console.warn("[getNews] fetch failed:", e);
    return [];
  }
}
