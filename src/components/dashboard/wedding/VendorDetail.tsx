import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Image,
  FileText,
  Calendar,
  MessageSquare,
  X,
  Download,
  ChevronDown,
} from "lucide-react";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import type {
  WeddingVendor,
  WeddingSettlementItem,
  Receipt,
  Payer,
  PaymentMethod,
  PaymentStatus,
  VendorCategory,
} from "./weddingTypes";
import {
  PAYER_LABELS,
  PAYER_COLORS,
  METHOD_LABELS,
  METHOD_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORY_LABELS,
  CATEGORY_EMOJIS,
} from "./weddingTypes";
import type { useWeddingSettlement } from "./useWeddingSettlement";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWon(n: number) {
  if (n === 0) return "-";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}₩${(abs / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${sign}₩${(abs / 10_000).toFixed(abs % 10_000 === 0 ? 0 : 1)}만`;
  return `${sign}₩${abs.toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VendorDetailProps {
  vendor: WeddingVendor;
  items: WeddingSettlementItem[];
  receipts: Receipt[];
  store: ReturnType<typeof useWeddingSettlement>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VendorDetail({
  vendor,
  items,
  receipts,
  store,
}: VendorDetailProps) {
  const [activeTab, setActiveTab] = useState<"detail" | "receipts" | "schedule">(
    "detail"
  );
  const [editingComment, setEditingComment] = useState(false);
  const [commentText, setCommentText] = useState(vendor.comment || "");
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // Derived
  const totalAmount = items
    .filter((i) => !i.isPrepayment && i.paymentStatus !== "service")
    .reduce((s, i) => s + i.amount, 0);
  const paidAmount = items.reduce((s, i) => {
    if (i.paymentStatus === "service") return s;
    if (i.paymentStatus === "paid")
      return s + (i.isPrepayment ? Math.abs(i.amount) : i.amount);
    if (i.paymentStatus === "partial" && i.paidAmount) return s + i.paidAmount;
    return s;
  }, 0);
  const remainingAmount = totalAmount - paidAmount;
  const progressPct =
    totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

  const tabs = [
    { id: "detail" as const, label: "상세 내역", count: items.length },
    { id: "receipts" as const, label: "영수증", count: receipts.length },
    { id: "schedule" as const, label: "일정·메모" },
  ];

  // ---- Add new empty item ----
  const addEmptyItem = () => {
    const newItem: WeddingSettlementItem = {
      id: crypto.randomUUID(),
      vendorId: vendor.id,
      name: "",
      amount: 0,
      payer: "unset",
      paymentMethod: "unpaid",
      paymentStatus: "unpaid",
      isPrepayment: false,
      order: items.length,
    };
    store.addItem(newItem);
  };

  // ---- Save comment ----
  const saveComment = () => {
    store.updateVendor(vendor.id, { comment: commentText });
    setEditingComment(false);
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Vendor Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">
              {vendor.emoji || CATEGORY_EMOJIS[vendor.category]}
            </span>
            <div>
              <h3 className="text-base font-bold">{vendor.name}</h3>
              <p className="text-[11px] text-muted-foreground/60 font-mono">
                {CATEGORY_LABELS[vendor.category]}
                <span className="mx-1.5">·</span>
                합계 {formatWon(totalAmount)}
                <span className="mx-1.5">·</span>
                <span className={remainingAmount > 0 ? "text-amber-500" : "text-emerald-500"}>
                  잔금 {formatWon(remainingAmount)}
                </span>
                <span className="mx-1.5">·</span>
                {progressPct}%
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm(`"${vendor.name}" 업체를 삭제하시겠습니까?\n연결된 항목과 영수증이 모두 삭제됩니다.`))
                store.removeVendor(vendor.id);
            }}
            className="p-1.5 text-muted-foreground/30 hover:text-red-400 rounded transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-muted/30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1 text-[11px] text-muted-foreground/40">
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <motion.div
                layoutId="vendor-tab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-0">
        {activeTab === "detail" && (
          <DetailTab
            items={items}
            store={store}
            vendor={vendor}
            totalAmount={totalAmount}
            onAddItem={addEmptyItem}
          />
        )}

        {activeTab === "receipts" && (
          <ReceiptsTab
            receipts={receipts}
            store={store}
            lightboxImg={lightboxImg}
            setLightboxImg={setLightboxImg}
            vendorId={vendor.id}
          />
        )}

        {activeTab === "schedule" && (
          <ScheduleTab
            vendor={vendor}
            store={store}
            editingComment={editingComment}
            setEditingComment={setEditingComment}
            commentText={commentText}
            setCommentText={setCommentText}
            saveComment={saveComment}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Tab (정산표)
// ---------------------------------------------------------------------------

function DetailTab({
  items,
  store,
  vendor,
  totalAmount,
  onAddItem,
}: {
  items: WeddingSettlementItem[];
  store: ReturnType<typeof useWeddingSettlement>;
  vendor: WeddingVendor;
  totalAmount: number;
  onAddItem: () => void;
}) {
  const isMobile = useIsMobile();
  const vatApplied = vendor.vatApplied ?? false;

  const applyVat = () => {
    if (vatApplied) return;
    for (const item of items) {
      if (item.paymentStatus === "service") continue;
      // 정수 연산으로 부동소수점 오차 방지: amount * 11 / 10
      const newAmount = Math.round(item.amount * 11 / 10);
      store.updateItem(item.id, { amount: newAmount });
    }
    store.updateVendor(vendor.id, { vatApplied: true });
  };

  const removeVat = () => {
    if (!vatApplied) return;
    for (const item of items) {
      if (item.paymentStatus === "service") continue;
      // 정수 연산으로 부동소수점 오차 방지: amount * 10 / 11
      const newAmount = Math.round(item.amount * 10 / 11);
      store.updateItem(item.id, { amount: newAmount });
    }
    store.updateVendor(vendor.id, { vatApplied: false });
  };

  if (isMobile) {
    return (
      <div>
        {/* Mobile: Card-style items */}
        {items.map((item) => (
          <MobileItemCard key={item.id} item={item} store={store} />
        ))}

        {/* Total Row */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold">합계</span>
            {!vatApplied ? (
              <button
                onClick={applyVat}
                className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              >
                +VAT 10%
              </button>
            ) : (
              <button
                onClick={removeVat}
                className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              >
                VAT 적용됨 ✓
              </button>
            )}
          </div>
          <span className="text-xs font-bold font-mono tabular-nums">
            {formatWon(totalAmount)}
          </span>
        </div>

        {/* Add Item */}
        <button
          onClick={onAddItem}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground py-2.5 border-t border-border hover:bg-muted/30 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          항목 추가
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop: Table Header */}
      <div className="grid grid-cols-[1fr_120px_100px_100px_100px_90px_32px] gap-0 border-b border-border bg-muted/50 text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
        <div className="p-2">내역</div>
        <div className="p-2">설명</div>
        <div className="p-2">결제자</div>
        <div className="p-2">결제수단</div>
        <div className="p-2">상태</div>
        <div className="p-2 text-right">금액</div>
        <div className="p-2" />
      </div>

      {/* Items */}
      {items.map((item) => (
        <DesktopItemRow key={item.id} item={item} store={store} />
      ))}

      {/* Total Row */}
      <div className="grid grid-cols-[1fr_120px_100px_100px_100px_90px_32px] gap-0 border-t border-border bg-muted/20">
        <div className="p-2.5 col-span-5 flex items-center gap-2">
          <span className="text-xs font-bold">합계</span>
          {!vatApplied ? (
            <button
              onClick={applyVat}
              className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
            >
              +VAT 10%
            </button>
          ) : (
            <button
              onClick={removeVat}
              className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-300 transition-colors"
            >
              VAT 적용됨 ✓
            </button>
          )}
        </div>
        <div className="p-2.5 text-right text-xs font-bold font-mono tabular-nums">
          {formatWon(totalAmount)}
        </div>
        <div className="p-2" />
      </div>

      {/* Add Item */}
      <button
        onClick={onAddItem}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground py-2.5 border-t border-border hover:bg-muted/30 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        항목 추가
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile Item Card
// ---------------------------------------------------------------------------

function MobileItemCard({
  item,
  store,
}: {
  item: WeddingSettlementItem;
  store: ReturnType<typeof useWeddingSettlement>;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPre = item.isPrepayment;

  return (
    <div
      className={`border-b border-border/30 ${isPre ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}
    >
      {/* Summary row (always visible) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium truncate ${item.paymentStatus === "service" ? "text-muted-foreground/60" : ""}`}>
              {item.name || "내역명 없음"}
            </span>
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[item.paymentStatus]}`}>
              {STATUS_LABELS[item.paymentStatus]}
            </span>
          </div>
          {item.description && (
            <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">{item.description}</p>
          )}
        </div>
        <span className={`text-xs font-mono font-semibold tabular-nums flex-shrink-0 ${isPre ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
          {formatWon(item.amount)}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/30 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
      </button>

      {/* Expanded edit form */}
      {expanded && (
        <div className="px-3.5 pb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground/50 block mb-0.5">내역명</label>
              <input
                value={item.name}
                onChange={(e) => store.updateItem(item.id, { name: e.target.value })}
                placeholder="내역명"
                className="w-full bg-muted/50 text-xs px-2 py-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground/50 block mb-0.5">금액</label>
              <input
                type="number"
                value={item.amount || ""}
                onChange={(e) => store.updateItem(item.id, { amount: Number(e.target.value) || 0 })}
                placeholder="0"
                className="w-full bg-muted/50 text-xs font-mono px-2 py-1.5 rounded-md text-right focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground/50 block mb-0.5">설명</label>
            <input
              value={item.description || ""}
              onChange={(e) => store.updateItem(item.id, { description: e.target.value })}
              placeholder="₩단가 × 수량"
              className="w-full bg-muted/50 text-xs px-2 py-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground/50 block mb-0.5">결제자</label>
              <select
                value={item.payer}
                onChange={(e) => store.updateItem(item.id, { payer: e.target.value as Payer })}
                className={`w-full text-[11px] font-medium px-1.5 py-1.5 rounded-md border-0 cursor-pointer ${PAYER_COLORS[item.payer]}`}
              >
                {Object.entries(PAYER_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground/50 block mb-0.5">결제수단</label>
              <select
                value={item.paymentMethod}
                onChange={(e) => store.updateItem(item.id, { paymentMethod: e.target.value as PaymentMethod })}
                className={`w-full text-[11px] font-medium px-1.5 py-1.5 rounded-md border-0 cursor-pointer ${METHOD_COLORS[item.paymentMethod]}`}
              >
                {Object.entries(METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground/50 block mb-0.5">상태</label>
              <select
                value={item.paymentStatus}
                onChange={(e) => store.updateItem(item.id, { paymentStatus: e.target.value as PaymentStatus })}
                className={`w-full text-[11px] font-medium px-1.5 py-1.5 rounded-md border-0 cursor-pointer ${STATUS_COLORS[item.paymentStatus]}`}
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              onClick={() => store.removeItem(item.id)}
              className="text-[11px] text-red-400 hover:text-red-500 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop Item Row (inline editable)
// ---------------------------------------------------------------------------

function DesktopItemRow({
  item,
  store,
}: {
  item: WeddingSettlementItem;
  store: ReturnType<typeof useWeddingSettlement>;
}) {
  const isPre = item.isPrepayment;

  return (
    <div
      className={`grid grid-cols-[1fr_120px_100px_100px_100px_90px_32px] gap-0 border-b border-border/30 hover:bg-muted/20 transition-colors group ${
        isPre ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""
      }`}
    >
      {/* Name */}
      <div className="p-1.5">
        <input
          value={item.name}
          onChange={(e) => store.updateItem(item.id, { name: e.target.value })}
          placeholder="내역명"
          className="w-full bg-transparent text-xs px-1 py-1 rounded focus:bg-muted/50 focus:outline-none"
        />
      </div>

      {/* Description */}
      <div className="p-1.5">
        <input
          value={item.description || ""}
          onChange={(e) =>
            store.updateItem(item.id, { description: e.target.value })
          }
          placeholder="₩단가 × 수량"
          className="w-full bg-transparent text-[11px] text-muted-foreground px-1 py-1 rounded focus:bg-muted/50 focus:outline-none"
        />
      </div>

      {/* Payer Dropdown */}
      <div className="p-1.5 flex items-center">
        <select
          value={item.payer}
          onChange={(e) =>
            store.updateItem(item.id, { payer: e.target.value as Payer })
          }
          className={`w-full text-[11px] font-medium px-1.5 py-1 rounded-full border-0 cursor-pointer ${
            PAYER_COLORS[item.payer]
          }`}
        >
          {Object.entries(PAYER_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Payment Method Dropdown */}
      <div className="p-1.5 flex items-center">
        <select
          value={item.paymentMethod}
          onChange={(e) =>
            store.updateItem(item.id, {
              paymentMethod: e.target.value as PaymentMethod,
            })
          }
          className={`w-full text-[11px] font-medium px-1.5 py-1 rounded-full border-0 cursor-pointer ${
            METHOD_COLORS[item.paymentMethod]
          }`}
        >
          {Object.entries(METHOD_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Status Dropdown */}
      <div className="p-1.5 flex items-center">
        <select
          value={item.paymentStatus}
          onChange={(e) =>
            store.updateItem(item.id, {
              paymentStatus: e.target.value as PaymentStatus,
            })
          }
          className={`w-full text-[11px] font-medium px-1.5 py-1 rounded-full border-0 cursor-pointer ${
            STATUS_COLORS[item.paymentStatus]
          }`}
        >
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Amount */}
      <div className="p-1.5 flex items-center justify-end">
        <input
          type="number"
          value={item.amount || ""}
          onChange={(e) =>
            store.updateItem(item.id, { amount: Number(e.target.value) || 0 })
          }
          placeholder="0"
          className={`w-full text-right text-[11px] font-mono tabular-nums bg-transparent px-1 py-1 rounded focus:bg-muted/50 focus:outline-none ${
            isPre ? "text-emerald-600 dark:text-emerald-400" : ""
          }`}
        />
      </div>

      {/* Delete */}
      <div className="p-1.5 flex items-center justify-center">
        <button
          onClick={() => store.removeItem(item.id)}
          className="p-0.5 text-muted-foreground/20 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Receipts Tab
// ---------------------------------------------------------------------------

function ReceiptsTab({
  receipts,
  store,
  lightboxImg,
  setLightboxImg,
  vendorId,
}: {
  receipts: Receipt[];
  store: ReturnType<typeof useWeddingSettlement>;
  lightboxImg: string | null;
  setLightboxImg: (v: string | null) => void;
  vendorId: string;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddFiles = async (fileList: FileList) => {
    for (const file of Array.from(fileList)) {
      if (file.size > 10 * 1024 * 1024) continue;
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const dataUrl = `data:${file.type};base64,${base64}`;
      store.addReceipt({
        id: crypto.randomUUID(),
        vendorId,
        filename: file.name,
        dataUrl,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        uploadedAt: Date.now(),
      });
    }
  };

  const openReceipt = (r: Receipt) => {
    if (!r.dataUrl) return;
    if (r.mimeType.startsWith("image/")) {
      setLightboxImg(r.dataUrl);
    } else {
      // PDF or other: open in new tab
      const win = window.open();
      if (win) {
        win.document.write(
          `<iframe src="${r.dataUrl}" style="width:100%;height:100%;border:none;position:fixed;top:0;left:0;" />`
        );
        win.document.title = r.filename;
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.heic"
        onChange={(e) => {
          if (e.target.files) handleAddFiles(e.target.files);
          e.target.value = "";
        }}
        className="hidden"
      />

      {receipts.length === 0 ? (
        <div className="p-8 text-center">
          <Image className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground/50 mb-3">
            연결된 영수증이 없습니다
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-primary hover:underline"
          >
            영수증 첨부하기
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 p-3">
            {receipts.map((r) => (
              <div
                key={r.id}
                className="group relative aspect-[3/4] bg-muted rounded-lg overflow-hidden border border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => openReceipt(r)}
              >
                {r.dataUrl ? (
                  r.mimeType.startsWith("image/") ? (
                    <img
                      src={r.dataUrl}
                      alt={r.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                      <FileText className="h-8 w-8 text-muted-foreground/30" />
                      <span className="text-[11px] text-muted-foreground/40">PDF</span>
                    </div>
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <p className="text-[11px] text-white truncate">{r.filename}</p>
                  {r.badgeType && (
                    <span className="inline-block text-[11px] bg-white/20 text-white px-1 py-0.5 rounded mt-0.5">
                      {r.badgeType}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    store.removeReceipt(r.id);
                  }}
                  className="absolute top-1 right-1 p-1 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Add more receipts */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground py-2.5 border-t border-border hover:bg-muted/30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            영수증 추가
          </button>
        </>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-8"
          onClick={() => setLightboxImg(null)}
        >
          <img
            src={lightboxImg}
            alt="receipt"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Schedule Tab
// ---------------------------------------------------------------------------

function ScheduleTab({
  vendor,
  store,
  editingComment,
  setEditingComment,
  commentText,
  setCommentText,
  saveComment,
}: {
  vendor: WeddingVendor;
  store: ReturnType<typeof useWeddingSettlement>;
  editingComment: boolean;
  setEditingComment: (v: boolean) => void;
  commentText: string;
  setCommentText: (v: string) => void;
  saveComment: () => void;
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mb-1">
            <Calendar className="h-3 w-3" />
            계약일
          </label>
          <input
            type="date"
            value={vendor.contractDate || ""}
            onChange={(e) =>
              store.updateVendor(vendor.id, { contractDate: e.target.value })
            }
            className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/30 [color-scheme:dark] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mb-1">
            <Calendar className="h-3 w-3" />
            잔금 납부일
          </label>
          <input
            type="date"
            value={vendor.finalPaymentDate || ""}
            onChange={(e) =>
              store.updateVendor(vendor.id, {
                finalPaymentDate: e.target.value,
              })
            }
            className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/30 [color-scheme:dark] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>
      </div>

      {/* Vendor category */}
      <div>
        <label className="text-[11px] text-muted-foreground/60 block mb-1">
          카테고리
        </label>
        <select
          value={vendor.category}
          onChange={(e) =>
            store.updateVendor(vendor.id, {
              category: e.target.value as VendorCategory,
            })
          }
          className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs"
        >
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {CATEGORY_EMOJIS[k as VendorCategory]} {v}
            </option>
          ))}
        </select>
      </div>

      {/* Comment */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] text-muted-foreground/60">메모</label>
          {!editingComment && (
            <button
              onClick={() => {
                setCommentText(vendor.comment || "");
                setEditingComment(true);
              }}
              className="text-[11px] text-primary hover:underline"
            >
              편집
            </button>
          )}
        </div>
        {editingComment ? (
          <div className="space-y-2">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={4}
              autoFocus
              className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <div className="flex justify-end gap-1.5">
              <button
                onClick={() => setEditingComment(false)}
                className="text-[11px] text-muted-foreground px-2 py-1 rounded hover:bg-muted"
              >
                취소
              </button>
              <button
                onClick={saveComment}
                className="text-[11px] text-primary-foreground bg-primary px-2 py-1 rounded hover:bg-primary/90"
              >
                저장
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap min-h-[40px]">
            {vendor.comment || "메모가 없습니다"}
          </p>
        )}
      </div>
    </div>
  );
}
