import { useEffect, useMemo, useState } from "react";
import {
  Building2, Home, ExternalLink, Plus, Pencil, Trash2, Search, X, MapPin, Smartphone, ChevronDown, Info, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  loadReFilters, saveReFilter, deleteReFilter, type ReFilterRow,
} from "@/services/supabaseSync";
import {
  AREA_OPTIONS, FREE_TEXT_PREFIX, NAVER_MOBILE_HOME, TRADE_LABEL,
  buildListingUrl, buildNaverSearchUrl, formatManwon, m2ToPyeong, pyeongToM2, resolveArea, searchAreas, searchTermFor,
  type AreaGroup, type AreaOption, type ListingKind, type ResolvedArea, type TradeType,
} from "@/services/realEstateLinks";

// ---------------------------------------------------------------------------
// 저장 조건 <-> re_filters 행 매핑
//   region_code / region_name : 콤마로 이어 붙인 cortarNo / 표시 이름 (기존 크롤러 포맷 그대로)
//   price_min / price_max     : 만원 (월세는 월세 금액 만원)
//   area_min / area_max       : ㎡ (= 평 × 3.3058)
// ---------------------------------------------------------------------------

interface Draft {
  id?: string;
  name: string;
  areas: ResolvedArea[];
  trade: TradeType;
  priceMin: string; // 억 (월세는 만원)
  priceMax: string;
  areaMin: string;  // 평
  areaMax: string;
}

const emptyDraft = (): Draft => ({ name: "", areas: [], trade: "A1", priceMin: "", priceMax: "", areaMin: "", areaMax: "" });

const priceUnit = (t: TradeType) => (t === "B2" ? 1 : 10000); // 입력 단위 → 만원

function rowAreas(row: ReFilterRow): ResolvedArea[] {
  const codes = (row.region_code || "").split(",").filter(Boolean);
  const names = (row.region_name || "").split(",");
  const areas = codes.map((c, i) => resolveArea(c.trim(), (names[i] || "").trim()));
  // 예전 필터 "광교" (region = 수원시 영통구) 처럼 이름이 신도시면 그 중심으로 열기
  if (areas.length === 1) {
    const hint = AREA_OPTIONS.find((o) => o.group === "추천" && o.cortarNo === areas[0].code && o.keywords?.[0] === row.name.trim());
    if (hint) return [{ key: hint.id, label: hint.label, code: hint.cortarNo, option: hint }];
  }
  return areas;
}

function toTrade(t: string): TradeType {
  return t === "B1" || t === "B2" ? t : "A1";
}

function fromRow(row: ReFilterRow): Draft {
  const trade = toTrade(row.trade_type);
  const unit = priceUnit(trade);
  const num = (v: number | null, div: number) => (v == null ? "" : String(Math.round((v / div) * 100) / 100));
  return {
    id: row.id,
    name: row.name,
    areas: rowAreas(row),
    trade,
    priceMin: num(row.price_min, unit),
    priceMax: num(row.price_max, unit),
    areaMin: row.area_min == null ? "" : String(m2ToPyeong(row.area_min)),
    areaMax: row.area_max == null ? "" : String(m2ToPyeong(row.area_max)),
  };
}

function autoName(d: Draft): string {
  if (d.areas.length === 0) return "새 조건";
  const first = d.areas[0].label.replace(/\s*\(.*\)/, "").replace(/^서울 /, "");
  return d.areas.length > 1 ? `${first} 외 ${d.areas.length - 1}곳` : first;
}

function toRow(d: Draft): ReFilterRow {
  const unit = priceUnit(d.trade);
  const n = (s: string) => (s.trim() === "" || isNaN(Number(s)) ? null : Number(s));
  const pMin = n(d.priceMin), pMax = n(d.priceMax), aMin = n(d.areaMin), aMax = n(d.areaMax);
  return {
    id: d.id || crypto.randomUUID(),
    name: d.name.trim() || autoName(d),
    region_code: d.areas.map((a) => a.code).join(","),
    region_name: d.areas.map((a) => a.label.replace(/,/g, " ")).join(","),
    trade_type: d.trade,
    price_min: pMin == null ? null : Math.round(pMin * unit),
    price_max: pMax == null ? null : Math.round(pMax * unit),
    area_min: aMin == null ? null : pyeongToM2(aMin),
    area_max: aMax == null ? null : pyeongToM2(aMax),
    is_active: true,
  };
}

function priceText(row: ReFilterRow): string | null {
  const { price_min: a, price_max: b } = row;
  if (a == null && b == null) return null;
  const prefix = row.trade_type === "B2" ? "월세 " : "";
  if (a != null && b != null) return `${prefix}${formatManwon(a)}~${formatManwon(b)}`;
  if (a != null) return `${prefix}${formatManwon(a)} 이상`;
  return `${prefix}${formatManwon(b as number)} 이하`;
}

function areaText(row: ReFilterRow): string | null {
  const { area_min: a, area_max: b } = row;
  if (a == null && b == null) return null;
  if (a != null && b != null) return `${m2ToPyeong(a)}~${m2ToPyeong(b)}평`;
  if (a != null) return `${m2ToPyeong(a)}평 이상`;
  return `${m2ToPyeong(b as number)}평 이하`;
}

function areaM2Text(row: ReFilterRow): string | null {
  const { area_min: a, area_max: b } = row;
  if (a == null && b == null) return null;
  const f = (v: number) => `${Math.round(v)}㎡`;
  if (a != null && b != null) return `${f(a)}~${f(b)}`;
  return a != null ? `${f(a)} 이상` : `${f(b as number)} 이하`;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const PRICE_PRESETS: Record<TradeType, { label: string; min: string; max: string }[]> = {
  A1: [
    { label: "~5억", min: "", max: "5" },
    { label: "5~10억", min: "5", max: "10" },
    { label: "10~15억", min: "10", max: "15" },
    { label: "15억~", min: "15", max: "" },
  ],
  B1: [
    { label: "~3억", min: "", max: "3" },
    { label: "3~5억", min: "3", max: "5" },
    { label: "5~8억", min: "5", max: "8" },
    { label: "8억~", min: "8", max: "" },
  ],
  B2: [
    { label: "~100만", min: "", max: "100" },
    { label: "100~200만", min: "100", max: "200" },
    { label: "200만~", min: "200", max: "" },
  ],
};

const AREA_PRESETS = [
  { label: "10평대", min: "10", max: "19" },
  { label: "20평대", min: "20", max: "29" },
  { label: "30평대", min: "30", max: "39" },
  { label: "40평 이상", min: "40", max: "" },
];

// ---------------------------------------------------------------------------
// Small UI bits
// ---------------------------------------------------------------------------

const chipCls = (on: boolean) =>
  `min-h-[44px] px-3.5 rounded-full text-sm font-medium border transition-colors ${
    on ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
  }`;

const inputCls =
  "w-full min-h-[44px] bg-background border border-border rounded-lg px-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/30";

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{children}</span>
);

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

const GROUPS: AreaGroup[] = ["추천", "경기", "서울"];
const GROUP_LABEL: Record<AreaGroup, string> = { 추천: "자주 찾는 곳", 경기: "경기", 서울: "서울 25개 구" };

function SearchEditor({ initial, onCancel, onSave, onDelete, saving }: {
  initial: Draft;
  onCancel: () => void;
  onSave: (d: Draft) => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [query, setQuery] = useState("");
  const [openGroup, setOpenGroup] = useState<AreaGroup | null>("추천");

  const results = useMemo(() => searchAreas(query).slice(0, 8), [query]);
  const has = (o: AreaOption) => d.areas.some((a) => a.option?.id === o.id);

  const toggleArea = (o: AreaOption) => {
    setD((p) => has(o)
      ? { ...p, areas: p.areas.filter((a) => a.option?.id !== o.id) }
      : { ...p, areas: [...p.areas, { key: o.id, label: o.label, code: o.cortarNo, option: o }] });
  };
  const addFreeText = () => {
    const q = query.trim();
    if (!q) return;
    const code = `${FREE_TEXT_PREFIX}${q.replace(/,/g, " ")}`;
    if (!d.areas.some((a) => a.code === code)) {
      setD((p) => ({ ...p, areas: [...p.areas, { key: code, label: q, code, option: null }] }));
    }
    setQuery("");
  };
  const removeArea = (key: string) => setD((p) => ({ ...p, areas: p.areas.filter((a) => a.key !== key) }));

  const unitLabel = d.trade === "B2" ? "만원" : "억";
  const presets = PRICE_PRESETS[d.trade];

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{initial.id ? "조건 수정" : "새 조건"}</h3>
        <button onClick={onCancel} aria-label="닫기" className="h-11 w-11 -mr-2 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 이름 */}
      <div className="space-y-1.5">
        <label className="text-sm text-muted-foreground" htmlFor="pf-name">이름</label>
        <input id="pf-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })}
          placeholder={autoName(d)} className={inputCls} />
      </div>

      {/* 위치 */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">위치 {d.areas.length > 0 && <span className="text-foreground">· {d.areas.length}곳</span>}</p>
        {d.areas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {d.areas.map((a) => (
              <span key={a.key} className="inline-flex items-center gap-1 rounded-full bg-foreground text-background pl-3 pr-1 min-h-[36px] text-sm">
                {!a.option && <Search className="h-3.5 w-3.5 opacity-70" />}
                {a.label}
                <button onClick={() => removeArea(a.key)} aria-label={`${a.label} 빼기`}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-background/20">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (results[0]) { toggleArea(results[0]); setQuery(""); } else addFreeText(); } }}
            placeholder="시·구·동 검색 (예: 광교, 분당, 마포)" className={`${inputCls} pl-9`} />
        </div>
        {query.trim() && (
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {results.map((o) => (
              <button key={o.id} onClick={() => { toggleArea(o); setQuery(""); }}
                className="w-full min-h-[44px] px-3 flex items-center justify-between text-left text-sm hover:bg-muted">
                <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{o.label}</span>
                {has(o) && <span className="text-xs text-muted-foreground">선택됨</span>}
              </button>
            ))}
            <button onClick={addFreeText} className="w-full min-h-[44px] px-3 flex items-center gap-2 text-left text-sm text-muted-foreground hover:bg-muted">
              <Search className="h-4 w-4" /> ‘{query.trim()}’ 검색어로 추가 <span className="text-xs">(네이버 검색으로 열려요)</span>
            </button>
          </div>
        )}
        <div className="space-y-2">
          {GROUPS.map((g) => {
            const items = AREA_OPTIONS.filter((o) => o.group === g);
            const open = openGroup === g;
            const picked = items.filter(has).length;
            return (
              <div key={g} className="rounded-xl border border-border">
                <button onClick={() => setOpenGroup(open ? null : g)}
                  className="w-full min-h-[44px] px-3 flex items-center justify-between text-sm font-medium">
                  <span>{GROUP_LABEL[g]} {picked > 0 && <span className="text-muted-foreground font-normal">· {picked}</span>}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                    {items.map((o) => (
                      <button key={o.id} onClick={() => toggleArea(o)} className={chipCls(has(o))}>
                        {g === "서울" ? o.label.replace(/^서울 /, "") : o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 거래유형 */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">거래 유형</p>
        <div className="grid grid-cols-3 gap-1 bg-muted rounded-xl p-1">
          {(["A1", "B1", "B2"] as TradeType[]).map((t) => (
            <button key={t} onClick={() => setD({ ...d, trade: t, priceMin: t === d.trade ? d.priceMin : "", priceMax: t === d.trade ? d.priceMax : "" })}
              className={`min-h-[44px] rounded-lg text-sm font-medium transition-colors ${d.trade === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {TRADE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* 가격 */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{d.trade === "B2" ? "월세" : d.trade === "B1" ? "전세가" : "매매가"} ({unitLabel})</p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => {
            const on = d.priceMin === p.min && d.priceMax === p.max;
            return (
              <button key={p.label} onClick={() => setD({ ...d, priceMin: on ? "" : p.min, priceMax: on ? "" : p.max })} className={chipCls(on)}>
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input inputMode="decimal" value={d.priceMin} onChange={(e) => setD({ ...d, priceMin: e.target.value.replace(/[^0-9.]/g, "") })}
            placeholder="최소" aria-label="최소 가격" className={inputCls} />
          <span className="text-muted-foreground">~</span>
          <input inputMode="decimal" value={d.priceMax} onChange={(e) => setD({ ...d, priceMax: e.target.value.replace(/[^0-9.]/g, "") })}
            placeholder="최대" aria-label="최대 가격" className={inputCls} />
          <span className="text-sm text-muted-foreground shrink-0">{unitLabel}</span>
        </div>
      </div>

      {/* 평수 */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">평수 (평)</p>
        <div className="flex flex-wrap gap-1.5">
          {AREA_PRESETS.map((p) => {
            const on = d.areaMin === p.min && d.areaMax === p.max;
            return (
              <button key={p.label} onClick={() => setD({ ...d, areaMin: on ? "" : p.min, areaMax: on ? "" : p.max })} className={chipCls(on)}>
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input inputMode="numeric" value={d.areaMin} onChange={(e) => setD({ ...d, areaMin: e.target.value.replace(/[^0-9]/g, "") })}
            placeholder="최소" aria-label="최소 평수" className={inputCls} />
          <span className="text-muted-foreground">~</span>
          <input inputMode="numeric" value={d.areaMax} onChange={(e) => setD({ ...d, areaMax: e.target.value.replace(/[^0-9]/g, "") })}
            placeholder="최대" aria-label="최대 평수" className={inputCls} />
          <span className="text-sm text-muted-foreground shrink-0">평</span>
        </div>
        {(d.areaMin || d.areaMax) && (
          <p className="text-xs text-muted-foreground">
            = {d.areaMin ? `${Math.round(pyeongToM2(Number(d.areaMin)))}㎡` : ""}{d.areaMin || d.areaMax ? " ~ " : ""}{d.areaMax ? `${Math.round(pyeongToM2(Number(d.areaMax)))}㎡` : ""} (1평 = 3.3058㎡)
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        {onDelete && (
          <button onClick={onDelete} aria-label="조건 삭제"
            className="h-11 w-11 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <div className="flex-1" />
        <button onClick={onCancel} className="min-h-[44px] px-4 rounded-lg bg-muted text-sm font-medium">취소</button>
        <button onClick={() => onSave(d)} disabled={d.areas.length === 0 || saving}
          className="min-h-[44px] px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}저장
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results (open Naver)
// ---------------------------------------------------------------------------

function OpenCard({ href, icon, title, sub }: { href: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" data-naver-link={href}
      className="group flex items-center gap-3 rounded-2xl bg-primary text-primary-foreground px-4 py-4 min-h-[72px] active:scale-[0.99] transition-transform">
      <span className="h-11 w-11 shrink-0 rounded-xl bg-primary-foreground/10 inline-flex items-center justify-center">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-base font-semibold">{title}</span>
        <span className="block text-xs opacity-70 truncate">{sub}</span>
      </span>
      <ExternalLink className="h-4 w-4 opacity-70 group-hover:opacity-100" />
    </a>
  );
}

function ResultPanel({ row, onEdit }: { row: ReFilterRow; onEdit: () => void }) {
  const areas = useMemo(() => rowAreas(row), [row]);
  const [areaKey, setAreaKey] = useState<string | null>(null);
  const area = areas.find((a) => a.key === areaKey) ?? areas[0];
  const trade = toTrade(row.trade_type);
  const price = priceText(row);
  const size = areaText(row);
  const sizeM2 = areaM2Text(row);

  if (!area) return null;
  const kinds: { kind: ListingKind; title: string; icon: React.ReactNode }[] = [
    { kind: "apt", title: "아파트 매물 보기", icon: <Building2 className="h-5 w-5" /> },
    { kind: "house", title: "단독·다가구 매물 보기", icon: <Home className="h-5 w-5" /> },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">지금 네이버에서 보기</p>
          <h3 className="text-lg font-semibold truncate">{row.name}</h3>
        </div>
        <button onClick={onEdit} aria-label="조건 수정"
          className="h-11 w-11 -mr-2 shrink-0 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {areas.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {areas.map((a) => (
            <button key={a.key} onClick={() => setAreaKey(a.key)} className={`${chipCls(a.key === area.key)} shrink-0`}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {kinds.map((k) => (
          <OpenCard key={k.kind} href={buildListingUrl(area, k.kind, trade)} icon={k.icon} title={k.title}
            sub={`${area.label} · ${TRADE_LABEL[trade]}${area.option ? "" : " · 검색"}`} />
        ))}
      </div>

      {(price || size) && (
        <div className="rounded-xl bg-muted/60 p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {price && <span className="rounded-full bg-card border border-border px-3 py-1 text-sm">{price}</span>}
            {size && <span className="rounded-full bg-card border border-border px-3 py-1 text-sm">{size}{sizeM2 ? ` · ${sizeM2}` : ""}</span>}
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            지역·매물종류·거래유형은 자동으로 적용돼요. 가격·면적은 네이버 화면의 필터에서 한 번 더 골라 주세요.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
        <a href={buildNaverSearchUrl(searchTermFor(area))} target="_blank" rel="noopener noreferrer"
          className="min-h-[44px] inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Search className="h-4 w-4" /> ‘{searchTermFor(area)}’ 검색으로 열기
        </a>
        <a href={NAVER_MOBILE_HOME} target="_blank" rel="noopener noreferrer"
          className="min-h-[44px] inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Smartphone className="h-4 w-4" /> 네이버 부동산 앱에서 열기
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saved search list item
// ---------------------------------------------------------------------------

function SavedItem({ row, active, onSelect }: { row: ReFilterRow; active: boolean; onSelect: () => void }) {
  const areas = rowAreas(row);
  const price = priceText(row);
  const size = areaText(row);
  return (
    <button onClick={onSelect} aria-pressed={active}
      className={`snap-start shrink-0 w-[240px] xl:w-full text-left rounded-2xl border px-4 py-3 min-h-[44px] transition-colors ${
        active ? "border-foreground bg-card" : "border-border bg-card/60 hover:bg-card"
      }`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${active ? "bg-love" : "bg-border"}`} />
        <span className="font-semibold text-sm truncate">{row.name}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1 truncate">{areas.map((a) => a.label).join(" · ")}</p>
      <div className="flex flex-wrap gap-1 mt-2">
        <Tag>{TRADE_LABEL[toTrade(row.trade_type)]}</Tag>
        {price && <Tag>{price}</Tag>}
        {size && <Tag>{size}</Tag>}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const PropertyFinder = () => {
  const [rows, setRows] = useState<ReFilterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    loadReFilters().then((r) => {
      if (!alive) return;
      setRows(r);
      setSelectedId(r[0]?.id ?? null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  const handleSave = async (d: Draft) => {
    const row = toRow(d);
    setSaving(true);
    await saveReFilter(row);
    setSaving(false);
    setRows((prev) => (prev.some((r) => r.id === row.id) ? prev.map((r) => (r.id === row.id ? row : r)) : [...prev, row]));
    setSelectedId(row.id);
    setEditing(null);
    toast.success(`‘${row.name}’ 저장됨`, { description: "두 폰에서 같은 조건이 보여요" });
  };

  const handleDelete = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!(await confirmDialog({ title: `‘${row?.name ?? "조건"}’ 삭제할까요?`, confirmText: "삭제" }))) return;
    await deleteReFilter(id);
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (selectedId === id) setSelectedId(null);
    setEditing(null);
    toast("조건을 삭제했어요");
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-24 rounded-2xl bg-muted animate-pulse" />
        <div className="h-48 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  const intro = (
    <p className="text-sm text-muted-foreground">
      저장한 조건으로 네이버페이 부동산을 바로 열어요. 지금 올라와 있는 매물을 네이버 화면에서 직접 확인해요.
    </p>
  );

  // 조건이 하나도 없을 때
  if (rows.length === 0 && !editing) {
    return (
      <div className="space-y-4">
        {intro}
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3">
          <MapPin className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <div>
            <p className="font-semibold">저장한 조건이 없어요</p>
            <p className="text-sm text-muted-foreground mt-1">지역·가격·평수를 저장해 두면 두 폰에서 한 번에 열 수 있어요.</p>
          </div>
          <button onClick={() => setEditing(emptyDraft())}
            className="min-h-[44px] px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> 첫 조건 만들기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-16 xl:pb-0">
      {intro}
      <div className="xl:grid xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-6 space-y-4 xl:space-y-0">
        {/* 저장된 조건 */}
        <section className="space-y-2 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">내 조건 <span className="text-muted-foreground font-normal">{rows.length}</span></h3>
            <button onClick={() => setEditing(emptyDraft())}
              className="min-h-[44px] -mr-2 px-2 inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-muted-foreground">
              <Plus className="h-4 w-4" /> 새 조건
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto snap-x scrollbar-hide pb-1 xl:flex-col xl:overflow-visible">
            {rows.map((r) => (
              <SavedItem key={r.id} row={r} active={selected?.id === r.id && !editing}
                onSelect={() => { setSelectedId(r.id); setEditing(null); }} />
            ))}
          </div>
        </section>

        {/* 결과 / 편집 */}
        <section className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          {editing ? (
            <SearchEditor key={editing.id ?? "new"} initial={editing} saving={saving}
              onCancel={() => setEditing(null)} onSave={handleSave}
              onDelete={editing.id ? () => handleDelete(editing.id as string) : undefined} />
          ) : selected ? (
            <ResultPanel key={selected.id} row={selected} onEdit={() => setEditing(fromRow(selected))} />
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default PropertyFinder;
