import { branchMemberName } from "@/lib/branch-display-name";
import { yearFromDateKey } from "@/lib/time";
import type { CalendarEvent, SchedulePersonRecord } from "@/types/work";

export type CalendarPersonSource = SchedulePersonRecord;

/** 생년월일을 해당 연도의 캘린더 날짜(YYYY-MM-DD)로 변환. 2/29는 평년에 2/28. */
export function resolveBirthdayDateInYear(birthDate: string, year: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
  if (!match) {
    return null;
  }
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  let resolvedDay = day;
  if (month === 2 && day === 29) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (!leap) {
      resolvedDay = 28;
    }
  }
  const probe = new Date(year, month - 1, resolvedDay);
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== resolvedDay
  ) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(resolvedDay).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function buildBirthdayCalendarEvents(
  people: CalendarPersonSource[],
  year: number,
  branchId: string | null,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const person of people) {
    const rawBirth = person.birthDate?.trim();
    if (!rawBirth) {
      continue;
    }
    const date = resolveBirthdayDateInYear(rawBirth, year);
    if (!date) {
      continue;
    }
    const displayName = branchMemberName(person.nickname, person.name);
    events.push({
      id: `birthday:${person.id}:${year}`,
      date,
      title: `🎂 ${displayName} 생일`,
      color: person.color,
      branchId,
      kind: "birthday",
    });
  }
  return events;
}

export function mergeCalendarEventsWithBirthdays(
  manualEvents: CalendarEvent[],
  people: CalendarPersonSource[],
  year: number,
  branchId: string | null,
): CalendarEvent[] {
  const birthdays = buildBirthdayCalendarEvents(people, year, branchId);
  return [...manualEvents, ...birthdays].sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ko"),
  );
}

export function isBirthdayCalendarEvent(event: CalendarEvent): boolean {
  return event.kind === "birthday" || event.id.startsWith("birthday:");
}

export function partitionCalendarEvents(events: CalendarEvent[]): {
  manual: CalendarEvent[];
  birthdays: CalendarEvent[];
} {
  const manual: CalendarEvent[] = [];
  const birthdays: CalendarEvent[] = [];
  for (const event of events) {
    if (isBirthdayCalendarEvent(event)) {
      birthdays.push(event);
    } else {
      manual.push(event);
    }
  }
  return { manual, birthdays };
}

export function groupCalendarEventsByDate(
  events: CalendarEvent[],
): Record<string, CalendarEvent[]> {
  return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const bucket = acc[event.date] ?? [];
    bucket.push(event);
    acc[event.date] = bucket;
    return acc;
  }, {});
}

export function calendarEventsOnDate(
  manualEvents: CalendarEvent[],
  people: CalendarPersonSource[],
  dateKey: string,
  branchId: string | null,
): CalendarEvent[] {
  const year = yearFromDateKey(dateKey);
  return mergeCalendarEventsWithBirthdays(manualEvents, people, year, branchId).filter(
    (event) => event.date === dateKey,
  );
}

export function todayCalendarEvents(
  manualEvents: CalendarEvent[],
  people: CalendarPersonSource[],
  branchId: string | null,
  todayKey: string,
): CalendarEvent[] {
  const year = yearFromDateKey(todayKey);
  return mergeCalendarEventsWithBirthdays(manualEvents, people, year, branchId)
    .filter((event) => event.date === todayKey)
    .sort((a, b) => a.title.localeCompare(b.title, "ko"));
}
