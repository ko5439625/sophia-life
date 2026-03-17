// NOTE: Some APIs require a backend proxy to avoid CORS. For development, use mock data.
// NewsAPI free tier does NOT allow client-side requests (CORS blocked).
// A backend proxy is required for production use.

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
// Helpers
// ---------------------------------------------------------------------------

const NEWS_API_ENDPOINT = "https://newsapi.org/v2/top-headlines";

function getApiKey(): string | null {
  return localStorage.getItem("sophia-api-news");
}

// ---------------------------------------------------------------------------
// Real API function (direct fetch)
// ---------------------------------------------------------------------------

async function realGetNews(
  category?: string,
  country?: string,
): Promise<NewsArticle[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No News API key");

  const params = new URLSearchParams({ apiKey });
  const resolvedCountry = country || "kr";
  params.set("country", resolvedCountry);
  if (category) params.set("category", category);
  params.set("pageSize", "20");

  const res = await fetch(`${NEWS_API_ENDPOINT}?${params.toString()}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`News API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  if (data.status !== "ok") throw new Error(data.message || "News API error");

  const isEnglish = resolvedCountry === "us";
  const cat = category || "general";

  return (data.articles || []).map(
    (article: {
      title?: string;
      description?: string;
      source?: { name?: string };
      url?: string;
      publishedAt?: string;
      urlToImage?: string | null;
    }) => ({
      title: article.title || "",
      description: article.description || "",
      source: article.source?.name || "Unknown",
      url: article.url || "",
      publishedAt: article.publishedAt || new Date().toISOString(),
      urlToImage: article.urlToImage || null,
      category: cat,
      isEnglish,
    }),
  );
}

// ---------------------------------------------------------------------------
// Mock function
// ---------------------------------------------------------------------------

function mockGetNews(
  category?: string,
  country?: string,
): NewsArticle[] {
  const isEnglish = country === "us";
  const cat = category || "general";

  if (cat === "crypto") {
    return [
      {
        title: "비트코인, 9,200만원 돌파… 기관 투자자 유입 가속",
        description: "비트코인이 9,200만원을 돌파하며 사상 최고가를 경신했다. 미국 현물 ETF 순유입이 지속되면서 기관 투자자들의 참여가 확대되고 있다.",
        source: "코인데스크코리아",
        url: "https://example.com/news/crypto/1",
        publishedAt: "2026-03-17T10:00:00Z",
        urlToImage: null,
        category: "crypto",
        isEnglish: false,
      },
      {
        title: "이더리움 2.0 업그레이드 완료, 스테이킹 수익률 상승",
        description: "이더리움 재단이 최신 네트워크 업그레이드를 성공적으로 완료했다. 스테이킹 참여율이 증가하며 연간 수익률이 4.5%까지 상승했다.",
        source: "블록미디어",
        url: "https://example.com/news/crypto/2",
        publishedAt: "2026-03-17T08:00:00Z",
        urlToImage: null,
        category: "crypto",
        isEnglish: false,
      },
      {
        title: "한국 가상자산법 시행령 개정안, 투자자 보호 강화",
        description: "금융위원회가 가상자산법 시행령 개정안을 발표했다. 거래소 준비금 의무화와 이상거래 탐지 시스템 강화가 핵심이다.",
        source: "한국경제",
        url: "https://example.com/news/crypto/3",
        publishedAt: "2026-03-16T14:00:00Z",
        urlToImage: null,
        category: "crypto",
        isEnglish: false,
      },
    ];
  }

  const koreanNews: NewsArticle[] = [
    {
      title: "한국은행, 기준금리 동결… '경기 불확실성' 우려",
      description: "한국은행 금융통화위원회가 기준금리를 현 수준에서 동결했다. 경기 불확실성이 커지고 있다는 판단에서다.",
      source: "한국경제",
      url: "https://example.com/news/1",
      publishedAt: "2026-03-17T09:00:00Z",
      urlToImage: null,
      category: cat,
      isEnglish: false,
    },
    {
      title: "삼성전자, AI 반도체 투자 확대… HBM4 양산 가속",
      description: "삼성전자가 AI 반도체 시장 선점을 위해 HBM4 메모리 양산을 앞당기기로 했다.",
      source: "조선일보",
      url: "https://example.com/news/2",
      publishedAt: "2026-03-17T08:30:00Z",
      urlToImage: null,
      category: cat,
      isEnglish: false,
    },
    {
      title: "서울 아파트 거래량 3개월 연속 증가",
      description: "서울 아파트 거래량이 3개월 연속 증가세를 보이며 봄 이사철 시장 활성화 기대감이 높아지고 있다.",
      source: "매일경제",
      url: "https://example.com/news/3",
      publishedAt: "2026-03-17T07:00:00Z",
      urlToImage: null,
      category: cat,
      isEnglish: false,
    },
    {
      title: "원·달러 환율 1,340원대 안착… 수출기업 수혜",
      description: "원·달러 환율이 1,340원대에 안착하면서 수출기업들의 실적 개선 기대감이 높아지고 있다.",
      source: "서울경제",
      url: "https://example.com/news/4",
      publishedAt: "2026-03-16T18:00:00Z",
      urlToImage: null,
      category: cat,
      isEnglish: false,
    },
    {
      title: "국내 게임산업 매출 20조원 돌파 전망",
      description: "한국콘텐츠진흥원이 올해 국내 게임산업 매출이 20조원을 돌파할 것으로 전망했다.",
      source: "연합뉴스",
      url: "https://example.com/news/5",
      publishedAt: "2026-03-16T15:00:00Z",
      urlToImage: null,
      category: cat,
      isEnglish: false,
    },
  ];

  const englishNews: NewsArticle[] = [
    {
      title: "Fed Signals Cautious Approach to Rate Cuts Amid Inflation Concerns",
      description: "The Federal Reserve indicated it will take a measured approach to cutting interest rates, citing persistent inflation pressures.",
      source: "Reuters",
      url: "https://example.com/news/en/1",
      publishedAt: "2026-03-17T10:00:00Z",
      urlToImage: null,
      category: cat,
      isEnglish: true,
    },
    {
      title: "Tech Giants Report Strong Q1 Earnings Driven by AI Demand",
      description: "Major technology companies reported better-than-expected first quarter results, fueled by growing demand for AI infrastructure.",
      source: "Bloomberg",
      url: "https://example.com/news/en/2",
      publishedAt: "2026-03-17T08:00:00Z",
      urlToImage: null,
      category: cat,
      isEnglish: true,
    },
    {
      title: "Global Markets Rally as Trade Tensions Ease",
      description: "Stock markets around the world gained ground after signs of progress in international trade negotiations.",
      source: "CNBC",
      url: "https://example.com/news/en/3",
      publishedAt: "2026-03-16T20:00:00Z",
      urlToImage: null,
      category: cat,
      isEnglish: true,
    },
    {
      title: "Oil Prices Stabilize as OPEC+ Maintains Production Targets",
      description: "Crude oil prices found support after OPEC+ members agreed to maintain current production levels through the second quarter.",
      source: "WSJ",
      url: "https://example.com/news/en/4",
      publishedAt: "2026-03-16T16:00:00Z",
      urlToImage: null,
      category: cat,
      isEnglish: true,
    },
  ];

  return isEnglish ? englishNews : koreanNews;
}

// ---------------------------------------------------------------------------
// Unified export: proxy → direct → mock
// ---------------------------------------------------------------------------

export async function getNews(
  category?: string,
  country?: string,
): Promise<NewsArticle[]> {
  const apiKey = getApiKey();
  const resolvedCountry = country || "kr";
  const cat = category || "general";
  const isEnglish = resolvedCountry === "us";

  // 1. Try Supabase proxy
  try {
    const proxyResult = await proxyFetch<{
      status?: string;
      articles?: Array<{
        title?: string;
        description?: string;
        source?: { name?: string };
        url?: string;
        publishedAt?: string;
        urlToImage?: string | null;
      }>;
    }>("news", { category: cat, country: resolvedCountry, apiKey: apiKey || "" });

    if (proxyResult && proxyResult.articles) {
      return proxyResult.articles.map((article) => ({
        title: article.title || "",
        description: article.description || "",
        source: article.source?.name || "Unknown",
        url: article.url || "",
        publishedAt: article.publishedAt || new Date().toISOString(),
        urlToImage: article.urlToImage || null,
        category: cat,
        isEnglish,
      }));
    }
  } catch (e) {
    console.warn("[getNews] proxy failed:", e);
  }

  // 2. Try direct API (requires API key)
  try {
    if (apiKey) {
      return await realGetNews(category, country);
    }
  } catch (e) {
    console.warn("News API direct failed, using mock:", e);
  }

  // 3. Mock fallback
  return mockGetNews(category, country);
}
