import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, TrendingUp, Shield, Zap, RefreshCw, Lock, X, ChevronRight, Search } from "lucide-react";
import { useGuestMode } from "../../../hooks/useGuestMode";
import { formatKRW } from "./budgetData";
import { isKisConfigured } from "../../../services/kisApi";
import { proxyFetch } from "../../../services/proxyFetch";

// ---------------------------------------------------------------------------
// Stock Universe
// ---------------------------------------------------------------------------

const US_STOCKS = [
  "AAPL", "NVDA", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "LLY", "JPM",
  "V", "UNH", "MA", "COST", "HD", "NFLX", "CRM", "AMD", "ORCL", "ADBE",
  "PEP", "KO", "MRK", "ABBV", "TMO", "ACN", "MCD", "CSCO", "LIN", "DHR",
];
const US_NAMES: Record<string, string> = {
  "AAPL": "애플", "NVDA": "엔비디아", "MSFT": "마이크로소프트", "GOOGL": "구글",
  "AMZN": "아마존", "META": "메타", "TSLA": "테슬라", "AVGO": "브로드컴",
  "LLY": "일라이릴리", "JPM": "JP모건", "V": "비자", "UNH": "유나이티드헬스",
  "MA": "마스터카드", "COST": "코스트코", "HD": "홈디포", "NFLX": "넷플릭스",
  "CRM": "세일즈포스", "AMD": "AMD", "ORCL": "오라클", "ADBE": "어도비",
  "PEP": "펩시코", "KO": "코카콜라", "MRK": "머크", "ABBV": "애브비",
  "TMO": "써모피셔", "ACN": "액센추어", "MCD": "맥도날드", "CSCO": "시스코",
  "LIN": "린데", "DHR": "다나허",
};
const KR_STOCKS = [
  "005930.KS", "000660.KS", "373220.KS", "207940.KS", "005380.KS",
  "000270.KS", "068270.KS", "035420.KS", "035720.KS", "005490.KS",
  "006400.KS", "051910.KS", "012450.KS", "042660.KS", "066570.KS",
  "034020.KS", "329180.KS", "259960.KS", "055550.KS", "105560.KS",
];
const KR_NAMES: Record<string, string> = {
  "005930.KS": "삼성전자", "000660.KS": "SK하이닉스", "373220.KS": "LG에너지솔루션",
  "207940.KS": "삼성바이오", "005380.KS": "현대차", "000270.KS": "기아",
  "068270.KS": "셀트리온", "035420.KS": "NAVER", "035720.KS": "카카오",
  "005490.KS": "POSCO홀딩스", "006400.KS": "삼성SDI", "051910.KS": "LG화학",
  "012450.KS": "한화에어로", "042660.KS": "한화오션", "066570.KS": "LG전자",
  "034020.KS": "두산에너빌", "329180.KS": "HD현대중공업", "259960.KS": "크래프톤",
  "055550.KS": "신한지주", "105560.KS": "KB금융",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  currency: string;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  beta: number | null;
  dividendYield: number | null;
  revenueGrowth: number | null;
  debtToEquity: number | null;
  category: "aggressive" | "neutral" | "conservative";
  score: number;
  valuation: string;
  recommendation: "strong" | "normal" | "avoid"; // 완존추천/보통/비추천
  recScore: number; // 추천 점수 (0~100)
}

interface AIAnalysis {
  verdict: string;
  action: string;
  entry: string;
  target: string;
  stopLoss: string;
  reward: string;
  riskPct: string;
  bullProb: string; // "65"
  bearProb: string; // "35"
  confidence: string; // "높음/중간/낮음"
  summary: string;
  prediction: string;
  strategy: string;
  risk: string;
}

// ---------------------------------------------------------------------------
// Quant Classification
// ---------------------------------------------------------------------------

function classifyStock(s: { pe: number | null; pb: number | null; roe: number | null; beta: number | null; change: number; revenueGrowth: number | null; dividendYield: number | null; debtToEquity?: number | null }): { category: "aggressive" | "neutral" | "conservative"; score: number; valuation: string; recommendation: "strong" | "normal" | "avoid"; recScore: number } {
  let aggScore = 0;
  let conScore = 0;

  if (s.beta != null) {
    if (s.beta > 1.3) aggScore += 3;
    else if (s.beta > 1.0) aggScore += 1;
    else if (s.beta < 0.7) conScore += 3;
    else conScore += 1;
  }
  // 등락률 기반 (데이터 없어도 항상 작동) - 가중치 강화
  if (s.change > 3) aggScore += 3;
  else if (s.change > 1.5) aggScore += 2;
  else if (s.change > 0) aggScore += 1;
  else if (s.change < -3) conScore += 3;
  else if (s.change < -1.5) conScore += 2;
  else conScore += 1;
  if (s.revenueGrowth != null) {
    if (s.revenueGrowth > 0.2) aggScore += 2;
    else if (s.revenueGrowth > 0.05) aggScore += 1;
    else conScore += 1;
  }
  if (s.dividendYield != null && s.dividendYield > 0.02) conScore += 2;
  if (s.roe != null && s.roe > 0.2) aggScore += 1;
  if (s.roe != null && s.roe < 0.05 && s.roe >= 0) conScore += 1;

  let valuation = "적정";
  if (s.pe != null) {
    if (s.pe < 12) valuation = "저평가";
    else if (s.pe > 35) valuation = "고평가";
  }
  if (s.pb != null) {
    if (s.pb < 1.0 && valuation !== "고평가") valuation = "저평가";
    else if (s.pb > 5.0) valuation = "고평가";
  }

  // 절대 점수 계산 (상대 분류는 fetchStocks에서)
  const diff = aggScore - conScore;
  let category: "aggressive" | "neutral" | "conservative" = "neutral"; // 임시, 나중에 상대 분류
  const score = Math.max(0, Math.min(100, 50 + diff * 10));

  // 종합 추천도 (0~100)
  let recScore = 50;
  // 저평가 +20, 고평가 -20
  if (valuation === "저평가") recScore += 20;
  else if (valuation === "고평가") recScore -= 20;
  // ROE 높으면 +15
  if (s.roe != null) {
    if (s.roe > 0.2) recScore += 15;
    else if (s.roe > 0.1) recScore += 5;
    else if (s.roe < 0) recScore -= 15;
  }
  // 매출 성장 +10
  if (s.revenueGrowth != null) {
    if (s.revenueGrowth > 0.15) recScore += 10;
    else if (s.revenueGrowth > 0) recScore += 5;
    else recScore -= 10;
  }
  // 낮은 부채비율 +5
  if (s.debtToEquity != null) {
    if (s.debtToEquity < 50) recScore += 5;
    else if (s.debtToEquity > 200) recScore -= 10;
  }
  // 모멘텀 +5
  if (s.change > 1) recScore += 5;
  else if (s.change < -3) recScore -= 10;
  // 배당 +5
  if (s.dividendYield != null && s.dividendYield > 0.02) recScore += 5;

  recScore = Math.max(0, Math.min(100, recScore));

  let recommendation: "strong" | "normal" | "avoid";
  if (recScore >= 65) recommendation = "strong";
  else if (recScore >= 40) recommendation = "normal";
  else recommendation = "avoid";

  return { category, score, valuation, recommendation, recScore };
}

// ---------------------------------------------------------------------------
// Fetch - 한투 API 우선, fallback Yahoo
// ---------------------------------------------------------------------------

function makeStockData(sym: string, name: string, q: Record<string, unknown>, currency: string): StockData {
  const change = q.changePercent != null
    ? Math.round((q.changePercent as number) * 100) / 100
    : (() => { const prev = (q.previousClose as number) || (q.price as number) || 1; return Math.round((((q.price as number) - prev) / prev) * 1000) / 10; })();
  const classified = classifyStock({
    pe: q.pe as number | null, pb: q.pb as number | null, roe: q.roe as number | null,
    beta: q.beta as number | null, change,
    revenueGrowth: q.revenueGrowth as number | null, dividendYield: q.dividendYield as number | null,
    debtToEquity: q.debtToEquity as number | null,
  });
  return {
    symbol: sym, name, price: (q.price as number) || 0, change, currency,
    pe: q.pe ? Math.round((q.pe as number) * 10) / 10 : null,
    pb: q.pb ? Math.round((q.pb as number) * 100) / 100 : null,
    roe: q.roe ? Math.round((q.roe as number) * 1000) / 10 : null,
    beta: q.beta ? Math.round((q.beta as number) * 100) / 100 : null,
    dividendYield: q.dividendYield ? Math.round((q.dividendYield as number) * 1000) / 10 : null,
    revenueGrowth: q.revenueGrowth ? Math.round((q.revenueGrowth as number) * 1000) / 10 : null,
    debtToEquity: q.debtToEquity ? Math.round((q.debtToEquity as number) * 10) / 10 : null,
    ...classified,
  };
}

// KOSPI + KOSDAQ 시총 상위 100개 (3년 전에도 대형주였을 가능성 높은 종목 포함)
const KR_UNIVERSE = [
  // KOSPI 시총 상위 50
  "005930.KS", "000660.KS", "373220.KS", "207940.KS", "005380.KS",
  "000270.KS", "068270.KS", "005490.KS", "006400.KS", "051910.KS",
  "012450.KS", "042660.KS", "066570.KS", "055550.KS", "105560.KS",
  "034020.KS", "329180.KS", "028260.KS", "012330.KS", "096770.KS",
  "017670.KS", "030200.KS", "032830.KS", "009150.KS", "086280.KS",
  "003670.KS", "010130.KS", "009830.KS", "267260.KS", "267250.KS",
  "003550.KS", "009540.KS", "034730.KS", "011170.KS", "000810.KS",
  "018260.KS", "033780.KS", "011200.KS", "097950.KS",
  "010950.KS", "326030.KS", "316140.KS", "003490.KS", "402340.KS",
  "138040.KS", "004020.KS", "021240.KS", "051900.KS", "161390.KS", "251270.KS",
  // KOSDAQ 시총 상위 20
  "247540.KQ", "086520.KQ", "263750.KQ", "293490.KQ", "035760.KQ",
  "022100.KQ", "042700.KQ", "036570.KQ",
  "328130.KQ", "241560.KQ", "145020.KQ", "196170.KQ", "091990.KQ",
  "112040.KQ", "357780.KQ", "068760.KQ", "041510.KQ", "035420.KQ",
  // 과거 대형주 (3년전 상위였으나 현재 하락한 종목 포함)
  "035720.KS", "352820.KS", "323410.KS", "377300.KS",
];

const KR_UNIVERSE_NAMES: Record<string, string> = {
  ...KR_NAMES,
  "017670.KS": "SK텔레콤", "030200.KS": "KT", "032830.KS": "삼성생명",
  "009150.KS": "삼성전기", "086280.KS": "현대글로비스", "003670.KS": "포스코퓨처엠",
  "010130.KS": "고려아연", "009830.KS": "한화솔루션", "267260.KS": "HD현대일렉트릭",
  "267250.KS": "HD현대", "247540.KQ": "에코프로비엠", "086520.KQ": "에코프로",
  "293490.KQ": "카카오게임즈", "035760.KQ": "CJ ENM", "022100.KQ": "포스코DX",
  "042700.KQ": "한미반도체", "036570.KQ": "엔씨소프트",
  "263750.KQ": "펄어비스", "251270.KS": "넷마블",
};

async function fetchYahooStocks(market: "us" | "kr"): Promise<StockData[]> {
  const symbols = market === "us" ? US_STOCKS : KR_UNIVERSE;
  const results: StockData[] = [];

  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5);
    try {
      const data = await proxyFetch<Record<string, Record<string, unknown>>>(
        "batch-fundamentals", { symbols: batch.join(",") }
      );
      if (!data) continue;
      for (const sym of batch) {
        const q = data[sym];
        if (!q || !q.price) continue;
        const name = market === "kr" ? (KR_UNIVERSE_NAMES[sym] || KR_NAMES[sym] || sym) : `${US_NAMES[sym] || sym} (${sym})`;
        results.push(makeStockData(sym, name, q, q.currency || (market === "us" ? "USD" : "KRW")));
      }
    } catch { /* skip */ }
  }

  return results.sort((a, b) => b.recScore - a.recScore);
}

function applyRelativeClassification(stocks: StockData[]): StockData[] {
  if (stocks.length === 0) return stocks;

  // score 기준 정렬 → 상위 30% 공격, 중간 40% 중립, 하위 30% 보수
  const sorted = [...stocks].sort((a, b) => b.score - a.score);
  const total = sorted.length;
  const aggressiveCut = Math.ceil(total * 0.3);
  const conservativeCut = Math.ceil(total * 0.7);

  sorted.forEach((stock, idx) => {
    if (idx < aggressiveCut) stock.category = "aggressive";
    else if (idx >= conservativeCut) stock.category = "conservative";
    else stock.category = "neutral";
  });

  return sorted;
}

async function fetchKisMarketCapStocks(): Promise<StockData[]> {
  const appkey = localStorage.getItem("sophia-api-kis-appkey");
  const appsecret = localStorage.getItem("sophia-api-kis-secret");
  if (!appkey || !appsecret) return [];

  try {
    const data = await proxyFetch<{ output?: Array<Record<string, string>> }>(
      "kis-market-cap", { appkey, appsecret }
    );
    if (!data) return [];
    const output = (data.output || []) as Array<Record<string, string>>;
    if (output.length === 0) return [];

    const results: StockData[] = [];
    const items = output as Array<Record<string, string>>;

    // KIS 데이터로 먼저 기본 종목 목록 구성
    const kisStocks: Array<{ code: string; name: string; price: number; change: number }> = [];
    for (const item of items) {
      const code = item.mksc_shrn_iscd || item.stck_shrn_iscd;
      if (!code) continue;
      const name = item.hts_kor_isnm || code;
      const kisPrice = parseInt(item.stck_prpr) || 0;
      const kisChange = parseFloat(item.prdy_ctrt) || 0;
      if (kisPrice > 0) kisStocks.push({ code, name, price: kisPrice, change: kisChange });
    }

    // Yahoo batch-fundamentals로 보조 지표를 한 번에 가져오기 (개별 호출 대신)
    const allSymbols = kisStocks.flatMap(s => [`${s.code}.KS`, `${s.code}.KQ`]);
    const yahooData: Record<string, Record<string, unknown>> = {};

    for (let i = 0; i < allSymbols.length; i += 10) {
      const batch = allSymbols.slice(i, i + 10);
      try {
        const data = await proxyFetch<Record<string, Record<string, unknown>>>(
          "batch-fundamentals", { symbols: batch.join(",") }
        );
        if (data) Object.assign(yahooData, data);
      } catch { /* skip batch */ }
    }

    for (const s of kisStocks) {
      // Yahoo 보조 지표 매칭 (.KS 우선, .KQ 폴백)
      const yKS = yahooData[`${s.code}.KS`];
      const yKQ = yahooData[`${s.code}.KQ`];
      const y = (yKS && yKS.symbol) ? yKS : (yKQ && yKQ.symbol) ? yKQ : null;

      const pe = y?.pe as number | null ?? null;
      const pb = y?.pb as number | null ?? null;
      const roe = y?.roe as number | null ?? null;
      const beta = y?.beta as number | null ?? null;
      const dividendYield = y?.dividendYield as number | null ?? null;
      const revenueGrowth = y?.revenueGrowth as number | null ?? null;
      const debtToEquity = y?.debtToEquity as number | null ?? null;

      const classified = classifyStock({
        pe, pb, roe, beta,
        change: s.change,
        revenueGrowth, dividendYield, debtToEquity,
      });
      results.push({
        symbol: `${s.code}.KS`, name: s.name,
        price: s.price,
        change: Math.round(s.change * 100) / 100,
        currency: "KRW",
        pe: pe ? Math.round(pe * 10) / 10 : null,
        pb: pb ? Math.round(pb * 100) / 100 : null,
        roe: roe ? Math.round(roe * 1000) / 10 : null,
        beta: beta ? Math.round(beta * 100) / 100 : null,
        dividendYield: dividendYield ? Math.round(dividendYield * 1000) / 10 : null,
        revenueGrowth: revenueGrowth ? Math.round(revenueGrowth * 1000) / 10 : null,
        debtToEquity: debtToEquity ? Math.round(debtToEquity * 10) / 10 : null,
        ...classified,
      } as StockData);
    }
    return results;
  } catch { return []; }
}

async function fetchStocks(market: "us" | "kr"): Promise<StockData[]> {
  let results: StockData[];
  if (market === "kr") {
    // 한투 시총 상위 우선
    results = await fetchKisMarketCapStocks();
    if (results.length === 0) results = await fetchYahooStocks(market);
  } else {
    results = await fetchYahooStocks(market);
  }
  return applyRelativeClassification(results);
}

async function analyzeStock(stock: StockData, market: string): Promise<AIAnalysis> {
  const apiKey = localStorage.getItem("sophia-api-gemini");
  if (!apiKey) throw new Error("Gemini API 키가 필요합니다.");

  const cur = stock.currency === "USD" ? "$" : "₩";
  const fundamentals = [
    stock.pe != null ? `PER ${stock.pe}배` : null,
    stock.pb != null ? `PBR ${stock.pb}배` : null,
    stock.roe != null ? `ROE ${stock.roe}%` : null,
    stock.beta != null ? `Beta ${stock.beta}` : null,
    stock.dividendYield != null ? `배당 ${stock.dividendYield}%` : null,
    stock.revenueGrowth != null ? `매출성장 ${stock.revenueGrowth}%` : null,
    stock.debtToEquity != null ? `부채비율 ${stock.debtToEquity}%` : null,
  ].filter(Boolean).join(" | ");

  // 뉴스 + 가격 히스토리 병렬 fetch
  let newsContext = "";
  let chartContext = "";
  try {
    const newsQ = stock.currency === "KRW" ? stock.name : stock.symbol;
    const [newsRes, histRes] = await Promise.allSettled([
      proxyFetch<{ articles?: string[] }>("stock-news", { q: newsQ }),
      proxyFetch<{ chart?: { result?: Array<{ indicators?: { quote?: Array<{ close?: number[]; volume?: number[] }> }; timestamp?: number[] }> } }>("yahoo-historical", { symbol: stock.symbol, range: "3mo" }),
    ]);

    // 뉴스
    if (newsRes.status === "fulfilled" && newsRes.value) {
      const articles = (newsRes.value.articles || []) as string[];
      if (articles.length > 0) {
        newsContext = `\n\nRECENT NEWS:\n${articles.slice(0, 6).map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
      }
    }

    // 가격 히스토리 → 기술적 분석용 요약
    if (histRes.status === "fulfilled" && histRes.value) {
      const histData = histRes.value;
      const result = histData?.chart?.result?.[0];
      if (result) {
        const closes = result.indicators?.quote?.[0]?.close?.filter((v: number | null) => v != null) as number[] || [];
        const volumes = result.indicators?.quote?.[0]?.volume?.filter((v: number | null) => v != null) as number[] || [];
        if (closes.length >= 10) {
          const high3m = Math.max(...closes);
          const low3m = Math.min(...closes);
          const current = closes[closes.length - 1];
          const ma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
          const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : ma5;
          const ma60 = closes.length >= 60 ? closes.slice(-60).reduce((a, b) => a + b, 0) / 60 : ma20;
          const avgVol = volumes.length > 0 ? volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length) : 0;
          const recentVol = volumes.length > 0 ? volumes[volumes.length - 1] : 0;
          const volRatio = avgVol > 0 ? (recentVol / avgVol).toFixed(1) : "N/A";
          // 지지/저항 (최근 20일 고가/저가 기반)
          const recent20 = closes.slice(-20);
          const support = Math.min(...recent20);
          const resistance = Math.max(...recent20);

          chartContext = `\n\nTECHNICAL DATA (3개월 차트 기반 - 반드시 분석에 반영):
- 3개월 고가: ${cur}${Math.round(high3m).toLocaleString()} / 저가: ${cur}${Math.round(low3m).toLocaleString()}
- 현재가 위치: 3개월 범위의 ${Math.round(((current - low3m) / (high3m - low3m || 1)) * 100)}%
- MA5: ${cur}${Math.round(ma5).toLocaleString()} / MA20: ${cur}${Math.round(ma20).toLocaleString()} / MA60: ${cur}${Math.round(ma60).toLocaleString()}
- 이동평균 배열: ${current > ma5 && ma5 > ma20 ? "정배열(상승)" : current < ma5 && ma5 < ma20 ? "역배열(하락)" : "혼조"}
- 20일 지지선: ${cur}${Math.round(support).toLocaleString()} / 저항선: ${cur}${Math.round(resistance).toLocaleString()}
- 거래량 비율: 최근/${20}일평균 = ${volRatio}배`;
        }
      }
    }
  } catch { /* fetch failed, proceed without */ }

  const prompt = `You are a senior equity research analyst at Goldman Sachs. Analyze this stock with institutional-grade rigor. Write in Korean.

STOCK: ${stock.name} (${stock.symbol}) | ${market} Market
PRICE: ${cur}${stock.price.toLocaleString()} (${stock.change >= 0 ? "+" : ""}${stock.change}%)
FUNDAMENTALS: ${fundamentals}
VALUATION: ${stock.valuation} | Quant Score: ${stock.score}/100
QUANT RECOMMENDATION: ${stock.recommendation === "strong" ? "추천" : stock.recommendation === "normal" ? "보통" : "비추천"}${chartContext}${newsContext}

CRITICAL RULE: 퀀트 시스템이 "${stock.recommendation === "strong" ? "추천" : stock.recommendation === "normal" ? "보통" : "비추천"}"으로 판정했다. 이 판정을 존중하라.
- 비추천 종목이면: verdict에 매수 금지. 중립/매도/강력매도만 가능. 왜 비추천인지(고평가/저수익성) 숫자로 설명. 그래도 뉴스가 긍정적이면 "뉴스 모멘텀은 있으나 밸류에이션 부담"처럼 양면 서술
- 보통 종목이면: 조건부 매수만 가능 (진입가를 현재가보다 낮게)
- 추천 종목이면: 매수/강력매수 가능하지만 리스크도 냉정하게

숫자로만 냉정하게 판단하라. 뉴스 여론에 휘둘리지 마라. PER 98은 객관적으로 고평가다.

Respond ONLY with valid JSON. ABSOLUTELY NO HTML tags (no br, b, p tags). No markdown. Plain Korean text only in values:
{
  "verdict": "강력매수/매수/중립/매도/강력매도. 냉정한 한줄 결론",
  "action": "매수/매도/관망",
  "entry": "진입가 (통화기호+숫자). 고평가면 현재가보다 낮은 매수 대기가 제시. 지지선/MA 근거",
  "target": "목표가 (통화기호+숫자)",
  "stopLoss": "손절가 (통화기호+숫자)",
  "reward": "+X.X%",
  "riskPct": "-X.X%",
  "bullProb": "상승 확률 숫자만 (예: 65)",
  "bearProb": "하락 확률 숫자만 (예: 35)",
  "confidence": "높음/중간/낮음. 확률 차이가 10%p 이내면 낮음, 20%p 이상이면 높음",
  "summary": "[숫자 근거] PER/PBR/ROE 동종업계 비교, 밸류에이션 판단. [뉴스 여론] 최신 뉴스 기반 시장 센티먼트. [종합] 숫자와 여론을 종합한 최종 평가",
  "prediction": "목표가(상승률%). Bull Case(확률%, 근거). Bear Case(확률%, 근거). 차트 이동평균/지지선 기반 기술적 판단",
  "strategy": "투자기간 명시(단기1-3개월/중기3-12개월/장기1년+, 왜 이 기간인지). 진입가(지지선/MA 근거). 목표가. 손절가(이 가격 아래면 왜 위험한지). 포지션 비중(전체 포트의 몇%)",
  "risk": "리스크 1(확률/영향도). 리스크 2. 리스크 3. 이 종목을 사면 안 되는 최악의 시나리오"
}`;

  const prompt2 = prompt;

  // Gemini API 호출 (503 시 최대 2회 재시도)
  let res: Response | null = null;
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt2 }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 8192 },
        }),
      }
    );
    if (res.ok) break;
    if ((res.status === 503 || res.status === 429) && attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    throw new Error(`API 오류 (${res.status})${res.status === 503 ? " - 서버 과부하, 잠시 후 다시 시도해주세요" : ""}`);
  }
  if (!res || !res.ok) throw new Error("API 호출 실패");
  const json = await res.json();
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = rawText
    .replace(/```json\s*/g, "").replace(/```\s*/g, "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/?b>/gi, "").replace(/<\/?[^>]+>/gi, "")
    .trim();

  // Parse with multiple fallbacks
  for (const attempt of [
    cleaned,
    cleaned.match(/\{[\s\S]*\}/)?.[0] || "",
    (cleaned.match(/\{[\s\S]*\}/)?.[0] || "").replace(/,\s*([}\]])/g, "$1"),
  ]) {
    if (!attempt) continue;
    try {
      const parsed = JSON.parse(attempt);
      if (parsed.summary) return parsed as AIAnalysis;
    } catch { /* next */ }
  }

  // Absolute fallback: extract fields individually with regex
  const extractField = (field: string) => {
    // Match "field": "value" or "field": "value with \"escaped\" quotes"
    const patterns = [
      new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`),
      new RegExp(`"${field}"\\s*:\\s*"([^"]{0,2000})`),
    ];
    for (const re of patterns) {
      const m = re.exec(cleaned);
      if (m?.[1]) return m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
    }
    return "";
  };
  return {
    verdict: extractField("verdict"),
    action: extractField("action"),
    entry: extractField("entry"),
    target: extractField("target"),
    stopLoss: extractField("stopLoss"),
    reward: extractField("reward"),
    riskPct: extractField("riskPct"),
    bullProb: extractField("bullProb"),
    bearProb: extractField("bearProb"),
    confidence: extractField("confidence"),
    summary: extractField("summary") || cleaned.slice(0, 300).replace(/[{}"]/g, ""),
    prediction: extractField("prediction"),
    strategy: extractField("strategy"),
    risk: extractField("risk"),
  };
}

// ---------------------------------------------------------------------------
// UI Helpers
// ---------------------------------------------------------------------------

// 한글 → Yahoo 종목코드 매핑 (Yahoo는 한글 검색 불가, .KS/.KQ 포함)
const KR_SEARCH_MAP: Record<string, { symbol: string; name: string }> = {
  "삼성전자": { symbol: "005930.KS", name: "삼성전자" },
  "SK하이닉스": { symbol: "000660.KS", name: "SK하이닉스" },
  "LG에너지솔루션": { symbol: "373220.KS", name: "LG에너지솔루션" },
  "삼성바이오": { symbol: "207940.KS", name: "삼성바이오로직스" },
  "현대차": { symbol: "005380.KS", name: "현대자동차" },
  "기아": { symbol: "000270.KS", name: "기아" },
  "셀트리온": { symbol: "068270.KS", name: "셀트리온" },
  "네이버": { symbol: "035420.KS", name: "NAVER" },
  "카카오": { symbol: "035720.KS", name: "카카오" },
  "POSCO홀딩스": { symbol: "005490.KS", name: "POSCO홀딩스" },
  "포스코홀딩스": { symbol: "005490.KS", name: "POSCO홀딩스" },
  "삼성SDI": { symbol: "006400.KS", name: "삼성SDI" },
  "LG화학": { symbol: "051910.KS", name: "LG화학" },
  "한화에어로": { symbol: "012450.KS", name: "한화에어로스페이스" },
  "한화에어로스페이스": { symbol: "012450.KS", name: "한화에어로스페이스" },
  "한화오션": { symbol: "042660.KS", name: "한화오션" },
  "LG전자": { symbol: "066570.KS", name: "LG전자" },
  "두산에너빌": { symbol: "034020.KS", name: "두산에너빌리티" },
  "HD현대중공업": { symbol: "329180.KS", name: "HD현대중공업" },
  "크래프톤": { symbol: "259960.KS", name: "크래프톤" },
  "엔씨소프트": { symbol: "036570.KQ", name: "엔씨소프트" },
  "펄어비스": { symbol: "263750.KQ", name: "펄어비스" },
  "넷마블": { symbol: "251270.KS", name: "넷마블" },
  "신한지주": { symbol: "055550.KS", name: "신한지주" },
  "KB금융": { symbol: "105560.KS", name: "KB금융" },
  "하이브": { symbol: "352820.KS", name: "하이브" },
  "쿠팡": { symbol: "CPNG", name: "쿠팡" },
  "에코프로": { symbol: "086520.KQ", name: "에코프로" },
  "에코프로비엠": { symbol: "247540.KQ", name: "에코프로비엠" },
  "한미반도체": { symbol: "042700.KQ", name: "한미반도체" },
  "카카오뱅크": { symbol: "323410.KS", name: "카카오뱅크" },
  "포스코퓨처엠": { symbol: "003670.KS", name: "포스코퓨처엠" },
  "HD현대일렉트릭": { symbol: "267260.KS", name: "HD현대일렉트릭" },
  "HD현대": { symbol: "267250.KS", name: "HD현대" },
  "현대글로비스": { symbol: "086280.KS", name: "현대글로비스" },
  "삼성전기": { symbol: "009150.KS", name: "삼성전기" },
  "삼성생명": { symbol: "032830.KS", name: "삼성생명" },
  "LG이노텍": { symbol: "011070.KS", name: "LG이노텍" },
  "SK텔레콤": { symbol: "017670.KS", name: "SK텔레콤" },
  "KT": { symbol: "030200.KS", name: "KT" },
  "두산퓨얼셀": { symbol: "336260.KS", name: "두산퓨얼셀" },
  "한화솔루션": { symbol: "009830.KS", name: "한화솔루션" },
  "CJ제일제당": { symbol: "097950.KS", name: "CJ제일제당" },
  "고려아연": { symbol: "010130.KS", name: "고려아연" },
  "SK스퀘어": { symbol: "402340.KS", name: "SK스퀘어" },
  "카카오게임즈": { symbol: "293490.KQ", name: "카카오게임즈" },
  "현대모비스": { symbol: "012330.KS", name: "현대모비스" },
  "SK이노베이션": { symbol: "096770.KS", name: "SK이노베이션" },
  "삼성물산": { symbol: "028260.KS", name: "삼성물산" },
  "LG": { symbol: "003550.KS", name: "LG" },
  "SK": { symbol: "034730.KS", name: "SK" },
  "한국전력": { symbol: "015760.KS", name: "한국전력" },
  "한전": { symbol: "015760.KS", name: "한국전력" },
  "삼성화재": { symbol: "000810.KS", name: "삼성화재" },
  "현대건설": { symbol: "000720.KS", name: "현대건설" },
  "삼성중공업": { symbol: "010140.KS", name: "삼성중공업" },
  "대한항공": { symbol: "003490.KS", name: "대한항공" },
  "SK바이오팜": { symbol: "326030.KS", name: "SK바이오팜" },
  "두산밥캣": { symbol: "241560.KS", name: "두산밥캣" },
  // English aliases
  "samsung": { symbol: "005930.KS", name: "삼성전자" },
  "sk hynix": { symbol: "000660.KS", name: "SK하이닉스" },
  "hynix": { symbol: "000660.KS", name: "SK하이닉스" },
  "hyundai": { symbol: "005380.KS", name: "현대자동차" },
  "kia": { symbol: "000270.KS", name: "기아" },
  "celltrion": { symbol: "068270.KS", name: "셀트리온" },
  "naver": { symbol: "035420.KS", name: "NAVER" },
  "kakao": { symbol: "035720.KS", name: "카카오" },
  "posco": { symbol: "005490.KS", name: "POSCO홀딩스" },
  "nc": { symbol: "036570.KQ", name: "엔씨소프트" },
  "ncsoft": { symbol: "036570.KQ", name: "엔씨소프트" },
  "nc소프트": { symbol: "036570.KQ", name: "엔씨소프트" },
  "netmarble": { symbol: "251270.KS", name: "넷마블" },
  "krafton": { symbol: "259960.KS", name: "크래프톤" },
  "pearl abyss": { symbol: "263750.KQ", name: "펄어비스" },
  "hive": { symbol: "352820.KS", name: "하이브" },
  "coupang": { symbol: "CPNG", name: "쿠팡" },
  "ecopro": { symbol: "086520.KQ", name: "에코프로" },
  "kepco": { symbol: "015760.KS", name: "한국전력" },
  "hanwha": { symbol: "012450.KS", name: "한화에어로스페이스" },
  "korean air": { symbol: "003490.KS", name: "대한항공" },
  "kb": { symbol: "105560.KS", name: "KB금융" },
  "shinhan": { symbol: "055550.KS", name: "신한지주" },
  "lg전자": { symbol: "066570.KS", name: "LG전자" },
  "lg화학": { symbol: "051910.KS", name: "LG화학" },
  "lg": { symbol: "003550.KS", name: "LG" },
  "sk": { symbol: "034730.KS", name: "SK" },
  "kt": { symbol: "030200.KS", name: "KT" },
  "cj": { symbol: "097950.KS", name: "CJ제일제당" },
  "hd현대": { symbol: "267250.KS", name: "HD현대" },
};

/**
 * 한글 → { symbol, name } 매핑.
 * 정확히 매핑되면 바로 symbol 반환, 부분 매칭이면 복수 결과,
 * 영문이면 그대로 반환.
 */
function resolveSearchQuery(query: string): { directSymbols: { symbol: string; name: string }[] } | { yahooQuery: string } {
  const q = query.trim();
  const qLower = q.toLowerCase();

  // 정확 매핑 (대소문자 무시)
  const exact = KR_SEARCH_MAP[q] || KR_SEARCH_MAP[qLower] || KR_SEARCH_MAP[q.toUpperCase()];
  if (exact) return { directSymbols: [exact] };

  // 부분 매핑: 입력에 포함되거나, 이름에 입력이 포함 (대소문자 무시)
  const partials = Object.entries(KR_SEARCH_MAP)
    .filter(([k]) => k.toLowerCase().includes(qLower) || qLower.includes(k.toLowerCase()))
    .map(([, v]) => v);
  // 중복 제거 (symbol 기준)
  const unique = [...new Map(partials.map(p => [p.symbol, p])).values()];
  if (unique.length > 0) return { directSymbols: unique.slice(0, 5) };

  // 숫자 종목코드 입력 (예: 036570, 005930) → .KS, .KQ 모두 시도
  if (/^\d{6}$/.test(q)) {
    // KR_NAMES에서 이름 찾기
    const nameKS = KR_NAMES[`${q}.KS`] || KR_UNIVERSE_NAMES[`${q}.KS`];
    const nameKQ = KR_NAMES[`${q}.KQ`] || KR_UNIVERSE_NAMES[`${q}.KQ`];
    const candidates: { symbol: string; name: string }[] = [];
    candidates.push({ symbol: `${q}.KS`, name: nameKS || q });
    candidates.push({ symbol: `${q}.KQ`, name: nameKQ || q });
    return { directSymbols: candidates };
  }

  // 영문이면 Yahoo Search에 전달
  return { yahooQuery: q };
}

const perspectives = [
  { id: "aggressive" as const, label: "공격", icon: Zap, color: "#EF4444", desc: "고성장·고변동성·모멘텀" },
  { id: "neutral" as const, label: "중립", icon: TrendingUp, color: "#EAB308", desc: "밸류+퀄리티·균형" },
  { id: "conservative" as const, label: "보수", icon: Shield, color: "#3B82F6", desc: "저변동·고배당·안정" },
] as const;

const valColor = (v: string) => v === "저평가" ? "text-primary" : v === "고평가" ? "text-destructive" : "text-muted-foreground";

const recBadge = (r: "strong" | "normal" | "avoid") => {
  if (r === "strong") return { text: "추천", bg: "bg-primary/15 text-primary border-primary/30", icon: "🔥" };
  if (r === "normal") return { text: "보통", bg: "bg-amber-500/15 text-amber-500 border-amber-500/30", icon: "👀" };
  return { text: "비추천", bg: "bg-destructive/15 text-destructive border-destructive/30", icon: "⚠️" };
};

function AIResultPanel({ result, loading, error, onClose }: {
  result: AIAnalysis | null; loading: boolean; error: string; onClose: () => void;
}) {
  return (
    <div className="bg-card border-x border-b border-primary/20 rounded-b-xl px-4 py-4 -mt-1 space-y-3">
      {loading && (
        <div className="flex items-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary mr-2" />
          <span className="text-xs text-muted-foreground">AI 분석 중 (뉴스+차트+재무 종합)...</span>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {result && (
        <>
          {/* 핵심 상단: Verdict + 진입/목표/손절 */}
          {result.verdict && (
            <div className={`rounded-lg p-3 ${
              result.action?.includes("매수") ? "bg-primary/10 border border-primary/20" :
              result.action?.includes("매도") ? "bg-destructive/10 border border-destructive/20" :
              "bg-muted/30 border border-border"
            }`}>
              <p className={`text-sm font-bold mb-2 ${
                result.action?.includes("매수") ? "text-primary" :
                result.action?.includes("매도") ? "text-destructive" : "text-muted-foreground"
              }`}>{result.verdict}</p>

              {/* 상승/하락 확률 바 */}
              {(result.bullProb || result.bearProb) && (() => {
                const bull = parseInt(result.bullProb) || 50;
                const bear = parseInt(result.bearProb) || 50;
                return (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-primary font-bold">상승 {bull}%</span>
                      {result.confidence && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          result.confidence.includes("높") ? "bg-primary/10 text-primary" :
                          result.confidence.includes("낮") ? "bg-destructive/10 text-destructive" :
                          "bg-amber-500/10 text-amber-500"
                        }`}>
                          {"신뢰도 "}{result.confidence}
                        </span>
                      )}
                      <span className="text-destructive font-bold">하락 {bear}%</span>
                    </div>
                    <div className="flex h-2.5 rounded-full overflow-hidden">
                      <div className="bg-primary transition-all" style={{ width: `${bull}%` }} />
                      <div className="bg-destructive transition-all" style={{ width: `${bear}%` }} />
                    </div>
                    {Math.abs(bull - bear) <= 10 && (
                      <p className="text-[9px] text-amber-500 mt-1">{"확률 차이 "}{Math.abs(bull - bear)}%p - 방향성 불분명, 관망 권장</p>
                    )}
                  </div>
                );
              })()}

              {(result.entry || result.target || result.stopLoss) && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {result.entry && (
                    <div className="text-center bg-background/50 rounded-lg py-2">
                      <p className="text-[9px] text-muted-foreground">진입가</p>
                      <p className="text-sm font-mono font-bold text-blue-400">{result.entry}</p>
                    </div>
                  )}
                  {result.target && (
                    <div className="text-center bg-background/50 rounded-lg py-2">
                      <p className="text-[9px] text-muted-foreground">목표가</p>
                      <p className="text-sm font-mono font-bold text-primary">{result.target}</p>
                      {result.reward && <p className="text-[9px] font-mono text-primary">{result.reward}</p>}
                    </div>
                  )}
                  {result.stopLoss && (
                    <div className="text-center bg-background/50 rounded-lg py-2">
                      <p className="text-[9px] text-muted-foreground">손절가</p>
                      <p className="text-sm font-mono font-bold text-destructive">{result.stopLoss}</p>
                      {result.riskPct && <p className="text-[9px] font-mono text-destructive">{result.riskPct}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 근거 섹션 */}
          {result.summary && (
            <div>
              <p className="text-[10px] text-muted-foreground font-bold mb-1">Investment Thesis</p>
              {result.summary.includes("[") ? (
                <div className="space-y-2">
                  {result.summary.split(/\[/).filter(Boolean).map((section, i) => {
                    const [title, ...content] = section.split("]");
                    const text = content.join("]").trim();
                    if (!text) return null;
                    const colors = ["text-blue-400", "text-amber-400", "text-primary"];
                    return (
                      <div key={i}>
                        <span className={`text-[10px] font-bold ${colors[i] || "text-muted-foreground"}`}>{title.trim()}</span>
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">{text}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">{result.summary}</p>
              )}
            </div>
          )}
          {result.prediction && (
            <div className="bg-blue-500/5 rounded-lg p-2.5">
              <p className="text-[10px] text-blue-400 font-bold mb-1">Price Target & Outlook</p>
              <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{result.prediction}</p>
            </div>
          )}
          {result.strategy && (
            <div className="bg-muted/30 rounded-lg p-2.5">
              <p className="text-[10px] text-muted-foreground font-bold mb-1">Trading Strategy</p>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">{result.strategy}</p>
            </div>
          )}
          {result.risk && (
            <div className="bg-destructive/5 rounded-lg p-2.5">
              <p className="text-[10px] text-destructive font-bold mb-1">Risk Factors</p>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">{result.risk}</p>
            </div>
          )}
        </>
      )}
      <button onClick={onClose} className="text-[10px] text-muted-foreground hover:text-foreground">닫기</button>
    </div>
  );
}

function MetricBadge({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  if (value == null) return null;
  return (
    <span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded">
      {label} {value}{unit || ""}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Backtest Simulation
// ---------------------------------------------------------------------------

interface SimResult {
  period: string;
  stocks: { symbol: string; name: string; startPrice: number; endPrice: number; returnPct: number }[];
  portfolioReturn: number;
  benchmark: number;
  benchmarkName: string;
}

async function runSimulation(allStocks: StockData[], period: string): Promise<SimResult> {
  const isKr = allStocks.length > 0 && allStocks[0].currency === "KRW";
  const benchmarkSymbol = isKr ? "069500.KS" : "SPY";

  const rangeMap: Record<string, string> = {
    "1mo": "3mo", "3mo": "6mo", "6mo": "1y", "1y": "2y", "3y": "5y", "5y": "max",
  };
  const range = rangeMap[period] || "1y";
  const targetDays: Record<string, number> = {
    "1mo": 22, "3mo": 66, "6mo": 132, "1y": 252, "3y": 756, "5y": 1260,
  };
  const simDays = targetDays[period] || 252;

  // 한투 API 또는 Yahoo로 히스토리 가져오기
  type HistData = { closes: number[]; volumes: number[] };
  const histCache: Record<string, HistData | null> = {};
  const kisAppkey = localStorage.getItem("sophia-api-kis-appkey") || "";
  const kisSecret = localStorage.getItem("sophia-api-kis-secret") || "";

  const fetchHist = async (symbol: string): Promise<HistData | null> => {
    if (histCache[symbol] !== undefined) return histCache[symbol];

    // 한투 API (국장)
    if (kisAppkey && kisSecret && (symbol.endsWith(".KS") || symbol.endsWith(".KQ"))) {
      try {
        const code = symbol.replace(".KS", "").replace(".KQ", "");
        const now = new Date();
        const end = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
        const pastDate = new Date(now);
        pastDate.setDate(pastDate.getDate() - (simDays * 2)); // 넉넉하게
        const start = `${pastDate.getFullYear()}${String(pastDate.getMonth() + 1).padStart(2, "0")}${String(pastDate.getDate()).padStart(2, "0")}`;

        const data = await proxyFetch<{ output2?: Array<Record<string, string>> }>(
          "kis-daily-price", { appkey: kisAppkey, appsecret: kisSecret, code, start, end }
        );
        if (data) {
          const output = (data.output2 || []) as Array<Record<string, string>>;
          if (output.length > 10) {
            // KIS는 최신→과거 순이라 reverse
            const reversed = [...output].reverse();
            const closes = reversed.map((r) => parseInt(r.stck_clpr) || 0).filter((v) => v > 0);
            const volumes = reversed.map((r) => parseInt(r.acml_vol) || 0);
            const h = { closes, volumes };
            histCache[symbol] = h;
            return h;
          }
        }
      } catch { /* fallback to Yahoo */ }
    }

    // Yahoo fallback
    try {
      const data = await proxyFetch<{
        chart?: { result?: Array<{ indicators?: { quote?: Array<{ close?: number[]; volume?: number[] }> } }> };
      }>("yahoo-historical", { symbol, range });
      if (!data) { histCache[symbol] = null; return null; }
      const result = data?.chart?.result?.[0];
      if (!result) { histCache[symbol] = null; return null; }
      const closes = (result.indicators?.quote?.[0]?.close || []).filter((v: number | null) => v != null) as number[];
      const volumes = (result.indicators?.quote?.[0]?.volume || []).filter((v: number | null) => v != null) as number[];
      const h = { closes, volumes };
      histCache[symbol] = h;
      return h;
    } catch { histCache[symbol] = null; return null; }
  };

  // 각 종목의 과거 시점 기술적 지표 계산
  interface PastScore {
    symbol: string; name: string; score: number;
    pastPrice: number; nowPrice: number; currency: string;
    momentum3m: number; volatility: number; rsi: number; maSignal: string;
  }
  const pastScores: PastScore[] = [];

  for (const stock of allStocks) {
    const hist = await fetchHist(stock.symbol);
    if (!hist || hist.closes.length < simDays + 20) continue;

    const total = hist.closes.length;
    const entryIdx = total - simDays; // 과거 진입 시점
    const pastPrice = hist.closes[entryIdx];
    const nowPrice = hist.closes[total - 1];
    if (!pastPrice || pastPrice <= 0) continue;

    // 과거 시점 기준 지표 계산 (entryIdx 시점)
    const pastSlice = hist.closes.slice(0, entryIdx + 1);

    // 1. 모멘텀: 진입 시점 기준 3개월 수익률
    const mom3mIdx = Math.max(0, entryIdx - 66);
    const momentum3m = pastSlice[mom3mIdx] > 0 ? ((pastPrice - pastSlice[mom3mIdx]) / pastSlice[mom3mIdx]) * 100 : 0;

    // 2. 변동성: 20일 일간 수익률 표준편차
    const returns20 = pastSlice.slice(-21).map((c, i, a) => i > 0 ? (c - a[i - 1]) / a[i - 1] : 0).slice(1);
    const mean20 = returns20.reduce((s, r) => s + r, 0) / (returns20.length || 1);
    const volatility = Math.sqrt(returns20.reduce((s, r) => s + (r - mean20) ** 2, 0) / (returns20.length || 1)) * 100;

    // 3. RSI (14일)
    const rsiSlice = pastSlice.slice(-15);
    let gains = 0, losses = 0;
    for (let i = 1; i < rsiSlice.length; i++) {
      const diff = rsiSlice[i] - rsiSlice[i - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const avgGain = gains / 14, avgLoss = losses / 14;
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

    // 4. 이동평균 시그널
    const ma20 = pastSlice.slice(-20).reduce((s, c) => s + c, 0) / 20;
    const ma60 = pastSlice.length >= 60 ? pastSlice.slice(-60).reduce((s, c) => s + c, 0) / 60 : ma20;
    const maSignal = pastPrice > ma20 && ma20 > ma60 ? "정배열" : pastPrice < ma20 && ma20 < ma60 ? "역배열" : "혼조";

    // 종합 점수: 모멘텀 + 저변동성 + RSI 적정 + 정배열
    let score = 0;
    if (momentum3m > 10) score += 3; else if (momentum3m > 0) score += 1; else score -= 1;
    if (volatility < 2) score += 2; else if (volatility < 3) score += 1; else score -= 1;
    if (rsi >= 30 && rsi <= 70) score += 1; // 과매수/과매도 아닌 구간
    if (rsi < 30) score += 2; // 과매도 = 매수 기회
    if (maSignal === "정배열") score += 2; else if (maSignal === "역배열") score -= 2;

    pastScores.push({
      symbol: stock.symbol, name: stock.name, score,
      pastPrice: Math.round(pastPrice), nowPrice: Math.round(nowPrice),
      currency: stock.currency,
      momentum3m: Math.round(momentum3m * 10) / 10,
      volatility: Math.round(volatility * 100) / 100,
      rsi: Math.round(rsi), maSignal,
    });
  }

  // 점수 상위 10개 = 그 시점에 추천했을 종목
  const top10 = pastScores.sort((a, b) => b.score - a.score).slice(0, 10);

  const results: SimResult["stocks"] = top10.map((s) => ({
    symbol: s.symbol, name: s.name,
    startPrice: s.pastPrice, endPrice: s.nowPrice,
    returnPct: Math.round(((s.nowPrice - s.pastPrice) / s.pastPrice) * 1000) / 10,
  }));

  const avgReturn = results.length > 0 ? results.reduce((s, r) => s + r.returnPct, 0) / results.length : 0;

  let benchmark = 0;
  const benchHist = await fetchHist(benchmarkSymbol);
  if (benchHist && benchHist.closes.length > simDays) {
    const bStart = benchHist.closes[benchHist.closes.length - simDays];
    const bEnd = benchHist.closes[benchHist.closes.length - 1];
    if (bStart > 0) benchmark = Math.round(((bEnd - bStart) / bStart) * 1000) / 10;
  }

  const periodLabel: Record<string, string> = {
    "1mo": "1개월", "3mo": "3개월", "6mo": "6개월", "1y": "1년", "3y": "3년", "5y": "5년",
  };

  return {
    period: periodLabel[period] || period,
    stocks: results.sort((a, b) => b.returnPct - a.returnPct),
    portfolioReturn: Math.round(avgReturn * 10) / 10,
    benchmark,
    benchmarkName: isKr ? "KODEX 200" : "SPY (S&P 500)",
  };
}

const QuantRecommendView = () => {
  const { isGuest } = useGuestMode();
  const [market, setMarket] = useState<"us" | "kr">("us");
  const [activePerspective, setActivePerspective] = useState<"aggressive" | "neutral" | "conservative">("aggressive");
  // 미장/국장 각각 캐시
  const [stocksUs, setStocksUs] = useState<StockData[]>(() => {
    try { const c = localStorage.getItem("sophia-quant-us"); if (c) { const d = JSON.parse(c); if (Date.now() - d.t < 6*3600000 && d.d?.length) return d.d; } } catch {} return [];
  });
  const [stocksKr, setStocksKr] = useState<StockData[]>(() => {
    try { const c = localStorage.getItem("sophia-quant-kr"); if (c) { const d = JSON.parse(c); if (Date.now() - d.t < 6*3600000 && d.d?.length) return d.d; } } catch {} return [];
  });
  const stocks = market === "us" ? stocksUs : stocksKr;
  const setStocks = (data: StockData[]) => {
    if (market === "us") setStocksUs(data); else setStocksKr(data);
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [aiResult, setAiResult] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // 스크리닝 필터
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({
    perMax: "50",
    roeMin: "",
    betaMax: "",
    revenueGrowthMin: "",
    debtMax: "",
  });

  // 시뮬레이션
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simPeriod, setSimPeriod] = useState("1y");

  const handleSimulation = useCallback(async (period: string) => {
    setSimPeriod(period);
    setSimLoading(true);
    try {
      // 시뮬레이션은 필터 무관하게 전체 유니버스에서
      const fullUniverse = await fetchStocks(market);
      const result = await runSimulation(fullUniverse, period);
      setSimResult(result);
    } catch { setSimResult(null); }
    setSimLoading(false);
  }, [market]);

  // 종목 검색
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockData[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError("");
    setStocks([]);
    setSelectedStock(null);
    try {
      let data = await fetchStocks(market);

      // 사용자 필터 적용
      const perMax = parseFloat(filters.perMax) || Infinity;
      const roeMin = parseFloat(filters.roeMin) || -Infinity;
      const betaMax = parseFloat(filters.betaMax) || Infinity;
      const growthMin = parseFloat(filters.revenueGrowthMin) || -Infinity;
      const debtMax = parseFloat(filters.debtMax) || Infinity;

      data = data.filter((s) => {
        if (s.pe != null && s.pe > perMax) return false;
        if (s.pe != null && s.pe <= 0) return false; // 적자 제외
        if (s.roe != null && s.roe < roeMin) return false;
        if (s.beta != null && s.beta > betaMax) return false;
        if (s.revenueGrowth != null && s.revenueGrowth < growthMin) return false;
        if (s.debtToEquity != null && s.debtToEquity > debtMax) return false;
        return true;
      });

      // 필터 후 재분류
      data = applyRelativeClassification(data);
      setStocks(data);
      try { localStorage.setItem(market === "us" ? "sophia-quant-us" : "sophia-quant-kr", JSON.stringify({ d: data, t: Date.now() })); } catch { /* */ }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, [market, filters]);

  // 수동 로드: 미장/국장 버튼 클릭 시에만 fetch

  // 종목 검색: 한글→직접 매핑 or Yahoo Search → fundamentals fetch → classify
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query || query.length < 2) { setSearchResults([]); return; }

    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const resolved = resolveSearchQuery(query);
        let symbolsToFetch: { symbol: string; name: string }[] = [];

        if ("directSymbols" in resolved) {
          // 한글 매핑 성공 → 바로 fundamentals (Yahoo Search 스킵)
          symbolsToFetch = resolved.directSymbols;
        } else {
          // 영문 → Yahoo Search
          const searchRes = await proxyFetch<{ quotes?: Array<Record<string, string>> }>(
            "yahoo-search", { q: resolved.yahooQuery }
          ) || { quotes: [] };

          symbolsToFetch = (searchRes?.quotes || [])
            .filter((q: Record<string, string>) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF"))
            .slice(0, 5)
            .map(q => ({ symbol: q.symbol!, name: q.shortname || q.longname || q.symbol! }));
        }

        if (symbolsToFetch.length === 0) { setSearchResults([]); setSearchLoading(false); return; }

        // Fundamentals fetch
        const results: StockData[] = [];
        for (const sym of symbolsToFetch) {
          try {
            const q = await proxyFetch<Record<string, unknown>>(
              "fundamentals", { symbol: sym.symbol }
            );
            if (!q || !q.price) continue;
            const change = q.changePercent != null
              ? Math.round((q.changePercent as number) * 100) / 100
              : (() => { const prev = (q.previousClose as number) || (q.price as number); return prev > 0 ? Math.round((((q.price as number) - prev) / prev) * 1000) / 10 : 0; })();
            const classified = classifyStock({
              pe: q.pe as number | null, pb: q.pb as number | null, roe: q.roe as number | null, beta: q.beta as number | null,
              change, revenueGrowth: q.revenueGrowth as number | null, dividendYield: q.dividendYield as number | null,
              debtToEquity: q.debtToEquity as number | null,
            });
            results.push({
              symbol: sym.symbol, name: sym.name,
              price: q.price as number, change,
              currency: (q.currency as string) || "USD",
              pe: q.pe ? Math.round((q.pe as number) * 10) / 10 : null,
              pb: q.pb ? Math.round((q.pb as number) * 100) / 100 : null,
              roe: q.roe ? Math.round((q.roe as number) * 1000) / 10 : null,
              beta: q.beta ? Math.round((q.beta as number) * 100) / 100 : null,
              dividendYield: q.dividendYield ? Math.round((q.dividendYield as number) * 1000) / 10 : null,
              revenueGrowth: q.revenueGrowth ? Math.round((q.revenueGrowth as number) * 1000) / 10 : null,
              debtToEquity: q.debtToEquity ? Math.round((q.debtToEquity as number) * 10) / 10 : null,
              ...classified,
            });
          } catch { /* skip */ }
        }
        setSearchResults(results);
      } catch { setSearchResults([]); }
      setSearchLoading(false);
    }, 600);
  }, []);

  const handleAIAnalyze = useCallback(async (stock: StockData) => {
    // 같은 종목 클릭 → 토글
    if (selectedStock?.symbol === stock.symbol) {
      setSelectedStock(null);
      setAiResult(null);
      return;
    }
    // 새 종목
    setAiResult(null);
    setAiError("");
    setSelectedStock(stock);
    setAiLoading(true);
    try {
      const result = await analyzeStock(stock, market === "us" ? "미국" : "한국");
      setAiResult(result);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "분석 실패");
    } finally {
      setAiLoading(false);
    }
  }, [market, selectedStock]);

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
        <Lock className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">비공개 콘텐츠입니다</p>
      </div>
    );
  }

  // 전체 순위 (recScore 기준)
  const allRanked = [...stocks].sort((a, b) => b.recScore - a.recScore);
  const rankMap = new Map(allRanked.map((s, i) => [s.symbol, i + 1]));
  const filteredStocks = stocks.filter((s) => s.category === activePerspective).sort((a, b) => b.recScore - a.recScore);
  const perspective = perspectives.find((p) => p.id === activePerspective)!;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">퀀트 스크리닝</h3>
          <span className="text-[9px] text-muted-foreground">
            {isKisConfigured() ? "한국투자증권 API 연동" : "Yahoo Finance (한투 API 미연동)"}
          </span>
        </div>
        <div className="flex gap-2">
          {(["us", "kr"] as const).map((m) => (
            <button key={m} onClick={() => { setMarket(m); setSelectedStock(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${market === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {m === "us" ? "미장" : "국장"}
            </button>
          ))}
          <button onClick={() => setShowFilter(!showFilter)}
            className={`px-2 py-1.5 rounded-lg text-xs transition-colors ${showFilter ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            필터
          </button>
          <button onClick={handleFetch} disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {stocks.length > 0 ? "재분석" : "스크리닝"}
          </button>
        </div>
      </div>

      {/* 필터 패널 */}
      <AnimatePresence>
        {showFilter && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-card rounded-xl p-4 space-y-3 border border-amber-500/20">
              <p className="text-xs font-bold">스크리닝 필터</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">PER 최대</label>
                  <input type="number" value={filters.perMax} onChange={(e) => setFilters({ ...filters, perMax: e.target.value })}
                    placeholder="30" className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">ROE 최소(%)</label>
                  <input type="number" value={filters.roeMin} onChange={(e) => setFilters({ ...filters, roeMin: e.target.value })}
                    placeholder="5" className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">Beta 최대</label>
                  <input type="number" value={filters.betaMax} onChange={(e) => setFilters({ ...filters, betaMax: e.target.value })}
                    placeholder="제한없음" className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">매출성장 최소(%)</label>
                  <input type="number" value={filters.revenueGrowthMin} onChange={(e) => setFilters({ ...filters, revenueGrowthMin: e.target.value })}
                    placeholder="제한없음" className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">부채비율 최대(%)</label>
                  <input type="number" value={filters.debtMax} onChange={(e) => setFilters({ ...filters, debtMax: e.target.value })}
                    placeholder="200" className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30" />
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground">{"필터 설정 후 '스크리닝' 클릭. 적자기업(PER≤0) 자동 제외."}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 종목 검색 */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="종목 검색 (삼성전자, 펄어비스, AAPL, Tesla)"
            className="w-full bg-card border border-border rounded-lg pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        {searchLoading && (
          <div className="flex items-center gap-2 mt-2 px-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">검색 중...</span>
          </div>
        )}
        {searchResults.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-mono px-1">검색 결과 ({searchResults.length})</p>
            {searchResults.map((stock) => {
              const isSelected = selectedStock?.symbol === stock.symbol;
              return (
                <div key={stock.symbol}>
                  <motion.button onClick={() => handleAIAnalyze(stock)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      isSelected ? "bg-card border border-primary/30" : "bg-card/50 hover:bg-card"
                    }`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="text-sm font-medium truncate">{stock.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{stock.symbol}</span>
                        <span className={`text-[9px] font-bold ${valColor(stock.valuation)}`}>{stock.valuation}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${recBadge(stock.recommendation).bg}`}>
                          {recBadge(stock.recommendation).icon} {recBadge(stock.recommendation).text}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-mono">
                          {stock.currency === "USD" ? `$${stock.price.toLocaleString()}` : `${formatKRW(stock.price)}원`}
                        </span>
                        <span className={`text-[10px] font-mono ${stock.change >= 0 ? "text-primary" : "text-destructive"}`}>
                          {stock.change >= 0 ? "+" : ""}{stock.change}%
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <MetricBadge label="PER" value={stock.pe} />
                      <MetricBadge label="PBR" value={stock.pb} />
                      <MetricBadge label="ROE" value={stock.roe} unit="%" />
                      <MetricBadge label="베타" value={stock.beta} />
                      <MetricBadge label="배당" value={stock.dividendYield} unit="%" />
                      <MetricBadge label="매출성장" value={stock.revenueGrowth} unit="%" />
                    </div>
                  </motion.button>
                  {/* AI 분석 인라인 */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <AIResultPanel result={aiResult} loading={aiLoading} error={aiError} onClose={() => { setSelectedStock(null); setAiResult(null); }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">재무 데이터 수집 중... (약 15초)</span>
        </div>
      )}
      {error && <p className="text-sm text-destructive text-center py-4">{error}</p>}

      {stocks.length > 0 && (
        <>
          {/* Perspective tabs */}
          <div className="flex gap-2">
            {perspectives.map((p) => {
              const Icon = p.icon;
              const count = stocks.filter((s) => s.category === p.id).length;
              return (
                <button key={p.id} onClick={() => { setActivePerspective(p.id); setSelectedStock(null); setAiResult(null); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all flex flex-col items-center gap-0.5 ${
                    activePerspective === p.id ? "bg-card border-2 shadow-sm" : "bg-muted/30 text-muted-foreground"
                  }`} style={activePerspective === p.id ? { borderColor: p.color } : {}}>
                  <div className="flex items-center gap-1">
                    <Icon className="h-3.5 w-3.5" style={activePerspective === p.id ? { color: p.color } : {}} />
                    <span style={activePerspective === p.id ? { color: p.color } : {}}>{p.label} ({count})</span>
                  </div>
                  <span className="text-[8px] text-muted-foreground">{p.desc}</span>
                </button>
              );
            })}
          </div>

          {/* Stock list */}
          <div className="space-y-1.5">
            {filteredStocks.map((stock) => {
              const isSelected = selectedStock?.symbol === stock.symbol;
              const rank = rankMap.get(stock.symbol) || 999;
              return (
                <div key={stock.symbol}>
                  <motion.button onClick={() => handleAIAnalyze(stock)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${rank <= 3 ? "border-l-2 border-yellow-500/50" : ""} ${
                      isSelected ? "bg-card border border-primary/30" : "bg-card/50 hover:bg-card"
                    }`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        {rank <= 10 && (
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${rank <= 3 ? "bg-yellow-500/20 text-yellow-500" : "bg-primary/10 text-primary"}`}>
                            {rank <= 3 ? ["🥇","🥈","🥉"][rank-1] : `${rank}위`}
                          </span>
                        )}
                        <span className="text-sm font-medium truncate">{stock.name}</span>
                        <span className={`text-[9px] font-bold ${valColor(stock.valuation)}`}>{stock.valuation}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${recBadge(stock.recommendation).bg}`}>
                          {recBadge(stock.recommendation).icon} {recBadge(stock.recommendation).text}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-mono">
                          {stock.currency === "USD" ? `$${stock.price.toLocaleString()}` : `${formatKRW(stock.price)}원`}
                        </span>
                        <span className={`text-[10px] font-mono ${stock.change >= 0 ? "text-primary" : "text-destructive"}`}>
                          {stock.change >= 0 ? "+" : ""}{stock.change}%
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <MetricBadge label="PER" value={stock.pe} />
                      <MetricBadge label="PBR" value={stock.pb} />
                      <MetricBadge label="ROE" value={stock.roe} unit="%" />
                      <MetricBadge label="베타" value={stock.beta} />
                      <MetricBadge label="배당" value={stock.dividendYield} unit="%" />
                      <MetricBadge label="매출성장" value={stock.revenueGrowth} unit="%" />
                    </div>
                  </motion.button>

                  {/* AI 분석 결과 인라인 */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <AIResultPanel result={aiResult} loading={aiLoading} error={aiError} onClose={() => { setSelectedStock(null); setAiResult(null); }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <p className="text-[9px] text-muted-foreground text-center">
            {"PER↓ = 저평가 · ROE↑ = 수익성좋음 · 종목 클릭 → AI 분석"}
          </p>

          {/* 백테스팅 시뮬레이션 */}
          <div className="bg-card rounded-xl p-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-primary" />
                포트폴리오 시뮬레이션
              </h4>
              <div className="flex gap-1">
                {(["1mo" as const, "3mo" as const, "6mo" as const, "1y" as const, "3y" as const]).map((p) => (
                  <button key={p} onClick={() => handleSimulation(p as "1y" | "3y" | "5y")} disabled={simLoading}
                    className={`px-2 py-1 text-[10px] rounded-lg font-medium transition-colors ${
                      simPeriod === p && simResult ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}>
                    {p === "1mo" ? "1개월" : p === "3mo" ? "3개월" : p === "6mo" ? "6개월" : p === "1y" ? "1년" : "3년"}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[9px] text-muted-foreground mb-3">{"전략 검증: 과거 시점 기술적 지표(모멘텀/RSI/MA/변동성)로 추천했을 종목을 그때 매수 → 현재가 비교"}</p>

            {simLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-primary mr-2" />
                <span className="text-xs text-muted-foreground">과거 데이터 분석 중...</span>
              </div>
            )}

            {simResult && !simLoading && (() => {
              const investAmount = 1000000; // 100만원
              const perStock = investAmount / simResult.stocks.length;
              const totalNow = simResult.stocks.reduce((s, r) => s + perStock * (1 + r.returnPct / 100), 0);
              const totalReturn = totalNow - investAmount;
              const winners = simResult.stocks.filter((s) => s.returnPct > 0);
              const losers = simResult.stocks.filter((s) => s.returnPct <= 0);

              return (
                <div className="space-y-3">
                  {/* 100만원 투자 결과 */}
                  <div className={`rounded-xl p-4 text-center ${totalReturn >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                    <p className="text-[10px] text-muted-foreground">100만원 투자 → {simResult.period} 후</p>
                    <p className={`text-2xl font-mono font-bold ${totalReturn >= 0 ? "text-primary" : "text-destructive"}`}>
                      {Math.round(totalNow).toLocaleString()}원
                    </p>
                    <p className={`text-sm font-mono ${totalReturn >= 0 ? "text-primary" : "text-destructive"}`}>
                      {totalReturn >= 0 ? "+" : ""}{Math.round(totalReturn).toLocaleString()}원 ({simResult.portfolioReturn >= 0 ? "+" : ""}{simResult.portfolioReturn}%)
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-1">
                      {simResult.stocks.length}종목 동일비중 · 종목당 {Math.round(perStock).toLocaleString()}원
                    </p>
                  </div>

                  {/* 승/패 요약 */}
                  <div className="flex gap-2">
                    <div className="flex-1 bg-primary/5 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-primary font-bold">수익 {winners.length}종목</p>
                    </div>
                    <div className="flex-1 bg-destructive/5 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-destructive font-bold">손실 {losers.length}종목</p>
                    </div>
                  </div>

                  {/* 종목별 상세 */}
                  <div className="space-y-1.5">
                    {simResult.stocks.map((s, i) => {
                      const profit = Math.round(perStock * (s.returnPct / 100));
                      const rankColors = ["text-yellow-500", "text-gray-400", "text-amber-600"];
                      const rankBg = i < 3 ? "border-l-2 border-yellow-500/50" : "";
                      return (
                        <div key={s.symbol} className={`rounded-lg px-3 py-2 ${s.returnPct >= 0 ? "bg-card" : "bg-destructive/5"} ${rankBg}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-xs font-bold w-6 text-center ${i < 3 ? rankColors[i] : "text-muted-foreground"}`}>
                                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                              </span>
                              <span className="text-xs font-medium truncate">{s.name}</span>
                              <span className="text-[8px] font-mono text-muted-foreground">{s.symbol}</span>
                              {i < 3 && <span className="text-[8px] px-1 py-0.5 rounded bg-primary/10 text-primary font-bold">강력추천</span>}
                              {i >= 3 && i < 7 && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold">추천</span>}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-xs font-mono font-bold ${s.returnPct >= 0 ? "text-primary" : "text-destructive"}`}>
                                {profit >= 0 ? "+" : ""}{profit.toLocaleString()}원
                              </span>
                              <span className={`text-[10px] font-mono ${s.returnPct >= 0 ? "text-primary" : "text-destructive"}`}>
                                {s.returnPct >= 0 ? "+" : ""}{s.returnPct}%
                              </span>
                            </div>
                          </div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            {s.startPrice.toLocaleString()} → {s.endPrice.toLocaleString()}
                          </div>
                          {s.returnPct <= -10 && (
                            <p className="text-[9px] text-destructive mt-1">{"⚠ 대폭 하락 - 과거 추천이었으나 실적 악화/섹터 약세로 손실"}</p>
                          )}
                          {s.returnPct >= 50 && (
                            <p className="text-[9px] text-primary mt-1">{"✓ 전략 적중 - 기술적 시그널이 유효했음"}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[8px] text-muted-foreground text-center">
                    {"과거 수익률은 미래 수익을 보장하지 않습니다. 과거 PER 추정 기반 시뮬레이션."}
                  </p>
                </div>
              );
            })()}

            {!simResult && !simLoading && (
              <p className="text-xs text-muted-foreground text-center py-4">기간을 선택하면 백테스팅 결과를 보여줍니다</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default QuantRecommendView;
