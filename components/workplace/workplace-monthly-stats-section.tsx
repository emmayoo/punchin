"use client";

import { WorkplaceSectionCard } from "@/components/workplace/workplace-section-card";
import { WorkplaceSectionLink } from "@/components/workplace/workplace-section-link";
import { formatDuration24hWithSeconds } from "@/lib/time";
import type { PunchRecord } from "@/types/work";

type WorkplaceMonthlyStatsSectionProps = {
  punches: PunchRecord[];
};

export function WorkplaceMonthlyStatsSection({ punches }: WorkplaceMonthlyStatsSectionProps) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월 기준`;
  const monthPunches = punches.filter((record) => {
    const checkedInMs = new Date(record.checkedInAt).getTime();
    return checkedInMs >= monthStart && checkedInMs < nextMonthStart;
  });
  const employeeStats = monthPunches
    .reduce<
      Array<{
        employeeName: string;
        hours: number;
      }>
    >((acc, record) => {
      const endAt = record.checkedOutAt ?? new Date().toISOString();
      const hours = (new Date(endAt).getTime() - new Date(record.checkedInAt).getTime()) / 3600000;
      const existing = acc.find((item) => item.employeeName === record.employeeName);
      if (existing) {
        existing.hours += hours;
        return acc;
      }
      acc.push({
        employeeName: record.employeeName,
        hours,
      });
      return acc;
    }, [])
    .sort((a, b) => b.hours - a.hours);

  return (
    <WorkplaceSectionCard
      title="이번달 통계"
      action={<WorkplaceSectionLink href="/workplace/stats" label="통계 바로가기" />}
    >
      <div className="space-y-3">
        <p className="text-xs text-zinc-500 dark:text-neutral-500">{monthLabel}</p>
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-100/80 px-3 py-3 dark:border-white/10 dark:bg-black/20">
          {employeeStats.length > 0 ? (
            <div className="space-y-2">
              {employeeStats.map((stat) => (
                <div
                  key={stat.employeeName}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate text-zinc-800 dark:text-neutral-100">
                    {stat.employeeName}
                  </span>
                  <span className="shrink-0 font-medium text-zinc-600 dark:text-neutral-300">
                    {formatDuration24hWithSeconds(stat.hours)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600 dark:text-neutral-400">
              이번달 근무 기록이 없습니다.
            </p>
          )}
        </div>
      </div>
    </WorkplaceSectionCard>
  );
}
