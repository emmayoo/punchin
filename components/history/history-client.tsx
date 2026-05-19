"use client";

import { useEffect, useMemo, useState } from "react";

import { HistoryCalendarGrid } from "@/components/history/history-calendar-grid";
import { HistoryCalendarHeader } from "@/components/history/history-calendar-header";
import { HistoryMonthPickerModal } from "@/components/history/history-month-picker-modal";
import { DetailPageShell } from "@/components/layout/detail-page-shell";
import { workApi, type SchedulePersonRecord } from "@/lib/api/work-api";
import { mergeCalendarEventsWithBirthdays } from "@/lib/calendar/birthday-events";
import { formatKoYearMonthLong } from "@/lib/date-format";
import type { CalendarEvent, PunchRecord } from "@/types/work";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function monthLabel(date: Date): string {
  return formatKoYearMonthLong(date);
}

export function HistoryClient() {
  const [punches, setPunches] = useState<PunchRecord[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [schedulePeople, setSchedulePeople] = useState<SchedulePersonRecord[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await workApi.init();
      const [history, calendarEvents, people, dashboard] = await Promise.all([
        workApi.getHistory(),
        workApi.getCalendarEvents(),
        workApi.getSchedulePeople(),
        workApi.getDashboard(),
      ]);
      if (!mounted) {
        return;
      }
      setPunches(history);
      setEvents(calendarEvents);
      setSchedulePeople(people);
      setCurrentBranchId(dashboard.session?.currentBranchId ?? null);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const dayStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const dayEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const firstWeekday = dayStart.getDay();
  const totalDays = dayEnd.getDate();
  const calendarDays = Array.from({ length: firstWeekday + totalDays }, (_, i) =>
    i < firstWeekday
      ? null
      : new Date(monthDate.getFullYear(), monthDate.getMonth(), i - firstWeekday + 1),
  );

  const nameMap = punches.reduce<Record<string, string[]>>((acc, record) => {
    const key = toDateKey(new Date(record.checkedInAt));
    const current = acc[key] ?? [];
    if (!current.includes(record.employeeName)) {
      current.push(record.employeeName);
    }
    acc[key] = current;
    return acc;
  }, {});

  const mergedEvents = useMemo(
    () =>
      mergeCalendarEventsWithBirthdays(
        events,
        schedulePeople,
        monthDate.getFullYear(),
        currentBranchId,
      ),
    [events, schedulePeople, monthDate, currentBranchId],
  );

  const eventMap = mergedEvents.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const current = acc[event.date] ?? [];
    current.push(event);
    acc[event.date] = current;
    return acc;
  }, {});
  const today = new Date();
  const todayKey = toDateKey(today);

  return (
    <DetailPageShell backHref="/workplace" title="캘린더" loading={loading}>
      {() => (
        <>
          <section className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
            <HistoryCalendarHeader
              monthLabel={monthLabel(monthDate)}
              onPrev={() =>
                setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
              }
              onNext={() =>
                setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
              }
              onToday={() =>
                setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1))
              }
              onOpenPicker={() => {
                setPickerYear(monthDate.getFullYear());
                setPickerMonth(monthDate.getMonth() + 1);
                setPickerOpen(true);
              }}
            />
            <HistoryCalendarGrid
              calendarDays={calendarDays}
              toDateKey={toDateKey}
              nameMap={nameMap}
              eventMap={eventMap}
              todayKey={todayKey}
            />
          </section>
          <HistoryMonthPickerModal
            open={pickerOpen}
            selectedYear={pickerYear}
            selectedMonth={pickerMonth}
            onChangeYear={setPickerYear}
            onChangeMonth={setPickerMonth}
            onClose={() => setPickerOpen(false)}
            onConfirm={() => {
              setMonthDate(new Date(pickerYear, pickerMonth - 1, 1));
              setPickerOpen(false);
            }}
          />
        </>
      )}
    </DetailPageShell>
  );
}
