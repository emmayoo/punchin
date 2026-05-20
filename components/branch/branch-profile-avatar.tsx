"use client";

import Image from "next/image";

import { shouldUnoptimizeNextImage } from "@/lib/media/next-image";

type BranchProfileAvatarProps = {
  name: string;
  profileImageUrl?: string | null;
  /** 기본 40 */
  sizePx?: number;
  className?: string;
};

export function BranchProfileAvatar({
  name,
  profileImageUrl,
  sizePx = 40,
  className = "",
}: BranchProfileAvatarProps) {
  const url = profileImageUrl?.trim();
  const showImg = Boolean(url && url.length > 0);
  const letter = name.trim().slice(0, 1) || "점";
  const letterClass =
    sizePx <= 24 ? "text-[10px]" : sizePx <= 36 ? "text-xs" : "text-sm";

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border border-zinc-200/90 bg-zinc-100 dark:border-white/15 dark:bg-neutral-900 ${className}`}
      style={{ width: sizePx, height: sizePx, minWidth: sizePx, minHeight: sizePx }}
    >
      {showImg && url ? (
        <Image
          src={url}
          alt=""
          fill
          sizes={`${sizePx}px`}
          className="object-cover"
          unoptimized={shouldUnoptimizeNextImage(url)}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center font-semibold text-zinc-500 dark:text-neutral-400 ${letterClass}`}
        >
          {letter}
        </div>
      )}
    </div>
  );
}
