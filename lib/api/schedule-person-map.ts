import { mapBirthDateFromRow, mapEmployeeRow } from "@/lib/api/employee-map";
import {
  BRANCH_MEMBER_FALLBACK,
  branchMemberName,
  readStoredBranchName,
} from "@/lib/branch-display-name";
import { DEFAULT_MEMBER_COLOR } from "@/lib/constants/color";
import { normalizePhone } from "@/lib/phone";
import type { BranchMembership, Employee, SchedulePersonRecord } from "@/types/work";

export function schedulePersonFromEmployee(employee: Employee): SchedulePersonRecord {
  const legalName = employee.name.trim() || BRANCH_MEMBER_FALLBACK;
  return {
    id: employee.id,
    name: legalName,
    nickname: null,
    employeePhone: employee.phone,
    color: DEFAULT_MEMBER_COLOR,
    birthDate: employee.birthDate ?? null,
  };
}

export function schedulePersonFromMembership(
  employee: Employee,
  membership: BranchMembership,
): SchedulePersonRecord {
  const legalName = employee.name.trim() || BRANCH_MEMBER_FALLBACK;
  const displayName = membership.name.trim();
  const nickname = displayName !== legalName ? displayName : null;
  const hex = membership.color?.trim();
  return {
    id: employee.id,
    name: legalName,
    nickname,
    employeePhone: employee.phone,
    color: hex || DEFAULT_MEMBER_COLOR,
    birthDate: employee.birthDate ?? null,
  };
}

export function schedulePersonFromEmployeeRow(row: Record<string, unknown>): SchedulePersonRecord {
  const employee = mapEmployeeRow(row);
  const legalName = employee.name.trim() || BRANCH_MEMBER_FALLBACK;
  return {
    id: employee.id,
    name: legalName,
    nickname: null,
    employeePhone: employee.phone,
    color: DEFAULT_MEMBER_COLOR,
    birthDate: employee.birthDate,
  };
}

export function schedulePersonFromMembershipRow(
  row: Record<string, unknown>,
): SchedulePersonRecord | null {
  const empRaw = row.employee as Record<string, unknown> | null | undefined;
  if (!empRaw || empRaw.deleted_at != null) {
    return null;
  }
  const employee = mapEmployeeRow(empRaw);
  const nickRaw = readStoredBranchName(row);
  const legalName = employee.name.trim() || BRANCH_MEMBER_FALLBACK;
  const nickTrimmed = nickRaw?.trim() ?? "";
  const nickname = nickTrimmed !== "" && nickTrimmed !== legalName ? nickTrimmed : null;
  const hexRaw = row.color !== undefined && row.color !== null ? String(row.color).trim() : "";
  return {
    id: employee.id,
    name: legalName,
    nickname,
    employeePhone: normalizePhone(employee.phone),
    color: hexRaw || DEFAULT_MEMBER_COLOR,
    birthDate: mapBirthDateFromRow(empRaw),
  };
}

export function sortSchedulePeople(rows: SchedulePersonRecord[]): SchedulePersonRecord[] {
  return [...rows].sort((a, b) =>
    branchMemberName(a.nickname, a.name).localeCompare(branchMemberName(b.nickname, b.name), "ko"),
  );
}
