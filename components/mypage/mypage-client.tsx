"use client";

import { TabPageShell } from "@/components/layout/tab-page-shell";
import { DashboardData, workApi } from "@/lib/api/work-api";
import { formatPhoneNumber } from "@/lib/phone";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ThemeSunMoonToggle } from "@/components/theme/theme-sun-moon-toggle";

export function MyPageClient() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");

  const refresh = useCallback(async () => {
    const dashboard = await workApi.getDashboard();
    setData(dashboard);
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

  if (!data?.session) {
    return null;
  }

  return (
    <TabPageShell
      title="설정"
      description="프로필과 앱 화면을 맞춤 설정할 수 있어요."
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
