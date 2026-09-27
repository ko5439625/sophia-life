// 스마트 인박스 UI 공용 상수/포맷터
import type { InboxItem } from "@/services/smartInboxApi";

export const TYPE_STYLE: Record<InboxItem["type"], string> = {
  expense: "bg-foreground/10 text-foreground",
  todo: "bg-muted text-foreground",
  event: "bg-transparent text-foreground ring-1 ring-inset ring-border",
  memo: "bg-muted text-muted-foreground",
  wedding: "bg-love/10 text-love",
};

/** 카드 한 줄 요약 (제외된 카드, 최종 확인 목록에서 사용) */
export function summarizeItem(item: InboxItem): string {
  switch (item.type) {
    case "expense":
      return `${item.amount ? item.amount.toLocaleString("ko-KR") + "원" : "금액 ?"} · ${item.category || "카테고리 ?"}${item.memo ? " · " + item.memo : ""} · ${item.date}`;
    case "todo":
      return `${item.title}${item.date ? " · " + item.date : " · 기한 없음"}`;
    case "event":
      return `${item.emoji} ${item.title} · ${item.date ?? "날짜 ?"}${item.time ? " " + item.time : ""}${item.endDate ? " ~ " + item.endDate : ""}`;
    case "memo":
      return item.text;
    case "wedding":
      return `${item.title} · ${item.category}`;
  }
}

