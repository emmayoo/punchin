"use client";

import type {
  Branch,
  BranchMembership,
  CalendarEvent,
  Employee,
  PunchRecord,
  Shift,
} from "@/types/work";
import { isToday } from "@/lib/time";
import { DEFAULT_EVENT_COLOR } from "@/lib/constants/event";

const EMPLOYEE_KEY = "punchin:employees";
const SHIFT_KEY = "punchin:shifts";
const PUNCH_KEY = "punchin:punches";
const SESSION_KEY = "punchin:session";
const CALENDAR_EVENT_KEY = "punchin:calendar-events";
const BRANCH_KEY = "punchin:branches";
const BRANCH_MEMBERSHIP_KEY = "punchin:branch-memberships";

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function seedIfNeeded(): void {
  const employees = read<Employee[]>(EMPLOYEE_KEY, []);
  if (employees.length > 0) {
    return;
  }
  write(EMPLOYEE_KEY, []);
  write(SHIFT_KEY, []);
  write(PUNCH_KEY, []);
  write(BRANCH_KEY, []);
  write(BRANCH_MEMBERSHIP_KEY, []);
}

export function initStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  seedIfNeeded();
}

export function getEmployees(): Employee[] {
  return read<Employee[]>(EMPLOYEE_KEY, []);
}

function defaultEmployeeName(phone: string): string {
  return `직원-${phone.slice(-4)}`;
}

export function upsertEmployee(phone: string, name?: string): Employee {
  const resolvedName = name?.trim() || defaultEmployeeName(phone);
  const employees = getEmployees();
  const existing = employees.find((employee) => employee.phone === phone);
  if (existing) {
    const updated: Employee = {
      ...existing,
      name: existing.name || resolvedName,
    };
    write(
      EMPLOYEE_KEY,
      employees.map((employee) =>
        employee.phone === phone ? updated : employee,
      ),
    );
    return updated;
  }
  const created = { id: id("emp"), name: resolvedName, phone };
  write(EMPLOYEE_KEY, [created, ...employees]);
  return created;
}

export function setEmployeeCurrentBranch(
  phone: string,
  branchId: string | null,
): Employee | null {
  const employees = getEmployees();
  const target = employees.find((employee) => employee.phone === phone);
  if (!target) {
    return null;
  }
  const updated: Employee = { ...target, currentBranchId: branchId };
  write(
    EMPLOYEE_KEY,
    employees.map((employee) =>
      employee.phone === phone ? updated : employee,
    ),
  );
  const session = getSession();
  if (session?.phone === phone) {
    saveSession(updated);
  }
  return updated;
}

export function updateEmployeeName(
  phone: string,
  name: string,
): Employee | null {
  const employees = getEmployees();
  const target = employees.find((employee) => employee.phone === phone);
  if (!target) {
    return null;
  }
  const updated: Employee = { ...target, name: name.trim() };
  write(
    EMPLOYEE_KEY,
    employees.map((employee) =>
      employee.phone === phone ? updated : employee,
    ),
  );
  const session = getSession();
  if (session?.phone === phone) {
    saveSession(updated);
  }
  // 프로필 이름 변경 시 진행 중인 근무 기록 표기도 즉시 동기화한다.
  const punches = getPunches();
  const syncedPunches = punches.map((record) => {
    if (record.employeePhone !== phone || record.checkedOutAt !== null) {
      return record;
    }
    return { ...record, employeeName: updated.name };
  });
  write(PUNCH_KEY, syncedPunches);
  return updated;
}

export function getShifts(): Shift[] {
  return read<Shift[]>(SHIFT_KEY, []).sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
}

export function addShift(shift: Omit<Shift, "id">): Shift {
  const all = getShifts();
  const created: Shift = { ...shift, id: id("shift") };
  write(SHIFT_KEY, [...all, created]);
  return created;
}

export function addShifts(shifts: Omit<Shift, "id">[]): void {
  const all = getShifts();
  write(
    SHIFT_KEY,
    [...all, ...shifts.map((shift) => ({ ...shift, id: id("shift") }))].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    ),
  );
}

export function updateShift(
  shiftId: string,
  payload: Partial<
    Pick<Shift, "employeeName" | "employeePhone" | "branchId" | "startAt" | "endAt">
  >,
): Shift | null {
  const all = getShifts();
  let updated: Shift | null = null;
  const next = all.map((shift) => {
    if (shift.id !== shiftId) {
      return shift;
    }
    updated = {
      ...shift,
      employeeName: payload.employeeName ?? shift.employeeName,
      employeePhone: payload.employeePhone ?? shift.employeePhone,
      branchId: payload.branchId ?? shift.branchId ?? null,
      startAt: payload.startAt ?? shift.startAt,
      endAt: payload.endAt ?? shift.endAt,
    };
    return updated;
  });
  write(
    SHIFT_KEY,
    next.sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    ),
  );
  return updated;
}

export function deleteShift(shiftId: string): void {
  const all = getShifts();
  write(
    SHIFT_KEY,
    all.filter((shift) => shift.id !== shiftId),
  );
}

export function getPunches(): PunchRecord[] {
  return read<PunchRecord[]>(PUNCH_KEY, []).sort(
    (a, b) =>
      new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime(),
  );
}

export function getActivePunch(phone: string): PunchRecord | null {
  return (
    getPunches().find(
      (record) =>
        record.employeePhone === phone && record.checkedOutAt === null,
    ) ?? null
  );
}

export function checkIn(
  employee: Employee,
  branchId: string | null = employee.currentBranchId ?? null,
): PunchRecord {
  const all = getPunches();
  const active = all.find(
    (record) =>
      record.employeePhone === employee.phone && record.checkedOutAt === null,
  );
  if (active) {
    return active;
  }
  const created: PunchRecord = {
    id: id("punch"),
    employeePhone: employee.phone,
    employeeName: employee.name,
    branchId,
    checkedInAt: new Date().toISOString(),
    checkedOutAt: null,
  };
  write(PUNCH_KEY, [created, ...all]);
  return created;
}

export function checkOut(recordId: string): PunchRecord | null {
  const all = getPunches();
  let updatedRecord: PunchRecord | null = null;
  const updated = all.map((record) => {
    if (record.id !== recordId) {
      return record;
    }
    updatedRecord = { ...record, checkedOutAt: new Date().toISOString() };
    return updatedRecord;
  });
  write(PUNCH_KEY, updated);
  return updatedRecord;
}

export function getTodayPunches(): PunchRecord[] {
  return getPunches().filter((record) => isToday(record.checkedInAt));
}

export function saveSession(employee: Employee): void {
  write(SESSION_KEY, employee);
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(SESSION_KEY);
}

export function getSession(): Employee | null {
  return read<Employee | null>(SESSION_KEY, null);
}

export function getBranches(): Branch[] {
  return read<Branch[]>(BRANCH_KEY, []).sort((a, b) =>
    a.name.localeCompare(b.name, "ko"),
  );
}

export function createBranch(input: {
  profileImageUrl?: string | null;
  name: string;
  businessNumber: string;
  address?: string | null;
  storePhone?: string | null;
  createdByPhone: string;
}): Branch {
  const created: Branch = {
    id: id("branch"),
    profileImageUrl: input.profileImageUrl ?? null,
    name: input.name.trim(),
    businessNumber: input.businessNumber.trim(),
    address: input.address?.trim() || null,
    storePhone: input.storePhone?.trim() || null,
    createdByPhone: input.createdByPhone,
  };
  write(BRANCH_KEY, [created, ...getBranches()]);
  return created;
}

export function updateBranchName(
  branchId: string,
  name: string,
  actorPhone: string,
): Branch | null {
  const all = getBranches();
  const target = all.find((item) => item.id === branchId) ?? null;
  if (!target || target.createdByPhone !== actorPhone) {
    return null;
  }
  const updated: Branch = { ...target, name: name.trim() };
  write(
    BRANCH_KEY,
    all.map((item) => (item.id === branchId ? updated : item)),
  );
  return updated;
}

export function deleteBranchByOwner(
  branchId: string,
  actorPhone: string,
): boolean {
  const all = getBranches();
  const target = all.find((item) => item.id === branchId) ?? null;
  if (!target || target.createdByPhone !== actorPhone) {
    return false;
  }

  write(
    BRANCH_KEY,
    all.filter((item) => item.id !== branchId),
  );
  write(
    BRANCH_MEMBERSHIP_KEY,
    getBranchMemberships().filter((item) => item.branchId !== branchId),
  );
  write(
    EMPLOYEE_KEY,
    getEmployees().map((employee) =>
      employee.currentBranchId === branchId
        ? { ...employee, currentBranchId: null }
        : employee,
    ),
  );

  const session = getSession();
  if (session?.currentBranchId === branchId) {
    saveSession({ ...session, currentBranchId: null });
  }

  return true;
}

export function getBranchMemberships(): BranchMembership[] {
  return read<BranchMembership[]>(BRANCH_MEMBERSHIP_KEY, []);
}

export function getBranchMembershipsByPhone(phone: string): BranchMembership[] {
  return getBranchMemberships().filter((item) => item.employeePhone === phone);
}

export function addBranchMembership(
  branchId: string,
  employeePhone: string,
  role: "owner" | "member",
): BranchMembership {
  const existing =
    getBranchMemberships().find(
      (item) =>
        item.branchId === branchId && item.employeePhone === employeePhone,
    ) ?? null;
  if (existing) {
    return existing;
  }
  const created: BranchMembership = {
    id: id("branch-member"),
    branchId,
    employeePhone,
    role,
  };
  write(BRANCH_MEMBERSHIP_KEY, [created, ...getBranchMemberships()]);
  return created;
}

export function removeBranchMembership(
  branchId: string,
  employeePhone: string,
): boolean {
  const all = getBranchMemberships();
  const exists = all.some(
    (item) => item.branchId === branchId && item.employeePhone === employeePhone,
  );
  if (!exists) {
    return false;
  }
  write(
    BRANCH_MEMBERSHIP_KEY,
    all.filter(
      (item) =>
        !(item.branchId === branchId && item.employeePhone === employeePhone),
    ),
  );
  return true;
}

export function getCalendarEvents(): CalendarEvent[] {
  const raw = read<CalendarEvent[]>(CALENDAR_EVENT_KEY, []);
  const normalized = raw.map((event) => ({
    ...event,
    color: event.color || DEFAULT_EVENT_COLOR,
  }));
  return normalized.sort((a, b) => a.date.localeCompare(b.date));
}

export function addCalendarEvent(
  event: Omit<CalendarEvent, "id">,
): CalendarEvent {
  const all = getCalendarEvents();
  const created: CalendarEvent = {
    id: id("event"),
    date: event.date,
    title: event.title.trim(),
    color: event.color || DEFAULT_EVENT_COLOR,
  };
  write(CALENDAR_EVENT_KEY, [...all, created]);
  return created;
}

export function updateCalendarEvent(
  eventId: string,
  payload: Partial<Pick<CalendarEvent, "title" | "color" | "branchId">>,
): CalendarEvent | null {
  const all = getCalendarEvents();
  let updated: CalendarEvent | null = null;
  const next = all.map((event) => {
    if (event.id !== eventId) {
      return event;
    }
    updated = {
      ...event,
      title: payload.title?.trim() ?? event.title,
      color: payload.color ?? event.color,
      branchId: payload.branchId ?? event.branchId ?? null,
    };
    return updated;
  });
  write(CALENDAR_EVENT_KEY, next);
  return updated;
}

export function deleteCalendarEvent(eventId: string): void {
  const all = getCalendarEvents();
  write(
    CALENDAR_EVENT_KEY,
    all.filter((event) => event.id !== eventId),
  );
}
