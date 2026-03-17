import { motion } from "framer-motion";
import { BlogPost } from "@/lib/mockData";
import { useNavigate } from "react-router-dom";

interface ArticleCardProps {
  post: BlogPost;
  index: number;
}

const ArticleCard = ({ post, index }: ArticleCardProps) => {
  const navigate = useNavigate();

  return (
    <motion.article
      className="blog-card bg-card rounded-lg overflow-hidden cursor-pointer group"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1],
      }}
      onClick={() => navigate(`/post/${post.id}`)}
    >
      <div className="aspect-[4/3] overflow-hidden">
        <img
          src={post.image}
          alt={post.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono text-primary uppercase tracking-wider">
            {post.category}
          </span>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {post.date}
          </span>
        </div>
        <h3 className="text-lg font-serif font-semibold leading-snug mb-2 group-hover:translate-x-1 transition-transform duration-300">
          {post.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {post.excerpt}
        </p>
      </div>
    </motion.article>
  );
};

export default ArticleCard;
