// 청약 알림 워커 — 맥이 꺼져 있어도 Cloudflare에서 주기 실행
// 청약홈 분양정보(공공데이터포털)를 가져와 관심 지역의 "새 공고"만 ntfy로 폰 푸시.
// 관심 지역: KV "regions" (앱 설정에서 PUT /regions 로 저장) → 없으면 env.DEFAULT_REGIONS
// 이미 알린 공고: KV(SEEN)에 저장해 중복 알림 방지

interface Env {
  SEEN: KVNamespace;
  DATA_GO_KR_API_KEY: string; // wrangler secret
  NTFY_TOPICS: string; // 쉼표 구분
  DEFAULT_REGIONS: string; // 예: "경기,서울"
}

interface Notice {
  HOUSE_MANAGE_NO: string;
  PBLANC_NO?: string;
  HOUSE_NM: string;
  SUBSCRPT_AREA_CODE_NM?: string; // 공급지역명 (서울/경기/...)
  HSSPLY_ADRES?: string;
  RCEPT_BGNDE?: string;
  RCEPT_ENDDE?: string;
  TOT_SUPLY_HSHLDCO?: number;
  PBLANC_URL?: string;
}

const FEED = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail";

const SIDO = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

async function loadRegions(env: Env): Promise<string[]> {
  const saved = await env.SEEN.get("regions");
  if (saved) {
    const list = JSON.parse(saved) as string[];
    if (list.length) return list;
  }
  return env.DEFAULT_REGIONS.split(",").map((s) => s.trim()).filter(Boolean);
}

async function fetchNotices(env: Env): Promise<Notice[]> {
  const url = new URL(FEED);
  url.searchParams.set("serviceKey", env.DATA_GO_KR_API_KEY);
  url.searchParams.set("page", "1");
  url.searchParams.set("perPage", "50");
  // 최근 공고만 (모집공고일 기준 최근 30일)
  const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  url.searchParams.set("cond[RCRIT_PBLANC_DE::GTE]", since);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`청약홈 API ${res.status}`);
  const json = (await res.json()) as { data?: Notice[] };
  return json.data ?? [];
}

function matchesRegion(n: Notice, regions: string[]): boolean {
  const hay = `${n.SUBSCRPT_AREA_CODE_NM ?? ""} ${n.HSSPLY_ADRES ?? ""}`;
  return regions.some((r) => hay.includes(r));
}

async function push(env: Env, n: Notice): Promise<void> {
  const when = n.RCEPT_BGNDE ? `접수 ${n.RCEPT_BGNDE.slice(5)}~${(n.RCEPT_ENDDE ?? "").slice(5)}` : "";
  const body = [n.SUBSCRPT_AREA_CODE_NM, when, n.TOT_SUPLY_HSHLDCO ? `${n.TOT_SUPLY_HSHLDCO}세대` : ""]
    .filter(Boolean)
    .join(" · ");
  for (const topic of env.NTFY_TOPICS.split(",").map((s) => s.trim()).filter(Boolean)) {
    await fetch("https://ntfy.sh/", {
      method: "POST",
      body: JSON.stringify({
        topic,
        title: `새 청약: ${n.HOUSE_NM}`,
        message: body || "새 청약 공고가 올라왔어요",
        tags: ["house"],
        click: n.PBLANC_URL || "https://www.applyhome.co.kr",
      }),
    });
  }
}

async function run(env: Env): Promise<{ checked: number; matched: number; pushed: number }> {
  const [regions, notices] = await Promise.all([loadRegions(env), fetchNotices(env)]);
  const matched = notices.filter((n) => matchesRegion(n, regions));
  // 첫 실행: 기존 공고는 "이미 본 것"으로만 표시하고 알림 폭탄 방지
  if (!(await env.SEEN.get("initialized"))) {
    for (const n of matched) await env.SEEN.put(`${n.HOUSE_MANAGE_NO}-${n.PBLANC_NO ?? ""}`, "1", { expirationTtl: 60 * 60 * 24 * 120 });
    await env.SEEN.put("initialized", "1");
    return { checked: notices.length, matched: matched.length, pushed: 0 };
  }
  let pushed = 0;
  for (const n of matched) {
    const id = `${n.HOUSE_MANAGE_NO}-${n.PBLANC_NO ?? ""}`;
    if (await env.SEEN.get(id)) continue;
    await push(env, n);
    await env.SEEN.put(id, "1", { expirationTtl: 60 * 60 * 24 * 120 });
    pushed++;
  }
  return { checked: notices.length, matched: matched.length, pushed };
}

export default {
  async scheduled(_e: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(run(env).then((r) => console.log("cheongyak", r)));
  },
  // GET /regions · PUT /regions (앱 설정) · GET /run?dry=1 (점검)
  async fetch(req: Request, env: Env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const u = new URL(req.url);
    if (u.pathname === "/regions") {
      if (req.method === "PUT") {
        const body = (await req.json().catch(() => null)) as { regions?: unknown } | null;
        const list = Array.isArray(body?.regions) ? body!.regions.map(String).filter((r) => SIDO.includes(r)) : null;
        if (!list) return Response.json({ error: "regions 배열이 필요해요" }, { status: 400, headers: cors });
        await env.SEEN.put("regions", JSON.stringify(list));
        return Response.json({ regions: list }, { headers: cors });
      }
      return Response.json({ regions: await loadRegions(env), options: SIDO }, { headers: cors });
    }
    if (u.pathname === "/run" && u.searchParams.get("dry")) {
      const [regions, notices] = await Promise.all([loadRegions(env), fetchNotices(env)]);
      const m = notices.filter((n) => matchesRegion(n, regions));
      return Response.json(
        { regions, checked: notices.length, matched: m.map((n) => ({ name: n.HOUSE_NM, area: n.SUBSCRPT_AREA_CODE_NM, start: n.RCEPT_BGNDE, end: n.RCEPT_ENDDE, url: n.PBLANC_URL })) },
        { headers: cors }
      );
    }
    return new Response("ok", { headers: cors });
  },
};
