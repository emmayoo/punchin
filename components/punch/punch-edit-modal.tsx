"use client";

import { useEffect, useMemo, useState } from "react";

import { FullscreenModal } from "@/components/overlay/fullscreen-modal";
import { ScheduleTimePicker24 } from "@/components/schedule/schedule-time-picker-24";
import { StaffPersonSelect } from "@/components/staff/staff-person-select";
import { buildWorkDayTimeIso, dateKey } from "@/components/schedule/schedule-utils";
import { DateFieldInput } from "@/components/forms/date-field-input";
import { formStackClass } from "@/lib/forms/input-classes";
import { DEFAULT_MEMBER_COLOR } from "@/lib/constants/color";
import { branchMemberToStaffOption } from "@/lib/staff-person-options";
import { toast } from "@/lib/toast";
import type { BranchMemberListItem, PunchRecord } from "@/types/work";

const timeInputClass =
  "min-h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 font-mono text-sm tabular-nums text-zinc-900 outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500";

const MS_PER_24H = 24 * 60 * 60 * 1000;

export type PunchRecordSaveInput = {
  checkedInAt: string;
  checkedOutAt: string | null;
  employeeId: string;
  employeeName: string;
  employeePhone: string;
};

export type PunchEditModalProps = {
  mode: "create" | "edit";
  open: boolean;
  saving: boolean;
  deleting?: boolean;
  record: PunchRecord | null;
  canEdit: boolean;
  members: BranchMemberListItem[];
  onClose: () => void;
  onSave: (next: PunchRecordSaveInput) => void;
  onCreate: (input: Omit<PunchRecord, "id" | "branchId">) => void;
  onDelete: () => void;
};

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toDateKey(iso: string): string {
  return dateKey(new Date(iso));
}

function initialFormState(record: PunchRecord | null, members: BranchMemberListItem[]) {
  const today = dateKey(new Date());
  if (!record) {
    return {
      startDate: today,
      startTime: "09:00",
      endDate: today,
      endTime: "18:00",
      ongoing: false,
      selectedEmployeeId: members[0]?.employeeId ?? "",
    };
  }
  return {
    startDate: toDateKey(record.checkedInAt),
    startTime: hhmm(record.checkedInAt),
    endDate: record.checkedOutAt ? toDateKey(record.checkedOutAt) : toDateKey(record.checkedInAt),
    endTime: record.checkedOutAt ? hhmm(record.checkedOutAt) : "18:00",
    ongoing: record.checkedOutAt === null,
    selectedEmployeeId: record.employeeId,
  };
}

function resolvePunchTimes(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  ongoing: boolean,
): { ok: true; checkedInAt: string; checkedOutAt: string | null } | { ok: false; message: string } {
  const checkedInAt = buildWorkDayTimeIso(startDate, startTime);
  let checkedOutAt: string | null = null;
  if (!ongoing) {
    checkedOutAt =
      endDate === startDate
        ? buildWorkDayTimeIso(endDate, endTime, {
            endOfWorkDayMidnight: true,
            startTimeHHMM: startTime,
          })
        : buildWorkDayTimeIso(endDate, endTime);
  }

  if (!checkedInAt || (!ongoing && !checkedOutAt)) {
    return { ok: false, message: "날짜/시간 형식을 확인해 주세요." };
  }

  if (!ongoing && checkedOutAt) {
    const startMs = new Date(checkedInAt).getTime();
    const endMs = new Date(checkedOutAt).getTime();
    if (endMs <= startMs) {
      return { ok: false, message: "종료 시간이 시작 시간보다 늦어야 합니다." };
    }
    if (endMs - startMs > MS_PER_24H) {
      return { ok: false, message: "실제 근무는 24시간을 넘을 수 없습니다." };
    }
  }

  return { ok: true, checkedInAt, checkedOutAt };
}

function resolveSelectedEmployee(
  members: BranchMemberListItem[],
  selectedEmployeeId: string,
  record: PunchRecord | null,
): { employeeId: string; employeeName: string; employeePhone: string } | null {
  const member = members.find((item) => item.employeeId === selectedEmployeeId);
  if (member) {
    return {
      employeeId: member.employeeId,
      employeeName: member.name,
      employeePhone: member.phone,
    };
  }
  if (record?.employeeId === selectedEmployeeId) {
    return {
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      employeePhone: record.employeePhone,
    };
  }
  return null;
}

function buildStaffOptions(members: BranchMemberListItem[], record: PunchRecord | null) {
  const base = members.map(branchMemberToStaffOption);
  if (record && !base.some((option) => option.id === record.employeeId)) {
    return [
      { id: record.employeeId, label: record.employeeName, color: DEFAULT_MEMBER_COLOR },
      ...base,
    ];
  }
  return base;
}

export function PunchEditModal({
  mode,
  open,
  saving,
  deleting = false,
  record,
  canEdit,
  members,
  onClose,
  onSave,
  onCreate,
  onDelete,
}: PunchEditModalProps) {
  const initial = initialFormState(record, members);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [ongoing, setOngoing] = useState(initial.ongoing);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initial.selectedEmployeeId);

  useEffect(() => {
    if (open && mode === "create" && !selectedEmployeeId && members[0]) {
      setSelectedEmployeeId(members[0].employeeId);
    }
  }, [open, mode, members, selectedEmployeeId]);

  const staffOptions = useMemo(() => buildStaffOptions(members, record), [members, record]);

  if (!open) {
    return null;
  }

  const formDisabled = saving || deleting || !canEdit;

  return (
    <FullscreenModal open={open}>
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
          {mode === "create" ? "실제 근무 추가" : "실제 근무 시간 수정"}
        </h2>
        {mode === "create" ? (
          <p className="text-sm text-zinc-600 dark:text-neutral-400">
            직원과 시작/종료 시간을 입력해 실제 근무를 추가합니다.
          </p>
        ) : null}

        <label className="space-y-1">
          <span className="text-xs text-zinc-600 dark:text-neutral-400">직원</span>
          <StaffPersonSelect
            value={selectedEmployeeId}
            options={staffOptions}
            onChange={setSelectedEmployeeId}
            disabled={formDisabled}
          />
        </label>

        <div className={formStackClass}>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-zinc-600 dark:text-neutral-400">시작 날짜</span>
            <DateFieldInput
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={formDisabled}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-zinc-600 dark:text-neutral-400">시작 시간</span>
            <div className="min-w-0 overflow-hidden">
              <ScheduleTimePicker24
                value={startTime}
                onChange={setStartTime}
                disabled={formDisabled}
                inputClassName={timeInputClass}
              />
            </div>
          </label>

          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-zinc-600 dark:text-neutral-400">종료 날짜</span>
            <DateFieldInput
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={formDisabled || ongoing}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-zinc-600 dark:text-neutral-400">종료 시간</span>
            <div className="min-w-0 overflow-hidden">
              <ScheduleTimePicker24
                value={endTime}
                onChange={setEndTime}
                disabled={formDisabled || ongoing}
                inputClassName={timeInputClass}
              />
            </div>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-neutral-200">
          <input
            type="checkbox"
            checked={ongoing}
            onChange={(e) => setOngoing(e.target.checked)}
            disabled={formDisabled}
          />
          진행 중(종료 없음)
        </label>

        <div className="flex justify-between gap-2">
          {mode === "edit" ? (
            <button
              type="button"
              disabled={formDisabled}
              onClick={onDelete}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60 dark:border-red-700/60 dark:text-red-300"
            >
              {deleting ? "삭제 중..." : "삭제"}
            </button>
          ) : (
            <div />
          )}
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
              disabled={formDisabled}
              onClick={() => {
                const resolved = resolvePunchTimes(
                  startDate,
                  startTime,
                  endDate,
                  endTime,
                  ongoing,
                );
                if (!resolved.ok) {
                  toast.error(resolved.message);
                  return;
                }
                const employee = resolveSelectedEmployee(members, selectedEmployeeId, record);
                if (!employee) {
                  toast.error("직원을 선택해 주세요.");
                  return;
                }
                const payload = {
                  ...employee,
                  checkedInAt: resolved.checkedInAt,
                  checkedOutAt: resolved.checkedOutAt,
                };
                if (mode === "create") {
                  onCreate(payload);
                  return;
                }
                onSave(payload);
              }}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-950"
            >
              {saving ? "저장 중..." : mode === "create" ? "추가" : "저장"}
            </button>
          </div>
        </div>
      </div>
    </FullscreenModal>
  );
}
