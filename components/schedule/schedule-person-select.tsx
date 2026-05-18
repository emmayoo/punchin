"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { SchedulePerson } from "@/components/schedule/schedule-types";
import { DEFAULT_MEMBER_COLOR } from "@/components/workplace/use-branch-member-colors";
import { schedulePersonSelectLabel } from "@/lib/branch-display-name";

const triggerClass =
  "h-9 w-full rounded-xl border border-zinc-200/90 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35";

function PersonColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-3.5 shrink-0 rounded-full border border-zinc-200/80 dark:border-white/20"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

type SchedulePersonSelectProps = {
  value: string;
  people: SchedulePerson[];
  disabled?: boolean;
  onChange: (personId: string) => void;
  className?: string;
};

export function SchedulePersonSelect({
  value,
  people,
  disabled = false,
  onChange,
  className = "",
}: SchedulePersonSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = people.find((person) => person.id === value) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev);
          }
        }}
        className={`${triggerClass} flex items-center gap-2 text-left disabled:opacity-60`}
      >
        {selected ? (
          <>
            <PersonColorDot color={selected.color?.trim() || DEFAULT_MEMBER_COLOR} />
            <span className="min-w-0 flex-1 truncate">
              {schedulePersonSelectLabel(selected.name, selected.nickname)}
            </span>
          </>
        ) : (
          <span className="text-zinc-500 dark:text-neutral-400">선택</span>
        )}
        <ChevronDown
          className={`ml-auto size-4 shrink-0 text-zinc-500 transition-transform dark:text-neutral-400 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-36 overflow-y-auto rounded-xl border border-zinc-200/90 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-neutral-900"
        >
          {people.map((person) => {
            const isSelected = person.id === value;
            const label = schedulePersonSelectLabel(person.name, person.nickname);
            const color = person.color?.trim() || DEFAULT_MEMBER_COLOR;
            return (
              <li key={person.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(person.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-neutral-950"
                      : "text-zinc-800 hover:bg-zinc-100 dark:text-neutral-100 dark:hover:bg-white/10"
                  }`}
                >
                  <PersonColorDot color={color} />
                  <span className="min-w-0 truncate">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
