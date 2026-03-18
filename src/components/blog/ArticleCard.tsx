import { useState } from "react";
import { motion } from "framer-motion";
import { BlogPost } from "@/lib/mockData";
import { useNavigate } from "react-router-dom";
import defaultBlogImg from "@/assets/default-blog.png";

interface ArticleCardProps {
  post: BlogPost;
  index: number;
  onTagClick?: (tag: string) => void;
  activeTag?: string | null;
}

const ArticleCard = ({ post, index, onTagClick, activeTag }: ArticleCardProps) => {
  const navigate = useNavigate();
  const [imgIndex, setImgIndex] = useState(0);
  const hasMultiple = post.images.length > 1;

  return (
    <motion.article
      className="blog-card bg-card rounded-md overflow-hidden cursor-pointer group relative"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{
        duration: 0.4,
        delay: index * 0.06,
        ease: [0.16, 1, 0.3, 1],
      }}
      onClick={() => navigate(`/post/${post.id}`)}
    >
      {/* Image area */}
      <div
        className="aspect-square overflow-hidden relative bg-muted"
        onMouseEnter={() => { if (hasMultiple) setImgIndex(1); }}
        onMouseLeave={() => setImgIndex(0)}
      >
        {post.images.length > 0 && post.images[0] ? (
          <>
            <img
              src={post.images[imgIndex] || post.images[0]}
              alt={post.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            {hasMultiple && (
              <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                +{post.images.length}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 gap-2 p-4">
            <img src={defaultBlogImg} alt="no image" className="w-24 h-24 object-contain opacity-60" />
            <span className="text-[10px] text-muted-foreground/50 font-mono">첨부 이미지가 없습니다</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] font-mono text-primary uppercase tracking-wider">
            {post.category}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
            {post.date}
          </span>
        </div>
        <h3 className="text-sm font-sans font-semibold leading-snug mb-1.5 group-hover:translate-x-0.5 transition-transform duration-300 line-clamp-2">
          {post.title}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2">
          {(() => { try { const tmp = document.createElement("div"); tmp.innerHTML = post.excerpt; return tmp.textContent || post.excerpt; } catch { return post.excerpt; } })()}
        </p>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.tags.map((tag) => (
              <button
                key={tag}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(tag);
                }}
                className={`text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                  activeTag === tag
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.article>
  );
};

export default ArticleCard;
