"use client";

import { ReactNode } from "react";

type FullscreenModalProps = {
  open: boolean;
  children: ReactNode;
};

export function FullscreenModal({ open, children }: FullscreenModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-200/60 px-5 py-8 backdrop-blur-sm dark:bg-neutral-950/92">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200/90 bg-white p-5 dark:border-white/15 dark:bg-neutral-900">
        {children}
      </div>
    </div>
  );
}
