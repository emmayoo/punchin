"use client";

import type { Branch } from "@/types/work";
import { Search } from "lucide-react";

type BranchListProps = {
  branches: Branch[];
  selectedBranchIds: string[];
  defaultBranchId: string | null;
  search: string;
  sessionPhone: string | null | undefined;
  onSearchChange: (value: string) => void;
  onToggleSelection: (branchId: string) => void;
};

export function BranchList({
  branches,
  selectedBranchIds,
  defaultBranchId,
  search,
  sessionPhone,
  onSearchChange,
  onToggleSelection,
}: BranchListProps) {
  const filteredBranches = branches.filter((branch) => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return (
      branch.name.toLowerCase().includes(q) ||
      branch.businessNumber.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="지점명/사업자번호 검색"
          className="w-full rounded-xl border border-zinc-200/90 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-white/10 dark:bg-[#18181b] dark:text-neutral-100 dark:focus:border-white/35"
        />
      </div>

      {filteredBranches.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-neutral-400">
          검색 결과가 없습니다.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {filteredBranches.map((branch) => {
            const isSelected = selectedBranchIds.includes(branch.id);
            const isOwned = branch.createdByPhone === sessionPhone;
            const isDefault = defaultBranchId === branch.id;
            return (
              <li
                key={branch.id}
                className="rounded-xl border border-zinc-200/90 bg-white p-3 dark:border-white/10 dark:bg-[#18181b]"
              >
                <button
                  type="button"
                  onClick={() => onToggleSelection(branch.id)}
                  disabled={isOwned}
                  className={`flex w-full items-start justify-between gap-3 text-left ${
                    isOwned ? "cursor-not-allowed opacity-70" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                        {branch.name}
                      </p>
                      {isOwned ? (
                        <p className="mt-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                          owner
                        </p>
                      ) : null}
                      {isDefault && (isSelected || isOwned) ? (
                        <p className="mt-1 rounded-full bg-zinc-200/90 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-white/15 dark:text-neutral-200">
                          기본
                        </p>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-neutral-500">
                      사업자번호: {branch.businessNumber || "-"}
                    </p>
                    {branch.address ? (
                      <p className="text-[11px] text-zinc-500 dark:text-neutral-500">
                        주소: {branch.address}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border text-[11px] ${
                      isOwned
                        ? "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-white/20 dark:bg-white/10 dark:text-neutral-300"
                        : isSelected
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-zinc-300 text-zinc-500 dark:border-white/20 dark:text-neutral-400"
                    }`}
                  >
                    {isOwned || isSelected ? "✓" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
