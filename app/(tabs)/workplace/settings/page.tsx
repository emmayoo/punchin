"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { DetailPageShell } from "@/components/layout/detail-page-shell";
import {
  canDeleteBranch,
  canEditBranchBasicInfo,
  canManageBranchStaff,
  canOpenWorkplaceSettings,
  resolveWorkplaceBranchAccess,
} from "@/components/workplace/settings/workplace-settings-access";
import { WorkplaceSettingsBranchSection } from "@/components/workplace/settings/workplace-settings-branch-section";
import { WorkplaceSettingsDangerZone } from "@/components/workplace/settings/workplace-settings-danger-zone";
import { WorkplaceSettingsStaffSummary } from "@/components/workplace/settings/workplace-settings-staff-summary";
import { workApi } from "@/lib/api/work-api";
import type { BranchMemberListItem } from "@/types/work";

export default function WorkplaceSettingsPage() {
  const { data, refresh } = useDashboardData();
  const [members, setMembers] = useState<BranchMemberListItem[]>([]);
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
  const canEditBasic = access ? canEditBranchBasicInfo(access) : false;
  const canStaff = access ? canManageBranchStaff(access) : false;
  const canDelete = access ? canDeleteBranch(access) : false;

  const currentBranchId = currentBranch?.id ?? null;
  const sessionPhone = data?.session?.phone ?? null;

  useEffect(() => {
    if (!sessionPhone || !currentBranchId) {
      return;
    }

    const showLoading = !hasLoadedMembersRef.current;
    if (showLoading) {
      setMembersLoading(true);
    }

    (async () => {
      const rows = await workApi.listBranchMembers(currentBranchId, sessionPhone);
      setMembers(rows);
      hasLoadedMembersRef.current = true;
      if (showLoading) {
        setMembersLoading(false);
      }
    })().catch(() => {
      if (showLoading) {
        setMembersLoading(false);
      }
    });
  }, [currentBranchId, sessionPhone]);

  if (!data) {
    return (
      <DetailPageShell backHref="/workplace" title="지점 설정" loading>
        <></>
      </DetailPageShell>
    );
  }

  if (!currentBranch) {
    return (
      <DetailPageShell
        backHref="/workplace"
        title="지점 설정"
        className="gap-4"
        contentClassName="gap-4"
      >
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-sm text-zinc-700 dark:text-neutral-300">
            현재 선택된 지점이 없습니다.
          </p>
        </div>
      </DetailPageShell>
    );
  }

  if (!access || !showSettingsChrome) {
    return (
      <DetailPageShell
        backHref="/workplace"
        title="지점 설정"
        className="gap-4"
        contentClassName="gap-4"
      >
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-sm text-zinc-700 dark:text-neutral-300">
            이 지점 설정은 매니저 이상만 이용할 수 있습니다.
          </p>
        </div>
        <Link
          href="/workplace"
          className="inline-flex w-fit rounded-xl border border-zinc-200/80 px-3 py-2 text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-white/10 dark:text-neutral-300 dark:hover:border-white/20 dark:hover:text-white"
        >
          지점 대시보드로 돌아가기
        </Link>
      </DetailPageShell>
    );
  }

  return (
    <DetailPageShell
      backHref="/workplace"
      title="지점 설정"
      className="gap-4"
      contentClassName="gap-4"
    >
      <WorkplaceSettingsBranchSection
        branch={currentBranch}
        canEdit={canEditBasic}
        editHref="/workplace/settings/branch/edit"
      />

      <WorkplaceSettingsStaffSummary
        sessionPhone={data.session!.phone}
        members={members}
        membersLoading={membersLoading}
        canManage={canStaff}
      />

      <WorkplaceSettingsDangerZone
        branch={currentBranch}
        session={data.session!}
        canDelete={canDelete}
        onAfterDelete={async () => {
          await refresh();
        }}
      />
    </DetailPageShell>
  );
}
