"use client";

import {
  addBranchMembership,
  addCalendarEvent,
  createBranch,
  deleteBranchByOwner,
  deleteCalendarEvent,
  deleteShift,
  addShift,
  addShifts,
  checkIn,
  checkOut,
  clearSession,
  getActivePunch,
  getCalendarEvents,
  getBranches,
  getBranchMembershipsByPhone,
  getEmployees,
  removeBranchMembership,
  setEmployeeCurrentBranch,
  updateBranchName,
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
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { durationHours, isToday, isWithinWeek, startOfWeek } from "@/lib/time";
import type {
  Branch,
  BranchMembership,
  BranchRole,
  CalendarEvent,
  Employee,
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

export type BranchSetupInput =
  | { mode: "select"; branchId: string }
  | {
      mode: "create";
      branchName: string;
      businessNumber: string;
      profileImageUrl?: string | null;
      address?: string | null;
      storePhone?: string | null;
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

function mapEmployeeRow(row: Record<string, unknown>): Employee {
  return {
    id: String(row.id),
    phone: String(row.phone),
    name: String(row.name),
    currentBranchId: row.current_branch_id
      ? String(row.current_branch_id)
      : null,
  };
}

function mapShiftRow(row: Record<string, unknown>): Shift {
  return {
    id: String(row.id),
    employeePhone: String(row.employee_phone),
    employeeName: String(row.employee_name),
    startAt: String(row.start_at),
    endAt: String(row.end_at),
  };
}

function mapPunchRow(row: Record<string, unknown>): PunchRecord {
  return {
    id: String(row.id),
    employeePhone: String(row.employee_phone),
    employeeName: String(row.employee_name),
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
  };
}

function mapSchedulePersonRow(
  row: Record<string, unknown>,
): SchedulePersonRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    employeePhone: String(row.phone),
    color: String(row.color ?? "#22c55e"),
  };
}

function mapBranchRow(row: Record<string, unknown>): Branch {
  return {
    id: String(row.id),
    profileImageUrl: row.profile_image_url
      ? String(row.profile_image_url)
      : null,
    name: String(row.name),
    businessNumber: String(row.business_number ?? ""),
    address: row.address ? String(row.address) : null,
    storePhone: row.store_phone ? String(row.store_phone) : null,
    createdByPhone: String(row.created_by_phone),
  };
}

function mapBranchMembershipRow(
  row: Record<string, unknown>,
): BranchMembership {
  const roleValue = String(row.role) as BranchRole;
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    employeePhone: String(row.employee_phone),
    role: roleValue === "owner" ? "owner" : "member",
  };
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

  async completeBranchSetup(
    phone: string,
    input: BranchSetupInput,
  ): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    const employee =
      getEmployees().find((item) => item.phone === normalized) ?? null;
    if (!employee) {
      await wait();
      return null;
    }

    let targetBranchId = "";
    if (input.mode === "select") {
      targetBranchId = input.branchId;
      addBranchMembership(targetBranchId, normalized, "member");
    } else {
      const created = createBranch({
        profileImageUrl: input.profileImageUrl ?? null,
        name: input.branchName.trim(),
        businessNumber: input.businessNumber.trim(),
        address: input.address ?? null,
        storePhone: input.storePhone ?? null,
        createdByPhone: normalized,
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
    const employee =
      getEmployees().find((item) => item.phone === normalized) ?? null;
    if (!employee) {
      await wait();
      return false;
    }
    addBranchMembership(branchId, normalized, "member");
    await wait();
    return true;
  }

  async disconnectBranch(phone: string, branchId: string): Promise<boolean> {
    const normalized = normalizePhone(phone);
    const employee =
      getEmployees().find((item) => item.phone === normalized) ?? null;
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
    name: string,
  ): Promise<Branch | null> {
    const updated = updateBranchName(
      branchId,
      name,
      normalizePhone(actorPhone),
    );
    await wait();
    return updated;
  }

  async deleteMyCreatedBranch(
    branchId: string,
    actorPhone: string,
  ): Promise<boolean> {
    const ok = deleteBranchByOwner(branchId, normalizePhone(actorPhone));
    await wait();
    return ok;
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

  async getSchedulePeople(): Promise<SchedulePersonRecord[]> {
    const rows = getEmployees().map((employee) => ({
      id: employee.id,
      name: employee.name,
      employeePhone: employee.phone,
      color: "#22c55e",
    }));
    await wait();
    return rows;
  }

  async createSchedulePerson(input: {
    name: string;
    employeePhone: string;
    color: string;
  }): Promise<SchedulePersonRecord> {
    const employee = upsertEmployee(
      normalizePhone(input.employeePhone),
      input.name.trim(),
    );
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
    payload: Partial<
      Pick<Shift, "employeeName" | "employeePhone" | "startAt" | "endAt">
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
            new Date(b.checkedInAt).getTime() -
            new Date(a.checkedInAt).getTime(),
        ),
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
    const totalSeconds = rows.reduce((sum, row) => sum + row.totalSeconds, 0);
    await wait();
    return { rows, totalSeconds };
  }
}

class SupabaseWorkApi {
  private supabase = getSupabaseBrowserClient();

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
    await this.supabase.auth.updateUser({
      data: { phone },
    });
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
      .maybeSingle();
    return data ? mapEmployeeRow(data as Record<string, unknown>) : null;
  }

  private async getEmployeesRemote(): Promise<Employee[]> {
    const { data } = await this.supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []).map((row) =>
      mapEmployeeRow(row as Record<string, unknown>),
    );
  }

  private async getBranchesRemote(): Promise<Branch[]> {
    const { data } = await this.supabase
      .from("branches")
      .select("*")
      .order("created_at", { ascending: true });
    return (data ?? []).map((row) =>
      mapBranchRow(row as Record<string, unknown>),
    );
  }

  private async getBranchMembershipsByPhoneRemote(
    phone: string,
  ): Promise<BranchMembership[]> {
    const { data } = await this.supabase
      .from("branch_memberships")
      .select("*")
      .eq("employee_phone", phone);
    return (data ?? []).map((row) =>
      mapBranchMembershipRow(row as Record<string, unknown>),
    );
  }

  private async getShiftsRemote(): Promise<Shift[]> {
    const { data } = await this.supabase
      .from("shifts")
      .select("*")
      .order("start_at", { ascending: true });
    return (data ?? []).map((row) =>
      mapShiftRow(row as Record<string, unknown>),
    );
  }

  private async getPunchesRemote(): Promise<PunchRecord[]> {
    const { data } = await this.supabase
      .from("punch_records")
      .select("*")
      .order("checked_in_at", { ascending: false });
    return (data ?? []).map((row) =>
      mapPunchRow(row as Record<string, unknown>),
    );
  }

  private async getCalendarEventsRemote(): Promise<CalendarEvent[]> {
    const { data } = await this.supabase
      .from("calendar_events")
      .select("*")
      .order("date", { ascending: true });
    return (data ?? []).map((row) =>
      mapEventRow(row as Record<string, unknown>),
    );
  }

  async login(phone: string): Promise<Employee> {
    const normalized = normalizePhone(phone);
    await this.ensureAuthUser();
    await this.setAuthPhone(normalized);
    const { data: existing } = await this.supabase
      .from("employees")
      .select("*")
      .eq("phone", normalized)
      .maybeSingle();
    const employee = existing
      ? mapEmployeeRow(existing as Record<string, unknown>)
      : (() => {
          const name = `직원-${normalized.slice(-4)}`;
          return { id: "", phone: normalized, name };
        })();

    if (!existing) {
      const { data: created } = await this.supabase
        .from("employees")
        .insert({ phone: employee.phone, name: employee.name } as never)
        .select("*")
        .single();
      if (created) {
        await wait();
        return mapEmployeeRow(created as Record<string, unknown>);
      }
    }
    await wait();
    return employee;
  }

  async getEmployeeByPhone(phone: string): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    const { data } = await this.supabase
      .from("employees")
      .select("*")
      .eq("phone", normalized)
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

  async completeBranchSetup(
    phone: string,
    input: BranchSetupInput,
  ): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    const employee = await this.getEmployeeByPhone(normalized);
    if (!employee) {
      await wait();
      return null;
    }

    let branchId = "";
    if (input.mode === "select") {
      branchId = input.branchId;
      await this.supabase.from("branch_memberships").upsert(
        {
          branch_id: branchId,
          employee_phone: normalized,
          role: "member",
        } as never,
        { onConflict: "branch_id,employee_phone" },
      );
    } else {
      const { data: createdBranch } = await this.supabase
        .from("branches")
        .insert({
          profile_image_url: input.profileImageUrl ?? null,
          name: input.branchName.trim(),
          business_number: input.businessNumber.trim(),
          address: input.address ?? null,
          store_phone: input.storePhone ?? null,
          created_by_phone: normalized,
        } as never)
        .select("*")
        .single();
      const createdBranchRow = createdBranch as Record<string, unknown> | null;
      branchId = createdBranchRow ? String(createdBranchRow.id) : "";
      if (!branchId) {
        await wait();
        return employee;
      }
      await this.supabase.from("branch_memberships").insert({
        branch_id: branchId,
        employee_phone: normalized,
        role: "owner",
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
    const { error } = await this.supabase.from("branch_memberships").upsert(
      {
        branch_id: branchId,
        employee_phone: normalized,
        role: "member",
      } as never,
      { onConflict: "branch_id,employee_phone" },
    );
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
    const { error } = await this.supabase
      .from("branch_memberships")
      .delete()
      .eq("branch_id", branchId)
      .eq("employee_phone", normalized);
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
    name: string,
  ): Promise<Branch | null> {
    const normalized = normalizePhone(actorPhone);
    const { data: branch } = await this.supabase
      .from("branches")
      .select("*")
      .eq("id", branchId)
      .eq("created_by_phone", normalized)
      .maybeSingle();
    if (!branch) {
      await wait();
      return null;
    }
    const { data: updated } = await this.supabase
      .from("branches")
      .update({ name: name.trim() } as never)
      .eq("id", branchId)
      .select("*")
      .maybeSingle();
    await wait();
    return updated ? mapBranchRow(updated as Record<string, unknown>) : null;
  }

  async deleteMyCreatedBranch(
    branchId: string,
    actorPhone: string,
  ): Promise<boolean> {
    const normalized = normalizePhone(actorPhone);
    const { data: branch } = await this.supabase
      .from("branches")
      .select("id")
      .eq("id", branchId)
      .eq("created_by_phone", normalized)
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
      .delete()
      .eq("id", branchId);
    await wait();
    return !error;
  }

  async registerFirstProfile(phone: string, name: string): Promise<Employee> {
    const normalized = normalizePhone(phone);
    await this.ensureAuthUser();
    await this.setAuthPhone(normalized);
    const { data: upserted } = await this.supabase
      .from("employees")
      .upsert(
        {
          phone: normalized,
          name: name.trim(),
        } as never,
        { onConflict: "phone" },
      )
      .select("*")
      .single();
    const employee = upserted
      ? mapEmployeeRow(upserted as Record<string, unknown>)
      : { id: "", phone: normalized, name: name.trim() };

    await this.supabase
      .from("employees")
      .update({ current_branch_id: null } as never)
      .eq("phone", normalized);

    const synced = await this.getEmployeeByPhone(normalized);
    await wait();
    return synced ?? employee;
  }

  async updateMyProfileName(
    phone: string,
    name: string,
  ): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    const { data } = await this.supabase
      .from("employees")
      .update({ name: name.trim() } as never)
      .eq("phone", normalized)
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

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
    clearSession();
    await wait();
  }

  async checkInCurrent(session: Employee): Promise<void> {
    await this.ensureAuthUser();
    await this.setAuthPhone(session.phone);
    const { data: active } = await this.supabase
      .from("punch_records")
      .select("id")
      .eq("employee_phone", session.phone)
      .is("checked_out_at", null)
      .maybeSingle();
    if (!active) {
      const { error } = await this.supabase.from("punch_records").insert({
        employee_phone: session.phone,
        employee_name: session.name,
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

  async getDashboard(): Promise<DashboardData> {
    const session = await this.getSessionEmployeeFromAuth();
    const [shifts, punchRecords, events] = await Promise.all([
      this.getShiftsRemote(),
      this.getPunchesRemote(),
      this.getCalendarEventsRemote(),
    ]);
    const todayPunches = punchRecords.filter((record) =>
      isToday(record.checkedInAt),
    );
    const todayEvents = events
      .filter((event) => event.date === toDateKey(new Date()))
      .sort((a, b) => a.title.localeCompare(b.title));
    const nowMs = Date.now();

    const activePunch = session
      ? (punchRecords.find(
          (record) =>
            record.employeePhone === session.phone &&
            record.checkedOutAt === null,
        ) ?? null)
      : null;
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
    const punches = await this.getPunchesRemote();
    await wait();
    return punches;
  }

  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const events = await this.getCalendarEventsRemote();
    await wait();
    return events;
  }

  async createCalendarEvent(
    event: Omit<CalendarEvent, "id">,
  ): Promise<CalendarEvent> {
    const { data } = await this.supabase
      .from("calendar_events")
      .insert({
        date: event.date,
        title: event.title.trim(),
        color: event.color,
      } as never)
      .select("*")
      .single();
    await wait();
    return data
      ? mapEventRow(data as Record<string, unknown>)
      : { id: "", ...event };
  }

  async updateCalendarEvent(
    eventId: string,
    payload: Partial<Pick<CalendarEvent, "title" | "color">>,
  ): Promise<CalendarEvent | null> {
    const { data } = await this.supabase
      .from("calendar_events")
      .update({
        ...(payload.title !== undefined ? { title: payload.title.trim() } : {}),
        ...(payload.color !== undefined ? { color: payload.color } : {}),
      } as never)
      .eq("id", eventId)
      .select("*")
      .maybeSingle();
    await wait();
    return data ? mapEventRow(data as Record<string, unknown>) : null;
  }

  async deleteCalendarEvent(eventId: string): Promise<void> {
    await this.supabase.from("calendar_events").delete().eq("id", eventId);
    await wait();
  }

  async getSchedule(): Promise<Shift[]> {
    const shifts = await this.getShiftsRemote();
    await wait();
    return shifts;
  }

  async getSchedulePeople(): Promise<SchedulePersonRecord[]> {
    const { data } = await this.supabase
      .from("employees")
      .select("id,name,phone,color")
      .order("created_at", { ascending: false });
    await wait();
    return (data ?? []).map((row) =>
      mapSchedulePersonRow(row as Record<string, unknown>),
    );
  }

  async createSchedulePerson(input: {
    name: string;
    employeePhone: string;
    color: string;
  }): Promise<SchedulePersonRecord> {
    const normalized = normalizePhone(input.employeePhone);
    const { data } = await this.supabase
      .from("employees")
      .upsert(
        {
          name: input.name.trim(),
          phone: normalized,
          color: input.color,
        } as never,
        { onConflict: "phone" },
      )
      .select("id,name,phone,color")
      .single();
    await wait();
    return data
      ? mapSchedulePersonRow(data as Record<string, unknown>)
      : {
          id: "",
          name: input.name.trim(),
          employeePhone: normalized,
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
        color: input.color,
      } as never)
      .eq("id", personId)
      .select("id,name,phone,color")
      .maybeSingle();
    await wait();
    return data ? mapSchedulePersonRow(data as Record<string, unknown>) : null;
  }

  async deleteSchedulePerson(personId: string): Promise<void> {
    await this.supabase.from("employees").delete().eq("id", personId);
    await wait();
  }

  async getTimelineShifts(nowIso: string, shifts: Shift[]): Promise<Shift[]> {
    void nowIso;
    const today = shifts.filter((shift) => isToday(shift.startAt));
    await wait();
    return today;
  }

  async createShift(shift: Omit<Shift, "id">): Promise<Shift> {
    const { data } = await this.supabase
      .from("shifts")
      .insert({
        employee_phone: shift.employeePhone,
        employee_name: shift.employeeName,
        start_at: shift.startAt,
        end_at: shift.endAt,
      } as never)
      .select("*")
      .single();
    await wait();
    return data
      ? mapShiftRow(data as Record<string, unknown>)
      : { id: "", ...shift };
  }

  async createShifts(shifts: Omit<Shift, "id">[]): Promise<void> {
    if (shifts.length === 0) {
      return;
    }
    await this.supabase.from("shifts").insert(
      shifts.map((shift) => ({
        employee_phone: shift.employeePhone,
        employee_name: shift.employeeName,
        start_at: shift.startAt,
        end_at: shift.endAt,
      })) as never,
    );
    await wait();
  }

  async updateShift(
    shiftId: string,
    payload: Partial<
      Pick<Shift, "employeeName" | "employeePhone" | "startAt" | "endAt">
    >,
  ): Promise<Shift | null> {
    const { data } = await this.supabase
      .from("shifts")
      .update({
        ...(payload.employeeName !== undefined
          ? { employee_name: payload.employeeName }
          : {}),
        ...(payload.employeePhone !== undefined
          ? { employee_phone: payload.employeePhone }
          : {}),
        ...(payload.startAt !== undefined ? { start_at: payload.startAt } : {}),
        ...(payload.endAt !== undefined ? { end_at: payload.endAt } : {}),
      } as never)
      .eq("id", shiftId)
      .select("*")
      .maybeSingle();
    await wait();
    return data ? mapShiftRow(data as Record<string, unknown>) : null;
  }

  async deleteShift(shiftId: string): Promise<void> {
    await this.supabase.from("shifts").delete().eq("id", shiftId);
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
    const map = new Map<string, RangeWorkStatRow>();
    for (const record of punches) {
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
            new Date(b.checkedInAt).getTime() -
            new Date(a.checkedInAt).getTime(),
        ),
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
    const totalSeconds = rows.reduce((sum, row) => sum + row.totalSeconds, 0);
    await wait();
    return { rows, totalSeconds };
  }
}

const hasSupabaseEnv =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const workApi = hasSupabaseEnv
  ? new SupabaseWorkApi()
  : new LocalWorkApi();
