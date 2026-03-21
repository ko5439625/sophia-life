import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Search, ExternalLink, Loader2, Star, Trash2, Edit3,
  ChevronDown, ChevronRight, Gavel, TrendingDown, AlertTriangle,
  FileText, Brain, ArrowUpDown, Filter,
} from "lucide-react";
import {
  loadAuctionItems, saveAuctionItem, deleteAuctionItem,
  toggleAuctionFavorite, updateAuctionAnalysis,
  type AuctionItemRow,
} from "../../../services/supabaseSync";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuctionAnalysisResult {
  marketPrice: string;
  bidRecommendation: string;
  riskLevel: "low" | "medium" | "high";
  riskFactors: string[];
  rightAnalysis: string;
  tenantStatus: string;
  evictionRisk: string;
  investmentScore: number; // 1~10
  summary: string;
}

// ---------------------------------------------------------------------------
// Helpers
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

function getBidRate(minBid: number, appraisal: number): number {
  if (!appraisal) return 0;
  return Math.round((minBid / appraisal) * 100);
}

function getStatusColor(status: string): string {
  switch (status) {
    case "진행중": return "text-green-600 bg-green-500/10";
    case "유찰": return "text-amber-600 bg-amber-500/10";
    case "낙찰": return "text-blue-600 bg-blue-500/10";
    case "취하": return "text-red-600 bg-red-500/10";
    default: return "text-muted-foreground bg-muted";
  }
}

function getRiskColor(level: string): string {
  switch (level) {
    case "low": return "text-green-600";
    case "medium": return "text-amber-600";
    case "high": return "text-red-600";
    default: return "text-muted-foreground";
  }
}

const PROPERTY_TYPES = ["아파트", "다세대/빌라", "오피스텔", "단독/다가구", "상가", "토지", "기타"];
const COURTS = [
  "서울중앙", "서울동부", "서울서부", "서울남부", "서울북부",
  "의정부", "인천", "수원", "성남", "안양", "안산", "평택",
  "고양", "남양주", "부천", "용인", "파주", "광주(경기)",
];
const STATUSES = ["진행중", "유찰", "낙찰", "취하"];

// 감정가 프리셋
const PRICE_PRESETS = [
  { label: "전체", min: "", max: "" },
  { label: "~3억", min: "", max: "30000" },
  { label: "3~5억", min: "30000", max: "50000" },
  { label: "5~10억", min: "50000", max: "100000" },
  { label: "10~20억", min: "100000", max: "200000" },
  { label: "20억~", min: "200000", max: "" },
];

// 정렬
type SortKey = "newest" | "bid_date" | "price_asc" | "price_desc" | "bid_rate";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "최신 등록순" },
  { key: "bid_date", label: "매각기일순" },
  { key: "price_asc", label: "감정가 낮은순" },
  { key: "price_desc", label: "감정가 높은순" },
  { key: "bid_rate", label: "매각가율 낮은순" },
];

// ---------------------------------------------------------------------------
// Gemini AI Analysis
// ---------------------------------------------------------------------------

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function analyzeAuctionItem(item: AuctionItemRow): Promise<AuctionAnalysisResult> {
  const apiKey = localStorage.getItem("sophia-api-gemini");
  if (!apiKey) throw new Error("Gemini API 키가 설정되지 않았습니다.");

  const bidRate = getBidRate(item.min_bid_price, item.appraisal_price);
  const prompt = `당신은 한국 부동산 경매 전문 분석가입니다. 아래 경매 물건을 종합 분석해주세요.

## 물건 정보
- 사건번호: ${item.case_no}
- 법원: ${item.court}
- 물건종류: ${item.property_type}
- 소재지: ${item.address}
- 면적: ${item.area_m2 ? `${item.area_m2}m2 (${item.area_pyeong}평)` : "미상"}
- 감정가: ${formatPrice(item.appraisal_price)}
- 최저매각가: ${formatPrice(item.min_bid_price)} (감정가의 ${bidRate}%)
- 유찰횟수: ${item.bid_count}회
- 매각기일: ${item.bid_date || "미정"}
- 현재 상태: ${item.status}
${item.note ? `- 메모: ${item.note}` : ""}

## 분석 요청
아래 JSON 형식으로만 응답하세요:
{
  "marketPrice": "주변 시세 추정 (예: '해당 지역 유사 물건 시세 약 X억 내외')",
  "bidRecommendation": "추천 입찰가 범위와 전략 (2~3문장)",
  "riskLevel": "low" | "medium" | "high",
  "riskFactors": ["위험요소1", "위험요소2", ...],
  "rightAnalysis": "권리분석 요약 (유찰횟수, 매각가율 기반 추정, 2~3문장)",
  "tenantStatus": "임차인 현황 추정 (물건 유형 기반, 1~2문장)",
  "evictionRisk": "명도 리스크 분석 (1~2문장)",
  "investmentScore": 1~10 사이 정수 (투자 매력도),
  "summary": "종합 의견 3~4문장"
}`;

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048, responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API 오류 (${res.status})`);

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts?.length) throw new Error("AI 응답이 비어있습니다");

  // thinking 모델: 마지막 non-thought part
  let text = "";
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!parts[i].thought && parts[i].text) { text = parts[i].text; break; }
  }
  if (!text) text = parts[parts.length - 1]?.text ?? "";

  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* try extract */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI 응답 파싱 실패");
  return JSON.parse(match[0].replace(/,\s*([}\]])/g, "$1"));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AuctionMonitor = () => {
  const [items, setItems] = useState<AuctionItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [showSort, setShowSort] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("전체");
  const [filterType, setFilterType] = useState<string>("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // Form state
  const emptyForm = {
    case_no: "", court: "서울중앙", property_type: "아파트", address: "",
    area_m2: "", appraisal_price: "", min_bid_price: "",
    bid_date: "", bid_count: "0", status: "진행중",
    detail_url: "", note: "",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadAuctionItems().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); };

  const handleSubmit = async () => {
    if (!form.case_no.trim() || !form.address.trim()) return;
    const areaM2 = form.area_m2 ? parseFloat(form.area_m2) : null;
    const itemData = {
      id: editingId || undefined,
      case_no: form.case_no,
      court: form.court,
      property_type: form.property_type,
      address: form.address,
      area_m2: areaM2,
      area_pyeong: areaM2 ? Math.round(areaM2 / 3.3058 * 10) / 10 : null,
      appraisal_price: parseInt(form.appraisal_price) || 0,
      min_bid_price: parseInt(form.min_bid_price) || 0,
      bid_date: form.bid_date || null,
      bid_count: parseInt(form.bid_count) || 0,
      status: form.status,
      detail_url: form.detail_url || null,
      note: form.note,
      is_favorited: false,
      analysis: null,
      blog_analyses: null,
    };

    await saveAuctionItem(itemData);

    if (editingId) {
      setItems((prev) => prev.map((it) => it.id === editingId ? { ...it, ...itemData, id: editingId } as AuctionItemRow : it));
    } else {
      // Reload to get server-generated id/timestamps
      const fresh = await loadAuctionItems();
      setItems(fresh);
    }
    resetForm();
  };

  const handleEdit = (item: AuctionItemRow) => {
    setForm({
      case_no: item.case_no,
      court: item.court,
      property_type: item.property_type,
      address: item.address,
      area_m2: item.area_m2 ? String(item.area_m2) : "",
      appraisal_price: item.appraisal_price ? String(item.appraisal_price) : "",
      min_bid_price: item.min_bid_price ? String(item.min_bid_price) : "",
      bid_date: item.bid_date || "",
      bid_count: String(item.bid_count || 0),
      status: item.status,
      detail_url: item.detail_url || "",
      note: item.note || "",
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await deleteAuctionItem(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleToggleFavorite = async (item: AuctionItemRow) => {
    const newVal = !item.is_favorited;
    await toggleAuctionFavorite(item.id, newVal);
    setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, is_favorited: newVal } : it));
  };

  const handleAnalyze = async (item: AuctionItemRow) => {
    setAnalyzingId(item.id);
    try {
      const result = await analyzeAuctionItem(item);
      await updateAuctionAnalysis(item.id, result);
      setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, analysis: result } : it));
      setExpandedId(item.id);
    } catch (e) {
      console.error("AI 분석 실패:", e);
      alert(`분석 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    } finally {
      setAnalyzingId(null);
    }
  };

  // Filtering & Sorting
  const filtered = useMemo(() => {
    let list = [...items];
    if (filterStatus !== "전체") list = list.filter((it) => it.status === filterStatus);
    if (filterType !== "전체") list = list.filter((it) => it.property_type === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((it) =>
        it.case_no.toLowerCase().includes(q) ||
        it.address.toLowerCase().includes(q) ||
        it.court.toLowerCase().includes(q)
      );
    }
    // Sort
    switch (sortKey) {
      case "newest": break; // already sorted by created_at desc
      case "bid_date":
        list.sort((a, b) => (a.bid_date || "9999").localeCompare(b.bid_date || "9999"));
        break;
      case "price_asc":
        list.sort((a, b) => a.appraisal_price - b.appraisal_price);
        break;
      case "price_desc":
        list.sort((a, b) => b.appraisal_price - a.appraisal_price);
        break;
      case "bid_rate":
        list.sort((a, b) =>
          getBidRate(a.min_bid_price, a.appraisal_price) - getBidRate(b.min_bid_price, b.appraisal_price)
        );
        break;
    }
    return list;
  }, [items, filterStatus, filterType, searchQuery, sortKey]);

  const favoritedItems = useMemo(() => filtered.filter((it) => it.is_favorited), [filtered]);

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
      {/* 상단: 검색 + 등록 버튼 */}
      <div className="bg-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Gavel className="h-4 w-4" />
            경매 물건 관리
          </h3>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
            <Plus className="h-3.5 w-3.5" /> 물건 등록
          </button>
        </div>

        {/* 검색 */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="사건번호, 주소, 법원 검색..." className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1">
            {["전체", ...STATUSES].map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  filterStatus === s ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"
                }`}>{s}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {["전체", "아파트", "다세대/빌라", "오피스텔"].map((t) => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  filterType === t ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"
                }`}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* 물건 등록 폼 */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-card rounded-xl p-5 space-y-4 border border-border">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold">{editingId ? "물건 정보 수정" : "경매 물건 등록"}</h4>
                <button onClick={resetForm}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">사건번호 *</label>
                  <input type="text" value={form.case_no} onChange={(e) => setForm({ ...form, case_no: e.target.value })}
                    placeholder="2025타경12345" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">법원</label>
                  <select value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {COURTS.map((c) => <option key={c} value={c}>{c}지방법원</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">물건종류</label>
                  <select value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">면적 (m2)</label>
                  <input type="number" value={form.area_m2} onChange={(e) => setForm({ ...form, area_m2: e.target.value })}
                    placeholder="84.9" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">소재지 *</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="서울시 강남구 개포동 ..." className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">감정가 (만원)</label>
                  <input type="number" value={form.appraisal_price} onChange={(e) => setForm({ ...form, appraisal_price: e.target.value })}
                    placeholder="100000 (= 10억)" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">최저매각가 (만원)</label>
                  <input type="number" value={form.min_bid_price} onChange={(e) => setForm({ ...form, min_bid_price: e.target.value })}
                    placeholder="80000 (= 8억)" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">매각기일</label>
                  <input type="date" value={form.bid_date} onChange={(e) => setForm({ ...form, bid_date: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">유찰횟수</label>
                  <input type="number" value={form.bid_count} onChange={(e) => setForm({ ...form, bid_count: e.target.value })}
                    min="0" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">상태</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">법원 경매정보 URL (선택)</label>
                <input type="text" value={form.detail_url} onChange={(e) => setForm({ ...form, detail_url: e.target.value })}
                  placeholder="https://www.courtauction.go.kr/..." className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">메모</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="특이사항, 권리관계 등 메모..." rows={2}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={resetForm} className="text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground">취소</button>
                <button onClick={handleSubmit} disabled={!form.case_no.trim() || !form.address.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40">{editingId ? "수정" : "등록"}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 정렬 + 건수 */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground font-mono">{filtered.length}건</span>
          <div className="relative">
            <button onClick={() => setShowSort(!showSort)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowUpDown className="h-3 w-3" />
              {SORT_OPTIONS.find((o) => o.key === sortKey)?.label}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showSort && (
              <div className="absolute right-0 top-6 z-10 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[130px]">
                {SORT_OPTIONS.map((opt) => (
                  <button key={opt.key} onClick={() => { setSortKey(opt.key); setShowSort(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors ${
                      sortKey === opt.key ? "text-primary font-medium" : "text-foreground"
                    }`}>{opt.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 관심 물건 (상단 고정) */}
      {favoritedItems.length > 0 && (
        <div className="bg-card rounded-xl overflow-hidden border border-amber-400/30">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/5 border-b border-amber-400/20">
            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
            <span className="text-xs font-bold text-amber-600">관심 물건</span>
            <span className="text-[10px] text-muted-foreground">{favoritedItems.length}건</span>
          </div>
          <div className="divide-y divide-border/50">
            {favoritedItems.map((item) => (
              <AuctionCard key={`fav-${item.id}`} item={item}
                onToggleFavorite={handleToggleFavorite} onEdit={handleEdit}
                onDelete={handleDelete} onAnalyze={handleAnalyze}
                isExpanded={expandedId === item.id}
                onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                isAnalyzing={analyzingId === item.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* 물건 리스트 */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.filter((it) => !it.is_favorited).map((item) => (
            <AuctionCard key={item.id} item={item}
              onToggleFavorite={handleToggleFavorite} onEdit={handleEdit}
              onDelete={handleDelete} onAnalyze={handleAnalyze}
              isExpanded={expandedId === item.id}
              onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
              isAnalyzing={analyzingId === item.id}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <Gavel className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">등록된 경매 물건이 없습니다</p>
          <p className="text-xs text-muted-foreground/60 mt-1">관심 있는 경매 물건을 등록하고 AI 분석을 받아보세요</p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// AuctionCard Sub-component
// ---------------------------------------------------------------------------

interface AuctionCardProps {
  item: AuctionItemRow;
  onToggleFavorite: (item: AuctionItemRow) => void;
  onEdit: (item: AuctionItemRow) => void;
  onDelete: (id: string) => void;
  onAnalyze: (item: AuctionItemRow) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isAnalyzing: boolean;
}

const AuctionCard = ({ item, onToggleFavorite, onEdit, onDelete, onAnalyze, isExpanded, onToggleExpand, isAnalyzing }: AuctionCardProps) => {
  const bidRate = getBidRate(item.min_bid_price, item.appraisal_price);
  const analysis = item.analysis as AuctionAnalysisResult | null;

  return (
    <div className="bg-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors" onClick={onToggleExpand}>
        <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(item); }} className="flex-shrink-0 p-0.5">
          <Star className={`h-3.5 w-3.5 ${item.is_favorited ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30 hover:text-amber-300"}`} />
        </button>
        <div className="flex-shrink-0 text-muted-foreground">
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getStatusColor(item.status)}`}>{item.status}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{item.case_no}</span>
            <span className="text-[10px] text-muted-foreground">{item.court}</span>
            {item.bid_count > 0 && (
              <span className="text-[9px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium">
                {item.bid_count}회 유찰
              </span>
            )}
            {analysis && (
              <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">AI 분석</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-medium truncate">{item.address}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] font-mono">
            <span className="text-muted-foreground">감정가 <span className="font-bold text-foreground">{formatPrice(item.appraisal_price)}</span></span>
            <span className="text-muted-foreground">최저가 <span className="font-bold text-foreground">{formatPrice(item.min_bid_price)}</span></span>
            <span className={`font-bold ${bidRate <= 50 ? "text-green-600" : bidRate <= 70 ? "text-amber-600" : "text-foreground"}`}>
              {bidRate}%
            </span>
            {item.area_pyeong && <span className="text-muted-foreground">{item.area_pyeong}평</span>}
          </div>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-border px-4 py-3 space-y-3">
              {/* 상세 정보 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">물건종류</span>
                  <span className="font-medium">{item.property_type}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">매각기일</span>
                  <span className="font-medium font-mono">{item.bid_date || "미정"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">면적</span>
                  <span className="font-medium font-mono">{item.area_m2 ? `${item.area_m2}m2 (${item.area_pyeong}평)` : "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">매각가율</span>
                  <span className={`font-bold ${bidRate <= 50 ? "text-green-600" : bidRate <= 70 ? "text-amber-600" : ""}`}>
                    {bidRate}% ({item.bid_count}회 유찰)
                  </span>
                </div>
              </div>

              {item.note && (
                <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                  <span className="font-medium text-foreground">메모:</span> {item.note}
                </div>
              )}

              {/* AI 분석 결과 */}
              {analysis && (
                <div className="space-y-3 bg-muted/20 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold">AI 분석 결과</span>
                    <span className={`text-[10px] font-bold ${getRiskColor(analysis.riskLevel)}`}>
                      위험도: {analysis.riskLevel === "low" ? "낮음" : analysis.riskLevel === "medium" ? "보통" : "높음"}
                    </span>
                    <span className="text-[10px] font-mono text-primary">투자점수: {analysis.investmentScore}/10</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground block mb-1">시세 분석</span>
                      <p className="text-foreground leading-relaxed">{analysis.marketPrice}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground block mb-1">입찰 추천</span>
                      <p className="text-foreground leading-relaxed">{analysis.bidRecommendation}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground block mb-1">권리분석</span>
                      <p className="text-foreground leading-relaxed">{analysis.rightAnalysis}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground block mb-1">임차인/명도</span>
                      <p className="text-foreground leading-relaxed">{analysis.tenantStatus}</p>
                      <p className="text-muted-foreground mt-1">{analysis.evictionRisk}</p>
                    </div>
                  </div>

                  {analysis.riskFactors && analysis.riskFactors.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground block mb-1">위험 요소</span>
                      <div className="flex flex-wrap gap-1">
                        {analysis.riskFactors.map((rf, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-600">
                            <AlertTriangle className="h-2.5 w-2.5 inline mr-1" />{rf}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-foreground border-t border-border/50 pt-2">
                    <span className="text-[10px] font-bold text-muted-foreground block mb-1">종합 의견</span>
                    <p className="leading-relaxed">{analysis.summary}</p>
                  </div>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex items-center gap-2 pt-1">
                <button onClick={() => onAnalyze(item)} disabled={isAnalyzing}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
                  {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                  {isAnalyzing ? "분석 중..." : analysis ? "재분석" : "AI 분석"}
                </button>
                {item.detail_url && (
                  <a href={item.detail_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <ExternalLink className="h-3 w-3" /> 법원 사이트
                  </a>
                )}
                <button onClick={() => onEdit(item)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <Edit3 className="h-3 w-3" /> 수정
                </button>
                <button onClick={() => onDelete(item.id)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3 w-3" /> 삭제
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuctionMonitor;
