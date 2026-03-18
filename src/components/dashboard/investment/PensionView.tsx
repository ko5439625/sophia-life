import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGuestMode } from "../../../hooks/useGuestMode";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Wallet,
  Plus,
  X,
  Edit3,
  Check,
  PieChart as PieChartIcon,
  TrendingUp,
  TrendingDown,
  Calculator,
  Sparkles,
  AlertTriangle,
  Target,
  Loader2,
  Shield,
  Building2,
  Calendar,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (Supabase-ready)
// ---------------------------------------------------------------------------

type AccountType = "IRP" | "연금저축" | "퇴직연금(DC)";

interface PensionFund {
  id: string;
  accountType: AccountType;
  name: string;
  buyPrice: number;
  currentPrice: number;
  quantity: number;
  weight: number; // percentage
}

interface PensionAccount {
  type: AccountType;
  totalDeposited: number;
  currentValue: number;
  annualLimit: number;
  annualDeposited: number;
  taxDeduction: number;
}

interface DCPensionInfo {
  monthlyEmployerContribution: number; // 월 회사 납입액
  startDate: string; // 납입 시작일
  cumulativeDeposited: number; // 누적 납입액
  currentBalance: number; // 현재 DC 운용 잔고
}

interface DCFund {
  id: string;
  name: string;
  buyPrice: number;
  currentPrice: number;
  quantity: number;
  weight: number;
}

// ---------------------------------------------------------------------------
// Constants & Mock Data
// ---------------------------------------------------------------------------

const ACCOUNT_LIMITS: Record<AccountType, number> = {
  IRP: 18000000,
  "연금저축": 6000000,
  "퇴직연금(DC)": 18000000,
};

const TAX_DEDUCTION_RATES: Record<AccountType, { rate: number; maxBase: number }> = {
  IRP: { rate: 0.165, maxBase: 9000000 },
  "연금저축": { rate: 0.165, maxBase: 6000000 },
  "퇴직연금(DC)": { rate: 0.165, maxBase: 9000000 },
};

const initialAccounts: PensionAccount[] = [
  {
    type: "IRP",
    totalDeposited: 24000000,
    currentValue: 27840000,
    annualLimit: 18000000,
    annualDeposited: 7200000,
    taxDeduction: 1188000,
  },
  {
    type: "연금저축",
    totalDeposited: 12000000,
    currentValue: 13680000,
    annualLimit: 6000000,
    annualDeposited: 3600000,
    taxDeduction: 594000,
  },
  {
    type: "퇴직연금(DC)",
    totalDeposited: 36000000,
    currentValue: 39600000,
    annualLimit: 18000000,
    annualDeposited: 0,
    taxDeduction: 0,
  },
];

const initialDCInfo: DCPensionInfo = {
  monthlyEmployerContribution: 350000,
  startDate: "2022-03-01",
  cumulativeDeposited: 16800000,
  currentBalance: 18500000,
};

const initialDCFunds: DCFund[] = [
  {
    id: "dc1",
    name: "삼성 TDF2050 (DC)",
    buyPrice: 11200,
    currentPrice: 12800,
    quantity: 600,
    weight: 45,
  },
  {
    id: "dc2",
    name: "KODEX 200 (DC)",
    buyPrice: 34500,
    currentPrice: 36100,
    quantity: 100,
    weight: 25,
  },
  {
    id: "dc3",
    name: "TIGER 국채10년 (DC)",
    buyPrice: 102000,
    currentPrice: 103500,
    quantity: 30,
    weight: 20,
  },
  {
    id: "dc4",
    name: "예금형 (원리금보장)",
    buyPrice: 10000,
    currentPrice: 10000,
    quantity: 185,
    weight: 10,
  },
];

const initialFunds: PensionFund[] = [
  {
    id: "1",
    accountType: "IRP",
    name: "삼성 TDF2050",
    buyPrice: 12500,
    currentPrice: 14200,
    quantity: 500,
    weight: 35,
  },
  {
    id: "2",
    accountType: "IRP",
    name: "TIGER S&P500 ETF",
    buyPrice: 16800,
    currentPrice: 18500,
    quantity: 300,
    weight: 30,
  },
  {
    id: "3",
    accountType: "연금저축",
    name: "KODEX 국내채권 ETF",
    buyPrice: 105000,
    currentPrice: 107200,
    quantity: 50,
    weight: 20,
  },
  {
    id: "4",
    accountType: "퇴직연금(DC)",
    name: "TIGER 글로벌리츠 ETF",
    buyPrice: 8500,
    currentPrice: 9100,
    quantity: 400,
    weight: 15,
  },
];

const targetAllocation = [
  { name: "주식", value: 60, color: "#4ECDC4" },
  { name: "채권", value: 25, color: "#F7DC6F" },
  { name: "대안", value: 10, color: "#BB8FCE" },
  { name: "현금", value: 5, color: "#45B7D1" },
];

const currentAllocationData = [
  { name: "주식", value: 65, color: "#4ECDC4" },
  { name: "채권", value: 20, color: "#F7DC6F" },
  { name: "대안", value: 12, color: "#BB8FCE" },
  { name: "현금", value: 3, color: "#45B7D1" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatKRW = (n: number) => new Intl.NumberFormat("ko-KR").format(n);
const formatMan = (n: number) => `${(n / 10000).toFixed(0)}만원`;

function generateSimulationData(
  currentBalance: number,
  monthlyDeposit: number,
  annualReturn: number,
  years: number,
  inflationRate?: number
): { year: string; value: number; realValue?: number }[] {
  const data: { year: string; value: number; realValue?: number }[] = [];
  let balance = currentBalance;
  const monthlyRate = annualReturn / 100 / 12;
  const annualInflation = (inflationRate ?? 0) / 100;
  for (let y = 0; y <= years; y++) {
    const deflator = annualInflation > 0 ? Math.pow(1 + annualInflation, y) : 1;
    data.push({
      year: `${y}년`,
      value: Math.round(balance),
      realValue: annualInflation > 0 ? Math.round(balance / deflator) : undefined,
    });
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + monthlyRate) + monthlyDeposit;
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PensionView = () => {
  const { isGuest, maskAmount } = useGuestMode();
  const [selectedAccount, setSelectedAccount] = useState<AccountType>("IRP");
  const [funds, setFunds] = useState<PensionFund[]>(initialFunds);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newFund, setNewFund] = useState({
    name: "",
    buyPrice: "",
    currentPrice: "",
    quantity: "",
    weight: "",
  });

  // DC Pension state
  const [dcInfo, setDcInfo] = useState<DCPensionInfo>(initialDCInfo);
  const [dcFunds, setDcFunds] = useState<DCFund[]>(initialDCFunds);
  const [showDcForm, setShowDcForm] = useState(false);
  const [editingDcId, setEditingDcId] = useState<string | null>(null);
  const [newDcFund, setNewDcFund] = useState({
    name: "",
    buyPrice: "",
    currentPrice: "",
    quantity: "",
    weight: "",
  });

  const dcReturnRate =
    dcInfo.cumulativeDeposited > 0
      ? (((dcInfo.currentBalance - dcInfo.cumulativeDeposited) / dcInfo.cumulativeDeposited) * 100).toFixed(2)
      : "0";
  const isDcProfit = dcInfo.currentBalance >= dcInfo.cumulativeDeposited;

  const handleAddDcFund = () => {
    if (!newDcFund.name.trim()) return;
    const fund: DCFund = {
      id: crypto.randomUUID(),
      name: newDcFund.name,
      buyPrice: parseInt(newDcFund.buyPrice.replace(/,/g, "")) || 0,
      currentPrice: parseInt(newDcFund.currentPrice.replace(/,/g, "")) || 0,
      quantity: parseInt(newDcFund.quantity) || 0,
      weight: parseFloat(newDcFund.weight) || 0,
    };
    setDcFunds((prev) => [...prev, fund]);
    setNewDcFund({ name: "", buyPrice: "", currentPrice: "", quantity: "", weight: "" });
    setShowDcForm(false);
  };

  const handleEditDcFund = (fund: DCFund) => {
    setEditingDcId(fund.id);
    setNewDcFund({
      name: fund.name,
      buyPrice: fund.buyPrice.toString(),
      currentPrice: fund.currentPrice.toString(),
      quantity: fund.quantity.toString(),
      weight: fund.weight.toString(),
    });
  };

  const handleSaveDcEdit = (id: string) => {
    setDcFunds((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              name: newDcFund.name,
              buyPrice: parseInt(newDcFund.buyPrice.replace(/,/g, "")) || 0,
              currentPrice: parseInt(newDcFund.currentPrice.replace(/,/g, "")) || 0,
              quantity: parseInt(newDcFund.quantity) || 0,
              weight: parseFloat(newDcFund.weight) || 0,
            }
          : f
      )
    );
    setEditingDcId(null);
    setNewDcFund({ name: "", buyPrice: "", currentPrice: "", quantity: "", weight: "" });
  };

  const handleDeleteDcFund = (id: string) => {
    setDcFunds((prev) => prev.filter((f) => f.id !== id));
  };

  // Simulation state
  const [simBalance, setSimBalance] = useState("27840000");
  const [simMonthly, setSimMonthly] = useState("500000");
  const [simReturn, setSimReturn] = useState("7");
  const [simTarget, setSimTarget] = useState("500000000");
  const [inflationRate, setInflationRate] = useState("2.5");
  const [monthlyLivingExpense, setMonthlyLivingExpense] = useState("3000000");

  // Hedging state
  const [pensionHedgingLoading, setPensionHedgingLoading] = useState(false);
  const [pensionHedgingResult, setPensionHedgingResult] = useState<string | null>(null);

  const account = initialAccounts.find((a) => a.type === selectedAccount)!;
  const accountFunds = funds.filter((f) => f.accountType === selectedAccount);

  const totalReturnPct =
    account.totalDeposited > 0
      ? (((account.currentValue - account.totalDeposited) / account.totalDeposited) * 100).toFixed(
          2
        )
      : "0";
  const isProfit = account.currentValue >= account.totalDeposited;
  const depositProgress = (account.annualDeposited / account.annualLimit) * 100;

  // Simulation data
  const inflation = parseFloat(inflationRate) || 0;
  const simData10 = useMemo(
    () =>
      generateSimulationData(
        parseInt(simBalance) || 0,
        parseInt(simMonthly) || 0,
        parseFloat(simReturn) || 0,
        10,
        inflation
      ),
    [simBalance, simMonthly, simReturn, inflation]
  );
  const simData20 = useMemo(
    () =>
      generateSimulationData(
        parseInt(simBalance) || 0,
        parseInt(simMonthly) || 0,
        parseFloat(simReturn) || 0,
        20,
        inflation
      ),
    [simBalance, simMonthly, simReturn, inflation]
  );
  const simData30 = useMemo(
    () =>
      generateSimulationData(
        parseInt(simBalance) || 0,
        parseInt(simMonthly) || 0,
        parseFloat(simReturn) || 0,
        30,
        inflation
      ),
    [simBalance, simMonthly, simReturn, inflation]
  );

  // Retirement coverage calculation
  const livingExpense = parseInt(monthlyLivingExpense) || 0;
  const finalNominal = simData30[simData30.length - 1]?.value || 0;
  const finalReal = simData30[simData30.length - 1]?.realValue || finalNominal;
  const nominalCoverageMonths = livingExpense > 0 ? Math.floor(finalNominal / livingExpense) : 0;
  const nominalCoverageYears = Math.floor(nominalCoverageMonths / 12);
  const nominalCoverageRemMonths = nominalCoverageMonths % 12;

  // Inflation-adjusted coverage: future living expense = current * (1+inflation)^30
  const futureMonthlyExpense = livingExpense * Math.pow(1 + inflation / 100, 30);
  const realCoverageMonths = futureMonthlyExpense > 0 ? Math.floor(finalNominal / futureMonthlyExpense) : 0;
  const realCoverageYears = Math.floor(realCoverageMonths / 12);
  const realCoverageRemMonths = realCoverageMonths % 12;

  // Purchasing power analysis
  const purchasingPowerLoss30 = inflation > 0 ? (1 - 1 / Math.pow(1 + inflation / 100, 30)) * 100 : 0;
  const currentValueOf300After30 = inflation > 0 ? 3000000 / Math.pow(1 + inflation / 100, 30) : 3000000;

  // Target reach calculation
  const targetAmount = parseInt(simTarget) || 0;
  const yearsToTarget = useMemo(() => {
    const balance = parseInt(simBalance) || 0;
    const monthly = parseInt(simMonthly) || 0;
    const rate = (parseFloat(simReturn) || 0) / 100 / 12;
    if (rate <= 0 && monthly <= 0) return null;
    let b = balance;
    for (let m = 1; m <= 360; m++) {
      b = b * (1 + rate) + monthly;
      if (b >= targetAmount) return (m / 12).toFixed(1);
    }
    return "30+";
  }, [simBalance, simMonthly, simReturn, simTarget, targetAmount]);

  // Rebalancing alerts
  const rebalanceNeeded = currentAllocationData.some((curr) => {
    const target = targetAllocation.find((t) => t.name === curr.name);
    return target && Math.abs(curr.value - target.value) > 5;
  });

  // CRUD handlers
  const handleAddFund = () => {
    if (!newFund.name.trim()) return;
    const fund: PensionFund = {
      id: crypto.randomUUID(),
      accountType: selectedAccount,
      name: newFund.name,
      buyPrice: parseInt(newFund.buyPrice.replace(/,/g, "")) || 0,
      currentPrice: parseInt(newFund.currentPrice.replace(/,/g, "")) || 0,
      quantity: parseInt(newFund.quantity) || 0,
      weight: parseFloat(newFund.weight) || 0,
    };
    setFunds((prev) => [...prev, fund]);
    setNewFund({ name: "", buyPrice: "", currentPrice: "", quantity: "", weight: "" });
    setShowForm(false);
  };

  const handleEditFund = (fund: PensionFund) => {
    setEditingId(fund.id);
    setNewFund({
      name: fund.name,
      buyPrice: fund.buyPrice.toString(),
      currentPrice: fund.currentPrice.toString(),
      quantity: fund.quantity.toString(),
      weight: fund.weight.toString(),
    });
  };

  const handleSaveEdit = (id: string) => {
    setFunds((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              name: newFund.name,
              buyPrice: parseInt(newFund.buyPrice.replace(/,/g, "")) || 0,
              currentPrice: parseInt(newFund.currentPrice.replace(/,/g, "")) || 0,
              quantity: parseInt(newFund.quantity) || 0,
              weight: parseFloat(newFund.weight) || 0,
            }
          : f
      )
    );
    setEditingId(null);
    setNewFund({ name: "", buyPrice: "", currentPrice: "", quantity: "", weight: "" });
  };

  const handleDeleteFund = (id: string) => {
    setFunds((prev) => prev.filter((f) => f.id !== id));
  };

  const handlePensionHedging = async () => {
    setPensionHedgingLoading(true);
    // Simulate AI analysis
    await new Promise((r) => setTimeout(r, 2000));
    setPensionHedgingResult(
      "현재 연금 포트폴리오는 주식 비중이 목표 대비 5%p 초과 상태입니다. " +
        "중장기적으로 금리 인하 사이클 진입이 예상되므로, 채권 비중을 5%p 확대하여 " +
        "주식 60% / 채권 25% / 대안 10% / 현금 5% 목표 배분에 맞추는 것을 권장합니다. " +
        "연금은 장기 투자이므로 단기 시장 변동에 과민하게 반응하지 않되, " +
        "구조적 금리 전환기에는 채권 듀레이션을 늘려 자본이득을 노리는 전략이 유효합니다. " +
        "리밸런싱 주기는 분기 1회를 권장합니다."
    );
    setPensionHedgingLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* ================================================================ */}
      {/* Section 1: 연금 계좌 개요 */}
      {/* ================================================================ */}
      <motion.div
        className="bg-card rounded-xl p-5 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">연금 계좌 개요</h3>
        </div>

        {/* Account selector */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["IRP", "연금저축", "퇴직연금(DC)"] as AccountType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedAccount(type)}
              className={`flex-1 relative px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedAccount === type
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {selectedAccount === type && (
                <motion.div
                  layoutId="pension-account-tab"
                  className="absolute inset-0 bg-card rounded-md shadow-sm"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10">{type}</span>
            </button>
          ))}
        </div>

        {/* Account summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground">총 납입액</p>
            <p className="text-sm font-mono font-bold mt-0.5">
              {isGuest ? maskAmount(account.totalDeposited) : `${formatKRW(account.totalDeposited)}원`}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground">현재 평가액</p>
            <p className="text-sm font-mono font-bold mt-0.5">
              {isGuest ? maskAmount(account.currentValue) : `${formatKRW(account.currentValue)}원`}
            </p>
          </div>
        </div>

        {/* Return */}
        <div className="flex items-center gap-2">
          <TrendingUp
            className={`h-3.5 w-3.5 ${isProfit ? "text-primary" : "text-destructive"}`}
          />
          <span
            className={`text-sm font-mono font-bold ${
              isProfit ? "text-primary" : "text-destructive"
            }`}
          >
            {isGuest ? `${maskAmount(account.currentValue - account.totalDeposited)} (${isProfit ? "+" : ""}${totalReturnPct}%)` : `${isProfit ? "+" : ""}${formatKRW(account.currentValue - account.totalDeposited)}원 (${isProfit ? "+" : ""}${totalReturnPct}%)`}
          </span>
        </div>

        {/* Annual limit progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">연간 납입 한도</span>
            <span className="font-mono">
              {isGuest ? "₩••• / ₩•••" : `${formatMan(account.annualDeposited)} / ${formatMan(account.annualLimit)}`}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(depositProgress, 100)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            잔여 한도: {isGuest ? "₩•••••••" : formatMan(account.annualLimit - account.annualDeposited)}
          </p>
        </div>

        {/* Tax deduction */}
        {account.taxDeduction > 0 && (
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground">세액공제 예상 금액</p>
            <p className="text-sm font-mono font-bold text-primary mt-0.5">
              {isGuest ? maskAmount(account.taxDeduction) : `${formatKRW(account.taxDeduction)}원`}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              (납입액 x {(TAX_DEDUCTION_RATES[selectedAccount].rate * 100).toFixed(1)}%, 최대{" "}
              {formatMan(TAX_DEDUCTION_RATES[selectedAccount].maxBase)} 기준)
            </p>
          </div>
        )}
      </motion.div>

      {/* ================================================================ */}
      {/* DC 납입 관리 (only when 퇴직연금(DC) selected) */}
      {/* ================================================================ */}
      <AnimatePresence>
        {selectedAccount === "퇴직연금(DC)" && (
          <motion.div
            className="bg-card rounded-xl p-5 space-y-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ delay: 0.05 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-[#45B7D1]" />
              <h3 className="text-sm font-medium">DC 납입 관리</h3>
            </div>

            {/* Employer contribution inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-lg p-3">
                <label className="text-[10px] text-muted-foreground mb-1.5 block">
                  월 회사 납입액
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={isGuest ? "•••••••" : formatKRW(dcInfo.monthlyEmployerContribution)}
                    onChange={(e) => {
                      if (isGuest) return;
                      const val = parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0;
                      setDcInfo({ ...dcInfo, monthlyEmployerContribution: val });
                    }}
                    readOnly={isGuest}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">원</span>
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <label className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  납입 시작일
                </label>
                <input
                  type="date"
                  value={dcInfo.startDate}
                  onChange={(e) => setDcInfo({ ...dcInfo, startDate: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <label className="text-[10px] text-muted-foreground mb-1.5 block">
                  누적 납입액
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={isGuest ? "•••••••" : formatKRW(dcInfo.cumulativeDeposited)}
                    onChange={(e) => {
                      if (isGuest) return;
                      const val = parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0;
                      setDcInfo({ ...dcInfo, cumulativeDeposited: val });
                    }}
                    readOnly={isGuest}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">원</span>
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <label className="text-[10px] text-muted-foreground mb-1.5 block">
                  현재 DC 운용 잔고
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={isGuest ? "•••••••" : formatKRW(dcInfo.currentBalance)}
                    onChange={(e) => {
                      if (isGuest) return;
                      const val = parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0;
                      setDcInfo({ ...dcInfo, currentBalance: val });
                    }}
                    readOnly={isGuest}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">원</span>
                </div>
              </div>
            </div>

            {/* DC Return rate */}
            <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-3">
              {isDcProfit ? (
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className="text-[10px] text-muted-foreground">DC 수익률</span>
              <span
                className={`text-sm font-mono font-bold ml-auto ${
                  isDcProfit ? "text-primary" : "text-destructive"
                }`}
              >
                {isDcProfit ? "+" : ""}
                {dcReturnRate}%
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                ({isGuest ? "₩•••" : `${isDcProfit ? "+" : ""}${formatKRW(dcInfo.currentBalance - dcInfo.cumulativeDeposited)}원`})
              </span>
            </div>

            {/* DC 운용 펀드 목록 */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieChartIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <h4 className="text-xs font-medium">DC 운용 펀드</h4>
                </div>
                <button
                  onClick={() => {
                    setShowDcForm(!showDcForm);
                    setEditingDcId(null);
                  }}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  추가
                </button>
              </div>

              {/* DC Add form */}
              <AnimatePresence>
                {showDcForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-3 bg-muted/50 rounded-lg p-4 overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground mb-1 block">펀드명</label>
                        <input
                          type="text"
                          value={newDcFund.name}
                          onChange={(e) => setNewDcFund({ ...newDcFund, name: e.target.value })}
                          placeholder="TIGER S&P500 ETF"
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">매수가</label>
                        <input
                          type="text"
                          value={newDcFund.buyPrice}
                          onChange={(e) => setNewDcFund({ ...newDcFund, buyPrice: e.target.value })}
                          placeholder="16800"
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">현재가</label>
                        <input
                          type="text"
                          value={newDcFund.currentPrice}
                          onChange={(e) => setNewDcFund({ ...newDcFund, currentPrice: e.target.value })}
                          placeholder="18500"
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">수량</label>
                        <input
                          type="text"
                          value={newDcFund.quantity}
                          onChange={(e) => setNewDcFund({ ...newDcFund, quantity: e.target.value })}
                          placeholder="300"
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">비중 (%)</label>
                        <input
                          type="text"
                          value={newDcFund.weight}
                          onChange={(e) => setNewDcFund({ ...newDcFund, weight: e.target.value })}
                          placeholder="30"
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowDcForm(false)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleAddDcFund}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        추가
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* DC Funds list */}
              <div className="space-y-2">
                {dcFunds.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    DC 운용 펀드가 없습니다.
                  </p>
                ) : (
                  dcFunds.map((fund, i) => {
                    const totalValue = fund.currentPrice * fund.quantity;
                    const invested = fund.buyPrice * fund.quantity;
                    const returnAmt = totalValue - invested;
                    const returnPct =
                      invested > 0 ? ((returnAmt / invested) * 100).toFixed(2) : "0";
                    const isUp = returnAmt >= 0;
                    const isEditing = editingDcId === fund.id;

                    return (
                      <motion.div
                        key={fund.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="bg-muted/30 rounded-lg p-3 group"
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={newDcFund.name}
                                onChange={(e) => setNewDcFund({ ...newDcFund, name: e.target.value })}
                                className="col-span-2 bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                              />
                              <input
                                type="text"
                                value={newDcFund.buyPrice}
                                onChange={(e) => setNewDcFund({ ...newDcFund, buyPrice: e.target.value })}
                                placeholder="매수가"
                                className="bg-background border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                              />
                              <input
                                type="text"
                                value={newDcFund.currentPrice}
                                onChange={(e) => setNewDcFund({ ...newDcFund, currentPrice: e.target.value })}
                                placeholder="현재가"
                                className="bg-background border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                              />
                              <input
                                type="text"
                                value={newDcFund.quantity}
                                onChange={(e) => setNewDcFund({ ...newDcFund, quantity: e.target.value })}
                                placeholder="수량"
                                className="bg-background border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                              />
                              <input
                                type="text"
                                value={newDcFund.weight}
                                onChange={(e) => setNewDcFund({ ...newDcFund, weight: e.target.value })}
                                placeholder="비중%"
                                className="bg-background border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                              />
                            </div>
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => setEditingDcId(null)}
                                className="p-1 text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleSaveDcEdit(fund.id)}
                                className="p-1 text-primary hover:text-primary/80"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium truncate">{fund.name}</span>
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {fund.weight}%
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground font-mono">
                                <span>{fund.quantity}좌</span>
                                <span>매수 {isGuest ? "₩•••" : formatKRW(fund.buyPrice)}</span>
                                <span>현재 {isGuest ? "₩•••" : formatKRW(fund.currentPrice)}</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-mono font-bold tabular-nums">
                                {isGuest ? maskAmount(totalValue) : `${formatKRW(totalValue)}원`}
                              </p>
                              <p
                                className={`text-[10px] font-mono tabular-nums ${
                                  isUp ? "text-primary" : "text-destructive"
                                }`}
                              >
                                {isUp ? "+" : ""}
                                {returnPct}%
                              </p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEditDcFund(fund)}
                                className="p-1 text-muted-foreground hover:text-foreground"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteDcFund(fund.id)}
                                className="p-1 text-muted-foreground hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================ */}
      {/* Section 2: 보유 펀드/ETF 목록 */}
      {/* ================================================================ */}
      <motion.div
        className="bg-card rounded-xl p-5 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">보유 펀드/ETF</h3>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
            }}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            추가
          </button>
        </div>

        {/* Add form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-3 bg-muted/50 rounded-lg p-4 overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    펀드/ETF명
                  </label>
                  <input
                    type="text"
                    value={newFund.name}
                    onChange={(e) => setNewFund({ ...newFund, name: e.target.value })}
                    placeholder="TIGER S&P500 ETF"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">매수가</label>
                  <input
                    type="text"
                    value={newFund.buyPrice}
                    onChange={(e) => setNewFund({ ...newFund, buyPrice: e.target.value })}
                    placeholder="16800"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">현재가</label>
                  <input
                    type="text"
                    value={newFund.currentPrice}
                    onChange={(e) => setNewFund({ ...newFund, currentPrice: e.target.value })}
                    placeholder="18500"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">수량</label>
                  <input
                    type="text"
                    value={newFund.quantity}
                    onChange={(e) => setNewFund({ ...newFund, quantity: e.target.value })}
                    placeholder="300"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">비중 (%)</label>
                  <input
                    type="text"
                    value={newFund.weight}
                    onChange={(e) => setNewFund({ ...newFund, weight: e.target.value })}
                    placeholder="30"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowForm(false)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleAddFund}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  추가
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Funds list */}
        <div className="space-y-2">
          {accountFunds.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              이 계좌에 등록된 펀드가 없습니다.
            </p>
          ) : (
            accountFunds.map((fund, i) => {
              const totalValue = fund.currentPrice * fund.quantity;
              const invested = fund.buyPrice * fund.quantity;
              const returnAmt = totalValue - invested;
              const returnPct =
                invested > 0 ? ((returnAmt / invested) * 100).toFixed(2) : "0";
              const isUp = returnAmt >= 0;
              const isEditing = editingId === fund.id;

              return (
                <motion.div
                  key={fund.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-muted/30 rounded-lg p-3 group"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newFund.name}
                          onChange={(e) => setNewFund({ ...newFund, name: e.target.value })}
                          className="col-span-2 bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <input
                          type="text"
                          value={newFund.buyPrice}
                          onChange={(e) =>
                            setNewFund({ ...newFund, buyPrice: e.target.value })
                          }
                          placeholder="매수가"
                          className="bg-background border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <input
                          type="text"
                          value={newFund.currentPrice}
                          onChange={(e) =>
                            setNewFund({ ...newFund, currentPrice: e.target.value })
                          }
                          placeholder="현재가"
                          className="bg-background border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <input
                          type="text"
                          value={newFund.quantity}
                          onChange={(e) =>
                            setNewFund({ ...newFund, quantity: e.target.value })
                          }
                          placeholder="수량"
                          className="bg-background border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <input
                          type="text"
                          value={newFund.weight}
                          onChange={(e) =>
                            setNewFund({ ...newFund, weight: e.target.value })
                          }
                          placeholder="비중%"
                          className="bg-background border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleSaveEdit(fund.id)}
                          className="p-1 text-primary hover:text-primary/80"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium truncate">
                            {fund.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {fund.weight}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground font-mono">
                          <span>{fund.quantity}좌</span>
                          <span>매수 {isGuest ? "₩•••" : formatKRW(fund.buyPrice)}</span>
                          <span>현재 {isGuest ? "₩•••" : formatKRW(fund.currentPrice)}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-mono font-bold tabular-nums">
                          {isGuest ? maskAmount(totalValue) : `${formatKRW(totalValue)}원`}
                        </p>
                        <p
                          className={`text-[10px] font-mono tabular-nums ${
                            isUp ? "text-primary" : "text-destructive"
                          }`}
                        >
                          {isUp ? "+" : ""}
                          {returnPct}%
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditFund(fund)}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteFund(fund.id)}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* ================================================================ */}
      {/* Section 3: 자산 배분 현황 */}
      {/* ================================================================ */}
      <motion.div
        className="bg-card rounded-xl p-5 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">자산 배분 현황</h3>
        </div>

        {/* Side-by-side donuts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Current */}
          <div>
            <p className="text-xs font-medium text-center mb-2 text-muted-foreground">
              현재 배분
            </p>
            <div className="w-full aspect-square max-w-[140px] mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={currentAllocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="70%"
                    paddingAngle={2}
                    dataKey="value"
                    animationDuration={800}
                  >
                    {currentAllocationData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [`${val}%`, "비중"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1 mt-2">
              {currentAllocationData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[10px] flex-1">{item.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Target */}
          <div>
            <p className="text-xs font-medium text-center mb-2 text-primary">
              목표 배분
            </p>
            <div className="w-full aspect-square max-w-[140px] mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={targetAllocation}
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="70%"
                    paddingAngle={2}
                    dataKey="value"
                    animationDuration={800}
                  >
                    {targetAllocation.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [`${val}%`, "비중"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1 mt-2">
              {targetAllocation.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[10px] flex-1">{item.name}</span>
                  <span className="text-[10px] font-mono text-primary font-medium">
                    {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rebalancing alert */}
        {rebalanceNeeded && (
          <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-yellow-500">리밸런싱 필요</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                현재 자산 배분이 목표와 5%p 이상 차이가 있습니다. 리밸런싱을 권장합니다.
              </p>
              <div className="mt-2 space-y-1">
                {currentAllocationData.map((curr) => {
                  const target = targetAllocation.find((t) => t.name === curr.name);
                  if (!target) return null;
                  const diff = curr.value - target.value;
                  if (Math.abs(diff) <= 2) return null;
                  return (
                    <p key={curr.name} className="text-[10px] font-mono">
                      <span>{curr.name}</span>:{" "}
                      <span className={diff > 0 ? "text-destructive" : "text-primary"}>
                        {curr.value}% → {target.value}% ({diff > 0 ? "▼" : "▲"}
                        {Math.abs(diff)}%p)
                      </span>
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* ================================================================ */}
      {/* Section 4: 중장기 시뮬레이션 */}
      {/* ================================================================ */}
      <motion.div
        className="bg-card rounded-xl p-5 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">중장기 시뮬레이션</h3>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">
              현재 잔고 (원)
            </label>
            <input
              type="text"
              value={simBalance}
              onChange={(e) => setSimBalance(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">
              월 납입액 (원)
            </label>
            <input
              type="text"
              value={simMonthly}
              onChange={(e) => setSimMonthly(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">
              예상 연 수익률 (%)
            </label>
            <input
              type="text"
              value={simReturn}
              onChange={(e) => setSimReturn(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">
              물가상승률 (%)
            </label>
            <input
              type="text"
              value={inflationRate}
              onChange={(e) => setInflationRate(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">
              목표 은퇴 자금 (원)
            </label>
            <input
              type="text"
              value={simTarget}
              onChange={(e) => setSimTarget(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">
              월 생활비 (원)
            </label>
            <input
              type="text"
              value={monthlyLivingExpense}
              onChange={(e) => setMonthlyLivingExpense(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* Target reach */}
        {yearsToTarget && (
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground">
              목표 금액 {isGuest ? maskAmount(targetAmount) : `${formatKRW(targetAmount)}원`} 도달 예상
            </p>
            <p className="text-lg font-mono font-bold text-primary mt-0.5">
              약 {yearsToTarget}년
            </p>
          </div>
        )}

        {/* Chart - Nominal + Real */}
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={simData30}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.3} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => isGuest ? "•••" : `${(v / 100000000).toFixed(1)}억`}
              />
              <Tooltip
                formatter={(val: number, name: string) => [
                  isGuest ? "₩•••••••" : `${formatKRW(val)}원`,
                  name === "value" ? "명목 금액" : name === "realValue" ? "실질 가치" : "목표",
                ]}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4ECDC4"
                strokeWidth={2}
                dot={false}
                animationDuration={1000}
                name="value"
              />
              {inflation > 0 && (
                <Line
                  type="monotone"
                  dataKey="realValue"
                  stroke="#FFB347"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  animationDuration={1000}
                  name="realValue"
                />
              )}
              {/* Target line */}
              {targetAmount > 0 && (
                <Line
                  type="monotone"
                  dataKey={() => targetAmount}
                  stroke="#FF6B6B"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  name="목표"
                  legendType="line"
                />
              )}
              <Legend
                verticalAlign="top"
                height={24}
                iconSize={8}
                wrapperStyle={{ fontSize: 10 }}
                formatter={(value: string) =>
                  value === "value" ? "명목 금액" : value === "realValue" ? "실질 가치" : "목표"
                }
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart legend note */}
        {inflation > 0 && (
          <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-[#4ECDC4] rounded" />
              <span>명목 금액 (실제 잔고)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-[#FFB347] rounded border-dashed" />
              <span>실질 가치 (물가 반영)</span>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { label: "10년 후", data: simData10 },
            { label: "20년 후", data: simData20 },
            { label: "30년 후", data: simData30 },
          ].map(({ label, data }) => {
            const val = data[data.length - 1]?.value || 0;
            const realVal = data[data.length - 1]?.realValue;
            return (
              <div key={label} className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="text-xs font-mono font-bold mt-0.5">
                  {isGuest ? "₩•••••••" : val >= 100000000
                    ? `${(val / 100000000).toFixed(1)}억`
                    : formatMan(val)}
                </p>
                {realVal !== undefined && (
                  <p className="text-[9px] font-mono text-[#FFB347] mt-0.5">
                    실질 {isGuest ? "₩•••••••" : realVal >= 100000000
                      ? `${(realVal / 100000000).toFixed(1)}억`
                      : formatMan(realVal)}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* ============================================ */}
        {/* Retirement Coverage Calculator */}
        {/* ============================================ */}
        {livingExpense > 0 && (
          <div className="space-y-4 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <h4 className="text-xs font-medium">노후 보장 기간</h4>
            </div>

            {/* Nominal coverage */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">현재 기준</span>
                <span className="text-sm font-mono font-bold text-primary">
                  {nominalCoverageYears}년 {nominalCoverageRemMonths}개월 보장
                </span>
              </div>
              {/* Visual gauge */}
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((nominalCoverageYears / 40) * 100, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                <span>0년</span>
                <span>10년</span>
                <span>20년</span>
                <span>30년</span>
                <span>40년</span>
              </div>
            </div>

            {/* Inflation-adjusted coverage */}
            {inflation > 0 && (
              <div className="bg-[#FFB347]/5 border border-[#FFB347]/15 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">물가상승률 반영 시</span>
                  <span className="text-sm font-mono font-bold text-[#FFB347]">
                    {realCoverageYears}년 {realCoverageRemMonths}개월 보장
                  </span>
                </div>
                {/* Visual gauge */}
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[#FFB347]"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((realCoverageYears / 40) * 100, 100)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                  <span>0년</span>
                  <span>10년</span>
                  <span>20년</span>
                  <span>30년</span>
                  <span>40년</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* Purchasing Power Analysis */}
        {/* ============================================ */}
        {inflation > 0 && (
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-[#FFB347]" />
              <h4 className="text-xs font-medium">구매력 분석</h4>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground">30년 후 연금 잔고의 현재 가치</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-mono font-bold">
                    {isGuest ? maskAmount(finalReal) : finalReal >= 100000000
                      ? `${(finalReal / 100000000).toFixed(1)}억원`
                      : `${formatKRW(finalReal)}원`}
                  </p>
                  <span className="text-[10px] font-mono text-destructive">
                    ({purchasingPowerLoss30.toFixed(1)}% 감소)
                  </span>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground">
                  30년 후 300만원의 현재 가치
                </p>
                <p className="text-sm font-mono font-bold mt-1">
                  {isGuest ? maskAmount(Math.round(currentValueOf300After30)) : `~${formatKRW(Math.round(currentValueOf300After30))}원`}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  물가상승률 {inflation}% 기준, 매년 화폐 가치가 줄어듭니다
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* ================================================================ */}
      {/* Section 5: 헷징 전략 (연금용) */}
      {/* ================================================================ */}
      <motion.div
        className="bg-card rounded-xl p-5 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">헷징 전략 (연금용)</h3>
        </div>

        <p className="text-[10px] text-muted-foreground">
          연금은 중장기 투자이므로 단기 변동은 무시하고, 구조적 변화에만 대응합니다.
          AI가 연금 포트폴리오와 시장 상황을 분석하여 리밸런싱을 추천합니다.
        </p>

        {!pensionHedgingResult && !pensionHedgingLoading ? (
          <button
            onClick={handlePensionHedging}
            className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg p-4 transition-colors"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              헷징 분석 실행
            </span>
          </button>
        ) : pensionHedgingLoading ? (
          <div className="space-y-3">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-5/6" />
            </div>
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground ml-2">
                연금 포트폴리오 분석 중...
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {pensionHedgingResult}
              </p>
            </div>
            <button
              onClick={handlePensionHedging}
              className="w-full text-xs text-primary hover:text-primary/80 transition-colors py-2"
            >
              다시 분석하기
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PensionView;
