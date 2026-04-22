"use client";

import { DetailPageShell } from "@/components/layout/detail-page-shell";
import { useEffect, useMemo, useRef, useState } from "react";
import { workApi } from "@/lib/api/work-api";
import { CalendarEvent, PunchRecord } from "@/types/work";
import { durationHours, formatDateTime, formatHours } from "@/lib/time";
import { DEFAULT_EVENT_COLOR } from "@/lib/constants/event";

type HistoryDayDetailClientProps = {
  date: string;
};

function isSameDate(dateKey: string, iso: string): boolean {
  const d = new Date(iso);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  return key === dateKey;
}

export function HistoryDayDetailClient({ date }: HistoryDayDetailClientProps) {
  const [punches, setPunches] = useState<PunchRecord[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const saveTimersRef = useRef<Record<string, number>>({});
  const [newColor, setNewColor] = useState(DEFAULT_EVENT_COLOR);

  const load = async () => {
    const [history, calendarEvents] = await Promise.all([
      workApi.getHistory(),
      workApi.getCalendarEvents(),
    ]);
    setPunches(history);
    setEvents(calendarEvents);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await workApi.init();
      const [history, calendarEvents] = await Promise.all([
        workApi.getHistory(),
        workApi.getCalendarEvents(),
      ]);
      if (!mounted) {
        return;
      }
      setPunches(history);
      setEvents(calendarEvents);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [date]);

  const dayPunches = useMemo(
    () => punches.filter((record) => isSameDate(date, record.checkedInAt)),
    [punches, date],
  );
  const dayEvents = useMemo(
    () => events.filter((event) => event.date === date),
    [events, date],
  );

  const handleCreate = async () => {
    setBusy(true);
    await workApi.createCalendarEvent({
      date,
      title: "새 이벤트",
      color: newColor,
    });
    setNewColor(DEFAULT_EVENT_COLOR);
    await load();
    setBusy(false);
  };

  const handleDelete = async (eventId: string) => {
    setBusy(true);
    await workApi.deleteCalendarEvent(eventId);
    const timerId = saveTimersRef.current[eventId];
    if (timerId) {
      window.clearTimeout(timerId);
      delete saveTimersRef.current[eventId];
    }
    await load();
    setBusy(false);
  };

  const scheduleEventSave = (
    eventId: string,
    payload: Partial<Pick<CalendarEvent, "title" | "color">>,
  ) => {
    const prevTimer = saveTimersRef.current[eventId];
    if (prevTimer) {
      window.clearTimeout(prevTimer);
    }
    saveTimersRef.current[eventId] = window.setTimeout(() => {
      void workApi.updateCalendarEvent(eventId, payload).then(() => {
        void load();
      });
      delete saveTimersRef.current[eventId];
    }, 450);
  };

  const handleTitleChange = (eventId: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    scheduleEventSave(eventId, { title: trimmed });
  };

  const handleColorChange = (eventId: string, color: string) => {
    scheduleEventSave(eventId, { color });
  };

  return (
    <DetailPageShell
      backHref="/history"
      title={`${date} 근무 상세`}
      aria-label={`${date} 일자 상세`}
      loading={loading}
    >
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">이벤트</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={busy}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-lg text-neutral-100 disabled:opacity-60"
              aria-label="이벤트 추가"
            >
              +
            </button>
          </div>
        </div>
        {dayEvents.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">
            등록된 이벤트가 없습니다.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {dayEvents.map((event) => (
              <li key={event.id}>
                <div className="flex items-center gap-2">
                  <input
                    defaultValue={event.title}
                    onChange={(item) =>
                      handleTitleChange(event.id, item.target.value)
                    }
                    className="flex-1 rounded-lg border border-white/10 bg-neutral-900 px-2 py-1 text-sm outline-none focus:border-white/35"
                    style={{ color: event.color }}
                  />
                  <input
                    type="color"
                    defaultValue={event.color || DEFAULT_EVENT_COLOR}
                    onChange={(item) =>
                      handleColorChange(event.id, item.target.value)
                    }
                    className="h-8 w-10 rounded border border-white/10 bg-neutral-900 p-1"
                    aria-label="이벤트 색상"
                  />
                  <button
                    onClick={() => void handleDelete(event.id)}
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
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-white">근무 기록</h2>
        {dayPunches.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-400">
            근무 기록이 없습니다.
          </p>
        ) : (
          dayPunches.map((record) => (
            <article
              key={record.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <p className="text-sm font-medium text-white">
                {record.employeeName}
              </p>
              <p className="mt-2 text-sm text-neutral-300">
                출근: {formatDateTime(record.checkedInAt)}
              </p>
              <p className="text-sm text-neutral-300">
                퇴근:{" "}
                {record.checkedOutAt
                  ? formatDateTime(record.checkedOutAt)
                  : "근무 중"}
              </p>
              {record.checkedOutAt ? (
                <p className="mt-2 text-xs text-neutral-400">
                  근무시간:{" "}
                  {formatHours(
                    durationHours(record.checkedInAt, record.checkedOutAt),
                  )}
                </p>
              ) : null}
            </article>
          ))
        )}
      </section>
    </DetailPageShell>
  );
}
