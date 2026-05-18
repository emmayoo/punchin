import { SchedulePersonSelect } from "@/components/schedule/schedule-person-select";
import { ScheduleTimePicker24 } from "@/components/schedule/schedule-time-picker-24";
import { SchedulePerson } from "@/components/schedule/schedule-types";
import { WEEKDAY_LABELS } from "@/components/schedule/schedule-utils";

const timeInputClass =
  "h-9 w-full rounded-xl border border-zinc-200/90 bg-white px-3 font-mono text-sm tabular-nums text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35";

type ScheduleSlotFormProps = {
  selectedWeekdays: number[];
  startTime: string;
  endTime: string;
  selectedPersonId: string;
  people: SchedulePerson[];
  busy: boolean;
  onToggleWeekday: (weekdayIndex: number) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onSelectedPersonChange: (value: string) => void;
  onCreateSlot: () => void;
};

export function ScheduleSlotForm({
  selectedWeekdays,
  startTime,
  endTime,
  selectedPersonId,
  people,
  busy,
  onToggleWeekday,
  onStartTimeChange,
  onEndTimeChange,
  onSelectedPersonChange,
  onCreateSlot,
}: ScheduleSlotFormProps) {
  return (
    <section className="space-y-2 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-white">스케줄 생성</h2>

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <span className="text-xs text-zinc-600 dark:text-neutral-400">요일</span>
          <div
            className="-mx-0.5 flex flex-nowrap gap-1.5 overflow-x-auto px-0.5 pb-0.5 [-webkit-overflow-scrolling:touch]"
            role="group"
            aria-label="요일 선택"
          >
            {WEEKDAY_LABELS.map((label, idx) => {
              const selected = selectedWeekdays.includes(idx);
              return (
                <button
                  key={label}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  disabled={busy}
                  onClick={() => onToggleWeekday(idx)}
                  className={
                    selected
                      ? "shrink-0 rounded-lg border border-transparent bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-60 dark:bg-white dark:text-neutral-950 dark:focus-visible:ring-white/40"
                      : "shrink-0 rounded-lg border border-zinc-200/90 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 outline-none transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-60 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-white/25 dark:hover:bg-neutral-800/80 dark:focus-visible:ring-white/40"
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="block min-w-0 shrink-0 space-y-1 sm:w-44">
          <span className="text-xs text-zinc-600 dark:text-neutral-400">담당자</span>
          <SchedulePersonSelect
            value={selectedPersonId}
            people={people}
            disabled={busy}
            onChange={onSelectedPersonChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 space-y-1">
        <label className="block space-y-1">
          <span className="text-xs text-zinc-600 dark:text-neutral-400">시작</span>
          <ScheduleTimePicker24
            value={startTime}
            onChange={onStartTimeChange}
            disabled={busy}
            inputClassName={timeInputClass}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-zinc-600 dark:text-neutral-400">종료</span>
          <ScheduleTimePicker24
            value={endTime}
            onChange={onEndTimeChange}
            disabled={busy}
            inputClassName={timeInputClass}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onCreateSlot}
        disabled={busy}
        className="h-9 w-full rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-60 dark:bg-white dark:text-neutral-950"
      >
        {busy ? "처리 중..." : "추가"}
      </button>
    </section>
  );
}
