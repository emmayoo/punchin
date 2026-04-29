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

export function floorToHour(minutes: number): number {
  return Math.floor(minutes / 60) * 60;
}

export function ceilToHour(minutes: number): number {
  return Math.ceil(minutes / 60) * 60;
}
