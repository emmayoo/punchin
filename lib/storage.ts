"use client";

import { branchMemberName, readStoredBranchName } from "@/lib/branch-display-name";
import { DEFAULT_MEMBER_COLOR } from "@/lib/constants/color";
import { DEFAULT_EVENT_COLOR } from "@/lib/constants/event";
import { isToday } from "@/lib/time";
import type {
  Branch,
  BranchMembership,
  BranchRole,
  CalendarEvent,
  Employee,
  Notice,
  NoticeAttachment,
  PunchRecord,
  Shift,
} from "@/types/work";

const EMPLOYEE_KEY = "punchin:employees";
const SHIFT_KEY = "punchin:shifts";
const PUNCH_KEY = "punchin:punches";
const SESSION_KEY = "punchin:session";
const CALENDAR_EVENT_KEY = "punchin:calendar-events";
const BRANCH_KEY = "punchin:branches";
const BRANCH_MEMBERSHIP_KEY = "punchin:branch-memberships";
const NOTICE_KEY = "punchin:notices";
const NOTICE_ATTACHMENT_KEY = "punchin:notice-attachments";

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
  write(NOTICE_KEY, []);
  write(NOTICE_ATTACHMENT_KEY, []);
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
      displayNameConfirmedAt: existing.displayNameConfirmedAt,
    };
    write(
      EMPLOYEE_KEY,
      employees.map((employee) => (employee.phone === phone ? updated : employee)),
    );
    return updated;
  }
  const created: Employee = {
    id: id("emp"),
    name: resolvedName,
    phone,
    displayNameConfirmedAt: null,
  };
  write(EMPLOYEE_KEY, [created, ...employees]);
  return created;
}

export function setEmployeeCurrentBranch(phone: string, branchId: string | null): Employee | null {
  const employees = getEmployees();
  const target = employees.find((employee) => employee.phone === phone);
  if (!target) {
    return null;
  }
  const updated: Employee = { ...target, currentBranchId: branchId };
  write(
    EMPLOYEE_KEY,
    employees.map((employee) => (employee.phone === phone ? updated : employee)),
  );
  const session = getSession();
  if (session?.phone === phone) {
    saveSession(updated);
  }
  return updated;
}

export function updateEmployeeAvatar(phone: string, avatarUrl: string | null): Employee | null {
  const employees = getEmployees();
  const target = employees.find((employee) => employee.phone === phone);
  if (!target) {
    return null;
  }
  const updated: Employee = {
    ...target,
    avatarUrl: avatarUrl ?? null,
  };
  write(
    EMPLOYEE_KEY,
    employees.map((employee) => (employee.phone === phone ? updated : employee)),
  );
  const session = getSession();
  if (session?.phone === phone) {
    saveSession(updated);
  }
  return updated;
}

function normalizeBirthDateInput(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  const parsed = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return trimmed;
}

export function updateEmployeeProfile(
  phone: string,
  payload: { name: string; birthDate: string | null },
): Employee | null {
  const employees = getEmployees();
  const target = employees.find((employee) => employee.phone === phone);
  if (!target) {
    return null;
  }
  const updated: Employee = {
    ...target,
    name: payload.name.trim(),
    birthDate: normalizeBirthDateInput(payload.birthDate),
    displayNameConfirmedAt: new Date().toISOString(),
  };
  write(
    EMPLOYEE_KEY,
    employees.map((employee) => (employee.phone === phone ? updated : employee)),
  );
  const session = getSession();
  if (session?.phone === phone) {
    saveSession(updated);
  }
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

export function updateEmployeeName(phone: string, name: string): Employee | null {
  const employees = getEmployees();
  const target = employees.find((employee) => employee.phone === phone);
  if (!target) {
    return null;
  }
  const updated: Employee = {
    ...target,
    name: name.trim(),
    displayNameConfirmedAt: new Date().toISOString(),
  };
  write(
    EMPLOYEE_KEY,
    employees.map((employee) => (employee.phone === phone ? updated : employee)),
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
  const resolvedEmployeeId =
    shift.employeeId || getEmployees().find((e) => e.phone === shift.employeePhone)?.id || "";
  const created: Shift = { ...shift, employeeId: resolvedEmployeeId, id: id("shift") };
  write(SHIFT_KEY, [...all, created]);
  return created;
}

export function addShifts(shifts: Omit<Shift, "id">[]): string[] {
  const all = getShifts();
  const newRows: Shift[] = shifts.map((shift) => {
    const resolvedEmployeeId =
      shift.employeeId || getEmployees().find((e) => e.phone === shift.employeePhone)?.id || "";
    return { ...shift, employeeId: resolvedEmployeeId, id: id("shift") };
  });
  write(
    SHIFT_KEY,
    [...all, ...newRows].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    ),
  );
  return newRows.map((row) => row.id);
}

export function updateShift(
  shiftId: string,
  payload: Partial<
    Pick<Shift, "employeeId" | "employeeName" | "employeePhone" | "branchId" | "startAt" | "endAt">
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
      employeeId: payload.employeeId ?? shift.employeeId,
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
    next.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
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
    (a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime(),
  );
}

export function getActivePunch(phone: string): PunchRecord | null {
  return (
    getPunches().find((record) => record.employeePhone === phone && record.checkedOutAt === null) ??
    null
  );
}

export function checkIn(
  employee: Employee,
  branchId: string | null = employee.currentBranchId ?? null,
): PunchRecord {
  const all = getPunches();
  const active = all.find(
    (record) => record.employeePhone === employee.phone && record.checkedOutAt === null,
  );
  if (active) {
    return active;
  }
  const created: PunchRecord = {
    id: id("punch"),
    employeeId: employee.id,
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

export function updatePunchRecordTimes(
  recordId: string,
  checkedInAt: string,
  checkedOutAt: string | null,
): PunchRecord | null {
  const all = getPunches();
  let updatedRecord: PunchRecord | null = null;
  const next = all.map((record) => {
    if (record.id !== recordId) {
      return record;
    }
    updatedRecord = { ...record, checkedInAt, checkedOutAt };
    return updatedRecord;
  });
  if (!updatedRecord) {
    return null;
  }
  write(PUNCH_KEY, next);
  return updatedRecord;
}

export function addPunchRecord(input: Omit<PunchRecord, "id">): PunchRecord {
  const all = getPunches();
  const created: PunchRecord = {
    id: id("punch"),
    employeeId: input.employeeId,
    employeePhone: input.employeePhone,
    employeeName: input.employeeName,
    branchId: input.branchId ?? null,
    checkedInAt: input.checkedInAt,
    checkedOutAt: input.checkedOutAt,
  };
  write(PUNCH_KEY, [created, ...all]);
  return created;
}

export function deletePunchRecord(recordId: string): boolean {
  const all = getPunches();
  const next = all.filter((record) => record.id !== recordId);
  if (next.length === all.length) {
    return false;
  }
  write(PUNCH_KEY, next);
  return true;
}

export function getTodayPunches(): PunchRecord[] {
  return getPunches().filter((record) => isToday(record.checkedInAt));
}

export function getNotices(): Notice[] {
  return read<Notice[]>(NOTICE_KEY, []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getNoticeAttachments(): NoticeAttachment[] {
  return read<NoticeAttachment[]>(NOTICE_ATTACHMENT_KEY, []).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export function createNotice(input: {
  branchId: string;
  authorEmployeeId: string;
  authorName: string;
  title: string;
  content: string;
  isPinned: boolean;
  attachments: string[];
}): Notice {
  const notices = getNotices();
  const attachments = getNoticeAttachments();
  const noticeId = id("notice");
  const now = new Date().toISOString();
  const created: Notice = {
    id: noticeId,
    branchId: input.branchId,
    authorEmployeeId: input.authorEmployeeId,
    authorName: input.authorName,
    title: input.title,
    content: input.content,
    isPinned: input.isPinned,
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
  const nextAttachments: NoticeAttachment[] = input.attachments.map((imageUrl, index) => ({
    id: id("notice-file"),
    noticeId,
    imageUrl,
    sortOrder: index,
  }));
  write(NOTICE_KEY, [created, ...notices]);
  write(NOTICE_ATTACHMENT_KEY, [...attachments, ...nextAttachments]);
  return {
    ...created,
    attachments: nextAttachments,
  };
}

export function updateNotice(
  noticeId: string,
  input: { title: string; content: string; isPinned: boolean; attachments: string[] },
): Notice | null {
  const notices = getNotices();
  const target = notices.find((notice) => notice.id === noticeId) ?? null;
  if (!target) {
    return null;
  }
  const now = new Date().toISOString();
  const updated: Notice = {
    ...target,
    title: input.title,
    content: input.content,
    isPinned: input.isPinned,
    updatedAt: now,
    attachments: [],
  };
  write(
    NOTICE_KEY,
    notices.map((notice) => (notice.id === noticeId ? updated : notice)),
  );
  const attachments = getNoticeAttachments().filter((item) => item.noticeId !== noticeId);
  const nextAttachments: NoticeAttachment[] = input.attachments.map((imageUrl, index) => ({
    id: id("notice-file"),
    noticeId,
    imageUrl,
    sortOrder: index,
  }));
  write(NOTICE_ATTACHMENT_KEY, [...attachments, ...nextAttachments]);
  return {
    ...updated,
    attachments: nextAttachments,
  };
}

export function deleteNotice(noticeId: string): boolean {
  const notices = getNotices();
  const next = notices.filter((notice) => notice.id !== noticeId);
  if (next.length === notices.length) {
    return false;
  }
  write(NOTICE_KEY, next);
  write(
    NOTICE_ATTACHMENT_KEY,
    getNoticeAttachments().filter((attachment) => attachment.noticeId !== noticeId),
  );
  return true;
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
  return read<Branch[]>(BRANCH_KEY, []).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export function createBranch(input: {
  profileImageUrl?: string | null;
  name: string;
  businessNumber: string;
  address?: string | null;
  storePhone?: string | null;
  createdByPhone: string;
  createdByEmployeeId: string;
}): Branch {
  const created: Branch = {
    id: id("branch"),
    profileImageUrl: input.profileImageUrl ?? null,
    name: input.name.trim(),
    businessNumber: input.businessNumber.trim(),
    address: input.address?.trim() || null,
    storePhone: input.storePhone?.trim() || null,
    createdByEmployeeId: input.createdByEmployeeId,
    createdByPhone: input.createdByPhone,
  };
  write(BRANCH_KEY, [created, ...getBranches()]);
  return created;
}

export function getBranchMembershipsForBranch(branchId: string): BranchMembership[] {
  return getBranchMemberships().filter((item) => item.branchId === branchId);
}

export function updateBranchMembershipRole(
  membershipId: string,
  role: BranchRole,
): BranchMembership | null {
  const all = getBranchMemberships();
  const idx = all.findIndex((item) => item.id === membershipId);
  if (idx === -1) {
    return null;
  }
  const next = [...all];
  next[idx] = { ...next[idx], role };
  write(BRANCH_MEMBERSHIP_KEY, next);
  return next[idx];
}

export function updateBranchMembershipColor(
  membershipId: string,
  color: string,
): BranchMembership | null {
  const all = getBranchMemberships();
  const idx = all.findIndex((item) => item.id === membershipId);
  if (idx === -1) {
    return null;
  }
  const next = [...all];
  next[idx] = { ...next[idx], color: color.trim() || DEFAULT_MEMBER_COLOR };
  write(BRANCH_MEMBERSHIP_KEY, next);
  return next[idx];
}

export function updateBranchMemberJoinedAt(
  membershipId: string,
  startedAtIso: string,
): BranchMembership | null {
  const all = getBranchMemberships();
  const idx = all.findIndex((item) => item.id === membershipId);
  if (idx === -1) {
    return null;
  }
  const next = [...all];
  next[idx] = { ...next[idx], startedAt: startedAtIso };
  write(BRANCH_MEMBERSHIP_KEY, next);
  return next[idx];
}

export function updateBranchMemberName(
  membershipId: string,
  input: string | null,
  accountName: string,
): BranchMembership | null {
  const all = getBranchMemberships();
  const idx = all.findIndex((item) => item.id === membershipId);
  if (idx === -1) {
    return null;
  }
  const next = [...all];
  const name = branchMemberName(input, accountName);
  next[idx] = { ...next[idx], name };
  write(BRANCH_MEMBERSHIP_KEY, next);
  return next[idx];
}

export type BranchBasicFieldsPatch = {
  name: string;
  businessNumber: string;
  address: string | null;
  storePhone: string | null;
  profileImageUrl?: string | null;
};

export function updateBranchBasicFields(
  branchId: string,
  actorPhone: string,
  patch: BranchBasicFieldsPatch,
): Branch | null {
  const all = getBranches();
  const target = all.find((item) => item.id === branchId) ?? null;
  if (!target) {
    return null;
  }
  const mine = getBranchMemberships().find(
    (item) => item.branchId === branchId && item.employeePhone === actorPhone,
  );
  const canEdit = mine?.role === "owner" || target.createdByPhone === actorPhone;
  if (!canEdit) {
    return null;
  }
  const addressTrimmed = patch.address?.trim() ?? "";
  const storeTrimmed = patch.storePhone?.trim() ?? "";
  const updated: Branch = {
    ...target,
    name: patch.name.trim(),
    businessNumber: patch.businessNumber.trim(),
    address: addressTrimmed ? addressTrimmed : null,
    storePhone: storeTrimmed ? storeTrimmed : null,
    ...(patch.profileImageUrl !== undefined ? { profileImageUrl: patch.profileImageUrl } : {}),
  };
  write(
    BRANCH_KEY,
    all.map((item) => (item.id === branchId ? updated : item)),
  );
  return updated;
}

export function deleteBranchByOwner(branchId: string, actorPhone: string): boolean {
  const all = getBranches();
  const target = all.find((item) => item.id === branchId) ?? null;
  if (!target) {
    return false;
  }
  const mine = getBranchMemberships().find(
    (item) => item.branchId === branchId && item.employeePhone === actorPhone,
  );
  const isOwner = mine?.role === "owner" || target.createdByPhone === actorPhone;
  if (!isOwner) {
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
      employee.currentBranchId === branchId ? { ...employee, currentBranchId: null } : employee,
    ),
  );

  const session = getSession();
  if (session?.currentBranchId === branchId) {
    saveSession({ ...session, currentBranchId: null });
  }

  return true;
}

export function getBranchMemberships(): BranchMembership[] {
  const rows = read<(BranchMembership & { nickname?: string | null; name?: string })[]>(
    BRANCH_MEMBERSHIP_KEY,
    [],
  );
  const employees = getEmployees();
  return rows.map((row) => {
    if (row.name?.trim()) {
      return row as BranchMembership;
    }
    const emp =
      employees.find((e) => e.id === row.employeeId || e.phone === row.employeePhone) ?? null;
    return {
      ...row,
      name: branchMemberName(
        readStoredBranchName(row as Record<string, unknown>),
        emp?.name ?? "직원",
      ),
    };
  });
}

export function getBranchMembershipsByPhone(phone: string): BranchMembership[] {
  return getBranchMemberships().filter((item) => item.employeePhone === phone);
}

export function addBranchMembership(
  branchId: string,
  employeePhone: string,
  role: BranchRole,
  displayName?: string | null,
): BranchMembership {
  const employee = getEmployees().find((e) => e.phone === employeePhone);
  if (!employee?.id) {
    throw new Error("addBranchMembership: unknown employee phone");
  }
  const existing =
    getBranchMemberships().find(
      (item) =>
        item.branchId === branchId &&
        (item.employeePhone === employeePhone || item.employeeId === employee.id),
    ) ?? null;
  if (existing) {
    return existing;
  }
  const created: BranchMembership = {
    id: id("branch-member"),
    branchId,
    employeeId: employee.id,
    employeePhone,
    name: branchMemberName(displayName, employee.name),
    startedAt: new Date().toISOString(),
    color: DEFAULT_MEMBER_COLOR,
    role,
  };
  write(BRANCH_MEMBERSHIP_KEY, [created, ...getBranchMemberships()]);
  return created;
}

export function removeBranchMembership(branchId: string, employeePhone: string): boolean {
  const all = getBranchMemberships();
  const exists = all.some(
    (item) => item.branchId === branchId && item.employeePhone === employeePhone,
  );
  if (!exists) {
    return false;
  }
  write(
    BRANCH_MEMBERSHIP_KEY,
    all.filter((item) => !(item.branchId === branchId && item.employeePhone === employeePhone)),
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

export function addCalendarEvent(event: Omit<CalendarEvent, "id">): CalendarEvent {
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
