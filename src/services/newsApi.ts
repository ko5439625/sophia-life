// Google News RSS via Vercel Serverless Function (/api/news)

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

const API_BASE = import.meta.env.DEV ? "http://localhost:3000" : "";

export async function getNews(
  category?: string,
  country?: string,
): Promise<NewsArticle[]> {
  const cat = category || "general";
  const resolvedCountry = country || "kr";
  const isEnglish = resolvedCountry === "us";

  try {
    const params = new URLSearchParams({ category: cat, country: resolvedCountry });
    const res = await fetch(`${API_BASE}/api/news?${params.toString()}`);

    if (!res.ok) {
      console.warn(`[getNews] API returned ${res.status}`);
      return [];
    }

    const data = await res.json();

    return (data.articles || []).map(
      (article: {
        title?: string;
        description?: string;
        source?: string;
        url?: string;
        publishedAt?: string;
      }) => ({
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
