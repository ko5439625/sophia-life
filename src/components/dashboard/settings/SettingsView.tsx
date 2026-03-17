import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGuestMode } from "../../../hooks/useGuestMode";
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
// Main component
// ---------------------------------------------------------------------------

const SettingsView = () => {
  const { isGuest } = useGuestMode();

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
      salaryOwn: "50000000",
      salarySpouse: "40000000",
      monthlyLoanPayment: "500000",
      isRegulated: true,
      baseRate: "3.5",
      ltvLimit: "50",
      dsrLimit: "40",
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
  });
  const [apiKeyVisibility, setApiKeyVisibility] = useState({
    kakao: false,
    news: false,
    stock: false,
    data: false,
    weather: false,
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

  // Load API keys from localStorage on mount
  useEffect(() => {
    try {
      setApiKeys({
        kakao: localStorage.getItem("sophia-api-kakao") || "",
        news: localStorage.getItem("sophia-api-news") || "",
        stock: localStorage.getItem("sophia-api-stock") || "",
        data: localStorage.getItem("sophia-api-data") || "",
        weather: localStorage.getItem("sophia-api-weather") || "",
      });
      setAiApiKeys({
        openai: localStorage.getItem("sophia-api-openai") || "",
        gemini: localStorage.getItem("sophia-api-gemini") || "",
      });
    } catch (e) {
      console.warn("Failed to load API keys from localStorage:", e);
    }
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
    return ["감성"];
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

  const handleSavePersonalInfo = () => {
    try {
      localStorage.setItem("sophia-personal-info", JSON.stringify(personalInfo));
      setPersonalInfoMessage("개인 정보가 저장되었습니다.");
    } catch (e) {
      console.warn("Failed to save personal info:", e);
      setPersonalInfoMessage("저장 실패");
    }
    setTimeout(() => setPersonalInfoMessage(null), 3000);
  };

  const handleSaveApiKeys = () => {
    try {
      localStorage.setItem("sophia-api-kakao", apiKeys.kakao);
      localStorage.setItem("sophia-api-news", apiKeys.news);
      localStorage.setItem("sophia-api-stock", apiKeys.stock);
      localStorage.setItem("sophia-api-data", apiKeys.data);
      localStorage.setItem("sophia-api-weather", apiKeys.weather);
      setApiMessage("API 키가 저장되었습니다.");
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
      setAiApiMessage("AI API 키가 저장되었습니다.");
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

      {/* 2. Personal Info for Real Estate */}
      <CollapsibleSection
        icon={<User className="h-4 w-4 text-muted-foreground" />}
        title="개인 정보"
        badge="부동산 계산용"
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
              규제지역 여부
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRegulatedToggle}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  personalInfo.isRegulated ? "bg-primary" : "bg-muted"
                }`}
              >
                <motion.div
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow"
                  animate={{
                    left: personalInfo.isRegulated
                      ? "calc(100% - 22px)"
                      : "2px",
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
                {personalInfo.isRegulated && (
                  <Check className="absolute right-1.5 top-1 h-4 w-4 text-primary-foreground" />
                )}
              </button>
              <span className="text-xs font-mono text-muted-foreground">
                {personalInfo.isRegulated ? "규제지역" : "비규제지역"}
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

          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              LTV 한도 (%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                value={personalInfo.ltvLimit}
                onChange={(e) =>
                  setPersonalInfo({
                    ...personalInfo,
                    ltvLimit: e.target.value,
                  })
                }
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                %
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              기본: 규제지역 50%, 비규제 70%
            </p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono mb-1 block">
              DSR 한도 (%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                value={personalInfo.dsrLimit}
                onChange={(e) =>
                  setPersonalInfo({
                    ...personalInfo,
                    dsrLimit: e.target.value,
                  })
                }
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                %
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              기본: 40%
            </p>
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
        badge="카카오/뉴스/주식/공공데이터/날씨"
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

      {/* API 연결 상태 */}
      <div className="bg-card rounded-xl p-5 space-y-3 border border-border">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          API 연결 상태
        </h3>
        <div className="space-y-2">
          {[
            { name: "Supabase", key: "VITE_SUPABASE_URL", check: () => !!import.meta.env.VITE_SUPABASE_URL },
            { name: "Gemini (분석/번역)", key: "sophia-api-gemini", check: () => !!localStorage.getItem("sophia-api-gemini") },
            { name: "OpenAI (블로그 AI)", key: "sophia-api-openai", check: () => !!localStorage.getItem("sophia-api-openai") },
            { name: "Yahoo Finance", key: "자동", check: () => true },
            { name: "Alpha Vantage (백업)", key: "sophia-api-stock", check: () => !!localStorage.getItem("sophia-api-stock") },
            { name: "NewsAPI (뉴스)", key: "sophia-api-news", check: () => !!localStorage.getItem("sophia-api-news") },
            { name: "공공데이터 (부동산/청약)", key: "sophia-api-data", check: () => !!localStorage.getItem("sophia-api-data") },
            { name: "카카오 Maps (장소)", key: "sophia-api-kakao", check: () => !!localStorage.getItem("sophia-api-kakao") },
            { name: "OpenWeatherMap (날씨)", key: "sophia-api-weather", check: () => !!localStorage.getItem("sophia-api-weather") },
            { name: "Fear & Greed Index", key: "자동", check: () => true },
            { name: "환율 (ExchangeRate)", key: "자동", check: () => true },
          ].map((api) => {
            const connected = api.check();
            return (
              <div key={api.name} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-400"}`} />
                  <span className="text-xs">{api.name}</span>
                </div>
                <span className={`text-[10px] font-mono ${connected ? "text-green-500" : "text-red-400"}`}>
                  {connected ? "연결됨" : "미설정"}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          API 키를 위 섹션에서 입력하면 자동으로 연결됩니다. "자동"은 키 없이 동작합니다.
        </p>
      </div>
    </div>
  );
};

export default SettingsView;
