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
// Fear & Greed Index (alternative.me - crypto)
// ---------------------------------------------------------------------------

async function fetchFearGreed() {
  const res = await fetch("https://api.alternative.me/fng/?limit=1", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" },
  });
  if (!res.ok) throw new Error(`Fear & Greed ${res.status}`);
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
        const data = await fetchFearGreed();
        return res.status(200).json(data);
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
