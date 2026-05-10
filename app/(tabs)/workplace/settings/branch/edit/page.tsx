"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { DetailPageShell } from "@/components/layout/detail-page-shell";
import {
  canEditBranchBasicInfo,
  canOpenWorkplaceSettings,
  resolveWorkplaceBranchAccess,
} from "@/components/workplace/settings/workplace-settings-access";
import { workApi } from "@/lib/api/work-api";
import { assertValidImageFile } from "@/lib/media/validate-image";
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
  const [pendingProfileFile, setPendingProfileFile] = useState<File | null>(null);
  const [pendingProfilePreviewUrl, setPendingProfilePreviewUrl] = useState<string | null>(null);
  const [removeProfileImage, setRemoveProfileImage] = useState(false);
  const profileInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    return () => {
      if (pendingProfilePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(pendingProfilePreviewUrl);
      }
    };
  }, [pendingProfilePreviewUrl]);

  useEffect(() => {
    if (!currentBranchId || isDirtyRef.current) {
      return;
    }
    setPendingProfileFile(null);
    setRemoveProfileImage(false);
    setPendingProfilePreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
  }, [currentBranchId, currentBranch?.profileImageUrl]);

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
    let profileImageFile: File | null | undefined = undefined;
    if (removeProfileImage) {
      profileImageFile = null;
    } else if (pendingProfileFile) {
      profileImageFile = pendingProfileFile;
    }
    const updated = await workApi.updateMyCreatedBranch(currentBranch.id, data.session.phone, {
      name: trimmedName,
      businessNumber: businessNumber.trim(),
      address: address.trim() ? address.trim() : null,
      storePhone: storePhone.trim() ? storePhone.trim() : null,
      ...(profileImageFile !== undefined ? { profileImageFile } : {}),
    });
    setSaving(false);
    if (!updated) {
      toast.error("저장하지 못했습니다.");
      return;
    }
    if (pendingProfilePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(pendingProfilePreviewUrl);
    }
    setPendingProfileFile(null);
    setPendingProfilePreviewUrl(null);
    setRemoveProfileImage(false);
    isDirtyRef.current = false;
    await refresh();
    emitWorkplaceChanged();
    toast.success("지점 정보를 저장했습니다.");
  };

  const handleProfilePick = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }
    try {
      assertValidImageFile(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "이미지를 선택할 수 없습니다.");
      return;
    }
    isDirtyRef.current = true;
    setRemoveProfileImage(false);
    setPendingProfileFile(file);
    setPendingProfilePreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return URL.createObjectURL(file);
    });
  };

  const handleProfileClear = () => {
    isDirtyRef.current = true;
    setPendingProfileFile(null);
    setRemoveProfileImage(true);
    setPendingProfilePreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
  };

  const profileDisplaySrc =
    !removeProfileImage &&
    currentBranch &&
    (pendingProfilePreviewUrl || currentBranch.profileImageUrl)
      ? (pendingProfilePreviewUrl ?? currentBranch.profileImageUrl)
      : null;

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

        <div className="mt-3 flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white/60 p-3 dark:border-white/10 dark:bg-neutral-900/40">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-zinc-200/90 bg-zinc-100 dark:border-white/15 dark:bg-neutral-900">
            {profileDisplaySrc ? (
              <Image
                src={profileDisplaySrc}
                alt=""
                fill
                sizes="56px"
                className="object-cover"
                unoptimized={
                  Boolean(
                    pendingProfilePreviewUrl?.startsWith("blob:") ||
                      profileDisplaySrc.startsWith("data:"),
                  )
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500 dark:text-neutral-400">
                {currentBranch.name.trim().slice(0, 1) || "점"}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-medium text-zinc-600 dark:text-neutral-400">지점 프로필 사진</p>
            <input
              ref={profileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                handleProfilePick(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => profileInputRef.current?.click()}
                className="rounded-lg border border-zinc-300/90 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 dark:border-white/20 dark:bg-neutral-900 dark:text-white"
              >
                사진 변경
              </button>
              {(pendingProfilePreviewUrl || currentBranch.profileImageUrl) && !removeProfileImage ? (
                <button
                  type="button"
                  onClick={handleProfileClear}
                  className="rounded-lg border border-zinc-300/90 px-2.5 py-1.5 text-xs text-zinc-700 dark:border-white/20 dark:text-neutral-200"
                >
                  사진 제거
                </button>
              ) : null}
            </div>
          </div>
        </div>

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
