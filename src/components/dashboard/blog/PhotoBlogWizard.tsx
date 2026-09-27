import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ImagePlus,
  ChevronUp,
  ChevronDown,
  X,
  Loader2,
  Sparkles,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Check,
  Camera,
} from "lucide-react";
import { resizeImage } from "@/lib/imageResize";
import {
  generatePhotoBlog,
  regenerateSection,
  PHOTO_BLOG_MAX_PHOTOS,
  type PhotoBlogRequest,
  type PhotoBlogResult,
  type PhotoBlogTone,
} from "@/services/photoBlogApi";
import { uploadBlobToBlogStorage, BLOG_UPLOAD_MAX_SIDE } from "./blogImageUpload";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WizardPhoto {
  id: string;
  file: File;
  /** AI 요청용 1024px 썸네일 (미리보기에도 사용) */
  thumbUrl: string;
  aiBase64: string;
  note: string;
}

export interface PhotoBlogInsertPayload {
  title: string;
  html: string;
  tags: string[];
}

type Step = "photos" | "info" | "result";

const AI_MAX_SIDE = 1024;
const TONES: { value: PhotoBlogTone; label: string; desc: string }[] = [
  { value: "담백", label: "담백", desc: "차분하게" },
  { value: "발랄", label: "발랄", desc: "밝고 경쾌하게" },
  { value: "감성", label: "감성", desc: "잔잔하고 따뜻하게" },
];

const STEPS: { key: Step; label: string }[] = [
  { key: "photos", label: "사진" },
  { key: "info", label: "정보" },
  { key: "result", label: "글 확인" },
];

const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const paragraph = (s: string) =>
  s.trim() ? `<p>${escapeHtml(s.trim()).replace(/\n/g, "<br>")}</p>` : "";

/** 결과 → 에디터에 넣을 깔끔한 HTML */
function buildPostHtml(result: PhotoBlogResult, imageUrls: string[]): string {
  const parts: string[] = [];
  parts.push(paragraph(result.intro));
  result.sections.forEach((s, i) => {
    const url = imageUrls[i];
    const heading = s.heading.trim();
    if (url) {
      parts.push(
        `<img src="${escapeHtml(url)}" alt="${escapeHtml(heading || `사진 ${i + 1}`)}" style="max-width:100%;border-radius:8px;margin:16px 0 8px;" />`
      );
    }
    if (heading) parts.push(`<h3>${escapeHtml(heading)}</h3>`);
    parts.push(paragraph(s.body));
  });
  parts.push(paragraph(result.outro));
  // 에디터가 white-space: pre-wrap 이라 태그 사이 줄바꿈이 빈 줄로 보이므로 붙여서 반환
  return parts.filter(Boolean).join("");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PhotoBlogWizard = ({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (payload: PhotoBlogInsertPayload) => void;
}) => {
  const [step, setStep] = useState<Step>("photos");
  const [photos, setPhotos] = useState<WizardPhoto[]>([]);
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [topic, setTopic] = useState("");
  const [place, setPlace] = useState("");
  const [date, setDate] = useState(todayStr);
  const [tone, setTone] = useState<PhotoBlogTone>("담백");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<PhotoBlogResult | null>(null);
  /** 생성 당시 사진 순서 스냅샷 (결과 섹션 photoIndex가 가리키는 대상) */
  const [genPhotos, setGenPhotos] = useState<WizardPhoto[]>([]);
  const [genRequest, setGenRequest] = useState<PhotoBlogRequest | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [regenIndex, setRegenIndex] = useState<number | null>(null);
  const [inserting, setInserting] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 언마운트 시 object URL 정리
  const allPhotosRef = useRef<WizardPhoto[]>([]);
  useEffect(() => {
    const list = allPhotosRef.current; // 같은 배열에 push 하므로 cleanup 시점에도 전체 목록
    return () => list.forEach((p) => URL.revokeObjectURL(p.thumbUrl));
  }, []);

  // 스텝 이동 시 / 에러 발생 시 스크롤 맨 위로 (에러 박스가 보이도록)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);
  useEffect(() => {
    if (error) scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [error]);

  const busy = generating || !!inserting || regenIndex !== null;

  // --- 사진 추가 (1024px로 줄여서 AI용 base64 + 미리보기 동시 확보) ---
  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
      if (files.length === 0) return;
      setError(null);
      const room = PHOTO_BLOG_MAX_PHOTOS - photos.length;
      if (room <= 0) {
        setError(`사진은 최대 ${PHOTO_BLOG_MAX_PHOTOS}장까지 올릴 수 있어요.`);
        return;
      }
      const accepted = files.slice(0, room);
      setAddingPhotos(true);
      const added: WizardPhoto[] = [];
      const failed: string[] = [];
      for (const file of accepted) {
        try {
          const { blob, base64 } = await resizeImage(file, AI_MAX_SIDE);
          const photo: WizardPhoto = {
            id: crypto.randomUUID(),
            file,
            thumbUrl: URL.createObjectURL(blob),
            aiBase64: base64,
            note: "",
          };
          allPhotosRef.current.push(photo);
          added.push(photo);
        } catch (e) {
          console.warn("[PhotoBlogWizard] resize failed:", file.name, e);
          failed.push(file.name);
        }
      }
      setPhotos((prev) => [...prev, ...added]);
      setAddingPhotos(false);
      const msgs: string[] = [];
      if (files.length > room) msgs.push(`최대 ${PHOTO_BLOG_MAX_PHOTOS}장까지라 ${files.length - room}장은 제외했어요.`);
      if (failed.length > 0) msgs.push(`열 수 없는 사진이 있어요 (HEIC 등): ${failed.join(", ")} — JPG/PNG로 변환해서 올려주세요.`);
      if (msgs.length) setError(msgs.join(" "));
    },
    [photos.length]
  );

  const movePhoto = (index: number, dir: -1 | 1) => {
    setPhotos((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removePhoto = (id: string) => {
    // 결과 화면 스냅샷에서 쓰일 수 있으므로 URL은 언마운트 때 정리
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const setNote = (id: string, note: string) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, note } : p)));
  };

  // --- 글 생성 ---
  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("주제를 입력해주세요.");
      return;
    }
    if (photos.length === 0) {
      setError("사진을 1장 이상 선택해주세요.");
      setStep("photos");
      return;
    }
    setError(null);
    setGenerating(true);
    const snapshot = [...photos];
    const req: PhotoBlogRequest = {
      topic: topic.trim(),
      place: place.trim() || undefined,
      date: date || undefined,
      tone,
      photos: snapshot.map((p) => ({ base64: p.aiBase64, mime: "image/jpeg" as const, note: p.note.trim() || undefined })),
    };
    try {
      const res = await generatePhotoBlog(req);
      setGenPhotos(snapshot);
      setGenRequest(req);
      setResult(res);
      setTagsInput(res.tags.join(", "));
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "글 생성에 실패했어요.");
    } finally {
      setGenerating(false);
    }
  };

  // --- 문단 다시 쓰기 ---
  const handleRegenerate = async (photoIndex: number) => {
    if (!result || !genRequest) return;
    setError(null);
    setRegenIndex(photoIndex);
    try {
      const { heading, body } = await regenerateSection({ ...genRequest, draft: result }, photoIndex);
      setResult((prev) =>
        prev
          ? { ...prev, sections: prev.sections.map((s) => (s.photoIndex === photoIndex ? { ...s, heading, body } : s)) }
          : prev
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "문단 다시 쓰기에 실패했어요.");
    } finally {
      setRegenIndex(null);
    }
  };

  const updateSection = (photoIndex: number, patch: { heading?: string; body?: string }) => {
    setResult((prev) =>
      prev
        ? { ...prev, sections: prev.sections.map((s) => (s.photoIndex === photoIndex ? { ...s, ...patch } : s)) }
        : prev
    );
  };

  // --- 에디터에 넣기: 1600px JPEG 업로드 → HTML 조립 ---
  const handleInsert = async () => {
    if (!result) return;
    setError(null);
    const total = result.sections.length;
    setInserting({ done: 0, total });
    try {
      const urls: string[] = [];
      for (let i = 0; i < result.sections.length; i++) {
        const photo = genPhotos[result.sections[i].photoIndex];
        if (!photo) { urls.push(""); continue; }
        const { blob } = await resizeImage(photo.file, BLOG_UPLOAD_MAX_SIDE);
        const url = await uploadBlobToBlogStorage(blob, "jpg");
        if (!url) throw new Error(`사진 ${i + 1} 업로드에 실패했어요. 네트워크를 확인하고 다시 시도해주세요.`);
        urls.push(url);
        setInserting({ done: i + 1, total });
      }
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean);
      onInsert({ title: result.title.trim(), html: buildPostHtml(result, urls), tags });
      resetAll();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "에디터에 넣지 못했어요.");
    } finally {
      setInserting(null);
    }
  };

  const resetAll = () => {
    setStep("photos");
    setPhotos([]);
    setTopic("");
    setPlace("");
    setDate(todayStr());
    setTone("담백");
    setResult(null);
    setGenPhotos([]);
    setGenRequest(null);
    setTagsInput("");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && busy) return; // 작업 중엔 닫기 방지
    onOpenChange(next);
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex flex-col gap-0 p-0 w-full max-w-lg h-[100dvh] sm:h-[min(88vh,820px)] sm:rounded-xl overflow-hidden border-0 sm:border"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-5 pt-4 pb-3 border-b border-border/60 pr-12">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Camera className="h-4 w-4 text-primary" />
            사진으로 글쓰기
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            사진을 고르면 AI가 사진에 보이는 것만으로 초안을 써줘요
          </DialogDescription>
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mt-3">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1.5 flex-1">
                <div
                  className={`flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-semibold flex-shrink-0 ${
                    i < stepIndex
                      ? "bg-primary text-primary-foreground"
                      : i === stepIndex
                        ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < stepIndex ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className={`text-xs ${i === stepIndex ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
              </div>
            ))}
          </div>
        </div>

        {/* Body (scroll) */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 text-destructive px-3 py-2.5 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="flex-1 break-keep">{error}</p>
              <button onClick={() => setError(null)} className="p-1 -m-1" aria-label="닫기">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ---------------- Step 1: 사진 ---------------- */}
          {step === "photos" && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                }}
                disabled={addingPhotos || photos.length >= PHOTO_BLOG_MAX_PHOTOS}
                className={`w-full flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 transition-colors disabled:opacity-50 ${
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                {addingPhotos ? (
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                ) : (
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">
                  {addingPhotos ? "사진 준비 중..." : "사진 선택 또는 끌어다 놓기"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {photos.length}/{PHOTO_BLOG_MAX_PHOTOS}장 · 올린 순서대로 글이 이어져요
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              <ul className="space-y-2.5">
                {photos.map((p, i) => (
                  <li key={p.id} className="flex gap-3 rounded-xl bg-muted/30 p-2.5">
                    <div className="relative flex-shrink-0">
                      <img src={p.thumbUrl} alt={`사진 ${i + 1}`} className="h-20 w-20 rounded-lg object-cover bg-muted" />
                      <span className="absolute top-1 left-1 rounded bg-black/60 text-white text-[11px] font-semibold px-1.5 leading-5">
                        {i + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <input
                        type="text"
                        value={p.note}
                        onChange={(e) => setNote(p.id, e.target.value)}
                        placeholder="한 줄 메모 (선택) 예: 크림파스타 18,000원"
                        maxLength={80}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => movePhoto(i, -1)}
                          disabled={i === 0}
                          className="h-9 w-9 flex items-center justify-center rounded-lg bg-background border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"
                          aria-label="위로"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePhoto(i, 1)}
                          disabled={i === photos.length - 1}
                          className="h-9 w-9 flex items-center justify-center rounded-lg bg-background border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"
                          aria-label="아래로"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={() => removePhoto(p.id)}
                          className="h-9 px-3 flex items-center gap-1 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          aria-label="삭제"
                        >
                          <X className="h-4 w-4" />
                          삭제
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {photos.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  메모에 적은 가게 이름·가격·맛 같은 정보만 글에 들어가요. AI는 사진에 없는 사실을 지어내지 않아요.
                </p>
              )}
            </>
          )}

          {/* ---------------- Step 2: 정보 ---------------- */}
          {step === "info" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  주제 <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="예: 주말 성수동 카페 나들이"
                  maxLength={60}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">장소 (선택)</label>
                <input
                  type="text"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="예: 서울 성수동"
                  maxLength={60}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">날짜 (선택)</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">말투</label>
                <div className="grid grid-cols-3 gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTone(t.value)}
                      className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-2.5 transition-colors ${
                        tone === t.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-sm font-medium">{t.label}</span>
                      <span className={`text-[11px] ${tone === t.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {t.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                {photos.map((p, i) => (
                  <img key={p.id} src={p.thumbUrl} alt={`사진 ${i + 1}`} className="h-12 w-12 rounded-md object-cover flex-shrink-0" />
                ))}
              </div>
            </div>
          )}

          {/* ---------------- Step 3: 결과 ---------------- */}
          {step === "result" && result && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">제목</label>
                <input
                  type="text"
                  value={result.title}
                  onChange={(e) => setResult({ ...result, title: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">도입</label>
                <textarea
                  value={result.intro}
                  onChange={(e) => setResult({ ...result, intro: e.target.value })}
                  rows={3}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-base sm:text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                />
              </div>

              {result.sections.map((s) => {
                const photo = genPhotos[s.photoIndex];
                const isRegen = regenIndex === s.photoIndex;
                return (
                  <div key={s.photoIndex} className="rounded-xl bg-muted/30 p-3 space-y-2.5">
                    {photo && (
                      <img
                        src={photo.thumbUrl}
                        alt={`사진 ${s.photoIndex + 1}`}
                        className="w-full max-h-56 rounded-lg object-cover bg-muted"
                      />
                    )}
                    <input
                      type="text"
                      value={s.heading}
                      onChange={(e) => updateSection(s.photoIndex, { heading: e.target.value })}
                      placeholder="소제목"
                      disabled={isRegen}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                    />
                    <textarea
                      value={s.body}
                      onChange={(e) => updateSection(s.photoIndex, { body: e.target.value })}
                      rows={4}
                      disabled={isRegen}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-base sm:text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => handleRegenerate(s.photoIndex)}
                      disabled={busy}
                      className="w-full h-10 flex items-center justify-center gap-1.5 rounded-lg bg-blue-500/15 text-blue-500 text-sm font-medium hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                    >
                      {isRegen ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      {isRegen ? "다시 쓰는 중..." : "이 문단 다시 쓰기"}
                    </button>
                  </div>
                );
              })}

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">마무리</label>
                <textarea
                  value={result.outro}
                  onChange={(e) => setResult({ ...result, outro: e.target.value })}
                  rows={3}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-base sm:text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">태그 (쉼표로 구분)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer (sticky) */}
        <div className="flex-shrink-0 flex items-center gap-2 border-t border-border/60 px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-background">
          {step !== "photos" && (
            <button
              type="button"
              onClick={() => { setError(null); setStep(step === "result" ? "info" : "photos"); }}
              disabled={busy}
              className="h-11 px-4 flex items-center gap-1 rounded-lg bg-muted text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              이전
            </button>
          )}
          <div className="flex-1" />

          {step === "photos" && (
            <button
              type="button"
              onClick={() => { setError(null); setStep("info"); }}
              disabled={photos.length === 0 || addingPhotos}
              className="h-11 px-5 flex items-center gap-1 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              다음
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {step === "info" && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className="h-11 px-5 flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "사진 보고 쓰는 중..." : result ? "새로 생성" : "글 생성"}
            </button>
          )}

          {step === "result" && (
            <button
              type="button"
              onClick={handleInsert}
              disabled={busy || !result}
              className="h-11 px-5 flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {inserting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {inserting ? `사진 올리는 중 ${inserting.done}/${inserting.total}` : "에디터에 넣기"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoBlogWizard;
