import { SchedulePerson } from "@/components/schedule/schedule-types";
import { WEEKDAY_LABELS } from "@/components/schedule/schedule-utils";

type ScheduleSlotFormProps = {
  weekday: number;
  startTime: string;
  endTime: string;
  selectedPersonId: string;
  people: SchedulePerson[];
  busy: boolean;
  onWeekdayChange: (value: number) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onSelectedPersonChange: (value: string) => void;
  onCreateSlot: () => void;
};

export function ScheduleSlotForm({
  weekday,
  startTime,
  endTime,
  selectedPersonId,
  people,
  busy,
  onWeekdayChange,
  onStartTimeChange,
  onEndTimeChange,
  onSelectedPersonChange,
  onCreateSlot,
}: ScheduleSlotFormProps) {
  return (
    <section className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-sm font-medium text-white">스케줄 생성</h2>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs text-neutral-400">요일</span>
          <select
            value={weekday}
            onChange={(event) => onWeekdayChange(Number(event.target.value))}
            className="h-9 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 text-sm outline-none focus:border-white/35"
          >
            {WEEKDAY_LABELS.map((label, idx) => (
              <option key={label} value={idx}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-neutral-400">담당자</span>
          <select
            value={selectedPersonId}
            onChange={(event) => onSelectedPersonChange(event.target.value)}
            className="h-9 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 text-sm outline-none focus:border-white/35"
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-[1fr_1fr] items-end gap-2">
        <label className="space-y-1">
          <span className="text-xs text-neutral-400">시작</span>
          <input
            type="time"
            value={startTime}
            onChange={(event) => onStartTimeChange(event.target.value)}
            step={3600}
            className="h-9 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 text-sm outline-none focus:border-white/35"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-neutral-400">종료</span>
          <input
            type="time"
            value={endTime}
            onChange={(event) => onEndTimeChange(event.target.value)}
            step={3600}
            className="h-9 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 text-sm outline-none focus:border-white/35"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onCreateSlot}
        disabled={busy}
        className="w-full h-9 rounded-xl bg-white px-4 text-sm font-semibold text-neutral-950 transition-transform active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? "처리 중..." : "추가"}
      </button>
    </section>
  );
}
