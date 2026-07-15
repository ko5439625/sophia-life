import { useState, useRef, useCallback } from "react";
import {
  X,
  Upload,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import type {
  WeddingVendor,
  WeddingSettlementItem,
  Receipt,
  AIExtractionResult,
  Payer,
  PaymentMethod,
  PaymentStatus,
  VendorCategory,
} from "./weddingTypes";
import {
  PAYER_LABELS,
  PAYER_COLORS,
  METHOD_LABELS,
  METHOD_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORY_LABELS,
  CATEGORY_EMOJIS,
} from "./weddingTypes";
import type { useWeddingSettlement } from "./useWeddingSettlement";

// ---------------------------------------------------------------------------
// Gemini Vision API
// ---------------------------------------------------------------------------

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"];

function getGeminiKey(): string | null {
  return localStorage.getItem("sophia-api-gemini");
}

interface ParsedResult {
  vendorName: string;
  vendorCategory: VendorCategory;
  emoji?: string;
  documentType?: string;
  totalAmount: number;
  items: {
    name: string;
    description?: string;
    unitPrice?: number;
    quantity?: number;
    amount: number;
    payer?: Payer;
    paymentMethod?: PaymentMethod;
    paymentStatus?: PaymentStatus;
    isPrepayment?: boolean;
  }[];
  paidAmount?: number;
  paymentMethod?: string;
  paidDate?: string;
  confidence: number;
  notes?: string;
}

/**
 * Robust JSON parser that handles common Gemini output quirks:
 * - Trailing commas before } or ]
 * - Missing commas between object/array elements
 * - Unescaped newlines inside strings
 * - Comments or extra text surrounding JSON
 */
function safeParseJson(raw: string): ParsedResult {
  // 1. Direct parse
  try {
    return JSON.parse(raw);
  } catch { /* continue */ }

  // 2. Extract outermost { ... }
  const outerMatch = raw.match(/\{[\s\S]*\}/);
  if (!outerMatch) throw new Error("AI 응답에서 JSON을 찾을 수 없습니다");

  let json = outerMatch[0];

  // 3. Fix trailing commas: ,} or ,]
  json = json.replace(/,\s*([}\]])/g, "$1");

  // 4. Fix missing commas between elements:
  //    }\n  { → },\n  {   and   ]\n  [ → ],\n  [
  //    "value"\n  " → "value",\n  "
  //    number\n  " → number,\n  "
  json = json.replace(/(\})\s*\n(\s*\{)/g, "$1,\n$2");
  json = json.replace(/(\])\s*\n(\s*\[)/g, "$1,\n$2");
  json = json.replace(/(["}\]\d])\s*\n(\s*")/g, "$1,\n$2");
  // "value"  "next" on same line (missing comma)
  json = json.replace(/(["}\]\d])\s+(["{\[])/g, "$1, $2");

  // 5. Fix missing comma after boolean/null
  json = json.replace(/(true|false|null)\s*\n(\s*")/g, "$1,\n$2");

  try {
    return JSON.parse(json);
  } catch { /* continue */ }

  // 6. Last resort: try to find items array and fix individually
  try {
    // Remove all control characters except \n
    json = json.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "");
    // Normalize whitespace in problematic areas
    json = json.replace(/,\s*,/g, ",");
    return JSON.parse(json);
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "AI 응답 파싱 실패"
    );
  }
}

/** Supported MIME types for Gemini inline data */
const GEMINI_INLINE_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif",
  "application/pdf",
]);

function buildPrompt(userMemo: string) {
  return `당신은 결혼 준비 영수증/견적서/계약서 분석 전문가입니다.
첨부된 파일을 분석하여 JSON으로 응답하세요.

## 핵심 규칙
- 문서에 적힌 숫자를 그대로 사용하세요. 절대 추측하지 마세요.
- "할인 금액" 열이 있으면 할인 금액 기준으로 추출하세요.
- "서비스"로 표시된 항목(무료 제공)은 amount: 0, paymentStatus: "service"로 설정하세요.
- 단가×수량 패턴이 있으면 description에 "₩80,000 × 200명"처럼 기록하세요.
- 계약금이 명시되어 있으면 별도 행으로 isPrepayment: true, paymentStatus: "paid"로 넣으세요.
- "Grand Total + VAT" 또는 "VAT 포함" 줄이 있으면 반드시 그 금액을 totalAmount에 넣으세요. VAT 없는 합계가 아닌 VAT 포함 최종 금액이 totalAmount입니다.

## 사용자 메모
${userMemo || "(없음)"}

## 필드값 가이드
- vendorCategory: venue | studio | dress | makeup | gift | honeymoon | other
- payer: unset | ahyun | jaejun | share (아현=ahyun, 재준=jaejun)
- paymentMethod: unpaid | credit-once | credit-installment | check | cash-receipt | transfer
- paymentStatus: unpaid | partial | paid | service (서비스=무료 제공 항목, 결제 불필요)

## JSON 스키마 (이 형식만 출력)
{"vendorName":"","vendorCategory":"venue","emoji":"💒","totalAmount":0,"items":[{"name":"","description":"","unitPrice":0,"quantity":0,"amount":0,"payer":"unset","paymentMethod":"unpaid","paymentStatus":"unpaid","isPrepayment":false}],"confidence":0.9,"notes":""}`;
}

async function analyzeReceiptWithGemini(
  files: FileData[],
  userMemo: string
): Promise<ParsedResult> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("Gemini API 키가 설정되지 않았습니다. 설정 > API 키에서 입력해주세요.");

  // Build parts: files (images + PDFs) + text prompt
  const parts: Record<string, unknown>[] = [];

  for (const f of files) {
    if (f.base64 && GEMINI_INLINE_TYPES.has(f.mimeType)) {
      parts.push({
        inlineData: {
          mimeType: f.mimeType,
          data: f.base64,
        },
      });
    }
  }

  parts.push({ text: buildPrompt(userMemo) });

  // Try models in order (fallback on 429/503/overloaded)
  let lastError = "";
  for (const model of GEMINI_MODELS) {
    const isThinking = model === "gemini-2.5-flash" || model === "gemini-2.5-pro";
    try {
      const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
            ...(isThinking ? { thinkingConfig: { thinkingBudget: 1024 } } : {}),
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = `${model} (${res.status}): ${errText.slice(0, 200)}`;
        // Retry with next model on overload/deprecation errors
        if (res.status === 429 || res.status === 503 || res.status === 404) {
          console.warn(`[Wedding AI] ${model} unavailable, trying next...`);
          continue;
        }
        throw new Error(`Gemini API 오류 (${res.status}): ${errText.slice(0, 300)}`);
      }

      const data = await res.json();
      const responseParts = data.candidates?.[0]?.content?.parts;
      if (!responseParts?.length) {
        lastError = `${model}: empty response`;
        continue;
      }

      // Extract non-thinking text part
      let text = "";
      for (let i = responseParts.length - 1; i >= 0; i--) {
        if (!responseParts[i].thought && responseParts[i].text) {
          text = responseParts[i].text;
          break;
        }
      }
      if (!text) text = responseParts[responseParts.length - 1]?.text ?? "";

      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const result = safeParseJson(cleaned);
      console.log(`[Wedding AI] Success with ${model}`);
      return result;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.warn(`[Wedding AI] ${model} failed:`, lastError);
      // If it's a retryable model error, try next
      if (lastError.includes("503") || lastError.includes("429") || lastError.includes("404") || lastError.includes("UNAVAILABLE") || lastError.includes("NOT_FOUND")) {
        continue;
      }
      throw e;
    }
  }

  throw new Error(`모든 AI 모델 실패: ${lastError}`);
}

// ---------------------------------------------------------------------------
// File handling types
// ---------------------------------------------------------------------------

interface FileData {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  base64: string;
  dataUrl: string;
  preview?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReceiptModalProps {
  onClose: () => void;
  store: ReturnType<typeof useWeddingSettlement>;
  onVendorCreated?: (vendorId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReceiptModal({
  onClose,
  store,
  onVendorCreated,
}: ReceiptModalProps) {
  const [phase, setPhase] = useState<"input" | "preview">("input");
  const [files, setFiles] = useState<FileData[]>([]);
  const [memo, setMemo] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);

  // For preview editing
  const [editItems, setEditItems] = useState<ParsedResult["items"]>([]);
  const [editVendorName, setEditVendorName] = useState("");
  const [editCategory, setEditCategory] = useState<VendorCategory>("other");
  const [vatApplied, setVatApplied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // ---- File handling ----

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: FileData[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name}: 10MB 초과`);
        continue;
      }
      const base64 = await fileToBase64(file);
      const dataUrl = `data:${file.type};base64,${base64}`;
      newFiles.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        base64,
        dataUrl,
      });
    }
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // ---- Drag & Drop ----

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // ---- AI Analysis ----

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError("영수증을 1개 이상 첨부해주세요");
      return;
    }
    setAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeReceiptWithGemini(files, memo);
      setParsedResult(result);
      setEditVendorName(result.vendorName || "");
      setEditCategory(result.vendorCategory || "other");
      setEditItems(result.items || []);
      setPhase("preview");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "분석 실패";
      console.error("[Wedding AI]", msg, err);
      setError(msg);
      // Show empty preview for manual input
      setParsedResult(null);
      setEditVendorName("");
      setEditCategory("other");
      setEditItems([{ name: "", amount: 0, payer: "unset", paymentMethod: "unpaid", paymentStatus: "unpaid" }]);
      setPhase("preview");
    } finally {
      setAnalyzing(false);
    }
  };

  // ---- Confirm & Save ----

  const handleConfirm = () => {
    const vendorId = crypto.randomUUID();
    const now = Date.now();

    // Create vendor
    const vendor: WeddingVendor = {
      id: vendorId,
      name: editVendorName || "새 업체",
      category: editCategory,
      emoji: CATEGORY_EMOJIS[editCategory],
      vatApplied,
      createdAt: now,
      updatedAt: now,
    };
    store.addVendor(vendor);

    // Create items
    const settlementItems: WeddingSettlementItem[] = editItems.map(
      (item, idx) => ({
        id: crypto.randomUUID(),
        vendorId,
        name: item.name || "",
        description: item.description,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        amount: item.amount || 0,
        payer: item.payer || "unset",
        paymentMethod: item.paymentMethod || "unpaid",
        paymentStatus: item.paymentStatus || "unpaid",
        isPrepayment: item.isPrepayment || false,
        order: idx,
      })
    );
    store.addItems(settlementItems);

    // Create receipts
    const receiptRecords: Receipt[] = files.map((f) => ({
      id: crypto.randomUUID(),
      vendorId,
      filename: f.name,
      dataUrl: f.dataUrl,
      fileSize: f.size,
      mimeType: f.mimeType,
      uploadedAt: now,
      aiExtracted: parsedResult
        ? {
            extractedAt: now,
            parsedItems: editItems.map((i) => ({ ...i })),
            totalAmount: editItems.reduce((s, i) => s + (i.amount || 0), 0),
            confidence: parsedResult.confidence,
            model: "gemini-2.5-flash",
            userMemo: memo,
          }
        : undefined,
    }));
    store.addReceipts(receiptRecords);

    onVendorCreated?.(vendorId);
    onClose();
  };

  // ---- Keyboard ----

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      if (phase === "input" && !analyzing) handleAnalyze();
      if (phase === "preview") handleConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-sm font-bold">
            {phase === "input" ? "영수증 추가" : "AI 분석 결과"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground/50 hover:text-foreground rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {phase === "input" ? (
            <InputPhase
              files={files}
              memo={memo}
              setMemo={setMemo}
              processFiles={processFiles}
              removeFile={removeFile}
              fileInputRef={fileInputRef}
              dropRef={dropRef}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              error={error}
            />
          ) : (
            <PreviewPhase
              parsedResult={parsedResult}
              editVendorName={editVendorName}
              setEditVendorName={setEditVendorName}
              editCategory={editCategory}
              setEditCategory={setEditCategory}
              editItems={editItems}
              setEditItems={setEditItems}
              files={files}
              error={error}
              vatApplied={vatApplied}
              setVatApplied={setVatApplied}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/30">
          <div className="text-[11px] text-muted-foreground/40">
            {phase === "input" ? "Cmd+Enter: AI 분석" : "Cmd+Enter: 확정 추가"}
          </div>
          <div className="flex gap-2">
            {phase === "input" ? (
              <>
                <button
                  onClick={onClose}
                  className="text-xs text-muted-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex items-center gap-1.5 text-xs text-primary-foreground bg-primary px-4 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      AI 분석
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setPhase("input");
                    setError(null);
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  다시 입력
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex items-center gap-1.5 text-xs text-primary-foreground bg-primary px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  확정 추가
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input Phase
// ---------------------------------------------------------------------------

function InputPhase({
  files,
  memo,
  setMemo,
  processFiles,
  removeFile,
  fileInputRef,
  dropRef,
  handleDragOver,
  handleDrop,
  error,
}: {
  files: FileData[];
  memo: string;
  setMemo: (v: string) => void;
  processFiles: (f: FileList | File[]) => void;
  removeFile: (id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  dropRef: React.RefObject<HTMLDivElement | null>;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">
          영수증 첨부
        </label>
        <div
          ref={dropRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <Upload className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground/60">
            이미지를 드래그하거나 클릭하여 선택
          </p>
          <p className="text-[11px] text-muted-foreground/40 mt-1">
            PDF, JPG, PNG, HEIC (최대 10MB)
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.heic"
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {/* File chips */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-1.5 text-xs"
            >
              {f.mimeType.startsWith("image/") ? (
                <img
                  src={f.dataUrl}
                  alt={f.name}
                  className="w-6 h-6 rounded object-cover"
                />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground/50" />
              )}
              <span className="truncate max-w-[120px]">{f.name}</span>
              <span className="text-[11px] text-muted-foreground/40">
                {(f.size / 1024).toFixed(0)}KB
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(f.id);
                }}
                className="p-0.5 text-muted-foreground/30 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Memo */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">내용 메모</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={5}
          placeholder={`업체명 / 카테고리 / 결제자·결제수단을 적으면 정확도가 올라갑니다.

예시:
- 이거는 웨딩홀 본계약
- 메리골드 가든
- 식대 70,000원 × 200명 보증
- 계약금 4,000,000원 = 아현 / 신용카드 일시불
- 잔금 9/20 예정`}
          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview Phase
// ---------------------------------------------------------------------------

function PreviewPhase({
  parsedResult,
  editVendorName,
  setEditVendorName,
  editCategory,
  setEditCategory,
  editItems,
  setEditItems,
  files,
  error,
  vatApplied,
  setVatApplied,
}: {
  parsedResult: ParsedResult | null;
  editVendorName: string;
  setEditVendorName: (v: string) => void;
  editCategory: VendorCategory;
  setEditCategory: (v: VendorCategory) => void;
  editItems: ParsedResult["items"];
  setEditItems: React.Dispatch<React.SetStateAction<ParsedResult["items"]>>;
  files: FileData[];
  error: string | null;
  vatApplied: boolean;
  setVatApplied: (v: boolean) => void;
}) {
  const totalAmount = editItems
    .filter((i) => !i.isPrepayment && i.paymentStatus !== "service")
    .reduce((s, i) => s + (i.amount || 0), 0);

  const applyVat = () => {
    if (vatApplied) return;
    setEditItems((prev) =>
      prev.map((item) => {
        if (item.paymentStatus === "service") return item;
        return { ...item, amount: Math.round((item.amount || 0) * 11 / 10) };
      })
    );
    setVatApplied(true);
  };

  const removeVat = () => {
    if (!vatApplied) return;
    setEditItems((prev) =>
      prev.map((item) => {
        if (item.paymentStatus === "service") return item;
        return { ...item, amount: Math.round((item.amount || 0) * 10 / 11) };
      })
    );
    setVatApplied(false);
  };

  const updateEditItem = (idx: number, patch: Partial<ParsedResult["items"][0]>) => {
    setEditItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const removeEditItem = (idx: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addEditItem = () => {
    setEditItems((prev) => [
      ...prev,
      {
        name: "",
        amount: 0,
        payer: "unset",
        paymentMethod: "unpaid",
        paymentStatus: "unpaid",
      },
    ]);
  };

  return (
    <div className="space-y-4">
      {/* Confidence banner */}
      {parsedResult ? (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 rounded-lg px-3 py-2 text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          AI 분석 완료 · 신뢰도 {Math.round(parsedResult.confidence * 100)}%
          {parsedResult.notes && (
            <span className="text-emerald-500/60 ml-1">— {parsedResult.notes}</span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-2 text-xs">
          <AlertCircle className="h-3.5 w-3.5" />
          AI 분석 실패 · 수동으로 입력해주세요
          {error && <span className="text-amber-500/60 ml-1">({error})</span>}
        </div>
      )}

      {/* Vendor card */}
      <div className="bg-muted/30 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{CATEGORY_EMOJIS[editCategory]}</span>
          <input
            value={editVendorName}
            onChange={(e) => setEditVendorName(e.target.value)}
            placeholder="업체명"
            className="flex-1 bg-transparent text-sm font-bold focus:outline-none focus:bg-background/50 rounded px-1 py-0.5"
          />
          <select
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value as VendorCategory)}
            className="text-[11px] bg-background border border-border rounded px-2 py-1"
          >
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-muted-foreground/60 font-mono">
          합계 ₩{totalAmount.toLocaleString()}
        </p>
      </div>

      {/* Items table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_90px_80px_80px_80px_70px_28px] gap-0 bg-muted/50 text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
          <div className="p-1.5">내역</div>
          <div className="p-1.5">설명</div>
          <div className="p-1.5">결제자</div>
          <div className="p-1.5">결제수단</div>
          <div className="p-1.5">상태</div>
          <div className="p-1.5 text-right">금액</div>
          <div className="p-1.5" />
        </div>

        {editItems.map((item, idx) => (
          <div
            key={idx}
            className={`grid grid-cols-[1fr_90px_80px_80px_80px_70px_28px] gap-0 border-t border-border/30 hover:bg-muted/10 ${
              item.isPrepayment ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""
            }`}
          >
            <div className="p-1">
              <input
                value={item.name}
                onChange={(e) => updateEditItem(idx, { name: e.target.value })}
                placeholder="내역명"
                className="w-full bg-transparent text-[11px] px-1 py-0.5 rounded focus:bg-muted/50 focus:outline-none"
              />
            </div>
            <div className="p-1">
              <input
                value={item.description || ""}
                onChange={(e) => updateEditItem(idx, { description: e.target.value })}
                placeholder="설명"
                className="w-full bg-transparent text-[11px] text-muted-foreground px-1 py-0.5 rounded focus:bg-muted/50 focus:outline-none"
              />
            </div>
            <div className="p-1">
              <select
                value={item.payer || "unset"}
                onChange={(e) => updateEditItem(idx, { payer: e.target.value as Payer })}
                className={`w-full text-[11px] px-1 py-0.5 rounded-full border-0 ${PAYER_COLORS[item.payer || "unset"]}`}
              >
                {Object.entries(PAYER_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="p-1">
              <select
                value={item.paymentMethod || "unpaid"}
                onChange={(e) => updateEditItem(idx, { paymentMethod: e.target.value as PaymentMethod })}
                className={`w-full text-[11px] px-1 py-0.5 rounded-full border-0 ${METHOD_COLORS[item.paymentMethod || "unpaid"]}`}
              >
                {Object.entries(METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="p-1">
              <select
                value={item.paymentStatus || "unpaid"}
                onChange={(e) => updateEditItem(idx, { paymentStatus: e.target.value as PaymentStatus })}
                className={`w-full text-[11px] px-1 py-0.5 rounded-full border-0 ${STATUS_COLORS[item.paymentStatus || "unpaid"]}`}
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="p-1">
              <input
                type="number"
                value={item.amount || ""}
                onChange={(e) => updateEditItem(idx, { amount: Number(e.target.value) || 0 })}
                className="w-full text-right text-[11px] font-mono bg-transparent px-1 py-0.5 rounded focus:bg-muted/50 focus:outline-none"
              />
            </div>
            <div className="p-1 flex items-center justify-center">
              <button
                onClick={() => removeEditItem(idx)}
                className="p-0.5 text-muted-foreground/20 hover:text-red-400"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
        ))}

        {/* Total */}
        <div className="grid grid-cols-[1fr_90px_80px_80px_80px_70px_28px] gap-0 border-t border-border bg-muted/20">
          <div className="p-1.5 col-span-5 flex items-center gap-2">
            <span className="text-[11px] font-bold">합계</span>
            {!vatApplied ? (
              <button
                onClick={applyVat}
                className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
              >
                +VAT 10%
              </button>
            ) : (
              <button
                onClick={removeVat}
                className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-300 transition-colors"
              >
                VAT 적용됨 ✓
              </button>
            )}
          </div>
          <div className="p-1.5 text-right text-[11px] font-bold font-mono">
            ₩{totalAmount.toLocaleString()}
          </div>
          <div />
        </div>

        <button
          onClick={addEditItem}
          className="w-full text-[11px] text-muted-foreground/50 hover:text-muted-foreground py-1.5 border-t border-border hover:bg-muted/30 transition-colors"
        >
          + 항목 추가
        </button>
      </div>

      {/* Receipt info */}
      {files.length > 0 && (
        <p className="text-[11px] text-muted-foreground/50">
          첨부 영수증 {files.length}장이 이 업체에 연결됩니다
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
