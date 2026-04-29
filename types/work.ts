export type Employee = {
  id: string;
  phone: string;
  name: string;
  /** 스케줄 등에서 사용하는 표시 색 (DB `employees.color`) */
  color?: string;
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
  role: BranchRole;
};

/** 지점 설정 등에서 표시하는 활성 멤버 한 줄 */
export type BranchMemberListItem = {
  membershipId: string;
  employeeId: string;
  phone: string;
  name: string;
  color?: string | null;
  role: BranchRole;
  /** 멤버십 생성 시각(ISO). 로컬 저장소 등에서는 비어 있을 수 있음 → 입사일 표시 시 — */
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
