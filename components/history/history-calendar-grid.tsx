"use client";

import Link from "next/link";
import type { CalendarEvent } from "@/types/work";
import { WEEKDAY_LABELS } from "@/lib/constants/calendar";

type HistoryCalendarGridProps = {
  calendarDays: (Date | null)[];
  toDateKey: (date: Date) => string;
  nameMap: Record<string, string[]>;
  eventMap: Record<string, CalendarEvent[]>;
  todayKey: string;
};

export function HistoryCalendarGrid({
  calendarDays,
  toDateKey,
  nameMap,
  eventMap,
  todayKey,
}: HistoryCalendarGridProps) {
  return (
    <>
      <div className="mb-2 grid grid-cols-7 gap-2 text-[11px] text-zinc-500 dark:text-neutral-500">
        {WEEKDAY_LABELS.map((day) => (
          <p key={day} className="text-center">
            {day}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {calendarDays.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-20 bg-white/0" />;
          }
          const dateKey = toDateKey(date);
          const names = nameMap[dateKey] ?? [];
          const dayEvents = eventMap[dateKey] ?? [];
          return (
            <Link
              key={dateKey}
              href={`/workplace/history/${dateKey}`}
              className={`h-20 border bg-zinc-100/80 p-1 transition-colors hover:border-zinc-400 dark:bg-neutral-900/50 dark:hover:border-white/30 ${
                dateKey === todayKey
                  ? "border-rose-500 dark:border-rose-400"
                  : "border-zinc-200/90 dark:border-white/10"
              }`}
            >
              <p className="text-xs font-medium text-zinc-900 dark:text-white">
                {date.getDate()}
              </p>
              {dayEvents.length > 0 ? (
                <p
                  className="mt-1 truncate text-[11px]"
                  style={{ color: dayEvents[0].color }}
                >
                  {dayEvents[0].title}
                </p>
              ) : null}
              {names.length > 0 ? (
                <p className="mt-1 truncate text-[11px] text-zinc-600 dark:text-neutral-300">
                  {`${names.length} 명`}
                </p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </>
  );
}
