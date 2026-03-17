import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  FileText,
  Calendar,
  Wallet,
  Heart,
  Image,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import ThemeToggle from "../ThemeToggle";
import TypingLogo from "../blog/TypingLogo";
import { useNavigate } from "react-router-dom";

const navItems = [
  { icon: Home, label: "홈", id: "home" },
  { icon: FileText, label: "블로그 관리", id: "blog" },
  { icon: Calendar, label: "일정 관리", id: "schedule" },
  { icon: Wallet, label: "자산 & 경제", id: "finance" },
  { icon: Heart, label: "부부 공간", id: "couple" },
  { icon: Image, label: "갤러리", id: "gallery" },
  { icon: Settings, label: "설정", id: "settings" },
];

const DashboardLayout = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.removeItem("sophia-auth");
    navigate("/");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 flex items-center gap-2">
        <span className="font-mono text-lg font-semibold text-sidebar-foreground">
          sophia.life
        </span>
        <span className="text-xs">🔓</span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all relative ${
              activeTab === item.id
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            {activeTab === item.id && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sidebar-primary rounded-r"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-3 space-y-2 border-t border-sidebar-border">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all"
        >
          <LogOut className="h-4 w-4" />
          <span>로그아웃</span>
        </button>
      </div>
    </div>
  );

  return (
    <motion.div
      className="min-h-screen bg-background flex"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
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
              className="fixed left-0 top-0 bottom-0 w-60 bg-sidebar z-50 md:hidden"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-6 bg-background">
          <button
            className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-mono text-muted-foreground">
            {navItems.find((n) => n.id === activeTab)?.label}
          </h2>
          <div className="w-10" />
        </header>

        <main className="flex-1 p-6 md:p-8">
          <div className="max-w-5xl mx-auto">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center min-h-[400px] text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                {(() => {
                  const Icon = navItems.find((n) => n.id === activeTab)?.icon || Home;
                  return <Icon className="h-7 w-7 text-muted-foreground" />;
                })()}
              </div>
              <h3 className="text-lg font-serif font-semibold mb-2">
                {navItems.find((n) => n.id === activeTab)?.label}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                이 영역은 Phase 2 이후에 구현됩니다. 대시보드의 각 기능이 이곳에 표시됩니다.
              </p>
            </motion.div>
          </div>
        </main>
      </div>
    </motion.div>
  );
};

export default DashboardLayout;
