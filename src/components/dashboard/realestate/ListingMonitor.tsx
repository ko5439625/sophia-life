import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, ExternalLink, Star, Loader2, X, Bell } from "lucide-react";
import {
  loadReFilters, loadReListings, loadReRegions, saveReFilter, deleteReFilter,
  type ReFilterRow, type ReListingRow, type ReRegionRow,
} from "../../../services/supabaseSync";
import { formatKRW } from "../finance/budgetData";

const ListingMonitor = () => {
  const [filters, setFilters] = useState<ReFilterRow[]>([]);
  const [listings, setListings] = useState<ReListingRow[]>([]);
  const [regions, setRegions] = useState<ReRegionRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  // Filter form
  const [form, setForm] = useState({
    name: "", regionCode: "", regionName: "",
    tradeType: "A1", priceMin: "", priceMax: "", areaMin: "",
  });

  useEffect(() => {
    Promise.all([loadReFilters(), loadReListings(), loadReRegions()]).then(([f, l, r]) => {
      setFilters(f);
      setListings(l);
      setRegions(r);
      setLoading(false);
    });
  }, []);

  const handleAddFilter = async () => {
    if (!form.name.trim() || !form.regionCode) return;
    const filter: ReFilterRow = {
      id: crypto.randomUUID(),
      name: form.name,
      region_code: form.regionCode,
      region_name: form.regionName,
      trade_type: form.tradeType,
      price_min: form.priceMin ? parseInt(form.priceMin) * 10000 : null,
      price_max: form.priceMax ? parseInt(form.priceMax) * 10000 : null,
      area_min: form.areaMin ? parseFloat(form.areaMin) * 3.3058 : null,
      area_max: null,
      is_active: true,
    };
    await saveReFilter(filter);
    setFilters((prev) => [...prev, filter]);
    setForm({ name: "", regionCode: "", regionName: "", tradeType: "A1", priceMin: "", priceMax: "", areaMin: "" });
    setShowForm(false);
    setSavedMsg(`"${filter.name}" 필터가 저장되었습니다. 크롤러 실행 시 매물이 수집됩니다.`);
    setTimeout(() => setSavedMsg(""), 5000);
  };

  const handleDeleteFilter = async (id: string) => {
    await deleteReFilter(id);
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  const filteredListings = activeFilter
    ? listings.filter((l) => l.filter_id === activeFilter)
    : listings;
  const activeListings = filteredListings.filter((l) => l.status === "active");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
              <div className="bg-muted/30 rounded-lg p-4 mb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">새 필터</span>
                  <button onClick={() => setShowForm(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">필터 이름</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="분당 5-9억 25평+" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">지역</label>
                    <select value={form.regionCode} onChange={(e) => {
                      const r = regions.find((r) => r.cortar_no === e.target.value);
                      setForm({ ...form, regionCode: e.target.value, regionName: r?.display_name || "" });
                    }} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">지역 선택</option>
                      {regions.map((r) => (
                        <option key={r.cortar_no} value={r.cortar_no}>{r.display_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">매매유형</label>
                    <select value={form.tradeType} onChange={(e) => setForm({ ...form, tradeType: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="A1">매매</option>
                      <option value="B1">전세</option>
                      <option value="B2">월세</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">{"가격 (억)"}</label>
                    <div className="flex gap-1 items-center">
                      <input type="number" value={form.priceMin} onChange={(e) => setForm({ ...form, priceMin: e.target.value })}
                        placeholder="5" className="w-full bg-background border border-border rounded-lg px-2 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      <span className="text-xs text-muted-foreground">~</span>
                      <input type="number" value={form.priceMax} onChange={(e) => setForm({ ...form, priceMax: e.target.value })}
                        placeholder="9" className="w-full bg-background border border-border rounded-lg px-2 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">{"면적 (평) 이상"}</label>
                    <input type="number" value={form.areaMin} onChange={(e) => setForm({ ...form, areaMin: e.target.value })}
                      placeholder="25" className="w-full bg-background border border-border rounded-lg px-2 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>
                <button onClick={handleAddFilter} disabled={!form.name || !form.regionCode}
                  className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-40">
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
            <p className="text-[10px] text-muted-foreground/40 mt-3">{"크롤러: sophia-life/crawler/ (Python, 별도 실행)"}</p>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
            <button onClick={() => setActiveFilter(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-colors ${
                activeFilter === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
              전체 ({listings.filter((l) => l.status === "active").length})
            </button>
            {filters.map((f) => {
              const count = listings.filter((l) => l.filter_id === f.id && l.status === "active").length;
              const tradeLabel = f.trade_type === "A1" ? "매매" : f.trade_type === "B1" ? "전세" : "월세";
              return (
                <div key={f.id} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-colors cursor-pointer ${
                  activeFilter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  <span onClick={() => setActiveFilter(f.id)}>{f.name} ({count})</span>
                  <span className="text-[9px] opacity-60">{tradeLabel}</span>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteFilter(f.id); }}
                    className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-mono">
                    <span className="text-base font-bold text-foreground">{listing.price_text || `${formatKRW(listing.price_man)}만`}</span>
                    {listing.area_pyeong && <span>{listing.area_pyeong}평</span>}
                    {listing.floor_info && <span>{listing.floor_info}층</span>}
                    {listing.direction && <span>{listing.direction}</span>}
                  </div>
                  {listing.description && (
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{listing.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  {listing.detail_url && (
                    <a href={listing.detail_url} target="_blank" rel="noopener noreferrer"
                      className="p-1 text-muted-foreground hover:text-primary">
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
          <p className="text-xs text-muted-foreground/60 mt-1">크롤러 실행 시 자동 수집됩니다</p>
        </div>
      )}
    </div>
  );
};

export default ListingMonitor;
