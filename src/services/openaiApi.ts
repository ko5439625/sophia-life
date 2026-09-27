// NOTE: Blog enhancement uses Gemini API (free tier).
// After Gemini transforms the text, we auto-insert relevant images via Unsplash API.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const BLOG_ENHANCE_PROMPT = `당신은 개인 일상 블로그의 담당 에디터예요.
원고를 받아서 **읽기 편하고 보기 좋은** 블로그 글로 다듬어요. 새 글을 쓰는 게 아니라 원고를 정리하는 일이에요.

# 핵심 원칙
- 원문의 **정보와 의미는 절대 삭제·왜곡·추가하지 않아요.** 원문에 없는 사실(가격, 맛, 가게 이름, 사람 이름 등)을 지어내지 마세요.
- 표현은 자연스럽게 다듬되, 글쓴이의 말투("~했어요" 등)를 유지해요.
- 분량은 원문과 비슷하게 (최대 1.3배). 억지로 늘리지 마세요.
- '대박', '역대급', '미쳤다', '인생 맛집' 같은 과장 표현은 쓰지 마세요. 이모지는 문단당 최대 1개.
- 기존 <img> 태그는 src/alt 그대로, 원래 위치에 둬요. 기존 <figure>도 그대로 유지해요.
- 출력은 순수 HTML. 코드블록(\`\`\`html)으로 감싸지 말고, <!DOCTYPE>/<html>/<body> 없이.

# 구조 (클래스만 쓰고 style 속성은 쓰지 마세요)
사이트 CSS가 아래 클래스를 예쁘게 꾸며줘요. **인라인 style, 색상 span, font-size 지정은 금지**예요.
- 도입 문단: <p class="lead">첫 인사/도입 1~2문장</p>
- 소제목: <h3>짧은 소제목</h3> (내용 흐름이 바뀌는 곳마다, 이모지 없이)
- 본문: <p>문단</p> (한 문단은 2~4문장)
- 인용 한 줄: <blockquote class="pull-quote"><p>원문에서 가져온 인상적인 한 줄</p></blockquote> — 글 전체에서 0~2개, 25자 안팎
- 강조: 꼭 필요한 단어만 <strong> (문단당 최대 1개)
- 목록이 자연스러운 내용(준비물, 순서 등)만 <ul><li> 사용
- 큰 흐름이 바뀔 때만 <hr class="section-divider">

# 사진 자리 표시 (선택)
사진이 꼭 어울리는 곳이 있으면 최대 2개까지 <!-- INSERT_IMAGE: 영어 검색 키워드 --> 주석을 넣을 수 있어요.
기존 <img> 근처에는 넣지 마세요. 필요 없으면 넣지 않아도 돼요.

# BEFORE → AFTER 예시
BEFORE:
"제주도에 갔다. 성산일출봉을 올랐다. 힘들었지만 경치가 좋았다. 점심으로 흑돼지를 먹었다."

AFTER:
<p class="lead">오랜만에 제주도에 다녀왔어요.</p><h3>성산일출봉에 오르다</h3><p>도착하자마자 성산일출봉부터 올랐어요. 올라가는 길은 꽤 힘들었지만, 꼭대기에서 본 경치가 그 수고를 다 잊게 해줬어요.</p><blockquote class="pull-quote"><p>힘들었지만 경치가 다 보상해줬어요</p></blockquote><h3>점심은 흑돼지</h3><p>내려와서 점심으로는 흑돼지를 먹었어요.</p>`;

/** 설정 > API 키에서 저장한 Gemini 키 (다른 Gemini 기능에서도 재사용) */
export function getApiKey(): string | null {
  return localStorage.getItem("sophia-api-gemini");
}

/** Gemini HTTP 에러를 사용자용 한국어 메시지로 변환 */
export function describeGeminiError(status: number, body: string): string {
  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(body)) {
    return "Gemini API 키가 올바르지 않아요. 설정에서 키를 확인해주세요.";
  }
  if (status === 401 || status === 403) return "Gemini API 키 권한이 없어요. 설정에서 키를 확인해주세요.";
  if (status === 429) return "AI 요청 한도를 초과했어요. 잠시 후 다시 시도해주세요.";
  if (status === 413) return "보낸 데이터가 너무 커요. 사진 수를 줄여서 다시 시도해주세요.";
  if (status >= 500) return "AI 서버가 일시적으로 응답하지 않아요. 잠시 후 다시 시도해주세요.";
  return `AI 요청에 실패했어요 (${status}).`;
}

// ---------------------------------------------------------------------------
// Image fetcher (Unsplash API - free tier, 50 req/hr)
// ---------------------------------------------------------------------------

const UNSPLASH_API = "https://api.unsplash.com/search/photos";

function getUnsplashKey(): string | null {
  return localStorage.getItem("sophia-api-unsplash");
}

async function searchUnsplashImage(query: string): Promise<string | null> {
  const key = getUnsplashKey();
  if (!key) return null;

  try {
    const res = await fetch(
      `${UNSPLASH_API}?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data.results?.[0];
    if (!photo) return null;
    // Use regular size (w=800) for blog posts
    return photo.urls?.regular || photo.urls?.small || null;
  } catch {
    return null;
  }
}

/**
 * Replace <!-- INSERT_IMAGE: keyword --> comments with actual <img> tags.
 * Uses Unsplash API for accurate keyword-matched images.
 * Falls back to removing comments if no API key.
 */
async function insertAutoImages(html: string): Promise<string> {
  const pattern = /<!--\s*INSERT_IMAGE:\s*(.+?)\s*-->/g;
  const matches: { full: string; keyword: string }[] = [];
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(html)) !== null) {
    matches.push({ full: m[0], keyword: m[1] });
  }

  if (matches.length === 0) return html;

  // If no Unsplash key, just remove INSERT_IMAGE comments
  if (!getUnsplashKey()) {
    return html.replace(/<!--\s*INSERT_IMAGE:\s*(.+?)\s*-->/g, "");
  }

  // Fetch all images in parallel
  const results = await Promise.all(
    matches.map(async ({ full, keyword }) => {
      const url = await searchUnsplashImage(keyword);
      return { full, keyword, url };
    })
  );

  let result = html;
  for (const { full, keyword, url } of results) {
    if (url) {
      result = result.replace(
        full,
        `<figure class="post-figure"><img src="${url}" alt="${keyword.replace(/"/g, "&quot;")}" loading="lazy" /></figure>`
      );
    } else {
      // Remove comment if image not found
      result = result.replace(full, "");
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Real API function (Gemini)
// ---------------------------------------------------------------------------

async function realEnhanceBlogContent(content: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("설정에서 Gemini API 키를 입력해주세요");

  const userMessage = `아래 블로그 글을 읽기 편하게 다듬어주세요.

요구사항:
1. 정보는 그대로, 표현만 자연스럽게. 분량은 원문과 비슷하게 (최대 1.3배)
2. 도입은 <p class="lead">, 소제목 <h3>, 본문 <p>, 인용 한 줄은 <blockquote class="pull-quote"><p>…</p></blockquote>
3. style 속성·색상·글자 크기 지정 금지 (사이트 CSS가 꾸며줘요)
4. 기존 <img>/<figure> 태그는 절대 건드리지 말 것
5. 출력은 순수 HTML만. 태그 사이에 줄바꿈 없이 이어서. \`\`\`html 코드블록으로 감싸지 마세요.

원문:
${content}`;

  const fullPrompt = `${BLOG_ENHANCE_PROMPT}\n\n---\n\n${userMessage}`;

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn("[enhanceBlog] Gemini error:", res.status, err.substring(0, 500));
    throw new Error(describeGeminiError(res.status, err));
  }

  const data = await res.json();

  // gemini-2.5-flash는 thinking 모델이라 parts가 여러 개:
  // parts[0] = thinking (thought: true), parts[last] = 실제 응답
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    console.warn("[enhanceBlog] no parts found:", JSON.stringify(data).substring(0, 500));
    throw new Error("AI가 빈 응답을 보냈어요. 잠시 후 다시 시도해주세요.");
  }

  // thinking이 아닌 마지막 part에서 텍스트 추출
  let result = "";
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!parts[i].thought && parts[i].text) {
      result = parts[i].text;
      break;
    }
  }

  if (!result) {
    result = parts[parts.length - 1]?.text ?? content;
  }

  // Strip markdown code block wrappers if present
  result = result.replace(/^```html\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  result = result.replace(/^```\s*\n?/, "").replace(/\n?```\s*$/, "");

  // 에디터가 white-space: pre-wrap 이라 태그 사이 줄바꿈이 빈 줄로 보이므로 제거
  result = result.trim().replace(/>\s*\n\s*</g, "><");

  // Replace INSERT_IMAGE comments with actual images (Unsplash API)
  result = await insertAutoImages(result);

  return result;
}

// ---------------------------------------------------------------------------
// Unified export — mock 폴백 없음: 실패 시 에러를 그대로 올려 UI에서 안내
// ---------------------------------------------------------------------------

export async function enhanceBlogContent(content: string): Promise<string> {
  if (!getApiKey()) throw new Error("설정에서 Gemini API 키를 입력해주세요");
  return await realEnhanceBlogContent(content);
}
