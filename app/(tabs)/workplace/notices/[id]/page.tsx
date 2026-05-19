"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { DetailPageShell } from "@/components/layout/detail-page-shell";
import { WorkplaceNoticeDetailCard } from "@/components/workplace/workplace-notice-detail-card";
import { resolveWorkplaceBranchAccess } from "@/components/workplace/settings/workplace-settings-access";
import { workApi } from "@/lib/api/work-api";
import type { BranchRole, Notice } from "@/types/work";

export default function WorkplaceNoticeDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, loading } = useDashboardData({ pollMs: null });
  const [slideIndex, setSlideIndex] = useState(0);
  const [noticeData, setNoticeData] = useState<Notice | null>(null);
  const [loadingNotice, setLoadingNotice] = useState(true);
  const [roleByEmployeeId, setRoleByEmployeeId] = useState<Map<string, BranchRole>>(new Map());

  const currentBranchId = useMemo(
    () => data?.session?.currentBranchId ?? data?.myBranches[0]?.id ?? null,
    [data],
  );
  const currentBranch = data?.branches.find((branch) => branch.id === currentBranchId) ?? null;
  const access = useMemo(
    () =>
      currentBranch && data?.session
        ? resolveWorkplaceBranchAccess(currentBranch, data.session, data.myBranchMemberships)
        : null,
    [currentBranch, data],
  );
  const actorRole = access?.isLegacyCreator ? "creator" : (access?.membershipRole ?? null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!currentBranchId || !data) {
        if (!mounted) {
          return;
        }
        setNoticeData(null);
        setLoadingNotice(false);
        return;
      }
      setLoadingNotice(true);
      const notices = await workApi.listNotices(currentBranchId);
      if (!mounted) {
        return;
      }
      const found = notices.find((n) => n.id === params.id) ?? null;
      setNoticeData(found);
      setSlideIndex(0);
      setLoadingNotice(false);
    })();
    return () => {
      mounted = false;
    };
  }, [currentBranchId, data, params.id]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const actorPhone = data?.session?.phone ?? null;
      if (!currentBranchId || !actorPhone) {
        if (!mounted) {
          return;
        }
        setRoleByEmployeeId(new Map());
        return;
      }
      const members = await workApi.listBranchMembers(currentBranchId, actorPhone);
      if (!mounted) {
        return;
      }
      setRoleByEmployeeId(
        new Map(members.map((member) => [member.employeeId, member.role] as const)),
      );
    })();
    return () => {
      mounted = false;
    };
  }, [currentBranchId, data?.session?.phone]);

  return (
    <DetailPageShell
      backHref="/workplace/notices"
      title="공지 상세"
      loading={loading || !data || loadingNotice}
    >
      {() =>
        noticeData ? (
          <WorkplaceNoticeDetailCard
            notice={noticeData}
            slideIndex={slideIndex}
            onSlideIndexChange={setSlideIndex}
            actorPhone={data?.session?.phone ?? null}
            actorEmployeeId={data?.session?.id ?? null}
            actorRole={actorRole}
            roleByEmployeeId={roleByEmployeeId}
            onNoticeChange={setNoticeData}
          />
        ) : (
          <p className="rounded-2xl border border-dashed border-zinc-300/90 px-4 py-10 text-center text-sm text-zinc-600 dark:border-white/15 dark:text-neutral-400">
            공지를 찾지 못했습니다.
          </p>
        )
      }
    </DetailPageShell>
  );
}
