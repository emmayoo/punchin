export type Employee = {
  id: string;
  phone: string;
  name: string;
  /** 프로필 사진 URL (`media` 버킷 공개 URL). */
  avatarUrl?: string | null;
  /** 생년월일 (YYYY-MM-DD) */
  birthDate?: string | null;
  currentBranchId?: string | null;
  /**
   * 본인 표시 이름 확정 시각(ISO). `null`이면 확인 모달 대상(임시·매장 입력 이름만 있는 상태).
   */
  displayNameConfirmedAt?: string | null;
};

/** 지점 스케줄·캘린더 생일 등에 쓰는 직원 요약 */
export type SchedulePersonRecord = {
  id: string;
  name: string;
  nickname: string | null;
  employeePhone: string;
  color: string;
  birthDate?: string | null;
};

export type Branch = {
  id: string;
  profileImageUrl?: string | null;
  name: string;
  businessNumber: string;
  address?: string | null;
  storePhone?: string | null;
  createdByEmployeeId: string;
  /** 생성자 직원 전화 (조회·표시용, `employees` 조인) */
  createdByPhone: string;
};

export type BranchRole = "owner" | "manager" | "staff";

export type BranchMembership = {
  id: string;
  branchId: string;
  employeeId: string;
  employeePhone: string;
  /** 이 지점에서 보이는 이름 (DB: branch_memberships.nickname) */
  name: string;
  /** 입사일 (DB: branch_memberships.started_at) */
  startedAt?: string | null;
  color?: string | null;
  role: BranchRole;
};

/** 지점 설정 등에서 표시하는 활성 멤버 한 줄 */
export type BranchMemberListItem = {
  membershipId: string;
  employeeId: string;
  phone: string;
  /** 이 지점에서 보이는 이름 */
  name: string;
  color?: string | null;
  role: BranchRole;
  joinedAt?: string | null;
};

export type BranchFormerMemberListItem = BranchMemberListItem & {
  /** 지점 제외(종료) 시각 */
  leftAt?: string | null;
};

export type Shift = {
  id: string;
  employeeId: string;
  employeePhone: string;
  employeeName: string;
  branchId?: string | null;
  startAt: string;
  endAt: string;
};

export type PunchRecord = {
  id: string;
  employeeId: string;
  employeePhone: string;
  employeeName: string;
  branchId?: string | null;
  checkedInAt: string;
  checkedOutAt: string | null;
};

export type CalendarEvent = {
  id: string;
  date: string; // yyyy-mm-dd
  title: string;
  color: string; // hex color
  branchId?: string | null;
  /** 수동 등록 이벤트 vs 직원 생일(조회 시 합성) */
  kind?: "manual" | "birthday";
};

export type NoticeAttachment = {
  id: string;
  noticeId: string;
  imageUrl: string;
  sortOrder: number;
};

export type Notice = {
  id: string;
  branchId: string;
  authorEmployeeId: string;
  authorName: string;
  title: string;
  content: string;
  isPinned: boolean;
  attachments: NoticeAttachment[];
  createdAt: string;
  updatedAt: string;
};
