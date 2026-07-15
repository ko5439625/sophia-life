import { useState, useRef } from "react";
import { motion } from "framer-motion";
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

      {/* Blog header */}
      <section className="container mx-auto px-4 md:px-8 pt-6 pb-2 md:pt-10 md:pb-4">
        <div className="flex flex-col items-center">
          {/* sophia + heart + .life layout */}
          <motion.div
            className="flex items-center justify-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3, type: "spring", stiffness: 200 }}
          >
            {/* sophia - left */}
            <span
              onClick={handleLogoClick}
              className="font-serif text-4xl md:text-6xl font-bold tracking-tighter text-foreground cursor-pointer select-none leading-none"
              style={{ fontFamily: "'Newsreader', serif", letterSpacing: "-2px" }}
            >
              sophia
            </span>

            {/* Heart video area - main visual */}
            <div className="relative w-44 h-36 md:w-56 md:h-44 mx-2 md:mx-3 flex-shrink-0">
              {videoLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-pink-300" />
                </div>
              )}
              <svg width="0" height="0" className="absolute">
                <defs>
                  <clipPath id="heart-clip" clipPathUnits="objectBoundingBox">
                    <path d="M0.5,0.222 C0.4375,0.044,0.2,0.011,0.125,0.233 C0.033,0.5,0.208,0.722,0.5,0.956 C0.792,0.722,0.967,0.5,0.875,0.233 C0.8,0.011,0.5625,0.044,0.5,0.222 Z" />
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
                style={{ background: "transparent", clipPath: "url(#heart-clip)" }}
              />
              <svg
                viewBox="0 0 240 180"
                className="absolute inset-0 w-full h-full pointer-events-none"
                fill="none"
              >
                <path
                  d="M120,40 C105,8 48,2 30,42 C8,90 50,130 120,172 C190,130 232,90 210,42 C192,2 135,8 120,40 Z"
                  stroke="#f9a8d4"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity="0.8"
                  style={{ filter: "url(#sketchy)" }}
                />
                <path
                  d="M120,42 C106,10 50,4 32,43 C10,91 51,131 120,171 C189,131 230,91 208,43 C190,4 134,10 120,42 Z"
                  stroke="#f9a8d4"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeOpacity="0.4"
                  strokeDasharray="4 2 8 3 6 2"
                />
                <defs>
                  <filter id="sketchy">
                    <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="3" result="noise" seed="2" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
                  </filter>
                </defs>
              </svg>
            </div>

            {/* .life - right */}
            <span
              className="font-mono text-xl md:text-2xl font-normal self-end mb-2 md:mb-3 select-none"
              style={{ color: "#e8a0bf", letterSpacing: "3px" }}
            >
              .life
            </span>
          </motion.div>
        </div>
      </section>

      <PinModal open={showPin} onClose={() => setShowPin(false)} />
    </>
  );
};

export default BlogHeader;
