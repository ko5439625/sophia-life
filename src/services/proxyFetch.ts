/**
 * Supabase Edge Function proxy for CORS-blocked APIs
 *
 * 브라우저에서 직접 호출 불가한 API를 Supabase Edge Function을 통해 우회
 * Edge Function 미설정 시 직접 호출 시도 → 실패 시 mock 폴백
 */

const getProxyUrl = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/functions/v1/api-proxy`;
};

const getAnonKey = () => {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || "";
};

/** Sleep helper */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Proxy fetch through Supabase Edge Function with retry on 429/503
 * @param service - API service identifier (e.g., "yahoo-quote", "news", "molit-trade")
 * @param params - Parameters to pass to the service
 * @param maxRetries - Maximum retry attempts (default 2)
 * @returns Parsed JSON response or null on failure
 */
export async function proxyFetch<T = unknown>(
  service: string,
  params: Record<string, unknown>,
  maxRetries = 2
): Promise<T | null> {
  const proxyUrl = getProxyUrl();

  if (!proxyUrl) {
    console.warn(`[proxyFetch] Supabase not configured, skipping ${service}`);
    return null;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAnonKey()}`,
          "apikey": getAnonKey(),
        },
        body: JSON.stringify({ service, params }),
      });

      if (!res.ok) {
        // Retry on 429 (Too Many Requests) or 503 (Service Unavailable)
        if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
          const waitMs = Math.min(1000 * Math.pow(2, attempt), 4000); // 1s, 2s, 4s
          console.warn(`[proxyFetch] ${service} got ${res.status}, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
          await sleep(waitMs);
          continue;
        }
        console.warn(`[proxyFetch] ${service} failed: ${res.status}`);
        return null;
      }

      return (await res.json()) as T;
    } catch (error) {
      if (attempt < maxRetries) {
        const waitMs = Math.min(1000 * Math.pow(2, attempt), 4000);
        console.warn(`[proxyFetch] ${service} error, retrying in ${waitMs}ms:`, error);
        await sleep(waitMs);
        continue;
      }
      console.warn(`[proxyFetch] ${service} error (final):`, error);
      return null;
    }
  }
  return null;
}
