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
  Lock,
  Image as ImageIcon,
  Download,
  Monitor,
  RefreshCw,
  Reply,
  MessageCircle,
} from "lucide-react";
import type { ChatMessage, ChatSender } from "@/types/chat";
import { SENDER_LABELS, SENDER_EMOJI, AUTH_CODES } from "@/types/chat";
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
  getChatSender,
  setChatSender,
  clearChatSession,
  purgeOldMessages,
  startMidnightPurgeScheduler,
  parseReply,
} from "@/services/chatService";

// 데스크탑 앱 다운로드 — 접속한 OS에 맞는 설치 파일 (기존: macOS dmg 고정)
const RELEASE_BASE = "https://github.com/ko5439625/sophia-life/releases/download/qa-jj-v0.3.1";
const IS_WINDOWS = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
const DESKTOP_DOWNLOAD = IS_WINDOWS
  ? `${RELEASE_BASE}/QA.JJ.Setup.0.3.1.exe`
  : `${RELEASE_BASE}/QA.JJ-0.3.1-arm64.dmg`;

// 재조회 결과와 현재 목록 합치기 — 조회 중에 실시간으로 도착한 메시지가 덮어써져
// 사라졌다가 늦게 다시 나타나던 문제 방지 (이미지 signed URL도 유지)
function mergeHistory(prev: ChatMessage[], fetched: ChatMessage[]): ChatMessage[] {
  const urls = new Map(prev.map((m) => [m.id, m.image_url]));
  const ids = new Set(fetched.map((m) => m.id));
  const last = fetched.length ? fetched[fetched.length - 1].created_at : "";
  const arrived = prev.filter((m) => !ids.has(m.id) && m.created_at >= last);
  return [...fetched.map((m) => ({ ...m, image_url: urls.get(m.id) })), ...arrived].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
}

// 답장 인용 미리보기 텍스트
function quoteText(m: ChatMessage): string {
  if (m.deleted) return "삭제된 메시지";
  if (m.kind === "image") return "[사진]";
  return parseReply(m.text).body;
}

// ---------------------------------------------------------------------------
// Login (인라인)
// ---------------------------------------------------------------------------

function ChatLogin({ onLogin }: { onLogin: (s: ChatSender) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

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
    <div className="flex items-center justify-center py-10 sm:py-20 px-4">
      <form
        onSubmit={handleSubmit}
        className={`w-full max-w-xs bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-lg transition-transform ${shake ? "animate-shake" : ""}`}
      >
        <div className="text-center text-4xl mb-4"><Lock className="w-10 h-10 mx-auto text-muted-foreground/40" /></div>
        <h2 className="text-center text-lg font-bold mb-1">QA JJ</h2>
        <p className="text-center text-xs text-muted-foreground mb-6">인증 코드를 입력하세요</p>

        <div className="mb-4">
          <label className="block text-[11px] text-muted-foreground mb-1.5">인증 코드</label>
          <input
            ref={inputRef}
            type="password"
            maxLength={6}
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
            placeholder="••••••"
            className="w-full bg-muted border border-border rounded-xl text-foreground text-xl text-center tracking-[8px] py-3 px-4 outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/30"
          />
        </div>

        {error && <p className="text-center text-xs text-destructive mb-3">{error}</p>}

        <button
          type="submit"
          disabled={code.length < 6}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          로그인
        </button>

        <p className="text-center text-[11px] text-muted-foreground/50 mt-4 leading-relaxed">
          코드 하나로 로그인 + 사용자 판별
        </p>

        <div className="mt-5 pt-4 border-t border-border space-y-2">
          <p className="text-center text-[11px] text-muted-foreground/60 mb-2">데스크탑 앱 다운로드</p>
          <div className="flex gap-2">
            <a
              href="https://github.com/ko5439625/sophia-life/releases/download/qa-jj-v0.3.1/QA.JJ.Setup.0.3.1.exe"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition"
            >
              <Monitor size={13} /> Windows
            </a>
            <a
              href="https://github.com/ko5439625/sophia-life/releases/download/qa-jj-v0.3.1/QA.JJ-0.3.1-arm64.dmg"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition"
            >
              <Monitor size={13} /> macOS
            </a>
          </div>
          <p className="text-center text-[11px] text-muted-foreground/40 mt-1">v0.3.1</p>
        </div>
      </form>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)} 40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)} 80%{transform:translateX(6px)}
        }
        .animate-shake{animation:shake .4s ease-in-out}
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat Room (대시보드 내장)
// ---------------------------------------------------------------------------

function ChatRoom({ sender, onLogout }: { sender: ChatSender; onLogout: () => void }) {
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
  const [refreshing, setRefreshing] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const lastSync = useRef(0);

  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    // 이중 rAF로 DOM 렌더 후 스크롤 보장
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      });
    });
  }, []);

  // 메시지 변경 시 항상 맨 아래로 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // 초기 로드 (전날 메시지 삭제 후 오늘 메시지 로드)
  useEffect(() => {
    purgeOldMessages().then(() =>
      loadTodayMessages().then((msgs) => {
        lastSync.current = Date.now();
        setMessages((prev) => mergeHistory(prev, msgs));
        markAsRead(sender);
      })
    );
  }, [sender]);

  // 탭 복귀 시 메시지 재로드 (웹-데스크탑 동기화 보완)
  // 30초 이내 복귀는 생략 + 기존 image_url 유지 (매번 purge·전체 교체하던 버벅임 제거)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastSync.current < 30_000) return;
      lastSync.current = Date.now();
      loadTodayMessages().then((msgs) => {
        setMessages((prev) => mergeHistory(prev, msgs));
        markAsRead(sender);
      });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [sender]);

  // KST 자정 자동 삭제 스케줄러
  useEffect(() => {
    const cleanup = startMidnightPurgeScheduler(() => {
      loadTodayMessages().then((msgs) => {
        setMessages(msgs);
      });
    });
    return cleanup;
  }, []);

  // 이미지 URL 해석
  useEffect(() => {
    const resolve = async () => {
      const updated = await Promise.all(
        messages.map(async (m) => {
          if (m.kind === "image" && m.image_path && !m.image_url) {
            const url = await getImageUrl(m.image_path);
            return { ...m, image_url: url || undefined };
          }
          return m;
        })
      );
      if (updated.some((m, i) => m.image_url !== messages[i].image_url)) setMessages(updated);
    };
    resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Realtime
  useEffect(() => {
    subscribeChatRealtime({
      onInsert: (msg) => {
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.sender !== sender) markAsRead(sender);
      },
      onUpdate: (msg) => {
        setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...msg, image_url: m.image_url } : m));
      },
      onDelete: (old) => {
        setMessages((prev) => prev.filter((m) => m.id !== old.id));
      },
      onReconnect: () => {
        // 재연결 시 누락 메시지 보정
        loadTodayMessages().then((msgs) => {
          setMessages((prev) => mergeHistory(prev, msgs));
          markAsRead(sender);
        });
      },
    });
    return () => unsubscribeChatRealtime();
  }, [sender]);

  // Presence
  useEffect(() => {
    subscribePresence(sender, {
      onPresenceSync: (online) => setPeerOnline(online.includes(peer)),
      onTyping: (_who, isTyping) => {
        setPeerTyping(isTyping);
        if (isTyping) scrollToBottom();
      },
    });
    return () => unsubscribePresence();
  }, [sender, peer, scrollToBottom]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const msgs = await loadTodayMessages();
      setMessages(msgs);
      markAsRead(sender);
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const target = replyTo;
    setReplyTo(null);
    broadcastTyping(sender, false);
    const sent = await sendMessage(sender, text, "text", "", target?.id);
    // Realtime 에코 기다리지 않고 바로 표시 (onInsert에서 id 중복 제거됨)
    if (sent) setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
    scrollToBottom();
    inputRef.current?.focus();
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    broadcastTyping(sender, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => broadcastTyping(sender, false), 1500);
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const path = await uploadImage(file);
      if (path) {
        const sent = await sendMessage(sender, "", "image", path);
        if (sent) setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
        scrollToBottom();
      }
    } finally { setUploading(false); }
  };

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

  const startEdit = (msg: ChatMessage) => { setEditingId(msg.id); setEditText(parseReply(msg.text).body); setMenuId(null); };
  const confirmEdit = async () => {
    if (!editingId || !editText.trim()) return;
    const orig = messages.find((m) => m.id === editingId);
    await editMessage(editingId, editText.trim(), orig ? parseReply(orig.text).replyTo : undefined);
    setEditingId(null); setEditText("");
  };
  const handleDelete = async (id: string) => { setMenuId(null); await deleteMessage(id); };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  return (
    <div className="space-y-2 sm:space-y-4">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg sm:text-2xl font-bold">채팅</h2>
          <span className="flex items-center gap-1 text-muted-foreground text-xs sm:text-sm">
            {SENDER_EMOJI[sender]} {SENDER_LABELS[sender]}
            <span className="text-muted-foreground/50 hidden sm:inline">로 접속 중</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${peerOnline ? "bg-foreground" : "bg-muted-foreground/30"}`} />
            <span className="text-muted-foreground text-[11px] sm:text-xs">
              {SENDER_LABELS[peer]} {peerTyping ? "입력 중..." : peerOnline ? "온라인" : "오프라인"}
            </span>
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 sm:p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition disabled:opacity-40"
            title="메시지 새로고침"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
          <a
            href={DESKTOP_DOWNLOAD}
            className="p-1 sm:p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition hidden sm:flex"
            title={`데스크탑 앱 다운로드 (${IS_WINDOWS ? "Windows" : "macOS"})`}
          >
            <Download size={15} />
          </a>
          <button onClick={onLogout} className="p-1 sm:p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition" title="채팅 로그아웃">
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className="bg-card border-0 sm:border border-border rounded-none sm:rounded-xl overflow-hidden flex flex-col -mx-3 sm:mx-0" style={{ height: "calc(100dvh - 140px)", minHeight: "320px" }}>
        {/* 메시지 로그 */}
        <div ref={logRef} className="flex-1 overflow-y-auto px-2.5 sm:px-4 py-2 sm:py-3 space-y-1 sm:space-y-1.5 scroll-smooth" onClick={() => setMenuId(null)}>
          <div className="text-center text-[11px] text-muted-foreground/50 py-1 sm:py-2">── 오늘 ──</div>

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
              <MessageCircle className="h-9 w-9 mb-3" strokeWidth={1.5} aria-hidden />
              <span className="text-sm">아직 메시지가 없어요</span>
              <span className="text-xs mt-1">첫 메시지를 보내보세요!</span>
            </div>
          )}

          {messages.map((msg) => {
            const isMe = msg.sender === sender;
            const isEditing = editingId === msg.id;
            const { replyTo: replyId, body } = parseReply(msg.text);
            const quoted = replyId ? messages.find((m) => m.id === replyId) : undefined;

            if (msg.deleted) {
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className="text-[11px] text-muted-foreground/40 italic py-1 px-2">삭제된 메시지</div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex items-end gap-1 sm:gap-1.5 ${isMe ? "flex-row-reverse" : ""} max-w-[88%] sm:max-w-[80%] ${isMe ? "ml-auto" : "mr-auto"}`}>
                <div className="relative group" id={`chat-msg-${msg.id}`} onDoubleClick={() => !isEditing && setReplyTo(msg)}>
                  {replyId && (
                    <button
                      onClick={() => document.getElementById(`chat-msg-${replyId}`)?.scrollIntoView({ block: "center", behavior: "smooth" })}
                      className={`block max-w-[220px] truncate text-[10.5px] text-muted-foreground mb-0.5 px-2 hover:underline ${isMe ? "ml-auto text-right" : "text-left"}`}
                    >
                      ↳ {quoted ? `${SENDER_LABELS[quoted.sender]}: ${quoteText(quoted)}` : "(지워진 메시지)"}
                    </button>
                  )}
                  {isEditing ? (
                    <div className="flex items-center gap-1 bg-muted border border-primary rounded-xl px-3 py-2">
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditingId(null); }}
                        className="bg-transparent text-[13px] text-foreground outline-none w-full"
                        autoFocus
                      />
                      <button onClick={confirmEdit} className="text-primary hover:opacity-70"><Check size={14} /></button>
                      <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-2xl text-[13px] sm:text-[13px] leading-relaxed ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}>
                      {msg.kind === "image" ? (
                        msg.image_url ? (
                          <img src={msg.image_url} alt="사진" className="max-w-[180px] sm:max-w-[200px] rounded-lg cursor-pointer" onClick={() => setImagePreview(msg.image_url!)} />
                        ) : (
                          <span className="text-xs opacity-60 border border-dashed border-current/30 rounded px-2 py-1 inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" aria-hidden /> [사진]</span>
                        )
                      ) : (
                        <span className="whitespace-pre-wrap break-words">{body}</span>
                      )}
                      <span className={`block text-[11px] sm:text-[9.5px] mt-0.5 sm:mt-1 text-right ${isMe ? "opacity-50" : "text-muted-foreground"}`}>
                        {msg.edited && "(수정됨) "}
                        {formatTime(msg.created_at)}
                        {isMe && (
                          <span className="ml-1">
                            {msg.read ? <span className="opacity-60">읽음</span> : <span className="text-warn">1</span>}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {!isEditing && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuId(menuId === msg.id ? null : msg.id); }}
                        className={`absolute ${isMe ? "-left-6" : "-right-6"} top-1/2 -translate-y-1/2 opacity-40 sm:opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity`}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {menuId === msg.id && (
                        <div className={`absolute ${isMe ? "-left-24" : "-right-24"} top-0 bg-popover border border-border rounded-lg shadow-xl z-10 overflow-hidden`}>
                          <button onClick={() => { setReplyTo(msg); setMenuId(null); inputRef.current?.focus(); }} className="flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted w-full">
                            <Reply size={12} /> 답장
                          </button>
                          {isMe && msg.kind === "text" && (
                            <button onClick={() => startEdit(msg)} className="flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted w-full">
                              <Pencil size={12} /> 수정
                            </button>
                          )}
                          {isMe && (
                            <button onClick={() => handleDelete(msg.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-muted w-full">
                              <Trash2 size={12} /> 삭제
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {peerTyping && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground italic pl-1">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
              </span>
              {SENDER_LABELS[peer]}님이 입력 중...
            </div>
          )}
        </div>

        {/* 답장 대상 */}
        {replyTo && (
          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-t border-border bg-muted/50 text-[11px] text-muted-foreground">
            <Reply size={12} className="flex-shrink-0" />
            <span className="flex-1 min-w-0 truncate">{SENDER_LABELS[replyTo.sender]}: {quoteText(replyTo)}</span>
            <button onClick={() => setReplyTo(null)} className="hover:text-foreground"><X size={13} /></button>
          </div>
        )}

        {/* 입력창 */}
        <div className="flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 sm:py-3 border-t border-border bg-card safe-area-bottom">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="p-1 sm:p-1.5 text-muted-foreground hover:text-foreground transition disabled:opacity-40 flex-shrink-0"
            title="이미지 첨부"
          >
            {uploading ? (
              <span className="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <Paperclip size={18} />
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); } }}
            placeholder="메시지 입력..."
            className="flex-1 min-w-0 bg-muted border border-border rounded-full text-foreground text-base sm:text-sm py-2 sm:py-2.5 px-3 sm:px-4 outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/40"
          />

          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      {/* 이미지 프리뷰 모달 */}
      {imagePreview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setImagePreview(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={() => setImagePreview(null)}><X size={24} /></button>
          <img src={imagePreview} alt="미리보기" className="max-w-full max-h-[90vh] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatView (탭 진입점)
// ---------------------------------------------------------------------------

export default function ChatView() {
  const [sender, setSender] = useState<ChatSender | null>(null);
  const [loading, setLoading] = useState(true);

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
    clearChatSession();
    setSender(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!sender) return <ChatLogin onLogin={handleLogin} />;
  return <ChatRoom sender={sender} onLogout={handleLogout} />;
}
