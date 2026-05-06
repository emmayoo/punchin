import type { Shift } from "@/types/work";

export const SCHEDULE_PEOPLE_KEY = "punchin:schedule-people";
export const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;
export const DISPLAY_HOURS = Array.from({ length: 24 }, (_, idx) => idx);
export const MINUTES_PER_DAY = 24 * 60;
export const HOUR_ROW_HEIGHT = 24;
export const DAY_COLUMN_HEIGHT = 24 * HOUR_ROW_HEIGHT;

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** 주 시작(월) 00:00 ~ 다음 주 월 00:00 직전까지 `start_at` 이 속하는 스케줄 */
export function filterShiftsStartingInWeek(all: Shift[], weekStart: Date): Shift[] {
  const nextWeek = addDays(weekStart, 7).getTime();
  const weekStartMs = weekStart.getTime();
  return all.filter((shift) => {
    const startMs = new Date(shift.startAt).getTime();
    return startMs >= weekStartMs && startMs < nextWeek;
  });
}

/** ms 단위로 동일한 순간이면 true (DB·ISO 표기 차이 허용) */
export function scheduleInstantsEqual(isoA: string, isoB: string): boolean {
  const ta = new Date(isoA).getTime();
  const tb = new Date(isoB).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) {
    return false;
  }
  return ta === tb;
}

export function shiftMatchesSlotPayload(shift: Shift, payload: Omit<Shift, "id">): boolean {
  const sameEmployee =
    shift.employeeId === payload.employeeId ||
    (!!payload.employeePhone && shift.employeePhone === payload.employeePhone);
  return (
    sameEmployee &&
    scheduleInstantsEqual(shift.startAt, payload.startAt) &&
    scheduleInstantsEqual(shift.endAt, payload.endAt)
  );
}

export function shiftRowToCreatePayload(shift: Shift): Omit<Shift, "id"> {
  return {
    employeeId: shift.employeeId,
    employeeName: shift.employeeName,
    employeePhone: shift.employeePhone,
    branchId: shift.branchId ?? null,
    startAt: shift.startAt,
    endAt: shift.endAt,
  };
}

export function weekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  });
  return `${fmt.format(weekStart)} - ${fmt.format(weekEnd)}`;
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function fromDateInput(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

export function parseTimeHHMM(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":").map(Number);
  return {
    hour: Number.isFinite(h) ? h : 0,
    minute: Number.isFinite(m) ? m : 0,
  };
}

export function toMinutes(value: string): number {
  const { hour, minute } = parseTimeHHMM(value);
  return hour * 60 + minute;
}

export function randomId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function minuteOffsetInDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** 그리드 세그먼트용 — 자정부터의 분 → `HH:mm` */
export function formatMinutesFromMidnightHHMM(totalMin: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(totalMin)));
  if (clamped === MINUTES_PER_DAY) {
    return "00:00";
  }
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function floorToHour(minutes: number): number {
  return Math.floor(minutes / 60) * 60;
}

export function ceilToHour(minutes: number): number {
  return Math.ceil(minutes / 60) * 60;
}

/** [start, end) 구간 기준 — 끝 시각이 다른 구간의 시작과 같으면 겹치지 않음 */
export function intervalsOverlapExclusive(
  startMsA: number,
  endMsA: number,
  startMsB: number,
  endMsB: number,
): boolean {
  return Math.max(startMsA, startMsB) < Math.min(endMsA, endMsB);
}

export function sameScheduleEmployee(
  shift: { employeeId: string; employeePhone: string },
  person: { id: string; employeePhone: string },
): boolean {
  return shift.employeeId === person.id || shift.employeePhone === person.employeePhone;
}

/** 같은 주·같은 담당자 기준, 추가하려는 구간과 시간이 겹치는 기존 스케줄 id 수집 */
export function collectOverlappingShiftIdsForProposals<
  T extends { id: string; employeeId: string; employeePhone: string; startAt: string; endAt: string },
>(
  proposals: { startAt: string; endAt: string }[],
  existingShifts: T[],
  person: { id: string; employeePhone: string },
): string[] {
  const ids = new Set<string>();
  for (const slot of proposals) {
    const slotStart = new Date(slot.startAt).getTime();
    const slotEnd = new Date(slot.endAt).getTime();
    const slotDayKey = dateKey(new Date(slot.startAt));
    for (const shift of existingShifts) {
      if (!sameScheduleEmployee(shift, person)) {
        continue;
      }
      if (dateKey(new Date(shift.startAt)) !== slotDayKey) {
        continue;
      }
      const exStart = new Date(shift.startAt).getTime();
      const exEnd = new Date(shift.endAt).getTime();
      if (intervalsOverlapExclusive(slotStart, slotEnd, exStart, exEnd)) {
        ids.add(shift.id);
      }
    }
  }
  return [...ids];
}
