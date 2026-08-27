"use client";

import { useMemo, useState } from "react";

import { DateFieldInput } from "@/components/forms/date-field-input";
import { FullscreenModal } from "@/components/overlay/fullscreen-modal";
import { addDays, dateKey, fromDateInput } from "@/components/schedule/schedule-utils";
import { formatKoMonthDayWeekdayShort } from "@/lib/date-format";
import { formatDurationMinutesKo } from "@/lib/punch/punch-duration";
import { formatSegmentTimeRangeHHMM } from "@/lib/time";
import type { PunchRecord } from "@/types/work";

export type PunchDayImportInput = Omit<PunchRecord, "id" | "branchId">;

export type PunchDayImportModalProps = {
  open: boolean;
  /** 불러올 대상 날짜 (탭한 빈 날) */
  targetDate: string;
  /** 지점으로 필터된 전체 근무 기록 */
  records: PunchRecord[];
  saving: boolean;
  onClose: () => void;
  onApply: (inputs: PunchDayImportInput[]) => void;
};

const PREVIOUS_WEEK_OFFSET_DAYS = -7;

/**
 * 보통 전주를 그대로 반복하므로 **같은 요일 전주**가 기본값이다.
 * 그 날이 비어 있으면 비어 있다고 보여줄 뿐, 다른 날로 옮겨가지 않는다.
 */
function defaultSourceDate(targetDate: string): string {
  const base = fromDateInput(targetDate);
  return base ? dateKey(addDays(base, PREVIOUS_WEEK_OFFSET_DAYS)) : targetDate;
}

function recordDurationMinutes(record: PunchRecord): number {
  const start = new Date(record.checkedInAt).getTime();
  const end = new Date(record.checkedOutAt as string).getTime();
  return Math.max(0, Math.round((end - start) / 60_000));
}

export function PunchDayImportModal({
  open,
  targetDate,
  records,
  saving,
  onClose,
  onApply,
}: PunchDayImportModalProps) {
  const [sourceDate, setSourceDate] = useState(() => defaultSourceDate(targetDate));

  const sourceRecords = useMemo(
    () =>
      records
        .filter((record) => dateKey(new Date(record.checkedInAt)) === sourceDate)
        .sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt)),
    [records, sourceDate],
  );
  const copyable = useMemo(
    () => sourceRecords.filter((record) => record.checkedOutAt !== null),
    [sourceRecords],
  );
  const skippedOngoing = sourceRecords.length - copyable.length;
  const sameDay = sourceDate === targetDate;

  if (!open) {
    return null;
  }

  const targetLabel = (() => {
    const base = fromDateInput(targetDate);
    return base ? formatKoMonthDayWeekdayShort(base) : targetDate;
  })();

  const canApply = !saving && !sameDay && copyable.length > 0;

  const handleApply = () => {
    const source = fromDateInput(sourceDate);
    const target = fromDateInput(targetDate);
    if (!source || !target) {
      return;
    }
    // 한국은 서머타임이 없어 자정↔자정 차이가 벽시계 시각을 그대로 보존한다.
    const deltaMs = target.getTime() - source.getTime();
    onApply(
      copyable.map((record) => ({
        employeeId: record.employeeId,
        employeeName: record.employeeName,
        employeePhone: record.employeePhone,
        checkedInAt: new Date(new Date(record.checkedInAt).getTime() + deltaMs).toISOString(),
        checkedOutAt: new Date(
          new Date(record.checkedOutAt as string).getTime() + deltaMs,
        ).toISOString(),
      })),
    );
  };

  return (
    <FullscreenModal open={open}>
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
          {targetLabel} 근무 불러오기
        </h2>
        <p className="text-sm text-zinc-600 dark:text-neutral-400">
          다른 날의 근무를 그대로 가져옵니다.
        </p>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-zinc-600 dark:text-neutral-400">불러올 날</span>
          <DateFieldInput
            value={sourceDate}
            onChange={(event) => setSourceDate(event.target.value)}
            disabled={saving}
          />
        </label>

        <div className="space-y-2">
          {sameDay ? (
            <p className="text-sm text-zinc-600 dark:text-neutral-400">
              같은 날은 선택할 수 없습니다.
            </p>
          ) : copyable.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-neutral-400">
              {skippedOngoing > 0
                ? "진행 중인 근무만 있어 불러올 수 없습니다."
                : "이 날에는 근무가 없습니다."}
            </p>
          ) : (
            <>
              <p className="text-xs text-zinc-600 dark:text-neutral-400">
                가져올 근무 {copyable.length}건
              </p>
              <ul className="space-y-2">
                {copyable.map((record) => (
                  <li
                    key={record.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-100/80 px-3 py-2 dark:border-white/10 dark:bg-black/20"
                  >
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                      {record.employeeName}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-600 dark:text-neutral-300">
                      {formatSegmentTimeRangeHHMM(
                        record.checkedInAt,
                        record.checkedOutAt as string,
                      )}{" "}
                      ({formatDurationMinutesKo(recordDurationMinutes(record))})
                    </span>
                  </li>
                ))}
              </ul>
              {skippedOngoing > 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  진행 중 {skippedOngoing}건은 제외됩니다.
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200/90 px-3 py-2 text-sm text-zinc-800 dark:border-white/20 dark:text-neutral-200"
          >
            닫기
          </button>
          <button
            type="button"
            disabled={!canApply}
            onClick={handleApply}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-950"
          >
            {saving ? "불러오는 중..." : "적용하기"}
          </button>
        </div>
      </div>
    </FullscreenModal>
  );
}
