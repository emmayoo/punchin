"use client";

import { FullscreenModal } from "@/components/overlay/fullscreen-modal";
import type { Branch, BranchRole } from "@/types/work";
import Image from "next/image";

type MypageBranchDetailModalProps = {
  open: boolean;
  branch: Branch | null;
  effectiveRole: BranchRole;
  isDefault: boolean;
  onClose: () => void;
};

export function MypageBranchDetailModal({
  open,
  branch,
  effectiveRole,
  isDefault,
  onClose,
}: MypageBranchDetailModalProps) {
  if (!open || !branch) {
    return null;
  }

  return (
    <FullscreenModal open>
      <div className="max-h-[min(70vh,520px)] space-y-4 overflow-y-auto pr-0.5">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
          지점 정보
        </h2>
        <div className="flex items-center gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-dashed border-zinc-300/90 bg-zinc-100 dark:border-white/20 dark:bg-neutral-900">
            {branch.profileImageUrl ? (
              branch.profileImageUrl.startsWith("data:") ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL from local pick
                <img
                  src={branch.profileImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={branch.profileImageUrl}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-zinc-500 dark:text-neutral-400">
                {branch.name.slice(0, 1)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              {branch.name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700 dark:bg-white/10 dark:text-neutral-300">
                {effectiveRole === "owner" ? "owner" : "member"}
              </span>
              {isDefault ? (
                <span className="rounded-full bg-zinc-200/90 px-2 py-0.5 text-[11px] font-medium text-zinc-800 dark:bg-white/15 dark:text-neutral-200">
                  default
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-neutral-500">
              사업자 번호
            </dt>
            <dd className="mt-0.5 text-zinc-900 dark:text-neutral-100">
              {branch.businessNumber || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-neutral-500">주소</dt>
            <dd className="mt-0.5 text-zinc-900 dark:text-neutral-100">
              {branch.address?.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-neutral-500">
              가게 번호
            </dt>
            <dd className="mt-0.5 text-zinc-900 dark:text-neutral-100">
              {branch.storePhone?.trim() || "—"}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950"
        >
          닫기
        </button>
      </div>
    </FullscreenModal>
  );
}

export function getEffectiveBranchRole(
  branch: Branch,
  sessionPhone: string,
  membership: { role: BranchRole },
): BranchRole {
  if (branch.createdByPhone === sessionPhone) {
    return "owner";
  }
  return membership.role;
}
