import type { Branch, BranchMembership, BranchRole, Employee } from "@/types/work";

export type WorkplaceBranchAccess = {
  /** 활성 멤버십 역할 (없으면 null) */
  membershipRole: BranchRole | null;
  /** 멤버십 행이 없어도 지점 생성자면 true (레거시·데이터 불일치 보완) */
  isLegacyCreator: boolean;
};

export function resolveWorkplaceBranchAccess(
  branch: Branch | null,
  session: Employee | null,
  memberships: BranchMembership[],
): WorkplaceBranchAccess | null {
  if (!branch || !session) {
    return null;
  }
  const membership = memberships.find((item) => item.branchId === branch.id);
  const isLegacyCreator =
    !membership &&
    (branch.createdByPhone === session.phone || branch.createdByEmployeeId === session.id);
  return {
    membershipRole: membership?.role ?? null,
    isLegacyCreator,
  };
}

/** 지점명 등 기본 정보 수정 — 소유자(멤버십 owner 또는 레거시 생성자) */
export function canEditBranchBasicInfo(access: WorkplaceBranchAccess): boolean {
  return access.membershipRole === "owner" || access.isLegacyCreator;
}

/** 직원 초대·역할·퇴사 처리 — 매니저 이상 */
export function canManageBranchStaff(access: WorkplaceBranchAccess): boolean {
  return (
    access.membershipRole === "manager" ||
    access.membershipRole === "owner" ||
    access.isLegacyCreator
  );
}

/** 설정 화면 진입(톱니 표시) — 매니저 이상과 소유자 플로우 */
export function canOpenWorkplaceSettings(access: WorkplaceBranchAccess): boolean {
  return canManageBranchStaff(access);
}

/** 지점 삭제 — 소유자만 */
export function canDeleteBranch(access: WorkplaceBranchAccess): boolean {
  return access.membershipRole === "owner" || access.isLegacyCreator;
}
