"use client";

import { UserPlus } from "lucide-react";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { workApi } from "@/lib/api/work-api";
import { dedupeLatestFormerMembers, formerMemberKey } from "@/lib/branch-former-members";
import { branchMemberDisplayName, sortBranchMembers } from "@/lib/branch-role";
import { emitWorkplaceChanged } from "@/lib/constants/dom-event";
import { dateInputValueToIso, isSameDateIso } from "@/lib/date-input-ko";
import { formatPhoneNumber, isMobile010, normalizePhone } from "@/lib/phone";
import { formatDateOnlyKo } from "@/lib/time";
import { toast } from "@/lib/toast";
import type {
  BranchFormerMemberListItem,
  BranchMemberListItem,
  BranchRole,
  Employee,
} from "@/types/work";

import { WorkplaceSettingsPanel } from "./workplace-settings-panel";
import { WorkplaceSettingsStaffMemberRow } from "./workplace-settings-staff-member-row";

const INVITE_INPUT_CLASS =
  "min-w-24 flex-1 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35";

async function withBusyId(
  setBusy: Dispatch<SetStateAction<string | null>>,
  id: string,
  action: () => Promise<void>,
): Promise<void> {
  setBusy(id);
  try {
    await action();
  } finally {
    setBusy(null);
  }
}

type WorkplaceSettingsStaffSectionProps = {
  branchId: string;
  session: Employee;
  members: BranchMemberListItem[];
  formerMembers: BranchFormerMemberListItem[];
  loading: boolean;
  canManage: boolean;
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
  const [inviteName, setInviteName] = useState("");
  const [busyMembershipId, setBusyMembershipId] = useState<string | null>(null);
  const [rehireBusyKey, setRehireBusyKey] = useState<string | null>(null);
  const [busyColorEmployeeId, setBusyColorEmployeeId] = useState<string | null>(null);
  const [busyNameMembershipId, setBusyNameMembershipId] = useState<string | null>(null);
  const [busyJoinedAtMembershipId, setBusyJoinedAtMembershipId] = useState<string | null>(null);

  const ownerCount = useMemo(
    () => members.filter((member) => member.role === "owner").length,
    [members],
  );

  const sortedMembers = useMemo(() => sortBranchMembers(members), [members]);
  const sessionNp = useMemo(() => normalizePhone(session.phone), [session.phone]);
  const latestFormerMembers = useMemo(
    () => dedupeLatestFormerMembers(formerMembers),
    [formerMembers],
  );

  const invitePhoneReady = useMemo(() => {
    if (busyMembershipId !== null) {
      return false;
    }
    return isMobile010(normalizePhone(invitePhone)) && inviteName.trim().length > 0;
  }, [busyMembershipId, invitePhone, inviteName]);

  const handleInvite = async () => {
    const digits = normalizePhone(invitePhone);
    if (!isMobile010(digits)) {
      return;
    }
    const ok = await workApi.inviteStaffMember(branchId, digits, session.phone, inviteName.trim());
    if (!ok) {
      toast.error("직원을 추가하지 못했습니다.");
      return;
    }
    setInvitePhone("");
    setInviteName("");
    toast.success("직원을 지점에 연결했습니다.");
    await onReload();
  };

  const handleRoleChange = async (membershipId: string, next: BranchRole) => {
    await withBusyId(setBusyMembershipId, membershipId, async () => {
      const ok = await workApi.updateBranchMemberRole(branchId, membershipId, next, session.phone);
      if (!ok) {
        toast.error("역할을 변경하지 못했습니다. 권한 또는 마지막 소유자 제약을 확인해 주세요.");
        return;
      }
      toast.success("역할을 변경했습니다.");
      await onReload();
    });
  };

  const handleDisplayNameBlur = async (row: BranchMemberListItem, raw: string) => {
    const next = raw.trim();
    if (next === row.name.trim()) {
      return;
    }
    await withBusyId(setBusyNameMembershipId, row.membershipId, async () => {
      const ok = await workApi.updateBranchMemberName(
        branchId,
        row.membershipId,
        next === "" ? null : next,
        session.phone,
      );
      if (!ok) {
        toast.error("이름을 저장하지 못했습니다.");
        return;
      }
      toast.success("이름을 저장했습니다.");
      await onReload();
      emitWorkplaceChanged();
    });
  };

  const handleJoinedAtBlur = async (row: BranchMemberListItem, raw: string) => {
    const parsed = dateInputValueToIso(raw);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    if (isSameDateIso(row.joinedAt, parsed.iso)) {
      return;
    }
    await withBusyId(setBusyJoinedAtMembershipId, row.membershipId, async () => {
      const ok = await workApi.updateBranchMemberJoinedAt(
        branchId,
        row.membershipId,
        parsed.iso,
        session.phone,
      );
      if (!ok) {
        toast.error("입사일을 저장하지 못했습니다.");
        return;
      }
      toast.success("입사일을 저장했습니다.");
      await onReload();
      emitWorkplaceChanged();
    });
  };

  const handleColorChange = async (membershipId: string, employeeId: string, nextColor: string) => {
    await withBusyId(setBusyColorEmployeeId, employeeId, async () => {
      const updated = await workApi.updateBranchMemberColor(
        branchId,
        membershipId,
        nextColor,
        session.phone,
      );
      if (!updated) {
        toast.error("색상을 변경하지 못했습니다.");
        return;
      }
      toast.success("색상을 변경했습니다.");
      await onReload();
      emitWorkplaceChanged();
    });
  };

  const handleTerminate = async (membershipId: string) => {
    if (!window.confirm("이 직원을 이 지점에서 제외할까요?")) {
      return;
    }
    await withBusyId(setBusyMembershipId, membershipId, async () => {
      const ok = await workApi.terminateBranchMember(branchId, membershipId, session.phone);
      if (!ok) {
        toast.error("처리하지 못했습니다. 남은 소유자가 한 명일 수 없습니다.");
        return;
      }
      toast.success("지점에서 제외했습니다.");
      await onReload();
    });
  };

  const handleRehire = async (target: BranchFormerMemberListItem) => {
    const who = target.name || target.phone;
    if (!window.confirm(`${who} 직원을 다시 이 지점에 추가할까요?`)) {
      return;
    }
    const key = formerMemberKey(target);
    setRehireBusyKey(key);
    try {
      const ok = await workApi.inviteStaffMember(branchId, target.phone, session.phone, target.name);
      if (!ok) {
        toast.error("재입사 처리하지 못했습니다.");
        return;
      }
      toast.success("직원을 다시 지점에 연결했습니다.");
      await onReload();
    } finally {
      setRehireBusyKey(null);
    }
  };

  if (!canManage) {
    return (
      <WorkplaceSettingsPanel>
        <p className="text-xs font-medium text-zinc-500 dark:text-neutral-500">직원 관리</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-neutral-400">
          직원 초대·역할 변경은 매니저 이상만 할 수 있습니다.
        </p>
      </WorkplaceSettingsPanel>
    );
  }

  return (
    <div className="space-y-4">
      <WorkplaceSettingsPanel>
        <p className="text-xs font-medium text-zinc-500 dark:text-neutral-500">직원 관리</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="text"
            autoComplete="name"
            placeholder="이름"
            value={inviteName}
            onChange={(event) => setInviteName(event.target.value)}
            className={INVITE_INPUT_CLASS}
          />
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="01012345678"
            value={invitePhone}
            onChange={(event) => setInvitePhone(normalizePhone(event.target.value))}
            className={`min-w-30 ${INVITE_INPUT_CLASS}`}
          />
          <button
            type="button"
            disabled={!invitePhoneReady}
            onClick={() => void handleInvite()}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-white dark:text-neutral-950"
          >
            <UserPlus className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <p className="text-sm text-zinc-500 dark:text-neutral-500">불러오는 중...</p>
          ) : sortedMembers.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-neutral-400">등록된 직원이 없습니다.</p>
          ) : (
            <table className="w-full min-w-60 text-left text-sm">
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
                {sortedMembers.map((row) => (
                  <WorkplaceSettingsStaffMemberRow
                    key={row.membershipId}
                    row={row}
                    sessionNp={sessionNp}
                    actorHasOwnerPowers={actorHasOwnerPowers}
                    ownerCount={ownerCount}
                    busyMembershipId={busyMembershipId}
                    busyNameMembershipId={busyNameMembershipId}
                    busyJoinedAtMembershipId={busyJoinedAtMembershipId}
                    busyColorEmployeeId={busyColorEmployeeId}
                    onRoleChange={(membershipId, role) => void handleRoleChange(membershipId, role)}
                    onDisplayNameBlur={(member, value) => void handleDisplayNameBlur(member, value)}
                    onJoinedAtBlur={(member, value) => void handleJoinedAtBlur(member, value)}
                    onColorChange={(membershipId, employeeId, color) =>
                      void handleColorChange(membershipId, employeeId, color)
                    }
                    onTerminate={(membershipId) => void handleTerminate(membershipId)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </WorkplaceSettingsPanel>

      <WorkplaceSettingsPanel>
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
                  const busyKey = formerMemberKey(row);
                  return (
                    <tr key={`former-${row.membershipId}`}>
                      <td className="py-2.5 text-zinc-900 dark:text-neutral-100">
                        {branchMemberDisplayName(row.name, isSelf)}
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
      </WorkplaceSettingsPanel>
    </div>
  );
}
