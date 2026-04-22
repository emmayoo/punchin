"use client";

import { FullscreenModal } from "@/components/overlay/fullscreen-modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText?: string;
  tone?: "default" | "danger";
  busy?: boolean;
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
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmClass =
    tone === "danger"
      ? "bg-rose-400 text-rose-950 hover:bg-rose-300"
      : "bg-white text-neutral-950 hover:bg-neutral-200";

  return (
    <FullscreenModal open={open}>
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-sm text-neutral-400">{description}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-medium text-neutral-200 disabled:opacity-60"
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
