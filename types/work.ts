export type Employee = {
  id: string;
  phone: string;
  name: string;
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
