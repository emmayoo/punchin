import { normalizePhone } from "@/lib/phone";
import type { BranchFormerMemberListItem } from "@/types/work";

function leftAtMs(iso: string | null | undefined): number {
  return iso ? new Date(iso).getTime() : -1;
}

export function formerMemberKey(row: Pick<BranchFormerMemberListItem, "employeeId" | "phone">): string {
  return row.employeeId || normalizePhone(row.phone);
}

/** 직원별 최신 제외 이력만, 제외일 내림차순 */
export function dedupeLatestFormerMembers(
  formerMembers: BranchFormerMemberListItem[],
): BranchFormerMemberListItem[] {
  const byEmployee = new Map<string, BranchFormerMemberListItem>();
  for (const row of formerMembers) {
    const key = formerMemberKey(row);
    const prev = byEmployee.get(key);
    if (!prev || leftAtMs(row.leftAt) >= leftAtMs(prev.leftAt)) {
      byEmployee.set(key, row);
    }
  }
  return [...byEmployee.values()].sort((a, b) => leftAtMs(b.leftAt) - leftAtMs(a.leftAt));
}
