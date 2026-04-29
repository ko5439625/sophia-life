// Supabase Edge Function: API Proxy
// CORS 차단되는 외부 API를 서버에서 대신 호출해줌
//
// 배포: supabase functions deploy api-proxy --project-ref atjmxzdlhshdplhvnens
// 호출: POST https://atjmxzdlhshdplhvnens.supabase.co/functions/v1/api-proxy

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Safe JSON fetch - returns parsed JSON or error object, never throws on non-ok */
async function safeFetchJson(url: string, options?: RequestInit): Promise<{ data: unknown; ok: boolean; status: number }> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { data: { error: `HTTP ${res.status}`, message: text }, ok: false, status: res.status };
  }
  const data = await res.json();
  return { data, ok: true, status: res.status };
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { service, params } = await req.json();

    let data: unknown;

    switch (service) {
      // ====== Yahoo Finance ======
      case "yahoo-quote": {
        const { symbol } = params;
        // Try query1 first, fallback to query2, then cookie+crumb method
        let result = await safeFetchJson(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
        );
        if (!result.ok) {
          result = await safeFetchJson(
            `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
          );
        }
        if (!result.ok) {
          // Fallback: cookie+crumb method via quoteSummary → convert to chart format
          try {
            const ckRes = await fetch("https://fc.yahoo.com/", {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" },
              redirect: "manual",
            });
            const ck = ckRes.headers.get("set-cookie") || "";
            const crRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)", "Cookie": ck },
            });
            const cr = await crRes.text();
            const qRes = await fetch(
              `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price&crumb=${encodeURIComponent(cr)}`,
              { headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)", "Cookie": ck } }
            );
            if (qRes.ok) {
              const qd = await qRes.json();
              const pr = qd?.quoteSummary?.result?.[0]?.price || {};
              // Convert to chart format that parseQuoteFromChart expects
              data = {
                chart: {
                  result: [{
                    meta: {
                      symbol,
                      regularMarketPrice: pr.regularMarketPrice?.raw,
                      chartPreviousClose: pr.regularMarketPreviousClose?.raw,
                      previousClose: pr.regularMarketPreviousClose?.raw,
                      currency: pr.currency,
                      shortName: pr.shortName,
                    }
                  }]
                }
              };
              break;
            }
          } catch { /* all methods failed */ }
          return new Response(JSON.stringify(result.data), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        data = result.data;
        break;
      }

      case "yahoo-historical": {
        const { symbol, range } = params;
        let result = await safeFetchJson(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range || "1y"}`
        );
        if (!result.ok) {
          result = await safeFetchJson(
            `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range || "1y"}`
          );
        }
        if (!result.ok) {
          // Fallback: cookie+crumb chart method
          try {
            const ckRes = await fetch("https://fc.yahoo.com/", {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" },
              redirect: "manual",
            });
            const ck = ckRes.headers.get("set-cookie") || "";
            const crRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)", "Cookie": ck },
            });
            const cr = await crRes.text();
            const hRes = await fetch(
              `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range || "1y"}&crumb=${encodeURIComponent(cr)}`,
              { headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)", "Cookie": ck } }
            );
            if (hRes.ok) {
              data = await hRes.json();
              break;
            }
          } catch { /* all methods failed */ }
          return new Response(JSON.stringify(result.data), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        data = result.data;
        break;
      }

      case "yahoo-news": {
        const { query } = params;
        const result = await safeFetchJson(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query || "economy")}&newsCount=10`
        );
        if (!result.ok) {
          return new Response(JSON.stringify(result.data), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        data = result.data;
        break;
      }

      // ====== Yahoo Finance Search (종목 검색) ======
      case "yahoo-search": {
        const query = params.query || params.q || "";
        const result = await safeFetchJson(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`
        );
        if (!result.ok) {
          return new Response(JSON.stringify(result.data), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        data = result.data;
        break;
      }

      // ====== NewsAPI ======
      case "news": {
        const { category, country, apiKey } = params;
        const url = new URL("https://newsapi.org/v2/top-headlines");
        url.searchParams.set("country", country || "kr");
        if (category) url.searchParams.set("category", category);
        url.searchParams.set("pageSize", "20");
        url.searchParams.set("apiKey", apiKey);
        const res = await fetch(url.toString());
        data = await res.json();
        break;
      }

      // ====== 국토교통부 실거래가 ======
      case "molit-trade": {
        const { regionCode, yearMonth, apiKey } = params;
        const url = new URL(
          "http://openapi.molit.go.kr/OpenAPI_ToolInstallPackage/service/rest/RTMSOBJSvc/getRTMSDataSvcAptTradeDev"
        );
        url.searchParams.set("serviceKey", apiKey);
        url.searchParams.set("LAWD_CD", regionCode || "11680");
        url.searchParams.set("DEAL_YMD", yearMonth || "202603");
        url.searchParams.set("numOfRows", "100");
        const res = await fetch(url.toString());
        const text = await res.text();
        data = { xml: text };
        break;
      }

      // ====== 청약홈 분양정보 ======
      case "subscription": {
        // 서버 환경변수 API 키 우선, 클라이언트 전달 키 fallback
        const serverKey = Deno.env.get("DATA_GO_KR_API_KEY") || "";
        const clientKey = params.apiKey as string || "";
        const finalKey = serverKey || clientKey;
        if (!finalKey) {
          return new Response(
            JSON.stringify({ error: "No API key configured", data: [] }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { page } = params;
        const url = new URL(
          "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail"
        );
        url.searchParams.set("serviceKey", finalKey);
        url.searchParams.set("page", String(page || 1));
        url.searchParams.set("perPage", "30");
        const res = await fetch(url.toString());
        data = await res.json();
        break;
      }

      // ====== Alpha Vantage ======
      case "alpha-quote": {
        const { symbol, apiKey } = params;
        const res = await fetch(
          `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
        );
        data = await res.json();
        break;
      }

      // ====== OpenWeatherMap ======
      case "weather": {
        const { city, apiKey } = params;
        const cityEnc = encodeURIComponent(city || "Seoul");
        const [currentRes, forecastRes] = await Promise.allSettled([
          fetch(`https://api.openweathermap.org/data/2.5/weather?q=${cityEnc}&appid=${apiKey}&units=metric&lang=kr`),
          fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${cityEnc}&appid=${apiKey}&units=metric&lang=kr&cnt=8`),
        ]);
        const currentData = currentRes.status === "fulfilled" && currentRes.value.ok ? await currentRes.value.json() : {};
        // forecast에서 오늘 하루 최저/최고 계산
        let todayMin: number | undefined;
        let todayMax: number | undefined;
        if (forecastRes.status === "fulfilled" && forecastRes.value.ok) {
          const fc = await forecastRes.value.json();
          const todayStr = new Date().toISOString().slice(0, 10);
          const todayTemps = (fc.list || [])
            .filter((item: { dt_txt?: string }) => item.dt_txt?.startsWith(todayStr))
            .map((item: { main?: { temp_min?: number; temp_max?: number } }) => ({
              min: item.main?.temp_min ?? 999,
              max: item.main?.temp_max ?? -999,
            }));
          if (todayTemps.length > 0) {
            todayMin = Math.min(...todayTemps.map((t: { min: number }) => t.min));
            todayMax = Math.max(...todayTemps.map((t: { max: number }) => t.max));
          }
        }
        // main에 daily min/max 덮어쓰기
        if (currentData.main) {
          if (todayMin !== undefined) currentData.main.temp_min = todayMin;
          if (todayMax !== undefined) currentData.main.temp_max = todayMax;
        }
        data = currentData;
        break;
      }

      // ====== 카카오 Maps ======
      case "kakao-search": {
        const { query, apiKey } = params;
        const res = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=15`,
          { headers: { Authorization: `KakaoAK ${apiKey}` } }
        );
        data = await res.json();
        break;
      }

      // ====== Fear & Greed Index - Crypto (alternative.me) ======
      case "fear-greed": {
        const fgRes = await fetch("https://api.alternative.me/fng/?limit=1", {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" },
        });
        if (!fgRes.ok) {
          data = { data: [] };
        } else {
          data = await fgRes.json();
        }
        break;
      }

      // ====== Fear & Greed Index - CNN (US Market) ======
      case "fear-greed-cnn": {
        const cnnRes = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://edition.cnn.com/markets/fear-and-greed",
            "Origin": "https://edition.cnn.com",
          },
        });
        if (!cnnRes.ok) {
          data = { fear_and_greed: null };
        } else {
          data = await cnnRes.json();
        }
        break;
      }

      // ====== Exchange Rate (open.er-api) ======
      case "exchange-rate": {
        const { from } = params;
        const erRes = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from || "USD")}`, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" },
        });
        if (!erRes.ok) {
          data = { rates: {} };
        } else {
          data = await erRes.json();
        }
        break;
      }

      // ====== Google News RSS ======
      case "google-news": {
        const { category, country } = params;
        const CATEGORY_QUERIES: Record<string, string> = {
          business: "경제 OR 증시 OR 금리",
          general: "사회 OR 정치 OR 국내",
          crypto: "비트코인 OR 암호화폐 OR 이더리움",
          us: "economy OR market OR Fed",
        };
        const cat = category || "business";
        const ctry = country || "kr";
        const isUS = ctry === "us" || cat === "us";
        const query = CATEGORY_QUERIES[cat] || CATEGORY_QUERIES.business;
        const hl = isUS ? "en" : "ko";
        const gl = isUS ? "US" : "KR";
        const ceid = isUS ? "US:en" : "KR:ko";
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
        const newsRes = await fetch(rssUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" },
        });
        if (!newsRes.ok) {
          data = { status: "ok", totalResults: 0, articles: [] };
        } else {
          const xml = await newsRes.text();
          const articles: { title: string; description: string; source: string; url: string; publishedAt: string }[] = [];
          const itemRe = /<item>([\s\S]*?)<\/item>/g;
          let m;
          while ((m = itemRe.exec(xml)) !== null) {
            const block = m[1];
            const getTag = (tag: string) => {
              const r = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`);
              return r.exec(block)?.[1]?.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim() || "";
            };
            const title = getTag("title");
            const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || "";
            const pubDate = getTag("pubDate");
            const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "Google News";
            if (title && title !== "Google 뉴스") {
              articles.push({
                title,
                description: getTag("description").slice(0, 200),
                source,
                url: link,
                publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
              });
            }
          }
          data = { status: "ok", totalResults: articles.length, articles: articles.slice(0, 50), source: "google-news-rss" };
        }
        break;
      }

      // ====== Stock News (Google News RSS for specific stock) ======
      case "stock-news": {
        const { symbol, q } = params;
        const newsQuery = q || symbol || "";
        if (!newsQuery) { data = { articles: [] }; break; }
        const snRes = await fetch(
          `https://news.google.com/rss/search?q=${encodeURIComponent(newsQuery)}&hl=ko&gl=KR&ceid=KR:ko`,
          { headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" } }
        );
        if (!snRes.ok) { data = { articles: [] }; break; }
        const snXml = await snRes.text();
        const snItems: string[] = [];
        const snItemRe = /<item>([\s\S]*?)<\/item>/g;
        let snM;
        while ((snM = snItemRe.exec(snXml)) !== null) {
          const block = snM[1];
          const getTag = (tag: string) => {
            const r = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`);
            return r.exec(block)?.[1]?.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim() || "";
          };
          const title = getTag("title");
          const desc = getTag("description").slice(0, 200);
          const date = getTag("pubDate");
          if (title && title !== "Google 뉴스") {
            const dateStr = date ? new Date(date).toLocaleDateString("ko-KR") : "";
            snItems.push(`[${dateStr}] ${title}${desc ? ` - ${desc}` : ""}`);
          }
        }
        data = { articles: snItems.slice(0, 8) };
        break;
      }

      // ====== Yahoo Finance Fundamentals ======
      case "fundamentals": {
        const { symbol } = params;
        if (!symbol) { data = {}; break; }
        // Get crumb + cookie
        const cookieRes = await fetch("https://fc.yahoo.com/", {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" },
          redirect: "manual",
        });
        const cookies = cookieRes.headers.get("set-cookie") || "";
        const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)", "Cookie": cookies },
        });
        const crumb = await crumbRes.text();
        const fundUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics,financialData,price&crumb=${encodeURIComponent(crumb)}`;
        const fundRes = await fetch(fundUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)", "Cookie": cookies },
        });
        if (!fundRes.ok) { data = {}; break; }
        const fundData = await fundRes.json();
        const result = fundData?.quoteSummary?.result?.[0];
        if (!result) { data = {}; break; }
        const ks = result.defaultKeyStatistics || {};
        const fd = result.financialData || {};
        const pr = result.price || {};
        data = {
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
          beta: ks.beta?.raw,
          dividendYield: ks.dividendYield?.raw ?? ks.trailingAnnualDividendYield?.raw,
          currency: pr.currency,
        };
        break;
      }

      // ====== Batch Fundamentals (여러 종목 펀더멘털) ======
      case "batch-fundamentals": {
        const { symbols: bfSymbols } = params;
        if (!bfSymbols) { data = {}; break; }
        const bfList = (bfSymbols as string).split(",").slice(0, 10);
        const bfResults: Record<string, unknown> = {};
        // Get crumb + cookie once
        let bfCookies = "";
        let bfCrumb = "";
        try {
          const bfCookieRes = await fetch("https://fc.yahoo.com/", {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)" },
            redirect: "manual",
          });
          bfCookies = bfCookieRes.headers.get("set-cookie") || "";
          const bfCrumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)", "Cookie": bfCookies },
          });
          bfCrumb = await bfCrumbRes.text();
        } catch { /* proceed without crumb */ }

        const bfSettled = await Promise.allSettled(
          bfList.map(async (sym: string) => {
            const s = sym.trim();
            const fundUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(s)}?modules=defaultKeyStatistics,financialData,price&crumb=${encodeURIComponent(bfCrumb)}`;
            const fundRes = await fetch(fundUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; SophiaLife/1.0)", "Cookie": bfCookies },
            });
            if (!fundRes.ok) return;
            const fundData = await fundRes.json();
            const result = fundData?.quoteSummary?.result?.[0];
            if (!result) return;
            const ks = result.defaultKeyStatistics || {};
            const fd = result.financialData || {};
            const pr = result.price || {};
            bfResults[s] = {
              symbol: s,
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
              beta: ks.beta?.raw,
              dividendYield: ks.dividendYield?.raw ?? ks.trailingAnnualDividendYield?.raw,
              currency: pr.currency,
            };
          })
        );
        data = bfResults;
        break;
      }

      // ====== Batch Quote (여러 종목 한번에) ======
      case "batch-quote": {
        const { symbols } = params;
        if (!symbols) { data = {}; break; }
        const list = (symbols as string).split(",").slice(0, 30);
        const batchResults: Record<string, unknown> = {};
        const settled = await Promise.allSettled(
          list.map(async (sym: string) => {
            const r = await safeFetchJson(
              `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym.trim())}?interval=1d&range=1d`
            );
            if (r.ok) {
              const meta = (r.data as { chart?: { result?: Array<{ meta: Record<string, unknown> }> } })?.chart?.result?.[0]?.meta;
              if (meta) {
                batchResults[sym.trim()] = {
                  price: meta.regularMarketPrice,
                  previousClose: meta.chartPreviousClose || meta.previousClose,
                  currency: meta.currency,
                  symbol: meta.symbol,
                };
              }
            }
          })
        );
        data = batchResults;
        break;
      }

      // ====== KIS (한국투자증권) Ranking ======
      case "kis-ranking": {
        const { appkey, appsecret, type: rankType, market: marketCode } = params;
        if (!appkey || !appsecret) { data = { error: "appkey, appsecret required", output: [] }; break; }
        // Token
        const kisTokenRes = await fetch("https://openapi.koreainvestment.com:9443/oauth2/tokenP", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grant_type: "client_credentials", appkey, appsecret }),
        });
        if (!kisTokenRes.ok) { data = { error: "token failed", output: [] }; break; }
        const kisTokenData = await kisTokenRes.json();
        const kisToken = kisTokenData.access_token;
        const trId = rankType === "volume" ? "FHPST01710000" : "FHPST01700000";
        const scrCode = rankType === "volume" ? "20171" : "20170";
        const kisParams = new URLSearchParams({
          fid_cond_mrkt_div_code: marketCode || "J",
          fid_cond_scr_div_code: scrCode,
          fid_input_iscd: "", fid_rank_sort_cls_code: "0",
          fid_input_cnt_1: "0", fid_prc_cls_code: "1",
          fid_input_price_1: "", fid_input_price_2: "",
          fid_vol_cnt: "", fid_trgt_cls_code: "0",
          fid_trgt_exls_cls_code: "0", fid_div_cls_code: "0",
          fid_rsfl_rate1: "", fid_rsfl_rate2: "",
        });
        const kisRankRes = await fetch(
          `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/ranking/fluctuation?${kisParams}`,
          { headers: { "Content-Type": "application/json; charset=utf-8", authorization: `Bearer ${kisToken}`, appkey: appkey as string, appsecret: appsecret as string, tr_id: trId } }
        );
        data = kisRankRes.ok ? await kisRankRes.json() : { error: "rank failed", output: [] };
        break;
      }

      // ====== KIS Daily Price ======
      case "kis-daily-price": {
        const { appkey, appsecret, code: stockCode, start: startDate, end: endDate } = params;
        if (!appkey || !appsecret || !stockCode) { data = { output2: [] }; break; }
        const kisTRes = await fetch("https://openapi.koreainvestment.com:9443/oauth2/tokenP", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grant_type: "client_credentials", appkey, appsecret }),
        });
        if (!kisTRes.ok) { data = { output2: [] }; break; }
        const kisTData = await kisTRes.json();
        const now = new Date();
        const endD = endDate || `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
        const startD = startDate || (() => { const d = new Date(); d.setFullYear(d.getFullYear()-1); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`; })();
        const dpParams = new URLSearchParams({
          FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: stockCode as string,
          FID_INPUT_DATE_1: startD, FID_INPUT_DATE_2: endD,
          FID_PERIOD_DIV_CODE: "D", FID_ORG_ADJ_PRC: "0",
        });
        const dpRes = await fetch(
          `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${dpParams}`,
          { headers: { "Content-Type": "application/json; charset=utf-8", authorization: `Bearer ${kisTData.access_token}`, appkey: appkey as string, appsecret: appsecret as string, tr_id: "FHKST03010100" } }
        );
        data = dpRes.ok ? await dpRes.json() : { output2: [] };
        break;
      }

      // ====== KIS Market Cap ======
      case "kis-market-cap": {
        const { appkey, appsecret } = params;
        if (!appkey || !appsecret) { data = { output: [] }; break; }
        const mcTRes = await fetch("https://openapi.koreainvestment.com:9443/oauth2/tokenP", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grant_type: "client_credentials", appkey, appsecret }),
        });
        if (!mcTRes.ok) { data = { output: [] }; break; }
        const mcTData = await mcTRes.json();
        const mcParams = new URLSearchParams({
          fid_cond_mrkt_div_code: "J", fid_cond_scr_div_code: "20174",
          fid_input_iscd: "", fid_div_cls_code: "0", fid_blng_cls_code: "0",
          fid_trgt_cls_code: "0", fid_trgt_exls_cls_code: "0",
          fid_input_price_1: "", fid_input_price_2: "",
          fid_vol_cnt: "", fid_input_date_1: "",
        });
        const mcRes = await fetch(
          `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/ranking/market-cap?${mcParams}`,
          { headers: { "Content-Type": "application/json; charset=utf-8", authorization: `Bearer ${mcTData.access_token}`, appkey: appkey as string, appsecret: appsecret as string, tr_id: "FHPST01740000" } }
        );
        data = mcRes.ok ? await mcRes.json() : { output: [] };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown service: ${service}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
