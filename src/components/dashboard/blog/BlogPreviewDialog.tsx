// 에디터 "미리보기" — 공개 글 페이지(src/pages/BlogPost.tsx)와 같은 렌더러(BlogPostArticle)로 보여준다.
// 모바일: 전체 화면 시트 / 데스크탑: 가운데 다이얼로그
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X, Send, Eye } from "lucide-react";
import BlogPostArticle, { type BlogPostArticleData } from "./BlogPostArticle";

const BlogPreviewDialog = ({
  open,
  onOpenChange,
  post,
  publishLabel,
  canPublish,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: BlogPostArticleData | null;
  publishLabel: string;
  canPublish: boolean;
  onPublish: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex flex-col gap-0 p-0 w-full max-w-3xl h-[100dvh] max-h-[100dvh] rounded-none sm:h-[min(92vh,960px)] sm:rounded-xl overflow-hidden border-0 sm:border [&>button:last-child]:hidden">
      {/* 상단 바 */}
      <div className="flex-shrink-0 flex items-center gap-2 border-b border-border bg-background/95 backdrop-blur-sm px-2 sm:px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="h-11 px-3 flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
          닫기
        </button>
        <div className="flex-1 min-w-0 text-center">
          <DialogTitle className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Eye className="h-4 w-4 text-primary flex-shrink-0" />
            미리보기
          </DialogTitle>
          <DialogDescription className="sr-only">공개 블로그에 보이는 모습 그대로 보여줘요</DialogDescription>
        </div>
        <button
          type="button"
          onClick={onPublish}
          disabled={!canPublish}
          className="h-11 px-4 flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
          {publishLabel}
        </button>
      </div>

      {/* 본문 — 공개 페이지와 같은 컨테이너/스타일 */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain bg-background">
        {post && (
          <article className="container mx-auto px-4 md:px-8 max-w-3xl py-8 md:py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
            <BlogPostArticle post={post} />
          </article>
        )}
        {!canPublish && (
          <p className="px-4 pb-8 text-center text-xs text-muted-foreground">제목을 입력하면 발행할 수 있어요.</p>
        )}
      </div>
    </DialogContent>
  </Dialog>
);

export default BlogPreviewDialog;
