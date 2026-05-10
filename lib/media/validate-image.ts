/** 브라우저에서 선택한 이미지 파일 검증 (Storage allowed_mime_types 와 맞출 것). */

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const IMAGE_ACCEPT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function assertValidImageFile(file: File): void {
  if (!IMAGE_ACCEPT_MIME.has(file.type)) {
    throw new Error("지원 형식: JPEG, PNG, WebP, GIF");
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error("이미지는 5MB 이하여야 합니다.");
  }
}
