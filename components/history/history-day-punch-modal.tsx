"use client";

import { useState } from "react";

import { FullscreenModal } from "@/components/overlay/fullscreen-modal";
import { SchedulePersonSelect } from "@/components/schedule/schedule-person-select";
import type { SchedulePerson } from "@/components/schedule/schedule-types";
import { ScheduleTimePicker24 } from "@/components/schedule/schedule-time-picker-24";
import { fromDateInput, parseTimeHHMM } from "@/components/schedule/schedule-utils";
import { branchMemberName } from "@/lib/branch-display-name";
import { formatKoMonthDayNumeric } from "@/lib/date-format";
import { toast } from "@/lib/toast";
import type { PunchRecord } from "@/types/work";

const timeInputClass =
  "min-h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 font-mono text-sm tabular-nums text-zinc-900 outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500";

export type HistoryDayPunchCreateModalProps = {
  open: boolean;
  saving: boolean;
  date: string;
  canEdit: boolean;
  people: SchedulePerson[];
  onClose: () => void;
  onCreate: (input: Omit<PunchRecord, "id" | "branchId">) => void;
};

export type HistoryDayPunchEditModalProps = {
  open: boolean;
  saving: boolean;
  deleting?: boolean;
  date: string;
  record: PunchRecord | null;
  canEdit: boolean;
  people: SchedulePerson[];
  onClose: () => void;
  onSave: (next: { checkedInAt: string; checkedOutAt: string | null }) => void;
  onDelete: () => void;
};

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildIso(dateInput: string, timeHHMM: string): string | null {
  const base = fromDateInput(dateInput);
  if (!base) {
    return null;
  }
  const clock = parseTimeHHMM(timeHHMM);
  const dt = new Date(base);
  dt.setHours(clock.hour, clock.minute, 0, 0);
  return dt.toISOString();
}

const MS_PER_24H = 24 * 60 * 60 * 1000;

export function HistoryDayPunchCreateModal({
  open,
  saving,
  date,
  canEdit,
  people,
  onClose,
  onCreate,
}: HistoryDayPunchCreateModalProps) {
  const workDay = date.trim();
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [ongoing, setOngoing] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState(() => people[0]?.id ?? "");

  if (!open) {
    return null;
  }

  const dayLabel = (() => {
    const d = fromDateInput(workDay);
    return d ? formatKoMonthDayNumeric(d) : workDay;
  })();

  const selectedPerson = people.find((person) => person.id === selectedPersonId) ?? null;

  return (
    <FullscreenModal open={open}>
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">실제 근무 추가</h2>

        <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-xl border border-zinc-200/90 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-white/15 dark:bg-white/5 dark:text-neutral-200">
            <span className="text-xs text-zinc-500 dark:text-neutral-400">근무일</span>
            <p className="mt-0.5 font-medium">{dayLabel}</p>
          </div>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-zinc-600 dark:text-neutral-400">직원</span>
            <SchedulePersonSelect
              value={selectedPersonId}
              people={people}
              disabled={saving || !canEdit}
              onChange={setSelectedPersonId}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-600 dark:text-neutral-400">시작 시간</span>
            <ScheduleTimePicker24
              value={startTime}
              onChange={setStartTime}
              disabled={saving || !canEdit}
              inputClassName={timeInputClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-600 dark:text-neutral-400">종료 시간</span>
            <ScheduleTimePicker24
              value={endTime}
              onChange={setEndTime}
              disabled={saving || !canEdit || ongoing}
              inputClassName={timeInputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-neutral-200 sm:col-span-2">
            <input
              type="checkbox"
              checked={ongoing}
              onChange={(e) => setOngoing(e.target.checked)}
              disabled={saving || !canEdit}
            />
            진행 중(종료 없음)
          </label>
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
            disabled={saving || !canEdit}
            onClick={() => {
              const checkedInAt = buildIso(workDay, startTime);
              const checkedOutAt = ongoing ? null : buildIso(workDay, endTime);
              if (!checkedInAt || (!ongoing && !checkedOutAt)) {
                toast.error("날짜/시간 형식을 확인해 주세요.");
                return;
              }
              if (
                !ongoing &&
                new Date(checkedOutAt as string).getTime() <= new Date(checkedInAt).getTime()
              ) {
                toast.error("종료 시간이 시작 시간보다 늦어야 합니다.");
                return;
              }
              if (!ongoing && checkedOutAt) {
                const spanMs = new Date(checkedOutAt).getTime() - new Date(checkedInAt).getTime();
                if (spanMs > MS_PER_24H) {
                  toast.error("실제 근무는 24시간을 넘을 수 없습니다.");
                  return;
                }
              }
              if (!selectedPerson) {
                toast.error("직원을 선택해 주세요.");
                return;
              }
              onCreate({
                employeeId: selectedPerson.id,
                employeeName: branchMemberName(selectedPerson.nickname, selectedPerson.name),
                employeePhone: selectedPerson.employeePhone,
                checkedInAt,
                checkedOutAt,
              });
            }}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-950"
          >
            {saving ? "저장 중..." : "추가"}
          </button>
        </div>
      </div>
    </FullscreenModal>
  );
}

export function HistoryDayPunchEditModal({
  open,
  saving,
  deleting = false,
  date,
  record,
  canEdit,
  people,
  onClose,
  onSave,
  onDelete,
}: HistoryDayPunchEditModalProps) {
  const workDay = date.trim();
  const [startTime, setStartTime] = useState(() =>
    record ? hhmm(record.checkedInAt) : "09:00",
  );
  const [endTime, setEndTime] = useState(() =>
    record && record.checkedOutAt ? hhmm(record.checkedOutAt) : "18:00",
  );
  const [ongoing, setOngoing] = useState(() => record?.checkedOutAt === null);
  const selectedPersonId = record?.employeeId ?? people[0]?.id ?? "";

  if (!open || !record) {
    return null;
  }

  const dayLabel = (() => {
    const d = fromDateInput(workDay);
    return d ? formatKoMonthDayNumeric(d) : workDay;
  })();

  return (
    <FullscreenModal open={open}>
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">실제 근무 시간 수정</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-xl border border-zinc-200/90 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-white/15 dark:bg-white/5 dark:text-neutral-200">
            <span className="text-xs text-zinc-500 dark:text-neutral-400">근무일</span>
            <p className="mt-0.5 font-medium">{dayLabel}</p>
          </div>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-zinc-600 dark:text-neutral-400">직원</span>
            <SchedulePersonSelect
              value={selectedPersonId}
              people={people}
              disabled
              onChange={() => {}}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-600 dark:text-neutral-400">시작 시간</span>
            <ScheduleTimePicker24
              value={startTime}
              onChange={setStartTime}
              disabled={saving || deleting || !canEdit}
              inputClassName={timeInputClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-600 dark:text-neutral-400">종료 시간</span>
            <ScheduleTimePicker24
              value={endTime}
              onChange={setEndTime}
              disabled={saving || deleting || !canEdit || ongoing}
              inputClassName={timeInputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-neutral-200 sm:col-span-2">
            <input
              type="checkbox"
              checked={ongoing}
              onChange={(e) => setOngoing(e.target.checked)}
              disabled={saving || deleting || !canEdit}
            />
            진행 중(종료 없음)
          </label>
        </div>

        <div className="flex justify-between gap-2">
          <button
            type="button"
            disabled={saving || deleting || !canEdit}
            onClick={onDelete}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60 dark:border-red-700/60 dark:text-red-300"
          >
            {deleting ? "삭제 중..." : "삭제"}
          </button>
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
              disabled={saving || deleting || !canEdit}
              onClick={() => {
                const checkedInAt = buildIso(workDay, startTime);
                const checkedOutAt = ongoing ? null : buildIso(workDay, endTime);
                if (!checkedInAt || (!ongoing && !checkedOutAt)) {
                  toast.error("날짜/시간 형식을 확인해 주세요.");
                  return;
                }
                if (
                  !ongoing &&
                  new Date(checkedOutAt as string).getTime() <= new Date(checkedInAt).getTime()
                ) {
                  toast.error("종료 시간이 시작 시간보다 늦어야 합니다.");
                  return;
                }
                if (!ongoing && checkedOutAt) {
                  const spanMs = new Date(checkedOutAt).getTime() - new Date(checkedInAt).getTime();
                  if (spanMs > MS_PER_24H) {
                    toast.error("실제 근무는 24시간을 넘을 수 없습니다.");
                    return;
                  }
                }
                onSave({ checkedInAt, checkedOutAt });
              }}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-950"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </div>
    </FullscreenModal>
  );
}
