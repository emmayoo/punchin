"use client";

import { X } from "lucide-react";

import type { Branch } from "@/types/work";

type BranchSelectedTagsProps = {
  selectedBranches: Branch[];
  sessionPhone: string | null | undefined;
  defaultBranchId: string | null;
  onSetDefault: (branchId: string) => void;
  onToggleSelection: (branchId: string) => void;
};

export function BranchSelectedTags({
  selectedBranches,
  sessionPhone,
  defaultBranchId,
  onSetDefault,
  onToggleSelection,
}: BranchSelectedTagsProps) {
  return (
    <div className="rounded-xl border border-zinc-200/90 bg-white p-3 dark:border-white/10 dark:bg-[#18181b]">
      <p className="mb-0.5 text-xs font-medium text-zinc-600 dark:text-neutral-300">선택된 지점</p>
      <p className="mb-2 text-[11px] text-zinc-500 dark:text-neutral-500">
        태그를 누르면 기본 지점으로 지정 · X 는 선택 해제
      </p>
      {selectedBranches.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-neutral-500">
          아직 선택된 지점이 없습니다. 최소 1개를 선택해주세요.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selectedBranches.map((branch) => {
            const isOwned = branch.createdByPhone === sessionPhone;
            const isDefault = defaultBranchId === branch.id;
            return (
              <span
                key={branch.id}
                className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-zinc-800 dark:text-neutral-200 ${
                  isDefault
                    ? "border-zinc-400/90 bg-zinc-50 font-medium dark:border-white/30 dark:bg-white/5"
                    : "border-transparent bg-zinc-100 dark:bg-white/10"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSetDefault(branch.id)}
                  className="min-w-0 shrink truncate text-left"
                  title="기본 지점으로 지정"
                >
                  {branch.name}
                </button>
                {isDefault ? (
                  <span className="shrink-0 rounded-full bg-zinc-200/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-white/15 dark:text-neutral-200">
                    기본
                  </span>
                ) : null}
                {!isOwned && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelection(branch.id);
                    }}
                    className="shrink-0 text-zinc-600 dark:text-neutral-300"
                    aria-label={`${branch.name} 선택 해제`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
