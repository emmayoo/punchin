"use client";

import type { ReactNode } from "react";

type WorkplaceSectionCardProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

export function WorkplaceSectionCard({ title, action, children }: WorkplaceSectionCardProps) {
  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">{title}</p>
        {action ?? null}
      </div>
      {children}
    </section>
  );
}
