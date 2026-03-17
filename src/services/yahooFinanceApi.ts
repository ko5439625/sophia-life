// NOTE: Yahoo Finance may require CORS proxy in browser. For production, route through backend.
// Yahoo Finance unofficial API - no API key needed.

import { proxyFetch } from "./proxyFetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface YahooQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  currency: string;
}

export interface YahooHistoricalData {
  date: string;
  close: number;
  volume: number;
}

export interface YahooNewsItem {
  title: string;
  link: string;
  publisher: string;
  publishedAt: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Symbol name mapping
// ---------------------------------------------------------------------------

const YAHOO_SYMBOL_NAMES: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^IXIC": "NASDAQ",
  "^KS11": "KOSPI",
  "^KQ11": "KOSDAQ",
  SPY: "S&P 500 ETF",
  QQQ: "NASDAQ 100 ETF",
  EWY: "iShares MSCI South Korea",
  "005930.KS": "삼성전자",
  "BTC-USD": "Bitcoin",
  "USDKRW=X": "USD/KRW",
  DIA: "Dow Jones ETF",
  GLD: "Gold ETF",
  TLT: "20+ Year Treasury Bond ETF",
};

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function mockGetQuote(symbol: string): YahooQuote {
  const mockPrices: Record<string, number> = {
    "^GSPC": 5428.5,
    "^IXIC": 17125.4,
    "^KS11": 2685.3,
    "^KQ11": 865.2,
    SPY: 542.31,
    QQQ: 468.92,
    "005930.KS": 71500,
    "BTC-USD": 92000,
    "USDKRW=X": 1345.5,
    DIA: 425.67,
    GLD: 218.45,
    TLT: 92.34,
  };
  const price = mockPrices[symbol] ?? 100;
  return {
    symbol,
    name: YAHOO_SYMBOL_NAMES[symbol] || symbol,
    price,
    change: 0,
    changePercent: 0,
    previousClose: price,
    currency: "USD",
  };
}

function mockGetHistorical(symbol: string): YahooHistoricalData[] {
  const base = mockGetQuote(symbol).price;
  const data: YahooHistoricalData[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const noise = (Math.random() - 0.5) * base * 0.02;
    data.push({
      date: d.toISOString().split("T")[0],
      close: Math.round((base + noise) * 100) / 100,
      volume: Math.round(Math.random() * 10000000),
    });
  }
  return data;
}

function mockGetFinanceNews(): YahooNewsItem[] {
  return [
    {
      title: "Markets update (mock)",
      link: "https://example.com",
      publisher: "Mock",
      publishedAt: new Date().toISOString(),
      summary: "",
    },
  ];
}

// ---------------------------------------------------------------------------
// CORS proxy helpers
// ---------------------------------------------------------------------------

// In development, Yahoo Finance blocks browser requests due to CORS.
// We try multiple proxy strategies. In production, route through your own backend.
const CORS_PROXIES = [
  // Direct (works in some environments, e.g. Electron, mobile webview)
  "",
  // Public CORS proxies (may be unreliable)
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
];

async function fetchWithCorsRetry(url: string): Promise<Response> {
  let lastError: Error | null = null;

  for (const proxy of CORS_PROXIES) {
    try {
      const fetchUrl = proxy ? `${proxy}${encodeURIComponent(url)}` : url;
      const res = await fetch(fetchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });
      if (res.ok) return res;
      // If we get a non-ok response from direct, try proxy
      if (!proxy) continue;
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      continue;
    }
  }

  throw lastError || new Error("All fetch attempts failed");
}

// ---------------------------------------------------------------------------
// Parse helpers (shared between proxy and direct)
// ---------------------------------------------------------------------------

function parseQuoteFromChart(
  symbol: string,
  json: { chart?: { result?: Array<{ meta: Record<string, unknown> }> } },
): YahooQuote {
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`No chart data for ${symbol}`);

  const meta = result.meta as Record<string, unknown>;
  const price = (meta.regularMarketPrice as number) ?? 0;
  const previousClose =
    (meta.chartPreviousClose as number) ?? (meta.previousClose as number) ?? price;
  const change = price - previousClose;
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

  return {
    symbol,
    name: YAHOO_SYMBOL_NAMES[symbol] || (meta.shortName as string) || (meta.symbol as string) || symbol,
    price: Math.round(price * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    previousClose: Math.round(previousClose * 100) / 100,
    currency: (meta.currency as string) || "USD",
  };
}

function parseHistoricalFromChart(
  symbol: string,
  json: {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: number[]; volume?: number[] }> };
      }>;
    };
  },
): YahooHistoricalData[] {
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`No historical data for ${symbol}`);

  const timestamps: number[] = result.timestamp || [];
  const closes: number[] = result.indicators?.quote?.[0]?.close || [];
  const volumes: number[] = result.indicators?.quote?.[0]?.volume || [];

  const data: YahooHistoricalData[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const closeVal = closes[i];
    if (closeVal == null || isNaN(closeVal)) continue;

    const d = new Date(timestamps[i] * 1000);
    data.push({
      date: d.toISOString().split("T")[0],
      close: Math.round(closeVal * 100) / 100,
      volume: volumes[i] || 0,
    });
  }

  return data;
}

// ---------------------------------------------------------------------------
// 1. getQuote — proxy → direct → mock
// ---------------------------------------------------------------------------

export async function getQuote(symbol: string): Promise<YahooQuote> {
  // 1. Try Supabase proxy
  try {
    const proxyResult = await proxyFetch<{
      chart?: { result?: Array<{ meta: Record<string, unknown> }> };
    }>("yahoo-quote", { symbol });
    if (proxyResult) {
      return parseQuoteFromChart(symbol, proxyResult);
    }
  } catch (e) {
    console.warn(`[getQuote] proxy failed for ${symbol}:`, e);
  }

  // 2. Try direct fetch with CORS retry
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetchWithCorsRetry(url);
    const json = await res.json();
    return parseQuoteFromChart(symbol, json);
  } catch (e) {
    console.warn(`[getQuote] direct failed for ${symbol}:`, e);
  }

  // 3. Mock fallback
  console.warn(`[getQuote] using mock for ${symbol}`);
  return mockGetQuote(symbol);
}

// ---------------------------------------------------------------------------
// 2. getHistorical — proxy → direct → mock
// ---------------------------------------------------------------------------

export async function getHistorical(
  symbol: string,
  range: string = "1y",
): Promise<YahooHistoricalData[]> {
  // 1. Try Supabase proxy
  try {
    const proxyResult = await proxyFetch<{
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: number[]; volume?: number[] }> };
        }>;
      };
    }>("yahoo-historical", { symbol, range });
    if (proxyResult) {
      return parseHistoricalFromChart(symbol, proxyResult);
    }
  } catch (e) {
    console.warn(`[getHistorical] proxy failed for ${symbol}:`, e);
  }

  // 2. Try direct fetch with CORS retry
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${encodeURIComponent(range)}`;
    const res = await fetchWithCorsRetry(url);
    const json = await res.json();
    return parseHistoricalFromChart(symbol, json);
  } catch (e) {
    console.warn(`[getHistorical] direct failed for ${symbol}:`, e);
  }

  // 3. Mock fallback
  console.warn(`[getHistorical] using mock for ${symbol}`);
  return mockGetHistorical(symbol);
}

// ---------------------------------------------------------------------------
// 3. getFinanceNews — proxy → direct → mock
// ---------------------------------------------------------------------------

export async function getFinanceNews(
  query: string = "stock market",
): Promise<YahooNewsItem[]> {
  // 1. Try Supabase proxy
  try {
    const proxyResult = await proxyFetch<{
      news?: Array<{
        title?: string;
        link?: string;
        publisher?: string;
        providerPublishTime?: number;
      }>;
    }>("yahoo-news", { query });
    if (proxyResult && proxyResult.news) {
      return proxyResult.news.map((item) => ({
        title: item.title || "",
        link: item.link || "",
        publisher: item.publisher || "",
        publishedAt: item.providerPublishTime
          ? new Date(item.providerPublishTime * 1000).toISOString()
          : "",
        summary: "",
      }));
    }
  } catch (e) {
    console.warn(`[getFinanceNews] proxy failed:`, e);
  }

  // 2. Try direct fetch with CORS retry
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=10`;
    const res = await fetchWithCorsRetry(url);
    const json = await res.json();

    const newsItems: YahooNewsItem[] = (json.news || []).map(
      (item: {
        title?: string;
        link?: string;
        publisher?: string;
        providerPublishTime?: number;
        uuid?: string;
      }) => ({
        title: item.title || "",
        link: item.link || "",
        publisher: item.publisher || "",
        publishedAt: item.providerPublishTime
          ? new Date(item.providerPublishTime * 1000).toISOString()
          : "",
        summary: "",
      }),
    );

    return newsItems;
  } catch (e) {
    console.warn(`[getFinanceNews] direct failed:`, e);
  }

  // 3. Mock fallback
  console.warn(`[getFinanceNews] using mock`);
  return mockGetFinanceNews();
}

// ---------------------------------------------------------------------------
// 4. getExchangeRate
// ---------------------------------------------------------------------------

export async function getYahooExchangeRate(
  from: string,
  to: string,
): Promise<{ rate: number; change: number }> {
  const symbol = `${from}${to}=X`;
  const quote = await getQuote(symbol);

  return {
    rate: quote.price,
    change: quote.change,
  };
}
