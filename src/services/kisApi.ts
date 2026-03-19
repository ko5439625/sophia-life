// 한국투자증권 Open API
// 신청: https://apiportal.koreainvestment.com/
// 필요: 앱키(appkey) + 앱시크릿(appsecret)

const KIS_BASE = "https://openapi.koreainvestment.com:9443";

function getKeys(): { appkey: string; appsecret: string } | null {
  const appkey = localStorage.getItem("sophia-api-kis-appkey");
  const appsecret = localStorage.getItem("sophia-api-kis-secret");
  if (!appkey || !appsecret) return null;
  return { appkey, appsecret };
}

// Access Token 캐싱 (24시간 유효)
let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.token;

  const keys = getKeys();
  if (!keys) throw new Error("한국투자증권 API 키가 필요합니다. 설정에서 추가해주세요.");

  const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: keys.appkey,
      appsecret: keys.appsecret,
    }),
  });

  if (!res.ok) throw new Error(`한투 인증 실패 (${res.status})`);
  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + 23 * 60 * 60 * 1000, // 23시간
  };
  return cachedToken.token;
}

async function kisRequest(path: string, trId: string, params: Record<string, string> = {}): Promise<unknown> {
  const keys = getKeys();
  if (!keys) throw new Error("한국투자증권 API 키가 필요합니다.");
  const token = await getAccessToken();

  const query = new URLSearchParams(params).toString();
  const url = `${KIS_BASE}${path}${query ? `?${query}` : ""}`;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      authorization: `Bearer ${token}`,
      appkey: keys.appkey,
      appsecret: keys.appsecret,
      tr_id: trId,
    },
  });

  if (!res.ok) throw new Error(`한투 API 오류 (${res.status})`);
  return await res.json();
}

// ---------------------------------------------------------------------------
// 퀀트 스크리닝용 API
// ---------------------------------------------------------------------------

export interface KisStockInfo {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changeRate: number;
  volume: number;
  marketCap: number;
  per: number | null;
  pbr: number | null;
  eps: number | null;
}

/** 등락률 상위 종목 조회 */
export async function getTopGainers(market: "kospi" | "kosdaq" = "kospi"): Promise<KisStockInfo[]> {
  const fid_cond_mrkt_div_code = market === "kospi" ? "J" : "Q";
  const data = await kisRequest(
    "/uapi/domestic-stock/v1/ranking/fluctuation",
    "FHPST01700000",
    {
      fid_cond_mrkt_div_code: fid_cond_mrkt_div_code,
      fid_cond_scr_div_code: "20170",
      fid_input_iscd: "",
      fid_rank_sort_cls_code: "0", // 상승률순
      fid_input_cnt_1: "0",
      fid_prc_cls_code: "1",
      fid_input_price_1: "",
      fid_input_price_2: "",
      fid_vol_cnt: "",
      fid_trgt_cls_code: "0",
      fid_trgt_exls_cls_code: "0",
      fid_div_cls_code: "0",
      fid_rsfl_rate1: "",
      fid_rsfl_rate2: "",
    }
  ) as { output?: Array<Record<string, string>> };

  return (data.output || []).slice(0, 50).map((item) => ({
    symbol: item.stck_shrn_iscd || "",
    name: item.hts_kor_isnm || "",
    price: parseInt(item.stck_prpr) || 0,
    change: parseInt(item.prdy_vrss) || 0,
    changeRate: parseFloat(item.prdy_ctrt) || 0,
    volume: parseInt(item.acml_vol) || 0,
    marketCap: parseInt(item.stck_avls) || 0,
    per: item.per ? parseFloat(item.per) : null,
    pbr: item.pbr ? parseFloat(item.pbr) : null,
    eps: item.eps ? parseFloat(item.eps) : null,
  }));
}

/** 거래량 상위 종목 조회 */
export async function getTopVolume(market: "kospi" | "kosdaq" = "kospi"): Promise<KisStockInfo[]> {
  const fid_cond_mrkt_div_code = market === "kospi" ? "J" : "Q";
  const data = await kisRequest(
    "/uapi/domestic-stock/v1/ranking/volume",
    "FHPST01710000",
    {
      FID_COND_MRKT_DIV_CODE: fid_cond_mrkt_div_code,
      FID_COND_SCR_DIV_CODE: "20171",
      FID_INPUT_ISCD: "",
      FID_DIV_CLS_CODE: "0",
      FID_BLNG_CLS_CODE: "0",
      FID_TRGT_CLS_CODE: "111111111",
      FID_TRGT_EXLS_CLS_CODE: "0000000000",
      FID_INPUT_PRICE_1: "0",
      FID_INPUT_PRICE_2: "0",
      FID_VOL_CNT: "0",
      FID_INPUT_DATE_1: "",
    }
  ) as { output?: Array<Record<string, string>> };

  return (data.output || []).slice(0, 50).map((item) => ({
    symbol: item.mksc_shrn_iscd || item.stck_shrn_iscd || "",
    name: item.hts_kor_isnm || "",
    price: parseInt(item.stck_prpr) || 0,
    change: parseInt(item.prdy_vrss) || 0,
    changeRate: parseFloat(item.prdy_ctrt) || 0,
    volume: parseInt(item.acml_vol) || 0,
    marketCap: 0,
    per: null,
    pbr: null,
    eps: null,
  }));
}

/** 한투 API 키 설정 여부 확인 */
export function isKisConfigured(): boolean {
  return !!getKeys();
}
