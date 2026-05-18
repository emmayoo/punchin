import { Shift } from "@/types/work";

export type SchedulePerson = {
  id: string;
  /** 직원 실명 (employees.name) */
  name: string;
  /** 지점 닉네임 (branch_memberships.nickname, 없으면 null) */
  nickname: string | null;
  employeePhone: string;
  color: string;
};

export type WeekDayItem = {
  label: string;
  date: Date;
};

export type ShiftMap = Map<string, Shift[]>;
