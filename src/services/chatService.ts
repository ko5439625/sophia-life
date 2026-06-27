// QA JJ v2 — Chat Service (Supabase)
import { supabase } from "@/lib/supabase";
import type { ChatMessage, ChatSender, ChatNotice } from "@/types/chat";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isReady() {
  return !!supabase;
}

// ---------------------------------------------------------------------------
// Auth — 숫자코드 인증 (세션 기반)
// ---------------------------------------------------------------------------

const CHAT_SESSION_KEY = "qajj-sender";

export function getChatSender(): ChatSender | null {
  const v = localStorage.getItem(CHAT_SESSION_KEY);
  if (v === "degul" || v === "muyo") return v;
  return null;
}

export function setChatSender(sender: ChatSender) {
  localStorage.setItem(CHAT_SESSION_KEY, sender);
}

export function clearChatSession() {
  localStorage.removeItem(CHAT_SESSION_KEY);
}

// ---------------------------------------------------------------------------
// Messages — CRUD
// ---------------------------------------------------------------------------

/** 오늘 메시지 로드 (KST 기준) */
export async function loadTodayMessages(): Promise<ChatMessage[]> {
  if (!isReady() || !supabase) return [];
  try {
    // KST 오늘 시작 시각 계산
    const now = new Date();
    const kstOffset = 9 * 60; // KST = UTC+9
    const kstNow = new Date(now.getTime() + kstOffset * 60 * 1000);
    const kstToday = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
    const utcTodayStart = new Date(kstToday.getTime() - kstOffset * 60 * 1000);

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .gte("created_at", utcTodayStart.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[chatService] loadTodayMessages error:", error);
      return [];
    }
    return (data as ChatMessage[]) || [];
  } catch (err) {
    console.error("[chatService] loadTodayMessages error:", err);
    return [];
  }
}

/** 메시지 전송 */
export async function sendMessage(
  sender: ChatSender,
  text: string,
  kind: "text" | "image" = "text",
  imagePath = ""
): Promise<ChatMessage | null> {
  if (!isReady() || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        sender,
        kind,
        text,
        image_path: imagePath,
      })
      .select()
      .single();

    if (error) {
      console.error("[chatService] sendMessage error:", error);
      return null;
    }
    return data as ChatMessage;
  } catch (err) {
    console.error("[chatService] sendMessage error:", err);
    return null;
  }
}

/** 메시지 수정 */
export async function editMessage(id: string, newText: string): Promise<boolean> {
  if (!isReady() || !supabase) return false;
  try {
    const { error } = await supabase
      .from("chat_messages")
      .update({ text: newText, edited: true })
      .eq("id", id);

    if (error) {
      console.error("[chatService] editMessage error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[chatService] editMessage error:", err);
    return false;
  }
}

/** 메시지 삭제 (soft delete) */
export async function deleteMessage(id: string): Promise<boolean> {
  if (!isReady() || !supabase) return false;
  try {
    const { error } = await supabase
      .from("chat_messages")
      .update({ deleted: true, text: "" })
      .eq("id", id);

    if (error) {
      console.error("[chatService] deleteMessage error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[chatService] deleteMessage error:", err);
    return false;
  }
}

/** 읽음 처리 (상대방 메시지 일괄) */
export async function markAsRead(sender: ChatSender): Promise<void> {
  if (!isReady() || !supabase) return;
  const peer = sender === "degul" ? "muyo" : "degul";
  try {
    await supabase
      .from("chat_messages")
      .update({ read: true })
      .eq("sender", peer)
      .eq("read", false);
  } catch (err) {
    console.error("[chatService] markAsRead error:", err);
  }
}

// ---------------------------------------------------------------------------
// Images — Storage
// ---------------------------------------------------------------------------

/** 이미지 업로드 → Storage path 반환 */
export async function uploadImage(file: File): Promise<string | null> {
  if (!isReady() || !supabase) return null;
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from("chat-images")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("[chatService] uploadImage error:", error);
      return null;
    }
    return path;
  } catch (err) {
    console.error("[chatService] uploadImage error:", err);
    return null;
  }
}

/** Storage path → signed URL (1시간) */
export async function getImageUrl(path: string): Promise<string | null> {
  if (!isReady() || !supabase || !path) return null;
  try {
    const { data, error } = await supabase.storage
      .from("chat-images")
      .createSignedUrl(path, 3600);

    if (error) {
      console.error("[chatService] getImageUrl error:", error);
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    console.error("[chatService] getImageUrl error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Notice — 고정 메모
// ---------------------------------------------------------------------------

export async function loadNotice(): Promise<ChatNotice | null> {
  if (!isReady() || !supabase) return null;
  try {
    const { data } = await supabase
      .from("chat_notice")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    return (data as ChatNotice) || null;
  } catch {
    return null;
  }
}

export async function saveNotice(text: string, updatedBy: ChatSender): Promise<void> {
  if (!isReady() || !supabase) return;
  try {
    // upsert: 한 행만 유지
    const existing = await loadNotice();
    if (existing) {
      await supabase
        .from("chat_notice")
        .update({ text, updated_by: updatedBy, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("chat_notice").insert({ text, updated_by: updatedBy });
    }
  } catch (err) {
    console.error("[chatService] saveNotice error:", err);
  }
}

// ---------------------------------------------------------------------------
// Realtime — 구독
// ---------------------------------------------------------------------------

let realtimeChannel: RealtimeChannel | null = null;

export function subscribeChatRealtime(callbacks: {
  onInsert?: (msg: ChatMessage) => void;
  onUpdate?: (msg: ChatMessage) => void;
  onDelete?: (old: { id: string }) => void;
}): RealtimeChannel | null {
  if (!isReady() || !supabase) return null;

  // 기존 채널 정리
  unsubscribeChatRealtime();

  realtimeChannel = supabase
    .channel("chat-messages-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages" },
      (payload) => {
        callbacks.onInsert?.(payload.new as ChatMessage);
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "chat_messages" },
      (payload) => {
        callbacks.onUpdate?.(payload.new as ChatMessage);
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "chat_messages" },
      (payload) => {
        callbacks.onDelete?.(payload.old as { id: string });
      }
    )
    .subscribe();

  return realtimeChannel;
}

export function unsubscribeChatRealtime() {
  if (realtimeChannel && supabase) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// ---------------------------------------------------------------------------
// Presence & Typing (Broadcast)
// ---------------------------------------------------------------------------

let presenceChannel: RealtimeChannel | null = null;

export function subscribePresence(
  sender: ChatSender,
  callbacks: {
    onPresenceSync?: (online: ChatSender[]) => void;
    onTyping?: (who: ChatSender, isTyping: boolean) => void;
  }
): RealtimeChannel | null {
  if (!isReady() || !supabase) return null;

  unsubscribePresence();

  presenceChannel = supabase
    .channel("chat-presence", {
      config: { presence: { key: sender } },
    })
    .on("presence", { event: "sync" }, () => {
      const state = presenceChannel?.presenceState() || {};
      const online = Object.keys(state) as ChatSender[];
      callbacks.onPresenceSync?.(online);
    })
    .on("broadcast", { event: "typing" }, (payload) => {
      const { who, isTyping } = payload.payload as {
        who: ChatSender;
        isTyping: boolean;
      };
      if (who !== sender) {
        callbacks.onTyping?.(who, isTyping);
      }
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel?.track({ sender, online_at: new Date().toISOString() });
      }
    });

  return presenceChannel;
}

export function broadcastTyping(sender: ChatSender, isTyping: boolean) {
  presenceChannel?.send({
    type: "broadcast",
    event: "typing",
    payload: { who: sender, isTyping },
  });
}

export function unsubscribePresence() {
  if (presenceChannel && supabase) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  }
}
