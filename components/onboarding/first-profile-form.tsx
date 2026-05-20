"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";

import { formatPhoneNumber } from "@/lib/phone";
import { shouldUnoptimizeNextImage } from "@/lib/media/next-image";
import { assertValidImageFile } from "@/lib/media/validate-image";
import { toast } from "@/lib/toast";

export type FirstProfileFormAvatarProps = {
  avatarFile: File | null;
  onAvatarFileChange: (file: File | null) => void;
  /** 이미 직원 행에 저장된 사진 URL(이름 확인 게이트 등) */
  remoteAvatarUrl?: string | null;
  /** 제출 시 서버 프로필 사진 삭제 */
  pendingRemoveRemoteAvatar?: boolean;
  onPendingRemoveRemoteAvatar?: () => void;
};

type FirstProfileFormProps = {
  phone: string;
  name: string;
  busy: boolean;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
  /** 기본: 프로필 등록 */
  heading?: string;
  /** 제목 아래 설명 (선택) */
  description?: string | null;
  /** 기본: 프로필 완료 */
  submitLabel?: string;
} & Partial<FirstProfileFormAvatarProps>;

export function FirstProfileForm({
  phone,
  name,
  busy,
  onNameChange,
  onSubmit,
  heading = "프로필 등록",
  description = null,
  submitLabel = "프로필 완료",
  avatarFile = null,
  onAvatarFileChange,
  remoteAvatarUrl = null,
  pendingRemoveRemoteAvatar = false,
  onPendingRemoveRemoteAvatar,
}: FirstProfileFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarEnabled = typeof onAvatarFileChange === "function";

  const blobPreviewUrl = useMemo(() => {
    if (!avatarFile) {
      return null;
    }
    return URL.createObjectURL(avatarFile);
  }, [avatarFile]);

  useEffect(() => {
    return () => {
      if (blobPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(blobPreviewUrl);
      }
    };
  }, [blobPreviewUrl]);

  const displaySrc = (() => {
    if (pendingRemoveRemoteAvatar) {
      return null;
    }
    if (blobPreviewUrl) {
      return blobPreviewUrl;
    }
    const remote = remoteAvatarUrl?.trim();
    return remote ? remote : null;
  })();

  const handlePick = (files: FileList | null) => {
    if (!avatarEnabled || !onAvatarFileChange) {
      return;
    }
    const file = files?.[0];
    if (!file) {
      return;
    }
    try {
      assertValidImageFile(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "이미지를 선택할 수 없습니다.");
      return;
    }
    onAvatarFileChange(file);
  };

  const handleClear = () => {
    if (!avatarEnabled || !onAvatarFileChange) {
      return;
    }
    if (avatarFile) {
      onAvatarFileChange(null);
      return;
    }
    if (remoteAvatarUrl?.trim() && onPendingRemoveRemoteAvatar) {
      onPendingRemoveRemoteAvatar();
    }
  };

  const hasRemovable =
    avatarEnabled &&
    (Boolean(avatarFile) || (Boolean(remoteAvatarUrl?.trim()) && !pendingRemoveRemoteAvatar));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">{heading}</h2>
        <p className="text-xs text-zinc-500 dark:text-neutral-500">{formatPhoneNumber(phone)}</p>
        {description ? (
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-neutral-400">{description}</p>
        ) : null}
      </div>

      {avatarEnabled ? (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-dashed border-zinc-300/90 bg-zinc-100/80 outline-none transition-colors hover:border-zinc-400 disabled:opacity-60 dark:border-white/20 dark:bg-neutral-950/70 dark:hover:border-white/35"
            aria-label="프로필 사진 선택"
          >
            {displaySrc ? (
              <Image
                src={displaySrc}
                alt=""
                fill
                sizes="96px"
                className="object-cover"
                unoptimized={shouldUnoptimizeNextImage(displaySrc)}
              />
            ) : (
              <span className="text-xs font-medium text-zinc-500 dark:text-neutral-400">
                {name.trim().slice(0, 1) || "프로필"}
              </span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              handlePick(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-zinc-300/90 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-60 dark:border-white/20 dark:bg-neutral-950 dark:text-white"
            >
              사진 선택
            </button>
            {hasRemovable ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleClear}
                className="rounded-lg border border-zinc-300/90 px-2.5 py-1.5 text-xs text-zinc-700 disabled:opacity-60 dark:border-white/20 dark:text-neutral-200"
              >
                사진 제거
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs text-zinc-600 dark:text-neutral-400">이름 (닉네임)</span>
        <input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="이름 입력"
          className="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-white/35"
        />
      </label>

      <button
        onClick={onSubmit}
        disabled={busy || !name.trim()}
        className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-950"
      >
        {busy ? "처리 중..." : submitLabel}
      </button>
    </div>
  );
}
