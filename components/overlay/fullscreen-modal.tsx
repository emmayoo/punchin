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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/92 px-5 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-neutral-900 p-5">
        {children}
      </div>
    </div>
  );
}
