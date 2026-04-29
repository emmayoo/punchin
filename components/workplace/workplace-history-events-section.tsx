"use client";

import { WorkplaceSectionCard } from "@/components/workplace/workplace-section-card";
import { WorkplaceSectionLink } from "@/components/workplace/workplace-section-link";
import { formatTime } from "@/lib/time";
import type { CalendarEvent, PunchRecord } from "@/types/work";

type WorkplaceHistoryEventsSectionProps = {
  punches: PunchRecord[];
  events: CalendarEvent[];
};

export function WorkplaceHistoryEventsSection({
  punches,
  events,
}: WorkplaceHistoryEventsSectionProps) {
  const recentPunches = [...punches]
    .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime())
    .slice(0, 3);

  return (
    <WorkplaceSectionCard
      title="오늘 근무 이력 및 이벤트"
      action={<WorkplaceSectionLink href="/workplace/history" label="캘린더 바로가기" />}
    >
      <div className="space-y-3">
        <div>
          <p className="text-xs text-zinc-500 dark:text-neutral-500">
            근무 건수 ({punches.length}개)
          </p>
          {recentPunches.length > 0 ? (
            <div className="mt-2 space-y-1">
              {recentPunches.map((record) => (
                <p key={record.id} className="text-sm text-zinc-800 dark:text-neutral-100">
                  {record.employeeName} · {formatTime(record.checkedInAt)}
                  {record.checkedOutAt ? ` - ${formatTime(record.checkedOutAt)}` : " - 진행 중"}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600 dark:text-neutral-400">
              최근 이력이 없습니다.
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-neutral-500">이벤트 ({events.length}개)</p>
          {events.length > 0 ? (
            <div className="mt-2 space-y-1">
              {events.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-2 text-sm text-zinc-800 dark:text-neutral-100"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/5 dark:border-white/10"
                    style={{ backgroundColor: event.color }}
                    aria-hidden="true"
                  />
                  <p className="truncate">{event.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600 dark:text-neutral-400">
              오늘 등록된 이벤트가 없습니다.
            </p>
          )}
        </div>
      </div>
    </WorkplaceSectionCard>
  );
}
