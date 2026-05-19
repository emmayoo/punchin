const koDateTimeFullFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const koDateTimeClipFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const koDateOnlyFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const koMonthDayNumericFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
});

const koYearMonthLongFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
});

const koMonthDayWeekdayShortFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
});

const koYearMonthDayWeekdayLongFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

const koDateTimeMonthDayHourMinuteFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const koMonthDay2DigitFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "2-digit",
  day: "2-digit",
});

const koTimeHourMinuteSecondFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const koTimeHourMinute24Formatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatKoDateTimeFull(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return koDateTimeFullFormatter.format(date);
}

export function formatKoDateTimeClip(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return koDateTimeClipFormatter.format(date);
}

export function formatKoDateOnly(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return koDateOnlyFormatter.format(date);
}

export function formatKoMonthDayNumeric(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return koMonthDayNumericFormatter.format(date);
}

export function formatKoYearMonthLong(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return koYearMonthLongFormatter.format(date);
}

export function formatKoMonthDayWeekdayShort(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return koMonthDayWeekdayShortFormatter.format(date);
}

export function formatKoYearMonthDayWeekdayLong(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return koYearMonthDayWeekdayLongFormatter.format(date);
}

export function formatKoDateTimeMonthDayHourMinute(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return koDateTimeMonthDayHourMinuteFormatter.format(date);
}

/** 근무일 익일 00:00 퇴근 → `05. 18. 24:00` 형태 */
export function formatKoWorkDayMidnightEnd(workDayKey: string): string {
  const [year, month, day] = workDayKey.split("-").map(Number);
  if (!year || !month || !day) {
    return "24:00";
  }
  const workDay = new Date(year, month - 1, day);
  return `${koMonthDay2DigitFormatter.format(workDay)} 24:00`;
}

export function isWorkDayNextMidnight(iso: string, workDayKey: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return false;
  }
  const [year, month, day] = workDayKey.split("-").map(Number);
  if (!year || !month || !day) {
    return false;
  }
  const nextMidnight = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return d.getTime() === nextMidnight.getTime();
}

export function formatKoTimeHourMinuteSecond(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return koTimeHourMinuteSecondFormatter.format(date);
}

export function formatKoTimeHourMinute24(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return koTimeHourMinute24Formatter.format(date);
}
