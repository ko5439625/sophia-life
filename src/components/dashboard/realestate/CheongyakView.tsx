import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, ExternalLink, KeyRound, Loader2, RefreshCw, AlertCircle, CalendarDays, Users, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  APPLYHOME_LIST_URL, SIDO_OPTIONS,
  daysBetween, fetchCheongyakNotices, getAlertRegions, noticePhase, putAlertRegions, todayYmd,
  type CheongyakNotice, type NoticeResult,
} from "@/services/cheongyakApi";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const md = (ymd: string) => {
  if (!ymd) return "-";
  const [, m, d] = ymd.split("-");
  return `${Number(m)}.${Number(d)}`;
};

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

type PhaseFilter = "all" | "open" | "upcoming";

function DdayBadge({ n }: { n: CheongyakNotice }) {
  const today = todayYmd();
  const phase = noticePhase(n, today);
  if (phase === "upcoming") {
    const d = daysBetween(today, n.start);
    return <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">시작 D-{d}</span>;
  }
  const d = daysBetween(today, n.end);
  const urgent = d <= 3;
  return (
    <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${urgent ? "bg-warn/15 text-warn" : "bg-foreground text-background"}`}>
      {d === 0 ? "오늘 마감" : `마감 D-${d}`}
    </span>
  );
}

function NoticeCard({ n }: { n: CheongyakNotice }) {
  const phase = noticePhase(n);
  return (
    <li className="min-w-0 bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${phase === "open" ? "bg-love" : "bg-border"}`} />
            {phase === "open" ? "접수 중" : "접수 예정"}
            {n.houseType && <span>· {n.houseType}</span>}
          </div>
          <h4 className="font-semibold leading-snug mt-0.5">{n.name}</h4>
          {(n.address || n.sido) && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 min-w-0">
              <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{n.address || n.sido}</span>
            </p>
          )}
        </div>
        <DdayBadge n={n} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-muted/60 px-3 py-2">
          <dt className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" />접수 기간</dt>
          <dd className="font-medium tabular-nums">{md(n.start)} ~ {md(n.end)}</dd>
        </div>
        <div className="rounded-xl bg-muted/60 px-3 py-2">
          <dt className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />공급 세대</dt>
          <dd className="font-medium tabular-nums">{n.totalSupply != null ? `${n.totalSupply.toLocaleString("ko-KR")}세대` : "-"}</dd>
        </div>
      </dl>
      {/* 링크는 왼쪽 — 오른쪽 아래 떠 있는 ＋ 버튼에 가리지 않게 */}
      <div className="flex items-center justify-between gap-2">
        <a href={n.url} target="_blank" rel="noopener noreferrer"
          className="min-h-[44px] -ml-2 px-2 inline-flex items-center gap-1 text-sm font-medium hover:text-muted-foreground">
          청약홈 공고 <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <span className="text-xs text-muted-foreground">당첨 발표 {md(n.winnerDate)}</span>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const CheongyakView = ({ readOnly = false }: { readOnly?: boolean }) => {
  // 폰 알림 지역 (워커)
  const [options, setOptions] = useState<string[]>(SIDO_OPTIONS);
  const [saved, setSaved] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [regionState, setRegionState] = useState<"loading" | "ok" | "error">("loading");
  const [savingRegions, setSavingRegions] = useState(false);

  // 공고
  const [result, setResult] = useState<NoticeResult | null>(null);
  const [loadingNotices, setLoadingNotices] = useState(true);
  const [phase, setPhase] = useState<PhaseFilter>("all");

  const loadRegions = useCallback(async () => {
    setRegionState("loading");
    try {
      const r = await getAlertRegions();
      setOptions(r.options);
      setSaved(r.regions);
      setPicked(r.regions);
      setRegionState("ok");
    } catch {
      setRegionState("error");
    }
  }, []);

  const loadNotices = useCallback(async () => {
    setLoadingNotices(true);
    setResult(await fetchCheongyakNotices());
    setLoadingNotices(false);
  }, []);

  useEffect(() => { loadRegions(); loadNotices(); }, [loadRegions, loadNotices]);

  const dirty = regionState === "ok" && !sameSet(saved, picked);

  const toggle = (r: string) => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));

  const saveRegions = async () => {
    setSavingRegions(true);
    try {
      const next = await putAlertRegions(picked);
      setSaved(next);
      setPicked(next);
      toast.success("폰 알림 지역 저장됨", {
        description: next.length ? `${next.join(" · ")} 새 공고를 폰으로 알려줘요` : "선택한 지역이 없어 알림이 가지 않아요",
      });
    } catch {
      toast.error("저장하지 못했어요", { description: "잠시 후 다시 시도해 주세요" });
    } finally {
      setSavingRegions(false);
    }
  };

  const items = useMemo(() => {
    if (result?.status !== "ok") return [];
    const today = todayYmd();
    return result.items
      .filter((n) => picked.length === 0 || picked.includes(n.sido))
      .filter((n) => phase === "all" || noticePhase(n, today) === phase);
  }, [result, picked, phase]);

  const counts = useMemo(() => {
    if (result?.status !== "ok") return { open: 0, upcoming: 0 };
    const inRegion = result.items.filter((n) => picked.length === 0 || picked.includes(n.sido));
    return {
      open: inRegion.filter((n) => noticePhase(n) === "open").length,
      upcoming: inRegion.filter((n) => noticePhase(n) === "upcoming").length,
    };
  }, [result, picked]);

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-6 space-y-4 xl:space-y-0">
      {/* 지역 & 알림 */}
      <section className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-3 xl:sticky xl:top-4 xl:self-start">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold flex items-center gap-1.5"><Bell className="h-4 w-4" /> 폰 알림 받는 지역</h3>
            <p className="text-xs text-muted-foreground mt-0.5">하루 3번 새 공고를 폰으로 보내요. 아래 목록도 이 지역으로 걸러져요.</p>
          </div>
          {regionState === "loading" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {options.map((r) => {
            const on = picked.includes(r);
            return (
              <button key={r} onClick={() => toggle(r)} aria-pressed={on}
                className={`min-h-[44px] min-w-[52px] px-3 rounded-full text-sm font-medium border transition-colors ${
                  on ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                }`}>
                {r}
              </button>
            );
          })}
        </div>

        {regionState === "error" && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">알림 서버에 연결하지 못했어요. 목록 필터로만 쓸 수 있어요.</p>
            <button onClick={loadRegions} className="min-h-[44px] px-2 text-sm font-medium shrink-0">다시 시도</button>
          </div>
        )}

        {regionState === "ok" && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-xs text-muted-foreground truncate">
              {dirty ? "변경됨 · 저장해야 알림에 반영돼요" : saved.length ? `알림 중: ${saved.join(" · ")}` : "알림 받는 지역 없음"}
            </p>
            <button onClick={saveRegions} disabled={!dirty || savingRegions || readOnly}
              className="min-h-[44px] px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-1.5 shrink-0">
              {savingRegions && <Loader2 className="h-4 w-4 animate-spin" />}알림 지역 저장
            </button>
          </div>
        )}
      </section>

      {/* 공고 목록 */}
      <section className="space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="grid grid-cols-3 gap-1 bg-muted rounded-xl p-1 flex-1 max-w-sm">
            {([
              ["all", `전체 ${counts.open + counts.upcoming}`],
              ["open", `접수 중 ${counts.open}`],
              ["upcoming", `예정 ${counts.upcoming}`],
            ] as [PhaseFilter, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setPhase(k)}
                className={`min-h-[40px] rounded-lg text-sm font-medium transition-colors ${phase === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={loadNotices} aria-label="새로고침" disabled={loadingNotices}
            className="h-11 w-11 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loadingNotices ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loadingNotices && !result ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-36 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : result?.status === "no-key" ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
            <KeyRound className="h-7 w-7 mx-auto text-muted-foreground/60" />
            <p className="font-semibold">공공데이터 키가 필요해요 · 설정에서 입력</p>
            <p className="text-sm text-muted-foreground">설정 → API 키 → 공공데이터포털 API Key 에 청약홈 분양정보 키를 넣으면 공고가 보여요.</p>
            <a href={APPLYHOME_LIST_URL} target="_blank" rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center gap-1 text-sm font-medium">
              청약홈에서 직접 보기 <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : result?.status === "key-not-registered" ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
            <KeyRound className="h-7 w-7 mx-auto text-muted-foreground/60" />
            <p className="font-semibold">이 공공데이터 키로는 청약 공고를 못 불러와요</p>
            <p className="text-sm text-muted-foreground">
              data.go.kr 에서 ‘한국부동산원_청약홈 분양정보 조회 서비스’를 활용신청한 뒤, 그 키를 설정 → API 키 → 공공데이터포털 API Key 에 넣어 주세요.
            </p>
            <a href="https://www.data.go.kr/data/15098547/openapi.do" target="_blank" rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center gap-1 text-sm font-medium">
              활용신청 페이지 <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : result?.status === "error" ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground/60" />
            <p className="font-semibold">공고를 불러오지 못했어요</p>
            <p className="text-sm text-muted-foreground break-all">{result.message}</p>
            <button onClick={loadNotices} className="min-h-[44px] px-4 rounded-lg bg-muted text-sm font-medium">다시 시도</button>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-1">
            <p className="font-semibold">지금 {phase === "upcoming" ? "예정된" : phase === "open" ? "접수 중인" : "진행·예정"} 공고가 없어요</p>
            <p className="text-sm text-muted-foreground">{picked.length ? `${picked.join(" · ")} 기준` : "전체 지역 기준"}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
            {items.map((n) => <NoticeCard key={n.id} n={n} />)}
          </ul>
        )}

        {result?.status === "ok" && (
          <p className="text-xs text-muted-foreground text-center">청약홈 공공데이터 · 마감 전 공고만 표시</p>
        )}
      </section>
    </div>
  );
};

export default CheongyakView;
