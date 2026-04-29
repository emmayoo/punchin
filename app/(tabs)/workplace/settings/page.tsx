"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { DetailPageShell } from "@/components/layout/detail-page-shell";
import { workApi } from "@/lib/api/work-api";
import { toast } from "@/lib/toast";

export default function WorkplaceSettingsPage() {
  const { data, refresh } = useDashboardData();
  const [branchName, setBranchName] = useState("");
  const [saving, setSaving] = useState(false);

  const currentBranch = useMemo(() => {
    if (!data?.session?.currentBranchId) {
      return null;
    }
    return data.branches.find((branch) => branch.id === data.session?.currentBranchId) ?? null;
  }, [data]);

  const canManageCurrentBranch =
    !!currentBranch && !!data?.session && currentBranch.createdByPhone === data.session.phone;

  const effectiveBranchName = branchName || currentBranch?.name || "";

  const handleSave = async () => {
    if (!data?.session || !currentBranch || !canManageCurrentBranch) {
      return;
    }
    const trimmed = effectiveBranchName.trim();
    if (!trimmed) {
      toast.error("지점명을 입력해주세요.");
      return;
    }
    setSaving(true);
    const updated = await workApi.updateMyCreatedBranch(
      currentBranch.id,
      data.session.phone,
      trimmed,
    );
    setSaving(false);
    if (!updated) {
      toast.error("지점 정보를 저장하지 못했습니다.");
      return;
    }
    setBranchName(updated.name);
    await refresh();
    window.dispatchEvent(new Event("workplace:changed"));
    toast.success("지점명을 수정했습니다.");
  };

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

  if (!canManageCurrentBranch) {
    return (
      <DetailPageShell
        backHref="/workplace"
        title="지점 설정"
        className="gap-4"
        contentClassName="gap-4"
      >
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-sm text-zinc-700 dark:text-neutral-300">
            현재 선택한 지점은 관리 권한이 없습니다.
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
      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs text-zinc-500 dark:text-neutral-500">기본 정보</p>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-zinc-500 dark:text-neutral-500">사업자 번호</dt>
              <dd className="mt-0.5 text-zinc-900 dark:text-neutral-100">
                {currentBranch.businessNumber || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500 dark:text-neutral-500">주소</dt>
              <dd className="mt-0.5 text-zinc-900 dark:text-neutral-100">
                {currentBranch.address?.trim() || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500 dark:text-neutral-500">가게 번호</dt>
              <dd className="mt-0.5 text-zinc-900 dark:text-neutral-100">
                {currentBranch.storePhone?.trim() || "-"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5">
          <label htmlFor="branch-name" className="text-xs text-zinc-500 dark:text-neutral-500">
            지점명
          </label>
          <input
            id="branch-name"
            value={effectiveBranchName}
            onChange={(event) => setBranchName(event.target.value)}
            placeholder="지점명을 입력하세요"
            className="mt-2 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60 dark:bg-white dark:text-neutral-950"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <Link
              href="/workplace"
              className="rounded-xl border border-zinc-200/80 px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-white/10 dark:text-neutral-300 dark:hover:border-white/20 dark:hover:text-white"
            >
              돌아가기
            </Link>
          </div>
        </div>
      </div>
    </DetailPageShell>
  );
}
