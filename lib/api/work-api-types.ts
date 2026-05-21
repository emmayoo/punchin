"use client";

import type {
  Branch,
  BranchMembership,
  CalendarEvent,
  Employee,
  PunchRecord,
  Shift,
} from "@/types/work";

export type { SchedulePersonRecord } from "@/types/work";

export type WeeklyStatRow = {
  phone: string;
  name: string;
  totalHours: number;
  shiftCount: number;
};

export type RangeWorkDetail = {
  recordId: string;
  checkedInAt: string;
  checkedOutAt: string;
  workedSeconds: number;
  /** 퇴근 기록 없이 집계 구간만큼 반영된 근무 */
  ongoing?: boolean;
};

export type RangeWorkStatRow = {
  phone: string;
  name: string;
  totalSeconds: number;
  workCount: number;
  details: RangeWorkDetail[];
};

export type NoticeInput = {
  title: string;
  content: string;
  isPinned: boolean;
  attachments: string[];
};

export type BranchSetupInput =
  | { mode: "select"; branchId: string }
  | {
      mode: "create";
      branchName: string;
      businessNumber: string;
      profileImageFile?: File | null;
      address?: string | null;
      storePhone?: string | null;
    };

export type DashboardData = {
  session: Employee | null;
  branches: Branch[];
  myBranches: Branch[];
  /** 현재 로그인 직원의 지점 멤버십 (역할 판별용) */
  myBranchMemberships: BranchMembership[];
  shifts: Shift[];
  punchRecords: PunchRecord[];
  todayPunches: PunchRecord[];
  todayEvents: CalendarEvent[];
  activePunch: PunchRecord | null;
  currentWorker: Shift | null;
  nextWorker: Shift | null;
  todayShift: Shift | null;
  myTodayHours: number;
  myTodayRecords: PunchRecord[];
};
