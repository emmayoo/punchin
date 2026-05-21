export const BRANCH_MEMBER_FALLBACK = "직원";

/** `branch_memberships.nickname` 원값 */
export function readStoredBranchName(row: Record<string, unknown>): string | null {
  if (!("nickname" in row)) {
    return null;
  }
  const raw = row.nickname;
  if (raw === null || raw === undefined) {
    return null;
  }
  const trimmed = String(raw).trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * 지점에서 보이는 이름.
 * `stored` = nickname 컬럼, `accountName` = employees.name (비울 때 되돌림)
 */
export function branchMemberName(stored: string | null | undefined, accountName: string): string {
  const branch = stored?.trim();
  if (branch) {
    return branch;
  }
  const account = accountName.trim();
  return account || BRANCH_MEMBER_FALLBACK;
}

/** 스케줄 담당자 셀렉트: `실명 (닉네임)` — 닉네임 없거나 실명과 같으면 실명만 */
export function schedulePersonSelectLabel(
  legalName: string,
  nickname: string | null | undefined,
): string {
  const base = legalName.trim() || BRANCH_MEMBER_FALLBACK;
  const nick = nickname?.trim();
  if (nick && nick !== base) {
    return `${base} (${nick})`;
  }
  return base;
}
