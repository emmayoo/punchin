"use client";

import { DailyShiftTimeline } from "@/components/timeline/daily-shift-timeline";
import type { PunchRecord, Shift } from "@/types/work";

type WorkplaceTimelineSectionProps = {
  shifts: Shift[];
  punches: PunchRecord[];
  nowIso: string;
};

export function WorkplaceTimelineSection({
  shifts,
  punches,
  nowIso,
}: WorkplaceTimelineSectionProps) {
  const todayLabel = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(nowIso));

  return (
    <div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0">
      <div className="min-w-[320px]">
        <DailyShiftTimeline
          shifts={shifts}
          punches={punches}
          nowIso={nowIso}
          title={`타임라인 · ${todayLabel}`}
        />
      </div>
    </div>
  );
}
