"use client";

import { useMemo } from "react";

import { StaffPersonSelect } from "@/components/staff/staff-person-select";
import type { SchedulePerson } from "@/components/schedule/schedule-types";
import { schedulePersonToStaffOption } from "@/lib/staff-person-options";

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
  const options = useMemo(() => people.map(schedulePersonToStaffOption), [people]);

  return (
    <StaffPersonSelect
      value={value}
      options={options}
      disabled={disabled}
      onChange={onChange}
      className={className}
    />
  );
}
