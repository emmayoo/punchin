"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type HistoryCalendarHeaderProps = {
  monthLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenPicker: () => void;
};

export function HistoryCalendarHeader({
  monthLabel,
  onPrev,
  onNext,
  onToday,
  onOpenPicker,
}: HistoryCalendarHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="min-w-[83px]">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300/90 px-2 py-1 text-zinc-700 dark:border-white/20 dark:text-neutral-200"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div>
        <button onClick={onOpenPicker} className="text-md text-zinc-900 dark:text-white">
          {monthLabel}
        </button>
      </div>
      <div className="flex items-center gap-2 min-w-[83px]">
        <button
          onClick={onToday}
          className="rounded-lg border border-rose-300/50 px-2 py-1 text-xs text-rose-200"
        >
          오늘
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300/90 px-2 py-1 text-zinc-700 dark:border-white/20 dark:text-neutral-200"
          aria-label="다음 달"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
