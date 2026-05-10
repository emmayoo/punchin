"use client";

import { ChevronDownIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { BranchProfileAvatar } from "@/components/branch/branch-profile-avatar";
import type { Branch } from "@/types/work";

type WorkplaceBranchSwitcherProps = {
  className?: string;
  branches: Branch[];
  selectedBranchId: string | null;
  busy?: boolean;
  onSelect: (branchId: string) => void;
};

export function WorkplaceBranchSwitcher({
  className = "",
  branches,
  selectedBranchId,
  busy = false,
  onSelect,
}: WorkplaceBranchSwitcherProps) {
  const [open, setOpen] = useState(false);

  const selectedBranch = useMemo(() => {
    if (!selectedBranchId) {
      return null;
    }
    return branches.find((branch) => branch.id === selectedBranchId) ?? null;
  }, [branches, selectedBranchId]);

  const selectedBranchName = selectedBranch?.name ?? "-";

  const handleSelect = (branchId: string) => {
    if (busy || branchId === selectedBranchId) {
      setOpen(false);
      return;
    }
    setOpen(false);
    onSelect(branchId);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex w-fit max-w-full items-center gap-2"
        aria-expanded={open}
        aria-label="지점 선택"
      >
        {selectedBranch ? (
          <BranchProfileAvatar
            name={selectedBranch.name}
            profileImageUrl={selectedBranch.profileImageUrl}
            sizePx={36}
          />
        ) : null}
        <span className="max-w-56 truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          {selectedBranchName}
        </span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-zinc-500 dark:text-neutral-400" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-full min-w-64 max-w-sm rounded-2xl border border-zinc-200/90 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-neutral-900">
          {branches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-zinc-600 dark:text-neutral-400">
              선택 가능한 지점이 없습니다.
            </p>
          ) : (
            <ul className="space-y-1">
              {branches.map((branch) => {
                const selected = branch.id === selectedBranchId;
                return (
                  <li key={branch.id}>
                    <button
                      type="button"
                      onClick={() => void handleSelect(branch.id)}
                      disabled={busy}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                        selected
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-neutral-950"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-neutral-300 dark:hover:bg-white/10"
                      }`}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <BranchProfileAvatar
                          name={branch.name}
                          profileImageUrl={branch.profileImageUrl}
                          sizePx={32}
                          className={
                            selected ? "border-white/20 dark:border-neutral-950/20" : ""
                          }
                        />
                        <span className="truncate">{branch.name}</span>
                      </span>
                      {selected ? (
                        <span className="text-xs">{busy ? "변경 중..." : "선택됨"}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
