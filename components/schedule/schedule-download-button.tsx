"use client";

import { ImageDown } from "lucide-react";

export type ScheduleDownloadButtonProps = {
  onClick: () => void;
  busy?: boolean;
  className?: string;
  ariaLabel?: string;
};

const DEFAULT_CLASS =
  "inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-300/90 bg-zinc-200/50 px-2 text-xs text-zinc-800 shadow-sm backdrop-blur-sm enabled:hover:bg-zinc-300/50 disabled:opacity-50 dark:border-white/20 dark:bg-black/50 dark:text-neutral-200 dark:enabled:hover:bg-white/10";

export function ScheduleDownloadButton({
  onClick,
  busy = false,
  className,
  ariaLabel = "스케줄 다운로드",
}: ScheduleDownloadButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={className ? `${DEFAULT_CLASS} ${className}` : DEFAULT_CLASS}
      aria-label={ariaLabel}
    >
      <ImageDown className="h-3.5 w-3.5" aria-hidden />
      {busy ? "저장 중" : "스케줄 다운로드"}
    </button>
  );
}

