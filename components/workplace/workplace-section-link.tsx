"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

type WorkplaceSectionLinkProps = {
  href: string;
  label: string;
};

export function WorkplaceSectionLink({ href, label }: WorkplaceSectionLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs text-zinc-600 transition-colors hover:text-zinc-900 dark:text-neutral-400 dark:hover:text-white"
    >
      <span>{label}</span>
      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}
