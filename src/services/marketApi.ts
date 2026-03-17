// NOTE: Some APIs require a backend proxy to avoid CORS. For development, use mock data.
// Yahoo Finance is the primary data source (no API key needed).
// Alpha Vantage and open.er-api.com serve as fallbacks.

import { proxyFetch } from "./proxyFetch";
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

function getStockApiKey(): string | null {
  return localStorage.getItem("sophia-api-stock");
}

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

// ---------------------------------------------------------------------------
// Fear & Greed Index (no API key needed) - alternative.me
// Yahoo doesn't have this, so we keep the existing source.
// ---------------------------------------------------------------------------

async function realGetFearGreedIndex(): Promise<FearGreedResult> {
  const res = await fetch("https://api.alternative.me/fng/?limit=1");
  if (!res.ok) throw new Error(`Fear & Greed API error ${res.status}`);

  const data = await res.json();
  const entry = data.data?.[0];
  if (!entry) throw new Error("No data from Fear & Greed API");

  return {
    value: parseInt(entry.value, 10),
    label: entry.value_classification,
  };
}

function mockGetFearGreedIndex(): FearGreedResult {
  return { value: 42, label: "Fear" };
}

export async function getFearGreedIndex(): Promise<FearGreedResult> {
  try {
    return await realGetFearGreedIndex();
  } catch (e) {
    console.warn("Fear & Greed API failed, using mock:", e);
    return mockGetFearGreedIndex();
  }
}

// ---------------------------------------------------------------------------
// Stock Quotes: proxy → Yahoo Finance → Alpha Vantage → mock
// ---------------------------------------------------------------------------

async function yahooGetStockQuote(symbol: string): Promise<StockQuote> {
  // Fetch quote from Yahoo (already uses proxy internally)
  const quote = await yahooGetQuote(symbol);

  // Also fetch 30 days of historical data for chart
  let data: { date: string; close: number }[] = [];
  try {
    const historical = await yahooGetHistorical(symbol, "1mo");
    data = historical.map((d) => ({ date: d.date, close: d.close }));
  } catch {
    // Historical data is optional; proceed with empty
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

async function alphaVantageGetStockQuote(symbol: string): Promise<StockQuote> {
  const apiKey = getStockApiKey();
  if (!apiKey) throw new Error("No stock API key");

  // Fetch daily time series
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}&outputsize=compact`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Alpha Vantage API error ${res.status}`);

  const json = await res.json();
  const timeSeries = json["Time Series (Daily)"];
  if (!timeSeries) {
    throw new Error(json["Note"] || json["Error Message"] || "No time series data");
  }

  const dates = Object.keys(timeSeries).sort().reverse();
  const latest = timeSeries[dates[0]];
  const previous = timeSeries[dates[1]];

  const latestClose = parseFloat(latest["4. close"]);
  const previousClose = previous ? parseFloat(previous["4. close"]) : latestClose;
  const change = latestClose - previousClose;
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

  const data = dates.slice(0, 30).map((date) => ({
    date,
    close: parseFloat(timeSeries[date]["4. close"]),
  }));

  return {
    symbol,
    name: SYMBOL_NAMES[symbol] || symbol,
    price: Math.round(latestClose * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    data,
  };
}

function mockGetStockQuote(symbol: string): StockQuote {
  const mockPrices: Record<string, { price: number; change: number }> = {
    "^GSPC": { price: 5428.50, change: -12.30 },
    "^IXIC": { price: 17125.40, change: -45.20 },
    "^KS11": { price: 2685.30, change: 15.40 },
    "^KQ11": { price: 865.20, change: 8.70 },
    SPY: { price: 542.31, change: -2.15 },
    QQQ: { price: 468.92, change: -3.47 },
    EWY: { price: 62.18, change: 0.85 },
    "005930.KS": { price: 71500, change: 500 },
    "BTC-USD": { price: 92000, change: 1250 },
    DIA: { price: 425.67, change: -1.23 },
    GLD: { price: 218.45, change: 1.12 },
    TLT: { price: 92.34, change: 0.45 },
  };

  const info = mockPrices[symbol] || { price: 100, change: 0 };
  const changePercent = info.price !== 0 ? (info.change / info.price) * 100 : 0;

  // Generate mock historical data (30 days)
  const data: { date: string; close: number }[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const noise = (Math.random() - 0.5) * info.price * 0.02;
    data.push({ date: dateStr, close: Math.round((info.price + noise) * 100) / 100 });
  }

  return {
    symbol,
    name: SYMBOL_NAMES[symbol] || symbol,
    price: info.price,
    change: info.change,
    changePercent: Math.round(changePercent * 100) / 100,
    data,
  };
}

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  // 1. Try Yahoo Finance (internally uses proxy → direct → mock)
  try {
    return await yahooGetStockQuote(symbol);
  } catch (e) {
    console.warn(`Yahoo Finance failed for ${symbol}:`, e);
  }

  // 2. Try Alpha Vantage (needs key)
  try {
    if (getStockApiKey()) {
      return await alphaVantageGetStockQuote(symbol);
    }
  } catch (e) {
    console.warn(`Alpha Vantage failed for ${symbol}:`, e);
  }

  // 3. Fall back to mock data
  console.warn(`Using mock data for ${symbol}`);
  return mockGetStockQuote(symbol);
}

// ---------------------------------------------------------------------------
// Korean Stock Quotes (005930.KS format)
// ---------------------------------------------------------------------------

export async function getKoreanStockQuote(symbol: string): Promise<StockQuote> {
  // Korean stock symbols on Yahoo use the ".KS" (KOSPI) or ".KQ" (KOSDAQ) suffix
  return getStockQuote(symbol);
}

// ---------------------------------------------------------------------------
// Historical Data (for charts): proxy → Yahoo → mock
// ---------------------------------------------------------------------------

export async function getHistoricalData(
  symbol: string,
  range: string = "1y",
): Promise<HistoricalDataPoint[]> {
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
      const result = proxyResult.chart?.result?.[0];
      if (result) {
        const timestamps: number[] = result.timestamp || [];
        const closes: number[] = result.indicators?.quote?.[0]?.close || [];
        const volumes: number[] = result.indicators?.quote?.[0]?.volume || [];
        const data: HistoricalDataPoint[] = [];
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
        if (data.length > 0) return data;
      }
    }
  } catch (e) {
    console.warn(`[getHistoricalData] proxy failed for ${symbol}:`, e);
  }

  // 2. Try Yahoo Finance direct
  try {
    return await yahooGetHistorical(symbol, range);
  } catch (e) {
    console.warn(`Yahoo historical data failed for ${symbol}:`, e);
  }

  // 3. Fall back to mock data
  const mockData: HistoricalDataPoint[] = [];
  const now = new Date();
  const days = range === "1mo" ? 30 : range === "3mo" ? 90 : range === "6mo" ? 180 : range === "5y" ? 1825 : 365;
  const basePrice = mockGetStockQuote(symbol).price;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    // Skip weekends for stock-like data
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const dateStr = d.toISOString().split("T")[0];
    const trend = (1 - i / days) * basePrice * 0.15;
    const noise = (Math.random() - 0.5) * basePrice * 0.03;
    mockData.push({
      date: dateStr,
      close: Math.round((basePrice * 0.9 + trend + noise) * 100) / 100,
      volume: Math.round(Math.random() * 10000000),
    });
  }

  return mockData;
}

// ---------------------------------------------------------------------------
// Exchange Rate: proxy → Yahoo → open.er-api → mock
// ---------------------------------------------------------------------------

async function realGetExchangeRate(
  from: string,
  to: string,
): Promise<ExchangeRateResult> {
  const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`);
  if (!res.ok) throw new Error(`Exchange rate API error ${res.status}`);

  const json = await res.json();
  if (json.result !== "success") throw new Error("Exchange rate API returned error");

  const rate = json.rates?.[to];
  if (rate == null) throw new Error(`No rate found for ${to}`);

  // The free API doesn't provide change data, so we estimate 0
  return { rate, change: 0 };
}

function mockGetExchangeRate(from: string, to: string): ExchangeRateResult {
  const mockRates: Record<string, Record<string, number>> = {
    USD: { KRW: 1345.5, JPY: 149.2, EUR: 0.92, CNY: 7.24 },
    KRW: { USD: 0.000743, JPY: 0.111 },
  };

  const rate = mockRates[from]?.[to] ?? 1;
  return { rate, change: -0.3 };
}

export async function getExchangeRate(
  from: string,
  to: string,
): Promise<ExchangeRateResult> {
  // 1. Try Yahoo Finance (has change data, internally uses proxy → direct → mock)
  try {
    const result = await getYahooExchangeRate(from, to);
    return result;
  } catch (e) {
    console.warn(`Yahoo exchange rate failed for ${from}→${to}:`, e);
  }

  // 2. Try open.er-api
  try {
    return await realGetExchangeRate(from, to);
  } catch (e) {
    console.warn(`Exchange rate API failed for ${from}→${to}:`, e);
  }

  // 3. Fall back to mock
  console.warn(`Using mock exchange rate for ${from}→${to}`);
  return mockGetExchangeRate(from, to);
}
