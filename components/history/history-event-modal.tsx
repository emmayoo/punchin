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
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {includeDateField ? (
          <input
            type="date"
            value={dateValue}
            onChange={(event) => onDateChange?.(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-white/35"
          />
        ) : null}
        <input
          value={titleValue}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="이벤트 제목 입력"
          className="w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-white/35"
        />
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm text-neutral-200"
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={busy || !titleValue.trim() || (includeDateField && !dateValue)}
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60"
          >
            저장
          </button>
        </div>
      </div>
    </FullscreenModal>
  );
}
