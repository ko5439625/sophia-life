// 스마트 인박스 단위 테스트 — Gemini fetch는 목, Supabase 쓰기 함수는 전부 목 (실제 쓰기 없음)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {}, isSupabaseConfigured: () => true }));
vi.mock("@/services/supabaseSync", () => ({
  saveTodo: vi.fn(async () => {}),
  saveEvent: vi.fn(async () => {}),
  saveWeddingItem: vi.fn(async () => {}),
  saveMemoToDB: vi.fn(async () => {}),
  loadMemosFromDB: vi.fn(async () => []),
  deleteMemoFromDB: vi.fn(async () => {}),
}));
vi.mock("@/components/dashboard/blog/blogImageUpload", () => ({
  BLOG_UPLOAD_MAX_SIDE: 1600,
  uploadBlobToBlogStorage: vi.fn(async () => "https://example.test/x.jpg"),
}));

import * as sync from "@/services/supabaseSync";
import { extractItems, saveItem } from "@/services/smartInboxApi";
import type { InboxItem } from "@/services/smartInboxApi";
import { applyAnswer, isReady, parseDateAnswer, parseKoreanAmount, parseTimeAnswer } from "./inboxAnswers";

// 2026-09-27 (일) 12:00 KST
const TODAY = new Date("2026-09-27T03:00:00Z");

describe("parseKoreanAmount", () => {
  it.each([
    ["18,500원", 18500],
    ["1.8만", 18000],
    ["만팔천오백원", 18500],
    ["3만5천", 35000],
    ["12000", 12000],
    ["2억", 200000000],
    ["삼천원", 3000],
  ])("%s → %d", (input, expected) => {
    expect(parseKoreanAmount(input)).toBe(expected);
  });
  it("모르는 입력은 null", () => {
    expect(parseKoreanAmount("몰라")).toBeNull();
  });
});

describe("parseDateAnswer (오늘=2026-09-27 일요일)", () => {
  it.each([
    ["다음주 토요일", "2026-10-03"],
    ["토", "2026-10-03"],
    ["10/5(월)", "2026-10-05"],
    ["10월 5일", "2026-10-05"],
    ["내일", "2026-09-28"],
    ["어제", "2026-09-26"],
    ["이번 달", "2026-09-30"],
    ["2026-11-01", "2026-11-01"],
    ["기한 없음", ""],
  ])("%s → %s", (input, expected) => {
    expect(parseDateAnswer(input, TODAY)).toBe(expected);
  });
});

describe("parseTimeAnswer", () => {
  it.each([
    ["3시", "15:00"],
    ["오전 11시 20분", "11:20"],
    ["오후 3시 반", "15:30"],
    ["19:00", "19:00"],
  ])("%s → %s", (input, expected) => {
    expect(parseTimeAnswer(input)).toBe(expected);
  });
});

describe("extractItems (Gemini 목)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    localStorage.setItem("sophia-api-gemini", "test-key");
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("요청 형식 + 정규화 (빈 금액/잘못된 카테고리 → 되묻기, 첨부 번호 0부터)", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      items: [
                        { type: "expense", amount: null, category: "외식", date: "2026-09-26", memo: "성수 파스타", source: "파스타 먹었어", confidence: 0.8, missing: [], attachmentIndexes: [] },
                        { type: "event", title: "드레스 2차 피팅", date: "2026-10-03", time: "15:00", source: "다음주 토요일 3시", confidence: 0.9, missing: [], attachmentIndexes: [1] },
                        { type: "bogus", source: "x", confidence: 1, missing: [], attachmentIndexes: [] },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 }
      )
    );
    const items = await extractItems("어제 성수에서 파스타 먹었어", TODAY, {
      expenseCategories: ["식비", "카페"],
      images: [{ base64: "AAAA", mime: "image/jpeg" }],
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.temperature).toBe(0.2);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema).toBeTruthy();
    expect(body.contents[0].parts.some((p: { inline_data?: unknown }) => p.inline_data)).toBe(true);
    expect(body.contents[0].parts[0].text).toContain("2026-09-27 (일요일)");

    expect(items).toHaveLength(2);
    const exp = items[0];
    expect(exp.type).toBe("expense");
    expect(isReady(exp)).toBe(false);
    expect(exp.missing.map((q) => q.field).sort()).toEqual(["amount", "category"]);
    expect(items[1].attachmentIndexes).toEqual([0]);
    expect(isReady(items[1])).toBe(true);

    // 칩/입력으로 답하면 필드가 채워지고 질문이 사라진다
    const qa = exp.missing.find((q) => q.field === "amount")!;
    const r1 = applyAnswer(exp, qa, "1.8만", TODAY);
    expect("item" in r1 && (r1.item as Extract<InboxItem, { type: "expense" }>).amount).toBe(18000);
    const qc = exp.missing.find((q) => q.field === "category")!;
    const r2 = "item" in r1 ? applyAnswer(r1.item, qc, "식비", TODAY, 0) : r1;
    expect("item" in r2 && isReady(r2.item)).toBe(true);
  });

  it("키가 없으면 한국어 에러", async () => {
    localStorage.removeItem("sophia-api-gemini");
    await expect(extractItems("아무거나", TODAY)).rejects.toThrow("Gemini API 키");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("saveItem (저장 함수 목)", () => {
  const base = { id: "x", source: "", confidence: 1, missing: [], attachmentIndexes: [] };
  it("여러 날 일정은 CalendarTab처럼 날짜마다 (i/n)", async () => {
    await saveItem({ ...base, type: "event", title: "제주", date: "2026-10-01", time: null, endDate: "2026-10-03", emoji: "✈️" });
    const calls = vi.mocked(sync.saveEvent).mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.title)).toEqual(["제주 (1/3)", "제주 (2/3)", "제주 (3/3)"]);
    expect(calls[0]).toMatchObject({ date: "2026-10-01", time: null, is_shared: false });
  });
  it("지출은 주입된 addExpense + 첨부 링크를 메모에", async () => {
    const addExpense = vi.fn();
    await saveItem(
      { ...base, type: "expense", amount: 18500, category: "식비", date: "2026-09-26", memo: "성수 파스타" },
      { addExpense, attachmentUrls: ["https://example.test/r.jpg"] }
    );
    expect(addExpense.mock.calls[0][0]).toMatchObject({ type: "expense", amount: 18500, category: "식비", deductFrom: "none" });
    expect(addExpense.mock.calls[0][0].memo).toContain("https://example.test/r.jpg");
  });
  it("기한 없는 할 일은 오늘 칸", async () => {
    await saveItem({ ...base, type: "todo", title: "관리비 이체", date: null, memo: "" }, { today: TODAY });
    expect(vi.mocked(sync.saveTodo).mock.lastCall![0]).toMatchObject({ title: "관리비 이체", date: "2026-09-27", is_done: false });
  });
  it("메모는 속닥속닥 (memos) + localStorage", async () => {
    await saveItem({ ...base, type: "memo", text: "제주 숙소: 애월 ○○스테이" });
    expect(vi.mocked(sync.saveMemoToDB).mock.lastCall![0]).toMatchObject({ author: "sophia", message: "제주 숙소: 애월 ○○스테이" });
    expect(localStorage.getItem("sophia-couple-memos")).toContain("애월");
  });
  it("필수 정보가 비면 저장 거부", async () => {
    await expect(saveItem({ ...base, type: "expense", amount: null, category: "식비", date: "2026-09-26", memo: "" }, { addExpense: vi.fn() })).rejects.toThrow();
  });
});
