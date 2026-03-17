// NOTE: Some APIs require a backend proxy to avoid CORS. For development, use mock data.

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

const KAKAO_SEARCH_ENDPOINT =
  "https://dapi.kakao.com/v2/local/search/keyword.json";

function getApiKey(): string | null {
  return localStorage.getItem("sophia-api-kakao");
}

// ---------------------------------------------------------------------------
// Real API function
// ---------------------------------------------------------------------------

async function realSearchPlaces(query: string): Promise<PlaceResult[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No Kakao API key");

  const params = new URLSearchParams({
    query,
    size: "15",
  });

  const res = await fetch(`${KAKAO_SEARCH_ENDPOINT}?${params.toString()}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kakao API error ${res.status}: ${err}`);
  }

  const data = await res.json();

  return (data.documents || []).map(
    (doc: {
      place_name?: string;
      address_name?: string;
      road_address_name?: string;
      category_group_name?: string;
      phone?: string;
      x?: string;
      y?: string;
    }) => ({
      placeName: doc.place_name || "",
      address: doc.address_name || "",
      roadAddress: doc.road_address_name || "",
      category: doc.category_group_name || "",
      phone: doc.phone || "",
      x: doc.x || "",
      y: doc.y || "",
    }),
  );
}

// ---------------------------------------------------------------------------
// Mock function
// ---------------------------------------------------------------------------

function mockSearchPlaces(query: string): PlaceResult[] {
  const mockPlaces: PlaceResult[] = [
    {
      placeName: "스타벅스 강남역점",
      address: "서울 강남구 역삼동 858",
      roadAddress: "서울 강남구 강남대로 390",
      category: "카페",
      phone: "02-555-1234",
      x: "127.028",
      y: "37.498",
    },
    {
      placeName: "투썸플레이스 삼성역점",
      address: "서울 강남구 삼성동 159",
      roadAddress: "서울 강남구 테헤란로 521",
      category: "카페",
      phone: "02-555-5678",
      x: "127.060",
      y: "37.509",
    },
    {
      placeName: "CGV 강남",
      address: "서울 강남구 역삼동 814-6",
      roadAddress: "서울 강남구 강남대로 438",
      category: "문화시설",
      phone: "1544-1122",
      x: "127.026",
      y: "37.501",
    },
    {
      placeName: "올리브영 강남역점",
      address: "서울 강남구 역삼동 825-4",
      roadAddress: "서울 강남구 강남대로 396",
      category: "가게",
      phone: "02-555-9012",
      x: "127.027",
      y: "37.499",
    },
    {
      placeName: "이디야커피 선릉역점",
      address: "서울 강남구 역삼동 707-34",
      roadAddress: "서울 강남구 테헤란로 334",
      category: "카페",
      phone: "02-555-3456",
      x: "127.049",
      y: "37.504",
    },
  ];

  if (!query.trim()) return mockPlaces;

  const q = query.toLowerCase();
  const filtered = mockPlaces.filter(
    (p) =>
      p.placeName.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q),
  );

  return filtered.length > 0 ? filtered : mockPlaces;
}

// ---------------------------------------------------------------------------
// Unified export (try real API, fall back to mock)
// ---------------------------------------------------------------------------

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  try {
    if (!getApiKey()) return mockSearchPlaces(query);
    return await realSearchPlaces(query);
  } catch (e) {
    console.warn("Kakao searchPlaces failed, using mock:", e);
    return mockSearchPlaces(query);
  }
}
