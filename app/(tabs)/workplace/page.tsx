"use client";

import { TabPageShell } from "@/components/layout/tab-page-shell";
import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import Link from "next/link";
import { workApi } from "@/lib/api/work-api";
import { toast } from "@/lib/toast";
import { WorkplaceHistoryEventsSection } from "@/components/workplace/workplace-history-events-section";
import { WorkplaceMonthlyStatsSection } from "@/components/workplace/workplace-monthly-stats-section";
import { WorkplaceNoticesSection } from "@/components/workplace/workplace-notices-section";
import { WorkplaceScheduleOverviewSection } from "@/components/workplace/workplace-schedule-overview-section";
import { WorkplaceTimelineSection } from "@/components/workplace/workplace-timeline-section";
import { WorkplaceBranchSwitcher } from "@/components/workplace/workplace-branch-switcher";
import { useState } from "react";

export default function WorkplacePage() {
  const { data } = useDashboardData();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [switchingBranch, setSwitchingBranch] = useState(false);

  if (!data) {
    return (
      <TabPageShell title="" className="gap-3" bodyClassName="gap-3" loading>
        <></>
      </TabPageShell>
    );
  }

  const currentBranchId =
    selectedBranchId ?? data.session?.currentBranchId ?? data.myBranches[0]?.id ?? null;
  const currentBranch =
    data.branches.find((branch) => branch.id === currentBranchId) ?? null;
  const currentBranchName =
    currentBranch?.name ?? "지점";
  const canManageCurrentBranch =
    !!currentBranch && !!data.session && currentBranch.createdByPhone === data.session.phone;
  const branchShifts = currentBranchId
    ? data.shifts.filter((shift) => shift.branchId === currentBranchId)
    : [];
  const branchPunches = currentBranchId
    ? data.punchRecords.filter((record) => record.branchId === currentBranchId)
    : [];
  const branchEvents = data.todayEvents.filter((event) =>
    currentBranchId
      ? event.branchId === currentBranchId
      : event.branchId == null,
  );
  const handleSelectBranch = async (branchId: string) => {
    if (!data.session || branchId === currentBranchId) {
      return;
    }
    const previousBranchId = currentBranchId;
    setSelectedBranchId(branchId);
    setSwitchingBranch(true);
    const updated = await workApi.setCurrentBranch(data.session.phone, branchId);
    if (!updated?.currentBranchId) {
      setSelectedBranchId(previousBranchId);
      toast.error("지점 변경에 실패했습니다.");
    }
    setSwitchingBranch(false);
    window.dispatchEvent(new Event("workplace:changed"));
  };

  return (
    <TabPageShell title="" className="gap-3" bodyClassName="gap-3">
      <>
        <div className="flex items-start justify-between gap-3">
          <WorkplaceBranchSwitcher
            branches={data.myBranches}
            selectedBranchId={currentBranchId}
            busy={switchingBranch}
            onSelect={(branchId) => {
              void handleSelectBranch(branchId);
            }}
          />
          {canManageCurrentBranch ? (
            <Link
              href="/workplace/settings"
              className="shrink-0 rounded-xl border border-zinc-200/80 px-3 py-2 text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-white/10 dark:text-neutral-300 dark:hover:border-white/20 dark:hover:text-white"
            >
              지점 설정
            </Link>
          ) : null}
        </div>
        <WorkplaceTimelineSection
          shifts={branchShifts}
          punches={branchPunches}
          nowIso={new Date().toISOString()}
        />
        <WorkplaceHistoryEventsSection
          punches={branchPunches}
          events={branchEvents}
        />
        <WorkplaceMonthlyStatsSection punches={branchPunches} />
        <WorkplaceNoticesSection branchName={currentBranchName} />
        <WorkplaceScheduleOverviewSection shifts={branchShifts} />
      </>
    </TabPageShell>
  );
}
