// NOTE: Yahoo Finance may require CORS proxy in browser. For production, route through backend.
// Yahoo Finance unofficial API - no API key needed.

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
// 1. getQuote
// ---------------------------------------------------------------------------

export async function getQuote(symbol: string): Promise<YahooQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetchWithCorsRetry(url);
  const json = await res.json();

  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`No chart data for ${symbol}`);

  const meta = result.meta;
  const price = meta.regularMarketPrice ?? 0;
  const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change = price - previousClose;
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

  return {
    symbol,
    name: YAHOO_SYMBOL_NAMES[symbol] || meta.shortName || meta.symbol || symbol,
    price: Math.round(price * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    previousClose: Math.round(previousClose * 100) / 100,
    currency: meta.currency || "USD",
  };
}

// ---------------------------------------------------------------------------
// 2. getHistorical
// ---------------------------------------------------------------------------

export async function getHistorical(
  symbol: string,
  range: string = "1y",
): Promise<YahooHistoricalData[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${encodeURIComponent(range)}`;
  const res = await fetchWithCorsRetry(url);
  const json = await res.json();

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
// 3. getFinanceNews
// ---------------------------------------------------------------------------

export async function getFinanceNews(
  query: string = "stock market",
): Promise<YahooNewsItem[]> {
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
