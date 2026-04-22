"use client";

import { formatPhoneNumber } from "@/lib/phone";

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
        <h2 className="text-base font-semibold text-white">프로필 등록</h2>
        <p className="text-xs text-neutral-500">{formatPhoneNumber(phone)}</p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-white/20 bg-neutral-950/70"
          onClick={() => alert("프로필 업로드 기능을 연결할 예정입니다.")}
        >
          <p className="text-xs text-neutral-400">프로필</p>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-neutral-400">이름 (닉네임)</span>
        <input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="이름 입력"
          className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm outline-none transition-colors focus:border-white/35"
        />
      </label>

      <button
        onClick={onSubmit}
        disabled={busy || !name.trim()}
        className="w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60"
      >
        {busy ? "처리 중..." : "프로필 완료"}
      </button>
    </div>
  );
}
