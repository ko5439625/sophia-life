import { useState, useRef, useEffect } from "react";
import { MessageCircle } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b] px-4">
      <form
        onSubmit={handleSubmit}
        className={`w-full max-w-xs bg-[#171717] border border-[#2a2a2a] rounded-2xl p-8 shadow-2xl transition-transform ${
          shake ? "animate-shake" : ""
        }`}
      >
        <div className="flex justify-center mb-4 text-[#ededed]"><MessageCircle size={36} strokeWidth={1.5} aria-hidden /></div>
        <h1 className="text-center text-lg font-bold text-[#e9e9e9] mb-1">
          QA JJ
        </h1>
        <p className="text-center text-xs text-[#848484] mb-6">
          인증 코드를 입력하세요
        </p>

        <div className="mb-4">
          <label className="block text-[11px] text-[#929292] mb-1.5">
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
            className="w-full bg-[#212121] border border-[#303030] rounded-xl text-[#e9e9e9] text-xl text-center tracking-[8px] py-3 px-4 outline-none focus:border-[#8f8f8f] transition-colors placeholder:text-[#505050]"
          />
        </div>

        {error && (
          <p className="text-center text-xs text-red-400 mb-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={code.length < 6}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-[#ededed] text-[#0a0a0a] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          로그인
        </button>

        <p className="text-center text-[11px] text-[#505050] mt-4 leading-relaxed">
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
