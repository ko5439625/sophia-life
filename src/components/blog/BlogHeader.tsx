import { useState, useRef } from "react";
import TypingLogo from "./TypingLogo";
import ThemeToggle from "../ThemeToggle";
import PinModal from "../PinModal";

const BlogHeader = () => {
  const [showPin, setShowPin] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    if (clickCountRef.current >= 5) {
      clickCountRef.current = 0;
      setShowPin(true);
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 3000);
    }
  };

  return (
    <>
      {/* Minimal top bar - theme toggle only */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md transition-colors duration-300">
        <div className="container mx-auto flex items-center justify-end h-12 px-4 md:px-8">
          <ThemeToggle />
        </div>
      </header>

      {/* Logo area - centered, below header */}
      <section className="container mx-auto px-4 md:px-8 pt-8 pb-4 md:pt-14 md:pb-6">
        <div className="text-center">
          <TypingLogo onLogoClick={handleLogoClick} />
        </div>
      </section>

      <PinModal open={showPin} onClose={() => setShowPin(false)} />
    </>
  );
};

export default BlogHeader;
