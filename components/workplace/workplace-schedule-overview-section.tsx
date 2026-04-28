"use client";

import { useMemo, useRef } from "react";
import { ScheduleWeekGrid } from "@/components/schedule/schedule-week-grid";
import type { SchedulePerson, WeekDayItem } from "@/components/schedule/schedule-types";
import { addDays, dateKey, startOfWeek, WEEKDAY_LABELS } from "@/components/schedule/schedule-utils";
import type { Shift } from "@/types/work";
import { WorkplaceSectionCard } from "@/components/workplace/workplace-section-card";
import { WorkplaceSectionLink } from "@/components/workplace/workplace-section-link";

type WorkplaceScheduleOverviewSectionProps = {
  shifts: Shift[];
};

export function WorkplaceScheduleOverviewSection({
  shifts,
}: WorkplaceScheduleOverviewSectionProps) {
  const scheduleGridRef = useRef<HTMLDivElement>(null);
  const weekStart = startOfWeek(new Date());
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);

  const weekShifts = shifts
    .filter((shift) => {
      const startMs = new Date(shift.startAt).getTime();
      return startMs >= weekStart.getTime() && startMs < nextWeekStart.getTime();
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const weekDays = useMemo<WeekDayItem[]>(
    () =>
      WEEKDAY_LABELS.map((label, idx) => ({
        label,
        date: addDays(weekStart, idx),
      })),
    [weekStart],
  );

  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of weekShifts) {
      const key = dateKey(new Date(shift.startAt));
      const current = map.get(key) ?? [];
      current.push(shift);
      map.set(key, current);
    }
    return map;
  }, [weekShifts]);

  const peopleByPhone = useMemo(() => {
    const palette = ["#22c55e", "#38bdf8", "#f59e0b", "#a78bfa", "#fb7185"];
    const map = new Map<string, SchedulePerson>();
    weekShifts.forEach((shift, index) => {
      if (!map.has(shift.employeePhone)) {
        map.set(shift.employeePhone, {
          id: shift.employeePhone,
          name: shift.employeeName,
          employeePhone: shift.employeePhone,
          color: palette[index % palette.length],
        });
      }
    });
    return map;
  }, [weekShifts]);

  return (
    <WorkplaceSectionCard
      title="이번주 스케줄"
      action={<WorkplaceSectionLink href="/workplace/schedule" label="스케줄 상세" />}
    >
      {weekShifts.length > 0 ? (
        <ScheduleWeekGrid
          weekDays={weekDays}
          shiftMap={shiftMap}
          peopleByPhone={peopleByPhone}
          scheduleGridRef={scheduleGridRef}
          onShiftClick={() => {}}
        />
      ) : (
        <p className="text-sm text-zinc-600 dark:text-neutral-400">
          이번주 스케줄이 없습니다.
        </p>
      )}
    </WorkplaceSectionCard>
  );
}
