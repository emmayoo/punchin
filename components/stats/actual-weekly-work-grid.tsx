"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { FullscreenModal } from "@/components/overlay/fullscreen-modal";
import { ScheduleTimePicker24 } from "@/components/schedule/schedule-time-picker-24";
import type { SchedulePerson } from "@/components/schedule/schedule-types";
import {
  addDays,
  dateKey,
  DAY_COLUMN_HEIGHT,
  fromDateInput,
  HOUR_ROW_HEIGHT,
  MINUTES_PER_DAY,
  parseTimeHHMM,
  SEGMENT_SHOW_TIME_MIN_HEIGHT_PX,
} from "@/components/schedule/schedule-utils";
import {
  canManageBranchStaff,
  resolveWorkplaceBranchAccess,
} from "@/components/workplace/settings/workplace-settings-access";
import {
  DEFAULT_MEMBER_COLOR,
  useBranchMemberColors,
} from "@/components/workplace/use-branch-member-colors";
import { workApi } from "@/lib/api/work-api";
import { emitWorkplaceChanged } from "@/lib/constants/dom-event";
import { formatKoMonthDayNumeric } from "@/lib/date-format";
import { normalizePhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import type { BranchMemberListItem, PunchRecord, Shift } from "@/types/work";

const fieldClass =
  "w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500";

const timeInputClass =
  "min-h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 font-mono text-sm tabular-nums text-zinc-900 outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500";

type PunchEditModalProps = {
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

function PunchEditModal({
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

function splitPunchRecordToShifts(
  record: PunchRecord,
  rangeStart: Date,
  rangeEndExclusive: Date,
  nowIso: string,
): Shift[] {
  const start = new Date(record.checkedInAt);
  const end = new Date(record.checkedOutAt ?? nowIso);
  const segments: Shift[] = [];

  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEndExclusive.getTime();
  if (end.getTime() <= rangeStartMs || start.getTime() >= rangeEndMs) {
    return [];
  }

  let cursor = new Date(start);
  while (cursor.getTime() < end.getTime()) {
    const dayStart = new Date(cursor);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const segStartMs = Math.max(start.getTime(), dayStart.getTime(), rangeStartMs);
    const segEndMs = Math.min(end.getTime(), dayEnd.getTime(), rangeEndMs);
    if (segEndMs > segStartMs) {
      segments.push({
        id: `${record.id}:${dateKey(new Date(segStartMs))}`,
        employeeId: record.employeeId,
        employeePhone: record.employeePhone,
        employeeName: record.employeeName,
        branchId: record.branchId ?? null,
        startAt: new Date(segStartMs).toISOString(),
        endAt: new Date(segEndMs).toISOString(),
      });
    }
    cursor = dayEnd;
  }

  return segments;
}

type DaySegment = {
  shift: Shift;
  startMin: number;
  endMin: number;
  laneIndex: number;
  laneCount: number;
};

type PositionedShift = {
  shift: Shift;
  startMin: number;
  endMin: number;
};

function buildDaySegments(shifts: Shift[]): DaySegment[] {
  if (shifts.length === 0) {
    return [];
  }

  const positioned: PositionedShift[] = shifts
    .map((shift) => {
      const startAt = new Date(shift.startAt);
      const endAt = new Date(shift.endAt);
      const dayStart = new Date(startAt);
      dayStart.setHours(0, 0, 0, 0);
      const startMin = Math.max(0, Math.round((startAt.getTime() - dayStart.getTime()) / 60000));
      let endMinRounded = Math.round((endAt.getTime() - dayStart.getTime()) / 60000);
      if (endMinRounded <= startMin) {
        endMinRounded = startMin + 1;
      }
      const endMin = Math.min(MINUTES_PER_DAY, endMinRounded);
      return { shift, startMin, endMin };
    })
    .sort(
      (a, b) =>
        a.startMin - b.startMin || a.endMin - b.endMin || a.shift.id.localeCompare(b.shift.id),
    );
  const n = positioned.length;
  const visited = new Array<boolean>(n).fill(false);
  const rows: DaySegment[] = [];

  const overlaps = (a: PositionedShift, b: PositionedShift) =>
    a.startMin < b.endMin && b.startMin < a.endMin;

  for (let i = 0; i < n; i += 1) {
    if (visited[i]) {
      continue;
    }

    // "조금이라도 겹치면 같은 그룹"으로 묶는다.
    const queue = [i];
    const component: number[] = [];
    visited[i] = true;
    while (queue.length > 0) {
      const idx = queue.shift()!;
      component.push(idx);
      for (let j = 0; j < n; j += 1) {
        if (visited[j]) {
          continue;
        }
        if (overlaps(positioned[idx], positioned[j])) {
          visited[j] = true;
          queue.push(j);
        }
      }
    }

    const comp = component
      .map((idx) => positioned[idx])
      .sort(
        (a, b) =>
          a.startMin - b.startMin || a.endMin - b.endMin || a.shift.id.localeCompare(b.shift.id),
      );

    // interval partition: 겹치지 않는 lane에 배치
    const laneEndMins: number[] = [];
    const assigned: Array<{ item: PositionedShift; laneIndex: number }> = [];
    for (const item of comp) {
      let laneIndex = laneEndMins.findIndex((endMin) => endMin <= item.startMin);
      if (laneIndex === -1) {
        laneIndex = laneEndMins.length;
        laneEndMins.push(item.endMin);
      } else {
        laneEndMins[laneIndex] = item.endMin;
      }
      assigned.push({ item, laneIndex });
    }
    const laneCount = Math.max(1, laneEndMins.length);

    for (const { item, laneIndex } of assigned) {
      rows.push({
        shift: item.shift,
        startMin: item.startMin,
        endMin: item.endMin,
        laneIndex,
        laneCount,
      });
    }
  }

  return rows;
}

export function ActualWeeklyWorkGridSection({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const { data, refresh: refreshDashboard } = useDashboardData({ pollMs: null });
  const nowIso = new Date().toISOString();
  const session = data?.session ?? null;
  const branches = data?.branches ?? [];
  const myBranches = data?.myBranches ?? [];
  const myMemberships = data?.myBranchMemberships ?? [];
  const punchRecords = useMemo(() => data?.punchRecords ?? [], [data?.punchRecords]);

  const rangeStart = useMemo(() => fromDateInput(startDate), [startDate]);
  const rangeEnd = useMemo(() => fromDateInput(endDate), [endDate]);
  const rangeEndExclusive = useMemo(() => {
    if (!rangeEnd) {
      return null;
    }
    return addDays(rangeEnd, 1);
  }, [rangeEnd]);
  const invalidRange = !rangeStart || !rangeEnd || rangeStart.getTime() > rangeEnd.getTime();

  const currentBranchId = session?.currentBranchId ?? myBranches[0]?.id ?? null;
  const actorPhone = session?.phone ?? null;
  const { colorByPhone } = useBranchMemberColors({
    branchId: currentBranchId,
    actorPhone,
  });
  const currentBranch = currentBranchId
    ? (branches.find((b) => b.id === currentBranchId) ?? null)
    : null;
  const access =
    currentBranch && session
      ? resolveWorkplaceBranchAccess(currentBranch, session, myMemberships)
      : null;
  const canEdit = access ? canManageBranchStaff(access) : false;

  const rangeDays = useMemo(() => {
    if (!rangeStart || !rangeEnd || invalidRange) {
      return [] as Date[];
    }
    const days: Date[] = [];
    const cursor = new Date(rangeStart);
    while (cursor.getTime() <= rangeEnd.getTime()) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [rangeStart, rangeEnd, invalidRange]);

  const punches = useMemo(() => {
    const list = punchRecords;
    if (!currentBranchId) {
      return [];
    }
    return list.filter((row) => (row.branchId ?? null) === currentBranchId);
  }, [punchRecords, currentBranchId]);

  const segmentShifts = useMemo(
    () =>
      !rangeStart || !rangeEndExclusive || invalidRange
        ? []
        : punches.flatMap((p) =>
            splitPunchRecordToShifts(p, rangeStart, rangeEndExclusive, nowIso),
          ),
    [punches, rangeStart, rangeEndExclusive, nowIso, invalidRange],
  );

  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of segmentShifts) {
      const key = dateKey(new Date(shift.startAt));
      const current = map.get(key) ?? [];
      current.push(shift);
      map.set(key, current);
    }
    return map;
  }, [segmentShifts]);

  const peopleByPhone = useMemo(() => {
    const map = new Map<string, SchedulePerson>();
    for (const shift of segmentShifts) {
      const raw = shift.employeePhone;
      const phoneKey = normalizePhone(raw) || raw;
      if (map.has(phoneKey)) {
        continue;
      }
      const hex = colorByPhone?.get(phoneKey) ?? DEFAULT_MEMBER_COLOR;
      map.set(phoneKey, {
        id: shift.employeeId,
        name: shift.employeeName,
        employeePhone: raw,
        color: hex,
      });
    }
    return map;
  }, [segmentShifts, colorByPhone]);

  const [editing, setEditing] = useState<PunchRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [members, setMembers] = useState<BranchMemberListItem[]>([]);
  const scheduleGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    if (!currentBranchId || !actorPhone || !canEdit) {
      return () => {
        mounted = false;
      };
    }
    void (async () => {
      const list = await workApi.listBranchMembers(currentBranchId, actorPhone);
      if (!mounted) {
        return;
      }
      setMembers(list);
    })();
    return () => {
      mounted = false;
    };
  }, [actorPhone, canEdit, currentBranchId]);

  const handleShiftClick = (shift: Shift) => {
    if (!canEdit) {
      return;
    }
    const recordId = shift.id.split(":")[0];
    const record = punches.find((p) => p.id === recordId) ?? null;
    setEditing(record);
  };

  const save = async (next: { checkedInAt: string; checkedOutAt: string | null }) => {
    if (!editing || !actorPhone) {
      return;
    }
    setSaving(true);
    try {
      const ok = await workApi.updatePunchRecord(editing.id, next, actorPhone);
      if (!ok) {
        toast.error("근무 시간을 수정하지 못했습니다. 권한을 확인해 주세요.");
        return;
      }
      toast.success("근무 시간을 수정했습니다.");
      setEditing(null);
      emitWorkplaceChanged();
      await refreshDashboard();
    } finally {
      setSaving(false);
    }
  };

  const create = async (input: Omit<PunchRecord, "id" | "branchId">) => {
    if (!actorPhone || !currentBranchId) {
      return;
    }
    setSaving(true);
    try {
      const created = await workApi.createPunchRecord(
        { ...input, branchId: currentBranchId },
        actorPhone,
      );
      if (!created) {
        toast.error("실제 근무를 추가하지 못했습니다. 권한을 확인해 주세요.");
        return;
      }
      toast.success("실제 근무를 추가했습니다.");
      setCreating(false);
      emitWorkplaceChanged();
      await refreshDashboard();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing || !actorPhone) {
      return;
    }
    setDeleting(true);
    try {
      const ok = await workApi.deletePunchRecord(editing.id, actorPhone);
      if (!ok) {
        toast.error("실제 근무를 삭제하지 못했습니다. 권한을 확인해 주세요.");
        return;
      }
      toast.success("실제 근무를 삭제했습니다.");
      setEditing(null);
      emitWorkplaceChanged();
      await refreshDashboard();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <section className="space-y-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
        {!data ? (
          <p className="text-sm text-zinc-600 dark:text-neutral-400">
            실제 근무 그리드를 불러오는 중...
          </p>
        ) : null}
        <div className="flex items-center justify-between">
          {canEdit ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-lg border border-zinc-300/90 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-white/20 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10"
            >
              근무 추가
            </button>
          ) : null}
        </div>
        {invalidRange ? (
          <p className="text-sm text-zinc-600 dark:text-neutral-400">
            기간이 올바르지 않습니다. 시작일이 종료일보다 늦을 수 없습니다.
          </p>
        ) : (
          <div
            className="overflow-x-auto border border-zinc-200/90 dark:border-white/10"
            ref={scheduleGridRef}
          >
            <div className="relative min-w-[760px]">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `3rem repeat(${Math.max(1, rangeDays.length)}, minmax(120px, 1fr))`,
                }}
              >
                <div className="border-b border-r border-zinc-200/90 bg-zinc-100/80 px-1.5 py-1.5 text-[11px] text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
                  시간
                </div>
                {rangeDays.map((day) => (
                  <div
                    key={dateKey(day)}
                    className="border-b border-r border-zinc-200/90 bg-zinc-100/80 px-1.5 py-1.5 text-[11px] text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200"
                  >
                    {["일", "월", "화", "수", "목", "금", "토"][day.getDay()]}{" "}
                    {formatKoMonthDayNumeric(day)}
                  </div>
                ))}

                <div
                  className="relative border-r border-zinc-200/90 dark:border-white/10"
                  style={{ height: `${DAY_COLUMN_HEIGHT}px` }}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div
                      key={`label-${hour}`}
                      className="absolute left-0 right-0 border-t border-zinc-200/80 px-1.5 text-[10px] text-zinc-500 dark:border-white/10 dark:text-neutral-500"
                      style={{ top: `${hour * HOUR_ROW_HEIGHT}px` }}
                    >
                      {`${String(hour).padStart(2, "0")}:00`}
                    </div>
                  ))}
                </div>

                {rangeDays.map((day) => {
                  const key = dateKey(day);
                  const dayRows = buildDaySegments(shiftMap.get(key) ?? []);
                  return (
                    <div
                      key={key}
                      className="relative border-r border-zinc-200/90 dark:border-white/10"
                      style={{ height: `${DAY_COLUMN_HEIGHT}px` }}
                    >
                      {Array.from({ length: 24 }, (_, hour) => (
                        <div
                          key={`${key}-line-${hour}`}
                          className="absolute left-0 right-0 border-t border-zinc-200/80 dark:border-white/10"
                          style={{ top: `${hour * HOUR_ROW_HEIGHT}px` }}
                        />
                      ))}
                      {dayRows.map((row) => {
                        const top = (row.startMin / MINUTES_PER_DAY) * DAY_COLUMN_HEIGHT;
                        const rawHeight =
                          ((row.endMin - row.startMin) / MINUTES_PER_DAY) * DAY_COLUMN_HEIGHT;
                        const height = Math.max(18, rawHeight);
                        const showTimeRange = height >= SEGMENT_SHOW_TIME_MIN_HEIGHT_PX;
                        const laneWidth = 100 / Math.max(1, row.laneCount);
                        const left = laneWidth * row.laneIndex;
                        const phoneKey =
                          normalizePhone(row.shift.employeePhone) || row.shift.employeePhone;
                        const person = peopleByPhone.get(phoneKey);
                        const chipColor = person?.color ?? DEFAULT_MEMBER_COLOR;
                        const timeLabel = `${hhmm(row.shift.startAt)}-${hhmm(row.shift.endAt)}`;
                        return (
                          <div
                            key={`${row.shift.id}:${row.startMin}`}
                            className={`absolute cursor-pointer rounded-md border px-1 text-[10px] font-medium leading-tight hover:ring-1 hover:ring-zinc-400/50 dark:hover:ring-white/40 ${
                              showTimeRange ? "py-1" : "overflow-hidden py-0.5"
                            }`}
                            style={{
                              top: `${top}px`,
                              left: `calc(${left}% + 2px)`,
                              width: `calc(${laneWidth}% - 4px)`,
                              height: `${height}px`,
                              borderColor: `${chipColor}aa`,
                              backgroundColor: `${chipColor}40`,
                            }}
                            onClick={() => handleShiftClick(row.shift)}
                            title={`${row.shift.employeeName} · ${timeLabel}`}
                          >
                            <div className={showTimeRange ? undefined : "truncate"}>
                              {row.shift.employeeName}
                            </div>
                            {showTimeRange ? (
                              <div className="truncate text-[11px] text-zinc-800/90 dark:text-neutral-200/90">
                                {timeLabel}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      <PunchEditModal
        key={editing?.id ?? "none"}
        mode="edit"
        open={Boolean(editing)}
        saving={saving}
        deleting={deleting}
        record={editing}
        canEdit={canEdit}
        members={members}
        onClose={() => setEditing(null)}
        onSave={save}
        onCreate={create}
        onDelete={remove}
      />

      <PunchEditModal
        key={creating ? "create-open" : "create-close"}
        mode="create"
        open={creating}
        saving={saving}
        deleting={false}
        record={null}
        canEdit={canEdit}
        members={members}
        onClose={() => setCreating(false)}
        onSave={save}
        onCreate={create}
        onDelete={() => {}}
      />
    </>
  );
}
