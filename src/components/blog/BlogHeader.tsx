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
    
    if (clickCountRef.current >= 10) {
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
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm transition-colors duration-300">
        <div className="container mx-auto flex items-center justify-between h-16 px-4 md:px-8">
          <TypingLogo onLogoClick={handleLogoClick} />
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Archive</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</a>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <PinModal open={showPin} onClose={() => setShowPin(false)} />
    </>
  );
};

export default BlogHeader;
