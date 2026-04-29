"use client";

import { formatPhoneNumber } from "@/lib/phone";
import { toast } from "@/lib/toast";

type FirstProfileFormProps = {
  phone: string;
  name: string;
  busy: boolean;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
};

export function FirstProfileForm({
  phone,
  name,
  busy,
  onNameChange,
  onSubmit,
}: FirstProfileFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">프로필 등록</h2>
        <p className="text-xs text-zinc-500 dark:text-neutral-500">{formatPhoneNumber(phone)}</p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-zinc-300/90 bg-zinc-100/80 dark:border-white/20 dark:bg-neutral-950/70"
          onClick={() => toast.message("프로필 사진은 곧 연결될 예정이에요.")}
        >
          <p className="text-xs text-zinc-500 dark:text-neutral-400">프로필</p>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-zinc-600 dark:text-neutral-400">이름 (닉네임)</span>
        <input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="이름 입력"
          className="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-white/35"
        />
      </label>

      <button
        onClick={onSubmit}
        disabled={busy || !name.trim()}
        className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-950"
      >
        {busy ? "처리 중..." : "프로필 완료"}
      </button>
    </div>
  );
}
