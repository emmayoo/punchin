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
        <h2 className="text-base font-semibold text-white">연/월 선택</h2>
        <div className="grid grid-cols-2 gap-2">
          <select
            size={8}
            value={String(selectedYear)}
            onChange={(event) => onChangeYear(Number(event.target.value))}
            className="rounded-xl border border-white/10 bg-neutral-900 p-2 text-sm text-neutral-100 outline-none"
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
            className="rounded-xl border border-white/10 bg-neutral-900 p-2 text-sm text-neutral-100 outline-none"
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
            className="rounded-lg border border-white/20 px-3 py-2 text-sm text-neutral-200"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-neutral-950"
          >
            적용
          </button>
        </div>
      </div>
    </FullscreenModal>
  );
}
