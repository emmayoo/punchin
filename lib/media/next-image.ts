/** blob:/data: 미리보기만 Next 이미지 최적화를 건너뜁니다. Supabase 공개 URL은 최적화 대상입니다. */
export function shouldUnoptimizeNextImage(src: string): boolean {
  const trimmed = src.trim();
  return trimmed.startsWith("blob:") || trimmed.startsWith("data:");
}
