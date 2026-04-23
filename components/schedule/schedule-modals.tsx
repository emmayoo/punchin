import { FullscreenModal } from "@/components/overlay/fullscreen-modal";
import { SchedulePerson } from "@/components/schedule/schedule-types";

const fieldClass =
  "w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35";

const fieldLabelClass = "text-xs text-zinc-600 dark:text-neutral-400";

const btnGhost =
  "rounded-lg border border-zinc-200/90 px-3 py-2 text-sm text-zinc-800 dark:border-white/20 dark:text-neutral-200";

const btnPrimary =
  "rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-950";

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
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">주 선택</h2>
        <input
          type="date"
          value={pickerDate}
          onChange={(event) => onPickerDateChange(event.target.value)}
          className={fieldClass}
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            취소
          </button>
          <button
            type="button"
            onClick={onApply}
            className={btnPrimary}
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
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">스케줄 복사</h2>
        <p className="text-sm text-zinc-600 dark:text-neutral-400">
          현재 보고 있는 주 스케줄을 다른 주로 복사합니다.
          <br />
          오늘 기준 다음 주부터 선택할 수 있습니다.
        </p>
        <label className="space-y-1">
          <span className={fieldLabelClass}>복사 대상 주</span>
          <input
            type="date"
            value={targetDate}
            min={minDate}
            onChange={(event) => onTargetDateChange(event.target.value)}
            className={fieldClass}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            취소
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={copying}
            className={btnPrimary}
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
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">스케줄 수정</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className={fieldLabelClass}>날짜</span>
            <input
              type="date"
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1">
            <span className={fieldLabelClass}>담당자</span>
            <select
              value={personId}
              onChange={(event) => onPersonIdChange(event.target.value)}
              className={fieldClass}
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className={fieldLabelClass}>시작</span>
            <input
              type="time"
              step={3600}
              value={startTime}
              onChange={(event) => onStartTimeChange(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1">
            <span className={fieldLabelClass}>종료</span>
            <input
              type="time"
              step={3600}
              value={endTime}
              onChange={(event) => onEndTimeChange(event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="flex justify-between gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="rounded-lg border border-red-400/50 px-3 py-2 text-sm text-red-700 disabled:opacity-60 dark:border-red-300/40 dark:text-red-200"
          >
            삭제
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={btnGhost}>
              취소
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={btnPrimary}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </div>
    </FullscreenModal>
  );
}
