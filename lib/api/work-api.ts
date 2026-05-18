"use client";

import {
  addBranchMembership,
  addCalendarEvent,
  addShift,
  addShifts,
  addPunchRecord,
  createNotice as createNoticeLocal,
  checkIn,
  checkOut,
  clearSession,
  createBranch,
  deleteBranchByOwner,
  deleteCalendarEvent,
  deletePunchRecord,
  deleteNotice as deleteNoticeLocal,
  deleteShift,
  getActivePunch,
  getBranches,
  getBranchMemberships,
  getBranchMembershipsByPhone,
  getBranchMembershipsForBranch,
  getCalendarEvents,
  getEmployees,
  getNoticeAttachments,
  getNotices,
  getPunches,
  getSession,
  getShifts,
  getTodayPunches,
  initStorage,
  removeBranchMembership,
  saveSession,
  setEmployeeCurrentBranch,
  updateBranchBasicFields,
  updateBranchMembershipColor,
  updateBranchMemberJoinedAt as persistBranchMemberJoinedAt,
  updateBranchMemberName as persistBranchMemberName,
  updateBranchMembershipRole,
  updateCalendarEvent,
  updateEmployeeName,
  updateNotice as updateNoticeLocal,
  updatePunchRecordTimes,
  updateShift,
  updateEmployeeAvatar,
  upsertEmployee,
} from "@/lib/storage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  newAvatarStoragePath,
  newBranchProfileStoragePath,
  newNoticeAttachmentStoragePath,
  uploadPublicImage,
} from "@/lib/supabase/media-upload";
import {
  branchMemberName,
  BRANCH_MEMBER_FALLBACK,
  readStoredBranchName,
} from "@/lib/branch-display-name";
import { durationHours, isToday, isWithinWeek, startOfWeek } from "@/lib/time";
import type {
  Branch,
  BranchFormerMemberListItem,
  BranchMemberListItem,
  BranchMembership,
  BranchRole,
  CalendarEvent,
  Employee,
  Notice,
  NoticeAttachment,
  PunchRecord,
  Shift,
} from "@/types/work";

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
  /** 퇴근 기록 없이 집계 구간만큼 반영된 근무 */
  ongoing?: boolean;
};

export type RangeWorkStatRow = {
  phone: string;
  name: string;
  totalSeconds: number;
  workCount: number;
  details: RangeWorkDetail[];
};

export type SchedulePersonRecord = {
  id: string;
  name: string;
  employeePhone: string;
  color: string;
};

export type NoticeInput = {
  title: string;
  content: string;
  isPinned: boolean;
  attachments: string[];
};

export type BranchSetupInput =
  | { mode: "select"; branchId: string }
  | {
      mode: "create";
      branchName: string;
      businessNumber: string;
      /** 로컬 모드용(data URL). Supabase에서는 `profileImageFile` 권장. */
      profileImageUrl?: string | null;
      profileImageFile?: File | null;
      address?: string | null;
      storePhone?: string | null;
    };

export type DashboardData = {
  session: Employee | null;
  branches: Branch[];
  myBranches: Branch[];
  /** 현재 로그인 직원의 지점 멤버십 (역할 판별용) */
  myBranchMemberships: BranchMembership[];
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

function mapBranchRole(roleStr: string): BranchRole {
  if (roleStr === "owner") {
    return "owner";
  }
  if (roleStr === "manager") {
    return "manager";
  }
  return "staff";
}

function embeddedEmployeePhone(row: Record<string, unknown>): string {
  const raw = row.employee as { phone?: unknown } | null | undefined;
  if (raw && typeof raw === "object" && raw !== null && "phone" in raw) {
    return String(raw.phone ?? "");
  }
  return "";
}

function mapDisplayNameConfirmedAt(row: Record<string, unknown>): string | null | undefined {
  if (!("display_name_confirmed_at" in row)) {
    return undefined;
  }
  const v = row.display_name_confirmed_at;
  if (v === null || v === undefined || String(v).trim() === "") {
    return null;
  }
  return String(v);
}

function mapEmployeeRow(row: Record<string, unknown>): Employee {
  const rawAvatar = row.avatar_url;
  return {
    id: String(row.id),
    phone: String(row.phone),
    name: String(row.name),
    avatarUrl:
      rawAvatar !== undefined && rawAvatar !== null && String(rawAvatar).trim() !== ""
        ? String(rawAvatar)
        : null,
    currentBranchId: row.current_branch_id ? String(row.current_branch_id) : null,
    displayNameConfirmedAt: mapDisplayNameConfirmedAt(row),
  };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function mapShiftRow(row: Record<string, unknown>): Shift {
  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    employeePhone: embeddedEmployeePhone(row),
    employeeName: String(row.employee_name),
    branchId: row.branch_id ? String(row.branch_id) : null,
    startAt: String(row.start_at),
    endAt: String(row.end_at),
  };
}

function mapPunchRow(row: Record<string, unknown>): PunchRecord {
  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    employeePhone: embeddedEmployeePhone(row),
    employeeName: String(row.employee_name),
    branchId: row.branch_id ? String(row.branch_id) : null,
    checkedInAt: String(row.checked_in_at),
    checkedOutAt: row.checked_out_at ? String(row.checked_out_at) : null,
  };
}

function mapEventRow(row: Record<string, unknown>): CalendarEvent {
  return {
    id: String(row.id),
    date: String(row.date),
    title: String(row.title),
    color: String(row.color),
    branchId: row.branch_id ? String(row.branch_id) : null,
  };
}

function mapNoticeRow(row: Record<string, unknown>): Notice {
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    authorEmployeeId: String(row.author_employee_id),
    authorName: String(row.author_name ?? ""),
    title: String(row.title ?? ""),
    content: String(row.body ?? ""),
    isPinned: Boolean(row.is_pinned),
    attachments: [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

function mapNoticeAttachmentRow(row: Record<string, unknown>): NoticeAttachment {
  return {
    id: String(row.id),
    noticeId: String(row.notice_id),
    imageUrl: String(row.image_url ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapBranchRow(row: Record<string, unknown>, creatorPhone?: string): Branch {
  const cid = String(row.created_by_employee_id ?? "");
  return {
    id: String(row.id),
    profileImageUrl: row.profile_image_url ? String(row.profile_image_url) : null,
    name: String(row.name),
    businessNumber: String(row.business_number ?? ""),
    address: row.address ? String(row.address) : null,
    storePhone: row.store_phone ? String(row.store_phone) : null,
    createdByEmployeeId: cid,
    createdByPhone: creatorPhone ?? "",
  };
}

function embeddedEmployeeFromRow(
  row: Record<string, unknown>,
): { phone: string; name: string } | null {
  const embedded = row.employee as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null
    | undefined;
  if (!embedded || Array.isArray(embedded) || typeof embedded !== "object") {
    return null;
  }
  return {
    phone: typeof embedded.phone === "string" ? embedded.phone : "",
    name: typeof embedded.name === "string" ? embedded.name : "",
  };
}

function mapBranchMembershipRow(
  row: Record<string, unknown>,
  employeePhone: string,
  accountName = "",
): BranchMembership {
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    employeeId: String(row.employee_id),
    employeePhone,
    name: branchMemberName(readStoredBranchName(row), accountName),
    color:
      row.color !== undefined && row.color !== null && String(row.color).trim() !== ""
        ? String(row.color)
        : "#22c55e",
    role: mapBranchRole(String(row.role)),
  };
}

type ActorBranchAccess = { role: BranchRole } | "creator" | null;

function mapBranchMemberListRow(row: Record<string, unknown>): BranchMemberListItem {
  const emp = embeddedEmployeeFromRow(row);
  const color =
    row.color !== undefined && row.color !== null && String(row.color).trim().length > 0
      ? String(row.color)
      : null;
  const startedAt = row.started_at ?? row.created_at;
  return {
    membershipId: String(row.id),
    employeeId: String(row.employee_id),
    phone: emp?.phone ?? "",
    name: branchMemberName(readStoredBranchName(row), emp?.name ?? ""),
    color,
    role: mapBranchRole(String(row.role)),
    joinedAt:
      startedAt !== undefined && startedAt !== null && String(startedAt).trim() !== ""
        ? String(startedAt)
        : null,
  };
}

function mapBranchFormerMemberListRow(row: Record<string, unknown>): BranchFormerMemberListItem {
  const active = mapBranchMemberListRow(row);
  const endedAt = row.ended_at;
  return {
    ...active,
    leftAt:
      endedAt !== undefined && endedAt !== null && String(endedAt).trim() !== ""
        ? String(endedAt)
        : null,
  };
}

function localResolveActorBranchRole(branchId: string, actorPhone: string): ActorBranchAccess {
  const normalized = normalizePhone(actorPhone);
  const branch = getBranches().find((item) => item.id === branchId) ?? null;
  const actor = getEmployees().find((item) => item.phone === normalized) ?? null;
  if (!branch || !actor) {
    return null;
  }
  const membership = getBranchMemberships().find(
    (item) => item.branchId === branchId && item.employeePhone === normalized,
  );
  if (membership) {
    return { role: membership.role };
  }
  if (branch.createdByPhone === normalized || branch.createdByEmployeeId === actor.id) {
    return "creator";
  }
  return null;
}

function localIsOwnerAccess(access: ActorBranchAccess): boolean {
  return access === "creator" || access?.role === "owner";
}

function localIsManagerUp(access: ActorBranchAccess): boolean {
  return access === "creator" || access?.role === "owner" || access?.role === "manager";
}

function canEditNoticeByRole(
  actorAccess: ActorBranchAccess,
  authorRole: BranchRole | null,
  isAuthor: boolean,
): boolean {
  if (isAuthor) {
    return true;
  }
  const actorRole: BranchRole | "creator" | null =
    actorAccess === "creator" ? "creator" : actorAccess?.role ?? null;
  if (actorRole === "creator" || actorRole === "owner") {
    return authorRole === "manager" || authorRole === "staff" || authorRole === null;
  }
  if (actorRole === "manager") {
    return authorRole === "staff" || authorRole === null;
  }
  return false;
}

function localCountOwners(branchId: string): number {
  return getBranchMembershipsForBranch(branchId).filter((item) => item.role === "owner").length;
}

/** 조회 구간과 겹치는 근무를 집계. 퇴근 전(`checkedOutAt` 없음)은 현재 시각까지 clip 해 그리드와 맞춘다. */
function buildRangeWorkStatsFromPunches(
  punches: PunchRecord[],
  start: Date,
  end: Date,
): { rows: RangeWorkStatRow[]; totalSeconds: number } {
  const map = new Map<string, RangeWorkStatRow>();
  const rangeStartMs = start.getTime();
  const rangeEndMs = end.getTime();
  const nowMs = Date.now();

  for (const record of punches) {
    const checkedInMs = new Date(record.checkedInAt).getTime();
    if (Number.isNaN(checkedInMs)) {
      continue;
    }

    let effectiveEndMs: number;
    if (record.checkedOutAt) {
      const endMs = new Date(record.checkedOutAt).getTime();
      if (Number.isNaN(endMs)) {
        continue;
      }
      effectiveEndMs = endMs;
    } else {
      effectiveEndMs = nowMs;
    }

    const clippedStart = Math.max(checkedInMs, rangeStartMs);
    const clippedEnd = Math.min(effectiveEndMs, rangeEndMs);
    if (clippedEnd <= clippedStart) {
      continue;
    }

    const workedSeconds = Math.floor((clippedEnd - clippedStart) / 1000);
    const key = normalizePhone(record.employeePhone) || record.employeePhone;
    let current = map.get(key);
    if (!current) {
      current = {
        phone: key,
        name: record.employeeName,
        totalSeconds: 0,
        workCount: 0,
        details: [],
      };
      map.set(key, current);
    }
    current.name = record.employeeName;
    current.totalSeconds += workedSeconds;
    current.workCount += 1;
    current.details.push({
      recordId: record.id,
      checkedInAt: new Date(clippedStart).toISOString(),
      checkedOutAt: new Date(clippedEnd).toISOString(),
      workedSeconds,
      ongoing: !record.checkedOutAt,
    });
  }

  const rows = [...map.values()]
    .map((row) => ({
      ...row,
      details: row.details.sort(
        (a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime(),
      ),
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);
  const totalSeconds = rows.reduce((sum, row) => sum + row.totalSeconds, 0);
  return { rows, totalSeconds };
}

class LocalWorkApi {
  private dashboardInFlight: Promise<DashboardData> | null = null;

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
    const employee = getEmployees().find((item) => item.phone === normalized) ?? null;
    await wait();
    return employee;
  }

  async registerFirstProfile(phone: string, name: string): Promise<Employee> {
    const normalized = normalizePhone(phone);
    upsertEmployee(normalized, name.trim());
    const confirmed = updateEmployeeName(normalized, name.trim());
    const employee = confirmed ?? getEmployees().find((item) => item.phone === normalized)!;
    const updated = setEmployeeCurrentBranch(employee.phone, null) ?? employee;
    saveSession(updated);
    await wait();
    return updated;
  }

  async getBranches(): Promise<Branch[]> {
    await wait();
    return getBranches();
  }

  async getMyBranchMemberships(phone: string): Promise<BranchMembership[]> {
    await wait();
    return getBranchMembershipsByPhone(normalizePhone(phone));
  }

  async setCurrentBranch(phone: string, branchId: string): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    const employee = getEmployees().find((item) => item.phone === normalized) ?? null;
    if (!employee) {
      await wait();
      return null;
    }
    const memberships = getBranchMembershipsByPhone(normalized);
    const branches = getBranches();
    const hasAccess =
      memberships.some((membership) => membership.branchId === branchId) ||
      branches.some(
        (branch) =>
          branch.id === branchId &&
          (branch.createdByPhone === normalized || branch.createdByEmployeeId === employee.id),
      );
    if (!hasAccess) {
      await wait();
      return null;
    }
    const updated = setEmployeeCurrentBranch(normalized, branchId);
    await wait();
    return updated;
  }

  async completeBranchSetup(phone: string, input: BranchSetupInput): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    const employee = getEmployees().find((item) => item.phone === normalized) ?? null;
    if (!employee) {
      await wait();
      return null;
    }

    let targetBranchId = "";
    if (input.mode === "select") {
      targetBranchId = input.branchId;
      addBranchMembership(targetBranchId, normalized, "staff");
    } else {
      let profileImageUrl = input.profileImageUrl ?? null;
      if (input.profileImageFile) {
        profileImageUrl = await fileToDataUrl(input.profileImageFile);
      }
      const created = createBranch({
        profileImageUrl,
        name: input.branchName.trim(),
        businessNumber: input.businessNumber.trim(),
        address: input.address ?? null,
        storePhone: input.storePhone ?? null,
        createdByPhone: normalized,
        createdByEmployeeId: employee.id,
      });
      targetBranchId = created.id;
      addBranchMembership(targetBranchId, normalized, "owner");
    }

    const updated = setEmployeeCurrentBranch(normalized, targetBranchId);
    if (!updated) {
      await wait();
      return null;
    }
    saveSession(updated);
    await wait();
    return updated;
  }

  async connectBranch(phone: string, branchId: string): Promise<boolean> {
    const normalized = normalizePhone(phone);
    const employee = getEmployees().find((item) => item.phone === normalized) ?? null;
    if (!employee) {
      await wait();
      return false;
    }
    addBranchMembership(branchId, normalized, "staff");
    await wait();
    return true;
  }

  async disconnectBranch(phone: string, branchId: string): Promise<boolean> {
    const normalized = normalizePhone(phone);
    const employee = getEmployees().find((item) => item.phone === normalized) ?? null;
    if (!employee) {
      await wait();
      return false;
    }
    const removed = removeBranchMembership(branchId, normalized);
    if (!removed) {
      await wait();
      return false;
    }
    const remain = getBranchMembershipsByPhone(normalized);
    if (employee.currentBranchId === branchId) {
      const nextDefault = remain[0]?.branchId ?? null;
      const updated = setEmployeeCurrentBranch(normalized, nextDefault);
      if (updated) {
        saveSession(updated);
      }
    }
    await wait();
    return true;
  }

  async updateMyCreatedBranch(
    branchId: string,
    actorPhone: string,
    patch: {
      name: string;
      businessNumber: string;
      address?: string | null;
      storePhone?: string | null;
      profileImageFile?: File | null;
    },
  ): Promise<Branch | null> {
    let profileImageUrl: string | null | undefined = undefined;
    if (patch.profileImageFile !== undefined) {
      profileImageUrl =
        patch.profileImageFile === null ? null : await fileToDataUrl(patch.profileImageFile);
    }
    const updated = updateBranchBasicFields(branchId, normalizePhone(actorPhone), {
      name: patch.name,
      businessNumber: patch.businessNumber,
      address: patch.address ?? null,
      storePhone: patch.storePhone ?? null,
      ...(profileImageUrl !== undefined ? { profileImageUrl } : {}),
    });
    await wait();
    return updated;
  }

  async deleteMyCreatedBranch(branchId: string, actorPhone: string): Promise<boolean> {
    const normalized = normalizePhone(actorPhone);
    const ok = deleteBranchByOwner(branchId, normalized);
    if (ok) {
      const activeBranches = getBranches();
      const activeBranchIds = new Set(activeBranches.map((branch) => branch.id));
      const nextFromMembership =
        getBranchMembershipsByPhone(normalized).find((m) => activeBranchIds.has(m.branchId))
          ?.branchId ?? null;
      const nextOwned =
        activeBranches.find((branch) => branch.createdByPhone === normalized)?.id ?? null;
      const nextDefault = nextFromMembership ?? nextOwned ?? null;
      const updated = setEmployeeCurrentBranch(normalized, nextDefault);
      if (updated) {
        saveSession(updated);
      }
    }
    await wait();
    return ok;
  }

  async listBranchMembers(branchId: string, actorPhone: string): Promise<BranchMemberListItem[]> {
    const normalized = normalizePhone(actorPhone);
    const actor = getEmployees().find((item) => item.phone === normalized) ?? null;
    const branch = getBranches().find((item) => item.id === branchId) ?? null;
    if (!actor || !branch) {
      await wait();
      return [];
    }
    const hasAccess =
      getBranchMembershipsByPhone(normalized).some((item) => item.branchId === branchId) ||
      branch.createdByPhone === normalized ||
      branch.createdByEmployeeId === actor.id;
    if (!hasAccess) {
      await wait();
      return [];
    }
    const rows = getBranchMembershipsForBranch(branchId);
    const employees = getEmployees();
    const items = rows.map((membership) => {
      const emp =
        employees.find(
          (employee) =>
            employee.id === membership.employeeId || employee.phone === membership.employeePhone,
        ) ?? null;
      return {
        membershipId: membership.id,
        employeeId: membership.employeeId,
        phone: emp?.phone ?? membership.employeePhone,
        name: membership.name,
        color: membership.color ?? "#22c55e",
        role: membership.role,
        joinedAt: membership.startedAt ?? null,
      };
    });
    await wait();
    return items;
  }

  async listFormerBranchMembers(
    branchId: string,
    actorPhone: string,
  ): Promise<BranchFormerMemberListItem[]> {
    const normalized = normalizePhone(actorPhone);
    const actor = getEmployees().find((item) => item.phone === normalized) ?? null;
    const branch = getBranches().find((item) => item.id === branchId) ?? null;
    if (!actor || !branch) {
      await wait();
      return [];
    }
    const hasAccess =
      getBranchMembershipsByPhone(normalized).some((item) => item.branchId === branchId) ||
      branch.createdByPhone === normalized ||
      branch.createdByEmployeeId === actor.id;
    if (!hasAccess) {
      await wait();
      return [];
    }
    await wait();
    return [];
  }

  async updateBranchMemberJoinedAt(
    branchId: string,
    membershipId: string,
    joinedAtIso: string,
    actorPhone: string,
  ): Promise<boolean> {
    const access = localResolveActorBranchRole(branchId, actorPhone);
    if (!localIsManagerUp(access)) {
      await wait();
      return false;
    }
    const rows = getBranchMembershipsForBranch(branchId);
    const target = rows.find((membership) => membership.id === membershipId);
    if (!target) {
      await wait();
      return false;
    }
    const updated = persistBranchMemberJoinedAt(membershipId, joinedAtIso);
    await wait();
    return Boolean(updated);
  }

  async updateBranchMemberRole(
    branchId: string,
    membershipId: string,
    newRole: BranchRole,
    actorPhone: string,
  ): Promise<boolean> {
    const access = localResolveActorBranchRole(branchId, actorPhone);
    if (!localIsManagerUp(access)) {
      await wait();
      return false;
    }
    const rows = getBranchMembershipsForBranch(branchId);
    const target = rows.find((membership) => membership.id === membershipId);
    if (!target) {
      await wait();
      return false;
    }
    const actorIsOwner = localIsOwnerAccess(access);
    if (!actorIsOwner) {
      if (target.role !== "staff") {
        await wait();
        return false;
      }
      if (newRole === "owner") {
        await wait();
        return false;
      }
    }
    if (newRole === "owner" && !actorIsOwner) {
      await wait();
      return false;
    }
    if (target.role === "owner" && newRole !== "owner" && localCountOwners(branchId) <= 1) {
      await wait();
      return false;
    }
    const updated = updateBranchMembershipRole(membershipId, newRole);
    await wait();
    return Boolean(updated);
  }

  async updateBranchMemberColor(
    branchId: string,
    membershipId: string,
    nextColor: string,
    actorPhone: string,
  ): Promise<boolean> {
    const access = localResolveActorBranchRole(branchId, actorPhone);
    if (!localIsManagerUp(access)) {
      await wait();
      return false;
    }
    const rows = getBranchMembershipsForBranch(branchId);
    const target = rows.find((membership) => membership.id === membershipId);
    if (!target) {
      await wait();
      return false;
    }
    const updated = updateBranchMembershipColor(membershipId, nextColor);
    await wait();
    return Boolean(updated);
  }

  async updateBranchMemberName(
    branchId: string,
    membershipId: string,
    name: string | null,
    actorPhone: string,
  ): Promise<boolean> {
    const access = localResolveActorBranchRole(branchId, actorPhone);
    if (!localIsManagerUp(access)) {
      await wait();
      return false;
    }
    const rows = getBranchMembershipsForBranch(branchId);
    const target = rows.find((membership) => membership.id === membershipId);
    if (!target) {
      await wait();
      return false;
    }
    const emp =
      getEmployees().find((item) => item.id === target.employeeId) ??
      getEmployees().find((item) => item.phone === target.employeePhone) ??
      null;
    const updated = persistBranchMemberName(
      membershipId,
      name,
      emp?.name ?? BRANCH_MEMBER_FALLBACK,
    );
    await wait();
    return Boolean(updated);
  }

  async terminateBranchMember(
    branchId: string,
    membershipId: string,
    actorPhone: string,
  ): Promise<boolean> {
    const access = localResolveActorBranchRole(branchId, actorPhone);
    if (!localIsManagerUp(access)) {
      await wait();
      return false;
    }
    const rows = getBranchMembershipsForBranch(branchId);
    const target = rows.find((membership) => membership.id === membershipId);
    if (!target) {
      await wait();
      return false;
    }
    const actorIsOwner = localIsOwnerAccess(access);
    if (!actorIsOwner && target.role !== "staff") {
      await wait();
      return false;
    }
    if (target.role === "owner" && !actorIsOwner) {
      await wait();
      return false;
    }
    if (target.role === "owner" && localCountOwners(branchId) <= 1) {
      await wait();
      return false;
    }
    const ok = removeBranchMembership(branchId, target.employeePhone);
    await wait();
    return ok;
  }

  async inviteStaffMember(
    branchId: string,
    inviteePhone: string,
    actorPhone: string,
    displayName?: string | null,
  ): Promise<boolean> {
    const access = localResolveActorBranchRole(branchId, actorPhone);
    if (!localIsManagerUp(access)) {
      await wait();
      return false;
    }
    const normalized = normalizePhone(inviteePhone);
    if (!normalized) {
      await wait();
      return false;
    }
    const displayTrimmed = displayName?.trim() ?? "";
    upsertEmployee(normalized, displayTrimmed === "" ? undefined : displayTrimmed);
    addBranchMembership(branchId, normalized, "staff", displayTrimmed || null);
    await wait();
    return true;
  }

  async updateMyProfileName(phone: string, name: string): Promise<Employee | null> {
    const updated = updateEmployeeName(normalizePhone(phone), name);
    await wait();
    return updated;
  }

  async updateMyProfileAvatar(phone: string, file: File | null): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    const url = file === null ? null : await fileToDataUrl(file);
    const updated = updateEmployeeAvatar(normalized, url);
    await wait();
    return updated;
  }

  async uploadNoticeAttachmentFiles(
    _noticeId: string,
    _actorPhone: string,
    _files: File[],
  ): Promise<string[]> {
    await wait();
    return [];
  }

  async logout(): Promise<void> {
    clearSession();
    await wait();
  }

  async checkInCurrent(session: Employee, branchId: string | null): Promise<void> {
    const membership =
      branchId === null
        ? null
        : (getBranchMembershipsForBranch(branchId).find(
            (item) => item.employeeId === session.id || item.employeePhone === session.phone,
          ) ?? null);
    checkIn({ ...session, name: membership?.name ?? session.name }, branchId);
    await wait();
  }

  async checkOutCurrent(recordId: string): Promise<void> {
    checkOut(recordId);
    await wait();
  }

  async updatePunchRecord(
    recordId: string,
    next: { checkedInAt: string; checkedOutAt: string | null },
    actorPhone: string,
  ): Promise<boolean> {
    const session = getSession();
    if (!session || normalizePhone(session.phone) !== normalizePhone(actorPhone)) {
      await wait();
      return false;
    }
    const updated = updatePunchRecordTimes(recordId, next.checkedInAt, next.checkedOutAt);
    await wait();
    return updated !== null;
  }

  async createPunchRecord(
    input: Omit<PunchRecord, "id">,
    actorPhone: string,
  ): Promise<PunchRecord | null> {
    const branchId = input.branchId ?? null;
    if (!branchId) {
      await wait();
      return null;
    }
    const access = localResolveActorBranchRole(branchId, actorPhone);
    if (!localIsManagerUp(access)) {
      await wait();
      return null;
    }
    const created = addPunchRecord(input);
    await wait();
    return created;
  }

  async deletePunchRecord(recordId: string, actorPhone: string): Promise<boolean> {
    const target = getPunches().find((record) => record.id === recordId) ?? null;
    if (!target) {
      await wait();
      return false;
    }
    const branchId = target.branchId ?? null;
    if (!branchId) {
      await wait();
      return false;
    }
    const access = localResolveActorBranchRole(branchId, actorPhone);
    if (!localIsManagerUp(access)) {
      await wait();
      return false;
    }
    const ok = deletePunchRecord(recordId);
    await wait();
    return ok;
  }

  async getDashboard(): Promise<DashboardData> {
    if (this.dashboardInFlight) {
      return this.dashboardInFlight;
    }
    const request = (async () => {
      const session = getSession();
      const branches = getBranches();
      const myBranchMemberships = session ? getBranchMembershipsByPhone(session.phone) : [];
      const myBranchIds = new Set(myBranchMemberships.map((membership) => membership.branchId));
      const myBranches = session
        ? branches.filter(
            (branch) =>
              myBranchIds.has(branch.id) ||
              branch.createdByPhone === session.phone ||
              branch.createdByEmployeeId === session.id,
          )
        : [];
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
              (shift.employeeId === session.id || shift.employeePhone === session.phone) &&
              isToday(shift.startAt),
          ) ?? null)
        : null;
      const currentWorker =
        shifts.find(
          (shift) =>
            new Date(shift.startAt).getTime() <= nowMs && new Date(shift.endAt).getTime() >= nowMs,
        ) ?? null;
      const nextWorker = shifts.find((shift) => new Date(shift.startAt).getTime() > nowMs) ?? null;

      const myTodayRecords = session
        ? todayPunches
            .filter(
              (record) =>
                record.employeeId === session.id || record.employeePhone === session.phone,
            )
            .sort((a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime())
        : [];
      const myTodayHours = myTodayRecords.reduce((sum, record) => {
        const endAt = record.checkedOutAt ?? new Date(nowMs).toISOString();
        return sum + durationHours(record.checkedInAt, endAt);
      }, 0);

      await wait();
      return {
        session,
        branches,
        myBranches,
        myBranchMemberships,
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
    })();
    this.dashboardInFlight = request;
    try {
      return await request;
    } finally {
      if (this.dashboardInFlight === request) {
        this.dashboardInFlight = null;
      }
    }
  }

  async getHistory(): Promise<PunchRecord[]> {
    await wait();
    return getPunches();
  }

  async getCalendarEvents(): Promise<CalendarEvent[]> {
    await wait();
    return getCalendarEvents();
  }

  async createCalendarEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    const created = addCalendarEvent(event);
    await wait();
    return created;
  }

  async updateCalendarEvent(
    eventId: string,
    payload: Partial<Pick<CalendarEvent, "title" | "color" | "branchId">>,
  ): Promise<CalendarEvent | null> {
    const updated = updateCalendarEvent(eventId, payload);
    await wait();
    return updated;
  }

  async deleteCalendarEvent(eventId: string): Promise<void> {
    deleteCalendarEvent(eventId);
    await wait();
  }

  async listNotices(branchId: string): Promise<Notice[]> {
    const notices = getNotices().filter((notice) => notice.branchId === branchId);
    const attachments = getNoticeAttachments();
    const attachByNotice = new Map<string, NoticeAttachment[]>();
    for (const item of attachments) {
      const current = attachByNotice.get(item.noticeId) ?? [];
      current.push(item);
      attachByNotice.set(item.noticeId, current);
    }
    await wait();
    return notices
      .map((notice) => ({
        ...notice,
        attachments: (attachByNotice.get(notice.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      .sort(
        (a, b) =>
          Number(b.isPinned) - Number(a.isPinned) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  async createNotice(branchId: string, input: NoticeInput, actorPhone: string): Promise<Notice | null> {
    const actor = getEmployees().find((employee) => employee.phone === normalizePhone(actorPhone)) ?? null;
    if (!actor) {
      await wait();
      return null;
    }
    const created = createNoticeLocal({
      branchId,
      authorEmployeeId: actor.id,
      authorName: actor.name,
      title: input.title.trim(),
      content: input.content.trim(),
      isPinned: input.isPinned,
      attachments: input.attachments,
    });
    await wait();
    return created;
  }

  async updateNotice(
    noticeId: string,
    input: NoticeInput,
    actorPhone: string,
  ): Promise<Notice | null> {
    const actor = getEmployees().find((employee) => employee.phone === normalizePhone(actorPhone)) ?? null;
    const target = getNotices().find((notice) => notice.id === noticeId) ?? null;
    if (!actor || !target) {
      await wait();
      return null;
    }
    const actorAccess = localResolveActorBranchRole(target.branchId, actorPhone);
    const memberships = getBranchMembershipsForBranch(target.branchId);
    const authorMembership =
      memberships.find((membership) => membership.employeeId === target.authorEmployeeId) ?? null;
    const authorRole = authorMembership?.role ?? null;
    const isAuthor = actor.id === target.authorEmployeeId;
    if (!canEditNoticeByRole(actorAccess, authorRole, isAuthor)) {
      await wait();
      return null;
    }
    const updated = updateNoticeLocal(noticeId, {
      title: input.title.trim(),
      content: input.content.trim(),
      isPinned: input.isPinned,
      attachments: input.attachments,
    });
    await wait();
    return updated;
  }

  async deleteNotice(noticeId: string, actorPhone: string): Promise<boolean> {
    const actor = getEmployees().find((employee) => employee.phone === normalizePhone(actorPhone)) ?? null;
    const target = getNotices().find((notice) => notice.id === noticeId) ?? null;
    if (!actor || !target) {
      await wait();
      return false;
    }
    const actorAccess = localResolveActorBranchRole(target.branchId, actorPhone);
    const memberships = getBranchMembershipsForBranch(target.branchId);
    const authorMembership =
      memberships.find((membership) => membership.employeeId === target.authorEmployeeId) ?? null;
    const authorRole = authorMembership?.role ?? null;
    const isAuthor = actor.id === target.authorEmployeeId;
    if (!canEditNoticeByRole(actorAccess, authorRole, isAuthor)) {
      await wait();
      return false;
    }
    const ok = deleteNoticeLocal(noticeId);
    await wait();
    return ok;
  }

  async getSchedule(): Promise<Shift[]> {
    await wait();
    return getShifts();
  }

  async getSchedulePeople(): Promise<SchedulePersonRecord[]> {
    await wait();
    const branchId = getSession()?.currentBranchId ?? null;
    if (!branchId) {
      return getEmployees().map((employee) => ({
        id: employee.id,
        name: employee.name,
        employeePhone: employee.phone,
        color: "#22c55e",
      }));
    }

    const memberByEmpId = new Map(
      getBranchMembershipsForBranch(branchId).map((m) => [m.employeeId, m]),
    );
    const rows: SchedulePersonRecord[] = [];
    for (const employee of getEmployees()) {
      const membership = memberByEmpId.get(employee.id);
      if (!membership) {
        continue;
      }
      const hex = membership.color?.trim();
      rows.push({
        id: employee.id,
        name: membership.name,
        employeePhone: employee.phone,
        color: hex ? hex : "#22c55e",
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return rows;
  }

  async createSchedulePerson(input: {
    name: string;
    employeePhone: string;
    color: string;
  }): Promise<SchedulePersonRecord> {
    const phone = normalizePhone(input.employeePhone);
    const employee = upsertEmployee(phone, input.name.trim());
    await wait();
    return {
      id: employee.id,
      name: employee.name,
      employeePhone: employee.phone,
      color: input.color,
    };
  }

  async updateSchedulePerson(
    personId: string,
    input: { name: string; employeePhone: string; color: string },
  ): Promise<SchedulePersonRecord | null> {
    const normalized = normalizePhone(input.employeePhone);
    const employee =
      getEmployees().find((item) => item.id === personId) ??
      getEmployees().find((item) => item.phone === normalized) ??
      null;
    if (!employee) {
      await wait();
      return null;
    }
    const updated = updateEmployeeName(employee.phone, input.name.trim());
    await wait();
    if (!updated) {
      return null;
    }
    return {
      id: updated.id,
      name: updated.name,
      employeePhone: normalized,
      color: input.color,
    };
  }

  async deleteSchedulePerson(personId: string): Promise<void> {
    // local fallback keeps legacy behavior (no employee delete API yet)
    await wait();
    void personId;
  }

  /**
   * 타임라인용 오늘 근무 목록 (실데이터만 사용).
   */
  async getTimelineShifts(nowIso: string, shifts: Shift[]): Promise<Shift[]> {
    void nowIso;
    const today = shifts.filter((shift) => isToday(shift.startAt));
    await wait();
    return today;
  }

  async createShift(shift: Omit<Shift, "id">): Promise<Shift> {
    const resolvedBranchId = shift.branchId ?? getSession()?.currentBranchId ?? null;
    const created = addShift({
      ...shift,
      branchId: resolvedBranchId,
    });
    await wait();
    return created;
  }

  async createShifts(shifts: Omit<Shift, "id">[]): Promise<string[]> {
    const defaultBranchId = getSession()?.currentBranchId ?? null;
    const ids = addShifts(
      shifts.map((shift) => ({
        ...shift,
        branchId: shift.branchId ?? defaultBranchId,
      })),
    );
    await wait();
    return ids;
  }

  async updateShift(
    shiftId: string,
    payload: Partial<
      Pick<
        Shift,
        "employeeId" | "employeeName" | "employeePhone" | "branchId" | "startAt" | "endAt"
      >
    >,
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
      if (!record.checkedOutAt || !isWithinWeek(record.checkedInAt, weekStart)) {
        continue;
      }
      const key = record.employeePhone;
      const current = map.get(key) ?? {
        phone: record.employeePhone,
        name: record.employeeName,
        totalHours: 0,
        shiftCount: 0,
      };
      current.totalHours += durationHours(record.checkedInAt, record.checkedOutAt);
      current.shiftCount += 1;
      map.set(key, current);
    }

    const rows = [...map.values()].sort((a, b) => b.totalHours - a.totalHours);
    const totalHours = rows.reduce((sum, row) => sum + row.totalHours, 0);
    await wait();
    return { rows, totalHours };
  }

  async getRangeWorkStats(
    startDate: string,
    endDate: string,
  ): Promise<{
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

    const built = buildRangeWorkStatsFromPunches(getPunches(), start, end);
    await wait();
    return { rows: built.rows, totalSeconds: built.totalSeconds };
  }
}

class SupabaseWorkApi {
  private supabase = getSupabaseBrowserClient();
  private dashboardInFlight: Promise<DashboardData> | null = null;

  async init(): Promise<void> {
    await wait();
  }

  private async ensureAuthUser(): Promise<void> {
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    if (session) {
      return;
    }
    await this.supabase.auth.signInAnonymously();
  }

  private async setAuthPhone(phone: string): Promise<void> {
    await this.ensureAuthUser();
    const { error } = await this.supabase.auth.updateUser({
      data: { phone },
    });
    if (error) {
      throw new Error(error.message);
    }
    // Storage RLS는 요청 JWT를 본다. 메타데이터만 바뀐 경우 refresh 후에야 user_metadata.phone 이 반영된다.
    const { error: refreshError } = await this.supabase.auth.refreshSession();
    if (refreshError) {
      throw new Error(refreshError.message);
    }
  }

  private async getSessionEmployeeFromAuth(): Promise<Employee | null> {
    await this.ensureAuthUser();
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    const phone = String(user?.user_metadata?.phone ?? "").trim();
    if (!phone) {
      return null;
    }
    const { data } = await this.supabase
      .from("employees")
      .select("*")
      .eq("phone", phone)
      .is("deleted_at", null)
      .maybeSingle();
    if (data) {
      return mapEmployeeRow(data as Record<string, unknown>);
    }
    // auth 메타(phone)는 있는데 직원 행이 없으면 잘못된/만료 세션으로 간주하고 토큰 정리.
    await this.supabase.auth.signOut();
    clearSession();
    return null;
  }

  private async getEmployeesRemote(): Promise<Employee[]> {
    const { data } = await this.supabase
      .from("employees")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    return (data ?? []).map((row) => mapEmployeeRow(row as Record<string, unknown>));
  }

  /**
   * 직원 행 삽입/갱신. `markDisplayNameConfirmed` 가 true일 때만 `display_name_confirmed_at` 를 갱신한다.
   * 기존 행은 false일 때 확정 시각을 건드리지 않는다.
   */
  private async upsertEmployeeByPhone(input: {
    phone: string;
    name: string;
    markDisplayNameConfirmed?: boolean;
  }): Promise<Employee> {
    const normalized = normalizePhone(input.phone);
    const { data: rowRaw } = await this.supabase
      .from("employees")
      .select("*")
      .eq("phone", normalized)
      .maybeSingle();
    const nowIso = new Date().toISOString();

    if (!rowRaw) {
      const { data: inserted, error } = await this.supabase
        .from("employees")
        .insert({
          phone: normalized,
          name: input.name.trim(),
          deleted_at: null,
          display_name_confirmed_at: input.markDisplayNameConfirmed ? nowIso : null,
        } as never)
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      return mapEmployeeRow(inserted as Record<string, unknown>);
    }

    const row = rowRaw as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      name: input.name.trim(),
      deleted_at: null,
    };
    if (input.markDisplayNameConfirmed) {
      patch.display_name_confirmed_at = nowIso;
    }
    const { data: updated, error: updateError } = await this.supabase
      .from("employees")
      .update(patch as never)
      .eq("id", String(row.id))
      .select("*")
      .single();
    if (updateError) {
      throw new Error(updateError.message);
    }
    return mapEmployeeRow(updated as Record<string, unknown>);
  }

  private async getBranchesRemote(): Promise<Branch[]> {
    const { data } = await this.supabase
      .from("branches")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    const rows = data ?? [];
    const creatorIds = [
      ...new Set(
        rows
          .map((r) => String((r as Record<string, unknown>).created_by_employee_id ?? ""))
          .filter(Boolean),
      ),
    ];
    const phoneById = new Map<string, string>();
    if (creatorIds.length > 0) {
      const { data: creators } = await this.supabase
        .from("employees")
        .select("id, phone")
        .in("id", creatorIds)
        .is("deleted_at", null);
      for (const row of creators ?? []) {
        const er = row as Record<string, unknown>;
        phoneById.set(String(er.id), String(er.phone));
      }
    }
    return rows.map((row) => {
      const rec = row as Record<string, unknown>;
      const cid = String(rec.created_by_employee_id ?? "");
      return mapBranchRow(rec, phoneById.get(cid));
    });
  }

  private async getBranchMembershipsByPhoneRemote(phone: string): Promise<BranchMembership[]> {
    const normalized = normalizePhone(phone);
    const employee = await this.getEmployeeByPhone(normalized);
    if (!employee?.id) {
      return [];
    }
    const { data } = await this.supabase
      .from("branch_memberships")
      .select("*")
      .eq("employee_id", employee.id)
      .is("ended_at", null)
      .is("deleted_at", null);
    return (data ?? []).map((row) =>
      mapBranchMembershipRow(row as Record<string, unknown>, normalized, employee.name),
    );
  }

  private async resolveActorBranchAccess(
    branchId: string,
    actorPhone: string,
  ): Promise<ActorBranchAccess> {
    const normalized = normalizePhone(actorPhone);
    const actor = await this.getEmployeeByPhone(normalized);
    if (!actor?.id) {
      return null;
    }
    const { data: membership } = await this.supabase
      .from("branch_memberships")
      .select("role")
      .eq("branch_id", branchId)
      .eq("employee_id", actor.id)
      .is("ended_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (membership) {
      return {
        role: mapBranchRole(String((membership as Record<string, unknown>).role)),
      };
    }
    const { data: branch } = await this.supabase
      .from("branches")
      .select("created_by_employee_id")
      .eq("id", branchId)
      .is("deleted_at", null)
      .maybeSingle();
    const cid = branch
      ? String((branch as Record<string, unknown>).created_by_employee_id ?? "")
      : "";
    if (cid && cid === actor.id) {
      return "creator";
    }
    return null;
  }

  private supabaseIsOwnerAccess(access: ActorBranchAccess): boolean {
    return access === "creator" || access?.role === "owner";
  }

  private supabaseIsManagerUp(access: ActorBranchAccess): boolean {
    return access === "creator" || access?.role === "owner" || access?.role === "manager";
  }

  private async getShiftsRemote(): Promise<Shift[]> {
    const { data } = await this.supabase
      .from("shifts")
      .select("*, employee:employees!employee_id(phone)")
      .is("deleted_at", null)
      .order("start_at", { ascending: true });
    return (data ?? []).map((row) => mapShiftRow(row as Record<string, unknown>));
  }

  private async getPunchesRemote(): Promise<PunchRecord[]> {
    const { data } = await this.supabase
      .from("punch_records")
      .select("*, employee:employees!employee_id(phone)")
      .is("deleted_at", null)
      .order("checked_in_at", { ascending: false });
    return (data ?? []).map((row) => mapPunchRow(row as Record<string, unknown>));
  }

  private async getCalendarEventsRemote(): Promise<CalendarEvent[]> {
    const { data } = await this.supabase
      .from("calendar_events")
      .select("*")
      .is("deleted_at", null)
      .order("date", { ascending: true });
    return (data ?? []).map((row) => mapEventRow(row as Record<string, unknown>));
  }

  async login(phone: string): Promise<Employee> {
    const normalized = normalizePhone(phone);
    await this.ensureAuthUser();
    await this.setAuthPhone(normalized);
    const { data: rowRaw } = await this.supabase
      .from("employees")
      .select("*")
      .eq("phone", normalized)
      .maybeSingle();
    const row = rowRaw as Record<string, unknown> | null;
    if (!row) {
      const defaultName = `직원-${normalized.slice(-4)}`;
      const { data: created } = await this.supabase
        .from("employees")
        .insert({
          phone: normalized,
          name: defaultName,
          display_name_confirmed_at: null,
        } as never)
        .select("*")
        .single();
      await wait();
      return created
        ? mapEmployeeRow(created as Record<string, unknown>)
        : { id: "", phone: normalized, name: defaultName };
    }
    if (row.deleted_at) {
      const { data: revived } = await this.supabase
        .from("employees")
        .update({ deleted_at: null } as never)
        .eq("id", String(row.id))
        .select("*")
        .single();
      await wait();
      return revived
        ? mapEmployeeRow(revived as Record<string, unknown>)
        : mapEmployeeRow(row as Record<string, unknown>);
    }
    await wait();
    return mapEmployeeRow(row as Record<string, unknown>);
  }

  async getEmployeeByPhone(phone: string): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    const { data } = await this.supabase
      .from("employees")
      .select("*")
      .eq("phone", normalized)
      .is("deleted_at", null)
      .maybeSingle();
    await wait();
    return data ? mapEmployeeRow(data as Record<string, unknown>) : null;
  }

  async getBranches(): Promise<Branch[]> {
    const rows = await this.getBranchesRemote();
    await wait();
    return rows;
  }

  async getMyBranchMemberships(phone: string): Promise<BranchMembership[]> {
    const normalized = normalizePhone(phone);
    const rows = await this.getBranchMembershipsByPhoneRemote(normalized);
    await wait();
    return rows;
  }

  async setCurrentBranch(phone: string, branchId: string): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    const employee = await this.getEmployeeByPhone(normalized);
    if (!employee) {
      await wait();
      return null;
    }
    const [memberships, branches] = await Promise.all([
      this.getMyBranchMemberships(normalized),
      this.getBranchesRemote(),
    ]);
    const hasAccess =
      memberships.some((membership) => membership.branchId === branchId) ||
      branches.some(
        (branch) =>
          branch.id === branchId &&
          (branch.createdByPhone === normalized || branch.createdByEmployeeId === employee.id),
      );
    if (!hasAccess) {
      await wait();
      return null;
    }
    await this.supabase
      .from("employees")
      .update({ current_branch_id: branchId } as never)
      .eq("phone", normalized);
    const updated = await this.getEmployeeByPhone(normalized);
    await wait();
    return updated;
  }

  async completeBranchSetup(phone: string, input: BranchSetupInput): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    const employee = await this.getEmployeeByPhone(normalized);
    if (!employee) {
      await wait();
      return null;
    }

    let branchId = "";
    if (input.mode === "select") {
      branchId = input.branchId;
      const { data: existingMembership } = await this.supabase
        .from("branch_memberships")
        .select("id")
        .eq("branch_id", branchId)
        .eq("employee_id", employee.id)
        .is("ended_at", null)
        .is("deleted_at", null)
        .maybeSingle();
      if (!existingMembership) {
        await this.supabase.from("branch_memberships").insert({
          branch_id: branchId,
          employee_id: employee.id,
          role: "staff",
          nickname: branchMemberName(null, employee.name),
        } as never);
      }
    } else {
      const { data: createdBranch } = await this.supabase
        .from("branches")
        .insert({
          profile_image_url: null,
          name: input.branchName.trim(),
          business_number: input.businessNumber.trim(),
          address: input.address ?? null,
          store_phone: input.storePhone ?? null,
          created_by_employee_id: employee.id,
        } as never)
        .select("*")
        .single();
      const createdBranchRow = createdBranch as Record<string, unknown> | null;
      branchId = createdBranchRow ? String(createdBranchRow.id) : "";
      if (!branchId) {
        await wait();
        return employee;
      }
      let profileUrl: string | null = null;
      if (input.profileImageFile) {
        await this.ensureAuthUser();
        await this.setAuthPhone(normalized);
        const path = newBranchProfileStoragePath(branchId, input.profileImageFile);
        profileUrl = await uploadPublicImage(path, input.profileImageFile);
      } else if (
        input.profileImageUrl &&
        !input.profileImageUrl.startsWith("data:") &&
        input.profileImageUrl.trim() !== ""
      ) {
        profileUrl = input.profileImageUrl.trim();
      }
      if (profileUrl !== null) {
        await this.supabase
          .from("branches")
          .update({ profile_image_url: profileUrl } as never)
          .eq("id", branchId);
      }
      await this.supabase.from("branch_memberships").insert({
        branch_id: branchId,
        employee_id: employee.id,
        role: "owner",
        nickname: branchMemberName(null, employee.name),
      } as never);
    }

    await this.supabase
      .from("employees")
      .update({ current_branch_id: branchId } as never)
      .eq("phone", normalized);
    const updated = await this.getEmployeeByPhone(normalized);
    await wait();
    return updated;
  }

  async connectBranch(phone: string, branchId: string): Promise<boolean> {
    const normalized = normalizePhone(phone);
    const employee = await this.getEmployeeByPhone(normalized);
    if (!employee) {
      await wait();
      return false;
    }
    const { data: existingMembership } = await this.supabase
      .from("branch_memberships")
      .select("id")
      .eq("branch_id", branchId)
      .eq("employee_id", employee.id)
      .is("ended_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (existingMembership) {
      await wait();
      return true;
    }
    const { error } = await this.supabase.from("branch_memberships").insert({
      branch_id: branchId,
      employee_id: employee.id,
      role: "staff",
      nickname: branchMemberName(null, employee.name),
    } as never);
    await wait();
    return !error;
  }

  async updateBranchMemberColor(
    branchId: string,
    membershipId: string,
    nextColor: string,
    actorPhone: string,
  ): Promise<boolean> {
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    if (!this.supabaseIsManagerUp(access)) {
      await wait();
      return false;
    }
    const { data: targetRaw } = await this.supabase
      .from("branch_memberships")
      .select("id")
      .eq("id", membershipId)
      .eq("branch_id", branchId)
      .is("ended_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (!targetRaw) {
      await wait();
      return false;
    }
    const { error } = await this.supabase
      .from("branch_memberships")
      .update({ color: nextColor } as never)
      .eq("id", membershipId)
      .eq("branch_id", branchId);
    await wait();
    return !error;
  }

  async updateBranchMemberName(
    branchId: string,
    membershipId: string,
    name: string | null,
    actorPhone: string,
  ): Promise<boolean> {
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    if (!this.supabaseIsManagerUp(access)) {
      await wait();
      return false;
    }
    const { data: targetRaw } = await this.supabase
      .from("branch_memberships")
      .select("id, employee:employees!employee_id ( name )")
      .eq("id", membershipId)
      .eq("branch_id", branchId)
      .is("ended_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (!targetRaw) {
      await wait();
      return false;
    }
    const emp = (targetRaw as Record<string, unknown>).employee as
      | Record<string, unknown>
      | null
      | undefined;
    const accountName = emp && typeof emp.name === "string" ? emp.name : "직원";
    const stored = branchMemberName(name, accountName);
    const { error } = await this.supabase
      .from("branch_memberships")
      .update({ nickname: stored } as never)
      .eq("id", membershipId)
      .eq("branch_id", branchId);
    await wait();
    return !error;
  }

  async updateBranchMemberJoinedAt(
    branchId: string,
    membershipId: string,
    joinedAtIso: string,
    actorPhone: string,
  ): Promise<boolean> {
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    if (!this.supabaseIsManagerUp(access)) {
      await wait();
      return false;
    }
    const { data: targetRaw } = await this.supabase
      .from("branch_memberships")
      .select("id")
      .eq("id", membershipId)
      .eq("branch_id", branchId)
      .is("ended_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (!targetRaw) {
      await wait();
      return false;
    }
    const { error } = await this.supabase
      .from("branch_memberships")
      .update({ started_at: joinedAtIso } as never)
      .eq("id", membershipId)
      .eq("branch_id", branchId);
    await wait();
    return !error;
  }

  async disconnectBranch(phone: string, branchId: string): Promise<boolean> {
    const normalized = normalizePhone(phone);
    const employee = await this.getEmployeeByPhone(normalized);
    if (!employee) {
      await wait();
      return false;
    }
    const { data: membership } = await this.supabase
      .from("branch_memberships")
      .select("id")
      .eq("branch_id", branchId)
      .eq("employee_id", employee.id)
      .is("ended_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (!membership) {
      await wait();
      return false;
    }
    const { error } = await this.supabase
      .from("branch_memberships")
      .update({ ended_at: new Date().toISOString() } as never)
      .eq("id", String((membership as Record<string, unknown>).id));
    if (error) {
      await wait();
      return false;
    }
    if (employee.currentBranchId === branchId) {
      const remain = await this.getMyBranchMemberships(normalized);
      const nextDefault = remain[0]?.branchId ?? null;
      await this.supabase
        .from("employees")
        .update({ current_branch_id: nextDefault } as never)
        .eq("phone", normalized);
    }
    await wait();
    return true;
  }

  async updateMyCreatedBranch(
    branchId: string,
    actorPhone: string,
    patch: {
      name: string;
      businessNumber: string;
      address?: string | null;
      storePhone?: string | null;
      profileImageFile?: File | null;
    },
  ): Promise<Branch | null> {
    const normalized = normalizePhone(actorPhone);
    const actor = await this.getEmployeeByPhone(normalized);
    if (!actor?.id) {
      await wait();
      return null;
    }
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    if (!this.supabaseIsOwnerAccess(access)) {
      await wait();
      return null;
    }
    const { data: branchRow } = await this.supabase
      .from("branches")
      .select("*")
      .eq("id", branchId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!branchRow) {
      await wait();
      return null;
    }
    const addressTrimmed = patch.address?.trim() ?? "";
    const storeTrimmed = patch.storePhone?.trim() ?? "";
    let profileImageUrl: string | null | undefined = undefined;
    if (patch.profileImageFile !== undefined) {
      await this.ensureAuthUser();
      await this.setAuthPhone(normalized);
      if (patch.profileImageFile === null) {
        profileImageUrl = null;
      } else {
        const path = newBranchProfileStoragePath(branchId, patch.profileImageFile);
        profileImageUrl = await uploadPublicImage(path, patch.profileImageFile);
      }
    }
    const { data: updated } = await this.supabase
      .from("branches")
      .update({
        name: patch.name.trim(),
        business_number: patch.businessNumber.trim(),
        address: addressTrimmed ? addressTrimmed : null,
        store_phone: storeTrimmed ? storeTrimmed : null,
        ...(profileImageUrl !== undefined ? { profile_image_url: profileImageUrl } : {}),
      } as never)
      .eq("id", branchId)
      .select("*")
      .maybeSingle();
    await wait();
    return updated ? mapBranchRow(updated as Record<string, unknown>, actor.phone) : null;
  }

  async deleteMyCreatedBranch(branchId: string, actorPhone: string): Promise<boolean> {
    const normalized = normalizePhone(actorPhone);
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    if (!this.supabaseIsOwnerAccess(access)) {
      await wait();
      return false;
    }
    const { data: branch } = await this.supabase
      .from("branches")
      .select("id")
      .eq("id", branchId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!branch) {
      await wait();
      return false;
    }
    await this.supabase
      .from("employees")
      .update({ current_branch_id: null } as never)
      .eq("current_branch_id", branchId);
    const { error } = await this.supabase
      .from("branches")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", branchId);
    if (!error) {
      const actor = await this.getEmployeeByPhone(normalized);
      if (actor?.id) {
        const activeBranches = await this.getBranchesRemote();
        const activeBranchIds = new Set(activeBranches.map((item) => item.id));
        const memberships = await this.getBranchMembershipsByPhoneRemote(normalized);
        const nextFromMembership =
          memberships.find((m) => activeBranchIds.has(m.branchId))?.branchId ?? null;
        const nextOwned =
          activeBranches.find(
            (branchRow) =>
              branchRow.createdByPhone === normalized || branchRow.createdByEmployeeId === actor.id,
          )?.id ?? null;
        const nextDefault = nextFromMembership ?? nextOwned ?? null;
        await this.supabase
          .from("employees")
          .update({ current_branch_id: nextDefault } as never)
          .eq("id", actor.id);
      }
    }
    await wait();
    return !error;
  }

  async listBranchMembers(branchId: string, actorPhone: string): Promise<BranchMemberListItem[]> {
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    if (!access) {
      await wait();
      return [];
    }
    const { data, error } = await this.supabase
      .from("branch_memberships")
      .select(
        "id, role, color, nickname, employee_id, started_at, created_at, employee:employees!employee_id ( phone, name )",
      )
      .eq("branch_id", branchId)
      .is("ended_at", null)
      .is("deleted_at", null)
      .order("started_at", { ascending: true });
    if (error) {
      await wait();
      return [];
    }
    await wait();
    return (data ?? []).map((row) => mapBranchMemberListRow(row as Record<string, unknown>));
  }

  async listFormerBranchMembers(
    branchId: string,
    actorPhone: string,
  ): Promise<BranchFormerMemberListItem[]> {
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    if (!access) {
      await wait();
      return [];
    }
    const { data: activeRows } = await this.supabase
      .from("branch_memberships")
      .select("employee_id")
      .eq("branch_id", branchId)
      .is("ended_at", null)
      .is("deleted_at", null);
    const activeEmployeeIds = new Set(
      (activeRows ?? []).map((row) => String((row as Record<string, unknown>).employee_id)),
    );

    const { data, error } = await this.supabase
      .from("branch_memberships")
      .select(
        "id, role, color, nickname, employee_id, created_at, ended_at, employee:employees!employee_id ( phone, name )",
      )
      .eq("branch_id", branchId)
      .not("ended_at", "is", null)
      .is("deleted_at", null)
      .order("ended_at", { ascending: false });
    if (error) {
      await wait();
      return [];
    }
    await wait();
    return (data ?? [])
      .map((row) => mapBranchFormerMemberListRow(row as Record<string, unknown>))
      .filter((row) => !activeEmployeeIds.has(row.employeeId));
  }

  async updateBranchMemberRole(
    branchId: string,
    membershipId: string,
    newRole: BranchRole,
    actorPhone: string,
  ): Promise<boolean> {
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    if (!this.supabaseIsManagerUp(access)) {
      await wait();
      return false;
    }
    const { data: targetRaw } = await this.supabase
      .from("branch_memberships")
      .select("id, role")
      .eq("id", membershipId)
      .eq("branch_id", branchId)
      .is("ended_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (!targetRaw) {
      await wait();
      return false;
    }
    const targetRole = mapBranchRole(String((targetRaw as Record<string, unknown>).role));
    const actorIsOwner = this.supabaseIsOwnerAccess(access);
    if (!actorIsOwner) {
      if (targetRole !== "staff") {
        await wait();
        return false;
      }
      if (newRole === "owner") {
        await wait();
        return false;
      }
    }
    if (newRole === "owner" && !actorIsOwner) {
      await wait();
      return false;
    }
    const { error } = await this.supabase
      .from("branch_memberships")
      .update({ role: newRole } as never)
      .eq("id", membershipId)
      .eq("branch_id", branchId);
    await wait();
    return !error;
  }

  async terminateBranchMember(
    branchId: string,
    membershipId: string,
    actorPhone: string,
  ): Promise<boolean> {
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    if (!this.supabaseIsManagerUp(access)) {
      await wait();
      return false;
    }
    const { data: targetRaw } = await this.supabase
      .from("branch_memberships")
      .select("id, role, employee_id")
      .eq("id", membershipId)
      .eq("branch_id", branchId)
      .is("ended_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (!targetRaw) {
      await wait();
      return false;
    }
    const targetRole = mapBranchRole(String((targetRaw as Record<string, unknown>).role));
    const actorIsOwner = this.supabaseIsOwnerAccess(access);
    if (!actorIsOwner && targetRole !== "staff") {
      await wait();
      return false;
    }
    if (targetRole === "owner" && !actorIsOwner) {
      await wait();
      return false;
    }
    const targetEmployeeId = String((targetRaw as Record<string, unknown>).employee_id);
    const { error } = await this.supabase
      .from("branch_memberships")
      .update({ ended_at: new Date().toISOString() } as never)
      .eq("id", membershipId)
      .eq("branch_id", branchId);
    if (error) {
      await wait();
      return false;
    }
    const { data: empRow } = await this.supabase
      .from("employees")
      .select("phone, current_branch_id")
      .eq("id", targetEmployeeId)
      .maybeSingle();
    const empRec = empRow as Record<string, unknown> | null;
    const empPhone = empRec && typeof empRec.phone === "string" ? empRec.phone : "";
    if (empPhone && empRec?.current_branch_id && String(empRec.current_branch_id) === branchId) {
      const remain = await this.getBranchMembershipsByPhoneRemote(empPhone);
      const nextDefault = remain[0]?.branchId ?? null;
      await this.supabase
        .from("employees")
        .update({ current_branch_id: nextDefault } as never)
        .eq("id", targetEmployeeId);
    }
    await wait();
    return true;
  }

  async inviteStaffMember(
    branchId: string,
    inviteePhone: string,
    actorPhone: string,
    displayName?: string | null,
  ): Promise<boolean> {
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    if (!this.supabaseIsManagerUp(access)) {
      await wait();
      return false;
    }
    const normalized = normalizePhone(inviteePhone);
    if (!normalized) {
      await wait();
      return false;
    }
    const displayTrimmed = displayName?.trim() ?? "";
    let invitee = await this.getEmployeeByPhone(normalized);
    if (!invitee) {
      const defaultName = displayTrimmed || `직원-${normalized.slice(-4)}`;
      const { data: inserted, error: insertError } = await this.supabase
        .from("employees")
        .insert({
          phone: normalized,
          name: defaultName,
          display_name_confirmed_at: null,
        } as never)
        .select("*")
        .single();
      if (insertError || !inserted) {
        await wait();
        return false;
      }
      invitee = mapEmployeeRow(inserted as Record<string, unknown>);
    }
    const { data: existingMembership } = await this.supabase
      .from("branch_memberships")
      .select("id")
      .eq("branch_id", branchId)
      .eq("employee_id", invitee.id)
      .is("ended_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (existingMembership) {
      await wait();
      return true;
    }
    const { data: latestEnded } = await this.supabase
      .from("branch_memberships")
      .select("id")
      .eq("branch_id", branchId)
      .eq("employee_id", invitee.id)
      .not("ended_at", "is", null)
      .is("deleted_at", null)
      .order("ended_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const branchName = branchMemberName(displayTrimmed || null, invitee.name);
    if (latestEnded) {
      const { error: reviveError } = await this.supabase
        .from("branch_memberships")
        .update({
          role: "staff",
          nickname: branchName,
          started_at: new Date().toISOString(),
          ended_at: null,
          deleted_at: null,
        } as never)
        .eq("id", String((latestEnded as Record<string, unknown>).id))
        .eq("branch_id", branchId);
      await wait();
      return !reviveError;
    }
    const { error } = await this.supabase.from("branch_memberships").insert({
      branch_id: branchId,
      employee_id: invitee.id,
      role: "staff",
      nickname: branchName,
    } as never);
    await wait();
    return !error;
  }

  async registerFirstProfile(phone: string, name: string): Promise<Employee> {
    const normalized = normalizePhone(phone);
    await this.ensureAuthUser();
    await this.setAuthPhone(normalized);
    const employee = await this.upsertEmployeeByPhone({
      phone: normalized,
      name: name.trim(),
      markDisplayNameConfirmed: true,
    });

    await this.supabase
      .from("employees")
      .update({ current_branch_id: null } as never)
      .eq("id", employee.id);

    const synced = await this.getEmployeeByPhone(normalized);
    await wait();
    return synced ?? employee;
  }

  async updateMyProfileName(phone: string, name: string): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    const { data } = await this.supabase
      .from("employees")
      .update({
        name: name.trim(),
        display_name_confirmed_at: new Date().toISOString(),
      } as never)
      .eq("phone", normalized)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();
    if (data) {
      const updated = mapEmployeeRow(data as Record<string, unknown>);
      await wait();
      return updated;
    }
    await wait();
    return null;
  }

  async updateMyProfileAvatar(phone: string, file: File | null): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    const employee = await this.getEmployeeByPhone(normalized);
    if (!employee?.id) {
      await wait();
      return null;
    }
    await this.ensureAuthUser();
    await this.setAuthPhone(normalized);
    let avatarUrl: string | null;
    if (file === null) {
      avatarUrl = null;
    } else {
      const path = newAvatarStoragePath(employee.id, file);
      avatarUrl = await uploadPublicImage(path, file);
    }
    const { data, error } = await this.supabase
      .from("employees")
      .update({ avatar_url: avatarUrl } as never)
      .eq("phone", normalized)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();
    await wait();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error(
        "프로필 사진을 DB에 반영하지 못했습니다. employees.avatar_url 컬럼이 있는지, 같은 번호로 로그인했는지 확인해 주세요.",
      );
    }
    return mapEmployeeRow(data as Record<string, unknown>);
  }

  async uploadNoticeAttachmentFiles(
    noticeId: string,
    actorPhone: string,
    files: File[],
  ): Promise<string[]> {
    const normalized = normalizePhone(actorPhone);
    await this.ensureAuthUser();
    await this.setAuthPhone(normalized);
    const urls: string[] = [];
    for (const file of files) {
      const path = newNoticeAttachmentStoragePath(noticeId, file);
      urls.push(await uploadPublicImage(path, file));
    }
    await wait();
    return urls;
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
    clearSession();
    await wait();
  }

  async checkInCurrent(session: Employee, branchId: string | null): Promise<void> {
    await this.ensureAuthUser();
    await this.setAuthPhone(session.phone);
    if (!session.id) {
      throw new Error("출근 처리 실패: 직원 id가 없습니다. 다시 로그인해 주세요.");
    }
    const { data: active } = await this.supabase
      .from("punch_records")
      .select("id")
      .eq("employee_id", session.id)
      .is("checked_out_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (!active) {
      const memberships = await this.getBranchMembershipsByPhoneRemote(session.phone);
      const membership =
        branchId === null
          ? null
          : (memberships.find((item) => item.branchId === branchId) ?? null);
      const { error } = await this.supabase.from("punch_records").insert({
        employee_id: session.id,
        employee_name: membership?.name ?? session.name,
        branch_id: branchId,
        checked_in_at: new Date().toISOString(),
        checked_out_at: null,
      } as never);
      if (error) {
        throw new Error(`출근 처리 실패: ${error.message}`);
      }
    }
    await wait();
  }

  async checkOutCurrent(recordId: string): Promise<void> {
    await this.ensureAuthUser();
    const { error } = await this.supabase
      .from("punch_records")
      .update({ checked_out_at: new Date().toISOString() } as never)
      .eq("id", recordId);
    if (error) {
      throw new Error(`퇴근 처리 실패: ${error.message}`);
    }
    await wait();
  }

  async updatePunchRecord(
    recordId: string,
    next: { checkedInAt: string; checkedOutAt: string | null },
    actorPhone: string,
  ): Promise<boolean> {
    await this.ensureAuthUser();
    const session = await this.getSessionEmployeeFromAuth();
    if (!session || normalizePhone(session.phone) !== normalizePhone(actorPhone)) {
      await wait();
      return false;
    }

    const { data: target } = await this.supabase
      .from("punch_records")
      .select("id, branch_id")
      .eq("id", recordId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!target) {
      await wait();
      return false;
    }
    const branchId = String((target as Record<string, unknown>).branch_id ?? "");
    if (!branchId) {
      await wait();
      return false;
    }
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    if (!this.supabaseIsManagerUp(access)) {
      await wait();
      return false;
    }

    const { data, error } = await this.supabase
      .from("punch_records")
      .update({
        checked_in_at: next.checkedInAt,
        checked_out_at: next.checkedOutAt,
      } as never)
      .eq("id", recordId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    await wait();
    return !error && data !== null;
  }

  async createPunchRecord(
    input: Omit<PunchRecord, "id">,
    actorPhone: string,
  ): Promise<PunchRecord | null> {
    const branchId = input.branchId ?? null;
    if (!branchId) {
      await wait();
      return null;
    }
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    if (!this.supabaseIsManagerUp(access)) {
      await wait();
      return null;
    }
    const { data, error } = await this.supabase
      .from("punch_records")
      .insert({
        employee_id: input.employeeId,
        employee_name: input.employeeName,
        branch_id: branchId,
        checked_in_at: input.checkedInAt,
        checked_out_at: input.checkedOutAt,
      } as never)
      .select("*, employee:employees!employee_id(phone)")
      .maybeSingle();
    await wait();
    return !error && data ? mapPunchRow(data as Record<string, unknown>) : null;
  }

  async deletePunchRecord(recordId: string, actorPhone: string): Promise<boolean> {
    await this.ensureAuthUser();
    const { data: target } = await this.supabase
      .from("punch_records")
      .select("id, branch_id")
      .eq("id", recordId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!target) {
      await wait();
      return false;
    }
    const branchId = String((target as Record<string, unknown>).branch_id ?? "");
    if (!branchId) {
      await wait();
      return false;
    }
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    if (!this.supabaseIsManagerUp(access)) {
      await wait();
      return false;
    }
    const { error } = await this.supabase
      .from("punch_records")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", recordId)
      .is("deleted_at", null);
    await wait();
    return !error;
  }

  async getDashboard(): Promise<DashboardData> {
    if (this.dashboardInFlight) {
      return this.dashboardInFlight;
    }
    const request = (async () => {
      const session = await this.getSessionEmployeeFromAuth();
      const [branches, shifts, punchRecords, events, memberships] = await Promise.all([
        this.getBranchesRemote(),
        this.getShiftsRemote(),
        this.getPunchesRemote(),
        this.getCalendarEventsRemote(),
        session ? this.getBranchMembershipsByPhoneRemote(session.phone) : Promise.resolve([]),
      ]);
      const myBranchIds = new Set(memberships.map((membership) => membership.branchId));
      const myBranches = session
        ? branches.filter(
            (branch) =>
              myBranchIds.has(branch.id) ||
              branch.createdByPhone === session.phone ||
              branch.createdByEmployeeId === session.id,
          )
        : [];
      const todayPunches = punchRecords.filter((record) => isToday(record.checkedInAt));
      const todayEvents = events
        .filter((event) => event.date === toDateKey(new Date()))
        .sort((a, b) => a.title.localeCompare(b.title));
      const nowMs = Date.now();

      const activePunch = session
        ? (punchRecords.find(
            (record) =>
              (record.employeeId === session.id || record.employeePhone === session.phone) &&
              record.checkedOutAt === null,
          ) ?? null)
        : null;
      const todayShift = session
        ? (shifts.find(
            (shift) =>
              (shift.employeeId === session.id || shift.employeePhone === session.phone) &&
              isToday(shift.startAt),
          ) ?? null)
        : null;
      const currentWorker =
        shifts.find(
          (shift) =>
            new Date(shift.startAt).getTime() <= nowMs && new Date(shift.endAt).getTime() >= nowMs,
        ) ?? null;
      const nextWorker = shifts.find((shift) => new Date(shift.startAt).getTime() > nowMs) ?? null;
      const myTodayRecords = session
        ? todayPunches
            .filter(
              (record) =>
                record.employeeId === session.id || record.employeePhone === session.phone,
            )
            .sort((a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime())
        : [];
      const myTodayHours = myTodayRecords.reduce((sum, record) => {
        const endAt = record.checkedOutAt ?? new Date(nowMs).toISOString();
        return sum + durationHours(record.checkedInAt, endAt);
      }, 0);

      await wait();
      return {
        session,
        branches,
        myBranches,
        myBranchMemberships: memberships,
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
    })();
    this.dashboardInFlight = request;
    try {
      return await request;
    } finally {
      if (this.dashboardInFlight === request) {
        this.dashboardInFlight = null;
      }
    }
  }

  async getHistory(): Promise<PunchRecord[]> {
    const punches = await this.getPunchesRemote();
    await wait();
    return punches;
  }

  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const events = await this.getCalendarEventsRemote();
    await wait();
    return events;
  }

  async createCalendarEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    const { data } = await this.supabase
      .from("calendar_events")
      .insert({
        date: event.date,
        title: event.title.trim(),
        color: event.color,
        branch_id: event.branchId ?? null,
      } as never)
      .select("*")
      .single();
    await wait();
    return data ? mapEventRow(data as Record<string, unknown>) : { id: "", ...event };
  }

  async updateCalendarEvent(
    eventId: string,
    payload: Partial<Pick<CalendarEvent, "title" | "color" | "branchId">>,
  ): Promise<CalendarEvent | null> {
    const { data } = await this.supabase
      .from("calendar_events")
      .update({
        ...(payload.title !== undefined ? { title: payload.title.trim() } : {}),
        ...(payload.color !== undefined ? { color: payload.color } : {}),
        ...(payload.branchId !== undefined ? { branch_id: payload.branchId } : {}),
      } as never)
      .eq("id", eventId)
      .select("*")
      .maybeSingle();
    await wait();
    return data ? mapEventRow(data as Record<string, unknown>) : null;
  }

  async deleteCalendarEvent(eventId: string): Promise<void> {
    await this.supabase
      .from("calendar_events")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", eventId);
    await wait();
  }

  async listNotices(branchId: string): Promise<Notice[]> {
    const { data, error } = await this.supabase
      .from("notices")
      .select("*")
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      await wait();
      return [];
    }
    const notices = (data ?? []).map((row) => mapNoticeRow(row as Record<string, unknown>));
    if (notices.length === 0) {
      await wait();
      return [];
    }
    const noticeIds = notices.map((notice) => notice.id);
    const { data: attachmentRows } = await this.supabase
      .from("notice_attachments")
      .select("*")
      .in("notice_id", noticeIds)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    const attachmentMap = new Map<string, NoticeAttachment[]>();
    for (const rowRaw of attachmentRows ?? []) {
      const attachment = mapNoticeAttachmentRow(rowRaw as Record<string, unknown>);
      const current = attachmentMap.get(attachment.noticeId) ?? [];
      current.push(attachment);
      attachmentMap.set(attachment.noticeId, current);
    }
    await wait();
    return notices.map((notice) => ({
      ...notice,
      attachments: attachmentMap.get(notice.id) ?? [],
    }));
  }

  async createNotice(branchId: string, input: NoticeInput, actorPhone: string): Promise<Notice | null> {
    const actor = await this.getEmployeeByPhone(normalizePhone(actorPhone));
    if (!actor?.id) {
      await wait();
      return null;
    }
    const { data, error } = await this.supabase
      .from("notices")
      .insert({
        branch_id: branchId,
        author_employee_id: actor.id,
        author_name: actor.name,
        title: input.title.trim(),
        body: input.content.trim(),
        is_pinned: input.isPinned,
      } as never)
      .select("*")
      .maybeSingle();
    if (error || !data) {
      await wait();
      return null;
    }
    const notice = mapNoticeRow(data as Record<string, unknown>);
    if (input.attachments.length > 0) {
      await this.supabase.from("notice_attachments").insert(
        input.attachments.map((imageUrl, index) => ({
          notice_id: notice.id,
          image_url: imageUrl,
          sort_order: index,
        })) as never,
      );
    }
    const [created] = await this.listNotices(branchId).then((rows) => rows.filter((n) => n.id === notice.id));
    await wait();
    return created ?? { ...notice, attachments: [] };
  }

  async updateNotice(
    noticeId: string,
    input: NoticeInput,
    actorPhone: string,
  ): Promise<Notice | null> {
    const actor = await this.getEmployeeByPhone(normalizePhone(actorPhone));
    if (!actor?.id) {
      await wait();
      return null;
    }
    const { data: noticeRow } = await this.supabase
      .from("notices")
      .select("id, branch_id, author_employee_id")
      .eq("id", noticeId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!noticeRow) {
      await wait();
      return null;
    }
    const noticeRec = noticeRow as Record<string, unknown>;
    const branchId = String(noticeRec.branch_id ?? "");
    const authorEmployeeId = String(noticeRec.author_employee_id ?? "");
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    const isAuthor = actor.id === authorEmployeeId;
    const { data: authorMembership } = await this.supabase
      .from("branch_memberships")
      .select("role")
      .eq("branch_id", branchId)
      .eq("employee_id", authorEmployeeId)
      .is("ended_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    const authorRole = authorMembership
      ? mapBranchRole(String((authorMembership as Record<string, unknown>).role))
      : null;
    if (!canEditNoticeByRole(access, authorRole, isAuthor)) {
      await wait();
      return null;
    }
    const { data, error } = await this.supabase
      .from("notices")
      .update({
        title: input.title.trim(),
        body: input.content.trim(),
        is_pinned: input.isPinned,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", noticeId)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();
    if (error || !data) {
      await wait();
      return null;
    }
    await this.supabase
      .from("notice_attachments")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("notice_id", noticeId)
      .is("deleted_at", null);
    if (input.attachments.length > 0) {
      await this.supabase.from("notice_attachments").insert(
        input.attachments.map((imageUrl, index) => ({
          notice_id: noticeId,
          image_url: imageUrl,
          sort_order: index,
        })) as never,
      );
    }
    const [updatedNotice] = await this.listNotices(branchId).then((rows) => rows.filter((n) => n.id === noticeId));
    await wait();
    return updatedNotice ?? { ...mapNoticeRow(data as Record<string, unknown>), attachments: [] };
  }

  async deleteNotice(noticeId: string, actorPhone: string): Promise<boolean> {
    const actor = await this.getEmployeeByPhone(normalizePhone(actorPhone));
    if (!actor?.id) {
      await wait();
      return false;
    }
    const { data: noticeRow } = await this.supabase
      .from("notices")
      .select("id, branch_id, author_employee_id")
      .eq("id", noticeId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!noticeRow) {
      await wait();
      return false;
    }
    const noticeRec = noticeRow as Record<string, unknown>;
    const branchId = String(noticeRec.branch_id ?? "");
    const authorEmployeeId = String(noticeRec.author_employee_id ?? "");
    const access = await this.resolveActorBranchAccess(branchId, actorPhone);
    const isAuthor = actor.id === authorEmployeeId;
    const { data: authorMembership } = await this.supabase
      .from("branch_memberships")
      .select("role")
      .eq("branch_id", branchId)
      .eq("employee_id", authorEmployeeId)
      .is("ended_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    const authorRole = authorMembership
      ? mapBranchRole(String((authorMembership as Record<string, unknown>).role))
      : null;
    if (!canEditNoticeByRole(access, authorRole, isAuthor)) {
      await wait();
      return false;
    }
    const now = new Date().toISOString();
    await this.supabase
      .from("notice_attachments")
      .update({ deleted_at: now } as never)
      .eq("notice_id", noticeId)
      .is("deleted_at", null);
    const { error } = await this.supabase
      .from("notices")
      .update({ deleted_at: now } as never)
      .eq("id", noticeId)
      .is("deleted_at", null);
    await wait();
    return !error;
  }

  async getSchedule(): Promise<Shift[]> {
    const shifts = await this.getShiftsRemote();
    await wait();
    return shifts;
  }

  async getSchedulePeople(): Promise<SchedulePersonRecord[]> {
    const session = await this.getSessionEmployeeFromAuth();
    const branchId = session?.currentBranchId ?? null;

    if (!branchId) {
      const { data } = await this.supabase
        .from("employees")
        .select("id,name,phone")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      await wait();
      return (data ?? []).map((row) => ({
        id: String((row as Record<string, unknown>).id),
        name: String((row as Record<string, unknown>).name),
        employeePhone: String((row as Record<string, unknown>).phone),
        color: "#22c55e",
      }));
    }

    const { data } = await this.supabase
      .from("branch_memberships")
      .select("color, nickname, employee:employees!employee_id(id,name,phone,deleted_at)")
      .eq("branch_id", branchId)
      .is("ended_at", null)
      .is("deleted_at", null);
    await wait();

    const rows: SchedulePersonRecord[] = [];
    for (const rowRaw of data ?? []) {
      const row = rowRaw as Record<string, unknown>;
      const empRaw = row.employee as Record<string, unknown> | null | undefined;
      if (!empRaw || empRaw.deleted_at != null) {
        continue;
      }
      const emp = embeddedEmployeeFromRow(row);
      const hexRaw = row.color !== undefined && row.color !== null ? String(row.color).trim() : "";
      rows.push({
        id: String(empRaw.id),
        name: branchMemberName(readStoredBranchName(row), emp?.name ?? ""),
        employeePhone: normalizePhone(String(emp?.phone ?? "")),
        color: hexRaw ? hexRaw : "#22c55e",
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return rows;
  }

  async createSchedulePerson(input: {
    name: string;
    employeePhone: string;
    color: string;
  }): Promise<SchedulePersonRecord> {
    const normalized = normalizePhone(input.employeePhone);
    const employee = await this.upsertEmployeeByPhone({
      phone: normalized,
      name: input.name.trim(),
    });
    await wait();
    return {
      id: employee.id,
      name: employee.name,
      employeePhone: employee.phone,
      color: input.color,
    };
  }

  async updateSchedulePerson(
    personId: string,
    input: { name: string; employeePhone: string; color: string },
  ): Promise<SchedulePersonRecord | null> {
    const normalized = normalizePhone(input.employeePhone);
    const { data } = await this.supabase
      .from("employees")
      .update({
        name: input.name.trim(),
        phone: normalized,
      } as never)
      .eq("id", personId)
      .select("id,name,phone")
      .maybeSingle();
    await wait();
    return data
      ? {
          id: String((data as Record<string, unknown>).id),
          name: String((data as Record<string, unknown>).name),
          employeePhone: String((data as Record<string, unknown>).phone),
          color: input.color,
        }
      : null;
  }

  async deleteSchedulePerson(personId: string): Promise<void> {
    await this.supabase
      .from("employees")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", personId);
    await wait();
  }

  async getTimelineShifts(nowIso: string, shifts: Shift[]): Promise<Shift[]> {
    void nowIso;
    const today = shifts.filter((shift) => isToday(shift.startAt));
    await wait();
    return today;
  }

  async createShift(shift: Omit<Shift, "id">): Promise<Shift> {
    const session = await this.getSessionEmployeeFromAuth();
    const resolvedBranchId = shift.branchId ?? session?.currentBranchId ?? null;
    const resolvedEmployeeId =
      shift.employeeId || (await this.getEmployeeByPhone(normalizePhone(shift.employeePhone)))?.id;
    if (!resolvedEmployeeId) {
      throw new Error("스케줄 담당 직원을 찾을 수 없습니다.");
    }
    const { data } = await this.supabase
      .from("shifts")
      .insert({
        employee_id: resolvedEmployeeId,
        employee_name: shift.employeeName,
        branch_id: resolvedBranchId,
        start_at: shift.startAt,
        end_at: shift.endAt,
      } as never)
      .select("*, employee:employees!employee_id(phone)")
      .single();
    await wait();
    return data ? mapShiftRow(data as Record<string, unknown>) : { id: "", ...shift };
  }

  async createShifts(shifts: Omit<Shift, "id">[]): Promise<string[]> {
    if (shifts.length === 0) {
      return [];
    }
    const session = await this.getSessionEmployeeFromAuth();
    const defaultBranchId = session?.currentBranchId ?? null;
    const rows: Record<string, unknown>[] = [];
    for (const shift of shifts) {
      const resolvedEmployeeId =
        shift.employeeId ||
        (await this.getEmployeeByPhone(normalizePhone(shift.employeePhone)))?.id;
      if (!resolvedEmployeeId) {
        continue;
      }
      rows.push({
        employee_id: resolvedEmployeeId,
        employee_name: shift.employeeName,
        branch_id: shift.branchId ?? defaultBranchId,
        start_at: shift.startAt,
        end_at: shift.endAt,
      });
    }
    if (rows.length === 0) {
      await wait();
      return [];
    }
    const { data } = await this.supabase
      .from("shifts")
      .insert(rows as never)
      .select("id");
    await wait();
    return (data ?? []).map((row) => String((row as Record<string, unknown>).id));
  }

  async updateShift(
    shiftId: string,
    payload: Partial<
      Pick<
        Shift,
        "employeeId" | "employeeName" | "employeePhone" | "branchId" | "startAt" | "endAt"
      >
    >,
  ): Promise<Shift | null> {
    const updateBody: Record<string, unknown> = {
      ...(payload.employeeName !== undefined ? { employee_name: payload.employeeName } : {}),
      ...(payload.branchId !== undefined ? { branch_id: payload.branchId } : {}),
      ...(payload.startAt !== undefined ? { start_at: payload.startAt } : {}),
      ...(payload.endAt !== undefined ? { end_at: payload.endAt } : {}),
    };
    if (payload.employeeId !== undefined) {
      updateBody.employee_id = payload.employeeId;
    } else if (payload.employeePhone !== undefined) {
      const emp = await this.getEmployeeByPhone(normalizePhone(payload.employeePhone));
      if (emp?.id) {
        updateBody.employee_id = emp.id;
        if (payload.employeeName === undefined) {
          updateBody.employee_name = emp.name;
        }
      }
    }
    const { data } = await this.supabase
      .from("shifts")
      .update(updateBody as never)
      .eq("id", shiftId)
      .select("*, employee:employees!employee_id(phone)")
      .maybeSingle();
    await wait();
    return data ? mapShiftRow(data as Record<string, unknown>) : null;
  }

  async deleteShift(shiftId: string): Promise<void> {
    await this.supabase
      .from("shifts")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", shiftId);
    await wait();
  }

  async getWeeklyStats(): Promise<{
    rows: WeeklyStatRow[];
    totalHours: number;
  }> {
    const weekStart = startOfWeek(new Date());
    const punches = await this.getPunchesRemote();
    const map = new Map<string, WeeklyStatRow>();
    for (const record of punches) {
      if (!record.checkedOutAt || !isWithinWeek(record.checkedInAt, weekStart)) {
        continue;
      }
      const key = record.employeePhone;
      const current = map.get(key) ?? {
        phone: record.employeePhone,
        name: record.employeeName,
        totalHours: 0,
        shiftCount: 0,
      };
      current.totalHours += durationHours(record.checkedInAt, record.checkedOutAt);
      current.shiftCount += 1;
      map.set(key, current);
    }
    const rows = [...map.values()].sort((a, b) => b.totalHours - a.totalHours);
    const totalHours = rows.reduce((sum, row) => sum + row.totalHours, 0);
    await wait();
    return { rows, totalHours };
  }

  async getRangeWorkStats(
    startDate: string,
    endDate: string,
  ): Promise<{
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

    const punches = await this.getPunchesRemote();
    const built = buildRangeWorkStatsFromPunches(punches, start, end);
    await wait();
    return { rows: built.rows, totalSeconds: built.totalSeconds };
  }
}

const hasSupabaseEnv =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

/** UI에서 업로드 플로우 분기용 (예: 공지 첨부 Storage 업로드). */
export const isSupabaseBackend = hasSupabaseEnv;

export const workApi = hasSupabaseEnv ? new SupabaseWorkApi() : new LocalWorkApi();
