import { SchedulePerson } from "@/components/schedule/schedule-types";
import { Pencil, Plus, Save, Trash, XIcon } from "lucide-react";
import { useState } from "react";

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
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-sm font-medium text-white">직원 목록</h2>
      <div className="grid gap-2">
        {people.map((person) => (
          <div
            key={person.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
          >
            {editingId === person.id ? (
              <div className="grid w-full grid-cols-[1fr_2fr_auto_auto_auto] items-center gap-2">
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-neutral-900 px-2 py-1.5 text-sm outline-none focus:border-white/35"
                />
                <input
                  value={editPhone}
                  onChange={(event) => setEditPhone(event.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-lg border border-white/10 bg-neutral-900 px-2 py-1.5 text-sm outline-none focus:border-white/35"
                />
                <input
                  type="color"
                  value={editColor}
                  onChange={(event) => setEditColor(event.target.value)}
                  className="h-full w-6 rounded-lg border border-white/10 bg-neutral-900 p-1"
                  aria-label="직원 색상 수정"
                />
                <button
                  type="button"
                  onClick={saveEdit}
                  className="rounded-lg border border-emerald-300/40 px-1 py-1 text-xs text-emerald-200"
                >
                  <Save className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg border border-white/20 px-1 py-1 text-xs text-neutral-200"
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
                  <span className="text-sm text-neutral-100">
                    {person.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">
                    {person.employeePhone}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(person)}
                    className="rounded-md border border-white/20 px-1 py-1 text-xs text-neutral-200"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePerson(person.id)}
                    className="rounded-md border border-red-300/40 px-1 py-1 text-xs text-red-200"
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
          className="w-full rounded-xl border border-white/10 bg-neutral-900 px-2 py-1 text-sm outline-none focus:border-white/35"
        />
        <input
          value={newPersonPhone}
          onChange={(event) => onPhoneChange(event.target.value)}
          placeholder="핸드폰 (숫자만)"
          inputMode="numeric"
          className="w-full rounded-xl border border-white/10 bg-neutral-900 px-2 py-1 text-sm outline-none focus:border-white/35"
        />
        <input
          type="color"
          value={newPersonColor}
          onChange={(event) => onColorChange(event.target.value)}
          className="h-full w-6 rounded-xl border border-white/10 bg-neutral-900 p-1"
          aria-label="담당자 색상"
        />
        <button
          type="button"
          onClick={onAddPerson}
          className="rounded-xl border border-white/20 px-2 h-full text-sm font-medium text-white transition-colors hover:border-white/40"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
