// 스마트 인박스 — 되묻기 답변/직접 수정 값을 항목 필드로 해석하는 순수 함수들
import {
  EXTRA_EXPENSE_CATEGORIES,
  REQUIRED_FIELDS,
  isFieldEmpty,
  seoulDateKey,
} from "@/services/smartInboxApi";
import type { InboxItem, MissingQuestion } from "@/services/smartInboxApi";
import type { MonthlyBudget } from "@/components/dashboard/finance/budgetData";
import { defaultCategories } from "@/components/dashboard/finance/budgetData";

// ---------------------------------------------------------------------------
// 지출 카테고리 (ExpenseAnalysis.tsx 와 같은 규칙)
// ---------------------------------------------------------------------------

/** 이번 달 예산 카테고리 이름 + 기본 추가 카테고리. 예산이 없으면 기본 예산 카테고리 사용 */
export function getExpenseCategories(monthlyBudgets: MonthlyBudget[], today: Date): string[] {
  const month = seoulDateKey(today).slice(0, 7);
  const budget =
    monthlyBudgets.find((b) => b.month === month) ??
    [...monthlyBudgets].sort((a, b) => b.month.localeCompare(a.month))[0];
  const names = (budget?.categories ?? defaultCategories).map((c) => c.name);
  return Array.from(new Set([...names, ...EXTRA_EXPENSE_CATEGORIES.filter((c) => !names.includes(c))]));
}

// ---------------------------------------------------------------------------
// 금액 파싱: "1.8만", "18,500원", "만팔천오백원", "3만5천", "18500"
// ---------------------------------------------------------------------------

const KDIGIT: Record<string, number> = { 영: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
const KSMALL: Record<string, number> = { 십: 10, 백: 100, 천: 1000 };
const KBIG: Record<string, number> = { 만: 1e4, 억: 1e8 };

export function parseKoreanAmount(input: string): number | null {
  const s = input.replace(/[\s,원₩]/g, "").replace(/정도|쯤|약/g, "");
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Math.round(Number(s));
    return n > 0 ? n : null;
  }
  let total = 0;
  let section = 0; // 만/억 이하 누적
  let num: number | null = null; // 직전 숫자
  const re = /(\d+(?:\.\d+)?)|([영일이삼사오육칠팔구])|([십백천])|([만억])|(.)/g;
  let m: RegExpExecArray | null;
  let valid = false;
  while ((m = re.exec(s))) {
    if (m[1]) { num = Number(m[1]); valid = true; }
    else if (m[2]) { num = KDIGIT[m[2]]; valid = true; }
    else if (m[3]) { section += (num ?? 1) * KSMALL[m[3]]; num = null; valid = true; }
    else if (m[4]) {
      const unit = section + (num ?? 0);
      total += (unit || 1) * KBIG[m[4]];
      section = 0; num = null; valid = true;
    } else return null; // 모르는 글자
  }
  if (!valid) return null;
  total += section + (num ?? 0);
  const n = Math.round(total);
  return n > 0 ? n : null;
}

// ---------------------------------------------------------------------------
// 날짜/시간 파싱
// ---------------------------------------------------------------------------

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateToKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(key: string, n: number): string {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dateToKey(d);
}

/**
 * "2026-10-03", "10/3", "10월 3일", "3일", "오늘/내일/모레/어제", "토", "토요일", "다음주 토요일",
 * "이번 주"(이번 주 일요일), "이번 달"/"이번 달 말"(말일) → YYYY-MM-DD. "기한 없음" → "" (비움)
 */
export function parseDateAnswer(input: string, today: Date): string | null {
  const s = input.trim().replace(/\s+/g, " ");
  const todayKey = seoulDateKey(today);
  const [ty, tm] = todayKey.split("-").map(Number);
  if (/기한\s*없|없음|상관\s*없/.test(s)) return "";
  const iso = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (iso) return dateToKey(new Date(+iso[1], +iso[2] - 1, +iso[3]));
  const md = s.match(/(\d{1,2})\s*(?:\/|월)\s*(\d{1,2})/);
  if (md) {
    let key = dateToKey(new Date(ty, +md[1] - 1, +md[2]));
    if (key < addDays(todayKey, -60)) key = dateToKey(new Date(ty + 1, +md[1] - 1, +md[2])); // 연말 → 내년
    return key;
  }
  if (/^오늘/.test(s)) return todayKey;
  if (/^내일/.test(s)) return addDays(todayKey, 1);
  if (/^모레/.test(s)) return addDays(todayKey, 2);
  if (/^어제/.test(s)) return addDays(todayKey, -1);
  if (/이번\s*달|이달/.test(s)) return dateToKey(new Date(ty, tm, 0));
  const dayOnly = s.match(/^(\d{1,2})\s*일$/);
  if (dayOnly) return dateToKey(new Date(ty, tm - 1, +dayOnly[1]));
  const todayDow = keyToDate(todayKey).getDay();
  const mondayOffset = todayDow === 0 ? -6 : 1 - todayDow; // 이번 주 월요일까지
  const wd = s.match(/(?:^|[\s주])([일월화수목금토])(?:요일)?(?:\([^)]*\))?$/);
  if (wd) {
    const target = WEEK.indexOf(wd[1]);
    const idxMonFirst = target === 0 ? 6 : target - 1; // 월=0 … 일=6
    if (/다음\s*주/.test(s)) return addDays(todayKey, mondayOffset + 7 + idxMonFirst);
    if (/이번\s*주/.test(s)) return addDays(todayKey, mondayOffset + idxMonFirst);
    // 요일만: 오늘 이후 가장 가까운 그 요일 (오늘은 제외)
    let diff = (target - todayDow + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(todayKey, diff);
  }
  if (/이번\s*주/.test(s)) return addDays(todayKey, mondayOffset + 6);
  if (/다음\s*주/.test(s)) return addDays(todayKey, mondayOffset + 13);
  return null;
}

/** "15:00", "3시", "오후 3시 반", "오전 11시 20분" → HH:MM. 오전/오후 없이 1~7시는 오후로 본다 */
export function parseTimeAnswer(input: string): string | null {
  const s = input.trim();
  if (/없|미정|모름/.test(s)) return "";
  const hm = s.match(/(\d{1,2}):(\d{2})/);
  let h: number, min: number;
  if (hm) { h = +hm[1]; min = +hm[2]; }
  else {
    const k = s.match(/(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분|(반))?/);
    if (!k) return null;
    h = +k[1];
    min = k[2] ? +k[2] : k[3] ? 30 : 0;
    if (/오후|저녁|밤/.test(s) && h < 12) h += 12;
    else if (!/오전|아침|새벽/.test(s) && h >= 1 && h <= 7) h += 12;
  }
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// 필드 갱신 / 답변 적용
// ---------------------------------------------------------------------------

/** 필드를 직접 수정 → 해당 필드 질문은 사라진다 */
export function setField(item: InboxItem, field: string, value: unknown): InboxItem {
  const next = { ...item, [field]: value } as InboxItem;
  return { ...next, missing: next.missing.filter((q) => q.field !== field) };
}

export type AnswerResult = { ok: true; item: InboxItem; answerText: string } | { ok: false; error: string };

/** 질문에 대한 답(칩 또는 자유 입력)을 해석해 필드를 채운다 */
export function applyAnswer(item: InboxItem, q: MissingQuestion, answer: string, today: Date, optionIndex?: number): AnswerResult {
  const raw = answer.trim();
  if (!raw) return { ok: false, error: "답을 입력해주세요." };
  const valueFromOption =
    optionIndex !== undefined && q.values && q.values[optionIndex] ? q.values[optionIndex] : raw;

  const done = (value: unknown): AnswerResult => ({ ok: true, item: setField(item, q.field, value), answerText: raw });

  switch (q.field) {
    case "amount":
    case "budget": {
      const n = parseKoreanAmount(valueFromOption);
      return n ? done(n) : { ok: false, error: "금액을 숫자로 알려주세요. 예) 18500, 1.8만" };
    }
    case "date":
    case "endDate": {
      const d = parseDateAnswer(valueFromOption, today);
      if (d === null) return { ok: false, error: "날짜를 알아듣지 못했어요. 예) 10/3, 토요일, 내일" };
      if (d === "" && REQUIRED_FIELDS[item.type].includes(q.field)) return { ok: false, error: "날짜가 꼭 필요해요." };
      return done(d || null);
    }
    case "time": {
      const t = parseTimeAnswer(valueFromOption);
      if (t === null) return { ok: false, error: "시간을 알아듣지 못했어요. 예) 15:00, 오후 3시" };
      return done(t || null);
    }
    default:
      return done(valueFromOption);
  }
}

/** 저장을 막는 (필수 필드가 빈) 질문이 남았는지 */
export function isReady(item: InboxItem): boolean {
  return REQUIRED_FIELDS[item.type].every((f) => !isFieldEmpty(item, f));
}
