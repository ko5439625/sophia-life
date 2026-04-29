// Yahoo Finance via Supabase Edge Function (api-proxy)

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
// (API_BASE removed — using proxyFetch via Supabase Edge Function)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Parse helpers
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
// 1. getQuote — Vercel API proxy
// ---------------------------------------------------------------------------

export async function getQuote(symbol: string): Promise<YahooQuote> {
  const json = await proxyFetch<{ chart?: { result?: Array<{ meta: Record<string, unknown> }> } }>(
    "yahoo-quote", { symbol }
  );
  if (!json) throw new Error(`Quote API failed for ${symbol}`);
  return parseQuoteFromChart(symbol, json);
}

// ---------------------------------------------------------------------------
// 2. getHistorical — Vercel API proxy
// ---------------------------------------------------------------------------

export async function getHistorical(
  symbol: string,
  range: string = "1y",
): Promise<YahooHistoricalData[]> {
  const json = await proxyFetch<{
    chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: number[]; volume?: number[] }> } }> };
  }>("yahoo-historical", { symbol, range });
  if (!json) throw new Error(`Historical API failed for ${symbol}`);
  return parseHistoricalFromChart(symbol, json);
}

// ---------------------------------------------------------------------------
// 3. getFinanceNews — use Google News RSS instead
// ---------------------------------------------------------------------------

export async function getFinanceNews(
  _query: string = "stock market",
): Promise<YahooNewsItem[]> {
  return [];
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
