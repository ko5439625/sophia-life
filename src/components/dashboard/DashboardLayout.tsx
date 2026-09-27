import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  PenSquare,
  Calendar,
  Wallet,
  BookHeart,
  Building2,
  Settings,
  LogOut,
  Menu,
  Heart,
  MessageCircle,
  MoreHorizontal,
  X,
  Plus,
} from "lucide-react";
import ThemeToggle from "../ThemeToggle";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useIsMobile } from "../../hooks/use-mobile";
import { supabase } from "@/lib/supabase";
import { getChatSender } from "@/services/chatService";
import type { RealtimeChannel } from "@supabase/supabase-js";
import DashboardHome from "./home/DashboardHome";
import ScheduleView from "./schedule/ScheduleView";
import CoupleView from "./couple/CoupleView";
import SettingsView from "./settings/SettingsView";
import BlogManagement from "./blog/BlogManagement";
import RealEstateHub from "./realestate/RealEstateHub";
import MoneyView, { type MoneySection } from "./money/MoneyView";
import QuickExpenseSheet from "./home/QuickExpenseSheet";
import SmartInboxSheet from "./inbox/SmartInboxSheet";
import WeddingView from "./wedding/WeddingView";
import ChatView from "./chat/ChatView";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  id: string;
}

// 자산·투자·뉴스는 "돈" 탭 하나로 통합 (money)
const topNav: NavItem[] = [
  { icon: Home, label: "홈", id: "home" },
  { icon: Calendar, label: "일정", id: "schedule" },
  { icon: Wallet, label: "돈", id: "money" },
  { icon: BookHeart, label: "기록", id: "couple" },
  { icon: Heart, label: "웨딩", id: "wedding" },
];

const bottomNav: NavItem[] = [
  { icon: PenSquare, label: "블로그", id: "blog" },
  { icon: Building2, label: "부동산", id: "realestate" },
  { icon: MessageCircle, label: "채팅", id: "chat" },
  { icon: Settings, label: "설정", id: "settings" },
];

// 모바일 하단 탭 (5개) — 자주 쓰는 "돈"을 하단으로
const mobileBottomTabs: NavItem[] = [
  { icon: Home, label: "홈", id: "home" },
  { icon: Calendar, label: "일정", id: "schedule" },
  { icon: Wallet, label: "돈", id: "money" },
  { icon: MessageCircle, label: "채팅", id: "chat" },
  { icon: MoreHorizontal, label: "더보기", id: "__more__" },
];

// 더보기 메뉴에 들어갈 항목들
const moreMenuItems: NavItem[] = [
  { icon: BookHeart, label: "기록", id: "couple" },
  { icon: Heart, label: "웨딩", id: "wedding" },
  { icon: PenSquare, label: "블로그", id: "blog" },
  { icon: Building2, label: "부동산", id: "realestate" },
  { icon: Settings, label: "설정", id: "settings" },
];

const TAB_IDS = ["home", "schedule", "money", "couple", "wedding", "blog", "realestate", "chat", "settings"];
const MONEY_SECTIONS: MoneySection[] = ["finance", "investment", "news"];

const allNav = [...topNav, ...bottomNav];

const DashboardLayout = () => {
  // 현재 탭을 주소(?tab=…&sec=…)에 저장 → 폰 뒤로가기로 이전 탭 이동, 새로고침해도 유지
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab") || "home";
  const activeTab = TAB_IDS.includes(tabParam) ? tabParam : "home";
  const secParam = params.get("sec") as MoneySection | null;
  const moneySection: MoneySection = secParam && MONEY_SECTIONS.includes(secParam) ? secParam : "finance";

  const goTo = useCallback(
    (tab: string, sec?: MoneySection) => {
      const next = new URLSearchParams();
      next.set("tab", tab);
      if (tab === "money") next.set("sec", sec ?? "finance");
      if (next.toString() === params.toString()) return;
      setParams(next); // push → 뒤로가기 가능
      window.scrollTo(0, 0);
    },
    [params, setParams]
  );
  // 예전 탭 id(finance/investment/news)도 돈 탭의 해당 섹션으로 연결
  const setActiveTab = useCallback(
    (id: string) => {
      if ((MONEY_SECTIONS as string[]).includes(id)) goTo("money", id as MoneySection);
      else goTo(id);
    },
    [goTo]
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [quickExpenseOpen, setQuickExpenseOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // 채팅 탭 읽지 않은 메시지 감지 (Supabase realtime)
  useEffect(() => {
    if (!supabase) return;
    const sender = getChatSender();
    if (!sender) return;

    const peer = sender === "degul" ? "muyo" : "degul";
    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel("chat-unread-dot")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const msg = payload.new as { sender: string };
          // 상대방 메시지이고 현재 채팅 탭이 아닐 때만 레드닷
          if (msg.sender === peer && activeTabRef.current !== "chat") {
            setHasUnreadChat(true);
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // 채팅 탭 진입 시 레드닷 해제
  useEffect(() => {
    if (activeTab === "chat") {
      setHasUnreadChat(false);
    }
  }, [activeTab]);

  // Allow child components to navigate to tabs (supports "tab:subtab" format)
  const [subTabTarget, setSubTabTarget] = useState<string | null>(null);
  const clearSubTab = useCallback(() => setSubTabTarget(null), []);
  const handleTabChange = (tabId: string) => {
    if (tabId.includes(":")) {
      const [main, sub] = tabId.split(":");
      setActiveTab(main);
      setSubTabTarget(sub);
    } else {
      setActiveTab(tabId);
      setSubTabTarget(null);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("sophia-auth");
    localStorage.removeItem("sophia-device-auth");
    navigate("/");
  };

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return (
          <DashboardHome
            onNavigate={handleTabChange}
            onQuickExpense={() => setQuickExpenseOpen(true)}
            onSmartInbox={() => setInboxOpen(true)}
          />
        );
      case "blog":
        return <BlogManagement initialTab={subTabTarget} onTabUsed={clearSubTab} />;
      case "schedule":
        return <ScheduleView initialTab={subTabTarget} onTabUsed={() => setSubTabTarget(null)} />;
      case "money":
        return (
          <MoneyView
            section={moneySection}
            onSectionChange={(s) => goTo("money", s)}
            initialTab={subTabTarget}
            onTabUsed={clearSubTab}
          />
        );
      case "couple":
        return <CoupleView initialTab={subTabTarget} onTabUsed={() => setSubTabTarget(null)} />;
      case "wedding":
        return <WeddingView initialTab={subTabTarget} onTabUsed={() => setSubTabTarget(null)} />;
      case "realestate":
        return <RealEstateHub initialTab={subTabTarget} onTabUsed={() => setSubTabTarget(null)} />;
      case "chat":
        return <ChatView />;
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
        <span className="relative">
          <item.icon className="h-4 w-4 flex-shrink-0" />
          {item.id === "chat" && hasUnreadChat && activeTab !== "chat" && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </span>
        <span>{item.label}</span>
      </button>
    ));

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5">
        <button
          onClick={() => navigate("/?blog=true")}
          className="cursor-pointer hover:opacity-70 transition-opacity text-left"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-sidebar-foreground tracking-tight">
              Sophia<span className="text-primary">.</span>life
            </span>
          </div>
          <p className="text-[11px] text-sidebar-foreground/40 mt-1 tracking-wide">our life together ♡</p>
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

  // 모바일 하단 탭에서 활성 상태 체크 (더보기에 속한 탭이면 더보기 활성)
  const mobileTabIds = mobileBottomTabs.filter(t => t.id !== "__more__").map(t => t.id);
  const isMoreActive = !mobileTabIds.includes(activeTab);

  return (
    <motion.div
      className="min-h-screen bg-background flex"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex-col">
        <SidebarContent />
      </aside>

      {/* Desktop mobile drawer (md 미만에서 더보기 메뉴로 대체) */}
      <AnimatePresence>
        {sidebarOpen && !isMobile && (
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
        {/* Desktop header */}
        <header className="hidden md:flex h-12 border-b border-border items-center justify-between px-4 md:px-6 bg-background/80 backdrop-blur-sm">
          <h2 className="text-xs font-mono text-muted-foreground/60 tracking-wider uppercase">
            {currentLabel}
          </h2>
          <div className="w-10" />
        </header>

        {/* Main content — 모바일: 하단 탭(+안전영역) 높이만큼, FAB가 있는 탭은 FAB 높이까지 더해 마지막 항목이 가려지지 않게 */}
        <main
          className={`flex-1 p-3 sm:p-5 md:p-8 overflow-y-auto md:pb-8 ${
            activeTab !== "chat" && activeTab !== "blog"
              ? "pb-[calc(9rem+env(safe-area-inset-bottom))]"
              : "pb-[calc(5rem+env(safe-area-inset-bottom))]"
          }`}
        >
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

        {/* 어느 탭에서든 지출 바로 기록 (채팅·블로그는 입력창을 가리므로 제외) */}
        {activeTab !== "chat" && activeTab !== "blog" && (
          <>
            {fabMenuOpen && (
              <div className="fixed inset-0 z-30" onClick={() => setFabMenuOpen(false)} />
            )}
            <div className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-8 md:right-8 z-30 flex flex-col items-end gap-2">
              <AnimatePresence>
                {fabMenuOpen &&
                  [
                    { label: "📋 붙여넣기로 기록", onClick: () => setInboxOpen(true) },
                    { label: "💸 지출 기록", onClick: () => setQuickExpenseOpen(true) },
                  ].map((m, i) => (
                    <motion.button
                      key={m.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                      exit={{ opacity: 0, y: 8 }}
                      onClick={() => {
                        setFabMenuOpen(false);
                        m.onClick();
                      }}
                      className="rounded-full bg-card border border-border shadow-lg shadow-black/40 px-4 min-h-[44px] text-sm font-semibold whitespace-nowrap"
                    >
                      {m.label}
                    </motion.button>
                  ))}
              </AnimatePresence>
              <button
                onClick={() => setFabMenuOpen((v) => !v)}
                aria-label="빠른 기록"
                aria-expanded={fabMenuOpen}
                className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/40 flex items-center justify-center active:scale-95 transition-transform"
              >
                <Plus className={`h-7 w-7 transition-transform ${fabMenuOpen ? "rotate-45" : ""}`} />
              </button>
            </div>
          </>
        )}
        <QuickExpenseSheet open={quickExpenseOpen} onOpenChange={setQuickExpenseOpen} />
        <SmartInboxSheet open={inboxOpen} onOpenChange={setInboxOpen} onNavigate={handleTabChange} />

        {/* 모바일 하단 네비게이션 */}
        {isMobile && (
          <>
            {/* 더보기 메뉴 오버레이 */}
            <AnimatePresence>
              {moreMenuOpen && (
                <>
                  <motion.div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setMoreMenuOpen(false)}
                  />
                  <motion.div
                    className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 px-3 pb-2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  >
                    <div className="bg-card border border-border rounded-2xl shadow-lg p-2 mx-1">
                      <div className="flex items-center justify-between px-3 py-0.5 mb-1">
                        <span className="text-sm font-semibold text-foreground">더보기</span>
                        <button
                          onClick={() => setMoreMenuOpen(false)}
                          aria-label="더보기 닫기"
                          className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {moreMenuItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.id);
                              setSubTabTarget(null);
                              setMoreMenuOpen(false);
                            }}
                            className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl transition-colors ${
                              activeTab === item.id
                                ? "bg-accent/10 text-accent"
                                : "text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <item.icon className="h-5 w-5" />
                            <span className="text-[12px] font-medium">{item.label}</span>
                          </button>
                        ))}
                        {/* 로그아웃 버튼 */}
                        <button
                          onClick={handleLogout}
                          className="flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
                        >
                          <LogOut className="h-5 w-5" />
                          <span className="text-[12px] font-medium">로그아웃</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* 하단 탭 바 */}
            <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
              <div className="flex items-center justify-around h-14">
                {mobileBottomTabs.map((tab) => {
                  const isActive = tab.id === "__more__" ? isMoreActive || moreMenuOpen : activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        if (tab.id === "__more__") {
                          setMoreMenuOpen(!moreMenuOpen);
                        } else {
                          setActiveTab(tab.id);
                          setSubTabTarget(null);
                          setMoreMenuOpen(false);
                        }
                      }}
                      className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                        isActive
                          ? "text-accent"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span className="relative">
                        <tab.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                        {tab.id === "chat" && hasUnreadChat && !isActive && (
                          <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-card animate-pulse" />
                        )}
                      </span>
                      <span className={`text-[11px] leading-tight ${isActive ? "font-semibold" : "font-medium"}`}>
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default DashboardLayout;
