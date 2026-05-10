"use client";

import { assertValidImageFile } from "@/lib/media/validate-image";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const MEDIA_BUCKET = "media";

export function getMediaPublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL 가 설정되어 있지 않습니다.");
  }
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${storagePath}`;
}

function extFromFile(file: File): string {
  const fromName = file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  const t = file.type;
  if (t === "image/jpeg") {
    return "jpg";
  }
  if (t === "image/png") {
    return "png";
  }
  if (t === "image/webp") {
    return "webp";
  }
  if (t === "image/gif") {
    return "gif";
  }
  return "jpg";
}

export function newAvatarStoragePath(employeeId: string, file: File): string {
  return `avatars/${employeeId}/${crypto.randomUUID()}.${extFromFile(file)}`;
}

export function newBranchProfileStoragePath(branchId: string, file: File): string {
  return `branches/${branchId}/profile/${crypto.randomUUID()}.${extFromFile(file)}`;
}

export function newNoticeAttachmentStoragePath(noticeId: string, file: File): string {
  return `notices/${noticeId}/${crypto.randomUUID()}.${extFromFile(file)}`;
}

export async function uploadPublicImage(path: string, file: File): Promise<string> {
  assertValidImageFile(file);
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });
  if (error) {
    throw new Error(error.message);
  }
  return getMediaPublicUrl(path);
}
