import { useState, useRef, useEffect } from "react";
import { AUTH_CODES, SENDER_LABELS, type ChatSender } from "@/types/chat";

interface ChatLoginProps {
  onLogin: (sender: ChatSender) => void;
}

export default function ChatLogin({ onLogin }: ChatLoginProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sender = AUTH_CODES[code];
    if (sender) {
      onLogin(sender);
    } else {
      setError("잘못된 코드입니다");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setCode("");
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0b0e] px-4">
      <form
        onSubmit={handleSubmit}
        className={`w-full max-w-xs bg-[#15171c] border border-[#262a31] rounded-2xl p-8 shadow-2xl transition-transform ${
          shake ? "animate-shake" : ""
        }`}
      >
        <div className="text-center text-4xl mb-4">💬</div>
        <h1 className="text-center text-lg font-bold text-[#e6e9ee] mb-1">
          QA JJ
        </h1>
        <p className="text-center text-xs text-[#7d8590] mb-6">
          인증 코드를 입력하세요
        </p>

        <div className="mb-4">
          <label className="block text-[11px] text-[#8a93a0] mb-1.5">
            인증 코드
          </label>
          <input
            ref={inputRef}
            type="password"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
            placeholder="••••••"
            className="w-full bg-[#1d2128] border border-[#2b303a] rounded-xl text-[#e6e9ee] text-xl text-center tracking-[8px] py-3 px-4 outline-none focus:border-[#5b9a78] transition-colors placeholder:text-[#4a5060]"
          />
        </div>

        {error && (
          <p className="text-center text-xs text-red-400 mb-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={code.length < 6}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-[#5b9a78] text-white hover:bg-[#4d8a6a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          로그인
        </button>

        <p className="text-center text-[10px] text-[#4a5060] mt-4 leading-relaxed">
          코드 하나로 로그인 + 사용자 판별
        </p>
      </form>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}
