import type { VercelRequest, VercelResponse } from "@vercel/node";

// ---------------------------------------------------------------------------
// Yahoo Finance quote
// ---------------------------------------------------------------------------

async function fetchYahooQuote(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" },
  });
  if (!res.ok) throw new Error(`Yahoo quote ${res.status}`);
  return await res.json();
}

// ---------------------------------------------------------------------------
// Yahoo Finance historical
// ---------------------------------------------------------------------------

async function fetchYahooHistorical(symbol: string, range: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" },
  });
  if (!res.ok) throw new Error(`Yahoo historical ${res.status}`);
  return await res.json();
}

// ---------------------------------------------------------------------------
// Fear & Greed Index - Crypto (alternative.me)
// ---------------------------------------------------------------------------

async function fetchFearGreedCrypto() {
  const res = await fetch("https://api.alternative.me/fng/?limit=1", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" },
  });
  if (!res.ok) throw new Error(`Crypto Fear & Greed ${res.status}`);
  return await res.json();
}

// ---------------------------------------------------------------------------
// Fear & Greed Index - US Market (CNN)
// ---------------------------------------------------------------------------

async function fetchFearGreedCNN() {
  // CNN requires browser-like headers
  const res = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://edition.cnn.com/markets/fear-and-greed",
      "Origin": "https://edition.cnn.com",
    },
  });
  if (!res.ok) throw new Error(`CNN Fear & Greed ${res.status}`);
  return await res.json();
}

// ---------------------------------------------------------------------------
// Yahoo Finance fundamentals (with crumb auth)
// ---------------------------------------------------------------------------

async function fetchYahooFundamentals(symbol: string) {
  // Step 1: Get crumb + cookie
  const cookieRes = await fetch("https://fc.yahoo.com/", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" },
    redirect: "manual",
  });
  const cookies = cookieRes.headers.get("set-cookie") || "";

  const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)",
      "Cookie": cookies,
    },
  });
  const crumb = await crumbRes.text();

  // Step 2: Fetch fundamentals
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics,financialData,price&crumb=${encodeURIComponent(crumb)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)",
      "Cookie": cookies,
    },
  });
  if (!res.ok) throw new Error(`Yahoo fundamentals ${res.status}`);
  return await res.json();
}

// ---------------------------------------------------------------------------
// Exchange rate (open.er-api)
// ---------------------------------------------------------------------------

async function fetchExchangeRate(from: string) {
  const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" },
  });
  if (!res.ok) throw new Error(`Exchange rate ${res.status}`);
  return await res.json();
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  if (req.method === "OPTIONS") return res.status(200).end();

  const service = req.query.service as string;

  try {
    switch (service) {
      case "quote": {
        const symbol = req.query.symbol as string;
        if (!symbol) return res.status(400).json({ error: "symbol required" });
        const data = await fetchYahooQuote(symbol);
        return res.status(200).json(data);
      }

      case "historical": {
        const symbol = req.query.symbol as string;
        const range = (req.query.range as string) || "1y";
        if (!symbol) return res.status(400).json({ error: "symbol required" });
        const data = await fetchYahooHistorical(symbol, range);
        return res.status(200).json(data);
      }

      case "fear-greed": {
        const data = await fetchFearGreedCrypto();
        return res.status(200).json(data);
      }

      case "fear-greed-cnn": {
        const data = await fetchFearGreedCNN();
        return res.status(200).json(data);
      }

      case "kospi-volatility": {
        // KOSPI 5일 데이터로 변동성 계산
        const data = await fetchYahooHistorical("^KS11", "5d");
        return res.status(200).json(data);
      }

      case "fundamentals": {
        const symbol = req.query.symbol as string;
        if (!symbol) return res.status(400).json({ error: "symbol required" });
        const data = await fetchYahooFundamentals(symbol);
        const result = data?.quoteSummary?.result?.[0];
        if (!result) return res.status(200).json({});
        const ks = result.defaultKeyStatistics || {};
        const fd = result.financialData || {};
        const pr = result.price || {};
        return res.status(200).json({
          symbol,
          price: pr.regularMarketPrice?.raw,
          previousClose: pr.regularMarketPreviousClose?.raw,
          change: pr.regularMarketChange?.raw,
          changePercent: pr.regularMarketChangePercent?.raw,
          marketCap: pr.marketCap?.raw,
          pe: ks.trailingPE?.raw ?? ks.forwardPE?.raw,
          pb: ks.priceToBook?.raw,
          roe: fd.returnOnEquity?.raw,
          debtToEquity: fd.debtToEquity?.raw,
          revenueGrowth: fd.revenueGrowth?.raw,
          profitMargin: fd.profitMargins?.raw ?? ks.profitMargins?.raw,
          fiftyTwoWeekHigh: ks.fiftyTwoWeekHigh?.raw ?? ks["52WeekChange"]?.raw,
          fiftyTwoWeekLow: ks.fiftyTwoWeekLow?.raw,
          beta: ks.beta?.raw,
          dividendYield: ks.dividendYield?.raw ?? ks.trailingAnnualDividendYield?.raw,
          currency: pr.currency,
        });
      }

      case "batch-fundamentals": {
        const symbols = (req.query.symbols as string) || "";
        if (!symbols) return res.status(400).json({ error: "symbols required" });
        const list = symbols.split(",").slice(0, 15);
        const results: Record<string, unknown> = {};
        // Sequential to avoid rate limit
        for (const sym of list) {
          try {
            const data = await fetchYahooFundamentals(sym.trim());
            const result = data?.quoteSummary?.result?.[0];
            if (!result) continue;
            const ks = result.defaultKeyStatistics || {};
            const fd = result.financialData || {};
            const pr = result.price || {};
            results[sym.trim()] = {
              price: pr.regularMarketPrice?.raw,
              pe: ks.trailingPE?.raw ?? ks.forwardPE?.raw,
              pb: ks.priceToBook?.raw,
              roe: fd.returnOnEquity?.raw,
              debtToEquity: fd.debtToEquity?.raw,
              revenueGrowth: fd.revenueGrowth?.raw,
              profitMargin: fd.profitMargins?.raw ?? ks.profitMargins?.raw,
              beta: ks.beta?.raw,
              dividendYield: ks.dividendYield?.raw,
              marketCap: pr.marketCap?.raw,
              currency: pr.currency,
              previousClose: pr.regularMarketPreviousClose?.raw,
            };
          } catch { /* skip */ }
        }
        return res.status(200).json(results);
      }

      case "stock-news": {
        const symbol = req.query.symbol as string;
        const query = req.query.q as string || symbol;
        if (!query) return res.status(400).json({ error: "symbol or q required" });
        // Google News RSS - 헤드라인 + 요약 본문
        const newsRes = await fetch(
          `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`,
          { headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" } }
        );
        if (!newsRes.ok) return res.status(200).json({ articles: [] });
        const xml = await newsRes.text();

        // Parse <item> blocks: title + description + pubDate
        const items: { title: string; desc: string; date: string }[] = [];
        const itemRe = /<item>([\s\S]*?)<\/item>/g;
        let im;
        while ((im = itemRe.exec(xml)) !== null) {
          const block = im[1];
          const getTag = (tag: string) => {
            const r = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`);
            return r.exec(block)?.[1]?.trim() || "";
          };
          const title = getTag("title");
          const descRaw = getTag("description");
          // description에서 HTML 태그 제거
          const desc = descRaw.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
          const date = getTag("pubDate");
          if (title && title !== "Google 뉴스") {
            items.push({ title, desc: desc.slice(0, 200), date });
          }
        }

        // 날짜순 정렬 (최신 먼저) + 상위 8개
        const articles = items.slice(0, 8).map((item) => {
          const dateStr = item.date ? new Date(item.date).toLocaleDateString("ko-KR") : "";
          return `[${dateStr}] ${item.title}${item.desc ? ` - ${item.desc}` : ""}`;
        });

        return res.status(200).json({ articles });
      }

      case "yahoo-search": {
        const query = req.query.q as string;
        if (!query) return res.status(400).json({ error: "q required" });
        const searchRes = await fetch(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`,
          { headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" } }
        );
        if (!searchRes.ok) return res.status(200).json({ quotes: [] });
        const searchData = await searchRes.json();
        return res.status(200).json(searchData);
      }

      case "batch-quote": {
        // 여러 종목 한번에 조회
        const symbols = (req.query.symbols as string) || "";
        if (!symbols) return res.status(400).json({ error: "symbols required" });
        const list = symbols.split(",").slice(0, 30); // 최대 30개
        const results: Record<string, unknown> = {};
        await Promise.allSettled(
          list.map(async (sym) => {
            try {
              const data = await fetchYahooQuote(sym.trim());
              const meta = data?.chart?.result?.[0]?.meta;
              if (meta) {
                results[sym.trim()] = {
                  price: meta.regularMarketPrice,
                  previousClose: meta.chartPreviousClose || meta.previousClose,
                  currency: meta.currency,
                  symbol: meta.symbol,
                };
              }
            } catch { /* skip failed */ }
          })
        );
        return res.status(200).json(results);
      }

      case "exchange-rate": {
        const from = (req.query.from as string) || "USD";
        const data = await fetchExchangeRate(from);
        return res.status(200).json(data);
      }

      default:
        return res.status(400).json({ error: `Unknown service: ${service}` });
    }
  } catch (error) {
    return res.status(500).json({
      error: "Market API failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
