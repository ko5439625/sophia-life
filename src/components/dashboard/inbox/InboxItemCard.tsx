import { useState } from "react";
import { Check, Loader2, AlertCircle, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INBOX_TARGET_LABEL,
  INBOX_TYPE_LABEL,
  REQUIRED_FIELDS,
  WEDDING_CATEGORIES,
  canStoreAttachment,
} from "@/services/smartInboxApi";
import type { InboxItem, MissingQuestion } from "@/services/smartInboxApi";
import { TYPE_STYLE, summarizeItem } from "./inboxUi";

export type SaveState = { status: "saving" } | { status: "saved" } | { status: "error"; message: string };
export type ReviewStatus = "pending" | "approved" | "excluded";

// 16px 이상(iOS 줌 방지), 44px 높이
const inputCls =
  "w-full min-w-0 min-h-[44px] rounded-lg border border-border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/30";
const labelCls = "mb-1 block text-[12px] text-muted-foreground";

interface Props {
  item: InboxItem;
  status: ReviewStatus;
  ready: boolean;
  categories: string[];
  saveState?: SaveState;
  /** 이 항목의 근거 첨부 미리보기 URL */
  attachmentPreviews: string[];
  onStatus: (s: ReviewStatus) => void;
  onField: (field: string, value: unknown) => void;
  /** 성공 시 null, 실패 시 에러 메시지 */
  onAnswer: (q: MissingQuestion, answer: string, optionIndex?: number) => string | null;
}

export default function InboxItemCard({
  item,
  status,
  ready,
  categories,
  saveState,
  attachmentPreviews,
  onStatus,
  onField,
  onAnswer,
}: Props) {
  const saved = saveState?.status === "saved";
  const saving = saveState?.status === "saving";
  const approved = status === "approved";
  const locked = saved || saving;
  const required = REQUIRED_FIELDS[item.type];

  if (status === "excluded") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-3 py-1" data-testid="inbox-item" data-status="excluded">
        <span className="shrink-0 whitespace-nowrap text-[12px] text-muted-foreground">제외됨</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground line-through">{summarizeItem(item)}</span>
        <button
          type="button"
          onClick={() => onStatus("pending")}
          className="flex min-h-[44px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <Undo2 className="h-4 w-4 shrink-0" /> 되돌리기
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-3 transition-colors",
        saved && "opacity-60",
        approved ? "border-emerald-500/60 bg-emerald-500/[0.06]" : !ready ? "border-amber-400/60" : "border-border"
      )}
      data-testid="inbox-item"
      data-type={item.type}
      data-status={status}
    >
      {/* 헤더: 타입 / 대상 탭 / 상태 */}
      <div className="flex min-h-[28px] flex-wrap items-center gap-1.5 px-1">
        <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold", TYPE_STYLE[item.type])}>
          {INBOX_TYPE_LABEL[item.type]}
        </span>
        <span className="min-w-0 truncate text-[12px] text-muted-foreground">→ {INBOX_TARGET_LABEL[item.type]}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {item.confidence < 0.6 && (
            <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">확인 필요</span>
          )}
          <span className="text-[12px] tabular-nums text-muted-foreground/70" title="AI 확신도 (참고용)">
            {Math.round(item.confidence * 100)}%
          </span>
        </span>
      </div>

      {/* 필드 */}
      <fieldset disabled={locked} className="mt-2 space-y-2 px-1">
        <Fields item={item} categories={categories} onField={onField} required={required} />
      </fieldset>

      {/* 되묻기 */}
      {!locked && item.missing.length > 0 && (
        <div className="mt-2 space-y-2 px-1">
          {item.missing.map((q) => (
            <QuestionBubble key={`${q.field}-${q.question}`} q={q} onAnswer={onAnswer} />
          ))}
        </div>
      )}

      {/* 근거: 원문 구절 + 첨부 */}
      {(item.source || attachmentPreviews.length > 0) && (
        <div className="mt-2 flex items-start gap-2 px-1">
          {attachmentPreviews.length > 0 && (
            <div className="flex max-w-[45%] shrink-0 flex-wrap gap-1">
              {attachmentPreviews.map((u, i) => (
                <img key={i} src={u} alt={`첨부 ${i + 1}`} className="h-10 w-10 shrink-0 rounded-md border border-border object-cover" />
              ))}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {item.source && (
              <p className="break-words text-[12px] leading-snug text-muted-foreground/80">“{item.source}”</p>
            )}
            {attachmentPreviews.length > 0 && !canStoreAttachment(item.type) && (
              <p className="text-[12px] text-muted-foreground/70">이 항목은 첨부를 저장할 수 없어요</p>
            )}
          </div>
        </div>
      )}

      {saveState?.status === "error" && (
        <p className="mt-2 flex items-start gap-1 px-1 text-[12px] text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {saveState.message}
        </p>
      )}

      {/* 승인 / 제외 */}
      {saved ? (
        <p className="mt-2 flex min-h-[44px] items-center justify-center gap-1 text-[14px] font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" /> 저장됨
        </p>
      ) : saving ? (
        <p className="mt-2 flex min-h-[44px] items-center justify-center gap-1 text-[14px] text-muted-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> 저장 중
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onStatus("excluded")}
            className="min-h-[44px] min-w-0 whitespace-nowrap rounded-xl border border-border px-2 text-[14px] text-muted-foreground hover:bg-muted"
          >
            제외
          </button>
          {approved ? (
            <button
              type="button"
              onClick={() => onStatus("pending")}
              className="flex min-h-[44px] min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-xl bg-emerald-500/15 px-2 text-[14px] font-semibold text-emerald-700 dark:text-emerald-300"
              aria-label="승인됨, 누르면 승인 취소"
            >
              승인됨 <Check className="h-4 w-4 shrink-0" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStatus("approved")}
              disabled={!ready}
              className="min-h-[44px] min-w-0 break-keep rounded-xl bg-primary px-2 py-1.5 text-[14px] font-semibold leading-tight text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
            >
              {ready ? "승인" : "답변 후 승인"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Fields({
  item,
  categories,
  onField,
  required,
}: {
  item: InboxItem;
  categories: string[];
  onField: (field: string, value: unknown) => void;
  required: string[];
}) {
  const req = (f: string) => (required.includes(f) ? " *" : "");
  switch (item.type) {
    case "expense":
      return (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <span className={labelCls}>금액(원){req("amount")}</span>
              <input
                className={cn(inputCls, "font-mono")}
                inputMode="numeric"
                aria-label="금액"
                placeholder="금액"
                value={item.amount ? item.amount.toLocaleString("ko-KR") : ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/[^\d]/g, ""), 10);
                  onField("amount", Number.isFinite(n) && n > 0 ? n : null);
                }}
              />
            </div>
            <div className="min-w-0">
              <span className={labelCls}>카테고리{req("category")}</span>
              <select
                className={inputCls}
                aria-label="카테고리"
                value={item.category}
                onChange={(e) => onField("category", e.target.value)}
              >
                <option value="">선택</option>
                {(categories.includes(item.category) || !item.category ? categories : [item.category, ...categories]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <span className={labelCls}>날짜</span>
              <input type="date" className={inputCls} aria-label="날짜" value={item.date} onChange={(e) => onField("date", e.target.value)} />
            </div>
            <div className="min-w-0">
              <span className={labelCls}>메모</span>
              <input className={inputCls} aria-label="메모" value={item.memo} onChange={(e) => onField("memo", e.target.value)} />
            </div>
          </div>
        </>
      );
    case "todo":
      return (
        <>
          <div>
            <span className={labelCls}>할 일{req("title")}</span>
            <input className={inputCls} aria-label="할 일" value={item.title} onChange={(e) => onField("title", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>날짜 (비우면 오늘 칸에 들어가요)</span>
            <input type="date" className={inputCls} aria-label="날짜" value={item.date ?? ""} onChange={(e) => onField("date", e.target.value || null)} />
          </div>
        </>
      );
    case "event":
      return (
        <>
          <div>
            <span className={labelCls}>일정{req("title")}</span>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xl" aria-hidden>{item.emoji}</span>
              <input className={inputCls} aria-label="일정 제목" value={item.title} onChange={(e) => onField("title", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <span className={labelCls}>날짜{req("date")}</span>
              <input type="date" className={inputCls} aria-label="날짜" value={item.date ?? ""} onChange={(e) => onField("date", e.target.value || null)} />
            </div>
            <div className="min-w-0">
              <span className={labelCls}>시간</span>
              <input type="time" className={inputCls} aria-label="시간" value={item.time ?? ""} onChange={(e) => onField("time", e.target.value || null)} />
            </div>
          </div>
          {item.endDate && (
            <div>
              <span className={labelCls}>종료일 (날짜마다 일정이 만들어져요)</span>
              <input type="date" className={inputCls} aria-label="종료일" value={item.endDate} onChange={(e) => onField("endDate", e.target.value || null)} />
            </div>
          )}
        </>
      );
    case "memo":
      return (
        <div>
          <span className={labelCls}>메모{req("text")}</span>
          <textarea
            className={cn(inputCls, "min-h-[72px] resize-none py-2 leading-snug")}
            aria-label="메모 내용"
            value={item.text}
            onChange={(e) => onField("text", e.target.value)}
          />
        </div>
      );
    case "wedding":
      return (
        <>
          <div>
            <span className={labelCls}>할 일{req("title")}</span>
            <input className={inputCls} aria-label="웨딩 할 일" value={item.title} onChange={(e) => onField("title", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>분류</span>
            <select
              className={inputCls}
              aria-label="웨딩 분류"
              value={item.category}
              onChange={(e) => {
                onField("category", e.target.value);
                onField("subCategory", WEDDING_CATEGORIES[e.target.value]?.[0] ?? "기타");
              }}
            >
              {Object.keys(WEDDING_CATEGORIES).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </>
      );
  }
}

// ---------------------------------------------------------------------------

function QuestionBubble({
  q,
  onAnswer,
}: {
  q: MissingQuestion;
  onAnswer: (q: MissingQuestion, answer: string, optionIndex?: number) => string | null;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (answer: string, idx?: number) => {
    const err = onAnswer(q, answer, idx);
    setError(err);
    if (!err) setText("");
  };

  return (
    <div className="rounded-2xl rounded-tl-sm bg-muted/70 p-2.5" data-testid="inbox-question">
      <p className="break-words text-[14px] font-medium leading-snug">🤔 {q.question}</p>
      {q.options && q.options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {q.options.map((o, i) => (
            <button
              key={`${o}-${i}`}
              type="button"
              onClick={() => submit(o, i)}
              className="min-h-[44px] max-w-full break-keep rounded-full border border-border bg-background px-3.5 py-2 text-left text-[14px] leading-snug hover:border-primary/50 hover:text-primary"
            >
              {o}
            </button>
          ))}
        </div>
      )}
      <form
        className="mt-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <input
          className={cn(inputCls, "min-w-0 flex-1")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="직접 답하기"
          aria-label={`${q.question} 답변`}
          inputMode={q.field === "amount" ? "numeric" : undefined}
          enterKeyHint="done"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="min-h-[44px] shrink-0 whitespace-nowrap rounded-lg bg-primary px-3.5 text-[14px] font-medium text-primary-foreground disabled:opacity-40"
        >
          답하기
        </button>
      </form>
      {error && <p className="mt-1 text-[12px] text-destructive">{error}</p>}
    </div>
  );
}
