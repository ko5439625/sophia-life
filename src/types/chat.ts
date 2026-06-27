// QA JJ v2 — Chat Types

export type ChatSender = "degul" | "muyo";
export type MessageKind = "text" | "image";

export interface ChatMessage {
  id: string;
  sender: ChatSender;
  kind: MessageKind;
  text: string;
  image_path: string;
  edited: boolean;
  deleted: boolean;
  read: boolean;
  created_at: string;
  /** 클라이언트 전용: signed URL (image_path → URL 변환) */
  image_url?: string;
}

export interface ChatNotice {
  id: string;
  text: string;
  updated_by: ChatSender;
  updated_at: string;
}

/** 숫자코드 → 사용자 매핑 */
export const AUTH_CODES: Record<string, ChatSender> = {
  "950520": "degul",
  "930330": "muyo",
};

export const SENDER_LABELS: Record<ChatSender, string> = {
  degul: "데굴",
  muyo: "무요",
};

export const SENDER_EMOJI: Record<ChatSender, string> = {
  degul: "🐱",
  muyo: "🐶",
};
