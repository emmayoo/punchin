"use client";

import { FullscreenModal } from "@/components/overlay/fullscreen-modal";

type HistoryEventModalProps = {
  open: boolean;
  title: string;
  dateValue?: string;
  titleValue: string;
  busy: boolean;
  includeDateField?: boolean;
  onDateChange?: (value: string) => void;
  onTitleChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function HistoryEventModal({
  open,
  title,
  dateValue = "",
  titleValue,
  busy,
  includeDateField = false,
  onDateChange,
  onTitleChange,
  onClose,
  onSubmit,
}: HistoryEventModalProps) {
  return (
    <FullscreenModal open={open}>
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
          {title}
        </h2>
        {includeDateField ? (
          <input
            type="date"
            value={dateValue}
            onChange={(event) => onDateChange?.(event.target.value)}
            className="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35"
          />
        ) : null}
        <input
          value={titleValue}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="이벤트 제목 입력"
          className="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35"
        />
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200/90 px-3 py-2 text-sm text-zinc-800 dark:border-white/20 dark:text-neutral-200"
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={busy || !titleValue.trim() || (includeDateField && !dateValue)}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-950"
          >
            저장
          </button>
        </div>
      </div>
    </FullscreenModal>
  );
}
