"use client";

import { useMemo } from "react";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { DetailPageShell } from "@/components/layout/detail-page-shell";
import { WorkplaceNoticesBoard } from "@/components/workplace/workplace-notices-board";
import { resolveWorkplaceBranchAccess } from "@/components/workplace/settings/workplace-settings-access";

export default function WorkplaceNoticesPage() {
  const { data, loading } = useDashboardData({ pollMs: null });

  const currentBranchId = useMemo(
    () => data?.session?.currentBranchId ?? data?.myBranches[0]?.id ?? null,
    [data],
  );
  const currentBranch = data?.branches.find((branch) => branch.id === currentBranchId) ?? null;
  const access =
    currentBranch && data?.session
      ? resolveWorkplaceBranchAccess(currentBranch, data.session, data.myBranchMemberships)
      : null;
  const actorRole = access?.isLegacyCreator ? "creator" : (access?.membershipRole ?? null);

  return (
    <DetailPageShell backHref="/workplace" title="공지 사항" loading={loading || !data}>
      {() =>
        data ? (
          <WorkplaceNoticesBoard
            branchId={currentBranchId}
            actorPhone={data.session?.phone ?? null}
            actorEmployeeId={data.session?.id ?? null}
            actorRole={actorRole}
          />
        ) : null
      }
    </DetailPageShell>
  );
}
