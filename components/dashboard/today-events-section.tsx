"use client";

import { BellRing } from "lucide-react";

import type { Branch, CalendarEvent } from "@/types/work";

type TodayEventsSectionProps = {
  events: CalendarEvent[];
  branches: Branch[];
};

export function TodayEventsSection({ events, branches }: TodayEventsSectionProps) {
  if (events.length === 0) {
    return null;
  }
  const branchNameById = new Map(branches.map((branch) => [branch.id, branch.name] as const));
  return (
    <section className="rounded-2xl border border-amber-400/40 bg-amber-100/50 p-4 dark:border-amber-300/30 dark:bg-amber-200/10">
      <div className="flex items-center gap-2">
        <BellRing className="h-4 w-4 text-amber-600 dark:text-amber-200" aria-hidden />
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          오늘 이벤트 ({events.length}건)
        </p>
      </div>
      <ul className="mt-2 space-y-1">
        {events.map((event) => {
          const branchName = event.branchId
            ? (branchNameById.get(event.branchId) ?? "지점 미지정")
            : "전체 지점";
          return (
            <li key={event.id} className="text-sm text-amber-900/90 dark:text-amber-50/95">
              <span
                className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                style={{ backgroundColor: event.color }}
                aria-hidden
              />
              <span className="align-middle">{event.title}</span>
              <span className="ml-2 text-xs text-amber-800/70 dark:text-amber-100/70">
                · {branchName}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
