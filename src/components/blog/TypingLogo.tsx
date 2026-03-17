import { motion } from "framer-motion";

interface TypingLogoProps {
  onLogoClick?: () => void;
}

const logoText = "sophia.life";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.3 },
  },
};

const child = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 12, stiffness: 100 },
  },
};

const TypingLogo = ({ onLogoClick }: TypingLogoProps) => {
  return (
    <motion.span
      className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-navy dark:text-foreground cursor-pointer select-none"
      variants={container}
      initial="hidden"
      animate="visible"
      onClick={onLogoClick}
    >
      {logoText.split("").map((char, i) => (
        <motion.span key={i} variants={child} className="inline-block">
          {char === "." ? <span className="text-primary">.</span> : char}
        </motion.span>
      ))}
      <motion.span
        className="inline-block typing-cursor text-primary ml-0.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.8, repeat: 4, delay: 1.2 }}
      >
        _
      </motion.span>
    </motion.span>
  );
};

export default TypingLogo;
