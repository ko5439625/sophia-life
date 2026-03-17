import { motion } from "framer-motion";
import { BlogPost } from "@/lib/mockData";
import { useNavigate } from "react-router-dom";

interface HeroSectionProps {
  post: BlogPost;
}

const HeroSection = ({ post }: HeroSectionProps) => {
  const navigate = useNavigate();

  return (
    <motion.section
      className="container mx-auto px-4 md:px-8 py-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className="relative rounded-lg overflow-hidden cursor-pointer group"
        onClick={() => navigate(`/post/${post.id}`)}
      >
        <div className="aspect-[21/9] overflow-hidden">
          <img
            src={post.image}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <span className="inline-block text-xs font-mono uppercase tracking-widest text-primary-foreground/80 mb-2">
            {post.category}
          </span>
          <h1 className="text-2xl md:text-4xl font-serif font-bold text-primary-foreground mb-2 leading-tight">
            {post.title}
          </h1>
          <p className="text-sm text-primary-foreground/70 font-mono tabular-nums">
            {post.date}
          </p>
        </div>
      </div>
    </motion.section>
  );
};

export default HeroSection;
