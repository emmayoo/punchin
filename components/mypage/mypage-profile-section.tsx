"use client";

import { Calendar, Camera, ImageIcon, Phone, Trash2, User } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";

import { ActionSheetItem, BottomActionSheet } from "@/components/overlay/bottom-action-sheet";
import { shouldUnoptimizeNextImage } from "@/lib/media/next-image";
import { birthDateInputMax } from "@/lib/profile/birth-date";
import { formatPhoneNumber } from "@/lib/phone";
import type { Employee } from "@/types/work";

type MyPageProfileSectionProps = {
  session: Employee;
  name: string;
  birthDate: string;
  busy: boolean;
  removeAvatar: boolean;
  pendingAvatarPreviewUrl: string | null;
  onNameChange: (value: string) => void;
  onBirthDateChange: (value: string) => void;
  onAvatarPick: (files: FileList | null) => void;
  onAvatarClear: () => void;
  onSave: () => void;
};

const fieldClassName =
  "w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-white/35";

function ProfileField({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: typeof User;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-neutral-400">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        {label}
      </span>
      {children}
      {hint ? (
        <p className="text-[11px] leading-snug text-zinc-500 dark:text-neutral-500">{hint}</p>
      ) : null}
    </label>
  );
}

export function MyPageProfileSection({
  session,
  name,
  birthDate,
  busy,
  removeAvatar,
  pendingAvatarPreviewUrl,
  onNameChange,
  onBirthDateChange,
  onAvatarPick,
  onAvatarClear,
  onSave,
}: MyPageProfileSectionProps) {
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const avatarSrc = !removeAvatar ? (pendingAvatarPreviewUrl ?? session.avatarUrl) : null;
  const initial = session.name.trim().slice(0, 1) || "나";
  const canSave = name.trim().length > 0;

  const closeAvatarSheet = () => setAvatarSheetOpen(false);

  const handleGalleryPick = (files: FileList | null) => {
    closeAvatarSheet();
    onAvatarPick(files);
  };

  const handleRemoveAvatar = () => {
    closeAvatarSheet();
    onAvatarClear();
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">프로필</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
        className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white dark:border-white/10 dark:bg-zinc-950/40"
      >
        <div className="border-b border-zinc-100 px-5 py-6 dark:border-white/5">
          <div className="mx-auto flex w-full max-w-xs justify-center">
            <div className="relative h-24 w-24 shrink-0">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border border-zinc-200/90 bg-zinc-100 dark:border-white/15 dark:bg-neutral-800">
                {avatarSrc ? (
                  <Image
                    src={avatarSrc}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                    unoptimized={shouldUnoptimizeNextImage(avatarSrc)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-zinc-500 dark:text-neutral-400">
                    {initial}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setAvatarSheetOpen(true)}
                className="absolute -right-0.5 -top-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-zinc-900 text-white transition-colors hover:bg-zinc-800 dark:border-zinc-950 dark:bg-white dark:text-zinc-900 dark:hover:bg-neutral-200"
                aria-label="프로필 사진 변경"
              >
                <Camera className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              handleGalleryPick(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              handleGalleryPick(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <BottomActionSheet open={avatarSheetOpen} title="프로필 사진" onClose={closeAvatarSheet}>
          <ActionSheetItem
            icon={<Camera className="h-5 w-5" />}
            onClick={() => {
              closeAvatarSheet();
              cameraInputRef.current?.click();
            }}
          >
            사진 촬영
          </ActionSheetItem>
          <ActionSheetItem
            icon={<ImageIcon className="h-5 w-5" />}
            onClick={() => {
              closeAvatarSheet();
              galleryInputRef.current?.click();
            }}
          >
            앨범에서 선택
          </ActionSheetItem>
          {avatarSrc ? (
            <ActionSheetItem
              icon={<Trash2 className="h-5 w-5" />}
              destructive
              onClick={handleRemoveAvatar}
            >
              사진 제거
            </ActionSheetItem>
          ) : null}
          <div className="mt-1 border-t border-zinc-100 pt-1 dark:border-white/10">
            <ActionSheetItem onClick={closeAvatarSheet}>취소</ActionSheetItem>
          </div>
        </BottomActionSheet>

        <div className="space-y-4 px-5 py-5">
          <ProfileField icon={Phone} label="로그인 번호">
            <p
              className={`${fieldClassName} cursor-default bg-zinc-50 text-zinc-700 dark:bg-neutral-900/80 dark:text-neutral-200`}
              aria-readonly
            >
              {formatPhoneNumber(session.phone)}
            </p>
          </ProfileField>

          <ProfileField icon={User} label="이름 (닉네임)">
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="이름 입력"
              autoComplete="nickname"
              className={fieldClassName}
            />
          </ProfileField>

          <ProfileField icon={Calendar} label="생년월일 (선택)" hint="매장 캘린더에 표시됩니다.">
            <input
              type="date"
              value={birthDate}
              max={birthDateInputMax()}
              onChange={(e) => onBirthDateChange(e.target.value)}
              className={fieldClassName}
            />
          </ProfileField>
        </div>

        <div className="border-t border-zinc-100 px-5 py-4 dark:border-white/5">
          <button
            type="submit"
            disabled={busy || !canSave}
            className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-neutral-200"
          >
            {busy ? "저장 중..." : "프로필 저장"}
          </button>
        </div>
      </form>
    </section>
  );
}
