"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { BOTTOM_NAV_CLEARANCE, BottomNav } from "@/components/layout/bottom-nav";
import { ProfileNameGate } from "@/components/layout/profile-name-gate";
import { workApi } from "@/lib/api/work-api";

/** 상세 화면에서는 하단 탭 숨김 */
const HIDE_TAB_FOR_PATH =
  /^\/(?:(?:workplace\/stats)(?:\/.*)?|(?:workplace\/history)(?:\/\d{4}-\d{2}-\d{2})?|(?:workplace\/settings)(?:\/.*)?|(?:workplace\/schedule)(?:\/.*)?|(?:schedule)(?:\/.*)?|(?:history)(?:\/\d{4}-\d{2}-\d{2})?)\/?$/;

type TabsShellProps = {
  children: ReactNode;
};

export function TabsShell({ children }: TabsShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hideTab = HIDE_TAB_FOR_PATH.test(pathname);
  const [guardedPath, setGuardedPath] = useState<string | null>(null);
  const [allowRender, setAllowRender] = useState(false);

  useEffect(() => {
    let mounted = true;
    const pathAtEffect = pathname;
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
      if (pathname !== pathAtEffect) {
        return;
      }
      setGuardedPath(pathAtEffect);
      setAllowRender(true);
    })();
    return () => {
      mounted = false;
    };
  }, [router, pathname]);

  const showContent = allowRender && guardedPath === pathname;

  return (
    <>
      {showContent ? <ProfileNameGate /> : null}
      <div
        className={
          hideTab
            ? "mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-6 pt-6 sm:px-8"
            : "mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-6 sm:px-8"
        }
        style={hideTab ? undefined : { paddingBottom: BOTTOM_NAV_CLEARANCE }}
      >
        {showContent ? children : null}
      </div>
      {hideTab ? null : <BottomNav />}
    </>
  );
}
