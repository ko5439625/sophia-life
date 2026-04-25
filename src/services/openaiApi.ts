// NOTE: Blog enhancement uses Gemini API (free tier).
// After Gemini transforms the text, we auto-insert relevant images via Unsplash API.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const BLOG_ENHANCE_PROMPT = `당신은 구독자 10만의 인기 블로거 전담 에디터입니다.
밋밋한 원고를 받아서, 사람들이 "와 이 블로그 진짜 잘 쓴다!" 하고 감탄할 만한 포스트로 변환합니다.

# 핵심 원칙
- 원문의 **정보와 의미는 절대 삭제/왜곡하지 않습니다.**
- 하지만 **표현, 문체, 구성은 자유롭게 다듬습니다.** 딱딱한 문장→생동감 있게, 나열식→구조적으로.
- 기존 <img> 태그는 src/alt 포함 그대로 원위치에 둡니다.
- 출력은 순수 HTML. 코드블록(\`\`\`html) 감싸지 마세요. <!DOCTYPE>/<html>/<body> 없이.

# 당신이 반드시 해야 할 것

## 1. 문장을 살아있게 다듬기 (가장 중요!)
- 딱딱한 문어체 → 친구한테 신나게 이야기하는 톤으로
- 밋밋한 서술 → 감탄사, 리액션, 생생한 묘사 추가
- "~했다" "~이다" 반복 → 다양한 어미로 ("~했는데 이게 진짜 대박!", "~해봤거든요? 완전 추천이에요 ㅎㅎ")
- 읽는 사람이 공감하고 웃을 수 있는 한마디 사이사이에 추가
- 예: "맛있었다" → "첫 입에 눈이 번쩍 떠지는 맛이었어요 🤤 이건 진짜 또 가야 해..."
- **핵심: 진짜 사람이 정성 들여 쓴 블로그처럼 보여야 합니다.**

## 2. 시각적 HTML 서식 (반드시 모두 활용!)

### 소제목으로 구조 잡기 (필수!)
글의 흐름에 따라 <h3>로 소제목을 만들어주세요. 이모지 필수!
<h3>🍽️ 첫 번째 메뉴, 감동의 파스타</h3>

### 인용 블록 (2~3개 필수!)
감성적이거나 인상적인 문장을 골라서 blockquote로:
<blockquote style="border-left: 4px solid #e74c3c; padding: 16px 20px; margin: 20px 0; background: #fef2f2; border-radius: 0 12px 12px 0; font-size: 1.1em; line-height: 1.8;">
💬 "여행의 진짜 매력은, 예상치 못한 순간에 찾아오는 법이에요."
</blockquote>

### 색상 강조 텍스트 (적극 사용!)
- <span style="color: #e74c3c; font-weight: 700;">강렬한 강조 (빨강)</span>
- <span style="color: #3498db; font-weight: 600;">정보/팁 강조 (파랑)</span>
- <span style="color: #e67e22;">따뜻한 감성 (주황)</span>
- <span style="color: #27ae60;">긍정/추천 (초록)</span>

### 글씨 크기 변화 (꼭 사용!)
- 핵심 한 줄: <p style="font-size: 1.4em; font-weight: 700; text-align: center; margin: 24px 0;">✨ 인생 맛집 등극 ✨</p>
- 소소한 코멘트: <span style="font-size: 0.85em; color: #999;">(근데 솔직히 가격은 좀... 🥲)</span>

### 접힘 블록 (1~2개)
<details><summary>💡 꿀팁: 예약 방법이 궁금하다면?</summary><p>네이버 예약으로 가능하고, 주말은 2주 전에 해야 해요!</p></details>

### 강조 박스 (1~2개)
<div style="background: linear-gradient(135deg, #667eea22, #764ba222); border-radius: 16px; padding: 24px; margin: 24px 0; border: 1px solid #667eea44;">
<p style="font-weight: 700; font-size: 1.1em; margin-bottom: 8px;">📌 핵심 요약</p>
<p>여기에 핵심 내용을 정리!</p>
</div>

### 구분선
<hr style="border: none; border-top: 2px dashed #ddd; margin: 32px 0;">

### 목록
<ul style="list-style: none; padding: 0;"><li style="padding: 8px 0;">✅ 항목 1</li><li style="padding: 8px 0;">✅ 항목 2</li></ul>

## 3. 이모지 (사람이 쓴 것처럼 자연스럽게!)
- 소제목에는 꼭 이모지를 넣으세요
- 문장 속에 감정표현처럼 자연스럽게 섞어주세요: "진짜 맛있었어요 🤤", "완전 추천! ✨"
- 기계적으로 붙이지 말고, 실제 블로거가 쓴 것처럼 감정이 느껴지는 곳에만 넣으세요
- 과하지도, 부족하지도 않게. 한 문단에 1~2개 정도가 적당합니다

## 4. 사진 삽입 위치 표시 (중요!)
글 중간중간에 내용과 어울리는 사진이 들어가면 훨씬 풍성해 보입니다.
기존 <img> 태그 외에, 사진이 있으면 좋겠다 싶은 위치에 아래 형식의 주석을 삽입하세요:
<!-- INSERT_IMAGE: 영어 검색 키워드 -->

예시:
- 맛집 글 중간: <!-- INSERT_IMAGE: korean bbq restaurant -->
- 카페 소개 후: <!-- INSERT_IMAGE: aesthetic cafe latte art -->
- 여행 풍경 묘사 후: <!-- INSERT_IMAGE: jeju island ocean view -->
- 일상 글: <!-- INSERT_IMAGE: cozy home interior -->

규칙:
- 글 전체에서 2~4개 정도 삽입 (너무 많으면 산만)
- 기존 <img> 태그가 이미 있는 문단 근처에는 넣지 마세요
- 키워드는 반드시 **영어**로, 구체적으로 작성 (예: "pasta" 보다 "creamy truffle pasta closeup")

# BEFORE → AFTER 예시

BEFORE:
"제주도에 갔다. 성산일출봉을 올랐다. 힘들었지만 경치가 좋았다. 점심으로 흑돼지를 먹었다. 맛있었다."

AFTER:
<h3>🌅 성산일출봉, 땀 흘린 보람이 있었다!</h3>
<p>제주도 도착하자마자 바로 <span style="color: #e74c3c; font-weight: 700;">성산일출봉</span>으로 직행했어요. 올라가는 길이 생각보다 만만치 않더라고요... 중간에 "왜 왔지?" 하는 순간이 세 번은 왔는데 😂</p>
<!-- INSERT_IMAGE: jeju seongsan ilchulbong sunrise peak -->
<blockquote style="border-left: 4px solid #3498db; padding: 16px 20px; margin: 20px 0; background: #eff6ff; border-radius: 0 12px 12px 0; font-size: 1.1em;">
💬 "근데 꼭대기에 올라서 바라본 그 풍경... 진심 숨이 멎는 줄 알았어요."
</blockquote>
<p>힘들었던 거 1초 만에 싹 잊게 만드는 뷰 🏔️ <span style="color: #27ae60; font-weight: 600;">제주 오면 무조건 여기는 가세요, 진짜로!</span></p>
<hr style="border: none; border-top: 2px dashed #ddd; margin: 32px 0;">
<h3>🐷 흑돼지... 이건 반칙이야</h3>
<p>내려와서 바로 <span style="color: #e67e22; font-weight: 600;">흑돼지 맛집</span>으로 달려갔는데요,</p>
<p style="font-size: 1.3em; font-weight: 700; text-align: center; margin: 20px 0;">🔥 역대급 고기를 만나버렸습니다 🔥</p>
<!-- INSERT_IMAGE: grilled jeju black pork bbq -->
<p>겉은 바삭, 속은 육즙이 좌르르... <span style="font-size: 0.85em; color: #999;">(침 고이는 중 🤤)</span></p>

# 중요
- 위 예시처럼 **원문의 정보는 100% 살리되, 표현과 구성을 확 바꿔야** 합니다.
- 이모지만 몇 개 붙이고 원문 그대로 두는 것은 **절대 안 됩니다.** 그건 실패입니다.
- HTML 서식(색상, 크기, blockquote, 강조박스)을 **반드시 골고루** 사용하세요.
- **사진 삽입 주석(INSERT_IMAGE)을 2~4개 꼭 넣으세요.** 사진 없는 블로그는 밋밋합니다.
- 최종 결과물의 HTML 길이는 원문의 **2~3배**가 되어야 정상입니다.`;

function getApiKey(): string | null {
  return localStorage.getItem("sophia-api-gemini");
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
        `<div style="margin: 24px 0; text-align: center;">
<img src="${url}" alt="${keyword}" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" loading="lazy" />
</div>`
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
  if (!apiKey) throw new Error("No Gemini API key");

  const userMessage = `아래 블로그 글을 인기 블로그처럼 확 바꿔주세요!

요구사항:
1. 문장을 생생하고 재미있게 다듬기 (정보는 유지, 표현은 자유롭게) - 진짜 사람이 쓴 것처럼!
2. 소제목(h3), 색상 강조(span), 인용블록(blockquote), 글씨 크기 변화, 강조 박스 - 전부 사용
3. 이모지를 자연스럽게 (소제목에는 필수, 문장 속에는 감정 표현처럼)
4. 기존 <img> 태그는 절대 건드리지 말 것
5. 사진이 어울리는 위치에 <!-- INSERT_IMAGE: 영어키워드 --> 주석 2~4개 삽입
6. 출력은 순수 HTML만. \`\`\`html 코드블록으로 감싸지 마세요.

원문:
${content}`;

  const fullPrompt = `${BLOG_ENHANCE_PROMPT}\n\n---\n\n${userMessage}`;

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 16384,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();

  // gemini-2.5-flash는 thinking 모델이라 parts가 여러 개:
  // parts[0] = thinking (thought: true), parts[last] = 실제 응답
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    console.warn("[enhanceBlog] no parts found:", JSON.stringify(data).substring(0, 500));
    return content;
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

  // Replace INSERT_IMAGE comments with actual images (Unsplash API)
  result = await insertAutoImages(result);

  return result;
}

// ---------------------------------------------------------------------------
// Mock function
// ---------------------------------------------------------------------------

function mockEnhanceBlogContent(content: string): string {
  // Simple mock: add slight formatting enhancements
  return content
    .replace(/\. /g, ".\n\n")
    .replace(/^(.+)$/m, (match) => {
      if (match.length > 20) return match;
      return match;
    });
}

// ---------------------------------------------------------------------------
// Unified export (try Gemini API, fall back to mock)
// ---------------------------------------------------------------------------

export async function enhanceBlogContent(content: string): Promise<string> {
  try {
    if (!getApiKey()) return mockEnhanceBlogContent(content);
    return await realEnhanceBlogContent(content);
  } catch (e) {
    console.warn("Gemini enhanceBlogContent failed, using mock:", e);
    return mockEnhanceBlogContent(content);
  }
}
