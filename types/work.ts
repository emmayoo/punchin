export type Employee = {
  id: string;
  phone: string;
  name: string;
  /** 프로필 사진 URL(Supabase 공개 URL 또는 로컬 data URL). */
  avatarUrl?: string | null;
  currentBranchId?: string | null;
  /**
   * 본인 표시 이름 확정 시각(ISO). `null`이면 아직 임시·매장 입력 이름만 있는 상태(확인 필요).
   * 필드 없음(undefined)은 로컬 구버전 행 → 확정으로 간주.
   */
  displayNameConfirmedAt?: string | null;
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
