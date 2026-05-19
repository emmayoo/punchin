import type { SchedulePerson } from "@/components/schedule/schedule-types";
import { schedulePersonSelectLabel } from "@/lib/branch-display-name";
import { DEFAULT_MEMBER_COLOR } from "@/lib/constants/color";
import type { BranchMemberListItem } from "@/types/work";

export type StaffPersonOption = {
  id: string;
  label: string;
  color: string;
};

export function schedulePersonToStaffOption(person: SchedulePerson): StaffPersonOption {
  return {
    id: person.id,
    label: schedulePersonSelectLabel(person.name, person.nickname),
    color: person.color?.trim() || DEFAULT_MEMBER_COLOR,
  };
}

export function branchMemberToStaffOption(member: BranchMemberListItem): StaffPersonOption {
  return {
    id: member.employeeId,
    label: member.name,
    color: member.color?.trim() || DEFAULT_MEMBER_COLOR,
  };
}
