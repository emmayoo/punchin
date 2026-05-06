"use client";

import { UserPlus, UserRoundX } from "lucide-react";
import { useMemo, useState } from "react";

import { ColorPresetPicker } from "@/components/color-preset-picker";
import { workApi } from "@/lib/api/work-api";
import { formatPhoneNumber } from "@/lib/phone";
import { formatDateOnlyKo } from "@/lib/time";
import { toast } from "@/lib/toast";
import type {
  BranchFormerMemberListItem,
  BranchMemberListItem,
  BranchRole,
  Employee,
} from "@/types/work";

const ROLE_LABEL: Record<BranchRole, string> = {
  owner: "소유자",
  manager: "매니저",
  staff: "직원",
};

function normalizePhone(input: string): string {
  return input.replace(/\D/g, "").slice(0, 11);
}

/** 휴대폰 010xxxxxxxx (11자리) */
function isMobile010(digits: string): boolean {
  return /^010\d{8}$/.test(digits);
}

/** 표 작업 열과 동일한 규칙 — 역할 변경 가능 대상 중 지점 제외 가능한 사람만 */
function memberCanBeTerminatedFromBranch(
  row: BranchMemberListItem,
  actorHasOwnerPowers: boolean,
  ownerCount: number,
): boolean {
  const canEditRow = actorHasOwnerPowers || row.role === "staff";
  if (!canEditRow) {
    return false;
  }
  if (actorHasOwnerPowers) {
    return row.role !== "owner" || ownerCount > 1;
  }
  return row.role === "staff";
}

type WorkplaceSettingsStaffSectionProps = {
  branchId: string;
  session: Employee;
  members: BranchMemberListItem[];
  formerMembers: BranchFormerMemberListItem[];
  loading: boolean;
  canManage: boolean;
  /** 소유자 권한 — 타 매니저·소유자 행 편집, owner 역할 부여 */
  actorHasOwnerPowers: boolean;
  onReload: () => Promise<void>;
};

export function WorkplaceSettingsStaffSection({
  branchId,
  session,
  members,
  formerMembers,
  loading,
  canManage,
  actorHasOwnerPowers,
  onReload,
}: WorkplaceSettingsStaffSectionProps) {
  const [invitePhone, setInvitePhone] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rehireBusyKey, setRehireBusyKey] = useState<string | null>(null);
  const [busyColorEmployeeId, setBusyColorEmployeeId] = useState<string | null>(null);

  const ownerCount = useMemo(
    () => members.filter((member) => member.role === "owner").length,
    [members],
  );

  const sortedMembers = useMemo(() => {
    const order: BranchRole[] = ["owner", "manager", "staff"];
    return [...members].sort(
      (a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.name.localeCompare(b.name, "ko"),
    );
  }, [members]);

  const sessionNp = useMemo(() => normalizePhone(session.phone), [session.phone]);
  const invitePhoneReady = useMemo(
    () => busyId === null && isMobile010(normalizePhone(invitePhone)),
    [busyId, invitePhone],
  );

  const latestFormerMembers = useMemo(() => {
    const byEmployee = new Map<string, BranchFormerMemberListItem>();
    for (const row of formerMembers) {
      const key = row.employeeId || normalizePhone(row.phone);
      const prev = byEmployee.get(key);
      const prevMs = prev?.leftAt ? new Date(prev.leftAt).getTime() : -1;
      const nextMs = row.leftAt ? new Date(row.leftAt).getTime() : -1;
      if (!prev || nextMs >= prevMs) {
        byEmployee.set(key, row);
      }
    }
    return [...byEmployee.values()].sort((a, b) => {
      const ams = a.leftAt ? new Date(a.leftAt).getTime() : -1;
      const bms = b.leftAt ? new Date(b.leftAt).getTime() : -1;
      return bms - ams;
    });
  }, [formerMembers]);

  const handleInvite = async () => {
    const digits = normalizePhone(invitePhone);
    if (!isMobile010(digits)) {
      return;
    }
    const ok = await workApi.inviteStaffMember(branchId, digits, session.phone);
    if (!ok) {
      toast.error("직원을 추가하지 못했습니다.");
      return;
    }
    setInvitePhone("");
    toast.success("직원을 지점에 연결했습니다.");
    await onReload();
  };

  const handleRoleChange = async (membershipId: string, next: BranchRole) => {
    setBusyId(membershipId);
    const ok = await workApi.updateBranchMemberRole(branchId, membershipId, next, session.phone);
    setBusyId(null);
    if (!ok) {
      toast.error("역할을 변경하지 못했습니다. 권한 또는 마지막 소유자 제약을 확인해 주세요.");
      return;
    }
    toast.success("역할을 변경했습니다.");
    await onReload();
  };

  const handleColorChange = async (
    membershipId: string,
    employeeId: string,
    nextColor: string,
  ) => {
    setBusyColorEmployeeId(employeeId);
    const updated = await workApi.updateBranchMemberColor(
      branchId,
      membershipId,
      nextColor,
      session.phone,
    );
    setBusyColorEmployeeId(null);
    if (!updated) {
      toast.error("색상을 변경하지 못했습니다.");
      return;
    }
    toast.success("색상을 변경했습니다.");
    await onReload();
  };

  const handleTerminate = async (membershipId: string) => {
    if (!window.confirm("이 직원을 이 지점에서 제외할까요?")) {
      return;
    }
    setBusyId(membershipId);
    const ok = await workApi.terminateBranchMember(branchId, membershipId, session.phone);
    setBusyId(null);
    if (!ok) {
      toast.error("처리하지 못했습니다. 남은 소유자가 한 명일 수 없습니다.");
      return;
    }
    toast.success("지점에서 제외했습니다.");
    await onReload();
  };

  const handleRehire = async (target: BranchFormerMemberListItem) => {
    const who = target.name || target.phone;
    if (!window.confirm(`${who} 직원을 다시 이 지점에 추가할까요?`)) {
      return;
    }
    const key = target.employeeId || normalizePhone(target.phone);
    setRehireBusyKey(key);
    const ok = await workApi.inviteStaffMember(branchId, target.phone, session.phone);
    setRehireBusyKey(null);
    if (!ok) {
      toast.error("재입사 처리하지 못했습니다.");
      return;
    }
    toast.success("직원을 다시 지점에 연결했습니다.");
    await onReload();
  };

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs font-medium text-zinc-500 dark:text-neutral-500">직원 관리</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-neutral-400">
          직원 초대·역할 변경은 매니저 이상만 할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs font-medium text-zinc-500 dark:text-neutral-500">직원 관리</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="01012345678"
            value={invitePhone}
            onChange={(e) => setInvitePhone(normalizePhone(e.target.value))}
            className="min-w-[200px] flex-1 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35"
          />
          <button
            type="button"
            disabled={!invitePhoneReady}
            onClick={() => void handleInvite()}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-950"
          >
            직원 추가
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <p className="text-sm text-zinc-500 dark:text-neutral-500">불러오는 중...</p>
          ) : sortedMembers.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-neutral-400">등록된 직원이 없습니다.</p>
          ) : (
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200/80 text-xs text-zinc-500 dark:border-white/10 dark:text-neutral-500">
                  <th className="pb-2 font-medium">이름</th>
                  <th className="pb-2 font-medium">전화</th>
                  <th className="pb-2 font-medium">역할</th>
                  <th className="pb-2 font-medium">색</th>
                  <th className="whitespace-nowrap pb-2 font-medium">입사일</th>
                  <th className="w-12 pb-2 font-medium text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70 dark:divide-white/10">
                {sortedMembers.map((row) => {
                  const canEditRow = actorHasOwnerPowers || row.role === "staff";
                  const roleChoices: BranchRole[] = actorHasOwnerPowers
                    ? ["staff", "manager", "owner"]
                    : ["staff", "manager"];

                  const isSelf = normalizePhone(row.phone) === sessionNp;
                  const canTerminate = memberCanBeTerminatedFromBranch(
                    row,
                    actorHasOwnerPowers,
                    ownerCount,
                  );
                  return (
                    <tr key={row.membershipId}>
                      <td className="py-2.5 text-zinc-900 dark:text-neutral-100">
                        {isSelf ? `${row.name} (나)` : row.name}
                      </td>
                      <td className="py-2.5 text-zinc-700 dark:text-neutral-300">
                        {formatPhoneNumber(row.phone)}
                      </td>
                      <td className="py-2.5">
                        {canEditRow ? (
                          <select
                            value={row.role}
                            disabled={busyId === row.membershipId}
                            onChange={(e) =>
                              void handleRoleChange(row.membershipId, e.target.value as BranchRole)
                            }
                            className="rounded-lg border border-zinc-200/90 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100"
                          >
                            {(roleChoices.includes(row.role)
                              ? roleChoices
                              : [...roleChoices, row.role]
                            ).map((role) => (
                              <option key={`${row.membershipId}-${role}`} value={role}>
                                {ROLE_LABEL[role]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-zinc-800 dark:text-neutral-200">
                            {ROLE_LABEL[row.role]}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5">
                        {canEditRow ? (
                          <div className="flex items-center gap-2">
                            <ColorPresetPicker
                              value={row.color ?? "#22c55e"}
                              disabled={busyColorEmployeeId === row.employeeId}
                              onChange={(hex) =>
                                void handleColorChange(row.membershipId, row.employeeId, hex)
                              }
                              aria-label={`${isSelf ? `${row.name} (나)` : row.name} 색상 선택`}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-4 w-4 rounded-full border border-zinc-200/80 dark:border-white/20"
                              style={{ backgroundColor: row.color ?? "#22c55e" }}
                              aria-hidden
                            />
                            <span className="text-xs text-zinc-600 dark:text-neutral-300">
                              {(row.color ?? "#22c55e").toUpperCase()}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2.5 text-zinc-700 tabular-nums dark:text-neutral-300">
                        {formatDateOnlyKo(row.joinedAt)}
                      </td>
                      <td className="py-2.5 text-right">
                        {canTerminate ? (
                          <button
                            type="button"
                            disabled={busyId === row.membershipId}
                            onClick={() => void handleTerminate(row.membershipId)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200/80 text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/45 dark:text-rose-300 dark:hover:bg-rose-900/30"
                            aria-label={`${isSelf ? `${row.name} (나)` : row.name} 지점 연결 끊기`}
                            title="지점 연결 끊기"
                          >
                            <UserRoundX className="h-4 w-4" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs font-medium text-zinc-500 dark:text-neutral-500">제외된 직원</p>
        <div className="mt-2 overflow-x-auto">
          {loading ? (
            <p className="text-sm text-zinc-500 dark:text-neutral-500">불러오는 중...</p>
          ) : latestFormerMembers.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-neutral-400">
              아직 제외된 직원이 없습니다.
            </p>
          ) : (
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200/80 text-xs text-zinc-500 dark:border-white/10 dark:text-neutral-500">
                  <th className="pb-2 font-medium">이름</th>
                  <th className="pb-2 font-medium">전화</th>
                  <th className="whitespace-nowrap pb-2 font-medium">제외일</th>
                  <th className="w-24 pb-2 font-medium text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70 dark:divide-white/10">
                {latestFormerMembers.map((row) => {
                  const isSelf = normalizePhone(row.phone) === sessionNp;
                  const busyKey = row.employeeId || normalizePhone(row.phone);
                  return (
                    <tr key={`former-${row.membershipId}`}>
                      <td className="py-2.5 text-zinc-900 dark:text-neutral-100">
                        {isSelf ? `${row.name} (나)` : row.name}
                      </td>
                      <td className="py-2.5 text-zinc-700 dark:text-neutral-300">
                        {formatPhoneNumber(row.phone)}
                      </td>
                      <td className="whitespace-nowrap py-2.5 tabular-nums text-zinc-700 dark:text-neutral-300">
                        {formatDateOnlyKo(row.leftAt)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => void handleRehire(row)}
                          disabled={rehireBusyKey === busyKey}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/90 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-white/10"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          {rehireBusyKey === busyKey ? "처리 중..." : "재입사"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
