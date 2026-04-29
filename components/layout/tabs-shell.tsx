"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { BottomNav } from "@/components/layout/bottom-nav";
import { workApi } from "@/lib/api/work-api";

/** `/workplace/history/YYYY-MM-DD` 상세에서 하단 탭 숨김 */
const HIDE_TAB_FOR_PATH = /^\/(?:workplace\/history|history)\/\d{4}-\d{2}-\d{2}\/?$/;

type TabsShellProps = {
  children: ReactNode;
};

export function TabsShell({ children }: TabsShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hideTab = HIDE_TAB_FOR_PATH.test(pathname);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const dashboard = await workApi.getDashboard();
      if (!mounted || !dashboard.session) {
        return;
      }
      if (!dashboard.session.currentBranchId) {
        router.replace("/branch");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

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
