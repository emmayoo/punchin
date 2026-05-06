"use client";

import { parseTimeHHMM } from "@/components/schedule/schedule-utils";
import { useCallback, useEffect, useState } from "react";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function clampHour(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(23, Math.max(0, Math.trunc(n)));
}

function clampMinute(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(59, Math.max(0, Math.trunc(n)));
}

function formatHHMMFromProp(value: string): string {
  const parsed = parseTimeHHMM(value);
  return `${pad2(clampHour(parsed.hour))}:${pad2(clampMinute(parsed.minute))}`;
}

/**
 * 문자열을 24시간제 HH:mm으로 해석합니다.
 * - `9`, `09` → 시만 (분 00)
 * - `930`, `0930` → 09:30
 * - `9:30`, `09:5` → 콜론 기준 시·분 (비어 있는 쪽은 0)
 */
export function normalizeTimeDraftToHHMM(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length !== 2) {
      return null;
    }
    const lh = parts[0].trim();
    const rh = parts[1].trim();
    if (lh !== "" && !/^\d{1,2}$/.test(lh)) {
      return null;
    }
    if (rh !== "" && !/^\d{1,2}$/.test(rh)) {
      return null;
    }
    const h = lh === "" ? 0 : clampHour(Number.parseInt(lh, 10));
    const m = rh === "" ? 0 : clampMinute(Number.parseInt(rh, 10));
    return `${pad2(h)}:${pad2(m)}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits === "" || digits.length > 4) {
    return null;
  }

  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n)) {
    return null;
  }

  if (digits.length <= 2) {
    const h = clampHour(n);
    return `${pad2(h)}:00`;
  }

  const h = clampHour(Math.floor(n / 100));
  const m = clampMinute(n % 100);
  return `${pad2(h)}:${pad2(m)}`;
}

export type ScheduleTimePicker24Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  inputClassName: string;
  id?: string;
  placeholder?: string;
};

/** 24시간제 HH:mm — 텍스트로 입력하고, 포커스를 빼거나 Enter 시 정규화합니다. */
export function ScheduleTimePicker24({
  value,
  onChange,
  disabled,
  inputClassName,
  id,
  placeholder = "09:30",
}: ScheduleTimePicker24Props) {
  const [draft, setDraft] = useState(() => formatHHMMFromProp(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(formatHHMMFromProp(value));
    }
  }, [value, focused]);

  const commit = useCallback(() => {
    const normalized = normalizeTimeDraftToHHMM(draft);
    if (normalized) {
      onChange(normalized);
      setDraft(normalized);
    } else {
      setDraft(formatHHMMFromProp(value));
    }
  }, [draft, onChange, value]);

  const handleChange = useCallback((raw: string) => {
    const cleaned = raw.replace(/[^\d:]/g, "");
    const colonIndex = cleaned.indexOf(":");
    let next =
      colonIndex >= 0
        ? cleaned.slice(0, colonIndex + 1) + cleaned.slice(colonIndex + 1).replace(/:/g, "")
        : cleaned;
    if (next.length > 5) {
      next = next.slice(0, 5);
    }
    setDraft(next);
  }, []);

  return (
    <input
      id={id}
      type="text"
      disabled={disabled}
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      placeholder={placeholder}
      value={draft}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onChange={(event) => handleChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          (event.target as HTMLInputElement).blur();
        }
      }}
      className={inputClassName}
    />
  );
}
