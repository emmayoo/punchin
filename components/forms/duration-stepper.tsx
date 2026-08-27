"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { clampPunchDuration, DEFAULT_PUNCH_DURATION_MINUTES } from "@/lib/punch/punch-duration";

const HOUR_STEP_MINUTES = 60;
const MINUTE_STEP_MINUTES = 10;

const stepButtonClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200/90 text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-neutral-200 dark:hover:bg-white/10";

const numberInputClass =
  "min-h-9 w-12 rounded-lg border border-zinc-200/90 bg-white px-1 py-1 text-center font-mono text-sm tabular-nums text-zinc-900 outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500";

type Field = "hour" | "minute";

export type DurationStepperProps = {
  /** 총 근무 분. 알 수 없으면 null */
  value: number | null;
  onChange: (minutes: number) => void;
  disabled?: boolean;
};

/**
 * 근무 길이를 시·분으로 입력한다.
 * ± 는 총 분을 증감시키므로 분이 자연스럽게 자리올림된다(8시간 50분 +10분 → 9시간 00분).
 */
export function DurationStepper({ value, onChange, disabled = false }: DurationStepperProps) {
  const hours = value === null ? null : Math.floor(value / 60);
  const minutes = value === null ? null : value % 60;

  // 편집 중인 칸의 임시 입력값. 포커스가 빠지면 정규화해서 반영한다.
  const [draft, setDraft] = useState<{ field: Field; text: string } | null>(null);

  const settledText = (field: Field) => {
    const settled = field === "hour" ? hours : minutes;
    return settled === null ? "" : String(settled);
  };
  const textFor = (field: Field) => (draft?.field === field ? draft.text : settledText(field));

  const bump = (stepMinutes: number) => {
    onChange(
      value === null ? DEFAULT_PUNCH_DURATION_MINUTES : clampPunchDuration(value + stepMinutes),
    );
  };

  const commit = (field: Field, text: string) => {
    setDraft(null);
    const parsed = Number.parseInt(text, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    onChange(
      field === "hour"
        ? clampPunchDuration(parsed * 60 + (minutes ?? 0))
        : clampPunchDuration((hours ?? 0) * 60 + Math.min(59, parsed)),
    );
  };

  const renderField = (field: Field, unitLabel: string, stepMinutes: number) => (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`${unitLabel} 줄이기`}
        disabled={disabled}
        onClick={() => bump(-stepMinutes)}
        className={stepButtonClass}
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`근무 시간(${unitLabel})`}
        placeholder="—"
        disabled={disabled}
        value={textFor(field)}
        onFocus={() => setDraft({ field, text: settledText(field) })}
        onBlur={(event) => commit(field, event.target.value)}
        onChange={(event) =>
          setDraft({ field, text: event.target.value.replace(/\D/g, "").slice(0, 2) })
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
          }
        }}
        className={numberInputClass}
      />
      <span className="text-sm text-zinc-600 dark:text-neutral-400">{unitLabel}</span>
      <button
        type="button"
        aria-label={`${unitLabel} 늘리기`}
        disabled={disabled}
        onClick={() => bump(stepMinutes)}
        className={stepButtonClass}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {renderField("hour", "시간", HOUR_STEP_MINUTES)}
      {renderField("minute", "분", MINUTE_STEP_MINUTES)}
    </div>
  );
}
