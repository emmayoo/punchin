"use client";

import { useState } from "react";

import { HistoryCalendarGrid } from "@/components/history/history-calendar-grid";
import { HistoryCalendarHeader } from "@/components/history/history-calendar-header";
import { HistoryMonthPickerModal } from "@/components/history/history-month-picker-modal";
import { useCalendarPageData } from "@/components/history/use-calendar-page-data";
import { DetailPageShell } from "@/components/layout/detail-page-shell";
import { formatKoYearMonthLong } from "@/lib/date-format";
import { toDateKey } from "@/lib/time";

export function HistoryClient() {
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth() + 1);

  const { loading, eventMap, nameMap } = useCalendarPageData(monthDate.getFullYear());

  const dayStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const dayEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const firstWeekday = dayStart.getDay();
  const totalDays = dayEnd.getDate();
  const calendarDays = Array.from({ length: firstWeekday + totalDays }, (_, i) =>
    i < firstWeekday
      ? null
      : new Date(monthDate.getFullYear(), monthDate.getMonth(), i - firstWeekday + 1),
  );

  const today = new Date();
  const todayKey = toDateKey(today);

  return (
    <DetailPageShell backHref="/workplace" title="캘린더" loading={loading}>
      {() => (
        <>
          <section className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
            <HistoryCalendarHeader
              monthLabel={formatKoYearMonthLong(monthDate)}
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
