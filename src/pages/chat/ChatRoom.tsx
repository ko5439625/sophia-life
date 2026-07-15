import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Paperclip,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Check,
  LogOut,
  Image as ImageIcon,
} from "lucide-react";
import type { ChatMessage, ChatSender } from "@/types/chat";
import { SENDER_LABELS, SENDER_EMOJI } from "@/types/chat";
import {
  loadTodayMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead,
  uploadImage,
  getImageUrl,
  subscribeChatRealtime,
  unsubscribeChatRealtime,
  subscribePresence,
  broadcastTyping,
  unsubscribePresence,
  clearChatSession,
  purgeOldMessages,
  startMidnightPurgeScheduler,
} from "@/services/chatService";

interface ChatRoomProps {
  sender: ChatSender;
  onLogout: () => void;
}

export default function ChatRoom({ sender, onLogout }: ChatRoomProps) {
  const peer: ChatSender = sender === "degul" ? "muyo" : "degul";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 스크롤 맨 아래로
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    });
  }, []);

  // 초기 메시지 로드 (전날 메시지 삭제 후 오늘 메시지 로드)
  useEffect(() => {
    purgeOldMessages().then(() =>
      loadTodayMessages().then((msgs) => {
        setMessages(msgs);
        scrollToBottom();
        markAsRead(sender);
      })
    );
  }, [sender, scrollToBottom]);

  // 탭 복귀 시 메시지 재로드 (웹-데스크탑 동기화 보완)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        purgeOldMessages().then(() =>
          loadTodayMessages().then((msgs) => {
            setMessages(msgs);
            scrollToBottom();
            markAsRead(sender);
          })
        );
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [sender, scrollToBottom]);

  // KST 자정 자동 삭제 스케줄러
  useEffect(() => {
    const cleanup = startMidnightPurgeScheduler(() => {
      // 자정이 되면 메시지 목록 비우고 오늘 메시지 새로 로드
      loadTodayMessages().then((msgs) => {
        setMessages(msgs);
        scrollToBottom();
      });
    });
    return cleanup;
  }, [scrollToBottom]);

  // 이미지 URL 해석
  useEffect(() => {
    const resolveImages = async () => {
      const updated = await Promise.all(
        messages.map(async (m) => {
          if (m.kind === "image" && m.image_path && !m.image_url) {
            const url = await getImageUrl(m.image_path);
            return { ...m, image_url: url || undefined };
          }
          return m;
        })
      );
      // 변경이 있을 때만 setState
      const changed = updated.some((m, i) => m.image_url !== messages[i].image_url);
      if (changed) setMessages(updated);
    };
    resolveImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Realtime 구독
  useEffect(() => {
    subscribeChatRealtime({
      onInsert: (msg) => {
        setMessages((prev) => {
          // 중복 방지
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
        // 상대 메시지면 읽음 처리
        if (msg.sender !== sender) {
          markAsRead(sender);
        }
      },
      onUpdate: (msg) => {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...msg, image_url: m.image_url } : m)));
      },
      onDelete: (old) => {
        setMessages((prev) => prev.filter((m) => m.id !== old.id));
      },
      onReconnect: () => {
        // 재연결 시 누락 메시지 보정
        loadTodayMessages().then((msgs) => {
          setMessages(msgs);
          scrollToBottom();
          markAsRead(sender);
        });
      },
    });

    return () => unsubscribeChatRealtime();
  }, [sender, scrollToBottom]);

  // Presence 구독
  useEffect(() => {
    subscribePresence(sender, {
      onPresenceSync: (online) => {
        setPeerOnline(online.includes(peer));
      },
      onTyping: (_who, isTyping) => {
        setPeerTyping(isTyping);
        if (isTyping) scrollToBottom();
      },
    });

    return () => unsubscribePresence();
  }, [sender, peer, scrollToBottom]);

  // 메시지 전송
  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    broadcastTyping(sender, false);
    await sendMessage(sender, text, "text");
    scrollToBottom();
    inputRef.current?.focus();
  };

  // 타이핑 인디케이터
  const handleInputChange = (value: string) => {
    setInput(value);
    broadcastTyping(sender, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => broadcastTyping(sender, false), 1500);
  };

  // 이미지 전송
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const path = await uploadImage(file);
      if (path) {
        await sendMessage(sender, "", "image", path);
        scrollToBottom();
      }
    } finally {
      setUploading(false);
    }
  };

  // Ctrl+V 이미지 붙여넣기
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleImageUpload(file);
        return;
      }
    }
  };

  // 수정 시작
  const startEdit = (msg: ChatMessage) => {
    setEditingId(msg.id);
    setEditText(msg.text);
    setMenuId(null);
  };

  // 수정 완료
  const confirmEdit = async () => {
    if (!editingId || !editText.trim()) return;
    await editMessage(editingId, editText.trim());
    setEditingId(null);
    setEditText("");
  };

  // 삭제
  const handleDelete = async (id: string) => {
    setMenuId(null);
    await deleteMessage(id);
  };

  // 시간 포맷
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // 로그아웃
  const handleLogout = () => {
    clearChatSession();
    onLogout();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0b0e] px-4 py-6">
      <div className="w-full max-w-md h-[calc(100vh-48px)] max-h-[700px] rounded-2xl overflow-hidden bg-[#15171c] border border-[#262a31] shadow-2xl flex flex-col">
        {/* 설치 배너 */}
        <div className="flex-shrink-0 flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#2c4a3a] to-[#27407a] text-[#dff0e8] text-xs font-semibold py-2 cursor-pointer hover:brightness-110 transition">
          💻 데스크탑 앱 설치 <span className="opacity-60">v2</span>
        </div>

        {/* 헤더 */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#211f2b] to-[#1a1d24] border-b border-[#2a2e36]">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#e9a8b8] to-[#c98aa6] flex items-center justify-center text-lg">
            {SENDER_EMOJI[peer]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-[#e6e9ee]">
              {SENDER_LABELS[peer]}
            </div>
            <div className="text-[10px] text-[#7d8590]">
              {peerTyping
                ? "입력 중..."
                : peerOnline
                  ? "온라인"
                  : "오프라인"}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {peerOnline && (
              <span className="w-2 h-2 rounded-full bg-[#5b9a78] shadow-[0_0_6px_#5b9a78]" />
            )}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-[#7d8590] hover:text-[#e6e9ee] hover:bg-[#262b33] transition"
              title="로그아웃"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* 메시지 로그 */}
        <div
          ref={logRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 scroll-smooth"
          onClick={() => setMenuId(null)}
        >
          {/* 오늘 구분선 */}
          <div className="text-center text-[10px] text-[#5d646e] py-2">
            ── 오늘 ──
          </div>

          {messages.map((msg) => {
            const isMe = msg.sender === sender;
            const isEditing = editingId === msg.id;

            if (msg.deleted) {
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div className="text-[11px] text-[#5d646e] italic py-1 px-2">
                    삭제된 메시지
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-1.5 ${
                  isMe ? "flex-row-reverse" : ""
                } max-w-[80%] ${isMe ? "ml-auto" : "mr-auto"}`}
              >
                {/* 말풍선 */}
                <div className="relative group">
                  {isEditing ? (
                    <div className="flex items-center gap-1 bg-[#1d2128] border border-[#5b9a78] rounded-xl px-3 py-2">
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="bg-transparent text-[13px] text-[#e6e9ee] outline-none w-full"
                        autoFocus
                      />
                      <button
                        onClick={confirmEdit}
                        className="text-[#5b9a78] hover:text-[#7dc4a0]"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-[#7d8590] hover:text-[#e6e9ee]"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${
                        isMe
                          ? "bg-[#3a5e8c] text-white rounded-br-md"
                          : "bg-[#22262e] text-[#dfe4ea] rounded-bl-md"
                      }`}
                    >
                      {msg.kind === "image" ? (
                        msg.image_url ? (
                          <img
                            src={msg.image_url}
                            alt="사진"
                            className="max-w-[200px] rounded-lg cursor-pointer"
                            onClick={() => setImagePreview(msg.image_url!)}
                          />
                        ) : (
                          <span className="text-xs text-[#9aa7b8] border border-dashed border-[#4a5159] rounded px-2 py-1">
                            📷 [사진]
                          </span>
                        )
                      ) : (
                        <span className="whitespace-pre-wrap break-words">
                          {msg.text}
                        </span>
                      )}

                      <span
                        className={`block text-[9.5px] mt-1 ${
                          isMe
                            ? "text-right text-white/40"
                            : "text-right text-[#6b7280]"
                        }`}
                      >
                        {msg.edited && "(수정됨) "}
                        {formatTime(msg.created_at)}
                        {isMe && (
                          <span className="ml-1">
                            {msg.read ? (
                              <span className="text-[#6b727c]">읽음</span>
                            ) : (
                              <span className="text-[#d3b14a]">1</span>
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* 메뉴 (본인 메시지) */}
                  {isMe && !isEditing && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuId(menuId === msg.id ? null : msg.id);
                        }}
                        className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[#7d8590] hover:text-[#e6e9ee] transition-opacity"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {menuId === msg.id && (
                        <div className="absolute -left-24 top-0 bg-[#1d2128] border border-[#2b303a] rounded-lg shadow-xl z-10 overflow-hidden">
                          {msg.kind === "text" && (
                            <button
                              onClick={() => startEdit(msg)}
                              className="flex items-center gap-2 px-3 py-2 text-xs text-[#c7ccd4] hover:bg-[#262b33] w-full"
                            >
                              <Pencil size={12} /> 수정
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(msg.id)}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-[#262b33] w-full"
                          >
                            <Trash2 size={12} /> 삭제
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* 타이핑 인디케이터 */}
          {peerTyping && (
            <div className="flex items-center gap-2 text-[11px] text-[#7d8590] italic pl-1">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7d8590] animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#7d8590] animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#7d8590] animate-bounce [animation-delay:300ms]" />
              </span>
              {SENDER_LABELS[peer]}님이 입력 중...
            </div>
          )}
        </div>

        {/* 입력창 */}
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-3 border-t border-[#262a31] bg-[#13151a]">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="p-1.5 text-[#7d8590] hover:text-[#aab3bf] transition disabled:opacity-40"
            title="이미지 첨부"
          >
            {uploading ? (
              <span className="w-5 h-5 border-2 border-[#7d8590] border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <Paperclip size={18} />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = "";
            }}
          />

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="메시지 입력... (Ctrl+V 이미지)"
            className="flex-1 bg-[#1d2128] border border-[#2b303a] rounded-full text-[#e6e9ee] text-sm py-2.5 px-4 outline-none focus:border-[#5b9a78] transition-colors placeholder:text-[#4a5060]"
          />

          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-9 h-9 rounded-full bg-[#5b9a78] text-white flex items-center justify-center hover:bg-[#4d8a6a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* 이미지 프리뷰 모달 */}
      {imagePreview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setImagePreview(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white"
            onClick={() => setImagePreview(null)}
          >
            <X size={24} />
          </button>
          <img
            src={imagePreview}
            alt="미리보기"
            className="max-w-full max-h-[90vh] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
