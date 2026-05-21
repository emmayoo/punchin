"use client";

import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DetailPageShell } from "@/components/layout/detail-page-shell";
import { ConfirmDialog } from "@/components/overlay/confirm-dialog";
import { ScheduleDownloadButton } from "@/components/schedule/schedule-download-button";
import {
  CopyScheduleModal,
  ShiftEditModal,
  WeekPickerModal,
} from "@/components/schedule/schedule-modals";
import { ScheduleSlotForm } from "@/components/schedule/schedule-slot-form";
import { SchedulePerson } from "@/components/schedule/schedule-types";
import {
  addDays,
  collectOverlappingShiftIdsForProposals,
  dateKey,
  filterShiftsStartingInWeek,
  fromDateInput,
  parseTimeHHMM,
  shiftRowToCreatePayload,
  startOfWeek,
  toMinutes,
  WEEKDAY_LABELS,
  weekLabel,
} from "@/components/schedule/schedule-utils";
import { ScheduleWeekGrid } from "@/components/schedule/schedule-week-grid";
import { useScheduleImageDownload } from "@/components/schedule/use-schedule-image-download";
import { workApi } from "@/lib/api/work-api";
import { branchMemberName } from "@/lib/branch-display-name";
import { normalizePhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import { Shift } from "@/types/work";

const UNDO_TOAST_DURATION_MS = 12_000;

function formatDurationKo(totalMs: number): string {
  const totalMin = Math.max(0, Math.round(totalMs / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) {
    return `${m}분`;
  }
  if (m === 0) {
    return `${h}시간`;
  }
  return `${h}시간 ${m}분`;
}

type SlotBatchUndo = {
  createdShiftIds: string[];
  restorePayloads: Omit<Shift, "id">[];
};

export function ScheduleClient() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [people, setPeople] = useState<SchedulePerson[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => dateKey(new Date()));
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyTargetDate, setCopyTargetDate] = useState(() =>
    dateKey(addDays(startOfWeek(new Date()), 7)),
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copying, setCopying] = useState(false);
  const [shiftEditOpen, setShiftEditOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState(() => dateKey(new Date()));
  const [editStartTime, setEditStartTime] = useState("09:00");
  const [editEndTime, setEditEndTime] = useState("13:00");
  const [editPersonId, setEditPersonId] = useState("");
  const [editingShiftBusy, setEditingShiftBusy] = useState(false);
  const [overlapConfirmOpen, setOverlapConfirmOpen] = useState(false);
  const [overwriteBusy, setOverwriteBusy] = useState(false);
  const [pendingSlotCreate, setPendingSlotCreate] = useState<{
    payloads: Omit<Shift, "id">[];
    conflictingIds: string[];
    dayIndexes: number[];
    personName: string;
  } | null>(null);
  const slotUndoRef = useRef<SlotBatchUndo | null>(null);
  const scheduleGridRef = useRef<HTMLDivElement>(null);
  const { exportingImage, downloadScheduleImage } = useScheduleImageDownload({
    targetRef: scheduleGridRef,
    fileName: `스케줄_${dateKey(weekStart)}.png`,
  });

  const loadSchedule = async () => {
    const list = await workApi.getSchedule();
    setShifts(list);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [scheduleList, peopleList] = await Promise.all([
        workApi.getSchedule(),
        workApi.getSchedulePeople(),
      ]);
      if (!mounted) {
        return;
      }
      setShifts(scheduleList);
      const mapped: SchedulePerson[] = peopleList.map((item) => ({
        id: item.id,
        name: item.name,
        nickname: item.nickname,
        employeePhone: item.employeePhone,
        color: item.color,
      }));
      setPeople(mapped);
      if (mapped.length > 0) {
        setSelectedPersonId((prev) => (prev ? prev : mapped[0].id));
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const weekDays = useMemo(
    () =>
      WEEKDAY_LABELS.map((label, idx) => ({
        label,
        date: addDays(weekStart, idx),
      })),
    [weekStart],
  );

  const weekShifts = useMemo(
    () => filterShiftsStartingInWeek(shifts, weekStart),
    [shifts, weekStart],
  );

  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of weekShifts) {
      const start = new Date(shift.startAt);
      const end = new Date(shift.endAt);
      const key = dateKey(start);
      const current = map.get(key) ?? [];
      current.push({
        ...shift,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });
      map.set(key, current);
    }
    return map;
  }, [weekShifts]);

  const peopleByPhone = useMemo(() => {
    const map = new Map<string, SchedulePerson>();
    for (const person of people) {
      map.set(person.employeePhone, person);
    }
    return map;
  }, [people]);

  const weekHoursSummary = useMemo(() => {
    const byPhone = new Map<string, { totalMs: number }>();
    for (const shift of weekShifts) {
      const key = normalizePhone(shift.employeePhone) || shift.employeePhone;
      const start = new Date(shift.startAt).getTime();
      const end = new Date(shift.endAt).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        continue;
      }
      const prev = byPhone.get(key)?.totalMs ?? 0;
      byPhone.set(key, { totalMs: prev + (end - start) });
    }
    if (byPhone.size === 0) {
      return [];
    }
    const rows: { key: string; label: string; totalMs: number }[] = [];
    for (const person of people) {
      const key = normalizePhone(person.employeePhone) || person.employeePhone;
      const entry = byPhone.get(key);
      if (!entry || entry.totalMs <= 0) {
        continue;
      }
      rows.push({
        key,
        label: branchMemberName(person.nickname, person.name),
        totalMs: entry.totalMs,
      });
      byPhone.delete(key);
    }
    for (const [key, { totalMs }] of byPhone) {
      if (totalMs <= 0) {
        continue;
      }
      const sample = weekShifts.find(
        (s) => (normalizePhone(s.employeePhone) || s.employeePhone) === key,
      );
      rows.push({ key, label: sample?.employeeName ?? "직원", totalMs });
    }
    rows.sort((a, b) => b.totalMs - a.totalMs || a.label.localeCompare(b.label, "ko"));
    return rows;
  }, [weekShifts, people]);

  const toHHMM = (value: string): string => {
    const date = new Date(value);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  const toggleWeekday = (idx: number) => {
    setSelectedWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return [...next].sort((a, b) => a - b);
    });
  };

  const buildSlotPayloads = (person: SchedulePerson, dayIndexes: number[]): Omit<Shift, "id">[] => {
    const startClock = parseTimeHHMM(startTime);
    const endClock = parseTimeHHMM(endTime);
    return dayIndexes.map((weekday) => {
      const base = addDays(weekStart, weekday);
      const start = new Date(base);
      const end = new Date(base);
      start.setHours(startClock.hour, startClock.minute, 0, 0);
      // 종료가 `00:00`이면 "다음날 00:00" (즉 24:00)으로 해석한다.
      // 예: 23:00 - 00:00 => 23:00 - (다음날) 00:00
      const resolvedEndHour = endTime === "00:00" && startTime !== "00:00" ? 24 : endClock.hour;
      end.setHours(resolvedEndHour, endClock.minute, 0, 0);
      return {
        employeeId: person.id,
        employeeName: branchMemberName(person.nickname, person.name),
        employeePhone: person.employeePhone,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      };
    });
  };

  const slotCreateToastLabel = (dayIndexes: number[]) =>
    dayIndexes.map((i) => WEEKDAY_LABELS[i]).join(", ");

  const effectiveEndMinutes = (startHHMM: string, endHHMM: string): number => {
    if (endHHMM === "00:00" && startHHMM !== "00:00") {
      return 24 * 60;
    }
    return toMinutes(endHHMM);
  };

  const performSlotUndo = async () => {
    const entry = slotUndoRef.current;
    if (!entry) {
      return;
    }
    const hasWork = entry.createdShiftIds.length > 0 || entry.restorePayloads.length > 0;
    if (!hasWork) {
      slotUndoRef.current = null;
      return;
    }
    slotUndoRef.current = null;
    setBusy(true);
    try {
      await Promise.all(entry.createdShiftIds.map((id) => workApi.deleteShift(id)));
      if (entry.restorePayloads.length > 0) {
        await workApi.createShifts(entry.restorePayloads);
      }
      await loadSchedule();
      toast.success("실행 취소했습니다.");
    } catch {
      toast.error("실행 취소하지 못했습니다.");
      await loadSchedule();
    } finally {
      setBusy(false);
    }
  };

  const finalizeSlotBatch = async (
    payloads: Omit<Shift, "id">[],
    dayIndexes: number[],
    personName: string,
    restoreDeletedPayloads: Omit<Shift, "id">[],
  ) => {
    if (payloads.length === 0) {
      return;
    }
    toast.dismiss();
    slotUndoRef.current = null;
    const createdShiftIds = await workApi.createShifts(payloads);
    const listAfter = await workApi.getSchedule();
    setShifts(listAfter);
    slotUndoRef.current = {
      createdShiftIds,
      restorePayloads: restoreDeletedPayloads,
    };
    toast.success(
      `${slotCreateToastLabel(dayIndexes)} · ${startTime}-${endTime} · ${personName} 스케줄을 추가했습니다.`,
      {
        duration: UNDO_TOAST_DURATION_MS,
        action: {
          label: "실행 취소",
          onClick: () => void performSlotUndo(),
        },
      },
    );
  };

  const createSlot = async () => {
    const person = people.find((item) => item.id === selectedPersonId);
    if (!person) {
      toast.error("담당자를 선택해주세요.");
      return;
    }
    if (selectedWeekdays.length === 0) {
      toast.error("요일을 하나 이상 선택해 주세요.");
      return;
    }
    if (effectiveEndMinutes(startTime, endTime) <= toMinutes(startTime)) {
      toast.error("종료 시간이 시작 시간보다 늦어야 합니다.");
      return;
    }

    const dayIndexes = [...selectedWeekdays].sort((a, b) => a - b);
    const payloads = buildSlotPayloads(person, dayIndexes);
    const conflictingIds = collectOverlappingShiftIdsForProposals(payloads, weekShifts, person);

    if (conflictingIds.length > 0) {
      setPendingSlotCreate({
        payloads,
        conflictingIds,
        dayIndexes,
        personName: branchMemberName(person.nickname, person.name),
      });
      setOverlapConfirmOpen(true);
      return;
    }

    setBusy(true);
    try {
      await finalizeSlotBatch(
        payloads,
        dayIndexes,
        branchMemberName(person.nickname, person.name),
        [],
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmOverwriteOverlappingSlots = async () => {
    if (!pendingSlotCreate) {
      return;
    }
    const { payloads, conflictingIds, dayIndexes, personName } = pendingSlotCreate;
    const restoreDeletedPayloads = conflictingIds
      .map((id) => shifts.find((row) => row.id === id))
      .filter((row): row is Shift => Boolean(row))
      .map((row) => shiftRowToCreatePayload(row));
    setOverwriteBusy(true);
    try {
      await Promise.all(conflictingIds.map((id) => workApi.deleteShift(id)));
      await finalizeSlotBatch(payloads, dayIndexes, personName, restoreDeletedPayloads);
      setOverlapConfirmOpen(false);
      setPendingSlotCreate(null);
    } finally {
      setOverwriteBusy(false);
    }
  };

  const cancelOverwriteOverlappingSlots = () => {
    setOverlapConfirmOpen(false);
    setPendingSlotCreate(null);
  };

  const applyWeekPicker = () => {
    const parsed = fromDateInput(pickerDate);
    if (!parsed) {
      toast.error("날짜를 선택해주세요.");
      return;
    }
    setWeekStart(startOfWeek(parsed));
    setWeekPickerOpen(false);
  };

  const nextWeekStartDate = useMemo(() => addDays(startOfWeek(new Date()), 7), []);
  const minCopyDate = useMemo(() => dateKey(nextWeekStartDate), [nextWeekStartDate]);

  const openCopyModal = () => {
    setCopyTargetDate(minCopyDate);
    setCopyModalOpen(true);
  };

  const copyCurrentWeekToTarget = async () => {
    const parsed = fromDateInput(copyTargetDate);
    if (!parsed) {
      toast.error("복사할 주를 선택해주세요.");
      return;
    }

    const targetWeekStart = startOfWeek(parsed);
    if (targetWeekStart.getTime() < nextWeekStartDate.getTime()) {
      toast.error("오늘 기준 다음 주부터 선택할 수 있습니다.");
      return;
    }

    if (weekShifts.length === 0) {
      toast.error("복사할 스케줄이 없습니다.");
      return;
    }

    const deltaMs = targetWeekStart.getTime() - weekStart.getTime();
    const payload = weekShifts.map((shift) => {
      const startAt = new Date(new Date(shift.startAt).getTime() + deltaMs).toISOString();
      const endAt = new Date(new Date(shift.endAt).getTime() + deltaMs).toISOString();
      return {
        employeeId: shift.employeeId,
        employeeName: shift.employeeName,
        employeePhone: shift.employeePhone,
        branchId: shift.branchId ?? null,
        startAt,
        endAt,
      };
    });

    setCopying(true);
    await workApi.createShifts(payload);
    await loadSchedule();
    setCopying(false);
    setCopyModalOpen(false);
    toast.success(`${weekLabel(weekStart)} 스케줄을 ${weekLabel(targetWeekStart)}로 복사했습니다.`);
  };

  const openShiftEditModal = (shift: Shift) => {
    const person =
      people.find((item) => item.id === shift.employeeId) ??
      people.find((item) => item.employeePhone === shift.employeePhone);
    setEditingShiftId(shift.id);
    setEditDate(dateKey(new Date(shift.startAt)));
    setEditStartTime(toHHMM(shift.startAt));
    setEditEndTime(toHHMM(shift.endAt));
    setEditPersonId(person?.id ?? people[0]?.id ?? "");
    setShiftEditOpen(true);
  };

  const saveEditedShift = async () => {
    if (!editingShiftId) {
      return;
    }
    const targetShift = shifts.find((shift) => shift.id === editingShiftId) ?? null;
    const person = people.find((item) => item.id === editPersonId);
    if (!person) {
      toast.error("담당자를 선택해주세요.");
      return;
    }
    if (effectiveEndMinutes(editStartTime, editEndTime) <= toMinutes(editStartTime)) {
      toast.error("종료 시간이 시작 시간보다 늦어야 합니다.");
      return;
    }
    const baseDate = fromDateInput(editDate);
    if (!baseDate) {
      toast.error("날짜를 선택해주세요.");
      return;
    }

    const startClock = parseTimeHHMM(editStartTime);
    const endClock = parseTimeHHMM(editEndTime);
    const startAt = new Date(baseDate);
    startAt.setHours(startClock.hour, startClock.minute, 0, 0);
    const endAt = new Date(baseDate);
    const resolvedEndHour =
      editEndTime === "00:00" && editStartTime !== "00:00" ? 24 : endClock.hour;
    endAt.setHours(resolvedEndHour, endClock.minute, 0, 0);

    setEditingShiftBusy(true);
    await workApi.updateShift(editingShiftId, {
      employeeId: person.id,
      employeeName: branchMemberName(person.nickname, person.name),
      employeePhone: person.employeePhone,
      branchId: targetShift?.branchId ?? null,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    });
    await loadSchedule();
    setEditingShiftBusy(false);
    setShiftEditOpen(false);
    toast.success("스케줄을 수정했습니다.");
  };

  const deleteEditingShift = async () => {
    if (!editingShiftId) {
      return;
    }
    setEditingShiftBusy(true);
    await workApi.deleteShift(editingShiftId);
    await loadSchedule();
    setEditingShiftBusy(false);
    setShiftEditOpen(false);
    toast.success("스케줄을 삭제했습니다.");
  };

  return (
    <DetailPageShell
      backHref="/workplace"
      title="스케줄 관리"
      loading={loading}
      className="gap-6"
      contentClassName="gap-6"
    >
      <section className="space-y-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-[90px]">
            <button
              type="button"
              onClick={() => setWeekStart((prev) => addDays(prev, -7))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300/90 text-zinc-700 dark:border-white/20 dark:text-neutral-200"
              aria-label="이전 주"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setPickerDate(dateKey(weekStart));
              setWeekPickerOpen(true);
            }}
            className="rounded-lg px-2 py-1 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200/60 dark:text-white dark:hover:bg-white/10"
            aria-label="주 선택 열기"
          >
            {weekLabel(weekStart)}
          </button>
          <div className="flex flex-wrap items-center justify-center gap-2 min-w-[90px]">
            <button
              type="button"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="rounded-lg border border-rose-400/50 px-2 py-1 text-xs text-rose-700 dark:border-rose-300/50 dark:text-rose-200"
            >
              이번주
            </button>
            <button
              type="button"
              onClick={() => setWeekStart((prev) => addDays(prev, 7))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300/90 text-zinc-700 dark:border-white/20 dark:text-neutral-200"
              aria-label="다음 주"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <ScheduleWeekGrid
          weekDays={weekDays}
          shiftMap={shiftMap}
          peopleByPhone={peopleByPhone}
          scheduleGridRef={scheduleGridRef}
          onShiftClick={openShiftEditModal}
        />
        <div>
          <ScheduleDownloadButton
            onClick={downloadScheduleImage}
            busy={exportingImage}
            ariaLabel={`${weekLabel(weekStart)} 주간 스케줄 다운로드`}
          />
          <button
            type="button"
            onClick={openCopyModal}
            className="ml-2 inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-300/90 bg-zinc-200/50 px-2 text-xs text-zinc-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-zinc-300/50 dark:border-white/20 dark:bg-black/50 dark:text-neutral-200 dark:hover:bg-white/10"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            스케줄 복사
          </button>
        </div>
      </section>

      <ScheduleSlotForm
        selectedWeekdays={selectedWeekdays}
        startTime={startTime}
        endTime={endTime}
        selectedPersonId={selectedPersonId}
        people={people}
        busy={busy || overwriteBusy || overlapConfirmOpen}
        onToggleWeekday={toggleWeekday}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
        onSelectedPersonChange={setSelectedPersonId}
        onCreateSlot={() => void createSlot()}
      />

      {weekHoursSummary.length > 0 ? (
        <div
          className="flex flex-wrap justify-center gap-2 px-1 text-[11px] leading-snug"
          aria-label="이번 주 직원별 근무 시간 요약"
        >
          {weekHoursSummary.map((row) => (
            <span
              key={row.key}
              className="inline-flex max-w-full items-baseline gap-1 rounded-md bg-zinc-100/80 px-2 py-1 text-zinc-600 dark:bg-white/6 dark:text-neutral-400"
            >
              <span className="min-w-0 truncate font-medium text-zinc-900 dark:text-neutral-100">
                {row.label}
              </span>
              <span className="shrink-0 tabular-nums text-zinc-500 dark:text-neutral-500">
                {formatDurationKo(row.totalMs)}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      <ConfirmDialog
        open={overlapConfirmOpen}
        title="스케줄이 겹칩니다"
        description={
          pendingSlotCreate
            ? `겹치는 기존 일정 ${pendingSlotCreate.conflictingIds.length}건을 삭제한 뒤 새 일정을 넣습니다. 기존꺼는 삭제하고 덮어쓰겠습니까?`
            : "기존꺼는 삭제하고 덮어쓰겠습니까?"
        }
        confirmText="덮어쓰기"
        cancelText="취소"
        tone="danger"
        busy={overwriteBusy}
        onConfirm={() => void confirmOverwriteOverlappingSlots()}
        onCancel={cancelOverwriteOverlappingSlots}
      />

      <WeekPickerModal
        open={weekPickerOpen}
        pickerDate={pickerDate}
        onPickerDateChange={setPickerDate}
        onClose={() => setWeekPickerOpen(false)}
        onApply={applyWeekPicker}
      />

      <CopyScheduleModal
        open={copyModalOpen}
        targetDate={copyTargetDate}
        minDate={minCopyDate}
        copying={copying}
        onTargetDateChange={setCopyTargetDate}
        onClose={() => setCopyModalOpen(false)}
        onCopy={copyCurrentWeekToTarget}
      />

      <ShiftEditModal
        open={shiftEditOpen}
        people={people}
        date={editDate}
        startTime={editStartTime}
        endTime={editEndTime}
        personId={editPersonId}
        saving={editingShiftBusy}
        onDateChange={setEditDate}
        onStartTimeChange={setEditStartTime}
        onEndTimeChange={setEditEndTime}
        onPersonIdChange={setEditPersonId}
        onClose={() => setShiftEditOpen(false)}
        onSave={saveEditedShift}
        onDelete={deleteEditingShift}
      />
    </DetailPageShell>
  );
}
