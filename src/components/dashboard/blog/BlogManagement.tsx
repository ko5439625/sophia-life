import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { enhanceBlogContent } from "../../../services/openaiApi";
import { useGuestMode } from "../../../hooks/useGuestMode";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import PhotoBlogWizard, { type PhotoBlogInsertPayload } from "./PhotoBlogWizard";
import { uploadBlogImage } from "./blogImageUpload";
import BlogPreviewDialog from "./BlogPreviewDialog";
import type { BlogPostArticleData } from "./BlogPostArticle";
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
  Camera,
  Undo2,
  Eye,
  ExternalLink,
  ArrowRight,
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
                  className="w-full min-h-[40px] bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
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
                      className="inline-flex items-center gap-1 bg-muted pl-3 pr-2 min-h-[36px] rounded-lg text-xs font-medium text-foreground/80 group"
                    >
                      {cat}
                      <button
                        onClick={() => onRemoveCategory(cat)}
                        aria-label="카테고리 삭제"
                        className="h-8 w-8 -my-1 -mr-2 flex items-center justify-center rounded-md opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:text-destructive"
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
                    className="flex-1 min-w-0 min-h-[40px] bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                  />
                  <button
                    onClick={handleAdd}
                    className="min-h-[40px] px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
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
    className="bg-card rounded-xl pl-4 pr-2 sm:px-5 py-3 group"
  >
    <div className="flex items-center justify-between gap-2 sm:gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <h3 className="text-sm font-medium truncate">{post.title}</h3>
          <button
            onClick={onToggleVisibility}
            title={post.isPublic ? "공개" : "비공개"}
            aria-label={post.isPublic ? "공개 글 (눌러서 비공개로)" : "비공개 글 (눌러서 공개로)"}
            className="h-10 w-10 -my-1.5 flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
          >
            {post.isPublic ? (
              <Globe className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono min-w-0">
          <span className="bg-muted px-2 py-0.5 rounded">{post.category}</span>
          <span className="tabular-nums flex-shrink-0">{post.createdAt?.slice(0, 10)}</span>
          {post.tags.length > 0 && (
            <span className="hidden sm:inline truncate">
              {post.tags.map((t) => `#${t}`).join(" ")}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={onEdit}
          aria-label="수정"
          className="h-10 w-10 flex items-center justify-center hover:bg-muted rounded-lg transition-colors"
        >
          <Edit3 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
        <button
          onClick={onDelete}
          aria-label="삭제"
          className="h-10 w-10 flex items-center justify-center hover:bg-muted rounded-lg transition-colors"
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
  initialDate,
  initialImages,
  categories,
  isEditing,
  onSave,
  onCancel,
  autoOpenPhotoWizard = false,
}: {
  initialTitle: string;
  initialContent: string;
  initialCategory: string;
  initialTags: string;
  initialIsPublic: boolean;
  /** 미리보기에 표시할 날짜 (수정 시 원래 작성일) */
  initialDate: string;
  /** 미리보기 커버 갤러리 (공개 페이지와 동일하게 post.images 사용) */
  initialImages: string[];
  categories: string[];
  isEditing: boolean;
  /** 홈 "블로그" 바로가기 등으로 진입 시 사진으로 글쓰기 창을 바로 연다 */
  autoOpenPhotoWizard?: boolean;
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
  const [showPhotoWizard, setShowPhotoWizard] = useState(autoOpenPhotoWizard);
  // "사진 글을 에디터에 넣었어요" 안내 — 이 에디터 인스턴스에서만 보이고 6초/첫 수정/발행 시 사라짐
  const [insertHint, setInsertHint] = useState(false);
  const [previewPost, setPreviewPost] = useState<BlogPostArticleData | null>(null);
  // AI 다듬기 직전 본문 (되돌리기용)
  const [aiUndoHtml, setAiUndoHtml] = useState<string | null>(null);
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
  // 긴 변 1600px JPEG로 줄여서 업로드 (GIF는 원본). 디코딩 불가(HEIC 등)면 토스트로 안내
  const uploadImageToStorage = async (file: File): Promise<string | null> => {
    try {
      return await uploadBlogImage(file);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "이미지 업로드에 실패했어요.");
      return null;
    }
  };

  // 이미지 여러 장을 커서 위치에 순서대로 삽입 (각각 placeholder → 업로드 → img 교체)
  const insertImageFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    setUploadingImage(true);
    const placeholderIds = images.map(() => `img-loading-${crypto.randomUUID().slice(0, 8)}`);
    insertAtCursor(
      "<br>" +
        placeholderIds
          .map((id) => `<span id="${id}" style="color:#888;font-size:12px;">📷 이미지 업로드 중...</span><br>`)
          .join("")
    );
    let failed = 0;
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const url = await uploadImageToStorage(file);
      const placeholder = contentRef.current?.querySelector(`#${placeholderIds[i]}`);
      if (url && placeholder) {
        placeholder.outerHTML = `<img src="${url}" alt="${file.name.replace(/"/g, "&quot;")}" style="max-width:100%;border-radius:8px;margin:8px 0;" />`;
      } else if (placeholder) {
        failed++;
        placeholder.outerHTML = `<span style="color:#ef4444;font-size:12px;">이미지 업로드 실패</span>`;
      }
    }
    setUploadingImage(false);
    if (failed < images.length) {
      setPasteToast(true);
      setTimeout(() => setPasteToast(false), 2000);
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
      // 붙여넣은 이미지 파일 전부 업로드
      const pastedImages = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (pastedImages.length > 0) {
        e.preventDefault();
        await insertImageFiles(pastedImages);
        return;
      }
      // For plain text paste, prevent default rich-text paste
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") || "";
      document.execCommand("insertText", false, text);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // AI content enhancement - Gemini (mock 폴백 없음: 실패 시 토스트로 안내)
  const handleAiEnhance = useCallback(async () => {
    if (!contentRef.current) return;
    // Send full HTML to preserve images and existing formatting
    const currentHtml = contentRef.current.innerHTML;
    if (!currentHtml.trim()) {
      toast.info("다듬을 본문을 먼저 작성해주세요.");
      return;
    }
    setAiLoading(true);

    try {
      const enhanced = await enhanceBlogContent(currentHtml);
      if (!contentRef.current) return;
      contentRef.current.innerHTML = enhanced;
      setAiUndoHtml(currentHtml); // 되돌리기용으로 이전 본문 보관
      setAiToast(true);
      setTimeout(() => setAiToast(false), 2500);
    } catch (err) {
      console.warn("AI enhance failed:", err);
      toast.error(err instanceof Error ? err.message : "AI 다듬기에 실패했어요.");
    } finally {
      setAiLoading(false);
    }
  }, []);

  // AI 다듬기 되돌리기
  const handleAiUndo = useCallback(() => {
    if (!contentRef.current || aiUndoHtml === null) return;
    contentRef.current.innerHTML = aiUndoHtml;
    setAiUndoHtml(null);
    toast.success("AI 다듬기 전으로 되돌렸어요.");
  }, [aiUndoHtml]);

  // 사진으로 글쓰기 결과 삽입 — 본문이 비어 있으면 통째로, 아니면 끝에 이어 붙임
  const handlePhotoBlogInsert = useCallback((payload: PhotoBlogInsertPayload) => {
    const el = contentRef.current;
    if (!el) return;
    const isEmpty = !el.textContent?.trim() && !el.querySelector("img");
    el.innerHTML = isEmpty ? payload.html : `${el.innerHTML}<br>${payload.html}`;
    setAiUndoHtml(null);
    if (payload.title) setTitle((prev) => (prev.trim() ? prev : payload.title));
    if (payload.tags.length > 0) {
      setTagsInput((prev) => {
        const existing = prev.split(",").map((t) => t.trim()).filter(Boolean);
        return Array.from(new Set([...existing, ...payload.tags])).join(", ");
      });
    }
    setInsertHint(true);
  }, []);

  useEffect(() => {
    if (!insertHint) return;
    const t = window.setTimeout(() => setInsertHint(false), 6000);
    return () => window.clearTimeout(t);
  }, [insertHint]);

  const parseTags = () =>
    tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const openPreview = () => {
    setInsertHint(false);
    setPreviewPost({
      title: title.trim(),
      content: getContentAsHtml(),
      category,
      date: initialDate,
      tags: parseTags(),
      images: initialImages,
    });
  };

  // Handle file input for inline image insertion → upload to Supabase Storage
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    contentRef.current?.focus();
    // 커서가 에디터 밖이면 본문 끝으로 이동
    const sel = window.getSelection();
    if (contentRef.current && (!sel || sel.rangeCount === 0 || !contentRef.current.contains(sel.anchorNode))) {
      const range = document.createRange();
      range.selectNodeContents(contentRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    await insertImageFiles(files);
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleSave = () => {
    if (!title.trim()) return;
    setInsertHint(false);
    setPreviewPost(null);
    const tags = parseTags();
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
      <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
        <button
          onClick={onCancel}
          className="min-h-[40px] -ml-1 px-1 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>돌아가기</span>
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Visibility toggle */}
          <button
            onClick={() => setIsPublic(!isPublic)}
            className={`min-h-[40px] flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
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
          {/* Preview */}
          <button
            onClick={openPreview}
            className="min-h-[40px] flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors flex-shrink-0"
            title="공개 블로그에 보이는 모습 미리보기"
          >
            <Eye className="h-3.5 w-3.5" />
            미리보기
          </button>
          {/* Save */}
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="min-h-[40px] px-4 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex-shrink-0"
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
              className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg"
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
            className="w-full bg-transparent text-xl sm:text-2xl md:text-3xl font-bold placeholder:text-muted-foreground/30 focus:outline-none border-none leading-tight mb-1"
            style={{ fontSize: "max(20px, 1.5rem)" }}
            autoFocus
          />

          {/* Divider */}
          <div className="h-px bg-border/50 my-4" />

          {/* Toolbar */}
          <div className="mb-4 border-b border-border/50 pb-3 space-y-2">
            {/* Row 1: Format & structure buttons */}
            <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide pb-1">
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
                  className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  title={title}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}

              <div className="w-px h-4 bg-border mx-1 flex-shrink-0" />

              {/* Heading buttons */}
              <button
                onClick={() => execFormat("formatBlock", "h2")}
                className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="제목 (H2)"
              >
                <Heading1 className="h-4 w-4" />
              </button>
              <button
                onClick={() => execFormat("formatBlock", "h3")}
                className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="소제목 (H3)"
              >
                <Heading2 className="h-4 w-4" />
              </button>

              <div className="w-px h-4 bg-border mx-1 flex-shrink-0" />

              {/* List buttons */}
              <button
                onClick={() => execFormat("insertUnorderedList")}
                className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="글머리 목록"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => execFormat("insertOrderedList")}
                className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="번호 목록"
              >
                <ListOrdered className="h-4 w-4" />
              </button>
              <button
                onClick={() => execFormat("formatBlock", "blockquote")}
                className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="인용"
              >
                <Quote className="h-4 w-4" />
              </button>
              <button
                onClick={insertToggle}
                className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="접힘 (토글)"
              >
                <ChevronsDownUp className="h-4 w-4" />
              </button>
              <button
                onClick={insertHR}
                className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="구분선"
              >
                <Minus className="h-4 w-4" />
              </button>

              <div className="w-px h-4 bg-border mx-1 flex-shrink-0" />

              {/* Alignment buttons */}
              <button
                onClick={() => execFormat("justifyLeft")}
                className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="왼쪽 정렬"
              >
                <AlignLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => execFormat("justifyCenter")}
                className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="가운데 정렬"
              >
                <AlignCenter className="h-4 w-4" />
              </button>
              <button
                onClick={() => execFormat("justifyRight")}
                className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="오른쪽 정렬"
              >
                <AlignRight className="h-4 w-4" />
              </button>

              <div className="w-px h-4 bg-border mx-1 flex-shrink-0" />

              {/* Image */}
              <button
                onClick={handleImageClick}
                disabled={uploadingImage}
                className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                title="이미지 삽입 (여러 장 선택 가능, Ctrl+V로도 가능)"
              >
                {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              </button>

              {/* Category/Tags */}
              <button
                onClick={() => setShowMeta(!showMeta)}
                className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg transition-colors ${
                  showMeta ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title="카테고리 / 태그"
              >
                <Tag className="h-4 w-4" />
              </button>
            </div>

            {/* Row 2: Font, size, color, AI */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1">
              {/* Font selector (per-selection) */}
              <div className="relative" ref={fontPickerRef}>
                <button
                  onMouseDown={(e) => { e.preventDefault(); saveSelection(); setShowFontPicker(!showFontPicker); setShowFontSizePicker(false); setShowColorPicker(false); }}
                  className="h-10 flex items-center gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-border/50 flex-shrink-0"
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
                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors ${
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
                  className="h-10 flex items-center gap-0.5 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-border/50 flex-shrink-0"
                  title="글자 크기 (텍스트 선택 후 적용)"
                >
                  <ALargeSmall className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-mono tabular-nums">{fontSizeInput}px</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showFontSizePicker && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl py-1 w-24 max-h-64 overflow-y-auto">
                    {FONT_SIZE_PRESETS.map((s) => (
                      <button
                        key={s.value}
                        onMouseDown={(e) => { e.preventDefault(); applyFontSize(s.value); }}
                        className={`w-full text-left px-3 py-2.5 text-sm font-mono hover:bg-muted transition-colors ${
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
                  className="h-10 flex items-center gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-border/50 flex-shrink-0"
                  title="텍스트 색상 (텍스트 선택 후 적용)"
                >
                  <Palette className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-[11px]">색상</span>
                </button>
                {showColorPicker && (
                  <div className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-xl p-2.5" style={{ width: "236px" }}
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
                          className="w-8 h-8 rounded-md border border-border/50 hover:scale-110 transition-transform flex items-center justify-center"
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

              <div className="w-px h-4 bg-border mx-1 flex-shrink-0" />

              {/* AI Enhance button */}
              <button
                onClick={handleAiEnhance}
                disabled={aiLoading}
                className="h-10 flex items-center gap-1 px-3 text-xs font-medium bg-muted text-foreground hover:bg-foreground/10 rounded-lg transition-all disabled:opacity-50 flex-shrink-0 whitespace-nowrap"
                title="AI로 글 다듬기 (이미지 유지)"
              >
                {aiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>{aiLoading ? "작성 중..." : "AI 다듬기"}</span>
              </button>
              {aiUndoHtml !== null && !aiLoading && (
                <button
                  onClick={handleAiUndo}
                  className="h-10 flex items-center gap-1 px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-border/50 flex-shrink-0"
                  title="AI 다듬기 전 본문으로 되돌리기"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">되돌리기</span>
                </button>
              )}

              {/* 사진으로 글쓰기 */}
              <button
                onClick={() => setShowPhotoWizard(true)}
                className="h-10 flex items-center gap-1 px-3 text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 rounded-lg transition-all flex-shrink-0"
                title="사진 여러 장으로 AI 블로그 초안 만들기"
              >
                <Camera className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">사진으로 글쓰기</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
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
                          className={`min-h-[40px] px-3.5 rounded-lg text-xs font-medium transition-colors ${
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
                      className="w-full min-h-[40px] bg-background border border-border rounded-lg px-3 py-1.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/40"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 사진 글 삽입 안내 — 인라인, 6초 뒤/첫 수정/발행 시 자동으로 사라짐 */}
          <AnimatePresence>
            {insertHint && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                role="status"
                className="mb-4 flex items-center gap-2 rounded-lg bg-primary/10 pl-3 pr-1 text-sm text-foreground overflow-hidden"
              >
                <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                <p className="flex-1 min-w-0 py-2.5 break-keep leading-snug">
                  사진 글을 넣었어요. 확인하고 <button type="button" onClick={openPreview} className="inline-flex items-center min-h-[32px] -my-1.5 font-medium text-foreground underline underline-offset-4 decoration-love">미리보기</button> 후 발행해주세요.
                </p>
                <button
                  type="button"
                  onClick={() => setInsertHint(false)}
                  aria-label="안내 닫기"
                  className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content area -- contentEditable div for true inline editing (공개 글과 같은 .blog-content 스타일) */}
          <div
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onPaste={handlePaste}
            onInput={insertHint ? () => setInsertHint(false) : undefined}
            data-placeholder="여기에 글을 작성하세요... (텍스트 선택 후 글꼴/크기/색상 적용)"
            className="blog-content w-full bg-transparent focus:outline-none border-none min-h-[300px] sm:min-h-[500px] whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/30"
          />
        </div>
      </div>

      {/* 미리보기 (공개 페이지와 같은 렌더러) */}
      <BlogPreviewDialog
        open={previewPost !== null}
        onOpenChange={(o) => { if (!o) setPreviewPost(null); }}
        post={previewPost}
        publishLabel={isEditing ? "수정" : "발행"}
        canPublish={!!title.trim()}
        onPublish={handleSave}
      />

      {/* 사진으로 글쓰기 위저드 */}
      <PhotoBlogWizard
        open={showPhotoWizard}
        onOpenChange={setShowPhotoWizard}
        onInsert={handlePhotoBlogInsert}
      />
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const BLOG_CATEGORIES_KEY = "sophia-blog-categories";

const BlogManagement = ({ initialTab, onTabUsed }: { initialTab?: string | null; onTabUsed?: () => void } = {}) => {
  const { isGuest } = useGuestMode();
  const navigate = useNavigate();
  // 발행/수정 직후 "글 보러 가기" 안내
  const [published, setPublished] = useState<{ id: string; title: string; isNew: boolean; isPublic: boolean } | null>(null);
  useEffect(() => {
    if (!published) return;
    const t = window.setTimeout(() => setPublished(null), 10000);
    return () => window.clearTimeout(t);
  }, [published]);
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
  // 마지막으로 DB와 일치한다고 알려진 카테고리 스냅샷 (변경 없을 땐 저장 생략)
  const syncedCategoriesJson = useRef<string | null>(null);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const editorCategories = useMemo(
    () => Array.from(new Set([...categories, ...posts.map((p) => p.category).filter(Boolean)])),
    [categories, posts]
  );
  const [autoPhotoWizard, setAutoPhotoWizard] = useState(false);

  // "blog:photo"로 진입 → 새 글 + 사진으로 글쓰기 바로 열기 (모바일 바로 작성)
  useEffect(() => {
    if (initialTab === "photo") {
      setEditingPost(null);
      setAutoPhotoWizard(true);
      setIsCreating(true);
      onTabUsed?.();
    }
  }, [initialTab, onTabUsed]);

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
          syncedCategoriesJson.current = JSON.stringify(data.blog_categories);
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
    const json = JSON.stringify(categories);
    if (json === syncedCategoriesJson.current) return; // 로드 직후/변경 없음 → 저장 안 함
    syncedCategoriesJson.current = json;
    import("@/lib/supabase").then(({ supabase }) => {
      if (!supabase) return;
      supabase.from("user_settings").upsert({ id: "c7a9defe-0e45-57e0-9b26-4ef82dd867c1", blog_categories: categories });
    });
  }, [categories]);

  // --- Category management ---
  const addCategory = (cat: string) => {
    setCategories([...categories, cat]);
  };
  const removeCategory = async (cat: string) => {
    const ok = await confirmDialog({ title: "삭제할까요?", description: `'${cat}' 카테고리를 삭제할까요?`, confirmText: "삭제" });
    if (!ok) return;
    setCategories((prev) => prev.filter((c) => c !== cat));
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
    setAutoPhotoWizard(false);
    setIsCreating(true);
  };

  const startPhotoCreate = () => {
    setEditingPost(null);
    setAutoPhotoWizard(true);
    setIsCreating(true);
  };

  const startEdit = (post: BlogPost) => {
    setEditingPost(post);
    setIsCreating(true);
  };

  const cancelEditor = () => {
    setAutoPhotoWizard(false);
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
    let saved: Promise<void>;
    let target: { id: string; title: string; isNew: boolean; isPublic: boolean };
    if (editingPost) {
      const updated = { ...editingPost, ...data };
      setPosts(posts.map((p) => (p.id === editingPost.id ? updated : p)));
      saved = savePostToDB({ id: updated.id, title: updated.title, content: updated.content, category: updated.category, tags: updated.tags, is_public: updated.isPublic, created_at: updated.createdAt, images: updated.images });
      target = { id: updated.id, title: updated.title, isNew: false, isPublic: updated.isPublic };
    } else {
      const newPost: BlogPost = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString().slice(0, 10),
        images: [],
      };
      setPosts([newPost, ...posts]);
      saved = savePostToDB({ id: newPost.id, title: newPost.title, content: newPost.content, category: newPost.category, tags: newPost.tags, is_public: newPost.isPublic, created_at: newPost.createdAt, images: newPost.images });
      target = { id: newPost.id, title: newPost.title, isNew: true, isPublic: newPost.isPublic };
    }
    cancelEditor();
    // 저장이 끝난 뒤에 "글 보러 가기" 제공 (먼저 이동하면 공개 페이지에서 글을 못 찾음)
    saved.then(() => setPublished(target));
  };

  const deletePost = async (id: string) => {
    const title = posts.find((p) => p.id === id)?.title;
    const ok = await confirmDialog({
      title: "삭제할까요?",
      description: title ? `'${title}' 글을 삭제하면 되돌릴 수 없어요.` : undefined,
      confirmText: "삭제",
    });
    if (!ok) return;
    setPosts((prev) => prev.filter((p) => p.id !== id));
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
            initialDate={editingPost?.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}
            initialImages={editingPost?.images ?? []}
            categories={editorCategories}
            isEditing={!!editingPost}
            autoOpenPhotoWizard={autoPhotoWizard}
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 md:hidden" />
                <h2 className="text-xl sm:text-2xl font-bold truncate md:hidden">블로그 관리</h2>
                {/* 공개 블로그 메인 (사이드바 로고와 같은 주소) */}
                <button
                  onClick={() => navigate("/?blog=true")}
                  className="ml-auto sm:ml-1 flex-shrink-0 flex items-center gap-1 rounded-lg px-2.5 min-h-[40px] text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="공개 블로그 메인으로 이동"
                >
                  <span>블로그 보기</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <button
                  onClick={startPhotoCreate}
                  className="flex items-center justify-center gap-1.5 bg-muted text-foreground rounded-lg px-3 min-h-[44px] sm:min-h-[40px] text-sm font-medium hover:bg-muted/80 transition-colors"
                >
                  <Camera className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">사진으로 글쓰기</span>
                </button>
                <button
                  onClick={startCreate}
                  className="flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 min-h-[44px] sm:min-h-[40px] text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-4 w-4 flex-shrink-0" />
                  <span>새 글</span>
                </button>
              </div>
            </div>

            {/* 발행 직후 바로가기 */}
            <AnimatePresence>
              {published && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  role="status"
                  className="flex items-center gap-2 rounded-xl bg-card border border-border pl-4 pr-1 py-1"
                >
                  <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                  <p className="flex-1 min-w-0 text-sm py-2">
                    <span className="block truncate font-medium">{published.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {published.isNew ? "발행했어요" : "수정했어요"}
                      {!published.isPublic && " · 비공개 글"}
                    </span>
                  </p>
                  <button
                    onClick={() => navigate(`/post/${published.id}`)}
                    className="flex-shrink-0 flex items-center gap-1 rounded-lg px-3 min-h-[40px] text-sm font-medium text-foreground bg-muted hover:bg-muted/80 transition-colors"
                  >
                    글 보러 가기
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPublished(null)}
                    aria-label="닫기"
                    className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

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
                if ((window as unknown as Record<string, unknown>).__subtitleTimer) clearTimeout((window as unknown as Record<string, unknown>).__subtitleTimer as number);
                (window as unknown as Record<string, unknown>).__subtitleTimer = setTimeout(() => {
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
