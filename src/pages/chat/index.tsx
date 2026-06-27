import { useState, useEffect } from "react";
import type { ChatSender } from "@/types/chat";
import { getChatSender, setChatSender } from "@/services/chatService";
import ChatLogin from "./ChatLogin";
import ChatRoom from "./ChatRoom";

export default function ChatPage() {
  const [sender, setSender] = useState<ChatSender | null>(null);
  const [loading, setLoading] = useState(true);

  // 저장된 세션 확인
  useEffect(() => {
    const saved = getChatSender();
    if (saved) setSender(saved);
    setLoading(false);
  }, []);

  const handleLogin = (s: ChatSender) => {
    setChatSender(s);
    setSender(s);
  };

  const handleLogout = () => {
    setSender(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0b0e]">
        <div className="w-6 h-6 border-2 border-[#5b9a78] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!sender) {
    return <ChatLogin onLogin={handleLogin} />;
  }

  return <ChatRoom sender={sender} onLogout={handleLogout} />;
}
