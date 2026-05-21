"use client";

import type { RangeWorkStatRow } from "@/lib/api/work-api-types";
import { branchMemberName, readStoredBranchName } from "@/lib/branch-display-name";
import { DEFAULT_MEMBER_COLOR } from "@/lib/constants/color";
import {
  getBranches,
  getBranchMemberships,
  getBranchMembershipsForBranch,
  getEmployees,
} from "@/lib/storage";
import type {
  Branch,
  BranchFormerMemberListItem,
  BranchMemberListItem,
  BranchMembership,
  BranchRole,
  CalendarEvent,
  Notice,
  NoticeAttachment,
  PunchRecord,
  Shift,
} from "@/types/work";

export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "").slice(0, 11);
}

export function mapBranchRole(roleStr: string): BranchRole {
  if (roleStr === "owner") {
    return "owner";
  }
  if (roleStr === "manager") {
    return "manager";
  }
  return "staff";
}

export function embeddedEmployeePhone(row: Record<string, unknown>): string {
  const raw = row.employee as { phone?: unknown } | null | undefined;
  if (raw && typeof raw === "object" && raw !== null && "phone" in raw) {
    return String(raw.phone ?? "");
  }
  return "";
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function mapShiftRow(row: Record<string, unknown>): Shift {
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

export function mapPunchRow(row: Record<string, unknown>): PunchRecord {
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

export function mapEventRow(row: Record<string, unknown>): CalendarEvent {
  return {
    id: String(row.id),
    date: String(row.date),
    title: String(row.title),
    color: String(row.color),
    branchId: row.branch_id ? String(row.branch_id) : null,
  };
}

export function mapNoticeRow(row: Record<string, unknown>): Notice {
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

export function mapNoticeAttachmentRow(row: Record<string, unknown>): NoticeAttachment {
  return {
    id: String(row.id),
    noticeId: String(row.notice_id),
    imageUrl: String(row.image_url ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function mapBranchRow(row: Record<string, unknown>, creatorPhone?: string): Branch {
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

export function embeddedEmployeeFromRow(
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

export function mapBranchMembershipRow(
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
        : DEFAULT_MEMBER_COLOR,
    role: mapBranchRole(String(row.role)),
  };
}

export type ActorBranchAccess = { role: BranchRole } | "creator" | null;

export function mapBranchMemberListRow(row: Record<string, unknown>): BranchMemberListItem {
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

export function mapBranchFormerMemberListRow(
  row: Record<string, unknown>,
): BranchFormerMemberListItem {
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

export function localResolveActorBranchRole(
  branchId: string,
  actorPhone: string,
): ActorBranchAccess {
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

export function localIsOwnerAccess(access: ActorBranchAccess): boolean {
  return access === "creator" || access?.role === "owner";
}

export function localIsManagerUp(access: ActorBranchAccess): boolean {
  return access === "creator" || access?.role === "owner" || access?.role === "manager";
}

export function canEditNoticeByRole(
  actorAccess: ActorBranchAccess,
  authorRole: BranchRole | null,
  isAuthor: boolean,
): boolean {
  if (isAuthor) {
    return true;
  }
  const actorRole: BranchRole | "creator" | null =
    actorAccess === "creator" ? "creator" : (actorAccess?.role ?? null);
  if (actorRole === "creator" || actorRole === "owner") {
    return authorRole === "manager" || authorRole === "staff" || authorRole === null;
  }
  if (actorRole === "manager") {
    return authorRole === "staff" || authorRole === null;
  }
  return false;
}

export function localCountOwners(branchId: string): number {
  return getBranchMembershipsForBranch(branchId).filter((item) => item.role === "owner").length;
}

/** 조회 구간과 겹치는 근무를 집계. 퇴근 전(`checkedOutAt` 없음)은 현재 시각까지 clip 해 그리드와 맞춘다. */
export function buildRangeWorkStatsFromPunches(
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
