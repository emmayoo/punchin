"use client";

import { FirstProfileForm } from "@/components/onboarding/first-profile-form";
import { FullscreenModal } from "@/components/overlay/fullscreen-modal";
import { DashboardData, workApi } from "@/lib/api/work-api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function normalizeTailDigits(input: string): string {
  return input.replace(/\D/g, "").slice(0, 8);
}

function formatTailDigits(input: string): string {
  const digits = normalizeTailDigits(input);
  if (digits.length <= 4) {
    return digits;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function findPreferredBranchId(
  phone: string,
  currentBranchId: string | null | undefined,
  memberships: { branchId: string }[],
  branches: { id: string; createdByPhone: string }[],
): string | null {
  if (currentBranchId) {
    return currentBranchId;
  }
  if (memberships.length === 0) {
    return null;
  }

  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  const ownedMembership = memberships.find((membership) => {
    const branch = branchById.get(membership.branchId);
    return branch?.createdByPhone === phone;
  });
  return ownedMembership?.branchId ?? memberships[0].branchId;
}

export function AuthClient() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [phoneTail, setPhoneTail] = useState("");
  const [profileName, setProfileName] = useState("");
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [needFirstProfile, setNeedFirstProfile] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const activeSlot = Math.min(phoneTail.length, 7);

  const refresh = useCallback(async () => {
    const dashboard = await workApi.getDashboard();
    setData(dashboard);
    if (dashboard.session) {
      setPhoneTail(dashboard.session.phone.slice(3, 11));
    }
    return dashboard;
  }, []);

  const resolveDefaultBranchOnLogin = useCallback(
    async (phone: string, currentBranchId?: string | null): Promise<string | null> => {
      const [myMemberships, allBranches] = await Promise.all([
        workApi.getMyBranchMemberships(phone),
        workApi.getBranches(),
      ]);
      return findPreferredBranchId(
        phone,
        currentBranchId,
        myMemberships,
        allBranches,
      );
    },
    [],
  );

  const routeByDefaultBranch = useCallback(
    async (phone: string, currentBranchId?: string | null) => {
      const defaultBranchId = await resolveDefaultBranchOnLogin(
        phone,
        currentBranchId,
      );
      if (defaultBranchId && defaultBranchId !== currentBranchId) {
        await workApi.completeBranchSetup(phone, {
          mode: "select",
          branchId: defaultBranchId,
        });
      }
      router.replace(defaultBranchId ? "/" : "/branch");
    },
    [resolveDefaultBranchOnLogin, router],
  );

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
      if (dashboard.session) {
        await routeByDefaultBranch(
          dashboard.session.phone,
          dashboard.session.currentBranchId,
        );
        return;
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refresh, routeByDefaultBranch]);

  const handleLogin = async () => {
    const tailDigits = normalizeTailDigits(phoneTail);
    if (tailDigits.length !== 8) {
      return;
    }
    const phone = `010${tailDigits}`;
    setBusy(true);
    const existing = await workApi.getEmployeeByPhone(phone);
    if (!existing) {
      setPendingPhone(phone);
      setNeedFirstProfile(true);
      setBusy(false);
      return;
    }
    const loggedIn = await workApi.login(phone);
    await routeByDefaultBranch(
      loggedIn.phone,
      loggedIn.currentBranchId,
    );
  };

  const handleCompleteFirstProfile = async () => {
    if (!pendingPhone || !profileName.trim()) {
      return;
    }
    setBusy(true);
    const registered = await workApi.registerFirstProfile(pendingPhone, profileName);
    await routeByDefaultBranch(registered.phone, registered.currentBranchId);
  };

  if (loading || !data) {
    return (
      <p className="text-sm text-zinc-600 dark:text-neutral-400">불러오는 중...</p>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-8 p-4">
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-neutral-500">
          PunchIn
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          스케줄 펀치
        </h1>
        <p className="text-sm text-zinc-600 dark:text-neutral-400">
          스케줄을 확인하고 출퇴근을 기록하세요.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-white">
          핸드폰 번호
        </h2>
        <div
          onClick={() => phoneInputRef.current?.focus()}
          className="relative flex items-center transition-colors"
        >
          <span className="pr-1 text-sm text-zinc-700 dark:text-neutral-300">
            010
          </span>
          <span className="px-1 text-zinc-500 dark:text-neutral-500">-</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <span
                key={`left-${index}`}
                className={`flex h-8 w-6.5 items-center justify-center rounded-md border bg-zinc-200/50 text-sm font-medium text-zinc-800 transition-colors dark:bg-black/20 dark:text-neutral-100 ${
                  phoneFocused && activeSlot === index
                    ? "border-zinc-500 dark:border-white"
                    : "border-zinc-300/90 dark:border-white/12"
                }`}
              >
                {phoneTail[index] ?? ""}
              </span>
            ))}
            <span className="px-1 text-zinc-500 dark:text-neutral-500">-</span>
            {Array.from({ length: 4 }).map((_, index) => (
              <span
                key={`right-${index}`}
                className={`flex h-8 w-6.5 items-center justify-center rounded-md border bg-zinc-200/50 text-sm font-medium text-zinc-800 transition-colors dark:bg-black/20 dark:text-neutral-100 ${
                  phoneFocused && activeSlot === index + 4
                    ? "border-zinc-500 dark:border-white"
                    : "border-zinc-300/90 dark:border-white/12"
                }`}
              >
                {phoneTail[index + 4] ?? ""}
              </span>
            ))}
          </div>
          <input
            ref={phoneInputRef}
            value={formatTailDigits(phoneTail)}
            onChange={(event) =>
              setPhoneTail(normalizeTailDigits(event.target.value))
            }
            onFocus={() => setPhoneFocused(true)}
            onBlur={() => setPhoneFocused(false)}
            inputMode="numeric"
            autoComplete="tel-national"
            aria-label="휴대폰 번호 뒤 8자리 입력"
            className="absolute inset-0 opacity-0"
          />
        </div>
        <button
          onClick={handleLogin}
          disabled={busy || phoneTail.length !== 8}
          className="w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? "처리 중..." : "다음"}
        </button>
      </section>

      <FullscreenModal open={needFirstProfile}>
        <FirstProfileForm
          phone={pendingPhone ?? ""}
          name={profileName}
          busy={busy}
          onNameChange={setProfileName}
          onSubmit={handleCompleteFirstProfile}
        />
      </FullscreenModal>
    </main>
  );
}
