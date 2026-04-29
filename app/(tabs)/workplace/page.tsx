"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { TabPageShell } from "@/components/layout/tab-page-shell";
import { WorkplaceBranchSwitcher } from "@/components/workplace/workplace-branch-switcher";
import { WorkplaceHistoryEventsSection } from "@/components/workplace/workplace-history-events-section";
import { WorkplaceMonthlyStatsSection } from "@/components/workplace/workplace-monthly-stats-section";
import { WorkplaceNoticesSection } from "@/components/workplace/workplace-notices-section";
import { WorkplaceScheduleOverviewSection } from "@/components/workplace/workplace-schedule-overview-section";
import { WorkplaceTimelineSection } from "@/components/workplace/workplace-timeline-section";
import {
  canOpenWorkplaceSettings,
  resolveWorkplaceBranchAccess,
} from "@/components/workplace/settings/workplace-settings-access";
import { workApi } from "@/lib/api/work-api";
import { toast } from "@/lib/toast";

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
    selectedBranchId ??
    data.session?.currentBranchId ??
    data.myBranches[0]?.id ??
    null;
  const currentBranch =
    data.branches.find((branch) => branch.id === currentBranchId) ?? null;
  const currentBranchName = currentBranch?.name ?? "지점";
  const branchAccess =
    currentBranch && data.session
      ? resolveWorkplaceBranchAccess(currentBranch, data.session, data.myBranchMemberships)
      : null;
  const canManageCurrentBranch =
    !!branchAccess && canOpenWorkplaceSettings(branchAccess);
  const branchShifts = currentBranchId
    ? data.shifts.filter((shift) => shift.branchId === currentBranchId)
    : [];
  const branchPunches = currentBranchId
    ? data.punchRecords.filter((record) => record.branchId === currentBranchId)
    : [];
  const branchEvents = data.todayEvents.filter((event) =>
    currentBranchId
      ? event.branchId === currentBranchId
      : event.branchId == null
  );
  const handleSelectBranch = async (branchId: string) => {
    if (!data.session || branchId === currentBranchId) {
      return;
    }
    const previousBranchId = currentBranchId;
    setSelectedBranchId(branchId);
    setSwitchingBranch(true);
    const updated = await workApi.setCurrentBranch(
      data.session.phone,
      branchId
    );
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
              aria-label="지점 설정"
              title="지점 설정"
              className="inline-flex size-10 shrink-0 items-center justify-center text-zinc-700 transition-colors hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Settings
                className="size-[1.35rem]"
                strokeWidth={2}
                aria-hidden
              />
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
