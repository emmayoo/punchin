"use client";

import { useMemo } from "react";

import type { SchedulePersonRecord } from "@/lib/api/work-api";
import { calendarEventsOnDate, partitionCalendarEvents } from "@/lib/calendar/events";
import type { CalendarEvent } from "@/types/work";

export function useDayCalendarEvents(
  manualEvents: CalendarEvent[],
  branchPeople: SchedulePersonRecord[],
  dateKey: string,
  branchId: string | null,
) {
  const dayEvents = useMemo(
    () => calendarEventsOnDate(manualEvents, branchPeople, dateKey, branchId),
    [manualEvents, branchPeople, dateKey, branchId],
  );

  return useMemo(() => partitionCalendarEvents(dayEvents), [dayEvents]);
}
