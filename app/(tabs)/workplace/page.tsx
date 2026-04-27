"use client";

import Link from "next/link";
import { TabPageShell } from "@/components/layout/tab-page-shell";
import { WorkplaceBranchSwitcher } from "@/components/workplace/workplace-branch-switcher";

const workplaceMenus = [
  {
    href: "/workplace/history",
    title: "이력",
  },
  {
    href: "/workplace/schedule",
    title: "스케줄",
  },
  {
    href: "/workplace/stats",
    title: "통계",
  },
];

export default function WorkplacePage() {
  return (
    <TabPageShell title="" className="gap-3" bodyClassName="gap-3">
      <>
        <WorkplaceBranchSwitcher />
        <nav
          aria-label="근무 메뉴"
          className="inline-flex w-full items-center gap-2 overflow-x-auto rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-1.5 dark:border-white/10 dark:bg-white/5"
        >
          {workplaceMenus.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className="flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-center text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {menu.title}
            </Link>
          ))}
        </nav>
      </>
    </TabPageShell>
  );
}
