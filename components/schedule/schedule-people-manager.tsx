import { SchedulePerson } from "@/components/schedule/schedule-types";
import { Pencil, Plus, Save, Trash, XIcon } from "lucide-react";
import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-zinc-200/90 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35";

type SchedulePeopleManagerProps = {
  people: SchedulePerson[];
  newPersonName: string;
  newPersonPhone: string;
  newPersonColor: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onAddPerson: () => void;
  onUpdatePerson: (
    personId: string,
    payload: Pick<SchedulePerson, "name" | "employeePhone" | "color">,
  ) => void;
  onDeletePerson: (personId: string) => void;
};

export function SchedulePeopleManager({
  people,
  newPersonName,
  newPersonPhone,
  newPersonColor,
  onNameChange,
  onPhoneChange,
  onColorChange,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
}: SchedulePeopleManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editColor, setEditColor] = useState("#22c55e");

  const startEdit = (person: SchedulePerson) => {
    setEditingId(person.id);
    setEditName(person.name);
    setEditPhone(person.employeePhone);
    setEditColor(person.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditPhone("");
  };

  const saveEdit = () => {
    if (!editingId) {
      return;
    }
    onUpdatePerson(editingId, {
      name: editName,
      employeePhone: editPhone,
      color: editColor,
    });
    setEditingId(null);
  };

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-white">직원 목록</h2>
      <div className="grid gap-2">
        {people.map((person) => (
          <div
            key={person.id}
            className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-100/70 px-3 py-2 dark:border-white/10 dark:bg-black/20"
          >
            {editingId === person.id ? (
              <div className="grid w-full grid-cols-[1fr_2fr_auto_auto_auto] items-center gap-2">
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  className={inputClass}
                />
                <input
                  value={editPhone}
                  onChange={(event) => setEditPhone(event.target.value)}
                  inputMode="numeric"
                  className={inputClass}
                />
                <input
                  type="color"
                  value={editColor}
                  onChange={(event) => setEditColor(event.target.value)}
                  className="h-full w-6 rounded-lg border border-zinc-200/90 bg-white p-1 dark:border-white/10 dark:bg-neutral-900"
                  aria-label="직원 색상 수정"
                />
                <button
                  type="button"
                  onClick={saveEdit}
                  className="rounded-lg border border-emerald-500/50 px-1 py-1 text-xs text-emerald-800 dark:border-emerald-300/40 dark:text-emerald-200"
                >
                  <Save className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg border border-zinc-300/90 px-1 py-1 text-xs text-zinc-700 dark:border-white/20 dark:text-neutral-200"
                >
                  <XIcon className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: person.color }}
                    aria-hidden
                  />
                  <span className="text-sm text-zinc-800 dark:text-neutral-100">
                    {person.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 dark:text-neutral-500">
                    {person.employeePhone}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(person)}
                    className="rounded-md border border-zinc-300/90 px-1 py-1 text-xs text-zinc-700 dark:border-white/20 dark:text-neutral-200"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePerson(person.id)}
                    className="rounded-md border border-red-400/50 px-1 py-1 text-xs text-red-700 dark:border-red-300/40 dark:text-red-200"
                  >
                    <Trash className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_2fr_auto_auto] items-end gap-2">
        <input
          value={newPersonName}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="이름"
          className="w-full rounded-xl border border-zinc-200/90 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35"
        />
        <input
          value={newPersonPhone}
          onChange={(event) => onPhoneChange(event.target.value)}
          placeholder="핸드폰 (숫자만)"
          inputMode="numeric"
          className="w-full rounded-xl border border-zinc-200/90 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35"
        />
        <input
          type="color"
          value={newPersonColor}
          onChange={(event) => onColorChange(event.target.value)}
          className="h-full w-6 rounded-xl border border-zinc-200/90 bg-white p-1 dark:border-white/10 dark:bg-neutral-900"
          aria-label="담당자 색상"
        />
        <button
          type="button"
          onClick={onAddPerson}
          className="h-full rounded-xl border border-zinc-300/90 px-2 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-400 dark:border-white/20 dark:text-white dark:hover:border-white/40"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
