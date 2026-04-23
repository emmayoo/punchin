"use client";

import { TabPageShell } from "@/components/layout/tab-page-shell";
import { DashboardData, workApi } from "@/lib/api/work-api";
import { formatPhoneNumber } from "@/lib/phone";
import { toast } from "@/lib/toast";
import type { Branch, BranchMembership } from "@/types/work";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ThemeSunMoonToggle } from "@/components/theme/theme-sun-moon-toggle";

export function MyPageClient() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [memberships, setMemberships] = useState<BranchMembership[]>([]);

  const refresh = useCallback(async () => {
    const dashboard = await workApi.getDashboard();
    setData(dashboard);
    if (dashboard.session) {
      const [allBranches, myMemberships] = await Promise.all([
        workApi.getBranches(),
        workApi.getMyBranchMemberships(dashboard.session.phone),
      ]);
      setBranches(allBranches);
      setMemberships(myMemberships);
    } else {
      setBranches([]);
      setMemberships([]);
    }
    return dashboard;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await workApi.init();
      if (!mounted) {
        return;
      }
      const dashboard = await refresh();
      if (!mounted) {
        return;
      }
      if (!dashboard.session) {
        router.replace("/auth");
        return;
      }
      setName(dashboard.session.name);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refresh, router]);

  const handleLogout = async () => {
    setBusy(true);
    await workApi.logout();
    router.replace("/auth");
  };

  const handleSaveProfile = async () => {
    if (!data?.session || !name.trim()) {
      return;
    }
    setBusy(true);
    await workApi.updateMyProfileName(data.session.phone, name.trim());
    await refresh();
    setBusy(false);
    toast.success("프로필을 저장했습니다.");
  };

  const handleChangeDefaultBranch = async (branchId: string) => {
    if (!data?.session) {
      return;
    }
    if (data.session.currentBranchId === branchId) {
      return;
    }
    setBusy(true);
    await workApi.completeBranchSetup(data.session.phone, {
      mode: "select",
      branchId,
    });
    await refresh();
    setBusy(false);
    toast.success("기본 지점을 변경했습니다.");
  };

  if (!data?.session) {
    return null;
  }
  const myBranches = memberships
    .map((membership) => {
      const branch = branches.find((item) => item.id === membership.branchId);
      if (!branch) {
        return null;
      }
      return { branch, membership };
    })
    .filter(
      (item): item is { branch: Branch; membership: BranchMembership } =>
        item !== null,
    );

  return (
    <TabPageShell
      title="설정"
      bodyClassName="gap-8"
      loading={loading || !data?.session}
    >
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          프로필
        </h2>
        <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs text-zinc-500 dark:text-neutral-500">
            로그인 번호
          </p>
          <p className="mt-1 text-sm text-zinc-800 dark:text-neutral-100">
            {formatPhoneNumber(data.session.phone)}
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-600 dark:text-neutral-400">
              이름 (닉네임)
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="이름 입력"
              className="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35"
            />
          </label>
          <button
            onClick={handleSaveProfile}
            disabled={busy || !name.trim()}
            className="w-full rounded-xl border border-zinc-300/90 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-400 disabled:opacity-60 dark:border-white/20 dark:text-white dark:hover:border-white/40"
          >
            {busy ? "저장 중..." : "프로필 저장"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          앱
        </h2>
        <div className="rounded-2xl border flex justify-between items-center border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs text-zinc-600 dark:text-neutral-400">테마</p>
          <ThemeSunMoonToggle />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          지점
        </h2>
        <div className="space-y-2 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="rounded-xl border border-zinc-200/90 bg-white p-3 dark:border-white/10 dark:bg-neutral-900">
            <p className="text-xs text-zinc-600 dark:text-neutral-400">
              내가 선택한 지점 목록
            </p>
            {myBranches.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-neutral-400">
                선택한 지점이 없습니다.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {myBranches.map(({ branch, membership }) => {
                  const isDefault = data.session?.currentBranchId === branch.id;
                  return (
                    <li
                      key={membership.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <button
                        type="button"
                        onClick={() => handleChangeDefaultBranch(branch.id)}
                        disabled={busy || isDefault}
                        className={`flex-1 rounded-lg border px-2 py-1 text-left transition-colors ${
                          isDefault
                            ? "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-400/50 dark:bg-emerald-900/20 dark:text-emerald-200"
                            : "border-zinc-200/90 text-zinc-900 hover:border-zinc-400 dark:border-white/10 dark:text-white dark:hover:border-white/30"
                        }`}
                      >
                        {branch.name}
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700 dark:bg-white/10 dark:text-neutral-300">
                          {membership.role}
                        </span>
                        {isDefault ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                            default
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700 dark:bg-white/10 dark:text-neutral-300">
                            탭해서 기본 변경
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push("/branch")}
            className="w-full rounded-xl border border-zinc-300/90 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-400 dark:border-white/20 dark:text-white dark:hover:border-white/40"
          >
            설정
          </button>
        </div>
      </section>

      <button
        onClick={handleLogout}
        disabled={busy}
        className="w-full rounded-xl border border-rose-300/90 bg-rose-400/90 px-4 py-3 text-sm font-semibold text-rose-950 transition-colors hover:bg-rose-300 disabled:opacity-60"
      >
        {busy ? "처리 중..." : "로그아웃"}
      </button>
    </TabPageShell>
  );
}
