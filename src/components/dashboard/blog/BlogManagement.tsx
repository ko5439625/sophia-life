import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { enhanceBlogContent } from "../../../services/openaiApi";
import { useGuestMode } from "../../../hooks/useGuestMode";
import { loadPosts as loadPostsFromDB, savePost as savePostToDB, deletePost as deletePostFromDB, saveBlogSettings } from "../../../services/supabaseSync";
import {
  Plus,
  Edit3,
  Trash2,
  Globe,
  Lock,
  ArrowLeft,
  X,
  ImagePlus,
  FileText,
  Settings2,
  Tag,
  ChevronDown,
  Check,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Sparkles,
  Loader2,
  Palette,
  Type,
  ALargeSmall,
  ChevronsDownUp,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlogPost {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
  images: string[];
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const defaultCategories = ["일상", "개발", "여행", "웨딩"];

const mockPosts: BlogPost[] = [];

const FONT_OPTIONS = [
  { label: "Pretendard", value: "'Pretendard Variable', sans-serif" },
  { label: "Noto Sans KR", value: "'Noto Sans KR', sans-serif" },
  { label: "본명조 (Noto Serif KR)", value: "'Noto Serif KR', serif" },
  { label: "IBM Plex Sans KR", value: "'IBM Plex Sans KR', sans-serif" },
  { label: "Nanum Gothic", value: "'Nanum Gothic', sans-serif" },
  { label: "나눔스퀘어라운드", value: "'NanumSquareRound', sans-serif" },
  { label: "고운돋움", value: "'Gowun Dodum', sans-serif" },
  { label: "고운바탕", value: "'Gowun Batang', serif" },
  { label: "나눔명조", value: "'Nanum Myeongjo', serif" },
  { label: "마루부리", value: "'MaruBuri', serif" },
  { label: "코펍바탕", value: "'KoPub Batang', serif" },
  { label: "에스코어드림", value: "'S-Core Dream', sans-serif" },
  { label: "도현", value: "'Do Hyeon', sans-serif" },
  { label: "감자꽃", value: "'Gamja Flower', cursive" },
  { label: "주아", value: "'Jua', sans-serif" },
  { label: "싱글데이", value: "'Single Day', cursive" },
  { label: "서궁 (픽셀)", value: "'Suhgung12', monospace" },
  { label: "Inter", value: "Inter, sans-serif" },
];

const TEXT_COLORS = [
  { label: "기본", value: "", color: "currentColor" },
  { label: "빨강", value: "#ef4444", color: "#ef4444" },
  { label: "주황", value: "#f97316", color: "#f97316" },
  { label: "노랑", value: "#eab308", color: "#eab308" },
  { label: "초록", value: "#22c55e", color: "#22c55e" },
  { label: "파랑", value: "#3b82f6", color: "#3b82f6" },
  { label: "남색", value: "#6366f1", color: "#6366f1" },
  { label: "보라", value: "#a855f7", color: "#a855f7" },
  { label: "분홍", value: "#ec4899", color: "#ec4899" },
  { label: "회색", value: "#6b7280", color: "#6b7280" },
  { label: "흰색", value: "#ffffff", color: "#ffffff" },
  { label: "검정", value: "#000000", color: "#000000" },
];

const FONT_SIZE_PRESETS = [
  { label: "12", value: 12 },
  { label: "14", value: 14 },
  { label: "16", value: 16 },
  { label: "18", value: 18 },
  { label: "20", value: 20 },
  { label: "24", value: 24 },
  { label: "28", value: 28 },
  { label: "32", value: 32 },
  { label: "36", value: 36 },
  { label: "48", value: 48 },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Blog Settings card -- categories + subtitle */
const BlogSettings = ({
  categories,
  onAddCategory,
  onRemoveCategory,
  subtitle,
  onSubtitleChange,
}: {
  categories: string[];
  onAddCategory: (cat: string) => void;
  onRemoveCategory: (cat: string) => void;
  subtitle: string;
  onSubtitleChange: (v: string) => void;
}) => {
  const [newCat, setNewCat] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (trimmed && !categories.includes(trimmed)) {
      onAddCategory(trimmed);
      setNewCat("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl overflow-hidden"
    >
      {/* Collapsible header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">블로그 설정</span>
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
            <div className="px-5 pb-5 space-y-5 border-t border-border pt-4">
              {/* Subtitle */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  블로그 소개 문구
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => onSubtitleChange(e.target.value)}
                  placeholder="일상의 작은 순간들을 기록합니다"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                />
                <p className="text-[11px] text-muted-foreground/60 mt-1">
                  블로그 로고 아래 표시되는 텍스트
                </p>
              </div>

              {/* Categories */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  카테고리 관리
                </label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {categories.map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 bg-muted px-2.5 py-1 rounded-lg text-xs font-medium text-foreground/80 group"
                    >
                      {cat}
                      <button
                        onClick={() => onRemoveCategory(cat)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    placeholder="새 카테고리"
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                  />
                  <button
                    onClick={handleAdd}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    추가
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/** Post list item */
const PostListItem = ({
  post,
  index,
  onEdit,
  onDelete,
  onToggleVisibility,
}: {
  post: BlogPost;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.04 }}
    className="bg-card rounded-xl px-5 py-4 group"
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-medium truncate">{post.title}</h3>
          <button
            onClick={onToggleVisibility}
            title={post.isPublic ? "공개" : "비공개"}
          >
            {post.isPublic ? (
              <Globe className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span className="bg-muted px-2 py-0.5 rounded">{post.category}</span>
          <span>{post.createdAt}</span>
          {post.tags.length > 0 && (
            <span className="hidden sm:inline truncate">
              {post.tags.map((t) => `#${t}`).join(" ")}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
        >
          <Edit3 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </div>
  </motion.div>
);

/** Notion-style editor with contentEditable, image paste, inline image insertion */
const PostEditor = ({
  initialTitle,
  initialContent,
  initialCategory,
  initialTags,
  initialIsPublic,
  categories,
  isEditing,
  onSave,
  onCancel,
}: {
  initialTitle: string;
  initialContent: string;
  initialCategory: string;
  initialTags: string;
  initialIsPublic: boolean;
  categories: string[];
  isEditing: boolean;
  onSave: (data: {
    title: string;
    content: string;
    category: string;
    tags: string[];
    isPublic: boolean;
  }) => void;
  onCancel: () => void;
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialCategory);
  const [tagsInput, setTagsInput] = useState(initialTags);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [showMeta, setShowMeta] = useState(true);
  const [fontFamily, setFontFamily] = useState("'Pretendard Variable', sans-serif");
  const [fontSizeInput, setFontSizeInput] = useState("16");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [pasteToast, setPasteToast] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiToast, setAiToast] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const fontSizePickerRef = useRef<HTMLDivElement>(null);
  const fontPickerRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  // Save current selection (call before opening any dropdown)
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  // Restore saved selection
  const restoreSelection = useCallback(() => {
    const range = savedRangeRef.current;
    if (!range) return false;
    const sel = window.getSelection();
    if (!sel) return false;
    contentRef.current?.focus();
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
      if (fontSizePickerRef.current && !fontSizePickerRef.current.contains(e.target as Node)) {
        setShowFontSizePicker(false);
      }
      if (fontPickerRef.current && !fontPickerRef.current.contains(e.target as Node)) {
        setShowFontPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Upload image to Supabase Storage → return public URL
  const uploadImageToStorage = async (file: File): Promise<string | null> => {
    try {
      const { supabase } = await import("@/lib/supabase");
      if (!supabase) return null;
      const ext = file.name.split(".").pop() || "png";
      const fileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { error } = await supabase.storage.from("blog-images").upload(fileName, file, { contentType: file.type });
      if (error) { console.error("Upload error:", error); return null; }
      const { data: urlData } = supabase.storage.from("blog-images").getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (e) {
      console.error("Image upload failed:", e);
      return null;
    }
  };

  // Set initial content into contentEditable div
  useEffect(() => {
    if (contentRef.current && initialContent) {
      // If content contains HTML tags, set as innerHTML directly
      if (/<[a-z][\s\S]*>/i.test(initialContent)) {
        contentRef.current.innerHTML = initialContent;
      } else {
        // Plain text: convert newlines to <br>
        contentRef.current.innerHTML = initialContent
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getContentAsHtml = useCallback((): string => {
    if (!contentRef.current) return "";
    // Preserve HTML formatting (bold, italic, headings, images, etc.)
    return contentRef.current.innerHTML || "";
  }, []);

  // Insert HTML at cursor position in contentEditable
  const insertAtCursor = useCallback((html: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const frag = document.createDocumentFragment();
    let lastNode: Node | null = null;
    while (temp.firstChild) {
      lastNode = frag.appendChild(temp.firstChild);
    }
    range.insertNode(frag);
    if (lastNode) {
      const newRange = document.createRange();
      newRange.setStartAfter(lastNode);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
  }, []);

  // Handle paste -- detect images → upload to Supabase Storage
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = e.clipboardData?.files;
      if (items && items.length > 0) {
        const file = items[0];
        if (file.type.startsWith("image/")) {
          e.preventDefault();
          setUploadingImage(true);
          // Show placeholder
          const placeholderId = `img-loading-${Date.now()}`;
          insertAtCursor(`<br><span id="${placeholderId}" style="color:#888;font-size:12px;">📷 이미지 업로드 중...</span><br>`);
          const url = await uploadImageToStorage(file);
          // Replace placeholder with actual image
          const placeholder = contentRef.current?.querySelector(`#${placeholderId}`);
          if (url && placeholder) {
            placeholder.outerHTML = `<img src="${url}" alt="pasted image" style="max-width:100%;border-radius:8px;margin:8px 0;" />`;
          } else if (placeholder) {
            placeholder.outerHTML = `<span style="color:#ef4444;font-size:12px;">이미지 업로드 실패</span>`;
          }
          setUploadingImage(false);
          setPasteToast(true);
          setTimeout(() => setPasteToast(false), 2000);
          return;
        }
      }
      // For plain text paste, prevent default rich-text paste
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") || "";
      document.execCommand("insertText", false, text);
    },
    [insertAtCursor]
  );

  // Format commands for rich text editing
  const execFormat = useCallback((command: string, value?: string) => {
    contentRef.current?.focus();
    document.execCommand(command, false, value);
  }, []);

  // Apply font size to selected text using span wrapping
  const applyFontSize = useCallback((size: number) => {
    if (!restoreSelection()) return;
    // Use fontSize command (1-7) then replace with actual px
    document.execCommand("fontSize", false, "7");
    const container = contentRef.current;
    if (!container) return;
    const fonts = container.querySelectorAll('font[size="7"]');
    fonts.forEach((font) => {
      const span = document.createElement("span");
      span.style.fontSize = `${size}px`;
      span.innerHTML = font.innerHTML;
      font.parentNode?.replaceChild(span, font);
    });
    setFontSizeInput(String(size));
    setShowFontSizePicker(false);
  }, [restoreSelection]);

  // Apply font family to selected text
  const applyFontFamily = useCallback((family: string) => {
    if (!restoreSelection()) return;
    document.execCommand("fontName", false, "__temp_font__");
    const container = contentRef.current;
    if (!container) return;
    const fonts = container.querySelectorAll('font[face="__temp_font__"]');
    fonts.forEach((font) => {
      const span = document.createElement("span");
      span.style.fontFamily = family;
      span.innerHTML = font.innerHTML;
      font.parentNode?.replaceChild(span, font);
    });
    setFontFamily(family);
    setShowFontPicker(false);
  }, [restoreSelection]);

  // Apply text color to selected text
  const applyTextColor = useCallback((color: string) => {
    if (!restoreSelection()) return;
    if (!color) {
      document.execCommand("removeFormat", false);
      setShowColorPicker(false);
      return;
    }
    document.execCommand("foreColor", false, color);
    setShowColorPicker(false);
  }, [restoreSelection]);

  // Insert toggle (collapse/expand) block using <details>/<summary>
  const insertToggle = useCallback(() => {
    contentRef.current?.focus();
    const sel = window.getSelection();
    const selectedText = sel && !sel.isCollapsed ? sel.toString() : "";
    const title = selectedText || "제목을 입력하세요";
    const html = `<br><details class="blog-toggle"><summary>${title}</summary><p>내용을 입력하세요...</p></details><br>`;
    insertAtCursor(html);
  }, [insertAtCursor]);

  // Insert horizontal rule
  const insertHR = useCallback(() => {
    contentRef.current?.focus();
    document.execCommand("insertHorizontalRule", false);
  }, []);

  // AI content enhancement - uses OpenAI API (falls back to mock if no key)
  const handleAiEnhance = useCallback(async () => {
    if (!contentRef.current) return;
    setAiLoading(true);

    // Send full HTML to preserve images and existing formatting
    const currentHtml = contentRef.current.innerHTML;

    try {
      const enhanced = await enhanceBlogContent(currentHtml);
      contentRef.current.innerHTML = enhanced;
    } catch (err) {
      console.warn("AI enhance failed:", err);
    }

    setAiLoading(false);
    setAiToast(true);
    setTimeout(() => setAiToast(false), 2500);
  }, []);

  // Handle file input for inline image insertion → upload to Supabase Storage
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    contentRef.current?.focus();
    const placeholderId = `img-loading-${Date.now()}`;
    insertAtCursor(`<br><span id="${placeholderId}" style="color:#888;font-size:12px;">📷 이미지 업로드 중...</span><br>`);
    const url = await uploadImageToStorage(file);
    const placeholder = contentRef.current?.querySelector(`#${placeholderId}`);
    if (url && placeholder) {
      placeholder.outerHTML = `<img src="${url}" alt="${file.name}" style="max-width:100%;border-radius:8px;margin:8px 0;" />`;
    } else if (placeholder) {
      placeholder.outerHTML = `<span style="color:#ef4444;font-size:12px;">이미지 업로드 실패</span>`;
    }
    setUploadingImage(false);
    e.target.value = "";
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({
      title: title.trim(),
      content: getContentAsHtml(),
      category,
      tags,
      isPublic,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="space-y-0"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>돌아가기</span>
        </button>
        <div className="flex items-center gap-2">
          {/* Visibility toggle */}
          <button
            onClick={() => setIsPublic(!isPublic)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isPublic
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isPublic ? (
              <Globe className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            {isPublic ? "공개" : "비공개"}
          </button>
          {/* Save */}
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {isEditing ? "수정" : "발행"}
          </button>
        </div>
      </div>

      {/* Writing area -- Notion-style clean editor */}
      <div className="bg-card rounded-xl min-h-[400px] sm:min-h-[600px] relative">
        {/* Paste toast */}
        <AnimatePresence>
          {pasteToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg"
            >
              <Check className="h-3.5 w-3.5" />
              이미지가 삽입되었습니다
            </motion.div>
          )}
          {aiToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI가 글을 다듬었습니다
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-3xl mx-auto px-3 sm:px-6 md:px-10 py-5 sm:py-8 md:py-12">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요..."
            className="w-full bg-transparent text-2xl md:text-3xl font-bold placeholder:text-muted-foreground/30 focus:outline-none border-none leading-tight mb-1"
            autoFocus
          />

          {/* Divider */}
          <div className="h-px bg-border/50 my-4" />

          {/* Toolbar */}
          <div className="mb-4 border-b border-border/50 pb-3 space-y-2">
            {/* Row 1: Format & structure buttons */}
            <div className="flex items-center gap-0.5 flex-wrap">
              {/* Format buttons */}
              {([
                { icon: Bold, cmd: "bold", title: "굵게" },
                { icon: Italic, cmd: "italic", title: "기울임" },
                { icon: Underline, cmd: "underline", title: "밑줄" },
                { icon: Strikethrough, cmd: "strikeThrough", title: "취소선" },
              ] as const).map(({ icon: Icon, cmd, title }) => (
                <button
                  key={cmd}
                  onClick={() => execFormat(cmd)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                  title={title}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}

              <div className="w-px h-4 bg-border mx-1" />

              {/* Heading buttons */}
              <button
                onClick={() => execFormat("formatBlock", "h2")}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="제목 (H2)"
              >
                <Heading1 className="h-4 w-4" />
              </button>
              <button
                onClick={() => execFormat("formatBlock", "h3")}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="소제목 (H3)"
              >
                <Heading2 className="h-4 w-4" />
              </button>

              <div className="w-px h-4 bg-border mx-1" />

              {/* List buttons */}
              <button
                onClick={() => execFormat("insertUnorderedList")}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="글머리 목록"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => execFormat("insertOrderedList")}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="번호 목록"
              >
                <ListOrdered className="h-4 w-4" />
              </button>
              <button
                onClick={() => execFormat("formatBlock", "blockquote")}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="인용"
              >
                <Quote className="h-4 w-4" />
              </button>
              <button
                onClick={insertToggle}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="접힘 (토글)"
              >
                <ChevronsDownUp className="h-4 w-4" />
              </button>
              <button
                onClick={insertHR}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="구분선"
              >
                <Minus className="h-4 w-4" />
              </button>

              <div className="w-px h-4 bg-border mx-1" />

              {/* Alignment buttons */}
              <button
                onClick={() => execFormat("justifyLeft")}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="왼쪽 정렬"
              >
                <AlignLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => execFormat("justifyCenter")}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="가운데 정렬"
              >
                <AlignCenter className="h-4 w-4" />
              </button>
              <button
                onClick={() => execFormat("justifyRight")}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="오른쪽 정렬"
              >
                <AlignRight className="h-4 w-4" />
              </button>

              <div className="w-px h-4 bg-border mx-1" />

              {/* Image */}
              <button
                onClick={handleImageClick}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="이미지 삽입 (Ctrl+V로도 가능)"
              >
                <ImagePlus className="h-4 w-4" />
              </button>

              {/* Category/Tags */}
              <button
                onClick={() => setShowMeta(!showMeta)}
                className={`p-1.5 rounded transition-colors ${
                  showMeta ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title="카테고리 / 태그"
              >
                <Tag className="h-4 w-4" />
              </button>
            </div>

            {/* Row 2: Font, size, color, AI */}
            <div className="flex items-center gap-1 flex-wrap">
              {/* Font selector (per-selection) */}
              <div className="relative" ref={fontPickerRef}>
                <button
                  onMouseDown={(e) => { e.preventDefault(); saveSelection(); setShowFontPicker(!showFontPicker); setShowFontSizePicker(false); setShowColorPicker(false); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors border border-border/50"
                  title="글꼴 (텍스트 선택 후 적용)"
                >
                  <Type className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-[11px]">글꼴</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showFontPicker && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl py-1 max-h-64 overflow-y-auto w-48">
                    {FONT_OPTIONS.map((f) => (
                      <button
                        key={f.value}
                        onMouseDown={(e) => { e.preventDefault(); applyFontFamily(f.value); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors ${
                          fontFamily === f.value ? "text-primary font-medium bg-primary/5" : "text-foreground"
                        }`}
                        style={{ fontFamily: f.value }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Font size (per-selection) */}
              <div className="relative" ref={fontSizePickerRef}>
                <button
                  onMouseDown={(e) => { e.preventDefault(); saveSelection(); setShowFontSizePicker(!showFontSizePicker); setShowFontPicker(false); setShowColorPicker(false); }}
                  className="flex items-center gap-0.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors border border-border/50"
                  title="글자 크기 (텍스트 선택 후 적용)"
                >
                  <ALargeSmall className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-mono tabular-nums">{fontSizeInput}px</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showFontSizePicker && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl py-1 w-20">
                    {FONT_SIZE_PRESETS.map((s) => (
                      <button
                        key={s.value}
                        onMouseDown={(e) => { e.preventDefault(); applyFontSize(s.value); }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-muted transition-colors ${
                          fontSizeInput === s.label ? "text-primary font-medium bg-primary/5" : "text-foreground"
                        }`}
                      >
                        {s.label}px
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Text color (per-selection) */}
              <div className="relative" ref={colorPickerRef}>
                <button
                  onMouseDown={(e) => { e.preventDefault(); saveSelection(); setShowColorPicker(!showColorPicker); setShowFontPicker(false); setShowFontSizePicker(false); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors border border-border/50"
                  title="텍스트 색상 (텍스트 선택 후 적용)"
                >
                  <Palette className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-[11px]">색상</span>
                </button>
                {showColorPicker && (
                  <div className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-xl p-2.5" style={{ width: "170px" }}
                    ref={(el) => {
                      if (!el) return;
                      const btn = el.parentElement?.querySelector("button");
                      if (!btn) return;
                      const rect = btn.getBoundingClientRect();
                      el.style.top = `${rect.bottom + 4}px`;
                      el.style.left = `${rect.left}px`;
                    }}
                  >
                    <div className="grid grid-cols-6 gap-1.5">
                      {TEXT_COLORS.map((c) => (
                        <button
                          key={c.label}
                          onMouseDown={(e) => { e.preventDefault(); applyTextColor(c.value); }}
                          className="w-6 h-6 rounded border border-border/50 hover:scale-110 transition-transform flex items-center justify-center"
                          style={{ backgroundColor: c.value || "transparent" }}
                          title={c.label}
                        >
                          {!c.value && <X className="h-3 w-3 text-muted-foreground" />}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <label className="flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer" onMouseDown={(e) => e.preventDefault()}>
                        <span>직접 선택:</span>
                        <input
                          type="color"
                          className="w-6 h-5 cursor-pointer border-0 p-0 bg-transparent"
                          onChange={(e) => applyTextColor(e.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-px h-4 bg-border mx-1" />

              {/* AI Enhance button */}
              <button
                onClick={handleAiEnhance}
                disabled={aiLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gradient-to-r from-violet-500/20 to-blue-500/20 text-violet-400 hover:from-violet-500/30 hover:to-blue-500/30 rounded-lg transition-all disabled:opacity-50"
                title="AI로 글 다듬기 (이미지 유지)"
              >
                {aiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>{aiLoading ? "작성 중..." : "AI 다듬기"}</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Category & Tags -- collapsible */}
          <AnimatePresence>
            {showMeta && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-3 mb-5 p-4 bg-muted/30 rounded-lg">
                  {/* Category */}
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1.5 block">
                      카테고리
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setCategory(cat)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            category === cat
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1.5 block">
                      태그 (쉼표로 구분)
                    </label>
                    <input
                      type="text"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="태그1, 태그2, 태그3"
                      className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/40"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content area -- contentEditable div for true inline editing */}
          <div
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onPaste={handlePaste}
            data-placeholder="여기에 글을 작성하세요... (텍스트 선택 후 글꼴/크기/색상 적용)"
            className="w-full bg-transparent leading-relaxed focus:outline-none border-none min-h-[500px] whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/30"
            style={{
              lineHeight: "1.8",
              fontSize: "16px",
            }}
          />
        </div>
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const BLOG_CATEGORIES_KEY = "sophia-blog-categories";

const BlogManagement = () => {
  const { isGuest } = useGuestMode();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(BLOG_CATEGORIES_KEY);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return defaultCategories;
  });
  const [subtitle, setSubtitle] = useState(() => {
    return localStorage.getItem("sophia-blog-subtitle") || "일상의 작은 순간들을 기록합니다";
  });
  const categoriesLoaded = useRef(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Load posts + blog settings from Supabase
  useEffect(() => {
    loadPostsFromDB().then((rows) => {
      if (rows.length > 0) {
        setPosts(rows.map((r) => ({
          id: r.id,
          title: r.title,
          content: r.content,
          category: r.category,
          tags: r.tags || [],
          isPublic: r.is_public,
          createdAt: r.created_at,
          images: r.images || [],
        })));
      }
    });
    // Load categories & subtitle from Supabase
    import("@/lib/supabase").then(({ supabase }) => {
      if (!supabase) return;
      supabase.from("user_settings").select("blog_categories, blog_subtitle").limit(1).maybeSingle().then(({ data }) => {
        if (data?.blog_categories && Array.isArray(data.blog_categories) && data.blog_categories.length > 0) {
          setCategories(data.blog_categories);
          localStorage.setItem(BLOG_CATEGORIES_KEY, JSON.stringify(data.blog_categories));
        }
        if (data?.blog_subtitle) {
          setSubtitle(data.blog_subtitle);
          localStorage.setItem("sophia-blog-subtitle", data.blog_subtitle);
        }
        categoriesLoaded.current = true;
      });
    });
  }, []);

  // Sync categories to localStorage + Supabase (only after initial load)
  useEffect(() => {
    localStorage.setItem(BLOG_CATEGORIES_KEY, JSON.stringify(categories));
    if (!categoriesLoaded.current) return; // Don't save to DB until loaded
    import("@/lib/supabase").then(({ supabase }) => {
      if (!supabase) return;
      supabase.from("user_settings").upsert({ id: "c7a9defe-0e45-57e0-9b26-4ef82dd867c1", blog_categories: categories });
    });
  }, [categories]);

  // --- Category management ---
  const addCategory = (cat: string) => {
    setCategories([...categories, cat]);
  };
  const removeCategory = (cat: string) => {
    setCategories(categories.filter((c) => c !== cat));
    // Also remove from locked categories if present
    try {
      const locked = JSON.parse(localStorage.getItem("sophia-locked-categories") || "[]");
      const updated = locked.filter((c: string) => c !== cat);
      localStorage.setItem("sophia-locked-categories", JSON.stringify(updated));
      saveBlogSettings({ locked_categories: updated });
    } catch { /* ignore */ }
  };

  // --- Post CRUD ---
  const startCreate = () => {
    setEditingPost(null);
    setIsCreating(true);
  };

  const startEdit = (post: BlogPost) => {
    setEditingPost(post);
    setIsCreating(true);
  };

  const cancelEditor = () => {
    setIsCreating(false);
    setEditingPost(null);
  };

  const savePost = (data: {
    title: string;
    content: string;
    category: string;
    tags: string[];
    isPublic: boolean;
  }) => {
    if (editingPost) {
      const updated = { ...editingPost, ...data };
      setPosts(posts.map((p) => (p.id === editingPost.id ? updated : p)));
      savePostToDB({ id: updated.id, title: updated.title, content: updated.content, category: updated.category, tags: updated.tags, is_public: updated.isPublic, created_at: updated.createdAt, images: updated.images });
    } else {
      const newPost: BlogPost = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString().slice(0, 10),
        images: [],
      };
      setPosts([newPost, ...posts]);
      savePostToDB({ id: newPost.id, title: newPost.title, content: newPost.content, category: newPost.category, tags: newPost.tags, is_public: newPost.isPublic, created_at: newPost.createdAt, images: newPost.images });
    }
    cancelEditor();
  };

  const deletePost = (id: string) => {
    setPosts(posts.filter((p) => p.id !== id));
    deletePostFromDB(id);
  };

  const togglePostVisibility = (id: string) => {
    const updated = posts.map((p) => (p.id === id ? { ...p, isPublic: !p.isPublic } : p));
    setPosts(updated);
    const post = updated.find((p) => p.id === id);
    if (post) savePostToDB({ id: post.id, title: post.title, content: post.content, category: post.category, tags: post.tags, is_public: post.isPublic, created_at: post.createdAt, images: post.images });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
        <Lock className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">블로그 관리는 비공개입니다</p>
        <p className="text-xs text-muted-foreground/60 mt-1">게스트 모드에서는 열람할 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AnimatePresence mode="wait">
        {isCreating ? (
          <PostEditor
            key="editor"
            initialTitle={editingPost?.title ?? ""}
            initialContent={editingPost?.content ?? ""}
            initialCategory={editingPost?.category ?? categories[0] ?? "일상"}
            initialTags={editingPost?.tags.join(", ") ?? ""}
            initialIsPublic={editingPost?.isPublic ?? true}
            categories={categories}
            isEditing={!!editingPost}
            onSave={savePost}
            onCancel={cancelEditor}
          />
        ) : (
          <motion.div
            key="list-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl sm:text-2xl font-bold">블로그 관리</h2>
              </div>
              <button
                onClick={startCreate}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                <span>새 글 작성</span>
              </button>
            </div>

            {/* Blog Settings */}
            <BlogSettings
              categories={categories}
              onAddCategory={addCategory}
              onRemoveCategory={removeCategory}
              subtitle={subtitle}
              onSubtitleChange={(v: string) => {
                setSubtitle(v);
                localStorage.setItem("sophia-blog-subtitle", v);
                // debounce Supabase save
                if ((window as Record<string, unknown>).__subtitleTimer) clearTimeout((window as Record<string, unknown>).__subtitleTimer as number);
                (window as Record<string, unknown>).__subtitleTimer = setTimeout(() => {
                  saveBlogSettings({ blog_subtitle: v });
                  console.log("[BlogSettings] subtitle saved to Supabase:", v);
                }, 500);
              }}
            />

            {/* Post list */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-mono">
                게시글 {posts.length}개
              </p>
              <div className="space-y-2">
                {posts.map((post, index) => (
                  <PostListItem
                    key={post.id}
                    post={post}
                    index={index}
                    onEdit={() => startEdit(post)}
                    onDelete={() => deletePost(post.id)}
                    onToggleVisibility={() => togglePostVisibility(post.id)}
                  />
                ))}

                {posts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground font-mono">
                      아직 작성한 글이 없습니다
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BlogManagement;
