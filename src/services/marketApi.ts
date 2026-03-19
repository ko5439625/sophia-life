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

// Crypto Fear & Greed (alternative.me)
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

export interface SectorFearGreed {
  nasdaq: FearGreedResult | null;
  kosdaq: FearGreedResult | null;
  crypto: FearGreedResult | null;
}

// CNN Fear & Greed (US/NASDAQ)
async function getCNNFearGreed(): Promise<FearGreedResult | null> {
  try {
    const res = await fetch(`${API_BASE}/api/market?service=fear-greed-cnn`);
    if (!res.ok) return null;
    const data = await res.json();
    const score = data?.fear_and_greed?.score;
    const rating = data?.fear_and_greed?.rating;
    if (score == null) return null;
    return { value: Math.round(score), label: rating || "" };
  } catch { return null; }
}

// VKOSPI → 공포/탐욕 변환 (VIX 기준: <15 탐욕, 15-25 중립, 25-35 공포, >35 극단공포)
function vkospiToFearGreed(vkospi: number): FearGreedResult {
  let value: number;
  let label: string;
  if (vkospi >= 35) { value = 10; label = "Extreme Fear"; }
  else if (vkospi >= 25) { value = 30; label = "Fear"; }
  else if (vkospi >= 20) { value = 45; label = "Neutral"; }
  else if (vkospi >= 15) { value = 65; label = "Greed"; }
  else { value = 85; label = "Extreme Greed"; }
  // 선형 보간: VKOSPI 10~40 → Fear&Greed 90~5
  value = Math.max(5, Math.min(95, Math.round(100 - (vkospi - 10) * 3)));
  return { value, label };
}

// KOSPI Fear & Greed Index (kospi-fear-greed-index.co.kr GitHub data)
async function getKosdaqFearGreed(): Promise<FearGreedResult | null> {
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/immanuelk1m/kospi-feargreedindex/refs/heads/main/assets/js/json/value.json"
    );
    if (!res.ok) return null;
    const data = await res.json();
    const value = Math.round(data.current * 10) / 10;
    const label = value <= 25 ? "Extreme Fear" : value <= 45 ? "Fear" : value <= 55 ? "Neutral" : value <= 75 ? "Greed" : "Extreme Greed";
    return { value: Math.round(value), label };
  } catch { return null; }
}

// 3개 섹터 한번에
export async function getSectorFearGreed(): Promise<SectorFearGreed> {
  const [nasdaq, kosdaq, crypto] = await Promise.allSettled([
    getCNNFearGreed(),
    getKosdaqFearGreed(),
    getFearGreedIndex().then((r) => r).catch(() => null),
  ]);
  return {
    nasdaq: nasdaq.status === "fulfilled" ? nasdaq.value : null,
    kosdaq: kosdaq.status === "fulfilled" ? kosdaq.value : null,
    crypto: crypto.status === "fulfilled" ? crypto.value : null,
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
