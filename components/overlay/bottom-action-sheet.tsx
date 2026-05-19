"use client";

import { type ReactNode, useEffect } from "react";

type BottomActionSheetProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
};

export function BottomActionSheet({ open, title, onClose, children }: BottomActionSheetProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "메뉴"}
        className="relative rounded-t-2xl border border-b-0 border-zinc-200/90 bg-white px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 dark:border-white/10 dark:bg-neutral-900"
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-zinc-200 dark:bg-white/20" aria-hidden />
        {title ? (
          <p className="mb-1 px-2 text-center text-xs font-medium text-zinc-500 dark:text-neutral-400">
            {title}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

type ActionSheetItemProps = {
  onClick: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  children: ReactNode;
};

export function ActionSheetItem({ onClick, icon, destructive, children }: ActionSheetItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-medium transition-colors active:bg-zinc-100 dark:active:bg-white/10 ${
        destructive
          ? "text-rose-600 dark:text-rose-400"
          : "text-zinc-900 dark:text-neutral-100"
      }`}
    >
      {icon ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-500 dark:text-neutral-400">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
