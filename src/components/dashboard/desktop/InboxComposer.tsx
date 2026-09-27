// 데스크톱 홈 가운데 — 항상 떠 있는 "붙여넣기로 기록" 작성기 + 대화처럼 이어지는 정리 결과
// 저장 규칙은 시트와 동일: 승인 → 최종 확인 → 저장 (그 전엔 쓰기/업로드 없음)
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowUp, Check, ChevronRight, ImagePlus, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import InboxItemCard from "../inbox/InboxItemCard";
import { TYPE_STYLE, summarizeItem } from "../inbox/inboxUi";
import { canStoreAttachment, INBOX_MAX_IMAGES, INBOX_TARGET_LABEL, INBOX_TARGET_TAB, INBOX_TYPE_LABEL } from "@/services/smartInboxApi";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { useInboxFlow } from "./useInboxFlow";

export const FOCUS_INBOX_EVENT = "sophia:focus-inbox-composer";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function InboxComposer({ onNavigate }: { onNavigate?: (tabId: string) => void }) {
  const flow = useInboxFlow();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  // 헤더의 "붙여넣기로 기록" → 작성기로 포커스
  useEffect(() => {
    const focus = () => {
      taRef.current?.focus();
      taRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener(FOCUS_INBOX_EVENT, focus);
    return () => window.removeEventListener(FOCUS_INBOX_EVENT, focus);
  }, []);

  // 입력에 맞춰 늘어나는 textarea
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 88), 320)}px`;
  }, [flow.draft]);

  const reviewing = flow.step !== "input" && flow.items.length > 0;
  const placeholder = reviewing
    ? "추가로 알려주기 — 예) 파스타는 둘이 먹은 거고 식비야, 피팅은 청담 ○○드레스"
    : "무엇을 기록할까요?\n채팅·메모를 붙여넣거나 말하듯 적어주세요 — 예) 어제 성수에서 파스타 18500원, 다음주 토요일 3시 드레스 피팅";

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 한글 조합 중 Enter 는 무시 (조합 확정용)
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      void flow.send();
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    if (!e.clipboardData.getData("text")) e.preventDefault();
    void flow.addFiles(files);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void flow.addFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const startOver = async () => {
    if (flow.approvedItems.length > 0) {
      const ok = await confirmDialog({
        title: "지금 정리한 걸 비울까요?",
        description: `승인한 ${flow.approvedItems.length}개가 아직 저장되지 않았어요.`,
        confirmText: "비우기",
        cancelText: "계속 검토",
      });
      if (!ok) return;
    }
    flow.clearConversation();
  };

  const busyText = flow.busy === "extract" ? "정리하는 중…" : flow.busy === "refine" ? "다시 정리하는 중…" : null;

  return (
    <div className="space-y-3" data-testid="inbox-composer" data-step={flow.step}>
      {/* 작성기 */}
      <div
        onDragEnter={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          dragDepth.current++;
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          "relative rounded-2xl border bg-card transition-colors focus-within:border-foreground/40",
          dragging ? "border-foreground/60 bg-muted/40" : "border-border",
        )}
      >
        <div className="flex items-center gap-2 px-4 pt-3.5">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="text-[13px] font-semibold">{reviewing ? "추가로 알려주기" : "붙여넣기로 기록"}</span>
          <span className="text-xs text-muted-foreground">
            {reviewing ? "답을 적으면 전체를 다시 정리해요" : "지출 · 할 일 · 일정 · 메모 · 웨딩으로 나눠드려요"}
          </span>
          {flow.hasConversation && (
            <button
              type="button"
              onClick={startOver}
              disabled={flow.busy !== null}
              className="ml-auto inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" /> 새로 쓰기
            </button>
          )}
        </div>

        <textarea
          ref={taRef}
          value={flow.draft}
          onChange={(e) => flow.setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          aria-label="기록할 내용"
          disabled={flow.step === "confirm" || flow.busy === "save"}
          rows={3}
          className="block w-full resize-none bg-transparent px-4 pb-2 pt-2 text-[15px] leading-relaxed placeholder:text-muted-foreground/80 focus:outline-none disabled:opacity-50"
        />

        {flow.pending.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-2" data-testid="composer-attachments">
            {flow.pending.map((a, i) => (
              <div key={a.id} className="relative h-16 w-16 overflow-hidden rounded-xl border border-border">
                <img src={a.preview} alt={`첨부 ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => flow.removePending(a.id)}
                  className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label={`첨부 ${i + 1} 빼기`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-border px-2 py-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={flow.busy !== null || flow.step === "confirm"}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            {flow.busy === "attach" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            사진
          </button>
          <span className="hidden text-xs text-muted-foreground 2xl:inline">끌어다 놓거나 붙여넣기도 돼요 · 최대 {INBOX_MAX_IMAGES}장</span>
          <span className="ml-auto text-xs text-muted-foreground">
            <kbd className="rounded border border-border px-1 font-mono text-[11px]">Enter</kbd> 정리 ·{" "}
            <kbd className="rounded border border-border px-1 font-mono text-[11px]">Shift+Enter</kbd> 줄바꿈
          </span>
          <button
            type="button"
            onClick={() => void flow.send()}
            disabled={!flow.canSend}
            aria-label={reviewing ? "다시 정리" : "정리하기"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
          >
            {flow.busy === "extract" || flow.busy === "refine" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          data-testid="composer-file-input"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void flow.addFiles(files);
          }}
        />
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-background/70 text-sm font-medium">
            <ImagePlus className="mr-2 h-4 w-4" /> 여기에 놓으면 사진이 붙어요
          </div>
        )}
      </div>

      {flow.error && <InlineError message={flow.error} onClose={() => flow.setError(null)} />}

      {/* 저장 영수증 */}
      <AnimatePresence>
        {flow.receipt && (
          <motion.div
            key={flow.receipt.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[13px]"
            data-testid="inbox-receipt"
          >
            {flow.receipt.counts.length > 0 ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />}
            <span className="min-w-0 truncate">
              {flow.receipt.counts.map((c) => `${INBOX_TYPE_LABEL[c.type]} ${c.n}`).join(" · ")}
              {flow.receipt.counts.length > 0 && " 저장"}
              {flow.receipt.failed > 0 && <span className="text-destructive">{flow.receipt.counts.length > 0 ? " · " : ""}{flow.receipt.failed}개 실패</span>}
            </span>
            {flow.receipt.firstType && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate(INBOX_TARGET_TAB[flow.receipt!.firstType!])}
                className="inline-flex min-h-[32px] shrink-0 items-center gap-0.5 rounded-lg px-2 text-xs font-medium hover:bg-muted"
              >
                보러 가기 <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" onClick={flow.dismissReceipt} aria-label="닫기" className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 대화 흐름 */}
      {flow.turns.map((t, i) => {
        const isLast = i === flow.turns.length - 1;
        return (
          <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="space-y-3">
            {/* 사용자 입력 */}
            <div className="flex justify-end">
              <div className="max-w-[85%] space-y-2 rounded-2xl rounded-br-md bg-muted px-3.5 py-2.5" data-testid="inbox-user-turn">
                {t.text && <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{t.text}</p>}
                {t.previews.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {t.previews.map((u, k) => (
                      <img key={k} src={u} alt="" className="h-14 w-14 rounded-lg border border-border object-cover" />
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* AI 응답 */}
            <div className="flex gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1 pt-1">
                {t.resultCount === null ? (
                  <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {busyText ?? "정리하는 중…"}
                  </p>
                ) : t.error ? (
                  <p className="text-[13px] text-muted-foreground">{t.error}</p>
                ) : !isLast ? (
                  <p className="text-[13px] text-muted-foreground">{t.resultCount}개로 정리했어요 · 아래에서 다시 정리됨</p>
                ) : (
                  <p className="text-[13px] text-muted-foreground">
                    {t.resultCount}개로 정리했어요. 항목마다 확인하고 <b className="text-foreground">승인</b>해 주세요 — 승인한 것만 저장돼요.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* 현재 항목 */}
      {flow.items.length > 0 && (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {flow.step !== "confirm" &&
            flow.items.map((it) => (
              <InboxItemCard
                key={it.id}
                item={it}
                status={flow.statuses[it.id] ?? "pending"}
                ready={flow.isReady(it)}
                categories={flow.categories}
                saveState={flow.saveStates[it.id]}
                attachmentPreviews={flow.previewsFor(it)}
                onStatus={(s) => flow.setStatus(it.id, s)}
                onField={(f, v) => flow.onField(it.id, f, v)}
                onAnswer={(q, a, idx) => flow.onAnswer(it.id, q, a, idx)}
              />
            ))}

          {flow.step === "review" && (
            <div className="col-span-full flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
              <p className="min-w-0 flex-1 text-[13px] text-muted-foreground" data-testid="inbox-counts">
                승인 <b className="text-foreground">{flow.approvedItems.length}</b> · 대기 {flow.pendingReady.length} · 답변 필요{" "}
                <b className={flow.needAnswer.length ? "text-warn" : ""}>{flow.needAnswer.length}</b>
              </p>
              {flow.pendingReady.length > 0 && (
                <button type="button" onClick={flow.approveAllReady} className="min-h-[36px] shrink-0 rounded-lg px-2.5 text-[13px] hover:bg-muted">
                  준비된 {flow.pendingReady.length}개 모두 승인
                </button>
              )}
              <button
                type="button"
                onClick={() => flow.setStep("confirm")}
                disabled={flow.approvedItems.length === 0 || flow.busy !== null}
                className="min-h-[36px] shrink-0 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-40"
              >
                승인한 {flow.approvedItems.length}개 저장
              </button>
            </div>
          )}

          {flow.step === "confirm" && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="col-span-full space-y-2 rounded-2xl border border-foreground/30 bg-card p-3"
              data-testid="inbox-confirm"
            >
              <p className="text-[14px] font-semibold">이렇게 저장할게요</p>
              <p className="text-[12px] text-muted-foreground">아래 {flow.approvedItems.length}개가 각 탭에 기록돼요.</p>
              {flow.approvedItems.map((it) => {
                const previews = flow.previewsFor(it);
                const st = flow.saveStates[it.id];
                return (
                  <div key={it.id} className="rounded-xl border border-border p-2.5" data-testid="inbox-confirm-item">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold", TYPE_STYLE[it.type])}>{INBOX_TYPE_LABEL[it.type]}</span>
                      <span className="min-w-0 truncate text-[12px] text-muted-foreground">→ {INBOX_TARGET_LABEL[it.type]}</span>
                      {st?.status === "saving" && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    <p className="mt-1 break-words text-[14px] leading-snug">{summarizeItem(it)}</p>
                    {previews.length > 0 && (
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {canStoreAttachment(it.type) ? `사진 ${previews.length}장을 올려 메모에 링크로 붙여요` : "이 항목은 사진을 저장하지 않아요"}
                      </p>
                    )}
                  </div>
                );
              })}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => flow.setStep("review")}
                  disabled={flow.busy === "save"}
                  className="min-h-[40px] rounded-lg border border-border px-4 text-[14px] hover:bg-muted disabled:opacity-40"
                >
                  뒤로
                </button>
                <button
                  type="button"
                  onClick={() => void flow.runSave()}
                  disabled={flow.busy === "save" || flow.approvedItems.length === 0}
                  data-testid="inbox-final-save"
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-5 text-[14px] font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {flow.busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {flow.busy === "save" ? "저장하는 중…" : "저장"}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {!flow.hasConversation && !flow.receipt && (
        <p className="px-1 text-xs text-muted-foreground">
          영수증·채팅 캡처·청첩장 사진도 읽어요. 승인하고 최종 저장을 누르기 전에는 아무것도 기록되지 않아요.
        </p>
      )}
    </div>
  );
}

function InlineError({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onClose} aria-label="닫기" className="-my-1 flex h-6 w-6 items-center justify-center">
        <X className="h-3.5 w-3.5" />
      </button>
    </p>
  );
}
