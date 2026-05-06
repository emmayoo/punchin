"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { DetailPageShell } from "@/components/layout/detail-page-shell";
import {
  canEditBranchBasicInfo,
  canOpenWorkplaceSettings,
  resolveWorkplaceBranchAccess,
} from "@/components/workplace/settings/workplace-settings-access";
import { workApi } from "@/lib/api/work-api";
import { toast } from "@/lib/toast";
import { emitWorkplaceChanged } from "@/lib/constants/dom-event";

const fieldInputClass =
  "mt-2 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35";

export default function WorkplaceBranchBasicEditPage() {
  const { data, refresh } = useDashboardData();
  const [name, setName] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [address, setAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [saving, setSaving] = useState(false);
  const isDirtyRef = useRef(false);

  const currentBranch = useMemo(() => {
    if (!data?.session?.currentBranchId) {
      return null;
    }
    return data.branches.find((branch) => branch.id === data.session?.currentBranchId) ?? null;
  }, [data]);

  const access = useMemo(
    () => resolveWorkplaceBranchAccess(currentBranch, data?.session ?? null, data?.myBranchMemberships ?? []),
    [currentBranch, data?.session, data?.myBranchMemberships],
  );

  const showSettingsChrome = access ? canOpenWorkplaceSettings(access) : false;
  const canEditBasic = access ? canEditBranchBasicInfo(access) : false;

  const currentBranchId = currentBranch?.id ?? null;
  const currentBranchName = currentBranch?.name ?? "";
  const currentBranchBusinessNumber = currentBranch?.businessNumber ?? "";
  const currentBranchAddress = currentBranch?.address ?? "";
  const currentBranchStorePhone = currentBranch?.storePhone ?? "";

  useEffect(() => {
    if (!currentBranchId) {
      return;
    }
    // 사용자가 편집 중이면(typing) 서버 폴링/refresh로 인한 값 덮어쓰기 방지
    if (isDirtyRef.current) {
      return;
    }
    (async () => {
      setName(currentBranchName);
      setBusinessNumber(currentBranchBusinessNumber);
      setAddress(currentBranchAddress);
      setStorePhone(currentBranchStorePhone);
    })();
  }, [
    currentBranchId,
    currentBranchName,
    currentBranchBusinessNumber,
    currentBranchAddress,
    currentBranchStorePhone,
  ]);

  const handleSave = async () => {
    if (!data?.session || !currentBranch || !canEditBasic) {
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("지점명을 입력해주세요.");
      return;
    }
    setSaving(true);
    const updated = await workApi.updateMyCreatedBranch(currentBranch.id, data.session.phone, {
      name: trimmedName,
      businessNumber: businessNumber.trim(),
      address: address.trim() ? address.trim() : null,
      storePhone: storePhone.trim() ? storePhone.trim() : null,
    });
    setSaving(false);
    if (!updated) {
      toast.error("저장하지 못했습니다.");
      return;
    }
    isDirtyRef.current = false;
    await refresh();
    emitWorkplaceChanged();
    toast.success("지점 정보를 저장했습니다.");
  };

  if (!data) {
    return (
      <DetailPageShell backHref="/workplace/settings" title="지점 정보 수정" loading>
        <></>
      </DetailPageShell>
    );
  }

  if (!currentBranch || !access || !showSettingsChrome || !canEditBasic) {
    return (
      <DetailPageShell
        backHref="/workplace/settings"
        title="지점 정보 수정"
        className="gap-4"
        contentClassName="gap-4"
      >
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-sm text-zinc-700 dark:text-neutral-300">
            이 화면은 소유자(owner)만 이용할 수 있습니다.
          </p>
        </div>
      </DetailPageShell>
    );
  }

  return (
    <DetailPageShell backHref="/workplace/settings" title="지점 정보 수정" className="gap-4" contentClassName="gap-4">
      <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs font-medium text-zinc-500 dark:text-neutral-500">지점 기본 정보</p>

        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="edit-branch-name" className="text-xs font-medium text-zinc-500 dark:text-neutral-500">
              지점명
            </label>
            <input
              id="edit-branch-name"
              value={name}
              onChange={(event) => {
                isDirtyRef.current = true;
                setName(event.target.value);
              }}
              placeholder="지점명을 입력하세요"
              className={fieldInputClass}
            />
          </div>
          <div>
            <label
              htmlFor="edit-branch-business-number"
              className="text-xs font-medium text-zinc-500 dark:text-neutral-500"
            >
              사업자 번호
            </label>
            <input
              id="edit-branch-business-number"
              value={businessNumber}
              onChange={(event) => {
                isDirtyRef.current = true;
                setBusinessNumber(event.target.value);
              }}
              placeholder="사업자등록번호"
              autoComplete="off"
              className={fieldInputClass}
            />
          </div>
          <div>
            <label htmlFor="edit-branch-address" className="text-xs font-medium text-zinc-500 dark:text-neutral-500">
              주소
            </label>
            <input
              id="edit-branch-address"
              value={address}
              onChange={(event) => {
                isDirtyRef.current = true;
                setAddress(event.target.value);
              }}
              placeholder="주소를 입력하세요"
              autoComplete="street-address"
              className={fieldInputClass}
            />
          </div>
          <div>
            <label
              htmlFor="edit-branch-store-phone"
              className="text-xs font-medium text-zinc-500 dark:text-neutral-500"
            >
              가게 번호
            </label>
            <input
              id="edit-branch-store-phone"
              value={storePhone}
              onChange={(event) => {
                isDirtyRef.current = true;
                setStorePhone(event.target.value);
              }}
              placeholder="매장 전화번호"
              autoComplete="tel"
              inputMode="tel"
              className={fieldInputClass}
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60 dark:bg-white dark:text-neutral-950"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </DetailPageShell>
  );
}
