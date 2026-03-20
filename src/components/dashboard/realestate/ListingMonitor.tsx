import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, ExternalLink, Loader2, X, Bell, ChevronDown, ArrowUpDown, TrendingDown, TrendingUp } from "lucide-react";
import {
  loadReFilters, loadReListings, loadReRegions, saveReFilter, deleteReFilter,
  type ReFilterRow, type ReListingRow, type ReRegionRow,
} from "../../../services/supabaseSync";

// ---------------------------------------------------------------------------
// 가격 포맷
// ---------------------------------------------------------------------------
function formatPrice(priceMan: number): string {
  if (!priceMan) return "-";
  if (priceMan >= 10000) {
    const eok = Math.floor(priceMan / 10000);
    const rest = priceMan % 10000;
    return rest > 0 ? `${eok}억 ${rest.toLocaleString()}` : `${eok}억`;
  }
  return `${priceMan.toLocaleString()}만`;
}

// ---------------------------------------------------------------------------
// 정렬 옵션
// ---------------------------------------------------------------------------
type SortKey = "newest" | "price_asc" | "price_desc" | "area_desc";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "최신순" },
  { key: "price_asc", label: "가격 낮은순" },
  { key: "price_desc", label: "가격 높은순" },
  { key: "area_desc", label: "면적 넓은순" },
];

function sortListings(list: ReListingRow[], key: SortKey): ReListingRow[] {
  const sorted = [...list];
  switch (key) {
    case "newest": return sorted; // DB 기본 정렬 (first_seen_at desc)
    case "price_asc": return sorted.sort((a, b) => (a.price_man || 0) - (b.price_man || 0));
    case "price_desc": return sorted.sort((a, b) => (b.price_man || 0) - (a.price_man || 0));
    case "area_desc": return sorted.sort((a, b) => (b.area_pyeong || 0) - (a.area_pyeong || 0));
  }
}

// ---------------------------------------------------------------------------
// 가격 프리셋
// ---------------------------------------------------------------------------
const PRICE_PRESETS_SALE = [
  { label: "전체", min: "", max: "" },
  { label: "~5억", min: "", max: "5" },
  { label: "5~10억", min: "5", max: "10" },
  { label: "10~15억", min: "10", max: "15" },
  { label: "15~20억", min: "15", max: "20" },
  { label: "20억~", min: "20", max: "" },
];
const PRICE_PRESETS_JEONSE = [
  { label: "전체", min: "", max: "" },
  { label: "~2억", min: "", max: "2" },
  { label: "2~4억", min: "2", max: "4" },
  { label: "4~6억", min: "4", max: "6" },
  { label: "6~10억", min: "6", max: "10" },
  { label: "10억~", min: "10", max: "" },
];
const PRICE_PRESETS_RENT = [
  { label: "전체", min: "", max: "" },
  { label: "~50만", min: "", max: "50" },
  { label: "50~100만", min: "50", max: "100" },
  { label: "100~150만", min: "100", max: "150" },
  { label: "150만~", min: "150", max: "" },
];

const AREA_PRESETS = [
  { label: "전체", min: "" },
  { label: "10평+", min: "10" },
  { label: "20평+", min: "20" },
  { label: "25평+", min: "25" },
  { label: "30평+", min: "30" },
  { label: "40평+", min: "40" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const ListingMonitor = () => {
  const [filters, setFilters] = useState<ReFilterRow[]>([]);
  const [listings, setListings] = useState<ReListingRow[]>([]);
  const [regions, setRegions] = useState<ReRegionRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [showSort, setShowSort] = useState(false);

  // Filter form
  const [form, setForm] = useState({
    name: "", regionCode: "", regionName: "",
    tradeType: "A1", priceMin: "", priceMax: "", areaMin: "",
  });

  // 지역 그룹화 (서울 / 경기 / 기타)
  const regionGroups = useMemo(() => {
    const groups: Record<string, ReRegionRow[]> = {};
    for (const r of regions) {
      const key = r.city_name?.startsWith("서울") || r.display_name?.startsWith("서울") ? "서울" :
        ["성남시", "용인시", "수원시", "과천시", "하남시", "광명시", "안양시", "고양시", "화성시", "김포시", "파주시", "남양주시", "의정부시", "부천시", "평택시"].some(c => r.city_name?.includes(c) || r.display_name?.includes(c)) ? "경기" : "기타";
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return groups;
  }, [regions]);

  useEffect(() => {
    Promise.all([loadReFilters(), loadReListings(), loadReRegions()]).then(([f, l, r]) => {
      setFilters(f);
      setListings(l);
      setRegions(r);
      setLoading(false);
    });
  }, []);

  // 매매유형에 따른 가격 프리셋 / 단위
  const pricePresets = form.tradeType === "A1" ? PRICE_PRESETS_SALE :
    form.tradeType === "B1" ? PRICE_PRESETS_JEONSE : PRICE_PRESETS_RENT;
  const priceUnit = form.tradeType === "B2" ? "만원" : "억";
  const priceMultiplier = form.tradeType === "B2" ? 1 : 10000; // 만원 or 억→만원

  // 자동 필터명 생성
  const autoName = useMemo(() => {
    const parts: string[] = [];
    if (form.regionName) parts.push(form.regionName.replace("서울 ", "").replace("성남시 ", "").replace("용인시 ", ""));
    const tradeLabel = form.tradeType === "A1" ? "매매" : form.tradeType === "B1" ? "전세" : "월세";
    parts.push(tradeLabel);
    if (form.priceMin || form.priceMax) {
      const u = form.tradeType === "B2" ? "만" : "억";
      parts.push(`${form.priceMin || "0"}~${form.priceMax || "∞"}${u}`);
    }
    if (form.areaMin) parts.push(`${form.areaMin}평+`);
    return parts.join(" ");
  }, [form]);

  const handleAddFilter = async () => {
    if (!form.regionCode) return;
    const filterName = form.name.trim() || autoName;
    const filter: ReFilterRow = {
      id: crypto.randomUUID(),
      name: filterName,
      region_code: form.regionCode,
      region_name: form.regionName,
      trade_type: form.tradeType,
      price_min: form.priceMin ? parseInt(form.priceMin) * priceMultiplier : null,
      price_max: form.priceMax ? parseInt(form.priceMax) * priceMultiplier : null,
      area_min: form.areaMin ? parseFloat(form.areaMin) * 3.3058 : null,
      area_max: null,
      is_active: true,
    };
    await saveReFilter(filter);
    setFilters((prev) => [...prev, filter]);
    setForm({ name: "", regionCode: "", regionName: "", tradeType: "A1", priceMin: "", priceMax: "", areaMin: "" });
    setShowForm(false);
    setSavedMsg(`"${filterName}" 필터가 저장되었습니다. 다음 크롤링 시 매물이 수집됩니다.`);
    setTimeout(() => setSavedMsg(""), 5000);
  };

  const handleDeleteFilter = async (id: string) => {
    await deleteReFilter(id);
    setFilters((prev) => prev.filter((f) => f.id !== id));
    if (activeFilter === id) setActiveFilter(null);
  };

  const filteredListings = activeFilter
    ? listings.filter((l) => l.filter_id === activeFilter)
    : listings;
  const activeListings = sortListings(filteredListings.filter((l) => l.status === "active"), sortKey);

  // 현재 필터 요약
  const activeFilterObj = filters.find((f) => f.id === activeFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 필터 영역 */}
      <div className="bg-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">내 모니터링 필터</h3>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
            <Plus className="h-3.5 w-3.5" /> 필터 추가
          </button>
        </div>

        {/* 필터 추가 폼 */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-muted/30 rounded-lg p-4 mb-3 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">새 필터</span>
                  <button onClick={() => setShowForm(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                </div>

                {/* 지역 선택 */}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1.5 block font-medium">지역 선택</label>
                  <select value={form.regionCode} onChange={(e) => {
                    const r = regions.find((r) => r.cortar_no === e.target.value);
                    setForm({ ...form, regionCode: e.target.value, regionName: r?.display_name || "" });
                  }} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">지역을 선택하세요</option>
                    {Object.entries(regionGroups).map(([group, items]) => (
                      <optgroup key={group} label={`── ${group} ──`}>
                        {items.map((r) => (
                          <option key={r.cortar_no} value={r.cortar_no}>{r.display_name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* 매매유형 */}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1.5 block font-medium">매매유형</label>
                  <div className="flex gap-2">
                    {[
                      { value: "A1", label: "매매" },
                      { value: "B1", label: "전세" },
                      { value: "B2", label: "월세" },
                    ].map((opt) => (
                      <button key={opt.value}
                        onClick={() => setForm({ ...form, tradeType: opt.value, priceMin: "", priceMax: "" })}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                          form.tradeType === opt.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 가격 범위 */}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1.5 block font-medium">
                    가격 범위 ({priceUnit})
                  </label>
                  {/* 프리셋 버튼 */}
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {pricePresets.map((p) => {
                      const isActive = form.priceMin === p.min && form.priceMax === p.max;
                      return (
                        <button key={p.label}
                          onClick={() => setForm({ ...form, priceMin: p.min, priceMax: p.max })}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                            isActive
                              ? "bg-primary/15 text-primary border border-primary/30"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent"
                          }`}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  {/* 직접 입력 */}
                  <div className="flex gap-1.5 items-center">
                    <input type="number" value={form.priceMin} onChange={(e) => setForm({ ...form, priceMin: e.target.value })}
                      placeholder="최소" className="w-full bg-background border border-border rounded-lg px-2.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    <span className="text-xs text-muted-foreground flex-shrink-0">~</span>
                    <input type="number" value={form.priceMax} onChange={(e) => setForm({ ...form, priceMax: e.target.value })}
                      placeholder="최대" className="w-full bg-background border border-border rounded-lg px-2.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{priceUnit}</span>
                  </div>
                </div>

                {/* 면적 */}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1.5 block font-medium">최소 면적 (평)</label>
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {AREA_PRESETS.map((p) => {
                      const isActive = form.areaMin === p.min;
                      return (
                        <button key={p.label}
                          onClick={() => setForm({ ...form, areaMin: p.min })}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                            isActive
                              ? "bg-primary/15 text-primary border border-primary/30"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent"
                          }`}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <input type="number" value={form.areaMin} onChange={(e) => setForm({ ...form, areaMin: e.target.value })}
                    placeholder="직접 입력 (평)" className="w-full bg-background border border-border rounded-lg px-2.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>

                {/* 필터 이름 */}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1.5 block font-medium">필터 이름 (선택)</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={autoName || "자동 생성됩니다"} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  {autoName && !form.name && (
                    <p className="text-[10px] text-muted-foreground/60 mt-1">미입력 시: "{autoName}"</p>
                  )}
                </div>

                <button onClick={handleAddFilter} disabled={!form.regionCode}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
                  필터 저장
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 필터 칩 */}
        {filters.length === 0 && !showForm ? (
          <div className="text-center py-6">
            <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">아직 설정된 필터가 없어요</p>
            <p className="text-xs text-muted-foreground/60 mt-1">필터를 만들면 크롤러가 자동으로 매물을 수집합니다</p>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
            <button onClick={() => setActiveFilter(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-colors ${
                activeFilter === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}>
              전체 ({listings.filter((l) => l.status === "active").length})
            </button>
            {filters.map((f) => {
              const count = listings.filter((l) => l.filter_id === f.id && l.status === "active").length;
              const tradeLabel = f.trade_type === "A1" ? "매매" : f.trade_type === "B1" ? "전세" : "월세";
              return (
                <div key={f.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-colors cursor-pointer ${
                  activeFilter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                  <span onClick={() => setActiveFilter(f.id)}>{f.name}</span>
                  <span className={`text-[9px] ${activeFilter === f.id ? "opacity-70" : "opacity-50"}`}>
                    {count}건
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteFilter(f.id); }}
                    className="ml-0.5 hover:text-destructive opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 매물 헤더 (필터 요약 + 정렬) */}
      {activeListings.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="text-xs text-muted-foreground">
            {activeFilterObj ? (
              <span>
                <span className="font-medium text-foreground">{activeFilterObj.region_name}</span>
                {" · "}
                {activeFilterObj.trade_type === "A1" ? "매매" : activeFilterObj.trade_type === "B1" ? "전세" : "월세"}
                {activeFilterObj.price_min || activeFilterObj.price_max ? (
                  <> · {formatPrice(activeFilterObj.price_min || 0)}~{activeFilterObj.price_max ? formatPrice(activeFilterObj.price_max) : "∞"}</>
                ) : null}
              </span>
            ) : (
              <span className="font-medium text-foreground">{activeListings.length}건</span>
            )}
          </div>
          <div className="relative">
            <button onClick={() => setShowSort(!showSort)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowUpDown className="h-3 w-3" />
              {SORT_OPTIONS.find((o) => o.key === sortKey)?.label}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showSort && (
              <div className="absolute right-0 top-6 z-10 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
                {SORT_OPTIONS.map((opt) => (
                  <button key={opt.key}
                    onClick={() => { setSortKey(opt.key); setShowSort(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors ${
                      sortKey === opt.key ? "text-primary font-medium" : "text-foreground"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 매물 리스트 */}
      {activeListings.length > 0 && (
        <div className="space-y-2">
          {activeListings.map((listing) => (
            <motion.div key={listing.id} className="bg-card rounded-xl p-4"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {listing.is_new && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">NEW</span>
                    )}
                    <h4 className="text-sm font-bold truncate">{listing.complex_name}</h4>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-base font-bold text-foreground">{listing.price_text || formatPrice(listing.price_man)}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                      {listing.area_pyeong != null && <span>{listing.area_pyeong}평</span>}
                      {listing.floor_info && <span>{listing.floor_info}</span>}
                      {listing.direction && <span>{listing.direction}</span>}
                    </div>
                  </div>
                  {listing.description && (
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{listing.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  {listing.detail_url && (
                    <a href={listing.detail_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted transition-colors">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {savedMsg && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 text-xs text-primary">
          {savedMsg}
        </motion.div>
      )}

      {filters.length > 0 && activeListings.length === 0 && (
        <div className="text-center py-10">
          <Bell className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">수집된 매물이 없습니다</p>
          <p className="text-xs text-muted-foreground/60 mt-1">크롤러가 4시간마다 자동 수집합니다 (08/12/16/20/00시)</p>
        </div>
      )}
    </div>
  );
};

export default ListingMonitor;
