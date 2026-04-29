"use client";

import type { AttendanceStatus } from "@/components/dashboard/dashboard-helpers";
import {
  durationHours,
  formatDateTime,
  formatDuration24hWithSeconds,
  formatTime,
} from "@/lib/time";
import type { Branch, PunchRecord, Shift } from "@/types/work";

type GreetingPunchSectionProps = {
  userName: string;
  activePunch: PunchRecord | null;
  busy: boolean;
  actionError: string | null;
  onCheckInOpen: () => void;
  onCheckOutOpen: () => void;
};

export function GreetingPunchSection({
  userName,
  activePunch,
  busy,
  actionError,
  onCheckInOpen,
  onCheckOutOpen,
}: GreetingPunchSectionProps) {
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-white">
        {userName}님, 반가워요 ✋
      </h2>
      {!activePunch ? (
        <button
          onClick={onCheckInOpen}
          disabled={busy}
          className="w-full rounded-xl bg-emerald-300 px-4 py-3 text-base font-semibold text-emerald-950 transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? "처리 중..." : "출근"}
        </button>
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-neutral-300">
            출근 시작: {formatDateTime(activePunch.checkedInAt)}
          </p>
          <button
            onClick={onCheckOutOpen}
            disabled={busy}
            className="w-full rounded-xl bg-rose-300 px-4 py-3 text-base font-semibold text-rose-950 transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? "처리 중..." : "퇴근"}
          </button>
        </>
      )}
      {actionError ? <p className="text-xs text-rose-300">{actionError}</p> : null}
    </section>
  );
}

type TodayRecordsSectionProps = {
  records: PunchRecord[];
  todayHours: number;
  branches: Branch[];
};

export function TodayRecordsSection({ records, todayHours, branches }: TodayRecordsSectionProps) {
  const branchNameById = new Map(branches.map((branch) => [branch.id, branch.name] as const));
  const branchHoursMap = records.reduce<Map<string, number>>((acc, record) => {
    const branchLabel = record.branchId
      ? (branchNameById.get(record.branchId) ?? "지점 미지정")
      : "전체 지점";
    const endAt = record.checkedOutAt ?? new Date().toISOString();
    const workedHours = durationHours(record.checkedInAt, endAt);
    const current = acc.get(branchLabel) ?? 0;
    acc.set(branchLabel, current + workedHours);
    return acc;
  }, new Map<string, number>());
  const branchSummaries = [...branchHoursMap.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <article className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
      <p className="text-xs text-zinc-500 dark:text-neutral-500">오늘 출퇴근 기록</p>
      <p className="flex items-center gap-2 mt-2">
        <span className="text-base font-semibold text-zinc-900 dark:text-white">
          {formatDuration24hWithSeconds(todayHours)}
        </span>
        <span className="text-xs text-zinc-500 dark:text-neutral-500">(총 근무 시간)</span>
      </p>
      {branchSummaries.length > 0 ? (
        <div className="mt-2 space-y-1">
          {branchSummaries.map(([branchName, hours]) => (
            <p key={branchName} className="text-xs text-zinc-600 dark:text-neutral-400">
              - {branchName}: {formatDuration24hWithSeconds(hours)}
            </p>
          ))}
        </div>
      ) : null}
      {records.length > 0 ? (
        <div className="mt-4 space-y-1.5">
          {records.map((record) => {
            const endLabel = record.checkedOutAt
              ? formatTime(record.checkedOutAt)
              : `${formatTime(new Date().toISOString())} (진행 중)`;
            return (
              <p key={record.id} className="text-sm text-zinc-800 dark:text-neutral-100">
                {formatTime(record.checkedInAt)} - {endLabel}
                <span className="ml-2 text-xs text-zinc-500 dark:text-neutral-400">
                  ·{" "}
                  {record.branchId
                    ? (branchNameById.get(record.branchId) ?? "지점 미지정")
                    : "전체 지점"}
                </span>
              </p>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-600 dark:text-neutral-400">오늘 기록 없음</p>
      )}
    </article>
  );
}

type CheckInBranchSelectBodyProps = {
  branches: Branch[];
  selectedBranchId: string;
  busy: boolean;
  onChange: (branchId: string) => void;
};

export function CheckInBranchSelectBody({
  branches,
  selectedBranchId,
  busy,
  onChange,
}: CheckInBranchSelectBodyProps) {
  if (branches.length <= 1) {
    return null;
  }
  return (
    <div className="space-y-1.5">
      <label htmlFor="checkin-branch" className="text-xs text-zinc-600 dark:text-neutral-300">
        출근 지점 선택
      </label>
      <select
        id="checkin-branch"
        value={selectedBranchId}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-zinc-300/90 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-white/20 dark:bg-neutral-900 dark:text-neutral-100"
        disabled={busy}
      >
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );
}

type AttendanceStatusBadgeProps = {
  status: AttendanceStatus;
};

export function AttendanceStatusBadge({ status }: AttendanceStatusBadgeProps) {
  const toneClass =
    status.tone === "danger"
      ? "border-rose-300/60 bg-rose-100/70 text-rose-800 dark:border-rose-300/30 dark:bg-rose-300/10 dark:text-rose-200"
      : status.tone === "success"
        ? "border-emerald-300/60 bg-emerald-100/70 text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-200"
        : status.tone === "info"
          ? "border-sky-300/60 bg-sky-100/70 text-sky-800 dark:border-sky-300/30 dark:bg-sky-300/10 dark:text-sky-200"
          : "border-zinc-300/60 bg-zinc-100/80 text-zinc-700 dark:border-white/20 dark:bg-white/5 dark:text-neutral-300";
  const chipClass =
    status.tone === "danger"
      ? "bg-rose-500/90 text-white"
      : status.tone === "success"
        ? "bg-emerald-500/90 text-white"
        : status.tone === "info"
          ? "bg-sky-500/90 text-white"
          : "bg-zinc-500/80 text-white";
  return (
    <div className={`rounded-xl border px-3 py-2 text-xs ${toneClass}`}>
      <span
        className={`mr-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${chipClass}`}
      >
        {status.badge}
      </span>
      <span className="font-medium">
        {status.status} · {status.branch} · {status.schedule}
      </span>
    </div>
  );
}

type AttendanceStatusListProps = {
  statuses: AttendanceStatus[];
};

export function AttendanceStatusList({ statuses }: AttendanceStatusListProps) {
  if (statuses.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2">
      {statuses.map((status, idx) => (
        <AttendanceStatusBadge
          key={`${status.badge}-${status.branch}-${status.schedule}-${idx}`}
          status={status}
        />
      ))}
    </div>
  );
}

type NextUpcomingShiftSectionProps = {
  nextUpcomingShift: Shift | null;
  nextShiftBranchName: string;
};

export function NextUpcomingShiftSection({
  nextUpcomingShift,
  nextShiftBranchName,
}: NextUpcomingShiftSectionProps) {
  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
      <p className="text-xs text-zinc-500 dark:text-neutral-500">다음 예정 근무</p>
      {nextUpcomingShift ? (
        <div className="mt-1 space-y-1">
          <p className="text-sm font-medium text-zinc-900 dark:text-white">{nextShiftBranchName}</p>
          <p className="text-sm text-zinc-600 dark:text-neutral-300">
            {formatDateTime(nextUpcomingShift.startAt)} ~ {formatDateTime(nextUpcomingShift.endAt)}
          </p>
        </div>
      ) : (
        <p className="mt-1 text-sm text-zinc-600 dark:text-neutral-400">예정된 근무가 없습니다.</p>
      )}
    </section>
  );
}
