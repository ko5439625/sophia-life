// ---------------------------------------------------------------------------
// 네이버페이 부동산 딥링크 빌더 (크롤링 없음 — 사용자가 네이버 화면을 직접 봄)
//
// 2026-09 확인 결과
// - new.land.naver.com 은 전 경로 /404 로 리다이렉트 (구 ?ms=&a=&b=&f=&g=&h=&i= 포맷 사용 불가)
// - m.land.naver.com/map/... 은 파라미터를 버리고 fin.land.naver.com/map 으로 JS 리다이렉트
// - 현재 매물지도: https://fin.land.naver.com/map
//     center={lng}-{lat}   (서버가 307 로 자체 인코딩 좌표로 정규화함 → 파라미터 인식 확인)
//     zoom={number}
//     realEstateTypes=A01-A04 (아파트·재건축) / C03-C04-D05 (단독·다가구·전원·상가주택)
//     tradeTypes=A1 (매매) / B1 (전세) / B2 (월세)
// - 지역명 검색: https://fin.land.naver.com/search?q={검색어} → /map?q=...&search-expanded=true
// - 가격·면적 URL 파라미터는 공개 자료로 확인 불가 → URL 에 넣지 않고 화면에 "리마인더 칩"으로 표시
// ---------------------------------------------------------------------------

export const NAVER_FIN_MAP = "https://fin.land.naver.com/map";
export const NAVER_FIN_SEARCH = "https://fin.land.naver.com/search";
export const NAVER_MOBILE_HOME = "https://m.land.naver.com/";

export const PYEONG_TO_M2 = 3.3058;

export type TradeType = "A1" | "B1" | "B2";
export type ListingKind = "apt" | "house";

export const TRADE_LABEL: Record<TradeType, string> = { A1: "매매", B1: "전세", B2: "월세" };

export const KIND_TYPES: Record<ListingKind, string> = {
  apt: "A01-A04",
  house: "C03-C04-D05",
};

export const KIND_LABEL: Record<ListingKind, string> = {
  apt: "아파트",
  house: "단독·다가구",
};

export type AreaGroup = "추천" | "서울" | "경기";

export interface AreaOption {
  /** 고유 id (같은 cortarNo 를 쓰는 신도시 항목이 있어 별도) */
  id: string;
  /** 화면 표시 이름 (re_filters.region_name 에 저장) */
  label: string;
  group: AreaGroup;
  /** 네이버 법정동 코드 (re_filters.region_code 에 저장) */
  cortarNo: string;
  lat: number;
  lng: number;
  zoom: number;
  /** 검색용 추가 키워드 */
  keywords?: string[];
}

// 서울 25개 구 (중심 좌표는 구청 인근)
const SEOUL: [string, string, number, number][] = [
  ["강남구", "1168000000", 37.5172, 127.0473],
  ["강동구", "1174000000", 37.5301, 127.1238],
  ["강북구", "1130500000", 37.6397, 127.0254],
  ["강서구", "1150000000", 37.5509, 126.8495],
  ["관악구", "1162000000", 37.4784, 126.9516],
  ["광진구", "1121500000", 37.5385, 127.0823],
  ["구로구", "1153000000", 37.4954, 126.8877],
  ["금천구", "1154500000", 37.4568, 126.8955],
  ["노원구", "1135000000", 37.6542, 127.0568],
  ["도봉구", "1132000000", 37.6688, 127.0471],
  ["동대문구", "1123000000", 37.5744, 127.0396],
  ["동작구", "1159000000", 37.5124, 126.9393],
  ["마포구", "1144000000", 37.5663, 126.9014],
  ["서대문구", "1141000000", 37.5791, 126.9368],
  ["서초구", "1165000000", 37.4837, 127.0324],
  ["성동구", "1120000000", 37.5633, 127.0371],
  ["성북구", "1129000000", 37.5894, 127.0164],
  ["송파구", "1171000000", 37.5145, 127.1059],
  ["양천구", "1147000000", 37.517, 126.8665],
  ["영등포구", "1156000000", 37.5264, 126.8963],
  ["용산구", "1117000000", 37.5324, 126.99],
  ["은평구", "1138000000", 37.6027, 126.9291],
  ["종로구", "1111000000", 37.5735, 126.979],
  ["중구", "1114000000", 37.5636, 126.9976],
  ["중랑구", "1126000000", 37.6063, 127.0928],
];

export const AREA_OPTIONS: AreaOption[] = [
  // 자주 찾는 곳 (기존 필터 기반)
  { id: "gwanggyo", label: "광교 (수원 영통구)", group: "추천", cortarNo: "4111700000", lat: 37.2886, lng: 127.0514, zoom: 15, keywords: ["광교", "광교신도시", "수원"] },
  { id: "pangyo", label: "판교 (성남 분당구)", group: "추천", cortarNo: "4113500000", lat: 37.3947, lng: 127.1112, zoom: 15, keywords: ["판교", "성남"] },
  { id: "misa", label: "미사 (하남)", group: "추천", cortarNo: "4145000000", lat: 37.563, lng: 127.193, zoom: 15, keywords: ["미사", "하남"] },
  { id: "wirye", label: "위례 (성남 수정구)", group: "추천", cortarNo: "4113100000", lat: 37.4775, lng: 127.144, zoom: 15, keywords: ["위례", "성남"] },
  // 경기
  { id: "seongnam-all", label: "성남시 전체", group: "경기", cortarNo: "4113000000", lat: 37.42, lng: 127.1265, zoom: 13, keywords: ["성남"] },
  { id: "seongnam-sujeong", label: "성남시 수정구", group: "경기", cortarNo: "4113100000", lat: 37.4502, lng: 127.1457, zoom: 14, keywords: ["성남", "수정"] },
  { id: "seongnam-jungwon", label: "성남시 중원구", group: "경기", cortarNo: "4113300000", lat: 37.4306, lng: 127.1372, zoom: 14, keywords: ["성남", "중원"] },
  { id: "seongnam-bundang", label: "성남시 분당구", group: "경기", cortarNo: "4113500000", lat: 37.3827, lng: 127.1189, zoom: 14, keywords: ["성남", "분당"] },
  { id: "hanam", label: "하남시", group: "경기", cortarNo: "4145000000", lat: 37.5393, lng: 127.2148, zoom: 14, keywords: ["하남"] },
  { id: "suwon-all", label: "수원시 전체", group: "경기", cortarNo: "4111000000", lat: 37.2636, lng: 127.0286, zoom: 13, keywords: ["수원"] },
  { id: "suwon-yeongtong", label: "수원시 영통구", group: "경기", cortarNo: "4111700000", lat: 37.2596, lng: 127.0465, zoom: 14, keywords: ["수원", "영통", "광교"] },
  { id: "suwon-jangan", label: "수원시 장안구", group: "경기", cortarNo: "4111100000", lat: 37.304, lng: 127.0102, zoom: 14, keywords: ["수원", "장안"] },
  { id: "suwon-gwonseon", label: "수원시 권선구", group: "경기", cortarNo: "4111300000", lat: 37.2575, lng: 126.9716, zoom: 14, keywords: ["수원", "권선"] },
  { id: "suwon-paldal", label: "수원시 팔달구", group: "경기", cortarNo: "4111500000", lat: 37.2826, lng: 127.0197, zoom: 14, keywords: ["수원", "팔달"] },
  { id: "yongin-all", label: "용인시 전체", group: "경기", cortarNo: "4146000000", lat: 37.241, lng: 127.1776, zoom: 13, keywords: ["용인"] },
  { id: "yongin-suji", label: "용인시 수지구", group: "경기", cortarNo: "4146500000", lat: 37.3219, lng: 127.0987, zoom: 14, keywords: ["용인", "수지"] },
  { id: "yongin-giheung", label: "용인시 기흥구", group: "경기", cortarNo: "4146300000", lat: 37.2803, lng: 127.1146, zoom: 14, keywords: ["용인", "기흥"] },
  { id: "yongin-cheoin", label: "용인시 처인구", group: "경기", cortarNo: "4146100000", lat: 37.2342, lng: 127.2017, zoom: 14, keywords: ["용인", "처인"] },
  { id: "gwacheon", label: "과천시", group: "경기", cortarNo: "4129000000", lat: 37.4292, lng: 126.9876, zoom: 14, keywords: ["과천"] },
  { id: "gwangmyeong", label: "광명시", group: "경기", cortarNo: "4121000000", lat: 37.4786, lng: 126.8646, zoom: 14, keywords: ["광명"] },
  { id: "anyang-all", label: "안양시 전체", group: "경기", cortarNo: "4117000000", lat: 37.3943, lng: 126.9568, zoom: 13, keywords: ["안양", "평촌"] },
  { id: "goyang-all", label: "고양시 전체", group: "경기", cortarNo: "4128000000", lat: 37.6584, lng: 126.832, zoom: 13, keywords: ["고양", "일산"] },
  // 서울
  { id: "seoul-all", label: "서울 전체", group: "서울", cortarNo: "1100000000", lat: 37.5665, lng: 126.978, zoom: 12, keywords: ["서울"] },
  ...SEOUL.map(([gu, code, lat, lng]): AreaOption => ({
    id: `seoul-${code}`, label: `서울 ${gu}`, group: "서울", cortarNo: code, lat, lng, zoom: 14, keywords: ["서울", gu, gu.replace(/구$/, "")],
  })),
];

/** 자유 검색어 지역 (카탈로그에 없는 동네) 은 region_code 에 "q:" 접두어로 저장 */
export const FREE_TEXT_PREFIX = "q:";

export interface ResolvedArea {
  key: string;          // 화면 key
  label: string;
  code: string;         // re_filters.region_code 조각
  option: AreaOption | null; // null = 자유 검색어
}

/** 저장된 (code, name) 쌍을 카탈로그 항목으로 복원 */
export function resolveArea(code: string, name: string): ResolvedArea {
  if (code.startsWith(FREE_TEXT_PREFIX)) {
    const q = code.slice(FREE_TEXT_PREFIX.length) || name;
    return { key: code, label: q, code, option: null };
  }
  const byBoth = AREA_OPTIONS.find((a) => a.cortarNo === code && a.label === name);
  const byCode = byBoth ?? AREA_OPTIONS.find((a) => a.cortarNo === code && a.group !== "추천");
  const option = byCode ?? AREA_OPTIONS.find((a) => a.cortarNo === code) ?? null;
  return { key: `${code}|${name}`, label: option ? option.label : name || code, code, option };
}

export function searchAreas(query: string): AreaOption[] {
  const q = query.trim().replace(/\s+/g, "");
  if (!q) return [];
  return AREA_OPTIONS.filter((a) => {
    const hay = [a.label, ...(a.keywords ?? [])].join(" ").replace(/\s+/g, "");
    return hay.includes(q);
  });
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

export function buildNaverMapUrl(area: AreaOption, kind: ListingKind, trade: TradeType): string {
  const params = new URLSearchParams({
    center: `${area.lng}-${area.lat}`,
    zoom: String(area.zoom),
    realEstateTypes: KIND_TYPES[kind],
    tradeTypes: trade,
  });
  return `${NAVER_FIN_MAP}?${params.toString()}`;
}

export function buildNaverSearchUrl(query: string): string {
  return `${NAVER_FIN_SEARCH}?q=${encodeURIComponent(query)}`;
}

/** 지역 하나 + 매물 종류 → 열 링크 (자유 검색어는 네이버 검색으로) */
export function buildListingUrl(area: ResolvedArea, kind: ListingKind, trade: TradeType): string {
  if (area.option) return buildNaverMapUrl(area.option, kind, trade);
  return buildNaverSearchUrl(area.label);
}

/** 네이버 검색에 넣을 지역명 (괄호 설명 제거) */
export function searchTermFor(area: ResolvedArea): string {
  const base = area.option?.keywords?.[0] && area.option.group === "추천" ? area.option.keywords[0] : area.label;
  return base.replace(/\s*\(.*\)\s*/g, "").replace(/ 전체$/, "");
}

// ---------------------------------------------------------------------------
// Unit helpers
// ---------------------------------------------------------------------------

export const pyeongToM2 = (p: number) => Math.round(p * PYEONG_TO_M2 * 100) / 100;
export const m2ToPyeong = (m2: number) => Math.round(m2 / PYEONG_TO_M2);

/** 만원 → "5억", "5억 5,000", "3,000만" */
export function formatManwon(man: number): string {
  if (man >= 10000) {
    const eok = Math.floor(man / 10000);
    const rest = Math.round(man % 10000);
    return rest ? `${eok}억 ${rest.toLocaleString("ko-KR")}` : `${eok}억`;
  }
  return `${man.toLocaleString("ko-KR")}만`;
}
