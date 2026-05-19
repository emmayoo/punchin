"use client";

import { DEFAULT_EVENT_COLOR } from "@/lib/constants/event";
import type { CalendarEvent } from "@/types/work";

type HistoryDayEventsPanelProps = {
  birthdays: CalendarEvent[];
  manualEvents: CalendarEvent[];
  busy: boolean;
  onCreate: () => void;
  onDelete: (eventId: string) => void;
  onTitleChange: (eventId: string, value: string) => void;
  onColorChange: (eventId: string, color: string) => void;
};

export function HistoryDayEventsPanel({
  birthdays,
  manualEvents,
  busy,
  onCreate,
  onDelete,
  onTitleChange,
  onColorChange,
}: HistoryDayEventsPanelProps) {
  const empty = birthdays.length === 0 && manualEvents.length === 0;

  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-white">이벤트</h2>
        <button
          type="button"
          onClick={onCreate}
          disabled={busy}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300/90 text-lg text-zinc-800 disabled:opacity-60 dark:border-white/20 dark:text-neutral-100"
          aria-label="이벤트 추가"
        >
          +
        </button>
      </div>

      {birthdays.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {birthdays.map((event) => (
            <li
              key={event.id}
              className="flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-white/80 px-2.5 py-2 text-sm dark:border-white/10 dark:bg-neutral-900/60"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/5 dark:border-white/10"
                style={{ backgroundColor: event.color }}
                aria-hidden
              />
              <span className="font-medium text-zinc-800 dark:text-neutral-100">{event.title}</span>
              <span className="ml-auto text-[11px] text-zinc-500 dark:text-neutral-500">생일</span>
            </li>
          ))}
        </ul>
      ) : null}

      {empty ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-neutral-400">등록된 이벤트가 없습니다.</p>
      ) : manualEvents.length > 0 ? (
        <ul className={birthdays.length > 0 ? "mt-3 space-y-2" : "mt-2 space-y-2"}>
          {manualEvents.map((event) => (
            <li key={event.id}>
              <div className="flex items-center gap-2">
                <input
                  defaultValue={event.title}
                  onChange={(item) => onTitleChange(event.id, item.target.value)}
                  className="flex-1 rounded-lg border border-zinc-200/90 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:focus:border-white/35"
                  style={{ color: event.color }}
                />
                <input
                  type="color"
                  defaultValue={event.color || DEFAULT_EVENT_COLOR}
                  onChange={(item) => onColorChange(event.id, item.target.value)}
                  className="h-8 w-10 rounded border border-zinc-200/90 bg-white p-1 dark:border-white/10 dark:bg-neutral-900"
                  aria-label="이벤트 색상"
                />
                <button
                  type="button"
                  onClick={() => onDelete(event.id)}
                  disabled={busy}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300/30 text-sm text-rose-200 disabled:opacity-60"
                  aria-label="이벤트 삭제"
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
