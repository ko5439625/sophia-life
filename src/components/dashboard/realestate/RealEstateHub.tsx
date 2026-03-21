import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Star, Edit3, Trash2, Camera, BarChart3, Lock, Loader2,
} from "lucide-react";
import { useGuestMode } from "../../../hooks/useGuestMode";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import SubscriptionView from "./SubscriptionView";
import ListingMonitor from "./ListingMonitor";
import RealEstateSearch from "./RealEstateSearch";
import AuctionMonitor from "./AuctionMonitor";
import {
  loadInspections, saveInspection, deleteInspection,
  type InspectionRow,
} from "../../../services/supabaseSync";

// ---------------------------------------------------------------------------
// Types & Helpers
// ---------------------------------------------------------------------------

interface InspectionScores {
  transportation: number;
  school: number;
  environment: number;
  commercial: number;
  complex: number;
}

const scoreLabels: { key: keyof InspectionScores; label: string }[] = [
  { key: "transportation", label: "교통" },
  { key: "school", label: "학군" },
  { key: "environment", label: "환경" },
  { key: "commercial", label: "상권" },
  { key: "complex", label: "단지" },
];

const calcAverage = (scores: InspectionScores): number => {
  const values = Object.values(scores);
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const StarRating = ({ value, onChange, readonly = false }: {
  value: number; onChange?: (v: number) => void; readonly?: boolean;
}) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <button key={star} type="button" disabled={readonly}
        onClick={() => onChange?.(star)}
        className={`${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}>
        <Star className={`h-4 w-4 transition-colors ${star <= value ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
      </button>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Tabs (PRD 순서)
// ---------------------------------------------------------------------------

const tabs = [
  { id: "monitor", label: "매물 모니터" },
  { id: "auction", label: "경매" },
  { id: "search", label: "실거래가" },
  { id: "subscription", label: "분양 정보" },
  { id: "inspection", label: "임장 노트" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const RealEstateHub = ({ initialTab, onTabUsed }: { initialTab?: string | null; onTabUsed?: () => void }) => {
  const { isGuest } = useGuestMode();
  const [activeTab, setActiveTab] = useState(initialTab || "monitor");

  useEffect(() => {
    if (initialTab) { setActiveTab(initialTab); onTabUsed?.(); }
  }, [initialTab]);

  // Inspection state (Supabase 연동)
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [inspLoading, setInspLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    loadInspections().then((rows) => {
      setInspections(rows);
      setInspLoading(false);
    });
  }, []);

  const emptyForm = {
    apartmentName: "", location: "", visitDate: "",
    scores: { transportation: 0, school: 0, environment: 0, commercial: 0, complex: 0 } as InspectionScores,
    review: "",
  };
  const [form, setForm] = useState(emptyForm);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); };

  const handleSubmit = async () => {
    if (!form.apartmentName.trim() || !form.visitDate) return;
    if (!Object.values(form.scores).every((v) => v > 0)) return;

    const avg = calcAverage(form.scores);
    const row: InspectionRow = {
      id: editingId || crypto.randomUUID(),
      apartment_name: form.apartmentName,
      location: form.location,
      visit_date: form.visitDate,
      score_transport: form.scores.transportation,
      score_school: form.scores.school,
      score_environment: form.scores.environment,
      score_commercial: form.scores.commercial,
      score_complex: form.scores.complex,
      total_score: Math.round(avg * 10) / 10,
      photos: [],
      review: form.review,
    };

    await saveInspection(row);
    if (editingId) {
      setInspections((prev) => prev.map((ins) => ins.id === editingId ? row : ins));
    } else {
      setInspections((prev) => [row, ...prev]);
    }
    resetForm();
  };

  const handleEdit = (ins: InspectionRow) => {
    setForm({
      apartmentName: ins.apartment_name, location: ins.location || "", visitDate: ins.visit_date,
      scores: {
        transportation: ins.score_transport, school: ins.score_school,
        environment: ins.score_environment, commercial: ins.score_commercial, complex: ins.score_complex,
      },
      review: ins.review,
    });
    setEditingId(ins.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await deleteInspection(id);
    setInspections((prev) => prev.filter((ins) => ins.id !== id));
  };

  const updateScore = (key: keyof InspectionScores, value: number) => {
    setForm((prev) => ({ ...prev, scores: { ...prev.scores, [key]: value } }));
  };

  // Convert DB rows to chart-friendly format
  const inspForChart = inspections.map((ins) => ({
    name: ins.apartment_name,
    scores: {
      transportation: ins.score_transport, school: ins.score_school,
      environment: ins.score_environment, commercial: ins.score_commercial, complex: ins.score_complex,
    } as InspectionScores,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold">부동산</h2>

      <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 relative px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors min-w-[60px] flex-shrink-0 ${
              activeTab === tab.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {activeTab === tab.id && (
              <motion.div layoutId="realestate-hub-tab"
                className="absolute inset-0 bg-card rounded-md shadow-sm"
                transition={{ type: "spring", stiffness: 300, damping: 30 }} />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {/* 매물 모니터 (크롤링) */}
        {activeTab === "monitor" && (
          isGuest ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
              <Lock className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">비공개 콘텐츠입니다</p>
            </div>
          ) : <ListingMonitor />
        )}

        {/* 경매 */}
        {activeTab === "auction" && (
          isGuest ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
              <Lock className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">비공개 콘텐츠입니다</p>
            </div>
          ) : <AuctionMonitor />
        )}

        {/* 실거래가 */}
        {activeTab === "search" && <RealEstateSearch />}

        {/* 분양 정보 */}
        {activeTab === "subscription" && <SubscriptionView />}

        {/* 임장 노트 (Supabase 연동) */}
        {activeTab === "inspection" && (
          isGuest ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
              <Lock className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">비공개 콘텐츠입니다</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-mono">
                  {inspLoading ? "로딩 중..." : `${inspections.length}건의 임장 기록`}
                </p>
                <button onClick={() => { resetForm(); setShowForm(true); }}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> 새 임장 기록
                </button>
              </div>

              {/* Form */}
              <AnimatePresence>
                {showForm && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="bg-card rounded-xl p-5 space-y-4 border border-border">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold">{editingId ? "임장 기록 수정" : "새 임장 기록"}</h4>
                        <button onClick={resetForm}><X className="h-4 w-4 text-muted-foreground" /></button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">아파트명</label>
                          <input type="text" value={form.apartmentName} onChange={(e) => setForm({ ...form, apartmentName: e.target.value })}
                            placeholder="래미안 원베일리" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">위치</label>
                          <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                            placeholder="서울 서초구 반포동" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">방문 날짜</label>
                          <input type="date" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-2 block">평가 항목</label>
                        <div className="grid grid-cols-1 gap-2">
                          {scoreLabels.map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                              <span className="text-xs font-medium">{label}</span>
                              <StarRating value={form.scores[key]} onChange={(v) => updateScore(key, v)} />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">후기</label>
                        <textarea value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })}
                          placeholder="임장 후기를 작성해주세요..." rows={3}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={resetForm} className="text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground">취소</button>
                        <button onClick={handleSubmit} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">{editingId ? "수정" : "저장"}</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Inspection cards */}
              <div className="space-y-3">
                {inspections.map((ins, i) => {
                  const scores: InspectionScores = {
                    transportation: ins.score_transport, school: ins.score_school,
                    environment: ins.score_environment, commercial: ins.score_commercial, complex: ins.score_complex,
                  };
                  const avg = calcAverage(scores);
                  return (
                    <motion.div key={ins.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="bg-card rounded-xl p-4 group">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-bold">{ins.apartment_name}</h4>
                          {ins.location && <p className="text-[10px] text-muted-foreground">{ins.location}</p>}
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{ins.visit_date}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                            <span className="text-sm font-mono font-bold">{avg.toFixed(1)}</span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(ins)} className="p-1 hover:text-primary"><Edit3 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => handleDelete(ins.id)} className="p-1 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3">
                        {scoreLabels.map(({ key, label }) => (
                          <div key={key} className="text-center">
                            <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                            <StarRating value={scores[key]} readonly />
                          </div>
                        ))}
                      </div>
                      {ins.review && <p className="text-xs text-muted-foreground mt-3 leading-relaxed line-clamp-2">{ins.review}</p>}
                    </motion.div>
                  );
                })}
              </div>

              {!inspLoading && inspections.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-10 font-mono">아직 임장 기록이 없습니다</p>
              )}

              {/* Comparison */}
              {inspections.length >= 2 && (
                <div>
                  <button onClick={() => setShowComparison(!showComparison)}
                    className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors mb-3">
                    <BarChart3 className="h-4 w-4" />
                    <span className="font-medium">{showComparison ? "비교 분석 닫기" : "비교 분석 보기"}</span>
                  </button>
                  <AnimatePresence>
                    {showComparison && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-4">
                        <div className="bg-card rounded-xl p-5">
                          <h4 className="text-sm font-bold mb-3">항목별 비교 (레이더)</h4>
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart data={scoreLabels.map(({ key, label }) => {
                                const point: Record<string, string | number> = { label };
                                inspForChart.forEach((ins) => { point[ins.name] = ins.scores[key]; });
                                return point;
                              })}>
                                <PolarGrid stroke="hsl(var(--border))" />
                                <PolarAngleAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                                <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} tickCount={6} />
                                {inspForChart.map((ins, idx) => {
                                  const colors = ["#00704A", "#2563EB", "#F59E0B", "#EF4444", "#8B5CF6"];
                                  return <Radar key={idx} name={ins.name} dataKey={ins.name} stroke={colors[idx % colors.length]} fill={colors[idx % colors.length]} fillOpacity={0.15} strokeWidth={2} />;
                                })}
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )
        )}
      </motion.div>
    </div>
  );
};

export default RealEstateHub;
