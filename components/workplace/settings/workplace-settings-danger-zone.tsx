"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/overlay/confirm-dialog";
import { workApi } from "@/lib/api/work-api";
import { toast } from "@/lib/toast";
import type { Branch, Employee } from "@/types/work";

type WorkplaceSettingsDangerZoneProps = {
  branch: Branch;
  session: Employee;
  canDelete: boolean;
  onAfterDelete: () => Promise<void>;
};

export function WorkplaceSettingsDangerZone({
  branch,
  session,
  canDelete,
  onAfterDelete,
}: WorkplaceSettingsDangerZoneProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    const ok = await workApi.deleteMyCreatedBranch(branch.id, session.phone);
    setBusy(false);
    setOpen(false);
    if (!ok) {
      toast.error("지점을 삭제하지 못했습니다. 소유자만 삭제할 수 있습니다.");
      return;
    }
    toast.success("지점을 삭제했습니다.");
    window.dispatchEvent(new Event("workplace:changed"));
    await onAfterDelete();
    router.push("/workplace");
  };

  if (!canDelete) {
    return null;
  }

  return (
    <>
      <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/25">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
          위험 구역
        </p>
        <p className="mt-2 text-sm text-rose-900/90 dark:text-rose-100/90">
          지점을 삭제하면 연결된 설정과 알림에 영향을 줄 수 있습니다. 되돌릴 수 없습니다.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800 shadow-sm transition-colors hover:bg-rose-50 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100 dark:hover:bg-rose-900/80"
        >
          이 지점 삭제
        </button>
      </div>

      <ConfirmDialog
        open={open}
        title="지점을 삭제할까요?"
        description={`「${branch.name}」 지점과 관련 데이터 처리 방침에 따라 삭제가 진행됩니다. 계속할까요?`}
        confirmText="삭제하기"
        cancelText="취소"
        tone="danger"
        busy={busy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
