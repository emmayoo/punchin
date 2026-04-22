"use client";

import { BellRing } from "lucide-react";
import { DashboardData, workApi } from "@/lib/api/work-api";
import { TabPageShell } from "@/components/layout/tab-page-shell";
import { ConfirmDialog } from "@/components/overlay/confirm-dialog";
import { DailyShiftTimeline } from "@/components/timeline/daily-shift-timeline";
import { formatDateTime, formatDuration24h, formatTime } from "@/lib/time";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function DashboardClient() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "checkin" | "checkout" | null
  >(null);
  const todayLabel = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

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
      setLoading(false);
    })();

    const timer = window.setInterval(() => {
      void refresh();
    }, 60 * 1000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [refresh, router]);

  const handleCheckIn = async () => {
    if (!data?.session) {
      return;
    }
    setBusy(true);
    await workApi.checkInCurrent(data.session);
    await refresh();
    setBusy(false);
    setConfirmAction(null);
  };

  const handleCheckOut = async () => {
    if (!data?.activePunch) {
      return;
    }
    setBusy(true);
    await workApi.checkOutCurrent(data.activePunch.id);
    await refresh();
    setBusy(false);
    setConfirmAction(null);
  };

  if (!data) {
    return null;
  }

  const showDashboard = !loading && data;

  return (
    <TabPageShell
      variant="hero"
      eyebrow={showDashboard ? undefined : "PunchIn"}
      title={showDashboard ? "대시보드" : "스케줄 펀치 기계"}
      description={
        showDashboard
          ? "오늘 출근/퇴근 기록 및 스케줄 확인"
          : "휴대폰 번호로 로그인하고 출퇴근을 기록하세요."
      }
      className="gap-8"
      bodyClassName="gap-8"
      loading={!showDashboard}
    >
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-medium text-white flex items-center justify-between gap-2">
          <span>{data.session?.name ?? "사용자"}님, 반가워요 ✋</span>
          <span className="text-xs text-neutral-500">{todayLabel}</span>
        </h2>
        {!data.activePunch ? (
          <button
            onClick={() => setConfirmAction("checkin")}
            disabled={busy}
            className="w-full rounded-xl bg-emerald-300 px-4 py-3 text-base font-semibold text-emerald-950 transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? "처리 중..." : "출근"}
          </button>
        ) : (
          <>
            <p className="text-sm text-neutral-300">
              출근 시작: {formatDateTime(data.activePunch.checkedInAt)}
            </p>
            <button
              onClick={() => setConfirmAction("checkout")}
              disabled={busy}
              className="w-full rounded-xl bg-rose-300 px-4 py-3 text-base font-semibold text-rose-950 transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "처리 중..." : "퇴근"}
            </button>
          </>
        )}
      </section>

      {data.todayEvents.length > 0 ? (
        <section className="rounded-2xl border border-amber-300/30 bg-amber-200/10 p-4">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-amber-200" aria-hidden />
            <p className="text-sm font-semibold text-amber-100">
              오늘 이벤트 ({data.todayEvents.length}건)
            </p>
          </div>
          <ul className="mt-2 space-y-1">
            {data.todayEvents.map((event) => (
              <li key={event.id} className="text-sm text-amber-50/95">
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ backgroundColor: event.color }}
                  aria-hidden
                />
                <span className="align-middle">{event.title}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-3">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-neutral-500">오늘 출퇴근 기록</p>
          {data.myTodayRecords.length > 0 ? (
            <div className="mt-2 space-y-1">
              {data.myTodayRecords.map((record) => (
                <p key={record.id} className="text-sm text-neutral-100">
                  {formatTime(record.checkedInAt)} -{" "}
                  {record.checkedOutAt
                    ? formatTime(record.checkedOutAt)
                    : "진행 중"}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-neutral-400">오늘 기록 없음</p>
          )}
          <p className="mt-3 text-xs text-neutral-500">오늘 총 근무시간</p>
          <p className="text-lg font-semibold text-white">
            {formatDuration24h(data.myTodayHours)}
          </p>
        </article>

        <div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0">
          <div className="min-w-[320px]">
            <DailyShiftTimeline
              shifts={data.shifts}
              punches={data.punchRecords}
              nowIso={new Date().toISOString()}
            />
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmAction === "checkin"}
        title="출근 확인"
        description="지금 출근 처리할까요?"
        confirmText="출근하기"
        busy={busy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleCheckIn}
      />

      <ConfirmDialog
        open={confirmAction === "checkout"}
        title="퇴근 확인"
        description="지금 퇴근 처리할까요?"
        confirmText="퇴근하기"
        tone="danger"
        busy={busy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleCheckOut}
      />
    </TabPageShell>
  );
}
