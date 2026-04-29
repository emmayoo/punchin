"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { workApi } from "@/lib/api/work-api";

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
      // 네트워크/세션 만료 등으로 실패해도 하단 네비는 기본 상태로 둔다.
      setWorkplaceLabel("지점");
    }
  }, []);

  const requestLoadCurrentBranch = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      void loadCurrentBranch();
    }, 120);
  }, [loadCurrentBranch]);

  useEffect(() => {
    (async () => {
      await loadCurrentBranch();
    })();
    window.addEventListener("workplace:changed", requestLoadCurrentBranch);
    return () => {
      window.removeEventListener("workplace:changed", requestLoadCurrentBranch);
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [loadCurrentBranch, requestLoadCurrentBranch]);

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-(--app-border) bg-(--app-backdrop) backdrop-blur-sm supports-backdrop-filter:bg-(--app-nav)">
      <ul className="mx-auto grid w-full max-w-3xl grid-cols-3 px-3 py-3">
        <li key="/">
          <Link
            href="/"
            className={`flex items-center justify-center rounded-xl px-3 py-2 text-sm transition-colors ${
              pathname === "/"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-neutral-950"
                : "text-zinc-600 hover:text-zinc-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            홈
          </Link>
        </li>
        <li key="/workplace">
          <Link
            href="/workplace"
            className={`flex w-full items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm transition-colors ${
              pathname === "/workplace" || pathname.startsWith("/workplace/")
                ? "bg-zinc-900 text-white dark:bg-white dark:text-neutral-950"
                : "text-zinc-600 hover:text-zinc-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
            aria-label="현재 선택 지점"
          >
            <span className="truncate">{workplaceLabel}</span>
          </Link>
        </li>
        <li key="/mypage">
          <Link
            href="/mypage"
            className={`flex items-center justify-center rounded-xl px-3 py-2 text-sm transition-colors ${
              pathname === "/mypage" || pathname.startsWith("/mypage/")
                ? "bg-zinc-900 text-white dark:bg-white dark:text-neutral-950"
                : "text-zinc-600 hover:text-zinc-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            설정
          </Link>
        </li>
      </ul>
    </nav>
  );
}
