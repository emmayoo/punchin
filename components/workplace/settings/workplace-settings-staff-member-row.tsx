"use client";

import { UserRoundX } from "lucide-react";

import { ColorPresetPicker } from "@/components/color-preset-picker";
import {
  BRANCH_ROLE_LABEL,
  branchMemberDisplayName,
  branchMemberRoleChoices,
  canEditBranchMemberRow,
  memberCanBeTerminatedFromBranch,
} from "@/lib/branch-role";
import { DEFAULT_MEMBER_COLOR } from "@/lib/constants/color";
import { isoToDateInputValue } from "@/lib/date-input-ko";
import { formatPhoneNumber, normalizePhone } from "@/lib/phone";
import { formatDateOnlyKo } from "@/lib/time";
import type { BranchMemberListItem, BranchRole } from "@/types/work";

const FIELD_INPUT_CLASS =
  "rounded-lg border border-zinc-200/90 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100";

type WorkplaceSettingsStaffMemberRowProps = {
  row: BranchMemberListItem;
  sessionNp: string;
  actorHasOwnerPowers: boolean;
  ownerCount: number;
  busyMembershipId: string | null;
  busyNameMembershipId: string | null;
  busyJoinedAtMembershipId: string | null;
  busyColorEmployeeId: string | null;
  onRoleChange: (membershipId: string, role: BranchRole) => void;
  onDisplayNameBlur: (row: BranchMemberListItem, value: string) => void;
  onJoinedAtBlur: (row: BranchMemberListItem, value: string) => void;
  onColorChange: (membershipId: string, employeeId: string, color: string) => void;
  onTerminate: (membershipId: string) => void;
};

export function WorkplaceSettingsStaffMemberRow({
  row,
  sessionNp,
  actorHasOwnerPowers,
  ownerCount,
  busyMembershipId,
  busyNameMembershipId,
  busyJoinedAtMembershipId,
  busyColorEmployeeId,
  onRoleChange,
  onDisplayNameBlur,
  onJoinedAtBlur,
  onColorChange,
  onTerminate,
}: WorkplaceSettingsStaffMemberRowProps) {
  const canEditRow = canEditBranchMemberRow(actorHasOwnerPowers, row.role);
  const isSelf = normalizePhone(row.phone) === sessionNp;
  const displayName = branchMemberDisplayName(row.name, isSelf);
  const memberColor = row.color ?? DEFAULT_MEMBER_COLOR;
  const canTerminate = memberCanBeTerminatedFromBranch(row, actorHasOwnerPowers, ownerCount);
  const roleChoices = branchMemberRoleChoices(actorHasOwnerPowers, row.role);

  return (
    <tr>
      <td className="py-2.5 text-zinc-900 dark:text-neutral-100">
        {canEditRow ? (
          <input
            key={`${row.membershipId}-${row.name}`}
            type="text"
            defaultValue={row.name}
            disabled={busyNameMembershipId === row.membershipId}
            onBlur={(event) => onDisplayNameBlur(row, event.target.value)}
            aria-label={isSelf ? "내 이름" : `${row.name} 이름`}
            className={`w-24 ${FIELD_INPUT_CLASS}`}
          />
        ) : (
          <span>{displayName}</span>
        )}
      </td>
      <td className="min-w-30 py-2.5 text-zinc-700 dark:text-neutral-300">
        {formatPhoneNumber(row.phone)}
      </td>
      <td className="py-2.5">
        {canEditRow ? (
          <select
            value={row.role}
            disabled={busyMembershipId === row.membershipId}
            onChange={(event) => onRoleChange(row.membershipId, event.target.value as BranchRole)}
            className={`text-xs ${FIELD_INPUT_CLASS}`}
          >
            {roleChoices.map((role) => (
              <option key={`${row.membershipId}-${role}`} value={role}>
                {BRANCH_ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-zinc-800 dark:text-neutral-200">{BRANCH_ROLE_LABEL[row.role]}</span>
        )}
      </td>
      <td className="py-2.5">
        {canEditRow ? (
          <ColorPresetPicker
            value={memberColor}
            disabled={busyColorEmployeeId === row.employeeId}
            onChange={(hex) => onColorChange(row.membershipId, row.employeeId, hex)}
            aria-label={`${displayName} 색상 선택`}
          />
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-4 w-4 rounded-full border border-zinc-200/80 dark:border-white/20"
              style={{ backgroundColor: memberColor }}
              aria-hidden
            />
            <span className="text-xs text-zinc-600 dark:text-neutral-300">
              {memberColor.toUpperCase()}
            </span>
          </div>
        )}
      </td>
      <td className="py-2.5 text-zinc-700 dark:text-neutral-300">
        {canEditRow ? (
          <input
            key={`${row.membershipId}-${row.joinedAt ?? ""}`}
            type="date"
            defaultValue={isoToDateInputValue(row.joinedAt)}
            disabled={busyJoinedAtMembershipId === row.membershipId}
            onBlur={(event) => onJoinedAtBlur(row, event.target.value)}
            aria-label={isSelf ? "내 입사일" : `${row.name} 입사일`}
            className={`w-32 tabular-nums ${FIELD_INPUT_CLASS}`}
          />
        ) : (
          <span className="tabular-nums">{formatDateOnlyKo(row.joinedAt)}</span>
        )}
      </td>
      <td className="py-2.5 text-right">
        {canTerminate ? (
          <button
            type="button"
            disabled={busyMembershipId === row.membershipId}
            onClick={() => onTerminate(row.membershipId)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200/80 text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/45 dark:text-rose-300 dark:hover:bg-rose-900/30"
            aria-label={`${displayName} 지점 연결 끊기`}
            title="지점 연결 끊기"
          >
            <UserRoundX className="h-4 w-4" />
          </button>
        ) : null}
      </td>
    </tr>
  );
}
