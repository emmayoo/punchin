"use client";

import { TabPageShell } from "@/components/layout/tab-page-shell";
import { DashboardData, workApi } from "@/lib/api/work-api";
import { formatPhoneNumber } from "@/lib/phone";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
  };

  if (!data?.session) {
    return null;
  }

  return (
    <TabPageShell
      title="My Page"
      description="로그인된 계정 정보를 확인합니다."
      bodyClassName="gap-6"
      loading={loading || !data?.session}
    >
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-neutral-500">로그인 번호</p>
        <p className="mt-1 text-sm text-neutral-100">
          {formatPhoneNumber(data.session.phone)}
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <label className="block space-y-1">
          <span className="text-xs text-neutral-400">이름 (닉네임)</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="이름 입력"
            className="w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none transition-colors focus:border-white/35"
          />
        </label>
        <button
          onClick={handleSaveProfile}
          disabled={busy || !name.trim()}
          className="w-full rounded-xl border border-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-white/40 disabled:opacity-60"
        >
          {busy ? "저장 중..." : "프로필 저장"}
        </button>
      </section>

      <button
        onClick={handleLogout}
        disabled={busy}
        className="w-full rounded-xl border border-rose-300/70 bg-rose-400/90 px-4 py-3 text-sm font-semibold text-rose-950 transition-colors hover:bg-rose-300 disabled:opacity-60"
      >
        {busy ? "처리 중..." : "로그아웃"}
      </button>
    </TabPageShell>
  );
}
