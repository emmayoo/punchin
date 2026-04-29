"use client";

import Link from "next/link";

import type { Branch } from "@/types/work";

type FieldKey = "name" | "businessNumber" | "address" | "storePhone";

const FIELD_ORDER: { key: FieldKey; label: string }[] = [
  { key: "name", label: "지점명" },
  { key: "businessNumber", label: "사업자 번호" },
  { key: "address", label: "주소" },
  { key: "storePhone", label: "가게 번호" },
];

function displayValue(branch: Branch, key: FieldKey): string {
  switch (key) {
    case "name":
      return branch.name.trim() || "-";
    case "businessNumber":
      return branch.businessNumber.trim() || "-";
    case "address":
      return branch.address?.trim() || "-";
    case "storePhone":
      return branch.storePhone?.trim() || "-";
    default:
      return "-";
  }
}

type WorkplaceSettingsBranchSectionProps = {
  branch: Branch;
  canEdit: boolean;
  /** `canEdit`일 때만 사용 — 지점 기본 정보 수정 하위 화면 경로 */
  editHref: string;
};

export function WorkplaceSettingsBranchSection({
  branch,
  canEdit,
  editHref,
}: WorkplaceSettingsBranchSectionProps) {
  return (
    <div className="relative rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5">
      {canEdit ? (
        <Link
          href={editHref}
          className="absolute right-4 top-4 z-10 rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-white/15 dark:bg-neutral-900/90 dark:text-neutral-300 dark:hover:border-white/25 dark:hover:text-white"
        >
          수정
        </Link>
      ) : null}

      <p
        className={`text-xs font-medium text-zinc-500 dark:text-neutral-500 ${canEdit ? "pr-14" : ""}`}
      >
        지점 기본 정보
      </p>

      <dl className="mt-3 space-y-3 text-sm">
        {FIELD_ORDER.map(({ key, label }) => (
          <div key={key}>
            <dt className="text-xs text-zinc-500 dark:text-neutral-500">{label}</dt>
            <dd className="mt-0.5 text-zinc-900 dark:text-neutral-100">{displayValue(branch, key)}</dd>
          </div>
        ))}
      </dl>

      {!canEdit ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-neutral-500">
          지점 정보 수정은 소유자(owner)만 할 수 있습니다.
        </p>
      ) : null}
    </div>
  );
}
