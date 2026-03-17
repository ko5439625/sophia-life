// NOTE: Some APIs require a backend proxy to avoid CORS. For development, use mock data.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const SYSTEM_PROMPT =
  "당신은 블로그 글을 더 풍부하고 자연스럽게 다듬어주는 도우미입니다. 원문의 의미와 톤을 유지하면서 표현을 더 생생하고 다채롭게 만들어주세요. 이미지 관련 태그는 절대 수정하지 마세요.";

function getApiKey(): string | null {
  return localStorage.getItem("sophia-api-openai");
}

// ---------------------------------------------------------------------------
// Real API function
// ---------------------------------------------------------------------------

async function realEnhanceBlogContent(content: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No OpenAI API key");

  const res = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? content;
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
// Unified export (try real API, fall back to mock)
// ---------------------------------------------------------------------------

export async function enhanceBlogContent(content: string): Promise<string> {
  try {
    if (!getApiKey()) return mockEnhanceBlogContent(content);
    return await realEnhanceBlogContent(content);
  } catch (e) {
    console.warn("OpenAI enhanceBlogContent failed, using mock:", e);
    return mockEnhanceBlogContent(content);
  }
}
