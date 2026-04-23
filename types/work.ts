export type Employee = {
  id: string;
  phone: string;
  name: string;
  currentBranchId?: string | null;
};

export type Branch = {
  id: string;
  name: string;
  createdByPhone: string;
};

export type BranchRole = "owner" | "member";

export type BranchMembership = {
  id: string;
  branchId: string;
  employeePhone: string;
  role: BranchRole;
};

export type Shift = {
  id: string;
  employeePhone: string;
  employeeName: string;
  startAt: string;
  endAt: string;
};

export type PunchRecord = {
  id: string;
  employeePhone: string;
  employeeName: string;
  checkedInAt: string;
  checkedOutAt: string | null;
};

export type CalendarEvent = {
  id: string;
  date: string; // yyyy-mm-dd
  title: string;
  color: string; // hex color
};
