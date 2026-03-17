// NOTE: Some APIs require a backend proxy to avoid CORS. For development, use mock data.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketData {
  fearGreedIndex: number;
  sp500Change: number;
  nasdaqChange: number;
  kospiChange: number;
  usdKrw: number;
  usdKrwChange: number;
  bondYield10Y?: number;
  vix?: number;
}

export interface HedgingAnalysis {
  riskLevel: "low" | "medium" | "high" | "critical";
  summary: string;
  strategies: {
    action: string;
    reason: string;
    allocation: number; // percentage
  }[];
  marketOutlook: string;
}

export interface EconomicIndicators {
  gdpGrowth?: number;
  inflation?: number;
  unemployment?: number;
  interestRate?: number;
  tradeBalance?: number;
  consumerConfidence?: number;
  pmi?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function getApiKey(): string | null {
  return localStorage.getItem("sophia-api-gemini");
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No Gemini API key");

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ---------------------------------------------------------------------------
// Real API functions
// ---------------------------------------------------------------------------

async function realAnalyzeHedging(
  marketData: MarketData,
): Promise<HedgingAnalysis> {
  const prompt = `당신은 한국 시장에 특화된 금융 헤징 전략 전문가입니다. 아래 시장 데이터와 한국 특수 요인을 종합 분석하고 JSON 형태로 헤징 전략을 제시해주세요.

시장 데이터:
- Fear & Greed Index: ${marketData.fearGreedIndex}
- S&P500 변동: ${marketData.sp500Change}%
- NASDAQ 변동: ${marketData.nasdaqChange}%
- KOSPI 변동: ${marketData.kospiChange}%
- USD/KRW: ${marketData.usdKrw} (변동: ${marketData.usdKrwChange}%)
${marketData.bondYield10Y != null ? `- 미국 10년물 국채 수익률: ${marketData.bondYield10Y}%` : ""}
${marketData.vix != null ? `- VIX: ${marketData.vix}` : ""}

한국 특수 요인 (반드시 분석에 반영):
- 부동산 가격 동향: 서울 아파트 거래량 증가 추세, 전세/매매 비율 변화
- 규제 리스크: 가상자산 과세, 공매도 규제, 부동산 대출 규제 강화 가능성
- 환율 영향: 원/달러 환율이 수출기업 실적 및 외국인 투자 흐름에 미치는 영향
- 금리 정책: 한국은행 기준금리 동결/인하 가능성, 미국 금리와의 격차
- 가계부채 수준: GDP 대비 가계부채 비율이 세계 최고 수준, 금리 민감도 높음

분석 시 자산 상관관계 패턴도 고려해주세요:
- 금리 인상기: 주식/채권/부동산 동반 하락, 현금 선호
- 부동산 급등기: 주식 약세, 가계부채 증가 → 소비 위축
- 규제 충격: 단기 급락 후 회복, 자산별 영향도 상이

다음 JSON 형식으로만 응답하세요 (설명 없이, 모든 텍스트는 한국어로):
{
  "riskLevel": "low" | "medium" | "high" | "critical",
  "summary": "한줄 요약 (한국 시장 상황 반영)",
  "strategies": [
    { "action": "구체적 전략", "reason": "한국 시장 맥락의 이유", "allocation": 비율(숫자) }
  ],
  "marketOutlook": "한국 시장 중심의 향후 3개월 전망 (부동산, 환율, 금리 포함)"
}`;

  const text = await callGemini(prompt);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse Gemini response as JSON");
  return JSON.parse(jsonMatch[0]) as HedgingAnalysis;
}

async function realAnalyzeEconomy(
  indicators: EconomicIndicators,
): Promise<string> {
  const parts: string[] = [];
  if (indicators.gdpGrowth != null) parts.push(`GDP 성장률: ${indicators.gdpGrowth}%`);
  if (indicators.inflation != null) parts.push(`인플레이션: ${indicators.inflation}%`);
  if (indicators.unemployment != null) parts.push(`실업률: ${indicators.unemployment}%`);
  if (indicators.interestRate != null) parts.push(`기준금리: ${indicators.interestRate}%`);
  if (indicators.tradeBalance != null) parts.push(`무역수지: ${indicators.tradeBalance}억 달러`);
  if (indicators.consumerConfidence != null) parts.push(`소비자 신뢰지수: ${indicators.consumerConfidence}`);
  if (indicators.pmi != null) parts.push(`PMI: ${indicators.pmi}`);

  const prompt = `당신은 경제 분석 전문가입니다. 아래 경제 지표를 분석하고 한국어로 3-5문장의 경제 상황 분석을 제공하세요.

경제 지표:
${parts.join("\n")}

간결하고 명확하게 현재 경제 상황과 향후 전망을 분석해주세요.`;

  return await callGemini(prompt);
}

async function realTranslateText(
  text: string,
  from: string,
  to: string,
): Promise<string> {
  const prompt = `Translate the following text from ${from} to ${to}. Return ONLY the translated text, nothing else.

${text}`;

  return await callGemini(prompt);
}

// ---------------------------------------------------------------------------
// Mock functions
// ---------------------------------------------------------------------------

function mockAnalyzeHedging(_marketData: MarketData): HedgingAnalysis {
  return {
    riskLevel: "medium",
    summary: "시장 변동성 증가로 방어적 포지션 강화 권장",
    strategies: [
      { action: "주식 비중 축소 (60% → 45%)", reason: "변동성 확대 구간", allocation: 45 },
      { action: "채권 비중 확대 (20% → 30%)", reason: "안전자산 선호 증가", allocation: 30 },
      { action: "금/원자재 비중 유지", reason: "인플레이션 헤지", allocation: 15 },
      { action: "현금 비중 확대", reason: "저가 매수 기회 대비", allocation: 10 },
    ],
    marketOutlook:
      "단기적으로 변동성이 확대될 가능성이 높으며, 주요 경제지표 발표에 따라 방향성이 결정될 전망입니다. 방어적 자산 배분을 유지하되, 과도한 하락 시 분할 매수 전략을 고려하세요.",
  };
}

function mockAnalyzeEconomy(_indicators: EconomicIndicators): string {
  return "현재 경제는 완만한 성장세를 보이고 있으나, 인플레이션 압력이 지속되고 있습니다. 중앙은행의 금리 정책이 핵심 변수로 작용하고 있으며, 소비자 심리는 안정적인 수준을 유지하고 있습니다. 제조업 PMI가 확장 구간을 유지하고 있어 실물 경제의 기초 체력은 양호한 것으로 판단됩니다. 다만 글로벌 무역 불확실성과 지정학적 리스크에 대한 모니터링이 필요합니다.";
}

function mockTranslateText(text: string, _from: string, to: string): string {
  if (to === "ko" || to === "Korean") {
    return `[번역] ${text}`;
  }
  return `[Translated] ${text}`;
}

// ---------------------------------------------------------------------------
// News summary
// ---------------------------------------------------------------------------

export interface NewsSummary {
  headline: string;
  sections: { category: string; summary: string }[];
  keyTakeaway: string;
}

async function realSummarizeNews(
  articles: { title: string; category: string; source: string }[],
): Promise<NewsSummary> {
  const grouped: Record<string, string[]> = {};
  for (const a of articles) {
    if (!grouped[a.category]) grouped[a.category] = [];
    grouped[a.category].push(`[${a.source}] ${a.title}`);
  }

  const sections = Object.entries(grouped)
    .map(([cat, titles]) => `## ${cat}\n${titles.slice(0, 15).join("\n")}`)
    .join("\n\n");

  const prompt = `당신은 뉴스 브리핑 전문가입니다. 아래 오늘의 뉴스 헤드라인들을 분석해서 핵심 이슈를 요약해주세요.
미국 뉴스는 한국어로 번역해서 요약하세요.

${sections}

다음 JSON 형식으로만 응답하세요 (설명 없이, 모든 텍스트는 한국어로):
{
  "headline": "오늘의 핵심 이슈 한 줄 요약",
  "sections": [
    { "category": "카테고리명", "summary": "해당 카테고리 주요 이슈 2-3줄 요약" }
  ],
  "keyTakeaway": "전체적으로 주목할 포인트 1-2문장"
}`;

  const text = await callGemini(prompt);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse Gemini news summary");
  return JSON.parse(jsonMatch[0]) as NewsSummary;
}

// ---------------------------------------------------------------------------
// Unified exports (try real API, fall back to mock)
// ---------------------------------------------------------------------------

export async function analyzeHedging(
  marketData: MarketData,
): Promise<HedgingAnalysis> {
  try {
    if (!getApiKey()) return mockAnalyzeHedging(marketData);
    return await realAnalyzeHedging(marketData);
  } catch (e) {
    console.warn("Gemini analyzeHedging failed, using mock:", e);
    return mockAnalyzeHedging(marketData);
  }
}

export async function analyzeEconomy(
  indicators: EconomicIndicators,
): Promise<string> {
  try {
    if (!getApiKey()) return mockAnalyzeEconomy(indicators);
    return await realAnalyzeEconomy(indicators);
  } catch (e) {
    console.warn("Gemini analyzeEconomy failed, using mock:", e);
    return mockAnalyzeEconomy(indicators);
  }
}

export async function summarizeNews(
  articles: { title: string; category: string; source: string }[],
): Promise<NewsSummary> {
  if (!getApiKey()) throw new Error("No Gemini API key");
  return await realSummarizeNews(articles);
}

export async function translateText(
  text: string,
  from: string,
  to: string,
): Promise<string> {
  try {
    if (!getApiKey()) return mockTranslateText(text, from, to);
    return await realTranslateText(text, from, to);
  } catch (e) {
    console.warn("Gemini translateText failed, using mock:", e);
    return mockTranslateText(text, from, to);
  }
}
