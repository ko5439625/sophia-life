import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CORRECT_PIN = "1234"; // TODO: move to env/db

interface PinModalProps {
  open: boolean;
  onClose: () => void;
}

const PinModal = ({ open, onClose }: PinModalProps) => {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const navigate = useNavigate();

  const reset = useCallback(() => {
    setPin("");
    setStatus("idle");
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleDigit = (digit: string) => {
    if (status !== "idle" || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);

    if (next.length === 4) {
      if (next === CORRECT_PIN) {
        setStatus("success");
        setTimeout(() => {
          sessionStorage.setItem("sophia-auth", "true");
          navigate("/dashboard");
          onClose();
        }, 800);
      } else {
        setStatus("error");
        setTimeout(() => {
          setPin("");
          setStatus("idle");
        }, 600);
      }
    }
  };

  const handleDelete = () => {
    if (status !== "idle") return;
    setPin((p) => p.slice(0, -1));
  };

  // Keyboard support
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
      else if (e.key === "Backspace") handleDelete();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const dotColor = status === "success" ? "bg-primary" : status === "error" ? "bg-destructive" : "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end md:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative bg-card rounded-t-2xl md:rounded-2xl w-full max-w-sm p-8 shadow-2xl z-10"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <p className="text-center text-sm text-muted-foreground font-mono mb-8">
              PIN을 입력하세요
            </p>

            {/* Dots */}
            <div
              className={`flex justify-center gap-4 mb-10 ${
                status === "error" ? "animate-shake" : ""
              }`}
            >
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-colors duration-200 ${
                    i < pin.length
                      ? dotColor || "bg-foreground border-foreground"
                      : "border-muted-foreground"
                  }`}
                  animate={
                    i === pin.length - 1 && status === "idle"
                      ? { scale: [1, 1.3, 1] }
                      : {}
                  }
                  transition={{ duration: 0.2 }}
                />
              ))}
            </div>

            {/* Number pad */}
            <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map(
                (key) => {
                  if (key === "")
                    return <div key="empty" />;
                  if (key === "del")
                    return (
                      <button
                        key="del"
                        onClick={handleDelete}
                        className="h-14 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition-all"
                      >
                        <Delete className="h-5 w-5" />
                      </button>
                    );
                  return (
                    <button
                      key={key}
                      onClick={() => handleDigit(key)}
                      className="h-14 rounded-xl text-xl font-mono font-medium hover:bg-muted active:scale-95 transition-all relative overflow-hidden"
                    >
                      {key}
                    </button>
                  );
                }
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PinModal;
