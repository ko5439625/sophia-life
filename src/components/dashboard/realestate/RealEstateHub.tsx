import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  Star,
  Edit3,
  Trash2,
  Camera,
  BarChart3,
} from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import ApartmentView from "../finance/ApartmentView";
import PropertySearch from "./PropertySearch";
import SubscriptionView from "./SubscriptionView";

// --- Interfaces for future Supabase integration ---

interface InspectionScores {
  transportation: number; // 교통
  school: number; // 학군
  environment: number; // 환경
  commercial: number; // 상권
  complex: number; // 단지
}

interface Inspection {
  id: string;
  apartmentName: string;
  visitDate: string;
  scores: InspectionScores;
  photos: string[]; // URLs - mock for now
  review: string;
  createdAt: string;
}

// --- Score labels ---
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

// --- Star rating component ---
const StarRating = ({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        disabled={readonly}
        onClick={() => onChange?.(star)}
        className={`${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
      >
        <Star
          className={`h-4 w-4 transition-colors ${
            star <= value
              ? "text-yellow-500 fill-yellow-500"
              : "text-muted-foreground/30"
          }`}
        />
      </button>
    ))}
  </div>
);

// --- Mock initial data ---
const initialInspections: Inspection[] = [
  {
    id: "1",
    apartmentName: "래미안 원베일리",
    visitDate: "2026-03-10",
    scores: { transportation: 5, school: 4, environment: 5, commercial: 5, complex: 5 },
    photos: [],
    review: "반포역 도보 5분, 단지 내부 조경이 뛰어남. 학군도 우수하나 가격이 부담.",
    createdAt: "2026-03-10T14:00:00Z",
  },
  {
    id: "2",
    apartmentName: "힐스테이트 광교중앙역",
    visitDate: "2026-03-08",
    scores: { transportation: 4, school: 3, environment: 4, commercial: 4, complex: 4 },
    photos: [],
    review: "신분당선 역세권. 상권이 잘 갖춰져 있고 단지가 깔끔함. 학군은 아직 형성 중.",
    createdAt: "2026-03-08T10:00:00Z",
  },
];

// --- Tabs ---
const tabs = [
  { id: "analysis", label: "부동산 분석" },
  { id: "inspection", label: "임장 기록" },
  { id: "property-search", label: "매물 탐색" },
  { id: "subscription", label: "분양 정보" },
];

const RealEstateHub = () => {
  const [activeTab, setActiveTab] = useState("analysis");
  const [inspections, setInspections] = useState<Inspection[]>(initialInspections);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // Form state
  const emptyForm = {
    apartmentName: "",
    visitDate: "",
    scores: { transportation: 0, school: 0, environment: 0, commercial: 0, complex: 0 } as InspectionScores,
    review: "",
  };
  const [form, setForm] = useState(emptyForm);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!form.apartmentName.trim() || !form.visitDate) return;
    const hasScores = Object.values(form.scores).every((v) => v > 0);
    if (!hasScores) return;

    if (editingId) {
      setInspections((prev) =>
        prev.map((ins) =>
          ins.id === editingId
            ? { ...ins, apartmentName: form.apartmentName, visitDate: form.visitDate, scores: form.scores, review: form.review }
            : ins
        )
      );
    } else {
      const newInspection: Inspection = {
        id: Date.now().toString(),
        apartmentName: form.apartmentName,
        visitDate: form.visitDate,
        scores: form.scores,
        photos: [],
        review: form.review,
        createdAt: new Date().toISOString(),
      };
      setInspections((prev) => [newInspection, ...prev]);
    }
    resetForm();
  };

  const handleEdit = (ins: Inspection) => {
    setForm({
      apartmentName: ins.apartmentName,
      visitDate: ins.visitDate,
      scores: { ...ins.scores },
      review: ins.review,
    });
    setEditingId(ins.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    setInspections((prev) => prev.filter((ins) => ins.id !== id));
  };

  const updateScore = (key: keyof InspectionScores, value: number) => {
    setForm((prev) => ({
      ...prev,
      scores: { ...prev.scores, [key]: value },
    }));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold">부동산</h2>

      <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 relative px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors min-w-[70px] flex-shrink-0 ${
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="realestate-hub-tab"
                className="absolute inset-0 bg-card rounded-md shadow-sm"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === "analysis" && <ApartmentView />}
        {activeTab === "inspection" && (
          <div className="space-y-6">
            {/* Add button */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-mono">
                {inspections.length}건의 임장 기록
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                새 임장 기록
              </button>
            </div>

            {/* Form */}
            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-card rounded-xl p-5 space-y-4 border border-border">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold">
                        {editingId ? "임장 기록 수정" : "새 임장 기록"}
                      </h4>
                      <button onClick={resetForm} className="p-1">
                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          아파트명
                        </label>
                        <input
                          type="text"
                          value={form.apartmentName}
                          onChange={(e) => setForm({ ...form, apartmentName: e.target.value })}
                          placeholder="래미안 원베일리"
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          방문 날짜
                        </label>
                        <input
                          type="date"
                          value={form.visitDate}
                          onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>

                    {/* Scores */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">
                        평가 항목
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {scoreLabels.map(({ key, label }) => (
                          <div key={key} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                            <span className="text-xs font-medium">{label}</span>
                            <StarRating
                              value={form.scores[key]}
                              onChange={(v) => updateScore(key, v)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Photos mock */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        사진
                      </label>
                      <button
                        type="button"
                        className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3 w-full hover:border-primary/50 transition-colors"
                      >
                        <Camera className="h-4 w-4" />
                        사진 추가 (준비 중)
                      </button>
                    </div>

                    {/* Review */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        후기
                      </label>
                      <textarea
                        value={form.review}
                        onChange={(e) => setForm({ ...form, review: e.target.value })}
                        placeholder="임장 후기를 작성해주세요..."
                        rows={3}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      />
                    </div>

                    {/* Submit */}
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={resetForm}
                        className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSubmit}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        {editingId ? "수정" : "저장"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inspection cards */}
            <div className="space-y-3">
              {inspections.map((ins, i) => {
                const avg = calcAverage(ins.scores);
                return (
                  <motion.div
                    key={ins.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card rounded-xl p-4 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-bold">{ins.apartmentName}</h4>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {ins.visitDate}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Average score stars */}
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm font-mono font-bold">
                            {avg.toFixed(1)}
                          </span>
                        </div>
                        {/* Edit/Delete */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(ins)}
                            className="p-1 hover:text-primary transition-colors"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(ins.id)}
                            className="p-1 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Score bars */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3">
                      {scoreLabels.map(({ key, label }) => (
                        <div key={key} className="text-center">
                          <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                          <StarRating value={ins.scores[key]} readonly />
                        </div>
                      ))}
                    </div>

                    {/* Review */}
                    {ins.review && (
                      <p className="text-xs text-muted-foreground mt-3 leading-relaxed line-clamp-2">
                        {ins.review}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {inspections.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-10 font-mono">
                아직 임장 기록이 없습니다
              </p>
            )}

            {/* Comparison - Charts + Table */}
            {inspections.length >= 2 && (
              <div>
                <button
                  onClick={() => setShowComparison(!showComparison)}
                  className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors mb-3"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="font-medium">
                    {showComparison ? "비교 분석 닫기" : "비교 분석 보기"}
                  </span>
                </button>

                <AnimatePresence>
                  {showComparison && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-4"
                    >
                      {/* Radar Chart - overlay comparison */}
                      <div className="bg-card rounded-xl p-5">
                        <h4 className="text-sm font-bold mb-3">항목별 비교 (레이더)</h4>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart
                              data={scoreLabels.map(({ key, label }) => {
                                const point: Record<string, string | number> = { label };
                                inspections.forEach((ins) => {
                                  point[ins.apartmentName] = ins.scores[key];
                                });
                                return point;
                              })}
                            >
                              <PolarGrid stroke="hsl(var(--border))" />
                              <PolarAngleAxis
                                dataKey="label"
                                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                              />
                              <PolarRadiusAxis
                                angle={90}
                                domain={[0, 5]}
                                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                tickCount={6}
                              />
                              {inspections.map((ins, idx) => {
                                const colors = ["#00704A", "#2563EB", "#F59E0B", "#EF4444", "#8B5CF6"];
                                return (
                                  <Radar
                                    key={ins.id}
                                    name={ins.apartmentName}
                                    dataKey={ins.apartmentName}
                                    stroke={colors[idx % colors.length]}
                                    fill={colors[idx % colors.length]}
                                    fillOpacity={0.15}
                                    strokeWidth={2}
                                  />
                                );
                              })}
                              <Legend
                                wrapperStyle={{ fontSize: 12 }}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: 8,
                                  fontSize: 12,
                                }}
                              />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Bar Chart - side by side comparison */}
                      <div className="bg-card rounded-xl p-5">
                        <h4 className="text-sm font-bold mb-3">항목별 점수 비교 (바 차트)</h4>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={scoreLabels.map(({ key, label }) => {
                                const point: Record<string, string | number> = { label };
                                inspections.forEach((ins) => {
                                  point[ins.apartmentName] = ins.scores[key];
                                });
                                return point;
                              })}
                              barGap={2}
                              barSize={20}
                            >
                              <XAxis
                                dataKey="label"
                                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                domain={[0, 5]}
                                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                axisLine={false}
                                tickLine={false}
                                tickCount={6}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: 8,
                                  fontSize: 12,
                                }}
                              />
                              <Legend wrapperStyle={{ fontSize: 12 }} />
                              {inspections.map((ins, idx) => {
                                const colors = ["#00704A", "#2563EB", "#F59E0B", "#EF4444", "#8B5CF6"];
                                return (
                                  <Bar
                                    key={ins.id}
                                    dataKey={ins.apartmentName}
                                    fill={colors[idx % colors.length]}
                                    radius={[4, 4, 0, 0]}
                                    animationDuration={800}
                                  />
                                );
                              })}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Total Score Ranking */}
                      <div className="bg-card rounded-xl p-5">
                        <h4 className="text-sm font-bold mb-3">종합 점수 랭킹</h4>
                        <div className="space-y-3">
                          {[...inspections]
                            .sort((a, b) => calcAverage(b.scores) - calcAverage(a.scores))
                            .map((ins, rank) => {
                              const avg = calcAverage(ins.scores);
                              const pct = (avg / 5) * 100;
                              const colors = ["#00704A", "#2563EB", "#F59E0B", "#EF4444", "#8B5CF6"];
                              const color = colors[inspections.indexOf(ins) % colors.length];
                              return (
                                <motion.div
                                  key={ins.id}
                                  className="flex items-center gap-3"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: rank * 0.1 }}
                                >
                                  <span className={`text-lg font-mono font-bold w-8 text-center ${
                                    rank === 0 ? "text-yellow-500" : "text-muted-foreground"
                                  }`}>
                                    {rank === 0 ? "🏆" : `${rank + 1}`}
                                  </span>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm font-medium">{ins.apartmentName}</span>
                                      <div className="flex items-center gap-1">
                                        <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                                        <span className="text-sm font-mono font-bold">{avg.toFixed(1)}</span>
                                      </div>
                                    </div>
                                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                                      <motion.div
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: color }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.8, delay: rank * 0.1 }}
                                      />
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                        </div>
                      </div>

                      {/* Detail Table */}
                      <div className="bg-card rounded-xl">
                        <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[400px]">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left p-3 text-muted-foreground font-medium">항목</th>
                              {inspections.map((ins) => (
                                <th key={ins.id} className="text-center p-3 text-muted-foreground font-medium min-w-[100px]">
                                  {ins.apartmentName}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {scoreLabels.map(({ key, label }) => {
                              const maxVal = Math.max(...inspections.map((ins) => ins.scores[key]));
                              return (
                                <tr key={key} className="border-b border-border/50">
                                  <td className="p-3 font-medium">{label}</td>
                                  {inspections.map((ins) => (
                                    <td key={ins.id} className="p-3 text-center">
                                      <span className={`font-mono font-bold ${
                                        ins.scores[key] === maxVal ? "text-primary" : ""
                                      }`}>
                                        {ins.scores[key]}
                                      </span>
                                      <span className="text-muted-foreground">/5</span>
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                            <tr className="bg-muted/30">
                              <td className="p-3 font-bold">종합</td>
                              {inspections.map((ins) => {
                                const avg = calcAverage(ins.scores);
                                const maxAvg = Math.max(...inspections.map((i) => calcAverage(i.scores)));
                                return (
                                  <td key={ins.id} className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Star className={`h-3.5 w-3.5 ${avg === maxAvg ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                                      <span className={`font-mono font-bold ${avg === maxAvg ? "text-yellow-500" : ""}`}>
                                        {avg.toFixed(1)}
                                      </span>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                            <tr>
                              <td className="p-3 font-medium">방문일</td>
                              {inspections.map((ins) => (
                                <td key={ins.id} className="p-3 text-center font-mono text-muted-foreground">
                                  {ins.visitDate}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
        {activeTab === "property-search" && <PropertySearch />}
        {activeTab === "subscription" && <SubscriptionView />}
      </motion.div>
    </div>
  );
};

export default RealEstateHub;
