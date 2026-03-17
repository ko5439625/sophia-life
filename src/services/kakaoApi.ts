import { proxyFetch } from "./proxyFetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlaceResult {
  placeName: string;
  address: string;
  roadAddress: string;
  category: string;
  phone: string;
  x: string; // longitude
  y: string; // latitude
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiKey(): string | null {
  return localStorage.getItem("sophia-api-kakao");
}

function mapDocuments(
  documents: Array<{
    place_name?: string;
    address_name?: string;
    road_address_name?: string;
    category_group_name?: string;
    phone?: string;
    x?: string;
    y?: string;
  }>,
): PlaceResult[] {
  return documents.map((doc) => ({
    placeName: doc.place_name || "",
    address: doc.address_name || "",
    roadAddress: doc.road_address_name || "",
    category: doc.category_group_name || "",
    phone: doc.phone || "",
    x: doc.x || "",
    y: doc.y || "",
  }));
}

// ---------------------------------------------------------------------------
// Unified export: proxy → direct → empty
// ---------------------------------------------------------------------------

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[kakao] No API key");
    return [];
  }

  // 1. Try Supabase proxy (avoids CORS)
  try {
    const proxyResult = await proxyFetch<{
      documents?: Array<{
        place_name?: string;
        address_name?: string;
        road_address_name?: string;
        category_group_name?: string;
        phone?: string;
        x?: string;
        y?: string;
      }>;
    }>("kakao-search", { query, apiKey });

    if (proxyResult?.documents) {
      return mapDocuments(proxyResult.documents);
    }
  } catch (e) {
    console.warn("[kakao] proxy failed:", e);
  }

  // 2. Try direct (may fail due to CORS in browser)
  try {
    const params = new URLSearchParams({ query, size: "15" });
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`,
      { headers: { Authorization: `KakaoAK ${apiKey}` } },
    );
    if (res.ok) {
      const data = await res.json();
      return mapDocuments(data.documents || []);
    }
    console.warn("[kakao] direct failed:", res.status);
  } catch (e) {
    console.warn("[kakao] direct error:", e);
  }

  // 3. No mock - return empty
  return [];
}
