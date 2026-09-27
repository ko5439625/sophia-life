// 사진으로 글쓰기 — 사진 여러 장 + 메모를 Gemini(vision)에 보내 블로그 초안(JSON)을 받는다.
// mock 폴백 없음: 실패하면 한국어 에러를 던져 UI에서 그대로 보여준다.

import { GEMINI_ENDPOINT, getApiKey, describeGeminiError } from "./openaiApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PhotoBlogTone = "담백" | "발랄" | "감성";

export const PHOTO_BLOG_MAX_PHOTOS = 10;

export interface PhotoBlogPhoto {
  /** data: 접두어 없는 base64 */
  base64: string;
  mime: "image/jpeg";
  note?: string;
}

export interface PhotoBlogRequest {
  topic: string;
  place?: string;
  date?: string;
  tone: PhotoBlogTone;
  photos: PhotoBlogPhoto[];
}

export interface PhotoBlogSection {
  /** 0부터 시작하는 사진 인덱스 */
  photoIndex: number;
  heading: string;
  body: string;
  /** 이 문단에서 뽑은 인용용 한 줄 (25자 이내, 본문에 있는 내용만) */
  highlight: string;
}

export interface PhotoBlogResult {
  title: string;
  /** 글 전체를 한 줄로 요약 (제목 아래 부제처럼 쓰임) */
  summary: string;
  intro: string;
  sections: PhotoBlogSection[];
  outro: string;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const TONE_GUIDE: Record<PhotoBlogTone, string> = {
  담백: "담백하고 차분하게. 꾸밈말을 줄이고 본 것과 한 것을 또박또박.",
  발랄: "밝고 경쾌하게. 가벼운 리액션은 괜찮지만 과장은 금지.",
  감성: "잔잔하고 따뜻하게. 분위기와 빛, 색감을 조금 더 섬세하게.",
};

function contextLines(req: PhotoBlogRequest): string {
  return [
    `- 주제: ${req.topic.trim()}`,
    req.place?.trim() ? `- 장소: ${req.place.trim()}` : "- 장소: (입력 없음)",
    req.date?.trim() ? `- 날짜: ${req.date.trim()}` : "- 날짜: (입력 없음)",
    `- 톤: ${req.tone} — ${TONE_GUIDE[req.tone]}`,
    `- 사진 수: ${req.photos.length}장`,
  ].join("\n");
}

const WRITING_RULES = `# 작성 규칙
- 개인 일상 블로그 글이에요. 첫 번째 사진부터 순서대로 하나의 글이 되도록 이어서 써주세요.
- 각 사진마다 2~4문장. **사진에 실제로 보이는 것만** 근거로 써요 (분위기, 음식, 색감, 사람 수, 날씨, 빛, 공간 등).
- 사진에서 알 수 없는 사실(가격, 맛, 가게 이름, 메뉴 이름, 사람 이름 등)은 **절대 지어내지 마세요.** 사용자가 메모에 적은 경우에만 써요.
- 1인칭, "~했어요" 체. 문단마다 이모지는 최대 1개.
- '대박', '역대급', '미쳤다', '인생 맛집' 같은 과장된 표현은 쓰지 마세요.
- 연속된 사진 사이에는 자연스럽게 이어지는 짧은 연결 문장(예: "그다음엔", "조금 걸어가니")을 문단 첫머리에 넣어주세요.
- heading은 12자 안팎의 짧은 소제목.
- highlight는 그 문단 body에서 가장 인상적인 한 줄을 25자 이내로 다듬은 인용구예요. body에 없는 새 사실·감정은 넣지 말고, 따옴표·이모지 없이 써주세요.`;

function buildGeneratePrompt(req: PhotoBlogRequest): string {
  return `당신은 개인 일상 블로그를 대신 써주는 작가예요. 아래 사진들을 보고 블로그 글 초안을 만들어주세요.

# 글 정보
${contextLines(req)}

${WRITING_RULES}
- summary는 글 전체를 한 줄(30자 안팎)로 요약한 부제예요. 사진과 메모에 있는 내용만, 이모지 없이.
- intro(도입)는 2문장, outro(마무리)는 2문장.
- tags는 3~6개, '#' 없이 짧은 명사로.
- sections는 사진 1장당 정확히 1개, 사진 순서대로. photoIndex는 사진 번호(1부터 시작)예요.

# 출력
지정된 JSON 스키마로만 답하세요. 다른 텍스트는 쓰지 마세요.

# 사진 (순서대로)`;
}

// ---------------------------------------------------------------------------
// Gemini 호출 공통
// ---------------------------------------------------------------------------

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

const RESULT_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    summary: { type: "STRING" }, // required에 있는데 정의가 빠져 Gemini가 400을 내던 원인
    intro: { type: "STRING" },
    sections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          photoIndex: { type: "INTEGER" },
          heading: { type: "STRING" },
          body: { type: "STRING" },
          highlight: { type: "STRING" },
        },
        required: ["photoIndex", "heading", "body", "highlight"],
        propertyOrdering: ["photoIndex", "heading", "body", "highlight"],
      },
    },
    outro: { type: "STRING" },
    tags: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["title", "summary", "intro", "sections", "outro", "tags"],
  propertyOrdering: ["title", "summary", "intro", "sections", "outro", "tags"],
};

const SECTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    heading: { type: "STRING" },
    body: { type: "STRING" },
    highlight: { type: "STRING" },
  },
  required: ["heading", "body", "highlight"],
  propertyOrdering: ["heading", "body", "highlight"],
};

function photoParts(photo: PhotoBlogPhoto, index: number): Part[] {
  const note = photo.note?.trim();
  return [
    { text: `사진 ${index + 1} 메모: ${note ? note : "(없음)"}` },
    { inline_data: { mime_type: photo.mime, data: photo.base64 } },
  ];
}

async function callGeminiJson<T>(parts: Part[], schema: object): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("설정에서 Gemini API 키를 입력해주세요");

  let res: Response;
  try {
    res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 16384,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    });
  } catch {
    throw new Error("네트워크 연결을 확인해주세요. AI 서버에 연결하지 못했어요.");
  }

  if (!res.ok) {
    const err = await res.text();
    console.warn("[photoBlog] Gemini error:", res.status, err.substring(0, 500));
    throw new Error(describeGeminiError(res.status, err));
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    if (data.promptFeedback?.blockReason) {
      throw new Error("AI가 이 사진들로는 글을 쓸 수 없다고 했어요. 다른 사진으로 시도해주세요.");
    }
    throw new Error("AI가 빈 응답을 보냈어요. 잠시 후 다시 시도해주세요.");
  }
  if (candidate.finishReason === "SAFETY") {
    throw new Error("AI 안전 정책에 걸려 글을 만들지 못했어요. 다른 사진으로 시도해주세요.");
  }

  // gemini-2.5-flash는 thinking part가 섞여 올 수 있음 → thought가 아닌 텍스트만 모음
  const partsOut: { text?: string; thought?: boolean }[] = candidate.content?.parts ?? [];
  const text = partsOut
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .trim();
  if (!text) {
    throw new Error(
      candidate.finishReason === "MAX_TOKENS"
        ? "글이 너무 길어져 중간에 끊겼어요. 사진 수를 줄여서 다시 시도해주세요."
        : "AI가 빈 응답을 보냈어요. 잠시 후 다시 시도해주세요."
    );
  }

  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as T;
  } catch {
    console.warn("[photoBlog] JSON parse failed:", text.substring(0, 500));
    throw new Error("AI 응답을 해석하지 못했어요. 다시 시도해주세요.");
  }
}

function validateRequest(req: PhotoBlogRequest) {
  if (!req.topic.trim()) throw new Error("주제를 입력해주세요.");
  if (req.photos.length === 0) throw new Error("사진을 1장 이상 선택해주세요.");
  if (req.photos.length > PHOTO_BLOG_MAX_PHOTOS) {
    throw new Error(`사진은 최대 ${PHOTO_BLOG_MAX_PHOTOS}장까지 올릴 수 있어요.`);
  }
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** 인용구 정리: 감싼 따옴표 제거 + 너무 길면 자르기 (본문 요약이라 짧게 유지) */
const HIGHLIGHT_MAX = 25;
function cleanHighlight(v: unknown): string {
  const t = str(v).replace(/^["'“”‘’「『]+|["'“”‘’」』]+$/g, "").trim();
  if (t.length <= HIGHLIGHT_MAX + 5) return t;
  return `${t.slice(0, HIGHLIGHT_MAX).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** 사진 전체로 블로그 초안 생성 */
export async function generatePhotoBlog(req: PhotoBlogRequest): Promise<PhotoBlogResult> {
  validateRequest(req);

  const parts: Part[] = [{ text: buildGeneratePrompt(req) }];
  req.photos.forEach((p, i) => parts.push(...photoParts(p, i)));

  const raw = await callGeminiJson<Partial<PhotoBlogResult>>(parts, RESULT_SCHEMA);

  // 사진 번호(1부터) → 0부터 인덱스로 정규화, 사진마다 정확히 1개 섹션 보장
  const bySlot = new Map<number, PhotoBlogSection>();
  (Array.isArray(raw.sections) ? raw.sections : []).forEach((s, order) => {
    const n = Number(s?.photoIndex);
    let idx = Number.isInteger(n) ? n - 1 : order;
    if (idx < 0 || idx >= req.photos.length || bySlot.has(idx)) idx = order;
    if (idx < 0 || idx >= req.photos.length || bySlot.has(idx)) return;
    bySlot.set(idx, {
      photoIndex: idx,
      heading: str(s?.heading),
      body: str(s?.body),
      highlight: cleanHighlight(s?.highlight),
    });
  });
  const sections = req.photos.map(
    (_, i) => bySlot.get(i) ?? { photoIndex: i, heading: "", body: "", highlight: "" }
  );

  return {
    title: str(raw.title) || req.topic.trim(),
    summary: str(raw.summary),
    intro: str(raw.intro),
    sections,
    outro: str(raw.outro),
    tags: (Array.isArray(raw.tags) ? raw.tags : [])
      .map((t) => str(t).replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 6),
  };
}

/**
 * 한 사진의 문단만 다시 쓰기. 다른 문단은 맥락으로만 전달하고,
 * 해당 사진 한 장만 이미지로 보낸다 (요청 크기/비용 절약).
 * @param photoIndex 0부터 시작
 */
export async function regenerateSection(
  req: PhotoBlogRequest & { draft: PhotoBlogResult },
  photoIndex: number
): Promise<{ heading: string; body: string; highlight: string }> {
  validateRequest(req);
  const photo = req.photos[photoIndex];
  if (!photo) throw new Error("다시 쓸 사진을 찾지 못했어요.");

  const others = req.draft.sections
    .filter((s) => s.photoIndex !== photoIndex)
    .map((s) => `[사진 ${s.photoIndex + 1}] ${s.heading}\n${s.body}`)
    .join("\n\n");
  const current = req.draft.sections.find((s) => s.photoIndex === photoIndex);

  const prompt = `당신은 개인 일상 블로그를 대신 써주는 작가예요. 이미 쓴 블로그 글 중 **사진 ${photoIndex + 1}번 문단 하나만** 새로 써주세요.

# 글 정보
${contextLines(req)}

${WRITING_RULES}
- 앞뒤 문단과 자연스럽게 이어지게 써주세요. 기존 문단과 표현이 겹치지 않게, 다른 시각으로.

# 글 제목
${req.draft.title}

# 한 줄 요약
${req.draft.summary || "(없음)"}

# 도입
${req.draft.intro}

# 다른 사진 문단들 (참고용, 수정 금지)
${others || "(없음)"}

# 지금 문단 (이걸 대체할 새 버전을 써주세요)
${current ? `${current.heading}\n${current.body}` : "(없음)"}

# 출력
{ "heading": 소제목, "body": 2~4문장 본문, "highlight": body에서 뽑은 25자 이내 인용 한 줄 } JSON만 답하세요.

# 사진 ${photoIndex + 1}`;

  const parts: Part[] = [{ text: prompt }, ...photoParts(photo, photoIndex)];
  const raw = await callGeminiJson<{ heading?: unknown; body?: unknown; highlight?: unknown }>(
    parts,
    SECTION_SCHEMA
  );
  const body = str(raw.body);
  if (!body) throw new Error("AI가 빈 문단을 보냈어요. 다시 시도해주세요.");
  return { heading: str(raw.heading), body, highlight: cleanHighlight(raw.highlight) };
}
