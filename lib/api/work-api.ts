"use client";

import {
  addCalendarEvent,
  deleteCalendarEvent,
  deleteShift,
  addShift,
  addShifts,
  checkIn,
  checkOut,
  clearSession,
  getActivePunch,
  getCalendarEvents,
  getEmployees,
  getPunches,
  getSession,
  getShifts,
  getTodayPunches,
  initStorage,
  saveSession,
  updateCalendarEvent,
  updateEmployeeName,
  updateShift,
  upsertEmployee,
} from "@/lib/storage";
import { durationHours, isToday, isWithinWeek, startOfWeek } from "@/lib/time";
import { CalendarEvent, Employee, PunchRecord, Shift } from "@/types/work";

export type WeeklyStatRow = {
  phone: string;
  name: string;
  totalHours: number;
  shiftCount: number;
};

export type RangeWorkDetail = {
  recordId: string;
  checkedInAt: string;
  checkedOutAt: string;
  workedSeconds: number;
};

export type RangeWorkStatRow = {
  phone: string;
  name: string;
  totalSeconds: number;
  workCount: number;
  details: RangeWorkDetail[];
};

export type DashboardData = {
  session: Employee | null;
  shifts: Shift[];
  punchRecords: PunchRecord[];
  todayPunches: PunchRecord[];
  todayEvents: CalendarEvent[];
  activePunch: PunchRecord | null;
  currentWorker: Shift | null;
  nextWorker: Shift | null;
  todayShift: Shift | null;
  myTodayHours: number;
  myTodayRecords: PunchRecord[];
};

function buildSampleTodayShifts(nowIso: string): Shift[] {
  const base = new Date(nowIso);
  const setTime = (hour: number, minute: number): string => {
    const date = new Date(base);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };

  return [
    {
      id: "sample-1",
      employeeName: "민지",
      employeePhone: "01011112222",
      startAt: setTime(9, 0),
      endAt: setTime(13, 30),
    },
    {
      id: "sample-2",
      employeeName: "도윤",
      employeePhone: "01033334444",
      startAt: setTime(14, 0),
      endAt: setTime(18, 0),
    },
    {
      id: "sample-3",
      employeeName: "서준",
      employeePhone: "01055556666",
      startAt: setTime(18, 30),
      endAt: setTime(22, 0),
    },
  ];
}

function normalizePhone(input: string): string {
  return input.replace(/\D/g, "").slice(0, 11);
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function wait(ms = 80): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

class LocalWorkApi {
  async init(): Promise<void> {
    initStorage();
    await wait();
  }

  async login(phone: string): Promise<Employee> {
    const employee = upsertEmployee(normalizePhone(phone));
    saveSession(employee);
    await wait();
    return employee;
  }

  async getEmployeeByPhone(phone: string): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    const employee =
      getEmployees().find((item) => item.phone === normalized) ?? null;
    await wait();
    return employee;
  }

  async registerFirstProfile(phone: string, name: string): Promise<Employee> {
    const employee = upsertEmployee(normalizePhone(phone), name.trim());
    saveSession(employee);
    await wait();
    return employee;
  }

  async updateMyProfileName(
    phone: string,
    name: string,
  ): Promise<Employee | null> {
    const updated = updateEmployeeName(normalizePhone(phone), name);
    await wait();
    return updated;
  }

  async logout(): Promise<void> {
    clearSession();
    await wait();
  }

  async checkInCurrent(session: Employee): Promise<void> {
    checkIn(session);
    await wait();
  }

  async checkOutCurrent(recordId: string): Promise<void> {
    checkOut(recordId);
    await wait();
  }

  async getDashboard(): Promise<DashboardData> {
    const session = getSession();
    const shifts = getShifts();
    const punchRecords = getPunches();
    const todayPunches = getTodayPunches();
    const todayEvents = getCalendarEvents()
      .filter((event) => event.date === toDateKey(new Date()))
      .sort((a, b) => a.title.localeCompare(b.title));
    const nowMs = Date.now();

    const activePunch = session ? getActivePunch(session.phone) : null;
    const todayShift = session
      ? (shifts.find(
          (shift) =>
            shift.employeePhone === session.phone && isToday(shift.startAt),
        ) ?? null)
      : null;
    const currentWorker =
      shifts.find(
        (shift) =>
          new Date(shift.startAt).getTime() <= nowMs &&
          new Date(shift.endAt).getTime() >= nowMs,
      ) ?? null;
    const nextWorker =
      shifts.find((shift) => new Date(shift.startAt).getTime() > nowMs) ?? null;

    const myTodayRecords = session
      ? todayPunches
          .filter((record) => record.employeePhone === session.phone)
          .sort(
            (a, b) =>
              new Date(a.checkedInAt).getTime() -
              new Date(b.checkedInAt).getTime(),
          )
      : [];
    const myTodayHours = myTodayRecords.reduce((sum, record) => {
      const endAt = record.checkedOutAt ?? new Date(nowMs).toISOString();
      return sum + durationHours(record.checkedInAt, endAt);
    }, 0);

    await wait();
    return {
      session,
      shifts,
      punchRecords,
      todayPunches,
      todayEvents,
      activePunch,
      currentWorker,
      nextWorker,
      todayShift,
      myTodayHours,
      myTodayRecords,
    };
  }

  async getHistory(): Promise<PunchRecord[]> {
    await wait();
    return getPunches();
  }

  async getCalendarEvents(): Promise<CalendarEvent[]> {
    await wait();
    return getCalendarEvents();
  }

  async createCalendarEvent(
    event: Omit<CalendarEvent, "id">,
  ): Promise<CalendarEvent> {
    const created = addCalendarEvent(event);
    await wait();
    return created;
  }

  async updateCalendarEvent(
    eventId: string,
    payload: Partial<Pick<CalendarEvent, "title" | "color">>,
  ): Promise<CalendarEvent | null> {
    const updated = updateCalendarEvent(eventId, payload);
    await wait();
    return updated;
  }

  async deleteCalendarEvent(eventId: string): Promise<void> {
    deleteCalendarEvent(eventId);
    await wait();
  }

  async getSchedule(): Promise<Shift[]> {
    await wait();
    return getShifts();
  }

  /**
   * 타임라인용 오늘 근무 목록.
   * 실제 데이터가 없으면 샘플을 내려주며, 추후 백엔드 엔드포인트로 대체하기 쉽도록 API 레이어에 둔다.
   */
  async getTimelineShifts(nowIso: string, shifts: Shift[]): Promise<Shift[]> {
    const today = shifts.filter((shift) => isToday(shift.startAt));
    await wait();
    if (today.length > 0) {
      return today;
    }
    return buildSampleTodayShifts(nowIso);
  }

  async createShift(shift: Omit<Shift, "id">): Promise<Shift> {
    const created = addShift(shift);
    await wait();
    return created;
  }

  async createShifts(shifts: Omit<Shift, "id">[]): Promise<void> {
    addShifts(shifts);
    await wait();
  }

  async updateShift(
    shiftId: string,
    payload: Partial<Pick<Shift, "employeeName" | "employeePhone" | "startAt" | "endAt">>,
  ): Promise<Shift | null> {
    const updated = updateShift(shiftId, payload);
    await wait();
    return updated;
  }

  async deleteShift(shiftId: string): Promise<void> {
    deleteShift(shiftId);
    await wait();
  }

  async getWeeklyStats(): Promise<{
    rows: WeeklyStatRow[];
    totalHours: number;
  }> {
    const weekStart = startOfWeek(new Date());
    const map = new Map<string, WeeklyStatRow>();

    for (const record of getPunches()) {
      if (
        !record.checkedOutAt ||
        !isWithinWeek(record.checkedInAt, weekStart)
      ) {
        continue;
      }
      const key = record.employeePhone;
      const current = map.get(key) ?? {
        phone: record.employeePhone,
        name: record.employeeName,
        totalHours: 0,
        shiftCount: 0,
      };
      current.totalHours += durationHours(
        record.checkedInAt,
        record.checkedOutAt,
      );
      current.shiftCount += 1;
      map.set(key, current);
    }

    const rows = [...map.values()].sort((a, b) => b.totalHours - a.totalHours);
    const totalHours = rows.reduce((sum, row) => sum + row.totalHours, 0);
    await wait();
    return { rows, totalHours };
  }

  async getRangeWorkStats(startDate: string, endDate: string): Promise<{
    rows: RangeWorkStatRow[];
    totalSeconds: number;
  }> {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59.999`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      await wait();
      return { rows: [], totalSeconds: 0 };
    }
    if (start.getTime() > end.getTime()) {
      await wait();
      return { rows: [], totalSeconds: 0 };
    }

    const map = new Map<string, RangeWorkStatRow>();
    for (const record of getPunches()) {
      if (!record.checkedOutAt) {
        continue;
      }
      const checkedInMs = new Date(record.checkedInAt).getTime();
      const checkedOutMs = new Date(record.checkedOutAt).getTime();
      if (Number.isNaN(checkedInMs) || Number.isNaN(checkedOutMs)) {
        continue;
      }
      const clippedStart = Math.max(checkedInMs, start.getTime());
      const clippedEnd = Math.min(checkedOutMs, end.getTime());
      if (clippedEnd <= clippedStart) {
        continue;
      }
      const workedSeconds = Math.floor((clippedEnd - clippedStart) / 1000);
      const key = record.employeePhone;
      const current = map.get(key) ?? {
        phone: record.employeePhone,
        name: record.employeeName,
        totalSeconds: 0,
        workCount: 0,
        details: [],
      };
      current.totalSeconds += workedSeconds;
      current.workCount += 1;
      current.details.push({
        recordId: record.id,
        checkedInAt: new Date(clippedStart).toISOString(),
        checkedOutAt: new Date(clippedEnd).toISOString(),
        workedSeconds,
      });
      map.set(key, current);
    }

    const rows = [...map.values()]
      .map((row) => ({
        ...row,
        details: row.details.sort(
          (a, b) =>
            new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime(),
        ),
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
    const totalSeconds = rows.reduce((sum, row) => sum + row.totalSeconds, 0);
    await wait();
    return { rows, totalSeconds };
  }
}

export const workApi = new LocalWorkApi();
