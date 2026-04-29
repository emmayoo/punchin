import { RefObject } from "react";

import { SchedulePerson, ShiftMap, WeekDayItem } from "@/components/schedule/schedule-types";
import {
  ceilToHour,
  dateKey,
  DAY_COLUMN_HEIGHT,
  DISPLAY_HOURS,
  floorToHour,
  HOUR_ROW_HEIGHT,
  minuteOffsetInDay,
  MINUTES_PER_DAY,
} from "@/components/schedule/schedule-utils";
import type { Shift } from "@/types/work";

type ScheduleWeekGridProps = {
  weekDays: WeekDayItem[];
  shiftMap: ShiftMap;
  peopleByPhone: Map<string, SchedulePerson>;
  scheduleGridRef: RefObject<HTMLDivElement | null>;
  onShiftClick: (shift: Shift) => void;
};

type PositionedShift = {
  shift: Shift;
  startMin: number;
  endMin: number;
};

type ShiftSegment = {
  shift: Shift;
  startMin: number;
  endMin: number;
  laneIndex: number;
  laneCount: number;
};

function buildShiftSegments(shifts: PositionedShift[]): ShiftSegment[] {
  if (shifts.length === 0) {
    return [];
  }

  const boundaries = Array.from(
    new Set(shifts.flatMap((item) => [item.startMin, item.endMin])),
  ).sort((a, b) => a - b);

  const segments: ShiftSegment[] = [];
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const segStart = boundaries[i];
    const segEnd = boundaries[i + 1];
    if (segEnd <= segStart) {
      continue;
    }

    const active = shifts
      .filter((item) => item.startMin < segEnd && item.endMin > segStart)
      .sort(
        (a, b) =>
          a.startMin - b.startMin || a.endMin - b.endMin || a.shift.id.localeCompare(b.shift.id),
      );
    if (active.length === 0) {
      continue;
    }

    active.forEach((item, laneIndex) => {
      const prev = segments[segments.length - 1];
      if (
        prev &&
        prev.shift.id === item.shift.id &&
        prev.laneIndex === laneIndex &&
        prev.laneCount === active.length &&
        prev.endMin === segStart
      ) {
        prev.endMin = segEnd;
      } else {
        segments.push({
          shift: item.shift,
          startMin: segStart,
          endMin: segEnd,
          laneIndex,
          laneCount: active.length,
        });
      }
    });
  }

  return segments;
}

export function ScheduleWeekGrid({
  weekDays,
  shiftMap,
  peopleByPhone,
  scheduleGridRef,
  onShiftClick,
}: ScheduleWeekGridProps) {
  const timeFmt = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <div className="overflow-x-auto border border-zinc-200/90 dark:border-white/10">
      <div className="relative min-w-[760px]">
        <div ref={scheduleGridRef}>
          <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-zinc-200/90 bg-zinc-100/80 dark:border-white/10 dark:bg-white/5">
            <div className="px-1.5 py-1.5 text-[11px] text-zinc-600 dark:text-neutral-300">
              시간
            </div>
            {weekDays.map((day) => (
              <div
                key={day.label}
                className="border-l border-zinc-200/90 px-1.5 py-1.5 text-[11px] text-zinc-800 dark:border-white/10 dark:text-neutral-200"
              >
                {day.label}
                <span className="ml-1 text-zinc-500 dark:text-neutral-500">
                  {new Intl.DateTimeFormat("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                  }).format(day.date)}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]">
            <div className="relative border-r border-zinc-200/90 dark:border-white/10">
              {DISPLAY_HOURS.map((hour) => (
                <div
                  key={`label-${hour}`}
                  className="absolute left-0 right-0 border-t border-zinc-200/80 px-1.5 text-[10px] text-zinc-500 dark:border-white/10 dark:text-neutral-500"
                  style={{ top: `${hour * HOUR_ROW_HEIGHT}px` }}
                >
                  {`${String(hour).padStart(2, "0")}:00`}
                </div>
              ))}
            </div>

            {weekDays.map((day) => {
              const dayKey = dateKey(day.date);
              const dayEntries = (shiftMap.get(dayKey) ?? []).sort(
                (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
              );
              const positionedEntries: PositionedShift[] = dayEntries.map((shift) => {
                const start = new Date(shift.startAt);
                const end = new Date(shift.endAt);
                const startMin = Math.max(0, floorToHour(minuteOffsetInDay(start)));
                const endMin = Math.min(MINUTES_PER_DAY, ceilToHour(minuteOffsetInDay(end)));
                return {
                  shift,
                  startMin,
                  endMin: Math.max(endMin, startMin + 60),
                };
              });
              const segments = buildShiftSegments(positionedEntries);
              return (
                <div
                  key={dayKey}
                  className="relative border-l border-zinc-200/90 dark:border-white/10"
                  style={{ height: `${DAY_COLUMN_HEIGHT}px` }}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div
                      key={`${dayKey}-line-${hour}`}
                      className="absolute left-0 right-0 border-t border-zinc-200/80 dark:border-white/10"
                      style={{ top: `${hour * HOUR_ROW_HEIGHT}px` }}
                    />
                  ))}

                  {segments.map((segment) => {
                    const start = new Date(segment.shift.startAt);
                    const end = new Date(segment.shift.endAt);
                    const timeLabel = `${timeFmt.format(start)}-${timeFmt.format(end)}`;
                    const top = (segment.startMin / MINUTES_PER_DAY) * DAY_COLUMN_HEIGHT;
                    const rawHeight =
                      ((segment.endMin - segment.startMin) / MINUTES_PER_DAY) * DAY_COLUMN_HEIGHT;
                    const height = Math.max(18, rawHeight);
                    const person = peopleByPhone.get(segment.shift.employeePhone);
                    const laneWidth = 100 / segment.laneCount;
                    const leftPct = laneWidth * segment.laneIndex;
                    return (
                      <div
                        key={`${segment.shift.id}-${segment.startMin}-${segment.endMin}-${segment.laneIndex}`}
                        className="absolute cursor-pointer rounded-md border px-1 py-1 text-[10px] font-medium leading-tight hover:ring-1 hover:ring-zinc-400/50 dark:hover:ring-white/40"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${laneWidth}% - 4px)`,
                          borderColor: `${person?.color ?? "#a3a3a3"}88`,
                          backgroundColor: `${person?.color ?? "#a3a3a3"}33`,
                        }}
                        onClick={() => onShiftClick(segment.shift)}
                        title={`${segment.shift.employeeName} ${timeLabel}`}
                      >
                        <div>{segment.shift.employeeName}</div>
                        <div className="text-[11px] text-zinc-800/90 dark:text-neutral-200/90">
                          {timeLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
