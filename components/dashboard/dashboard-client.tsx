"use client";

import { workApi } from "@/lib/api/work-api";
import { TabPageShell } from "@/components/layout/tab-page-shell";
import { ConfirmDialog } from "@/components/overlay/confirm-dialog";
import { DailyShiftTimeline } from "@/components/timeline/daily-shift-timeline";
import { CalendarDays } from "lucide-react";
import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import {
  buildAttendanceStatuses,
  buildMyTimelinePunches,
  buildMyTimelineShifts,
  resolveDefaultCheckInBranchId,
} from "@/components/dashboard/dashboard-helpers";
import {
  AttendanceStatusList,
  CheckInBranchSelectBody,
  GreetingPunchSection,
  NextUpcomingShiftSection,
  TodayRecordsSection,
} from "@/components/dashboard/dashboard-sections";
import { TodayEventsSection } from "@/components/dashboard/today-events-section";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

export function DashboardClient() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "checkin" | "checkout" | null
  >(null);
  const [checkInBranchId, setCheckInBranchId] = useState<string>("");
  const handleDashboardData = useCallback(
    (dashboard: Awaited<ReturnType<typeof workApi.getDashboard>>) => {
      if (!dashboard.session) {
        router.replace("/auth");
      }
    },
    [router],
  );
  const { data, loading, refresh } = useDashboardData({
    onData: handleDashboardData,
  });
  const todayLabel = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  const handleCheckIn = async () => {
    if (!data?.session) {
      return;
    }
    if (data.myBranches.length > 0 && !checkInBranchId) {
      setActionError("출근 지점을 선택해주세요.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await workApi.checkInCurrent(data.session, checkInBranchId || null);
      await refresh();
      setConfirmAction(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "출근 처리 중 오류가 발생했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCheckOut = async () => {
    if (!data?.activePunch) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await workApi.checkOutCurrent(data.activePunch.id);
      await refresh();
      setConfirmAction(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "퇴근 처리 중 오류가 발생했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  const defaultCheckInBranchId = useMemo(
    () => resolveDefaultCheckInBranchId(data),
    [data],
  );
  const nextUpcomingShift = useMemo(() => {
    if (!data?.session) {
      return null;
    }
    const nowMs = new Date().getTime();
    return (
      data.shifts
        .filter(
          (shift) =>
            shift.employeePhone === data.session?.phone &&
            new Date(shift.startAt).getTime() > nowMs,
        )
        .sort(
          (a, b) =>
            new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        )[0] ?? null
    );
  }, [data]);
  if (!data) {
    return null;
  }

  const myTimelineShifts = buildMyTimelineShifts(data);
  const myTimelinePunches = buildMyTimelinePunches(data);
  const attendanceStatuses = buildAttendanceStatuses(data);
  const problemStatuses = attendanceStatuses.filter(
    (status) => status.tone === "danger",
  );
  const checkInBranchName =
    data.myBranches.find((branch) => branch.id === checkInBranchId)?.name ?? "";
  const nextShiftBranchName =
    nextUpcomingShift?.branchId
      ? (data.branches.find((branch) => branch.id === nextUpcomingShift.branchId)
          ?.name ?? "지점 미지정")
      : "전체 지점";
  const openCheckInConfirm = () => {
    setActionError(null);
    setCheckInBranchId(defaultCheckInBranchId);
    setConfirmAction("checkin");
  };

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
      bodyClassName="gap-2"
      loading={!showDashboard}
    >
      <div className="inline-flex w-fit items-center gap-1.5 self-start rounded-full border border-zinc-200/90 bg-zinc-100/80 px-2.5 py-1 text-[11px] text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
        <span>{todayLabel}</span>
      </div>

      <GreetingPunchSection
        userName={data.session?.name ?? "사용자"}
        activePunch={data.activePunch}
        busy={busy}
        actionError={actionError}
        onCheckInOpen={openCheckInConfirm}
        onCheckOutOpen={() => setConfirmAction("checkout")}
      />

      <TodayEventsSection events={data.todayEvents} branches={data.branches} />

      <section className="grid gap-3">
        <TodayRecordsSection
          records={data.myTodayRecords}
          todayHours={data.myTodayHours}
          branches={data.branches}
        />
        {myTimelineShifts.length > 0 ? (
          <div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0">
            <div className="min-w-[320px]">
              <div className="mb-2">
                <AttendanceStatusList statuses={problemStatuses} />
              </div>
              <DailyShiftTimeline
                shifts={myTimelineShifts}
                punches={myTimelinePunches}
                nowIso={new Date().toISOString()}
                title="오늘 내 근무 타임라인"
                showActiveLabel={false}
              />
            </div>
          </div>
        ) : null}
      </section>

      <NextUpcomingShiftSection
        nextUpcomingShift={nextUpcomingShift}
        nextShiftBranchName={nextShiftBranchName}
      />

      <ConfirmDialog
        open={confirmAction === "checkin"}
        title="출근 확인"
        description={
          checkInBranchName
            ? `${checkInBranchName} 지점으로 출근 처리할까요?`
            : "지금 출근 처리할까요?"
        }
        confirmText="출근하기"
        busy={busy}
        body={
          <CheckInBranchSelectBody
            branches={data.myBranches}
            selectedBranchId={checkInBranchId}
            busy={busy}
            onChange={setCheckInBranchId}
          />
        }
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
