import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, TrendingUp, TrendingDown, X, ChevronDown, ChevronUp, Loader2, AlertTriangle, Target, DollarSign } from "lucide-react";
import { formatKRW } from "./budgetData";
import { useGuestMode } from "../../../hooks/useGuestMode";

interface Trade {
  id: string;
  symbol: string;
  name: string;
  market: "us" | "kr";
  entryPrice: number;
  currentPrice: number;
  targetPrice: number;
  stopLoss: number;
  quantity: number;
  currency: string;
  entryDate: string;
  status: "open" | "closed";
  closePrice?: number;
  closeDate?: string;
  closeReason?: string;
}

const STORAGE_KEY = "sophia-trades";

function loadTrades(): Trade[] {
  try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
}
function saveTrades(trades: Trade[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trades)); } catch {}
}

const TradingView = () => {
  const { isGuest } = useGuestMode();
  const [trades, setTrades] = useState<Trade[]>(loadTrades);
  const [showBuyForm, setShowBuyForm] = useState(false);
  const [newsUs, setNewsUs] = useState<string[]>([]);
  const [newsKr, setNewsKr] = useState<string[]>([]);
  const [newsUsOpen, setNewsUsOpen] = useState(false);
  const [newsKrOpen, setNewsKrOpen] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [sellId, setSellId] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState("");

  const [buyForm, setBuyForm] = useState({
    symbol: "", name: "", market: "kr" as "us" | "kr",
    entryPrice: "", targetPrice: "", stopLoss: "", quantity: "1", currency: "KRW",
  });

  // 퀀트 추천 Top 10 가져오기
  const [quantTop, setQuantTop] = useState<{ symbol: string; name: string; price: number; currency: string }[]>([]);
  useEffect(() => {
    try {
      const usCache = localStorage.getItem("sophia-quant-us");
      const krCache = localStorage.getItem("sophia-quant-kr");
      const tops: typeof quantTop = [];
      if (krCache) {
        const { d } = JSON.parse(krCache);
        (d || []).sort((a: { recScore: number }, b: { recScore: number }) => b.recScore - a.recScore)
          .slice(0, 10).forEach((s: { symbol: string; name: string; price: number; currency: string }) => {
            tops.push({ symbol: s.symbol, name: s.name, price: s.price, currency: s.currency });
          });
      }
      if (usCache) {
        const { d } = JSON.parse(usCache);
        (d || []).sort((a: { recScore: number }, b: { recScore: number }) => b.recScore - a.recScore)
          .slice(0, 10).forEach((s: { symbol: string; name: string; price: number; currency: string }) => {
            tops.push({ symbol: s.symbol, name: s.name, price: s.price, currency: s.currency });
          });
      }
      setQuantTop(tops);
    } catch {}
  }, []);

  // 보유 종목 뉴스 가져오기
  const fetchNews = useCallback(async () => {
    const openTrades = trades.filter((t) => t.status === "open");
    if (openTrades.length === 0) return;
    setNewsLoading(true);

    const krStocks = openTrades.filter((t) => t.market === "kr");
    const usStocks = openTrades.filter((t) => t.market === "us");

    const fetchStockNews = async (query: string) => {
      try {
        const res = await fetch(`/api/market?service=stock-news&q=${encodeURIComponent(query)}`);
        if (res.ok) { const d = await res.json(); return (d.articles || []) as string[]; }
      } catch {} return [];
    };

    if (krStocks.length > 0) {
      const allNews: string[] = [];
      for (const t of krStocks.slice(0, 5)) {
        const news = await fetchStockNews(t.name);
        allNews.push(...news.slice(0, 3).map((n) => `[${t.name}] ${n}`));
      }
      setNewsKr(allNews);
    }
    if (usStocks.length > 0) {
      const allNews: string[] = [];
      for (const t of usStocks.slice(0, 5)) {
        const news = await fetchStockNews(t.symbol);
        allNews.push(...news.slice(0, 3).map((n) => `[${t.name}] ${n}`));
      }
      setNewsUs(allNews);
    }
    setNewsLoading(false);
  }, [trades]);

  useEffect(() => { fetchNews(); }, []);
  useEffect(() => { saveTrades(trades); }, [trades]);

  const handleBuy = () => {
    if (!buyForm.symbol || !buyForm.entryPrice) return;
    const trade: Trade = {
      id: crypto.randomUUID(),
      symbol: buyForm.symbol, name: buyForm.name, market: buyForm.market,
      entryPrice: parseFloat(buyForm.entryPrice), currentPrice: parseFloat(buyForm.entryPrice),
      targetPrice: parseFloat(buyForm.targetPrice) || 0, stopLoss: parseFloat(buyForm.stopLoss) || 0,
      quantity: parseInt(buyForm.quantity) || 1, currency: buyForm.currency,
      entryDate: new Date().toISOString().slice(0, 10), status: "open",
    };
    setTrades((prev) => [trade, ...prev]);
    setBuyForm({ symbol: "", name: "", market: "kr", entryPrice: "", targetPrice: "", stopLoss: "", quantity: "1", currency: "KRW" });
    setShowBuyForm(false);
  };

  const handleSell = (id: string) => {
    const price = parseFloat(sellPrice);
    if (!price) return;
    setTrades((prev) => prev.map((t) => t.id === id ? {
      ...t, status: "closed" as const, closePrice: price, closeDate: new Date().toISOString().slice(0, 10),
      closeReason: price >= t.targetPrice ? "목표가 도달" : price <= t.stopLoss ? "손절" : "수동 매도",
    } : t));
    setSellId(null);
    setSellPrice("");
  };

  const quickBuy = (stock: typeof quantTop[0]) => {
    setBuyForm({
      symbol: stock.symbol, name: stock.name,
      market: stock.currency === "KRW" ? "kr" : "us",
      entryPrice: String(stock.price), targetPrice: "", stopLoss: "",
      quantity: "1", currency: stock.currency,
    });
    setShowBuyForm(true);
  };

  const openTrades = trades.filter((t) => t.status === "open");
  const closedTrades = trades.filter((t) => t.status === "closed");
  const fmt = (v: number, cur: string) => cur === "USD" ? `$${v.toLocaleString()}` : `${formatKRW(v)}원`;

  if (isGuest) return <div className="text-center py-20 text-sm text-muted-foreground">비공개</div>;

  return (
    <div className="space-y-4">
      {/* 퀀트 추천 Top → 빠른 매수 */}
      {quantTop.length > 0 && (
        <div className="bg-card rounded-xl p-4">
          <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary" /> 퀀트 추천 빠른 매수
          </h4>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {quantTop.slice(0, 10).map((s, i) => (
              <button key={s.symbol} onClick={() => quickBuy(s)}
                className="flex-shrink-0 px-3 py-2 bg-muted/50 hover:bg-muted rounded-lg text-xs transition-colors">
                <div className="flex items-center gap-1.5">
                  {i < 3 && <span className="text-[9px]">{["🥇","🥈","🥉"][i]}</span>}
                  <span className="font-medium">{s.name}</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">{fmt(s.price, s.currency)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 매수 폼 */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold">보유 포지션 ({openTrades.length})</h3>
        <button onClick={() => setShowBuyForm(!showBuyForm)}
          className="flex items-center gap-1 text-xs text-primary"><ShoppingCart className="h-3.5 w-3.5" /> 매수</button>
      </div>

      <AnimatePresence>
        {showBuyForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-card rounded-xl p-4 space-y-3 border border-primary/20">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><label className="text-[9px] text-muted-foreground">종목명</label>
                  <input value={buyForm.name} onChange={(e) => setBuyForm({ ...buyForm, name: e.target.value })} placeholder="삼성전자"
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs" /></div>
                <div><label className="text-[9px] text-muted-foreground">심볼</label>
                  <input value={buyForm.symbol} onChange={(e) => setBuyForm({ ...buyForm, symbol: e.target.value })} placeholder="005930.KS"
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono" /></div>
                <div><label className="text-[9px] text-muted-foreground">매수가</label>
                  <input type="number" value={buyForm.entryPrice} onChange={(e) => setBuyForm({ ...buyForm, entryPrice: e.target.value })}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono" /></div>
                <div><label className="text-[9px] text-muted-foreground">수량</label>
                  <input type="number" value={buyForm.quantity} onChange={(e) => setBuyForm({ ...buyForm, quantity: e.target.value })}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-primary">목표가</label>
                  <input type="number" value={buyForm.targetPrice} onChange={(e) => setBuyForm({ ...buyForm, targetPrice: e.target.value })}
                    className="w-full bg-background border border-primary/30 rounded px-2 py-1.5 text-xs font-mono" /></div>
                <div><label className="text-[9px] text-destructive">손절가</label>
                  <input type="number" value={buyForm.stopLoss} onChange={(e) => setBuyForm({ ...buyForm, stopLoss: e.target.value })}
                    className="w-full bg-background border border-destructive/30 rounded px-2 py-1.5 text-xs font-mono" /></div>
              </div>
              <button onClick={handleBuy} disabled={!buyForm.symbol || !buyForm.entryPrice}
                className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-40">매수 등록</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 보유 포지션 */}
      {openTrades.map((t) => {
        const pnl = (t.currentPrice - t.entryPrice) * t.quantity;
        const pnlPct = t.entryPrice > 0 ? ((t.currentPrice - t.entryPrice) / t.entryPrice * 100) : 0;
        const targetPct = t.targetPrice > 0 ? ((t.targetPrice - t.entryPrice) / t.entryPrice * 100) : 0;
        const stopPct = t.stopLoss > 0 ? ((t.stopLoss - t.entryPrice) / t.entryPrice * 100) : 0;
        const isSelling = sellId === t.id;

        return (
          <div key={t.id} className="bg-card rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold">{t.name}</span>
                <span className="text-[10px] text-muted-foreground ml-1">{t.symbol}</span>
              </div>
              <div className="text-right">
                <span className={`text-sm font-mono font-bold ${pnl >= 0 ? "text-primary" : "text-destructive"}`}>
                  {pnl >= 0 ? "+" : ""}{Math.round(pnl).toLocaleString()} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* 목표가 / 현재가 / 손절가 바 */}
            <div className="relative h-8 bg-muted rounded-lg overflow-hidden">
              {t.stopLoss > 0 && t.targetPrice > 0 && (() => {
                const range = t.targetPrice - t.stopLoss;
                const currentPos = range > 0 ? Math.max(0, Math.min(100, ((t.entryPrice - t.stopLoss) / range) * 100)) : 50;
                return (
                  <>
                    <div className="absolute left-0 top-0 h-full bg-destructive/20" style={{ width: `${currentPos}%` }} />
                    <div className="absolute right-0 top-0 h-full bg-primary/20" style={{ width: `${100 - currentPos}%` }} />
                    <div className="absolute top-0 h-full w-0.5 bg-foreground/50" style={{ left: `${currentPos}%` }} />
                    <div className="absolute top-1 left-1 text-[8px] text-destructive font-mono">손절 {fmt(t.stopLoss, t.currency)} ({stopPct.toFixed(1)}%)</div>
                    <div className="absolute top-1 right-1 text-[8px] text-primary font-mono">목표 {fmt(t.targetPrice, t.currency)} (+{targetPct.toFixed(1)}%)</div>
                    <div className="absolute bottom-1 text-[8px] font-mono font-bold" style={{ left: `${currentPos}%`, transform: "translateX(-50%)" }}>
                      매수 {fmt(t.entryPrice, t.currency)}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{t.quantity}주 · {t.entryDate}</span>
              <div className="flex gap-2">
                {isSelling ? (
                  <div className="flex gap-1 items-center">
                    <input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="매도가"
                      className="w-20 bg-background border border-border rounded px-1.5 py-0.5 text-[10px] font-mono" />
                    <button onClick={() => handleSell(t.id)} className="text-[10px] text-destructive font-bold">확인</button>
                    <button onClick={() => setSellId(null)} className="text-[10px] text-muted-foreground">취소</button>
                  </div>
                ) : (
                  <button onClick={() => setSellId(t.id)} className="text-[10px] text-destructive font-bold hover:underline">매도</button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {openTrades.length === 0 && !showBuyForm && (
        <p className="text-center text-xs text-muted-foreground py-6">보유 포지션이 없습니다. 퀀트 추천에서 매수해보세요.</p>
      )}

      {/* 매매 기록 */}
      {closedTrades.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-muted-foreground">매매 기록</h4>
          {closedTrades.slice(0, 10).map((t) => {
            const pnl = ((t.closePrice || 0) - t.entryPrice) * t.quantity;
            return (
              <div key={t.id} className={`rounded-lg px-3 py-2 text-xs ${pnl >= 0 ? "bg-primary/5" : "bg-destructive/5"}`}>
                <div className="flex justify-between">
                  <span>{t.name} · {t.closeReason}</span>
                  <span className={`font-mono font-bold ${pnl >= 0 ? "text-primary" : "text-destructive"}`}>
                    {pnl >= 0 ? "+" : ""}{Math.round(pnl).toLocaleString()}
                  </span>
                </div>
                <span className="text-[9px] text-muted-foreground">{t.entryDate} → {t.closeDate}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 보유 종목 뉴스 */}
      {openTrades.length > 0 && (
        <div className="space-y-2">
          {newsLoading && <div className="flex items-center gap-2 py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="text-xs text-muted-foreground">뉴스 로딩...</span></div>}

          {newsKr.length > 0 && (
            <div className="bg-card rounded-xl overflow-hidden">
              <button onClick={() => setNewsKrOpen(!newsKrOpen)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30">
                <span className="text-xs font-bold">국장 뉴스 ({newsKr.length})</span>
                {newsKrOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {newsKrOpen && <div className="px-4 pb-3 space-y-1">{newsKr.map((n, i) => <p key={i} className="text-[10px] text-muted-foreground">{n}</p>)}</div>}
            </div>
          )}

          {newsUs.length > 0 && (
            <div className="bg-card rounded-xl overflow-hidden">
              <button onClick={() => setNewsUsOpen(!newsUsOpen)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30">
                <span className="text-xs font-bold">미장 뉴스 ({newsUs.length})</span>
                {newsUsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {newsUsOpen && <div className="px-4 pb-3 space-y-1">{newsUs.map((n, i) => <p key={i} className="text-[10px] text-muted-foreground">{n}</p>)}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TradingView;
