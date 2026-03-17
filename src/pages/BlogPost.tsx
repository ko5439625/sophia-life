import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { mockPosts } from "@/lib/mockData";

const BlogPost = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const post = mockPosts.find((p) => p.id === id);

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">글을 찾을 수 없습니다.</p>
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
        <div className="mb-6">
          <span className="text-xs font-mono text-primary uppercase tracking-widest">
            {post.category}
          </span>
          <span className="text-xs text-muted-foreground font-mono tabular-nums ml-3">
            {post.date}
          </span>
        </div>

        <h1 className="text-3xl md:text-5xl font-serif font-bold leading-tight mb-8">
          {post.title}
        </h1>

        <div className="rounded-lg overflow-hidden mb-10">
          <img
            src={post.image}
            alt={post.title}
            className="w-full object-cover"
          />
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none font-sans leading-relaxed text-foreground">
          <p>{post.excerpt}</p>
          <p className="mt-6 text-muted-foreground">
            {post.content}
          </p>
        </div>
      </article>
    </motion.div>
  );
};

export default BlogPost;
