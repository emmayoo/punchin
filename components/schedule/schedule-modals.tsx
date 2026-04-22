import { FullscreenModal } from "@/components/overlay/fullscreen-modal";
import { SchedulePerson } from "@/components/schedule/schedule-types";

type WeekPickerModalProps = {
  open: boolean;
  pickerDate: string;
  onPickerDateChange: (value: string) => void;
  onClose: () => void;
  onApply: () => void;
};

export function WeekPickerModal({
  open,
  pickerDate,
  onPickerDateChange,
  onClose,
  onApply,
}: WeekPickerModalProps) {
  return (
    <FullscreenModal open={open}>
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-white">주 선택</h2>
        <input
          type="date"
          value={pickerDate}
          onChange={(event) => onPickerDateChange(event.target.value)}
          className="w-full rounded-xl border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-white/35"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm text-neutral-200"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onApply}
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-neutral-950"
          >
            이동
          </button>
        </div>
      </div>
    </FullscreenModal>
  );
}

type CopyScheduleModalProps = {
  open: boolean;
  targetDate: string;
  minDate: string;
  copying: boolean;
  onTargetDateChange: (value: string) => void;
  onClose: () => void;
  onCopy: () => void;
};

export function CopyScheduleModal({
  open,
  targetDate,
  minDate,
  copying,
  onTargetDateChange,
  onClose,
  onCopy,
}: CopyScheduleModalProps) {
  return (
    <FullscreenModal open={open}>
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-white">스케줄 복사</h2>
        <p className="text-sm text-neutral-400">
          현재 보고 있는 주 스케줄을 다른 주로 복사합니다.
          <br />
          오늘 기준 다음 주부터 선택할 수 있습니다.
        </p>
        <label className="space-y-1">
          <span className="text-xs text-neutral-400">복사 대상 주</span>
          <input
            type="date"
            value={targetDate}
            min={minDate}
            onChange={(event) => onTargetDateChange(event.target.value)}
            className="w-full rounded-xl border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-white/35"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm text-neutral-200"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={copying}
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60"
          >
            {copying ? "복사 중..." : "복사"}
          </button>
        </div>
      </div>
    </FullscreenModal>
  );
}

type ShiftEditModalProps = {
  open: boolean;
  people: SchedulePerson[];
  date: string;
  startTime: string;
  endTime: string;
  personId: string;
  saving: boolean;
  onDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onPersonIdChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

export function ShiftEditModal({
  open,
  people,
  date,
  startTime,
  endTime,
  personId,
  saving,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onPersonIdChange,
  onClose,
  onSave,
  onDelete,
}: ShiftEditModalProps) {
  return (
    <FullscreenModal open={open}>
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-white">스케줄 수정</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-neutral-400">날짜</span>
            <input
              type="date"
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-white/35"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-neutral-400">담당자</span>
            <select
              value={personId}
              onChange={(event) => onPersonIdChange(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-white/35"
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-neutral-400">시작</span>
            <input
              type="time"
              step={3600}
              value={startTime}
              onChange={(event) => onStartTimeChange(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-white/35"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-neutral-400">종료</span>
            <input
              type="time"
              step={3600}
              value={endTime}
              onChange={(event) => onEndTimeChange(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-white/35"
            />
          </label>
        </div>
        <div className="flex justify-between gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="rounded-lg border border-red-300/40 px-3 py-2 text-sm text-red-200 disabled:opacity-60"
          >
            삭제
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/20 px-3 py-2 text-sm text-neutral-200"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </div>
    </FullscreenModal>
  );
}
