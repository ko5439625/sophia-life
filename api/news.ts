import type { VercelRequest, VercelResponse } from "@vercel/node";

interface RssItem {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
}

function extractCDATA(text: string): string {
  const match = text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return match ? match[1].trim() : text.trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);
    const descMatch = block.match(/<description>([\s\S]*?)<\/description>/);
    const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);

    const rawTitle = titleMatch ? extractCDATA(titleMatch[1]) : "";
    const rawDesc = descMatch ? extractCDATA(descMatch[1]) : "";

    items.push({
      title: stripHtml(rawTitle),
      description: stripHtml(rawDesc),
      source: sourceMatch ? extractCDATA(sourceMatch[1]) : "Google News",
      url: linkMatch ? linkMatch[1].trim() : "",
      publishedAt: pubDateMatch
        ? new Date(pubDateMatch[1].trim()).toISOString()
        : new Date().toISOString(),
    });
  }

  return items;
}

const CATEGORY_QUERIES: Record<string, string> = {
  business: "경제 OR 증시 OR 금리",
  general: "사회 OR 정치 OR 국내",
  crypto: "비트코인 OR 암호화폐 OR 이더리움",
  us: "economy OR market OR Fed",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const category = (req.query.category as string) || "business";
  const country = (req.query.country as string) || "kr";

  const isUS = country === "us" || category === "us";
  const query = CATEGORY_QUERIES[category] || CATEGORY_QUERIES.business;
  const hl = isUS ? "en" : "ko";
  const gl = isUS ? "US" : "KR";
  const ceid = isUS ? "US:en" : "KR:ko";

  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

  try {
    const response = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Google News RSS returned ${response.status}`,
      });
    }

    const xml = await response.text();
    const articles = parseRss(xml).slice(0, 50);

    return res.status(200).json({
      status: "ok",
      totalResults: articles.length,
      articles,
      source: "google-news-rss",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch Google News RSS",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
