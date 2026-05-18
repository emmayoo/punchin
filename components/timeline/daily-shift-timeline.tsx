"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { workApi } from "@/lib/api/work-api";
import type { PunchRecord, Shift } from "@/types/work";

type DailyShiftTimelineProps = {
  shifts: Shift[];
  punches: PunchRecord[];
  nowIso: string;
  title?: string;
  showActiveLabel?: boolean;
};

const PIXELS_PER_HOUR = 60;
const MINUTES_IN_DAY = 24 * 60;
const TIMELINE_WIDTH = 24 * PIXELS_PER_HOUR;
const TIMELINE_LABEL_INSET = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 타임라인 당일 0시 기준 경과 분. 자정 종료(다음날 00:00)는 1440 — 시·분만 쓰면 0으로 잘못 계산됨. */
function minutesFromTimelineDayStart(iso: string, dayStart: Date): number {
  return (new Date(iso).getTime() - dayStart.getTime()) / 60_000;
}

function hhmm(iso: string): string {
  const date = new Date(iso);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function displayEndHhmm(endAt: string, dayStart: Date): string {
  const endMin = minutesFromTimelineDayStart(endAt, dayStart);
  if (endMin >= MINUTES_IN_DAY - 1e-3) {
    return "24:00";
  }
  return hhmm(endAt);
}

function dayWindow(iso: string): { start: Date; end: Date } {
  const start = new Date(iso);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function overlaps(
  startMs: number,
  endMs: number,
  windowStartMs: number,
  windowEndMs: number,
): boolean {
  return startMs < windowEndMs && endMs > windowStartMs;
}

type ActualTimelineItem = {
  id: string;
  employeeName: string;
  startAt: string;
  endAt: string;
  ongoing: boolean;
};

type TimelineHeaderProps = {
  title: string;
  activeLabel: React.ReactNode;
  showActiveLabel: boolean;
  onScrollToNow: () => void;
};

function TimelineHeader({
  title,
  activeLabel,
  showActiveLabel,
  onScrollToNow,
}: TimelineHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-zinc-500 dark:text-neutral-500">{title}</p>
        {showActiveLabel ? (
          <div className="mt-1 text-xs text-zinc-600 dark:text-neutral-300">{activeLabel}</div>
        ) : null}
      </div>
      <button
        onClick={onScrollToNow}
        className="rounded-lg border border-zinc-300/90 px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:border-zinc-400 dark:border-white/20 dark:text-neutral-200 dark:hover:border-white/40"
      >
        현재
      </button>
    </div>
  );
}

type TimelineChartProps = {
  viewportRef: RefObject<HTMLDivElement | null>;
  nowLeft: number;
  timelineDayStart: Date;
  todayShifts: Shift[];
  actualShifts: ActualTimelineItem[];
};

function TimelineChart({
  viewportRef,
  nowLeft,
  timelineDayStart,
  todayShifts,
  actualShifts,
}: TimelineChartProps) {
  return (
    <div
      ref={viewportRef}
      className="overflow-x-auto rounded-xl border border-zinc-200/90 bg-zinc-100/80 px-5 py-3 dark:border-white/10 dark:bg-neutral-950/60"
    >
      <div className="relative" style={{ width: `${TIMELINE_WIDTH}px` }}>
        <div className="relative h-7 border-b border-zinc-200/80 dark:border-white/10">
          {Array.from({ length: 25 }).map((_, hour) => {
            const left = (hour / 24) * TIMELINE_WIDTH;
            return (
              <div
                key={`tick-${hour}`}
                className="absolute top-0 h-full border-l border-zinc-200/80 dark:border-white/10"
                style={{ left: `${left}px` }}
              >
                <span className="absolute -top-0.5 -translate-x-1/2 text-[10px] text-zinc-500 dark:text-neutral-500">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
            );
          })}
        </div>

        <div className="relative h-44">
          {todayShifts.map((shift, index) => {
            const start = clamp(
              minutesFromTimelineDayStart(shift.startAt, timelineDayStart),
              0,
              MINUTES_IN_DAY,
            );
            const end = clamp(
              minutesFromTimelineDayStart(shift.endAt, timelineDayStart),
              0,
              MINUTES_IN_DAY,
            );
            const left = (start / MINUTES_IN_DAY) * TIMELINE_WIDTH;
            const width = Math.max(
              ((Math.max(start + 1, end) - start) / MINUTES_IN_DAY) * TIMELINE_WIDTH,
              14,
            );
            const top = 8 + (index % 3) * 34;
            return (
              <div key={shift.id}>
                <div
                  className="absolute rounded-md border border-sky-200/25 bg-sky-300/10"
                  style={{
                    left: `${left}px`,
                    width: `${width}px`,
                    top: `${top}px`,
                    height: "34px",
                  }}
                  title={`${shift.employeeName} ${hhmm(shift.startAt)}-${displayEndHhmm(shift.endAt, timelineDayStart)}`}
                />
                <div
                  className="pointer-events-none absolute whitespace-nowrap text-[11px] text-sky-500/90"
                  style={{
                    left: `${left + TIMELINE_LABEL_INSET}px`,
                    top: `${top + 1}px`,
                  }}
                >
                  <p>{shift.employeeName}</p>
                  <p className="text-[10px]">
                    {hhmm(shift.startAt)}-{displayEndHhmm(shift.endAt, timelineDayStart)}
                  </p>
                </div>
              </div>
            );
          })}

          {actualShifts.map((shift, index) => {
            const start = clamp(
              minutesFromTimelineDayStart(shift.startAt, timelineDayStart),
              0,
              MINUTES_IN_DAY,
            );
            const end = clamp(
              minutesFromTimelineDayStart(shift.endAt, timelineDayStart),
              0,
              MINUTES_IN_DAY,
            );
            const left = (start / MINUTES_IN_DAY) * TIMELINE_WIDTH;
            const width = Math.max(
              ((Math.max(start + 1, end) - start) / MINUTES_IN_DAY) * TIMELINE_WIDTH,
              14,
            );
            const top = 80 + (index % 2) * 34;
            return (
              <div key={`actual-${shift.id}`}>
                <div
                  className="absolute rounded-md border border-emerald-300/45 bg-emerald-300/20"
                  style={{
                    left: `${left}px`,
                    width: `${width}px`,
                    top: `${top}px`,
                    height: "34px",
                  }}
                  title={`${shift.employeeName} ${hhmm(shift.startAt)}-${displayEndHhmm(shift.endAt, timelineDayStart)}${
                    shift.ongoing ? " (근무 중)" : ""
                  }`}
                />
                <div
                  className="pointer-events-none absolute whitespace-nowrap text-[11px] text-emerald-900 dark:text-emerald-100"
                  style={{
                    left: `${left + TIMELINE_LABEL_INSET}px`,
                    top: `${top + 1}px`,
                  }}
                >
                  <p>
                    {shift.employeeName}
                    {shift.ongoing ? " · 근무 중" : ""}
                  </p>
                  <p className="text-[10px]">
                    {hhmm(shift.startAt)}-{displayEndHhmm(shift.endAt, timelineDayStart)}
                  </p>
                </div>
              </div>
            );
          })}

          <div
            className="absolute top-0 h-full border-l-2 border-rose-300"
            style={{ left: `${nowLeft}px` }}
          />
        </div>
      </div>
    </div>
  );
}

export function DailyShiftTimeline({
  shifts,
  punches,
  nowIso,
  title = "오늘 근무 타임라인",
  showActiveLabel = true,
}: DailyShiftTimelineProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [todayShifts, setTodayShifts] = useState<Shift[]>([]);

  const timelineDayStart = useMemo(() => dayWindow(nowIso).start, [nowIso]);
  const nowMinute = clamp(minutesFromTimelineDayStart(nowIso, timelineDayStart), 0, MINUTES_IN_DAY);
  const nowLeft = (nowMinute / MINUTES_IN_DAY) * TIMELINE_WIDTH;

  const scrollToNow = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const style = window.getComputedStyle(viewport);
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;

    const nowPosition = paddingLeft + nowLeft;
    const target = nowPosition - viewport.clientWidth / 2;
    viewport.scrollTo({
      left: Math.max(0, target),
      behavior: "smooth",
    });
  }, [nowLeft]);

  useEffect(() => {
    let mounted = true;
    void workApi.getTimelineShifts(nowIso, shifts).then((items) => {
      if (!mounted) {
        return;
      }
      setTodayShifts(items);
    });

    return () => {
      mounted = false;
    };
  }, [shifts, nowIso]);

  const actualShifts = useMemo(() => {
    const { start, end } = dayWindow(nowIso);
    const dayStartMs = start.getTime();
    const dayEndMs = end.getTime();
    const nowMs = new Date(nowIso).getTime();

    return punches
      .map((record) => {
        const checkedInMs = new Date(record.checkedInAt).getTime();
        const checkedOutMs = record.checkedOutAt ? new Date(record.checkedOutAt).getTime() : nowMs;
        if (!overlaps(checkedInMs, checkedOutMs, dayStartMs, dayEndMs)) {
          return null;
        }
        const clippedStartMs = Math.max(checkedInMs, dayStartMs);
        const clippedEndMs = Math.min(checkedOutMs, dayEndMs);
        return {
          id: record.id,
          employeeName: record.employeeName,
          startAt: new Date(clippedStartMs).toISOString(),
          endAt: new Date(clippedEndMs).toISOString(),
          ongoing: record.checkedOutAt === null,
        } satisfies ActualTimelineItem;
      })
      .filter((item): item is ActualTimelineItem => item !== null)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [punches, nowIso]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      scrollToNow();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [scrollToNow, todayShifts.length]);

  const activeWorkers = useMemo(() => {
    const nowMs = new Date(nowIso).getTime();
    return punches
      .filter((record) => {
        const checkedInMs = new Date(record.checkedInAt).getTime();
        const checkedOutMs = record.checkedOutAt
          ? new Date(record.checkedOutAt).getTime()
          : Number.POSITIVE_INFINITY;
        return checkedInMs <= nowMs && nowMs < checkedOutMs;
      })
      .sort((a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime());
  }, [punches, nowIso]);
  const activeLabel =
    activeWorkers.length === 0
      ? "근무중 (0명) : 없음"
      : `근무중 (${activeWorkers.length}명) : ${activeWorkers
          .map((worker) => `${worker.employeeName}(${hhmm(worker.checkedInAt)}~)`)
          .join(" / ")}`;

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
      <TimelineHeader
        title={title}
        activeLabel={activeLabel}
        showActiveLabel={showActiveLabel}
        onScrollToNow={scrollToNow}
      />

      <TimelineChart
        viewportRef={viewportRef}
        nowLeft={nowLeft}
        timelineDayStart={timelineDayStart}
        todayShifts={todayShifts}
        actualShifts={actualShifts}
      />
    </section>
  );
}
