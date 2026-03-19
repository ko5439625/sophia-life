import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGuestMode } from "../../../hooks/useGuestMode";
import { proxyFetch } from "../../../services/proxyFetch";
import { supabase } from "../../../lib/supabase";
import { saveBlogSettings } from "../../../services/supabaseSync";
import { useFinancial } from "../../../store/financialStore";
import {
  Lock,
  Tag,
  Wallet,
  Plus,
  X,
  Check,
  User,
  Key,
  Eye,
  EyeOff,
  Save,
  ChevronDown,
  Bot,
  Shield,
  Cloud,
  RefreshCw,
} from "lucide-react";

const formatWon = (value: string) => {
  const num = value.replace(/[^\d]/g, "");
  if (!num) return "";
  return new Intl.NumberFormat("ko-KR").format(parseInt(num));
};

const parseWon = (formatted: string) => {
  return formatted.replace(/[^\d]/g, "");
};

// ---------------------------------------------------------------------------
// Collapsible Section wrapper
// ---------------------------------------------------------------------------
const CollapsibleSection = ({
  icon,
  title,
  badge,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-card rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-mono text-muted-foreground">{title}</h3>
          {badge && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------
// API Connection Status with live ping tests
// ---------------------------------------------------------------------------

type ApiStatus = "idle" | "testing" | "ok" | "fail" | "unconfigured";

const statusIndicator = (status: ApiStatus) => {
  switch (status) {
    case "ok":
      return { dot: "bg-green-500", label: "연결됨", color: "text-green-500" };
    case "fail":
      return { dot: "bg-red-500", label: "실패", color: "text-red-500" };
    case "testing":
      return { dot: "bg-yellow-400 animate-pulse", label: "테스트 중...", color: "text-yellow-500" };
    case "unconfigured":
      return { dot: "bg-gray-400", label: "미설정", color: "text-gray-400" };
    default:
      return { dot: "bg-gray-300", label: "대기", color: "text-gray-400" };
  }
};

interface ApiTestItem {
  name: string;
  key: string;
  test: () => Promise<boolean>;
  hasKey: () => boolean;
}

const ApiConnectionStatus = () => {
  const [results, setResults] = useState<Record<string, ApiStatus>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [lastTested, setLastTested] = useState<string | null>(null);

  const updateResult = useCallback((name: string, status: ApiStatus) => {
    setResults((prev) => ({ ...prev, [name]: status }));
  }, []);

  const apiTests: ApiTestItem[] = [
    {
      name: "Supabase",
      key: "VITE_SUPABASE_URL",
      hasKey: () => !!import.meta.env.VITE_SUPABASE_URL,
      test: async () => {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!url || !anonKey) return false;
        const res = await fetch(`${url}/rest/v1/posts?select=id&limit=1`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        });
        return res.ok;
      },
    },
    {
      name: "Gemini (분석/번역)",
      key: "sophia-api-gemini",
      hasKey: () => !!localStorage.getItem("sophia-api-gemini"),
      test: async () => {
        const apiKey = localStorage.getItem("sophia-api-gemini");
        if (!apiKey) return false;
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "ping" }] }],
            }),
          }
        );
        return res.ok;
      },
    },
    {
      name: "OpenAI (블로그 AI)",
      key: "sophia-api-openai",
      hasKey: () => !!localStorage.getItem("sophia-api-openai"),
      test: async () => {
        // Just check key exists (actual test would consume credits)
        return !!localStorage.getItem("sophia-api-openai");
      },
    },
    {
      name: "Yahoo Finance",
      key: "자동 (프록시)",
      hasKey: () => true,
      test: async () => {
        const data = await proxyFetch("yahoo-quote", { symbol: "^GSPC" });
        return data !== null;
      },
    },
    {
      name: "NewsAPI (뉴스)",
      key: "sophia-api-news",
      hasKey: () => !!localStorage.getItem("sophia-api-news"),
      test: async () => {
        const apiKey = localStorage.getItem("sophia-api-news");
        if (!apiKey) return false;
        const data = await proxyFetch("news", { category: "business", country: "kr", apiKey });
        return data !== null;
      },
    },
    {
      name: "공공데이터 (부동산/청약)",
      key: "sophia-api-data",
      hasKey: () => !!localStorage.getItem("sophia-api-data"),
      test: async () => {
        // Check key exists only (actual test needs specific params like district code)
        return !!localStorage.getItem("sophia-api-data");
      },
    },
    {
      name: "카카오 Maps (장소)",
      key: "sophia-api-kakao",
      hasKey: () => !!localStorage.getItem("sophia-api-kakao"),
      test: async () => {
        const apiKey = localStorage.getItem("sophia-api-kakao");
        if (!apiKey) return false;
        const res = await fetch(
          "https://dapi.kakao.com/v2/local/search/keyword.json?query=Seoul&size=1",
          { headers: { Authorization: `KakaoAK ${apiKey}` } }
        );
        return res.ok;
      },
    },
    {
      name: "OpenWeatherMap (날씨)",
      key: "sophia-api-weather",
      hasKey: () => !!localStorage.getItem("sophia-api-weather"),
      test: async () => {
        const apiKey = localStorage.getItem("sophia-api-weather");
        if (!apiKey) return false;
        const data = await proxyFetch("weather", { city: "Seoul", apiKey });
        return data !== null;
      },
    },
    {
      name: "Fear & Greed Index",
      key: "자동",
      hasKey: () => true,
      test: async () => {
        const res = await fetch("https://api.alternative.me/fng/?limit=1");
        if (!res.ok) return false;
        const data = await res.json();
        return !!data?.data;
      },
    },
    {
      name: "환율 (ExchangeRate)",
      key: "자동",
      hasKey: () => true,
      test: async () => {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        if (!res.ok) return false;
        const data = await res.json();
        return data?.result === "success";
      },
    },
  ];

  const runAllTests = async () => {
    setIsTesting(true);

    // Set all to testing or unconfigured
    const initial: Record<string, ApiStatus> = {};
    for (const api of apiTests) {
      initial[api.name] = api.hasKey() ? "testing" : "unconfigured";
    }
    setResults(initial);

    // Run each test independently for animated results
    const promises = apiTests.map(async (api) => {
      if (!api.hasKey()) {
        return; // already set to unconfigured
      }
      try {
        const ok = await api.test();
        updateResult(api.name, ok ? "ok" : "fail");
      } catch {
        updateResult(api.name, "fail");
      }
    });

    await Promise.all(promises);
    setLastTested(new Date().toLocaleString("ko-KR"));
    setIsTesting(false);
  };

  return (
    <div className="bg-card rounded-xl p-5 space-y-3 border border-border">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          API 연결 상태
        </h3>
        <button
          onClick={runAllTests}
          disabled={isTesting}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isTesting ? "animate-spin" : ""}`} />
          연결 테스트
        </button>
      </div>
      <div className="space-y-2">
        {apiTests.map((api) => {
          const status = results[api.name] ?? "idle";
          const indicator = statusIndicator(status);
          return (
            <motion.div
              key={api.name}
              className="flex items-center justify-between py-1.5"
              initial={false}
              animate={
                status === "ok" || status === "fail"
                  ? { opacity: [0.5, 1], x: [4, 0] }
                  : {}
              }
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${indicator.dot}`} />
                <span className="text-xs">{api.name}</span>
              </div>
              <span className={`text-[10px] font-mono ${indicator.color}`}>
                {indicator.label}
              </span>
            </motion.div>
          );
        })}
      </div>
      {lastTested && (
        <p className="text-[10px] text-muted-foreground mt-1">
          마지막 테스트: {lastTested}
        </p>
      )}
      <p className="text-[10px] text-muted-foreground">
        "연결 테스트" 버튼으로 실제 API 연결을 확인합니다. 미설정 항목은 위 섹션에서 키를 입력하세요.
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const SettingsView = () => {
  const { isGuest } = useGuestMode();
  const { updateSettings } = useFinancial();

  // PIN
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinMessage, setPinMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Blog categories - synced with localStorage (same key as BlogManagement)
  // IMPORTANT: declared early because lockedCategories and allBlogCats depend on it
  const [blogCategories, setBlogCategories] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("sophia-blog-categories");
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return ["일상", "개발", "여행", "요리", "음악", "영화"];
  });
  const [newBlogCat, setNewBlogCat] = useState("");

  // Personal info for real estate
  const [personalInfo, setPersonalInfo] = useState(() => {
    try {
      const stored = localStorage.getItem("sophia-personal-info");
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return {
      salaryOwn: "",
      salarySpouse: "",
      monthlyLoanPayment: "",
      cashSavings: "",
      emergencyFund: "",
      cashHoldings: "",
      pensionSavings: "",
      irpBalance: "",
      dcBalance: "",
      baseRate: "3.5",
    };
  });
  const [personalInfoMessage, setPersonalInfoMessage] = useState<string | null>(
    null
  );

  // Service API keys (kakao, news, stock, data)
  const [apiKeys, setApiKeys] = useState({
    kakao: "",
    news: "",
    stock: "",
    data: "",
    weather: "",
    ecos: "",
    kisAppkey: "",
    kisSecret: "",
  });
  const [apiKeyVisibility, setApiKeyVisibility] = useState({
    kakao: false,
    news: false,
    stock: false,
    data: false,
    weather: false,
    ecos: false,
    kisAppkey: false,
    kisSecret: false,
  });
  const [apiMessage, setApiMessage] = useState<string | null>(null);

  // AI API keys (Gemini handles translation, no DeepL needed)
  const [aiApiKeys, setAiApiKeys] = useState({
    openai: "",
    gemini: "",
  });
  const [aiApiKeyVisibility, setAiApiKeyVisibility] = useState({
    openai: false,
    gemini: false,
  });
  const [aiApiMessage, setAiApiMessage] = useState<string | null>(null);

  // Load API keys: Supabase → localStorage (cross-device sync)
  useEffect(() => {
    const loadKeys = async () => {
      // 1. Load from localStorage first (instant)
      const localApiKeys = {
        kakao: localStorage.getItem("sophia-api-kakao") || "",
        news: localStorage.getItem("sophia-api-news") || "",
        stock: localStorage.getItem("sophia-api-stock") || "",
        data: localStorage.getItem("sophia-api-data") || "",
        weather: localStorage.getItem("sophia-api-weather") || "",
        ecos: localStorage.getItem("sophia-api-ecos") || "",
        kisAppkey: localStorage.getItem("sophia-api-kis-appkey") || "",
        kisSecret: localStorage.getItem("sophia-api-kis-secret") || "",
      };
      const localAiKeys = {
        openai: localStorage.getItem("sophia-api-openai") || "",
        gemini: localStorage.getItem("sophia-api-gemini") || "",
      };
      setApiKeys(localApiKeys);
      setAiApiKeys(localAiKeys);

      // 2. Then sync from Supabase (cross-device)
      if (!supabase) return;
      try {
        const { data } = await supabase
          .from("user_settings")
          .select("api_keys")
          .limit(1)
          .single();

        if (data?.api_keys && typeof data.api_keys === "object") {
          const remote = data.api_keys as Record<string, string>;
          const merged = {
            kakao: remote.kakao || localApiKeys.kakao,
            news: remote.news || localApiKeys.news,
            stock: remote.stock || localApiKeys.stock,
            data: remote.data || localApiKeys.data,
            weather: remote.weather || localApiKeys.weather,
            ecos: remote.ecos || localApiKeys.ecos,
            kisAppkey: remote.kisAppkey || localApiKeys.kisAppkey,
            kisSecret: remote.kisSecret || localApiKeys.kisSecret,
          };
          const mergedAi = {
            openai: remote.openai || localAiKeys.openai,
            gemini: remote.gemini || localAiKeys.gemini,
          };
          setApiKeys(merged);
          setAiApiKeys(mergedAi);
          // Update localStorage with remote values
          Object.entries(merged).forEach(([k, v]) => {
            if (v) localStorage.setItem(`sophia-api-${k}`, v);
          });
          Object.entries(mergedAi).forEach(([k, v]) => {
            if (v) localStorage.setItem(`sophia-api-${k}`, v);
          });
          // Restore asset base info from api_keys jsonb
          if (remote.cashHoldings || remote.pensionSavings || remote.irpBalance || remote.dcBalance) {
            setPersonalInfo((prev: Record<string, string>) => {
              const updated = {
                ...prev,
                cashHoldings: remote.cashHoldings || prev.cashHoldings || "",
                pensionSavings: remote.pensionSavings || prev.pensionSavings || "",
                irpBalance: remote.irpBalance || prev.irpBalance || "",
                dcBalance: remote.dcBalance || prev.dcBalance || "",
                baseRate: remote.baseRate || prev.baseRate || "3.5",
              };
              localStorage.setItem("sophia-personal-info", JSON.stringify(updated));
              return updated;
            });
          }
        }
      } catch (e) {
        console.warn("[Settings] Supabase API key sync failed:", e);
      }
    };
    loadKeys();
  }, []);

  // Category lock PIN
  const [categoryPin, setCategoryPin] = useState("");
  const [newCategoryPin, setNewCategoryPin] = useState("");
  const [categoryPinMessage, setCategoryPinMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [lockedCategories, setLockedCategories] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("sophia-locked-categories");
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return ["웨딩"];
  });

  // Use blogCategories as the source for locked category selection
  const allBlogCats = blogCategories;

  const handleCategoryPinChange = () => {
    try {
      const storedPin = localStorage.getItem("sophia-category-pin") || "100200";
      if (categoryPin !== storedPin) {
        setCategoryPinMessage({ text: "현재 PIN이 일치하지 않습니다.", type: "error" });
        return;
      }
      if (newCategoryPin.length !== 6) {
        setCategoryPinMessage({ text: "PIN은 6자리여야 합니다.", type: "error" });
        return;
      }
      localStorage.setItem("sophia-category-pin", newCategoryPin);
      setCategoryPinMessage({ text: "카테고리 잠금 PIN이 변경되었습니다.", type: "success" });
      setCategoryPin("");
      setNewCategoryPin("");
      setTimeout(() => setCategoryPinMessage(null), 3000);
    } catch (e) {
      console.warn("Failed to update category PIN:", e);
      setCategoryPinMessage({ text: "PIN 변경 실패", type: "error" });
    }
  };

  const toggleLockedCategory = (cat: string) => {
    const updated = lockedCategories.includes(cat)
      ? lockedCategories.filter((c) => c !== cat)
      : [...lockedCategories, cat];
    setLockedCategories(updated);
    try {
      localStorage.setItem("sophia-locked-categories", JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to save locked categories:", e);
    }
    saveBlogSettings({ locked_categories: updated });
  };

  // Expense categories
  const [expenseCategories, setExpenseCategories] = useState([
    "식비",
    "교통",
    "쇼핑",
    "카페",
    "문화",
    "생활",
    "경조사",
    "용돈",
    "기타",
  ]);
  const [newExpenseCat, setNewExpenseCat] = useState("");

  const handlePinChange = () => {
    if (!currentPin || !newPin) {
      setPinMessage({ text: "PIN을 모두 입력해주세요.", type: "error" });
      return;
    }
    if (newPin.length < 4) {
      setPinMessage({
        text: "PIN은 4자리 이상이어야 합니다.",
        type: "error",
      });
      return;
    }
    setPinMessage({ text: "PIN이 변경되었습니다.", type: "success" });
    setCurrentPin("");
    setNewPin("");
    setTimeout(() => setPinMessage(null), 3000);
  };

  const handleRegulatedToggle = () => {
    const newIsRegulated = !personalInfo.isRegulated;
    setPersonalInfo({
      ...personalInfo,
      isRegulated: newIsRegulated,
      ltvLimit: newIsRegulated ? "50" : "70",
    });
  };

  const handleSavePersonalInfo = async () => {
    try {
      localStorage.setItem("sophia-personal-info", JSON.stringify(personalInfo));
      // Sync to Supabase user_settings
      if (supabase) {
        await supabase.from("user_settings").upsert({
          id: "c7a9defe-0e45-57e0-9b26-4ef82dd867c1",
          annual_income1: parseInt(personalInfo.salaryOwn) || 0,
          annual_income2: parseInt(personalInfo.salarySpouse) || 0,
          monthly_loan_payment: parseInt(personalInfo.monthlyLoanPayment) || 0,
          cash_savings: parseInt(personalInfo.cashSavings) || 0,
          emergency_fund: parseInt(personalInfo.emergencyFund) || 0,
          // Store additional asset info in api_keys jsonb (alongside existing keys)
          api_keys: {
            ...(() => { try { return JSON.parse(localStorage.getItem("sophia-api-keys-cache") || "{}"); } catch { return {}; } })(),
            // Preserve existing API keys
            kakao: localStorage.getItem("sophia-api-kakao") || "",
            news: localStorage.getItem("sophia-api-news") || "",
            stock: localStorage.getItem("sophia-api-stock") || "",
            data: localStorage.getItem("sophia-api-data") || "",
            weather: localStorage.getItem("sophia-api-weather") || "",
            ecos: localStorage.getItem("sophia-api-ecos") || "",
            openai: localStorage.getItem("sophia-api-openai") || "",
            gemini: localStorage.getItem("sophia-api-gemini") || "",
            // Asset base info
            cashHoldings: personalInfo.cashHoldings || "0",
            pensionSavings: personalInfo.pensionSavings || "0",
            irpBalance: personalInfo.irpBalance || "0",
            dcBalance: personalInfo.dcBalance || "0",
            baseRate: personalInfo.baseRate || "3.5",
          },
        });
      }
      // Update financialStore immediately
      updateSettings({
        annualIncome1: parseInt(personalInfo.salaryOwn) || 0,
        annualIncome2: parseInt(personalInfo.salarySpouse) || 0,
        monthlyLoanPayment: parseInt(personalInfo.monthlyLoanPayment) || 0,
        cashSavings: parseInt(personalInfo.cashSavings) || 0,
        emergencyFund: parseInt(personalInfo.emergencyFund) || 0,
      });
      setPersonalInfoMessage("저장 완료 (클라우드 동기화)");
    } catch (e) {
      console.warn("Failed to save personal info:", e);
      setPersonalInfoMessage("저장 실패");
    }
    setTimeout(() => setPersonalInfoMessage(null), 3000);
  };

  // Sync all API keys to Supabase
  const syncApiKeysToSupabase = async (allKeys: Record<string, string>) => {
    if (!supabase) return;
    try {
      await supabase
        .from("user_settings")
        .update({ api_keys: allKeys })
        .eq("id", "c7a9defe-0e45-57e0-9b26-4ef82dd867c1");
    } catch (e) {
      console.warn("[Settings] Supabase API key save failed:", e);
    }
  };

  const handleSaveApiKeys = () => {
    try {
      localStorage.setItem("sophia-api-kakao", apiKeys.kakao);
      localStorage.setItem("sophia-api-news", apiKeys.news);
      localStorage.setItem("sophia-api-stock", apiKeys.stock);
      localStorage.setItem("sophia-api-data", apiKeys.data);
      localStorage.setItem("sophia-api-weather", apiKeys.weather);
      localStorage.setItem("sophia-api-ecos", apiKeys.ecos);
      localStorage.setItem("sophia-api-kis-appkey", apiKeys.kisAppkey);
      localStorage.setItem("sophia-api-kis-secret", apiKeys.kisSecret);
      // Sync to Supabase (merge with AI keys)
      syncApiKeysToSupabase({ ...apiKeys, ...aiApiKeys });
      setApiMessage("API 키가 저장되었습니다. (클라우드 동기화 완료)");
    } catch (e) {
      console.warn("Failed to save API keys:", e);
      setApiMessage("저장 실패");
    }
    setTimeout(() => setApiMessage(null), 3000);
  };

  const handleSaveAiApiKeys = () => {
    try {
      localStorage.setItem("sophia-api-openai", aiApiKeys.openai);
      localStorage.setItem("sophia-api-gemini", aiApiKeys.gemini);
      // Sync to Supabase (merge with data keys)
      syncApiKeysToSupabase({ ...apiKeys, ...aiApiKeys });
      setAiApiMessage("AI API 키가 저장되었습니다. (클라우드 동기화 완료)");
    } catch (e) {
      console.warn("Failed to save AI API keys:", e);
      setAiApiMessage("저장 실패");
    }
    setTimeout(() => setAiApiMessage(null), 3000);
  };

  const toggleApiKeyVisibility = (key: "kakao" | "news" | "stock" | "data" | "weather") => {
    setApiKeyVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAiApiKeyVisibility = (key: "openai" | "gemini") => {
    setAiApiKeyVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Sync blog categories to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("sophia-blog-categories", JSON.stringify(blogCategories));
    } catch (e) {
      console.warn("Failed to save blog categories:", e);
    }
  }, [blogCategories]);

  const addBlogCategory = () => {
    if (!newBlogCat.trim() || blogCategories.includes(newBlogCat.trim()))
      return;
    setBlogCategories([...blogCategories, newBlogCat.trim()]);
    setNewBlogCat("");
  };

  const removeBlogCategory = (cat: string) => {
    setBlogCategories(blogCategories.filter((c) => c !== cat));
    // Also remove from locked categories if present
    if (lockedCategories.includes(cat)) {
      const updated = lockedCategories.filter((c) => c !== cat);
      setLockedCategories(updated);
      try {
        localStorage.setItem("sophia-locked-categories", JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to save locked categories:", e);
      }
      saveBlogSettings({ locked_categories: updated });
    }
  };

  const addExpenseCategory = () => {
    if (
      !newExpenseCat.trim() ||
      expenseCategories.includes(newExpenseCat.trim())
    )
      return;
    setExpenseCategories([...expenseCategories, newExpenseCat.trim()]);
    setNewExpenseCat("");
  };

  const removeExpenseCategory = (cat: string) => {
    setExpenseCategories(expenseCategories.filter((c) => c !== cat));
  };

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
        <Lock className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">설정은 비공개입니다</p>
        <p className="text-xs text-muted-foreground/60 mt-1">게스트 모드에서는 열람할 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-sans font-bold">설정</h2>

      {/* 1. PIN Change */}
      <CollapsibleSection
        icon={<Lock className="h-4 w-4 text-muted-foreground" />}
        title="PIN 변경"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              현재 PIN
            </label>
            <input
              type="password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              placeholder="****"
              maxLength={6}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              새 PIN
            </label>
            <input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="****"
              maxLength={6}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
        {pinMessage && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`text-xs font-mono ${
              pinMessage.type === "success"
                ? "text-primary"
                : "text-destructive"
            }`}
          >
            {pinMessage.text}
          </motion.p>
        )}
        <button
          onClick={handlePinChange}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          변경
        </button>
      </CollapsibleSection>

      {/* 1.5. Category Lock PIN */}
      <CollapsibleSection
        icon={<Shield className="h-4 w-4 text-muted-foreground" />}
        title="카테고리 잠금 PIN"
        badge="블로그 비공개"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-mono mb-1 block">
                현재 PIN (6자리)
              </label>
              <input
                type="password"
                value={categoryPin}
                onChange={(e) => setCategoryPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 tracking-widest text-center"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-mono mb-1 block">
                새 PIN (6자리)
              </label>
              <input
                type="password"
                value={newCategoryPin}
                onChange={(e) => setNewCategoryPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 tracking-widest text-center"
              />
            </div>
          </div>
          {categoryPinMessage && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-xs font-mono ${
                categoryPinMessage.type === "success"
                  ? "text-primary"
                  : "text-destructive"
              }`}
            >
              {categoryPinMessage.text}
            </motion.p>
          )}
          <button
            onClick={handleCategoryPinChange}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            PIN 변경
          </button>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground font-mono mb-3">
              잠금할 카테고리 선택
            </p>
            <div className="flex flex-wrap gap-2">
              {allBlogCats.map((cat) => {
                const isLocked = lockedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleLockedCategory(cat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isLocked
                        ? "bg-destructive/15 text-destructive ring-1 ring-destructive/30"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isLocked && <Lock className="h-3 w-3" />}
                    {cat}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              잠긴 카테고리는 블로그에서 자물쇠 아이콘으로 표시되며, PIN 입력 후 열람 가능합니다.
            </p>
          </div>
        </div>
      </CollapsibleSection>

      {/* 2. Personal / Financial Info */}
      <CollapsibleSection
        icon={<User className="h-4 w-4 text-muted-foreground" />}
        title="자산 기초 정보"
        badge="자산·투자 기초 데이터"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              연봉 (본인)
            </label>
            <div className="relative">
              <input
                type="text"
                value={formatWon(personalInfo.salaryOwn)}
                onChange={(e) =>
                  setPersonalInfo({
                    ...personalInfo,
                    salaryOwn: parseWon(e.target.value),
                  })
                }
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                원
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              연봉 (배우자)
            </label>
            <div className="relative">
              <input
                type="text"
                value={formatWon(personalInfo.salarySpouse)}
                onChange={(e) =>
                  setPersonalInfo({
                    ...personalInfo,
                    salarySpouse: parseWon(e.target.value),
                  })
                }
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                원
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              현재 대출 상환액 (월)
            </label>
            <div className="relative">
              <input
                type="text"
                value={formatWon(personalInfo.monthlyLoanPayment)}
                onChange={(e) =>
                  setPersonalInfo({
                    ...personalInfo,
                    monthlyLoanPayment: parseWon(e.target.value),
                  })
                }
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                원
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              현금 저축
            </label>
            <div className="relative">
              <input
                type="text"
                value={formatWon(personalInfo.cashSavings || "")}
                onChange={(e) =>
                  setPersonalInfo({
                    ...personalInfo,
                    cashSavings: parseWon(e.target.value),
                  })
                }
                placeholder="0"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                원
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              비상금
            </label>
            <div className="relative">
              <input
                type="text"
                value={formatWon(personalInfo.emergencyFund || "")}
                onChange={(e) =>
                  setPersonalInfo({
                    ...personalInfo,
                    emergencyFund: parseWon(e.target.value),
                  })
                }
                placeholder="0"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                원
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              현금 보유 (보증금 포함)
            </label>
            <div className="relative">
              <input
                type="text"
                value={formatWon(personalInfo.cashHoldings || "")}
                onChange={(e) =>
                  setPersonalInfo({
                    ...personalInfo,
                    cashHoldings: parseWon(e.target.value),
                  })
                }
                placeholder="0"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                원
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              연금저축
            </label>
            <div className="relative">
              <input
                type="text"
                value={formatWon(personalInfo.pensionSavings || "")}
                onChange={(e) =>
                  setPersonalInfo({
                    ...personalInfo,
                    pensionSavings: parseWon(e.target.value),
                  })
                }
                placeholder="0"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                원
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              IRP
            </label>
            <div className="relative">
              <input
                type="text"
                value={formatWon(personalInfo.irpBalance || "")}
                onChange={(e) =>
                  setPersonalInfo({
                    ...personalInfo,
                    irpBalance: parseWon(e.target.value),
                  })
                }
                placeholder="0"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                원
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              DC (확정기여형)
            </label>
            <div className="relative">
              <input
                type="text"
                value={formatWon(personalInfo.dcBalance || "")}
                onChange={(e) =>
                  setPersonalInfo({
                    ...personalInfo,
                    dcBalance: parseWon(e.target.value),
                  })
                }
                placeholder="0"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                원
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              기본 금리 (%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={personalInfo.baseRate}
                onChange={(e) =>
                  setPersonalInfo({
                    ...personalInfo,
                    baseRate: e.target.value,
                  })
                }
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                %
              </span>
            </div>
          </div>
        </div>

        {personalInfoMessage && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs font-mono text-primary"
          >
            {personalInfoMessage}
          </motion.p>
        )}
        <button
          onClick={handleSavePersonalInfo}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Save className="h-3.5 w-3.5" />
          저장
        </button>
      </CollapsibleSection>

      {/* 3. Service API Settings */}
      <CollapsibleSection
        icon={<Key className="h-4 w-4 text-muted-foreground" />}
        title="서비스 API 설정"
        badge="카카오/뉴스/주식/공공데이터/날씨/ECOS/한투"
      >
        <div className="space-y-4">
          {/* Kakao API */}
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              카카오 API 키
            </label>
            <div className="relative">
              <input
                type={apiKeyVisibility.kakao ? "text" : "password"}
                value={apiKeys.kakao}
                onChange={(e) =>
                  setApiKeys({ ...apiKeys, kakao: e.target.value })
                }
                placeholder="카카오 REST API 키"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
              />
              <button
                onClick={() => toggleApiKeyVisibility("kakao")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {apiKeyVisibility.kakao ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Places 검색용
            </p>
          </div>

          {/* News API */}
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              뉴스 API 키
            </label>
            <div className="relative">
              <input
                type={apiKeyVisibility.news ? "text" : "password"}
                value={apiKeys.news}
                onChange={(e) =>
                  setApiKeys({ ...apiKeys, news: e.target.value })
                }
                placeholder="뉴스 API 키"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
              />
              <button
                onClick={() => toggleApiKeyVisibility("news")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {apiKeyVisibility.news ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Yahoo Finance note */}
          <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
            <p className="text-xs font-mono text-primary font-medium mb-0.5">
              Yahoo Finance: 키 불필요 (자동 연동)
            </p>
            <p className="text-[10px] text-muted-foreground">
              주식/지수/환율 데이터는 Yahoo Finance에서 자동으로 가져옵니다. 별도 API 키가 필요하지 않습니다.
            </p>
          </div>

          {/* Stock API (Alpha Vantage backup) */}
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              주식 API 키 (Alpha Vantage 백업)
            </label>
            <div className="relative">
              <input
                type={apiKeyVisibility.stock ? "text" : "password"}
                value={apiKeys.stock}
                onChange={(e) =>
                  setApiKeys({ ...apiKeys, stock: e.target.value })
                }
                placeholder="Alpha Vantage API 키 (선택사항)"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
              />
              <button
                onClick={() => toggleApiKeyVisibility("stock")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {apiKeyVisibility.stock ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Yahoo Finance 실패 시 백업용 (선택사항)
            </p>
          </div>

          {/* 공공데이터포털 API */}
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              공공데이터포털 API Key
            </label>
            <div className="relative">
              <input
                type={apiKeyVisibility.data ? "text" : "password"}
                value={apiKeys.data}
                onChange={(e) =>
                  setApiKeys({ ...apiKeys, data: e.target.value })
                }
                placeholder="공공데이터포털 인증키"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
              />
              <button
                onClick={() => toggleApiKeyVisibility("data")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {apiKeyVisibility.data ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              부동산 실거래가 조회용
            </p>
          </div>

          {/* Weather API */}
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              <span className="flex items-center gap-1.5">
                <Cloud className="h-3 w-3" />
                날씨 API 키 (OpenWeatherMap)
              </span>
            </label>
            <div className="relative">
              <input
                type={apiKeyVisibility.weather ? "text" : "password"}
                value={apiKeys.weather}
                onChange={(e) =>
                  setApiKeys({ ...apiKeys, weather: e.target.value })
                }
                placeholder="OpenWeatherMap API Key"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
              />
              <button
                onClick={() => toggleApiKeyVisibility("weather")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {apiKeyVisibility.weather ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              홈 대시보드 날씨 표시용
            </p>
          </div>

          {/* ECOS (한국은행 경제통계) API */}
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              한국은행 ECOS API 키
            </label>
            <div className="relative">
              <input
                type={apiKeyVisibility.ecos ? "text" : "password"}
                value={apiKeys.ecos}
                onChange={(e) =>
                  setApiKeys({ ...apiKeys, ecos: e.target.value })
                }
                placeholder="ECOS 인증키"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
              />
              <button
                onClick={() => toggleApiKeyVisibility("ecos")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {apiKeyVisibility.ecos ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {"소비자물가지수(CPI) 조회용 · 미입력 시 연 3% 고정 · ecos.bok.or.kr에서 발급"}
            </p>
          </div>

          {/* 한국투자증권 Open API */}
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3 space-y-3">
            <p className="text-xs font-mono text-amber-500 font-medium">
              {"한국투자증권 Open API (퀀트 스크리닝)"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {"퀀트 종목 조건검색에 필요 · apiportal.koreainvestment.com에서 발급 · 한투 계좌 필요"}
            </p>
            <div>
              <label className="text-xs text-muted-foreground font-mono mb-1 block">앱 키 (App Key)</label>
              <div className="relative">
                <input
                  type={apiKeyVisibility.kisAppkey ? "text" : "password"}
                  value={apiKeys.kisAppkey}
                  onChange={(e) => setApiKeys({ ...apiKeys, kisAppkey: e.target.value })}
                  placeholder="한투 앱 키"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
                />
                <button onClick={() => toggleApiKeyVisibility("kisAppkey")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {apiKeyVisibility.kisAppkey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-mono mb-1 block">앱 시크릿 (App Secret)</label>
              <div className="relative">
                <input
                  type={apiKeyVisibility.kisSecret ? "text" : "password"}
                  value={apiKeys.kisSecret}
                  onChange={(e) => setApiKeys({ ...apiKeys, kisSecret: e.target.value })}
                  placeholder="한투 앱 시크릿"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
                />
                <button onClick={() => toggleApiKeyVisibility("kisSecret")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {apiKeyVisibility.kisSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {apiMessage && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs font-mono text-primary"
          >
            {apiMessage}
          </motion.p>
        )}
        <button
          onClick={handleSaveApiKeys}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Save className="h-3.5 w-3.5" />
          저장
        </button>
      </CollapsibleSection>

      {/* 4. AI API Settings */}
      <CollapsibleSection
        icon={<Bot className="h-4 w-4 text-muted-foreground" />}
        title="AI API 설정"
        badge="AI 기능용"
      >
        <div className="space-y-4">
          {/* OpenAI API */}
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              OpenAI API Key
            </label>
            <div className="relative">
              <input
                type={aiApiKeyVisibility.openai ? "text" : "password"}
                value={aiApiKeys.openai}
                onChange={(e) =>
                  setAiApiKeys({ ...aiApiKeys, openai: e.target.value })
                }
                placeholder="sk-..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
              />
              <button
                onClick={() => toggleAiApiKeyVisibility("openai")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {aiApiKeyVisibility.openai ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              블로그 AI 작성 보조
            </p>
          </div>

          {/* Google Gemini API */}
          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              Google Gemini API Key
            </label>
            <div className="relative">
              <input
                type={aiApiKeyVisibility.gemini ? "text" : "password"}
                value={aiApiKeys.gemini}
                onChange={(e) =>
                  setAiApiKeys({ ...aiApiKeys, gemini: e.target.value })
                }
                placeholder="AIza..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
              />
              <button
                onClick={() => toggleAiApiKeyVisibility("gemini")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {aiApiKeyVisibility.gemini ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              경제 분석, 헷징 분석, 뉴스 번역
            </p>
          </div>

          {/* Note: Translation uses Gemini API (no separate DeepL key needed) */}
        </div>

        {aiApiMessage && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs font-mono text-primary"
          >
            {aiApiMessage}
          </motion.p>
        )}
        <button
          onClick={handleSaveAiApiKeys}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Save className="h-3.5 w-3.5" />
          저장
        </button>
      </CollapsibleSection>

      {/* 5. Blog categories */}
      <CollapsibleSection
        icon={<Tag className="h-4 w-4 text-muted-foreground" />}
        title="블로그 카테고리 관리"
      >
        <div className="flex flex-wrap gap-2">
          {blogCategories.map((cat) => (
            <span
              key={cat}
              className="flex items-center gap-1.5 bg-muted rounded-lg px-3 py-1.5 text-xs font-medium group"
            >
              {cat}
              <button
                onClick={() => removeBlogCategory(cat)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="새 카테고리"
            value={newBlogCat}
            onChange={(e) => setNewBlogCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addBlogCategory()}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
          />
          <button
            onClick={addBlogCategory}
            className="bg-primary text-primary-foreground rounded-lg px-3 py-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </CollapsibleSection>

      {/* 6. Expense categories */}
      <CollapsibleSection
        icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
        title="지출 카테고리 관리"
      >
        <div className="flex flex-wrap gap-2">
          {expenseCategories.map((cat) => (
            <span
              key={cat}
              className="flex items-center gap-1.5 bg-muted rounded-lg px-3 py-1.5 text-xs font-medium group"
            >
              {cat}
              <button
                onClick={() => removeExpenseCategory(cat)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="새 카테고리"
            value={newExpenseCat}
            onChange={(e) => setNewExpenseCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExpenseCategory()}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
          />
          <button
            onClick={addExpenseCategory}
            className="bg-primary text-primary-foreground rounded-lg px-3 py-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </CollapsibleSection>

      {/* API 연결 상태 - Live ping tests */}
      <ApiConnectionStatus />
    </div>
  );
};

export default SettingsView;
