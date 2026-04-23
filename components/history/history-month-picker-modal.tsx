"use client";

import { FullscreenModal } from "@/components/overlay/fullscreen-modal";

type HistoryMonthPickerModalProps = {
  open: boolean;
  selectedYear: number;
  selectedMonth: number;
  onChangeYear: (year: number) => void;
  onChangeMonth: (month: number) => void;
  onClose: () => void;
  onConfirm: () => void;
};

const YEARS = Array.from({ length: 21 }, (_, i) => 2020 + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function HistoryMonthPickerModal({
  open,
  selectedYear,
  selectedMonth,
  onChangeYear,
  onChangeMonth,
  onClose,
  onConfirm,
}: HistoryMonthPickerModalProps) {
  return (
    <FullscreenModal open={open}>
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">연/월 선택</h2>
        <div className="grid grid-cols-2 gap-2">
          <select
            size={8}
            value={String(selectedYear)}
            onChange={(event) => onChangeYear(Number(event.target.value))}
            className="rounded-xl border border-zinc-200/90 bg-white p-2 text-sm text-zinc-900 outline-none dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100"
          >
            {YEARS.map((year) => (
              <option key={year} value={year}>
                {year}년
              </option>
            ))}
          </select>
          <select
            size={8}
            value={String(selectedMonth)}
            onChange={(event) => onChangeMonth(Number(event.target.value))}
            className="rounded-xl border border-zinc-200/90 bg-white p-2 text-sm text-zinc-900 outline-none dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100"
          >
            {MONTHS.map((month) => (
              <option key={month} value={month}>
                {month}월
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200/90 px-3 py-2 text-sm text-zinc-800 dark:border-white/20 dark:text-neutral-200"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950"
          >
            적용
          </button>
        </div>
      </div>
    </FullscreenModal>
  );
}
