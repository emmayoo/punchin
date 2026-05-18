import type { BranchMemberListItem, BranchRole } from "@/types/work";

export const BRANCH_ROLE_LABEL: Record<BranchRole, string> = {
  owner: "소유자",
  manager: "매니저",
  staff: "직원",
};

const BRANCH_ROLE_ORDER: BranchRole[] = ["owner", "manager", "staff"];

export function sortBranchMembers<T extends { role: BranchRole; name: string }>(
  members: T[],
): T[] {
  return [...members].sort(
    (a, b) =>
      BRANCH_ROLE_ORDER.indexOf(a.role) - BRANCH_ROLE_ORDER.indexOf(b.role) ||
      a.name.localeCompare(b.name, "ko"),
  );
}

export function canEditBranchMemberRow(
  actorHasOwnerPowers: boolean,
  memberRole: BranchRole,
): boolean {
  return actorHasOwnerPowers || memberRole === "staff";
}

/** 표 작업 열과 동일 — 역할 변경 가능 대상 중 지점 제외 가능한 사람만 */
export function memberCanBeTerminatedFromBranch(
  row: Pick<BranchMemberListItem, "role">,
  actorHasOwnerPowers: boolean,
  ownerCount: number,
): boolean {
  if (!canEditBranchMemberRow(actorHasOwnerPowers, row.role)) {
    return false;
  }
  if (actorHasOwnerPowers) {
    return row.role !== "owner" || ownerCount > 1;
  }
  return row.role === "staff";
}

export function branchMemberRoleChoices(
  actorHasOwnerPowers: boolean,
  currentRole: BranchRole,
): BranchRole[] {
  const base: BranchRole[] = actorHasOwnerPowers
    ? ["staff", "manager", "owner"]
    : ["staff", "manager"];
  return base.includes(currentRole) ? base : [...base, currentRole];
}

export function branchMemberDisplayName(name: string, isSelf: boolean): string {
  return isSelf ? `${name} (나)` : name;
}
