import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, TrendingUp, TrendingDown, Building2 } from "lucide-react";
import { searchByRegion, getRegionCodes, sqmToPyeong, type ApartmentSearchResult } from "../../../services/realEstateApi";
import { formatKRW } from "../finance/budgetData";

const RealEstateSearch = () => {
  const [regionCode, setRegionCode] = useState("");
  const [results, setResults] = useState<ApartmentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const regionCodes = getRegionCodes();

  const handleSearch = async () => {
    if (!regionCode) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchByRegion(regionCode);
      setResults(data);
    } catch (e) {
      console.warn("실거래가 검색 실패:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (man: number) => {
    if (man >= 10000) {
      const eok = Math.floor(man / 10000);
      const rest = man % 10000;
      return rest > 0 ? `${eok}억 ${formatKRW(rest)}` : `${eok}억`;
    }
    return `${formatKRW(man)}만`;
  };

  return (
    <div className="space-y-4">
      {/* 검색 */}
      <div className="bg-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">실거래가 검색</h3>
          <span className="text-[9px] text-muted-foreground">국토교통부 공공데이터</span>
        </div>
        <div className="flex gap-2">
          <select value={regionCode} onChange={(e) => setRegionCode(e.target.value)}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">지역 선택</option>
            {regionCodes.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
          <button onClick={handleSearch} disabled={!regionCode || loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            검색
          </button>
        </div>
        {!localStorage.getItem("sophia-api-data") && (
          <p className="text-[10px] text-amber-500 mt-2">{"설정 > 공공데이터포털 API 키를 입력해주세요"}</p>
        )}
      </div>

      {/* 결과 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">최근 6개월 실거래 조회 중...</span>
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10">해당 지역의 실거래 데이터가 없습니다</p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-mono">{results.length}개 아파트 실거래 내역</p>
          {results.map((apt) => {
            const isExpanded = expanded === apt.aptName;
            return (
              <motion.div key={apt.aptName} className="bg-card rounded-xl overflow-hidden"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <button onClick={() => setExpanded(isExpanded ? null : apt.aptName)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold">{apt.aptName}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">{apt.address}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono font-bold">{formatPrice(apt.recentPrice)}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">{sqmToPyeong(apt.area)}평</span>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>최근 거래: {apt.recentDate}</span>
                    <span>거래 {apt.transactions.length}건</span>
                    {apt.jeonseRate > 0 && <span>전세가율 {apt.jeonseRate}%</span>}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 space-y-1 border-t border-border pt-2">
                    <p className="text-[10px] text-muted-foreground font-mono mb-1">거래 내역</p>
                    {apt.transactions.slice(0, 10).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between text-xs py-1">
                        <div className="flex gap-2 text-muted-foreground">
                          <span className="font-mono">{tx.dealDate}</span>
                          <span>{tx.dong}</span>
                          <span>{sqmToPyeong(tx.area)}평</span>
                          <span>{tx.floor}층</span>
                        </div>
                        <span className="font-mono font-bold">{formatPrice(tx.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RealEstateSearch;
