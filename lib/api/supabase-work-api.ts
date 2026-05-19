"use client";

import {
  BRANCH_MEMBER_FALLBACK,
  branchMemberName,
  readStoredBranchName,
} from "@/lib/branch-display-name";
import { DEFAULT_MEMBER_COLOR } from "@/lib/constants/color";
import { todayCalendarEvents } from "@/lib/calendar/events";
import { mapEmployeeRow } from "@/lib/api/employee-map";
import {
  schedulePersonFromEmployeeRow,
  schedulePersonFromMembershipRow,
  sortSchedulePeople,
} from "@/lib/api/schedule-person-map";
import type {
  BranchSetupInput,
  DashboardData,
  NoticeInput,
  RangeWorkStatRow,
  WeeklyStatRow,
} from "@/lib/api/work-api-types";
import {
  type ActorBranchAccess,
  buildRangeWorkStatsFromPunches,
  canEditNoticeByRole,
  embeddedEmployeeFromRow,
  mapBranchFormerMemberListRow,
  mapBranchMemberListRow,
  mapBranchMembershipRow,
  mapBranchRole,
  mapBranchRow,
  mapEventRow,
  mapNoticeAttachmentRow,
  mapNoticeRow,
  mapPunchRow,
  mapShiftRow,
  normalizePhone,
  wait,
} from "@/lib/api/work-api-shared";
import { clearSession } from "@/lib/storage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  newAvatarStoragePath,
  newBranchProfileStoragePath,
  newNoticeAttachmentStoragePath,
  uploadPublicImage,
} from "@/lib/supabase/media-upload";
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

export class SupabaseWorkApi {
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

  async updateMyProfile(
    phone: string,
    payload: { name: string; birthDate: string | null },
  ): Promise<Employee | null> {
    const normalized = normalizePhone(phone);
    const birthTrimmed = payload.birthDate?.trim() ?? "";
    const birthDate = birthTrimmed === "" ? null : birthTrimmed;
    const { data } = await this.supabase
      .from("employees")
      .update({
        name: payload.name.trim(),
        birth_date: birthDate,
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
        branchId === null ? null : (memberships.find((item) => item.branchId === branchId) ?? null);
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
      const todayKey = toDateKey(new Date());
      const schedulePeople = await this.getSchedulePeople();
      const todayEvents = todayCalendarEvents(
        events,
        schedulePeople,
        session?.currentBranchId ?? null,
        todayKey,
      );
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

  async createNotice(
    branchId: string,
    input: NoticeInput,
    actorPhone: string,
  ): Promise<Notice | null> {
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
    const [created] = await this.listNotices(branchId).then((rows) =>
      rows.filter((n) => n.id === notice.id),
    );
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
    const [updatedNotice] = await this.listNotices(branchId).then((rows) =>
      rows.filter((n) => n.id === noticeId),
    );
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
        .select("id,name,phone,birth_date")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      await wait();
      return sortSchedulePeople(
        (data ?? []).map((row) => schedulePersonFromEmployeeRow(row as Record<string, unknown>)),
      );
    }

    const { data } = await this.supabase
      .from("branch_memberships")
      .select(
        "color, nickname, employee:employees!employee_id(id,name,phone,birth_date,deleted_at)",
      )
      .eq("branch_id", branchId)
      .is("ended_at", null)
      .is("deleted_at", null);
    await wait();

    const rows: SchedulePersonRecord[] = [];
    for (const rowRaw of data ?? []) {
      const mapped = schedulePersonFromMembershipRow(rowRaw as Record<string, unknown>);
      if (mapped) {
        rows.push(mapped);
      }
    }
    return sortSchedulePeople(rows);
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
    if (!data) {
      return null;
    }
    const row = data as Record<string, unknown>;
    const legalName = String(row.name).trim() || BRANCH_MEMBER_FALLBACK;
    return {
      id: String(row.id),
      name: legalName,
      nickname: null,
      employeePhone: String(row.phone),
      color: input.color,
    };
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
