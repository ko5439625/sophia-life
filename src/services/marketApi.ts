// Market data via Vercel Serverless Function (/api/market)

import {
  getQuote as yahooGetQuote,
  getHistorical as yahooGetHistorical,
  getYahooExchangeRate,
} from "./yahooFinanceApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  data: { date: string; close: number }[];
}

export interface FearGreedResult {
  value: number;
  label: string;
}

export interface ExchangeRateResult {
  rate: number;
  change: number;
}

export interface HistoricalDataPoint {
  date: string;
  close: number;
  volume: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SYMBOL_NAMES: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^IXIC": "NASDAQ",
  "^KS11": "KOSPI",
  "^KQ11": "KOSDAQ",
  SPY: "S&P 500 ETF",
  QQQ: "NASDAQ 100 ETF",
  EWY: "iShares MSCI South Korea",
  "005930.KS": "삼성전자",
  "BTC-USD": "Bitcoin",
  DIA: "Dow Jones ETF",
  IWM: "Russell 2000 ETF",
  GLD: "Gold ETF",
  TLT: "20+ Year Treasury Bond ETF",
};

const API_BASE = import.meta.env.DEV ? "http://localhost:3000" : "";

// ---------------------------------------------------------------------------
// Fear & Greed Index — Vercel API proxy
// ---------------------------------------------------------------------------

export async function getFearGreedIndex(): Promise<FearGreedResult> {
  const res = await fetch(`${API_BASE}/api/market?service=fear-greed`);
  if (!res.ok) throw new Error(`Fear & Greed API ${res.status}`);

  const data = await res.json();
  const entry = data.data?.[0];
  if (!entry) throw new Error("No Fear & Greed data");

  return {
    value: parseInt(entry.value, 10),
    label: entry.value_classification,
  };
}

// ---------------------------------------------------------------------------
// Stock Quotes — Yahoo via Vercel API
// ---------------------------------------------------------------------------

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const quote = await yahooGetQuote(symbol);

  let data: { date: string; close: number }[] = [];
  try {
    const historical = await yahooGetHistorical(symbol, "1mo");
    data = historical.map((d) => ({ date: d.date, close: d.close }));
  } catch {
    // Historical data is optional
  }

  return {
    symbol,
    name: SYMBOL_NAMES[symbol] || quote.name || symbol,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    data,
  };
}

// ---------------------------------------------------------------------------
// Korean Stock Quotes
// ---------------------------------------------------------------------------

export async function getKoreanStockQuote(symbol: string): Promise<StockQuote> {
  return getStockQuote(symbol);
}

// ---------------------------------------------------------------------------
// Historical Data — Yahoo via Vercel API
// ---------------------------------------------------------------------------

export async function getHistoricalData(
  symbol: string,
  range: string = "1y",
): Promise<HistoricalDataPoint[]> {
  return await yahooGetHistorical(symbol, range);
}

// ---------------------------------------------------------------------------
// Exchange Rate — Yahoo via Vercel API → open.er-api fallback
// ---------------------------------------------------------------------------

export async function getExchangeRate(
  from: string,
  to: string,
): Promise<ExchangeRateResult> {
  // 1. Try Yahoo Finance
  try {
    return await getYahooExchangeRate(from, to);
  } catch (e) {
    console.warn(`Yahoo exchange rate failed for ${from}→${to}:`, e);
  }

  // 2. Try open.er-api via Vercel proxy
  const res = await fetch(`${API_BASE}/api/market?service=exchange-rate&from=${encodeURIComponent(from)}`);
  if (!res.ok) throw new Error(`Exchange rate API ${res.status}`);

  const json = await res.json();
  const rate = json.rates?.[to];
  if (rate == null) throw new Error(`No rate for ${to}`);

  return { rate, change: 0 };
}
