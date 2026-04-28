"use client";

import { FullscreenModal } from "@/components/overlay/fullscreen-modal";
import type { ReactNode } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  body?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  cancelText = "취소",
  tone = "default",
  busy = false,
  body,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmClass =
    tone === "danger"
      ? "bg-rose-400 text-rose-950 hover:bg-rose-300"
      : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200";

  return (
    <FullscreenModal open={open}>
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
            {title}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-neutral-400">
            {description}
          </p>
        </div>
        {body ? <div>{body}</div> : null}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-zinc-200/90 px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-60 dark:border-white/20 dark:text-neutral-200"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${confirmClass}`}
          >
            {busy ? "처리 중..." : confirmText}
          </button>
        </div>
      </div>
    </FullscreenModal>
  );
}
