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

/**
 * Proxy fetch through Supabase Edge Function
 * @param service - API service identifier (e.g., "yahoo-quote", "news", "molit-trade")
 * @param params - Parameters to pass to the service
 * @returns Parsed JSON response or null on failure
 */
export async function proxyFetch<T = unknown>(
  service: string,
  params: Record<string, unknown>
): Promise<T | null> {
  const proxyUrl = getProxyUrl();

  if (!proxyUrl) {
    console.warn(`[proxyFetch] Supabase not configured, skipping ${service}`);
    return null;
  }

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
      console.warn(`[proxyFetch] ${service} failed: ${res.status}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (error) {
    console.warn(`[proxyFetch] ${service} error:`, error);
    return null;
  }
}
