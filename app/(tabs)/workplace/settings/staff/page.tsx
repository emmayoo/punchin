"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { DetailPageShell } from "@/components/layout/detail-page-shell";
import {
  canDeleteBranch,
  canManageBranchStaff,
  canOpenWorkplaceSettings,
  resolveWorkplaceBranchAccess,
} from "@/components/workplace/settings/workplace-settings-access";
import { WorkplaceSettingsStaffSection } from "@/components/workplace/settings/workplace-settings-staff-section";
import { workApi } from "@/lib/api/work-api";
import type { BranchFormerMemberListItem, BranchMemberListItem } from "@/types/work";

export default function WorkplaceStaffEditPage() {
  const { data, refresh } = useDashboardData();
  const [members, setMembers] = useState<BranchMemberListItem[]>([]);
  const [formerMembers, setFormerMembers] = useState<BranchFormerMemberListItem[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const hasLoadedMembersRef = useRef(false);

  const currentBranch = useMemo(() => {
    if (!data?.session?.currentBranchId) {
      return null;
    }
    return data.branches.find((branch) => branch.id === data.session?.currentBranchId) ?? null;
  }, [data]);

  const access = useMemo(
    () => resolveWorkplaceBranchAccess(currentBranch, data?.session ?? null, data?.myBranchMemberships ?? []),
    [currentBranch, data?.session, data?.myBranchMemberships],
  );

  const showSettingsChrome = access ? canOpenWorkplaceSettings(access) : false;
  const canStaff = access ? canManageBranchStaff(access) : false;
  const actorHasOwnerPowers = access ? canDeleteBranch(access) : false;

  const loadMembers = useCallback(async () => {
    if (!data?.session || !currentBranch) {
      return;
    }
    const showLoading = !hasLoadedMembersRef.current;
    if (showLoading) {
      setMembersLoading(true);
    }
    const [rows, formerRows] = await Promise.all([
      workApi.listBranchMembers(currentBranch.id, data.session.phone),
      workApi.listFormerBranchMembers(currentBranch.id, data.session.phone),
    ]);
    setMembers(rows);
    setFormerMembers(formerRows);
    hasLoadedMembersRef.current = true;
    if (showLoading) {
      setMembersLoading(false);
    }
  }, [currentBranch, data?.session]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const handleReloadAfterStaffChange = async () => {
    await refresh();
  };

  if (!data) {
    return (
      <DetailPageShell backHref="/workplace/settings" title="직원 관리" loading>
        <></>
      </DetailPageShell>
    );
  }

  if (!currentBranch) {
    return (
      <DetailPageShell
        backHref="/workplace/settings"
        title="직원 관리"
        className="gap-4"
        contentClassName="gap-4"
      >
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-sm text-zinc-700 dark:text-neutral-300">현재 선택된 지점이 없습니다.</p>
        </div>
      </DetailPageShell>
    );
  }

  if (!access || !showSettingsChrome) {
    return (
      <DetailPageShell
        backHref="/workplace/settings"
        title="직원 관리"
        className="gap-4"
        contentClassName="gap-4"
      >
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-sm text-zinc-700 dark:text-neutral-300">
            이 설정 화면은 매니저 이상만 이용할 수 있습니다.
          </p>
        </div>
        <Link
          href="/workplace/settings"
          className="inline-flex w-fit rounded-xl border border-zinc-200/80 px-3 py-2 text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-white/10 dark:text-neutral-300 dark:hover:border-white/20 dark:hover:text-white"
        >
          지점 설정으로 돌아가기
        </Link>
      </DetailPageShell>
    );
  }

  return (
    <DetailPageShell backHref="/workplace/settings" title="직원 관리" className="gap-4" contentClassName="gap-4">
      <WorkplaceSettingsStaffSection
        branchId={currentBranch.id}
        session={data.session!}
        members={members}
        formerMembers={formerMembers}
        loading={membersLoading}
        canManage={canStaff}
        actorHasOwnerPowers={actorHasOwnerPowers}
        onReload={handleReloadAfterStaffChange}
      />
    </DetailPageShell>
  );
}
