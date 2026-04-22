"use client";

import { BottomNav } from "@/components/layout/bottom-nav";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** `/history/YYYY-MM-DD` — 상세 등에서 하단 탭 숨김 */
const HIDE_TAB_FOR_PATH = /^\/history\/\d{4}-\d{2}-\d{2}\/?$/;

type TabsShellProps = {
  children: ReactNode;
};

export function TabsShell({ children }: TabsShellProps) {
  const pathname = usePathname();
  const hideTab = HIDE_TAB_FOR_PATH.test(pathname);

  return (
    <>
      <div
        className={
          hideTab
            ? "mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-6 pt-6 sm:px-8"
            : "mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-20 pt-6 sm:px-8"
        }
      >
        {children}
      </div>
      {hideTab ? null : <BottomNav />}
    </>
  );
}
