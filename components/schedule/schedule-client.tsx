"use client";

import { ChevronLeft, ChevronRight, Copy, ImageDown } from "lucide-react";
import { toPng } from "html-to-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { TabPageShell } from "@/components/layout/tab-page-shell";
import {
  CopyScheduleModal,
  ShiftEditModal,
  WeekPickerModal,
} from "@/components/schedule/schedule-modals";
import { SchedulePeopleManager } from "@/components/schedule/schedule-people-manager";
import { ScheduleSlotForm } from "@/components/schedule/schedule-slot-form";
import { ScheduleWeekGrid } from "@/components/schedule/schedule-week-grid";
import { SchedulePerson } from "@/components/schedule/schedule-types";
import {
  WEEKDAY_LABELS,
  addDays,
  dateKey,
  fromDateInput,
  parseTimeHHMM,
  startOfWeek,
  toMinutes,
  weekLabel,
} from "@/components/schedule/schedule-utils";
import { workApi } from "@/lib/api/work-api";
import { toast } from "@/lib/toast";
import { Shift } from "@/types/work";

export function ScheduleClient() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [people, setPeople] = useState<SchedulePerson[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [weekday, setWeekday] = useState(0);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonPhone, setNewPersonPhone] = useState("");
  const [newPersonColor, setNewPersonColor] = useState("#22c55e");
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => dateKey(new Date()));
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyTargetDate, setCopyTargetDate] = useState(() =>
    dateKey(addDays(startOfWeek(new Date()), 7)),
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const [copying, setCopying] = useState(false);
  const [shiftEditOpen, setShiftEditOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState(() => dateKey(new Date()));
  const [editStartTime, setEditStartTime] = useState("09:00");
  const [editEndTime, setEditEndTime] = useState("13:00");
  const [editPersonId, setEditPersonId] = useState("");
  const [editingShiftBusy, setEditingShiftBusy] = useState(false);
  const scheduleGridRef = useRef<HTMLDivElement>(null);

  const loadSchedule = async () => {
    const list = await workApi.getSchedule();
    setShifts(list);
  };
  const loadPeople = async () => {
    const list = await workApi.getSchedulePeople();
    const mapped: SchedulePerson[] = list.map((item) => ({
      id: item.id,
      name: item.name,
      employeePhone: item.employeePhone,
      color: item.color,
    }));
    setPeople(mapped);
    setSelectedPersonId((prev) =>
      prev && mapped.some((person) => person.id === prev)
        ? prev
        : (mapped[0]?.id ?? ""),
    );
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await workApi.init();
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

  const weekShifts = useMemo(() => {
    const nextWeek = addDays(weekStart, 7).getTime();
    const weekStartMs = weekStart.getTime();
    return shifts.filter((shift) => {
      const startMs = new Date(shift.startAt).getTime();
      return startMs >= weekStartMs && startMs < nextWeek;
    });
  }, [shifts, weekStart]);

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

  const toHHMM = (value: string): string => {
    const date = new Date(value);
    return `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes(),
    ).padStart(2, "0")}`;
  };

  const normalizePhone = (input: string): string =>
    input.replace(/\D/g, "").slice(0, 11);

  const createSlot = async () => {
    const person = people.find((item) => item.id === selectedPersonId);
    if (!person) {
      toast.error("담당자를 선택해주세요.");
      return;
    }
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      toast.error("종료 시간이 시작 시간보다 늦어야 합니다.");
      return;
    }

    const base = addDays(weekStart, weekday);
    const start = new Date(base);
    const end = new Date(base);
    const startClock = parseTimeHHMM(startTime);
    const endClock = parseTimeHHMM(endTime);
    // 스케줄은 1시간 단위만 허용한다.
    start.setHours(startClock.hour, 0, 0, 0);
    end.setHours(endClock.hour, 0, 0, 0);

    setBusy(true);
    await workApi.createShift({
      employeeName: person.name,
      employeePhone: person.employeePhone,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });
    await loadSchedule();
    toast.success(
      `${WEEKDAY_LABELS[weekday]} ${startTime}-${endTime} ${person.name} 스케줄을 추가했습니다.`,
    );
    setBusy(false);
  };

  const addPerson = async () => {
    if (!newPersonName.trim()) {
      toast.error("사람 이름을 입력해주세요.");
      return;
    }
    const phone = normalizePhone(newPersonPhone);
    if (phone.length < 10) {
      toast.error("핸드폰 번호를 정확히 입력해주세요.");
      return;
    }
    if (people.some((person) => person.employeePhone === phone)) {
      toast.error("이미 등록된 핸드폰 번호입니다.");
      return;
    }
    const created = await workApi.createSchedulePerson({
      name: newPersonName.trim(),
      employeePhone: phone,
      color: newPersonColor,
    });
    await loadPeople();
    setSelectedPersonId(created.id);
    setNewPersonName("");
    setNewPersonPhone("");
    toast.success(`${created.name} 직원을 추가했습니다.`);
  };

  const updatePerson = async (
    personId: string,
    payload: Pick<SchedulePerson, "name" | "employeePhone" | "color">,
  ) => {
    const name = payload.name.trim();
    if (!name) {
      toast.error("사람 이름을 입력해주세요.");
      return;
    }
    const phone = normalizePhone(payload.employeePhone);
    if (phone.length < 10) {
      toast.error("핸드폰 번호를 정확히 입력해주세요.");
      return;
    }
    const duplicated = people.some(
      (person) => person.id !== personId && person.employeePhone === phone,
    );
    if (duplicated) {
      toast.error("이미 등록된 핸드폰 번호입니다.");
      return;
    }
    await workApi.updateSchedulePerson(personId, {
      name,
      employeePhone: phone,
      color: payload.color,
    });
    await loadPeople();
    toast.success("직원 정보를 수정했습니다.");
  };

  const deletePerson = async (personId: string) => {
    if (people.length <= 1) {
      toast.error("직원은 최소 1명 이상 필요합니다.");
      return;
    }
    await workApi.deleteSchedulePerson(personId);
    await loadPeople();
    toast.success("직원을 삭제했습니다.");
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

  const nextWeekStartDate = useMemo(
    () => addDays(startOfWeek(new Date()), 7),
    [],
  );
  const minCopyDate = useMemo(
    () => dateKey(nextWeekStartDate),
    [nextWeekStartDate],
  );

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
      const startAt = new Date(
        new Date(shift.startAt).getTime() + deltaMs,
      ).toISOString();
      const endAt = new Date(
        new Date(shift.endAt).getTime() + deltaMs,
      ).toISOString();
      return {
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
    toast.success(
      `${weekLabel(weekStart)} 스케줄을 ${weekLabel(targetWeekStart)}로 복사했습니다.`,
    );
  };

  const openShiftEditModal = (shift: Shift) => {
    const person = people.find(
      (item) => item.employeePhone === shift.employeePhone,
    );
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
    if (toMinutes(editEndTime) <= toMinutes(editStartTime)) {
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
    startAt.setHours(startClock.hour, 0, 0, 0);
    const endAt = new Date(baseDate);
    endAt.setHours(endClock.hour, 0, 0, 0);

    setEditingShiftBusy(true);
    await workApi.updateShift(editingShiftId, {
      employeeName: person.name,
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

  const downloadScheduleImage = async () => {
    const el = scheduleGridRef.current;
    if (!el) {
      return;
    }
    setExportingImage(true);
    try {
      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: Math.min(
          2,
          typeof window !== "undefined" ? window.devicePixelRatio : 1,
        ),
        backgroundColor: "#0a0a0a",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `스케줄_${dateKey(weekStart)}.png`;
      a.click();
      toast.success("스케줄 이미지를 저장했습니다.");
    } catch {
      toast.error("이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setExportingImage(false);
    }
  };

  return (
    <TabPageShell title="스케줄" bodyClassName="gap-6" loading={loading}>
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
          <button
            type="button"
            onClick={downloadScheduleImage}
            disabled={exportingImage}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-300/90 bg-zinc-200/50 px-2 text-xs text-zinc-800 shadow-sm backdrop-blur-sm enabled:hover:bg-zinc-300/50 disabled:opacity-50 dark:border-white/20 dark:bg-black/50 dark:text-neutral-200 dark:enabled:hover:bg-white/10"
            aria-label={`${weekLabel(weekStart)} 주간 스케줄 다운로드`}
          >
            <ImageDown className="h-3.5 w-3.5" aria-hidden />
            {exportingImage ? "저장 중" : "스케줄 다운로드"}
          </button>
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
        weekday={weekday}
        startTime={startTime}
        endTime={endTime}
        selectedPersonId={selectedPersonId}
        people={people}
        busy={busy}
        onWeekdayChange={setWeekday}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
        onSelectedPersonChange={setSelectedPersonId}
        onCreateSlot={createSlot}
      />

      <SchedulePeopleManager
        people={people}
        newPersonName={newPersonName}
        newPersonPhone={newPersonPhone}
        newPersonColor={newPersonColor}
        onNameChange={setNewPersonName}
        onPhoneChange={setNewPersonPhone}
        onColorChange={setNewPersonColor}
        onAddPerson={addPerson}
        onUpdatePerson={updatePerson}
        onDeletePerson={deletePerson}
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
    </TabPageShell>
  );
}
