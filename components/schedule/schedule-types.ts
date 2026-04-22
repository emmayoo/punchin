import { Shift } from "@/types/work";

export type SchedulePerson = {
  id: string;
  name: string;
  employeePhone: string;
  color: string;
};

export type WeekDayItem = {
  label: string;
  date: Date;
};

export type ShiftMap = Map<string, Shift[]>;
