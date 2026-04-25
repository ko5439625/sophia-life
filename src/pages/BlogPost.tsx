import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { BlogPost as BlogPostType } from "@/lib/mockData";
import { loadPosts, togglePostLike, getPostLikeCount, hasVisitorLiked } from "@/services/supabaseSync";

const BlogPost = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPostType | undefined>(undefined);
  const [currentImg, setCurrentImg] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeAnimating, setLikeAnimating] = useState(false);

  useEffect(() => {
    loadPosts().then((rows) => {
      const found = rows.find((r) => r.id === id);
      if (found) {
        setPost({
          id: found.id,
          title: found.title,
          excerpt: found.content.slice(0, 100),
          content: found.content,
          category: found.category,
          images: found.images || [],
          tags: found.tags || [],
          date: found.created_at?.slice(0, 10) || "",
          isPublic: found.is_public,
        });
      }
    });
  }, [id]);

  // Load like state
  useEffect(() => {
    if (!id) return;
    getPostLikeCount(id).then(setLikeCount);
    hasVisitorLiked(id).then(setLiked);
  }, [id]);

  const handleLike = useCallback(async () => {
    if (!id) return;
    setLikeAnimating(true);
    // Optimistic update
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? Math.max(0, prev - 1) : prev + 1));

    const result = await togglePostLike(id);
    setLiked(result.liked);
    setLikeCount(result.count);

    setTimeout(() => setLikeAnimating(false), 600);
  }, [id, liked]);

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">글을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const hasMultipleImages = post.images.length > 1;

  return (
    <motion.div
      className="min-h-screen bg-background transition-colors duration-300"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto flex items-center justify-between h-14 px-4 md:px-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            돌아가기
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <article className="container mx-auto px-4 md:px-8 max-w-3xl py-10">
        <div className="mb-4">
          <span className="text-xs font-mono text-primary uppercase tracking-widest">
            {post.category}
          </span>
          <span className="text-xs text-muted-foreground font-mono tabular-nums ml-3">
            {post.date}
          </span>
        </div>

        <h1 className="text-3xl md:text-5xl font-sans font-bold leading-tight mb-4">
          {post.title}
        </h1>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-8">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Image gallery - only show if images array has valid URLs */}
        {post.images.length > 0 && post.images[0] && !post.images[0].startsWith("blob:") && (
          <>
            <div className="rounded-lg overflow-hidden mb-10 relative">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImg}
                  src={post.images[currentImg]}
                  alt={`${post.title} - ${currentImg + 1}`}
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
                    onClick={() => setCurrentImg((prev) => (prev === 0 ? post.images.length - 1 : prev - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setCurrentImg((prev) => (prev === post.images.length - 1 ? 0 : prev + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {post.images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentImg(i)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          i === currentImg ? "bg-white" : "bg-white/40"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <div
          className="blog-content max-w-none font-sans leading-relaxed text-foreground"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Like button */}
        <div className="flex items-center justify-center py-10 border-t border-border mt-10">
          <button
            onClick={handleLike}
            className="flex flex-col items-center gap-2 group"
          >
            <motion.div
              animate={likeAnimating ? { scale: [1, 1.3, 0.9, 1.1, 1] } : {}}
              transition={{ duration: 0.5 }}
            >
              <Heart
                className={`h-8 w-8 transition-colors duration-300 ${
                  liked
                    ? "fill-red-500 text-red-500"
                    : "text-muted-foreground group-hover:text-red-400"
                }`}
              />
            </motion.div>
            <span className={`text-sm font-mono tabular-nums transition-colors ${
              liked ? "text-red-500" : "text-muted-foreground"
            }`}>
              {likeCount}
            </span>
          </button>
        </div>

        {/* Scoped styles for blog content: preserve inline styles while providing baseline formatting */}
        <style>{`
          .blog-content {
            line-height: 1.8;
            font-size: 16px;
          }
          .blog-content h1 { font-size: 2em; font-weight: 700; margin: 1em 0 0.5em; }
          .blog-content h2 { font-size: 1.5em; font-weight: 700; margin: 1em 0 0.5em; }
          .blog-content h3 { font-size: 1.25em; font-weight: 600; margin: 0.8em 0 0.4em; }
          .blog-content p { margin: 0.5em 0; }
          .blog-content img { border-radius: 8px; margin: 8px 0; max-width: 100%; }
          .blog-content ul, .blog-content ol { padding-left: 1.5em; margin: 0.5em 0; }
          .blog-content li { margin: 0.25em 0; }
          .blog-content blockquote {
            border-left: 4px solid hsl(var(--primary) / 0.4);
            background: hsl(var(--muted) / 0.3);
            padding: 12px 20px;
            margin: 16px 0;
            border-radius: 0 8px 8px 0;
            font-style: italic;
            color: hsl(var(--muted-foreground));
          }
          .blog-content blockquote p { margin: 0; }
          .blog-content a { color: hsl(var(--primary)); text-decoration: underline; }
          .blog-content hr { border-color: hsl(var(--border)); margin: 1.5em 0; }
          .blog-content strike, .blog-content s, .blog-content del { text-decoration: line-through; }
          .blog-content code {
            background: hsl(var(--muted));
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.9em;
          }
          .blog-content pre {
            background: hsl(var(--muted));
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1em 0;
          }
          /* Preserve inline styles: font[color] from execCommand('foreColor') */
          .blog-content font[color] { color: attr(color) !important; }
          /* Preserve inline font-size and font-family from span[style] */
          .blog-content span[style],
          .blog-content font[style] {
            /* inline styles take priority automatically */
          }
          /* Toggle (details/summary) - Confluence-like collapse */
          .blog-content details {
            border: 1px solid hsl(var(--border));
            border-radius: 8px;
            margin: 12px 0;
            overflow: hidden;
          }
          .blog-content details summary {
            padding: 12px 16px;
            font-weight: 600;
            cursor: pointer;
            background: hsl(var(--muted) / 0.3);
            user-select: none;
            list-style: none;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .blog-content details summary::-webkit-details-marker { display: none; }
          .blog-content details summary::before {
            content: "";
            display: inline-block;
            width: 0;
            height: 0;
            border-left: 6px solid currentColor;
            border-top: 5px solid transparent;
            border-bottom: 5px solid transparent;
            transition: transform 0.2s ease;
            flex-shrink: 0;
          }
          .blog-content details[open] summary::before {
            transform: rotate(90deg);
          }
          .blog-content details summary:hover {
            background: hsl(var(--muted) / 0.5);
          }
          .blog-content details > *:not(summary) {
            padding: 0 16px;
          }
          .blog-content details > p,
          .blog-content details > div {
            padding: 12px 16px;
          }
          /* HR styling */
          .blog-content hr {
            border: none;
            border-top: 1px solid hsl(var(--border));
            margin: 1.5em 0;
          }
          /*
           * Dark/Light mode inline color fix:
           * Blog posts written in dark mode may have inline color: white/rgb(255,255,255)
           * which becomes invisible on a white background (and vice versa).
           * We strip near-white colors in light mode and near-black in dark mode
           * for elements that only have "default-ish" text colors (not intentional colored text).
           */
          :root:not(.dark) .blog-content font[color="#ffffff"],
          :root:not(.dark) .blog-content font[color="#FFFFFF"],
          :root:not(.dark) .blog-content font[color="white"],
          :root:not(.dark) .blog-content font[color="#fafafa"],
          :root:not(.dark) .blog-content font[color="#f5f5f5"],
          :root:not(.dark) .blog-content font[color="#eeeeee"],
          :root:not(.dark) .blog-content font[color="#e5e5e5"],
          :root:not(.dark) .blog-content font[color="#d4d4d4"],
          :root:not(.dark) .blog-content font[color="#e2e8f0"],
          :root:not(.dark) .blog-content font[color="#f1f5f9"],
          :root:not(.dark) .blog-content font[color="#f8fafc"] {
            color: inherit !important;
          }
          .dark .blog-content font[color="#000000"],
          .dark .blog-content font[color="#000"],
          .dark .blog-content font[color="black"],
          .dark .blog-content font[color="#0a0a0a"],
          .dark .blog-content font[color="#171717"],
          .dark .blog-content font[color="#1a1a1a"],
          .dark .blog-content font[color="#262626"],
          .dark .blog-content font[color="#333333"],
          .dark .blog-content font[color="#1e293b"],
          .dark .blog-content font[color="#0f172a"],
          .dark .blog-content font[color="#020617"] {
            color: inherit !important;
          }
          /* Also handle span[style] with inline color */
          :root:not(.dark) .blog-content span[style*="color: white"],
          :root:not(.dark) .blog-content span[style*="color: rgb(255, 255, 255)"],
          :root:not(.dark) .blog-content span[style*="color: rgb(255,255,255)"],
          :root:not(.dark) .blog-content span[style*="color:#ffffff"],
          :root:not(.dark) .blog-content span[style*="color:#FFFFFF"],
          :root:not(.dark) .blog-content span[style*="color: #ffffff"],
          :root:not(.dark) .blog-content span[style*="color: #FFFFFF"],
          :root:not(.dark) .blog-content span[style*="color:#fafafa"],
          :root:not(.dark) .blog-content span[style*="color: #fafafa"],
          :root:not(.dark) .blog-content span[style*="color:#f5f5f5"],
          :root:not(.dark) .blog-content span[style*="color: #f5f5f5"],
          :root:not(.dark) .blog-content span[style*="color: rgb(250, 250, 250)"],
          :root:not(.dark) .blog-content span[style*="color: rgb(245, 245, 245)"],
          :root:not(.dark) .blog-content span[style*="color: rgb(229, 229, 229)"],
          :root:not(.dark) .blog-content span[style*="color: rgb(212, 212, 212)"] {
            color: inherit !important;
          }
          .dark .blog-content span[style*="color: black"],
          .dark .blog-content span[style*="color: rgb(0, 0, 0)"],
          .dark .blog-content span[style*="color: rgb(0,0,0)"],
          .dark .blog-content span[style*="color:#000000"],
          .dark .blog-content span[style*="color: #000000"],
          .dark .blog-content span[style*="color:#000"],
          .dark .blog-content span[style*="color: #000"],
          .dark .blog-content span[style*="color: rgb(10, 10, 10)"],
          .dark .blog-content span[style*="color: rgb(23, 23, 23)"],
          .dark .blog-content span[style*="color: rgb(26, 26, 26)"],
          .dark .blog-content span[style*="color: rgb(38, 38, 38)"],
          .dark .blog-content span[style*="color: rgb(51, 51, 51)"] {
            color: inherit !important;
          }
        `}</style>
      </article>
    </motion.div>
  );
};

export default BlogPost;
