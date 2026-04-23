"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "홈" },
  { href: "/history", label: "이력" },
  { href: "/schedule", label: "스케줄" },
  { href: "/stats", label: "통계" },
  { href: "/mypage", label: "설정" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-(--app-border) bg-(--app-backdrop) backdrop-blur-sm supports-backdrop-filter:bg-(--app-nav)">
      <ul className="mx-auto grid w-full max-w-3xl grid-cols-5 px-3 py-3">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center justify-center rounded-xl px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-neutral-950"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
