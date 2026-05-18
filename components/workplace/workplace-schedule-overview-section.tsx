"use client";

import { useMemo, useRef } from "react";

import { ScheduleDownloadButton } from "@/components/schedule/schedule-download-button";
import type { SchedulePerson, WeekDayItem } from "@/components/schedule/schedule-types";
import {
  addDays,
  dateKey,
  startOfWeek,
  WEEKDAY_LABELS,
} from "@/components/schedule/schedule-utils";
import { ScheduleWeekGrid } from "@/components/schedule/schedule-week-grid";
import { useScheduleImageDownload } from "@/components/schedule/use-schedule-image-download";
import { WorkplaceSectionCard } from "@/components/workplace/workplace-section-card";
import { WorkplaceSectionLink } from "@/components/workplace/workplace-section-link";
import { DEFAULT_MEMBER_COLOR } from "@/lib/constants/color";
import { normalizePhone } from "@/lib/phone";
import type { Shift } from "@/types/work";

type WorkplaceScheduleOverviewSectionProps = {
  shifts: Shift[];
  /** 현재 매장 활성 멤버십 기준 직원 전화번호 → 표시색(hex) */
  memberColorByPhone?: ReadonlyMap<string, string>;
  /** 매니저 이상만 스케줄 상세 링크 표시 */
  canManageSchedule?: boolean;
};

export function WorkplaceScheduleOverviewSection({
  shifts,
  memberColorByPhone,
  canManageSchedule = false,
}: WorkplaceScheduleOverviewSectionProps) {
  const scheduleGridRef = useRef<HTMLDivElement>(null);
  const weekStart = startOfWeek(new Date());
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const { exportingImage, downloadScheduleImage } = useScheduleImageDownload({
    targetRef: scheduleGridRef,
    fileName: `스케줄_${dateKey(weekStart)}.png`,
  });

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
    const map = new Map<string, SchedulePerson>();
    weekShifts.forEach((shift) => {
      const rawPhone = shift.employeePhone;
      if (map.has(rawPhone)) {
        return;
      }
      let color = DEFAULT_MEMBER_COLOR;
      if (memberColorByPhone !== undefined) {
        const key = normalizePhone(rawPhone);
        if (memberColorByPhone.has(key)) {
          const hex = memberColorByPhone.get(key)?.trim();
          color = hex && hex.length > 0 ? hex : DEFAULT_MEMBER_COLOR;
        } else {
          color = "#a3a3a3";
        }
      }
      map.set(rawPhone, {
        id: shift.employeeId || rawPhone,
        name: shift.employeeName,
        nickname: null,
        employeePhone: rawPhone,
        color,
      });
    });
    return map;
  }, [weekShifts, memberColorByPhone]);

  return (
    <WorkplaceSectionCard
      title="이번주 스케줄"
      action={
        <div className="flex items-center gap-2">
          <ScheduleDownloadButton
            onClick={downloadScheduleImage}
            busy={exportingImage}
            ariaLabel={`${dateKey(weekStart)} 주간 스케줄 다운로드`}
          />
          {canManageSchedule ? (
            <WorkplaceSectionLink href="/workplace/schedule" label="스케줄 상세" />
          ) : null}
        </div>
      }
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
        <p className="text-sm text-zinc-600 dark:text-neutral-400">이번주 스케줄이 없습니다.</p>
      )}
    </WorkplaceSectionCard>
  );
}
