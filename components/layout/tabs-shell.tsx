"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { BottomNav } from "@/components/layout/bottom-nav";
import { ProfileNameGate } from "@/components/layout/profile-name-gate";
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
  const [guardChecked, setGuardChecked] = useState(false);
  const [allowRender, setAllowRender] = useState(false);

  useEffect(() => {
    let mounted = true;
    setAllowRender(false);
    setGuardChecked(false);
    (async () => {
      const dashboard = await workApi.getDashboard();
      if (!mounted) {
        return;
      }
      if (!dashboard.session) {
        router.replace("/auth");
        return;
      }
      const currentBranchId = dashboard.session.currentBranchId ?? null;
      const hasMappedBranches = dashboard.myBranches.length > 0;
      const hasValidCurrentBranch =
        !!currentBranchId && dashboard.myBranches.some((branch) => branch.id === currentBranchId);
      if (!hasMappedBranches || !hasValidCurrentBranch) {
        router.replace("/branch");
        return;
      }
      setAllowRender(true);
      setGuardChecked(true);
    })();
    return () => {
      mounted = false;
    };
  }, [router, pathname]);

  if (!guardChecked || !allowRender) {
    return null;
  }

  return (
    <>
      <ProfileNameGate />
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
