"use client";

import Link from "next/link";
import { useMemo } from "react";

import { DEFAULT_MEMBER_COLOR } from "@/components/workplace/use-branch-member-colors";
import { BRANCH_ROLE_LABEL, branchMemberDisplayName, sortBranchMembers } from "@/lib/branch-role";
import { normalizePhone } from "@/lib/phone";
import { formatDateOnlyKo } from "@/lib/time";
import type { BranchMemberListItem } from "@/types/work";

import { WorkplaceSettingsPanel } from "./workplace-settings-panel";

type WorkplaceSettingsStaffSummaryProps = {
  sessionPhone: string;
  members: BranchMemberListItem[];
  membersLoading: boolean;
  canManage: boolean;
};

export function WorkplaceSettingsStaffSummary({
  sessionPhone,
  members,
  membersLoading,
  canManage,
}: WorkplaceSettingsStaffSummaryProps) {
  const sessionNp = useMemo(() => normalizePhone(sessionPhone), [sessionPhone]);
  const sortedMembers = useMemo(() => sortBranchMembers(members), [members]);

  if (!canManage) {
    return (
      <WorkplaceSettingsPanel>
        <p className="text-xs font-medium text-zinc-500 dark:text-neutral-500">직원 관리</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-neutral-400">
          직원 초대·역할 변경은 매니저 이상만 할 수 있습니다.
        </p>
      </WorkplaceSettingsPanel>
    );
  }

  return (
    <WorkplaceSettingsPanel className="relative">
      <Link
        href="/workplace/settings/staff"
        className="absolute right-4 top-4 z-10 rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-white/15 dark:bg-neutral-900/90 dark:text-neutral-300 dark:hover:border-white/25 dark:hover:text-white"
      >
        수정
      </Link>

      <div className="space-y-3">
        <div className="pr-14">
          <p className="text-xs font-medium text-zinc-500 dark:text-neutral-500">직원 관리</p>
          {!membersLoading ? (
            <p className="mt-1 text-sm tabular-nums text-zinc-800 dark:text-neutral-200">
              직원 {members.length}명
            </p>
          ) : null}
        </div>

        {membersLoading ? (
          <p className="text-sm text-zinc-600 dark:text-neutral-400">불러오는 중...</p>
        ) : sortedMembers.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-neutral-400">등록된 직원이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200/80 text-xs text-zinc-500 dark:border-white/10 dark:text-neutral-500">
                  <th className="pb-2 font-medium">이름</th>
                  <th className="pb-2 font-medium">역할</th>
                  <th className="whitespace-nowrap pb-2 font-medium">입사일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70 dark:divide-white/10">
                {sortedMembers.map((row) => {
                  const isSelf = normalizePhone(row.phone) === sessionNp;
                  const memberColor = row.color ?? DEFAULT_MEMBER_COLOR;
                  return (
                    <tr key={row.membershipId}>
                      <td className="flex items-center gap-2 py-2 pr-2 text-zinc-900 dark:text-neutral-100">
                        <span
                          className="inline-block size-4 shrink-0 rounded-full border border-zinc-200/80 dark:border-white/20"
                          style={{ backgroundColor: memberColor }}
                          title={memberColor.toUpperCase()}
                          aria-label={`${branchMemberDisplayName(row.name, isSelf)} 스케줄 색`}
                        />
                        {branchMemberDisplayName(row.name, isSelf)}
                      </td>
                      <td className="py-2 pr-2 text-zinc-700 dark:text-neutral-300">
                        {BRANCH_ROLE_LABEL[row.role]}
                      </td>
                      <td className="whitespace-nowrap py-2 tabular-nums text-zinc-700 dark:text-neutral-300">
                        {formatDateOnlyKo(row.joinedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </WorkplaceSettingsPanel>
  );
}
