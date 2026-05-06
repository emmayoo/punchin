"use client";

import Link from "next/link";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { DetailPageShell } from "@/components/layout/detail-page-shell";
import { ScheduleClient } from "@/components/schedule/schedule-client";
import {
  canManageWorkplaceSchedule,
  resolveWorkplaceBranchAccess,
} from "@/components/workplace/settings/workplace-settings-access";

export default function WorkplaceSchedulePage() {
  const { data } = useDashboardData();

  if (!data) {
    return (
      <DetailPageShell backHref="/workplace" title="스케줄 관리" loading>
        <></>
      </DetailPageShell>
    );
  }

  const currentBranch = data.session?.currentBranchId
    ? (data.branches.find((branch) => branch.id === data.session?.currentBranchId) ?? null)
    : null;

  const access =
    currentBranch && data.session
      ? resolveWorkplaceBranchAccess(currentBranch, data.session, data.myBranchMemberships)
      : null;

  const canManage = access ? canManageWorkplaceSchedule(access) : false;

  if (!currentBranch) {
    return (
      <DetailPageShell
        backHref="/workplace"
        title="스케줄 관리"
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

  if (!access || !canManage) {
    return (
      <DetailPageShell
        backHref="/workplace"
        title="스케줄 관리"
        className="gap-4"
        contentClassName="gap-4"
      >
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-sm text-zinc-700 dark:text-neutral-300">
            스케줄 관리는 매니저 이상만 이용할 수 있습니다.
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

  return <ScheduleClient />;
}
