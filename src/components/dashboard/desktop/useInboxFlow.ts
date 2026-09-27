// 붙여넣기로 기록 — 데스크톱 홈 인라인 작성기용 흐름 훅
// SmartInboxSheet 와 같은 규칙: 사용자가 최종 [저장]을 누르기 전에는 어떤 DB 쓰기/사진 업로드도 하지 않는다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFinancial } from "@/store/financialStore";
import { resizeImage } from "@/lib/imageResize";
import {
  extractItems,
  saveItem,
  uploadInboxAttachment,
  canStoreAttachment,
  INBOX_AI_MAX_SIDE,
  INBOX_MAX_IMAGES,
} from "@/services/smartInboxApi";
import type { InboxImage, InboxItem, InboxItemType, MissingQuestion } from "@/services/smartInboxApi";
import type { ReviewStatus, SaveState } from "../inbox/InboxItemCard";
import { applyAnswer, getExpenseCategories, isReady, setField } from "../inbox/inboxAnswers";

export interface InboxAttachment {
  id: string;
  /** 원본 (저장 승인 후 1600px로 줄여 업로드) */
  original: Blob;
  /** 1024px JPEG 미리보기 object URL */
  preview: string;
  ai: InboxImage;
}

/** 대화처럼 보여줄 사용자 입력 한 번 */
export interface InboxTurn {
  id: string;
  kind: "extract" | "refine";
  text: string;
  /** 이 입력에서 새로 붙인 사진 미리보기 */
  previews: string[];
  /** 이 입력 뒤에 AI가 돌려준 항목 수 (진행 중이면 null) */
  resultCount: number | null;
  error?: string;
}

export interface InboxReceipt {
  id: string;
  counts: { type: InboxItemType; n: number }[];
  failed: number;
  firstType: InboxItemType | null;
}

export type InboxStep = "input" | "review" | "confirm";
export type InboxBusy = null | "extract" | "refine" | "attach" | "save";

export const INBOX_TYPE_ORDER: InboxItemType[] = ["expense", "todo", "event", "memo", "wedding"];

export function useInboxFlow() {
  const { state, addExpense } = useFinancial();
  const categories = useMemo(() => getExpenseCategories(state.monthlyBudgets, new Date()), [state.monthlyBudgets]);

  const [step, setStep] = useState<InboxStep>("input");
  const [draft, setDraft] = useState("");
  /** 아직 보내지 않은(작성기에 붙어 있는) 사진 */
  const [pending, setPending] = useState<InboxAttachment[]>([]);
  /** 이미 AI에 보낸 사진 — 항목의 attachmentIndexes 가 가리킨다 */
  const [sent, setSent] = useState<InboxAttachment[]>([]);
  const [turns, setTurns] = useState<InboxTurn[]>([]);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ReviewStatus>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [qaLog, setQaLog] = useState<{ question: string; answer: string }[]>([]);
  const [busy, setBusy] = useState<InboxBusy>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<InboxReceipt | null>(null);
  const uploadedUrls = useRef<Record<string, string>>({});

  // object URL 정리 (언마운트 시)
  const allRef = useRef<InboxAttachment[]>([]);
  allRef.current = [...pending, ...sent];
  useEffect(() => () => allRef.current.forEach((a) => URL.revokeObjectURL(a.preview)), []);

  /** 대화를 비우고 다음 기록 준비 (영수증은 남김) */
  const clearConversation = useCallback(() => {
    allRef.current.forEach((a) => URL.revokeObjectURL(a.preview));
    setStep("input");
    setDraft("");
    setPending([]);
    setSent([]);
    setTurns([]);
    setItems([]);
    setStatuses({});
    setSaveStates({});
    setQaLog([]);
    setError(null);
    uploadedUrls.current = {};
  }, []);

  // ---- 파생 값 ----
  const live = items.filter((it) => saveStates[it.id]?.status !== "saved");
  const approvedItems = live.filter((it) => statuses[it.id] === "approved" && isReady(it));
  const pendingReady = live.filter((it) => statuses[it.id] !== "approved" && statuses[it.id] !== "excluded" && isReady(it));
  const needAnswer = live.filter((it) => statuses[it.id] !== "excluded" && !isReady(it));
  const hasConversation = turns.length > 0 || items.length > 0;

  // ---- 첨부 ----
  const addFiles = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (imgs.length === 0) return;
    const room = INBOX_MAX_IMAGES - allRef.current.length;
    if (room <= 0) {
      setError(`사진은 최대 ${INBOX_MAX_IMAGES}장까지 넣을 수 있어요.`);
      return;
    }
    setBusy("attach");
    setError(null);
    const added: InboxAttachment[] = [];
    try {
      for (const f of imgs.slice(0, room)) {
        const r = await resizeImage(f, INBOX_AI_MAX_SIDE);
        added.push({ id: crypto.randomUUID(), original: f, preview: URL.createObjectURL(r.blob), ai: { base64: r.base64, mime: "image/jpeg" } });
      }
      if (imgs.length > room) setError(`사진은 최대 ${INBOX_MAX_IMAGES}장까지라 ${imgs.length - room}장은 빼었어요.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 불러오지 못했어요.");
    } finally {
      setPending((prev) => [...prev, ...added]);
      setBusy(null);
    }
  };

  const removePending = (id: string) => {
    setPending((prev) => {
      const a = prev.find((x) => x.id === id);
      if (a) URL.revokeObjectURL(a.preview);
      return prev.filter((x) => x.id !== id);
    });
  };

  // ---- 보내기 (처음이면 정리, 검토 중이면 추가로 알려주기 → 다시 정리) ----
  const canSend = busy === null && step !== "confirm" && (draft.trim().length > 0 || pending.length > 0 || (step === "review" && qaLog.length > 0));

  const send = async () => {
    if (!canSend) return;
    const mode: "extract" | "refine" = step === "review" && items.length > 0 ? "refine" : "extract";
    const text = draft.trim();
    const newAtt = pending;
    const allAtt = [...sent, ...newAtt];
    const turnId = crypto.randomUUID();
    setTurns((prev) => [
      ...prev,
      { id: turnId, kind: mode, text: text || (mode === "refine" ? "답변 반영해서 다시 정리해줘" : ""), previews: newAtt.map((a) => a.preview), resultCount: null },
    ]);
    setDraft("");
    setPending([]);
    setSent(allAtt);
    setBusy(mode);
    setError(null);

    // 원문 = 지금까지 보낸 첫 입력들 (다시 정리할 때도 원문을 함께 보낸다)
    const sourceText = mode === "extract" ? [...turns.filter((t) => t.kind === "extract").map((t) => t.text), text].filter(Boolean).join("\n") : turns.filter((t) => t.kind === "extract").map((t) => t.text).join("\n");
    const savedItems = items.filter((it) => saveStates[it.id]?.status === "saved");
    try {
      const result = await extractItems(sourceText, new Date(), {
        images: allAtt.map((a) => a.ai),
        expenseCategories: categories,
        followUp: mode === "refine" ? { previousItems: live, answers: qaLog, note: text } : undefined,
      });
      if (result.length === 0) {
        const msg = mode === "extract" ? "기록할 내용을 찾지 못했어요" : "다시 정리했지만 기록할 내용을 찾지 못했어요. 기존 목록은 그대로 둘게요.";
        setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, resultCount: 0, error: msg } : t)));
        return;
      }
      setItems([...savedItems, ...result]);
      setStatuses((prev) => {
        const next: Record<string, ReviewStatus> = {};
        savedItems.forEach((it) => (next[it.id] = prev[it.id] ?? "approved"));
        result.forEach((it) => (next[it.id] = "pending"));
        return next;
      });
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, resultCount: result.length } : t)));
      setStep("review");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "정리에 실패했어요.";
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, resultCount: 0, error: msg } : t)));
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
  const onField = (id: string, field: string, value: unknown) => updateItem(id, (it) => setField(it, field, value));
  const onAnswer = (id: string, q: MissingQuestion, answer: string, optionIndex?: number): string | null => {
    const it = items.find((x) => x.id === id);
    if (!it) return null;
    const r = applyAnswer(it, q, answer, new Date(), optionIndex);
    if ("error" in r) return r.error;
    updateItem(id, () => r.item);
    setQaLog((prev) => [...prev, { question: q.question, answer: r.answerText }]);
    return null;
  };
  const approveAllReady = () =>
    setStatuses((prev) => {
      const next = { ...prev };
      pendingReady.forEach((it) => (next[it.id] = "approved"));
      return next;
    });

  // ---- 저장 (최종 확인 후) ----
  const runSave = async () => {
    const targets = approvedItems;
    if (targets.length === 0) return;
    setBusy("save");
    const savedList: InboxItem[] = [];
    const nextSave: Record<string, SaveState> = {};
    for (const it of targets) {
      setSaveStates((prev) => ({ ...prev, [it.id]: { status: "saving" } }));
      try {
        const urls: string[] = [];
        if (canStoreAttachment(it.type)) {
          for (const idx of it.attachmentIndexes) {
            const att = sent[idx];
            if (!att) continue;
            if (!uploadedUrls.current[att.id]) uploadedUrls.current[att.id] = await uploadInboxAttachment(att.original);
            urls.push(uploadedUrls.current[att.id]);
          }
        }
        await saveItem(it, { addExpense, attachmentUrls: urls });
        nextSave[it.id] = { status: "saved" };
        savedList.push(it);
      } catch (e) {
        nextSave[it.id] = { status: "error", message: e instanceof Error ? e.message : "저장하지 못했어요." };
      }
      setSaveStates((prev) => ({ ...prev, [it.id]: nextSave[it.id] }));
    }
    setBusy(null);

    const failed = targets.length - savedList.length;
    setReceipt({
      id: crypto.randomUUID(),
      counts: INBOX_TYPE_ORDER.map((type) => ({ type, n: savedList.filter((x) => x.type === type).length })).filter((c) => c.n > 0),
      failed,
      firstType: savedList[0]?.type ?? null,
    });

    // 남은 게 없으면 대화를 비우고 다음 기록 준비, 남았으면(실패/미검토) 검토로 돌아감
    const remaining = items.filter(
      (it) => nextSave[it.id]?.status !== "saved" && saveStates[it.id]?.status !== "saved" && statuses[it.id] !== "excluded",
    );
    if (remaining.length === 0) clearConversation();
    else setStep("review");
  };

  const previewsFor = (it: InboxItem) => it.attachmentIndexes.map((i) => sent[i]?.preview).filter(Boolean) as string[];

  return {
    // state
    step,
    setStep,
    draft,
    setDraft,
    pending,
    turns,
    items,
    statuses,
    saveStates,
    busy,
    error,
    setError,
    receipt,
    dismissReceipt: () => setReceipt(null),
    categories,
    // derived
    live,
    approvedItems,
    pendingReady,
    needAnswer,
    hasConversation,
    canSend,
    // actions
    addFiles,
    removePending,
    send,
    setStatus,
    onField,
    onAnswer,
    approveAllReady,
    runSave,
    clearConversation,
    previewsFor,
    isReady,
  };
}

export type InboxFlow = ReturnType<typeof useInboxFlow>;
