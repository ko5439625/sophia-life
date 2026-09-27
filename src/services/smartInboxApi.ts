// 붙여넣기로 기록 (스마트 인박스)
// 채팅/메모 텍스트 → Gemini가 지출·할 일·일정·메모·웨딩 체크리스트 항목으로 추출 → 사용자가 확인 후 저장.
// 저장은 각 탭이 수동 입력 때 쓰는 함수를 그대로 호출한다 (지출만 React context의 addExpense를 주입받음).

import { GEMINI_ENDPOINT, getApiKey, describeGeminiError } from "./openaiApi";
import { saveTodo, saveEvent, saveWeddingItem } from "./supabaseSync";
import type { WeddingItemRow } from "./supabaseSync";
import { isSupabaseConfigured } from "@/lib/supabase";
import { loadMemos, saveMemos, addMemoToDB } from "@/lib/memoStore";
import type { CoupleMemo } from "@/lib/memoStore";
import { getChatSender } from "./chatService";
import type { Expense } from "@/store/financialStore";
import { resizeImage } from "@/lib/imageResize";
import { uploadBlobToBlogStorage, BLOG_UPLOAD_MAX_SIDE } from "@/components/dashboard/blog/blogImageUpload";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InboxItemType = "expense" | "todo" | "event" | "memo" | "wedding";

/** AI가 되묻는 질문. 답하면 field가 채워지고 질문은 사라진다. */
export interface MissingQuestion {
  field: string;
  question: string;
  /** 칩으로 보여줄 선택지 (표시용) */
  options?: string[];
  /** options와 같은 순서의 실제 값 (예: 날짜 선택지 → YYYY-MM-DD). 없으면 options 텍스트를 해석 */
  values?: string[];
}

interface InboxItemBase {
  id: string;
  /** 원문에서 이 항목의 근거가 된 짧은 구절 */
  source: string;
  /** 0~1 */
  confidence: number;
  missing: MissingQuestion[];
  /** 근거가 된 첨부 이미지 (0부터 시작하는 인덱스) */
  attachmentIndexes: number[];
}

export interface ExpenseInboxItem extends InboxItemBase {
  type: "expense";
  /** 원(KRW). 모르면 null → missing 질문 */
  amount: number | null;
  /** 앱 지출 카테고리 중 하나. 모르면 "" → missing 질문 */
  category: string;
  /** YYYY-MM-DD (언급 없으면 오늘) */
  date: string;
  memo: string;
}

export interface TodoInboxItem extends InboxItemBase {
  type: "todo";
  title: string;
  /** YYYY-MM-DD 또는 null(기한 없음 → 저장 시 오늘 칸에 들어감) */
  date: string | null;
  memo: string;
}

export interface EventInboxItem extends InboxItemBase {
  type: "event";
  title: string;
  /** YYYY-MM-DD. 모르면 null → missing 질문 */
  date: string | null;
  /** HH:MM */
  time: string | null;
  /** 여러 날 일정의 마지막 날 YYYY-MM-DD */
  endDate: string | null;
  emoji: string;
}

export interface MemoInboxItem extends InboxItemBase {
  type: "memo";
  text: string;
}

export interface WeddingInboxItem extends InboxItemBase {
  type: "wedding";
  title: string;
  /** 웨딩 체크리스트 대분류 (WEDDING_CATEGORIES 키) */
  category: string;
  /** 소분류 (없으면 대분류의 첫 소분류) */
  subCategory: string;
  /** 예산(원), 모르면 0 */
  budget: number;
  memo: string;
}

export type InboxItem =
  | ExpenseInboxItem
  | TodoInboxItem
  | EventInboxItem
  | MemoInboxItem
  | WeddingInboxItem;

export interface InboxFollowUp {
  /** 직전 추출 결과 (사용자가 고친 값 포함) */
  previousItems: InboxItem[];
  /** 지금까지 주고받은 질문/답 */
  answers: { question: string; answer: string }[];
  /** "추가로 알려주기" 자유 입력 */
  note?: string;
}

/** Gemini에 보낼 첨부 이미지 (긴 변 1024px로 줄인 JPEG) */
export interface InboxImage {
  /** data: 접두어 없는 base64 */
  base64: string;
  mime: "image/jpeg";
}

export const INBOX_MAX_IMAGES = 6;
/** Gemini inline_data 용 긴 변 */
export const INBOX_AI_MAX_SIDE = 1024;

export interface ExtractOptions {
  /** 함께 보낼 이미지 (영수증, 채팅 캡처, 청첩장/티켓 등) */
  images?: InboxImage[];
  /** 앱의 실제 지출 카테고리 목록 (ExpenseAnalysis와 동일한 규칙으로 만든 것) */
  expenseCategories?: string[];
  followUp?: InboxFollowUp;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** ExpenseAnalysis.tsx 에서 예산 카테고리 뒤에 붙이는 기본 지출 카테고리 */
export const EXTRA_EXPENSE_CATEGORIES = ["교통", "카페", "문화", "경조사", "의료", "보험"];

/** WeddingView.tsx DEFAULT_CATEGORIES 와 동일 (export 되어있지 않아 복제) */
export const WEDDING_CATEGORIES: Record<string, string[]> = {
  "웨딩홀": ["장소", "식대", "대관", "기타"],
  "스드메": ["스튜디오", "드레스", "메이크업", "기타"],
  "예물/예단": ["반지", "시계", "목걸이", "예단", "기타"],
  "혼수": ["가전", "가구", "침구", "생활용품", "기타"],
  "혼주": ["한복/양복", "메이크업", "상견례", "함/폐백", "이바지", "기타"],
  "예약": ["사회자", "축가", "영상촬영", "스냅촬영", "웨딩카", "기타"],
  "허니문": ["항공", "숙소", "보험", "기타"],
  "청첩장/답례품": ["청첩장", "답례품", "부케", "기타"],
  "기타": ["기타"],
};

/** 저장 후 "보러 가기" 대상 (DashboardLayout handleTabChange 의 "tab:subtab" 형식) */
export const INBOX_TARGET_TAB: Record<InboxItemType, string> = {
  expense: "finance:analysis",
  todo: "schedule:checklist",
  event: "schedule:calendar",
  memo: "couple:memo",
  wedding: "wedding:checklist",
};

export const INBOX_TYPE_LABEL: Record<InboxItemType, string> = {
  expense: "지출",
  todo: "할 일",
  event: "일정",
  memo: "메모",
  wedding: "웨딩",
};

export const INBOX_TARGET_LABEL: Record<InboxItemType, string> = {
  expense: "돈 › 지출 관리",
  todo: "일정 › 할 일",
  event: "일정 › 캘린더",
  memo: "기록 › 속닥속닥",
  wedding: "웨딩 › 체크리스트",
};

/** 각 타입에서 비어 있으면 저장할 수 없는 필드 */
export const REQUIRED_FIELDS: Record<InboxItemType, string[]> = {
  expense: ["amount", "category"],
  todo: ["title"],
  event: ["title", "date"],
  memo: ["text"],
  wedding: ["title"],
};

const DEFAULT_EVENT_EMOJI = "\u{1F4DD}"; // CalendarTab 기본값 📝
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// ---------------------------------------------------------------------------
// Date helpers (Asia/Seoul)
// ---------------------------------------------------------------------------

/** Date → 서울 기준 YYYY-MM-DD */
export function seoulDateKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts; // en-CA → YYYY-MM-DD
}

/** YYYY-MM-DD 의 요일 (한 글자) */
export function weekdayOf(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

const isDateKey = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildPrompt(text: string, today: Date, opts: ExtractOptions): string {
  const todayKey = seoulDateKey(today);
  const cats = opts.expenseCategories?.length ? opts.expenseCategories : ["식비", "고정지출", "용돈", "기타", ...EXTRA_EXPENSE_CATEGORIES];
  const weddingCats = Object.keys(WEDDING_CATEGORIES).join(", ");

  let prompt = `당신은 커플 생활관리 앱의 "붙여넣기로 기록" 비서입니다.
사용자가 붙여넣은 채팅/메모에서 앱에 기록할 만한 항목만 뽑아 JSON으로 돌려주세요.

# 기준 날짜
오늘은 ${todayKey} (${weekdayOf(todayKey)}요일), 시간대는 Asia/Seoul 입니다.
"어제", "모레", "다음주 토요일", "이번 주 금요일", "이번 달 말" 같은 상대 날짜는 반드시 이 날짜 기준으로 계산해 YYYY-MM-DD로 적으세요.
("다음주 X요일" = 오늘이 속한 주(월~일)의 다음 주 X요일, "이번 달 말" = 이번 달 마지막 날)

# 항목 타입 (type)
- expense: 이미 쓴 돈(지출). amount(원 단위 정수), category, date(언급 없으면 오늘), memo(무엇에 썼는지 짧게, 장소 포함)
  category는 반드시 다음 중 하나: ${cats.join(", ")}
- todo: 해야 할 일(시간 약속이 아닌 작업). title, date(마감/하는 날, 언급 없으면 null), memo
- event: 날짜가 정해진 약속/일정. title, date, time(HH:MM 24시간, 언급 없으면 null), endDate(여러 날이면 마지막 날, 아니면 null), emoji(어울리는 이모지 1개)
- memo: 기억해둘 정보/추천/메모. text (원문 정보를 빠짐없이, 짧게 정리)
- wedding: 결혼 준비 체크리스트 작업(업체 알아보기, 예약하기 등 날짜 없는 웨딩 준비 할 일). title, weddingCategory(다음 중 하나: ${weddingCats}), budget(언급된 예산 원, 없으면 null), memo
  웨딩 관련이라도 날짜가 정해진 약속(피팅, 촬영 등)은 event로, 이미 쓴 돈은 expense로 분류하세요.

# 규칙
1. 인사, 잡담, 리액션(ㅋㅋ, ㅎㅎ, ㅇㅇ, 이모티콘)은 무시하세요.
2. 채팅 앱의 "[이름] [오후 3:12]" 같은 보낸 사람/시간 접두어, 날짜 구분선은 내용이 아니므로 무시하세요. 이 시간을 일정 시간으로 쓰지 마세요.
3. 금액 표기("1.8만", "18,500원", "만팔천오백원", "3만5천")는 원 단위 숫자로 바꾸세요 (예: 1.8만 → 18000).
4. 실행 가능한 사실 하나당 항목 하나. 같은 내용이 여러 번 나오면 하나로 합치세요.
5. 없는 정보를 지어내지 마세요. 모르는 값은 null(숫자/날짜/시간) 또는 ""(문자)로 두세요.
6. 필수 정보가 없거나 애매하면 추측하지 말고 missing에 짧은 존댓말 질문을 넣어라. 선택지로 답할 수 있으면 options를 넣어라.
   - 필수 정보: expense.amount, expense.category, event.date, event.title, todo.title, memo.text, wedding.title
   - 예) 금액 없는 지출 → {"field":"amount","question":"파스타 얼마 썼어요?"}
   - 예) "다음주에 피팅"처럼 요일이 없으면 → {"field":"date","question":"피팅 무슨 요일이에요?","options":["10/5(월)","10/6(화)",...],"values":["2026-10-05","2026-10-06",...]}
   - 날짜 질문의 options는 "M/D(요일)" 형태로, values에는 같은 순서로 YYYY-MM-DD를 넣으세요.
   - 카테고리가 애매하면 category를 ""로 두고 options에 위 카테고리 목록 중 후보 2~5개를 넣으세요.
   - 선택 정보(할 일 기한, 일정 시간 등)는 꼭 필요할 때만 물어보세요. 예) "이체해야 돼" → {"field":"date","question":"언제까지 해야 해요?","options":["오늘","이번 주","이번 달","기한 없음"]}
   - 항목당 질문은 최대 2개. field는 해당 타입의 필드 이름(amount, category, date, time, title, text 등)으로 쓰세요.
7. source에는 이 항목의 근거가 된 원문 구절을 짧게(40자 이내) 그대로 옮기세요.
8. confidence는 0~1. 이 항목을 이 타입으로 기록하는 게 맞다고 확신하는 정도입니다.
9. 기록할 것이 없으면 items를 빈 배열로 주세요.

# 첨부 이미지
${opts.images?.length ? `이미지 ${opts.images.length}장이 "첨부 1", "첨부 2" … 순서로 함께 옵니다.
- 영수증/결제 문자 → expense (합계 금액, 가게 이름은 memo, 결제일은 date). 품목이 여러 개여도 영수증 한 장 = 지출 하나.
- 청첩장/티켓/예약 확인 → event (날짜, 시간, 장소는 title에 짧게)
- 채팅 캡처 → 텍스트와 똑같은 규칙으로 모든 타입 가능
- 이미지에서 나온 항목은 attachmentIndexes에 근거 이미지 번호(1부터)를 넣고, source에는 이미지에서 읽은 핵심 문구를 적으세요. 이미지와 무관한 항목은 빈 배열.
- 이미지를 읽을 수 없으면 추측하지 말고 무시하세요.` : "없음 (attachmentIndexes는 빈 배열)"}

# 붙여넣은 원문
"""
${text || "(텍스트 없음 — 이미지만 보고 정리하세요)"}
"""`;

  const fu = opts.followUp;
  if (fu) {
    prompt += `

# 이전 정리 결과 (사용자가 일부 고쳤을 수 있음 — 사용자가 고친 값은 유지하세요)
${JSON.stringify(fu.previousItems.map(toPromptItem))}
`;
    if (fu.answers.length) {
      prompt += `
# 질문에 대한 사용자 답변
${fu.answers.map((a) => `- Q: ${a.question}\n  A: ${a.answer}`).join("\n")}
`;
    }
    if (fu.note?.trim()) {
      prompt += `
# 사용자가 추가로 알려준 내용
"""
${fu.note.trim()}
"""
`;
    }
    prompt += `
위 답변과 추가 내용을 반영해 전체 항목 목록을 다시 만들어 주세요. 답이 된 질문은 missing에서 빼고, 여전히 모르는 것만 남기세요.`;
  }
  return prompt;
}

function toPromptItem(it: InboxItem) {
  const { id: _id, confidence: _c, attachmentIndexes, ...rest } = it;
  return { ...rest, attachmentIndexes: attachmentIndexes.map((i) => i + 1) };
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

const QUESTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    field: { type: "STRING" },
    question: { type: "STRING" },
    options: { type: "ARRAY", items: { type: "STRING" } },
    values: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["field", "question"],
  propertyOrdering: ["field", "question", "options", "values"],
};

const ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    type: { type: "STRING", enum: ["expense", "todo", "event", "memo", "wedding"] },
    title: { type: "STRING", nullable: true },
    text: { type: "STRING", nullable: true },
    amount: { type: "NUMBER", nullable: true },
    category: { type: "STRING", nullable: true },
    date: { type: "STRING", nullable: true },
    time: { type: "STRING", nullable: true },
    endDate: { type: "STRING", nullable: true },
    emoji: { type: "STRING", nullable: true },
    weddingCategory: { type: "STRING", nullable: true },
    budget: { type: "NUMBER", nullable: true },
    memo: { type: "STRING", nullable: true },
    source: { type: "STRING" },
    confidence: { type: "NUMBER" },
    missing: { type: "ARRAY", items: QUESTION_SCHEMA },
    attachmentIndexes: { type: "ARRAY", items: { type: "INTEGER" } },
  },
  required: ["type", "source", "confidence", "missing", "attachmentIndexes"],
  propertyOrdering: [
    "type", "title", "text", "amount", "category", "date", "time", "endDate",
    "emoji", "weddingCategory", "budget", "memo", "source", "confidence", "missing", "attachmentIndexes",
  ],
};

const RESULT_SCHEMA = {
  type: "OBJECT",
  properties: { items: { type: "ARRAY", items: ITEM_SCHEMA } },
  required: ["items"],
};

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function callGemini(prompt: string, images: InboxImage[] = []): Promise<unknown> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("설정 > API 키에서 Gemini API 키를 먼저 입력해주세요.");

  let res: Response;
  try {
    res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: buildParts(prompt, images) }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: RESULT_SCHEMA,
        },
      }),
    });
  } catch {
    throw new Error("네트워크 연결을 확인해주세요. AI 서버에 연결하지 못했어요.");
  }

  if (!res.ok) {
    const err = await res.text();
    console.warn("[smartInbox] Gemini error:", res.status, err.substring(0, 500));
    throw new Error(describeGeminiError(res.status, err));
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    if (data.promptFeedback?.blockReason) throw new Error("AI가 이 내용은 정리할 수 없다고 했어요.");
    throw new Error("AI가 빈 응답을 보냈어요. 잠시 후 다시 시도해주세요.");
  }
  if (candidate.finishReason === "SAFETY") {
    throw new Error("AI 안전 정책에 걸려 정리하지 못했어요. 내용을 조금 바꿔 다시 시도해주세요.");
  }
  const partsOut: { text?: string; thought?: boolean }[] = candidate.content?.parts ?? [];
  const text = partsOut
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .trim();
  if (!text) {
    throw new Error(
      candidate.finishReason === "MAX_TOKENS"
        ? "내용이 너무 길어 중간에 끊겼어요. 나눠서 붙여넣어 주세요."
        : "AI가 빈 응답을 보냈어요. 잠시 후 다시 시도해주세요."
    );
  }
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    console.warn("[smartInbox] JSON parse failed:", text.substring(0, 500));
    throw new Error("AI 응답을 해석하지 못했어요. 다시 시도해주세요.");
  }
}

function buildParts(prompt: string, images: InboxImage[]): Part[] {
  const parts: Part[] = [{ text: prompt }];
  images.forEach((img, i) => {
    parts.push({ text: `첨부 ${i + 1}` });
    parts.push({ inline_data: { mime_type: img.mime, data: img.base64 } });
  });
  return parts;
}

// ---------------------------------------------------------------------------
// Normalization (AI 응답을 믿지 않고 한 번 더 검증)
// ---------------------------------------------------------------------------

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const clamp01 = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
};
const posInt = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

function normQuestions(raw: unknown): MissingQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: MissingQuestion[] = [];
  for (const q of raw) {
    const field = str(q?.field);
    const question = str(q?.question);
    if (!field || !question) continue;
    const options = Array.isArray(q?.options) ? q.options.map(str).filter(Boolean).slice(0, 8) : [];
    const values = Array.isArray(q?.values) ? q.values.map(str) : [];
    out.push({
      field,
      question,
      ...(options.length ? { options } : {}),
      ...(options.length && values.length === options.length ? { values } : {}),
    });
    if (out.length >= 2) break;
  }
  return out;
}

/** 필수 필드가 비었는데 질문이 없으면 기본 질문을 만든다 */
export function isFieldEmpty(item: InboxItem, field: string): boolean {
  const v = (item as unknown as Record<string, unknown>)[field];
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "number") return !(v > 0);
  return false;
}

function defaultQuestion(item: InboxItem, field: string, cats: string[]): MissingQuestion {
  const what = item.source ? `"${item.source.slice(0, 16)}"` : "이 항목";
  switch (field) {
    case "amount": return { field, question: `${what} 얼마였어요?` };
    case "category": return { field, question: "어떤 항목으로 기록할까요?", options: cats.slice(0, 6) };
    case "date": return { field, question: "날짜가 언제예요?" };
    case "title": return { field, question: "제목을 뭐라고 할까요?" };
    case "text": return { field, question: "어떤 내용을 메모할까요?" };
    default: return { field, question: "정보를 알려주세요." };
  }
}

export function ensureRequiredQuestions(item: InboxItem, cats: string[]): InboxItem {
  const missing = [...item.missing];
  for (const f of REQUIRED_FIELDS[item.type]) {
    if (isFieldEmpty(item, f) && !missing.some((q) => q.field === f)) {
      missing.push(defaultQuestion(item, f, cats));
    }
  }
  return { ...item, missing };
}

const newId = () => crypto.randomUUID();

function normalizeItem(raw: Record<string, unknown>, todayKey: string, cats: string[], imageCount: number): InboxItem | null {
  const attachmentIndexes = Array.isArray(raw.attachmentIndexes)
    ? Array.from(new Set(raw.attachmentIndexes.map((n) => Number(n) - 1))).filter(
        (n) => Number.isInteger(n) && n >= 0 && n < imageCount
      )
    : [];
  const base = {
    attachmentIndexes,
    id: newId(),
    source: str(raw.source).slice(0, 80),
    confidence: clamp01(raw.confidence),
    missing: normQuestions(raw.missing),
  };
  const date = isDateKey(raw.date) ? (raw.date as string) : null;
  let item: InboxItem;
  switch (raw.type) {
    case "expense": {
      const category = str(raw.category);
      item = {
        ...base,
        type: "expense",
        amount: posInt(raw.amount),
        category: cats.includes(category) ? category : "",
        date: date ?? todayKey,
        memo: str(raw.memo) || str(raw.title),
      };
      // 카테고리 질문 선택지는 실제 카테고리만 남긴다
      item.missing = item.missing.map((q) => {
        if (q.field !== "category") return q;
        const valid = (q.options ?? []).filter((o) => cats.includes(o));
        return { field: q.field, question: q.question, options: valid.length ? valid : cats.slice(0, 6) };
      });
      break;
    }
    case "todo":
      item = { ...base, type: "todo", title: str(raw.title) || str(raw.text), date, memo: str(raw.memo) };
      break;
    case "event": {
      const endDate = isDateKey(raw.endDate) && date && (raw.endDate as string) > date ? (raw.endDate as string) : null;
      item = {
        ...base,
        type: "event",
        title: str(raw.title) || str(raw.text),
        date,
        time: isTime(raw.time) ? (raw.time as string) : null,
        endDate,
        emoji: str(raw.emoji) || DEFAULT_EVENT_EMOJI,
      };
      break;
    }
    case "memo":
      item = { ...base, type: "memo", text: str(raw.text) || str(raw.title) || str(raw.memo) };
      break;
    case "wedding": {
      const wc = str(raw.weddingCategory) || str(raw.category);
      const category = WEDDING_CATEGORIES[wc] ? wc : "기타";
      item = {
        ...base,
        type: "wedding",
        title: str(raw.title) || str(raw.text),
        category,
        subCategory: WEDDING_CATEGORIES[category][0],
        budget: posInt(raw.budget) ?? 0,
        memo: str(raw.memo),
      };
      break;
    }
    default:
      return null;
  }
  // 이미 값이 있는 필드에 대한 질문 중 필수 필드 질문은 제거 (AI가 값도 채우고 질문도 한 경우 → 값 우선)
  item.missing = item.missing.filter((q) => !(REQUIRED_FIELDS[item.type].includes(q.field) && !isFieldEmpty(item, q.field)));
  return ensureRequiredQuestions(item, cats);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 붙여넣은 텍스트에서 기록 항목을 추출한다.
 * followUp 을 주면 이전 결과 + 질문 답변 + 추가 설명을 함께 보내 전체 목록을 다시 받는다.
 */
export async function extractItems(text: string, today: Date, opts: ExtractOptions = {}): Promise<InboxItem[]> {
  const trimmed = text.trim();
  const images = (opts.images ?? []).slice(0, INBOX_MAX_IMAGES);
  if (!trimmed && images.length === 0) throw new Error("정리할 내용이나 사진을 먼저 넣어주세요.");
  if (trimmed.length > 12000) throw new Error("내용이 너무 길어요. 12,000자 이하로 나눠서 붙여넣어 주세요.");

  const cats = opts.expenseCategories?.length ? opts.expenseCategories : ["식비", "고정지출", "용돈", "기타", ...EXTRA_EXPENSE_CATEGORIES];
  const raw = (await callGemini(buildPrompt(trimmed, today, { ...opts, images, expenseCategories: cats }), images)) as { items?: unknown };
  const list = Array.isArray(raw?.items) ? raw.items : [];
  const todayKey = seoulDateKey(today);
  return list
    .map((r) => (r && typeof r === "object" ? normalizeItem(r as Record<string, unknown>, todayKey, cats, images.length) : null))
    .filter((x): x is InboxItem => !!x);
}

// ---------------------------------------------------------------------------
// Attachments (저장 승인 후에만 업로드)
// ---------------------------------------------------------------------------

/**
 * 첨부 링크를 붙일 수 있는 타입 → 링크가 들어갈 텍스트 필드.
 * 앱의 지출/할 일/메모/웨딩 체크리스트 모델에는 전용 이미지 필드가 없어서 메모 텍스트에 링크를 붙인다.
 * 캘린더 일정(events)은 텍스트 필드가 제목뿐이라 첨부를 저장하지 않는다.
 */
export const ATTACHMENT_TARGET_FIELD: Partial<Record<InboxItemType, string>> = {
  expense: "memo",
  todo: "memo",
  memo: "text",
  wedding: "memo",
};

export function canStoreAttachment(type: InboxItemType): boolean {
  return !!ATTACHMENT_TARGET_FIELD[type];
}

/**
 * 원본 이미지를 긴 변 1600px로 줄여 Storage에 올리고 URL 반환.
 * 블로그 사진 업로드와 같은 경로(blog-images 버킷, public URL)를 재사용한다.
 */
export async function uploadInboxAttachment(file: Blob): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error("저장소가 연결되지 않아 사진을 올릴 수 없어요.");
  const { blob } = await resizeImage(file, BLOG_UPLOAD_MAX_SIDE);
  const url = await uploadBlobToBlogStorage(blob, "jpg");
  if (!url) throw new Error("사진 업로드에 실패했어요.");
  return url;
}

function withAttachmentLinks(item: InboxItem, urls: string[]): InboxItem {
  const field = ATTACHMENT_TARGET_FIELD[item.type];
  if (!field || urls.length === 0) return item;
  const rec = item as unknown as Record<string, unknown>;
  const cur = typeof rec[field] === "string" ? (rec[field] as string).trim() : "";
  const links = urls.map((u, i) => `📎 첨부${urls.length > 1 ? i + 1 : ""}: ${u}`).join("\n");
  return { ...item, [field]: cur ? `${cur}\n${links}` : links } as InboxItem;
}

export interface SaveDeps {
  /** 이미 업로드한 첨부 URL — 지원하는 타입이면 메모 텍스트에 링크로 붙인다 */
  attachmentUrls?: string[];
  /** useFinancial().addExpense — 지출은 FinancialProvider 상태에 들어가야 지출 관리 화면에 바로 보인다 */
  addExpense?: (e: Expense) => void;
  /** 저장 기준 오늘 (테스트용) */
  today?: Date;
}

/**
 * 한 항목 저장. 각 탭의 수동 입력과 같은 함수/데이터 모양을 쓴다.
 * - expense → deps.addExpense (FinancialProvider → localStorage + supabase finances)
 * - todo    → saveTodo (ChecklistTab 과 동일, 기한 없으면 오늘 칸)
 * - event   → saveEvent (CalendarTab 과 동일, 여러 날이면 날짜별로 "(1/n)" 붙여 여러 개)
 * - memo    → addMemoToDB + localStorage (CoupleView 속닥속닥과 동일)
 * - wedding → saveWeddingItem + localStorage 원장 (WeddingChecklist 와 동일)
 */
export async function saveItem(input: InboxItem, deps: SaveDeps = {}): Promise<void> {
  const item = withAttachmentLinks(input, deps.attachmentUrls ?? []);
  const missingReq = REQUIRED_FIELDS[item.type].filter((f) => isFieldEmpty(item, f));
  if (missingReq.length) throw new Error("필수 정보가 비어 있어요.");
  const todayKey = seoulDateKey(deps.today ?? new Date());

  switch (item.type) {
    case "expense": {
      if (!deps.addExpense) throw new Error("지출 저장 기능을 찾지 못했어요.");
      deps.addExpense({
        id: crypto.randomUUID(),
        type: "expense",
        amount: item.amount as number,
        category: item.category,
        date: item.date || todayKey,
        memo: item.memo,
        deductFrom: "none", // 생활비 예산 사용률에 반영 (홈 ＋ 지출과 동일)
      });
      return;
    }
    case "todo": {
      if (!isSupabaseConfigured()) throw new Error("저장소가 연결되지 않아 할 일을 저장할 수 없어요.");
      await saveTodo({
        id: crypto.randomUUID(),
        title: item.title.trim(),
        memo: item.memo,
        is_done: false,
        date: item.date || todayKey,
      });
      return;
    }
    case "event": {
      if (!isSupabaseConfigured()) throw new Error("저장소가 연결되지 않아 일정을 저장할 수 없어요.");
      const start = item.date as string;
      const dates: string[] = [];
      if (item.endDate && item.endDate > start) {
        const s = new Date(start + "T00:00:00");
        const e = new Date(item.endDate + "T00:00:00");
        for (let d = new Date(s); d <= e && dates.length < 62; d.setDate(d.getDate() + 1)) {
          dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
        }
      } else {
        dates.push(start);
      }
      for (let i = 0; i < dates.length; i++) {
        const suffix = dates.length > 1 ? ` (${i + 1}/${dates.length})` : "";
        await saveEvent({
          id: crypto.randomUUID(),
          title: item.title.trim() + suffix,
          date: dates[i],
          time: item.time || null,
          emoji: item.emoji || DEFAULT_EVENT_EMOJI,
          is_shared: false,
        });
      }
      return;
    }
    case "memo": {
      const sender = getChatSender();
      const memo: CoupleMemo = {
        id: crypto.randomUUID(),
        author: sender === "muyo" ? "partner" : "sophia", // 무요=partner, 데굴=sophia (CoupleView 라벨)
        message: item.text.trim(),
        timestamp: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        pinned: false,
      };
      saveMemos([memo, ...loadMemos()]);
      await addMemoToDB(memo);
      return;
    }
    case "wedding": {
      const LEDGER = "sophia-wedding-ledger";
      let ledger: WeddingItemRow[] = [];
      try {
        const s = localStorage.getItem(LEDGER);
        if (s) ledger = JSON.parse(s);
      } catch { /* ignore */ }
      const row: WeddingItemRow = {
        id: crypto.randomUUID(),
        category: item.category,
        sub_category: item.subCategory || WEDDING_CATEGORIES[item.category]?.[0] || "기타",
        title: item.title.trim(),
        is_done: false,
        memo: item.memo,
        budget: item.budget || 0,
        sort_order: ledger.filter((r) => r.category === item.category).length,
      };
      if (!isSupabaseConfigured()) {
        localStorage.setItem(LEDGER, JSON.stringify([...ledger, row]));
        return;
      }
      await saveWeddingItem(row);
      return;
    }
  }
}
