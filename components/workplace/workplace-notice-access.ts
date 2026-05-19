import type { BranchRole, Notice } from "@/types/work";

export function isNoticeAuthor(
  notice: Notice,
  actorEmployeeId: string | null,
): boolean {
  return Boolean(actorEmployeeId && notice.authorEmployeeId === actorEmployeeId);
}

export function canEditNotice(
  notice: Notice,
  actorEmployeeId: string | null,
  actorRole: BranchRole | "creator" | null,
  roleByEmployeeId: ReadonlyMap<string, BranchRole>,
): boolean {
  if (!actorEmployeeId) {
    return false;
  }
  if (isNoticeAuthor(notice, actorEmployeeId)) {
    return true;
  }
  const authorRole = roleByEmployeeId.get(notice.authorEmployeeId) ?? null;
  if (actorRole === "creator" || actorRole === "owner") {
    return authorRole === "manager" || authorRole === "staff" || authorRole === null;
  }
  if (actorRole === "manager") {
    return authorRole === "staff" || authorRole === null;
  }
  return false;
}
