"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { DetailPageShell } from "@/components/layout/detail-page-shell";
import {
  HistoryDayPunchCreateModal,
  HistoryDayPunchEditModal,
} from "@/components/history/history-day-punch-modal";
import {
  canManageBranchStaff,
  resolveWorkplaceBranchAccess,
} from "@/components/workplace/settings/workplace-settings-access";
import { workApi } from "@/lib/api/work-api";
import { DEFAULT_EVENT_COLOR } from "@/lib/constants/event";
import { emitWorkplaceChanged } from "@/lib/constants/dom-event";
import { durationHours, formatDateTime, formatHours } from "@/lib/time";
import { toast } from "@/lib/toast";
import type { SchedulePerson } from "@/components/schedule/schedule-types";
import type { CalendarEvent, PunchRecord } from "@/types/work";

type HistoryDayDetailClientProps = {
  date: string;
};

function isSameDate(dateKey: string, iso: string): boolean {
  const d = new Date(iso);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return key === dateKey;
}

export function HistoryDayDetailClient({ date }: HistoryDayDetailClientProps) {
  const { data: dashData, loading: dashLoading, refresh: refreshDashboard } = useDashboardData({
    pollMs: null,
  });

  const [punches, setPunches] = useState<PunchRecord[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const saveTimersRef = useRef<Record<string, number>>({});
  const [newColor, setNewColor] = useState(DEFAULT_EVENT_COLOR);

  const [schedulePeople, setSchedulePeople] = useState<SchedulePerson[]>([]);
  const [createPunchOpen, setCreatePunchOpen] = useState(false);
  const [editingPunch, setEditingPunch] = useState<PunchRecord | null>(null);
  const [punchSaving, setPunchSaving] = useState(false);
  const [punchDeleting, setPunchDeleting] = useState(false);

  const load = useCallback(async () => {
    const [history, calendarEvents] = await Promise.all([
      workApi.getHistory(),
      workApi.getCalendarEvents(),
    ]);
    setPunches(history);
    setEvents(calendarEvents);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await workApi.init();
      await load();
      if (!mounted) {
        return;
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [date, load]);

  const currentBranchId = dashData?.session?.currentBranchId ?? null;

  const branch = useMemo(
    () => dashData?.branches.find((b) => b.id === currentBranchId) ?? null,
    [dashData?.branches, currentBranchId],
  );

  const access = useMemo(() => {
    if (!branch || !dashData?.session) {
      return null;
    }
    return resolveWorkplaceBranchAccess(branch, dashData.session, dashData.myBranchMemberships);
  }, [branch, dashData]);

  /** 매니저·오너(및 레거시 생성자)만 실제 근무 편집 — `canManageBranchStaff` */
  const canEditPunch = access ? canManageBranchStaff(access) : false;
  const actorPhone = dashData?.session?.phone ?? null;

  useEffect(() => {
    if (!canEditPunch || !currentBranchId) {
      queueMicrotask(() => {
        setSchedulePeople([]);
      });
      return () => {};
    }
    let mounted = true;
    void (async () => {
      const list = await workApi.getSchedulePeople();
      if (mounted) {
        setSchedulePeople(
          list.map((item) => ({
            id: item.id,
            name: item.name,
            nickname: item.nickname,
            employeePhone: item.employeePhone,
            color: item.color,
          })),
        );
      }
    })();
    return () => {
      mounted = false;
    };
  }, [canEditPunch, currentBranchId]);

  const dayPunches = useMemo(
    () => punches.filter((record) => isSameDate(date, record.checkedInAt)),
    [punches, date],
  );
  const dayEvents = useMemo(() => events.filter((event) => event.date === date), [events, date]);

  const handleCreate = async () => {
    setBusy(true);
    await workApi.createCalendarEvent({
      date,
      title: "새 이벤트",
      color: newColor,
      branchId: currentBranchId,
    });
    setNewColor(DEFAULT_EVENT_COLOR);
    await load();
    setBusy(false);
  };

  const handleDelete = async (eventId: string) => {
    setBusy(true);
    await workApi.deleteCalendarEvent(eventId);
    const timerId = saveTimersRef.current[eventId];
    if (timerId) {
      window.clearTimeout(timerId);
      delete saveTimersRef.current[eventId];
    }
    await load();
    setBusy(false);
  };

  const scheduleEventSave = (
    eventId: string,
    payload: Partial<Pick<CalendarEvent, "title" | "color" | "branchId">>,
  ) => {
    const prevTimer = saveTimersRef.current[eventId];
    if (prevTimer) {
      window.clearTimeout(prevTimer);
    }
    saveTimersRef.current[eventId] = window.setTimeout(() => {
      void workApi.updateCalendarEvent(eventId, payload).then(() => {
        void load();
      });
      delete saveTimersRef.current[eventId];
    }, 450);
  };

  const handleTitleChange = (eventId: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    scheduleEventSave(eventId, { title: trimmed });
  };

  const handleColorChange = (eventId: string, color: string) => {
    scheduleEventSave(eventId, { color });
  };

  const savePunch = async (next: { checkedInAt: string; checkedOutAt: string | null }) => {
    if (!editingPunch || !actorPhone) {
      return;
    }
    setPunchSaving(true);
    try {
      const ok = await workApi.updatePunchRecord(editingPunch.id, next, actorPhone);
      if (!ok) {
        toast.error("근무 시간을 수정하지 못했습니다. 권한을 확인해 주세요.");
        return;
      }
      toast.success("근무 시간을 수정했습니다.");
      setEditingPunch(null);
      emitWorkplaceChanged();
      await load();
      await refreshDashboard();
    } finally {
      setPunchSaving(false);
    }
  };

  const createPunch = async (input: Omit<PunchRecord, "id" | "branchId">) => {
    if (!actorPhone || !currentBranchId) {
      return;
    }
    setPunchSaving(true);
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
      setCreatePunchOpen(false);
      emitWorkplaceChanged();
      await load();
      await refreshDashboard();
    } finally {
      setPunchSaving(false);
    }
  };

  const deletePunch = async () => {
    if (!editingPunch || !actorPhone) {
      return;
    }
    setPunchDeleting(true);
    try {
      const ok = await workApi.deletePunchRecord(editingPunch.id, actorPhone);
      if (!ok) {
        toast.error("실제 근무를 삭제하지 못했습니다. 권한을 확인해 주세요.");
        return;
      }
      toast.success("실제 근무를 삭제했습니다.");
      setEditingPunch(null);
      emitWorkplaceChanged();
      await load();
      await refreshDashboard();
    } finally {
      setPunchDeleting(false);
    }
  };

  const pageLoading = loading || dashLoading;

  return (
    <DetailPageShell
      backHref="/workplace/history"
      title={`${date} 근무 상세`}
      aria-label={`${date} 일자 상세`}
      loading={pageLoading}
    >
      <section className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-white">이벤트</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={busy}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300/90 text-lg text-zinc-800 disabled:opacity-60 dark:border-white/20 dark:text-neutral-100"
              aria-label="이벤트 추가"
            >
              +
            </button>
          </div>
        </div>
        {dayEvents.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-neutral-400">
            등록된 이벤트가 없습니다.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {dayEvents.map((event) => (
              <li key={event.id}>
                <div className="flex items-center gap-2">
                  <input
                    defaultValue={event.title}
                    onChange={(item) => handleTitleChange(event.id, item.target.value)}
                    className="flex-1 rounded-lg border border-zinc-200/90 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:focus:border-white/35"
                    style={{ color: event.color }}
                  />
                  <input
                    type="color"
                    defaultValue={event.color || DEFAULT_EVENT_COLOR}
                    onChange={(item) => handleColorChange(event.id, item.target.value)}
                    className="h-8 w-10 rounded border border-zinc-200/90 bg-white p-1 dark:border-white/10 dark:bg-neutral-900"
                    aria-label="이벤트 색상"
                  />
                  <button
                    onClick={() => void handleDelete(event.id)}
                    disabled={busy}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300/30 text-sm text-rose-200 disabled:opacity-60"
                    aria-label="이벤트 삭제"
                  >
                    🗑️
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-white">근무 기록</h2>
          {canEditPunch ? (
            <button
              type="button"
              onClick={() => setCreatePunchOpen(true)}
              disabled={!currentBranchId || schedulePeople.length === 0}
              className="shrink-0 rounded-lg border border-zinc-300/90 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-white/20 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10"
            >
              실제 근무 추가
            </button>
          ) : null}
        </div>
        {dayPunches.length === 0 ? (
          <article className="rounded-2xl border border-dashed border-zinc-300/90 bg-zinc-50/50 px-4 py-10 text-center dark:border-white/15 dark:bg-white/3">
            <p className="text-sm text-zinc-600 dark:text-neutral-400">등록된 근무 기록이 없습니다.</p>
            {canEditPunch && schedulePeople.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-neutral-500">
                직원 목록을 불러오는 중이거나 권한이 없습니다.
              </p>
            ) : null}
          </article>
        ) : (
          dayPunches.map((record) => (
            <article
              key={record.id}
              className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  {record.employeeName}
                </p>
                {canEditPunch ? (
                  <button
                    type="button"
                    onClick={() => setEditingPunch(record)}
                    className="shrink-0 rounded-md border border-zinc-200/90 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-white/15 dark:text-neutral-200 dark:hover:bg-white/10"
                  >
                    수정
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-neutral-300">
                출근: {formatDateTime(record.checkedInAt)}
              </p>
              <p className="text-sm text-zinc-600 dark:text-neutral-300">
                퇴근: {record.checkedOutAt ? formatDateTime(record.checkedOutAt) : "근무 중"}
              </p>
              {record.checkedOutAt ? (
                <p className="mt-2 text-xs text-zinc-600 dark:text-neutral-400">
                  근무시간: {formatHours(durationHours(record.checkedInAt, record.checkedOutAt))}
                </p>
              ) : null}
            </article>
          ))
        )}
      </section>

      <HistoryDayPunchEditModal
        key={editingPunch?.id ?? "none"}
        open={Boolean(editingPunch)}
        saving={punchSaving}
        deleting={punchDeleting}
        date={date}
        record={editingPunch}
        canEdit={canEditPunch}
        people={schedulePeople}
        onClose={() => setEditingPunch(null)}
        onSave={savePunch}
        onDelete={deletePunch}
      />

      <HistoryDayPunchCreateModal
        key={`create-${date}-${createPunchOpen}`}
        open={createPunchOpen}
        saving={punchSaving}
        date={date}
        canEdit={canEditPunch && schedulePeople.length > 0}
        people={schedulePeople}
        onClose={() => setCreatePunchOpen(false)}
        onCreate={createPunch}
      />
    </DetailPageShell>
  );
}
