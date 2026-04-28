"use client";

import { workApi } from "@/lib/api/work-api";
import type { Branch, BranchMembership, Employee } from "@/types/work";
import { ChevronDownIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type WorkplaceBranchSwitcherProps = {
  className?: string;
};

function buildMyBranches(
  allBranches: Branch[],
  memberships: BranchMembership[],
  phone: string,
): Branch[] {
  const memberIds = new Set(memberships.map((item) => item.branchId));
  return allBranches.filter(
    (branch) => memberIds.has(branch.id) || branch.createdByPhone === phone,
  );
}

export function WorkplaceBranchSwitcher({
  className = "",
}: WorkplaceBranchSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Employee | null>(null);
  const [myBranches, setMyBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const dashboard = await workApi.getDashboard();
      if (!mounted || !dashboard.session) {
        return;
      }
      if (!mounted) {
        return;
      }
      setSession(dashboard.session);
      setSelectedBranchId(dashboard.session.currentBranchId ?? null);
      if (dashboard.myBranches.length > 0) {
        setMyBranches(dashboard.myBranches);
      } else {
        const [allBranches, memberships] = await Promise.all([
          workApi.getBranches(),
          workApi.getMyBranchMemberships(dashboard.session.phone),
        ]);
        if (!mounted) {
          return;
        }
        setMyBranches(
          buildMyBranches(allBranches, memberships, dashboard.session.phone),
        );
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedBranchName = useMemo(() => {
    if (!selectedBranchId) {
      return "-";
    }
    return (
      myBranches.find((branch) => branch.id === selectedBranchId)?.name ?? "-"
    );
  }, [myBranches, selectedBranchId]);

  const handleSelect = async (branchId: string) => {
    if (!session || busy || branchId === selectedBranchId) {
      setOpen(false);
      return;
    }
    const previousBranchId = selectedBranchId;
    setSelectedBranchId(branchId);
    window.dispatchEvent(new Event("workplace:changed"));
    setOpen(false);
    setBusy(true);
    const updated = await workApi.setCurrentBranch(session.phone, branchId);
    if (updated?.currentBranchId) {
      setSelectedBranchId(updated.currentBranchId);
      window.dispatchEvent(new Event("workplace:changed"));
    } else {
      setSelectedBranchId(previousBranchId);
      window.dispatchEvent(new Event("workplace:changed"));
    }
    setBusy(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex w-fit items-center gap-1"
        aria-expanded={open}
        aria-label="지점 선택"
      >
        <span className="max-w-56 truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          {selectedBranchName}
        </span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-zinc-500 dark:text-neutral-400" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-full min-w-64 max-w-sm rounded-2xl border border-zinc-200/90 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-neutral-900">
          {myBranches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-zinc-600 dark:text-neutral-400">
              선택 가능한 지점이 없습니다.
            </p>
          ) : (
            <ul className="space-y-1">
              {myBranches.map((branch) => {
                const selected = branch.id === selectedBranchId;
                return (
                  <li key={branch.id}>
                    <button
                      type="button"
                      onClick={() => void handleSelect(branch.id)}
                      disabled={busy}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                        selected
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-neutral-950"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-neutral-300 dark:hover:bg-white/10"
                      }`}
                    >
                      <span className="truncate">{branch.name}</span>
                      {selected ? (
                        <span className="text-xs">
                          {busy ? "변경 중..." : "선택됨"}
                        </span>
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
