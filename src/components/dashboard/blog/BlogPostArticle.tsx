// 공개 글 본문 렌더링 — 공개 페이지(src/pages/BlogPost.tsx)와 에디터 미리보기가 같이 쓴다.
// 타이포그래피는 src/index.css 의 `.blog-content` 규칙이 담당.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface BlogPostArticleData {
  title: string;
  content: string;
  category: string;
  date: string;
  tags: string[];
  images: string[];
}

const BlogPostArticle = ({ post }: { post: BlogPostArticleData }) => {
  const [currentImg, setCurrentImg] = useState(0);
  const images = post.images.filter((src) => src && !src.startsWith("blob:"));
  const hasMultipleImages = images.length > 1;
  const imgIndex = Math.min(currentImg, Math.max(0, images.length - 1));

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {post.category && (
          <span className="text-xs font-mono text-primary uppercase tracking-widest">{post.category}</span>
        )}
        {post.date && (
          <span className="text-xs text-muted-foreground font-mono tabular-nums">{post.date}</span>
        )}
      </div>

      <h1 className="text-[28px] leading-[1.3] md:text-5xl md:leading-tight font-sans font-bold mb-4 break-keep [overflow-wrap:anywhere]">
        {post.title || "제목 없음"}
      </h1>

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-8">
          {post.tags.map((tag) => (
            <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="rounded-lg overflow-hidden mb-10 relative">
          <AnimatePresence mode="wait">
            <motion.img
              key={imgIndex}
              src={images[imgIndex]}
              alt={`${post.title} - ${imgIndex + 1}`}
              className="w-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          </AnimatePresence>

          {hasMultipleImages && (
            <>
              <button
                onClick={() => setCurrentImg(imgIndex === 0 ? images.length - 1 : imgIndex - 1)}
                aria-label="이전 사진"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setCurrentImg(imgIndex === images.length - 1 ? 0 : imgIndex + 1)}
                aria-label="다음 사진"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImg(i)}
                    aria-label={`${i + 1}번째 사진`}
                    className={`w-2 h-2 rounded-full transition-colors ${i === imgIndex ? "bg-white" : "bg-white/40"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="blog-content max-w-none" dangerouslySetInnerHTML={{ __html: post.content }} />
    </>
  );
};

export default BlogPostArticle;
