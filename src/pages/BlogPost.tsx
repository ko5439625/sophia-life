import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { BlogPost as BlogPostType } from "@/lib/mockData";
import { loadPosts } from "@/services/supabaseSync";

const BlogPost = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPostType | undefined>(undefined);
  const [currentImg, setCurrentImg] = useState(0);

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
          className="prose prose-lg dark:prose-invert max-w-none font-sans leading-relaxed text-foreground [&_img]:rounded-lg [&_img]:my-4"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>
    </motion.div>
  );
};

export default BlogPost;
