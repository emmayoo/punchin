"use client";

import { Home, Settings, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { workApi } from "@/lib/api/work-api";
import { onWorkplaceChanged } from "@/lib/constants/dom-event";

type TabItem = {
  href: string;
  label: string;
  icon: typeof Home;
  match: (pathname: string) => boolean;
};

const TABS: TabItem[] = [
  {
    href: "/",
    label: "홈",
    icon: Home,
    match: (pathname) => pathname === "/",
  },
  {
    href: "/workplace",
    label: "지점",
    icon: Store,
    match: (pathname) => pathname === "/workplace" || pathname.startsWith("/workplace/"),
  },
  {
    href: "/mypage",
    label: "설정",
    icon: Settings,
    match: (pathname) => pathname === "/mypage" || pathname.startsWith("/mypage/"),
  },
];

function tabLinkClass(active: boolean): string {
  return [
    "flex min-h-[52px] w-full flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 transition-colors touch-manipulation",
    active
      ? "text-zinc-900 dark:text-white"
      : "text-zinc-500 hover:text-zinc-800 dark:text-neutral-500 dark:hover:text-neutral-200",
  ].join(" ");
}

export function BottomNav() {
  const pathname = usePathname();
  const [workplaceLabel, setWorkplaceLabel] = useState("지점");
  const debounceTimerRef = useRef<number | null>(null);

  const loadCurrentBranch = useCallback(async () => {
    try {
      const dashboard = await workApi.getDashboard();
      const currentBranchId = dashboard.session?.currentBranchId ?? null;
      const currentBranch = currentBranchId
        ? dashboard.branches.find((branch) => branch.id === currentBranchId)
        : undefined;
      setWorkplaceLabel(currentBranch?.name ?? "지점");
    } catch {
      setWorkplaceLabel("지점");
    }
  }, []);

  const requestLoadCurrentBranch = useCallback(
    (options?: { immediate?: boolean }) => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      const delay = options?.immediate ? 0 : 120;
      debounceTimerRef.current = window.setTimeout(() => {
        void loadCurrentBranch();
      }, delay);
    },
    [loadCurrentBranch],
  );

  useEffect(() => {
    requestLoadCurrentBranch({ immediate: true });
    const off = onWorkplaceChanged(() => requestLoadCurrentBranch());
    return () => {
      off();
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [requestLoadCurrentBranch]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-(--app-border) bg-(--app-backdrop) backdrop-blur-sm supports-backdrop-filter:bg-(--app-nav)"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="주요 메뉴"
    >
      <ul className="mx-auto grid w-full max-w-3xl grid-cols-3 px-2 pt-1.5 pb-1">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          const isWorkplace = tab.href === "/workplace";
          const label = isWorkplace ? workplaceLabel : tab.label;

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={tabLinkClass(active)}
                aria-label={isWorkplace ? `지점: ${workplaceLabel}` : tab.label}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                <span
                  className={`max-w-26 truncate text-center leading-tight ${
                    isWorkplace ? "text-[10px] font-medium" : "text-[11px] font-medium"
                  } ${active ? "font-semibold" : ""}`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** TabsShell 본문 하단 여백 — nav 높이 + iPhone safe area */
export const BOTTOM_NAV_CLEARANCE = "calc(3.75rem + env(safe-area-inset-bottom, 0px))";
