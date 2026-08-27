import { buildWorkDayTimeIso, dateKey } from "@/components/schedule/schedule-utils";

export const MIN_PUNCH_DURATION_MINUTES = 1;
export const MAX_PUNCH_DURATION_MINUTES = 24 * 60;
/** 근무 시간을 알 수 없을 때 스테퍼가 출발하는 값 — 모달 기본값 09:00~18:00과 같다 */
export const DEFAULT_PUNCH_DURATION_MINUTES = 9 * 60;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * 종료 입력값을 ISO로 바꾼다.
 * `punch-edit-modal`의 `resolvePunchTimes`와 같은 규칙 — 같은 날 `00:00` 종료는 다음날 자정.
 */
function resolveEndIso(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): string | null {
  return endDate === startDate
    ? buildWorkDayTimeIso(endDate, endTime, {
        endOfWorkDayMidnight: true,
        startTimeHHMM: startTime,
      })
    : buildWorkDayTimeIso(endDate, endTime);
}

export function clampPunchDuration(minutes: number): number {
  if (!Number.isFinite(minutes)) {
    return DEFAULT_PUNCH_DURATION_MINUTES;
  }
  return Math.min(
    MAX_PUNCH_DURATION_MINUTES,
    Math.max(MIN_PUNCH_DURATION_MINUTES, Math.round(minutes)),
  );
}

/** 시작/종료 입력값 → 근무 분. 해석할 수 없거나 종료가 시작보다 이르면 null */
export function punchDurationMinutes(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): number | null {
  const startIso = buildWorkDayTimeIso(startDate, startTime);
  const endIso = resolveEndIso(startDate, startTime, endDate, endTime);
  if (!startIso || !endIso) {
    return null;
  }
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return null;
  }
  return Math.round(diffMs / 60_000);
}

/**
 * 시작 + 근무 분 → 종료 날짜/시간 입력값.
 * 정확히 다음날 자정이면 `endDate`가 다음날이 되므로 `resolvePunchTimes`의
 * 같은 날 자정 롤오버 경로를 타지 않는다(이중 보정 방지).
 */
export function endFromDuration(
  startDate: string,
  startTime: string,
  minutes: number,
): { endDate: string; endTime: string } | null {
  const startIso = buildWorkDayTimeIso(startDate, startTime);
  if (!startIso) {
    return null;
  }
  const end = new Date(new Date(startIso).getTime() + clampPunchDuration(minutes) * 60_000);
  if (Number.isNaN(end.getTime())) {
    return null;
  }
  return {
    endDate: dateKey(end),
    endTime: `${pad2(end.getHours())}:${pad2(end.getMinutes())}`,
  };
}

/** 근무 분 → `8시간 30분` / `9시간` / `45분` */
export function formatDurationMinutesKo(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) {
    return `${mins}분`;
  }
  return mins === 0 ? `${hours}시간` : `${hours}시간 ${mins}분`;
}
