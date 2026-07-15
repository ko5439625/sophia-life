import { useState, useMemo } from "react";
import {
  Plus,
  Receipt,
  Building2,
  ChevronRight,
  ChevronDown,
  Calendar,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWeddingSettlement } from "./useWeddingSettlement";
import {
  PAYER_LABELS,
  PAYER_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORY_LABELS,
  CATEGORY_EMOJIS,
} from "./weddingTypes";
import type { WeddingVendor, Payer } from "./weddingTypes";
import VendorDetail from "./VendorDetail";
import ReceiptModal from "./ReceiptModal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWon(n: number) {
  if (n === 0) return "₩0";
  if (Math.abs(n) >= 100_000_000) return `₩${(n / 100_000_000).toFixed(1)}억`;
  if (Math.abs(n) >= 10_000) return `₩${(n / 10_000).toFixed(n % 10_000 === 0 ? 0 : 1)}만`;
  return `₩${n.toLocaleString()}`;
}

function dDay(dateStr?: string) {
  if (!dateStr) return null;
  const diff = Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "D-Day";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function WeddingSettlement() {
  const store = useWeddingSettlement();
  const {
    vendors,
    globalStats,
    vendorStats,
    getVendorItems,
    getVendorReceipts,
  } = store;

  const isMobile = useIsMobile();
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Sort vendors: has upcoming final payment first, then by creation date
  const sortedVendors = useMemo(() => {
    return [...vendors].sort((a, b) => {
      const aDate = a.finalPaymentDate ? new Date(a.finalPaymentDate).getTime() : Infinity;
      const bDate = b.finalPaymentDate ? new Date(b.finalPaymentDate).getTime() : Infinity;
      if (aDate !== bDate) return aDate - bDate;
      return b.createdAt - a.createdAt;
    });
  }, [vendors]);

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId) ?? null;

  // Toggle for mobile accordion
  const toggleVendor = (id: string) => {
    setSelectedVendorId((prev) => (prev === id ? null : id));
  };

  // ---- Render ----

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">웨딩 정산</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const csv = exportCsv(store);
              const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `wedding-settlement-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">내보내기</span>
          </button>
          <button
            onClick={() => setReceiptModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-primary-foreground bg-primary px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            영수증 추가
          </button>
        </div>
      </div>

      {/* Slim Strip (PRD 5.5) */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap bg-card rounded-xl border border-border px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-mono">
        {(["ahyun", "jaejun"] as Payer[]).map((p) => {
          const stat = globalStats.payerTotals[p];
          return (
            <span key={p} className="flex items-center gap-1 sm:gap-1.5">
              <span
                className={`inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full text-[11px] sm:text-[11px] font-bold ${PAYER_COLORS[p]}`}
              >
                {PAYER_LABELS[p][0]}
              </span>
              <span className="hidden sm:inline text-muted-foreground">{PAYER_LABELS[p]}</span>
              <span className="font-semibold">{formatWon(stat.amount)}</span>
              <span className="hidden sm:inline text-muted-foreground/50">· {stat.count}건</span>
            </span>
          );
        })}
        <span className="text-border">|</span>
        <span>
          <span className="text-muted-foreground">총 </span>
          <span className="font-semibold">{formatWon(globalStats.totalAmount)}</span>
        </span>
        <span className="text-border">|</span>
        <span>
          <span className="text-muted-foreground">잔금 </span>
          <span className="font-semibold text-amber-500">
            {formatWon(globalStats.remaining)}
          </span>
        </span>
        <span className="text-border">|</span>
        <span>
          <span className="text-muted-foreground">진행 </span>
          <span className="font-semibold">{globalStats.progressPct}%</span>
        </span>
      </div>

      {/* ---- Mobile: Accordion Layout ---- */}
      {isMobile ? (
        <div className="space-y-2">
          {sortedVendors.length === 0 ? (
            <div className="p-8 text-center bg-card rounded-xl border border-border">
              <Receipt className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground/50">
                영수증을 추가하면<br />업체가 자동 생성됩니다
              </p>
            </div>
          ) : (
            sortedVendors.map((v) => {
              const stats = vendorStats.get(v.id);
              const isOpen = selectedVendorId === v.id;
              const dd = dDay(v.finalPaymentDate);
              const isDanger = dd && (dd === "D-Day" || (dd.startsWith("D-") && parseInt(dd.slice(2)) <= 7));
              const statusLabel =
                stats && stats.paid >= stats.total && stats.total > 0
                  ? "완납"
                  : stats && stats.paid > 0
                    ? "일부"
                    : "예정";

              return (
                <div
                  key={v.id}
                  className="bg-card rounded-xl border border-border overflow-hidden"
                >
                  {/* Vendor Header (tap to toggle) */}
                  <button
                    onClick={() => toggleVendor(v.id)}
                    className={`w-full text-left p-3.5 transition-colors ${
                      isOpen ? "bg-primary/5" : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg flex-shrink-0">
                          {v.emoji || CATEGORY_EMOJIS[v.category]}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{v.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-muted-foreground/60 font-mono">
                              {stats ? formatWon(stats.total) : "₩0"}
                            </span>
                            <span className="text-[11px] text-muted-foreground/30">·</span>
                            <span
                              className={`text-[11px] font-medium ${
                                statusLabel === "완납"
                                  ? "text-emerald-500"
                                  : statusLabel === "일부"
                                    ? "text-amber-500"
                                    : "text-muted-foreground/40"
                              }`}
                            >
                              {statusLabel}
                            </span>
                            {dd && (
                              <>
                                <span className="text-[11px] text-muted-foreground/30">·</span>
                                <span
                                  className={`text-[11px] font-mono font-medium ${
                                    isDanger
                                      ? "text-red-500"
                                      : "text-muted-foreground/40"
                                  }`}
                                >
                                  {dd}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </div>
                    </div>

                    {/* Mini progress bar */}
                    {stats && stats.total > 0 && (
                      <div className="mt-2 w-full h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.round((stats.paid / stats.total) * 100))}%` }}
                        />
                      </div>
                    )}
                  </button>

                  {/* Expanded Detail */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border">
                          <VendorDetail
                            vendor={v}
                            items={getVendorItems(v.id)}
                            receipts={getVendorReceipts(v.id)}
                            store={store}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}

          {/* Add vendor button */}
          <button
            onClick={() => setReceiptModalOpen(true)}
            className="w-full p-3 bg-card rounded-xl border border-dashed border-border flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            새 업체
          </button>
        </div>
      ) : (
        /* ---- Desktop: Master-Detail Layout (PRD 6.1) ---- */
        <div className="flex gap-4 min-h-[500px]">
          {/* Left: Vendor List */}
          <div className="w-64 flex-shrink-0 bg-card rounded-xl border border-border overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border">
              <p className="text-xs font-medium text-muted-foreground">업체별 정산</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sortedVendors.length === 0 ? (
                <div className="p-6 text-center">
                  <Receipt className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground/50">
                    영수증을 추가하면<br />업체가 자동 생성됩니다
                  </p>
                </div>
              ) : (
                sortedVendors.map((v) => {
                  const stats = vendorStats.get(v.id);
                  const isSelected = selectedVendorId === v.id;
                  const dd = dDay(v.finalPaymentDate);
                  const isDanger = dd && (dd === "D-Day" || (dd.startsWith("D-") && parseInt(dd.slice(2)) <= 7));
                  const statusLabel =
                    stats && stats.paid >= stats.total && stats.total > 0
                      ? "완납"
                      : stats && stats.paid > 0
                        ? "일부"
                        : "예정";

                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVendorId(v.id)}
                      className={`w-full text-left p-3 border-b border-border/30 transition-colors ${
                        isSelected
                          ? "bg-primary/10 border-l-2 border-l-primary"
                          : "hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {v.emoji || CATEGORY_EMOJIS[v.category]} {v.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground/60 font-mono mt-0.5">
                            {stats ? formatWon(stats.total) : "₩0"}
                            <span className="mx-1">·</span>
                            <span
                              className={
                                statusLabel === "완납"
                                  ? "text-emerald-500"
                                  : statusLabel === "일부"
                                    ? "text-amber-500"
                                    : "text-muted-foreground/40"
                              }
                            >
                              {statusLabel}
                            </span>
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          {dd && (
                            <span
                              className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                                isDanger
                                  ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                                  : "text-muted-foreground/40"
                              }`}
                            >
                              {dd}
                            </span>
                          )}
                          <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <button
              onClick={() => setReceiptModalOpen(true)}
              className="p-2.5 border-t border-border flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              새 업체
            </button>
          </div>

          {/* Right: Detail Panel */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {selectedVendor ? (
                <motion.div
                  key={selectedVendor.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                >
                  <VendorDetail
                    vendor={selectedVendor}
                    items={getVendorItems(selectedVendor.id)}
                    receipts={getVendorReceipts(selectedVendor.id)}
                    store={store}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex items-center justify-center bg-card rounded-xl border border-border"
                >
                  <div className="text-center">
                    <Building2 className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground/40">
                      좌측 업체를 선택하거나
                    </p>
                    <p className="text-sm text-muted-foreground/40">
                      영수증을 추가해주세요
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptModalOpen && (
        <ReceiptModal
          onClose={() => setReceiptModalOpen(false)}
          store={store}
          onVendorCreated={(vendorId) => {
            setSelectedVendorId(vendorId);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

function exportCsv(store: ReturnType<typeof useWeddingSettlement>) {
  const { vendors, items } = store;
  const rows: string[] = [];
  rows.push("업체,카테고리,내역,설명,결제자,결제수단,납부상태,금액,선납여부");

  for (const v of vendors) {
    const vItems = items.filter((i) => i.vendorId === v.id);
    for (const item of vItems) {
      rows.push(
        [
          `"${v.name}"`,
          CATEGORY_LABELS[v.category],
          `"${item.name}"`,
          `"${item.description || ""}"`,
          PAYER_LABELS[item.payer as keyof typeof PAYER_LABELS],
          item.paymentMethod,
          STATUS_LABELS[item.paymentStatus as keyof typeof STATUS_LABELS],
          item.amount,
          item.isPrepayment ? "Y" : "",
        ].join(",")
      );
    }
  }
  return rows.join("\n");
}
