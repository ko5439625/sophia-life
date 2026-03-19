import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, TrendingUp, Shield, Zap, RefreshCw, Lock, X, ChevronRight, Search } from "lucide-react";
import { useGuestMode } from "../../../hooks/useGuestMode";
import { formatKRW } from "./budgetData";
import { isKisConfigured } from "../../../services/kisApi";

// ---------------------------------------------------------------------------
// Stock Universe
// ---------------------------------------------------------------------------

const US_STOCKS = [
  "AAPL", "NVDA", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "LLY", "JPM",
  "V", "UNH", "MA", "COST", "HD", "NFLX", "CRM", "AMD", "ORCL", "ADBE",
  "PEP", "KO", "MRK", "ABBV", "TMO", "ACN", "MCD", "CSCO", "LIN", "DHR",
];
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
  if (s.change > 2) aggScore += 2;
  else if (s.change > 0) aggScore += 1;
  else if (s.change < -2) conScore += 2;
  else conScore += 1;
  if (s.revenueGrowth != null) {
    if (s.revenueGrowth > 0.2) aggScore += 2;
    else if (s.revenueGrowth > 0.05) aggScore += 1;
    else conScore += 1;
  }
  if (s.dividendYield != null && s.dividendYield > 0.02) conScore += 2;
  if (s.roe != null && s.roe > 0.2) aggScore += 1;

  let valuation = "적정";
  if (s.pe != null) {
    if (s.pe < 12) valuation = "저평가";
    else if (s.pe > 35) valuation = "고평가";
  }
  if (s.pb != null) {
    if (s.pb < 1.0 && valuation !== "고평가") valuation = "저평가";
    else if (s.pb > 5.0) valuation = "고평가";
  }

  const diff = aggScore - conScore;
  let category: "aggressive" | "neutral" | "conservative";
  if (diff >= 3) category = "aggressive";
  else if (diff <= -3) category = "conservative";
  else category = "neutral";
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
// Fetch
// ---------------------------------------------------------------------------

async function fetchStocks(market: "us" | "kr"): Promise<StockData[]> {
  const symbols = market === "us" ? US_STOCKS : KR_STOCKS;
  const results: StockData[] = [];

  // Batch fetch fundamentals (5 at a time to avoid rate limit)
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5);
    try {
      const res = await fetch(`/api/market?service=batch-fundamentals&symbols=${batch.join(",")}`);
      if (!res.ok) {
        // Fallback to basic quote
        const res2 = await fetch(`/api/market?service=batch-quote&symbols=${batch.join(",")}`);
        if (res2.ok) {
          const data2 = await res2.json();
          for (const sym of batch) {
            const q = data2[sym];
            if (!q) continue;
            const prev = q.previousClose || q.price;
            const change = prev > 0 ? ((q.price - prev) / prev) * 100 : 0;
            const classified = classifyStock({ pe: null, pb: null, roe: null, beta: null, change, revenueGrowth: null, dividendYield: null });
            results.push({
              symbol: sym, name: market === "kr" ? (KR_NAMES[sym] || sym) : sym,
              price: q.price, change: Math.round(change * 100) / 100,
              currency: q.currency || (market === "us" ? "USD" : "KRW"),
              pe: null, pb: null, roe: null, beta: null, dividendYield: null, revenueGrowth: null, debtToEquity: null,
              ...classified,
            });
          }
        }
        continue;
      }
      const data = await res.json();
      for (const sym of batch) {
        const q = data[sym];
        if (!q) continue;
        const prev = q.previousClose || q.price;
        const change = prev > 0 ? ((q.price - prev) / prev) * 100 : 0;
        const classified = classifyStock({
          pe: q.pe, pb: q.pb, roe: q.roe, beta: q.beta,
          change, revenueGrowth: q.revenueGrowth, dividendYield: q.dividendYield,
          debtToEquity: q.debtToEquity,
        });
        results.push({
          symbol: sym, name: market === "kr" ? (KR_NAMES[sym] || sym) : sym,
          price: q.price || 0, change: Math.round(change * 100) / 100,
          currency: q.currency || (market === "us" ? "USD" : "KRW"),
          pe: q.pe ? Math.round(q.pe * 10) / 10 : null,
          pb: q.pb ? Math.round(q.pb * 100) / 100 : null,
          roe: q.roe ? Math.round(q.roe * 1000) / 10 : null,
          beta: q.beta ? Math.round(q.beta * 100) / 100 : null,
          dividendYield: q.dividendYield ? Math.round(q.dividendYield * 1000) / 10 : null,
          revenueGrowth: q.revenueGrowth ? Math.round(q.revenueGrowth * 1000) / 10 : null,
          debtToEquity: q.debtToEquity ? Math.round(q.debtToEquity * 10) / 10 : null,
          ...classified,
        });
      }
    } catch { /* skip */ }
  }

  return results.sort((a, b) => b.score - a.score);
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
      fetch(`/api/market?service=stock-news&q=${encodeURIComponent(newsQ)}`),
      fetch(`/api/market?service=historical&symbol=${encodeURIComponent(stock.symbol)}&range=3mo`),
    ]);

    // 뉴스
    if (newsRes.status === "fulfilled" && newsRes.value.ok) {
      const newsData = await newsRes.value.json();
      const articles = (newsData.articles || []) as string[];
      if (articles.length > 0) {
        newsContext = `\n\nRECENT NEWS:\n${articles.slice(0, 6).map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
      }
    }

    // 가격 히스토리 → 기술적 분석용 요약
    if (histRes.status === "fulfilled" && histRes.value.ok) {
      const histData = await histRes.value.json();
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
  "strategy": "진입가(지지선/MA 근거). 목표가. 손절가(이 가격 아래로 떨어지면 왜 위험한지 구체적 이유). 포지션 비중과 기간",
  "risk": "리스크 1(확률/영향도). 리스크 2. 리스크 3. 이 종목을 사면 안 되는 최악의 시나리오"
}`;

  const prompt2 = prompt;

  const res = await fetch(
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
  if (!res.ok) throw new Error(`API 오류 (${res.status})`);
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

// 한글 → 종목코드 매핑 (Yahoo는 한글 검색 불가)
const KR_SEARCH_MAP: Record<string, string> = {
  "삼성전자": "005930", "SK하이닉스": "000660", "LG에너지솔루션": "373220",
  "삼성바이오": "207940", "현대차": "005380", "기아": "000270",
  "셀트리온": "068270", "네이버": "035420", "카카오": "035720",
  "POSCO홀딩스": "005490", "삼성SDI": "006400", "LG화학": "051910",
  "한화에어로": "012450", "한화오션": "042660", "LG전자": "066570",
  "두산에너빌": "034020", "HD현대중공업": "329180", "크래프톤": "259960",
  "엔씨소프트": "036570", "펄어비스": "263750", "넷마블": "251270",
  "신한지주": "055550", "KB금융": "105560", "하이브": "352820",
  "쿠팡": "CPNG", "에코프로": "086520", "에코프로비엠": "247540",
  "한미반도체": "042700", "카카오뱅크": "323410", "포스코퓨처엠": "003670",
  "HD현대일렉트릭": "267260", "HD현대중공업": "329180", "HD현대": "267250",
  "현대글로비스": "086280", "삼성전기": "009150", "삼성생명": "032830",
  "LG이노텍": "011070", "SK텔레콤": "017670", "KT": "030200",
  "두산퓨얼셀": "336260", "한화솔루션": "009830", "CJ제일제당": "097950",
  "고려아연": "010130", "SK스퀘어": "402340", "카카오게임즈": "293490",
};

function resolveSearchQuery(query: string): string {
  const q = query.trim();
  const mapped = KR_SEARCH_MAP[q];
  if (mapped) return mapped;
  const partial = Object.entries(KR_SEARCH_MAP).find(([k]) => k.includes(q));
  if (partial) return partial[1];
  return q; // 영문이면 그대로
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

const QuantRecommendView = () => {
  const { isGuest } = useGuestMode();
  const [market, setMarket] = useState<"us" | "kr">("us");
  const [activePerspective, setActivePerspective] = useState<"aggressive" | "neutral" | "conservative">("aggressive");
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [aiResult, setAiResult] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

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
      const data = await fetchStocks(market);
      setStocks(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, [market]);

  // 수동 로드: 미장/국장 버튼 클릭 시에만 fetch

  // 종목 검색: Yahoo Search → fundamentals fetch → classify
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query || query.length < 2) { setSearchResults([]); return; }

    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        // 1. 한글→종목코드 변환 후 Vercel 프록시 경유 Yahoo Search
        const resolved = resolveSearchQuery(query);
        const searchResp = await fetch(`/api/market?service=yahoo-search&q=${encodeURIComponent(resolved)}`);
        const searchRes = searchResp.ok ? await searchResp.json() : { quotes: [] };

        const symbols = (searchRes?.quotes || [])
          .filter((q: Record<string, string>) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF"))
          .slice(0, 5);

        if (symbols.length === 0) { setSearchResults([]); setSearchLoading(false); return; }

        // 2. Fundamentals fetch
        const results: StockData[] = [];
        for (const sym of symbols) {
          try {
            const res = await fetch(`/api/market?service=fundamentals&symbol=${sym.symbol}`);
            if (!res.ok) continue;
            const q = await res.json();
            if (!q.price) continue;
            const change = q.changePercent != null
              ? Math.round(q.changePercent * 100) / 100
              : (() => { const prev = q.previousClose || q.price; return prev > 0 ? Math.round(((q.price - prev) / prev) * 1000) / 10 : 0; })();
            const classified = classifyStock({
              pe: q.pe, pb: q.pb, roe: q.roe, beta: q.beta,
              change, revenueGrowth: q.revenueGrowth, dividendYield: q.dividendYield,
              debtToEquity: q.debtToEquity,
            });
            results.push({
              symbol: sym.symbol!, name: sym.shortname || sym.longname || sym.symbol!,
              price: q.price, change,
              currency: q.currency || "USD",
              pe: q.pe ? Math.round(q.pe * 10) / 10 : null,
              pb: q.pb ? Math.round(q.pb * 100) / 100 : null,
              roe: q.roe ? Math.round(q.roe * 1000) / 10 : null,
              beta: q.beta ? Math.round(q.beta * 100) / 100 : null,
              dividendYield: q.dividendYield ? Math.round(q.dividendYield * 1000) / 10 : null,
              revenueGrowth: q.revenueGrowth ? Math.round(q.revenueGrowth * 1000) / 10 : null,
              debtToEquity: q.debtToEquity ? Math.round(q.debtToEquity * 10) / 10 : null,
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
            <button key={m} onClick={() => { setMarket(m); setStocks([]); setSelectedStock(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${market === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {m === "us" ? "미장" : "국장"}
            </button>
          ))}
          <button onClick={handleFetch} disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {stocks.length > 0 ? "재분석" : "스크리닝"}
          </button>
        </div>
      </div>

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
              return (
                <div key={stock.symbol}>
                  <motion.button onClick={() => handleAIAnalyze(stock)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      isSelected ? "bg-card border border-primary/30" : "bg-card/50 hover:bg-card"
                    }`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: perspective.color }} />
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
        </>
      )}
    </div>
  );
};

export default QuantRecommendView;
