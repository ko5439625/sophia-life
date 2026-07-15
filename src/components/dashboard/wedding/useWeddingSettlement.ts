import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type {
  WeddingVendor,
  WeddingSettlementItem,
  Receipt,
  WeddingSettlementStore,
  Payer,
} from "./weddingTypes";
import {
  checkSettlementTablesExist,
  loadSettlementVendors,
  loadSettlementItems,
  loadSettlementReceipts,
  saveSettlementVendor,
  deleteSettlementVendor,
  saveSettlementItem,
  deleteSettlementItem,
  saveSettlementReceipt,
  deleteSettlementReceipt,
} from "@/services/supabaseSync";
import type {
  SettlementVendorRow,
  SettlementItemRow,
  SettlementReceiptRow,
} from "@/services/supabaseSync";

const STORAGE_KEY = "sophia-wedding-settlement";

function loadStore(): WeddingSettlementStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { vendors: [], items: [], receipts: [] };
}

function persistStore(store: WeddingSettlementStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// ---------------------------------------------------------------------------
// camelCase <-> snake_case mappers
// ---------------------------------------------------------------------------

function vendorToRow(v: WeddingVendor): SettlementVendorRow {
  return {
    id: v.id,
    name: v.name,
    category: v.category,
    emoji: v.emoji ?? null,
    contract_date: v.contractDate ?? null,
    final_payment_date: v.finalPaymentDate ?? null,
    comment: v.comment ?? null,
    vat_applied: v.vatApplied ?? false,
    created_at: v.createdAt,
    updated_at: v.updatedAt,
  };
}

function rowToVendor(r: SettlementVendorRow): WeddingVendor {
  return {
    id: r.id,
    name: r.name,
    category: r.category as WeddingVendor["category"],
    emoji: r.emoji ?? undefined,
    contractDate: r.contract_date ?? undefined,
    finalPaymentDate: r.final_payment_date ?? undefined,
    comment: r.comment ?? undefined,
    vatApplied: r.vat_applied,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function itemToRow(i: WeddingSettlementItem): SettlementItemRow {
  return {
    id: i.id,
    vendor_id: i.vendorId,
    name: i.name,
    description: i.description ?? null,
    unit_price: i.unitPrice ?? null,
    quantity: i.quantity ?? null,
    amount: i.amount,
    payer: i.payer,
    payment_method: i.paymentMethod,
    payment_status: i.paymentStatus,
    paid_date: i.paidDate ?? null,
    paid_amount: i.paidAmount ?? null,
    is_prepayment: i.isPrepayment ?? false,
    sort_order: i.order,
  };
}

function rowToItem(r: SettlementItemRow): WeddingSettlementItem {
  return {
    id: r.id,
    vendorId: r.vendor_id,
    name: r.name,
    description: r.description ?? undefined,
    unitPrice: r.unit_price ?? undefined,
    quantity: r.quantity ?? undefined,
    amount: r.amount,
    payer: r.payer as Payer,
    paymentMethod: r.payment_method as WeddingSettlementItem["paymentMethod"],
    paymentStatus: r.payment_status as WeddingSettlementItem["paymentStatus"],
    paidDate: r.paid_date ?? undefined,
    paidAmount: r.paid_amount ?? undefined,
    isPrepayment: r.is_prepayment,
    order: r.sort_order,
  };
}

function receiptToRow(r: Receipt): SettlementReceiptRow {
  return {
    id: r.id,
    vendor_id: r.vendorId,
    filename: r.filename,
    data_url: r.dataUrl ?? null,
    file_size: r.fileSize,
    mime_type: r.mimeType,
    badge_type: r.badgeType ?? null,
    uploaded_at: r.uploadedAt,
    ai_extracted: r.aiExtracted ?? null,
  };
}

function rowToReceipt(r: SettlementReceiptRow): Receipt {
  return {
    id: r.id,
    vendorId: r.vendor_id,
    filename: r.filename,
    dataUrl: r.data_url ?? undefined,
    fileSize: r.file_size,
    mimeType: r.mime_type,
    badgeType: r.badge_type as Receipt["badgeType"],
    uploadedAt: r.uploaded_at,
    aiExtracted: r.ai_extracted as Receipt["aiExtracted"],
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWeddingSettlement() {
  const [vendors, setVendors] = useState<WeddingVendor[]>([]);
  const [items, setItems] = useState<WeddingSettlementItem[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const dbReady = useRef(false);

  // Load on mount: merge Supabase + localStorage to prevent data loss
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = loadStore();
      const tablesExist = await checkSettlementTablesExist();
      if (cancelled) return;

      if (!tablesExist) {
        // No Supabase tables → use localStorage only
        setVendors(local.vendors);
        setItems(local.items);
        setReceipts(local.receipts);
        return;
      }

      dbReady.current = true;
      const [vRows, iRows, rRows] = await Promise.all([
        loadSettlementVendors(),
        loadSettlementItems(),
        loadSettlementReceipts(),
      ]);
      if (cancelled) return;

      // --- Merge DB + localStorage by id (union, DB wins on conflict) ---
      const dbVendors = vRows.map(rowToVendor);
      const dbItems = iRows.map(rowToItem);
      const dbReceipts = rRows.map(rowToReceipt);

      const dbVendorIds = new Set(dbVendors.map((v) => v.id));
      const dbItemIds = new Set(dbItems.map((i) => i.id));
      const dbReceiptIds = new Set(dbReceipts.map((r) => r.id));

      // Find items in localStorage that are missing from DB
      const missingVendors = local.vendors.filter((v) => !dbVendorIds.has(v.id));
      const missingItems = local.items.filter((i) => !dbItemIds.has(i.id));
      const missingReceipts = local.receipts.filter((r) => !dbReceiptIds.has(r.id));

      // Also restore data_url from localStorage for receipts loaded from DB
      // (DB doesn't store data_url to avoid size issues)
      const localReceiptMap = new Map(local.receipts.map((r) => [r.id, r]));
      for (const r of dbReceipts) {
        if (!r.dataUrl && localReceiptMap.has(r.id)) {
          r.dataUrl = localReceiptMap.get(r.id)!.dataUrl;
        }
      }

      const mergedVendors = [...dbVendors, ...missingVendors];
      const mergedItems = [...dbItems, ...missingItems];
      const mergedReceipts = [...dbReceipts, ...missingReceipts];

      setVendors(mergedVendors);
      setItems(mergedItems);
      setReceipts(mergedReceipts);

      // Sync missing items back to Supabase
      if (missingVendors.length || missingItems.length || missingReceipts.length) {
        console.log(
          `[wedding] Syncing missing data to Supabase: ${missingVendors.length} vendors, ${missingItems.length} items, ${missingReceipts.length} receipts`
        );
        // Vendors must be saved first (FK constraint)
        for (const v of missingVendors) await saveSettlementVendor(vendorToRow(v));
        for (const i of missingItems) await saveSettlementItem(itemToRow(i));
        for (const r of missingReceipts) await saveSettlementReceipt(receiptToRow(r));
        console.log("[wedding] Sync complete.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist to localStorage always (as backup/cache)
  useEffect(() => {
    persistStore({ vendors, items, receipts });
  }, [vendors, items, receipts]);

  // ---- Vendor CRUD ----

  const addVendor = useCallback((v: WeddingVendor) => {
    setVendors((prev) => [...prev, v]);
    if (dbReady.current) saveSettlementVendor(vendorToRow(v));
  }, []);

  const updateVendor = useCallback((id: string, patch: Partial<WeddingVendor>) => {
    setVendors((prev) => {
      const updated = prev.map((v) =>
        v.id === id ? { ...v, ...patch, updatedAt: Date.now() } : v
      );
      const target = updated.find((v) => v.id === id);
      if (target && dbReady.current) saveSettlementVendor(vendorToRow(target));
      return updated;
    });
  }, []);

  const removeVendor = useCallback((id: string) => {
    setVendors((prev) => prev.filter((v) => v.id !== id));
    setItems((prev) => prev.filter((i) => i.vendorId !== id));
    setReceipts((prev) => prev.filter((r) => r.vendorId !== id));
    if (dbReady.current) deleteSettlementVendor(id); // CASCADE handles items & receipts
  }, []);

  // ---- Item CRUD ----

  const addItem = useCallback((item: WeddingSettlementItem) => {
    setItems((prev) => [...prev, item]);
    if (dbReady.current) saveSettlementItem(itemToRow(item));
  }, []);

  const addItems = useCallback((newItems: WeddingSettlementItem[]) => {
    setItems((prev) => [...prev, ...newItems]);
    if (dbReady.current) {
      for (const i of newItems) saveSettlementItem(itemToRow(i));
    }
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<WeddingSettlementItem>) => {
      setItems((prev) => {
        const updated = prev.map((i) => (i.id === id ? { ...i, ...patch } : i));
        const target = updated.find((i) => i.id === id);
        if (target && dbReady.current) saveSettlementItem(itemToRow(target));
        return updated;
      });
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (dbReady.current) deleteSettlementItem(id);
  }, []);

  // ---- Receipt CRUD ----

  const addReceipt = useCallback((r: Receipt) => {
    setReceipts((prev) => [...prev, r]);
    if (dbReady.current) saveSettlementReceipt(receiptToRow(r));
  }, []);

  const addReceipts = useCallback((rs: Receipt[]) => {
    setReceipts((prev) => [...prev, ...rs]);
    if (dbReady.current) {
      for (const r of rs) saveSettlementReceipt(receiptToRow(r));
    }
  }, []);

  const removeReceipt = useCallback((id: string) => {
    setReceipts((prev) => prev.filter((r) => r.id !== id));
    if (dbReady.current) deleteSettlementReceipt(id);
  }, []);

  // ---- Derived stats ----

  const getVendorItems = useCallback(
    (vendorId: string) =>
      items.filter((i) => i.vendorId === vendorId).sort((a, b) => a.order - b.order),
    [items]
  );

  const getVendorReceipts = useCallback(
    (vendorId: string) =>
      receipts.filter((r) => r.vendorId === vendorId).sort((a, b) => b.uploadedAt - a.uploadedAt),
    [receipts]
  );

  const vendorStats = useMemo(() => {
    const map = new Map<
      string,
      { total: number; paid: number; paidByPayer: Record<Payer, number>; itemCount: number }
    >();
    for (const v of vendors) {
      const vItems = items.filter((i) => i.vendorId === v.id);
      const total = vItems
        .filter((i) => !i.isPrepayment && i.paymentStatus !== "service")
        .reduce((s, i) => s + i.amount, 0);
      let paid = 0;
      const paidByPayer: Record<Payer, number> = {
        unset: 0,
        ahyun: 0,
        jaejun: 0,
        share: 0,
      };
      for (const i of vItems) {
        if (i.paymentStatus === "service") continue;
        if (i.paymentStatus === "paid") {
          const amt = i.isPrepayment ? Math.abs(i.amount) : i.amount;
          paid += amt;
          paidByPayer[i.payer] += amt;
        } else if (i.paymentStatus === "partial" && i.paidAmount) {
          paid += i.paidAmount;
          paidByPayer[i.payer] += i.paidAmount;
        }
      }
      map.set(v.id, { total, paid, paidByPayer, itemCount: vItems.length });
    }
    return map;
  }, [vendors, items]);

  const globalStats = useMemo(() => {
    let totalAmount = 0;
    let paidAmount = 0;
    const payerTotals: Record<Payer, { amount: number; count: number }> = {
      unset: { amount: 0, count: 0 },
      ahyun: { amount: 0, count: 0 },
      jaejun: { amount: 0, count: 0 },
      share: { amount: 0, count: 0 },
    };

    for (const i of items) {
      if (i.paymentStatus === "service") continue;
      if (!i.isPrepayment) totalAmount += i.amount;
      if (i.paymentStatus === "paid") {
        const amt = i.isPrepayment ? Math.abs(i.amount) : i.amount;
        paidAmount += amt;
        payerTotals[i.payer].amount += amt;
        payerTotals[i.payer].count += 1;
      } else if (i.paymentStatus === "partial" && i.paidAmount) {
        paidAmount += i.paidAmount;
        payerTotals[i.payer].amount += i.paidAmount;
        payerTotals[i.payer].count += 1;
      }
    }

    const remaining = totalAmount - paidAmount;
    const progressPct = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

    return { totalAmount, paidAmount, remaining, progressPct, payerTotals };
  }, [items]);

  return {
    vendors,
    items,
    receipts,
    addVendor,
    updateVendor,
    removeVendor,
    addItem,
    addItems,
    updateItem,
    removeItem,
    addReceipt,
    addReceipts,
    removeReceipt,
    getVendorItems,
    getVendorReceipts,
    vendorStats,
    globalStats,
  };
}
