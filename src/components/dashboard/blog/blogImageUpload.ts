// 블로그 이미지 업로드 공통 헬퍼 — 에디터 삽입/붙여넣기/사진으로 글쓰기에서 같이 사용
import { resizeImage } from "@/lib/imageResize";

/** 업로드용 최대 긴 변 (px) */
export const BLOG_UPLOAD_MAX_SIDE = 1600;

/** Blob을 Supabase Storage `blog-images` 버킷에 올리고 public URL 반환 (실패 시 null) */
export async function uploadBlobToBlogStorage(blob: Blob, ext: string): Promise<string | null> {
  try {
    const { supabase } = await import("@/lib/supabase");
    if (!supabase) return null;
    const fileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from("blog-images")
      .upload(fileName, blob, { contentType: blob.type || "image/jpeg" });
    if (error) { console.error("Upload error:", error); return null; }
    const { data: urlData } = supabase.storage.from("blog-images").getPublicUrl(fileName);
    return urlData.publicUrl;
  } catch (e) {
    console.error("Image upload failed:", e);
    return null;
  }
}

/**
 * 이미지 파일을 긴 변 1600px JPEG로 줄여서 업로드.
 * GIF(움짤)는 리사이즈하면 애니메이션이 사라지므로 원본 그대로 올린다.
 * 디코딩 불가(HEIC 등)면 resizeImage의 한국어 에러를 그대로 던진다.
 */
export async function uploadBlogImage(file: File): Promise<string | null> {
  if (file.type === "image/gif") {
    return uploadBlobToBlogStorage(file, "gif");
  }
  const { blob } = await resizeImage(file, BLOG_UPLOAD_MAX_SIDE);
  return uploadBlobToBlogStorage(blob, "jpg");
}
