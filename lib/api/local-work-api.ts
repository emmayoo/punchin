"use client";

import {
  schedulePersonFromEmployee,
  schedulePersonFromMembership,
  sortSchedulePeople,
} from "@/lib/api/schedule-person-map";
import {
  buildRangeWorkStatsFromPunches,
  canEditNoticeByRole,
  fileToDataUrl,
  localCountOwners,
  localIsManagerUp,
  localIsOwnerAccess,
  localResolveActorBranchRole,
  normalizePhone,
  wait,
} from "@/lib/api/work-api-shared";
import type {
  BranchSetupInput,
  DashboardData,
  NoticeInput,
  RangeWorkStatRow,
  WeeklyStatRow,
} from "@/lib/api/work-api-types";
import { BRANCH_MEMBER_FALLBACK } from "@/lib/branch-display-name";
import { todayCalendarEvents } from "@/lib/calendar/events";
import { DEFAULT_MEMBER_COLOR } from "@/lib/constants/color";
import {
  addBranchMembership,
  addCalendarEvent,
  addPunchRecord,
  addShift,
  addShifts,
  checkIn,
  checkOut,
  clearSession,
  createBranch,
  createNotice as createNoticeLocal,
  deleteBranchByOwner,
  deleteCalendarEvent,
  deleteNotice as deleteNoticeLocal,
  deletePunchRecord,
  deleteShift,
  getActivePunch,
  getBranches,
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
  updateBranchMemberJoinedAt as persistBranchMemberJoinedAt,
  updateBranchMemberName as persistBranchMemberName,
  removeBranchMembership,
  saveSession,
  setEmployeeCurrentBranch,
  updateBranchBasicFields,
  updateBranchMembershipColor,
  updateBranchMembershipRole,
  updateCalendarEvent,
  updateEmployeeAvatar,
  updateEmployeeName,
  updateEmployeeProfile,
  updateNotice as updateNoticeLocal,
  updatePunchRecordTimes,
  updateShift,
  upsertEmployee,
} from "@/lib/storage";
import { durationHours, isToday, isWithinWeek, startOfWeek, toDateKey } from "@/lib/time";
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
  SchedulePersonRecord,
  Shift,
} from "@/types/work";

export class LocalWorkApi {
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
        name: emp?.name ?? "직원",
        color: membership.color ?? DEFAULT_MEMBER_COLOR,
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

  async updateMyProfile(
    phone: string,
    payload: { name: string; birthDate: string | null },
  ): Promise<Employee | null> {
    const updated = updateEmployeeProfile(normalizePhone(phone), payload);
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

  async uploadNoticeAttachmentFiles(): Promise<string[]> {
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
      const todayKey = toDateKey(new Date());
      const schedulePeople = await this.getSchedulePeople();
      const todayEvents = todayCalendarEvents(
        getCalendarEvents(),
        schedulePeople,
        session?.currentBranchId ?? null,
        todayKey,
      );
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
        attachments: (attachByNotice.get(notice.id) ?? []).sort(
          (a, b) => a.sortOrder - b.sortOrder,
        ),
      }))
      .sort(
        (a, b) =>
          Number(b.isPinned) - Number(a.isPinned) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  async createNotice(
    branchId: string,
    input: NoticeInput,
    actorPhone: string,
  ): Promise<Notice | null> {
    const actor =
      getEmployees().find((employee) => employee.phone === normalizePhone(actorPhone)) ?? null;
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
    const actor =
      getEmployees().find((employee) => employee.phone === normalizePhone(actorPhone)) ?? null;
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
    const actor =
      getEmployees().find((employee) => employee.phone === normalizePhone(actorPhone)) ?? null;
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
      return sortSchedulePeople(getEmployees().map(schedulePersonFromEmployee));
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
      rows.push(schedulePersonFromMembership(employee, membership));
    }
    return sortSchedulePeople(rows);
  }

  async createSchedulePerson(input: {
    name: string;
    employeePhone: string;
    color: string;
  }): Promise<SchedulePersonRecord> {
    const phone = normalizePhone(input.employeePhone);
    const employee = upsertEmployee(phone, input.name.trim());
    await wait();
    const legalName = employee.name.trim() || BRANCH_MEMBER_FALLBACK;
    return {
      id: employee.id,
      name: legalName,
      nickname: null,
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
    const legalName = updated.name.trim() || BRANCH_MEMBER_FALLBACK;
    return {
      id: updated.id,
      name: legalName,
      nickname: null,
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
