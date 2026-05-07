"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { DetailPageShell } from "@/components/layout/detail-page-shell";
import { WorkplaceNoticeEditor } from "@/components/workplace/workplace-notice-editor";
import { resolveWorkplaceBranchAccess } from "@/components/workplace/settings/workplace-settings-access";

export default function WorkplaceNoticeEditPage() {
  const params = useParams<{ id: string }>();
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
    <DetailPageShell backHref="/workplace/notices" title="공지 수정" loading={loading || !data}>
      {() =>
        data ? (
          <WorkplaceNoticeEditor
            mode="edit"
            noticeId={params.id}
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
