import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  PenSquare,
  Calendar,
  Wallet,
  BookHeart,
  TrendingUp,
  Building2,
  Settings,
  LogOut,
  Menu,
  Newspaper,
} from "lucide-react";
import ThemeToggle from "../ThemeToggle";
import { useNavigate } from "react-router-dom";
import { useGuestMode } from "../../hooks/useGuestMode";
import DashboardHome from "./home/DashboardHome";
import ScheduleView from "./schedule/ScheduleView";
import FinanceView from "./finance/FinanceView";
import CoupleView from "./couple/CoupleView";
import SettingsView from "./settings/SettingsView";
import BlogManagement from "./blog/BlogManagement";
import InvestmentHub from "./investment/InvestmentHub";
import RealEstateHub from "./realestate/RealEstateHub";
import NewsView from "./finance/NewsView";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  id: string;
}

const topNav: NavItem[] = [
  { icon: Home, label: "홈", id: "home" },
  { icon: Calendar, label: "일정", id: "schedule" },
  { icon: Wallet, label: "자산", id: "finance" },
  { icon: BookHeart, label: "기록", id: "couple" },
];

const bottomNav: NavItem[] = [
  { icon: PenSquare, label: "블로그", id: "blog" },
  { icon: TrendingUp, label: "투자", id: "investment" },
  { icon: Newspaper, label: "뉴스", id: "news" },
  { icon: Building2, label: "부동산", id: "realestate" },
  { icon: Settings, label: "설정", id: "settings" },
];

const allNav = [...topNav, ...bottomNav];

const DashboardLayout = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { isGuest } = useGuestMode();

  // Allow child components to navigate to tabs
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("sophia-auth");
    localStorage.removeItem("sophia-device-auth");
    navigate("/");
  };

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return <DashboardHome onNavigate={handleTabChange} />;
      case "blog":
        return <BlogManagement />;
      case "schedule":
        return <ScheduleView />;
      case "finance":
        return <FinanceView />;
      case "couple":
        return <CoupleView />;
      case "investment":
        return <InvestmentHub />;
      case "news":
        return <div className="space-y-6"><h2 className="text-xl sm:text-2xl font-bold">뉴스</h2><NewsView /></div>;
      case "realestate":
        return <RealEstateHub />;
      case "settings":
        return <SettingsView />;
      default:
        return null;
    }
  };

  const renderNavSection = (items: NavItem[]) =>
    items.map((item) => (
      <button
        key={item.id}
        onClick={() => {
          setActiveTab(item.id);
          setSidebarOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all relative ${
          activeTab === item.id
            ? "bg-sidebar-accent text-sidebar-primary font-medium"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        }`}
      >
        {activeTab === item.id && (
          <motion.div
            layoutId="sidebar-active"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
        <item.icon className="h-4 w-4 flex-shrink-0" />
        <span>{item.label}</span>
      </button>
    ));

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5">
        <button
          onClick={() => navigate("/")}
          className="cursor-pointer hover:opacity-70 transition-opacity text-left"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-sidebar-foreground tracking-tight">
              Sophia<span className="text-primary">.</span>life
            </span>
            {isGuest && (
              <span className="text-[9px] font-mono font-bold bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">
                GUEST
              </span>
            )}
          </div>
          <p className="text-[11px] text-sidebar-foreground/40 mt-1 tracking-wide">{isGuest ? "게스트 모드" : "our life together ♡"}</p>
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {renderNavSection(topNav)}
        <div className="my-3 border-t border-sidebar-border" />
        {renderNavSection(bottomNav)}
      </nav>

      <div className="p-3 space-y-1 border-t border-sidebar-border">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all"
        >
          <LogOut className="h-4 w-4" />
          <span>로그아웃</span>
        </button>
      </div>
    </div>
  );

  const currentLabel = allNav.find((n) => n.id === activeTab)?.label || "";

  return (
    <motion.div
      className="min-h-screen bg-background flex"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex-col">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              className="fixed left-0 top-0 bottom-0 w-56 bg-sidebar z-50 md:hidden"
              initial={{ x: -224 }}
              animate={{ x: 0 }}
              exit={{ x: -224 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b border-border flex items-center justify-between px-4 md:px-6 bg-background/80 backdrop-blur-sm">
          <button
            className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="text-xs font-mono text-muted-foreground/60 tracking-wider uppercase">
            {currentLabel}
          </h2>
          <div className="w-10" />
        </header>

        <main className="flex-1 p-3 sm:p-5 md:p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {renderContent()}
            </motion.div>
          </div>
        </main>
      </div>
    </motion.div>
  );
};

export default DashboardLayout;
