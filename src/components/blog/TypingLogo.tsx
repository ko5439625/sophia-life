import { useState, useEffect } from "react";

interface TypingLogoProps {
  onLogoClick?: () => void;
}

const logoText = "Sophia.life";

const TypingLogo = ({ onLogoClick }: TypingLogoProps) => {
  const [displayed, setDisplayed] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [doneTyping, setDoneTyping] = useState(false);

  useEffect(() => {
    if (displayed.length < logoText.length) {
      const timeout = setTimeout(() => {
        setDisplayed(logoText.slice(0, displayed.length + 1));
      }, 120);
      return () => clearTimeout(timeout);
    } else {
      setDoneTyping(true);
      // cursor blinks a few times then disappears
      const timeout = setTimeout(() => setShowCursor(false), 2500);
      return () => clearTimeout(timeout);
    }
  }, [displayed]);

  return (
    <span
      className="font-mono text-3xl md:text-4xl font-extrabold tracking-tight text-foreground cursor-pointer select-none"
      onClick={onLogoClick}
    >
      {displayed.split("").map((char, i) => (
        <span key={i} className={char === "." ? "text-primary" : ""}>
          {char}
        </span>
      ))}
      {showCursor && (
        <span className={`text-primary ml-0.5 ${doneTyping ? "animate-pulse" : ""}`}>
          _
        </span>
      )}
    </span>
  );
};

export default TypingLogo;
