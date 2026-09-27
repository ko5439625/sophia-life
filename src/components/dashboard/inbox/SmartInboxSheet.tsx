// 붙여넣기로 기록 — 채팅/메모/사진 → AI 정리 → 항목별 검토(승인/제외, 되묻기) → 최종 확인 → 저장
// 사용자가 최종 [저장]을 누르기 전에는 어떤 DB 쓰기/사진 업로드도 하지 않는다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ClipboardPaste, ImagePlus, Loader2, Sparkles, X, Check, AlertCircle, Send } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFinancial } from "@/store/financialStore";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { resizeImage } from "@/lib/imageResize";
import { cn } from "@/lib/utils";
import {
  extractItems,
  saveItem,
  uploadInboxAttachment,
  canStoreAttachment,
  INBOX_AI_MAX_SIDE,
  INBOX_MAX_IMAGES,
  INBOX_TARGET_LABEL,
  INBOX_TARGET_TAB,
  INBOX_TYPE_LABEL,
} from "@/services/smartInboxApi";
import type { InboxImage, InboxItem, InboxItemType, MissingQuestion } from "@/services/smartInboxApi";
import InboxItemCard from "./InboxItemCard";
import type { ReviewStatus, SaveState } from "./InboxItemCard";
import { applyAnswer, getExpenseCategories, isReady, setField } from "./inboxAnswers";
import { TYPE_STYLE, summarizeItem } from "./inboxUi";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onNavigate?: (tabId: string) => void;
}

interface Attachment {
  id: string;
  /** 원본 (저장 승인 후 1600px로 줄여 업로드) */
  original: Blob;
  /** 1024px JPEG 미리보기 object URL */
  preview: string;
  ai: InboxImage;
}

type Step = "input" | "review" | "confirm" | "result";

const TYPE_ORDER: InboxItemType[] = ["expense", "todo", "event", "memo", "wedding"];

export default function SmartInboxSheet({ open, onOpenChange, onNavigate }: Props) {
  const isMobile = useIsMobile();
  const title = "붙여넣기로 기록";
  const desc = "채팅·메모·사진을 넣으면 AI가 지출/할 일/일정/메모로 나눠드려요. 승인한 것만 저장돼요.";

  const panel = useInboxPanel({ open, onOpenChange, onNavigate });

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={panel.requestOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[92dvh] flex-col gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] [&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:flex [&>button:last-child]:h-11 [&>button:last-child]:w-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center"
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          <SheetDescription className="sr-only">{desc}</SheetDescription>
          {panel.content}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={panel.requestOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0 [&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:flex [&>button:last-child]:h-11 [&>button:last-child]:w-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{desc}</DialogDescription>
        {panel.content}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function useInboxPanel({ onOpenChange, onNavigate }: Props) {
  const { state, addExpense } = useFinancial();
  const categories = useMemo(() => getExpenseCategories(state.monthlyBudgets, new Date()), [state.monthlyBudgets]);

  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ReviewStatus>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [qaLog, setQaLog] = useState<{ question: string; answer: string }[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | "extract" | "refine" | "attach" | "save">(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadedUrls = useRef<Record<string, string>>({});

  // object URL 정리
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  useEffect(() => () => attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.preview)), []);

  const reset = useCallback(() => {
    attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.preview));
    setStep("input");
    setText("");
    setAttachments([]);
    setItems([]);
    setStatuses({});
    setSaveStates({});
    setQaLog([]);
    setNote("");
    setError(null);
    setInfo(null);
    uploadedUrls.current = {};
  }, []);

  // ---- 파생 값 ----
  const live = items.filter((it) => saveStates[it.id]?.status !== "saved");
  const approvedItems = live.filter((it) => statuses[it.id] === "approved" && isReady(it));
  const pendingReady = live.filter((it) => statuses[it.id] !== "approved" && statuses[it.id] !== "excluded" && isReady(it));
  const needAnswer = live.filter((it) => statuses[it.id] !== "excluded" && !isReady(it));
  const savedItems = items.filter((it) => saveStates[it.id]?.status === "saved");
  const failedItems = items.filter((it) => saveStates[it.id]?.status === "error");

  // ---- 닫기 가드 ----
  const requestOpenChange = useCallback(
    async (o: boolean) => {
      if (o) return onOpenChange(true);
      if (busy === "save") return;
      if (approvedItems.length > 0 && step !== "result") {
        const ok = await confirmDialog({
          title: "저장하지 않고 닫을까요?",
          description: `승인한 ${approvedItems.length}개가 아직 저장되지 않았어요.`,
          confirmText: "닫기",
          cancelText: "계속 검토",
        });
        if (!ok) return;
        reset();
      } else if (step === "result") {
        reset();
      }
      onOpenChange(false);
    },
    [approvedItems.length, busy, onOpenChange, reset, step]
  );

  // ---- 첨부 ----
  const addFiles = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (imgs.length === 0) return;
    const room = INBOX_MAX_IMAGES - attachmentsRef.current.length;
    if (room <= 0) {
      setError(`사진은 최대 ${INBOX_MAX_IMAGES}장까지 넣을 수 있어요.`);
      return;
    }
    setBusy("attach");
    setError(null);
    const added: Attachment[] = [];
    try {
      for (const f of imgs.slice(0, room)) {
        const r = await resizeImage(f, INBOX_AI_MAX_SIDE);
        added.push({
          id: crypto.randomUUID(),
          original: f,
          preview: URL.createObjectURL(r.blob),
          ai: { base64: r.base64, mime: "image/jpeg" },
        });
      }
      if (imgs.length > room) setError(`사진은 최대 ${INBOX_MAX_IMAGES}장까지라 ${imgs.length - room}장은 빼었어요.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 불러오지 못했어요.");
    } finally {
      setAttachments((prev) => [...prev, ...added]);
      setBusy(null);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const a = prev.find((x) => x.id === id);
      if (a) URL.revokeObjectURL(a.preview);
      return prev.filter((x) => x.id !== id);
    });
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    if (!e.clipboardData.getData("text")) e.preventDefault();
    void addFiles(files);
  };

  const pasteFromClipboard = async () => {
    setError(null);
    setInfo(null);
    try {
      // 이미지 우선 시도 (지원 브라우저만)
      if (navigator.clipboard && "read" in navigator.clipboard) {
        try {
          const clipItems = await navigator.clipboard.read();
          const files: File[] = [];
          let pastedText = "";
          for (const ci of clipItems) {
            const imgType = ci.types.find((t) => t.startsWith("image/"));
            if (imgType) {
              const blob = await ci.getType(imgType);
              files.push(new File([blob], `clipboard.${imgType.split("/")[1] || "png"}`, { type: imgType }));
            } else if (ci.types.includes("text/plain")) {
              pastedText += await (await ci.getType("text/plain")).text();
            }
          }
          if (pastedText) setText((prev) => (prev ? prev + "\n" : "") + pastedText);
          if (files.length) await addFiles(files);
          if (pastedText || files.length) return;
        } catch {
          /* read() 미지원/거부 → readText 로 */
        }
      }
      const t = await navigator.clipboard.readText();
      if (!t) {
        setInfo("클립보드가 비어 있어요.");
        return;
      }
      setText((prev) => (prev ? prev + "\n" : "") + t);
    } catch {
      setInfo("클립보드를 읽을 수 없어요. 입력칸을 길게 눌러 직접 붙여넣어 주세요.");
      textareaRef.current?.focus();
    }
  };

  // ---- 추출 ----
  const runExtract = async (mode: "extract" | "refine") => {
    setBusy(mode);
    setError(null);
    setInfo(null);
    try {
      const result = await extractItems(text, new Date(), {
        images: attachments.map((a) => a.ai),
        expenseCategories: categories,
        followUp:
          mode === "refine"
            ? { previousItems: live, answers: qaLog, note }
            : undefined,
      });
      if (result.length === 0) {
        if (mode === "extract") setError("기록할 내용을 찾지 못했어요");
        else setError("다시 정리했지만 기록할 내용을 찾지 못했어요. 기존 목록은 그대로 둘게요.");
        return;
      }
      // 이미 저장된 항목은 유지하고, 나머지는 새 결과로 교체 (모두 검토 대기)
      setItems([...savedItems, ...result]);
      setStatuses((prev) => {
        const next: Record<string, ReviewStatus> = {};
        savedItems.forEach((it) => (next[it.id] = prev[it.id] ?? "approved"));
        result.forEach((it) => (next[it.id] = "pending"));
        return next;
      });
      if (mode === "refine") setNote("");
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "정리에 실패했어요.");
    } finally {
      setBusy(null);
    }
  };

  // ---- 카드 조작 ----
  const updateItem = (id: string, fn: (it: InboxItem) => InboxItem) => {
    setItems((prev) => prev.map((it) => (it.id === id ? fn(it) : it)));
    setSaveStates((prev) => {
      if (prev[id]?.status !== "error") return prev;
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
  };

  const setStatus = (id: string, s: ReviewStatus) => setStatuses((prev) => ({ ...prev, [id]: s }));

  const onField = (id: string, field: string, value: unknown) => {
    updateItem(id, (it) => setField(it, field, value));
  };

  const onAnswer = (id: string, q: MissingQuestion, answer: string, optionIndex?: number): string | null => {
    const it = items.find((x) => x.id === id);
    if (!it) return null;
    const r = applyAnswer(it, q, answer, new Date(), optionIndex);
    if ("error" in r) return r.error;
    updateItem(id, () => r.item);
    setQaLog((prev) => [...prev, { question: q.question, answer: r.answerText }]);
    return null;
  };

  const approveAll = async () => {
    if (pendingReady.length === 0) return;
    const ok = await confirmDialog({
      title: `준비된 ${pendingReady.length}개를 모두 승인할까요?`,
      description: "답변이 필요한 항목은 빼고 승인해요. 저장 전에 한 번 더 확인할 수 있어요.",
      confirmText: "모두 승인",
      destructive: false,
    });
    if (!ok) return;
    setStatuses((prev) => {
      const next = { ...prev };
      pendingReady.forEach((it) => (next[it.id] = "approved"));
      return next;
    });
  };

  // ---- 저장 (최종 확인 후) ----
  const runSave = async () => {
    const targets = approvedItems;
    if (targets.length === 0) return;
    setBusy("save");
    const savedList: InboxItem[] = [];
    let failedCount = 0;
    for (const it of targets) {
      setSaveStates((prev) => ({ ...prev, [it.id]: { status: "saving" } }));
      try {
        const urls: string[] = [];
        if (canStoreAttachment(it.type)) {
          for (const idx of it.attachmentIndexes) {
            const att = attachments[idx];
            if (!att) continue;
            if (!uploadedUrls.current[att.id]) uploadedUrls.current[att.id] = await uploadInboxAttachment(att.original);
            urls.push(uploadedUrls.current[att.id]);
          }
        }
        await saveItem(it, { addExpense, attachmentUrls: urls });
        setSaveStates((prev) => ({ ...prev, [it.id]: { status: "saved" } }));
        savedList.push(it);
      } catch (e) {
        const message = e instanceof Error ? e.message : "저장하지 못했어요.";
        setSaveStates((prev) => ({ ...prev, [it.id]: { status: "error", message } }));
        failedCount++;
      }
    }
    setBusy(null);
    setStep("result");
    notifySaved(savedList, failedCount);
  };

  const notifySaved = (saved: InboxItem[], failedCount: number) => {
    if (saved.length) {
      const summary = TYPE_ORDER.map((t) => [t, saved.filter((x) => x.type === t).length] as const)
        .filter(([, n]) => n > 0)
        .map(([t, n]) => `${INBOX_TYPE_LABEL[t]} ${n}`)
        .join(" · ");
      const first = saved[0];
      toast.success(`${summary} 저장했어요`, {
        position: "top-center", // 바텀시트 버튼을 가리지 않게
        action: onNavigate
          ? {
              label: "보러 가기",
              onClick: () => {
                onNavigate(INBOX_TARGET_TAB[first.type]);
                reset();
                onOpenChange(false);
              },
            }
          : undefined,
      });
    }
    if (failedCount) toast.error(`${failedCount}개는 저장하지 못했어요. 다시 시도할 수 있어요.`, { position: "top-center" });
  };

  // ---- 렌더 ----
  const previewsFor = (it: InboxItem) => it.attachmentIndexes.map((i) => attachments[i]?.preview).filter(Boolean) as string[];

  let body: React.ReactNode;
  let footer: React.ReactNode;
  let heading = "붙여넣기로 기록";
  let onBack: (() => void) | null = null;

  if (step === "input") {
    body = (
      <div className="space-y-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          placeholder={"채팅이나 메모를 붙여넣거나 말하듯 적어주세요\n예) 어제 성수에서 파스타 18500원 썼어, 다음주 토요일 3시 드레스 2차 피팅"}
          className="min-h-[200px] w-full resize-none rounded-xl border border-border bg-background p-3 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30"
          aria-label="기록할 내용"
          disabled={busy === "extract"}
        />
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2" data-testid="inbox-attachments">
            {attachments.map((a, i) => (
              <div key={a.id} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
                <img src={a.preview} alt={`첨부 ${i + 1}`} className="h-full w-full object-cover" />
                <span className="absolute bottom-0 left-0 rounded-tr-md bg-black/55 px-1.5 text-[11px] text-white">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1"
                  aria-label={`첨부 ${i + 1} 빼기`}
                  disabled={busy === "extract"}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
                    <X className="h-3.5 w-3.5" />
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={pasteFromClipboard}
            disabled={busy !== null}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border text-[14px] hover:bg-muted"
          >
            <ClipboardPaste className="h-4 w-4" /> 클립보드에서 붙여넣기
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null || attachments.length >= INBOX_MAX_IMAGES}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border text-[14px] hover:bg-muted disabled:opacity-50"
          >
            {busy === "attach" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} 사진 추가
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          data-testid="inbox-file-input"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void addFiles(files);
          }}
        />
        <p className="text-[12px] text-muted-foreground">
          영수증·채팅 캡처·청첩장 사진도 읽어요 (최대 {INBOX_MAX_IMAGES}장). 저장 전에는 아무것도 기록되지 않아요.
        </p>
        {info && <p className="text-[13px] text-muted-foreground">{info}</p>}
        {error && <InlineError message={error} />}
      </div>
    );
    footer = (
      <button
        type="button"
        onClick={() => runExtract("extract")}
        disabled={busy !== null || (!text.trim() && attachments.length === 0)}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-40"
      >
        {busy === "extract" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> 정리하는 중…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> 정리하기
          </>
        )}
      </button>
    );
  } else if (step === "review") {
    heading = "검토하고 승인하기";
    onBack = () => setStep("input");
    const visible = items;
    body = (
      <div className="space-y-3">
        <p className="text-[13px] text-muted-foreground">
          항목마다 내용을 확인하고 <b className="text-foreground">승인</b>해 주세요. 승인한 것만 저장돼요.
        </p>
        {visible.map((it) => (
          <InboxItemCard
            key={it.id}
            item={it}
            status={statuses[it.id] ?? "pending"}
            ready={isReady(it)}
            categories={categories}
            saveState={saveStates[it.id]}
            attachmentPreviews={previewsFor(it)}
            onStatus={(s) => setStatus(it.id, s)}
            onField={(f, v) => onField(it.id, f, v)}
            onAnswer={(q, a, i) => onAnswer(it.id, q, a, i)}
          />
        ))}

        {/* 추가로 알려주기 → 전체 다시 정리 */}
        <div className="rounded-2xl border border-dashed border-border p-3">
          <p className="mb-2 text-[13px] font-medium">추가로 알려주기</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예) 파스타는 둘이 먹은 거고 카페 아니고 식비야, 피팅은 청담 ○○드레스"
            className="min-h-[72px] w-full resize-none rounded-lg border border-border bg-background p-2.5 text-base leading-snug focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="추가로 알려주기"
            disabled={busy === "refine"}
          />
          <button
            type="button"
            onClick={() => runExtract("refine")}
            disabled={busy !== null || (!note.trim() && qaLog.length === 0)}
            className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-border text-[14px] hover:bg-muted disabled:opacity-40"
          >
            {busy === "refine" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            답변 반영해서 다시 정리
          </button>
          <p className="mt-1 text-[11px] text-muted-foreground">다시 정리하면 승인 상태는 초기화돼요.</p>
        </div>
        {error && <InlineError message={error} />}
      </div>
    );
    footer = (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-muted-foreground" data-testid="inbox-counts">
            승인 <b className="text-emerald-600 dark:text-emerald-400">{approvedItems.length}</b> · 대기 {pendingReady.length} · 답변 필요{" "}
            <b className={needAnswer.length ? "text-amber-600 dark:text-amber-400" : ""}>{needAnswer.length}</b>
          </p>
          {pendingReady.length > 0 && (
            <button type="button" onClick={approveAll} className="min-h-[44px] px-2 text-[13px] text-primary">
              모두 승인
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setStep("confirm")}
          disabled={approvedItems.length === 0 || busy !== null}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-40"
        >
          승인한 {approvedItems.length}개 저장
        </button>
      </div>
    );
  } else if (step === "confirm") {
    heading = "이렇게 저장할게요";
    onBack = busy === "save" ? null : () => setStep("review");
    body = (
      <div className="space-y-2">
        <p className="text-[13px] text-muted-foreground">아래 {approvedItems.length}개가 각 탭에 기록돼요.</p>
        {approvedItems.map((it) => {
          const previews = previewsFor(it);
          const st = saveStates[it.id];
          return (
            <div key={it.id} className="rounded-xl border border-border p-3" data-testid="inbox-confirm-item">
              <div className="flex items-center gap-1.5">
                <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-semibold", TYPE_STYLE[it.type])}>{INBOX_TYPE_LABEL[it.type]}</span>
                <span className="text-[12px] text-muted-foreground">→ {INBOX_TARGET_LABEL[it.type]}</span>
                {st?.status === "saving" && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <p className="mt-1.5 break-words text-[14px] leading-snug">{summarizeItem(it)}</p>
              {previews.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  {previews.map((u, i) => (
                    <img key={i} src={u} alt="" className="h-9 w-9 rounded-md border border-border object-cover" />
                  ))}
                  <span className="text-[12px] text-muted-foreground">
                    {canStoreAttachment(it.type)
                      ? `사진 ${previews.length}장을 올려 메모에 링크로 붙여요`
                      : "이 항목은 첨부를 저장할 수 없어요 (사진은 저장 안 됨)"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
    footer = (
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <button
          type="button"
          onClick={() => setStep("review")}
          disabled={busy === "save"}
          className="min-h-[48px] rounded-xl border border-border text-[15px] disabled:opacity-40"
        >
          뒤로
        </button>
        <button
          type="button"
          onClick={runSave}
          disabled={busy === "save" || approvedItems.length === 0}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
          data-testid="inbox-final-save"
        >
          {busy === "save" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> 저장하는 중…
            </>
          ) : (
            "저장"
          )}
        </button>
      </div>
    );
  } else {
    heading = "저장 결과";
    const done = items.filter((it) => saveStates[it.id]?.status === "saved" || saveStates[it.id]?.status === "error");
    const remaining = live.filter((it) => statuses[it.id] !== "excluded" && saveStates[it.id]?.status !== "error");
    body = (
      <div className="space-y-2" data-testid="inbox-result">
        {done.map((it) => {
          const st = saveStates[it.id];
          const ok = st?.status === "saved";
          return (
            <div key={it.id} className="flex items-start gap-2 rounded-xl border border-border p-3">
              {ok ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-muted-foreground">
                  {INBOX_TYPE_LABEL[it.type]} → {INBOX_TARGET_LABEL[it.type]}
                </p>
                <p className="break-words text-[14px] leading-snug">{summarizeItem(it)}</p>
                {st?.status === "error" && <p className="text-[12px] text-destructive">{st.message}</p>}
              </div>
              {ok && onNavigate && (
                <button
                  type="button"
                  className="min-h-[44px] shrink-0 px-2 text-[13px] text-primary"
                  onClick={() => {
                    onNavigate(INBOX_TARGET_TAB[it.type]);
                    reset();
                    onOpenChange(false);
                  }}
                >
                  보러 가기
                </button>
              )}
            </div>
          );
        })}
        {remaining.length > 0 && (
          <p className="text-[13px] text-muted-foreground">아직 검토하지 않은 항목이 {remaining.length}개 남아 있어요.</p>
        )}
      </div>
    );
    footer = (
      <div className="grid grid-cols-2 gap-2">
        {failedItems.length > 0 || remaining.length > 0 ? (
          <button
            type="button"
            onClick={() => setStep("review")}
            className="min-h-[48px] rounded-xl border border-border text-[15px]"
          >
            {failedItems.length > 0 ? "실패한 항목 다시 시도" : "남은 항목 검토"}
          </button>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="min-h-[48px] rounded-xl border border-border text-[15px]"
          >
            더 기록하기
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            reset();
            onOpenChange(false);
          }}
          className="min-h-[48px] rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground"
        >
          닫기
        </button>
      </div>
    );
  }

  const content = (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="smart-inbox" data-step={step}>
      <div className="flex min-h-[56px] items-center gap-1 border-b border-border px-2 pr-14">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted"
            aria-label="뒤로"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <span className="flex h-11 w-11 items-center justify-center text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
        )}
        <h2 className="truncate text-[16px] font-bold">{heading}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">{body}</div>
      <div className="border-t border-border bg-background px-4 py-3">{footer}</div>
    </div>
  );

  return { content, requestOpenChange };
}

function InlineError({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {message}
    </p>
  );
}
