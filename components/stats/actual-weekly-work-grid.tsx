"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { PunchEditModal } from "@/components/punch/punch-edit-modal";
import type { SchedulePerson } from "@/components/schedule/schedule-types";
import {
  addDays,
  dateKey,
  DAY_COLUMN_HEIGHT,
  fromDateInput,
  HOUR_ROW_HEIGHT,
  MINUTES_PER_DAY,
  SEGMENT_SHOW_TIME_MIN_HEIGHT_PX,
} from "@/components/schedule/schedule-utils";
import {
  canManageBranchStaff,
  resolveWorkplaceBranchAccess,
} from "@/components/workplace/settings/workplace-settings-access";
import { useBranchMemberColors } from "@/components/workplace/use-branch-member-colors";
import { workApi } from "@/lib/api/work-api";
import { DEFAULT_MEMBER_COLOR } from "@/lib/constants/color";
import { emitWorkplaceChanged } from "@/lib/constants/dom-event";
import { formatKoMonthDayNumeric } from "@/lib/date-format";
import { formatSegmentTimeRangeHHMM } from "@/lib/time";
import { normalizePhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import type { BranchMemberListItem, PunchRecord, Shift } from "@/types/work";

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
        nickname: null,
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
                        const timeLabel = formatSegmentTimeRangeHHMM(
                          row.shift.startAt,
                          row.shift.endAt,
                        );
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
