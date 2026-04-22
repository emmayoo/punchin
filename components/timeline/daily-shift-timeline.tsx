"use client";

import { workApi } from "@/lib/api/work-api";
import type { PunchRecord, Shift } from "@/types/work";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DailyShiftTimelineProps = {
  shifts: Shift[];
  punches: PunchRecord[];
  nowIso: string;
};

const PIXELS_PER_HOUR = 60;
const MINUTES_IN_DAY = 24 * 60;
const TIMELINE_WIDTH = 24 * PIXELS_PER_HOUR;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dayMinute(iso: string): number {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

function hhmm(iso: string): string {
  const date = new Date(iso);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
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

export function DailyShiftTimeline({
  shifts,
  punches,
  nowIso,
}: DailyShiftTimelineProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [todayShifts, setTodayShifts] = useState<Shift[]>([]);

  const nowMinute = dayMinute(nowIso);
  const nowLeft = (nowMinute / MINUTES_IN_DAY) * TIMELINE_WIDTH;

  const scrollToNow = useCallback(() => {
    if (!viewportRef.current) {
      return;
    }
    const target = nowLeft - viewportRef.current.clientWidth / 2;
    viewportRef.current.scrollTo({
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
        const checkedOutMs = record.checkedOutAt
          ? new Date(record.checkedOutAt).getTime()
          : nowMs;
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
      .sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
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
    return punches.filter((record) => {
      const checkedInMs = new Date(record.checkedInAt).getTime();
      const checkedOutMs = record.checkedOutAt
        ? new Date(record.checkedOutAt).getTime()
        : Number.POSITIVE_INFINITY;
      return checkedInMs <= nowMs && nowMs < checkedOutMs;
    });
  }, [punches, nowIso]);
  const activeLabel =
    activeWorkers.length === 0
      ? "근무 중: 없음"
      : activeWorkers.length === 1
        ? `근무 중: ${activeWorkers[0].employeeName}님`
        : `근무 중: ${activeWorkers[0].employeeName}님 외 ${
            activeWorkers.length - 1
          }명`;

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-neutral-500">오늘 근무 타임라인</p>
          <p className="mt-1 text-xs text-neutral-300">{activeLabel}</p>
        </div>
        <button
          onClick={scrollToNow}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-neutral-200 transition-colors hover:border-white/40"
        >
          현재
        </button>
      </div>

      <div
        ref={viewportRef}
        className="overflow-x-auto rounded-xl border border-white/10 bg-neutral-950/60 px-5 py-3"
      >
        <div className="relative" style={{ width: `${TIMELINE_WIDTH}px` }}>
          <div className="relative h-7 border-b border-white/10">
            {Array.from({ length: 25 }).map((_, hour) => {
              const left = (hour / 24) * TIMELINE_WIDTH;
              return (
                <div
                  key={`tick-${hour}`}
                  className="absolute top-0 h-full border-l border-white/10"
                  style={{ left: `${left}px` }}
                >
                  <span className="absolute -top-0.5 -translate-x-1/2 text-[10px] text-neutral-500">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>
              );
            })}
          </div>

          <div className="relative h-40">
            {todayShifts.map((shift, index) => {
              const start = clamp(dayMinute(shift.startAt), 0, MINUTES_IN_DAY);
              const end = clamp(dayMinute(shift.endAt), 0, MINUTES_IN_DAY);
              const left = (start / MINUTES_IN_DAY) * TIMELINE_WIDTH;
              const width = Math.max(
                ((Math.max(start + 1, end) - start) / MINUTES_IN_DAY) *
                  TIMELINE_WIDTH,
                14,
              );
              const top = 8 + (index % 3) * 34;
              return (
                <div
                  key={shift.id}
                  className="absolute rounded-md border border-sky-200/25 bg-sky-300/10 px-2 py-1 text-[11px] text-sky-100/80"
                  style={{
                    left: `${left}px`,
                    width: `${width}px`,
                    top: `${top}px`,
                  }}
                  title={`${shift.employeeName} ${hhmm(shift.startAt)}-${hhmm(shift.endAt)}`}
                >
                  <p className="truncate">{shift.employeeName}</p>
                  <p className="truncate text-[10px] text-sky-200">
                    {hhmm(shift.startAt)}-{hhmm(shift.endAt)}
                  </p>
                </div>
              );
            })}

            {actualShifts.map((shift, index) => {
              const start = clamp(dayMinute(shift.startAt), 0, MINUTES_IN_DAY);
              const end = clamp(dayMinute(shift.endAt), 0, MINUTES_IN_DAY);
              const left = (start / MINUTES_IN_DAY) * TIMELINE_WIDTH;
              const width = Math.max(
                ((Math.max(start + 1, end) - start) / MINUTES_IN_DAY) *
                  TIMELINE_WIDTH,
                14,
              );
              const top = 80 + (index % 2) * 28;
              return (
                <div
                  key={`actual-${shift.id}`}
                  className="absolute rounded-md border border-emerald-300/45 bg-emerald-300/20 px-2 py-1 text-[11px] text-emerald-100"
                  style={{
                    left: `${left}px`,
                    width: `${width}px`,
                    top: `${top}px`,
                  }}
                  title={`${shift.employeeName} ${hhmm(shift.startAt)}-${hhmm(shift.endAt)}${
                    shift.ongoing ? " (근무 중)" : ""
                  }`}
                >
                  <p className="truncate">
                    {shift.employeeName}
                    {shift.ongoing ? " · 근무 중" : ""}
                  </p>
                  <p className="truncate text-[10px] text-emerald-200">
                    {hhmm(shift.startAt)}-{hhmm(shift.endAt)}
                  </p>
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
    </section>
  );
}
