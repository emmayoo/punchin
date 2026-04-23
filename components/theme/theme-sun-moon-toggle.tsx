"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { startTransition, useEffect, useState } from "react";

/**
 * `resolvedTheme` 기준으로 라이트(해)·다크(달)를 고릅니다.
 * localStorage(`punchin-theme`)에 값이 있으면 그대로, 없으면 `ThemeProvider`의 system 동작을 따릅니다.
 */
export function ThemeSunMoonToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setMounted(true);
    });
  }, []);

  if (!mounted) {
    return (
      <div
        className="h-10 w-28 animate-pulse rounded-full bg-zinc-200/80 dark:bg-white/10"
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === "dark";
  const usingSystem = theme === "system";

  return (
    <div
      className="inline-flex flex-col gap-1"
      role="group"
      aria-label="화면 테마: 라이트 또는 다크"
    >
      <div className="inline-flex h-10 items-center rounded-full border border-zinc-300/90 bg-zinc-100/80 p-1 dark:border-white/20 dark:bg-zinc-900/80">
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={`flex h-8 min-w-14 flex-1 items-center justify-center gap-1 rounded-full text-xs font-medium transition-colors ${
            !isDark
              ? "bg-amber-100 text-amber-950 shadow-sm dark:bg-amber-200/90"
              : "text-zinc-500 opacity-80 hover:opacity-100 dark:text-neutral-400"
          }`}
          aria-pressed={!isDark}
        >
          <Sun className="h-4 w-4" strokeWidth={2} aria-hidden />
          <span className="sr-only">라이트</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={`flex h-8 min-w-14 flex-1 items-center justify-center gap-1 rounded-full text-xs font-medium transition-colors ${
            isDark
              ? "bg-slate-700 text-slate-50 shadow-sm dark:bg-slate-600"
              : "text-zinc-500 opacity-80 hover:opacity-100 dark:text-neutral-400"
          }`}
          aria-pressed={isDark}
        >
          <Moon className="h-4 w-4" strokeWidth={2} aria-hidden />
          <span className="sr-only">다크</span>
        </button>
      </div>
      {usingSystem ? (
        <p className="text-[11px] text-zinc-500 dark:text-neutral-500">
          OS(시스템) 설정을 따르는 중입니다. 위에서 선택하면 기기에 저장됩니다.
        </p>
      ) : null}
    </div>
  );
}
