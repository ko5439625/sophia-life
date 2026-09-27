import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Heart } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { BlogPost as BlogPostType } from "@/lib/mockData";
import { loadPosts, togglePostLike, getPostLikeCount, hasVisitorLiked } from "@/services/supabaseSync";
import BlogPostArticle from "@/components/dashboard/blog/BlogPostArticle";

const BlogPost = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPostType | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
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
      setLoaded(true);
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

  const isOwner =
    sessionStorage.getItem("sophia-auth") === "true" || localStorage.getItem("sophia-device-auth") === "true";
  if (post && post.isPublic === false && !isOwner) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg font-semibold">비공개 글이에요</p>
        <p className="text-sm text-muted-foreground">작성자만 볼 수 있어요.</p>
        <button onClick={() => navigate("/")} className="mt-2 min-h-[44px] px-4 rounded-lg bg-muted text-sm">블로그 홈으로</button>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{loaded ? "글을 찾을 수 없습니다." : "글을 불러오는 중..."}</p>
      </div>
    );
  }

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
            className="flex items-center gap-2 min-h-[40px] -ml-1 px-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            돌아가기
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Content — 에디터 미리보기와 같은 렌더러 사용 */}
      <article className="container mx-auto px-4 md:px-8 max-w-3xl py-8 md:py-10">
        <BlogPostArticle post={post} />

        {/* Like button */}
        <div className="flex items-center justify-center py-10 border-t border-border mt-10">
          <button
            onClick={handleLike}
            aria-label={liked ? "좋아요 취소" : "좋아요"}
            className="min-w-[64px] min-h-[64px] flex flex-col items-center justify-center gap-2 group"
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

      </article>
    </motion.div>
  );
};

export default BlogPost;
