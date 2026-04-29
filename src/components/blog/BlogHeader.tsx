import { useState, useRef } from "react";
import { motion } from "framer-motion";
import TypingLogo from "./TypingLogo";
import ThemeToggle from "../ThemeToggle";
import PinModal from "../PinModal";
import { Loader2 } from "lucide-react";

const BlogHeader = () => {
  const [showPin, setShowPin] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
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

      {/* Video + Logo area - centered, below header */}
      <section className="container mx-auto px-4 md:px-8 pt-6 pb-2 md:pt-10 md:pb-4">
        <div className="flex flex-col items-center gap-2">
          {/* Welcome Video - heart shaped with hand-drawn border */}
          <motion.div
            className="relative w-60 h-44 md:w-72 md:h-56"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3, type: "spring", stiffness: 200 }}
          >
            {videoLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-primary/50" />
              </div>
            )}
            {/* SVG clip definition for wider heart shape */}
            <svg width="0" height="0" className="absolute">
              <defs>
                <clipPath id="heart-clip" clipPathUnits="objectBoundingBox">
                  <path d="M0.5,0.22 C0.35,-0.06,0.02,0.05,0.02,0.36 C0.02,0.65,0.5,0.98,0.5,0.98 C0.5,0.98,0.98,0.65,0.98,0.36 C0.98,0.05,0.65,-0.06,0.5,0.22 Z" />
                </clipPath>
              </defs>
            </svg>
            <video
              src="/welcome-video.mp4"
              autoPlay
              loop
              muted
              playsInline
              onCanPlay={() => setVideoLoading(false)}
              className={`w-full h-full object-cover ${videoLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-500`}
              style={{
                background: "transparent",
                clipPath: "url(#heart-clip)",
              }}
            />
            {/* Hand-drawn heart border overlay */}
            <svg
              viewBox="0 0 240 180"
              className="absolute inset-0 w-full h-full pointer-events-none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M120,40 C105,8 48,2 30,42 C8,90 50,130 120,172 C190,130 232,90 210,42 C192,2 135,8 120,40 Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary/40"
                style={{
                  filter: "url(#sketchy)",
                }}
              />
              {/* Second slightly offset line for hand-drawn feel */}
              <path
                d="M120,42 C106,12 52,4 33,44 C12,92 52,132 120,170 C188,132 228,92 207,44 C188,4 134,12 120,42 Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary/25"
                strokeDasharray="4 2 8 3 6 2"
              />
              {/* Third wispy line for organic feel */}
              <path
                d="M120,38 C103,6 45,0 28,40 C5,88 48,128 120,174 C192,128 235,88 212,40 C195,0 137,6 120,38 Z"
                stroke="currentColor"
                strokeWidth="0.8"
                strokeLinecap="round"
                className="text-primary/15"
                strokeDasharray="3 4 7 2"
              />
              <defs>
                <filter id="sketchy">
                  <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="3" result="noise" seed="2" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </defs>
            </svg>
          </motion.div>
          <TypingLogo onLogoClick={handleLogoClick} />
        </div>
      </section>

      <PinModal open={showPin} onClose={() => setShowPin(false)} />
    </>
  );
};

export default BlogHeader;
