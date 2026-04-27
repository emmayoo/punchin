"use client";

import { FullscreenModal } from "@/components/overlay/fullscreen-modal";
import { toast } from "@/lib/toast";
import Image from "next/image";
import { useRef, type ChangeEvent } from "react";

export type BranchCreateForm = {
  profileImageUrl: string;
  name: string;
  businessNumber: string;
  address: string;
  storePhone: string;
};

type BranchCreateModalProps = {
  open: boolean;
  busy: boolean;
  form: BranchCreateForm;
  onClose: () => void;
  onSubmit: () => void;
  onChange: (patch: Partial<BranchCreateForm>) => void;
  onBusinessNumberChange: (value: string) => void;
};

export function BranchCreateModal({
  open,
  busy,
  form,
  onClose,
  onSubmit,
  onChange,
  onBusinessNumberChange,
}: BranchCreateModalProps) {
  const profileFileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePickProfileImage = () => {
    profileFileInputRef.current?.click();
  };

  const handleProfileImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 선택할 수 있습니다.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));
      reader.readAsDataURL(file);
    }).catch(() => "");
    if (!dataUrl) {
      toast.error("이미지 파일을 불러오지 못했습니다.");
      return;
    }
    onChange({ profileImageUrl: dataUrl });
    event.target.value = "";
  };

  return (
    <FullscreenModal open={open}>
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
          새 지점 만들기
        </h2>
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200/90 bg-zinc-50 p-3 dark:border-white/10 dark:bg-[#18181b]">
          <div className="relative h-14 w-14 overflow-hidden rounded-full border border-dashed border-zinc-300/90 bg-zinc-100 dark:border-white/20 dark:bg-neutral-900">
            {form.profileImageUrl ? (
              <Image
                src={form.profileImageUrl}
                alt="지점 프로필"
                fill
                sizes="56px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500 dark:text-neutral-400">
                {form.name.trim().slice(0, 1) || "점"}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-medium text-zinc-700 dark:text-neutral-200">
              지점 프로필 (선택)
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={profileFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfileImageChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={handlePickProfileImage}
                className="rounded-lg border border-zinc-300/90 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 dark:border-white/20 dark:bg-[#111113] dark:text-white"
              >
                이미지 선택
              </button>
              {form.profileImageUrl ? (
                <button
                  type="button"
                  onClick={() => onChange({ profileImageUrl: "" })}
                  className="rounded-lg border border-zinc-300/90 px-2.5 py-1.5 text-xs text-zinc-700 dark:border-white/20 dark:text-neutral-200"
                >
                  삭제
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <input
          value={form.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="지점 명 (필수)"
          className="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35"
        />
        <input
          value={form.businessNumber}
          onChange={(event) => onBusinessNumberChange(event.target.value)}
          placeholder="사업자 번호 (필수)"
          className="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35"
        />
        <input
          value={form.address}
          onChange={(event) => onChange({ address: event.target.value })}
          placeholder="가게 주소 (선택)"
          className="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35"
        />
        <input
          value={form.storePhone}
          onChange={(event) => onChange({ storePhone: event.target.value })}
          placeholder="가게 번호 (선택)"
          className="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200/90 px-3 py-2 text-sm text-zinc-800 dark:border-white/20 dark:text-neutral-200"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-950"
          >
            생성
          </button>
        </div>
      </div>
    </FullscreenModal>
  );
}
