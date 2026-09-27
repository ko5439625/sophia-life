// ---------------------------------------------------------------------------
// Wedding Settlement Types (PRD 7.1 기반, 웹앱 적응)
// ---------------------------------------------------------------------------

export type Payer = "unset" | "ahyun" | "jaejun" | "share";
export type PaymentMethod =
  | "unpaid"
  | "credit-once"
  | "credit-installment"
  | "check"
  | "cash-receipt"
  | "transfer";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "service";
export type VendorCategory =
  | "venue"
  | "studio"
  | "dress"
  | "makeup"
  | "gift"
  | "honeymoon"
  | "other";

export const PAYER_LABELS: Record<Payer, string> = {
  unset: "미정",
  ahyun: "아현",
  jaejun: "재준",
  share: "공동",
};

export const PAYER_COLORS: Record<Payer, string> = {
  unset: "bg-muted text-muted-foreground",
  ahyun: "bg-love/10 text-love",
  jaejun: "bg-foreground/10 text-foreground",
  share: "bg-muted text-foreground",
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  unpaid: "미결제",
  "credit-once": "신용 일시불",
  "credit-installment": "신용 할부",
  check: "체크카드",
  "cash-receipt": "현금영수증",
  transfer: "계좌이체",
};

export const METHOD_COLORS: Record<PaymentMethod, string> = {
  unpaid: "bg-warn/10 text-warn",
  "credit-once": "bg-foreground/10 text-foreground",
  "credit-installment": "bg-foreground/10 text-foreground",
  check: "bg-muted text-foreground",
  "cash-receipt": "bg-muted text-muted-foreground",
  transfer: "bg-muted text-muted-foreground",
};

export const STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "미결제",
  partial: "일부 완납",
  paid: "완납",
  service: "서비스",
};

export const STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: "bg-muted text-muted-foreground",
  partial: "bg-warn/10 text-warn",
  paid: "bg-foreground/10 text-foreground",
  service: "bg-love/10 text-love",
};

export const CATEGORY_LABELS: Record<VendorCategory, string> = {
  venue: "웨딩홀",
  studio: "스튜디오",
  dress: "드레스",
  makeup: "메이크업",
  gift: "예물/예단",
  honeymoon: "허니문",
  other: "기타",
};

export const CATEGORY_EMOJIS: Record<VendorCategory, string> = {
  venue: "\uD83D\uDC92",
  studio: "\uD83D\uDCF8",
  dress: "\uD83D\uDC57",
  makeup: "\uD83D\uDC84",
  gift: "\uD83D\uDC8D",
  honeymoon: "\u2708\uFE0F",
  other: "\uD83D\uDCE6",
};

// ---------------------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------------------

export interface WeddingVendor {
  id: string;
  name: string;
  category: VendorCategory;
  emoji?: string;
  contractDate?: string;
  finalPaymentDate?: string;
  comment?: string;
  vatApplied?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WeddingSettlementItem {
  id: string;
  vendorId: string;
  name: string;
  description?: string;
  unitPrice?: number;
  quantity?: number;
  amount: number;
  payer: Payer;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidDate?: string;
  paidAmount?: number;
  isPrepayment?: boolean;
  order: number;
}

export interface Receipt {
  id: string;
  vendorId: string;
  filename: string;
  /** base64 data URL for web storage */
  dataUrl?: string;
  fileSize: number;
  mimeType: string;
  badgeType?: "contract" | "deposit" | "final" | "extra" | "quote";
  uploadedAt: number;
  aiExtracted?: AIExtractionResult;
}

export interface AIExtractionResult {
  extractedAt: number;
  parsedVendor?: {
    name: string;
    category: VendorCategory;
    emoji?: string;
  };
  parsedItems?: Partial<WeddingSettlementItem>[];
  totalAmount?: number;
  confidence: number;
  model: string;
  userMemo?: string;
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface WeddingSettlementStore {
  vendors: WeddingVendor[];
  items: WeddingSettlementItem[];
  receipts: Receipt[];
}
