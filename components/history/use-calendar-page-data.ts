"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { workApi, type SchedulePersonRecord } from "@/lib/api/work-api";
import {
  groupCalendarEventsByDate,
  mergeCalendarEventsWithBirthdays,
} from "@/lib/calendar/events";
import { toDateKey } from "@/lib/time";
import type { CalendarEvent, PunchRecord } from "@/types/work";

export function useCalendarPageData(viewYear: number) {
  const [punches, setPunches] = useState<PunchRecord[]>([]);
  const [manualEvents, setManualEvents] = useState<CalendarEvent[]>([]);
  const [branchPeople, setBranchPeople] = useState<SchedulePersonRecord[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [history, calendarEvents, people, dashboard] = await Promise.all([
      workApi.getHistory(),
      workApi.getCalendarEvents(),
      workApi.getSchedulePeople(),
      workApi.getDashboard(),
    ]);
    setPunches(history);
    setManualEvents(calendarEvents);
    setBranchPeople(people);
    setCurrentBranchId(dashboard.session?.currentBranchId ?? null);
    return { history, calendarEvents, people, dashboard };
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      await reload();
      if (mounted) {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [reload]);

  const mergedEvents = useMemo(
    () => mergeCalendarEventsWithBirthdays(manualEvents, branchPeople, viewYear, currentBranchId),
    [manualEvents, branchPeople, viewYear, currentBranchId],
  );

  const eventMap = useMemo(() => groupCalendarEventsByDate(mergedEvents), [mergedEvents]);

  const nameMap = useMemo(
    () =>
      punches.reduce<Record<string, string[]>>((acc, record) => {
        const key = toDateKey(new Date(record.checkedInAt));
        const current = acc[key] ?? [];
        if (!current.includes(record.employeeName)) {
          current.push(record.employeeName);
        }
        acc[key] = current;
        return acc;
      }, {}),
    [punches],
  );

  return {
    loading,
    eventMap,
    nameMap,
    reload,
  };
}
