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
        const result = await safeFetchJson(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
        );
        if (!result.ok) {
          return new Response(JSON.stringify(result.data), {
            status: 200, // Return 200 so client can handle gracefully
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        data = result.data;
        break;
      }

      case "yahoo-historical": {
        const { symbol, range } = params;
        const result = await safeFetchJson(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range || "1y"}`
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
        const { query } = params;
        const result = await safeFetchJson(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query || "")}&quotesCount=8&newsCount=0`
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
        const { apiKey, page } = params;
        const url = new URL(
          "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail"
        );
        url.searchParams.set("serviceKey", apiKey);
        url.searchParams.set("page", String(page || 1));
        url.searchParams.set("perPage", "20");
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
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city || "Seoul")}&appid=${apiKey}&units=metric&lang=kr`
        );
        data = await res.json();
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
