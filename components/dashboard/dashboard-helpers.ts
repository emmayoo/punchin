import type { DashboardData } from "@/lib/api/work-api";
import { isToday } from "@/lib/time";
import type { PunchRecord, Shift } from "@/types/work";

export function resolveDefaultCheckInBranchId(data: DashboardData | null): string {
  if (!data || !data.session || data.myBranches.length === 0) {
    return "";
  }
  const nowMs = Date.now();
  const todaysMyShifts = data.shifts.filter(
    (shift) =>
      shift.employeePhone === data.session?.phone &&
      isToday(shift.startAt) &&
      Boolean(shift.branchId),
  );
  const ongoing = todaysMyShifts.find((shift) => {
    const startMs = new Date(shift.startAt).getTime();
    const endMs = new Date(shift.endAt).getTime();
    return startMs <= nowMs && nowMs < endMs;
  });
  if (ongoing?.branchId) {
    return ongoing.branchId;
  }
  if (todaysMyShifts.length > 0) {
    const nearest = [...todaysMyShifts].sort((a, b) => {
      const aDelta = Math.abs(new Date(a.startAt).getTime() - nowMs);
      const bDelta = Math.abs(new Date(b.startAt).getTime() - nowMs);
      return aDelta - bDelta;
    })[0];
    if (nearest?.branchId) {
      return nearest.branchId;
    }
  }
  if (
    data.session.currentBranchId &&
    data.myBranches.some((branch) => branch.id === data.session?.currentBranchId)
  ) {
    return data.session.currentBranchId;
  }
  return data.myBranches[0]?.id ?? "";
}

export function buildMyTimelineShifts(data: DashboardData): Shift[] {
  const branchNameById = new Map(data.branches.map((branch) => [branch.id, branch.name] as const));
  if (!data.session) {
    return [];
  }
  return data.shifts
    .filter((shift) => shift.employeePhone === data.session?.phone && isToday(shift.startAt))
    .map((shift) => ({
      ...shift,
      employeeName: shift.branchId
        ? (branchNameById.get(shift.branchId) ?? "지점 미지정")
        : "지점 미지정",
    }));
}

export function buildMyTimelinePunches(data: DashboardData): PunchRecord[] {
  if (!data.session) {
    return [];
  }
  const branchNameById = new Map(data.branches.map((branch) => [branch.id, branch.name] as const));
  return data.punchRecords
    .filter((record) => record.employeePhone === data.session?.phone)
    .map((record) => ({
      ...record,
      employeeName: record.branchId
        ? (branchNameById.get(record.branchId) ?? "지점 미지정")
        : "전체 지점",
    }));
}

export type AttendanceStatus = {
  tone: "neutral" | "info" | "success" | "danger";
  badge: string;
  status: string;
  branch: string;
  schedule: string;
  lateMinutes: number | null;
};

function hhmm(iso: string): string {
  const date = new Date(iso);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function buildAttendanceStatus(data: DashboardData): AttendanceStatus {
  if (!data.session) {
    return {
      tone: "neutral",
      badge: "상태 확인 불가",
      status: "로그인 정보 없음",
      branch: "-",
      schedule: "-",
      lateMinutes: null,
    };
  }
  const nowMs = Date.now();
  const myTodayShifts = data.shifts
    .filter((shift) => shift.employeePhone === data.session?.phone && isToday(shift.startAt))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  if (myTodayShifts.length === 0) {
    return {
      tone: "neutral",
      badge: "근무 없음",
      status: "오늘 근무 일정 없음",
      branch: "-",
      schedule: "-",
      lateMinutes: null,
    };
  }

  const branchNameById = new Map(data.branches.map((branch) => [branch.id, branch.name] as const));

  const myTodayPunches = data.punchRecords
    .filter((p) => p.employeePhone === data.session?.phone)
    .sort((a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime());

  const overlaps = (punchStartMs: number, punchEndMs: number, startMs: number, endMs: number) => {
    return punchStartMs < endMs && punchEndMs > startMs;
  };

  const getBranchLabel = (shift: Shift) =>
    shift.branchId ? (branchNameById.get(shift.branchId) ?? "지점 미지정") : "지점 미지정";

  const shiftCoveredByPunch = (shift: Shift): boolean => {
    const shiftStartMs = new Date(shift.startAt).getTime();
    const shiftEndMs = new Date(shift.endAt).getTime();
    return myTodayPunches.some((p) => {
      const punchStartMs = new Date(p.checkedInAt).getTime();
      const punchEndMs = p.checkedOutAt ? new Date(p.checkedOutAt).getTime() : nowMs;
      const branchMatch = shift.branchId ? p.branchId === shift.branchId : true;
      return branchMatch && overlaps(punchStartMs, punchEndMs, shiftStartMs, shiftEndMs);
    });
  };

  const missedShifts = myTodayShifts.filter((shift) => {
    const endMs = new Date(shift.endAt).getTime();
    return endMs < nowMs && !shiftCoveredByPunch(shift);
  });

  const currentShift =
    myTodayShifts.find((shift) => {
      const startMs = new Date(shift.startAt).getTime();
      const endMs = new Date(shift.endAt).getTime();
      return startMs <= nowMs && nowMs < endMs;
    }) ?? null;

  let currentLateSummary = "";
  let currentLateMinutes: number | null = null;
  let currentBranch = "-";
  let currentSchedule = "-";

  if (currentShift) {
    const shiftStartMs = new Date(currentShift.startAt).getTime();
    const branchLabel = getBranchLabel(currentShift);
    currentBranch = branchLabel;
    currentSchedule = `${hhmm(currentShift.startAt)}-${hhmm(currentShift.endAt)}`;

    const coveredPunch = myTodayPunches.find((p) => {
      if (currentShift.branchId && p.branchId !== currentShift.branchId) {
        return false;
      }
      const punchStartMs = new Date(p.checkedInAt).getTime();
      const punchEndMs = p.checkedOutAt ? new Date(p.checkedOutAt).getTime() : nowMs;
      const shiftStart = new Date(currentShift.startAt).getTime();
      const shiftEnd = new Date(currentShift.endAt).getTime();
      return overlaps(punchStartMs, punchEndMs, shiftStart, shiftEnd);
    });

    if (!coveredPunch) {
      const lateMinutes = Math.max(1, Math.floor((nowMs - shiftStartMs) / 60000));
      currentLateMinutes = lateMinutes;
      currentLateSummary = `지각중 ${branchLabel}(${lateMinutes}분)`;
    } else {
      const checkedInMs = new Date(coveredPunch.checkedInAt).getTime();
      if (checkedInMs > shiftStartMs) {
        const lateMinutes = Math.max(1, Math.floor((checkedInMs - shiftStartMs) / 60000));
        currentLateMinutes = lateMinutes;
        currentLateSummary = `지각출근 ${branchLabel}(${lateMinutes}분)`;
      }
    }
  }

  if (missedShifts.length > 0 || currentLateSummary) {
    return {
      tone: "danger",
      badge: missedShifts.length > 0 ? "미출근/지각" : "지각",
      status: currentLateSummary ? "지각" : "미출근",
      branch: currentBranch,
      schedule: currentSchedule,
      lateMinutes: currentLateMinutes,
    };
  }

  if (currentShift) {
    return {
      tone: "success",
      badge: "정상",
      status: "근무 중",
      branch: currentBranch,
      schedule: currentSchedule,
      lateMinutes: null,
    };
  }

  // 현재 진행중 없으면: 다음 예정 표시
  const nextShift = myTodayShifts.find((shift) => new Date(shift.startAt).getTime() > nowMs);

  if (nextShift) {
    const diffMinutes = Math.max(
      1,
      Math.floor((new Date(nextShift.startAt).getTime() - nowMs) / 60000),
    );
    const branchLabel = getBranchLabel(nextShift);
    return {
      tone: "info",
      badge: "출근 예정",
      status: `시작까지 ${diffMinutes}분`,
      branch: branchLabel,
      schedule: `${hhmm(nextShift.startAt)}-${hhmm(nextShift.endAt)}`,
      lateMinutes: null,
    };
  }

  // 4) 둘 다 없으면
  return {
    tone: "neutral",
    badge: "근무 종료",
    status: "오늘 근무 일정 종료",
    branch: "-",
    schedule: "-",
    lateMinutes: null,
  };
}

export function buildAttendanceStatuses(data: DashboardData): AttendanceStatus[] {
  if (!data.session) {
    return [];
  }
  const nowMs = Date.now();
  const myTodayShifts = data.shifts
    .filter((shift) => shift.employeePhone === data.session?.phone && isToday(shift.startAt))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const branchNameById = new Map(data.branches.map((branch) => [branch.id, branch.name] as const));
  const myTodayPunches = data.punchRecords
    .filter((p) => p.employeePhone === data.session?.phone)
    .sort((a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime());

  const overlaps = (punchStartMs: number, punchEndMs: number, startMs: number, endMs: number) =>
    punchStartMs < endMs && punchEndMs > startMs;

  return myTodayShifts.map((shift) => {
    const startMs = new Date(shift.startAt).getTime();
    const endMs = new Date(shift.endAt).getTime();
    const branch = shift.branchId
      ? (branchNameById.get(shift.branchId) ?? "지점 미지정")
      : "지점 미지정";
    const schedule = `${hhmm(shift.startAt)}-${hhmm(shift.endAt)}`;

    const punch = myTodayPunches.find((p) => {
      if (shift.branchId && p.branchId !== shift.branchId) {
        return false;
      }
      const punchStartMs = new Date(p.checkedInAt).getTime();
      const punchEndMs = p.checkedOutAt ? new Date(p.checkedOutAt).getTime() : nowMs;
      return overlaps(punchStartMs, punchEndMs, startMs, endMs);
    });

    if (endMs < nowMs && !punch) {
      return {
        tone: "danger",
        badge: "미출근",
        status: "기록 없음",
        branch,
        schedule,
        lateMinutes: null,
      } satisfies AttendanceStatus;
    }
    if (startMs <= nowMs && nowMs < endMs) {
      if (!punch) {
        const lateMinutes = Math.max(1, Math.floor((nowMs - startMs) / 60000));
        return {
          tone: "danger",
          badge: "지각",
          status: `현재 ${lateMinutes}분 지각`,
          branch,
          schedule,
          lateMinutes,
        } satisfies AttendanceStatus;
      }
      return {
        tone: "success",
        badge: "정상",
        status: "근무 기록 있음",
        branch,
        schedule,
        lateMinutes: null,
      } satisfies AttendanceStatus;
    }
    if (startMs > nowMs) {
      const untilMinutes = Math.max(1, Math.floor((startMs - nowMs) / 60000));
      return {
        tone: "info",
        badge: "출근 예정",
        status: `시작까지 ${untilMinutes}분`,
        branch,
        schedule,
        lateMinutes: null,
      } satisfies AttendanceStatus;
    }
    return {
      tone: "neutral",
      badge: "근무 종료",
      status: "종료됨",
      branch,
      schedule,
      lateMinutes: null,
    } satisfies AttendanceStatus;
  });
}
