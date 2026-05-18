"use client";

import { useState } from "react";

import { FullscreenModal } from "@/components/overlay/fullscreen-modal";
import { ScheduleTimePicker24 } from "@/components/schedule/schedule-time-picker-24";
import { dateKey, fromDateInput, parseTimeHHMM } from "@/components/schedule/schedule-utils";
import { toast } from "@/lib/toast";
import type { BranchMemberListItem, PunchRecord } from "@/types/work";

const fieldClass =
  "w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500";

const timeInputClass =
  "min-h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 font-mono text-sm tabular-nums text-zinc-900 outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500";

export type PunchEditModalProps = {
  mode: "create" | "edit";
  open: boolean;
  saving: boolean;
  deleting?: boolean;
  record: PunchRecord | null;
  canEdit: boolean;
  members: BranchMemberListItem[];
  onClose: () => void;
  onSave: (next: { checkedInAt: string; checkedOutAt: string | null }) => void;
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
  const [startDate, setStartDate] = useState(() =>
    record ? toDateKey(record.checkedInAt) : dateKey(new Date()),
  );
  const [startTime, setStartTime] = useState(() => (record ? hhmm(record.checkedInAt) : "09:00"));
  const [endDate, setEndDate] = useState(() =>
    record && record.checkedOutAt ? toDateKey(record.checkedOutAt) : dateKey(new Date()),
  );
  const [endTime, setEndTime] = useState(() =>
    record && record.checkedOutAt ? hhmm(record.checkedOutAt) : "18:00",
  );
  const [ongoing, setOngoing] = useState(() => record?.checkedOutAt === null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() =>
    record?.employeeId ? record.employeeId : (members[0]?.employeeId ?? ""),
  );

  if (!open) {
    return null;
  }

  const selectedMember =
    mode === "create"
      ? (members.find((member) => member.employeeId === selectedEmployeeId) ?? null)
      : null;

  return (
    <FullscreenModal open={open}>
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
          {mode === "create" ? "실제 근무 추가" : "실제 근무 시간 수정"}
        </h2>
        {record ? (
          <p className="text-sm text-zinc-600 dark:text-neutral-400">
            {record.employeeName} · {toDateKey(record.checkedInAt)}
          </p>
        ) : mode === "create" ? (
          <p className="text-sm text-zinc-600 dark:text-neutral-400">
            직원과 시작/종료 시간을 입력해 실제 근무를 추가합니다.
          </p>
        ) : null}

        {mode === "create" ? (
          <label className="space-y-1">
            <span className="text-xs text-zinc-600 dark:text-neutral-400">직원</span>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              disabled={saving || deleting || !canEdit}
              className={fieldClass}
            >
              {members.map((member) => (
                <option key={member.employeeId} value={member.employeeId}>
                  {member.name} ({member.phone})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-zinc-600 dark:text-neutral-400">시작 날짜</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={saving || !canEdit}
              className={fieldClass}
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
            <span className="text-xs text-zinc-600 dark:text-neutral-400">종료 날짜</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={saving || deleting || !canEdit || ongoing}
              className={fieldClass}
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
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-neutral-200">
          <input
            type="checkbox"
            checked={ongoing}
            onChange={(e) => setOngoing(e.target.checked)}
            disabled={saving || deleting || !canEdit}
          />
          진행 중(종료 없음)
        </label>

        <div className="flex justify-between gap-2">
          {mode === "edit" ? (
            <button
              type="button"
              disabled={saving || deleting || !canEdit}
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
              disabled={saving || deleting || !canEdit}
              onClick={() => {
                const checkedInAt = buildIso(startDate, startTime);
                const checkedOutAt = ongoing ? null : buildIso(endDate, endTime);
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
                if (mode === "create") {
                  if (!selectedMember) {
                    toast.error("직원을 선택해 주세요.");
                    return;
                  }
                  onCreate({
                    employeeId: selectedMember.employeeId,
                    employeeName: selectedMember.name,
                    employeePhone: selectedMember.phone,
                    checkedInAt,
                    checkedOutAt,
                  });
                  return;
                }
                onSave({ checkedInAt, checkedOutAt });
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
