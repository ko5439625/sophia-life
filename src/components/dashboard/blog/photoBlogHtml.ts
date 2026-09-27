// 사진으로 글쓰기 결과(JSON) → 에디터에 넣을 HTML 조립
import type { PhotoBlogResult } from "@/services/photoBlogApi";

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const textHtml = (s: string) => escapeHtml(s.trim()).replace(/\n/g, "<br>");

const paragraph = (s: string, className?: string) =>
  s.trim() ? `<p${className ? ` class="${className}"` : ""}>${textHtml(s)}</p>` : "";

/**
 * 결과 → 에디터에 넣을 시맨틱 HTML. 꾸밈은 index.css 의 `.blog-content` 클래스 규칙이 담당
 * (인라인 스타일 없음 → 에디터/미리보기/공개 글이 같은 모양, 다크/라이트 모두 대응).
 *
 * 구조: 한 줄 요약 → 도입(lead) → [소제목 → 사진(figure+캡션) → 본문 → 인용구] × N (사이 구분선) → 마무리 → 태그 칩
 */
export function buildPostHtml(
  result: PhotoBlogResult,
  imageUrls: string[],
  opts: { captions?: string[]; tags?: string[] } = {}
): string {
  const parts: string[] = [];
  parts.push(paragraph(result.summary, "post-summary"));
  parts.push(paragraph(result.intro, "lead"));
  result.sections.forEach((s, i) => {
    const url = imageUrls[i];
    const heading = s.heading.trim();
    const caption = opts.captions?.[i]?.trim() ?? "";
    if (i > 0) parts.push(`<hr class="section-divider">`);
    if (heading) parts.push(`<h3>${escapeHtml(heading)}</h3>`);
    if (url) {
      parts.push(
        `<figure class="post-figure"><img src="${escapeHtml(url)}" alt="${escapeHtml(caption || heading || `사진 ${i + 1}`)}" loading="lazy">` +
          (caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "") +
          `</figure>`
      );
    }
    parts.push(paragraph(s.body));
    if (s.highlight?.trim()) {
      parts.push(`<blockquote class="pull-quote"><p>${textHtml(s.highlight)}</p></blockquote>`);
    }
  });
  parts.push(paragraph(result.outro, "outro"));
  const tags = (opts.tags ?? []).filter(Boolean);
  if (tags.length > 0) {
    parts.push(
      `<p class="post-tags">${tags.map((t) => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join(" ")}</p>`
    );
  }
  // 에디터가 white-space: pre-wrap 이라 태그 사이 줄바꿈이 빈 줄로 보이므로 붙여서 반환
  return parts.filter(Boolean).join("");
}
