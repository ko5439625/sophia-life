import { motion } from "framer-motion";

const BlogFooter = () => (
  <motion.footer
    className="border-t border-border py-8 text-center"
    initial={{ opacity: 0 }}
    whileInView={{ opacity: 1 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6 }}
  >
    <p className="text-sm text-muted-foreground font-mono">
      Sophia.life <span className="text-primary">♡</span> made with love
    </p>
  </motion.footer>
);

export default BlogFooter;
