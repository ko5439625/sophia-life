// 이미지 리사이즈 유틸 — 업로드/AI 요청 전에 긴 변 기준으로 줄이고 JPEG로 변환
// EXIF 회전은 createImageBitmap의 imageOrientation: "from-image"로 반영

export interface ResizedImage {
  blob: Blob;
  /** data: 접두어 없는 순수 base64 (Gemini inline_data 용) */
  base64: string;
  width: number;
  height: number;
}

const DECODE_ERROR =
  "이 사진 형식은 브라우저에서 열 수 없어요. (HEIC 등) JPG/PNG로 변환한 뒤 다시 올려주세요.";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("이미지 변환에 실패했어요."));
    reader.readAsDataURL(blob);
  });
}

export async function resizeImage(
  file: File | Blob,
  maxSide: number,
  quality = 0.82
): Promise<ResizedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(DECODE_ERROR);
  }

  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지 처리를 지원하지 않는 브라우저예요.");
    // JPEG는 투명도가 없으므로 흰 배경 (PNG 투명 영역이 검게 나오는 것 방지)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("이미지 압축에 실패했어요."))),
        "image/jpeg",
        quality
      );
    });
    const base64 = await blobToBase64(blob);
    return { blob, base64, width, height };
  } finally {
    bitmap.close();
  }
}
